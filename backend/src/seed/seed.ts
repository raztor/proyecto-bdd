/**
 * Seed de datos sintéticos.
 *
 *  - PostgreSQL: genera un histórico horario REALISTA de mediciones por cada par
 *    estación-contaminante (estacionalidad de invierno + doble pico diurno +
 *    ruido). Con la config por defecto supera con creces las 1.000 filas.
 *  - MongoDB: genera documentos de auditoría sintéticos para superar los 1.000.
 *
 * Es idempotente: limpia los datos sintéticos (MEDICION/EPISODIO y la auditoría
 * sintética) antes de volver a generarlos. Los catálogos (cargados por el DDL)
 * no se tocan.
 *
 * Uso:  npm run seed     (requiere las bases levantadas: docker compose up -d)
 */
import { faker } from '@faker-js/faker';
import { pool } from '../db/postgres';
import { connectMongo, getDb, closeMongo } from '../db/mongo';
import { config } from '../config';

interface PerfilContaminante {
  base: number; // concentración base (µg/m³ o mg/m³ para CO)
  amplitudDiurna: number; // amplitud del ciclo diario
  factorInvierno: number; // multiplicador en meses fríos
  ruido: number; // ruido aleatorio +/-
  max: number; // tope físico
}

// Perfiles aproximados por contaminante (sintéticos, NO datos oficiales).
const PERFILES: Record<string, PerfilContaminante> = {
  PM25: { base: 22, amplitudDiurna: 12, factorInvierno: 2.4, ruido: 8, max: 400 },
  PM10: { base: 55, amplitudDiurna: 25, factorInvierno: 1.8, ruido: 18, max: 600 },
  O3: { base: 45, amplitudDiurna: 35, factorInvierno: 0.7, ruido: 12, max: 300 },
  NO2: { base: 38, amplitudDiurna: 18, factorInvierno: 1.3, ruido: 10, max: 300 },
  SO2: { base: 9, amplitudDiurna: 5, factorInvierno: 1.2, ruido: 4, max: 200 },
  CO: { base: 0.8, amplitudDiurna: 0.6, factorInvierno: 1.5, ruido: 0.3, max: 30 },
};

// Invierno en Santiago: mayo–agosto (índices de mes 4–7).
const esInvierno = (mes: number): boolean => mes >= 4 && mes <= 7;

const diaDelAnio = (fecha: Date): number => {
  const inicioAnio = new Date(fecha.getFullYear(), 0, 0);
  return Math.floor((fecha.getTime() - inicioAnio.getTime()) / 86400000);
};

// Algunos días de invierno hay inversión térmica (estancamiento): el material
// particulado se acumula y se gatillan episodios críticos. El factor es estable
// por día (las 24 horas comparten valor) y pseudoaleatorio -> ~25% de los días
// de invierno son episodios. Solo aplica a PM2.5 y PM10.
function factorEstancamiento(codigo: string, fecha: Date): number {
  if ((codigo !== 'PM25' && codigo !== 'PM10') || !esInvierno(fecha.getMonth())) return 1;
  const r = Math.abs(Math.sin(fecha.getFullYear() * 1000 + diaDelAnio(fecha))); // 0..1 por día
  return r > 0.75 ? 1.6 + (r - 0.75) * 4 : 1; // factor 1.6..2.6 en días de episodio
}

function generarValor(codigo: string, fecha: Date): number {
  const p = PERFILES[codigo] ?? PERFILES.PM10;
  const hora = fecha.getHours();
  // O3 tiene un pico al mediodía; el material particulado, doble pico (mañana/tarde).
  const picoDiurno =
    codigo === 'O3'
      ? Math.max(0, Math.cos(((hora - 14) / 24) * 2 * Math.PI))
      : Math.exp(-((hora - 8) ** 2) / 8) + Math.exp(-((hora - 20) ** 2) / 8);
  const invierno = esInvierno(fecha.getMonth()) ? p.factorInvierno : 1;
  const estancamiento = factorEstancamiento(codigo, fecha);
  const ruido = faker.number.float({ min: -p.ruido, max: p.ruido });
  const valor = (p.base + p.amplitudDiurna * picoDiurno) * invierno * estancamiento + ruido;
  return Math.round(Math.max(0, Math.min(p.max, valor)) * 100) / 100;
}

