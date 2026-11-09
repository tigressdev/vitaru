import { buildShapes, STRIDE, type Shape } from './shapes';

// A single WebGL point cloud behind the page. Each section names a shape; scrolling between
// sections morphs one into the next. Without WebGL, the static SVG helix stays visible instead.

const VERT = `
attribute vec4 aFrom; attribute vec4 aTo; attribute vec3 aCFrom; attribute vec3 aCTo; attribute vec2 aR;
uniform float uT, uTime, uAspect, uScale, uOx, uDpr, uAlpha;
uniform vec2 uSpinF, uSpinT;
varying vec3 vC; varying float vA;

vec3 turn(vec3 p, vec2 s) {
  float a = uTime * .16 * s.x; float c = cos(a), n = sin(a);
  p = vec3(c * p.x + n * p.z, p.y, -n * p.x + c * p.z);
  a = uTime * .07 * s.y; c = cos(a); n = sin(a);
  return vec3(c * p.x - n * p.y, n * p.x + c * p.y, p.z);
}

void main() {
  float start = aR.x * .42;
  float m = smoothstep(start, start + .58, uT);
  vec3 p = mix(turn(aFrom.xyz, uSpinF), turn(aTo.xyz, uSpinT), m);
  float arc = sin(3.14159 * m);
  p += arc * vec3((aR.y - .5) * .7, (aR.x - .5) * .5, (aR.y - .3) * .6);
  p += .005 * vec3(sin(uTime * .9 + aR.x * 40.), cos(uTime * .7 + aR.y * 40.), 0.);

  float phase = mix(aFrom.w, aTo.w, m);
  // One sweep every ~9 s, the period of the orbit in the original pitch.
  float wave = pow(.5 + .5 * sin(phase * 6.2832 - uTime * .7), 18.);
  float depth = 1. / (1. + p.z * .35);
  vec2 q = p.xy * depth * uScale;
  q.x = q.x / uAspect + uOx;
  gl_Position = vec4(q, 0., 1.);
  gl_PointSize = (1.3 + aR.y * 1.3 + wave * 2.1) * uDpr * depth;
  vC = mix(aCFrom, aCTo, m);
  vA = (.4 + wave * .6) * uAlpha * (.72 + .28 * depth);
}`;

const FRAG = `
precision mediump float;
varying vec3 vC; varying float vA;
void main() {
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .12, d);
  gl_FragColor = vec4(vC, a * vA);
}`;

