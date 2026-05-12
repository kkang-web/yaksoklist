const BLOB = 'https://jsonblob.com/api/jsonBlob';

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
    const r = await fetch(`${BLOB}/${id}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(200).json(null);
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    if (id) {
      // Update existing blob
      const r = await fetch(`${BLOB}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) return res.status(r.status).json({ error: 'update failed' });
      return res.status(200).json({ ok: true, id });
    } else {
      // Create new blob
      const r = await fetch(BLOB, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) return res.status(r.status).json({ error: 'create failed' });
      const loc = r.headers.get('Location') || '';
      const blobId = loc.split('/').pop();
      if (!blobId) return res.status(500).json({ error: 'no blob id' });
      return res.status(201).json({ ok: true, id: blobId });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
