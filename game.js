// ============================================
// ADVANCED 3D DRONE SHOOTING GAME - FULL VERSION
// ============================================

// Game State
const gameState = {
    isPlaying: false,
    isPaused: false,
    score: 0,
    kills: 0,
    wave: 1,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    shotsFired: 0,
    shotsHit: 0,
    currentWeapon: 'rifle',
    playerHealth: 100,
    maxHealth: 100,
    weapons: {
        rifle: {
            name: '자동 소총',
            damage: 30,
            fireRate: 100,
            magSize: 30,
            totalAmmo: 300,
            currentMag: 30,
            reloadTime: 2000,
            spread: 0.008,
            bulletSpeed: 250,
            recoil: 0.01
        },
        sniper: {
            name: '저격 소총',
            damage: 150,
            fireRate: 1200,
            magSize: 5,
            totalAmmo: 50,
            currentMag: 5,
            reloadTime: 3500,
            spread: 0.001,
            bulletSpeed: 400,
            recoil: 0.05
        },
        shotgun: {
            name: '산탄총',
            damage: 20,
            fireRate: 900,
            magSize: 8,
            totalAmmo: 80,
            currentMag: 8,
            reloadTime: 2800,
            spread: 0.12,
            bulletSpeed: 180,
            pellets: 10,
            recoil: 0.08
        }
    },
    drones: [],
    bullets: [],
    particles: [],
    explosions: [],
    powerups: [],
    muzzleFlashes: [],
    isReloading: false,
    canShoot: true,
    recoilAmount: 0,
    cameraShake: 0
};

// Three.js Scene Variables
let scene, camera, renderer;
let clock, delta;
let raycaster, mouse;
let gunModel;

// Audio Context
let audioContext;
let masterGain;
let backgroundMusicSource;

// Drone configurations by type
const droneTypes = {
    scout: {
        health: 60,
        speed: 1.2,
        size: 1,
        color: 0x00ff00,
        points: 100,
        aggressive: false
    },
    fighter: {
        health: 120,
        speed: 1.5,
        size: 1.4,
        color: 0xff0000,
        points: 200,
        aggressive: true,
        attackRange: 100,
        damage: 15
    },
    heavy: {
        health: 250,
        speed: 0.7,
        size: 2,
        color: 0xff6600,
        points: 300,
        aggressive: false
    },
    boss: {
        health: 1000,
        speed: 0.8,
        size: 3,
        color: 0xff00ff,
        points: 1000,
        aggressive: true,
        attackRange: 150,
        damage: 25
    }
};

// ============================================
// Scene Initialization
// ============================================

function initScene() {
    scene = new THREE.Scene();

    // Realistic sky
    const skyColor = new THREE.Color(0x87CEEB);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 100, 500);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 0);

    // Renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gameCanvas'),
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    sunLight.position.set(150, 150, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 600;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a7d44, 0.5);
    scene.add(hemiLight);

    createSkyDome();
    createClouds();
    createGround();
    createGunModel();

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    clock = new THREE.Clock();
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
        opacity: 0.7
    });

    for (let i = 0; i < 40; i++) {
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial.clone());
        cloud.position.set(
            Math.random() * 500 - 250,
            Math.random() * 60 + 60,
            Math.random() * 500 - 250
        );
        cloud.scale.set(
            Math.random() * 2.5 + 1,
            Math.random() * 0.6 + 0.3,
            Math.random() * 2.5 + 1
        );
        cloud.userData.driftSpeed = Math.random() * 0.05 + 0.02;
        scene.add(cloud);
        gameState.particles.push({ mesh: cloud, isCloud: true });
    }
}

function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(600, 600, 60, 60);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a7d44,
        roughness: 0.9,
        metalness: 0.1
    });

    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.random() * 3;
    }
    groundGeometry.attributes.position.needsUpdate = true;
    groundGeometry.computeVertexNormals();

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -15;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(600, 60, 0x000000, 0x333333);
    gridHelper.position.y = -14.9;
    gridHelper.material.opacity = 0.15;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

