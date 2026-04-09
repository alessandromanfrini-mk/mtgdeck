/**
 * Deck fetchers for Moxfield, Archidekt, TappedOut, and Deckbox.
 * Each returns { deckName: string, cards: [{ name, quantity }] }
 */

const CORS_PROXY = 'https://corsproxy.io/?url='

async function fetchDirect(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

async function fetchViaProxy(url) {
  const res = await fetch(CORS_PROXY + encodeURIComponent(url), {
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} (via proxy)`)
  return res
}

async function safeFetch(url) {
  try {
    return await fetchDirect(url)
  } catch {
    return fetchViaProxy(url)
  }
}

// ── Moxfield ─────────────────────────────────────────────────────────────────

function getMoxfieldId(url) {
  return url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

async function fetchMoxfield(url) {
  const id = getMoxfieldId(url)
  if (!id) throw new Error('Cannot parse Moxfield deck ID from URL.')

  const res = await safeFetch(`https://api2.moxfield.com/v3/decks/all/${id}`)
  const data = await res.json()

  const cards = []
  for (const section of ['commanders', 'mainboard', 'sideboard']) {
    for (const entry of Object.values(data[section] ?? {})) {
      const name = entry.card?.name
      if (name) cards.push({ name, quantity: entry.quantity ?? 1 })
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

  const res = await safeFetch(`https://archidekt.com/api/decks/${id}/?format=json`)
  const data = await res.json()

  const cards = (data.cards ?? [])
    .filter(c => c.card?.oracleCard?.name)
    .map(c => ({ name: c.card.oracleCard.name, quantity: c.quantity ?? 1 }))

  return { deckName: data.name ?? 'Archidekt Deck', cards }
}

// ── TappedOut ─────────────────────────────────────────────────────────────────

function getTappedOutSlug(url) {
  return url.match(/tappedout\.net\/mtg-decks\/([^/?#]+)/)?.[1] ?? null
}

async function fetchTappedOut(url) {
  const slug = getTappedOutSlug(url)
  if (!slug) throw new Error('Cannot parse TappedOut deck slug from URL.')

  const res = await safeFetch(`https://tappedout.net/mtg-decks/${slug}/?fmt=json`)
  const data = await res.json()

  const cards = []
  const main = data.main ?? data.mainboard ?? {}

  if (Array.isArray(main)) {
    for (const c of main) {
      if (c.name) cards.push({ name: c.name, quantity: c.qty ?? c.quantity ?? 1 })
    }
  } else {
    for (const [name, qty] of Object.entries(main)) {
      cards.push({ name, quantity: typeof qty === 'number' ? qty : 1 })
    }
  }

  return { deckName: data.name ?? 'TappedOut Deck', cards }
}

// ── Deckbox ───────────────────────────────────────────────────────────────────

function getDeckboxId(url) {
  return url.match(/deckbox\.org\/sets\/(\d+)/)?.[1] ?? null
}

function parseCSVLine(line) {
  const cols = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { cols.push(cur); cur = '' }
    else { cur += ch }
  }
  cols.push(cur)
  return cols
}

async function fetchDeckbox(url) {
  const id = getDeckboxId(url)
  if (!id) throw new Error('Cannot parse Deckbox set ID from URL.')

  const res = await safeFetch(`https://deckbox.org/sets/${id}/export`)
  const text = await res.text()

  const lines = text.trim().split('\n').filter(Boolean)
  const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
  const countIdx = header.indexOf('count')
  const nameIdx = header.indexOf('name')
  if (nameIdx === -1) throw new Error('Unrecognised Deckbox export format.')

  const cards = []
  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line)
    const name = cols[nameIdx]?.trim()
    const quantity = parseInt(cols[countIdx] ?? '1', 10) || 1
    if (name) cards.push({ name, quantity })
  }

  return { deckName: `Deckbox Set ${id}`, cards }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectSite(url) {
  try { new URL(url) } catch { return null }
  if (url.includes('moxfield.com')) return 'Moxfield'
  if (url.includes('archidekt.com')) return 'Archidekt'
  if (url.includes('tappedout.net')) return 'TappedOut'
  if (url.includes('deckbox.org')) return 'Deckbox'
  return null
}

export async function fetchDeck(url) {
  const site = detectSite(url.trim())
  if (!site) throw new Error('Unsupported site. Use Moxfield, Archidekt, TappedOut, or Deckbox.')
  switch (site) {
    case 'Moxfield':  return fetchMoxfield(url)
    case 'Archidekt': return fetchArchidekt(url)
    case 'TappedOut': return fetchTappedOut(url)
    case 'Deckbox':   return fetchDeckbox(url)
  }
}
