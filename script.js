// scripts.js
// TCP Air Hockey - Canvas prototype (single puck, two mallets, improved drawing & fallback)

// If you provided a sprite image, place it in the same folder and set SPRITE_SRC accordingly.
// In the original environment the sprite path was: /mnt/data/831b0121-6307-49e8-869b-c0affb9edb48.png
const SPRITE_SRC = './831b0121-6307-49e8-869b-c0affb9edb48.png'; // change if needed

// Canvas setup
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
// Ensure we use the canvas internal resolution matching attributes (avoid CSS scaling issues)
const CSS_W = 720, CSS_H = 880;
canvas.width = CSS_W;
canvas.height = CSS_H;

const W = canvas.width, H = canvas.height;

const hitBtn = document.getElementById('tacar');
const stateEl = document.getElementById('state');
const logEl = document.getElementById('log');
const lossSel = document.getElementById('lossSel');
const windowText = document.getElementById('windowText');

function log(txt){
  const t = new Date().toLocaleTimeString();
  logEl.innerHTML = `<div>[${t}] ${txt}</div>` + logEl.innerHTML;
}

// Simulation state
let connectionState = 'DISCONNECTED';
let lossRate = parseFloat(lossSel.value);
lossSel.onchange = () => { lossRate = parseFloat(lossSel.value); log(`Taxa de perda: ${lossRate*100}%`); };

let cwnd = 1, ssthresh = 8, inflight = 0;
function updateWindowDisplay(){ windowText.textContent = `cwnd: ${cwnd} | ssthresh: ${ssthresh} | inflight: ${inflight}`; }
updateWindowDisplay();

// Physics
const FPS = 60;
const DT = 1 / FPS;
const FRICTION = 0.996;

// Puck (single)
const puck = { x: W/2, y: H/2, r: 36, mass: 1, vx: 0, vy: 0 };

// Mallets (rebatedores)
const malletClient = { x: W/2, y: H - 110, r: 58, mass: 3, type: 'client' };
const malletServer = { x: W/2, y: 110, r: 58, mass: 3, type: 'server' };

// sprite handling
let sprite = new Image();
let spriteLoaded = false;
sprite.onload = () => { spriteLoaded = true; log('Sprite carregada.'); };
sprite.onerror = () => { spriteLoaded = false; log('Sprite não carregou — usando fallback gráfico.'); };
sprite.src = SPRITE_SRC;

// basic WebAudio for collision sounds
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
function beep(freq, duration=0.06, vol=0.04){
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + duration);
}

// utilities
function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

// collision resolution between two circles using impulse
function resolveCollision(a,b){
  const dx = b.x - a.x, dy = b.y - a.y;
  const distAB = Math.hypot(dx,dy) || 0.0001;
  const nx = dx / distAB, ny = dy / distAB;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const velAlongNormal = rvx*nx + rvy*ny;
  if(velAlongNormal > 0) return;
  const e = 0.9; // restitution
  const j = -(1 + e) * velAlongNormal / (1/a.mass + 1/b.mass);
  const ix = j * nx, iy = j * ny;
  a.vx -= ix / a.mass; a.vy -= iy / a.mass;
  b.vx += ix / b.mass; b.vy += iy / b.mass;
}

// server automatic behavior: if puck near server mallet, server rebatedor pushes back
function serverBehavior(){
  const d = dist(puck, malletServer);
  if(d < malletServer.r + puck.r + 6){
    // compute angle from server to puck and push away
    const angle = Math.atan2(puck.y - malletServer.y, puck.x - malletServer.x);
    const speed = 10 + Math.random()*4;
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
    // handshake-specific logging
    if(connectionState === 'HANDSHAKE_WAIT_SYNACK'){
      log('Servidor: recebeu SYN → rebateu com SYN/ACK.');
      connectionState = 'HANDSHAKE_SYNACK_SENT';
      stateEl.textContent = 'Estado: SYN-ACK enviado';
    }
    beep(880, 0.06, 0.04);
  }
}

