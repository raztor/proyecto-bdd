import { useState } from 'react';
import {
  api,
  type OpenAqLocation,
  type ImportResult,
  type MedicionImportResult,
  type BuscarOpenAqParams,
  type GeoResult,
} from '../api';

type Modo = 'ubicacion' | 'rango' | 'id';

// Importa estaciones reales desde OpenAQ por ubicación (buscador de lugares
// gratuito vía Nominatim/OpenStreetMap), rango geográfico (bbox) o id.
export function ImportarEstaciones() {
  const [modo, setModo] = useState<Modo>('ubicacion');

  // Buscador de ubicación
  const [lugar, setLugar] = useState('');
  const [lugares, setLugares] = useState<GeoResult[]>([]);
  const [ubicacionNombre, setUbicacionNombre] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radio, setRadio] = useState('15000');

  // Otros modos
  const [bbox, setBbox] = useState('-70.9,-33.7,-70.4,-33.2');
  const [id, setId] = useState('');

  const [resultados, setResultados] = useState<OpenAqLocation[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [resumen, setResumen] = useState<ImportResult | null>(null);
  const [resumenMed, setResumenMed] = useState<MedicionImportResult | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [geocodificando, setGeocodificando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importandoMed, setImportandoMed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda de estaciones en OpenAQ (núcleo, recibe los parámetros explícitos).
  async function ejecutarBusqueda(params: BuscarOpenAqParams) {
    setError(null);
    setResumen(null);
    setResumenMed(null);
    setBuscando(true);
    try {
      const locs = await api.buscarOpenAq(params);
      setResultados(locs);
      setSeleccion(new Set(locs.filter((l) => l.latitude != null && l.longitude != null).map((l) => l.externalId)));
    } catch (err) {
      setResultados([]);
      setError((err as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  // Geocodifica el texto del buscador de ubicación.
  async function buscarLugar() {
    if (lugar.trim().length < 3) {
      setError('Escribe al menos 3 caracteres para buscar un lugar');
      return;
    }
    setError(null);
    setGeocodificando(true);
    try {
      const r = await api.geocodificar(lugar.trim());
      setLugares(r);
      if (r.length === 0) setError('Sin resultados para esa ubicación');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeocodificando(false);
    }
  }

  // Elige un lugar geocodificado: fija las coordenadas y busca estaciones alrededor.
  async function elegirLugar(g: GeoResult) {
    setLat(String(g.lat));
    setLon(String(g.lon));
    setUbicacionNombre(g.nombre);
    setLugares([]);
    await ejecutarBusqueda({ lat: String(g.lat), lon: String(g.lon), radio });
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === 'id') {
      await ejecutarBusqueda({ id });
    } else if (modo === 'rango') {
      await ejecutarBusqueda({ bbox });
    } else {
      if (!lat || !lon) {
        setError('Busca y elige una ubicación primero');
        return;
      }
      await ejecutarBusqueda({ lat, lon, radio });
    }
  }

  function toggle(extId: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(extId)) next.delete(extId);
      else next.add(extId);
      return next;
    });
  }

  async function importar() {
    setError(null);
    setResumen(null);
    setImportando(true);
    try {
      const res = await api.importarEstaciones({ ids: [...seleccion] });
      setResumen(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImportando(false);
    }
  }

  async function traerMediciones() {
    setError(null);
    setResumenMed(null);
    setImportandoMed(true);
    try {
      const res = await api.importarMediciones({ ids: [...seleccion] });
      setResumenMed(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImportandoMed(false);
    }
  }

  return (
    <section>
      <h2>Importar estaciones desde OpenAQ</h2>
      <p className="muted">
        Trae estaciones reales (nombre, coordenadas y contaminantes) y las guarda en la base de datos. Requiere
        configurar <code>OPENAQ_API_KEY</code> en el backend (clave gratis en explore.openaq.org).
      </p>

      <form className="card" onSubmit={buscar}>
        <div className="filtros">
          <div className="campo">
            <label>Buscar por</label>
            <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
              <option value="ubicacion">Ubicación (buscador de lugares)</option>
              <option value="rango">Rango geográfico (bbox)</option>
              <option value="id">ID de OpenAQ</option>
            </select>
          </div>

          {modo === 'ubicacion' && (
            <>
              <div className="campo" style={{ flex: 1, minWidth: 240 }}>
                <label>Lugar</label>
                <input
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder="p. ej. Providencia, Santiago"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buscarLugar();
                    }
                  }}
                />
              </div>
              <div className="campo">
                <label>Radio (m, máx. 25000)</label>
                <input value={radio} onChange={(e) => setRadio(e.target.value)} />
              </div>
              <button type="button" onClick={buscarLugar} disabled={geocodificando}>
                {geocodificando ? 'Buscando…' : 'Buscar lugar'}
              </button>
            </>
          )}

          {modo === 'rango' && (
            <>
              <div className="campo" style={{ flex: 1, minWidth: 280 }}>
                <label>bbox (minLon,minLat,maxLon,maxLat)</label>
                <input value={bbox} onChange={(e) => setBbox(e.target.value)} />
              </div>
              <button type="submit" disabled={buscando}>
                {buscando ? 'Buscando…' : 'Buscar estaciones'}
              </button>
            </>
          )}

          {modo === 'id' && (
            <>
              <div className="campo">
                <label>ID de la estación en OpenAQ</label>
                <input value={id} onChange={(e) => setId(e.target.value)} placeholder="p. ej. 25" />
              </div>
              <button type="submit" disabled={buscando}>
                {buscando ? 'Buscando…' : 'Buscar estaciones'}
              </button>
            </>
          )}
        </div>

        {modo === 'ubicacion' && lugares.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
            {lugares.map((g, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => elegirLugar(g)}
                  style={{ background: 'none', color: 'var(--accent)', border: 'none', padding: '0.2rem 0', cursor: 'pointer', textAlign: 'left' }}
                >
                  📍 {g.nombre}
                </button>
              </li>
            ))}
          </ul>
        )}

        {modo === 'ubicacion' && ubicacionNombre && (
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Ubicación elegida: <strong>{ubicacionNombre}</strong> ({Number(lat).toFixed(3)}, {Number(lon).toFixed(3)}) ·
            radio {radio} m
          </p>
        )}
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {resumen && (
        <div className="alert alert-ok">
          Importación lista: <strong>{resumen.estacionesNuevas}</strong> nuevas,{' '}
          <strong>{resumen.estacionesActualizadas}</strong> actualizadas,{' '}
          <strong>{resumen.contaminantesVinculados}</strong> contaminantes vinculados
          {resumen.omitidas.length > 0 && <> · {resumen.omitidas.length} omitidas</>}.
        </div>
      )}

      {resumenMed && (
        <div className="alert alert-ok">
          Mediciones cargadas: <strong>{resumenMed.medicionesNuevas}</strong> nuevas,{' '}
          <strong>{resumenMed.medicionesActualizadas}</strong> actualizadas en{' '}
          <strong>{resumenMed.estaciones}</strong> estación(es)
          {resumenMed.medicionesOmitidasUnidad > 0 && (
            <> · {resumenMed.medicionesOmitidasUnidad} descartadas por unidad</>
          )}
          {resumenMed.sinDatos.length > 0 && <> · {resumenMed.sinDatos.length} sin datos recientes</>}.
        </div>
      )}

      {resultados.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Estación</th>
                <th>Localidad</th>
                <th>País</th>
                <th>Coordenadas</th>
                <th>Contaminantes</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((l) => {
                const importable = l.latitude != null && l.longitude != null;
                return (
                  <tr key={l.externalId}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={!importable}
                        checked={seleccion.has(l.externalId)}
                        onChange={() => toggle(l.externalId)}
                      />
                    </td>
                    <td>
                      {l.name} <span className="muted">#{l.externalId}</span>
                    </td>
                    <td>{l.locality ?? '—'}</td>
                    <td>{l.country ?? '—'}</td>
                    <td className="muted">
                      {importable ? `${l.latitude!.toFixed(3)}, ${l.longitude!.toFixed(3)}` : 'sin coordenadas'}
                    </td>
                    <td className="muted">{l.parametros.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={importar} disabled={importando || seleccion.size === 0}>
              {importando ? 'Importando…' : `Importar ${seleccion.size} seleccionada(s)`}
            </button>
            <button onClick={traerMediciones} disabled={importandoMed || seleccion.size === 0}>
              {importandoMed ? 'Trayendo…' : 'Traer mediciones recientes'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
