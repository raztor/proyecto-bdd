--  Datos de catálogo (referencia) — se cargan al crear el contenedor.
--  Datos DETERMINISTAS y reutilizables. Las mediciones (volumen, 1.000+) y los
--  documentos de auditoría se generan aparte con el seed (backend, Faker).
--
--  Todos los INSERT usan ON CONFLICT DO NOTHING para ser idempotentes y las FK
--  se resuelven por clave natural (subconsultas), sin asumir valores de id.

-- ── Idiomas (i18n) ──────────────────────────────────────────────────────────
INSERT INTO idioma (codigo, nombre) VALUES
    ('es', 'Español'),
    ('en', 'English')
ON CONFLICT (codigo) DO NOTHING;

-- ── Unidades de medida ──────────────────────────────────────────────────────
INSERT INTO unidad_medida (simbolo) VALUES
    ('µg/m³'),
    ('mg/m³')
ON CONFLICT (simbolo) DO NOTHING;

-- ── Contaminantes ───────────────────────────────────────────────────────────
INSERT INTO contaminante (unidad_id, codigo)
SELECT u.id, v.codigo
FROM (VALUES
    ('PM25', 'µg/m³'),
    ('PM10', 'µg/m³'),
    ('O3',   'µg/m³'),
    ('NO2',  'µg/m³'),
    ('SO2',  'µg/m³'),
    ('CO',   'mg/m³')
) AS v(codigo, simbolo)
JOIN unidad_medida u ON u.simbolo = v.simbolo
ON CONFLICT (codigo) DO NOTHING;

-- ── Categorías de calidad del aire (tramos por contaminante) ───────────────
--  PM2.5 y PM10 usan los cortes de calidad del aire publicados por el MMA para
--  Gestion de Episodios Criticos. Los gases se mantienen como categorias
--  operacionales de referencia para no mezclar su escala con el indicador
--  principal ODS 11.6.2, centrado en material particulado.
--
--  Los tramos se expresan como `numrange` semi-abiertos `[min, max)`. El tope
--  superior usa 'infinity' (numérico) para evitar el sentinel 9999.99.
INSERT INTO categoria_calidad (contaminante_id, codigo, rango, color_hex)
SELECT c.id, v.codigo, numrange(v.vmin, v.vmax, '[)'), v.color
FROM (VALUES
    -- PM2.5 (concentración 24 h, µg/m³)
    ('PM25', 'BUENA',          0.00::numeric,   50.00::numeric, '#00E400'),
    ('PM25', 'REGULAR',       50.00::numeric,   80.00::numeric, '#FFFF00'),
    ('PM25', 'ALERTA',        80.00::numeric,  110.00::numeric, '#FF7E00'),
    ('PM25', 'PREEMERGENCIA',110.00::numeric,  170.00::numeric, '#FF0000'),
    ('PM25', 'EMERGENCIA',   170.00::numeric, 'infinity'::numeric, '#8F3F97'),
    -- PM10 (concentración 24 h, µg/m³)
    ('PM10', 'BUENA',          0.00::numeric,  130.00::numeric, '#00E400'),
    ('PM10', 'REGULAR',      130.00::numeric,  180.00::numeric, '#FFFF00'),
    ('PM10', 'ALERTA',       180.00::numeric,  230.00::numeric, '#FF7E00'),
    ('PM10', 'PREEMERGENCIA',230.00::numeric,  330.00::numeric, '#FF0000'),
    ('PM10', 'EMERGENCIA',   330.00::numeric, 'infinity'::numeric, '#8F3F97'),
    -- O3 (referencia operacional)
    ('O3',   'BUENA',          0.00::numeric,  100.00::numeric, '#00E400'),
    ('O3',   'REGULAR',      100.00::numeric,  160.00::numeric, '#FFFF00'),
    ('O3',   'ALERTA',       160.00::numeric, 'infinity'::numeric, '#FF7E00'),
    -- NO2 (referencia operacional)
    ('NO2',  'BUENA',          0.00::numeric,  100.00::numeric, '#00E400'),
    ('NO2',  'REGULAR',      100.00::numeric,  200.00::numeric, '#FFFF00'),
    ('NO2',  'ALERTA',       200.00::numeric, 'infinity'::numeric, '#FF7E00'),
    -- SO2 (referencia operacional)
    ('SO2',  'BUENA',          0.00::numeric,  125.00::numeric, '#00E400'),
    ('SO2',  'REGULAR',      125.00::numeric,  200.00::numeric, '#FFFF00'),
    ('SO2',  'ALERTA',       200.00::numeric, 'infinity'::numeric, '#FF7E00'),
    -- CO (referencia operacional, mg/m³)
    ('CO',   'BUENA',          0.00::numeric,    9.00::numeric, '#00E400'),
    ('CO',   'REGULAR',        9.00::numeric,   15.00::numeric, '#FFFF00'),
    ('CO',   'ALERTA',        15.00::numeric, 'infinity'::numeric, '#FF7E00')
) AS v(cont, codigo, vmin, vmax, color)
JOIN contaminante c ON c.codigo = v.cont
ON CONFLICT (contaminante_id, codigo) DO NOTHING;

