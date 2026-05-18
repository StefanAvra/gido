**Project: Stadtführer — Voice City Guide prototype**

**What we built**

A single-file HTML prototype (`stadtfuehrer.html`) that acts as a voice-first city guide. When the user taps a central "orb" button, the app:

1. Gets GPS coordinates via the browser Geolocation API
2. Queries the **OpenStreetMap Overpass API** (free, no key needed) for nearby landmarks — museums, monuments, parks, historic sites, etc. — within a configurable radius (default 500 m)
3. Sends the landmark list to the **Claude API** (`claude-sonnet-4-20250514`) to generate a short, warm, spoken-style guide script (~130 words)
4. Sends that script to the **ElevenLabs API** (`/v1/text-to-speech`) to synthesize speech and plays it back with a live waveform visualizer using the Web Audio API

The UI is dark/cartographic in aesthetic — Playfair Display + Courier Prime fonts, amber accents, pulsing orb states, animated waveform bars.

**Goal**

To get familiar with the ElevenLabs API through a meaningful prototype, with the broader vision of a voice-first city exploration app. The MVP is intentionally minimal — one button, one flow.

**Natural next steps**

- Streaming audio from ElevenLabs (speech starts faster)
- Listing user's own ElevenLabs voices via `/v1/voices`
- Tapping a landmark pill to get a focused story about just that one place
- Compass + GPS heading to enable directional narration ("on your left…")
- Ambient sound mixing under the narration via Web Audio API
