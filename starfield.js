/* Moldy.App — shared starfield engine
   Include after the DOM; expects a <canvas id="stars"> and
   a page title element with [data-glow-title] to pulse on comet pass. */

(function () {
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  let stars = [];
  let comets = [];
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  const titleEl = document.querySelector('[data-glow-title]');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  function initStars() {
    const count = Math.floor((w * h) / 3200);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2, // depth/parallax factor
        r: Math.random() * 1.3 + 0.25,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.003,
        twinklePhase: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.12 ? (Math.random() < 0.5 ? 190 : 265) : 0
      });
    }
  }

  function spawnComet() {
    const fromLeft = Math.random() < 0.5;
    const y0 = Math.random() * h * 0.6;
    const speed = Math.random() * 4 + 5;
    comets.push({
      x: fromLeft ? -80 : w + 80,
      y: y0,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: speed * 0.28 * (Math.random() < 0.5 ? 1 : -1),
      life: 0,
      maxLife: 140,
      triggeredGlow: false
    });
  }

  let sinceLastComet = 0;
  const nextCometGap = () => 400 + Math.random() * 500; // frames
  let cometGap = nextCometGap();

  function triggerTitleGlow() {
    if (!titleEl) return;
    titleEl.classList.remove('comet-glow');
    // force reflow to allow re-trigger
    void titleEl.offsetWidth;
    titleEl.classList.add('comet-glow');
    setTimeout(() => titleEl.classList.remove('comet-glow'), 3400);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // gentle parallax toward mouse
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    // stars
    for (const s of stars) {
      s.twinklePhase += s.twinkleSpeed;
      const alpha = s.baseAlpha * (0.65 + 0.35 * Math.sin(s.twinklePhase));
      const px = s.x + mouseX * s.z * 18;
      const py = s.y + mouseY * s.z * 18;
      ctx.beginPath();
      if (s.hue) {
        ctx.fillStyle = `hsla(${s.hue}, 90%, 78%, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      }
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // comet spawning
    sinceLastComet++;
    if (sinceLastComet > cometGap) {
      spawnComet();
      sinceLastComet = 0;
      cometGap = nextCometGap();
    }

    // comets
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.x += c.vx;
      c.y += c.vy;
      c.life++;

      // trigger glow when comet crosses near horizontal center band
      if (!c.triggeredGlow && c.x > w * 0.25 && c.x < w * 0.75) {
        triggerTitleGlow();
        c.triggeredGlow = true;
      }

      const tailLen = 90;
      const angle = Math.atan2(c.vy, c.vx);
      const tx = c.x - Math.cos(angle) * tailLen;
      const ty = c.y - Math.sin(angle) * tailLen;

      const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
      grad.addColorStop(0, 'rgba(210, 230, 255, 0.95)');
      grad.addColorStop(0.4, 'rgba(150, 190, 255, 0.35)');
      grad.addColorStop(1, 'rgba(150, 190, 255, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(180,210,255,0.9)';
      ctx.shadowBlur = 12;
      ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (c.life > c.maxLife || c.x < -150 || c.x > w + 150) {
        comets.splice(i, 1);
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / w - 0.5) * -2;
    targetY = (e.clientY / h - 0.5) * -2;
  });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches || !e.touches[0]) return;
    const t = e.touches[0];
    targetX = (t.clientX / w - 0.5) * -2;
    targetY = (t.clientY / h - 0.5) * -2;
  }, { passive: true });

  resize();
  draw();
})();
