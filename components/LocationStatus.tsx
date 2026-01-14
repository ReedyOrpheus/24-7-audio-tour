//This component is responsible for the location status on the main page.

'use client';

import React from 'react';

interface LocationStatusProps {
  status: 'idle' | 'requesting' | 'found' | 'error';
  errorMessage?: string;
}

export default function LocationStatus({
  status,
  errorMessage,
}: LocationStatusProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="mt-4 text-center">
      {status === 'requesting' && (
        <div className="flex items-center justify-center gap-2 text-gray-300">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Finding your location...</span>
        </div>
      )}

      {status === 'found' && (
        <div className="flex items-center justify-center gap-2 text-green-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-sm">Location found</span>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="flex items-center justify-center gap-2 text-red-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm max-w-md">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
