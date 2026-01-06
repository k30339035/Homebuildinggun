// ============================================
// 3D Drone Shooting Game - Drone Hunter
// ============================================

// Game State
const gameState = {
    isPlaying: false,
    score: 0,
    kills: 0,
    level: 1,
    combo: 0,
    comboTimer: 0,
    shotsFired: 0,
    shotsHit: 0,
    currentWeapon: 'rifle',
    weapons: {
        rifle: {
            name: '자동 소총',
            damage: 25,
            fireRate: 150,
            magSize: 30,
            totalAmmo: 300,
            currentMag: 30,
            reloadTime: 2000,
            spread: 0.01,
            bulletSpeed: 200
        },
        sniper: {
            name: '저격 소총',
            damage: 100,
            fireRate: 1000,
            magSize: 5,
            totalAmmo: 50,
            currentMag: 5,
            reloadTime: 3000,
            spread: 0.001,
            bulletSpeed: 300
        },
        shotgun: {
            name: '산탄총',
            damage: 15,
            fireRate: 800,
            magSize: 8,
            totalAmmo: 80,
            currentMag: 8,
            reloadTime: 2500,
            spread: 0.08,
            bulletSpeed: 150,
            pellets: 8
        }
    },
    drones: [],
    bullets: [],
    particles: [],
    explosions: [],
    isReloading: false,
    canShoot: true,
    mouseX: 0,
    mouseY: 0
};

// Three.js Scene Variables
let scene, camera, renderer;
let clock, delta;
let raycaster, mouse;

// Audio Context
let audioContext;
let masterGain;

// Drone configurations by type
const droneTypes = {
    scout: {
        health: 50,
        speed: 0.8,
        size: 1,
        color: 0xff0000,
        points: 100
    },
    fighter: {
        health: 100,
        speed: 1.2,
        size: 1.3,
        color: 0xff6600,
        points: 200
    },
    heavy: {
        health: 200,
        speed: 0.5,
        size: 1.8,
        color: 0x8b0000,
        points: 300
    }
};

// ============================================
// Scene Initialization
// ============================================

function initScene() {
    // Scene
    scene = new THREE.Scene();

    // Realistic sky gradient
    const skyColor = new THREE.Color(0x87CEEB);
    const horizonColor = new THREE.Color(0xE6F3FF);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 100, 400);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'),
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Lighting - Realistic sunlight
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    sunLight.position.set(100, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // Add sky dome
    createSkyDome();

    // Add clouds
    createClouds();

    // Ground (terrain)
    createGround();

    // Raycaster for hit detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    clock = new THREE.Clock();

    console.log('Scene initialized');
}

function createSkyDome() {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0077be) },
            bottomColor: { value: new THREE.Color(0x89b2eb) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(skyDome);
}

function createClouds() {
    const cloudGeometry = new THREE.SphereGeometry(10, 8, 8);
    const cloudMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });

    for (let i = 0; i < 30; i++) {
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloud.position.set(
            Math.random() * 400 - 200,
            Math.random() * 50 + 50,
            Math.random() * 400 - 200
        );
        cloud.scale.set(
            Math.random() * 2 + 1,
            Math.random() * 0.5 + 0.3,
            Math.random() * 2 + 1
        );
        scene.add(cloud);
    }
}

function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a7d44,
        roughness: 0.9,
        metalness: 0.1
    });

    // Add some random height variation
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.random() * 2;
    }
    groundGeometry.attributes.position.needsUpdate = true;
    groundGeometry.computeVertexNormals();

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid for better depth perception
    const gridHelper = new THREE.GridHelper(500, 50, 0x000000, 0x333333);
    gridHelper.position.y = -9.9;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

// ============================================
// Audio System
// ============================================

function initAudioSystem() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(audioContext.destination);
    } catch (e) {
        console.warn('Web Audio API not supported', e);
    }
}

function playRifleSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Sharp crack
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Click
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.frequency.value = 1000;
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.03);
}

function playSniperSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Deep boom
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Sharp crack
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(150, now + 0.15);
    gain2.gain.setValueAtTime(0.5, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.15);
}

function playShotgunSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Heavy boom
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Noise burst
    const bufferSize = audioContext.sampleRate * 0.2;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    noise.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
}

function playExplosionSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Bass explosion
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.exponentialRampToValueAtTime(20, now + 0.6);
    gain1.gain.setValueAtTime(0.8, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Mid crunch
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(250, now);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.4);
    gain2.gain.setValueAtTime(0.6, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.4);

    // Noise explosion
    const bufferSize = audioContext.sampleRate * 0.5;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
}

function playDroneSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Drone buzzing
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.1);
    osc.frequency.linearRampToValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
}

function playReloadSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Mechanical click
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.frequency.value = 300;
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Magazine insert
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.frequency.value = 200;
    gain2.gain.setValueAtTime(0.25, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.3);
    osc2.stop(now + 0.4);

    // Bolt release
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    osc3.frequency.value = 400;
    gain3.gain.setValueAtTime(0.3, now + 0.6);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(now + 0.6);
    osc3.stop(now + 0.7);
}

function playHitSound() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
}

// ============================================
// Drone System
// ============================================

function createDrone(type = 'scout') {
    const config = droneTypes[type];

    // Drone body (main body)
    const bodyGeometry = new THREE.BoxGeometry(config.size, config.size * 0.3, config.size);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: 0.3,
        metalness: 0.7,
        emissive: config.color,
        emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;

    // Drone group
    const droneGroup = new THREE.Group();
    droneGroup.add(body);

    // Add propellers
    const propellerGeometry = new THREE.CylinderGeometry(0.05, 0.05, config.size * 0.6, 8);
    const propellerMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.8
    });

    const propellerPositions = [
        [config.size * 0.4, 0, config.size * 0.4],
        [config.size * 0.4, 0, -config.size * 0.4],
        [-config.size * 0.4, 0, config.size * 0.4],
        [-config.size * 0.4, 0, -config.size * 0.4]
    ];

    propellerPositions.forEach(pos => {
        const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
        propeller.position.set(pos[0], pos[1], pos[2]);
        propeller.rotation.x = Math.PI / 2;
        droneGroup.add(propeller);

        // Add rotor blades
        const bladeGeometry = new THREE.BoxGeometry(config.size * 0.4, 0.02, 0.08);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.4,
            metalness: 0.9
        });
        const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
        const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade2.rotation.y = Math.PI / 2;
        const bladeGroup = new THREE.Group();
        bladeGroup.add(blade1);
        bladeGroup.add(blade2);
        bladeGroup.position.set(pos[0], pos[1] + config.size * 0.35, pos[2]);
        droneGroup.add(bladeGroup);

        // Store blade group for rotation animation
        if (!droneGroup.userData.blades) droneGroup.userData.blades = [];
        droneGroup.userData.blades.push(bladeGroup);
    });

    // Add LED lights
    const lightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
    });
    const light1 = new THREE.Mesh(lightGeometry, lightMaterial);
    light1.position.set(config.size * 0.4, 0, 0);
    droneGroup.add(light1);

    const light2 = new THREE.Mesh(lightGeometry, lightMaterial.clone());
    light2.material.color.setHex(0x00ff00);
    light2.position.set(-config.size * 0.4, 0, 0);
    droneGroup.add(light2);

    // Random spawn position (sides of the screen, high altitude)
    const side = Math.floor(Math.random() * 4);
    let startX, startY, startZ, targetX, targetZ;

    startY = 20 + Math.random() * 30;

    switch(side) {
        case 0: // Left
            startX = -150;
            startZ = Math.random() * 100 - 50;
            targetX = 150;
            targetZ = Math.random() * 100 - 50;
            break;
        case 1: // Right
            startX = 150;
            startZ = Math.random() * 100 - 50;
            targetX = -150;
            targetZ = Math.random() * 100 - 50;
            break;
        case 2: // Front
            startX = Math.random() * 100 - 50;
            startZ = -150;
            targetX = Math.random() * 100 - 50;
            targetZ = 150;
            break;
        case 3: // Back
            startX = Math.random() * 100 - 50;
            startZ = 150;
            targetX = Math.random() * 100 - 50;
            targetZ = -150;
            break;
    }

    droneGroup.position.set(startX, startY, startZ);

    // Calculate direction
    const direction = new THREE.Vector3(targetX - startX, 0, targetZ - startZ);
    direction.normalize();

    // Look at target
    droneGroup.lookAt(new THREE.Vector3(targetX, startY, targetZ));

    scene.add(droneGroup);

    const drone = {
        mesh: droneGroup,
        type: type,
        health: config.health,
        maxHealth: config.health,
        speed: config.speed * (1 + gameState.level * 0.1),
        direction: direction,
        target: new THREE.Vector3(targetX, startY, targetZ),
        points: config.points,
        size: config.size
    };

    gameState.drones.push(drone);
    playDroneSound();

    return drone;
}

