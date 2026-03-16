import React, { useState, useEffect } from 'react'
import { fetchAllSets } from '../lib/scryfall.js'
import { RELEVANT_SET_TYPES, ERA_OPTIONS } from '../constants.js'

export default function SetPicker({ value, onChange }) {
  const [setsByYear, setSetsByYear] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchAllSets()
      .then(sets => {
        const filtered = sets.filter(s => RELEVANT_SET_TYPES.has(s.set_type))
        const grouped = {}
        for (const s of filtered) {
          const year = s.released_at ? s.released_at.slice(0, 4) : 'Unknown'
          if (!grouped[year]) grouped[year] = []
          grouped[year].push(s)
        }
        // Sort each year's sets by release date descending
        for (const year of Object.keys(grouped)) {
          grouped[year].sort((a, b) =>
            (b.released_at || '').localeCompare(a.released_at || '')
          )
        }
        setSetsByYear(grouped)
      })
      .catch(() => setError(true))
  }, [])

  // Years sorted descending
  const years = setsByYear
    ? Object.keys(setsByYear).filter(y => y !== 'Unknown').sort((a, b) => b - a)
    : []

  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Any Set / Era</option>

      {/* Era shortcuts */}
      <optgroup label="── By Era ──">
        {ERA_OPTIONS.map(e => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </optgroup>

      {/* Specific sets grouped by year */}
      {error && (
        <optgroup label="── Sets (unavailable) ──">
          <option disabled>Could not load sets</option>
        </optgroup>
      )}
      {!error && setsByYear === null && (
        <optgroup label="── Sets ──">
          <option disabled>Loading…</option>
        </optgroup>
      )}
      {years.map(year => (
        <optgroup key={year} label={`── ${year} ──`}>
          {setsByYear[year].map(s => (
            <option key={s.code} value={`set:${s.code}`}>
              {s.name} ({s.code.toUpperCase()})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
