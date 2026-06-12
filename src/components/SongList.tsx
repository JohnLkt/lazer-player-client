import React, { useRef, useEffect } from 'react';
import { useInfiniteSongs } from '../services/queries/songsQueries';
import { BASE_URL } from '../services/api/config';
import { Link } from 'react-router-dom';

export const SongList = () => {
  const [search, setSearch] = React.useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteSongs({ search, size: 20 });

  const loadMoreRef = useRef<HTMLDivElement>(null);

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
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search songs..."
      />

      {status === 'pending' && <p>Loading...</p>}

      {status === 'success' && (
        <ul>
          {data.pages.map((page, pageIndex) => (
            <React.Fragment key={pageIndex}>
              {page.map((song) => (
                <Link
                  to={`/player/${song.audioFileHash}`}
                  className="p-2 border-b flex items-center"
                  key={song.id}
                >
                  {song.backgroundFileHash ? (
                    <img
                      src={`${BASE_URL}/image/${song.backgroundFileHash}/optimized`}
                      alt={song.title}
                      className="h-10 mr-2"
                    />
                  ) : (
                    <div className="w-10 h-10 mr-2 bg-gray-500"></div>
                  )}
                  {song.title} - {song.artist}
                </Link>
              ))}
            </React.Fragment>
          ))}
        </ul>
      )}

      {/* IntersectionObserver sentinel for auto-loading next page */}
      <div ref={loadMoreRef} style={{ height: '1px' }} />
    </div>
  );
};
