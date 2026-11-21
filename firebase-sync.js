/* =========================================================
   FIREBASE REALTIME DATABASE — segerak data RumaNgopi.
   Dimuatkan oleh firebase-config.js. Struktur data:

     store/menu, store/rewards, store/settings, store/shop   ← admin tulis, semua baca
     users/{uid}            { memberId, phone, name }        ← akaun pelanggan → kad ahli
     members/{memberId}     kad ahli (point, cap, sejarah, ownerUid)
     orders/{no}                                             ← pesanan pickup
     vouchers/{code}                                         ← baucar ganjaran
     counters/orderNo                                        ← nombor pesanan seterusnya
     admins/{uid}: true                                      ← siapa boleh ubah store/* (set di console)
     pushSubs/{uid}/{id}    { sub, role }                    ← langganan Web Push setiap peranti

   Akaun pelanggan: no telefon + kata laluan. Di Firebase Auth ia disimpan
   sebagai Email/Password dengan emel "<60xxxxxxxxx>@rumangopi.app".
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, onValue, set, update, remove, query, orderByChild, equalTo, limitToLast, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  EmailAuthProvider, linkWithCredential, signOut }
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

/* ---------- No telefon ↔ emel Firebase ---------- */
/* Terima 012-345 6789, 0123456789, +60123456789, 60123456789 → "60123456789" */
function normPhone(raw){
  let d = String(raw || "").replace(/\D/g, "");
  if(d.startsWith("60")) d = d.slice(2);
  if(d.startsWith("0")) d = d.slice(1);
  return /^1\d{8,9}$/.test(d) ? "60" + d : null;
}
const phoneEmail = p => `${p}@rumangopi.app`;
const emailPhone = e => String(e || "").split("@")[0];
function newMemberId(){
  const a = new Uint32Array(3); crypto.getRandomValues(a);
  return Array.from(a, x => String(x % 10000).padStart(4, "0")).join("");
}

/* ---------- Tulis: localStorage → Firebase ---------- */
let memberId = null, memberReady = false, registering = false;
let unsubs = [];
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
  if(ROLE === "customer"){
    if(k === K.loyalty){
      // Hanya kad milik akaun yang sedang log masuk, selepas data dari Firebase diterima
      if(!val || !memberReady || val.memberId !== memberId) return;
      set(ref(db, `members/${memberId}`), clean({ ...val, ownerUid: val.ownerUid || auth.currentUser?.uid, updatedAt: Date.now() })).catch(fail("Simpan kad ahli"));
      return;
    }
    if(!memberId) return;   // belum log masuk: jangan hantar pesanan/baucar
  }
  if(k === K.orders) return pushList(k, "orders", "no", val);
  if(k === K.vouchers) return pushList(k, "vouchers", "code", val);
}

