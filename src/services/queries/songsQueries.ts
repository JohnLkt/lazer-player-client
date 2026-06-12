import { useInfiniteQuery } from '@tanstack/react-query';
import { getSongsList } from '../api/songsApi';

interface UseInfiniteSongsFilters {
  search?: string;
  size?: number;
}

export const songKeys = {
  list: (filters: UseInfiniteSongsFilters) =>
    ['songs', 'list', filters] as const,
};

export const useInfiniteSongs = (filters: UseInfiniteSongsFilters = {}) => {
  const { search, size = 20 } = filters;

  return useInfiniteQuery({
    queryKey: songKeys.list({ search, size }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getSongsList({ search, size, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length < size ? undefined : allPages.length + 1;
    },
  });
};
