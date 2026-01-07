// Data Parser for Playwright Test Results
class TestDataParser {
    constructor() {
        this.testData = null;
        this.suites = new Map();
        this.tests = [];
        this.categoryStats = new Map();
        this.resetAggregates();
    }

    resetAggregates() {
        this.stats = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            startTime: null,
            endTime: null,
            passRate: 0,
            failRate: 0,
            avgDuration: 0
        };
        this.suites = new Map();
        this.tests = [];
        this.categoryStats = new Map();
    }

    /**
     * Load test data from JSON file
     */
    async loadData(jsonPath = '../test-results.json') {
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to load test data: ${response.statusText}`);
            }
            this.testData = await response.json();
            this.parseData();
            return this.testData;
        } catch (error) {
            console.error('Error loading test data:', error);
            // Return mock data for demonstration if file doesn't exist
            return this.generateMockData();
        }
    }

    /**
     * Parse the loaded test data
     */
    parseData() {
        if (!this.testData || !this.testData.suites) {
            console.warn('No test data available to parse');
            return;
        }

        this.resetAggregates();
        this.stats.startTime = new Date(this.testData.config?.metadata?.actualStartTime || Date.now());
        
        // Parse all test suites
        this.testData.suites.forEach(suite => {
            this.parseSuite(suite);
        });

        // Calculate total duration
        this.stats.duration = this.tests.reduce((sum, test) => sum + (test.duration || 0), 0);
        this.stats.endTime = new Date(this.stats.startTime.getTime() + this.stats.duration);
    }

    /**
     * Parse a test suite recursively
     */
    parseSuite(suite, parentSuiteName = '') {
        const suiteName = parentSuiteName ? `${parentSuiteName} › ${suite.title}` : suite.title;

        // Initialize suite stats if not exists
        if (!this.suites.has(suiteName)) {
            this.suites.set(suiteName, {
                name: suiteName,
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            });
        }

        const suiteStats = this.suites.get(suiteName);

        // Parse tests in this suite
        if (suite.specs && suite.specs.length > 0) {
            suite.specs.forEach(spec => {
                this.parseSpec(spec, suiteName, suiteStats);
            });
        }

        // Parse nested suites
        if (suite.suites && suite.suites.length > 0) {
            suite.suites.forEach(nestedSuite => {
                this.parseSuite(nestedSuite, suiteName);
            });
        }
    }

    /**
     * Parse individual test spec
     */
    parseSpec(spec, suiteName, suiteStats) {
        // Get test results from all attempts
        const tests = spec.tests || [];
        
        tests.forEach(test => {
            const results = test.results || [];
            const lastResult = results[results.length - 1];
            
            if (!lastResult) return;

            const status = lastResult.status || 'unknown';
            const normalizedStatus = TestDataParser.normalizeStatus(status);
            const duration = lastResult.duration || 0;
            const error = lastResult.error;
            const category = this.getCategoryFromTest(test, spec.file);
            const attachments = this.parseAttachments(lastResult.attachments || []);

            // Create test object
            const testObj = {
                id: `${suiteName}-${spec.title}-${test.title || spec.title}`.replace(/\s+/g, '-'),
                title: test.title || spec.title,
                fullTitle: `${suiteName} › ${test.title || spec.title}`,
                suite: suiteName,
                category,
                status: normalizedStatus,
                duration: duration,
                error: error ? {
                    message: error.message || '',
                    stack: error.stack || ''
                } : null,
                retries: results.length - 1,
                file: spec.file || '',
                attachments: attachments
            };

            // Update statistics
            this.stats.total++;
            suiteStats.total++;
            suiteStats.duration += duration;

            switch (normalizedStatus) {
                case 'passed':
                case 'expected':
                    this.stats.passed++;
                    suiteStats.passed++;
                    break;
                case 'failed':
                case 'unexpected':
                    this.stats.failed++;
                    suiteStats.failed++;
                    break;
                case 'skipped':
                    this.stats.skipped++;
                    suiteStats.skipped++;
                    break;
                case 'pending':
                    this.stats.skipped++;
                    suiteStats.skipped++;
                    break;
                default:
                    break;
            }

            this.updateCategoryStats(category, normalizedStatus, duration);

            this.tests.push(testObj);
        });
    }

    getCategoryFromTest(test, filePath) {
        // First try to get category from projectName metadata
        if (test && test.projectName) {
            const projectName = test.projectName.toLowerCase();
            if (projectName === 'frontend') {
                return 'Frontend';
            }
            if (projectName === 'backend') {
                return 'Backend';
            }
        }
        
        // Fallback to file path detection
        if (!filePath) {
            return 'Other';
        }
        const normalized = filePath.replace(/\\/g, '/').toLowerCase();
        if (normalized.includes('frontend')) {
            return 'Frontend';
        }
        if (normalized.includes('backend')) {
            return 'Backend';
        }
        return 'Other';
    }

    parseAttachments(attachments) {
        if (!attachments || !Array.isArray(attachments)) {
            return {
                screenshots: [],
                videos: [],
                traces: [],
                other: []
            };
        }

        const parsed = {
            screenshots: [],
            videos: [],
            traces: [],
            other: []
        };

        attachments.forEach(attachment => {
            const { name, contentType, path } = attachment;
            
            if (!path) return;

            // Convert absolute path to relative path for web access
            const relativePath = this.convertToRelativePath(path);
            
            const attachmentObj = {
                name: name || 'Unnamed',
                contentType: contentType || 'application/octet-stream',
                path: relativePath,
                originalPath: path
            };

            // Categorize by content type
            if (contentType && contentType.startsWith('image/')) {
                parsed.screenshots.push(attachmentObj);
            } else if (contentType && contentType.startsWith('video/')) {
                parsed.videos.push(attachmentObj);
            } else if (name && (name.includes('trace') || contentType === 'application/zip')) {
                parsed.traces.push(attachmentObj);
            } else {
                parsed.other.push(attachmentObj);
            }
        });

        return parsed;
    }

    convertToRelativePath(absolutePath) {
        if (!absolutePath) return '';
        
        // Convert Windows backslashes to forward slashes
        let normalized = absolutePath.replace(/\\/g, '/');
        
        // Try to find test-results directory and make path relative to project root
        const testResultsIndex = normalized.indexOf('/test-results/');
        if (testResultsIndex !== -1) {
            return '..' + normalized.substring(testResultsIndex);
        }
        
        // Fallback: return the path as-is
        return normalized;
    }

    updateCategoryStats(category, status, duration) {
        if (!this.categoryStats.has(category)) {
            this.categoryStats.set(category, {
                name: category,
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            });
        }
        const entry = this.categoryStats.get(category);
        entry.total++;
        entry.duration += duration;

        switch (status) {
            case 'passed':
            case 'expected':
                entry.passed++;
                break;
            case 'failed':
            case 'unexpected':
                entry.failed++;
                break;
            case 'skipped':
            case 'pending':
                entry.skipped++;
                break;
            default:
                break;
        }
    }

    createEmptyCategoryStat(name = 'Category') {
        return {
            name,
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
    }

    getCategoryStat(categoryName) {
        if (!categoryName) {
            return this.createEmptyCategoryStat('Unknown');
        }
        const normalized = categoryName.toLowerCase();
        for (const [key, value] of this.categoryStats.entries()) {
            if (key.toLowerCase() === normalized) {
                return value;
            }
        }
        const formattedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        return this.createEmptyCategoryStat(formattedName);
    }

    getScopeStats(scope = 'all') {
        const normalizedScope = (scope || 'all').toLowerCase();
        if (normalizedScope === 'all') {
            return this.getStats();
        }

        const categoryName = TestDataParser.scopeToCategory(normalizedScope);
        const categoryStats = { ...this.getCategoryStat(categoryName) };
        const baseTotal = categoryStats.total || 0;
        const passRate = baseTotal > 0 ? Math.round((categoryStats.passed / baseTotal) * 100) : 0;
        const failRate = baseTotal > 0 ? Math.round((categoryStats.failed / baseTotal) * 100) : 0;
        const avgDuration = baseTotal > 0 ? Math.round((categoryStats.duration || 0) / baseTotal) : 0;

        return {
            ...categoryStats,
            passRate,
            failRate,
            avgDuration,
            startTime: this.stats.startTime,
            endTime: this.stats.endTime,
            duration: categoryStats.duration || 0
        };
    }

    getTestsByScope(scope = 'all') {
        const normalizedScope = (scope || 'all').toLowerCase();
        if (normalizedScope === 'all') {
            return this.tests;
        }
        const categoryName = TestDataParser.scopeToCategory(normalizedScope).toLowerCase();
        return this.tests.filter(test => (test.category || 'Other').toLowerCase() === categoryName);
    }

    getSuiteStatsByScope(scope = 'all') {
        const normalizedScope = (scope || 'all').toLowerCase();
        if (normalizedScope === 'all') {
            return this.getSuiteStats();
        }

        const scopedTests = this.getTestsByScope(normalizedScope);
        const suiteMap = new Map();

        scopedTests.forEach(test => {
            const suiteName = test.suite || 'Unnamed Suite';
            if (!suiteMap.has(suiteName)) {
                suiteMap.set(suiteName, {
                    name: suiteName,
                    total: 0,
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    duration: 0
                });
            }

            const suiteStats = suiteMap.get(suiteName);
            suiteStats.total++;
            suiteStats.duration += test.duration || 0;

            switch (TestDataParser.normalizeStatus(test.status)) {
                case 'passed':
                    suiteStats.passed++;
                    break;
                case 'failed':
                    suiteStats.failed++;
                    break;
                case 'skipped':
                    suiteStats.skipped++;
                    break;
                default:
                    break;
            }
        });

        return Array.from(suiteMap.values());
    }

    /**
     * Generate mock data for demonstration
     */
    generateMockData() {
        console.log('Generating mock data for demonstration...');
        this.resetAggregates();
        
        this.stats = {
            total: 21,
            passed: 21,
            failed: 0,
            skipped: 0,
            duration: 5823,
            startTime: new Date(Date.now() - 5823),
            endTime: new Date()
        };

        // Mock test suites
        const suites = [
            { name: 'Home Page Tests', passed: 5, failed: 0, skipped: 0 },
            { name: 'Login Page Tests', passed: 4, failed: 0, skipped: 0 },
            { name: 'Register Page Tests', passed: 4, failed: 0, skipped: 0 },
            { name: 'Cruises Page Tests', passed: 5, failed: 0, skipped: 0 },
            { name: 'Contact Page Tests', passed: 3, failed: 0, skipped: 0 }
        ];

        suites.forEach(suite => {
            this.suites.set(suite.name, {
                name: suite.name,
                total: suite.passed + suite.failed + suite.skipped,
                passed: suite.passed,
                failed: suite.failed,
                skipped: suite.skipped,
                duration: Math.floor(Math.random() * 2000) + 500
            });
        });

        // Mock tests
        const testNames = [
            ['should load home page successfully', 'should display navigation elements', 'should display cruise listings', 'should have login link', 'should have register link'],
            ['should load login page successfully', 'should display login form elements', 'should show error message for invalid credentials', 'should navigate to register page'],
            ['should load register page successfully', 'should display registration form elements', 'should validate required fields', 'should navigate to login page'],
            ['should load cruises page successfully', 'should display cruise listings', 'should have search/filter functionality', 'should display cruise cards with details', 'should allow viewing cruise details'],
            ['should load contact page successfully', 'should display contact form elements', 'should validate contact form fields']
        ];

        suites.forEach((suite, index) => {
            const categoryFolder = index < 3 ? 'frontend' : 'backend';
            const categoryName = categoryFolder === 'frontend' ? 'Frontend' : 'Backend';

            testNames[index].forEach(testName => {
                const duration = Math.floor(Math.random() * 1000) + 100;
                this.tests.push({
                    id: `${suite.name}-${testName}`.replace(/\s+/g, '-'),
                    title: testName,
                    fullTitle: `${suite.name} › ${testName}`,
                    suite: suite.name,
                    status: 'passed',
                    duration,
                    error: null,
                    retries: 0,
                    file: `tests/${categoryFolder}/${suite.name.toLowerCase().replace(/\s+/g, '-')}.spec.js`
                });
                this.updateCategoryStats(categoryName, 'passed', duration);
            });
        });

        return this.testData;
    }

    /**
     * Get statistics summary
     */
    getStats() {
        return {
            ...this.stats,
            passRate: this.stats.total > 0 
                ? Math.round((this.stats.passed / this.stats.total) * 100) 
                : 0,
            failRate: this.stats.total > 0 
                ? Math.round((this.stats.failed / this.stats.total) * 100) 
                : 0,
            avgDuration: this.stats.total > 0 
                ? Math.round(this.stats.duration / this.stats.total) 
                : 0
        };
    }

    /**
     * Get suite statistics
     */
    getSuiteStats() {
        return Array.from(this.suites.values());
    }

    /**
     * Get category statistics
     */
    getCategoryStats() {
        return Array.from(this.categoryStats.values());
    }

    /**
     * Get all tests
     */
    getTests() {
        return this.tests;
    }

    /**
     * Get tests filtered by status
     */
    getTestsByStatus(status) {
        if (status === 'all') {
            return this.tests;
        }
        return this.tests.filter(test => test.status === status);
    }

    /**
     * Search tests by title or suite name
     */
    searchTests(query) {
        if (!query) return this.tests;
        
        const lowerQuery = query.toLowerCase();
        return this.tests.filter(test => 
            test.title.toLowerCase().includes(lowerQuery) ||
            test.suite.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Format duration to human-readable string
     */
    static formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Format timestamp to human-readable string
     */
    static formatTimestamp(date) {
        if (!date) return 'N/A';
        
        const d = new Date(date);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Get status icon
     */
    static getStatusIcon(status) {
        switch (status) {
            case 'passed':
            case 'expected':
                return '<i class="fas fa-check-circle"></i>';
            case 'failed':
            case 'unexpected':
                return '<i class="fas fa-times-circle"></i>';
            case 'skipped':
            case 'pending':
                return '<i class="fas fa-forward"></i>';
            default:
                return '<i class="fas fa-question-circle"></i>';
        }
    }

    static normalizeStatus(status) {
        if (!status) return 'unknown';
        const normalized = status.toLowerCase();
        if (normalized === 'expected') return 'passed';
        if (normalized === 'unexpected') return 'failed';
        if (normalized === 'pending') return 'skipped';
        return normalized;
    }

    static scopeToCategory(scope) {
        switch ((scope || '').toLowerCase()) {
            case 'frontend':
                return 'Frontend';
            case 'backend':
                return 'Backend';
            default:
                return 'Other';
        }
    }
}

// Export for use in reporter.js
window.TestDataParser = TestDataParser;
