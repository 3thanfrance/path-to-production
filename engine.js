export const BRAND = Object.freeze({ carOrange: '#FFB310', chainguardPurple: '#ad65ff', chainguardMark: 'placeholder octopus' });
export const PRODUCTION_DISTANCE = 2000;
export const PLAZA_SPACING = 430;
export const FIRST_PLAZA = 330;
export const PLAZA_APPROACH = 190;
export const PLAZA_EXIT = 52;
export const HAZARD_SPEEDS = [9, 11, 13, 17, 0, 0];

export function plazaWidthAt(z) {
  const fromGate = ((z - FIRST_PLAZA + PLAZA_APPROACH) % PLAZA_SPACING + PLAZA_SPACING) % PLAZA_SPACING - PLAZA_APPROACH;
  if (fromGate < -120) return Math.min(1, (fromGate + PLAZA_APPROACH) / 70);
  if (fromGate < 20) return 1;
  return Math.max(0, 1 - (fromGate - 20) / (PLAZA_EXIT - 20));
}

export function obstacleLane(object) {
  const base = lanePosition(object.lane, 3);
  if (object.kind !== 'hazard' || !HAZARD_SPEEDS[object.type]) return base;
  const ramp = Math.max(0, Math.min(1, (object.z - object.exitStart) / 45));
  return Number.isFinite(ramp) ? base + (object.lane === 0 ? -1 : 1) * ramp * 1.25 : base;
}
export const lanePosition = (lane, lanes) => (2 * lane + 1) / lanes - 1;

function openingTraffic() {
  return [
    { kind: 'hazard', type: 0, lane: 0, z: 62, exitStart: FIRST_PLAZA - 175 },
    { kind: 'hazard', type: 1, lane: 2, z: 75, exitStart: FIRST_PLAZA - 175 },
    ...[31, 44, 57, 70, 83].map(z => ({ kind: 'coin', lane: 1, z })),
    { kind: 'gem', lane: 2, z: 126 },
  ];
}

