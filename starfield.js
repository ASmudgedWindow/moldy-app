// Lightweight parallax starfield
(() => {
  const canvas = document.getElementById('starfield');
  if(!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let w = canvas.width = innerWidth;
  let h = canvas.height = innerHeight;
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(DPR, DPR);

  // star layers: near, mid, far
  const LAYERS = [
    { count: 80, speed: 0.3, size: [1.2, 2.6], alpha: 0.95 },
    { count: 140, speed: 0.18, size: [0.8, 1.6], alpha: 0.7 },
    { count: 260, speed: 0.08, size: [0.4, 1.0], alpha: 0.45 }
  ];

  let stars = [];
  function rand(min, max){ return Math.random()*(max-min)+min; }

  function makeStars(){
    stars = [];
    for(let li=0; li<LAYERS.length; li++){
      const layer = LAYERS[li];
      for(let i=0;i<layer.count;i++){
        stars.push({
          x: Math.random()*w,
          y: Math.random()*h,
          z: li, // layer index
          size: rand(layer.size[0], layer.size[1]),
          baseAlpha: layer.alpha * (0.7 + Math.random()*0.6),
          flicker: Math.random()*0.8,
          phase: Math.random()*Math.PI*2
        });
      }
    }
  }

  let mouse = { x: w/2, y: h/2, tx: 0, ty:0 };
  function onMove(e){
    const ex = e.touches ? e.touches[0].clientX : e.clientX;
    const ey = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.x = ex; mouse.y = ey;
    // target offsets normalized to -0.5 .. 0.5
    mouse.tx = (mouse.x / w - 0.5);
    mouse.ty = (mouse.y / h - 0.5);
  }
  addEventListener('mousemove', onMove, { passive:true });
  addEventListener('touchmove', onMove, { passive:true });

  // subtle shooting star emitter
  let shooting = null;
  function maybeShoot(){
    if(Math.random() < 0.01 && !shooting){
      shooting = {
        x: Math.random()*w*0.8 + w*0.1,
        y: Math.random()*h*0.5 + h*0.05,
        vx: (Math.random()*-1.6 - 1.2) * (0.6 + Math.random()),
        vy: (Math.random()*0.6 + 0.2),
        life: 0,
        maxLife: 120 + Math.random()*80
      };
    }
    if(shooting){
      shooting.life++;
      if(shooting.life > shooting.maxLife) shooting = null;
    }
  }

  let last = performance.now();
  let t = 0;
  function frame(now){
    const dt = Math.min(40, now - last);
    last = now;
    t += dt/1000;
    // ease toward mouse target so motion is smooth
    const ease = 0.06;
    // store global offsets derived from mouse; multiply by factor for strength
    const targetOffsetX = mouse.tx * 40;
    const targetOffsetY = mouse.ty * 24;
    // current offsets stored in closure
    offsetX += (targetOffsetX - offsetX) * ease;
    offsetY += (targetOffsetY - offsetY) * ease;

    ctx.clearRect(0,0,w,h);

    // subtle nebula/planet glow at bottom-right
    const grad = ctx.createRadialGradient(w*0.85, h*0.85, 40, w*0.85, h*0.85, Math.max(w,h)*0.9);
    grad.addColorStop(0, 'rgba(12,18,36,0.55)');
    grad.addColorStop(0.25, 'rgba(6,12,28,0.28)');
    grad.addColorStop(1, 'rgba(2,6,12,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    // draw stars per-layer
    for(let s of stars){
      const layer = LAYERS[s.z];
      // parallax factor: closer layers move more
      const depth = (LAYERS.length - s.z) / LAYERS.length;
      const px = (s.x + offsetX * (0.6 + depth*1.4) + Math.sin((t*0.6)+s.phase)*s.flicker*0.8) % w;
      const py = (s.y + offsetY * (0.3 + depth*0.6)) % h;

      const alpha = s.baseAlpha * (0.8 + 0.2*Math.sin(t*2 + s.phase));
      ctx.beginPath();
      const size = s.size * (0.6 + depth*1.2);
      // soft circular star
      const starGrad = ctx.createRadialGradient(px, py, 0, px, py, Math.max(6, size*6));
      starGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      starGrad.addColorStop(0.25, `rgba(139,231,255,${alpha*0.8})`);
      starGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = starGrad;
      ctx.fillRect(px - size*3, py - size*3, size*6, size*6);
      ctx.closePath();
    }

    // shooting star
    maybeShoot();
    if(shooting){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sx = shooting.x + shooting.vx * shooting.life;
      const sy = shooting.y + shooting.vy * shooting.life;
      const progress = shooting.life / shooting.maxLife;
      const tailLen = 120 * (1 - progress) + 20;
      const tailGrad = ctx.createLinearGradient(sx, sy, sx - shooting.vx*tailLen, sy - shooting.vy*tailLen);
      tailGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
      tailGrad.addColorStop(1, 'rgba(139,231,255,0.03)');
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - shooting.vx*tailLen, sy - shooting.vy*tailLen);
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

  // track offsets for smooth motion
  let offsetX = 0, offsetY = 0;

  // responsive handling
  function onResize(){
    w = innerWidth; h = innerHeight;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    makeStars();
  }
  addEventListener('resize', onResize, { passive:true });

  // initial setup
  makeStars();
  // center mouse initially
  mouse.x = w/2; mouse.y = h/2;
  mouse.tx = 0; mouse.ty = 0;
  requestAnimationFrame(frame);

  // expose a small API to repaint if needed
  window.__moldy = {
    regenerate: makeStars,
    resize: onResize
  };
})();
