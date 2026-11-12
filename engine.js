export const BRAND = Object.freeze({ carOrange: '#FFB310', chainguardPurple: '#ad65ff' });
export const PRODUCTION_DISTANCE = 2000;
export const LANE_COUNT = 5;
export const CRUISE_SPEED = 82;
export const TOP_SPEED = 111;
export const TURBO_SPEED = 160;
export const TURBO_SECONDS = 3.5;
export const MAX_TURBO_FUEL = 2 * TURBO_SECONDS;
const TURBO_COAST_SECONDS = .65;
export const DEADLINE_SECONDS = 6;
const MAX_TIME = 60;
const PLAZA_SPACING = 620;
const FIRST_PLAZA = 510;
const PLAZA_APPROACH = 230;
const TOLL_WORK_DISTANCE = 98;
const TOLL_RETURN_DISTANCE = 64;
const bypassLane = lane => lane === 0 ? 1 : lane - 1;

function tollRoadwork(gate, lane, tier = 0) {
  const bypass = bypassLane(lane);
  const work = [
    {kind: 'work', lane, z: gate - TOLL_WORK_DISTANCE},
    {kind: 'guide', lane: bypass, z: gate - 145},
    {kind: 'guide', lane, z: gate - TOLL_RETURN_DISTANCE},
  ];
  if (tier >= 1) {
    const outside = Array.from({length: LANE_COUNT}, (_, lane) => lane)
      .filter(candidate => candidate !== bypass && candidate !== lane);
    const near = outside.reduce((a, b) => Math.abs(a - lane) <= Math.abs(b - lane) ? a : b);
    work.push({kind: 'work', lane: near, z: gate - 83});
    if (tier >= 3) work.push({kind: 'work', lane: outside.find(candidate => candidate !== near), z: gate - 88});
  }
  return work;
}
const VEHICLE_SPEEDS = [22, 25, 31, 40, 36, 33];
export const ROAD_HALF = 3.55 * 2.5;
export const ROAD_DEPTH = .27;
export const ROAD_EDGE = .86;
const PLAYER_SHAPE = {x: 1.20 / ROAD_HALF, z: 2.2 / ROAD_DEPTH};
const WORK_SHAPE = {x: 1.48 / ROAD_HALF, z: .47 / ROAD_DEPTH};
const VEHICLE_SHAPES = [
  {x: 1.31, z: 2.85}, {x: 1.31, z: 2.85}, {x: 1.31, z: 1.85},
  {x: 1.20, z: 2.2}, {x: 1.04, z: 1.9}, {x: 1.20, z: 2.42},
].map(({x, z}) => ({x: x / ROAD_HALF, z: z / ROAD_DEPTH}));

// Sweep both footprints in relative motion. The entry axis gives the impact normal.
function sweep(a, b, shapeA, shapeB) {
  let enter = -Infinity;
  let leave = Infinity;
  let normal;
  let nearest = Infinity;
  let overlapNormal;
  for (const axis of ['x', 'z']) {
    const start = a.from[axis] - b.from[axis];
    const delta = a.to[axis] - b.to[axis] - start;
    const extent = shapeA[axis] + shapeB[axis];
    const depth = (extent - Math.abs(start)) * (axis === 'x' ? ROAD_HALF : ROAD_DEPTH);
    if (depth < nearest) {
      nearest = depth;
      overlapNormal = {axis, sign: Math.sign(start) || -Math.sign(delta) || -1};
    }
    if (Math.abs(delta) < 1e-8) {
      if (Math.abs(start) >= extent) return null;
      continue;
    }
    const first = (-extent - start) / delta;
    const last = (extent - start) / delta;
    if (Math.min(first, last) > enter) {
      enter = Math.min(first, last);
      normal = {axis, sign: -Math.sign(delta)};
    }
    leave = Math.min(leave, Math.max(first, last));
  }
  if (enter > leave || leave <= 0 || enter > 1) return null;
  return {fraction: Math.max(0, enter), ...(enter < 0 ? overlapNormal : normal)};
}
const CONVOY_GAP = 47;
const GUIDE_LEAD = 31;
export const MERGE_SIGNAL = .55;
export const MERGE_DURATION = .85;
const FOLLOW_GAP = 22;

export const lanePosition = (lane, lanes = LANE_COUNT) => (2 * lane + 1) / lanes - 1;

