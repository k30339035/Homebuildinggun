// ============================================
// 3D Building Destruction Game
// ============================================

// Game State
const gameState = {
    isPlaying: false,
    currentLevel: 1,
    score: 0,
    currentWeapon: 'gun', // 'gun' or 'cannon'
    buildings: [],
    projectiles: [],
    particles: [],
    totalBlocks: 0,
    destroyedBlocks: 0,
    mouseX: 0,
    mouseY: 0
};

// Scene Setup
let scene, camera, renderer, world;
let clock, delta;
let ground, groundBody;

// Audio Context
let audioContext;
let masterGain;

// Level Configurations (10 levels, increasing difficulty)
const levelConfigs = [
    { name: "작은 사무실", floors: 3, width: 4, depth: 4, blockSize: 1.5, color: 0x8B4513 },
    { name: "일반 빌딩", floors: 5, width: 5, depth: 5, blockSize: 1.3, color: 0x708090 },
    { name: "중형 건물", floors: 7, width: 6, depth: 5, blockSize: 1.2, color: 0x4682B4 },
    { name: "대형 오피스", floors: 9, width: 7, depth: 6, blockSize: 1.1, color: 0x2F4F4F },
    { name: "현대식 타워", floors: 11, width: 8, depth: 7, blockSize: 1.0, color: 0x1C1C1C },
    { name: "마천루 초입", floors: 13, width: 9, depth: 8, blockSize: 0.95, color: 0x191970 },
    { name: "고층 빌딩", floors: 15, width: 10, depth: 9, blockSize: 0.9, color: 0x000080 },
    { name: "초고층 빌딩", floors: 18, width: 11, depth: 10, blockSize: 0.85, color: 0x483D8B },
    { name: "메가 타워", floors: 21, width: 12, depth: 11, blockSize: 0.8, color: 0x800000 },
    { name: "궁극의 요새", floors: 25, width: 13, depth: 12, blockSize: 0.75, color: 0x8B0000 }
];

// Initialize Three.js Scene
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 15, 35);
    camera.lookAt(0, 10, 0);

    // Renderer with antialiasing for better quality
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'),
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    // Additional point lights for better illumination
    const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight1.position.set(-20, 30, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight2.position.set(20, 30, -20);
    scene.add(pointLight2);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(200, 50, 0x000000, 0x333333);
    scene.add(gridHelper);

    clock = new THREE.Clock();
}

// Initialize Cannon.js Physics
function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    world.defaultContactMaterial.friction = 0.4;

    // Ground body
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({
        mass: 0,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
}

// Advanced Audio System with Web Audio API
function initAudioSystem() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(audioContext.destination);
    } catch (e) {
        console.warn('Web Audio API not supported', e);
    }
}

// Create realistic sound using oscillators and filters
function createExplosionSound(intensity = 1.0) {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Main explosion bass
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(60, now);
    bass.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    bassGain.gain.setValueAtTime(0.8 * intensity, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    bass.connect(bassGain);
    bassGain.connect(masterGain);
    bass.start(now);
    bass.stop(now + 0.5);

    // Mid-range explosion
    const mid = audioContext.createOscillator();
    const midGain = audioContext.createGain();
    mid.type = 'square';
    mid.frequency.setValueAtTime(200, now);
    mid.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    midGain.gain.setValueAtTime(0.5 * intensity, now);
    midGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    mid.connect(midGain);
    midGain.connect(masterGain);
    mid.start(now);
    mid.stop(now + 0.3);

    // High-frequency crackle
    const noise = audioContext.createBufferSource();
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3 * intensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
}

function createGunSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    // Click sound
    const clickOsc = audioContext.createOscillator();
    const clickGain = audioContext.createGain();
    clickOsc.frequency.value = 1000;
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
}

function createCannonSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Deep bass boom
    const boom = audioContext.createOscillator();
    const boomGain = audioContext.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(40, now);
    boom.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    boomGain.gain.setValueAtTime(0.9, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    boom.connect(boomGain);
    boomGain.connect(masterGain);
    boom.start(now);
    boom.stop(now + 0.5);

    // Mid explosion
    const explosion = audioContext.createOscillator();
    const explosionGain = audioContext.createGain();
    explosion.type = 'sawtooth';
    explosion.frequency.setValueAtTime(150, now);
    explosion.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    explosionGain.gain.setValueAtTime(0.6, now);
    explosionGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    explosion.connect(explosionGain);
    explosionGain.connect(masterGain);
    explosion.start(now);
    explosion.stop(now + 0.3);
}

function createImpactSound(velocity) {
    if (!audioContext) return;

    const now = audioContext.currentTime;
    const intensity = Math.min(velocity / 20, 1.0);

    const impact = audioContext.createOscillator();
    const impactGain = audioContext.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(150, now);
    impact.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    impactGain.gain.setValueAtTime(0.5 * intensity, now);
    impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    impact.connect(impactGain);
    impactGain.connect(masterGain);
    impact.start(now);
    impact.stop(now + 0.2);
}

function createDebrisSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    const debris = audioContext.createOscillator();
    const debrisGain = audioContext.createGain();
    debris.type = 'sawtooth';
    debris.frequency.value = 80 + Math.random() * 40;
    debrisGain.gain.setValueAtTime(0.2, now);
    debrisGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    debris.connect(debrisGain);
    debrisGain.connect(masterGain);
    debris.start(now);
    debris.stop(now + 0.15);
}

// Create Building with Physics
function createBuilding(level) {
    clearBuilding();

    const config = levelConfigs[level - 1];
    const { floors, width, depth, blockSize, color } = config;

    gameState.totalBlocks = 0;
    gameState.destroyedBlocks = 0;

    const startY = blockSize / 2;

    for (let floor = 0; floor < floors; floor++) {
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                createBlock(
                    (x - width / 2) * blockSize,
                    startY + floor * blockSize,
                    (z - depth / 2) * blockSize,
                    blockSize,
                    color,
                    floor
                );
            }
        }
    }

    updateHUD();
    console.log(`Building created: ${config.name} with ${gameState.totalBlocks} blocks`);
}

