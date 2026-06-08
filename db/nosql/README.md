# Modelo físico no relacional — MongoDB

La base no relacional guarda datos transaccionales del sistema en la colección
`auditoria`. Cada documento representa una operación CRUD realizada sobre un
recurso del sistema.

## Alcance de auditoría

El requisito del proyecto define dato transaccional como todo lo que pasa dentro
de la base de datos: `SELECT`, `INSERT`, `UPDATE` y `DELETE`. En este modelo, la
colección `auditoria` es el registro transaccional obligatorio para esas
operaciones. Cada evento indica la base donde se origina la operación, el recurso
afectado, la operación CRUD, el actor lógico, el momento, el resultado y el
contexto mínimo para reconstruir qué se consultó o modificó.

Para que la captura no dependa solo de la aplicación, el modelo relacional define
la tabla `evento_auditoria_relacional` como outbox de auditoría. Los eventos
`INSERT`, `UPDATE` y `DELETE` se insertan automáticamente mediante triggers
relacionales sobre las tablas del dominio. Los eventos `SELECT` se registran con
la función física `registrar_select_auditoria(...)`, porque PostgreSQL no tiene
triggers nativos para consultas de lectura. MongoDB almacena la proyección no
relacional de esos eventos, usando `origen_evento_id` para trazar cada documento
con su evento relacional de origen.

El contrato de sincronización queda definido por:

- `eventos_auditoria_pendientes_mongo`: vista relacional con eventos aún no
  proyectados a MongoDB.
- `marcar_evento_auditoria_sincronizado(id)`: función relacional que marca un
  evento como proyectado después de insertarlo en MongoDB.
- Índice único/sparse `{ origen_evento_id: 1 }` en MongoDB, para evitar duplicar
  el mismo evento relacional.

La auditoría se modela como bitácora append-only: los documentos no se actualizan
ni eliminan como parte del flujo normal. Si se requiere corregir un registro de
auditoría, debe agregarse un nuevo documento compensatorio.

## Colección `auditoria`

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `origen_evento_id` | number | No | Identificador del evento en `evento_auditoria_relacional` |
| `base_datos` | enum (`postgresql`, `mongodb`) | Sí | Base donde ocurre o se origina la operación auditada |
| `operacion` | enum (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) | Sí | Tipo de operación auditada |
| `recurso` | string | Sí | Tabla, colección o recurso afectado |
| `tabla` | string | No | Alias para la tabla relacional afectada, útil para consultas directas |
| `usuario` | string | Sí | Actor lógico que ejecutó la operación |
| `timestamp` | date | Sí | Fecha y hora del evento |
| `ocurrido_en` | date | No | Fecha/hora original del evento cuando proviene de otra base |
| `criterio` | object / cualquier valor JSON | No | Filtros o identificadores usados en `SELECT`, `UPDATE` o `DELETE` |
| `datos_antes` | object / cualquier valor JSON | No | Estado anterior cuando aplica |
| `datos_despues` | object / cualquier valor JSON | No | Estado posterior cuando aplica |
| `payload` | object / cualquier valor JSON | No | Detalle contextual adicional de la operación |
| `resultado` | enum (`ok`, `error`) | Sí | Resultado de la operación |

## Índices

| Índice | Uso |
| --- | --- |
| `{ base_datos: 1, recurso: 1, timestamp: -1 }` | Consultar actividad reciente por base y recurso |
| `{ origen_evento_id: 1 }` único/sparse | Evitar duplicar eventos proyectados desde PostgreSQL |
| `{ tabla: 1, timestamp: -1 }` | Consultar actividad reciente por tabla/recurso |
| `{ operacion: 1, timestamp: -1 }` | Consultar actividad por tipo de operación |
| `{ usuario: 1, timestamp: -1 }` | Consultar actividad por actor |

El script `01_auditoria.js` crea la colección con validador JSON Schema e
índices al inicializar un volumen nuevo de MongoDB.
