import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SongListItemDto } from '../models/SongListItemDto';
import { AudioAgent } from '@/lib/audioAgent';
import type {
  InfiniteQueryObserverResult,
  InfiniteData,
} from '@tanstack/react-query';

interface PlayerState {
  currentTrack: SongListItemDto | null;
  currentOffset: number;
  queue: SongListItemDto[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  fetchMoreTracks:
    | (() => Promise<
        InfiniteQueryObserverResult<InfiniteData<SongListItemDto[]>, Error>
      >)
    | null;
}

interface PlayerActions {
  setTrack: (track: SongListItemDto) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setFetchMoreTracks: (
    cb:
      | (() => Promise<
          InfiniteQueryObserverResult<InfiniteData<SongListItemDto[]>, Error>
        >)
      | null,
  ) => void;
  updateQueue: (newQueue: SongListItemDto[]) => void;
  setIsScrubbing: (isScrubbing: boolean) => void;
}

const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      currentOffset: 0,
      queue: [],
      isPlaying: false,
      volume: 0.5,
      currentTime: 0,
      duration: 0,
      isScrubbing: false,
      fetchMoreTracks: null,

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

        AudioAgent.playTrack(track.audioFileHash!);
        AudioAgent.updateMediaSession({
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          artwork: track.backgroundFileHash
            ? [{ src: AudioAgent.getAssetUrl(track.backgroundFileHash) }]
            : undefined,
        });
      },

      setIsPlaying: (isPlaying) => {
        set({ isPlaying });
        AudioAgent.togglePlay(isPlaying);
      },

      nextTrack: async () => {
        const { queue, currentOffset, fetchMoreTracks } = get();

        console.log(queue);

        // 1. PRE-FETCH BUFFER PATTERN:
        // Since we check 3 songs ahead, fire the fetch call early in the background.
        // DO NOT await it here so we don't stall standard track navigation.
        if (currentOffset + 3 >= queue.length - 1 && fetchMoreTracks) {
          console.log(
            'Buffer threshold hit. Pre-fetching next page in background...',
          );
          fetchMoreTracks(); // Triggers the network request asynchronously
        }

        // 2. CRITICAL BOUNDARY GUARD:
        // Are we trying to skip past the absolute final song we currently have in memory?
        if (currentOffset >= queue.length - 1) {
          console.log('Stalled at end of array waiting for background sync.');
          // Optional: Add a small loading spinner trigger here if network is slow
          return;
        }

        // 3. Standard sequential progression path execution
        const next = queue[currentOffset + 1];
        if (!next?.audioFileHash) {
          throw new Error(
            `Playback failed: Track "${next?.title || 'Unknown'}" is missing its audio file hash.`,
          );
        }

        set({
          currentTrack: next,
          isPlaying: true,
          currentOffset: currentOffset + 1,
        });
        AudioAgent.playTrack(next.audioFileHash!);
        AudioAgent.updateMediaSession({
          title: next.title,
          artist: next.artist || 'Unknown Artist',
          artwork: next.backgroundFileHash
            ? [{ src: AudioAgent.getAssetUrl(next.backgroundFileHash) }]
            : undefined,
        });
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

        AudioAgent.playTrack(prev.audioFileHash!);
        AudioAgent.updateMediaSession({
          title: prev.title,
          artist: prev.artist || 'Unknown Artist',
          artwork: prev.backgroundFileHash
            ? [{ src: AudioAgent.getAssetUrl(prev.backgroundFileHash) }]
            : undefined,
        });
      },

      setVolume: (volume) => {
        const safeVolume = Math.max(0, Math.min(1, volume));
        set({ volume: safeVolume });
        AudioAgent.setVolume(safeVolume);
      },

      setCurrentTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),
      setFetchMoreTracks: (fetchMoreTracks) => set({ fetchMoreTracks }),
      updateQueue: (queue) => set({ queue }),
      setIsScrubbing: (isScrubbing) => set({ isScrubbing }),
    }),
    {
      name: 'lazer-player-storage',
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        volume: state.volume,
        currentTrack: state.currentTrack,
        currentOffset: state.currentOffset,
        queue: state.queue,
      }),
    },
  ),
);

// =====================================================
// Audio <-> Zustand synchronization
// =====================================================
const audio = AudioAgent.getAudio();

if (audio) {
  const store = usePlayerStore.getState();

  // 1. Restore the saved volume state immediately to the new audio instance
  audio.volume = store.volume;

  // 2. REFRESH COLD-START SYNC:
  // If a track was restored from localStorage, but the audio hardware is empty,
  // sync the source URL so the browser is loaded and ready to play.
  if (store.currentTrack?.audioFileHash && !audio.src) {
    const baseUrl = import.meta.env.VITE_LAZER_PLAYER_SERVER_ENDPOINT ?? '';
    audio.src = `${baseUrl}/audio/${store.currentTrack.audioFileHash}`;
    audio.load();

    usePlayerStore.setState({ isPlaying: false });
  }

  // =====================================================
  // Event Listeners
  // =====================================================

  audio.addEventListener('timeupdate', () => {
    if (!usePlayerStore.getState().isScrubbing) {
      usePlayerStore.getState().setCurrentTime(audio.currentTime);
    }
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
