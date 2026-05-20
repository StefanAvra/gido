# Gido

**An AI-powered city guide that narrates the world around you.**

Tap once, and Gido finds the notable places near you, writes a warm spoken
introduction to your surroundings, and reads it aloud — like having a friendly
local guide walking beside you.

> ⚗️ Gido is an experiment / work in progress. This is the prototype phase.

## How it works

1. **Locate** — your browser shares your current position.
2. **Discover** — Gido queries [OpenStreetMap](https://www.openstreetmap.org)
   (via the Overpass API) for nearby landmarks: museums, monuments, historic
   sites, parks, viewpoints, places of worship, and more.
3. **Narrate** — an LLM (through [OpenRouter](https://openrouter.ai)) composes a
   short, conversational guide highlighting the most interesting spots.
4. **Speak** — [ElevenLabs](https://elevenlabs.io) turns the script into natural
   speech, with a live waveform while it plays.

You can adjust the search radius, pick a voice, and choose a TTS model from the
in-app settings.

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) + React 19 — chosen as the
  fastest way to prototype
- **TypeScript** + **Tailwind CSS v4**
- **Overpass API** for OpenStreetMap landmark data
- **OpenRouter** for guide-script generation (default: `google/gemini-2.5-flash`)
- **ElevenLabs** for text-to-speech

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 10+
- An [OpenRouter API key](https://openrouter.ai/keys)
- An [ElevenLabs API key](https://elevenlabs.io/app/settings/api-keys)

### Setup

```bash
# install dependencies
pnpm install

# configure environment
cp .env.example .env
# then fill in ELEVENLABS_API_KEY and OPENROUTER_API_KEY

# run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and tap the orb. Geolocation
requires `localhost` or HTTPS, and works best on a device that's actually
somewhere interesting.

### Environment variables

| Variable             | Required | Description                                            |
| -------------------- | -------- | ------------------------------------------------------ |
| `ELEVENLABS_API_KEY` | yes      | Text-to-speech                                         |
| `OPENROUTER_API_KEY` | yes      | Guide-script generation                                |
| `OPENROUTER_MODEL`   | no       | Chat model for the script (default `gemini-2.5-flash`) |

## Project structure

```
app/
  page.tsx          UI — the orb, settings, waveform, script
  api/guide/route.ts  generates the spoken script via OpenRouter
  api/tts/route.ts    streams ElevenLabs audio
lib/
  overpass.ts       OpenStreetMap landmark lookup
  voices.ts         available voices & TTS models
```

A `Dockerfile` is included for a standalone production build.

## Roadmap

This is an early prototype. Where it's headed:

- 🎙️ **Speech input** — talk to Gido instead of just listening
- 🤖 **A more agentic flow** — ask follow-up questions, go deeper on a place,
  let the guide adapt to your walk
- 📱 **A native mobile app** with a dedicated backend, once the MVP is validated

The current Next.js app is intentionally a quick prototype — the goal is to
test the idea, not to be the final architecture.


