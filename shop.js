/* =========================================================
   MAKLUMAT KEDAI — dikongsi oleh index.html (pelanggan) dan admin.html.
   Alamat pickup, DuitNow QR dan waktu pickup. Admin ubah di
   Tetapan & Waktu pickup; disimpan dalam localStorage "rumangopi-shop-v1".
   Pickup sahaja (tiada delivery).
   ========================================================= */
(function(){
  const KEY = "rumangopi-shop-v1";
  const DAYS = ["Ahad","Isnin","Selasa","Rabu","Khamis","Jumaat","Sabtu"];
  const DEF = {
    address: "", maps: "",          // alamat pickup + link Google Maps (pilihan)
    qr: "", qrName: "",             // gambar DuitNow QR (data URL) + nama penerima
    slot: 15,                       // selang slot pickup (minit)
    prep: 15,                       // masa sediakan minimum (minit)
    paused: false,                  // tutup sementara: tak terima pesanan
    hours: Array.from({length:7}, () => ({ open:true, from:"10:00", to:"22:00" })), // index ikut getDay() (0 = Ahad)
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  function load(){
    let c = {};
    try{ c = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
    const o = Object.assign(clone(DEF), c);
    if(!Array.isArray(o.hours) || o.hours.length !== 7) o.hours = clone(DEF.hours);
    return o;
  }
  function save(c){ localStorage.setItem(KEY, JSON.stringify(c)); }   // boleh throw jika storan penuh
  const toMin = s => { const [h,m] = String(s||"0:0").split(":").map(Number); return (h||0)*60 + (m||0); };
  const fmt12 = m => { let h = Math.floor(m/60)%24; const mm = m%60, ap = h>=12 ? "PM" : "AM"; h = h%12 || 12; return `${h}:${String(mm).padStart(2,"0")} ${ap}`; };
  function dayWindow(c, d){
    const h = c.hours[d.getDay()]; if(!h || !h.open) return null;
    const f = toMin(h.from), t = toMin(h.to);
    return t > f ? { f, t } : null;
  }
  /* Slot pickup hari ini. asap = boleh "secepat mungkin" sekarang. */
  function slots(c, now = new Date()){
    const none = { open:false, asap:false, list:[], window:null };
    if(c.paused) return none;
    const w = dayWindow(c, now); if(!w) return none;
    const n = now.getHours()*60 + now.getMinutes();
    const step = Math.max(5, +c.slot || 15), prep = Math.max(0, +c.prep || 0);
    const asap = n >= w.f && n + prep <= w.t;
    const start = Math.ceil(Math.max(w.f, n + prep + 1) / step) * step;
    const list = []; for(let m = start; m <= w.t; m += step) list.push(m);
    return { open: asap || list.length > 0, asap, list, window: w };
  }
  /* Bila kedai buka semula (teks), atau null jika sedang buka. */
  function nextOpen(c, now = new Date()){
    const n = now.getHours()*60 + now.getMinutes();
    for(let i = 0; i < 8; i++){
      const d = new Date(now); d.setDate(d.getDate() + i);
      const w = dayWindow(c, d); if(!w) continue;
      if(i === 0){
        if(n < w.f) return `hari ini ${fmt12(w.f)}`;
        if(!c.paused && n + Math.max(0, +c.prep || 0) <= w.t) return null;
        continue;
      }
      return `${i===1 ? "esok" : DAYS[d.getDay()]} ${fmt12(w.f)}`;
    }
    return null;
  }
  const todayLabel = (c, now = new Date()) => { const w = dayWindow(c, now); return w ? `${fmt12(w.f)} – ${fmt12(w.t)}` : "Tutup hari ini"; };
  window.RUMANGOPI_SHOP = { KEY, DAYS, DEF, load, save, slots, nextOpen, dayWindow, todayLabel, fmt12, toMin };
})();
