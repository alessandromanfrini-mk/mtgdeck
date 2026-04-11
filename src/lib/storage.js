const KEYS = {
  urls:     'cdb_urls',
  cards:    'cdb_cards',
  statuses: 'cdb_statuses',
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
