import React, { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  loadCollection, saveCollection, clearCollection,
  mergeIntoCollection, removeFromCollection,
} from './lib/storage.js'
import { isConfigured, dbLoadCollection, dbSaveCollection, dbClearCollection, dbRemoveCard, dbAddCard } from './lib/db.js'

const DecksPage      = lazy(() => import('./pages/DecksPage.jsx'))
const CollectionPage = lazy(() => import('./pages/CollectionPage.jsx'))
const MarketPage     = lazy(() => import('./pages/MarketPage.jsx'))

const BG_ART = '/art-waltz.jpg'

async function fetchArtCrop(name, set) {
  const qs = set
    ? `exact=${encodeURIComponent(name)}&set=${set}`
    : `exact=${encodeURIComponent(name)}`
  const r = await fetch(`https://api.scryfall.com/cards/named?${qs}`)
  if (!r.ok) return null
  const d = await r.json()
  return d?.image_uris?.art_crop
    ?? d?.card_faces?.[0]?.image_uris?.art_crop
    ?? null
}

export default function App() {
  // ── Shared collection state ────────────────────────────────────────────────
  const [collection, setCollection] = useState([])
  const [colLoading, setColLoading] = useState(true)
  const [colError, setColError]     = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [toast, setToast]           = useState(null)

  // ── Masthead art crop (Scryfall) — separate from the full background ───────
  const [mastheadArt, setMastheadArt] = useState(null)

  useEffect(() => {
    fetchArtCrop('Demonic Tutor', 'sta')
      .then(url => url || fetchArtCrop('Demonic Tutor'))
      .then(url => { if (url) setMastheadArt(url) })
      .catch(() => {})
  }, [])

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

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Save loaded deck cards into collection ─────────────────────────────────
  async function handleSaveToCollection(cards) {
    const merged = mergeIntoCollection(collection, cards)
    setCollection(merged)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
    if (isConfigured) {
      try { await dbSaveCollection(merged) }
      catch (err) {
        console.error('[db] save failed:', err)
        setColError('Save failed — check your database connection.')
      }
    } else {
      saveCollection(merged)
    }
  }

  // ── Add single card ────────────────────────────────────────────────────────
  async function handleAddCard(card) {
    const newCard = { ...card, quantity: card.quantity ?? 1 }
    const merged  = mergeIntoCollection(collection, [newCard])
    setCollection(merged)
    setColError(null)
    if (isConfigured) {
      try {
        const key    = newCard.id + ':' + (newCard.finish ?? 'nonFoil')
        const toSave = merged.find(c => c.id + ':' + (c.finish ?? 'nonFoil') === key) ?? newCard
        await dbAddCard(toSave)
        showToast(`${newCard.name} added to collection`)
      } catch (err) {
        console.error('[db] add failed:', err)
        showToast('Could not save card — check your database connection.', 'error')
      }
    } else {
      saveCollection(merged)
      showToast(`${newCard.name} added to collection`)
    }
  }

  // ── Remove single card ─────────────────────────────────────────────────────
  async function handleRemoveCard(cardId, finish) {
    const removed = collection.find(c => c.id === cardId && (c.finish ?? 'nonFoil') === (finish ?? 'nonFoil'))
    const updated = removeFromCollection(collection, cardId, finish)
    setCollection(updated)
    setColError(null)
    if (isConfigured) {
      try {
        await dbRemoveCard(cardId, finish)
        if (removed) showToast(`${removed.name} removed`)
      } catch (err) {
        console.error('[db] remove failed:', err)
        showToast('Could not remove card — check your database connection.', 'error')
      }
    } else {
      saveCollection(updated)
      if (removed) showToast(`${removed.name} removed`)
    }
  }

  // ── Clear collection ───────────────────────────────────────────────────────
  async function handleClearCollection() {
    if (!window.confirm('Clear your entire collection? This cannot be undone.')) return
    setCollection([])
    setColError(null)
    if (isConfigured) {
      try { await dbClearCollection() }
      catch (err) { console.error('[db] clear failed:', err) }
    } else {
      clearCollection()
    }
  }

  return (
    <BrowserRouter>
      {/* ── Full-page background — Demonic Tutor high-res art ── */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: 0,
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        <img
          src={BG_ART}
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 20%',
            filter: 'brightness(0.32) saturate(0.75)',
            transform: 'scale(1.04)',
            display: 'block',
          }}
        />
        {/* Vignette — darkens edges so content stays readable */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 110% 90% at 50% 30%, transparent 0%, rgba(7,6,14,0.55) 55%, rgba(7,6,14,0.88) 100%)',
        }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 5rem', position: 'relative', zIndex: 1 }}>
        <header className="app-masthead">
          {mastheadArt && (
            <div className="masthead-art">
              <img
                className="masthead-art-img"
                src={mastheadArt}
                alt=""
              />
              <div className="masthead-art-overlay" />
            </div>
          )}
          <div className="masthead-content">
            <h1 style={{ margin: 0 }}>Alessandro's Library</h1>
            <p className="subtitle">Personal MTG Collection</p>
            <div className="mana-divider">
              <div className="mana-pip mana-pip-W">W</div>
              <div className="mana-pip mana-pip-U">U</div>
              <div className="mana-pip mana-pip-B">B</div>
              <div className="mana-pip mana-pip-R">R</div>
              <div className="mana-pip mana-pip-G">G</div>
            </div>
          </div>
        </header>

        {/* Nav */}
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
            Loaded Decks
          </NavLink>
          <NavLink to="/collection" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
            My Collection
            {collection.length > 0 && (
              <span className="nav-tab-count">({collection.length})</span>
            )}
          </NavLink>
          <NavLink to="/market" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
            Market
          </NavLink>
        </nav>
        {isConfigured && (
          <div className="db-indicator">● synced</div>
        )}

        {/* Pages */}
        <Suspense fallback={<div className="loading-state"><div className="spinner" />Loading…</div>}>
          <Routes>
            <Route path="/" element={
              <DecksPage
                collection={collection}
                onSaveToCollection={handleSaveToCollection}
                savedFlash={savedFlash}
              />
            } />
            <Route path="/collection" element={
              <CollectionPage
                collection={collection}
                colLoading={colLoading}
                colError={colError}
                onAddCard={handleAddCard}
                onRemoveCard={handleRemoveCard}
                onClearCollection={handleClearCollection}
                onImport={handleSaveToCollection}
              />
            } />
            <Route path="/market" element={<MarketPage />} />
          </Routes>
        </Suspense>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            background: toast.type === 'error' ? 'rgba(140,26,26,0.96)' : 'rgba(18,22,40,0.96)',
            color: '#fff', padding: '0.6rem 1.25rem', borderRadius: 8, fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 999,
            backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
            animation: 'fadeInUp 0.2s ease',
          }}>
            {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
          </div>
        )}
      </div>
    </BrowserRouter>
  )
}
