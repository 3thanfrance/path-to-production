import test from 'node:test';
import assert from 'node:assert/strict';
import {Run,rank,TOP_SPEED,TURBO_SPEED,DEADLINE_SECONDS,obstacleLane,lanePosition} from '../engine.js';
test('red booth holds for eight seconds and resumes without double charging',()=>{const r=new Run();r.lane=0;r.toll();assert.equal(r.stop,8);for(let i=0;i<480;i++)r.update(1/60,true);assert.ok(r.stop<1e-10);assert.ok(Math.abs(r.time-37)<1e-8);assert.equal(r.tollLost,8);r.update(.1,true);assert.ok(r.speed>0);});
test('purple lane refunds two seconds with zero stop and respects cap',()=>{const r=new Run();r.lane=r.purple;r.toll();assert.equal(r.time,47);assert.equal(r.stop,0);r.time=59;r.toll();assert.equal(r.time,60);});
test('purchase requires 15 brilliance, cannot stack, consumes on red only',()=>{const r=new Run();assert.equal(r.buy(),false);r.brilliance=30;assert.equal(r.buy(),true);assert.equal(r.brilliance,15);assert.equal(r.buy(),false);r.lane=r.purple;r.toll();assert.equal(r.pass,true);r.lane=0;r.toll();assert.equal(r.pass,false);assert.equal(r.stop,2);assert.equal(r.tollLost,2);});
test('flow refunds are capped and the clock eventually ends',()=>{const r=new Run(()=>.5);r.speed=TOP_SPEED;r.time=60;r.plaza=1e9;r.objects=[];for(let i=0;i<20000&&!r.over;i++)r.update(1/60,true);assert.equal(r.over,true);assert.equal(r.time,0);assert.ok(r.refunded<=90);assert.ok(r.longest>100);});
test('a turbo rear impact stops at the bumper and costs three seconds', () => {
  const run = new Run();
  run.speed = TURBO_SPEED;
  run.boost = 2;
  run.objects = [{kind: 'hazard', lane: 2, z: 42, type: 3}];
  run.update(.55, true);
  assert.ok(run.events.includes('crash'));
  assert.ok(run.distance <= run.objects[0].z - 4.4 / .27);
  assert.equal(run.boost, 0);
  assert.equal(run.time, 45 - .55 - 3);
});

test('continuous steering can hold a lane split and a barrier wreck ends the run', () => {
  const run = new Run();
  run.objects = [{kind: 'hazard', lane: 1, z: 62, type: 4}, {kind: 'work', lane: 3, z: 130}];
  run.steerBy(.20);
  while (run.distance < 85) {
    run.update(1 / 60, true);
    assert.ok(!run.events.includes('crash'));
  }
  assert.ok(Math.abs(run.steering.position - .20) < .001);
  run.steerBy(.20);
  while (!run.over && run.distance < 150) run.update(1 / 60, true);
  assert.equal(run.wrecked, true);
  assert.equal(run.speed, 0);
  assert.ok(run.distance < 130);
  assert.ok(run.time > 0);
});

test('a construction barrier stops and wrecks traffic at contact', () => {
  const run = new Run();
  const car = {kind: 'hazard', lane: 0, type: 3, z: 30};
  run.objects = [car, {kind: 'work', lane: 0, z: 70}];
  for (let tick = 0; tick < 120; tick++) run.update(1 / 60, true);
  assert.ok(car.wreck);
  assert.ok(car.z < 70);
});

test('rank boundaries',()=>{for(const [m,label] of [[399,'IDEATION'],[400,'BUILD'],[999,'BUILD'],[1000,'STAGED'],[2000,'PRODUCTION'],[3000,'CLEARED FOR PRODUCTION']])assert.equal(rank(m),label);});

test('five lanes are usable at the start and remain available after tolls', () => {
  const run = new Run(() => .2);
  for (let i = 0; i < 3; i++) run.move(-1);
  assert.equal(run.lane, 0);
  for (let i = 0; i < 6; i++) run.move(1);
  assert.equal(run.lane, 4);
  run.move(-1);
  while (!run.plazaIndex && !run.over) run.update(1 / 60, true);
  assert.equal(run.plazaIndex, 1);
  assert.equal(run.stop, 0);
  assert.equal(run.lane, 3);
  assert.ok(run.events.includes('toll'));
});

