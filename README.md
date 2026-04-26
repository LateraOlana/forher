# Skyward ✈️

A love letter from the sky.

A small, beautifully animated flight tracker built for following someone you care about across the world. Enter a flight number, watch a plane drift across a starlit map in real time, and read a little note about where they are right now.

No backend. No API keys. Just HTML, CSS, and a sprinkle of JavaScript.

---

## Quick start

1. Drop these four files into a new GitHub repository:
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
2. In your repo, go to **Settings → Pages**.
3. Under **Source**, choose `main` (or whichever branch you pushed to) and `/ (root)`.
4. Save. GitHub will give you a URL like `https://yourname.github.io/your-repo/`.

That's it. No build step, no dependencies to install.

You can also just open `index.html` directly in a browser to try it locally.

## How to use it

1. Type a flight number like `BA286`, `AA100`, `LH441`, `EK215`, or `QF8`.
2. Hit **Track flight**.
3. Watch the route draw itself across the map, with the plane's live position pulsing along the path.

The map auto-refreshes every 30 seconds while a flight is in the air.

## How it works

Skyward uses two free, no-key APIs:

- **[adsb.lol](https://adsb.lol/)** for live aircraft positions (community-fed ADS-B network, drop-in compatible with the ADSBexchange API)
- **[hexdb.io](https://hexdb.io/)** for callsign → origin/destination route lookups

It matches your flight number to an active aircraft by callsign, then draws:

- A great-circle route line between origin and destination
- A solid trail showing how far they've already flown
- A pulsing little plane icon at their current position, rotated to their heading
- Live altitude, speed, heading, and a progress bar with ETA

If the flight isn't currently airborne, you'll get a friendly note. ADS-B networks only see flights that are actively transmitting, so very short hops or some regional flights may not appear.

## Customizing

Everything lives in `app.js`. The two big lookup tables you might want to extend:

- **`AIRLINES`** — IATA two-letter codes mapped to ICAO three-letter callsign prefixes. Add more carriers here if you find one that doesn't resolve.
- **`AIRPORTS`** — Airports keyed by ICAO code, with IATA, name, city, country, and coordinates. Add airports here so route lines and labels look nice.

Colors and animation timing live as CSS variables at the top of `style.css`. Tweak `--gold`, `--coral`, `--sky` and the gradient stops to change the whole mood.

## Credits

- Live aircraft data — [ADSB.lol](https://adsb.lol/)
- Route data — [hexdb.io](https://hexdb.io/)
- Map tiles — [CARTO](https://carto.com/) on [OpenStreetMap](https://www.openstreetmap.org/)
- Map library — [Leaflet](https://leafletjs.com/)
- Fonts — Instrument Serif & Manrope, via Google Fonts

Made with care. Safe travels, Norma. 💛
