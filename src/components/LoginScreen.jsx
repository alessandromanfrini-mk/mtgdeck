import React, { useState } from 'react'
import { signInWithEmail } from '../lib/db.js'

const BG_ART = '/art-waltz.jpg'

export default function LoginScreen() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error: err } = await signInWithEmail(email.trim())
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Background */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <img
          src={BG_ART}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%',
            filter: 'brightness(0.28) saturate(0.7)', transform: 'scale(1.04)', display: 'block' }}
        />
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 110% 90% at 50% 30%, transparent 0%, rgba(7,6,14,0.6) 55%, rgba(7,6,14,0.92) 100%)' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(12,10,20,0.82)',
        border: '1px solid rgba(180,150,80,0.3)',
        borderRadius: 12,
        padding: '2.5rem 2rem',
        width: '100%', maxWidth: 380,
        backdropFilter: 'blur(14px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        textAlign: 'center',
      }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', color: 'var(--gold-light, #d4af6a)' }}>
          Alessandro's Library
        </h1>
        <p style={{ margin: '0 0 2rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
          Personal MTG Collection
        </p>

        {sent ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✉</div>
            <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 0.5rem', fontWeight: 600 }}>
              Check your inbox
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', margin: 0 }}>
              A sign-in link was sent to <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</strong>.
              Click it to open the app.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', textAlign: 'left', fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '0.6rem 0.75rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(180,150,80,0.25)',
                borderRadius: 6, color: '#fff', fontSize: '0.92rem',
                outline: 'none', marginBottom: error ? '0.5rem' : '1.25rem',
              }}
            />
            {error && (
              <p style={{ color: '#e57373', fontSize: '0.8rem', margin: '0 0 1rem', textAlign: 'left' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '0.65rem',
                background: loading ? 'rgba(180,150,80,0.3)' : 'rgba(180,150,80,0.85)',
                border: 'none', borderRadius: 6,
                color: loading ? 'rgba(255,255,255,0.5)' : '#1a1408',
                fontWeight: 700, fontSize: '0.88rem', cursor: loading ? 'default' : 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
