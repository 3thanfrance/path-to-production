import test from 'node:test';
import assert from 'node:assert/strict';
import {Run,rank,TOP_SPEED,TURBO_SPEED,DEADLINE_SECONDS,obstacleLane,lanePosition} from '../engine.js';
test('red booth holds for eight seconds and resumes without double charging',()=>{const r=new Run();r.lane=0;r.toll();assert.equal(r.stop,8);for(let i=0;i<480;i++)r.update(1/60,true);assert.ok(r.stop<1e-10);assert.ok(Math.abs(r.time-37)<1e-8);assert.equal(r.tollLost,8);r.update(.1,true);assert.ok(r.speed>0);});
test('purple lane refunds two seconds with zero stop and respects cap',()=>{const r=new Run();r.lane=r.purple;r.toll();assert.equal(r.time,47);assert.equal(r.stop,0);r.time=59;r.toll();assert.equal(r.time,60);});
test('purchase requires 15 brilliance, cannot stack, consumes on red only',()=>{const r=new Run();assert.equal(r.buy(),false);r.brilliance=30;assert.equal(r.buy(),true);assert.equal(r.brilliance,15);assert.equal(r.buy(),false);r.lane=r.purple;r.toll();assert.equal(r.pass,true);r.lane=0;r.toll();assert.equal(r.pass,false);assert.equal(r.stop,2);assert.equal(r.tollLost,2);});
test('flow refunds are capped and the clock eventually ends',()=>{const r=new Run(()=>.5);r.speed=TOP_SPEED;r.time=60;r.plaza=1e9;r.objects=[];for(let i=0;i<20000&&!r.over;i++)r.update(1/60,true);assert.equal(r.over,true);assert.equal(r.time,0);assert.ok(r.refunded<=90);assert.ok(r.longest>100);});
test('hazards charge three seconds; coins and gems collect',()=>{const r=new Run();r.objects=[{kind:'hazard',lane:2,z:0,type:0},{kind:'gem',lane:2,z:0},{kind:'coin',lane:2,z:0}];r.update(.01,true);assert.ok(Math.abs(r.time-41.99)<.0001);assert.equal(r.brilliance,3);assert.equal(r.coins,1);assert.ok(r.spin>0);});
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
  assert.equal(run.coins, 5);
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
  assert.ok(rows.filter(item => item.kind === 'hazard').length >= 12);
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
  assert.equal(run.objects[0].z - origin, 25);
  assert.equal(run.objects[1].z - origin, 41);
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


test('later stretches add rows and confine bug sweeps to lanes away from the pickup route', () => {
  for (const random of [.02, .25, .52, .77, .98]) {
    const run = new Run(() => random);
    run.objects = [];
    run.queueTraffic(5000, 9, 2);
    const rows = new Set(run.objects.filter(item => item.kind === 'hazard').map(item => item.z));
    assert.equal(rows.size, 8);
    const bugs = run.objects.filter(item => item.type === 6);
    assert.equal(bugs.length, 2);
    for (const bug of bugs) {
      const pickup = run.objects.find(item => item.kind !== 'hazard' && item.z === bug.z);
      assert.ok(pickup.lane < bug.lane || pickup.lane > bug.sweepTo);
      assert.equal(obstacleLane({...bug, phase: .2}), lanePosition(bug.lane));
      assert.equal(obstacleLane({...bug, phase: 1.4}), lanePosition(bug.sweepTo));
    }
  }
});
