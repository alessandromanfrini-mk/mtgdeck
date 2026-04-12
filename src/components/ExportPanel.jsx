import React, { useState } from 'react'
import { EXPORT_TARGETS, formatDecklist, formatDeckboxCsv, downloadCsv } from '../lib/export.js'

export default function ExportPanel({ cards }) {
  const [targetId, setTargetId] = useState('moxfield')
  const [copied, setCopied]     = useState(false)

  const target = EXPORT_TARGETS.find(t => t.id === targetId)
  const text   = formatDecklist(cards, targetId)

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.getElementById('export-textarea')
      if (ta) { ta.select(); document.execCommand('copy') }
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleCsvDownload() {
    const csv = formatDeckboxCsv(cards)
    downloadCsv(csv, 'deckbox-import.csv')
  }

  if (cards.length === 0) return null

  return (
    <div className="panel" style={{ marginTop: '1.5rem' }}>
      <div className="panel-title">Export Decklist</div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
        {EXPORT_TARGETS.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm${targetId === t.id ? ' btn-primary' : ''}`}
            onClick={() => setTargetId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {target && (
        <div className="info-msg" style={{ marginBottom: '0.75rem' }}>
          {target.hint}
        </div>
      )}

      <div style={{ background: 'var(--surface2)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem' }}>
        <textarea
          id="export-textarea"
          readOnly
          value={text}
          style={{ width: '100%', height: 200, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: 'var(--text-main)', background: 'transparent', border: 'none', resize: 'vertical', outline: 'none', lineHeight: 1.7 }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleCopy}>
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>

        {target?.hasCsv && (
          <button className="btn btn-primary" onClick={handleCsvDownload}>
            Download CSV
          </button>
        )}

        {target && (
          <a
            className="btn"
            href={target.importUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open {target.label} ↗
          </a>
        )}
      </div>
    </div>
  )
}
