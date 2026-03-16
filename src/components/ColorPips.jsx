import React from 'react'

const PIP_STYLE = {
  width: 18, height: 18,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 700,
  border: '1px solid rgba(0,0,0,0.15)',
}

const PIP_COLORS = {
  W: { background: 'var(--mana-W)', color: '#555' },
  U: { background: 'var(--mana-U)', color: '#1a3a6e' },
  B: { background: 'var(--mana-B)', color: '#fff' },
  R: { background: 'var(--mana-R)', color: '#fff' },
  G: { background: 'var(--mana-G)', color: '#1a3a1a' },
  C: { background: '#ccc', color: '#555' },
}

export default function ColorPips({ colorIdentity }) {
  const colors = colorIdentity?.length ? colorIdentity : ['C']
  return (
    <div style={{ display: 'flex', gap: 4, margin: '0.3rem 0' }}>
      {colors.map(c => (
        <span key={c} style={{ ...PIP_STYLE, ...PIP_COLORS[c] }}>
          {c}
        </span>
      ))}
    </div>
  )
}
