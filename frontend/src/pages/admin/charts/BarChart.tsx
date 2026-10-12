export interface Bar {
  label: string
  value: number
}

interface BarChartProps {
  data: Bar[]
  unit: string
}

// Horizontal single-series bars, value at each bar's tip. Plain HTML/CSS so
// long labels wrap naturally; on narrow screens the label sits above its bar.
export default function BarChart({ data, unit }: BarChartProps) {
  const max = Math.max(...data.map((bar) => bar.value), 1)

  return (
    <ul className="bar-chart">
      {data.map((bar) => (
        <li key={bar.label} className="bar-chart__row" title={`${bar.label}: ${bar.value} ${unit}`}>
          <span className="bar-chart__label">{bar.label}</span>
          <span className="bar-chart__track">
            <span
              className="bar-chart__bar"
              style={{ width: `calc(${bar.value / max} * (100% - 3rem))` }}
            />
            <span className="bar-chart__value">{bar.value.toLocaleString('en-US')}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
