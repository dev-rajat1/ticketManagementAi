/**
 * Dashboard & Navigation Logic
 */

window.currentSection = 'dashboard';

// Sidebar Toggle Function (Mainly for Mobile now)
window.toggleSidebar = function() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (!sidebar) return;

    // Toggle mobile active class
    sidebar.classList.toggle('mobile-active');
    if (overlay) overlay.classList.toggle('active');
};

// Initialize Sidebar State
window.initSidebar = function() {
    const sidebar = document.getElementById('main-sidebar');
    
    // Close sidebar when clicking links on mobile
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('mobile-active');
                const overlay = document.getElementById('mobile-overlay');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
};

window.showSection = function(section) {
    window.currentSection = section;
    const sections = ['dashboard-section', 'staff-section', 'customers-section', 'performance-section'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const targetSection = document.getElementById(`${section}-section`);
    if(targetSection) targetSection.style.display = 'block';

    const navMap = { 
        'dashboard': 'nav-dashboard', 
        'staff': 'nav-staff', 
        'customers': 'nav-customers', 
        'performance': 'nav-performance' 
    };
    const navItem = document.getElementById(navMap[section]);
    if(navItem) navItem.classList.add('active');

    // Update Search Placeholder
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = ''; // Clear search when switching sections
        if (section === 'dashboard') searchInput.placeholder = 'Search tickets...';
        else if (section === 'staff') searchInput.placeholder = 'Search staff...';
        else if (section === 'customers') searchInput.placeholder = 'Search customers...';
        else if (section === 'performance') searchInput.placeholder = 'Search agents...';
        else searchInput.placeholder = 'Search...';
    }

    if (section === 'dashboard') { 
        window.loadTickets(1); 
        window.updateDashboardStatsSummary(); 
    }
    if (section === 'staff') window.loadStaff();
    if (section === 'customers') window.loadCustomers();
    if (section === 'performance') window.loadAgentPerformance();
};

window.filterByStat = function(type, value) {
    const statusSelect = document.getElementById('filter-status');
    const assignmentSelect = document.getElementById('filter-assignment');
    const isAgent = window.currentUser && window.currentUser.role === 'AGENT';

    if (type === 'status') {
        if (statusSelect) statusSelect.value = value;
        if (isAgent && assignmentSelect.value !== 'unassigned') {
            assignmentSelect.value = 'me';
        }
    } else if (type === 'assignment') {
        if (assignmentSelect) assignmentSelect.value = value;
        if (statusSelect) statusSelect.value = ''; // Reset status
    } else if (type === 'all') {
        if (statusSelect) statusSelect.value = '';
        if (assignmentSelect) {
            assignmentSelect.value = isAgent ? 'me' : 'all';
        }
    }

    window.loadTickets(1);
    
    const table = document.querySelector('.table-container');
    if (table) table.scrollIntoView({ behavior: 'smooth' });
};

