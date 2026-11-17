import { CHAINGUARD_OCTOPUS } from './chainguard.js';
import { BRAND, lanePosition, obstacleLane, TURBO_SPEED } from './engine.js';

const TRAFFIC = [
  { label: ['TECHNICAL', 'DEBT'], colors: ['#edac61', '#965022', '#291132'] },
  { label: ['LEGACY', 'STACK'], colors: ['#50ddff', '#1744aa', '#100c42'] },
  { label: ['ONE-OFF', 'BUILD'], colors: ['#ff96db', '#b33280', '#300e40'] },
  { label: ['STATUS', 'QUO'], colors: ['#8ef8ff', '#217bd6', '#140e45'] },
];

const ATTRACT_TRAFFIC = [
  { kind: 'hazard', type: 0, lane: 0, z: 27 },
  { kind: 'hazard', type: 1, lane: 4, z: 25 },
  { kind: 'hazard', type: 5, lane: 2, z: 75 },
  {kind: 'guide', lane: 3, z: 46},
];

export function createRoad(ctx) {
  let width, height, horizon, center, roadHalf, sky;
  const focalDistance = 94;
  const drawDistance = 1250;
  let cameraOffset = 0;
  let cameraLane = 0;
  let trailRun;
  let lightTrail = [];
  const sprites = new Map();
  const octopus = new Path2D(CHAINGUARD_OCTOPUS);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

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
    const scale = focalDistance / (focalDistance + depth);
    return { x: center + (roadHalf * lane - cameraOffset) * scale, y: horizon + (height * .89 - horizon) * scale, scale };
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
    // The sky stays in screen space. Cache it so the track can animate independently.
    sky = document.createElement('canvas');
    sky.width = Math.ceil(w);
    sky.height = Math.ceil(h);
    const display = ctx;
    ctx = sky.getContext('2d');
    paintSky();
    // A small deterministic grain pass ties the sky, sunset and ridge layers together.
    let grainSeed = 42;
    for (let dot = 0; dot < 3200; dot++) {
      grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0;
      const x = grainSeed % sky.width;
      const y = (grainSeed >>> 12) % Math.max(1, Math.floor(horizon));
      ctx.fillStyle = dot % 3 ? '#ffd19e19' : '#24073824';
      ctx.fillRect(x, y, 1 + dot % 3, 1);
    }
    ctx = display;
  }

  function paintTrack(distance, gateDepth, purple) {
    const end = project(-focalDistance * .23);
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

    const left = project(-focalDistance * .23, -1).x;
    const right = project(-focalDistance * .23, 1).x;
    shape([[center, horizon], [right, end.y], [left, end.y]], gradient(0, horizon, 0, height,
      ['#6c275d', '#29298c', '#121e66', '#071333']));
    for (const side of [-1, 1]) {
      const inside = project(-focalDistance * .23, side * .86);
      const outside = project(-focalDistance * .23, side);
      shape([[center, horizon], [inside.x, inside.y], [outside.x, outside.y]],
        gradient(0, horizon, 0, height, ['#b42dd127', '#7f28ea32', '#4f31bc42']));
      const edge = project(-focalDistance * .23, side);
      line(center, horizon, edge.x, edge.y, '#db22fa65', 16);
      line(center, horizon, edge.x, edge.y, '#f731e9', 4);
      line(center, horizon, edge.x, edge.y, '#ffb0fa', 1.4);
    }
    // Violet and amber reflections stretch into the foreground on the dark asphalt.
    for (const [lane, color] of [[-.71, '#982bff30'], [-.23, '#fb69421f'],
      [.18, '#bd42ff27'], [.64, '#454dff48']]) {
      const a = project(-21, lane - .06);
      const b = project(-21, lane + .06);
      shape([[center, horizon], [a.x, a.y], [b.x, b.y]],
        gradient(0, horizon, 0, height, [color, '#290f6300', color]));
    }
    for (let i = 0; i < 30; i++) {
      const z = ((i * 13 - distance) % 390 + 390) % 390 - 19;
      const lane = ((i * .4137) % 1) * 1.7 - .85;
      const far = project(z + 5, lane);
      const close = project(z, lane);
      line(far.x, far.y, close.x, close.y, '#a79bff30', close.scale * 1.3);
    }
    // Fixed shoulder reflectors provide a steady near-field speed reference.
    for (let z = -20 - distance % 24; z < 500; z += 24) {
      if (z < -24) continue;
      for (const side of [-1, 1]) {
        const p = project(z, side * 1.015);
        const height = 13 * p.scale;
        line(p.x, p.y, p.x, p.y - height, '#35215e', 4 * p.scale);
        line(p.x, p.y - height, p.x, p.y - height * .72, '#ffd2ff', 3 * p.scale);
      }
    }
    for (let divider = 0; divider < 4; divider++) {
      const side = divider < 2 ? -1 : 1;
      const outer = divider === 0 || divider === 3;
      for (let depth = -24 - distance % 18; depth < drawDistance; depth += 18) {
        if (depth + 9 < -24) continue;
        const lane = side * (outer ? .6 : .2);
        const start = project(Math.max(-24, depth), lane);
        const end = project(depth + 9, lane);
        line(start.x, start.y, end.x, end.y, '#a571f5', 6 * start.scale);
        line(start.x, start.y, end.x, end.y, '#fff1f1', 3.7 * start.scale);
      }
    }
    if (gateDepth > 0) {
      const lane = lanePosition(purple, 5);
      for (let offset = 18; offset <= 112; offset += 19) {
        const z = gateDepth - offset;
        if (z < -20) continue;
        const p = project(z, lane);
        const size = Math.min(1.25, width / 710) * p.scale;
        shape([[p.x, p.y - 15 * size], [p.x - 13 * size, p.y],
          [p.x, p.y - 6 * size], [p.x + 13 * size, p.y]], '#dc8cffe0');
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

  function plaza(depth, openLane, releasedLane, release) {
    const p = project(depth);
    const unit = roadHalf * 2 * p.scale / 5;
    const tall = Math.min(unit * 1.32, height * .34 * p.scale + unit * .44);
    if (unit < 6) return;
    const exit = p.x + (openLane - 2) * unit;
    shape([[exit - unit * .29, p.y], [exit + unit * .29, p.y],
      [exit + unit * .55, p.y + tall * .55], [exit - unit * .55, p.y + tall * .55]],
      gradient(0, p.y, 0, p.y + tall * .55, ['#b745ff86', '#8228ff00']));
    if (depth >= 0) {
      const stop = project(depth - 12);
      for (let lane = 0; lane < 5; lane++) {
        if (lane === openLane) continue;
        const x = project(depth - 12, lanePosition(lane, 5)).x;
        line(x - unit * .36, stop.y, x + unit * .36, stop.y, '#ff976ca6', unit * .023);
      }
    }
    sign(p.x + unit * 1.52, p.y - tall * 1.13, unit / 103);
    for (let lane = 0; lane <= 5; lane++) {
      const x = p.x + (lane - 2.5) * unit;
      ellipse(x + unit * .045, p.y + tall * .027, unit * .29, tall * .083, '#08051f9c');
      ellipse(x, p.y, unit * .19, tall * .061, '#b27de3');
      ellipse(x, p.y - tall * .023, unit * .18, tall * .04, '#403070');
      shape([[x - unit * .09, p.y + tall * .018], [x + unit * .08, p.y + tall * .018],
        [x + unit * .19, p.y + tall * .26], [x - unit * .16, p.y + tall * .26]],
        gradient(0, p.y, 0, p.y + tall * .26, ['#ffb74164', '#f9650b00']));
      box(x - unit * .14, p.y - tall * .78, unit * .28, tall * .79, unit * .09,
        gradient(x - unit * .14, 0, x + unit * .14, 0, ['#080c3b', '#313b9d', '#652b8e', '#100c35']), '#ac75dd', Math.max(.5, unit * .012));
      if (unit > 26) {
        for (const offset of [-.1, -.066, .066, .1]) {
          line(x + unit * offset, p.y - tall * .71, x + unit * offset, p.y - tall * .06,
            offset < 0 ? '#bc7cff7a' : '#120939b0', Math.max(1, unit * .012));
        }
        for (const level of [.08, .72]) {
          box(x - unit * .16, p.y - tall * level, unit * .32, tall * .044, unit * .02,
            gradient(0, p.y - tall * level, 0, p.y - tall * (level - .044), ['#cb83eb', '#28134e']));
        }
      }
      for (let lamp = 0; lamp < 3; lamp++) {
        const y = p.y - tall * (.12 + lamp * .17);
        ellipse(x, y, unit * .059, unit * .047, '#3f1831');
        glow(x, y, unit * .12, '#fffed1', '#ff8d02d8');
      }
      line(x - unit * .17, p.y, x + unit * .17, p.y, '#ffc6ff', Math.max(1, unit * .022));
    }
    for (let lane = 0; lane < 5; lane++) {
      const x = p.x + (lane - 2) * unit;
      const open = lane === openLane;
      const roofY = p.y - tall;
      const neon = open ? BRAND.chainguardPurple : '#ff492b';
      shape([[x - unit * .53, roofY + tall * .22], [x, roofY], [x + unit * .53, roofY + tall * .22],
        [x + unit * .5, roofY + tall * .31], [x - unit * .5, roofY + tall * .31]],
        gradient(0, roofY, 0, roofY + tall * .3, ['#9e4bff', '#282274', '#171042']), '#9a70ee', Math.max(1, unit * .021));
      line(x - unit * .47, roofY + tall * .21, x, roofY + tall * .033, '#b988ff', unit * .012);
      line(x, roofY + tall * .033, x + unit * .47, roofY + tall * .21, '#503797', unit * .012);
      for (let rib = 0; rib < 4 && unit > 26; rib++) {
        const across = .14 + rib * .087;
        const y = roofY + tall * (.08 + rib * .033);
        line(x - unit * across, y, x + unit * across, y, '#a984ff61', unit * .009);
      }
      box(x - unit * .51, roofY + tall * .205, unit * 1.02, tall * .077, unit * .03,
        gradient(0, roofY + tall * .20, 0, roofY + tall * .29, ['#a963dd', '#322065', '#0a0828']));
      const panelY = roofY + tall * .24;
      box(x - unit * .411, panelY, unit * .822, tall * .35, unit * .085, '#100a29', neon, Math.max(1, unit * .026));
      box(x - unit * .378, panelY + tall * .026, unit * .756, tall * .29, unit * .06,
        gradient(0, panelY, 0, panelY + tall * .35, open
          ? ['#8c17ee', '#5904aa', '#2c105e'] : ['#ff4925', '#e51222', '#770923']));
      if (unit > 24) {
        line(x - unit * .31, panelY + tall * .05, x + unit * .31, panelY + tall * .05,
          open ? '#f4aaff' : '#ffb26e', unit * .014);
        line(x - unit * .33, panelY + tall * .28, x + unit * .33, panelY + tall * .28,
          open ? '#8e5fff' : '#ff355e', unit * .01);
        for (const side of [-1, 1]) {
          ellipse(x + side * unit * .375, panelY + tall * .062, unit * .013, unit * .013, '#e7c8e9');
        }
      }
      if (open) {
        ctx.save();
        ctx.translate(x, panelY + tall * .16);
        ctx.scale(unit / 70, unit / 70);
        ctx.translate(-9, -10);
        ctx.scale(.86, .86);
        ctx.fillStyle = '#fff7ff';
        ctx.fill(octopus, 'evenodd');
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
      const rise = tall * .27 * (open ? 1 : lane === releasedLane ? release : 0);
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
    for (let tread = 1; tread <= 3; tread++) {
      line(x + w * tread / 4, y + 5, x + w * tread / 4, y + h - 5, '#454062');
    }
    ellipse(x + w * .54, y + h * .55, w * .25, h * .3, '#111029');
    ellipse(x + w * .54, y + h * .55, w * .13, h * .19, '#685b82');
  }

  function paintCoupe(paint, player) {
    ellipse(0, -2, 78, 13, '#030518b8');
    wheel(-70, -29, 24, 34);
    wheel(46, -29, 24, 34);
    const [light, body, dark] = paint;
    for (const side of [-1, 1]) {
      ellipse(side * 48, 4, 21, 6, '#fa451a38');
      ellipse(side * 48, 4, 11, 2, '#ffbd4940');
    }
    ctx.beginPath();
    ctx.moveTo(-68, -7);
    ctx.bezierCurveTo(-80, -16, -76, -48, -63, -59);
    ctx.quadraticCurveTo(-51, -66, -45, -81);
    ctx.quadraticCurveTo(-40, -94, -25, -94);
    ctx.lineTo(25, -94);
    ctx.quadraticCurveTo(40, -94, 45, -81);
    ctx.quadraticCurveTo(51, -66, 63, -59);
    ctx.bezierCurveTo(76, -48, 80, -16, 68, -7);
    ctx.quadraticCurveTo(51, 2, 38, 2);
    ctx.lineTo(-38, 2);
    ctx.quadraticCurveTo(-51, 2, -68, -7);
    ctx.closePath();
    ctx.fillStyle = gradient(-63, -83, 57, 1, [dark, body, light, body, dark]);
    ctx.fill();
    ctx.strokeStyle = '#210921';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const side of [-1, 1]) {
      shape([[side * 42, -84], [side * 58, -62], [side * 69, -47],
        [side * 59, -42], [side * 44, -53], [side * 39, -65]],
        gradient(side * 38, -82, side * 69, -42, [light, body, dark]));
      line(side * 44, -79, side * 60, -55, '#fff3a7b0', 1.8);
      line(side * 58, -54, side * 68, -46, '#ffe898', 2);
    }
    line(-24, -91, 24, -91, '#fff3adbe', 1.5);
    shape([[-43, -65], [-33, -81], [33, -81], [43, -65], [38, -49], [-38, -49]],
      gradient(0, -81, 0, -49, ['#070b29', '#12487a', '#1b2c62']), '#15102d', 3);
    shape([[-36, -76], [25, -79], [38, -70], [-39, -66]], '#63c9ff39');
    for (let i = 0; i < 4; i++) line(-36, -58 - i * 4, 37, -58 - i * 4, '#78b8ff32');
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
    line(-65, -37, -23, -44, '#fff1acac', 2.1);
    line(23, -44, 65, -37, '#fff1acac', 2.1);
    line(-59, -13, 59, -13, '#ffdb9966', 1.2);
    for (const side of [-1, 1]) {
      line(side * 39, -88, side * 46, -73, '#f981cf7d', 1);
      line(side * 64, -12, side * 69, -26, '#9360d9a8', 1.2);
    }
    box(-20, -24, 40, 9, 2, '#1a1224', '#81444f');
    if (player) {
      ctx.font = '900 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3cc';
      ctx.fillText('$PRINT', 0, -17);
    }
    box(-18, -7, 36, 5, 2, '#140d25', '#71364b');
    for (let i = 0; i < 7; i++) line(-14 + i * 4.6, -6, -14 + i * 4.6, -3, '#82637c');
  }

  function paintTruck(type, side) {
    const {label, colors: [light, body, dark]} = TRAFFIC[type];
    const sideWidth = -side * (type === 2 ? 26 : 47);
    const nose = -side * 57;
    ellipse(sideWidth * .4, -1, 74, 12, '#02051ba6');
    box(nose - 14, -86, 28, 62, 10, gradient(nose - 14, 0, nose + 14, 0,
      ['#14183b', '#1b5684', '#76cbde', '#1b3563']), '#110d29', 3);
    box(nose - 11, -81, 22, 22, 5, '#132d53', '#80d4e0');
    wheel(nose - 12, -39, 21, 32);
    for (const wheelX of [-50, 33, sideWidth - 10]) wheel(wheelX, -27, 19, 31);
    shape([[-56, -96], [-56 + sideWidth, -115], [56 + sideWidth, -115], [56, -96]], gradient(0, -115, 0, -95, ['#fff0b3', light, body]), '#1e1132', 2);
    for (let rib = 1; rib < 5; rib++) {
      const t = rib / 5;
      line(-56 + sideWidth * t, -96 - 19 * t, 56 + sideWidth * t, -96 - 19 * t, '#3b254557', 1);
    }
    const edge = sideWidth > 0 ? 56 : -56;
    shape([[edge, -96], [edge + sideWidth, -115], [edge + sideWidth, -37], [edge, -15]],
      gradient(edge, 0, edge + sideWidth, 0, [body, light, dark]), '#220b2d', 2);
    for (let rib = 1; rib < 8; rib++) {
      const t = rib / 8;
      line(edge + sideWidth * t, -96 - 19 * t, edge + sideWidth * t, -15 - 22 * t, '#e6c0bf4f', 1.3);
    }
    line(edge, -92, edge + sideWidth, -111, '#ffe1a7a8', 1.6);
    line(edge, -20, edge + sideWidth, -41, '#b276b6', 1.2);
    box(-56, -96, 112, 79, 5, gradient(-56, -96, 56, -17, [light, body, dark]), '#24112d', 3);
    for (const door of [-50, 3]) {
      box(door, -90, 47, 65, 3, '#100c1d25', '#e3b5a263');
      for (let rib = 4; rib < 45; rib += 5) {
        line(door + rib, -88, door + rib, -27, rib % 2 ? '#fce5c233' : '#130a2250', 1.15);
      }
    }
    for (const hingeX of [-49, 46]) {
      for (const hingeY of [-85, -61, -36]) {
        box(hingeX - 3, hingeY, 7, 4, 1, '#bf9690', '#402037');
      }
    }
    line(-3, -87, -3, -29, '#e2b4a083', 1.7);
    line(3, -87, 3, -29, '#563951', 1.8);
    line(-14, -39, -2, -39, '#b39199', 2.3);
    line(2, -39, 14, -39, '#b39199', 2.3);
    line(-53, -94, 53, -94, '#ffe6bfa5', 1.5);
    line(-54, -24, 54, -24, '#140b26', 1.6);
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
  }

  function fleetLabel(label, y, width, font = 11) {
    box(-width / 2, y - 10, width, 14, 2, '#15152c', '#8da1b5');
    ctx.fillStyle = '#fff4dc';
    ctx.textAlign = 'center';
    ctx.font = `900 ${font}px Arial`;
    ctx.fillText(label, 0, y, width - 5);
  }

  function paintFleet(type, side) {
    if (type === 0) {
      paintTruck(type, side);
      return;
    }
    ellipse(0, -2, 64, 11, '#02051b99');
    for (const x of [-45, 45]) wheel(x, -19, 18, 31);
    if (type === 1) {
      const offset = -side * 31;
      ellipse(offset * .88, -60, 42, 46, '#355275');
      box(Math.min(0, offset), -105, Math.abs(offset) + 2, 90, 2, '#719fb8');
      ellipse(0, -60, 46, 46, gradient(-36, -108, 28, -20, ['#cce8ee', '#5a86ac', '#172e57']));
      ellipse(0, -60, 39, 40, '#50799b');
      for (const x of [-35, -26]) line(x, -60, x, -23, '#c0dfed', 2);
      for (let y = -58; y <= -25; y += 6) line(-35, y, -26, y, '#c0dfed', 1.5);
      fleetLabel('LEGACY STACK', -61, 78);
    } else if (type === 2) {
      box(-43 - side * 8, -76, 86, 56, 8, '#802c62', '#e998cf', 2);
      box(-34 - side * 8, -70, 68, 22, 4, '#1b3758', '#805dc6');
      for (const x of [-30, 1]) {
        box(x, -57, 28, 33, 2, '#28243b', '#9c84ae');
        for (let y = -53; y < -31; y += 7) {
          box(x + 3, y, 22, 3, 1, '#0b152b');
          box(x + 19, y, 3, 2, 1, '#77edff');
        }
        line(x + 11, -57, x + 11, -25, '#f9b343', 2);
      }
      box(-49, -33, 98, 21, 3, '#a7417f', '#f5a6d3');
      fleetLabel('ONE-OFF BUILD', -21, 78);
    } else {
      shape([[-52, -15], [-50, -76], [-42, -93], [39, -93], [50, -78], [53, -15]],
        gradient(0, -96, 0, -16, ['#a88de8', '#60398e', '#271b49']), '#b290e8', 2);
      for (const x of [-37, 4]) box(x, -76, 33, 23, 3, '#172646', '#7796ce');
      line(0, -88, 0, -20, '#2f214d', 2);
      for (const x of [-44, 43]) {
        box(x, -58, 6, 30, 2, '#f64265', '#f9a0b0');
        line(x, -92, x + 2, -100, '#ae9cc0', 3);
      }
      fleetLabel('NIGHT SHIFT', -36, 78);
    }
    box(-50, -15, 100, 9, 3, '#21192c', '#806787');
    for (const x of [-40, 40]) glow(x, -15, 8, '#ffdb82', '#ee2f42');
  }

  // Paint each vehicle once at sprite resolution, then composite it at road depth.
  function drawSprite(key, painter, x, y, scale, tilt = 0, widthScale = 1, yaw = 0) {
    if (!sprites.has(key)) {
      const sprite = document.createElement('canvas');
      sprite.width = 420;
      sprite.height = 280;
      const roadContext = ctx;
      ctx = sprite.getContext('2d');
      ctx.setTransform(2, 0, 0, 2, 210, 244);
      painter();
      ctx = roadContext;
      sprites.set(key, sprite);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.transform(widthScale, 0, yaw, 1, 0, 0);
    ctx.drawImage(sprites.get(key), -105 * scale, -122 * scale, 210 * scale, 140 * scale);
    ctx.restore();
  }

  function coupe(x, y, scale, paint, player, tilt, yaw = 0) {
    drawSprite(player ? 'player' : `coupe:${paint[0]}`, () => paintCoupe(paint, player), x, y, scale, tilt, 1, yaw);
  }

  function fleet(x, y, scale, type, side) {
    drawSprite(`fleet:${type}:${side}`, () => paintFleet(type, side), x, y, scale, 0, .84);
  }

  function item(object, distance, now, cinematic) {
    const z = object.z - distance;
    if (z < -36 || z > drawDistance || (object.hit && object.kind !== 'hazard')) return;
    const lane = object.offset ?? obstacleLane(object);
    const { x, y, scale } = project(z, lane);
    const vehicleScale = Math.min(width / 820, height / 570) * scale;
    const fade = Math.max(0, Math.min(1, (drawDistance - z) / 330));
    ctx.save();
    ctx.globalAlpha *= fade;
    paintItem(object, now, cinematic, z, x, y, scale, vehicleScale, lane);
    ctx.restore();
  }

  function paintItem(object, now, cinematic, z, x, y, scale, vehicleScale, lane) {
    if (object.kind === 'hazard') {
      const bump = object.bump ? object.bump.force * Math.exp(-object.bump.age * 8) : 0;
      if (object.type === 3 || object.type === 4) {
        const colors = object.type === 3 ? TRAFFIC[3].colors : ['#79ffe7', '#22a88e', '#173a42'];
        coupe(x, y, vehicleScale * (object.type === 4 ? .57 : .64), colors, false, bump * .13);
        if (!cinematic && scale > .54) {
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e0f5ff';
          ctx.fillText(object.type === 3 ? 'STATUS QUO' : 'HOT FIX', x, y - 61 * vehicleScale);
        }
      } else {
        const size = object.type === 2 ? .76 : 1.04;
        fleet(x, y, vehicleScale * (cinematic ? 1.16 : size), object.type, Math.sign(lane) || 1);
      }
      if (object.merge && (reducedMotion.matches || Math.floor(object.merge.elapsed * 5) % 2 === 0)) {
        const side = Math.sign(object.merge.to - object.lane);
        const lamp = Math.max(2, vehicleScale * 5);
        ellipse(x + side * 38 * vehicleScale, y - 14 * vehicleScale, lamp, lamp * .55, '#ffbd3d');
      }
      return;
    }

    const size = Math.min(width / 660, height / 530) * scale;
    const floatY = y - (19 + Math.sin(now * .005 + z / 10) * 3) * size;
    if (object.mergeDirection) {
      const tip = x + object.mergeDirection * 11 * size;
      const tipY = y - 6 * size;
      const thickness = Math.max(.8, size * 2.8);
      line(x - object.mergeDirection * 9 * size, y + 5 * size, tip, tipY, BRAND.chainguardPurple, thickness);
      line(tip - object.mergeDirection * 8 * size, tipY, tip, tipY, BRAND.chainguardPurple, thickness);
      line(tip, tipY, tip - object.mergeDirection * 3 * size, tipY + 5 * size, BRAND.chainguardPurple, thickness);
    } else if (object.kind === 'guide') {
      for (let i = 0; i < 3; i++) {
        const py = y + i * size * 4;
        line(x - 9 * size, py, x, py - 4 * size, '#74efff', Math.max(.8, size * 2));
        line(x, py - 4 * size, x + 9 * size, py, '#74efff', Math.max(.8, size * 2));
      }
    } else if (object.kind === 'work') {
      for (const side of [-1, 1]) {
        box(x + side * 37 * size - 3 * size, y - 26 * size, 6 * size, 26 * size, 1, '#8e7e8e');
        glow(x + side * 37 * size, y - 31 * size, 6 * size, '#fff3a5', '#ff930e');
      }
      box(x - 44 * size, y - 24 * size, 88 * size, 17 * size, 1, '#ff8c26', '#241328');
      for (let i = -3; i <= 3; i++) {
        line(x + i * 11 * size, y - 8 * size, x + (i * 11 + 7) * size, y - 22 * size, '#25172d', 4 * size);
      }
    } else if (object.kind === 'boost' || object.kind === 'deadline' || object.kind === 'repair') {
      const turbo = object.kind === 'boost';
      const r = 17 * size;
      const color = turbo ? '#68eaff' : object.kind === 'repair' ? '#ffd17c' : '#a2ff9d';
      glow(x, floatY, r * 1.9, color, turbo ? '#1f9fffbc' : '#42e878bb');
      ellipse(x, floatY, r, r, '#071b35');
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 2 * size);
      ctx.stroke();
      if (turbo) {
        shape([[x + .12 * r, floatY - .73 * r], [x - .51 * r, floatY + .12 * r],
          [x - .03 * r, floatY + .12 * r], [x - .17 * r, floatY + .74 * r],
          [x + .58 * r, floatY - .17 * r], [x + .1 * r, floatY - .17 * r]], color);
      } else if (object.kind === 'repair') {
        line(x - r * .44, floatY + r * .48, x + r * .20, floatY - r * .18, color, 3 * size);
        line(x + r * .20, floatY - r * .18, x + r * .52, floatY - r * .14, color, 2.6 * size);
        line(x + r * .20, floatY - r * .18, x + r * .15, floatY - r * .53, color, 2.6 * size);
      } else {
        line(x, floatY - r * .54, x, floatY, color, 2 * size);
        line(x, floatY, x + r * .46, floatY + r * .26, color, 2 * size);
      }

    }
  }

  function paintSpeed(distance, intensity, lane) {
    if (intensity <= 0) return;
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? -1 : 1;
      const offset = side * (.64 + (i % 7) * .13);
      const z = 8 + ((i * 19.7 - distance * 2.55) % 230 + 230) % 230;
      const start = project(z + 8 + intensity * 22, offset);
      const end = project(z, offset);
      line(start.x, start.y, end.x, end.y, `rgba(240,113,255,${intensity * end.scale * .66})`,
        Math.max(.7, end.scale * 2.9));
    }
    for (let i = 0; i < 9; i++) {
      const z = 6 + ((i * 24 - distance * 1.8) % 216 + 216) % 216;
      const far = project(z + 12, lane);
      const close = project(z, lane);
      line(far.x, far.y, close.x, close.y, `rgba(230,141,255,${intensity * close.scale * .37})`,
        close.scale * 5);
    }
  }

  function draw(run, mode, distance, now, dt) {
    const cinematic = mode === 'intro';
    const remaining = run.plaza - run.distance;
    const approach = !cinematic && !run.stop
      ? Math.max(0, Math.min(1, (230 - remaining) / 210)) : 0;
    const velocity = Math.min(1, run.speed / TURBO_SPEED);
    const rush = cinematic || run.stop ? 0 : Math.min(1,
      velocity * .22 + approach * velocity * .5 + (run.boost ? .68 + run.turboKick * .8 : 0));
    roadHalf = width * (cinematic ? .61 : .465);
    const visualLane = cinematic ? 0 : run.steering.position;
    const steeringForce = cinematic ? 0 : Math.max(-1, Math.min(1, run.steering.velocity / 2.6));
    const targetCamera = reducedMotion.matches ? 0 : visualLane + steeringForce * .10;
    cameraLane += (targetCamera - cameraLane) * (1 - Math.exp(-7 * dt));
    cameraOffset = cinematic ? 0 : cameraLane * width * .077;
    const gates = cinematic ? [{ z: 83, purple: 3 }] : [
      { z: run.plaza, purple: run.purple },
      ...(run.passedPlaza ? [run.passedPlaza] : []),
    ];
    const objectDistance = cinematic ? 0 : run.distance;
    ctx.drawImage(sky, 0, 0, width, height);
    paintTrack(distance, cinematic ? 83 : remaining, cinematic ? 3 : run.purple);
    if (!reducedMotion.matches) paintSpeed(distance, rush, lanePosition(run.purple, 5));
    const objects = cinematic ? ATTRACT_TRAFFIC : run.objects;
    const scene = [
      ...gates.map(gate => ({ z: gate.z, gate })),
      ...objects.map(object => ({ z: object.z, object })),
    ].sort((a, b) => b.z - a.z);

    for (const { z, gate, object } of scene) {
      const depth = z - objectDistance;
      if (gate && depth > -65 && depth < drawDistance) {
        const release = gate.duration
          ? Math.max(0, Math.min(1, (gate.waited - gate.duration + .65) / .65))
          : 0;
        plaza(depth, gate.purple, gate.stoppedLane, release);
      } else if (object) {
        item(object, objectDistance, now, cinematic);
      }
    }
    const car = project(0, cinematic ? 0 : visualLane);
    const scale = Math.min(width / 685, height / 520);
    if (trailRun !== run) {
      trailRun = run;
      lightTrail = [];
    }
    if (mode === 'play' && run.speed > 30 && !reducedMotion.matches) {
      if (!lightTrail.length || distance - lightTrail.at(-1).z > 1.5) {
        lightTrail.push({z: distance, lane: visualLane});
        if (lightTrail.length > 42) lightTrail.shift();
      }
      const reach = run.boost ? 62 : 43;
      for (const side of [-1, 1]) {
        let previous = {x: car.x + side * 49 * scale, y: car.y - 27 * scale};
        for (let i = lightTrail.length - 1; i >= 0; i--) {
          const point = lightTrail[i];
          const age = (distance - point.z) / reach;
          if (age >= 1 || age < 0) break;
          const road = project((point.z - distance) * .32, point.lane);
          const next = {x: road.x + side * 49 * scale * road.scale, y: road.y - 27 * scale * road.scale};
          const taper = Math.sqrt(1 - age);
          ctx.save();
          ctx.globalAlpha *= .36 * taper;
          line(previous.x, previous.y, next.x, next.y, BRAND.chainguardPurple, (run.boost ? 9 : 6) * scale * taper);
          ctx.globalAlpha = taper;
          line(previous.x, previous.y, next.x, next.y, '#e4baff', (run.boost ? 2.2 : 1.5) * scale * taper);
          ctx.restore();
          previous = next;
        }
      }
    } else {
      lightTrail = [];
    }
    const lean = reducedMotion.matches ? 0 : steeringForce * .085;
    const yaw = reducedMotion.matches ? 0 : -steeringForce * .19;
    if (!cinematic && Math.abs(steeringForce) > .10 && run.speed > 18 && !reducedMotion.matches) {
      for (const side of [-1, 1]) {
        const tire = car.x + side * 55 * scale;
        const tailX = tire - steeringForce * 25 * scale;
        const tailY = car.y + 22 * scale;
        line(tire, car.y - 1, tailX, tailY, '#03051a80', 4 * scale);
        line(tire, car.y - 1, tailX, tailY, '#ae70ef55', 1.2 * scale);
      }
    }
    const suspension = reducedMotion.matches || cinematic || run.stop ? 0
      : (Math.sin(distance * .27) * .8 + Math.sin(distance * .63) * .38) * velocity;
    const rumble = suspension - Math.abs(steeringForce) * 1.35;
    if (run.boost && !cinematic && !reducedMotion.matches) {
      for (const side of [-1, 1]) {
        const x = car.x + side * 45 * scale;
        const y = car.y - 5 * scale;
        const tail = y + (24 + Math.sin(distance) * 4 + run.turboKick * 22) * scale;
        shape([[x - 5 * scale, y], [x + 5 * scale, y], [x, tail]],
          gradient(0, y, 0, tail, ['#ecffff', '#56deff', '#1468ff00']));
      }
    }
    const impact = cinematic || reducedMotion.matches ? null : run.impact;
    const kick = impact ? impact.force * Math.exp(-impact.age * 7) : 0;
    for (let i = 0; kick > .025 && i < 14; i++) {
      const age = impact.age;
      const x = car.x + (Math.sin(i * 7.8) * age * 150 - impact.side * 29) * scale;
      const y = car.y - (25 + age * (i % 6 + 1) * 22 - age * age * 140) * scale;
      line(x, y, x + (i % 5 - 2) * 4 * scale, y + 8 * scale, '#ffbb50', Math.max(1, scale * kick * 4));
    }
    coupe(car.x, car.y + rumble - (cinematic ? height * .022 : 0), scale,
      [BRAND.carOrange, '#ff691a', '#a82327'], true,
      lean - (impact?.side ?? 0) * (kick * .22 + (run.wrecked ? .14 : 0)), yaw + kick * .18);
    if (!cinematic && run.damage >= 8) {
      const x = car.x + run.damageSide * 39 * scale;
      for (let i = 0; i < Math.min(6, Math.ceil(run.damage / 12)); i++) {
        line(x - 10 * scale, car.y - (29 + i * 2) * scale,
          x + 12 * scale, car.y - (34 + i * 2) * scale, i % 2 ? '#cbb8b1' : '#3d2633', 1.6 * scale);
      }
      if (run.damage >= 48 && !reducedMotion.matches) {
        for (let i = 0; i < 9; i++) {
          const age = (now * .0014 + i * .157) % 1;
          const size = (3 + age * 10) * scale * run.damage / 100;
          ellipse(x + Math.sin(i * 4) * age * 9 * scale, car.y - (28 + age * 43) * scale,
            size, size * .7, `rgba(79,65,88,${(1 - age) * .65})`);
        }
      }
    }
  }

  return { resize, draw };
}
