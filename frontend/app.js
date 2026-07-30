const API_URL = (window.ENV_BACKEND_URL || 'http://localhost:5000') + '/api';

// --- Global Core State ---
let currentUser = null;
let currentTicketId = null;
let currentPage = 1;
let totalPages = 1;
let tempChanges = {};
let searchTimer = null;

/**
 * LOGOUT FUNCTION
 */
window.logout = function() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
};

// --- Toast Notifications ---
function showToast(message, type = 'success') {
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
}

// --- Auth Initialization ---
async function initApp() {
    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('auth-page').style.display = 'flex';
        document.getElementById('dashboard-page').style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if(data.success) {
            currentUser = data.data.user;
            renderProfileUI();
            showSection('dashboard');
        } else { window.logout(); }
    } catch (e) { window.logout(); }
}

// --- Login ---
window.handleLogin = async function(event) {
    if(event) event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const d = await res.json();
        if (d.success) {
            localStorage.setItem('token', d.data.accessToken);
            initApp();
            showToast('Welcome Back!');
        } else showToast(d.message || 'Login failed', 'error');
    } catch (err) { showToast('Server error', 'error'); }
};

// --- Navigation ---
window.showSection = function(section) {
    const sections = ['dashboard-section', 'staff-section', 'customers-section', 'performance-section'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const targetSection = document.getElementById(`${section}-section`);
    if(targetSection) targetSection.style.display = 'block';

    const navMap = { 'dashboard': 'nav-dashboard', 'staff': 'nav-staff', 'customers': 'nav-customers', 'performance': 'nav-performance' };
    const navItem = document.getElementById(navMap[section]);
    if(navItem) navItem.classList.add('active');

    if (section === 'dashboard') { loadTickets(1); updateDashboardStatsSummary(); }
    if (section === 'staff') loadStaff();
    if (section === 'customers') loadCustomers();
    if (section === 'performance') loadAgentPerformance();
};

// --- Tickets ---
async function loadTickets(page = 1) {
    currentPage = page;
    const token = localStorage.getItem('token');
    const status = document.getElementById('filter-status').value;
    const priority = document.getElementById('filter-priority').value;
    const category = document.getElementById('filter-category').value;
    const assignment = document.getElementById('filter-assignment')?.value || 'all';
    const search = document.getElementById('search-input').value;

    let url = new URL(`${window.location.origin}${API_URL}/tickets`);
    url.searchParams.append('page', page);
    if (search) url.searchParams.append('search', search);
    if (status) url.searchParams.append('status', status);
    if (priority) url.searchParams.append('priority', priority);
    if (category) url.searchParams.append('category', category);

    if (currentUser) {
        if (assignment === 'me') url.searchParams.append('assignedToId', currentUser.id);
        else if (assignment === 'unassigned') url.searchParams.append('assignedToId', 'null');
    }

    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
            renderTicketsTable(data.data);
            if (data.meta) {
                totalPages = data.meta.totalPages || 1;
                updatePaginationUI(data.meta);
            }
        }
    } catch (err) { showToast('Error loading tickets', 'error'); }
}

window.changePage = function(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        loadTickets(newPage);
    }
};

