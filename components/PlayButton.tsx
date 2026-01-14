//This component is responsible for the play button on the main page.

'use client';

import React from 'react';

interface PlayButtonProps {
  onClick: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  disabled?: boolean;
}

export default function PlayButton({
  onClick,
  isLoading,
  isPlaying,
  disabled = false,
}: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative w-32 h-32 md:w-40 md:h-40
        rounded-full
        flex items-center justify-center
        transition-all duration-300
        shadow-2xl
        ${
          disabled || isLoading
            ? 'bg-gray-600 cursor-not-allowed'
            : isPlaying
            ? 'bg-red-600 hover:bg-red-700 active:scale-95'
            : 'bg-blue-600 hover:bg-blue-700 active:scale-95 hover:scale-105'
        }
        focus:outline-none focus:ring-4 focus:ring-blue-300
      `}
      aria-label={isPlaying ? 'Pause tour' : 'Start audio tour'}
    >
      {isLoading ? (
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      ) : isPlaying ? (
        <svg
          className="w-12 h-12 md:w-16 md:h-16 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      ) : (
        <svg
          className="w-12 h-12 md:w-16 md:h-16 text-white ml-1"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
