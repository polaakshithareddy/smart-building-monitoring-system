import sys, re

f = 'src/main/webapp/js/script.js'
with open(f, 'r', encoding='utf-8') as file:
    code = file.read()

# Replace variables in renderStatCards
old_vars = r'const blocks    = data\.totalBlocks    \?\? 0;\s*const floors    = data\.totalFloors    \?\? 0;\s*const rooms     = data\.totalRooms     \?\? 0;\s*const occupied  = data\.occupiedRooms  \?\? 0;\s*const available = data\.availableRooms \?\? 0;'
new_vars = 'const blocks    = data.totalBlocks    ?? 0;\n    const residents = data.totalResidents ?? 0;\n    const pending   = data.pendingRequests ?? 0;\n    const resolved  = data.issuesResolved ?? 0;'
code = re.sub(old_vars, new_vars, code)

# Replace HTML in renderStatCards
old_html = r'container\.innerHTML = `[\s\S]*?</div>`;'
new_html = r'''container.className = "analytics-grid-4";
container.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon icon-rooms"><i class="bi bi-building"></i></div>
                <div class="stat-info">
                    <div class="stat-value" id="statTotalBlocks">${blocks}</div>
                    <div class="stat-label">Total Blocks</div>
                </div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon" style="background:#e0e7ff;color:#4f46e5;"><i class="bi bi-people"></i></div>
                <div class="stat-info">
                    <div class="stat-value" id="statTotalResidents">${residents}</div>
                    <div class="stat-label">Total Residents</div>
                </div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon" style="background:#fffbeb;color:#f59e0b;"><i class="bi bi-exclamation-triangle"></i></div>
                <div class="stat-info">
                    <div class="stat-value" id="statPendingRequests">${pending}</div>
                    <div class="stat-label">Pending Requests</div>
                </div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-inner">
                <div class="stat-icon" style="background:#dcfce7;color:#16a34a;"><i class="bi bi-check-circle"></i></div>
                <div class="stat-info">
                    <div class="stat-value" id="statIssuesResolved">${resolved}</div>
                    <div class="stat-label">Issues Resolved</div>
                </div>
            </div>
        </div>`;'''
code = re.sub(old_html, new_html, code, count=1)

# Replace submit function Logic
old_submit = r"const formData = \{\s*workOrderId: document\.getElementById\('workOrderId'\)\.value\.trim\(\),\s*status: document\.getElementById\('workStatus'\)\.value,\s*notes: document\.getElementById\('workNotes'\)\.value\.trim\(\)\s*\};\s*// Show success message\s*showSuccessAlert\([^)]+\);\s*// Reset form\s*form\.reset\(\);\s*form\.classList\.remove\('was-validated'\);\s*}"
new_submit = r'''const formData = {
        workOrderId: document.getElementById('workOrderId').value.trim(),
        status: document.getElementById('workStatus').value,
        notes: document.getElementById('workNotes').value.trim()
    };
    
    const payload = {
        issue_id: formData.workOrderId,
        status: formData.status,
        updated_by: sessionStorage.getItem('userId'),
        notes: formData.notes
    };
    
    fetch('api/issues?action=update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json()).then(data => {
        if(data.success) {
            showSuccessAlert('Work Order Updated!', `Work Order ${formData.workOrderId} status changed to "${formData.status}".`);
            form.reset();
            form.classList.remove('was-validated');
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
        } else {
            showErrorAlert('Error', data.message || 'Failed to update work order.');
        }
    }).catch(err => {
        console.error(err);
        showErrorAlert('Network Error', 'Could not reach the server.');
    });
}'''
code = re.sub(old_submit, new_submit, code)


with open(f, 'w', encoding='utf-8') as file:
    file.write(code)
print('Done in Python!')
