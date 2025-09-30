export function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
        return '—';
    }

    const absSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;

    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!hours && !minutes) parts.push(`${secs}s`);
    else if (secs && parts.length < 2) parts.push(`${secs}s`);

    return parts.join(' ');
}

export function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${Math.round(value)}%`;
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatOrdinal(n) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = n % 100;
    return `${n}${suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]}`;
}
