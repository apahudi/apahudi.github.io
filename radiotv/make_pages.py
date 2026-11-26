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
]

TEMPLATE = '''<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | RadioTV Indonesia</title>
  <meta name="description" content="{description}" />
  <link rel="stylesheet" href="style.css?v=9" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body data-page="{page}">
  <header class="header">
    <div class="container nav">
      <a href="radio.html" class="logo" aria-label="RadioTV Indonesia">Radio<span>TV</span> Indonesia</a>
      <button class="nav-toggle" aria-label="Buka menu" aria-expanded="false">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </button>
      <nav class="nav-menu" id="nav-menu">
        <ul role="menubar">
          <li role="none"><a href="radio.html" role="menuitem"{radio_active}>Radio</a></li>
          <li role="none"><a href="tv.html" role="menuitem"{tv_active}>TV</a></li>
          <li role="none"><a href="{self}#provinsi" role="menuitem">Provinsi</a></li>
          <li role="none"><a href="{self}#tentang" role="menuitem">Tentang</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container hero-inner">
      <h1 class="sr-only">{heading}</h1>
      <div class="search-box" role="search" aria-label="Cari stasiun atau channel">
        <label class="sr-only" for="search">Cari stasiun atau channel</label>
        <input type="search" id="search" placeholder="{placeholder}" autocomplete="off" />
        <button type="button" class="search-btn" aria-label="Cari"><span class="sr-only">Cari</span>🔍</button>
      </div>
      <div class="update-bar">
        <button type="button" class="refresh-btn" id="refresh-btn" title="Muat ulang daftar dari stations.json">🔄 Perbarui</button>
        <button type="button" class="view-toggle" id="view-toggle" aria-pressed="true" title="Ubah ke tampilan daftar">☰ Daftar</button>
        <label class="hide-toggle"><input type="checkbox" id="hide-offline" checked /> Sembunyikan offline</label>
        <span class="update-text" id="update-text" aria-live="polite">Memuat status…</span>
      </div>
    </div>
  </section>

  <section id="utama" class="section section-cards">
    <div class="container">
      <header class="section-header">
        <h2>{icon} {heading}</h2>
        <p>{subtitle} <span class="count" id="station-count"></span></p>
      </header>
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
        <p>Klik provinsi untuk memfilter daftar.</p>
      </header>
      <div class="chip-cloud" id="provinsi-grid"></div>
    </div>
  </section>

  <section id="tentang" class="section section-about">
    <div class="container">
      <div class="about-grid">
        <div class="about-text">
          <h2>Tentang RadioTV Indonesia</h2>
          <p>Daftar {kind} Indonesia dari sumber resmi dan publik. Pilih tampilan grid atau daftar, simpan favorit, dan perbarui status kanal kapan saja.</p>
          <ul class="feature-list">
            <li>✅ Refresh manual dan otomatis tiap 6 jam, tanpa reload halaman</li>
            <li>✅ Kanal offline diberi tanda dan bisa disembunyikan</li>
            <li>✅ Pencarian, filter wilayah/kategori, dan chip provinsi</li>
            <li>✅ Favorit tersimpan di browser</li>
          </ul>
        </div>
        <div class="about-disclaimer">
          <div class="card warn">
            <h3>⚠️ Penting</h3>
            <p>Stream berasal dari sumber publik dan resmi; kami tidak meng-host konten. Sebagian kanal bersifat geo-blocked, http-only, atau berlangganan sehingga bisa gagal diputar dari luar Indonesia.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="footer-inner">
        <p class="footer-copy">RadioTV v.1.0 | dibuat oleh ApahUdi | 2026</p>
      </div>
    </div>
  </footer>

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

  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <script src="stations-data.js?v=1"></script>
  <script src="script.js?v=8"></script>
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
            page="radio", title="Radio Indonesia", heading="Radio Indonesia",
            description="Dengarkan stasiun radio streaming dari seluruh Indonesia.",
            placeholder="Cari stasiun radio atau daerah…",
            subtitle="Pilih stasiun radio favorit Anda dari seluruh nusantara.",
            icon="📻", kind="stasiun radio", self="radio.html",
            radio_active=' aria-current="page"', tv_active="",
            tabs=tabs_html(RADIO_FILTERS),
        )
    else:
        data = dict(
            page="tv", title="TV Indonesia", heading="TV Indonesia",
            description="Nonton channel televisi live streaming dari seluruh Indonesia.",
            placeholder="Cari channel TV atau daerah…",
            subtitle="Nonton channel televisi favorit Anda secara live streaming.",
            icon="📺", kind="channel TV", self="tv.html",
            radio_active="", tv_active=' aria-current="page"',
            tabs=tabs_html(TV_FILTERS),
        )
    (ROOT / f"{page}.html").write_text(TEMPLATE.format(**data), encoding="utf-8")
    print(f"written {page}.html")


build("radio")
build("tv")
