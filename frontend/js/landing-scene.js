(function initLandingScene() {
  const container = document.getElementById('hero-scene');
  if (!container) {
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (window.THREE && !prefersReducedMotion) {
    initThreeScene(container);
    return;
  }

  initCanvasFallback(container, prefersReducedMotion);
})();

function initThreeScene(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const particleCount = window.innerWidth < 768 ? 420 : 900;
  const positions = [];
  const brainRadius = window.innerWidth < 768 ? 3.2 : 4;

  for (let index = 0; index < particleCount; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = brainRadius + (Math.random() - 0.5) * 1.5;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta) * 0.8;
    const z = radius * Math.cos(phi);
    positions.push(x, y, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x60a5fa,
    size: window.innerWidth < 768 ? 0.06 : 0.08
  });

  const brainParticles = new THREE.Points(geometry, material);
  scene.add(brainParticles);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.16
  });

  const lineCount = window.innerWidth < 768 ? 120 : 250;
  for (let index = 0; index < lineCount; index += 1) {
    const first = Math.floor(Math.random() * particleCount) * 3;
    const second = Math.floor(Math.random() * particleCount) * 3;

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(positions[first], positions[first + 1], positions[first + 2]),
      new THREE.Vector3(positions[second], positions[second + 1], positions[second + 2])
    ]);

    scene.add(new THREE.Line(lineGeometry, lineMaterial));
  }

  const outerParticles = window.innerWidth < 768 ? 80 : 200;
  const outerPositions = [];

  for (let index = 0; index < outerParticles; index += 1) {
    outerPositions.push((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
  }

  const outerGeometry = new THREE.BufferGeometry();
  outerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outerPositions, 3));

  const outerMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.03
  });

  const starField = new THREE.Points(outerGeometry, outerMaterial);
  scene.add(starField);

  function animate() {
    brainParticles.rotation.y += 0.0016;
    brainParticles.rotation.x += 0.0008;
    starField.rotation.y += 0.00035;
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function initCanvasFallback(container, reduceMotion) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  container.appendChild(canvas);

  const stars = [];
  const starCount = window.innerWidth < 768 ? 70 : 160;
  const nodeCount = window.innerWidth < 768 ? 45 : 90;
  const nodes = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();

  for (let index = 0; index < starCount; index += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.8 + 0.2,
      speed: Math.random() * 0.12 + 0.02
    });
  }

  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push({
      angle: Math.random() * Math.PI * 2,
      orbit: Math.random() * 120 + 90,
      radius: Math.random() * 2.6 + 1.2,
      speed: Math.random() * 0.002 + 0.001
    });
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star) => {
      context.beginPath();
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
      if (!reduceMotion) {
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      }
    });

    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.42;
    const positions = nodes.map((node) => {
      if (!reduceMotion) {
        node.angle += node.speed;
      }

      return {
        x: centerX + Math.cos(node.angle) * node.orbit,
        y: centerY + Math.sin(node.angle) * node.orbit * 0.7,
        radius: node.radius
      };
    });

    context.strokeStyle = 'rgba(59,130,246,0.14)';
    context.lineWidth = 1;
    for (let index = 0; index < positions.length; index += 1) {
      const current = positions[index];
      const next = positions[(index + 9) % positions.length];
      context.beginPath();
      context.moveTo(current.x, current.y);
      context.lineTo(next.x, next.y);
      context.stroke();
    }

    positions.forEach((node) => {
      context.beginPath();
      context.fillStyle = '#60a5fa';
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fill();
    });

    window.requestAnimationFrame(draw);
  }

  draw();
  window.addEventListener('resize', resize);
}
