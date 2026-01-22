/*This file is responsible for the main page of the application.*/

'use client';

import React, { useState, useEffect } from 'react';
import PlayButton from '@/components/PlayButton';
import LocationStatus from '@/components/LocationStatus';
import LandmarkCard from '@/components/LandmarkCard';
import AudioPlayer from '@/components/AudioPlayer';
import { getCurrentLocation } from '@/lib/geolocation';
import { findBestNearbyLandmark } from '@/lib/landmarks';
import { fetchNearbyLandmarks, fetchNarrative, scoreLandmarksSignificance, NarrativeSource } from '@/lib/api-client';
import { primeTTS, speakText, pauseSpeaking, resumeSpeaking, stopSpeaking, getSpeakingState } from '@/lib/tts';
import { Landmark } from '@/types';

type LocationStatusType = 'idle' | 'requesting' | 'found' | 'error';

export default function Home() {
  const [locationStatus, setLocationStatus] = useState<LocationStatusType>('idle');
  const [locationError, setLocationError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLandmark, setCurrentLandmark] = useState<Landmark | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [sources, setSources] = useState<NarrativeSource[]>([]);
  const [usedLLM, setUsedLLM] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Check speaking state periodically
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        const state = getSpeakingState();
        if (!state.isSpeaking && !state.isPaused) {
          setIsPlaying(false);
          setIsPaused(false);
        } else {
          setIsPaused(state.isPaused);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const handlePlayClick = async () => {
    // iOS Safari: unlock speech synthesis while we're still inside the user tap.
    primeTTS();

    if (isPlaying) {
      // If playing, pause
      if (isPaused) {
        resumeSpeaking();
        setIsPaused(false);
      } else {
        pauseSpeaking();
        setIsPaused(true);
      }
      return;
    }

    // Start new tour
    setIsLoading(true);
    setLocationStatus('requesting');
    setLocationError(undefined);
    setCurrentLandmark(null);
    setNarrative(null);
    setSources([]);
    setUsedLLM(false);

    try {
      // Get current location
      const coordinates = await getCurrentLocation({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      setLocationStatus('found');

      // Find nearby landmark using API route with significance scoring
      const result = await findBestNearbyLandmark(
        coordinates,
        1000,
        fetchNearbyLandmarks,
        async (landmark) => {
          const r = await fetchNarrative(landmark);
          setSources(r.sources || []);
          setUsedLLM(!!r.usedLLM);
          return r.narrative;
        },
        scoreLandmarksSignificance, // Pass significance scoring function
        30 // Significance threshold (0-100)
      );

      if (!result) {
        setLocationStatus('error');
        setLocationError(
          'No interesting landmarks found nearby. Try moving to a different location.'
        );
        setIsLoading(false);
        return;
      }

      setCurrentLandmark(result.landmark);
      setNarrative(result.narrative);

      // Start audio narration
      setIsPlaying(true);
      setIsPaused(false);

      await speakText(result.narrative, {
        voice: 'marin', // Uses OpenAI TTS 'nova' voice (marin maps to nova)
        rate: 0.95,
        pitch: 1.0,
        volume: 1.0,
      });

      setIsPlaying(false);
      setIsPaused(false);
    } catch (error) {
      console.error('Error starting tour:', error);
      
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      
      setLocationStatus('error');
      setLocationError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      setIsPaused(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    pauseSpeaking();
    setIsPaused(true);
  };

  const handleResume = () => {
    resumeSpeaking();
    setIsPaused(false);
  };

  const handleStop = () => {
    stopSpeaking();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentLandmark(null);
    setNarrative(null);
    setSources([]);
    setUsedLLM(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          24-7 Audio Tour
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
          Discover the stories around you. Press play to start your instant
          guided tour.
        </p>
      </div>

      <PlayButton
        onClick={handlePlayClick}
        isLoading={isLoading}
        isPlaying={isPlaying && !isPaused}
        disabled={false}
      />

      <LocationStatus status={locationStatus} errorMessage={locationError} />

      <LandmarkCard landmark={currentLandmark} />

      {currentLandmark && sources.length > 0 && (
        <div className="mt-3 text-center max-w-2xl mx-auto">
          <p className="text-xs text-gray-500">
            {usedLLM ? 'Generated with LLM using public sources:' : 'Public sources found:'}
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {sources.slice(0, 3).map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <AudioPlayer
        landmark={currentLandmark}
        narrative={narrative}
        isPlaying={isPlaying}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
      />
    </main>
  );
}
