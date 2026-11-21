/* =========================================================
   FIREBASE REALTIME DATABASE — segerak data RumaNgopi.
   Dimuatkan oleh firebase-config.js. Struktur data:

     store/menu, store/rewards, store/settings, store/shop   ← admin tulis, semua baca
     members/{memberId}                                      ← kad ahli (point, cap, sejarah)
     orders/{no}                                             ← pesanan pickup
     vouchers/{code}                                         ← baucar ganjaran
     counters/orderNo                                        ← nombor pesanan seterusnya
     admins/{uid}: true                                      ← siapa boleh ubah store/* (set di console)
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, query, orderByChild, equalTo, limitToLast, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const RN = window.RN, K = RN.K, ROLE = RN.ROLE;
const app = initializeApp(window.RN_FIREBASE_CONFIG);
isSupported().then(ok => { if(ok) getAnalytics(app); }).catch(() => {});
const db = getDatabase(app);
const auth = getAuth(app);

const STORE = { [K.menu]: "store/menu", [K.rewards]: "store/rewards", [K.settings]: "store/settings", [K.shop]: "store/shop" };
const clean = v => JSON.parse(JSON.stringify(v ?? null));      // buang undefined (Firebase tolak undefined)
const read = k => { try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
const fail = what => err => { console.warn(`[RumaNgopi] ${what}:`, err); RN.emit("error", { what, code: err?.code || String(err) }); };
const arr = v => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];

/* Firebase buang array/objek kosong — pulihkan bentuk yang app jangka */
const NORM = {
  [K.menu]: v => arr(v).map(p => ({ ...p, groups: arr(p.groups).map(g => ({ ...g, options: arr(g.options) })) })),
  [K.rewards]: v => arr(v),
  [K.settings]: v => v,
  [K.shop]: v => ({ ...v, hours: arr(v.hours) }),
};
const normMember = m => ({ points:0, lifetime:0, stamps:0, redeemed:0, ...m, history: arr(m.history) });
const normOrder = o => ({ ...o, items: arr(o.items) });
const byTsDesc = (a, b) => (b.ts || 0) - (a.ts || 0);

/* ---------- Tulis: localStorage → Firebase ---------- */
let memberId = null, memberReady = false, pendingMember = null, started = false;
const storeReady = {};
function pushList(k, path, idField, list){
  if(!Array.isArray(list)) return;
  const base = new Map(arr(RN.baseline[k]).map(x => [x && x[idField], JSON.stringify(x)]));
  const upd = {};
  list.forEach(x => { if(x && x[idField] && base.get(x[idField]) !== JSON.stringify(x)) upd[x[idField]] = clean(x); });
  RN.baseline[k] = list;
  if(Object.keys(upd).length) update(ref(db, path), upd).catch(fail(`Simpan ${path}`));
}
function local(k, v){
  let val; try{ val = JSON.parse(v); }catch(e){ return; }
  if(STORE[k]){
    if(ROLE === "admin" && storeReady[k]) set(ref(db, STORE[k]), clean(val)).catch(fail("Simpan tetapan kedai"));
    return;
  }
  if(k === K.loyalty && ROLE === "customer"){
    if(!val || !val.memberId) return;
    if(!started){ pendingMember = val; return; }            // belum log masuk: start() akan sambung
    if(val.memberId !== memberId) watchMember(val.memberId);
    if(!memberReady){ pendingMember = val; return; }       // tunggu data dari Firebase dahulu
    set(ref(db, `members/${val.memberId}`), clean({ ...val, updatedAt: Date.now() })).catch(fail("Simpan kad ahli"));
    return;
  }
  if(k === K.orders) return pushList(k, "orders", "no", val);
  if(k === K.vouchers) return pushList(k, "vouchers", "code", val);
}

