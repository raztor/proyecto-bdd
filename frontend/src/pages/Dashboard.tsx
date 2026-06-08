import { useEffect, useState } from 'react';
import { api, type Comuna, type Contaminante, type FilaDashboard } from '../api';

// Visualización del indicador 11.6.2: promedio de concentración por comuna y
// contaminante, clasificado en su categoría de calidad del aire. Permite
// filtrar por comuna, contaminante, rango de fechas e idioma.
export function Dashboard() {
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [contaminantes, setContaminantes] = useState<Contaminante[]>([]);
  const [filas, setFilas] = useState<FilaDashboard[]>([]);

  const [idioma, setIdioma] = useState('es');
  const [comunaId, setComunaId] = useState('');
  const [contId, setContId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.comunas().then(setComunas).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    api.contaminantes(idioma).then(setContaminantes).catch((e: Error) => setError(e.message));
  }, [idioma]);

  useEffect(() => {
    setCargando(true);
    setError(null);
    api
      .dashboard({ idioma, comuna_id: comunaId, contaminante_id: contId, desde, hasta })
      .then(setFilas)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [idioma, comunaId, contId, desde, hasta]);

  return (
    <section>
      <h2>Indicador 11.6.2 — Calidad del aire por comuna</h2>
      <p className="muted">
        Promedio de concentración sobre las mediciones registradas, clasificado en categorías de salud.
      </p>

      <div className="card">
        <div className="filtros">
          <div className="campo">
            <label>Comuna</label>
            <select value={comunaId} onChange={(e) => setComunaId(e.target.value)}>
              <option value="">Todas</option>
              {comunas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Contaminante</label>
            <select value={contId} onChange={(e) => setContId(e.target.value)}>
              <option value="">Todos</option>
              {contaminantes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="campo">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="campo">
            <label>Idioma</label>
            <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {cargando ? (
          <p className="muted">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="muted">Sin datos para los filtros seleccionados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Comuna</th>
                <th>Contaminante</th>
                <th>Promedio</th>
                <th>Categoría</th>
                <th>N.º mediciones</th>
                <th>Recomendación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.comuna_id}-${f.contaminante_id}`}>
                  <td>{f.comuna}</td>
                  <td>{f.contaminante_nombre}</td>
                  <td>
                    {Number(f.promedio).toFixed(1)} {f.unidad}
                  </td>
                  <td>
                    {f.categoria ? (
                      <span className="badge" style={{ background: f.color_hex ?? '#ccc' }}>
                        {f.categoria_nombre ?? f.categoria}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{Number(f.n_mediciones).toLocaleString('es-CL')}</td>
                  <td className="muted">{f.recomendacion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
