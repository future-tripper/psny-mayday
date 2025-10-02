export default class ScrollView {
    constructor({ container, state, crownId }) {
        this.container = container;
        this.state = state;
        this.crownId = crownId;
        this.sonnets = [];
    }

    async initialize() {
        await this.loadCrownData();
        this.render();
    }

    async loadCrownData() {
        try {
            const response = await fetch(`/api/crown/${this.crownId}/scroll`);
            if (!response.ok) throw new Error('Failed to load crown data');
            const data = await response.json();
            this.sonnets = data.sonnets || [];
            this.crownInfo = {
                status: data.status,
                completion: data.completion,
                seedFirstLine: data.seed_first_line,
                seedAuthors: data.seed_authors,
                generation: data.generation
            };
        } catch (error) {
            console.error('[ScrollView] Error loading crown data:', error);
            this.sonnets = [];
        }
    }

    render() {
        if (!this.container) return;

        // Update status badge
        const badge = document.getElementById('crown-status-badge-scroll');
        if (badge && this.crownInfo) {
            badge.className = 'crown-status-badge';
            if (this.crownInfo.status === 'complete') {
                badge.className += ' complete';
                badge.textContent = '✓ Complete (14/14)';
            } else {
                badge.className += ' in-progress';
                badge.textContent = `⧗ In Progress (${this.crownInfo.completion})`;
            }
        }

        // Update seed context
        const seedContext = document.getElementById('seed-context-scroll');
        if (seedContext && this.crownInfo) {
            const { seedFirstLine, seedAuthors, generation } = this.crownInfo;
            const genText = generation === 1 ? 'Classic Seed' : `Generation ${generation}`;
            seedContext.textContent = `"${seedFirstLine}" by ${seedAuthors} • ${genText}`;
        }

        // Render sonnets
        let html = '';

        if (this.sonnets.length === 0) {
            html = '<div class="scroll-empty"><p>The Crown is forming... Poets are weaving their threads into the tapestry.</p></div>';
        } else {
            html = '<div class="crown-collection">';
            this.sonnets.forEach(sonnet => {
                html += `
                    <div class="crown-sonnet">
                        <div class="sonnet-attribution">
                            <a href="/sonnet/${sonnet.id}" class="sonnet-link">${sonnet.authors}</a>
                        </div>
                        ${sonnet.lines.map(line => `
                            <div class="line${line.is_source ? ' bookend-line' : ''}">${line.text}</div>
                        `).join('')}
                    </div>
                `;
            });
            html += '</div>';
        }

        this.container.innerHTML = html;
    }

    show() {
        // Called when switching to this view
        console.log('[ScrollView] Showing scroll view');
    }

    hide() {
        // Called when switching away from this view
        console.log('[ScrollView] Hiding scroll view');
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
