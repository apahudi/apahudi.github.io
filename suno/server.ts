import express from 'express';
import type {Request, Response} from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {createRequire} from 'module';
import {Readable} from 'stream';
import type webpushTypes from 'web-push';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof webpushTypes;

const UPSTREAM_ORIGIN = 'https://joi.stb.biz.id';
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = process.cwd();
const VAPID_FILE = path.join(ROOT_DIR, '.vapid-keys.json');
const SUBS_FILE = path.join(ROOT_DIR, '.push-subscriptions.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface StoredSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
}

interface CacheEntry {
  data: unknown;
  updatedAt: number;
}

interface TrackSummary {
  id: string;
  title?: string;
  artist?: string;
  image?: string;
}

interface PlaylistSummary {
  id: string;
  name: string;
  description?: string;
  image?: string;
  tracks?: TrackSummary[];
}

function loadOrCreateVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8')) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read VAPID file, generating new keys:', err);
  }
  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist VAPID keys to disk:', err);
  }
  return generated;
}

function loadSubscriptions(): StoredSubscription[] {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) {
        return parsed as StoredSubscription[];
      }
    }
  } catch (err) {
    console.warn('Failed to load push subscriptions:', err);
  }
  return [];
}

function saveSubscriptions(subs: StoredSubscription[]): void {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist push subscriptions:', err);
  }
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails('mailto:push@budijoi.app', vapidKeys.publicKey, vapidKeys.privateKey);

let subscriptions: StoredSubscription[] = loadSubscriptions();
const apiFallbackCache = new Map<string, CacheEntry>();
const sseClients = new Set<Response>();
let knownTrackIds = new Set<string>();

function broadcastSse(event: string, payload: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function fetchUpstreamJson<T>(
  upstreamPath: string,
  cacheKey: string,
  timeoutMs = 7000,
): Promise<{data: T; fromCache: boolean}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${UPSTREAM_ORIGIN}${upstreamPath}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BudijoiSunoAndroidWrapper/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    const data = (await response.json()) as T;
    apiFallbackCache.set(cacheKey, {data, updatedAt: Date.now()});
    return {data, fromCache: false};
  } catch (err) {
    const cached = apiFallbackCache.get(cacheKey);
    if (cached) {
      return {data: cached.data as T, fromCache: true};
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function sendPushToAll(payload: {
  title: string;
  body: string;
  trackId?: string;
  image?: string;
  url?: string;
}): Promise<{sent: number; failed: number; total: number}> {
  const bodyString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    trackId: payload.trackId ?? '',
    image: payload.image ?? '',
    url: payload.url ?? (payload.trackId ? `/?track=${encodeURIComponent(payload.trackId)}` : '/'),
  });

  let sent = 0;
  let failed = 0;
  const remaining: StoredSubscription[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, bodyString, {TTL: 86400});
        sent += 1;
        remaining.push(sub);
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as {statusCode: number}).statusCode)
            : 0;
        if (statusCode !== 404 && statusCode !== 410) {
          remaining.push(sub);
        }
      }
    }),
  );

  if (remaining.length !== subscriptions.length) {
    subscriptions = remaining;
    saveSubscriptions(subscriptions);
  }

  return {sent, failed, total: subscriptions.length};
}

