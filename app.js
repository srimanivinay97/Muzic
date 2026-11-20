'use strict';

// ============================================================
// Element references
// ============================================================
const $ = (id) => document.getElementById(id);

const audioA = $('audio-a');
const audioB = $('audio-b');
let audio = audioA;           // The player currently making sound
let idle = audioB;            // The other player, holding the next song ready

const fileInput = $('file-input');
const importInput = $('import-input');
const trackList = $('track-list');
const groupList = $('group-list');
const emptyBox = $('empty');
const searchEl = $('search');
const progress = $('progress');
const fullPlayer = $('full-player');
const mini = $('mini');
const countEl = $('count');
const pageTitle = $('page-title');
const miniBar = $('mini-bar');
const tNow = $('t-now');
const tLeft = $('t-left');

const SUPPORTED = new Set(['mp3', 'm4a', 'mp4', 'm4b', 'aac', 'flac', 'wav', 'aif', 'aiff', 'caf']);
const STATE_KEY = 'glass-music-state';
const SORT_KEY = 'glass-music-sort';
const FAV_KEY = 'glass-music-favorites';
const RECENT_KEY = 'glass-music-recent';
const HOME_COLOR = '#a3001a';

// Built-in lists that behave like playlists but are generated, not saved
const FAV_ID = '__favorites__';
const RECENT_ID = '__recent__';
const RECENT_MAX = 50;

// Song list layout (must match the sizes in style.css)
const ROW_H = 74;
const ROW_PITCH = 78;
const GRID_MIN = 320;
const GRID_GAP = 14;

// A fraction of a second of silence, used once to let iOS unlock both players
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

