# Understand and demonstrate Earth Pulse

This guide is for reviewing the code and preparing the later slides/video. It is not a claim of personal learning experiences.

## The main flow

1. `loadFeed()` requests the selected USGS feed. `await` waits for the response without blocking the page. `response.ok` checks HTTP success, then `response.json()` reads the JSON body.
2. `normalizeEvents()` converts the nested GeoJSON features into simpler event objects and removes records that cannot be plotted reliably.
3. `filterEvents()` uses the slider, search text and sort choice to create the visible collection.
4. `render()` updates statistics, map markers and rows from that same collection, so the numbers and visualization agree.
5. `selectEvent()` changes the detail panel and highlights matching markers/rows without another network request.

## Three direct links to the API lesson

- Fetch and JSON: `loadFeed()` follows the class's fetch -> response check -> JSON -> use data sequence.
- DOM: `textContent`, `createElement`, attributes and event listeners turn data/user input into interface changes.
- Data changes CSS: magnitude, depth and age set SVG attributes and CSS custom properties. The same principle was demonstrated with temperature bars, cloud cover and wind motion in class.

SVG is used to draw the map and circles. The interface is still plain JavaScript; no mapping framework is doing the filtering or state management. Request cancellation/validation are extra robustness measures beyond the basic demo.

## Suggested demonstration after reviewing the implementation

1. Open the live site with the 24-hour view and default filters.
2. Select an orange marker, then a blue one if the current feed contains one. Compare the depth, size and detail panel.
3. Search a location that actually appears in the current log (data changes continuously).
4. Raise the magnitude slider and explain how both the map and counts update.
5. Reset filters, change to the seven-day view, and sort by deepest.
6. Pause/resume pulses. Show the mobile layout if useful.

Do not promise a particular number of earthquakes, location or largest magnitude in the recorded presentation. Those come from a live feed and will change.

## Practical checks before final submission

- Open live and repository URLs while signed out.
- Verify the ZIP includes HTML, CSS, JS, local SVG assets, README, tests and docs, but not `.git` or local QA pages.
- Complete the 5–7 slides, including both website URLs and the accessible video link.
- Record face and screen together; keep the recording at most five minutes.
- Describe only the choices and learning you actually understand; review the credited AI assistance.
- Obtain the student's confirmation before the final Quercus submission.
