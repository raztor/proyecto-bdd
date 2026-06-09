# Guion — Video de Avance (Entrega 1)

Duración objetivo: **10:00 ± 0:30**. Tres integrantes: **A**, **B**, **C**.

**Cada integrante presenta una sección completa**, en este orden:

1. **A** — Introducción, problemática y magnitud (0:00 – 3:20).
2. **B** — Solución, alcance, funcionalidad y MER (3:20 – 6:40).
3. **C** — Modelo físico, demo y cierre (6:40 – 10:00).

**Solo dos vistas en pantalla:**

1. **Slides** (0:00 – 7:40). Una sola presentación que avanza por slide; no hay que cambiar de aplicación.
2. **Terminal** (7:40 – 10:00). Un único cambio de pantalla compartida, dentro de la sección de **C**, para la demo de BD y el cierre.

Estructura alineada al PDF de instrucciones (`docs/instrucciones.pdf`):

| Sección | Persona | Puntaje | Tiempo | Vista |
| --- | --- | --- | --- | --- |
| 1. Introducción, problemática y magnitud | A | 1 pt | 0:00 – 3:20 | Slides |
| 2. Solución, alcance, funcionalidad y MER | B | 2 pt + parte de los 3 pt de MER | 3:20 – 6:40 | Slides |
| 3. Modelo físico, demo y cierre | C | parte de los 3 pt de MER/físico | 6:40 – 10:00 | Slides → Terminal |

Capítulos sugeridos para la descripción de YouTube:
`00:00 Introducción · 00:50 Problemática · 02:00 Magnitud · 03:20 Solución y alcance · 04:30 Funcionalidad del POC · 05:20 MER · 06:40 Modelo físico · 07:40 Demo de base de datos · 09:20 Cierre`

---

## Sección 1 — A: Introducción, problemática y magnitud (0:00 – 3:20) · Vista: Slides

### Introducción (0:00 – 0:50)

**A**
Hola, somos el grupo del proyecto **Plataforma de Calidad del Aire**. Mi nombre es **[A]**, y me acompañan **[B]** y **[C]**, que tomarán la palabra más adelante. En este video de avance les vamos a presentar la problemática que abordamos, nuestra propuesta de solución, el modelo de datos —tanto el conceptual como el físico— y una demostración de la base de datos ya funcionando.

Nuestro proyecto se enmarca en el **Objetivo de Desarrollo Sostenible número 11** de Naciones Unidas —Ciudades y Comunidades Sostenibles— y, dentro de él, en el indicador **11.6.2**, que mide los niveles medios anuales de material particulado fino en las ciudades. Nos enfocamos en dos contaminantes clave para evaluar la calidad del aire urbano: **PM2.5 y PM10**.

### Problemática (0:50 – 2:00)

**A**
El problema de fondo es que medir la calidad del aire genera una enorme cantidad de datos que, sin una estructura adecuada, no sirven para tomar decisiones. Una red de monitoreo produce mediciones **hora a hora**, en **muchas estaciones**, para **varios contaminantes a la vez**. Si esa información queda dispersa en planillas o archivos sueltos, es imposible responder preguntas tan básicas como: ¿cuál es el promedio de PM2.5 de esta comuna esta semana?, ¿en qué tramo de calidad cae?, ¿qué estaciones están involucradas en un episodio crítico?

Para que los datos sean útiles hay que poder **almacenarlos por estación**, **ubicarlos territorialmente** —en su comuna y su región—, **clasificarlos por tramos de calidad del aire**, y **consultarlos de forma agregada** por zona, por contaminante y por rango de tiempo. Esa es exactamente la necesidad que nuestra base de datos resuelve: convertir mediciones crudas en información consultable y confiable.

### Magnitud del problema (2:00 – 3:20)

**A**
¿Por qué importa tanto? Porque el material particulado fino es, según la **Organización Mundial de la Salud**, uno de los contaminantes atmosféricos más dañinos para la salud humana: se asocia a enfermedades respiratorias y cardiovasculares, y afecta especialmente a niños y adultos mayores.

En la **Región Metropolitana**, los meses fríos concentran episodios críticos de contaminación que obligan a decretar **alertas, preemergencias y emergencias ambientales**, con restricciones a vehículos e industrias que afectan a **millones de habitantes** cada invierno. La red oficial de monitoreo —el **SINCA**— vigila este fenómeno de forma continua en numerosas estaciones a lo largo del país.

