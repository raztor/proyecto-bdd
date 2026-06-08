import { pool } from '../db/postgres';
import { logAudit } from '../audit/audit';
import type { NormalizedLocation } from './openaq';

// Parámetro de OpenAQ -> codigo de nuestro CONTAMINANTE.
export const PARAM_A_CODIGO: Record<string, string> = {
  pm25: 'PM25',
  pm10: 'PM10',
  o3: 'O3',
  no2: 'NO2',
  so2: 'SO2',
  co: 'CO',
};

export interface ImportCtx {
  regionId: number;
  cont: Map<string, number>; // codigo -> id de contaminante
  unidadPorCodigo: Map<string, string>; // codigo -> unidad de catálogo (µg/m³, mg/m³)
}

export interface ImportResult {
  solicitadas: number;
  estacionesNuevas: number;
  estacionesActualizadas: number;
  contaminantesVinculados: number;
  omitidas: { nombre: string; motivo: string }[];
  detalle: { estacion: string; comuna: string; contaminantes: string[] }[];
}

// Contexto compartido: región destino (RM) + mapa codigo->id de contaminantes.
export async function buildCtx(): Promise<ImportCtx> {
  const rows = (
    await pool.query<{ id: number; codigo: string; simbolo: string }>(
      `SELECT c.id, c.codigo, u.simbolo
         FROM contaminante c JOIN unidad_medida u ON u.id = c.unidad_id`,
    )
  ).rows;
  const cont = new Map(rows.map((r) => [r.codigo, r.id] as const));
  const unidadPorCodigo = new Map(rows.map((r) => [r.codigo, r.simbolo] as const));
  const regionId = (
    await pool.query<{ id: number }>(
      `INSERT INTO region(codigo) VALUES ('RM')
       ON CONFLICT (codigo) DO UPDATE SET codigo = EXCLUDED.codigo RETURNING id`,
    )
  ).rows[0].id;
  return { regionId, cont, unidadPorCodigo };
}

// Inserta/actualiza una estación (+ comuna + contaminantes) y devuelve su id.
// Idempotente. Asume que loc tiene coordenadas (el llamador debe verificarlo).
export async function ensureEstacion(
  loc: NormalizedLocation,
  ctx: ImportCtx,
): Promise<{ id: number; inserted: boolean; comuna: string; nuevosContaminantes: number; contaminantes: string[] }> {
  // OpenAQ entrega 'locality' (ciudad/área), aproximación a la comuna.
  const comunaNombre = (loc.locality ?? loc.name).slice(0, 120);
  const comunaId = (
    await pool.query<{ id: number }>(
      `INSERT INTO comuna(region_id, nombre, poblacion) VALUES ($1, $2, 0)
       ON CONFLICT (region_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
      [ctx.regionId, comunaNombre],
    )
  ).rows[0].id;

  // (xmax = 0) distingue un INSERT (true) de un UPDATE por conflicto (false).
  const est = await pool.query<{ id: number; inserted: boolean }>(
    `INSERT INTO estacion(comuna_id, nombre, latitud, longitud) VALUES ($1, $2, $3, $4)
     ON CONFLICT (nombre) DO UPDATE
       SET comuna_id = EXCLUDED.comuna_id, latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud
     RETURNING id, (xmax = 0) AS inserted`,
    [comunaId, loc.name.slice(0, 120), loc.latitude, loc.longitude],
  );
  const id = est.rows[0].id;

  let nuevosContaminantes = 0;
  const contaminantes: string[] = [];
  for (const p of loc.parametros) {
    const codigo = PARAM_A_CODIGO[p.toLowerCase()];
    const contId = codigo ? ctx.cont.get(codigo) : undefined;
    if (!contId) continue; // contaminante fuera de nuestro catálogo: se ignora
    const r = await pool.query(
      `INSERT INTO estacion_contaminante(estacion_id, contaminante_id, activo) VALUES ($1, $2, TRUE)
       ON CONFLICT (estacion_id, contaminante_id) DO NOTHING`,
      [id, contId],
    );
    if ((r.rowCount ?? 0) > 0) nuevosContaminantes++;
    contaminantes.push(codigo);
  }
  return { id, inserted: est.rows[0].inserted, comuna: comunaNombre, nuevosContaminantes, contaminantes };
}

// Importa un conjunto de estaciones ya normalizadas a PostgreSQL.
export async function importLocations(
  locs: NormalizedLocation[],
  usuario = 'importador-openaq',
): Promise<ImportResult> {
  const ctx = await buildCtx();
  const res: ImportResult = {
    solicitadas: locs.length,
    estacionesNuevas: 0,
    estacionesActualizadas: 0,
    contaminantesVinculados: 0,
    omitidas: [],
    detalle: [],
  };

  for (const loc of locs) {
    if (loc.latitude == null || loc.longitude == null) {
      res.omitidas.push({ nombre: loc.name, motivo: 'sin coordenadas' });
      continue;
    }
    const e = await ensureEstacion(loc, ctx);
    if (e.inserted) res.estacionesNuevas++;
    else res.estacionesActualizadas++;
    res.contaminantesVinculados += e.nuevosContaminantes;
    res.detalle.push({ estacion: loc.name, comuna: e.comuna, contaminantes: e.contaminantes });
  }

  await logAudit({
    operacion: 'INSERT',
    tabla: 'estacion',
    usuario,
    payload: {
      solicitadas: res.solicitadas,
      nuevas: res.estacionesNuevas,
      actualizadas: res.estacionesActualizadas,
    },
    resultado: 'ok',
  });
  return res;
}
