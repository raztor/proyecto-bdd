import { useEffect, useState } from 'react';
import { api, type Comuna, type Contaminante } from '../api';

// Formulario A — registra una estación. El backend escribe en DOS tablas con
// FK (ESTACION y ESTACION_CONTAMINANTE) dentro de una transacción.
export function RegistrarEstacion() {
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [contaminantes, setContaminantes] = useState<Contaminante[]>([]);

  const [comunaId, setComunaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [fechaInstalacion, setFechaInstalacion] = useState('');
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api.comunas().then(setComunas).catch((e: Error) => setError(e.message));
    api.contaminantes().then(setContaminantes).catch((e: Error) => setError(e.message));
  }, []);

  function toggleContaminante(id: number) {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!comunaId || seleccionados.length === 0) {
      setError('Selecciona una comuna y al menos un contaminante.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.registrarEstacion({
        comuna_id: Number(comunaId),
        nombre: nombre.trim(),
        latitud: Number(latitud),
        longitud: Number(longitud),
        fecha_instalacion: fechaInstalacion || undefined,
        contaminantes: seleccionados,
      });
      setOk(`${res.mensaje} (id ${res.id}).`);
      setNombre('');
      setLatitud('');
      setLongitud('');
      setFechaInstalacion('');
      setSeleccionados([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h2>Registrar estación de monitoreo</h2>
      <p className="muted">Escribe en ESTACION (FK → COMUNA) y en ESTACION_CONTAMINANTE (FK → ESTACION, CONTAMINANTE).</p>

      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-ok">{ok}</div>}

      <form className="card" onSubmit={enviar}>
        <div className="grid-form">
          <div className="campo">
            <label>Comuna *</label>
            <select value={comunaId} onChange={(e) => setComunaId(e.target.value)} required>
              <option value="">Selecciona…</option>
              {comunas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Nombre de la estación *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} />
          </div>
          <div className="campo">
            <label>Latitud *</label>
            <input
              type="number"
              step="0.000001"
              min={-90}
              max={90}
              value={latitud}
              onChange={(e) => setLatitud(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label>Longitud *</label>
            <input
              type="number"
              step="0.000001"
              min={-180}
              max={180}
              value={longitud}
              onChange={(e) => setLongitud(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label>Fecha de instalación</label>
            <input type="date" value={fechaInstalacion} onChange={(e) => setFechaInstalacion(e.target.value)} />
          </div>
        </div>

        <div className="campo" style={{ marginTop: '1rem' }}>
          <label>Contaminantes que medirá *</label>
          <div className="checkboxes">
            {contaminantes.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleContaminante(c.id)}
                />
                {c.nombre}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Registrar estación'}
          </button>
        </div>
      </form>
    </section>
  );
}
