import { Router } from 'express';
import { pool, query } from '../db/postgres';
import { logAudit } from '../audit/audit';
import { RegistrarEstacionBody, EstadoEstacionesQuery } from '../schemas';

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

// ── Estado actual por estación ────────────────────────────────────────────────
// GET /api/estaciones/estado — para el panel de estado y el mapa. Devuelve, por
// estación, su última medición de cada contaminante clasificada en su categoría
// de calidad del aire, y la categoría "peor" (la más severa) para el color del
// marcador. La última medición se obtiene con DISTINCT ON, que aprovecha el
// índice (estacion_id, contaminante_id, fecha_hora) en orden descendente.
const SEVERIDAD: Record<string, number> = {
  BUENA: 1,
  REGULAR: 2,
  ALERTA: 3,
  PREEMERGENCIA: 4,
  EMERGENCIA: 5,
};

interface FilaEstado {
  estacion_id: number;
  estacion: string;
  comuna: string;
  latitud: string;
  longitud: string;
  contaminante: string;
  unidad: string;
  valor: string;
  fecha_hora: string;
  categoria: string | null;
  color_hex: string | null;
  categoria_nombre: string | null;
  recomendacion: string | null;
}

estacionesRouter.get('/estado', async (req, res) => {
  const parsed = EstadoEstacionesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Parámetros inválidos', detalles: parsed.error.flatten() });
    return;
  }
  const { idioma } = parsed.data;

  try {
    const { rows } = await query<FilaEstado>(
      `WITH ultima AS (
         SELECT DISTINCT ON (estacion_id, contaminante_id)
                estacion_id, contaminante_id, valor, fecha_hora
           FROM medicion
          ORDER BY estacion_id, contaminante_id, fecha_hora DESC
       )
       SELECT e.id AS estacion_id, e.nombre AS estacion, co.nombre AS comuna,
              e.latitud, e.longitud,
              c.codigo AS contaminante, u.simbolo AS unidad,
              ul.valor, ul.fecha_hora,
              cat.codigo AS categoria, cat.color_hex,
              COALESCE(tcat.nombre, cat.codigo) AS categoria_nombre,
              trec.recomendacion
         FROM ultima ul
         JOIN estacion e      ON e.id  = ul.estacion_id
         JOIN comuna co       ON co.id = e.comuna_id
         JOIN contaminante c  ON c.id  = ul.contaminante_id
         JOIN unidad_medida u ON u.id  = c.unidad_id
         LEFT JOIN categoria_calidad cat
                ON cat.contaminante_id = c.id AND cat.rango @> ul.valor::numeric
         LEFT JOIN categoria_calidad_traduccion tcat
                ON tcat.categoria_id = cat.id AND tcat.idioma_codigo = $1
         LEFT JOIN categoria_calidad_traduccion trec
                ON trec.categoria_id = cat.id AND trec.idioma_codigo = $1
        ORDER BY e.nombre, c.codigo`,
      [idioma],
    );

    // Agrupa las filas (una por estación+contaminante) en estaciones con su
    // estado, calculando de paso la categoría más severa de cada estación.
    const porEstacion = new Map<number, {
      id: number;
      nombre: string;
      comuna: string;
      latitud: number;
      longitud: number;
      contaminantes: Array<Omit<FilaEstado, 'estacion_id' | 'estacion' | 'comuna' | 'latitud' | 'longitud'>>;
      peor: { categoria: string; categoria_nombre: string | null; color_hex: string | null } | null;
    }>();

    for (const r of rows) {
      let est = porEstacion.get(r.estacion_id);
      if (!est) {
        est = {
          id: r.estacion_id,
          nombre: r.estacion,
          comuna: r.comuna,
          latitud: Number(r.latitud),
          longitud: Number(r.longitud),
          contaminantes: [],
          peor: null,
        };
        porEstacion.set(r.estacion_id, est);
      }
      est.contaminantes.push({
        contaminante: r.contaminante,
        unidad: r.unidad,
        valor: r.valor,
        fecha_hora: r.fecha_hora,
        categoria: r.categoria,
        color_hex: r.color_hex,
        categoria_nombre: r.categoria_nombre,
        recomendacion: r.recomendacion,
      });
      if (r.categoria) {
        const sev = SEVERIDAD[r.categoria] ?? 0;
        const sevPeor = est.peor ? SEVERIDAD[est.peor.categoria] ?? 0 : -1;
        if (sev > sevPeor) {
          est.peor = {
            categoria: r.categoria,
            categoria_nombre: r.categoria_nombre,
            color_hex: r.color_hex,
          };
        }
      }
    }

    await logAudit({
      operacion: 'SELECT',
      tabla: 'medicion',
      payload: { recurso: 'estado-estaciones', idioma },
      resultado: 'ok',
    });
    res.json([...porEstacion.values()]);
  } catch (err) {
    await logAudit({ operacion: 'SELECT', tabla: 'medicion', payload: req.query, resultado: 'error' });
    console.error('[estaciones/estado] error:', err);
    res.status(500).json({ error: 'Error interno al calcular el estado de las estaciones' });
  }
});