// client manual hit
function clientHit(){
  // ensure AudioContext resumed
  if(audioCtx.state === 'suspended') audioCtx.resume();

  // If initial disconnected, client tacada sends SYN
  if(connectionState === 'DISCONNECTED'){
    connectionState = 'HANDSHAKE_SYN_SENT';
    stateEl.textContent = 'Estado: SYN enviado';
    log('Cliente: enviou SYN (tacada).');
    // apply upward impulse if puck close enough, otherwise nudge it into play
    const d = dist(puck, malletClient);
    if(d < malletClient.r + puck.r + 50){
      // angle from mallet to puck and push away (upwards)
      const angle = Math.atan2(puck.y - malletClient.y, puck.x - malletClient.x);
      const speed = 11 + Math.random()*3;
      puck.vx = Math.cos(angle) * speed;
      puck.vy = Math.sin(angle) * speed;
    } else {
      // if puck far away, teleport near mallet and hit
      puck.x = malletClient.x + (Math.random()-0.5)*20;
      puck.y = malletClient.y - malletClient.r - puck.r - 4;
      puck.vx = (Math.random()-0.5)*1;
      puck.vy = -14;
    }
    beep(620, 0.06, 0.04);
    return;
  }

  // During handshake when client should send final ACK:
  if(connectionState === 'HANDSHAKE_WAIT_CLIENT_ACK' || connectionState === 'HANDSHAKE_SYNACK_SENT'){
    connectionState = 'HANDSHAKE_FINAL_ACK';
    stateEl.textContent = 'Estado: ACK enviado';
    log('Cliente: enviou ACK final (tacada).');
    // hit
    const angle = Math.atan2(puck.y - malletClient.y, puck.x - malletClient.x);
    const speed = 11 + Math.random()*3;
    puck.vx = Math.cos(angle) * speed; puck.vy = Math.sin(angle) * speed;
    beep(700, 0.06, 0.04);
    // finalize handshake after a short delay if puck returns
    setTimeout(()=>{ 
      // only finalize when puck comes back near client zone — a small relax: if not yet, finalize anyway
      connectionState = 'ESTABLISHED'; stateEl.textContent = 'Estado: ESTABLISHED';
      log('Conexão ESTABELECIDA!');
      hitBtn.textContent = 'TACAR (jogar)';
    }, 900);
    return;
  }

  // Normal game hit (when established)
  if(connectionState === 'ESTABLISHED'){
    const d = dist(puck, malletClient);
    if(d < malletClient.r + puck.r + 6){
      const angle = Math.atan2(puck.y - malletClient.y, puck.x - malletClient.x);
      const speed = 10 + Math.random()*4;
      puck.vx = Math.cos(angle) * speed; puck.vy = Math.sin(angle) * speed;
      log('Cliente: tacada (pacote enviado).');
      // simulate window/inflight
      if(inflight < Math.floor(cwnd)){ inflight++; updateWindowDisplay(); }
      beep(720, 0.06, 0.04);
    } else {
      log('Cliente tentou tacar mas o disco está fora de alcance.');
    }
  }
}

// physics step
function physicsStep(){
  // integrate
  puck.x += puck.vx * DT * 60;
  puck.y += puck.vy * DT * 60;
  // friction
  puck.vx *= FRICTION; puck.vy *= FRICTION;

  // bounds (keep inside)
  const pad = 12;
  if(puck.x - puck.r < pad){ puck.x = pad + puck.r; puck.vx *= -0.8; }
  if(puck.x + puck.r > W - pad){ puck.x = W - pad - puck.r; puck.vx *= -0.8; }
  if(puck.y - puck.r < pad){ puck.y = pad + puck.r; puck.vy *= -0.8; }
  if(puck.y + puck.r > H - pad){ puck.y = H - pad - puck.r; puck.vy *= -0.8; }

  // mallet/puck collisions
  const dC = dist(puck, malletClient);
  if(dC < puck.r + malletClient.r){
    const overlap = puck.r + malletClient.r - dC;
    const nx = (puck.x - malletClient.x)/dC, ny = (puck.y - malletClient.y)/dC;
    puck.x += nx * overlap; puck.y += ny * overlap;
    resolveCollision(malletClient, puck);
    beep(700, 0.04, 0.05);
  }

  const dS = dist(puck, malletServer);
  if(dS < puck.r + malletServer.r){
    const overlap = puck.r + malletServer.r - dS;
    const nx = (puck.x - malletServer.x)/dS, ny = (puck.y - malletServer.y)/dS;
    puck.x += nx * overlap; puck.y += ny * overlap;
    resolveCollision(malletServer, puck);
    beep(880, 0.04, 0.05);
    // server behavior: auto hit when close enough
    serverBehavior();
  }
}

// mallets update (server follows puck.x a bit)
function updateMallets(){
  malletClient.x += (W/2 - malletClient.x) * 0.08; // client centered by default
  malletServer.x += (puck.x - malletServer.x) * 0.12;
}

