export interface Landmark {
  name: string;
  type: string;
  description: string | null;
  lat: number | undefined;
  lon: number | undefined;
}

export interface AreaContext {
  country: string | null;
  city: string | null;
  district: string | null;
  buildings: Record<string, number>;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NominatimResponse {
  address?: {
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    hamlet?: string;
  };
}

const USER_AGENT = "Gido/0.1 voice-city-guide";

export async function fetchLandmarks(
  lat: number,
  lon: number,
  radius: number,
): Promise<Landmark[]> {
  const query = `
[out:json][timeout:20];
(
  node["tourism"~"attraction|museum|artwork|viewpoint|monument|gallery|information"](around:${radius},${lat},${lon});
  node["historic"](around:${radius},${lat},${lon});
  node["amenity"~"place_of_worship|theatre|cinema|library|arts_centre"](around:${radius},${lat},${lon});
  node["natural"~"peak|waterfall|beach|spring|tree"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
  way["tourism"~"attraction|museum|viewpoint|monument|gallery"](around:${radius},${lat},${lon});
  way["historic"](around:${radius},${lat},${lon});
  way["amenity"~"theatre|cinema|arts_centre"](around:${radius},${lat},${lon});
  way["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
);
out body center qt 30;
`.trim();

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });
  if (!res.ok) {
    throw new Error(`OpenStreetMap query failed (${res.status})`);
  }

  const data = (await res.json()) as { elements: OverpassElement[] };
  const seen = new Set<string>();

  return data.elements
    .filter((e): e is OverpassElement & { tags: Record<string, string> } => {
      const name = e.tags?.name;
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((e) => ({
      name: e.tags.name,
      type:
        e.tags.tourism ??
        e.tags.historic ??
        e.tags.amenity ??
        e.tags.natural ??
        e.tags.leisure ??
        "landmark",
      description: e.tags.description ?? e.tags.inscription ?? null,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
    }))
    .slice(0, 12);
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<Pick<AreaContext, "country" | "city" | "district">> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${String(lat)}&lon=${String(lon)}&zoom=14&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    });
    if (!res.ok) return { country: null, city: null, district: null };
    const data = (await res.json()) as NominatimResponse;
    const a = data.address ?? {};
    return {
      country: a.country ?? null,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.hamlet ?? null,
      district: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null,
    };
  } catch {
    return { country: null, city: null, district: null };
  }
}

export async function fetchBuildingMix(
  lat: number,
  lon: number,
  radius: number,
): Promise<Record<string, number>> {
  const query = `
[out:json][timeout:20];
(
  way["building"](around:${String(radius)},${String(lat)},${String(lon)});
  way["amenity"](around:${String(radius)},${String(lat)},${String(lon)});
  way["shop"](around:${String(radius)},${String(lat)},${String(lon)});
);
out tags 300;
  `.trim();

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { elements: OverpassElement[] };
    const counts: Record<string, number> = {};
    for (const el of data.elements) {
      const t = el.tags;
      if (!t) continue;
      const label =
        (t.building && t.building !== "yes" ? t.building : null) ??
        t.amenity ??
        t.shop ??
        (t.building === "yes" ? "building" : null);
      if (!label) continue;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export async function fetchAreaContext(
  lat: number,
  lon: number,
  radius: number,
): Promise<AreaContext> {
  const [geo, buildings] = await Promise.all([
    reverseGeocode(lat, lon),
    fetchBuildingMix(lat, lon, radius),
  ]);
  return { ...geo, buildings };
}
