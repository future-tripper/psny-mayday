// ═══════════════════════════════════════════════════════════════════════
// FRACTAL CROWN OF SONNETS - COSMOS VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════
//
// STRUCTURE:
// - SEED POEM (14 lines) spawns 14 sonnets via overlapping line pairs:
//     Lines 1-2 → Sonnet 1
//     Lines 2-3 → Sonnet 2
//     ...
//     Lines 14-1 → Sonnet 14 (wraps back to complete the crown!)
//
// - Each of those 14 sonnets becomes a seed for a NEW crown
// - This creates exponential, fractal growth
// ═══════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

const CONFIG = {
    colors: {
        background: '#0a0a0f',
        generations: {
            1: { main: '#d4a574', glow: 'rgba(212, 165, 116, 0.3)', ring: 'rgba(212, 165, 116, 0.15)' },
            2: { main: '#7eb8da', glow: 'rgba(126, 184, 218, 0.3)', ring: 'rgba(126, 184, 218, 0.15)' },
            3: { main: '#8fbc8f', glow: 'rgba(143, 188, 143, 0.3)', ring: 'rgba(143, 188, 143, 0.15)' }
        },
        spawn: '#c9a227',
        text: 'rgba(255, 255, 255, 0.3)'
    },
    crown: {
        radius: 70,
        glowRadius: 120
    },
    stars: {
        count: 500,
        spread: 4000
    },
    zoom: {
        min: 0.25,
        max: 3,
        default: 1
    }
};

// ─────────────────────────────────────────────────────────────────────────
// DATA GENERATION (Replace with API calls in production)
// ─────────────────────────────────────────────────────────────────────────

// Example original seed poem
const ORIGINAL_SEED = {
    title: "In this strange labyrinth how shall I turn",
    author: "Lady Mary Wroth",
    lines: [
        "In this strange labyrinth, how shall I turn?",
        "Paths lie on every side, yet still I stray.",
        "If to the right, there love makes me burn;",
        "If I go forward, danger bars the way.",
        "If to the left, suspicion spoils all bliss;",
        "If I turn back, shame cries that I should return.",
        "I dare not faint, though crosses strike my fate;",
        "To stand still is hardest, though it leads to mourn.",
        "So let me take the right or left-hand way,",
        "Go forward, stand still, or backward retreat;",
        "These doubts I must endure without delay,",
        "With no relief, but travel as my fate.",
        "Yet what most stirs my troubled heart above",
        "Is leaving all, to take the thread of Love."
    ]
};

function romanize(num) {
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
    return roman[num - 1] || num;
}

function getRandomAuthors(seed) {
    const names = [
        "Alice", "Bob", "Carol", "Dan", "Eve", "Frank", "Grace", "Henry",
        "Iris", "James", "Kim", "Leo", "Maya", "Noah", "Olive", "Pete",
        "Quinn", "Rosa", "Sam", "Tara", "Uma", "Victor", "Wendy", "Xavier"
    ];
    const i = (seed * 7) % names.length;
    const j = (seed * 11 + 5) % names.length;
    return `${names[i]} & ${names[j === i ? (j + 1) % names.length : j]}`;
}

function generateSonnetLines(seedLineA, seedLineB) {
    const lines = [
        seedLineA,
        seedLineB,
    ];
    
    const middleTemplates = [
        "And from these words a new world starts to form,",
        "Where meaning shifts like light through morning glass,",
        "The poets write in turn, line after line,",
        "Each voice a thread within the larger weave,",
        "What started as a whisper grows to song,",
        "Through collaboration, something new is born,",
        "The crown takes shape, each sonnet linked to each,",
        "In overlapping verse the pattern holds,",
        "From two lines, fourteen poems find their way,",
        "And each of those will seed another crown,",
        "The fractal blooms eternal, ever-growing,"
    ];
    
    for (let i = 0; i < 11; i++) {
        lines.push(middleTemplates[i]);
    }
    
    lines.push("These final words become another's first.");
    
    return lines;
}

