--  Estado actual de cada estación (versión CLI del endpoint /api/estaciones/estado):
--  última medición por contaminante, clasificada en su categoría de calidad.
--  Uso:
--      docker exec -i calidad_aire_pg \
--        psql -U calidad_app -d calidad_aire < db/maintenance/estado_estaciones.sql

WITH ultima AS (
  SELECT DISTINCT ON (estacion_id, contaminante_id)
         estacion_id, contaminante_id, valor, fecha_hora
    FROM medicion
   ORDER BY estacion_id, contaminante_id, fecha_hora DESC
)
SELECT e.nombre AS estacion,
       co.nombre AS comuna,
       c.codigo  AS contaminante,
       ul.valor,
       u.simbolo AS unidad,
       to_char(ul.fecha_hora, 'YYYY-MM-DD HH24:MI') AS ultima_medicion,
       COALESCE(cat.codigo, '—') AS categoria
  FROM ultima ul
  JOIN estacion e      ON e.id  = ul.estacion_id
  JOIN comuna co       ON co.id = e.comuna_id
  JOIN contaminante c  ON c.id  = ul.contaminante_id
  JOIN unidad_medida u ON u.id  = c.unidad_id
  LEFT JOIN categoria_calidad cat
         ON cat.contaminante_id = c.id AND cat.rango @> ul.valor::numeric
 ORDER BY e.nombre, c.codigo;
