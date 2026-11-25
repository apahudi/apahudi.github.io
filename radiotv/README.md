# TVRadio Indonesia

Website streaming **radio dan TV live** dari seluruh Indonesia. HTML/CSS/JS murni, tanpa build step, siap di-deploy ke GitHub Pages, Netlify, Vercel, atau hosting statis lain.

## Isi katalog

| Jenis | Jumlah | Sumber |
| --- | --- | --- |
| TV | 233 kanal | TVRI & RRI (resmi), IPTV Cat, iptv-org, serta beberapa kanal publik tambahan |
| Radio | 293 stasiun | RRI (resmi) dan [IPTV Cat Radio Indonesia](https://iptvcat.net/radio/indonesia) |

Kanal yang diminta sudah termasuk: **SCTV, Kompas TV, tvOne, Bali TV, Bandung TV, Jogja TV, Jak TV, STARA TV, Mentari TV**, serta **HBO Asia, HBO Hits Asia, HBO Signature Asia, Cinemax Asia**.

## Fitur

- Tampilan **daftar ringkas**: logo + nama channel + asal daerah, dua kolom di desktop, satu kolom di ponsel.
- Pemutar radio mengambang (audio bawaan browser) dengan kontrol volume dan favorit.
- Pemutar TV dalam modal video (HLS via hls.js dari CDN).
- Pencarian nama/daerah, filter TV (Semua / Nasional / Regional / Religi / Olahraga / Film), filter radio per wilayah (Jabodetabek, Jawa, Sumatera, Kalimantan, Sulawesi, Bali & Nusa, Maluku, Papua, Indonesia).
- Chip provinsi untuk memfilter sekaligus radio dan TV.
- Favorit disimpan di `localStorage` browser.
- Responsif dan berbahasa Indonesia.

## Menjalankan secara lokal

```bash
python3 -m http.server 8000
# Buka http://localhost:8000
```

Buka `index.html` langsung juga bisa, tetapi beberapa stream HLS/audio lebih stabil lewat `http://localhost`.

## Menambahkan stasiun / channel

Edit blok JSON di `index.html`:

```html
<script type="application/json" id="stations-data">
  [
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
  ]
</script>
```

- `id` harus unik. `type`: `radio` atau `tv`.
- `category` radio: `jabodetabek`, `jawa`, `sumatera`, `kalimantan`, `sulawesi`, `bali-nusa`, `maluku`, `papua`, `nasional`.
- `category` TV: `nasional`, `regional`, `religi`, `olahraga`, `film`.
- `region`: `jabodetabek`, `jawa`, `sumatera`, `kalimantan`, `sulawesi`, `bali-nusa`, `maluku`, `papua`, `nasional`.
- `logo` boleh kosong; ikon bawaan yang akan ditampilkan.
- `stream`: URL langsung (`.mp3`, `.m3u8`, dll.).

### Menambahkan kanal dari IPTV Cat

Tautan `list.iptvcat.net/my_list/s/...m3u8` bukan stream akhir. Buka tautan tersebut, lalu salin baris URL pertama di dalamnya sebagai nilai `stream`. Pastikan hasilnya benar-benar `http://` atau `https://`, bukan halaman HTML error.

## Deploy ke GitHub Pages

1. Buat repositori, misalnya `tvradio`, lalu unggah `index.html`, `style.css`, `script.js`, dan `README.md`.
2. Buka **Settings → Pages**.
3. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.

## Catatan penting

- Situs ini **tidak menyimpan atau meng-host** konten streaming; semua URL berasal dari sumber publik/resmi.
- Banyak kanal bersifat **geo-blocked** (hanya bisa diputar dari dalam negeri), **http-only** (diblokir saat situs dibuka lewat HTTPS / mixed content), atau memerlukan header `Access-Control-Allow-Origin` agar hls.js bisa memutar di Chrome/Firefox. Kanal yang gagal diputar dari luar Indonesia belum tentu rusak—coba dari jaringan Indonesia.
- Kanal **HBO / HITS / Cinemax / Mentari TV** adalah siaran berlangganan: URL publiknya tidak stabil dan sering berganti, jadi pemutaran tidak dijamin.
- Daftar stream dapat berubah kapan saja. Jika ada kanal yang mati, perbarui URL `stream`-nya di `index.html`.
- Jika Anda pemilik hak cipta dan ingin stream dihapus, hubungi pengelola situs.

## Lisensi

Situs ini disediakan sebagai template open source dan bebas dikembangkan untuk kebutuhan streaming radio & TV Indonesia.
