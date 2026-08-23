import { getAudioUrl } from '@/services/api/config';

const audio = typeof window !== 'undefined' ? new Audio() : null;

export const AudioAgent = {
  initVolume: (volume: number) => {
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  },

  playTrack: (hash: string) => {
    if (!audio) return;

    audio.src = getAudioUrl(hash);
    audio.load();
    audio.play().catch((err) => console.error('Playback failed:', err));
  },

  togglePlay: (shouldPlay: boolean) => {
    if (!audio || !audio.src) return;

    if (shouldPlay) {
      audio.play().catch((err) => console.error('Playback failed:', err));
    } else {
      audio.pause();
    }
  },

  seek: (seconds: number) => {
    if (audio) {
      audio.currentTime = seconds;
    }
  },

  setVolume: (volume: number) => {
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  },

  updateMediaSession: (metadata: {
    title: string;
    artist: string;
    album?: string;
    artwork?: MediaImage[];
  }) => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        artwork: metadata.artwork,
      });
    }
  },

  setupMediaSession: (actions: {
    nextTrack: () => void;
    previousTrack: () => void;
    setIsPlaying: (isPlaying: boolean) => void;
    setCurrentTime: (time: number) => void;
  }) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator))
      return;

    navigator.mediaSession.setActionHandler('nexttrack', () =>
      actions.nextTrack(),
    );
    navigator.mediaSession.setActionHandler('previoustrack', () =>
      actions.previousTrack(),
    );
    navigator.mediaSession.setActionHandler('play', () =>
      actions.setIsPlaying(true),
    );
    navigator.mediaSession.setActionHandler('pause', () =>
      actions.setIsPlaying(false),
    );
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const audioInstance = AudioAgent.getAudio();
      if (audioInstance) {
        const offset = details.seekOffset ?? 10;
        const targetTime = Math.max(0, audioInstance.currentTime - offset);
        AudioAgent.seek(targetTime);
        actions.setCurrentTime(targetTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const audioInstance = AudioAgent.getAudio();
      if (audioInstance) {
        const offset = details.seekOffset ?? 10;
        const targetTime = Math.min(
          audioInstance.duration || 0,
          audioInstance.currentTime + offset,
        );
        AudioAgent.seek(targetTime);
        actions.setCurrentTime(targetTime);
      }
    });
  },

  getAudio: () => audio,
};
