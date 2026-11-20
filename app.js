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

// File types the picker accepts and the app plays
const SUPPORTED = ['mp3', 'm4a', 'mp4', 'm4b', 'aac', 'flac', 'wav', 'aif', 'aiff', 'caf'];

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
};

// Puts icons into their buttons and tabs
function setIcons() {
  $('back-btn').innerHTML = ICON.back;
  $('close-full').innerHTML = ICON.chevronDown;
  $('playlist-more').innerHTML = ICON.more;
  $('shuffle').innerHTML = ICON.shuffle;
  $('prev').innerHTML = ICON.prev;
  $('next').innerHTML = ICON.next;
  $('mini-next').innerHTML = ICON.next;
  $('repeat').innerHTML = ICON.repeat;
  document.querySelector('#queue-btn .pill-icon').innerHTML = ICON.queue;
  document.querySelector('[data-icon="note"]').innerHTML = ICON.note;
  document.querySelector('[data-icon="playlist"]').innerHTML = ICON.playlist;
  document.querySelector('[data-icon="search"]').innerHTML = ICON.search;
}

// ============================================================
// State
// ============================================================
let tracks = [];          // Each: { id, title, album, artist, format, art, hue, url, file, failed, palette }
let playlists = [];       // Each: { id, name, trackIds, createdAt }

let view = 'library';     // 'library' | 'search' | 'playlists' | 'playlist'
let activeTab = 'library';// Which tab is highlighted: 'library' | 'playlists' | 'search'
let viewPlaylistId = null;
let searchQuery = '';

// Playback queue. base is the list in its normal order.
// order is the sequence that actually plays (shuffled when shuffle is on)
let base = [];
let order = [];
let currentId = null;

let shuffleOn = false;
let repeatMode = 0;       // 0 = off, 1 = repeat all, 2 = repeat one
let queueOpen = false;
let seeking = false;
let db = null;
let toastTimer = null;

// ============================================================
// Helpers
// ============================================================
function byId(id) {
  return tracks.find((t) => t.id === id) || null;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Turns text into a number from 0 to 359 for a color. Same text always gives the same color
function hashHue(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) % 360;
  }
  return h;
}

function gradientStyle(hue) {
  return `background: linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 60) % 360} 80% 34%))`;
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

// Shows the movie (album) name when it exists, otherwise the singer (artist)
function subtitleFor(track) {
  return track.album || track.artist || 'On This Device';
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

// Short vibration where supported (Android), plus the iPhone switch trick
function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
  $('haptic-label').click();
}

// Runs a function on click, after the haptic
function onTap(id, fn) {
  $(id).addEventListener('click', (e) => {
    haptic();
    fn(e);
  });
}

// ============================================================
// Shuffle
// Uses the browser's secure random numbers, and a new order is made each time shuffle turns on
// or a pass through the list ends. The Fisher-Yates method gives every order an equal chance
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

// The first song stays first (the one being played), the rest are shuffled
function shuffledWithFirst(list, firstId) {
  const rest = shuffle(list.filter((id) => id !== firstId));
  return list.includes(firstId) ? [firstId, ...rest] : rest;
}

// Starts a new pass that never begins with the song that just finished
function reshuffleAfterPass(list, lastId) {
  const o = shuffle(list);
  if (o.length > 1 && o[0] === lastId) {
    [o[0], o[1]] = [o[1], o[0]];
  }
  return o;
}

// ============================================================
// Metadata: title, album, artist and cover art from the file
// ============================================================
function readTags(file) {
  return new Promise((resolve) => {
    if (!window.jsmediatags) {
      resolve(null);
      return;
    }
    window.jsmediatags.read(file, {
      onSuccess: (result) => resolve(result.tags),
      onError: () => resolve(null),
    });
  });
}

function pictureToDataUrl(picture) {
  const bytes = picture.data;
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
  }
  const mime = picture.format && picture.format.includes('/') ? picture.format : 'image/jpeg';
  return `data:${mime};base64,${btoa(binary)}`;
}

