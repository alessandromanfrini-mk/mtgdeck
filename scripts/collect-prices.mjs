/**
 * Daily price collector for Alessandro's Library — Market Trends
 *
 * Steps:
 *  1. Download Scryfall default_cards bulk JSON (~80 MB)
 *  2. Filter to paper cards with a TCGPlayer price ≥ $1
 *  3. Upsert today's prices into price_snapshots (batches of 500)
 *  4. Delete snapshots older than 90 days
 *  5. Compute % change vs 7d / 30d / 90d ago for every tracked card
 *  6. Upsert results into price_movers
 *  7. Generate AI market brief from top-25 movers and store in market_briefs
 *
 * Required environment variables:
 *   SUPABASE_URL          — your project URL (not the anon key one)
 *   SUPABASE_SERVICE_KEY  — service role key (bypasses RLS)
 *   ANTHROPIC_API_KEY     — LLM API key (optional — brief is skipped if absent)
 */

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
const MIN_PRICE   = 1.0       // skip cards under $1
const SNAP_DAYS   = 30        // rolling window

// ── 1. Download bulk data ─────────────────────────────────────────────────────

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

// ── 2. Filter cards ───────────────────────────────────────────────────────────

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

// ── 3. Upsert today's snapshots ───────────────────────────────────────────────

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

// ── 4. Prune old snapshots ────────────────────────────────────────────────────

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

// ── 5 + 6. Compute % changes and upsert price_movers ─────────────────────────

async function updateMovers(todayCards) {
  console.log('[5/7] Computing % changes vs 7d / 30d / 90d…')

  // Build a map of today's prices
  const todayMap = new Map(todayCards.map(c => [c.card_id, c]))

  // Fetch historical snapshots for each window
  const windows = { '7d': 7, '30d': 30, '90d': 90 }
  const histMaps = {}

  for (const [label, days] of Object.entries(windows)) {
    const target = new Date()
    target.setDate(target.getDate() - days)
    const from = new Date(target); from.setDate(from.getDate() - 2)
    const to   = new Date(target); to.setDate(to.getDate()   + 2)

    const { data, error } = await supabase
      .from('price_snapshots')
      .select('card_id, price_usd')
      .gte('recorded_at', from.toISOString().slice(0, 10))
      .lte('recorded_at', to.toISOString().slice(0, 10))
    if (error) throw new Error(`History fetch (${label}) failed: ${error.message}`)

    // If multiple rows in the ±2 day window, take the closest one
    const map = new Map()
    for (const row of data ?? []) {
      if (!map.has(row.card_id)) map.set(row.card_id, row.price_usd)
    }
    histMaps[label] = map
    console.log(`      ${label}: ${map.size.toLocaleString()} historical prices found`)
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
    pct_90d:          pct(c.price_usd, histMaps['90d'].get(c.card_id)),
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

// ── 7. Generate AI brief ──────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Alessandro\'s Library — Price Collector ===')
  console.log(`Started: ${new Date().toISOString()}\n`)

  const raw       = await fetchBulkCards()
  const filtered  = filterCards(raw)
  await upsertSnapshots(filtered)
  await pruneOldSnapshots()
  const movers    = await updateMovers(filtered)
  await generateBrief(movers)

  console.log(`\nDone: ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
