export interface VoiceOption {
  id: string;
  label: string;
}

export const VOICES: VoiceOption[] = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger - laid-back, casual, resonant" },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    label: "George — warm, captivating storyteller",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Sarah — mature, reassuring, confident",
  },
];

export const TTS_MODELS: VoiceOption[] = [
  { id: "eleven_flash_v2_5", label: "Eleven Flash v2.5" },
  { id: "eleven_flash_v2", label: "Eleven Flash v2" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
  { id: "eleven_v3", label: "Eleven v3" },
];

export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "ro", label: "Română" },
  { code: "ja", label: "日本語" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;
export const DEFAULT_MODEL_ID = TTS_MODELS[0].id;
export const DEFAULT_LANGUAGE = LANGUAGES[0].code;

export function isValidVoiceId(id: string): boolean {
  return VOICES.some((v) => v.id === id);
}

export function isValidModelId(id: string): boolean {
  return TTS_MODELS.some((m) => m.id === id);
}

export function getLanguageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
