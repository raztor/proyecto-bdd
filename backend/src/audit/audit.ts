import { getDb } from '../db/mongo';

// Toda operación CRUD del sistema se registra como un documento de auditoría
// en MongoDB (dato transaccional), según el requisito del proyecto.
export type Operacion = 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE';

export interface AuditEntry {
  operacion: Operacion;
  tabla: string;
  usuario?: string;
  payload?: unknown;
  resultado: 'ok' | 'error';
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await getDb().collection('auditoria').insertOne({
      operacion: entry.operacion,
      tabla: entry.tabla,
      usuario: entry.usuario ?? 'anon',
      timestamp: new Date(),
      payload: entry.payload ?? null,
      resultado: entry.resultado,
    });
  } catch (err) {
    // La auditoría nunca debe romper la operación principal del usuario.
    console.error('[audit] no se pudo registrar la operación:', err);
  }
}
