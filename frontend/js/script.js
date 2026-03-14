// ========================================
// SMART BUILDING AUTOMATION SYSTEM
// Role-Based Dashboard & Authentication
// ========================================

document.addEventListener('DOMContentLoaded', function () {

    // Check if user is already logged in
    const currentRole = sessionStorage.getItem('userRole');
    if (currentRole) {
        showDashboard(currentRole);
    }

    // Initialize authentication
    initializeAuth();

    // Initialize form handlers
    initializeForms();

    // Session 5: Start Real-Time Updates
    startRealTimeUpdates();
});

/**
 * Switch Main Content Section
 */
function switchSection(sectionId) {
    // In the new layout, we mostly use one page, but we keep the logic for switching
    // major dashboard views (Admin/Maintenance/Resident)

    if (sectionId === 'dashboard') {
        const adminDb = document.getElementById('adminDashboard');
        if (adminDb) adminDb.style.display = 'block';
    }

    // Update active state in sidebar
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Find and highlight the clicked link
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

/**
 * Session 5: Real-Time Update Module
 * Polling every 15 seconds to update dashboard status
 */
function startRealTimeUpdates() {
    // Initial fetch
    updateDashboardStats();

    // Set polling interval (15 seconds)
    setInterval(updateDashboardStats, 15000);
}

async function updateDashboardStats() {
    const role = sessionStorage.getItem('userRole');
    if (!role) return;

    try {
        if (role === 'admin') {
            const startTime = Date.now();
            const response = await fetch('api/dashboard/stats');
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const endTime = Date.now();

            console.log(`[SBMS] Admin stats updated in ${endTime - startTime}ms`);

            if (data.totalBlocks !== undefined) document.getElementById('statTotalBlocks').textContent = data.totalBlocks;
            if (data.totalResidents !== undefined) document.getElementById('statTotalResidents').textContent = data.totalResidents;
            if (data.pendingRequests !== undefined) document.getElementById('statPendingRequests').textContent = data.pendingRequests;
            if (data.issuesResolved !== undefined) document.getElementById('statIssuesResolved').textContent = data.issuesResolved;

            if (data.issueStatusDist && window._sbmsPieChart) {
                window._sbmsPieChart.data.labels = Object.keys(data.issueStatusDist);
                window._sbmsPieChart.data.datasets[0].data = Object.values(data.issueStatusDist);
                window._sbmsPieChart.update();
            }

            if (data.issuesByLocation && window._sbmsBarChart) {
                window._sbmsBarChart.data.labels = Object.keys(data.issuesByLocation);
                window._sbmsBarChart.data.datasets[0].data = Object.values(data.issuesByLocation);
                window._sbmsBarChart.update();
            }

            if (data.issuesOverTime && window._sbmsLineChart) {
                window._sbmsLineChart.data.labels = Object.keys(data.issuesOverTime);
                window._sbmsLineChart.data.datasets[0].data = Object.values(data.issuesOverTime);
                window._sbmsLineChart.update();
            }

            loadIssues('admin');
        } else if (role === 'resident') {
            loadIssues('resident');
        } else if (role === 'maintenance') {
            loadIssues('maintenance');
        }

    } catch (error) {
        console.error('[SBMS] Error fetching dashboard data:', error);
    }
}

// ========================================
// AUTHENTICATION & ROLE MANAGEMENT
// ========================================

// Default Mock Users (Seeded into LocalStorage if empty)
const DEFAULT_USERS = [
    {
        username: 'admin',
        email: 'admin@sbms.com',
        password: 'admin123',
        role: 'admin',
        name: 'System Administrator',
        phone: '123-456-7890'
    },
    {
        username: 'staff',
        email: 'staff@sbms.com',
        password: 'staff123',
        role: 'maintenance',
        name: 'Maintenance Staff',
        phone: '098-765-4321'
    },
    {
        username: 'resident',
        email: 'resident@sbms.com',
        password: 'resident123',
        role: 'resident',
        name: 'Resident A-305',
        phone: '555-555-5555'
    }
];

/**
 * Initialize Authentication Handlers
 */
function initializeAuth() {
    // Seed data if needed
    if (!localStorage.getItem('sbms_users')) {
        localStorage.setItem('sbms_users', JSON.stringify(DEFAULT_USERS));
    }

    // Login Form Listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Signup Form Listener
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}

/**
 * Switch to Signup View
 */
function showSignup() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('signupPage').style.display = 'flex';
    document.getElementById('signupForm').reset();
    document.getElementById('signupError').style.display = 'none';
}

/**
 * Switch to Login View
 */
