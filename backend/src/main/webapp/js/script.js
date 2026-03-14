// ========================================
// SMART BUILDING AUTOMATION SYSTEM
// Role-Based Dashboard & Authentication
// ========================================

document.addEventListener('DOMContentLoaded', function () {

    // Initialize sidebar behaviour
    initSidebar();

    // Initialize notification system
    initNotifications();

    // Initialize dark mode (restore saved preference)
    initDarkMode();

    // Close notification dropdown when clicking outside
    document.addEventListener('click', function (e) {
        const wrapper = document.getElementById('notifBtn');
        const dropdown = document.getElementById('notifDropdown');
        if (wrapper && dropdown && !wrapper.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    // Check if user is already logged in
    const currentRole = sessionStorage.getItem('userRole');
    if (currentRole) {
        showDashboard(currentRole);
    }

    // Initialize authentication
    initializeAuth();

    // Initialize form handlers
    initializeForms();

    // Real-Time Updates
    startRealTimeUpdates();
});

// =============================================
// DARK MODE
// =============================================
function initDarkMode() {
    const saved = localStorage.getItem('sbms_theme');
    if (saved === 'dark') applyDarkMode(true, false);
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyDarkMode(!isDark, true);
}

function applyDarkMode(dark, save) {
    const icon = document.getElementById('darkToggleIcon');
    if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) { icon.className = 'bi bi-sun-fill'; }
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (icon) { icon.className = 'bi bi-moon-fill'; }
    }
    if (save) localStorage.setItem('sbms_theme', dark ? 'dark' : 'light');
    // Re-render charts with updated grid colors if admin dashboard visible
    const adminDb = document.getElementById('adminDashboard');
    if (adminDb && adminDb.style.display !== 'none') {
        setTimeout(() => renderDashboardCharts(_lastDashboardData || {}), 50);
    }
}

// Store last dashboard data to allow chart re-render on theme change
let _lastDashboardData = null;

// =============================================
// EXPORT REPORTS
// =============================================
function exportIssuePDF() {
    const rows = document.querySelectorAll('#adminIssuesTableBody tr');
    if (!rows.length) {
        alert('No issue data to export.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('SBMS Pro — Issue Report', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Generated: ' + new Date().toLocaleString(), 14, 26);

    const tableData = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
            tableData.push([
                cells[0].textContent.trim(),
                cells[1].textContent.trim().substring(0, 40),
                cells[2].textContent.trim(),
                cells[3].textContent.trim(),
                cells[4].textContent.trim()
            ]);
        }
    });

    doc.autoTable({
        head: [['Room', 'Issue', 'Priority', 'Status', 'Date']],
        body: tableData,
        startY: 32,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 249] }
    });

    doc.save('SBMS_Issue_Report_' + new Date().toISOString().slice(0, 10) + '.pdf');
    showSuccessAlert('Exported!', 'Issue report downloaded as PDF.');
    pushNotification('📄 Issue Report exported as PDF', 'default');
}

function exportBillingExcel() {
    // Collect bill data from statsRow2 + any billing table visible
    const data = [
        ['Metric', 'Value'],
        ['Total Bills', document.getElementById('statTotalBills')?.textContent || '—'],
        ['Paid Bills', document.getElementById('statPaidBills')?.textContent || '—'],
        ['Pending Bills', document.getElementById('statPendingBills')?.textContent || '—'],
        ['Export Date', new Date().toLocaleString()]
    ];

    // Also try issues table for billing rows
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Billing Summary');
    XLSX.writeFile(wb, 'SBMS_Billing_Report_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showSuccessAlert('Exported!', 'Billing report downloaded as Excel.');
    pushNotification('📊 Billing Report exported as Excel', 'bill');
}

function exportMaintenanceExcel() {
    const rows = document.querySelectorAll('#adminIssuesTableBody tr');
    const data = [['Room', 'Issue', 'Priority', 'Status', 'Date']];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
            data.push([
                cells[0].textContent.trim(),
                cells[1].textContent.trim().substring(0, 60),
                cells[2].textContent.trim(),
                cells[3].textContent.trim(),
                cells[4].textContent.trim()
            ]);
        }
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [10, 30, 10, 12, 12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Report');
    XLSX.writeFile(wb, 'SBMS_Maintenance_Report_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showSuccessAlert('Exported!', 'Maintenance report downloaded as Excel.');
    pushNotification('📊 Maintenance Report exported as Excel', 'assign');
}

// =============================================
// NOTIFICATION FILTER TABS
// =============================================
let _notifActiveFilter = 'all';

function filterNotifTab(type) {
    _notifActiveFilter = type;
    // Update active tab UI
    ['all', 'issue', 'bill', 'default'].forEach(t => {
        const tabId = { all: 'notifTabAll', issue: 'notifTabIssue', bill: 'notifTabBill', default: 'notifTabSystem' }[t];
        const el = document.getElementById(tabId);
        if (el) el.classList.toggle('active', t === type);
    });
    renderNotifList();
}

function clearAllNotifs() {
    _notifications = [];
    _unreadCount = 0;
    updateNotifBadge(0);
    renderNotifList();
}

// =============================================
// PREDICTIVE MAINTENANCE RENDERER
// =============================================
function renderPredictiveMaintenance(items) {
    const container = document.getElementById('predictiveList');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="p-2 text-muted"><i class="bi bi-shield-check text-success me-2"></i> No recurring failures detected.</div>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const freq = item.frequency || 2;
        const urgencyClass = freq >= 4 ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle';
        const urgencyColor = freq >= 4 ? '#ef4444' : '#f59e0b';
        const lastSeen = item.last_seen ? new Date(item.last_seen).toLocaleDateString() : 'N/A';
        return `
        <div class="predict-item">
            <span class="predict-icon" style="color:${urgencyColor};">
                <i class="bi ${urgencyClass}"></i>
            </span>
            <div style="flex:1;">
                <div class="predict-loc">⚠ ${item.location} — ${item.title}</div>
                <div class="predict-sub">Reported ${freq}x · Last seen ${lastSeen} · Recommend preventive check</div>
            </div>
            <span class="predict-badge">${freq}× recurring</span>
        </div>`;
    }).join('');

    // Push predictive alerts to notification bell
    if (items.length > 0 && _prevTotal === -1) { // only on first load
        items.slice(0, 2).forEach(item => {
            pushNotification(`⚙ Predictive: ${item.location} – ${item.title} (${item.frequency}x)`, 'assign');
        });
    }
}

