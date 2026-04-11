/**
 * Deck fetchers for Moxfield, Archidekt, TappedOut, and Deckbox.
 * Each returns { deckName: string, cards: [{ name, quantity }] }
 */

// Sites that will always block direct browser requests — go straight to proxy.
const ALWAYS_PROXY = ['moxfield.com', 'tappedout.net', 'deckbox.org']

const PROXIES = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
]

async function tryFetch(fetchUrl, timeout = 10000) {
  const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

async function safeFetch(url) {
  const needsProxy = ALWAYS_PROXY.some(host => url.includes(host))

  // Try direct first for sites that support CORS
  if (!needsProxy) {
    try { return await tryFetch(url) } catch { /* fall through to proxies */ }
  }

  // Try each proxy in order
  let lastErr
  for (const proxy of PROXIES) {
    try {
      console.log(`[fetcher] trying proxy: ${proxy(url).slice(0, 60)}…`)
      return await tryFetch(proxy(url), 14000)
    } catch (err) {
      console.warn(`[fetcher] proxy failed:`, err?.message)
      lastErr = err
    }
  }
  throw new Error(`All fetch attempts failed for ${url} — ${lastErr?.message}`)
}

// Archidekt uses full color names; normalise to single-letter MTG symbols.
const COLOR_NAME_MAP = { White: 'W', Blue: 'U', Black: 'B', Red: 'R', Green: 'G' }
const COLOR_MAP = name => COLOR_NAME_MAP[name] ?? name

// ── Moxfield ─────────────────────────────────────────────────────────────────

function getMoxfieldId(url) {
  return url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

async function fetchMoxfield(url) {
  const id = getMoxfieldId(url)
  if (!id) throw new Error('Cannot parse Moxfield deck ID from URL.')

  // Timestamp busts the proxy cache so edits to the deck are picked up immediately
  const res = await safeFetch(`https://api2.moxfield.com/v3/decks/all/${id}?_=${Date.now()}`)
  const data = await res.json()

  const cards = []

  // All cards (including commanders) live in data.boards — each board has a `cards` object.
  // Moxfield returns the full card object, so we carry everything through and skip the
  // Scryfall enrichment step for these cards.
  for (const board of Object.values(data.boards ?? {})) {
    for (const entry of Object.values(board.cards ?? {})) {
      const c = entry.card
      if (!c?.name) continue
      cards.push({
        name:          c.name,
        quantity:      entry.quantity ?? 1,
        isFoil:        entry.isFoil ?? false,
        finish:        entry.finish ?? 'nonFoil',
        scryfallId:    c.scryfall_id ?? null,
        set:           c.set ?? '',
        setName:       c.set_name ?? '',
        cn:            c.cn ?? '',
        typeLine:      c.type_line ?? '',
        colors:        c.colors ?? [],
        colorIdentity: c.color_identity ?? [],
        cmc:           c.cmc ?? 0,
        rarity:        c.rarity ?? '',
        manaCost:      c.mana_cost ?? '',
      })
    }
  }

  return { deckName: data.name ?? 'Moxfield Deck', cards }
}

// ── Archidekt ─────────────────────────────────────────────────────────────────

function getArchidektId(url) {
  return url.match(/archidekt\.com\/decks\/(\d+)/)?.[1] ?? null
}

async function fetchArchidekt(url) {
  const id = getArchidektId(url)
  if (!id) throw new Error('Cannot parse Archidekt deck ID from URL.')

  const res = await safeFetch(`https://archidekt.com/api/decks/${id}/?format=json&_=${Date.now()}`)
  const data = await res.json()

  const cards = (data.cards ?? [])
    .filter(c => c.card?.oracleCard?.name)
    .map(c => {
      const oracle  = c.card.oracleCard
      const edition = c.card.edition ?? {}
      const modifier = c.modifier ?? 'Normal'
      const isFoil  = modifier === 'Foil' || modifier === 'Etched'
      const finish  = modifier === 'Etched' ? 'etched'
                    : modifier === 'Foil'   ? 'foil'
                    : 'nonFoil'

      return {
        name:          oracle.name,
        quantity:      c.quantity ?? 1,
        isFoil,
        finish,
        scryfallId:    c.card.uid ?? null,
        set:           edition.editioncode ?? '',
        setName:       edition.editionname ?? '',
        cn:            c.card.collectorNumber ?? '',
        typeLine:      [...(oracle.superTypes ?? []), ...(oracle.types ?? [])].join(' '),
        colors:        (oracle.colors ?? []).map(COLOR_MAP),
        colorIdentity: (oracle.colorIdentity ?? []).map(COLOR_MAP),
        cmc:           oracle.cmc ?? 0,
        rarity:        c.card.rarity ?? '',
        manaCost:      oracle.manaCost ?? '',
      }
    })

  return { deckName: data.name ?? 'Archidekt Deck', cards }
}

// ── TappedOut ─────────────────────────────────────────────────────────────────

function getTappedOutSlug(url) {
  return url.match(/tappedout\.net\/mtg-decks\/([^/?#]+)/)?.[1] ?? null
}

async function fetchTappedOut(url) {
  const slug = getTappedOutSlug(url)
  if (!slug) throw new Error('Cannot parse TappedOut deck slug from URL.')

  // Fetch the deck page HTML — TappedOut embeds the full decklist as JSON
  // in a <script> tag so we can extract set/version/foil data from it.
  const res  = await safeFetch(`https://tappedout.net/mtg-decks/${slug}/?_=${Date.now()}`)
  const html = await res.text()

  // TappedOut renders cards as <li class="member"> with data attributes on the child <a>.
  // No set/foil data is available in the HTML — Scryfall will enrich by name.
  const doc     = new DOMParser().parseFromString(html, 'text/html')
  const members = doc.querySelectorAll('li.member')

  if (members.length === 0) {
    throw new Error('Could not find any cards in the TappedOut page. Make sure the deck is public.')
  }

  const cards = []
  for (const li of members) {
    const link = li.querySelector('a[data-orig]')
    if (!link) continue
    const name     = link.getAttribute('data-orig')
    const quantity = parseInt(link.getAttribute('data-qty') || '1', 10) || 1
    if (name) cards.push({ name, quantity })
  }

  const deckName = doc.querySelector('h1.page-title, h1')?.textContent?.trim() ?? 'TappedOut Deck'
  return { deckName, cards }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectSite(url) {
  try { new URL(url) } catch { return null }
  if (url.includes('moxfield.com')) return 'Moxfield'
  if (url.includes('archidekt.com')) return 'Archidekt'
  if (url.includes('tappedout.net')) return 'TappedOut'
  return null
}

export async function fetchDeck(url) {
  const site = detectSite(url.trim())
  if (!site) throw new Error('Unsupported site. Use Moxfield, Archidekt, or TappedOut.')
  switch (site) {
    case 'Moxfield':  return fetchMoxfield(url)
    case 'Archidekt': return fetchArchidekt(url)
    case 'TappedOut': return fetchTappedOut(url)
  }
}
