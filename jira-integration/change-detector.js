const fs = require('fs');
const path = require('path');

class ChangeDetector {
  constructor(jiraClient, testGenerator, config) {
    this.jiraClient = jiraClient;
    this.testGenerator = testGenerator;
    this.config = config;
    this.changeLogPath = path.join(process.cwd(), '.jira-cache', 'change-log.json');
  }

  async detectAndProcessChanges() {
    console.log('\n🔍 Detecting changes in Jira board...\n');
    
    const changes = await this.jiraClient.detectChanges();
    const processedChanges = {
      new: [],
      updated: [],
      statusChanged: [],
      deleted: [],
      testsGenerated: 0,
      testsUpdated: 0,
      testsDeleted: 0
    };

    // Process new stories
    if (changes.new.length > 0) {
      console.log(`\n📌 Found ${changes.new.length} new user stories`);
      for (const issue of changes.new) {
        await this.processNewStory(issue, processedChanges);
      }
    }

    // Process updated stories
    if (changes.updated.length > 0) {
      console.log(`\n🔄 Found ${changes.updated.length} updated user stories`);
      for (const change of changes.updated) {
        await this.processUpdatedStory(change, processedChanges);
      }
    }

    // Process status changes
    if (changes.statusChanged.length > 0) {
      console.log(`\n📊 Found ${changes.statusChanged.length} status changes`);
      for (const change of changes.statusChanged) {
        await this.processStatusChange(change, processedChanges);
      }
    }

    // Process deleted stories
    if (changes.deleted.length > 0) {
      console.log(`\n🗑️  Found ${changes.deleted.length} deleted user stories`);
      for (const issue of changes.deleted) {
        await this.processDeletedStory(issue, processedChanges);
      }
    }

    // Log changes
    await this.logChanges(processedChanges);

    return processedChanges;
  }

  async processNewStory(issue, processedChanges) {
    try {
      console.log(`\n  ➕ New Story: ${issue.key} - ${issue.fields.summary}`);
      
      const storyDetails = await this.jiraClient.getStoryDetails(issue.key);
      
      if (storyDetails.acceptanceCriteria.length === 0) {
        console.log(`  ⚠️  No acceptance criteria found, skipping test generation`);
        processedChanges.new.push({
          key: issue.key,
          summary: issue.fields.summary,
          skipped: true,
          reason: 'No acceptance criteria'
        });
        return;
      }

      const result = await this.testGenerator.generateTestsFromStory(storyDetails);
      
      processedChanges.new.push({
        key: issue.key,
        summary: issue.fields.summary,
        testFile: result.filepath,
        scenarios: result.scenarios
      });
      
      processedChanges.testsGenerated++;
      
    } catch (error) {
      console.error(`  ❌ Error processing new story ${issue.key}:`, error.message);
      processedChanges.new.push({
        key: issue.key,
        summary: issue.fields.summary,
        error: error.message
      });
    }
  }

