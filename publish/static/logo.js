import * as THREE from "three";
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/geometries/TextGeometry.js";

export function initLogoScene(options = {}) {
  const stage = document.getElementById("orbit-stage");
  const canvasHost = document.getElementById("seeton-canvas");
  if (!stage || !canvasHost) {
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const introDuration = Number.isFinite(options.introDuration) && options.introDuration > 0
    ? options.introDuration
    : 4;
  const repeatIntroDuration = Number.isFinite(options.repeatIntroDuration) && options.repeatIntroDuration > 0
    ? options.repeatIntroDuration
    : 4;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const logoRoot = new THREE.Group();
  const clock = new THREE.Clock();

  let logoContent = null;
  const intro = {
    active: !prefersReducedMotion,
    duration: introDuration,
    initialDuration: introDuration,
    repeatDuration: repeatIntroDuration,
    interval: 8.0,
    elapsed: 0,
    idleElapsed: 0,
    startRotationX: -Math.PI * 1.06,
    startRotationY: -Math.PI * 3.15,
    startRotationZ: Math.PI * 0.38,
    fromRotationX: -Math.PI * 1.06,
    fromRotationY: -Math.PI * 3.15,
    fromRotationZ: Math.PI * 0.38,
    targetRotationX: 0,
    targetRotationY: 0,
    targetRotationZ: 0,
  };

  const drag = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0,
  };

  const motion = {
    rotationX: prefersReducedMotion ? 0 : intro.startRotationX,
    rotationY: prefersReducedMotion ? 0 : intro.startRotationY,
    rotationZ: prefersReducedMotion ? 0 : intro.startRotationZ,
    idleSpinX: prefersReducedMotion ? 0 : 0.0024,
    idleSpinY: prefersReducedMotion ? 0 : 0.0073,
    idleSpinZ: prefersReducedMotion ? 0 : -0.00088,
  };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");

  canvasHost.replaceWith(renderer.domElement);

  scene.add(logoRoot);
  camera.position.set(0, 0.16, 18.8);

  createLights(scene);
  loadLogo();
  resize();

  window.addEventListener("resize", resize);
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerEnd);
  stage.addEventListener("pointercancel", onPointerEnd);
  stage.addEventListener("pointerleave", onPointerEnd);

  renderer.setAnimationLoop(renderFrame);

  function createLights(targetScene) {
    const ambient = new THREE.AmbientLight(0xe8eef5, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    const rim = new THREE.DirectionalLight(0x89b7ff, 1.3);
    const fill = new THREE.PointLight(0x10243d, 8, 32, 2);

    key.position.set(7, 9, 10);
    rim.position.set(-9, 4, -8);
    fill.position.set(0, -1.8, 8);

    targetScene.add(ambient);
    targetScene.add(key);
    targetScene.add(rim);
    targetScene.add(fill);
  }

  function loadLogo() {
    const loader = new FontLoader();

    loader.load(
      "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/fonts/helvetiker_bold.typeface.json",
      (font) => {
        const geometry = new TextGeometry("SEETON", {
          font,
          size: 4.8,
          depth: 0.18,
          curveSegments: 10,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.01,
          bevelOffset: 0,
          bevelSegments: 3,
        });
        const faceMaterial = new THREE.MeshStandardMaterial({
          color: 0xf3f6fb,
          emissive: 0x0a1120,
          emissiveIntensity: 0.05,
          metalness: 0.12,
          roughness: 0.28,
        });
        const sideMaterial = new THREE.MeshStandardMaterial({
          color: 0x1b3955,
          emissive: 0x08111d,
          emissiveIntensity: 0.04,
          metalness: 0.16,
          roughness: 0.42,
        });
        const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);

        geometry.computeBoundingBox();
        geometry.center();
        geometry.computeVertexNormals();

        mesh.userData.depthScale = 0.16;

        logoContent = mesh;
        logoRoot.add(mesh);
        measureLogo();
        updateLogoScale();
        stage.classList.add("has-logo", "is-ready");
      },
      undefined,
      () => {
        stage.classList.add("is-ready");
      },
    );
  }

  function normalizeAngle(angle) {
    const fullTurn = Math.PI * 2;
    return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  }

  function beginIntro(fromCurrent = false) {
    if (prefersReducedMotion) {
      return;
    }

    intro.active = true;
    intro.duration = fromCurrent ? intro.repeatDuration : intro.initialDuration;
    intro.elapsed = 0;
    intro.idleElapsed = 0;

    if (fromCurrent) {
      const currentX = logoRoot.rotation.x;
      const currentY = logoRoot.rotation.y;
      const currentZ = logoRoot.rotation.z;
      const normalizedY = THREE.MathUtils.euclideanModulo(currentY, Math.PI * 2);
      const extraTurns = Math.PI * 4;
      const forwardToFront = normalizedY === 0 ? 0 : (Math.PI * 2) - normalizedY;

      intro.fromRotationX = currentX;
      intro.fromRotationY = currentY;
      intro.fromRotationZ = currentZ;
      intro.targetRotationX = 0;
      intro.targetRotationY = currentY + extraTurns + forwardToFront;
      intro.targetRotationZ = 0;
      return;
    }

    intro.fromRotationX = intro.startRotationX;
    intro.fromRotationY = intro.startRotationY;
    intro.fromRotationZ = intro.startRotationZ;
    intro.targetRotationX = 0;
    intro.targetRotationY = 0;
    intro.targetRotationZ = 0;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
    updateLogoScale();
  }

  function measureLogo() {
    if (!logoContent) {
      return;
    }
    if (logoContent.userData.baseWidth && logoContent.userData.baseHeight) {
      return;
    }
    const bounds = new THREE.Box3().setFromObject(logoContent);
    logoContent.userData.baseWidth = bounds.max.x - bounds.min.x;
    logoContent.userData.baseHeight = bounds.max.y - bounds.min.y;
  }

  function updateLogoScale() {
    if (!logoContent) {
      return;
    }
    const distance = camera.position.z - logoRoot.position.z;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(verticalFov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    const targetWidth = visibleWidth * 0.82;
    const targetHeight = visibleHeight * 0.46;
    const scale = Math.min(
      targetWidth / logoContent.userData.baseWidth,
      targetHeight / logoContent.userData.baseHeight,
    );
    const depthScale = logoContent.userData.depthScale || 1;
    logoContent.scale.set(scale, scale, scale * depthScale);
  }

  function onPointerDown(event) {
    cancelIntro();
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.velocityX = 0;
    drag.velocityY = 0;
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) {
      return;
    }

    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const dx = (event.clientX - drag.lastX) / width;
    const dy = (event.clientY - drag.lastY) / height;

    motion.rotationY += dx * Math.PI * 2.4;
    motion.rotationX += dy * Math.PI * 2.1;
    drag.velocityY = prefersReducedMotion ? 0 : dx * 0.34;
    drag.velocityX = prefersReducedMotion ? 0 : dy * 0.3;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  }

  function onPointerEnd(event) {
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
      return;
    }
    drag.active = false;
    drag.pointerId = null;
    if (prefersReducedMotion) {
      drag.velocityX = 0;
      drag.velocityY = 0;
    }
    stage.classList.remove("is-dragging");
  }

  function cancelIntro() {
    if (!intro.active) {
      return;
    }
    intro.active = false;
    intro.idleElapsed = 0;
    motion.rotationX = logoRoot.rotation.x;
    motion.rotationY = logoRoot.rotation.y;
    motion.rotationZ = logoRoot.rotation.z;
  }

  function renderFrame() {
    const delta = Math.min(clock.getDelta(), 0.033);
    const bob = prefersReducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.05) * 0.06;

    if (intro.active) {
      intro.elapsed = Math.min(intro.elapsed + delta, intro.duration);
      const progress = intro.elapsed / intro.duration;
      const eased = 1 - ((1 - progress) ** 4);
      const diagonalArc = Math.sin(progress * Math.PI);
      motion.rotationX = THREE.MathUtils.lerp(intro.fromRotationX, intro.targetRotationX, eased) + diagonalArc * 0.16;
      motion.rotationY = THREE.MathUtils.lerp(intro.fromRotationY, intro.targetRotationY, eased);
      motion.rotationZ = THREE.MathUtils.lerp(intro.fromRotationZ, intro.targetRotationZ, eased) + diagonalArc * 0.08;
      drag.velocityY = 0;
      drag.velocityX = 0;
      logoRoot.rotation.x = motion.rotationX;
      logoRoot.rotation.y = motion.rotationY;
      logoRoot.rotation.z = motion.rotationZ;

      if (progress >= 1) {
        intro.active = false;
        intro.idleElapsed = 0;
        motion.rotationX = normalizeAngle(intro.targetRotationX);
        motion.rotationY = normalizeAngle(intro.targetRotationY);
        motion.rotationZ = normalizeAngle(intro.targetRotationZ);
        logoRoot.rotation.x = motion.rotationX;
        logoRoot.rotation.y = motion.rotationY;
        logoRoot.rotation.z = motion.rotationZ;
      }
    } else if (!drag.active && !prefersReducedMotion) {
      intro.idleElapsed += delta;
      if (intro.idleElapsed >= intro.interval) {
        beginIntro(true);
      } else {
        drag.velocityY += (motion.idleSpinY - drag.velocityY) * 0.04;
        drag.velocityX += (motion.idleSpinX - drag.velocityX) * 0.04;
        motion.rotationZ += motion.idleSpinZ;
      }
    } else if (!prefersReducedMotion) {
      drag.velocityY *= 0.98;
      drag.velocityX *= 0.98;
    }

    motion.rotationY += drag.velocityY;
    motion.rotationX += drag.velocityX;

    if (!intro.active) {
      logoRoot.rotation.x += (motion.rotationX - logoRoot.rotation.x) * Math.min(1, delta * 10);
      logoRoot.rotation.y += (motion.rotationY - logoRoot.rotation.y) * Math.min(1, delta * 9);
      logoRoot.rotation.z += (motion.rotationZ - logoRoot.rotation.z) * Math.min(1, delta * 7);
    }
    logoRoot.position.y = bob;

    renderer.render(scene, camera);
  }
}
