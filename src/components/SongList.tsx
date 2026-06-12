import React, { useRef, useEffect } from 'react';
import { useInfiniteSongs } from '../services/queries/songsQueries';
import { BASE_URL } from '../services/api/config';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Search, Music } from 'lucide-react';
import useDebounce from '@/lib/hooks/useDebounce';
import usePlayerStore from '../services/stores/usePlayerStore';
import type { SongListItemDto } from '@/services/models/SongListItemDto';

export const SongList = () => {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteSongs({ search: debouncedSearch, size: 20 });

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const allSongs = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flat();
  }, [data]);

  const handlePlaySong = (song: SongListItemDto, index: number) => {
    usePlayerStore.setState({ queue: allSongs });

    // Set the track and sync its index offset inside that queue
    usePlayerStore.getState().setTrack(song);
    usePlayerStore.setState({ currentOffset: index });
  };

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
            <React.Fragment key={i}>
              <div className="flex items-center space-x-4 p-2">
                <Skeleton className="h-12 w-12 rounded-md" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[60%]" />
                  <Skeleton className="h-3 w-[40%]" />
                </div>
              </div>
              {i < 4 && <Separator />}
            </React.Fragment>
          ))}
        </div>
      )}

      {status === 'success' && (
        <ul className="w-full text-card-foreground">
          {data.pages.map((page, pageIndex) => (
            <React.Fragment key={pageIndex}>
              {page.map((song, songIndex) => {
                const globalIndex = pageIndex * 20 + songIndex;

                const isLastItem =
                  pageIndex === data.pages.length - 1 &&
                  songIndex === page.length - 1;

                return (
                  <React.Fragment key={song.id}>
                    <li className="transition-colors hover:bg-muted/50 rounded-md list-none">
                      <button
                        onClick={() => handlePlaySong(song, globalIndex)}
                        className="w-full flex items-center gap-4 p-3 text-left focus-visible:bg-muted focus-visible:outline-none rounded-md group"
                      >
                        {song.backgroundFileHash ? (
                          <img
                            src={`${BASE_URL}/image/${song.backgroundFileHash}/optimized`}
                            alt={song.title}
                            className="h-12 w-12 rounded-md object-cover border bg-muted flex-shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-secondary flex items-center justify-center text-muted-foreground border flex-shrink-0">
                            <Music className="h-5 w-5" />
                          </div>
                        )}

                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium text-sm truncate text-foreground group-hover:text-primary transition-colors">
                            {song.title}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </span>
                        </div>
                      </button>
                    </li>
                    {!isLastItem && <Separator className="my-1" />}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
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
