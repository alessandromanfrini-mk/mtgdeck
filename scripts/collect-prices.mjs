import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_API_KEY    = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null

const BATCH       = 500
const MIN_PRICE   = 1.0       // skip cards under $1 (global market)
const SNAP_DAYS   = 30      // rolling window
const SF_COLL_URL = 'https://api.scryfall.com/cards/collection'


async function fetchBulkCards() {
  console.log('[1/7] Fetching Scryfall bulk data index…')
  const index = await fetch('https://api.scryfall.com/bulk-data').then(r => r.json())
  const entry = index.data.find(d => d.type === 'default_cards')
  if (!entry) throw new Error('Could not find default_cards bulk entry')

  console.log(`      Downloading ${entry.name} (~${Math.round(entry.size / 1e6)} MB)…`)
  const raw = await fetch(entry.download_uri).then(r => r.json())
  console.log(`      ${raw.length.toLocaleString()} total cards downloaded`)
  return raw
}


function filterCards(raw) {
  const seen    = new Set()
  const results = []

  for (const c of raw) {
    // Paper only, no digital, no tokens / emblems
    if (c.digital) continue
    if (['token', 'emblem', 'art_series', 'double_faced_token', 'memorabilia'].includes(c.layout)) continue

    const price = parseFloat(c.prices?.usd ?? 0)
    if (!price || price < MIN_PRICE) continue

    // Use Scryfall ID as card_id
    if (seen.has(c.id)) continue
    seen.add(c.id)

    results.push({
      card_id:          c.id,
      name:             c.name,
      set_code:         c.set,
      set_name:         c.set_name,
      collector_number: c.collector_number,
      image_url:        c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null,
      price_usd:        price,
      price_foil:       parseFloat(c.prices?.usd_foil ?? 0) || null,
    })
  }

  console.log(`[2/7] ${results.length.toLocaleString()} cards pass the $${MIN_PRICE}+ filter`)
  return results
}


async function fetchCollectionCards(bulkMap) {
  console.log('[2b] Reading user collection from Supabase…')

  const { data, error } = await supabase
    .from('collection')
    .select('card_data')
  if (error) throw new Error(`Collection read failed: ${error.message}`)

  // Extract raw Scryfall UUIDs from card_data
  const ids = [...new Set(
    (data ?? [])
      .map(row => row.card_data?.id)
      .filter(id => id && /^[0-9a-f-]{36}$/.test(id))
  )]

  const missing = ids.filter(id => !bulkMap.has(id))
  console.log(`      ${ids.length} unique card IDs in collection, ${missing.length} not in bulk data`)

  if (missing.length === 0) return []

  // Scryfall /cards/collection accepts up to 75 identifiers per request
  const SF_BATCH = 75
  const results  = []

  for (let i = 0; i < missing.length; i += SF_BATCH) {
    const chunk = missing.slice(i, i + SF_BATCH)
    const body  = JSON.stringify({ identifiers: chunk.map(id => ({ id })) })
    const res   = await fetch(SF_COLL_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      console.warn(`      Scryfall collection fetch failed for chunk ${i}: ${res.status}`)
      continue
    }
    const json = await res.json()
    for (const c of json.data ?? []) {
      if (c.digital) continue
      const price = parseFloat(c.prices?.usd ?? 0) || parseFloat(c.prices?.usd_foil ?? 0) || 0
      results.push({
        card_id:          c.id,
        name:             c.name,
        set_code:         c.set,
        set_name:         c.set_name,
        collector_number: c.collector_number,
        image_url:        c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null,
        price_usd:        parseFloat(c.prices?.usd ?? 0) || 0,
        price_foil:       parseFloat(c.prices?.usd_foil ?? 0) || null,
      })
    }
    // Be polite to Scryfall's rate limit
    if (i + SF_BATCH < missing.length) await new Promise(r => setTimeout(r, 120))
  }

  console.log(`      Fetched ${results.length} collection cards from Scryfall API`)
  return results
}


async function upsertSnapshots(cards) {
  const today = new Date().toISOString().slice(0, 10)
  const rows  = cards.map(c => ({
    card_id:          c.card_id,
    name:             c.name,
    set_code:         c.set_code,
    set_name:         c.set_name,
    collector_number: c.collector_number,
    image_url:        c.image_url,
    price_usd:        c.price_usd,
    price_foil:       c.price_foil,
    recorded_at:      today,
  }))

  console.log(`[3/7] Upserting ${rows.length.toLocaleString()} snapshots for ${today}…`)

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('price_snapshots')
      .upsert(batch, { onConflict: 'card_id,recorded_at' })
    if (error) throw new Error(`Snapshot upsert failed at batch ${i}: ${error.message}`)
    process.stdout.write(`\r      ${Math.min(i + BATCH, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`)
  }
  console.log()
}


async function pruneOldSnapshots() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SNAP_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  console.log(`[4/7] Deleting snapshots older than ${cutoffStr}…`)
  const { error, count } = await supabase
    .from('price_snapshots')
    .delete({ count: 'exact' })
    .lt('recorded_at', cutoffStr)
  if (error) throw new Error(`Prune failed: ${error.message}`)
  console.log(`      Deleted ${count ?? '?'} old rows`)
}