async function main() {
  await connectMongo();

  // ── PostgreSQL: regenerar mediciones ──────────────────────────────────────
  console.log('Limpiando datos sintéticos previos (MEDICION/EPISODIO)...');
  await pool.query('TRUNCATE medicion, episodio_estacion, episodio RESTART IDENTITY CASCADE');

  const pares = (
    await pool.query<{ estacion_id: number; contaminante_id: number; codigo: string }>(
      `SELECT ec.estacion_id, ec.contaminante_id, c.codigo
         FROM estacion_contaminante ec
         JOIN contaminante c ON c.id = ec.contaminante_id
        WHERE ec.activo = TRUE`,
    )
  ).rows;

  if (pares.length === 0) {
    console.error('No hay pares estación-contaminante. ¿Levantaste las bases (docker compose up -d)?');
    process.exit(1);
  }

  const ahora = new Date();
  const inicio = new Date(ahora);
  inicio.setMonth(inicio.getMonth() - config.seedMeses);

  const horas: Date[] = [];
  for (const t = new Date(inicio); t <= ahora; t.setHours(t.getHours() + 1)) {
    horas.push(new Date(t));
  }
  console.log(
    `Generando ${pares.length} pares × ${horas.length} horas = ` +
      `${(pares.length * horas.length).toLocaleString('es-CL')} mediciones (~${config.seedMeses} meses)...`,
  );

  const LOTE = 1000;
  let buffer: unknown[][] = [];
  let total = 0;

  async function flush() {
    if (buffer.length === 0) return;
    const valuesSql = buffer
      .map((_, i) => {
        const b = i * 5;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
      })
      .join(', ');
    await pool.query(
      `INSERT INTO medicion (estacion_id, contaminante_id, fecha_hora, valor, validado)
       VALUES ${valuesSql}`,
      buffer.flat(),
    );
    total += buffer.length;
    buffer = [];
    process.stdout.write(`\r  insertadas ${total.toLocaleString('es-CL')} mediciones...`);
  }

  for (const par of pares) {
    for (const fecha of horas) {
      buffer.push([
        par.estacion_id,
        par.contaminante_id,
        fecha.toISOString(),
        generarValor(par.codigo, fecha),
        faker.datatype.boolean({ probability: 0.97 }),
      ]);
      if (buffer.length >= LOTE) await flush();
    }
  }
  await flush();
  console.log(`\n✓ ${total.toLocaleString('es-CL')} mediciones insertadas.`);

  // ── Episodios críticos: días/comuna con AVG(PM2.5) sobre el umbral de Alerta ──
  const epi = await pool.query(`
    WITH diario AS (
      SELECT e.comuna_id, e.id AS estacion_id,
             date_trunc('day', m.fecha_hora)::date AS dia,
             AVG(m.valor) AS prom
        FROM medicion m
        JOIN estacion e     ON e.id = m.estacion_id
        JOIN contaminante c ON c.id = m.contaminante_id
       WHERE c.codigo = 'PM25'
       GROUP BY e.comuna_id, e.id, date_trunc('day', m.fecha_hora)::date
    ),
    comuna_dia AS (
      SELECT comuna_id, dia, AVG(prom) AS prom
        FROM diario
       GROUP BY comuna_id, dia
      HAVING AVG(prom) >= 80
    ),
    ins_epi AS (
      INSERT INTO episodio (comuna_id, categoria_id, fecha)
      SELECT cd.comuna_id, cat.id, cd.dia
        FROM comuna_dia cd
        JOIN contaminante c       ON c.codigo = 'PM25'
        JOIN categoria_calidad cat ON cat.contaminante_id = c.id
                                  AND cd.prom BETWEEN cat.valor_min AND cat.valor_max
      ON CONFLICT (comuna_id, fecha) DO NOTHING
      RETURNING id, comuna_id, fecha
    )
    INSERT INTO episodio_estacion (episodio_id, estacion_id, valor_promedio)
    SELECT ie.id, d.estacion_id, ROUND(d.prom, 2)
      FROM ins_epi ie
      JOIN diario d ON d.comuna_id = ie.comuna_id AND d.dia = ie.fecha
    ON CONFLICT DO NOTHING
  `);
  console.log(`✓ Episodios críticos generados (filas en episodio_estacion: ${epi.rowCount ?? 0}).`);

  // ── MongoDB: documentos de auditoría sintéticos (>= 1.000) ────────────────
  const db = getDb();
  await db.collection('auditoria').deleteMany({ 'payload.sintetico': true });

  const tablas = ['estacion', 'estacion_contaminante', 'reporte_ciudadano', 'medicion', 'comuna', 'contaminante'];
  const operaciones = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
  const usuarios = ['anon', 'admin', 'monitor-sinca', 'ciudadano'];
  const N_AUDIT = 1200;

  const docs = Array.from({ length: N_AUDIT }, () => {
    const diasAtras = faker.number.int({ min: 0, max: 90 });
    const segAtras = faker.number.int({ min: 0, max: 86400 });
    return {
      operacion: faker.helpers.arrayElement(operaciones),
      tabla: faker.helpers.arrayElement(tablas),
      usuario: faker.helpers.arrayElement(usuarios),
      timestamp: new Date(Date.now() - diasAtras * 86400000 - segAtras * 1000),
      payload: { sintetico: true },
      resultado: faker.helpers.weightedArrayElement([
        { weight: 9, value: 'ok' },
        { weight: 1, value: 'error' },
      ]),
    };
  });
  await db.collection('auditoria').insertMany(docs);
  const totalAuditoria = await db.collection('auditoria').countDocuments();
  console.log(`✓ ${N_AUDIT} documentos de auditoría sintéticos (total en MongoDB: ${totalAuditoria}).`);

  await closeMongo();
  await pool.end();
  console.log('\nSeed completado.');
}

main().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});