Y aquí está la magnitud desde el punto de vista de los datos: cada estación, midiendo varios contaminantes cada hora, genera **miles de registros en pocos días**. En nuestro propio prototipo, con apenas diez estaciones y una semana de datos, ya superamos las **seis mil mediciones**. Una red real, operando durante años, acumula millones. Por eso el desafío no es solo medir: es **modelar bien** esos datos para poder almacenarlos, clasificarlos y consultarlos con integridad. Y de eso se encarga **[B]**, que les va a presentar nuestra solución.

---

## Sección 2 — B: Solución, alcance, funcionalidad y MER (3:20 – 6:40) · Vista: Slides

### Solución y alcance (3:20 – 4:30)

**B**
Gracias, [A]. Nuestra propuesta es una **plataforma de monitoreo de calidad del aire** que modela la **comuna** como unidad territorial de análisis, porque es a ese nivel donde se toman las decisiones ambientales.

El alcance de esta prueba de concepto es la **Región Metropolitana**, con **12 comunas** y **10 estaciones** inspiradas en la red SINCA. Los datos que almacenamos son: **regiones y comunas**; **estaciones con coordenadas geográficas**; **contaminantes con sus unidades de medida**; la **capacidad de medición** de cada estación —es decir, qué contaminantes mide cada una—; las **mediciones horarias**, que son la tabla grande del proyecto; las **categorías de calidad del aire**; los **episodios críticos**; los **reportes ciudadanos**; y, de forma separada, la **auditoría transaccional en MongoDB**.

Dos características transversales: primero, toda operación que ocurre dentro de la base —SELECT, INSERT, UPDATE y DELETE— se registra como dato transaccional; los cambios se capturan con **triggers** en cada tabla, se escriben en una tabla *outbox* en PostgreSQL y desde ahí se proyectan a una colección en MongoDB. Segundo, todo el modelo está disponible en **dos idiomas, español e inglés**, con tablas de traducción dedicadas y claves foráneas reales, no con columnas duplicadas.

### Funcionalidad del POC (4:30 – 5:20)

**B**
La funcionalidad específica que presentaremos como prueba de concepto en la entrega final tiene **tres piezas**, todas alineadas al indicador 11.6.2:

**Primero**, un **formulario de reporte ciudadano**, que inserta en la tabla `reporte_ciudadano` con clave foránea a `comuna`.

**Segundo**, un **formulario de declaración de capacidad de medición**, que escribe en la tabla `estacion_contaminante` usando dos claves foráneas —una a `estacion` y otra a `contaminante`—, dejando registrado qué contaminante puede medir cada estación.

**Y tercero**, una **visualización tipo dashboard** que filtra por comuna y contaminante, calcula el promedio sobre la tabla `medicion` y lo clasifica automáticamente en uno de cinco tramos: **BUENA, REGULAR, ALERTA, PREEMERGENCIA o EMERGENCIA**.

### MER — Modelo Entidad-Relación (5:20 – 6:40)

**B**
Este es nuestro **MER**, el modelo conceptual, en **notación Chen**: las entidades son rectángulos, las relaciones son rombos, los atributos son óvalos y las cardinalidades van en notación **(mínimo, máximo)** junto a cada entidad —el par indica cuántas veces participa esa entidad respecto de la del otro extremo de la relación.

Lo organizamos en **tres bloques principales y dos transversales**. El **bloque geográfico**: `region`, `comuna` y `estacion`, encadenadas uno-a-muchos —una región tiene muchas comunas, una comuna tiene muchas estaciones—. El **bloque de contaminantes y mediciones**: `unidad_medida`, `contaminante`, una relación de muchos-a-muchos entre estación y contaminante que declara qué mide cada estación, y la entidad `medicion`, que es la tabla grande y la modelamos como **entidad débil**, porque una medición solo existe asociada a un par estación-contaminante previamente declarado. El **bloque de clasificación**: `categoria_calidad`, que define los tramos de calidad del aire.

Sobre esos bloques se monta `episodio`, que registra los días críticos por comuna. Y los **dos bloques transversales**: el de **internacionalización** —con `idioma` y las traducciones de contaminantes y categorías— y el de **auditoría**. Fíjense que en el MER **no aparecen las claves foráneas**: eso es correcto, porque las FK son un concepto del modelo físico. El MER dice *qué* se relaciona; el físico dice *cómo* se implementa. Y justamente eso es lo que les va a mostrar **[C]**.

---

## Sección 3 — C: Modelo físico, demo y cierre (6:40 – 10:00)

### Modelo físico (6:40 – 7:40) · Vista: Slides

**C**
Gracias, [B]. Este es el **modelo físico**, derivado del MER y ya en lenguaje relacional: aquí las entidades son **tablas** y las relaciones se materializan como **claves foráneas** o como **tablas puente**.

Quiero destacar **cuatro decisiones de diseño** que muestran que la integridad la garantiza la base de datos, no el código:

