const DELAY_MS = 100

/** Autocomplete card names via Scryfall. Returns up to 20 name suggestions. */
export async function autocompleteCards(query) {
  if (!query || query.length < 2) return []
  const res = await fetch(
    `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(5000) }
  )
  const data = await res.json()
  return data.data ?? []
}

/** Fetch all printings of an exact card name. Returns enriched Scryfall card objects. */
export async function searchCardPrintings(name) {
  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&order=released`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.data ?? []
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export function getCardImage(card, size = 'normal') {
  return (
    card?.image_uris?.[size] ||
    card?.card_faces?.[0]?.image_uris?.[size] ||
    ''
  )
}

/**
 * Construct a Scryfall CDN image URL directly from a Scryfall UUID.
 * Avoids an API round-trip when we already have the ID (e.g. from Moxfield).
 */
function imageFromScryfallId(scryfallId, size = 'normal') {
  if (!scryfallId) return ''
  return `https://cards.scryfall.io/${size}/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
}

async function fetchCardCollection(identifiers) {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()
  if (data.object === 'error') {
    console.error('[Scryfall] /cards/collection error:', data)
    return []
  }
  return data.data ?? []
}

/**
 * Fetch foil prices for a list of enriched cards.
 * Returns a Map of card id → { usd, usd_foil, usd_etched }.
 * Only cards with a valid Scryfall UUID are queried.
 */
export async function fetchPrices(cards) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const withId = cards.filter(c => UUID.test(c.id))
  if (withId.length === 0) return new Map()

  const identifiers = withId.map(c => ({ id: c.id }))
  const sfCards = []
  for (let i = 0; i < identifiers.length; i += 75) {
    if (i > 0) await sleep(DELAY_MS)
    const batch = await fetchCardCollection(identifiers.slice(i, i + 75))
    sfCards.push(...batch)
  }
  return new Map(sfCards.map(c => [c.id, c.prices ?? {}]))
}

/**
 * Enrich a merged card list with display data.
 *
 * Cards that already carry full data (scryfallId + typeLine, e.g. from Moxfield)
 * are converted directly — no API call needed.
 * Cards from other sites go through the Scryfall bulk endpoint.
 */
export async function enrichCards(mergedCards) {
  const needsApi = mergedCards.filter(c => !c.scryfallId || !c.typeLine)

  // Bulk-fetch only the cards that need it
  let sfByName  = new Map()
  let sfById    = new Map()
  let sfBySetCn = new Map()

  if (needsApi.length > 0) {
    const identifiers = needsApi.map(c => {
      if (c.scryfallId) return { id: c.scryfallId }
      if (c.set && c.cn) return { set: c.set.toLowerCase(), collector_number: String(c.cn) }
      return { name: c.name }
    })
    const sfCards = []
    for (let i = 0; i < identifiers.length; i += 75) {
      if (i > 0) await sleep(DELAY_MS)
      const batch = await fetchCardCollection(identifiers.slice(i, i + 75))
      sfCards.push(...batch)
    }
    sfById   = new Map(sfCards.map(c => [c.id, c]))
    sfByName = new Map(sfCards.map(c => [c.name.toLowerCase(), c]))
    sfBySetCn = new Map(sfCards.map(c => [`${c.set}:${c.collector_number}`, c]))
  }

  return mergedCards.map(entry => {
    // Cards with full Moxfield data — build directly, no API needed
    if (entry.scryfallId && entry.typeLine) {
      return {
        id:            entry.scryfallId,
        name:          entry.name,
        quantity:      entry.quantity,
        sources:       entry.sources,
        _srcKey:       entry._srcKey,
        imageUrl:      imageFromScryfallId(entry.scryfallId),
        colors:        entry.colors        ?? [],
        color_identity: entry.colorIdentity ?? [],
        type_line:     entry.typeLine      ?? '',
        cmc:           entry.cmc           ?? 0,
        rarity:        entry.rarity        ?? '',
        set:           entry.set           ?? '',
        set_name:      entry.setName       ?? '',
        cn:            entry.cn            ?? '',
        mana_cost:     entry.manaCost      ?? '',
        isFoil:        entry.isFoil        ?? false,
        finish:        entry.finish        ?? 'nonFoil',
        prices:        {},
      }
    }

    // Cards from other sites — use Scryfall API data
    const sf = (entry.scryfallId && sfById.get(entry.scryfallId))
            || (entry.set && entry.cn && sfBySetCn.get(`${entry.set.toLowerCase()}:${entry.cn}`))
            || sfByName.get(entry.name.toLowerCase())
    return {
      id:            sf?.id              ?? entry.scryfallId ?? entry.name,
      name:          entry.name,
      quantity:      entry.quantity,
      sources:       entry.sources,
      _srcKey:       entry._srcKey,
      imageUrl:      sf ? getCardImage(sf) : imageFromScryfallId(entry.scryfallId),
      colors:        sf?.colors          ?? entry.colors        ?? [],
      color_identity: sf?.color_identity ?? entry.colorIdentity ?? [],
      type_line:     sf?.type_line       ?? entry.typeLine      ?? '',
      cmc:           sf?.cmc             ?? entry.cmc           ?? 0,
      rarity:        sf?.rarity          ?? entry.rarity        ?? '',
      set:           sf?.set              ?? entry.set           ?? '',
      set_name:      sf?.set_name        ?? entry.setName       ?? '',
      cn:            sf?.collector_number ?? entry.cn           ?? '',
      mana_cost:     sf?.mana_cost       ?? entry.manaCost      ?? '',
      isFoil:        entry.isFoil        ?? false,
      finish:        entry.finish        ?? 'nonFoil',
      prices:        sf?.prices          ?? {},
    }
  })
}