// =============================================
// ENERGY ANALYTICS CHARTS
// =============================================
let energyDailyChartInst = null;
let energyFloorChartInst = null;

function renderEnergyCharts(data) {
    if (typeof Chart === 'undefined') return;

    const fontFamily = "'Outfit', sans-serif";
    const tickFont = { family: fontFamily, size: 10 };
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#334155' : '#f1f5f9';

    // ── Daily Energy Line Chart ──
    const dailyCanvas = document.getElementById('energyDailyChart');
    if (dailyCanvas) {
        const dailyData = (data.dailyEnergy && Object.keys(data.dailyEnergy).length)
            ? data.dailyEnergy
            : { 'Mon': 42, 'Tue': 38, 'Wed': 55, 'Thu': 49, 'Fri': 61, 'Sat': 30, 'Sun': 22 };
        if (energyDailyChartInst) energyDailyChartInst.destroy();
        energyDailyChartInst = new Chart(dailyCanvas, {
            type: 'line',
            data: {
                labels: Object.keys(dailyData),
                datasets: [{
                    label: 'kWh',
                    data: Object.values(dailyData),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.10)',
                    tension: 0.4, fill: true, pointRadius: 4,
                    pointBackgroundColor: '#f59e0b'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: tickFont } },
                    y: { grid: { color: gridColor }, ticks: { font: tickFont }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ── Energy by Floor Bar Chart ──
    const floorCanvas = document.getElementById('energyFloorChart');
    if (floorCanvas) {
        const floorData = (data.energyByFloor && Object.keys(data.energyByFloor).length)
            ? data.energyByFloor
            : { 'Floor 1': 180, 'Floor 2': 220, 'Floor 3': 145, 'Floor 4': 195, 'Floor 5': 160 };
        if (energyFloorChartInst) energyFloorChartInst.destroy();
        energyFloorChartInst = new Chart(floorCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(floorData),
                datasets: [{
                    label: 'kWh',
                    data: Object.values(floorData),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                    borderRadius: 6, barPercentage: 0.6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: tickFont } },
                    y: { grid: { color: gridColor }, ticks: { font: tickFont }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// =============================================
// ACTIVITY LOG RENDERER
// =============================================
function renderActivityLog(activities) {
    const container = document.getElementById('activityLogList');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = '<div class="text-muted" style="font-size:.82rem;padding:.5rem 0;">No activity recorded yet.</div>';
        return;
    }

    const typeMap = {
        issue_reported: { label: 'Issue', cls: 'log-badge-issue' },
        issue_assigned: { label: 'Assign', cls: 'log-badge-assign' },
        status_updated: { label: 'Status', cls: 'log-badge-status' },
        bill_paid: { label: 'Bill', cls: 'log-badge-bill' },
        default: { label: 'System', cls: 'log-badge-system' }
    };

    container.innerHTML = activities.map(act => {
        const key = act.activity_type || 'default';
        const cfg = typeMap[key] || typeMap.default;
        const time = act.created_at
            ? new Date(act.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : (act.timestamp ? new Date(act.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
        const desc = act.description || act.activity || '—';
        return `<div class="log-item">
            <span class="log-badge ${cfg.cls}">${cfg.label}</span>
            <span class="log-text">${desc}</span>
            <span class="log-time">${time}</span>
        </div>`;
    }).join('');
}

// =============================================
// TECHNICIAN PERFORMANCE RENDERER
// =============================================
function renderTechnicianPerformance(techs) {
    const container = document.getElementById('technicianPerfList');
    if (!container || !techs || techs.length === 0) return;

    container.innerHTML = `
    <div style="font-size:.72rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;margin-top:8px;">Technician Performance</div>
    ${techs.map(t => {
        const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
        return `
        <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:2px;">
                <span style="font-weight:600;">${t.name}</span>
                <span style="color:var(--text-muted);">${t.completed}/${t.total} (${pct}%)</span>
            </div>
            <div style="height:5px;background:var(--border);border-radius:4px;">
                <div style="height:100%;width:${pct}%;background:#10b981;border-radius:4px;transition:width .4s;"></div>
            </div>
        </div>`;
    }).join('')}`;
}

// =============================================
// SIDEBAR TOGGLE (Hamburger)
// =============================================
function initSidebar() {
    const saved = localStorage.getItem('sbms_sidebar_collapsed');
    if (saved === 'true') {
        collapseSidebar(true, false);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        toggleMobileSidebar();
    } else {
        const isCollapsed = sidebar.classList.contains('collapsed');
        collapseSidebar(!isCollapsed, true);
    }
}

function collapseSidebar(collapse, save) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const icon = document.getElementById('hamburgerIcon');
    if (collapse) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
        if (icon) { icon.className = 'bi bi-layout-sidebar'; }
    } else {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
        if (icon) { icon.className = 'bi bi-list'; }
    }
    if (save) localStorage.setItem('sbms_sidebar_collapsed', collapse);
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('show');
    } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('show');
    }
}

function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

// =============================================
// ACTIVE NAV HIGHLIGHT
// =============================================
function handleNavClick(event, activeId) {
    event.preventDefault();
    document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
    // Update navbar breadcrumb title
    const titles = {
        navOverview: 'System Overview',
        navRooms: 'Room Management',
        navEnergy: 'Energy Logs',
        navMaintenance: 'Maintenance Requests'
    };
    const titleEl = document.getElementById('navPageTitle');
    if (titleEl && titles[activeId]) titleEl.textContent = titles[activeId];
    // On mobile, close sidebar after nav click
    if (window.innerWidth <= 768) closeMobileSidebar();
}

// =============================================
// NOTIFICATION BELL
// =============================================
let _notifications = [];
let _unreadCount = 0;

function initNotifications() {
    updateNotifBadge(0);
}

function toggleNotifDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.classList.toggle('open');
}

function updateNotifBadge(count) {
    _unreadCount = count;
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

function showSuccessAlert(title, message) {
    // Show a brief toast notification
    let toast = document.getElementById('sbmsToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sbmsToast';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#10b981;color:white;padding:.75rem 1.25rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.2);font-family:Outfit,sans-serif;font-size:.88rem;display:flex;align-items:center;gap:.5rem;transition:opacity .3s;';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i><div><strong>${title}</strong><br>${message}</div>`;
    toast.style.opacity = '1';
    toast.style.display = 'flex';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 300); }, 3500);
}

function pushNotification(text, type) {
    // type: 'issue' | 'assign' | 'bill' | 'resolved'
    const iconMap = {
        issue: { bg: '#fee2e2', color: '#ef4444', icon: 'bi-exclamation-triangle-fill' },
        assign: { bg: '#dbeafe', color: '#3b82f6', icon: 'bi-person-check-fill' },
        bill: { bg: '#dcfce7', color: '#16a34a', icon: 'bi-credit-card-2-front-fill' },
        resolved: { bg: '#d1fae5', color: '#10b981', icon: 'bi-check-circle-fill' },
        default: { bg: '#f1f5f9', color: '#64748b', icon: 'bi-bell-fill' }
    };
    const cfg = iconMap[type] || iconMap.default;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const notif = { text, type, timeStr, unread: true, id: Date.now() };
    _notifications.unshift(notif);
    if (_notifications.length > 10) _notifications.pop();

    _unreadCount++;
    updateNotifBadge(_unreadCount);
    renderNotifList();
}

function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;
    const iconMap = {
        issue: { bg: '#fee2e2', color: '#ef4444', icon: 'bi-exclamation-triangle-fill' },
        assign: { bg: '#dbeafe', color: '#3b82f6', icon: 'bi-person-check-fill' },
        bill: { bg: '#dcfce7', color: '#16a34a', icon: 'bi-credit-card-2-front-fill' },
        resolved: { bg: '#d1fae5', color: '#10b981', icon: 'bi-check-circle-fill' },
        default: { bg: '#f1f5f9', color: '#64748b', icon: 'bi-bell-fill' },
        progress: { bg: '#ede9fe', color: '#7c3aed', icon: 'bi-tools' }
    };

    // Apply category filter
    const filtered = _notifActiveFilter === 'all'
        ? _notifications
        : _notifications.filter(n => n.type === _notifActiveFilter);

    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:.82rem;">No notifications in this category</div>';
        return;
    }
    list.innerHTML = filtered.map(n => {
        const cfg = iconMap[n.type] || iconMap.default;
        return `
        <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
            <div class="notif-icon" style="background:${cfg.bg};color:${cfg.color};"><i class="bi ${cfg.icon}"></i></div>
            <div class="notif-body">
                <div class="notif-text">${n.text}</div>
                <div class="notif-time">${n.timeStr}</div>
            </div>
            ${n.unread ? '<div class="notif-dot"></div>' : ''}
        </div>`;
    }).join('');
}

function markNotifRead(id) {
    const n = _notifications.find(x => x.id === id);
    if (n && n.unread) {
        n.unread = false;
        _unreadCount = Math.max(0, _unreadCount - 1);
        updateNotifBadge(_unreadCount);
        renderNotifList();
    }
}

function markAllRead() {
    _notifications.forEach(n => n.unread = false);
    updateNotifBadge(0);
    renderNotifList();
}

// =============================================
// SKELETON → REAL STAT CARDS
// =============================================
function renderStatCards(data) {
    const container = document.getElementById('dashboardStatsCards');
    if (!container) return;

    const blocks = data.totalBlocks ?? 0;
    const residents = data.totalResidents ?? 0;
    const pending = data.pendingRequests ?? 0;
    const resolved = data.issuesResolved ?? 0;

    container.className = 'analytics-grid-4';
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
        </div>`;
}

// =============================================
// SMART ALERTS PANEL
// =============================================
function renderSmartAlerts(data) {
    const container = document.getElementById('smartAlerts');
    if (!container) return;

    const alerts = [];
    const pending = data.pendingRequests ?? 0;
    const resolved = data.resolvedIssues ?? 0;
    const total = data.totalIssues ?? 0;
    const unpaidBills = data.pendingBills ?? 0;
    const avgRes = parseFloat(data.avgResolutionTime ?? 0);

    if (pending > 5) {
        alerts.push({
            cls: 'alert-critical', dotCls: 'alert-dot-red',
            msg: `⚠ High Issue Backlog`, sub: `${pending} pending issues require attention`
        });
    } else if (pending > 2) {
        alerts.push({
            cls: 'alert-warning', dotCls: 'alert-dot-yellow',
            msg: `⚠ Pending Issues`, sub: `${pending} issues are waiting to be assigned`
        });
    }
    if (unpaidBills > 3) {
        alerts.push({
            cls: 'alert-warning', dotCls: 'alert-dot-yellow',
            msg: `⚠ Unpaid Bills`, sub: `${unpaidBills} bills pending payment from residents`
        });
    }
    if (avgRes > 24) {
        alerts.push({
            cls: 'alert-critical', dotCls: 'alert-dot-red',
            msg: `⚠ Slow Resolution Time`, sub: `Average resolution: ${avgRes.toFixed(1)} hrs — check maintenance workload`
        });
    }
    if (total > 0 && resolved === total) {
        alerts.push({
            cls: 'alert-ok', dotCls: 'alert-dot-green',
            msg: `✅ All Issues Resolved`, sub: `Great job! All ${total} issues have been resolved`
        });
    }
    if (alerts.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="section-card" style="padding:1rem 1.2rem;">
            <div class="section-header" style="margin-bottom:.65rem;">
                <h3 class="section-title"><i class="bi bi-shield-exclamation text-danger"></i> Smart Alerts</h3>
            </div>
            ${alerts.map(a => `
                <div class="alert-item ${a.cls}">
                    <div class="alert-dot ${a.dotCls}"></div>
                    <div>
                        <div class="alert-msg">${a.msg}</div>
                        <div class="alert-sub">${a.sub}</div>
                    </div>
                </div>`).join('')}
        </div>`;
}

/**
 * Switch Main Content Section (kept for backward compatibility)
 */
function switchSection(sectionId) {
    if (sectionId === 'dashboard') {
        const adminDb = document.getElementById('adminDashboard');
        if (adminDb) adminDb.style.display = 'block';
    }
}

/**
 * Session 5: Real-Time Update Module
 * Polling every 15 seconds to update dashboard status
 */
function startRealTimeUpdates() {
    console.log("[SBMS LOG] Starting real-time updates (15s interval)");
    // Initial fetch
    updateDashboardStats();

    // Set polling interval (15 seconds)
    setInterval(updateDashboardStats, 15000);
}

let issueStatusChartInst = null;
let issueLocationChartInst = null;
let issueTimeChartInst = null;
let billOverviewChartInst = null;

// Track previous issues count to push notifications on changes
let _prevPending = -1;
let _prevTotal = -1;
let _prevResolved = -1;

async function updateDashboardStats() {
    const role = sessionStorage.getItem('userRole');
    if (!role) return;

    try {
        if (role === 'admin') {
            const startTime = Date.now();
            const [dataRes, statsRes] = await Promise.all([
                fetch('DashboardDataServlet'),
                fetch('api/dashboard/stats')
            ]);
            if (!dataRes.ok || !statsRes.ok) throw new Error('Network response was not ok');

            const dataObj = await dataRes.json();
            const statsObj = await statsRes.json();
            const data = { ...dataObj, ...statsObj };

            console.log(`[SBMS] Admin stats updated in ${Date.now() - startTime}ms`);

            // Store for dark mode re-render
            _lastDashboardData = data;

            // Swap skeleton cards → real stat cards
            renderStatCards(data);

            // Smart Alerts
            renderSmartAlerts(data);

            // Maint KPIs
            const mA = document.getElementById('maintAssigned');
            const mC = document.getElementById('maintCompleted');
            const mT = document.getElementById('maintAvgResTime');
            if (mA && data.maintAssigned !== undefined) mA.textContent = data.maintAssigned;
            if (mC && data.maintCompleted !== undefined) mC.textContent = data.maintCompleted;
            if (mT && data.avgResolutionTime !== undefined)
                mT.textContent = parseFloat(data.avgResolutionTime).toFixed(1) + ' hrs';

            // ── CORRECTED Notification logic: only fire on actual count CHANGES ──
            const curTotal = data.totalIssues ?? 0;
            const curResolved = data.resolvedIssues ?? 0;
            const curPending = data.pendingRequests ?? 0;

            if (_prevTotal !== -1) {
                // New issue was reported
                if (curTotal > _prevTotal) {
                    const diff = curTotal - _prevTotal;
                    pushNotification(`🔔 ${diff} new issue${diff > 1 ? 's' : ''} reported`, 'issue');
                }
                // An issue was actually resolved (resolved count went UP)
                if (curResolved > _prevResolved) {
                    const diff = curResolved - _prevResolved;
                    pushNotification(`✅ ${diff} issue${diff > 1 ? 's' : ''} completed by maintenance`, 'resolved');
                }
            }
            _prevTotal = curTotal;
            _prevPending = curPending;
            _prevResolved = curResolved;

            // DB-level notification sync
            if (data.unreadNotifications !== undefined) {
                const dbUnread = data.unreadNotifications;
                // Only update badge if DB has MORE unread than our local count (new server notifications)
                if (dbUnread > _unreadCount) {
                    updateNotifBadge(dbUnread);
                    // Merge DB notifications into local list
                    if (data.dbNotifications) {
                        data.dbNotifications.forEach(n => {
                            const existing = _notifications.find(x => x.dbId === n.id);
                            if (!existing) {
                                const notif = {
                                    id: Date.now() + Math.random(),
                                    dbId: n.id,
                                    text: n.message,
                                    type: n.type || 'default',
                                    timeStr: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                                    unread: !n.is_read
                                };
                                _notifications.push(notif);
                            }
                        });
                        _notifications.sort((a, b) => b.id - a.id);
                        if (_notifications.length > 20) _notifications = _notifications.slice(0, 20);
                        renderNotifList();
                    }
                }
            }

            renderDashboardCharts(data);
            renderEnergyCharts(data);
            renderRecentActivities(data.recentActivities);
            renderActivityLog(data.recentActivities);
            renderPredictiveMaintenance(data.predictiveMaintenance);
            renderTechnicianPerformance(data.technicianPerformance);
            loadIssues('admin');

        } else if (role === 'resident') {
            loadIssues('resident');
            loadBills(sessionStorage.getItem('userId'));
        } else if (role === 'maintenance') {
            loadIssues('maintenance');
        }

    } catch (error) {
        console.error('[SBMS] Error fetching dashboard data:', error);
    }
}

function renderDashboardCharts(data) {
    if (typeof Chart === 'undefined') return; // Chart.js not loaded

    const fontFamily = "'Outfit', sans-serif";
    const legendFont = { family: fontFamily, size: 11 };
    const tickFont = { family: fontFamily, size: 11 };

    // ── 1. Issue Status Doughnut ──
    const statusCanvas = document.getElementById('issueStatusChart');
    if (statusCanvas) {
        const dist = (data && data.issueStatusDist && Object.keys(data.issueStatusDist).length)
            ? data.issueStatusDist
            : { Pending: 8, Assigned: 5, 'In Progress': 4, Completed: 12 };
        const labels = Object.keys(dist);
        const vals = Object.values(dist);
        if (issueStatusChartInst) issueStatusChartInst.destroy();
        issueStatusChartInst = new Chart(statusCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: vals,
                    backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: legendFont, padding: 10, boxWidth: 10 } }
                }
            }
        });
    }

    // ── 2. Issues By Location Bar ──
    const locCanvas = document.getElementById('issueLocationChart');
    if (locCanvas) {
        const locData = (data && data.issuesByLocation && Object.keys(data.issuesByLocation).length)
            ? data.issuesByLocation
            : { 'A-Block': 7, 'B-Block': 5, 'C-Block': 9, 'D-Block': 3, 'E-Block': 6 };
        const labels = Object.keys(locData);
        const vals = Object.values(locData);
        if (issueLocationChartInst) issueLocationChartInst.destroy();
        issueLocationChartInst = new Chart(locCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Issues',
                    data: vals,
                    backgroundColor: 'rgba(37,99,235,0.75)',
                    borderRadius: 6,
                    barPercentage: 0.55
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: tickFont } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: tickFont, stepSize: 2 }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ── 3. Issues Over Time Line ──
    const timeCanvas = document.getElementById('issueTimeChart');
    if (timeCanvas) {
        const timeData = (data && data.issuesOverTime && Object.keys(data.issuesOverTime).length)
            ? data.issuesOverTime
            : { Jan: 4, Feb: 9, Mar: 6, Apr: 12, May: 8, Jun: 15 };
        const labels = Object.keys(timeData);
        const vals = Object.values(timeData);
        if (issueTimeChartInst) issueTimeChartInst.destroy();
        issueTimeChartInst = new Chart(timeCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Issues Reported',
                    data: vals,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    pointBackgroundColor: '#f59e0b',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { font: tickFont } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: tickFont, stepSize: 3 }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ── 4. Bills Overview Doughnut ──
    const billCanvas = document.getElementById('billOverviewChart');
    if (billCanvas) {
        const paid = (data && data.paidBills !== undefined) ? data.paidBills : 0;
        const pending = (data && data.pendingBills !== undefined) ? data.pendingBills : 0;
        if (billOverviewChartInst) billOverviewChartInst.destroy();
        billOverviewChartInst = new Chart(billCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Pending'],
                datasets: [{
                    data: [paid || 98, pending || 26],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: legendFont, padding: 10, boxWidth: 10 } }
                }
            }
        });
    }
}

