import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LibraryPage from './pages/library/LibraryPage';
import SongPlayer from './components/SongPlayer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function App() {
  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <QueryClientProvider client={queryClient}>
        <main className="flex-1 w-full overflow-y-auto pt-[env(safe-area-inset-top)]">
          <Routes>
            <Route path="/" element={<LibraryPage />} />
          </Routes>
        </main>

        <div className="flex-shrink-0 w-full">
          <SongPlayer />
        </div>
      </QueryClientProvider>
    </div>
  );
}

export default App;
