import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

/** True when Supabase credentials are present in the environment. */
export const isConfigured = !!supabase

/**
 * Load all cards from the collection table.
 * Returns an array of enriched card objects, or null if Supabase is not configured.
 */
export async function dbLoadCollection() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('collection')
    .select('card_id, finish, quantity, card_data')
  if (error) throw error
  // Reconstruct card objects: card_data holds all display fields, quantity is stored separately
  return data.map(row => ({ ...row.card_data, quantity: row.quantity }))
}

/**
 * Upsert the full merged collection to Supabase.
 * Existing rows (matched by card_id + finish) are updated; new rows are inserted.
 */
export async function dbSaveCollection(cards) {
  if (!supabase) return
  const rows = cards.map(c => ({
    card_id:   c.id,
    finish:    c.finish ?? 'nonFoil',
    quantity:  c.quantity,
    card_data: c,
  }))
  const { error } = await supabase
    .from('collection')
    .upsert(rows, { onConflict: 'card_id,finish' })
  if (error) throw error
}

/** Delete all rows from the collection table. */
export async function dbClearCollection() {
  if (!supabase) return
  const { error } = await supabase
    .from('collection')
    .delete()
    .neq('card_id', '')   // match all rows
  if (error) throw error
}
