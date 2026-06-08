import { config } from '../config';

// Cliente mínimo de la API v3 de OpenAQ (https://docs.openaq.org).
// Autenticación por header X-API-Key (registro gratis en explore.openaq.org).

export interface NormalizedLocation {
  externalId: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  locality: string | null;
  country: string | null;
  timezone: string | null;
  parametros: string[]; // p.ej. ['pm25', 'pm10', 'o3']
}

export interface LatestMeasurement {
  parametro: string; // nombre del parámetro en OpenAQ (pm25, pm10, ...)
  valor: number;
  fechaUtc: string; // ISO 8601 en UTC
  unidad: string | null; // unidad reportada por OpenAQ (µg/m³, ppm, ...)
}

export interface BuscarFiltros {
  id?: number;
  bbox?: string; // "minLon,minLat,maxLon,maxLat"
  lat?: number;
  lon?: number;
  radio?: number; // metros
  limite?: number;
}

// Error con código HTTP para propagar al cliente sin filtrar detalles internos.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RawLocation {
  id: number;
  name?: string;
  locality?: string | null;
  timezone?: string | null;
  country?: { code?: string; name?: string } | null;
  coordinates?: { latitude?: number; longitude?: number } | null;
  sensors?: { id?: number; parameter?: { name?: string; units?: string } }[];
}

interface RawLatest {
  value?: number;
  datetime?: { utc?: string };
  sensorsId?: number;
}

function normalize(raw: RawLocation): NormalizedLocation {
  const parametros = Array.from(
    new Set((raw.sensors ?? []).map((s) => s.parameter?.name).filter((n): n is string => !!n)),
  );
  return {
    externalId: raw.id,
    name: raw.name ?? `OpenAQ ${raw.id}`,
    latitude: raw.coordinates?.latitude ?? null,
    longitude: raw.coordinates?.longitude ?? null,
    locality: raw.locality ?? null,
    country: raw.country?.code ?? raw.country?.name ?? null,
    timezone: raw.timezone ?? null,
    parametros,
  };
}

async function oaqGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  if (!config.openaq.apiKey) {
    throw new HttpError(503, 'OPENAQ_API_KEY no configurada en el backend');
  }
  const url = new URL(`${config.openaq.baseUrl}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const r = await fetch(url, { headers: { 'X-API-Key': config.openaq.apiKey } }).catch(() => {
    throw new HttpError(502, 'No se pudo contactar a OpenAQ');
  });
  if (r.status === 401 || r.status === 403) throw new HttpError(502, 'OpenAQ rechazó la API key (revísala)');
  if (r.status === 404) throw new HttpError(404, 'OpenAQ no encontró el recurso (¿id inexistente?)');
  if (r.status === 429) throw new HttpError(502, 'OpenAQ: límite de tasa alcanzado, reintenta en unos segundos');
  if (!r.ok) throw new HttpError(502, `OpenAQ respondió ${r.status}`);
  return (await r.json()) as T;
}

// Busca estaciones en OpenAQ por id, bbox o coordenadas+radio. Solo lee.
export async function fetchLocations(f: BuscarFiltros): Promise<NormalizedLocation[]> {
  if (f.id != null) {
    const data = await oaqGet<{ results?: RawLocation[] }>(`/locations/${f.id}`);
    return (data.results ?? []).map(normalize);
  }
  const params: Record<string, string | number> = { limit: f.limite ?? 100 };
  if (f.bbox) {
    params.bbox = f.bbox; // minLon,minLat,maxLon,maxLat
  } else if (f.lat != null && f.lon != null) {
    params.coordinates = `${f.lat},${f.lon}`; // formato OpenAQ v3: lat,lon
    params.radius = f.radio ?? 12000; // metros (máx. 25.000)
  } else {
    throw new HttpError(400, 'Indica id, bbox o lat+lon');
  }
  const data = await oaqGet<{ results?: RawLocation[] }>('/locations', params);
  return (data.results ?? []).map(normalize);
}

// Trae la última medición de cada sensor de una estación. Cruza el detalle de la
// estación (sensores -> parámetro) con el endpoint /latest (valor por sensor).
export async function fetchLatestForLocation(locationId: number): Promise<LatestMeasurement[]> {
  const loc = await oaqGet<{ results?: RawLocation[] }>(`/locations/${locationId}`);
  const sensores = loc.results?.[0]?.sensors ?? [];
  const sensorInfo = new Map<number, { name: string; units: string | null }>();
  for (const s of sensores) {
    if (s.id != null && s.parameter?.name) {
      sensorInfo.set(s.id, { name: s.parameter.name, units: s.parameter.units ?? null });
    }
  }

  const latest = await oaqGet<{ results?: RawLatest[] }>(`/locations/${locationId}/latest`);
  const out: LatestMeasurement[] = [];
  for (const m of latest.results ?? []) {
    const info = m.sensorsId != null ? sensorInfo.get(m.sensorsId) : undefined;
    if (!info || m.value == null || !m.datetime?.utc) continue;
    out.push({ parametro: info.name, valor: m.value, fechaUtc: m.datetime.utc, unidad: info.units });
  }
  return out;
}
