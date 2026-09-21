/**
 * Tickets Management Logic
 */

window.loadTickets = async function(page = 1) {
    window.currentPage = page;
    
    // Get values safely
    const statusEl = document.getElementById('filter-status');
    const priorityEl = document.getElementById('filter-priority');
    const categoryEl = document.getElementById('filter-category');
    const assignmentEl = document.getElementById('filter-assignment');
    const searchEl = document.getElementById('search-input');

    const status = statusEl ? statusEl.value : '';
    const priority = priorityEl ? priorityEl.value : '';
    const category = categoryEl ? categoryEl.value : '';
    const assignment = assignmentEl ? assignmentEl.value : 'all';
    const search = searchEl ? searchEl.value : '';

    let endpoint = `/tickets?page=${page}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (status) endpoint += `&status=${status}`;
    if (priority) endpoint += `&priority=${priority}`;
    if (category) endpoint += `&category=${category}`;

    // Handle Agent Specific Filter from Performance Dashboard
    if (window.selectedAgentFilter && window.selectedAgentFilter.id) {
        endpoint += `&assignedToId=${window.selectedAgentFilter.id}`;
        
        // Show Agent filter badge in UI
        const clearBtn = document.getElementById('btn-clear-tickets');
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
            clearBtn.innerHTML = `<i class="fas fa-user-tie" style="margin-right:8px;"></i> Agent: ${window.selectedAgentFilter.name} <i class="fas fa-times" style="margin-left:8px;"></i>`;
        }
    } else {
        if (window.currentUser) {
            if (assignment === 'me') endpoint += `&assignedToId=${window.currentUser.id}`;
            else if (assignment === 'unassigned') endpoint += `&assignedToId=null`;
        }
    }

    const body = document.getElementById('tickets-body');
    if (body) {
        body.innerHTML = Array(5).fill(`
            <tr>
                <td><div class="skeleton-box" style="width: 20px; height: 20px;"></div></td>
                <td><div class="skeleton-badge" style="width: 60px;"></div></td>
                <td><div class="skeleton-text" style="width: 80%; height: 20px;"></div></td>
                <td><div class="skeleton-text" style="width: 100px;"></div></td>
                <td><div class="skeleton-badge" style="width: 70px;"></div></td>
                <td><div class="skeleton-badge" style="width: 60px;"></div></td>
                <td><div class="skeleton-text" style="width: 80px;"></div></td>
                <td><div class="skeleton-text" style="width: 80px;"></div></td>
            </tr>
        `).join('');
    }

    try {
        const res = await window.apiFetch(endpoint);
        const data = await res.json();
        if (data.success) {
            window.renderTicketsTable(data.data);
            if (data.meta) {
                window.totalPages = data.meta.totalPages || 1;
                window.updatePaginationUI(data.meta);
            }
        } else {
            console.error('API Error:', data.message);
            window.renderTicketsTable([]);
        }
    } catch (err) {
        console.error('Fetch error:', err);
        window.showToast('Error loading tickets', 'error');
    }
};

window.renderTicketsTable = function(tickets) {
    const body = document.getElementById('tickets-body');
    if (!body) return;
    
    if (!tickets || tickets.length === 0) {
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 3rem; color: var(--text-muted);">No tickets found matching your criteria.</td></tr>';
        return;
    }

    body.innerHTML = tickets.map(t => `
        <tr class="priority-${(t.priority || 'medium').toLowerCase()} ticket-row" 
            onclick="window.openDetailModal('${t.id}')" 
            data-id="${t.id}">
            <td data-label="Select"><input type="checkbox" class="ticket-checkbox" value="${t.id}" onclick="event.stopPropagation(); window.updateBulkActionsVisibility('tickets')"></td>
            <td data-label="ID"><span class="ticket-id-badge-small">${t.ticketNumber}</span></td>
            <td data-label="Subject"><div class="ticket-subject-cell"><strong>${t.subject}</strong></div></td>
            <td data-label="Sender"><span class="sender-name">${t.createdBy?.name || 'Email User'}</span></td>
            <td data-label="Status"><span class="badge status-${t.status}">${t.status}</span></td>
            <td data-label="Priority"><span class="p-badge p-${t.priority}">${t.priority}</span></td>
            <td data-label="Category"><span class="category-tag">${t.category || 'General'}</span></td>
            <td data-label="Created"><small class="text-muted">${window.formatDate(t.createdAt)}</small></td>
        </tr>
    `).join('');
    
    const selectAll = document.getElementById('select-all-tickets');
    if (selectAll) selectAll.checked = false;
    window.updateBulkActionsVisibility('tickets');
};

window.clearSelection = function(type) {
    if (type === 'tickets' && window.selectedAgentFilter) {
        window.selectedAgentFilter = null;
        const clearBtn = document.getElementById('btn-clear-tickets');
        if (clearBtn) {
            clearBtn.innerHTML = '<i class="fas fa-times"></i> Clear';
            const selected = document.querySelectorAll('.ticket-checkbox:checked');
            if (selected.length === 0) clearBtn.style.display = 'none';
        }
        window.loadTickets(1);
        return;
    }

    const selectAllCheckbox = document.getElementById(`select-all-${type}`);
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    const className = type === 'tickets' ? 'ticket-checkbox' : (type === 'staff' ? 'staff-checkbox' : 'customer-checkbox');
    const checkboxes = document.querySelectorAll(`.${className}`);
    checkboxes.forEach(cb => {
        cb.checked = false;
        if (type === 'tickets') {
            cb.closest('tr').classList.remove('selected-row');
        }
    });
    window.updateBulkActionsVisibility(type);
};

window.changePage = function(delta) {
    const newPage = (window.currentPage || 1) + delta;
    if (newPage >= 1 && newPage <= (window.totalPages || 1)) {
        window.loadTickets(newPage);
    }
};

window.openDetailModal = async function(id) {
    window.currentTicketId = id;
    window.tempChanges = {};

    // Skeleton for Modal
    document.getElementById('d-subject').innerHTML = '<div class="skeleton-text" style="width: 60%; height: 2rem;"></div>';
    document.getElementById('d-ticket-num').innerHTML = '<div class="skeleton-badge" style="width: 100px;"></div>';
    document.getElementById('d-description').innerHTML = '<div class="skeleton-box" style="height: 100px;"></div>';
    document.getElementById('d-status').innerHTML = '';
    document.getElementById('d-creator').innerHTML = '<div class="skeleton-text" style="width: 150px;"></div>';
    document.getElementById('ai-summary-box').style.display = 'none';
    const callRecBoxSkeleton = document.getElementById('call-recording-box');
    if (callRecBoxSkeleton) callRecBoxSkeleton.style.display = 'none';

    // Show modal immediately so user sees the skeleton loading state
    document.getElementById('detail-modal').style.display = 'flex';

    try {
        const res = await window.apiFetch(`/tickets/${id}`);
        const d = await res.json();
        const t = d.data;

        document.getElementById('d-subject').innerText = t.subject;
        document.getElementById('d-ticket-num').innerText = t.ticketNumber;
        document.getElementById('d-description').innerText = t.description;
        document.getElementById('d-status').innerText = t.status;
        document.getElementById('d-status').className = `badge status-${t.status}`;
        document.getElementById('d-creator').innerText = t.createdBy?.name || 'Email User';

        // Check for Call Recording Audio attachment
        const callRecBox = document.getElementById('call-recording-box');
        const callRecPlayer = document.getElementById('call-recording-player');
        if (callRecBox && callRecPlayer) {
            const audioAtt = t.attachments?.find(att => 
                (att.mimeType && att.mimeType.startsWith('audio/')) || 
                /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(att.filename || '')
            );
            if (audioAtt) {
                const baseHost = (window.ENV_BACKEND_URL || 'https://ticketmanagementai.onrender.com').replace(/\/$/, '');
                callRecPlayer.src = audioAtt.fileUrl.startsWith('http') ? audioAtt.fileUrl : `${baseHost}${audioAtt.fileUrl}`;
                callRecBox.style.display = 'block';
            } else {
                callRecBox.style.display = 'none';
                callRecPlayer.src = '';
            }
        }

        const aiSummaryBox = document.getElementById('ai-summary-box');
        aiSummaryBox.style.display = 'block';
        if (t.aiSummary) {
            document.getElementById('d-ai-summary').innerText = t.aiSummary;
            document.getElementById('btn-ai-summary-text').innerText = 'Regenerate Analysis';
        } else {
            document.getElementById('d-ai-summary').innerText = 'Click "Generate Analysis" to create an AI-powered summary and extract sentiment.';
            document.getElementById('btn-ai-summary-text').innerText = 'Generate Analysis';
        }
        
        document.getElementById('d-ai-sentiment').innerText = t.aiSentiment || 'Analyzing...';
        
        const sentimentEl = document.getElementById('d-ai-sentiment');
        sentimentEl.className = 'badge';
        if(t.aiSentiment === 'NEGATIVE' || t.aiSentiment === 'frustrated' || t.aiSentiment === 'angry') sentimentEl.classList.add('status-CLOSED'); 
        else if(t.aiSentiment === 'POSITIVE' || t.aiSentiment === 'positive') sentimentEl.classList.add('status-RESOLVED');
        else sentimentEl.classList.add('status-IN_PROGRESS');


        const isStaff = window.currentUser.role !== 'USER';
        document.getElementById('admin-actions').style.display = isStaff ? 'block' : 'none';
        document.getElementById('btn-save-ticket').style.display = 'none';
        document.getElementById('btn-done-ticket').style.display = 'inline-block';

        if (isStaff) {
            document.getElementById('update-status').value = t.status;
            document.getElementById('update-status').onchange = (e) => trackChange('status', e.target.value);
            
            if (window.currentUser.role === 'ADMIN') {
                await loadAgentsList(t.assignedToId);
                document.getElementById('update-assignee').onchange = (e) => trackChange('assignedToId', e.target.value || null);
            }
        }

        renderComments(t.comments);
        renderAttachments(t.attachments);
        window.switchDetailTab('comments');
    } catch (e) {
        window.showToast('Load error', 'error');
    }
};

function trackChange(field, value) {
    window.tempChanges[field] = value;
    document.getElementById('btn-save-ticket').style.display = 'inline-block';
    document.getElementById('btn-done-ticket').style.display = 'none';
}

window.saveTicketChanges = async function() {
    try {
        await window.apiFetch(`/tickets/${window.currentTicketId}`, {
            method: 'PUT',
            body: JSON.stringify(window.tempChanges)
        });
        window.showToast('Changes saved');
        window.tempChanges = {};
        window.openDetailModal(window.currentTicketId);
        window.loadTickets(window.currentPage);
    } catch (e) {
        window.showToast('Save failed', 'error');
    }
};

window.closeDetailModal = function() {
    document.getElementById('detail-modal').style.display = 'none';
};

window.submitComment = async function(e) {
    e.preventDefault();
    const content = document.getElementById('c-text').value;
    if (!content) return;

    try {
        const res = await window.apiFetch(`/tickets/${window.currentTicketId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            document.getElementById('c-text').value = '';
            document.getElementById('ai-suggestion-box').style.display = 'none';
            const d = await window.apiFetch(`/tickets/${window.currentTicketId}`);
            const ticket = await d.json();
            renderComments(ticket.data.comments);
            window.showToast('Reply sent');
        }
    } catch (err) {
        window.showToast('Failed to send reply', 'error');
    }
};

