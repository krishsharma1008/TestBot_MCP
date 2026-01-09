// Main Reporter Script for Dashboard
let parser;
let currentScope = 'all';
let currentFilter = 'all';
let currentSort = { column: null, direction: 'asc' };
let statusChart, suiteChart;

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    parser = new TestDataParser();
    await parser.loadData();
    initializeDashboard();
});

/**
 * Initialize the dashboard with all components
 */
function initializeDashboard() {
    refreshDashboard();
    setupEventListeners();
}

function refreshDashboard() {
    setActiveScopeTab(currentScope);
    updateScopeCounts();
    updateKPIs();
    renderCategoryCards();
    renderCharts();
    renderTestTable();
}

function setActiveScopeTab(scope = 'all') {
    document.querySelectorAll('.scope-tab').forEach(tab => {
        const isActive = tab.dataset.scope === scope;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

function updateScopeCounts() {
    if (!parser) return;
    const allStats = parser.getScopeStats('all');
    const frontendStats = parser.getScopeStats('frontend');
    const backendStats = parser.getScopeStats('backend');

    const allNode = document.getElementById('scopeAllCount');
    const feNode = document.getElementById('scopeFrontendCount');
    const beNode = document.getElementById('scopeBackendCount');

    if (allNode) allNode.textContent = allStats.total ?? 0;
    if (feNode) feNode.textContent = frontendStats.total ?? 0;
    if (beNode) beNode.textContent = backendStats.total ?? 0;
}

/**
 * Update KPI cards with test statistics
 */
function updateKPIs() {
    const stats = parser.getScopeStats(currentScope);
    
    // Update test date
    document.getElementById('testDate').textContent = 
        TestDataParser.formatTimestamp(stats.startTime);
    
    // Update metrics
    document.getElementById('totalTests').textContent = stats.total;
    document.getElementById('passedTests').textContent = stats.passed;
    document.getElementById('failedTests').textContent = stats.failed;
    document.getElementById('skippedTests').textContent = stats.skipped;
    
    // Calculate and update percentages
    const passedPercentage = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    const failedPercentage = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;
    const skippedPercentage = stats.total > 0 ? Math.round((stats.skipped / stats.total) * 100) : 0;
    
    document.getElementById('passedPercentage').textContent = `${passedPercentage}%`;
    document.getElementById('failedPercentage').textContent = `${failedPercentage}%`;
    document.getElementById('skippedPercentage').textContent = `${skippedPercentage}%`;
    
    // Update pass rate
    document.getElementById('passRate').textContent = `${stats.passRate}%`;
    document.getElementById('passRateBar').style.width = `${stats.passRate}%`;
    
    // Update durations
    document.getElementById('totalDuration').textContent = 
        TestDataParser.formatDuration(stats.duration);
    document.getElementById('avgDuration').textContent = 
        `Avg: ${TestDataParser.formatDuration(stats.avgDuration)}`;
    
    // Update filter badges
    document.getElementById('filterAllCount').textContent = stats.total;
    document.getElementById('filterPassedCount').textContent = stats.passed;
    document.getElementById('filterFailedCount').textContent = stats.failed;
    document.getElementById('filterSkippedCount').textContent = stats.skipped;

    updateCategoryKpis();
}

function updateCategoryKpis() {
    const frontendStats = parser.getCategoryStat('Frontend');
    const backendStats = parser.getCategoryStat('Backend');

    updateCategoryKpiCard({
        totalEl: 'frontendTotal',
        passedEl: 'frontendPassed',
        failedEl: 'frontendFailed',
        passRateEl: 'frontendPassRate',
        barEl: 'frontendPassRateBar',
        stats: frontendStats
    });

    updateCategoryKpiCard({
        totalEl: 'backendTotal',
        passedEl: 'backendPassed',
        failedEl: 'backendFailed',
        passRateEl: 'backendPassRate',
        barEl: 'backendPassRateBar',
        stats: backendStats
    });
}

function updateCategoryKpiCard({ totalEl, passedEl, failedEl, passRateEl, barEl, stats }) {
    const total = stats.total || 0;
    const passed = stats.passed || 0;
    const failed = stats.failed || 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const totalNode = document.getElementById(totalEl);
    const passedNode = document.getElementById(passedEl);
    const failedNode = document.getElementById(failedEl);
    const passRateNode = document.getElementById(passRateEl);
    const barNode = document.getElementById(barEl);

    if (!totalNode || !passedNode || !failedNode || !passRateNode || !barNode) {
        return;
    }

    totalNode.textContent = total;
    passedNode.textContent = passed;
    failedNode.textContent = failed;
    passRateNode.textContent = `Pass Rate: ${passRate}%`;
    barNode.style.width = `${passRate}%`;
}

function renderCategoryCards() {
    const categories = parser.getCategoryStats().filter(cat => {
        if (currentScope === 'all') return true;
        return cat.name.toLowerCase() === currentScope;
    });
    const container = document.getElementById('categoryCards');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        const passRate = cat.total ? Math.round((cat.passed / cat.total) * 100) : 0;
        card.innerHTML = `
            <div class="category-card__header">
                <h3>${escapeHtml(cat.name)}</h3>
                <span class="badge">${cat.total} tests</span>
            </div>
            <div class="category-card__metrics">
                <div>
                    <span class="label">Passed</span>
                    <strong>${cat.passed}</strong>
                </div>
                <div>
                    <span class="label">Failed</span>
                    <strong>${cat.failed}</strong>
                </div>
                <div>
                    <span class="label">Skipped</span>
                    <strong>${cat.skipped}</strong>
                </div>
            </div>
            <div class="category-card__progress">
                <span>Pass Rate</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${passRate}%;"></div>
                </div>
                <span class="pass-rate">${passRate}%</span>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Render charts using Chart.js
 */
function renderCharts() {
    const stats = parser.getScopeStats(currentScope);
    const suiteStats = parser.getSuiteStatsByScope(currentScope);
    
    if (statusChart) {
        statusChart.destroy();
    }
    if (suiteChart) {
        suiteChart.destroy();
    }
    
    // Status Distribution Pie Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed', 'Skipped'],
            datasets: [{
                data: [stats.passed, stats.failed, stats.skipped],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const percentage = stats.total > 0 
                                ? Math.round((value / stats.total) * 100) 
                                : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Suite Results Bar Chart
    const suiteCtx = document.getElementById('suiteChart').getContext('2d');
    const suiteLabels = suiteStats.map(s => s.name.split(' › ').pop());
    const suiteData = {
        passed: suiteStats.map(s => s.passed),
        failed: suiteStats.map(s => s.failed),
        skipped: suiteStats.map(s => s.skipped)
    };
    
    suiteChart = new Chart(suiteCtx, {
        type: 'bar',
        data: {
            labels: suiteLabels,
            datasets: [
                {
                    label: 'Passed',
                    data: suiteData.passed,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Failed',
                    data: suiteData.failed,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Skipped',
                    data: suiteData.skipped,
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Render test results table
 */
function renderTestTable() {
    const tests = getFilteredAndSortedTests();
    const tbody = document.getElementById('resultsTableBody');
    const noResults = document.getElementById('noResults');
    
    tbody.innerHTML = '';
    
    if (tests.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    
    noResults.style.display = 'none';
    
    tests.forEach(test => {
        const row = createTestRow(test);
        tbody.appendChild(row);
    });
}

/**
 * Create a table row for a test
 */
function createTestRow(test) {
    const tr = document.createElement('tr');
    tr.dataset.testId = test.id;
    tr.dataset.status = test.status;
    tr.dataset.suite = test.suite;
    
    // Normalize status
    let normalizedStatus = test.status;
    if (test.status === 'expected') normalizedStatus = 'passed';
    if (test.status === 'unexpected') normalizedStatus = 'failed';
    if (test.status === 'pending') normalizedStatus = 'skipped';
    
    tr.innerHTML = `
        <td>
            <div class="test-name">${escapeHtml(test.title)}</div>
            ${test.retries > 0 ? `<small style="color: var(--color-warning)">Retried ${test.retries} time(s)</small>` : ''}
        </td>
        <td>${escapeHtml(test.suite.split(' › ').pop())}</td>
        <td>
            <span class="status-badge status-${normalizedStatus}">
                ${TestDataParser.getStatusIcon(normalizedStatus)}
                ${normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)}
            </span>
        </td>
        <td>${TestDataParser.formatDuration(test.duration)}</td>
        <td>
            <button class="btn-details" data-test-id="${test.id}">
                <i class="fas fa-info-circle"></i> Details
            </button>
        </td>
    `;
    
    return tr;
}

/**
 * Get filtered and sorted tests
 */
function getFilteredAndSortedTests() {
    let tests = parser.getTestsByScope(currentScope);
    
    // Apply search filter
    const searchQuery = document.getElementById('searchInput').value;
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        tests = tests.filter(test =>
            test.title.toLowerCase().includes(lowerQuery) ||
            test.suite.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Apply status filter
    if (currentFilter !== 'all') {
        tests = tests.filter(test => {
            const status = test.status === 'expected' ? 'passed' : 
                          test.status === 'unexpected' ? 'failed' : 
                          test.status === 'pending' ? 'skipped' : 
                          test.status;
            return status === currentFilter;
        });
    }
    
    // Apply sorting
    if (currentSort.column) {
        tests = sortTests(tests, currentSort.column, currentSort.direction);
    }
    
    return tests;
}

/**
 * Sort tests by column
 */
function sortTests(tests, column, direction) {
    return [...tests].sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'name':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
            case 'suite':
                aVal = a.suite.toLowerCase();
                bVal = b.suite.toLowerCase();
                break;
            case 'status':
                aVal = a.status;
                bVal = b.status;
                break;
            case 'duration':
                aVal = a.duration;
                bVal = b.duration;
                break;
            default:
                return 0;
        }
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Scope tabs
    document.querySelectorAll('.scope-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const selectedScope = tab.dataset.scope || 'all';
            if (selectedScope === currentScope) return;
            currentScope = selectedScope;
            refreshDashboard();
        });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTestTable();
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(() => {
        renderTestTable();
    }, 300));
    
    // Sortable columns
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            
            // Update sort icons
            document.querySelectorAll('.sortable i').forEach(i => {
                i.className = 'fas fa-sort';
            });
            
            const icon = th.querySelector('i');
            icon.className = currentSort.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            
            renderTestTable();
        });
    });
    
    // Details buttons - using event delegation
    document.getElementById('resultsTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-details');
        if (btn) {
            const testId = btn.getAttribute('data-test-id');
            if (testId) {
                showTestDetails(testId);
            }
        }
    });
}

/**
 * Show test details in modal
 */
function showTestDetails(testId) {
    const test = parser.getTests().find(t => t.id === testId);
    if (!test) return;
    
    const modal = document.getElementById('testModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = test.title;
    
    let statusClass = test.status === 'expected' ? 'passed' : 
                     test.status === 'unexpected' ? 'failed' : 
                     test.status === 'pending' ? 'skipped' : 
                     test.status;
    
    modalBody.innerHTML = `
        <div class="test-detail-item">
            <strong>Suite:</strong> ${escapeHtml(test.suite)}
        </div>
        <div class="test-detail-item">
            <strong>Status:</strong>
            <span class="status-badge status-${statusClass}">
                ${TestDataParser.getStatusIcon(statusClass)}
                ${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}
            </span>
        </div>
        <div class="test-detail-item">
            <strong>Duration:</strong> ${TestDataParser.formatDuration(test.duration)}
        </div>
        <div class="test-detail-item">
            <strong>File:</strong> <code>${escapeHtml(test.file)}</code>
        </div>
        ${test.retries > 0 ? `
            <div class="test-detail-item">
                <strong>Retries:</strong> ${test.retries}
            </div>
        ` : ''}
        ${test.error ? `
            <div class="error-details">
                <h4><i class="fas fa-exclamation-triangle"></i> Error Details</h4>
                <p><strong>Message:</strong> ${escapeHtml(test.error.message)}</p>
                ${test.error.stack ? `
                    <pre>${escapeHtml(test.error.stack)}</pre>
                ` : ''}
            </div>
        ` : ''}
        ${renderTestArtifacts(test)}
    `;
    
    modal.classList.add('active');
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('testModal').classList.remove('active');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const testModal = document.getElementById('testModal');
    const artifactModal = document.getElementById('artifactModal');
    
    if (e.target === testModal) {
        closeModal();
    }
    if (e.target === artifactModal) {
        closeArtifactModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const testModal = document.getElementById('testModal');
        const artifactModal = document.getElementById('artifactModal');
        
        if (artifactModal.classList.contains('active')) {
            closeArtifactModal();
        } else if (testModal.classList.contains('active')) {
            closeModal();
        }
    }
});

/**
 * Utility: Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Render test artifacts section
 */
function renderTestArtifacts(test) {
    if (!test.attachments) {
        return '';
    }

    const { screenshots, videos, traces, other } = test.attachments;
    const hasArtifacts = screenshots.length > 0 || videos.length > 0 || traces.length > 0 || other.length > 0;

    if (!hasArtifacts) {
        return '';
    }

    let html = '<div class="test-artifacts"><h4><i class="fas fa-paperclip"></i> Test Artifacts</h4>';

    // Screenshots section
    if (screenshots.length > 0) {
        html += `
            <div class="artifact-section">
                <div class="artifact-section-title">
                    <i class="fas fa-image"></i> Screenshots
                    <span class="artifact-badge">${screenshots.length}</span>
                </div>
                <div class="artifacts-grid">
                    ${screenshots.map((screenshot, index) => `
                        <div class="artifact-item" onclick="viewArtifact('${escapeHtml(screenshot.path)}', 'image', '${escapeHtml(screenshot.name)}')">
                            <img src="${escapeHtml(screenshot.path)}" alt="${escapeHtml(screenshot.name)}" class="screenshot-preview" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <div class="artifact-item-icon" style="display:none;"><i class="fas fa-image"></i></div>
                            <div class="artifact-item-name">${escapeHtml(screenshot.name)}</div>
                            <div class="artifact-item-type">PNG Image</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Videos section
    if (videos.length > 0) {
        html += `
            <div class="artifact-section">
                <div class="artifact-section-title">
                    <i class="fas fa-video"></i> Videos
                    <span class="artifact-badge">${videos.length}</span>
                </div>
                <div class="artifacts-grid">
                    ${videos.map((video, index) => `
                        <div class="artifact-item" onclick="viewArtifact('${escapeHtml(video.path)}', 'video', '${escapeHtml(video.name)}')">
                            <div class="artifact-item-icon"><i class="fas fa-video"></i></div>
                            <div class="artifact-item-name">${escapeHtml(video.name)}</div>
                            <div class="artifact-item-type">WebM Video</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Traces section
    if (traces.length > 0) {
        html += `
            <div class="artifact-section">
                <div class="artifact-section-title">
                    <i class="fas fa-file-archive"></i> Traces
                    <span class="artifact-badge">${traces.length}</span>
                </div>
                <div class="artifacts-grid">
                    ${traces.map((trace, index) => `
                        <div class="artifact-item" onclick="window.open('${escapeHtml(trace.path)}', '_blank')">
                            <div class="artifact-item-icon"><i class="fas fa-file-archive"></i></div>
                            <div class="artifact-item-name">${escapeHtml(trace.name)}</div>
                            <div class="artifact-item-type">Trace File</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Other attachments section
    if (other.length > 0) {
        html += `
            <div class="artifact-section">
                <div class="artifact-section-title">
                    <i class="fas fa-file"></i> Other Files
                    <span class="artifact-badge">${other.length}</span>
                </div>
                <div class="artifacts-grid">
                    ${other.map((file, index) => `
                        <div class="artifact-item" onclick="window.open('${escapeHtml(file.path)}', '_blank')">
                            <div class="artifact-item-icon"><i class="fas fa-file"></i></div>
                            <div class="artifact-item-name">${escapeHtml(file.name)}</div>
                            <div class="artifact-item-type">${escapeHtml(file.contentType)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * View artifact in modal
 */
function viewArtifact(path, type, name) {
    const modal = document.getElementById('artifactModal');
    const modalTitle = document.getElementById('artifactModalTitle');
    const modalBody = document.getElementById('artifactModalBody');

    modalTitle.textContent = name;

    let content = '';
    if (type === 'image') {
        content = `
            <div class="artifact-viewer-content">
                <div class="artifact-viewer-media">
                    <img src="${escapeHtml(path)}" alt="${escapeHtml(name)}">
                </div>
                <div class="artifact-viewer-info">
                    <div class="artifact-viewer-info-item">
                        <strong>Name:</strong>
                        <span>${escapeHtml(name)}</span>
                    </div>
                    <div class="artifact-viewer-info-item">
                        <strong>Type:</strong>
                        <span>Screenshot</span>
                    </div>
                    <div class="artifact-viewer-info-item">
                        <a href="${escapeHtml(path)}" download class="artifact-download-btn">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'video') {
        content = `
            <div class="artifact-viewer-content">
                <div class="artifact-viewer-media">
                    <video controls>
                        <source src="${escapeHtml(path)}" type="video/webm">
                        Your browser does not support the video tag.
                    </video>
                </div>
                <div class="artifact-viewer-info">
                    <div class="artifact-viewer-info-item">
                        <strong>Name:</strong>
                        <span>${escapeHtml(name)}</span>
                    </div>
                    <div class="artifact-viewer-info-item">
                        <strong>Type:</strong>
                        <span>Test Recording</span>
                    </div>
                    <div class="artifact-viewer-info-item">
                        <a href="${escapeHtml(path)}" download class="artifact-download-btn">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    modalBody.innerHTML = content;
    modal.classList.add('active');
}

/**
 * Close artifact modal
 */
function closeArtifactModal() {
    document.getElementById('artifactModal').classList.remove('active');
}