function generateChildCrown(id, name, generation, x, y, parentSonnet, status = "complete") {
    const crown = {
        id,
        name,
        generation,
        status,
        x,
        y,
        seedSource: {
            type: "sonnet",
            parentSonnetId: parentSonnet.id,
            parentSonnetTitle: parentSonnet.title
        },
        parentSonnet,
        sonnets: []
    };

    const sonnetCount = status === "forming" ? Math.floor(Math.random() * 8) + 3 : 14;
    
    for (let i = 0; i < sonnetCount; i++) {
        const lineA = i;
        const lineB = (i + 1) % 14;
        
        crown.sonnets.push({
            id: `${id}-sonnet-${i + 1}`,
            position: i + 1,
            title: `Sonnet ${romanize(i + 1)}`,
            authors: getRandomAuthors(i + generation * 10),
            status: i < sonnetCount - 2 ? "complete" : (status === "forming" ? "forming" : "complete"),
            seedLines: {
                lineA: parentSonnet.lines[lineA] || `Line ${lineA + 1} from parent...`,
                lineB: parentSonnet.lines[lineB] || `Line ${lineB + 1} from parent...`,
                indices: `${lineA + 1}-${lineB + 1 === 15 ? 1 : lineB + 1}`
            },
            spawnsChild: `${id}-${i + 1}`,
            lines: generateSonnetLines(
                parentSonnet.lines[lineA] || "From the parent poem's verse...",
                parentSonnet.lines[lineB] || "These lines were born anew..."
            )
        });
    }

    return crown;
}

function generateFractalData() {
    const crowns = [];
    
    // Crown I - the origin
    const crown1 = {
        id: "crown-1",
        name: "Crown I",
        generation: 1,
        status: "complete",
        x: 0, 
        y: 0,
        seedSource: {
            type: "original",
            title: ORIGINAL_SEED.title,
            author: ORIGINAL_SEED.author
        },
        sonnets: []
    };

    // Generate 14 sonnets for Crown I
    for (let i = 0; i < 14; i++) {
        const lineA = i;
        const lineB = (i + 1) % 14;
        
        crown1.sonnets.push({
            id: `crown-1-sonnet-${i + 1}`,
            position: i + 1,
            title: `Sonnet ${romanize(i + 1)}`,
            authors: getRandomAuthors(i),
            status: "complete",
            seedLines: {
                lineA: ORIGINAL_SEED.lines[lineA],
                lineB: ORIGINAL_SEED.lines[lineB],
                indices: `${lineA + 1}-${lineB + 1 === 15 ? 1 : lineB + 1}`
            },
            spawnsChild: `crown-1-${i + 1}`,
            lines: generateSonnetLines(ORIGINAL_SEED.lines[lineA], ORIGINAL_SEED.lines[lineB])
        });
    }
    
    crowns.push(crown1);

    // Generate some Gen 2 crowns
    const gen2Positions = [
        { parentSonnet: 1, x: 400, y: -250 },
        { parentSonnet: 3, x: 450, y: 150 },
        { parentSonnet: 7, x: -400, y: -200 },
        { parentSonnet: 10, x: -350, y: 250 },
    ];

    gen2Positions.forEach((pos, idx) => {
        const parentSonnet = crown1.sonnets[pos.parentSonnet - 1];
        const childCrown = generateChildCrown(
            `crown-1-${pos.parentSonnet}`,
            `Crown I-${pos.parentSonnet}`,
            2,
            pos.x,
            pos.y,
            parentSonnet
        );
        crowns.push(childCrown);

        // Add a Gen 3 crown
        if (idx === 0 && childCrown.sonnets.length > 0) {
            const gen3Crown = generateChildCrown(
                `crown-1-${pos.parentSonnet}-1`,
                `Crown I-${pos.parentSonnet}-1`,
                3,
                pos.x + 350,
                pos.y - 150,
                childCrown.sonnets[0],
                "forming"
            );
            crowns.push(gen3Crown);
        }
    });

    return { crowns, originalSeed: ORIGINAL_SEED };
}

// ─────────────────────────────────────────────────────────────────────────
// COSMOS VISUALIZATION CLASS
// ─────────────────────────────────────────────────────────────────────────

class FractalCosmos {
    constructor(canvasId, data) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.data = data;
        
        // View state
        this.camX = 0;
        this.camY = 0;
        this.zoom = CONFIG.zoom.default;
        this.targetZoom = CONFIG.zoom.default;
        
        // Interaction state
        this.dragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.hoveredStar = null;
        this.hoveredCrown = null;
        
        // Animation
        this.time = 0;
        this.stars = [];
        