window.getAiSuggestion = async function() {
    const btn = document.querySelector('button[onclick="window.getAiSuggestion()"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';

    try {
        const res = await window.apiFetch(`/tickets/${window.currentTicketId}/ai-suggest`);
        const d = await res.json();
        if (d.success && d.data && d.data.length > 0) {
            document.getElementById('ai-suggestion-box').style.display = 'block';
            document.getElementById('ai-suggested-text').innerText = d.data[0].response;
            window.showToast('AI suggestion ready!');
        } else {
            window.showToast('Could not generate suggestion', 'warning');
        }
    } catch (e) {
        window.showToast('AI unavailable', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> AI Assist';
};

window.useAiReply = function() {
    document.getElementById('c-text').value = document.getElementById('ai-suggested-text').innerText;
    document.getElementById('ai-suggestion-box').style.display = 'none';
};

window.regenerateAiSummary = async function() {
    const btnText = document.getElementById('btn-ai-summary-text');
    const btnIcon = document.getElementById('btn-ai-summary-icon');
    const btnSpinner = document.getElementById('btn-ai-summary-spinner');
    const btn = document.getElementById('btn-ai-summary');

    btn.disabled = true;
    btnText.innerText = 'Analyzing...';
    btnIcon.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    try {
        const res = await window.apiFetch(`/tickets/${window.currentTicketId}/ai-summary`);
        const d = await res.json();
        if (d.success) {
            document.getElementById('d-ai-summary').innerText = d.data.summary;
            window.showToast('AI Summary generated successfully');
            btnText.innerText = 'Regenerate Analysis';
        } else {
            window.showToast('AI failed: ' + (d.message || ''), 'error');
            btnText.innerText = 'Generate Analysis';
        }
    } catch (e) {
        window.showToast('Network error while analyzing', 'error');
        btnText.innerText = 'Generate Analysis';
    } finally {
        btn.disabled = false;
        btnIcon.style.display = 'inline-block';
        btnSpinner.style.display = 'none';
    }
};

let cachedCustomersList = [];
let isCustomCustomerMode = false;

window.openCreateTicketModal = async function() {
    try {
        const custRes = await window.apiFetch('/users?role=USER');
        const custData = await custRes.json();
        cachedCustomersList = (custData && custData.data) || [];
        
        const customerSelect = document.getElementById('t-customer');
        if (customerSelect) {
            if (cachedCustomersList.length > 0) {
                customerSelect.innerHTML = cachedCustomersList.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');
            } else {
                customerSelect.innerHTML = '<option value="">-- No existing customers found --</option>';
            }
        }

        const agentRes = await window.apiFetch('/users?role=AGENT');
        const agentData = await agentRes.json();
        const assigneeSelect = document.getElementById('t-assignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">-- Unassigned --</option>' + ((agentData && agentData.data) || []).map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }

        document.getElementById('create-ticket-form').reset();
        
        // Reset customer mode to default dropdown
        isCustomCustomerMode = false;
        const selectMode = document.getElementById('customer-select-mode');
        const customMode = document.getElementById('customer-custom-mode');
        const btnToggle = document.getElementById('btn-toggle-customer-mode');
        if (selectMode) selectMode.style.display = 'block';
        if (customMode) customMode.style.display = 'none';
        if (btnToggle) btnToggle.innerHTML = '<i class="fas fa-edit"></i> Type Custom Email / Edit';

        document.getElementById('create-ticket-modal').style.display = 'flex';
    } catch (e) {
        console.error('Failed to load users:', e);
        window.showToast('Failed to load users', 'error');
    }
};

window.toggleCustomerMode = function() {
    isCustomCustomerMode = !isCustomCustomerMode;
    const selectMode = document.getElementById('customer-select-mode');
    const customMode = document.getElementById('customer-custom-mode');
    const btnToggle = document.getElementById('btn-toggle-customer-mode');
    const selectEl = document.getElementById('t-customer');
    const nameInput = document.getElementById('t-custom-name');
    const emailInput = document.getElementById('t-custom-email');

    if (isCustomCustomerMode) {
        if (selectMode) selectMode.style.display = 'none';
        if (customMode) customMode.style.display = 'block';
        if (btnToggle) btnToggle.innerHTML = '<i class="fas fa-list"></i> Select from Dropdown';

        // Pre-fill fields from currently selected dropdown item for convenience
        if (selectEl && selectEl.value && cachedCustomersList.length > 0) {
            const found = cachedCustomersList.find(c => c.id === selectEl.value);
            if (found && (!emailInput.value || emailInput.value === '')) {
                if (nameInput) nameInput.value = found.name || '';
                if (emailInput) emailInput.value = found.email || '';
            }
        }
        if (emailInput) emailInput.focus();
    } else {
        if (selectMode) selectMode.style.display = 'block';
        if (customMode) customMode.style.display = 'none';
        if (btnToggle) btnToggle.innerHTML = '<i class="fas fa-edit"></i> Type Custom Email / Edit';
    }
};

window.handleCustomerDropdownChange = function(selectEl) {
    if (!selectEl) return;
    const found = cachedCustomersList.find(c => c.id === selectEl.value);
    if (found) {
        const nameInput = document.getElementById('t-custom-name');
        const emailInput = document.getElementById('t-custom-email');
        if (nameInput) nameInput.value = found.name || '';
        if (emailInput) emailInput.value = found.email || '';
    }
};

window.closeCreateTicketModal = function() {
    document.getElementById('create-ticket-modal').style.display = 'none';
};

window.submitCreateTicket = async function(e) {
    if (e) e.preventDefault();
    const subject = document.getElementById('t-subject')?.value?.trim();
    const description = document.getElementById('t-description')?.value?.trim();
    const priority = document.getElementById('t-priority')?.value || 'MEDIUM';
    const category = document.getElementById('t-category')?.value || 'General';
    const assignedToId = document.getElementById('t-assignee')?.value || null;

    if (!subject) {
        window.showToast('Please enter ticket subject', 'warning');
        return;
    }
    if (!description) {
        window.showToast('Please enter ticket description', 'warning');
        return;
    }

    const data = {
        subject,
        description,
        priority,
        category,
        assignedToId
    };

    if (isCustomCustomerMode) {
        const customEmail = document.getElementById('t-custom-email')?.value?.trim();
        const customName = document.getElementById('t-custom-name')?.value?.trim();
        if (!customEmail) {
            window.showToast('Please provide a customer email', 'warning');
            document.getElementById('t-custom-email')?.focus();
            return;
        }
        data.customerEmail = customEmail;
        data.customerName = customName;
    } else {
        const custSelect = document.getElementById('t-customer');
        if (custSelect && custSelect.value) {
            data.createdById = custSelect.value;
        }
    }

    try {
        const res = await window.apiFetch('/tickets', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok && result.success) {
            window.showToast('Ticket created successfully', 'success');
            window.closeCreateTicketModal();
            window.loadTickets(1);
            window.updateDashboardStatsSummary();
        } else {
            window.showToast(result.message || 'Error creating ticket', 'error');
        }
    } catch (err) {
        console.error('Error creating ticket:', err);
        window.showToast('Error creating ticket', 'error');
    }
};

async function loadAgentsList(currentId) {
    const res = await window.apiFetch('/users?role=AGENT');
    const d = await res.json();
    document.getElementById('update-assignee').innerHTML = '<option value="">-- Unassigned --</option>' + d.data.map(a => `<option value="${a.id}" ${a.id === currentId ? 'selected' : ''}>${a.name}</option>`).join('');
}

function renderComments(comments) {
    const container = document.getElementById('d-comments');
    container.innerHTML = (comments || []).map(c => `
        <div class="comment-item ${c.user.id === window.currentUser.id ? 'own-comment' : ''}">
            <strong>${c.user.name}</strong> • <small>${window.formatDateTime(c.createdAt)}</small>
            <div>${c.content}</div>
        </div>
    `).join('') || '<p>No replies yet.</p>';
}

function renderAttachments(attachments) {
    const container = document.getElementById('d-attachments');
    window.currentTicketAttachments = attachments; // Store to easily re-render without refetching if needed
    container.innerHTML = (attachments || []).map(a => `
        <div class="attachment-card" style="display:inline-block; margin:5px; text-align:center; position: relative;">
            <a href="${a.fileUrl}" target="_blank"><img src="${a.fileUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:5px;"></a><br>
            <small style="display:block; width:80px; overflow:hidden; text-overflow:ellipsis;">${a.filename}</small>
            <button onclick="window.deleteUploadedAttachment('${a.id}')" class="btn btn-danger" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; box-shadow: var(--nm-convex);" title="Delete Attachment">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('') || '<p>No attachments yet.</p>';
}

window.deleteUploadedAttachment = async function(attachmentId) {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
        const res = await window.apiFetch(`/tickets/${window.currentTicketId}/attachments/${attachmentId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            window.showToast('Attachment deleted');
            // Re-fetch ticket to get updated attachments
            const d = await window.apiFetch(`/tickets/${window.currentTicketId}`);
            const ticket = await d.json();
            renderAttachments(ticket.data.attachments);
        } else {
            window.showToast('Failed to delete attachment', 'error');
        }
    } catch (e) {
        window.showToast('Error deleting attachment', 'error');
    }
};

window.switchDetailTab = function(tab) {
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'history') loadTicketHistory(window.currentTicketId);
};

async function loadTicketHistory(id) {
    const container = document.getElementById('d-history');
    try {
        const res = await window.apiFetch(`/tickets/${id}/history`);
        const d = await res.json();
        container.innerHTML = (d.data || []).map(h => `
            <div style="padding:8px; border-bottom:1px solid #eee;">
                <strong>${h.user.name}</strong> changed <strong>${h.fieldChanged}</strong>
                <div class="text-muted"><small>${h.oldValue || 'none'} ➔ ${h.newValue}</small></div>
            </div>
        `).join('') || '<p>No history logs.</p>';
    } catch (e) {}
}

window.deleteTicket = async function(id) {
    if (!confirm('Delete this ticket permanently?')) return;
    try {
        await window.apiFetch(`/tickets/${id}`, { method: 'DELETE' });
        window.showToast('Ticket deleted');
        window.loadTickets(window.currentPage);
    } catch (e) { window.showToast('Delete failed', 'error'); }
};

window.toggleSelectAll = function(type) {
    const isChecked = document.getElementById(`select-all-${type}`).checked;
    const className = type === 'tickets' ? 'ticket-checkbox' : (type === 'staff' ? 'staff-checkbox' : 'customer-checkbox');
    const checkboxes = document.querySelectorAll(`.${className}`);
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (type === 'tickets') {
            cb.closest('tr').classList.toggle('selected-row', isChecked);
        }
    });
    window.updateBulkActionsVisibility(type);
};