function createBlock(x, y, z, size, baseColor, floor) {
    // Vary color by floor
    const colorVariation = floor * 0x050505;
    const blockColor = baseColor + colorVariation;

    // Three.js mesh
    const geometry = new THREE.BoxGeometry(size * 0.95, size * 0.95, size * 0.95);
    const material = new THREE.MeshStandardMaterial({
        color: blockColor,
        roughness: 0.7,
        metalness: 0.3,
        flatShading: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
    const body = new CANNON.Body({
        mass: 5,
        shape: shape,
        material: new CANNON.Material({ friction: 0.5, restitution: 0.1 })
    });
    body.position.set(x, y, z);
    body.linearDamping = 0.3;
    body.angularDamping = 0.3;
    world.addBody(body);

    const block = {
        mesh: mesh,
        body: body,
        health: 100,
        destroyed: false,
        size: size
    };

    gameState.buildings.push(block);
    gameState.totalBlocks++;
}

function clearBuilding() {
    gameState.buildings.forEach(block => {
        scene.remove(block.mesh);
        world.removeBody(block.body);
    });
    gameState.buildings = [];
    gameState.totalBlocks = 0;
    gameState.destroyedBlocks = 0;
}

// Projectile System
function shootProjectile() {
    const isGun = gameState.currentWeapon === 'gun';

    // Play weapon sound
    if (isGun) {
        createGunSound();
    } else {
        createCannonSound();
    }

    // Calculate direction from camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    const startPos = camera.position.clone();
    startPos.add(direction.clone().multiplyScalar(2));

    const speed = isGun ? 80 : 50;
    const size = isGun ? 0.3 : 0.8;
    const damage = isGun ? 25 : 80;
    const color = isGun ? 0xFFFF00 : 0xFF4500;

    // Three.js projectile
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(startPos);
    scene.add(mesh);

    // Add point light to projectile
    const light = new THREE.PointLight(color, 2, 10);
    mesh.add(light);

    // Cannon.js body
    const shape = new CANNON.Sphere(size);
    const body = new CANNON.Body({
        mass: isGun ? 0.5 : 5,
        shape: shape
    });
    body.position.set(startPos.x, startPos.y, startPos.z);
    body.velocity.set(
        direction.x * speed,
        direction.y * speed,
        direction.z * speed
    );
    world.addBody(body);

    const projectile = {
        mesh: mesh,
        body: body,
        damage: damage,
        lifetime: 5,
        isGun: isGun
    };

    gameState.projectiles.push(projectile);

    // Add collision event
    body.addEventListener('collide', (event) => {
        handleProjectileCollision(projectile, event);
    });
}

function handleProjectileCollision(projectile, event) {
    const velocity = projectile.body.velocity.length();

    // Check if hit a building block
    gameState.buildings.forEach(block => {
        if (!block.destroyed && event.body === block.body) {
            block.health -= projectile.damage;

            createImpactSound(velocity);
            createParticleExplosion(block.mesh.position, block.size);

            if (block.health <= 0) {
                destroyBlock(block);
                createExplosionSound(0.5);
            }
        }
    });

    // Create explosion effect
    if (!projectile.isGun) {
        createExplosionParticles(projectile.mesh.position);
        createExplosionSound(1.0);

        // Apply explosion force to nearby blocks
        const explosionRadius = 5;
        const explosionForce = 20;

        gameState.buildings.forEach(block => {
            if (!block.destroyed) {
                const distance = block.body.position.distanceTo(projectile.body.position);
                if (distance < explosionRadius) {
                    const force = explosionForce * (1 - distance / explosionRadius);
                    const direction = block.body.position.vsub(projectile.body.position);
                    direction.normalize();
                    block.body.applyImpulse(
                        direction.scale(force),
                        block.body.position
                    );

                    block.health -= projectile.damage * (1 - distance / explosionRadius);
                    if (block.health <= 0) {
                        destroyBlock(block);
                    }
                }
            }
        });
    }
}

function destroyBlock(block) {
    block.destroyed = true;
    gameState.destroyedBlocks++;
    gameState.score += 100;

    // Visual feedback
    block.mesh.material.color.setHex(0x000000);
    block.mesh.material.transparent = true;
    block.mesh.material.opacity = 0.3;

    createDebrisSound();
    createDebrisParticles(block.mesh.position, block.size);

    updateHUD();
    checkLevelComplete();
}

// Particle System
function createParticleExplosion(position, size) {
    const particleCount = 10;

    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.BoxGeometry(size * 0.1, size * 0.1, size * 0.1);
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xFFFFFF,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 10,
            (Math.random() - 0.5) * 10
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 2,
            fadeRate: 0.5
        });
    }
}

function createExplosionParticles(position) {
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.2, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFF4500,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 15,
            (Math.random() - 0.5) * 15
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 1.5,
            fadeRate: 0.7
        });
    }
}

function createDebrisParticles(position, size) {
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.BoxGeometry(size * 0.15, size * 0.15, size * 0.15);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 8 + 2,
            (Math.random() - 0.5) * 8
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 3,
            fadeRate: 0.33
        });
    }
}

function updateParticles(delta) {
    gameState.particles = gameState.particles.filter(particle => {
        particle.lifetime -= delta;

        if (particle.lifetime <= 0) {
            scene.remove(particle.mesh);
            return false;
        }

        particle.velocity.y -= 9.8 * delta;
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));
        particle.mesh.material.opacity = particle.lifetime * particle.fadeRate;

        return true;
    });
}

// Game Logic
function checkLevelComplete() {
    const destructionPercent = (gameState.destroyedBlocks / gameState.totalBlocks) * 100;

    if (destructionPercent >= 90) {
        setTimeout(() => {
            showDestroyedMessage();
            gameState.score += 1000 * gameState.currentLevel;

            setTimeout(() => {
                if (gameState.currentLevel < 10) {
                    gameState.currentLevel++;
                    createBuilding(gameState.currentLevel);
                    hideDestroyedMessage();
                } else {
                    alert('축하합니다! 모든 레벨을 완료했습니다!\n최종 점수: ' + gameState.score);
                    gameState.currentLevel = 1;
                    createBuilding(gameState.currentLevel);
                    hideDestroyedMessage();
                }
            }, 2000);
        }, 500);
    }
}

