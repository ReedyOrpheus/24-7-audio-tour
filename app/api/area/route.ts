import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type AreaSource = {
  title: string;
  url: string;
  excerpt?: string;
};

type AreaResponse = {
  narrative: string;
  sources: Array<{ title: string; url: string }>;
  usedLLM: boolean;
  areaName?: string;
};

const SOURCE_REVALIDATE_SECONDS = 60 * 60; // 1 hour
const PUBLIC_SOURCES_USER_AGENT =
  process.env.PUBLIC_SOURCES_USER_AGENT?.trim() ||
  '24-7-audio-tour (Next.js demo; set PUBLIC_SOURCES_USER_AGENT)';

function safeJson<T>(value: unknown): T | null {
  try {
    return value as T;
  } catch {
    return null;
  }
}

async function fetchAreaInfo(coordinates: { lat: number; lng: number }): Promise<{
  areaName: string;
  address: Record<string, string>;
  displayName: string;
}> {
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
    encodeURIComponent(String(coordinates.lat)) +
    '&lon=' +
    encodeURIComponent(String(coordinates.lng)) +
    '&zoom=16&addressdetails=1&extratags=1&namedetails=1';

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': PUBLIC_SOURCES_USER_AGENT,
    },
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch area information');
  }

  const json = (await res.json()) as any;
  const address = json?.address as Record<string, string> | undefined;
  const displayName: string | undefined = json?.display_name;

  // Try to get neighborhood/district/suburb/city name
  const areaName =
    address?.neighbourhood ||
    address?.suburb ||
    address?.district ||
    address?.city_district ||
    address?.city ||
    address?.town ||
    address?.village ||
    address?.county ||
    displayName?.split(',')[0] ||
    'this area';

  return {
    areaName,
    address: address || {},
    displayName: displayName || areaName,
  };
}

async function fetchWikipediaAreaContext(areaName: string, address: Record<string, string>): Promise<AreaSource[]> {
  // Try searching for the area name, potentially with city context
  const city = address.city || address.town || address.county || '';
  const query = city ? `${areaName}, ${city}` : areaName;

  const searchUrl =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=' +
    encodeURIComponent(query);

  const searchRes = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });

  if (!searchRes.ok) return [];
  const searchJson = (await searchRes.json()) as any;
  const results = searchJson?.query?.search as Array<{ title: string }> | undefined;
  if (!results || results.length === 0) return [];

  const sources: AreaSource[] = [];

  for (const r of results.slice(0, 3)) {
    const title = r.title;
    if (!title) continue;

    const summaryUrl =
      'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title);

    const summaryRes = await fetch(summaryUrl, {
      headers: { Accept: 'application/json' },
      next: { revalidate: SOURCE_REVALIDATE_SECONDS },
    });

    if (!summaryRes.ok) continue;
    const summaryJson = (await summaryRes.json()) as any;

    const pageUrl: string | undefined =
      summaryJson?.content_urls?.desktop?.page ||
      summaryJson?.content_urls?.mobile?.page;
    const extract: string | undefined = summaryJson?.extract;
    const type: string | undefined = summaryJson?.type;

    if (type === 'disambiguation' && !extract) continue;
    if (!pageUrl) continue;

    sources.push({
      title,
      url: pageUrl,
      excerpt: extract,
    });
  }

  return sources;
}

async function generateAreaNarrativeWithOpenAI(args: {
  areaName: string;
  address: Record<string, string>;
  displayName: string;
  sources: AreaSource[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  const sourceBullets =
    args.sources.length === 0
      ? 'No sources were found for this area.'
      : args.sources
          .map((s, i) => {
            const excerpt = s.excerpt ? `\nExcerpt: ${s.excerpt}` : '';
            return `Source ${i + 1}: ${s.title}\nURL: ${s.url}${excerpt}`;
          })
          .join('\n\n');

  const addressParts = Object.entries(args.address)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const prompt = [
    `You are an expert, engaging historical audio tour guide with a passion for storytelling.`,
    `Write a fresh, varied, spoken narration about the area/neighborhood where the user is located.`,
    ``,
    `Requirements:`,
    `- Start with: "There is no specific landmark around you, however..."`,
    `- Use ONLY the facts contained in the provided sources. Do not invent details.`,
    `- If the sources don't contain a key fact, either omit it or say you're not sure.`,
    `- Keep it ~30–60 seconds when spoken (roughly 60-120 words).`,
    `- Focus on what the area is known for: its character, history, culture, reputation, notable features.`,
    `- Explain the "why" behind the area's character: why it developed this way, why it's known for certain things.`,
    `- Make it feel like a natural continuation of a tour (hook with area name, what it's known for, historical/cultural context, closing that connects to the present).`,
    `- Vary the phrasing/structure from run to run (don't use a fixed template).`,
    `- Avoid bullet points; write natural spoken paragraphs.`,
    `- Avoid markdown.`,
    ``,
    `Area Information:`,
    `Area Name: ${args.areaName}`,
    `Full Address: ${args.displayName}`,
    `Address Details:`,
    addressParts || 'No address details available',
    ``,
    `Sources:`,
    sourceBullets,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You write accurate, delightful tour narrations about neighborhoods and areas.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 450,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = (await res.json()) as any;
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response did not contain message content');
  }

  return content.trim();
}

function generateFallbackAreaNarrative(areaName: string, address: Record<string, string>): string {
  const city = address.city || address.town || '';
  const locationText = city ? `${areaName}, ${city}` : areaName;
  
  return `There is no specific landmark around you, however you are in ${locationText}. This area has its own unique character and history. Take a moment to observe your surroundings and appreciate the local atmosphere.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const coordinates = safeJson<{ coordinates?: { lat: number; lng: number } }>(body)?.coordinates;

    if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request body: expected { coordinates: { lat, lng } }' },
        { status: 400 }
      );
    }

    const { areaName, address, displayName } = await fetchAreaInfo(coordinates);
    const wikiSources = await fetchWikipediaAreaContext(areaName, address);

    // Try LLM first, but always provide a fallback
    try {
      const narrative = await generateAreaNarrativeWithOpenAI({
        areaName,
        address,
        displayName,
        sources: wikiSources,
      });
      const response: AreaResponse = {
        narrative,
        sources: wikiSources.map(({ title, url }) => ({ title, url })),
        usedLLM: true,
        areaName,
      };
      return NextResponse.json(response);
    } catch (err) {
      console.warn('LLM area narrative generation failed; falling back to template:', err);
      const response: AreaResponse = {
        narrative: generateFallbackAreaNarrative(areaName, address),
        sources: wikiSources.map(({ title, url }) => ({ title, url })),
        usedLLM: false,
        areaName,
      };
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Error generating area narrative:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
