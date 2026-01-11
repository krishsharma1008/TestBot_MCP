require('dotenv').config();
const JiraClient = require('../jira-integration/jira-client');

const client = new JiraClient({
  jiraBaseUrl: process.env.JIRA_BASE_URL,
  jiraEmail: process.env.JIRA_EMAIL,
  jiraApiToken: process.env.JIRA_API_TOKEN,
  jiraProjectKey: process.env.JIRA_PROJECT_KEY
});

// Helper to create ADF format
function createADF(lines) {
  return {
    version: 1,
    type: 'doc',
    content: lines.map(line => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }]
    }))
  };
}

const stories = [
  {
    key: 'MSCSHIP-1',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given the cruise search API endpoint is available',
      'When a GET request is made to /api/cruises/search with port parameter set to ALL',
      'Then the API should return a list of all available cruises',
      'And the response should include cruise details like name, departure date, and ports',
      'And the HTTP status code should be 200'
    ]
  },
  {
    key: 'MSCSHIP-2',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given a valid cruise ID is provided',
      'When a GET request is made to /api/cruises/detail endpoint',
      'Then the API should return complete cruise details',
      'And the response should include itinerary information',
      'And the response should include ROM (rates and occupancy) data',
      'And the HTTP status code should be 200'
    ]
  },
  {
    key: 'MSCSHIP-5',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given the contact form API endpoint is available',
      'When a POST request is made with incomplete payload (missing required fields)',
      'Then the API should reject the request',
      'And the response should return HTTP status code 400',
      'And the response should include error message indicating missing fields'
    ]
  },
  {
    key: 'MSCSHIP-6',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given the contact form API endpoint is available',
      'When a POST request is made with valid payload containing name, email, and message',
      'Then the API should accept the request',
      'And the API should log the contact entry to the database',
      'And the response should return HTTP status code 200',
      'And the response should include success confirmation'
    ]
  },
  {
    key: 'MSCSHIP-10',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is authenticated and logged in',
      'When user navigates to /reservation page',
      'Then the reservation page should load successfully',
      'And user should see the reservation form',
      'And the HTTP status code should be 200'
    ]
  },
  {
    key: 'MSCSHIP-11',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is logged in',
      'When user clicks on the user dropdown in navbar',
      'And user clicks the logout button',
      'Then user should be logged out',
      'And user should be redirected to the home page',
      'And the user session should be cleared'
    ]
  },
  {
    key: 'MSCSHIP-12',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When user clicks on a cruise card to view details',
      'Then a modal should open displaying cruise details',
      'And the modal should contain a reservation form',
      'And the form should have fields for passenger details'
    ]
  },
  {
    key: 'MSCSHIP-13',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When user selects a ship name from the Navire (Ship) filter dropdown',
      'Then the cruise listings should update to show only cruises for that ship',
      'And the results should be filtered in real-time',
      'And the page should display the filtered cruise cards'
    ]
  },
  {
    key: 'MSCSHIP-14',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user navigates to the contact page',
      'When the page loads',
      'Then the contact page should display successfully',
      'And the page should show the contact form',
      'And the HTTP status code should be 200'
    ]
  },
  {
    key: 'MSCSHIP-15',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the contact page',
      'When the page loads',
      'Then the form should display all required elements',
      'And the form should have name input field',
      'And the form should have email input field',
      'And the form should have message textarea',
      'And the form should have a submit button'
    ]
  },
  {
    key: 'MSCSHIP-16',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the contact form',
      'When user tries to submit the form without filling required fields',
      'Then the form should display validation errors',
      'And the form should not submit',
      'And error messages should indicate which fields are required'
    ]
  },
  {
    key: 'MSCSHIP-17',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given the contact form is configured to use mock handler',
      'When user submits the form with valid data',
      'Then the mock handler should receive the form data',
      'And the mock handler should return the submitted data',
      'And the response should confirm successful submission'
    ]
  },
  {
    key: 'MSCSHIP-18',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given the contact form is configured to use real handler',
      'When user submits the form with valid data',
      'Then the real handler should process the form data',
      'And the data should be logged to the database',
      'And user should see a success confirmation message'
    ]
  },
  {
    key: 'MSCSHIP-19',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user navigates to the cruises page',
      'When the page loads',
      'Then the cruises page should display successfully',
      'And the HTTP status code should be 200',
      'And the page should be ready for interaction'
    ]
  },
  {
    key: 'MSCSHIP-20',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When the page loads',
      'Then the page should display a list of available cruise listings',
      'And each listing should show cruise information',
      'And the listings should be visible to the user'
    ]
  },
  {
    key: 'MSCSHIP-21',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When the page loads',
      'Then the page should have search and filter functionality',
      'And user should see filter options for ports, dates, or ships',
      'And the search/filter controls should be interactive'
    ]
  },
  {
    key: 'MSCSHIP-22',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When the page displays cruise listings',
      'Then each cruise card should display cruise details',
      'And the card should show cruise name',
      'And the card should show departure date',
      'And the card should show destination ports',
      'And the card should show pricing information'
    ]
  },
  {
    key: 'MSCSHIP-23',
    criteria: [
      'Acceptance Criteria:',
      '',
      'Given user is on the cruises page',
      'When user clicks on a cruise card',
      'Then the system should allow viewing detailed cruise information',
      'And a modal or detail page should open',
      'And the details should include full itinerary and pricing'
    ]
  }
];

async function updateAllStories() {
  console.log(`\n🔄 Updating ${stories.length} Jira stories with acceptance criteria...\n`);
  
  let updated = 0;
  let failed = 0;
  const failedStories = [];
  
  for (const story of stories) {
    try {
      const adfDescription = createADF(story.criteria);
      
      await client.makeRequest(`issue/${story.key}`, {
        method: 'PUT',
        body: JSON.stringify({
          fields: {
            description: adfDescription
          }
        })
      });
      
      console.log(`✅ Updated ${story.key}`);
      updated++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed ${story.key}: ${error.message}`);
      failed++;
      failedStories.push({ key: story.key, error: error.message });
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Update Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`${'═'.repeat(60)}`);
  
  if (failedStories.length > 0) {
    console.log(`\n❌ Failed Stories:`);
    failedStories.forEach(({ key, error }) => {
      console.log(`   ${key}: ${error}`);
    });
  }
  
  if (updated > 0) {
    console.log(`\n✨ Next steps:`);
    console.log(`   1. Run: npm run jira:sync`);
    console.log(`   2. Run: npm start`);
  }
}

updateAllStories().catch(console.error);
