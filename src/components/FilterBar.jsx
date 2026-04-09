import React from 'react'

const COLORS = [
  { key: 'W', label: 'W', title: 'White'     },
  { key: 'U', label: 'U', title: 'Blue'      },
  { key: 'B', label: 'B', title: 'Black'     },
  { key: 'R', label: 'R', title: 'Red'       },
  { key: 'G', label: 'G', title: 'Green'     },
  { key: 'C', label: 'C', title: 'Colorless' },
]

const TYPES = ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery']

const SORT_OPTIONS = [
  { value: 'name',      label: 'Name A–Z'    },
  { value: 'cmc_asc',   label: 'CMC ↑'       },
  { value: 'cmc_desc',  label: 'CMC ↓'       },
  { value: 'qty_desc',  label: 'Quantity ↓'  },
  { value: 'type',      label: 'Type'        },
  { value: 'color',     label: 'Color'       },
  { value: 'rarity',    label: 'Rarity'      },
]

function toggle(arr, key) {
  return arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]
}

export default function FilterBar({ filters, onFiltersChange, total, unique }) {
  const { search, colors, types, sort } = filters

  return (
    <div className="panel filter-bar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
        <span className="panel-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          Filters
        </span>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {total} cards &nbsp;·&nbsp; {unique} unique
        </span>
      </div>

      <div className="filter-row">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
          style={{ maxWidth: 260 }}
        />

        <div className="filter-group">
          {COLORS.map(c => (
            <button
              key={c.key}
              className={`color-toggle color-toggle-${c.key}${colors.includes(c.key) ? ' active' : ''}`}
              onClick={() => onFiltersChange({ ...filters, colors: toggle(colors, c.key) })}
              title={c.title}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="filter-group" style={{ flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button
              key={t}
              className={`type-toggle${types.includes(t) ? ' active' : ''}`}
              onClick={() => onFiltersChange({ ...filters, types: toggle(types, t) })}
            >
              {t}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => onFiltersChange({ ...filters, sort: e.target.value })}
          style={{ width: 'auto', minWidth: 130 }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {(search || colors.length || types.length) && (
          <button
            className="btn btn-sm"
            onClick={() => onFiltersChange({ search: '', colors: [], types: [], sort })}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
