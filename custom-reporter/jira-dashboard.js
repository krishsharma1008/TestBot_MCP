// Jira Dashboard Integration Script

let jiraData = null;
let jiraBoardView = null;

/**
 * Load Jira enriched data
 */
async function loadJiraData() {
    try {
        const response = await fetch('jira-enriched-data.json');
        if (response.ok) {
            jiraData = await response.json();
            console.log('✅ Loaded Jira enriched data:', jiraData.stories.length, 'stories');
            return true;
        }
    } catch (error) {
        console.log('ℹ️  No Jira data available:', error.message);
    }
    return false;
}

/**
 * Load Jira board view
 */
async function loadJiraBoardView() {
    try {
        const response = await fetch('jira-board-view.json');
        if (response.ok) {
            jiraBoardView = await response.json();
            console.log('✅ Loaded Jira board view');
            return true;
        }
    } catch (error) {
        console.log('ℹ️  No Jira board view available:', error.message);
    }
    return false;
}

/**
 * Initialize Jira dashboard section
 */
async function initializeJiraDashboard() {
    const hasJiraData = await loadJiraData();
    const hasBoardView = await loadJiraBoardView();

    if (hasJiraData && hasBoardView) {
        showJiraSection();
        renderJiraBoard();
        enrichTestTableWithJira();
    }
}

/**
 * Show Jira section
 */
function showJiraSection() {
    const section = document.getElementById('jiraBoardSection');
    if (section) {
        section.style.display = 'block';
    }

    // Update project badge
    if (jiraData && jiraData.jiraProject) {
        const badge = document.getElementById('jiraProjectBadge');
        if (badge) {
            badge.textContent = jiraData.jiraProject;
        }
    }

    // Update Jira board link
    if (jiraData && jiraData.jiraBaseUrl && jiraData.jiraProject) {
        const link = document.getElementById('jiraBoardLink');
        if (link) {
            link.href = `${jiraData.jiraBaseUrl}/jira/software/projects/${jiraData.jiraProject}/board`;
        }
    }
}

/**
 * Render Jira board with stories
 */
function renderJiraBoard() {
    if (!jiraBoardView) return;

    // Update stats
    document.getElementById('jiraTodoCount').textContent = jiraBoardView.todo.length;
    document.getElementById('jiraInProgressCount').textContent = jiraBoardView.inProgress.length;
    document.getElementById('jiraDoneCount').textContent = jiraBoardView.done.length;

    // Update column counts
    document.getElementById('jiraTodoColumnCount').textContent = jiraBoardView.todo.length;
    document.getElementById('jiraInProgressColumnCount').textContent = jiraBoardView.inProgress.length;
    document.getElementById('jiraDoneColumnCount').textContent = jiraBoardView.done.length;

    // Render columns
    renderJiraColumn('jiraTodoColumn', jiraBoardView.todo, 'To Do');
    renderJiraColumn('jiraInProgressColumn', jiraBoardView.inProgress, 'In Progress');
    renderJiraColumn('jiraDoneColumn', jiraBoardView.done, 'Done');
}

/**
 * Render a Jira board column
 */
function renderJiraColumn(columnId, stories, columnName) {
    const column = document.getElementById(columnId);
    if (!column) return;

    if (stories.length === 0) {
        column.innerHTML = `
            <div class="jira-column-empty">
                <i class="fas fa-inbox"></i>
                <p>No stories in ${columnName}</p>
            </div>
        `;
        return;
    }

    column.innerHTML = stories.map(story => createStoryCard(story)).join('');
}

/**
 * Create a story card HTML
 */
function createStoryCard(story) {
    const passRate = story.passRate || 0;
    const progressClass = passRate >= 80 ? '' : passRate >= 50 ? 'medium' : 'low';
    const needsUpdateBadge = story.needsUpdate ? `
        <div class="jira-story-update-badge">
            <i class="fas fa-exclamation-triangle"></i>
            Needs update to ${story.recommendedStatus}
        </div>
    ` : '';

    return `
        <div class="jira-story-card ${story.needsUpdate ? 'needs-update' : ''}" 
             onclick="showStoryDetails('${story.key}')">
            <div class="jira-story-header">
                <span class="jira-story-key">${story.key}</span>
                <span class="jira-story-priority ${story.priority.toLowerCase()}">${story.priority}</span>
            </div>
            <div class="jira-story-summary">${escapeHtml(story.summary)}</div>
            <div class="jira-story-tests">
                <span class="jira-test-badge total">
                    <i class="fas fa-vial"></i> ${story.testsTotal}
                </span>
                <span class="jira-test-badge passed">
                    <i class="fas fa-check"></i> ${story.testsPassed}
                </span>
                ${story.testsFailed > 0 ? `
                    <span class="jira-test-badge failed">
                        <i class="fas fa-times"></i> ${story.testsFailed}
                    </span>
                ` : ''}
            </div>
            <div class="jira-story-progress">
                <div class="jira-story-progress-fill ${progressClass}" 
                     style="width: ${passRate}%"></div>
            </div>
            ${needsUpdateBadge}
        </div>
    `;
}

/**
 * Show story details modal
 */
