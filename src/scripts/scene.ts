import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  LinearFilter,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

// Shapes, in scroll order: sphere (hero) → galaxy (services) → "01" (manifesto)
// → wave terrain (process) → ring (contact).
export const SHAPES = 5;

export interface StateConfig {
  x: number;
  opacity: number;
}

export interface ParticleScene {
  goTo: (index: number) => void;
  intro: (duration?: number) => void;
  setVelocity: (v: number) => void;
  destroy: () => void;
  state: { intro: number };
}

const noiseGLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uIntro;
uniform float uSize;
uniform float uPixelRatio;
uniform float uAspect;
uniform float uVelocity;
uniform vec2 uMouse;
uniform float uMouseStrength;

attribute vec3 aS1;
attribute vec3 aS2;
attribute vec3 aS3;
attribute vec3 aS4;
attribute float aRandom;
attribute float aDigit;

varying vec3 vColor;
varying float vAlpha;
varying float vDigit;

${noiseGLSL}

vec3 shapeAt(float i){
  if(i < 0.5) return position;
  if(i < 1.5) return aS1;
  if(i < 2.5) return aS2;
  if(i < 3.5) return aS3;
  return aS4;
}

void main(){
  float f = floor(uMorph);
  float t = uMorph - f;
  // Stagger each particle so morphs feel like a swarm instead of a lerp
  float lt = clamp((t - aRandom * 0.4) / 0.6, 0.0, 1.0);
  lt = lt * lt * (3.0 - 2.0 * lt);
  vec3 pos = mix(shapeAt(f), shapeAt(min(f + 1.0, 4.0)), lt);
  float transition = sin(lt * 3.14159);

  // Extra motion on the wave terrain
  float wWave = 1.0 - clamp(abs(uMorph - 3.0), 0.0, 1.0);
  pos.y += sin(pos.x * 1.1 + uTime * 1.2) * cos(pos.z * 0.9 + uTime * 0.8) * 0.35 * wWave;

  // Intro: particles fly in from far away
  float it = clamp((uIntro * 1.6 - aRandom * 0.6), 0.0, 1.0);
  it = 1.0 - pow(1.0 - it, 3.0);
  vec3 dir = normalize(position + vec3(0.0001));
  vec3 scattered = dir * (9.0 + aRandom * 14.0) + vec3(0.0, 0.0, 6.0 * aRandom);
  pos = mix(scattered, pos, it);

  float n = snoise(pos * 0.55 + uTime * 0.12);
  float amp = 0.1 + transition * 0.9 + uVelocity * 0.6;
  pos += normalize(pos + vec3(0.0001)) * n * amp;
  pos += vec3(
    snoise(pos * 0.8 + vec3(uTime * 0.2)),
    snoise(pos * 0.8 + vec3(31.0 + uTime * 0.2)),
    snoise(pos * 0.8 + vec3(77.0 + uTime * 0.2))
  ) * (transition * 0.6 + uVelocity * 0.25);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float dist = length(d);
  float force = smoothstep(0.32, 0.0, dist) * uMouseStrength;
  vec2 push = normalize(d + vec2(0.0001));
  push.x /= uAspect;
  mv.xy += push * force * 1.1;
  mv.z += force * 0.8;
  gl_Position = projectionMatrix * mv;

  float size = uSize * (0.35 + aRandom * 0.9) * (aDigit > 0.5 ? 3.2 : 1.0);
  gl_PointSize = size * uPixelRatio * (10.0 / -mv.z);

  float c = clamp(pos.y * 0.16 + 0.5 + n * 0.25 + pos.x * 0.05, 0.0, 1.0);
  vec3 blue = vec3(0.0, 0.76, 1.0);
  vec3 purple = vec3(0.62, 0.0, 1.0);
  vec3 pink = vec3(1.0, 0.0, 0.83);
  vec3 col = mix(blue, purple, smoothstep(0.0, 0.55, c));
  col = mix(col, pink, smoothstep(0.55, 1.0, c));
  col = mix(col, vec3(1.0), force * 0.7 + step(0.985, aRandom) * 0.6);

  vColor = col;
  vDigit = aDigit;
  vAlpha = (0.3 + aRandom * 0.7) * smoothstep(22.0, 6.0, -mv.z) * (0.4 + it * 0.6);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uGlyphs;
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
varying float vDigit;

void main(){
  vec2 uv = gl_PointCoord;
  float a;
  if(vDigit < 0.5){
    float d = length(uv - 0.5);
    a = pow(smoothstep(0.5, 0.0, d), 1.8);
  } else {
    a = texture2D(uGlyphs, vec2((uv.x + (vDigit - 1.0)) * 0.5, 1.0 - uv.y)).r;
  }
  if(a < 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
}
`;

function makeGlyphTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#fff";
  g.font = "700 54px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("0", 32, 35);
  g.fillText("1", 96, 35);
  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  return tex;
}

function sampleText(text: string, count: number, out: Float32Array) {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.font = "900 230px Inter, Outfit, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 10);
  const data = g.getImageData(0, 0, w, h).data;
  const pts: number[] = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push(x, y);
    }
  }
  const n = pts.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * n) * 2;
    out[i * 3] = ((pts[k] + Math.random() * 2) / w - 0.5) * 8;
    out[i * 3 + 1] = -((pts[k + 1] + Math.random() * 2) / h - 0.5) * 4;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
  }
}

function buildShapes(count: number) {
  const sphere = new Float32Array(count * 3);
  const galaxy = new Float32Array(count * 3);
  const digits = new Float32Array(count * 3);
  const wave = new Float32Array(count * 3);
  const ring = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Fibonacci sphere, with some particles in the core for depth
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const rad = Math.random() < 0.85 ? 2.4 : 2.4 * Math.cbrt(Math.random());
    sphere[i3] = Math.cos(th) * r * rad;
    sphere[i3 + 1] = y * rad;
    sphere[i3 + 2] = Math.sin(th) * r * rad;

    // Three-arm spiral galaxy, tilted toward the camera
    const arm = i % 3;
    const gr = Math.pow(Math.random(), 1.6) * 5;
    const ga = (arm / 3) * Math.PI * 2 + gr * 1.1 + (Math.random() - 0.5) * (0.6 / (gr + 0.4));
    const gx = Math.cos(ga) * gr;
    const gz = Math.sin(ga) * gr;
    const gy = (Math.random() - 0.5) * 0.35 * (1.2 - gr / 5);
    const tilt = 1.05;
    galaxy[i3] = gx;
    galaxy[i3 + 1] = gy * Math.cos(tilt) - gz * Math.sin(tilt);
    galaxy[i3 + 2] = gy * Math.sin(tilt) + gz * Math.cos(tilt);

    // Wave terrain seen from slightly above
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    const wx = (cx / cols - 0.5) * 14;
    const wz = (cz / rows - 0.5) * 9;
    const wy = Math.sin(wx * 0.6) * Math.cos(wz * 0.5) * 0.5 - 1.4;
    wave[i3] = wx;
    wave[i3 + 1] = wy * Math.cos(0.5) - wz * Math.sin(0.5);
    wave[i3 + 2] = wy * Math.sin(0.5) + wz * Math.cos(0.5);

    // Torus ring
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const R = 2.7;
    const tr = 0.35 + Math.random() * 0.25;
    const rx = (R + tr * Math.cos(v)) * Math.cos(u);
    const ry = (R + tr * Math.cos(v)) * Math.sin(u);
    const rz = tr * Math.sin(v);
    const rt = 1.15;
    ring[i3] = rx;
    ring[i3 + 1] = ry * Math.cos(rt) - rz * Math.sin(rt);
    ring[i3 + 2] = ry * Math.sin(rt) + rz * Math.cos(rt);
  }
  sampleText("01", count, digits);
  return [sphere, galaxy, digits, wave, ring];
}

export function createScene(
  canvas: HTMLCanvasElement,
  states: (isMobile: boolean) => StateConfig[],
): ParticleScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  let isMobile = window.matchMedia("(max-width: 768px)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = isMobile ? 7000 : 16000;

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const shapes = buildShapes(count);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(shapes[0], 3));
  geometry.setAttribute("aS1", new BufferAttribute(shapes[1], 3));
  geometry.setAttribute("aS2", new BufferAttribute(shapes[2], 3));
  geometry.setAttribute("aS3", new BufferAttribute(shapes[3], 3));
  geometry.setAttribute("aS4", new BufferAttribute(shapes[4], 3));
  const randoms = new Float32Array(count);
  const digitsAttr = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    randoms[i] = Math.random();
    const r = Math.random();
    digitsAttr[i] = r < 0.07 ? 1 : r < 0.14 ? 2 : 0;
  }
  geometry.setAttribute("aRandom", new BufferAttribute(randoms, 1));
  geometry.setAttribute("aDigit", new BufferAttribute(digitsAttr, 1));
  geometry.boundingSphere = new Sphere(new Vector3(), 30);

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uIntro: { value: 0 },
    uSize: { value: isMobile ? 2.6 : 2.2 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uAspect: { value: 1 },
    uVelocity: { value: 0 },
    uMouse: { value: new Vector2(9, 9) },
    uMouseStrength: { value: 0 },
    uOpacity: { value: 1 },
    uGlyphs: { value: makeGlyphTexture() },
  };

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  const group = new Group();
  group.add(points);
  scene.add(group);

  let configs = states(isMobile);
  const target = { morph: 0, x: configs[0].x, opacity: configs[0].opacity };
  const current = { ...target };
  group.position.x = current.x;
  const mouse = { x: 9, y: 9, tx: 9, ty: 9, active: 0 };
  const sceneState = { intro: 0 };
  let velocity = 0;

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    isMobile = window.matchMedia("(max-width: 768px)").matches;
    configs = states(isMobile);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
    const s = Math.min(1, Math.max(0.55, (w / h) / 1.25));
    group.scale.setScalar(s);
    const cfg = configs[Math.round(target.morph)];
    target.x = cfg.x;
  };
  resize();
  window.addEventListener("resize", resize);

  const onMove = (e: PointerEvent) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    mouse.active = 1;
  };
  const onLeave = () => (mouse.active = 0);
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);

  let last = performance.now();
  let raf = 0;
  const tick = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    uniforms.uTime.value += dt * (reduced ? 0.2 : 1);

    current.morph += (target.morph - current.morph) * Math.min(1, dt * 2.2);
    current.x += (target.x - current.x) * Math.min(1, dt * 2.5);
    current.opacity += (target.opacity - current.opacity) * Math.min(1, dt * 3);
    uniforms.uMorph.value = current.morph;
    uniforms.uOpacity.value = current.opacity;
    uniforms.uIntro.value = sceneState.intro;
    group.position.x = current.x;

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 6);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 6);
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uMouseStrength.value +=
      (mouse.active - uniforms.uMouseStrength.value) * Math.min(1, dt * 3);

    velocity *= 0.92;
    uniforms.uVelocity.value += (Math.min(velocity, 2) - uniforms.uVelocity.value) * 0.1;

    const time = uniforms.uTime.value;
    const mx = mouse.active ? mouse.x : 0;
    const my = mouse.active ? mouse.y : 0;
    group.rotation.y += (Math.sin(time * 0.15) * 0.5 + mx * 0.35 - group.rotation.y) * 0.04;
    group.rotation.x += (-my * 0.2 + Math.cos(time * 0.11) * 0.08 - group.rotation.x) * 0.04;
    group.rotation.z = Math.sin(time * 0.07) * 0.05;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    state: sceneState,
    goTo(index: number) {
      const i = Math.max(0, Math.min(SHAPES - 1, index));
      target.morph = i;
      target.x = configs[i].x;
      target.opacity = configs[i].opacity;
    },
    intro(duration = 2.4) {
      const start = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - start) / (duration * 1000));
        sceneState.intro = p;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    setVelocity(v: number) {
      velocity = Math.max(velocity, Math.abs(v));
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
