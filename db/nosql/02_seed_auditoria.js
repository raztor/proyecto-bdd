// Seed declarativo de auditoría para garantizar el requisito de >=1.000
// registros en MongoDB sin depender del seed del backend.
//
// Se ejecuta una sola vez al crear el volumen de MongoDB
// (montado en /docker-entrypoint-initdb.d, después de 01_auditoria.js).
//
// Genera N_DOCS documentos sintéticos que cumplen el validador JSON Schema
// definido en 01_auditoria.js. Idempotencia: si la colección ya tiene al menos
// N_DOCS documentos marcados como `payload.sintetico_init: true`, no inserta
// más. Esto permite re-ejecutar el script manualmente sin duplicar.

const databaseName = process.env.MONGO_INITDB_DATABASE || 'calidad_aire_audit';
const auditDb = db.getSiblingDB(databaseName);

const N_DOCS = 1200;
const yaCargados = auditDb.auditoria.countDocuments({
  'payload.sintetico_init': true,
});

if (yaCargados >= N_DOCS) {
  print(
    'Seed de auditoría omitido: ya existen ' +
      yaCargados +
      ' documentos sintéticos iniciales.',
  );
} else {
  const tablas = [
    'estacion',
    'estacion_contaminante',
    'reporte_ciudadano',
    'medicion',
    'comuna',
    'contaminante',
    'episodio',
    'episodio_estacion',
  ];
  const operaciones = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const usuarios = ['anon', 'admin', 'monitor-sinca', 'ciudadano'];

  const docs = [];
  const ahora = Date.now();
  for (let i = 0; i < N_DOCS; i++) {
    const tabla = tablas[i % tablas.length];
    const operacion = operaciones[i % operaciones.length];
    const usuario = usuarios[i % usuarios.length];
    const diasAtras = i % 90;
    const segAtras = (i * 137) % 86400;
    const timestamp = new Date(ahora - diasAtras * 86400000 - segAtras * 1000);
    const resultado = i % 11 === 0 ? 'error' : 'ok';

    const doc = {
      base_datos: 'postgresql',
      operacion: operacion,
      recurso: tabla,
      tabla: tabla,
      usuario: usuario,
      timestamp: timestamp,
      payload: { sintetico_init: true, seq: i },
      resultado: resultado,
    };

    // Cumplir con la convención: SELECT lleva criterio; UPDATE/DELETE llevan
    // datos_antes; INSERT/UPDATE llevan datos_despues.
    if (operacion === 'SELECT') {
      doc.criterio = { id: i };
    }
    if (operacion === 'UPDATE' || operacion === 'DELETE') {
      doc.datos_antes = { id: i, valor: 'previo' };
    }
    if (operacion === 'INSERT' || operacion === 'UPDATE') {
      doc.datos_despues = { id: i, valor: 'nuevo' };
    }

    docs.push(doc);
  }

  auditDb.auditoria.insertMany(docs);
  print('Seed de auditoría: ' + N_DOCS + ' documentos sintéticos insertados.');
}
