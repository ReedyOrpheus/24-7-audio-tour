import { NextRequest, NextResponse } from 'next/server';
import { Landmark } from '@/types';
import { generateLandmarkNarrative } from '@/lib/landmarks';

export const dynamic = 'force-dynamic';

type NarrativeSource = {
  title: string;
  url: string;
  excerpt?: string;
};

type NarrativeResponse = {
  narrative: string;
  sources: NarrativeSource[];
  usedLLM: boolean;
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

function buildWikipediaQuery(landmark: Landmark): string {
  const parts = [landmark.name];
  if (landmark.address) parts.push(landmark.address);
  // Category sometimes helps disambiguate (e.g., "Cathedral", "Museum")
  if (landmark.category) parts.push(landmark.category);
  return parts.filter(Boolean).join(' ');
}

function dedupeSources(sources: NarrativeSource[]): NarrativeSource[] {
  const seen = new Set<string>();
  const out: NarrativeSource[] = [];
  for (const s of sources) {
    const key = `${s.title}|${s.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function fetchWikipediaContext(query: string): Promise<NarrativeSource[]> {
  // Wikipedia API (no key). We intentionally keep this lightweight: 1–3 top hits.
  const searchUrl =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=' +
    encodeURIComponent(query);

  const searchRes = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    // cache a bit to reduce repeated requests during testing
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });

  if (!searchRes.ok) return [];
  const searchJson = (await searchRes.json()) as any;
  const results = searchJson?.query?.search as Array<{ title: string }> | undefined;
  if (!results || results.length === 0) return [];

  const sources: NarrativeSource[] = [];

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
    const type: string | undefined = summaryJson?.type; // may be "disambiguation"

    // Skip pure disambiguation pages unless we have at least some extract.
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

async function fetchOpenStreetMapContext(landmark: Landmark): Promise<NarrativeSource[]> {
  // Nominatim usage policy asks for a proper User-Agent identifying the application.
  // Keep requests minimal and cache.
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

  if (!res.ok) return [];
  const json = (await res.json()) as any;

  const osmType: string | undefined = json?.osm_type; // "node" | "way" | "relation"
  const osmId: number | undefined = json?.osm_id;
  const displayName: string | undefined = json?.display_name;
  const category: string | undefined = json?.category;
  const type: string | undefined = json?.type;

  const osmUrl =
    osmType && osmId
      ? `https://www.openstreetmap.org/${encodeURIComponent(osmType)}/${encodeURIComponent(
          String(osmId)
        )}`
      : `https://www.openstreetmap.org/#map=19/${landmark.location.lat}/${landmark.location.lng}`;

  const extratags = json?.extratags as Record<string, string> | undefined;
  const address = json?.address as Record<string, string> | undefined;

  const selectedExtraKeys = [
    'wikipedia',
    'wikidata',
    'website',
    'start_date',
    'architect',
    'heritage',
    'heritage:operator',
    'historic',
    'tourism',
  ];
  const selectedExtras: Record<string, string> = {};
  for (const k of selectedExtraKeys) {
    const v = extratags?.[k];
    if (typeof v === 'string' && v.trim()) selectedExtras[k] = v.trim();
  }

  const excerptObj = {
    display_name: displayName,
    category,
    type,
    address,
    extratags: selectedExtras,
  };

  return [
    {
      title: 'OpenStreetMap (Nominatim)',
      url: osmUrl,
      excerpt: JSON.stringify(excerptObj),
    },
  ];
}