-- ── Regiones y comunas (Región Metropolitana) ───────────────────────────────
INSERT INTO region (codigo) VALUES ('RM')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO comuna (region_id, nombre, poblacion)
SELECT r.id, v.nombre, v.poblacion
FROM region r
CROSS JOIN (VALUES
    ('Santiago',      404495),
    ('Puente Alto',   568106),
    ('Maipú',         521627),
    ('La Florida',    366916),
    ('Las Condes',    294838),
    ('Pudahuel',      230293),
    ('Independencia', 100281),
    ('Cerrillos',      80832),
    ('El Bosque',     162505),
    ('Cerro Navia',   132622),
    ('Providencia',   142079),
    ('Quilicura',     210410)
) AS v(nombre, poblacion)
WHERE r.codigo = 'RM'
ON CONFLICT (region_id, nombre) DO NOTHING;

-- ── Estaciones base (red SINCA en la RM; coordenadas aproximadas) ────────────
INSERT INTO estacion (comuna_id, nombre, latitud, longitud, fecha_instalacion)
SELECT co.id, v.nombre, v.lat, v.lon, v.fecha
FROM (VALUES
    ('Independencia', 'Independencia',  -33.422000, -70.651000, DATE '2008-01-01'),
    ('La Florida',    'La Florida',     -33.516700, -70.588300, DATE '2008-01-01'),
    ('Las Condes',    'Las Condes',     -33.376700, -70.523300, DATE '2008-01-01'),
    ('Santiago',      'Parque OHiggins',-33.464200, -70.660800, DATE '2008-01-01'),
    ('Pudahuel',      'Pudahuel',       -33.436700, -70.750000, DATE '2009-01-01'),
    ('Cerrillos',     'Cerrillos',      -33.495000, -70.704200, DATE '2010-01-01'),
    ('El Bosque',     'El Bosque',      -33.546700, -70.666700, DATE '2010-01-01'),
    ('Cerro Navia',   'Cerro Navia',    -33.432500, -70.732500, DATE '2011-01-01'),
    ('Puente Alto',   'Puente Alto',    -33.578300, -70.583300, DATE '2012-01-01'),
    ('Quilicura',     'Quilicura',      -33.353300, -70.728300, DATE '2014-01-01')
) AS v(comuna, nombre, lat, lon, fecha)
JOIN comuna co ON co.nombre = v.comuna
ON CONFLICT (nombre) DO NOTHING;

-- ── Puente estación-contaminante ─────────────────────────────────────────────
-- Todas las estaciones miden PM2.5 y PM10 (foco del indicador 11.6.2).
INSERT INTO estacion_contaminante (estacion_id, contaminante_id, activo)
SELECT e.id, c.id, TRUE
FROM estacion e
CROSS JOIN contaminante c
WHERE c.codigo IN ('PM25', 'PM10')
ON CONFLICT (estacion_id, contaminante_id) DO NOTHING;

-- Algunas estaciones "completas" miden además gases.
INSERT INTO estacion_contaminante (estacion_id, contaminante_id, activo)
SELECT e.id, c.id, TRUE
FROM estacion e
CROSS JOIN contaminante c
WHERE e.nombre IN ('Independencia', 'Las Condes', 'Pudahuel', 'La Florida')
  AND c.codigo IN ('O3', 'NO2', 'SO2', 'CO')
ON CONFLICT (estacion_id, contaminante_id) DO NOTHING;
