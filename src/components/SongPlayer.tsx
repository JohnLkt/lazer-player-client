import { useEffect } from 'react';
import usePlayerStore from '../services/stores/usePlayerStore';
import { AudioAgent } from '@/lib/audioAgent';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTime } from '@/lib/formatTime';

function SongPlayer() {
  const {
    currentTrack,
    isPlaying,
    queue,
    currentOffset,
    currentTime,
    duration,
    volume,
    setVolume,
    setIsScrubbing,
    setCurrentTime,
  } = usePlayerStore();

  useEffect(() => {
    AudioAgent.setupMediaSession({
      nextTrack: () => usePlayerStore.getState().nextTrack(),
      previousTrack: () => usePlayerStore.getState().previousTrack(),
      setIsPlaying: (isPlaying) =>
        usePlayerStore.getState().setIsPlaying(isPlaying),
      setCurrentTime: (time) => usePlayerStore.getState().setCurrentTime(time),
    });
  }, []);

  const handleScrubbing = (value: number[]) => {
    if (!currentTrack) return;
    setIsScrubbing(true);
    setCurrentTime(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    if (!currentTrack) return;
    AudioAgent.seek(value[0]);
    setIsScrubbing(false);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const hasPrevious = currentTrack && currentOffset > 0;
  const hasNext = currentTrack && currentOffset < queue.length - 1;

  return (
    <div className="w-full border-t border-border bg-background text-foreground select-none box-content pb-[env(safe-area-inset-bottom)]">
      <div className="w-full px-4 md:px-6 py-3 md:py-0 md:h-20 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
        <div className="flex items-center justify-between md:justify-start md:w-1/4 md:min-w-[180px] gap-4">
          <div className="truncate flex-1">
            {currentTrack ? (
              <>
                <p className="font-semibold text-sm tracking-tight truncate text-foreground">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist || 'Unknown Artist'}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic">
                No track selected
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().previousTrack()}
              disabled={!hasPrevious}
              className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-20"
            >
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </Button>

            <Button
              size="icon"
              onClick={() => usePlayerStore.getState().setIsPlaying(!isPlaying)}
              disabled={!currentTrack}
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-sm"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().nextTrack()}
              disabled={!hasNext}
              className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-20"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 flex-1 w-full md:max-w-xl">
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().previousTrack()}
              disabled={!hasPrevious}
              className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-20"
            >
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </Button>

            <Button
              size="icon"
              onClick={() => usePlayerStore.getState().setIsPlaying(!isPlaying)}
              disabled={!currentTrack}
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-30"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().nextTrack()}
              disabled={!hasNext}
              className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-20"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>

          <div className="w-full flex items-center gap-3 text-[11px] md:text-xs font-semibold text-foreground/80 tracking-tighter">
            <span className="w-8 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>

            <Slider
              min={0}
              max={duration || 100}
              step={0.1}
              value={[currentTime]}
              onValueChange={handleScrubbing}
              onValueCommit={handleSeekCommit}
              disabled={!currentTrack}
              className="flex-1 cursor-pointer opacity-90 hover:opacity-100 transition-opacity disabled:opacity-20"
            />

            <span className="w-8 text-left tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="w-1/4 justify-end items-center gap-2 hidden md:flex min-w-[140px]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-muted"
            onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4" fill="currentColor" />
            ) : (
              <Volume2 className="h-4 w-4" fill="currentColor" />
            )}
          </Button>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={handleVolumeChange}
            className="w-24 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

export default SongPlayer;
