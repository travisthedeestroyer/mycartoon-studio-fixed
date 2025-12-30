
import React, { useState, useEffect, useRef } from 'react';
import { Script, Theme } from '../types';
import { Play, Pause, RotateCcw, Home, Save, Music, Volume2 } from 'lucide-react';
import { MUSIC_TRACKS, SOUND_EFFECTS } from '../constants';

interface CinemaPlayerProps {
  script: Script;
  theme: Theme;
  onHome: () => void;
  onSave?: () => void;
}

export const CinemaPlayer: React.FC<CinemaPlayerProps> = ({ script, theme, onHome, onSave }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState(MUSIC_TRACKS[1].url);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const [showSfxMenu, setShowSfxMenu] = useState(false);
  
  // State to force re-render when SFX updates since we mutate script
  const [, setUpdateTick] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  
  const currentScene = script.scenes[currentSceneIndex];

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
        if (!isMountedRef.current) return;
        setShowControls(true);
        clearTimeout(timeout);
        if (isPlaying) {
            timeout = setTimeout(() => {
                if(isMountedRef.current) setShowControls(false);
            }, 3000);
        }
    };
    
    window.addEventListener('mousemove', resetTimer);
    return () => {
        window.removeEventListener('mousemove', resetTimer);
        clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Initial Setup & Volume
  useEffect(() => {
    if (musicRef.current) {
        musicRef.current.volume = 0.2;
    }
  }, []);

  // Asset Loading - Triggered when scene index changes
  useEffect(() => {
    if (!script || currentSceneIndex >= script.scenes.length) return;
    
    // We wrap in a small timeout to ensure refs are bound after render
    const timer = setTimeout(() => {
        loadSceneAssets(currentSceneIndex);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [currentSceneIndex, script]);

  // Sync Play state with Music
  useEffect(() => {
      const music = musicRef.current;
      if (!music) return;

      if (isPlaying && backgroundMusicUrl) {
          const playPromise = music.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => {
                  if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                      console.warn("Music play prevented");
                  }
              });
          }
      } else {
          music.pause();
      }
  }, [isPlaying, backgroundMusicUrl]);

  // Audio Ducking Logic
  useEffect(() => {
    const music = musicRef.current;
    const narration = audioRef.current;
    
    if (!music || !narration) return;

    const fadeOut = () => { if (music) music.volume = 0.05; };
    const fadeIn = () => { if (music) music.volume = 0.2; };

    narration.addEventListener('play', fadeOut);
    narration.addEventListener('ended', fadeIn);
    narration.addEventListener('pause', fadeIn);
    
    return () => {
        narration.removeEventListener('play', fadeOut);
        narration.removeEventListener('ended', fadeIn);
        narration.removeEventListener('pause', fadeIn);
    };
  }, []);

  const loadSceneAssets = (index: number) => {
    const scene = script.scenes[index];
    
    // Audio
    if (audioRef.current) {
        if (scene.audioUrl) {
            audioRef.current.src = `data:audio/wav;base64,${scene.audioUrl}`;
            audioRef.current.load();
        } else {
             audioRef.current.src = "";
        }
    }

    // SFX
    if (sfxRef.current) {
        if (scene.sfxUrl) {
            sfxRef.current.src = scene.sfxUrl;
            sfxRef.current.load();
        } else {
            sfxRef.current.src = "";
        }
    }

    // Video
    if (scene.isVideo && scene.videoUrl && videoRef.current) {
        videoRef.current.src = `data:video/mp4;base64,${scene.videoUrl}`;
        videoRef.current.load();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause Everything
      audioRef.current?.pause();
      videoRef.current?.pause();
      musicRef.current?.pause();
      sfxRef.current?.pause();
      setShowControls(true);
      setIsPlaying(false);
    } else {
      // Play Everything
      setIsPlaying(true);
      
      const safePlay = (media: HTMLMediaElement | null, label: string) => {
          if (media) {
              media.play().catch(e => {
                  if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                      console.warn(`${label} play failed`, e.message);
                  }
              });
          }
      };

      // 1. Narration
      if (currentScene.audioUrl && audioRef.current) {
         safePlay(audioRef.current, "Narration");
      } else {
         // Fallback timer if no audio
         const duration = Math.max(3000, currentScene.narrative.length * 150);
         setTimeout(() => {
             if (isPlaying && isMountedRef.current) handleEnded();
         }, duration);
      }

      // 2. Video
      if (currentScene.isVideo && videoRef.current) {
          safePlay(videoRef.current, "Video");
      }

      // 3. SFX
      if (currentScene.sfxUrl && sfxRef.current) {
          safePlay(sfxRef.current, "SFX");
      }
    }
  };

  const handleEnded = () => {
    if (!isMountedRef.current) return;

    if (currentSceneIndex < script.scenes.length - 1) {
      const next = currentSceneIndex + 1;
      setCurrentSceneIndex(next);
      // Asset loading handled by useEffect now
      
      // Short delay for transition smoothness and to allow useEffect to setup sources
      setTimeout(() => { 
          if (isPlaying && isMountedRef.current) { 
              const safePlay = (media: HTMLMediaElement | null) => {
                  media?.play().catch(() => {});
              };

              // Play Next Narration
              if (script.scenes[next].audioUrl && audioRef.current) {
                 safePlay(audioRef.current);
              } else {
                 // No Audio for next scene? Timer.
                 const duration = Math.max(3000, script.scenes[next].narrative.length * 150);
                 setTimeout(handleEnded, duration);
              }
              
              // Play Next Video
              if(script.scenes[next].isVideo && videoRef.current) {
                  safePlay(videoRef.current);
              }

              // Play Next SFX
              if(script.scenes[next].sfxUrl && sfxRef.current) {
                  sfxRef.current.currentTime = 0;
                  safePlay(sfxRef.current);
              }
          } 
      }, 500); 
    } else {
      // End of Movie
      setIsPlaying(false);
      setShowControls(true);
      musicRef.current?.pause();
    }
  };

  const handleSelectSFX = (url: string) => {
    const scene = script.scenes[currentSceneIndex];
    scene.sfxUrl = url;
    setUpdateTick(t => t + 1); // Force update to show selection
    setShowSfxMenu(false);

    // Preview
    if (url) {
        const audio = new Audio(url);
        audio.play().catch(() => {});
        // Update current ref immediately if configured
        if (sfxRef.current) sfxRef.current.src = url;
    } else {
        if (sfxRef.current) sfxRef.current.src = "";
    }
  };

  const getKenBurnsEffect = (index: number) => {
      // Varied pan/zoom effects based on scene index
      const effects = [
          'scale-125 origin-center',         // Zoom Center
          'scale-125 origin-top-left',       // Pan from Top-Left
          'scale-125 origin-bottom-right',   // Pan from Bottom-Right
          'scale-125 origin-left',           // Pan Right
          'scale-125 origin-right'           // Pan Left
      ];
      return effects[index % effects.length];
  };
  
  const marqueeDuration = Math.max(6, currentScene.narrative.length * 0.2);

  return (
    <div className="flex flex-col h-full bg-black rounded-3xl overflow-hidden shadow-2xl relative group border border-white/10" ref={containerRef}>
      
      {/* Top Toolbar */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="bg-black/60 backdrop-blur-xl px-2 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-xl">
             <button onClick={onHome} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/70 hover:text-white" title="Home">
                 <Home size={20} />
             </button>
             <button onClick={() => { setIsPlaying(false); setCurrentSceneIndex(0); }} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/70 hover:text-white" title="Restart">
                 <RotateCcw size={20} />
             </button>
             {onSave && (
                 <button onClick={onSave} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/70 hover:text-white" title="Save Project">
                     <Save size={20} />
                 </button>
             )}
             
             <div className="w-px h-6 bg-white/20 mx-1"></div>

             {/* Music Menu */}
             <div className="relative">
                 <button 
                    onClick={() => { setShowMusicMenu(!showMusicMenu); setShowSfxMenu(false); }} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors ${backgroundMusicUrl ? 'text-yellow-400' : 'text-white/50'}`}
                    title="Select Background Music"
                 >
                     <Music size={20} />
                 </button>
                 {showMusicMenu && (
                     <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 w-48 shadow-2xl z-[60]">
                         <h4 className="text-xs font-bold text-white/50 px-3 py-1 mb-1">SOUNDTRACK</h4>
                         {MUSIC_TRACKS.map(t => (
                             <button 
                                key={t.name}
                                onClick={() => { 
                                    setBackgroundMusicUrl(t.url); 
                                    setShowMusicMenu(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 ${backgroundMusicUrl === t.url ? 'text-yellow-400 font-bold' : 'text-white/70'}`}
                             >
                                 {t.name}
                             </button>
                         ))}
                     </div>
                 )}
             </div>

             {/* SFX Menu */}
             <div className="relative">
                 <button 
                    onClick={() => { setShowSfxMenu(!showSfxMenu); setShowMusicMenu(false); }} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors ${currentScene.sfxUrl ? 'text-pink-400' : 'text-white/50'}`}
                    title="Select Sound Effect for Scene"
                 >
                     <Volume2 size={20} />
                 </button>
                 {showSfxMenu && (
                     <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 w-48 shadow-2xl z-[60]">
                         <h4 className="text-xs font-bold text-white/50 px-3 py-1 mb-1">SCENE SOUND FX</h4>
                         {SOUND_EFFECTS.map(s => (
                             <button 
                                key={s.name}
                                onClick={() => handleSelectSFX(s.url)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 ${currentScene.sfxUrl === s.url ? 'text-pink-400 font-bold' : 'text-white/70'}`}
                             >
                                 {s.name}
                             </button>
                         ))}
                     </div>
                 )}
             </div>
          </div>
      </div>

      {/* Main Screen */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {currentScene.isVideo ? (
            <video 
                ref={videoRef} 
                className="w-full h-full object-contain" 
                muted 
                playsInline 
            />
        ) : (
             <img 
                key={currentSceneIndex}
                src={`data:image/jpeg;base64,${currentScene.imageUrl}`} 
                className={`w-full h-full object-cover transition-transform duration-[20s] ease-linear will-change-transform ${isPlaying ? getKenBurnsEffect(currentSceneIndex) : 'scale-100 origin-center'}`} 
             />
        )}
        
        {/* Caption Bar - Only animates when playing */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent border-t border-white/5 h-24 flex items-center z-40">
             <div className="w-full h-full relative overflow-hidden flex items-center">
                 <p 
                    key={currentSceneIndex}
                    className={`text-3xl font-bold text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] whitespace-nowrap absolute ${isPlaying ? 'animate-marquee' : ''}`} 
                    style={{ animationDuration: `${marqueeDuration}s` }}
                 >
                    {currentScene?.narrative}
                 </p>
             </div>
        </div>

        {/* Big Play Button */}
        {!isPlaying && (
            <button 
                onClick={handlePlayPause} 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/50 hover:scale-110 transition-transform group shadow-[0_0_50px_rgba(255,255,255,0.2)] z-50"
            >
                <Play size={40} fill="white" className="ml-2 text-white group-hover:text-yellow-400 transition-colors" />
            </button>
        )}
        
        {isPlaying && showControls && (
             <button 
                onClick={handlePlayPause}
                className="absolute bottom-32 right-8 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-50"
             >
                 <Pause size={24} fill="black" />
             </button>
        )}
      </div>

      <div className="absolute top-6 right-6 px-4 py-1 bg-black/40 backdrop-blur-md rounded-full text-xs font-bold text-white/50 border border-white/5 z-40">
         Scene {currentSceneIndex + 1} / {script.scenes.length}
      </div>

      <audio 
          ref={audioRef} 
          onEnded={handleEnded} 
          onError={() => { 
              if (!currentScene.isVideo) handleEnded(); 
          }}
          className="hidden" 
      />
      <audio 
          ref={sfxRef} 
          onError={() => {
              console.warn("SFX Error");
          }}
          className="hidden" 
      />
      {backgroundMusicUrl && (
          <audio 
              ref={musicRef} 
              src={backgroundMusicUrl} 
              loop 
              crossOrigin="anonymous"
              className="hidden" 
          />
      )}
      
      <style>{`
        @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation-name: marquee;
            animation-timing-function: linear;
            animation-iteration-count: 1;
            padding-left: 0;
            left: 0;
            will-change: transform;
        }
      `}</style>
    </div>
  );
};