        this.init();
    }
    
    init() {
        this.resize();
        this.generateBackgroundStars();
        this.bindEvents();
        this.animate();
    }
    
    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }
    
    generateBackgroundStars() {
        this.stars = [];
        for (let i = 0; i < CONFIG.stars.count; i++) {
            this.stars.push({
                x: (Math.random() - 0.5) * CONFIG.stars.spread,
                y: (Math.random() - 0.5) * CONFIG.stars.spread,
                size: Math.random() * 1.5,
                brightness: Math.random() * 0.5 + 0.1,
                twinkleSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }
    
    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    }
    
    onMouseDown(e) {
        if (this.hoveredStar) {
            this.openPoem(this.hoveredStar.sonnet, this.hoveredStar.crown);
        } else {
            this.dragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        }
    }
    
    onMouseMove(e) {
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        if (this.dragging) {
            const dx = (e.clientX - this.lastX) / this.zoom;
            const dy = (e.clientY - this.lastY) / this.zoom;
            this.camX -= dx;
            this.camY -= dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        }
    }
    
    onMouseUp() {
        this.dragging = false;
    }
    
    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.targetZoom = Math.max(CONFIG.zoom.min, Math.min(CONFIG.zoom.max, this.targetZoom * zoomFactor));
    }
    
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.width / 2) / this.zoom + this.camX,
            y: (sy - this.height / 2) / this.zoom + this.camY
        };
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // RENDERING
    // ─────────────────────────────────────────────────────────────────────
    
    animate() {
        this.time += 0.016;
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.render();
        requestAnimationFrame(() => this.animate());
    }
    
    render() {
        const ctx = this.ctx;
        
        ctx.fillStyle = CONFIG.colors.background;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camX, -this.camY);

        this.drawBackgroundStars();
        this.drawLineageConnections();
        this.drawCrowns();

        ctx.restore();
        this.updateUI();
    }
    
    drawBackgroundStars() {
        const ctx = this.ctx;
        this.stars.forEach(star => {
            const twinkle = Math.sin(this.time * star.twinkleSpeed * 10) * 0.3 + 0.7;
            const alpha = star.brightness * twinkle;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size / this.zoom, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    drawLineageConnections() {
        const ctx = this.ctx;
        const colors = CONFIG.colors.generations;
        
        this.data.crowns.forEach(crown => {
            if (crown.parentSonnet) {
                const parentCrownId = crown.seedSource.parentSonnetId.split('-sonnet-')[0];
                const parentCrown = this.data.crowns.find(c => c.id === parentCrownId);
                
                if (parentCrown) {
                    const parentSonnetIdx = crown.parentSonnet.position - 1;
                    const pAngle = (parentSonnetIdx / 14) * Math.PI * 2 - Math.PI / 2;
                    const pRadius = CONFIG.crown.radius;
                    const px = parentCrown.x + Math.cos(pAngle) * pRadius;
                    const py = parentCrown.y + Math.sin(pAngle) * pRadius;

                    const gradient = ctx.createLinearGradient(px, py, crown.x, crown.y);
                    gradient.addColorStop(0, colors[parentCrown.generation].glow);
                    gradient.addColorStop(1, colors[crown.generation].glow);

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 1.5 / this.zoom;
                    ctx.setLineDash([4 / this.zoom, 8 / this.zoom]);
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    
                    const midX = (px + crown.x) / 2;
                    const midY = (py + crown.y) / 2 - 40;
                    ctx.quadraticCurveTo(midX, midY, crown.x, crown.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        });
    }
    
    drawCrowns() {
        const ctx = this.ctx;
        const colors = CONFIG.colors.generations;
        
        this.hoveredStar = null;
        this.hoveredCrown = null;

        const mouseWorld = this.screenToWorld(this.lastMouseX, this.lastMouseY);

        this.data.crowns.forEach(crown => {
            const crownColors = colors[crown.generation] || colors[1];
            const crownRadius = CONFIG.crown.radius;

            // Crown outer glow
            const glowGradient = ctx.createRadialGradient(crown.x, crown.y, 0, crown.x, crown.y, CONFIG.crown.glowRadius);
            glowGradient.addColorStop(0, `rgba(255, 255, 255, ${crown.status === 'forming' ? 0.02 : 0.03})`);
            glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(crown.x, crown.y, CONFIG.crown.glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Ring connecting sonnets
            ctx.strokeStyle = crownColors.ring;
            ctx.lineWidth = 1 / this.zoom;
            ctx.beginPath();
            ctx.arc(crown.x, crown.y, crownRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Check crown hover
            const distToCrown = Math.hypot(mouseWorld.x - crown.x, mouseWorld.y - crown.y);
            if (distToCrown < 100) {
                this.hoveredCrown = crown;
            }

            // Inter-sonnet connections
            if (crown.sonnets.length > 1) {
                ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
                ctx.lineWidth = 0.5 / this.zoom;
                for (let i = 0; i < crown.sonnets.length; i++) {
                    const angle1 = (i / 14) * Math.PI * 2 - Math.PI / 2;
                    const nextIdx = (i + 1) % crown.sonnets.length;
                    const angle2 = (nextIdx / 14) * Math.PI * 2 - Math.PI / 2;
                    
                    const x1 = crown.x + Math.cos(angle1) * crownRadius;
                    const y1 = crown.y + Math.sin(angle1) * crownRadius;
                    const x2 = crown.x + Math.cos(angle2) * crownRadius;
                    const y2 = crown.y + Math.sin(angle2) * crownRadius;
                    
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
            }

            // Draw sonnets as stars
            crown.sonnets.forEach((sonnet, i) => {
                const angle = (i / 14) * Math.PI * 2 - Math.PI / 2;
                const sx = crown.x + Math.cos(angle) * crownRadius;
                const sy = crown.y + Math.sin(angle) * crownRadius;

                const dist = Math.hypot(mouseWorld.x - sx, mouseWorld.y - sy);
                const isHovered = dist < 15;
                if (isHovered) {
                    this.hoveredStar = { sonnet, crown, x: sx, y: sy };
                }

                let pulse = 1;
                let alpha = 1;
                if (sonnet.status === 'forming') {
                    pulse = 0.7 + Math.sin(this.time * 2 + i) * 0.3;
                    alpha = 0.5 + Math.sin(this.time * 2 + i) * 0.2;
                }

                // Star glow
                const starGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
                starGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * alpha * (isHovered ? 1.5 : 1)})`);
                starGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = starGlow;
                ctx.beginPath();
                ctx.arc(sx, sy, 18 * pulse, 0, Math.PI * 2);
                ctx.fill();

                // Star core
                const coreSize = (isHovered ? 5 : 3.5) * pulse;
                ctx.fillStyle = crownColors.main;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(sx, sy, coreSize / this.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Spawn indicator
                if (sonnet.status === 'complete') {
                    ctx.strokeStyle = 'rgba(201, 162, 39, 0.3)';
                    ctx.lineWidth = 1 / this.zoom;
                    ctx.beginPath();
                    ctx.arc(sx, sy, (coreSize + 4) / this.zoom, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });

            // Crown label
            if (this.zoom > 0.4) {
                ctx.fillStyle = `rgba(255, 255, 255, ${crown.status === 'forming' ? 0.2 : 0.3})`;
                ctx.font = `${11 / this.zoom}px 'Cormorant Garamond', serif`;
                ctx.textAlign = 'center';
                ctx.fillText(crown.name, crown.x, crown.y + 100);
                
                ctx.fillStyle = `rgba(255, 255, 255, 0.15)`;
                ctx.font = `${9 / this.zoom}px 'Cormorant Garamond', serif`;
                ctx.fillText(`${crown.sonnets.length}/14 sonnets`, crown.x, crown.y + 112);
            }
        });
    }
    
    updateUI() {
        // Override this method to connect to your UI elements
        this.canvas.style.cursor = this.hoveredStar ? 'pointer' : 'crosshair';
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // NAVIGATION
    // ─────────────────────────────────────────────────────────────────────
    
    navigateToCrown(crownId) {
        const crown = this.data.crowns.find(c => c.id === crownId);
        if (crown) {
            this.camX = crown.x;
            this.camY = crown.y;
            this.targetZoom = 1.2;
        }
    }
    
    openPoem(sonnet, crown) {
        // Override this to show your poem reading UI
        console.log('Open poem:', sonnet.title, 'from', crown.name);
        console.log('Seed lines:', sonnet.seedLines);
        console.log('Lines:', sonnet.lines);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// USAGE
// ─────────────────────────────────────────────────────────────────────────
//
// 1. Include this script
// 2. Generate or fetch your data:
//    const data = generateFractalData();  // or fetch from API
// 3. Create the cosmos:
//    const cosmos = new FractalCosmos('canvas-id', data);
// 4. Override methods for your UI:
//    cosmos.openPoem = (sonnet, crown) => { /* show your modal */ };
//    cosmos.updateUI = () => { /* update your status bar */ };
//
// ─────────────────────────────────────────────────────────────────────────

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FractalCosmos, generateFractalData, CONFIG };
}
