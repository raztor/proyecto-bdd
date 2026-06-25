import { useEffect, useState } from 'react';
import { api, type EstacionEstado } from '../api';
import { EstacionDetalle, Leyenda } from '../components/EstacionDetalle';

// Panel de estado: una tarjeta por estación con su última medición clasificada.
export function EstadoEstaciones() {
  const [data, setData] = useState<EstacionEstado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    api
      .estadoEstaciones('es')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <section>
      <h2>Estado por estación</h2>
      <p className="muted">
        Última medición disponible de cada estación, clasificada en su categoría de calidad del aire.
      </p>

      <div className="card">
        <Leyenda />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando ? (
        <div className="card">
          <p className="muted">Cargando…</p>
        </div>
      ) : (
        <div className="estado-grid">
          {data.map((est) => (
            <div className="card estado-card" key={est.id}>
              <div className="estado-head">
                <div>
                  <strong>{est.nombre}</strong>
                  <div className="muted">{est.comuna}</div>
                </div>
                {est.peor && (
                  <span className="badge" style={{ background: est.peor.color_hex ?? '#ccc' }}>
                    {est.peor.categoria_nombre ?? est.peor.categoria}
                  </span>
                )}
              </div>
              <EstacionDetalle est={est} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
