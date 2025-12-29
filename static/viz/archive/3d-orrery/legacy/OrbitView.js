/**
 * Crown Visualization with Sigma.js WebGL (legacy orbit view)
 * Multi-level exploration: Seed Sonnet → Crown Circle → Individual Focus
 */

export default class OrbitView {
    constructor({ crownId = 1, dataService, state, config } = {}) {
        if (!dataService) {
            throw new Error('OrbitView requires a dataService instance');
        }

        this.crownId = crownId;
        this.dataService = dataService;
        this.state = state || null;

        this.graph = null;
        this.sigma = null;
        this.data = null;
        this.currentView = 'crown';
        this.selectedNode = null;
        this.isInitialized = false;
        this.graphologyLib = null;
        this.sigmaLib = null;

        // Animation performance tracking
        this.animationFrame = null;
        this.breathingIntervals = new Map();
        this.connectionIntervals = new Map();
        this.animationActive = true;

        // Configuration
        this.config = {
            nodeSize: 18,
            edgeSize: 2,
            circleRadius: 200,
            animationDuration: 800,
            colors: {
                primary: '#F8B098',
                secondary: '#2b2b2b',
                accent: '#FFFBE2',
                gradient: [
                    '#e8f2ff', '#c8e0ff', '#a8cfff', '#88beff',
                    '#68adff', '#489cff', '#288bff', '#087aff',
                    '#0869e8', '#0858d1', '#0847ba', '#0836a3'
                ]
            }
        };

        if (config) {
            this.config = {
                ...this.config,
                ...config,
                colors: {
                    ...this.config.colors,
                    ...(config.colors || {})
                }
            };
        }
    }

    async initialize() {
        try {
            console.log('Starting Crown visualization initialization...');
            await this.loadData();
            console.log('Data loaded successfully');
            this.createGraph();
            console.log('Graph created successfully');
            this.setupSigma();
            console.log('Sigma setup complete');
            this.setupEventListeners();
            console.log('Event listeners setup complete');
            this.updateInfoPanel();
            console.log('Info panel updated');
            this.hideLoading();
            this.isInitialized = true;
            console.log('Crown visualization initialized successfully');

            // **START UNIFIED ANIMATION SYSTEM**
            setTimeout(() => {
                this.startUnifiedAnimations();
                console.log('Unified animation system activated - Crown is now fully alive');
            }, 1000); // Delay to let initial setup settle
        } catch (error) {
            console.error('Failed to initialize visualization:', error);
            this.showError(`Failed to load Crown data: ${error.message}`);
        }
    }

    async loadData() {
        this.data = await this.dataService.getCrownNodes(this.crownId);
        this.stats = await this.dataService.getCrownStats(this.crownId);
        console.log('Loaded Crown data:', this.data, this.stats);
    }

    getGraphologyLib() {
        if (this.graphologyLib) {
            return this.graphologyLib;
        }

        const globalLib = (typeof window !== 'undefined' ? window.graphology : undefined)
            || (typeof globalThis !== 'undefined' ? globalThis.graphology : undefined);

        if (!globalLib) {
            throw new Error('Graphology library not loaded');
        }

        this.graphologyLib = globalLib;
        return this.graphologyLib;
    }

    getSigmaLib() {
        if (this.sigmaLib) {
            return this.sigmaLib;
        }

        const globalSigma = (typeof window !== 'undefined' ? window.Sigma : undefined)
            || (typeof globalThis !== 'undefined' ? globalThis.Sigma : undefined);

        if (!globalSigma) {
            throw new Error('Sigma library not loaded');
        }

        this.sigmaLib = globalSigma;
        return this.sigmaLib;
    }

