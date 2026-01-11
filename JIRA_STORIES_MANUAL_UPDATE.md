# 📝 Manual Jira Stories Update Guide

Since the Jira API requires ADF (Atlassian Document Format) which is complex to generate programmatically, here's how to manually add acceptance criteria to the remaining 18 stories:

## 🎯 Stories That Need Acceptance Criteria

### **Backend API Tests (6 stories):**

#### **MSCSHIP-1: Cruise Search API - Returns cruises for ALL ports**
```
Acceptance Criteria:

Given the cruise search API endpoint is available
When a GET request is made to /api/cruises/search with port parameter set to ALL
Then the API should return a list of all available cruises
And the response should include cruise details like name, departure date, and ports
And the HTTP status code should be 200
```

#### **MSCSHIP-2: Cruise Detail API - Returns itinerary and ROM data**
```
Acceptance Criteria:

Given a valid cruise ID is provided
When a GET request is made to /api/cruises/detail endpoint
Then the API should return complete cruise details
And the response should include itinerary information
And the response should include ROM (rates and occupancy) data
And the HTTP status code should be 200
```

#### **MSCSHIP-5: Contact Form API - Rejects incomplete payload**
```
Acceptance Criteria:

Given the contact form API endpoint is available
When a POST request is made with incomplete payload (missing required fields)
Then the API should reject the request
And the response should return HTTP status code 400
And the response should include error message indicating missing fields
```

#### **MSCSHIP-6: Contact Form API - Accepts valid payload and logs entry**
```
Acceptance Criteria:

Given the contact form API endpoint is available
When a POST request is made with valid payload containing name, email, and message
Then the API should accept the request
And the API should log the contact entry to the database
And the response should return HTTP status code 200
And the response should include success confirmation
```

### **Frontend Tests (12 stories):**

#### **MSCSHIP-10: Reservation Page - Accessible for authenticated users**
```
Acceptance Criteria:

Given user is authenticated and logged in
When user navigates to /reservation page
Then the reservation page should load successfully
And user should see the reservation form
And the HTTP status code should be 200
```

#### **MSCSHIP-11: User Logout - From navbar dropdown**
```
Acceptance Criteria:

Given user is logged in
When user clicks on the user dropdown in navbar
And user clicks the logout button
Then user should be logged out
And user should be redirected to the home page
And the user session should be cleared
```

#### **MSCSHIP-12: Cruise Detail Modal - Renders with reservation form**
```
Acceptance Criteria:

Given user is on the cruises page
When user clicks on a cruise card to view details
Then a modal should open displaying cruise details
And the modal should contain a reservation form
And the form should have fields for passenger details
```

#### **MSCSHIP-13: Cruise Search - Filter by Navire (Ship)**
```
Acceptance Criteria:

Given user is on the cruises page
When user selects a ship name from the Navire (Ship) filter dropdown
Then the cruise listings should update to show only cruises for that ship
And the results should be filtered in real-time
And the page should display the filtered cruise cards
```

#### **MSCSHIP-14: Contact Page - Loads successfully**
```
Acceptance Criteria:

Given user navigates to the contact page
When the page loads
Then the contact page should display successfully
And the page should show the contact form
And the HTTP status code should be 200
```

#### **MSCSHIP-15: Contact Form - Displays all form elements**
```
Acceptance Criteria:

Given user is on the contact page
When the page loads
Then the form should display all required elements
And the form should have name input field
And the form should have email input field
And the form should have message textarea
And the form should have a submit button
```

#### **MSCSHIP-16: Contact Form - Validates required fields**
```
Acceptance Criteria:

Given user is on the contact form
When user tries to submit the form without filling required fields
Then the form should display validation errors
And the form should not submit
And error messages should indicate which fields are required
```

#### **MSCSHIP-17: Contact Form - Submits via mock handler**
```
Acceptance Criteria:

Given the contact form is configured to use mock handler
When user submits the form with valid data
Then the mock handler should receive the form data
And the mock handler should return the submitted data
And the response should confirm successful submission
```

#### **MSCSHIP-18: Contact Form - Submits via real handler and logs entry**
```
Acceptance Criteria:

Given the contact form is configured to use real handler
When user submits the form with valid data
Then the real handler should process the form data
And the data should be logged to the database
And user should see a success confirmation message
```

#### **MSCSHIP-19: Cruises Page - Loads successfully**
```
Acceptance Criteria:

Given user navigates to the cruises page
When the page loads
Then the cruises page should display successfully
And the HTTP status code should be 200
And the page should be ready for interaction
```

#### **MSCSHIP-20: Cruises Page - Displays cruise listings**
```
Acceptance Criteria:

Given user is on the cruises page
When the page loads
Then the page should display a list of available cruise listings
And each listing should show cruise information
And the listings should be visible to the user
```

#### **MSCSHIP-21: Cruises Page - Has search/filter functionality**
```
Acceptance Criteria:

Given user is on the cruises page
When the page loads
Then the page should have search and filter functionality
And user should see filter options for ports, dates, or ships
And the search/filter controls should be interactive
```

#### **MSCSHIP-22: Cruises Page - Displays cruise cards with details**
```
Acceptance Criteria:

Given user is on the cruises page
When the page displays cruise listings
Then each cruise card should display cruise details
And the card should show cruise name
And the card should show departure date
And the card should show destination ports
And the card should show pricing information
```

#### **MSCSHIP-23: Cruises Page - Allows viewing cruise details**
```
Acceptance Criteria:

Given user is on the cruises page
When user clicks on a cruise card
Then the system should allow viewing detailed cruise information
And a modal or detail page should open
And the details should include full itinerary and pricing
```

---

## 📋 How to Add Acceptance Criteria

### **Option 1: Via Jira Web UI (Recommended)**

1. Go to https://shreyespd12.atlassian.net
2. Navigate to your MSCSHIP project
3. Click on each story (e.g., MSCSHIP-1)
4. Click "Edit" or the description field
5. Copy and paste the acceptance criteria from above
6. Click "Save"

### **Option 2: Bulk Update**

1. Export all stories to CSV
2. Add acceptance criteria column
3. Import back to Jira

---

## 🔄 After Adding Criteria

Once you've added the acceptance criteria to the stories:

```bash
# Re-sync Jira to generate tests
npm run jira:sync

# Run the complete workflow
npm start
```

This will:
- Generate tests for all 23 stories (instead of just 5)
- Run all generated tests
- Update dashboard with complete coverage

---

## 📊 Expected Results

After adding all acceptance criteria:
- **Current:** 5 test files, 7 test cases
- **After:** 23 test files, 40+ test cases
- **Coverage:** 100% of Jira stories

---

**Note:** The Jira API v3 requires ADF (Atlassian Document Format) for descriptions, which is why programmatic updates are complex. Manual updates via the web UI are simpler and more reliable.
