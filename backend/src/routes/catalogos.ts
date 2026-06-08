import { Router } from 'express';
import { query } from '../db/postgres';
import { logAudit } from '../audit/audit';

// Endpoints de solo lectura para poblar los selects de los formularios.
export const catalogosRouter = Router();

// GET /api/comunas
catalogosRouter.get('/comunas', async (_req, res) => {
  const { rows } = await query(
    `SELECT co.id, co.nombre, co.poblacion, r.codigo AS region
       FROM comuna co
       JOIN region r ON r.id = co.region_id
      ORDER BY co.nombre`,
  );
  await logAudit({ operacion: 'SELECT', tabla: 'comuna', resultado: 'ok' });
  res.json(rows);
});

// GET /api/contaminantes?idioma=es
catalogosRouter.get('/contaminantes', async (req, res) => {
  const idioma = String(req.query.idioma ?? 'es');
  const { rows } = await query(
    `SELECT c.id, c.codigo, u.simbolo AS unidad,
            COALESCE(t.texto, c.codigo) AS nombre
       FROM contaminante c
       JOIN unidad_medida u ON u.id = c.unidad_id
       LEFT JOIN traduccion t
              ON t.entidad = 'contaminante' AND t.entidad_id = c.id
             AND t.campo = 'nombre' AND t.idioma_codigo = $1
      ORDER BY c.codigo`,
    [idioma],
  );
  await logAudit({ operacion: 'SELECT', tabla: 'contaminante', payload: { idioma }, resultado: 'ok' });
  res.json(rows);
});