async function fetchWikidataContext(query: string): Promise<NarrativeSource[]> {
  const searchUrl =
    'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=2&search=' +
    encodeURIComponent(query);

  const searchRes = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });
  if (!searchRes.ok) return [];

  const searchJson = (await searchRes.json()) as any;
  const results = searchJson?.search as Array<{
    id: string;
    label?: string;
    description?: string;
    url?: string;
  }> | undefined;
  if (!results || results.length === 0) return [];

  const out: NarrativeSource[] = [];

  for (const r of results.slice(0, 2)) {
    const qid = r.id;
    if (!qid) continue;

    const entityUrl = `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;

    // Pull a few common properties with labels via SPARQL (kept small).
    const sparql = `
SELECT ?officialWebsite ?inception ?architectLabel ?countryLabel ?locatedInLabel ?heritageLabel WHERE {
  BIND(wd:${qid} AS ?item)
  OPTIONAL { ?item wdt:P856 ?officialWebsite. }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item wdt:P84 ?architect. }
  OPTIONAL { ?item wdt:P17 ?country. }
  OPTIONAL { ?item wdt:P131 ?locatedIn. }
  OPTIONAL { ?item wdt:P1435 ?heritage. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1
`.trim();

    const sparqlUrl =
      'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql);

    let facts: Record<string, unknown> = {};
    try {
      const factsRes = await fetch(sparqlUrl, {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': PUBLIC_SOURCES_USER_AGENT,
        },
        next: { revalidate: SOURCE_REVALIDATE_SECONDS },
      });

      if (factsRes.ok) {
        const factsJson = (await factsRes.json()) as any;
        const bindings = factsJson?.results?.bindings?.[0] as any;
        const getVal = (key: string) => bindings?.[key]?.value as string | undefined;
        facts = {
          officialWebsite: getVal('officialWebsite'),
          inception: getVal('inception'),
          architect: getVal('architectLabel'),
          country: getVal('countryLabel'),
          locatedIn: getVal('locatedInLabel'),
          heritageDesignation: getVal('heritageLabel'),
        };
      }
    } catch {
      // Best-effort; proceed with whatever we have.
    }

    out.push({
      title: `Wikidata: ${r.label || qid}`,
      url: entityUrl,
      excerpt: JSON.stringify({
        label: r.label,
        description: r.description,
        facts,
      }),
    });
  }

  return out;
}

async function generateWithOpenAI(args: {
  landmark: Landmark;
  sources: NarrativeSource[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  const sourceBullets =
    args.sources.length === 0
      ? 'No sources were found for this query.'
      : args.sources
          .map((s, i) => {
            const excerpt = s.excerpt ? `\nExcerpt: ${s.excerpt}` : '';
            return `Source ${i + 1}: ${s.title}\nURL: ${s.url}${excerpt}`;
          })
          .join('\n\n');

  const prompt = [
    `You are an expert, engaging historical audio tour guide with a passion for storytelling.`,
    `Write a fresh, varied, spoken narration that focuses on the historical significance and context of the place below.`,
    ``,
    `Requirements:`,
    `- Use ONLY the facts contained in the provided sources. Do not invent details.`,
    `- If the sources don't contain a key fact, either omit it or say you're not sure.`,
    `- Keep it ~30–60 seconds when spoken (roughly 60-120 words).`,
    `- Focus heavily on historical context: when was it built, why was it built, what historical events happened here, why is it located in this specific place.`,
    `- Explain the "why" behind things: why this location, why this design, why this name, why it matters historically.`,
    `- Make the structure feel like a historical tour (hook with historical significance, key historical facts and context, why it's here/why it matters, closing that connects to broader history).`,
    `- Vary the phrasing/structure from run to run (don't use a fixed template).`,
    `- Avoid bullet points; write natural spoken paragraphs.`,
    `- Avoid markdown.`,
    ``,
    `Place:`,
    `Name: ${args.landmark.name}`,
    `Category: ${args.landmark.category}`,
    args.landmark.address ? `Address: ${args.landmark.address}` : '',
    args.landmark.rating ? `Rating: ${args.landmark.rating}` : '',
    `Distance (meters): ${Math.round(args.landmark.distance)}`,
    `Coordinates: ${args.landmark.location.lat}, ${args.landmark.location.lng}`,
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
        { role: 'system', content: 'You write accurate, delightful tour narrations.' },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const landmark = safeJson<{ landmark?: Landmark }>(body)?.landmark;

    if (!landmark || !landmark.name || !landmark.category || !landmark.location) {
      return NextResponse.json(
        { error: 'Invalid request body: expected { landmark }' },
        { status: 400 }
      );
    }

    const query = buildWikipediaQuery(landmark);
    const [wikiSources, osmSources, wikidataSources] = await Promise.all([
      fetchWikipediaContext(query),
      fetchOpenStreetMapContext(landmark),
      fetchWikidataContext(query),
    ]);

    const sources = dedupeSources([...wikiSources, ...osmSources, ...wikidataSources]);

    // Try LLM first (for variability + richer writing), but always provide a fallback.
    try {
      const narrative = await generateWithOpenAI({ landmark, sources });
      const response: NarrativeResponse = {
        narrative,
        sources: sources.map(({ title, url }) => ({ title, url })),
        usedLLM: true,
      };
      return NextResponse.json(response);
    } catch (err) {
      console.warn('LLM narrative generation failed; falling back to template:', err);
      const response: NarrativeResponse = {
        narrative: generateLandmarkNarrative(landmark),
        sources: sources.map(({ title, url }) => ({ title, url })),
        usedLLM: false,
      };
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Error generating narrative:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

