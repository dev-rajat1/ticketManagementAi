// Backend Base URL configuration
const getBackendUrl = () => {
    if (window.ENV_BACKEND_URL) return window.ENV_BACKEND_URL;
    const custom = localStorage.getItem('CUSTOM_BACKEND_URL');
    if (custom) return custom;
    // file:// protocol ya localhost → local backend on port 5000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    if (
        protocol === 'file:' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === ''
    ) {
        return 'http://localhost:5000';
    }
    // If backend is running on the same host/port in Docker
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

// Token refresh state tracking to avoid duplicate refresh calls
let _isRefreshing = false;
let _refreshSubscribers = [];

function _onRefreshed(newToken) {
    _refreshSubscribers.forEach(cb => cb(newToken));
    _refreshSubscribers = [];
}

function _subscribeTokenRefresh(cb) {
    _refreshSubscribers.push(cb);
}

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

// Silently refresh access token using stored refresh token
async function _tryRefreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        window.logout();
        return null;
    }
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const d = await res.json();
        if (d.success && d.data && d.data.accessToken) {
            localStorage.setItem('token', d.data.accessToken);
            window.apiCache.clear(); // Clear stale cache after token refresh
            return d.data.accessToken;
        } else {
            window.logout();
            return null;
        }
    } catch (e) {
        console.error('Token refresh failed:', e);
        window.logout();
        return null;
    }
}

// Helper for Fetch with Auth & In-Memory Caching
window.apiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const forceFresh = options.forceFresh === true;
    const isRetry = options._isRetry === true;

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

    const buildHeaders = (tok) => {
        const h = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (tok) h['Authorization'] = `Bearer ${tok}`;
        return h;
    };

    const fetchOptions = { ...options };
    delete fetchOptions.forceFresh;
    delete fetchOptions._isRetry;

    const doFetch = async (tok) => {
        return fetch(`${API_URL}${endpoint}`, {
            ...fetchOptions,
            headers: buildHeaders(tok)
        });
    };

    let response = await doFetch(token);

    // Handle 401: attempt token refresh once, then retry
    if (response.status === 401 && !isRetry) {
        if (!_isRefreshing) {
            _isRefreshing = true;
            const newToken = await _tryRefreshToken();
            _isRefreshing = false;
            if (newToken) {
                _onRefreshed(newToken);
                // Retry original request with new token
                response = await doFetch(newToken);
            } else {
                return response; // logout already called
            }
        } else {
            // Another refresh is already in progress — wait for it
            const newToken = await new Promise(resolve => _subscribeTokenRefresh(resolve));
            if (newToken) {
                response = await doFetch(newToken);
            }
        }
    }

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
