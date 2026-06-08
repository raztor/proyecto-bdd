--
--  Este script crea el esquema completo (tipos, PK, FK e índices). Se ejecuta
--  automáticamente al crear el contenedor de Postgres (montado en
--  /docker-entrypoint-initdb.d). Para re-aplicarlo: `docker compose down -v`.

-- ---------------------------------------------------------------------------
--  Dominio geográfico
-- ---------------------------------------------------------------------------
CREATE TABLE region (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo  VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE comuna (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    region_id  INTEGER NOT NULL REFERENCES region(id),
    nombre     VARCHAR(120) NOT NULL,
    poblacion  INTEGER NOT NULL CHECK (poblacion >= 0),
    UNIQUE (region_id, nombre)
);

CREATE TABLE estacion (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comuna_id         INTEGER NOT NULL REFERENCES comuna(id),
    nombre            VARCHAR(120) NOT NULL UNIQUE,
    latitud           DECIMAL(9,6) NOT NULL CHECK (latitud  BETWEEN  -90 AND  90),
    longitud          DECIMAL(9,6) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
    fecha_instalacion DATE
);

-- ---------------------------------------------------------------------------
--  Dominio de contaminantes y mediciones
-- ---------------------------------------------------------------------------
CREATE TABLE unidad_medida (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    simbolo VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE contaminante (
    id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidad_id INTEGER NOT NULL REFERENCES unidad_medida(id),
    codigo    VARCHAR(20) NOT NULL UNIQUE          -- PM25, PM10, O3, NO2, SO2, CO
);

-- Puente N:M — qué contaminantes mide cada estación.
CREATE TABLE estacion_contaminante (
    estacion_id     INTEGER NOT NULL REFERENCES estacion(id)     ON DELETE CASCADE,
    contaminante_id INTEGER NOT NULL REFERENCES contaminante(id),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (estacion_id, contaminante_id)
);

-- TABLA GRANDE — mediciones horarias (>= 1.000 registros, cargados por el seed).
CREATE TABLE medicion (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estacion_id     INTEGER  NOT NULL REFERENCES estacion(id),
    contaminante_id INTEGER  NOT NULL REFERENCES contaminante(id),
    fecha_hora      TIMESTAMP NOT NULL,
    valor           DECIMAL(8,2) NOT NULL CHECK (valor >= 0),
    validado        BOOLEAN  NOT NULL DEFAULT TRUE
);

-- Índice compuesto y ÚNICO: es el patrón de filtrado/agregación del dashboard
-- (filtra por estación + contaminante y agrega por rango de fecha_hora) y además
-- garantiza una sola medición por (estación, contaminante, instante), lo que
-- permite el upsert idempotente del importador/collector de OpenAQ.
CREATE UNIQUE INDEX idx_medicion_est_cont_fecha
    ON medicion (estacion_id, contaminante_id, fecha_hora);

-- ---------------------------------------------------------------------------
--  Clasificación de calidad del aire y episodios críticos
-- ---------------------------------------------------------------------------
CREATE TABLE categoria_calidad (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contaminante_id INTEGER NOT NULL REFERENCES contaminante(id),
    codigo          VARCHAR(20)  NOT NULL,   -- BUENA, REGULAR, ALERTA, PREEMERGENCIA, EMERGENCIA
    valor_min       DECIMAL(8,2) NOT NULL,
    valor_max       DECIMAL(8,2) NOT NULL,
    color_hex       VARCHAR(7)   NOT NULL,
    CHECK (valor_max >= valor_min),
    UNIQUE (contaminante_id, codigo)
);

CREATE TABLE episodio (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comuna_id    INTEGER NOT NULL REFERENCES comuna(id),
    categoria_id INTEGER NOT NULL REFERENCES categoria_calidad(id),
    fecha        DATE    NOT NULL,
    UNIQUE (comuna_id, fecha)
);

-- Puente N:M — estaciones involucradas en un episodio y su promedio.
CREATE TABLE episodio_estacion (
    episodio_id    INTEGER NOT NULL REFERENCES episodio(id) ON DELETE CASCADE,
    estacion_id    INTEGER NOT NULL REFERENCES estacion(id),
    valor_promedio DECIMAL(8,2) NOT NULL CHECK (valor_promedio >= 0),
    PRIMARY KEY (episodio_id, estacion_id)
);

-- ---------------------------------------------------------------------------
--  Participación ciudadana
-- ---------------------------------------------------------------------------
CREATE TABLE reporte_ciudadano (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comuna_id       INTEGER   NOT NULL REFERENCES comuna(id),
    fecha_hora      TIMESTAMP NOT NULL DEFAULT now(),
    nivel_percibido SMALLINT  NOT NULL CHECK (nivel_percibido BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------------
--  Internacionalización (i18n) — textos visibles al usuario
-- ---------------------------------------------------------------------------
CREATE TABLE idioma (
    codigo VARCHAR(10) PRIMARY KEY,    -- 'es', 'en'
    nombre VARCHAR(60) NOT NULL
);

-- Traducciones genéricas: cualquier (entidad, fila, campo) en cualquier idioma.
-- p.ej. ('contaminante', 1, 'nombre', 'es') -> 'Material particulado fino'.
CREATE TABLE traduccion (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idioma_codigo VARCHAR(10) NOT NULL REFERENCES idioma(codigo),
    entidad       VARCHAR(40) NOT NULL,   -- 'contaminante', 'categoria_calidad', ...
    entidad_id    INTEGER     NOT NULL,   -- id de la fila traducida
    campo         VARCHAR(40) NOT NULL,   -- 'nombre', 'descripcion', 'recomendacion'
    texto         TEXT        NOT NULL,
    UNIQUE (entidad, entidad_id, idioma_codigo, campo)
);
