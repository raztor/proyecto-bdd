# Justificación del proyecto y arquitectura de datos

Documento de respaldo para la entrega. Explica **cómo el proyecto cumple cada
requisito del enunciado** (TICS320 — Proyecto semestral) y **por qué y en qué se
usa cada base de datos** (PostgreSQL y MongoDB). Complementa al
[informe](informe.md), al MER (`db/mer/mer.svg`) y al modelo físico
(`db/mer/modelo_fisico.svg` + DDL en `db/relational/01_schema.sql`).

---

## 1. Tema e indicador

- **Temática:** Opción A — Objetivos de Desarrollo Sostenible (ODS).
- **ODS 11** (Ciudades y comunidades sostenibles), **indicador 11.6.2**: niveles
  medios de material particulado fino (**PM2.5 / PM10**) en ciudades.
- **Problemática:** la concentración de material particulado en el Gran Santiago
  afecta la salud, sobre todo en invierno. Se necesita almacenar mediciones por
  estación, ubicarlas territorialmente, clasificarlas por tramos de calidad del
  aire y permitir consultas agregadas por zona y contaminante.
- **POC:** plataforma de monitoreo donde la *visualización principal es el
  indicador* (promedio de concentración por comuna/contaminante clasificado en
  categorías de salud), más formularios de ingreso y vistas analíticas.

---

## 2. Cumplimiento de los requisitos del enunciado

| Requisito mínimo (enunciado) | Cómo se cumple | Dónde |
| --- | --- | --- |
| Funcionalidad **relevante y específica** al indicador (no un login) | La visualización principal **es** el indicador 11.6.2: `AVG(valor)` por comuna y contaminante, clasificado en categorías de salud | `GET /api/dashboard` · pantalla *Dashboard* |
| **≥ 2 formularios** que escriben (INSERT) | **Form A** registrar estación · **Form B** reporte ciudadano | `POST /api/estaciones` · `POST /api/reportes` |
| Un formulario escribe en **2+ tablas con FK** | Form A inserta en `estacion` y `estacion_contaminante` dentro de una **transacción** | `backend/src/routes/estaciones.ts` |
| **≥ 1 visualización (SELECT)** sobre una tabla de 1.000+ | Dashboard, Gráficos y Estado leen `medicion` (millones de filas) con JOINs y agregaciones | `dashboard.ts`, `graficos.ts`, `estaciones.ts` |
| El SELECT muestra **lo aprendido en el curso** | CTEs, JOINs, `GROUP BY`/`AVG`, `DISTINCT ON`, pertenencia a `numrange` (`@>`), `date_trunc`/`EXTRACT`, índices de apoyo | ver §4 |
| **Toda BD** con ≥ 1.000 registros | `medicion` en PostgreSQL (seed demo ~6.000; carga histórica opcional ~5M) · colección `auditoria` en MongoDB (1.000+) | `db/relational/04_seed_demo.sql`, `db/maintenance/`, `db/nosql/` |
| **Filtro** por ≥ 1 atributo en una visualización | Dashboard y Gráficos filtran por comuna, contaminante y rango de fechas | `DashboardQuery`, `GraficosQuery` (Zod) |
| BD **relacional y no relacional** | PostgreSQL + MongoDB | `docker-compose.yml` |
| Modelo en **≥ 2 idiomas** | `contaminante_traduccion` y `categoria_calidad_traduccion` (es/en) con FK reales | `db/relational/03_traducciones.sql` |
| Entregar **MER** y **modelo físico** | Diagramas en `db/mer/` (Chen + relacional con tipos e índices) y DDL ejecutable | `db/mer/`, `db/relational/01_schema.sql` |

> Los datos transaccionales del sistema (todo `SELECT`/`INSERT`/`UPDATE`/`DELETE`)
> se registran en la base **no relacional**, como pide el enunciado (ver §5).

---

## 3. Arquitectura general

```
Frontend (React + Vite + Recharts + Leaflet)
        │  HTTP / JSON
        ▼
Backend (Node + Express + TypeScript, validación Zod, OpenAPI/Swagger)
   │                                   │
   ▼ datos del dominio                 ▼ datos transaccionales (auditoría)
PostgreSQL (relacional)            MongoDB (no relacional)
```

