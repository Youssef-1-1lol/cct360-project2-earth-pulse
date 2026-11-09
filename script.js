// Earth Pulse: API -> JSON -> JavaScript objects -> DOM and SVG.
// The visual encodings are illustrative; this is not an earthquake warning service.
const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const FEEDS = {
  day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'
};
const state = {
  events: [], filtered: [], selectedId: null, limit: 15,
  period: 'day', minimum: 2.5, search: '', sort: 'recent',
  generated: null, fetched: null, loading: false, error: '', request: null
};

function periodLength(period) {
  return (period === 'week' ? 7 : 1) * 24 * 60 * 60 * 1000;
}

function depthStyle(depth) {
  if (depth < 70) return { color: '#bc512c', light: '#eea174', label: 'Shallow earthquake' };
  if (depth <= 300) return { color: '#377e67', light: '#a4d1aa', label: 'Intermediate-depth earthquake' };
  return { color: '#416ca2', light: '#a1c2f2', label: 'Deep earthquake' };
}

function project(longitude, latitude) {
  return { x: (longitude + 180) / 360 * 1000, y: (90 - latitude) / 180 * 500 };
}

function magnitudeRadius(magnitude) {
  return Math.max(3.5, Math.min(15, 3.5 + (magnitude - 2.5) * 2.5));
}

