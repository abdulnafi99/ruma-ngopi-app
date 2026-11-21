/* =========================================================
   FIREBASE — config projek "rumangopi-app" + lapisan segerak.
   Config web Firebase bukan rahsia (keselamatan dikawal oleh
   database.rules.json & Firebase Auth).

   Cara ia berfungsi:
   - App (index.html / admin.html) masih baca & tulis localStorage seperti biasa.
   - Fail ini memintas localStorage.setItem untuk kunci yang dikongsi dan
     menghantarnya ke Realtime Database (melalui firebase-sync.js).
   - Data dari Realtime Database ditulis semula ke localStorage dan app
     dimaklumkan melalui event "storage", jadi skrin dikemas kini secara langsung.
   Muatkan fail ini SEBELUM menu.js / shop.js / skrip app.
   ========================================================= */
window.RN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDBzYRdjzJY7d1VOTxB11beNj7OR0m1SOY",
  authDomain: "rumangopi-app.firebaseapp.com",
  databaseURL: "https://rumangopi-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rumangopi-app",
  storageBucket: "rumangopi-app.firebasestorage.app",
  messagingSenderId: "727813449000",
  appId: "1:727813449000:web:7220348ef632cc082d9c1d",
  measurementId: "G-6JVP9LHL1L"
};
/* Kunci Web Push (VAPID) disimpan dalam env Vercel; app ambil kunci awam dari GET /api/push?key=1 */

(function(){
  const ROLE = document.documentElement.dataset.role === "admin" ? "admin" : "customer";
  const K = {
    loyalty:  "rumangopi-loyalty-v1",   // kad ahli pelanggan (peranti ini)
    menu:     "rumangopi-menu-v2",
    rewards:  "rumangopi-rewards-v1",
    settings: "rumangopi-settings-v1",
    shop:     "rumangopi-shop-v1",
    orders:   "rumangopi-orders-v1",
    vouchers: "rumangopi-vouchers-v1",
    members:  "rumangopi-members-live", // admin: semua ahli dari Firebase
    db:       "rumangopi-admin-v1",     // data demo admin (tidak digunakan dalam mod live)
    cart:     "rumangopi-cart-v2",
  };
  const ls = window.localStorage, origSet = Storage.prototype.setItem;
  const snap = k => { try{ return JSON.parse(ls.getItem(k)); }catch(e){ return null; } };

  // Kali pertama mod live pada peranti ini: buang data demo (ahli demo, pesanan & baucar contoh)
  try{
    if(!ls.getItem("rumangopi-live-v1")){
      [K.loyalty, K.orders, K.vouchers, K.db, K.cart].forEach(k => ls.removeItem(k));
      origSet.call(ls, "rumangopi-live-v1", String(Date.now()));
    }
  }catch(e){}

  const baseline = { [K.orders]: snap(K.orders), [K.vouchers]: snap(K.vouchers) };
  const queue = []; let transport = null, applying = false;

  Storage.prototype.setItem = function(k, v){
    origSet.call(this, k, v);
    if(this !== ls || applying) return;
    if(transport) transport.local(k, v); else queue.push([k, v]);
  };

  const listeners = { status: [], auth: [], error: [] };
  const RN = window.RN = {
    LIVE: true, ROLE, K, baseline,
    status: "connecting",       // connecting | live | offline
    user: undefined,            // undefined = belum tahu, null = tiada login
    /* Tulis data dari Firebase ke localStorage tanpa hantar semula, kemudian maklumkan app */
    applyRemote(k, val){
      const nv = val == null ? null : JSON.stringify(val), old = ls.getItem(k);
      if(old === nv) return;
      applying = true;
      try{ if(nv == null) ls.removeItem(k); else origSet.call(ls, k, nv); }catch(e){}
      applying = false;
      try{ dispatchEvent(new StorageEvent("storage", { key: k, oldValue: old, newValue: nv })); }catch(e){}
    },
    attach(t){ transport = t; queue.splice(0).forEach(([k, v]) => t.local(k, v)); },
    on(type, cb){ listeners[type].push(cb); if(type === "status") cb(RN.status); if(type === "auth" && RN.user !== undefined) cb(RN.user); },
    emit(type, val){ if(type === "status") RN.status = val; if(type === "auth") RN.user = val; listeners[type].forEach(cb => { try{ cb(val); }catch(e){} }); },
    // Diisi oleh firebase-sync.js:
    nextOrderNo: null, txMember: null, signInAdmin: null, signOut: null, push: null, notify: () => {},
  };

  import("./firebase-sync.js").catch(err => {
    console.warn("[RumaNgopi] Firebase tidak dapat dimuatkan, guna data dalam peranti:", err);
    RN.emit("status", "offline");
    if(ROLE === "admin") RN.emit("auth", null);
  });
})();
