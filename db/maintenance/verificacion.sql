--  Verificación post-carga histórica (solo lectura).
--  Uso (zsh-safe, sin paréntesis ni globs en la línea de comando):
--      docker exec -i calidad_aire_pg \
--        psql -U calidad_app -d calidad_aire < db/maintenance/verificacion.sql

\timing off

-- 1) Volumen y rango temporal del histórico cargado.
SELECT count(*)                        AS mediciones_total,
       min(fecha_hora)::date           AS desde,
       max(fecha_hora)::date           AS hasta,
       count(DISTINCT estacion_id)     AS estaciones,
       count(DISTINCT contaminante_id) AS contaminantes
FROM medicion;

-- 2) Auditoría intacta: debe seguir = 6291 (la carga insertó 0 eventos) y el
--    trigger debe quedar habilitado ('O' = enabled).
SELECT (SELECT count(*) FROM evento_auditoria_relacional) AS eventos_audit,
       (SELECT tgenabled FROM pg_trigger
         WHERE tgname = 'trg_audit_medicion')             AS trg_estado;

-- 3) Integridad referencial: ninguna medición fuera de estacion_contaminante.
SELECT count(*) AS huerfanas
FROM medicion m
LEFT JOIN estacion_contaminante ec
  ON ec.estacion_id = m.estacion_id AND ec.contaminante_id = m.contaminante_id
WHERE ec.estacion_id IS NULL;

-- 4) Tamaño en disco (tabla + índices).
SELECT pg_size_pretty(pg_total_relation_size('medicion')) AS medicion_total,
       pg_size_pretty(pg_relation_size('medicion'))       AS solo_tabla,
       pg_size_pretty(pg_indexes_size('medicion'))        AS indices;

-- 5) Muestra de estacionalidad: promedio mensual de PM2.5 en Las Condes (2024).
--    Debe verse el peak de invierno austral (jun-ago).
SELECT date_trunc('month', m.fecha_hora)::date AS mes,
       round(avg(m.valor), 1)                  AS pm25_prom
FROM medicion m
JOIN estacion e     ON e.id = m.estacion_id
JOIN contaminante c ON c.id = m.contaminante_id
WHERE e.nombre = 'Las Condes' AND c.codigo = 'PM25'
  AND m.fecha_hora >= '2024-01-01' AND m.fecha_hora < '2025-01-01'
GROUP BY 1
ORDER BY 1;
