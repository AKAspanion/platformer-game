/**
 * Short-lived visual feedback: pixel particles, floating score text and
 * hit-stop. (No screen shake.) Everything is in world pixels and ticks (30 per second).
 */
export default class Effects {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.particles = [];
    this.texts = [];
    this.freeze = 0;
  }

  /** Burst of square pixels from (x, y). */
  burst(
    x,
    y,
    {
      count = 8,
      colors = ["#fff"],
      speed = 2.5,
      life = 12,
      gravity = 0.25,
      size = 2,
      spreadY = 1,
      direction = 0,
    } = {},
  ) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const v = speed * (0.4 + this.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v + direction,
        vy: Math.sin(angle) * v * spreadY - speed * 0.4,
        gravity,
        life: life + Math.floor(this.random() * life * 0.5),
        maxLife: life * 1.5,
        size: size + (this.random() < 0.3 ? 1 : 0),
        color: colors[Math.floor(this.random() * colors.length)],
      });
    }
  }

  fireImpact(x, y, direction = 0) {
    this.burst(x, y, {
      count: 10,
      colors: ["#fff6a8", "#ffd23f", "#ff8c1a", "#ff4d1a"],
      speed: 2.4,
      life: 9,
      gravity: 0.12,
      direction: -direction * 0.6,
    });
  }

  enemyDeath(x, y, direction = 0) {
    this.burst(x, y, {
      count: 12,
      colors: ["#ffffff", "#ffe066", "#ff9f43", "#c8c8d8"],
      speed: 3,
      life: 12,
      gravity: 0.2,
      direction: direction * 0.8,
    });
  }

  coinSparkle(x, y) {
    this.burst(x, y, {
      count: 6,
      colors: ["#fff7c2", "#ffd84d", "#ffffff"],
      speed: 1.6,
      life: 8,
      gravity: 0,
      size: 1,
    });
  }

  dust(x, y, count = 4) {
    this.burst(x, y, {
      count,
      colors: ["#e8e2d0", "#cfc6ae"],
      speed: 1,
      life: 7,
      gravity: -0.02,
      spreadY: 0.2,
      size: 1,
    });
  }

  popup(text, x, y, color = "#fff") {
    this.texts.push({ text, x, y, color, life: 24, maxLife: 24 });
  }

  hitStop(ticks = 2) {
    this.freeze = Math.max(this.freeze, ticks);
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.92;
      p.life -= 1;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y -= t.life > 12 ? 0.8 : 0.3;
      t.life -= 1;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 6));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }

    ctx.font = "bold 8px Arial";
    ctx.textAlign = "center";
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      ctx.globalAlpha = Math.min(1, t.life / 8);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }
}
