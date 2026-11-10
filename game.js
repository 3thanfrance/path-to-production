import {Run, rank, PRODUCTION_DISTANCE, TURBO_SPEED, MAX_TURBO_FUEL} from './engine.js';
import {createRoad} from './road.js';
import {createRoad3D} from './road3d.js';
const $ = id => document.getElementById(id);
let canvas = $('road');
let road;
let ctx;
try {
  if (!window.WebGL2RenderingContext) throw new Error('WebGL 2 unavailable');
  road = createRoad3D(canvas);
} catch {
  const fallback = canvas.cloneNode();
  canvas.replaceWith(fallback);
  canvas = fallback;
  ctx = canvas.getContext('2d');
  road = createRoad(ctx);
}
const METERS_PER_MILE = 1609.344;
let w=0,h=0,dpr=1,run=new Run(),mode='intro',last=0,visualDistance=0,muted=true,audio,osc,gain,best=0,keys=new Set(),touching=false,pointerStart=null, wreckDelay=0, steerHeld=0, steerDirection=0, turboPointer=null;
try{best=Number(localStorage.getItem('ptp-best'))||0;}catch{}
$('best-intro').textContent=`PERSONAL BEST — ${(best/METERS_PER_MILE).toFixed(2)} MI`;
function resize(){w=canvas.clientWidth;h=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);if(ctx){canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}road.resize(w,h);}addEventListener('resize',resize);resize();
function sound(type){if(muted||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);const t=audio.currentTime;const freq={gem:660,charge:880,boost:1150,deadline:990,repair:1240,toll:523,stop:100,crash:70,end:180}[type]||440;o.type=['stop','crash'].includes(type)?'sawtooth':'sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(type==='toll'?1046:Math.max(40,freq/2),t+.25);g.gain.setValueAtTime(.055,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.start(t);o.stop(t+.36);}
function initAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();if(!osc){osc=audio.createOscillator();gain=audio.createGain();osc.type='triangle';osc.connect(gain);gain.connect(audio.destination);gain.gain.value=0;osc.start();}}catch{}}
$('mute').onclick=()=>{muted=!muted;if(!muted)initAudio();$('mute').innerHTML=`SOUND ${muted?'OFF':'ON'} <span>⌁</span>`;$('mute').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');};
function start(){run=new Run();wreckDelay=0;steerHeld=0;steerDirection=0;pointerStart=null;turboPointer=null;mode='play';$('game').dataset.mode='play';visualDistance=0;keys.clear();touching=false;last=performance.now();$('intro').hidden=true;$('end').hidden=true;$('paused').hidden=true;$('hud').hidden=false;initAudio();}
$('start').onclick=start;$('again').onclick=start;
function pause(){if(mode!=='play')return;mode='pause';$('game').classList.remove('turbo');keys.clear();steerDirection=0;steerHeld=0;touching=false;pointerStart=null;turboPointer=null;$('paused').hidden=false;}
$('pause').onclick=pause;$('resume').onclick=()=>{mode='play';$('paused').hidden=true;last=performance.now();};document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('blur',pause);
const turboButton = $('fire-turbo');
$('turbo-charge').max = MAX_TURBO_FUEL;
turboButton.addEventListener('pointerdown', event => {
  if (mode !== 'play' || event.button !== 0 || turboPointer !== null) return;
  event.preventDefault();
  turboPointer = event.pointerId;
  turboButton.setPointerCapture(event.pointerId);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  turboButton.addEventListener(type, event => {
    if (turboPointer === event.pointerId) turboPointer = null;
  });
}
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();const k=e.key.toLowerCase();if(k==='escape'){if(mode==='play')pause();else if(mode==='pause')$('resume').click();return;}if(mode!=='play')return;if(!keys.has(k)){if(k==='arrowleft'||k==='a')run.steerBy(-.035);if(k==='arrowright'||k==='d')run.steerBy(.035);}keys.add(k);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
canvas.addEventListener('pointerdown',e=>{if(mode!=='play')return;touching=true;pointerStart={x:e.clientX,y:e.clientY,dy:0};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!pointerStart||mode!=='play')return;const dx=e.clientX-pointerStart.x;run.steerBy(dx * 2.5 / Math.max(320, w));pointerStart.x=e.clientX;pointerStart.dy=e.clientY-pointerStart.y;});for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,()=>{touching=false;pointerStart=null;});
function end(){mode='end';$('game').classList.remove('turbo');$('end-title').textContent=run.failure==='breakdown'?'CAR 42 BROKE DOWN':run.wrecked?'CAR 42 WRECKED':'TIME IS UP';$('hud').hidden=true;$('end').hidden=false;const isBest=run.distance>best;best=Math.max(best,run.distance);try{localStorage.setItem('ptp-best',String(best));}catch{}$('rank').textContent=rank(run.distance);$('final-distance').textContent=`${(run.distance/METERS_PER_MILE).toFixed(2)} MI`;$('final-tolls').textContent=`${run.tollLost}s`;$('final-gems').textContent=run.brilliance;$('final-flow').textContent=`${run.longest.toFixed(1)}s`;$('final-best').textContent=`${isBest?'NEW PERSONAL BEST':'PERSONAL BEST'} — ${(best/METERS_PER_MILE).toFixed(2)} MI`;}
function hud(){ $('damage').value=run.damage;$('damage-value').textContent=`DAMAGE ${run.damage}%`;$('condition').dataset.critical=run.damage>=75;const seconds = Math.ceil(run.time); $('clock').textContent=`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;document.querySelector('.time').classList.toggle('low',run.time<10);$('odometer').textContent=(run.distance/METERS_PER_MILE).toFixed(2).padStart(6,'0');const toProduction = Math.max(0, PRODUCTION_DISTANCE - run.distance); $('goal').textContent = toProduction ? `${(toProduction / METERS_PER_MILE).toFixed(2)} MI TO PRODUCTION` : 'PRODUCTION REACHED'; $('gems').textContent=run.brilliance;$('speed').textContent=Math.round(run.speed*2.237);$('turbo-time').hidden = !run.boost;$('turbo-time').textContent = run.boost ? `TURBO ${run.turboFuel.toFixed(1)}s` : '';$('refund').textContent=run.refunded>=90?'TIME REFUND LIMIT REACHED':'HOLD TOP SPEED TO REFUND TIME';$('toast').textContent=run.messageTime>0?run.message:'';$('verification').hidden=run.stop<=0;$('wait').textContent=run.stop.toFixed(1);}
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode === 'play') {
    const left = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const direction = Number(right) - Number(left);
    steerHeld = direction && direction === steerDirection ? steerHeld + dt : 0;
    steerDirection = direction;
    if (direction) run.steerWithKeys(direction, steerHeld, dt);
    const brake = keys.has('arrowdown') || keys.has('s') || (pointerStart?.dy ?? 0) > 24;
    const throttle = touching || keys.has('arrowup') || keys.has('w');
    run.update(dt, throttle, brake, keys.has(' ') || turboPointer !== null);
    const turbo = run.boost > 0;
    $('turbo-charge').value = run.turboFuel;
    turboButton.disabled = (!run.turboFuel && turboPointer === null) || run.over;
    $('clean-speed').textContent = run.cleanSpeedBonus >= .45
      ? `CLEAN SPEED +${Math.round(run.cleanSpeedBonus * 2.237)} MPH` : '';
    $('game').classList.toggle('turbo', turbo);
    $('game').style.setProperty('--turbo-kick', turbo ? run.turboKick / .48 : 0);
    visualDistance = run.distance;
    for (const event of run.events) sound(event);
    hud();
    if (run.wrecked) {
      mode = 'wreck';
      $('game').classList.remove('turbo');
      $('toast').textContent = run.failure === 'breakdown' ? 'ENGINE FAILURE · RUN OVER' : 'ROAD CLOSED · VEHICLE WRECKED';
    } else if (run.over) {
      end();
    }
  } else if (mode === 'wreck') {
    wreckDelay += dt;
    run.impact.age = wreckDelay;
    if (wreckDelay >= .72) end();
  } else if (mode === 'intro') {
    visualDistance += dt * 12;
  }
  if (gain && audio) {
    gain.gain.setTargetAtTime(!muted && mode === 'play' ? run.speed / TURBO_SPEED * .025 : 0, audio.currentTime, .15);
    osc.frequency.setTargetAtTime(35 + run.speed * 1.25, audio.currentTime, .1);
  }
  road.draw(run, mode, visualDistance, now, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
