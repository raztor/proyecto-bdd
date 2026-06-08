import { config } from './config';
import { createApp } from './app';
import { connectMongo } from './db/mongo';
import { pool } from './db/postgres';

async function main() {
  await connectMongo(); // inicializa la auditoría (MongoDB)
  await pool.query('SELECT 1'); // verifica la conexión a PostgreSQL

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API escuchando en  http://localhost:${config.port}/api`);
    console.log(`Swagger UI en       http://localhost:${config.port}/api/docs`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
