# Azarapp-v2 Context

## Architecture
- Cloudflare Workers + Durable Objects (free plan, SQLite via `new_sqlite_classes`)
- PixiJS v8 for game rendering (slot machine & horse race)
- Hybrid UI: HTML+CSS shell, PixiJS canvas for game display only
- WebSocket for real-time communication (networking.js with ref-ID correlation)
- Single DO instance handles all rooms (room.js)

## Key Files
- `src/worker.js` — Worker entry, WebSocket upgrade, static assets via env.ASSETS
- `src/room.js` — Durable Object: room mgmt, crypto winner selection, rate limits (30/10s), busy timeout (20s), max 20 options
- `public/js/app.js` — Orchestrator: WS events → scene commands, PixiJS init
- `public/js/networking.js` — WebSocket wrapper with ref-ID correlation and auto-reconnect
- `public/js/scenes/SlotScene.js` — Slot machine (3 reels, lever, LEDs, display)
- `public/js/scenes/RaceScene.js` — Horse race (pack cohesion, winner enforcement)
- `public/js/scenes/Confetti.js` — Confetti particles on decision end
- `public/index.html` — Hybrid layout with shared #game-container, room overlay, QR modal
- `public/style.css` — UI shell styling, scanlines, responsive breakpoints
- `wrangler.toml` — Config: `name = "azarapp-v2"`, assets + DO binding + SQLite migration

## Slot Scene (SlotScene.js)
- 3 reels, each showing items in a window (3 visible rows, itemH=36px)
- `reelBaseY = (innerH - itemH*3)/2` stored as instance var, used in build(), showIdle(), startSpin()
- Golden lines at `reelBaseY + itemH` and `reelBaseY + 2*itemH` (winning row)
- Text vertically centered within each 36px slot via `t.anchor.y = 0.5`
- Lever ball interactive (pointerdown), triggers `__triggerDecision('slot')`
- Lever animation: down 400ms cubic-bezier (cubic), up 500ms spring-easing
- `leverMaxOffset = 100`
- LED strips top/bottom: `ledsTopY`, `ledsBotY` stored, `flashLEDs()` uses them
- Winner reel position: `targetY = reelBaseY - (centerStripIdx - 1) * itemH`
- Display centered at `displayCenterY`, re-centered after every .text change
- `buildLEDStrip(W, y)` and `flashLEDs(on)` recalculate LED positions from canvas width

### Known slot issues
- Font size 9px may be very small on phone screens (CSS scales 780px canvas to fit)
- Reel items use wordWrap for long text

## Race Scene (RaceScene.js)
- Server winner: `baseSpeed 0.30-0.34`, others `0.18-0.22`
- Winner also gets: `burstProb +0.05`, `burstPower * 1.5`
- Pack cohesion: catch-up (`speed *= 1.0 + gap * 1.5`) for trailers
- Leader hold-back: `speed *= 1.0 - (horse.x - avgX) * 0.5`
- Winner catch-up rubber-banding: `speed *= 1.0 + (leaderX - horse.x) * 0.8`
- Winner final surge past 90%: `speed *= 1.0 + (horse.x - 0.90) * 1.0; speed += 0.002`
- Finish: `finishers.sort()` puts winner first, `winnerFinished` updated live in loop
- Non-winners held at `x = 0.998` until winner crosses
- Timeout fallback at 10s forces winner crosses
- 8-bit pixel horse drawing with 6-frame leg animation cycle
- Finish banner at bottom of canvas

## PixiJS v8 Patterns
- Shape-then-fill: `gfx.rect(x, y, w, h).fill({ color: 0xRRGGBB })`
- Text constructor: `new PIXI.Text({ text, style: { fontFamily, fontSize, fill, ... } })`
- `fill: 0xRRGGBB` (number, not string)
- Canvas: 780x340 fixed internal resolution, resolution respects devicePixelRatio
- autoDensity: true

## Mobile Responsiveness
- Canvas fixed at 780x340 internal resolution; CSS scales uniformly via `width:100%;height:100%`
- `#display` uses `aspect-ratio: 780/340` + `max-height: 50vh` (shrinks on mobile, no distortion)
- `body { align-items: flex-start; padding: 8px }` prevents top cutoff on small screens
- Media queries:
  - **640px breakpoint**: reduced fonts, padding, borders, rooms
  - **480px breakpoint**: paragraph padding, smaller everything, subtitle hidden, thinner borders
- QR modal: responsive image size (140x140 on 640px, 200x200 default)
- Room overlay: centered with padding, responsive panel sizing

## Known Bugs Fixed (chronological)
1. **Migration type**: Changed `new_classes` → `new_sqlite_classes` in wrangler.toml for free plan DO compatibility
2. **Slot alignment**: `reelBaseY` stored as instance var, consistently used in build(), showIdle(), startSpin()
3. **Winner text centering**: anchor and y re-set after every .text change
4. **Lever animation**: travel 60→100px, down 400ms cubic, up 500ms spring
5. **LED position fix**: `ledsTopY`/`ledsBotY` stored as instance vars, flashLEDs() uses them
6. **Race winner guarantee**: server winner stat advantage + rubber-banding + finish blocking
7. **Slot invisible after race mode**: `updateDisplay()` missing `slotScene.show()` — add it in slot branch
8. **Canvas responsive broken**: reverting to fixed 780x340 (responsive canvas made text tiny at 1:1)

## Git History
```
* fix: revert canvas to fixed 780x340 for proper text scaling on mobile
* fix: slot scene invisible after switching from race mode
* fix: responsive canvas + mobile CSS for small screens
* fix: use new_sqlite_classes for free plan DO migration
* v2: Cloudflare Workers + PixiJS v8 slot machine & horse race
```

## Deployed
- GitHub: https://github.com/ignacioFinochietti/AzarApp-V2
- Cloudflare: `azarapp-v2` (or `azarapp` via dashboard) — deploy with `npx wrangler deploy`
- Run locally: `npx wrangler dev` (no deploy, user prefers local testing first)
