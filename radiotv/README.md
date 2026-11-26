# TVRadioID

**dari apahudi untuk negeri**

Website streaming **radio dan TV live** Indonesia + kanal internasional populer. HTML/CSS/JS murni, tanpa build step, siap di-deploy ke GitHub Pages, Netlify, Vercel, atau hosting statis lain.

## Struktur halaman

| Halaman | Isi |
| --- | --- |
| `radio.html` | Daftar stasiun radio (293 stasiun) |
| `tv.html` | Daftar channel TV (4.218 kanal) |
| `index.html` | Alihkan otomatis ke `radio.html` |

Kedua halaman memakai `style.css`, `script.js`, dan data dari `stations-data.js` (bawaan) / `stations.json` (untuk refresh). Header: **TVRadioID** + slogan, navigasi Radio/TV/Provinsi, tombol donasi DANA.

Footer di kedua halaman: `RadioTV v.1.0 | dibuat oleh ApahUdi | 2026`.

Tampilan awal: **grid** dan **Sembunyikan offline aktif**; kedua pilihan tersimpan di browser.

## Fitur utama

- **Radio & TV terpisah**: halaman sendiri, data difilter berdasarkan tipe.
- **TV fullscreen**: klik kanal TV langsung putar di overlay fullscreen; tombol Back/Esc/remote menutup player.
- **Navigasi remote/D-pad**: baris TV bisa difokus, Enter/OK memutar, `f` toggle favorit, fokus otomatis scroll ke layar.
- **Urutkan TV**: Nama / Lokasi / Kategori (tersimpan di browser).
- **Cache video TV**: toggle ON/OFF; saat ON, playlist dan segmen awal HLS disimpan di Cache Storage sebelum diputar untuk jaringan kurang stabil.
- **Alternatif stream otomatis**: saat stream utama gagal/geo-blocked/CORS/stalled, aplikasi mencoba URL alternatif dari playlist eksternal dan kandidat yang terpasang ke kanal.
- **Buffer HLS dioptimalkan**: buffer lebih besar, retry/timeout lebih tahan gangguan, `lowLatencyMode` off untuk stabilitas.
- **Status offline**: pengecekan build-time + deteksi gagal putar lokal (disimpan 6 jam di browser). Kanal offline disembunyikan saat opsi aktif.
- **Refresh tanpa reload**: tombol Refresh memperbarui data di tempat; auto-refresh setiap 6 jam.
- **Filter provinsi/kategori**: chip provinsi dan tab kategori.
- **Donasi**: ikon hati membuka modal DANA (Moh Agus Budiman, 085323073037).

## Isi katalog

| Jenis | Jumlah | Sumber utama |
| --- | ---: | --- |
| TV | 4.218 kanal | TVRI & RRI (resmi), iptv-org, IPTV Cat, publik, CODECS.COM (internasional populer) |
| Radio | 293 stasiun | RRI (resmi), IPTV Cat Radio Indonesia |

### Kategori TV

`Nasional, Regional, Religi, Olahraga, Film, Komedi, Hiburan, Anak, Musik, Dokumenter, Berita`

Kanal internasional CODECS.COM ditandai `province: "Internasional"`, `source: "CODECS.COM"`, `status: "unknown"` sampai diverifikasi/diputar.

## Sumber playlist

- Data utama: `stations.json` / `stations-data.js`
- Alternatif stream runtime: `https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8`, `https://m3u8-player.net/id/free-indonesia-iptv-playlist/`
- Import batch CODECS.COM (file lokal): `popular-movies`, `popular-comedy`, `popular-general/entertainment`, `popular-kids`, `popular-music`, `popular-documentary`, `popular-news`, `popular-sports`

## Aplikasi Android (TVRadioID)

Proyek Android ada di `android/`. Aplikasi adalah WebView yang memuat aset `android/app/src/main/assets/www` dari `https://appassets.local/`.

- **Package**: `com.apahudi.tvradio`
- **Version**: `1.2` (`versionCode 3`)
- **Output APK**: `android/TVRadioID-1.2.apk`

### Build APK

```bash
cd android
bash build.sh
```

Persyaratan: Android SDK platform 35, build-tools 35.0.0, JDK 21. Keystore sideload: `android/tvradio.keystore` (alias `tvradio`, password `tvradio`).

### Install ke Android TV / device ADB

```bash
adb connect <IP-TV>:5555
adb install -r android/TVRadioID-1.2.apk
```

## Perbarui / cek status stream

```bash
python3 update_streams.py
```

Script ini mengecek stream dan memperbarui `stations.json` + `stations-data.js`. Status: `online`, `offline`, `unknown` (timeout/geo-block/ditolak).

## Format data stasiun

`stations.json` berisi array objek:

```json
{
  "id": "unik",
  "type": "tv|radio",
  "name": "Nama Kanal",
  "city": "Kota",
  "province": "Provinsi/Internasional",
  "category": "nasional|regional|...|berita",
  "stream": "https://contoh.com/stream.m3u8",
  "desc": "Deskripsi",
  "logo": "https://...png",
  "source": "Sumber",
  "status": "online|offline|unknown",
  "checkedAt": "ISO-8601",
  "httpCode": 200
}
```

### Menambah stasiun manual

1. Tambah objek ke `stations.json`.
2. Jalankan `python3 update_streams.py --no-html` atau perbarui `stations-data.js` sesuai kebutuhan.
3. Jika menambah kategori/filter TV baru, perbarui `TV_FILTERS` di `make_pages.py` lalu jalankan `python3 make_pages.py`.
4. Sinkronkan aset ke `android/app/src/main/assets/www` dan rebuild APK bila perlu.

## Catatan

- Banyak channel internasional bisa **geo-blocked**, butuh hak akses, atau berubah sewaktu-waktu. Aplikasi menandai gagal putar sebagai offline lokal dan mencoba alternatif bila ada.
- Gunakan hanya stream yang kamu miliki hak distribusi/aksesnya.
- `stations-data.js` harus tetap sinkron dengan `stations.json` untuk mode bawaan/offline-first.

Lisensi: konten kode proyek ini dapat digunakan/dikembangkan sesuai kebutuhan pemilik repo; hak siar stream tetap milik masing-masing penyedia.