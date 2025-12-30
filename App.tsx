
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Script, GenerationProgress } from './types';
import { THEMES } from './constants';
import { DirectorChat } from './components/DirectorChat';
import { ProductionLoader } from './components/ProductionLoader';
import { CinemaPlayer } from './components/CinemaPlayer';
import { Shop } from './components/Shop';
import { generateScript, generateSceneImage, generateNarration, generateVeoVideo } from './services/geminiService';
import { saveProjectToDB, getProjectsFromDB } from './utils/storage';
import { Sparkles, Trash2, ShoppingBag, ChevronRight, Crown, Zap, Video, X, Layers } from 'lucide-react';

const createPlaceholder = (text: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, 640, 360);
    }
    return canvas.toDataURL('image/jpeg').split(',')[1];
};

// Utility for delays
const wait = (ms: number, signal?: AbortSignal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
    });
});

// --- API KEY CHECKER FOR STUDIO ENVIRONMENT ---
const ensureApiKey = async (): Promise<boolean> => {
    const w = window as any;
    if (w.aistudio) {
        try {
            const hasKey = await w.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                const success = await w.aistudio.openSelectKey();
                return success;
            }
            return true;
        } catch (e) {
            console.error("AI Studio Key Check Failed", e);
            return false;
        }
    }
    // If not in AI Studio environment, we assume API_KEY is set via env vars or other means
    return !!process.env.API_KEY; 
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [script, setScript] = useState<Script | null>(null);
  const [progress, setProgress] = useState<GenerationProgress>({
    status: 'scripting',
    currentScene: 0,
    totalScenes: 0,
    message: ''
  });
  const [savedProjects, setSavedProjects] = useState<{id: string, title: string, date: string, script: Script}[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  // Settings
  const [userAge, setUserAge] = useState<number | null>(null);
  const [sceneCount, setSceneCount] = useState<number>(4); // Default 4
  const [isMovieMode, setIsMovieMode] = useState(false);
  const [lastStoryContext, setLastStoryContext] = useState<string | null>(null);
  
  const [isPro, setIsPro] = useState(false); 
  const [veoTrials, setVeoTrials] = useState(3);

  // Economy & Shop State
  const [wallet, setWallet] = useState(0);
  
  // Themes
  const [currentThemeId, setCurrentThemeId] = useState('default');
  const [ownedThemes, setOwnedThemes] = useState<string[]>(['default']);
  
  // Voices
  const [currentVoiceId, setCurrentVoiceId] = useState('Kore');
  const [ownedVoices, setOwnedVoices] = useState<string[]>(['Kore']);

  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  // Abort Controller for cancelling production
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.appState !== undefined) {
        setAppState(event.state.appState);
      } else {
        // If no state, go to HOME
        setAppState(AppState.HOME);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial state push
    if (!window.history.state || window.history.state.appState === undefined) {
      window.history.replaceState({ appState: AppState.HOME }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync appState with browser history
  useEffect(() => {
    if (window.history.state?.appState !== appState) {
      window.history.pushState({ appState }, '');
    }
  }, [appState]);

  useEffect(() => {
    const savedWallet = localStorage.getItem('tooncraft_wallet');
    if (savedWallet) setWallet(parseInt(savedWallet, 10));
    
    const savedThemes = localStorage.getItem('tooncraft_themes');
    if (savedThemes) setOwnedThemes(JSON.parse(savedThemes));
    
    const savedCurrentTheme = localStorage.getItem('tooncraft_current_theme');
    if (savedCurrentTheme) setCurrentThemeId(savedCurrentTheme);
    
    const savedVoices = localStorage.getItem('tooncraft_voices');
    if (savedVoices) setOwnedVoices(JSON.parse(savedVoices));
    
    const savedCurrentVoice = localStorage.getItem('tooncraft_current_voice');
    if (savedCurrentVoice) setCurrentVoiceId(savedCurrentVoice);

    const trials = localStorage.getItem('tooncraft_veo_trials');
    if (trials) setVeoTrials(parseInt(trials, 10));

    getProjectsFromDB().then(setSavedProjects).catch(console.error);
  }, []);

  const saveProject = async (scriptToSave: Script) => {
    const newProject = {
      id: Date.now().toString(),
      title: scriptToSave.title || "Untitled",
      date: new Date().toLocaleDateString(),
      script: scriptToSave
    };

    try {
        await saveProjectToDB(newProject);
        const updated = await getProjectsFromDB();
        setSavedProjects(updated);
        alert("Project saved successfully!");
    } catch (e: any) {
        console.error("Save failed", e?.message || "Unknown error");
        setErrorMessage("Could not save project to database.");
    }
  };

  const handleCollectCoin = (amount: number) => {
      const newBalance = wallet + amount;
      setWallet(newBalance);
      localStorage.setItem('tooncraft_wallet', newBalance.toString());
  };

  const handleBuyTheme = (themeId: string, cost: number) => {
      if (wallet >= cost && !ownedThemes.includes(themeId)) {
          const newBalance = wallet - cost;
          const newOwned = [...ownedThemes, themeId];
          setWallet(newBalance);
          setOwnedThemes(newOwned);
          localStorage.setItem('tooncraft_wallet', newBalance.toString());
          localStorage.setItem('tooncraft_themes', JSON.stringify(newOwned));
      }
  };

  const handleSelectTheme = (themeId: string) => {
      if (ownedThemes.includes(themeId)) {
          setCurrentThemeId(themeId);
          localStorage.setItem('tooncraft_current_theme', themeId);
      }
  };

  const handleBuyVoice = (voiceId: string, cost: number) => {
      if (wallet >= cost && !ownedVoices.includes(voiceId)) {
          const newBalance = wallet - cost;
          const newOwned = [...ownedVoices, voiceId];
          setWallet(newBalance);
          setOwnedVoices(newOwned);
          localStorage.setItem('tooncraft_wallet', newBalance.toString());
          localStorage.setItem('tooncraft_voices', JSON.stringify(newOwned));
      }
  };

  const handleSelectVoice = (voiceId: string) => {
      if (ownedVoices.includes(voiceId)) {
          setCurrentVoiceId(voiceId);
          localStorage.setItem('tooncraft_current_voice', voiceId);
      }
  };

  const handleStartFlow = async () => {
      // Ensure API Key is selected before starting the flow (especially for Live API in Brainstorm)
      await ensureApiKey();

      if (userAge) {
          if (userAge >= 10) {
            setAppState(AppState.SCENE_SELECTION);
          } else {
            setAppState(AppState.BRAINSTORM);
          }
      } else {
          setAppState(AppState.AGE_INPUT);
      }
      setErrorMessage(null);
  };

  const handleAgeSelect = (age: number) => {
      setUserAge(age);
      if (age < 10) {
          setSceneCount(4);
          setAppState(AppState.BRAINSTORM);
      } else {
          setAppState(AppState.SCENE_SELECTION);
      }
  };

  const checkVeoAccess = (): boolean => {
    if (isPro) return true;
    if (veoTrials > 0) return true;
    setShowSubscriptionModal(true);
    return false;
  };

  const decrementVeoTrial = () => {
      if (!isPro && veoTrials > 0) {
          const newVal = veoTrials - 1;
          setVeoTrials(newVal);
          localStorage.setItem('tooncraft_veo_trials', newVal.toString());
      }
  };

  const handleCancelProduction = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setAppState(AppState.HOME);
      setScript(null);
      setErrorMessage(null);
  };

  const handleStoryReady = async (storyContext: string) => {
    if (!userAge) return;
    
    // Reset Cancel Signal
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLastStoryContext(storyContext);
    setAppState(AppState.PRODUCING);
    setErrorMessage(null);
    
    // Ensure Key is Valid before production
    await ensureApiKey();

    try {
      if (signal.aborted) return;

      // 1. Scripting
      setProgress({ status: 'scripting', currentScene: 0, totalScenes: 0, message: 'Writing the screenplay...' });
      const generatedScript = await generateScript(storyContext, userAge, isMovieMode, sceneCount, signal);
      
      if (signal.aborted) return;

      generatedScript.targetAge = userAge;
      generatedScript.isMovieMode = isMovieMode;
      const total = generatedScript.scenes.length;
      setScript(generatedScript);

      // 2. Audio (Common to both modes)
      setProgress({ status: 'audio', currentScene: 0, totalScenes: total, message: 'Casting voice actors...' });
      // Sequential audio generation to avoid rate limits
      for (let i = 0; i < total; i++) {
        if (signal.aborted) return;
        try {
            const audio = await generateNarration(generatedScript.scenes[i].narrative, userAge, signal);
            generatedScript.scenes[i].audioUrl = audio;
            await wait(200, signal); // Small delay
        } catch (e) {
            if (signal.aborted) return;
            console.warn(`Audio failed for scene ${i}`, e);
        }
      }

      // 3. Visuals - DISTINCT SYSTEMS
      // We process strictly sequentially now to prevent 429 errors
      
      let referenceImage: string | undefined = undefined;

      // HELPER: Generates the base image (NanoBanana)
      const generateBaseImage = async (index: number, refImg?: string) => {
          const scene = generatedScript.scenes[index];
          const img = await generateSceneImage(scene.visualDescription, userAge, refImg, false, signal);
          generatedScript.scenes[index].imageUrl = img;
          return img;
      };

      if (isMovieMode) {
          // --- VEO 3 SYSTEM (Sequential, Mixed Media) ---
          const hasAccess = checkVeoAccess();
          if (hasAccess) decrementVeoTrial();

          for (let i = 0; i < total; i++) {
              if (signal.aborted) return;

              // Alternating Logic: 
              // i=0 (Scene 1): Video
              // i=1 (Scene 2): Image (Static)
              // i=2 (Scene 3): Video
              const isStatic = i % 2 !== 0;
              
              setProgress({ 
                  status: 'visuals', 
                  currentScene: i + 1, 
                  totalScenes: total, 
                  message: isStatic 
                    ? `Drawing Scene ${i+1}...` 
                    : `Filming Scene ${i + 1} with Veo... (This takes a moment)` 
              });

              try {
                  // Reference for consistency
                  const ref = i > 0 ? referenceImage : undefined;
                  const baseImg = await generateBaseImage(i, ref);
                  if (i === 0) referenceImage = baseImg;

                  // Add significant delay between heavy generations to avoid rate limits
                  await wait(2000, signal); 

                  if (!isStatic) {
                      // Generate Video
                      const videoBase64 = await generateVeoVideo(generatedScript.scenes[i].visualDescription, baseImg, signal);
                      generatedScript.scenes[i].videoUrl = videoBase64;
                      generatedScript.scenes[i].isVideo = true;
                  } else {
                      // Static Image Only
                      generatedScript.scenes[i].isVideo = false;
                  }
                  
              } catch (e: any) {
                  if (signal.aborted) return;

                  const msg = e instanceof Error ? e.message : String(e);
                  console.error(`Generation Failed for Scene ${i}:`, msg);
                  
                  // Fallback: If Veo fails, we already have baseImg set in generateBaseImage
                  // Just mark it as not video
                  generatedScript.scenes[i].isVideo = false; 
                  if (!generatedScript.scenes[i].imageUrl) {
                      generatedScript.scenes[i].imageUrl = createPlaceholder("Visual Generation Failed");
                  }
              }
              // Extra safety delay after each scene loop
              await wait(1000, signal);
          }

      } else {
          // --- NANOBANANA SYSTEM (Sequential) ---
          for (let i = 0; i < total; i++) {
              if (signal.aborted) return;

              setProgress({ 
                  status: 'visuals', 
                  currentScene: i + 1, 
                  totalScenes: total, 
                  message: `Drawing Scene ${i + 1}/${total}...` 
              });
              
              try {
                  const ref = i > 0 ? referenceImage : undefined;
                  const img = await generateBaseImage(i, ref);
                  if (i === 0) referenceImage = img;
                  
                  // Delay to respect rate limits
                  await wait(1500, signal); 
              } catch (e) {
                   if (signal.aborted) return;
                   console.error(`Visual gen failed for scene ${i}`, e);
                   generatedScript.scenes[i].imageUrl = createPlaceholder(`Scene ${i+1} Missing`);
              }
          }
      }

      if (signal.aborted) return;
      setScript({...generatedScript}); 
      setAppState(AppState.PLAYING);
      
    } catch (error: any) {
      if (signal.aborted) return; // Silent return on cancel
      console.error("Production failed", error?.message || "Unknown error");
      setErrorMessage(error?.message || "Oops! The studio ran out of magic.");
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentTheme.mainGradient} p-4 md:p-8 flex items-center justify-center font-['Fredoka'] text-white transition-colors duration-700`}>
      <div className={`w-full max-w-6xl aspect-video ${currentTheme.panelBg} backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border ${currentTheme.panelBorder} relative overflow-hidden flex flex-col transition-colors duration-700`}>
        
        {appState === AppState.HOME && (
            <div className="flex-1 flex flex-col items-center justify-center relative p-12 text-center space-y-10">
                 <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
                     <div className="absolute top-10 left-10 w-64 h-64 bg-purple-500 rounded-full blur-[100px] animate-pulse"></div>
                     <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500 rounded-full blur-[120px] animate-pulse"></div>
                 </div>
                 
                 <div className="absolute top-8 left-8 flex gap-4 z-20">
                    <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-sm font-bold">
                        {isPro ? <Crown size={16} className="text-yellow-400" /> : <Zap size={16} className="text-white/50" />}
                        {isPro ? <span className="text-yellow-400">Pro Studio Active</span> : <span className="text-white/50">{veoTrials} Free Videos Left</span>}
                    </div>
                 </div>

                 <div className="absolute top-8 right-8 z-20">
                     <button 
                        onClick={() => setAppState(AppState.SHOP)}
                        className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-sm font-bold hover:bg-black/60 transition-colors"
                     >
                         <ShoppingBag size={18} className="text-pink-400" />
                         Shop
                         <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">{wallet} 🪙</span>
                     </button>
                 </div>

                 <div className="z-10 space-y-6 animate-fade-in-up">
                     <div className="inline-flex items-center justify-center p-6 bg-white/10 rounded-3xl mb-4 shadow-lg backdrop-blur-md border border-white/10">
                        <Sparkles className="w-16 h-16 text-yellow-400" />
                     </div>
                     <h1 className="text-7xl md:text-8xl font-black tracking-tighter drop-shadow-2xl bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-white">
                        ToonCraft
                     </h1>
                     <p className="text-2xl text-indigo-100/80 font-medium max-w-2xl mx-auto">
                        The AI Cartoon Studio for Kids
                     </p>

                     <div className="flex flex-col items-center gap-6 mt-8">
                         <button 
                            onClick={handleStartFlow}
                            className="bg-white text-indigo-900 px-12 py-5 rounded-full font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
                         >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                                <Video size={20} className="text-indigo-600" />
                            </div>
                            Start Filming <ChevronRight />
                         </button>
                     </div>
                 </div>
                 
                 {savedProjects.length > 0 && (
                     <div className="absolute bottom-8 left-0 w-full px-12">
                         <div className="flex gap-4 overflow-x-auto pb-4 justify-center">
                             {savedProjects.map(p => (
                                 <div key={p.id} onClick={() => { setScript(p.script); setAppState(AppState.PLAYING); }} className="flex-shrink-0 w-48 bg-black/40 p-4 rounded-2xl cursor-pointer hover:bg-black/60 border border-white/5 transition-all">
                                     <div className="text-sm font-bold truncate">{p.title}</div>
                                     <div className="text-xs text-white/40">{p.date}</div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
            </div>
        )}

        {appState === AppState.SHOP && (
            <Shop 
                currentTheme={currentTheme}
                ownedThemes={ownedThemes}
                currentVoiceId={currentVoiceId}
                ownedVoices={ownedVoices}
                wallet={wallet}
                onBuyTheme={handleBuyTheme}
                onSelectTheme={handleSelectTheme}
                onBuyVoice={handleBuyVoice}
                onSelectVoice={handleSelectVoice}
                onClose={() => setAppState(AppState.HOME)}
            />
        )}

        {appState === AppState.AGE_INPUT && (
            <div className="flex-1 flex flex-col items-center justify-center relative p-12 z-20 animate-fade-in">
                <h2 className="text-5xl font-black mb-12">How old are you?</h2>
                <div className="grid grid-cols-3 gap-6">
                    {[5,6,7,8,9,10,11,12].map(age => (
                        <button 
                            key={age} 
                            onClick={() => handleAgeSelect(age)} 
                            className="w-24 h-24 rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/10 hover:border-white/40 text-4xl font-black transition-all hover:scale-110"
                        >
                            {age}
                        </button>
                    ))}
                </div>
                <button onClick={() => setAppState(AppState.HOME)} className="mt-12 opacity-50 hover:opacity-100">Back</button>
            </div>
        )}

        {appState === AppState.SCENE_SELECTION && (
            <div className="flex-1 flex flex-col items-center justify-center relative p-12 z-20 animate-fade-in">
                <div className="inline-flex items-center justify-center p-4 bg-white/10 rounded-full mb-6 shadow-lg backdrop-blur-md border border-white/10">
                    <Layers className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-4xl font-black mb-4">How many scenes?</h2>
                <p className="text-xl text-white/50 mb-10">Choose the length of your cartoon.</p>
                
                <div className="grid grid-cols-4 gap-6">
                    {[1,2,3,4,5,6,7,8].map(count => (
                        <button 
                            key={count} 
                            onClick={() => { setSceneCount(count); setAppState(AppState.BRAINSTORM); }} 
                            className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-cyan-500 hover:text-black border-2 border-white/10 hover:border-cyan-400 text-3xl font-black transition-all hover:scale-110 flex items-center justify-center"
                        >
                            {count}
                        </button>
                    ))}
                </div>
                <button onClick={() => setAppState(AppState.AGE_INPUT)} className="mt-12 opacity-50 hover:opacity-100">Back</button>
            </div>
        )}

        {appState === AppState.BRAINSTORM && (
            <DirectorChat 
                onStoryReady={handleStoryReady} 
                theme={currentTheme} 
                userAge={userAge || 8}
                isMovieMode={isMovieMode}
                setIsMovieMode={setIsMovieMode}
                isPro={isPro}
                wallet={wallet}
                onOpenSubscription={() => setShowSubscriptionModal(true)}
                veoTrials={veoTrials}
                currentVoiceId={currentVoiceId}
            />
        )}

        {appState === AppState.PRODUCING && (
            <ProductionLoader 
                progress={progress} 
                theme={currentTheme} 
                onCollectCoin={handleCollectCoin} 
                userAge={userAge || 8}
                onCancel={handleCancelProduction}
            />
        )}

        {appState === AppState.PLAYING && script && (
             <CinemaPlayer 
                script={script} 
                theme={currentTheme} 
                onHome={() => setAppState(AppState.HOME)} 
                onSave={() => saveProject(script)} 
             />
        )}

        {errorMessage && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-fade-in">
                <Trash2 className="w-20 h-20 text-red-500 mb-6" />
                <h2 className="text-3xl font-black mb-4">Oops!</h2>
                <p className="text-xl opacity-70 mb-8 max-w-lg">{errorMessage}</p>
                <div className="flex gap-4">
                    <button onClick={() => setAppState(AppState.HOME)} className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20">Go Home</button>
                    {lastStoryContext && <button onClick={() => handleStoryReady(lastStoryContext)} className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500">Try Again</button>}
                </div>
            </div>
        )}

        {showSubscriptionModal && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="relative max-w-lg w-full bg-gradient-to-b from-indigo-900 to-black p-8 rounded-3xl border border-yellow-500/50 shadow-2xl text-center">
                    <button onClick={() => setShowSubscriptionModal(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">
                        <X size={24} />
                    </button>
                    
                    <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/50">
                        <Crown size={40} className="text-black" />
                    </div>
                    
                    <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
                        Unlock ToonCraft Pro!
                    </h2>
                    <p className="text-indigo-200 mb-8">
                        Ask your parents to unlock unlimited magic powers!
                    </p>

                    <div className="space-y-4 mb-8 text-left bg-white/5 p-6 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <Video className="text-pink-400" size={20} />
                            <span>Unlimited <strong>Magic AI Video</strong> generation</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-cyan-400" size={20} />
                            <span><strong>4K Quality</strong> Images</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <ShoppingBag className="text-yellow-400" size={20} />
                            <span>Unlock <strong>All Studio Themes</strong></span>
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            setIsPro(true); 
                            setShowSubscriptionModal(false);
                            alert("Welcome to Pro! 🎉");
                        }}
                        className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full font-black text-black text-xl hover:scale-105 transition-transform shadow-lg"
                    >
                        Ask Parents to Buy ($4.99)
                    </button>
                    <p className="mt-4 text-xs text-white/30">One-time purchase. Kids: Ask first!</p>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
