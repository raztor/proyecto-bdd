import { Router } from 'express';
import { query } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { DashboardQuery } from '../schemas';

// Visualización principal == el indicador 11.6.2.
// Lee la tabla grande MEDICION (1.000+), calcula AVG(valor) por comuna y
// contaminante, y clasifica cada promedio en su CATEGORIA_CALIDAD. Une además
// las traducciones (i18n) del contaminante y de la categoría. Soporta filtros
// por comuna, contaminante y rango de fechas (todos parametrizados).
export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const parsed = DashboardQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() });
    return;
  }
  const { comuna_id, contaminante_id, desde, hasta, idioma } = parsed.data;

  // Filtros dinámicos: se agregan a la cláusula WHERE como parámetros ($n),
  // nunca por interpolación de strings -> inmune a inyección SQL.
  const filtros: string[] = [];
  const params: unknown[] = [];
  if (comuna_id !== undefined) {
    params.push(comuna_id);
    filtros.push(`e.comuna_id = $${params.length}`);
  }
  if (contaminante_id !== undefined) {
    params.push(contaminante_id);
    filtros.push(`m.contaminante_id = $${params.length}`);
  }
  if (desde) {
    params.push(desde);
    filtros.push(`m.fecha_hora >= $${params.length}::date`);
  }
  if (hasta) {
    params.push(hasta);
    filtros.push(`m.fecha_hora < ($${params.length}::date + INTERVAL '1 day')`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  // El idioma es el último parámetro de la consulta.
  params.push(idioma);
  const idiomaIdx = params.length;

  const sql = `
    WITH promedios AS (
      SELECT e.comuna_id,
             m.contaminante_id,
             ROUND(AVG(m.valor), 2) AS promedio,
             COUNT(*)               AS n_mediciones
        FROM medicion m
        JOIN estacion e ON e.id = m.estacion_id
        ${where}
       GROUP BY e.comuna_id, m.contaminante_id
    )
    SELECT co.id        AS comuna_id,
           co.nombre    AS comuna,
           co.poblacion,
           c.id         AS contaminante_id,
           c.codigo     AS contaminante,
           COALESCE(tcont.nombre, c.codigo) AS contaminante_nombre,
           u.simbolo    AS unidad,
           p.promedio,
           p.n_mediciones,
           cat.codigo    AS categoria,
           cat.color_hex,
           COALESCE(tcat.nombre, cat.codigo) AS categoria_nombre,
           trec.recomendacion
      FROM promedios p
      JOIN comuna co       ON co.id = p.comuna_id
      JOIN contaminante c  ON c.id  = p.contaminante_id
      JOIN unidad_medida u ON u.id  = c.unidad_id
      -- Clasificación: el promedio cae dentro del numrange de la categoría.
      LEFT JOIN categoria_calidad cat
             ON cat.contaminante_id = c.id
            AND cat.rango @> p.promedio::numeric
      -- i18n: nombre del contaminante, nombre y recomendación de la categoría.
      LEFT JOIN contaminante_traduccion tcont
             ON tcont.contaminante_id = c.id
            AND tcont.idioma_codigo = $${idiomaIdx}
      LEFT JOIN categoria_calidad_traduccion tcat
             ON tcat.categoria_id = cat.id
            AND tcat.idioma_codigo = $${idiomaIdx}
      LEFT JOIN categoria_calidad_traduccion trec
             ON trec.categoria_id = cat.id
            AND trec.idioma_codigo = $${idiomaIdx}
     ORDER BY co.nombre, c.codigo
  `;

  try {
    const { rows } = await query(sql, params);
    await logAudit({
      operacion: 'SELECT',
      tabla: 'medicion',
      payload: { comuna_id, contaminante_id, desde, hasta, idioma },
      resultado: 'ok',
    });
    res.json(rows);
  } catch (err) {
    await logAudit({ operacion: 'SELECT', tabla: 'medicion', payload: req.query, resultado: 'error' });
    console.error('[dashboard] error:', err);
    res.status(500).json({ error: 'Error interno al calcular el indicador' });
  }
});
