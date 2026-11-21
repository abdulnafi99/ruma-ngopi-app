/* =========================================================
   PUSH NOTIFICATION — fungsi server Vercel (POST /api/push)

   App pelanggan & admin panggil endpoint ini dengan Firebase ID token.
   Server semak siapa pemanggil, baca data sebenar dari Realtime Database,
   kemudian hantar Web Push ke telefon yang berkaitan.

   Event:
     order.new      pelanggan buat pesanan        → semua admin
     order.status   admin tukar status pesanan    → pelanggan pesanan itu
     member.update  kaunter ubah kad ahli         → pelanggan itu
     test           butang "Hantar ujian"         → peranti pemanggil

   Env Vercel yang diperlukan:
     FIREBASE_SERVICE_ACCOUNT  JSON service account Firebase (atau base64)
     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
   ========================================================= */
const admin = require("firebase-admin");
const webpush = require("web-push");

const ADMIN_UIDS = ["cqFIzYAssCX2HIcbdHFMyvbF0q33"];
const DB_URL = process.env.FIREBASE_DB_URL || "https://rumangopi-app-default-rtdb.asia-southeast1.firebasedatabase.app";
const STATUS_MSG = {
  "Disediakan":   (o) => ({ title: `Pesanan #${o.no} sedang disediakan ☕`, body: "Kami sedang bancuh pesanan anda." }),
  "Siap diambil": (o) => ({ title: `Pesanan #${o.no} siap! 🎉`, body: "Sila ambil di kaunter RumaNgopi." }),
  "Selesai":      (o) => ({ title: `Terima kasih! #${o.no}`, body: "Pesanan selesai. Jumpa lagi di RumaNgopi." }),
};

let ctx = null;
function init(){
  if(ctx) return ctx;
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if(!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT belum ditetapkan");
  if(!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(raw);
  if(!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY belum ditetapkan");
  if(!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: DB_URL });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://ruma-ngopi-app.vercel.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  ctx = { db: admin.database(), auth: admin.auth() };
  return ctx;
}

const rm = n => "RM " + Number(n || 0).toFixed(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const val = async (db, path) => (await db.ref(path).get()).val();

/* Data dari telefon mungkin belum sampai ke DB — cuba beberapa kali */
async function waitFor(db, path, ok, tries = 6){
  for(let i = 0; i < tries; i++){
    const v = await val(db, path);
    if(v && ok(v)) return v;
    await sleep(500);
  }
  return null;
}
async function adminUids(db){
  const extra = Object.entries((await val(db, "admins")) || {}).filter(([, v]) => v === true).map(([k]) => k);
  return [...new Set([...ADMIN_UIDS, ...extra])];
}
/* Hantar ke semua langganan push milik uid (ikut peranan: "admin" atau "user") */
async function sendTo(db, uids, role, payload){
  let sent = 0, removed = 0;
  for(const uid of uids){
    const subs = (await val(db, `pushSubs/${uid}`)) || {};
    for(const [id, s] of Object.entries(subs)){
      if(!s || !s.sub || (role && s.role !== role)) continue;
      try{
        await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
        sent++;
      }catch(err){
        if(err && (err.statusCode === 404 || err.statusCode === 410)){ await db.ref(`pushSubs/${uid}/${id}`).remove(); removed++; }
        else console.warn("push gagal", uid, id, err && (err.statusCode || err.message));
      }
    }
  }
  return { sent, removed };
}

module.exports = async function handler(req, res){
  // Kunci awam VAPID untuk app (bukan rahsia)
  if(req.method === "GET"){
    const key = process.env.VAPID_PUBLIC_KEY || "";
    res.setHeader("Cache-Control", "public, max-age=300");
    return key ? res.json({ publicKey: key }) : res.status(500).json({ error: "not-configured" });
  }
  if(req.method !== "POST") return res.status(405).json({ error: "method-not-allowed" });
  let c;
  try{ c = init(); }catch(e){ console.error(e); return res.status(500).json({ error: "not-configured", detail: e.message }); }
  const { db, auth } = c;

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let uid;
  try{ uid = (await auth.verifyIdToken(token)).uid; }catch(e){ return res.status(401).json({ error: "unauthenticated" }); }

  let body = req.body || {};
  if(typeof body === "string"){ try{ body = JSON.parse(body || "{}"); }catch(e){ body = {}; } }
  const ev = body.event;
  const isAdmin = ADMIN_UIDS.includes(uid) || (await val(db, `admins/${uid}`)) === true;
  const safeNo = /^[A-Z]\d{1,8}$/.test(String(body.no || "")) ? String(body.no) : null;

  try{
    if(ev === "test"){
      const r = await sendTo(db, [uid], body.role === "admin" ? "admin" : "user", {
        title: "RumaNgopi", body: "Notifikasi berfungsi ✓", url: body.role === "admin" ? "./admin.html#orders" : "./index.html#home", tag: "test" });
      return res.json({ ok: true, ...r });
    }

    if(ev === "order.new"){
      if(!safeNo) return res.status(400).json({ error: "bad-order" });
      const o = await waitFor(db, `orders/${safeNo}`, () => true);
      if(!o) return res.status(404).json({ error: "order-not-found" });
      const mine = await val(db, `users/${uid}/memberId`);
      if(o.memberId !== mine && !isAdmin) return res.status(403).json({ error: "forbidden" });
      const items = Array.isArray(o.items) ? o.items.length : Object.keys(o.items || {}).length;
      const r = await sendTo(db, await adminUids(db), "admin", {
        title: `Pesanan baru #${o.no}`,
        body: `${o.name || "Ahli"} · ${items} item · ${rm(o.total)} · Pickup ${o.pickup?.label || "secepat mungkin"}${o.pay === "DuitNow" ? " · DuitNow" : ""}`,
        url: "./admin.html#orders", tag: `order-${o.no}` });
      return res.json({ ok: true, ...r });
    }

    if(ev === "order.status"){
      if(!isAdmin) return res.status(403).json({ error: "forbidden" });
      if(!safeNo || !STATUS_MSG[body.status]) return res.status(400).json({ error: "bad-request" });
      const o = await waitFor(db, `orders/${safeNo}`, x => x.status === body.status);
      if(!o) return res.status(409).json({ error: "status-mismatch" });
      const owner = await val(db, `members/${o.memberId}/ownerUid`);
      if(!owner) return res.json({ ok: true, sent: 0, note: "no-owner" });
      const r = await sendTo(db, [owner], "user", { ...STATUS_MSG[o.status](o), url: "./index.html#menu", tag: `order-${o.no}` });
      return res.json({ ok: true, ...r });
    }

    if(ev === "member.update"){
      if(!isAdmin) return res.status(403).json({ error: "forbidden" });
      if(!/^\d{12}$/.test(String(body.memberId || ""))) return res.status(400).json({ error: "bad-member" });
      const m = await val(db, `members/${body.memberId}`);
      if(!m || !m.ownerUid) return res.json({ ok: true, sent: 0, note: "no-owner" });
      const text = String(body.text || "").slice(0, 120) || "Kad ahli anda telah dikemas kini.";
      const r = await sendTo(db, [m.ownerUid], "user", {
        title: "Kad ahli dikemas kini", body: `${text} · ${m.points || 0} point, ${m.stamps || 0} cap`, url: "./index.html#cap", tag: "card" });
      return res.json({ ok: true, ...r });
    }

    return res.status(400).json({ error: "unknown-event" });
  }catch(e){
    console.error("push error", e);
    return res.status(500).json({ error: "server-error" });
  }
};
