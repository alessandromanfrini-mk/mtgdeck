import React, { useState, useMemo } from 'react'
import { fetchPrices } from '../lib/scryfall.js'

function cardPrice(card, priceMap) {
  const p = priceMap.get(card.id)
  if (!p) return 0
  if (card.finish === 'foil')   return parseFloat(p.usd_foil   ?? p.usd ?? '0') || 0
  if (card.finish === 'etched') return parseFloat(p.usd_etched ?? p.usd_foil ?? p.usd ?? '0') || 0
  return parseFloat(p.usd ?? '0') || 0
}

export default function ValueDashboard({ cards }) {
  const [priceMap, setPriceMap]         = useState(new Map())
  const [loaded, setLoaded]             = useState(false)
  const [loading, setLoading]           = useState(false)

  const deckNames = useMemo(
    () => [...new Set(cards.flatMap(c => c.sources))].sort(),
    [cards],
  )

  async function handleLoad() {
    setLoading(true)
    try {
      const map = await fetchPrices(cards)
      setPriceMap(map)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  const totalValue = useMemo(() => {
    if (!loaded) return null
    return cards.reduce((sum, c) => sum + cardPrice(c, priceMap) * c.quantity, 0)
  }, [cards, priceMap, loaded])

  const foilValue = useMemo(() => {
    if (!loaded) return null
    return cards
      .filter(c => c.finish !== 'nonFoil')
      .reduce((sum, c) => sum + cardPrice(c, priceMap) * c.quantity, 0)
  }, [cards, priceMap, loaded])

  const perDeck = useMemo(() => {
    if (!loaded) return []
    return deckNames.map(name => {
      const dc = cards.filter(c => c.sources.includes(name))
      const value = dc.reduce((sum, c) => sum + cardPrice(c, priceMap) * c.quantity, 0)
      return { name, value, count: dc.reduce((s, c) => s + c.quantity, 0) }
    }).sort((a, b) => b.value - a.value)
  }, [cards, priceMap, loaded, deckNames])

  const topCards = useMemo(() => {
    if (!loaded) return []
    return [...cards]
      .map(c => ({ ...c, _price: cardPrice(c, priceMap) }))
      .filter(c => c._price > 0)
      .sort((a, b) => b._price - a._price)
      .slice(0, 10)
  }, [cards, priceMap, loaded])

  if (cards.length === 0) return null

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-title">Collection Value</div>

      {!loaded ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleLoad}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Loading prices…' : '$ Load Collection Value'}
          </button>
          {loading && <div className="spinner" style={{ width: 18, height: 18, margin: 0 }} />}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Value',  value: `$${totalValue.toFixed(2)}` },
              { label: 'Foil Value',   value: `$${foilValue.toFixed(2)}` },
              { label: 'Non-Foil',     value: `$${(totalValue - foilValue).toFixed(2)}` },
              { label: 'Unique Cards', value: cards.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem 1.25rem', flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Per-deck breakdown */}
          {perDeck.length > 1 && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Value by Deck</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {perDeck.map(({ name, value, count }) => {
                  const pct = totalValue > 0 ? (value / totalValue) * 100 : 0
                  return (
                    <div key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                        <span>{name}</span>
                        <span style={{ color: 'var(--gold)' }}>${value.toFixed(2)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {count} cards</span></span>
                      </div>
                      <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top 10 cards */}
          {topCards.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Most Valuable Cards</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {topCards.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0.6rem', background: 'var(--surface2)', borderRadius: 6, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 18, fontSize: '0.72rem' }}>#{i + 1}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {c.finish !== 'nonFoil' && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>✦</span>
                    )}
                    <span style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'right' }}>
                      ${c._price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
