
import React, { useState } from 'react';
import { Theme, VoiceSkin } from '../types';
import { THEMES, VOICE_SKINS } from '../constants';
import { ShoppingBag, Check, Lock, ArrowLeft, Palette, Mic } from 'lucide-react';

interface ShopProps {
  currentTheme: Theme;
  ownedThemes: string[];
  currentVoiceId: string;
  ownedVoices: string[];
  wallet: number;
  onBuyTheme: (themeId: string, cost: number) => void;
  onSelectTheme: (themeId: string) => void;
  onBuyVoice: (voiceId: string, cost: number) => void;
  onSelectVoice: (voiceId: string) => void;
  onClose: () => void;
}

export const Shop: React.FC<ShopProps> = ({ 
  currentTheme, 
  ownedThemes, 
  currentVoiceId,
  ownedVoices,
  wallet, 
  onBuyTheme, 
  onSelectTheme,
  onBuyVoice,
  onSelectVoice,
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'voices'>('themes');

  return (
    <div className="flex flex-col h-full relative z-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft />
            </button>
            <h2 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500">
              Studio Shop
            </h2>
        </div>
        <div className="bg-black/40 px-6 py-2 rounded-full border border-yellow-500/30 flex items-center gap-2">
           <span className="text-2xl">🪙</span>
           <span className="text-xl font-bold text-yellow-400 tabular-nums">{wallet}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 p-4 border-b border-white/5">
        <button 
            onClick={() => setActiveTab('themes')}
            className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeTab === 'themes' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white/50'}`}
        >
            <Palette size={20} />
            Studio Themes
        </button>
        <button 
            onClick={() => setActiveTab('voices')}
            className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${activeTab === 'voices' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 text-white/50'}`}
        >
            <Mic size={20} />
            Director Voices
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {/* THEMES TAB */}
        {activeTab === 'themes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {THEMES.map((theme) => {
                const isOwned = ownedThemes.includes(theme.id);
                const isActive = currentTheme.id === theme.id;
                const canAfford = wallet >= theme.cost;

                return (
                <div 
                    key={theme.id}
                    className={`relative rounded-3xl overflow-hidden border-2 transition-all duration-300 group ${
                        isActive ? 'border-yellow-400 scale-105 shadow-[0_0_30px_rgba(250,204,21,0.3)]' : 'border-white/10 hover:border-white/30'
                    }`}
                >
                    {/* Preview */}
                    <div className={`h-32 bg-gradient-to-br ${theme.mainGradient} p-4 flex items-center justify-center relative`}>
                        <div className={`w-3/4 h-16 ${theme.panelBg} rounded-xl border ${theme.panelBorder} shadow-lg flex items-center gap-2 px-4`}>
                            <div className={`w-8 h-8 rounded-full ${theme.buttonPrimary}`} />
                            <div className="h-2 w-20 bg-white/20 rounded-full" />
                        </div>
                        {isActive && (
                            <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <Check size={12} /> EQUIPPED
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="p-6 bg-black/40 backdrop-blur-md">
                    <h3 className="text-xl font-bold mb-1">{theme.name}</h3>
                    <p className="text-sm text-white/50 mb-6 h-10">{theme.description}</p>
                    
                    {isOwned ? (
                        <button 
                            onClick={() => onSelectTheme(theme.id)}
                            disabled={isActive}
                            className={`w-full py-3 rounded-xl font-bold transition-all ${
                                isActive 
                                ? 'bg-white/5 text-white/30 cursor-default' 
                                : 'bg-white text-black hover:bg-gray-200'
                            }`}
                        >
                            {isActive ? 'Active' : 'Select Theme'}
                        </button>
                    ) : (
                        <button 
                            onClick={() => onBuyTheme(theme.id, theme.cost)}
                            disabled={!canAfford}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                canAfford 
                                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg hover:shadow-yellow-500/20' 
                                : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }`}
                        >
                            {canAfford ? (
                                <>Buy for {theme.cost} 🪙</>
                            ) : (
                                <><Lock size={16} /> Need {theme.cost} 🪙</>
                            )}
                        </button>
                    )}
                    </div>
                </div>
                );
            })}
            </div>
        )}

        {/* VOICES TAB */}
        {activeTab === 'voices' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {VOICE_SKINS.map((voice) => {
                 const isOwned = ownedVoices.includes(voice.id);
                 const isActive = currentVoiceId === voice.id;
                 const canAfford = wallet >= voice.cost;
 
                 return (
                 <div 
                     key={voice.id}
                     className={`relative rounded-3xl overflow-hidden border-2 transition-all duration-300 group bg-white/5 ${
                         isActive ? 'border-pink-400 scale-105 shadow-[0_0_30px_rgba(244,114,182,0.3)]' : 'border-white/10 hover:border-white/30'
                     }`}
                 >
                     {/* Preview Graphic */}
                     <div className="h-24 bg-gradient-to-r from-purple-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
                         <div className="absolute inset-0 opacity-30 flex items-center justify-center gap-1">
                            {[1,2,3,4,5,4,3,2,1].map((h, i) => (
                                <div key={i} className="w-2 bg-white rounded-full animate-pulse" style={{height: `${h * 10}%`, animationDelay: `${i*0.1}s`}}></div>
                            ))}
                         </div>
                         <Mic size={40} className={`relative z-10 ${isActive ? 'text-pink-400' : 'text-white/50'}`} />
                         
                         {isActive && (
                             <div className="absolute top-2 right-2 bg-pink-400 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                 <Check size={12} /> ACTIVE
                             </div>
                         )}
                     </div>
 
                     {/* Info */}
                     <div className="p-6 bg-black/40 backdrop-blur-md">
                        <div className="flex justify-between items-start mb-2">
                             <h3 className="text-xl font-bold">{voice.name}</h3>
                             <span className="text-[10px] uppercase font-bold bg-white/10 px-2 py-1 rounded text-white/60">{voice.tone}</span>
                        </div>
                        <p className="text-sm text-white/50 mb-6 h-10">{voice.description}</p>
                     
                     {isOwned ? (
                         <button 
                             onClick={() => onSelectVoice(voice.id)}
                             disabled={isActive}
                             className={`w-full py-3 rounded-xl font-bold transition-all ${
                                 isActive 
                                 ? 'bg-white/5 text-white/30 cursor-default' 
                                 : 'bg-white text-black hover:bg-gray-200'
                             }`}
                         >
                             {isActive ? 'Active' : 'Select Voice'}
                         </button>
                     ) : (
                         <button 
                             onClick={() => onBuyVoice(voice.id, voice.cost)}
                             disabled={!canAfford}
                             className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                 canAfford 
                                 ? 'bg-pink-500 hover:bg-pink-400 text-black shadow-lg hover:shadow-pink-500/20' 
                                 : 'bg-white/5 text-white/30 cursor-not-allowed'
                             }`}
                         >
                             {canAfford ? (
                                 <>Hire for {voice.cost} 🪙</>
                             ) : (
                                 <><Lock size={16} /> Need {voice.cost} 🪙</>
                             )}
                         </button>
                     )}
                     </div>
                 </div>
                 );
             })}
             </div>
        )}

      </div>
    </div>
  );
};
