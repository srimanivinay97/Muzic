'use strict';

// ============================================================
// Element references
// ============================================================
const $ = (id) => document.getElementById(id);

const audio = $('audio');
const fileInput = $('file-input');
const trackList = $('track-list');
const playlistList = $('playlist-list');
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
const HOME_COLOR = '#a3001a';

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
  queue: svg('<path d="M4 6h16M4 12h10M4 18h7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', true),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
};

function setIcons() {
  $('back-btn').innerHTML = ICON.back;
  $('close-full').innerHTML = ICON.chevronDown;
  $('playlist-more').innerHTML = ICON.more;
  $('shuffle').innerHTML = ICON.shuffle;
  $('prev').innerHTML = ICON.prev;
  $('next').innerHTML = ICON.next;
  $('mini-next').innerHTML = ICON.next;
  $('refresh-icon').innerHTML = ICON.refresh;
  document.querySelector('#queue-btn .pill-icon').innerHTML = ICON.queue;
  document.querySelector('[data-icon="note"]').innerHTML = ICON.note;
  document.querySelector('[data-icon="playlist"]').innerHTML = ICON.playlist;
  document.querySelector('[data-icon="search"]').innerHTML = ICON.search;
}

// ============================================================
// State
// ============================================================
let tracks = [];              // Songs in the order they were added
const trackMap = new Map();   // id -> track, for instant lookups instead of searching the array
let playlists = [];           // Each: { id, name, trackIds, createdAt }

let view = 'library';         // 'library' | 'search' | 'playlists' | 'playlist'
let activeTab = 'library';
let viewPlaylistId = null;
let searchQuery = '';

// base = the list being played in normal order, order = the actual play order (shuffled or not)
let base = [];
let order = [];
let currentId = null;

let shuffleOn = false;
let repeatMode = 0;           // 0 = off, 1 = repeat all, 2 = repeat one
let queueOpen = false;
let seeking = false;
let pendingSeek = null;       // Saved position to jump to once a restored song has loaded
let wantPlaying = false;      // True when the user expects music to be playing
let errorStreak = 0;          // Songs that failed in a row, to stop skipping forever
let uiDirty = false;          // True when the screen needs updating after coming back from the background
let lastSave = 0;
let db = null;
let toastTimer = null;

const rowById = new Map();    // id -> its row in the visible song list

// ============================================================
// Helpers
// ============================================================
const byId = (id) => trackMap.get(id) || null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Turns text into a number from 0 to 359 for a color. Same text always gives the same color
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

// Removes website names that download sites add to tags,
// e.g. "Manakanna Podichey - TeluguWap.Net" becomes "Manakanna Podichey"
// A separator (- | : or a bracket) or "www." must come before the site name,
// so real titles that happen to contain a dot are left alone.
const SITE_SUFFIX = /\s*(?:[-–—|:~]\s*[\[(]?|[\[(]|(?=www\.))\s*(?:www\.)?[a-z0-9-]+\.(?:com|net|org|in|info|co|me|cc|biz|xyz|fm|io|mobi|ws|tv|club|site|pk|live|guru|world|top|app|online)\b[^\])]*[\])]?\s*$/i;

function cleanText(text) {
  if (!text) return '';
  const cleaned = text.replace(SITE_SUFFIX, '').trim();
  return cleaned || text.trim(); // Never return an empty title
}

