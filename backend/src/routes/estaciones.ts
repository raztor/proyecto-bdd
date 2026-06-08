import { Router } from 'express';
import { pool } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { RegistrarEstacionBody } from '../schemas';

// Formulario A — INSERT que escribe en DOS tablas con llaves foráneas:
//   1) ESTACION              (FK -> COMUNA)
//   2) ESTACION_CONTAMINANTE (FK -> ESTACION, FK -> CONTAMINANTE)
// Ambos INSERT van dentro de una transacción (atomicidad).
export const estacionesRouter = Router();

estacionesRouter.post('/', async (req, res) => {
  const parsed = RegistrarEstacionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insEstacion = await client.query(
      `INSERT INTO estacion (comuna_id, nombre, latitud, longitud, fecha_instalacion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [data.comuna_id, data.nombre, data.latitud, data.longitud, data.fecha_instalacion ?? null],
    );
    const estacionId: number = insEstacion.rows[0].id;

    for (const contaminanteId of data.contaminantes) {
      await client.query(
        `INSERT INTO estacion_contaminante (estacion_id, contaminante_id, activo)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (estacion_id, contaminante_id) DO NOTHING`,
        [estacionId, contaminanteId],
      );
    }

    await client.query('COMMIT');
    await logAudit({ operacion: 'INSERT', tabla: 'estacion', payload: { id: estacionId, ...data }, resultado: 'ok' });
    await logAudit({
      operacion: 'INSERT',
      tabla: 'estacion_contaminante',
      payload: { estacion_id: estacionId, contaminantes: data.contaminantes },
      resultado: 'ok',
    });
    res.status(201).json({ id: estacionId, mensaje: 'Estación registrada' });
  } catch (err) {
    await client.query('ROLLBACK');
    await logAudit({ operacion: 'INSERT', tabla: 'estacion', payload: req.body, resultado: 'error' });
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      res.status(409).json({ error: 'Ya existe una estación con ese nombre' });
      return;
    }
    if (code === '23503') {
      res.status(400).json({ error: 'comuna_id o contaminante_id inexistente' });
      return;
    }
    console.error('[estaciones] error:', err);
    res.status(500).json({ error: 'Error interno al registrar la estación' });
  } finally {
    client.release();
  }
});
