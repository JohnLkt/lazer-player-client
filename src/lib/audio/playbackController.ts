import { getAudioUrl, getImageUrl } from '@/services/api/config';
import { usePlayerStore } from '@/services/stores/usePlayerStore';
import type { SongListItem } from '@/services/models/SongListItem';

let audio: HTMLAudioElement | null = null;

function updateMetadata(track: SongListItem) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
    return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || 'Unknown Artist',
    artwork: track.backgroundFileHash
      ? [{ src: getImageUrl(track.backgroundFileHash) }]
      : undefined,
  });
}

let lastPositionSyncAt = 0;

function syncPositionState(force = false) {
  if (!audio) return;
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
    return;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

  // Chrome's Android notification extrapolates position between updates;
  // refreshing more than ~1Hz only churns it. MDN recommends >= 1s spacing.
  const now = Date.now();
  if (!force && now - lastPositionSyncAt < 900) return;
  lastPositionSyncAt = now;

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: Math.max(0, Math.min(audio.currentTime, audio.duration)),
    });
  } catch {
    // Transient invalid states are rejected by some browsers; the next
    // timeupdate retries with settled values.
  }
}

function advanceOrPause() {
  try {
    usePlayerStore.getState().nextTrack();
  } catch (error) {
    console.error('Failed to advance to next track:', error);
    usePlayerStore.getState().setIsPlaying(false);
  }
}

function setupMediaSessionHandlers() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
    return;

  const store = usePlayerStore;

  const registerAction = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler,
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Unsupported on this platform; keep registering the remaining
      // actions so one gap doesn't disable the rest of the notification.
    }
  };

  registerAction('play', () => store.getState().setIsPlaying(true));
  registerAction('pause', () => store.getState().setIsPlaying(false));
  registerAction('previoustrack', () => store.getState().previousTrack());
  registerAction('nexttrack', advanceOrPause);
  registerAction('seekto', (details) => {
    if (details.seekTime == null || !Number.isFinite(details.seekTime)) return;
    store.getState().seek(details.seekTime);
  });
  registerAction('seekbackward', (details) => {
    if (!audio) return;
    const offset = details.seekOffset ?? 10;
    store.getState().seek(Math.max(0, audio.currentTime - offset));
  });
  registerAction('seekforward', (details) => {
    if (!audio) return;
    const offset = details.seekOffset ?? 10;
    store
      .getState()
      .seek(Math.min(audio.duration || 0, audio.currentTime + offset));
  });
}

export function initPlaybackController(): void {
  if (audio) return;

  const store = usePlayerStore;
  const { volume, currentTrack } = store.getState();

  audio = new Audio();
  audio.volume = volume;

  // Cold-start restore: preload the persisted track paused (autoplay policies
  // forbid programmatic play before user interaction).
  if (currentTrack?.audioFileHash) {
    audio.src = getAudioUrl(currentTrack.audioFileHash);
    audio.load();
    updateMetadata(currentTrack);
  }

  // ---- facts: element -> store --------------------------------------
  audio.addEventListener('timeupdate', () => {
    if (!audio) return;
    if (!store.getState().isScrubbing) {
      store.getState().applyPlaybackFacts({ currentTime: audio.currentTime });
    }
    syncPositionState();
  });

  audio.addEventListener('durationchange', () => {
    if (!audio) return;
    store.getState().applyPlaybackFacts({ duration: audio.duration });
    syncPositionState(true);
  });

  // Refresh immediately when a seek lands so the notification stops
  // extrapolating from the pre-seek position.
  audio.addEventListener('seeked', () => syncPositionState(true));

  audio.addEventListener('play', () => {
    store.getState().applyPlaybackFacts({ isPlaying: true });
  });

  audio.addEventListener('pause', () => {
    store.getState().applyPlaybackFacts({ isPlaying: false });
  });

  audio.addEventListener('ended', advanceOrPause);

  // ---- commands: store -> element -----------------------------------
  store.subscribe(
    (state) => state.loadNonce,
    () => {
      if (!audio) return;
      const track = store.getState().currentTrack;
      if (!track?.audioFileHash) return;

      audio.src = getAudioUrl(track.audioFileHash);
      audio.load();
      updateMetadata(track);

      void audio.play().catch((error) => {
        console.error('Playback failed:', error);
      });
    },
  );

  store.subscribe(
    (state) => state.isPlaying,
    (isPlaying) => {
      if (!audio || !audio.src) return;

      if (isPlaying && audio.paused) {
        void audio.play().catch((error) => {
          console.error('Playback failed:', error);
        });
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    },
  );

  store.subscribe(
    (state) => state.volume,
    (volume) => {
      if (audio) audio.volume = volume;
    },
  );

  store.subscribe(
    (state) => state.pendingSeek?.nonce,
    (nonce) => {
      if (nonce == null || !audio) return;
      const seek = store.getState().pendingSeek;
      if (!seek) return;

      audio.currentTime = seek.value;
      syncPositionState();
      store.setState({ pendingSeek: null });
    },
  );

  setupMediaSessionHandlers();
}
