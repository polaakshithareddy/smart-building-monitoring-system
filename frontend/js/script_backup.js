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
});

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
    const card = element.closest('.login-card');
    card.classList.add('shake-animation');
    setTimeout(() => card.classList.remove('shake-animation'), 500);
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
        const loginCard = document.querySelector('.login-card');
        loginCard.classList.add('shake-animation');
        setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
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

    // Show appropriate dashboard
    switch (role) {
        case 'admin':
            document.getElementById('adminDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Admin';
            break;
        case 'maintenance':
            document.getElementById('maintenanceDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Maintenance Staff';
            break;
        case 'resident':
            document.getElementById('residentDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Resident';
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
    const formData = {
        roomId: document.getElementById('adminRoomId').value.trim(),
        roomType: document.getElementById('adminRoomType').value,
        floor: document.getElementById('adminFloor').value,
        occupancy: document.getElementById('adminOccupancy').value
    };

    // Show success message
    showSuccessAlert(
        'Room Added Successfully!',
        `Room ${formData.roomId} (${formData.roomType}) on Floor ${formData.floor} has been registered as ${formData.occupancy}.`
    );

    // Reset form
    form.reset();
    form.classList.remove('was-validated');
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

    // Get form data
    const formData = {
        roomId: document.getElementById('adminEnergyRoom').value.trim(),
        date: document.getElementById('adminEnergyDate').value,
        power: document.getElementById('adminPower').value
    };

    // Format date
    const dateObj = new Date(formData.date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Show success message
    showSuccessAlert(
        'Energy Usage Recorded!',
        `Room ${formData.roomId} consumed ${formData.power} kWh on ${formattedDate}. Data added to system.`
    );

    // Reset form
    form.reset();
    form.classList.remove('was-validated');
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

    // Show success message
    showSuccessAlert(
        'Work Order Updated!',
        `Work Order ${formData.workOrderId} status changed to "${formData.status}". ${formData.notes ? 'Notes have been added.' : ''}`
    );

    // Reset form
    form.reset();
    form.classList.remove('was-validated');
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
        issueType: document.getElementById('residentIssueType').value,
        description: document.getElementById('residentDescription').value.trim(),
        priority: document.getElementById('residentPriority').value
    };

    // Show success message
    showSuccessAlert(
        'Maintenance Request Submitted!',
        `Your ${formData.priority} priority ${formData.issueType} request has been submitted. Our maintenance team will review it shortly.`
    );

    // Reset form
    form.reset();
    form.classList.remove('was-validated');
}

// ========================================
// SUCCESS ALERT
// ========================================

/**
 * Display custom success alert
 */
function showSuccessAlert(title, message) {
    // Create alert HTML
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

    // Insert into body
    document.body.insertAdjacentHTML('beforeend', alertHTML);

    // Add animation
    setTimeout(() => {
        document.getElementById('customAlert').classList.add('show');
    }, 10);
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
