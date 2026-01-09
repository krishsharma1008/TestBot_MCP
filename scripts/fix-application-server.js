const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;

/**
 * Fix Application Server
 * Handles requests to apply AI-suggested fixes for specific tests
 */
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/apply-fix') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { testFile, testTitle } = JSON.parse(body);
                
                console.log('\n🔧 Fix Application Request Received');
                console.log(`   Test File: ${testFile}`);
                console.log(`   Test Title: ${testTitle}`);

                // Trigger the fix application workflow
                const result = await applyFixForTest(testFile, testTitle);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Fix application started',
                    testFile,
                    testTitle,
                    result
                }));

            } catch (error) {
                console.error('Error processing fix request:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message
                }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

/**
 * Apply fix for a specific test
 */
async function applyFixForTest(testFile, testTitle) {
    return new Promise((resolve, reject) => {
        console.log('\n📋 Step 4: Applying AI-suggested fixes...');
        console.log('────────────────────────────────────────────────────────────────────────────────');

        const scriptPath = path.join(__dirname, 'apply-fixes-workflow.js');
        
        const fixProcess = spawn('node', [scriptPath, testFile, testTitle], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            env: { ...process.env }
        });

        fixProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Fix application workflow completed');
                resolve({ status: 'completed', code });
            } else {
                console.log(`⚠️  Fix application workflow exited with code ${code}`);
                resolve({ status: 'completed_with_warnings', code });
            }
        });

        fixProcess.on('error', (error) => {
            console.error('❌ Error running fix application workflow:', error);
            reject(error);
        });
    });
}

server.listen(PORT, () => {
    console.log(`\n🚀 Fix Application Server running on http://localhost:${PORT}`);
    console.log(`   Ready to receive fix application requests from dashboard\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down Fix Application Server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