function createGunModel() {
    gunModel = new THREE.Group();

    // Gun body
    const bodyGeometry = new THREE.BoxGeometry(0.15, 0.15, 1.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.4,
        metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0, 0.2);
    gunModel.add(body);

    // Barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12);
    const barrelMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.3,
        metalness: 0.9
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.2);
    gunModel.add(barrel);

    // Magazine
    const magGeometry = new THREE.BoxGeometry(0.12, 0.35, 0.08);
    const magMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.6,
        metalness: 0.4
    });
    const magazine = new THREE.Mesh(magGeometry, magMaterial);
    magazine.position.set(0, -0.2, 0.15);
    gunModel.add(magazine);

    // Scope
    const scopeGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.25, 12);
    const scopeMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.2,
        metalness: 0.95
    });
    const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, 0.12, 0.1);
    gunModel.add(scope);

    // Position gun in front of camera
    gunModel.position.set(0.35, -0.35, -0.8);
    gunModel.scale.set(1.2, 1.2, 1.2);
    camera.add(gunModel);
    scene.add(camera);

    gunModel.userData.originalPosition = gunModel.position.clone();
    gunModel.userData.originalRotation = gunModel.rotation.clone();
}

// ============================================
// Audio System
// ============================================

function initAudioSystem() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioContext.destination);

        // Start background ambient sound
        playBackgroundAmbient();
    } catch (e) {
        console.warn('Web Audio API not supported', e);
    }
}

function playBackgroundAmbient() {
    if (!audioContext) return;

    const playAmbient = () => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = 60 + Math.random() * 20;
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        gain.gain.value = 0.03;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start();
        osc.stop(audioContext.currentTime + 5);

        if (gameState.isPlaying) {
            setTimeout(playAmbient, 4000 + Math.random() * 2000);
        }
    };

    playAmbient();
}

function playRifleSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(500, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.06);
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.06);

    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.frequency.value = 1200;
    gain2.gain.setValueAtTime(0.35, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.02);
}

function playSniperSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(90, now);
    osc1.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(700, now);
    osc2.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    gain2.gain.setValueAtTime(0.6, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.18);
}

function playShotgunSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.5);
    gain1.gain.setValueAtTime(0.8, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const bufferSize = audioContext.sampleRate * 0.25;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    noise.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
}

function playExplosionSound(intensity = 1.0) {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(22, now + 0.7);
    gain1.gain.setValueAtTime(0.9 * intensity, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.7);

    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(280, now);
    osc2.frequency.exponentialRampToValueAtTime(55, now + 0.45);
    gain2.gain.setValueAtTime(0.7 * intensity, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.45);

    const bufferSize = audioContext.sampleRate * 0.6;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1200;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.6 * intensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
}

function playDroneSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.12);
    osc.frequency.linearRampToValueAtTime(85, now + 0.24);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
}

function playReloadSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    [0, 0.35, 0.7].forEach((time, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.frequency.value = [320, 220, 450][i];
        gain.gain.setValueAtTime(0.25, now + time);
        gain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.06);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + time);
        osc.stop(now + time + 0.06);
    });
}

function playHitSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
}

function playPowerupSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    [0, 0.1, 0.2].forEach((time, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.frequency.value = 440 * (1 + i * 0.5);
        gain.gain.setValueAtTime(0.3, now + time);
        gain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.3);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + time);
        osc.stop(now + time + 0.3);
    });
}

function playDamageSound() {
    if (!audioContext) return;
    const now = audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
}

// ============================================
// Drone System
// ============================================

