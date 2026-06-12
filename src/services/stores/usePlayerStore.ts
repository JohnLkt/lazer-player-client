import { create } from 'zustand';
import type { SongListItemDto } from '../models/SongListItemDto';
import { AudioAgent } from '@/lib/audioAgent';

interface PlayerState {
  currentTrack: SongListItemDto | null;
  currentOffset: number;
  queue: SongListItemDto[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

interface PlayerActions {
  setTrack: (track: SongListItemDto) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addToQueue: (track: SongListItemDto) => void;
}

const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  currentTrack: null,
  currentOffset: 0,
  queue: [],
  isPlaying: false,
  volume: 0.5,
  currentTime: 0,
  duration: 0,

  setTrack: (track) => {
    if (!track.audioFileHash) {
      throw new Error(
        `Playback failed: Track "${track.title || 'Unknown'}" is missing its audio file hash.`,
      );
    }

    set({
      currentTrack: track,
      isPlaying: true,
      currentOffset: 0,
    });

    AudioAgent.playTrack(track.audioFileHash);
  },

  setIsPlaying: (isPlaying) => {
    set({ isPlaying });
    AudioAgent.togglePlay(isPlaying);
  },

  nextTrack: () => {
    const { queue, currentOffset } = get();

    if (queue.length <= currentOffset + 1) return;

    const next = queue[currentOffset + 1];

    if (!next.audioFileHash) {
      throw new Error(
        `Playback failed: Track "${next.title || 'Unknown'}" is missing its audio file hash.`,
      );
    }

    set({
      currentTrack: next,
      isPlaying: true,
      currentOffset: currentOffset + 1,
    });

    AudioAgent.playTrack(next.audioFileHash);
  },

  previousTrack: () => {
    const { queue, currentOffset } = get();

    if (currentOffset === 0) return;

    const prev = queue[currentOffset - 1];

    if (!prev.audioFileHash) {
      throw new Error(
        `Playback failed: Track "${prev.title || 'Unknown'}" is missing its audio file hash.`,
      );
    }

    set({
      currentTrack: prev,
      isPlaying: true,
      currentOffset: currentOffset - 1,
    });

    AudioAgent.playTrack(prev.audioFileHash);
  },

  setVolume: (volume) => {
    const safeVolume = Math.max(0, Math.min(1, volume));

    set({ volume: safeVolume });
    AudioAgent.setVolume(safeVolume);
  },

  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  addToQueue: (track) =>
    set((state) => ({
      queue: [...state.queue, track],
    })),
}));

// =====================================================
// Audio <-> Zustand synchronization
// =====================================================

const audio = AudioAgent.getAudio();

if (audio) {
  audio.volume = usePlayerStore.getState().volume;

  audio.addEventListener('timeupdate', () => {
    usePlayerStore.getState().setCurrentTime(audio.currentTime);
  });

  audio.addEventListener('durationchange', () => {
    usePlayerStore.getState().setDuration(audio.duration);
  });

  audio.addEventListener('ended', () => {
    usePlayerStore.getState().nextTrack();
  });

  audio.addEventListener('play', () => {
    usePlayerStore.getState().setIsPlaying(true);
  });

  audio.addEventListener('pause', () => {
    usePlayerStore.getState().setIsPlaying(false);
  });

  usePlayerStore.subscribe((state) => {
    audio.volume = state.volume;
  });
}

export default usePlayerStore;
