import { config } from '../config';

// Geocodificación gratuita con Nominatim (OpenStreetMap) — sin API key.
// Se llama desde el backend para poder enviar un User-Agent identificatorio,
// como exige la política de uso de Nominatim.

export interface GeoResult {
  nombre: string;
  lat: number;
  lon: number;
}

interface RawNominatim {
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function geocodificar(q: string, limite = 6): Promise<GeoResult[]> {
  const url = new URL(`${config.geo.nominatimUrl}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('countrycodes', 'cl'); // foco del proyecto: Chile
  url.searchParams.set('addressdetails', '0');

  const r = await fetch(url, { headers: { 'User-Agent': config.geo.userAgent } }).catch(() => {
    throw new Error('No se pudo contactar al servicio de geocodificación');
  });
  if (!r.ok) throw new Error(`Geocodificador respondió ${r.status}`);

  const data = (await r.json()) as RawNominatim[];
  const out: GeoResult[] = [];
  for (const d of data) {
    const lat = Number(d.lat);
    const lon = Number(d.lon);
    if (!d.display_name || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    out.push({ nombre: d.display_name, lat, lon });
  }
  return out;
}
