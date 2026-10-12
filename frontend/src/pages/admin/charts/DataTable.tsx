interface DataTableProps {
  caption: string
  columns: string[]
  rows: (string | number)[][]
}

// The numbers behind a chart, collapsed by default. Gives screen-reader and
// keyboard users (and anyone who wants exact values) the same data.
export default function DataTable({ caption, columns, rows }: DataTableProps) {
  return (
    <details className="chart-data">
      <summary>View data</summary>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((cell, index) => (
                <td key={index}>{typeof cell === 'number' ? cell.toLocaleString('en-US') : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