// ============================================================
// Icons (SVG). "filled" icons use solid shapes, others use outlines
// ============================================================
function svg(paths, filled = false) {
  if (filled) {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paths}</svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICON = {
  play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>', true),
  pause: svg('<rect x="6" y="4.5" width="4.2" height="15" rx="1.4"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4"/>', true),
  next: svg('<path d="M5 5.6v12.8a1 1 0 0 0 1.56.83l8.4-6.4a1 1 0 0 0 0-1.66l-8.4-6.4A1 1 0 0 0 5 5.6z"/><rect x="16" y="5" width="2.6" height="14" rx="1"/>', true),
  prev: svg('<path d="M19 5.6v12.8a1 1 0 0 1-1.56.83l-8.4-6.4a1 1 0 0 1 0-1.66l8.4-6.4A1 1 0 0 1 19 5.6z"/><rect x="5.4" y="5" width="2.6" height="14" rx="1"/>', true),
  shuffle: svg('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
  repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  repeatOne: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><text x="12" y="15" font-size="7" text-anchor="middle" fill="currentColor" stroke="none">1</text>'),
  note: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>'),
  playlist: svg('<path d="M4 6h11M4 11h11M4 16h7"/><path d="M19 13v6.5"/><circle cx="16.5" cy="19.5" r="2.5"/>'),
  movie: svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M2.5 12h19M2.5 8.5h4.5M2.5 15.5h4.5M17 8.5h4.5M17 15.5h4.5"/>'),
  queue: svg('<path d="M4 6h16M4 12h10M4 18h7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', true),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  sort: svg('<path d="M7 4v16M7 20l-3.5-3.5M7 20l3.5-3.5"/><path d="M14 7h7M14 12h5M14 17h3"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-9.3-9A5 5 0 0 1 12 6.2 5 5 0 0 1 21.3 11c-1.8 4.4-9.3 9-9.3 9z"/>'),
  heartFull: svg('<path d="M12 20.3s-7.8-4.8-9.6-9.3A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.6 5c-1.8 4.5-9.6 9.3-9.6 9.3z"/>', true),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 1.5"/><path d="M9 2h6"/>'),
  download: svg('<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>'),
  upload: svg('<path d="M12 15V3"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M4 20h16"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
};

function setIcons() {
  $('back-btn').innerHTML = ICON.back;
  $('close-full').innerHTML = ICON.chevronDown;
  $('list-more').innerHTML = ICON.more;
  $('menu-btn').innerHTML = ICON.more;
  $('sort-btn').innerHTML = ICON.sort;
  $('add-btn').innerHTML = ICON.plus;
  $('new-playlist-btn').innerHTML = ICON.plus;
  $('sleep-btn').innerHTML = ICON.timer;
  $('fav-btn').innerHTML = ICON.heart;
  $('shuffle').innerHTML = ICON.shuffle;
  $('prev').innerHTML = ICON.prev;
  $('next').innerHTML = ICON.next;
  $('mini-next').innerHTML = ICON.next;
  $('refresh-icon').innerHTML = ICON.refresh;
  document.querySelector('#queue-btn .pill-icon').innerHTML = ICON.queue;
  document.querySelector('[data-icon="note"]').innerHTML = ICON.note;
  document.querySelector('[data-icon="movie"]').innerHTML = ICON.movie;
  document.querySelector('[data-icon="playlist"]').innerHTML = ICON.playlist;
  document.querySelector('[data-icon="search"]').innerHTML = ICON.search;
}

// ============================================================
// State
// ============================================================
let tracks = [];
const trackMap = new Map();
let playlists = [];

let view = 'library';     // library | movies | playlists | search | playlist | album
let activeTab = 'library';
let viewPlaylistId = null;
let viewAlbum = null;
let searchQuery = '';

let base = [];
let order = [];
let currentId = null;

let shuffleOn = false;
let repeatMode = 0;
let queueOpen = false;
let seeking = false;
let pendingSeek = null;
let wantPlaying = false;
let errorStreak = 0;
let uiDirty = false;
let lastSave = 0;
let db = null;
let toastTimer = null;
let storageText = '';
let sortMode = 'name';

let favorites = new Set();
let recent = [];

let sleepTimer = null;      // Countdown handle
let sleepEndsAt = 0;        // When the timer finishes, in milliseconds
let sleepAtTrackEnd = false;
let sleepTick = null;

let keepAliveCtx = null;
let audioUnlocked = false;

const rowById = new Map();
const artPending = new Map();

const virt = { ids: [], context: 'library', cols: 1, rows: 0, els: new Map(), frame: 0 };

// ============================================================
// Helpers
// ============================================================
const byId = (id) => trackMap.get(id) || null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function hashHue(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function gradientCss(hue) {
  return `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 60) % 360} 80% 34%))`;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

// Removes website names that download sites add to tags, e.g. "Song - TeluguWap.Net".
// A separator or "www." must come first, so real titles containing a dot are left alone.
const SITE_SUFFIX = /\s*(?:[-–—|:~]\s*[\[(]?|[\[(]|(?=www\.))\s*(?:www\.)?[a-z0-9-]+\.(?:com|net|org|in|info|co|me|cc|biz|xyz|fm|io|mobi|ws|tv|club|site|pk|live|guru|world|top|app|online)\b[^\])]*[\])]?\s*$/i;

function cleanText(text) {
  if (!text) return '';
  const cleaned = text.replace(SITE_SUFFIX, '').trim();
  return cleaned || text.trim();
}

function subtitleFor(track) {
  return track.album || track.artist || 'Unknown';
}

function albumOf(track) {
  return track.album || 'Unknown Movie';
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
  $('haptic-label').click();
}

function onTap(id, fn) {
  $(id).addEventListener('click', (e) => {
    haptic();
    fn(e);
  });
}

function setTopColor(color) {
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  $('theme-color').setAttribute('content', color);
}

function lockScroll() {
  document.body.classList.toggle('locked', fullPlayer.classList.contains('open') || !$('sheet').hidden);
}

// Reads a saved value that should be a list, returning an empty one if anything is wrong
function readStoredList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (err) {
    return [];
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Storage blocked or full. The value lasts for this visit only
  }
}

// ============================================================
// Shuffle
// crypto.getRandomValues gives high-quality random numbers. Fisher-Yates gives every
// order an equal chance. A new order is made each time shuffle starts or a pass ends.
// ============================================================
function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffledWithFirst(list, firstId) {
  const rest = shuffle(list.filter((id) => id !== firstId));
  return list.includes(firstId) ? [firstId, ...rest] : rest;
}

function reshuffleAfterPass(list, lastId) {
  const o = shuffle(list);
  if (o.length > 1 && o[0] === lastId) [o[0], o[1]] = [o[1], o[0]];
  return o;
}

// ============================================================
// Metadata from the file
// ============================================================
function readTags(file) {
  return new Promise((resolve) => {
    if (!window.jsmediatags) return resolve(null);
    window.jsmediatags.read(file, {
      onSuccess: (result) => resolve(result.tags),
      onError: () => resolve(null),
    });
  });
}

function pictureToBlob(picture) {
  const mime = picture.format && picture.format.includes('/') ? picture.format : 'image/jpeg';
  return new Blob([new Uint8Array(picture.data)], { type: mime });
}

// ============================================================
// Cover art, loaded from storage the first time it's shown
// ============================================================
function getArtUrl(track) {
  if (track.artUrl) return Promise.resolve(track.artUrl);
  if (!track.hasArt) return Promise.resolve(null);

  if (!artPending.has(track.id)) {
    const job = dbGet('art', track.id)
      .then((rec) => {
        if (rec && rec.blob) track.artUrl = URL.createObjectURL(rec.blob);
        return track.artUrl || null;
      })
      .catch(() => null)
      .finally(() => artPending.delete(track.id));
    artPending.set(track.id, job);
  }
  return artPending.get(track.id);
}

// The color tile shows first, and the cover replaces it once loaded. The dataset check
// stops a slow image from landing in a tile that now shows a different song.
function fillArt(el, track) {
  el.dataset.artFor = track.id;
  el.style.background = gradientCss(track.hue);
  el.innerHTML = ICON.note;
  if (!track.hasArt) return;

  const show = (url) => {
    if (!url || el.dataset.artFor !== track.id) return;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = url;
    el.style.background = '';
    el.replaceChildren(img);
  };

  if (track.artUrl) show(track.artUrl);
  else getArtUrl(track).then(show);
}

// ============================================================
// Player colors from the cover art
// ============================================================
function fallbackPalette(hue) {
  return [`hsl(${hue} 55% 30%)`, `hsl(${hue} 70% 12%)`];
}

function shade(r, g, b, amount) {
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

function extractPalette(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const d = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const weight = 1 + ((mx - mn) / 255) * 2;
          r += d[i] * weight;
          g += d[i + 1] * weight;
          b += d[i + 2] * weight;
          w += weight;
        }
        r /= w; g /= w; b /= w;
        resolve([shade(r, g, b, 0.35), shade(r, g, b, 0.8)]);
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function applyPalette(track) {
  if (!track.palette) {
    const url = await getArtUrl(track);
    track.palette = (url && (await extractPalette(url))) || fallbackPalette(track.hue);
  }
  if (currentId !== track.id) return;
  fullPlayer.style.setProperty('--p1', track.palette[0]);
  fullPlayer.style.setProperty('--p2', track.palette[1]);
  if (fullPlayer.classList.contains('open')) setTopColor(track.palette[0]);
}

// ============================================================
// Storage (IndexedDB), split so the library list loads fast
//   songs  small details     files  audio     art  covers     playlists
// ============================================================
function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('glass-music', 3);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('art')) d.createObjectStore('art', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbRun(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = action(tx.objectStore(storeName));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function dbGet(storeName, key) {
  return dbRun(storeName, 'readonly', (s) => s.get(key));
}

function saveSong(meta, fileBlob, artBlob) {
  return new Promise((resolve, reject) => {
    const stores = ['songs'];
    if (fileBlob) stores.push('files');
    if (artBlob) stores.push('art');

    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('songs').put(meta);
    if (fileBlob) tx.objectStore('files').put({ id: meta.id, blob: fileBlob });
    if (artBlob) tx.objectStore('art').put({ id: meta.id, blob: artBlob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteSongRecords(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'files', 'art'], 'readwrite');
    tx.objectStore('songs').delete(id);
    tx.objectStore('files').delete(id);
    tx.objectStore('art').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// The search text is built once here, so searching doesn't lowercase every title each time
function toTrack(rec) {
  const title = cleanText(rec.title);
  const album = cleanText(rec.album);
  const artist = cleanText(rec.artist);
  const hasArt = rec.hasArt !== undefined ? !!rec.hasArt : !!(rec.artBlob || rec.art);

  return {
    id: rec.id,
    title,
    album,
    artist,
    format: rec.format || '',
    addedAt: rec.addedAt || 0,
    hasArt,
    hue: hashHue(title),
    search: `${title} ${album} ${artist}`.toLowerCase(),
    file: null,
    url: null,
    artUrl: null,
    failed: false,
    palette: null,
    sessionArt: null,
  };
}

function addTrack(track) {
  tracks.push(track);
  trackMap.set(track.id, track);
}

async function fileUrlFor(track) {
  if (track.url) return track.url;

  let blob = track.file;
  if (!blob) {
    const rec = await dbGet('files', track.id);
    blob = rec ? rec.blob : null;
  }
  if (!blob) {
    // Songs saved by the oldest version keep their file inside the song record
    const legacy = await dbGet('songs', track.id);
    blob = legacy && legacy.file;
  }
  if (!blob) throw new Error('File not found');

  track.url = URL.createObjectURL(blob);
  return track.url;
}

// ============================================================
// Adding songs
// ============================================================
function openPicker() {
  fileInput.click();
}

$('add-btn').addEventListener('click', openPicker);
$('empty-add').addEventListener('click', openPicker);

// Warns when the chosen files are unlikely to fit in the space the browser allows
async function hasRoomFor(bytes) {
  if (!navigator.storage || !navigator.storage.estimate) return true;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return true;
    return bytes < (quota - usage) * 0.9; // A margin, because the browser needs room too
  } catch (err) {
    return true;
  }
}

async function handleFiles() {
  const files = Array.from(fileInput.files);
  fileInput.value = '';
  if (!files.length) return;

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (!(await hasRoomFor(total))) {
    openSheet({
      title: 'Not enough space',
      message: `These songs need about ${formatSize(total)}, which is more than your phone has free for this app. Try adding fewer songs, or remove some first.`,
      actions: [{ label: 'Add them anyway', onClick: () => importFiles(files) }],
    });
    return;
  }
  importFiles(files);
}

async function importFiles(files) {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const ext = getExtension(file.name);
    if (!SUPPORTED.has(ext)) {
      skipped++;
      continue;
    }

    const tags = await readTags(file);
    const artBlob = tags && tags.picture ? pictureToBlob(tags.picture) : null;
    const meta = {
      id: newId(),
      title: (tags && tags.title) || file.name.replace(/\.[^.]+$/, ''),
      album: (tags && tags.album) || '',
      artist: (tags && tags.artist) || '',
      format: ext.toUpperCase(),
      addedAt: Date.now() + added,
      hasArt: !!artBlob,
      tagsRead: true,
    };

    try {
      await saveSong(meta, file, artBlob);
    } catch (err) {
      failed++; // Usually storage is full. The song still plays for this visit
    }

    const track = toTrack(meta);
    track.file = file;
    if (artBlob) track.artUrl = URL.createObjectURL(artBlob);
    addTrack(track);
    added++;
  }

  renderMain();
  updateStorageInfo();

  const parts = [];
  if (added) parts.push(`Added ${plural(added, 'song')}`);
  if (skipped) parts.push(`${skipped} skipped (unsupported format)`);
  if (failed) parts.push(`${failed} could not be saved (storage full)`);
  if (parts.length) showToast(parts.join('. ') + '.');
}

fileInput.addEventListener('change', handleFiles);

// Moves songs saved by older versions into the split layout. Runs once, in the background.
async function migrateLegacy(records) {
  let changed = false;

  for (const rec of records) {
    const isLegacy = rec.file !== undefined || rec.artBlob !== undefined || typeof rec.art === 'string';
    if (!isLegacy) continue;

    let title = rec.title;
    let album = rec.album || '';
    let artist = rec.artist || '';
    let artBlob = rec.artBlob || null;

    if (rec.file && !rec.tagsRead && window.jsmediatags) {
      const tags = await readTags(rec.file);
      if (tags) {
        title = tags.title || title;
        album = tags.album || '';
        artist = tags.artist || '';
        if (tags.picture) artBlob = pictureToBlob(tags.picture);
      }
    }

    if (!artBlob && typeof rec.art === 'string') {
      try {
        artBlob = await (await fetch(rec.art)).blob();
      } catch (err) {
        artBlob = null;
      }
    }

    const meta = {
      id: rec.id,
      title,
      album,
      artist,
      format: rec.format || '',
      addedAt: rec.addedAt || 0,
      hasArt: !!artBlob,
      tagsRead: true,
    };

    try {
      await saveSong(meta, rec.file || null, artBlob);
    } catch (err) {
      continue;
    }

    const live = byId(rec.id);
    if (live) {
      const fresh = toTrack(meta);
      if (live.artUrl) URL.revokeObjectURL(live.artUrl);
      Object.assign(live, fresh, { url: live.url, file: live.file, failed: live.failed });
      changed = true;
    }
  }

  if (changed) {
    renderMain();
    if (currentId) updateNowPlayingUI();
    updateStorageInfo();
  }
}

// ============================================================
// Storage usage shown under the title
// ============================================================
async function updateStorageInfo() {
  storageText = '';
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage } = await navigator.storage.estimate();
      if (usage) storageText = `${formatSize(usage)} used`;
    } catch (err) {
      // Not available in this browser
    }
  }
  if (view === 'library') updateCount();
}

// ============================================================
// Favorites and recently played
// ============================================================
function isFavorite(id) {
  return favorites.has(id);
}

function toggleFavorite(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
    showToast('Removed from Favorites');
  } else {
    favorites.add(id);
    showToast('Added to Favorites');
  }
  writeStored(FAV_KEY, [...favorites]);
  updateFavButton();
  renderMain();
}

function updateFavButton() {
  const on = currentId ? isFavorite(currentId) : false;
  const btn = $('fav-btn');
  btn.innerHTML = on ? ICON.heartFull : ICON.heart;
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
}

function noteRecentlyPlayed(id) {
  recent = [id, ...recent.filter((x) => x !== id)].slice(0, RECENT_MAX);
  writeStored(RECENT_KEY, recent);
}

// ============================================================
// Sleep timer
// ============================================================
function clearSleepTimer(quiet = false) {
  clearTimeout(sleepTimer);
  clearInterval(sleepTick);
  sleepTimer = null;
  sleepTick = null;
  sleepEndsAt = 0;
  sleepAtTrackEnd = false;
  updateSleepUI();
  if (!quiet) showToast('Sleep timer off');
}

function startSleepTimer(minutes) {
  clearSleepTimer(true);
  sleepEndsAt = Date.now() + minutes * 60000;
  sleepTimer = setTimeout(sleepNow, minutes * 60000);
  sleepTick = setInterval(updateSleepUI, 20000); // Refreshes the "in 24 min" text
  updateSleepUI();
  showToast(`Music stops in ${minutes} minutes`);
}

function startSleepAtTrackEnd() {
  clearSleepTimer(true);
  sleepAtTrackEnd = true;
  updateSleepUI();
  showToast('Music stops when this song ends');
}

function sleepNow() {
  wantPlaying = false;
  audio.pause();
  clearSleepTimer(true);
  showToast('Sleep timer finished');
}

function updateSleepUI() {
  const btn = $('sleep-btn');
  const status = $('sleep-status');
  const active = sleepAtTrackEnd || sleepEndsAt > Date.now();

  btn.classList.toggle('on', active);

  if (!active) {
    status.hidden = true;
    return;
  }

  status.hidden = false;
  if (sleepAtTrackEnd) {
    status.textContent = 'Stopping when this song ends';
  } else {
    const mins = Math.max(1, Math.round((sleepEndsAt - Date.now()) / 60000));
    status.textContent = `Stopping in ${plural(mins, 'minute')}`;
  }
}

function openSleepSheet() {
  const active = sleepAtTrackEnd || sleepEndsAt > Date.now();
  const actions = [15, 30, 45, 60].map((m) => ({
    label: `${m} minutes`,
    onClick: () => startSleepTimer(m),
  }));
  actions.push({ label: 'When this song ends', onClick: startSleepAtTrackEnd });
  if (active) actions.push({ label: 'Turn off timer', danger: true, onClick: () => clearSleepTimer() });

  openSheet({ title: 'Sleep Timer', message: 'Music stops automatically.', actions });
}

// ============================================================
// Background playback help
// iOS blocks a web app from starting audio while it is in the background. Two things help:
// 1. Both players are unlocked by the first tap, so neither needs fresh permission later.
// 2. A silent tone keeps the app registered as actively playing between songs.
// Neither is guaranteed. They are workarounds for a limitation in Safari itself.
// ============================================================
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  for (const el of [audioA, audioB]) {
    if (el.getAttribute('src')) continue; // Don't disturb a player that already has a song
    el.src = SILENT_WAV;
    const p = el.play();
    if (p && p.then) {
      p.then(() => {
        el.pause();
        if (el.getAttribute('src') === SILENT_WAV) {
          el.removeAttribute('src');
          el.load();
        }
      }).catch(() => {
        if (el.getAttribute('src') === SILENT_WAV) el.removeAttribute('src');
      });
    }
  }
}

function startKeepAlive() {
  try {
    if (!keepAliveCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      keepAliveCtx = new Ctx();

      const osc = keepAliveCtx.createOscillator();
      const gain = keepAliveCtx.createGain();
      osc.frequency.value = 30;        // Below what people can hear
      gain.gain.value = 0.0001;        // Near silence, but not zero, so it counts as output
      osc.connect(gain).connect(keepAliveCtx.destination);
      osc.start();
    }
    if (keepAliveCtx.state === 'suspended') keepAliveCtx.resume();
  } catch (err) {
    // Not supported here. Playback still works as before
  }
}

function pauseKeepAlive() {
  // Suspended while paused, so it uses no battery when you aren't listening
  if (keepAliveCtx && keepAliveCtx.state === 'running') keepAliveCtx.suspend().catch(() => {});
}

// The first touch unlocks both players, before any button handler runs
['pointerdown', 'touchstart'].forEach((ev) => {
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
});

// ============================================================
// Tabs and navigation
// ============================================================
function setTab(tab) {
  activeTab = tab;
  view = tab;
  viewPlaylistId = null;
  viewAlbum = null;
  if (tab !== 'search') {
    searchQuery = '';
    searchEl.value = '';
  }
  renderMain();
  window.scrollTo(0, 0);
  if (tab === 'search') searchEl.focus();
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    haptic();
    setTab(btn.dataset.tab);
  });
});