// Movie (album) name if it exists, otherwise the singer (artist)
function subtitleFor(track) {
  return track.album || track.artist || 'Unknown';
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

// Short vibration on Android, and the hidden-switch tap on recent iPhones
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

// Sets the color iOS uses for the status bar area (the page's background color)
function setTopColor(color) {
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  $('theme-color').setAttribute('content', color);
}

function lockScroll() {
  document.body.classList.toggle('locked', fullPlayer.classList.contains('open') || !$('sheet').hidden);
}

// ============================================================
// Shuffle
// crypto.getRandomValues gives high-quality random numbers. Fisher-Yates gives every order
// an equal chance. A new order is made every time shuffle starts or a full pass ends.
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
// Metadata from the file (title, album, artist, cover art)
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

// Stores the cover as raw image bytes (a Blob). A Blob is about 25% smaller than a
// base64 text version and doesn't need converting every time it is shown.
function pictureToBlob(picture) {
  const mime = picture.format && picture.format.includes('/') ? picture.format : 'image/jpeg';
  return new Blob([new Uint8Array(picture.data)], { type: mime });
}

// Builds an artwork tile: an <img> when there is cover art, a color tile with a note when there isn't
function fillArt(el, track, lazy = false) {
  el.textContent = '';
  if (track.artUrl) {
    el.style.background = '';
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';   // Off-screen rows don't load their image until scrolled to
    img.src = track.artUrl;
    el.append(img);
  } else {
    el.style.background = gradientCss(track.hue);
    el.innerHTML = ICON.note;
  }
}

// ============================================================
// Player colors from the cover art
// The image is shrunk to 24x24 and averaged. Colorful pixels count more than gray ones.
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
    track.palette = (track.artUrl && (await extractPalette(track.artUrl))) || fallbackPalette(track.hue);
  }
  if (currentId !== track.id) return; // The song changed while the colors were being worked out
  fullPlayer.style.setProperty('--p1', track.palette[0]);
  fullPlayer.style.setProperty('--p2', track.palette[1]);
  if (fullPlayer.classList.contains('open')) setTopColor(track.palette[0]);
}

// ============================================================
// Storage (IndexedDB)
// ============================================================
function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('glass-music', 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
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

// Builds the in-memory track from a saved record.
// Older versions saved cover art as text (a data URL). That still works and is converted later.
function toTrack(record) {
  const title = cleanText(record.title);
  let artUrl = null;
  if (record.artBlob) artUrl = URL.createObjectURL(record.artBlob);
  else if (typeof record.art === 'string') artUrl = record.art;

  return {
    id: record.id,
    title,
    album: cleanText(record.album),
    artist: cleanText(record.artist),
    format: record.format,
    addedAt: record.addedAt || 0,
    artUrl,
    artBlob: record.artBlob || null,
    hue: hashHue(title),
    file: record.file,
    url: null,        // The song's link is only made when it's played, to save memory
    failed: false,
    palette: null,
    sessionArt: null, // Cover as text, made once for the lock screen
  };
}

function addTrack(track) {
  tracks.push(track);
  trackMap.set(track.id, track);
}

// Creates the playable link for a song the first time it's needed
function urlFor(track) {
  if (!track.url) track.url = URL.createObjectURL(track.file);
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

async function handleFiles() {
  const files = Array.from(fileInput.files);
  fileInput.value = ''; // Lets the same file be chosen again later

  let added = 0;
  let skipped = 0;

  for (const file of files) {
    const ext = getExtension(file.name);
    if (!SUPPORTED.has(ext)) {
      skipped++;
      continue;
    }

    const tags = await readTags(file);
    const record = {
      id: newId(),
      title: (tags && tags.title) || file.name.replace(/\.[^.]+$/, ''),
      album: (tags && tags.album) || '',
      artist: (tags && tags.artist) || '',
      format: ext.toUpperCase(),
      artBlob: tags && tags.picture ? pictureToBlob(tags.picture) : null,
      file,
      addedAt: Date.now() + added, // +added keeps files from one pick in order, even within one millisecond
      tagsRead: true,
    };

    try {
      await dbRun('songs', 'readwrite', (s) => s.put(record));
    } catch (err) {
      // If saving fails (for example storage is full), the song still works for this visit
    }

    addTrack(toTrack(record));
    added++;
  }

  renderMain(); // One redraw at the end instead of one per song
  updateStorageInfo();

  const parts = [];
  if (added) parts.push(`Added ${plural(added, 'song')}`);
  if (skipped) parts.push(`${skipped} skipped (unsupported format)`);
  if (parts.length) showToast(parts.join('. ') + '.');
}

fileInput.addEventListener('change', handleFiles);

// Upgrades songs saved by older versions: reads missing tags, and turns
// text-based cover art into a Blob, which is smaller on disk
async function upgradeOldRecords(records) {
  let changed = false;

  for (const rec of records) {
    const needsTags = !rec.tagsRead && window.jsmediatags;
    const needsBlob = typeof rec.art === 'string' && !rec.artBlob;
    if (!needsTags && !needsBlob) continue;

    if (needsTags) {
      const tags = await readTags(rec.file);
      if (tags) {
        rec.title = tags.title || rec.title;
        rec.album = tags.album || '';
        rec.artist = tags.artist || '';
        if (tags.picture) {
          rec.artBlob = pictureToBlob(tags.picture);
          delete rec.art;
        }
      }
      rec.tagsRead = true;
    }

    if (typeof rec.art === 'string' && !rec.artBlob) {
      try {
        rec.artBlob = await (await fetch(rec.art)).blob();
        delete rec.art;
      } catch (err) {
        // Keep the old text version if conversion fails
      }
    }

    try {
      await dbRun('songs', 'readwrite', (s) => s.put(rec));
    } catch (err) {
      continue;
    }

    // Swap the updated details into the live track
    const old = byId(rec.id);
    if (!old) continue;
    const fresh = toTrack(rec);
    fresh.url = old.url;
    if (old.artUrl && old.artUrl.startsWith('blob:')) URL.revokeObjectURL(old.artUrl);
    Object.assign(old, fresh, { url: old.url, failed: old.failed });
    changed = true;
  }

  if (changed) {
    renderMain();
    if (currentId) updateNowPlayingUI();
    updateStorageInfo();
  }
}

// ============================================================
// Storage usage shown under the Library title
// ============================================================
let storageText = '';

async function updateStorageInfo() {
  storageText = '';
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage } = await navigator.storage.estimate();
      if (usage) storageText = `${(usage / (1024 * 1024)).toFixed(usage > 1e9 ? 0 : 1)} MB used`;
    } catch (err) {
      // Not available in this browser
    }
  }
  if (view === 'library') updateCount();
}

