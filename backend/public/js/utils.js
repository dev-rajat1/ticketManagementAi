/**
 * UI Utilities and Toast Notifications
 */

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.updatePaginationUI = function(meta) {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (pageInfo) pageInfo.innerText = `Page ${meta.page} of ${meta.totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = meta.page <= 1;
    if (nextBtn) nextBtn.disabled = meta.page >= meta.totalPages;
};

window.formatDate = function(dateString) {
    return new Date(dateString).toLocaleDateString();
};

window.formatDateTime = function(dateString) {
    return new Date(dateString).toLocaleString();
};