window.updateBulkActionsVisibility = function(type) {
    const className = type === 'tickets' ? 'ticket-checkbox' : (type === 'staff' ? 'staff-checkbox' : 'customer-checkbox');
    const selected = document.querySelectorAll(`.${className}:checked`);
    const bulkBtn = document.getElementById(`bulk-delete-${type}`);
    const clearBtn = document.getElementById(`btn-clear-${type}`);
    
    if (bulkBtn) {
        bulkBtn.style.display = selected.length > 0 ? 'inline-block' : 'none';
        bulkBtn.innerHTML = `<i class="fas fa-trash"></i> Delete Selected (${selected.length})`;
    }
    if (clearBtn) {
        if (type === 'tickets' && window.selectedAgentFilter) {
            clearBtn.style.display = 'inline-flex';
        } else {
            clearBtn.style.display = selected.length > 0 ? 'inline-block' : 'none';
        }
    }
    
    const allOnPage = document.querySelectorAll(`.${className}`);
    const selectAllCheckbox = document.getElementById(`select-all-${type}`);
    if (selectAllCheckbox && allOnPage.length > 0) {
        selectAllCheckbox.checked = selected.length === allOnPage.length;
    }

    // Sync row classes for visual feedback
    if (type === 'tickets') {
        const checkboxes = document.querySelectorAll(`.${className}`);
        checkboxes.forEach(cb => {
            cb.closest('tr').classList.toggle('selected-row', cb.checked);
        });
    }
};

