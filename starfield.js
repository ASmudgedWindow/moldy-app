// starfield.js - dense layered starfield with twinkle and pointer parallax (no comets)
(() => {
  const canvas = document.querySelector('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let w = 0, h = 0, dpr = Math.max(1, window.devicePixelRatio || 1);

  // --- CONFIG: tune these values ---
  let BASE_DENSITY = 0.0015;        // stars per px^2 (increase for denser; 0.00075 is moderate)
  const PARALLAX_MULT = 30;         // parallax strength in pixels (higher = stronger mouse effect)
  const POINTER_SMOOTH = 0.18;      // 0..1 smoothing for pointer movement (higher = snappier)
  const MOBILE_DENSITY_SCALE = 0.5; // multiply BASE_DENSITY on narrow screens to save CPU
  // ------------------------------

  function resize() {
    w = Math.max(300, canvas.clientWidth);
    h = Math.max(200, canvas.clientHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars(); // rebuild on resize for balanced density
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Layers from far -> near
  const LAYER_CONFIG = [
    { depth: 0.35, size: 0.9,  twinkle: 0.9 }, // far (many small faint stars)
    { depth: 0.65, size: 2.1,  twinkle: 1.1 }, // mid
    { depth: 1.0,  size: 3.2,  twinkle: 1.8 }  // near (fewer, brighter)
  ];

  let stars = [];
  let last = performance.now();

  // normalized pointer / smoothing
  let targetPointer = { x: 0.5, y: 0.5 };
  let smoothPointer = { x: 0.5, y: 0.5 };

  function normPointer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height))
    };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = normPointer(e.clientX, e.clientY);
    targetPointer.x = p.x;
    targetPointer.y = p.y;
  }, { passive: true });

  canvas.addEventListener('pointerleave', () => {
    targetPointer.x = 0.5;
    targetPointer.y = 0.5;
  }, { passive: true });

  // compute star counts based on area and density
  function computeCounts() {
    let density = BASE_DENSITY;
    if (Math.min(window.innerWidth, window.innerHeight) < 720) density *= MOBILE_DENSITY_SCALE;
    const area = w * h;
    const total = Math.max(120, Math.floor(area * density));
    // distribute by layer weights (favor nearer layers less)
    const weights = [0.45, 0.35, 0.20]; // far, mid, near
    const counts = weights.map((wgt) => Math.floor(total * wgt));
    // ensure at least one per layer
    for (let i=0;i<counts.length;i++) if (counts[i] < 6) counts[i] = 6;
    return counts;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  class Star {
    constructor(layerIndex) {
      this.layer = layerIndex;
      this.reset(true);
    }
    reset(init) {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      const cfg = LAYER_CONFIG[this.layer];
      this.baseR = cfg.size * (0.7 + Math.random() * 0.9);
      this.r = this.baseR;
      this.baseAlpha = 0.28 + (cfg.depth * (0.5 + Math.random() * 0.45));
      // twinkle: random speed/phase, respect layer multiplier
      this.twinkleSpeed = (0.003 + Math.random() * 0.014) * cfg.twinkle;
      this.twinklePhase = Math.random() * Math.PI * 2;
      // soft drift
      this.vx = (Math.random() - 0.5) * 0.02 * cfg.depth;
      this.vy = (Math.random() - 0.5) * 0.02 * cfg.depth;
      if (init && Math.random() < 0.85) { this.vx *= 0.07; this.vy *= 0.07; }
    }
    update(dt) {
      this.twinklePhase += this.twinkleSpeed * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // wrap
      if (this.x < -50) this.x = w + 50;
      if (this.x > w + 50) this.x = -50;
      if (this.y < -50) this.y = h + 50;
      if (this.y > h + 50) this.y = -50;
    }
    draw(ctx, px, py) {
      const cfg = LAYER_CONFIG[this.layer];
      const parallaxX = (px - 0.5) * PARALLAX_MULT * cfg.depth;
      const parallaxY = (py - 0.5) * PARALLAX_MULT * cfg.depth;
      const sx = this.x - parallaxX;
      const sy = this.y - parallaxY;

      // twinkle multiplier 0.35..1.65
      const tw = Math.sin(this.twinklePhase) * 0.65 + 1.0;
      const r = Math.max(0.18, this.baseR * tw);
      const alpha = Math.max(0.05, Math.min(1, this.baseAlpha * (0.65 + (tw * 0.6))));

      // soft glow
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 6);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.22, `rgba(180,210,255,${alpha * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 6, r * 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // bright core
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha * 0.95)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.24, r * 0.56), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function buildStars() {
    stars.length = 0;
    if (w === 0 || h === 0) return;
    const counts = computeCounts();
    for (let li = 0; li < LAYER_CONFIG.length; li++) {
      const count = counts[li];
      for (let i = 0; i < count; i++) stars.push(new Star(li));
    }
  }

  function frame(now) {
    const dtRaw = Math.min(60, now - last);
    const dt = dtRaw / 16.666; // normalized
    last = now;

    // smooth pointer toward target
    smoothPointer.x += (targetPointer.x - smoothPointer.x) * Math.min(POINTER_SMOOTH, POINTER_SMOOTH * dt);
    smoothPointer.y += (targetPointer.y - smoothPointer.y) * Math.min(POINTER_SMOOTH, POINTER_SMOOTH * dt);

    // background
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#041428');
    bg.addColorStop(1, '#071331');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // update + draw
    for (let s of stars) {
      s.update(dt);
      s.draw(ctx, smoothPointer.x, smoothPointer.y);
    }

    requestAnimationFrame(frame);
  }

  // helper to rebuild with new settings at runtime
  window._moldy_resetStars = (opts = {}) => {
    if (typeof opts.density === 'number') BASE_DENSITY = opts.density;
    if (typeof opts.parallax === 'number') PARALLAX_MULT = opts.parallax;
    if (typeof opts.smooth === 'number') POINTER_SMOOTH = opts.smooth;
    buildStars();
  };

  // initialize
  buildStars();
  last = performance.now();
  requestAnimationFrame(frame);
})();
