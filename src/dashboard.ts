const DASHBOARD_CSS = String.raw`
:root {
  color-scheme: light;
  --bg: #f4efe5;
  --bg2: #efe5d6;
  --surface: rgba(255, 255, 255, 0.72);
  --line: rgba(20, 26, 24, 0.12);
  --ink: #101613;
  --muted: #5d6864;
  --accent: #1c5a49;
  --buy: #175d43;
  --review: #8b6516;
  --pass: #6a7170;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  font-family: "SF Pro Text", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background:
    radial-gradient(circle at top left, rgba(28, 90, 73, 0.12), transparent 28%),
    radial-gradient(circle at top right, rgba(212, 155, 42, 0.1), transparent 30%),
    linear-gradient(180deg, var(--bg), var(--bg2));
}

a { color: inherit; }
button, input, textarea { font: inherit; }

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(244, 239, 229, 0.86);
  backdrop-filter: blur(18px);
}

header h1 {
  margin: 6px 0 6px;
  font-size: clamp(1.5rem, 3.8vw, 2.4rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

header p {
  margin: 0;
  max-width: 62ch;
  color: var(--muted);
}

#status-line {
  min-width: 220px;
  text-align: right;
  color: var(--muted);
  font-size: 0.95rem;
}

header button,
.pill,
.choice {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
}

header button {
  padding: 10px 14px;
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}

header input[type="password"] {
  min-width: 180px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
}

header button:hover {
  transform: translateY(-1px);
  border-color: rgba(28, 90, 73, 0.3);
  background: rgba(255, 255, 255, 0.84);
}

main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
}

section + section {
  border-left: 1px solid var(--line);
}

section {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

h2 {
  margin: 0;
  padding: 16px 20px 10px;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  background: rgba(244, 239, 229, 0.78);
  backdrop-filter: blur(18px);
}

#queue-list,
#detail-view,
#feedback-list {
  min-height: 0;
  overflow: auto;
}

#queue-list {
  display: grid;
}

.item,
.card,
.empty {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.item {
  cursor: pointer;
  transition: background 160ms ease;
}

.item:hover,
.item.selected {
  background: rgba(28, 90, 73, 0.08);
}

.title {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.row,
.meta,
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.buy { color: var(--buy); }
.review { color: var(--review); }
.pass { color: var(--pass); }

.line { color: var(--muted); font-size: 0.92rem; }

.detail {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.detail h3 {
  margin: 0;
  font-size: clamp(1.45rem, 3vw, 2.3rem);
  line-height: 1.05;
  letter-spacing: -0.05em;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 12px;
}

.metric {
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.metric small,
.subtle {
  color: var(--muted);
}

.metric strong {
  display: block;
  margin-top: 4px;
}

.frame {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 16px;
  align-items: start;
}

.frame img,
.frame .placeholder {
  width: 100%;
  min-height: 180px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
  object-fit: cover;
}

.placeholder {
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--muted);
  padding: 16px;
}

.stack {
  display: grid;
  gap: 10px;
}

.choice {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
}

.choice input {
  accent-color: var(--accent);
}

.choice.active {
  border-color: rgba(28, 90, 73, 0.32);
  background: rgba(28, 90, 73, 0.08);
}

fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 8px;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--muted);
}

label {
  color: inherit;
}

input[type="number"],
textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
  padding: 12px 14px;
}

textarea { min-height: 96px; resize: vertical; }

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.form-actions .button {
  padding: 10px 14px;
}

.button.primary {
  background: var(--accent);
  color: white;
  border-color: rgba(28, 90, 73, 0.35);
}

.button.ghost {
  background: transparent;
}

.digest {
  margin: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
  font-family: "SF Mono", "Cascadia Mono", Consolas, monospace;
  font-size: 0.88rem;
  white-space: pre-wrap;
}

.empty {
  color: var(--muted);
}

@media (max-width: 1100px) {
  main { grid-template-columns: 1fr; }
  section + section { border-left: 0; border-top: 1px solid var(--line); }
  .frame { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  header {
    flex-direction: column;
    align-items: flex-start;
  }

  #status-line {
    text-align: left;
  }
}
`
const DASHBOARD_SCRIPT = String.raw`
const REFRESH_INTERVAL_MS = 10000;
const REQUEST_TIMEOUT_MS = 15000;

const state = {
  latest: null,
  feedback: [],
  items: [],
  selectedId: null,
  loading: true,
  scanning: false,
  error: null,
  lastSyncedAt: null
};

const ACCESS_KEY_STORAGE = 'japan-tcg-arb-access-key';

const nodes = {
  status: document.getElementById('status-line'),
  accessKey: document.getElementById('access-key'),
  unlockButton: document.getElementById('unlock-button'),
  scanButton: document.getElementById('scan-button'),
  refreshButton: document.getElementById('refresh-button'),
  copyButton: document.getElementById('copy-button'),
  queue: document.getElementById('queue-list'),
  detail: document.getElementById('detail-view'),
  feedback: document.getElementById('feedback-list')
};

function readAccessKey() {
  return localStorage.getItem(ACCESS_KEY_STORAGE)?.trim() || ''
}

function writeAccessKey(value) {
  const normalized = value.trim()
  if (normalized) {
    localStorage.setItem(ACCESS_KEY_STORAGE, normalized)
  } else {
    localStorage.removeItem(ACCESS_KEY_STORAGE)
  }

  if (nodes.accessKey) {
    nodes.accessKey.value = normalized
  }
}

function hasAccessKey() {
  return readAccessKey().length > 0
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatJpy(value) {
  return 'JPY ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
}

function formatPercent(value) {
  return (Number(value || 0) * 100).toFixed(1) + '%';
}

function timeAgo(value) {
  if (!value) {
    return 'unknown';
  }

  var delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta) || delta < 0) {
    return 'just now';
  }

  var minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return minutes + 'm ago';
  }

  var hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours + 'h ago';
  }

  return Math.floor(hours / 24) + 'd ago';
}

function fetchJson(url, options) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  var requestOptions = Object.assign({}, options || {});
  requestOptions.signal = controller.signal;
  requestOptions.headers = Object.assign(
    { 'content-type': 'application/json' },
    (options && options.headers) || {},
    hasAccessKey() ? { 'x-api-key': readAccessKey() } : {}
  );

  return fetch(url, requestOptions).then(function (response) {
    if (!response.ok) {
      throw new Error(response.status + ' ' + response.statusText);
    }
    return response.json();
  }).finally(function () {
    clearTimeout(timer);
  });
}

function buildItems(latest) {
  if (!latest) {
    return [];
  }

  var opportunities = Array.isArray(latest.opportunities) ? latest.opportunities : [];
  var scores = Array.isArray(latest.scores) ? latest.scores : [];
  var notifications = Array.isArray(latest.notifications) ? latest.notifications : [];
  var reviews = Array.isArray(latest.reviews) ? latest.reviews : [];
  var opportunityById = new Map(opportunities.map(function (entry) { return [entry.id, entry]; }));
  var scoreById = new Map(scores.map(function (entry) { return [entry.listing.id, entry]; }));

  function mergePacket(packet, kind) {
    var opportunity = opportunityById.get(packet.listingId);
    var score = scoreById.get(packet.listingId);
    var listing = score ? score.listing : opportunity;

    return {
      kind: kind,
      listingId: packet.listingId,
      title: packet.title || (listing && listing.title) || 'Untitled listing',
      marketplace: packet.marketplace || (listing && listing.marketplace) || 'other',
      riskGroup: packet.riskGroup || (listing && listing.riskGroup) || 'raw',
      askingPriceJpy: packet.askingPriceJpy || (listing && listing.askingPriceJpy) || 0,
      expectedNetJpy: packet.expectedNetJpy || 0,
      expectedReturnPct: packet.expectedReturnPct || 0,
      confidence: packet.confidence || 0,
      authProbability: packet.authProbability || 0,
      cleanProbability: packet.cleanProbability || 0,
      priorityScore: packet.priorityScore || (score && score.priorityScore) || 0,
      traderAction: packet.traderAction || packet.recommendedAction || (score && score.recommendation) || 'watch',
      summary: packet.summary || packet.question || '',
      reasons: packet.reasons || packet.evidence || (score && score.reasons) || [],
      sourceUrl: packet.sourceUrl || (listing && listing.sourceUrl) || '',
      sourceListingId: packet.sourceListingId || (listing && listing.sourceListingId) || '',
      sourceQuery: packet.sourceQuery || (listing && listing.sourceQuery) || '',
      matchedWatchlistTitle: packet.matchedWatchlistTitle || (listing && listing.matchedWatchlistTitle) || '',
      imageUrl: opportunity && opportunity.imageUrls && opportunity.imageUrls[0] ? opportunity.imageUrls[0] : '',
      notes: opportunity && Array.isArray(opportunity.notes) ? opportunity.notes : []
    };
  }

  var items = notifications.map(function (packet) { return mergePacket(packet, 'buy'); })
    .concat(reviews.map(function (packet) { return mergePacket(packet, 'review'); }));

  return items.sort(function (left, right) {
    var leftRank = left.kind === 'buy' ? 0 : 1;
    var rightRank = right.kind === 'buy' ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    return right.expectedNetJpy - left.expectedNetJpy;
  });
}

function getSelectedItem() {
  return state.items.find(function (item) {
    return item.listingId === state.selectedId;
  }) || null;
}

function setStatus(text) {
  nodes.status.textContent = text;
}

function syncChoiceStates() {
  nodes.detail.querySelectorAll('.choice').forEach(function (choice) {
    var input = choice.querySelector('input');
    choice.classList.toggle('active', !!(input && input.checked));
  });
}

function fillForm(item) {
  var form = nodes.detail.querySelector('#feedback-form');
  if (!form) {
    return;
  }

  form.querySelector('[name="listingId"]').value = item ? item.listingId : '';
  form.querySelector('[name="marketplace"]').value = item ? item.marketplace : '';
  form.querySelector('[name="riskGroup"]').value = item ? item.riskGroup : '';
  form.querySelector('[name="sourceUrl"]').value = item && item.sourceUrl ? item.sourceUrl : '';
  form.querySelector('[name="sourceListingId"]').value = item && item.sourceListingId ? item.sourceListingId : '';
  form.querySelector('[name="sourceQuery"]').value = item && item.sourceQuery ? item.sourceQuery : '';
  form.querySelector('[name="matchedWatchlistTitle"]').value = item && item.matchedWatchlistTitle ? item.matchedWatchlistTitle : '';
  form.querySelector('[name="recommendedAction"]').value = item ? (item.traderAction || 'watch') : 'watch';
  form.querySelector('[name="reviewer"]').value = 'alex';
  form.querySelector('[name="reviewedAt"]').value = new Date().toISOString();
  form.querySelector('[name="confidence"]').value = item ? String(Math.max(0, Math.min(1, Number(item.confidence || 0.5)))) : '0.50';
  form.querySelector('[name="notes"]').value = '';

  var authenticity = item && item.kind === 'buy' ? 'uncertain' : 'uncertain';
  var condition = item && item.riskGroup === 'sealed' ? 'clean' : 'uncertain';
  var action = item ? (item.kind === 'buy' ? 'buy' : 'watch') : 'watch';

  var auth = form.querySelector('input[name="authenticity"][value="' + authenticity + '"]');
  var cond = form.querySelector('input[name="condition"][value="' + condition + '"]');
  var act = form.querySelector('input[name="recommendedAction"][value="' + action + '"]');
  if (auth) { auth.checked = true; }
  if (cond) { cond.checked = true; }
  if (act) { act.checked = true; }

  var confidenceValue = form.querySelector('[data-confidence-value]');
  if (confidenceValue) {
    confidenceValue.textContent = Number(form.querySelector('[name="confidence"]').value).toFixed(2);
  }

  syncChoiceStates();
}

function renderQueue() {
  if (!state.items.length) {
    nodes.queue.innerHTML = '<div class="empty"><strong>No live alerts yet.</strong><div class="subtle">Run a scan and keep this tab open. New items will appear here as soon as the worker finds them.</div></div>';
    return;
  }

  nodes.queue.innerHTML = state.items.map(function (item, index) {
    var selected = item.listingId === state.selectedId ? ' selected' : '';
    var reasons = Array.isArray(item.reasons) ? item.reasons.slice(0, 2).join(' • ') : '';
    return [
      '<button class="item' + selected + '" type="button" data-listing-id="' + escapeHtml(item.listingId) + '">',
      '<div class="meta">',
      '<span class="pill ' + (item.kind === 'buy' ? 'buy' : 'review') + '">' + item.kind + '</span>',
      '<span class="pill">' + escapeHtml(item.marketplace) + '</span>',
      '<span class="pill">#' + String(index + 1).padStart(2, '0') + '</span>',
      '</div>',
      '<h3 class="title">' + escapeHtml(item.title) + '</h3>',
      '<div class="line">' + escapeHtml(item.matchedWatchlistTitle || 'unmatched') + ' • ' + escapeHtml(item.sourceQuery || 'no query') + '</div>',
      '<div class="row" style="margin-top: 10px;">',
      '<span class="pill">EV ' + formatJpy(item.expectedNetJpy) + '</span>',
      '<span class="pill">ask ' + formatJpy(item.askingPriceJpy) + '</span>',
      '<span class="pill">return ' + formatPercent(item.expectedReturnPct) + '</span>',
      '<span class="pill">confidence ' + formatPercent(item.confidence) + '</span>',
      reasons ? '<span class="pill">' + escapeHtml(reasons) + '</span>' : '',
      '</div>',
      '</button>'
    ].join('');
  }).join('');
}

function renderFeedbackList() {
  if (!state.feedback.length) {
    nodes.feedback.innerHTML = '<div class="empty"><strong>No labeled feedback yet.</strong><div class="subtle">Alex can add the first review after the initial live queue loads.</div></div>';
    return;
  }

  nodes.feedback.innerHTML = state.feedback.slice(0, 5).map(function (entry) {
    return [
      '<div class="card">',
      '<div class="meta">',
      '<span class="pill">' + escapeHtml(entry.authenticity || 'uncertain') + '</span>',
      '<span class="pill">' + escapeHtml(entry.condition || 'uncertain') + '</span>',
      '<span class="pill">' + escapeHtml(entry.recommendedAction || 'watch') + '</span>',
      '</div>',
      '<div class="title" style="font-size: 0.95rem; margin-top: 8px;">' + escapeHtml(entry.listingId || 'unknown listing') + '</div>',
      '<div class="subtle">' + escapeHtml(entry.notes || entry.followUp || 'No notes provided.') + '</div>',
      '</div>'
    ].join('');
  }).join('');
}

function renderDetail() {
  var item = getSelectedItem();

  if (!item) {
    nodes.detail.innerHTML = '<div class="empty"><strong>Select a listing.</strong><div class="subtle">The detail pane shows the source, evidence, and Alex review controls.</div></div>';
    return;
  }

  var reasons = Array.isArray(item.reasons) ? item.reasons : [];
  var notes = Array.isArray(item.notes) ? item.notes : [];
  var image = item.imageUrl
    ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.title) + '" loading="lazy" referrerpolicy="no-referrer" />'
    : '<div class="placeholder"><div><strong>No image captured</strong><div class="subtle">This source did not expose a reliable preview image.</div></div></div>';

  nodes.detail.innerHTML = [
    '<div class="detail">',
    '<div>',
    '<div class="meta">',
    '<span class="pill ' + (item.kind === 'buy' ? 'buy' : 'review') + '">' + item.kind + '</span>',
    '<span class="pill">' + escapeHtml(item.marketplace) + '</span>',
    '<span class="pill">' + escapeHtml(item.riskGroup) + '</span>',
    '<span class="pill">priority ' + Math.round(item.priorityScore || 0) + '</span>',
    '</div>',
    '<h3>' + escapeHtml(item.title) + '</h3>',
    '<p class="subtle">' + escapeHtml(item.summary || 'Confirm the identification, label the risk, and keep the feedback short.') + '</p>',
    '</div>',
    '<div class="metrics">',
    '<div class="metric"><small>Asking price</small><strong>' + formatJpy(item.askingPriceJpy) + '</strong></div>',
    '<div class="metric"><small>Expected net</small><strong>' + formatJpy(item.expectedNetJpy) + '</strong></div>',
    '<div class="metric"><small>Return</small><strong>' + formatPercent(item.expectedReturnPct) + '</strong></div>',
    '<div class="metric"><small>Auth probability</small><strong>' + formatPercent(item.authProbability) + '</strong></div>',
    '<div class="metric"><small>Clean probability</small><strong>' + formatPercent(item.cleanProbability) + '</strong></div>',
    '<div class="metric"><small>Confidence</small><strong>' + formatPercent(item.confidence) + '</strong></div>',
    '</div>',
    '<div class="frame">',
    image,
    '<div class="stack">',
    '<div class="row">',
    '<span class="pill">scan ' + escapeHtml(state.latest && state.latest.scanId ? state.latest.scanId.slice(0, 8) : 'n/a') + '</span>',
    '<span class="pill">updated ' + escapeHtml(state.lastSyncedAt ? timeAgo(state.lastSyncedAt) : 'n/a') + '</span>',
    '</div>',
    '<div class="subtle">Source query: ' + escapeHtml(item.sourceQuery || 'n/a') + '</div>',
    '<div class="subtle">Matched watchlist: ' + escapeHtml(item.matchedWatchlistTitle || 'n/a') + '</div>',
    '<div class="subtle">Source listing id: ' + escapeHtml(item.sourceListingId || 'n/a') + '</div>',
    item.sourceUrl ? '<a class="button ghost" href="' + escapeHtml(item.sourceUrl) + '" target="_blank" rel="noreferrer">Open source</a>' : '',
    reasons.length ? '<div><div class="subtle" style="margin-bottom: 6px;">Reasons</div><div class="row">' + reasons.map(function (reason) { return '<span class="pill">' + escapeHtml(reason) + '</span>'; }).join('') + '</div></div>' : '',
    notes.length ? '<div><div class="subtle" style="margin-bottom: 6px;">Watchlist notes</div><div class="row">' + notes.map(function (note) { return '<span class="pill">' + escapeHtml(note) + '</span>'; }).join('') + '</div></div>' : '',
    '</div>',
    '</div>',
    '<div>',
    '<div class="subtle">Alex review checklist</div>',
    '<ul class="subtle" style="padding-left: 18px; margin: 8px 0 0;">',
    '<li>Is the identification correct?</li>',
    '<li>Is it authentic, fake, or uncertain?</li>',
    '<li>Is the condition clean, damaged, or uncertain?</li>',
    '<li>Should we buy, watch, or pass?</li>',
    '<li>What is the one-line reason?</li>',
    '</ul>',
    '</div>',
    '<div>',
    '<strong>Alert digest</strong>',
    '<pre class="digest" id="digest-block">' + escapeHtml(state.latest && state.latest.alexDigest ? state.latest.alexDigest : 'No digest available yet.') + '</pre>',
    '</div>',
    '<form id="feedback-form">',
    '<input type="hidden" name="listingId" />',
    '<input type="hidden" name="marketplace" />',
    '<input type="hidden" name="riskGroup" />',
    '<input type="hidden" name="sourceUrl" />',
    '<input type="hidden" name="sourceListingId" />',
    '<input type="hidden" name="sourceQuery" />',
    '<input type="hidden" name="matchedWatchlistTitle" />',
    '<input type="hidden" name="recommendedAction" value="watch" />',
    '<input type="hidden" name="reviewer" value="alex" />',
    '<input type="hidden" name="reviewedAt" />',
    '<fieldset>',
    '<legend>Authenticity</legend>',
    '<div class="choices">',
    '<label class="choice"><input type="radio" name="authenticity" value="authentic" /> authentic</label>',
    '<label class="choice"><input type="radio" name="authenticity" value="fake" /> fake</label>',
    '<label class="choice"><input type="radio" name="authenticity" value="uncertain" checked /> uncertain</label>',
    '</div>',
    '</fieldset>',
    '<fieldset>',
    '<legend>Condition</legend>',
    '<div class="choices">',
    '<label class="choice"><input type="radio" name="condition" value="clean" /> clean</label>',
    '<label class="choice"><input type="radio" name="condition" value="damaged" /> damaged</label>',
    '<label class="choice"><input type="radio" name="condition" value="uncertain" checked /> uncertain</label>',
    '</div>',
    '</fieldset>',
    '<fieldset>',
    '<legend>Action</legend>',
    '<div class="choices">',
    '<label class="choice"><input type="radio" name="recommendedAction" value="buy" /> buy</label>',
    '<label class="choice"><input type="radio" name="recommendedAction" value="watch" checked /> watch</label>',
    '<label class="choice"><input type="radio" name="recommendedAction" value="pass" /> pass</label>',
    '</div>',
    '</fieldset>',
    '<fieldset>',
    '<legend>Confidence</legend>',
    '<div class="row" style="align-items: center;">',
    '<input type="number" name="confidence" min="0" max="1" step="0.05" value="0.50" style="max-width: 120px;" />',
    '<span class="subtle" data-confidence-value>0.50</span>',
    '</div>',
    '</fieldset>',
    '<fieldset>',
    '<legend>Notes</legend>',
    '<textarea name="notes" placeholder="One-line reason, damage clue, fake clue, or why it should stay on watch."></textarea>',
    '</fieldset>',
    '<div class="form-actions">',
    '<button class="button primary" type="submit">Save feedback</button>',
    '<span class="subtle" id="form-status">Ready to label.</span>',
    '</div>',
    '</form>',
    '</div>'
  ].join('');

  fillForm(item);
}

function renderAll() {
  renderQueue();
  renderDetail();
  renderFeedbackList();
}

function setChoiceHighlights(form) {
  form.querySelectorAll('.choice').forEach(function (choice) {
    var input = choice.querySelector('input');
    choice.classList.toggle('active', !!(input && input.checked));
  });
}

function updateConfidenceValue(form) {
  var control = form.querySelector('[name="confidence"]');
  var output = form.querySelector('[data-confidence-value]');
  if (control && output) {
    output.textContent = Number(control.value || 0).toFixed(2);
  }
}

function renderStatus() {
  if (!hasAccessKey()) {
    setStatus('Enter the access key to unlock live data.');
    return;
  }
  if (state.loading) {
    setStatus('Loading live queue...');
    return;
  }
  if (state.scanning) {
    setStatus('Scanning live sources...');
    return;
  }
  if (state.error) {
    setStatus('Sync error: ' + state.error);
    return;
  }
  setStatus('Live scan ' + (state.latest && state.latest.scanId ? state.latest.scanId.slice(0, 8) : 'n/a') + ' • refresh every ' + Math.round(REFRESH_INTERVAL_MS / 1000) + 's');
}

function selectItem(listingId) {
  state.selectedId = listingId;
  renderDetail();
  renderQueue();
}

async function refresh(options) {
  var manual = options && options.manual;
  if (!hasAccessKey()) {
    state.loading = false;
    state.error = null;
    state.items = [];
    state.feedback = [];
    state.latest = null;
    renderQueue();
    renderDetail();
    renderFeedbackList();
    renderStatus();
    return;
  }
  if (!manual) {
    state.loading = state.latest == null;
  }
  state.error = null;
  renderStatus();

  try {
    var latestPayload;
    try {
      latestPayload = await fetchJson('/live/latest', { method: 'GET' });
    } catch (error) {
      if (!String(error && error.message ? error.message : error).includes('404')) {
        throw error;
      }
      latestPayload = null;
    }

    var feedbackPayload;
    try {
      feedbackPayload = await fetchJson('/live/feedback', { method: 'GET' });
    } catch (_error) {
      feedbackPayload = { feedback: [] };
    }

    state.latest = latestPayload && latestPayload.latest ? latestPayload.latest : null;
    state.feedback = Array.isArray(feedbackPayload.feedback) ? feedbackPayload.feedback : [];
    state.items = buildItems(state.latest);
    state.lastSyncedAt = new Date().toISOString();
    state.loading = false;
    state.selectedId = state.items.some(function (item) { return item.listingId === state.selectedId; })
      ? state.selectedId
      : (state.items[0] ? state.items[0].listingId : null);

    renderAll();
    renderStatus();
  } catch (error) {
    state.error = error && error.message ? error.message : String(error);
    state.loading = false;
    renderStatus();
    renderQueue();
    renderDetail();
  }
}

async function submitFeedback(event) {
  event.preventDefault();
  var form = event.target && event.target.closest ? event.target.closest('#feedback-form') : null;
  if (!form) {
    return;
  }
  var payload = {
    listingId: form.querySelector('[name="listingId"]').value,
    marketplace: form.querySelector('[name="marketplace"]').value,
    riskGroup: form.querySelector('[name="riskGroup"]').value,
    authenticity: form.querySelector('input[name="authenticity"]:checked')?.value || 'uncertain',
    condition: form.querySelector('input[name="condition"]:checked')?.value || 'uncertain',
    recommendedAction: form.querySelector('input[name="recommendedAction"]:checked')?.value || 'watch',
    confidence: Number(form.querySelector('[name="confidence"]').value || 0.5),
    notes: form.querySelector('[name="notes"]').value.trim() || undefined,
    sourceUrl: form.querySelector('[name="sourceUrl"]').value || undefined,
    sourceListingId: form.querySelector('[name="sourceListingId"]').value || undefined,
    sourceQuery: form.querySelector('[name="sourceQuery"]').value || undefined,
    reviewer: 'alex',
    reviewedAt: new Date().toISOString()
  };

  var status = form.querySelector('#form-status');
  status.textContent = 'Saving feedback...';

  try {
    await fetchJson('/live/feedback', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    status.textContent = 'Saved.';
    await refresh({ manual: true });
  } catch (error) {
    status.textContent = 'Save failed: ' + (error && error.message ? error.message : String(error));
  }
}

async function triggerScan() {
  if (!hasAccessKey()) {
    state.error = null;
    renderStatus();
    return;
  }
  if (state.scanning) {
    return;
  }

  state.scanning = true;
  renderStatus();
  nodes.scanButton.disabled = true;
  nodes.refreshButton.disabled = true;
  nodes.copyButton.disabled = true;

  try {
    await fetchJson('/live/scan', { method: 'POST', body: '{}' });
    await refresh({ manual: true });
  } catch (error) {
    state.error = error && error.message ? error.message : String(error);
    renderStatus();
  } finally {
    state.scanning = false;
    nodes.scanButton.disabled = false;
    nodes.refreshButton.disabled = false;
    nodes.copyButton.disabled = false;
    renderStatus();
  }
}

function copyDigest() {
  if (!state.latest || !state.latest.alexDigest) {
    return;
  }
  navigator.clipboard.writeText(state.latest.alexDigest).then(function () {
    nodes.status.textContent = 'Digest copied.';
  }).catch(function () {
    nodes.status.textContent = 'Copy failed.';
  });
}

function unlockDashboard() {
  if (!nodes.accessKey) {
    return;
  }

  writeAccessKey(nodes.accessKey.value);
  state.error = null;
  nodes.accessKey.blur();
  void refresh({ manual: true });
}

nodes.queue.addEventListener('click', function (event) {
  var button = event.target.closest('[data-listing-id]');
  if (!button) {
    return;
  }
  selectItem(button.dataset.listingId);
});

nodes.detail.addEventListener('change', function (event) {
  var form = event.target && event.target.closest ? event.target.closest('#feedback-form') : null;
  if (!form) {
    return;
  }
  setChoiceHighlights(form);
  updateConfidenceValue(form);
});

nodes.detail.addEventListener('input', function (event) {
  var form = event.target && event.target.closest ? event.target.closest('#feedback-form') : null;
  if (!form) {
    return;
  }
  updateConfidenceValue(form);
});

nodes.detail.addEventListener('submit', function (event) {
  if (event.target && event.target.id === 'feedback-form') {
    void submitFeedback(event);
  }
});

nodes.scanButton.addEventListener('click', function () {
  void triggerScan();
});
nodes.refreshButton.addEventListener('click', function () {
  void refresh({ manual: true });
});
nodes.copyButton.addEventListener('click', function () {
  copyDigest();
});
if (nodes.unlockButton) {
  nodes.unlockButton.addEventListener('click', function () {
    unlockDashboard();
  });
}
if (nodes.accessKey) {
  nodes.accessKey.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      unlockDashboard();
    }
  });
}

writeAccessKey(readAccessKey());
renderStatus();
if (hasAccessKey()) {
  void refresh();
}

setInterval(function () {
  void refresh();
}, REFRESH_INTERVAL_MS);

void refresh();
`

export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Japan TCG Arb Copilot</title>
    <link rel="icon" href="data:," />
    <style>${DASHBOARD_CSS}</style>
  </head>
  <body>
    <div id="app">
      <header>
        <div>
          <div>Japan TCG Arb Copilot</div>
          <h1>Live queue, fast review, short feedback loop.</h1>
          <p>Use this surface to inspect new listings, confirm the identification, and send Alex a short label immediately.</p>
        </div>
        <div id="status-line">Loading live queue...</div>
        <div>
          <input id="access-key" type="password" placeholder="API key" autocomplete="off" />
          <button id="unlock-button" type="button">Unlock</button>
          <button id="scan-button" type="button">Run scan now</button>
          <button id="refresh-button" type="button">Refresh</button>
          <button id="copy-button" type="button">Copy digest</button>
        </div>
      </header>
      <main>
        <section>
          <h2>Live queue</h2>
          <div id="queue-list"></div>
        </section>
        <section>
          <h2>Selected listing</h2>
          <div id="detail-view"></div>
          <h2>Recent labels</h2>
          <div id="feedback-list"></div>
        </section>
      </main>
    </div>
    <script>${DASHBOARD_SCRIPT}</script>
  </body>
</html>`
}
