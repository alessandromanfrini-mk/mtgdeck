import React, { useState, useMemo } from 'react'
import CardSearch from '../components/CardSearch.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
import FilterBar from '../components/FilterBar.jsx'
import CardGrid from '../components/CardGrid.jsx'
import BinderView from '../components/BinderView.jsx'
import ValueDashboard from '../components/ValueDashboard.jsx'
import FoilTracker from '../components/FoilTracker.jsx'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], foil: false, sort: 'name' }

export default function CollectionPage({
  collection, colLoading, colError,
  onAddCard, onRemoveCard, onClearCollection, onImport,
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [view, setView]       = useState('gallery')

  const total = useMemo(() => collection.reduce((s, c) => s + c.quantity, 0), [collection])

  if (colLoading) {
    return <div className="loading-state"><div className="spinner" />Loading collection…</div>
  }

  return (
    <div className="page-enter">
      {colError && (
        <div style={{ color: '#c04030', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠ {colError}</div>
      )}

      <CardSearch onAdd={onAddCard} />
      <ImportPanel onImport={onImport} />

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
              {collection.length} unique cards · {total} total
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

          <div className="section-divider"><span>✦</span></div>
          <FoilTracker cards={collection} />
        </>
      )}
    </div>
  )
}
