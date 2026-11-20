// ============================================================
// Element references
// ============================================================
const $ = (id) => document.getElementById(id);

const audio = $('audio');
const fileInput = $('file-input');
const trackList = $('track-list');
const emptyBox = $('empty');
const searchEl = $('search');
const pageTitle = $('page-title');
const countEl = $('count');
const mini = $('mini');
const progress = $('progress');
const fullPlayer = $('full-player');

// File types the picker accepts and the app plays
const SUPPORTED = ['mp3', 'm4a', 'mp4', 'm4b', 'aac', 'flac', 'wav', 'aif', 'aiff', 'caf'];

// ============================================================
// Icons (SVG drawn in the same style as Apple's icons)
// ============================================================

// Builds an SVG. "filled" icons use solid shapes, others use outlines
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
};

// Puts the icons into their buttons
function setIcons() {
  $('shuffle').innerHTML = ICON.shuffle;
  $('prev').innerHTML = ICON.prev;
  $('next').innerHTML = ICON.next;
  $('mini-next').innerHTML = ICON.next;
  $('repeat').innerHTML = ICON.repeat;
  document.querySelector('[data-icon="note"]').innerHTML = ICON.note;
  document.querySelector('[data-icon="search"]').innerHTML = ICON.search;
}

// ============================================================
// State
// ============================================================
let tracks = [];          // Each: { id, title, format, art, hue, url, failed }
let current = -1;         // Index of the playing track, -1 = none
let db = null;            // The IndexedDB database
let searchQuery = '';
let shuffleOn = false;
let repeatMode = 0;       // 0 = off, 1 = repeat all, 2 = repeat one
let seeking = false;      // True while the user drags the progress slider
let toastTimer = null;

// ============================================================
// Helpers
// ============================================================

// Turns a text into a number from 0 to 359 for a color. Same text, same color
function hashHue(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) % 360;
  }
  return h;
}

// Gradient used when a song has no cover art
function gradientStyle(hue) {
  return `background: linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 60) % 360} 80% 34%))`;
}

// Converts seconds into m:ss, for example 185 becomes "3:05"
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// "Song.FLAC" becomes "flac"
function getExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

// Creates a unique id for each saved song
function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function updateCountAndEmpty() {
  const n = tracks.length;
  countEl.textContent = n === 0 ? 'No songs yet' : `${n} ${n === 1 ? 'song' : 'songs'}`;
  emptyBox.hidden = n > 0;
}

// ============================================================
// Metadata: title and cover art from the file
// ============================================================

// Reads the tags inside an audio file. Resolves to null if the file has none or can't be read
function readTags(file) {
  return new Promise((resolve) => {
    if (!window.jsmediatags) {
      resolve(null); // The library didn't load, for example if there is no internet
      return;
    }
    window.jsmediatags.read(file, {
      onSuccess: (result) => resolve(result.tags),
      onError: () => resolve(null),
    });
  });
}

// Converts the raw image bytes from the tags into a data URL that <img> and CSS can use
function pictureToDataUrl(picture) {
  const bytes = picture.data;
  let binary = '';
  const chunk = 0x8000; // Converting in pieces avoids errors with large images
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.slice(i, i + chunk));
  }
  const mime = picture.format && picture.format.includes('/') ? picture.format : 'image/jpeg';
  return `data:${mime};base64,${btoa(binary)}`;
}

// Fills an artwork tile with cover art if the song has it, otherwise a colored tile with a note icon
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
// Storage: keeps songs on the phone between visits (IndexedDB)
// ============================================================
const DB_NAME = 'glass-music';
const STORE = 'songs';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Saves one song. The actual file (a Blob) is stored, so the song survives a refresh
function saveSong(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function loadSongs() {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Converts a saved record into a track the player can use
function toTrack(record) {
  return {
    id: record.id,
    title: record.title,
    format: record.format,
    art: record.art,
    hue: hashHue(record.title),
    url: URL.createObjectURL(record.file), // A fresh local link for this session
    failed: false,
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
  // Copy the list first, then clear the picker so the same file can be chosen again later
  const files = Array.from(fileInput.files);
  fileInput.value = '';

  const skipped = [];
  let added = 0;

  for (const file of files) {
    const ext = getExtension(file.name);
    if (!SUPPORTED.includes(ext)) {
      skipped.push(file.name);
      continue;
    }

    // Read the tags. If there are none, fall back to the file name
    const tags = await readTags(file);
    const title = tags && tags.title ? tags.title : file.name.replace(/\.[^.]+$/, '');
    const art = tags && tags.picture ? pictureToDataUrl(tags.picture) : null;

    const record = {
      id: newId(),
      title,
      format: ext.toUpperCase(),
      art,
      file,
      addedAt: Date.now(),
    };

    try {
      await saveSong(record);
    } catch (err) {
      // If saving fails, the song still works for this visit
    }

    tracks.push(toTrack(record));
    added++;
    renderList();
    updateCountAndEmpty();
  }

  const parts = [];
  if (added) parts.push(`Added ${added} ${added === 1 ? 'song' : 'songs'}`);
  if (skipped.length) parts.push(`${skipped.length} skipped (unsupported format)`);
  if (parts.length) showToast(parts.join('. ') + '.');
}

fileInput.addEventListener('change', handleFiles);

// ============================================================
// Tabs and search
// ============================================================
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

    const isSearch = btn.dataset.tab === 'search';
    pageTitle.textContent = isSearch ? 'Search' : 'Library';
    searchEl.hidden = !isSearch;

    if (isSearch) {
      searchEl.focus();
    } else {
      searchEl.value = '';
      searchQuery = '';
    }
    renderList();
  });
});

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value;
  renderList();
});