  async processUpdatedStory(change, processedChanges) {
    try {
      const issue = change.current;
      console.log(`\n  🔄 Updated Story: ${issue.key} - ${issue.fields.summary}`);
      
      const storyDetails = await this.jiraClient.getStoryDetails(issue.key);
      
      if (storyDetails.acceptanceCriteria.length === 0) {
        console.log(`  ⚠️  No acceptance criteria found, skipping test update`);
        processedChanges.updated.push({
          key: issue.key,
          summary: issue.fields.summary,
          skipped: true,
          reason: 'No acceptance criteria'
        });
        return;
      }

      // Check if acceptance criteria changed
      const previousDetails = await this.getPreviousStoryDetails(change.previous);
      const criteriaChanged = this.hasAcceptanceCriteriaChanged(
        previousDetails.acceptanceCriteria,
        storyDetails.acceptanceCriteria
      );

      if (criteriaChanged || this.config.alwaysUpdateTests) {
        console.log(`  📝 Acceptance criteria changed, updating tests...`);
        const result = await this.testGenerator.updateExistingTest(storyDetails);
        
        processedChanges.updated.push({
          key: issue.key,
          summary: issue.fields.summary,
          testFile: result.filepath,
          scenarios: result.scenarios,
          criteriaChanged: true
        });
        
        processedChanges.testsUpdated++;
      } else {
        console.log(`  ℹ️  Acceptance criteria unchanged, skipping test update`);
        processedChanges.updated.push({
          key: issue.key,
          summary: issue.fields.summary,
          criteriaChanged: false
        });
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing updated story ${change.current.key}:`, error.message);
      processedChanges.updated.push({
        key: change.current.key,
        summary: change.current.fields.summary,
        error: error.message
      });
    }
  }

  async processStatusChange(change, processedChanges) {
    console.log(`  📊 ${change.key}: ${change.from} → ${change.to}`);
    
    processedChanges.statusChanged.push({
      key: change.key,
      from: change.from,
      to: change.to,
      summary: change.issue.fields.summary
    });

    // If story moved to "Done" or "Closed", optionally archive tests
    if (this.config.archiveCompletedTests && 
        (change.to === 'Done' || change.to === 'Closed')) {
      await this.archiveTest(change.key);
    }

    // If story moved to "In Progress" or "Testing", ensure tests exist
    if ((change.to === 'In Progress' || change.to === 'Testing' || change.to === 'Ready for Testing') &&
        this.config.ensureTestsForActiveStories) {
      const storyDetails = await this.jiraClient.getStoryDetails(change.key);
      const filename = this.testGenerator.getTestFilename(change.key);
      const filepath = path.join(this.testGenerator.testsDir, filename);
      
      if (!fs.existsSync(filepath)) {
        console.log(`  ⚠️  Story moved to ${change.to} but no tests exist, generating...`);
        await this.testGenerator.generateTestsFromStory(storyDetails);
        processedChanges.testsGenerated++;
      }
    }
  }

  async processDeletedStory(issue, processedChanges) {
    try {
      console.log(`  🗑️  Deleted Story: ${issue.key} - ${issue.fields.summary}`);
      
      if (this.config.deleteTestsForDeletedStories) {
        const deleted = await this.testGenerator.deleteTest(issue.key);
        
        processedChanges.deleted.push({
          key: issue.key,
          summary: issue.fields.summary,
          testDeleted: deleted
        });
        
        if (deleted) {
          processedChanges.testsDeleted++;
        }
      } else {
        console.log(`  ℹ️  Test file preserved (deleteTestsForDeletedStories=false)`);
        processedChanges.deleted.push({
          key: issue.key,
          summary: issue.fields.summary,
          testDeleted: false
        });
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing deleted story ${issue.key}:`, error.message);
      processedChanges.deleted.push({
        key: issue.key,
        summary: issue.fields.summary,
        error: error.message
      });
    }
  }

  getPreviousStoryDetails(previousIssue) {
    return {
      key: previousIssue.key,
      summary: previousIssue.fields.summary,
      acceptanceCriteria: this.jiraClient.extractAcceptanceCriteria(previousIssue)
    };
  }

  hasAcceptanceCriteriaChanged(previous, current) {
    if (previous.length !== current.length) return true;
    
    const prevSet = new Set(previous.map(c => c.trim().toLowerCase()));
    const currSet = new Set(current.map(c => c.trim().toLowerCase()));
    
    for (const item of currSet) {
      if (!prevSet.has(item)) return true;
    }
    
    return false;
  }

  async archiveTest(storyKey) {
    const filename = this.testGenerator.getTestFilename(storyKey);
    const filepath = path.join(this.testGenerator.testsDir, filename);
    
    if (fs.existsSync(filepath)) {
      const archiveDir = path.join(this.testGenerator.testsDir, 'archived');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      
      const archivePath = path.join(archiveDir, filename);
      fs.renameSync(filepath, archivePath);
      console.log(`  📦 Archived test to: ${archivePath}`);
    }
  }

  async logChanges(changes) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      summary: {
        new: changes.new.length,
        updated: changes.updated.length,
        statusChanged: changes.statusChanged.length,
        deleted: changes.deleted.length,
        testsGenerated: changes.testsGenerated,
        testsUpdated: changes.testsUpdated,
        testsDeleted: changes.testsDeleted
      },
      details: changes
    };

    // Load existing log
    let changeLog = [];
    if (fs.existsSync(this.changeLogPath)) {
      changeLog = JSON.parse(fs.readFileSync(this.changeLogPath, 'utf-8'));
    }

    // Add new entry
    changeLog.unshift(logEntry);

    // Keep only last 50 entries
    if (changeLog.length > 50) {
      changeLog = changeLog.slice(0, 50);
    }

    // Save log
    fs.writeFileSync(this.changeLogPath, JSON.stringify(changeLog, null, 2), 'utf-8');
    
    console.log(`\n📋 Change log updated: ${this.changeLogPath}`);
  }

  async getChangeHistory(limit = 10) {
    if (!fs.existsSync(this.changeLogPath)) {
      return [];
    }
    
    const changeLog = JSON.parse(fs.readFileSync(this.changeLogPath, 'utf-8'));
    return changeLog.slice(0, limit);
  }
}

module.exports = ChangeDetector;
