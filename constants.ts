
import { Theme, VoiceSkin } from "./types";

// Standard "Brainstorm" prompt for text fallback
export const GET_SYSTEM_INSTRUCTION_BRAINSTORM = (age: number) => `
You are "Director Spark", a high-energy, friendly cartoon director. The user is a ${age}-year-old kid.
Your goal: Collaborate to invent a short, fun story for a cartoon.

**PERSONALITY:**
- Tone: Exciting, encouraging, simple words.
- Sound: Use short sentences. Be enthusiastic!
- Magic Word: You have a magic button called "startFilming".

**RULES:**
1. Ask 1 simple question at a time (e.g., "Is the hero a cat or a dog?", "Where do they live?").
2. Keep the conversation fast. Don't ramble.
3. **CRITICAL:** When you have 3 key details (Hero, Setting, Problem) OR if the user says "Start", "I'm done", "Action", or "Ready":
   - **DO NOT** ask more questions.
   - Say a very short wrap-up phrase like "Awesome! Let's make this movie!"
   - **IMMEDIATELY CALL THE FUNCTION \`startFilming\`** with the story summary.
`;

// --- NEW LIVE API PERSONAS ---

const PERSONA_BUBBLES = `
You are "Bubbles", a silly, giggly cartoon director for little kids (ages 5-7).
**CRITICAL INSTRUCTION:** YOU MUST SPEAK FIRST. Say "Hi! I'm Bubbles! What do you want to make?" as soon as the connection starts.
- Voice: High energy, uses simple words, lots of "Wow!" and "Cool!".
- Goal: Help the kid make a story.
- Strategy: Ask VERY simple questions like "Is it a cat or a dog?" or "Is it pink or blue?".
- IMPORTANT: Keep responses extremely short (1 sentence). 
- If the kid stops talking, ask "Are you there?" or "What's next?".
- When you have a Character, a Place, and a Fun Thing they do, say "Let's make it!" and CALL THE TOOL [startFilming].
`;

const PERSONA_SPARK = `
You are "Director Spark", an adventurous movie director for kids (ages 8-10).
**CRITICAL INSTRUCTION:** YOU MUST SPEAK FIRST. Say "Lights, Camera, Action! I'm Director Spark. What are we filming?" as soon as the connection starts.
- Voice: Enthusiastic, like an action hero.
- Goal: Create an awesome cartoon story.
- Strategy: Ask fun "Would you rather" questions to build the plot.
- Keep responses short (1-2 sentences). Fast paced.
- When the story has a Hero, a Villain, and a Setting, say "Rolling camera!" and CALL THE TOOL [startFilming].
`;

const PERSONA_ACE = `
You are "Ace", a professional but cool Hollywood director for older kids (ages 11-13).
**CRITICAL INSTRUCTION:** YOU MUST SPEAK FIRST. Say "Welcome to the studio. I'm Ace. What's your pitch?" as soon as the connection starts.
- Voice: Confident, uses some movie terms like "Scene", "Action", "Plot twist".
- Goal: Create a cinematic masterpiece.
- Strategy: Ask about the genre, the conflict, and the climax.
- Keep it conversational but focused.
- When the plot is solid, say "That's a wrap on the writing room!" and CALL THE TOOL [startFilming].
`;

export const GET_LIVE_SYSTEM_INSTRUCTION = (age: number) => {
    if (age < 8) return PERSONA_BUBBLES;
    if (age < 11) return PERSONA_SPARK;
    return PERSONA_ACE;
};

export const GET_SYSTEM_INSTRUCTION_SCRIPT = (age: number, isMovieMode: boolean = false, sceneCount: number = 6) => `
You are a professional screenwriter for children's cartoons targeting ${age}-year-olds.
Output a JSON object ONLY. 
Structure the story into exactly ${sceneCount} distinct scenes.
${isMovieMode ? 'Since this is a movie, keep visual descriptions SHORT and PUNCHY (under 15 words) for video generation. Ensure consistent character details (e.g. "blue cat in red hat") in every scene.' : ''}
- For age ${age}, ensure the vocabulary and themes are appropriate.
Each scene must have:
- narrative: The exact text the narrator will speak (1-2 sentences max).
- visualDescription: A detailed, vivid description for the image generator. ALWAYS repeat the main character's physical details (e.g., "The blue robot with red eyes") to ensure consistency.
`;

