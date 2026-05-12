const { put, list } = require('@vercel/blob');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function readBlob(pathname) {
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url + '?t=' + Date.now());
  return r.json();
}

async function writeBlob(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const pathname = `meeting-${id}.json`;

  try {
    if (req.method === 'GET') {
      const data = await readBlob(pathname);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);

      // 약속 신규 생성 (존재하지 않을 때만)
      if (body.action === 'init') {
        const existing = await readBlob(pathname);
        if (!existing) {
          await writeBlob(pathname, {
            title: body.title,
            mode: body.mode,
            createdAt: body.createdAt,
            participants: {},
          });
        }
        return res.status(200).json({ ok: true });
      }

      // 참여자 추가/수정 — 다른 참여자 데이터는 그대로 유지
      if (body.action === 'upsert') {
        const data = await readBlob(pathname) || {
          title: '', mode: 'slot', createdAt: Date.now(), participants: {},
        };
        data.participants[body.pid] = {
          name: body.name,
          color: body.color,
          slots: body.slots || {},
        };
        await writeBlob(pathname, data);
        return res.status(200).json({ ok: true });
      }

      // 참여자 삭제 — 해당 참여자만 제거
      if (body.action === 'delete') {
        const data = await readBlob(pathname);
        if (data && data.participants) {
          delete data.participants[body.pid];
          await writeBlob(pathname, data);
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
