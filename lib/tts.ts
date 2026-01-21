/**
 * Text-to-Speech service using OpenAI TTS API
 * Falls back to browser's Web Speech API if OpenAI TTS is unavailable
 */

let currentAudio: HTMLAudioElement | null = null;
let isSpeaking = false;
let isPaused = false;
let audioBlobUrl: string | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * iOS Safari requires audio to be triggered directly from a user gesture.
 * This function is kept for compatibility but audio playback handles this automatically.
 */
export function primeTTS(): void {
  // No-op for audio-based TTS, but kept for API compatibility
  // Audio playback will work as long as it's triggered from user interaction
}

/**
 * Check if text-to-speech is available
 */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Speak text using OpenAI TTS API (with fallback to browser TTS)
 */
export function speakText(
  text: string,
  options: {
    rate?: number; // Not supported with audio files, kept for compatibility
    pitch?: number; // Not supported with audio files, kept for compatibility
    volume?: number;
    voice?: string; // OpenAI voice name: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  } = {}
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('Text-to-speech is not available'));
      return;
    }

    // Stop any current audio
    stopSpeaking();

    try {
      // Map 'marin' to 'nova' (closest OpenAI voice)
      const voice = options.voice === 'marin' ? 'nova' : (options.voice || 'nova');

      // Fetch audio from API route
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn('OpenAI TTS failed, falling back to browser TTS:', errorData.error);
        
        // Fallback to browser speech synthesis
        return fallbackToBrowserTTS(text, options, resolve, reject);
      }

      // Create audio blob URL
      const audioBlob = await response.blob();
      audioBlobUrl = URL.createObjectURL(audioBlob);

      // Create and play audio element
      const audio = new Audio(audioBlobUrl);
      currentAudio = audio;

      // Apply volume (rate/pitch not supported with audio files)
      audio.volume = options.volume ?? 1.0;

      // Handle audio events
      audio.onended = () => {
        cleanup();
        resolve();
      };

      audio.onerror = (error) => {
        cleanup();
        reject(new Error(`Audio playback failed: ${error}`));
      };

      audio.onpause = () => {
        // Track pause state
        if (isSpeaking && !isPaused) {
          isPaused = true;
        }
      };

      audio.onplay = () => {
        isSpeaking = true;
        isPaused = false;
      };

      // Start playback
      isSpeaking = true;
      isPaused = false;
      await audio.play();
    } catch (error) {
      console.warn('OpenAI TTS error, falling back to browser TTS:', error);
      // Fallback to browser speech synthesis
      return fallbackToBrowserTTS(text, options, resolve, reject);
    }
  });
}

/**
 * Fallback to browser's Web Speech API if OpenAI TTS fails
 */
function fallbackToBrowserTTS(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
  },
  resolve: () => void,
  reject: (error: Error) => void
): void {
  if (!isBrowser() || !('speechSynthesis' in window)) {
    reject(new Error('Text-to-speech is not available in this browser'));
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;
  utterance.lang = 'en-US';

  utterance.onend = () => {
    isSpeaking = false;
    isPaused = false;
    resolve();
  };

  utterance.onerror = (error) => {
    isSpeaking = false;
    isPaused = false;
    reject(new Error(`Speech synthesis failed: ${error}`));
  };

  isSpeaking = true;
  isPaused = false;
  window.speechSynthesis.speak(utterance);
}

/**
 * Cleanup audio resources
 */
function cleanup(): void {
  if (audioBlobUrl) {
    URL.revokeObjectURL(audioBlobUrl);
    audioBlobUrl = null;
  }
  currentAudio = null;
  isSpeaking = false;
  isPaused = false;
}

/**
 * Pause current speech
 */
export function pauseSpeaking(): void {
  if (!isBrowser() || !isSpeaking) {
    return;
  }

  if (isPaused) {
    return;
  }

  // Try audio first
  if (currentAudio) {
    currentAudio.pause();
    isPaused = true;
    return;
  }

  // Fallback to browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.pause();
    isPaused = true;
  }
}

/**
 * Resume paused speech
 */
export function resumeSpeaking(): void {
  if (!isBrowser() || !isSpeaking) {
    return;
  }

  if (!isPaused) {
    return;
  }

  // Try audio first
  if (currentAudio) {
    currentAudio.play();
    isPaused = false;
    return;
  }

  // Fallback to browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.resume();
    isPaused = false;
  }
}

/**
 * Stop current speech
 */
export function stopSpeaking(): void {
  if (!isBrowser()) {
    return;
  }

  // Stop audio playback
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    cleanup();
  }

  // Stop browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  isSpeaking = false;
  isPaused = false;
}

/**
 * Get current speaking state
 */
export function getSpeakingState(): {
  isSpeaking: boolean;
  isPaused: boolean;
} {
  // Update state from audio element if available
  if (currentAudio) {
    isSpeaking = !currentAudio.paused && !currentAudio.ended && currentAudio.currentTime > 0;
    isPaused = currentAudio.paused && currentAudio.currentTime > 0;
  }

  return {
    isSpeaking,
    isPaused,
  };
}

/**
 * Get available voices (for browser TTS fallback)
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isBrowser() || !('speechSynthesis' in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}
