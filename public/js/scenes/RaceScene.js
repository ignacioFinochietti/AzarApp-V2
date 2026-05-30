class RaceScene {
  constructor(app) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    app.stage.addChild(this.container);

    this.horses = [];
    this.raceStartTime = 0;
    this.raceDuration = 10000;
    this.finishedCount = 0;
    this.serverWinner = null;
    this.isRunning = false;
  }

  build(opts) {
    const c = this.container;
    c.removeChildren();
    this.horses = [];
    this.isRunning = false;

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, W, H).fill({ color: 0x0f0f1a });
    c.addChild(bg);

    const numHorses = opts.length;
    if (numHorses === 0) {
      const t = new PIXI.Text({
        text: 'AÑADE OPCIONES',
        style: { fontFamily: '"Press Start 2P", monospace', fontSize: 8, fill: 0x555555 }
      });
      t.anchor.set(0.5);
      t.x = W / 2;
      t.y = H / 2;
      c.addChild(t);
      return;
    }

    const laneH = Math.max(32, Math.floor((H - 20) / numHorses));
    const startX = 50;
    const finishX = W - 40;
    const trackLen = finishX - startX;

    // Lanes
    for (let i = 0; i < numHorses; i++) {
      const y = 8 + i * laneH;
      const lane = new PIXI.Graphics();
      lane.rect(startX - 8, y, trackLen + 16, laneH)
        .fill({ color: i % 2 === 0 ? 0x15152a : 0x121222 });
      c.addChild(lane);
    }

    // Finish checkerboard
    const finishGfx = new PIXI.Graphics();
    const cs = 6;
    for (let row = 0; row < Math.ceil(H / cs); row++) {
      for (let col = 0; col < 2; col++) {
        const cx = finishX + col * cs;
        const cy = row * cs;
        finishGfx.rect(cx, cy, cs, cs)
          .fill({ color: (row + col) % 2 === 0 ? 0xffffff : 0x000000 });
      }
    }
    c.addChild(finishGfx);

    // META label
    const metaLabel = new PIXI.Text({
      text: 'META',
      style: { fontFamily: '"Press Start 2P", monospace', fontSize: 6, fill: 0xf5c518 }
    });
    metaLabel.anchor.set(0.5, 0);
    metaLabel.x = finishX + cs;
    metaLabel.y = 0;
    c.addChild(metaLabel);

    // Start line
    const startLine = new PIXI.Graphics();
    startLine.rect(startX - 2, 0, 2, numHorses * laneH + 8)
      .fill({ color: 0xffffff });
    c.addChild(startLine);

    // Track border
    const trackBorder = new PIXI.Graphics();
    trackBorder.rect(startX - 8, 4, trackLen + 16, numHorses * laneH)
      .stroke({ width: 2, color: 0x2a2a4a });
    c.addChild(trackBorder);

    // Horses
    const horseColors = [0xe94560, 0x2ecc71, 0x3498db, 0xf5c518, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

    opts.forEach((name, i) => {
      const y = 8 + i * laneH + 4;

      const horseContainer = new PIXI.Container();
      horseContainer.x = startX;
      horseContainer.y = y;
      c.addChild(horseContainer);

      const gfx = new PIXI.Graphics();
      horseContainer.addChild(gfx);

      const label = new PIXI.Text({
        text: name,
        style: {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 6,
          fill: 0xcccccc,
        }
      });
      label.x = 34;
      label.y = 6;
      horseContainer.addChild(label);

      const horse = {
        container: horseContainer,
        gfx,
        label,
        color: horseColors[i % horseColors.length],
        x: 0,
        name,
        finished: false,
        place: null,
        baseSpeed: 0.18 + Math.random() * 0.28,
        burstProb: 0.06 + Math.random() * 0.12,
        burstPower: 0.04 + Math.random() * 0.06,
        stamina: 0.7 + Math.random() * 0.6,
        legPhase: 0,
      };

      this.horses.push(horse);
      this.drawHorse(gfx, 28, laneH - 8, horse.color, 0);
    });

    this.trackLen = trackLen;
    this.startX = startX;
    this.finishX = finishX;
    this.laneH = laneH;
  }

  drawHorse(gfx, cw, ch, color, legPhase) {
    gfx.clear();
    const s = Math.min(cw / 16, ch / 10);
    const px = Math.max(1, Math.floor(s));
    const frame = Math.floor(legPhase) % 6;
    const bodyBob = frame < 3 ? -1 : 0;

    // Body
    gfx.rect(px * 3, px * 2 + bodyBob, px * 7, px * 4).fill({ color });
    // Head
    gfx.rect(px * 4, px * 1 + bodyBob, px * 5, px * 1).fill({ color });
    gfx.rect(px * 8, px * 1 + bodyBob, px * 3, px * 2).fill({ color });

    const darker = this.darken(color, 0.6);
    // Head detail
    gfx.rect(px * 9, px * 1 + bodyBob, px * 2, px * 1).fill({ color: darker });
    // Body shading
    gfx.rect(px * 3, px * 4 + bodyBob, px * 7, px * 2).fill({ color: darker });
    // Ear
    gfx.rect(px * 8, px * 0 + bodyBob, px * 2, px * 1).fill({ color });
    // Tail
    const tailX = frame % 2 === 0 ? 0 : 1;
    gfx.rect(px * tailX, px * 2 + bodyBob, px * 3, px * 2).fill({ color });
    gfx.rect(px * tailX, px * 1 + bodyBob, px * 2, px * 1).fill({ color });

    // Legs
    const legPoses = [
      { back: 0, front: 0 },
      { back: -1, front: 1 },
      { back: 0, front: 0 },
      { back: 1, front: -1 },
      { back: 0, front: 0 },
      { back: -1, front: 1 },
    ];
    const lp = legPoses[frame];
    gfx.rect(px * (4 + lp.back), px * 6 + bodyBob, px * 2, px * 3).fill({ color });
    gfx.rect(px * (7 + lp.front), px * 6 + bodyBob, px * 2, px * 3).fill({ color });

    // Eye
    gfx.rect(px * 10, px * 1 + bodyBob, px * 1, px * 1).fill({ color: 0x000000 });
  }

  darken(color, factor) {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  startRace(serverWinner) {
    if (this.horses.length === 0) return;

    this.serverWinner = serverWinner;
    this.raceStartTime = performance.now();
    this.finishedCount = 0;
    this.isRunning = true;

    this.horses.forEach(h => {
      h.x = 0;
      h.finished = false;
      h.place = null;
      h.legPhase = 0;
      h.isWinner = h.name === serverWinner;

      h.baseSpeed = 0.18 + Math.random() * 0.04;
      h.burstProb = 0.06 + Math.random() * 0.06;
      h.burstPower = 0.03 + Math.random() * 0.03;
      h.stamina = 0.70 + Math.random() * 0.20;

      if (h.isWinner) {
        h.baseSpeed = 0.30 + Math.random() * 0.04;
        h.burstProb += 0.05;
        h.burstPower *= 1.5;
      }
    });

    const animate = (now) => {
      if (!this.isRunning) return;

      const elapsed = now - this.raceStartTime;
      const progress = Math.min(elapsed / this.raceDuration, 1);

      const active = this.horses.filter(h => !h.finished);
      const avgX = active.length > 0
        ? active.reduce((s, h) => s + h.x, 0) / active.length
        : 1;

      for (const horse of active) {
        let speed = horse.baseSpeed * (0.006 + progress * 0.010);
        if (Math.random() < horse.burstProb) speed += horse.burstPower * 0.08;
        speed *= (0.75 + Math.random() * 0.40);
        speed *= (0.5 + horse.stamina * 0.5);

        if (horse.x > 0.85) {
          speed *= 0.9 + (1 - horse.x) * 0.3;
        }

        // Pack cohesion: keep the field bunched
        if (active.length > 1) {
          if (horse.x < avgX - 0.04) {
            speed *= 1.0 + (avgX - horse.x) * 1.5;
          }
          if (horse.x > avgX + 0.08) {
            speed *= 1.0 - (horse.x - avgX) * 0.5;
          }
          // Winner catch-up: strong pull if behind leader
          if (horse.isWinner) {
            const leaderX = Math.max(...active.map(h => h.x));
            if (horse.x < leaderX - 0.05) {
              speed *= 1.0 + (leaderX - horse.x) * 0.8;
            }
          }
        }

        // Winner final surge in the last 10%
        if (horse.isWinner && horse.x > 0.90) {
          speed *= 1.0 + (horse.x - 0.90) * 1.0;
          speed += 0.002;
        }

        horse.x += speed;
        horse.x = Math.min(horse.x, 1.05);
        horse.legPhase = (horse.legPhase || 0) + speed * 3;
      }

      const finishers = this.horses.filter(h => !h.finished && h.x >= 1.0);
      finishers.sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1;
        if (!a.isWinner && b.isWinner) return 1;
        return b.x - a.x;
      });

      let winnerFinished = this.horses.find(h => h.isWinner && h.finished);
      for (const horse of finishers) {
        if (horse.isWinner) winnerFinished = true;
        if (!winnerFinished && !horse.isWinner) {
          horse.x = 0.998;
          continue;
        }
        horse.finished = true;
        this.finishedCount++;
        horse.place = this.finishedCount;
      }

      this.renderFrame();

      const allFinished = this.horses.every(h => h.finished);
      const timeUp = elapsed >= this.raceDuration;

      if (timeUp && !winnerFinished) {
        const wh = this.horses.find(h => h.isWinner);
        if (wh) {
          wh.x = 1.05;
          wh.finished = true;
          this.finishedCount++;
          wh.place = this.finishedCount;
          this.horses.filter(h => !h.isWinner && !h.finished).forEach((h, i) => {
            h.finished = true;
            h.place = this.finishedCount + 1 + i;
          });
        }
      }

      if (allFinished || timeUp) {
        this.renderFrame();
        this.showWinnerBanner();
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  renderFrame() {
    this.horses.forEach((horse) => {
      const x = this.startX + horse.x * this.trackLen;
      horse.container.x = x;

      this.drawHorse(horse.gfx, 28, this.laneH - 8, horse.color, horse.legPhase);

      if (horse.place !== null) {
        horse.label.text = `#${horse.place} ${horse.name}`;
        horse.label.style.fill = 0xf5c518;
      }
    });
  }

  showWinnerBanner() {
    this.isRunning = false;
    const winner = this.serverWinner || 'DESCONOCIDO';
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const bannerBg = new PIXI.Graphics();
    bannerBg.rect(W / 2 - 140, H - 55, 280, 40).fill({ color: 0x000000, alpha: 0.9 });
    bannerBg.rect(W / 2 - 140, H - 55, 280, 40).stroke({ width: 2, color: 0xf5c518 });
    this.container.addChild(bannerBg);

    const text = new PIXI.Text({
      text: `★ ¡${winner}! ★`,
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 14,
        fill: 0xf5c518,
      }
    });
    text.anchor.set(0.5, 0.5);
    text.x = W / 2;
    text.y = H - 35;
    this.container.addChild(text);

    window.__finishDecision?.(winner);
  }

  show() { this.container.visible = true; }
  hide() {
    this.container.visible = false;
    this.isRunning = false;
  }
}

window.RaceScene = RaceScene;
