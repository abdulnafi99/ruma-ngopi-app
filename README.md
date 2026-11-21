# RumaNgopi Rewards — Loyalty & Order PWA

Kad loyalti digital (cap + point + ganjaran) dalam gaya **Bento Glass Frost**, tema **coklat kopi & mocha RumaNgopi** (ikut warna logo: `#5C3E33` coklat, `#D5C2BC` mocha).
Ditulis sepenuhnya dalam **HTML, CSS dan JavaScript vanilla**, dalam satu fail `index.html`. Tiada framework dan tiada langkah build.

## Ciri-ciri
- **Splash screen beranimasi**: perkataan **rumaNgopi** keluar huruf demi huruf, cawan kopi dilukis garisan demi garisan (wap, pemegang hati), kemudian **loading bar** dengan peratus di bawah.
- **5 skrin**: Home · **Order** · Cap & Point · Ganjaran · Profil, dengan bottom nav berbentuk pil.
- **Tab Order**: dua bahagian, **Menu** (pilih item + add-on + troli) dan **Pesanan saya** (pesanan aktif dengan status langsung + sejarah). Titik pada ikon Order bila ada pesanan aktif.
- **Kod QR ahli yang boleh diimbas betul-betul**, dijana dalam JS tanpa library (format: `RUMANGOPI:<memberId>`).
- **Kad cap 10 petak**: bila penuh, petak hadiah boleh ditekan untuk tebus minuman percuma.
- **Tebus ganjaran**: point ditolak, keluar kod baucar 6 aksara dengan pemasa 10 minit, dan animasi konfeti.
- **Tahap ahli** (Silver / Gold / Platinum) ikut jumlah point terkumpul.
- **PWA**: boleh dipasang ke skrin utama (Android & iOS) dan dibuka luar talian melalui service worker.
- **Mod demo**: butang "Simulasi pembelian" dan "Set semula data". Data disimpan dalam `localStorage`.

## Menu, add-on & troli
- **App pelanggan → Order → Menu**: kategori, produk, add-on dan troli. Setiap item dalam pesanan beri **1 cap** dan point ikut tetapan.
- **Add-on "pilih banyak + kuantiti"**: setiap pilihan ada **had kuantiti per item** (contohnya Whip cream maks 1, Extra shot maks 2), dan kumpulan boleh ada had jumlah. Bila had dicapai, pelanggan diberitahu untuk tambah item yang sama ke troli sekali lagi.
- **Add-on "pilih satu"**: radio, boleh jadi wajib (contohnya Saiz Regular / Large +RM1).
- **Admin → Menu & add-on**: tambah atau edit produk, kumpulan add-on, harga tambahan, had kuantiti, dan aktif/sembunyi.
- **Admin → Pesanan**: pesanan masuk secara langsung, dengan status Baru → Disediakan → Siap diambil → Selesai. Pelanggan dapat notis bila pesanan siap.
- **Menu asal setiap kedai ada dalam `menu.js`.** Itu satu-satunya tempat untuk ubah menu bila sediakan kedai baru.

## Pickup sahaja: alamat, DuitNow QR & waktu pickup
- **Admin → Tetapan**: alamat pickup + link Google Maps, dan muat naik **QR DuitNow** (gambar dikecilkan automatik) dengan nama penerima.
- **Admin → Waktu pickup**: waktu buka/tutup setiap hari, selang slot (10–60 minit), masa sediakan minimum, dan suis **Tutup sementara**. Ada pratonton slot hari ini.
- **App pelanggan**: tab Order tunjuk alamat & status buka/tutup. Dalam troli, pelanggan pilih **masa pickup** (secepat mungkin atau slot hari ini) dan **bayaran** (bayar di kaunter atau DuitNow QR). Bila kedai tutup, butang pesan dimatikan. Resit pesanan tunjuk QR DuitNow untuk dibayar.
- Tiada delivery. Semua data kedai ada dalam `shop.js` (localStorage `rumangopi-shop-v1`).

