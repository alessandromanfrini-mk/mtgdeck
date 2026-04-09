/**
 * Merge card lists from multiple decks.
 * Duplicate names are collapsed — quantities are summed,
 * source deck names are collected for display.
 *
 * @param {Array<{ url: string, deckName: string, cards: Array<{ name, quantity }> }>} decks
 * @returns {Array<{ name, quantity, sources: string[] }>}
 */
export function mergeDecks(decks) {
  const map = new Map()

  for (const deck of decks) {
    for (const { name, quantity } of deck.cards) {
      const key = name.toLowerCase()
      if (map.has(key)) {
        const entry = map.get(key)
        entry.quantity += quantity
        if (!entry.sources.includes(deck.deckName)) {
          entry.sources.push(deck.deckName)
        }
      } else {
        map.set(key, { name, quantity, sources: [deck.deckName] })
      }
    }
  }

  return Array.from(map.values())
}
