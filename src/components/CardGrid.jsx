import React, { useMemo, useState, useEffect } from 'react'
import CardTile from './CardTile.jsx'

function getMainType(typeLine) {
  for (const t of ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery', 'Battle']) {
    if (typeLine?.includes(t)) return t
  }
  return 'Other'
}

const RARITY_ORDER = { mythic: 0, rare: 1, uncommon: 2, common: 3, '': 4 }

function sortCards(cards, sort) {
  return [...cards].sort((a, b) => {
    switch (sort) {
      case 'name':     return a.name.localeCompare(b.name)
      case 'cmc_asc':  return a.cmc - b.cmc || a.name.localeCompare(b.name)
      case 'cmc_desc': return b.cmc - a.cmc || a.name.localeCompare(b.name)
      case 'qty_desc': return b.quantity - a.quantity || a.name.localeCompare(b.name)
      case 'type':     return getMainType(a.type_line).localeCompare(getMainType(b.type_line)) || a.name.localeCompare(b.name)
      case 'color':    return (a.color_identity[0] ?? 'Z').localeCompare(b.color_identity[0] ?? 'Z') || a.name.localeCompare(b.name)
      case 'rarity':   return (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4) || a.name.localeCompare(b.name)
      default:         return 0
    }
  })
}

function filterCards(cards, filters) {
  let result = cards

  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(c => c.name.toLowerCase().includes(q))
  }

  if (filters.colors.length > 0) {
    result = result.filter(c => {
      const ci = c.color_identity.length > 0 ? c.color_identity : ['C']
      return filters.colors.some(col => ci.includes(col))
    })
  }

  if (filters.types.length > 0) {
    result = result.filter(c => filters.types.includes(getMainType(c.type_line)))
  }

  if (filters.foil) {
    result = result.filter(c => c.isFoil)
  }

  if (filters.decks?.length > 0) {
    result = result.filter(c => c.sources?.some(s => filters.decks.includes(s)))
  }

  return result
}

const PAGE_SIZE = 48

export default function CardGrid({ cards, filters, onRemove }) {
  const [page, setPage] = useState(1)

  const visible = useMemo(
    () => sortCards(filterCards(cards, filters), filters.sort),
    [cards, filters],
  )

  // Reset to page 1 whenever the filtered+sorted list changes
  useEffect(() => { setPage(1) }, [visible])

  if (cards.length === 0) {
    return (
      <div className="loading-state" style={{ padding: '4rem 1rem' }}>
        Paste deck URLs above and click Load to view your collection.
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="loading-state" style={{ padding: '3rem 1rem' }}>
        No cards match the current filters.
      </div>
    )
  }

  const shown     = visible.slice(0, page * PAGE_SIZE)
  const remaining = visible.length - shown.length

  return (
    <>
      <div className="card-grid">
        {shown.map(card => {
          // When filtering by deck, show the quantity for the selected deck(s) only
          const displayCard = (filters.decks?.length > 0 && card.sourceQuantities)
            ? { ...card, quantity: filters.decks.reduce((sum, d) => sum + (card.sourceQuantities[d] ?? 0), 0) || card.quantity }
            : card
          return <CardTile key={card._srcKey ?? (card.id + ':' + (card.finish ?? 'nonFoil') + ':' + (card.sources?.[0] ?? ''))} card={displayCard} onRemove={onRemove} />
        })}
      </div>
      {remaining > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button className="btn btn-sm" onClick={() => setPage(p => p + 1)}>
            Load more ({remaining} remaining)
          </button>
        </div>
      )}
    </>
  )
}
