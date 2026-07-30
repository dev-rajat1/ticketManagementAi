/**
 * User Management (Staff & Customers)
 */

window.loadStaff = async function() {
    try {
        const searchInput = document.getElementById('search-input');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        const body = document.getElementById('staff-body');
        if (body) {
            body.innerHTML = Array(4).fill(`
                <tr>
                    <td data-label="Select"><div class="skeleton-box" style="width: 20px; height: 20px;"></div></td>
                    <td data-label="Name"><div class="skeleton-text" style="width: 120px;"></div></td>
                    <td data-label="Email"><div class="skeleton-text" style="width: 180px;"></div></td>
                    <td data-label="Role"><div class="skeleton-badge" style="width: 70px;"></div></td>
                    <td data-label="Status"><div class="skeleton-badge" style="width: 70px;"></div></td>
                </tr>
            `).join('');
        }

        const res = await window.apiFetch('/users');
        const d = await res.json();
        let staff = d.data.filter(u => u.role !== 'USER');
        
        if (search) {
            staff = staff.filter(u => 
                u.name.toLowerCase().includes(search) || 
                u.email.toLowerCase().includes(search)
            );
        }
        
        if (!body) return;

        body.innerHTML = staff.map(u => `
            <tr onclick="if(event.target.tagName !== 'INPUT') window.openUserModal('staff','${u.id}')" style="cursor: pointer;">
                <td data-label="Select" onclick="event.stopPropagation()">${u.role !== 'ADMIN' ? `<input type="checkbox" class="staff-checkbox" value="${u.id}" onclick="window.updateBulkActionsVisibility('staff')">` : ''}</td>
                <td data-label="Name"><div style="padding: 5px 0;"><strong>${u.name}</strong></div></td>
                <td data-label="Email"><span class="text-muted">${u.email}</span></td>
                <td data-label="Role"><span class="badge" style="background: rgba(79, 70, 229, 0.05); color: var(--primary); box-shadow:none; border: 1px solid rgba(79, 70, 229, 0.1);">${u.role}</span></td>
                <td data-label="Status"><span class="badge ${u.isActive ? 'status-RESOLVED' : 'status-CLOSED'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No staff members found.</td></tr>';
        
        const selectAll = document.getElementById('select-all-staff');
        if (selectAll) selectAll.checked = false;
        window.updateBulkActionsVisibility('staff');
    } catch (e) {}
};

window.loadCustomers = async function() {
    try {
        const searchInput = document.getElementById('search-input');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        const body = document.getElementById('customers-body');
        if (body) {
            body.innerHTML = Array(4).fill(`
                <tr>
                    <td data-label="Select"><div class="skeleton-box" style="width: 20px; height: 20px;"></div></td>
                    <td data-label="Name"><div class="skeleton-text" style="width: 120px;"></div></td>
                    <td data-label="Email"><div class="skeleton-text" style="width: 180px;"></div></td>
                    <td data-label="Phone"><div class="skeleton-text" style="width: 100px;"></div></td>
                    <td data-label="Status"><div class="skeleton-badge" style="width: 70px;"></div></td>
                </tr>
            `).join('');
        }

        const res = await window.apiFetch('/users');
        const d = await res.json();
        let cust = d.data.filter(u => u.role === 'USER');
        
        if (search) {
            cust = cust.filter(u => 
                u.name.toLowerCase().includes(search) || 
                u.email.toLowerCase().includes(search) ||
                (u.phoneNumber && u.phoneNumber.toLowerCase().includes(search))
            );
        }
        
        if (!body) return;

        body.innerHTML = cust.map(u => `
            <tr onclick="if(event.target.tagName !== 'INPUT') window.openUserModal('customer','${u.id}')" style="cursor: pointer;">
                <td data-label="Select" onclick="event.stopPropagation()"><input type="checkbox" class="customer-checkbox" value="${u.id}" onclick="window.updateBulkActionsVisibility('customers')"></td>
                <td data-label="Name"><div style="padding: 5px 0;"><strong>${u.name}</strong></div></td>
                <td data-label="Email"><span class="text-muted">${u.email}</span></td>
                <td data-label="Phone"><span class="text-muted">${u.phoneNumber || 'N/A'}</span></td>
                <td data-label="Status"><span class="badge ${u.isActive ? 'status-RESOLVED' : 'status-CLOSED'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No customers found.</td></tr>';
        
        const selectAll = document.getElementById('select-all-customers');
        if (selectAll) selectAll.checked = false;
        window.updateBulkActionsVisibility('customers');
    } catch (e) {}
};

window.openUserModal = function(type, userId = null) {
    const form = document.getElementById('user-form');
    if (form) form.reset();
    const uIdField = document.getElementById('u-id');
    if (uIdField) uIdField.value = '';
    const isStaff = type === 'staff';
    const title = document.getElementById('user-modal-title');
    if (title) title.innerText = userId ? (isStaff ? 'Edit Staff' : 'Edit Customer') : (isStaff ? 'Add Staff' : 'Add Customer');
    
    const roleGroup = document.getElementById('role-group');
    if (roleGroup) roleGroup.style.display = isStaff ? 'block' : 'none';
    const passGroup = document.getElementById('password-group');
    if (passGroup) passGroup.style.display = isStaff ? 'block' : 'none';
    const uRoleField = document.getElementById('u-role');
    if (uRoleField) uRoleField.value = isStaff ? 'AGENT' : 'USER';

    if (userId) {
        window.apiFetch(`/users/${userId}`)
            .then(res => res.json()).then(d => {
                if (uIdField) uIdField.value = d.data.id;
                const uNameField = document.getElementById('u-name');
                if (uNameField) uNameField.value = d.data.name;
                const uEmailField = document.getElementById('u-email');
                if (uEmailField) uEmailField.value = d.data.email;
                const uPhoneField = document.getElementById('u-phone');
                if (uPhoneField) uPhoneField.value = d.data.phoneNumber || '';
                const uAddressField = document.getElementById('u-address');
                if (uAddressField) uAddressField.value = d.data.address || '';
                if (uRoleField) uRoleField.value = d.data.role;
                const uActiveField = document.getElementById('u-active');
                if (uActiveField) uActiveField.value = d.data.isActive ? "true" : "false";
                
                if (roleGroup) roleGroup.style.display = d.data.role !== 'USER' ? 'block' : 'none';
                if (passGroup) passGroup.style.display = d.data.role !== 'USER' ? 'block' : 'none';
            });
    }
    const userModal = document.getElementById('user-modal');
    if (userModal) userModal.style.display = 'flex';
};

window.closeUserModal = function() {
    const userModal = document.getElementById('user-modal');
    if (userModal) userModal.style.display = 'none';
};

window.submitUserForm = async function(e) {
    e.preventDefault();
    const id = document.getElementById('u-id').value;
    const role = document.getElementById('u-role').value;
    
    const data = {
        name: document.getElementById('u-name').value,
        email: document.getElementById('u-email').value,
        phoneNumber: document.getElementById('u-phone').value,
        address: document.getElementById('u-address').value,
        role: role,
        isActive: document.getElementById('u-active').value === 'true'
    };
    
    const passField = document.getElementById('u-password');
    const pass = passField ? passField.value : '';
    if (pass) data.password = pass;

    let endpoint = id ? `/users/${id}` : `/users`;
    if (!id && role === 'USER') {
        endpoint = `/users/customers`;
    }

    try {
        const res = await window.apiFetch(endpoint, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(data)
        });
        if (res.ok) {
            window.showToast('Saved');
            window.closeUserModal();
            if (role === 'USER') window.loadCustomers(); else window.loadStaff();
        } else {
            const err = await res.json();
            window.showToast(err.message, 'error');
        }
    } catch (e) { window.showToast('Error saving', 'error'); }
};

window.deleteUser = async function(id, type) {
    if (!confirm('Permanently delete this member?')) return;
    try {
        const res = await window.apiFetch(`/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            window.showToast('Deleted');
            if (type === 'staff') window.loadStaff(); else window.loadCustomers();
        } else {
            const err = await res.json();
            window.showToast(err.message || 'Failed to delete', 'error');
        }
    } catch (e) { window.showToast('Network error', 'error'); }
};

window.bulkDeleteUsers = async function(type) {
    const className = type === 'staff' ? 'staff-checkbox' : 'customer-checkbox';
    const selected = Array.from(document.querySelectorAll(`.${className}:checked`)).map(cb => cb.value);
    if (selected.length === 0 || !confirm(`Delete ${selected.length} members permanently?`)) return;

    try {
        const res = await window.apiFetch('/users/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ userIds: selected })
        });
        if (res.ok) {
            window.showToast('Members deleted');
            if (type === 'staff') window.loadStaff(); else window.loadCustomers();
        } else {
            const err = await res.json();
            window.showToast(err.message || 'Bulk delete failed', 'error');
        }
    } catch (e) { window.showToast('Error', 'error'); }
};