function createDrone(type = 'scout') {
    const config = droneTypes[type];

    const bodyGeometry = new THREE.BoxGeometry(config.size, config.size * 0.35, config.size);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: 0.25,
        metalness: 0.8,
        emissive: config.color,
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;

    const droneGroup = new THREE.Group();
    droneGroup.add(body);

    // Propellers and blades
    const propellerGeometry = new THREE.CylinderGeometry(0.06, 0.06, config.size * 0.7, 10);
    const propellerMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.4,
        metalness: 0.9
    });

    const propellerPositions = [
        [config.size * 0.45, 0, config.size * 0.45],
        [config.size * 0.45, 0, -config.size * 0.45],
        [-config.size * 0.45, 0, config.size * 0.45],
        [-config.size * 0.45, 0, -config.size * 0.45]
    ];

    droneGroup.userData.blades = [];

    propellerPositions.forEach(pos => {
        const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
        propeller.rotation.x = Math.PI / 2;
        propeller.position.set(pos[0], pos[1], pos[2]);
        droneGroup.add(propeller);

        const bladeGeometry = new THREE.BoxGeometry(config.size * 0.5, 0.025, 0.1);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.3,
            metalness: 0.95
        });
        const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
        const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade2.rotation.y = Math.PI / 2;
        const bladeGroup = new THREE.Group();
        bladeGroup.add(blade1);
        bladeGroup.add(blade2);
        bladeGroup.position.set(pos[0], pos[1] + config.size * 0.4, pos[2]);
        droneGroup.add(bladeGroup);

        droneGroup.userData.blades.push(bladeGroup);
    });

    // LED lights
    const lightGeometry = new THREE.SphereGeometry(0.12, 10, 10);
    const light1Material = new THREE.MeshBasicMaterial({
        color: config.aggressive ? 0xff0000 : 0x00ff00,
        transparent: true,
        opacity: 0.9
    });
    const light1 = new THREE.Mesh(lightGeometry, light1Material);
    light1.position.set(config.size * 0.45, 0, 0);
    droneGroup.add(light1);

    const light2 = new THREE.Mesh(lightGeometry, light1Material.clone());
    light2.position.set(-config.size * 0.45, 0, 0);
    droneGroup.add(light2);

    // Add point lights for glow effect
    const pointLight = new THREE.PointLight(config.color, 1, 20);
    pointLight.position.set(0, 0, 0);
    droneGroup.add(pointLight);

    // Spawn positioning
    const side = Math.floor(Math.random() * 4);
    let startX, startY, startZ, targetX, targetZ;

    startY = 25 + Math.random() * 40;

    switch(side) {
        case 0:
            startX = -180;
            startZ = Math.random() * 120 - 60;
            targetX = config.aggressive ? 0 : 180;
            targetZ = config.aggressive ? 0 : Math.random() * 120 - 60;
            break;
        case 1:
            startX = 180;
            startZ = Math.random() * 120 - 60;
            targetX = config.aggressive ? 0 : -180;
            targetZ = config.aggressive ? 0 : Math.random() * 120 - 60;
            break;
        case 2:
            startX = Math.random() * 120 - 60;
            startZ = -180;
            targetX = config.aggressive ? 0 : Math.random() * 120 - 60;
            targetZ = config.aggressive ? 0 : 180;
            break;
        case 3:
            startX = Math.random() * 120 - 60;
            startZ = 180;
            targetX = config.aggressive ? 0 : Math.random() * 120 - 60;
            targetZ = config.aggressive ? 0 : -180;
            break;
    }

    droneGroup.position.set(startX, startY, startZ);

    const direction = new THREE.Vector3(targetX - startX, 0, targetZ - startZ);
    direction.normalize();

    droneGroup.lookAt(new THREE.Vector3(targetX, startY, targetZ));

    scene.add(droneGroup);

    const drone = {
        mesh: droneGroup,
        type: type,
        health: config.health,
        maxHealth: config.health,
        speed: config.speed * (1 + gameState.wave * 0.08),
        direction: direction,
        target: new THREE.Vector3(targetX, startY, targetZ),
        points: config.points,
        size: config.size,
        aggressive: config.aggressive,
        attackRange: config.attackRange || 0,
        damage: config.damage || 0,
        attackCooldown: 0
    };

    gameState.drones.push(drone);
    playDroneSound();

    return drone;
}

function updateDrones(delta) {
    gameState.drones.forEach((drone, index) => {
        // If aggressive, move towards player
        if (drone.aggressive) {
            const playerPos = camera.position;
            const dronePos = drone.mesh.position;
            const distanceToPlayer = dronePos.distanceTo(playerPos);

            if (distanceToPlayer < drone.attackRange) {
                // Attack player
                drone.attackCooldown -= delta;
                if (drone.attackCooldown <= 0) {
                    attackPlayer(drone);
                    drone.attackCooldown = 2 + Math.random();
                }

                // Circle around player
                const circleDir = new THREE.Vector3(
                    playerPos.x - dronePos.x,
                    0,
                    playerPos.z - dronePos.z
                );
                circleDir.normalize();
                const perpendicular = new THREE.Vector3(-circleDir.z, 0, circleDir.x);
                drone.direction.copy(circleDir).add(perpendicular.multiplyScalar(0.5)).normalize();
            } else {
                // Move towards player
                drone.direction.set(
                    playerPos.x - dronePos.x,
                    0,
                    playerPos.z - dronePos.z
                ).normalize();
            }

            drone.mesh.lookAt(playerPos);
        }

        // Move drone
        drone.mesh.position.addScaledVector(drone.direction, drone.speed * delta * 60);

        // Rotate propeller blades
        if (drone.mesh.userData.blades) {
            drone.mesh.userData.blades.forEach(blade => {
                blade.rotation.y += delta * 35;
            });
        }

        // Bobbing motion
        drone.mesh.position.y += Math.sin(Date.now() * 0.003 + index) * 0.06;

        // Rotation wobble
        drone.mesh.rotation.z = Math.sin(Date.now() * 0.002 + index) * 0.06;

        // Remove if out of bounds
        const distance = drone.aggressive ?
            drone.mesh.position.distanceTo(camera.position) :
            drone.mesh.position.distanceTo(drone.target);

        if ((!drone.aggressive && distance < 10) || drone.mesh.position.length() > 400) {
            scene.remove(drone.mesh);
            gameState.drones.splice(index, 1);
        }
    });
}

