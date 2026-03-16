/**
 * EDHREC pulls actual decklists tagged by bracket level.
 * We fetch the bracket-specific page once, extract all cards from every
 * relevant cardlist, then hand the combined pool to Scryfall for enrichment
 * and categorization.
 */

// EDHREC cardlist tags we want to pull from
const RELEVANT_TAGS = new Set([
  'topcards', 'highsynergycards', 'gamechangers',
  'manaartifacts', 'lands', 'utilitylands',
  'creatures', 'instants', 'sorceries',
  'utilityartifacts', 'enchantments',
])

// Cards in EDHREC's "gamechangers" list are win-condition/combo pieces —
// we preserve this flag so categorization can assign them to "wincons"
const GAMECHANGER_TAG = 'gamechangers'

function commanderSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
}

function bracketSubpath(bracket) {
  const map = { '1': 'bracket-1', '2': 'bracket-2', '3': 'bracket-3', '4': 'bracket-4', '5': 'cedh' }
  return map[bracket] || null
}

async function fetchEDHRECPage(url) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) })
  const outer = await res.json()
  return JSON.parse(outer.contents)
}

/**
 * Fetch all relevant cards for a commander at the given bracket level.
 * Returns a deduplicated array sorted by synergy desc, with an
 * _isGameChanger flag on win-condition cards.
 */
export async function fetchCommanderCards(commander, filters) {
  const slug = commanderSlug(commander.name)
  const subpath = bracketSubpath(filters.bracket)

  const urls = []
  if (subpath) urls.push(`https://json.edhrec.com/pages/commanders/${slug}/${subpath}.json`)
  urls.push(`https://json.edhrec.com/pages/commanders/${slug}.json`)

  let cardlists = null
  for (const url of urls) {
    try {
      const data = await fetchEDHRECPage(url)
      const lists = data?.container?.json_dict?.cardlists || []
      if (lists.length > 0) { cardlists = lists; break }
    } catch {}
  }

  if (!cardlists) return []

  // Merge cards from all relevant lists, deduplicated by name
  const byName = new Map()

  for (const list of cardlists) {
    const tag = (list.tag || list.header || '').toLowerCase().replace(/\s+/g, '')
    if (!RELEVANT_TAGS.has(tag)) continue

    const isGameChanger = tag === GAMECHANGER_TAG

    for (const cv of list.cardviews || []) {
      if (!cv.name) continue
      const key = cv.name.toLowerCase()
      if (byName.has(key)) {
        // Keep highest synergy; promote to gamechanger if seen in that list
        const existing = byName.get(key)
        if (isGameChanger) existing._isGameChanger = true
        if ((cv.synergy || 0) > existing.synergy) existing.synergy = cv.synergy || 0
      } else {
        byName.set(key, {
          name: cv.name,
          synergy: cv.synergy || 0,
          numDecks: cv.num_decks || 0,
          potentialDecks: cv.potential_decks || 0,
          _isGameChanger: isGameChanger,
        })
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.synergy - a.synergy)
}