/* ---------- Baca: Firebase → localStorage ---------- */
function watchStore(){
  Object.entries(STORE).forEach(([k, path]) => {
    onValue(ref(db, path), s => {
      const v = s.val();
      storeReady[k] = true;
      if(v == null){
        // DB masih kosong: admin naikkan tetapan sedia ada dari peranti ini
        const loc = read(k);
        if(ROLE === "admin" && loc != null) set(ref(db, path), clean(loc)).catch(fail("Naik tetapan awal"));
        return;
      }
      RN.applyRemote(k, NORM[k](v));
    }, fail(`Baca ${path}`));
  });
}
function applyList(k, s, norm){
  const list = arr(s.val()).map(norm).sort(byTsDesc);
  RN.baseline[k] = list;
  RN.applyRemote(k, list);
}
function stopMember(){
  unsubs.splice(0).forEach(u => { try{ u(); }catch(e){} });
  memberId = null; memberReady = false;
}
function clearLocalCard(){
  RN.baseline[K.orders] = []; RN.baseline[K.vouchers] = [];
  RN.applyRemote(K.loyalty, null); RN.applyRemote(K.orders, []); RN.applyRemote(K.vouchers, []);
}
/* Sambung kad ahli akaun ini (dan pesanan/baucarnya) */
function watchMember(id){
  if(memberId === id) return;
  stopMember();
  const cur = read(K.loyalty);
  if(!cur || cur.memberId !== id) clearLocalCard();      // kad lain dalam peranti: buang dahulu
  memberId = id;
  unsubs.push(onValue(ref(db, `members/${id}`), s => {
    const v = s.val();
    memberReady = true;
    if(v) RN.applyRemote(K.loyalty, normMember({ memberId: id, ...v }));
  }, fail("Baca kad ahli")));
  unsubs.push(onValue(query(ref(db, "orders"), orderByChild("memberId"), equalTo(id)), s => applyList(K.orders, s, normOrder), fail("Baca pesanan")));
  unsubs.push(onValue(query(ref(db, "vouchers"), orderByChild("id"), equalTo(id)), s => applyList(K.vouchers, s, x => x), fail("Baca baucar")));
}
function watchAdmin(){
  onValue(ref(db, "members"), s => {
    const map = {}; Object.entries(s.val() || {}).forEach(([id, m]) => { if(m) map[id] = normMember({ memberId: id, ...m }); });
    RN.applyRemote(K.members, map);
  }, fail("Baca ahli"));
  onValue(query(ref(db, "orders"), orderByChild("ts"), limitToLast(300)), s => applyList(K.orders, s, normOrder), fail("Baca pesanan"));
  onValue(query(ref(db, "vouchers"), orderByChild("ts"), limitToLast(300)), s => applyList(K.vouchers, s, x => x), fail("Baca baucar"));
}

/* ---------- Akaun pelanggan ---------- */
/* Cipta kad ahli + profil untuk akaun baru. Kad dalam peranti (jika ada) dikekalkan. */
async function createProfile(user, phone, name){
  const card = read(K.loyalty);
  const id = card && /^\d{12}$/.test(card.memberId) ? card.memberId : newMemberId();
  const base = card && card.memberId === id ? card : {};
  const rec = normMember({ notif:true, offline:true, ...base, memberId:id, name: name || base.name || "", phone, ownerUid:user.uid,
    joined: base.joined || Date.now(), updatedAt: Date.now() });
  await set(ref(db, `members/${id}`), clean(rec));
  const prof = { memberId:id, phone, name: rec.name, createdAt: Date.now() };
  await set(ref(db, `users/${user.uid}`), prof);
  return prof;
}
RN.normPhone = normPhone;
RN.register = async (rawPhone, pass, name) => {
  const phone = normPhone(rawPhone);
  if(!phone) throw { code: "app/invalid-phone" };
  const email = phoneEmail(phone);
  registering = true;
  try{
    let user = auth.currentUser;
    if(user && user.isAnonymous) user = (await linkWithCredential(user, EmailAuthProvider.credential(email, pass))).user;  // kekalkan kad lama peranti
    else user = (await createUserWithEmailAndPassword(auth, email, pass)).user;
    const prof = await createProfile(user, phone, name);
    RN.profile = prof; watchMember(prof.memberId); RN.emit("auth", user);
    return prof;
  }finally{ registering = false; }
};
RN.login = async (rawPhone, pass) => {
  const phone = normPhone(rawPhone);
  if(!phone) throw { code: "app/invalid-phone" };
  return signInWithEmailAndPassword(auth, phoneEmail(phone), pass);
};
RN.logoutUser = async () => { await RN.push?.disable(true).catch(() => {}); stopMember(); clearLocalCard(); await signOut(auth); };

