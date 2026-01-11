const fs = require('fs');
const path = require('path');

/**
 * Script to detect and fix deliberate errors in the codebase
 * This is part of the POC workflow demonstration
 */

const FIXES = [
    {
        file: 'website/app/controllers/HomeController.php',
        pattern: /\[\]; \/\/ DELIBERATE_ERROR: should call \$navire->getAllNavire\(\)/g,
        replacement: '$navire->getAllNavire();',
        description: 'Fix empty array -> call $navire->getAllNavire()'
    }
];

function applyFixes() {
    console.log('🔍 Scanning for deliberate errors...\n');
    
    let fixesApplied = 0;
    let errors = [];
    
    FIXES.forEach((fix, index) => {
        const filePath = path.join(__dirname, '..', fix.file);
        
        try {
            if (!fs.existsSync(filePath)) {
                errors.push(`❌ File not found: ${fix.file}`);
                return;
            }
            
            let content = fs.readFileSync(filePath, 'utf8');
            
            if (fix.pattern.test(content)) {
                console.log(`✅ Found error in: ${fix.file}`);
                console.log(`   Description: ${fix.description}`);
                
                content = content.replace(fix.pattern, fix.replacement);
                fs.writeFileSync(filePath, content, 'utf8');
                
                console.log(`   ✓ Fixed successfully!\n`);
                fixesApplied++;
            } else {
                console.log(`ℹ️  No error found in: ${fix.file} (already fixed or pattern changed)\n`);
            }
        } catch (error) {
            errors.push(`❌ Error processing ${fix.file}: ${error.message}`);
        }
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary: ${fixesApplied} fix(es) applied`);
    
    if (errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        errors.forEach(err => console.log(`   ${err}`));
    }
    
    if (fixesApplied > 0) {
        console.log('\n✨ Fixes have been applied. Ready to commit!');
        process.exit(0);
    } else {
        console.log('\n⚠️  No fixes were applied.');
        process.exit(1);
    }
}

// Run the fixes
applyFixes();
