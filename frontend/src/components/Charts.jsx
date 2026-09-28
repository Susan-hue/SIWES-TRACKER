/**
 * Small hand-rolled charts. Every chart here is a single series, so one
 * validated hue (--series-1) carries the data and text stays in ink tokens.
 */

/** Horizontal bars: label on the left, value at the bar tip, tooltip on hover/focus. */
export function BarList({ rows, max, emptyText = 'No data yet', stacked = false }) {
  if (!rows.length) return <p className="muted small">{emptyText}</p>
  const scale = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0))
  return (
    <ul className={`barlist ${stacked ? 'stacked' : ''}`}>
      {rows.map((row) => {
        const width = row.value ? Math.max(1.5, (row.value / scale) * 100) : 0
        return (
          <li key={row.key} className="barlist-row" tabIndex={0} data-tip={row.tip}>
            <span className="barlist-label" title={row.label}>
              {row.dot && <span className={`dot st-${row.dot}`} />}
              {row.label}
            </span>
            <span className="barlist-track">
              {width > 0 && <span className="barlist-bar" style={{ width: `${width}%` }} />}
              <span className="barlist-value">{row.display}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Vertical columns over time, value on each non-zero cap. */
export function ColumnChart({ points }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div className="columns" role="img" aria-label={points.map((p) => `${p.label}: ${p.value}`).join(', ')}>
      <div className="columns-plot">
        {points.map((p) => (
          <div key={p.key} className="column" tabIndex={0} data-tip={p.tip}>
            <span className="column-value">{p.value || ''}</span>
            <span className="column-bar" style={{ height: `${(p.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="columns-axis">
        {points.map((p, i) => (
          <span key={p.key}>{i % 2 === points.length % 2 ? '' : p.label}</span>
        ))}
      </div>
    </div>
  )
}
