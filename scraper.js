import crypto from 'crypto';
import { chromium } from 'playwright';

const sessions = {
  main: null,
  service: null
};

const BUTTONS = [
  { label: 'D.DELIVERY', code: 'DDV' },
  { label: 'D.REENTRY', code: 'DRT' },
  { label: 'T.DELIVERY', code: 'TDV' },
  { label: 'T.REENTRY', code: 'TRT' }
];

export function getSessionStatus(name) {
  const s = sessions[name];
  return {
    active: Boolean(s?.browser && s?.page),
    url: s?.page?.url?.() || null
  };
}

export async function startSession(name, url) {
  await closeSession(name);

  const browser = await chromium.launch({ headless: false, channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  sessions[name] = { browser, context, page, url };
  return { message: `Sessione ${name} aperta. Esegui il login nel browser che si è aperto.` };
}

export async function closeSession(name) {
  const s = sessions[name];
  if (s?.browser) {
    await s.browser.close();
  }
  sessions[name] = null;
}

export async function scrapeAllFromSession(name, sessionLabel) {
  const s = sessions[name];
  if (!s?.page) {
    throw new Error('Sessione non attiva. Apri prima la sessione e fai login.');
  }

  const all = [];
  for (const button of BUTTONS) {
    const items = await scrapeFromButton(s.page, button, sessionLabel);
    all.push(...items);
  }
  return all;
}

async function scrapeFromButton(page, button, sessionLabel) {
  const clicked = await clickButtonByText(page, button.label);
  if (!clicked) {
    return [];
  }

  await page.waitForTimeout(1200);
  const results = await page.evaluate(({ button, sessionLabel }) => {
    const TARGET_LABELS = [
      'ID Status',
      'Company',
      'Tour Leader',
      'Delivery Place',
      'Bag Model',
      'Bag Status',
      'Operation Notes',
      'Staff M.Delivery'
    ];

    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();

    const allElements = [...document.querySelectorAll('body *')];

    const buttonEl = allElements.find((el) => normalize(el.textContent) === button.label);
    let scopeRoot = document.body;
    if (buttonEl) {
      scopeRoot = buttonEl.closest('section, article, .panel, .tab-pane, .content, .container, .box, .card, div') || document.body;
    }

    const blocks = [...scopeRoot.querySelectorAll('table, .card, .box, .row, .list-group-item, .item, article, section, tr, li, div')]
      .filter((el) => {
        const text = normalize(el.textContent);
        const matches = TARGET_LABELS.filter((label) => text.includes(label)).length;
        return matches >= 4;
      });

    const uniqueBlocks = [];
    const seenTexts = new Set();
    for (const block of blocks) {
      const text = normalize(block.textContent);
      if (text.length < 30 || seenTexts.has(text)) continue;
      seenTexts.add(text);
      uniqueBlocks.push(block);
    }

    const getValueNearLabel = (root, label) => {
      const text = root.innerText || root.textContent || '';
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nextLabels = TARGET_LABELS.filter((x) => x !== label)
        .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      const regex = new RegExp(`${escaped}\\s*:?\\s*([\\s\\S]*?)(?=(?:${nextLabels})\\s*:|$)`, 'i');
      const match = text.match(regex);
      return normalize(match?.[1] || '');
    };

    const parsed = uniqueBlocks.map((block, index) => {
      const rawText = normalize(block.innerText || block.textContent || '');
      const item = {
        sourceLabel: button.label,
        sourceCode: button.code,
        sessionLabel,
        idStatus: getValueNearLabel(block, 'ID Status'),
        company: getValueNearLabel(block, 'Company'),
        tourLeader: getValueNearLabel(block, 'Tour Leader'),
        deliveryPlace: getValueNearLabel(block, 'Delivery Place'),
        bagModel: getValueNearLabel(block, 'Bag Model'),
        bagStatus: getValueNearLabel(block, 'Bag Status'),
        operationNotes: getValueNearLabel(block, 'Operation Notes'),
        staffMDelivery: getValueNearLabel(block, 'Staff M.Delivery'),
        rawText,
        blockIndex: index
      };
      return item;
    }).filter((item) => {
      return [item.idStatus, item.company, item.tourLeader, item.deliveryPlace, item.rawText].some(Boolean);
    });

    return parsed;
  }, { button, sessionLabel });

  return results.map((item) => {
    const uidBase = [
      sessionLabel,
      button.code,
      item.idStatus,
      item.company,
      item.tourLeader,
      item.deliveryPlace,
      item.bagModel,
      item.bagStatus
    ].join('|');

    return {
      ...item,
      uid: crypto.createHash('sha1').update(uidBase || JSON.stringify(item)).digest('hex').slice(0, 16)
    };
  });
}

async function clickButtonByText(page, text) {
  const candidates = [
    page.getByRole('button', { name: text, exact: true }),
    page.getByText(text, { exact: true }),
    page.locator(`text="${text}"`)
  ];

  for (const candidate of candidates) {
    try {
      const count = await candidate.count();
      if (count > 0) {
        await candidate.first().click({ timeout: 2000 });
        return true;
      }
    } catch {
      // continue
    }
  }

  return page.evaluate((btnText) => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const els = [...document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div, span')];
    const target = els.find((el) => normalize(el.textContent || el.value) === btnText);
    if (!target) return false;
    target.click();
    return true;
  }, text);
}
