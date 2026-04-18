import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getLatestBrief, getTopGainers, getTopLosers, getCardHistory, hasPriceData, getCollectionMovers } from '../lib/market.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── SVG price chart ───────────────────────────────────────────────────────────

function PriceChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontStyle: 'italic', fontSize: '0.85rem' }}>
        Not enough data yet — check back after a few daily runs.
      </div>
    )
  }

  const prices = history.map(h => parseFloat(h.price_usd)).filter(Boolean)
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = (max - min) || 1
  const W = 100, H = 40

  const pts = prices.map((p, i) =>
    `${(i / (prices.length - 1)) * W},${H - ((p - min) / range) * (H - 6) - 3}`
  ).join(' ')

  const rising = prices[prices.length - 1] >= prices[0]
  const lineColor = rising ? '#4a9a4a' : '#C8482A'
  const fillColor = rising ? 'rgba(74,154,74,0.08)' : 'rgba(200,72,42,0.08)'

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 140, display: 'block' }}
      >
        {[0.25, 0.5, 0.75].map(r => (
          <line key={r} x1={0} y1={H * (1 - r)} x2={W} y2={H * (1 - r)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={0.4} />
        ))}
        <polyline points={`0,${H} ${pts} ${W},${H}`} fill={fillColor} />
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        <span>${prices[0].toFixed(2)} · {history[0]?.recorded_at}</span>
        <span style={{ color: lineColor, fontWeight: 600 }}>${prices[prices.length - 1].toFixed(2)} · {history[history.length - 1]?.recorded_at}</span>
      </div>
    </div>
  )
}

// ── Pct change badge ──────────────────────────────────────────────────────────

function PctBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
  const up    = value >= 0
  const color = up ? '#4a9a4a' : '#C8482A'
  const bg    = up ? 'rgba(74,154,74,0.12)' : 'rgba(200,72,42,0.12)'
  return (
    <span style={{
      background: bg, color, fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem',
      borderRadius: 5, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Rarity colours ────────────────────────────────────────────────────────────

const RARITY_CLR = { mythic: '#E07030', rare: '#B89228', uncommon: '#7AAABB', common: '#888' }

// ── Card hover preview (portal) ───────────────────────────────────────────────

function CardHoverPreview({ card, x, y }) {
  const left = x + 248 > window.innerWidth ? x - 234 : x + 18
  const top  = Math.min(y - 40, window.innerHeight - 380)

  return createPortal(
    <div style={{
      position: 'fixed', left, top, zIndex: 9999,
      pointerEvents: 'none',
      animation: 'fadeInUp 0.15s ease',
    }}>
      <div style={{
        background: 'rgba(8,6,16,0.97)',
        border: '1px solid rgba(168,140,100,0.28)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.92), 0 0 0 1px rgba(168,180,204,0.12)',
        width: 216,
      }}>
        <img
          src={card.image_url}
          alt={card.name}
          style={{ width: '100%', display: 'block' }}
        />
        <div style={{ padding: '0.65rem 0.8rem 0.75rem' }}>
          {card.set_name && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif", marginBottom: '0.45rem' }}>
              {card.set_name}{card.collector_number ? ` · #${card.collector_number}` : ''}
            </div>
          )}
          {card.type_line && (
            <div style={{ fontSize: '0.66rem', color: 'rgba(200,185,155,0.7)', fontFamily: "'Lora', Georgia, serif", marginBottom: '0.45rem' }}>
              {card.type_line}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.05rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--gold)', fontWeight: 700 }}>
              ${parseFloat(card.price_now).toFixed(2)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>7d</span>
                <PctBadge value={card.pct_7d} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>30d</span>
                <PctBadge value={card.pct_30d} />
              </div>
            </div>
          </div>
          {card.rarity && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.62rem', fontFamily: "'JetBrains Mono', monospace", color: RARITY_CLR[card.rarity] ?? '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {card.rarity}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Mover card ────────────────────────────────────────────────────────────────

const IMG_H = 88
const IMG_W = Math.round(IMG_H * 5 / 7)

const RARITY_BG = {
  mythic:   'rgba(224,112,48,0.15)',
  rare:     'rgba(184,146,40,0.15)',
  uncommon: 'rgba(122,170,187,0.15)',
  common:   'rgba(136,136,136,0.10)',
}

function RarityPill({ rarity }) {
  if (!rarity) return null
  return (
    <span style={{
      fontSize: '0.58rem', fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: RARITY_CLR[rarity] ?? '#888',
      background: RARITY_BG[rarity] ?? 'transparent',
      border: `1px solid ${RARITY_CLR[rarity] ?? '#888'}44`,
      borderRadius: 3, padding: '0.08rem 0.3rem',
    }}>
      {rarity}
    </span>
  )
}

function MoverCard({ card, selected, onSelect, quantity }) {
  const [hover, setHover]       = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  function handleMouseEnter(e) { setHover(true);  setMousePos({ x: e.clientX, y: e.clientY }) }
  function handleMouseMove(e)  { setMousePos({ x: e.clientX, y: e.clientY }) }
  function handleMouseLeave()  { setHover(false) }

  const priceNow = parseFloat(card.price_now)

  return (
    <div
      onClick={() => onSelect(selected ? null : card)}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.9rem',
        padding: '0.7rem 1rem',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: selected ? 'rgba(168,180,204,0.09)' : hover ? 'rgba(255,255,255,0.025)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {hover && card.image_url && <CardHoverPreview card={card} x={mousePos.x} y={mousePos.y} />}

      {/* Thumbnail */}
      {card.image_url
        ? <img src={card.image_url} alt={card.name} style={{ height: IMG_H, width: IMG_W, objectFit: 'cover', borderRadius: 6, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.55)' }} />
        : <div style={{ width: IMG_W, height: IMG_H, background: 'var(--surface2)', borderRadius: 6, flexShrink: 0 }} />
      }

      {/* ── Centre: card identity ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>

        {/* Name */}
        <div style={{ fontSize: '0.92rem', fontWeight: 600, fontFamily: "'Lora', Georgia, serif", color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.name}
        </div>

        {/* Set name */}
        {card.set_name && (
          <div style={{ fontSize: '0.70rem', fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif", color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.set_name}
          </div>
        )}

        {/* Set code · collector number · rarity pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.61rem', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(180,160,120,0.45)', letterSpacing: '0.04em' }}>
            {card.set_code?.toUpperCase()}{card.collector_number ? ` · #${card.collector_number}` : ''}
          </span>
          <RarityPill rarity={card.rarity} />
        </div>

        {/* Type line — only if present */}
        {card.type_line && (
          <div style={{ fontSize: '0.63rem', fontFamily: "'Lora', Georgia, serif", color: 'rgba(200,185,155,0.50)', lineHeight: 1.3 }}>
            {card.type_line}
          </div>
        )}
      </div>

      {/* ── Thin divider ── */}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0, margin: '0.1rem 0' }} />

      {/* ── Right: price + % changes ── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: 110 }}>

        {/* Price block */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
            Price
          </div>
          <div style={{ fontSize: '1.0rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--silver)', fontWeight: 700, lineHeight: 1 }}>
            ${priceNow.toFixed(2)}
          </div>
          {quantity > 1 && (
            <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginTop: '0.18rem', fontFamily: "'JetBrains Mono', monospace" }}>
              ×{quantity} = <span style={{ color: 'var(--gold)', fontWeight: 600 }}>${(priceNow * quantity).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* % change rows — aligned with a mini grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', rowGap: '0.25rem', columnGap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>7d</span>
          <PctBadge value={card.pct_7d} />
          <span style={{ fontSize: '0.60rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }}>30d</span>
          <PctBadge value={card.pct_30d} />
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const WINDOWS    = ['7d', '30d']
const DIRECTIONS = ['all', 'gainers', 'losers']

export default function MarketPage({ collection = [] }) {
  const [expanded,  setExpanded]  = useState(false)
  const [window,    setWindow]    = useState('7d')
  const [direction, setDirection] = useState('all')
  const [sort,      setSort]      = useState('desc')
  const [gainers,   setGainers]   = useState([])
  const [losers,    setLosers]    = useState([])
  const [brief,     setBrief]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [hasData,   setHasData]   = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [history,   setHistory]   = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // ── Collection trends state ───────────────────────────────────────────────
  const [colExpanded,  setColExpanded]  = useState(false)
  const [colMovers,    setColMovers]    = useState([])
  const [colLoading,   setColLoading]   = useState(false)
  const [colWindow,    setColWindow]    = useState('7d')
  const [colDirection, setColDirection] = useState('all')
  const [colSort,      setColSort]      = useState('desc')
  const [colSelected,  setColSelected]  = useState(null)
  const [colHistory,   setColHistory]   = useState([])
  const [colHistLoading, setColHistLoading] = useState(false)

  // Load movers + brief
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTopGainers(window),
      getTopLosers(window),
      getLatestBrief(),
    ]).then(([g, l, b]) => {
      setGainers(g)
      setLosers(l)
      setBrief(b)
      setLoading(false)
      // If no movers, check whether price data exists at all (history still accumulating)
      if (g.length === 0 && l.length === 0) {
        hasPriceData().then(setHasData)
      } else {
        setHasData(true)
      }
    })
  }, [window])

  // Load card history when selected
  useEffect(() => {
    if (!selected) { setHistory([]); return }
    setHistLoading(true)
    getCardHistory(selected.card_id).then(h => {
      setHistory(h)
      setHistLoading(false)
    })
  }, [selected])

  // Load collection movers whenever collection changes
  useEffect(() => {
    if (collection.length === 0) return
    const ids = [...new Set(collection.map(c => c.id).filter(id => UUID_RE.test(id)))]
    if (ids.length === 0) return
    setColLoading(true)
    getCollectionMovers(ids).then(rows => {
      // Attach quantity from collection so we can show value impact
      const qtyMap = new Map(collection.map(c => [c.id, (c.quantity ?? 1)]))
      setColMovers(rows.map(r => ({ ...r, quantity: qtyMap.get(r.card_id) ?? 1 })))
      setColLoading(false)
    })
  }, [collection])

  // Load chart for selected collection card
  useEffect(() => {
    if (!colSelected) { setColHistory([]); return }
    setColHistLoading(true)
    getCardHistory(colSelected.card_id).then(h => {
      setColHistory(h)
      setColHistLoading(false)
    })
  }, [colSelected])

  const pctField = { '7d': 'pct_7d', '30d': 'pct_30d' }[window]

  const rows = (() => {
    const base = direction === 'gainers' ? [...gainers]
               : direction === 'losers'  ? [...losers]
               : [...gainers, ...losers]
    return base.sort((a, b) =>
      sort === 'desc'
        ? (b[pctField] ?? 0) - (a[pctField] ?? 0)
        : (a[pctField] ?? 0) - (b[pctField] ?? 0)
    )
  })()

  return (
    <div className="page-enter">

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 600,
          color: 'var(--silver)', letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase',
        }}>
          Market Trends
        </h2>
      </div>

      {/* AI brief */}
      {brief?.brief && (
        <div className="panel" style={{ marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          {/* Panel header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <div className="panel-title" style={{ margin: 0 }}>Market Brief</div>
            {brief.created_at && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
                {new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Decorative opening quote */}
          <div style={{
            position: 'absolute', top: '0.5rem', right: '1rem',
            fontSize: '5rem', lineHeight: 1, color: 'rgba(184,146,40,0.07)',
            fontFamily: 'Georgia, serif', pointerEvents: 'none', userSelect: 'none',
          }}>
            "
          </div>

          {/* Sentences as individual lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {brief.brief
              .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
              .split('\n')
              .map(s => s.trim())
              .filter(Boolean)
              .map((sentence, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.55rem', marginTop: '0.35rem', flexShrink: 0, opacity: 0.7 }}>✦</span>
                  <span style={{ fontSize: '0.87rem', lineHeight: 1.65, color: 'var(--text-main)', fontFamily: "'Lora', Georgia, serif" }}>
                    {sentence}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {!brief && !loading && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-title">Market Brief</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            No brief yet — the daily job hasn't run. Trigger it manually from GitHub Actions to populate data.
          </p>
        </div>
      )}

      <div className="section-divider"><span>✦</span></div>

      {/* ── Market Trends toggle header ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.25rem 0', marginBottom: expanded ? '1rem' : '0', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.0rem', fontWeight: 600,
          color: 'var(--silver)', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Price Movers
        </span>
        {!loading && rows.length > 0 && (
          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {rows.length} cards
          </span>
        )}
        <span style={{
          marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.70rem',
          transition: 'transform 0.22s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>
          ▼
        </span>
      </button>

      {expanded && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {WINDOWS.map(w => (
                <button key={w} className={`btn btn-sm${window === w ? ' btn-primary' : ''}`} onClick={() => setWindow(w)}>{w}</button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {DIRECTIONS.map(d => (
                <button key={d} className={`btn btn-sm${direction === d ? ' btn-primary' : ''}`} onClick={() => setDirection(d)}>
                  {d === 'gainers' ? '▲ Gainers' : d === 'losers' ? '▼ Losers' : 'All'}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button className={`btn btn-sm${sort === 'desc' ? ' btn-primary' : ''}`} onClick={() => setSort('desc')} title="Highest % first">% ▼</button>
              <button className={`btn btn-sm${sort === 'asc'  ? ' btn-primary' : ''}`} onClick={() => setSort('asc')}  title="Lowest % first">% ▲</button>
            </div>
          </div>

          {/* Movers list */}
          {loading ? (
            <div className="loading-state"><div className="spinner" />Loading market data…</div>
          ) : rows.length === 0 ? (
            <div className="loading-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              {hasData
                ? <>Price history is still accumulating.<br /><span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Trend data will appear once 7 days of snapshots have been collected.</span></>
                : <>No data yet — the daily collection job hasn't run.<br /><span style={{ fontSize: '0.82rem' }}>Trigger the GitHub Actions workflow manually to populate prices.</span></>
              }
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              {rows.map(card => (
                <MoverCard
                  key={card.card_id}
                  card={card}
                  selected={selected?.card_id === card.card_id}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Collection Trends ─────────────────────────────────────────── */}
      {collection.length > 0 && (
        <>
          <div className="section-divider"><span>✦</span></div>

          {/* ── Collection Trends toggle header ── */}
          {(() => {
            const pf = `pct_${colWindow}`
            const totalNow  = colMovers.reduce((s, r) => s + parseFloat(r.price_now) * r.quantity, 0)
            const totalThen = colMovers.reduce((s, r) => {
              const pct = r[pf]; if (pct == null) return s
              return s + (parseFloat(r.price_now) / (1 + pct / 100)) * r.quantity
            }, 0)
            const overallPct = totalThen > 0 ? ((totalNow - totalThen) / totalThen) * 100 : null
            const up = overallPct != null && overallPct >= 0
            return (
              <button
                onClick={() => setColExpanded(e => !e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.25rem 0', marginBottom: colExpanded ? '1rem' : '0', textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.0rem', fontWeight: 600,
                  color: 'var(--silver)', letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                  My Collection Trends
                </span>
                {overallPct != null && (
                  <span style={{ fontSize: '0.70rem', fontFamily: "'JetBrains Mono', monospace", color: up ? '#4a9a4a' : '#C8482A', fontWeight: 700 }}>
                    {up ? '▲' : '▼'} {Math.abs(overallPct).toFixed(1)}%
                  </span>
                )}
                {!colLoading && colMovers.length > 0 && (
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {colMovers.length} / {collection.length} tracked
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.70rem',
                  transition: 'transform 0.22s ease',
                  transform: colExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                }}>
                  ▼
                </span>
              </button>
            )
          })()}

          {colExpanded && (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {WINDOWS.map(w => (
                    <button key={w} className={`btn btn-sm${colWindow === w ? ' btn-primary' : ''}`} onClick={() => setColWindow(w)}>{w}</button>
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {DIRECTIONS.map(d => (
                    <button key={d} className={`btn btn-sm${colDirection === d ? ' btn-primary' : ''}`} onClick={() => setColDirection(d)}>
                      {d === 'gainers' ? '▲ Gainers' : d === 'losers' ? '▼ Losers' : 'All'}
                    </button>
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button className={`btn btn-sm${colSort === 'desc' ? ' btn-primary' : ''}`} onClick={() => setColSort('desc')} title="Highest % first">% ▼</button>
                  <button className={`btn btn-sm${colSort === 'asc'  ? ' btn-primary' : ''}`} onClick={() => setColSort('asc')}  title="Lowest % first">% ▲</button>
                </div>
              </div>

              {/* Movers list */}
              {colLoading ? (
                <div className="loading-state"><div className="spinner" />Loading collection trends…</div>
              ) : colMovers.length === 0 ? (
                <div className="loading-state" style={{ padding: '2rem 1rem' }}>
                  No price data yet for your collection cards.
                </div>
              ) : (() => {
                const pf = `pct_${colWindow}`
                const hasAnyPct = colMovers.some(r => r[pf] != null)
                if (!hasAnyPct) {
                  const daysNeeded = colWindow === '7d' ? 7 : 30
                  return (
                    <div className="loading-state" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                      Price trend data is still accumulating.<br />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {daysNeeded}-day trends will appear once {daysNeeded} days of snapshots have been collected.
                      </span>
                    </div>
                  )
                }
                const sorted = [...colMovers].filter(r => r[pf] != null).sort((a, b) =>
                  colSort === 'desc' ? b[pf] - a[pf] : a[pf] - b[pf]
                )
                const colRows = colDirection === 'gainers' ? sorted.filter(r => r[pf] > 0)
                              : colDirection === 'losers'  ? sorted.filter(r => r[pf] < 0)
                              : sorted
                return (
                  <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                    {colRows.map(card => (
                      <MoverCard
                        key={card.card_id}
                        card={card}
                        selected={colSelected?.card_id === card.card_id}
                        onSelect={c => setColSelected(colSelected?.card_id === card.card_id ? null : c)}
                        quantity={card.quantity}
                      />
                    ))}
                  </div>
                )
              })()}

              {/* Collection card detail chart */}
              {colSelected && (
            <>
              <div className="section-divider"><span>✦</span></div>
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {colSelected.image_url && (
                  <div className="market-art-banner">
                    <img className="market-art-img" src={colSelected.image_url.replace('/normal/', '/art_crop/')} alt=""
                      onError={e => { e.currentTarget.style.display = 'none' }} />
                    <div className="market-art-overlay" />
                    <div className="market-art-meta">
                      <span className="market-art-name">{colSelected.name}</span>
                      <button className="btn btn-sm" onClick={() => setColSelected(null)}>✕</button>
                    </div>
                  </div>
                )}
                <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
                  {!colSelected.image_url && (
                    <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{colSelected.name}</span>
                      <button className="btn btn-sm" onClick={() => setColSelected(null)}>✕ Close</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em' }}>
                      {colSelected.set_name} · #{colSelected.collector_number}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Current: </span>
                      <span style={{ color: 'var(--silver)', fontFamily: "'JetBrains Mono', monospace" }}>${parseFloat(colSelected.price_now).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.6rem' }}>
                      {['7d', '30d'].map(w => colSelected[`pct_${w}`] != null && (
                        <span key={w} style={{ color: 'var(--text-muted)' }}>
                          {w}: <PctBadge value={colSelected[`pct_${w}`]} />
                        </span>
                      ))}
                    </div>
                  </div>
                  {colHistLoading
                    ? <div className="loading-state" style={{ padding: '1rem' }}><div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }} /></div>
                    : <PriceChart history={colHistory} />
                  }
                </div>
              </div>
            </>
          )}
            </>
          )}
        </>
      )}

      {/* Card detail chart */}
      {expanded && selected && (
        <>
          <div className="section-divider"><span>✦</span></div>
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Art banner */}
            {selected.image_url && (
              <div className="market-art-banner">
                <img
                  className="market-art-img"
                  src={selected.image_url.replace('/normal/', '/art_crop/')}
                  alt=""
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div className="market-art-overlay" />
                <div className="market-art-meta">
                  <span className="market-art-name">{selected.name}</span>
                  <button className="btn btn-sm" onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>
            )}

            <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
              {!selected.image_url && (
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{selected.name}</span>
                  <button className="btn btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em' }}>
                  {selected.set_name} · #{selected.collector_number}
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current: </span>
                  <span style={{ color: 'var(--silver)', fontFamily: "'JetBrains Mono', monospace" }}>${parseFloat(selected.price_now).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.6rem' }}>
                  {['7d', '30d'].map(w => selected[`pct_${w}`] != null && (
                    <span key={w} style={{ color: 'var(--text-muted)' }}>
                      {w}: <PctBadge value={selected[`pct_${w}`]} />
                    </span>
                  ))}
                </div>
              </div>
              {histLoading
                ? <div className="loading-state" style={{ padding: '1rem' }}><div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }} /></div>
                : <PriceChart history={history} />
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
