const DELAY_MS = 150

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function searchCommanders(query) {
  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query + ' is:commander')}&order=edhrec&unique=cards`,
    { signal: AbortSignal.timeout(6000) }
  )
  const data = await res.json()
  return data.data ? data.data.slice(0, 8) : []
}

export async function fetchPrints(cardName) {
  const res = await fetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${cardName}"`)}&unique=prints&order=released`,
    { signal: AbortSignal.timeout(6000) }
  )
  const data = await res.json()
  return data.data || []
}

export async function fetchAllSets() {
  const res = await fetch('https://api.scryfall.com/sets', { signal: AbortSignal.timeout(8000) })
  const data = await res.json()
  return data.data || []
}

export function getCardImage(card, size = 'normal') {
  return (
    card?.image_uris?.[size] ||
    card?.card_faces?.[0]?.image_uris?.[size] ||
    ''
  )
}

function getFullOracleText(card) {
  return (
    (card.oracle_text || '') + ' ' +
    (card.card_faces || []).map(f => f.oracle_text || '').join(' ')
  ).toLowerCase()
}

// ── Categorization ───────────────────────────────────────────────────────────

/**
 * Assign a card to one of our six categories using its Scryfall data.
 * Priority order matters: lands → wincons → ramp → draw → removal → utility
 */
export function categorizeCard(card) {
  const types = (card.type_line || '').toLowerCase()
  const oracle = getFullOracleText(card)
  const cmc = card.cmc ?? 0

  // 1. Lands (type check first — most reliable)
  if (types.includes('land')) return 'lands'

  // 2. Win conditions — EDHREC's "gamechangers" list is already the right signal,
  //    plus explicit "win the game" / infect text
  if (card._isGameChanger) return 'wincons'
  if (oracle.includes('win the game') || oracle.includes('lose the game') ||
      oracle.includes('poison counter') || oracle.includes('ten or more poison')) return 'wincons'

  // 3. Ramp — mana artifacts (tap for mana, cmc ≤ 4) and land ramp spells
  const tapsMana = /\{t\}[^.]*?add \{/.test(oracle) || /: add \{[wubrg\d]/i.test(oracle)
  const isLandRamp = oracle.includes('search your library for') &&
    (oracle.includes(' land') || oracle.includes('plains') || oracle.includes('island') ||
     oracle.includes('swamp') || oracle.includes('mountain') || oracle.includes('forest'))

  if ((tapsMana && cmc <= 4) || isLandRamp) return 'ramp'

  // 4. Card draw (spells that explicitly draw cards — including looting)
  if (/draw (a |x |\d+ )?card/i.test(oracle)) return 'draw'

  // 5. Removal — targeted destruction, exile, bounce, or counterspells
  if (oracle.includes('destroy target') || oracle.includes('exile target') ||
      oracle.includes('counter target') ||
      (oracle.includes('return target') && oracle.includes("owner's hand"))) return 'removal'

  // 6. Utility — everything else
  return 'utility'
}

// ── Bulk enrichment + fallback ───────────────────────────────────────────────

/**
 * Fetch up to 75 cards by name in one POST to /cards/collection.
 */
async function fetchCardCollection(identifiers) {
  const res = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json()
  return data.data || []
}

/**
 * Take the raw EDHREC card pool (name + synergy metadata), enrich with
 * Scryfall data, apply budget filter, categorize, and return a map of
 * { catKey: Card[] } sorted by synergy, capped at 50 per category.
 *
 * Falls back to Scryfall search per category if the pool is empty.
 */
export async function enrichAndCategorize(pool, commander, filters, enabledCategories) {
  if (pool.length > 0) {
    return enrichFromPool(pool, filters, enabledCategories)
  }
  return fallbackPerCategory(commander, filters, enabledCategories)
}

async function enrichFromPool(pool, filters, enabledCategories) {
  const top = pool

  // Use Scryfall ID when EDHREC provides it (avoids name-matching issues)
  const identifiers = top.map(c =>
    c.scryfallId ? { id: c.scryfallId } : { name: c.name }
  )

  // Bulk-fetch Scryfall data in batches of 75
  const scryfallCards = []
  for (let i = 0; i < identifiers.length; i += 75) {
    const batch = await fetchCardCollection(identifiers.slice(i, i + 75))
    scryfallCards.push(...batch)
    if (i + 75 < identifiers.length) await sleep(DELAY_MS)
  }

  // Build lookup map by both id and name for flexible matching
  const sfById = {}
  const sfByName = {}
  scryfallCards.forEach(c => {
    sfById[c.id] = c
    sfByName[c.name.toLowerCase()] = c
  })

  const categorized = {}
  enabledCategories.forEach(k => { categorized[k] = [] })

  for (const entry of top) {
    const sf = (entry.scryfallId && sfById[entry.scryfallId]) || sfByName[entry.name.toLowerCase()]
    if (!sf?.id) continue

    // Budget filter
    const price = parseFloat(sf.prices?.usd || 0)
    if (filters.budget && price > parseFloat(filters.budget)) continue

    // Merge EDHREC metadata onto Scryfall card for categorization
    sf._isGameChanger = entry._isGameChanger

    const cat = categorizeCard(sf)
    if (!enabledCategories.includes(cat)) continue

    const inclusionRate = entry.potentialDecks > 0
      ? Math.round((entry.numDecks / entry.potentialDecks) * 100)
      : null

    categorized[cat].push({
      id: sf.id,
      name: sf.name,
      synergy: entry.synergy,
      inclusionRate,
      imageUrl: getCardImage(sf, 'normal'),
      set: sf.set,
      set_name: sf.set_name,
      collector_number: sf.collector_number,
      prices: sf.prices,
      _cat: cat,
    })
  }

  // Sort each category by synergy desc, cap at 100
  for (const key of Object.keys(categorized)) {
    categorized[key].sort((a, b) => b.synergy - a.synergy)
    categorized[key] = categorized[key].slice(0, 100)
  }

  return categorized
}

// ── Scryfall-only fallback (when EDHREC is unavailable) ──────────────────────

function setFilterClause(setFilter) {
  if (!setFilter) return ''
  if (setFilter.startsWith('era:')) return ` year>=${setFilter.slice(4)}`
  if (setFilter.startsWith('set:')) return ` e:${setFilter.slice(4)}`
  return ''
}

function bracketQueryClause(bracket) {
  switch (bracket) {
    case '1': return ' -o:"extra turn" -(o:"destroy all lands") -(o:"search your library" -o:"basic") -(type:artifact cmc<=1 o:"add {")'
    case '2': return ' -o:"extra turn" -(o:"destroy all lands") -(type:artifact cmc=0 o:"add {")'
    case '3': return ' -o:"extra turn"'
    default:  return ''
  }
}

const FALLBACK_QUERIES = {
  lands:   (colors, set, budget, bracket) => `t:land id<=${colors} -t:basic${set}${budget}${bracket}`,
  ramp:    (colors, set, budget, bracket) => `(o:"add {" or o:"search your library for a basic") id<=${colors} -t:land${set}${budget}${bracket}`,
  draw:    (colors, set, budget, bracket) => `o:"draw" (t:instant or t:sorcery) id<=${colors}${set}${budget}${bracket}`,
  removal: (colors, set, budget, bracket) => `(o:destroy or o:exile) (t:instant or t:sorcery) id<=${colors}${set}${budget}${bracket}`,
  wincons: (colors, set, budget, bracket) => `(o:"win the game" or o:infect) id<=${colors}${set}${budget}${bracket}`,
  utility: (colors, set, budget, bracket) => `(t:enchantment or t:artifact) id<=${colors} -t:land${set}${budget}${bracket}`,
}

async function fallbackPerCategory(commander, filters, enabledCategories) {
  const colors = commander.color_identity?.join('') || 'WUBRG'
  const set = setFilterClause(filters.setFilter)
  const budget = filters.budget ? ` usd<=${filters.budget}` : ''
  const bracket = bracketQueryClause(filters.bracket)

  const categorized = {}
  for (const cat of enabledCategories) {
    const qFn = FALLBACK_QUERIES[cat]
    if (!qFn) { categorized[cat] = []; continue }
    try {
      const q = qFn(colors, set, budget, bracket)
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=edhrec&unique=cards`,
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json()
      categorized[cat] = (data.data || []).slice(0, 50).map(c => ({
        id: c.id,
        name: c.name,
        synergy: Math.random() * 0.3 + 0.5,
        inclusionRate: null,
        imageUrl: getCardImage(c, 'normal'),
        set: c.set,
        set_name: c.set_name,
        collector_number: c.collector_number,
        prices: c.prices,
        _cat: cat,
      }))
    } catch {
      categorized[cat] = []
    }
  }
  return categorized
}
