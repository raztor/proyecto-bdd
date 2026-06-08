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
    fecha_instalacion DATE,
    UNIQUE (id, comuna_id)
);

-- ---------------------------------------------------------------------------
--  Dominio de contaminantes y mediciones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

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
    estacion_id     INTEGER  NOT NULL,
    contaminante_id INTEGER  NOT NULL,
    fecha_hora      TIMESTAMP NOT NULL,
    valor           DECIMAL(8,2) NOT NULL CHECK (valor >= 0),
    validado        BOOLEAN  NOT NULL DEFAULT TRUE,
    FOREIGN KEY (estacion_id, contaminante_id)
        REFERENCES estacion_contaminante(estacion_id, contaminante_id)
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
--  Tramos de calidad del aire por contaminante.
--
--  El rango se modela con el tipo nativo `numrange` de PostgreSQL en lugar de
--  dos columnas (valor_min, valor_max) con un sentinel "9999.99" para
--  representar el extremo abierto. Ventajas:
--    - el extremo superior abierto se expresa con 'infinity' real, no con un
--      magic number;
--    - la operación de pertenencia es nativa: `rango @> p.promedio::numeric`;
--    - el `EXCLUDE USING gist` opera directamente sobre el tipo, sin
--      construir el rango en cada inserción.
--
--  Convención: se usan rangos semi-abiertos `[min, max)`. Así dos tramos
--  consecutivos comparten el extremo sin solaparse: `[0,50)` y `[50,80)` son
--  válidos en el `EXCLUDE` y un valor de 50 cae en el segundo tramo.
CREATE TABLE categoria_calidad (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contaminante_id INTEGER NOT NULL REFERENCES contaminante(id),
    codigo          VARCHAR(20)  NOT NULL,   -- BUENA, REGULAR, ALERTA, PREEMERGENCIA, EMERGENCIA
    rango           numrange     NOT NULL,
    color_hex       VARCHAR(7)   NOT NULL,
    CHECK (NOT isempty(rango)),
    CHECK (lower(rango) IS NOT NULL AND lower(rango) >= 0),
    CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
    UNIQUE (contaminante_id, codigo),
    UNIQUE (contaminante_id, id),
    EXCLUDE USING gist (
        contaminante_id WITH =,
        rango WITH &&
    )
);

CREATE TABLE episodio (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comuna_id       INTEGER NOT NULL REFERENCES comuna(id),
    contaminante_id INTEGER NOT NULL REFERENCES contaminante(id),
    categoria_id    INTEGER NOT NULL,
    fecha           DATE    NOT NULL,
    FOREIGN KEY (contaminante_id, categoria_id)
        REFERENCES categoria_calidad(contaminante_id, id),
    UNIQUE (id, comuna_id),
    UNIQUE (comuna_id, contaminante_id, fecha)
);

