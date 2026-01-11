const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class JiraClient {
  constructor(config) {
    this.baseUrl = config.jiraBaseUrl;
    this.email = config.jiraEmail;
    this.apiToken = config.jiraApiToken;
    this.projectKey = config.jiraProjectKey;
    this.cacheDir = path.join(process.cwd(), '.jira-cache');
    
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getAuthHeader() {
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return `Basic ${auth}`;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/api/3/${endpoint}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jira API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to make request to ${endpoint}:`, error.message);
      throw error;
    }
  }

  async getProject() {
    return await this.makeRequest(`project/${this.projectKey}`);
  }

  async getIssues(jql = null) {
    const defaultJql = `project = ${this.projectKey} AND type = Story ORDER BY updated DESC`;
    const query = jql || defaultJql;
    
    const response = await this.makeRequest(
      `search/jql?jql=${encodeURIComponent(query)}&maxResults=100&fields=summary,description,status,acceptanceCriteria,customfield_*,updated,created,priority,assignee,labels`
    );
    
    return response.issues || [];
  }

  async getIssue(issueKey) {
    return await this.makeRequest(
      `issue/${issueKey}?fields=summary,description,status,acceptanceCriteria,customfield_*,updated,created,priority,assignee,labels,comment`
    );
  }

  async getIssueChangelog(issueKey) {
    return await this.makeRequest(`issue/${issueKey}/changelog`);
  }

  async getUserStories(filters = {}) {
    let jql = `project = ${this.projectKey} AND type = Story`;
    
    if (filters.status) {
      jql += ` AND status = "${filters.status}"`;
    }
    
    if (filters.sprint) {
      jql += ` AND sprint = "${filters.sprint}"`;
    }
    
    if (filters.updatedAfter) {
      jql += ` AND updated >= "${filters.updatedAfter}"`;
    }
    
    jql += ' ORDER BY updated DESC';
    
    return await this.getIssues(jql);
  }

  extractAcceptanceCriteria(issue) {
    const criteria = [];
    const description = issue.fields.description || '';
    
    // Try to find custom acceptance criteria field
    const customFields = Object.keys(issue.fields).filter(key => key.startsWith('customfield_'));
    for (const field of customFields) {
      const value = issue.fields[field];
      if (value && typeof value === 'string' && 
          (value.toLowerCase().includes('acceptance') || value.toLowerCase().includes('criteria'))) {
        criteria.push(...this.parseAcceptanceCriteria(value));
      }
    }
    
    // Parse from description
    if (typeof description === 'string') {
      criteria.push(...this.parseAcceptanceCriteria(description));
    } else if (description.content) {
      // Handle Atlassian Document Format
      const text = this.extractTextFromADF(description);
      criteria.push(...this.parseAcceptanceCriteria(text));
    }
    
    return [...new Set(criteria)]; // Remove duplicates
  }

  parseAcceptanceCriteria(text) {
    const criteria = [];
    const lines = text.split('\n');
    let inCriteriaSection = false;
    
    for (let line of lines) {
      line = line.trim();
      
      // Detect acceptance criteria section
      if (line.toLowerCase().includes('acceptance criteria') || 
          line.toLowerCase().includes('acceptance test')) {
        inCriteriaSection = true;
        continue;
      }
      
      // Stop at next section
      if (inCriteriaSection && line.match(/^#{1,3}\s+\w+/)) {
        inCriteriaSection = false;
      }
      
      // Extract criteria items
      if (inCriteriaSection || line.match(/^[-*]\s+Given|When|Then|And/i)) {
        const match = line.match(/^[-*]\s+(.+)/) || line.match(/^(\d+\.\s+.+)/);
        if (match) {
          criteria.push(match[1].trim());
        }
      }
    }
    
    return criteria;
  }

  extractTextFromADF(adf) {
    let text = '';
    
    if (!adf || !adf.content) return text;
    
    for (const node of adf.content) {
      if (node.type === 'paragraph' && node.content) {
        for (const textNode of node.content) {
          if (textNode.type === 'text') {
            text += textNode.text + '\n';
          }
        }
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        text += this.extractListItems(node) + '\n';
      }
    }
    
    return text;
  }

  extractListItems(listNode) {
    let text = '';
    if (!listNode.content) return text;
    
    for (const item of listNode.content) {
      if (item.type === 'listItem' && item.content) {
        for (const para of item.content) {
          if (para.content) {
            for (const textNode of para.content) {
              if (textNode.type === 'text') {
                text += '- ' + textNode.text + '\n';
              }
            }
          }
        }
      }
    }
    
    return text;
  }

  async saveCache(data, filename) {
    const filepath = path.join(this.cacheDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  loadCache(filename) {
    const filepath = path.join(this.cacheDir, filename);
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
    return null;
  }

  async detectChanges() {
    const currentIssues = await this.getUserStories();
    const cachedIssues = this.loadCache('issues-cache.json') || [];
    
    const changes = {
      new: [],
      updated: [],
      statusChanged: [],
      deleted: []
    };
    
    const currentMap = new Map(currentIssues.map(i => [i.key, i]));
    const cachedMap = new Map(cachedIssues.map(i => [i.key, i]));
    
    // Detect new and updated issues
    for (const [key, issue] of currentMap) {
      if (!cachedMap.has(key)) {
        changes.new.push(issue);
      } else {
        const cached = cachedMap.get(key);
        if (issue.fields.updated !== cached.fields.updated) {
          changes.updated.push({
            current: issue,
            previous: cached
          });
        }
        if (issue.fields.status.name !== cached.fields.status.name) {
          changes.statusChanged.push({
            key: issue.key,
            from: cached.fields.status.name,
            to: issue.fields.status.name,
            issue: issue
          });
        }
      }
    }
    
    // Detect deleted issues
    for (const [key, issue] of cachedMap) {
      if (!currentMap.has(key)) {
        changes.deleted.push(issue);
      }
    }
    
    // Update cache
    await this.saveCache(currentIssues, 'issues-cache.json');
    
    return changes;
  }

  async getStoryDetails(issueKey) {
    const issue = await this.getIssue(issueKey);
    const acceptanceCriteria = this.extractAcceptanceCriteria(issue);
    
    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || 'Medium',
      labels: issue.fields.labels || [],
      acceptanceCriteria,
      updated: issue.fields.updated,
      created: issue.fields.created
    };
  }
}

module.exports = JiraClient;
