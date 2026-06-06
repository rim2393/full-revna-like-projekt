import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

type DataTableRow = {
  ariaLabel?: string
  cells: ReactNode[]
  className?: string
  id: string
  onClick?: () => void
}

type DataTableProps = {
  caption: string
  columns: string[]
  rows: DataTableRow[]
}

export function DataTable({ caption, columns, rows }: DataTableProps) {
  const { t } = useI18n()

  function shouldIgnoreRowClick(target: EventTarget | null) {
    return target instanceof Element
      ? Boolean(target.closest('a, button, input, select, textarea, label, [data-row-click-ignore]'))
      : false
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption>{t(caption)}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              aria-label={row.ariaLabel}
              className={[row.className, row.onClick ? 'data-table__row--clickable' : null].filter(Boolean).join(' ') || undefined}
              key={row.id}
              onClick={(event) => {
                if (!row.onClick || shouldIgnoreRowClick(event.target)) {
                  return
                }
                row.onClick()
              }}
              onKeyDown={(event) => {
                if (!row.onClick || shouldIgnoreRowClick(event.target)) {
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  row.onClick()
                }
              }}
              role={row.onClick ? 'button' : undefined}
              tabIndex={row.onClick ? 0 : undefined}
            >
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${columns[index]}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
