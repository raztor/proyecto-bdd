import { Pool, QueryResultRow } from 'pg';
import { config } from '../config';

// Pool de conexiones a PostgreSQL (base de datos relacional).
export const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
  max: 10,
});

// Helper delgado para consultas parametrizadas (evita inyección SQL).
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params as unknown[]);
}
