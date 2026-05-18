export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICES: VoiceOption[] = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger - laid-back, casual, resonant" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — warm, captivating storyteller" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — mature, reassuring, confident" },
];

export const TTS_MODELS: VoiceOption[] = [
  { id: "eleven_turbo_v2", label: "Turbo v2 — fast" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — all languages" },
  { id: "eleven_monolingual_v1", label: "Monolingual v1 — classic" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;
export const DEFAULT_MODEL_ID = TTS_MODELS[0].id;

export function isValidVoiceId(id: string): boolean {
  return VOICES.some((v) => v.id === id);
}

export function isValidModelId(id: string): boolean {
  return TTS_MODELS.some((m) => m.id === id);
}
