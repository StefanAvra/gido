import { getLanguageLabel } from "@/lib/voices";

interface GuideLandmark {
  name: string;
  type: string;
}

interface GuideRequest {
  landmarks?: GuideLandmark[];
  language?: string;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  buildings?: Record<string, number>;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function formatPlace(req: GuideRequest): string {
  const parts = [req.district, req.city, req.country].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : "an unknown area";
}

function formatBuildings(buildings: Record<string, number> | undefined): string {
  if (!buildings) return "(none)";
  const entries = Object.entries(buildings)
    .filter(([k]) => k !== "building")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (entries.length === 0) return "(none)";
  return entries.map(([k, n]) => `${k} ×${String(n)}`).join(", ");
}

function buildPrompt(req: GuideRequest): string {
  const language = getLanguageLabel(req.language ?? "en");
  const place = formatPlace(req);
  const landmarks = req.landmarks ?? [];
  const landmarkList =
    landmarks.length > 0
      ? landmarks.map((l) => `• ${l.name} (${l.type})`).join("\n")
      : "(no notable named landmarks nearby)";
  const buildingLine = formatBuildings(req.buildings);

  return `You are Gido, a charming, knowledgeable city guide narrating a walk for someone standing in ${place}.

Context (use what is interesting, ignore what is not):
- Location: ${place}
- Nearby landmarks:
${landmarkList}
- Surrounding building & amenity mix: ${buildingLine}

Write a short spoken introduction (around 120–160 words) in ${language}, as a friendly guide would say out loud. If there are notable landmarks, highlight 2–4 of the most interesting. If there are few or no landmarks, paint a sense of place from the surrounding building and amenity mix — a residential district, a market street, an industrial zone, a leafy quarter near schools, etc. — and infer something evocative or worth noticing. Be warm, informative, and conversational, as if speaking to someone who just arrived and wants to explore. No markdown, no lists, no special characters. Just natural spoken prose in ${language}.`;
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

  const hasLandmarks = (body.landmarks ?? []).length > 0;
  const hasBuildings = Object.keys(body.buildings ?? {}).length > 0;
  const hasPlace = Boolean(body.country ?? body.city ?? body.district);
  if (!hasLandmarks && !hasBuildings && !hasPlace) {
    return Response.json({ error: "No area context provided." }, { status: 400 });
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
        messages: [{ role: "user", content: buildPrompt(body) }],
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach the OpenRouter API." }, { status: 502 });
  }

  const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;
  if (!res.ok) {
    return Response.json(
      { error: data.error?.message ?? `OpenRouter error (${String(res.status)}).` },
      { status: 502 },
    );
  }

  const script = data.choices?.[0]?.message?.content?.trim();
  if (!script) {
    return Response.json({ error: "OpenRouter returned an empty script." }, { status: 502 });
  }

  return Response.json({ script });
}