function renderRecentActivities(activities) {
    const list = document.getElementById('recentActivityList');
    if (!list) return;
    list.innerHTML = '';
    if (!activities || activities.length === 0) {
        list.innerHTML = `<li class="activity-item"><div class="activity-dot" style="background:#94a3b8;"></div><div><div class="activity-text text-muted">No recent activities.</div></div></li>`;
        return;
    }

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    activities.forEach((act, i) => {
        const color = colors[i % colors.length];
        const timeAgo = new Date(act.timestamp).toLocaleString();
        list.innerHTML += `
            <li class="activity-item">
                <div class="activity-dot" style="background:${color};"></div>
                <div>
                    <div class="activity-text">${act.description}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </li>
        `;
    });
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

    // Validation logic
    if (password !== confirmPassword) {
        showError(errorAlert, 'Passwords do not match');
        return;
    }

    if (password.length < 6) {
        showError(errorAlert, 'Password must be at least 6 characters long');
        return;
    }

    // Phone Number Validation
    const phonePattern = /^[6-9]\d{9}$/;
    if (!phonePattern.test(phone)) {
        showError(errorAlert, 'Enter a valid 10 digit phone number starting with 6,7,8,9');
        return;
    }

    const payload = {
        name, username, email, password, role, phone
    };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    submitBtn.disabled = true;

    fetch('api/users?action=signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(r => r.json().then(data => ({ status: r.status, data })))
        .then(({ status, data }) => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (data.success) {
                showSuccessAlert('Account Created!', 'You can now log in with your credentials.');
                setTimeout(() => showLogin(), 1500);
            } else {
                showError(errorAlert, data.message || 'Error occurred during signup.');
            }
        })
        .catch(err => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            showError(errorAlert, 'Network Error. Could not reach server.');
        });
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

    const payload = { username: loginInput, password: password };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    submitBtn.disabled = true;

    fetch('api/users?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(r => r.json().then(data => ({ status: r.status, data })))
        .then(({ status, data }) => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (data.success && data.user) {
                errorAlert.style.display = 'none';
                // Store session data
                sessionStorage.setItem('userRole', data.user.role);
                sessionStorage.setItem('userName', data.user.name);
                sessionStorage.setItem('userId', data.user.username);

                // Redirect to dashboard
                showDashboard(data.user.role);

                // Clear inputs
                usernameInput.value = '';
                passwordInput.value = '';
            } else {
                errorAlert.style.display = 'block';
                errorAlert.textContent = data.message || 'Invalid username/email or password';

                const loginCard = document.querySelector('.auth-card');
                if (loginCard) {
                    loginCard.classList.add('shake-animation');
                    setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
                }
            }
        })
        .catch(err => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            errorAlert.style.display = 'block';
            errorAlert.textContent = 'Network Error. Could not reach server.';
        });
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
    if (storedName) roleDisplay.textContent = storedName;

    // Role-Based Sidebar Navigation Restriction
    const adminLinks = document.querySelectorAll('.admin-only');
    if (role === 'admin') {
        adminLinks.forEach(link => { link.style.display = 'flex'; });
    } else {
        adminLinks.forEach(link => { link.style.display = 'none'; });
    }

    // Show appropriate dashboard
    switch (role) {
        case 'admin':
            document.getElementById('adminDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Administrator';
            document.getElementById('navPageTitle').textContent = 'System Overview';
            // Render placeholder charts immediately, updated when real data arrives
            renderDashboardCharts({});
            loadIssues('admin');
            // Welcome notification
            setTimeout(() => pushNotification('🏢 Welcome to SBMS Admin Dashboard', 'default'), 800);
            break;
        case 'maintenance':
            document.getElementById('maintenanceDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Maintenance Staff';
            document.getElementById('navPageTitle').textContent = 'Maintenance Portal';
            loadIssues('maintenance');
            break;
        case 'resident':
            document.getElementById('residentDashboard').style.display = 'block';
            if (!storedName) roleDisplay.textContent = 'Resident';
            document.getElementById('navPageTitle').textContent = 'Resident Portal';
            loadIssues('resident');
            break;
    }
}


// ========================================
// FORM INITIALIZATION
// ========================================

function initializeForms() {
    // Admin Forms
    const adminBlockForm = document.getElementById('adminBlockForm');
    const adminRoomForm = document.getElementById('adminRoomForm');
    const adminEnergyForm = document.getElementById('adminEnergyForm');

    // Maintenance Form
    const maintenanceUpdateForm = document.getElementById('maintenanceUpdateForm');

    // Resident Form
    const residentMaintenanceForm = document.getElementById('residentMaintenanceForm');

    // Add event listeners
    if (adminBlockForm) {
        adminBlockForm.addEventListener('submit', handleAdminBlockSubmit);
    }
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
function handleAdminBlockSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;

    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }

    const blockName = document.getElementById('adminBlockName').value.trim();
    const totalFloors = document.getElementById('adminTotalFloors').value;
    const roomsPerFloor = document.getElementById('adminRoomsPerFloor').value;

    const body = new URLSearchParams({ blockName, totalFloors, roomsPerFloor });
    fetch('api/buildings/blocks/create', { method: 'POST', body })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showSuccessAlert('Block Configured', `Block ${blockName} was successfully created with auto-generated floors and rooms.`);
                form.reset();
                form.classList.remove('was-validated');
                loadBuildingBlocks();
                updateDashboardStats();
            } else {
                showErrorAlert('Error', data.message || 'Failed to save configuration.');
            }
        })
        .catch(() => showErrorAlert('Network Error', 'Could not reach the server.'));
}

