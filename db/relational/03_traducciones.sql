--  Traducciones (i18n) — requisito: modelo relacional aplicado en >= 2 idiomas.
--  Español (es) e inglés (en) se cargan en tablas específicas con FK reales.

-- Contaminantes: nombre y descripción (es / en).
INSERT INTO contaminante_traduccion (contaminante_id, idioma_codigo, nombre, descripcion)
SELECT c.id, v.idioma, v.nombre, v.descripcion
FROM (VALUES
    ('es', 'PM25', 'Material particulado fino (PM2.5)', 'Particulas <= 2,5 um; penetran profundo en pulmones y torrente sanguineo.'),
    ('en', 'PM25', 'Fine particulate matter (PM2.5)', 'Particles <= 2.5 um; penetrate deep into lungs and bloodstream.'),

    ('es', 'PM10', 'Material particulado (PM10)', 'Particulas <= 10 um; afectan las vias respiratorias.'),
    ('en', 'PM10', 'Particulate matter (PM10)', 'Particles <= 10 um; affect the respiratory tract.'),

    ('es', 'O3',  'Ozono troposferico (O3)', 'Gas oxidante; se forma con radiacion solar a partir de precursores.'),
    ('en', 'O3',  'Ground-level ozone (O3)', 'Oxidizing gas formed under sunlight from precursors.'),

    ('es', 'NO2', 'Dioxido de nitrogeno (NO2)', 'Gas asociado principalmente a la combustion vehicular.'),
    ('en', 'NO2', 'Nitrogen dioxide (NO2)', 'Gas linked mainly to vehicle combustion.'),

    ('es', 'SO2', 'Dioxido de azufre (SO2)', 'Gas de procesos industriales y combustibles azufrados.'),
    ('en', 'SO2', 'Sulfur dioxide (SO2)', 'Gas from industrial processes and sulfur-rich fuels.'),

    ('es', 'CO',  'Monoxido de carbono (CO)', 'Gas producto de la combustion incompleta.'),
    ('en', 'CO',  'Carbon monoxide (CO)', 'Gas from incomplete combustion.')
) AS v(idioma, codigo, nombre, descripcion)
JOIN contaminante c ON c.codigo = v.codigo
ON CONFLICT (contaminante_id, idioma_codigo) DO NOTHING;

-- Categorías: nombre y recomendación de salud (es / en).
INSERT INTO categoria_calidad_traduccion (categoria_id, idioma_codigo, nombre, recomendacion)
SELECT cc.id, v.idioma, v.nombre, v.recomendacion
FROM categoria_calidad cc
JOIN (VALUES
    ('es', 'BUENA',         'Buena',          'Calidad del aire satisfactoria; sin riesgo para la poblacion.'),
    ('es', 'REGULAR',       'Regular',        'Aceptable; grupos sensibles deberian moderar el esfuerzo prolongado al aire libre.'),
    ('es', 'ALERTA',        'Alerta',         'Grupos sensibles pueden experimentar efectos; reducir la actividad fisica exterior.'),
    ('es', 'PREEMERGENCIA', 'Preemergencia',  'Efectos en la salud de la poblacion; evitar la actividad fisica al aire libre.'),
    ('es', 'EMERGENCIA',    'Emergencia',     'Riesgo grave para toda la poblacion; permanecer en interiores y seguir a la autoridad.'),
    ('en', 'BUENA',         'Good',           'Air quality is satisfactory; no risk to the population.'),
    ('en', 'REGULAR',       'Moderate',       'Acceptable; sensitive groups should limit prolonged outdoor exertion.'),
    ('en', 'ALERTA',        'Alert',          'Sensitive groups may experience effects; reduce outdoor physical activity.'),
    ('en', 'PREEMERGENCIA', 'Pre-emergency',  'Health effects for the general population; avoid outdoor physical activity.'),
    ('en', 'EMERGENCIA',    'Emergency',      'Serious risk for the whole population; stay indoors and follow authorities.')
) AS v(idioma, codigo, nombre, recomendacion) ON v.codigo = cc.codigo
ON CONFLICT (categoria_id, idioma_codigo) DO NOTHING;