## Admin dashboard (`admin.html`, demo)
Buka `/admin` atau `admin.html` dan masukkan PIN demo **1234**.
- **Ringkasan**: KPI (ahli, pembelian hari ini, point dikeluarkan, tebusan), carta pembelian 14 hari, ganjaran popular, aktiviti terkini dan ahli teratas.
- **Kaunter**: imbas QR pelanggan dengan kamera (BarcodeDetector, atau jsQR sebagai fallback) atau taip ID ahli. Kemudian rekod pembelian (+cap, +point), tebus kad cap penuh, tebus ganjaran, dan sahkan kod baucar.
- **Ahli**: cari, tapis ikut tahap, susun. Lihat butiran dan sejarah, laraskan point, eksport CSV.
- **Ganjaran**: tambah, edit, padam, aktif/sembunyi, dan pilih ganjaran utama. Perubahan terus muncul dalam app pelanggan.
- **Tetapan**: bilangan cap untuk minuman percuma dan point setiap minuman.

**Segerak demo:** admin dan app pelanggan berkongsi `localStorage` dalam pelayar yang sama. Buka `index.html` dan `admin.html` dalam dua tab sebelah-menyebelah. Cap yang ditambah di kaunter terus muncul dalam app pelanggan, dan baucar yang disahkan staf terus bertukar jadi "✓ Telah ditebus di kaunter". Ahli lain dalam dashboard adalah data contoh. Untuk segerak antara peranti, sambung ke Firebase.

## Struktur
```
index.html             ← app pelanggan: SEMUA UI, CSS & JS (logo dibenam base64)
admin.html             ← dashboard admin & kaunter staf (satu fail, demo)
menu.js                ← menu asal kedai (produk & add-on), dikongsi kedua-dua halaman
shop.js                ← alamat, DuitNow QR & waktu pickup (logik slot), dikongsi kedua-dua halaman
firebase-config.js     ← config Firebase + lapisan segerak localStorage ↔ Firebase
firebase-sync.js       ← sambungan Realtime Database, Auth & Analytics
database.rules.json    ← rules keselamatan Realtime Database (salin ke console)
vercel.json            ← laluan /admin
manifest.webmanifest   ← maklumat PWA (nama, warna, ikon)
sw.js                  ← service worker (cache luar talian)
icons/                 ← ikon app, logo-circle.png & cup-mark.png (dari logo RumaNgopi)
```

