import React from 'react'

const STEPS = ['Commander', 'Filters', 'Select Cards', 'Export Deck']

export default function StepNav({ step, onGoTo }) {
  return (
    <nav style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0 2rem' }}>
      {STEPS.map((label, i) => {
        const n = i + 1
        let cls = 'step-pill'
        if (n === step) cls += ' active'
        else if (n < step) cls += ' done'
        return (
          <button
            key={n}
            className={cls}
            style={pillStyle(n, STEPS.length)}
            onClick={() => n < step && onGoTo(n)}
          >
            {n}. {label}
          </button>
        )
      })}
    </nav>
  )
}

function pillStyle(n, total) {
  const base = {
    padding: '0.4rem 1.1rem',
    fontFamily: "'Cinzel', serif",
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    border: '0.5px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'default',
    transition: 'all 0.2s',
  }
  if (n === 1) return { ...base, borderRadius: '20px 0 0 20px' }
  if (n === total) return { ...base, borderRadius: '0 20px 20px 0' }
  return base
}