function showStoryDetails(storyKey) {
    if (!jiraData) return;

    const story = jiraData.stories.find(s => s.key === storyKey);
    if (!story) return;

    const modal = document.getElementById('jiraStoryModal');
    const title = document.getElementById('jiraStoryModalTitle');
    const body = document.getElementById('jiraStoryModalBody');

    title.innerHTML = `
        <a href="${story.url}" target="_blank" style="color: inherit; text-decoration: none;">
            ${story.key}: ${escapeHtml(story.summary)}
            <i class="fas fa-external-link-alt" style="font-size: 0.875rem; margin-left: 0.5rem;"></i>
        </a>
    `;

    const passRate = story.testResults.passRate || 0;
    const progressClass = passRate >= 80 ? '' : passRate >= 50 ? 'medium' : 'low';

    body.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <strong>Status:</strong> 
                    <span class="test-jira-status ${story.statusCategory}">${story.status}</span>
                </div>
                <div style="flex: 1;">
                    <strong>Priority:</strong> 
                    <span class="jira-story-priority ${story.priority.toLowerCase()}">${story.priority}</span>
                </div>
            </div>
            ${story.assignee ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Assignee:</strong> ${escapeHtml(story.assignee.name)}
                </div>
            ` : ''}
            ${story.needsUpdate ? `
                <div class="jira-story-update-badge" style="margin-bottom: 1rem;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Recommended: Move to "${story.recommendedStatus}" based on test results
                </div>
            ` : ''}
        </div>

        <div style="margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 0.5rem;">Test Results</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
                <div class="jira-test-badge total" style="padding: 0.5rem; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold;">${story.testResults.total}</div>
                    <div style="font-size: 0.75rem;">Total</div>
                </div>
                <div class="jira-test-badge passed" style="padding: 0.5rem; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold;">${story.testResults.passed}</div>
                    <div style="font-size: 0.75rem;">Passed</div>
                </div>
                <div class="jira-test-badge failed" style="padding: 0.5rem; text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold;">${story.testResults.failed}</div>
                    <div style="font-size: 0.75rem;">Failed</div>
                </div>
                <div style="padding: 0.5rem; text-align: center; background: #f1f5f9; border-radius: 12px;">
                    <div style="font-size: 1.5rem; font-weight: bold;">${passRate}%</div>
                    <div style="font-size: 0.75rem;">Pass Rate</div>
                </div>
            </div>
            <div class="jira-story-progress" style="height: 8px;">
                <div class="jira-story-progress-fill ${progressClass}" style="width: ${passRate}%"></div>
            </div>
        </div>

        <div>
            <h4 style="margin-bottom: 0.5rem;">Related Tests</h4>
            <div style="max-height: 300px; overflow-y: auto;">
                ${story.testResults.tests.map(test => `
                    <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 6px; border-left: 3px solid ${test.status === 'passed' ? '#10b981' : test.status === 'failed' ? '#ef4444' : '#94a3b8'};">
                        <div style="display: flex; justify-content: between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${escapeHtml(test.title)}</div>
                                <div style="font-size: 0.75rem; color: #64748b;">
                                    Duration: ${TestDataParser.formatDuration(test.duration)}
                                </div>
                            </div>
                            <div>
                                ${test.status === 'passed' ? '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.25rem;"></i>' : ''}
                                ${test.status === 'failed' ? '<i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.25rem;"></i>' : ''}
                                ${test.status === 'skipped' ? '<i class="fas fa-forward" style="color: #94a3b8; font-size: 1.25rem;"></i>' : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

/**
 * Close story details modal
 */
function closeJiraStoryModal() {
    const modal = document.getElementById('jiraStoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Enrich test table with Jira story information
 */
function enrichTestTableWithJira() {
    if (!jiraData || !jiraData.testResults) return;

    // Add Jira column to table header if not exists
    const thead = document.querySelector('.results-table thead tr');
    if (thead && !document.querySelector('.jira-story-column')) {
        const th = document.createElement('th');
        th.className = 'jira-story-column';
        th.innerHTML = '<i class="fas fa-tasks"></i> Jira Story';
        thead.insertBefore(th, thead.children[2]); // Insert after Suite column
    }
}

/**
 * Get Jira story for test
 */
function getJiraStoryForTest(testId, testTitle, testFile) {
    if (!jiraData || !jiraData.testResults) return null;

    // Try to find test in enriched data
    const test = jiraData.testResults.find(t => 
        t.id === testId || 
        t.title === testTitle ||
        (t.file && testFile && t.file.includes(testFile))
    );

    return test ? test.jiraStory : null;
}

/**
 * Create Jira story cell for test table
 */
function createJiraStoryCell(test) {
    const jiraStory = getJiraStoryForTest(test.id, test.title, test.file);

    if (!jiraStory) {
        return '<td class="jira-story-column"><span style="color: #94a3b8;">—</span></td>';
    }

    const statusClass = jiraStory.status.toLowerCase().includes('progress') ? 'in-progress' : 
                       jiraStory.status.toLowerCase().includes('done') ? 'done' : 'todo';

    return `
        <td class="jira-story-column">
            <div class="test-jira-story">
                <a href="${jiraStory.url}" target="_blank" class="test-jira-link" title="${escapeHtml(jiraStory.summary)}">
                    ${jiraStory.key}
                </a>
                <span class="test-jira-status ${statusClass}">${jiraStory.status}</span>
            </div>
        </td>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Refresh Jira data
 */
async function refreshJiraData() {
    const btn = document.getElementById('refreshJiraBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
    }

    await initializeJiraDashboard();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    }
}

// Export functions for use in reporter.js
window.initializeJiraDashboard = initializeJiraDashboard;
window.closeJiraStoryModal = closeJiraStoryModal;
window.refreshJiraData = refreshJiraData;
window.createJiraStoryCell = createJiraStoryCell;
