import { useInfiniteQuery } from '@tanstack/react-query';
import { getSongsList } from '../api/songsApi';

export const PAGE_SIZE = 20;

interface UseInfiniteSongsFilters {
  search?: string;
  size?: number;
}

export const songKeys = {
  list: (filters: UseInfiniteSongsFilters) =>
    ['songs', 'list', filters] as const,
};

export const useInfiniteSongs = (filters: UseInfiniteSongsFilters = {}) => {
  const { search, size = PAGE_SIZE } = filters;

  return useInfiniteQuery({
    queryKey: songKeys.list({ search, size }),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getSongsList({ search, size, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length < size ? undefined : allPages.length + 1;
    },
  });
};