test('opening turbo accelerates the car and the deadline pickup adds six seconds', () => {
  const run = new Run();
  while (!run.boost && !run.over) run.update(1 / 60, false);
  assert.ok(run.events.includes('boost'));
  run.move(1);
  while (run.distance < 226 && !run.over) {
    const time = run.time;
    run.update(1 / 60, false);
    if (run.events.includes('deadline')) {
      assert.ok(Math.abs(run.time - (time + DEADLINE_SECONDS - 1 / 60)) < .001);
    }
  }
  assert.ok(run.events.includes('deadline'));
  assert.ok(run.speed > TOP_SPEED && run.speed <= TURBO_SPEED);
});

test('procedural obstacle rows leave two lanes open and keep a continuous pickup route', () => {
  const run = new Run(() => .63);
  const previous = run.plaza;
  const rows = run.objects.filter(item => item.z > previous);
  let lane = run.purple;
  for (const pickup of rows.filter(item => item.kind !== 'hazard' && rows.some(h => h.kind === 'hazard' && h.z === item.z))) {
    const blockers = rows.filter(item => item.kind === 'hazard' && item.z === pickup.z);
    assert.ok(blockers.length <= 3);
    assert.ok(!blockers.some(item => item.lane === pickup.lane));
    assert.ok(Math.abs(pickup.lane - lane) <= 1);
    lane = pickup.lane;
  }
  assert.ok(rows.filter(item => item.kind === 'hazard').length <= 8);
});

test('a closed toll stops at a fixed line, then remains behind the car as it leaves', () => {
  const run = new Run();
  const gate = run.plaza;
  while (!run.stop && !run.over) run.update(1 / 60, true);
  assert.equal(run.distance, gate - 12);
  assert.equal(run.passedPlaza.z, gate);
  assert.equal(run.passedPlaza.stoppedLane, run.lane);
  for (let i = 0; i < 480; i++) run.update(1 / 60, true);
  assert.equal(run.distance, gate - 12);
  assert.equal(run.passedPlaza.z, gate);
  while (run.distance <= gate && !run.over) run.update(1 / 60, true);
  assert.equal(run.passedPlaza.z, gate);
  assert.equal(run.lane, 2);
});

test('vehicles keep moving through tolls at different speeds below cruise', () => {
  const run = new Run();
  run.distance = run.plaza - 25;
  run.objects = [{kind: 'hazard', type: 0, lane: 0, z: run.plaza - 2},
    {kind: 'hazard', type: 3, lane: 4, z: run.plaza - 2}];
  const origin = run.objects[0].z;
  run.update(1, false, true);
  assert.equal(run.objects[0].z - origin, 22);
  assert.equal(run.objects[1].z - origin, 40);
});

test('post-toll traffic is already present before crossing and stays inside its lane', () => {
  const run = new Run(() => .63);
  const gate = run.plaza;
  const firstObstacle = run.objects.find(item => item.kind === 'hazard' && item.z > gate);
  assert.ok(firstObstacle);
  const firstRow = run.objects.filter(item => item.kind === 'hazard' && item.z === firstObstacle.z);
  assert.equal(new Set(firstRow.map(item => item.type)).size, firstRow.length);
  const initialZ = firstObstacle.z;
  run.move(1);
  while (!run.plazaIndex && !run.over) run.update(1 / 60, true);
  assert.equal(run.stop, 0);
  assert.ok(run.objects.includes(firstObstacle));
  assert.ok(firstObstacle.z > initialZ);
});

test('steering builds lateral speed before settling and follows the same path across frame rates', () => {
  const runs = [60, 120].map(rate => {
    const run = new Run(() => .4);
    run.move(1);
    run.update(1 / rate, false);
    assert.ok(run.steering.position > 0 && run.steering.position < .1);
    assert.ok(run.steering.velocity > 0);
    for (let i = 1; i < rate / 2; i++) run.update(1 / rate, false);
    assert.ok(Math.abs(run.steering.position - .4) < .002);
    return run;
  });
  assert.ok(Math.abs(runs[0].steering.position - runs[1].steering.position) < 1e-6);
});


