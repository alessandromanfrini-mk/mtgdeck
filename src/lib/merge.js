/**
 * Merge card lists from multiple decks.
 *
 * Merge key: scryfallId + finish (or name + finish as fallback).
 * This keeps different printings and foil/non-foil variants as separate entries
 * while collapsing identical copies across multiple decks.
 */
export function mergeDecks(decks) {
  const map = new Map()

  for (const deck of decks) {
    for (const card of deck.cards) {
      const { name, quantity, scryfallId, finish } = card
      const key = (scryfallId ?? name.toLowerCase()) + ':' + (finish ?? 'nonFoil')

      if (map.has(key)) {
        const existing = map.get(key)
        existing.quantity += quantity
        if (!existing.sources.includes(deck.deckName)) existing.sources.push(deck.deckName)
      } else {
        map.set(key, { ...card, sources: [deck.deckName] })
      }
    }
  }

  return Array.from(map.values())
}
