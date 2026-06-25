// Gráficos basados en Recharts (SVG declarativo y responsivo). Se mantiene la
// misma API que la versión anterior hecha a mano (BarChart / LineChart) para no
// tocar los componentes que los consumen.
import { useId } from 'react';
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  AreaChart as RAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from 'recharts';

const ACCENT = '#1565c0';

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
}

export interface LinePoint {
  label: string;
  value: number;
}

// Tooltip común: muestra etiqueta, subtítulo opcional y el valor con su unidad.
function ChartTip({ active, payload, unidad }: TooltipProps<number, string> & { unidad?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = (payload[0].payload ?? {}) as Partial<BarDatum>;
  return (
    <div className="chart-tip">
      <strong>{d.label}</strong>
      {d.sub && <span className="muted"> · {d.sub}</span>}
      <div>
        {Number(payload[0].value).toFixed(1)} {unidad}
      </div>
    </div>
  );
}

// Barras horizontales: bien para etiquetas largas (nombres de comuna/estación).
export function BarChart({
  data,
  unidad = '',
  color = ACCENT,
}: {
  data: BarDatum[];
  unidad?: string;
  color?: string;
}) {
  if (data.length === 0) return <p className="muted">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <RBarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="category" dataKey="label" width={132} tick={{ fontSize: 11, fill: 'var(--ink)' }} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTip unidad={unidad} />} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={26} />
      </RBarChart>
    </ResponsiveContainer>
  );
}

// Línea con área (degradado). Para series de tiempo, perfil horario y estacionalidad.
export function LineChart({
  data,
  unidad = '',
  color = ACCENT,
}: {
  data: LinePoint[];
  unidad?: string;
  color?: string;
}) {
  if (data.length < 2) return <p className="muted">Sin datos suficientes.</p>;
  // id único por instancia para que el degradado no colisione entre gráficos.
  const gradId = `grad-${useId().replace(/[:]/g, '')}`;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RAreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={40} />
        <Tooltip content={<ChartTip unidad={unidad} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </RAreaChart>
    </ResponsiveContainer>
  );
}
