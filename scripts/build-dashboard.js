#!/usr/bin/env node

/**
 * Build Dashboard Script
 * Copies the dashboard template and assets to the custom-report directory
 */

const fs = require('fs');
const path = require('path');
const { generateAttachmentsManifest } = require('./generate-attachments-manifest');

const SOURCE_DIR = path.join(__dirname, '..', 'custom-reporter');
const TARGET_DIR = path.join(__dirname, '..', 'custom-report');
const TEST_RESULTS_FILE = path.join(__dirname, '..', 'test-results.json');

function buildDashboard() {
    console.log('\n📊 Building Custom Test Dashboard...\n');
    
    // Generate attachments manifest first
    try {
        generateAttachmentsManifest();
    } catch (error) {
        console.warn('⚠️  Could not generate attachments manifest:', error.message);
    }

    // Create target directory if it doesn't exist
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
        console.log('✓ Created custom-report directory');
    }

    // Check if test results exist
    if (!fs.existsSync(TEST_RESULTS_FILE)) {
        console.warn('⚠️  Warning: test-results.json not found. Dashboard will use mock data.');
    } else {
        console.log('✓ Found test results');
    }

    // Copy dashboard template as index.html
    try {
        const templatePath = path.join(SOURCE_DIR, 'dashboard-template.html');
        const targetIndexPath = path.join(TARGET_DIR, 'index.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ Error: dashboard-template.html not found in custom-reporter/');
            process.exit(1);
        }
        
        fs.copyFileSync(templatePath, targetIndexPath);
        console.log('✓ Copied HTML template');
    } catch (error) {
        console.error('❌ Error copying HTML template:', error.message);
        process.exit(1);
    }

    // Copy CSS file
    try {
        const cssPath = path.join(SOURCE_DIR, 'dashboard-styles.css');
        const targetCssPath = path.join(TARGET_DIR, 'dashboard-styles.css');
        
        if (fs.existsSync(cssPath)) {
            fs.copyFileSync(cssPath, targetCssPath);
            console.log('✓ Copied CSS styles');
        }
    } catch (error) {
        console.error('❌ Error copying CSS:', error.message);
        process.exit(1);
    }

    // Copy JavaScript files
    try {
        const jsFiles = ['data-parser.js', 'jira-dashboard.js', 'reporter.js'];
        jsFiles.forEach(file => {
            const sourcePath = path.join(SOURCE_DIR, file);
            const targetPath = path.join(TARGET_DIR, file);
            
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`✓ Copied ${file}`);
            }
        });
    } catch (error) {
        console.error('❌ Error copying JavaScript files:', error.message);
        process.exit(1);
    }

    // Copy Jira dashboard styles
    try {
        const jiraStylesPath = path.join(SOURCE_DIR, 'jira-dashboard-styles.css');
        const targetJiraStylesPath = path.join(TARGET_DIR, 'jira-dashboard-styles.css');
        
        if (fs.existsSync(jiraStylesPath)) {
            fs.copyFileSync(jiraStylesPath, targetJiraStylesPath);
            console.log('✓ Copied Jira dashboard styles');
        }
    } catch (error) {
        console.warn('⚠️  Warning: Could not copy Jira dashboard styles:', error.message);
    }

    // Copy test results if they exist
    if (fs.existsSync(TEST_RESULTS_FILE)) {
        try {
            const targetResultsPath = path.join(TARGET_DIR, 'test-results.json');
            fs.copyFileSync(TEST_RESULTS_FILE, targetResultsPath);
            console.log('✓ Copied test results');
        } catch (error) {
            console.warn('⚠️  Warning: Could not copy test results:', error.message);
        }

        // Copy test-results folder with attachments (screenshots, videos, etc.)
        try {
            const testResultsDir = path.join(__dirname, '..', 'test-results');
            const targetTestResultsDir = path.join(TARGET_DIR, 'test-results');
            
            if (fs.existsSync(testResultsDir)) {
                // Create test-results directory in custom-report
                if (!fs.existsSync(targetTestResultsDir)) {
                    fs.mkdirSync(targetTestResultsDir, { recursive: true });
                }
                
                // Copy all test result folders
                const folders = fs.readdirSync(testResultsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                let copiedCount = 0;
                folders.forEach(folderName => {
                    const sourceFolderPath = path.join(testResultsDir, folderName);
                    const targetFolderPath = path.join(targetTestResultsDir, folderName);
                    
                    // Create target folder
                    if (!fs.existsSync(targetFolderPath)) {
                        fs.mkdirSync(targetFolderPath, { recursive: true });
                    }
                    
                    // Copy all files in the folder
                    const files = fs.readdirSync(sourceFolderPath);
                    files.forEach(fileName => {
                        const sourceFilePath = path.join(sourceFolderPath, fileName);
                        const targetFilePath = path.join(targetFolderPath, fileName);
                        
                        if (fs.statSync(sourceFilePath).isFile()) {
                            fs.copyFileSync(sourceFilePath, targetFilePath);
                        }
                    });
                    copiedCount++;
                });
                
                console.log(`✓ Copied test-results folder (${copiedCount} test folders with attachments)`);
            }
        } catch (error) {
            console.warn('⚠️  Warning: Could not copy test-results folder:', error.message);
        }
    }

    // Copy AI analysis if it exists
    try {
        const aiAnalysisPath = path.join(__dirname, '..', 'ai-agent-reports', 'latest-report.json');
        const targetAiPath = path.join(TARGET_DIR, 'ai-analysis.json');
        
        if (fs.existsSync(aiAnalysisPath)) {
            fs.copyFileSync(aiAnalysisPath, targetAiPath);
            console.log('✓ Copied AI analysis');
        } else if (fs.existsSync(targetAiPath)) {
            console.log('✓ AI analysis already in target directory');
        }
    } catch (error) {
        console.warn('⚠️  Warning: Could not copy AI analysis:', error.message);
    }

    console.log('\n✨ Dashboard built successfully!');
    console.log(`\n📂 Location: ${TARGET_DIR}/index.html`);
    console.log('\n💡 To view the dashboard, run: npm run dashboard\n');
}

// Run the build process
try {
    buildDashboard();
} catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
}
