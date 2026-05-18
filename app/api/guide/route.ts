interface GuideLandmark {
  name: string;
  type: string;
}

interface GuideRequest {
  landmarks?: GuideLandmark[];
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function buildPrompt(landmarks: GuideLandmark[]): string {
  const list = landmarks.map((l) => `• ${l.name} (${l.type})`).join("\n");
  return `You are Gido a charming, knowledgeable city guide narrating a walk. Here are the landmarks within walking distance of the user's current location:

${list}

Write a short spoken introduction (around 120–160 words) that a friendly guide would say out loud. Highlight 2–4 of the most interesting landmarks. Be warm, informative, and conversational — as if speaking to someone who just arrived and wants to explore. No markdown, no lists, no special characters. Just natural spoken prose.`;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server is missing OPENROUTER_API_KEY." }, { status: 500 });
  }

  let body: GuideRequest;
  try {
    body = (await request.json()) as GuideRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const landmarks = body.landmarks ?? [];
  if (landmarks.length === 0) {
    return Response.json({ error: "No landmarks provided." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        messages: [{ role: "user", content: buildPrompt(landmarks) }],
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach the OpenRouter API." }, { status: 502 });
  }

  const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;
  if (!res.ok) {
    return Response.json(
      { error: data.error?.message ?? `OpenRouter error (${res.status}).` },
      { status: 502 },
    );
  }

  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) {
    return Response.json({ error: "OpenRouter returned an empty script." }, { status: 502 });
  }

  return Response.json({ script });
}