// ============================================================
// Tabs and navigation
// ============================================================
function setTab(tab) {
  activeTab = tab;
  view = tab;
  viewPlaylistId = null;
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
  renderMain();
  window.scrollTo(0, 0);
}

onTap('back-btn', () => {
  view = 'playlists';
  viewPlaylistId = null;
  renderMain();
});

// Waits until typing pauses for 120 ms before filtering, so large libraries stay smooth
let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchEl.value;
    renderMain();
  }, 120);
});

// ============================================================
// Refresh: tapping the Library title loads the newest version from GitHub
// ============================================================
async function refreshApp() {
  haptic();
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
  if (view === 'library') refreshApp();
});

// ============================================================
// Main screen rendering
// ============================================================
// Alphabetical order by title. numeric:true puts "Song 2" before "Song 10",
// and sensitivity:'base' ignores upper/lower case when comparing.
// Compares text the way a person expects: case-insensitive, and numbers sorted by value
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Empty text (no artist or movie tag) is compared last, so real names come first
function compareText(x, y) {
  if (!x && y) return 1;
  if (x && !y) return -1;
  return nameCollator.compare(x, y);
}

const SORT_KEY = 'glass-music-sort';
const SORT_MODES = {
  name:   { label: 'Name',           cmp: (a, b) => compareText(a.title, b.title) },
  artist: { label: 'Artist',         cmp: (a, b) => compareText(a.artist, b.artist) || compareText(a.title, b.title) },
  movie:  { label: 'Movie',          cmp: (a, b) => compareText(a.album, b.album) || compareText(a.title, b.title) },
  added:  { label: 'Recently added', cmp: (a, b) => b.addedAt - a.addedAt }, // newest first
};
let sortMode = 'name';

function sortedTracks(list) {
  return list.slice().sort(SORT_MODES[sortMode].cmp);
}

