import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, ChevronUp, Music } from 'lucide-react';

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
  
  // Volume state
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.5);

  // UI State
  const [isMinimized, setIsMinimized] = useState(false);

  const [metadata, setMetadata] = useState<MusicMetadata>({
    title: "Loading...",
    artist: "",
    album: "",
    coverUrl: null
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize checks for mobile to auto-minimize if needed
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMinimized(true);
    }
  }, []);

  // Load playlist on mount
  useEffect(() => {
    fetch('/music/playlist.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPlaylist(data);
          setCurrentIndex(0);
        } else {
          console.warn("Playlist empty, defaulting to MemoryReboot.mp3");
          setPlaylist(['/music/MemoryReboot.mp3']);
        }
      })
      .catch(err => {
        console.warn("Failed to load playlist, defaulting to MemoryReboot.mp3", err);
        setPlaylist(['/music/MemoryReboot.mp3']);
      });
  }, []);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const loadMetadata = useCallback((fileUrl: string) => {
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

  // Handle Track Change
  useEffect(() => {
    if (playlist.length > 0 && playlist[currentIndex]) {
      const fileUrl = playlist[currentIndex];
      if (audioRef.current) {
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
  }, [playlist, currentIndex, loadMetadata]);

  // Sync Play/Pause
  useEffect(() => {
     if(audioRef.current) {
         if(isPlaying && audioRef.current.paused) {
             audioRef.current.play().catch(e => console.error("Playback failed:", e));
         } else if(!isPlaying && !audioRef.current.paused) {
             audioRef.current.pause();
         }
     }
  }, [isPlaying]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const playNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (playlist.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setIsPlaying(true);
  };

  const playPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 0.5);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (playlist.length === 0) return null;

  // --- RENDER ---
  return (
    <div 
      className={`
        fixed z-40 font-sans text-white overflow-hidden
        backdrop-blur-2xl bg-black/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]
        transition-[all] duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isMinimized 
          ? 'bottom-4 left-4 right-4 h-16 rounded-full md:left-8 md:w-80 md:right-auto' 
          : 'bottom-4 left-4 right-4 h-[215px] rounded-[2rem] md:bottom-8 md:left-8 md:right-auto md:w-96 md:h-[215px]'
        }
      `}
    >
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* --- MINIMIZED VIEW --- */}
      <div className={`
          absolute inset-0 flex items-center gap-3 px-3 w-full h-full
          transition-all duration-500
          ${isMinimized ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none transform translate-y-4'}
      `}>
        {/* Spinning Art/Icon */}
        <div className={`w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-white/20 relative shrink-0 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
          {metadata.coverUrl ? (
            <img src={metadata.coverUrl} alt="Art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <Music size={14} className="text-white/50" />
            </div>
          )}
        </div>

        {/* Scrolling Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer h-full" onClick={() => setIsMinimized(false)}>
          <div className="text-sm font-bold truncate text-white leading-tight">{metadata.title}</div>
          <div className="text-[10px] text-gray-400 truncate leading-tight">{metadata.artist}</div>
        </div>

        {/* Mini Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={togglePlay}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shrink-0"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          
          <button 
            onClick={() => setIsMinimized(false)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-white/10"
          >
            <ChevronUp size={20} />
          </button>
        </div>
      </div>

      {/* --- EXPANDED VIEW --- */}
      <div className={`
          absolute inset-0 flex flex-col p-5 w-full h-full
          transition-all duration-700
          ${!isMinimized ? 'opacity-100 delay-100' : 'opacity-0 pointer-events-none transform scale-95'}
      `}>
        {/* Top Section: Album Art & Info Side-by-Side */}
        <div className="flex items-center gap-4 mb-3">
          {/* Album Art Container */}
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-800 shadow-2xl relative group shrink-0 border border-white/10">
            {metadata.coverUrl ? (
              <img src={metadata.coverUrl} alt="Album Art" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black flex items-center justify-center">
                <Music size={28} className="text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-white font-bold text-lg truncate leading-tight mb-1">
              {metadata.title}
            </h3>
            <p className="text-gray-300 text-sm truncate">
              {metadata.artist}
            </p>
            <p className="text-gray-500 text-xs truncate mt-0.5">
              {metadata.album}
            </p>
          </div>

          {/* Collapse Button */}
          <button 
            onClick={() => setIsMinimized(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 -mt-8 -mr-2"
          >
            <ChevronDown size={24} />
          </button>
        </div>

        {/* Middle: Time & Progress */}
        <div className="flex flex-col gap-1.5 mb-2 mt-2">
          <div className="flex justify-between text-[10px] text-gray-400 font-mono px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative h-1.5 bg-gray-700/50 rounded-full group cursor-pointer w-full">
            <div 
              className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none transition-[width] duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
            <div 
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="music-range absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
        </div>

        {/* Bottom: Controls */}
        <div className="flex justify-between items-center px-1 mt-1">
            {/* Volume Control */}
            <div className="flex items-center gap-2 group relative w-20">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div className="flex-1 h-1 bg-gray-700 rounded-full relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-gray-300 rounded-full"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="flex items-center gap-6">
              <button 
                onClick={playPrev}
                className="text-gray-400 hover:text-white transition-colors hover:scale-110 active:scale-95"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>
              
              <button 
                onClick={togglePlay}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              >
                {isPlaying ? (
                  <Pause size={20} fill="currentColor" />
                ) : (
                  <Play size={20} fill="currentColor" className="ml-1" />
                )}
              </button>
              
              <button 
                onClick={playNext}
                className="text-gray-400 hover:text-white transition-colors hover:scale-110 active:scale-95"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>
            </div>
            
            {/* Spacer for Balance */}
            <div className="w-20 flex justify-end">
               {/* Could add loop/shuffle here later */}
            </div> 
        </div>
      </div>
    </div>
  );
};
