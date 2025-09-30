import { formatDate, formatDuration, formatOrdinal } from '../utils/formatters.js';

export default class PoetStudioView {
    constructor({ container, linesContainer, titleElement, metaElement, linkElement, state, dataService, metrics }) {
        this.container = container;
        this.linesContainer = linesContainer;
        this.titleElement = titleElement;
        this.metaElement = metaElement;
        this.linkElement = linkElement;
        this.state = state;
        this.dataService = dataService;
        this.metrics = metrics;

        this.renderToken = null;
    }

    async showSonnet(node) {
        if (!node) return;
        this.currentNodeId = node.id;
        if (this.linkElement) {
            this.linkElement.href = `/sonnet/${node.id}`;
        }

        if (this.titleElement) {
            this.titleElement.textContent = node.first_line || 'A weaving of voices';
        }

        if (this.metaElement) {
            this.metaElement.textContent = node.authors;
        }

        this.renderToken = Symbol('poet-studio-render');
        const token = this.renderToken;
        await this.renderLines(node.id, token);
    }

    async renderLines(sonnetId, token) {
        if (!this.linesContainer) return;
        this.linesContainer.innerHTML = '';
        this.linesContainer.scrollTop = 0;

        try {
            const sonnet = await this.dataService.getSonnetLines(sonnetId);
            const delayBetweenLines = 160;

            for (const line of sonnet.lines) {
                if (token !== this.renderToken) return;
                const lineElement = document.createElement('div');
                const isBookend = line.number === 1 || line.number === 14;
                lineElement.className = isBookend ? 'studio-line bookend-line' : 'studio-line';
                lineElement.textContent = line.text;

                this.linesContainer.appendChild(lineElement);
                lineElement.classList.add('revealed');
                this.metrics?.recordLineReveal();
                await this.delay(delayBetweenLines);
            }

            const tailSpace = document.createElement('div');
            tailSpace.style.minHeight = '12px';
            this.linesContainer.appendChild(tailSpace);
        } catch (error) {
            console.error('Failed to load sonnet', error);
            if (token !== this.renderToken) return;
            const fallback = document.createElement('p');
            fallback.textContent = 'We had trouble opening this sonnet. Try again in a moment.';
            this.linesContainer.appendChild(fallback);
        }
    }

    async typeLine(element, text, token) {
        element.textContent = '';
        const characters = [...text];
        for (const char of characters) {
            if (token !== this.renderToken) return;
            element.textContent += char;
            await this.delay(22);
        }
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