export function obstacleLane(object) {
  const from = lanePosition(object.lane) + (object.deflect ?? 0);
  if (object.merge) {
    const t = Math.max(0, Math.min(1, (object.merge.elapsed - MERGE_SIGNAL) / MERGE_DURATION));
    return from + (lanePosition(object.merge.to) - from) * t * t * (3 - 2 * t);
  }
  return from;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const laneAt = position => clamp(Math.round(((position + 1) * LANE_COUNT - 1) / 2), 0, LANE_COUNT - 1);

export function stepSteering(position, velocity, target, dt, response = 17) {
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
    {kind: 'guide', lane: 1, z: 48},
    {kind: 'hazard', type: 0, lane: 0, z: 75},
    {kind: 'hazard', type: 4, lane: 4, z: 82},
    {kind: 'boost', lane: 1, z: 108},
    {kind: 'work', lane: 2, z: 126},
    {kind: 'guide', lane: 2, z: 181},
    {kind: 'hazard', type: 2, lane: 1, z: 167},
    {kind: 'hazard', type: 3, lane: 4, z: 178},
    {kind: 'deadline', lane: 3, z: 247},
    {kind: 'gem', lane: 3, z: 284},
    ...tollRoadwork(FIRST_PLAZA, 3),
    {kind: 'work', lane: 4, z: 305},
    {kind: 'hazard', type: 5, lane: 1, z: 304},
  ];
}

export const rank = meters => meters < 400 ? 'IDEATION' : meters < 1000 ? 'BUILD'
  : meters < PRODUCTION_DISTANCE ? 'STAGED' : meters < 3000 ? 'PRODUCTION' : 'CLEARED FOR PRODUCTION';

export class Run {
  constructor(random = Math.random) {
    this.random = random;
    this.time = 45;
    this.distance = 0;
    this.speed = 35;
    this.lane = 2;
    this.steering = { position: 0, velocity: 0 };
    this.brilliance = 0;
    this.steerTarget = null;
    this.tollGuideLane = null;
    this.impact = null;
    this.contacts = new Set();
    this.wrecked = false;
    this.damage = 0;
    this.damageSide = 1;
    this.panelDamage = [0, 0];
    this.failure = null;
    this.stop = 0;
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
    this.boost = false;
    this.turboCoast = 0;
    this.turboFuel = 0;
    this.cleanTime = 0;
    this.turboKick = 0;
    this.events = [];
    this.nextPurple = this.pickNextPurple();
    this.queueTraffic(FIRST_PLAZA, 1, this.purple, this.nextPurple);
  }

  move(direction) {
    if (this.stop || this.over) return;
    this.steerTarget = null;
    this.lane = Math.max(0, Math.min(LANE_COUNT - 1, this.lane + direction));
  }

  steerBy(delta) {
    if (this.stop || this.over) return;
    const target = this.steerTarget ?? this.steering.position;
    this.steerTarget = Math.max(-ROAD_EDGE, Math.min(ROAD_EDGE, target + delta));
  }

  steerWithKeys(direction, held, dt) {
    const speed = clamp(this.speed / (TURBO_SPEED + 30), 0, 1);
    const ramp = clamp(held / .18, 0, 1);
    const rate = (.52 + 1.65 * ramp) * (1 - speed * .27);
    this.steerBy(direction * rate * dt);
  }

  guidedSteering(target) {
    const ahead = this.plaza - this.distance;
    const behind = this.passedPlaza ? this.distance - this.passedPlaza.z : Infinity;
    const blend = Math.max(clamp((105 - ahead) / 60, 0, 1), clamp((30 - behind) / 22, 0, 1));
    if (!blend || this.steerTarget === null) {
      this.tollGuideLane = null;
      return target;
    }
    // Keep the selected lane stable near the divider, while a deliberate turn can change it.
    if (this.tollGuideLane === null ||
        Math.abs(target - lanePosition(this.tollGuideLane)) > .23) {
      this.tollGuideLane = laneAt(target);
    }
    return target + (lanePosition(this.tollGuideLane) - target) * blend * blend * (3 - 2 * blend);
  }

