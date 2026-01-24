import { Landmark } from '@/types';

/**
 * Significance threshold for filtering landmarks
 * Only landmarks with significance >= this value will be considered
 * Default: 30 (moderate significance)
 */
const SIGNIFICANCE_THRESHOLD = 30;

/**
 * Select the most interesting landmark from a list
 * Prioritizes: rating, distance, category relevance
 * @deprecated Use selectBestLandmarkWithSignificance instead
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
 * Select the best landmark from a list based on significance threshold
 * Filters landmarks by significance score, then selects the closest one
 * 
 * @param landmarks - List of landmarks to choose from
 * @param significanceScores - Map of landmark IDs to their significance scores (0-100)
 * @param threshold - Minimum significance score required (default: SIGNIFICANCE_THRESHOLD)
 * @returns The closest landmark that meets the significance threshold, or null if none found
 */
export function selectBestLandmarkWithSignificance(
  landmarks: Landmark[],
  significanceScores: Map<string, number>,
  threshold: number = SIGNIFICANCE_THRESHOLD
): Landmark | null {
  if (landmarks.length === 0) {
    return null;
  }

  // Filter landmarks by significance threshold
  const significantLandmarks = landmarks.filter((landmark) => {
    const score = significanceScores.get(landmark.id) || 0;
    return score >= threshold;
  });

  // If no landmarks meet the threshold, return null
  if (significantLandmarks.length === 0) {
    return null;
  }

  // Among significant landmarks, select the closest one
  const closest = significantLandmarks.reduce((closest, current) => {
    return current.distance < closest.distance ? current : closest;
  });

  return closest;
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
 * 
 * @param coordinates - User's current location
 * @param radius - Search radius in meters
 * @param fetchLandmarks - Function to fetch nearby landmarks
 * @param generateNarrative - Optional function to generate narrative
 * @param scoreSignificance - Function to score landmarks for significance (batch scoring)
 * @param significanceThreshold - Minimum significance score required (default: 30)
 * @param fetchAreaNarrative - Optional function to fetch area narrative when no landmarks found
 */
export async function findBestNearbyLandmark(
  coordinates: { lat: number; lng: number },
  radius: number = 1000,
  fetchLandmarks: (coords: { lat: number; lng: number }, rad: number) => Promise<Landmark[]>,
  generateNarrative?: (landmark: Landmark) => Promise<string>,
  scoreSignificance?: (landmarks: Landmark[]) => Promise<Array<{ landmark: Landmark; score: number }>>,
  significanceThreshold: number = SIGNIFICANCE_THRESHOLD,
  fetchAreaNarrative?: (coords: { lat: number; lng: number }) => Promise<{ narrative: string; areaName?: string }>
): Promise<{ landmark: Landmark | null; narrative: string; areaName?: string } | null> {
  try {
    const landmarks = await fetchLandmarks(coordinates, radius);
    
    if (landmarks.length === 0) {
      // No landmarks found at all - try to get area narrative instead
      if (fetchAreaNarrative) {
        try {
          const areaResult = await fetchAreaNarrative(coordinates);
          return {
            landmark: null,
            narrative: areaResult.narrative,
            areaName: areaResult.areaName,
          };
        } catch (err) {
          console.warn('Failed to fetch area narrative:', err);
          return null;
        }
      }
      return null;
    }

    let bestLandmark: Landmark | null = null;

    // If significance scoring is available, use it to filter and select
    if (scoreSignificance) {
      try {
        // Score all landmarks in batch for efficiency
        const scoredResults = await scoreSignificance(landmarks);
        
        // Create a map of landmark ID to significance score
        const significanceScores = new Map<string, number>();
        scoredResults.forEach(({ landmark, score }) => {
          significanceScores.set(landmark.id, score);
        });

        // Select the closest landmark that meets the significance threshold
        bestLandmark = selectBestLandmarkWithSignificance(
          landmarks,
          significanceScores,
          significanceThreshold
        );

        // If no landmark meets the threshold, try lowering it slightly
        if (!bestLandmark && significanceThreshold > 20) {
          console.log(`No landmarks met significance threshold ${significanceThreshold}, trying lower threshold`);
          bestLandmark = selectBestLandmarkWithSignificance(
            landmarks,
            significanceScores,
            Math.max(20, significanceThreshold - 10)
          );
        }
      } catch (err) {
        // Non-fatal: fall back to old selection method
        console.warn('Significance scoring failed; falling back to basic selection', err);
        bestLandmark = selectBestLandmark(landmarks);
      }
    } else {
      // Fallback to old selection method if scoring function not provided
      bestLandmark = selectBestLandmark(landmarks);
    }
    
    if (!bestLandmark) {
      // No landmarks found - try to get area narrative instead
      if (fetchAreaNarrative) {
        try {
          const areaResult = await fetchAreaNarrative(coordinates);
          return {
            landmark: null,
            narrative: areaResult.narrative,
            areaName: areaResult.areaName,
          };
        } catch (err) {
          console.warn('Failed to fetch area narrative:', err);
          return null;
        }
      }
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
