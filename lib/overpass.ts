export interface Landmark {
  name: string;
  type: string;
  description: string | null;
  lat: number | undefined;
  lon: number | undefined;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

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
