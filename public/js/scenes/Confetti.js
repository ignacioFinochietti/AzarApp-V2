class ConfettiEffect {
  constructor(app) {
    this.app = app;
    this.container = new PIXI.Container();
    this.container.visible = false;
    app.stage.addChild(this.container);
    this.particles = [];
    this.colors = [0xe94560, 0x2ecc71, 0x3498db, 0xf5c518, 0x9b59b6, 0x1abc9c, 0xe67e22];
  }

  spawn(count = 50) {
    this.container.removeChildren();
    this.particles = [];
    this.container.visible = true;

    const W = this.app.screen.width;

    for (let i = 0; i < count; i++) {
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const size = 4 + Math.random() * 6;
      const gfx = new PIXI.Graphics();
      gfx.rect(0, 0, size, size).fill({ color });
      gfx.x = Math.random() * W;
      gfx.y = -10 - Math.random() * 50;
      gfx.rotation = Math.random() * Math.PI * 2;
      this.container.addChild(gfx);

      this.particles.push({
        gfx,
        vy: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        life: 1,
        decay: 0.005 + Math.random() * 0.005,
      });
    }

    this.animate();
  }

  animate() {
    if (this.particles.length === 0) return;

    let allDead = true;

    for (const p of this.particles) {
      if (p.life <= 0) continue;
      allDead = false;

      p.gfx.y += p.vy;
      p.gfx.x += p.vx;
      p.gfx.rotation += p.rotSpeed;
      p.life -= p.decay;
      p.gfx.alpha = Math.max(0, p.life);
    }

    if (!allDead) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.container.visible = false;
      this.container.removeChildren();
      this.particles = [];
    }
  }
}

window.ConfettiEffect = ConfettiEffect;
