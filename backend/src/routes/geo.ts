import { Router } from 'express';
import { geocodificar } from '../geo/nominatim';

// Geocodificación de lugares (gratis, sin API key) para el buscador de ubicación.
export const geoRouter = Router();

// GET /api/geocodificar?q=Providencia
geoRouter.get('/geocodificar', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) {
    res.status(400).json({ error: 'Escribe al menos 3 caracteres' });
    return;
  }
  try {
    const resultados = await geocodificar(q);
    res.json(resultados);
  } catch (err) {
    console.error('[geo] error:', err);
    res.status(502).json({ error: 'No se pudo geocodificar la ubicación' });
  }
});
