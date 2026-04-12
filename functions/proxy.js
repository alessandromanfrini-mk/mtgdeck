/**
 * Cloudflare Pages Function — server-side CORS proxy.
 * Fetches deck API URLs from Cloudflare's edge, bypassing browser CORS restrictions.
 * Only whitelisted hostnames are allowed.
 */

const ALLOWED = ['moxfield.com', 'archidekt.com', 'tappedout.net', 'deckbox.org']

export async function onRequest(context) {
  const { request } = context
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('url')

  if (!target) {
    return new Response('Missing url parameter', { status: 400 })
  }

  let targetUrl
  try {
    targetUrl = new URL(target)
  } catch {
    return new Response('Invalid url parameter', { status: 400 })
  }

  if (!ALLOWED.some(host => targetUrl.hostname.endsWith(host))) {
    return new Response('Host not allowed', { status: 403 })
  }

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept':          'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    const body = await response.arrayBuffer()

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type':                response.headers.get('Content-Type') ?? 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
