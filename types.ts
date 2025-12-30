
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioUrl?: string; // For TTS playback
  isAudio?: boolean; // If the user input was audio
}

export interface Scene {
  id: number;
  narrative: string; // The story text read aloud
  visualDescription: string; // The prompt for the image
  imageUrl?: string;
  videoUrl?: string; // For Veo generated videos
  audioUrl?: string;
  duration?: number; // Estimated duration in seconds
  isVideo?: boolean;
  sfxUrl?: string; // Sound effect for this scene
}

export interface Script {
  title: string;
  characters: string[];
  scenes: Scene[];
  targetAge?: number;
  isMovieMode?: boolean; // New flag for video mode
}

export enum AppState {
  HOME = 'HOME',
  AGE_INPUT = 'AGE_INPUT',
  SCENE_SELECTION = 'SCENE_SELECTION', // Selection for 10+
  BRAINSTORM = 'BRAINSTORM', // Chatting with the "Director"
  PRODUCING = 'PRODUCING',   // Generating assets
  PLAYING = 'PLAYING',       // Watching the cartoon
  SHOP = 'SHOP',             // Buying UI themes
}

export type GenerationProgress = {
  status: 'scripting' | 'visuals' | 'audio' | 'ready';
  currentScene: number;
  totalScenes: number;
  message: string;
};

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = '1K' | '2K' | '4K';

export interface Theme {
  id: string;
  name: string;
  cost: number;
  description: string;
  // CSS Classes
  mainGradient: string;
  panelBg: string;
  panelBorder: string;
  buttonPrimary: string;
  buttonSecondary: string;
  textAccent: string;
  bubbleColor: string;
}

export interface VoiceSkin {
  id: string; // The API voice name (Puck, Kore, etc.)
  name: string; // Display name
  cost: number;
  description: string;
  gender: 'Male' | 'Female';
  tone: string;
}
