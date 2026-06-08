import { pool } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { fetchLocations, fetchLatestForLocation, type LatestMeasurement } from './openaq';
import { buildCtx, ensureEstacion, PARAM_A_CODIGO, type ImportCtx } from './importEstaciones';
import { convertir } from './unidades';

export interface MedicionImportResult {
  estaciones: number;
  medicionesNuevas: number;
  medicionesActualizadas: number;
  medicionesOmitidasUnidad: number; // descartadas por unidad incompatible
  sinDatos: string[];
  porEstacion: { estacion: string; mediciones: number }[];
}

// Upsert idempotente de mediciones para una estación. Camino de BD puro (sin red),
// por lo que es testeable de forma aislada. Se apoya en el índice ÚNICO de MEDICION.
export async function upsertMediciones(
  estacionId: number,
  mediciones: LatestMeasurement[],
  ctx: ImportCtx,
): Promise<{ nuevas: number; actualizadas: number; total: number; omitidasUnidad: number }> {
  let nuevas = 0;
  let actualizadas = 0;
  let total = 0;
  let omitidasUnidad = 0;
  for (const m of mediciones) {
    const codigo = PARAM_A_CODIGO[m.parametro.toLowerCase()];
    const contId = codigo ? ctx.cont.get(codigo) : undefined;
    if (!contId) continue; // contaminante fuera de nuestro catálogo

    // Normaliza el valor a la unidad del catálogo; si no se puede convertir, se descarta.
    const unidadDestino = ctx.unidadPorCodigo.get(codigo) ?? '';
    const valor = convertir(m.valor, m.unidad, unidadDestino, codigo);
    if (valor == null || valor < 0) {
      omitidasUnidad++;
      continue;
    }

    const r = await pool.query<{ inserted: boolean }>(
      `INSERT INTO medicion (estacion_id, contaminante_id, fecha_hora, valor, validado)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (estacion_id, contaminante_id, fecha_hora)
       DO UPDATE SET valor = EXCLUDED.valor
       RETURNING (xmax = 0) AS inserted`,
      [estacionId, contId, m.fechaUtc, valor],
    );
    if (r.rows[0].inserted) nuevas++;
    else actualizadas++;
    total++;
  }
  return { nuevas, actualizadas, total, omitidasUnidad };
}

// Trae las últimas mediciones de cada estación de OpenAQ (por location id) y las
// guarda. Asegura la estación primero (idempotente), así funciona aunque aún no
// se haya importado. 'validado = FALSE' (datos en línea, no validados).
export async function importLatestForLocations(
  locationIds: number[],
  usuario = 'collector-openaq',
): Promise<MedicionImportResult> {
  const ctx = await buildCtx();
  const res: MedicionImportResult = {
    estaciones: 0,
    medicionesNuevas: 0,
    medicionesActualizadas: 0,
    medicionesOmitidasUnidad: 0,
    sinDatos: [],
    porEstacion: [],
  };

  for (const id of locationIds) {
    const [loc] = await fetchLocations({ id });
    if (!loc || loc.latitude == null || loc.longitude == null) continue;
    const { id: estacionId } = await ensureEstacion(loc, ctx);
    const mediciones = await fetchLatestForLocation(id);
    if (mediciones.length === 0) {
      res.sinDatos.push(loc.name);
      continue;
    }
    const { nuevas, actualizadas, total, omitidasUnidad } = await upsertMediciones(estacionId, mediciones, ctx);
    res.estaciones++;
    res.medicionesNuevas += nuevas;
    res.medicionesActualizadas += actualizadas;
    res.medicionesOmitidasUnidad += omitidasUnidad;
    res.porEstacion.push({ estacion: loc.name, mediciones: total });
  }

  await logAudit({
    operacion: 'INSERT',
    tabla: 'medicion',
    usuario,
    payload: { ids: locationIds, nuevas: res.medicionesNuevas, actualizadas: res.medicionesActualizadas },
    resultado: 'ok',
  });
  return res;
}
