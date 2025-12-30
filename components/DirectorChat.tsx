
import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, Film, Mic, Video, BookOpen, Crown, Dice5, AlertTriangle, MessageSquare } from 'lucide-react';
import { base64PCM16ToFloat32 } from '../utils/audio';
import { getLiveClient, generateNarration, transcribeAudio, chatWithDirector } from '../services/geminiService';
import { Theme, Message } from '../types';
import { GET_LIVE_SYSTEM_INSTRUCTION } from '../constants';
import { LiveServerMessage, FunctionDeclaration, Type, Modality } from "@google/genai";

interface DirectorChatProps {
  onStoryReady: (context: string) => void;
  theme: Theme;
  userAge: number;
  isMovieMode: boolean;
  setIsMovieMode: (val: boolean) => void;
  isPro: boolean;
  wallet: number;
  onOpenSubscription: () => void;
  veoTrials: number;
  currentVoiceId: string;
}

const startFilmingTool: FunctionDeclaration = {
    name: 'startFilming',
    description: 'Call this function when the story brainstorming is finished and you have the Hero, Setting, and Plot.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING, description: 'The final summary of the story.' }
        },
        required: ['summary']
    }
};

export const DirectorChat: React.FC<DirectorChatProps> = ({ 
  onStoryReady, 
  theme, 
  userAge,
  isMovieMode,
  setIsMovieMode,
  isPro,
  veoTrials,
  onOpenSubscription,
  currentVoiceId
}) => {
  const [connectionStatus, setConnectionStatus] = useState<string>("Waking up the Director...");
  const [isDirectorSpeaking, setIsDirectorSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // FALLBACK MODE STATES
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [isRecordingFallback, setIsRecordingFallback] = useState(false);
  const [fallbackHistory, setFallbackHistory] = useState<Message[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const currentSessionPromise = useRef<Promise<any> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isSessionActiveRef = useRef<boolean>(false);

  const onStoryReadyRef = useRef(onStoryReady);
  useEffect(() => {
    onStoryReadyRef.current = onStoryReady;
  }, [onStoryReady]);
  
  useEffect(() => {
    let active = true;
    const init = async () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass({ sampleRate: 16000 });
            audioContextRef.current = ctx;

            if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => console.log("Waiting for user gesture"));
            }

            if (active) startLiveSession();
        } catch (e) {
            console.error("Auto-start failed", e);
            setErrorMessage("Please click the mic to start!");
        }
    };
    init();

    const animId = requestAnimationFrame(drawVisualizer);
    const watchdog = setInterval(checkIdle, 1000);

    return () => {
        active = false;
        stopLiveSession();
        cancelAnimationFrame(animId);
        clearInterval(watchdog);
    };
  }, []);

  const checkIdle = async () => {
      // Idle check only runs in Live Mode
      if (isFallbackMode) return;
      
      if (currentSessionPromise.current && !isDirectorSpeaking && !isUserSpeaking && hasStarted) {
          if (Date.now() - lastActivityRef.current > 12000) {
              lastActivityRef.current = Date.now(); 
              triggerIdlePrompt();
          }
      }
  };

  const triggerIdlePrompt = async () => {
      try {
          const idleText = "Are you still there? Tell me about your story!";
          const audio = await generateNarration(idleText, userAge);
          if (audio) playStreamAudio(audio); 
      } catch(e) { console.error(e); }
  };

  const resetIdle = () => lastActivityRef.current = Date.now();

  const playStreamAudio = (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    resetIdle();
    setIsDirectorSpeaking(true);

    const float32 = base64PCM16ToFloat32(base64Audio);
    const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    if (analyserRef.current) source.connect(analyserRef.current);

    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) nextStartTimeRef.current = currentTime;
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    sourceNodesRef.current.push(source);

    source.onended = () => {
        sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
        if (sourceNodesRef.current.length === 0) {
            setIsDirectorSpeaking(false);
        }
    };
  };

  const startLiveSession = async () => {
      if (isFallbackMode) return;
      
      setConnectionStatus("Calling Director...");
      setErrorMessage(null);
      isSessionActiveRef.current = true;
      
      try {
        if (!audioContextRef.current) {
             const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
             audioContextRef.current = ctx;
        }
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const ai = getLiveClient(); // Will use current rotated key
        const config = {
            responseModalities: [Modality.AUDIO],
            // Use the passed in currentVoiceId (e.g., 'Puck', 'Kore')
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceId } } },
            systemInstruction: GET_LIVE_SYSTEM_INSTRUCTION(userAge),
            tools: [{ functionDeclarations: [startFilmingTool] }]
        };

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config,
            callbacks: {
                onopen: () => {
                    if (!isSessionActiveRef.current) return;
                    setConnectionStatus("Director is listening!");
                    setHasStarted(true);
                    nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
                },
                onmessage: async (msg: LiveServerMessage) => {
                    if (!isSessionActiveRef.current) return;
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData) playStreamAudio(audioData);

                    if (msg.serverContent?.interrupted) {
                         sourceNodesRef.current.forEach(n => { try{n.stop()}catch(e){} });
                         sourceNodesRef.current = [];
                         nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
                         setIsDirectorSpeaking(false);
                    }

                    if (msg.toolCall) {
                        const call = msg.toolCall.functionCalls.find(fc => fc.name === 'startFilming');
                        if (call) {
                            setConnectionStatus("Starting Production!");
                            const summary = (call.args as any).summary;
                            
                            sessionPromise.then(s => s.sendToolResponse({
                                functionResponses: [{
                                    name: call.name,
                                    id: call.id,
                                    response: { result: 'ok' } 
                                }]
                            }));
                            
                            setTimeout(() => {
                                stopLiveSession();
                                onStoryReadyRef.current(summary);
                            }, 2000);
                        }
                    }
                },
                onclose: () => {
                    if (isSessionActiveRef.current) {
                        setConnectionStatus("Disconnected");
                    }
                },
                onerror: (e) => {
                    console.error("Live API Error", e);
                    // CRITICAL: Switch to fallback mode if Live API fails
                    if (isSessionActiveRef.current) {
                        setConnectionStatus("Director Busy - Switching to Manual");
                        stopLiveSession();
                        setIsFallbackMode(true);
                        setHasStarted(true);
                    }
                }
            }
        });
        
        // Handle connection promise rejection (e.g., Deadline Exceeded)
        sessionPromise.catch((e) => {
             console.error("Live Connection Handshake Failed:", e);
             if (isSessionActiveRef.current) {
                 setConnectionStatus("Director Busy - Switching to Manual");
                 stopLiveSession();
                 setIsFallbackMode(true);
                 setHasStarted(true);
             }
        });

        currentSessionPromise.current = sessionPromise;

        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        processor.onaudioprocess = async (e) => {
            if (!isSessionActiveRef.current) return;

            const inputData = e.inputBuffer.getChannelData(0);
            
            let sum = 0;
            for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);
            if (rms > 0.02) {
                setIsUserSpeaking(true);
                resetIdle();
            } else {
                setIsUserSpeaking(false);
            }

            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            let binary = '';
            const bytes = new Uint8Array(pcmData.buffer);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64Data = btoa(binary);

            try {
                const session = await sessionPromise;
                if (isSessionActiveRef.current) {
                    session.sendRealtimeInput({
                        media: { mimeType: "audio/pcm;rate=16000", data: base64Data }
                    });
                }
            } catch (err) {
                // Squelch errors if session failed to connect or was closed
            }
        };
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);

      } catch (e) {
          console.error(e);
          setErrorMessage("Please allow microphone access!");
      }
  };

  const stopLiveSession = () => {
      isSessionActiveRef.current = false;
      sourceNodesRef.current.forEach(n => { try{n.stop()}catch(e){} });
      sourceNodesRef.current = [];
      processorRef.current?.disconnect();
      processorRef.current = null;
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
      
      try {
          audioContextRef.current?.close();
      } catch(e) {}
      audioContextRef.current = null;
      setHasStarted(false);
  };

  // --- FALLBACK MODE HANDLERS ---
  
  const handleFallbackRecording = async () => {
      if (isRecordingFallback) {
          // Stop Recording
          mediaRecorderRef.current?.stop();
          setIsRecordingFallback(false);
      } else {
          // Start Recording
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              mediaRecorderRef.current = mediaRecorder;
              audioChunksRef.current = [];

              mediaRecorder.ondataavailable = (event) => {
                  if (event.data.size > 0) audioChunksRef.current.push(event.data);
              };

              mediaRecorder.onstop = async () => {
                   setConnectionStatus("Thinking...");
                   setIsUserSpeaking(false);
                   const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                   
                   // 1. STT (Whisper)
                   const text = await transcribeAudio(audioBlob);
                   if (!text.trim()) {
                       setConnectionStatus("Didn't hear that.");
                       return;
                   }

                   // 2. Chat (Gemini)
                   setFallbackHistory(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
                   
                   // Check for special commands in text (simple heuristic for tool call replacement)
                   if (text.toLowerCase().includes('start') && text.length < 50) {
                        const summary = fallbackHistory.map(m => m.text).join('\n') + `\n${text}`;
                        onStoryReadyRef.current(summary);
                        return;
                   }

                   const responseText = await chatWithDirector(fallbackHistory, text, userAge);
                   setFallbackHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: responseText }]);
                   
                   // 3. TTS (Gemini)
                   setIsDirectorSpeaking(true);
                   setConnectionStatus("Director Speaking...");
                   const audioBase64 = await generateNarration(responseText, userAge);
                   
                   // Play response
                   const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
                   audio.onended = () => {
                       setIsDirectorSpeaking(false);
                       setConnectionStatus("Tap mic to reply");
                   };
                   audio.play();

                   // Check if director said "start filming" phrase (simple heuristic)
                   if (responseText.toLowerCase().includes('start filming') || responseText.toLowerCase().includes('magic button')) {
                       setTimeout(() => {
                           onStoryReadyRef.current(fallbackHistory.map(m => m.text).join('\n'));
                       }, 3000);
                   }
              };

              mediaRecorder.start();
              setIsRecordingFallback(true);
              setIsUserSpeaking(true);
              setConnectionStatus("Listening...");
          } catch (e) {
              console.error("Fallback Mic Error", e);
          }
      }
  };

  const drawVisualizer = () => {
      requestAnimationFrame(drawVisualizer);
      if (!canvasRef.current || (!analyserRef.current && !isFallbackMode)) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fallback Visuals (Simple Pulse)
      if (isFallbackMode) {
          ctx.clearRect(0,0, canvas.width, canvas.height);
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          
          if (isRecordingFallback || isDirectorSpeaking) {
             const time = Date.now() / 300;
             const size = 100 + Math.sin(time) * 20;
             ctx.beginPath();
             ctx.arc(cx, cy, size, 0, Math.PI*2);
             ctx.fillStyle = isRecordingFallback ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)';
             ctx.fill();
             
             ctx.beginPath();
             ctx.arc(cx, cy, size * 0.7, 0, Math.PI*2);
             ctx.fillStyle = isRecordingFallback ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
             ctx.fill();
          }
          return;
      }
      
      const bufferLength = analyserRef.current?.frequencyBinCount || 128;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current?.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      let sum = 0;
      for(let i=0; i<bufferLength; i++) sum += dataArray[i];
      const avg = sum / bufferLength;
      const scale = 1 + (avg / 255) * 1.5;

      const gradient = ctx.createRadialGradient(cx, cy, 50 * scale, cx, cy, 200 * scale);
      
      if (isDirectorSpeaking) {
          gradient.addColorStop(0, theme.id === 'neon_city' ? '#d946ef' : '#6366f1'); 
          gradient.addColorStop(1, 'transparent');
      } else if (isUserSpeaking) {
          gradient.addColorStop(0, '#22c55e'); 
          gradient.addColorStop(1, 'transparent');
      } else {
          gradient.addColorStop(0, '#eab308'); 
          gradient.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 150 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 100 * scale, 0, Math.PI * 2);
      ctx.stroke();
  };

  const handleToggleMode = () => {
    if (isPro || veoTrials > 0) {
        setIsMovieMode(!isMovieMode);
    } else {
        onOpenSubscription();
    }
  };

  const handleRandomStory = () => {
      const stories = [
          "A brave toaster who goes to Mars to find the perfect bread.",
          "A penguin who discovers he can fly if he sings opera.",
          "A detective octopus solving the mystery of the missing pearl.",
          "A friendship between a cloud and a cactus in the desert.",
          "A video game character who jumps out of the screen into the real world.",
          "A speedy snail participating in the garden Olympics."
      ];
      const random = stories[Math.floor(Math.random() * stories.length)];
      stopLiveSession();
      // Use the ref here too for consistency, though not strictly required as this handler is recreated
      onStoryReadyRef.current(random);
  };

  return (
    <div className={`flex flex-col h-full ${theme.panelBg} rounded-3xl overflow-hidden border ${theme.panelBorder} relative`}>
      
      {/* Header */}
      <div className={`absolute top-0 left-0 w-full p-6 flex items-start justify-between z-20`}>
        <div className="flex items-center gap-3 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <div className={`w-3 h-3 rounded-full ${isDirectorSpeaking ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <p className="text-sm font-bold text-white/80">{connectionStatus}</p>
        </div>
        
        {/* LARGE TOGGLE SWITCH */}
        <div className="flex flex-col items-end gap-2">
            <div 
                onClick={handleToggleMode}
                className="flex items-center gap-3 bg-black/60 p-3 pl-5 rounded-full backdrop-blur-md border border-white/20 cursor-pointer hover:bg-black/70 transition-all shadow-2xl group scale-110 origin-right"
            >
                <span className={`text-sm font-bold uppercase tracking-wider ${!isMovieMode ? 'text-white' : 'text-white/40'}`}>
                    Classic
                </span>
                
                {/* The Switch Track */}
                <div className={`w-24 h-12 rounded-full p-1.5 transition-all duration-300 relative ${isMovieMode ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'bg-white/10 shadow-inner'}`}>
                    {/* The Knob */}
                    <div className={`w-9 h-9 bg-white rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center transform ${isMovieMode ? 'translate-x-12' : 'translate-x-0'}`}>
                        {isMovieMode ? <Video size={20} className="text-orange-500" /> : <BookOpen size={20} className="text-gray-500" />}
                    </div>
                </div>

                <span className={`text-sm font-bold uppercase tracking-wider ${isMovieMode ? 'text-yellow-400' : 'text-white/40'}`}>
                    AI Video
                </span>
            </div>

            {/* Trial Status Badge */}
            <div className="mr-2">
                {isPro ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full border border-yellow-400/20">
                        <Crown size={10} /> PRO ACTIVE
                    </span>
                ) : (
                   <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${veoTrials > 0 ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>
                       {veoTrials > 0 ? `${veoTrials} FREE VIDEOS` : '0 FREE LEFT'}
                   </span>
                )}
            </div>
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/20">
          <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-cover" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 pointer-events-none">
              <div className="text-center px-6 transition-all duration-300 transform">
                   <h2 className="text-4xl font-black text-white drop-shadow-2xl mb-4 tracking-tight">
                       {isDirectorSpeaking 
                          ? (userAge < 8 ? "Listen..." : "Director is Speaking") 
                          : (isUserSpeaking ? "Hearing you..." : "Go ahead, say something!")}
                   </h2>
                   <p className="text-white/60 text-lg animate-pulse">
                       {isDirectorSpeaking ? "" : (userAge < 8 ? "Tell me a story!" : "Describe your movie idea...")}
                   </p>
              </div>
          </div>

          {/* FALLBACK MANUAL MIC BUTTON */}
          {isFallbackMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                  <button 
                    onClick={handleFallbackRecording}
                    className={`flex flex-col items-center gap-4 p-8 rounded-full transition-all border-4 cursor-pointer shadow-2xl ${
                        isRecordingFallback 
                        ? 'bg-red-500/20 border-red-500 animate-pulse scale-110' 
                        : 'bg-white/10 hover:bg-white/20 border-white/30 hover:scale-105'
                    }`}
                  >
                      <Mic size={56} className={isRecordingFallback ? 'text-red-500' : 'text-white'} />
                      <span className="font-bold text-lg">
                          {isRecordingFallback ? "Stop Recording" : "Tap to Speak"}
                      </span>
                  </button>
                  
                  <div className="absolute bottom-20 text-white/50 text-sm flex items-center gap-2">
                       <AlertTriangle size={14} className="text-yellow-500" />
                       Running in Basic Mode (Live API unavailable)
                  </div>
              </div>
          )}

          {errorMessage && !isFallbackMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                  <button 
                    onClick={startLiveSession}
                    className="flex flex-col items-center gap-4 bg-white/10 p-8 rounded-full hover:bg-white/20 transition-all border-2 border-red-500 animate-pulse cursor-pointer"
                  >
                      <Mic size={48} className="text-red-500" />
                      <span className="font-bold">Tap to Retry</span>
                  </button>
              </div>
          )}
          
          {/* Random Story Button (Testing) */}
          <button
              onClick={handleRandomStory}
              className="absolute bottom-6 right-6 bg-white/10 hover:bg-white/20 p-4 rounded-full backdrop-blur-md border border-white/10 transition-all z-30 group pointer-events-auto shadow-xl"
              title="Random Story (Fast Forward)"
          >
              <Dice5 className="text-white/70 group-hover:text-yellow-400 group-hover:rotate-180 transition-all duration-500" size={24} />
          </button>
      </div>

    </div>
  );
};
