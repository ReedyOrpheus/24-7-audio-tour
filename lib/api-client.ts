import axios from 'axios';
import { Landmark } from '@/types';

/**
 * Client-side API client to call our Next.js API routes
 */
export async function fetchNearbyLandmarks(
  coordinates: { lat: number; lng: number },
  radius: number = 1000
): Promise<Landmark[]> {
  try {
    const response = await axios.get('/api/places', {
      params: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        radius,
      },
    });

    return response.data.landmarks || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to fetch landmarks';
      throw new Error(errorMessage);
    }
    throw error;
  }
}

export type NarrativeSource = {
  title: string;
  url: string;
};

export async function fetchNarrative(landmark: Landmark): Promise<{
  narrative: string;
  sources: NarrativeSource[];
  usedLLM: boolean;
}> {
  try {
    const response = await axios.post('/api/narrative', { landmark });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to generate narrative';
      throw new Error(errorMessage);
    }
    throw error;
  }
}

/**
 * Score a single landmark's touristic significance (0-100)
 */
export async function scoreLandmarkSignificance(landmark: Landmark): Promise<number> {
  try {
    const response = await axios.post('/api/significance', { landmark });
    return response.data.score || 0;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn('Failed to score landmark significance:', error.message);
      return 0; // Return 0 on error to allow fallback behavior
    }
    return 0;
  }
}

/**
 * Score multiple landmarks in batch (more efficient than individual calls)
 */
export async function scoreLandmarksSignificance(
  landmarks: Landmark[]
): Promise<Array<{ landmark: Landmark; score: number }>> {
  if (landmarks.length === 0) {
    return [];
  }

  try {
    const response = await axios.put('/api/significance', { landmarks });
    return response.data.results || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn('Failed to score landmarks significance:', error.message);
      // Return all landmarks with score 0 as fallback
      return landmarks.map((landmark) => ({ landmark, score: 0 }));
    }
    return landmarks.map((landmark) => ({ landmark, score: 0 }));
  }
}

/**
 * Fetch area narrative when no landmarks are found
 */
export async function fetchAreaNarrative(coordinates: { lat: number; lng: number }): Promise<{
  narrative: string;
  sources: NarrativeSource[];
  usedLLM: boolean;
  areaName?: string;
}> {
  try {
    const response = await axios.post('/api/area', { coordinates });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.error || error.message || 'Failed to generate area narrative';
      throw new Error(errorMessage);
    }
    throw error;
  }
}