function currentListIds() {
  if (view === 'library') return sortedTracks(tracks).map((t) => t.id);

  if (view === 'search') {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedTracks(tracks).map((t) => t.id);
    return sortedTracks(tracks)
      .filter((t) => t.title.toLowerCase().includes(q)
        || t.album.toLowerCase().includes(q)
        || t.artist.toLowerCase().includes(q))
      .map((t) => t.id);
  }

  if (view === 'playlist') {
    const p = playlists.find((x) => x.id === viewPlaylistId);
    return p ? p.trackIds.filter((id) => trackMap.has(id)) : [];
  }
  return [];
}

function updateCount() {
  if (view === 'playlists') {
    countEl.textContent = plural(playlists.length, 'playlist');
    return;
  }
  const n = view === 'library' ? tracks.length : currentListIds().length;
  let text = plural(n, 'song');
  if (view === 'library' && storageText) text += ` · ${storageText}`;
  countEl.textContent = text;
}

function renderMain() {
  let playlist = null;
  if (view === 'playlist') {
    playlist = playlists.find((p) => p.id === viewPlaylistId) || null;
    if (!playlist) view = 'playlists'; // It was deleted while open
  }

  const isPlaylists = view === 'playlists';
  const isPlaylist = view === 'playlist';
  const isLibrary = view === 'library';

  const titles = { library: 'Library', search: 'Search', playlists: 'Playlists' };
  pageTitle.textContent = isPlaylist ? playlist.name : titles[view];

  // The refresh icon only appears on the Library tab
  $('refresh-icon').hidden = !isLibrary;
  $('title-btn').disabled = !isLibrary;

  $('back-btn').hidden = !isPlaylist;
  $('sort-btn').hidden = isPlaylists || isPlaylist;
  $('sort-btn').textContent = 'Sort: ' + SORT_MODES[sortMode].label;
  $('add-btn').hidden = !isLibrary;
  $('new-playlist-btn').hidden = !isPlaylists;
  $('playlist-tools').hidden = !isPlaylist;
  searchEl.hidden = view !== 'search';
  playlistList.hidden = !isPlaylists;
  trackList.hidden = isPlaylists;
  emptyBox.hidden = !(isLibrary && tracks.length === 0);

  if (isPlaylists) renderPlaylists();
  else renderTracks(currentListIds(), isPlaylist);

  updateCount();

  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === activeTab);
  });

  if (queueOpen) renderQueue();
}

function renderPlaylists() {
  const frag = document.createDocumentFragment();

  if (playlists.length === 0) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'No playlists yet. Tap New Playlist to create one.';
    frag.append(none);
  }

  for (const p of playlists) {
    const row = document.createElement('li');
    row.className = 'track-row';

    const art = document.createElement('div');
    art.className = 'art row';
    art.style.background = gradientCss(hashHue(p.name));
    art.innerHTML = ICON.playlist;

    const text = document.createElement('div');
    text.className = 'track-text';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = p.name;

    const sub = document.createElement('div');
    sub.className = 'track-sub';
    sub.textContent = plural(p.trackIds.filter((id) => trackMap.has(id)).length, 'song');

    text.append(title, sub);
    row.append(art, text);
    row.addEventListener('click', () => {
      haptic();
      openPlaylist(p.id);
    });
    frag.append(row);
  }

  // replaceChildren swaps the whole list in one step, which is faster than adding rows one by one
  playlistList.replaceChildren(frag);
}

function buildTrackRow(track, ids, inPlaylist) {
  const row = document.createElement('li');
  row.className = 'track-row';
  if (track.id === currentId) row.classList.add('playing');
  if (track.failed) row.classList.add('failed');

  const art = document.createElement('div');
  art.className = 'art row';
  fillArt(art, track, true);

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

  const more = document.createElement('button');
  more.className = 'more-btn';
  more.setAttribute('aria-label', 'Song options');
  more.innerHTML = ICON.more;
  more.addEventListener('click', (e) => {
    e.stopPropagation(); // Don't also start playback
    haptic();
    openSongOptions(track.id, inPlaylist);
  });

  row.append(art, text, more);
  row.addEventListener('click', () => {
    haptic();
    startQueue(ids, track.id);
  });
  return row;
}

