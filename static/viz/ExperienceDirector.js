import OrreryView from './views/OrreryView.js';
import GalaxyGraphView from './views/GalaxyGraphView.js';
import LineageTunnelView from './views/LineageTunnelView.js';
import PoetStudioView from './views/PoetStudioView.js';
import PagesView from './views/PagesView.js';
import { formatDuration, formatPercent } from './utils/formatters.js';
import MetricsTracker from './utils/metrics.js';

export default class ExperienceDirector {
    constructor({ crownId, state, dataService }) {
        this.crownId = crownId;
        this.state = state;
        this.dataService = dataService;

        this.nodes = [];
        this.connections = [];
        this.stats = null;
        this.storyHighlights = [];
        this.metrics = new MetricsTracker();

        this.stageMap = {
            graph: 'graph-stage',
            orbit: 'orrery-stage',
            lineage: 'lineage-stage',
            studio: 'orrery-stage',
            pages: 'pages-stage'
        };
    }

    async initialize() {
        const [contextData, stats] = await Promise.all([
            this.dataService.getCrownContext(this.crownId),
            this.dataService.getCrownStats(this.crownId)
        ]);

        this.contextData = contextData;
        this.crownData = contextData; // For backwards compatibility
        this.stats = stats;
        this.nodes = Array.isArray(contextData.nodes) ? contextData.nodes.slice() : [];
        this.connections = contextData.connections || [];

        this.enhanceNodes();
        this.renderSeedContext();
        this.setupViewControls();
        this.setupCrownSelector();
        this.setupPanelControls();
        this.renderMetrics();
        this.renderStoryHighlights();
        this.renderCrownStatusBadge();

        // Initialize Galaxy Graph View (2D tree)
        this.galaxyGraphView = new GalaxyGraphView({
            container: document.getElementById('graph-stage'),
            canvas: document.getElementById('graph-canvas'),
            state: this.state,
            crownId: this.crownId,
            dataService: this.dataService
        });
        await this.galaxyGraphView.initialize();

        this.orreryView = new OrreryView({
            container: document.getElementById('orrery-stage'),
            canvas: document.getElementById('orrery-canvas'),
            overlay: document.getElementById('orrery-overlay'),
            state: this.state,
            nodes: this.nodes,
            connections: this.connections,
            sourceTitle: contextData.source?.title || 'The Seed',
            sourceFirstLine: contextData.source?.first_line || 'The source of all creation',
            crownContext: contextData // Pass full context with parent/children
        });
        await this.orreryView.initialize();

        this.lineageView = new LineageTunnelView({
            container: document.getElementById('lineage-scroll'),
            state: this.state,
            nodes: this.nodes
        });
        this.lineageView.render();

        this.poetStudioView = new PoetStudioView({
            container: document.getElementById('poet-studio'),
            linesContainer: document.getElementById('studio-lines'),
            titleElement: document.getElementById('studio-title'),
            metaElement: document.getElementById('studio-meta'),
            linkElement: document.getElementById('studio-view-link'),
            state: this.state,
            dataService: this.dataService,
            metrics: this.metrics
        });

        this.pagesView = new PagesView({
            container: document.getElementById('pages-stage'),
            titleElement: document.getElementById('page-title'),
            authorsElement: document.getElementById('page-authors'),
            bodyElement: document.getElementById('page-body'),
            positionElement: document.getElementById('page-position'),
            prevButton: document.querySelector('.page-nav-prev'),
            nextButton: document.querySelector('.page-nav-next'),
            state: this.state,
            dataService: this.dataService,
            nodes: this.nodes
        });

        this.state.subscribe('currentView', (view) => this.onViewChange(view));
        this.state.subscribe('selectedNodeId', (nodeId) => this.onNodeSelected(nodeId));
        this.state.subscribe('selectedCrownId', (crownId) => this.onCrownSelected(crownId));

        // Don't auto-select a node - let panel stay closed until user clicks
        // const defaultNode = this.nodes.slice().sort(this.compareByCompletion())[0];
        // if (defaultNode) {
        //     this.state.set('selectedNodeId', defaultNode.id);
        // }

        this.onViewChange(this.state.get('currentView'));
    }

