const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CodeFixer {
  constructor(config = {}) {
    this.config = {
      dryRun: config.dryRun || false,
      createBackup: config.createBackup !== false,
      autoCommit: config.autoCommit || false,
      ...config
    };
    this.appliedFixes = [];
  }

  async applyFixes(analysisResults) {
    if (!analysisResults.analysisResults || analysisResults.analysisResults.length === 0) {
      console.log('✅ No fixes to apply');
      return { success: true, appliedFixes: [] };
    }

    console.log(`\n🔧 Applying ${analysisResults.analysisResults.length} fix(es)...`);

    for (const result of analysisResults.analysisResults) {
      if (result.confidence < 0.7) {
        console.log(`⚠️  Skipping low-confidence fix for: ${result.failure.testName} (confidence: ${result.confidence})`);
        continue;
      }

      if (!result.suggestedFix || !result.suggestedFix.changes) {
        console.log(`⚠️  No fix available for: ${result.failure.testName}`);
        continue;
      }

      try {
        await this.applyFix(result);
        this.appliedFixes.push({
          test: result.failure.testName,
          file: result.failure.file,
          success: true,
          changes: result.suggestedFix.changes
        });
        console.log(`✅ Applied fix for: ${result.failure.testName}`);
      } catch (error) {
        console.error(`❌ Failed to apply fix for ${result.failure.testName}: ${error.message}`);
        this.appliedFixes.push({
          test: result.failure.testName,
          file: result.failure.file,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      appliedFixes: this.appliedFixes,
      totalFixes: this.appliedFixes.length,
      successfulFixes: this.appliedFixes.filter(f => f.success).length
    };
  }

  async applyFix(analysisResult) {
    const { suggestedFix } = analysisResult;

    for (const change of suggestedFix.changes) {
      const filePath = path.resolve(change.file);

      if (this.config.createBackup) {
        this.createBackup(filePath);
      }

      if (this.config.dryRun) {
        console.log(`[DRY RUN] Would apply change to: ${filePath}`);
        console.log(`  Action: ${change.action}`);
        console.log(`  Lines: ${change.lineStart}-${change.lineEnd}`);
        continue;
      }

      await this.applyChange(filePath, change);
    }
  }

  createBackup(filePath) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`📦 Created backup: ${backupPath}`);
  }

  async applyChange(filePath, change) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let newLines;
    switch (change.action) {
      case 'replace':
        newLines = this.replaceLines(lines, change);
        break;
      case 'insert':
        newLines = this.insertLines(lines, change);
        break;
      case 'delete':
        newLines = this.deleteLines(lines, change);
        break;
      default:
        throw new Error(`Unknown action: ${change.action}`);
    }

    const newContent = newLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  replaceLines(lines, change) {
    const newLines = [...lines];
    const startIdx = (change.lineStart || 1) - 1;
    const endIdx = (change.lineEnd || change.lineStart || 1) - 1;
    
    const oldCode = change.oldCode || '';
    const newCode = change.newCode || '';

    if (oldCode) {
      const existingCode = lines.slice(startIdx, endIdx + 1).join('\n');
      if (!existingCode.includes(oldCode.trim())) {
        console.warn(`⚠️  Warning: Old code not found at specified location. Attempting fuzzy match...`);
        return this.fuzzyReplace(lines, oldCode, newCode);
      }
    }

    const replacementLines = newCode.split('\n');
    newLines.splice(startIdx, endIdx - startIdx + 1, ...replacementLines);
    
    return newLines;
  }

  fuzzyReplace(lines, oldCode, newCode) {
    const content = lines.join('\n');
    const oldCodeTrimmed = oldCode.trim();
    
    if (content.includes(oldCodeTrimmed)) {
      const newContent = content.replace(oldCodeTrimmed, newCode.trim());
      return newContent.split('\n');
    }
    
    throw new Error('Could not find code to replace');
  }

  insertLines(lines, change) {
    const newLines = [...lines];
    const insertIdx = (change.lineStart || 1) - 1;
    const insertCode = change.newCode || '';
    const insertionLines = insertCode.split('\n');
    
    newLines.splice(insertIdx, 0, ...insertionLines);
    return newLines;
  }

  deleteLines(lines, change) {
    const newLines = [...lines];
    const startIdx = (change.lineStart || 1) - 1;
    const endIdx = (change.lineEnd || change.lineStart || 1) - 1;
    
    newLines.splice(startIdx, endIdx - startIdx + 1);
    return newLines;
  }

  async verifyFixes() {
    console.log('\n🧪 Verifying fixes by running tests...');
    
    try {
      execSync('npm test', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ All tests passed after applying fixes!');
      return { success: true, allTestsPassed: true };
    } catch (error) {
      console.log('⚠️  Some tests still failing after fixes');
      return { success: false, allTestsPassed: false };
    }
  }

  rollbackFixes() {
    console.log('\n↩️  Rolling back fixes...');
    
    const backupFiles = this.findBackupFiles();
    for (const backupFile of backupFiles) {
      const originalFile = backupFile.replace(/\.backup\.\d+$/, '');
      fs.copyFileSync(backupFile, originalFile);
      fs.unlinkSync(backupFile);
      console.log(`↩️  Restored: ${originalFile}`);
    }
    
    console.log('✅ Rollback complete');
  }

  findBackupFiles() {
    const backupFiles = [];
    const searchDir = process.cwd();
    
    const findBackups = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          findBackups(fullPath);
        } else if (item.match(/\.backup\.\d+$/)) {
          backupFiles.push(fullPath);
        }
      }
    };
    
    findBackups(searchDir);
    return backupFiles;
  }

  generateFixReport() {
    return {
      totalFixes: this.appliedFixes.length,
      successfulFixes: this.appliedFixes.filter(f => f.success).length,
      failedFixes: this.appliedFixes.filter(f => !f.success).length,
      fixes: this.appliedFixes,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CodeFixer;
