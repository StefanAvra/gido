"use client";

import { useRef, useState } from "react";
import { fetchAreaContext, fetchLandmarks, type Landmark } from "@/lib/overpass";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL_ID,
  DEFAULT_VOICE_ID,
  LANGUAGES,
  TTS_MODELS,
  VOICES,
} from "@/lib/voices";

const BAR_COUNT = 20;
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => i);

type StateKey = "idle" | "locating" | "fetching" | "generating" | "speaking" | "done";

interface StateConfig {
  icon: string;
  label: string;
  status: string;
  loading: boolean;
}

const STATES: Record<StateKey, StateConfig> = {
  idle: { icon: "◎", label: "explore", status: "tap the orb to begin", loading: false },
  locating: { icon: "⊕", label: "locating", status: "finding your position…", loading: true },
  fetching: { icon: "◉", label: "searching", status: "querying nearby landmarks…", loading: true },
  generating: { icon: "◈", label: "writing", status: "composing your guide…", loading: true },
  speaking: { icon: "◆", label: "speaking", status: "playing guide…", loading: true },
  done: { icon: "◎", label: "explore again", status: "ready for another walk", loading: false },
};

type WindowWithWebkit = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        reject(new Error("Location access denied. Please allow location in your browser."));
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}

export default function Home() {
  const [stateKey, setStateKey] = useState<StateKey>("idle");
  const [configOpen, setConfigOpen] = useState(true);
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [radius, setRadius] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [waveActive, setWaveActive] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const current = STATES[stateKey];
  const busy = current.loading;
  const speaking = stateKey === "speaking";

  function drawWave() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / BAR_COUNT) || 1;
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const v = (data[i * step] ?? 0) / 255;
      bar.style.height = `${Math.max(3, v * 36)}px`;
    });
    rafRef.current = requestAnimationFrame(drawWave);
  }

  function startFakeWave() {
    function tick() {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = `${Math.max(3, Math.random() * 32 + 4)}px`;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function startWaveform() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const AudioCtor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!AudioCtor) {
        startFakeWave();
        return;
      }
      audioCtxRef.current ??= new AudioCtor();
      const ctx = audioCtxRef.current;
      void ctx.resume();
      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 64;
      }
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audio);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      }
      drawWave();
    } catch {
      startFakeWave();
    }
  }

  function stopWave() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    barsRef.current.forEach((bar) => {
      if (bar) bar.style.height = "4px";
    });
    setWaveActive(false);
  }

  function playGuide(url: string): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return Promise.reject(new Error("Audio element not ready."));
    audio.src = url;
    return new Promise<void>((resolve, reject) => {
      const controller = new AbortController();
      const { signal } = controller;
      audio.addEventListener(
        "canplay",
        () => {
          setWaveActive(true);
          startWaveform();
        },
        { signal },
      );
      audio.addEventListener(
        "ended",
        () => {
          controller.abort();
          stopWave();
          resolve();
        },
        { signal },
      );
      audio.addEventListener(
        "error",
        () => {
          controller.abort();
          stopWave();
          fetch(url)
            .then(async (res) => {
              const data = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              reject(new Error(data.error ?? "Audio playback failed."));
            })
            .catch(() => {
              reject(new Error("Audio playback failed."));
            });
        },
        { signal },
      );
      void audio.play().catch(() => {
        controller.abort();
        stopWave();
        reject(new Error("Could not start audio playback."));
      });
    });
  }

  async function handleExplore() {
    if (busy) return;
    setError(null);
    setScript(null);
    setLandmarks([]);

    try {
      setStateKey("locating");
      const { lat, lon } = await getLocation();

      setStateKey("fetching");
      const [found, area] = await Promise.all([
        fetchLandmarks(lat, lon, radius),
        fetchAreaContext(lat, lon, radius),
      ]);
      setLandmarks(found);

      setStateKey("generating");
      const guideRes = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landmarks: found.map((l) => ({ name: l.name, type: l.type })),
          language,
          country: area.country,
          city: area.city,
          district: area.district,
          buildings: area.buildings,
        }),
      });
      const guideData = (await guideRes.json().catch(() => ({}))) as {
        script?: string;
        error?: string;
      };
      if (!guideRes.ok || !guideData.script) {
        throw new Error(guideData.error ?? "Failed to generate the guide.");
      }
      setScript(guideData.script);

      setStateKey("speaking");
      const params = new URLSearchParams({
        text: guideData.script,
        voiceId,
        modelId,
      });
      await playGuide(`/api/tts?${params.toString()}`);

      setStateKey("done");
    } catch (err) {
      setStateKey("idle");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const orbStateClass = speaking ? "orb-speaking" : busy ? "orb-loading" : "";

  return (
    <main className="relative z-[1] mx-auto flex w-full max-w-[560px] flex-col items-center gap-8 px-6 pt-8 pb-12">
      {/* Header */}
      <header className="w-full border-b border-amber/12 pb-6 text-center">
        <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-amber opacity-70">
          ◈ voice city guide ◈
        </div>
        <h1 className="mb-1.5 font-serif text-[clamp(2rem,8vw,3rem)] font-bold leading-none tracking-[0.08em] text-amber-bright">
          Gido
        </h1>
        <div className="text-xs italic tracking-[0.12em] text-text-dim">
          discover what surrounds you
        </div>
      </header>

      {/* Settings */}
      <section className="w-full overflow-hidden rounded-lg border border-amber/12 bg-bg-2">
        <button
          type="button"
          onClick={() => {
            setConfigOpen((open) => !open);
          }}
          className="flex w-full items-center justify-between px-4 py-3 text-xs tracking-[0.1em] text-text-dim hover:text-text"
        >
          <span>⚙ settings</span>
          <span className="text-[10px]">{configOpen ? "▲" : "▼"}</span>
        </button>
        {configOpen && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="voice"
                className="text-[11px] uppercase tracking-[0.15em] text-text-dim"
              >
                Voice
              </label>
              <select
                id="voice"
                value={voiceId}
                onChange={(e) => {
                  setVoiceId(e.target.value);
                }}
                className="rounded border border-amber/30 bg-bg px-3 py-2 text-[13px] outline-none focus:border-amber"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id} className="bg-bg-2">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="language"
                className="text-[11px] uppercase tracking-[0.15em] text-text-dim"
              >
                Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                }}
                className="rounded border border-amber/30 bg-bg px-3 py-2 text-[13px] outline-none focus:border-amber"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-bg-2">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="model"
                className="text-[11px] uppercase tracking-[0.15em] text-text-dim"
              >
                Model
              </label>
              <select
                id="model"
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                }}
                className="rounded border border-amber/30 bg-bg px-3 py-2 text-[13px] outline-none focus:border-amber"
              >
                {TTS_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-bg-2">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Orb */}
      <section className="flex flex-col items-center gap-5 py-4">
        <div className={`relative h-40 w-40 ${orbStateClass}`}>
          <div className="orb-ring-2" />
          <div className="orb-ring" />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleExplore();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-full border border-amber-dim bg-bg-2 transition-colors enabled:hover:border-amber enabled:hover:bg-bg-3 enabled:active:scale-[0.97] disabled:cursor-not-allowed"
          >
            <span className="text-[28px] leading-none">{current.icon}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-amber">
              {current.label}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] tracking-[0.1em] text-text-dim">
          <label htmlFor="radius">radius</label>
          <input
            id="radius"
            type="range"
            min={200}
            max={2000}
            step={100}
            value={radius}
            onChange={(e) => {
              setRadius(Number(e.target.value));
            }}
            className="w-30 accent-amber"
          />
          <span>{radius} m</span>
        </div>

        <div
          className={`min-h-[18px] text-center text-[13px] italic tracking-[0.08em] transition-colors ${
            busy ? "text-amber" : "text-text-dim"
          }`}
        >
          {current.status}
        </div>
      </section>

      {/* Waveform */}
      <div
        className={`flex h-10 items-center gap-[3px] transition-opacity duration-300 ${
          waveActive ? "opacity-100" : "opacity-0"
        }`}
      >
        {BARS.map((i) => (
          <div
            key={`bar-${i}`}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="w-[3px] rounded-sm bg-amber"
            style={{ height: "4px" }}
          />
        ))}
      </div>

      {/* Script */}
      {script && (
        <div className="relative w-full rounded-lg border border-amber/12 bg-bg-2 px-5 py-4 font-serif text-[15px] italic leading-[1.7]">
          <span
            aria-hidden
            className="absolute -top-2 left-3 font-serif text-5xl leading-none text-amber-dim"
          >
            &ldquo;
          </span>
          {script}
        </div>
      )}

      {/* Landmarks */}
      {landmarks.length > 0 && (
        <section className="w-full">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-text-faint">
            nearby landmarks found
          </div>
          <div className="flex flex-wrap gap-1.5">
            {landmarks.map((l) => (
              <div
                key={l.name}
                className="flex items-center gap-1.5 rounded-full border border-amber/12 bg-bg-3 px-2.5 py-1 text-[11px] tracking-[0.04em] text-text-dim"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-dim" />
                {l.name}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="w-full rounded-md border border-[rgba(180,60,40,0.3)] bg-[rgba(180,60,40,0.1)] px-4 py-3 text-xs leading-[1.5] text-[#e07060]">
          ⚠ {error}
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-text-faint pt-4 text-center text-[10px] tracking-[0.1em] text-text-faint opacity-50">
        OSM · ElevenLabs · OpenRouter · Gido v0.1
      </footer>

      {/* Synthesized speech playback — no caption track applies. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} className="hidden" />
    </main>
  );
}
