// Backend Base URL configuration
const getBackendUrl = () => {
    if (window.ENV_BACKEND_URL) return window.ENV_BACKEND_URL;
    const custom = localStorage.getItem('CUSTOM_BACKEND_URL');
    if (custom) return custom;
    // If backend is running on the same host/port in local Docker or fullstack
    if (window.location.port === '5000') {
        return window.location.origin;
    }
    return 'https://ticketmanagementai.onrender.com';
};

const BACKEND_URL = getBackendUrl();
const API_URL = `${BACKEND_URL.replace(/\/$/, '')}/api`;
window.BACKEND_URL = BACKEND_URL;
window.API_URL = API_URL;

// Global State
window.currentUser = null;
window.currentTicketId = null;
window.currentPage = 1;
window.totalPages = 1;
window.tempChanges = {};
window.searchTimer = null;
window.selectedAgentFilter = null; // Stores {id, name} for performance filtering

// In-Memory API Cache System for Instant Loading & Persistence
window.apiCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache validity

// Invalidate specific cache keys or all cache
window.invalidateApiCache = function(pattern = null) {
    if (!pattern) {
        window.apiCache.clear();
        return;
    }
    for (const key of window.apiCache.keys()) {
        if (key.includes(pattern)) {
            window.apiCache.delete(key);
        }
    }
};

// Helper for Fetch with Auth & In-Memory Caching
window.apiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const forceFresh = options.forceFresh === true;

    // Cache Invalidation on data mutations (POST, PUT, DELETE, PATCH)
    if (!isGet) {
        if (endpoint.startsWith('/tickets')) {
            window.invalidateApiCache('/tickets');
            window.invalidateApiCache('/dashboard');
        } else if (endpoint.startsWith('/users')) {
            window.invalidateApiCache('/users');
            window.invalidateApiCache('/dashboard');
        } else if (endpoint.startsWith('/dashboard')) {
            window.invalidateApiCache('/dashboard');
        }
    }

    // Return instant cached data for GET requests if available and fresh
    const cacheKey = endpoint;
    if (isGet && !forceFresh && window.apiCache.has(cacheKey)) {
        const cached = window.apiCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return new Response(JSON.stringify(cached.data), {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = { ...options };
    delete fetchOptions.forceFresh; // Avoid passing non-standard option to fetch

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers
    });

    // Save successful GET responses to cache
    if (isGet && response.ok) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            window.apiCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
        } catch (e) {
            // Non-JSON response, ignore caching
        }
    }

    return response;
};
