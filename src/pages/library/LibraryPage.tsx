import { SongList } from '../../components/SongList';

function LibraryPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Library</h1>
      <p>
        Welcome to your music library! Here you can browse and manage your
        songs.
      </p>
      <SongList />
    </div>
  );
}

export default LibraryPage;
