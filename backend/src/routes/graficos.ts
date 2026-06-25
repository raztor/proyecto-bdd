import { Router } from 'express';
import { query } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { GraficosQuery } from '../schemas';

// Zona de gráficos: agregaciones sobre la tabla grande MEDICION (millones de
// filas) para alimentar visualizaciones. Devuelve, en una sola respuesta y con
// las consultas ejecutadas en paralelo:
//   - resumen:        KPIs globales (volumen, rango temporal, conteos)
//   - serieTemporal:  promedio mensual del contaminante a lo largo del histórico
//   - porComuna:      ranking de comunas por promedio
//   - porEstacion:    ranking de estaciones por promedio
//   - perfilHorario:  promedio por hora del día (0-23)
//   - estacionalidad: promedio por mes del año (1-12)
//
// Todos los filtros van parametrizados ($n), nunca por interpolación -> inmune a
// inyección SQL. El patrón "filtrar por contaminante" se apoya en el índice
// idx_medicion_cont_fecha (contaminante_id, fecha_hora).
export const graficosRouter = Router();

interface Filtros {
  contId: number;
  comunaId?: number;
  desde?: string;
  hasta?: string;
}

// Construye la cláusula WHERE compartida. `conComuna` permite excluir el filtro
// de comuna en el ranking por comuna (que compara todas las comunas entre sí).
function whereMedicion(f: Filtros, conComuna: boolean): { where: string; params: unknown[] } {
  const params: unknown[] = [f.contId];
  const cond = ['m.contaminante_id = $1'];
  if (conComuna && f.comunaId !== undefined) {
    params.push(f.comunaId);
    cond.push(`e.comuna_id = $${params.length}`);
  }
  if (f.desde) {
    params.push(f.desde);
    cond.push(`m.fecha_hora >= $${params.length}::date`);
  }
  if (f.hasta) {
    params.push(f.hasta);
    cond.push(`m.fecha_hora < ($${params.length}::date + INTERVAL '1 day')`);
  }
  return { where: `WHERE ${cond.join(' AND ')}`, params };
}

graficosRouter.get('/', async (req, res) => {
  const parsed = GraficosQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() });
    return;
  }

  try {
    // Contaminante por defecto: PM2.5 (indicador 11.6.2).
    let contId = parsed.data.contaminante_id;
    if (contId === undefined) {
      const def = await query<{ id: number }>(
        `SELECT id FROM contaminante ORDER BY (codigo = 'PM25') DESC, codigo LIMIT 1`,
      );
      contId = def.rows[0]?.id;
      if (contId === undefined) {
        res.status(404).json({ error: 'No hay contaminantes configurados' });
        return;
      }
    }
    const f: Filtros = {
      contId,
      comunaId: parsed.data.comuna_id,
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    };

    const conComuna = whereMedicion(f, true);
    const sinComuna = whereMedicion(f, false);

    const [resumen, catalogos, serieTemporal, porComuna, porEstacion, perfilHorario, estacionalidad] =
      await Promise.all([
        // Escaneo único: volumen total + rango temporal del histórico.
        query(`SELECT COUNT(*) AS total_mediciones, MIN(fecha_hora) AS desde, MAX(fecha_hora) AS hasta FROM medicion`),
        query(`SELECT (SELECT COUNT(*) FROM estacion)     AS estaciones,
                      (SELECT COUNT(*) FROM comuna)        AS comunas,
                      (SELECT COUNT(*) FROM contaminante)  AS contaminantes`),
        query(
          `SELECT to_char(date_trunc('month', m.fecha_hora), 'YYYY-MM') AS periodo,
                  ROUND(AVG(m.valor), 2) AS promedio, COUNT(*) AS n
             FROM medicion m JOIN estacion e ON e.id = m.estacion_id
             ${conComuna.where}
            GROUP BY 1 ORDER BY 1`,
          conComuna.params,
        ),
        query(
          `SELECT co.nombre AS comuna, ROUND(AVG(m.valor), 2) AS promedio, COUNT(*) AS n
             FROM medicion m JOIN estacion e ON e.id = m.estacion_id JOIN comuna co ON co.id = e.comuna_id
             ${sinComuna.where}
            GROUP BY co.nombre ORDER BY promedio DESC`,
          sinComuna.params,
        ),
        query(
          `SELECT e.nombre AS estacion, co.nombre AS comuna, ROUND(AVG(m.valor), 2) AS promedio, COUNT(*) AS n
             FROM medicion m JOIN estacion e ON e.id = m.estacion_id JOIN comuna co ON co.id = e.comuna_id
             ${conComuna.where}
            GROUP BY e.nombre, co.nombre ORDER BY promedio DESC`,
          conComuna.params,
        ),
        query(
          `SELECT EXTRACT(HOUR FROM m.fecha_hora)::int AS hora, ROUND(AVG(m.valor), 2) AS promedio
             FROM medicion m JOIN estacion e ON e.id = m.estacion_id
             ${conComuna.where}
            GROUP BY 1 ORDER BY 1`,
          conComuna.params,
        ),
        query(
          `SELECT EXTRACT(MONTH FROM m.fecha_hora)::int AS mes, ROUND(AVG(m.valor), 2) AS promedio
             FROM medicion m JOIN estacion e ON e.id = m.estacion_id
             ${conComuna.where}
            GROUP BY 1 ORDER BY 1`,
          conComuna.params,
        ),
      ]);

    await logAudit({
      operacion: 'SELECT',
      tabla: 'medicion',
      payload: { contaminante_id: contId, ...parsed.data },
      resultado: 'ok',
    });

    res.json({
      contaminante_id: contId,
      resumen: { ...resumen.rows[0], ...catalogos.rows[0] },
      serieTemporal: serieTemporal.rows,
      porComuna: porComuna.rows,
      porEstacion: porEstacion.rows,
      perfilHorario: perfilHorario.rows,
      estacionalidad: estacionalidad.rows,
    });
  } catch (err) {
    await logAudit({ operacion: 'SELECT', tabla: 'medicion', payload: req.query, resultado: 'error' });
    console.error('[graficos] error:', err);
    res.status(500).json({ error: 'Error interno al calcular los gráficos' });
  }
});
