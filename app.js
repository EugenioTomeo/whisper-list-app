const state = {
  captures: [],
  list: [],
  dragUid: null
};

const captureTableWrap = document.getElementById('captureTableWrap');
const listContainer = document.getElementById('listContainer');
const captureCount = document.getElementById('captureCount');
const mainStatus = document.getElementById('mainStatus');
const serviceStatus = document.getElementById('serviceStatus');

const byId = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Errore inatteso');
  }
  return data;
}

function showToast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2800);
}

function renderCaptureTable() {
  captureCount.textContent = `${state.captures.length} record`;
  if (!state.captures.length) {
    captureTableWrap.innerHTML = '<div class="muted">Nessun dato acquisito.</div>';
    return;
  }

  const rows = state.captures.map((item) => `
    <tr>
      <td>${escapeHtml(item.sourceCode)}</td>
      <td>${escapeHtml(item.idStatus || '')}</td>
      <td>${escapeHtml(item.company || '')}</td>
      <td>${escapeHtml(item.tourLeader || '')}</td>
      <td>${escapeHtml(item.deliveryPlace || '')}</td>
      <td>${escapeHtml(item.bagModel || '')}</td>
      <td>${escapeHtml(item.bagStatus || '')}</td>
      <td>${escapeHtml(item.operationNotes || '')}</td>
      <td>${escapeHtml(item.staffMDelivery || '')}</td>
      <td>${escapeHtml(item.sessionLabel || '')}</td>
    </tr>
  `).join('');

  captureTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Origine</th>
          <th>ID Status</th>
          <th>Company</th>
          <th>Tour Leader</th>
          <th>Delivery Place</th>
          <th>Bag Model</th>
          <th>Bag Status</th>
          <th>Operation Notes</th>
          <th>Staff M.Delivery</th>
          <th>Sessione</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderList() {
  listContainer.innerHTML = '';
  const template = document.getElementById('listItemTemplate');

  state.list.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.uid = item.uid;

    const checkbox = node.querySelector('input[type="checkbox"]');
    const content = node.querySelector('.item-content');
    const deleteBtn = node.querySelector('.delete-btn');

    checkbox.checked = !!item.checked;
    if (item.checked) content.classList.add('checked');

    content.innerHTML = `
      <div class="line1">
        <span class="chip">${escapeHtml(item.sourceCode)}</span>
        <span>${escapeHtml(item.idStatus || '—')}</span>
        <span>${escapeHtml(item.company || '—')}</span>
      </div>
      <div>${escapeHtml(item.deliveryPlace || '—')}</div>
      <div class="meta">Tour Leader: ${escapeHtml(item.tourLeader || '—')} · Bag: ${escapeHtml(item.bagModel || '—')} · Status: ${escapeHtml(item.bagStatus || '—')}</div>
      <div class="meta">Notes: ${escapeHtml(item.operationNotes || '—')}</div>
      <div class="meta">Staff M.Delivery: ${escapeHtml(item.staffMDelivery || '—')} · Sessione: ${escapeHtml(item.sessionLabel || '—')}</div>
    `;

    checkbox.addEventListener('change', async () => {
      await api(`/api/list/${item.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: checkbox.checked })
      });
      item.checked = checkbox.checked;
      renderList();
    });

    deleteBtn.addEventListener('click', async () => {
      const data = await api(`/api/list/${item.uid}`, { method: 'DELETE' });
      state.list = data.list;
      renderList();
      showToast('Riga cancellata');
    });

    node.addEventListener('dragstart', () => {
      state.dragUid = item.uid;
      node.classList.add('dragging');
    });

    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      state.dragUid = null;
    });

    node.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    node.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetUid = node.dataset.uid;
      if (!state.dragUid || state.dragUid === targetUid) return;
      const ordered = [...state.list];
      const fromIndex = ordered.findIndex((x) => x.uid === state.dragUid);
      const toIndex = ordered.findIndex((x) => x.uid === targetUid);
      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(toIndex, 0, moved);
      const orderedUids = ordered.map((x) => x.uid);
      const data = await api('/api/list/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedUids })
      });
      state.list = data.list;
      renderList();
    });

    listContainer.appendChild(node);
  });

  if (!state.list.length) {
    listContainer.innerHTML = '<div class="muted">La lista finale non è stata ancora generata.</div>';
  }
}

function setStatus(element, status) {
  element.textContent = status.active ? `Attiva · ${status.url || ''}` : 'Non attiva';
  element.className = `status ${status.active ? 'ok' : ''}`;
}

async function refresh() {
  const data = await api('/api/state');
  state.captures = data.captures;
  state.list = [...data.list].sort((a, b) => a.order - b.order);
  renderCaptureTable();
  renderList();
  setStatus(mainStatus, data.sessions.main);
  setStatus(serviceStatus, data.sessions.service);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

byId('openMainBtn').addEventListener('click', async () => {
  await api('/api/session/main/start', { method: 'POST' });
  await refresh();
  showToast('Browser BOOKING aperto');
});

byId('scrapeMainBtn').addEventListener('click', async () => {
  const data = await api('/api/session/main/scrape', { method: 'POST' });
  await refresh();
  showToast(`Acquisiti ${data.items.length} record da BOOKING`);
});

byId('closeMainBtn').addEventListener('click', async () => {
  await api('/api/session/main/close', { method: 'POST' });
  await refresh();
});

byId('openServiceBtn').addEventListener('click', async () => {
  await api('/api/session/service/start', { method: 'POST' });
  await refresh();
  showToast('Browser SERVICE aperto');
});

byId('scrapeServiceBtn').addEventListener('click', async () => {
  const data = await api('/api/session/service/scrape', { method: 'POST' });
  await refresh();
  showToast(`Acquisiti ${data.items.length} record da SERVICE`);
});

byId('closeServiceBtn').addEventListener('click', async () => {
  await api('/api/session/service/close', { method: 'POST' });
  await refresh();
});

byId('generateListBtn').addEventListener('click', async () => {
  const data = await api('/api/list/generate', { method: 'POST' });
  state.list = data.list;
  renderList();
  showToast('Lista generata');
});

byId('resetAllBtn').addEventListener('click', async () => {
  await api('/api/captures', { method: 'DELETE' });
  await refresh();
  showToast('Archivio svuotato');
});

refresh().catch((error) => {
  console.error(error);
  showToast(error.message);
});
