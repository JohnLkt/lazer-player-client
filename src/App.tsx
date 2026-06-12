import { Routes, Route } from 'react-router-dom';
import LibraryPage from './pages/library/LibraryPage';
import MusicPlayerPage from './pages/player/MusicPlayerPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function App() {
  const queryClient = new QueryClient();

  return (
    <div className="min-h-screen bg-gray-50">
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/player/:hash" element={<MusicPlayerPage />} />
        </Routes>
      </QueryClientProvider>
    </div>
  );
}

export default App;
