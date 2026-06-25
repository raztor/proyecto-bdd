// Cliente HTTP mínimo hacia la API. En desarrollo BASE queda vacío y se usa el
// proxy de Vite (/api -> backend); en producción puede fijarse con VITE_API_URL.
const BASE: string = import.meta.env.VITE_API_URL ?? '';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Error ${res.status}`);
  }
  return data as T;
}

export interface Comuna {
  id: number;
  nombre: string;
  poblacion: number;
  region: string;
}

export interface Contaminante {
  id: number;
  codigo: string;
  unidad: string;
  nombre: string;
}

// pg serializa NUMERIC y BIGINT como string; se parsean en la UI.
export interface FilaDashboard {
  comuna_id: number;
  comuna: string;
  poblacion: number;
  contaminante_id: number;
  contaminante: string;
  contaminante_nombre: string;
  unidad: string;
  promedio: string;
  n_mediciones: string;
  categoria: string | null;
  color_hex: string | null;
  categoria_nombre: string | null;
  recomendacion: string | null;
}

export interface DashboardFiltros {
  comuna_id?: string;
  contaminante_id?: string;
  desde?: string;
  hasta?: string;
  idioma: string;
}

// ── Gráficos (agregaciones de MEDICION) ──────────────────────────────────────
// pg serializa COUNT/AVG como string; se parsean con Number() en la UI.
export interface GraficosResumen {
  total_mediciones: string;
  desde: string | null;
  hasta: string | null;
  estaciones: string;
  comunas: string;
  contaminantes: string;
}

export interface PuntoSerie {
  periodo: string;
  promedio: string;
  n: string;
}
export interface BarraComuna {
  comuna: string;
  promedio: string;
  n: string;
}
export interface BarraEstacion {
  estacion: string;
  comuna: string;
  promedio: string;
  n: string;
}
export interface PuntoHora {
  hora: number;
  promedio: string;
}
export interface PuntoMes {
  mes: number;
  promedio: string;
}

export interface GraficosData {
  contaminante_id: number;
  resumen: GraficosResumen;
  serieTemporal: PuntoSerie[];
  porComuna: BarraComuna[];
  porEstacion: BarraEstacion[];
  perfilHorario: PuntoHora[];
  estacionalidad: PuntoMes[];
}

export interface GraficosFiltros {
  contaminante_id?: string;
  comuna_id?: string;
  desde?: string;
  hasta?: string;
}

// ── Estado actual por estación (panel de estado + mapa) ──────────────────────
export interface ContaminanteEstado {
  contaminante: string;
  unidad: string;
  valor: string;
  fecha_hora: string;
  categoria: string | null;
  color_hex: string | null;
  categoria_nombre: string | null;
  recomendacion: string | null;
}

export interface EstacionEstado {
  id: number;
  nombre: string;
  comuna: string;
  latitud: number;
  longitud: number;
  contaminantes: ContaminanteEstado[];
  peor: { categoria: string; categoria_nombre: string | null; color_hex: string | null } | null;
}

export interface OpenAqLocation {
  externalId: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  locality: string | null;
  country: string | null;
  timezone: string | null;
  parametros: string[];
}

export interface ImportResult {
  solicitadas: number;
  estacionesNuevas: number;
  estacionesActualizadas: number;
  contaminantesVinculados: number;
  omitidas: { nombre: string; motivo: string }[];
  detalle: { estacion: string; comuna: string; contaminantes: string[] }[];
}

export interface MedicionImportResult {
  estaciones: number;
  medicionesNuevas: number;
  medicionesActualizadas: number;
  medicionesOmitidasUnidad: number;
  sinDatos: string[];
  porEstacion: { estacion: string; mediciones: number }[];
}

export interface BuscarOpenAqParams {
  id?: string;
  bbox?: string;
  lat?: string;
  lon?: string;
  radio?: string;
  limite?: string;
}

export interface GeoResult {
  nombre: string;
  lat: number;
  lon: number;
}

export const api = {
  comunas: () => req<Comuna[]>('/api/comunas'),
  contaminantes: (idioma = 'es') => req<Contaminante[]>(`/api/contaminantes?idioma=${idioma}`),
  dashboard: (filtros: DashboardFiltros) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return req<FilaDashboard[]>(`/api/dashboard?${params.toString()}`);
  },
  graficos: (filtros: GraficosFiltros) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return req<GraficosData>(`/api/graficos?${params.toString()}`);
  },
  estadoEstaciones: (idioma = 'es') =>
    req<EstacionEstado[]>(`/api/estaciones/estado?idioma=${idioma}`),
  registrarEstacion: (body: unknown) =>
    req<{ id: number; mensaje: string }>('/api/estaciones', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  crearReporte: (body: unknown) =>
    req<{ id: number; mensaje: string }>('/api/reportes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  buscarOpenAq: (params: BuscarOpenAqParams) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v);
    });
    return req<OpenAqLocation[]>(`/api/importacion/buscar?${qs.toString()}`);
  },
  importarEstaciones: (body: { ids: number[] }) =>
    req<ImportResult>('/api/importacion/importar', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importarMediciones: (body: { ids: number[] }) =>
    req<MedicionImportResult>('/api/importacion/mediciones', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  geocodificar: (q: string) => req<GeoResult[]>(`/api/geocodificar?q=${encodeURIComponent(q)}`),
};