function updateDrones(delta) {
    gameState.drones.forEach((drone, index) => {
        // Move drone
        drone.mesh.position.addScaledVector(drone.direction, drone.speed * delta * 60);

        // Rotate propeller blades
        if (drone.mesh.userData.blades) {
            drone.mesh.userData.blades.forEach(blade => {
                blade.rotation.y += delta * 30;
            });
        }

        // Add slight bobbing motion
        drone.mesh.position.y += Math.sin(Date.now() * 0.003 + index) * 0.05;

        // Add slight rotation wobble
        drone.mesh.rotation.z = Math.sin(Date.now() * 0.002 + index) * 0.05;

        // Remove if out of bounds
        const distance = drone.mesh.position.distanceTo(drone.target);
        if (distance < 10 || drone.mesh.position.length() > 300) {
            scene.remove(drone.mesh);
            gameState.drones.splice(index, 1);
        }
    });
}

function spawnDrones() {
    const dronesPerLevel = Math.min(3 + gameState.level, 8);
    const droneTypes = ['scout', 'scout', 'fighter', 'heavy'];

    for (let i = 0; i < dronesPerLevel; i++) {
        const type = droneTypes[Math.floor(Math.random() * Math.min(droneTypes.length, 1 + gameState.level / 2))];
        setTimeout(() => {
            if (gameState.isPlaying) {
                createDrone(type);
            }
        }, i * 2000);
    }
}

// ============================================
// Weapon System
// ============================================

function shoot() {
    if (!gameState.canShoot || gameState.isReloading || !gameState.isPlaying) return;

    const weapon = gameState.weapons[gameState.currentWeapon];

    if (weapon.currentMag <= 0) {
        // Auto reload if magazine is empty
        reload();
        return;
    }

    // Decrease ammo
    weapon.currentMag--;
    gameState.shotsFired++;
    gameState.canShoot = false;

    // Play weapon sound
    if (gameState.currentWeapon === 'rifle') {
        playRifleSound();
    } else if (gameState.currentWeapon === 'sniper') {
        playSniperSound();
    } else if (gameState.currentWeapon === 'shotgun') {
        playShotgunSound();
    }

    // Fire bullets
    const pellets = gameState.currentWeapon === 'shotgun' ? weapon.pellets : 1;

    for (let i = 0; i < pellets; i++) {
        fireBullet(weapon);
    }

    // Reset shoot cooldown
    setTimeout(() => {
        gameState.canShoot = true;
    }, weapon.fireRate);

    updateHUD();
}