    createGraph() {
        const { Graph } = this.getGraphologyLib();
        this.graph = new Graph({ type: 'directed' });

        // Add nodes in circle formation
        this.data.nodes.forEach(nodeData => {
            const position = this.calculateCirclePosition(nodeData.position, this.data.total_nodes);

            this.graph.addNode(nodeData.id, {
                ...nodeData,
                x: position.x,
                y: position.y,
                size: this.config.nodeSize,
                color: this.getNodeColor(nodeData.completion_order),
                originalSize: this.config.nodeSize,
                label: `${nodeData.position}`, // Show position number
                hidden: false,
                // **ATMOSPHERIC PROPERTIES**
                breathingRate: this.getBreathingRate(nodeData.completion_order),
                atmosphere: this.getNodeAtmosphere(nodeData.completion_order)
            });
        });

        // Add edges with shared poetry text
        this.data.connections.forEach(connection => {
            if (this.graph.hasNode(connection.from) && this.graph.hasNode(connection.to)) {
                this.graph.addEdge(connection.from, connection.to, {
                    color: this.config.colors.primary,
                    size: this.config.edgeSize,
                    type: 'line',
                    shared_line: connection.shared_line,
                    label: this.formatSharedLine(connection.shared_line),
                    labelOpacity: 0.7,
                    labelPulse: 0,
                    labelSize: 11,
                    hidden: false
                });
            }
        });

        console.log(`Created graph: ${this.graph.order} nodes, ${this.graph.size} edges`);
    }

    calculateCirclePosition(position, totalNodes) {
        const angle = (2 * Math.PI * (position - 1)) / totalNodes;
        // Start at top and go clockwise
        const adjustedAngle = angle - Math.PI / 2;

        return {
            x: this.config.circleRadius * Math.cos(adjustedAngle),
            y: this.config.circleRadius * Math.sin(adjustedAngle)
        };
    }

    getNodeColor(completionOrder) {
        // Color gradient based on completion order (1-14)
        const index = Math.min(completionOrder - 1, this.config.colors.gradient.length - 1);
        return this.config.colors.gradient[index] || this.config.colors.primary;
    }

    setupSigma() {
        const container = document.getElementById('sigma-container');

        // Use Sigma.js v2.x API
        const SigmaLib = this.getSigmaLib();

        this.sigma = new SigmaLib(this.graph, container, {
            renderer: {
                type: 'webgl'
            },
            settings: {
                renderLabels: true,
                renderEdgeLabels: true,
                defaultNodeType: 'circle',
                defaultEdgeType: 'line',
                labelFont: 'Josefin Sans, sans-serif',
                labelSize: 14,
                labelWeight: '500',
                labelColor: { color: this.config.colors.secondary },
                edgeLabelFont: 'EB Garamond, serif',
                edgeLabelSize: 11,
                edgeLabelWeight: '400',
                edgeLabelColor: { color: this.config.colors.primary },
                enableEdgeClickEvents: true,
                enableEdgeHoverEvents: true
            }
        });

        // Set initial camera position to show full Crown
        this.setCrownView();

        console.log('Sigma.js initialized with WebGL renderer');
    }

