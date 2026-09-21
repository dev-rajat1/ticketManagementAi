// Backend Base URL (Render Live Deployment)
const BACKEND_URL = window.ENV_BACKEND_URL || 'https://ticketmanagementai.onrender.com';
const API_URL = `${BACKEND_URL.replace(/\/$/, '')}/api`;

// Global State
window.currentUser = null;
window.currentTicketId = null;
window.currentPage = 1;
window.totalPages = 1;
window.tempChanges = {};
window.searchTimer = null;
window.selectedAgentFilter = null; // Stores {id, name} for performance filtering

// Helper for Fetch with Auth
window.apiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        cache: 'no-cache',
        ...options,
        headers
    });

    return response;
};