// rendering (draw fallback shapes always; overlay sprites when loaded)
function render(){
  // white dotted surface
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);
  // dots
  const dotGap = 24;
  ctx.fillStyle = '#111';
  for(let yy=12; yy<H; yy+=dotGap){
    for(let xx=12; xx<W; xx+=dotGap){
      ctx.beginPath(); ctx.arc(xx, yy, 1.2, 0, Math.PI*2); ctx.fill();
    }
  }
  // midline
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([12,8]);
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke(); ctx.setLineDash([]);

  // fallback mallets (large black discs)
  ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(malletServer.x, malletServer.y, malletServer.r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(malletClient.x, malletClient.y, malletClient.r, 0, Math.PI*2); ctx.fill();

  // overlay sprite if loaded
  if(spriteLoaded){
    try {
      // attempt to draw left half for mallets (if sprite width enough)
      const sw = sprite.width, sh = sprite.height;
      const sx = 0, sy = 0, swPart = Math.floor(sw/2);
      // server mallet image (top)
      const mw = malletServer.r*2, mh = malletServer.r*2;
      ctx.drawImage(sprite, sx, sy, swPart, sh, malletServer.x - mw/2, malletServer.y - mh/2, mw, mh);
      // client mallet image (bottom) - draw same part
      const mwc = malletClient.r*2, mhc = malletClient.r*2;
      ctx.drawImage(sprite, sx, sy, swPart, sh, malletClient.x - mwc/2, malletClient.y - mhc/2, mwc, mhc);
    } catch(e){
      // if anything wrong, ignore and keep fallback
      // console.warn('sprite draw failed', e);
    }
  }

  // puck drawn as red disc (with highlight)
  ctx.beginPath(); ctx.fillStyle = '#d33'; ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.arc(puck.x - puck.r*0.25, puck.y - puck.r*0.25, puck.r*0.5, 0, Math.PI*2); ctx.fill();

  // labels
  ctx.fillStyle = '#222'; ctx.font = '18px Inter, Arial'; ctx.fillText('Servidor', 18, 30);
  ctx.fillText('Cliente', 18, H - 10);
}

// handshake helper checks
setInterval(()=>{
  // if client sent SYN and puck reaches top area, server replies
  if(connectionState === 'HANDSHAKE_SYN_SENT'){
    if(puck.y < H*0.35){
      log('Servidor: SYN recebido. Rebatendo com SYN/ACK.');
      connectionState = 'HANDSHAKE_WAIT_SYNACK';
      stateEl.textContent = 'Estado: SYN recebido (servidor respondeu)';
      // server will either auto-hit on collision or we nudge the puck
      if(dist(puck, malletServer) > malletServer.r + puck.r + 6){
        // nudge toward server mallet to ensure collision handling
        puck.vy = 8; puck.vx = (Math.random()-0.5)*2;
        beep(880, 0.05, 0.04);
      }
    }
  } else if(connectionState === 'HANDSHAKE_SYNACK_SENT' || connectionState === 'HANDSHAKE_WAIT_SYNACK'){
    if(puck.y > H*0.65){
      // puck returned downwards: client sees SYN-ACK
      log('Cliente: recebeu SYN/ACK (disco voltou). Pressione TACAR para enviar ACK final.');
      connectionState = 'HANDSHAKE_WAIT_CLIENT_ACK';
      stateEl.textContent = 'Estado: WAIT_CLIENT_ACK';
    }
  }
}, 120);

// main loop
function tick(){
  physicsStep();
  updateMallets();
  render();
  requestAnimationFrame(tick);
}

// button behavior
hitBtn.addEventListener('click', ()=>{
  if(audioCtx.state === 'suspended') audioCtx.resume();
  if(connectionState === 'DISCONNECTED' || connectionState === 'HANDSHAKE_SYN_SENT' || connectionState === 'HANDSHAKE_WAIT_SYNACK' || connectionState === 'HANDSHAKE_WAIT_CLIENT_ACK'){
    clientHit();
  } else {
    clientHit();
  }
});

// start
puck.x = W/2; puck.y = H/2;
malletClient.x = W/2; malletClient.y = H - 110;
malletServer.x = W/2; malletServer.y = 110;

log('Protótipo pronto. Clique TACAR para começar o handshake.');
stateEl.textContent = 'Estado: DISCONNECTED';
tick();
