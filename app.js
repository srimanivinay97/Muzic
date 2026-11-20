// ---------- Short helper for getting elements ----------
const $ = (id) => document.getElementById(id);

const audio = $('audio');
const fileInput = $('file-input');
const trackList = $('track-list');
const emptyMsg = $('empty');
const searchEl = $('search');
const pageTitle = $('page-title');
const mini = $('mini');
const progress = $('progress');

// ---------- State ----------
let tracks = [];          // Each item: { title, url, hue }
let current = -1;         // Index of the playing track, -1 = none
let activeTab = 'library';
let searchQuery = '';
let shuffleOn = false;
let repeatMode = 0;       // 0 = off, 1 = repeat all, 2 = repeat one
let seeking = false;      // True while the user drags the progress slider

// ---------- Helpers ----------

// Turns a song name into a number from 0 to 359 (a color). The same name always gives the same color.
function hashHue(text) {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) % 360;
  }
  return h;
}

// Builds a gradient for the artwork tile from a hue
function artStyle(hue) {
  return `background: linear-gradient(135deg, hsl(${hue} 85% 65%), hsl(${(hue + 60) % 360} 80% 35%))`;
}

// Converts seconds into "m:ss", for example 185 becomes "3:05"
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------- Adding songs ----------
$('add-btn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    // Remove the extension: "song.mp3" becomes "song"
    const title = file.name.replace(/\.[^.]+$/, '');
    tracks.push({
      title,
      url: URL.createObjectURL(file), // A temporary local link to the file on the device
      hue: hashHue(title),
    });
  }
  fileInput.value = ''; // Clear the picker so choosing the same file again still works
  renderList();
});

// ---------- Tabs and search ----------
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

// ---------- Song list ----------
function renderList() {
  const q = searchQuery.trim().toLowerCase();

  // Keep each track's real index so clicking it still plays the right song
  const visible = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !q || track.title.toLowerCase().includes(q));

  trackList.innerHTML = '';
  emptyMsg.hidden = tracks.length > 0;

  if (tracks.length > 0 && visible.length === 0) {
    const none = document.createElement('li');
    none.className = 'no-match';
    none.textContent = 'No matching songs';
    trackList.appendChild(none);
    return;
  }

  for (const { track, index } of visible) {
    const row = document.createElement('li');
    row.className = 'track-row' + (index === current ? ' playing' : '');

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
    sub.textContent = 'On This Device';

    text.append(title, sub);
    row.append(art, text);
    row.addEventListener('click', () => playIndex(index));
    trackList.appendChild(row);
  }
}

// ---------- Playback ----------
function playIndex(index) {
  if (index < 0 || index >= tracks.length) return;

  current = index;
  audio.src = tracks[index].url;
  audio.play().catch(() => {}); // iOS can block playback, so ignore the error quietly

  updateNowPlayingUI();
  renderList();
}

function togglePlay() {
  if (current === -1) {
    playIndex(0);               // Nothing chosen yet, so start with the first song
  } else if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

// Returns the index of the next song, or null if the list should stop
function getNextIndex() {
  if (shuffleOn && tracks.length > 1) {
    let r;
    do {
      r = Math.floor(Math.random() * tracks.length);
    } while (r === current);    // Avoid picking the same song twice in a row
    return r;
  }
  const n = current + 1;
  if (n < tracks.length) return n;
  return repeatMode === 1 ? 0 : null; // Repeat-all wraps to the start, otherwise stop
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
  // More than 3 seconds in: restart the song. Otherwise go back one track
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (tracks.length === 0) return;
  playIndex(current <= 0 ? tracks.length - 1 : current - 1);
}

// ---------- Now Playing UI ----------
function updateNowPlayingUI() {
  const track = tracks[current];
  if (!track) return;

  mini.hidden = false;
  $('mini-title').textContent = track.title;
  $('fp-title').textContent = track.title;
  $('mini-art').style.cssText = artStyle(track.hue);
  $('fp-art').style.cssText = artStyle(track.hue);
  $('fp-art').textContent = '♪';
  $('mini-art').textContent = '♪';

  setMediaSession(track);
}

function setPlayIcons(isPlaying) {
  const symbol = isPlaying ? '❚❚' : '▶';
  $('play').textContent = symbol;
  $('mini-play').textContent = symbol;
}

function setShuffleIcon() {
  const btn = $('shuffle');
  btn.classList.toggle('on', shuffleOn);
}

function setRepeatIcon() {
  const btn = $('repeat');
  btn.classList.toggle('on', repeatMode !== 0);
  btn.textContent = repeatMode === 2 ? '↻1' : '↻';
}

// ---------- Open and close the full player ----------
function openFull() {
  if (current === -1) return;
  $('full-player').classList.add('open');
  $('full-player').setAttribute('aria-hidden', 'false');
}

function closeFull() {
  $('full-player').classList.remove('open');
  $('full-player').setAttribute('aria-hidden', 'true');
}

$('mini-open').addEventListener('click', openFull);
$('close-full').addEventListener('click', closeFull);

// Swipe down to close the full player, like on Apple Music
let touchStartY = null;
const fullPlayer = $('full-player');

fullPlayer.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

fullPlayer.addEventListener('touchend', (e) => {
  if (touchStartY === null) return;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy > 90) closeFull(); // Dragged down more than 90 pixels
  touchStartY = null;
});

// ---------- Button wiring ----------
$('play').addEventListener('click', togglePlay);
$('mini-play').addEventListener('click', (e) => {
  e.stopPropagation(); // Don't also open the full player
  togglePlay();
});
$('next').addEventListener('click', next);
$('mini-next').addEventListener('click', (e) => {
  e.stopPropagation();
  next();
});
$('prev').addEventListener('click', prev);

$('shuffle').addEventListener('click', () => {
  shuffleOn = !shuffleOn;
  setShuffleIcon();
});

$('repeat').addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3; // Cycles: off, all, one, off...
  setRepeatIcon();
});

// ---------- Audio element events ----------
audio.addEventListener('play', () => setPlayIcons(true));
audio.addEventListener('pause', () => setPlayIcons(false));

audio.addEventListener('timeupdate', () => {
  const d = audio.duration;
  if (!isFinite(d) || d === 0) return;

  const fraction = audio.currentTime / d;
  $('mini-bar').style.width = (fraction * 100) + '%';

  // Don't move the slider while the user is dragging it
  if (!seeking) {
    progress.value = fraction * 1000;
    $('t-now').textContent = formatTime(audio.currentTime);
  }
  $('t-left').textContent = '-' + formatTime(d - audio.currentTime);
});

audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    audio.currentTime = 0;      // Repeat one: play the same song again
    audio.play().catch(() => {});
  } else {
    next();
  }
});

// ---------- Progress slider ----------
progress.addEventListener('input', () => {
  seeking = true;
  if (isFinite(audio.duration)) {
    $('t-now').textContent = formatTime((progress.value / 1000) * audio.duration);
  }
});

progress.addEventListener('change', () => {
  // "change" fires once when the finger lifts, so we jump only once
  if (isFinite(audio.duration)) {
    audio.currentTime = (progress.value / 1000) * audio.duration;
  }
  seeking = false;
});

// ---------- Lock screen and Control Center controls ----------
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
      // Some browsers don't support every action. Skip those quietly
    }
  }
}

// ---------- Start ----------
setPlayIcons(false);
setShuffleIcon();
setRepeatIcon();
renderList();