function fireBullet(weapon) {
    // Get camera direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Add spread
    direction.x += (Math.random() - 0.5) * weapon.spread;
    direction.y += (Math.random() - 0.5) * weapon.spread;
    direction.z += (Math.random() - 0.5) * weapon.spread;
    direction.normalize();

    // Starting position
    const startPos = camera.position.clone();
    startPos.add(direction.clone().multiplyScalar(2));

    // Create bullet tracer
    const bulletGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    const bulletMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletMesh.position.copy(startPos);
    scene.add(bulletMesh);

    // Create bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.6,
        linewidth: 2
    });
    const trailPositions = new Float32Array([
        startPos.x, startPos.y, startPos.z,
        startPos.x, startPos.y, startPos.z
    ]);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);

    const bullet = {
        mesh: bulletMesh,
        trail: trail,
        direction: direction,
        speed: weapon.bulletSpeed,
        damage: weapon.damage,
        lifetime: 2,
        distanceTraveled: 0
    };

    gameState.bullets.push(bullet);

    // Check for hits immediately using raycasting
    raycaster.set(startPos, direction);
    const intersects = raycaster.intersectObjects(
        gameState.drones.map(d => d.mesh),
        true
    );

    if (intersects.length > 0) {
        // Find which drone was hit
        for (let drone of gameState.drones) {
            if (intersects[0].object.parent === drone.mesh || intersects[0].object === drone.mesh) {
                hitDrone(drone, weapon.damage, intersects[0].point);
                break;
            }
        }
    }
}

function updateBullets(delta) {
    gameState.bullets.forEach((bullet, index) => {
        bullet.lifetime -= delta;

        if (bullet.lifetime <= 0) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);
            gameState.bullets.splice(index, 1);
            return;
        }

        // Move bullet
        const moveDistance = bullet.speed * delta;
        bullet.mesh.position.addScaledVector(bullet.direction, moveDistance);
        bullet.distanceTraveled += moveDistance;

        // Update trail
        const positions = bullet.trail.geometry.attributes.position.array;
        positions[3] = bullet.mesh.position.x;
        positions[4] = bullet.mesh.position.y;
        positions[5] = bullet.mesh.position.z;
        bullet.trail.geometry.attributes.position.needsUpdate = true;

        // Fade out bullet and trail
        bullet.mesh.material.opacity = bullet.lifetime * 0.5;
        bullet.trail.material.opacity = bullet.lifetime * 0.3;
    });
}

function reload() {
    if (gameState.isReloading || !gameState.isPlaying) return;

    const weapon = gameState.weapons[gameState.currentWeapon];

    if (weapon.currentMag === weapon.magSize || weapon.totalAmmo <= 0) {
        return; // Magazine already full or no ammo left
    }

    gameState.isReloading = true;
    document.getElementById('reloadIndicator').classList.add('show');

    playReloadSound();

    setTimeout(() => {
        const ammoNeeded = weapon.magSize - weapon.currentMag;
        const ammoToReload = Math.min(ammoNeeded, weapon.totalAmmo);

        weapon.currentMag += ammoToReload;
        weapon.totalAmmo -= ammoToReload;

        gameState.isReloading = false;
        document.getElementById('reloadIndicator').classList.remove('show');
        updateHUD();
    }, weapon.reloadTime);
}

function switchWeapon(weaponType) {
    if (gameState.isReloading || !gameState.isPlaying) return;
    gameState.currentWeapon = weaponType;
    updateHUD();
}

// ============================================
// Combat System
// ============================================

function hitDrone(drone, damage, hitPoint) {
    drone.health -= damage;
    gameState.shotsHit++;

    playHitSound();
    showHitMarker();
    createHitParticles(hitPoint);

    if (drone.health <= 0) {
        destroyDrone(drone);
    }
}

