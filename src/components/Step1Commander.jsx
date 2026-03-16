import React, { useState, useRef, useEffect } from 'react'
import { searchCommanders, getCardImage } from '../lib/scryfall.js'
import ColorPips from './ColorPips.jsx'

export default function Step1Commander({ commander, onConfirm }) {
  const [query, setQuery] = useState(commander?.name || '')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(commander)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (listRef.current && !listRef.current.contains(e.target)) {
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    setSelected(null)
    clearTimeout(timerRef.current)
    if (val.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchCommanders(val)
        setResults(data)
      } catch {}
      setLoading(false)
    }, 320)
  }

  function pickCard(card) {
    setSelected(card)
    setQuery(card.name)
    setResults([])
  }

  return (
    <div className="panel">
      <div className="panel-title">Choose Your Commander</div>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search for a legendary creature…"
          autoComplete="off"
        />
        {results.length > 0 && (
          <div ref={listRef} style={acListStyle}>
            {results.map(c => (
              <div
                key={c.id}
                style={acItemStyle}
                onMouseDown={() => pickCard(c)}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(201,168,76,0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {c.image_uris && (
                  <img
                    src={c.image_uris.small}
                    alt={c.name}
                    style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--text-main)' }}>{c.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {c.type_line} · {c.set_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && !results.length && (
          <div style={{ ...acListStyle, padding: '0.75rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            Searching…
          </div>
        )}
      </div>

      {selected && (
        <div style={cmdCardStyle}>
          {selected.image_uris && (
            <img
              src={getCardImage(selected, 'normal')}
              alt={selected.name}
              style={{ width: 90, height: 125, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              {selected.name}
            </h2>
            <ColorPips colorIdentity={selected.color_identity} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.35rem' }}>
              {selected.type_line}
            </div>
            {selected.oracle_text && (
              <div style={{ fontSize: '0.82rem', marginTop: '0.6rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                {selected.oracle_text.length > 200
                  ? selected.oracle_text.substring(0, 200) + '…'
                  : selected.oracle_text}
              </div>
            )}
            <div style={{ marginTop: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => onConfirm(selected)}>
                Confirm Commander →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const acListStyle = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0, right: 0,
  background: 'var(--surface)',
  border: '0.5px solid var(--border-strong)',
  borderRadius: 8,
  zIndex: 100,
  maxHeight: 280,
  overflowY: 'auto',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
}

const acItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.6rem 0.9rem',
  cursor: 'pointer',
  borderBottom: '0.5px solid var(--border)',
  transition: 'background 0.1s',
  background: 'transparent',
}

const cmdCardStyle = {
  display: 'flex',
  gap: '1.25rem',
  alignItems: 'flex-start',
  padding: '1rem',
  background: 'var(--surface2)',
  border: '0.5px solid var(--border-strong)',
  borderRadius: 10,
  marginTop: '1rem',
}