## Jalankan
Service worker hanya berfungsi melalui `http://localhost` atau `https://`:
```bash
python3 -m http.server 8080
# buka http://localhost:8080
```
Untuk deploy, muat naik folder ini ke mana-mana hosting statik (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## Jadikan untuk kedai lain (template)
1. **Warna**: ubah pemboleh ubah `:root` di bahagian atas `<style>` (`--brand`, `--brand-2`, `--brand-deep`, `--blob-*`).
2. **Menu**: ubah `menu.js` (produk, harga, add-on, had kuantiti).
3. **Data & ganjaran**: ubah objek `CONFIG` di bahagian atas `<script>`, termasuk nama brand, sasaran cap, senarai ganjaran, tahap ahli dan pengguna demo.
3. **Logo**: ganti `data:image/png;base64,...` pada `<img class="wm">` (header Home & login admin) dengan tanda putih (PNG lutsinar) anda, dan ganti fail dalam `icons/`.
   - Splash: teks dalam `.sp-word` dan cawan SVG dalam `.sp-cup`. Tempoh loading bar = `DUR` dalam fungsi `splashLoader()`.
4. **Manifest**: kemas kini `name`, `short_name` dan `theme_color` dalam `manifest.webmanifest`.
5. Naikkan `VERSION` dalam `sw.js` setiap kali anda deploy versi baru.

## Firebase Realtime Database (mod live)
App disambung ke projek Firebase **rumangopi-app** (`firebase-config.js`). Semua peranti berkongsi data secara langsung:

| Path | Isi | Siapa tulis |
|---|---|---|
| `store/menu`, `store/rewards`, `store/settings`, `store/shop` | menu, ganjaran, tetapan cap/point, alamat, QR DuitNow, waktu pickup | admin |
| `users/{uid}` | akaun pelanggan → `memberId`, no telefon, nama | pelanggan (sendiri) |
| `members/{memberId}` | kad ahli (nama, telefon, point, cap, sejarah, `ownerUid`) | pemilik kad & kaunter |
| `orders/{no}` | pesanan pickup | pelanggan (cipta), admin (status) |
| `vouchers/{code}` | baucar ganjaran | pelanggan (cipta), admin (sahkan) |
| `counters/orderNo` | nombor pesanan seterusnya (A101, A102…) | automatik |
| `admins/{uid}` | `true` untuk akaun yang boleh ubah `store/*` | anda, di console |

**Cara ia berfungsi:** app masih guna `localStorage`. `firebase-config.js` memintas tulisan pada kunci yang dikongsi dan hantar ke Firebase (`firebase-sync.js`). Data dari Firebase ditulis semula ke `localStorage` dan app dimaklumkan melalui event `storage`.

**Log masuk pelanggan (no telefon + kata laluan):**
- Selepas splash, pelanggan **Log masuk** atau **Daftar** (nama, no telefon, kata laluan minimum 6 aksara).
- Di Firebase Auth ia disimpan sebagai **Email/Password** dengan emel `60xxxxxxxxx@rumangopi.app` (no telefon dinormalkan: `012-345 6789`, `+60123456789` → `60123456789`).
- Kad ahli terikat pada akaun: log masuk di telefon lain = kad, point & pesanan yang sama. Kad lama dalam telefon (sebelum ada akaun) disimpan ke akaun semasa daftar.
- Kaunter admin boleh cari ahli guna **no telefon** atau ID ahli.
- Lupa kata laluan: belum ada reset sendiri (emel `@rumangopi.app` bukan emel sebenar). Pemilik boleh padam akaun di Firebase Console → Authentication supaya pelanggan daftar semula.

**Mod live berbanding demo:**
- Butang demo (simulasi pembelian, set semula) disembunyikan.
- Admin log masuk dengan **emel & kata laluan Firebase** (bukan PIN).
- Tiada sambungan internet: pelanggan masih boleh lihat kad & menu, tetapi tidak boleh buat pesanan.
- Untuk kembali ke mod demo, buang `<script src="firebase-config.js">` dari `index.html` dan `admin.html`.

### Setup di Firebase Console (sekali sahaja)
1. **Authentication → Sign-in method**: hidupkan **Email/Password** (Anonymous tidak diperlukan lagi).
2. **Authentication → Users → Add user**: cipta akaun admin (emel + kata laluan).
3. **Realtime Database → Rules**: salin isi `database.rules.json`, kemudian **Publish** (ulang setiap kali fail ini berubah).
4. UID admin utama (`cqFIzYAssCX2HIcbdHFMyvbF0q33`) sudah ditulis terus dalam `database.rules.json`. Untuk admin tambahan, di **Realtime Database → Data** tambah `admins` → `<UID>` = `true`.
5. **Authentication → Settings → Authorized domains**: pastikan domain Vercel (`ruma-ngopi-app.vercel.app`) ada.

> Nota keselamatan: point & cap dikira dalam app (bukan server), jadi pelanggan yang mahir teknikal boleh ubah kad sendiri. Untuk perlindungan penuh, pindahkan pengiraan point ke Cloud Functions.

## Sambung ke backend
Template ini menyimpan data secara tempatan sahaja. Untuk produksi, gantikan fungsi `load()`, `save()`, `doRedeem()` dan `demoBuy()` dengan panggilan API ke backend anda (contohnya Firebase atau Supabase), dan buang bahagian "mod demo" di skrin Profil.