function openPlaylist(id) {
  view = 'playlist';
  viewPlaylistId = id;
  viewAlbum = null;
  renderMain();
  window.scrollTo(0, 0);
}

function openAlbum(name) {
  view = 'album';
  viewAlbum = name;
  viewPlaylistId = null;
  renderMain();
  window.scrollTo(0, 0);
}

onTap('back-btn', () => {
  view = view === 'album' ? 'movies' : 'playlists';
  activeTab = view;
  viewPlaylistId = null;
  viewAlbum = null;
  renderMain();
});

let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchEl.value;
    renderMain();
  }, 120);
});

// ============================================================
// Refresh and update notice
// ============================================================
async function refreshApp() {
  saveState(true);
  $('refresh-icon').classList.add('spin');
  showToast('Checking for updates…');

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    }
  } catch (err) {
    // A failed check still reloads below
  }
  location.reload();
}

$('title-btn').addEventListener('click', () => {
  if (view === 'library') {
    haptic();
    refreshApp();
  }
});

$('update-banner').addEventListener('click', () => {
  haptic();
  refreshApp();
});

// ============================================================
// Sorting
// ============================================================
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Empty text (no artist or movie tag) sorts last, so real names come first
function compareText(x, y) {
  if (!x && y) return 1;
  if (x && !y) return -1;
  return nameCollator.compare(x, y);
}

const SORT_MODES = {
  name:   { label: 'Name',           cmp: (a, b) => compareText(a.title, b.title) },
  artist: { label: 'Artist',         cmp: (a, b) => compareText(a.artist, b.artist) || compareText(a.title, b.title) },
  movie:  { label: 'Movie',          cmp: (a, b) => compareText(a.album, b.album) || compareText(a.title, b.title) },
  added:  { label: 'Recently added', cmp: (a, b) => b.addedAt - a.addedAt },
};

function sortedTracks(list) {
  return list.slice().sort(SORT_MODES[sortMode].cmp);
}

function setSortMode(key) {
  if (!SORT_MODES[key]) return;
  sortMode = key;
  writeStored(SORT_KEY, key);
  renderMain();
}

function openSortSheet() {
  openSheet({
    title: 'Sort Songs',
    actions: Object.entries(SORT_MODES).map(([key, mode]) => ({
      label: (key === sortMode ? '✓  ' : '      ') + mode.label,
      onClick: () => setSortMode(key),
    })),
  });
}

onTap('sort-btn', openSortSheet);

// ============================================================
// Which songs each screen shows
// ============================================================
function playlistById(id) {
  return playlists.find((p) => p.id === id) || null;
}

