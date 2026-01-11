require('dotenv').config();
const fetch = require('node-fetch');

async function testSarvamAPI() {
  const apiKey = process.env.SARVAM_API_KEY;
  
  if (!apiKey) {
    console.error('❌ SARVAM_API_KEY not found in .env');
    return;
  }
  
  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  console.log('🌐 Testing Sarvam API...\n');
  
  const testMessages = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Respond with a simple JSON object: {"message": "Hello"}'
    },
    {
      role: 'user',
      content: 'Say hello'
    }
  ];
  
  try {
    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': apiKey
      },
      body: JSON.stringify({
        model: 'sarvam-m',
        messages: testMessages,
        temperature: 0.2,
        max_tokens: 500,
        n: 1
      })
    });
    
    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📋 Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`   ${key}: ${value}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Error Response:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n✅ Response received!');
    console.log('📦 Response keys:', Object.keys(data));
    console.log('\n📄 Full Response Structure:');
    console.log(JSON.stringify(data, null, 2));
    
    // Try to extract content
    console.log('\n🔍 Attempting to extract content:');
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('✓ Found: data.choices[0].message.content');
      console.log('Content:', data.choices[0].message.content);
    } else if (data.message?.content) {
      console.log('✓ Found: data.message.content');
      console.log('Content:', data.message.content);
    } else if (data.content) {
      console.log('✓ Found: data.content');
      console.log('Content:', data.content);
    } else if (data.text) {
      console.log('✓ Found: data.text');
      console.log('Content:', data.text);
    } else {
      console.log('❌ Could not find content in expected locations');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSarvamAPI();
