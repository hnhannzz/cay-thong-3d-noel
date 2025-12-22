import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface MusicMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
}

// Access the global jsmediatags object loaded via script tag
const jsmediatags = (window as any).jsmediatags;

export const MusicPlayer: React.FC = () => {
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [metadata, setMetadata] = useState<MusicMetadata>({
    title: "Loading...",
    artist: "",
    album: "",
    coverUrl: null
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load playlist on mount
  useEffect(() => {
    fetch('/music/playlist.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlaylist(data);
          setCurrentIndex(0);
        } else {
          // Fallback if empty or failed
          console.warn("Playlist empty, defaulting to MemoryReboot.mp3");
          setPlaylist(['/music/MemoryReboot.mp3']);
        }
      })
      .catch(err => {
        console.warn("Failed to load playlist, defaulting to MemoryReboot.mp3", err);
        setPlaylist(['/music/MemoryReboot.mp3']);
      });
  }, []);

  const loadMetadata = useCallback((fileUrl: string) => {
    // Default fallback metadata function
    const setFallbackMetadata = () => {
      const fileName = fileUrl.split('/').pop()?.split('.')[0] || "Unknown Title";
      setMetadata({
        title: fileName,
        artist: "Unknown Artist",
        album: "",
        coverUrl: null
      });
    };

    if (!jsmediatags) {
      setFallbackMetadata();
      return;
    }

    setMetadata(prev => ({ ...prev, title: "Loading...", coverUrl: null }));

    // Fetch the file as a blob first to ensure jsmediatags can read it
    // This fixes the "No suitable file reader found" error for relative URL strings
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.blob();
      })
      .then(blob => {
        jsmediatags.read(blob, {
          onSuccess: (tag: any) => {
            const tags = tag.tags;
            let coverUrl = null;

            // Parse Picture
            if (tags.picture) {
              const { data, format } = tags.picture;
              let base64String = "";
              for (let i = 0; i < data.length; i++) {
                base64String += String.fromCharCode(data[i]);
              }
              coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
            }

            setMetadata({
              title: tags.title || fileUrl.split('/').pop()?.split('.')[0] || "Unknown Title",
              artist: tags.artist || "Unknown Artist",
              album: tags.album || "",
              coverUrl: coverUrl
            });
          },
          onError: (error: any) => {
            console.error("Error reading tags:", error);
            setFallbackMetadata();
          }
        });
      })
      .catch(error => {
        console.error("Error fetching file for metadata:", error);
        setFallbackMetadata();
      });
  }, []);

  // When playlist or index changes, load the track
  useEffect(() => {
    if (playlist.length > 0 && playlist[currentIndex]) {
      const fileUrl = playlist[currentIndex];
      
      // Update audio source
      if (audioRef.current) {
        // Only change src if it's different to avoid reloading if re-rendering
        const currentSrcPath = audioRef.current.getAttribute('src');
        if (currentSrcPath !== fileUrl) {
           audioRef.current.src = fileUrl;
           audioRef.current.load();
           if (isPlaying) {
             audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
           }
        }
      }
      
      loadMetadata(fileUrl);
    }
  }, [playlist, currentIndex, loadMetadata]); // isPlaying excluded to prevent restart on play/pause toggle

  // Separate effect to handle play/pause state syncing
  useEffect(() => {
     if(audioRef.current) {
         if(isPlaying && audioRef.current.paused) {
             audioRef.current.play().catch(e => console.error("Playback failed:", e));
         } else if(!isPlaying && !audioRef.current.paused) {
             audioRef.current.pause();
         }
     }
  }, [isPlaying]);


  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setIsPlaying(true);
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    playNext();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (playlist.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-8 z-40 w-80 backdrop-blur-md bg-black/60 border border-white/10 rounded-xl p-4 shadow-2xl text-white font-sansZS transition-all hover:bg-black/70">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      {/* Top Section: Art & Info */}
      <div className="flex gap-4 mb-4">
        {/* Album Art */}
        <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-800 shrink-0 shadow-lg relative">
          {metadata.coverUrl ? (
            <img src={metadata.coverUrl} alt="Album Art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black flex items-center justify-center">
              <span className="text-xs text-white/50">Music</span>
            </div>
          )}
          {/* Subtle gloss effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center min-w-0">
          <h3 className="text-white font-bold text-sm truncate leading-tight mb-1">
            {metadata.title}
          </h3>
          <p className="text-gray-400 text-xs truncate">
            {metadata.artist} {metadata.album ? `- ${metadata.album}` : ''}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{formatTime(currentTime)}</span>
        <div className="flex-1 relative h-1 bg-gray-600 rounded-full group">
          <div 
            className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          ></div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="music-range absolute inset-0 w-full h-full opacity-0 cursor-pointer group-hover:opacity-100 z-10"
          />
        </div>
        <span className="text-[10px] text-gray-400 font-mono w-8">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-6">
        <button 
          onClick={playPrev}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <SkipBack size={20} fill="currentColor" />
        </button>
        
        <button 
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        
        <button 
          onClick={playNext}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <SkipForward size={20} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};
