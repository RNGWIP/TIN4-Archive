import * as THREE from './3js_material/three.module.js';
import { GLTFLoader } from './3js_material/GLTFLoader.js';
import { OrbitControls } from './3js_material/OrbitControls.js';

let scene, camera, renderer, clock;
let shirtGroup = null;

init();
animate();

function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Orbit Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 6);
  scene.add(dirLight);

  // Load GLB
  const loader = new GLTFLoader();
  loader.load('./3D_assets_merch/gods_favorite-tshirt_v1.glb', (gltf) => {
    const shirt = gltf.scene.children[0];
    shirt.rotation.y = Math.PI; // ensure forward-facing


    // ----- Base Material (faint emissive glow) -----
    const baseMat = new THREE.MeshStandardMaterial({
      map: shirt.material.map,
      roughness: 0.8,
      metalness: 0.0,
      emissive: new THREE.Color(0x00ff00),
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });

// Load Vending Machine GLB independently
const vendingLoader = new GLTFLoader();
vendingLoader.load('./3D_assets_merch/VendingMachineRoot.glb', (gltf) => {
  vendingRoot = gltf.scene;

  // Optional: adjust position/rotation
  // vendingRoot.position.set(-25.82, 17.85, 0);
  // vendingRoot.rotation.z = Math.PI / 2;

  scene.add(vendingRoot);

  // Access child objects for interactivity
  const vendingMachine = vendingRoot.getObjectByName('VendingMachine');
  const buttons = vendingMachine.children.filter(c => c.name.startsWith('Button'));
  const eye = vendingRoot.getObjectByName('Eye');
  const productBlocks = vendingMachine.children.filter(c => c.name.startsWith('ProductBlock'));

  // raycasting or eye movement logic goes here
});

    // ----- Hologram Shader with PS1 + Dithering -----
    const holoMat = new THREE.ShaderMaterial({
      uniforms: { 
        time: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;

          // Project to clip space
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec4 clipPos = projectionMatrix * mvPosition;

          // --- PS1 Vertex Snap in Clip Space ---
          float pixelGrid = 200.0; // Lower = choppier motion
          clipPos.xy = floor(clipPos.xy * pixelGrid) / pixelGrid;

          gl_Position = clipPos;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        // --- Dithering Functions ---
        vec4 RGBtoYUV(vec4 rgba) {
          vec4 yuva;
          yuva.r = rgba.r * 0.2126 + 0.7152 * rgba.g + 0.0722 * rgba.b;
          yuva.g = (rgba.b - yuva.r) / 1.8556;
          yuva.b = (rgba.r - yuva.r) / 1.5748;
          yuva.a = rgba.a;
          yuva.gb += 0.5;
          return yuva;
        }

        vec4 YUVtoRGB(vec4 yuva) {
          yuva.gb -= 0.5;
          return vec4(
            yuva.r * 1.0 + yuva.g * 0.0 + yuva.b * 1.5748,
            yuva.r * 1.0 + yuva.g * -0.187324 + yuva.b * -0.468124,
            yuva.r * 1.0 + yuva.g * 1.8556 + yuva.b * 0.0,
            yuva.a
          );
        }

        float ditherChannelError(float col, float colMin, float colMax) {
          float range = abs(colMin - colMax);
          float aRange = abs(col - colMin);
          return aRange / range;
        }

        const float dither0[8] = float[8](0.0, 32.0, 8.0, 40.0, 2.0, 34.0, 10.0, 42.0);
        const float dither1[8] = float[8](48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0);
        const float dither2[8] = float[8](12.0, 44.0, 4.0, 36.0, 14.0, 46.0, 6.0, 38.0);
        const float dither3[8] = float[8](60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0);
        const float dither4[8] = float[8](3.0, 35.0, 11.0, 43.0, 1.0, 33.0, 9.0, 41.0);
        const float dither5[8] = float[8](51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0);
        const float dither6[8] = float[8](15.0, 47.0, 7.0, 39.0, 13.0, 45.0, 5.0, 37.0);
        const float dither7[8] = float[8](63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0);

        float dither8x8(vec2 position, float scale, float brightness) {
          int x = int(mod(position.x / scale, 8.0));
          int y = int(mod(position.y / scale, 8.0));
          float d = 0.0;
          if (x==0) d=dither0[y];
          else if (x==1) d=dither1[y];
          else if (x==2) d=dither2[y];
          else if (x==3) d=dither3[y];
          else if (x==4) d=dither4[y];
          else if (x==5) d=dither5[y];
          else if (x==6) d=dither6[y];
          else if (x==7) d=dither7[y];
          float limit = (d + 1.0) / 64.0;
          return brightness < limit ? 0.0 : 1.0;
        }

        vec4 ditherAndPosterize(vec2 position, vec4 color, float colorDepth, float ditherScale) {
          vec4 yuv = RGBtoYUV(color);
          vec4 col1 = floor(yuv * colorDepth) / colorDepth;
          vec4 col2 = ceil(yuv * colorDepth) / colorDepth;

          yuv.x = mix(col1.x, col2.x, dither8x8(position, ditherScale, ditherChannelError(yuv.x, col1.x, col2.x)));
          yuv.y = mix(col1.y, col2.y, dither8x8(position, ditherScale, ditherChannelError(yuv.y, col1.y, col2.y)));
          yuv.z = mix(col1.z, col2.z, dither8x8(position, ditherScale, ditherChannelError(yuv.z, col1.z, col2.z)));

          return YUVtoRGB(yuv);
        }

        void main() {
          // Fresnel edge glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);

          // Scanlines
          float scan = sin(vWorldPosition.y * 120.0 + time * 12.0) * 0.5 + 0.5;

          // Flicker / glitch effect
          float glitch = step(0.7, fract(
            sin(dot(vWorldPosition.xy ,vec2(12.9898,78.233))) * 43758.5453 + time * 10.0
          ));

          // Pixelated base color
          vec3 baseColor = vec3(0.0, 0.8, 1.0);
          vec3 color = baseColor * fresnel * (scan + 0.2);
          color += glitch * vec3(0.5, 1.0, 1.0);

          // Apply dithering and posterization
          vec4 finalColor = ditherAndPosterize(gl_FragCoord.xy, vec4(color, fresnel * 0.9), 4.0, 4.0);
          gl_FragColor = finalColor;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Double Mesh: Base + Hologram
    const baseMesh = shirt.clone();
    baseMesh.material = baseMat;

    const holoMesh = shirt.clone();
    holoMesh.material = holoMat;

    shirtGroup = new THREE.Group();
    shirtGroup.add(baseMesh);
    shirtGroup.add(holoMesh);
    shirtGroup.rotation.y = Math.PI;
    scene.add(shirtGroup);
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Smooth 45° sway
  if (shirtGroup) {
    const speed = 1;
    const maxAngle = Math.PI / 8; // 22.5° each way
    const grow = Math.min(elapsed / 2, 1); 
    const angle = Math.sin(elapsed * speed) * maxAngle * grow;
    shirtGroup.rotation.y = Math.PI + angle;
  }

  // Update shader time
  if (shirtGroup) {
    shirtGroup.traverse((child) => {
      if (child.material && child.material.uniforms && child.material.uniforms.time) {
        child.material.uniforms.time.value = elapsed;
      }
    });
  }

  renderer.render(scene, camera);
}