window.updateDashboardStatsSummary = async function() {
    try {
        const statsGrid = document.getElementById('stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card clickable"><div class="stat-info"><h3>Loading...</h3><div class="skeleton-text" style="width: 50px; height: 30px;"></div></div></div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--primary);"><div class="stat-info"><h3>Open</h3><div class="skeleton-text" style="width: 50px; height: 30px;"></div></div></div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--warning);"><div class="stat-info"><h3>In Progress</h3><div class="skeleton-text" style="width: 50px; height: 30px;"></div></div></div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--success);"><div class="stat-info"><h3>Resolved</h3><div class="skeleton-text" style="width: 50px; height: 30px;"></div></div></div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--danger);"><div class="stat-info"><h3>Unassigned</h3><div class="skeleton-text" style="width: 50px; height: 30px;"></div></div></div>
            `;
        }

        const res = await window.apiFetch('/dashboard/stats');
        const d = await res.json();
        if (d.success) {
            const s = d.data.tickets;
            const isAgent = window.currentUser && window.currentUser.role === 'AGENT';

            let statsHTML = `
                <div class="stat-card clickable" onclick="window.filterByStat('all')">
                    <div class="stat-info">
                        <h3>${isAgent ? 'My Tickets' : 'Total Tickets'}</h3>
                        <p>${s.total}</p>
                    </div>
                    <i class="fas fa-ticket-alt"></i>
                </div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--primary);" onclick="window.filterByStat('status', 'OPEN')">
                    <div class="stat-info"><h3>Open</h3><p>${s.open}</p></div>
                    <i class="fas fa-envelope-open"></i>
                </div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--warning);" onclick="window.filterByStat('status', 'IN_PROGRESS')">
                    <div class="stat-info"><h3>In Progress</h3><p>${s.inProgress}</p></div>
                    <i class="fas fa-spinner"></i>
                </div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--success);" onclick="window.filterByStat('status', 'RESOLVED')">
                    <div class="stat-info"><h3>Resolved</h3><p>${s.resolved}</p></div>
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-card clickable" style="border-bottom: 4px solid var(--danger);" onclick="window.filterByStat('assignment', 'unassigned')">
                    <div class="stat-info"><h3>Unassigned</h3><p>${s.unassigned || 0}</p></div>
                    <i class="fas fa-user-slash"></i>
                </div>
            `;
            
            if (statsGrid) statsGrid.innerHTML = statsHTML;
        }
    } catch (e) {}
};

window.loadAgentPerformance = async function() {
    try {
        const searchInput = document.getElementById('search-input');
        const query = searchInput ? searchInput.value : '';

        const body = document.getElementById('performance-body');
        if (body) {
            body.innerHTML = Array(3).fill(`
                <tr>
                    <td><div style="display:flex; align-items:center; gap:12px;"><div class="skeleton-circle" style="width: 32px; height: 32px; border-radius: 50%;"></div><div class="skeleton-text" style="width: 120px;"></div></div></td>
                    <td><div class="skeleton-badge" style="width: 50px;"></div></td>
                    <td><div class="skeleton-badge" style="width: 50px;"></div></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="flex:1;"><div class="skeleton-box" style="height: 8px; border-radius: 10px;"></div></div>
                            <div class="skeleton-text" style="width: 40px;"></div>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        const res = await window.apiFetch(`/dashboard/agent-performance?search=${encodeURIComponent(query)}`);
        const d = await res.json();
        if (body) {
            body.innerHTML = d.data.map(a => `
                <tr>
                    <td data-label="Agent">
                        <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="window.viewAgentTickets('${a.id}', '${a.name}')">
                            <img src="${a.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name) + '&background=random'}" style="width:32px; height:32px; border-radius:50%; box-shadow:var(--nm-convex-small);">
                            <strong style="color:var(--primary);">${a.name}</strong>
                            <i class="fas fa-external-link-alt" style="font-size:0.7rem; opacity:0.5;"></i>
                        </div>
                    </td>
                    <td data-label="Assigned"><span class="badge" style="background: rgba(79, 70, 229, 0.1); color: var(--primary); box-shadow:none;">${a.totalAssigned}</span></td>
                    <td data-label="Resolved"><span class="badge" style="background: rgba(34, 197, 94, 0.1); color: var(--success); box-shadow:none;">${a.resolved}</span></td>
                    <td data-label="Resolution Rate">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="flex:1; height:8px; background:rgba(0,0,0,0.05); border-radius:10px; overflow:hidden; box-shadow: inset 1px 1px 2px rgba(0,0,0,0.1);">
                                <div style="width:${a.resolutionRate}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--success));"></div>
                            </div>
                            <span style="font-weight:800; font-size: 0.9rem;">${a.resolutionRate}%</span>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {}
};

window.viewAgentTickets = function(agentId, agentName) {
    window.selectedAgentFilter = { id: agentId, name: agentName };
    window.showSection('dashboard');
};

window.renderProfileUI = function() {
    if (!window.currentUser) return;
    
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) {
        document.getElementById('auth-page').style.display = 'none';
        dashboardPage.style.display = 'flex';
    }
    
    document.getElementById('user-display-name').innerText = window.currentUser.name;
    document.getElementById('user-avatar').src = window.currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(window.currentUser.name);
    
    window.initSidebar();

    const isStaff = window.currentUser.role !== 'USER';
    const isAdmin = window.currentUser.role === 'ADMIN';
    const isAgent = window.currentUser.role === 'AGENT';
    
    document.getElementById('nav-staff').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('nav-customers').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('nav-performance').style.display = isAdmin ? 'block' : 'none';
    
    const assignmentGroup = document.getElementById('filter-assignment-group');
    if (assignmentGroup) {
        assignmentGroup.style.display = isStaff ? 'flex' : 'none';
        
        const optAssignedMe = document.getElementById('opt-assigned-me');
        if (optAssignedMe) {
            optAssignedMe.style.display = isAdmin ? 'none' : 'block';
        }

        const optAll = document.querySelector('#filter-assignment option[value="all"]');
        if (optAll) {
            optAll.style.display = isAgent ? 'none' : 'block';
        }

        if (isAgent) {
            document.getElementById('filter-assignment').value = 'me';
        } else {
            document.getElementById('filter-assignment').value = 'all';
        }
    }

    const thSelectAll = document.getElementById('th-select-all');
    if (thSelectAll) {
        thSelectAll.style.display = isAdmin ? 'table-cell' : 'none';
    }

    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) roleBadge.innerText = window.currentUser.role;

    document.getElementById('btn-create-ticket-main').style.display = isAdmin ? 'inline-flex' : 'none';
};