export interface FieldOptions {
  canvas: HTMLCanvasElement;
  sections: HTMLElement[];
  reducedMotion: boolean;
  onScene: (index: number) => void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export interface FieldController {
  /** Replace the sections that drive the figure, for example after switching tabs. */
  setSections: (next: HTMLElement[]) => void;
  /** Drive the figure from something other than scroll position, as the demo screens do. */
  setDriver: (driver: () => number) => void;
  /** Redraw at once; needed only under reduced motion, where no animation loop runs. */
  refresh: () => void;
}

/** Returns null when WebGL is unavailable, so the caller can keep the static fallback. */
export function startField({ canvas, sections: initialSections, reducedMotion, onScene }: FieldOptions): FieldController | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, powerPreference: 'low-power' });
  if (!gl) return null;
  let sections = initialSections;
  let driver: (() => number) | null = null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  const compact = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const N = compact ? 6000 : 13000;
  const shapes = buildShapes(N);
  const buffers = new Map<Shape, WebGLBuffer>();
  for (const s of Object.values(shapes)) {
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, s.data, gl.STATIC_DRAW);
    buffers.set(s, b);
  }

  const rand = new Float32Array(N * 2).map(() => Math.random());
  const randBuf = gl.createBuffer()!;
  const aR = gl.getAttribLocation(prog, 'aR');
  gl.bindBuffer(gl.ARRAY_BUFFER, randBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aR);
  gl.vertexAttribPointer(aR, 2, gl.FLOAT, false, 0, 0);

  const attr = (name: string) => {
    const l = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(l);
    return l;
  };
  const aFrom = attr('aFrom'), aTo = attr('aTo'), aCFrom = attr('aCFrom'), aCTo = attr('aCTo');
  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uT = u('uT'), uTime = u('uTime'), uAspect = u('uAspect'), uScale = u('uScale'),
    uOx = u('uOx'), uDpr = u('uDpr'), uAlpha = u('uAlpha'), uSpinF = u('uSpinF'), uSpinT = u('uSpinT');

  const sceneOf = (list: HTMLElement[]) => list.map((s) => shapes[s.dataset.scene ?? 'helix'] ?? shapes.helix);
  const dimOf = (list: HTMLElement[]) => list.map((s) => Number(s.dataset.dim ?? 1));
  let scene = sceneOf(sections);
  let dims = dimOf(sections);

  const stride = STRIDE * 4;
  let boundFrom: Shape | null = null, boundTo: Shape | null = null;
  function bind(from: Shape, to: Shape) {
    if (from === boundFrom && to === boundTo) return;
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffers.get(from)!);
    gl!.vertexAttribPointer(aFrom, 4, gl!.FLOAT, false, stride, 0);
    gl!.vertexAttribPointer(aCFrom, 3, gl!.FLOAT, false, stride, 16);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffers.get(to)!);
    gl!.vertexAttribPointer(aTo, 4, gl!.FLOAT, false, stride, 0);
    gl!.vertexAttribPointer(aCTo, 3, gl!.FLOAT, false, stride, 16);
    boundFrom = from; boundTo = to;
  }

  let bounds: { top: number; bottom: number }[] = [];
  let band = 400;
  let alphaBase = 1;
  function measure() {
    bounds = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY };
    });
    band = innerHeight * 0.7;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    const aspect = innerWidth / innerHeight;
    const wide = innerWidth >= 960;
    gl!.uniform1f(uAspect, aspect);
    gl!.uniform1f(uDpr, dpr);
    gl!.uniform1f(uScale, wide ? Math.min(0.7, aspect * 0.42) : Math.min(0.66, aspect * 0.88));
    gl!.uniform1f(uOx, wide ? 0.48 : 0);
    alphaBase = wide ? 1 : 0.42;
    measure();
  }

  function target(): number {
    if (driver) return driver();
    const y = scrollY + innerHeight * 0.55;
    for (let i = 0; i < sections.length - 1; i++) {
      const boundary = bounds[i].bottom;
      if (y < boundary - band / 2) return i;
      if (y <= boundary + band / 2) return i + (y - (boundary - band / 2)) / band;
    }
    return sections.length - 1;
  }

  let value = 0; // set from the scroll position once the sections are measured
  let shown = -1;

  function draw(time: number) {
    const i = Math.min(Math.floor(value), sections.length - 1);
    const j = Math.min(i + 1, sections.length - 1);
    const raw = value - i;
    const t = reducedMotion ? Math.round(raw) : raw;
    bind(scene[i], scene[j]);
    gl!.uniform1f(uT, t);
    gl!.uniform1f(uTime, time);
    gl!.uniform2f(uSpinF, scene[i].spin, scene[i].roll);
    gl!.uniform2f(uSpinT, scene[j].spin, scene[j].roll);
    gl!.uniform1f(uAlpha, alphaBase * (dims[i] + (dims[j] - dims[i]) * t));
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.drawArrays(gl!.POINTS, 0, N);
    const nearest = Math.round(value);
    if (nearest !== shown) { shown = nearest; onScene(nearest); }
  }

  let last = performance.now();
  function loop(ms: number) {
    // Time-based easing, so the figure tracks the scroll equally at any frame rate.
    const dt = Math.min(0.5, (ms - last) / 1000);
    last = ms;
    const goal = target();
    value += (goal - value) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(goal - value) < 0.0005) value = goal;
    draw(ms / 1000);
    requestAnimationFrame(loop);
  }

  addEventListener('resize', () => { resize(); if (reducedMotion) { value = target(); draw(0); } });
  new ResizeObserver(() => { measure(); if (reducedMotion) { value = target(); draw(0); } }).observe(document.body);
  resize();
  value = target();

  if (reducedMotion) {
    addEventListener('scroll', () => { value = target(); draw(0); }, { passive: true });
    draw(0);
  } else {
    requestAnimationFrame(loop);
  }

  return {
    setSections(next) {
      sections = next;
      scene = sceneOf(next);
      dims = dimOf(next);
      boundFrom = null;
      boundTo = null;
      shown = -1;
      measure();
      value = target();
      if (reducedMotion) draw(0);
    },
    setDriver(next) {
      driver = next;
      value = target();
      if (reducedMotion) draw(0);
    },
    refresh() {
      value = target();
      draw(0);
    },
  };
}
