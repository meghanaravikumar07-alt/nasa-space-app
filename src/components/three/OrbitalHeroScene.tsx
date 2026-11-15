import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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

function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#091A36');
  grad.addColorStop(0.5, '#07142B');
  grad.addColorStop(1, '#091A36');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle lat/lon technical grid lines baked onto surface
  ctx.strokeStyle = 'rgba(0, 217, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Stylized procedural continental silhouettes
  const landmasses = [
    { x: 220, y: 165, rx: 85, ry: 55, rot: -0.25 }, // North America
    { x: 295, y: 315, rx: 48, ry: 85, rot: 0.2 },   // South America
    { x: 525, y: 155, rx: 65, ry: 38, rot: 0.1 },   // Europe
    { x: 545, y: 270, rx: 68, ry: 78, rot: -0.1 },  // Africa
    { x: 705, y: 175, rx: 145, ry: 68, rot: 0.05 }, // Asia
    { x: 825, y: 350, rx: 58, ry: 36, rot: -0.2 },  // Australia
  ];
  landmasses.forEach((m, idx) => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    const lGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, m.rx);
    lGrad.addColorStop(0, '#1B3A63');
    lGrad.addColorStop(0.75, '#132B4C');
    lGrad.addColorStop(1, 'rgba(13, 35, 66, 0.2)');
    ctx.fillStyle = lGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle coastline rim
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // City light clusters
    ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
    for (let i = 0; i < 14; i++) {
      const a = ((idx + 1) * (i + 3) * 1.7) % (Math.PI * 2);
      const r = ((i * 19) % 70) / 100;
      ctx.fillRect(Math.cos(a) * m.rx * r, Math.sin(a) * m.ry * r, 2, 2);
    }
    ctx.restore();
  });

  // Cloud wisps
  ctx.fillStyle = 'rgba(226, 232, 240, 0.07)';
  for (let i = 0; i < 42; i++) {
    const cx = (i * 137) % 1024;
    const cy = 40 + ((i * 73) % 430);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38 + (i % 30), 6 + (i % 8), 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function OrbitalHeroScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b18);
    scene.fog = new THREE.FogExp2(0x050b18, 0.032);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 150);
    camera.position.set(0.8, 0.6, 8.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Studio environment reflection for metallic orbital station
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Lighting rig (warm solar key + cool deep-space hemisphere fill + rim)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050b18, 0.7);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sunLight.position.set(10, 5, 8);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00d9ff, 1.3);
    rimLight.position.set(-8, -3, -6);
    scene.add(rimLight);

    // Earth positioned to the right-center so left hero typography remains crystal clear
    const earthGroup = new THREE.Group();
    earthGroup.position.set(2.35, -0.35, -1.2);
    scene.add(earthGroup);

    const earthTex = createEarthTexture();
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthGeo = new THREE.SphereGeometry(2.35, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.78,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Atmospheric Fresnel glow shell
    const atmosGeo = new THREE.SphereGeometry(2.47, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x00d9ff) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float rim = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 3.2);
          gl_FragColor = vec4(glowColor, rim * 0.55);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // Scientific orbital coordinate grid rings
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.35,
    });
    const ringPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.cos(a) * 3.35, 0, Math.sin(a) * 3.35));
    }
    const orbitRingGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const orbitRing = new THREE.Line(orbitRingGeo, ringMat);
    orbitRing.rotation.set(0.32, 0.1, 0.22);
    earthGroup.add(orbitRing);

    // Multi-part procedural Orbital Research Craft (6 distinct parts)
    const craftGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.85,
      roughness: 0.25,
    });
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.45,
    });
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.6,
      roughness: 0.18,
      emissive: 0x0a1c47,
      emissiveIntensity: 0.5,
    });

    const coreModule = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 16), hullMat);
    coreModule.rotation.z = Math.PI / 2;
    craftGroup.add(coreModule);

    const trussSpine = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.04), trussMat);
    craftGroup.add(trussSpine);

    [-0.35, -0.2, 0.2, 0.35].forEach((xPos) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.62), solarMat);
      wing.position.set(xPos, 0, 0);
      craftGroup.add(wing);
    });

    const cupolaDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x00d9ff, emissive: 0x00d9ff, emissiveIntensity: 0.8, roughness: 0.2 })
    );
    cupolaDome.position.set(0, 0.09, 0);
    craftGroup.add(cupolaDome);
    earthGroup.add(craftGroup);

    // Scientifically realistic spherical microgravity flame visualization (floating in orbital chamber foreground)
    const flameGroup = new THREE.Group();
    flameGroup.position.set(2.35, 1.45, 2.25);
    scene.add(flameGroup);

    const flameUniforms = {
      uTime: { value: 0 },
    };

    const flameSphereMat = new THREE.ShaderMaterial({
      uniforms: flameUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPos;
        void main() {
          vec3 p = position;
          float ripple = sin(p.x * 7.0 + uTime * 2.2) * cos(p.y * 6.0 - uTime * 1.8) * 0.025;
          p += normal * ripple;
          vPos = p;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPos;
        void main() {
          float ndotv = max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
          float shell = pow(1.0 - ndotv, 1.8);
          float core = pow(ndotv, 2.4);
          vec3 blueReaction = vec3(0.05, 0.68, 1.0);
          vec3 violetCool = vec3(0.55, 0.36, 0.96);
          vec3 innerHeat = vec3(1.0, 0.65, 0.15);
          float pulse = 0.88 + 0.12 * sin(uTime * 2.5 + vPos.y * 4.0);
          vec3 col = mix(innerHeat, blueReaction, smoothstep(0.15, 0.75, 1.0 - ndotv));
          col = mix(col, violetCool, shell * 0.45);
          float alpha = clamp((shell * 0.85 + core * 0.35) * pulse, 0.12, 0.92);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerFlame = new THREE.Mesh(new THREE.SphereGeometry(0.46, 40, 40), flameSphereMat);
    flameGroup.add(outerFlame);

    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 })
    );
    flameGroup.add(innerCore);

    // Subtle orbital particle field
    const starCount = 520;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 28;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      starPositions[i * 3 + 2] = -4 - Math.random() * 14;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.045,
      transparent: true,
      opacity: 0.7,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 0.45;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 0.25;
    };
    window.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
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

      earthMesh.rotation.y += delta * 0.075;
      flameUniforms.uTime.value = elapsed;

      // Orbit spacecraft along inclined orbit ring
      const orbitAngle = elapsed * 0.35;
      const r = 3.35;
      const ox = Math.cos(orbitAngle) * r;
      const oz = Math.sin(orbitAngle) * r;
      const pVec = new THREE.Vector3(ox, 0, oz).applyEuler(orbitRing.rotation);
      craftGroup.position.copy(pVec);
      craftGroup.lookAt(earthGroup.position);

      // Gentle camera parallax
      camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.8 + pointerX, 3.0, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.6 - pointerY, 3.0, delta);
      camera.lookAt(1.3, 0.0, 0);

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
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);

      earthGeo.dispose();
      earthMat.dispose();
      earthTex.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      orbitRingGeo.dispose();
      ringMat.dispose();
      flameSphereMat.dispose();
      outerFlame.geometry.dispose();
      innerCore.geometry.dispose();
      (innerCore.material as THREE.Material).dispose();
      starGeo.dispose();
      starMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
