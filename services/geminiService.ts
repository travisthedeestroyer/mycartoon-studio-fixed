
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Message, Script, AspectRatio, ImageSize } from "../types";
import { GET_SYSTEM_INSTRUCTION_BRAINSTORM, GET_SYSTEM_INSTRUCTION_SCRIPT } from "../constants";
import { pcmToWav } from "../utils/audio";

// --- CONFIGURATION ---

// Fallback key provided by user for reliable operation
// Note: Set HUGGINGFACE_API_KEY environment variable for Hugging Face fallbacks
const DEFAULT_HF_TOKEN = process.env.HUGGINGFACE_API_KEY || '';

// API Key Pool for rotation - loaded from environment variables
// Supports both Vite's import.meta.env and process.env fallbacks
const API_KEY_POOL = [
    import.meta.env?.VITE_GEMINI_API_KEY_1 || process.env.VITE_GEMINI_API_KEY_1,
    import.meta.env?.VITE_GEMINI_API_KEY_2 || process.env.VITE_GEMINI_API_KEY_2,
    import.meta.env?.VITE_GEMINI_API_KEY_3 || process.env.VITE_GEMINI_API_KEY_3,
    import.meta.env?.VITE_GEMINI_API_KEY_4 || process.env.VITE_GEMINI_API_KEY_4,
    import.meta.env?.VITE_GEMINI_API_KEY_5 || process.env.VITE_GEMINI_API_KEY_5
].filter(Boolean);

let currentKeyIndex = 0;

// Get current API key with rotation support
const getCurrentApiKey = (): string => {
    // Try environment key first (from define in vite.config.ts or direct process.env)
    const primaryKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (primaryKey) return primaryKey;
    
    // Otherwise use key pool
    if (API_KEY_POOL.length > 0) {
        return API_KEY_POOL[currentKeyIndex % API_KEY_POOL.length];
    }
    
    return '';
};

// Rotate to next API key
const rotateApiKey = () => {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEY_POOL.length;
    console.log(`Rotated to API key ${currentKeyIndex + 1}/${API_KEY_POOL.length}`);
};

const MODEL_CONFIG = {
    // Scripts: Try standard flash, then new flash, then pro
    script: [
        'gemini-2.5-flash', 
        'gemini-3-flash-preview', 
        'gemini-3-pro-preview'
    ],
    // Images: Try NanoBanana (Flash Image), then Pro Image, then Imagen 4
    image: [
        'gemini-2.5-flash-image', 
        'gemini-3-pro-image-preview'
    ],
    // Fallback specifically for image if Gemini family fails
    imagen: 'imagen-4.0-generate-001',
    // Video: Fallback chain: Fast Veo -> Veo 3.1 -> Veo 3.0 -> HF (Wan, LTX, SVD)
    video: [
        'veo-3.1-fast-generate-preview', 
        'veo-3.1-generate-preview',
        'veo-3.0-generate-preview',
        'veo-3.0-generate-001',
        'hf:lightx2v/Wan2.2-Distill-Loras',
        'hf:Wan-AI/Wan2.2-I2V-A14B',
        'hf:Lightricks/LTX-Video',
        'hf:stabilityai/stable-video-diffusion-img2vid-xt-1-1'
    ],
    // TTS: Currently only one specialized model
    tts: ['gemini-2.5-flash-preview-tts'],
    // STT Fallback
    stt: 'openai/whisper-large-v3'
};

// Clients
export const getAiClient = () => {
  const apiKey = getCurrentApiKey();
  if (!apiKey) {
      console.warn("API_KEY is missing from environment and key pool is empty.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const getLiveClient = getAiClient;

// Utility to pause execution, with AbortSignal support
const wait = (ms: number, signal?: AbortSignal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
    });
});

