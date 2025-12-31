import LineageTunnelView from './views/LineageTunnelView.js';
import ScrollView from './views/ScrollView.js';
import CosmosView from './views/CosmosView.js';
import PoetStudioView from './views/PoetStudioView.js';
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
            lineage: 'lineage-stage',
            scroll: 'scroll-stage',
            cosmos: 'cosmos-stage'
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

        this.lineageView = new LineageTunnelView({
            container: document.getElementById('lineage-scroll'),
            state: this.state,
            nodes: this.nodes
        });
        this.lineageView.render();

        this.scrollView = new ScrollView({
            container: document.getElementById('scroll-content'),
            state: this.state,
            crownId: this.crownId
        });
        await this.scrollView.initialize();

        this.cosmosView = new CosmosView({
            container: document.getElementById('cosmos-stage'),
            state: this.state,
            dataService: this.dataService,
            crownId: this.crownId
        });
        await this.cosmosView.initialize();

        // Bind close button for cosmos overlay
        const cosmosCloseBtn = document.querySelector('.cosmos-close-poem');
        if (cosmosCloseBtn) {
            cosmosCloseBtn.addEventListener('click', () => this.cosmosView.closePoem());
        }

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

        // Navigate to different Crown's visualization page
        if (crownId !== this.crownId) {
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
        // Setup prev/next arrow navigation
        const prevBtn = document.getElementById('prev-crown');
        const nextBtn = document.getElementById('next-crown');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const targetCrown = parseInt(prevBtn.dataset.crown);
                if (targetCrown >= 1) {
                    window.location.href = `/crown/${targetCrown}/visualize`;
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const targetCrown = parseInt(nextBtn.dataset.crown);
                window.location.href = `/crown/${targetCrown}/visualize`;
            });
        }
    }

    setupPanelControls() {
        const closeBtn = document.querySelector('.close-panel');
        const panel = document.querySelector('.info-panel');
        const stageWrapper = document.querySelector('.stage-wrapper');

        const closePanel = () => {
            if (panel) {
                panel.style.display = 'none';
            }
            // Make visualization full width
            if (stageWrapper) {
                stageWrapper.style.width = '100%';
            }
        };

        // Close button click
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', closePanel);
        }

        // Click outside to close
        if (panel) {
            // Use setTimeout to let the panel open first
            document.addEventListener('mousedown', (e) => {
                // Check if panel is actually visible (not just style.display)
                const panelVisible = panel.style.display === 'flex';

                // Only close if panel is visible and click is outside the panel
                if (panelVisible && !panel.contains(e.target)) {
                    closePanel();
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

        if (this.lineageView) {
            this.lineageView.setActive(view === 'lineage');
        }

        if (this.cosmosView) {
            this.cosmosView.setActive(view === 'cosmos');
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
            const authors = source.authors || 'Unknown';
            const generation = crown.generation;
            const genLabel = generation === 1 ? 'Classic Seed' : `Generation ${generation}`;

            // For classic seeds (gen 1), show title; for collaborative, show first line
            const isClassic = generation === 1;
            const displayText = isClassic ? source.title : source.first_line;

            // Truncate if too long
            const truncated = displayText.length > 60 ? displayText.substring(0, 60) + '...' : displayText;
            const contextText = `"${truncated}" by ${authors} • ${genLabel}`;

            if (jewelsContext) {
                jewelsContext.textContent = contextText;
            }
            if (threadsContext) {
                threadsContext.textContent = contextText;
            }
        }
    }
}