function showLogin() {
    document.getElementById('signupPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

/**
 * Handle Signup Form Submission
 */
function handleSignup(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const role = document.getElementById('signupRole').value;
    const phone = document.getElementById('signupPhone').value.trim();
    const errorAlert = document.getElementById('signupError');

    // Basic Validation
    if (password !== confirmPassword) {
        showError(errorAlert, 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError(errorAlert, 'Password must be at least 6 characters long');
        return;
    }

    // Check availability
    const users = JSON.parse(localStorage.getItem('sbms_users')) || [];
    const userExists = users.some(u => u.username === username || u.email === email);

    if (userExists) {
        showError(errorAlert, 'Username or Email already exists');
        return;
    }

    // Create new user
    const newUser = {
        name,
        username,
        email,
        password, // In a real app, this should be hashed
        role,
        phone
    };

    // Save to LocalStorage
    users.push(newUser);
    localStorage.setItem('sbms_users', JSON.stringify(users));

    // Success response
    showSuccessAlert('Account Created!', 'You can now log in with your credentials.');

    // Redirect to login after short delay
    setTimeout(() => {
        showLogin();
    }, 1500);
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';

    // Shake animation
    const card = element.closest('.auth-card');
    if (card) {
        card.classList.add('shake-animation');
        setTimeout(() => card.classList.remove('shake-animation'), 500);
    }
}

/**
 * Handle Login Form Submission
 */
function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorAlert = document.getElementById('loginError');

    const loginInput = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // Get users from storage
    const users = JSON.parse(localStorage.getItem('sbms_users')) || [];

    // Find user
    const user = users.find(u =>
        (u.username === loginInput || u.email === loginInput) &&
        u.password === password
    );

    if (user) {
        // Successful Login
        errorAlert.style.display = 'none';

        // Store session data
        sessionStorage.setItem('userRole', user.role);
        sessionStorage.setItem('userName', user.name);
        sessionStorage.setItem('userId', user.username);

        // Redirect to dashboard
        showDashboard(user.role);

        // Clear inputs
        usernameInput.value = '';
        passwordInput.value = '';

    } else {
        // Failed Login
        errorAlert.style.display = 'block';
        errorAlert.textContent = 'Invalid username/email or password';

        // Shake animation
        const loginCard = document.querySelector('.auth-card');
        if (loginCard) {
            loginCard.classList.add('shake-animation');
            setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
        }
    }
}

/**
 * Logout and return to login page
 */
function logout() {
    // Clear session storage
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userName');

    // Hide main app
    document.getElementById('mainApp').style.display = 'none';

    // Hide all dashboards
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('maintenanceDashboard').style.display = 'none';
    document.getElementById('residentDashboard').style.display = 'none';

    // Show login page
    const loginPage = document.getElementById('loginPage');
    loginPage.style.display = 'flex';

    // Reset login form just in case
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

/**
 * Show dashboard based on role
 */
function showDashboard(role) {
    // Hide login page
    document.getElementById('loginPage').style.display = 'none';

    // Show main app
    document.getElementById('mainApp').style.display = 'block';

    // Hide all dashboards first
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('maintenanceDashboard').style.display = 'none';
    document.getElementById('residentDashboard').style.display = 'none';

    // Update user role display
    const roleDisplay = document.getElementById('userRole');
    const storedName = sessionStorage.getItem('userName');

    if (storedName) {
        roleDisplay.textContent = storedName;
    }

    // Role-Based Sidebar Navigation Restriction
    const adminLinks = document.querySelectorAll('.admin-only');
    if (role === 'admin') {
        adminLinks.forEach(link => link.style.display = 'block');
    } else {
        adminLinks.forEach(link => link.style.display = 'none');
    }

    // Show appropriate dashboard
    switch (role) {
        case 'admin':
            document.getElementById('adminDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Admin';
            loadIssues('admin');
            break;
        case 'maintenance':
            document.getElementById('maintenanceDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Maintenance Staff';
            loadIssues('maintenance');
            break;
        case 'resident':
            document.getElementById('residentDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Resident';
            loadIssues('resident');
            break;
    }
}

// ========================================
// FORM INITIALIZATION
// ========================================

function initializeForms() {
    // Admin Forms
    const adminRoomForm = document.getElementById('adminRoomForm');
    const adminEnergyForm = document.getElementById('adminEnergyForm');

    // Maintenance Form
    const maintenanceUpdateForm = document.getElementById('maintenanceUpdateForm');

    // Resident Form
    const residentMaintenanceForm = document.getElementById('residentMaintenanceForm');

    // Add event listeners
    if (adminRoomForm) {
        adminRoomForm.addEventListener('submit', handleAdminRoomSubmit);
    }

    if (adminEnergyForm) {
        adminEnergyForm.addEventListener('submit', handleAdminEnergySubmit);
    }

    if (maintenanceUpdateForm) {
        maintenanceUpdateForm.addEventListener('submit', handleMaintenanceUpdateSubmit);
    }

    if (residentMaintenanceForm) {
        console.log("[SBMS DEBUG] Attaching submit listener to residentMaintenanceForm");
        residentMaintenanceForm.addEventListener('submit', handleResidentMaintenanceSubmit);
    }

    // Initialize work order status change handlers
    initializeStatusSelects();
}

// ========================================
// ADMIN FORM HANDLERS
// ========================================

/**
 * Handle Admin Room Form Submission
 */
function handleAdminRoomSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;

    // Validate form
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    // Get form data
    const roomId = document.getElementById('adminRoomId').value.trim();
    const roomType = document.getElementById('adminRoomType').value;
    const floor = document.getElementById('adminFloor').value;
    const occupancy = document.getElementById('adminOccupancy').value;

    // POST to backend servlet
    const body = new URLSearchParams({ roomId, roomType, floor, occupancy });
    fetch('AddBuildingServlet', { method: 'POST', body })
        .then(res => {
            if (res.ok || res.redirected) {
                showSuccessAlert(
                    'Room Registered!',
                    `Room ${roomId} (${roomType}) on Floor ${floor} saved as ${occupancy}.`
                );
                form.reset();
                form.classList.remove('was-validated');
                updateDashboardStats();
            } else {
                showErrorAlert('Error', 'Failed to register room. Please try again.');
            }
        })
        .catch(() => showErrorAlert('Network Error', 'Could not reach the server.'));
}

/**
 * Handle Admin Energy Form Submission
 */
function handleAdminEnergySubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;

    // Validate form
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const roomId = document.getElementById('adminEnergyRoom').value.trim();
    const date = document.getElementById('adminEnergyDate').value;
    const power = document.getElementById('adminPower').value;

    // Format date for display
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // POST to backend servlet
    const body = new URLSearchParams({ roomId, logDate: date, powerKwh: power });
    fetch('LogEnergyServlet', { method: 'POST', body })
        .then(res => {
            if (res.ok || res.redirected) {
                showSuccessAlert(
                    'Energy Logged!',
                    `Room ${roomId} consumed ${power} kWh on ${formattedDate}.`
                );
                form.reset();
                form.classList.remove('was-validated');
                updateDashboardStats();
            } else {
                showErrorAlert('Error', 'Failed to log energy usage. Please try again.');
            }
        })
        .catch(() => showErrorAlert('Network Error', 'Could not reach the server.'));
}

// ========================================
// MAINTENANCE STAFF FORM HANDLERS
// ========================================

/**
 * Handle Maintenance Update Form Submission
 */
function handleMaintenanceUpdateSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;

    // Validate form
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    // Get form data
    const formData = {
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
        if (data.success) {
            // Show success message
            showSuccessAlert(
                'Work Order Updated!',
                `Work Order ${formData.workOrderId} status changed to "${formData.status}". ${formData.notes ? 'Notes have been added.' : ''}`
            );

            // Reset form
            form.reset();
            form.classList.remove('was-validated');

            // Refresh dashboard
            updateDashboardStats();
        } else {
            showErrorAlert('Error', data.message || 'Failed to update work order.');
        }
    }).catch(err => {
        console.error(err);
        showErrorAlert('Network Error', 'Could not reach the server.');
    });
}

/**
 * Initialize status select dropdowns in work orders
 */
function initializeStatusSelects() {
    const statusSelects = document.querySelectorAll('.status-select');

    statusSelects.forEach(select => {
        select.addEventListener('change', function () {
            const workOrderItem = this.closest('.work-order-item');
            const workOrderTitle = workOrderItem.querySelector('h4').textContent;
            const newStatus = this.value;

            showSuccessAlert(
                'Status Updated!',
                `Work order "${workOrderTitle}" has been marked as "${newStatus}".`
            );
        });
    });
}

// ========================================
// RESIDENT FORM HANDLERS
// ========================================

/**
 * Handle Resident Maintenance Form Submission
 */
function handleResidentMaintenanceSubmit(event) {
    console.log("[SBMS DEBUG] Resident submit clicked");
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;

    if (!form.checkValidity()) {
        console.log("[SBMS DEBUG] Form validation failed");
        form.classList.add('was-validated');
        return;
    }

    const payload = {
        resident_id: sessionStorage.getItem('userId') || 'resident',
        title: document.getElementById('residentTitle').value.trim(),
        location: document.getElementById('residentLocation').value.trim(),
        description: document.getElementById('residentDescription').value.trim(),
        priority: document.getElementById('residentPriority').value
    };

    console.log("[SBMS DEBUG] Sending payload:", payload);

    fetch('api/issues?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(r => {
            console.log("[SBMS DEBUG] Received response status:", r.status);
            return r.json();
        })
        .then(data => {
            console.log("[SBMS DEBUG] Received response data:", data);
            if (data.success) {
                showSuccessAlert('Issue Reported!', 'Your issue has been submitted successfully and is pending review.');
                form.reset();
                form.classList.remove('was-validated');
                updateDashboardStats();
            } else {
                showErrorAlert('Error reporting issue', data.message);
            }
        }).catch(err => {
            console.error("[SBMS DEBUG] Fetch error:", err);
            alert('Internal Error. Check console logs.');
        });
}

// Automatically load issues when dashboard opens
function loadIssues(role) {
    const userId = sessionStorage.getItem('userId');
    fetch(`api/issues?role=${role}&username=${userId}`)
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                if (role === 'admin') {
                    renderAdminIssues(res.data);
                } else if (role === 'maintenance') {
                    renderMaintenanceIssues(res.data);
                } else if (role === 'resident') {
                    renderResidentIssues(res.data);
                }
            }
        }).catch(err => console.error(err));
}