function destroyDrone(drone) {
    playExplosionSound();
    createExplosion(drone.mesh.position, drone.size);

    // Update score and stats
    gameState.score += drone.points * (1 + gameState.combo * 0.5);
    gameState.kills++;
    gameState.combo++;
    gameState.comboTimer = 3; // 3 seconds to keep combo

    // Show kill message
    showKillMessage(drone.type, drone.points);

    // Remove drone
    scene.remove(drone.mesh);
    const index = gameState.drones.indexOf(drone);
    if (index > -1) {
        gameState.drones.splice(index, 1);
    }

    // Check for level progression
    if (gameState.drones.length === 0) {
        setTimeout(() => {
            gameState.level++;
            updateHUD();
            spawnDrones();
        }, 2000);
    }

    updateHUD();
}

function showHitMarker() {
    const hitMarker = document.getElementById('hitMarker');
    hitMarker.classList.add('show');
    setTimeout(() => {
        hitMarker.classList.remove('show');
    }, 100);
}

function showKillMessage(droneType, points) {
    const killFeed = document.getElementById('killFeed');
    const message = document.createElement('div');
    message.className = 'kill-message';

    const comboText = gameState.combo > 1 ? ` (${gameState.combo}x 콤보!)` : '';
    message.textContent = `${droneType.toUpperCase()} 격추! +${points}${comboText}`;

    killFeed.insertBefore(message, killFeed.firstChild);

    setTimeout(() => {
        if (message.parentNode) {
            message.remove();
        }
    }, 3000);
}

// ============================================
// Particle Effects
// ============================================

function createHitParticles(position) {
    const particleCount = 10;
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);

    for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
            transparent: true,
            opacity: 1
        });

        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 0.5,
            fadeRate: 2
        });
    }
}

function createExplosion(position, size) {
    // Main explosion flash
    const flashGeometry = new THREE.SphereGeometry(size * 2, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    scene.add(flash);

    gameState.explosions.push({
        mesh: flash,
        lifetime: 0.3,
        maxSize: size * 4,
        currentSize: size * 2
    });

    // Debris particles
    const particleCount = 50;
    const particleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);

    for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() > 0.5 ? 0x333333 : 0xff4500,
            transparent: true,
            opacity: 1,
            emissive: 0xff4500,
            emissiveIntensity: 0.5
        });

        const particle = new THREE.Mesh(particleGeometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 10,
            (Math.random() - 0.5) * 15
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 2,
            fadeRate: 0.5,
            hasGravity: true
        });
    }

    // Smoke particles
    const smokeCount = 20;
    const smokeGeometry = new THREE.SphereGeometry(size * 0.5, 8, 8);

    for (let i = 0; i < smokeCount; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.6
        });

        const smoke = new THREE.Mesh(smokeGeometry, material);
        smoke.position.copy(position);
        scene.add(smoke);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 5 + 2,
            (Math.random() - 0.5) * 3
        );

        gameState.particles.push({
            mesh: smoke,
            velocity: velocity,
            lifetime: 3,
            fadeRate: 0.2,
            isSmoke: true
        });
    }
}

function updateParticles(delta) {
    gameState.particles.forEach((particle, index) => {
        particle.lifetime -= delta;

        if (particle.lifetime <= 0) {
            scene.remove(particle.mesh);
            gameState.particles.splice(index, 1);
            return;
        }

        // Apply gravity
        if (particle.hasGravity) {
            particle.velocity.y -= 9.8 * delta;
        }

        // Move particle
        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));

        // Fade out
        particle.mesh.material.opacity = particle.lifetime * particle.fadeRate;

        // Smoke expands and rises
        if (particle.isSmoke) {
            particle.mesh.scale.multiplyScalar(1 + delta * 0.5);
            particle.velocity.y += delta * 2;
        }

        // Rotate debris
        if (particle.hasGravity) {
            particle.mesh.rotation.x += delta * 10;
            particle.mesh.rotation.y += delta * 15;
        }
    });
}

