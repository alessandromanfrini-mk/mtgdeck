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
import {
  loadState, saveState, clearState,
  loadCollection, saveCollection, clearCollection, mergeIntoCollection,
} from './lib/storage.js'
import { isConfigured, dbLoadCollection, dbSaveCollection, dbClearCollection } from './lib/db.js'

const DEFAULT_FILTERS = { search: '', colors: [], types: [], foil: false, sort: 'name' }

const saved = loadState()

export default function App() {
  const [tab, setTab]                   = useState('decks')

  // ── Loaded-decks state ─────────────────────────────────────────────────────
  const [urls, setUrls]                 = useState(saved.urls)
  const [statuses, setStatuses]         = useState(saved.statuses)
  const [loading, setLoading]           = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [cards, setCards]               = useState(saved.cards)
  const [deckFilters, setDeckFilters]   = useState(DEFAULT_FILTERS)
  const [deckView, setDeckView]         = useState('gallery')

  // ── Collection state ───────────────────────────────────────────────────────
  const [collection, setCollection]       = useState([])
  const [colLoading, setColLoading]       = useState(true)
  const [colFilters, setColFilters]       = useState(DEFAULT_FILTERS)
  const [colView, setColView]             = useState('gallery')
  const [savedFlash, setSavedFlash]       = useState(false)
  const [colError, setColError]           = useState(null)

  // Load collection on mount (Supabase if configured, else localStorage)
  useEffect(() => {
    if (isConfigured) {
      dbLoadCollection()
        .then(cards => setCollection(cards ?? []))
        .catch(err => {
          console.error('[db] load failed:', err)
          setColError('Could not connect to database.')
          setCollection(loadCollection())
        })
        .finally(() => setColLoading(false))
    } else {
      setCollection(loadCollection())
      setColLoading(false)
    }
  }, [])

  // Persist session state to localStorage
  useEffect(() => { saveState(urls, cards, statuses) }, [urls, cards, statuses])

  // ── Deck loading ───────────────────────────────────────────────────────────
  async function handleLoad(activeUrls) {
    setLoading(true)
    setCards([])
    setDeckFilters(DEFAULT_FILTERS)

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

  // ── Save to collection ─────────────────────────────────────────────────────
  async function handleSaveToCollection() {
    const merged = mergeIntoCollection(collection, cards)
    setCollection(merged)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)

    if (isConfigured) {
      try {
        await dbSaveCollection(merged)
      } catch (err) {
        console.error('[db] save failed:', err)
        setColError('Save failed — check your database connection.')
      }
    } else {
      saveCollection(merged)
    }
  }

  // ── Clear helpers ──────────────────────────────────────────────────────────
  function handleClearDecks() {
    clearState()
    setUrls([''])
    setCards([])
    setStatuses({})
    setDeckFilters(DEFAULT_FILTERS)
  }

  async function handleClearCollection() {
    if (!window.confirm('Clear your entire collection? This cannot be undone.')) return
    setCollection([])
    setColFilters(DEFAULT_FILTERS)
    setColError(null)
    if (isConfigured) {
      try {
        await dbClearCollection()
      } catch (err) {
        console.error('[db] clear failed:', err)
      }
    } else {
      clearCollection()
    }
  }

  const deckTotal = useMemo(() => cards.reduce((s, c) => s + c.quantity, 0), [cards])
  const colTotal  = useMemo(() => collection.reduce((s, c) => s + c.quantity, 0), [collection])

  // ── Shared card viewer ─────────────────────────────────────────────────────
  function CardViewer({ cardList, filters, onFiltersChange, view, onViewChange, total }) {
    return (
      <>
        <FilterBar filters={filters} onFiltersChange={onFiltersChange} total={total} unique={cardList.length} />
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className={`btn btn-sm${view === 'gallery' ? ' btn-primary' : ''}`} onClick={() => onViewChange('gallery')}>Gallery</button>
          <button className={`btn btn-sm${view === 'binder'  ? ' btn-primary' : ''}`} onClick={() => onViewChange('binder')}>Binder</button>
        </div>
        {view === 'gallery' && <CardGrid cards={cardList} filters={filters} />}
        {view === 'binder'  && <div className="panel"><div className="panel-title">Binder View</div><BinderView cards={cardList} /></div>}
        <ValueDashboard cards={cardList} />
        <FoilTracker cards={cardList} />
        <ExportPanel cards={cardList} />
      </>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>
      <h1 style={{ margin: 0 }}>Commander Forge</h1>
      <p className="subtitle">MTG Collection Viewer</p>
      <div className="divider">✦ ✦ ✦</div>

      {/* Top-level tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', alignItems: 'center' }}>
        <button className={`btn${tab === 'decks'      ? ' btn-primary' : ''}`} onClick={() => setTab('decks')}>Loaded Decks</button>
        <button className={`btn${tab === 'collection' ? ' btn-primary' : ''}`} onClick={() => setTab('collection')}>
          My Collection
          {collection.length > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>({collection.length})</span>}
        </button>
        {isConfigured && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#4a9a4a' }}>● Database connected</span>
        )}
      </div>

      {/* ── Loaded Decks tab ── */}
      {tab === 'decks' && (
        <>
          <UrlInput urls={urls} onUrlsChange={setUrls} onLoad={handleLoad} statuses={statuses} loading={loading} />

          {loading && loadingStage && (
            <div className="loading-state"><div className="spinner" />{loadingStage}</div>
          )}

          {!loading && cards.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleSaveToCollection}>
                  {savedFlash ? '✓ Saved to Collection' : '+ Save to Collection'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={handleClearDecks}>Clear</button>
              </div>
              <CardViewer cardList={cards} filters={deckFilters} onFiltersChange={setDeckFilters} view={deckView} onViewChange={setDeckView} total={deckTotal} />
            </>
          )}

          {!loading && cards.length === 0 && Object.keys(statuses).length === 0 && (
            <div className="loading-state">Paste one or more deck URLs above to view your collection.</div>
          )}
        </>
      )}

      {/* ── My Collection tab ── */}
      {tab === 'collection' && (
        <>
          {colError && (
            <div style={{ color: '#c04030', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠ {colError}</div>
          )}

          {colLoading ? (
            <div className="loading-state"><div className="spinner" />Loading collection…</div>
          ) : collection.length === 0 ? (
            <div className="loading-state" style={{ padding: '4rem 1rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>Your collection is empty.</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Load decks in the <strong>Loaded Decks</strong> tab and click <strong>+ Save to Collection</strong>.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {collection.length} unique cards · {colTotal} total
                </span>
                <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={handleClearCollection}>
                  Clear Collection
                </button>
              </div>
              <CardViewer cardList={collection} filters={colFilters} onFiltersChange={setColFilters} view={colView} onViewChange={setColView} total={colTotal} />
            </>
          )}
        </>
      )}
    </div>
  )
}