function timeAgo(timestamp, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} days ago`;
}

function utcTime(timestamp) {
  return new Date(timestamp).toLocaleString('en-GB', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }) + ' UTC';
}

// Reject missing coordinates/magnitudes instead of silently turning null into zero.
function normalizeEvents(data, period, now = Date.now()) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)
      || !Number.isFinite(data.metadata?.generated)) {
    throw new Error('The earthquake feed was not in the expected format.');
  }
  const cutoff = now - periodLength(period);
  const ids = new Set();
  const events = [];
  for (const feature of data.features) {
    const p = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!p || p.type !== 'earthquake' || feature.geometry?.type !== 'Point'
        || !Array.isArray(coords) || coords.length < 3 || !coords.every(Number.isFinite)
        || !Number.isFinite(p.mag) || p.mag < 2.5 || !Number.isFinite(p.time)
        || p.time < cutoff || p.time > now + 60000
        || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90
        || typeof feature.id !== 'string' || ids.has(feature.id)) continue;
    ids.add(feature.id);
    let url = null;
    try {
      const candidate = new URL(p.url);
      if (candidate.protocol === 'https:' && candidate.hostname === 'earthquake.usgs.gov') url = candidate.href;
    } catch { /* An event can still be explored if its source link is missing. */ }
    events.push({
      id: feature.id, magnitude: p.mag, time: p.time,
      longitude: coords[0], latitude: coords[1], depth: coords[2],
      place: typeof p.place === 'string' && p.place.trim() ? p.place : 'Location not provided',
      review: typeof p.status === 'string' ? p.status : 'Not provided',
      magnitudeType: typeof p.magType === 'string' ? p.magType : 'unspecified', url
    });
  }
  return events;
}

function filterEvents(events, minimum, search, sort) {
  const result = events.filter((event) => event.magnitude >= minimum
    && event.place.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  if (sort === 'strongest') result.sort((a, b) => b.magnitude - a.magnitude || b.time - a.time);
  else if (sort === 'deepest') result.sort((a, b) => b.depth - a.depth || b.time - a.time);
  else result.sort((a, b) => b.time - a.time);
  return result;
}

function svgElement(tag, attrs) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

function renderMap() {
  const fragment = document.createDocumentFragment();
  // Smaller circles are appended last, so they remain selectable over larger ones.
  const ordered = [...state.filtered].sort((a, b) => b.magnitude - a.magnitude);
  const now = Date.now();
  for (const event of ordered) {
    const { x, y } = project(event.longitude, event.latitude);
    const radius = magnitudeRadius(event.magnitude);
    const style = depthStyle(event.depth);
    const freshness = Math.max(0, Math.min(1, 1 - (now - event.time) / periodLength(state.period)));
    const group = svgElement('g', {
      class: 'marker', transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})`,
      role: 'button', tabindex: '0', 'data-event-id': event.id,
      'aria-label': `Magnitude ${event.magnitude.toFixed(1)}, ${event.place}, depth ${event.depth.toFixed(1)} kilometres`,
      'aria-pressed': 'false'
    });
    group.style.setProperty('--dot-color', style.color);
    group.style.opacity = (0.4 + freshness * 0.6).toFixed(2);
    const title = svgElement('title', {});
    title.textContent = `M${event.magnitude.toFixed(1)} · ${event.place}`;
    group.append(title,
      svgElement('circle', { r: Math.max(12, radius * 2), fill: 'transparent' }),
      svgElement('circle', { r: radius * 2, class: 'halo' }),
      svgElement('circle', { r: radius, class: 'core' }));
    group.addEventListener('click', () => selectEvent(event.id));
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectEvent(event.id); }
    });
    fragment.append(group);
  }
  $('markers').replaceChildren(fragment);
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderList() {
  const fragment = document.createDocumentFragment();
  const shown = state.filtered.slice(0, state.limit);
  if (!shown.length) {
    fragment.append(textElement('p', 'empty-list', state.error
      ? 'The event log is unavailable. Try Refresh data.'
      : state.loading ? 'Fetching the latest events…' : 'No events match. Try a lower magnitude or reset the filters.'));
  }
  for (const event of shown) {
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'event-row';
    row.dataset.eventId = event.id;
    row.setAttribute('aria-pressed', String(event.id === state.selectedId));
    row.style.setProperty('--dot-color', depthStyle(event.depth).color);
    const mag = textElement('span', 'row-mag', event.magnitude.toFixed(1));
    const magLabel = textElement('small', '', 'M'); mag.prepend(magLabel);
    const place = textElement('span', 'row-place', event.place);
    place.append(textElement('small', '', `${utcTime(event.time)} · ${event.depth.toFixed(1)} km deep`));
    row.append(mag, place, textElement('span', 'row-depth', `${event.depth.toFixed(1)} km`),
      textElement('span', 'row-age', timeAgo(event.time)), textElement('span', 'row-arrow', '↗'));
    row.setAttribute('aria-label', `Explore magnitude ${event.magnitude.toFixed(1)}, ${event.place}, ${utcTime(event.time)}, depth ${event.depth.toFixed(1)} kilometres`);
    row.addEventListener('click', () => {
      selectEvent(event.id);
      // The detail panel sits above the log, so bring the selected story into view.
      const heading = $('detail-heading');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    fragment.append(row);
  }
  $('event-list').replaceChildren(fragment);
  $('load-more').hidden = shown.length >= state.filtered.length;
  $('list-summary').textContent = state.loading ? 'Loading live data…' : state.error ? 'No live event data available.'
    : `Showing ${shown.length} of ${state.filtered.length} matching events · ${state.events.length} valid M2.5+ earthquakes in the feed window.`;
}

function selectEvent(id) {
  state.selectedId = id;
  const event = state.filtered.find((item) => item.id === id);
  for (const marker of $('markers').querySelectorAll('.marker')) {
    const selected = marker.getAttribute('data-event-id') === id;
    marker.classList.toggle('selected', selected);
    marker.setAttribute('aria-pressed', String(selected));
  }
  for (const row of $('event-list').querySelectorAll('.event-row')) {
    row.setAttribute('aria-pressed', String(row.dataset.eventId === id));
  }
  if (!event) {
    $('event-index').textContent = 'NO EVENT SELECTED';
    $('detail-mag-art').textContent = '—';
    $('detail-type').textContent = 'NO MATCHING DATA';
    $('detail-place').textContent = 'A quieter view.';
    $('detail-time').textContent = state.error ? 'Refresh the feed to try again.' : 'Change your filters to explore an event.';
    for (const id of ['detail-mag', 'detail-depth', 'detail-coords', 'detail-review']) $(id).textContent = '—';
    $('event-link').hidden = true; $('event-link').removeAttribute('href');
    return;
  }
  const style = depthStyle(event.depth);
  $('event-index').textContent = `EVENT ${String(state.filtered.indexOf(event) + 1).padStart(2, '0')}`;
  $('event-orbit').style.setProperty('--event-color', style.light);
  $('event-orbit').style.setProperty('--ring-size', `${Math.max(85, Math.min(140, event.magnitude * 17 + 35))}px`);
  $('event-orbit').style.setProperty('--pulse-speed', `${Math.max(2, 7 - event.magnitude * .6)}s`);
  $('detail-mag-art').textContent = event.magnitude.toFixed(1);
  $('detail-type').textContent = style.label.toUpperCase();
  $('detail-place').textContent = event.place;
  $('detail-time').textContent = utcTime(event.time);
  $('detail-mag').textContent = `${event.magnitude.toFixed(1)} (${event.magnitudeType})`;
  $('detail-depth').textContent = `${event.depth.toFixed(1)} km`;
  $('detail-coords').textContent = `${Math.abs(event.latitude).toFixed(2)}°${event.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(event.longitude).toFixed(2)}°${event.longitude >= 0 ? 'E' : 'W'}`;
  $('detail-review').textContent = event.review;
  $('event-link').hidden = !event.url;
  if (event.url) $('event-link').href = event.url;
  else $('event-link').removeAttribute('href');
}

function render() {
  state.filtered = filterEvents(state.events, state.minimum, state.search, state.sort);
  if (!state.filtered.some((event) => event.id === state.selectedId)) state.selectedId = state.filtered[0]?.id ?? null;
  $('event-count').textContent = state.error || state.loading ? '—' : String(state.filtered.length);
  $('max-mag').textContent = state.filtered.length ? `M ${Math.max(...state.filtered.map((event) => event.magnitude)).toFixed(1)}` : '—';
  $('latest-age').textContent = state.filtered.length ? timeAgo(Math.max(...state.filtered.map((event) => event.time))) : '—';
  $('map-message').hidden = state.filtered.length > 0;
  $('map-message').textContent = state.loading ? 'Listening for the latest activity…' : state.error
    ? 'Live data is unavailable. Please try Refresh data.' : 'No matching events. Try resetting the filters.';
  renderMap(); renderList(); selectEvent(state.selectedId);
}

async function loadFeed() {
  if (state.request) state.request.abort();
  const controller = new AbortController();
  state.request = controller;
  const period = state.period;
  const timeout = setTimeout(() => controller.abort(), 15000);
  state.loading = true; state.error = '';
  $('refresh').disabled = true;
  $('map-shell').setAttribute('aria-busy', 'true');
  $('feed-state').textContent = 'UPDATING USGS DATA';
  $('feed-state').dataset.state = 'loading';
  $('status').textContent = `Fetching the ${period === 'day' ? 'past 24 hours' : 'past 7 days'} from USGS…`;
  if (!state.events.length) render();
  try {
    const response = await fetch(FEEDS[period], { signal: controller.signal });
    if (!response.ok) throw new Error(`The USGS feed returned HTTP ${response.status}.`);
    const data = await response.json();
    const events = normalizeEvents(data, period);
    if (state.request !== controller) return;
    state.events = events; state.generated = data.metadata.generated; state.fetched = Date.now();
    $('feed-state').textContent = 'LIVE USGS FEED';
    $('feed-state').dataset.state = 'live';
    $('status').textContent = `Feed generated ${utcTime(state.generated)}. Fetched ${utcTime(state.fetched)}. M2.5+ reported earthquakes.`;
  } catch (error) {
    if (state.request !== controller) return;
    state.events = []; state.generated = null; state.fetched = null;
    state.error = error.name === 'AbortError' ? 'The request timed out.' : 'Could not load the USGS feed.';
    $('feed-state').textContent = 'FEED UNAVAILABLE';
    $('feed-state').dataset.state = 'error';
    $('status').textContent = `${state.error} Check your connection and try Refresh data. No sample events are being shown.`;
  } finally {
    clearTimeout(timeout);
    if (state.request === controller) {
      state.request = null; state.loading = false;
      $('refresh').disabled = false;
      $('map-shell').setAttribute('aria-busy', 'false');
      render();
    }
  }
}

function resetFilters() {
  state.minimum = 2.5; state.search = ''; state.sort = 'recent'; state.limit = 15;
  $('magnitude').value = '2.5'; $('magnitude-value').textContent = '2.5';
  $('magnitude').setAttribute('aria-valuetext', 'Magnitude 2.5 and above');
  $('search').value = ''; $('sort').value = 'recent';
  render();
}

$('period').addEventListener('change', () => {
  state.period = $('period').value;
  state.events = []; state.selectedId = null; state.limit = 15;
  loadFeed();
});
$('magnitude').addEventListener('input', () => {
  state.minimum = Number($('magnitude').value); state.limit = 15;
  $('magnitude-value').textContent = state.minimum.toFixed(1);
  $('magnitude').setAttribute('aria-valuetext', `Magnitude ${state.minimum.toFixed(1)} and above`);
  render();
});
$('search').addEventListener('input', () => { state.search = $('search').value; state.limit = 15; render(); });
$('sort').addEventListener('change', () => { state.sort = $('sort').value; state.limit = 15; render(); });
$('reset').addEventListener('click', resetFilters);
$('refresh').addEventListener('click', loadFeed);
$('load-more').addEventListener('click', () => { state.limit += 15; renderList(); });

let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateMotion() {
  document.body.classList.toggle('motion-paused', paused);
  $('motion').textContent = paused ? 'Resume pulses' : 'Pause pulses';
  $('motion').setAttribute('aria-pressed', String(paused));
}
$('motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
updateMotion();
loadFeed();
setInterval(() => { if (!document.hidden && !state.loading) loadFeed(); }, 60000);