function updateExplosions(delta) {
    gameState.explosions.forEach((explosion, index) => {
        explosion.lifetime -= delta;

        if (explosion.lifetime <= 0) {
            scene.remove(explosion.mesh);
            gameState.explosions.splice(index, 1);
            return;
        }

        // Expand explosion
        explosion.currentSize += (explosion.maxSize - explosion.currentSize) * delta * 10;
        explosion.mesh.scale.setScalar(explosion.currentSize / 2);

        // Fade out
        explosion.mesh.material.opacity = explosion.lifetime / 0.3;
    });
}

// ============================================
// Game Logic
// ============================================

function updateComboTimer(delta) {
    if (gameState.comboTimer > 0) {
        gameState.comboTimer -= delta;
        if (gameState.comboTimer <= 0) {
            gameState.combo = 0;
            updateHUD();
        }
    }
}

function updateHUD() {
    document.getElementById('score').textContent = Math.floor(gameState.score);
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('combo').textContent = gameState.combo + 'x';

    const accuracy = gameState.shotsFired > 0
        ? Math.round((gameState.shotsHit / gameState.shotsFired) * 100)
        : 100;
    document.getElementById('accuracy').textContent = accuracy + '%';

    const weapon = gameState.weapons[gameState.currentWeapon];
    document.getElementById('weaponName').textContent = weapon.name;
    document.getElementById('ammo').textContent = `${weapon.currentMag}/${weapon.totalAmmo}`;

    const ammoPercent = (weapon.currentMag / weapon.magSize) * 100;
    document.getElementById('ammoFill').style.width = ammoPercent + '%';
}

// ============================================
// Input Handling
// ============================================

document.addEventListener('click', () => {
    if (!gameState.isPlaying) return;
    shoot();
});

document.addEventListener('keydown', (e) => {
    if (!gameState.isPlaying) return;

    if (e.key === 'r' || e.key === 'R') {
        reload();
    } else if (e.key === '1') {
        switchWeapon('rifle');
    } else if (e.key === '2') {
        switchWeapon('sniper');
    } else if (e.key === '3') {
        switchWeapon('shotgun');
    }
});

document.addEventListener('mousemove', (e) => {
    if (!gameState.isPlaying) return;

    gameState.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    gameState.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;

    // Update mouse position for raycasting
    mouse.x = gameState.mouseX;
    mouse.y = gameState.mouseY;
});

// Pointer lock for better aiming
document.getElementById('gameCanvas').addEventListener('click', () => {
    if (gameState.isPlaying) {
        document.getElementById('gameCanvas').requestPointerLock =
            document.getElementById('gameCanvas').requestPointerLock ||
            document.getElementById('gameCanvas').mozRequestPointerLock;
        document.getElementById('gameCanvas').requestPointerLock();
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.getElementById('gameCanvas')) {
        // Pointer is locked, use movementX/Y for camera rotation
        const sensitivity = 0.002;
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;

        // Limit vertical rotation
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// Animation Loop
// ============================================

function animate() {
    requestAnimationFrame(animate);

    if (!gameState.isPlaying) return;

    delta = clock.getDelta();

    // Update game systems
    updateDrones(delta);
    updateBullets(delta);
    updateParticles(delta);
    updateExplosions(delta);
    updateComboTimer(delta);

    // Render scene
    renderer.render(scene, camera);
}

// ============================================
// Game Start
// ============================================

function startGame() {
    document.getElementById('startScreen').style.display = 'none';

    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.kills = 0;
    gameState.level = 1;
    gameState.combo = 0;
    gameState.shotsFired = 0;
    gameState.shotsHit = 0;

    // Reset weapons
    Object.values(gameState.weapons).forEach(weapon => {
        weapon.currentMag = weapon.magSize;
        weapon.totalAmmo = weapon.magSize * 10;
    });

    initScene();
    initAudioSystem();
    updateHUD();
    spawnDrones();
    animate();

    console.log('Game started!');
}

// Make startGame available globally
window.startGame = startGame;
