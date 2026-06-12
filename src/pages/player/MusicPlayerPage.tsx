import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

const LOCAL_STORAGE_KEY = 'lazer_player_volume';

function MusicPlayerPage() {
  const { hash } = useParams();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioSrc = `${import.meta.env.VITE_LAZER_PLAYER_SERVER_ENDPOINT ?? ''}/audio/${hash}`;

  useEffect(() => {
    const playAudio = async () => {
      if (audioRef.current) {
        try {
          audioRef.current.load();
          await audioRef.current.play();
        } catch (error) {
          console.warn('Autoplay was blocked by the browser.', error);
        }
      }
    };

    if (hash) {
      playAudio();
    }
  }, [hash]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const savedVolume = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedVolume !== null) {
      audioElement.volume = parseFloat(savedVolume);
    }

    const handleVolumeChange = () => {
      localStorage.setItem(LOCAL_STORAGE_KEY, audioElement.volume.toString());
    };

    audioElement.addEventListener('volumechange', handleVolumeChange);

    return () => {
      audioElement.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [audioSrc]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Music Player</h1>
      {audioSrc && (
        <audio ref={audioRef} controls src={audioSrc} className="mt-4 w-full">
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
}

export default MusicPlayerPage;
