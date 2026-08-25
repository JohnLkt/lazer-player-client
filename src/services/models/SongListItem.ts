export interface SongListItem {
  id: string;
  title: string;
  titleUnicode: string;
  artist: string;
  artistUnicode: string;
  audioFileHash: string | null;
  audioFileName: string | null;
  backgroundFileHash: string | null;
  backgroundFileName: string | null;
  dateAdded: string;
}
