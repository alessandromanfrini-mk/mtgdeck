import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchPrices } from '../lib/scryfall.js'

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" viewBox%3D"0 0 146 204"%3E%3Crect width%3D"146" height%3D"204" fill%3D"%23D4A84318" rx%3D"8"%2F%3E%3C%2Fsvg%3E'

function CardPreview({ card, x, y }) {
  const img = card.imageUrl || PLACEHOLDER
  // Keep preview inside viewport
  const left = x + 160 > window.innerWidth ? x - 155 : x + 16
  const top  = Math.min(y - 20, window.innerHeight - 300)

  return createPortal(
    <div style={{
      position: 'fixed', left, top, zIndex: 9999,
      pointerEvents: 'none',
      animation: 'fadeInUp 0.15s ease',
    }}>
      <img
        src={img}
        alt={card.name}
        style={{
          width: 140,
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,180,204,0.25)',
        }}
      />
    </div>,
    document.body
  )
}

const RARITY_ORDER = { mythic: 0, rare: 1, uncommon: 2, common: 3, '': 4 }
const RARITY_COLORS = { mythic: '#e67e22', rare: '#f1c40f', uncommon: '#bdc3c7', common: 'var(--text-muted)' }

export default function FoilTracker({ cards }) {
  const [activeDeck, setActiveDeck]     = useState(null)
  const [prices, setPrices]             = useState(new Map())
  const [pricesLoaded, setPricesLoaded] = useState(false)
  const [hoveredCard, setHoveredCard]   = useState(null)
  const [mousePos, setMousePos]         = useState({ x: 0, y: 0 })

  const handleMouseEnter = useCallback((card, e) => {
    setHoveredCard(card)
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])
  const handleMouseMove  = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])
  const handleMouseLeave = useCallback(() => setHoveredCard(null), [])
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [sort, setSort]                 = useState('rarity')

  const deckNames = useMemo(
    () => [...new Set(cards.flatMap(c => c.sources))].sort(),
    [cards],
  )

  const currentDeck = activeDeck ?? deckNames[0] ?? null

  const deckCards = useMemo(
    () => cards.filter(c => c.sources.includes(currentDeck)),
    [cards, currentDeck],
  )

  const foiledCards = deckCards.filter(c => c.finish !== 'nonFoil')
  const plainCards  = deckCards.filter(c => c.finish === 'nonFoil')
  const foilPct     = deckCards.length > 0 ? Math.round((foiledCards.length / deckCards.length) * 100) : 0

  const sortedPlain = useMemo(() => {
    const list = [...plainCards]
    switch (sort) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name))
      case 'price':
        return list.sort((a, b) => {
          const pa = parseFloat(prices.get(a.id)?.usd_foil ?? prices.get(a.id)?.usd_etched ?? '0') || 0
          const pb = parseFloat(prices.get(b.id)?.usd_foil ?? prices.get(b.id)?.usd_etched ?? '0') || 0
          return pa - pb || a.name.localeCompare(b.name)
        })
      default: // rarity
        return list.sort((a, b) =>
          (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4) || a.name.localeCompare(b.name)
        )
    }
  }, [plainCards, sort, prices])

  const totalCost = useMemo(() => {
    if (!pricesLoaded) return null
    return plainCards.reduce((sum, c) => {
      const p = parseFloat(prices.get(c.id)?.usd_foil ?? prices.get(c.id)?.usd_etched ?? '0') || 0
      return sum + p
    }, 0)
  }, [plainCards, prices, pricesLoaded])

  async function handleLoadPrices() {
    setLoadingPrices(true)
    try {
      // Fetch prices for all non-foil cards across all decks at once
      const allPlain = cards.filter(c => c.finish === 'nonFoil')
      const map = await fetchPrices(allPlain)
      setPrices(map)
      setPricesLoaded(true)
      setSort('price')
    } finally {
      setLoadingPrices(false)
    }
  }

  if (cards.length === 0) return null

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-title">✦ Foil Completion Tracker</div>

      {/* Deck tabs */}
      {deckNames.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {deckNames.map(name => (
            <button
              key={name}
              className={`btn btn-sm${currentDeck === name ? ' btn-primary' : ''}`}
              onClick={() => setActiveDeck(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {foiledCards.length} / {deckCards.length} cards foiled
          </span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{foilPct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${foilPct}%`,
            background: 'linear-gradient(90deg, var(--gold-dark), var(--gold-light), var(--gold-dark))',
            backgroundSize: '200% auto',
            animation: 'bar-shimmer 2.5s linear infinite',
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {plainCards.length === 0 ? (
        <div style={{ color: '#4a9a4a', fontWeight: 600, fontSize: '0.9rem' }}>
          ✦ Fully foiled out!
        </div>
      ) : (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {plainCards.length} remaining
              {totalCost !== null && (
                <span style={{ color: 'var(--gold)', marginLeft: '0.5rem' }}>
                  · ~${totalCost.toFixed(2)} to complete
                </span>
              )}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
              {['rarity', 'name', ...(pricesLoaded ? ['price'] : [])].map(s => (
                <button
                  key={s}
                  className={`btn btn-sm${sort === s ? ' btn-primary' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              {!pricesLoaded && (
                <button
                  className="btn btn-sm"
                  onClick={handleLoadPrices}
                  disabled={loadingPrices}
                  style={{ opacity: loadingPrices ? 0.6 : 1 }}
                >
                  {loadingPrices ? 'Loading…' : '$ Prices'}
                </button>
              )}
            </div>
          </div>

          {/* Non-foil card list */}
          {hoveredCard && <CardPreview card={hoveredCard} x={mousePos.x} y={mousePos.y} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 420, overflowY: 'auto' }}>
            {sortedPlain.map(c => {
              const foilPrice = pricesLoaded
                ? parseFloat(prices.get(c.id)?.usd_foil ?? prices.get(c.id)?.usd_etched ?? '') || null
                : null
              return (
                <div
                  key={c.id + ':' + c.finish}
                  onMouseEnter={e => handleMouseEnter(c, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.3rem 0.6rem',
                    background: 'var(--surface2)',
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    cursor: 'default',
                  }}
                >
                  <span style={{ flex: 1 }}>{c.name}</span>
                  {(c.set || c.cn) && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.set?.toUpperCase()}{c.cn ? ` #${c.cn}` : ''}
                    </span>
                  )}
                  <span style={{ color: RARITY_COLORS[c.rarity] ?? 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'capitalize', minWidth: 52 }}>
                    {c.rarity}
                  </span>
                  {foilPrice !== null ? (
                    <span style={{ color: 'var(--gold)', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${foilPrice.toFixed(2)}
                    </span>
                  ) : pricesLoaded ? (
                    <span style={{ color: 'var(--text-muted)', minWidth: 52, textAlign: 'right', fontSize: '0.72rem' }}>—</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
