import { Landmark } from '@/types';

/**
 * Select the most interesting landmark from a list
 * Prioritizes: rating, distance, category relevance
 */
export function selectBestLandmark(landmarks: Landmark[]): Landmark | null {
  if (landmarks.length === 0) {
    return null;
  }

  // Score each landmark
  const scored = landmarks.map((landmark) => {
    let score = 0;

    // Higher rating = better (0-10 scale, normalize to 0-100)
    if (landmark.rating) {
      score += landmark.rating * 10;
    }

    // Closer = better (inverse distance, max 100 points for 0m)
    const distanceScore = Math.max(0, 100 - (landmark.distance / 10));
    score += distanceScore;

    // Category bonus for historical/landmark categories
    const historicalKeywords = [
      'monument',
      'historic',
      'landmark',
      'museum',
      'memorial',
      'plaza',
      'square',
      'cathedral',
      'church',
      'temple',
    ];
    const categoryLower = landmark.category.toLowerCase();
    if (historicalKeywords.some((keyword) => categoryLower.includes(keyword))) {
      score += 20;
    }

    return { landmark, score };
  });

  // Sort by score (highest first) and return the best one
  scored.sort((a, b) => b.score - a.score);
  return scored[0].landmark;
}

/**
 * Generate a narrative about a landmark
 * Creates a vivid, immersive story about the place
 */
export function generateLandmarkNarrative(landmark: Landmark): string {
  const distanceText =
    landmark.distance < 100
      ? 'right here'
      : landmark.distance < 500
      ? 'just steps away'
      : landmark.distance < 1000
      ? 'a short walk away'
      : `about ${Math.round(landmark.distance / 100) / 10} kilometers away`;

  const categoryContext = getCategoryContext(landmark.category);

  let narrative = `You're standing near ${landmark.name}, ${distanceText}. `;
  
  if (categoryContext) {
    narrative += categoryContext;
  }

  if (landmark.description) {
    narrative += ` ${landmark.description}`;
  } else {
    narrative += ` This ${landmark.category.toLowerCase()} holds significance in the local area. `;
  }

  narrative += ` Take a moment to appreciate the history and culture that surrounds you.`;

  return narrative;
}

/**
 * Get contextual information based on category
 */
function getCategoryContext(category: string): string {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('monument') || categoryLower.includes('memorial')) {
    return 'This monument stands as a testament to the people and events that shaped this place. ';
  }
  
  if (categoryLower.includes('museum')) {
    return 'This museum preserves and shares the stories of this region. ';
  }
  
  if (categoryLower.includes('historic') || categoryLower.includes('historic site')) {
    return 'This historic site has witnessed countless moments in history. ';
  }
  
  if (categoryLower.includes('cathedral') || categoryLower.includes('church') || categoryLower.includes('temple')) {
    return 'This sacred space has been a center of community and spirituality for generations. ';
  }
  
  if (categoryLower.includes('plaza') || categoryLower.includes('square')) {
    return 'This public square has been a gathering place for the community. ';
  }
  
  return '';
}

/**
 * Find and select the best nearby landmark
 * This function should be called from client-side code and will use the API route
 */
export async function findBestNearbyLandmark(
  coordinates: { lat: number; lng: number },
  radius: number = 1000,
  fetchLandmarks: (coords: { lat: number; lng: number }, rad: number) => Promise<Landmark[]>,
  generateNarrative?: (landmark: Landmark) => Promise<string>
): Promise<{ landmark: Landmark; narrative: string } | null> {
  try {
    const landmarks = await fetchLandmarks(coordinates, radius);
    
    if (landmarks.length === 0) {
      return null;
    }

    const bestLandmark = selectBestLandmark(landmarks);
    
    if (!bestLandmark) {
      return null;
    }

    let narrative = generateLandmarkNarrative(bestLandmark);
    if (generateNarrative) {
      try {
        narrative = await generateNarrative(bestLandmark);
      } catch (err) {
        // Non-fatal: fall back to deterministic template narrative.
        console.warn('generateNarrative failed; using template narrative', err);
      }
    }

    return {
      landmark: bestLandmark,
      narrative,
    };
  } catch (error) {
    console.error('Error finding nearby landmark:', error);
    throw error;
  }
}
