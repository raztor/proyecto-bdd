import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type EstacionEstado } from '../api';
import { EstacionDetalle, Leyenda } from '../components/EstacionDetalle';

// Centro aproximado del Gran Santiago.
const CENTRO: [number, number] = [-33.45, -70.66];

// Mapa de estaciones: marcador por estación coloreado según su categoría más
// severa; al hacer click muestra un popup con el detalle por contaminante.
export function Mapa() {
  const [data, setData] = useState<EstacionEstado[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .estadoEstaciones('es')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const estaciones = data.filter((e) => Number.isFinite(e.latitud) && Number.isFinite(e.longitud));

  return (
    <section>
      <h2>Mapa de estaciones</h2>
      <p className="muted">
        Estado actual de cada estación sobre el mapa. El color indica la categoría más severa; haz click en una estación
        para ver el detalle.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <Leyenda />
        <MapContainer center={CENTRO} zoom={10} scrollWheelZoom className="map-container">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {estaciones.map((e) => (
            <CircleMarker
              key={e.id}
              center={[e.latitud, e.longitud]}
              radius={11}
              pathOptions={{
                color: '#1f2933',
                weight: 1,
                fillColor: e.peor?.color_hex ?? '#9aa6ad',
                fillOpacity: 0.9,
              }}
            >
              <Tooltip>{e.nombre}</Tooltip>
              <Popup>
                <strong>{e.nombre}</strong>
                <div className="muted">{e.comuna}</div>
                <EstacionDetalle est={e} />
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
