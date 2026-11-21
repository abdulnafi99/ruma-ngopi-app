/* =========================================================
   MENU RUMANGOPI by Irdina — dikongsi oleh index.html (pelanggan) dan admin.html.
   Ubah fail ini untuk tukar menu asal. Admin boleh ubah lagi dari dashboard
   (perubahan admin disimpan dalam localStorage "rumangopi-menu-v2").

   Setiap minuman: harga = saiz Regular. Large = +RM1 (pilihan "Saiz").
   `color` = warna gambar produk (pilihan).

   Jenis kumpulan add-on:
     type:"single" → pilih satu (radio). required:true = wajib.
     type:"multi"  → pilih banyak dengan kuantiti.
                     Setiap pilihan ada `max` = had kuantiti untuk SATU item.
                     Kumpulan ada `max` = had jumlah semua pilihan (0 = tiada had).
   ========================================================= */
(function(){
  const size = () => ({ id:"size", name:"Saiz", type:"single", required:true, options:[
    {id:"r",name:"Regular",price:0,active:true},
    {id:"l",name:"Large",price:1,active:true}] });
  const addon = (shot) => ({ id:"addon", name:"Add On", type:"multi", max:0, options:[
    {id:"whip",  name:"Whip cream",        price:2, max:1, active:true},
    ...(shot ? [{id:"shot", name:"Extra shot", price:1, max:2, active:true}] : []),
    {id:"cdriz", name:"Caramel drizzle",   price:1, max:1, active:true},
    {id:"chdriz",name:"Chocolate drizzle", price:1, max:1, active:true},
    {id:"foam",  name:"Cheese foam",       price:1, max:1, active:true},
    {id:"ccrum", name:"Caramel crumbs",    price:1, max:1, active:true},
    {id:"ocrum", name:"Oreo crumbs",       price:1, max:1, active:true}] });
  // [id, nama, keterangan, harga Regular, kategori, ikon, warna]
  const ROWS = [
    ["salted",   "Salted Caramel",             "Espresso, susu & karamel masin",      6, "Kopi", "cup", "#A0673F"],
    ["spanish",  "Spanish Latte",              "Espresso dengan susu pekat manis",    5, "Kopi", "cup", "#B98A62"],
    ["mocha",    "Mocha",                      "Espresso, coklat & susu",             6, "Kopi", "cup", "#7A4A30"],
    ["aren",     "Gula Aren",                  "Latte dengan gula aren asli",         6, "Kopi", "cup", "#94603C"],
    ["latte",    "Ice Latte",                  "Espresso dengan susu segar",          5, "Kopi", "cup", "#B48E6E"],
    ["machiato", "Caramel Machiato",           "Susu, espresso & sirap karamel",      6, "Kopi", "cup", "#9C6640"],
    ["toffee",   "Caramel Toffee Nut",         "Latte karamel dengan toffee nut",     6, "Kopi", "cup", "#A68A5C"],
    ["vanilla",  "Ice Vanilla Latte",          "Latte dengan sirap vanila",           6, "Kopi", "cup", "#C29A7E"],
    ["coffee",   "Ice Coffee Latte",           "Kopi susu ais klasik",                5, "Kopi", "cup", "#8E5634"],
    ["butter",   "Spanish Buttercream Latte",  "Spanish latte dengan buttercream",    6, "Kopi", "cup", "#C39A62"],
    ["oreo",     "Oreo Choco",                 "Coklat susu dengan Oreo",             6, "Chocolate", "cup", "#5B3F4A"],
    ["hazel",    "Hazelnut Chocolate",         "Coklat dengan sirap hazelnut",        6, "Chocolate", "cup", "#8A5A3A"],
    ["choco",    "Ice Chocolate",              "Coklat susu ais",                     5, "Chocolate", "cup", "#7A4E36"],
    ["chbutter", "Chocolate Buttercream",      "Coklat dengan buttercream",           6, "Chocolate", "cup", "#6E5446"],
    ["indulge",  "Chocolate Indulgence",       "Coklat pekat berganda",               6, "Chocolate", "cup", "#5A3530"],
    ["apple",    "Apple Milk",                 "Susu perisa epal hijau",              4, "Milky", "cup", "#7FB98A"],
    ["strawm",   "Strawberry Milk",            "Susu perisa strawberi",               4, "Milky", "cup", "#D9506A"],
    ["mango",    "Mango Milk",                 "Susu perisa mangga",                  4, "Milky", "cup", "#D8B23E"],
    ["strawl",   "Strawberry Latte",           "Latte dengan strawberi",              6, "Strawberry", "cup", "#D86C8C"],
    ["strawc",   "Strawberry Choco",           "Coklat dengan strawberi",             6, "Strawberry", "cup", "#A0405E"],
    ["bluel",    "Blueberry Latte",            "Latte dengan blueberi",               6, "Blueberry", "cup", "#8A74C2"],
    ["bluec",    "Blueberry Chocolate",        "Coklat dengan blueberi",              6, "Blueberry", "cup", "#6A5470"],
    ["thai",     "Thai Tea",                   "Teh Thai susu ais",                   4, "Tea", "cup", "#D88A44"],
    ["green",    "Green Tea",                  "Teh hijau susu ais",                  4, "Tea", "leaf", "#6E9E52"],
  ];
  window.RUMANGOPI_MENU = ROWS.map(([id,name,desc,price,cat,icon,color]) => ({
    id, name, desc, price, cat, icon, color, active:true,
    groups: [size(), addon(cat==="Kopi")],
  }));
})();
