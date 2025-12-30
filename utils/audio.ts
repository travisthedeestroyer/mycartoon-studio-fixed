
// Utility to convert a Blob to a Base64 string
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Utility to play Base64 audio (WAV/MP3), resolves when audio finishes playing
export const playBase64Audio = (base64Audio: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.onended = () => {
        resolve();
      };
      audio.onerror = (e) => {
        console.error("Audio playback error", e);
        // Resolve anyway so the flow doesn't hang
        resolve();
      };
      audio.play().catch(e => {
        console.error("Audio play failed (interaction needed?)", e);
        resolve();
      });
    } catch (error) {
      console.error("Failed to setup audio", error);
      resolve();
    }
  });
};

// --- PCM / LIVE API UTILITIES ---

/**
 * Converts a Base64 string (Raw PCM 16-bit) to a Float32Array
 * used by Web Audio API AudioBuffers.
 */
export const base64PCM16ToFloat32 = (base64: string): Float32Array => {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  
  for (let i = 0; i < int16.length; i++) {
    // Normalize Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Wraps raw PCM data (16-bit, 24kHz, Mono) in a WAV header.
 */
export const pcmToWav = (base64Pcm: string): string => {
  // 1. Decode Base64 to binary string
  const raw = atob(base64Pcm.replace(/\s/g, ''));
  const dataLength = raw.length;
  
  // 2. Create Buffer for WAV (Header + Data)
  // Header is 44 bytes
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length (Total file size - 8 bytes for RIFF and size)
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  // 3. Write PCM samples
  const uint8 = new Uint8Array(buffer);
  // Offset 44 is where data starts
  for (let i = 0; i < dataLength; i++) {
    uint8[44 + i] = raw.charCodeAt(i);
  }

  // 4. Convert ArrayBuffer back to Base64
  let binary = '';
  const len = uint8.byteLength;
  const chunkSize = 0x8000; // Use chunks to avoid call stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, Math.min(i + chunkSize, len))));
  }
  return btoa(binary);
};
