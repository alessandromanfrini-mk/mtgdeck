const DELAY_MS = 100

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export function getCardImage(card, size = 'small') {
  return (
    card?.image_uris?.[size] ||
    card?.card_faces?.[0]?.image_uris?.[size] ||
    ''
  )
}

async function fetchCardCollection(identifiers) {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()
  return data.data ?? []
}

/**
 * Take a merged card list and enrich each entry with Scryfall data.
 * Uses the bulk /cards/collection endpoint (75 cards per request).
 *
 * @param {Array<{ name, quantity, sources }>} mergedCards
 * @returns {Array<EnrichedCard>}
 */
export async function enrichCards(mergedCards) {
  const identifiers = mergedCards.map(c => ({ name: c.name }))

  const sfCards = []
  for (let i = 0; i < identifiers.length; i += 75) {
    if (i > 0) await sleep(DELAY_MS)
    const batch = await fetchCardCollection(identifiers.slice(i, i + 75))
    sfCards.push(...batch)
  }

  const byName = new Map(sfCards.map(c => [c.name.toLowerCase(), c]))

  return mergedCards.map(entry => {
    const sf = byName.get(entry.name.toLowerCase())
    return {
      id:            sf?.id ?? entry.name,
      name:          entry.name,
      quantity:      entry.quantity,
      sources:       entry.sources,
      imageUrl:      sf ? getCardImage(sf) : '',
      colors:        sf?.colors ?? [],
      color_identity: sf?.color_identity ?? [],
      type_line:     sf?.type_line ?? '',
      cmc:           sf?.cmc ?? 0,
      rarity:        sf?.rarity ?? '',
      set:           sf?.set ?? '',
      set_name:      sf?.set_name ?? '',
      prices:        sf?.prices ?? {},
      mana_cost:     sf?.mana_cost ?? sf?.card_faces?.[0]?.mana_cost ?? '',
    }
  })
}
