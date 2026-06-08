/**
 * Collector programado: cada N minutos busca las estaciones de OpenAQ dentro de
 * un rango geográfico (bbox), las asegura en la BD y guarda sus últimas
 * mediciones. Así las estaciones reales se van llenando de datos y aparecen en
 * el dashboard.
 *
 * Requiere OPENAQ_API_KEY. Se ejecuta como servicio aparte:
 *   docker compose --profile collector up -d collector
 */
import { config } from '../config';
import { fetchLocations } from './openaq';
import { importLocations } from './importEstaciones';
import { importLatestForLocations } from './importMediciones';
import { connectMongo } from '../db/mongo';
import { pool } from '../db/postgres';

async function ciclo(): Promise<void> {
  const locs = await fetchLocations({ bbox: config.collector.bbox, limite: 200 });
  if (locs.length === 0) {
    console.log('[collector] sin estaciones en el bbox configurado');
    return;
  }
  await importLocations(locs, 'collector-openaq');
  const r = await importLatestForLocations(locs.map((l) => l.externalId));
  console.log(
    `[collector] ${locs.length} estaciones · ${r.medicionesNuevas} mediciones nuevas, ${r.medicionesActualizadas} actualizadas`,
  );
}

async function main(): Promise<void> {
  await connectMongo();
  await pool.query('SELECT 1');
  const intervaloMs = config.collector.intervaloMin * 60_000;
  console.log(`[collector] bbox=${config.collector.bbox} · cada ${config.collector.intervaloMin} min`);

  await ciclo().catch((e) => console.error('[collector] error:', (e as Error).message));
  setInterval(() => {
    ciclo().catch((e) => console.error('[collector] error:', (e as Error).message));
  }, intervaloMs);
}

main().catch((err) => {
  console.error('[collector] no se pudo iniciar:', err);
  process.exit(1);
});
