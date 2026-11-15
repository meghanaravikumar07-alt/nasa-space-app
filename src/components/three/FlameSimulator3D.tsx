import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface FlameSimParams {
  gravityG: number;
  oxygenPct: number;
  pressureKpa: number;
  airflowCmS: number;
  fuelTempK: number;
  fuelType: string;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function FlameSimulator3D({
  params,
  heightClass = 'h-[420px]',
}: {
  params: FlameSimParams;
  heightClass?: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const paramsRef = useRef<FlameSimParams>(params);
  paramsRef.current = params;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d1d);
    scene.fog = new THREE.FogExp2(0x060d1d, 0.045);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 80);
    camera.position.set(0, 1.15, 5.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.6;
    controls.maxDistance = 9.0;
    controls.target.set(0, 0.45, 0);

    // 3-point laboratory chamber lighting
    scene.add(new THREE.HemisphereLight(0x38bdf8, 0x050b18, 0.65));
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const flamePointLight = new THREE.PointLight(0x38bdf8, 2.2, 8);
    flamePointLight.position.set(0, 0.55, 0);
    scene.add(flamePointLight);

    // Reference chamber floor grid
    const gridHelper = new THREE.GridHelper(6, 16, 0x1e3a8a, 0x0f172a);
    gridHelper.position.y = -0.65;
    scene.add(gridHelper);

    // Multi-part Test Rig / Sample Holder (4 parts)
    const rigGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.88, roughness: 0.3 });
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.1, roughness: 0.82 });
    const fuelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.05, roughness: 0.55, emissive: 0x2a0f04, emissiveIntensity: 0.35 });

    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.14, 32), steelMat);
    basePlate.position.y = -0.58;
    rigGroup.add(basePlate);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.58, 24), steelMat);
    pedestal.position.y = -0.22;
    rigGroup.add(pedestal);

    const ceramicInsulator = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24), ceramicMat);
    ceramicInsulator.position.y = 0.09;
    rigGroup.add(ceramicInsulator);

    const fuelSpecimen = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), fuelMat);
    fuelSpecimen.position.y = 0.25;
    rigGroup.add(fuelSpecimen);
    scene.add(rigGroup);

    // Dynamic Flame Volumetric Shader Mesh
    const flameUniforms = {
      uTime: { value: 0 },
      uGravity: { value: paramsRef.current.gravityG },
      uOxygen: { value: paramsRef.current.oxygenPct },
      uAirflow: { value: paramsRef.current.airflowCmS },
      uPressure: { value: paramsRef.current.pressureKpa },
    };

    const flameMat = new THREE.ShaderMaterial({
      uniforms: flameUniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uGravity;
        uniform float uOxygen;
        uniform float uAirflow;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          vec3 p = position;
          float gFactor = clamp(uGravity, 0.0, 1.0);
          float o2Factor = clamp((uOxygen - 14.0) / 18.0, 0.2, 1.5);
          float flowNorm = clamp(uAirflow / 35.0, 0.0, 1.0);

          // Buoyancy elongation in 1g vs spherical symmetry in 0g
          float yNorm = (p.y + 0.5) ; // ~0 to 1
          float radiusScale = mix(1.0 + o2Factor * 0.22, 0.72, gFactor);
          p.x *= radiusScale;
          p.z *= radiusScale;

          // Teardrop upward stretch when gravity > 0
          if (p.y > 0.0) {
            p.y *= mix(1.05 + o2Factor * 0.15, 2.35 + o2Factor * 0.5, gFactor);
            p.x *= mix(1.0, max(0.28, 1.0 - p.y * 0.38), gFactor);
            p.z *= mix(1.0, max(0.28, 1.0 - p.y * 0.38), gFactor);
          } else {
            p.y *= mix(1.0, 0.45, gFactor);
          }

          // Forced airflow wake deflection along +X
          p.x += flowNorm * max(0.0, p.y + 0.3) * 0.85;

          // Subtle convective flicker (stronger in 1g & high flow)
          float flickerAmp = mix(0.018, 0.075, max(gFactor, flowNorm * 0.7));
          float wave = sin(p.y * 6.5 - uTime * (3.0 + gFactor * 6.0)) * cos(p.x * 5.0 + uTime * 2.5);
          p.x += wave * flickerAmp;
          p.z += cos(p.y * 5.5 - uTime * 4.0) * flickerAmp * 0.6;

          vLocalPos = p;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uGravity;
        uniform float uOxygen;
        uniform float uPressure;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          float ndotv = max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
          float gFactor = clamp(uGravity, 0.0, 1.0);
          float o2Factor = clamp((uOxygen - 14.0) / 16.0, 0.0, 1.2);
          float pFactor = clamp(uPressure / 101.3, 0.4, 1.3);

          // Microgravity flames exhibit rich blue diffusion edges; 1g flames exhibit luminous yellow-orange soot cores
          vec3 blueShell = vec3(0.05, 0.72, 1.0);
          vec3 yellowSoot = vec3(1.0, 0.72, 0.16);
          vec3 orangePlume = vec3(0.96, 0.35, 0.08);
          vec3 whiteHot = vec3(1.0, 0.96, 0.85);

          float sootWeight = clamp(gFactor * 0.78 + o2Factor * 0.25 * pFactor, 0.08, 0.95);
          vec3 baseCol = mix(blueShell, mix(orangePlume, yellowSoot, ndotv), sootWeight);
          baseCol = mix(baseCol, blueShell, pow(1.0 - ndotv, 2.0) * (1.0 - gFactor * 0.45));
          baseCol = mix(baseCol, whiteHot, pow(ndotv, 3.0) * o2Factor * 0.45);

          float alpha = clamp(pow(ndotv, 0.75) * 0.72 + pow(1.0 - ndotv, 1.5) * 0.42, 0.1, 0.92);
          gl_FragColor = vec4(baseCol, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const flameMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 48, 48), flameMat);
    flameMesh.position.y = 0.25;
    scene.add(flameMesh);

    // Smoke / combustion product particles (120 particles)
    const pCount = 120;
    const pPositions = new Float32Array(pCount * 3);
    const pSeeds = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pSeeds[i * 3] = (Math.random() - 0.5) * 2;
      pSeeds[i * 3 + 1] = Math.random();
      pSeeds[i * 3 + 2] = (Math.random() - 0.5) * 2;
      pPositions[i * 3] = 0;
      pPositions[i * 3 + 1] = 0.3;
      pPositions[i * 3 + 2] = 0;
    }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.055,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const smokePoints = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokePoints);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const cur = paramsRef.current;

      flameUniforms.uTime.value = elapsed;
      flameUniforms.uGravity.value = THREE.MathUtils.damp(flameUniforms.uGravity.value, cur.gravityG, 5, delta);
      flameUniforms.uOxygen.value = THREE.MathUtils.damp(flameUniforms.uOxygen.value, cur.oxygenPct, 5, delta);
      flameUniforms.uAirflow.value = THREE.MathUtils.damp(flameUniforms.uAirflow.value, cur.airflowCmS, 5, delta);
      flameUniforms.uPressure.value = THREE.MathUtils.damp(flameUniforms.uPressure.value, cur.pressureKpa, 5, delta);

      // Update flame light hue and intensity smoothly
      const gNow = flameUniforms.uGravity.value;
      flamePointLight.color.setRGB(
        THREE.MathUtils.lerp(0.15, 1.0, gNow),
        THREE.MathUtils.lerp(0.75, 0.58, gNow),
        THREE.MathUtils.lerp(1.0, 0.18, gNow)
      );
      flamePointLight.intensity = 1.4 + (cur.oxygenPct / 21) * 0.9;

      // Update smoke particle trajectories (upward buoyant plume in 1g vs radial/airflow drift in 0g)
      const posAttr = smokeGeo.getAttribute('position') as THREE.BufferAttribute;
      const flowSpeed = cur.airflowCmS * 0.04;
      for (let i = 0; i < pCount; i++) {
        const life = (elapsed * (0.28 + gNow * 0.35 + flowSpeed * 0.25) + pSeeds[i * 3 + 1]) % 1.0;
        const spreadR = 0.28 + life * (gNow < 0.05 ? 0.95 : 0.45);
        const angle = pSeeds[i * 3] * Math.PI;
        const x = Math.cos(angle) * spreadR * 0.5 + flowSpeed * life * 1.6;
        const y = 0.28 + (gNow * 1.85 + 0.18) * life + Math.sin(angle * 2) * (1 - gNow) * life * 0.55;
        const z = Math.sin(angle) * spreadR * 0.5;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      basePlate.geometry.dispose();
      pedestal.geometry.dispose();
      ceramicInsulator.geometry.dispose();
      fuelSpecimen.geometry.dispose();
      steelMat.dispose();
      ceramicMat.dispose();
      fuelMat.dispose();
      flameMesh.geometry.dispose();
      flameMat.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full overflow-hidden rounded-lg border border-slate-800 bg-[#060D1D] ${heightClass}`}
      aria-label="Conceptual 3D microgravity and normal-gravity combustion visualization"
    />
  );
}
