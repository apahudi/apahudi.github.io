from pathlib import Path

ROOT = Path(__file__).resolve().parent

RADIO_FILTERS = [
    ("all", "Semua"), ("jabodetabek", "Jabodetabek"), ("jawa", "Jawa"),
    ("sumatera", "Sumatera"), ("kalimantan", "Kalimantan"),
    ("sulawesi", "Sulawesi"), ("bali-nusa", "Bali & Nusa"),
    ("maluku", "Maluku"), ("papua", "Papua"), ("nasional", "Indonesia"),
]
TV_FILTERS = [
    ("all", "Semua"), ("nasional", "Nasional"), ("regional", "Regional"),
    ("religi", "Religi"), ("olahraga", "Olahraga"), ("film", "Film"),
    ("komedi", "Komedi"), ("hiburan", "Hiburan"), ("anak", "Anak"),
    ("musik", "Musik"), ("dokumenter", "Dokumenter"), ("berita", "Berita"),
]

TV_CONTROLS = '''        <div class="sort-group" id="sort-group" role="group" aria-label="Urutkan kanal">
          <span class="sort-label">Urut:</span>
          <button type="button" class="sort-btn active" data-sort="name" aria-pressed="true">Nama</button>
          <button type="button" class="sort-btn" data-sort="location" aria-pressed="false">Lokasi</button>
          <button type="button" class="sort-btn" data-sort="category" aria-pressed="false">Kategori</button>
        </div>
        <label class="cache-toggle" title="Simpan sebagian video ke perangkat sebelum diputar (khusus stream HLS)">
          <input type="checkbox" id="cache-video" /> Cache video
        </label>'''

