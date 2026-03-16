import React from 'react'
import { CATEGORIES, CAT_COLORS, BRACKETS } from '../constants.js'
import SetPicker from './SetPicker.jsx'

export default function Step2Filters({ commander, slots, filters, onSlotsChange, onFiltersChange, onBack, onNext }) {
  const total = Object.values(slots).reduce((a, b) => a + b, 0)
  const totalCls = total === 99 ? 'perfect' : total > 99 ? 'over' : ''

  function adj(key, delta) {
    const next = Math.max(0, slots[key] + delta)
    onSlotsChange({ ...slots, [key]: next })
  }

  function updateFilter(key, val) {
    onFiltersChange({ ...filters, [key]: val })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters panel */}
      <div className="panel">
        <div className="panel-title">Deck Filters</div>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Power Level (Bracket)</label>
            <select
              value={filters.bracket}
              onChange={e => updateFilter('bracket', e.target.value)}
            >
              {BRACKETS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Set / Era</label>
            <SetPicker
              value={filters.setFilter}
              onChange={val => updateFilter('setFilter', val)}
            />
          </div>
          <div>
            <label style={labelStyle}>Max Budget per Card (USD)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="No limit"
              value={filters.budget}
              onChange={e => updateFilter('budget', e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>Card Categories to Include</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
            {CATEGORIES.map(c => {
              const active = filters.categories.includes(c.key)
              return (
                <button
                  key={c.key}
                  style={{
                    padding: '0.3rem 0.8rem',
                    borderRadius: 20,
                    border: `0.5px solid ${active ? CAT_COLORS[c.key] : 'var(--border)'}`,
                    background: active ? CAT_COLORS[c.key] + '33' : 'transparent',
                    color: active ? CAT_COLORS[c.key] : 'var(--text-muted)',
                    fontFamily: "'Cinzel', serif",
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => {
                    const next = active
                      ? filters.categories.filter(k => k !== c.key)
                      : [...filters.categories, c.key]
                    updateFilter('categories', next)
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Slot targets panel */}
      <div className="panel">
        <div className="panel-title">Slot Targets</div>
        <div className="info-msg">
          Your commander + 99 cards = 100. Adjust each category target to reach 99 total.
        </div>
        <div style={slotsGrid}>
          {CATEGORIES.filter(c => filters.categories.includes(c.key)).map(c => (
            <div key={c.key} style={slotItem}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.07em', color: CAT_COLORS[c.key] }}>
                {c.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button style={adjBtn} onClick={() => adj(c.key, -1)}>−</button>
                <span style={countStyle}>{slots[c.key]}</span>
                <button style={adjBtn} onClick={() => adj(c.key, +1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <div style={totalBar}>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: '0.8rem', letterSpacing: '0.05em' }}>
            Total (target 99)
          </span>
          <span style={{
            fontFamily: "'Cinzel',serif", fontSize: '1rem', fontWeight: 700,
            color: totalCls === 'perfect' ? '#3A8A3A' : totalCls === 'over' ? '#C43030' : 'var(--gold)',
          }}>
            {total} / 99
          </span>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={onBack}>← Back</button>
          <button className="btn btn-primary" onClick={onNext}>Fetch Recommendations →</button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontFamily: "'Cinzel', serif",
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.07em',
  color: 'var(--gold)',
  marginBottom: '0.4rem',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '1rem',
}

const slotsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '0.85rem',
  marginTop: '0.5rem',
}

const slotItem = {
  background: 'var(--slot-bg)',
  border: '0.5px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
}

const adjBtn = {
  width: 24, height: 24,
  borderRadius: '50%',
  border: '0.5px solid var(--border-strong)',
  background: 'transparent',
  color: 'var(--gold)',
  fontSize: '1rem',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
  flexShrink: 0,
}

const countStyle = {
  fontFamily: "'Cinzel', serif",
  fontSize: '1.1rem',
  fontWeight: 600,
  color: 'var(--text-main)',
  minWidth: 28,
  textAlign: 'center',
}

const totalBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.65rem 1rem',
  background: 'rgba(201,168,76,0.08)',
  border: '0.5px solid var(--border)',
  borderRadius: 8,
  marginTop: '1rem',
}
