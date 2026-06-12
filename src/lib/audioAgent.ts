const audio = typeof window !== 'undefined' ? new Audio() : null;

export const AudioAgent = {
  playTrack: (hash: string) => {
    if (!audio) return;

    const baseUrl = import.meta.env.VITE_LAZER_PLAYER_SERVER_ENDPOINT ?? '';

    audio.src = `${baseUrl}/audio/${hash}`;
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

  getAudio: () => audio,
};