function currentListIds() {
  if (view === 'library') return sortedTracks(tracks).map((t) => t.id);

  if (view === 'search') {
    const q = searchQuery.trim().toLowerCase();
    const sorted = sortedTracks(tracks);
    if (!q) return sorted.map((t) => t.id);
    return sorted.filter((t) => t.search.includes(q)).map((t) => t.id);
  }

  if (view === 'album') {
    return sortedTracks(tracks.filter((t) => albumOf(t) === viewAlbum)).map((t) => t.id);
  }

  if (view === 'playlist') {
    if (viewPlaylistId === FAV_ID) {
      return sortedTracks(tracks.filter((t) => favorites.has(t.id))).map((t) => t.id);
    }
    if (viewPlaylistId === RECENT_ID) {
      return recent.filter((id) => trackMap.has(id)); // Kept in play order, newest first
    }
    const p = playlistById(viewPlaylistId);
    return p ? p.trackIds.filter((id) => trackMap.has(id)) : [];
  }

  return [];
}

// Groups songs by movie for the Movies tab
function albumGroups() {
  const map = new Map();
  for (const t of tracks) {
    const key = albumOf(t);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return [...map.entries()].sort((a, b) => compareText(a[0], b[0]));
}

function currentListTitle() {
  if (view === 'album') return viewAlbum;
  if (view === 'playlist') {
    if (viewPlaylistId === FAV_ID) return 'Favorites';
    if (viewPlaylistId === RECENT_ID) return 'Recently Played';
    const p = playlistById(viewPlaylistId);
    return p ? p.name : 'Playlist';
  }
  return { library: 'Library', search: 'Search', playlists: 'Playlists', movies: 'Movies' }[view];
}

// ============================================================
// Main screen rendering
// ============================================================
function updateCount() {
  if (view === 'playlists') {
    countEl.textContent = plural(playlists.length + 2, 'list'); // +2 for Favorites and Recently Played
    return;
  }
  if (view === 'movies') {
    countEl.textContent = plural(albumGroups().length, 'movie');
    return;
  }
  const n = view === 'library' ? tracks.length : currentListIds().length;
  let text = plural(n, 'song');
  if (view === 'library' && storageText) text += ` · ${storageText}`;
  countEl.textContent = text;
}

function renderMain() {
  // A playlist can be deleted while it's open
  if (view === 'playlist' && viewPlaylistId !== FAV_ID && viewPlaylistId !== RECENT_ID && !playlistById(viewPlaylistId)) {
    view = 'playlists';
    activeTab = 'playlists';
  }

  const isPlaylists = view === 'playlists';
  const isMovies = view === 'movies';
  const isLibrary = view === 'library';
  const isSearch = view === 'search';
  const isDetail = view === 'playlist' || view === 'album';
  const isUserPlaylist = view === 'playlist' && !!playlistById(viewPlaylistId);
  const showsGroups = isPlaylists || isMovies;

  pageTitle.textContent = currentListTitle();

  // The refresh icon only appears on the Library tab
  $('refresh-icon').hidden = !isLibrary;
  $('title-btn').disabled = !isLibrary;

  $('back-btn').hidden = !isDetail;
  $('sort-btn').hidden = !(isLibrary || isSearch || view === 'album');
  $('add-btn').hidden = !isLibrary;
  $('menu-btn').hidden = !isLibrary;
  $('new-playlist-btn').hidden = !isPlaylists;

  searchEl.hidden = !isSearch;
  groupList.hidden = !showsGroups;
  trackList.hidden = showsGroups;
  emptyBox.hidden = !(isLibrary && tracks.length === 0);

  // Shuffle and Play All appear on any list of songs that has more than one
  const ids = showsGroups ? [] : currentListIds();
  $('list-tools').hidden = showsGroups || ids.length < 2;
  $('list-more').hidden = !isUserPlaylist;

  if (showsGroups) {
    if (isPlaylists) renderPlaylists();
    else renderAlbums();
  } else {
    renderTracks(ids, view);
  }

  updateCount();

  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === activeTab);
  });

  if (queueOpen) renderQueue();
}

// Builds one row in the Playlists or Movies list
function buildGroupRow({ name, count, iconHtml, hue, artTrack, onOpen }) {
  const row = document.createElement('li');
  row.className = 'track-row';

  const art = document.createElement('div');
  art.className = 'art row';
  if (artTrack) {
    fillArt(art, artTrack);
  } else {
    art.style.background = gradientCss(hue);
    art.innerHTML = iconHtml;
  }

  const text = document.createElement('div');
  text.className = 'track-text';

  const title = document.createElement('div');
  title.className = 'track-title';
  title.textContent = name;

  const sub = document.createElement('div');
  sub.className = 'track-sub';
  sub.textContent = plural(count, 'song');

  text.append(title, sub);
  row.append(art, text);
  row.addEventListener('click', () => {
    haptic();
    onOpen();
  });
  return row;
}

function renderPlaylists() {
  const frag = document.createDocumentFragment();

  // Two built-in lists always sit at the top
  frag.append(buildGroupRow({
    name: 'Favorites',
    count: [...favorites].filter((id) => trackMap.has(id)).length,
    iconHtml: ICON.heartFull,
    hue: 350,
    onOpen: () => openPlaylist(FAV_ID),
  }));

  frag.append(buildGroupRow({
    name: 'Recently Played',
    count: recent.filter((id) => trackMap.has(id)).length,
    iconHtml: ICON.clock,
    hue: 210,
    onOpen: () => openPlaylist(RECENT_ID),
  }));

  for (const p of playlists) {
    frag.append(buildGroupRow({
      name: p.name,
      count: p.trackIds.filter((id) => trackMap.has(id)).length,
      iconHtml: ICON.playlist,
      hue: hashHue(p.name),
      onOpen: () => openPlaylist(p.id),
    }));
  }

  groupList.replaceChildren(frag);
}

function renderAlbums() {
  const groups = albumGroups();
  const frag = document.createDocumentFragment();

  if (!groups.length) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'No songs yet. Add songs on the Songs tab.';
    frag.append(none);
  }

  for (const [name, list] of groups) {
    frag.append(buildGroupRow({
      name,
      count: list.length,
      iconHtml: ICON.movie,
      hue: hashHue(name),
      artTrack: list.find((t) => t.hasArt) || null, // Uses the first cover in the movie
      onOpen: () => openAlbum(name),
    }));
  }

  groupList.replaceChildren(frag);
}

function buildTrackRow(track, ids, context) {
  const row = document.createElement('li');
  row.className = 'track-row';
  row.dataset.id = track.id;
  if (track.id === currentId) row.classList.add('playing');
  if (track.failed) row.classList.add('failed');

  const art = document.createElement('div');
  art.className = 'art row';
  fillArt(art, track);

  const text = document.createElement('div');
  text.className = 'track-text';

  const title = document.createElement('div');
  title.className = 'track-title';
  title.textContent = track.title;

  const sub = document.createElement('div');
  sub.className = 'track-sub';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = track.format;

  const label = document.createElement('span');
  label.className = 'sub-label';
  label.textContent = track.failed ? "Can't play on this device" : subtitleFor(track);

  sub.append(badge, label);
  text.append(title, sub);

  if (isFavorite(track.id)) {
    const heart = document.createElement('span');
    heart.className = 'row-heart';
    heart.innerHTML = ICON.heartFull;
    sub.append(heart);
  }

  const more = document.createElement('button');
  more.className = 'more-btn';
  more.setAttribute('aria-label', 'Song options');
  more.innerHTML = ICON.more;
  more.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't also start playback
    haptic();
    openSongOptions(track.id, context);
  });

  row.append(art, text, more);
  row.addEventListener('click', () => {
    haptic();
    startQueue(ids, track.id);
  });

  addSwipeToDelete(row, track.id);
  return row;
}

// ============================================================
// Swipe left on a row to remove the song
// Only horizontal drags count, so scrolling the list still works normally
// ============================================================
function addSwipeToDelete(row, id) {
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let decided = false;

  row.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = false;
    decided = false;
    row.classList.add('no-anim');
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Decide once whether this gesture is a sideways swipe or a normal scroll
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy);
    }
    if (!dragging) return;

    const shift = Math.min(0, dx); // Left only
    row.style.transform = `translateX(${Math.max(shift, -140)}px)`;
    row.classList.toggle('will-delete', shift < -80);
  }, { passive: true });

  const finish = (e) => {
    row.classList.remove('no-anim');
    if (!dragging) return;

    const dx = (e.changedTouches ? e.changedTouches[0].clientX : startX) - startX;
    row.style.transform = '';
    row.classList.remove('will-delete');
    dragging = false;

    if (dx < -80) {
      haptic();
      confirmRemove(id);
    }
  };

  row.addEventListener('touchend', finish);
  row.addEventListener('touchcancel', finish);
}

