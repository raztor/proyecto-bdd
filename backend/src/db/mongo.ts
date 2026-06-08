import { MongoClient, Db } from 'mongodb';
import { config } from '../config';

// Conexión a MongoDB (base de datos no relacional / log de auditoría).
let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongo.url);
  await client.connect();
  db = client.db(config.mongo.db);
  // Índice para consultar la auditoría por tabla y fecha descendente.
  await db.collection('auditoria').createIndex({ tabla: 1, timestamp: -1 });
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('MongoDB no inicializado: llama a connectMongo() primero.');
  return db;
}

export async function closeMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