// Fills an artwork tile with cover art, or a color tile with a note icon when there is no art
function applyArt(el, track) {
  if (track.art) {
    el.style.cssText = `background-image: url("${track.art}")`;
    el.classList.add('has-art');
    el.innerHTML = '';
  } else {
    el.style.cssText = gradientStyle(track.hue);
    el.classList.remove('has-art');
    el.innerHTML = ICON.note;
  }
}

// ============================================================
// Player colors taken from the cover art
// The average color of the image is darkened to two shades for the background
// ============================================================
function fallbackPalette(hue) {
  return [`hsl(${hue} 55% 30%)`, `hsl(${hue} 70% 12%)`];
}

function darken(r, g, b, amount) {
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`;
}

function extractPalette(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 24; // Small sample is enough and fast
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const d = ctx.getImageData(0, 0, size, size).data;

        // Colorful pixels count more than gray ones, so the palette keeps the color of the cover
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
        r /= w;
        g /= w;
        b /= w;

        resolve([darken(r, g, b, 0.35), darken(r, g, b, 0.8)]);
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function paletteFor(track) {
  if (track.palette) return track.palette;
  if (track.art) {
    track.palette = (await extractPalette(track.art)) || fallbackPalette(track.hue);
  } else {
    track.palette = fallbackPalette(track.hue);
  }
  return track.palette;
}

async function applyPalette(track) {
  const palette = await paletteFor(track);
  if (currentId === track.id) {
    fullPlayer.style.setProperty('--p1', palette[0]);
    fullPlayer.style.setProperty('--p2', palette[1]);
  }
}

// ============================================================
// Storage (IndexedDB)
// Version 2 adds the "playlists" store. Existing songs are kept
// ============================================================
const DB_NAME = 'glass-music';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('songs')) {
        d.createObjectStore('songs', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('playlists')) {
        d.createObjectStore('playlists', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Runs one request in a transaction and resolves with its result
function dbRun(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = action(tx.objectStore(storeName));
    let result;
    if (req) {
      req.onsuccess = () => {
        result = req.result;
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function toTrack(record) {
  return {
    id: record.id,
    title: record.title,
    album: record.album || '',
    artist: record.artist || '',
    format: record.format,
    art: record.art || null,
    hue: hashHue(record.title),
    url: URL.createObjectURL(record.file),
    file: record.file,
    failed: false,
    palette: null,
  };
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

  const skipped = [];
  let added = 0;

  for (const file of files) {
    const ext = getExtension(file.name);
    if (!SUPPORTED.includes(ext)) {
      skipped.push(file.name);
      continue;
    }

    const tags = await readTags(file);
    const record = {
      id: newId(),
      title: (tags && tags.title) || file.name.replace(/\.[^.]+$/, ''),
      album: (tags && tags.album) || '',
      artist: (tags && tags.artist) || '',
      format: ext.toUpperCase(),
      art: tags && tags.picture ? pictureToDataUrl(tags.picture) : null,
      file,
      addedAt: Date.now(),
      tagsRead: true,
    };

    try {
      await dbRun('songs', 'readwrite', (s) => s.put(record));
    } catch (err) {
      // If saving fails, the song still works for this visit
    }

    tracks.push(toTrack(record));
    added++;
    renderMain();
  }

  const parts = [];
  if (added) parts.push(`Added ${added} ${added === 1 ? 'song' : 'songs'}`);
  if (skipped.length) parts.push(`${skipped.length} skipped (unsupported format)`);
  if (parts.length) showToast(parts.join('. ') + '.');
}

fileInput.addEventListener('change', handleFiles);

// Songs saved by an earlier version are updated with album, artist and cover art
async function refreshOldTags(records) {
  if (!window.jsmediatags) return;

  for (const rec of records) {
    if (rec.tagsRead) continue;

    const tags = await readTags(rec.file);
    if (tags) {
      rec.title = tags.title || rec.title;
      rec.album = tags.album || '';
      rec.artist = tags.artist || '';
      rec.art = tags.picture ? pictureToDataUrl(tags.picture) : null;
    }
    rec.tagsRead = true;

    try {
      await dbRun('songs', 'readwrite', (s) => s.put(rec));
    } catch (err) {
      // Keep going even if one song can't be saved
    }

    const t = byId(rec.id);
    if (t) {
      Object.assign(t, {
        title: rec.title,
        album: rec.album,
        artist: rec.artist,
        art: rec.art,
        hue: hashHue(rec.title),
        palette: null,
      });
    }
    renderMain();
    if (currentId === rec.id) updateNowPlayingUI();
  }
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

function backToPlaylists() {
  view = 'playlists';
  viewPlaylistId = null;
  renderMain();
}

onTap('back-btn', backToPlaylists);

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value;
  renderMain();
});

// ============================================================
// Main screen rendering
// ============================================================
function renderMain() {
  // Playlist may have been deleted while open
  let playlist = null;
  if (view === 'playlist') {
    playlist = playlists.find((p) => p.id === viewPlaylistId) || null;
    if (!playlist) view = 'playlists';
  }

  const isPlaylists = view === 'playlists';
  const isPlaylist = view === 'playlist';
  const isSearch = view === 'search';

  // Header
  const titles = { library: 'Library', search: 'Search', playlists: 'Playlists' };
  pageTitle.textContent = isPlaylist ? playlist.name : titles[view];

  $('back-btn').hidden = !isPlaylist;
  $('add-btn').hidden = view !== 'library';
  $('new-playlist-btn').hidden = !isPlaylists;
  $('playlist-tools').hidden = !isPlaylist;
  searchEl.hidden = !isSearch;
  playlistList.hidden = !isPlaylists;
  trackList.hidden = isPlaylists;
  emptyBox.hidden = !(view === 'library' && tracks.length === 0);

  // Which songs the track list should show
  let ids = [];
  if (view === 'library') {
    ids = tracks.map((t) => t.id);
  } else if (isSearch) {
    const q = searchQuery.trim().toLowerCase();
    ids = tracks
      .filter((t) => !q || [t.title, t.album, t.artist].some((s) => s.toLowerCase().includes(q)))
      .map((t) => t.id);
  } else if (isPlaylist) {
    ids = playlist.trackIds.filter((id) => byId(id));
  }

  if (isPlaylists) {
    countEl.textContent = `${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}`;
    renderPlaylists();
  } else {
    countEl.textContent = `${ids.length} ${ids.length === 1 ? 'song' : 'songs'}`;
    renderTracks(ids, isPlaylist);
  }

  // Tab highlight
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === activeTab);
  });

  if (queueOpen) renderQueue();
}

function renderPlaylists() {
  playlistList.innerHTML = '';

  if (playlists.length === 0) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'No playlists yet. Tap New Playlist to create one.';
    playlistList.appendChild(none);
    return;
  }

  for (const p of playlists) {
    const row = document.createElement('li');
    row.className = 'track-row';

    const art = document.createElement('div');
    art.className = 'art row';
    art.style.cssText = gradientStyle(hashHue(p.name));
    art.innerHTML = ICON.playlist;

    const text = document.createElement('div');
    text.className = 'track-text';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = p.name;

    const sub = document.createElement('div');
    sub.className = 'track-sub';
    const n = p.trackIds.filter((id) => byId(id)).length;
    sub.textContent = `${n} ${n === 1 ? 'song' : 'songs'}`;

    text.append(title, sub);
    row.append(art, text);
    row.addEventListener('click', () => {
      haptic();
      openPlaylist(p.id);
    });
    playlistList.appendChild(row);
  }
}

function renderTracks(ids, inPlaylist) {
  trackList.innerHTML = '';

  if (ids.length === 0) {
    const none = document.createElement('li');
    none.className = 'no-match';
    if (inPlaylist) {
      none.textContent = 'This playlist is empty. Tap ⋯ on a song in your library and choose Add to Playlist.';
    } else if (view === 'search') {
      none.textContent = 'No matching songs';
    }
    if (none.textContent) trackList.appendChild(none);
    return;
  }

  for (const id of ids) {
    const track = byId(id);
    if (!track) continue;

    const row = document.createElement('li');
    let className = 'track-row';
    if (id === currentId) className += ' playing';
    if (track.failed) className += ' failed';
    row.className = className;

    const art = document.createElement('div');
    art.className = 'art row';
    applyArt(art, track);

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
    trackList.appendChild(row);
  }
}

// ============================================================
// Action sheet
// ============================================================
function openSheet({ title, message = '', actions = [], input = null }) {
  const sheet = $('sheet');
  sheet.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'sheet-card glass';

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
    btn.className = 'sheet-btn'
      + (action.primary ? ' primary' : '')
      + (action.danger ? ' danger' : '');
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

  sheet.append(card);
  sheet.hidden = false;
  sheet.onclick = (e) => {
    if (e.target === sheet) closeSheet();
  };
  if (field) setTimeout(() => field.focus(), 60);
}

function closeSheet() {
  const sheet = $('sheet');
  sheet.hidden = true;
  sheet.innerHTML = '';
}

function openSongOptions(id, inPlaylist) {
  const track = byId(id);
  if (!track) return;

  const actions = [
    { label: 'Add to Playlist', onClick: () => openChoosePlaylist(id) },
  ];
  if (inPlaylist) {
    actions.push({
      label: 'Remove from This Playlist',
      onClick: () => removeFromPlaylist(viewPlaylistId, id),
    });
  }
  actions.push({
    label: 'Remove from Library',
    danger: true,
    onClick: () => removeTrack(id),
  });

  openSheet({ title: track.title, message: subtitleFor(track), actions });
}

function openChoosePlaylist(trackId) {
  const actions = playlists.map((p) => ({
    label: p.name,
    onClick: () => addToPlaylist(p.id, trackId),
  }));
  actions.push({
    label: 'New Playlist…',
    onClick: () => openNewPlaylist(trackId),
  });

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
    actions: [
      {
        label: 'Create',
        primary: true,
        onClick: async (name) => {
          if (!name) return;
          const p = await createPlaylist(name);
          if (trackId) await addToPlaylist(p.id, trackId);
        },
      },
    ],
  });
}

function openPlaylistOptions() {
  const p = playlists.find((x) => x.id === viewPlaylistId);
  if (!p) return;

  openSheet({
    title: p.name,
    actions: [
      {
        label: 'Rename Playlist',
        onClick: () => openRenamePlaylist(p),
      },
      {
        label: 'Delete Playlist',
        danger: true,
        onClick: () => deletePlaylist(p),
      },
    ],
  });
}

function openRenamePlaylist(p) {
  openSheet({
    title: 'Rename Playlist',
    input: { placeholder: 'Playlist name', value: p.name },
    actions: [
      {
        label: 'Save',
        primary: true,
        onClick: (name) => renamePlaylist(p, name),
      },
    ],
  });
}

// ============================================================
// Playlists
// ============================================================
async function persistPlaylist(p) {
  try {
    await dbRun('playlists', 'readwrite', (s) => s.put(p));
  } catch (err) {
    // Playlist still works for this visit
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
    // Ignore storage errors here
  }
  view = 'playlists';
  viewPlaylistId = null;
  showToast(`Deleted "${p.name}"`);
  renderMain();
}

// Shuffle play for a whole playlist: a random song starts, then the rest in a new random order
function playPlaylistShuffled() {
  const p = playlists.find((x) => x.id === viewPlaylistId);
  if (!p) return;
  const ids = p.trackIds.filter((id) => byId(id));
  if (!ids.length) return;

  shuffleOn = true;
  setShuffleState();
  startQueue(ids, ids[randomInt(ids.length)]);
}

onTap('playlist-shuffle', playPlaylistShuffled);
$('playlist-more').addEventListener('click', () => {
  haptic();
  openPlaylistOptions();
});
$('new-playlist-btn').addEventListener('click', () => {
  haptic();
  openNewPlaylist(null);
});

// ============================================================
// Removing a song from the library
// ============================================================
async function removeTrack(id) {
  const track = byId(id);
  if (!track) return;

  if (id === currentId) {
    currentId = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    mini.hidden = true;
    closeFull();
  }

  base = base.filter((x) => x !== id);
  order = order.filter((x) => x !== id);
  tracks = tracks.filter((t) => t.id !== id);
  URL.revokeObjectURL(track.url);

  playlists.forEach((p) => {
    p.trackIds = p.trackIds.filter((x) => x !== id);
  });

  try {
    await dbRun('songs', 'readwrite', (s) => s.delete(id));
    for (const p of playlists) {
      await persistPlaylist(p);
    }
  } catch (err) {
    // The song is still gone from this visit
  }

  showToast(`Removed "${track.title}"`);
  renderMain();
}

// ============================================================
// Queue and playback
// ============================================================

// Starts playing a list. Shuffle decides the order of the rest of the songs
function startQueue(ids, startId = null) {
  if (!ids.length) return;

  base = ids.slice();
  if (!startId || !base.includes(startId)) {
    startId = shuffleOn ? base[randomInt(base.length)] : base[0];
  }

  currentId = startId;
  order = shuffleOn ? shuffledWithFirst(base, currentId) : base.slice();
  playCurrent();
}

function playCurrent() {
  const track = byId(currentId);
  if (!track) return;

  audio.src = track.url;
  audio.play().catch(() => {}); // Errors are handled by the audio "error" event below

  updateNowPlayingUI();
  renderMain();
}

// Returns the song before or after the current one in play order, or null when playback should stop
function neighborId(step) {
  if (!order.length) return null;

  const pos = order.indexOf(currentId);
  if (pos === -1) return order[0];

  const target = pos + step;
  if (target >= 0 && target < order.length) return order[target];

  if (step > 0) {
    // End of the list: repeat-all starts a new pass, otherwise playback stops
    if (repeatMode !== 1) return null;
    order = shuffleOn ? reshuffleAfterPass(base, currentId) : base.slice();
    return order[0];
  }

  return repeatMode === 1 ? order[order.length - 1] : null;
}

function next() {
  const id = neighborId(1);
  if (id === null) {
    audio.pause();
    audio.currentTime = 0;
    setPlayIcons(false);
    return;
  }
  currentId = id;
  playCurrent();
}

function prev() {
  // Past 3 seconds: restart the song. Otherwise go to the previous one
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const id = neighborId(-1);
  if (id === null) {
    audio.currentTime = 0;
    return;
  }
  currentId = id;
  playCurrent();
}

function togglePlay() {
  if (!currentId) {
    const ids = base.length ? base : tracks.map((t) => t.id);
    if (ids.length) startQueue(ids, null);
    return;
  }
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  if (base.length) {
    order = shuffleOn ? shuffledWithFirst(base, currentId) : base.slice();
  }
  setShuffleState();
}

function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  setRepeatState();
}

// Songs that will play after the current one, in play order
function upcomingIds() {
  const pos = order.indexOf(currentId);
  if (pos === -1) return [];
  let list = order.slice(pos + 1);
  if (!list.length && repeatMode === 1) list = order.slice();
  return list;
}

function renderQueue() {
  const ul = $('queue-list');
  ul.innerHTML = '';

  const ids = upcomingIds().slice(0, 50);
  if (!ids.length) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'Nothing up next';
    ul.appendChild(none);
    return;
  }

  for (const id of ids) {
    const track = byId(id);
    if (!track) continue;

    const li = document.createElement('li');
    li.className = 'queue-row';

    const art = document.createElement('div');
    art.className = 'art row';
    applyArt(art, track);

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
      currentId = id;
      playCurrent();
    });
    ul.appendChild(li);
  }
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
  applyArt($('mini-art'), track);

  $('fp-title').textContent = track.title;
  $('fp-sub').textContent = subtitleFor(track);
  applyArt($('fp-art'), track);

  applyPalette(track);
  setMediaSession(track);
  if (queueOpen) renderQueue();
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

// ============================================================
// Full player open and close
// ============================================================
function openFull() {
  if (!currentId) return;
  fullPlayer.classList.add('open');
  fullPlayer.setAttribute('aria-hidden', 'false');
}

function closeFull() {
  fullPlayer.classList.remove('open');
  fullPlayer.setAttribute('aria-hidden', 'true');
}

$('mini-open').addEventListener('click', () => {
  haptic();
  openFull();
});
onTap('close-full', closeFull);
onTap('queue-btn', toggleQueue);

// Swipe down to close
let touchStartY = null;

fullPlayer.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

fullPlayer.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  if (e.changedTouches[0].clientY - touchStartY > 90) closeFull();
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
audio.addEventListener('play', () => setPlayIcons(true));
audio.addEventListener('pause', () => setPlayIcons(false));

audio.addEventListener('timeupdate', () => {
  const d = audio.duration;
  if (!isFinite(d) || d === 0) return;

  const fraction = audio.currentTime / d;
  $('mini-bar').style.width = fraction * 100 + '%';

  if (!seeking) {
    progress.value = fraction * 1000;
    $('t-now').textContent = formatTime(audio.currentTime);
  }
  $('t-left').textContent = '-' + formatTime(d - audio.currentTime);
});

audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    next();
  }
});

audio.addEventListener('error', () => {
  const track = byId(currentId);
  if (!track) return;
  track.failed = true;
  showToast(`Can't play "${track.title}". This file may use an unsupported encoding.`);
  setPlayIcons(false);
  renderMain();
});