-- Puente N:M — estaciones involucradas en un episodio y su promedio.
CREATE TABLE episodio_estacion (
    episodio_id    INTEGER NOT NULL REFERENCES episodio(id) ON DELETE CASCADE,
    comuna_id      INTEGER NOT NULL,
    estacion_id    INTEGER NOT NULL,
    valor_promedio DECIMAL(8,2) NOT NULL CHECK (valor_promedio >= 0),
    FOREIGN KEY (episodio_id, comuna_id)
        REFERENCES episodio(id, comuna_id) ON DELETE CASCADE,
    FOREIGN KEY (estacion_id, comuna_id)
        REFERENCES estacion(id, comuna_id),
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

CREATE INDEX idx_reporte_ciudadano_comuna_fecha
    ON reporte_ciudadano (comuna_id, fecha_hora DESC);

-- ---------------------------------------------------------------------------
--  Internacionalización (i18n) — textos visibles al usuario, con FK reales
-- ---------------------------------------------------------------------------
CREATE TABLE idioma (
    codigo VARCHAR(10) PRIMARY KEY,    -- 'es', 'en'
    nombre VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE contaminante_traduccion (
    contaminante_id INTEGER NOT NULL REFERENCES contaminante(id) ON DELETE CASCADE,
    idioma_codigo VARCHAR(10) NOT NULL REFERENCES idioma(codigo),
    nombre        VARCHAR(120) NOT NULL,
    descripcion   TEXT NOT NULL,
    PRIMARY KEY (contaminante_id, idioma_codigo)
);

CREATE TABLE categoria_calidad_traduccion (
    categoria_id  INTEGER NOT NULL REFERENCES categoria_calidad(id) ON DELETE CASCADE,
    idioma_codigo VARCHAR(10) NOT NULL REFERENCES idioma(codigo),
    nombre        VARCHAR(80) NOT NULL,
    recomendacion TEXT NOT NULL,
    PRIMARY KEY (categoria_id, idioma_codigo)
);

-- ---------------------------------------------------------------------------
--  Auditoría transaccional relacional -> proyección no relacional
-- ---------------------------------------------------------------------------
--  Outbox de auditoría: solo registra eventos originados en PostgreSQL. La
--  colección Mongo `auditoria` admite eventos de ambas bases (postgresql,
--  mongodb); el CHECK siguiente restringe esta tabla porque su rol es ser la
--  fuente desde PG hacia Mongo, no al revés.
CREATE TABLE evento_auditoria_relacional (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    base_datos          VARCHAR(20) NOT NULL DEFAULT 'postgresql'
                            CHECK (base_datos IN ('postgresql')),
    operacion           VARCHAR(10) NOT NULL
                            CHECK (operacion IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
    recurso             VARCHAR(80) NOT NULL,
    usuario_logico      VARCHAR(120) NOT NULL DEFAULT current_user,
    ocurrido_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    criterio            JSONB,
    datos_antes         JSONB,
    datos_despues       JSONB,
    resultado           VARCHAR(10) NOT NULL DEFAULT 'ok'
                            CHECK (resultado IN ('ok', 'error')),
    sincronizado_mongo  BOOLEAN NOT NULL DEFAULT FALSE,
    sincronizado_en     TIMESTAMPTZ,
    CHECK (
        (operacion = 'SELECT' AND criterio IS NOT NULL)
        OR (operacion = 'INSERT' AND datos_despues IS NOT NULL)
        OR (operacion = 'UPDATE' AND datos_antes IS NOT NULL AND datos_despues IS NOT NULL)
        OR (operacion = 'DELETE' AND datos_antes IS NOT NULL)
    )
);

CREATE INDEX idx_evento_auditoria_recurso_fecha
    ON evento_auditoria_relacional (recurso, ocurrido_en DESC);

CREATE INDEX idx_evento_auditoria_operacion_fecha
    ON evento_auditoria_relacional (operacion, ocurrido_en DESC);

CREATE INDEX idx_evento_auditoria_pendiente_mongo
    ON evento_auditoria_relacional (sincronizado_mongo, ocurrido_en)
    WHERE sincronizado_mongo = FALSE;

CREATE VIEW eventos_auditoria_pendientes_mongo AS
SELECT
    id AS origen_evento_id,
    base_datos,
    operacion,
    recurso,
    usuario_logico,
    ocurrido_en,
    criterio,
    datos_antes,
    datos_despues,
    resultado
FROM evento_auditoria_relacional
WHERE sincronizado_mongo = FALSE
ORDER BY ocurrido_en, id;

CREATE OR REPLACE FUNCTION registrar_evento_auditoria_dml()
RETURNS trigger AS $$
BEGIN
    INSERT INTO evento_auditoria_relacional (
        operacion,
        recurso,
        usuario_logico,
        datos_antes,
        datos_despues,
        resultado
    )
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        current_user,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        'ok'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION marcar_evento_auditoria_sincronizado(p_evento_id BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE evento_auditoria_relacional
       SET sincronizado_mongo = TRUE,
           sincronizado_en = now()
     WHERE id = p_evento_id;
END;
$$ LANGUAGE plpgsql;

--  Registro de SELECT en la outbox de auditoría.
--
--  Limitación conocida: PostgreSQL no dispone de triggers nativos para
--  consultas de lectura (no existe AFTER SELECT en SQL estándar ni en PG).
--  Por eso la captura de SELECT NO es automática: depende de que la capa que
--  ejecuta la consulta invoque esta función con el recurso y el criterio
--  usado. Para una captura completamente independiente del código existen
--  dos alternativas a nivel de servidor: habilitar la extensión `pgaudit`
--  (audit logging vía `log_statement`) o consumir `pg_stat_statements`. En
--  este proyecto se eligió la función explícita para mantener trazabilidad
--  estructurada (criterio en JSONB) sin requerir extensiones externas.
CREATE OR REPLACE FUNCTION registrar_select_auditoria(
    p_recurso VARCHAR(80),
    p_criterio JSONB,
    p_usuario_logico VARCHAR(120) DEFAULT current_user,
    p_resultado VARCHAR(10) DEFAULT 'ok'
)
RETURNS BIGINT AS $$
DECLARE
    v_evento_id BIGINT;
BEGIN
    IF p_recurso IS NULL OR length(trim(p_recurso)) = 0 THEN
        RAISE EXCEPTION 'registrar_select_auditoria: p_recurso no puede ser vacío';
    END IF;

    INSERT INTO evento_auditoria_relacional (
        operacion,
        recurso,
        usuario_logico,
        criterio,
        resultado
    )
    VALUES (
        'SELECT',
        p_recurso,
        COALESCE(p_usuario_logico, current_user),
        COALESCE(p_criterio, '{}'::jsonb),
        p_resultado
    )
    RETURNING id INTO v_evento_id;

    RETURN v_evento_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_region
AFTER INSERT OR UPDATE OR DELETE ON region
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_comuna
AFTER INSERT OR UPDATE OR DELETE ON comuna
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_estacion
AFTER INSERT OR UPDATE OR DELETE ON estacion
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_unidad_medida
AFTER INSERT OR UPDATE OR DELETE ON unidad_medida
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_contaminante
AFTER INSERT OR UPDATE OR DELETE ON contaminante
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_estacion_contaminante
AFTER INSERT OR UPDATE OR DELETE ON estacion_contaminante
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_medicion
AFTER INSERT OR UPDATE OR DELETE ON medicion
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_categoria_calidad
AFTER INSERT OR UPDATE OR DELETE ON categoria_calidad
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_episodio
AFTER INSERT OR UPDATE OR DELETE ON episodio
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_episodio_estacion
AFTER INSERT OR UPDATE OR DELETE ON episodio_estacion
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_reporte_ciudadano
AFTER INSERT OR UPDATE OR DELETE ON reporte_ciudadano
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_idioma
AFTER INSERT OR UPDATE OR DELETE ON idioma
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_contaminante_traduccion
AFTER INSERT OR UPDATE OR DELETE ON contaminante_traduccion
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();

CREATE TRIGGER trg_audit_categoria_calidad_traduccion
AFTER INSERT OR UPDATE OR DELETE ON categoria_calidad_traduccion
FOR EACH ROW EXECUTE FUNCTION registrar_evento_auditoria_dml();
