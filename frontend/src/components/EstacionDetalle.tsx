import type { EstacionEstado } from '../api';

// Categorías para la leyenda (escala de material particulado, ODS 11.6.2).
const LEYENDA = [
  { nombre: 'Buena', color: '#00E400' },
  { nombre: 'Regular', color: '#FFFF00' },
  { nombre: 'Alerta', color: '#FF7E00' },
  { nombre: 'Preemergencia', color: '#FF0000' },
  { nombre: 'Emergencia', color: '#8F3F97' },
];

export function Leyenda() {
  return (
    <div className="legend">
      {LEYENDA.map((l) => (
        <span className="legend-item" key={l.nombre}>
          <span className="dot" style={{ background: l.color }} />
          {l.nombre}
        </span>
      ))}
    </div>
  );
}

function fmtFecha(iso?: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}

// Detalle del estado de una estación: tabla de contaminantes (última medición
// y categoría) + fecha. Se usa en el panel de estado y en el popup del mapa.
export function EstacionDetalle({ est }: { est: EstacionEstado }) {
  const ultima = est.contaminantes
    .map((c) => c.fecha_hora)
    .sort()
    .at(-1);

  return (
    <div className="estado-detalle">
      <table className="estado-tabla">
        <tbody>
          {est.contaminantes.map((c) => (
            <tr key={c.contaminante}>
              <td>{c.contaminante}</td>
              <td className="num">
                {Number(c.valor).toFixed(1)} {c.unidad}
              </td>
              <td>
                <span className="dot" style={{ background: c.color_hex ?? '#ccc' }} />
                {c.categoria_nombre ?? c.categoria ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Última medición: {fmtFecha(ultima)}</p>
    </div>
  );
}