function attackPlayer(drone) {
    damagePlayer(drone.damage);

    // Visual effect - shoot projectile at player
    const projGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const projMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const projectile = new THREE.Mesh(projGeometry, projMaterial);
    projectile.position.copy(drone.mesh.position);
    scene.add(projectile);

    const projLight = new THREE.PointLight(0xff0000, 2, 10);
    projectile.add(projLight);

    const direction = new THREE.Vector3()
        .subVectors(camera.position, drone.mesh.position)
        .normalize();

    gameState.bullets.push({
        mesh: projectile,
        direction: direction,
        speed: 100,
        lifetime: 2,
        isDroneProjectile: true
    });

    playHitSound();
}

function damagePlayer(damage) {
    gameState.playerHealth -= damage;
    gameState.playerHealth = Math.max(0, gameState.playerHealth);

    // Visual feedback
    document.getElementById('damageVignette').classList.add('show');
    setTimeout(() => {
        document.getElementById('damageVignette').classList.remove('show');
    }, 300);

    // Camera shake
    gameState.cameraShake = 0.5;

    playDamageSound();
    updateHUD();

    if (gameState.playerHealth <= 0) {
        gameOver();
    }
}

function spawnWave() {
    const isBossWave = gameState.wave % 3 === 0;
    const dronesPerWave = Math.min(4 + gameState.wave, 12);

    // Show wave indicator
    const waveIndicator = document.getElementById('waveIndicator');
    waveIndicator.textContent = isBossWave ?
        `보스 웨이브 ${gameState.wave}!` :
        `웨이브 ${gameState.wave}`;
    waveIndicator.classList.add('show');
    setTimeout(() => {
        waveIndicator.classList.remove('show');
    }, 3000);

    playExplosionSound(0.5);

    // Spawn drones
    for (let i = 0; i < dronesPerWave; i++) {
        let type;
        if (isBossWave && i === 0) {
            type = 'boss';
        } else {
            const rand = Math.random();
            if (rand < 0.4) type = 'scout';
            else if (rand < 0.7) type = 'fighter';
            else type = 'heavy';
        }

        setTimeout(() => {
            if (gameState.isPlaying && !gameState.isPaused) {
                createDrone(type);
            }
        }, i * 1800);
    }
}

// ============================================
// Weapon System
// ============================================

function shoot() {
    if (!gameState.canShoot || gameState.isReloading || !gameState.isPlaying || gameState.isPaused) return;

    const weapon = gameState.weapons[gameState.currentWeapon];

    if (weapon.currentMag <= 0) {
        reload();
        return;
    }

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

    // Muzzle flash
    createMuzzleFlash();

    // Gun recoil
    applyRecoil(weapon.recoil);

    // Crosshair animation
    document.getElementById('crosshair').classList.add('firing');
    setTimeout(() => {
        document.getElementById('crosshair').classList.remove('firing');
    }, 100);

    // Fire bullets
    const pellets = gameState.currentWeapon === 'shotgun' ? weapon.pellets : 1;

    for (let i = 0; i < pellets; i++) {
        fireBullet(weapon);
    }

    setTimeout(() => {
        gameState.canShoot = true;
    }, weapon.fireRate);

    updateHUD();
}

function createMuzzleFlash() {
    const flashGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(gunModel.position);
    flash.position.z -= 1.2;

    const flashLight = new THREE.PointLight(0xffaa00, 5, 10);
    flash.add(flashLight);

    camera.add(flash);

    gameState.muzzleFlashes.push({
        mesh: flash,
        lifetime: 0.05
    });
}

function applyRecoil(amount) {
    gameState.recoilAmount += amount;

    // Gun kick
    if (gunModel) {
        gunModel.rotation.x -= amount * 0.5;
        gunModel.position.z += amount * 0.3;
    }
}

