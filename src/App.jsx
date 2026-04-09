import React, { useState, useMemo } from 'react'
import UrlInput from './components/UrlInput.jsx'
import FilterBar from './components/FilterBar.jsx'
import CardGrid from './components/CardGrid.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import { fetchDeck } from './lib/fetchers.js'
import { mergeDecks } from './lib/merge.js'
import { enrichCards } from './lib/scryfall.js'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], sort: 'name' }

export default function App() {
  const [urls, setUrls]               = useState([''])
  const [statuses, setStatuses]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [cards, setCards]             = useState([])
  const [filters, setFilters]         = useState(DEFAULT_FILTERS)

  async function handleLoad(activeUrls) {
    setLoading(true)
    setCards([])
    setFilters(DEFAULT_FILTERS)

    // Mark all as loading
    setStatuses(Object.fromEntries(activeUrls.map(u => [u, { state: 'loading' }])))
    setLoadingStage('Fetching decks…')

    // Fetch all in parallel
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
      const merged   = mergeDecks(loadedDecks)
      const enriched = await enrichCards(merged)
      setCards(enriched)
    }

    setLoadingStage('')
    setLoading(false)
  }

  const totalQuantity = useMemo(
    () => cards.reduce((sum, c) => sum + c.quantity, 0),
    [cards],
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>
      <h1>Commander Forge</h1>
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
          <CardGrid cards={cards} filters={filters} />
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