function renderTicketsTable(tickets) {
    const body = document.getElementById('tickets-body');
    if (!body) return;
    const isAdmin = currentUser && (currentUser.role === 'ADMIN');
    body.innerHTML = (tickets || []).map(t => `
        <tr class="priority-${t.priority.toLowerCase()}">
            <td><input type="checkbox" class="ticket-checkbox" value="${t.id}" onclick="window.updateBulkActionsVisibility('tickets')"></td>
            <td><small class="ticket-id-badge-small">${t.ticketNumber}</small></td>
            <td><strong>${t.subject}</strong></td>
            <td>${t.createdBy?.name || 'Email User'}</td>
            <td><span class="badge status-${t.status}">${t.status}</span></td>
            <td>${t.category || 'General'}</td>
            <td><small>${new Date(t.createdAt).toLocaleDateString()}</small></td>
            <td>
                <button onclick="window.openDetailModal('${t.id}')" class="btn-primary-small">View</button>
                ${isAdmin ? `<button onclick="window.deleteTicket('${t.id}')" class="btn-primary-small" style="background:var(--danger);"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center;">No tickets.</td></tr>';
    document.getElementById('select-all-tickets').checked = false;
    window.updateBulkActionsVisibility('tickets');
}

window.toggleSelectAll = function(type) {
    const isChecked = document.getElementById(`select-all-${type}`).checked;
    const checkboxes = document.querySelectorAll(`.${type.slice(0,-1)}-checkbox`);
    checkboxes.forEach(cb => cb.checked = isChecked);
    window.updateBulkActionsVisibility(type);
};

window.updateBulkActionsVisibility = function(type) {
    const selected = document.querySelectorAll(`.${type.slice(0,-1)}-checkbox:checked`);
    const bulkBtn = document.getElementById(`bulk-delete-${type}`);
    if (bulkBtn) {
        bulkBtn.style.display = selected.length > 0 ? 'inline-block' : 'none';
        bulkBtn.innerText = `Bulk Delete (${selected.length})`;
    }
};

window.bulkDeleteTickets = async function() {
    const selected = Array.from(document.querySelectorAll('.ticket-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0 || !confirm(`Delete ${selected.length} tickets permanently?`)) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/bulk-action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'delete', ticketIds: selected })
        });
        if (res.ok) {
            showToast('Tickets deleted');
            loadTickets(currentPage);
        } else showToast('Bulk delete failed', 'error');
    } catch (e) { showToast('Error', 'error'); }
};

window.bulkDeleteUsers = async function(type) {
    const prefix = type === 'staff' ? 'staff' : 'customer';
    const selected = Array.from(document.querySelectorAll(`.${prefix}-checkbox:checked`)).map(cb => cb.value);
    if (selected.length === 0 || !confirm(`Delete ${selected.length} members permanently?`)) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/users/bulk-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userIds: selected })
        });
        if (res.ok) {
            showToast('Members deleted');
            if (type === 'staff') loadStaff(); else loadCustomers();
        } else showToast('Bulk delete failed', 'error');
    } catch (e) { showToast('Error', 'error'); }
};

window.deleteTicket = async function(id) {
    if (!confirm('Delete this ticket permanently?')) return;
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/tickets/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        showToast('Ticket deleted');
        loadTickets(currentPage);
    } catch (e) { showToast('Delete failed', 'error'); }
};

window.openDetailModal = async function(id) {
    currentTicketId = id;
    tempChanges = {};
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        const t = d.data;

        document.getElementById('d-subject').innerText = t.subject;
        document.getElementById('d-ticket-num').innerText = t.ticketNumber;
        document.getElementById('d-description').innerText = t.description;
        document.getElementById('d-status').innerText = t.status;
        document.getElementById('d-status').className = `badge status-${t.status}`;
        document.getElementById('d-creator').innerText = t.createdBy?.name || 'Email User';

        // AI Summary
        const aiSummaryBox = document.getElementById('ai-summary-box');
        if (t.aiSummary) {
            aiSummaryBox.style.display = 'block';
            document.getElementById('d-ai-summary').innerText = t.aiSummary;
        } else aiSummaryBox.style.display = 'none';
        document.getElementById('d-ai-sentiment').innerText = t.aiSentiment || 'Analyzing...';

        const isStaff = currentUser.role !== 'USER';
        document.getElementById('admin-actions').style.display = isStaff ? 'block' : 'none';
        document.getElementById('btn-save-ticket').style.display = 'none';
        document.getElementById('btn-done-ticket').style.display = 'inline-block';

        if (isStaff) {
            document.getElementById('update-status').value = t.status;
            document.getElementById('update-status').onchange = (e) => trackChange('status', e.target.value);
            if (currentUser.role === 'ADMIN') {
                await loadAgentsList(t.assignedToId);
                document.getElementById('update-assignee').onchange = (e) => trackChange('assignedToId', e.target.value || null);
            }
        }

        renderComments(t.comments);
        renderAttachments(t.attachments);
        document.getElementById('detail-modal').style.display = 'flex';
        window.switchDetailTab('comments');
    } catch (e) { showToast('Load error', 'error'); }
};

