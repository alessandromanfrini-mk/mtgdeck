import React from 'react'
import { CATEGORIES, CAT_COLORS, BRACKETS } from '../constants.js'

export default function Step3Cards({
  slots,
  filters,
  recommendations,
  selected,
  loading,
  activeCategory,
  onCategoryChange,
  onToggleCard,
  onBack,
  onNext,
}) {
  const visibleCats = CATEGORIES.filter(c => filters.categories.includes(c.key))
  const cat = activeCategory
  const cards = recommendations[cat] || []
  const selectedInCat = cards.filter(c => selected[c.id])
  const catInfo = CATEGORIES.find(c => c.key === cat)
  const totalSelected = Object.keys(selected).length

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Sidebar: progress */}
      <div style={{ flex: '0 0 220px', minWidth: 200 }}>
        <div className="panel">
          <div className="panel-title">Category Progress</div>
          {filters.bracket && (
            <div style={{
              fontSize: '0.72rem', fontFamily: "'Cinzel', serif", fontWeight: 600,
              color: 'var(--gold)', letterSpacing: '0.06em',
              padding: '0.3rem 0.6rem', background: 'rgba(201,168,76,0.1)',
              border: '0.5px solid var(--border)', borderRadius: 6,
              marginBottom: '0.75rem',
            }}>
              {BRACKETS.find(b => b.value === filters.bracket)?.label}
            </div>
          )}
          {visibleCats.map(c => {
            const recs = recommendations[c.key] || []
            const sel = recs.filter(x => selected[x.id]).length
            const pct = Math.min(100, Math.round((sel / Math.max(1, slots[c.key])) * 100))
            return (
              <div key={c.key} style={{ marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{
                    color: c.key === cat ? CAT_COLORS[c.key] : 'var(--text-muted)',
                    fontFamily: "'Cinzel',serif", fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em',
                  }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sel}/{slots[c.key]}</span>
                </div>
                <div className="synergy-bar">
                  <div className="synergy-fill" style={{ width: `${pct}%`, background: CAT_COLORS[c.key] }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Total selected: <strong style={{ color: 'var(--gold)' }}>{totalSelected}</strong> / 99
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={onBack}>← Back</button>
            <button className="btn btn-primary" onClick={onNext}>Build Decklist →</button>
          </div>
        </div>
      </div>

      {/* Main: card grid */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <div className="panel">
          {/* Category tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
            {visibleCats.map(c => {
              const recs = recommendations[c.key] || []
              const sel = recs.filter(x => selected[x.id]).length
              const isActive = c.key === cat
              return (
                <button
                  key={c.key}
                  style={catTabStyle(isActive)}
                  onClick={() => onCategoryChange(c.key)}
                >
                  {c.label}
                  <span style={{
                    background: 'rgba(0,0,0,0.15)', borderRadius: 10,
                    padding: '0 5px', fontSize: '0.6rem',
                  }}>
                    {sel}/{slots[c.key]}
                  </span>
                </button>
              )
            })}
          </div>

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              Fetching{filters.bracket === '5' ? ' cEDH' : ''} decklists from EDHREC…
            </div>
          )}

          {!loading && cards.length === 0 && (
            <div className="loading-state">No recommendations loaded yet.</div>
          )}

          {!loading && cards.length > 0 && (
            <>
              <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {filters.bracket
                  ? `EDHREC · ${BRACKETS.find(b => b.value === filters.bracket)?.label} decklists`
                  : 'EDHREC · all decklists'
                } · {selectedInCat.length} of {slots[cat]} selected
              </div>
              <div style={cardsGrid}>
                {cards.map(card => {
                  const isSelected = !!selected[card.id]
                  const synergyPct = Math.round((card.synergy || 0) * 100)
                  return (
                    <div
                      key={card.id}
                      style={cardThumbStyle(isSelected)}
                      onClick={() => onToggleCard(card)}
                    >
                      {isSelected && (
                        <div style={checkmarkStyle}>✓</div>
                      )}
                      <div style={{ width: '100%', aspectRatio: '745/1040', background: 'var(--parchment-dark)', overflow: 'hidden' }}>
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      </div>
                      <div style={{ padding: '0.5rem 0.6rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.2rem' }}>
                          {card.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {synergyPct}% synergy
                          {card.inclusionRate !== null && card.inclusionRate !== undefined && (
                            <span style={{ marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                              · {card.inclusionRate}% decks
                            </span>
                          )}
                          {card.prices?.usd && (
                            <span style={{ marginLeft: '0.35rem', color: 'var(--gold)' }}>
                              · ${parseFloat(card.prices.usd).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="synergy-bar">
                          <div className="synergy-fill" style={{ width: `${synergyPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function catTabStyle(active) {
  return {
    padding: '0.3rem 0.8rem',
    borderRadius: 20,
    border: `0.5px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--text-muted)',
    fontFamily: "'Cinzel', serif",
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: '0.35rem',
  }
}

function cardThumbStyle(selected) {
  return {
    background: 'var(--surface2)',
    border: `${selected ? '1.5px' : '0.5px'} solid ${selected ? 'var(--gold)' : 'var(--card-border)'}`,
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.1s',
    position: 'relative',
  }
}

const checkmarkStyle = {
  position: 'absolute',
  top: 5, right: 5,
  width: 20, height: 20,
  background: 'var(--gold)',
  color: 'var(--ink)',
  borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700,
  zIndex: 1,
}

const cardsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
  gap: '0.9rem',
  marginTop: '1rem',
}