// ============================================================
// Virtual song list: only rows near the screen exist in the page
// ============================================================
function columnsFor(width) {
  if (!window.matchMedia('(min-width: 720px)').matches) return 1;
  return Math.max(1, Math.floor((width + GRID_GAP) / (GRID_MIN + GRID_GAP)));
}

function clearVirtualRows() {
  for (const el of virt.els.values()) el.remove();
  virt.els.clear();
  rowById.clear();
}

function placeRow(el, row, col) {
  const colGap = GRID_GAP * (virt.cols - 1);
  el.style.top = `${row * ROW_PITCH}px`;
  el.style.width = `calc((100% - ${colGap}px) / ${virt.cols})`;
  el.style.left = `calc(${col} * ((100% - ${colGap}px) / ${virt.cols} + ${GRID_GAP}px))`;
}

function emptyListMessage(context) {
  if (context === 'playlist') {
    if (viewPlaylistId === FAV_ID) return 'No favorites yet. Open a song and tap the heart.';
    if (viewPlaylistId === RECENT_ID) return 'Nothing played yet.';
    return 'This playlist is empty. Tap ⋯ on a song and choose Add to Playlist.';
  }
  if (context === 'search' && tracks.length) return 'No matching songs';
  return '';
}

function renderTracks(ids, context) {
  clearVirtualRows();
  virt.ids = ids;
  virt.context = context;

  if (ids.length === 0) {
    trackList.classList.remove('virtual');
    trackList.style.height = '';

    const msg = emptyListMessage(context);
    if (msg) {
      const none = document.createElement('li');
      none.className = 'no-match';
      none.textContent = msg;
      trackList.replaceChildren(none);
    } else {
      trackList.replaceChildren();
    }
    return;
  }

  trackList.classList.add('virtual');
  virt.cols = columnsFor(trackList.clientWidth);
  virt.rows = Math.ceil(ids.length / virt.cols);
  trackList.style.height = `${virt.rows * ROW_PITCH}px`;
  renderVisibleRows();
}

function renderVisibleRows() {
  if (!virt.ids.length || trackList.hidden) return;

  const listTop = trackList.getBoundingClientRect().top + window.scrollY;
  const rel = Math.max(0, window.scrollY - listTop);

  // A few rows above and below the screen, so fast scrolling leaves no gaps
  const firstRow = Math.max(0, Math.floor(rel / ROW_PITCH) - 3);
  const lastRow = Math.min(virt.rows - 1, Math.floor((rel + window.innerHeight) / ROW_PITCH) + 3);

  for (const [idx, el] of virt.els) {
    const row = Math.floor(idx / virt.cols);
    if (row < firstRow || row > lastRow) {
      el.remove();
      virt.els.delete(idx);
      if (rowById.get(el.dataset.id) === el) rowById.delete(el.dataset.id);
    }
  }

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = 0; col < virt.cols; col++) {
      const idx = row * virt.cols + col;
      if (idx >= virt.ids.length || virt.els.has(idx)) continue;

      const track = byId(virt.ids[idx]);
      if (!track) continue;

      const el = buildTrackRow(track, virt.ids, virt.context);
      placeRow(el, row, col);
      virt.els.set(idx, el);
      rowById.set(track.id, el);
      trackList.append(el);
    }
  }
}

function scheduleVirtualRender() {
  if (virt.frame) return;
  virt.frame = requestAnimationFrame(() => {
    virt.frame = 0;
    renderVisibleRows();
  });
}

window.addEventListener('scroll', scheduleVirtualRender, { passive: true });
window.addEventListener('resize', () => {
  if (!virt.ids.length || trackList.hidden) return;
  if (columnsFor(trackList.clientWidth) !== virt.cols) renderTracks(virt.ids, virt.context);
  else scheduleVirtualRender();
});

function highlightRow(prevId, nextId) {
  if (prevId) {
    const row = rowById.get(prevId);
    if (row) row.classList.remove('playing');
  }
  if (nextId) {
    const row = rowById.get(nextId);
    if (row) row.classList.add('playing');
  }
}

function markFailedRow(id) {
  const row = rowById.get(id);
  if (!row) return;
  row.classList.add('failed');
  const label = row.querySelector('.sub-label');
  if (label) label.textContent = "Can't play on this device";
}

// ============================================================
// Action sheet
// ============================================================
function openSheet({ title, message = '', actions = [], input = null }) {
  const sheet = $('sheet');

  const card = document.createElement('div');
  card.className = 'sheet-card';

  const h = document.createElement('h3');
  h.textContent = title;
  card.append(h);

  if (message) {
    const p = document.createElement('p');
    p.className = 'sheet-msg';
    p.textContent = message;
    card.append(p);
  }

  let field = null;
  if (input) {
    field = document.createElement('input');
    field.className = 'sheet-input';
    field.placeholder = input.placeholder || '';
    field.value = input.value || '';
    field.maxLength = 60;
    card.append(field);
  }

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn' + (action.primary ? ' primary' : '') + (action.danger ? ' danger' : '');
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      haptic();
      const value = field ? field.value.trim() : undefined;
      closeSheet();
      action.onClick(value);
    });
    card.append(btn);
  }

  const cancel = document.createElement('button');
  cancel.className = 'sheet-btn cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', closeSheet);
  card.append(cancel);

  sheet.replaceChildren(card);
  sheet.hidden = false;
  sheet.onclick = (e) => { if (e.target === sheet) closeSheet(); };
  lockScroll();
  if (field) setTimeout(() => field.focus(), 60);
}

function closeSheet() {
  const sheet = $('sheet');
  sheet.hidden = true;
  sheet.replaceChildren();
  lockScroll();
}

function openSongOptions(id, context) {
  const track = byId(id);
  if (!track) return;

  const fav = isFavorite(id);
  const actions = [
    { label: fav ? 'Remove from Favorites' : 'Add to Favorites', onClick: () => toggleFavorite(id) },
    { label: 'Add to Playlist', onClick: () => openChoosePlaylist(id) },
    { label: 'Play Next', onClick: () => playNext(id) },
  ];

  if (context === 'playlist' && playlistById(viewPlaylistId)) {
    actions.push({ label: 'Remove from This Playlist', onClick: () => removeFromPlaylist(viewPlaylistId, id) });
  }
  actions.push({ label: 'Remove from Library', danger: true, onClick: () => confirmRemove(id) });

  openSheet({ title: track.title, message: subtitleFor(track), actions });
}

function confirmRemove(id) {
  const track = byId(id);
  if (!track) return;
  openSheet({
    title: 'Remove this song?',
    message: `"${track.title}" will be removed from your library and all playlists. The original file on your phone is not affected.`,
    actions: [{ label: 'Remove', danger: true, onClick: () => removeTrack(id) }],
  });
}

function openChoosePlaylist(trackId) {
  const actions = playlists.map((p) => ({ label: p.name, onClick: () => addToPlaylist(p.id, trackId) }));
  actions.push({ label: 'New Playlist…', onClick: () => openNewPlaylist(trackId) });
  openSheet({
    title: 'Add to Playlist',
    message: playlists.length ? '' : 'You have no playlists yet.',
    actions,
  });
}

function openNewPlaylist(trackId) {
  openSheet({
    title: 'New Playlist',
    input: { placeholder: 'Playlist name' },
    actions: [{
      label: 'Create',
      primary: true,
      onClick: async (name) => {
        if (!name) return;
        const p = await createPlaylist(name);
        if (trackId) await addToPlaylist(p.id, trackId);
      },
    }],
  });
}

function openPlaylistOptions() {
  const p = playlistById(viewPlaylistId);
  if (!p) return;
  openSheet({
    title: p.name,
    actions: [
      { label: 'Rename Playlist', onClick: () => openRenamePlaylist(p) },
      { label: 'Delete Playlist', danger: true, onClick: () => deletePlaylist(p) },
    ],
  });
}

function openRenamePlaylist(p) {
  openSheet({
    title: 'Rename Playlist',
    input: { placeholder: 'Playlist name', value: p.name },
    actions: [{ label: 'Save', primary: true, onClick: (name) => renamePlaylist(p, name) }],
  });
}

