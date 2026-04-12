# Alessandro's Library

A personal Magic: The Gathering collection manager built with React. Import decks, track your cards across printings, monitor foil completions, analyse collection value, and follow market price trends — all in one place.

## Features

- **Deck import** — load decks from Moxfield, Archidekt, or TappedOut by URL; or paste any plain-text or Moxfield export directly
- **Collection management** — add and remove individual cards, search by name with autocomplete, select specific printings and finishes (non-foil / foil / etched)
- **Version tracking** — different printings of the same card are stored and displayed as separate entries
- **Gallery & Binder views** — browse your collection as a card gallery or as a set-sorted binder list
- **Filters** — filter by colour identity, card type, rarity, foil finish, and source deck; sort by name, CMC, quantity, type, colour, or rarity
- **Foil completion tracker** — see which cards you still need to foil out per deck
- **Value dashboard** — top 10 most expensive cards in your collection with live TCGPlayer market prices via Scryfall
- **Market Trends** — daily price tracking across all MTG cards with AI-generated market briefs, top gainers/losers, and per-card price history charts
- **Persistent storage** — collection synced to Supabase (PostgreSQL); falls back to localStorage when offline

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v7, Vite 6 |
| Styling | CSS custom properties, glass-morphism, CSS animations |
| Database | Supabase (PostgreSQL) |
| Card data | Scryfall API |
| Hosting | Cloudflare Pages + Cloudflare Access |
| Automation | GitHub Actions (daily price collection) |

## Running Locally

```bash
npm install
```

Create a `.env.local` file with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
```

The app runs without Supabase — it falls back to localStorage automatically if the environment variables are not set.

## Market Trends

The Market Trends page is powered by a daily GitHub Actions workflow that:

1. Downloads the full Scryfall card catalogue (~80 MB)
2. Filters to paper cards priced $1 or above
3. Stores daily price snapshots in Supabase (rolling 30-day window)
4. Computes 7-day and 30-day percentage changes for every tracked card
5. Generates an AI market brief summarising notable movers

To run the price tracker, set the following GitHub Actions secrets:

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (from Supabase → Settings → API) |
| `ANTHROPIC_API_KEY` | API key for AI brief generation (optional) |

The workflow runs automatically at 08:00 UTC every day and can also be triggered manually from the Actions tab.

## Project Structure

```
src/
├── components/
│   ├── CardGrid.jsx        # Paginated card gallery with filters
│   ├── CardTile.jsx        # Individual card with 3D tilt, foil shimmer
│   ├── CardSearch.jsx      # Autocomplete search + printing selector
│   ├── ImportPanel.jsx     # Paste decklist to import into collection
│   ├── FilterBar.jsx       # Search, colour, type, sort, source filters
│   ├── BinderView.jsx      # Set-grouped binder list view
│   ├── FoilTracker.jsx     # Foil completion tracker with hover previews
│   └── ValueDashboard.jsx  # Top 10 most valuable cards
├── lib/
│   ├── fetchers.js         # Moxfield, Archidekt, TappedOut API clients
│   ├── scryfall.js         # Scryfall enrichment, price fetching, autocomplete
│   ├── merge.js            # Deck merging with per-entry version tracking
│   ├── storage.js          # localStorage persistence, collection merge logic
│   ├── db.js               # Supabase CRUD operations
│   └── market.js           # Market trend queries (price movers, history, briefs)
└── pages/
    ├── DecksPage.jsx       # Deck loading and gallery
    ├── CollectionPage.jsx  # Collection management
    └── MarketPage.jsx      # Market trends dashboard
scripts/
└── collect-prices.mjs      # Daily price collection and AI brief generation
.github/
└── workflows/
    └── price-tracker.yml   # GitHub Actions cron workflow
```
