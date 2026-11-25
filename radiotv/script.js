/* =========================================
   TVRadio Indonesia — Script (compact list)
   ========================================= */
(() => {
  'use strict';

  // --- Data ---
  const dataEl = document.getElementById('stations-data');
  let stations = [];
  try {
    stations = JSON.parse(dataEl.textContent || '[]');
  } catch (e) {
    console.error('Gagal memuat data stasiun:', e);
  }
  const seen = new Set();
  stations = stations.filter((s) => {
    if (!s.id || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  // --- DOM ---
  const radioList = document.getElementById('radio-list');
  const tvList = document.getElementById('tv-list');
  const radioEmpty = document.getElementById('radio-empty');
  const tvEmpty = document.getElementById('tv-empty');
  const radioCount = document.getElementById('radio-count');
  const tvCount = document.getElementById('tv-count');
  const provinsiGrid = document.getElementById('provinsi-grid');
  const searchInput = document.getElementById('search');
  const yearEl = document.getElementById('year');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  // Audio player
  const fp = document.getElementById('floating-player');
  const fpType = document.getElementById('fp-type');
  const fpTitle = document.getElementById('fp-title');
  const fpSub = document.getElementById('fp-sub');
  const fpClose = document.getElementById('fp-close');
  const fpPlay = document.getElementById('fp-play');
  const fpStop = document.getElementById('fp-stop');
  const fpVol = document.getElementById('fp-vol');
  const fpStatus = document.getElementById('fp-status');

  // Video modal
  const videoModal = document.getElementById('video-modal');
  const videoPlayer = document.getElementById('video-player');
  const videoTitle = document.getElementById('video-title');
  const videoSub = document.getElementById('video-sub');
  const videoStatus = document.getElementById('video-status');
  const videoClose = document.getElementById('video-close');
  const videoBackdrop = document.getElementById('video-backdrop');

  // --- State ---
  let currentStation = null;
  let audio = null;
  let hls = null;
  let videoHls = null;
  let radioFilter = 'all';
  let tvFilter = 'all';
  let searchQuery = '';

  const FAVORITES_KEY = 'tvradio_favorites';
  let favorites = loadFavorites();

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* ignore */ }
  }
  function isFavorite(id) { return favorites.includes(id); }
  function toggleFavorite(id) {
    favorites = isFavorite(id) ? favorites.filter((f) => f !== id) : favorites.concat(id);
    saveFavorites();
  }

  // --- Helpers ---
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function regionOf(station) {
    if (station.province && station.province !== 'Indonesia') return station.province;
    return 'Indonesia';
  }

  function matchesSearch(s, q) {
    if (!q) return true;
    const needle = q.toLowerCase();
    return [s.name, s.city, s.province, s.desc, s.category]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  }

  function matchesFilter(s, filter) {
    if (filter === 'all') return true;
    return s.category === filter;
  }

  function markPlayingRow() {
    document.querySelectorAll('.row.is-playing').forEach((el) => el.classList.remove('is-playing'));
    if (!currentStation) return;
    const row = document.querySelector(`.row[data-id="${currentStation.id}"]`);
    if (row) row.classList.add('is-playing');
  }

  // --- Render row ---
  function createRow(station) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = station.id;
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `Putar ${station.name}`);

    const favActive = isFavorite(station.id);
    const ICONS = {
      radio: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="8" width="20" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3H9"/><circle cx="8" cy="14.5" r="2.6"/><path d="M14.5 12.5H19M14.5 16.5H19"/></svg>',
      tv: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2.5"/><path d="M17 2l-5 5-5-5"/></svg>'
    };
    const icon = ICONS[station.type === 'radio' ? 'radio' : 'tv'];
    const logo = station.logo
      ? `${icon}<img src="${escapeHtml(station.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer"
          onerror="this.remove()" />`
      : icon;

    row.innerHTML = `
      <div class="row-logo">${logo}</div>
      <div class="row-main">
        <span class="row-name">${escapeHtml(station.name)}</span>
        <span class="row-region">${escapeHtml(regionOf(station))}</span>
      </div>
      <div class="row-actions">
        <button class="row-fav ${favActive ? 'active' : ''}" type="button"
          aria-label="Favorit ${escapeHtml(station.name)}" aria-pressed="${favActive}">${favActive ? '♥' : '♡'}</button>
        <button class="row-play" type="button" aria-label="Putar ${escapeHtml(station.name)}">▶</button>
      </div>
    `;

    const favBtn = row.querySelector('.row-fav');
    const playBtn = row.querySelector('.row-play');

    const play = (e) => {
      if (e) e.stopPropagation();
      playStation(station);
    };
    row.addEventListener('click', (e) => {
      if (e.target.closest('.row-fav')) return;
      play();
    });
    row.addEventListener('keydown', (e) => {
      if (e.target.closest('.row-fav')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
    });
    playBtn.addEventListener('click', play);
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(station.id);
      const active = isFavorite(station.id);
      favBtn.classList.toggle('active', active);
      favBtn.textContent = active ? '♥' : '♡';
      favBtn.setAttribute('aria-pressed', String(active));
    });

    if (currentStation && currentStation.id === station.id) row.classList.add('is-playing');
    return row;
  }

  function render() {
    const radios = stations.filter((s) => s.type === 'radio' && matchesFilter(s, radioFilter) && matchesSearch(s, searchQuery));
    const tvs = stations.filter((s) => s.type === 'tv' && matchesFilter(s, tvFilter) && matchesSearch(s, searchQuery));

    const rFrag = document.createDocumentFragment();
    radios.forEach((s) => rFrag.appendChild(createRow(s)));
    radioList.replaceChildren(rFrag);

    const tFrag = document.createDocumentFragment();
    tvs.forEach((s) => tFrag.appendChild(createRow(s)));
    tvList.replaceChildren(tFrag);

    radioEmpty.hidden = radios.length !== 0;
    tvEmpty.hidden = tvs.length !== 0;
    radioCount.textContent = `${radios.length} stasiun`;
    tvCount.textContent = `${tvs.length} kanal`;
  }

  // --- Province chips ---
  function renderProvinsi() {
    const map = new Map();
    stations.forEach((s) => {
      const prov = s.province || 'Indonesia';
      if (!map.has(prov)) map.set(prov, { radio: 0, tv: 0 });
      map.get(prov)[s.type === 'radio' ? 'radio' : 'tv']++;
    });

    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'id'));
    const frag = document.createDocumentFragment();
    sorted.forEach(([name, counts]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = `📍 ${escapeHtml(name)} <span class="n">${counts.radio + counts.tv}</span>`;
      const filterAction = () => {
        searchInput.value = name;
        searchQuery = name;
        render();
        document.getElementById('radio').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      chip.addEventListener('click', filterAction);
      frag.appendChild(chip);
    });
    provinsiGrid.replaceChildren(frag);
  }

  // --- Audio player ---
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => setStatus('Sedang diputar'));
    audio.addEventListener('pause', () => { if (currentStation) setStatus('Dijeda'); });
    audio.addEventListener('waiting', () => setStatus('Memuat…'));
    audio.addEventListener('error', () => setStatus('Gagal memuat stream. Coba stasiun lain.'));
    audio.addEventListener('ended', () => setStatus('Stream berakhir'));
    return audio;
  }
  function setStatus(msg) { fpStatus.textContent = msg; }
  function setVideoStatus(msg) { videoStatus.textContent = msg; }

  function stopPlayback() {
    if (hls) { try { hls.destroy(); } catch { /* ignore */ } hls = null; }
    if (videoHls) { try { videoHls.destroy(); } catch { /* ignore */ } videoHls = null; }
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (videoPlayer) { videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); }
    fpPlay.textContent = '▶';
    setStatus('Berhenti');
  }

  function closeVideo() {
    if (videoHls) { try { videoHls.destroy(); } catch { /* ignore */ } videoHls = null; }
    if (videoPlayer) { videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); }
    videoModal.hidden = true;
  }

  function playVideo(station) {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (hls) { try { hls.destroy(); } catch { /* ignore */ } hls = null; }
    fp.hidden = true;

    videoTitle.textContent = station.name || 'Channel TV';
    videoSub.textContent = regionOf(station);
    videoModal.hidden = false;
    setVideoStatus('Memuat stream…');

    if (!station.stream) { setVideoStatus('Stream tidak tersedia.'); return; }

    const url = station.stream;
    const isHls = /\.m3u8(\?|$)/i.test(url) || /playlist\.m3u8/i.test(url);

    if (isHls && window.Hls && window.Hls.isSupported()) {
      videoHls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
      videoHls.loadSource(url);
      videoHls.attachMedia(videoPlayer);
      videoHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setVideoStatus('Sedang ditonton');
        videoPlayer.play().catch(() => setVideoStatus('Klik tombol putar pada video.'));
      });
      videoHls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) setVideoStatus('Gagal memuat stream. Kanal mungkin geo-blocked atau tidak aktif.');
      });
    } else {
      videoPlayer.src = url;
      videoPlayer.play().catch(() => setVideoStatus('Klik tombol putar pada video.'));
      setVideoStatus('Sedang ditonton');
    }
  }

  function playStation(station) {
    if (station.type === 'tv') { playVideo(station); return; }
    closeVideo();
    currentStation = station;
    markPlayingRow();
    fp.hidden = false;
    fpType.textContent = '📻';
    fpTitle.textContent = station.name || 'Stasiun';
    fpSub.textContent = regionOf(station);

    const a = ensureAudio();
    stopPlayback();

    if (!station.stream) { setStatus('Stream tidak tersedia.'); return; }
    setStatus('Memuat…');

    const url = station.stream;
    const isHls = /\.m3u8(\?|$)/i.test(url) || /chunklist|\.mpd/i.test(url);

    if (isHls && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(url);
      hls.attachMedia(a);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        a.play().catch(() => setStatus('Tekan tombol putar untuk memulai.'));
      });
      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) setStatus('Gagal memutar stream.');
      });
    } else {
      a.src = url;
      a.play().catch(() => setStatus('Tekan tombol putar untuk memulai.'));
    }
    fpPlay.textContent = '⏸';
  }

  fpPlay.addEventListener('click', () => {
    const a = ensureAudio();
    if (!currentStation) return;
    if (a.paused) {
      a.play().then(() => { fpPlay.textContent = '⏸'; }).catch(() => setStatus('Tidak bisa memutar. Coba lagi.'));
    } else { a.pause(); fpPlay.textContent = '▶'; }
  });
  fpStop.addEventListener('click', () => { stopPlayback(); currentStation = null; markPlayingRow(); });
  fpClose.addEventListener('click', () => { stopPlayback(); currentStation = null; markPlayingRow(); fp.hidden = true; });
  fpVol.addEventListener('input', () => { ensureAudio().volume = parseFloat(fpVol.value); });
  videoClose.addEventListener('click', closeVideo);
  videoBackdrop.addEventListener('click', closeVideo);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !videoModal.hidden) closeVideo(); });

  // --- Tabs ---
  document.querySelectorAll('.category-tabs').forEach((group) => {
    const section = group.closest('section');
    const isRadio = section && section.id === 'radio';
    group.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        group.querySelectorAll('.tab').forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const filter = tab.dataset.filter || 'all';
        if (isRadio) radioFilter = filter; else tvFilter = filter;
        render();
      });
    });
  });

  // --- Search ---
  let searchTimer = null;
  function applySearch(scroll) {
    searchQuery = searchInput.value.trim();
    render();
    if (scroll) document.getElementById('radio').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(false), 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applySearch(true); }
  });
  document.querySelector('.search-btn').addEventListener('click', () => applySearch(true));

  // --- Mobile nav ---
  navToggle.addEventListener('click', () => {
    const open = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      navMenu.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // --- Init ---
  yearEl.textContent = String(new Date().getFullYear());
  render();
  renderProvinsi();
})();
