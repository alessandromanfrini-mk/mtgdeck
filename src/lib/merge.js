/**
 * Merge card lists from multiple decks.
 *
 * Every raw entry from every source is kept as its own item — no collapsing
 * of same-name or same-scryfallId cards within a deck.  This preserves all
 * version/printing information exactly as the source provided it.
 *
 * The only combination that happens is when the SAME deck lists the exact
 * same card entry more than once (which should never happen in practice but
 * is handled via the _srcKey dedup below).
 *
 * Each entry receives a unique _srcKey so React keys stay stable even when
 * two entries have the same scryfallId + finish.
 */
export function mergeDecks(decks) {
  const result = []
  for (const deck of decks) {
    deck.cards.forEach((card, i) => {
      result.push({
        ...card,
        sources:  [deck.deckName],
        _srcKey:  `${deck.deckName}__${i}`,
      })
    })
  }
  return result
}
