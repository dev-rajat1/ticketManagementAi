/**
 * Authentication and Profile Management
 */

window.logout = function() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
};

window.handleLogin = async function(event) {
    if(event) event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await window.apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        const d = await res.json();
        
        if (d.success) {
            localStorage.setItem('token', d.data.accessToken);
            await window.initApp();
            window.showToast('Welcome Back!');
        } else {
            window.showToast(d.message || 'Login failed', 'error');
        }
    } catch (err) {
        window.showToast('Server error', 'error');
    }
};

window.openProfileModal = function() {
    if (!window.currentUser) return;
    document.getElementById('p-name').value = window.currentUser.name;
    document.getElementById('p-email').value = window.currentUser.email;
    document.getElementById('p-avatar').value = window.currentUser.avatarUrl || '';
    document.getElementById('p-phone').value = window.currentUser.phoneNumber || '';
    document.getElementById('p-address').value = window.currentUser.address || '';
    
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

window.updateProfile = async function(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('p-name').value,
        avatarUrl: document.getElementById('p-avatar').value,
        phoneNumber: document.getElementById('p-phone').value,
        address: document.getElementById('p-address').value
    };
    
    try {
        const res = await window.apiFetch('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const d = await res.json();
        if (d.success) {
            window.currentUser = d.data.user;
            window.renderProfileUI();
            window.showToast('Profile updated successfully');
            document.getElementById('profile-modal').style.display = 'none';
        } else {
            window.showToast(d.message, 'error');
        }
    } catch (err) {
        window.showToast('Update failed', 'error');
    }
};

window.changePassword = async function(e) {
    e.preventDefault();
    const oldPassword = document.getElementById('p-old-password').value;
    const newPassword = document.getElementById('p-new-password').value;
    const confirmPassword = document.getElementById('p-confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        return window.showToast('Passwords do not match', 'error');
    }
    
    try {
        const res = await window.apiFetch('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const d = await res.json();
        if (d.success) {
            window.showToast('Password changed successfully');
            document.getElementById('password-form').reset();
            document.getElementById('profile-modal').style.display = 'none';
        } else {
            window.showToast(d.message, 'error');
        }
    } catch (err) {
        window.showToast('Update failed', 'error');
    }
};