async function updateMovers(todayCards) {
  console.log('[5/7] Computing % changes vs 7d / 30d…')

  const cardIds = todayCards.map(c => c.card_id)

  // Fetch historical snapshots in batches of 100 to avoid PostgREST row limits.
  // A single unbatched query silently returns only ~1000 rows regardless of
  // how many cards are tracked, causing most pct values to stay null forever.
  const windows = { '7d': 7, '30d': 30 }
  const histMaps = {}
  const HIST_BATCH = 100

  for (const [label, days] of Object.entries(windows)) {
    const target = new Date()
    target.setDate(target.getDate() - days)
    const from = new Date(target); from.setDate(from.getDate() - 2)
    const to   = new Date(target); to.setDate(to.getDate()   + 2)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr   = to.toISOString().slice(0, 10)

    const map = new Map()
    for (let i = 0; i < cardIds.length; i += HIST_BATCH) {
      const chunk = cardIds.slice(i, i + HIST_BATCH)
      const { data, error } = await supabase
        .from('price_snapshots')
        .select('card_id, price_usd')
        .in('card_id', chunk)
        .gte('recorded_at', fromStr)
        .lte('recorded_at', toStr)
      if (error) throw new Error(`History fetch (${label}) batch ${i} failed: ${error.message}`)
      for (const row of data ?? []) {
        if (!map.has(row.card_id)) map.set(row.card_id, row.price_usd)
      }
    }
    histMaps[label] = map
    console.log(`      ${label}: ${map.size.toLocaleString()} / ${cardIds.length.toLocaleString()} historical prices found`)
  }

  const pct = (now, then) => then ? ((now - then) / then) * 100 : null

  const movers = todayCards.map(c => ({
    card_id:          c.card_id,
    name:             c.name,
    set_code:         c.set_code,
    set_name:         c.set_name,
    collector_number: c.collector_number,
    image_url:        c.image_url,
    price_now:        c.price_usd,
    pct_7d:           pct(c.price_usd, histMaps['7d'].get(c.card_id)),
    pct_30d:          pct(c.price_usd, histMaps['30d'].get(c.card_id)),
    pct_90d:          null,
    updated_at:       new Date().toISOString(),
  }))

  console.log(`[6/7] Upserting ${movers.length.toLocaleString()} rows into price_movers…`)
  for (let i = 0; i < movers.length; i += BATCH) {
    const batch = movers.slice(i, i + BATCH)
    const { error } = await supabase
      .from('price_movers')
      .upsert(batch, { onConflict: 'card_id' })
    if (error) throw new Error(`Movers upsert failed at batch ${i}: ${error.message}`)
    process.stdout.write(`\r      ${Math.min(i + BATCH, movers.length).toLocaleString()} / ${movers.length.toLocaleString()}`)
  }
  console.log()

  return movers
}


async function generateBrief(movers) {
  if (!anthropic) {
    console.log('[7/7] Skipping AI brief (no ANTHROPIC_API_KEY)')
    return
  }

  console.log('[7/7] Generating AI market brief…')

  // Top 25 by absolute % change (7d)
  const top = [...movers]
    .filter(m => m.pct_7d != null)
    .sort((a, b) => Math.abs(b.pct_7d) - Math.abs(a.pct_7d))
    .slice(0, 25)

  const gainers = top.filter(m => m.pct_7d > 0)
    .map(m => `${m.name} (${m.set_code?.toUpperCase()}) +${m.pct_7d.toFixed(1)}% → $${m.price_now.toFixed(2)}`)
    .join('\n')

  const losers = top.filter(m => m.pct_7d < 0)
    .map(m => `${m.name} (${m.set_code?.toUpperCase()}) ${m.pct_7d.toFixed(1)}% → $${m.price_now.toFixed(2)}`)
    .join('\n')

  const prompt = `You are a Magic: The Gathering market analyst. Based on today's price data, write a concise 2–3 sentence market brief for a personal MTG collection app. Focus on notable trends, potential reasons for spikes/drops (new set, bans, tournament results), and any patterns worth watching. Be direct and informative, no fluff.

Top gainers (7-day):
${gainers || 'None'}

Top losers (7-day):
${losers || 'None'}`

  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages:   [{ role: 'user', content: prompt }],
  })

  const brief = message.content[0]?.text?.trim() ?? ''
  console.log(`      Brief: "${brief.slice(0, 80)}…"`)

  const { error } = await supabase.from('market_briefs').insert({ brief })
  if (error) throw new Error(`Brief insert failed: ${error.message}`)

  // Keep only the last 30 briefs
  const { data: briefs } = await supabase
    .from('market_briefs')
    .select('id, created_at')
    .order('created_at', { ascending: false })

  if (briefs && briefs.length > 30) {
    const toDelete = briefs.slice(30).map(b => b.id)
    await supabase.from('market_briefs').delete().in('id', toDelete)
  }
}


async function main() {
  console.log('=== Alessandro\'s Library — Price Collector ===')
  console.log(`Started: ${new Date().toISOString()}\n`)

  const raw          = await fetchBulkCards()
  const filtered     = filterCards(raw)
  const bulkMap      = new Map(filtered.map(c => [c.card_id, c]))
  const collCards    = await fetchCollectionCards(bulkMap)
  const allCards     = collCards.length ? [...filtered, ...collCards] : filtered
  await upsertSnapshots(allCards)
  await pruneOldSnapshots()
  const movers    = await updateMovers(allCards)
  await generateBrief(movers)

  console.log(`\nDone: ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
