import React, { useState } from 'react'
import { CATEGORIES, CAT_COLORS } from '../constants.js'
import VersionModal from './VersionModal.jsx'
import { fetchPrints, getCardImage } from '../lib/scryfall.js'

export default function Step4Export({ commander, selected, slots, prints, allPrints, onPrintChosen, onAllPrintsLoaded, onRemoveCard, onBack }) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [versionCard, setVersionCard] = useState(null)

  // Group selected cards by category
  const grouped = {}
  CATEGORIES.forEach(c => { grouped[c.key] = [] })
  Object.values(selected).forEach(card => {
    if (grouped[card._cat]) grouped[card._cat].push(card)
    else grouped['utility'].push(card)
  })

  // Build export text (Moxfield-compatible)
  const exportLines = [`1 ${commander.name} *CMDR*`]
  CATEGORIES.forEach(c => {
    grouped[c.key].forEach(card => {
      const print = prints[card.id]
      const setCode = print ? print.set.toUpperCase() : ''
      const cn = print ? print.collector_number : ''
      const foilStr = print?.foil && !print?.nonfoil ? ' *F*' : ''
      exportLines.push(`1 ${card.name}${setCode ? ` (${setCode}) ${cn}` : ''}${foilStr}`)
    })
  })
  const exportText = exportLines.join('\n')

  function handleCopy() {
    navigator.clipboard.writeText(exportText).catch(() => {
      const ta = document.getElementById('exportTextarea')
      if (ta) { ta.select(); document.execCommand('copy') }
    })
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2500)
  }

  async function openVersionPicker(card) {
    setVersionCard(card)
    if (!allPrints[card.id]) {
      const data = await fetchPrints(card.name)
      onAllPrintsLoaded(card.id, data)
      if (!prints[card.id] && data.length) onPrintChosen(card.id, data[0])
    }
  }

  const totalCards = Object.keys(selected).length + 1

  return (
    <>
      <div className="two-col">
        {/* Left: decklist */}
        <div className="panel" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <div className="panel-title">Decklist — {totalCards} cards</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.85rem' }}>
            Click a card image to choose a printing.
          </div>

          <div style={sectionTitleStyle}>Commander (1)</div>
          <div style={deckRowStyle}>
            {commander.image_uris && (
              <img
                src={commander.image_uris.small}
                alt={commander.name}
                style={rowImgStyle}
              />
            )}
            <span style={{ flex: 1, fontSize: '0.9rem' }}>{commander.name}</span>
          </div>

          {CATEGORIES.map(c => {
            const cards = grouped[c.key]
            if (!cards.length) return null
            return (
              <div key={c.key} className="section-gap">
                <div style={{ ...sectionTitleStyle, color: CAT_COLORS[c.key] }}>
                  {c.label} ({cards.length})
                </div>
                {cards.map(card => {
                  const print = prints[card.id]
                  const imgSrc = print
                    ? (print.image_uris?.small || card.imageUrl)
                    : card.imageUrl
                  return (
                    <div key={card.id} style={deckRowStyle}>
                      <img
                        src={imgSrc}
                        alt={card.name}
                        style={{ ...rowImgStyle, cursor: 'pointer' }}
                        title="Click to choose printing"
                        onClick={() => openVersionPicker(card)}
                      />
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>
                        {card.name}
                        {print && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {' '}· {print.set_name || print.set}
                          </span>
                        )}
                      </span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onRemoveCard(card.id)}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Right: export + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="panel">
            <div className="panel-title">Export to Moxfield</div>
            <div className="info-msg">
              Copy this text → Moxfield → Edit Deck → Import → Paste &amp; confirm.
            </div>
            <div style={exportBoxStyle}>
              <textarea
                id="exportTextarea"
                readOnly
                value={exportText}
                style={textareaStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleCopy}>
                {copySuccess ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              <button className="btn" onClick={onBack}>← Back to Cards</button>
              <a
                className="btn"
                href="https://www.moxfield.com/decks/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Moxfield ↗
              </a>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Deck Summary</div>
            {CATEGORIES.map(c => {
              const n = grouped[c.key].length
              return (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '0.5px solid var(--border)', fontSize: '0.88rem' }}>
                  <span style={{ color: CAT_COLORS[c.key], fontFamily: "'Cinzel',serif", fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {c.label}
                  </span>
                  <span>
                    {n} <span style={{ color: 'var(--text-muted)' }}>/ {slots[c.key]}</span>
                  </span>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', fontFamily: "'Cinzel',serif", fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--gold)' }}>Total</span>
              <span>{totalCards} / 100</span>
            </div>
          </div>
        </div>
      </div>

      {versionCard && (
        <VersionModal
          card={versionCard}
          allPrints={allPrints}
          chosenPrint={prints[versionCard.id]}
          onChoose={print => {
            onPrintChosen(versionCard.id, print)
          }}
          onClose={() => setVersionCard(null)}
        />
      )}
    </>
  )
}

const sectionTitleStyle = {
  fontFamily: "'Cinzel', serif",
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--gold)',
  letterSpacing: '0.08em',
  marginBottom: '0.5rem',
  paddingBottom: '0.35rem',
  borderBottom: '0.5px solid var(--border)',
}

const deckRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.35rem 0.5rem',
  borderRadius: 6,
}

const rowImgStyle = {
  width: 26, height: 36,
  objectFit: 'cover',
  borderRadius: 2,
  border: '0.5px solid var(--border)',
}

const exportBoxStyle = {
  background: 'var(--surface2)',
  border: '0.5px solid var(--border)',
  borderRadius: 8,
  padding: '1rem',
}

const textareaStyle = {
  width: '100%',
  height: 200,
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  color: 'var(--text-main)',
  background: 'transparent',
  border: 'none',
  resize: 'vertical',
  outline: 'none',
  lineHeight: 1.6,
}
