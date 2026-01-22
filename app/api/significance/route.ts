import { NextRequest, NextResponse } from 'next/server';
import { Landmark } from '@/types';

export const dynamic = 'force-dynamic';

const SOURCE_REVALIDATE_SECONDS = 60 * 60; // 1 hour
const PUBLIC_SOURCES_USER_AGENT =
  process.env.PUBLIC_SOURCES_USER_AGENT?.trim() ||
  '24-7-audio-tour (Next.js demo; set PUBLIC_SOURCES_USER_AGENT)';

/**
 * Score a landmark's touristic significance (0-100)
 * Higher score = more significant/touristic
 */
export async function scoreLandmarkSignificance(landmark: Landmark): Promise<number> {
  let score = 0;
  const maxScore = 100;

  // Build query for searches
  const query = [landmark.name];
  if (landmark.address) query.push(landmark.address);
  if (landmark.category) query.push(landmark.category);
  const searchQuery = query.filter(Boolean).join(' ');

  // Check multiple sources in parallel for efficiency
  const [wikipediaScore, wikidataScore, osmScore] = await Promise.all([
    checkWikipediaSignificance(searchQuery),
    checkWikidataSignificance(searchQuery),
    checkOpenStreetMapSignificance(landmark),
  ]);

  score += wikipediaScore;
  score += wikidataScore;
  score += osmScore;

  // Bonus for high Foursquare rating (indicates popularity)
  if (landmark.rating && landmark.rating >= 8.0) {
    score += 10;
  } else if (landmark.rating && landmark.rating >= 7.0) {
    score += 5;
  }

  // Bonus for historical/cultural categories
  const historicalKeywords = [
    'monument',
    'historic',
    'landmark',
    'museum',
    'memorial',
    'cathedral',
    'church',
    'temple',
    'palace',
    'castle',
    'tower',
    'bridge',
  ];
  const categoryLower = landmark.category.toLowerCase();
  if (historicalKeywords.some((keyword) => categoryLower.includes(keyword))) {
    score += 10;
  }

  return Math.min(score, maxScore);
}

/**
 * Check Wikipedia for significance (0-40 points)
 */
async function checkWikipediaSignificance(query: string): Promise<number> {
  try {
    const searchUrl =
      'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=' +
      encodeURIComponent(query);

    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: SOURCE_REVALIDATE_SECONDS },
    });

    if (!searchRes.ok) return 0;
    const searchJson = (await searchRes.json()) as any;
    const results = searchJson?.query?.search as Array<{ title: string; snippet: string }> | undefined;
    
    if (!results || results.length === 0) return 0;

    const result = results[0];
    let score = 20; // Base score for having a Wikipedia page

    // Check if it's a disambiguation page (less significant)
    if (result.snippet?.toLowerCase().includes('disambiguation')) {
      score = 5;
    }

    // Check snippet for significance indicators
    const snippetLower = result.snippet.toLowerCase();
    const significanceKeywords = [
      'famous',
      'historic',
      'landmark',
      'heritage',
      'unesco',
      'monument',
      'tourist',
      'attraction',
      'significant',
      'important',
    ];
    const keywordMatches = significanceKeywords.filter((kw) => snippetLower.includes(kw)).length;
    score += Math.min(keywordMatches * 2, 20); // Up to 20 bonus points

    return Math.min(score, 40);
  } catch {
    return 0;
  }
}

/**
 * Check Wikidata for significance indicators (0-30 points)
 */
async function checkWikidataSignificance(query: string): Promise<number> {
  try {
    const searchUrl =
      'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=1&search=' +
      encodeURIComponent(query);

    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: SOURCE_REVALIDATE_SECONDS },
    });

    if (!searchRes.ok) return 0;
    const searchJson = (await searchRes.json()) as any;
    const results = searchJson?.search as Array<{
      id: string;
      description?: string;
    }> | undefined;

    if (!results || results.length === 0) return 0;

    const result = results[0];
    let score = 10; // Base score for having a Wikidata entry

    // Check description for significance
    if (result.description) {
      const descLower = result.description.toLowerCase();
      const significanceKeywords = [
        'heritage',
        'monument',
        'landmark',
        'historic',
        'unesco',
        'tourist',
        'attraction',
      ];
      const keywordMatches = significanceKeywords.filter((kw) => descLower.includes(kw)).length;
      score += Math.min(keywordMatches * 3, 20); // Up to 20 bonus points
    }

    // Check for heritage designation via SPARQL
    try {
      const sparql = `
SELECT ?heritageLabel WHERE {
  wd:${result.id} wdt:P1435 ?heritage.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1
`.trim();

      const sparqlUrl =
        'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);

      const factsRes = await fetch(sparqlUrl, {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': PUBLIC_SOURCES_USER_AGENT,
        },
        next: { revalidate: SOURCE_REVALIDATE_SECONDS },
      });

      if (factsRes.ok) {
        const factsJson = (await factsRes.json()) as any;
        const bindings = factsJson?.results?.bindings?.[0];
        if (bindings?.heritageLabel) {
          score += 10; // Heritage designation bonus
        }
      }
    } catch {
      // Best-effort; continue with current score
    }

    return Math.min(score, 30);
  } catch {
    return 0;
  }
}

/**
 * Check OpenStreetMap for significance indicators (0-20 points)
 */
async function checkOpenStreetMapSignificance(landmark: Landmark): Promise<number> {
  try {
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
      encodeURIComponent(String(landmark.location.lat)) +
      '&lon=' +
      encodeURIComponent(String(landmark.location.lng)) +
      '&zoom=18&addressdetails=1&extratags=1&namedetails=1';

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': PUBLIC_SOURCES_USER_AGENT,
      },
      next: { revalidate: SOURCE_REVALIDATE_SECONDS },
    });

    if (!res.ok) return 0;
    const json = (await res.json()) as any;

    const extratags = json?.extratags as Record<string, string> | undefined;
    if (!extratags) return 0;

    let score = 0;

    // Check for tourism tags
    if (extratags.tourism) {
      const tourismValue = extratags.tourism.toLowerCase();
      if (['attraction', 'museum', 'monument', 'artwork', 'viewpoint'].includes(tourismValue)) {
        score += 10;
      } else if (tourismValue === 'information') {
        score += 3;
      }
    }

    // Check for historic tags
    if (extratags.historic) {
      score += 8;
    }

    // Check for heritage tags
    if (extratags.heritage || extratags['heritage:operator']) {
      score += 5;
    }

    // Check for Wikipedia link (indicates significance)
    if (extratags.wikipedia) {
      score += 2;
    }

    return Math.min(score, 20);
  } catch {
    return 0;
  }
}

/**
 * POST endpoint to score a single landmark
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const landmark = body?.landmark as Landmark | undefined;

    if (!landmark || !landmark.name || !landmark.location) {
      return NextResponse.json(
        { error: 'Invalid request body: expected { landmark }' },
        { status: 400 }
      );
    }

    const score = await scoreLandmarkSignificance(landmark);

    return NextResponse.json({ score });
  } catch (error) {
    console.error('Error scoring landmark significance:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST endpoint to score multiple landmarks in batch (more efficient)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const landmarks = body?.landmarks as Landmark[] | undefined;

    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request body: expected { landmarks: Landmark[] }' },
        { status: 400 }
      );
    }

    // Score all landmarks in parallel for efficiency
    const scores = await Promise.all(
      landmarks.map((landmark) => scoreLandmarkSignificance(landmark))
    );

    const results = landmarks.map((landmark, index) => ({
      landmark,
      score: scores[index],
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error scoring landmarks significance:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
