import { useEffect, useState } from 'react';
import { api, type Comuna } from '../api';

const NIVELES = [
  { valor: 1, etiqueta: '1 · Muy buena' },
  { valor: 2, etiqueta: '2 · Buena' },
  { valor: 3, etiqueta: '3 · Regular' },
  { valor: 4, etiqueta: '4 · Mala' },
  { valor: 5, etiqueta: '5 · Muy mala' },
];

// Formulario B — INSERT simple en REPORTE_CIUDADANO (FK → COMUNA).
// La fecha/hora la asigna el servidor (now()).
export function ReporteCiudadano() {
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [comunaId, setComunaId] = useState('');
  const [nivel, setNivel] = useState('3');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api.comunas().then(setComunas).catch((e: Error) => setError(e.message));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!comunaId) {
      setError('Selecciona una comuna.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.crearReporte({
        comuna_id: Number(comunaId),
        nivel_percibido: Number(nivel),
      });
      setOk(`${res.mensaje} (id ${res.id}). ¡Gracias por tu aporte!`);
      setComunaId('');
      setNivel('3');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section>
      <h2>Reporte ciudadano de calidad percibida</h2>
      <p className="muted">¿Cómo percibes la calidad del aire en tu comuna ahora mismo?</p>

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
            <label>Nivel percibido *</label>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
              {NIVELES.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </form>
    </section>
  );
}