test('later traffic uses only standard vehicles', () => {
  const run = new Run(() => .52);
  run.objects = [];
  run.queueTraffic(5000, 9, 2);
  const hazards = run.objects.filter(item => item.kind === 'hazard');
  assert.ok(hazards.length <= 12);
  assert.ok(hazards.every(item => item.type >= 0 && item.type <= 5));
});

test('a sideswipe registers while recovering from a previous impact', () => {
  const run = new Run();
  run.spin = .6;
  run.speed = 40;
  run.objects = [{kind: 'hazard', type: 4, lane: 3, z: 8}];
  run.steerBy(.4);
  for (let tick = 0; tick < 15; tick++) {
    run.update(1 / 60, true);
    if (run.events.includes('crash')) break;
  }
  assert.ok(run.events.includes('crash'));
  assert.match(run.message, /SIDESWIPE/);
  assert.ok(run.steering.velocity < 0);
});

test('a merge signals before crossing and respects both a nearby vehicle and the convoy gap', () => {
  const run = new Run();
  run.distance = 500;
  const car = {kind: 'hazard', type: 3, lane: 4, z: 665, mergeEligible: true, protectedLane: 1};
  const blocker = {kind: 'hazard', type: 0, lane: 3, z: 681};
  run.objects = [car, blocker];
  run.advanceTraffic(.05);
  assert.equal(car.merge, undefined);
  run.objects = [car];
  car.mergeEligible = true;
  run.advanceTraffic(.05);
  assert.equal(car.merge.to, 3);
  assert.equal(obstacleLane(car), lanePosition(4));
  for (let i = 0; i < 30; i++) run.advanceTraffic(.05);
  assert.equal(car.lane, 3);
  assert.equal(car.merge, null);
  car.mergeEligible = true;
  car.protectedLane = 2;
  run.distance = car.z - 160;
  run.objects.push({kind: 'hazard', type: 0, lane: 4, z: car.z + 10});
  run.advanceTraffic(.05);
  assert.equal(car.merge, null);
});

test('faster traffic preserves headway behind slower trucks', () => {
  const run = new Run();
  const truck = {kind: 'hazard', type: 0, lane: 1, z: 100};
  const car = {kind: 'hazard', type: 3, lane: 1, z: 73};
  run.objects = [car, truck];
  for (let i = 0; i < 80; i++) {
    const last = car.z;
    run.advanceTraffic(.05);
    assert.ok(car.z > last);
    assert.ok(truck.z - car.z >= 22 - 1e-9);
  }
});


test('moving gaps change lanes and convoys maintain room to steer at turbo speed', () => {
  let seed = 41;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const run = new Run(random);
  run.objects = [];
  run.queueTraffic(510, 8, 2);
  const traffic = run.objects.filter(item => item.kind === 'hazard');
  const groups = [...new Set(traffic.map(vehicle => vehicle.convoy))]
    .map(convoy => traffic.filter(vehicle => vehicle.convoy === convoy));
  assert.ok(traffic.some(vehicle => vehicle.lane === 2));
  assert.ok(new Set(traffic.map(vehicle => vehicle.protectedLane)).size > 1);
  for (let tick = 0; tick < 240; tick++) {
    run.distance += TURBO_SPEED / 60;
    run.advanceTraffic(1 / 60);
    for (const group of groups) {
      assert.ok(group.every(vehicle => vehicle.lane !== vehicle.protectedLane));
    }
    for (let index = 1; index < groups.length; index++) {
      const front = Math.max(...groups[index - 1].map(vehicle => vehicle.z));
      const tail = Math.min(...groups[index].map(vehicle => vehicle.z));
      assert.ok(tail - front >= 37 - 1e-8);
    }
  }
});