// The ⋯ menu in the Library header
function openMainMenu() {
  openSheet({
    title: 'Library',
    message: storageText ? `${plural(tracks.length, 'song')} · ${storageText}` : plural(tracks.length, 'song'),
    actions: [
      { label: 'Sleep Timer', onClick: openSleepSheet },
      { label: 'Back Up Playlists', onClick: exportBackup },
      { label: 'Restore From Backup', onClick: () => importInput.click() },
    ],
  });
}

onTap('menu-btn', openMainMenu);

// ============================================================
// Playlists
// ============================================================
async function persistPlaylist(p) {
  try {
    await dbRun('playlists', 'readwrite', (s) => s.put(p));
  } catch (err) {
    // The playlist still works for this visit
  }
}

async function createPlaylist(name) {
  const p = { id: newId(), name, trackIds: [], createdAt: Date.now() };
  playlists.push(p);
  await persistPlaylist(p);
  renderMain();
  return p;
}

async function addToPlaylist(playlistId, trackId) {
  const p = playlistById(playlistId);
  if (!p) return;
  if (p.trackIds.includes(trackId)) {
    showToast(`Already in "${p.name}"`);
    return;
  }
  p.trackIds.push(trackId);
  await persistPlaylist(p);
  showToast(`Added to "${p.name}"`);
  renderMain();
}

async function removeFromPlaylist(playlistId, trackId) {
  const p = playlistById(playlistId);
  if (!p) return;
  p.trackIds = p.trackIds.filter((id) => id !== trackId);
  await persistPlaylist(p);
  showToast(`Removed from "${p.name}"`);
  renderMain();
}

async function renamePlaylist(p, name) {
  if (!name) return;
  p.name = name;
  await persistPlaylist(p);
  renderMain();
}

async function deletePlaylist(p) {
  playlists = playlists.filter((x) => x.id !== p.id);
  try {
    await dbRun('playlists', 'readwrite', (s) => s.delete(p.id));
  } catch (err) {
    // Already gone from this visit
  }
  view = 'playlists';
  activeTab = 'playlists';
  viewPlaylistId = null;
  showToast(`Deleted "${p.name}"`);
  renderMain();
}

onTap('list-shuffle', () => {
  const ids = currentListIds();
  if (!ids.length) return;
  shuffleOn = true;
  setShuffleState();
  startQueue(ids, ids[randomInt(ids.length)]);
});

onTap('list-play', () => {
  const ids = currentListIds();
  if (!ids.length) return;
  shuffleOn = false;
  setShuffleState();
  startQueue(ids, ids[0]);
});

onTap('list-more', openPlaylistOptions);
onTap('new-playlist-btn', () => openNewPlaylist(null));

