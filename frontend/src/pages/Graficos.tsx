import { useEffect, useState } from 'react';
import { api, type Comuna, type Contaminante, type GraficosData } from '../api';
import { BarChart, LineChart } from '../components/Charts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function num(v: string | null | undefined): number {
  return v == null ? 0 : Number(v);
}

// Zona de gráficos: explota toda la tabla MEDICION (millones de filas) con
// agregaciones por comuna, estación, tiempo, hora del día y mes del año.
export function Graficos() {
  const [comunas, setComunas] = useState<Comuna[]>([]);
  const [contaminantes, setContaminantes] = useState<Contaminante[]>([]);
  const [data, setData] = useState<GraficosData | null>(null);

  const [contId, setContId] = useState('');
  const [comunaId, setComunaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.comunas().then(setComunas).catch((e: Error) => setError(e.message));
    api.contaminantes('es').then(setContaminantes).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setCargando(true);
    setError(null);
    api
      .graficos({ contaminante_id: contId, comuna_id: comunaId, desde, hasta })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [contId, comunaId, desde, hasta]);

  const unidad = contaminantes.find((c) => c.id === data?.contaminante_id)?.unidad ?? '';

  return (
    <section>
      <h2>Gráficos — análisis del histórico</h2>
      <p className="muted">
        Visualizaciones calculadas sobre todas las mediciones horarias registradas (material particulado y gases).
      </p>

      <div className="card">
        <div className="filtros">
          <div className="campo">
            <label>Contaminante</label>
            <select value={contId} onChange={(e) => setContId(e.target.value)}>
              <option value="">PM2.5 (por defecto)</option>
              {contaminantes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.unidad})
                </option>
              ))}
            </select>
          </div>
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
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="campo">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando && !data ? (
        <div className="card">
          <p className="muted">Cargando…</p>
        </div>
      ) : data ? (
        <>
          <div className="kpis">
            <div className="kpi">
              <strong>{num(data.resumen.total_mediciones).toLocaleString('es-CL')}</strong>
              <span>mediciones</span>
            </div>
            <div className="kpi">
              <strong>{num(data.resumen.estaciones)}</strong>
              <span>estaciones</span>
            </div>
            <div className="kpi">
              <strong>{num(data.resumen.comunas)}</strong>
              <span>comunas</span>
            </div>
            <div className="kpi">
              <strong>{num(data.resumen.contaminantes)}</strong>
              <span>contaminantes</span>
            </div>
            <div className="kpi">
              <strong>
                {data.resumen.desde?.slice(0, 7) ?? '—'} → {data.resumen.hasta?.slice(0, 7) ?? '—'}
              </strong>
              <span>rango histórico</span>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card chart-full">
              <h3 className="chart-title">Serie temporal — promedio mensual ({unidad})</h3>
              <LineChart
                data={data.serieTemporal.map((p) => ({ label: p.periodo, value: num(p.promedio) }))}
                unidad={unidad}
              />
            </div>

            <div className="card">
              <h3 className="chart-title">Ranking por comuna (promedio)</h3>
              <p className="muted">Compara todas las comunas; ignora el filtro de comuna.</p>
              <BarChart
                data={data.porComuna.map((c) => ({ label: c.comuna, value: num(c.promedio) }))}
                unidad={unidad}
              />
            </div>

            <div className="card">
              <h3 className="chart-title">Ranking por estación (promedio)</h3>
              <BarChart
                data={data.porEstacion.map((e) => ({ label: e.estacion, value: num(e.promedio), sub: e.comuna }))}
                unidad={unidad}
              />
            </div>

            <div className="card">
              <h3 className="chart-title">Estacionalidad — promedio por mes del año</h3>
              <LineChart
                data={data.estacionalidad.map((m) => ({ label: MESES[m.mes - 1] ?? String(m.mes), value: num(m.promedio) }))}
                unidad={unidad}
              />
            </div>

            <div className="card">
              <h3 className="chart-title">Perfil horario — promedio por hora del día</h3>
              <LineChart
                data={data.perfilHorario.map((h) => ({ label: `${h.hora}h`, value: num(h.promedio) }))}
                unidad={unidad}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
