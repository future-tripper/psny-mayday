import { formatOrdinal } from '../utils/formatters.js';

export default class LineageTunnelView {
    constructor({ container, state, nodes }) {
        this.container = container;
        this.state = state;
        this.nodes = nodes;
        this.cardById = new Map();
        this.active = false;
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        const sortedNodes = this.nodes.slice().sort((a, b) => {
            const orderA = typeof a.completion_order === 'number' ? a.completion_order : Infinity;
            const orderB = typeof b.completion_order === 'number' ? b.completion_order : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.position - b.position;
        });

        sortedNodes.forEach((node) => {
            const card = document.createElement('article');
            card.className = 'lineage-card';
            card.dataset.sonnetId = node.id;
            card.setAttribute('role', 'listitem');
            card.tabIndex = 0;
            card.innerHTML = `
                <p class="lineage-sequence">${formatOrdinal(node.completion_order || node.position)}</p>
                <h4 class="lineage-title">${node.first_line}</h4>
                <p class="lineage-authors">${node.authors}</p>
            `;

            card.addEventListener('click', () => {
                this.state.set('selectedNodeId', node.id);
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.state.set('selectedNodeId', node.id);
                }
            });

            this.container.appendChild(card);
            this.cardById.set(node.id, card);
        });
    }

    highlightNode(nodeId) {
        this.cardById.forEach((card, id) => {
            card.dataset.selected = id === nodeId ? 'true' : 'false';
        });
        if (this.active) {
            this.scrollTo(nodeId);
        }
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.scrollTo(this.state.get('selectedNodeId'));
        }
    }

    scrollTo(nodeId) {
        const card = this.cardById.get(nodeId);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}
