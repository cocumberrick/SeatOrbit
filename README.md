# SeatOrbit — Interactive 3D Venue Platform

SeatOrbit is an independent browser-based platform for exploring arenas in interactive 3D and browsing seats. Canada Life Centre in Winnipeg is its first demonstration venue. Visitors can explore sections, inspect seats, preview seat views, and follow an external ticket link when one is configured.

The Canada Life Centre model is a fan-made demonstration, not an official venue product or a surveyed architectural model. Arena dimensions, seat positions, and ticket estimates are illustrative and may differ from the real venue.

## Technology

- Vite for local development and production builds
- Vanilla JavaScript (ES modules)
- Three.js for the real-time 3D scene
- Browser `localStorage` for user fan-flag photos

## Features

- **Camera views:** Arena Overview, Exterior View, and Ice Level with a 360° look-around view from above the ice.
- **Walk / Jump Mode:** desktop keyboard and mouse exploration. The mode is disabled on touch-first/mobile layouts.
- **Arena styles:** Jets Classic and Cyber Neon.
- **Quality levels:** Lite, Standard, and Ultra. Device detection selects a starting level; Ultra asks for confirmation before activation.
- **Seat exploration:** browse sections and seats, preview the view, and see an estimated price. Prices are illustrative estimates in CAD, not live listings or seat availability.
- **Fan Flags:** attach a compressed photo to a seat. Photos stay in this browser's existing seat-ID store with section, row, and seat metadata, and remain visible in Lite mode. Stripe reconciliation uses the matching stable `section_row_seat` key. An optional public Payment Link can be configured for the $2.00 CAD slot. This static client restores a local preview after Stripe redirects back but cannot verify payment or provide server-backed fulfillment. Without a configured link, saving remains a clearly labeled local demo and collects no payment.
- **Ticket links:** the seat and section cards use one validated HTTPS link from `VITE_TICKETMASTER_URL`. The app does not sell or reserve tickets. Purchases are completed with the external ticket operator.
- **Ticketmaster Discovery adapter:** a prepared client can search Winnipeg Jets hockey events or load a configured event ID. Discovery API prices are event-level ranges, not individual seat prices or inventory.

## Getting started

Requires Node.js 18 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```sh
npm run build
npm run preview
```

## Static deployment

GitHub Pages is prepared through `.github/workflows/deploy-pages.yml`. Set the repository's Pages source to **GitHub Actions**, then push to `main` (or run the workflow manually). If the first run reports that the Pages site was not found, initialize it under **Settings → Pages** by selecting **GitHub Actions**. The workflow can also enable Pages on the first run when a repository secret named `PAGES_ENABLEMENT_TOKEN` is configured. A fine-grained token for this setup needs **Pages: read and write** and **Administration: read and write**, restricted to this repository; revoke the token after Pages is initialized. Never commit or expose it. The Vite base path is derived from `GITHUB_REPOSITORY` for repository Pages sites, and is `/` for `username.github.io` sites. Set `VITE_BASE_PATH` only when a custom path is needed.

For Vercel or Netlify, use `npm run build` as the build command and `dist` as the output directory. The app has no client-side URL routes, so the root document works on refresh without a rewrite rule. Configure any `VITE_TICKETMASTER_*` build variables in the host's project settings; the Pages workflow reads the matching GitHub Actions repository variables and `VITE_TICKETMASTER_API_KEY` secret. Add the public Stripe URL as the GitHub Actions repository variable `VITE_STRIPE_FAN_FLAG_PAYMENT_URL` for Pages. The Discovery consumer key is embedded in public client code by Vite, so use only a key intended for browser use.

## Ticketing configuration

Copy `.env.example` to `.env` and fill in values as they become available:

```dotenv
VITE_TICKETMASTER_API_KEY=
VITE_TICKETMASTER_EVENT_ID=
VITE_TICKETMASTER_VENUE_ID=
VITE_TICKETMASTER_VENUE_NAME=Canada Life Centre
VITE_TICKETMASTER_URL=
VITE_STRIPE_FAN_FLAG_PAYMENT_URL=
VITE_BASE_PATH=
```

Restart Vite after changing `.env`. Only use a public Discovery API consumer key for `VITE_TICKETMASTER_API_KEY`: Vite embeds `VITE_*` variables in browser code. Never put private or secret credentials in this file. `VITE_TICKETMASTER_URL` must be the HTTPS destination approved for the project's affiliate account. Without a configured referral URL, ticket buttons remain present but disabled with a clear message; the scene and estimated seat data continue to work without an API.

For fan flags, set `VITE_STRIPE_FAN_FLAG_PAYMENT_URL` to the HTTPS Stripe Payment Link configured for a one-time $2.00 CAD purchase. In the Stripe Dashboard, set its after-payment behavior to redirect to the deployed app root with `?fan_flag_return=1&session_id={CHECKOUT_SESSION_ID}`. For local checkout, use a separate test-mode link and a localhost return URL. The app appends the selected stable `section_row_seat` key as Stripe's `client_reference_id` for reconciliation. The return flow only restores the compressed image as a local browser display: a static site cannot securely verify a Checkout Session. Before treating this as a real paid feature, connect Stripe webhooks to a serverless/backend endpoint, verify completed sessions there, and store entitlements server-side. Never expose a Stripe secret key in a `VITE_*` variable.

The adapter is in `src/services/ticketmasterClient.js`; its functions are `searchWinnipegJetsEvents()` and `getTicketmasterEvent(eventId)`. The API adapter is prepared independently from the current seat estimate model: it does not write event-wide price ranges into individual `seatData` records and does not claim to provide per-seat availability. Affiliate attribution requires separate account approval and a valid issued link.

## Main source areas

- `src/main.js` — scene setup, camera interaction, seat selection, and UI coordination
- `src/stadium/` — rink, bowl, seats, roof, arena details, and seated fans
- `src/scene/` — Three.js scene, lighting, environment, camera presets, and controls
- `src/ui/` — toolbar, seat/section cards, About dialog, and fan-flag UI
- `src/config/` — arena geometry, render quality, and ticket-link configuration
- `src/state/photoBillboardsStore.js` — versioned local fan-flag storage

## Ticketing and project disclaimer

SeatOrbit is not the official box office of Canada Life Centre or the Winnipeg Jets. It does not sell or reserve tickets and is not affiliated with or endorsed by Canada Life Centre, True North Sports + Entertainment, the NHL, or the Winnipeg Jets. Ticket transactions, final prices, fees, event details, and seat availability are handled by the external ticket operator.

## Copyright and source license

© 2026 Danylo Marushchak. All rights reserved.

SeatOrbit's original source code and project assets are not released under an open-source license. Third-party dependencies remain subject to their own licenses, as recorded in `package-lock.json`.