// ============================================================
// Song list
// ============================================================
function renderList() {
  const q = searchQuery.trim().toLowerCase();

  // Keep each track's real index so the right song plays even when the list is filtered
  const visible = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !q || track.title.toLowerCase().includes(q));

  trackList.innerHTML = '';

  if (tracks.length > 0 && visible.length === 0) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'No matching songs';
    trackList.appendChild(none);
    return;
  }

  for (const { track, index } of visible) {
    const row = document.createElement('li');
    let className = 'track-row';
    if (index === current) className += ' playing';
    if (track.failed) className += ' failed';
    row.className = className;

    const art = document.createElement('div');
    art.className = 'art row';
    applyArt(art, track);

    const text = document.createElement('div');
    text.className = 'track-text';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title; // textContent keeps odd file names safe

    const sub = document.createElement('div');
    sub.className = 'track-sub';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = track.format;

    const label = document.createElement('span');
    label.textContent = track.failed ? "Can't play on this device" : 'On This Device';

    sub.append(badge, label);
    text.append(title, sub);
    row.append(art, text);
    row.addEventListener('click', () => playIndex(index));
    trackList.appendChild(row);
  }
}

// ============================================================
// Playback
// ============================================================
function playIndex(index) {
  if (index < 0 || index >= tracks.length) return;

  current = index;
  audio.src = tracks[index].url;
  audio.play().catch(() => {}); // Errors are handled by the audio "error" event below

  updateNowPlayingUI();
  renderList();
}

function togglePlay() {
  if (current === -1) {
    playIndex(0);
  } else if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

// Returns the next index, or null if playback should stop
function getNextIndex() {
  if (shuffleOn && tracks.length > 1) {
    let r;
    do {
      r = Math.floor(Math.random() * tracks.length);
    } while (r === current);
    return r;
  }
  const n = current + 1;
  if (n < tracks.length) return n;
  return repeatMode === 1 ? 0 : null;
}

function next() {
  if (tracks.length === 0) return;
  const n = getNextIndex();
  if (n === null) {
    audio.pause();
    audio.currentTime = 0;
  } else {
    playIndex(n);
  }
}

function prev() {
  // Past 3 seconds: restart the song. Otherwise go to the previous one
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (tracks.length === 0) return;
  playIndex(current <= 0 ? tracks.length - 1 : current - 1);
}

// ============================================================
// Now Playing UI
// ============================================================
function updateNowPlayingUI() {
  const track = tracks[current];
  if (!track) return;

  mini.hidden = false;
  $('mini-title').textContent = track.title;
  applyArt($('mini-art'), track);

  $('fp-title').textContent = track.title;
  $('fp-sub').textContent = `${track.format} · On This Device`;
  applyArt($('fp-art'), track);

  setMediaSession(track);
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
  if (current === -1) return;
  fullPlayer.classList.add('open');
  fullPlayer.setAttribute('aria-hidden', 'false');
}

function closeFull() {
  fullPlayer.classList.remove('open');
  fullPlayer.setAttribute('aria-hidden', 'true');
}

$('mini-open').addEventListener('click', openFull);
$('close-full').addEventListener('click', closeFull);

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
$('play').addEventListener('click', togglePlay);
$('next').addEventListener('click', next);
$('prev').addEventListener('click', prev);
$('mini-play').addEventListener('click', togglePlay);
$('mini-next').addEventListener('click', next);

$('shuffle').addEventListener('click', () => {
  shuffleOn = !shuffleOn;
  setShuffleState();
});

$('repeat').addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  setRepeatState();
});

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
  if (current === -1) return;
  const track = tracks[current];
  track.failed = true;
  showToast(`Can't play "${track.title}". This file may use an unsupported encoding.`);
  setPlayIcons(false);
  renderList();
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
    artist: 'On This Device',
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
// Start up: draw the UI, open the database, load saved songs
// ============================================================
async function init() {
  setIcons();
  setPlayIcons(false);
  setShuffleState();
  setRepeatState();
  renderList();
  updateCountAndEmpty();

  try {
    db = await openDatabase();
    const saved = await loadSongs();
    saved.sort((a, b) => a.addedAt - b.addedAt);
    tracks = saved.map(toTrack);
    renderList();
    updateCountAndEmpty();
  } catch (err) {
    showToast("Couldn't open saved storage. Songs will only last this visit.");
  }

  // Asks the browser to keep this site's data instead of clearing it under storage pressure
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

init();
