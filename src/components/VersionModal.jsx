import React, { useEffect } from 'react'

export default function VersionModal({ card, allPrints, chosenPrint, onChoose, onClose }) {
  const prints = allPrints[card?.id] || []

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!card) return null

  return (
    <div style={backdropStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--gold)', marginBottom: '1rem' }}>
          Choose Printing: {card.name}
        </h3>
        {prints.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading printings…</div>
        )}
        {prints.map(p => {
          const chosen = chosenPrint?.id === p.id
          const imgUrl = p.image_uris?.small || ''
          const price = p.prices?.usd ? `$${parseFloat(p.prices.usd).toFixed(2)}` : ''
          return (
            <div
              key={p.id}
              style={optionStyle(chosen)}
              onClick={() => onChoose(p)}
            >
              {imgUrl
                ? <img src={imgUrl} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 3, border: '0.5px solid var(--border)', flexShrink: 0 }} />
                : <div style={{ width: 40, height: 56, background: 'var(--parchment-dark)', borderRadius: 3, flexShrink: 0 }} />
              }
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {p.set_name || p.set}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {p.set.toUpperCase()} · #{p.collector_number}
                  {p.foil && !p.nonfoil ? ' · Foil' : ''}
                  {price ? ` · ${price}` : ''}
                </div>
              </div>
            </div>
          )
        })}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,8,3,0.6)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const modalStyle = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border-strong)',
  borderRadius: 12,
  padding: '1.5rem',
  maxWidth: 500,
  width: '100%',
  maxHeight: '80vh',
  overflowY: 'auto',
}

function optionStyle(chosen) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.65rem 0.75rem',
    border: `0.5px solid ${chosen ? 'var(--gold)' : 'var(--border)'}`,
    borderRadius: 8,
    marginBottom: '0.5rem',
    cursor: 'pointer',
    background: chosen ? 'rgba(201,168,76,0.1)' : 'transparent',
    transition: 'all 0.15s',
  }
}
