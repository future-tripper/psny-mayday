import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { formatOrdinal } from '../utils/formatters.js';

const COLOR_GRADIENT = [
    '#e8f2ff', '#c8e0ff', '#a8cfff', '#88beff',
    '#68adff', '#489cff', '#288bff', '#087aff',
    '#0869e8', '#0858d1', '#0847ba', '#0836a3',
    '#0f2c7f', '#0a1d57'
];

export default class OrreryView {
    constructor({ container, canvas, overlay, state, nodes, connections, sourceTitle, sourceFirstLine, crownContext }) {
        this.container = container;
        this.canvas = canvas;
        this.tooltip = document.getElementById('orrery-tooltip');
        this.state = state;
        this.nodes = nodes;
        this.connections = connections;
        this.sourceTitle = sourceTitle || 'The Seed';
        this.sourceFirstLine = sourceFirstLine || 'The source of all creation';
        this.crownContext = crownContext || {};

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.orbitGroup = null;
        this.starField = null;
        this.atmosphericParticles = null;
        this.godRays = [];
        this.nodeMeshes = [];
        this.wordSprites = [];
        this.seedWordSprites = [];
        this.textOverlays = [];
        this.connectionLines = [];
        this.meshById = new Map();
        this.selectedMesh = null;
        this.hoveredMesh = null;
        this.seedStar = null;
        this.seedGlow = null;
        this.seedStarOverlay = null;

        // VIEW MODE: 'galaxy' or 'crown-detail'
        this.viewMode = 'crown-detail'; // Default to crown-detail for Jewels view
        this.currentDetailCrownId = null;

        // Galaxy view elements (parent + current + children seeds)
        this.galaxySeeds = [];
        this.galaxySeedOverlays = [];

        // Crown detail view elements (14 sonnets of specific Crown)
        this.crownDetailGroup = null;

        this.animationId = null;
        this.rotationSpeed = 0.003;
        this.isPaused = false;
        this.userPaused = false;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartRotation = 0;

        // Camera controls (adjusted for better initial view)
        this.cameraDistance = 180; // Slightly zoomed out (was 150, originally 300)
        this.cameraTheta = 0;
        this.cameraPhi = Math.PI / 2.5; // Even higher angle (~72°, was PI/3 = 60°)
        this.minDistance = 80; // Allow close zoom in crown detail
        this.maxDistance = 500; // Allow far zoom for galaxy overview
        this.dragStartTheta = 0;
        this.dragStartPhi = 0;

        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
    }

    async initialize() {
        if (!this.canvas) return;
        this.setupScene();
        this.createLights();
        this.createStarField();
        this.createAtmosphericParticles();

        // Create standard Jewels view (just the 14 orbs + seed)
        this.createCentralStar();
        this.createSeedStarEnhancements();
        this.createOrbitRing();
        this.createNodes();
        this.createConnectionLines();
        this.createWordSprites();
        this.createTextOverlays();
        this.createGodRays();

        this.setupEvents();
        this.startAnimation();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Brighter, warmer background
        this.scene.fog = new THREE.FogExp2(0x2a2a3e, 0.006);
        this.scene.background = new THREE.Color(0x1a1a2e);

        const { clientWidth, clientHeight } = this.container;
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(clientWidth, clientHeight);

        this.camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 1000);
        this.updateCameraPosition();
        this.camera.lookAt(0, 0, 0);

