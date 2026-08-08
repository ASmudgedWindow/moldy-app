// starfield.js - dense layered starfield with twinkle and pointer-based parallax (no comets)
(() => {
  const canvas = document.querySelector('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let w = 0, h = 0, dpr = Math.max(1, window.devicePixelRatio || 1);
  function resize() {
    w = Math.max(300, canvas.clientWidth);
    h = Math.max(200, canvas.clientHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // rebuild stars to match new size for balanced density
    buildStars();
  }
  window.addEventListener('resize', resize, { passive: true });

  // configuration
  const BASE_DENSITY = 0.00075; // stars per px^2 (increase for denser field)
  const LAYER_CONFIG = [
    { depth: 0.35, size: 0.6, twinkle: 0.8 }, // far
    { depth: 0.65, size: 1.1, twinkle: 1.0 }, // mid
    { depth: 1.0,  size: 2.2, twinkle: 1.6 }  // near
  ];

  let stars = [];
  const pointer = { x: 0.5, y: 0.5 }; // normalized (0..1)
  let lastPointer = { x: 0.5, y: 0.5 };

  function normPointer(px, py){
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (py - rect.top) / rect.height));
    return { x: nx, y: ny };
  }

  // lower density on small screens/devices automatically
  function computeCounts(){
    const area = w * h;
    const base = Math.max(80, Math.floor(area * BASE_DENSITY));
    // split across layers proportionally
    const counts = LAYER_CONFIG.map((l, i) => {
      const weight = (i+1) / LAYER_CONFIG.length;
      return Math.floor(base * weight);
    });
    return counts;
  }

  class Star {
    constructor(layerIndex){
      this.layer = layerIndex;
      this.reset(true);
    }
    reset(init){
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      const cfg = LAYER_CONFIG[this.layer];
      // size varies a bit
      this.baseR = cfg.size * (0.7 + Math.random()*0.9);
      this.r = this.baseR;
      // base alpha depends on depth (near = brighter)
      this.baseAlpha = 0.25 + (cfg.depth * (0.55 + Math.random()*0.35));
      // twinkle speed and amplitude
      this.twinkleSpeed = (0.002 + Math.random()*0.012) * cfg.twinkle;
      this.twinklePhase = Math.random() * Math.PI * 2;
      // subtle drift velocity per layer
      this.vx = (Math.random() - 0.5) * 0.02 * cfg.depth;
      this.vy = (Math.random() - 0.5) * 0.02 * cfg.depth;
      if (init && Math.random() < 0.85) { this.vx *= 0.1; this.vy *= 0.1; }
    }
    update(dt){
      this.twinklePhase += this.twinkleSpeed * dt;
      // gentle drift
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // wrap around
      if (this.x < -40) this.x = w + 40;
      if (this.x > w + 40) this.x = -40;
      if (this.y < -40) this.y = h + 40;
      if (this.y > h + 40) this.y = -40;
    }
    draw(ctx, px, py){
      // pointer parallax: near layers move more in opposite direction
      const cfg = LAYER_CONFIG[this.layer];
      const parallaxStrength = 18 * (cfg.depth); // pixels
      const ox = (px - 0.5) * parallaxStrength;
      const oy = (py - 0.5) * parallaxStrength;
      const sx = this.x - ox;
      const sy = this.y - oy;

      const tw = Math.sin(this.twinklePhase) * 0.45 + 0.55; // 0.1..1 roughly
      const r = Math.max(0.2, this.baseR * tw);
      const alpha = Math.max(0.06, Math.min(1, this.baseAlpha * (0.6 + (tw*0.6))));

      // soft glow radial gradient
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5.5);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.22, `rgba(170,200,255,${alpha * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 5.5, r * 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // bright core
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha * 0.95)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.25, r * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function buildStars(){
    stars.length = 0;
    if (w === 0 || h === 0) return;
    const counts = computeCounts();
    for (let li = 0; li < LAYER_CONFIG.length; li++){
      const count = counts[li];
      for (let i=0;i<count;i++) stars.push(new Star(li));
    }
  }

  // interaction smoothing for pointer
  let targetPointer = { x: 0.5, y: 0.5 };
  canvas.addEventListener('pointermove', (e)=>{
    const p = normPointer(e.clientX, e.clientY);
    targetPointer.x = p.x;
    targetPointer.y = p.y;
  }, { passive: true });

  // support touch center if no pointer movement
  canvas.addEventListener('pointerleave', ()=>{ targetPointer.x = 0.5; targetPointer.y = 0.5; }, { passive: true });

  let last = performance.now();
  function frame(t){
    const dtRaw = t - last;
    const dt = Math.min(60, dtRaw) / 16.666; // normalized delta
    last = t;

    // smooth pointer interpolation
    lastPointer.x += (targetPointer.x - lastPointer.x) * Math.min(0.2, 0.08 * dt);
    lastPointer.y += (targetPointer.y - lastPointer.y) * Math.min(0.2, 0.08 * dt);

    // draw background
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0, '#041428');
    bg.addColorStop(1, '#071331');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    // update & draw stars
    for (let s of stars){
      s.update(dt);
      s.draw(ctx, lastPointer.x, lastPointer.y);
    }

    requestAnimationFrame(frame);
  }

  // initialize
  resize();
  buildStars();
  last = performance.now();
  requestAnimationFrame(frame);

  // developer helper
  window._moldy_resetStars = () => { buildStars(); };
})();
