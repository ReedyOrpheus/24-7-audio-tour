import { NextRequest, NextResponse } from 'next/server';
import { searchNearbyPlaces } from '@/lib/foursquare';

// Ensure API key is available
if (!process.env.FOURSQUARE_API_KEY) {
  console.warn('FOURSQUARE_API_KEY is not set in environment variables');
}

/**
 * API route to proxy Foursquare Places API requests
 * This keeps the API key secure on the server side
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const coordinates = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    };

    if (isNaN(coordinates.lat) || isNaN(coordinates.lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const radiusValue = radius ? parseInt(radius, 10) : 1000;
    
    const landmarks = await searchNearbyPlaces(
      coordinates,
      radiusValue,
      20
    );

    return NextResponse.json({ landmarks });
  } catch (error) {
    console.error('Error in places API route:', error);
    
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
