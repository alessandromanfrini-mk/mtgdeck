import React, { useState, useEffect, useCallback } from 'react'
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
        background: selected ? 'rgba(168,180,204,0.07)' : 'transparent',
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
        <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Lora', Georgia, serif" }}>
          {card.name}
        </div>
        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
          {card.set_code?.toUpperCase()}{card.collector_number ? ` · ${card.collector_number}` : ''}
        </div>
      </div>

      {/* Price */}
      <span style={{ fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--silver)', flexShrink: 0 }}>
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

const WINDOWS    = ['7d', '30d']
const DIRECTIONS = ['all', 'gainers', 'losers']

export default function MarketPage({ collection = [] }) {
  const [window,    setWindow]    = useState('7d')
  const [direction, setDirection] = useState('all')
  const [gainers,   setGainers]   = useState([])
  const [losers,    setLosers]    = useState([])
  const [brief,     setBrief]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [hasData,   setHasData]   = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [history,   setHistory]   = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // ── Collection trends state ───────────────────────────────────────────────
  const [colMovers,    setColMovers]    = useState([])
  const [colLoading,   setColLoading]   = useState(false)
  const [colWindow,    setColWindow]    = useState('7d')
  const [colDirection, setColDirection] = useState('all')
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

  // Build display list based on direction
  const rows = direction === 'gainers' ? gainers
             : direction === 'losers'  ? losers
             : [...gainers, ...losers].sort((a, b) => Math.abs(b[pctField] ?? 0) - Math.abs(a[pctField] ?? 0))

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
          <p style={{ fontSize: '0.88rem', lineHeight: 1.75, color: 'var(--text-main)', margin: 0, fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif" }}>
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
        <div className="loading-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          {hasData
            ? <>Price history is still accumulating.<br /><span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Trend data (gainers/losers) will appear once 7 days of snapshots have been collected.</span></>
            : <>No data yet — the daily collection job hasn't run.<br /><span style={{ fontSize: '0.82rem' }}>Trigger the GitHub Actions workflow manually to populate prices.</span></>
          }
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

      {/* ── My Collection Trends ─────────────────────────────────────────── */}
      {collection.length > 0 && (
        <>
          <div className="section-divider"><span>✦</span></div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 600,
              color: 'var(--silver)', letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase',
            }}>
              My Collection Trends
            </h2>
            {colMovers.length > 0 && (() => {
              const pf = `pct_${colWindow}`
              const totalNow  = colMovers.reduce((s, r) => s + parseFloat(r.price_now) * r.quantity, 0)
              const totalThen = colMovers.reduce((s, r) => {
                const pct = r[pf]
                if (pct == null) return s
                return s + (parseFloat(r.price_now) / (1 + pct / 100)) * r.quantity
              }, 0)
              const overallPct = totalThen > 0 ? ((totalNow - totalThen) / totalThen) * 100 : null
              const up = overallPct >= 0
              return overallPct != null ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                  Tracked cards ({colWindow}):&nbsp;
                  <span style={{ color: up ? '#4a9a4a' : '#C8482A', fontWeight: 600 }}>
                    {up ? '▲' : '▼'} {Math.abs(overallPct).toFixed(1)}%
                  </span>
                  <span style={{ marginLeft: '0.4rem' }}>
                    (${totalThen.toFixed(0)} → ${totalNow.toFixed(0)})
                  </span>
                </p>
              ) : null
            })()}
          </div>

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
            {!colLoading && colMovers.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {colMovers.length} / {collection.length} cards tracked
              </span>
            )}
          </div>

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
            const sorted = [...colMovers].filter(r => r[pf] != null).sort((a, b) => b[pf] - a[pf])
            const colRows = colDirection === 'gainers' ? sorted.filter(r => r[pf] > 0)
                          : colDirection === 'losers'  ? sorted.filter(r => r[pf] < 0).reverse()
                          : sorted
            return (
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {colRows.map(card => (
                  <div
                    key={card.card_id}
                    onClick={() => setColSelected(colSelected?.card_id === card.card_id ? null : card)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.45rem 0.75rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: colSelected?.card_id === card.card_id ? 'rgba(168,180,204,0.07)' : 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (colSelected?.card_id !== card.card_id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (colSelected?.card_id !== card.card_id) e.currentTarget.style.background = 'transparent' }}
                  >
                    {card.image_url
                      ? <img src={card.image_url} alt={card.name} style={{ height: 38, borderRadius: 4, flexShrink: 0 }} />
                      : <div style={{ width: 28, height: 38, background: 'var(--surface2)', borderRadius: 4, flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Lora', Georgia, serif" }}>
                        {card.name}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
                        {card.set_code?.toUpperCase()}{card.collector_number ? ` · ${card.collector_number}` : ''}{card.quantity > 1 ? ` · ×${card.quantity}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--silver)', flexShrink: 0 }}>
                      ${parseFloat(card.price_now).toFixed(2)}
                      {card.quantity > 1 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                          (${(parseFloat(card.price_now) * card.quantity).toFixed(2)})
                        </span>
                      )}
                    </span>
                    <div style={{ flexShrink: 0, minWidth: 68, textAlign: 'right' }}>
                      <PctBadge value={card[pf]} />
                    </div>
                  </div>
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

      {/* Card detail chart */}
      {selected && (
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
