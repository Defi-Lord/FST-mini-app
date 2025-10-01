export const config = { runtime: 'nodejs18.x' }

export default async function handler(req, res) {
  try {
    // support both /api/fpl/fixtures and /api/fpl/fixtures?future=1
    const upstream = 'https://fantasy.premierleague.com/api/fixtures/?future=1'
    const r = await fetch(upstream, { headers: { 'user-agent': 'FST/1.0' } })
    const data = await r.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: 'proxy_failed', details: String(e) })
  }
}