/* ---------- Push notification (Web Push + /api/push) ---------- */
const PUSH_ROLE = ROLE === "admin" ? "admin" : "user";
const pushOK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol.startsWith("http");
const b64key = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function subId(endpoint){
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(h).slice(0, 12), x => x.toString(16).padStart(2, "0")).join("");
}
async function swReg(){
  const r = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register("sw.js");
  return navigator.serviceWorker.ready.then(() => r);
}
async function saveSub(sub){
  const u = auth.currentUser; if(!u || u.isAnonymous || !sub) return false;
  await set(ref(db, `pushSubs/${u.uid}/${await subId(sub.endpoint)}`), { sub: clean(sub.toJSON()), role: PUSH_ROLE, ua: navigator.userAgent.slice(0, 140), ts: Date.now() });
  return true;
}
RN.push = {
  supported: pushOK,
  /* iPhone: push hanya bila app dipasang ke skrin utama (iOS 16.4+) */
  needsInstall: /iphone|ipad|ipod/i.test(navigator.userAgent) && !(matchMedia("(display-mode: standalone)").matches || navigator.standalone),
  permission: () => ("Notification" in window ? Notification.permission : "unsupported"),
  async isOn(){
    if(!pushOK) return false;
    const r = await navigator.serviceWorker.getRegistration(); const s = r && await r.pushManager.getSubscription();
    return !!s;
  },
  async enable(){
    if(!pushOK) throw { code: RN.push.needsInstall ? "push/install" : "push/unsupported" };
    if(!auth.currentUser || auth.currentUser.isAnonymous) throw { code: "push/login" };
    const p = await Notification.requestPermission();
    if(p !== "granted") throw { code: "push/denied" };
    const reg = await swReg();
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      const k = await fetch("api/push?key=1").then(r => r.ok ? r.json() : {}).catch(() => ({}));
      if(!k.publicKey) throw { code: "push/server" };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(k.publicKey) });
    }
    await saveSub(sub);
    return true;
  },
  /* forget=true: hanya buang dari akaun (cth. log keluar), langganan pelayar dikekalkan */
  async disable(forget){
    if(!pushOK) return;
    const r = await navigator.serviceWorker.getRegistration(); const sub = r && await r.pushManager.getSubscription();
    if(!sub) return;
    const u = auth.currentUser;
    if(u && !u.isAnonymous) await remove(ref(db, `pushSubs/${u.uid}/${await subId(sub.endpoint)}`)).catch(() => {});
    if(!forget) await sub.unsubscribe().catch(() => {});
  },
  test: () => RN.notify("test", { role: PUSH_ROLE }, true),
};
/* Minta server hantar notifikasi. Tidak menyekat app; ralat diabaikan kecuali wait=true. */
RN.notify = async (event, data = {}, wait = false) => {
  try{
    const u = auth.currentUser; if(!u || u.isAnonymous) return null;
    const res = await fetch("api/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await u.getIdToken() },
      body: JSON.stringify({ event, ...data }) });
    const out = await res.json().catch(() => ({}));
    if(!res.ok && wait) throw { code: "push/server", status: res.status, detail: out.error };
    return out;
  }catch(e){ if(wait) throw e; return null; }
};
/* Bila log masuk: jika telefon ini sudah benarkan notifikasi, pautkan ke akaun semasa */
async function resyncPush(){
  try{
    if(!pushOK) return;
    const r = await navigator.serviceWorker.getRegistration(); const sub = r && await r.pushManager.getSubscription();
    if(sub) await saveSub(sub);
  }catch(e){}
}

/* ---------- Fungsi lain untuk app ---------- */
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
watchStore();   // menu, ganjaran, alamat & waktu: boleh dibaca tanpa log masuk

let adminStarted = false;
onAuthStateChanged(auth, async user => {
  RN.uid = user ? user.uid : null;
  const real = user && !user.isAnonymous ? user : null;
  if(ROLE === "admin"){
    RN.emit("auth", real);
    if(real && !adminStarted){ adminStarted = true; watchAdmin(); resyncPush(); }
    return;
  }
  if(registering) return;                    // RN.register uruskan sendiri
  if(!real){ RN.profile = null; stopMember(); RN.emit("auth", null); return; }
  try{
    let prof = (await get(ref(db, `users/${real.uid}`))).val();
    if(!prof || !prof.memberId) prof = await createProfile(real, emailPhone(real.email), "");
    RN.profile = prof; watchMember(prof.memberId); RN.emit("auth", real); resyncPush();
  }catch(err){ fail("Muat akaun")(err); RN.emit("auth", null); }
});
