import { useState, type PointerEvent } from 'react'
import { useElementWidth } from './useElementWidth'

export interface LinePoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LinePoint[]
  // Describes what a point is, for the tooltip and the screen-reader summary.
  title: (point: LinePoint) => string
  unit: string
  height?: number
}

const MARGIN = { top: 16, right: 40, bottom: 28, left: 40 }

// Rounds the axis up to a clean step (1, 2 or 5 × 10ⁿ) with about 4 ticks.
function niceTicks(max: number): number[] {
  const raw = Math.max(max, 1) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let tick = 0; tick <= top; tick += step) {
    ticks.push(tick)
  }
  return ticks
}

// Single-series line with a soft area wash, an end label, and a hover
// crosshair + tooltip. Draws at the container's real width.
export default function LineChart({ data, title, unit, height = 240 }: LineChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const ticks = niceTicks(Math.max(...data.map((point) => point.value)))
  const yMax = ticks[ticks.length - 1]
  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const innerHeight = height - MARGIN.top - MARGIN.bottom
  const baseline = MARGIN.top + innerHeight
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0

  const x = (index: number) => MARGIN.left + index * stepX
  const y = (value: number) => baseline - (value / yMax) * innerHeight

  const line = data.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(point.value)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${baseline} L${x(0)},${baseline} Z`

  // Thin out x labels so they don't collide; always keep the latest one.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerWidth / 56))))
  const last = data.length - 1

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    // The hit area starts half a step before the first point, so each point
    // owns the band of width stepX centered on it.
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.floor((event.clientX - box.left) / (stepX || 1))
    setHover(Math.min(Math.max(index, 0), last))
  }

  const hovered = hover === null ? null : data[hover]
  const summary = `${title(data[0])}: ${data[0].value} ${unit}. ${title(data[last])}: ${data[last].value} ${unit}.`

  return (
    <div className="line-chart" ref={containerRef}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary}>
          <g className="chart-grid">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                  {tick}
                </text>
              </g>
            ))}
          </g>
          <g className="chart-axis">
            {data.map((point, i) =>
              (last - i) % labelEvery === 0 ? (
                <text key={point.label} x={x(i)} y={height - 8} textAnchor="middle">
                  {point.label}
                </text>
              ) : null,
            )}
          </g>

          <path className="line-chart__area" d={area} />
          <path className="line-chart__line" d={line} />

          {hovered && hover !== null && (
            <line
              className="line-chart__crosshair"
              x1={x(hover)}
              x2={x(hover)}
              y1={MARGIN.top}
              y2={baseline}
            />
          )}
          <circle
            className="line-chart__dot"
            cx={x(hover ?? last)}
            cy={y((hovered ?? data[last]).value)}
            r={4}
          />
          {hover === null && (
            <text className="chart-label" x={x(last) + 10} y={y(data[last].value)} dy="0.32em">
              {data[last].value}
            </text>
          )}

          <rect
            className="line-chart__hit"
            x={MARGIN.left - stepX / 2}
            y={MARGIN.top}
            width={innerWidth + stepX}
            height={innerHeight}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(x(hover), 70), width - 70),
            top: y(hovered.value),
          }}
        >
          <span className="chart-tooltip__title">{title(hovered)}</span>
          <span>
            <strong>{hovered.value.toLocaleString('en-US')}</strong> {unit}
          </span>
        </div>
      )}
    </div>
  )
}