    setupEventListeners() {
        // Node hover events
        this.sigma.on('enterNode', ({ node }) => {
            this.handleNodeHover(node, true);
        });

        this.sigma.on('leaveNode', ({ node }) => {
            this.handleNodeHover(node, false);
        });

        // Node click events
        this.sigma.on('clickNode', ({ node }) => {
            this.handleNodeClick(node);
        });

        // View control buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Panel close button
        const closeBtn = document.querySelector('.close-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideNodeInfo();
            });
        }

        // Window resize
        window.addEventListener('resize', () => {
            if (this.sigma) {
                this.sigma.getCamera().resize();
            }
        });

        // **PERFORMANCE**: Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // **PERFORMANCE**: Pause animations when page becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimations();
                console.log('Page hidden - animations paused');
            } else {
                this.resumeAnimations();
                console.log('Page visible - animations resumed');
            }
        });
    }

    handleNodeHover(nodeId, isEntering) {
        const node = this.graph.getNodeAttributes(nodeId);

        if (isEntering) {
            // Highlight node
            this.graph.setNodeAttribute(nodeId, 'size', node.originalSize * 1.3);
            this.sigma.refresh();

            // Update cursor
            document.getElementById('sigma-container').style.cursor = 'pointer';
        } else {
            // Reset node
            this.graph.setNodeAttribute(nodeId, 'size', node.originalSize);
            this.sigma.refresh();

            // Reset cursor
            document.getElementById('sigma-container').style.cursor = 'default';
        }
    }

    handleNodeClick(nodeId) {
        this.selectedNode = nodeId;
        const nodeData = this.graph.getNodeAttributes(nodeId);
        this.selectedNodeData = nodeData;

        if (typeof this.onNodeSelected === 'function') {
            this.onNodeSelected(nodeId, nodeData);
        }

        if (this.currentView === 'crown') {
            // Switch to individual focus mode
            this.switchView('individual');
        }

        this.showNodeInfo(nodeData);
        console.log('Selected node:', nodeId, nodeData);
    }

    switchView(viewType) {
        if (!this.isInitialized) return;

        // **PERFORMANCE**: Pause animations during view transitions
        this.pauseAnimations();

        this.currentView = viewType;

        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });

        switch (viewType) {
            case 'crown':
                this.setCrownView();
                this.hideNodeInfo();
                break;
            case 'seed':
                this.setSeedView();
                this.showSeedInfo();
                break;
            case 'individual':
                this.setIndividualView();
                if (this.selectedNode) {
                    this.showNodeInfo(this.graph.getNodeAttributes(this.selectedNode));
                }
                break;
        }

        // **PERFORMANCE**: Resume animations after transition completes
        setTimeout(() => {
            this.resumeAnimations();
        }, this.config.animationDuration + 100);

        console.log('Switched to view:', viewType);
    }

    setCrownView() {
        const camera = this.sigma.getCamera();
        camera.animate({
            x: 0,
            y: 0,
            ratio: 1.2
        }, {
            duration: this.config.animationDuration
        });

        // Show all nodes and edges
        this.graph.forEachNode(node => {
            this.graph.setNodeAttribute(node, 'hidden', false);
        });
        this.graph.forEachEdge(edge => {
            this.graph.setEdgeAttribute(edge, 'hidden', false);
        });

        this.sigma.refresh();
    }

    setSeedView() {
        const camera = this.sigma.getCamera();

        // Zoom into center to show seed sonnet
        camera.animate({
            x: 0,
            y: 0,
            ratio: 0.3
        }, {
            duration: this.config.animationDuration
        });

        // Hide edges temporarily to focus on seed
        this.graph.forEachEdge(edge => {
            this.graph.setEdgeAttribute(edge, 'hidden', true);
        });

        // Dim Crown nodes but keep them visible
        this.graph.forEachNode(node => {
            this.graph.setNodeAttribute(node, 'size', this.config.nodeSize * 0.6);
            this.graph.setNodeAttribute(node, 'color', this.lightenColor(
                this.graph.getNodeAttribute(node, 'color'), 0.5
            ));
            this.graph.setNodeAttribute(node, 'hidden', false);
        });

        this.sigma.refresh();
    }

    setIndividualView() {
        if (!this.selectedNode) {
            // If no node selected, pick the first one
            this.selectedNode = this.graph.nodes()[0];
        }

        const nodeAttrs = this.graph.getNodeAttributes(this.selectedNode);
        const camera = this.sigma.getCamera();

        // Focus on selected node
        camera.animate({
            x: nodeAttrs.x,
            y: nodeAttrs.y,
            ratio: 0.4
        }, {
            duration: this.config.animationDuration
        });

        // Dim other nodes
        this.graph.forEachNode(node => {
            if (node === this.selectedNode) {
                this.graph.setNodeAttribute(node, 'size', nodeAttrs.originalSize * 1.5);
                this.graph.setNodeAttribute(node, 'hidden', false);
            } else {
                this.graph.setNodeAttribute(node, 'size', nodeAttrs.originalSize * 0.7);
                this.graph.setNodeAttribute(node, 'hidden', false);
            }
        });

        this.sigma.refresh();
    }

    async showNodeInfo(nodeData) {
        const nodeInfo = document.querySelector('.node-info');
        const crownInfo = document.querySelector('.crown-info');
        const seedInfo = document.querySelector('.seed-info');

        // Hide other info sections
        crownInfo.style.display = 'none';
        seedInfo.style.display = 'none';

        // Show and populate node info
        nodeInfo.style.display = 'block';

        // Basic info first
        document.getElementById('node-title').textContent = `Sonnet ${nodeData.position}`;
        document.getElementById('node-authors').textContent = nodeData.authors;
        document.getElementById('completion-order').textContent =
            this.getOrdinalNumber(nodeData.completion_order);

        const sonnetLink = document.getElementById('view-full-sonnet');
        sonnetLink.href = `/sonnet/${nodeData.id}`;

        // **POETRY REVELATION MAGIC**
        await this.revealSonnetPoetry(nodeData.id);
    }

    async revealSonnetPoetry(sonnetId) {
        try {
            const sonnetData = await this.dataService.getSonnetLines(sonnetId);

            // Clear previous poetry
            const poetryContainer = this.getOrCreatePoetryContainer();
            poetryContainer.innerHTML = '';

            // Add elegant poetry header
            const header = document.createElement('div');
            header.className = 'poetry-header';
            header.innerHTML = `
                <div class="poetry-authors">by ${sonnetData.authors}</div>
                <div class="poetry-position">Position ${sonnetData.position_in_crown} in Crown</div>
            `;
            poetryContainer.appendChild(header);

            // Create poetry lines container
            const linesContainer = document.createElement('div');
            linesContainer.className = 'poetry-lines';
            poetryContainer.appendChild(linesContainer);

            // **TYPEWRITER REVELATION**
            for (let i = 0; i < sonnetData.lines.length; i++) {
                await this.revealPoetryLine(sonnetData.lines[i], linesContainer, i);
                await this.delay(200); // Pause between lines for dramatic effect
            }

        } catch (error) {
            console.error('Poetry revelation failed:', error);
            // Fallback to basic display
            const first = document.getElementById('node-first-line');
            const last = document.getElementById('node-last-line');
            if (first) first.textContent = this.selectedNodeData?.first_line || '';
            if (last) last.textContent = this.selectedNodeData?.last_line || '';
        }
    }

    async revealPoetryLine(line, container, index) {
        return new Promise((resolve) => {
            const lineElement = document.createElement('div');
            lineElement.className = 'poetry-line';
            lineElement.innerHTML = `
                <span class="line-number">${line.number}</span>
                <span class="line-text"></span>
            `;
            container.appendChild(lineElement);

            const textSpan = lineElement.querySelector('.line-text');

            // **TYPEWRITER EFFECT**
            this.typewriterEffect(line.text, textSpan, 40, () => {
                // Line complete - add subtle glow effect
                lineElement.classList.add('revealed');
                resolve();
            });
        });
    }

    typewriterEffect(text, element, speed = 50, callback) {
        let i = 0;
        element.textContent = '';

        const typeInterval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(typeInterval);
                if (callback) callback();
            }
        }, speed);
    }

    getOrCreatePoetryContainer() {
        let container = document.querySelector('.poetry-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'poetry-container';

            // Replace the old line preview section
            const linePreview = document.querySelector('.line-preview');
            if (linePreview) {
                linePreview.parentNode.replaceChild(container, linePreview);
            } else {
                document.querySelector('.node-info .panel-content').appendChild(container);
            }
        }
        return container;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getBreathingRate(completionOrder) {
        // Earlier sonnets (lower completion_order) breathe slower and deeper
        // suggesting ancient wisdom and gravitas
        const baseRate = 4000; // 4 seconds base breathing cycle
        const variation = completionOrder * 200; // Later sonnets breathe faster
        return baseRate + variation;
    }

    getNodeAtmosphere(completionOrder) {
        // Earlier sonnets have deeper, more mystical atmospheres
        const intensity = Math.max(0.3, 1 - (completionOrder / 14));
        return {
            depth: intensity,
            mystique: completionOrder <= 3 ? 'ancient' : completionOrder <= 7 ? 'mature' : 'fresh',
            pulseStrength: 0.8 + (intensity * 0.4) // 0.8 to 1.2 range
        };
    }

    startUnifiedAnimations() {
        if (!this.isInitialized || !this.sigma) return;

        // Initialize animation state for each node and edge
        this.initializeAnimationState();

        // Start the unified animation loop
        this.animationActive = true;
        this.runAnimationLoop();

        console.log('Unified animations: Breathing nodes + Flowing connections');
    }

    initializeAnimationState() {
        // Initialize node breathing state
        this.data.nodes.forEach(nodeData => {
            const nodeId = nodeData.id;
            this.breathingPhases = this.breathingPhases || new Map();
            this.breathingPhases.set(nodeId, Math.random() * Math.PI * 2); // Random start phase
        });

        // Initialize connection flow state
        this.graph.forEachEdge(edgeId => {
            this.connectionPhases = this.connectionPhases || new Map();
            this.connectionPhases.set(edgeId, Math.random() * Math.PI * 2); // Random start phase
        });
    }

    runAnimationLoop() {
        if (!this.animationActive || !this.sigma || this.sigma.killed) {
            return;
        }

        const currentTime = Date.now();
        let needsRefresh = false;

        // **ANIMATE NODE BREATHING**
        this.data.nodes.forEach(nodeData => {
            const nodeId = nodeData.id;
            if (!this.graph.hasNode(nodeId)) return;

            const nodeAttrs = this.graph.getNodeAttributes(nodeId);
            const { breathingRate, atmosphere, originalSize } = nodeAttrs;

            // Update breathing phase
            let phase = this.breathingPhases.get(nodeId);
            phase += (Math.PI * 2) / (breathingRate / 16); // 60fps target
            this.breathingPhases.set(nodeId, phase);

            // Calculate breathing effect
            const breathIntensity = Math.sin(phase) * 0.1 * atmosphere.pulseStrength;
            const newSize = originalSize * (1 + breathIntensity);

            this.graph.setNodeAttribute(nodeId, 'size', newSize);
            needsRefresh = true;
        });

        // **ANIMATE CONNECTION FLOW**
        this.graph.forEachEdge(edgeId => {
            if (!this.graph.hasEdge(edgeId)) return;

            // Update flow phase
            let phase = this.connectionPhases.get(edgeId);
            phase += Math.PI * 2 / 240; // ~4 second cycle at 60fps
            this.connectionPhases.set(edgeId, phase);

            // Create flowing opacity and size effects
            const pulseIntensity = (Math.sin(phase) + 1) / 2; // 0 to 1
            const newOpacity = 0.2 + (pulseIntensity * 0.6); // 0.2 to 0.8
            const sizeVariation = 1 + (Math.sin(phase * 1.3) * 0.1); // 0.9 to 1.1
            const newSize = 11 * sizeVariation;

            this.graph.setEdgeAttribute(edgeId, 'labelOpacity', newOpacity);
            this.graph.setEdgeAttribute(edgeId, 'labelSize', newSize);
            needsRefresh = true;
        });

        // **EFFICIENT REFRESH** - Only refresh if something changed
        if (needsRefresh) {
            this.sigma.refresh();
        }

        // Continue animation loop
        this.animationFrame = requestAnimationFrame(() => this.runAnimationLoop());
    }

    stopAnimations() {
        // Stop the unified animation loop
        this.animationActive = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Clear animation state
        if (this.breathingPhases) this.breathingPhases.clear();
        if (this.connectionPhases) this.connectionPhases.clear();

        console.log('All animations stopped and cleaned up');
    }

    pauseAnimations() {
        this.animationActive = false;
        console.log('Animations paused');
    }

    resumeAnimations() {
        if (!this.animationActive) {
            this.animationActive = true;
            this.runAnimationLoop();
            console.log('Animations resumed');
        }
    }

    cleanup() {
        // Stop all animations and clean up resources
        this.stopAnimations();

        // Clear any remaining intervals (belt-and-suspenders approach)
        if (this.breathingIntervals) {
            this.breathingIntervals.forEach(interval => clearInterval(interval));
            this.breathingIntervals.clear();
        }
        if (this.connectionIntervals) {
            this.connectionIntervals.forEach(interval => clearInterval(interval));
            this.connectionIntervals.clear();
        }

        // Dispose of Sigma.js instance
        if (this.sigma) {
            this.sigma.kill();
            this.sigma = null;
        }

        // Clear graph
        if (this.graph) {
            this.graph.clear();
            this.graph = null;
        }

        // Clear animation state
        if (this.breathingPhases) this.breathingPhases.clear();
        if (this.connectionPhases) this.connectionPhases.clear();

        console.log('Complete cleanup performed - all resources disposed');
    }

    formatSharedLine(sharedLine) {
        if (!sharedLine) return '';

        // Elegantly truncate long lines for display along edges
        const maxLength = 25;
        if (sharedLine.length <= maxLength) return sharedLine;

        // Find a good breaking point (space or punctuation)
        const truncated = sharedLine.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        const lastPunct = Math.max(
            truncated.lastIndexOf(','),
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf(';')
        );

        const breakPoint = Math.max(lastSpace, lastPunct);
        if (breakPoint > maxLength * 0.7) {
            return truncated.substring(0, breakPoint) + '...';
        }

        return truncated + '...';
    }

    // Legacy methods removed - now handled by unified animation system

    showSeedInfo() {
        const nodeInfo = document.querySelector('.node-info');
        const crownInfo = document.querySelector('.crown-info');
        const seedInfo = document.querySelector('.seed-info');

        nodeInfo.style.display = 'none';
        crownInfo.style.display = 'none';
        seedInfo.style.display = 'block';

        document.getElementById('seed-title').textContent = this.data.source_title;
    }

    hideNodeInfo() {
        const nodeInfo = document.querySelector('.node-info');
        const seedInfo = document.querySelector('.seed-info');
        const crownInfo = document.querySelector('.crown-info');

        nodeInfo.style.display = 'none';
        seedInfo.style.display = 'none';
        crownInfo.style.display = 'block';
    }

    updateInfoPanel() {
        const statusElement = document.getElementById('crown-status');
        const progressElement = document.getElementById('crown-progress');

        const isComplete = this.stats?.is_complete !== undefined
            ? this.stats.is_complete
            : this.data.status === 'complete';

        const completedPairs = this.stats?.completed_pairs ?? this.data.total_nodes ?? 0;
        const totalPairs = this.stats?.total_pairs ?? 14;

        if (statusElement) {
            statusElement.textContent = isComplete ? 'Complete' : 'In Progress';
        }

        if (progressElement) {
            progressElement.textContent = `${completedPairs}/${totalPairs}`;
        }
    }

    getOrdinalNumber(n) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const remainder = n % 100;
        return n + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
    }

    showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `
            <div class="loading-content">
                <div class="ornament">⚠</div>
                <p>${message}</p>
            </div>
        `;
    }

    createSeedSonnetDisplay() {
        // Create visual representation of seed sonnet lines
        // This could be implemented as floating text elements or visual connections
        // For now, we'll enhance the info panel to show seed sonnet details
        console.log('Creating seed sonnet display visualization');

        // Future enhancement: could add floating text nodes showing seed lines
        // or overlay text elements positioned around the center
    }

    lightenColor(color, factor) {
        // Convert hex color to RGB, lighten it, and convert back
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Lighten by moving towards white
        const newR = Math.round(r + (255 - r) * factor);
        const newG = Math.round(g + (255 - g) * factor);
        const newB = Math.round(b + (255 - b) * factor);

        // Convert back to hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
}
