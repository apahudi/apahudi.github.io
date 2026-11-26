# TVRadio Indonesia

Website streaming **radio dan TV live** dari seluruh Indonesia. HTML/CSS/JS murni, tanpa build step, siap di-deploy ke GitHub Pages, Netlify, Vercel, atau hosting statis lain.

## Struktur halaman

| Halaman | Isi |
| --- | --- |
| `radio.html` | Daftar stasiun radio (293 stasiun) |
| `tv.html` | Daftar channel TV (233 kanal) |
| `index.html` | Alihkan otomatis ke `radio.html` |

Kedua halaman memakai `style.css`, `script.js`, dan data dari `stations-data.js` (bawaan) / `stations.json` (untuk refresh). Tombol **Radio** dan **TV** di header menghubungkan kedua halaman.

Footer di kedua halaman: `RadioTV v.1.0 | dibuat oleh ApahUdi | 2026`.

Tampilan awal: **grid** dan **Sembunyikan offline aktif**; kedua pilihan tersimpan di browser.

## Isi katalog

| Jenis | Jumlah | Sumber |
| --- | --- | --- |
| TV | 233 kanal | TVRI & RRI (resmi), IPTV Cat, iptv-org, serta beberapa kanal publik tambahan |
| Radio | 293 stasiun | RRI (resmi) dan [IPTV Cat Radio Indonesia](https://iptvcat.net/radio/indonesia) |

Kanal yang diminta sudah termasuk: **SCTV, Kompas TV, tvOne, Bali TV, Bandung TV, Jogja TV, Jak TV, STARA TV, Mentari TV**, serta **HBO Asia, HBO Hits Asia, HBO Signature Asia, Cinemax Asia**.

## Fitur

- **Halaman terpisah**: radio di `radio.html`, TV di `tv.html`; `index.html` mengarahkan ke halaman radio.
- **Default grid + sembunyikan offline**: halaman langsung tampil sebagai grid tanpa kanal mati. Pilihan tersimpan di `localStorage` (`tvradio_view`, `tvradio_hide_offline`).
- Tampilan **daftar ringkas** atau **grid kartu**, bisa diganti dengan tombol **▦ Grid / ☰ Daftar**. Grid responsif hingga 6 kolom di desktop dan 2 kolom di ponsel.
- Mobile friendly: tab bisa digeser, tombol sentuh ≥38 px, dan menu off-canvas tanpa overflow horizontal.
- **Refresh tanpa reload halaman**: status kanal diperbarui di tempat dan posisi scroll tetap terjaga.
- **Status kanal**: titik hijau = stream merespons saat pengecekan terakhir, badge merah **Off** = offline. Kanal yang gagal diputar di browser juga otomatis ditandai offline.
- **Tombol Perbarui** untuk memuat ulang `stations.json`, plus **refresh otomatis setiap 6 jam** (dan saat tab dibuka kembali setelah lewat 6 jam).
- Checkbox **Sembunyikan offline** untuk menyaring kanal yang mati.
- Pemutar radio mengambang (audio bawaan browser) dengan kontrol volume dan favorit.
- Pemutar TV dalam modal video (HLS via `hls.min.js` yang dibundel lokal, tidak bergantung CDN).
- Filter TV (Semua / Nasional / Regional / Religi / Olahraga / Film), filter radio per wilayah (Jabodetabek, Jawa, Sumatera, Kalimantan, Sulawesi, Bali & Nusa, Maluku, Papua, Indonesia), serta chip provinsi yang bisa diklik lagi untuk menghapus filter.
- Favorit disimpan di `localStorage` browser.
- Tidak ada kotak pencarian, judul halaman, bar status, atau bagian "Tentang" — daftar langsung tampil.
- Responsif dan berbahasa Indonesia.

## Refresh & status offline

Daftar kanal dimuat dari `stations-data.js` (sinkron, langsung tampil), lalu diperbarui lewat `fetch` dari `stations.json`.

- **Manual:** tombol **🔄 Perbarui** di halaman. Tidak memuat ulang halaman: data diambil lewat `fetch`, status diperbarui di tempat, dan posisi scroll dipertahankan.
- **Otomatis di browser:** setiap 6 jam situs mengambil ulang `stations.json` (cache-busting), dan mengecek ulang saat tab kembali aktif bila sudah lewat 6 jam.
- **Otomatis di server (opsional):** jalankan `update_streams.py` secara berkala, atau aktifkan workflow `.github/workflows/update-streams.yml` yang berjalan tiap 6 jam di GitHub Actions dan meng-commit `stations.json` terbaru.

```bash
python3 update_streams.py            # cek semua stream, tulis stations.json + stations-data.js
python3 update_streams.py --no-html  # hanya stations.json (dipakai workflow)
python3 make_pages.py                # bangun ulang radio.html & tv.html dari templat
```

Klasifikasi status:

| Status | Arti |
| --- | --- |
| `online` | Stream merespons HTTP 2xx/3xx saat pengecekan |
| `offline` | Stream merespons HTTP 4xx/5xx (mis. 404) — ditandai **Off** |
| `unknown` | Timeout atau ditolak (400/401/403/429) — bisa geo-blocked, belum tentu mati |

Stream yang gagal diputar di browser (bisa karena geo-block/CORS/mixed content) ditandai offline secara lokal selama 6 jam, lalu dicek ulang otomatis. Status tersimpan di `localStorage`.

## Menjalankan secara lokal

```bash
python3 -m http.server 8000
# Buka http://localhost:8000/radio.html atau /tv.html
```

Buka lewat server lokal, bukan `file://`, karena refresh memakai `fetch` dan sebagian stream HLS/audio lebih stabil lewat `http://localhost`.

## Aplikasi Android (APK)

APK siap pasang ada di **`android/RadioTV-1.0.apk`** — untuk handphone maupun Android TV / smart TV berbasis Android.

- **Minimal Android 5.0 (API 21)**, target Android 15 (API 35).
- Semua halaman, CSS, JS, `hls.min.js`, dan data stasiun dibundel di dalam APK, jadi aplikasi tetap terbuka tanpa server. Stream tetap butuh internet.
- Aplikasi memuat aset lewat origin `https://appassets.local/` yang dilayani dari `assets/www`, sehingga `fetch()`, `localStorage`, dan hls.js bekerja normal.
- Remote TV didukung: tombol arah memindahkan fokus ke kartu kanal, Enter untuk memutar, Back untuk menutup pemutar.
- Banner Android TV dan ikon launcher sudah disertakan.

Pasang lewat sideload:

```bash
adb install -r android/RadioTV-1.0.apk
# atau salin APK ke HP/TV lalu buka file-nya (izinkan "Install unknown apps")
```

Bangun ulang setelah mengubah situs:

```bash
cd android && ./build.sh
```

Skrip membutuhkan Android SDK (platform 35 dan build-tools 35.0.0, otomatis mencari `$ANDROID_HOME` atau `~/Android/Sdk`) serta JDK. Tidak perlu Gradle. Saat build, isi situs disalin ulang ke `android/assets/www`.

APK ditandatangani dengan `android/tvradio.keystore` (kata sandi `tvradio`) yang hanya untuk pemasangan sendiri. Untuk Google Play, buat keystore baru dan simpan rahasia.

## Menambahkan stasiun / channel

Tambahkan entri ke `stations.json` (sumber untuk tombol Perbarui). `stations-data.js` adalah data bawaan yang dimuat saat halaman pertama dibuka:

```js
/* stations-data.js */
window.STATIONS_DATA = [
  {
    "id": "contoh_radio",
    "type": "radio",
    "name": "Nama Stasiun",
    "city": "Bandung",
    "province": "Jawa Barat",
    "category": "jawa",
    "stream": "https://contoh.com/stream.mp3",
    "desc": "Deskripsi singkat stasiun.",
    "logo": "https://contoh.com/logo.png",
    "source": "Resmi"
  },
  {
    "id": "contoh_tv",
    "type": "tv",
    "name": "Nama TV",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "category": "nasional",
    "stream": "https://contoh.com/stream.m3u8",
    "desc": "Deskripsi singkat channel TV.",
    "logo": "https://contoh.com/logo.png",
    "source": "Publik"
  }
];
```

Cara termudah: tambahkan ke `stations.json`, lalu jalankan `python3 update_streams.py` agar `stations-data.js` ikut diperbarui.

- `id` harus unik. `type`: `radio` atau `tv`.
- `category` radio: `jabodetabek`, `jawa`, `sumatera`, `kalimantan`, `sulawesi`, `bali-nusa`, `maluku`, `papua`, `nasional`.
- `category` TV: `nasional`, `regional`, `religi`, `olahraga`, `film`.
- `region`: `jabodetabek`, `jawa`, `sumatera`, `kalimantan`, `sulawesi`, `bali-nusa`, `maluku`, `papua`, `nasional`.
- `logo` boleh kosong; ikon bawaan yang akan ditampilkan.
- `stream`: URL langsung (`.mp3`, `.m3u8`, dll.).

### Menambahkan kanal dari IPTV Cat

Tautan `list.iptvcat.net/my_list/s/...m3u8` bukan stream akhir. Buka tautan tersebut, lalu salin baris URL pertama di dalamnya sebagai nilai `stream`. Pastikan hasilnya benar-benar `http://` atau `https://`, bukan halaman HTML error.

## Deploy ke GitHub Pages

1. Buat repositori, misalnya `tvradio`, lalu unggah `index.html`, `radio.html`, `tv.html`, `style.css`, `script.js`, `hls.min.js`, `stations-data.js`, `stations.json`, `README.md`, serta `.github/workflows/update-streams.yml` (opsional). Folder `android/` tidak wajib di-upload kecuali ingin menyimpan sumber APK.
2. Buka **Settings → Pages**.
3. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.

## Catatan penting

- Situs ini **tidak menyimpan atau meng-host** konten streaming; semua URL berasal dari sumber publik/resmi.
- Banyak kanal bersifat **geo-blocked** (hanya bisa diputar dari dalam negeri), **http-only** (diblokir saat situs dibuka lewat HTTPS / mixed content), atau memerlukan header `Access-Control-Allow-Origin` agar hls.js bisa memutar di Chrome/Firefox. Kanal yang gagal diputar dari luar Indonesia belum tentu rusak—coba dari jaringan Indonesia.
- Kanal **HBO / HITS / Cinemax / Mentari TV** adalah siaran berlangganan: URL publiknya tidak stabil dan sering berganti, jadi pemutaran tidak dijamin.
- Daftar stream dapat berubah kapan saja. Jika ada kanal yang mati, perbarui URL `stream`-nya di `stations.json` lalu jalankan `python3 update_streams.py`.
- Contoh kanal yang saat pengecekan terakhir berstatus offline: **Jogja TV** (HTTP 404). Ia tetap bisa diputar manual bila URL diperbaiki; aktifkan checkbox **Sembunyikan offline** untuk menyembunyikannya.
- Jika Anda pemilik hak cipta dan ingin stream dihapus, hubungi pengelola situs.

## Lisensi

Situs ini disediakan sebagai template open source dan bebas dikembangkan untuk kebutuhan streaming radio & TV Indonesia.
