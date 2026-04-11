const KEYS = {
  urls:       'cdb_urls',
  cards:      'cdb_cards',
  statuses:   'cdb_statuses',
  collection: 'cdb_collection',
}

export function loadState() {
  try {
    return {
      urls:     JSON.parse(localStorage.getItem(KEYS.urls)     ?? '[""]'),
      cards:    JSON.parse(localStorage.getItem(KEYS.cards)    ?? '[]'),
      statuses: JSON.parse(localStorage.getItem(KEYS.statuses) ?? '{}'),
    }
  } catch {
    return { urls: [''], cards: [], statuses: {} }
  }
}

export function saveState(urls, cards, statuses) {
  try {
    localStorage.setItem(KEYS.urls,     JSON.stringify(urls))
    localStorage.setItem(KEYS.cards,    JSON.stringify(cards))
    localStorage.setItem(KEYS.statuses, JSON.stringify(statuses))
  } catch (e) {
    console.warn('[storage] save failed:', e)
  }
}

export function clearState() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}

// ── Collection DB ─────────────────────────────────────────────────────────────

export function loadCollection() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.collection) ?? '[]')
  } catch {
    return []
  }
}

export function saveCollection(cards) {
  try {
    localStorage.setItem(KEYS.collection, JSON.stringify(cards))
  } catch (e) {
    console.warn('[storage] collection save failed:', e)
  }
}

export function clearCollection() {
  localStorage.removeItem(KEYS.collection)
}

/** Remove a single card (by id + finish) from the collection array. */
export function removeFromCollection(cards, cardId, finish) {
  return cards.filter(
    c => !(c.id === cardId && (c.finish ?? 'nonFoil') === (finish ?? 'nonFoil'))
  )
}

/**
 * Build a stable merge key for a card.
 * Primary: Scryfall UUID + finish (guaranteed unique per printing + treatment).
 * Fallback: name + set + cn + finish (handles cards without a UUID).
 */
function collectionKey(c) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const finish = c.finish ?? 'nonFoil'
  if (c.id && UUID.test(c.id)) return `${c.id}:${finish}`
  // Fallback: treat different set+cn as different versions even without a UUID
  return `${c.name?.toLowerCase()}:${c.set ?? ''}:${c.cn ?? ''}:${finish}`
}

/**
 * Merge newly loaded (enriched) cards into the existing collection.
 * Cards with the same key (UUID+finish, or name+set+cn+finish) are combined;
 * quantities are summed.
 */
export function mergeIntoCollection(existing, incoming) {
  const map = new Map()

  for (const c of existing) {
    map.set(collectionKey(c), { ...c })
  }

  for (const c of incoming) {
    const key = collectionKey(c)
    if (map.has(key)) {
      const ex = map.get(key)
      ex.quantity += c.quantity
      for (const s of (c.sources ?? [])) {
        if (!ex.sources?.includes(s)) ex.sources = [...(ex.sources ?? []), s]
      }
    } else {
      map.set(key, { ...c })
    }
  }

  return Array.from(map.values())
}
