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

/**
 * Merge newly loaded (enriched) cards into the existing collection.
 * Cards with the same Scryfall ID + finish are combined; quantities are summed.
 */
export function mergeIntoCollection(existing, incoming) {
  const map = new Map()

  for (const c of existing) {
    map.set(c.id + ':' + (c.finish ?? 'nonFoil'), { ...c })
  }

  for (const c of incoming) {
    const key = c.id + ':' + (c.finish ?? 'nonFoil')
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
