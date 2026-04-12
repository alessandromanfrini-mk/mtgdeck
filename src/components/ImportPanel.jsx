import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { enrichCards } from '../lib/scryfall.js'

/**
 * Parse a decklist into raw card entries.
 *
 * Supports Moxfield export format:
 *   "1 Card Name (SET) CN *F*"     — foil
 *   "1 Card Name (SET) CN *E*"     — etched
 *   "1 Card Name (SET) CN"         — non-foil
 *
 * And plain formats:
 *   "4 Lightning Bolt" / "4x Lightning Bolt" / "Lightning Bolt"
 *
 * Lines starting with // or # are ignored. Section headers (ending with :) are ignored.
 */
function parseDecklist(text) {
  const entries = []
  // Moxfield: "1 Card Name (SET) CN" optionally ending in " *F*" or " *E*"
  const moxRe = /^(\d+)\s+(.+?)\s+\(([^)]+)\)\s+(\S+?)(?:\s+\*(F|E)\*)?$/i

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue

    const mox = line.match(moxRe)
    if (mox) {
      const [, qty, name, set, cn, foilFlag] = mox
      const finish = foilFlag?.toUpperCase() === 'E' ? 'etched'
                   : foilFlag                        ? 'foil'
                   : 'nonFoil'
      entries.push({
        name:     name.trim(),
        quantity: parseInt(qty, 10),
        set:      set.toLowerCase(),
        cn,
        finish,
        isFoil:   finish !== 'nonFoil',
      })
      continue
    }

    // Plain "4 Card Name" / "4x Card Name"
    const simple = line.match(/^(\d+)[x×]?\s+(.+)$/)
    if (simple) {
      entries.push({ name: simple[2].trim(), quantity: parseInt(simple[1], 10), finish: 'nonFoil', isFoil: false })
      continue
    }

    // Bare name, no quantity
    if (/^[A-Z]/.test(line) && !line.endsWith(':')) {
      entries.push({ name: line, quantity: 1, finish: 'nonFoil', isFoil: false })
    }
  }
  return entries
}

// ── Hover preview ─────────────────────────────────────────────────────────────

const PREVIEW_H = 340

function CardPreview({ card }) {
  if (!card.imageUrl) return null
  return (
    <div style={{
      position: 'fixed',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <img
        src={card.imageUrl}
        alt={card.name}
        style={{
          height: PREVIEW_H,
          borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(168,180,204,0.18)',
          display: 'block',
        }}
      />
    </div>
  )
}

// ── Single card row ───────────────────────────────────────────────────────────

function ImportRow({ card, checked, onToggle, onHover, onLeave }) {
  const [hover, setHov] = useState(false)

  const bg = hover
    ? 'rgba(168,180,204,0.08)'
    : checked
      ? 'rgba(168,180,204,0.04)'
      : 'transparent'

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => { setHov(true);  onHover(card) }}
      onMouseLeave={() => { setHov(false); onLeave() }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.35rem 0.75rem',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.83rem', cursor: 'pointer', userSelect: 'none',
        background: bg, transition: 'background 0.1s',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
        border: `1.5px solid ${checked ? 'var(--silver)' : 'var(--border-strong)'}`,
        background: checked ? 'var(--silver)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#080910', fontSize: '0.55rem', fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>

      {/* Name */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {card.name}
      </span>

      {/* Set · CN */}
      {(card.set || card.cn) && (
        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, letterSpacing: '0.03em' }}>
          {card.set?.toUpperCase()}{card.cn ? ` · ${card.cn}` : ''}
        </span>
      )}

      {/* Finish */}
      {card.finish === 'foil'   && <span style={{ fontSize: '0.65rem', color: 'var(--gold-light)', flexShrink: 0 }}>✦ foil</span>}
      {card.finish === 'etched' && <span style={{ fontSize: '0.65rem', color: '#aaa', flexShrink: 0 }}>E etched</span>}

      {/* Qty */}
      {card.quantity > 1 && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>×{card.quantity}</span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportPanel({ onImport }) {
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [stage, setStage]       = useState('')
  const [error, setError]       = useState(null)
  const [cards, setCards]       = useState([])
  const [selected, setSelected] = useState(new Set())
  const [hoveredCard, setHoveredCard] = useState(null)
  const [flash, setFlash]       = useState(false)

  async function handleParse() {
    const entries = parseDecklist(text)
    if (entries.length === 0) { setError('No cards found — paste a decklist like "1 Sol Ring".'); return }
    setLoading(true)
    setError(null)
    setCards([])
    setSelected(new Set())
    try {
      setStage(`Enriching ${entries.length} cards with Scryfall…`)
      // Give each entry a stable key before enrichment
      const keyed   = entries.map((e, i) => ({ ...e, sources: ['Import'], _srcKey: `import__${i}` }))
      const enriched = await enrichCards(keyed)
      setCards(enriched)
      setSelected(new Set(enriched.map((_, i) => i)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  function toggleCard(i) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    setSelected(
      selected.size === cards.length
        ? new Set()
        : new Set(cards.map((_, i) => i))
    )
  }

  function handleAdd() {
    const toAdd = cards.filter((_, i) => selected.has(i))
    onImport(toAdd)
    setFlash(true)
    setTimeout(() => {
      setFlash(false)
      setCards([])
      setSelected(new Set())
      setUrl('')
    }, 1200)
  }

  const allSelected = cards.length > 0 && selected.size === cards.length

  return (
    <div className="panel" style={{ marginBottom: '1.25rem', position: 'relative', zIndex: 5 }}>
      <div className="panel-title">Import Decklist</div>

      {/* Textarea + button */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <textarea
          placeholder={'Paste your decklist here…\n\n1 Sol Ring\n1 Command Tower\n4x Lightning Bolt'}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          style={{
            flex: 1, resize: 'vertical', minHeight: 96,
            padding: '0.6rem 0.9rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-strong)',
            borderRadius: 5, color: 'var(--text-main)',
            fontFamily: "'Lora', Georgia, serif", fontSize: '0.9rem',
            lineHeight: 1.5, outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--silver)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,180,204,0.10)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border-strong)'; e.target.style.boxShadow = '' }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleParse}
          disabled={loading || !text.trim()}
          style={{ flexShrink: 0, alignSelf: 'flex-end' }}
        >
          {loading ? (stage || 'Loading…') : 'Import'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#c04030', fontSize: '0.82rem', marginTop: '0.6rem' }}>⚠ {error}</div>
      )}

      {/* Card list */}
      {cards.length > 0 && (
        <div style={{ marginTop: '0.85rem' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={toggleAll}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {selected.size} / {cards.length} selected
            </span>
            <button
              className={`btn btn-sm btn-primary`}
              style={{ marginLeft: 'auto' }}
              onClick={handleAdd}
              disabled={selected.size === 0 || flash}
            >
              {flash ? `✓ Added ${selected.size} cards` : `+ Add Selected (${selected.size})`}
            </button>
          </div>

          {/* Scrollable list */}
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {cards.map((card, i) => (
              <ImportRow
                key={card._srcKey ?? i}
                card={card}
                checked={selected.has(i)}
                onToggle={() => toggleCard(i)}
                onHover={c => setHoveredCard(c)}
                onLeave={() => setHoveredCard(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hover preview */}
      {hoveredCard && createPortal(
        <CardPreview card={hoveredCard} />,
        document.body
      )}
    </div>
  )
}
