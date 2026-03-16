export const CATEGORIES = [
  { key: 'lands',   label: 'Lands',         default: 36, edhrec: 'lands' },
  { key: 'ramp',    label: 'Ramp',          default: 10, edhrec: 'ramp' },
  { key: 'draw',    label: 'Card Draw',      default: 10, edhrec: 'card-draw' },
  { key: 'removal', label: 'Removal',        default: 10, edhrec: 'removal' },
  { key: 'wincons', label: 'Win Conditions', default: 5,  edhrec: 'win-conditions' },
  { key: 'utility', label: 'Utility',        default: 18, edhrec: 'utility' },
]

export const CAT_COLORS = {
  lands:   '#7AB87A',
  ramp:    '#C9A84C',
  draw:    '#7FB3D3',
  removal: '#E87C5A',
  wincons: '#C47AB8',
  utility: '#B8B8B8',
}

export const BRACKETS = [
  { value: '', label: 'Any Bracket' },
  { value: '1', label: 'Bracket 1 — Casual' },
  { value: '2', label: 'Bracket 2 — Upgraded Precon' },
  { value: '3', label: 'Bracket 3 — Optimized' },
  { value: '4', label: 'Bracket 4 — Competitive' },
  { value: '5', label: 'Bracket 5 — cEDH' },
]

// Set types considered "real" Magic sets (excludes tokens, promos, memorabilia, etc.)
export const RELEVANT_SET_TYPES = new Set([
  'expansion', 'core', 'masters', 'commander', 'draft_innovation',
  'starter', 'battlebond', 'planechase', 'archenemy', 'conspiracy',
  'from_the_vault', 'spellbook', 'box', 'duel_deck', 'premium_deck',
])

export const ERA_OPTIONS = [
  { value: 'era:2025', label: '2025 and newer' },
  { value: 'era:2024', label: '2024 and newer' },
  { value: 'era:2022', label: '2022 and newer' },
  { value: 'era:2020', label: '2020 and newer' },
  { value: 'era:2018', label: '2018 and newer' },
  { value: 'era:2015', label: '2015 and newer' },
  { value: 'era:2010', label: '2010 and newer' },
]
