import OrreryView from './views/OrreryView.js';
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
            orbit: 'orrery-stage',
            lineage: 'lineage-stage',
            studio: 'orrery-stage',
            pages: 'pages-stage'
        };
    }

    async initialize() {
        const [crownData, stats] = await Promise.all([
            this.dataService.getCrownNodes(this.crownId),
            this.dataService.getCrownStats(this.crownId)
        ]);

        this.crownData = crownData;
        this.stats = stats;
        this.nodes = Array.isArray(crownData.nodes) ? crownData.nodes.slice() : [];
        this.connections = crownData.connections || [];

        this.enhanceNodes();
        this.setupViewControls();
        this.setupPanelControls();
        this.renderMetrics();
        this.renderStoryHighlights();

        this.orreryView = new OrreryView({
            container: document.getElementById('orrery-stage'),
            canvas: document.getElementById('orrery-canvas'),
            overlay: document.getElementById('orrery-overlay'),
            state: this.state,
            nodes: this.nodes,
            connections: this.connections,
            sourceTitle: crownData.source_title,
            sourceFirstLine: crownData.source_first_line
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

        // Don't auto-select a node - let panel stay closed until user clicks
        // const defaultNode = this.nodes.slice().sort(this.compareByCompletion())[0];
        // if (defaultNode) {
        //     this.state.set('selectedNodeId', defaultNode.id);
        // }

        this.onViewChange(this.state.get('currentView'));
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
                event.preventDefault();
                const view = link.dataset.view;
                if (view && view !== this.state.get('currentView')) {
                    this.state.set('currentView', view);
                }
            });
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
}