// Helper to clean JSON string from Markdown
const cleanJson = (text: string): string => {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(json)?/, '').replace(/```$/, '');
  }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  return clean.trim();
};

const getMimeType = (base64: string): string => {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64.startsWith('UklGR')) return 'image/webp';
    return 'image/jpeg';
};

// --- CORE SERVICES ---

/**
 * Basic retry logic for a single operation.
 */
async function retry<T>(operation: () => Promise<T>, retries = 2, delay = 1000, signal?: AbortSignal): Promise<T> {
  try {
    if (signal?.aborted) throw new Error("Aborted");
    return await operation();
  } catch (error: any) {
    if (error.message === "Aborted") throw error; // Don't retry if aborted

    const errorMsg = error?.message || JSON.stringify(error);
    const status = error?.status || 0;
    
    const isRateLimit = errorMsg.includes('429') || status === 429 || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    const isServerOverload = errorMsg.includes('503') || status === 503;
    const isInternalError = errorMsg.includes('500') || status === 500;
    
    // Rotate API key on rate limit
    if (isRateLimit) {
      rotateApiKey();
    }
    
    // Retry on transient errors
    if (retries > 0 && (isRateLimit || isServerOverload || isInternalError)) {
      await wait(delay, signal); 
      return retry(operation, retries - 1, delay * 2, signal); 
    }
    throw error;
  }
}

/**
 * Executes an operation with a list of fallback models.
 * It iterates through `models`. If one fails, it tries the next.
 */
async function withModelFallbacks<T>(
    models: string[], 
    operation: (model: string) => Promise<T>, 
    category: string,
    signal?: AbortSignal
): Promise<T> {
    let lastError: any;
    
    for (const model of models) {
        if (signal?.aborted) throw new Error("Aborted");
        try {
            // We use a small internal retry (handled by `retry` wrapper inside operation or here)
            // for the specific model before giving up and switching.
            return await retry(() => operation(model), 1, 1000, signal);
        } catch (error: any) {
            if (error.message === "Aborted") throw error;

            console.warn(`⚠️ [${category}] Model '${model}' failed:`, error.message || error);
            lastError = error;
            // If it's a critical auth error or bad request (400), don't fallback, just fail.
            if (error.status === 400 || (error.message && error.message.includes('API key'))) {
                throw error;
            }
            // Otherwise (429, 500, safety), continue to next model
            continue;
        }
    }
    throw lastError || new Error(`${category} generation failed on all models.`);
}

/**
 * Generates narration audio (WAV base64).
 */
export const generateNarration = async (text: string, age: number, signal?: AbortSignal): Promise<string> => {
    // TTS doesn't have multiple models yet, so we just use the first one.
    return retry(async () => {
        const ai = getAiClient();
        const ttsText = age < 8 ? `Speak cheerfully: ${text}` : text;
        const response = await ai.models.generateContent({
            model: MODEL_CONFIG.tts[0],
            contents: [{ parts: [{ text: ttsText }] }],
            config: {
                responseModalities: [Modality.AUDIO], 
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });
        const rawPcm = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (rawPcm) return pcmToWav(rawPcm);
        throw new Error("No audio returned");
    }, 2, 2000, signal);
};

/**
 * Generates structured script using Gemini with Fallbacks.
 */
export const generateScript = async (storyContext: string, age: number, isMovieMode: boolean, sceneCount: number, signal?: AbortSignal): Promise<Script> => {
    return withModelFallbacks(MODEL_CONFIG.script, async (model) => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: model,
            contents: `Context: ${storyContext}`,
            config: {
                systemInstruction: GET_SYSTEM_INSTRUCTION_SCRIPT(age, isMovieMode, sceneCount) + 
                "\nCRITICAL: Output valid JSON only. No markdown formatting. The root object must contain a 'scenes' array.",
                responseMimeType: "application/json"
            }
        });

        if (!response.text) throw new Error("Empty response");

        let jsonStr = cleanJson(response.text);
        const parsed = JSON.parse(jsonStr);
        let finalScript = parsed;
        
        if (!finalScript.scenes && finalScript.script && Array.isArray(finalScript.script.scenes)) {
            finalScript = finalScript.script;
        } else if (!finalScript.scenes && finalScript.story && Array.isArray(finalScript.story.scenes)) {
                finalScript = { ...finalScript, scenes: finalScript.story.scenes };
        }

        if (!Array.isArray(finalScript.scenes) || finalScript.scenes.length === 0) {
            throw new Error("Missing scenes");
        }
        return finalScript as Script;
    }, "Script", signal);
};

/**
 * Generates a consistent scene image.
 * Tries Gemini Image models first, falls back to Imagen.
 */
export const generateSceneImage = async (prompt: string, age: number, previousImageBase64?: string, isRetry = false, signal?: AbortSignal): Promise<string> => {
    if (signal?.aborted) throw new Error("Aborted");
    
    const styleSuffix = age < 8 
        ? "cartoon style, 3d render, cute, bright colors, chunky shapes, kid friendly, G-rated"
        : "cartoon style, cinematic, detailed textures, vibrant, dynamic composition, G-rated";

    const finalPrompt = isRetry 
        ? `A cute safe cartoon scene: ${prompt}` 
        : `Create a scene: ${prompt}. Style: ${styleSuffix}`;

    try {
        // 1. Try Gemini Family (supports Multimodal/Consistency)
        return await withModelFallbacks(MODEL_CONFIG.image, async (model) => {
             const ai = getAiClient();
             const parts: any[] = [];
             
             // Add reference image if available
             if (previousImageBase64 && !isRetry) {
                 parts.push({ inlineData: { data: previousImageBase64, mimeType: 'image/png' } });
                 parts.push({ text: "Use this previous scene as a reference. Maintain character design." });
             }
             parts.push({ text: finalPrompt });

             // Handle specific config for Pro model vs Flash
             const config: any = {};
             if (model.includes('pro')) {
                 config.imageConfig = { imageSize: '2K', aspectRatio: '16:9' };
             }

             const response = await ai.models.generateContent({
                 model,
                 contents: { parts },
                 config
             });

             const candidate = response.candidates?.[0];
             if (candidate?.finishReason === 'SAFETY') throw new Error("Safety block");

             const resultParts = candidate?.content?.parts;
             if (resultParts) {
                 for (const part of resultParts) {
                     if (part.inlineData) return part.inlineData.data;
                 }
             }
             throw new Error("No image data in response");
        }, "Gemini Image", signal);

    } catch (geminiError: any) {
        if (geminiError.message === "Aborted") throw geminiError;
        console.warn("Gemini Image models failed. Falling back to Imagen...", geminiError);
        
        // 2. Fallback to Imagen (Text-to-Image only, no reference image support in this path)
        try {
            return await retry(async () => {
                const ai = getAiClient();
                const response = await ai.models.generateImages({
                    model: MODEL_CONFIG.imagen,
                    prompt: finalPrompt + " " + styleSuffix,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '16:9'
                    },
                });
                
                const b64 = response.generatedImages?.[0]?.image?.imageBytes;
                if (!b64) throw new Error("No Imagen data");
                return b64;
            }, 2, 2000, signal);
        } catch (imagenError: any) {
            if (imagenError.message === "Aborted") throw imagenError;
            // 3. Fallback to simplified prompt if safety/content issues were the cause
            if (!isRetry) {
                console.warn("Safety fallback triggered.");
                return generateSceneImage("A magical happy place", age, undefined, true, signal);
            }
            throw new Error("All image generation strategies failed.");
        }
    }
};

/**
 * Calls Hugging Face Inference API for video generation.
 * Handles the "Model Loading" (503) state by polling.
 */
const generateHuggingFaceVideo = async (modelId: string, imageBase64: string, prompt: string, signal?: AbortSignal): Promise<string> => {
    // Priority: Environment Variable -> User Provided Fallback
    const hfToken = process.env.HUGGINGFACE_API_KEY || DEFAULT_HF_TOKEN;
    if (!hfToken) throw new Error("HUGGINGFACE_API_KEY not configured.");

    const url = `https://api-inference.huggingface.co/models/${modelId}`;
    
    // Construct payload based on model type
    // SVD typically expects 'inputs' as image, while LTX/Wan might be text-to-video or expect explicit 'image' param
    let payload: any = { inputs: imageBase64 };

    // Models that are strictly Image-to-Video often just take the image string as "inputs"
    // Models that are Text-to-Video or Hybrid (Wan, LTX) often take a JSON object with prompt and image
    if (modelId.includes('LTX') || modelId.includes('Wan')) {
        payload = {
            inputs: prompt,
            parameters: {
                image: imageBase64,
                num_inference_steps: 25
            }
        };
    }

    // Recursive polling function
    const fetchWithRetry = async (attempt = 1): Promise<Blob> => {
        if (signal?.aborted) throw new Error("Aborted");

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal
        });

        if (response.status === 503) {
            const data = await response.json();
            const waitTime = data.estimated_time || 20;
            console.log(`HF Model loading... Waiting ${waitTime}s (Attempt ${attempt})`);
            await wait(waitTime * 1000, signal);
            return fetchWithRetry(attempt + 1);
        }

        if (!response.ok) {
            const errText = await response.text();
            
            // If strict payload failed, try fallback payload (image only)
            if (attempt === 1 && (modelId.includes('LTX') || modelId.includes('Wan'))) {
                 console.warn("Complex payload failed, retrying with simple image payload...");
                 payload = { inputs: imageBase64 };
                 return fetchWithRetry(attempt + 1);
            }
            
            throw new Error(`HF API Error ${response.status}: ${errText}`);
        }

        return response.blob();
    };

    const videoBlob = await fetchWithRetry();
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (result && result.includes(',')) {
                resolve(result.split(',')[1]);
            } else {
                reject(new Error("Invalid data URL from HF"));
            }
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(videoBlob);
    });
};

