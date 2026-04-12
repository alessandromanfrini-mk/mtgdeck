import React, { useState, useMemo } from 'react'
import { fetchPrices } from '../lib/scryfall.js'

const FOIL_CLASS = {
  foil:           'foil-shimmer',
  etched:         'foil-shimmer etched',
  'rainbow-foil': 'foil-shimmer rainbow',
  'surge-foil':   'foil-shimmer surge',
  phyrexian:      'foil-shimmer phyrexian',
  'oil-slick':    'foil-shimmer oil-slick',
}

const RANK_STYLES = [
  { border: '2px solid #FFD700', glow: '0 0 18px rgba(255,215,0,0.55), 0 8px 32px rgba(0,0,0,0.7)', label: '#FFD700' }, // gold
  { border: '2px solid #C0C0C0', glow: '0 0 14px rgba(192,192,192,0.45), 0 8px 28px rgba(0,0,0,0.6)', label: '#C0C0C0' }, // silver
  { border: '2px solid #CD7F32', glow: '0 0 14px rgba(205,127,50,0.45), 0 8px 28px rgba(0,0,0,0.6)', label: '#CD7F32' }, // bronze
]
const DEFAULT_RANK = { border: '1px solid var(--border)', glow: '0 4px 16px rgba(0,0,0,0.5)', label: 'var(--text-muted)' }

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" viewBox%3D"0 0 146 204"%3E%3Crect width%3D"146" height%3D"204" fill%3D"%23D4A84318" rx%3D"8"%2F%3E%3C%2Fsvg%3E'

function TopCard({ card, rank, price }) {
  const [hovered, setHovered] = useState(false)
  const [imgErr, setImgErr]   = useState(false)
  const rs     = RANK_STYLES[rank - 1] ?? DEFAULT_RANK
  const isFoil = card.finish !== 'nonFoil'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: 10,
        border: rs.border,
        boxShadow: hovered
          ? rs.glow.replace('0.55', '0.9').replace('0.45', '0.75')
          : rs.glow,
        transform: hovered ? 'translateY(-6px) scale(1.04)' : 'translateY(0) scale(1)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        overflow: 'hidden',
        cursor: 'default',
      }}
    >
      {/* Card image */}
      <img
        src={imgErr || !card.imageUrl ? PLACEHOLDER : card.imageUrl}
        alt={card.name}
        onError={() => setImgErr(true)}
        style={{ width: '100%', display: 'block' }}
      />

      {/* Foil shimmer — effect varies by finish type */}
      {isFoil && <div className={FOIL_CLASS[card.finish] ?? 'foil-shimmer'} />}

      {/* Rank badge */}
      <div style={{
        position: 'absolute', top: 6, left: 6,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        borderRadius: 6, padding: '2px 7px',
        fontSize: '0.7rem', fontWeight: 700, color: rs.label,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        #{rank}
      </div>

      {/* Foil indicator */}
      {isFoil && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          fontSize: '0.68rem', color: 'var(--gold-light)',
          textShadow: '0 0 6px rgba(240,200,96,0.9)',
        }}>
          {card.finish === 'surge-foil' ? '⚡' : card.finish === 'phyrexian' ? 'Φ' : card.finish === 'oil-slick' ? '◈' : '✦'}
        </div>
      )}

      {/* Price footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
        padding: '1.5rem 0.5rem 0.4rem',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.78rem', fontWeight: 700,
          color: rank <= 3 ? rs.label : 'var(--gold)',
          fontVariantNumeric: 'tabular-nums',
          textShadow: rank === 1 ? '0 0 10px rgba(255,215,0,0.7)' : 'none',
        }}>
          {price}
        </div>
        <div style={{
          fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginTop: 1, paddingLeft: '0.25rem', paddingRight: '0.25rem',
        }}>
          {card.name}
        </div>
      </div>
    </div>
  )
}

const MARKETPLACES = [
  { id: 'tcgplayer',  label: 'TCGPlayer',  currency: '$',   note: 'USD' },
  { id: 'cardmarket', label: 'Cardmarket', currency: '€',   note: 'EUR' },
  { id: 'mtgo',       label: 'MTGO',       currency: '',    note: 'tix' },
]

function cardPrice(card, priceMap, marketplace) {
  const p = priceMap.get(card.id)
  if (!p) return 0

  if (marketplace === 'cardmarket') {
    if (card.finish === 'foil' || card.finish === 'etched')
      return parseFloat(p.eur_foil ?? p.eur ?? '0') || 0
    return parseFloat(p.eur ?? '0') || 0
  }

  if (marketplace === 'mtgo') {
    return parseFloat(p.tix ?? '0') || 0
  }

  // TCGPlayer (default)
  if (card.finish === 'foil')   return parseFloat(p.usd_foil   ?? p.usd ?? '0') || 0
  if (card.finish === 'etched') return parseFloat(p.usd_etched ?? p.usd_foil ?? p.usd ?? '0') || 0
  return parseFloat(p.usd ?? '0') || 0
}

function fmt(value, marketplace) {
  const m = MARKETPLACES.find(x => x.id === marketplace)
  if (marketplace === 'mtgo') return `${value.toFixed(1)} tix`
  return `${m.currency}${value.toFixed(2)}`
}

export default function ValueDashboard({ cards }) {
  const [priceMap, setPriceMap]       = useState(new Map())
  const [loaded, setLoaded]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [marketplace, setMarketplace] = useState('tcgplayer')

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
    return cards.reduce((sum, c) => sum + cardPrice(c, priceMap, marketplace) * c.quantity, 0)
  }, [cards, priceMap, loaded, marketplace])

  const foilValue = useMemo(() => {
    if (!loaded) return null
    return cards
      .filter(c => c.finish !== 'nonFoil')
      .reduce((sum, c) => sum + cardPrice(c, priceMap, marketplace) * c.quantity, 0)
  }, [cards, priceMap, loaded, marketplace])

  const perDeck = useMemo(() => {
    if (!loaded) return []
    return deckNames.map(name => {
      const dc = cards.filter(c => c.sources.includes(name))
      const value = dc.reduce((sum, c) => sum + cardPrice(c, priceMap, marketplace) * c.quantity, 0)
      return { name, value, count: dc.reduce((s, c) => s + c.quantity, 0) }
    }).sort((a, b) => b.value - a.value)
  }, [cards, priceMap, loaded, deckNames, marketplace])

  const topCards = useMemo(() => {
    if (!loaded) return []
    return [...cards]
      .map(c => ({ ...c, _price: cardPrice(c, priceMap, marketplace) }))
      .filter(c => c._price > 0)
      .sort((a, b) => b._price - a._price)
      .slice(0, 10)
  }, [cards, priceMap, loaded, marketplace])

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

          {/* Marketplace selector */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Prices from</span>
            {MARKETPLACES.map(m => (
              <button
                key={m.id}
                className={`btn btn-sm${marketplace === m.id ? ' btn-primary' : ''}`}
                onClick={() => setMarketplace(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Value',  value: fmt(totalValue, marketplace) },
              { label: 'Foil Value',   value: fmt(foilValue, marketplace) },
              { label: 'Non-Foil',     value: fmt(totalValue - foilValue, marketplace) },
              { label: 'Unique Cards', value: cards.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem 1.25rem', flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.10em', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--silver)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
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
                        <span style={{ color: 'var(--gold)' }}>{fmt(value, marketplace)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {count} cards</span></span>
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
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Most Valuable Cards</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.75rem',
              }}>
                {topCards.map((c, i) => (
                  <TopCard key={c.id + ':' + c.finish} card={c} rank={i + 1} price={fmt(c._price, marketplace)} />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
