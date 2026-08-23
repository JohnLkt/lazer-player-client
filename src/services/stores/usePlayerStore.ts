import { create } from 'zustand';
import {
  persist,
  createJSONStorage,
  subscribeWithSelector,
} from 'zustand/middleware';
import type { SongListItem } from '../models/SongListItem';

export interface PlaybackFacts {
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
}

interface PlayerState {
  currentTrack: SongListItem | null;
  currentOffset: number;
  queue: SongListItem[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  pendingSeek: { value: number; nonce: number } | null;
  loadNonce: number;
}

interface PlayerActions {
  playFromList: (songs: SongListItem[], index: number) => void;
  growQueueIfSameList: (songs: SongListItem[]) => void;
  nextTrack: () => boolean;
  previousTrack: () => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  beginScrub: (value: number) => void;
  moveScrub: (value: number) => void;
  commitScrub: (value: number) => void;
  seek: (value: number) => void;
  applyPlaybackFacts: (facts: PlaybackFacts) => void;
}

const usePlayerStore = create<PlayerState & PlayerActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        const assertPlayable = (track: SongListItem | undefined) => {
          if (!track) {
            throw new Error('Playback failed: Track not found.');
          }
          if (!track.audioFileHash) {
            throw new Error(
              `Playback failed: Track "${track.title || 'Unknown'}" is missing its audio file hash.`,
            );
          }
        };

        const startTrack = (
          track: SongListItem,
          offset: number,
          extra: Partial<PlayerState> = {},
        ) => {
          assertPlayable(track);
          set({
            currentTrack: track,
            currentOffset: offset,
            isPlaying: true,
            currentTime: 0,
            duration: 0,
            loadNonce: get().loadNonce + 1,
            ...extra,
          });
        };

        const nextSeekNonce = () => (get().pendingSeek?.nonce ?? 0) + 1;

        return {
          currentTrack: null,
          currentOffset: 0,
          queue: [],
          isPlaying: false,
          volume: 0.5,
          currentTime: 0,
          duration: 0,
          isScrubbing: false,
          pendingSeek: null,
          loadNonce: 0,

          playFromList: (songs, index) =>
            startTrack(songs[index], index, { queue: [...songs] }),

          growQueueIfSameList: (songs) => {
            const { queue, currentOffset } = get();
            if (queue.length === 0 || songs.length <= queue.length) return;
            if (songs[0]?.id !== queue[0]?.id) return;

            const probeIndex = Math.min(currentOffset, queue.length - 1);
            if (songs[probeIndex]?.id !== queue[probeIndex]?.id) return;

            set({ queue: [...songs] });
          },

          nextTrack: () => {
            const { queue, currentOffset } = get();
            if (currentOffset >= queue.length - 1) {
              set({ isPlaying: false });
              return false;
            }

            startTrack(queue[currentOffset + 1], currentOffset + 1);
            return true;
          },

          previousTrack: () => {
            const { queue, currentOffset } = get();
            if (currentOffset === 0) return;

            startTrack(queue[currentOffset - 1], currentOffset - 1);
          },

          togglePlay: () => {
            if (!get().currentTrack) return;
            set({ isPlaying: !get().isPlaying });
          },

          setIsPlaying: (isPlaying) => {
            if (!get().currentTrack) return;
            set({ isPlaying });
          },

          setVolume: (volume) => {
            set({ volume: Math.max(0, Math.min(1, volume)) });
          },

          beginScrub: (value) => set({ isScrubbing: true, currentTime: value }),

          moveScrub: (value) => set({ isScrubbing: true, currentTime: value }),

          commitScrub: (value) =>
            set({
              isScrubbing: false,
              currentTime: value,
              pendingSeek: { value, nonce: nextSeekNonce() },
            }),

          seek: (value) =>
            set({
              currentTime: value,
              pendingSeek: { value, nonce: nextSeekNonce() },
            }),

          applyPlaybackFacts: (facts) => set(facts),
        };
      },
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
  ),
);

export default usePlayerStore;