// ============================================================
// Backup and restore
// Only the song list, playlists and favorites are saved, not the audio files,
// which would make the backup hundreds of megabytes.
// ============================================================
function exportBackup() {
  const data = {
    app: 'glass-music',
    version: 1,
    exportedAt: new Date().toISOString(),
    sortMode,
    songs: tracks.map((t) => ({
      id: t.id, title: t.title, album: t.album, artist: t.artist, format: t.format, addedAt: t.addedAt,
    })),
    playlists: playlists.map((p) => ({
      id: p.id, name: p.name, trackIds: p.trackIds.slice(), createdAt: p.createdAt,
    })),
    favorites: [...favorites],
    recent: recent.slice(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `music-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  showToast('Backup saved. Keep it in Files or iCloud.');
}

importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  importInput.value = '';
  if (!file) return;

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    showToast("That file isn't a valid backup.");
    return;
  }

  if (!data || data.app !== 'glass-music' || !Array.isArray(data.songs)) {
    showToast("That file isn't a backup from this app.");
    return;
  }

  openSheet({
    title: 'Restore backup?',
    message: `This backup holds ${plural(data.playlists ? data.playlists.length : 0, 'playlist')} and ${plural(data.favorites ? data.favorites.length : 0, 'favorite')}. Your current playlists will be replaced. Songs are matched by name, so add your music first.`,
    actions: [{ label: 'Restore', primary: true, onClick: () => applyBackup(data) }],
  });
});

// Matches saved songs to the songs in the library: by id first, then by title and format,
// then by title alone. Songs re-added after a reset get new ids, so name matching is needed.
function buildIdMap(savedSongs) {
  const map = new Map();
  const byTitleFormat = new Map();
  const byTitle = new Map();

  for (const t of tracks) {
    byTitleFormat.set(`${t.title.toLowerCase()}|${t.format}`, t.id);
    if (!byTitle.has(t.title.toLowerCase())) byTitle.set(t.title.toLowerCase(), t.id);
  }

  for (const s of savedSongs) {
    const title = cleanText(s.title || '').toLowerCase();
    const local = trackMap.has(s.id)
      ? s.id
      : byTitleFormat.get(`${title}|${s.format}`) || byTitle.get(title);
    if (local) map.set(s.id, local);
  }
  return map;
}

async function applyBackup(data) {
  const idMap = buildIdMap(data.songs);
  const toLocal = (id) => idMap.get(id) || (trackMap.has(id) ? id : null);

  // Replace playlists with the saved ones
  const oldIds = playlists.map((p) => p.id);
  playlists = (data.playlists || []).map((p) => ({
    id: p.id || newId(),
    name: p.name || 'Playlist',
    trackIds: (p.trackIds || []).map(toLocal).filter(Boolean),
    createdAt: p.createdAt || Date.now(),
  }));

  try {
    await Promise.all(oldIds.map((id) => dbRun('playlists', 'readwrite', (s) => s.delete(id))));
    await Promise.all(playlists.map(persistPlaylist));
  } catch (err) {
    // The restored lists still work for this visit
  }

  favorites = new Set((data.favorites || []).map(toLocal).filter(Boolean));
  writeStored(FAV_KEY, [...favorites]);

  recent = (data.recent || []).map(toLocal).filter(Boolean).slice(0, RECENT_MAX);
  writeStored(RECENT_KEY, recent);

  if (data.sortMode && SORT_MODES[data.sortMode]) setSortMode(data.sortMode);

  const matched = [...idMap.values()].length;
  showToast(`Restored. ${matched} of ${data.songs.length} songs matched.`);
  updateFavButton();
  renderMain();
}

// ============================================================
// Removing a song from the library
// ============================================================
async function removeTrack(id) {
  const track = byId(id);
  if (!track) return;

  if (id === currentId) {
    wantPlaying = false;
    currentId = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    mini.hidden = true;
    closeFull();
    clearMediaSession();
  }

  base = base.filter((x) => x !== id);
  order = order.filter((x) => x !== id);
  tracks = tracks.filter((t) => t.id !== id);
  trackMap.delete(id);

  if (favorites.delete(id)) writeStored(FAV_KEY, [...favorites]);
  const hadRecent = recent.includes(id);
  recent = recent.filter((x) => x !== id);
  if (hadRecent) writeStored(RECENT_KEY, recent);

  // Release the links so the browser can free the memory
  if (track.url) URL.revokeObjectURL(track.url);
  if (track.artUrl) URL.revokeObjectURL(track.artUrl);

  const touched = playlists.filter((p) => p.trackIds.includes(id));
  touched.forEach((p) => { p.trackIds = p.trackIds.filter((x) => x !== id); });

  try {
    await deleteSongRecords(id);
    await Promise.all(touched.map(persistPlaylist));
  } catch (err) {
    // The song is still gone from this visit
  }

  saveState(true);
  showToast(`Removed "${track.title}"`);
  renderMain();
  updateStorageInfo();
}

// ============================================================
// Queue and playback
// ============================================================
function startQueue(ids, startId = null) {
  if (!ids.length) return;

  base = ids.slice();
  if (!startId || !base.includes(startId)) {
    startId = shuffleOn ? base[randomInt(base.length)] : base[0];
  }
  errorStreak = 0;
  order = shuffleOn ? shuffledWithFirst(base, startId) : base.slice();
  switchTo(startId);
  if (queueOpen) renderQueue();
}

// Puts a song immediately after the current one
function playNext(id) {
  if (!order.length || !currentId) {
    startQueue([id]);
    return;
  }
  order = order.filter((x) => x !== id);
  const pos = order.indexOf(currentId);
  order.splice(pos + 1, 0, id);
  if (!base.includes(id)) base.push(id);
  primeNext();
  if (queueOpen) renderQueue();
  showToast('Playing next');
}

// Loads the song that comes after this one into the idle player, so the swap is instant
async function primeNext() {
  const pos = order.indexOf(currentId);
  if (pos === -1) return;

  let nextId = null;
  if (pos + 1 < order.length) nextId = order[pos + 1];
  else if (repeatMode === 1 && order.length > 1) nextId = order[0];
  if (!nextId || nextId === currentId) return;

  const track = byId(nextId);
  if (!track || idle.dataset.trackId === nextId) return;

  try {
    const url = await fileUrlFor(track);
    if (byId(currentId) === null) return;
    idle.src = url;
    idle.dataset.trackId = nextId;
    idle.load();
  } catch (err) {
    // The file is missing. It will be reported when it's actually played
  }
}

// Swaps the two players. The incoming one already has its song loaded, which is what
// gives this a chance of working while the phone is locked.
function swapToIdle(id) {
  const prevId = currentId;
  const outgoing = audio;

  outgoing.pause();
  try {
    outgoing.currentTime = 0;
  } catch (err) {
    // Not always allowed. Harmless
  }

  [audio, idle] = [idle, audio];
  delete idle.dataset.trackId;

  currentId = id;
  pendingSeek = null;
  wantPlaying = true;
  playAudio();

  afterTrackChange(prevId, id);
}

function switchTo(id) {
  const track = byId(id);
  if (!track) return;

  // Use the already-loaded player when it happens to hold this song
  if (idle.dataset.trackId === id && idle.getAttribute('src')) {
    swapToIdle(id);
    return;
  }

  const prevId = currentId;
  currentId = id;
  pendingSeek = null;
  wantPlaying = true;

  loadAndPlay(track);
  afterTrackChange(prevId, id);
}

// Everything that happens whichever way the song changed
function afterTrackChange(prevId, id) {
  const track = byId(id);
  if (!track) return;

  setMediaSession(track);
  noteRecentlyPlayed(id);
  saveState(true);

  if (document.hidden) {
    uiDirty = true;      // The screen is caught up when the app comes back
  } else {
    highlightRow(prevId, id);
    updateNowPlayingUI();
  }
  primeNext();
}

function loadAndPlay(track) {
  const wanted = track.id;

  if (track.url) {
    audio.src = track.url;
    playAudio();
    return;
  }

  fileUrlFor(track)
    .then((url) => {
      if (currentId !== wanted) return; // The user already moved on
      audio.src = url;
      playAudio();
    })
    .catch(() => {
      if (currentId === wanted) handleBrokenTrack(track);
    });
}

function playAudio() {
  startKeepAlive();
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {
      // iOS refused to start, which happens in the background. Retried when the app returns
      setPlayIcons(false);
    });
  }
}

function neighborId(step) {
  if (!order.length) return null;

  const pos = order.indexOf(currentId);
  if (pos === -1) return order[0];

  const target = pos + step;
  if (target >= 0 && target < order.length) return order[target];

  if (step > 0) {
    if (repeatMode !== 1) return null;
    order = shuffleOn ? reshuffleAfterPass(base, currentId) : base.slice();
    return order[0];
  }
  return repeatMode === 1 ? order[order.length - 1] : null;
}

function next() {
  const id = neighborId(1);
  if (id === null) {
    wantPlaying = false;
    audio.pause();
    audio.currentTime = 0;
    return;
  }
  switchTo(id);
  if (queueOpen && !document.hidden) renderQueue();
}

function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const id = neighborId(-1);
  if (id === null) {
    audio.currentTime = 0;
    return;
  }
  switchTo(id);
  if (queueOpen) renderQueue();
}

function togglePlay() {
  if (!currentId) {
    const ids = base.length ? base : tracks.map((t) => t.id);
    if (ids.length) startQueue(ids);
    return;
  }

  if (!audio.getAttribute('src')) {
    wantPlaying = true;
    loadAndPlay(byId(currentId));
    return;
  }

  if (audio.paused) {
    wantPlaying = true;
    playAudio();
  } else {
    wantPlaying = false;
    audio.pause();
  }
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  if (base.length) order = shuffleOn ? shuffledWithFirst(base, currentId) : base.slice();
  setShuffleState();
  saveState(true);
  primeNext();
  if (queueOpen) renderQueue();
}

function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  setRepeatState();
  saveState(true);
  primeNext();
  if (queueOpen) renderQueue();
}

function upcomingIds() {
  const pos = order.indexOf(currentId);
  if (pos === -1) return [];
  let list = order.slice(pos + 1);
  if (!list.length && repeatMode === 1) list = order.slice();
  return list;
}

function renderQueue() {
  const frag = document.createDocumentFragment();
  const ids = upcomingIds().slice(0, 50);

  if (!ids.length) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'Nothing up next';
    frag.append(none);
  }

  for (const id of ids) {
    const track = byId(id);
    if (!track) continue;

    const li = document.createElement('li');
    li.className = 'queue-row';

    const art = document.createElement('div');
    art.className = 'art row';
    fillArt(art, track);

    const text = document.createElement('div');
    text.className = 'track-text';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title;

    const sub = document.createElement('div');
    sub.className = 'track-sub';
    sub.textContent = subtitleFor(track);

    text.append(title, sub);
    li.append(art, text);
    li.addEventListener('click', () => {
      haptic();
      switchTo(id);
      renderQueue();
    });
    frag.append(li);
  }

  $('queue-list').replaceChildren(frag);
}

function toggleQueue() {
  queueOpen = !queueOpen;
  $('queue-panel').hidden = !queueOpen;
  fullPlayer.classList.toggle('show-queue', queueOpen);
  $('queue-btn').classList.toggle('on', queueOpen);
  if (queueOpen) renderQueue();
}

// ============================================================
// Now Playing UI
// ============================================================
function updateNowPlayingUI() {
  const track = byId(currentId);
  if (!track) return;

  mini.hidden = false;
  $('mini-title').textContent = track.title;
  fillArt($('mini-art'), track);

  $('fp-title').textContent = track.title;
  $('fp-sub').textContent = subtitleFor(track);
  fillArt($('fp-art'), track);

  applyPalette(track);
  updateFavButton();
  setPlayIcons(!audio.paused);
  updateTimes();
}

function setPlayIcons(isPlaying) {
  const icon = isPlaying ? ICON.pause : ICON.play;
  $('play').innerHTML = icon;
  $('mini-play').innerHTML = icon;
}

function setShuffleState() {
  $('shuffle').classList.toggle('on', shuffleOn);
}

function setRepeatState() {
  const btn = $('repeat');
  btn.classList.toggle('on', repeatMode !== 0);
  btn.innerHTML = repeatMode === 2 ? ICON.repeatOne : ICON.repeat;
}

function updateTimes() {
  const d = audio.duration;
  const t = pendingSeek !== null ? pendingSeek : audio.currentTime;
  if (!isFinite(d) || d === 0) {
    tNow.textContent = formatTime(t);
    return;
  }
  const fraction = Math.min(t / d, 1);
  miniBar.style.transform = `scaleX(${fraction})`;
  if (!seeking) {
    progress.value = fraction * 1000;
    tNow.textContent = formatTime(t);
  }
  tLeft.textContent = '-' + formatTime(d - t);
}

// ============================================================
// Full player open and close
// ============================================================
function openFull() {
  if (!currentId) return;
  fullPlayer.classList.add('open');
  fullPlayer.setAttribute('aria-hidden', 'false');
  const track = byId(currentId);
  setTopColor(track && track.palette ? track.palette[0] : getComputedStyle(fullPlayer).getPropertyValue('--p1').trim());
  updateSleepUI();
  lockScroll();
}

function closeFull() {
  fullPlayer.classList.remove('open');
  fullPlayer.setAttribute('aria-hidden', 'true');
  setTopColor(HOME_COLOR);
  lockScroll();
}

$('mini-open').addEventListener('click', () => {
  haptic();
  openFull();
});
onTap('close-full', closeFull);
onTap('queue-btn', toggleQueue);
onTap('sleep-btn', openSleepSheet);
onTap('fav-btn', () => {
  if (currentId) toggleFavorite(currentId);
});

// Swipe down to close, unless the Up Next list is being scrolled
let touchStartY = null;

fullPlayer.addEventListener('touchstart', (e) => {
  touchStartY = e.target.closest('.queue') ? null : e.touches[0].clientY;
}, { passive: true });

fullPlayer.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  if (e.changedTouches[0].clientY - touchStartY > 90 && fullPlayer.scrollTop <= 0) closeFull();
  touchStartY = null;
});

// ============================================================
// Buttons
// ============================================================
onTap('play', togglePlay);
onTap('next', next);
onTap('prev', prev);
onTap('mini-play', togglePlay);
onTap('mini-next', next);
onTap('shuffle', toggleShuffle);
onTap('repeat', cycleRepeat);

// ============================================================
// Audio events
// Both players share these handlers, and each one ignores events
// from whichever player is not currently the active one.
// ============================================================
function activeOnly(fn) {
  return function handler(e) {
    if (e.target !== audio) return;
    fn(e);
  };
}

function handleBrokenTrack(track) {
  track.failed = true;
  markFailedRow(track.id);
  errorStreak++;

  if (wantPlaying && errorStreak < Math.max(order.length, 1)) {
    showToast(`Skipped "${track.title}". This file can't be played here.`);
    next();
  } else {
    wantPlaying = false;
    setPlayIcons(false);
    showToast(`Can't play "${track.title}". This file may use an unsupported encoding.`);
  }
}

for (const el of [audioA, audioB]) {
  el.addEventListener('play', activeOnly(() => {
    setPlayIcons(true);
    setPlaybackState('playing');
    startKeepAlive();
  }));

  el.addEventListener('playing', activeOnly(() => {
    errorStreak = 0; // A song started fine, so the failure count resets
  }));

  el.addEventListener('pause', activeOnly(() => {
    setPlayIcons(false);
    setPlaybackState('paused');
    pauseKeepAlive();
    saveState(true);
  }));

  // Once a restored song knows its length, jump to where it stopped last time
  el.addEventListener('loadedmetadata', activeOnly(() => {
    if (pendingSeek !== null && isFinite(audio.duration)) {
      audio.currentTime = Math.min(pendingSeek, Math.max(0, audio.duration - 1));
      pendingSeek = null;
    }
    updatePositionState();
    if (!document.hidden) updateTimes();
  }));

  el.addEventListener('timeupdate', activeOnly(() => {
    const now = Date.now();
    if (now - lastSave > 5000) {
      saveState();
      updatePositionState();
    }
    if (!document.hidden) updateTimes(); // No screen work while in the background
  }));

  el.addEventListener('ended', activeOnly(() => {
    if (sleepAtTrackEnd) {
      sleepNow();
      return;
    }
    if (repeatMode === 2) {
      audio.currentTime = 0;
      playAudio();
    } else {
      next();
    }
  }));

  el.addEventListener('error', activeOnly(() => {
    const track = byId(currentId);
    if (!track || !audio.getAttribute('src')) return;
    handleBrokenTrack(track);
  }));
}

// ============================================================
// Progress slider
// ============================================================
progress.addEventListener('input', () => {
  seeking = true;
  if (isFinite(audio.duration)) {
    tNow.textContent = formatTime((progress.value / 1000) * audio.duration);
  }
});

progress.addEventListener('change', () => {
  if (isFinite(audio.duration)) {
    audio.currentTime = (progress.value / 1000) * audio.duration;
    pendingSeek = null;
  }
  seeking = false;
  saveState(true);
});

// ============================================================
// Lock screen and Control Center
// ============================================================
function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function setMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  const meta = {
    title: track.title,
    artist: track.artist || track.album || '',
    album: track.album || '',
  };
  navigator.mediaSession.metadata = new MediaMetadata(meta);

  if (!track.hasArt) return;

  // The cover is added a moment later, so the music never waits for it
  if (!track.sessionArt) {
    const url = await getArtUrl(track);
    if (url) {
      try {
        const blob = await (await fetch(url)).blob();
        track.sessionArt = await blobToDataUrl(blob);
      } catch (err) {
        // No cover on the lock screen. The music still plays
      }
    }
  }

  if (track.sessionArt && currentId === track.id) {
    const type = track.sessionArt.slice(5, track.sessionArt.indexOf(';')) || 'image/jpeg';
    navigator.mediaSession.metadata = new MediaMetadata({
      ...meta,
      artwork: [{ src: track.sessionArt, sizes: '512x512', type }],
    });
  }
}