function renderResidentIssues(issues) {
    const tbody = document.getElementById('residentIssuesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (issues.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No issues reported yet.</td></tr>';
        return;
    }
    issues.forEach(iss => {
        tbody.innerHTML += `
            <tr>
                <td>${iss.location}</td>
                <td>${iss.title}</td>
                <td><span class="badge rounded-pill bg-secondary small">${iss.status}</span></td>
            </tr>
        `;
    });
}

function renderAdminIssues(issues) {
    const tbody = document.getElementById('adminIssuesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (issues.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No maintenance requests found.</td></tr>';
        return;
    }
    issues.forEach(iss => {
        const p = (iss.priority || '').toLowerCase();
        const priorityClass = p === 'high' ? 'bg-danger-subtle text-danger'
            : p === 'critical' ? 'bg-danger text-white'
                : p === 'low' ? 'bg-success-subtle text-success'
                    : 'bg-warning-subtle text-warning';
        const dateStr = new Date(iss.created_at).toLocaleDateString();
        const desc = iss.description || '';
        const preview = desc.length > 40 ? desc.substring(0, 40) + '...' : desc;

        let statusBadge = 'bg-secondary';
        if (iss.status === 'Pending') statusBadge = 'bg-warning text-dark';
        if (iss.status === 'Assigned') statusBadge = 'bg-info text-dark';
        if (iss.status === 'In Progress') statusBadge = 'bg-primary';
        if (iss.status === 'Completed') statusBadge = 'bg-success';

        let actions = '';
        if (iss.status === 'Pending') {
            actions = `<button class="btn btn-sm btn-outline-primary" onclick="assignToMaint(${iss.issue_id})">Assign</button>`;
        }

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td class="fw-bold">${iss.location}</td>
                <td>
                    <div class="fw-bold">${iss.title}</div>
                    <div class="text-muted small">${preview}</div>
                </td>
                <td><span class="badge rounded-pill ${priorityClass} px-3 py-2">${iss.priority}</span></td>
                <td><span class="badge rounded-pill ${statusBadge} px-3 py-2">${iss.status}</span></td>
                <td class="text-muted small">${dateStr}</td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

function assignToMaint(issueId) {
    // Hardcoded assignment to 'staff' for simplicity in demo
    const payload = {
        issue_id: issueId,
        admin_id: sessionStorage.getItem('userId'),
        assigned_staff: 'staff' // using seed maintenance user username
    };
    fetch('api/issues?action=assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json()).then(data => {
        if (data.success) {
            showSuccessAlert('Assigned!', 'Issue assigned to maintenance staff.');
            loadIssues('admin');
        }
    });
}

function renderMaintenanceIssues(issues) {
    const list = document.getElementById('workOrderList');
    if (!list) return;
    list.innerHTML = '';
    issues.forEach(iss => {
        const bg = iss.priority === 'High' ? 'bg-danger' : 'bg-warning';
        list.innerHTML += `
            <div class="p-4 border rounded-4 mb-3 work-order-item">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="m-0 fw-bold">${iss.title} - ${iss.location}</h4>
                    <div>
                        <span class="badge ${bg} me-2">${iss.priority} Priority</span>
                        <span class="badge bg-secondary">ID: ${iss.issue_id}</span>
                    </div>
                </div>
                <p class="text-muted">${iss.description}</p>
                <div class="d-flex gap-2 mt-3">
                    <select class="form-select form-select-sm status-select" style="width: 150px;" onchange="updateMaintStatus(${iss.issue_id}, this.value)">
                        <option value="Assigned" ${iss.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
                        <option value="In Progress" ${iss.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Completed" ${iss.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
            </div>
        `;
    });
}

function updateMaintStatus(issueId, newStatus) {
    const payload = {
        issue_id: issueId,
        status: newStatus,
        updated_by: sessionStorage.getItem('userId')
    };
    fetch('api/issues?action=update_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json()).then(data => {
        if (data.success) {
            showSuccessAlert('Status Updated!', 'Issue status updated to ' + newStatus);
            // Optionally reload to ensure UI matches DB exactly
        }
    });
}

// ========================================
// SUCCESS ALERT
// ========================================

/**
 * Display custom success alert
 */
function showSuccessAlert(title, message) {
    const alertHTML = `
        <div class="custom-alert-overlay" id="customAlert">
            <div class="custom-alert-box">
                <div class="custom-alert-icon">
                    <i class="bi bi-check-circle-fill"></i>
                </div>
                <h3 class="custom-alert-title">${title}</h3>
                <p class="custom-alert-message">${message}</p>
                <button class="btn btn-primary" onclick="closeCustomAlert()">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    setTimeout(() => {
        document.getElementById('customAlert').classList.add('show');
    }, 10);
}

function showErrorAlert(title, message) {
    const alertHTML = `
        <div class="custom-alert-overlay" id="customAlert">
            <div class="custom-alert-box" style="border-color: rgba(239, 68, 68, 0.5);">
                <div class="custom-alert-icon" style="color: #ef4444;">
                    <i class="bi bi-x-circle-fill"></i>
                </div>
                <h3 class="custom-alert-title">${title}</h3>
                <p class="custom-alert-message">${message}</p>
                <button class="btn btn-danger" onclick="closeCustomAlert()">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    setTimeout(() => { document.getElementById('customAlert').classList.add('show'); }, 10);
}

/**
 * Close custom alert
 */
function closeCustomAlert() {
    const alert = document.getElementById('customAlert');
    if (alert) {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.remove();
        }, 300);
    }
}