/**
 * Generates a cinematic video using Veo 3 with Fallbacks.
 */
export const generateVeoVideo = async (prompt: string, imageBase64: string, signal?: AbortSignal): Promise<string> => {
    return withModelFallbacks(MODEL_CONFIG.video, async (model) => {
        
        // 1. Check for Hugging Face Fallback prefix
        if (model.startsWith('hf:')) {
            const modelId = model.replace('hf:', '');
            return generateHuggingFaceVideo(modelId, imageBase64, prompt, signal);
        }

        // 2. Standard Gemini Veo Generation
        const ai = getAiClient();
        const mimeType = getMimeType(imageBase64);

        const op = await ai.models.generateVideos({
            model: model,
            prompt: prompt,
            image: {
                imageBytes: imageBase64,
                mimeType: mimeType, 
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
    
        let operation = op;
        // Poll for completion
        while (!operation.done) {
            if (signal?.aborted) throw new Error("Aborted");
            await wait(10000, signal);
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
    
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("No video URI returned");
    
        const url = new URL(downloadLink);
        if (!url.searchParams.has('key')) url.searchParams.set('key', process.env.API_KEY || '');
        
        const fetchResponse = await fetch(url.toString(), { signal });
        if (!fetchResponse.ok) throw new Error(`Download failed: ${fetchResponse.status}`);
        
        const blob = await fetchResponse.blob();
        if (blob.size === 0) throw new Error("Empty video blob");

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (result && result.includes(',')) {
                    resolve(result.split(',')[1]);
                } else {
                    reject(new Error("Invalid data URL"));
                }
            };
            reader.onerror = () => reject(new Error("FileReader error"));
            reader.readAsDataURL(blob);
        });
    }, "Veo Video", signal);
};

/**
 * Fallback Speech-to-Text using OpenAI Whisper via HF.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const hfToken = process.env.HUGGINGFACE_API_KEY || DEFAULT_HF_TOKEN;
    const model = MODEL_CONFIG.stt;
    
    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'audio/wav'
            },
            body: audioBlob
        });
        
        if (!response.ok) throw new Error("STT Failed");
        
        const result = await response.json();
        return result.text || "";
    } catch (e) {
        console.error("Whisper Fallback Failed:", e);
        return "";
    }
};

/**
 * Text-based Chat with Director (Fallback Mode).
 * Used when Live API is unavailable.
 */
export const chatWithDirector = async (history: Message[], userInput: string, age: number): Promise<string> => {
    return withModelFallbacks(MODEL_CONFIG.script, async (model) => {
        const ai = getAiClient();
        
        // Construct a simple chat history string
        const contextHistory = history.map(m => `${m.role === 'user' ? 'Kid' : 'Director'}: ${m.text}`).join('\n');
        
        const systemPrompt = GET_SYSTEM_INSTRUCTION_BRAINSTORM(age);
        const prompt = `${systemPrompt}\n\nExisting Conversation:\n${contextHistory}\n\nKid says: "${userInput}"\n\nDirector response:`;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: prompt }] }]
        });
        
        return response.text || "I didn't catch that, can you say it again?";
    }, "Director Chat");
};
