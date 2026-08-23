import axios from 'axios';
import type { SongListItem } from '../models/SongListItem';
import { BASE_URL } from './config';

export interface GetSongsListParams {
  search?: string;
  page?: number;
  size?: number;
}

export const getSongsList = async (
  params?: GetSongsListParams,
): Promise<SongListItem[]> => {
  const response = await axios.get<SongListItem[]>(`${BASE_URL}/songs`, {
    params,
  });
  return response.data;
};
