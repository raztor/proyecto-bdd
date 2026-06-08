# Informe del proyecto — Plataforma de Calidad del Aire

## Indicador seleccionado

La propuesta se basa en el ODS 11, indicador 11.6.2: niveles medios anuales de
material particulado fino en ciudades. El modelo se concentra en PM2.5 y PM10,
contaminantes usados para evaluar calidad del aire y episodios críticos.

## Problemática

La calidad del aire urbana afecta directamente la salud de la población,
especialmente en periodos de alta concentración de material particulado. Para
analizar el problema se requiere almacenar mediciones por estación, ubicarlas
territorialmente, clasificarlas por tramos de calidad del aire y permitir
consultas agregadas por zona y contaminante.

## Propuesta de solución

La solución modela una plataforma de monitoreo de calidad del aire para la
Región Metropolitana. La unidad territorial operativa es la comuna, usada como
aproximación local y comparable a ciudad para el alcance del proyecto. Cada
comuna pertenece a una región, puede tener estaciones de monitoreo y puede
recibir reportes ciudadanos.

Las estaciones registran mediciones horarias por contaminante. El modelo
garantiza que una medición solo pueda existir si la estación está declarada como
capaz de medir ese contaminante. Luego, las mediciones pueden agregarse por
comuna, contaminante y rango temporal para observar el comportamiento del
indicador.

## Datos que se recolectan y almacenan

| Dato | Tabla o colección | Uso |
| --- | --- | --- |
| Regiones y comunas | `region`, `comuna` | Ubicación territorial de estaciones, reportes y episodios |
| Estaciones | `estacion` | Puntos de monitoreo con coordenadas |
| Contaminantes y unidades | `contaminante`, `unidad_medida` | Catálogo de PM2.5, PM10 y gases complementarios |
| Capacidad de medición | `estacion_contaminante` | Define qué contaminantes mide cada estación |
| Mediciones | `medicion` | Serie principal para calcular promedios del indicador |
| Categorías de calidad | `categoria_calidad` | Clasificación de promedios por contaminante |
| Episodios críticos | `episodio`, `episodio_estacion` | Registro de días con condiciones críticas por comuna |
| Reportes ciudadanos | `reporte_ciudadano` | Percepción ciudadana complementaria |
| Traducciones | `contaminante_traduccion`, `categoria_calidad_traduccion` | Textos del dominio en español e inglés |
| Auditoría transaccional | MongoDB `auditoria` | Registro no relacional de operaciones `SELECT`, `INSERT`, `UPDATE`, `DELETE` |

## Cómo ayuda al indicador

El indicador requiere observar niveles medios de material particulado. La tabla
`medicion` almacena valores de concentración por estación, contaminante y hora.
Al unir `medicion` con `estacion` y `comuna`, el modelo permite calcular
promedios por comuna y contaminante. Al unir esos promedios con
`categoria_calidad`, el resultado se interpreta como buena, regular, alerta,
preemergencia o emergencia.

El foco del indicador está en PM2.5 y PM10. Los demás contaminantes se incluyen
como datos complementarios para extender el análisis ambiental, pero no cambian
el alcance principal.

## Métrica anual y clasificación operativa

El indicador ODS 11.6.2 se interpreta como una métrica agregada anual de material
particulado. El modelo lo permite porque `medicion` conserva `fecha_hora`, por lo
que se pueden calcular promedios anuales por comuna y contaminante.

Las categorías de calidad del aire y los episodios críticos cumplen un rol
operativo complementario: clasifican concentraciones de corto plazo y ayudan a
explicar situaciones de alerta, preemergencia o emergencia. Por eso el modelo
mantiene ambas dimensiones separadas: `medicion` como serie base para el
indicador anual, y `categoria_calidad`/`episodio` como interpretación sanitaria
operacional.

## Modelo relacional

El modelo relacional se entrega en `db/relational/01_schema.sql` y el MER en
`db/mer/mer.svg` y `db/mer/mer.png`.

Decisiones principales:

- `medicion` tiene FK compuesta hacia `estacion_contaminante`, por lo que no se
  pueden insertar mediciones de contaminantes que la estación no mide.
- `categoria_calidad` modela el tramo como una columna del tipo nativo
  `numrange` de PostgreSQL (semi-abierto `[min, max)`) y aplica una restricción
  de exclusión `EXCLUDE USING gist` para impedir rangos solapados dentro del
  mismo contaminante. El extremo superior abierto se expresa con `'infinity'`
  en lugar de un valor sentinel, y la clasificación se realiza con el operador
  de pertenencia nativo (`rango @> valor::numeric`).
- `episodio` incluye `contaminante_id` y `categoria_id`, con FK compuesta para
  asegurar que la categoría corresponda al contaminante del episodio.
- `episodio_estacion` valida que la estación asociada pertenezca a la misma
  comuna del episodio.
- El soporte bilingüe se implementa con tablas específicas y FK reales:
  `contaminante_traduccion` y `categoria_calidad_traduccion`.

## Modelo no relacional

La base no relacional es MongoDB y su modelo físico está documentado en
`db/nosql/README.md`. La colección `auditoria` almacena eventos transaccionales
del sistema. Cada documento registra:

- base de datos origen,
- operación (`SELECT`, `INSERT`, `UPDATE`, `DELETE`),
- recurso afectado,
- usuario lógico,
- fecha y hora,
- criterio o datos involucrados cuando aplica,
- resultado de la operación.

Este diseño separa la auditoría transaccional de las tablas analíticas
relacionales y permite consultar actividad por recurso, operación, usuario y
tiempo.

Para que la auditoría no dependa solo de la aplicación, el modelo relacional
incluye `evento_auditoria_relacional`. Las escrituras (`INSERT`, `UPDATE`,
`DELETE`) se capturan mediante triggers en las tablas del dominio. Las lecturas
(`SELECT`) se registran mediante la función física
`registrar_select_auditoria(...)`, ya que PostgreSQL no dispone de triggers de
lectura. MongoDB recibe la proyección no relacional de esos eventos y conserva el
identificador de origen mediante `origen_evento_id`. La vista
`eventos_auditoria_pendientes_mongo` lista los eventos pendientes de proyectar y
la función `marcar_evento_auditoria_sincronizado(...)` marca los eventos ya
copiados a MongoDB.

## Aplicación en dos idiomas

El modelo relacional aplica español e inglés sobre los textos visibles del
dominio ambiental principal: contaminantes y categorías de calidad del aire. Las
comunas, regiones y estaciones se conservan como nombres propios, por lo que no
se traducen.

## Alcance y límites

El proyecto se limita a una prueba de concepto para la Región Metropolitana. La
unidad territorial usada es comuna. Para una implementación nacional, el modelo
puede ampliarse con más regiones, comunas, estaciones oficiales y fuentes de
medición adicionales sin cambiar la estructura principal.
