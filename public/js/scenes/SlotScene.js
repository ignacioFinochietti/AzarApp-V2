class SlotScene {
  constructor(app) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    app.stage.addChild(this.container);

    this.reels = [];
    this.finalWinner = null;
    this.isSpinning = false;
    this.completed = 0;
    this.startTime = 0;
    this.reelDurations = [2800, 3100, 3400];
    this.itemH = 36;

    this.ledsTopGfx = null;
    this.ledsBotGfx = null;
    this.ledsTopY = 0;
    this.ledsBotY = 0;
    this.ledState = false;
    this.leverBall = null;
    this.leverBaseY = 0;
    this.leverMaxOffset = 0;
    this.slotDisplay = null;
    this.displayCenterY = 0;
    this.displayW = 220;
    this.reelBaseY = 0;
  }

  build(opts) {
    const c = this.container;
    c.removeChildren();

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, W, H).fill({ color: 0x1a1020 });
    c.addChild(bg);

    // Cabinet corners
    const corners = new PIXI.Graphics();
    corners.rect(0, 0, 12, 12).stroke({ width: 3, color: 0x8b7355 });
    corners.rect(W - 12, 0, 12, 12).stroke({ width: 3, color: 0x8b7355 });
    corners.rect(0, H - 12, 12, 12).stroke({ width: 3, color: 0x8b7355 });
    corners.rect(W - 12, H - 12, 12, 12).stroke({ width: 3, color: 0x8b7355 });
    c.addChild(corners);

    // Brand text
    const brand = new PIXI.Text({
      text: '★ T R A G A P E R R A S ★',
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 10,
        fill: 0xf5c518,
        letterSpacing: 2,
      }
    });
    brand.anchor.set(0.5, 0);
    brand.x = W / 2;
    brand.y = 10;
    c.addChild(brand);

    // LED strip top
    this.ledsTopY = 26;
    this.ledsTopGfx = this.buildLEDStrip(W, this.ledsTopY);
    c.addChild(this.ledsTopGfx);

    // Reel area
    const reelMargin = 20;
    const leverW = 36;
    const reelX = reelMargin;
    const reelW = W - reelMargin * 2 - leverW;
    const reelY = 34;
    const reelH = this.itemH * 6;

    // Reel outer frame
    const reelFrame = new PIXI.Graphics();
    reelFrame.rect(reelX - 4, reelY - 4, reelW + 8, reelH + 8)
      .fill({ color: 0x1a1a2e });
    reelFrame.rect(reelX - 4, reelY - 4, reelW + 8, reelH + 8)
      .stroke({ width: 4, color: 0x8b7355 });
    reelFrame.rect(reelX, reelY, reelW, reelH)
      .stroke({ width: 2, color: 0x5c4a32 });
    c.addChild(reelFrame);

    // Reels
    const reelContainer = new PIXI.Container();
    reelContainer.x = reelX + 4;
    reelContainer.y = reelY + 4;
    c.addChild(reelContainer);

    this.reels = [];
    const gap = 6;
    const reelWidth = (reelW - 8 - gap * 2) / 3;
    const innerH = reelH - 8;
    this.reelBaseY = (innerH - this.itemH * 3) / 2;

    for (let r = 0; r < 3; r++) {
      const strip = new PIXI.Container();
      strip.x = r * (reelWidth + gap);
      reelContainer.addChild(strip);

      // Reel window bg
      const windowBg = new PIXI.Graphics();
      windowBg.rect(0, 0, reelWidth, innerH).fill({ color: 0x08081a });
      windowBg.rect(0, 0, reelWidth, innerH).stroke({ width: 3, color: 0x5c4a32 });
      strip.addChild(windowBg);

      // Center highlight lines (winning row)
      const centerY = this.reelBaseY + this.itemH;
      const centerLine = new PIXI.Graphics();
      centerLine.rect(0, centerY, reelWidth, 1).fill({ color: 0xf5c518, alpha: 0.3 });
      centerLine.rect(0, centerY + this.itemH, reelWidth, 1).fill({ color: 0xf5c518, alpha: 0.3 });
      strip.addChild(centerLine);

      // Items container
      const itemsContainer = new PIXI.Container();
      itemsContainer.x = 4;
      itemsContainer.y = this.reelBaseY;
      strip.addChild(itemsContainer);

      // Mask
      const mask = new PIXI.Graphics();
      mask.rect(0, 0, reelWidth, innerH).fill({ color: 0xffffff });
      itemsContainer.mask = mask;
      strip.addChild(mask);

      this.reels.push({ container: itemsContainer, reelWidth });
    }

    // Lever
    const leverX = reelX + reelW + 10;

    // Lever rail
    const leverRail = new PIXI.Graphics();
    leverRail.rect(leverX + 10, reelY + 10, 6, reelH - 20)
      .fill({ color: 0x5c4a32 });
    leverRail.rect(leverX + 11, reelY + 10, 4, reelH - 20)
      .fill({ color: 0x3a2a1a });
    c.addChild(leverRail);

    // Lever rod
    this.leverRod = new PIXI.Graphics();
    this.leverBaseY = reelY + 10;
    this.leverMaxOffset = 100;
    this.drawLever(0);
    this.leverRod.x = leverX + 10;
    this.leverRod.y = this.leverBaseY;
    c.addChild(this.leverRod);

    // Lever ball (interactive)
    this.leverBall = new PIXI.Graphics();
    this.leverBall.circle(7, 0, 10).fill({ color: 0xc0392b });
    this.leverBall.circle(5, -2, 4).fill({ color: 0xff6b6b });
    this.leverBall.x = leverX + 10;
    this.leverBall.y = this.leverBaseY - 16;
    this.leverBall.eventMode = 'static';
    this.leverBall.cursor = 'pointer';
    this.leverBall.on('pointerdown', () => {
      if (!this.isSpinning) {
        window.__triggerDecision?.('slot');
      }
    });
    c.addChild(this.leverBall);

    // Display box
    const displayH = 24;
    const displayX = (W - this.displayW) / 2;
    const displayY = H - 56;
    this.displayCenterY = displayY + displayH / 2;

    const displayBox = new PIXI.Graphics();
    displayBox.rect(displayX, displayY, this.displayW, displayH)
      .fill({ color: 0x08081a });
    displayBox.rect(displayX, displayY, this.displayW, displayH)
      .stroke({ width: 3, color: 0x2a2a4a });
    c.addChild(displayBox);

    this.slotDisplay = new PIXI.Text({
      text: '¡TIRA DE LA PALANCA!',
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8,
        fill: 0x888888,
      }
    });
    this.slotDisplay.anchor.set(0.5, 0.5);
    this.slotDisplay.x = W / 2;
    this.slotDisplay.y = this.displayCenterY;
    c.addChild(this.slotDisplay);

    // LED strip bottom
    this.ledsBotY = H - 12;
    this.ledsBotGfx = this.buildLEDStrip(W, this.ledsBotY);
    c.addChild(this.ledsBotGfx);

    // Reel items
    this.buildReelItems(opts);
  }

  buildLEDStrip(W, y) {
    const ledColors = [0xe94560, 0x2ecc71, 0x3498db, 0xf5c518, 0x9b59b6];
    const gfx = new PIXI.Graphics();
    const size = 6;
    const spacing = 4;
    const count = 12;
    const totalW = count * (size + spacing) - spacing;
    const startX = (W - totalW) / 2;

    for (let i = 0; i < count; i++) {
      const lx = startX + i * (size + spacing);
      gfx.rect(lx, y, size, size).fill({ color: 0x1a1a2e });
      gfx.rect(lx, y, size, size).stroke({ width: 1, color: 0x3a3a5a, alpha: 0.5 });
    }

    return gfx;
  }

  flashLEDs(on) {
    if (this.ledState === on) return;
    this.ledState = on;

    const ledColors = [0xe94560, 0x2ecc71, 0x3498db, 0xf5c518, 0x9b59b6];
    const size = 6;
    const spacing = 4;
    const count = 12;
    const W = this.app.screen.width;
    const totalW = count * (size + spacing) - spacing;
    const startX = (W - totalW) / 2;

    [this.ledsTopGfx, this.ledsBotGfx].forEach(gfx => {
      if (!gfx) return;
      gfx.clear();

      for (let i = 0; i < count; i++) {
        const lx = startX + i * (size + spacing);
        const color = ledColors[i % ledColors.length];
        const y = gfx === this.ledsTopGfx ? this.ledsTopY : this.ledsBotY;

        if (on) {
          gfx.rect(lx, y, size, size).fill({ color });
        } else {
          gfx.rect(lx, y, size, size).fill({ color: 0x1a1a2e });
          gfx.rect(lx, y, size, size).stroke({ width: 1, color: 0x3a3a5a, alpha: 0.5 });
        }
      }
    });
  }

  drawLever(offset) {
    this.leverRod.clear();
    this.leverRod.rect(0, 0, 6, 14 + offset).fill({ color: 0x888888 });
    this.leverRod.rect(1, 0, 4, 14 + offset).fill({ color: 0xaaaaaa });
  }

  animateLeverDown(callback) {
    const targetY = this.leverBaseY + this.leverMaxOffset;
    const startY = this.leverBall.y;
    const duration = 400;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.leverBall.y = startY + (targetY - startY) * eased;
      this.drawLever(this.leverMaxOffset * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        callback?.();
      }
    };
    requestAnimationFrame(animate);
  }

  animateLeverUp() {
    const startY = this.leverBall.y;
    const targetY = this.leverBaseY - 16;
    const startRodOffset = this.leverMaxOffset;
    const targetRodOffset = 0;
    const duration = 500;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 0.5);

      this.leverBall.y = startY + (targetY - startY) * eased;
      this.drawLever(startRodOffset + (targetRodOffset - startRodOffset) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  buildReelItems(opts) {
    if (opts.length === 0) {
      this.reels.forEach(r => r.container.removeChildren());
      return;
    }

    this.reels.forEach((reel, ri) => {
      const rc = reel.container;
      rc.removeChildren();
      const repeats = 10;
      for (let r = 0; r < repeats; r++) {
        opts.forEach((opt, oi) => {
          const t = new PIXI.Text({
            text: opt,
            style: {
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 9,
              fill: 0xe0e0e0,
              wordWrap: true,
              wordWrapWidth: reel.reelWidth - 8,
            }
          });
          t.anchor.y = 0.5;
          t.x = 2;
          t.y = (r * opts.length + oi) * this.itemH + this.itemH / 2;
          rc.addChild(t);
        });
      }
    });
  }

  showIdle() {
    if (this.slotDisplay) {
      this.slotDisplay.text = '¡TIRA DE LA PALANCA!';
      this.slotDisplay.style.fill = 0x888888;
      this.slotDisplay.anchor.set(0.5, 0.5);
      this.slotDisplay.x = this.app.screen.width / 2;
      this.slotDisplay.y = this.displayCenterY;
    }
    this.reels.forEach(r => {
      r.container.y = this.reelBaseY;
    });
  }

  startSpin(winner) {
    const opts = window.__appState?.options || [];
    if (opts.length < 2) return;

    this.finalWinner = winner;
    this.isSpinning = true;
    this.completed = 0;
    this.startTime = performance.now();

    this.slotDisplay.text = '🎰 GIRANDO...';
    this.slotDisplay.style.fill = 0xe94560;
    this.slotDisplay.anchor.set(0.5, 0.5);
    this.slotDisplay.x = this.app.screen.width / 2;
    this.slotDisplay.y = this.displayCenterY;

    const winnerIdx = opts.indexOf(winner);

    this.animateLeverDown(() => {
      this.animateLeverUp();
      this.flashLEDs(true);

      this.reels.forEach((reel, i) => {
        const duration = this.reelDurations[i];
        const startY = this.reelBaseY;
        const cycle = Math.floor(Math.random() * 3) + 4;
        const centerStripIdx = cycle * opts.length + winnerIdx;
        const targetY = this.reelBaseY - (centerStripIdx - 1) * this.itemH;

        const animate = (now) => {
          if (!this.isSpinning) return;
          const elapsed = now - this.startTime;
          const localElapsed = Math.max(0, elapsed - (i * 120));

          if (localElapsed >= duration) {
            reel.container.y = targetY;
            this.completed++;

            if (this.completed === 3) {
              setTimeout(() => {
                this.slotDisplay.text = `★ ¡${winner}! ★`;
                this.slotDisplay.style.fill = 0xf5c518;
                this.slotDisplay.anchor.set(0.5, 0.5);
                this.slotDisplay.x = this.app.screen.width / 2;
                this.slotDisplay.y = this.displayCenterY;
                this.isSpinning = false;
                this.flashLEDs(false);
                window.__finishDecision?.(winner);
              }, 400);
            }
            return;
          }

          const progress = localElapsed / duration;
          const eased = 1 - Math.pow(1 - progress, 2.5);
          reel.container.y = startY + (targetY - startY) * eased;

          this.app.ticker.addOnce(() => {
            requestAnimationFrame(animate);
          });
        };

        requestAnimationFrame(animate);
      });
    });
  }

  show() { this.container.visible = true; }
  hide() {
    this.container.visible = false;
    this.isSpinning = false;
  }
}

window.SlotScene = SlotScene;
