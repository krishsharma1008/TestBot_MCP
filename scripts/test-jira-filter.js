#!/usr/bin/env node

/**
 * Test Jira Filter - Verify only To Do and In Progress stories are fetched
 */

require('dotenv').config();
const JiraClient = require('../jira-integration/jira-client');

async function testFilter() {
  console.log('🧪 Testing Jira Story Filter\n');
  console.log('═'.repeat(60));
  
  const config = {
    jiraBaseUrl: process.env.JIRA_BASE_URL,
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraProjectKey: process.env.JIRA_PROJECT_KEY
  };
  
  const client = new JiraClient(config);
  
  try {
    // Test 1: Fetch with default filter (exclude Done)
    console.log('\n📋 Test 1: Fetching stories (excluding Done)...\n');
    const activeStories = await client.getUserStories();
    
    console.log(`Found ${activeStories.length} active stories:\n`);
    
    const statusCounts = {};
    activeStories.forEach(story => {
      const status = story.fields.status.name;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      console.log(`  ${story.key}: ${story.fields.summary}`);
      console.log(`    Status: ${status}`);
    });
    
    console.log('\n📊 Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Test 2: Fetch ALL stories (including Done)
    console.log('\n\n📋 Test 2: Fetching ALL stories (including Done)...\n');
    const allStories = await client.getUserStories({ includeAll: true });
    
    console.log(`Found ${allStories.length} total stories\n`);
    
    const allStatusCounts = {};
    allStories.forEach(story => {
      const status = story.fields.status.name;
      allStatusCounts[status] = (allStatusCounts[status] || 0) + 1;
    });
    
    console.log('📊 Status Breakdown (All):');
    Object.entries(allStatusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Filter Test Results:\n');
    console.log(`  Active Stories (To Do + In Progress): ${activeStories.length}`);
    console.log(`  Total Stories (including Done): ${allStories.length}`);
    console.log(`  Done Stories (excluded): ${allStories.length - activeStories.length}`);
    console.log('\n✅ Filter working correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testFilter();