// ========================================
// FORM VALIDATION HELPERS
// ========================================

// Add real-time validation for numeric inputs
document.addEventListener('DOMContentLoaded', function () {
    const numericInputs = document.querySelectorAll('input[type="number"]');

    numericInputs.forEach(input => {
        input.addEventListener('input', function () {
            // Remove invalid characters
            this.value = this.value.replace(/[^0-9.]/g, '');

            // Prevent multiple decimal points
            const parts = this.value.split('.');
            if (parts.length > 2) {
                this.value = parts[0] + '.' + parts.slice(1).join('');
            }
        });
    });
});

// ========================================
// CUSTOM ALERT STYLES (Injected)
// ========================================
(function injectAlertStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .custom-alert-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .custom-alert-overlay.show {
            opacity: 1;
        }
        
        .custom-alert-box {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 2.5rem;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }
        
        .custom-alert-overlay.show .custom-alert-box {
            transform: scale(1);
        }
        
        .custom-alert-icon {
            font-size: 4rem;
            color: #4facfe;
            margin-bottom: 1rem;
            animation: scaleIn 0.5s ease;
        }
        
        @keyframes scaleIn {
            from { transform: scale(0); }
            to { transform: scale(1); }
        }
        
        .custom-alert-title {
            color: #ffffff;
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        
        .custom-alert-message {
            color: #b8b8d1;
            font-size: 1rem;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        
        .custom-alert-box .btn {
            padding: 0.75rem 2rem;
            font-size: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.2s ease;
            color: white;
        }
        
        .custom-alert-box .btn:hover {
            transform: translateY(-2px);
        }
    `;
    document.head.appendChild(style);
})();

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get current user role
 */
function getCurrentRole() {
    return sessionStorage.getItem('userRole');
}

/**
 * Check if user has specific role
 */
function hasRole(role) {
    return getCurrentRole() === role;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ========================================
// DEMO DATA GENERATION (Optional)
// ========================================

/**
 * Generate sample data for demonstration
 * This can be called for populating lists dynamically
 */
function generateSampleData() {
    // This is a placeholder for future dynamic data loading
    console.log('Sample data generation placeholder');
}
