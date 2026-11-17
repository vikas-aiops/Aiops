# expense-frontend-v1

Expense app web UI: React 19, Vite, Tailwind CSS 4, shadcn/ui-style components
(Radix), Recharts and lucide-react. No telemetry or RUM.

## Build

```bash
npm ci
npm run build        # static files in dist/
```

Serve `dist/` from any static server, with `/api/` proxied to the backend
unchanged (no path rewrite) and unknown paths falling back to `index.html`
(client-side routing). The build is environment-agnostic: every API call uses
the relative base `/api`, and auth is an httpOnly cookie sent with
`credentials: 'include'`. No token is stored in the browser.

## Develop

```bash
npm run dev          # http://localhost:5173, proxies /api to 127.0.0.1:8080
VITE_API_PROXY=http://10.0.0.5:8080 npm run dev   # another backend
```

Against a local backend over plain http, run the backend with `COOKIE_SECURE=false`.

## Design system: "Ledger, not spreadsheet"

Tokens live in `src/index.css` (`@theme`). Tailwind's default colours, radii,
fonts and type scale are cleared, so only the Ledger tokens exist:

- Surfaces: `ink`, `ink-raised`, `ink-line`, `paper`, `paper-dim`; text `ink-muted`, `paper-muted`
- Signals: `ledger-green`, `stamp-amber`, `alert-coral` (plus `-deep` variants for AA text on paper)
- Fonts: Space Grotesk (titles, hero numbers), Inter (UI), JetBrains Mono with tabular numerals (`.figures`: every amount and date)
- Radius: `rounded-card` 12px, `rounded-control` 8px, `rounded-pill`
- Focus: one amber ring everywhere
- Motion: the ink stamp on a newly recorded expense (a highlight fade under `prefers-reduced-motion`), plus responses to actions only

Amounts are formatted with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`, for example `₹1,23,456.50`.

## Structure

```
src/
  lib/          api client, auth + app state, formatting, icons
  components/   app shell, expense slide-over, ledger rows, charts, ui/ (shadcn-style primitives)
  pages/        sign in / up, dashboard, expenses, categories, budgets, insights, settings
```