window.bulkDeleteTickets = async function() {
    const selected = Array.from(document.querySelectorAll('.ticket-checkbox:checked')).map(cb => cb.value);
    if (selected.length === 0 || !confirm(`Delete ${selected.length} tickets permanently?`)) return;

    try {
        const res = await window.apiFetch('/tickets/bulk-action', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', ticketIds: selected })
        });
        if (res.ok) {
            window.showToast('Tickets deleted');
            window.loadTickets(window.currentPage);
            window.updateDashboardStatsSummary();
        } else window.showToast('Bulk delete failed', 'error');
    } catch (e) { window.showToast('Error', 'error'); }
};

// ─── Call Recording to AI Ticket Handlers ──────────────────
let selectedAudioFile = null;

window.openAudioTicketModal = function() {
    const modal = document.getElementById('audio-ticket-modal');
    if (modal) {
        modal.style.display = 'flex';
        window.clearAudioSelection();
    }
};

window.closeAudioTicketModal = function() {
    const modal = document.getElementById('audio-ticket-modal');
    if (modal) {
        modal.style.display = 'none';
        window.clearAudioSelection();
    }
};

window.handleAudioFileSelect = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(file.name)) {
        window.showToast('Please select a valid audio file (.mp3, .wav, .m4a)', 'error');
        return;
    }

    selectedAudioFile = file;

    const card = document.getElementById('audio-file-card');
    const nameEl = document.getElementById('audio-selected-filename');
    const sizeEl = document.getElementById('audio-selected-filesize');
    const player = document.getElementById('audio-preview-element');
    const submitBtn = document.getElementById('btn-submit-audio-ticket');

    if (nameEl) nameEl.innerText = file.name;
    if (sizeEl) sizeEl.innerText = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    if (player) {
        player.src = URL.createObjectURL(file);
    }
    if (card) card.style.display = 'block';
    if (submitBtn) submitBtn.disabled = false;
};