    onCrownSelected(crownId) {
        if (!crownId) return;
        console.log('[ExperienceDirector] Crown selected, navigating to:', crownId);

        // If clicking current Crown, just switch to Jewels view
        if (crownId === this.crownId) {
            this.state.set('currentView', 'orbit');
        } else {
            // Navigate to different Crown's visualization page
            window.location.href = `/crown/${crownId}/visualize`;
        }
    }

    enhanceNodes() {
        const totalNodes = this.nodes.length || this.crownData.total_nodes || 1;
        this.nodes.forEach((node) => {
            node.angle = ((node.position - 1) / totalNodes) * Math.PI * 2;
            node.depth = typeof node.lineage_depth === 'number' ? node.lineage_depth : 1;
        });

        // Prepare highlights
        const durationNodes = this.nodes.filter((n) => typeof n.duration_seconds === 'number' && n.duration_seconds > 0);
        durationNodes.sort((a, b) => a.duration_seconds - b.duration_seconds);
        if (durationNodes.length) {
            const fastest = durationNodes[0];
            this.storyHighlights.push({
                title: 'Fastest Weave',
                body: `${fastest.authors} finished in ${formatDuration(fastest.duration_seconds)}.`
            });

            const slowest = durationNodes[durationNodes.length - 1];
            if (slowest !== fastest) {
                this.storyHighlights.push({
                    title: 'Slow Burn',
                    body: `${slowest.authors} savoured ${formatDuration(slowest.duration_seconds)} before sealing their sonnet.`
                });
            }
        }

        const latestCompletion = this.nodes
            .filter((n) => n.completed_at)
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];

        if (latestCompletion) {
            this.storyHighlights.push({
                title: 'Newest Star',
                body: `${latestCompletion.authors} just joined the crown with “${latestCompletion.last_line}”.`
            });
        }

