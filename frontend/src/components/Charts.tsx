// Gráficos mínimos en SVG/CSS, sin dependencias externas. Suficientes para la
// zona de visualización: barras horizontales (rankings) y línea con área
// (series de tiempo, perfil horario, estacionalidad).

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
}

// Barras horizontales: bien para etiquetas largas (nombres de comuna/estación).
export function BarChart({
  data,
  unidad = '',
  color = 'var(--accent)',
}: {
  data: BarDatum[];
  unidad?: string;
  color?: string;
}) {
  if (data.length === 0) return <p className="muted">Sin datos.</p>;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  return (
    <div className="barchart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="bar-label" title={d.label}>
            {d.label}
            {d.sub && <span className="bar-sub"> · {d.sub}</span>}
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="bar-value">
            {d.value.toFixed(1)} {unidad}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface LinePoint {
  label: string;
  value: number;
}

// Línea con área. viewBox fijo + width 100% => responsiva. Eje Y de 0 a max.
export function LineChart({
  data,
  unidad = '',
  color = 'var(--accent)',
}: {
  data: LinePoint[];
  unidad?: string;
  color?: string;
}) {
  if (data.length < 2) return <p className="muted">Sin datos suficientes.</p>;

  const W = 640;
  const H = 220;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const x = (i: number) => padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPts = `${padL},${padT + innerH} ${linePts} ${padL + innerW},${padT + innerH}`;

  // Etiquetas X: inicio, medio y fin (evita saturar con muchos puntos).
  const idxX = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const ticksY = [0, max / 2, max];

  return (
    <svg className="linechart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {ticksY.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} className="grid" />
          <text x={padL - 6} y={y(t) + 3} className="axis" textAnchor="end">
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      <polygon points={areaPts} fill={color} opacity={0.12} />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={2} />
      {idxX.map((i) => (
        <text key={i} x={x(i)} y={H - 8} className="axis" textAnchor="middle">
          {data[i].label}
        </text>
      ))}
      {unidad && (
        <text x={padL - 6} y={padT - 2} className="axis" textAnchor="end">
          {unidad}
        </text>
      )}
    </svg>
  );
}
