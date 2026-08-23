export const BASE_URL = import.meta.env.VITE_LAZER_PLAYER_SERVER_ENDPOINT ?? '';

export const getAudioUrl = (hash: string) => `${BASE_URL}/audio/${hash}`;

export const getImageUrl = (hash: string, variant = 'optimized') =>
  `${BASE_URL}/image/${hash}/${variant}`;
