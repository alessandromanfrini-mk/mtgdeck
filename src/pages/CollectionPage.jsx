import React, { useState, useMemo, useCallback } from 'react'
import CardSearch from '../components/CardSearch.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
import FilterBar from '../components/FilterBar.jsx'
import CardGrid from '../components/CardGrid.jsx'
import BinderView from '../components/BinderView.jsx'
import ValueDashboard from '../components/ValueDashboard.jsx'
import { fetchPrices } from '../lib/scryfall.js'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], foil: false, sort: 'name' }

export default function CollectionPage({
  collection, colLoading, colError,
  onAddCard, onRemoveCard, onClearCollection, onImport,
}) {
  const [filters, setFilters]           = useState(DEFAULT_FILTERS)
  const [view, setView]                 = useState('gallery')
  const [drawerOpen, setDrawer]         = useState(false)
  const [addTab, setAddTab]             = useState('single')
  const [cardsExpanded, setCardsExpanded] = useState(false)

  // ── Shared price state ───────────────────────────────────────────────────────
  const [priceMap,      setPriceMap]      = useState(new Map())
  const [pricesLoaded,  setPricesLoaded]  = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)

  const handleLoadPrices = useCallback(async () => {
    setPricesLoading(true)
    try {
      const map = await fetchPrices(collection)
      setPriceMap(map)
      setPricesLoaded(true)
    } finally {
      setPricesLoading(false)
    }
  }, [collection])

  const total = useMemo(() => collection.reduce((s, c) => s + c.quantity, 0), [collection])

  if (colLoading) {
    return <div className="loading-state"><div className="spinner" />Loading collection…</div>
  }

  return (
    <div className="page-enter">
      {colError && (
        <div style={{ color: '#c04030', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠ {colError}</div>
      )}

      {/* ── Add Cards Drawer ── */}
      <button
        className={`add-cards-trigger${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawer(d => !d)}
      >
        <span className="trigger-icon">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <polygon points="10,1 19,10 10,19 1,10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <line x1="10" y1="1"  x2="10" y2="7"  stroke="currentColor" strokeWidth="0.9" opacity="0.5"/>
            <line x1="10" y1="13" x2="10" y2="19" stroke="currentColor" strokeWidth="0.9" opacity="0.5"/>
            <line x1="1"  y1="10" x2="7"  y2="10" stroke="currentColor" strokeWidth="0.9" opacity="0.5"/>
            <line x1="13" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="0.9" opacity="0.5"/>
            <circle cx="10" cy="10" r="2.4" fill="currentColor"/>
          </svg>
        </span>
        <span className="trigger-label">
          Add Cards
          <span className="trigger-hint">single card or import list</span>
        </span>
        <span className="trigger-arrow">▼</span>
      </button>

      <div className={`add-cards-body${drawerOpen ? ' open' : ''}`}>
        <div className="add-cards-inner">
          <div className="add-cards-content">
            <div className="add-cards-tabs">
              <button
                className={`add-tab${addTab === 'single' ? ' active' : ''}`}
                onClick={() => setAddTab('single')}
              >
                Single Card
              </button>
              <button
                className={`add-tab${addTab === 'import' ? ' active' : ''}`}
                onClick={() => setAddTab('import')}
              >
                Import List
              </button>
            </div>
            {addTab === 'single' && <CardSearch onAdd={onAddCard} />}
            {addTab === 'import' && <ImportPanel onImport={onImport} />}
          </div>
        </div>
      </div>

      {collection.length === 0 ? (
        <div className="loading-state" style={{ padding: '3rem 1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>Your collection is empty.</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Search for cards above, or go to <strong>Loaded Decks</strong> and click <strong>+ Save to Collection</strong>.
          </div>
        </div>
      ) : (
        <>
          <div className="section-divider"><span>✦</span></div>

          {/* ── Cards toggle header ── */}
          <button
            onClick={() => setCardsExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.25rem 0', marginBottom: cardsExpanded ? '1rem' : '1.5rem', textAlign: 'left',
            }}
          >
            <span style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.0rem', fontWeight: 600,
              color: 'var(--silver)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Cards
            </span>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {collection.length} unique · {total} total
            </span>

            {/* Load Prices button — inline, stops propagation to avoid toggling expand */}
            {!pricesLoaded ? (
              <button
                className="btn btn-sm btn-primary"
                disabled={pricesLoading}
                style={{ fontSize: '0.68rem', padding: '0.18rem 0.55rem', opacity: pricesLoading ? 0.6 : 1 }}
                onClick={e => { e.stopPropagation(); handleLoadPrices() }}
              >
                {pricesLoading
                  ? <><span className="spinner" style={{ width: 10, height: 10, display: 'inline-block', marginRight: '0.3rem', verticalAlign: 'middle' }} />Loading…</>
                  : '$ Load Prices'}
              </button>
            ) : (
              <span style={{ fontSize: '0.68rem', color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace' " }}>
                prices loaded
              </span>
            )}

            <button
              className="btn btn-sm btn-danger"
              style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '0.18rem 0.55rem' }}
              onClick={e => { e.stopPropagation(); onClearCollection() }}
            >
              Clear
            </button>
            <span style={{
              color: 'var(--text-muted)', fontSize: '0.70rem',
              transition: 'transform 0.22s ease',
              transform: cardsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>
              ▼
            </span>
          </button>

          {cardsExpanded && (
            <>
              <FilterBar filters={filters} onFiltersChange={setFilters} total={total} unique={collection.length} />
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className={`btn btn-sm${view === 'gallery' ? ' btn-primary' : ''}`} onClick={() => setView('gallery')}>Gallery</button>
                <button className={`btn btn-sm${view === 'binder'  ? ' btn-primary' : ''}`} onClick={() => setView('binder')}>Binder</button>
              </div>
              {view === 'gallery' && <CardGrid cards={collection} filters={filters} onRemove={onRemoveCard} priceMap={priceMap} />}
              {view === 'binder'  && <div className="panel"><div className="panel-title">Binder View</div><BinderView cards={collection} /></div>}
            </>
          )}

          <div className="section-divider"><span>✦</span></div>
          <ValueDashboard
            cards={collection}
            priceMap={priceMap}
            pricesLoaded={pricesLoaded}
            pricesLoading={pricesLoading}
            onLoadPrices={handleLoadPrices}
          />

        </>
      )}
    </div>
  )
}
