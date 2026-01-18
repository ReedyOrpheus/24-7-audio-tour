/**
 * Text-to-Speech service using Web Speech API
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;
let isPaused = false;
let hasPrimedTTS = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * iOS Safari in particular may require an audio/speech action to be triggered
 * directly from a user gesture (tap). Calling this at the start of the tap
 * handler helps "unlock" speech for later async work (geo + network).
 */
export function primeTTS(): void {
  if (!isBrowser() || !('speechSynthesis' in window)) return;
  if (hasPrimedTTS) return;

  try {
    // A near-silent, near-instant utterance.
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.rate = 1.5;
    u.pitch = 1.0;
    u.lang = 'en-US';

    // On some browsers, whitespace utterances may never fire events; don't rely on them.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    hasPrimedTTS = true;
  } catch {
    // Best-effort priming only.
  }
}

async function ensureVoicesLoaded(timeoutMs: number = 1500): Promise<void> {
  if (!isTTSAvailable()) return;

  const voicesNow = window.speechSynthesis.getVoices();
  if (voicesNow && voicesNow.length > 0) return;

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve();
    };

    const t = window.setTimeout(finish, timeoutMs);
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      window.clearTimeout(t);
      finish();
    });
  });
}

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
  return new Promise(async (resolve, reject) => {
    if (!isTTSAvailable()) {
      reject(new Error('Text-to-speech is not available in this browser'));
      return;
    }

    // Stop any current speech
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    let didStart = false;
    
    // Set options
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = options.voice?.lang ?? 'en-US';
    
    if (options.voice) {
      utterance.voice = options.voice;
    } else {
      // Try to find a good default voice
      await ensureVoicesLoaded();
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

    utterance.onstart = () => {
      didStart = true;
    };

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

    // Watchdog: on iOS this can fail silently if not triggered by a user gesture.
    // If speaking never starts, fail fast so the UI can show an error.
    window.setTimeout(() => {
      if (!isTTSAvailable()) return;
      if (currentUtterance !== utterance) return;
      const synth = window.speechSynthesis;
      if (!didStart && !synth.speaking && !synth.pending) {
        stopSpeaking();
        reject(
          new Error(
            'Speech did not start. On iPhone Safari, audio often requires a direct tap to start. Tap Play again.'
          )
        );
      }
    }, 1200);
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