function trackChange(field, value) {
    tempChanges[field] = value;
    document.getElementById('btn-save-ticket').style.display = 'inline-block';
    document.getElementById('btn-done-ticket').style.display = 'none';
}

window.saveTicketChanges = async function() {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_URL}/tickets/${currentTicketId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(tempChanges)
        });
        showToast('Changes saved');
        tempChanges = {};
        window.openDetailModal(currentTicketId);
        loadTickets(currentPage);
    } catch (e) { showToast('Save failed', 'error'); }
};

window.closeDetailModal = function() { document.getElementById('detail-modal').style.display = 'none'; };

// --- Conversation ---
document.getElementById('add-comment-form').onsubmit = async (e) => {
    e.preventDefault();
    const content = document.getElementById('c-text').value;
    if (!content) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/${currentTicketId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            document.getElementById('c-text').value = '';
            document.getElementById('ai-suggestion-box').style.display = 'none';
            const d = await fetch(`${API_URL}/tickets/${currentTicketId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const ticket = await d.json();
            renderComments(ticket.data.comments);
            showToast('Reply sent and Customer notified');
        }
    } catch (err) { showToast('Failed to send reply', 'error'); }
};

window.getAiSuggestion = async function() {
    const btn = document.querySelector('button[onclick="window.getAiSuggestion()"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/${currentTicketId}/ai-suggest`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        if (d.success && d.data.length > 0) {
            document.getElementById('ai-suggestion-box').style.display = 'block';
            document.getElementById('ai-suggested-text').innerText = d.data[0].response;
        }
    } catch (e) { showToast('AI unavailable', 'error'); }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> AI Suggest';
};

window.useAiReply = function() {
    document.getElementById('c-text').value = document.getElementById('ai-suggested-text').innerText;
    document.getElementById('ai-suggestion-box').style.display = 'none';
};

window.regenerateAiSummary = async function() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/${currentTicketId}/ai-summary`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        if (d.success) {
            document.getElementById('ai-summary-box').style.display = 'block';
            document.getElementById('d-ai-summary').innerText = d.data.summary;
            showToast('AI Summary updated');
        }
    } catch (e) { showToast('AI failed', 'error'); }
};

// --- Create Ticket Modal ---
window.openCreateTicketModal = async function() {
    const token = localStorage.getItem('token');
    try {
        // Load Customers for dropdown
        const custRes = await fetch(`${API_URL}/users?role=USER`, { headers: { 'Authorization': `Bearer ${token}` } });
        const custData = await custRes.json();
        document.getElementById('t-customer').innerHTML = custData.data.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');

        // Load Agents for dropdown
        const agentRes = await fetch(`${API_URL}/users?role=AGENT`, { headers: { 'Authorization': `Bearer ${token}` } });
        const agentData = await agentRes.json();
        document.getElementById('t-assignee').innerHTML = '<option value="">-- Unassigned --</option>' + agentData.data.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        document.getElementById('create-ticket-form').reset();
        document.getElementById('create-ticket-modal').style.display = 'flex';
    } catch (e) { showToast('Failed to load users', 'error'); }
};

window.closeCreateTicketModal = function() { document.getElementById('create-ticket-modal').style.display = 'none'; };

document.getElementById('create-ticket-form').onsubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const data = {
        createdById: document.getElementById('t-customer').value,
        subject: document.getElementById('t-subject').value,
        description: document.getElementById('t-description').value,
        priority: document.getElementById('t-priority').value,
        category: document.getElementById('t-category').value,
        assignedToId: document.getElementById('t-assignee').value || null
    };

    try {
        const res = await fetch(`${API_URL}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Ticket created successfully');
            window.closeCreateTicketModal();
            loadTickets(1);
            updateDashboardStatsSummary();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { showToast('Error creating ticket', 'error'); }
};