function fireBullet(weapon) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Add spread
    direction.x += (Math.random() - 0.5) * weapon.spread;
    direction.y += (Math.random() - 0.5) * weapon.spread;
    direction.z += (Math.random() - 0.5) * weapon.spread;
    direction.normalize();

    const startPos = camera.position.clone();
    startPos.add(direction.clone().multiplyScalar(2));

    // Bullet tracer
    const bulletGeometry = new THREE.SphereGeometry(0.12, 6, 6);
    const bulletMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9
    });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletMesh.position.copy(startPos);
    scene.add(bulletMesh);

    // Bullet trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7,
        linewidth: 3
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
        lifetime: 3,
        distanceTraveled: 0
    };

    gameState.bullets.push(bullet);

    // Raycast for hit detection
    raycaster.set(startPos, direction);
    const intersects = raycaster.intersectObjects(
        gameState.drones.map(d => d.mesh),
        true
    );

    if (intersects.length > 0) {
        for (let drone of gameState.drones) {
            if (intersects[0].object.parent === drone.mesh ||
                intersects[0].object.parent.parent === drone.mesh) {
                hitDrone(drone, weapon.damage, intersects[0].point);
                break;
            }
        }
    }
}

function updateBullets(delta) {
    gameState.bullets = gameState.bullets.filter((bullet, index) => {
        bullet.lifetime -= delta;

        if (bullet.lifetime <= 0) {
            scene.remove(bullet.mesh);
            if (bullet.trail) scene.remove(bullet.trail);
            return false;
        }

        const moveDistance = bullet.speed * delta;
        bullet.mesh.position.addScaledVector(bullet.direction, moveDistance);
        bullet.distanceTraveled += moveDistance;

        if (bullet.trail) {
            const positions = bullet.trail.geometry.attributes.position.array;
            positions[3] = bullet.mesh.position.x;
            positions[4] = bullet.mesh.position.y;
            positions[5] = bullet.mesh.position.z;
            bullet.trail.geometry.attributes.position.needsUpdate = true;

            bullet.mesh.material.opacity = bullet.lifetime * 0.3;
            bullet.trail.material.opacity = bullet.lifetime * 0.25;
        }

        // Check collision with player for drone projectiles
        if (bullet.isDroneProjectile) {
            const distToPlayer = bullet.mesh.position.distanceTo(camera.position);
            if (distToPlayer < 2) {
                damagePlayer(5);
                scene.remove(bullet.mesh);
                return false;
            }
        }

        return true;
    });
}

function reload() {
    if (gameState.isReloading || !gameState.isPlaying || gameState.isPaused) return;

    const weapon = gameState.weapons[gameState.currentWeapon];

    if (weapon.currentMag === weapon.magSize || weapon.totalAmmo <= 0) {
        return;
    }

    gameState.isReloading = true;
    document.getElementById('reloadIndicator').classList.add('show');

    playReloadSound();

    // Gun reload animation
    if (gunModel) {
        const originalY = gunModel.position.y;
        const reloadAnim = setInterval(() => {
            gunModel.position.y -= 0.02;
        }, 20);

        setTimeout(() => {
            clearInterval(reloadAnim);
            gunModel.position.y = originalY;
        }, weapon.reloadTime / 2);
    }

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
    if (gameState.isReloading || !gameState.isPlaying || gameState.isPaused) return;
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

    // Damage indicator on drone
    const damageText = document.createElement('div');
    damageText.textContent = `-${damage}`;
    damageText.style.position = 'absolute';
    damageText.style.color = '#ff0000';
    damageText.style.fontSize = '24px';
    damageText.style.fontWeight = 'bold';
    damageText.style.pointerEvents = 'none';

    if (drone.health <= 0) {
        destroyDrone(drone);
    }
}

function destroyDrone(drone) {
    playExplosionSound(drone.size / 2);
    createExplosion(drone.mesh.position, drone.size);

    // Update score and stats
    const comboMultiplier = 1 + gameState.combo * 0.3;
    const pointsEarned = Math.floor(drone.points * comboMultiplier);
    gameState.score += pointsEarned;
    gameState.kills++;
    gameState.combo++;
    gameState.maxCombo = Math.max(gameState.combo, gameState.maxCombo);
    gameState.comboTimer = 3.5;

    // Show kill message
    showKillMessage(drone.type, pointsEarned);

    // Spawn power-up chance
    if (Math.random() < 0.2) {
        spawnPowerup(drone.mesh.position);
    }

    // Remove drone
    scene.remove(drone.mesh);
    const index = gameState.drones.indexOf(drone);
    if (index > -1) {
        gameState.drones.splice(index, 1);
    }

    // Check for wave completion
    if (gameState.drones.length === 0) {
        setTimeout(() => {
            if (gameState.isPlaying && !gameState.isPaused) {
                gameState.wave++;
                updateHUD();
                spawnWave();
            }
        }, 2500);
    }

    updateHUD();
}

function showHitMarker() {
    const hitMarker = document.getElementById('hitMarker');
    hitMarker.classList.add('show');
    setTimeout(() => {
        hitMarker.classList.remove('show');
    }, 80);
}