function clearMediaSession() {
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

function setPlaybackState(state) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const d = audio.duration;
  if (!isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, d),
    });
  } catch (err) {
    // Ignore browsers that reject this
  }
}

function setupMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;

  const handlers = {
    play: () => { wantPlaying = true; playAudio(); },
    pause: () => { wantPlaying = false; audio.pause(); },
    previoustrack: prev,
    nexttrack: next,
    seekto: (details) => {
      if (details && isFinite(details.seekTime)) {
        audio.currentTime = details.seekTime;
        updatePositionState();
      }
    },
  };

  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      // Skip actions this browser doesn't support
    }
  }
}

// ============================================================
// Saving and restoring where you left off
// ============================================================
function saveState(force = false) {
  const now = Date.now();
  if (!force && now - lastSave < 5000) return;
  lastSave = now;

  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      currentId,
      time: pendingSeek !== null ? pendingSeek : audio.currentTime || 0,
      base,
      order,
      shuffleOn,
      repeatMode,
    }));
  } catch (err) {
    // Storage full or blocked. Nothing else depends on this
  }
}

function restoreState() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
  } catch (err) {
    return;
  }
  if (!s) return;

  shuffleOn = !!s.shuffleOn;
  repeatMode = [0, 1, 2].includes(s.repeatMode) ? s.repeatMode : 0;
  setShuffleState();
  setRepeatState();

  const track = byId(s.currentId);
  if (!track) return;

  const exists = (id) => trackMap.has(id);
  base = (s.base || []).filter(exists);
  order = (s.order || []).filter(exists);
  if (!base.includes(track.id)) base = tracks.map((t) => t.id);
  if (!order.includes(track.id)) order = shuffleOn ? shuffledWithFirst(base, track.id) : base.slice();

  currentId = track.id;
  pendingSeek = Number(s.time) || 0;

  // Loaded but not played, so the saved position is ready when you press play
  fileUrlFor(track)
    .then((url) => {
      if (currentId !== track.id) return;
      audio.src = url;
      audio.load();
      primeNext();
    })
    .catch(() => {});

  updateNowPlayingUI();
  setMediaSession(track);
  highlightRow(null, currentId);
}

// ============================================================
// Coming back from the background
// ============================================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveState(true);
    return;
  }

  if (uiDirty) {
    uiDirty = false;
    renderMain();
    updateNowPlayingUI();
  } else {
    updateTimes();
  }
  updateSleepUI();

  // If iOS stopped the next song from starting in the background, start it now
  if (wantPlaying && audio.paused && currentId) {
    startKeepAlive();
    playAudio();
  }
});

window.addEventListener('pagehide', () => saveState(true));

// ============================================================
// Service worker, including the "update ready" notice
// ============================================================
function watchForUpdates(reg) {
  if (!reg) return;
  reg.addEventListener('updatefound', () => {
    const fresh = reg.installing;
    if (!fresh) return;
    fresh.addEventListener('statechange', () => {
      // A new version is ready, and an old one is currently running
      if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
        $('update-banner').hidden = false;
      }
    });
  });
}

// ============================================================
// Start up
// ============================================================
async function init() {
  sortMode = (() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      return saved && SORT_MODES[saved] ? saved : 'name';
    } catch (err) {
      return 'name';
    }
  })();

  favorites = new Set(readStoredList(FAV_KEY));
  recent = readStoredList(RECENT_KEY);

  setIcons();
  setPlayIcons(false);
  setShuffleState();
  setRepeatState();
  updateFavButton();
  updateSleepUI();
  setupMediaSessionHandlers();
  setTopColor(HOME_COLOR);

  try {
    db = await openDatabase();

    // Only the small song records load here. Files and covers load when they're needed
    const [saved, savedPlaylists] = await Promise.all([
      dbRun('songs', 'readonly', (s) => s.getAll()),
      dbRun('playlists', 'readonly', (s) => s.getAll()),
    ]);

    saved.sort((a, b) => a.addedAt - b.addedAt);
    saved.forEach((rec) => addTrack(toTrack(rec)));

    playlists = savedPlaylists || [];
    playlists.sort((a, b) => a.createdAt - b.createdAt);

    renderMain();
    restoreState();

    migrateLegacy(saved); // Older saves are converted after the library is on screen
  } catch (err) {
    renderMain();
    showToast("Couldn't open saved storage. Songs will only last this visit.");
  }

  updateStorageInfo();

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(watchForUpdates)
      .catch(() => {});
  }
}

init();