export const MUSIC_TRACKS = [
  { name: 'Silence 😶', url: '' },
  { name: 'Happy Day ☀️', url: 'https://assets.mixkit.co/music/preview/mixkit-happy-day-526.mp3' },
  { name: 'Playful Fun 🍭', url: 'https://assets.mixkit.co/music/preview/mixkit-funny-and-playful-childhood-music-592.mp3' },
  { name: 'Epic Adventure ⚔️', url: 'https://assets.mixkit.co/music/preview/mixkit-epic-hero-journey-theme-music-2487.mp3' },
  { name: 'Dreamy Stars 🌙', url: 'https://assets.mixkit.co/music/preview/mixkit-dreamy-lullaby-and-piano-background-539.mp3' },
  { name: 'Action Hero ⚡', url: 'https://assets.mixkit.co/music/preview/mixkit-energetic-hero-adventure-theme-2484.mp3' },
  { name: 'Secret Mission 🔍', url: 'https://assets.mixkit.co/music/preview/mixkit-suspenseful-mystery-and-thriller-track-1262.mp3' },
  { name: 'Space Disco 🚀', url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' }
];

export const SOUND_EFFECTS = [
  { name: 'No Sound 🔇', url: '' },
  { name: 'Magic ✨', url: 'https://assets.mixkit.co/sfx/preview/mixkit-fairy-dust-sparkle-861.mp3' },
  { name: 'Laugh 😂', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-laugh-voice-2838.mp3' },
  { name: 'Boing 🦘', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-boing-2832.mp3' },
  { name: 'Cheer 🎉', url: 'https://assets.mixkit.co/sfx/preview/mixkit-animated-small-group-applause-523.mp3' },
  { name: 'Pop 🎈', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-pop-sound-2868.mp3' },
  { name: 'Swoosh 💨', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-fast-swoosh-2882.mp3' },
  { name: 'Tada! 🎺', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-musical-surprise-2877.mp3' },
  { name: 'Bonk 🔨', url: 'https://assets.mixkit.co/sfx/preview/mixkit-cartoon-funny-bonk-2875.mp3' }
];

export const THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Classic Studio',
    cost: 0,
    description: 'The standard ToonCraft studio look.',
    mainGradient: 'from-slate-900 via-indigo-950 to-slate-900',
    panelBg: 'bg-white/5',
    panelBorder: 'border-white/10',
    buttonPrimary: 'bg-indigo-600 hover:bg-indigo-500',
    buttonSecondary: 'bg-white/10 hover:bg-white/20',
    textAccent: 'text-indigo-400',
    bubbleColor: 'bg-indigo-600'
  },
  {
    id: 'neon_city',
    name: 'Neon City',
    cost: 1500,
    description: 'Electric vibes for night owls.',
    mainGradient: 'from-black via-slate-900 to-fuchsia-900',
    panelBg: 'bg-black/80',
    panelBorder: 'border-fuchsia-500/50',
    buttonPrimary: 'bg-fuchsia-600 hover:bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)]',
    buttonSecondary: 'bg-cyan-800 hover:bg-cyan-700',
    textAccent: 'text-cyan-400',
    bubbleColor: 'bg-fuchsia-600'
  },
  {
    id: 'candy_cloud',
    name: 'Candy Cloud',
    cost: 2500,
    description: 'Sweet, sugary, and full of dreams.',
    mainGradient: 'from-pink-200 via-purple-100 to-sky-200',
    panelBg: 'bg-white/60',
    panelBorder: 'border-pink-300',
    buttonPrimary: 'bg-pink-400 hover:bg-pink-300',
    buttonSecondary: 'bg-sky-400 hover:bg-sky-300',
    textAccent: 'text-pink-600',
    bubbleColor: 'bg-pink-400'
  },
  {
    id: 'ocean_deep',
    name: 'Ocean Deep',
    cost: 3000,
    description: 'Dive into the mysterious blue.',
    mainGradient: 'from-cyan-900 via-blue-900 to-indigo-950',
    panelBg: 'bg-blue-900/40',
    panelBorder: 'border-cyan-500/30',
    buttonPrimary: 'bg-cyan-600 hover:bg-cyan-500',
    buttonSecondary: 'bg-blue-800 hover:bg-blue-700',
    textAccent: 'text-cyan-300',
    bubbleColor: 'bg-cyan-600'
  },
  {
    id: 'jungle_safari',
    name: 'Jungle Safari',
    cost: 3500,
    description: 'Wild adventures in the green.',
    mainGradient: 'from-green-900 via-emerald-800 to-yellow-900',
    panelBg: 'bg-green-950/60',
    panelBorder: 'border-green-400/30',
    buttonPrimary: 'bg-green-600 hover:bg-green-500',
    buttonSecondary: 'bg-yellow-800 hover:bg-yellow-700',
    textAccent: 'text-green-400',
    bubbleColor: 'bg-green-600'
  },
  {
    id: 'space_station',
    name: 'Space Station',
    cost: 4000,
    description: 'Orbit the earth in high tech style.',
    mainGradient: 'from-gray-900 via-slate-800 to-black',
    panelBg: 'bg-slate-800/80',
    panelBorder: 'border-white/20',
    buttonPrimary: 'bg-white text-black hover:bg-gray-200',
    buttonSecondary: 'bg-slate-700 hover:bg-slate-600',
    textAccent: 'text-white',
    bubbleColor: 'bg-slate-500'
  },
  {
    id: 'royal_castle',
    name: 'Royal Castle',
    cost: 5000,
    description: 'For kings, queens, and knights.',
    mainGradient: 'from-purple-900 via-fuchsia-900 to-yellow-700',
    panelBg: 'bg-purple-950/70',
    panelBorder: 'border-yellow-400/50',
    buttonPrimary: 'bg-yellow-500 hover:bg-yellow-400 text-black',
    buttonSecondary: 'bg-purple-800 hover:bg-purple-700',
    textAccent: 'text-yellow-400',
    bubbleColor: 'bg-yellow-500'
  },
  {
    id: 'volcano_magma',
    name: 'Volcano Magma',
    cost: 5500,
    description: 'Hot! Hot! Hot!',
    mainGradient: 'from-red-900 via-orange-900 to-yellow-900',
    panelBg: 'bg-red-950/60',
    panelBorder: 'border-orange-500',
    buttonPrimary: 'bg-orange-600 hover:bg-orange-500',
    buttonSecondary: 'bg-red-800 hover:bg-red-700',
    textAccent: 'text-orange-400',
    bubbleColor: 'bg-orange-600'
  },
  {
    id: 'ice_palace',
    name: 'Ice Palace',
    cost: 6000,
    description: 'Frozen fractals all around.',
    mainGradient: 'from-cyan-100 via-blue-200 to-white',
    panelBg: 'bg-white/40',
    panelBorder: 'border-cyan-200',
    buttonPrimary: 'bg-cyan-400 hover:bg-cyan-300 text-black',
    buttonSecondary: 'bg-blue-200 hover:bg-blue-100 text-black',
    textAccent: 'text-cyan-700',
    bubbleColor: 'bg-cyan-400'
  },
  {
    id: 'pixel_retro',
    name: 'Pixel Retro',
    cost: 7000,
    description: '8-bit gaming nostalgia.',
    mainGradient: 'from-green-900 via-black to-green-900',
    panelBg: 'bg-black/90',
    panelBorder: 'border-green-500 dashed',
    buttonPrimary: 'bg-green-500 hover:bg-green-400 text-black font-mono',
    buttonSecondary: 'bg-green-900 hover:bg-green-800 font-mono',
    textAccent: 'text-green-500 font-mono',
    bubbleColor: 'bg-green-600'
  },
  {
    id: 'pirate_ship',
    name: 'Pirate Ship',
    cost: 7500,
    description: 'Yarrr! Sail the seven seas.',
    mainGradient: 'from-amber-900 via-yellow-900 to-black',
    panelBg: 'bg-amber-950/80',
    panelBorder: 'border-amber-600/50',
    buttonPrimary: 'bg-amber-600 hover:bg-amber-500',
    buttonSecondary: 'bg-black/50 hover:bg-black/70',
    textAccent: 'text-amber-400',
    bubbleColor: 'bg-amber-700'
  },
  {
    id: 'superhero_hq',
    name: 'Superhero HQ',
    cost: 8000,
    description: 'Save the day in style.',
    mainGradient: 'from-blue-900 via-red-900 to-yellow-900',
    panelBg: 'bg-slate-900/90',
    panelBorder: 'border-yellow-500',
    buttonPrimary: 'bg-red-600 hover:bg-red-500',
    buttonSecondary: 'bg-blue-700 hover:bg-blue-600',
    textAccent: 'text-yellow-400',
    bubbleColor: 'bg-blue-600'
  },
  {
    id: 'secret_spy',
    name: 'Secret Spy',
    cost: 10000,
    description: 'Top secret blueprint mode.',
    mainGradient: 'from-blue-950 via-slate-950 to-black',
    panelBg: 'bg-blue-950/90',
    panelBorder: 'border-blue-400/20',
    buttonPrimary: 'bg-blue-600/50 hover:bg-blue-500/50 border border-blue-400',
    buttonSecondary: 'bg-black hover:bg-slate-900',
    textAccent: 'text-blue-400 font-mono',
    bubbleColor: 'bg-blue-900'
  }
];

export const VOICE_SKINS: VoiceSkin[] = [
  {
    id: 'Kore',
    name: 'Director Kore (Standard)',
    cost: 0,
    description: 'A balanced, friendly voice. Perfect for any story.',
    gender: 'Female',
    tone: 'Warm'
  },
  {
    id: 'Puck',
    name: 'Director Puck',
    cost: 4000,
    description: 'Energetic, playful, and mischievous. Great for comedy!',
    gender: 'Male',
    tone: 'Playful'
  },
  {
    id: 'Charon',
    name: 'Director Charon',
    cost: 6000,
    description: 'Deep, resonant, and serious. Ideal for epic adventures.',
    gender: 'Male',
    tone: 'Deep'
  },
  {
    id: 'Fenrir',
    name: 'Director Fenrir',
    cost: 8000,
    description: 'Intense, strong, and commanding. For action movies!',
    gender: 'Male',
    tone: 'Intense'
  },
  {
    id: 'Zephyr',
    name: 'Director Zephyr',
    cost: 5000,
    description: 'Calm, soothing, and gentle. Perfect for fairytales.',
    gender: 'Female',
    tone: 'Calm'
  }
];