function showKillMessage(droneType, points) {
    const killFeed = document.getElementById('killFeed');
    const message = document.createElement('div');
    message.className = 'kill-message';

    let typeName = droneType.toUpperCase();
    const comboText = gameState.combo > 1 ? ` (${gameState.combo}x 콤보!)` : '';
    message.textContent = `${typeName} 격추! +${points}${comboText}`;

    killFeed.insertBefore(message, killFeed.firstChild);

    setTimeout(() => {
        if (message.parentNode) {
            message.remove();
        }
    }, 3200);
}

// ============================================
// Power-up System
// ============================================

function spawnPowerup(position) {
    const type = Math.random() < 0.6 ? 'health' : 'ammo';

    const geometry = new THREE.SphereGeometry(0.8, 16, 16);
    const material = new THREE.MeshBasicMaterial({
        color: type === 'health' ? 0x00ff00 : 0xffff00,
        transparent: true,
        opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y = 10;
    scene.add(mesh);

    const light = new THREE.PointLight(
        type === 'health' ? 0x00ff00 : 0xffff00,
        2,
        15
    );
    mesh.add(light);

    const powerup = {
        mesh: mesh,
        type: type,
        lifetime: 15,
        rotationSpeed: 2
    };

    gameState.powerups.push(powerup);
}

function updatePowerups(delta) {
    gameState.powerups = gameState.powerups.filter(powerup => {
        powerup.lifetime -= delta;

        if (powerup.lifetime <= 0) {
            scene.remove(powerup.mesh);
            return false;
        }

        // Rotate
        powerup.mesh.rotation.y += delta * powerup.rotationSpeed;

        // Bob up and down
        powerup.mesh.position.y += Math.sin(Date.now() * 0.003) * 0.03;

        // Check collision with player
        const distToPlayer = powerup.mesh.position.distanceTo(camera.position);
        if (distToPlayer < 3) {
            collectPowerup(powerup);
            scene.remove(powerup.mesh);
            return false;
        }

        // Fade out near end
        if (powerup.lifetime < 3) {
            powerup.mesh.material.opacity = powerup.lifetime / 3;
        }

        return true;
    });
}

function collectPowerup(powerup) {
    playPowerupSound();

    const notification = document.getElementById('powerupNotification');

    if (powerup.type === 'health') {
        gameState.playerHealth = Math.min(gameState.maxHealth, gameState.playerHealth + 30);
        notification.textContent = '💚 체력 회복 +30';
        notification.style.color = '#00ff00';
        notification.style.borderColor = '#00ff00';
    } else if (powerup.type === 'ammo') {
        Object.values(gameState.weapons).forEach(weapon => {
            weapon.totalAmmo += weapon.magSize * 2;
        });
        notification.textContent = '💛 탄약 보급 완료';
        notification.style.color = '#ffff00';
        notification.style.borderColor = '#ffff00';
    }

    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);

    updateHUD();
}

// ============================================
// Particle Effects
// ============================================

function createHitParticles(position) {
    const particleCount = 15;
    const geometry = new THREE.SphereGeometry(0.06, 4, 4);

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
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 0.6,
            fadeRate: 1.7
        });
    }
}

function createExplosion(position, size) {
    // Main flash
    const flashGeometry = new THREE.SphereGeometry(size * 2.5, 16, 16);
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
        lifetime: 0.35,
        maxSize: size * 5,
        currentSize: size * 2.5
    });

    // Explosion light
    const expLight = new THREE.PointLight(0xff6600, 10, 50);
    expLight.position.copy(position);
    scene.add(expLight);
    setTimeout(() => scene.remove(expLight), 200);

    // Debris
    const particleCount = 60;
    const particleGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);

    for (let i = 0; i < particleCount; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() > 0.5 ? 0x333333 : 0xff4500,
            transparent: true,
            opacity: 1,
            emissive: 0xff4500,
            emissiveIntensity: 0.6
        });

        const particle = new THREE.Mesh(particleGeometry, material);
        particle.position.copy(position);
        scene.add(particle);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            Math.random() * 12,
            (Math.random() - 0.5) * 18
        );

        gameState.particles.push({
            mesh: particle,
            velocity: velocity,
            lifetime: 2.5,
            fadeRate: 0.4,
            hasGravity: true
        });
    }

    // Smoke
    const smokeCount = 25;
    const smokeGeometry = new THREE.SphereGeometry(size * 0.6, 8, 8);

    for (let i = 0; i < smokeCount; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.7
        });

        const smoke = new THREE.Mesh(smokeGeometry, material);
        smoke.position.copy(position);
        scene.add(smoke);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 6 + 3,
            (Math.random() - 0.5) * 4
        );

        gameState.particles.push({
            mesh: smoke,
            velocity: velocity,
            lifetime: 3.5,
            fadeRate: 0.2,
            isSmoke: true
        });
    }

    // Camera shake
    gameState.cameraShake = size * 0.3;
}