window.loadBuildingBlocks = function () {
    const tableBody = document.getElementById('buildingBlocksTableBody');
    const filterSelect = document.getElementById('filterBlockSelect');

    fetch('api/buildings/blocks')
        .then(res => res.json())
        .then(data => {
            if (tableBody) {
                if (!data || data.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="font-size:.8rem;padding:1rem;">No blocks configured yet.</td></tr>`;
                } else {
                    tableBody.innerHTML = data.map(b => `
                    <tr>
                        <td class="fw-bold">${b.block_name}</td>
                        <td>${b.total_floors}</td>
                        <td>${b.rooms_per_floor}</td>
                    </tr>
                `).join('');
                }
            }
            if (filterSelect) {
                let options = '<option value="">All Blocks</option>';
                if (data && data.length > 0) {
                    options += data.map(b => `<option value="${b.block_id}">${b.block_name}</option>`).join('');
                }
                // Retain selection if possible
                const prevVal = filterSelect.value;
                filterSelect.innerHTML = options;
                if (prevVal) filterSelect.value = prevVal;
            }
            loadAdminRooms();
        })
        .catch(console.error);
};

window.loadAdminRooms = function () {
    const tableBody = document.getElementById('adminRoomsTableBody');
    const blockSelect = document.getElementById('filterBlockSelect');
    if (!tableBody) return;

    let url = 'api/buildings/rooms';
    if (blockSelect && blockSelect.value) {
        url += '?block_id=' + blockSelect.value;
    }

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="font-size:.8rem;padding:1rem;">No rooms found.</td></tr>`;
                return;
            }
            tableBody.innerHTML = data.map(r => {
                let statusBadge = '';
                if (r.status === 'Empty') statusBadge = '<span class="badge bg-success">Empty</span>';
                else if (r.status === 'Occupied') statusBadge = '<span class="badge bg-danger">Occupied</span>';
                else if (r.status === 'Maintenance') statusBadge = '<span class="badge bg-warning text-dark">Maintenance</span>';

                return `
            <tr>
                <td class="fw-bold">${r.room_id}</td>
                <td>${r.block_name}</td>
                <td>Floor ${r.floor_number}</td>
                <td>${statusBadge}</td>
                <td class="text-end">
                    <select class="form-select form-select-sm d-inline-block" style="width:120px; font-size:.75rem;" onchange="updateRoomStatus(${r.id}, this.value)">
                        <option value="Empty" ${r.status === 'Empty' ? 'selected' : ''}>Empty</option>
                        <option value="Occupied" ${r.status === 'Occupied' ? 'selected' : ''}>Occupied</option>
                        <option value="Maintenance" ${r.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                    </select>
                </td>
            </tr>
        `}).join('');
        })
        .catch(console.error);
};

window.updateRoomStatus = function (id, newStatus) {
    const body = new URLSearchParams({ id, status: newStatus });
    fetch('api/buildings/rooms/status', { method: 'POST', body })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                updateDashboardStats();
                // Optional: loadAdminRooms(); but updateDashboardStats will trigger a refresh if we wire it.
                // Directly loadAdminRooms to get actual status:
                loadAdminRooms();
            } else {
                alert('Failed to update room status.');
            }
        })
        .catch(console.error);
};
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

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
    submitBtn.disabled = true;

    fetch('api/issues?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            console.log("[SBMS DEBUG] Received response data:", data);
            if (data.success) {
                showSuccessAlert('Issue Reported!', 'Your issue has been submitted successfully and is pending review.');
                form.reset();
                form.classList.remove('was-validated');
                updateDashboardStats();
            } else {
                showErrorAlert('Error reporting issue', data.message || 'Unknown error');
            }
        }).catch(err => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            console.error("[SBMS DEBUG] Fetch error:", err);
            showErrorAlert('Error', 'Internal Error. Check console logs.');
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
    const payload = {
        issue_id: issueId,
        admin_id: sessionStorage.getItem('userId'),
        assigned_to: 'staff'
    };
    fetch('api/issues?action=assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json()).then(data => {
        if (data.success) {
            showSuccessAlert('Assigned!', 'Issue assigned to maintenance staff.');
            pushNotification(`🔧 Issue #${issueId} assigned to maintenance`, 'assign');
            loadIssues('admin');
            updateDashboardStats();
        } else {
            showErrorAlert('Assignment Failed', data.message || 'Unknown error');
        }
    }).catch(err => {
        console.error("[SBMS] Assignment error:", err);
        showErrorAlert('Network Error', 'Could not assign issue.');
    });
}


