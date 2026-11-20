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

// ============================================================
// Supported formats
// Extensions are compared in lowercase. Anything else is skipped with a message
// ============================================================
const SUPPORTED = ['mp3', 'm4a', 'mp4', 'm4b', 'aac', 'flac', 'wav', 'aif', 'aiff', 'caf'];

// ============================================================
// State
// ============================================================
let tracks = [];          // Each item: { title, format, url, hue, failed }
let current = -1;         // Index of the playing track, -1 means none
let activeTab = 'library';
let searchQuery = '';
let shuffleOn = false;
let repeatMode = 0;       // 0 = off, 1 = repeat all, 2 = repeat one
let seeking = false;      // True while the user drags the progress slider
let toastTimer = null;

// ============================================================
// Helpers
// ============================================================

// Turns a song name into a number from 0 to 359, which is used as a color.
// The same name always produces the same color.
function hashHue(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) % 360;
  }
  return h;
}

// CSS for an artwork tile, built from a hue
function artStyle(hue) {
  return `background: linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 60) % 360} 80% 34%))`;
}

// Converts seconds into m:ss, for example 185 becomes "3:05"
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Returns the extension of a file name, in lowercase: "Song.FLAC" becomes "flac"
function getExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

// Shows a short message at the top of the screen
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

// Updates the "12 songs" text and switches the empty message on or off
function updateCountAndEmpty() {
  const n = tracks.length;
  countEl.textContent = n === 0 ? 'No songs yet' : `${n} ${n === 1 ? 'song' : 'songs'}`;
  emptyBox.hidden = n > 0;
}

// ============================================================
// Adding songs
// ============================================================
function openPicker() {
  fileInput.click();
}

$('add-btn').addEventListener('click', openPicker);
$('empty-add').addEventListener('click', openPicker);

fileInput.addEventListener('change', () => {
  const skipped = [];

  for (const file of fileInput.files) {
    const ext = getExtension(file.name);

    if (!SUPPORTED.includes(ext)) {
      skipped.push(file.name);
      continue;
    }

    const title = file.name.replace(/\.[^.]+$/, '');
    tracks.push({
      title,
      format: ext.toUpperCase(),
      url: URL.createObjectURL(file), // Temporary local link to the file
      hue: hashHue(title),
      failed: false,
    });
  }

  fileInput.value = ''; // Clear the picker so the same file can be chosen again later

  renderList();
  updateCountAndEmpty();

  if (skipped.length) {
    showToast(`${skipped.length} file(s) skipped. This format is not supported.`);
  }
});

// ============================================================
// Tabs and search
// ============================================================
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;

    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

    const isSearch = activeTab === 'search';
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
    art.style.cssText = artStyle(track.hue);
    art.textContent = '♪';

    const text = document.createElement('div');
    text.className = 'track-text';

    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = track.title; // textContent is safer than innerHTML for file names

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
  audio.play().catch(() => {}); // iOS can block playback. Errors are handled by the audio "error" event

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

// Returns the index of the next song, or null if playback should stop
function getNextIndex() {
  if (shuffleOn && tracks.length > 1) {
    let r;
    do {
      r = Math.floor(Math.random() * tracks.length);
    } while (r === current); // Never repeat the same song twice in a row
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
  // Past 3 seconds: restart the song. Otherwise go to the previous song
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
  $('mini-art').style.cssText = artStyle(track.hue);
  $('mini-art').textContent = '♪';

  $('fp-title').textContent = track.title;
  $('fp-sub').textContent = `${track.format} · On This Device`;
  $('fp-art').style.cssText = artStyle(track.hue);
  $('fp-art').textContent = '♪';

  setMediaSession(track);
}

function setPlayIcons(isPlaying) {
  const symbol = isPlaying ? '❚❚' : '▶';
  $('play').textContent = symbol;
  $('mini-play').textContent = symbol;
}

function setShuffleIcon() {
  $('shuffle').classList.toggle('on', shuffleOn);
}

function setRepeatIcon() {
  const btn = $('repeat');
  btn.classList.toggle('on', repeatMode !== 0);
  btn.textContent = repeatMode === 2 ? '↻1' : '↻';
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

// Swipe down to close, as in Apple Music
let touchStartY = null;

fullPlayer.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

fullPlayer.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy > 90) closeFull();
  touchStartY = null;
});

// ============================================================
// Button wiring
// ============================================================
$('play').addEventListener('click', togglePlay);
$('next').addEventListener('click', next);
$('prev').addEventListener('click', prev);

$('mini-play').addEventListener('click', togglePlay);
$('mini-next').addEventListener('click', next);

$('shuffle').addEventListener('click', () => {
  shuffleOn = !shuffleOn;
  setShuffleIcon();
});

$('repeat').addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3; // Cycles: off, all, one, off...
  setRepeatIcon();
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

// If the browser can't decode a file, mark it and tell the user
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
// Lock screen and Control Center controls
// ============================================================
function setMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: 'On This Device',
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
      // Some browsers don't support every action. Those are skipped
    }
  }
}

// ============================================================
// Start
// ============================================================
setPlayIcons(false);
setShuffleIcon();
setRepeatIcon();
renderList();
updateCountAndEmpty();
