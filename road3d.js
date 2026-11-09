import * as T from 'three';
import { CHAINGUARD_OCTOPUS } from './chainguard.js';
import { lanePosition, obstacleLane, TURBO_SPEED } from './engine.js';

const LANE = 3.55;
const HALF = LANE * 2.5;
const DEPTH = .27;
const LOOKAHEAD = 1250;
const TAGS = ['TECHNICAL DEBT', 'LEGACY STACK', 'ONE-OFF BUILD', 'STATUS QUO'];
const CARS = [0x9b4c27, 0x2157c1, 0x9e3274, 0x198dcc];
const attract = [
  { kind: 'hazard', type: 0, lane: 0, z: 35 },
  { kind: 'hazard', type: 1, lane: 4, z: 42 },
  { kind: 'hazard', type: 3, lane: 2, z: 74 },
  ...[14, 27, 41, 56, 73].map(z => ({ kind: 'coin', lane: 3, z })),
];

export function createRoad3D(canvas) {
  const renderer = new T.WebGLRenderer({canvas, alpha: false, antialias: true, powerPreference: 'high-performance'});
  renderer.setClearColor(0x140b3c);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.48;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x613387, .006);
  const camera = new T.PerspectiveCamera(54, 1, .14, 420);
  scene.add(new T.HemisphereLight(0xffcbf5, 0x282153, 2.3));
  const sunset = new T.DirectionalLight(0xffa861, 2.25);
  sunset.position.set(-5, 8, -22);
  scene.add(sunset);
  const fill = new T.DirectionalLight(0x9abaff, 2.15);
  fill.position.set(8, 5, 12);
  scene.add(fill);
  const rim = new T.DirectionalLight(0xc054ff, 1.8);
  rim.position.set(-10, 2, 2);
  scene.add(rim);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cube = new T.BoxGeometry(1, 1, 1);
  const wheelShape = new T.CylinderGeometry(.45, .45, .34, 18).rotateZ(Math.PI / 2);
  const wheelRim = new T.CylinderGeometry(.29, .29, .35, 14).rotateZ(Math.PI / 2);
  const spoke = new T.BoxGeometry(.36, .049, .38);
  const sphere = new T.SphereGeometry(1, 12, 8);
  const material = (color, roughness = .47, metalness = .13) => new T.MeshStandardMaterial({color, roughness, metalness});
  const neon = color => new T.MeshBasicMaterial({color, toneMapped: false});
  const ink = material(0x110c21, .83);
  const tire = material(0x100f20, .86);
  const chrome = material(0xa6a0bf, .28, .56);
  const glass = material(0x122c58, .2, .34);
  const stripe = material(0xfff3d7, .37);
  const red = neon(0xff2c28);
  const amber = neon(0xffb13f);
  const blue = neon(0x69dcff);
  const purple = neon(0xdf57ff);

  function mesh(parent, geometry, paint, x, y, z, sx = 1, sy = 1, sz = 1) {
    const node = new T.Mesh(geometry, paint);
    node.position.set(x, y, z);
    node.scale.set(sx, sy, sz);
    parent.add(node);
    return node;
  }

  const box = (parent, paint, x, y, z, w, h, d) => mesh(parent, cube, paint, x, y, z, w, h, d);
  const labelCache = new Map();
  function decal(parent, value, x, y, z, w, h, color = '#fff2d6', background = null) {
    const key = [value, color, background].join('/');
    if (!labelCache.has(key)) {
      const art = document.createElement('canvas');
      art.width = 384;
      art.height = 144;
      const c = art.getContext('2d');
      if (background) {
        c.fillStyle = background;
        c.fillRect(0, 0, 384, 144);
        c.strokeStyle = color;
        c.lineWidth = 5;
        c.strokeRect(5, 5, 374, 134);
      }
      const lines = value.split('|');
      c.font = '900 58px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = color;
      lines.forEach((line, i) => c.fillText(line, 192, 72 + (i - (lines.length - 1) / 2) * 58, 350));
      const texture = new T.CanvasTexture(art);
      texture.colorSpace = T.SRGBColorSpace;
      labelCache.set(key, new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}));
    }
    return mesh(parent, new T.PlaneGeometry(w, h), labelCache.get(key), x, y, z);
  }

  const shadowTexture = (() => {
    const art = document.createElement('canvas');
    art.width = art.height = 64;
    const c = art.getContext('2d');
    const gradient = c.createRadialGradient(32, 32, 6, 32, 32, 32);
    gradient.addColorStop(0, '#060518d8');
    gradient.addColorStop(1, '#06051800');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(art);
  })();
  const haloArt = document.createElement('canvas');
  haloArt.width = haloArt.height = 64;
  const haloContext = haloArt.getContext('2d');
  const haloGradient = haloContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  haloGradient.addColorStop(0, '#ffffffcc');
  haloGradient.addColorStop(.27, '#ffffff70');
  haloGradient.addColorStop(1, '#ffffff00');
  haloContext.fillStyle = haloGradient;
  haloContext.fillRect(0, 0, 64, 64);
  const haloMap = new T.CanvasTexture(haloArt);
  const halos = new Map();
  function halo(parent, color, x, y, z, w, h) {
    if (!halos.has(color)) halos.set(color, new T.SpriteMaterial({
      map: haloMap, color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
    }));
    const sprite = new T.Sprite(halos.get(color));
    sprite.position.set(x, y, z);
    sprite.scale.set(w, h, 1);
    parent.add(sprite);
  }
  const shadowPaint = new T.MeshBasicMaterial({map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
  const flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  function shadow(parent, width, length, z = 0) {
    return mesh(parent, flat, shadowPaint, 0, .017, z, width, 1, length);
  }

  // A faceted loft gives the body separate shoulders, side panels, and a sculpted tail.
  function loft(sections) {
    const vertices = [];
    const triangles = [];
    for (const [z, width, bottom, belt, top] of sections) {
      vertices.push(-width * .82, bottom, z, -width, belt, z, -width * .73, top, z,
        width * .73, top, z, width, belt, z, width * .82, bottom, z);
    }
    for (let row = 0; row < sections.length - 1; row++) {
      for (let i = 0; i < 6; i++) {
        const a = row * 6 + i;
        const b = row * 6 + (i + 1) % 6;
        triangles.push(a, a + 6, b, b, a + 6, b + 6);
      }
    }
    const last = (sections.length - 1) * 6;
    for (let i = 1; i < 5; i++) triangles.push(0, i, i + 1, last, last + i + 1, last + i);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(triangles);
    const faces = geometry.toNonIndexed();
    faces.computeVertexNormals();
    return faces;
  }

  function sportsCar(color, player = false) {
    const root = new T.Group();
    shadow(root, 3.85, 5.6);
    const body = new T.Group();
    root.add(body);
    const paint = material(color, .34, .28);
    paint.side = T.DoubleSide;
    const windows = glass.clone();
    windows.side = T.DoubleSide;
    mesh(body, loft([[-2.25, .87, .34, .55, .72], [-1.73, 1.15, .31, .63, .85],
      [-.65, 1.14, .32, .71, .91], [.86, 1.22, .31, .76, 1.0],
      [1.83, 1.20, .29, .72, .92], [2.06, 1.08, .35, .64, .82]]), paint, 0, 0, 0);
    mesh(body, loft([[-1.22, .92, .81, .86, .86], [-.55, .83, .87, 1.22, 1.43],
      [.26, .83, .88, 1.27, 1.43], [1.31, .91, .88, .94, .96]]), windows, 0, 0, 0);
    box(body, paint, 0, 1.438, -.16, 1.24, .065, .87);
    box(body, ink, 0, .52, 2.07, 1.92, .32, .10);
    box(body, chrome, 0, .43, 2.13, .65, .045, .036);
    for (let vent = 0; vent < 7; vent++) {
      box(body, ink, (vent - 3) * .083, .47, 2.151, .038, .093, .025);
    }
    box(body, paint, 0, .32, 2.01, 2.07, .14, .16);
    for (const side of [-1, 1]) {
      box(body, ink, side * .70, .69, 2.126, .68, .19, .054);
      box(body, red, side * .70, .69, 2.161, .61, .11, .041);
      box(body, red, side * .96, .682, 2.144, .16, .091, .075).rotation.y = side * .47;
      box(body, amber, side * .77, .69, 2.186, .17, .035, .02);
      if (player) halo(body, 0xff492b, side * .70, .69, 2.21, .88, .42);
      box(body, chrome, side * .71, .32, 2.13, .24, .11, .11);
      box(body, ink, side * .84, .95, 1.55, .11, .18, .24);
      box(body, paint, side * 1.08, .94, -.49, .23, .14, .31);
      box(body, ink, side * 1.12, .38, -.04, .15, .12, 1.52);
    }
    box(body, paint, 0, 1.06, 1.6, 2.15, .13, .38);
    if (player) {
      box(body, stripe, 0, 1.474, -.16, .42, .012, .87);
      box(body, stripe, 0, 1.136, 1.6, .42, .015, .37);
      box(body, stripe, 0, .697, 2.132, .41, .27, .015);
      box(body, ink, 0, .65, 2.165, .82, .275, .035);
      decal(body, '$PRINT', 0, .65, 2.187, .77, .24, '#fff4cb', '#1a1734');
      const roofNumber = decal(body, '42', 0, 1.483, -.13, .53, .52, '#21172a');
      roofNumber.rotation.x = -Math.PI / 2;
    }
    const wheels = [];
    for (const x of [-1.06, 1.06]) {
      for (const z of [-1.31, 1.28]) {
        const hub = new T.Group();
        hub.position.set(x, .45, z);
        body.add(hub);
        const axle = new T.Group();
        hub.add(axle);
        mesh(axle, wheelShape, tire, 0, 0, 0);
        mesh(axle, wheelRim, chrome, 0, 0, 0);
        for (let i = 0; i < 5; i++) {
          mesh(axle, spoke, ink, 0, 0, 0).rotation.x = i * Math.PI / 5;
        }
        wheels.push({hub, axle, front: z < 0});
      }
    }
    root.userData = {body, wheels};
    return root;
  }

  function truck(type) {
    const group = new T.Group();
    const paint = material(CARS[type], .6);
    const trim = material(type === 0 ? 0xbc9272 : 0x6c96c0, .55);
    const length = type === 2 ? 3.7 : 5.7;
    const high = type === 2 ? 2.05 : 2.74;
    shadow(group, 3.3, length + 1.3, -.35);
    box(group, ink, 0, .51, 0, 2.48, .32, length);
    box(group, paint, 0, 1.27, -length / 2 + .1, 2.4, 1.78, 1.38);
    box(group, glass, 0, 1.74, -length / 2 - .61, 1.91, .51, .025);
    box(group, paint, 0, high / 2 + .63, .42, 2.53, high - .35, length - 1.08);
    const rear = length / 2 - .12;
    for (const x of [-1.19, 0, 1.19]) box(group, trim, x, high / 2 + .63, rear, .08, high - .32, .08);
    for (const y of [.79, high + .45]) box(group, trim, 0, y, rear, 2.51, .07, .08);
    for (const x of [-1.22, 1.22]) {
      for (let j = 0; j < 7; j++) box(group, trim, x, 1 + j * (high - .50) / 7, .44, .07, .035, length - 1.1);
    }
    const wheels = [];
    for (const x of [-.92, .92]) {
      box(group, red, x, .56, rear + .16, .37, .18, .1);
      for (const z of [-1.6, .87, 1.60]) {
        const axle = new T.Group();
        axle.position.set(x * 1.17, .43, z);
        group.add(axle);
        mesh(axle, wheelShape, tire, 0, 0, 0);
        mesh(axle, wheelRim, chrome, 0, 0, 0);
        mesh(axle, spoke, ink, 0, 0, 0);
        wheels.push({axle});
      }
    }
    group.userData.wheels = wheels;
    const words = TAGS[type].split(' ');
    decal(group, words.join('|'), 0, high * .58 + .7, rear + .055, 2.24, 1.05);
    return group;
  }

  const bugShell = material(0x331345, .37, .48);
  const bugLight = neon(0xff48d5);
  const bugEyes = neon(0xffcf62);
  function bug() {
    const group = new T.Group();
    shadow(group, 2.7, 2.25);
    const chassis = new T.Group();
    group.add(chassis);
    mesh(chassis, new T.IcosahedronGeometry(1, 0), bugShell, 0, .74, 0, .91, .52, .94);
    mesh(chassis, sphere, bugLight, 0, .99, .29, .27, .095, .34);
    for (const side of [-1, 1]) {
      mesh(chassis, sphere, bugEyes, side * .29, .76, .74, .10, .09, .09);
      for (let leg = 0; leg < 3; leg++) {
        const z = (leg - 1) * .52;
        box(chassis, bugShell, side * .79, .51, z, .72, .13, .16).rotation.z = side * -.38;
        box(chassis, bugLight, side * 1.12, .28, z, .37, .085, .095).rotation.z = side * -.70;
      }
    }
    halo(chassis, 0xff36b9, 0, .65, .72, 1.5, .76);
    group.userData.bug = chassis;
    return group;
  }

  const tokenMaterials = {coin: neon(0xffd34d), gem: neon(0xd676ff), boost: blue, deadline: neon(0x97ffb2)};
  const tokenShapes = {
    coin: new T.CylinderGeometry(.31, .31, .10, 18).rotateX(Math.PI / 2),
    gem: new T.OctahedronGeometry(.39),
    boost: new T.OctahedronGeometry(.36),
    deadline: new T.CylinderGeometry(.36, .36, .11, 18).rotateX(Math.PI / 2),
  };
  function pickup(kind) {
    const root = new T.Group();
    shadow(root, .98, .98);
    const token = new T.Group();
    root.add(token);
    mesh(token, tokenShapes[kind], tokenMaterials[kind], 0, 0, 0);
    halo(token, tokenMaterials[kind].color.getHex(), 0, 0, .13, 1.1, 1.1);
    if (kind === 'deadline') {
      box(token, ink, 0, .085, .074, .048, .18, .035);
      box(token, ink, .075, .008, .075, .17, .046, .035);
    } else if (kind === 'boost') {
      const lightning = decal(token, '⚡', 0, 0, .37, .54, .56, '#ffffff');
      lightning.material.depthTest = false;
    }
    root.userData.token = token;
    return root;
  }

  const boothMetal = material(0x252051, .45, .25);
  const boothTrim = material(0x654b98, .48, .28);
  const darkPurple = material(0x491288);
  const octopusArt = document.createElement('canvas');
  octopusArt.width = octopusArt.height = 144;
  const octopusContext = octopusArt.getContext('2d');
  octopusContext.setTransform(6, 0, 0, 6, 10, 12);
  octopusContext.fillStyle = '#fff7ff';
  octopusContext.fill(new Path2D(CHAINGUARD_OCTOPUS), 'evenodd');
  const octopusTexture = new T.CanvasTexture(octopusArt);
  octopusTexture.colorSpace = T.SRGBColorSpace;
  const octopusMaterial = new T.MeshBasicMaterial({
    map: octopusTexture, transparent: true, depthWrite: false, toneMapped: false,
  });
  const octopusGeometry = new T.PlaneGeometry(.92, .92);
  const closedPanel = new T.MeshStandardMaterial({
    color: 0x971921, emissive: 0xc71b24, emissiveIntensity: .28, roughness: .46,
  });
  const green = neon(0x91ffc4);
  const roof = new T.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4);
  function makePlaza(open) {
    const group = new T.Group();
    for (let i = 0; i <= 5; i++) {
      const x = i * LANE - HALF;
      box(group, boothTrim, x, .15, 0, .70, .30, 2.35);
      box(group, boothMetal, x, 1.62, 0, .52, 3.04, 1.35);
      box(group, boothTrim, x, 2.78, .08, .60, .25, 1.44);
      box(group, amber, x, 1.26, .691, .115, .88, .035);
      halo(group, 0xffa04a, x, 1.26, .73, .48, 1.42);
    }
    const arms = [];
    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * LANE;
      const clear = lane === open;
      box(group, boothMetal, x, 3.41, 0, LANE + .03, .49, 1.62);
      mesh(group, roof, boothTrim, x, 4.03, -.01, LANE * .7, .88, 1.35);
      box(group, clear ? darkPurple : closedPanel, x, 3.25, .91, 2.53, .94, .28);
      box(group, clear ? purple : red, x, 3.74, 1.059, 2.56, .055, .035);
      if (clear) {
        mesh(group, octopusGeometry, octopusMaterial, x, 3.32, 1.063);
        decal(group, '▼', x, 2.91, 1.069, .71, .42, '#a5ffcd');
      } else {
        for (const angle of [-Math.PI / 4, Math.PI / 4]) {
          box(group, stripe, x, 3.19, 1.068, .54, .095, .026).rotation.z = angle;
        }
      }
      const pivot = new T.Group();
      pivot.position.set(x - 1.48, .96, .30);
      group.add(pivot);
      box(pivot, stripe, 1.35, 0, 0, 2.7, .14, .17);
      for (let marker = .22; marker < 2.65; marker += .38) {
        box(pivot, clear ? purple : red, marker, 0, .095, .14, .14, .022).rotation.z = -.24;
      }
      pivot.rotation.z = clear ? 1.09 : 0;
      arms.push(pivot);
      if (clear) {
        halo(group, 0xbd36ff, x, 3.27, 1.13, 3.42, 1.75);
        box(group, green, x, 2.58, 1.057, .49, .047, .041);
        box(group, purple, x, .028, 1.12, 2.40, .021, .075);
      }
    }
    const signX = LANE * 1.22;
    box(group, boothMetal, signX + 1.6, 4.64, -.46, .15, 1.93, .2);
    box(group, boothMetal, signX, 5.38, -.36, 3.85, 1.22, .20);
    decal(group, '↑ PRODUCTION|1 MILE', signX, 5.38, -.25, 3.67, 1.12, '#ceffb0', '#0a512c');
    group.userData.arms = arms;
    scene.add(group);
    return group;
  }

  const dirt = material(0x291a58, .96);
  const asphalt = new T.MeshLambertMaterial({color: 0x17297d});
  const asphaltArt = document.createElement('canvas');
  asphaltArt.width = asphaltArt.height = 128;
  const pavement = asphaltArt.getContext('2d');
  pavement.fillStyle = '#aaaec4';
  pavement.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1350; i++) {
    pavement.fillStyle = i % 3 ? '#d4e2f16b' : '#28345375';
    pavement.fillRect((i * 67.31) % 128, (i * 11.67) % 128, 1, i % 4 + 1);
  }
  const pavementTexture = new T.CanvasTexture(asphaltArt);
  pavementTexture.wrapS = pavementTexture.wrapT = T.RepeatWrapping;
  pavementTexture.repeat.set(10, 210);
  asphalt.map = pavementTexture;
  const shoulder = material(0x382365, .72);
  const dash = neon(0xe5dcff);
  mesh(scene, flat, dirt, 0, -.03, -146, 800, 1, 450);
  mesh(scene, flat, asphalt, 0, 0, -145, HALF * 2, 1, 400);
  for (const side of [-1, 1]) {
    mesh(scene, flat, shoulder, side * (HALF + .31), .011, -145, .65, 1, 400);
    box(scene, purple, side * HALF, .026, -145, .072, .037, 400);
  }

  const markerCount = 68;
  const markings = new T.InstancedMesh(cube, dash, markerCount * 4);
  const posts = new T.InstancedMesh(cube, boothTrim, markerCount * 2);
  const reflectors = new T.InstancedMesh(cube, amber, markerCount * 2);
  const arrows = new T.InstancedMesh(new T.ConeGeometry(.20, .57, 3).rotateX(-Math.PI / 2), purple, 13);
  const bugPaths = new T.InstancedMesh(cube, neon(0xfb4dd0), 24);
  const exhaust = new T.InstancedMesh(cube, neon(0x73eaff), 28);
  const dummy = new T.Object3D();
  for (const instances of [markings, posts, reflectors, arrows]) {
    instances.frustumCulled = false;
    instances.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(instances);
  }
  for (const instances of [bugPaths, exhaust]) {
    instances.frustumCulled = false;
    instances.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(instances);
  }
  function place(instances, index, x, y, z, sx, sy, sz) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
  }

  const palmTrunk = new T.CylinderGeometry(.10, .22, 4.6, 7);
  const bark = material(0x30204a);
  const leaf = material(0x441c60);
  leaf.side = T.DoubleSide;
  const blade = new T.BufferGeometry();
  blade.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, 0, .95, .41, .30, 1.68, .09, 0, 2.41, -.65, 0, 1.02, .07, -.31,
  ], 3));
  blade.setIndex([0, 1, 2, 0, 2, 4, 1, 3, 2, 2, 3, 4]);
  blade.computeVertexNormals();
  const palms = [];
  for (let i = 0; i < 22; i++) {
    const palm = new T.Group();
    mesh(palm, palmTrunk, bark, 0, 2.28, 0).rotation.z = .12;
    for (let branch = 0; branch < 7; branch++) {
      mesh(palm, blade, leaf, -.24, 4.48, 0, 1.12, 1.1, 1.15).rotation.y = branch * 2.4;
    }
    palm.position.x = (i % 2 ? -1 : 1) * (HALF + 2.6 + i % 4 * 1.8);
    palm.rotation.y = i * 1.31;
    palm.scale.setScalar(1 + i % 4 * .12);
    palms.push(palm);
    scene.add(palm);
  }

  function backdrop(aspect) {
    const art = document.createElement('canvas');
    art.width = 1024;
    art.height = 576;
    const c = art.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, 340);
    for (const [t, color] of [[0,'#201074'], [.27,'#621483'], [.51,'#c92773'], [.77,'#fa5e34'], [1,'#ffa537']]) sky.addColorStop(t, color);
    c.fillStyle = sky;
    c.fillRect(0, 0, 1024, 576);
    const sunX = 520, sunY = aspect < .85 ? 172 : 175;
    const radius = aspect < .85 ? 50 : 78;
    const aura = c.createRadialGradient(sunX, sunY, 20, sunX, sunY, 153);
    aura.addColorStop(0, '#ffd9689a');
    aura.addColorStop(1, '#ff8d2600');
    c.fillStyle = aura;
    c.fillRect(0, 0, 1024, 576);
    c.save();
    c.translate(sunX, sunY);
    c.scale((16 / 9) / aspect, 1);
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.clip();
    const sun = c.createLinearGradient(0, -radius, 0, radius);
    sun.addColorStop(0, '#fff49c');
    sun.addColorStop(.56, '#ffbd37');
    sun.addColorStop(1, '#ff8034');
    c.fillStyle = sun;
    c.fillRect(-radius, -radius, radius * 2, radius * 2);
    c.fillStyle = '#ec542d';
    for (let i = 0; i < 6; i++) c.fillRect(-radius, i * 13 - 5, radius * 2, 2 + i * .65);
    c.restore();
    for (let layer = 0; layer < 3; layer++) {
      c.beginPath();
      c.moveTo(0, 576);
      for (let x = 0; x <= 1024; x += 16) {
        const envelope = Math.min(1, Math.abs(x - 512) / 265);
        const peaks = Math.abs(Math.sin(x * .018 + layer)) * 45 + Math.sin(x * .071 + layer) * 12;
        c.lineTo(x, 251 + layer * 20 - peaks * envelope);
      }
      c.lineTo(1024, 576);
      c.fillStyle = ['#b74785', '#6b3883', '#47255f'][layer];
      c.fill();
    }
    const texture = new T.CanvasTexture(art);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }

  const player = sportsCar(0xff591a, true);
  scene.add(player);
  const jetShape = new T.ConeGeometry(.14, 1.1, 9).rotateX(Math.PI / 2);
  const jets = [-.71, .71].map(x => mesh(player.userData.body, jetShape, blue, x, .32, 2.64));
  const scenery = new Map();
  const traffic = new Map();
  const pool = new Map();
  let chaseX = 0;
  let cameraFov = 55;
  let aspect = 1;

  function resize(w, h) {
    if (!w || !h) return;
    aspect = w / h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, aspect < .85 ? 1.55 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    scene.background?.dispose();
    scene.background = backdrop(aspect);
  }

  function animateRoad(distance, gateDistance, purpleLane) {
    const travel = distance * DEPTH;
    pavementTexture.offset.y = (travel * 210 / 400) % 1;
    const loop = markerCount * 5.5;
    for (let i = 0; i < markerCount; i++) {
      const z = 8 - (i * 5.5 - travel % loop + loop) % loop;
      for (let lane = 0; lane < 4; lane++) {
        place(markings, i * 4 + lane, (lane - 1.5) * LANE, .017, z, .069, .018, 2.72);
      }
      for (let side = 0; side < 2; side++) {
        const x = (side ? -1 : 1) * (HALF + .44);
        place(posts, i * 2 + side, x, .39, z, .16, .78, .18);
        place(reflectors, i * 2 + side, x, .69, z + .11, .16, .12, .06);
      }
    }
    for (let i = 0; i < 13; i++) {
      const depth = gateDistance - 12 - i * 12;
      const show = depth > -13;
      place(arrows, i, (purpleLane - 2) * LANE, .026, -depth * DEPTH, show ? 1 : 0, 1, show ? 1 : 0);
    }
    for (const instances of [markings, posts, reflectors, arrows]) instances.instanceMatrix.needsUpdate = true;
    palms.forEach((p, i) => { p.position.z = 10 - (Math.floor(i / 2) * 25 + i % 2 * 5 - travel % 275 + 275) % 275; });
  }

  function draw(run, mode, distance, now, dt) {
    const intro = mode === 'intro';
    const inMotion = mode === 'play';
    const steer = intro ? 0 : run.steering.position;
    const input = reducedMotion.matches ? 0 : T.MathUtils.clamp(run.steering.velocity / 2.6, -1, 1);
    const speed = inMotion ? run.speed / TURBO_SPEED : 0;
    const sceneDistance = intro ? 0 : run.distance;
    const gateDistance = intro ? 67 : run.plaza - sceneDistance;
    const open = intro ? 3 : run.purple;
    animateRoad(intro ? distance : sceneDistance, gateDistance, open);

    const gates = intro ? [{z: 67, purple: 3}] : [{z: run.plaza, purple: run.purple}, ...(run.passedPlaza ? [run.passedPlaza] : [])];
    const gateKeys = new Set();
    for (const gate of gates) {
      const key = gate.z + ':' + gate.purple;
      gateKeys.add(key);
      if (!scenery.has(key)) scenery.set(key, makePlaza(gate.purple));
      const model = scenery.get(key);
      model.position.z = -(gate.z - sceneDistance) * DEPTH;
      for (const [lane, arm] of model.userData.arms.entries()) {
        if (lane === gate.purple) continue;
        let lift = 0;
        if (gate.stoppedLane === lane) {
          lift = T.MathUtils.smoothstep(gate.waited, gate.duration - .65, gate.duration);
        } else if (!intro && Math.abs(gate.z - sceneDistance) > 32) {
          for (const vehicle of run.objects) {
            if (vehicle.kind !== 'hazard' || vehicle.lane !== lane) continue;
            const gap = Math.abs(gate.z - vehicle.z);
            lift = Math.max(lift, 1 - T.MathUtils.smoothstep(gap, 9, 28));
          }
        }
        arm.rotation.z += (lift * 1.09 - arm.rotation.z) * (1 - Math.exp(-16 * dt));
      }
    }
    for (const [key, model] of scenery) {
      if (!gateKeys.has(key)) {
        scene.remove(model);
        model.traverse(node => {
          if (node.isMesh && node.geometry.type === 'PlaneGeometry' && node.geometry !== flat && node.geometry !== octopusGeometry) node.geometry.dispose();
        });
        scenery.delete(key);
      }
    }

    const visible = new Set();
    let bugPathCount = 0;
    for (const item of intro ? attract : run.objects) {
      const relative = item.z - sceneDistance;
      if (relative > LOOKAHEAD || relative < -42 || (item.hit && item.kind !== 'hazard')) continue;
      visible.add(item);
      if (!traffic.has(item)) {
        const key = item.kind === 'hazard' ? 'hazard:' + item.type : item.kind;
        const model = pool.get(key)?.pop() ?? (item.kind !== 'hazard' ? pickup(item.kind)
          : item.type === 3 ? sportsCar(CARS[3]) : item.type === 6 ? bug() : truck(item.type));
        traffic.set(item, {key, model});
        scene.add(model);
      }
      const {model} = traffic.get(item);
      model.position.set(obstacleLane(item) * HALF, 0, -relative * DEPTH);
      if (model.userData.wheels && !intro) {
        for (const {axle} of model.userData.wheels) axle.rotation.x = -item.z * DEPTH / .45;
      }
      if (model.userData.bug) {
        const phase = item.phase ?? 0;
        model.userData.bug.position.y = reducedMotion.matches ? 0 : Math.sin(phase * 19) * .055;
        model.userData.bug.rotation.z = reducedMotion.matches ? 0 : Math.sin(phase * 12) * .12;
        if (relative < 145) {
          place(bugPaths, bugPathCount++, (lanePosition(item.lane) + lanePosition(item.sweepTo)) * HALF / 2,
            .035, model.position.z, LANE + .28, .02, .08 + (reducedMotion.matches ? 0 : Math.sin(phase * 12) ** 2 * .065));
        }
      }
      if (model.userData.token) {
        model.userData.token.position.y = .62 + .14 * Math.sin(now * .006 + item.z);
        model.userData.token.rotation.y = item.kind === 'deadline' ? Math.sin(now * .003) * .38 : now * .004 + item.z;
      }
    }
    for (const [item, entry] of traffic) {
      if (visible.has(item)) continue;
      scene.remove(entry.model);
      if (!pool.has(entry.key)) pool.set(entry.key, []);
      pool.get(entry.key).push(entry.model);
      traffic.delete(item);
    }

    bugPaths.count = bugPathCount;
    bugPaths.instanceMatrix.needsUpdate = true;
    player.position.x = steer * HALF;
    exhaust.count = speed > .27 && !reducedMotion.matches ? (run.boost ? 28 : 12) : 0;
    for (let particle = 0; particle < exhaust.count; particle++) {
      const age = (sceneDistance * .055 + particle * .173) % 1;
      const side = particle % 2 ? -1 : 1;
      const fade = 1 - age;
      place(exhaust, particle, player.position.x + side * (.7 + age * .20) - input * age * .36,
        .25 + age * .24, 2.19 + age * (run.boost ? 3.3 : 1.65), .027 * fade, .026 * fade,
        (.09 + speed * .19) * fade);
    }
    exhaust.instanceMatrix.needsUpdate = true;
    const body = player.userData.body;
    body.position.y = reducedMotion.matches ? 0 : speed * (.025 * Math.sin(sceneDistance * .74) + .014 * Math.sin(sceneDistance * 1.3));
    body.rotation.z = -input * .086;
    body.rotation.y = -input * .19 + (run.spin && inMotion ? Math.sin(now * .026) * run.spin * .43 : 0);
    body.rotation.x = reducedMotion.matches ? 0 : run.boost ? -.045 : speed * .016;
    for (const {hub, axle, front} of player.userData.wheels) {
      hub.rotation.y = front ? -input * .29 : 0;
      axle.rotation.x = -sceneDistance * DEPTH / .45;
    }
    jets.forEach((jet, i) => {
      jet.visible = inMotion && speed > .4;
      jet.scale.z = run.boost ? (reducedMotion.matches ? .8 : 1 + Math.sin(sceneDistance * .81 + i) * .24) : .27;
      jet.position.z = run.boost ? 2.64 : 2.27;
    });
    const tall = aspect < .85;
    chaseX += (player.position.x * (tall ? .91 : .57) - chaseX) * (1 - Math.exp(-7.5 * dt));
    const targetFov = (tall ? 70 : 49) + (reducedMotion.matches ? 0 : speed * 4 + (run.boost && inMotion ? 5 : 0));
    cameraFov += (targetFov - cameraFov) * (1 - Math.exp(-5 * dt));
    camera.fov = cameraFov;
    camera.updateProjectionMatrix();
    const cameraZ = tall ? (intro ? 15 : 12.5) : intro ? 11.6 : 8.8;
    camera.position.set(chaseX, tall ? 5.1 : intro ? 4.35 : 3.95, cameraZ);
    camera.lookAt(chaseX * (tall ? .89 : .52) + input * .24, tall ? (intro ? .45 : 1.9) : intro ? .10 : 1.44, -21);
    renderer.render(scene, camera);
  }

  return {resize, draw};
}
