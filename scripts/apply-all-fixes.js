const fs = require('fs');
const path = require('path');

/**
 * Comprehensive fix script that applies multiple fixes
 * Continues even if individual fixes fail
 */

const FIXES = [
    {
        name: 'Fix missing navire data in HomeController',
        file: 'website/app/controllers/HomeController.php',
        pattern: /\[\]; \/\/ DELIBERATE_ERROR: should call \$navire->getAllNavire\(\)/g,
        replacement: '$navire->getAllNavire();',
        description: 'Restore navire data fetching'
    },
    {
        name: 'Consolidate button container in Cuirses view',
        file: 'website/app/views/users/Cuirses.php',
        search: `                                            <div class="d-flex flex-column mt-4">
                                                <button class="btn btn-outline-primary btn-sm mt-2 btn-reservation"
                                                        type="button">
                                                    Résérver
                                                </button>
                                            </div>
                                            <div class="d-flex flex-column mt-4">
                                                <p class="m-2 text-center"
                                                   style="opacity: .7;color: color: rgb(14,86,110)">
                                                    *Taxes, fees and port expenses 99.85 DH*
                                                </p>
                                            </div>`,
        replace: `                                            <div class="d-flex flex-column mt-4">
                                                <button class="btn btn-outline-primary btn-sm mt-2 btn-reservation"
                                                        type="button">
                                                    Résérver
                                                </button>
                                                <p class="m-2 text-center"
                                                   style="opacity: .7;color: color: rgb(14,86,110)">
                                                    *Taxes, fees and port expenses 99.85 DH*
                                                </p>
                                            </div>`,
        description: 'Consolidate duplicate button containers into one'
    }
];

function applyFixes() {
    console.log('🔧 Starting comprehensive fix process...\n');
    console.log('═'.repeat(60));
    
    let successCount = 0;
    let failureCount = 0;
    const results = [];
    
    FIXES.forEach((fix, index) => {
        console.log(`\n📋 Fix ${index + 1}/${FIXES.length}: ${fix.name}`);
        console.log('─'.repeat(60));
        
        const filePath = path.join(__dirname, '..', fix.file);
        
        try {
            if (!fs.existsSync(filePath)) {
                const error = `File not found: ${fix.file}`;
                console.log(`❌ ${error}`);
                results.push({ fix: fix.name, status: 'failed', error });
                failureCount++;
                return;
            }
            
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;
            
            // Try pattern-based replacement first
            if (fix.pattern) {
                if (fix.pattern.test(content)) {
                    content = content.replace(fix.pattern, fix.replacement);
                    modified = true;
                }
            }
            
            // Try string-based replacement
            if (!modified && fix.search) {
                if (content.includes(fix.search)) {
                    content = content.replace(fix.search, fix.replace);
                    modified = true;
                }
            }
            
            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`✅ Success: ${fix.description}`);
                results.push({ fix: fix.name, status: 'success' });
                successCount++;
            } else {
                const msg = 'Pattern not found (may already be fixed)';
                console.log(`ℹ️  Skipped: ${msg}`);
                results.push({ fix: fix.name, status: 'skipped', reason: msg });
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            results.push({ fix: fix.name, status: 'failed', error: error.message });
            failureCount++;
        }
    });
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Successful fixes: ${successCount}`);
    console.log(`❌ Failed fixes: ${failureCount}`);
    console.log(`ℹ️  Skipped fixes: ${FIXES.length - successCount - failureCount}`);
    
    // Detailed results
    console.log('\n📋 Detailed Results:');
    results.forEach((result, i) => {
        const icon = result.status === 'success' ? '✅' : 
                     result.status === 'failed' ? '❌' : 'ℹ️';
        console.log(`${icon} ${i + 1}. ${result.fix} - ${result.status}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        if (result.reason) {
            console.log(`   Reason: ${result.reason}`);
        }
    });
    
    console.log('\n' + '═'.repeat(60));
    
    if (successCount > 0) {
        console.log('✨ Some fixes were applied successfully!');
        console.log('📝 Ready to commit changes.');
        process.exit(0);
    } else if (failureCount === 0) {
        console.log('ℹ️  All fixes already applied or not needed.');
        process.exit(0);
    } else {
        console.log('⚠️  All fixes failed. Check errors above.');
        process.exit(1);
    }
}

// Run the fixes
console.log('🚀 Comprehensive Fix Script');
console.log('This script will attempt all fixes and continue even if some fail.\n');
applyFixes();
