// ---------- Element references ----------
const audio = document.getElementById('audio');
const addBtn = document.getElementById('add-btn');
const fileInput = document.getElementById('file-input');
const list = document.getElementById('track-list');
const player = document.getElementById('now-playing');
const titleEl = document.getElementById('title');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const progress = document.getElementById('progress');

// ---------- State ----------
let tracks = [];       // Each item: { name, url }
let current = -1;      // Index of the playing track, -1 means none
let seeking = false;   // True while the user is dragging the progress slider

// ---------- Adding files ----------
addBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    tracks.push({
      // Remove the extension: "song.mp3" becomes "song"
      name: file.name.replace(/\.[^.]+$/, ''),
      // A temporary local link to the file, so the audio element can read it
      url: URL.createObjectURL(file),
    });
  }
  fileInput.value = ''; // Clear the input so picking the same file again still fires "change"
  renderList();
});

// ---------- Rendering the song list ----------
function renderList() {
  list.innerHTML = '';

  if (tracks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Tap "+ Add" to pick songs from your device.';
    list.appendChild(empty);
    return;
  }

  tracks.forEach((track, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = track.name;
    if (i === current) btn.classList.add('active');
    btn.addEventListener('click', () => play(i));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ---------- Playback ----------
function play(index) {
  if (index < 0 || index >= tracks.length) return;

  current = index;
  audio.src = tracks[index].url;
  // play() returns a promise. The catch stops an error popup if iOS blocks playback
  audio.play().catch(() => {});

  titleEl.textContent = tracks[index].name;
  player.hidden = false;
  updateMediaSession();
  renderList();
}

function togglePlay() {
  if (current === -1) {
    play(0);          // Nothing chosen yet, so start the first track
  } else if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function next() {
  if (tracks.length === 0) return;
  play((current + 1) % tracks.length); // The % wraps back to 0 after the last track
}

function prev() {
  // If more than 3 seconds have played, restart the song instead of going back
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  play(current <= 0 ? tracks.length - 1 : current - 1);
}

// ---------- Button wiring ----------
playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);

// ---------- Audio element events ----------
audio.addEventListener('play', () => {
  playBtn.textContent = '❚❚';
});

audio.addEventListener('pause', () => {
  playBtn.textContent = '▶';
});

audio.addEventListener('timeupdate', () => {
  // Skip while the user drags, so the slider doesn't jump back under their finger
  if (seeking || !audio.duration) return;
  progress.value = (audio.currentTime / audio.duration) * 100;
});

audio.addEventListener('ended', next); // Automatically move on to the next song

// ---------- Progress slider ----------
progress.addEventListener('input', () => {
  seeking = true; // Fires continuously while dragging
});

progress.addEventListener('change', () => {
  // Fires once when the finger lifts, so we jump to that position in the song
  if (audio.duration) {
    audio.currentTime = (progress.value / 100) * audio.duration;
  }
  seeking = false;
});

// ---------- Lock screen controls ----------
// Shows the song name and play/next buttons on the lock screen (iOS 15+ in Safari)
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: tracks[current].name,
    artist: 'Local file',
  });

  // Each handler connects a lock screen button to one of our functions
  navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', prev);
  navigator.mediaSession.setActionHandler('nexttrack', next);
}
