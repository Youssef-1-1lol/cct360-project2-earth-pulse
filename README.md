# Earth Pulse

CCT360 Project 2: Designing With Data. Solo project by Youssef Alhabbal, following the individual-work option confirmed to the TA on November 8, 2026.

An interactive seismic atlas: USGS earthquake magnitude, depth, coordinates and time shape the experience. Plain HTML, CSS, JavaScript and SVG; no framework or build step.

## Website links

- Live website: https://youssef-1-1lol.github.io/cct360-project2-earth-pulse/
- Repository: https://github.com/Youssef-1-1lol/cct360-project2-earth-pulse

## Concept

The user explores a moving planet through a quiet, editorial atlas. Earthquake measurements shape the visual experience: magnitude becomes ring size, depth becomes colour, coordinates become position, event age becomes opacity, and the selected event's magnitude changes the decorative pulse speed. The map, filters, list and details share one selection state.

This is a separate project from Lab 6. It uses a different API and interaction design.

## Interactions

1. Switch between the past 24 hours and past seven days (fetches a different live feed).
2. Adjust the minimum-magnitude slider from 2.5 to 6.0.
3. Search event place names.
4. Sort by recency, magnitude or depth.
5. Select a map marker or event row to update the detail panel and matching highlights.
6. Load more event rows, reset filters, refresh the feed, or pause decorative pulses.

The map markers support Enter/Space and the event buttons provide a larger keyboard/touch alternative. Visible focus styles, status announcements, a skip link, labelled controls and reduced-motion handling are included. Filters remain available at narrow widths; the detail panel stacks below the map. Event times use UTC.

## API and processing

The public [USGS GeoJSON summary feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) needs no API key. The application requests `2.5_day.geojson` or `2.5_week.geojson` from its `/summary/` endpoint using `fetch()`, `async/await`, `response.ok`, `response.json()` and `try/catch`.

`normalizeEvents()` rejects malformed records, non-earthquake event types, missing magnitudes/coordinates, duplicates, events below M2.5, and events outside the selected rolling window. It retains the event's magnitude type (for example `mb` or `ml`) rather than calling every magnitude a Richter measurement. Source links are restricted to HTTPS on earthquake.usgs.gov; API-provided text is inserted with `textContent`.

The feed is requested at startup, when changing period, on manual refresh and every 60 seconds while the tab is visible. A 15-second timeout and abort/request-identity checks prevent stalled requests or older responses overwriting a newer view. Failures display an error and clear the data; no fabricated or cached sample events are presented as live.

The world map is a simple equirectangular projection: x=(longitude+180)/360×1000 and y=(90−latitude)/180×500. The static land outline and event markers use the same projection.

## Data-to-interface mapping

| Data | Visible result | Code |
| --- | --- | --- |
| Magnitude | Circle radius and selected-event orbit size | `magnitudeRadius()`, `selectEvent()` |
| Depth in km | Orange (<70), green (70–300), blue (>300) | `depthStyle()` |
| Longitude/latitude | Position on the map | `project()` |
| Event timestamp | Marker opacity and time labels | `renderMap()`, `timeAgo()` |
| Selected magnitude | Decorative pulse duration | `selectEvent()` |
| Filtered collection | Summary statistics and visible event list | `filterEvents()`, `render()` |

## Run and test

Serve the project directory with a static server: `python3 -m http.server 8000`, then visit http://localhost:8000. Opening via HTTP is recommended. No build, npm package or secret is required. Internet access is needed for live earthquakes and Google Fonts; system fonts are provided as fallbacks.

Run the logic checks with Node: `node tests/logic.test.cjs`. They cover normalization, projection, depth boundaries, filters, selection, malformed values, unsafe links, duplicate/expired events, out-of-order requests and failure recovery.

## Attribution

- Earthquake data: U.S. Geological Survey, [GeoJSON feed documentation](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php). USGS is the data provider, not an endorsement of this project. Data attribution and direct source links appear on the website.
- Map: [Natural Earth 1:110m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), public domain under [Natural Earth's terms](https://www.naturalearthdata.com/about/terms-of-use/). Converted to a local SVG with the equirectangular projection. No political borders are added.
- Fonts: DM Sans and Manrope via Google Fonts; Georgia/system fallbacks. No external image, audio or video assets are used.
- Code and documentation were developed with OpenAI Codex assistance. The student should review, understand and personalize the implementation, and follow the course's AI-use/disclosure rules. No claim is made that the work was produced unaided.

## Limitations

This is an exploratory visualization, not a warning service. It shows USGS-reported M2.5+ earthquakes; it is not complete global detection coverage. Measurements may be revised. Ring radius/pulse speed are illustrative encodings, not seismic wave recordings, damage estimates or ground-shaking predictions. Colour describes depth, not danger. A flat world map distorts geography, especially near the poles; no zoom/clustering is implemented, so nearby events may overlap. Use the searchable event log when a marker is hard to select. No offline earthquake snapshot is included.

## Requirement and submission status

Website requirements: public API, live JSON, at least three properties driven by data, at least two user interactions, responsive layout, live and repository links, organized source files and credited assets.

The website/source ZIP can be prepared independently. The complete assignment ALSO requires a 5–7 slide presentation and a recorded video no longer than five minutes showing face and screen together. The accessible Google Drive video link must be included in the slides. These presentation items are the next phase, not already completed deliverables. Do not submit the website alone as the complete assignment.

No final coursework submission has been made. Development commits record actual milestones on November 9, 2026.
