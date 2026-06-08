import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Habilita .openapi() en los esquemas Zod (fuente única: validación + docs).
extendZodWithOpenApi(z);

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD');

// ── Formulario A — registrar estación (INSERT en 2 tablas con FK) ────────────
export const RegistrarEstacionBody = z
  .object({
    comuna_id: z.number().int().positive().openapi({ example: 1 }),
    nombre: z.string().min(2).max(120).openapi({ example: 'Estación Las Condes 2' }),
    latitud: z.number().min(-90).max(90).openapi({ example: -33.3767 }),
    longitud: z.number().min(-180).max(180).openapi({ example: -70.5233 }),
    fecha_instalacion: fechaISO.optional().openapi({ example: '2020-05-01' }),
    contaminantes: z
      .array(z.number().int().positive())
      .min(1, 'Selecciona al menos un contaminante')
      .openapi({ example: [1, 2] }),
  })
  .openapi('RegistrarEstacion');

export type RegistrarEstacionInput = z.infer<typeof RegistrarEstacionBody>;

// ── Formulario B — reporte ciudadano (INSERT simple) ─────────────────────────
export const ReporteCiudadanoBody = z
  .object({
    comuna_id: z.number().int().positive().openapi({ example: 1 }),
    nivel_percibido: z.number().int().min(1).max(5).openapi({ example: 4 }),
    fecha_hora: z.string().datetime().optional().openapi({ example: '2026-06-07T10:00:00Z' }),
  })
  .openapi('ReporteCiudadano');

export type ReporteCiudadanoInput = z.infer<typeof ReporteCiudadanoBody>;

// ── Dashboard — filtros de la visualización (SELECT agregado) ────────────────
export const DashboardQuery = z
  .object({
    comuna_id: z.coerce.number().int().positive().optional(),
    contaminante_id: z.coerce.number().int().positive().optional(),
    desde: fechaISO.optional(),
    hasta: fechaISO.optional(),
    idioma: z.string().min(2).max(10).default('es'),
  })
  .openapi('DashboardQuery');

export type DashboardQueryInput = z.infer<typeof DashboardQuery>;

// ── Importación de estaciones desde OpenAQ ───────────────────────────────────
const bbox = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, 'Formato esperado: minLon,minLat,maxLon,maxLat');

// Búsqueda (preview): por id, por bbox o por coordenadas + radio.
export const BuscarOpenAqQuery = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    bbox: bbox.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radio: z.coerce.number().int().min(100).max(25000).optional(),
    limite: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .openapi('BuscarOpenAq');

// Importación: por ids seleccionados, o por bbox / coordenadas + radio.
export const ImportarEstacionesBody = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(100).optional(),
    bbox: bbox.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    radio: z.number().int().min(100).max(25000).optional(),
  })
  .openapi('ImportarEstaciones');

export type ImportarEstacionesInput = z.infer<typeof ImportarEstacionesBody>;

// Importación de últimas mediciones para estaciones de OpenAQ (por location id).
export const ImportarMedicionesBody = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(100),
  })
  .openapi('ImportarMediciones');
