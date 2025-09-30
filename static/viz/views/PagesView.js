export default class PagesView {
    constructor({ container, titleElement, authorsElement, bodyElement, positionElement, prevButton, nextButton, state, dataService, nodes }) {
        this.container = container;
        this.titleElement = titleElement;
        this.authorsElement = authorsElement;
        this.bodyElement = bodyElement;
        this.positionElement = positionElement;
        this.prevButton = prevButton;
        this.nextButton = nextButton;
        this.state = state;
        this.dataService = dataService;
        this.nodes = nodes;

        this.currentIndex = 0;
        this.active = false;

        // Sort nodes by completion order
        this.sortedNodes = this.nodes.slice().sort((a, b) => {
            const orderA = typeof a.completion_order === 'number' ? a.completion_order : Infinity;
            const orderB = typeof b.completion_order === 'number' ? b.completion_order : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.position - b.position;
        });

        this.setupNavigation();
    }

    setupNavigation() {
        if (this.prevButton) {
            this.prevButton.addEventListener('click', () => this.previousPage());
        }
        if (this.nextButton) {
            this.nextButton.addEventListener('click', () => this.nextPage());
        }

        // Keyboard navigation
        document.addEventListener('keydown', (event) => {
            if (!this.active) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                this.previousPage();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                this.nextPage();
            }
        });
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive && this.sortedNodes.length > 0) {
            // Find current selected node or default to first
            const selectedId = this.state.get('selectedNodeId');
            const index = this.sortedNodes.findIndex(n => n.id === selectedId);
            this.currentIndex = index >= 0 ? index : 0;
            this.showCurrentPage();
        }
    }

    previousPage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showCurrentPage();
        }
    }

    nextPage() {
        if (this.currentIndex < this.sortedNodes.length - 1) {
            this.currentIndex++;
            this.showCurrentPage();
        }
    }

    async showCurrentPage() {
        const node = this.sortedNodes[this.currentIndex];
        if (!node) return;

        // Update state so other views sync
        this.state.set('selectedNodeId', node.id);

        // Update navigation button states
        if (this.prevButton) {
            this.prevButton.disabled = this.currentIndex === 0;
        }
        if (this.nextButton) {
            this.nextButton.disabled = this.currentIndex === this.sortedNodes.length - 1;
        }

        // Update position indicator
        if (this.positionElement) {
            this.positionElement.textContent = `${this.currentIndex + 1} of ${this.sortedNodes.length}`;
        }

        // Update title and authors
        if (this.titleElement) {
            this.titleElement.textContent = node.first_line || 'A weaving of voices';
        }
        if (this.authorsElement) {
            this.authorsElement.textContent = node.authors;
        }

        // Load and display the full sonnet
        await this.renderSonnet(node.id);
    }

    async renderSonnet(sonnetId) {
        if (!this.bodyElement) return;

        this.bodyElement.innerHTML = '<p style="text-align: center; opacity: 0.6;">Loading...</p>';

        try {
            const sonnet = await this.dataService.getSonnetLines(sonnetId);
            this.bodyElement.innerHTML = '';

            sonnet.lines.forEach((line) => {
                const lineElement = document.createElement('div');
                const isBookend = line.number === 1 || line.number === 14;
                lineElement.className = isBookend ? 'page-line bookend-line' : 'page-line';
                lineElement.textContent = line.text;
                this.bodyElement.appendChild(lineElement);
            });
        } catch (error) {
            console.error('Failed to load sonnet', error);
            this.bodyElement.innerHTML = '<p style="text-align: center; opacity: 0.6;">Unable to load sonnet.</p>';
        }
    }
}