# Azarapp-v2 Context

## Architecture
- Cloudflare Workers + Durable Objects (free plan, SQLite)
- PixiJS v8 for game rendering (slot machine & horse race)
- Hybrid UI: HTML+CSS shell, PixiJS canvas for game display only

## Key Files
- `src/worker.js` — Worker entry, WebSocket upgrade, static assets
- `src/room.js` — Durable Object: room mgmt, crypto winner selection, rate limits
- `public/js/app.js` — Orchestrator: WS events → scene commands
- `public/js/networking.js` — WebSocket wrapper with ref-ID correlation
- `public/js/scenes/SlotScene.js` — Slot machine (reels, lever, LEDs, display)
- `public/js/scenes/RaceScene.js` — Horse race (pack cohesion, winner enforcement)
- `public/js/scenes/Confetti.js` — Confetti particles
- `public/index.html` — Hybrid layout with shared #game-container
- `public/style.css` — UI shell styling
- `wrangler.toml` — Config: assets + DO binding + SQLite migration

## Slot Scene
- 3 reels, each showing items in a window (3 visible rows)
- `reelBaseY = (innerH - itemH*3)/2` stored as instance var
- Golden lines at `reelBaseY + itemH` and `reelBaseY + 2*itemH`
- Lever ball interactive, triggers `__triggerDecision('slot')`
- Lever animation: down 400ms cubic-bezier, up 500ms spring-easing
- LEDs: `ledsTopY`/`ledsBotY` stored, `flashLEDs()` uses them
- Winner reel position matches displayed winner string

## Race Scene
- Server winner: `baseSpeed 0.30-0.34`, others `0.18-0.22`
- Pack cohesion: catch-up for trailers, hold-back for leaders
- Winner catch-up rubber-banding: `speed *= 1.0 + gap * 0.8`
- Finish: `finishers.sort()` puts winner first, non-winners held at 0.998
- Timeout fallback at 10s forces winner
- 8-bit pixel horse drawing with leg animation

## PixiJS v8 Patterns
- Shape-then-fill: `gfx.rect(x, y, w, h).fill({ color: 0xRRGGBB })`
- Text constructor: `new PIXI.Text({ text, style: { ... } })`
- `fill: 0xRRGGBB` (number, not string)
- Canvas resolution respects `devicePixelRatio`

## Mobile
- Canvas fixed at 780x340 internal resolution; CSS scales it uniformly via `width:100%;height:100%` (aspect-ratio matches)
- `#display` uses `aspect-ratio: 780/340` + `max-height: 50vh` (shrinks on mobile, no distortion)
- `body { align-items: flex-start }` prevents top cutoff on small screens
- Media queries for 640px and 480px breakpoints (smaller fonts, padding, borders)
- Subtitle hidden on < 480px

## Known Bugs Fixed
- **Slot invisible after race mode**: `updateDisplay()` no llamaba a `slotScene.show()`, el container quedaba oculto al volver de race mode. Fix: agregar `slotScene.show()` en la rama slot de `updateDisplay()`.
- **Canvas responsive roto**: cambiar canvas 780x340 a tamaño dinámico hacía que los textos (9px) se renderizaran sin escala, viéndose minúsculos. Fix: revertir a canvas 780x340 fijo, el CSS escala uniformemente.

## Deployed
- GitHub: https://github.com/ignacioFinochietti/AzarApp-V2
- wrangler.toml uses `new_sqlite_classes` for free plan DO migration