test('following the moving pickup trail chains boosts and purple tolls without a crash', () => {
  for (const accelerate of [false, true]) {
    for (let start = 1; start <= 32; start++) {
      let seed = start;
      const run = new Run(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32));
      let boosts = 0;
      const dt = 1 / (start % 2 ? 30 : 60);
      for (let tick = 0; run.plazaIndex < 9 && tick < 120 / dt && !run.over; tick++) {
        // Follow the next visible marker, with one ordinary lane input per turn.
        const cue = run.objects.filter(item => item.kind !== 'hazard' && item.kind !== 'work' && !item.hit &&
          item.z >= run.distance - 4).sort((a, b) => a.z - b.z)[0];
        if (run.plaza - run.distance <= 36) {
          run.move(Math.sign(run.purple - run.lane));
        } else if (cue && cue.z < run.plaza && cue.z - run.distance <= 21 + start % 5) {
          run.move(Math.sign(cue.lane - run.lane));
        }
        run.update(dt, accelerate);
        assert.ok(!run.events.includes('crash'), `seed ${start}, throttle ${accelerate}, crash at ${run.distance}`);
        assert.equal(run.stop, 0, `seed ${start}, toll at ${run.distance}`);
        const missed = run.objects.find(item => ['boost', 'gem', 'deadline'].includes(item.kind) && !item.hit && item.z < run.distance - 5);
        assert.equal(missed, undefined, `seed ${start}, missed ${missed?.kind} at ${missed?.z}`);
        boosts += Number(run.events.includes('boost'));
      }
      assert.equal(run.plazaIndex, 9);
      assert.equal(boosts, 9);
    }
  }
});

test('full-speed steering allows small corrections, sustained turns and shoulder recovery', () => {
  const run = new Run();
  run.objects = [];
  run.speed = TURBO_SPEED;
  run.boost = 3;
  const dt = 1 / 60;
  run.steerBy(.035);
  for (let tick = 0; tick < 18; tick++) run.update(dt, true);
  assert.ok(run.steering.position > .025 && run.steering.position < .045);

  for (let tick = 0; tick < 17; tick++) {
    run.steerWithKeys(1, tick * dt, dt);
    run.update(dt, true);
  }
  for (let tick = 0; tick < 16; tick++) run.update(dt, true);
  assert.ok(run.steering.position > .28 && run.steering.position < .42);

  run.steerBy(-4);
  for (let tick = 0; tick < 38; tick++) run.update(dt, true);
  assert.ok(run.steering.position > -.861 && run.steering.position < -.82);
  run.steerBy(.10);
  for (let tick = 0; tick < 20; tick++) run.update(dt, true);
  assert.ok(run.steering.position > -.80);
  assert.ok(!run.wrecked);
});

test('toll assist centers the selected lane and yields to a deliberate lane change', () => {
  for (const turn of [false, true]) {
    const run = new Run();
    run.objects = [];
    run.distance = run.plaza - 78;
    run.speed = TURBO_SPEED;
    run.boost = 2;
    run.steering.position = turn ? 0 : .51;
    run.steerBy(.005);
    const dt = 1 / 60;
    for (let tick = 0; !run.plazaIndex && tick < 70; tick++) {
      if (turn && tick < 22) run.steerWithKeys(1, tick * dt, dt);
      run.update(dt, true);
    }
    assert.equal(run.plazaIndex, 1);
    assert.equal(run.stop, 0);
    assert.ok(Math.abs(run.steering.position - lanePosition(3)) < .035);
  }
});

test('distinct hard hits accumulate damage until the car breaks down', () => {
  const run = new Run();
  const crash = () => {
    run.speed = TURBO_SPEED;
    run.boost = 2;
    run.objects = [{kind: 'hazard', type: 3, lane: 2, z: run.distance + 19}];
    run.update(.05, true);
    assert.ok(run.events.includes('crash'));
  };
  crash();
  assert.ok(run.damage > 20 && run.damage < 50);
  assert.ok(!run.over);
  const firstDamage = run.damage;
  crash();
  assert.ok(run.damage > firstDamage && run.damage < 100);
  crash();
  assert.equal(run.damage, 100);
  assert.equal(run.failure, 'breakdown');
  assert.equal(run.over, true);
  assert.equal(run.speed, 0);
  assert.ok(run.time > 0);
  assert.equal(new Run().damage, 0);
});
