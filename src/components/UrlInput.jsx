import React from 'react'
import { detectSite } from '../lib/fetchers.js'

const SITE_COLORS = {
  Moxfield:  { bg: 'rgba(100,160,220,0.15)', color: '#5090c0', border: 'rgba(100,160,220,0.4)' },
  Archidekt: { bg: 'rgba(120,190,120,0.15)', color: '#3a8a3a', border: 'rgba(120,190,120,0.4)' },
  TappedOut: { bg: 'rgba(220,140,60,0.15)',  color: '#b06020', border: 'rgba(220,140,60,0.4)'  },
}

const STATUS_STYLE = {
  loading: { color: 'var(--silver)',   label: 'Loading…' },
  done:    { color: '#4a9a4a',        label: '✓' },
  error:   { color: '#c04030',        label: '✗' },
}

export default function UrlInput({ urls, onUrlsChange, onLoad, statuses, loading }) {
  function updateUrl(i, val) {
    const next = [...urls]
    next[i] = val
    onUrlsChange(next)
  }

  function addRow() {
    onUrlsChange([...urls, ''])
  }

  function removeRow(i) {
    if (urls.length === 1) { onUrlsChange(['']); return }
    onUrlsChange(urls.filter((_, idx) => idx !== i))
  }

  const activeUrls = urls.map(u => u.trim()).filter(Boolean)
  const canLoad = !loading && activeUrls.length > 0

  return (
    <div className="panel" style={{ marginBottom: '1.5rem' }}>
      <div className="panel-title">Deck URLs</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
        {urls.map((url, i) => {
          const site    = detectSite(url.trim())
          const siteStyle = site ? SITE_COLORS[site] : null
          const st      = statuses[url.trim()]

          return (
            <div key={i} className="url-row">
              <input
                type="text"
                value={url}
                placeholder="Paste a Moxfield, Archidekt, or TappedOut deck URL…"
                onChange={e => updateUrl(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && i === urls.length - 1) addRow() }}
                style={{ flex: 1 }}
              />

              {site && (
                <span className="site-badge" style={siteStyle}>{site}</span>
              )}

              {st && (
                <span
                  className="status-badge"
                  style={{ color: STATUS_STYLE[st.state]?.color }}
                  title={st.error ?? st.deckName ?? ''}
                >
                  {st.state === 'done'  && (st.deckName ?? '✓')}
                  {st.state === 'loading' && 'Loading…'}
                  {st.state === 'error'  && `✗ ${st.error}`}
                </span>
              )}

              <button
                className="btn btn-sm btn-danger"
                onClick={() => removeRow(i)}
                title="Remove"
                style={{ flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-sm" onClick={addRow}>+ Add URL</button>
        <button
          className="btn btn-primary"
          onClick={() => onLoad(activeUrls)}
          disabled={!canLoad}
          style={{ opacity: canLoad ? 1 : 0.5 }}
        >
          {loading ? 'Loading…' : `Load ${activeUrls.length > 1 ? `${activeUrls.length} Decks` : 'Deck'}`}
        </button>
        {loading && <div className="spinner" style={{ width: 20, height: 20, margin: 0 }} />}
      </div>
    </div>
  )
}
