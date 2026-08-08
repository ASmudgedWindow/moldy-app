// high-quality starfield with layered stars, soft glow, and comet effects
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
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // star layers: furthest to nearest
  const LAYERS = [
    {count: Math.floor((w*h)/90000), speed: 0.05, size: 0.6, alpha: 0.45},
    {count: Math.floor((w*h)/48000), speed: 0.12, size: 1.0, alpha: 0.6},
    {count: Math.floor((w*h)/22000), speed: 0.3, size: 1.8, alpha: 0.9}
  ];

  let stars = [];
  const comets = [];
  const pointer = { x: w/2, y: h/2 };

  function rand(min, max){ return Math.random()*(max-min)+min; }

  class Star {
    constructor(layer){
      this.layer = layer;
      this.reset(true);
    }
    reset(init){
      this.x = Math.random()*w;
      this.y = Math.random()*h;
      this.r = (LAYERS[this.layer].size) * (0.6 + Math.random()*0.9);
      this.alpha = LAYERS[this.layer].alpha * (0.6 + Math.random()*0.8);
      this.twinkleSpeed = 0.003 + Math.random()*0.02;
      this.phase = Math.random()*Math.PI*2;
      this.vx = (Math.random()-0.5)*0.05*LAYERS[this.layer].speed;
      this.vy = (Math.random()-0.5)*0.05*LAYERS[this.layer].speed;
      if (init) { this.vx*=0.2; this.vy*=0.2; }
    }
    update(dt){
      this.phase += this.twinkleSpeed * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < -40) this.x = w + 40;
      if (this.x > w + 40) this.x = -40;
      if (this.y < -40) this.y = h + 40;
      if (this.y > h + 40) this.y = -40;
    }
    draw(ctx, px, py){
      const par = 1 + (this.layer*0.06);
      const dx = (this.x - px) * 0.015 * par;
      const dy = (this.y - py) * 0.015 * par;
      const sx = this.x - dx;
      const sy = this.y - dy;
      const r = Math.max(0.2, this.r + Math.sin(this.phase)*0.35);

      // soft glow
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r*6);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1,this.alpha)})`);
      g.addColorStop(0.25, `rgba(150,200,255,${this.alpha*0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r*6, r*6, 0, 0, Math.PI*2);
      ctx.fill();

      // core
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${0.9*this.alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r*0.9, 0, Math.PI*2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  class Comet {
    constructor(){
      this.reset();
    }
    reset(){
      const edge = Math.random() < 0.5 ? 'top' : 'left';
      if (edge === 'top'){
        this.x = Math.random()*w;
        this.y = -20;
        this.vx = rand(-0.6, 0.6);
        this.vy = rand(1.2, 2.6);
      } else {
        this.x = -20;
        this.y = Math.random()*h;
        this.vx = rand(1.2, 2.6);
        this.vy = rand(-0.4, 0.4);
      }
      this.speed = Math.hypot(this.vx, this.vy);
      this.length = rand(140, 420);
      this.trail = [];
      this.life = 0;
      this.maxLife = rand(240, 420);
      this.size = rand(1.6, 2.8);
      this.color = `rgba(200,230,255,`;
    }
    update(dt){
      this.life += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // record trail
      this.trail.unshift({x:this.x, y:this.y});
      if (this.trail.length > 60) this.trail.pop();
      // kill if off-screen or over life
      if (this.x < -this.length || this.x > w+this.length || this.y < -this.length || this.y > h+this.length || this.life > this.maxLife){
        this.reset();
      }
    }
    draw(ctx){
      // draw long soft trail
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i=0; i<this.trail.length; i+=2){
        const p = this.trail[i];
        if (!p) continue;
        const t = i/this.trail.length;
        const radius = (1-t)*this.size*5;
        const alpha = (1-t)*0.4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius*3);
        g.addColorStop(0, `rgba(220,240,255,${alpha})`);
        g.addColorStop(0.2, `rgba(180,210,255,${alpha*0.6})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius*3, radius*1.1, Math.PI/6, 0, Math.PI*2);
        ctx.fill();
      }

      // bright head
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,0.95)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size*2.2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  function init(){
    stars = [];
    for (let li=0; li<LAYERS.length; li++){
      const layer = LAYERS[li];
      for (let i=0;i<layer.count;i++) stars.push(new Star(li));
    }
    comets.length = 0;
    // start with 1 comet occasionally
    if (Math.random() < 0.5) comets.push(new Comet());
  }

  let last = performance.now();
  function frame(t){
    const dt = Math.min(60, t - last) / 16.666;
    last = t;

    // draw subtle backdrop each frame (keeps crisp color)
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,'#041428');
    bg.addColorStop(1,'#071331');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    // occasional comet spawn
    if (Math.random() < 0.006) comets.push(new Comet());

    // update and draw stars
    for (let s of stars){
      s.update(dt);
      s.draw(ctx, pointer.x, pointer.y);
    }

    // update and draw comets
    for (let c of comets){
      c.update(dt);
      c.draw(ctx);
    }

    // limit comets
    if (comets.length > 6) comets.splice(0, comets.length-6);

    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointermove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left);
    pointer.y = (e.clientY - rect.top);
  }, {passive:true});

  // init and start
  resize();
  init();
  last = performance.now();
  requestAnimationFrame(frame);

  // expose toggle for dev/test
  window._moldy_resetStars = () => init();
})();
