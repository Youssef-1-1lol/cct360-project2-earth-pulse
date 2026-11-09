// No packages needed: node tests/logic.test.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor(tag = 'div') {
    Object.assign(this, { tag, children: [], attributes: {}, dataset: {}, handlers: {}, textContent: '', value: '', hidden: false });
    this.classes = new Set();
    this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = value;
    if (name === 'data-event-id') this.dataset.eventId = value;
  }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tag === 'fragment' ? node.children : [node])); }
  prepend(node) { this.children.unshift(node); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...((child.className || '').split(' ').includes(selector.slice(1)) ? [child] : []),
      ...child.querySelectorAll(selector)
    ]);
  }
}

const elements = new Map();
const get = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
get('period').value = 'day'; get('sort').value = 'recent'; get('magnitude').value = '2.5';
const requests = [];
const context = vm.createContext({
  document: { getElementById: get, createElement: (tag) => new Element(tag),
    createElementNS: (_, tag) => new Element(tag), createDocumentFragment: () => new Element('fragment'),
    body: new Element('body'), hidden: false },
  window: { matchMedia: () => ({ matches: false }) },
  URL, Date, Math, Number, String, Error, AbortController,
  setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }))
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), context);
const now = Date.now();
const feature = (id, mag, depth, place = 'Japan', overrides = {}) => ({
  id, geometry: { type: 'Point', coordinates: [140, 35, depth] },
  properties: { type: 'earthquake', mag, place, time: now - 60000, status: 'reviewed',
    magType: 'mb', url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`, ...overrides }
});
const data = (features) => ({ type: 'FeatureCollection', metadata: { generated: now }, features });
const respond = (request, value) => request.resolve({ ok: true, json: async () => value });
const run = (code) => vm.runInContext(code, context);
const tick = () => new Promise(setImmediate);

(async () => {
  assert.match(requests[0].url, /2\.5_day\.geojson$/);
  respond(requests[0], data([feature('a', 3, 10), feature('b', 6, 400, 'Alaska'), feature('c', 4, 100)]));
  await tick();
  assert.equal(get('event-count').textContent, '3');
  assert.equal(get('max-mag').textContent, 'M 6.0');
  assert.equal(get('markers').children.length, 3);
  assert.equal(run('depthStyle(69).color'), '#bc512c');
  assert.equal(run('depthStyle(70).color'), '#377e67');
  assert.equal(run('depthStyle(300).color'), '#377e67');
  assert.equal(run('depthStyle(301).color'), '#416ca2');
  assert.equal(run('project(0,0).x'), 500); assert.equal(run('project(0,0).y'), 250);
  assert(run('magnitudeRadius(6) > magnitudeRadius(3)'));
  run("state.search='jApAn'; state.minimum=3.5; render()");
  assert.equal(get('event-count').textContent, '1');
  assert.equal(get('detail-depth').textContent, '100.0 km');
  run("state.search='nomatches'; render()");
  assert.equal(get('event-count').textContent, '0'); assert.equal(get('event-link').hidden, true);
  run('resetFilters(); selectEvent("b")');
  assert.equal(get('detail-place').textContent, 'Alaska');
  assert.equal(get('event-orbit').style['--event-color'], '#a1c2f2');
  assert.equal(get('event-link').href, 'https://earthquake.usgs.gov/earthquakes/eventpage/b');
  get('motion').handlers.click(); assert.equal(get('motion').getAttribute('aria-pressed'), 'true');
  context.fixture = data([feature('ok', 3, 5), feature('null', null, 5), feature('small', 2, 5),
    feature('old', 3, 5, 'Old', { time: now - 2 * 86400000 }), feature('badurl', 4, 3, 'Elsewhere', { url: 'javascript:alert(1)' }), feature('ok', 3, 5)]);
  const cleaned = run('normalizeEvents(fixture,"day")');
  assert.deepEqual(Array.from(cleaned, (e) => e.id), ['ok', 'badurl']);
  assert.equal(cleaned[1].url, null);
  assert.throws(() => run('normalizeEvents({features:[]},"day")'));
  const first = run('loadFeed()'), older = requests.at(-1);
  run("state.period='week'"); const second = run('loadFeed()'), newer = requests.at(-1);
  assert(older.options.signal.aborted); assert.match(newer.url, /2\.5_week/);
  respond(newer, data([feature('new', 5, 12)])); await second;
  respond(older, data([feature('old-response', 3, 12)])); await first;
  assert.equal(run('state.events[0].id'), 'new');
  const offline = run('loadFeed()'); requests.at(-1).reject(new Error('offline')); await offline;
  assert.equal(get('feed-state').textContent, 'FEED UNAVAILABLE');
  assert.equal(get('markers').children.length, 0); assert.equal(get('event-link').hidden, true);
  assert.equal(get('refresh').disabled, false); assert.equal(get('map-shell').getAttribute('aria-busy'), 'false');
  const timeout = run('loadFeed()'); requests.at(-1).reject(Object.assign(new Error('timeout'), { name: 'AbortError' })); await timeout;
  assert.match(get('status').textContent, /timed out/);
  const recovery = run('loadFeed()'); respond(requests.at(-1), data([])); await recovery;
  assert.equal(get('event-count').textContent, '0'); assert.equal(get('feed-state').textContent, 'LIVE USGS FEED');
  console.log('PASS: feed parsing, geographic projection, depth boundaries, magnitude encoding, search/filter/reset, selection, motion, null/duplicate/stale data, URL safety, response races, offline/timeout recovery and empty live feed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
