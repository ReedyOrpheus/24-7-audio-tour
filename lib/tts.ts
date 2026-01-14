/**
 * Text-to-Speech service using Web Speech API
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;
let isPaused = false;

/**
 * Check if text-to-speech is available
 */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak text using browser's text-to-speech
 */
export function speakText(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isTTSAvailable()) {
      reject(new Error('Text-to-speech is not available in this browser'));
      return;
    }

    // Stop any current speech
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set options
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
    
    if (options.voice) {
      utterance.voice = options.voice;
    } else {
      // Try to find a good default voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) =>
          voice.lang.startsWith('en') &&
          (voice.name.includes('Female') ||
            voice.name.includes('Natural') ||
            voice.name.includes('Premium'))
      ) || voices.find((voice) => voice.lang.startsWith('en')) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.onend = () => {
      isSpeaking = false;
      isPaused = false;
      currentUtterance = null;
      resolve();
    };

    utterance.onerror = (error) => {
      isSpeaking = false;
      isPaused = false;
      currentUtterance = null;
      reject(error);
    };

    currentUtterance = utterance;
    isSpeaking = true;
    isPaused = false;
    
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Pause current speech
 */
export function pauseSpeaking(): void {
  if (!isTTSAvailable() || !isSpeaking) {
    return;
  }

  if (isPaused) {
    return;
  }

  window.speechSynthesis.pause();
  isPaused = true;
}

/**
 * Resume paused speech
 */
export function resumeSpeaking(): void {
  if (!isTTSAvailable() || !isSpeaking) {
    return;
  }

  if (!isPaused) {
    return;
  }

  window.speechSynthesis.resume();
  isPaused = false;
}

/**
 * Stop current speech
 */
export function stopSpeaking(): void {
  if (!isTTSAvailable()) {
    return;
  }

  window.speechSynthesis.cancel();
  isSpeaking = false;
  isPaused = false;
  currentUtterance = null;
}

/**
 * Get current speaking state
 */
export function getSpeakingState(): {
  isSpeaking: boolean;
  isPaused: boolean;
} {
  return {
    isSpeaking,
    isPaused,
  };
}

/**
 * Get available voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTTSAvailable()) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}
