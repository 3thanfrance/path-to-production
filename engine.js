export const BRAND = Object.freeze({ carOrange: '#FFB310', chainguardPurple: '#ad65ff' });
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
const VEHICLE_SPEEDS = [22, 25, 31, 40];
const CONVOY_GAP = 37;
export const MERGE_SIGNAL = .55;
export const MERGE_DURATION = .85;
const FOLLOW_GAP = 22;

export const lanePosition = (lane, lanes = LANE_COUNT) => (2 * lane + 1) / lanes - 1;

export function obstacleLane(object) {
  const from = lanePosition(object.lane);
  if (object.merge) {
    const t = Math.max(0, Math.min(1, (object.merge.elapsed - MERGE_SIGNAL) / MERGE_DURATION));
    return from + (lanePosition(object.merge.to) - from) * t * t * (3 - 2 * t);
  }
  return from;
}

export function stepSteering(position, velocity, target, dt) {
  const response = 17;
  const error = position - target;
  const momentum = velocity + response * error;
  const decay = Math.exp(-response * dt);
  return {
    position: target + (error + momentum * dt) * decay,
    velocity: (velocity - response * momentum * dt) * decay,
  };
}

function openingTraffic() {
  return [
    { kind: 'hazard', type: 0, lane: 0, z: 85 },
    { kind: 'hazard', type: 1, lane: 4, z: 96 },
    ...[32, 47, 62, 77, 92].map(z => ({ kind: 'coin', lane: 2, z })),
    { kind: 'boost', lane: 2, z: 115 },
    { kind: 'hazard', type: 2, lane: 1, z: 172 },
    { kind: 'hazard', type: 3, lane: 4, z: 178 },
    { kind: 'deadline', lane: 3, z: 230 },
    { kind: 'gem', lane: 2, z: 263 },
    { kind: 'hazard', type: 1, lane: 0, z: 290 },
    { kind: 'hazard', type: 2, lane: 1, z: 304 },
    { kind: 'hazard', type: 0, lane: 4, z: 300 },
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
    this.steering = { position: 0, velocity: 0 };
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
    this.queueTraffic(FIRST_PLAZA, 1, this.purple);
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

  toll(contactLane = this.lane) {
    if (contactLane === this.purple) {
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

  queueTraffic(previousGate, stretch, entryLane) {
    // Reserve a neighboring lane on each row so a player can weave through it.
    // Convoys carry a moving gap. Keeping their spacing lets players reach the next gap.
    let route = entryLane;
    const tier = Math.min(4, Math.floor((stretch - 1) / 2));
    const rowCount = 5 + Math.min(3, tier);
    const spacing = 405 / (rowCount - 1);
    for (let row = 0; row < rowCount; row++) {
      const z = previousGate + 82 + row * spacing + Math.floor(this.random() * 5);
      const priorRoute = route;
      const candidates = [route - 1, route, route + 1].filter(lane => lane >= 0 && lane < LANE_COUNT &&
        (row % 2 === 0 || lane !== priorRoute));
      route = candidates[Math.floor(this.random() * candidates.length)];
      const alternateLanes = Array.from({length: LANE_COUNT}, (_, lane) => lane)
        .filter(lane => lane !== route && lane !== priorRoute);
      const alternate = alternateLanes[Math.floor(this.random() * alternateLanes.length)];
      const convoy = { speed: 24 + Math.floor(this.random() * 8) + Math.min(3, tier) };
      const blocked = Array.from({length: LANE_COUNT}, (_, lane) => lane)
        .filter(lane => lane !== route && lane !== alternate);
      const rowBias = Math.floor(this.random() * 5) - 2 + Math.min(3, tier);
      let type = Math.floor(this.random() * VEHICLE_SPEEDS.length);
      const mergePocket = (row === 1 || row === 3)
        ? blocked.find(lane => blocked.some(other => Math.abs(other - lane) === 1)) : undefined;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        if (!blocked.includes(lane) || lane === mergePocket) continue;
        if (!tier && row === 0 && this.random() < .45) continue;
        this.objects.push({
          kind: 'hazard', lane, z: z + (lane - 2) * 4, convoy,
          type, workTruck: type === 2 && row % 3 === 2,
          speed: VEHICLE_SPEEDS[type] + rowBias,
          mergeEligible: type >= 2 && this.random() > .22,
          protectedLane: route,
        });
        type = (type + 1) % VEHICLE_SPEEDS.length;
      }
      const pickup = row === 1 ? 'boost' : row === 3 && stretch % 2 === 1 ? 'deadline' : row === 2 ? 'gem' : 'coin';
      this.objects.push({ kind: pickup, lane: route, z });
      if (pickup === 'coin') this.objects.push({ kind: 'coin', lane: route, z: z + 15 });
    }
  }

  passPlaza(contactLane = this.lane) {
    const gate = this.plaza;
    this.toll(contactLane);
    if (this.stop) this.lane = contactLane;
    this.passedPlaza = {
      z: gate, purple: this.purple, stoppedLane: this.stop ? this.lane : -1,
      duration: this.stop, waited: 0,
    };
    this.plaza += PLAZA_SPACING;
    this.plazaIndex++;
    this.purple = (this.purple + 1 + Math.floor(this.random() * 4)) % LANE_COUNT;
    this.warned = false;
    this.queueTraffic(this.plaza, this.plazaIndex + 1, this.purple);
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

  expressLaneAt(distance) {
    if (distance >= this.plaza - 44 && distance <= this.plaza) return this.purple;
    if (this.passedPlaza && distance >= this.passedPlaza.z && distance <= this.passedPlaza.z + 34) {
      return this.passedPlaza.purple;
    }
    return -1;
  }

  advanceTraffic(dt) {
    const vehicles = this.objects.filter(object => object.kind === 'hazard').sort((a, b) => b.z - a.z);
    const playerLane = this.steering.position;
    const occupancy = vehicle => [vehicle.lane, vehicle.merge?.to ?? vehicle.lane];
    const sharesLane = (vehicle, lane) => occupancy(vehicle).includes(lane);
    const clearToMerge = (vehicle, lane) => !vehicles.some(other => other !== vehicle &&
      sharesLane(other, lane) && Math.abs(other.z - vehicle.z) < 43);

    const convoys = new Map();
    for (const vehicle of vehicles) {
      if (!vehicle.convoy) continue;
      const bounds = convoys.get(vehicle.convoy);
      if (bounds) bounds.tail = vehicle.z;
      else convoys.set(vehicle.convoy, {front: vehicle.z, tail: vehicle.z});
    }
    let precedingTail = Infinity;
    for (const [convoy, bounds] of convoys) {
      const nearby = Math.max(0, Math.min(1, (710 - bounds.front + this.distance) / 330));
      const freeTravel = dt * (12 + (convoy.speed - 12) * nearby);
      bounds.travel = Math.min(freeTravel, Math.max(0, precedingTail - bounds.front - CONVOY_GAP));
      precedingTail = bounds.tail + bounds.travel;
    }

    for (let index = 0; index < vehicles.length; index++) {
      const vehicle = vehicles[index];
      const distanceAhead = vehicle.z - this.distance;
      const toGate = this.plaza - vehicle.z;
      const leavingExpress = vehicle.lane === this.purple && toGate > 25 && toGate < 175;
      if (!vehicle.merge && leavingExpress) {
        const adjacent = [vehicle.lane - 1, vehicle.lane + 1].find(lane => lane >= 0 &&
          lane < LANE_COUNT && lane !== vehicle.protectedLane && clearToMerge(vehicle, lane));
        if (adjacent !== undefined) vehicle.merge = {to: adjacent, elapsed: 0};
      }
      if (vehicle.merge) {
        const merge = vehicle.merge;
        if (merge.elapsed < MERGE_SIGNAL && !clearToMerge(vehicle, merge.to)) {
          vehicle.merge = null;
        } else {
          merge.elapsed += dt;
          if (merge.elapsed >= MERGE_SIGNAL + MERGE_DURATION) {
            vehicle.lane = merge.to;
            vehicle.merge = null;
          }
        }
      } else if (vehicle.mergeEligible && distanceAhead > 135 && distanceAhead < 220) {
        const fromGate = ((vehicle.z - FIRST_PLAZA) % PLAZA_SPACING + PLAZA_SPACING) % PLAZA_SPACING;
        // Leave a long, predictable approach to the barrier arms.
        if (fromGate > 108 && fromGate < PLAZA_SPACING - 155) {
          vehicle.mergeEligible = false;
          const lanes = [vehicle.lane - 1, vehicle.lane + 1].filter(lane =>
            lane >= 0 && lane < LANE_COUNT && lane !== vehicle.protectedLane &&
            !(lane === this.purple && toGate < 220 && toGate > 0) &&
            Math.abs(lanePosition(lane) - playerLane) > .16 && clearToMerge(vehicle, lane));
          if (lanes.length) vehicle.merge = {to: lanes[0], elapsed: 0};
        }
      }

      if (vehicle.convoy) {
        vehicle.z += convoys.get(vehicle.convoy).travel;
        continue;
      }

      const freeSpeed = vehicle.speed ?? VEHICLE_SPEEDS[vehicle.type] ?? 30;
      const nearby = Math.max(0, Math.min(1, (710 - distanceAhead) / 330));
      let travel = dt * (12 + (freeSpeed - 12) * nearby);
      const lanes = occupancy(vehicle);
      for (let leadIndex = 0; leadIndex < index; leadIndex++) {
        const leader = vehicles[leadIndex];
        const gap = leader.z - vehicle.z;
        if (gap > 82 || !lanes.some(lane => sharesLane(leader, lane))) continue;
        const headwaySpeed = Math.max(7, (leader.speed ?? VEHICLE_SPEEDS[leader.type] ?? 30) + (gap - 43) * .62);
        travel = Math.min(travel, headwaySpeed * dt, Math.max(0, gap - FOLLOW_GAP));
        break;
      }
      vehicle.z += travel;
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
    if (!held) this.steering = stepSteering(this.steering.position, this.steering.velocity, lanePosition(this.lane), dt);
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
      const contactLane = Math.max(0, Math.min(LANE_COUNT - 1,
        Math.round(((this.steering.position + 1) * LANE_COUNT - 1) / 2)));
      const stopLine = this.plaza - (contactLane === this.purple ? 0 : 12);
      if (this.distance >= stopLine) {
        this.distance = stopLine;
        this.passPlaza(contactLane);
      }
      if (this.passedPlaza && this.distance > this.passedPlaza.z + 65) this.passedPlaza = null;
      if (before < PRODUCTION_DISTANCE && this.distance >= PRODUCTION_DISTANCE) {
        this.notify('PRODUCTION REACHED · KEEP DRIVING');
      }
    }

    this.advanceTraffic(dt);
    const playerLane = this.steering.position;
    const express = this.expressLaneAt(this.distance);
    const usingExpress = express >= 0 && Math.abs(lanePosition(express) - playerLane) <= .16;
    for (const object of this.objects) {
      if (held || this.stop || object.hit || object.z < before - 4 || object.z > this.distance + 4) continue;
      // Purple toll priority prevents a blocked NPC merge from punishing a clean approach.
      if (usingExpress && object.kind === 'hazard') continue;
      if (Math.abs(obstacleLane(object) - playerLane) <= .18) this.collect(object);
    }
    this.objects = this.objects.filter(object => object.z > this.distance - 45 );
    if (this.time <= 0) {
      this.time = 0;
      this.over = true;
      this.events.push('end');
    }
  }
}
