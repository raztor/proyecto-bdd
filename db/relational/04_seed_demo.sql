--  Seed declarativo de mediciones para garantizar el cumplimiento del requisito
--  "Todas las bases de datos deben tener en alguna de sus tablas al menos 1.000
--  registros" sin depender del seed del backend.
--
--  Se ejecuta una sola vez al crear el volumen de PostgreSQL
--  (montado en /docker-entrypoint-initdb.d, después de 03_traducciones.sql).
--  Es idempotente: el índice único sobre (estacion_id, contaminante_id,
--  fecha_hora) evita duplicar filas si el script vuelve a correr.
--
--  Volumen estimado con los catálogos actuales:
--      pares (estacion x contaminante) = 36
--      horas = 7 dias * 24 = 168
--      filas insertadas ≈ 36 * 168 = 6.048  (>> 1.000)
--
--  Los valores son sintéticos y deterministas-por-perfil (baseline por
--  contaminante + ruido acotado). NO sustituyen al seed completo del backend,
--  que genera un histórico horario con estacionalidad y episodios; solo
--  garantizan volumen mínimo para evaluación.

INSERT INTO medicion (estacion_id, contaminante_id, fecha_hora, valor, validado)
SELECT
    ec.estacion_id,
    ec.contaminante_id,
    ts,
    ROUND(
        (CASE c.codigo
            WHEN 'PM25' THEN 22 + random() * 30
            WHEN 'PM10' THEN 55 + random() * 45
            WHEN 'O3'   THEN 45 + random() * 35
            WHEN 'NO2'  THEN 38 + random() * 20
            WHEN 'SO2'  THEN  9 + random() *  8
            WHEN 'CO'   THEN  0.8 + random() * 1.2
            ELSE 10
         END)::numeric,
        2
    ) AS valor,
    TRUE AS validado
FROM estacion_contaminante ec
JOIN contaminante c ON c.id = ec.contaminante_id
CROSS JOIN generate_series(
    date_trunc('hour', now() - interval '7 days'),
    date_trunc('hour', now()),
    interval '1 hour'
) AS ts
WHERE ec.activo = TRUE
ON CONFLICT (estacion_id, contaminante_id, fecha_hora) DO NOTHING;

--  Reportes ciudadanos sintéticos: pequeño volumen para que los formularios del
--  POC tengan contexto inicial. No es la tabla "grande" del proyecto.
INSERT INTO reporte_ciudadano (comuna_id, fecha_hora, nivel_percibido)
SELECT
    co.id,
    now() - (random() * interval '7 days'),
    1 + (floor(random() * 5))::smallint
FROM comuna co
CROSS JOIN generate_series(1, 5) AS n;