- **PostgreSQL** guarda el **dominio** (estaciones, mediciones, categorías,
  episodios, traducciones, reportes).
- **MongoDB** guarda la **auditoría transaccional** (qué operación ocurrió,
  sobre qué recurso, cuándo, con qué resultado).
- El backend valida todas las entradas con **Zod** y expone la API documentada
  con **OpenAPI/Swagger** (`/api/docs`).

---

## 4. PostgreSQL — base de datos relacional

### ¿Por qué PostgreSQL?

El dominio es **fuertemente relacional y con reglas de integridad** que conviene
hacer cumplir en la base, no solo en la aplicación:

- Relaciones N:M (estación ↔ contaminante, episodio ↔ estación) y jerarquías
  (región → comuna → estación).
- Reglas que deben ser **imposibles de violar**: no registrar una medición de un
  contaminante que la estación no mide; que la categoría de un episodio
  corresponda al mismo contaminante; que dos tramos de calidad no se solapen.
- Necesidad de **consultas analíticas** (promedios por zona y tiempo) sobre una
  tabla grande, con buen rendimiento.

Además se aprovechan **características nativas avanzadas** de PostgreSQL:

- **`numrange`** para los tramos de calidad del aire (semiabiertos `[min, max)`),
  con `'infinity'` para el extremo superior en lugar de un valor centinela. La
  clasificación es la pertenencia nativa `rango @> valor::numeric`.
- **`EXCLUDE USING gist`** (extensión `btree_gist`) para impedir que dos
  categorías del mismo contaminante tengan rangos solapados.
- **Claves foráneas compuestas** para integridad cruzada (p. ej. `medicion`
  hacia `estacion_contaminante`).
- **Triggers** y funciones PL/pgSQL para la captura de auditoría (ver §6).

### ¿En qué se usa?

- **Tabla grande / serie base del indicador:** `medicion` (mediciones horarias
  por estación y contaminante). Es la tabla 1.000+ exigida; con la carga
  histórica opcional llega a ~5 millones de filas.
- **Indicador 11.6.2:** `GET /api/dashboard` calcula `AVG(valor)` por comuna y
  contaminante (CTE + JOINs `medicion`→`estacion`→`comuna`) y clasifica cada
  promedio con `categoria_calidad.rango @> promedio`.
- **Zona de gráficos:** `GET /api/graficos` agrega la tabla grande por mes
  (`date_trunc`), por hora (`EXTRACT`), por mes del año (estacionalidad) y por
  comuna/estación (rankings). Se apoya en el índice
  `idx_medicion_cont_fecha (contaminante_id, fecha_hora)`.
- **Estado actual por estación:** `GET /api/estaciones/estado` toma la **última**
  medición por (estación, contaminante) con `DISTINCT ON` (que aprovecha el
  índice único) y la clasifica; alimenta la pantalla *Estado* y el *Mapa*.
- **Formularios (INSERT):** `POST /api/estaciones` (2 tablas con FK, en
  transacción) y `POST /api/reportes`.
- **Integridad y catálogos:** regiones, comunas, unidades, contaminantes,
  categorías, episodios y las tablas de traducción (i18n es/en).

---

## 5. MongoDB — base de datos no relacional

### ¿Por qué MongoDB?

El enunciado pide una **base no relacional para datos transaccionales** (todo lo
que pasa dentro de la BD: `SELECT`, `INSERT`, `UPDATE`, `DELETE`). La auditoría
encaja naturalmente en un almacén documental:

- Cada evento es un **documento autocontenido** con forma variable según la
  operación (un `SELECT` guarda el *criterio* de búsqueda; un `UPDATE` guarda
  *antes* y *después*). Un esquema documental absorbe esa variabilidad sin
  tablas dispersas ni columnas nulas.
- Es un flujo **append-only** de alto volumen y baja necesidad de joins: se
  consulta por recurso, operación, usuario y tiempo. Mongo indexa bien ese
  patrón (`{ tabla: 1, timestamp: -1 }`).
