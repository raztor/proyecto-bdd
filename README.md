# Plataforma de Calidad del Aire — ODS 11.6.2

Proyecto semestral de **Bases de Datos (TICS320-1-2026, UAI)**. Prueba de concepto (POC)
para el **Indicador 11.6.2 del ODS 11**: niveles medios de material particulado
(PM2.5/PM10) en ciudades. El sistema ingiere mediciones por estación de monitoreo,
calcula el promedio de concentración por comuna/contaminante y lo clasifica en
categorías de calidad del aire (Buena → Emergencia).

## Arquitectura

| Capa            | Tecnología                                  |
| --------------- | ------------------------------------------- |
| BD relacional   | **PostgreSQL 16** (Docker)                  |
| BD no relacional| **MongoDB 7** (Docker) — log de auditoría CRUD |
| Backend / API   | **Node + TypeScript + Express**, doc **OpenAPI/Swagger** |
| Frontend        | **React + Vite (SPA)**                      |
| Datos sintéticos| **Faker** (seed en TypeScript)              |

```
proyecto-bdd/
├── docker-compose.yml         # PostgreSQL + MongoDB
├── .env.example               # variables (copiar a .env)
├── docs/
│   ├── instrucciones.pdf       # enunciado del proyecto
│   └── informe.md              # problemática, solución, datos e indicador
├── db/
│   ├── relational/            # DDL + catálogos (se auto-cargan en Postgres)
│   │   ├── 01_schema.sql       #   modelo físico (CREATE TABLE, PK, FK, índices)
│   │   ├── 02_catalogos.sql    #   contaminantes, categorías, comunas, estaciones
│   │   ├── 03_traducciones.sql #   i18n (es/en)
│   │   └── 04_seed_demo.sql    #   seed declarativo (>1.000 mediciones)
│   ├── nosql/                  # modelo físico MongoDB (auditoría CRUD)
│   │   ├── 01_auditoria.js      #   validador JSON Schema + índices
│   │   ├── 02_seed_auditoria.js #   seed declarativo (>1.000 documentos)
│   │   └── README.md            #   descripción de colección y campos
│   └── mer/                    # diagramas conceptual y físico
│       ├── mer.{dot,png,svg}            # MER (notación Chen)
│       └── modelo_fisico.{dot,png,svg}  # modelo físico (tablas, PK, FK)
├── backend/                   # API Express + TypeScript
│   └── src/
│       ├── routes/             # estaciones (Form A), reportes (Form B), dashboard, gráficos
│       ├── db/                 # conexión Postgres y Mongo
│       ├── audit/              # logger de auditoría -> MongoDB
│       ├── schemas/            # validación Zod (+ OpenAPI)
│       └── seed/seed.ts        # genera mediciones (1.000+) y auditoría (1.000+)
└── frontend/                  # SPA React (dashboard + gráficos + estado + mapa + 2 formularios)
```

## Requisitos previos

- [Docker](https://www.docker.com/) y Docker Compose
- [Node.js](https://nodejs.org/) 20+ (probado con Node 24)

## Puesta en marcha

```bash
# Variables de entorno (ajusta las credenciales en .env)
cp .env.example .env
```

### Opción A — todo con Docker

Levanta las dos bases de datos, el backend y el frontend con un solo comando:

```bash
docker compose up -d --build                  # postgres, mongo, backend y frontend
docker compose --profile seed run --rm seed   # carga datos sintéticos (1.000+), una vez
```

- Frontend: <http://localhost:8080>
- API / Swagger: <http://localhost:3000/api/docs>

### Opción B — desarrollo local

Solo las bases en Docker; backend y frontend con Node en el host:

```bash
docker compose up -d postgres mongo

# Backend (una terminal)
cd backend && npm install && npm run seed && npm run dev   # API en :3000

# Frontend (otra terminal)
cd frontend && npm install && npm run dev                  # SPA en :5173 (proxy a :3000)
```

> Detener conservando los datos: `docker compose down`.
> Reiniciar desde cero (re-aplica el DDL y borra los datos): `docker compose down -v`.

## Cómo se cumple cada requisito mínimo

| Requisito del curso | Dónde se cumple |
| --- | --- |
| POC específico al indicador (no genérico) | El dashboard **es** el indicador: AVG de concentración por comuna/contaminante clasificado en categorías de salud |
| ≥ 2 formularios con INSERT | Form A `POST /api/estaciones`, Form B `POST /api/reportes` |
| Un formulario escribe en 2+ tablas con FK | Form A inserta en `ESTACION` y `ESTACION_CONTAMINANTE` (transacción) |
| ≥ 1 visualización (SELECT) sobre tabla de 1.000+ | Dashboard: `AVG(valor)` sobre `MEDICION` + JOINs. **Gráficos** (`GET /api/graficos`): serie temporal, ranking por comuna/estación, perfil horario y estacionalidad. **Estado** y **Mapa** (`GET /api/estaciones/estado`): última medición por estación clasificada, sobre tarjetas y sobre un mapa Leaflet con popups |
| Toda BD con ≥ 1.000 registros | `MEDICION` en Postgres (carga histórica opcional de ~5M filas, ver `db/maintenance/`); `auditoria` (1.200+) en MongoDB |
| Filtro por ≥ 1 atributo | Dashboard y gráficos filtran por comuna, contaminante y rango de fechas |
| BD relacional Y no relacional | PostgreSQL + MongoDB |
| Modelo relacional en ≥ 2 idiomas | Tablas `CONTAMINANTE_TRADUCCION` y `CATEGORIA_CALIDAD_TRADUCCION` con textos es/en |
| MER (conceptual) | `db/mer/mer.svg` (notación Chen) |
| Modelo físico | `db/mer/modelo_fisico.svg`, `db/relational/01_schema.sql` y `db/nosql/README.md` |