**Una.** La tabla `medicion` no usa una FK simple a `estacion` y otra a `contaminante`: usa una **FK compuesta** hacia `estacion_contaminante`. Esto hace **imposible** registrar una medición de un contaminante que la estación no declaró medir.

**Dos.** En `categoria_calidad` usamos un tipo nativo de PostgreSQL: la columna `rango` es de tipo **`numrange`**, semi-abierto, con `'infinity'` como tope superior real, no un valor inventado. Y aplicamos una restricción **`EXCLUDE USING gist`** que impide que dos tramos del mismo contaminante se solapen.

**Tres.** La tabla `episodio` tiene una **FK compuesta** hacia `categoria_calidad` para garantizar que la categoría siempre corresponda al contaminante del episodio; y la tabla puente `episodio_estacion` valida que la estación participante pertenezca a la **misma comuna** del episodio.

**Cuatro.** La auditoría: la tabla `evento_auditoria_relacional` funciona como *outbox*, alimentada por **triggers** en cada tabla del dominio, y desde ahí se sincroniza a MongoDB. Con esto cerramos el modelo. Ahora les muestro la base viva.

### Demo de base de datos (7:40 – 9:20) · Vista: Terminal

**C**
*[Corte a terminal: contenedores ya levantados con `docker compose up -d postgres mongo`, `psql` logueado y `mongosh` en otra pestaña.]*

Primero, el tamaño de la tabla principal:

```sql
SELECT COUNT(*) FROM medicion;
-- 6.084
```

Cumplimos holgadamente el requisito de **al menos mil registros**. Lo mismo en MongoDB, en la colección de auditoría:

```
db.auditoria.countDocuments()
-- 1200
```

Y esta es la consulta que es la base de nuestra visualización futura: el **promedio de PM2.5 por comuna con clasificación automática usando el `numrange`**:

```sql
WITH p AS (
  SELECT e.comuna_id, AVG(m.valor) AS promedio
    FROM medicion m
    JOIN estacion e     ON e.id = m.estacion_id
    JOIN contaminante c ON c.id = m.contaminante_id
   WHERE c.codigo = 'PM25'
   GROUP BY e.comuna_id
)
SELECT co.nombre, ROUND(p.promedio,2) AS prom, cat.codigo
  FROM p
  JOIN comuna co ON co.id = p.comuna_id
  LEFT JOIN categoria_calidad cat
    ON cat.contaminante_id = (SELECT id FROM contaminante WHERE codigo='PM25')
   AND cat.rango @> p.promedio::numeric;
```

Fíjense cómo el operador `@>` de `numrange` clasifica cada promedio en su tramo, **sin un `BETWEEN` ni un `CASE` manual**: la lógica de clasificación vive en el modelo de datos.

### Cierre (9:20 – 10:00) · Vista: Terminal

**C**
En resumen: presentamos una **problemática** ligada al indicador 11.6.2 y dimensionada en su impacto sanitario y territorial; una **propuesta de solución** acotada a la Región Metropolitana; un **MER** conceptual en notación Chen; y un **modelo físico** completo —multilingüe, con integridad garantizada por claves foráneas compuestas y restricciones nativas, y con auditoría transaccional independiente del código de la aplicación.

Para la entrega final sumaremos los **dos formularios** y la **visualización con filtro** sobre esta misma base. Gracias por ver nuestro video; en la descripción dejamos los capítulos y el enlace al repositorio.

---

## Notas de producción

- **Una sola sesión de slides** entre 0:00 y 7:40, repartida en tres secciones (A → B → C). La presentación avanza con cambios de slide internos, pero **no se cambia la ventana compartida** hasta la demo.
- **Un único corte de pantalla** a los 7:40, de slides a terminal, dentro de la sección de C. Es la única edición fuerte.
- **Terminal preparado**: contenedores levantados, `psql` ya logueado y `mongosh` abierto en otra pestaña, ambos con tamaño de fuente legible.
- **Cronómetro visible** durante el ensayo. Cada persona dispone de **3:20**; apuntar a 9:50 en total para dejar margen ante el ±30 s.
- Sustituir los marcadores **[A]**, **[B]**, **[C]** por los nombres reales de los integrantes.
- En la sección de **magnitud**, las cifras de salud y de episodios se presentan de forma cualitativa y atribuidas (OMS, red SINCA) para no afirmar datos numéricos no verificados; el único dato duro propio es el volumen del prototipo (6.084 mediciones).
- Revisar **ortografía** en todos los slides; el PDF la evalúa explícitamente.
- Subir a YouTube **sin listar** (unlisted) y pegar el link en el formulario.
