import { Router, type Response } from 'express';
import { fetchLocations, HttpError, type NormalizedLocation } from '../ingest/openaq';
import { importLocations } from '../ingest/importEstaciones';
import { importLatestForLocations } from '../ingest/importMediciones';
import { logAudit } from '../audit/audit';
import { BuscarOpenAqQuery, ImportarEstacionesBody, ImportarMedicionesBody } from '../schemas';

// Importación de estaciones reales desde OpenAQ.
export const importacionRouter = Router();

function manejarError(res: Response, err: unknown): void {
  const isHttp = err instanceof HttpError;
  const status = isHttp ? err.status : 500;
  const message = isHttp ? err.message : 'Error interno del servidor';
  if (!isHttp) console.error('[importacion] error:', err); // no se expone al cliente
  res.status(status).json({ error: message });
}

// GET /api/importacion/buscar — previsualiza estaciones (no escribe en la BD).
//   ?id=123  |  ?bbox=minLon,minLat,maxLon,maxLat  |  ?lat=&lon=&radio=
importacionRouter.get('/buscar', async (req, res) => {
  const parsed = BuscarOpenAqQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() });
    return;
  }
  try {
    const locs = await fetchLocations(parsed.data);
    await logAudit({ operacion: 'SELECT', tabla: 'estacion', usuario: 'importador-openaq', payload: parsed.data, resultado: 'ok' });
    res.json(locs);
  } catch (err) {
    manejarError(res, err);
  }
});

// POST /api/importacion/importar — importa estaciones a la BD.
//   body: { ids: number[] }  ó  { bbox } / { lat, lon, radio }
importacionRouter.post('/importar', async (req, res) => {
  const parsed = ImportarEstacionesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }
  const { ids, bbox, lat, lon, radio } = parsed.data;
  try {
    let locs: NormalizedLocation[];
    if (ids && ids.length > 0) {
      const arrays = await Promise.all(ids.map((id) => fetchLocations({ id })));
      locs = arrays.flat();
    } else {
      locs = await fetchLocations({ bbox, lat, lon, radio });
    }
    if (locs.length === 0) {
      res.status(404).json({ error: 'OpenAQ no devolvió estaciones para esos criterios' });
      return;
    }
    const resultado = await importLocations(locs);
    res.status(201).json(resultado);
  } catch (err) {
    manejarError(res, err);
  }
});

// POST /api/importacion/mediciones — trae las últimas mediciones de OpenAQ para
// las estaciones indicadas (por location id) y las guarda en MEDICION.
importacionRouter.post('/mediciones', async (req, res) => {
  const parsed = ImportarMedicionesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }
  try {
    const resultado = await importLatestForLocations(parsed.data.ids);
    res.status(201).json(resultado);
  } catch (err) {
    manejarError(res, err);
  }
});
