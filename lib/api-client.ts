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