// --- User Management ---
window.openUserModal = function(type, userId = null) {
    const form = document.getElementById('user-form');
    form.reset();
    document.getElementById('u-id').value = '';
    const isStaff = type === 'staff';
    document.getElementById('user-modal-title').innerText = userId ? (isStaff ? 'Edit Staff' : 'Edit Customer') : (isStaff ? 'Add Staff' : 'Add Customer');
    
    // UI Tweaks: Hide role and password for customers during creation
    document.getElementById('role-group').style.display = isStaff ? 'block' : 'none';
    document.getElementById('password-group').style.display = isStaff ? 'block' : 'none';
    
    document.getElementById('u-role').value = isStaff ? 'AGENT' : 'USER';

    if (userId) {
        // When editing, we might want to see these but the request was specifically about adding
        const token = localStorage.getItem('token');
        fetch(`${API_URL}/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json()).then(d => {
                document.getElementById('u-id').value = d.data.id;
                document.getElementById('u-name').value = d.data.name;
                document.getElementById('u-email').value = d.data.email;
                document.getElementById('u-phone').value = d.data.phoneNumber || '';
                document.getElementById('u-address').value = d.data.address || '';
                document.getElementById('u-role').value = d.data.role;
                document.getElementById('u-active').value = d.data.isActive ? "true" : "false";
                
                // Show role group only if it's staff even when editing
                document.getElementById('role-group').style.display = d.data.role !== 'USER' ? 'block' : 'none';
                // Show password group for staff only
                document.getElementById('password-group').style.display = d.data.role !== 'USER' ? 'block' : 'none';
            });
    }
    document.getElementById('user-modal').style.display = 'flex';
};

window.closeUserModal = function() { document.getElementById('user-modal').style.display = 'none'; };

window.deleteUser = async function(id, type) {
    if (!confirm('Permanently delete this member?')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            showToast('Deleted');
            if (type === 'staff') loadStaff(); else loadCustomers();
        } else showToast('Failed to delete', 'error');
    } catch (e) { showToast('Network error', 'error'); }
};

document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('u-id').value;
    const token = localStorage.getItem('token');
    const role = document.getElementById('u-role').value;
    
    const data = {
        name: document.getElementById('u-name').value,
        email: document.getElementById('u-email').value,
        phoneNumber: document.getElementById('u-phone').value,
        address: document.getElementById('u-address').value,
        role: role,
        isActive: document.getElementById('u-active').value === 'true'
    };
    
    const pass = document.getElementById('u-password').value;
    if (pass) data.password = pass;

    // Determine correct endpoint
    let endpoint = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;
    if (!id && role === 'USER') {
        endpoint = `${API_URL}/users/customers`;
    }

    try {
        const res = await fetch(endpoint, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Saved');
            window.closeUserModal();
            if (data.role === 'USER') loadCustomers(); else loadStaff();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { showToast('Error saving', 'error'); }
};

async function loadStaff() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        const staff = d.data.filter(u => u.role !== 'USER');
        document.getElementById('staff-body').innerHTML = staff.map(u => `
            <tr>
                <td><input type="checkbox" class="staff-checkbox" value="${u.id}" onclick="window.updateBulkActionsVisibility('staff')"></td>
                <td><strong>${u.name}</strong></td><td>${u.email}</td><td>${u.role}</td><td>${u.isActive?'Active':'No'}</td>
                <td><button onclick="window.openUserModal('staff','${u.id}')" class="btn-primary-small">Edit</button>
                <button onclick="window.deleteUser('${u.id}','staff')" class="btn-primary-small" style="background:var(--danger)">Del</button></td>
            </tr>
        `).join('');
        document.getElementById('select-all-staff').checked = false;
        window.updateBulkActionsVisibility('staff');
    } catch (e) {}
}

async function loadCustomers() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        const cust = d.data.filter(u => u.role === 'USER');
        document.getElementById('customers-body').innerHTML = cust.map(u => `
            <tr>
                <td><input type="checkbox" class="customer-checkbox" value="${u.id}" onclick="window.updateBulkActionsVisibility('customers')"></td>
                <td><strong>${u.name}</strong></td><td>${u.email}</td><td>${u.phoneNumber||'N/A'}</td><td>${u.isActive?'Active':'No'}</td>
                <td><button onclick="window.openUserModal('customer','${u.id}')" class="btn-primary-small">Edit</button>
                <button onclick="window.deleteUser('${u.id}','customer')" class="btn-primary-small" style="background:var(--danger)">Del</button></td>
            </tr>
        `).join('');
        document.getElementById('select-all-customers').checked = false;
        window.updateBulkActionsVisibility('customers');
    } catch (e) {}
}

// --- Detail Tabs ---
window.switchDetailTab = function(tab) {
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'history') loadTicketHistory(currentTicketId);
    if (tab === 'attachments') refreshAttachmentsOnly();
};

async function loadTicketHistory(id) {
    const container = document.getElementById('d-history');
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/tickets/${id}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await res.json();
        container.innerHTML = (d.data || []).map(h => `
            <div style="padding:8px; border-bottom:1px solid #eee;">
                <strong>${h.user.name}</strong> changed <strong>${h.fieldChanged}</strong>
                <div class="text-muted"><small>${h.oldValue || 'none'} ➔ ${h.newValue}</small></div>
            </div>
        `).join('') || '<p>No history logs.</p>';
    } catch (e) {}
}

function renderAttachments(attachments) {
    const container = document.getElementById('d-attachments');
    container.innerHTML = (attachments || []).map(a => `
        <div class="attachment-card" style="display:inline-block; margin:5px; text-align:center;">
            <a href="${a.fileUrl}" target="_blank"><img src="${a.fileUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:5px;"></a><br>
            <small style="display:block; width:80px; overflow:hidden; text-overflow:ellipsis;">${a.filename}</small>
        </div>
    `).join('') || '<p>No attachments yet.</p>';
}

async function refreshAttachmentsOnly() {
    const res = await fetch(`${API_URL}/tickets/${currentTicketId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const d = await res.json();
    renderAttachments(d.data.attachments);
}

// --- Utils ---
async function loadAgentsList(currentId) {
    const res = await fetch(`${API_URL}/users?role=AGENT`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const d = await res.json();
    document.getElementById('update-assignee').innerHTML = '<option value="">-- Unassigned --</option>' + d.data.map(a => `<option value="${a.id}" ${a.id === currentId ? 'selected' : ''}>${a.name}</option>`).join('');
}

function renderProfileUI() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'flex';
    document.getElementById('user-display-name').innerText = currentUser.name;
    document.getElementById('user-avatar').src = currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.name);
    
    const isStaff = currentUser.role !== 'USER';
    const isAdmin = currentUser.role === 'ADMIN';
    
    document.getElementById('nav-staff').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('nav-customers').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('nav-performance').style.display = isAdmin ? 'block' : 'none';
    
    // Show Assignment filter for staff
    const assignmentFilter = document.getElementById('filter-assignment');
    if (assignmentFilter) {
        assignmentFilter.style.display = isStaff ? 'block' : 'none';
        // Default to 'Assigned to Me' for AGENTS to match personal stats cards
        if (currentUser.role === 'AGENT') {
            assignmentFilter.value = 'me';
        }
    }

    // Show Create Ticket button for Admin
    document.getElementById('btn-create-ticket-main').style.display = isAdmin ? 'block' : 'none';
}

function updatePaginationUI(meta) {
    document.getElementById('page-info').innerText = `Page ${meta.page} of ${meta.totalPages || 1}`;
    document.getElementById('prev-page').disabled = meta.page <= 1;
    document.getElementById('next-page').disabled = meta.page >= meta.totalPages;
}

async function updateDashboardStatsSummary() {
    const res = await fetch(`${API_URL}/dashboard/stats`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const d = await res.json();
    if (d.success) {
        const s = d.data.tickets;
        let statsHTML = `
            <div class="stat-card"><h3>Total</h3><p>${s.total}</p></div>
            <div class="stat-card info"><h3>Open</h3><p>${s.open}</p></div>
            <div class="stat-card warning"><h3>Pending</h3><p>${s.pending}</p></div>
            <div class="stat-card success"><h3>Resolved</h3><p>${s.closed}</p></div>
        `;
        
        // Add Unassigned box for staff
        if (currentUser && currentUser.role !== 'USER') {
            statsHTML += `<div class="stat-card danger" style="border-left-color: var(--danger);"><h3>Unassigned</h3><p>${s.unassigned || 0}</p></div>`;
        }
        
        document.getElementById('stats-grid').innerHTML = statsHTML;
    }
}

async function loadAgentPerformance() {
    const res = await fetch(`${API_URL}/dashboard/agent-performance`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    const d = await res.json();
    document.getElementById('performance-body').innerHTML = d.data.map(a => `<tr><td>${a.name}</td><td>${a.totalAssigned}</td><td>${a.resolved}</td><td>${a.resolutionRate}%</td></tr>`).join('');
}

function renderComments(comments) {
    const container = document.getElementById('d-comments');
    container.innerHTML = (comments || []).map(c => `<div class="comment-item ${c.user.id===currentUser.id?'own-comment':''}"><strong>${c.user.name}</strong> • <small>${new Date(c.createdAt).toLocaleString()}</small><div>${c.content}</div></div>`).join('') || '<p>No replies yet.</p>';
}

// --- Profile Modal ---
window.openProfileModal = function() {
    if (!currentUser) return;
    document.getElementById('p-name').value = currentUser.name;
    document.getElementById('p-email').value = currentUser.email;
    document.getElementById('p-avatar').value = currentUser.avatarUrl || '';
    document.getElementById('p-phone').value = currentUser.phoneNumber || '';
    document.getElementById('p-address').value = currentUser.address || '';
    
    window.switchProfileTab('personal');
    document.getElementById('profile-modal').style.display = 'flex';
};

window.switchProfileTab = function(tab) {
    document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.detail-tab-btn').forEach(b => {
        if (b.id.startsWith('btn-tab-')) b.classList.remove('active');
    });
    
    if (tab === 'personal') {
        document.getElementById('profile-form').style.display = 'block';
        document.getElementById('btn-tab-personal').classList.add('active');
    } else {
        document.getElementById('password-form').style.display = 'block';
        document.getElementById('btn-tab-password').classList.add('active');
    }
};

window.onload = () => {
    initApp();
    document.getElementById('login-form').onsubmit = window.handleLogin;
    
    // Profile Form
    document.getElementById('profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const data = {
            name: document.getElementById('p-name').value,
            avatarUrl: document.getElementById('p-avatar').value,
            phoneNumber: document.getElementById('p-phone').value,
            address: document.getElementById('p-address').value
        };
        
        try {
            const res = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            const d = await res.json();
            if (d.success) {
                currentUser = d.data.user;
                renderProfileUI();
                showToast('Profile updated successfully');
                document.getElementById('profile-modal').style.display = 'none';
            } else showToast(d.message, 'error');
        } catch (err) { showToast('Update failed', 'error'); }
    };

    // Password Form
    document.getElementById('password-form').onsubmit = async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('p-old-password').value;
        const newPassword = document.getElementById('p-new-password').value;
        const confirmPassword = document.getElementById('p-confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            return showToast('Passwords do not match', 'error');
        }
        
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ oldPassword, newPassword })
            });
            const d = await res.json();
            if (d.success) {
                showToast('Password changed successfully');
                document.getElementById('password-form').reset();
                document.getElementById('profile-modal').style.display = 'none';
            } else showToast(d.message, 'error');
        } catch (err) { showToast('Update failed', 'error'); }
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadTickets(1), 500);
        });
    }
};