export const rank = m => m < 400 ? 'IDEATION' : m < 1000 ? 'BUILD' : m < PRODUCTION_DISTANCE ? 'STAGED' : m < 3000 ? 'PRODUCTION' : 'CLEARED FOR PRODUCTION';
export class Run {
  constructor(random = Math.random) { this.random=random; this.time=45; this.distance=0; this.speed=0; this.lane=1; this.lanes=3; this.brilliance=0; this.coins=0; this.pass=false; this.stop=0; this.stopTotal=0; this.tollLost=0; this.flow=0; this.longest=0; this.refunded=0; this.over=false; this.plaza=FIRST_PLAZA; this.passedPlaza=null; this.hazardOrder=[4, 2, 5, 3, 0, 1]; this.hazardIndex=0; this.plazaIndex=0; this.purple=3; this.objects=openingTraffic(); this.nextSpawn=1e9; this.message=''; this.messageTime=0; this.spin=0; this.events=[]; }
  move(direction) { if(!this.stop&&!this.over) this.lane=Math.max(0,Math.min(this.lanes-1,this.lane+direction)); }
  buy() { if(this.brilliance>=15&&!this.pass&&!this.over) { this.brilliance-=15; this.pass=true; return true; } return false; }
  notify(text) { this.message=text; this.messageTime=2.5; }
  toll() { if(this.lane===this.purple){this.time=Math.min(60,this.time+2);this.notify('TOLL PRE-PAID  +2s');this.events.push('toll');}else{const duration=this.pass?2:8;this.pass=false;this.stop=duration;this.stopTotal=duration;this.speed=0;this.tollLost+=duration;this.notify(duration===2?'PASS ACCEPTED · SLOW ROLL':'VERIFICATION IN PROGRESS');this.events.push('stop');} }
  update(dt,accelerating,braking=false) {
    if(this.over)return; this.events=[]; this.messageTime=Math.max(0,this.messageTime-dt); this.spin=Math.max(0,this.spin-dt);
    const held=Math.min(dt,this.stop);
    if (this.passedPlaza && held > 0) this.passedPlaza.waited += held;
    this.stop=Math.max(0,this.stop-dt); if(this.stop<1e-9)this.stop=0; this.time-=dt;
    if(held>0){this.flow=0;this.speed=0;}
    else {
      const target=braking?7:accelerating?42:24;this.speed+=(target-this.speed)*Math.min(1,dt*(braking?3:1.5));if(this.spin)this.speed=Math.min(this.speed,12);
      const before = this.distance;
      this.distance += this.speed * dt;
      if (before < PRODUCTION_DISTANCE && this.distance >= PRODUCTION_DISTANCE) {
        this.notify('PRODUCTION REACHED · KEEP DRIVING');
      }
      if(this.speed>=40&&!this.spin){this.flow+=dt;this.longest=Math.max(this.longest,this.flow);if(this.flow>2){const refund=Math.min(dt*.8,90-this.refunded);this.time=Math.min(60,this.time+Math.max(0,refund));this.refunded+=Math.max(0,refund);}}else this.flow=0;
      const remaining = this.plaza - this.distance;
      if (remaining < PLAZA_APPROACH && this.lanes === 3) {
        this.lanes = 5;
        this.lane = Math.round(this.lane * 2);
        this.notify('TOLL PLAZA AHEAD · FIND PURPLE');
      }
      // Red lanes resolve at the painted stop line. Purple resolves under its raised arm.
      const stopLine = this.lane === this.purple ? this.plaza : this.plaza - 12;
      if (this.distance >= stopLine) {
        this.toll();
        if (this.stop) this.distance = stopLine;
        this.passedPlaza = {
          z: this.plaza, purple: this.purple,
          stoppedLane: this.stop ? this.lane : -1, duration: this.stop, waited: 0,
        };
        this.plaza += PLAZA_SPACING;
        this.plazaIndex++;
        this.purple = (this.plazaIndex * 2 + 3) % 5;
        this.nextSpawn = this.passedPlaza.z + PLAZA_EXIT;
      }
      if (this.passedPlaza && this.lanes === 5 && this.distance >= this.passedPlaza.z + PLAZA_EXIT) {
        this.lanes = 3;
        this.lane = Math.round(this.lane / 2);
      }
      if (this.passedPlaza && this.distance > this.passedPlaza.z + 65) this.passedPlaza = null;
      if (this.distance >= this.nextSpawn && this.lanes === 3 && remaining > 300) {
        const blocked = Math.floor(this.random() * 3);
        const coinLane = (blocked + 1) % 3;
        const gemLane = (blocked + 2) % 3;
        const first = this.distance + 58;
        const type = this.hazardOrder[this.hazardIndex++ % this.hazardOrder.length];
        this.objects.push({ kind: 'hazard', lane: blocked, z: first, type, exitStart: this.plaza - 175 });
        for (let i = 0; i < 4; i++) {
          this.objects.push({ kind: 'coin', lane: coinLane, z: first + 12 + i * 8 });
        }
        this.objects.push({ kind: 'gem', lane: gemLane, z: first + 44 });
        this.nextSpawn = this.distance + 70;
      }
    }
    const playerLane = lanePosition(this.lane, this.lanes);
    for (const object of this.objects) {
      if (object.kind === 'hazard') object.z += dt * (HAZARD_SPEEDS[object.type] ?? 0);
      if (held || object.hit || Math.abs(object.z - this.distance) > 4) continue;
      if (Math.abs(obstacleLane(object) - playerLane) > .18) continue;
      object.hit = true;
      if (object.kind === 'hazard') {
        this.spin = 1.2;
        this.speed = 8;
        this.time -= 3;
        this.flow = 0;
        this.notify('SPIN OUT  −3s');
        this.events.push('crash');
      } else if (object.kind === 'coin') {
        this.coins++;
        this.events.push('coin');
      } else {
        this.brilliance += 3;
        this.notify('+3 BRILLIANCE');
        this.events.push('gem');
      }
    }
    this.objects = this.objects.filter(object => object.z > this.distance - 45 && Math.abs(obstacleLane(object)) < 1.6);
    if(this.time<=0){this.time=0;this.over=true;this.events.push('end');}
  }
}