window.clearAudioSelection = function() {
    selectedAudioFile = null;
    const fileInput = document.getElementById('audio-file-input');
    const card = document.getElementById('audio-file-card');
    const player = document.getElementById('audio-preview-element');
    const submitBtn = document.getElementById('btn-submit-audio-ticket');
    const procState = document.getElementById('audio-processing-state');
    const btnText = document.getElementById('btn-audio-submit-text');
    const btnSpinner = document.getElementById('btn-audio-submit-spinner');
    const custName = document.getElementById('audio-customer-name');
    const custEmail = document.getElementById('audio-customer-email');

    if (fileInput) fileInput.value = '';
    if (custName) custName.value = '';
    if (custEmail) custEmail.value = '';
    if (player) {
        player.pause();
        player.src = '';
    }
    if (card) card.style.display = 'none';
    if (procState) procState.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.innerHTML = '<i class="fas fa-magic"></i> Generate Ticket';
    if (btnSpinner) btnSpinner.style.display = 'none';
};

window.submitAudioTicket = async function(e) {
    if (e) e.preventDefault();
    if (!selectedAudioFile) {
        window.showToast('Please upload an audio recording first', 'warning');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-audio-ticket');
    const btnText = document.getElementById('btn-audio-submit-text');
    const btnSpinner = document.getElementById('btn-audio-submit-spinner');
    const procState = document.getElementById('audio-processing-state');

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.innerText = 'AI Listening & Transcribing...';
    if (btnSpinner) btnSpinner.style.display = 'inline-block';
    if (procState) procState.style.display = 'block';

    const formData = new FormData();
    formData.append('audio', selectedAudioFile);

    const custName = document.getElementById('audio-customer-name')?.value?.trim();
    const custEmail = document.getElementById('audio-customer-email')?.value?.trim();
    if (custName) formData.append('customerName', custName);
    if (custEmail) formData.append('customerEmail', custEmail);

    try {
        const token = localStorage.getItem('token');
        const baseHost = (window.ENV_BACKEND_URL || 'https://ticketmanagementai.onrender.com').replace(/\/$/, '');
        const res = await fetch(`${baseHost}/api/tickets/from-audio`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (data.success && data.data) {
            window.showToast('AI Ticket created successfully from recording!', 'success');
            window.closeAudioTicketModal();
            window.loadTickets(1);
            window.updateDashboardStatsSummary();
            setTimeout(() => {
                window.openTicketDetail(data.data.id);
            }, 500);
        } else {
            window.showToast(data.message || 'Failed to create ticket from audio', 'error');
        }
    } catch (err) {
        console.error('Audio ticket submission error:', err);
        window.showToast('Network error while processing audio recording', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.innerHTML = '<i class="fas fa-magic"></i> Generate Ticket';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (procState) procState.style.display = 'none';
    }
};

