export const EXPORT_TARGETS = [
  {
    id: 'moxfield',
    label: 'Moxfield',
    importUrl: 'https://www.moxfield.com/decks/new',
    hint: 'New Deck → Import → paste list.',
    hasCsv: false,
  },
  {
    id: 'deckbox',
    label: 'Deckbox',
    importUrl: 'https://deckbox.org/sets/new',
    hint: 'Download CSV and import it into Deckbox via the CSV import option.',
    hasCsv: true,
  },
]

/**
 * Moxfield / Deckbox paste format: "1 Card Name (SET) CN"
 * Moxfield also appends *F* / *E* for foil/etched.
 */
export function formatDecklist(cards, targetId = 'moxfield') {
  const withFoilMarkers = targetId === 'moxfield'

  return [...cards]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => {
      let line = `${c.quantity} ${c.name}`
      if (c.set && c.cn) line += ` (${c.set.toUpperCase()}) ${c.cn}`
      if (withFoilMarkers) {
        if (c.finish === 'foil')   line += ' *F*'
        if (c.finish === 'etched') line += ' *E*'
      }
      return line
    })
    .join('\n')
}

/**
 * Deckbox CSV format.
 * Required columns per Deckbox docs: Count, Name, Edition, Foil, Language, Condition.
 * Edition uses the full set name (e.g. "Secret Lair Drop") — Deckbox rejects short codes.
 * Card Number is omitted as it is not in Deckbox's required column list.
 */
export function formatDeckboxCsv(cards) {
  const header = 'Count,Name,Edition,Foil,Language,Condition'

  const rows = [...cards]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => {
      const foil    = c.finish === 'foil' || c.finish === 'etched' ? 'foil' : ''
      const name    = `"${c.name.replace(/"/g, '""')}"`
      const edition = c.set_name ? `"${c.set_name.replace(/"/g, '""')}"` : ''
      return [c.quantity, name, edition, foil, 'English', 'Near Mint'].join(',')
    })

  return [header, ...rows].join('\n')
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
