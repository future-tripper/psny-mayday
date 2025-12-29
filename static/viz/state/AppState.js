/**
 * Lightweight state container + event emitter for visualization experiments.
 */

export default class AppState {
    constructor(initialState = {}) {
        this.state = {
            currentView: 'lineage',
            selectedNodeId: null,
            isLoading: true,
            ...initialState
        };

        this.listeners = new Map();
    }

    /**
     * Subscribe to state changes for a key (or '*' for all changes).
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    set(key, value) {
        if (this.state[key] === value) return;
        this.state[key] = value;
        this.#notify(key, value);
        this.#notify('*', { key, value, snapshot: { ...this.state } });
    }

    get(key) {
        return this.state[key];
    }

    batch(updates = {}) {
        const entries = Object.entries(updates);
        if (!entries.length) return;
        entries.forEach(([key, value]) => {
            this.state[key] = value;
        });
        entries.forEach(([key, value]) => this.#notify(key, value));
        this.#notify('*', { snapshot: { ...this.state } });
    }

    #notify(key, payload) {
        const listeners = this.listeners.get(key);
        if (!listeners) return;
        listeners.forEach(cb => cb(payload));
    }
}
