import React, { useState, useRef, memo } from 'react'
import ColorPips from './ColorPips.jsx'

const RARITY_COLOR = {
  common:   '#888',
  uncommon: '#7AAABB',
  rare:     '#B89228',
  mythic:   '#E07030',
}

function getMainType(typeLine) {
  for (const t of ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery', 'Battle']) {
    if (typeLine?.includes(t)) return t
  }
  return ''
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" viewBox%3D"0 0 146 204"%3E%3Crect width%3D"146" height%3D"204" fill%3D"%23D4A84318" rx%3D"8"%2F%3E%3C%2Fsvg%3E'

const FOIL_CLASS = {
  foil:           'foil-shimmer',
  etched:         'foil-shimmer etched',
  'rainbow-foil': 'foil-shimmer rainbow',
  'surge-foil':   'foil-shimmer surge',
  phyrexian:      'foil-shimmer phyrexian',
  'oil-slick':    'foil-shimmer oil-slick',
}

const CardTile = memo(function CardTile({ card, onRemove, priceMap }) {
  const [imgErr, setImgErr]       = useState(false)
  const [confirming, setConfirming] = useState(false)
  const tileRef = useRef(null)
  const isFoil = card.finish && card.finish !== 'nonFoil'
  const mainType = getMainType(card.type_line)

  function handleMouseMove(e) {
    const el = tileRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    el.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`
    // Foil specular position — percentage within the card
    el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((e.clientY - rect.top)  / rect.height * 100).toFixed(1)}%`)
  }

  function handleMouseLeave() {
    if (tileRef.current) {
      tileRef.current.style.transform = ''
      tileRef.current.style.removeProperty('--mx')
      tileRef.current.style.removeProperty('--my')
    }
    setConfirming(false)
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

        {/* Foil shimmer — effect varies by finish type */}
        {isFoil && <div className={FOIL_CLASS[card.finish] ?? 'foil-shimmer'} />}

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

        {/* Set + collector number badge — bottom-left of image */}
        {card.set && (
          <span
            className="set-badge"
            title={`${card.set_name ?? card.set} #${card.cn}`}
          >
            {card.set.toUpperCase()}{card.cn ? ` · ${card.cn}` : ''}
          </span>
        )}
      </div>

      {onRemove && (
        <button
          className="card-tile-remove"
          title="Remove from collection"
          onClick={e => { e.stopPropagation(); setConfirming(true) }}
        >
          ✕
        </button>
      )}

      {/* Confirmation overlay */}
      {confirming && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(8, 6, 16, 0.88)',
            backdropFilter: 'blur(6px)',
            borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '0.6rem', padding: '0.75rem',
          }}
        >
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '0.70rem',
            letterSpacing: '0.08em', color: 'var(--text-main)',
            textAlign: 'center', lineHeight: 1.4,
          }}>
            Remove from<br />collection?
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="btn btn-sm btn-danger"
              onClick={e => { e.stopPropagation(); onRemove(card.id, card.finish); setConfirming(false) }}
            >
              Remove
            </button>
            <button
              className="btn btn-sm"
              onClick={e => { e.stopPropagation(); setConfirming(false) }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card-tile-info">
        <div className="card-tile-name" title={card.name}>{card.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
          <ColorPips colorIdentity={card.color_identity} />
          {card.finish === 'etched'       && <span className="finish-badge etched"       title="Etched foil">E</span>}
          {card.finish === 'foil'         && <span className="finish-badge foil"         title="Foil">✦</span>}
          {card.finish === 'rainbow-foil' && <span className="finish-badge rainbow-foil" title="Rainbow Foil">✦</span>}
          {card.finish === 'surge-foil'   && <span className="finish-badge surge-foil"   title="Surge Foil">⚡</span>}
          {card.finish === 'phyrexian'    && <span className="finish-badge phyrexian"    title="Phyrexian">Φ</span>}
          {card.finish === 'oil-slick'    && <span className="finish-badge oil-slick"    title="Oil Slick">◈</span>}
          {card.rarity && (
            <span style={{
              fontSize: '0.58rem', fontFamily: "'JetBrains Mono', monospace",
              color: RARITY_COLOR[card.rarity] ?? '#888',
              fontWeight: 700, letterSpacing: '0.04em', marginLeft: 'auto',
            }}>
              {card.rarity === 'mythic' ? 'M' : card.rarity === 'rare' ? 'R' : card.rarity === 'uncommon' ? 'U' : 'C'}
            </span>
          )}
        </div>
        <div className="card-tile-meta">
          {mainType && <span style={{ fontSize: '0.65rem' }}>{mainType}</span>}
          {card.cmc > 0 && <span className="card-tile-cmc">{card.cmc}</span>}
        </div>
        {(() => {
          const p = priceMap?.get(card.id) ?? card.prices
          if (!p) return null
          const raw = card.finish === 'foil'   ? (p.usd_foil   ?? p.usd)
                    : card.finish === 'etched' ? (p.usd_etched ?? p.usd_foil ?? p.usd)
                    : p.usd
          const val = parseFloat(raw)
          if (!val) return null
          return <span className="card-tile-price">${val.toFixed(2)}</span>
        })()}
      </div>
    </div>
  )
})

export default CardTile