TEMPLATE = '''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>{title} | TVRadioID</title>
  <meta name="description" content="{description}" />
  <meta name="theme-color" content="#0f172a" />
  <link rel="stylesheet" href="style.css?v=17" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body data-page="{page}">
  <header class="header">
    <div class="container nav">
      <a href="radio.html" class="brand" aria-label="TVRadioID — dari apahudi untuk negeri">
        <span class="logo">TV<span>Radio</span>ID</span>
        <span class="tagline">dari apahudi untuk negeri</span>
      </a>
      <div class="nav-right">
        <button type="button" class="donate-btn" id="donate-btn" aria-label="Donasi via DANA" title="Donasi via DANA">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.6-4.8-9.5-9.1A5.7 5.7 0 0 1 12 5.5a5.7 5.7 0 0 1 9.5 6.4C19.6 16.2 12 21 12 21z"/></svg>
        </button>
        <button class="nav-toggle" aria-label="Buka menu" aria-expanded="false">
          <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>
        <nav class="nav-menu" id="nav-menu">
          <button type="button" class="nav-close" aria-label="Tutup menu">✕</button>
          <ul role="menubar">
            <li role="none"><a href="radio.html" role="menuitem"{radio_active}>Radio</a></li>
            <li role="none"><a href="tv.html" role="menuitem"{tv_active}>TV</a></li>
            <li role="none"><a href="{self}#provinsi" role="menuitem">Provinsi</a></li>
          </ul>
        </nav>
      </div>
    </div>
  </header>

  <section id="utama" class="section section-cards">
    <div class="container">
      <div class="toolbar">
        <button type="button" class="refresh-btn" id="refresh-btn" title="Muat ulang daftar dari stations.json">🔄 Perbarui</button>
        <button type="button" class="view-toggle" id="view-toggle" aria-pressed="true" title="Ubah ke tampilan daftar">☰ Daftar</button>
        <label class="hide-toggle"><input type="checkbox" id="hide-offline" checked /> Sembunyikan offline</label>
{tv_controls}
        <span class="count" id="station-count" aria-live="polite"></span>
      </div>
      <div class="category-tabs" id="filter-tabs" role="tablist" aria-label="Filter">
{tabs}
      </div>
      <div class="station-list view-grid" id="station-list" role="list">
        <!-- diisi oleh script.js -->
      </div>
      <p id="station-empty" class="empty-msg" hidden>Tidak ada yang cocok.</p>
    </div>
  </section>

  <section id="provinsi" class="section section-alt">
    <div class="container">
      <header class="section-header">
        <h2>🗺️ Berdasarkan Provinsi</h2>
        <p>Klik provinsi untuk memfilter daftar, klik lagi untuk menghapus.</p>
      </header>
      <div class="chip-cloud" id="provinsi-grid"></div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="footer-inner">
        <p class="footer-copy">RadioTV v.1.0 | dibuat oleh ApahUdi | 2026</p>
      </div>
    </div>
  </footer>

  <!-- Donasi -->
  <div class="donate-modal" id="donate-modal" hidden>
    <div class="donate-backdrop" id="donate-backdrop"></div>
    <div class="donate-card" role="dialog" aria-modal="true" aria-labelledby="donate-title">
      <button type="button" class="fp-close donate-close" id="donate-close" aria-label="Tutup">✕</button>
      <div class="donate-heart">❤️</div>
      <h2 id="donate-title">Dukung TVRadioID</h2>
      <p class="donate-sub">Donasi via DANA</p>
      <dl class="donate-details">
        <div><dt>Nama</dt><dd>Moh Agus Budiman</dd></div>
        <div><dt>Nomor DANA</dt><dd class="donate-number">085323073037</dd></div>
      </dl>
      <button type="button" class="donate-copy" id="donate-copy">Salin nomor DANA</button>
      <p class="donate-note">Terima kasih atas dukungan Anda.</p>
    </div>
  </div>

  <!-- Pemutar TV fullscreen -->
  <div class="video-modal" id="video-modal" hidden>
    <div class="video-modal-backdrop" id="video-backdrop"></div>
    <div class="video-modal-box" role="dialog" aria-modal="true" aria-labelledby="video-title">
      <div class="video-modal-header">
        <div class="video-modal-info">
          <span class="fp-type">📺</span>
          <div>
            <div class="fp-title" id="video-title">Channel TV</div>
            <div class="fp-sub" id="video-sub">Indonesia</div>
          </div>
        </div>
        <button class="fp-close" id="video-close" aria-label="Tutup pemutar video">✕</button>
      </div>
      <video id="video-player" controls playsinline autoplay></video>
      <div class="fp-status" id="video-status">Memuat…</div>
    </div>
  </div>

  <div class="floating-player" id="floating-player" hidden>
    <div class="fp-header">
      <span class="fp-type" id="fp-type">📻</span>
      <div class="fp-info">
        <div class="fp-title" id="fp-title">Judul Stasiun</div>
        <div class="fp-sub" id="fp-sub">Kota, Provinsi</div>
      </div>
      <button class="fp-close" id="fp-close" aria-label="Tutup pemutar">✕</button>
    </div>
    <div class="fp-controls">
      <button class="fp-play" id="fp-play" aria-label="Putar / Jeda">▶</button>
      <button class="fp-stop" id="fp-stop" aria-label="Berhenti">⏹</button>
      <div class="fp-volume">
        <label class="sr-only" for="fp-vol">Volume</label>
        <input type="range" id="fp-vol" min="0" max="1" step="0.1" value="1" />
      </div>
    </div>
    <div class="fp-status" id="fp-status">Siap</div>
  </div>

  <script src="hls.min.js?v=1"></script>
  <script src="stations-data.js?v=5"></script>
  <script src="script.js?v=20"></script>
</body>
</html>
'''


def tabs_html(items):
    lines = []
    for i, (value, label) in enumerate(items):
        active = ' class="tab active" role="tab" aria-selected="true"' if i == 0 else ' class="tab" role="tab" aria-selected="false"'
        lines.append(f'        <button type="button"{active} data-filter="{value}">{label}</button>')
    return "\n".join(lines)


def build(page):
    if page == "radio":
        data = dict(
            page="radio", title="Radio Indonesia",
            description="Dengarkan stasiun radio streaming dari seluruh Indonesia di TVRadioID.",
            self="radio.html",
            radio_active=' aria-current="page"', tv_active="",
            tabs=tabs_html(RADIO_FILTERS),
            tv_controls="",
        )
    else:
        data = dict(
            page="tv", title="TV Indonesia",
            description="Nonton channel televisi live streaming dari seluruh Indonesia di TVRadioID.",
            self="tv.html",
            radio_active="", tv_active=' aria-current="page"',
            tabs=tabs_html(TV_FILTERS),
            tv_controls=TV_CONTROLS,
        )
    (ROOT / f"{page}.html").write_text(TEMPLATE.format(**data), encoding="utf-8")
    print(f"written {page}.html")


build("radio")
build("tv")
