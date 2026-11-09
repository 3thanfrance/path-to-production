export const BRAND = Object.freeze({ carOrange: '#FFB310', chainguardPurple: '#ad65ff', chainguardMark: 'placeholder octopus' });
export const PRODUCTION_DISTANCE = 2000;
export const LANE_COUNT = 5;
export const CRUISE_SPEED = 56;
export const TOP_SPEED = 76;
export const TURBO_SPEED = 105;
export const TURBO_SECONDS = 3.5;
export const DEADLINE_SECONDS = 6;
const MAX_TIME = 60;
const PLAZA_SPACING = 620;
const FIRST_PLAZA = 510;
const PLAZA_APPROACH = 230;
const HAZARD_SPEEDS = [24, 29, 34, 41, 0, 0];

export const lanePosition = (lane, lanes = LANE_COUNT) => (2 * lane + 1) / lanes - 1;

export function obstacleLane(object) {
  const base = lanePosition(object.lane);
  if (object.kind !== 'hazard' || !HAZARD_SPEEDS[object.type] || object.exitStart == null) return base;
  const ramp = Math.max(0, Math.min(1, (object.z - object.exitStart) / 65));
  return base + (object.lane < 2 ? -1 : 1) * ramp * 1.35;
}

function openingTraffic() {
  return [
    { kind: 'hazard', type: 0, lane: 0, z: 85, exitStart: 338 },
    { kind: 'hazard', type: 1, lane: 4, z: 96, exitStart: 338 },
    ...[32, 47, 62, 77, 92].map(z => ({ kind: 'coin', lane: 2, z })),
    { kind: 'boost', lane: 2, z: 115 },
    { kind: 'hazard', type: 4, lane: 1, z: 172 },
    { kind: 'hazard', type: 5, lane: 4, z: 178 },
    { kind: 'deadline', lane: 3, z: 230 },
    { kind: 'gem', lane: 2, z: 263 },
    { kind: 'hazard', type: 5, lane: 0, z: 290 },
    { kind: 'hazard', type: 4, lane: 2, z: 290 },
    { kind: 'hazard', type: 5, lane: 4, z: 300 },
  ];
}

export const rank = meters => meters < 400 ? 'IDEATION' : meters < 1000 ? 'BUILD'
  : meters < PRODUCTION_DISTANCE ? 'STAGED' : meters < 3000 ? 'PRODUCTION' : 'CLEARED FOR PRODUCTION';

