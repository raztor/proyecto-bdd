import { Router } from 'express';
import { query } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { ReporteCiudadanoBody } from '../schemas';

// Formulario B — INSERT simple en REPORTE_CIUDADANO (FK -> COMUNA).
export const reportesRouter = Router();

reportesRouter.post('/', async (req, res) => {
  const parsed = ReporteCiudadanoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', detalles: parsed.error.flatten() });
    return;
  }
  const { comuna_id, nivel_percibido, fecha_hora } = parsed.data;
  try {
    const { rows } = await query(
      `INSERT INTO reporte_ciudadano (comuna_id, nivel_percibido, fecha_hora)
       VALUES ($1, $2, COALESCE($3::timestamp, now()))
       RETURNING id`,
      [comuna_id, nivel_percibido, fecha_hora ?? null],
    );
    await logAudit({ operacion: 'INSERT', tabla: 'reporte_ciudadano', payload: parsed.data, resultado: 'ok' });
    res.status(201).json({ id: rows[0].id, mensaje: 'Reporte registrado' });
  } catch (err) {
    await logAudit({ operacion: 'INSERT', tabla: 'reporte_ciudadano', payload: req.body, resultado: 'error' });
    if ((err as { code?: string }).code === '23503') {
      res.status(400).json({ error: 'comuna_id inexistente' });
      return;
    }
    console.error('[reportes] error:', err);
    res.status(500).json({ error: 'Error interno al registrar el reporte' });
  }
});
