import React, { useState, useMemo } from 'react'
import CardSearch from '../components/CardSearch.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
import FilterBar from '../components/FilterBar.jsx'
import CardGrid from '../components/CardGrid.jsx'
import BinderView from '../components/BinderView.jsx'
import ValueDashboard from '../components/ValueDashboard.jsx'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], foil: false, sort: 'name' }

export default function CollectionPage({
  collection, colLoading, colError,
  onAddCard, onRemoveCard, onClearCollection, onImport,
}) {
  const [filters, setFilters]   = useState(DEFAULT_FILTERS)
  const [view, setView]         = useState('gallery')
  const [drawerOpen, setDrawer] = useState(false)
  const [addTab, setAddTab]     = useState('single')

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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {collection.length} unique · {total} total
            </span>
            <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={onClearCollection}>
              Clear Collection
            </button>
          </div>

          <FilterBar filters={filters} onFiltersChange={setFilters} total={total} unique={collection.length} />
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className={`btn btn-sm${view === 'gallery' ? ' btn-primary' : ''}`} onClick={() => setView('gallery')}>Gallery</button>
            <button className={`btn btn-sm${view === 'binder'  ? ' btn-primary' : ''}`} onClick={() => setView('binder')}>Binder</button>
          </div>
          {view === 'gallery' && <CardGrid cards={collection} filters={filters} onRemove={onRemoveCard} />}
          {view === 'binder'  && <div className="panel"><div className="panel-title">Binder View</div><BinderView cards={collection} /></div>}

          <div className="section-divider"><span>✦</span></div>
          <ValueDashboard cards={collection} />

        </>
      )}
    </div>
  )
}