export class Run {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 45;
    this.distance = 0;
    this.speed = 0;
    this.lane = 2;
    this.brilliance = 0;
    this.coins = 0;
    this.pass = false;
    this.stop = 0;
    this.stopTotal = 0;
    this.tollLost = 0;
    this.flow = 0;
    this.longest = 0;
    this.refunded = 0;
    this.over = false;
    this.plaza = FIRST_PLAZA;
    this.passedPlaza = null;
    this.plazaIndex = 0;
    this.purple = 3;
    this.objects = openingTraffic();
    this.warned = false;
    this.message = '';
    this.messageTime = 0;
    this.spin = 0;
    this.boost = 0;
    this.events = [];
  }

  move(direction) {
    if (!this.stop && !this.over) this.lane = Math.max(0, Math.min(LANE_COUNT - 1, this.lane + direction));
  }

  buy() {
    if (this.brilliance < 15 || this.pass || this.over) return false;
    this.brilliance -= 15;
    this.pass = true;
    return true;
  }

  notify(message, duration = 2.5) {
    this.message = message;
    this.messageTime = duration;
  }

  addTime(seconds) {
    const added = Math.min(seconds, MAX_TIME - this.time);
    this.time += added;
    return Math.max(0, added);
  }

  toll() {
    if (this.lane === this.purple) {
      const added = this.addTime(2);
      this.notify(added ? `TOLL PRE-PAID  +${Math.ceil(added)}s` : 'TOLL PRE-PAID · CLOCK FULL');
      this.events.push('toll');
      return;
    }
    this.stop = this.pass ? 2 : 8;
    this.stopTotal = this.stop;
    this.pass = false;
    this.speed = 0;
    this.boost = 0;
    this.tollLost += this.stop;
    this.notify(this.stop === 2 ? 'PASS ACCEPTED · SLOW ROLL' : 'VERIFICATION IN PROGRESS');
    this.events.push('stop');
  }

  queueTraffic(previousGate) {
    // Reserve a neighboring lane on each row so a player can weave through it.
    // Moving rows use one speed. Static rows stay far enough apart for turbo.
    let route = this.lane;
    for (let row = 0; row < 5; row++) {
      const z = previousGate + 103 + row * 86 + Math.floor(this.random() * 12);
      const candidates = [route - 1, route, route + 1].filter(lane => lane >= 0 && lane < LANE_COUNT);
      route = candidates[Math.floor(this.random() * candidates.length)];
      const alternate = (route + 1 + Math.floor(this.random() * 4)) % LANE_COUNT;
      const moving = row === 4;
      const type = Math.floor(this.random() * 4);
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        if (lane === route || lane === alternate) continue;
        if (row === 0 && this.random() < .45) continue;
        this.objects.push({
          kind: 'hazard', lane, z,
          type: moving ? type : 4 + Math.floor(this.random() * 2),
          exitStart: this.plaza - 130,
        });
      }
      const pickup = row === 1 ? 'boost' : row === 3 && this.plazaIndex % 2 === 1 ? 'deadline' : row === 2 ? 'gem' : 'coin';
      this.objects.push({ kind: pickup, lane: route, z });
      if (pickup === 'coin') this.objects.push({ kind: 'coin', lane: route, z: z + 15 });
    }
  }

  passPlaza() {
    const gate = this.plaza;
    this.toll();
    this.passedPlaza = {
      z: gate, purple: this.purple, stoppedLane: this.stop ? this.lane : -1,
      duration: this.stop, waited: 0,
    };
    this.plaza += PLAZA_SPACING;
    this.plazaIndex++;
    this.purple = (this.purple + 1 + Math.floor(this.random() * 4)) % LANE_COUNT;
    this.warned = false;
    this.queueTraffic(gate);
  }

  collect(object) {
    object.hit = true;
    switch (object.kind) {
      case 'hazard':
        if (this.spin) return;
        this.spin = .82;
        this.speed *= .45;
        this.boost = 0;
        this.time -= 3;
        this.flow = 0;
        this.notify('IMPACT  −3s', 1.4);
        this.events.push('crash');
        break;
      case 'boost':
        this.boost = TURBO_SECONDS;
        this.speed = Math.max(this.speed, TOP_SPEED);
        this.notify('TURBO ENGAGED', 1.5);
        this.events.push('boost');
        break;
      case 'deadline': {
        const added = this.addTime(DEADLINE_SECONDS);
        this.notify(added ? `DEADLINE EXTENDED  +${Math.ceil(added)}s` : 'DEADLINE PICKUP · CLOCK FULL');
        this.events.push('deadline');
        break;
      }
      case 'gem':
        this.brilliance += 3;
        if (!this.messageTime) this.notify('+3 BRILLIANCE', 1.2);
        this.events.push('gem');
        break;
      case 'coin':
        this.coins++;
        this.events.push('coin');
        break;
    }
  }

  update(dt, accelerating, braking = false) {
    if (this.over) return;
    this.events = [];
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.spin = Math.max(0, this.spin - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.time -= dt;

    const held = Math.min(dt, this.stop);
    if (this.passedPlaza) this.passedPlaza.waited += held;
    this.stop = Math.max(0, this.stop - dt);
    if (this.stop < 1e-9) this.stop = 0;
    const before = this.distance;
    if (held) {
      this.flow = 0;
      this.speed = 0;
    } else {
      const target = braking ? 22 : this.spin ? 30 : this.boost ? TURBO_SPEED : accelerating ? TOP_SPEED : CRUISE_SPEED;
      this.speed += (target - this.speed) * Math.min(1, dt * (braking || this.boost ? 4 : 2.3));
      this.distance += this.speed * dt;
      if (this.speed >= TOP_SPEED - 2 && !this.spin) {
        this.flow += dt;
        this.longest = Math.max(this.longest, this.flow);
        if (this.flow > 2) this.refunded += this.addTime(Math.min(dt * .8, Math.max(0, 90 - this.refunded)));
      } else {
        this.flow = 0;
      }
      if (!this.warned && this.plaza - this.distance < PLAZA_APPROACH) {
        this.warned = true;
        if (!this.messageTime) this.notify('TOLL AHEAD · FIND PURPLE', 1.7);
      }
      const stopLine = this.plaza - (this.lane === this.purple ? 0 : 12);
      if (this.distance >= stopLine) {
        this.distance = stopLine;
        this.passPlaza();
      }
      if (this.passedPlaza && this.distance > this.passedPlaza.z + 65) this.passedPlaza = null;
      if (before < PRODUCTION_DISTANCE && this.distance >= PRODUCTION_DISTANCE) {
        this.notify('PRODUCTION REACHED · KEEP DRIVING');
      }
    }

    const playerLane = lanePosition(this.lane);
    for (const object of this.objects) {
      if (object.kind === 'hazard') object.z += dt * (HAZARD_SPEEDS[object.type] ?? 0);
      if (held || this.stop || object.hit || object.z < before - 4 || object.z > this.distance + 4) continue;
      if (Math.abs(obstacleLane(object) - playerLane) <= .18) this.collect(object);
    }
    this.objects = this.objects.filter(object => object.z > this.distance - 45 && Math.abs(obstacleLane(object)) < 1.6);
    if (this.time <= 0) {
      this.time = 0;
      this.over = true;
      this.events.push('end');
    }
  }
}
