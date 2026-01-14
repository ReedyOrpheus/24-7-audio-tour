//This component is responsible for the audio player on the main page.

'use client';

import React from 'react';
import { Landmark } from '@/types';

interface AudioPlayerProps {
  landmark: Landmark | null;
  narrative: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function AudioPlayer({
  landmark,
  narrative,
  isPlaying,
  isPaused,
  onPause,
  onResume,
  onStop,
}: AudioPlayerProps) {
  if (!landmark || !narrative) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-4">
        {isPlaying && !isPaused && (
          <button
            onClick={onPause}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            aria-label="Pause"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            aria-label="Resume"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {isPlaying && (
          <button
            onClick={onStop}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            aria-label="Stop"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        )}

        <div className="flex-1 text-center">
          <p className="text-sm text-gray-400">
            {isPlaying && !isPaused && 'Playing...'}
            {isPaused && 'Paused'}
            {!isPlaying && !isPaused && 'Ready'}
          </p>
        </div>
      </div>
    </div>
  );
}
