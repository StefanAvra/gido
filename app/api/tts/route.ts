import type { NextRequest } from "next/server";
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, isValidModelId, isValidVoiceId } from "@/lib/voices";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

export async function GET(request: NextRequest): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server is missing ELEVENLABS_API_KEY." }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const text = params.get("text")?.trim();
  if (!text) {
    return Response.json({ error: "Missing text." }, { status: 400 });
  }

  const voiceParam = params.get("voiceId");
  const voiceId = voiceParam && isValidVoiceId(voiceParam) ? voiceParam : DEFAULT_VOICE_ID;
  const modelParam = params.get("modelId");
  const modelId = modelParam && isValidModelId(modelParam) ? modelParam : DEFAULT_MODEL_ID;

  let res: Response;
  try {
    res = await fetch(`${ELEVENLABS_BASE}/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.45, similarity_boost: 0.78 },
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach the ElevenLabs API." }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    const detail = (await res.json().catch(() => ({}))) as {
      detail?: { message?: string };
    };
    return Response.json(
      { error: detail.detail?.message ?? `ElevenLabs error (${res.status}).` },
      { status: 502 },
    );
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