async function checkUpstreamUpdates(notifyIfNew: boolean): Promise<{newCount: number; totalTracks: number}> {
  try {
    const {data} = await fetchUpstreamJson<PlaylistSummary[]>('/api/playlists', 'playlists', 8000);
    const allSongs = data.find((p) => p.id === 'all-songs') ?? data[0];
    const trackList = allSongs?.tracks ?? [];
    const currentIds = new Set(trackList.map((t) => t.id));

    if (knownTrackIds.size === 0) {
      knownTrackIds = currentIds;
      return {newCount: 0, totalTracks: currentIds.size};
    }

    const newIds = trackList.filter((t) => !knownTrackIds.has(t.id));
    if (newIds.length > 0 && notifyIfNew) {
      const latestId = newIds[0].id;
      let title = 'Lagu baru ditambahkan';
      let artist = 'Budijoi Suno';
      let image = '/pwa-512x512.png';
      try {
        const trackRes = await fetchUpstreamJson<TrackSummary>(
          `/api/track/${encodeURIComponent(latestId)}`,
          `track:${latestId}`,
          5000,
        );
        if (trackRes.data?.title) title = trackRes.data.title;
        if (trackRes.data?.artist) artist = trackRes.data.artist;
        if (trackRes.data?.image) {
          image = `/api/image-proxy?url=${encodeURIComponent(trackRes.data.image)}`;
        }
      } catch {
        // Use defaults if individual track lookup fails
      }

      const pushPayload = {
        title: newIds.length === 1 ? `Lagu Baru: ${title}` : `${newIds.length} Lagu Baru di Budijoi Suno`,
        body: newIds.length === 1 ? `${artist} · Ketuk untuk putar sekarang` : `Termasuk ${title} oleh ${artist}`,
        trackId: latestId,
        image,
        url: `/?track=${encodeURIComponent(latestId)}`,
      };

      broadcastSse('new-track', pushPayload);
      if (subscriptions.length > 0) {
        await sendPushToAll(pushPayload);
      }
    }

    knownTrackIds = currentIds;
    return {newCount: newIds.length, totalTracks: currentIds.size};
  } catch {
    return {newCount: 0, totalTracks: knownTrackIds.size};
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      upstream: UPSTREAM_ORIGIN,
      pushSubscribers: subscriptions.length,
      cachedEndpoints: apiFallbackCache.size,
    });
  });

  // Upstream JSON proxies with resilient fallback caching
  app.get('/api/config', async (_req: Request, res: Response) => {
    try {
      const {data, fromCache} = await fetchUpstreamJson('/api/config', 'config');
      res.setHeader('X-Cache-Status', fromCache ? 'STALE-FALLBACK' : 'LIVE');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(data);
    } catch (err) {
      res.status(502).json({error: 'Gagal mengambil konfigurasi Budijoi Suno.', detail: String(err)});
    }
  });

  app.get('/api/playlists', async (_req: Request, res: Response) => {
    try {
      const {data, fromCache} = await fetchUpstreamJson('/api/playlists', 'playlists');
      res.setHeader('X-Cache-Status', fromCache ? 'STALE-FALLBACK' : 'LIVE');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(data);
    } catch (err) {
      res.status(502).json({error: 'Gagal memuat daftar playlist.', detail: String(err)});
    }
  });

  app.get('/api/playlists/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!id) {
      res.status(400).json({error: 'Playlist ID diperlukan'});
      return;
    }
    try {
      const {data, fromCache} = await fetchUpstreamJson(
        `/api/playlists/${encodeURIComponent(id)}`,
        `playlist:${id}`,
        12000,
      );
      res.setHeader('X-Cache-Status', fromCache ? 'STALE-FALLBACK' : 'LIVE');
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json(data);
    } catch (err) {
      res.status(502).json({error: 'Gagal memuat isi playlist.', detail: String(err)});
    }
  });

  app.get('/api/track/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    try {
      const {data, fromCache} = await fetchUpstreamJson(
        `/api/track/${encodeURIComponent(id)}`,
        `track:${id}`,
      );
      res.setHeader('X-Cache-Status', fromCache ? 'STALE-FALLBACK' : 'LIVE');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(data);
    } catch (err) {
      res.status(502).json({error: 'Gagal memuat detail lagu.', detail: String(err)});
    }
  });

  // Likes & play-counts proxies
  app.get('/api/likes', async (req: Request, res: Response) => {
    const clientId = String(req.query.clientId || '');
    try {
      const {data} = await fetchUpstreamJson(
        `/api/likes?clientId=${encodeURIComponent(clientId)}`,
        `likes:${clientId}`,
      );
      res.json(data);
    } catch {
      res.json({likes: []});
    }
  });

  app.post('/api/likes/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    try {
      const upstream = await fetch(`${UPSTREAM_ORIGIN}/api/likes/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(req.body ?? {}),
      });
      const json = await upstream.json();
      res.status(upstream.status).json(json);
    } catch {
      res.status(200).json({ok: true, offlineQueued: true});
    }
  });

  app.get('/api/play-counts', async (_req: Request, res: Response) => {
    try {
      const {data} = await fetchUpstreamJson('/api/play-counts', 'play-counts');
      res.json(data);
    } catch {
      res.json({});
    }
  });

  app.post('/api/play-counts/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    try {
      const upstream = await fetch(`${UPSTREAM_ORIGIN}/api/play-counts/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(req.body ?? {}),
      });
      const json = await upstream.json();
      res.status(upstream.status).json(json);
    } catch {
      res.status(200).json({ok: true});
    }
  });

  // Streaming Audio Proxy with Byte-Range & Offline Caching Headers
  app.get('/api/audio/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      res.status(400).json({error: 'ID audio tidak valid'});
      return;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'BudijoiSunoAndroidWrapper/1.0',
    };
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    try {
      const upstream = await fetch(`${UPSTREAM_ORIGIN}/api/audio/${encodeURIComponent(id)}`, {
        headers,
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({error: 'Audio tidak ditemukan di server sumber.'});
        return;
      }

      res.status(upstream.status);
      const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'];
      for (const h of passHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({error: 'Koneksi ke server audio terputus.', detail: String(err)});
      }
    }
  });

  // Cover image proxy so CacheStorage can store CORS-clean cover art offline
  app.get('/api/image-proxy', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl) {
      res.status(400).end();
      return;
    }
    try {
      const parsed = new URL(rawUrl);
      const allowed =
        parsed.hostname.endsWith('suno.ai') ||
        parsed.hostname === 'joi.stb.biz.id' ||
        parsed.hostname.endsWith('.stb.biz.id');
      if (!allowed) {
        res.status(403).json({error: 'Host gambar tidak diizinkan'});
        return;
      }

      const upstream = await fetch(parsed.toString(), {
        headers: {'User-Agent': 'BudijoiSunoAndroidWrapper/1.0'},
      });
      if (!upstream.ok || !upstream.body) {
        res.status(upstream.status || 404).end();
        return;
      }

      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
      nodeStream.pipe(res);
    } catch {
      res.status(502).end();
    }
  });

  // Web Push endpoints
  app.get('/api/push/public-key', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({publicKey: vapidKeys.publicKey});
  });

  app.post('/api/push/subscriptions', (req: Request, res: Response) => {
    const sub = req.body as Partial<StoredSubscription>;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      res.status(400).json({error: 'Data langganan push tidak lengkap.'});
      return;
    }
    const existingIdx = subscriptions.findIndex((s) => s.endpoint === sub.endpoint);
    const entry: StoredSubscription = {
      endpoint: sub.endpoint,
      expirationTime: sub.expirationTime ?? null,
      keys: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      subscriptions[existingIdx] = entry;
    } else {
      subscriptions.push(entry);
    }
    saveSubscriptions(subscriptions);
    res.status(201).json({ok: true, subscriberCount: subscriptions.length});
  });

  app.delete('/api/push/subscriptions', (req: Request, res: Response) => {
    const endpoint = String((req.body as {endpoint?: string})?.endpoint || '');
    if (!endpoint) {
      res.status(400).json({error: 'Endpoint langganan diperlukan.'});
      return;
    }
    subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
    saveSubscriptions(subscriptions);
    res.json({ok: true, subscriberCount: subscriptions.length});
  });

  app.post('/api/push/test', async (req: Request, res: Response) => {
    const body = req.body as {title?: string; body?: string; trackId?: string};
    const title = body?.title || 'Budijoi Suno';
    const message =
      body?.body || 'Notifikasi push aktif! Kamu akan mendapat info saat ada lagu atau playlist baru.';

    broadcastSse('push-test', {title, body: message, trackId: body?.trackId || ''});

    if (subscriptions.length === 0) {
      res.json({
        ok: true,
        sent: 0,
        failed: 0,
        total: 0,
        note: 'Tidak ada endpoint PushManager terdaftar; notifikasi lokal tetap didukung.',
      });
      return;
    }

    const result = await sendPushToAll({
      title,
      body: message,
      trackId: body?.trackId,
    });
    res.json({ok: true, ...result});
  });

  app.post('/api/push/check-updates', async (_req: Request, res: Response) => {
    const result = await checkUpstreamUpdates(true);
    res.json({ok: true, ...result});
  });

  // Server-Sent Events for real-time update announcements
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`event: connected\ndata: ${JSON.stringify({ok: true, time: Date.now()})}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // Android Digital Asset Links for Trusted Web Activity (TWA)
  app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
    const pkg = process.env.ANDROID_PACKAGE_NAME || 'id.biz.stb.joi.twa';
    const sha =
      process.env.ANDROID_SHA256_FINGERPRINT ||
      '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: [sha],
        },
      },
    ]);
  });

  // Seed initial known tracks silently in background
  void checkUpstreamUpdates(false);
  // Poll upstream every 5 minutes for newly released tracks
  setInterval(() => {
    void checkUpstreamUpdates(true);
  }, 5 * 60 * 1000);

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {server: httpServer},
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Budijoi Suno server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
