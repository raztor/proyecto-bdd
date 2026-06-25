--  Carga histórica masiva de MEDICION (datos sintéticos, server-side).
--  ---------------------------------------------------------------------------
--  Objetivo: poblar la tabla grande con millones de mediciones horarias de las
--  estaciones de la red SINCA en la RM (Santiago) de la forma más rápida:
--  generación dentro de Postgres con `generate_series` (sin cliente, sin red,
--  sin CSV) e `INSERT ... SELECT`.
--
--  NO se ejecuta en el init automático (vive en db/maintenance, no en
--  db/relational). Ejecutar manualmente en ventana de mantenimiento:
--
--      docker exec -i calidad_aire_pg \
--        psql -v ON_ERROR_STOP=1 -U calidad_app -d calidad_aire \
--        < db/maintenance/carga_historica.sql
--
--  Volumen ≈ pares(estacion×contaminante activos) × horas, acotado por la
--  fecha_instalacion de cada estación. Con 36 pares y ventana de 16 años da
--  ~5 millones de filas. Ajustar la ventana en el `generate_series`.
--
--  Rendimiento — claves para esta carga:
--    1. Se DESACTIVA el trigger de auditoría fila-por-fila (trg_audit_medicion).
--       Con él activo, cada fila insertada generaría un INSERT de JSONB en
--       evento_auditoria_relacional (5-10x más lento + millones de eventos
--       basura pendientes de Mongo). Datos históricos != evento de auditoría.
--    2. Todo en una transacción, con synchronous_commit local desactivado.
--    3. ON CONFLICT DO NOTHING para ser idempotente: la ventana solapa los
--       últimos 7 días que ya carga el seed demo (04_seed_demo.sql) y permite
--       re-ejecutar el script sin error. El costo es bajo: la verificación del
--       índice único ocurre igual en cada inserción.

\timing on

BEGIN;

SET LOCAL synchronous_commit = off;

-- 1) Desactivar la auditoría fila-por-fila (CRÍTICO para el rendimiento).
ALTER TABLE medicion DISABLE TRIGGER trg_audit_medicion;

-- 2) Generar el histórico horario con estacionalidad de invierno austral y
--    ciclo diario. Solo desde la fecha_instalacion de cada estación.
INSERT INTO medicion (estacion_id, contaminante_id, fecha_hora, valor, validado)
SELECT
    ec.estacion_id,
    ec.contaminante_id,
    ts,
    GREATEST(0, ROUND((
        (CASE c.codigo
            WHEN 'PM25' THEN 22 + random() * 30
            WHEN 'PM10' THEN 55 + random() * 45
            WHEN 'O3'   THEN 45 + random() * 35
            WHEN 'NO2'  THEN 38 + random() * 20
            WHEN 'SO2'  THEN  9 + random() *  8
            WHEN 'CO'   THEN  0.8 + random() * 1.2
            ELSE 10
         END)
        -- Estacionalidad: peak en pleno invierno (~día 196, mediados de julio).
        -- Más marcada en material particulado que en gases.
        * (1 + (CASE WHEN c.codigo IN ('PM25','PM10') THEN 0.7 ELSE 0.2 END)
               * cos(2 * pi() * (extract(doy FROM ts) - 196) / 365.0))
        -- Ciclo diario: peaks en punta mañana/noche.
        * (1 + 0.15 * cos(2 * pi() * (extract(hour FROM ts) - 8) / 24.0))
    )::numeric, 2)) AS valor,
    TRUE AS validado
FROM estacion_contaminante ec
JOIN contaminante c ON c.id = ec.contaminante_id
JOIN estacion     e ON e.id = ec.estacion_id
CROSS JOIN generate_series(
    date_trunc('hour', now() - interval '16 years'),  -- ← ventana ajustable
    date_trunc('hour', now()),
    interval '1 hour'
) AS ts
WHERE ec.activo = TRUE
  AND ts >= COALESCE(e.fecha_instalacion::timestamp, ts)
ON CONFLICT (estacion_id, contaminante_id, fecha_hora) DO NOTHING;

-- 3) Reactivar la auditoría.
ALTER TABLE medicion ENABLE TRIGGER trg_audit_medicion;

COMMIT;

-- 4) Refrescar estadísticas del planificador tras la carga masiva.
ANALYZE medicion;