        this.orbitGroup = new THREE.Group();
        this.scene.add(this.orbitGroup);
    }

    createLights() {
        // Much brighter ambient for overall visibility
        const ambient = new THREE.AmbientLight(0xffffff, 1.5); // Increased from 1.0 to 1.5
        this.scene.add(ambient);

        // Warm central glow - brighter
        const pointLight = new THREE.PointLight(0xffe4c2, 4.0, 450, 1.5); // Increased from 3.0 to 4.0
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);

        // Brighter rim light for definition
        const rimLight = new THREE.DirectionalLight(0xa8c5ff, 2.0); // Increased from 1.5 to 2.0
        rimLight.position.set(-60, 40, 60);
        this.scene.add(rimLight);

        // Brighter fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xffd4a8, 1.2); // Increased from 0.8 to 1.2
        fillLight.position.set(60, 20, -60);
        this.scene.add(fillLight);

        // Additional top light for depth
        const topLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased from 0.6 to 1.0
        topLight.position.set(0, 100, 0);
        this.scene.add(topLight);
    }

    createCentralStar() {
        const geometry = new THREE.SphereGeometry(16, 64, 64);
        // Golden crystal material for seed star
        const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffd700),
            emissive: new THREE.Color(0xffc107),
            emissiveIntensity: 1.2,
            roughness: 0.1,
            metalness: 0.8,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 1.0
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.name = 'seed-star';
        sphere.userData = { isSeedStar: true };
        this.seedStar = sphere;
        this.scene.add(sphere);

        // Create text overlay for seed star
        this.createSeedStarOverlay();

        const glowGeometry = new THREE.SphereGeometry(22, 64, 64);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xffd700),
            transparent: true,
            opacity: 0.25
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.seedGlow = glow;
        this.scene.add(glow);
    }

    createSeedStarOverlay() {
        // Create hover overlay for the seed star (like sonnet orbs have)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        context.fillStyle = 'rgba(255, 251, 226, 0.92)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#2b2b2b';
        context.font = 'italic 24px "EB Garamond"';
        context.textAlign = 'center';

        // For classic seed, show title; for collaborative, show first line
        const isClassic = this.crownContext.crown?.generation === 1;
        const displayText = isClassic
            ? (this.crownContext.source?.title || this.sourceTitle)
            : (this.sourceFirstLine || this.crownContext.source?.title || 'Unknown');
        const truncated = displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText;
        context.fillText(truncated, 256, 50);

        context.font = '18px "EB Garamond"';
        context.fillStyle = 'rgba(43, 43, 43, 0.7)';
        const authors = this.crownContext?.source?.authors || 'Unknown';
        const generation = this.crownContext?.crown?.generation || 1;
        const genText = generation === 1 ? 'Classic Seed' : `Generation ${generation} Seed`;
        context.fillText(`${authors} • ${genText}`, 256, 85);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(30, 7.5, 1);
        sprite.position.set(0, 25, 0);
        sprite.userData = { type: 'seed-star-overlay' };

        this.seedStarOverlay = sprite;
        this.scene.add(sprite);
    }

    createSeedStarEnhancements() {
        // Word sprites from source sonnet first line
        const words = this.sourceFirstLine.split(/\s+/).filter(w => w.length > 2);
        const selectedWords = [];

        if (words.length >= 4) {
            selectedWords.push(words[0], words[1], words[words.length - 2], words[words.length - 1]);
        } else {
            selectedWords.push(...words);
        }

        selectedWords.slice(0, 4).forEach((word, index) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;

            context.fillStyle = 'rgba(255, 215, 0, 1.0)';
            context.font = 'bold 32px "EB Garamond", serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.shadowColor = 'rgba(255, 215, 0, 0.8)';
            context.shadowBlur = 8;
            context.fillText(word, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.9
            });

            const sprite = new THREE.Sprite(spriteMaterial);

            // Position in cardinal directions around seed
            const angle = (index / 4) * Math.PI * 2;
            const radius = 22 + index * 2;

            sprite.position.set(
                Math.cos(angle) * radius,
                Math.sin(index * 1.5) * 3,
                Math.sin(angle) * radius
            );
            sprite.scale.set(10, 2.5, 1);

            sprite.userData = {
                isSeedSprite: true,
                baseAngle: angle,
                baseRadius: radius,
                baseY: Math.sin(index * 1.5) * 3,
                orbitSpeed: 0.0003 + index * 0.0001,
                floatSpeed: 0.001 + index * 0.0002,
                floatPhase: index * Math.PI / 2
            };

            this.scene.add(sprite);
            this.seedWordSprites.push(sprite);
        });

        // Radial light rays
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rayGeometry = new THREE.CylinderGeometry(0.2, 0.05, 40, 8);
            const rayMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0xffd700),
                transparent: true,
                opacity: 0.15
            });
            const ray = new THREE.Mesh(rayGeometry, rayMaterial);

            ray.position.set(
                Math.cos(angle) * 5,
                0,
                Math.sin(angle) * 5
            );
            ray.rotation.z = Math.PI / 2;
            ray.lookAt(new THREE.Vector3(Math.cos(angle) * 100, 0, Math.sin(angle) * 100));

            ray.userData = {
                isSeedRay: true,
                baseAngle: angle,
                pulsePhase: i * Math.PI / 4
            };

            this.scene.add(ray);
            this.seedWordSprites.push(ray);
        }
    }

    createOrbitRing() {
        const innerRadius = 57;
        const outerRadius = 60;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xf8b098),
            side: THREE.DoubleSide,
            opacity: 0.35,
            transparent: true
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);

        const orbitLineGeometry = new THREE.BufferGeometry();
        const points = [];
        const segments = 256;
        for (let i = 0; i <= segments; i += 1) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(theta) * innerRadius, 0.4, Math.sin(theta) * innerRadius));
        }
        orbitLineGeometry.setFromPoints(points);
        const orbitLineMaterial = new THREE.LineBasicMaterial({
            color: 0x88b6ff,
            transparent: true,
            opacity: 0.35
        });
        const orbitLine = new THREE.Line(orbitLineGeometry, orbitLineMaterial);
        this.scene.add(orbitLine);
    }

    createNodes() {
        const radius = 58;

        this.nodes.forEach((node, index) => {
            const colorIndex = Math.min(index, COLOR_GRADIENT.length - 1);
            const baseColor = new THREE.Color(COLOR_GRADIENT[colorIndex]);

            // Determine geometry based on lineage depth
            let geometry;
            const depth = node.depth || 1;
            const isComplete = node.completed_at != null;

            if (!isComplete) {
                // In-progress: sphere (unfinished potential)
                geometry = new THREE.SphereGeometry(3.5, 32, 32);
            } else if (depth === 1) {
                // First generation: icosahedron (20-sided origin)
                geometry = new THREE.IcosahedronGeometry(3.5, 0);
            } else if (depth === 2 || depth === 3) {
                // Middle generations: dodecahedron (12-sided balanced)
                geometry = new THREE.DodecahedronGeometry(3.5, 0);
            } else {
                // Late generations: octahedron (8-sided crystalline)
                geometry = new THREE.OctahedronGeometry(3.5, 0);
            }

            // Vary material based on position and completion status
            let material;
            const isEarly = index < 4;
            const isLate = index > 10;

            if (!isComplete) {
                // In-progress: frosted glass
                material = new THREE.MeshPhysicalMaterial({
                    color: baseColor,
                    emissive: baseColor.clone().multiplyScalar(0.3),
                    emissiveIntensity: 0.4,
                    roughness: 0.7,
                    metalness: 0.1,
                    transparent: true,
                    opacity: 0.6,
                    transmission: 0.3
                });
            } else if (isEarly) {
                // Early poems: clear glass
                material = new THREE.MeshPhysicalMaterial({
                    color: baseColor,
                    emissive: baseColor.clone().multiplyScalar(0.5),
                    emissiveIntensity: 0.6,
                    roughness: 0.15,
                    metalness: 0.3,
                    clearcoat: 0.8,
                    clearcoatRoughness: 0.2,
                    transparent: true,
                    opacity: 0.9
                });
            } else if (isLate) {
                // Late poems: crystal/prismatic
                material = new THREE.MeshPhysicalMaterial({
                    color: baseColor,
                    emissive: baseColor.clone().multiplyScalar(0.7),
                    emissiveIntensity: 0.8,
                    roughness: 0.05,
                    metalness: 0.7,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.05,
                    reflectivity: 1.0
                });
            } else {
                // Middle poems: standard glass
                material = new THREE.MeshPhysicalMaterial({
                    color: baseColor,
                    emissive: baseColor.clone().multiplyScalar(0.6),
                    emissiveIntensity: 0.65,
                    roughness: 0.25,
                    metalness: 0.5,
                    clearcoat: 0.5,
                    clearcoatRoughness: 0.3
                });
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                Math.cos(node.angle) * radius,
                0,
                Math.sin(node.angle) * radius
            );
            mesh.userData = { node };
            this.orbitGroup.add(mesh);
            this.nodeMeshes.push(mesh);
            this.meshById.set(node.id, { mesh, material });

            const trailGeometry = new THREE.RingGeometry(3.2, 3.5, 32);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: baseColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.rotation.x = Math.PI / 2;
            trail.position.copy(mesh.position).setY(0.1);
            this.orbitGroup.add(trail);
        });
    }

    createConnectionLines() {
        if (!this.connections || this.connections.length === 0) return;

        const radius = 58;

        this.connections.forEach((conn) => {
            const sourceNode = this.nodes.find(n => n.id === conn.source);
            const targetNode = this.nodes.find(n => n.id === conn.target);

            if (!sourceNode || !targetNode) return;

            const sourcePos = new THREE.Vector3(
                Math.cos(sourceNode.angle) * radius,
                0,
                Math.sin(sourceNode.angle) * radius
            );

            const targetPos = new THREE.Vector3(
                Math.cos(targetNode.angle) * radius,
                0,
                Math.sin(targetNode.angle) * radius
            );

            // Create curved path through center for visual interest
            const curve = new THREE.QuadraticBezierCurve3(
                sourcePos,
                new THREE.Vector3(0, 8, 0), // Control point above center
                targetPos
            );

            const points = curve.getPoints(50);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            // Color based on depth
            const depth = targetNode.depth || 1;
            let lineColor;
            if (depth === 1) {
                lineColor = new THREE.Color(0xffd700); // Gold for seed connections
            } else if (depth === 2) {
                lineColor = new THREE.Color(0x88b6ff); // Light blue
            } else {
                lineColor = new THREE.Color(0x489cff); // Medium blue
            }

            const material = new THREE.LineBasicMaterial({
                color: lineColor,
                transparent: true,
                opacity: 0.3,
                linewidth: 2
            });

            const line = new THREE.Line(geometry, material);
            line.userData = { connection: conn, sourceNode, targetNode };
            this.orbitGroup.add(line);
            this.connectionLines.push(line);

            // Add animated light particles along the line
            const particleGeometry = new THREE.SphereGeometry(0.3, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: lineColor,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.userData = {
                curve,
                offset: Math.random(),
                speed: 0.2 + Math.random() * 0.3
            };
            this.orbitGroup.add(particle);
            this.connectionLines.push(particle);
        });
    }

    createWordSprites() {
        const radius = 58;

        this.nodes.forEach((node) => {
            // Extract 2-3 interesting words from the first line
            const firstLine = node.first_line || '';
            const words = firstLine.split(/\s+/).filter(w => w.length > 3);
            const selectedWords = [];

            if (words.length >= 3) {
                selectedWords.push(words[0], words[Math.floor(words.length / 2)], words[words.length - 1]);
            } else if (words.length === 2) {
                selectedWords.push(words[0], words[1]);
            } else if (words.length === 1) {
                selectedWords.push(words[0]);
            }

            selectedWords.slice(0, 3).forEach((word, wordIndex) => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 64;

                context.fillStyle = 'rgba(255, 255, 255, 0.9)';
                context.font = '28px "EB Garamond", serif';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(word, 128, 32);

                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;

                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.7
                });

                const sprite = new THREE.Sprite(spriteMaterial);

                // Position around the orb
                const offsetAngle = (wordIndex / 3) * Math.PI * 2;
                const offsetRadius = 6 + wordIndex * 2;
                const baseX = Math.cos(node.angle) * radius;
                const baseZ = Math.sin(node.angle) * radius;

                sprite.position.set(
                    baseX + Math.cos(offsetAngle) * offsetRadius,
                    2 + wordIndex * 2,
                    baseZ + Math.sin(offsetAngle) * offsetRadius
                );
                sprite.scale.set(8, 2, 1);

                sprite.userData = {
                    nodeId: node.id,
                    baseOffset: { x: Math.cos(offsetAngle) * offsetRadius, y: 2 + wordIndex * 2, z: Math.sin(offsetAngle) * offsetRadius },
                    rotationSpeed: 0.0005 + Math.random() * 0.001,
                    rotationPhase: Math.random() * Math.PI * 2
                };

                this.orbitGroup.add(sprite);
                this.wordSprites.push(sprite);
            });
        });
    }

    createTextOverlays() {
        const radius = 58;

        this.nodes.forEach((node) => {
            const firstLine = node.first_line || 'A sonnet in the making';
            const authors = node.authors || 'Unknown';

            // Create canvas with background similar to seed star
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 128;

            // Cream background
            context.fillStyle = 'rgba(255, 251, 226, 0.92)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // First line - italic title
            context.fillStyle = '#2b2b2b';
            context.font = 'italic 24px "EB Garamond"';
            context.textAlign = 'center';
            const truncated = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;
            context.fillText(truncated, 256, 50);

            // Authors - smaller subtitle
            context.font = '18px "EB Garamond"';
            context.fillStyle = 'rgba(43, 43, 43, 0.7)';
            context.fillText(authors, 256, 85);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0
            });

            const sprite = new THREE.Sprite(spriteMaterial);
            const baseX = Math.cos(node.angle) * radius;
            const baseZ = Math.sin(node.angle) * radius;

            // Position above the orb
            sprite.position.set(baseX, 12, baseZ);
            sprite.scale.set(20, 5, 1); // Smaller, more compact

            sprite.userData = {
                nodeId: node.id,
                basePosition: { x: baseX, y: 12, z: baseZ },
                isTextOverlay: true
            };

            this.orbitGroup.add(sprite);
            this.textOverlays.push(sprite);
        });
    }

    createAtmosphericParticles() {
        // Floating dust motes creating atmosphere
        const particleCount = 800;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            // Distribute in a cylinder around the scene
            const radius = 30 + Math.random() * 120;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 100;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            // Slow drift velocities
            velocities[i * 3] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

            sizes[i] = 0.5 + Math.random() * 1.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.0,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        this.atmosphericParticles = new THREE.Points(geometry, material);
        this.scene.add(this.atmosphericParticles);
    }

    createGodRays() {
        // Volumetric light beams from seed star
        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            const height = Math.sin(i * 0.5) * 10;

            // Create cone geometry for light beam
            const geometry = new THREE.ConeGeometry(2, 80, 8, 1, true);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0xffd700),
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const ray = new THREE.Mesh(geometry, material);

            // Position and orient the ray
            ray.position.set(
                Math.cos(angle) * 3,
                height,
                Math.sin(angle) * 3
            );

            ray.rotation.z = Math.PI / 2;
            ray.lookAt(
                Math.cos(angle) * 100,
                height + Math.sin(i * 1.2) * 20,
                Math.sin(angle) * 100
            );

            ray.userData = {
                baseAngle: angle,
                baseHeight: height,
                rotationSpeed: 0.0001 + (i % 3) * 0.00005,
                pulsePhase: i * Math.PI / 6
            };

            this.scene.add(ray);
            this.godRays.push(ray);
        }
    }

    createStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 600;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i += 1) {
            positions[i * 3] = (Math.random() - 0.5) * 400;
            positions[i * 3 + 1] = Math.random() * 180;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            transparent: true,
            opacity: 0.6
        });
        this.starField = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starField);
    }

    createContextSeeds() {
        // Add parent and children seeds around the main Crown visualization
        if (!this.crownContext) return;

        const parent = this.crownContext.parent;
        const children = this.crownContext.children || [];

        // Parent seed positioned ABOVE the Crown ring (higher Y)
        if (parent) {
            this.createContextSeed({
                crownId: parent.crown_id,
                sonnetId: parent.sonnet_id,
                title: parent.sonnet_title || 'Parent Crown',
                authors: parent.authors || 'Unknown',
                generation: parent.generation,
                position: new THREE.Vector3(0, 90, 0),
                type: 'parent',
                scale: 0.8
            });
        }

        // Children seeds positioned BELOW the Crown ring (lower Y)
        // Spread them out horizontally if multiple children
        const numChildren = children.length;
        children.forEach((child, index) => {
            const xOffset = numChildren > 1 ? (index - (numChildren - 1) / 2) * 60 : 0;
            this.createContextSeed({
                crownId: child.crown_id,
                sonnetId: child.sonnet_id,
                title: `Crown ${child.crown_id}`,
                authors: 'Collaborative',
                generation: child.generation,
                completion: child.completion,
                position: new THREE.Vector3(xOffset, -90, 0),
                type: 'child',
                scale: 0.7
            });
        });
    }

    createContextSeed({ crownId, sonnetId, title, authors, generation, completion, position, type, scale }) {
        // Smaller seeds that fit around the main Crown visualization
        const size = 18 * (scale || 1);
        const geometry = new THREE.IcosahedronGeometry(size, 2);

        // Color-code by type
        let color, emissive;
        if (type === 'parent') {
            color = 0xff9800;  // Orange for parent
            emissive = 0xff6f00;
        } else {
            color = 0xfdd835;  // Yellow for children
            emissive = 0xfbc02d;
        }

        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: emissive,
            emissiveIntensity: 0.8,
            transparent: false,
            opacity: 1,
            shininess: 80
        });

        const seed = new THREE.Mesh(geometry, material);
        seed.position.copy(position);
        seed.userData = {
            type: 'context-seed',
            crownId: crownId,
            sonnetId: sonnetId,
            title: title,
            authors: authors,
            generation: generation,
            completion: completion,
            isInteractive: true
        };
        this.scene.add(seed);
        this.galaxySeeds.push(seed); // Reuse array for raycasting

        // Add glow
        const glowGeometry = new THREE.IcosahedronGeometry(size + 8, 1);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(position);
        this.scene.add(glow);
        seed.userData.glow = glow;

        // Add label
        this.createContextSeedLabel({ seed, title, authors, generation, completion, type });
    }

    createContextSeedLabel({ seed, title, authors, generation, completion, type }) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 160;

        // White background for readability
        context.fillStyle = 'rgba(255, 255, 255, 0.95)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        context.strokeStyle = 'rgba(43, 43, 43, 0.3)';
        context.lineWidth = 2;
        context.strokeRect(0, 0, canvas.width, canvas.height);

        // Title
        context.fillStyle = '#000000';
        context.font = 'italic bold 28px "EB Garamond"';
        context.textAlign = 'center';
        const truncated = title.length > 30 ? title.substring(0, 30) + '...' : title;
        context.fillText(truncated, 300, 45);

        // Subtitle
        context.font = 'bold 22px "EB Garamond"';
        context.fillStyle = '#333333';
        const genText = generation === 1 ? 'Classic' : `Gen ${generation}`;
        const label = type === 'parent' ? '↑ Parent Crown' : '↓ Child Crown';
        context.fillText(`${label} • ${genText}`, 300, 80);

        // Completion status for children
        if (completion !== undefined) {
            const isComplete = completion && completion.includes('/') && completion.split('/')[0] === completion.split('/')[1];
            context.font = 'bold 20px "Josefin Sans"';
            context.fillStyle = isComplete ? '#1B5E20' : '#E65100';
            context.fillText(completion + (isComplete ? ' ✓' : ' ⧗'), 300, 115);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(40, 11, 1);
        sprite.position.copy(seed.position);
        sprite.position.y += type === 'parent' ? 28 : -28;
        sprite.userData = {
            type: 'context-seed-label',
            linkedSeed: seed
        };

        this.galaxySeedOverlays.push(sprite);
        this.scene.add(sprite);
    }

    updateCameraPosition() {
        const x = this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const y = this.cameraDistance * Math.cos(this.cameraPhi);
        const z = this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
        this.camera.position.set(x, y, z);
        // Look slightly down to center the Crown better in viewport
        this.camera.lookAt(0, -20, 0);
    }

    setupEvents() {
        window.addEventListener('resize', () => this.onResize());
        this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
        this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
        this.canvas.addEventListener('pointerleave', (event) => this.onPointerUp(event));
        this.canvas.addEventListener('click', () => this.onClick());
        this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    }

    onResize() {
        if (!this.renderer || !this.camera) return;
        const { clientWidth, clientHeight } = this.container;
        this.renderer.setSize(clientWidth, clientHeight);
        this.camera.aspect = clientWidth / clientHeight;
        this.camera.updateProjectionMatrix();
    }

    onPointerDown(event) {
        this.isDragging = true;
        this.hasDragged = false;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.dragStartTheta = this.cameraTheta;
        this.dragStartPhi = this.cameraPhi;
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.style.cursor = 'grabbing';
    }

    onPointerMove(event) {
        if (this.isDragging) {
            const deltaX = event.clientX - this.dragStartX;
            const deltaY = event.clientY - this.dragStartY;

            // Mark as dragged if moved more than 5 pixels
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                this.hasDragged = true;
            }

            // Horizontal rotation (theta) - INVERTED for natural feel
            this.cameraTheta = this.dragStartTheta + deltaX * 0.005;

            // Vertical rotation (phi) - INVERTED and clamped to avoid flipping
            this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1,
                this.dragStartPhi - deltaY * 0.005));

            this.updateCameraPosition();
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);

        // Check context seeds first (parent/children navigation)
        if (this.galaxySeeds.length > 0) {
            const contextIntersects = this.raycaster.intersectObjects(this.galaxySeeds, false);
            if (contextIntersects.length > 0) {
                const seed = contextIntersects[0].object;
                if (seed !== this.hoveredMesh) {
                    this.setHoveredMesh(seed);
                    // Show navigation hint
                    const userData = seed.userData;
                    if (userData.type === 'context-seed') {
                        this.updateOverlayHint({
                            isContextSeed: true,
                            title: userData.title,
                            crownId: userData.crownId,
                            type: userData.type
                        });
                    }
                }
                return;
            }
        }

        // Check seed star
        if (this.seedStar) {
            const seedIntersects = this.raycaster.intersectObject(this.seedStar, false);
            if (seedIntersects.length > 0) {
                this.setHoveredMesh(this.seedStar);
                this.updateOverlayHint({ isSeedStar: true });
                return;
            }
        }

        const intersects = this.raycaster.intersectObjects(this.nodeMeshes, false);
        const intersect = intersects[0];

        if (intersect && intersect.object) {
            const { mesh } = this.meshById.get(intersect.object.userData.node.id) || {};
            if (mesh && mesh !== this.hoveredMesh) {
                this.setHoveredMesh(mesh);
                this.updateOverlayHint(intersect.object.userData.node);
            }
        } else {
            this.setHoveredMesh(null);
            this.updateOverlayHint();
        }
    }

    onPointerUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
            try {
                this.canvas.releasePointerCapture(event.pointerId);
            } catch (err) {
                // Ignore if pointer capture already released
            }
        }
    }

    onWheel(event) {
        event.preventDefault();
        event.stopPropagation();

        const delta = event.deltaY * 0.15;
        const newDistance = this.cameraDistance + delta;

        console.log('[OrreryView] Wheel event:', {
            deltaY: event.deltaY,
            currentDistance: this.cameraDistance,
            newDistance,
            clamped: Math.max(this.minDistance, Math.min(this.maxDistance, newDistance))
        });

        this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, newDistance));
        this.updateCameraPosition();
    }

    onClick() {
        // Ignore clicks that were actually drags
        if (this.hasDragged) {
            console.log('[OrreryView] Click ignored - was a drag');
            return;
        }

        console.log('[OrreryView] Click detected, hoveredMesh:', this.hoveredMesh);

        // Check if context seed clicked (navigate to that Crown)
        if (this.hoveredMesh && this.hoveredMesh.userData) {
            const userData = this.hoveredMesh.userData;
            if (userData.type === 'context-seed') {
                const crownId = userData.crownId;
                console.log('[OrreryView] Context seed clicked, navigating to Crown:', crownId);
                this.navigateToCrown(crownId);
                return;
            }
        }

        // Check if seed star is clicked
        if (this.hoveredMesh && this.hoveredMesh === this.seedStar) {
            console.log('[OrreryView] Seed star clicked - opening seed sonnet');
            // Find the first node (seed sonnet is always the first/root)
            const seedNode = this.nodes.find(n => n.position === 1 || n.depth === 1);
            if (seedNode) {
                this.state.set('selectedNodeId', seedNode.id);
            }
            return;
        }

        if (!this.hoveredMesh) {
            console.log('[OrreryView] No hovered mesh, doing raycast on click...');
            // Fallback: do raycast on click if hover didn't catch it
            this.raycaster.setFromCamera(this.pointer, this.camera);

            // Try seed star first
            if (this.seedStar) {
                const seedIntersects = this.raycaster.intersectObject(this.seedStar, false);
                if (seedIntersects.length > 0) {
                    const seedNode = this.nodes.find(n => n.position === 1 || n.depth === 1);
                    if (seedNode) {
                        console.log('[OrreryView] Click raycast found seed star');
                        this.state.set('selectedNodeId', seedNode.id);
                        return;
                    }
                }
            }

            const intersects = this.raycaster.intersectObjects(this.nodeMeshes, false);
            if (intersects.length > 0) {
                const nodeId = intersects[0].object.userData.node.id;
                console.log('[OrreryView] Click raycast found node:', nodeId);
                this.state.set('selectedNodeId', nodeId);
                return;
            }
            console.log('[OrreryView] Click raycast found nothing');
            return;
        }
        const nodeId = this.hoveredMesh.userData.node.id;
        console.log('[OrreryView] Setting selected node:', nodeId);
        this.state.set('selectedNodeId', nodeId);
    }

    setHoveredMesh(mesh) {
        if (this.hoveredMesh === mesh) return;

        // Reset previous hover
        if (this.hoveredMesh && this.hoveredMesh !== this.selectedMesh) {
            // Don't scale parent/children, only regular nodes
            if (!this.hoveredMesh.userData.isInteractive) {
                this.hoveredMesh.scale.set(1, 1, 1);
            }
        }

        this.hoveredMesh = mesh;

        // Apply new hover
        if (this.hoveredMesh && this.hoveredMesh !== this.selectedMesh) {
            // Scale up regular nodes, cursor pointer for interactive elements
            if (this.hoveredMesh.userData.isInteractive) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.hoveredMesh.scale.set(1.15, 1.15, 1.15);
                this.canvas.style.cursor = 'pointer';
            }
        } else {
            this.canvas.style.cursor = 'grab';
        }
    }

    highlightNode(nodeId) {
        const record = this.meshById.get(nodeId);
        if (!record) return;

        if (this.selectedMesh && this.selectedMesh !== record.mesh) {
            this.selectedMesh.scale.set(1, 1, 1);
            this.selectedMesh.material.emissiveIntensity = 0.25;
        }

        this.selectedMesh = record.mesh;
        this.selectedMesh.scale.set(1.3, 1.3, 1.3);
        this.selectedMesh.material.emissiveIntensity = 0.55;

        if (this.hoveredMesh && this.hoveredMesh !== this.selectedMesh) {
            this.hoveredMesh.scale.set(1, 1, 1);
        }

        const angleTarget = record.mesh.userData.node.angle;
        this.orbitGroup.rotation.y = -angleTarget;
        this.updateOverlayDetail(record.mesh.userData.node);
    }

    updateOverlayHint(node) {
        if (!this.tooltip) return;
        const title = this.tooltip.querySelector('.tooltip-title');
        const subtitle = this.tooltip.querySelector('.tooltip-subtitle');

        if (node) {
            if (node.isContextSeed) {
                const label = node.type === 'parent' ? 'Parent Crown' : 'Child Crown';
                title.textContent = node.title;
                subtitle.textContent = `Click to navigate to ${label} ${node.crownId}`;
            } else if (node.isSeedStar) {
                title.textContent = this.sourceFirstLine;
                subtitle.textContent = `${this.sourceTitle} • Click to open the source sonnet`;
            } else {
                // Show first line (title) and authors for each orb
                title.textContent = `"${node.first_line || 'A sonnet in the making'}"`;
                subtitle.textContent = `${node.authors} • Click to read the full poem`;
            }
            this.tooltip.classList.add('visible');
        } else {
            title.textContent = '';
            subtitle.textContent = '';
            this.tooltip.classList.remove('visible');
        }
    }

    updateOverlayDetail(node) {
        // Tooltip now handled by updateOverlayHint
        return;
    }

    startAnimation() {
        if (this.animationId) return;
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            const elapsed = this.clock.getElapsedTime();

            // Animate starfield
            if (this.starField) {
                this.starField.rotation.z = elapsed * 0.002;
            }

            // Animate atmospheric particles drifting
            if (this.atmosphericParticles) {
                const positions = this.atmosphericParticles.geometry.attributes.position.array;
                const velocities = this.atmosphericParticles.geometry.attributes.velocity.array;

                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += velocities[i];
                    positions[i + 1] += velocities[i + 1];
                    positions[i + 2] += velocities[i + 2];

                    // Wrap particles that drift too far
                    const radius = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
                    if (radius > 150 || Math.abs(positions[i + 1]) > 50) {
                        const angle = Math.random() * Math.PI * 2;
                        const newRadius = 30 + Math.random() * 120;
                        positions[i] = Math.cos(angle) * newRadius;
                        positions[i + 1] = (Math.random() - 0.5) * 100;
                        positions[i + 2] = Math.sin(angle) * newRadius;
                    }
                }

                this.atmosphericParticles.geometry.attributes.position.needsUpdate = true;

                // Slow rotation for atmosphere
                this.atmosphericParticles.rotation.y = elapsed * 0.0005;
            }

            // Animate god rays (Crown Detail View only)
            if (this.godRays && this.godRays.length > 0) {
                this.godRays.forEach((ray) => {
                    const { pulsePhase } = ray.userData;
                    const pulse = 0.08 + Math.sin(elapsed * 0.5 + pulsePhase) * 0.04;
                    ray.material.opacity = pulse;
                });
            }

            // Animate seed star glow pulse (Crown Detail View only)
            if (this.seedGlow) {
                const pulse = 0.25 + Math.sin(elapsed * 0.8) * 0.15;
                this.seedGlow.material.opacity = pulse;
                this.seedGlow.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.1);
            }

            // Animate seed star overlay on hover
            if (this.seedStarOverlay) {
                const isHovered = this.hoveredMesh === this.seedStar;
                const targetOpacity = isHovered ? 1.0 : 0;
                this.seedStarOverlay.material.opacity += (targetOpacity - this.seedStarOverlay.material.opacity) * 0.1;
            }

            // Animate seed word sprites orbiting and floating (Crown Detail View only)
            if (this.seedWordSprites && this.seedWordSprites.length > 0) {
                this.seedWordSprites.forEach((obj) => {
                    if (obj.userData.isSeedSprite) {
                        const { baseAngle, baseRadius, baseY, orbitSpeed, floatSpeed, floatPhase } = obj.userData;
                        const orbitAngle = baseAngle + elapsed * orbitSpeed;
                        const floatY = baseY + Math.sin(elapsed * floatSpeed + floatPhase) * 2;

                        obj.position.set(
                            Math.cos(orbitAngle) * baseRadius,
                            floatY,
                            Math.sin(orbitAngle) * baseRadius
                        );
                    } else if (obj.userData.isSeedRay) {
                        const { pulsePhase } = obj.userData;
                        const pulse = 0.15 + Math.sin(elapsed * 1.5 + pulsePhase) * 0.1;
                        obj.material.opacity = pulse;
                    }
                });
            }

            // Galaxy View: Animate seeds (breathing, rotation, glow)
            if (this.viewMode === 'galaxy') {
                this.galaxySeeds.forEach((seed) => {
                    // Breathing animation
                    const breathe = 1 + Math.sin(elapsed * 0.001) * 0.05;
                    seed.scale.set(breathe, breathe, breathe);

                    // Slow rotation
                    seed.rotation.y += 0.002;

                    // Glow pulse
                    if (seed.userData.glow) {
                        const baseOpacity = seed.userData.isCurrent ? 0.15 : 0.1;
                        const glowPulse = baseOpacity + Math.sin(elapsed * 0.0015) * 0.05;
                        seed.userData.glow.material.opacity = glowPulse;
                    }

                    // Enhance on hover
                    const isHovered = this.hoveredMesh === seed;
                    if (isHovered) {
                        const targetEmissive = seed.userData.isCurrent ? 0.8 : 0.6;
                        seed.material.emissiveIntensity += (targetEmissive - seed.material.emissiveIntensity) * 0.1;
                    } else {
                        const baseEmissive = seed.userData.isCurrent ? 0.6 : 0.4;
                        seed.material.emissiveIntensity += (baseEmissive - seed.material.emissiveIntensity) * 0.1;
                    }
                });

                // Animate galaxy seed overlays (always visible, brighten on hover)
                this.galaxySeedOverlays.forEach((sprite) => {
                    const linkedSeed = sprite.userData.linkedSeed;
                    const isHovered = this.hoveredMesh === linkedSeed;
                    const targetOpacity = isHovered ? 1.0 : 0.85;
                    sprite.material.opacity += (targetOpacity - sprite.material.opacity) * 0.15;
                });
            }

            // Crown Detail View: Animate individual sonnets
            if (this.viewMode === 'crown-detail') {
                // Breathing animation for all orbs
                if (this.nodeMeshes && this.nodeMeshes.length > 0) {
                    this.nodeMeshes.forEach((mesh, index) => {
                        const breathPhase = elapsed * 0.3 + index * 0.2;
                        const breathScale = 1 + Math.sin(breathPhase) * 0.05;
                        mesh.scale.setScalar(breathScale);

                        // Subtle emissive pulse for completed sonnets
                        if (mesh.userData.node && mesh.userData.node.completed_at) {
                            const record = this.meshById.get(mesh.userData.node.id);
                            if (record && record.material.emissiveIntensity !== undefined) {
                                const baseIntensity = mesh === this.selectedMesh ? 0.55 : 0.65;
                                const pulse = Math.sin(elapsed * 0.5 + index * 0.3) * 0.1;
                                record.material.emissiveIntensity = baseIntensity + pulse;
                            }
                        }
                    });
                }

                // Animate word sprites with gentle floating motion
                if (this.wordSprites && this.wordSprites.length > 0) {
                    this.wordSprites.forEach((sprite) => {
                        const { rotationSpeed, rotationPhase } = sprite.userData;
                        const floatY = Math.sin(elapsed * rotationSpeed + rotationPhase) * 1.5;
                        sprite.position.y = sprite.userData.baseOffset.y + floatY;

                        // Subtle fade in/out
                        const opacity = 0.5 + Math.sin(elapsed * rotationSpeed * 0.5 + rotationPhase) * 0.3;
                        sprite.material.opacity = opacity;
                    });
                }

                // Update text overlay opacity based on camera distance and hover
                if (this.textOverlays && this.textOverlays.length > 0) {
                    this.textOverlays.forEach((sprite) => {
                        const { nodeId } = sprite.userData;
                        const record = this.meshById.get(nodeId);

                        if (record && record.mesh) {
                            const isHovered = this.hoveredMesh === record.mesh;
                            const isClose = this.cameraDistance < 80;

                            // Fade in when close OR hovered
                            if (isHovered || isClose) {
                                const targetOpacity = isHovered ? 1.0 : Math.max(0, 1 - (this.cameraDistance - 60) / 20);
                                sprite.material.opacity += (targetOpacity - sprite.material.opacity) * 0.1;
                            } else {
                                sprite.material.opacity *= 0.9;
                            }
                        }
                    });
                }
            }

            // Update parent/child overlay opacity on hover (old context view - not used in galaxy mode)
            if (this.parentSeedOverlay) {
                const isHovered = this.hoveredMesh === this.parentSeedStar;
                const targetOpacity = isHovered ? 1.0 : 0.5;
                this.parentSeedOverlay.material.opacity += (targetOpacity - this.parentSeedOverlay.material.opacity) * 0.1;
            }

            if (this.childOverlays && this.childOverlays.length > 0) {
                this.childOverlays.forEach((sprite, index) => {
                    const ghost = this.childGhosts[index];
                    const isHovered = this.hoveredMesh === ghost;
                    const targetOpacity = isHovered ? 1.0 : 0.5;
                    sprite.material.opacity += (targetOpacity - sprite.material.opacity) * 0.1;
                });
            }

            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setPaused(paused) {
        this.userPaused = paused;
        this.isPaused = paused;
    }

    setMode(view) {
        if (view === 'orbit') {
            this.rotationSpeed = 0.003;
            if (!this.userPaused) {
                this.isPaused = false;
            }
            this.overlay?.classList.remove('dimmed');
            this.startAnimation();
        } else if (view === 'studio') {
            this.rotationSpeed = 0.001;
            if (!this.userPaused) {
                this.isPaused = false;
            }
            this.overlay?.classList.add('dimmed');
            this.startAnimation();
        } else {
            if (!this.userPaused) {
                this.isPaused = true;
            }
            this.overlay?.classList.remove('dimmed');
            if (this.isPaused) {
                this.stopAnimation();
            }
        }
    }

    // ===== CONTEXT VIEW METHODS (Parent/Children Navigation) =====

    // GALAXY VIEW: Show parent + current + children seeds as large prominent suns
    createGalaxyView() {
        console.log('[OrreryView] Creating Galaxy View');
        console.log('[OrreryView] crownContext:', this.crownContext);

        this.viewMode = 'galaxy';
        this.galaxySeeds = [];
        this.galaxySeedOverlays = [];

        if (!this.crownContext) {
            console.error('[OrreryView] No crownContext available');
            return;
        }

        const crownId = this.crownContext.crown?.id;
        const parent = this.crownContext.parent;
        const children = this.crownContext.children || [];

        console.log('[OrreryView] Crown ID:', crownId, 'Parent:', parent, 'Children:', children);

        // Layout: Parent above (Y=+100), Current center (Y=0), Children below (Y=-100)

        // 1. Parent seed (if exists)
        if (parent) {
            this.createGalaxySeed({
                crownId: parent.crown_id,
                sonnetId: parent.sonnet_id,
                title: parent.sonnet_title || 'Parent Seed',
                authors: parent.authors,
                generation: parent.generation,
                position: new THREE.Vector3(0, 100, 0),
                type: 'parent'
            });
        }

        // 2. Current seed (center, most prominent)
        this.createGalaxySeed({
            crownId: crownId,
            sonnetId: this.crownContext.source?.id,
            title: this.crownContext.source?.title || this.sourceTitle,
            authors: this.crownContext.source?.authors || 'Unknown',
            generation: this.crownContext.crown?.generation || 0,
            position: new THREE.Vector3(0, 0, 0),
            type: 'current',
            isCurrent: true
        });

        // 3. Children seeds (if exist)
        const numChildren = children.length;
        const spacing = 80;
        if (Array.isArray(children)) {
            children.forEach((child, index) => {
                const xOffset = (index - (numChildren - 1) / 2) * spacing;
                this.createGalaxySeed({
                    crownId: child.crown_id,
                    sonnetId: child.sonnet_id,
                    title: `Child Crown ${child.crown_id}`,
                    authors: 'Collaborative',
                    generation: child.generation,
                    completion: child.completion,
                    position: new THREE.Vector3(xOffset, -100, 0),
                    type: 'child'
                });
            });
        }

        // Connect seeds with lines
        if (parent) {
            this.createGalaxyConnection(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 0, 0));
        }
        if (Array.isArray(children)) {
            children.forEach((child, index) => {
                const xOffset = (index - (numChildren - 1) / 2) * spacing;
                this.createGalaxyConnection(new THREE.Vector3(0, 0, 0), new THREE.Vector3(xOffset, -100, 0));
            });
        }

        console.log('[OrreryView] Galaxy View created with', this.galaxySeeds.length, 'seeds');
    }

    createGalaxySeed({ crownId, sonnetId, title, authors, generation, position, type, isCurrent, completion }) {
        // HUGE prominent suns - need to be visible from camera distance 300
        const size = isCurrent ? 45 : 38;
        const geometry = new THREE.IcosahedronGeometry(size, 3);

        // ULTRA BRIGHT colors with strong emissive - must pop against dark background
        let color, emissive, emissiveIntensity;
        if (isCurrent) {
            color = 0xffeb3b;  // Current = blazing yellow
            emissive = 0xffc107;
            emissiveIntensity = 1.2;
        } else if (type === 'parent') {
            color = 0xff9800;  // Parent = bright orange
            emissive = 0xff6f00;
            emissiveIntensity = 1.0;
        } else {
            color = 0xfdd835;  // Children = bright yellow
            emissive = 0xfbc02d;
            emissiveIntensity = 0.9;
        }

        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: emissive,
            emissiveIntensity: emissiveIntensity,
            transparent: false,
            opacity: 1,
            shininess: 100
        });

        const seed = new THREE.Mesh(geometry, material);
        seed.position.copy(position);
        seed.userData = {
            type: 'galaxy-seed',
            crownId: crownId,
            sonnetId: sonnetId,
            title: title,
            authors: authors,
            generation: generation,
            isCurrent: isCurrent || false,
            completion: completion,
            isInteractive: true
        };
        this.scene.add(seed);
        this.galaxySeeds.push(seed);

        // MASSIVE glow halo to make seeds unmissable
        const glowGeometry = new THREE.IcosahedronGeometry(size + 25, 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: isCurrent ? 0.3 : 0.2,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(position);
        this.scene.add(glow);
        seed.userData.glow = glow;

        // Create text overlay
        this.createGalaxySeedOverlay({ seed, title, authors, generation, completion });
    }

    createGalaxySeedOverlay({ seed, title, authors, generation, completion }) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1000;
        canvas.height = 280;

        // VERY white background with near-opaque fill for maximum readability
        context.fillStyle = 'rgba(255, 255, 255, 0.98)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add subtle border for definition
        context.strokeStyle = 'rgba(43, 43, 43, 0.3)';
        context.lineWidth = 3;
        context.strokeRect(0, 0, canvas.width, canvas.height);

        // BLACK text for maximum contrast - LARGER fonts
        context.fillStyle = '#000000';
        context.font = 'italic bold 44px "EB Garamond"';
        context.textAlign = 'center';

        const truncated = title.length > 35 ? title.substring(0, 35) + '...' : title;
        context.fillText(truncated, 500, 80);

        context.font = 'bold 32px "EB Garamond"';
        context.fillStyle = '#222222';
        const genText = generation === 1 ? 'Classic' : `Gen ${generation}`;
        context.fillText(`${authors} • ${genText}`, 500, 135);

        if (completion !== undefined) {
            context.font = 'bold 30px "Josefin Sans"';
            const isComplete = completion && completion.startsWith && completion.split('/').filter(Boolean).length === 2 &&
                              completion.split('/')[0] === completion.split('/')[1];
            context.fillStyle = isComplete ? '#1B5E20' : '#E65100';
            context.fillText(completion, 500, 190);

            // Add status text
            context.font = 'bold 24px "Josefin Sans"';
            context.fillStyle = isComplete ? '#1B5E20' : '#E65100';
            context.fillText(isComplete ? '✓ Complete' : '⧗ In Progress', 500, 230);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0, // Always fully visible
            depthTest: false // Render on top
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(90, 25, 1); // MUCH larger for visibility from far camera
        sprite.position.copy(seed.position);
        sprite.position.y += seed.userData.isCurrent ? 70 : 60;
        sprite.userData = {
            type: 'galaxy-seed-overlay',
            linkedSeed: seed
        };

        this.galaxySeedOverlays.push(sprite);
        this.scene.add(sprite);
    }

    createGalaxyConnection(start, end) {
        const linePoints = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = start.x + (end.x - start.x) * t;
            const y = start.y + (end.y - start.y) * t;
            const z = start.z + (end.z - start.z) * t;
            linePoints.push(new THREE.Vector3(x, y, z));
        }
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineMaterial = new THREE.LineDashedMaterial({
            color: 0xffd700,
            opacity: 0.3,
            transparent: true,
            dashSize: 3,
            gapSize: 2,
            linewidth: 2
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances();
        this.scene.add(line);
        this.connectionLines.push(line);
    }


    transitionToCrownDetail() {
        console.log('[OrreryView] Transitioning to Crown Detail view');

        // Clear galaxy view elements
        this.galaxySeeds.forEach(seed => {
            if (seed.userData.glow) {
                this.scene.remove(seed.userData.glow);
            }
            this.scene.remove(seed);
        });
        this.galaxySeedOverlays.forEach(overlay => this.scene.remove(overlay));
        this.galaxySeeds = [];
        this.galaxySeedOverlays = [];

        // Clear connection lines
        this.connectionLines.forEach(line => this.scene.remove(line));
        this.connectionLines = [];

        // Switch to Crown Detail mode
        this.viewMode = 'crown-detail';

        // Recreate orbit group for Crown Detail elements
        this.orbitGroup = new THREE.Group();
        this.scene.add(this.orbitGroup);

        // Create full Crown visualization
        this.createCentralStar();
        this.createSeedStarEnhancements();
        this.createOrbitRing();
        this.createNodes();
        this.createConnectionLines();
        this.createWordSprites();
        this.createTextOverlays();
        this.createGodRays();

        // Zoom camera closer for detail view
        this.cameraDistance = 120;
        this.updateCameraPosition();

        console.log('[OrreryView] Crown Detail view created');
    }

    transitionToGalaxyView() {
        console.log('[OrreryView] Transitioning back to Galaxy view');

        // Clear Crown Detail elements
        if (this.seedStar) {
            this.scene.remove(this.seedStar);
            this.seedStar = null;
        }
        if (this.seedGlow) {
            this.scene.remove(this.seedGlow);
            this.seedGlow = null;
        }
        if (this.seedStarOverlay) {
            this.scene.remove(this.seedStarOverlay);
            this.seedStarOverlay = null;
        }
        if (this.orbitGroup) {
            this.scene.remove(this.orbitGroup);
            this.orbitGroup = null;
        }

        this.nodeMeshes.forEach(mesh => this.scene.remove(mesh));
        this.wordSprites.forEach(sprite => this.scene.remove(sprite));
        this.seedWordSprites.forEach(sprite => this.scene.remove(sprite));
        this.textOverlays.forEach(overlay => this.scene.remove(overlay));
        this.connectionLines.forEach(line => this.scene.remove(line));
        this.godRays.forEach(ray => this.scene.remove(ray));

        this.nodeMeshes = [];
        this.wordSprites = [];
        this.seedWordSprites = [];
        this.textOverlays = [];
        this.connectionLines = [];
        this.godRays = [];
        this.meshById.clear();

        // Recreate Galaxy View
        this.viewMode = 'galaxy';
        this.createGalaxyView();

        // Zoom camera back out
        this.cameraDistance = 300;
        this.updateCameraPosition();

        console.log('[OrreryView] Galaxy view restored');
    }

    navigateToCrown(crownId) {
        console.log('[OrreryView] Navigating to Crown:', crownId);
        // Navigate to the VISUALIZATION page, not the scroll page
        const currentUrl = new URL(window.location.href);
        const newUrl = currentUrl.pathname.replace(/\/crown\/\d+\/visualize/, `/crown/${crownId}/visualize`) + currentUrl.search;
        window.location.href = newUrl;
    }
}

