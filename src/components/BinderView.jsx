import React, { useMemo, useState } from 'react'

function cnSort(cn) {
  // Parse leading digits for numeric sort; fall back to string
  const n = parseInt(cn, 10)
  return isNaN(n) ? Infinity : n
}

export default function BinderView({ cards }) {
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? cards.filter(c => c.name.toLowerCase().includes(q)) : cards
  }, [cards, search])

  const groups = useMemo(() => {
    const map = new Map()
    for (const c of visible) {
      const key = c.set_name || 'Unknown Set'
      if (!map.has(key)) map.set(key, { setName: key, set: c.set?.toUpperCase() ?? '', cards: [] })
      map.get(key).cards.push(c)
    }
    // Sort each group by collector number
    for (const g of map.values()) {
      g.cards.sort((a, b) => cnSort(a.cn) - cnSort(b.cn) || a.name.localeCompare(b.name))
    }
    // Sort groups alphabetically by set name
    return [...map.values()].sort((a, b) => a.setName.localeCompare(b.setName))
  }, [visible])

  if (cards.length === 0) return null

  return (
    <div>
      <input
        type="text"
        placeholder="Search cards…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: '1rem', boxSizing: 'border-box' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {groups.map(({ setName, set, cards: gc }) => (
          <div key={setName}>
            {/* Set header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              padding: '0.3rem 0',
              borderBottom: '1px solid var(--border)',
              marginBottom: '0.4rem',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{setName}</span>
              {set && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{set}</span>}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{gc.length} card{gc.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Card rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {gc.map(c => (
                <div key={c.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 5,
                  fontSize: '0.82rem',
                  background: 'var(--surface2)',
                }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: 36, fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {c.cn || '—'}
                  </span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {c.quantity > 1 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>×{c.quantity}</span>
                  )}
                  {c.finish === 'foil'   && <span style={{ color: 'var(--gold)', fontSize: '0.72rem' }}>✦ foil</span>}
                  {c.finish === 'etched' && <span style={{ color: '#aaa', fontSize: '0.72rem' }}>E etched</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
        {groups.length} set{groups.length !== 1 ? 's' : ''} · {visible.length} card{visible.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
