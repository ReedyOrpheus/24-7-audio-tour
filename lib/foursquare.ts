//This file is responsible for calling the Foursquare Places API and converting Foursquare’s response into your app’s Landmark format.

import axios from 'axios';
import { Landmark, Coordinates } from '@/types';

const FOURSQUARE_API_BASE = 'https://api.foursquare.com/v3';

export interface FoursquarePlace {
  fsq_id: string;
  name: string;
  categories: Array<{
    id: number;
    name: string;
    short_name: string;
  }>;
  distance: number;
  geocodes: {
    main: {
      latitude: number;
      longitude: number;
    };
  };
  location?: {
    formatted_address?: string;
  };
  rating?: number;
  description?: string;
}

/**
 * Search for nearby places using Foursquare Places API
 */
export async function searchNearbyPlaces(
  coordinates: Coordinates,
  radius: number = 1000, // meters
  limit: number = 10
): Promise<Landmark[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Foursquare API key is not configured');
  }

  try {
    const response = await axios.get(
      `${FOURSQUARE_API_BASE}/places/search`,
      {
        params: {
          ll: `${coordinates.lat},${coordinates.lng}`,
          radius,
          limit,
          categories: '16000,16001,16002,16003,16004,16005,16006,16007,16008,16009,16010,16011,16012,16013,16014,16015,16016,16017,16018,16019,16020,16021,16022,16023,16024,16025,16026,16027,16028,16029,16030,16031,16032,16033,16034,16035,16036,16037,16038,16039,16040,16041,16042,16043,16044,16045,16046,16047,16048,16049,16050,16051,16052,16053,16054,16055,16056,16057,16058,16059,16060,16061,16062,16063,16064,16065,16066,16067,16068,16069,16070,16071,16072,16073,16074,16075,16076,16077,16078,16079,16080,16081,16082,16083,16084,16085,16086,16087,16088,16089,16090,16091,16092,16093,16094,16095,16096,16097,16098,16099,16100', // Historical sites, monuments, landmarks
          fields: 'fsq_id,name,categories,distance,geocodes,location,rating,description',
        },
        headers: {
          Authorization: apiKey,
          'Accept-Language': 'en',
        },
      }
    );

    const places: FoursquarePlace[] = response.data.results || [];
    
    return places.map((place) => ({
      id: place.fsq_id,
      name: place.name,
      category: place.categories[0]?.name || 'Landmark',
      distance: place.distance,
      location: {
        lat: place.geocodes.main.latitude,
        lng: place.geocodes.main.longitude,
      },
      address: place.location?.formatted_address,
      rating: place.rating,
      description: place.description,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch places: ${error.response?.data?.error?.message || error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get place details by ID
 */
export async function getPlaceDetails(placeId: string): Promise<Landmark | null> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Foursquare API key is not configured');
  }

  try {
    const response = await axios.get(
      `${FOURSQUARE_API_BASE}/places/${placeId}`,
      {
        params: {
          fields: 'fsq_id,name,categories,distance,geocodes,location,rating,description',
        },
        headers: {
          Authorization: apiKey,
          'Accept-Language': 'en',
        },
      }
    );

    const place: FoursquarePlace = response.data;
    
    return {
      id: place.fsq_id,
      name: place.name,
      category: place.categories[0]?.name || 'Landmark',
      distance: place.distance || 0,
      location: {
        lat: place.geocodes.main.latitude,
        lng: place.geocodes.main.longitude,
      },
      address: place.location?.formatted_address,
      rating: place.rating,
      description: place.description,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch place details: ${error.response?.data?.error?.message || error.message}`
      );
    }
    return null;
  }
}
