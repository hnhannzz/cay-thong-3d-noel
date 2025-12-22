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

  // Initialize checks for mobile to auto-minimize if needed (optional, keeping expanded by default for visibility)
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
        fixed z-40 font-sansZS text-white overflow-hidden
        backdrop-blur-xl bg-black/60 border border-white/10 shadow-2xl 
        transition-[all] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]
        ${isMinimized 
          ? 'bottom-4 left-4 right-4 md:left-8 md:w-auto md:right-auto rounded-full' 
          : 'bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-auto md:w-80 rounded-3xl'
        }
      `}
    >
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* 
        SMOOTH TRANSITION WRAPPER
        We render both layouts but cross-fade them and use position absolute to allow container to size to the active one 
      */}

      {/* --- MINIMIZED VIEW --- */}
      <div className={`
          flex items-center gap-3 p-2 pr-4 w-full
          transition-all duration-500 delay-100
          ${isMinimized ? 'opacity-100 relative' : 'opacity-0 absolute top-0 left-0 pointer-events-none translate-y-4'}
      `}>
        {/* Spinning Art/Icon */}
        <div className={`w-10 h-10 rounded-full overflow-hidden bg-gray-800kz border border-white/20 relative shrink-0 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
          {metadata.coverUrl ? (
            <img src={metadata.coverUrl} alt="Art" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <Music size={14} className="text-white/50" />
            </div>
          )}
        </div>

        {/* Scrolling Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={() => setIsMinimized(false)}>
          <div className="text-sm font-bold truncate text-white">{metadata.title}</div>
          <div className="text-xs text-gray-400 truncate">{metadata.artist}</div>
        </div>

        {/* Mini Controls */}
        <button 
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shrink-0"
        >
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
        </button>
        
        <button 
          onClick={() => setIsMinimized(false)}
          className="text-gray-400 hover:text-white p-1"
        >
          <ChevronUp size={20} />
        </button>
      </div>

      {/* --- EXPANDED VIEW --- */}
      <div className={`
          flex flex-col p-6 w-full
          transition-all duration-500
          ${!isMinimized ? 'opacity-100 relative delay-200' : 'opacity-0 absolute top-0 left-0 pointer-events-none -translate-y-4'}
      `}>
        {/* Header Controls */}
        <div className="absolute top-2 right-2">
          <button 
            onClick={() => setIsMinimized(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* Album Art & Info */}
        <div className="flex gap-4 mb-4 mt-2">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 shrink-0 shadow-lg relative group">
            {metadata.coverUrl ? (
              <img src={metadata.coverUrl} alt="Album Art" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black flex items-center justify-center">
                <Music size={24} className="text-white/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
          </div>

          <div className="flex flex-col justify-center min-w-0 pr-6">
            <h3 className="text-white font-bold text-base truncate leading-tight mb-1">
              {metadata.title}
            </h3>
            <p className="text-gray-400 text-xs truncate">
              {metadata.artist}
            </p>
            <p className="text-gray-500 text-[10px] truncate mt-0.5">
              {metadata.album}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-4 px-1">
          <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative h-1 bg-gray-700/50 rounded-full group cursor-pointer">
            <div 
              className="absolute top-0 left-0 h-full bg-[#D4AF37] rounded-full pointer-events-none transition-[width] duration-100 ease-linear shadow-[0_0_10px_rgba(212,175,55,0.5)]"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            ></div>
            {/* Hover Handle */}
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
          <span className="text-[10px] text-gray-400 font-mono w-8">{formatTime(duration)}</span>
        </div>

        {/* Main Controls */}
        <div className="flex justify-between items-center mb-1 px-4">
            {/* Volume Control */}
            <div className="flex items-center gap-2 group relative w-24">
              <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div className="flex-1 h-1 bg-gray-700 rounded-full relative">
                <div 
                  className="absolute left-0 top-0 h-full bg-white rounded-full"
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

            <div className="flex items-center gap-6">
              <button 
                onClick={playPrev}
                className="text-gray-400 hover:text-white transition-colors hover:scale-110 active:scale-95"
              >
                <SkipBack size={22} fill="currentColor" />
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
                <SkipForward size={22} fill="currentColor" />
              </button>
            </div>
            
            {/* Spacer to balance volume on left */}
            <div className="w-24"></div> 
        </div>
      </div>
    </div>
  );
};