function updateParticles(delta) {
    gameState.particles = gameState.particles.filter(particle => {
        if (particle.isCloud) return true;

        particle.lifetime -= delta;

        if (particle.lifetime <= 0) {
            scene.remove(particle.mesh);
            return false;
        }

        if (particle.hasGravity) {
            particle.velocity.y -= 12 * delta;
        }

        particle.mesh.position.add(particle.velocity.clone().multiplyScalar(delta));
        particle.mesh.material.opacity = particle.lifetime * particle.fadeRate;

        if (particle.isSmoke) {
            particle.mesh.scale.multiplyScalar(1 + delta * 0.6);
            particle.velocity.y += delta * 2.5;
        }

        if (particle.hasGravity) {
            particle.mesh.rotation.x += delta * 12;
            particle.mesh.rotation.y += delta * 18;
        }

        return true;
    });

    // Update clouds
    gameState.particles.forEach(particle => {
        if (particle.isCloud && particle.mesh.userData.driftSpeed) {
            particle.mesh.position.x += particle.mesh.userData.driftSpeed * delta * 60;
            if (particle.mesh.position.x > 300) {
                particle.mesh.position.x = -300;
            }
        }
    });
}

function updateExplosions(delta) {
    gameState.explosions = gameState.explosions.filter(explosion => {
        explosion.lifetime -= delta;

        if (explosion.lifetime <= 0) {
            scene.remove(explosion.mesh);
            return false;
        }

        explosion.currentSize += (explosion.maxSize - explosion.currentSize) * delta * 12;
        explosion.mesh.scale.setScalar(explosion.currentSize / 2.5);
        explosion.mesh.material.opacity = explosion.lifetime / 0.35;

        return true;
    });
}

