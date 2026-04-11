import React, { useState, useRef } from 'react'
import ColorPips from './ColorPips.jsx'

const RARITY_COLOR = {
  common:   '#888',
  uncommon: '#7AAABB',
  rare:     '#D4A843',
  mythic:   '#E07030',
}

function getMainType(typeLine) {
  for (const t of ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery', 'Battle']) {
    if (typeLine?.includes(t)) return t
  }
  return ''
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" viewBox%3D"0 0 146 204"%3E%3Crect width%3D"146" height%3D"204" fill%3D"%23D4A84318" rx%3D"8"%2F%3E%3C%2Fsvg%3E'

export default function CardTile({ card }) {
  const [imgErr, setImgErr] = useState(false)
  const tileRef = useRef(null)
  const isFoil = card.finish === 'foil' || card.finish === 'etched'
  const mainType = getMainType(card.type_line)

  function handleMouseMove(e) {
    const el = tileRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    el.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`
  }

  function handleMouseLeave() {
    if (tileRef.current) tileRef.current.style.transform = ''
  }

  return (
    <div
      ref={tileRef}
      className="card-tile"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-tile-img-wrap">
        <img
          src={imgErr || !card.imageUrl ? PLACEHOLDER : card.imageUrl}
          alt={card.name}
          loading="lazy"
          onError={() => setImgErr(true)}
        />

        {/* Rainbow foil shimmer on foil/etched cards */}
        {isFoil && <div className="foil-shimmer" />}

        {card.quantity > 1 && (
          <span className="qty-badge">×{card.quantity}</span>
        )}
        {card.rarity && (
          <span
            className="rarity-dot"
            style={{ background: RARITY_COLOR[card.rarity] ?? '#888', color: RARITY_COLOR[card.rarity] ?? '#888' }}
            title={card.rarity}
          />
        )}
      </div>

      <div className="card-tile-info">
        <div className="card-tile-name" title={card.name}>{card.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ColorPips colorIdentity={card.color_identity} />
          {card.finish === 'etched' && <span className="finish-badge etched" title="Etched foil">E</span>}
          {card.finish === 'foil'   && <span className="finish-badge foil"   title="Foil">✦</span>}
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
