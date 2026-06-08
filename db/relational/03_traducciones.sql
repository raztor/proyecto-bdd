--  Traducciones (i18n) — requisito: modelo relacional aplicado en >= 2 idiomas.
--  Se cargan español (es) e inglés (en) para los textos visibles al usuario:
--  nombre y descripción de cada contaminante, y nombre + recomendación de cada
--  categoría de calidad del aire.
--
--  Las FK lógicas (entidad_id) se resuelven por clave natural para no depender
--  de los valores concretos de id generados por IDENTITY.

-- ── Contaminantes: nombre y descripción (es / en) ────────────────────────────
INSERT INTO traduccion (idioma_codigo, entidad, entidad_id, campo, texto)
SELECT v.idioma, 'contaminante', c.id, v.campo, v.texto
FROM (VALUES
    ('es', 'PM25', 'nombre',      'Material particulado fino (PM2.5)'),
    ('es', 'PM25', 'descripcion', 'Partículas ≤ 2,5 µm; penetran profundo en pulmones y torrente sanguíneo.'),
    ('en', 'PM25', 'nombre',      'Fine particulate matter (PM2.5)'),
    ('en', 'PM25', 'descripcion', 'Particles ≤ 2.5 µm; penetrate deep into lungs and bloodstream.'),

    ('es', 'PM10', 'nombre',      'Material particulado (PM10)'),
    ('es', 'PM10', 'descripcion', 'Partículas ≤ 10 µm; afectan las vías respiratorias.'),
    ('en', 'PM10', 'nombre',      'Particulate matter (PM10)'),
    ('en', 'PM10', 'descripcion', 'Particles ≤ 10 µm; affect the respiratory tract.'),

    ('es', 'O3',  'nombre',      'Ozono troposférico (O₃)'),
    ('es', 'O3',  'descripcion', 'Gas oxidante; se forma con radiación solar a partir de precursores.'),
    ('en', 'O3',  'nombre',      'Ground-level ozone (O₃)'),
    ('en', 'O3',  'descripcion', 'Oxidizing gas formed under sunlight from precursors.'),

    ('es', 'NO2', 'nombre',      'Dióxido de nitrógeno (NO₂)'),
    ('es', 'NO2', 'descripcion', 'Gas asociado principalmente a la combustión vehicular.'),
    ('en', 'NO2', 'nombre',      'Nitrogen dioxide (NO₂)'),
    ('en', 'NO2', 'descripcion', 'Gas linked mainly to vehicle combustion.'),

    ('es', 'SO2', 'nombre',      'Dióxido de azufre (SO₂)'),
    ('es', 'SO2', 'descripcion', 'Gas de procesos industriales y combustibles azufrados.'),
    ('en', 'SO2', 'nombre',      'Sulfur dioxide (SO₂)'),
    ('en', 'SO2', 'descripcion', 'Gas from industrial processes and sulfur-rich fuels.'),

    ('es', 'CO',  'nombre',      'Monóxido de carbono (CO)'),
    ('es', 'CO',  'descripcion', 'Gas producto de la combustión incompleta.'),
    ('en', 'CO',  'nombre',      'Carbon monoxide (CO)'),
    ('en', 'CO',  'descripcion', 'Gas from incomplete combustion.')
) AS v(idioma, cont, campo, texto)
JOIN contaminante c ON c.codigo = v.cont
ON CONFLICT (entidad, entidad_id, idioma_codigo, campo) DO NOTHING;

-- ── Categorías: nombre (es / en) ─────────────────────────────────────────────
-- Mismas etiquetas para todas las filas que comparten 'codigo' (una por
-- contaminante), generadas por JOIN para no escribir decenas de filas a mano.
INSERT INTO traduccion (idioma_codigo, entidad, entidad_id, campo, texto)
SELECT v.idioma, 'categoria_calidad', cc.id, 'nombre', v.texto
FROM categoria_calidad cc
JOIN (VALUES
    ('es', 'BUENA',         'Buena'),
    ('es', 'REGULAR',       'Regular'),
    ('es', 'ALERTA',        'Alerta'),
    ('es', 'PREEMERGENCIA', 'Preemergencia'),
    ('es', 'EMERGENCIA',    'Emergencia'),
    ('en', 'BUENA',         'Good'),
    ('en', 'REGULAR',       'Moderate'),
    ('en', 'ALERTA',        'Alert'),
    ('en', 'PREEMERGENCIA', 'Pre-emergency'),
    ('en', 'EMERGENCIA',    'Emergency')
) AS v(idioma, codigo, texto) ON v.codigo = cc.codigo
ON CONFLICT (entidad, entidad_id, idioma_codigo, campo) DO NOTHING;

-- ── Categorías: recomendación de salud (es / en) ─────────────────────────────
INSERT INTO traduccion (idioma_codigo, entidad, entidad_id, campo, texto)
SELECT v.idioma, 'categoria_calidad', cc.id, 'recomendacion', v.texto
FROM categoria_calidad cc
JOIN (VALUES
    ('es', 'BUENA',         'Calidad del aire satisfactoria; sin riesgo para la población.'),
    ('es', 'REGULAR',       'Aceptable; grupos sensibles deberían moderar el esfuerzo prolongado al aire libre.'),
    ('es', 'ALERTA',        'Grupos sensibles pueden experimentar efectos; reducir la actividad física exterior.'),
    ('es', 'PREEMERGENCIA', 'Efectos en la salud de la población; evitar la actividad física al aire libre.'),
    ('es', 'EMERGENCIA',    'Riesgo grave para toda la población; permanecer en interiores y seguir a la autoridad.'),
    ('en', 'BUENA',         'Air quality is satisfactory; no risk to the population.'),
    ('en', 'REGULAR',       'Acceptable; sensitive groups should limit prolonged outdoor exertion.'),
    ('en', 'ALERTA',        'Sensitive groups may experience effects; reduce outdoor physical activity.'),
    ('en', 'PREEMERGENCIA', 'Health effects for the general population; avoid outdoor physical activity.'),
    ('en', 'EMERGENCIA',    'Serious risk for the whole population; stay indoors and follow authorities.')
) AS v(idioma, codigo, texto) ON v.codigo = cc.codigo
ON CONFLICT (entidad, entidad_id, idioma_codigo, campo) DO NOTHING;