// ============================================================
// Progress slider
// ============================================================
progress.addEventListener('input', () => {
  seeking = true;
  if (isFinite(audio.duration)) {
    $('t-now').textContent = formatTime((progress.value / 1000) * audio.duration);
  }
});

progress.addEventListener('change', () => {
  if (isFinite(audio.duration)) {
    audio.currentTime = (progress.value / 1000) * audio.duration;
  }
  seeking = false;
});

// ============================================================
// Lock screen and Control Center
// ============================================================
function setMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || track.album || '',
    album: track.album || '',
    artwork: track.art
      ? [{ src: track.art, sizes: '512x512', type: track.art.slice(5, track.art.indexOf(';')) }]
      : [],
  });

  const handlers = {
    play: () => audio.play().catch(() => {}),
    pause: () => audio.pause(),
    previoustrack: prev,
    nexttrack: next,
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
// Start up
// ============================================================
async function init() {
  setIcons();
  setPlayIcons(false);
  setShuffleState();
  setRepeatState();
  renderMain();

  try {
    db = await openDatabase();

    const saved = await dbRun('songs', 'readonly', (s) => s.getAll());
    saved.sort((a, b) => a.addedAt - b.addedAt);
    tracks = saved.map(toTrack);

    playlists = (await dbRun('playlists', 'readonly', (s) => s.getAll())) || [];
    playlists.sort((a, b) => a.createdAt - b.createdAt);

    renderMain();

    // Runs in the background, so the library appears immediately
    refreshOldTags(saved);
  } catch (err) {
    showToast("Couldn't open saved storage. Songs will only last this visit.");
  }

  // Asks the browser not to clear this app's data when storage runs low
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

init();
