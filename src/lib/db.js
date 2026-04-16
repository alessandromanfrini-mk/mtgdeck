import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

/** True when Supabase credentials are present in the environment. */
export const isConfigured = !!supabase

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Send a magic-link email. Returns { error } */
export async function signInWithEmail(email) {
  if (!supabase) return { error: new Error('Supabase not configured') }
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
}

/** Sign out the current user. */
export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Get the current session (null if not logged in). */
export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Build a stable, unique DB primary key for a card.
 *
 * Format: "{scryfallUUID}:{finish}"  — e.g. "abc-123:foil"
 * Fallback (no UUID): "{name}:{set}:{cn}:{finish}"  — e.g. "sol ring:cmd:56:nonFoil"
 *
 * Encoding finish in the key means the PRIMARY KEY column alone is sufficient
 * to distinguish every (printing × finish) combination.
 */
function makeDbId(card) {
  const finish = card.finish ?? 'nonFoil'
  if (card.id && UUID_RE.test(card.id)) return `${card.id}:${finish}`
  return `${card.name?.toLowerCase() ?? 'unknown'}:${card.set ?? ''}:${card.cn ?? ''}:${finish}`
}

/**
 * Load all cards from the collection table.
 * card_data holds all display fields; quantity comes from its own column.
 */
export async function dbLoadCollection() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('collection')
    .select('card_id, quantity, card_data')
  if (error) throw error
  // card_data is the source of truth for the card object (id, finish, name, etc.)
  // quantity is always taken from the dedicated column.
  return data.map(row => ({ ...row.card_data, quantity: row.quantity }))
}

/**
 * Upsert the full merged collection.
 * Uses card_id as the sole conflict key — finish is already encoded in it.
 */
export async function dbSaveCollection(cards) {
  if (!supabase) return
  const rows = cards.map(c => ({
    card_id:   makeDbId(c),
    quantity:  c.quantity,
    card_data: c,
  }))
  const { error } = await supabase
    .from('collection')
    .upsert(rows, { onConflict: 'card_id' })
  if (error) throw error
}

/** Upsert a single card into the collection. */
export async function dbAddCard(card) {
  if (!supabase) return
  const { error } = await supabase
    .from('collection')
    .upsert(
      { card_id: makeDbId(card), quantity: card.quantity, card_data: card },
      { onConflict: 'card_id' }
    )
  if (error) throw error
}

/** Delete a single card by its (scryfallId + finish) identity. */
export async function dbRemoveCard(cardId, finish) {
  if (!supabase) return
  const dbId = makeDbId({ id: cardId, finish: finish ?? 'nonFoil' })
  const { error } = await supabase
    .from('collection')
    .delete()
    .eq('card_id', dbId)
  if (error) throw error
}

/** Delete all rows from the collection table. */
export async function dbClearCollection() {
  if (!supabase) return
  const { error } = await supabase
    .from('collection')
    .delete()
    .neq('card_id', '')
  if (error) throw error
}
