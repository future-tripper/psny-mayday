/**
 * Data access layer for crown visualization experiments.
 * Keeps production APIs untouched while offering caching and
 * dynamic crown switching inside the visualization sandbox.
 */

export default class CrownDataService {
    constructor({ crownId = 1, basePath = '/api', fetchImpl = fetch } = {}) {
        this.crownId = crownId;
        this.basePath = basePath.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;

        this.crownNodesCache = new Map(); // key: crownId → graph data
        this.crownStatsCache = new Map();
        this.sonnetCache = new Map(); // key: sonnetId → sonnet payload
    }

    setCrownId(nextId) {
        if (nextId === this.crownId) return;
        this.crownId = nextId;
    }

    invalidate() {
        this.crownNodesCache.clear();
        this.crownStatsCache.clear();
        this.sonnetCache.clear();
    }

    async getCrownNodes(crownId = this.crownId) {
        if (this.crownNodesCache.has(crownId)) {
            return this.crownNodesCache.get(crownId);
        }

        const data = await this.#fetchJson(`${this.basePath}/crown/${crownId}/nodes`);
        this.crownNodesCache.set(crownId, data);
        return data;
    }

    async getCrownStats(crownId = this.crownId) {
        if (this.crownStatsCache.has(crownId)) {
            return this.crownStatsCache.get(crownId);
        }

        const data = await this.#fetchJson(`${this.basePath}/crown/${crownId}/stats`);
        this.crownStatsCache.set(crownId, data);
        return data;
    }

    async getSonnetLines(sonnetId) {
        if (this.sonnetCache.has(sonnetId)) {
            return this.sonnetCache.get(sonnetId);
        }

        const data = await this.#fetchJson(`${this.basePath}/sonnet/${sonnetId}/lines`);
        this.sonnetCache.set(sonnetId, data);
        return data;
    }

    async preloadCrown(crownId = this.crownId) {
        const [nodes, stats] = await Promise.all([
            this.getCrownNodes(crownId),
            this.getCrownStats(crownId)
        ]);
        return { nodes, stats };
    }

    async #fetchJson(url) {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const message = await this.#safeParseError(response);
            throw new Error(message || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    async #safeParseError(response) {
        try {
            const payload = await response.json();
            if (typeof payload === 'string') return payload;
            if (payload?.error) return payload.error;
            return JSON.stringify(payload);
        } catch (err) {
            return response.statusText;
        }
    }
}