/* ---------- Baca: Firebase → localStorage ---------- */
function watchStore(){
  Object.entries(STORE).forEach(([k, path]) => {
    onValue(ref(db, path), s => {
      const v = s.val();
      if(v == null){
        storeReady[k] = true;
        // DB masih kosong: admin naikkan tetapan sedia ada dari peranti ini
        const loc = read(k);
        if(ROLE === "admin" && loc != null) set(ref(db, path), clean(loc)).catch(fail("Naik tetapan awal"));
        return;
      }
      storeReady[k] = true;
      RN.applyRemote(k, NORM[k](v));
    }, fail(`Baca ${path}`));
  });
}
function applyList(k, s, norm){
  const list = arr(s.val()).map(norm).sort(byTsDesc);
  RN.baseline[k] = list;
  RN.applyRemote(k, list);
}
function watchMember(id){
  if(memberId === id) return;
  memberId = id; memberReady = false;
  onValue(ref(db, `members/${id}`), s => {
    const v = s.val();
    if(!memberReady){
      memberReady = true;
      if(v == null){   // ahli baru: daftar kad dari peranti ini
        const loc = pendingMember || read(K.loyalty);
        if(loc && loc.memberId === id) set(ref(db, `members/${id}`), clean({ ...loc, joined: loc.joined || Date.now(), updatedAt: Date.now() })).catch(fail("Daftar ahli"));
        pendingMember = null; return;
      }
      pendingMember = null;
    }
    if(v) RN.applyRemote(K.loyalty, normMember(v));
  }, fail("Baca kad ahli"));
  onValue(query(ref(db, "orders"), orderByChild("memberId"), equalTo(id)), s => applyList(K.orders, s, normOrder), fail("Baca pesanan"));
  onValue(query(ref(db, "vouchers"), orderByChild("id"), equalTo(id)), s => applyList(K.vouchers, s, x => x), fail("Baca baucar"));
}
function watchAdmin(){
  onValue(ref(db, "members"), s => {
    const map = {}; Object.entries(s.val() || {}).forEach(([id, m]) => { if(m) map[id] = normMember({ memberId: id, ...m }); });
    RN.applyRemote(K.members, map);
  }, fail("Baca ahli"));
  onValue(query(ref(db, "orders"), orderByChild("ts"), limitToLast(300)), s => applyList(K.orders, s, normOrder), fail("Baca pesanan"));
  onValue(query(ref(db, "vouchers"), orderByChild("ts"), limitToLast(300)), s => applyList(K.vouchers, s, x => x), fail("Baca baucar"));
}

/* ---------- Fungsi untuk app ---------- */
RN.nextOrderNo = async () => {
  const fallback = "W" + String(Date.now()).slice(-5);
  try{
    const r = await Promise.race([
      runTransaction(ref(db, "counters/orderNo"), c => (typeof c === "number" ? c : 100) + 1),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
    ]);
    return r.committed ? "A" + r.snapshot.val() : fallback;
  }catch(e){ return fallback; }
};
/* Admin ubah point/cap ahli secara atomik (tidak tindih perubahan dari telefon pelanggan) */
RN.txMember = (id, fn, txEntry) => runTransaction(ref(db, `members/${id}`), m => {
  if(!m) return m;
  m.history = arr(m.history);
  fn(m);
  if(txEntry) m.history.unshift(clean({ ts: txEntry.ts, t: txEntry.t, p: txEntry.p, n: txEntry.n }));
  m.history = m.history.slice(0, 200);
  m.updatedAt = Date.now();
  return m;
}).catch(fail("Kemas kini ahli"));
RN.signInAdmin = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
RN.signOut = () => signOut(auth);

/* ---------- Mula ---------- */
onValue(ref(db, ".info/connected"), s => RN.emit("status", s.val() ? "live" : "offline"));
RN.attach({ local });

onAuthStateChanged(auth, user => {
  RN.uid = user ? user.uid : null;
  if(ROLE === "admin"){
    RN.emit("auth", user && !user.isAnonymous ? user : null);
    if(user && !user.isAnonymous && !started){ started = true; watchStore(); watchAdmin(); }
    return;
  }
  if(!user){ signInAnonymously(auth).catch(err => { fail("Log masuk tanpa nama")(err); start(); }); return; }
  start();
});
function start(){
  if(started) return; started = true;
  watchStore();
  const me = pendingMember || read(K.loyalty);
  if(me && me.memberId) watchMember(me.memberId);
}
