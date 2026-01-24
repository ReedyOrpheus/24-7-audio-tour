import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TTS_TIMEOUT_MS = 10000; // 10 seconds max for TTS generation

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const timeout = options.timeout || TTS_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * API route to generate speech audio using OpenAI TTS API
 * This keeps the API key secure on the server side
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log(`[PERF] ========== TTS API Request Started ==========`);
  try {
    const body = await request.json().catch(() => null);
    const text = body?.text;
    const voice = body?.voice || 'alloy'; // Default to 'alloy' if not specified

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    console.log(`[PERF] TTS request: text length=${text.length} chars, voice=${voice}`);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Validate voice (OpenAI TTS supports: alloy, echo, fable, onyx, nova, shimmer)
    // Note: If 'marin' is not a standard voice, we'll use 'nova' as fallback
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice.toLowerCase()) 
      ? voice.toLowerCase() 
      : 'nova'; // Default to 'nova' if invalid voice specified

    // Call OpenAI TTS API with timeout
    const apiCallStart = Date.now();
    const response = await fetchWithTimeout('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: TTS_TIMEOUT_MS,
      body: JSON.stringify({
        model: 'tts-1', // Use 'tts-1-hd' for higher quality (2x cost)
        input: text,
        voice: selectedVoice,
      }),
    });

    const apiCallTime = Date.now() - apiCallStart;
    console.log(`[PERF] TTS API call completed in ${apiCallTime}ms`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const totalTime = Date.now() - requestStartTime;
      console.error(`[PERF] ========== TTS API Request FAILED after ${totalTime}ms ==========`);
      console.error('OpenAI TTS API error:', response.status, errorText);
      return NextResponse.json(
        { error: `OpenAI TTS failed: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    // Return the audio as a blob
    const bufferStart = Date.now();
    const audioBuffer = await response.arrayBuffer();
    const bufferTime = Date.now() - bufferStart;
    const totalTime = Date.now() - requestStartTime;
    console.log(`[PERF] Audio buffer processed in ${bufferTime}ms (size: ${audioBuffer.byteLength} bytes)`);
    console.log(`[PERF] ========== TTS API Request COMPLETED in ${totalTime}ms ==========`);
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[PERF] ========== TTS API Request FAILED after ${totalTime}ms ==========`);
    console.error('TTS generation error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
