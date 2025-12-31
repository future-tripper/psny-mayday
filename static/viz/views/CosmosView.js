/**
 * CosmosView - Fractal poetry cosmos canvas visualization
 * Renders crowns as rings of sonnets with star-field background
 */

const CONFIG = {
    colors: {
        background: '#0a0a0f',
        generations: {
            1: { main: '#d4a574', glow: 'rgba(212, 165, 116, 0.3)', ring: 'rgba(212, 165, 116, 0.15)' },
            2: { main: '#7eb8da', glow: 'rgba(126, 184, 218, 0.3)', ring: 'rgba(126, 184, 218, 0.15)' },
            3: { main: '#8fbc8f', glow: 'rgba(143, 188, 143, 0.3)', ring: 'rgba(143, 188, 143, 0.15)' },
            4: { main: '#dda0dd', glow: 'rgba(221, 160, 221, 0.3)', ring: 'rgba(221, 160, 221, 0.15)' }
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

export default class CosmosView {
    constructor({ container, state, dataService, crownId }) {
        this.container = container;
        this.state = state;
        this.dataService = dataService;
        this.crownId = crownId;

        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;

        this.poetryData = null;
        this.stars = [];
        this.time = 0;

        this.camX = 0;
        this.camY = 0;
        this.zoom = 1;
        this.targetZoom = 1;

        this.dragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.hoveredStar = null;
        this.hoveredCrown = null;

        this.animationId = null;
        this.active = false;

        this.boundResize = this.resize.bind(this);
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = () => this.dragging = false;
        this.boundWheel = this.onWheel.bind(this);
        this.boundTouchStart = this.onTouchStart.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);
    }

    async initialize() {
        this.setupDOM();
        this.generateBackgroundStars();
        this.bindEvents();
        await this.loadData();
    }

    setupDOM() {
        this.canvas = this.container.querySelector('#cosmos-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'cosmos-canvas';
            this.container.insertBefore(this.canvas, this.container.firstChild);
        }
        this.ctx = this.canvas.getContext('2d');

        this.overlay = this.container.querySelector('.cosmos-reading-overlay');
        this.loadingEl = this.container.querySelector('.cosmos-loading');
        this.emptyEl = this.container.querySelector('.cosmos-empty');
        this.legendEl = this.container.querySelector('.cosmos-legend');
        this.hintEl = this.container.querySelector('.cosmos-hint');
        this.crownInfoEl = this.container.querySelector('.cosmos-crown-info');
    }

    async loadData() {
        try {
            const response = await fetch('/api/fractal/tree');
            this.poetryData = await response.json();

            if (this.loadingEl) {
                this.loadingEl.classList.add('hidden');
            }

            if (!this.poetryData.crowns || this.poetryData.crowns.length === 0) {
                if (this.emptyEl) this.emptyEl.style.display = 'block';
                if (this.legendEl) this.legendEl.style.display = 'none';
                if (this.hintEl) this.hintEl.style.display = 'none';
            } else {
                this.generateLegend();
            }
        } catch (error) {
            console.error('[CosmosView] Failed to load data:', error);
            if (this.loadingEl) {
                this.loadingEl.innerHTML = '<div class="cosmos-loading-text">Failed to load cosmos</div>';
            }
        }
    }

    generateLegend() {
        if (!this.legendEl || !this.poetryData.crowns) return;

        // Get unique generations from the data
        const generations = [...new Set(this.poetryData.crowns.map(c => c.generation))].sort((a, b) => a - b);

        // Generation labels
        const genLabels = {
            1: 'Origin Crown',
            2: 'Generation II',
            3: 'Generation III',
            4: 'Generation IV',
            5: 'Generation V'
        };

        // Build legend HTML
        let html = '';
        generations.forEach(gen => {
            const colors = CONFIG.colors.generations[gen] || CONFIG.colors.generations[1];
            const label = genLabels[gen] || `Generation ${gen}`;
            html += `
                <div class="cosmos-legend-item">
                    <span>${label}</span>
                    <div class="cosmos-legend-dot" style="background: ${colors.main};"></div>
                </div>
            `;
        });

        this.legendEl.innerHTML = html;
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        this.width = this.canvas.width = rect.width;
        this.height = this.canvas.height = rect.height;
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
        window.addEventListener('resize', this.boundResize);
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseup', this.boundMouseUp);
        this.canvas.addEventListener('mouseleave', this.boundMouseUp);
        this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundMouseUp);
        document.addEventListener('keydown', this.boundKeyDown);

        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.closePoem();
            });
        }
    }

    unbindEvents() {
        window.removeEventListener('resize', this.boundResize);
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('mouseup', this.boundMouseUp);
        this.canvas.removeEventListener('mouseleave', this.boundMouseUp);
        this.canvas.removeEventListener('wheel', this.boundWheel);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchend', this.boundMouseUp);
        document.removeEventListener('keydown', this.boundKeyDown);
    }

    onMouseDown(e) {
        // Check hover state at click time to ensure accurate detection
        const mouseWorld = this.screenToWorld(e.clientX, e.clientY);
        this.checkHover(mouseWorld);

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
        } else {
            // Only check hover when mouse moves (not every frame)
            const mouseWorld = this.screenToWorld(e.clientX, e.clientY);
            this.checkHover(mouseWorld);
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.targetZoom = Math.max(CONFIG.zoom.min, Math.min(CONFIG.zoom.max, this.targetZoom * zoomFactor));
    }

    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.lastMouseX = touch.clientX;
            this.lastMouseY = touch.clientY;

            const mouseWorld = this.screenToWorld(this.lastMouseX, this.lastMouseY);
            this.checkHover(mouseWorld);

            if (this.hoveredStar) {
                this.openPoem(this.hoveredStar.sonnet, this.hoveredStar.crown);
            } else {
                this.dragging = true;
                this.lastX = touch.clientX;
                this.lastY = touch.clientY;
            }
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.dragging) {
            const touch = e.touches[0];
            const dx = (touch.clientX - this.lastX) / this.zoom;
            const dy = (touch.clientY - this.lastY) / this.zoom;
            this.camX -= dx;
            this.camY -= dy;
            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
        }
    }

    onKeyDown(e) {
        if (e.key === 'Escape') this.closePoem();
    }

    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = sx - rect.left;
        const canvasY = sy - rect.top;
        return {
            x: (canvasX - this.width / 2) / this.zoom + this.camX,
            y: (canvasY - this.height / 2) / this.zoom + this.camY
        };
    }

    setActive(active) {
        this.active = active;
        if (active) {
            this.resize();
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    startAnimation() {
        if (this.animationId) return;
        const animate = () => {
            this.time += 0.016;
            this.zoom += (this.targetZoom - this.zoom) * 0.1;
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    render() {
        if (!this.ctx || !this.width) return;

        this.ctx.fillStyle = CONFIG.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.camX, -this.camY);

        this.drawBackgroundStars();

        if (this.poetryData && this.poetryData.crowns) {
            this.drawLineageConnections();
            this.drawCrowns();
        }

        this.ctx.restore();
        this.updateUI();
    }

    drawBackgroundStars() {
        this.stars.forEach(star => {
            const twinkle = Math.sin(this.time * star.twinkleSpeed * 10) * 0.3 + 0.7;
            const alpha = star.brightness * twinkle;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size / this.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawLineageConnections() {
        const colors = CONFIG.colors.generations;

        this.poetryData.crowns.forEach(crown => {
            if (crown.parentSonnet) {
                const parentCrownId = crown.seedSource.parentSonnetId?.split('-sonnet-')[0];
                const parentCrown = this.poetryData.crowns.find(c => c.id === parentCrownId);

                if (parentCrown) {
                    const parentSonnetIdx = crown.parentSonnet.position - 1;
                    const pAngle = (parentSonnetIdx / 14) * Math.PI * 2 - Math.PI / 2;
                    const pRadius = CONFIG.crown.radius;
                    const px = parentCrown.x + Math.cos(pAngle) * pRadius;
                    const py = parentCrown.y + Math.sin(pAngle) * pRadius;

                    const gradient = this.ctx.createLinearGradient(px, py, crown.x, crown.y);
                    gradient.addColorStop(0, (colors[parentCrown.generation] || colors[1]).glow);
                    gradient.addColorStop(1, (colors[crown.generation] || colors[1]).glow);

                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = 1.5 / this.zoom;
                    this.ctx.setLineDash([4 / this.zoom, 8 / this.zoom]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py);

                    const midX = (px + crown.x) / 2;
                    const midY = (py + crown.y) / 2 - 40;
                    this.ctx.quadraticCurveTo(midX, midY, crown.x, crown.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            }
        });
    }

    checkHover(mouseWorld) {
        this.hoveredStar = null;
        this.hoveredCrown = null;

        if (!this.poetryData || !this.poetryData.crowns) return;

        this.poetryData.crowns.forEach(crown => {
            const distToCrown = Math.hypot(mouseWorld.x - crown.x, mouseWorld.y - crown.y);
            if (distToCrown < 100) {
                this.hoveredCrown = crown;
            }

            crown.sonnets.forEach((sonnet, i) => {
                const angle = (i / 14) * Math.PI * 2 - Math.PI / 2;
                const sx = crown.x + Math.cos(angle) * CONFIG.crown.radius;
                const sy = crown.y + Math.sin(angle) * CONFIG.crown.radius;

                // Larger hit radius for easier clicking
                const hitRadius = 20;
                const dist = Math.hypot(mouseWorld.x - sx, mouseWorld.y - sy);
                if (dist < hitRadius) {
                    this.hoveredStar = { sonnet, crown, x: sx, y: sy };
                }
            });
        });
    }

    drawCrowns() {
        const colors = CONFIG.colors.generations;

        this.poetryData.crowns.forEach(crown => {
            const crownColors = colors[crown.generation] || colors[1];
            const crownRadius = CONFIG.crown.radius;

            // Crown outer glow
            const glowGradient = this.ctx.createRadialGradient(crown.x, crown.y, 0, crown.x, crown.y, CONFIG.crown.glowRadius);
            glowGradient.addColorStop(0, `rgba(255, 255, 255, ${crown.status === 'forming' ? 0.02 : 0.03})`);
            glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(crown.x, crown.y, CONFIG.crown.glowRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Ring
            this.ctx.strokeStyle = crownColors.ring;
            this.ctx.lineWidth = 1 / this.zoom;
            this.ctx.beginPath();
            this.ctx.arc(crown.x, crown.y, crownRadius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inter-sonnet connections
            if (crown.sonnets.length > 1) {
                this.ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
                this.ctx.lineWidth = 0.5 / this.zoom;
                for (let i = 0; i < crown.sonnets.length; i++) {
                    const angle1 = (crown.sonnets[i].position - 1) / 14 * Math.PI * 2 - Math.PI / 2;
                    const nextIdx = (i + 1) % crown.sonnets.length;
                    const angle2 = (crown.sonnets[nextIdx].position - 1) / 14 * Math.PI * 2 - Math.PI / 2;

                    const x1 = crown.x + Math.cos(angle1) * crownRadius;
                    const y1 = crown.y + Math.sin(angle1) * crownRadius;
                    const x2 = crown.x + Math.cos(angle2) * crownRadius;
                    const y2 = crown.y + Math.sin(angle2) * crownRadius;

                    this.ctx.beginPath();
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                    this.ctx.stroke();
                }
            }

            // Draw sonnets as stars
            crown.sonnets.forEach((sonnet) => {
                const i = sonnet.position - 1;
                const angle = (i / 14) * Math.PI * 2 - Math.PI / 2;
                const sx = crown.x + Math.cos(angle) * crownRadius;
                const sy = crown.y + Math.sin(angle) * crownRadius;

                const isHovered = this.hoveredStar?.sonnet.id === sonnet.id;

                let pulse = 1;
                let alpha = 1;
                if (sonnet.status === 'forming') {
                    // Slow, gentle pulse (0.5 = ~8 second cycle)
                    pulse = 0.85 + Math.sin(this.time * 0.5 + i) * 0.15;
                    alpha = 0.7 + Math.sin(this.time * 0.5 + i) * 0.15;
                }

                // Star glow
                const starGlow = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
                starGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * alpha * (isHovered ? 1.5 : 1)})`);
                starGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                this.ctx.fillStyle = starGlow;
                this.ctx.beginPath();
                this.ctx.arc(sx, sy, 18 * pulse, 0, Math.PI * 2);
                this.ctx.fill();

                // Star core
                const coreSize = (isHovered ? 5 : 3.5) * pulse;
                this.ctx.fillStyle = crownColors.main;
                this.ctx.globalAlpha = alpha;
                this.ctx.beginPath();
                this.ctx.arc(sx, sy, coreSize / this.zoom, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1;

                // Spawn indicator
                if (sonnet.status === 'complete' && sonnet.spawnsChild) {
                    this.ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
                    this.ctx.lineWidth = 1.5 / this.zoom;
                    this.ctx.beginPath();
                    this.ctx.arc(sx, sy, (coreSize + 4) / this.zoom, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            });

            // Crown label - subtle text below the ring
            const fontSize = Math.max(8, 8 / this.zoom);

            this.ctx.fillStyle = `rgba(255, 255, 255, ${crown.status === 'forming' ? 0.4 : 0.5})`;
            this.ctx.font = `300 ${fontSize}px 'Josefin Sans', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(crown.name, crown.x, crown.y + 95 / this.zoom);
        });
    }

    updateUI() {
        if (this.crownInfoEl) {
            if (this.hoveredCrown) {
                this.crownInfoEl.classList.add('visible');
                const nameEl = this.crownInfoEl.querySelector('.cosmos-crown-name');
                const descEl = this.crownInfoEl.querySelector('.cosmos-crown-desc');
                if (nameEl) nameEl.textContent = this.hoveredCrown.name;
                if (descEl) {
                    const status = this.hoveredCrown.status === 'forming' ? ' - Growing' : ' - Complete';
                    descEl.textContent = `${this.hoveredCrown.sonnets.length}/14 sonnets${status}`;
                }
            } else {
                this.crownInfoEl.classList.remove('visible');
            }
        }

        if (this.canvas) {
            this.canvas.style.cursor = this.hoveredStar ? 'pointer' : 'crosshair';
        }
    }

    openPoem(sonnet, crown) {
        if (!this.overlay) return;

        const numberEl = this.overlay.querySelector('.cosmos-poem-number');
        const titleEl = this.overlay.querySelector('.cosmos-poem-title');
        const authorsEl = this.overlay.querySelector('.cosmos-poem-authors');
        const seedLinesEl = this.overlay.querySelector('.cosmos-seed-lines-content');
        const linesEl = this.overlay.querySelector('.cosmos-poem-lines');
        const lineageEl = this.overlay.querySelector('.cosmos-lineage-info');

        if (numberEl) numberEl.textContent = `Sonnet ${sonnet.position} of ${crown.name}`;
        if (titleEl) titleEl.textContent = sonnet.title;
        if (authorsEl) authorsEl.textContent = sonnet.authors;

        if (seedLinesEl) {
            seedLinesEl.innerHTML = `
                <div>"${sonnet.seedLines.lineA}"</div>
                <div>"${sonnet.seedLines.lineB}"</div>
                <div style="margin-top: 8px; font-size: 10px; color: rgba(201, 162, 39, 0.5); font-style: normal;">
                    Lines ${sonnet.seedLines.indices} from ${crown.seedSource.type === 'original' ? 'the original seed poem' : 'the parent sonnet'}
                </div>
            `;
        }

        if (linesEl) {
            linesEl.innerHTML = '';
            sonnet.lines.forEach((line, i) => {
                const lineEl = document.createElement('div');
                lineEl.className = 'cosmos-poem-line';
                lineEl.style.animationDelay = `${0.3 + i * 0.08}s`;
                lineEl.textContent = line;

                if (i === 0 || i === 1) {
                    lineEl.classList.add('seed-line');
                }

                if (i === 13 && sonnet.spawnsChild) {
                    lineEl.classList.add('spawn-line');
                    const note = document.createElement('span');
                    note.className = 'cosmos-line-note';
                    note.textContent = ' Seeds a new crown';
                    lineEl.appendChild(note);
                }

                linesEl.appendChild(lineEl);
            });
        }

        if (lineageEl) {
            let html = '';
            html += `<div><strong>Parent:</strong> ${crown.seedSource.type === 'original'
                ? `${this.poetryData.originalSeed?.title || 'Original Seed'} by ${this.poetryData.originalSeed?.author || 'Unknown'}`
                : crown.seedSource.parentSonnetTitle || 'Parent Sonnet'}</div>`;

            if (sonnet.sonnetId) {
                html += `<div style="margin-top: 8px;">`;
                html += `<a href="/sonnet/${sonnet.sonnetId}" class="cosmos-lineage-link" target="_blank">View full sonnet page</a>`;
                html += `</div>`;
            }

            lineageEl.innerHTML = html;
        }

        this.overlay.classList.add('visible');
        if (this.hintEl) this.hintEl.style.opacity = '0';
    }

    closePoem() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
        }
        if (this.hintEl) {
            setTimeout(() => {
                this.hintEl.style.opacity = '0.3';
            }, 600);
        }
    }

    navigateToCrown(crownId) {
        const crown = this.poetryData?.crowns.find(c => c.id === crownId);
        if (crown) {
            this.closePoem();
            setTimeout(() => {
                this.camX = crown.x;
                this.camY = crown.y;
                this.targetZoom = 1.2;
            }, 300);
        }
    }

    destroy() {
        this.stopAnimation();
        this.unbindEvents();
    }
}
