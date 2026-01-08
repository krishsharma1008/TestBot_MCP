module.exports = {
  aiProvider: process.env.AI_PROVIDER || 'openai',
  
  apiKey: process.env.AI_API_KEY,
  
  model: process.env.AI_MODEL || 'gpt-4',
  
  githubToken: process.env.GITHUB_TOKEN,
  
  minConfidence: 0.7,
  
  createPR: true,
  
  autoCommit: true,
  
  baseBranch: 'main',
  
  branchPrefix: 'ai-fix',
  
  rollbackOnFailure: false,
  
  reportDir: './ai-agent-reports'
};
