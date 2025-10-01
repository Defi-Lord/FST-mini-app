// api/fpl/element-summary/[id].ts
export default async function handler(req, res) {
  try {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'missing_id' })

    const upstream = `https://fantasy.premierleague.com/api/element-summary/${id}/`
    const r = await fetch(upstream, { headers: { 'user-agent': 'FST/1.0' } })

    if (!r.ok) {
      return res.status(r.status).json({ error: 'upstream_error', status: r.status })
    }

    const data = await r.json()
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: 'proxy_failed', details: String(e) })
  }
}
