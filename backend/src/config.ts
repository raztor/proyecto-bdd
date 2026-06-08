import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Carga el .env de la raíz del repositorio (fuente única, compartida con
// docker-compose). Si no existe, se usan las variables de entorno reales
// (caso contenedor) o los valores por defecto de desarrollo de abajo.
loadEnv({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  pg: {
    host: process.env.PG_HOST ?? 'localhost',
    port: Number(process.env.PG_PORT ?? 5432),
    user: process.env.PG_USER ?? 'calidad_app',
    password: process.env.PG_PASSWORD ?? '',
    database: process.env.PG_DATABASE ?? 'calidad_aire',
  },
  mongo: {
    url: process.env.MONGO_URL ?? 'mongodb://localhost:27017',
    db: process.env.MONGO_DB ?? 'calidad_aire_audit',
  },
  // Importación de estaciones reales desde OpenAQ (clave gratis en explore.openaq.org).
  openaq: {
    apiKey: process.env.OPENAQ_API_KEY ?? '',
    baseUrl: process.env.OPENAQ_BASE_URL ?? 'https://api.openaq.org/v3',
  },
  // Collector: poll periódico de mediciones dentro de un rango geográfico.
  collector: {
    bbox: process.env.COLLECTOR_BBOX ?? '-70.9,-33.7,-70.4,-33.2', // Gran Santiago
    intervaloMin: Number(process.env.COLLECTOR_INTERVAL_MIN ?? 60),
  },
  // Geocodificación gratuita (Nominatim / OpenStreetMap). Sin API key; la política
  // de uso pide identificar la app con un User-Agent y no abusar (<= 1 req/s).
  geo: {
    nominatimUrl: process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org',
    userAgent: process.env.GEOCODER_USER_AGENT ?? 'calidad-aire-poc/0.1 (proyecto academico UAI)',
  },
  // Meses de histórico horario que genera el seed por cada par estación-contaminante.
  seedMeses: Number(process.env.SEED_MESES ?? 3),
};
