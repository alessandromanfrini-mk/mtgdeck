import React, { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  loadCollection, saveCollection, clearCollection,
  mergeIntoCollection, removeFromCollection,
} from './lib/storage.js'
import { isConfigured, dbLoadCollection, dbSaveCollection, dbClearCollection, dbRemoveCard, dbAddCard } from './lib/db.js'

const DecksPage      = lazy(() => import('./pages/DecksPage.jsx'))
const CollectionPage = lazy(() => import('./pages/CollectionPage.jsx'))

export default function App() {
  // ── Shared collection state ────────────────────────────────────────────────
  const [collection, setCollection] = useState([])
  const [colLoading, setColLoading] = useState(true)
  const [colError, setColError]     = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [toast, setToast]           = useState(null)

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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>
        <h1 style={{ margin: 0 }}>Commander Forge</h1>
        <p className="subtitle">MTG Collection Viewer</p>
        <div className="divider">✦ ✦ ✦</div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', alignItems: 'center' }}>
          <NavLink to="/" end className={({ isActive }) => `btn${isActive ? ' btn-primary' : ''}`}>
            Loaded Decks
          </NavLink>
          <NavLink to="/collection" className={({ isActive }) => `btn${isActive ? ' btn-primary' : ''}`}>
            My Collection
            {collection.length > 0 && (
              <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ({collection.length})
              </span>
            )}
          </NavLink>
          {isConfigured && (
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#4a9a4a' }}>● Database connected</span>
          )}
        </nav>

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
              />
            } />
          </Routes>
        </Suspense>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            background: toast.type === 'error' ? 'rgba(160,40,40,0.95)' : 'rgba(30,80,50,0.95)',
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