        if (!this.storyHighlights.length && this.nodes.length) {
            this.storyHighlights.push({
                title: 'Crown in Motion',
                body: `${this.nodes.length} sonnets orbit the seed, ready for exploration.`
            });
        }
    }

    setupViewControls() {
        const links = document.querySelectorAll('.view-link');
        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                const view = link.dataset.view;
                // Only prevent default for view-switching links (with data-view attribute)
                if (view) {
                    event.preventDefault();
                    if (view !== this.state.get('currentView')) {
                        this.state.set('currentView', view);
                    }
                }
                // Links without data-view (like SCROLL) navigate normally
            });
        });
    }

    setupCrownSelector() {
        const selector = document.getElementById('crown-selector');
        if (!selector) return;

        // Set current Crown as selected
        selector.value = this.crownId;

        // Navigate on change
        selector.addEventListener('change', (event) => {
            const newCrownId = parseInt(event.target.value);
            if (newCrownId !== this.crownId) {
                window.location.href = `/crown/${newCrownId}/visualize`;
            }
        });
    }

    setupPanelControls() {
        const closeBtn = document.querySelector('.close-panel');
        const panel = document.querySelector('.info-panel');
        const stageWrapper = document.querySelector('.stage-wrapper');

        if (closeBtn && panel) {
            closeBtn.addEventListener('click', () => {
                panel.style.display = 'none';
                // Make visualization full width
                if (stageWrapper) {
                    stageWrapper.style.width = '100%';
                }
            });
        }
    }

    renderMetrics() {
        const completed = this.stats?.completed_pairs ?? this.crownData.total_nodes ?? 0;
        const total = this.stats?.total_pairs ?? 14;
        const percent = total ? (completed / total) * 100 : 0;
        const maxDepth = this.nodes.reduce((acc, node) => Math.max(acc, node.depth || 1), 1);

        const averageDurationSeconds = (() => {
            const durations = this.nodes
                .map((node) => node.duration_seconds)
                .filter((value) => typeof value === 'number' && value > 0);
            if (!durations.length) return null;
            const totalDuration = durations.reduce((acc, value) => acc + value, 0);
            return totalDuration / durations.length;
        })();

        const progressElement = document.getElementById('crown-progress');
        const progressPercentElement = document.getElementById('crown-progress-percent');
        const statusElement = document.getElementById('crown-status');
        const avgDurationElement = document.getElementById('average-duration');
        const depthElement = document.getElementById('max-lineage-depth');

        if (progressElement) progressElement.textContent = `${completed}/${total}`;
        if (progressPercentElement) progressPercentElement.textContent = formatPercent(percent);
        if (statusElement) statusElement.textContent = this.crownData.status === 'complete' ? 'Complete' : 'In Progress';
        if (avgDurationElement) avgDurationElement.textContent = formatDuration(averageDurationSeconds);
        if (depthElement) depthElement.textContent = maxDepth;
    }

    renderStoryHighlights() {
        const container = document.getElementById('story-cards');
        if (!container) return;

        container.innerHTML = '';
        if (!this.storyHighlights.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        this.storyHighlights.slice(0, 3).forEach((highlight) => {
            const card = document.createElement('article');
            card.className = 'story-card';
            card.innerHTML = `
                <h5>${highlight.title}</h5>
                <p>${highlight.body}</p>
            `;
            container.appendChild(card);
        });
    }

    onViewChange(view) {
        const links = document.querySelectorAll('.view-link');
        links.forEach((link) => {
            link.classList.toggle('active', link.dataset.view === view);
        });

        this.metrics.recordView(view);

        // Handle view switching
        document.querySelectorAll('.viz-stage').forEach((stage) => {
            stage.classList.remove('active');
            if (!stage.hasAttribute('hidden')) {
                stage.setAttribute('hidden', '');
            }
        });

        const stageId = this.stageMap[view];
        const stage = stageId ? document.getElementById(stageId) : null;
        if (stage) {
            stage.removeAttribute('hidden');
            stage.classList.add('active');
        }

        if (this.galaxyGraphView) {
            this.galaxyGraphView.setActive(view === 'graph');
        }

        if (this.orreryView) {
            this.orreryView.setMode(view);
        }

        if (this.lineageView) {
            this.lineageView.setActive(view === 'lineage');
        }

        if (this.pagesView) {
            this.pagesView.setActive(view === 'pages');
        }
    }

    onNodeSelected(nodeId) {
        const node = this.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Show the panel and resize visualization
        const panel = document.querySelector('.info-panel');
        const stageWrapper = document.querySelector('.stage-wrapper');
        const panelTitle = document.getElementById('panel-title');

        if (panel) {
            panel.style.display = 'flex';
        }
        if (stageWrapper) {
            stageWrapper.style.width = 'calc(100% - 580px)';
        }
        if (panelTitle) {
            panelTitle.textContent = `Sonnet by ${node.authors}`;
        }

        this.metrics.recordSelection(nodeId);

        if (this.orreryView) {
            this.orreryView.highlightNode(nodeId);
        }

        if (this.lineageView) {
            this.lineageView.highlightNode(nodeId);
        }

        if (this.poetStudioView) {
            this.poetStudioView.showSonnet(node);
        }
    }

    compareByCompletion() {
        return (a, b) => {
            const orderA = typeof a.completion_order === 'number' ? a.completion_order : Infinity;
            const orderB = typeof b.completion_order === 'number' ? b.completion_order : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.position - b.position;
        };
    }

    renderCrownStatusBadge() {
        const badges = [
            document.getElementById('crown-status-badge'),
            document.getElementById('crown-status-badge-threads')
        ];

        if (!this.contextData) return;

        const crown = this.contextData.crown;
        const isComplete = crown.status === 'complete';
        const progress = crown.completion_progress || '';

        const className = 'crown-status-badge ' + (isComplete ? 'complete' : 'in-progress');
        const text = isComplete ? `✓ Complete (${progress})` : `⧗ In Progress (${progress})`;

        badges.forEach(badge => {
            if (badge) {
                badge.className = className;
                badge.textContent = text;
            }
        });
    }

    renderSeedContext() {
        const jewelsContext = document.getElementById('seed-context-jewels');
        const threadsContext = document.getElementById('seed-context-threads');

        if (!this.contextData) return;

        const source = this.contextData.source;
        const crown = this.contextData.crown;

        if (source && source.first_line) {
            const firstLine = source.first_line;
            const authors = source.authors || 'Unknown';
            const generation = crown.generation;
            const genLabel = generation === 0 ? 'Classic Seed' : `Generation ${generation}`;

            // Truncate first line if too long
            const displayLine = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
            const contextText = `"${displayLine}" by ${authors} • ${genLabel}`;

            if (jewelsContext) {
                jewelsContext.textContent = contextText;
            }
            if (threadsContext) {
                threadsContext.textContent = contextText;
            }
        }
    }
}
