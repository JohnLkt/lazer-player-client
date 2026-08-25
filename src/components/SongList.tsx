import { Fragment, useEffect, useRef, useState } from 'react';
import { useInfiniteSongs, PAGE_SIZE } from '@/services/queries/songsQueries';
import { getImageUrl } from '@/services/api/config';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Search, Music } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { usePlayerStore } from '../services/stores/usePlayerStore';

const PREFETCH_AHEAD = 3;

export const SongList = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteSongs({ search: debouncedSearch });

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const currentOffset = usePlayerStore((state) => state.currentOffset);
  const playFromList = usePlayerStore((state) => state.playFromList);
  const growQueueIfSameList = usePlayerStore(
    (state) => state.growQueueIfSameList,
  );

  const allSongs = data ? data.pages.flat() : [];

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Keep playback fed: adopt grown versions of the active list and prefetch
  // pages before auto-advance reaches the loaded tail.
  useEffect(() => {
    const songs = data ? data.pages.flat() : [];
    if (songs.length === 0) return;

    growQueueIfSameList(songs);

    if (
      hasNextPage &&
      !isFetchingNextPage &&
      currentOffset + PREFETCH_AHEAD >= songs.length - 1
    ) {
      void fetchNextPage();
    }
  }, [
    data,
    currentOffset,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    growQueueIfSameList,
  ]);

  useEffect(() => {
    if (!hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    const current = loadMoreRef.current;
    if (current) observer.observe(current);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handlePlaySong = (index: number) => {
    playFromList(allSongs, index);
  };

  return (
    <div className="w-full p-4 space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search songs..."
          className="pl-9 w-full bg-background focus-visible:ring-2"
        />
      </div>

      {status === 'pending' && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Fragment key={i}>
              <div className="flex items-center space-x-4 p-2">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="h-3 w-[40%]" />
                </div>
              </div>
              {i < 4 && <Separator />}
            </Fragment>
          ))}
        </div>
      )}

      {status === 'success' && (
        <ul className="w-full text-card-foreground p-0 m-0">
          {data.pages.map((page, pageIndex) => (
            <Fragment key={pageIndex}>
              {page.map((song, songIndex) => {
                const globalIndex = pageIndex * PAGE_SIZE + songIndex;

                const isLastItem =
                  pageIndex === data.pages.length - 1 &&
                  songIndex === page.length - 1;

                const isSelected =
                  currentOffset === globalIndex && currentTrack?.id === song.id;

                return (
                  <Fragment key={song.id}>
                    <li
                      className={`transition-all rounded-md list-none ${
                        isSelected
                          ? 'ring-2 ring-primary bg-primary/5 shadow-sm'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <button
                        onClick={() => handlePlaySong(globalIndex)}
                        className="w-full flex items-center gap-4 p-3 text-left focus-visible:bg-muted focus-visible:outline-none rounded-md group"
                      >
                        {song.backgroundFileHash ? (
                          <img
                            src={getImageUrl(song.backgroundFileHash)}
                            alt={song.title}
                            className="h-12 w-12 rounded-md object-cover border bg-muted flex-shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-secondary flex items-center justify-center text-muted-foreground border flex-shrink-0">
                            <Music className="h-5 w-5" />
                          </div>
                        )}

                        <div className="flex flex-col overflow-hidden">
                          <span
                            className={`font-medium text-sm truncate transition-colors ${
                              isSelected
                                ? 'text-primary'
                                : 'text-foreground group-hover:text-primary'
                            }`}
                          >
                            {song.title}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </span>
                        </div>
                      </button>
                    </li>
                    {!isLastItem && <Separator className="my-1" />}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </ul>
      )}

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      <div ref={loadMoreRef} className="h-1" />
    </div>
  );
};
