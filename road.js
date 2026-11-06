import { BRAND, lanePosition } from './engine.js';

const TRAFFIC = [
  { label: ['TECHNICAL', 'DEBT'], colors: ['#edac61', '#965022', '#291132'] },
  { label: ['LEGACY', 'STACK'], colors: ['#50ddff', '#1744aa', '#100c42'] },
  { label: ['ONE-OFF', 'BUILD'], colors: ['#ff96db', '#b33280', '#300e40'] },
  { label: ['STATUS', 'QUO'], colors: ['#8ef8ff', '#217bd6', '#140e45'] },
];

const ATTRACT_TRAFFIC = [
  { kind: 'hazard', type: 0, lane: 0, z: 27 },
  { kind: 'hazard', type: 1, lane: 2, z: 19 },
  { kind: 'hazard', type: 3, lane: 1, z: 75 },
  ...[4, 13, 24, 37, 51].map((z, index) => ({
    kind: 'coin', lane: 1, offset: 0.54 - index * 0.1, z,
  })),
];

export function createRoad(ctx) {
  let width, height, horizon, center, roadHalf, near, sky;

  function gradient(x1, y1, x2, y2, colors) {
    const paint = ctx.createLinearGradient(x1, y1, x2, y2);
    colors.forEach((color, index) => paint.addColorStop(index / (colors.length - 1), color));
    return paint;
  }

  function shape(points, paint, outline, stroke = 1) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = paint;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = stroke;
      ctx.stroke();
    }
  }

  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function box(x, y, w, h, r, paint, stroke, weight = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = paint;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = weight;
      ctx.stroke();
    }
  }

  function ellipse(x, y, rx, ry, paint) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = paint;
    ctx.fill();
  }

  function project(depth, lane = 0) {
    const scale = near / (near + depth);
    return { x: center + roadHalf * lane * scale, y: horizon + (height * .89 - horizon) * scale, scale };
  }

  function palm(x, y, size, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.strokeStyle = '#281050';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-5, -35, lean, -84);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI + i * Math.PI / 9;
      const endX = lean + Math.cos(angle) * (25 + i % 3 * 4);
      const endY = -73 + Math.sin(angle) * 22;
      ctx.beginPath();
      ctx.moveTo(lean, -84);
      ctx.quadraticCurveTo((lean + endX) / 2, endY - 12, endX, endY);
      ctx.lineWidth = i % 2 ? 2.8 : 3.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintSky() {
    ctx.fillStyle = gradient(0, 0, 0, horizon, ['#16047a', '#8d07bc', '#f70c64', '#ff5112', '#ff8c06']);
    ctx.fillRect(0, 0, width, height);
    const sunY = horizon * .62;
    const sunRadius = Math.min(width * .112, height * .19);
    const halo = ctx.createRadialGradient(center, sunY, sunRadius * .55, center, sunY, sunRadius * 2.1);
    halo.addColorStop(0, '#ffac33cc');
    halo.addColorStop(1, '#ff760000');
    ellipse(center, sunY, sunRadius * 2.1, sunRadius * 2.1, halo);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, sunY, sunRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = gradient(0, sunY - sunRadius, 0, sunY + sunRadius, ['#fff653', '#ffca07', '#ff770b']);
    ctx.fillRect(center - sunRadius, sunY - sunRadius, 2 * sunRadius, 2 * sunRadius);
    ctx.fillStyle = '#fe430f';
    for (let stripe = 0; stripe < 6; stripe++) {
      ctx.fillRect(center - sunRadius, sunY + stripe * sunRadius * .16, sunRadius * 2, 2 + stripe * 1.2);
    }
    ctx.restore();

    for (let i = 0; i < 17; i++) {
      const x = width * ((i * .38197) % 1);
      if (Math.abs(x - center) < sunRadius * 1.18) continue;
      const y = horizon * (.24 + (i % 7) * .085);
      const span = width * (.023 + i % 4 * .014);
      shape([[x - span, y], [x - span * .25, y - 3], [x, y - 9], [x + span * .25, y - 3], [x + span, y + 1]], '#ffac3f55');
      line(x - span * .8, y + 4, x + span, y + 4, '#fcaa5255');
    }

    for (let layer = 0; layer < 2; layer++) {
      const ridge = [[0, horizon + 10]];
      for (let i = 0; i <= 32; i++) {
        const x = width * i / 32;
        const valley = Math.min(1, Math.abs(x - center) / (width * .38));
        const peaks = Math.abs(Math.sin(i * .87 + layer * 3)) * .7 + Math.abs(Math.cos(i * 1.9)) * .3;
        ridge.push([x, horizon - valley * peaks * height * (.11 - layer * .035) + layer * height * .017]);
      }
      ridge.push([width, horizon + 32], [0, horizon + 32]);
      shape(ridge, gradient(0, horizon - height * .11, 0, horizon + 22,
        layer ? ['#bd1186', '#4e0d9d', '#270d71'] : ['#ff5330', '#d91b95', '#650aab']));
    }
    const palmScale = Math.min(height / 620, width / 660);
    for (const [offset, size, lean] of [[.047, 1.16, 8], [.115, .8, -9], [.181, .43, 8], [.825, .49, -9], [.894, 1.14, -7], [.959, .85, 9]]) {
      palm(width * offset, horizon + height * .045, size * palmScale, lean);
    }
  }

  function resize(w, h) {
    width = w;
    height = h;
    center = w / 2;
    horizon = h * (w < 620 ? .39 : .38);
    roadHalf = w * .465;
    near = 94;
    // The sky stays in screen space. Cache it so the track can animate independently.
    sky = document.createElement('canvas');
    sky.width = Math.ceil(w);
    sky.height = Math.ceil(h);
    const display = ctx;
    ctx = sky.getContext('2d');
    paintSky();
    ctx = display;
  }

  function paintTrack(distance, lanes, plaza, purple) {
    const end = project(-near * .23);
    const shoulder = gradient(0, horizon, 0, height, ['#5c0c83', '#27056b', '#090838']);
    ctx.fillStyle = shoulder;
    ctx.fillRect(0, horizon + height * .045, width, height);
    for (let i = -11; i <= 11; i++) {
      line(center + i * 2, horizon, center + i * width * .16, height, '#ca1bff55');
    }
    for (let depth = -24 - distance % 17; depth < 400; depth += 17) {
      if (depth < -24) continue;
      const { y, scale } = project(depth);
      line(0, y, width, y, '#9f22eb90', Math.max(.65, scale * 1.5));
    }

    const left = center - roadHalf * end.scale;
    const right = center + roadHalf * end.scale;
    shape([[center, horizon], [right, end.y], [left, end.y]], gradient(0, horizon, 0, height,
      ['#5f1d80', '#202780', '#111c5c', '#09163a']));
    for (const side of [-1, 1]) {
      const edge = project(-near * .23, side);
      line(center, horizon, edge.x, edge.y, '#db22fa65', 16);
      line(center, horizon, edge.x, edge.y, '#f731e9', 4);
      line(center, horizon, edge.x, edge.y, '#ffb0fa', 1.4);
    }
    for (let i = 1; i < lanes; i++) {
      const lane = -1 + 2 * i / lanes;
      const bottom = project(-near * .23, lane);
      line(center, horizon, bottom.x, bottom.y, '#a376ff62', 2);
      for (let depth = -24 - distance % 24; depth < 480; depth += 24) {
        const start = project(Math.max(-24, depth), lane);
        const end = project(depth + 12, lane);
        if (depth + 12 < -24) continue;
        line(start.x, start.y, end.x, end.y, '#9e66ff', 6 * start.scale);
        line(start.x, start.y, end.x, end.y, '#fff2ff', 3.7 * start.scale);
      }
    }
    if (lanes === 5 && plaza > 0) {
      const lane = lanePosition(purple, 5);
      for (let z = 10; z < plaza; z += 30) {
        const p = project(z, lane);
        shape([[p.x, p.y - 9 * p.scale], [p.x - 8 * p.scale, p.y], [p.x, p.y - 3 * p.scale], [p.x + 8 * p.scale, p.y]], '#c768ffb0');
      }
    }
  }

  function glow(x, y, radius, core, outer) {
    const paint = ctx.createRadialGradient(x, y, 0, x, y, radius);
    paint.addColorStop(0, core);
    paint.addColorStop(.28, outer);
    paint.addColorStop(1, '#ff800000');
    ellipse(x, y, radius, radius, paint);
  }

  function sign(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    line(70, 32, 70, 117, '#384248', 8);
    box(-99, -32, 198, 65, 8, gradient(0, -32, 0, 33, ['#16642b', '#07301e']), '#9bff5e', 2.5);
    box(-94, -27, 188, 55, 6, '#ffffff06', '#e4ffd28a');
    ctx.fillStyle = '#f4ffdd';
    ctx.font = '800 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRODUCTION', 16, -3);
    ctx.font = '800 18px monospace';
    ctx.fillText('1 MILE', 16, 20);
    shape([[-73, -18], [-61, -2], [-68, -2], [-68, 17], [-78, 17], [-78, -2], [-85, -2]], '#f4ffdd');
    ctx.restore();
  }

  function octopusMark() {
    ctx.strokeStyle = '#fff1ff';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * 3.1;
      ctx.beginPath();
      ctx.moveTo(x * .54, 6);
      ctx.quadraticCurveTo(x * .85, 16, x * 1.42, 12 - Math.abs(x) * .47);
      ctx.stroke();
    }
    ellipse(0, -1, 9, 12, '#fff1ff');
    ellipse(-3, -2, 1.35, 1.2, '#7c12db');
    ellipse(3, -2, 1.35, 1.2, '#7c12db');
  }

  function plaza(depth, openLane, usedPass, animateBarrier) {
    const p = project(depth);
    const unit = roadHalf * 2 * p.scale / 5;
    const tall = Math.min(unit * 1.3, height * .33 * p.scale + unit * .44);
    if (unit < 6) return;
    if (unit > 20) sign(center + unit * 1.52, p.y - tall * 1.13, unit / 103);
    for (let lane = 0; lane <= 5; lane++) {
      const x = center + (lane - 2.5) * unit;
      ellipse(x, p.y, unit * .19, tall * .061, '#f19cff8f');
      box(x - unit * .14, p.y - tall * .78, unit * .28, tall * .79, unit * .09,
        gradient(x - unit * .14, 0, x + unit * .14, 0, ['#080c3b', '#313b9d', '#652b8e', '#100c35']), '#ac75dd', Math.max(.5, unit * .012));
      for (let lamp = 0; lamp < 3; lamp++) {
        const y = p.y - tall * (.12 + lamp * .17);
        glow(x, y, unit * .12, '#fffed1', '#ff8d02d8');
      }
      line(x - unit * .17, p.y, x + unit * .17, p.y, '#ffc6ff', Math.max(1, unit * .022));
    }
    for (let lane = 0; lane < 5; lane++) {
      const x = center + (lane - 2) * unit;
      const open = lane === openLane;
      const roofY = p.y - tall;
      const neon = open ? BRAND.chainguardPurple : '#ff492b';
      shape([[x - unit * .53, roofY + tall * .22], [x, roofY], [x + unit * .53, roofY + tall * .22],
        [x + unit * .5, roofY + tall * .31], [x - unit * .5, roofY + tall * .31]],
        gradient(0, roofY, 0, roofY + tall * .3, ['#9e4bff', '#282274', '#171042']), '#9a70ee', Math.max(1, unit * .021));
      line(x - unit * .43, roofY + tall * .22, x + unit * .43, roofY + tall * .22, '#df73ff');
      const panelY = roofY + tall * .24;
      box(x - unit * .411, panelY, unit * .822, tall * .35, unit * .085, '#100a29', neon, Math.max(1, unit * .026));
      box(x - unit * .378, panelY + tall * .026, unit * .756, tall * .29, unit * .06,
        gradient(0, panelY, 0, panelY + tall * .35, open
          ? ['#8c17ee', '#5904aa', '#2c105e'] : ['#ff4925', '#e51222', '#770923']));
      if (open) {
        ctx.save();
        ctx.translate(x, panelY + tall * .16);
        ctx.scale(unit / 70, unit / 70);
        octopusMark();
        ctx.restore();
      }
      const markY = panelY + tall * .33;
      const mark = Math.max(2, unit * .074);
      ellipse(x, markY, mark * 1.55, mark * 1.22, open ? '#094937' : '#770919');
      ctx.strokeStyle = open ? '#aaffda' : '#fff7ee';
      ctx.lineWidth = Math.max(1, mark * .25);
      ctx.beginPath();
      if (open) {
        ctx.moveTo(x, markY - mark * .65);
        ctx.lineTo(x, markY + mark * .62);
        ctx.moveTo(x - mark * .61, markY);
        ctx.lineTo(x, markY + mark * .62);
        ctx.lineTo(x + mark * .61, markY);
      } else {
        ctx.moveTo(x - mark * .52, markY - mark * .52);
        ctx.lineTo(x + mark * .52, markY + mark * .52);
        ctx.moveTo(x + mark * .52, markY - mark * .52);
        ctx.lineTo(x - mark * .52, markY + mark * .52);
      }
      ctx.stroke();

      const pivotX = x - unit * .39;
      const pivotY = p.y - tall * .16;
      const drop = animateBarrier ? Math.min(1, animateBarrier * 4) : 1;
      const rise = open || lane === usedPass ? tall * .27 : tall * .17 * (1 - drop);
      const arm = unit * .78;
      line(pivotX, pivotY, pivotX + arm, pivotY - rise, open ? '#ad00ff' : '#e30e2d', unit * .084);
      line(pivotX, pivotY, pivotX + arm, pivotY - rise, '#fff0ec', unit * .038);
      for (let i = 1; i < 10; i++) {
        const along = i / 10;
        const px = pivotX + arm * along;
        const py = pivotY - rise * along;
        line(px - unit * .016, py + unit * .02, px + unit * .016, py - unit * .02, neon, unit * .023);
      }
      glow(x, roofY + tall * .17, unit * .12, '#fff4dc', open ? '#f086ffee' : '#ff8a0bd9');
    }
  }

  function wheel(x, y, w, h) {
    box(x, y, w, h, 7, '#05091e', '#303263', 2);
    line(x + w * .33, y + 4, x + w * .33, y + h - 4, '#474166');
  }

  function coupe(x, y, scale, paint, player, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);
    ellipse(0, -2, 75, 12, '#030518ad');
    wheel(-70, -29, 24, 34);
    wheel(46, -29, 24, 34);
    const [light, body, dark] = paint;
    shape([[-68, -6], [-74, -34], [-65, -59], [-49, -71], [-39, -91], [40, -91],
      [53, -70], [66, -57], [74, -35], [68, -8], [43, 0], [-46, 0]],
      gradient(0, -91, 0, 0, [light, body, dark, body]), '#230a31', 3);
    shape([[-51, -69], [-38, -89], [39, -89], [52, -69], [43, -63], [-43, -63]], light);
    shape([[-43, -65], [-33, -81], [33, -81], [43, -65], [38, -49], [-38, -49]],
      gradient(0, -81, 0, -49, ['#070b29', '#12487a', '#1b2c62']), '#15102d', 3);
    line(-27, -78, 19, -78, '#98d2f8a0', 1.5);
    shape([[-68, -39], [-43, -47], [43, -47], [68, -39], [67, -14], [48, -7], [-47, -7], [-67, -14]],
      gradient(0, -47, 0, -7, [light, body, dark]), '#571332', 1.4);
    if (player) {
      shape([[-10, -90], [10, -90], [15, -81], [-15, -81]], '#fff0d2');
      shape([[-12, -48], [12, -48], [17, -6], [-17, -6]], gradient(0, -48, 0, -6, ['#fff5d4', '#fbdedc', '#c493b6']));
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#170c20';
      ctx.fillText('42', 0, -81.8);
    }
    for (const side of [-1, 1]) {
      const cx = side * 49;
      ellipse(side * 65, -57, 7, 3, '#41334e');
      box(cx - 16, -34, 32, 15, 7, '#760a16', '#2d0624', 2);
      for (const offset of [-7, 7]) glow(cx + offset, -27, 11, '#fff2a4', '#ff370be6');
      ellipse(side * 48, -4, 9, 5, '#0d0f21');
      ellipse(side * 48, -4, 5, 3, '#75688a');
    }
    box(-17, -24, 34, 8, 2, '#1a1224', '#81444f');
    ctx.restore();
  }

  function truck(x, y, scale, type, side) {
    const { label, colors: [light, body, dark] } = TRAFFIC[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const sideWidth = -side * 35;
    ellipse(sideWidth * .4, -1, 74, 12, '#02051ba6');
    for (const wheelX of [-50, 33, sideWidth - 10]) wheel(wheelX, -27, 19, 31);
    shape([[-56, -96], [-56 + sideWidth, -115], [56 + sideWidth, -115], [56, -96]], light, '#1e1132', 2);
    const edge = sideWidth > 0 ? 56 : -56;
    shape([[edge, -96], [edge + sideWidth, -115], [edge + sideWidth, -37], [edge, -15]],
      gradient(edge, 0, edge + sideWidth, 0, [body, light, dark]), '#220b2d', 2);
    box(-56, -96, 112, 79, 5, gradient(-56, -96, 56, -17, [light, body, dark]), '#24112d', 3);
    for (let i = -5; i <= 5; i++) line(i * 9, -92, i * 9, -21, '#fce5c225', 1.1);
    line(0, -94, 0, -20, '#211230', 2);
    box(-54, -21, 108, 17, 4, '#231530', '#8c6795', 2);
    for (const lightX of [-43, 43]) glow(lightX, -13, 11, '#ffefab', '#ff2906ee');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff4df';
    ctx.strokeStyle = '#201029';
    ctx.lineWidth = 3;
    ctx.font = '900 14px Arial';
    label.forEach((word, index) => {
      ctx.strokeText(word, 0, -65 + index * 17, 104);
      ctx.fillText(word, 0, -65 + index * 17, 104);
    });
    ctx.restore();
  }

  function item(object, distance, now, cinematic) {
    const z = object.z - distance;
    if (z < -7 || z > 450 || object.hit) return;
    const lane = object.offset ?? lanePosition(object.lane, object.lanes ?? 3);
    const { x, y, scale } = project(z, lane);
    const vehicleScale = Math.min(width / 700, height / 570) * scale;
    if (object.kind === 'hazard') {
      if (object.type === 3) {
        coupe(x, y, vehicleScale * .64, TRAFFIC[3].colors, false);
        if (!cinematic && scale > .43) {
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e0f5ff';
          ctx.fillText('STATUS QUO', x, y - 68 * vehicleScale);
        }
      } else {
        truck(x, y, vehicleScale * (cinematic ? 1.24 : 1.04), object.type, Math.sign(lane) || 1);
      }
      return;
    }

    const size = Math.min(width / 660, height / 530) * scale;
    const floatY = y - (19 + Math.sin(now * .005 + z / 10) * 3) * size;
    if (object.kind === 'coin') {
      const r = 12 * size;
      ellipse(x, y, r * 1.3, r * .26, '#ffc4395c');
      glow(x, floatY, r * 2, '#fffbb1', '#ffa409c9');
      ellipse(x, floatY, r * .73, r, '#ff8b00');
      ellipse(x, floatY, r * .56, r * .85, '#ffe95d');
      ellipse(x, floatY, r * .42, r * .72, '#ffae07');
      line(x, floatY - r * .47, x, floatY + r * .47, '#ffdf50', r * .13);
    } else {
      const r = 15 * size;
      glow(x, floatY, r * 1.8, '#f8d9ff', '#c63df4d7');
      shape([[x, floatY - r], [x + r * .7, floatY], [x, floatY + r], [x - r * .7, floatY]],
        gradient(x - r, floatY - r, x + r, floatY + r, ['#fff2ff', '#c86bff', '#7a04d8']), '#ffdfff', Math.max(1, size));
    }
  }

  function draw(run, mode, distance, visualLane, now) {
    const cinematic = mode === 'intro';
    const remaining = run.plaza - run.distance;
    roadHalf = width * (cinematic ? .61 : .465);
    const depth = cinematic ? 83 : run.stop ? 0 : remaining;
    const openLane = cinematic ? 3 : run.purple;
    const laneCount = cinematic ? 5 : run.lanes;
    ctx.drawImage(sky, 0, 0, width, height);
    paintTrack(distance, laneCount, depth, openLane);
    const objects = cinematic ? ATTRACT_TRAFFIC : run.objects;
    const objectDistance = cinematic ? 0 : run.distance;
    const sorted = [...objects].sort((a, b) => b.z - a.z);
    for (const object of sorted) {
      if (object.z - objectDistance > depth) item(object, objectDistance, now, cinematic);
    }
    if (depth < 455) {
      const passLane = run.stop && run.stopTotal === 2 ? run.lane : -1;
      const barrierElapsed = run.stop ? run.stopTotal - run.stop : 0;
      plaza(depth, openLane, passLane, barrierElapsed);
    }
    for (const object of sorted) {
      if (object.z - objectDistance <= depth) item(object, objectDistance, now, cinematic);
    }
    const car = project(0, cinematic ? 0 : visualLane);
    const scale = Math.min(width / 685, height / 520);
    coupe(car.x, car.y - (cinematic ? height * .022 : 0), scale, ['#ffe053', BRAND.carOrange, '#e34809'], true,
      run.spin ? Math.sin(now * .025) * .28 : 0);
  }

  return { resize, draw };
}