- **Separa** la traza transaccional de las tablas analíticas del dominio, de
  modo que auditar no compite con las consultas del indicador.

### ¿En qué se usa?

- Colección **`auditoria`**: registra cada operación del sistema con
  `base_datos`, `operacion`, `recurso`, `usuario`, `timestamp`, `payload`/
  `criterio` y `resultado`. Es la tabla 1.000+ de la base no relacional.
- El backend escribe ahí mediante `logAudit()` (`backend/src/audit/audit.ts`) en
  cada endpoint, y nunca deja que un fallo de auditoría rompa la operación
  principal del usuario.
- El modelo físico de la colección y su seed están en `db/nosql/`.

---

## 6. Cómo se integran las dos bases

La auditoría no depende **solo** de la aplicación: el modelo relacional incluye
una *outbox* `evento_auditoria_relacional` que se llena de forma independiente:

- **Escrituras** (`INSERT`/`UPDATE`/`DELETE`) → capturadas por **triggers** en
  cada tabla del dominio (`registrar_evento_auditoria_dml`).
- **Lecturas** (`SELECT`) → registradas con la función
  `registrar_select_auditoria(...)`, ya que PostgreSQL no tiene triggers de
  lectura.
- MongoDB recibe la **proyección no relacional** de esos eventos. La vista
  `eventos_auditoria_pendientes_mongo` lista lo pendiente y
  `marcar_evento_auditoria_sincronizado(...)` marca lo ya copiado.

Así el sistema demuestra el uso **conjunto** de ambas bases: PostgreSQL como
fuente transaccional confiable y MongoDB como almacén documental de auditoría.

---

## 7. Funcionalidades del POC (pantallas → endpoints)

| Pantalla | Qué hace | Endpoint |
| --- | --- | --- |
| **Dashboard** | Indicador 11.6.2: promedio por comuna/contaminante clasificado, con filtros | `GET /api/dashboard` |
| **Gráficos** | Serie temporal, estacionalidad, perfil horario y rankings (Recharts) | `GET /api/graficos` |
| **Estado** | Última medición y categoría por estación | `GET /api/estaciones/estado` |
| **Mapa** | Estaciones en el mapa (Leaflet) coloreadas por estado, con popup de detalle | `GET /api/estaciones/estado` |
| **Registrar estación** (Form A) | INSERT en 2 tablas con FK (transacción) | `POST /api/estaciones` |
| **Reporte ciudadano** (Form B) | INSERT simple de percepción ciudadana | `POST /api/reportes` |
| **Importar (OpenAQ)** | Búsqueda e importación de estaciones reales | `GET/POST /api/importacion/*` |

---

## 8. Volumen de datos

- `medicion`: el seed declarativo (`db/relational/04_seed_demo.sql`) deja ~6.000
  filas al crear el contenedor (cumple el mínimo de 1.000). Para demostrar
  consultas a gran escala existe una **carga histórica** server-side
  (`db/maintenance/carga_historica.sql`) que genera ~5 millones de mediciones
  horarias (2010–2026) con estacionalidad de invierno.
- `auditoria` (MongoDB): seed inicial + actividad real del sistema (1.000+).

---

## 9. Internacionalización (≥ 2 idiomas)

El soporte bilingüe **es/en** se aplica sobre los textos del dominio ambiental:
contaminantes (`contaminante_traduccion`) y categorías de calidad
(`categoria_calidad_traduccion`), con FK reales hacia `idioma`. Regiones, comunas
y estaciones se mantienen como nombres propios y no se traducen.

---

## 10. Entregables de modelado

- **MER conceptual** (notación Chen): `db/mer/mer.svg` / `mer.png` / `mer.pdf`.
  No incluye tipos ni índices (corresponden al modelo físico).
- **Modelo físico** (tablas con **tipos de datos**, PK/FK, **índices** y
  restricciones UNIQUE/EXCLUDE/CHECK): `db/mer/modelo_fisico.svg` / `.png` /
  `.pdf`.
- **DDL ejecutable** (fuente de verdad): `db/relational/01_schema.sql`.
- **Modelo no relacional:** `db/nosql/README.md`.