function updateMuzzleFlashes(delta) {
    gameState.muzzleFlashes = gameState.muzzleFlashes.filter(flash => {
        flash.lifetime -= delta;

        if (flash.lifetime <= 0) {
            camera.remove(flash.mesh);
            return false;
        }

        flash.mesh.material.opacity = flash.lifetime / 0.05;

        return true;
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

function updateRecoil(delta) {
    if (gameState.recoilAmount > 0) {
        gameState.recoilAmount -= delta * 2;
        gameState.recoilAmount = Math.max(0, gameState.recoilAmount);

        camera.rotation.x -= gameState.recoilAmount * delta;
    }

    // Gun return to position
    if (gunModel) {
        gunModel.position.lerp(gunModel.userData.originalPosition, delta * 8);
        gunModel.rotation.x += (gunModel.userData.originalRotation.x - gunModel.rotation.x) * delta * 8;
    }
}

function updateCameraShake(delta) {
    if (gameState.cameraShake > 0) {
        camera.position.x += (Math.random() - 0.5) * gameState.cameraShake;
        camera.position.y += (Math.random() - 0.5) * gameState.cameraShake;

        gameState.cameraShake -= delta * 3;
        gameState.cameraShake = Math.max(0, gameState.cameraShake);
    }
}

function updateHUD() {
    document.getElementById('score').textContent = Math.floor(gameState.score);
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('wave').textContent = gameState.wave;
    document.getElementById('combo').textContent = gameState.combo + 'x';

    const accuracy = gameState.shotsFired > 0
        ? Math.round((gameState.shotsHit / gameState.shotsFired) * 100)
        : 100;
    document.getElementById('accuracy').textContent = accuracy + '%';

    // Health bar
    const healthPercent = (gameState.playerHealth / gameState.maxHealth) * 100;
    const healthFill = document.getElementById('healthFill');
    healthFill.style.width = healthPercent + '%';
    document.getElementById('healthText').textContent =
        `${Math.floor(gameState.playerHealth)} / ${gameState.maxHealth}`;

    if (healthPercent < 30) {
        healthFill.classList.add('low-health');
    } else {
        healthFill.classList.remove('low-health');
    }

    // Weapon info
    const weapon = gameState.weapons[gameState.currentWeapon];
    document.getElementById('weaponName').textContent = weapon.name;
    document.getElementById('ammo').textContent = `${weapon.currentMag}/${weapon.totalAmmo}`;

    const ammoPercent = (weapon.currentMag / weapon.magSize) * 100;
    document.getElementById('ammoFill').style.width = ammoPercent + '%';
}

function pauseGame() {
    if (!gameState.isPlaying || gameState.isPaused) return;
    gameState.isPaused = true;
    document.getElementById('pauseMenu').classList.add('show');
    document.exitPointerLock();
}

function resumeGame() {
    gameState.isPaused = false;
    document.getElementById('pauseMenu').classList.remove('show');
    document.getElementById('gameCanvas').requestPointerLock();
}

function restartGame() {
    // Reset game state
    gameState.isPlaying = false;
    gameState.isPaused = false;

    // Clear all objects
    gameState.drones.forEach(drone => scene.remove(drone.mesh));
    gameState.bullets.forEach(bullet => {
        scene.remove(bullet.mesh);
        if (bullet.trail) scene.remove(bullet.trail);
    });
    gameState.particles.forEach(particle => {
        if (!particle.isCloud) scene.remove(particle.mesh);
    });
    gameState.explosions.forEach(explosion => scene.remove(explosion.mesh));
    gameState.powerups.forEach(powerup => scene.remove(powerup.mesh));

    gameState.drones = [];
    gameState.bullets = [];
    gameState.explosions = [];
    gameState.powerups = [];

    document.getElementById('pauseMenu').classList.remove('show');
    document.getElementById('gameOverScreen').classList.remove('show');

    // Restart
    startGame();
}

function quitToMenu() {
    gameState.isPlaying = false;
    gameState.isPaused = false;

    document.getElementById('pauseMenu').classList.remove('show');
    document.getElementById('gameOverScreen').classList.remove('show');
    document.getElementById('startScreen').style.display = 'flex';

    document.exitPointerLock();
}

function gameOver() {
    gameState.isPlaying = false;

    const accuracy = gameState.shotsFired > 0
        ? Math.round((gameState.shotsHit / gameState.shotsFired) * 100)
        : 100;

    document.getElementById('finalScore').textContent = Math.floor(gameState.score);
    document.getElementById('finalKills').textContent = gameState.kills;
    document.getElementById('finalWave').textContent = gameState.wave;
    document.getElementById('finalCombo').textContent = gameState.maxCombo + 'x';
    document.getElementById('finalAccuracy').textContent = accuracy + '%';

    document.getElementById('gameOverScreen').classList.add('show');
    document.exitPointerLock();

    playExplosionSound(1.5);
}

// ============================================
// Input Handling
// ============================================

document.addEventListener('click', () => {
    if (!gameState.isPlaying || gameState.isPaused) return;
    shoot();
});

document.addEventListener('keydown', (e) => {
    if (!gameState.isPlaying) return;

    if (e.key === 'Escape') {
        if (gameState.isPaused) {
            resumeGame();
        } else {
            pauseGame();
        }
    }

    if (gameState.isPaused) return;

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

// Pointer lock
document.getElementById('gameCanvas').addEventListener('click', () => {
    if (gameState.isPlaying && !gameState.isPaused) {
        document.getElementById('gameCanvas').requestPointerLock();
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.getElementById('gameCanvas')) {
        const sensitivity = 0.0018;
        camera.rotation.y -= e.movementX * sensitivity;
        camera.rotation.x -= e.movementY * sensitivity;

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

    if (!gameState.isPlaying || gameState.isPaused) return;

    delta = clock.getDelta();

    updateDrones(delta);
    updateBullets(delta);
    updateParticles(delta);
    updateExplosions(delta);
    updateMuzzleFlashes(delta);
    updatePowerups(delta);
    updateComboTimer(delta);
    updateRecoil(delta);
    updateCameraShake(delta);

    renderer.render(scene, camera);
}

// ============================================
// Game Start
// ============================================

function startGame() {
    document.getElementById('startScreen').style.display = 'none';

    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.score = 0;
    gameState.kills = 0;
    gameState.wave = 1;
    gameState.combo = 0;
    gameState.maxCombo = 0;
    gameState.shotsFired = 0;
    gameState.shotsHit = 0;
    gameState.playerHealth = 100;

    Object.values(gameState.weapons).forEach(weapon => {
        weapon.currentMag = weapon.magSize;
        weapon.totalAmmo = weapon.magSize * 10;
    });

    if (!scene) {
        initScene();
        initAudioSystem();
    }

    updateHUD();
    spawnWave();
    animate();

    document.getElementById('gameCanvas').requestPointerLock();
}

window.startGame = startGame;
window.resumeGame = resumeGame;
window.restartGame = restartGame;
window.quitToMenu = quitToMenu;
