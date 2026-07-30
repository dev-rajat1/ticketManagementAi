/**
 * App Initialization and Event Listeners
 */

window.initApp = async function() {
    // Initialize Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.updateThemeIcon(savedTheme);

    const token = localStorage.getItem('token');
    if (!token) {
        document.getElementById('auth-page').style.display = 'flex';
        document.getElementById('dashboard-page').style.display = 'none';
        return;
    }

    try {
        const res = await window.apiFetch('/auth/me');
        const data = await res.json();
        if(data.success) {
            window.currentUser = data.data.user;
            window.renderProfileUI();
            window.showSection('dashboard');
        } else { 
            window.logout(); 
        }
    } catch (e) { 
        window.logout(); 
    }
};

window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    window.updateThemeIcon(newTheme);
};

window.updateThemeIcon = function(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.initApp();

    // Theme Toggle Listener
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.onclick = window.toggleTheme;

    // Global Event Listeners
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = window.handleLogin;

    const createTicketForm = document.getElementById('create-ticket-form');
    if (createTicketForm) createTicketForm.onsubmit = window.submitCreateTicket;

    const userForm = document.getElementById('user-form');
    if (userForm) userForm.onsubmit = window.submitUserForm;

    const profileForm = document.getElementById('profile-form');
    if (profileForm) profileForm.onsubmit = window.updateProfile;

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) passwordForm.onsubmit = window.changePassword;

    const addCommentForm = document.getElementById('add-comment-form');
    if (addCommentForm) addCommentForm.onsubmit = window.submitComment;

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(window.searchTimer);
            window.searchTimer = setTimeout(() => {
                const section = window.currentSection || 'dashboard';
                if (section === 'dashboard') window.loadTickets(1);
                else if (section === 'staff') window.loadStaff();
                else if (section === 'customers') window.loadCustomers();
                else if (section === 'performance') window.loadAgentPerformance();
            }, 500);
        });
    }

    // Attachment Upload
    const uploadForm = document.getElementById('upload-attachment-form');
    if (uploadForm) {
        uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('attach-file');
            if (!fileInput.files[0]) return window.showToast('Please select a file', 'error');

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const res = await fetch(`${API_URL}/tickets/${window.currentTicketId}/attachments`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: formData
                });
                if (res.ok) {
                    window.showToast('File uploaded');
                    fileInput.value = '';
                    document.getElementById('file-name-display').innerText = 'No file selected';
                    const clearBtn = document.getElementById('clear-attach-file');
                    if (clearBtn) clearBtn.style.display = 'none';
                    // Refresh attachments
                    const d = await window.apiFetch(`/tickets/${window.currentTicketId}`);
                    const ticket = await d.json();
                    window.renderAttachments(ticket.data.attachments);
                }
            } catch (err) { window.showToast('Upload failed', 'error'); }
        };
    }

    const fileInput = document.getElementById('attach-file');
    if (fileInput) {
        fileInput.onchange = (e) => {
            const fileName = e.target.files[0]?.name || 'No file selected';
            document.getElementById('file-name-display').innerText = fileName;
            
            const clearBtn = document.getElementById('clear-attach-file');
            if (e.target.files[0]) {
                clearBtn.style.display = 'inline-flex';
            } else {
                clearBtn.style.display = 'none';
            }
        };
    }
    
    // Global clear function for the inline onclick handler
    window.clearAttachmentSelection = function() {
        const fileInp = document.getElementById('attach-file');
        if (fileInp) fileInp.value = '';
        document.getElementById('file-name-display').innerText = 'No file selected';
        document.getElementById('clear-attach-file').style.display = 'none';
    };
});
