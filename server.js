import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startSession,
  closeSession,
  scrapeAllFromSession,
  getSessionStatus
} from './scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { captures: [], list: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function buildListFromCaptures(captures) {
  return captures.map((item, index) => ({
    uid: item.uid,
    order: index,
    checked: false,
    sourceCode: item.sourceCode,
    sourceLabel: item.sourceLabel,
    sessionLabel: item.sessionLabel,
    idStatus: item.idStatus || '',
    company: item.company || '',
    tourLeader: item.tourLeader || '',
    deliveryPlace: item.deliveryPlace || '',
    bagModel: item.bagModel || '',
    bagStatus: item.bagStatus || '',
    operationNotes: item.operationNotes || '',
    staffMDelivery: item.staffMDelivery || '',
    rawText: item.rawText || ''
  }));
}

app.get('/api/state', (_req, res) => {
  const db = readDb();
  res.json({
    ok: true,
    captures: db.captures,
    list: db.list,
    sessions: {
      main: getSessionStatus('main'),
      service: getSessionStatus('service')
    }
  });
});

app.post('/api/session/:name/start', async (req, res) => {
  try {
    const name = req.params.name;
    if (!['main', 'service'].includes(name)) {
      return res.status(400).json({ ok: false, error: 'Sessione non valida.' });
    }

    const targetUrl = name === 'main'
      ? 'https://booking.whisper-system.net/'
      : 'https://booking.whisper-system.net/service.php';

    const result = await startSession(name, targetUrl);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/session/:name/close', async (req, res) => {
  try {
    const name = req.params.name;
    await closeSession(name);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/session/:name/scrape', async (req, res) => {
  try {
    const name = req.params.name;
    if (!['main', 'service'].includes(name)) {
      return res.status(400).json({ ok: false, error: 'Sessione non valida.' });
    }

    const sessionLabel = name === 'main' ? 'BOOKING' : 'SERVICE';
    const items = await scrapeAllFromSession(name, sessionLabel);
    const db = readDb();

    const existing = new Set(db.captures.map((x) => x.uid));
    const merged = [...db.captures];
    for (const item of items) {
      if (!existing.has(item.uid)) {
        merged.push(item);
        existing.add(item.uid);
      }
    }

    db.captures = merged;
    writeDb(db);
    res.json({ ok: true, added: items.length, total: db.captures.length, items });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/list/generate', (req, res) => {
  const db = readDb();
  db.list = buildListFromCaptures(db.captures);
  writeDb(db);
  res.json({ ok: true, list: db.list });
});

app.post('/api/list/reorder', (req, res) => {
  const { orderedUids } = req.body;
  if (!Array.isArray(orderedUids)) {
    return res.status(400).json({ ok: false, error: 'orderedUids deve essere un array.' });
  }

  const db = readDb();
  const byId = new Map(db.list.map((x) => [x.uid, x]));
  db.list = orderedUids
    .map((uid, index) => {
      const item = byId.get(uid);
      return item ? { ...item, order: index } : null;
    })
    .filter(Boolean);

  writeDb(db);
  res.json({ ok: true, list: db.list });
});

app.patch('/api/list/:uid', (req, res) => {
  const uid = req.params.uid;
  const { checked } = req.body;
  const db = readDb();
  db.list = db.list.map((item) => item.uid === uid ? { ...item, checked: Boolean(checked) } : item);
  writeDb(db);
  res.json({ ok: true, list: db.list });
});

app.delete('/api/list/:uid', (req, res) => {
  const uid = req.params.uid;
  const db = readDb();
  db.list = db.list.filter((item) => item.uid !== uid).map((item, index) => ({ ...item, order: index }));
  writeDb(db);
  res.json({ ok: true, list: db.list });
});

app.delete('/api/captures', (_req, res) => {
  const db = readDb();
  db.captures = [];
  db.list = [];
  writeDb(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Whisper List App attiva su http://localhost:${PORT}`);
});
