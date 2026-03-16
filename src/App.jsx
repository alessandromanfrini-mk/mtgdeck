import React, { useState, useCallback } from 'react'
import StepNav from './components/StepNav.jsx'
import Step1Commander from './components/Step1Commander.jsx'
import Step2Filters from './components/Step2Filters.jsx'
import Step3Cards from './components/Step3Cards.jsx'
import Step4Export from './components/Step4Export.jsx'
import { CATEGORIES } from './constants.js'
import { fetchCommanderCards } from './lib/edhrec.js'
import { enrichAndCategorize, fetchPrints } from './lib/scryfall.js'

const defaultSlots = Object.fromEntries(CATEGORIES.map(c => [c.key, c.default]))
const defaultFilters = {
  bracket: '',
  setFilter: '',
  budget: '',
  categories: CATEGORIES.map(c => c.key),
}

export default function App() {
  const [step, setStep] = useState(1)
  const [commander, setCommander] = useState(null)
  const [slots, setSlots] = useState(defaultSlots)
  const [filters, setFilters] = useState(defaultFilters)
  const [recommendations, setRecommendations] = useState({})
  const [selected, setSelected] = useState({})
  const [prints, setPrints] = useState({})
  const [allPrints, setAllPrints] = useState({})
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('lands')

  // ── Step 1 ──────────────────────────────────────────────
  function handleConfirmCommander(card) {
    setCommander(card)
    setStep(2)
  }

  // ── Step 2 ──────────────────────────────────────────────
  async function handleFetchRecs() {
    setStep(3)
    setRecommendations({})
    setLoading(true)

    const firstCat = CATEGORIES.find(c => filters.categories.includes(c.key))
    if (firstCat) setActiveCategory(firstCat.key)

    try {
      // 1. Fetch bracket-specific EDHREC page — one request for all cards
      const pool = await fetchCommanderCards(commander, filters)
      // 2. Bulk-enrich with Scryfall, categorize by oracle text / type
      const recs = await enrichAndCategorize(
        pool,
        commander,
        filters,
        filters.categories,
      )
      setRecommendations(recs)
    } catch (e) {
      console.error('Failed to load recommendations', e)
    }

    setLoading(false)
    const first = CATEGORIES.find(c => filters.categories.includes(c.key))
    if (first) setActiveCategory(first.key)
  }

  // ── Step 3 ──────────────────────────────────────────────
  function handleToggleCard(card) {
    setSelected(prev => {
      if (prev[card.id]) {
        const next = { ...prev }
        delete next[card.id]
        return next
      }
      // Auto-fetch prints when selecting
      if (!allPrints[card.id]) {
        fetchPrints(card.name).then(data => {
          setAllPrints(p => ({ ...p, [card.id]: data }))
          setPrints(p => p[card.id] ? p : { ...p, [card.id]: data[0] })
        })
      }
      return { ...prev, [card.id]: { ...card, _cat: activeCategory } }
    })
  }

  // ── Step 4 ──────────────────────────────────────────────
  function handlePrintChosen(cardId, print) {
    setPrints(prev => ({ ...prev, [cardId]: print }))
  }

  function handleAllPrintsLoaded(cardId, data) {
    setAllPrints(prev => ({ ...prev, [cardId]: data }))
  }

  function handleRemoveCard(cardId) {
    setSelected(prev => {
      const next = { ...prev }
      delete next[cardId]
      return next
    })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      <h1>⚔ Commander Forge</h1>
      <p className="subtitle">Build the perfect 99 for your commander</p>
      <div className="divider">✦ ✦ ✦</div>

      <StepNav step={step} onGoTo={setStep} />

      {step === 1 && (
        <Step1Commander
          commander={commander}
          onConfirm={handleConfirmCommander}
        />
      )}

      {step === 2 && (
        <Step2Filters
          commander={commander}
          slots={slots}
          filters={filters}
          onSlotsChange={setSlots}
          onFiltersChange={setFilters}
          onBack={() => setStep(1)}
          onNext={handleFetchRecs}
        />
      )}

      {step === 3 && (
        <Step3Cards
          slots={slots}
          filters={filters}
          recommendations={recommendations}
          selected={selected}
          loading={loading}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onToggleCard={handleToggleCard}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step4Export
          commander={commander}
          selected={selected}
          slots={slots}
          prints={prints}
          allPrints={allPrints}
          onPrintChosen={handlePrintChosen}
          onAllPrintsLoaded={handleAllPrintsLoaded}
          onRemoveCard={handleRemoveCard}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  )
}
