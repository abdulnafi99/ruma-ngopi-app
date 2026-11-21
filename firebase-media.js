/* =========================================================
   GAMBAR DI FIRESTORE — gambar item & banner promosi.
   Dimuatkan oleh firebase-sync.js.

     images/{productId}   { data: "data:image/jpeg;base64,…", updatedAt }
     promos/{promoId}     { img, title, sub, badge, link, active, order, updatedAt }

   Semua orang boleh baca; hanya admin boleh tulis (lihat firestore.rules).
   Data lama di Realtime Database (store/images, store/promos) dipindahkan
   ke Firestore secara automatik bila admin log masuk.
   ========================================================= */
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, onSnapshot, writeBatch, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, get, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function start({ app, db, RN, K, ROLE, fail }){
  let fs;
  try{ fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch(e){ fs = initializeFirestore(app, { localCache: memoryLocalCache() }); }

  let imgs = null, promos = null, migrated = false;

  onSnapshot(collection(fs, "images"), snap => {
    const m = {};
    snap.forEach(d => { const v = d.data(); if(v && typeof v.data === "string") m[d.id] = v.data; });
    imgs = m; RN.applyRemote(K.images, m); maybeMigrate();
  }, fail("Baca gambar (Firestore)"));

  onSnapshot(query(collection(fs, "promos"), orderBy("order")), snap => {
    const a = [];
    snap.forEach(d => { const { order, updatedAt, ...v } = d.data(); void order; void updatedAt; a.push({ ...v, id: d.id }); });
    promos = a; RN.applyRemote(K.promos, a); maybeMigrate();
  }, fail("Baca promosi (Firestore)"));

  /* Admin: tulis hanya dokumen yang berubah */
  async function writeImages(map){
    map = map && typeof map === "object" ? map : {};
    const prev = imgs || {}, b = writeBatch(fs); let n = 0;
    for(const [id, data] of Object.entries(map)){
      if(typeof data === "string" && prev[id] !== data){ b.set(doc(fs, "images", id), { data, updatedAt: Date.now() }); n++; }
    }
    for(const id of Object.keys(prev)) if(!(id in map)){ b.delete(doc(fs, "images", id)); n++; }
    if(n) await b.commit();
  }
  async function writePromos(list){
    list = Array.isArray(list) ? list : [];
    const prev = new Map((promos || []).map((p, i) => [p.id, JSON.stringify({ ...p, order: i })]));
    const b = writeBatch(fs); let n = 0;
    list.forEach((p, i) => {
      if(!p || !p.id) return;
      const rec = { ...p, order: i }; delete rec.id;
      if(prev.get(p.id) !== JSON.stringify({ ...p, order: i })){ b.set(doc(fs, "promos", p.id), { ...rec, updatedAt: Date.now() }); n++; }
    });
    const keep = new Set(list.map(p => p && p.id));
    for(const id of prev.keys()) if(!keep.has(id)){ b.delete(doc(fs, "promos", id)); n++; }
    if(n) await b.commit();
  }
  /* Pindah data lama dari Realtime Database (sekali, oleh admin) */
  async function maybeMigrate(){
    if(migrated || ROLE !== "admin" || !RN.user || imgs === null || promos === null) return;
    migrated = true;
    try{
      const [ri, rp] = await Promise.all([get(ref(db, "store/images")), get(ref(db, "store/promos"))]);
      const oldImgs = ri.val(), oldPromos = rp.val();
      if(oldImgs && !Object.keys(imgs).length){ await writeImages(oldImgs); }
      if(oldPromos && !promos.length){ await writePromos(Array.isArray(oldPromos) ? oldPromos : Object.values(oldPromos)); }
      if(oldImgs) await remove(ref(db, "store/images"));
      if(oldPromos) await remove(ref(db, "store/promos"));
    }catch(e){ migrated = false; console.warn("[RumaNgopi] Pindah gambar ke Firestore gagal:", e); }
  }
  RN.on("auth", () => maybeMigrate());

  return {
    local(k, val){
      if(k !== K.images && k !== K.promos) return false;
      if(ROLE !== "admin") return true;            // pelanggan tidak menulis gambar
      (k === K.images ? writeImages(val) : writePromos(val)).catch(fail(k === K.images ? "Simpan gambar (Firestore)" : "Simpan promosi (Firestore)"));
      return true;
    },
  };
}
