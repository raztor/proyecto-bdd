import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { buildOpenApiDocument } from './openapi';
import { catalogosRouter } from './routes/catalogos';
import { estacionesRouter } from './routes/estaciones';
import { reportesRouter } from './routes/reportes';
import { dashboardRouter } from './routes/dashboard';
import { graficosRouter } from './routes/graficos';
import { importacionRouter } from './routes/importacion';
import { geoRouter } from './routes/geo';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', catalogosRouter);
  app.use('/api', geoRouter);
  app.use('/api/estaciones', estacionesRouter);
  app.use('/api/reportes', reportesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/graficos', graficosRouter);
  app.use('/api/importacion', importacionRouter);

  // Documentación OpenAPI / Swagger.
  const openapiDoc = buildOpenApiDocument();
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapiDoc);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));

  return app;
}
