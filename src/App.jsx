import React, { useState, useMemo, useEffect } from 'react'
import UrlInput from './components/UrlInput.jsx'
import FilterBar from './components/FilterBar.jsx'
import CardGrid from './components/CardGrid.jsx'
import BinderView from './components/BinderView.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import FoilTracker from './components/FoilTracker.jsx'
import ValueDashboard from './components/ValueDashboard.jsx'
import { fetchDeck } from './lib/fetchers.js'
import { mergeDecks } from './lib/merge.js'
import { enrichCards } from './lib/scryfall.js'
import { loadState, saveState, clearState } from './lib/storage.js'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], foil: false, sort: 'name' }

const saved = loadState()

export default function App() {
  const [urls, setUrls]               = useState(saved.urls)
  const [statuses, setStatuses]       = useState(saved.statuses)
  const [loading, setLoading]         = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [cards, setCards]             = useState(saved.cards)
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)
  const [view, setView]               = useState('gallery') // 'gallery' | 'binder'

  // Persist urls, cards and statuses whenever they change
  useEffect(() => {
    saveState(urls, cards, statuses)
  }, [urls, cards, statuses])

  async function handleLoad(activeUrls) {
    setLoading(true)
    setCards([])
    setFilters(DEFAULT_FILTERS)

    setStatuses(Object.fromEntries(activeUrls.map(u => [u, { state: 'loading' }])))
    setLoadingStage('Fetching decks…')

    const results = await Promise.allSettled(activeUrls.map(u => fetchDeck(u)))

    const loadedDecks = []
    const newStatuses = {}

    results.forEach((result, i) => {
      const url = activeUrls[i]
      if (result.status === 'fulfilled') {
        const { deckName, cards: deckCards } = result.value
        loadedDecks.push({ url, deckName, cards: deckCards })
        newStatuses[url] = { state: 'done', deckName }
      } else {
        newStatuses[url] = { state: 'error', error: result.reason?.message ?? 'Failed' }
      }
    })

    setStatuses(newStatuses)

    if (loadedDecks.length > 0) {
      setLoadingStage('Enriching with Scryfall…')
      const merged = mergeDecks(loadedDecks)
      try {
        const enriched = await enrichCards(merged)
        setCards(enriched)
      } catch (err) {
        console.error('[Forge] Scryfall enrichment failed:', err)
        setCards(merged.map(c => ({
          id: c.name, name: c.name, quantity: c.quantity, sources: c.sources,
          imageUrl: '', colors: [], color_identity: [], type_line: '', cmc: 0, rarity: '',
          set: '', set_name: '', cn: '', finish: c.finish ?? 'nonFoil', isFoil: false, prices: {},
        })))
      }
    }

    setLoadingStage('')
    setLoading(false)
  }

  function handleClear() {
    clearState()
    setUrls([''])
    setCards([])
    setStatuses({})
    setFilters(DEFAULT_FILTERS)
  }

  const totalQuantity = useMemo(
    () => cards.reduce((sum, c) => sum + c.quantity, 0),
    [cards],
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Commander Forge</h1>
        {cards.length > 0 && (
          <button
            className="btn btn-sm btn-danger"
            onClick={handleClear}
            style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
          >
            Clear Collection
          </button>
        )}
      </div>
      <p className="subtitle">MTG Collection Viewer</p>
      <div className="divider">✦ ✦ ✦</div>

      <UrlInput
        urls={urls}
        onUrlsChange={setUrls}
        onLoad={handleLoad}
        statuses={statuses}
        loading={loading}
      />

      {loading && loadingStage && (
        <div className="loading-state">
          <div className="spinner" />
          {loadingStage}
        </div>
      )}

      {!loading && cards.length > 0 && (
        <>
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            total={totalQuantity}
            unique={cards.length}
          />

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className={`btn btn-sm${view === 'gallery' ? ' btn-primary' : ''}`}
              onClick={() => setView('gallery')}
            >
              Gallery
            </button>
            <button
              className={`btn btn-sm${view === 'binder' ? ' btn-primary' : ''}`}
              onClick={() => setView('binder')}
            >
              Binder
            </button>
          </div>

          {view === 'gallery' && <CardGrid cards={cards} filters={filters} />}
          {view === 'binder'  && (
            <div className="panel">
              <div className="panel-title">Binder View</div>
              <BinderView cards={cards} />
            </div>
          )}

          <ValueDashboard cards={cards} />
          <FoilTracker cards={cards} />
          <ExportPanel cards={cards} />
        </>
      )}

      {!loading && cards.length === 0 && Object.keys(statuses).length === 0 && (
        <div className="loading-state">
          Paste one or more deck URLs above to view your collection.
        </div>
      )}
    </div>
  )
}
