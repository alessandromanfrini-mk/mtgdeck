import React, { useState, useEffect, useCallback } from 'react'
import { getLatestBrief, getTopGainers, getTopLosers, getCardHistory } from '../lib/market.js'

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
      background: bg, color, fontFamily: 'Cinzel, serif',
      fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem',
      borderRadius: 5, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Mover row ─────────────────────────────────────────────────────────────────

function MoverRow({ card, pctField, selected, onSelect }) {
  const pct = card[pctField]
  return (
    <div
      onClick={() => onSelect(selected ? null : card)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.45rem 0.75rem',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: selected ? 'rgba(212,168,67,0.08)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Thumbnail */}
      {card.image_url
        ? <img src={card.image_url} alt={card.name} style={{ height: 38, borderRadius: 4, flexShrink: 0 }} />
        : <div style={{ width: 28, height: 38, background: 'var(--surface2)', borderRadius: 4, flexShrink: 0 }} />
      }

      {/* Name + set */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.name}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}>
          {card.set_code?.toUpperCase()}{card.collector_number ? ` · ${card.collector_number}` : ''}
        </div>
      </div>

      {/* Price */}
      <span style={{ fontSize: '0.85rem', fontFamily: 'Cinzel, serif', color: 'var(--text-gold)', flexShrink: 0 }}>
        ${parseFloat(card.price_now).toFixed(2)}
      </span>

      {/* % change */}
      <div style={{ flexShrink: 0, minWidth: 68, textAlign: 'right' }}>
        <PctBadge value={pct} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const WINDOWS    = ['7d', '30d', '90d']
const DIRECTIONS = ['all', 'gainers', 'losers']

export default function MarketPage() {
  const [window,    setWindow]    = useState('7d')
  const [direction, setDirection] = useState('all')
  const [gainers,   setGainers]   = useState([])
  const [losers,    setLosers]    = useState([])
  const [brief,     setBrief]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [history,   setHistory]   = useState([])
  const [histLoading, setHistLoading] = useState(false)

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

  const pctField = { '7d': 'pct_7d', '30d': 'pct_30d', '90d': 'pct_90d' }[window]

  // Build display list based on direction
  const rows = direction === 'gainers' ? gainers
             : direction === 'losers'  ? losers
             : [...gainers, ...losers].sort((a, b) => Math.abs(b[pctField] ?? 0) - Math.abs(a[pctField] ?? 0))

  return (
    <div className="page-enter">

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 600,
          color: 'var(--gold)', letterSpacing: '0.1em', margin: 0,
        }}>
          Market Trends
        </h2>
        {brief?.created_at && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.3rem 0 0', fontStyle: 'italic' }}>
            Last updated: {new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* AI brief */}
      {brief?.brief && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-title">AI Market Brief</div>
          <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-main)', margin: 0, fontStyle: 'italic' }}>
            "{brief.brief}"
          </p>
        </div>
      )}

      {!brief && !loading && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel-title">AI Market Brief</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            No brief yet — the daily job hasn't run. Trigger it manually from GitHub Actions to populate data.
          </p>
        </div>
      )}

      <div className="section-divider"><span>✦</span></div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {/* Window */}
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {WINDOWS.map(w => (
            <button
              key={w}
              className={`btn btn-sm${window === w ? ' btn-primary' : ''}`}
              onClick={() => setWindow(w)}
            >
              {w}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} />

        {/* Direction */}
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {DIRECTIONS.map(d => (
            <button
              key={d}
              className={`btn btn-sm${direction === d ? ' btn-primary' : ''}`}
              onClick={() => setDirection(d)}
            >
              {d === 'gainers' ? '▲ Gainers' : d === 'losers' ? '▼ Losers' : 'All'}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {rows.length} cards
        </span>
      </div>

      {/* Movers table */}
      {loading ? (
        <div className="loading-state"><div className="spinner" />Loading market data…</div>
      ) : rows.length === 0 ? (
        <div className="loading-state" style={{ padding: '3rem 1rem' }}>
          No data yet — the daily collection job hasn't run.<br />
          <span style={{ fontSize: '0.82rem' }}>Trigger the GitHub Actions workflow manually to populate prices.</span>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map(card => (
            <MoverRow
              key={card.card_id}
              card={card}
              pctField={pctField}
              selected={selected?.card_id === card.card_id}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {/* Card detail chart */}
      {selected && (
        <>
          <div className="section-divider"><span>✦</span></div>
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{selected.name}</span>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selected.set_name} · #{selected.collector_number}
              </div>
              <div style={{ fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current: </span>
                <span style={{ color: 'var(--gold)', fontFamily: 'Cinzel, serif' }}>${parseFloat(selected.price_now).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: '0.8rem', display: 'flex', gap: '0.6rem' }}>
                {['7d', '30d', '90d'].map(w => selected[`pct_${w}`] != null && (
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
        </>
      )}
    </div>
  )
}
