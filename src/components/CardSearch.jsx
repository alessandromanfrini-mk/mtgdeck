import React, { useState, useRef, useEffect } from 'react'
import { autocompleteCards, searchCardPrintings, getCardImage } from '../lib/scryfall.js'

const FINISHES = [
  { value: 'nonFoil', label: 'Non-Foil' },
  { value: 'foil',    label: 'Foil' },
  { value: 'etched',  label: 'Etched' },
]

export default function CardSearch({ onAdd }) {
  const [query, setQuery]           = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg]     = useState(false)
  const [printings, setPrintings]   = useState([])
  const [selectedCard, setSelectedCard] = useState(null)
  const [finish, setFinish]         = useState('nonFoil')
  const [quantity, setQuantity]     = useState(1)
  const [loadingPrints, setLoadingPrints] = useState(false)
  const [flash, setFlash]           = useState(false)
  const debounce = useRef(null)
  const wrapRef  = useRef(null)

  // Autocomplete on query change
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 2) { setSuggestions([]); return }
    debounce.current = setTimeout(async () => {
      const names = await autocompleteCards(query)
      setSuggestions(names.slice(0, 8))
      setShowSugg(true)
    }, 250)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugg(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  async function selectName(name) {
    setQuery(name)
    setShowSugg(false)
    setSuggestions([])
    setSelectedCard(null)
    setPrintings([])
    setLoadingPrints(true)
    try {
      const cards = await searchCardPrintings(name)
      setPrintings(cards)
      if (cards.length > 0) setSelectedCard(cards[0])
    } finally {
      setLoadingPrints(false)
    }
  }

  function handleAdd() {
    if (!selectedCard) return
    const card = {
      id:            selectedCard.id,
      name:          selectedCard.name,
      quantity,
      sources:       ['Manual'],
      imageUrl:      getCardImage(selectedCard),
      colors:        selectedCard.colors          ?? [],
      color_identity: selectedCard.color_identity ?? [],
      type_line:     selectedCard.type_line       ?? '',
      cmc:           selectedCard.cmc             ?? 0,
      rarity:        selectedCard.rarity          ?? '',
      set:           selectedCard.set             ?? '',
      set_name:      selectedCard.set_name        ?? '',
      cn:            selectedCard.collector_number ?? '',
      mana_cost:     selectedCard.mana_cost       ?? '',
      finish,
      isFoil:        finish !== 'nonFoil',
      prices:        selectedCard.prices          ?? {},
    }
    onAdd(card)
    setFlash(true)
    setTimeout(() => setFlash(false), 1800)
    // Reset
    setQuery('')
    setPrintings([])
    setSelectedCard(null)
    setFinish('nonFoil')
    setQuantity(1)
  }

  // Check which finishes are actually available for the selected printing
  const availableFinishes = selectedCard
    ? FINISHES.filter(f => {
        if (f.value === 'nonFoil')  return selectedCard.nonfoil  !== false
        if (f.value === 'foil')     return selectedCard.foil     === true
        if (f.value === 'etched')   return selectedCard.finishes?.includes('etched')
        return false
      })
    : FINISHES

  return (
    <div className="panel" style={{ marginBottom: '1.25rem', position: 'relative', zIndex: 10 }}>
      <div className="panel-title">Add Card to Collection</div>

      {/* Search input + autocomplete */}
      <div ref={wrapRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Search for a card name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSugg(true)}
        />
        {showSugg && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
            background: 'rgba(9, 10, 20, 0.98)',
            backdropFilter: 'blur(18px)',
            border: '1px solid var(--border-strong)',
            borderRadius: 7, marginTop: 4, overflow: 'hidden',
            boxShadow: '0 14px 44px rgba(0,0,0,0.75), 0 0 0 1px rgba(168,180,204,0.06)',
          }}>
            {suggestions.map(name => (
              <div
                key={name}
                onMouseDown={() => selectName(name)}
                style={{
                  padding: '0.55rem 0.9rem', cursor: 'pointer', fontSize: '0.87rem',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,180,204,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printings picker */}
      {loadingPrints && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 14, height: 14, margin: 0 }} /> Loading printings…
        </div>
      )}

      {printings.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {/* Printing select */}
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '0.4rem', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Printing ({printings.length})
            </div>
            <select
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={selectedCard?.id ?? ''}
              onChange={e => setSelectedCard(printings.find(c => c.id === e.target.value) ?? null)}
            >
              {printings.map(c => (
                <option key={c.id} value={c.id}>
                  {c.set_name} #{c.collector_number} · {c.rarity}
                </option>
              ))}
            </select>
          </div>

          {/* Card preview */}
          {selectedCard && (
            <img
              src={getCardImage(selectedCard, 'small')}
              alt={selectedCard.name}
              style={{ height: 100, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', flexShrink: 0 }}
            />
          )}
        </div>
      )}

      {/* Finish + qty + add row */}
      {selectedCard && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Finish */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {availableFinishes.map(f => (
              <button
                key={f.value}
                className={`btn btn-sm${finish === f.value ? ' btn-primary' : ''}`}
                onClick={() => setFinish(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.25rem' }}>
            <button className="btn btn-sm" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
            <span style={{ minWidth: 24, textAlign: 'center', fontSize: '0.87rem', fontWeight: 600 }}>{quantity}</span>
            <button className="btn btn-sm" onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>

          {/* Add button */}
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={handleAdd}
          >
            {flash ? '✓ Added' : '+ Add to Collection'}
          </button>
        </div>
      )}
    </div>
  )
}
