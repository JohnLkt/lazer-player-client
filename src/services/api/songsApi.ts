import axios from 'axios';
import type { SongListItemDto } from '../models/SongListItemDto';
import { BASE_URL } from './config';

export interface GetSongsListParams {
  search?: string;
  page?: number;
  size?: number;
}

export const getSongsList = async (
  params?: GetSongsListParams,
): Promise<SongListItemDto[]> => {
  const response = await axios.get<SongListItemDto[]>(`${BASE_URL}/songs`, {
    params,
  });
  return response.data;
};
