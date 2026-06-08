const databaseName = process.env.MONGO_INITDB_DATABASE || 'calidad_aire_audit';
const auditDb = db.getSiblingDB(databaseName);

auditDb.createCollection('auditoria', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['base_datos', 'operacion', 'recurso', 'usuario', 'timestamp', 'resultado'],
      additionalProperties: true,
      properties: {
        origen_evento_id: {
          bsonType: ['long', 'int', 'decimal', 'null'],
          description: 'Id del evento en evento_auditoria_relacional cuando proviene de PostgreSQL.',
        },
        base_datos: {
          enum: ['postgresql', 'mongodb'],
          description: 'Base donde ocurre o se origina la operacion auditada.',
        },
        operacion: {
          enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
          description: 'Operacion CRUD registrada por el sistema.',
        },
        recurso: {
          bsonType: 'string',
          minLength: 1,
          description: 'Tabla relacional, coleccion o recurso afectado.',
        },
        tabla: {
          bsonType: 'string',
          description: 'Alias compatible para la tabla relacional afectada.',
        },
        usuario: {
          bsonType: 'string',
          minLength: 1,
          description: 'Identificador logico del actor.',
        },
        timestamp: {
          bsonType: 'date',
          description: 'Fecha y hora del evento auditado.',
        },
        ocurrido_en: {
          bsonType: ['date', 'null'],
          description: 'Fecha y hora original del evento en la base origen.',
        },
        payload: {
          description: 'Detalle opcional de la operacion.',
        },
        criterio: {
          description: 'Filtros o identificadores usados en SELECT/UPDATE/DELETE.',
        },
        datos_antes: {
          description: 'Estado anterior cuando la operacion lo requiere.',
        },
        datos_despues: {
          description: 'Estado posterior cuando la operacion lo requiere.',
        },
        resultado: {
          enum: ['ok', 'error'],
          description: 'Resultado de la operacion auditada.',
        },
      },
    },
  },
  validationLevel: 'moderate',
  validationAction: 'error',
});

auditDb.auditoria.createIndex({ base_datos: 1, recurso: 1, timestamp: -1 });
auditDb.auditoria.createIndex(
  { origen_evento_id: 1 },
  { unique: true, sparse: true },
);
auditDb.auditoria.createIndex({ tabla: 1, timestamp: -1 });
auditDb.auditoria.createIndex({ operacion: 1, timestamp: -1 });
auditDb.auditoria.createIndex({ usuario: 1, timestamp: -1 });