  get cleanSpeedBonus() {
    return clamp((this.cleanTime - 2) * 2.8, 0, 58);
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
      this.notify(added ? `EXPRESS TOLL  +${Math.ceil(added)}s` : 'EXPRESS TOLL · CLOCK FULL');
      this.events.push('toll');
      return;
    }
    this.stop = 8;
    this.speed = 0;
    this.boost = false;
    this.turboCoast = 0;
    this.tollLost += this.stop;
    this.notify('VERIFICATION IN PROGRESS');
    this.events.push('stop');
  }

  pickNextPurple() {
    // A different gate each time, without asking the player to cross all five lanes.
    const choices = Array.from({length: LANE_COUNT}, (_, lane) => lane).filter(lane =>
      lane !== this.purple && Math.abs(lane - this.purple) <= 2);
    return choices[Math.floor(this.random() * choices.length)];
  }

  queueTraffic(previousGate, stretch, entryLane, exitLane = entryLane) {
    // Plan from the gate we just left to the next one, then put traffic around that line.
    let route = entryLane;
    const tier = Math.min(4, Math.floor((stretch - 1) / 2));
    const rowCount = 5 + Math.min(3, tier);
    const approachLane = bypassLane(exitLane);
    const spacing = 414 / (rowCount - 1);
    let direction = 0;
    const line = [entryLane];
    for (let row = 1; row < rowCount; row++) {
      const priorRoute = route;
      // Bring traffic to the bypass in the final two rows. The purple lane
      // only needs to stay open between the roadwork and the booth.
      const stepsLeft = Math.max(0, rowCount - 2 - row);
      const candidates = [route - 1, route, route + 1].filter(lane =>
        lane >= 0 && lane < LANE_COUNT && Math.abs(approachLane - lane) <= stepsLeft);
      // Prefer a sweep over a random left-right flick. Only reverse when it helps
      // reach the next gate or keeps the run from turning into a straight line.
      const moving = candidates.filter(lane => lane !== route);
      const continuing = moving.filter(lane => Math.sign(lane - route) === direction);
      const choices = continuing.length ? continuing : moving.length ? moving : candidates;
      route = choices[Math.floor(this.random() * choices.length)];
      direction = Math.sign(route - priorRoute);
      line.push(route);
    }

    for (const [row, route] of line.entries()) {
      const z = previousGate + 82 + row * spacing + Math.floor(this.random() * 5);
      const priorRoute = line[row - 1] ?? entryLane;
      const nextRoute = line[row + 1] ?? exitLane;
      const nearGate = row >= rowCount - 2;
      const convoy = {speed: 24 + Math.floor(this.random() * 8) + Math.min(3, tier)};
      const otherLanes = Array.from({length: LANE_COUNT}, (_, lane) => lane)
        .filter(lane => lane !== route && lane !== priorRoute && lane !== nextRoute && (!nearGate || lane !== exitLane));
      const first = route !== priorRoute && priorRoute !== nextRoute && (!nearGate || priorRoute !== exitLane) ? priorRoute : otherLanes.splice(
        Math.floor(this.random() * otherLanes.length), 1)[0];
      const lanes = [first];
      if (otherLanes.length && (tier >= 3 || (row + stretch) % (tier >= 1 ? 2 : 3) === 0)) {
        lanes.push(otherLanes[Math.floor(this.random() * otherLanes.length)]);
      }
      // Keep most of the horizon open with low cars, vans and an occasional tall truck.
      const types = row % 4 === 0 ? [0, 1, 2, 5] : [3, 4, 5];
      const type = types[Math.floor(this.random() * types.length)];
      for (const [index, lane] of lanes.entries()) {
        const alternateType = 3 + (row % 3);
        this.objects.push({
          kind: 'hazard', lane, z: z + (lane - 2) * 2, convoy,
          type: index ? (type === alternateType ? 3 + ((row + 1) % 3) : alternateType) : type,
          mergeEligible: row % 3 === 1,
          protectedLane: route,
          protectedNext: nextRoute,
          protectedExit: nearGate ? exitLane : undefined,
        });
      }
      const pickup = row === 1 ? 'boost' :
        row === 2 ? (stretch % 2 ? 'deadline' : 'gem') :
        row === 0 && stretch % 2 ? 'gem' :
        row === 3 && stretch % 6 === 0 ? 'repair' : null;
      if (!nearGate) {
        this.objects.push({kind: 'guide', lane: route, z: z - GUIDE_LEAD, convoy,
          guideLimit: previousGate + PLAZA_SPACING - 145});
      }
      if (pickup) this.objects.push({kind: pickup, lane: route, z, convoy});
    }
    // Keep the toll exit open, then force a return to purple at the next booth.
    const workLane = lane => lane >= 2 ? 0 : LANE_COUNT - 1;
    this.objects.push(
      {kind: 'work', lane: workLane(entryLane), z: previousGate + 54},
      ...tollRoadwork(previousGate + PLAZA_SPACING, exitLane, tier),
    );
  }

  passPlaza(contactLane = this.lane) {
    const gate = this.plaza;
    this.toll(contactLane);
    this.lane = contactLane;
    this.tollGuideLane = contactLane;
    if (this.steerTarget !== null) this.steerTarget = lanePosition(contactLane);
    if (this.stop) {
      this.steerTarget = null;
      this.steering = {position: lanePosition(contactLane), velocity: 0};
    }
    this.passedPlaza = {
      z: gate, purple: this.purple, stoppedLane: this.stop ? this.lane : -1,
      duration: this.stop, waited: 0,
    };
    this.plaza += PLAZA_SPACING;
    this.plazaIndex++;
    this.purple = this.nextPurple;
    this.nextPurple = this.pickNextPurple();
    this.warned = false;
    this.queueTraffic(this.plaza, this.plazaIndex + 1, this.purple, this.nextPurple);
  }

  collect(object) {
    object.hit = true;
    switch (object.kind) {
      case 'boost':
        this.turboFuel = Math.min(MAX_TURBO_FUEL, this.turboFuel + TURBO_SECONDS);
        this.notify('TURBO CHARGED', 1.2);
        this.events.push('charge');
        break;
      case 'repair': {
        const repaired = Math.min(this.damage, 40);
        const remaining = this.damage ? (this.damage - repaired) / this.damage : 1;
        this.damage -= repaired;
        this.panelDamage = this.panelDamage.map(damage => damage * remaining);
        this.notify(repaired ? `REPAIRED ${repaired}% DAMAGE` : 'CAR IN TOP CONDITION');
        this.events.push('repair');
        break;
      }
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
    }
  }

  wreck(reason) {
    this.failure = reason;
    this.cleanTime = 0;
    this.damage = 100;
    this.speed = 0;
    this.boost = false;
    this.turboCoast = 0;
    this.wrecked = true;
    this.over = true;
    this.impact.fatal = true;
    this.events.push('crash', 'end');
  }

  resolveRoadContact(object, contact, motion, dt) {
    const {axis, sign, fraction} = contact;
    const shape = object.kind === 'work' ? WORK_SHAPE : VEHICLE_SHAPES[object.type];
    const closingSpeed = Math.abs((motion.player.to[axis] - motion.player.from[axis] -
      motion.object.to[axis] + motion.object.from[axis]) / dt);
    const force = Math.min(1, closingSpeed / (axis === 'x' ? 2.5 : 80));
    const side = axis === 'x' ? sign : Math.sign(this.steering.position - obstacleLane(object)) || 1;
    const separation = PLAYER_SHAPE[axis] + shape[axis] + .001;
    if (object.kind === 'work') {
      this.distance = motion.player.from.z + (this.distance - motion.player.from.z) * fraction;
      this.steering.position = motion.player.from.x + (this.steering.position - motion.player.from.x) * fraction;
      this.impact = {side, force: 1, age: 0, fatal: true};
      this.damageSide = -side;
      this.panelDamage[this.damageSide > 0 ? 1 : 0] = 100;
      this.wreck('barrier');
      return;
    }

    if (axis === 'x') {
      this.steering.position = Math.max(-ROAD_EDGE, Math.min(ROAD_EDGE, obstacleLane(object) + sign * separation));
      this.steering.velocity = sign * (.45 + force * .75);
      this.steerTarget = this.steering.position;
    } else {
      this.distance = object.z + sign * separation;
    }
    if (this.contacts.has(object)) return;
    object.shunt = axis === 'z' ? -sign * (9 + force * 22) : 0;
    object.deflectSpeed = axis === 'x' ? -sign * (.16 + force * .40) : 0;
    object.bump = {side: -side, force, age: 0};
    this.impact = {side, force: .38 + force * .62, age: 0, fatal: false};
    this.damageSide = -side;
    this.cleanTime = 0;
    const addedDamage = Math.round(axis === 'x' ? 8 + force * 14 : 17 + force * 25);
    this.damage = Math.min(100, this.damage + addedDamage);
    this.panelDamage[this.damageSide > 0 ? 1 : 0] += addedDamage;
    if (this.damage === 100) {
      this.wreck('breakdown');
      return;
    }
    this.spin = .17 + force * .24;
    this.speed *= axis === 'x' ? .96 - force * .08 : .78 - force * .17;
    this.boost = false;
    this.turboCoast = 0;
    this.time -= axis === 'x' ? 1 : 3;
    this.flow = 0;
    this.notify(`${axis === 'x' ? 'SIDESWIPE  −1s' : 'IMPACT  −3s'} · +${addedDamage}% DAMAGE`, 1.35);
    this.events.push('crash');
  }

  advanceTraffic(dt) {
    const vehicles = this.objects.filter(object => object.kind === 'hazard' && !object.wreck).sort((a, b) => b.z - a.z);
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
    for (const cue of this.objects) {
      if (cue.convoy && cue.kind === 'guide' && !convoys.has(cue.convoy)) {
        const center = cue.z + GUIDE_LEAD;
        convoys.set(cue.convoy, {front: center, tail: center});
      }
    }
    let precedingTail = Infinity;
    for (const [convoy, bounds] of [...convoys].sort((a, b) => b[1].front - a[1].front)) {
      const nearby = Math.max(0, Math.min(1, (360 - bounds.front + this.distance) / 220));
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
          lane < LANE_COUNT && lane !== vehicle.protectedLane && lane !== vehicle.protectedNext && lane !== vehicle.protectedExit && clearToMerge(vehicle, lane));
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
            lane >= 0 && lane < LANE_COUNT && lane !== vehicle.protectedLane && lane !== vehicle.protectedNext && lane !== vehicle.protectedExit &&
            !(lane === this.purple && toGate < 220 && toGate > 0) &&
            Math.abs(lanePosition(lane) - playerLane) > .16 && clearToMerge(vehicle, lane));
          if (lanes.length) vehicle.merge = {to: lanes[0], elapsed: 0};
        }
      }

      if (vehicle.convoy) continue;

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
    for (const item of this.objects) {
      if (item.wreck) continue;
      if (item.convoy) item.z += convoys.get(item.convoy)?.travel ?? 0;
      if (item.shunt) {
        item.z += item.shunt * dt;
        item.shunt *= Math.exp(-7 * dt);
      }
      if (item.deflectSpeed) {
        item.deflect = Math.max(-.09, Math.min(.09, (item.deflect ?? 0) + item.deflectSpeed * dt));
        item.deflectSpeed *= Math.exp(-6 * dt);
      }
    }
  }

  update(dt, accelerating, braking = false, turboHeld = false) {
    if (this.over) return;
    this.events = [];
    if (this.impact) this.impact.age += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.spin = Math.max(0, this.spin - dt);
    const wasBoosting = this.boost > 0;
    const burn = turboHeld && !this.stop && !this.spin ? Math.min(dt, this.turboFuel) : 0;
    this.boost = burn > 0;
    this.turboFuel = Math.max(0, this.turboFuel - burn);
    if (braking || this.boost || this.stop || this.spin) {
      this.turboCoast = 0;
    } else if (wasBoosting) {
      this.turboCoast = TURBO_COAST_SECONDS;
    } else {
      this.turboCoast = Math.max(0, this.turboCoast - dt);
    }
    this.turboKick = this.boost ? Math.max(0, this.turboKick - dt) : 0;
    if (this.boost && !wasBoosting) {
      this.turboKick = .48;
      if (!braking) this.speed = Math.max(this.speed, TOP_SPEED + 19 + this.cleanSpeedBonus);
      this.notify('TURBO ENGAGED', .65);
      this.events.push('boost');
    }
    this.time -= dt;

    const held = Math.min(dt, this.stop);
    if (this.passedPlaza) this.passedPlaza.waited += held;
    this.stop = Math.max(0, this.stop - dt);
    if (this.stop < 1e-9) this.stop = 0;
    const before = this.distance;
    const start = {x: this.steering.position, z: before};
    const solids = this.objects.filter(item => item.kind === 'hazard' || item.kind === 'work');
    const starts = new Map(solids.map(item => [item, {x: obstacleLane(item), z: item.z}]));
    if (!held) {
      const target = this.guidedSteering(this.steerTarget ?? lanePosition(this.lane));
      const response = this.steerTarget === null ? 17 :
        this.tollGuideLane !== null ? 20 : 16 - 2 * clamp(this.speed / (TURBO_SPEED + 30), 0, 1);
      this.steering = stepSteering(start.x, this.steering.velocity, target, dt, response);
      this.steering.position = Math.max(-ROAD_EDGE, Math.min(ROAD_EDGE, this.steering.position));
    }
    let gateLane = null;
    if (held) {
      this.flow = 0;
      this.speed = 0;
    } else {
      const target = braking ? (this.boost ? 49 : 38) : this.boost ? TURBO_SPEED : accelerating ? TOP_SPEED : CRUISE_SPEED;
      if (!this.spin && !this.stop) this.cleanTime += dt;
      const speedBonus = braking ? 0 : this.cleanSpeedBonus;
      const recoveringTarget = (target + speedBonus) * (1 - this.spin * .36);
      const drag = 3.2 - 2.65 * (this.turboCoast / TURBO_COAST_SECONDS);
      const response = braking ? 6.4 : this.boost ? 22 : this.speed > recoveringTarget ? drag : accelerating ? 7.5 : 6;
      this.speed += (recoveringTarget - this.speed) * (1 - Math.exp(-dt * response));
      this.distance += this.speed * dt;
      if (this.speed >= TOP_SPEED + speedBonus - 2 && !this.spin) {
        this.flow += dt;
        this.longest = Math.max(this.longest, this.flow);
        if (this.flow > 2) this.refunded += this.addTime(Math.min(dt * .8, Math.max(0, 90 - this.refunded)));
      } else {
        this.flow = 0;
      }
      if (!this.warned && this.plaza - this.distance < PLAZA_APPROACH) {
        this.warned = true;
        this.notify('ROADWORK AT TOLL · BRAKE AND WEAVE', 1.7);
      }
      const contactLane = laneAt(this.steering.position);
      const stopLine = this.plaza - (contactLane === this.purple ? 0 : 12);
      if (this.distance >= stopLine) {
        this.distance = stopLine;
        gateLane = contactLane;
      }
      if (this.passedPlaza && this.distance > this.passedPlaza.z + 65) this.passedPlaza = null;
      if (before < PRODUCTION_DISTANCE && this.distance >= PRODUCTION_DISTANCE) {
        this.notify('PRODUCTION REACHED · KEEP DRIVING');
      }
    }

    this.advanceTraffic(dt);
    const player = {from: start, to: {x: this.steering.position, z: this.distance}};
    const barriers = solids.filter(item => item.kind === 'work');
    const contacts = [];
    for (const item of solids) {
      const object = {from: starts.get(item), to: {x: obstacleLane(item), z: item.z}};
      const shape = item.kind === 'work' ? WORK_SHAPE : VEHICLE_SHAPES[item.type];
      if (item.kind === 'hazard' && !item.wreck) {
        for (const barrier of barriers) {
          const fixed = starts.get(barrier);
          const hit = sweep(object, {from: fixed, to: fixed}, shape, WORK_SHAPE);
          if (!hit) continue;
          item.z = object.from.z + (item.z - object.from.z) * hit.fraction;
          item.wreck = true;
          item.merge = null;
          item.deflect = object.from.x + (object.to.x - object.from.x) * hit.fraction - lanePosition(item.lane);
          item.bump = {side: hit.sign, force: 1, age: 0};
          object.to = {x: obstacleLane(item), z: item.z};
          break;
        }
      }
      if (item.bump) item.bump.age += dt;
      if (held) continue;
      const hit = sweep(player, object, PLAYER_SHAPE, shape);
      if (hit) contacts.push({item, hit, object});
    }
    contacts.sort((a, b) => a.hit.fraction - b.hit.fraction);
    // Resolve the first contact before committing a toll or crossing another body.
    const first = contacts[0];
    if (first) this.resolveRoadContact(first.item, first.hit, {player, object: first.object}, dt);
    this.contacts = new Set(first ? [first.item] : []);
    if (this.wrecked) return;
    if (gateLane !== null && this.distance >= this.plaza - (gateLane === this.purple ? 0 : 12)) this.passPlaza(gateLane);

    for (const object of this.objects) {
      if (held || this.stop || object.hit || object.kind === 'hazard' || object.kind === 'work' || object.kind === 'guide' ||
          object.z < before - 4 || object.z > this.distance + 4) continue;
      if (Math.abs(obstacleLane(object) - this.steering.position) <= .18) this.collect(object);
    }
    this.objects = this.objects.filter(object => object.z > this.distance - 45 && object.z < (object.guideLimit ?? Infinity));
    if (this.time <= 0) {
      this.time = 0;
      this.over = true;
      this.events.push('end');
    }
  }
}