function renderTracks(ids, inPlaylist) {
  rowById.clear();
  const frag = document.createDocumentFragment();

  if (ids.length === 0) {
    let msg = '';
    if (inPlaylist) msg = 'This playlist is empty. Tap ⋯ on a song in your library and choose Add to Playlist.';
    else if (view === 'search' && tracks.length) msg = 'No matching songs';
    if (msg) {
      const none = document.createElement('li');
      none.className = 'no-match';
      none.textContent = msg;
      frag.append(none);
    }
  }

  for (const id of ids) {
    const track = byId(id);
    if (!track) continue;
    const row = buildTrackRow(track, ids, inPlaylist);
    rowById.set(id, row);
    frag.append(row);
  }

  trackList.replaceChildren(frag);
}

// Moves the "playing" highlight without rebuilding the whole list
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

function openSongOptions(id, inPlaylist) {
  const track = byId(id);
  if (!track) return;

  const actions = [{ label: 'Add to Playlist', onClick: () => openChoosePlaylist(id) }];
  if (inPlaylist) {
    actions.push({ label: 'Remove from This Playlist', onClick: () => removeFromPlaylist(viewPlaylistId, id) });
  }
  actions.push({ label: 'Remove from Library', danger: true, onClick: () => confirmRemove(id) });

  openSheet({ title: track.title, message: subtitleFor(track), actions });
}

// Asks once before deleting, because removing also frees the stored copy
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
  const p = playlists.find((x) => x.id === viewPlaylistId);
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
  const p = playlists.find((x) => x.id === playlistId);
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
  const p = playlists.find((x) => x.id === playlistId);
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
  viewPlaylistId = null;
  showToast(`Deleted "${p.name}"`);
  renderMain();
}

onTap('playlist-shuffle', () => {
  const ids = currentListIds();
  if (!ids.length) return;
  shuffleOn = true;
  setShuffleState();
  startQueue(ids, ids[randomInt(ids.length)]);
});

onTap('playlist-more', openPlaylistOptions);
onTap('new-playlist-btn', () => openNewPlaylist(null));

// ============================================================
// Sort menu
// ============================================================
function setSortMode(key) {
  if (!SORT_MODES[key]) return;
  sortMode = key;
  try {
    localStorage.setItem(SORT_KEY, key); // Remembered for next time
  } catch (err) {
    // Storage blocked: the choice lasts for this visit only
  }
  renderMain();
}

function loadSortMode() {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved && SORT_MODES[saved]) sortMode = saved;
  } catch (err) {
    // Use the default
  }
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

  // Release the links so the browser can free the memory
  if (track.url) URL.revokeObjectURL(track.url);
  if (track.artUrl && track.artUrl.startsWith('blob:')) URL.revokeObjectURL(track.artUrl);

  const touched = playlists.filter((p) => p.trackIds.includes(id));
  touched.forEach((p) => { p.trackIds = p.trackIds.filter((x) => x !== id); });

  try {
    await dbRun('songs', 'readwrite', (s) => s.delete(id));
    await Promise.all(touched.map(persistPlaylist)); // Only playlists that contained the song
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
  switchTo(startId);
  order = shuffleOn ? shuffledWithFirst(base, currentId) : base.slice();
  if (queueOpen) renderQueue();
}

// Changes the current song and starts it. The audio is started FIRST and with no waiting,
// because iOS is stricter about starting audio when the app is in the background.
function switchTo(id) {
  const track = byId(id);
  if (!track) return;

  const prevId = currentId;
  currentId = id;
  pendingSeek = null;
  wantPlaying = true;

  audio.src = urlFor(track);
  playAudio();

  setMediaSession(track);
  saveState(true);

  // Screen updates are skipped while the app is in the background, and done on return
  if (document.hidden) {
    uiDirty = true;
  } else {
    highlightRow(prevId, id);
    updateNowPlayingUI();
  }
}

function playAudio() {
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {
      // iOS refused to start (common in the background). It is retried when the app comes back.
      setPlayIcons(false);
    });
  }
}

