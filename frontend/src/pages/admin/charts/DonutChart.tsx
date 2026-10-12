import { useState } from 'react'

export interface Slice {
  label: string
  value: number
  // A chart color variable, e.g. 'var(--chart-series-1)'.
  color: string
}

interface DonutChartProps {
  data: Slice[]
  centerValue: string
  centerLabel: string
  unit: string
}

const SIZE = 168
const STROKE = 24
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 2 // surface-colored gap between slices

function percent(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`
}

// Donut with a headline in the middle and a legend that carries labels,
// counts and percentages, so identity never depends on color alone.
export default function DonutChart({ data, centerValue, centerLabel, unit }: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1

  // Each slice starts where the previous ones end.
  const lengths = data.map((slice) => (slice.value / total) * CIRCUMFERENCE)
  const arcs = data.map((slice, index) => ({
    slice,
    length: lengths[index],
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }))

  return (
    <div className="donut-chart">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={data
          .map((slice) => `${slice.label}: ${slice.value} ${unit} (${percent(slice.value, total)})`)
          .join(', ')}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map(({ slice, length, offset }, index) => (
            <circle
              key={slice.label}
              className="donut-chart__slice"
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={slice.color}
              strokeWidth={hover === index ? STROKE + 4 : STROKE}
              strokeDasharray={`${Math.max(length - GAP, 0)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-offset}
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
            >
              <title>{`${slice.label}: ${slice.value} ${unit} (${percent(slice.value, total)})`}</title>
            </circle>
          ))}
        </g>
        <text className="donut-chart__value" x="50%" y="48%" textAnchor="middle">
          {centerValue}
        </text>
        <text className="donut-chart__caption" x="50%" y="62%" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>

      <ul className="chart-legend">
        {data.map((slice, index) => (
          <li
            key={slice.label}
            className={hover === index ? 'chart-legend__item is-active' : 'chart-legend__item'}
          >
            <span className="chart-legend__swatch" style={{ background: slice.color }} />
            <span className="chart-legend__label">{slice.label}</span>
            <span className="chart-legend__value">
              {slice.value.toLocaleString('en-US')} · {percent(slice.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
