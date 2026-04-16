import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/** Latest AI-generated market brief. */
export async function getLatestBrief() {
  const { data } = await supabase
    .from('market_briefs')
    .select('brief, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data ?? null
}

/** Top gaining cards for a given time window (7d / 30d). */
export async function getTopGainers(window = '7d', limit = 50) {
  const col = pctCol(window)
  const { data } = await supabase
    .from('price_movers')
    .select('*')
    .gt(col, 0)
    .not('price_now', 'is', null)
    .order(col, { ascending: false })
    .limit(limit)
  return data ?? []
}

/** Top losing cards for a given time window (7d / 30d). */
export async function getTopLosers(window = '7d', limit = 50) {
  const col = pctCol(window)
  const { data } = await supabase
    .from('price_movers')
    .select('*')
    .lt(col, 0)
    .not('price_now', 'is', null)
    .order(col, { ascending: true })
    .limit(limit)
  return data ?? []
}

/** Whether price_movers has any rows at all (data collected but history still accumulating). */
export async function hasPriceData() {
  const { count } = await supabase
    .from('price_movers')
    .select('card_id', { count: 'exact', head: true })
    .not('price_now', 'is', null)
  return (count ?? 0) > 0
}

/** Full price history for a single card (up to 90 days). */
export async function getCardHistory(cardId) {
  const { data } = await supabase
    .from('price_snapshots')
    .select('price_usd, price_foil, recorded_at')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: true })
    .limit(90)
  return data ?? []
}

/**
 * Price movers for a specific set of Scryfall card IDs (for collection trends).
 * Returns all matching rows from price_movers unsorted — sort client-side.
 */
export async function getCollectionMovers(scryfallIds) {
  if (!scryfallIds.length) return []
  const { data } = await supabase
    .from('price_movers')
    .select('*')
    .in('card_id', scryfallIds)
    .not('price_now', 'is', null)
  return data ?? []
}

function pctCol(window) {
  return { '7d': 'pct_7d', '30d': 'pct_30d' }[window] ?? 'pct_7d'
}
