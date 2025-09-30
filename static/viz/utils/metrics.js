export default class MetricsTracker {
    constructor() {
        this.viewsVisited = new Set();
        this.nodeSelections = new Set();
        this.linesRevealed = 0;
        this.lastReport = 0;
    }

    recordView(view) {
        this.viewsVisited.add(view);
        this.report('view-change');
    }

    recordSelection(nodeId) {
        if (nodeId !== undefined && nodeId !== null) {
            this.nodeSelections.add(nodeId);
        }
        this.report('selection');
    }

    recordLineReveal() {
        this.linesRevealed += 1;
        this.report('line-reveal');
    }

    report(source) {
        const now = Date.now();
        if (now - this.lastReport < 1000 && source !== 'line-reveal') {
            return;
        }
        this.lastReport = now;
        const snapshot = {
            timestamp: now,
            viewsVisited: Array.from(this.viewsVisited),
            selections: this.nodeSelections.size,
            linesRevealed: this.linesRevealed
        };
        window.__maydayVizMetrics = snapshot;
        if (typeof console !== 'undefined') {
            console.debug('[Mayday Viz Metrics]', snapshot);
        }
    }
}
