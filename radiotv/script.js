/* =========================================
   RadioTV Indonesia — Script (halaman radio / TV)
   ========================================= */
(() => {
  'use strict';

  const page = document.body.dataset.page === 'tv' ? 'tv' : 'radio';
  const isTv = page === 'tv';

  // --- Data ---
  const dataEl = document.getElementById('stations-data');
  const DATA_URL = 'stations.json';
  const AUTO_REFRESH_MS = 6 * 60 * 60 * 1000;
  const LAST_REFRESH_KEY = 'tvradio_last_refresh';
  const OFFLINE_KEY = 'tvradio_offline_marks';
  const VIEW_KEY = 'tvradio_view';
  const HIDE_KEY = 'tvradio_hide_offline';

  function dedupe(list) {
    const seen = new Set();
    return list.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  let stations = [];
  try {
    const raw = dataEl ? JSON.parse(dataEl.textContent || '[]') : window.STATIONS_DATA;
    stations = dedupe(Array.isArray(raw) ? raw : []);
  } catch (e) {
    console.error('Gagal memuat data stasiun:', e);
  }

  // --- DOM ---
  const listEl = document.getElementById('station-list');
  const emptyEl = document.getElementById('station-empty');
  const countEl = document.getElementById('station-count');
  const provinsiGrid = document.getElementById('provinsi-grid');
  const filterTabs = document.getElementById('filter-tabs');
  const searchInput = document.getElementById('search');
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const refreshBtn = document.getElementById('refresh-btn');
  const updateText = document.getElementById('update-text');
  const hideOfflineInput = document.getElementById('hide-offline');
  const viewToggle = document.getElementById('view-toggle');

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
  let videoStation = null;
  let pageFilter = 'all';
  let searchQuery = '';
  let gridView = (localStorage.getItem(VIEW_KEY) || 'grid') === 'grid';
  let hideOffline = (localStorage.getItem(HIDE_KEY) || 'true') === 'true';
  let lastRefresh = Number(localStorage.getItem(LAST_REFRESH_KEY)) || 0;
  let offlineMarks = loadOfflineMarks();
  let refreshing = false;

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

  // --- Status & refresh ---
  function loadOfflineMarks() {
    try {
      const raw = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '{}');
      const now = Date.now();
      const clean = {};
      Object.entries(raw).forEach(([id, mark]) => {
        if (mark && now - Number(mark.at || 0) < AUTO_REFRESH_MS) clean[id] = mark;
      });
      return clean;
    } catch { return {}; }
  }
  function saveOfflineMarks() {
    try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(offlineMarks)); } catch { /* ignore */ }
  }
  function statusOf(station) {
    if (offlineMarks[station.id]) return 'offline';
    return station.status || 'unknown';
  }
  function offlineReason(station) {
    const mark = offlineMarks[station.id];
    if (mark && mark.reason) return mark.reason;
    if (station.status === 'offline') {
      const code = station.httpCode ? ` (HTTP ${station.httpCode})` : '';
      return `Server stream tidak merespons saat pengecekan${code}.`;
    }
    return 'Kanal ditandai offline.';
  }
  function markOffline(station, reason) {
    if (!station) return;
    offlineMarks[station.id] = { at: Date.now(), reason };
    saveOfflineMarks();
    refreshStatusUI();
  }
  function markOnline(station) {
    if (!station || !offlineMarks[station.id]) return;
    delete offlineMarks[station.id];
    saveOfflineMarks();
    refreshStatusUI();
  }

  function updateStatusBadges() {
    const byId = new Map(stations.map((s) => [s.id, s]));
    listEl.querySelectorAll('.row').forEach((row) => {
      const station = byId.get(row.dataset.id);
      if (!station) return;
      const status = statusOf(station);
      row.dataset.status = status;
      const actions = row.querySelector('.row-actions');
      if (!actions) return;
      let badge = actions.querySelector('.row-status');
      if (status === 'unknown') {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        actions.prepend(badge);
      }
      if (status === 'offline') {
        badge.className = 'row-status offline';
        badge.textContent = 'Off';
        badge.title = offlineReason(station);
      } else {
        badge.className = 'row-status online';
        badge.textContent = '';
        badge.title = 'Stream aktif saat pengecekan terakhir';
      }
    });
  }

  function refreshStatusUI() {
    if (hideOffline) render();
    else updateStatusBadges();
    updateInfoBar();
  }

  function formatWhen(ts) {
    if (!ts) return 'data bawaan halaman';
    try {
      return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return new Date(ts).toLocaleString(); }
  }

  function pageStations() {
    return stations.filter((s) => s.type === page);
  }

  function updateInfoBar(message) {
    if (!updateText) return;
    if (message) { updateText.textContent = message; return; }
    const own = pageStations();
    const offline = own.filter((s) => statusOf(s) === 'offline').length;
    const unknown = own.filter((s) => statusOf(s) === 'unknown').length;
    updateText.textContent =
      `${own.length} ${isTv ? 'kanal' : 'stasiun'} · ${formatWhen(lastRefresh)} · ${offline} offline` +
      (unknown ? ` · ${unknown} belum terverifikasi` : '');
  }

  async function refreshData(manual) {
    if (refreshing) return;
    refreshing = true;
    if (manual) updateInfoBar('Memuat daftar terbaru…');
    if (refreshBtn) refreshBtn.classList.add('busy');
    try {
      if (location.protocol === 'file:') {
        throw new Error('buka lewat server (http), bukan file://');
      }
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = dedupe(await res.json());
      if (!fresh.length) throw new Error('data kosong');
      const sameOrder =
        fresh.length === stations.length &&
        fresh.every((s, i) => s.id === stations[i].id);
      const scrollY = window.scrollY;
      if (sameOrder) {
        // Objek yang sama dipakai baris, jadi URL/status baru langsung terpakai.
        fresh.forEach((s, i) => Object.assign(stations[i], s));
      } else {
        stations = fresh;
        render();
        renderProvinsi();
      }
      lastRefresh = Date.now();
      try { localStorage.setItem(LAST_REFRESH_KEY, String(lastRefresh)); } catch { /* ignore */ }
      refreshStatusUI();
      if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
    } catch (err) {
      updateInfoBar(`Gagal memperbarui (${err.message}). Menampilkan data tersimpan.`);
    } finally {
      refreshing = false;
      if (refreshBtn) refreshBtn.classList.remove('busy');
    }
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

  function visibleStation(s) {
    return s.type === page &&
      !(hideOffline && statusOf(s) === 'offline') &&
      matchesFilter(s, pageFilter) &&
      matchesSearch(s, searchQuery);
  }

  function markPlayingRow() {
    listEl.querySelectorAll('.row.is-playing').forEach((el) => el.classList.remove('is-playing'));
    if (!currentStation) return;
    const row = listEl.querySelector(`.row[data-id="${currentStation.id}"]`);
    if (row) row.classList.add('is-playing');
  }

  // --- Render row ---
  function createRow(station) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = station.id;
    const status = statusOf(station);
    row.dataset.status = status;
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `Putar ${station.name}`);

    const favActive = isFavorite(station.id);
    const ICONS = {
      radio: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="8" width="20" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3H9"/><circle cx="8" cy="14.5" r="2.6"/><path d="M14.5 12.5H19M14.5 16.5H19"/></svg>',
      tv: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2.5"/><path d="M17 2l-5 5-5-5"/></svg>'
    };
    const icon = ICONS[isTv ? 'tv' : 'radio'];
    const logo = station.logo
      ? `${icon}<img src="${escapeHtml(station.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer"
          onerror="this.remove()" />`
      : icon;
    const statusBadge = status === 'offline'
      ? `<span class="row-status offline" title="${escapeHtml(offlineReason(station))}">Off</span>`
      : status === 'online'
        ? '<span class="row-status online" title="Stream aktif saat pengecekan terakhir"></span>'
        : '';

    row.innerHTML = `
      <div class="row-logo">${logo}</div>
      <div class="row-main">
        <span class="row-name">${escapeHtml(station.name)}</span>
        <span class="row-region">${escapeHtml(regionOf(station))}</span>
      </div>
      <div class="row-actions">
        ${statusBadge}
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
    const items = stations.filter(visibleStation);
    const frag = document.createDocumentFragment();
    items.forEach((s) => frag.appendChild(createRow(s)));
    listEl.replaceChildren(frag);

    emptyEl.hidden = items.length !== 0;
    countEl.textContent = `${items.length} ${isTv ? 'kanal' : 'stasiun'}`;
  }

  // --- Province chips ---
  function renderProvinsi() {
    const map = new Map();
    pageStations().forEach((s) => {
      const prov = s.province || 'Indonesia';
      map.set(prov, (map.get(prov) || 0) + 1);
    });

    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'id'));
    const frag = document.createDocumentFragment();
    sorted.forEach(([name, count]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = `📍 ${escapeHtml(name)} <span class="n">${count}</span>`;
      chip.addEventListener('click', () => {
        searchInput.value = name;
        searchQuery = name;
        render();
        document.getElementById('utama').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      frag.appendChild(chip);
    });
    provinsiGrid.replaceChildren(frag);
  }

  function applyView() {
    listEl.classList.toggle('view-grid', gridView);
    if (!viewToggle) return;
    viewToggle.textContent = gridView ? '☰ Daftar' : '▦ Grid';
    viewToggle.setAttribute('aria-pressed', String(gridView));
    viewToggle.title = gridView ? 'Kembali ke tampilan daftar' : 'Ubah ke tampilan grid';
  }

  // --- Audio player ---
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => {
      setStatus('Sedang diputar');
      markOnline(currentStation);
    });
    audio.addEventListener('pause', () => { if (currentStation) setStatus('Dijeda'); });
    audio.addEventListener('waiting', () => setStatus('Memuat…'));
    audio.addEventListener('error', () => {
      if (!currentStation || !audio.getAttribute('src')) return;
      setStatus('Gagal memuat stream. Coba stasiun lain.');
      markOffline(currentStation, 'Gagal diputar di browser ini (bisa geo-blocked/CORS).');
    });
    audio.addEventListener('ended', () => setStatus('Stream berakhir'));
    return audio;
  }
  function setStatus(msg) { if (fpStatus) fpStatus.textContent = msg; }
  function setVideoStatus(msg) { if (videoStatus) videoStatus.textContent = msg; }

  function stopAudio() {
    if (hls) { try { hls.destroy(); } catch { /* ignore */ } hls = null; }
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    fpPlay.textContent = '▶';
  }

  function closeVideo() {
    videoStation = null;
    if (videoHls) { try { videoHls.destroy(); } catch { /* ignore */ } videoHls = null; }
    if (videoPlayer) { videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); }
    videoModal.hidden = true;
  }

  function playVideo(station) {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    if (hls) { try { hls.destroy(); } catch { /* ignore */ } hls = null; }
    fp.hidden = true;
    videoStation = station;
    document.body.classList.remove('player-open');

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
        markOnline(station);
        videoPlayer.play().catch(() => setVideoStatus('Klik tombol putar pada video.'));
      });
      videoHls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) {
          setVideoStatus('Gagal memuat stream. Kanal ditandai offline (bisa geo-blocked/CORS).');
          markOffline(station, 'Gagal diputar di browser ini (bisa geo-blocked/CORS).');
        }
      });
    } else {
      videoPlayer.src = url;
      videoPlayer.play().catch(() => setVideoStatus('Klik tombol putar pada video.'));
      setVideoStatus('Sedang ditonton');
    }
  }

  function playAudio(station) {
    closeVideo();
    currentStation = station;
    markPlayingRow();
    fp.hidden = false;
    document.body.classList.add('player-open');
    fpType.textContent = '📻';
    fpTitle.textContent = station.name || 'Stasiun';
    fpSub.textContent = regionOf(station);

    const a = ensureAudio();
    stopAudio();
    setStatus('Memuat…');

    if (!station.stream) { setStatus('Stream tidak tersedia.'); return; }

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
        if (data && data.fatal) {
          setStatus('Gagal memutar stream.');
          markOffline(station, 'Gagal diputar di browser ini (bisa geo-blocked/CORS).');
        }
      });
    } else {
      a.src = url;
      a.play().catch(() => setStatus('Tekan tombol putar untuk memulai.'));
    }
    fpPlay.textContent = '⏸';
  }

  function playStation(station) {
    if (isTv) playVideo(station);
    else playAudio(station);
  }

  // --- Player controls ---
  if (fpPlay) {
    fpPlay.addEventListener('click', () => {
      const a = ensureAudio();
      if (!currentStation) return;
      if (a.paused) {
        a.play().then(() => { fpPlay.textContent = '⏸'; }).catch(() => setStatus('Tidak bisa memutar. Coba lagi.'));
      } else { a.pause(); fpPlay.textContent = '▶'; }
    });
  }
  if (fpStop) fpStop.addEventListener('click', () => { stopAudio(); currentStation = null; markPlayingRow(); });
  if (fpClose) {
    fpClose.addEventListener('click', () => {
      stopAudio();
      currentStation = null;
      markPlayingRow();
      fp.hidden = true;
      document.body.classList.remove('player-open');
    });
  }
  if (fpVol) fpVol.addEventListener('input', () => { ensureAudio().volume = parseFloat(fpVol.value); });
  if (videoClose) videoClose.addEventListener('click', closeVideo);
  if (videoBackdrop) videoBackdrop.addEventListener('click', closeVideo);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal && !videoModal.hidden) closeVideo();
  });
  if (videoPlayer) {
    videoPlayer.addEventListener('playing', () => { if (videoStation) markOnline(videoStation); });
    videoPlayer.addEventListener('error', () => {
      if (!videoStation || !videoPlayer.getAttribute('src')) return;
      setVideoStatus('Gagal memuat stream. Kanal ditandai offline (bisa geo-blocked/CORS).');
      markOffline(videoStation, 'Gagal diputar di browser ini (bisa geo-blocked/CORS).');
    });
  }

  // --- Tabs ---
  if (filterTabs) {
    filterTabs.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        filterTabs.querySelectorAll('.tab').forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        pageFilter = tab.dataset.filter || 'all';
        render();
      });
    });
  }

  // --- Search ---
  let searchTimer = null;
  function applySearch(scroll) {
    searchQuery = searchInput.value.trim();
    render();
    if (scroll) document.getElementById('utama').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applySearch(false), 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applySearch(true); }
  });
  const searchBtn = document.querySelector('.search-btn');
  if (searchBtn) searchBtn.addEventListener('click', () => applySearch(true));

  // --- Refresh manual & otomatis 6 jam ---
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault(); // jangan pernah reload halaman
      refreshData(true);
    });
  }
  if (viewToggle) {
    viewToggle.addEventListener('click', () => {
      gridView = !gridView;
      try { localStorage.setItem(VIEW_KEY, gridView ? 'grid' : 'list'); } catch { /* ignore */ }
      applyView();
    });
  }
  if (hideOfflineInput) {
    hideOfflineInput.checked = hideOffline;
    hideOfflineInput.addEventListener('change', () => {
      hideOffline = hideOfflineInput.checked;
      try { localStorage.setItem(HIDE_KEY, hideOffline ? 'true' : 'false'); } catch { /* ignore */ }
      render();
    });
  }
  if (location.protocol !== 'file:') {
    if (!lastRefresh || Date.now() - lastRefresh >= AUTO_REFRESH_MS) refreshData(false);
    setInterval(() => {
      if (document.visibilityState === 'visible') refreshData(false);
    }, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh >= AUTO_REFRESH_MS) {
        refreshData(false);
      }
    });
  }

  // --- Mobile nav ---
  if (navToggle && navMenu) {
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
  }

  // --- Init ---
  render();
  renderProvinsi();
  applyView();
  updateInfoBar();
  window.TVRadio = {
    page,
    refresh: () => refreshData(true),
    getStations: () => stations,
    statusOf,
    setView: (mode) => {
      gridView = mode === 'grid';
      applyView();
    },
    setHideOffline: (value) => {
      hideOffline = Boolean(value);
      if (hideOfflineInput) hideOfflineInput.checked = hideOffline;
      render();
    },
  };
})();
