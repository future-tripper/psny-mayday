/**
 * GalaxyGraphView - 2D genealogy tree showing all Crowns and their relationships
 * Simple, clear, clickable family tree visualization
 */

export default class GalaxyGraphView {
    constructor({ container, canvas, state, crownId, dataService }) {
        this.container = container;
        this.canvas = canvas;
        this.state = state;
        this.crownId = crownId;
        this.dataService = dataService;

        this.ctx = null;
        this.nodes = []; // Crown nodes to render
        this.edges = []; // Parent-child connections
        this.hoveredNode = null;
        this.clickedNode = null;

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.isActive = false;
    }

    async initialize() {
        console.log('[GalaxyGraphView] Initializing...');
        if (!this.canvas) {
            console.error('[GalaxyGraphView] No canvas element found!');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        console.log('[GalaxyGraphView] Canvas context created');

        this.resize();

        // Load genealogy data starting from Crown 1
        await this.loadGenealogyTree();
        console.log('[GalaxyGraphView] Tree loaded, nodes:', this.nodes.length);

        this.setupEvents();

        // Render immediately if this is the active view
        if (this.state.get('currentView') === 'graph') {
            console.log('[GalaxyGraphView] Graph is active view, rendering now');
            this.isActive = true;
            this.render();
        } else {
            console.log('[GalaxyGraphView] Graph not active, current view:', this.state.get('currentView'));
        }
    }

    async loadGenealogyTree() {
        // For now, build tree from known test data structure
        // In production, would recursively fetch all Crowns
        const crowns = [
            { id: 1, generation: 1, label: 'Crown 1', sublabel: '14/14 ✓', status: 'complete', parentId: null },
            { id: 2, generation: 2, label: 'Crown 2', sublabel: '14/14 ✓', status: 'complete', parentId: 1 },
            { id: 3, generation: 2, label: 'Crown 3', sublabel: '7/14 ⧗', status: 'forming', parentId: 1 },
            { id: 4, generation: 2, label: 'Crown 4', sublabel: '2/14 ⧗', status: 'forming', parentId: 1 }
        ];

        // Calculate tree layout
        this.layoutTree(crowns);
    }

    layoutTree(crowns) {
        // Simple top-down tree layout
        const { clientWidth, clientHeight } = this.container;
        const nodeRadius = 60;
        const levelHeight = 180;
        const horizontalSpacing = 200;

        // Group by generation
        const generations = {};
        crowns.forEach(crown => {
            if (!generations[crown.generation]) {
                generations[crown.generation] = [];
            }
            generations[crown.generation].push(crown);
        });

        // Position nodes
        this.nodes = [];
        Object.keys(generations).sort((a, b) => Number(a) - Number(b)).forEach((gen, genIndex) => {
            const crownsInGen = generations[gen];
            const totalWidth = (crownsInGen.length - 1) * horizontalSpacing;
            const startX = (clientWidth - totalWidth) / 2;
            const y = 100 + genIndex * levelHeight;

            crownsInGen.forEach((crown, index) => {
                this.nodes.push({
                    ...crown,
                    x: startX + index * horizontalSpacing,
                    y: y,
                    radius: nodeRadius
                });
            });
        });

        // Create edges
        this.edges = [];
        this.nodes.forEach(node => {
            if (node.parentId) {
                const parent = this.nodes.find(n => n.id === node.parentId);
                if (parent) {
                    this.edges.push({ from: parent, to: node });
                }
            }
        });
    }

    resize() {
        if (!this.canvas || !this.container) return;
        const { clientWidth, clientHeight } = this.container;
        this.canvas.width = clientWidth * window.devicePixelRatio;
        this.canvas.height = clientHeight * window.devicePixelRatio;
        this.canvas.style.width = `${clientWidth}px`;
        this.canvas.style.height = `${clientHeight}px`;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    setupEvents() {
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
    }

    onMouseMove(event) {
        if (!this.isActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if hovering over a node
        let foundHover = false;
        for (const node of this.nodes) {
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist < node.radius) {
                this.hoveredNode = node;
                this.canvas.style.cursor = 'pointer';
                foundHover = true;
                break;
            }
        }

        if (!foundHover) {
            this.hoveredNode = null;
            this.canvas.style.cursor = 'default';
        }

        this.render();
    }

    onClick(event) {
        if (!this.isActive) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if clicking a node
        for (const node of this.nodes) {
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist < node.radius) {
                console.log('[GalaxyGraphView] Crown clicked:', node.id);
                this.state.set('selectedCrownId', node.id);
                // Trigger navigation to Jewels view
                this.state.set('currentView', 'orbit');
                return;
            }
        }
    }

    setActive(active) {
        this.isActive = active;
        if (active) {
            this.render();
        }
    }

    render() {
        if (!this.ctx || !this.isActive) {
            console.log('[GalaxyGraphView] Render skipped - ctx:', !!this.ctx, 'isActive:', this.isActive);
            return;
        }

        console.log('[GalaxyGraphView] Rendering graph with', this.nodes.length, 'nodes');

        const { clientWidth, clientHeight } = this.container;

        // Clear canvas
        this.ctx.clearRect(0, 0, clientWidth, clientHeight);

        // Draw edges first (behind nodes)
        this.ctx.strokeStyle = '#d0d0d0';
        this.ctx.lineWidth = 3;
        this.edges.forEach(edge => {
            this.ctx.beginPath();
            this.ctx.moveTo(edge.from.x, edge.from.y + edge.from.radius);
            this.ctx.lineTo(edge.to.x, edge.to.y - edge.to.radius);
            this.ctx.stroke();
        });

        // Draw nodes
        this.nodes.forEach(node => {
            const isHovered = this.hoveredNode === node;
            const isCurrent = node.id === this.crownId;

            // Node circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            // Color based on status
            if (node.status === 'complete') {
                this.ctx.fillStyle = isCurrent ? '#4CAF50' : '#81C784';
            } else {
                this.ctx.fillStyle = '#FFB74D';
            }

            this.ctx.fill();

            // Border
            this.ctx.strokeStyle = isCurrent ? '#2E7D32' : (isHovered ? '#1976D2' : '#666');
            this.ctx.lineWidth = isCurrent ? 4 : (isHovered ? 3 : 2);
            this.ctx.stroke();

            // Label (Crown name)
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 20px "Josefin Sans"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.label, node.x, node.y - 10);

            // Sublabel (completion status)
            this.ctx.font = '16px "Josefin Sans"';
            this.ctx.fillText(node.sublabel, node.x, node.y + 15);

            // Generation label
            this.ctx.font = '14px "Josefin Sans"';
            this.ctx.fillStyle = '#666';
            this.ctx.fillText(`Gen ${node.generation}`, node.x, node.y + 35);
        });
    }
}
