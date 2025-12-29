import AppState from './state/AppState.js';
import CrownDataService from './services/CrownDataService.js';
import ExperienceDirector from './ExperienceDirector.js';

function getBootConfig() {
    const root = document.querySelector('[data-crown-id]');
    const fallbackId = 1;
    if (!root) {
        console.warn('Crown visualization boot: missing crown id element, defaulting to 1');
        return { crownId: fallbackId };
    }

    const crownIdRaw = root.dataset.crownId;
    const parsedId = Number.parseInt(crownIdRaw, 10);
    return {
        crownId: Number.isFinite(parsedId) ? parsedId : fallbackId,
        root
    };
}

async function boot() {
    console.log('[Mayday Viz] Boot starting...');

    const { crownId } = getBootConfig();
    console.log('[Mayday Viz] Crown ID:', crownId);

    const state = new AppState({
        currentView: 'lineage',
        selectedNodeId: null,
        isLoading: true
    });

    const dataService = new CrownDataService({ crownId });

    // Subscribe to loading state changes
    const loadingOverlay = document.getElementById('loading');
    console.log('[Mayday Viz] Loading overlay element:', loadingOverlay);

    state.subscribe('isLoading', (isLoading) => {
        console.log('[Mayday Viz] isLoading changed to:', isLoading);
        if (loadingOverlay) {
            loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
    });

    try {
        console.log('[Mayday Viz] Creating ExperienceDirector...');
        const director = new ExperienceDirector({ crownId, state, dataService });

        console.log('[Mayday Viz] Initializing...');
        await director.initialize();

        console.log('[Mayday Viz] Setting isLoading to false');
        state.set('isLoading', false);

        console.log('[Mayday Viz] Boot complete!');
        console.log('[Mayday Viz] Zoom with mouse wheel, drag to rotate, click nodes to explore');
    } catch (error) {
        console.error('[Mayday Viz] Failed to boot crown visualization', error);
        console.error('[Mayday Viz] Error stack:', error.stack);
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div class="ornament">⚠</div>
                    <p>${error.message}</p>
                    <p style="font-size: 0.8em; margin-top: 10px;">Check console for details</p>
                </div>
            `;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
