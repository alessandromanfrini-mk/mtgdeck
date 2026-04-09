export const EXPORT_TARGETS = [
  {
    id: 'moxfield',
    label: 'Moxfield',
    importUrl: 'https://www.moxfield.com/decks/new',
    hint: 'New Deck → Import → paste list',
  },
  {
    id: 'deckbox',
    label: 'Deckbox',
    importUrl: 'https://deckbox.org/sets/new',
    hint: 'Add Set → Import → paste list',
  },
]

/**
 * Format an array of enriched cards as a plain-text decklist.
 * Both Moxfield and Deckbox accept the "N Card Name" format.
 */
export function formatDecklist(cards) {
  return [...cards]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `${c.quantity} ${c.name}`)
    .join('\n')
}
