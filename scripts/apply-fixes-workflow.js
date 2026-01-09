const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get test file and title from command line arguments
const testFile = process.argv[2];
const testTitle = process.argv[3];

console.log(`\n🔧 Applying Fix for Test`);
console.log(`   File: ${testFile}`);
console.log(`   Title: ${testTitle}`);

/**
 * Run a command and return a promise
 */
function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', (error) => {
            reject(error);
        });
    });
}

async function applyFixesWorkflow() {
    try {
        const rootDir = path.join(__dirname, '..');

        // Step 1: Apply fixes using code-fixer
        console.log('\n📋 Step 1: Applying AI-suggested fixes...');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        
        const CodeFixer = require('../ai-agent/code-fixer.js');
        const codeFixer = new CodeFixer();
        
        // Load AI analysis data
        const aiAnalysisPath = path.join(rootDir, 'custom-report', 'ai-analysis.json');
        if (!fs.existsSync(aiAnalysisPath)) {
            throw new Error('AI analysis file not found. Please run tests and AI analysis first.');
        }
        
        const aiAnalysis = JSON.parse(fs.readFileSync(aiAnalysisPath, 'utf-8'));
        
        // Find the specific test analysis
        const testAnalysisKey = Object.keys(aiAnalysis.analyses).find(key => {
            const analysis = aiAnalysis.analyses[key];
            return analysis.testName === testTitle && analysis.file.includes(testFile);
        });
        
        if (!testAnalysisKey) {
            throw new Error(`No AI analysis found for test: ${testTitle} in ${testFile}`);
        }
        
        const testAnalysis = aiAnalysis.analyses[testAnalysisKey];
        console.log(`✓ Found AI analysis for test`);
        
        // Apply the fix
        console.log(`\n🔧 Applying fix...`);
        await codeFixer.applyFixes([testAnalysis]);
        console.log('✅ Fixes applied');

        // Step 2: Run verification tests
        console.log('\n📋 Step 2: Running verification tests...');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        
        // Run only the specific test that was fixed
        const testFilePath = path.join(rootDir, 'tests', testFile);
        // Escape special regex characters in test title
        const escapedTitle = testTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await runCommand('npx', ['playwright', 'test', testFilePath, '--grep', `"${escapedTitle}"`], {
            cwd: rootDir
        });
        console.log('✅ Verification tests completed');

        // Step 3: Rebuild dashboard with new results
        console.log('\n📋 Step 3: Rebuilding dashboard...');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        
        await runCommand('node', ['scripts/build-dashboard.js'], {
            cwd: rootDir
        });
        console.log('✅ Dashboard rebuilt');

        // Step 4: Create PR (optional)
        console.log('\n📋 Step 4: Creating Pull Request...');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        
        const GitHubPRCreator = require('../ai-agent/github-pr-creator.js');
        const prCreator = new GitHubPRCreator();
        
        try {
            await prCreator.createPR({
                title: `Fix: ${testTitle}`,
                description: `Applied AI-suggested fix for test: ${testTitle}\n\nTest file: ${testFile}\n\nFix applied based on AI analysis.`,
                branch: `fix/${testTitle.replace(/\s+/g, '-').toLowerCase()}`
            });
            console.log('✅ Pull request created');
        } catch (error) {
            console.log('⚠️  PR creation skipped:', error.message);
        }

        console.log('\n════════════════════════════════════════════════════════════════════════════════');
        console.log('✅ Fix Application Workflow Complete!');
        console.log('════════════════════════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Error in fix application workflow:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the workflow
applyFixesWorkflow();
