//This component is responsible for the landmark card on the main page.

'use client';

import React from 'react';
import { Landmark } from '@/types';

interface LandmarkCardProps {
  landmark: Landmark | null;
}

export default function LandmarkCard({ landmark }: LandmarkCardProps) {
  if (!landmark) {
    return null;
  }

  return (
    <div className="mt-8 p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
            {landmark.name}
          </h3>
          <p className="text-gray-400 text-sm mb-3">
            {landmark.category}
            {landmark.distance && (
              <span className="ml-2">
                • {landmark.distance < 1000 
                  ? `${Math.round(landmark.distance)}m away`
                  : `${(landmark.distance / 1000).toFixed(1)}km away`}
              </span>
            )}
          </p>
          {landmark.address && (
            <p className="text-gray-500 text-sm">{landmark.address}</p>
          )}
        </div>
        {landmark.rating && (
          <div className="flex items-center gap-1 text-yellow-400">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-semibold">
              {landmark.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
