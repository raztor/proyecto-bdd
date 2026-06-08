import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  RegistrarEstacionBody,
  ReporteCiudadanoBody,
  DashboardQuery,
  BuscarOpenAqQuery,
  ImportarEstacionesBody,
  ImportarMedicionesBody,
} from './schemas';

// Construye el documento OpenAPI 3.0 a partir de los esquemas Zod.
// Se sirve con Swagger UI en /api/docs y como JSON en /api/openapi.json.
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: 'get',
    path: '/api/comunas',
    tags: ['Catálogos'],
    summary: 'Lista de comunas (para los selects de los formularios).',
    responses: { 200: { description: 'Listado de comunas' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/contaminantes',
    tags: ['Catálogos'],
    summary: 'Lista de contaminantes con su nombre traducido.',
    request: { query: z.object({ idioma: z.string().optional() }) },
    responses: { 200: { description: 'Listado de contaminantes' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/geocodificar',
    tags: ['Catálogos'],
    summary: 'Busca coordenadas de un lugar (Nominatim/OpenStreetMap, gratis y sin API key).',
    request: { query: z.object({ q: z.string() }) },
    responses: { 200: { description: 'Lugares con lat/lon' }, 400: { description: 'Consulta muy corta' } },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/estaciones',
    tags: ['Formularios'],
    summary: 'Formulario A — registrar estación (INSERT en ESTACION y ESTACION_CONTAMINANTE).',
    request: {
      body: { content: { 'application/json': { schema: RegistrarEstacionBody } } },
    },
    responses: {
      201: { description: 'Estación registrada' },
      400: { description: 'Datos inválidos / FK inexistente' },
      409: { description: 'Ya existe una estación con ese nombre' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/reportes',
    tags: ['Formularios'],
    summary: 'Formulario B — reporte ciudadano de calidad percibida (INSERT simple).',
    request: {
      body: { content: { 'application/json': { schema: ReporteCiudadanoBody } } },
    },
    responses: {
      201: { description: 'Reporte registrado' },
      400: { description: 'Datos inválidos / FK inexistente' },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/dashboard',
    tags: ['Dashboard'],
    summary:
      'Indicador 11.6.2 — AVG(valor) por comuna y contaminante, clasificado en su categoría de calidad. Filtros: comuna, contaminante y rango de fechas.',
    request: { query: DashboardQuery },
    responses: { 200: { description: 'Promedios clasificados por categoría' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/importacion/buscar',
    tags: ['Importación'],
    summary: 'Previsualiza estaciones de OpenAQ por id, bbox o coordenadas+radio (no escribe en la BD).',
    request: { query: BuscarOpenAqQuery },
    responses: {
      200: { description: 'Estaciones encontradas en OpenAQ' },
      503: { description: 'OPENAQ_API_KEY no configurada' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/importacion/importar',
    tags: ['Importación'],
    summary: 'Importa estaciones de OpenAQ a la BD (ESTACION + COMUNA + ESTACION_CONTAMINANTE).',
    request: {
      body: { content: { 'application/json': { schema: ImportarEstacionesBody } } },
    },
    responses: {
      201: { description: 'Resultado de la importación' },
      404: { description: 'Sin estaciones para esos criterios' },
      503: { description: 'OPENAQ_API_KEY no configurada' },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/importacion/mediciones',
    tags: ['Importación'],
    summary: 'Trae las últimas mediciones de OpenAQ para las estaciones indicadas y las guarda en MEDICION.',
    request: {
      body: { content: { 'application/json': { schema: ImportarMedicionesBody } } },
    },
    responses: {
      201: { description: 'Resultado de la carga de mediciones' },
      503: { description: 'OPENAQ_API_KEY no configurada' },
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'API Calidad del Aire — ODS 11.6.2',
      version: '0.1.0',
      description:
        'POC para el monitoreo de material particulado (PM2.5/PM10) en comunas del Gran Santiago. ' +
        'Calcula el indicador (promedio de concentración por comuna/contaminante) y lo clasifica en categorías de salud.',
    },
    servers: [{ url: 'http://localhost:3000' }],
  });
}
