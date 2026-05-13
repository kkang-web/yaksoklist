const SUPA_URL = 'https://dhwlvszqenjgddwtkqjb.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

async function readBody(req) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  await new Promise(r => req.on('end', r));
  return JSON.parse(Buffer.concat(chunks).toString());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'GET') {
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${SUPA_URL}/rest/v1/meetings?id=eq.${id}&select=data`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    const rows = await r.json();
    if (!rows.length) return res.status(200).json(null);
    return res.status(200).json(rows[0].data);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${SUPA_URL}/rest/v1/meetings`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id, data: body }),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
