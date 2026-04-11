import React, { useState } from 'react'
import ColorPips from './ColorPips.jsx'

const RARITY_COLOR = {
  common:   '#aaa',
  uncommon: '#8ab0c0',
  rare:     '#c9a84c',
  mythic:   '#e07030',
}

function getMainType(typeLine) {
  for (const t of ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery', 'Battle']) {
    if (typeLine?.includes(t)) return t
  }
  return ''
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" viewBox%3D"0 0 146 204"%3E%3Crect width%3D"146" height%3D"204" fill%3D"%23c9a84c22" rx%3D"8"%2F%3E%3C%2Fsvg%3E'

export default function CardTile({ card }) {
  const [imgErr, setImgErr] = useState(false)
  const mainType = getMainType(card.type_line)

  return (
    <div className="card-tile">
      <div className="card-tile-img-wrap">
        <img
          src={imgErr || !card.imageUrl ? PLACEHOLDER : card.imageUrl}
          alt={card.name}
          loading="lazy"
          onError={() => setImgErr(true)}
        />
        {card.quantity > 1 && (
          <span className="qty-badge">×{card.quantity}</span>
        )}
        {card.rarity && (
          <span
            className="rarity-dot"
            style={{ background: RARITY_COLOR[card.rarity] ?? '#aaa' }}
            title={card.rarity}
          />
        )}
      </div>

      <div className="card-tile-info">
        <div className="card-tile-name" title={card.name}>{card.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ColorPips colorIdentity={card.color_identity} />
          {card.finish === 'etched' && <span className="finish-badge etched" title="Etched foil">E</span>}
          {card.isFoil && card.finish !== 'etched' && <span className="finish-badge foil" title="Foil">✦</span>}
        </div>
        <div className="card-tile-meta">
          {mainType && <span>{mainType}</span>}
          {card.cmc > 0 && <span className="card-tile-cmc">{card.cmc}</span>}
        </div>
        {card.sources?.length > 1 && (
          <div className="card-tile-sources" title={card.sources.join(', ')}>
            {card.sources.length} decks
          </div>
        )}
      </div>
    </div>
  )
}