function renderMaintenanceIssues(issues) {
    const list = document.getElementById('workOrderList');
    if (!list) return;
    list.innerHTML = '';

    if (!issues || issues.length === 0) {
        list.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-check-circle d-block mb-3" style="font-size: 2.5rem; opacity: 0.3;"></i>
                No work orders assigned to you yet.
            </div>
        `;
        return;
    }

    issues.forEach(iss => {
        const p = (iss.priority || '').toLowerCase();
        const bg = p === 'high' ? 'bg-danger' : (p === 'critical' ? 'bg-dark' : 'bg-warning');
        list.innerHTML += `
            <div class="p-4 border rounded-4 mb-3 work-order-item shadow-sm" style="border-left: 4px solid ${p === 'high' ? '#ef4444' : '#f59e0b'} !important;">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h4 class="m-0 fw-bold">${iss.title} - ${iss.location}</h4>
                    <div>
                        <span class="badge ${bg} me-2">${iss.priority} Priority</span>
                        <span class="badge bg-secondary">ID: ${iss.issue_id}</span>
                    </div>
                </div>
                <p class="text-muted">${iss.description}</p>
                <div class="d-flex gap-2 mt-3 align-items-center">
                    <span class="small fw-semibold text-muted">Status:</span>
                    <select class="form-select form-select-sm status-select" style="width: 150px; border-radius: 8px;" onchange="updateMaintStatus(${iss.issue_id}, this.value)">
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
// BILLS MANAGEMENT
// ========================================

function loadBills(residentId) {
    if (!residentId) return;
    fetch(`api/bills?resident_id=${residentId}`)
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('residentBillsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (data.success && data.data && data.data.length > 0) {
                data.data.forEach(bill => {
                    let statusBadge = bill.status === 'Paid' ? 'bg-success' : 'bg-danger';
                    let actionBtn = bill.status === 'Paid' ?
                        `<span class="text-success"><i class="bi bi-check-circle"></i> Paid on ${new Date(bill.payment_date).toLocaleDateString()}</span>` :
                        `<button class="btn btn-sm btn-outline-success" onclick="payBill(${bill.bill_id})">Pay Now</button>`;

                    tbody.innerHTML += `
                        <tr>
                            <td class="fw-bold">#${bill.bill_id}</td>
                            <td>$${parseFloat(bill.amount).toFixed(2)}</td>
                            <td>${new Date(bill.due_date).toLocaleDateString()}</td>
                            <td><span class="badge ${statusBadge} px-2 py-1">${bill.status}</span></td>
                            <td>${actionBtn}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No bills found.</td></tr>';
            }
        })
        .catch(err => {
            console.error('[SBMS] Error fetching bills', err);
            const tbody = document.getElementById('residentBillsTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading bills.</td></tr>';
        });
}

function payBill(billId) {
    const payload = { bill_id: billId };
    fetch('api/bills?action=pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showSuccessAlert('Payment Successful', 'Your bill has been paid.');
                loadBills(sessionStorage.getItem('userId'));
            } else {
                showErrorAlert('Payment Failed', data.message || 'Error processing payment.');
            }
        })
        .catch(err => {
            console.error('[SBMS] Payment error:', err);
            showErrorAlert('Network Error', 'Could not process payment.');
        });
}

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

// ========================================
// ADVANCED REPORTING SYSTEM
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    const emailToggle = document.getElementById('reportEmailDelivery');
    if (emailToggle) {
        emailToggle.addEventListener('change', (e) => {
            const emailSection = document.getElementById('emailDeliverySection');
            if (e.target.checked) {
                emailSection.style.display = 'block';
                document.getElementById('reportEmailAddress').required = true;
            } else {
                emailSection.style.display = 'none';
                document.getElementById('reportEmailAddress').required = false;
            }
        });
    }
});

function openReportModal() {
    const rModal = new bootstrap.Modal(document.getElementById('reportModal'));
    rModal.show();
}

function loadReportHistory() {
    fetch('ReportServlet?action=history')
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById('reportHistoryTable');
            if (!tbody) return;
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="font-size:.8rem;">No reports found.</td></tr>';
                return;
            }
            let html = '';
            data.forEach(r => {
                const extIcon = r.format === 'PDF' ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-spreadsheet text-success';
                const badgeFormat = r.format === 'PDF' ? 'bg-danger' : 'bg-success';

                // Reformat timestamp
                const dt = new Date(r.date);
                const formattedDate = dt.toLocaleDateString() + " " + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                html += `<tr>
                <td style="font-weight:600;"><i class="bi ${extIcon} me-2"></i>${r.type}</td>
                <td><span class="badge ${badgeFormat} bg-opacity-10 text-dark border">${r.format}</span></td>
                <td>${r.generated_by}</td>
                <td style="font-size:.8rem;">${formattedDate}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="downloadReport(${r.id}, '${r.format}')" title="Download"><i class="bi bi-download"></i></button>
                    <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteReport(${r.id})" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
            });
            tbody.innerHTML = html;
        }).catch(err => console.error("Error loading report history:", err));
}

function loadReportSchedules() {
    fetch('ReportServlet?action=schedules')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('scheduledReportsList');
            if (!list) return;
            if (!data || data.length === 0) {
                list.innerHTML = '<li class="text-center py-3 text-muted" style="font-size:.8rem;">No scheduled reports.</li>';
                return;
            }
            let html = '';
            data.forEach(s => {
                const extIcon = s.format === 'PDF' ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-spreadsheet text-success';
                html += `<li class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <div>
                    <i class="bi ${extIcon} me-2"></i><strong>${s.frequency}</strong> ${s.type}
                </div>
                <button class="btn btn-sm text-danger px-1" title="Cancel Schedule" onclick="deleteSchedule(${s.id})"><i class="bi bi-x-circle-fill"></i></button>
            </li>`;
            });
            list.innerHTML = html;
        }).catch(err => console.error("Error loading schedules:", err));
}