// The song before or after the current one in play order, or null when playback should stop
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
  if (!audio.src) audio.src = urlFor(byId(currentId));

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
  if (queueOpen) renderQueue();
}

function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  setRepeatState();
  saveState(true);
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
    fillArt(art, track, true);

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

// Updates the slider and both time labels from the audio's position
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
// Audio element events
// ============================================================
audio.addEventListener('play', () => {
  setPlayIcons(true);
  setPlaybackState('playing');
});

audio.addEventListener('playing', () => {
  errorStreak = 0; // A song started fine, so the failure counter resets
});

audio.addEventListener('pause', () => {
  setPlayIcons(false);
  setPlaybackState('paused');
  saveState(true);
});

// Once a restored song knows its length, jump to where it stopped last time
audio.addEventListener('loadedmetadata', () => {
  if (pendingSeek !== null && isFinite(audio.duration)) {
    audio.currentTime = Math.min(pendingSeek, Math.max(0, audio.duration - 1));
    pendingSeek = null;
  }
  updatePositionState();
  if (!document.hidden) updateTimes();
});

audio.addEventListener('timeupdate', () => {
  // Saves the position every 5 seconds, so a closed app can resume close to where it stopped
  const now = Date.now();
  if (now - lastSave > 5000) {
    saveState();
    updatePositionState();
  }
  if (!document.hidden) updateTimes(); // No screen work while in the background
});

audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    playAudio();
  } else {
    next();
  }
});

// A song that can't be decoded is skipped automatically instead of stopping the playlist
audio.addEventListener('error', () => {
  const track = byId(currentId);
  if (!track || !audio.getAttribute('src')) return;

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
});

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

// The lock screen needs the cover as text. It's made once per song and kept.
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

  // The cover is added a moment later, so the music never waits for it
  if (track.artBlob || track.artUrl) {
    if (!track.sessionArt) {
      track.sessionArt = track.artBlob ? await blobToDataUrl(track.artBlob) : track.artUrl;
    }
    if (track.sessionArt && currentId === track.id) {
      const type = track.sessionArt.slice(5, track.sessionArt.indexOf(';')) || 'image/jpeg';
      navigator.mediaSession.metadata = new MediaMetadata({
        ...meta,
        artwork: [{ src: track.sessionArt, sizes: '512x512', type }],
      });
    }
  }
}

function clearMediaSession() {
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

function setPlaybackState(state) {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

// Keeps the lock screen progress bar accurate
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
    // Lets you drag the progress bar on the lock screen
    seekto: (details) => {
      if (details && isFinite(details.seekTime)) {
        audio.currentTime = details.seekTime;
        updatePositionState();
      }
    },
  };

  // Handlers are registered once at start-up, not on every song change
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (err) {
      // Skip actions this browser doesn't support
    }
  }
}

// ============================================================
// Saving and restoring where you left off (localStorage)
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
  audio.src = urlFor(track);
  audio.load(); // Loads only the details, so the position can be applied before you press play

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

  // Catches up on screen changes that were skipped in the background
  if (uiDirty) {
    uiDirty = false;
    renderMain();
    updateNowPlayingUI();
  } else {
    updateTimes();
  }

  // If iOS stopped the next song from starting in the background, start it now
  if (wantPlaying && audio.paused && currentId) playAudio();
});

// pagehide fires when the app is closed or reloaded
window.addEventListener('pagehide', () => saveState(true));

// ============================================================
// Start up
// ============================================================
async function init() {
  loadSortMode();
  setIcons();
  setPlayIcons(false);
  setShuffleState();
  setRepeatState();
  setupMediaSessionHandlers();
  setTopColor(HOME_COLOR);

  try {
    db = await openDatabase();

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

    // Runs after the library is on screen, so start-up stays fast
    upgradeOldRecords(saved);
  } catch (err) {
    renderMain();
    showToast("Couldn't open saved storage. Songs will only last this visit.");
  }

  updateStorageInfo();

  // Asks the browser not to clear the library when the phone is low on space
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // Registers the service worker that keeps the app up to date and working offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

init();