function showDestroyedMessage() {
    const text = document.getElementById('destroyedText');
    text.classList.add('show-destroyed');
    createExplosionSound(1.5);
}

function hideDestroyedMessage() {
    const text = document.getElementById('destroyedText');
    text.classList.remove('show-destroyed');
}

function updateHUD() {
    document.getElementById('currentLevel').textContent = gameState.currentLevel;
    document.getElementById('score').textContent = gameState.score;

    const destructionPercent = gameState.totalBlocks > 0
        ? ((gameState.destroyedBlocks / gameState.totalBlocks) * 100).toFixed(1)
        : 0;
    document.getElementById('destructionPercent').textContent = destructionPercent;

    const remaining = gameState.totalBlocks - gameState.destroyedBlocks;
    document.getElementById('remainingBlocks').textContent = remaining;

    const weaponName = gameState.currentWeapon === 'gun' ? '총' : '대포';
    document.getElementById('currentWeapon').textContent = weaponName;

    const power = gameState.currentWeapon === 'gun' ? '보통' : '강력';
    document.getElementById('power').textContent = power;
}

// Input Handling
let canShoot = true;
const shootCooldown = { gun: 200, cannon: 800 };

document.addEventListener('click', () => {
    if (!gameState.isPlaying) return;

    if (canShoot) {
        shootProjectile();
        canShoot = false;
        setTimeout(() => {
            canShoot = true;
        }, shootCooldown[gameState.currentWeapon]);
    }
});

document.addEventListener('keydown', (e) => {
    if (!gameState.isPlaying) return;

    if (e.key === '1') {
        gameState.currentWeapon = 'gun';
        updateHUD();
    } else if (e.key === '2') {
        gameState.currentWeapon = 'cannon';
        updateHUD();
    } else if (e.key === 'r' || e.key === 'R') {
        createBuilding(gameState.currentLevel);
    }
});

// Mouse movement for camera control
document.addEventListener('mousemove', (e) => {
    if (!gameState.isPlaying) return;

    gameState.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    gameState.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Mouse wheel for zoom
document.addEventListener('wheel', (e) => {
    if (!gameState.isPlaying) return;

    const zoomSpeed = 2;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    if (e.deltaY < 0) {
        camera.position.add(direction.multiplyScalar(zoomSpeed));
    } else {
        camera.position.sub(direction.multiplyScalar(zoomSpeed));
    }

    // Limit zoom
    const distance = camera.position.length();
    if (distance < 10) {
        camera.position.normalize().multiplyScalar(10);
    } else if (distance > 60) {
        camera.position.normalize().multiplyScalar(60);
    }
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    if (!gameState.isPlaying) return;

    delta = clock.getDelta();

    // Update physics
    world.step(1/60, delta, 3);

    // Update building blocks
    gameState.buildings.forEach(block => {
        block.mesh.position.copy(block.body.position);
        block.mesh.quaternion.copy(block.body.quaternion);

        // Remove blocks that fall too far
        if (block.body.position.y < -20 && !block.destroyed) {
            destroyBlock(block);
        }
    });

    // Update projectiles
    gameState.projectiles = gameState.projectiles.filter(projectile => {
        projectile.lifetime -= delta;

        if (projectile.lifetime <= 0 || projectile.body.position.y < -10) {
            scene.remove(projectile.mesh);
            world.removeBody(projectile.body);
            return false;
        }

        projectile.mesh.position.copy(projectile.body.position);
        projectile.mesh.quaternion.copy(projectile.body.quaternion);

        return true;
    });

    // Update particles
    updateParticles(delta);

    // Camera follow mouse (smooth camera rotation)
    const targetX = gameState.mouseX * 10;
    const targetY = 15 + gameState.mouseY * 5;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(0, 10, 0);

    renderer.render(scene, camera);
}

// Start Game
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameState.isPlaying = true;
    gameState.currentLevel = 1;
    gameState.score = 0;

    initScene();
    initPhysics();
    initAudioSystem();
    createBuilding(1);
    updateHUD();
    animate();
}

// Make startGame available globally
window.startGame = startGame;