function deleteReport(id) {
    if (!confirm('Are you sure you want to delete this report?')) return;
    fetch(`ReportServlet?action=delete&id=${id}`, { method: 'POST' })
        .then(() => loadReportHistory());
}

function deleteSchedule(id) {
    if (!confirm('Are you sure you want to cancel this scheduled report?')) return;
    fetch(`ReportServlet?action=deleteSchedule&id=${id}`, { method: 'POST' })
        .then(() => loadReportSchedules());
}

async function executeReportGeneration() {
    const type = document.getElementById('reportTypeSelect').value;
    const format = document.getElementById('reportFormatSelect').value;
    const schedule = document.getElementById('reportScheduleOption').value;
    const emailCheck = document.getElementById('reportEmailDelivery').checked;
    const userRole = getCurrentRole() || 'Admin';

    // Spinner overlay
    const btnText = document.getElementById('reportBtnText');
    const loader = document.getElementById('reportLoader');
    btnText.textContent = schedule === 'Manual' ? 'Generating...' : 'Scheduling...';
    loader.style.display = 'inline-block';

    // Simulate generation / upload delay
    await new Promise(r => setTimeout(r, 1200));

    if (schedule === 'Manual') {
        const payload = new URLSearchParams();
        payload.append('action', 'upload');
        payload.append('report_type', type + ' Report');
        payload.append('file_format', format);
        payload.append('generated_by', userRole);
        const dateStr = new Date().toISOString().split('T')[0];
        const formattedType = type.toLowerCase().replace(/\s+/g, '-');
        payload.append('file_name', `${formattedType}-report-${dateStr}.${format === 'PDF' ? 'pdf' : 'xlsx'}`);

        try {
            const res = await fetch('ReportServlet', {
                method: 'POST',
                body: payload
            });
            const data = await res.json();
            if (data.status === 'success' && data.id) {
                // Download instantly using BLOB via our new function
                await downloadReport(data.id, format);
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (e) {
            console.error(e);
            loader.style.display = 'none';
            btnText.textContent = 'Generate Now';
            if (typeof showErrorAlert === 'function') {
                showErrorAlert('Report Failed', 'Report generation failed. Please try again.');
            } else {
                alert('Report generation failed. Please try again.');
            }
            return;
        } // closes catch
    } else { // closes if and starts else
        const payload = new URLSearchParams();
        payload.append('action', 'schedule');
        payload.append('report_type', type + ' Report');
        payload.append('format', format);
        payload.append('frequency', schedule);
        payload.append('created_by', userRole);

        await fetch('ReportServlet', {
            method: 'POST',
            body: payload
        });
    }

    loader.style.display = 'none';
    btnText.textContent = 'Generate Now';

    // Hide Modal using bootstrap
    const modalEl = document.getElementById('reportModal');
    const bModal = bootstrap.Modal.getInstance(modalEl);
    if (bModal) bModal.hide();

    let alertMsg = schedule === 'Manual' ? `Your ${type} report has been successfully generated and stored.` : `Your ${schedule} automated report schedule for ${type} has been activated.`;

    if (emailCheck) {
        alertMsg += `<br><em>An email copy has been dispatched successfully.</em>`;
    }

    // Refresh Panels
    loadReportHistory();
    loadReportSchedules();

    if (typeof showSuccessAlert === 'function') {
        showSuccessAlert('Report Action Successful', alertMsg);
    } else {
        alert(alertMsg.replace(/<br>/g, "\n").replace(/<em>/g, "").replace(/<\/em>/g, ""));
    }
}

// Hook into the main dashboard loader to fetch history & schedules automatically
const _originalUpdateDashboardStats = window.updateDashboardStats;
window.updateDashboardStats = function () {
    if (typeof _originalUpdateDashboardStats === 'function') {
        _originalUpdateDashboardStats();
    }
    loadReportHistory();
    loadReportSchedules();
    if (typeof loadBuildingBlocks === 'function') loadBuildingBlocks();
};

/**
 * Handle Report Download by fetching blob from /api/reports/download/:id
 */
async function downloadReport(reportId, format) {
    try {
        const response = await fetch(`api/reports/download/${reportId}`);
        if (!response.ok) {
            throw new Error('Failed to download report. It may be corrupted or unavailable.');
        }

        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error('Received an empty file. Report generation might have failed.');
        }

        let filename = 'issues-report-' + new Date().toISOString().split('T')[0] + '.' + (format && format.toLowerCase() === 'excel' ? 'xlsx' : 'pdf');
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.indexOf('filename="') !== -1) {
            filename = disposition.split('filename="')[1].split('"')[0];
        }

        // Create temporary download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Clean up properly with delay so browser has time to trigger download
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            a.remove();
            showSuccessAlert('Success!', 'Report download started.');
        }, 1000);
    } catch (e) {
        console.error(e);
        showErrorAlert('Download Error', e.message);
    }
}
