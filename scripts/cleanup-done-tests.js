#!/usr/bin/env node

/**
 * Cleanup Test Files for Done Stories
 * Removes test files for stories that are in "Done" status
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const JiraClient = require('../jira-integration/jira-client');

async function cleanupDoneTests() {
  console.log('\n🧹 Cleaning up test files for Done stories...\n');
  console.log('═'.repeat(60));
  
  const config = {
    jiraBaseUrl: process.env.JIRA_BASE_URL,
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraProjectKey: process.env.JIRA_PROJECT_KEY
  };
  
  const client = new JiraClient(config);
  const testDir = path.join(process.cwd(), 'tests', 'jira-generated');
  
  try {
    // Get all stories including Done
    console.log('📋 Fetching all stories from Jira...\n');
    const allStories = await client.getUserStories({ includeAll: true });
    
    // Separate Done stories
    const doneStories = allStories.filter(s => s.fields.status.name === 'Done');
    const activeStories = allStories.filter(s => s.fields.status.name !== 'Done');
    
    console.log(`Found ${allStories.length} total stories:`);
    console.log(`  ✅ Done: ${doneStories.length}`);
    console.log(`  ⚠️  Active: ${activeStories.length}\n`);
    
    // Get all test files
    if (!fs.existsSync(testDir)) {
      console.log('⚠️  No test directory found');
      return;
    }
    
    const testFiles = fs.readdirSync(testDir)
      .filter(f => f.endsWith('.spec.js') && !f.includes('.backup'));
    
    console.log(`📁 Found ${testFiles.length} test files\n`);
    
    // Identify files to remove
    const filesToRemove = [];
    const filesToKeep = [];
    
    testFiles.forEach(file => {
      // Extract story key from filename (e.g., mscship_15.spec.js -> MSCSHIP-15)
      const match = file.match(/mscship[_-]?(\d+)/i);
      if (match) {
        const storyKey = `MSCSHIP-${match[1]}`;
        const story = allStories.find(s => s.key === storyKey);
        
        if (story && story.fields.status.name === 'Done') {
          filesToRemove.push({ file, storyKey, status: 'Done' });
        } else {
          filesToKeep.push({ file, storyKey, status: story?.fields.status.name || 'Unknown' });
        }
      }
    });
    
    console.log('🗑️  Files to remove (Done stories):\n');
    if (filesToRemove.length === 0) {
      console.log('  (none)');
    } else {
      filesToRemove.forEach(({ file, storyKey }) => {
        console.log(`  ❌ ${file} (${storyKey})`);
      });
    }
    
    console.log('\n✅ Files to keep (Active stories):\n');
    if (filesToKeep.length === 0) {
      console.log('  (none)');
    } else {
      filesToKeep.forEach(({ file, storyKey, status }) => {
        console.log(`  ✓ ${file} (${storyKey} - ${status})`);
      });
    }
    
    // Remove files
    if (filesToRemove.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('\n🗑️  Removing test files for Done stories...\n');
      
      let removed = 0;
      filesToRemove.forEach(({ file, storyKey }) => {
        const filePath = path.join(testDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`  ✅ Removed: ${file}`);
          removed++;
        } catch (error) {
          console.error(`  ❌ Failed to remove ${file}:`, error.message);
        }
      });
      
      console.log('\n' + '═'.repeat(60));
      console.log(`\n✅ Cleanup complete: ${removed} files removed`);
      console.log(`📁 Remaining test files: ${filesToKeep.length}`);
    } else {
      console.log('\n' + '═'.repeat(60));
      console.log('\n✅ No cleanup needed - all test files are for active stories');
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupDoneTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { cleanupDoneTests };
