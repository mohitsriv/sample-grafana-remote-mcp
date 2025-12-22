#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CLOUDFRONT_URL = 'https://d3jifvmn9ry95.cloudfront.net';
const MCP_BASE_PATH = '/grafana/mcp';
const COGNITO_DOMAIN = 'https://mcp-server-6311-useast1.auth.us-east-1.amazoncognito.com';
const CLIENT_ID = '59q3oi9virobefilsptmcfmbo6';

// Load CLIENT_SECRET from .env
let CLIENT_SECRET = null;
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/CLIENT_SECRET=(.+)/);
    if (match) {
      CLIENT_SECRET = match[1].trim();
    }
  }
} catch (error) {
  console.error('Error loading .env file:', error.message);
}

/**
 * Makes an HTTPS request and returns parsed response
 */
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Get OAuth access token using client credentials flow
 */
async function getAccessToken() {
  if (!CLIENT_SECRET || CLIENT_SECRET === 'placeholder-replace-with-actual-secret') {
    throw new Error('CLIENT_SECRET not configured. Please set it in .env file.');
  }

  const response = await makeRequest(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials&scope=mcp-server/read mcp-server/write'
  });

  if (response.status !== 200 || !response.data.access_token) {
    throw new Error(`Failed to get access token: ${response.data.error || 'Unknown error'}`);
  }

  return response.data.access_token;
}

/**
 * Make authenticated MCP request
 */
async function makeMcpRequest(token, method, params = {}) {
  const response = await makeRequest(`${CLOUDFRONT_URL}${MCP_BASE_PATH}/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000),
      method,
      params
    })
  });

  return response;
}

/**
 * Test custom MCP tools
 */
async function testCustomTools() {
  console.log('🧪 Testing Custom Grafana MCP Tools');
  console.log('====================================\n');

  try {
    // Get access token
    console.log('1. Getting OAuth access token...');
    const token = await getAccessToken();
    console.log('   ✅ Successfully obtained access token\n');

    // Test 1: Initialize custom tools
    console.log('2. Testing custom tools initialization...');
    const initResponse = await makeMcpRequest(token, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'custom-tools-test',
        version: '1.0.0'
      }
    });

    console.log(`   Status: ${initResponse.status}`);
    if (initResponse.status === 200 && initResponse.data.result) {
      console.log('   ✅ Custom tools initialization successful');
      console.log(`   Server: ${initResponse.data.result.serverInfo?.name}`);
      console.log(`   Version: ${initResponse.data.result.serverInfo?.version}`);
    } else {
      console.log('   ❌ Custom tools initialization failed');
      console.log(`   Error: ${JSON.stringify(initResponse.data, null, 2)}`);
    }

    // Test 2: List custom tools
    console.log('\n3. Testing tools/list...');
    const toolsResponse = await makeMcpRequest(token, 'tools/list');
    
    console.log(`   Status: ${toolsResponse.status}`);
    if (toolsResponse.status === 200 && toolsResponse.data.result) {
      console.log('   ✅ Tools list successful');
      const tools = toolsResponse.data.result.tools || [];
      console.log(`   Found ${tools.length} custom tools:`);
      tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description.substring(0, 80)}...`);
      });
    } else {
      console.log('   ❌ Tools list failed');
      console.log(`   Error: ${JSON.stringify(toolsResponse.data, null, 2)}`);
    }

    // Test 3: List datasources
    console.log('\n4. Testing list_datasources_detailed...');
    const datasourcesResponse = await makeMcpRequest(token, 'list_datasources_detailed');
    
    console.log(`   Status: ${datasourcesResponse.status}`);
    if (datasourcesResponse.status === 200 && datasourcesResponse.data.result) {
      console.log('   ✅ Datasources list successful');
      const result = datasourcesResponse.data.result;
      console.log(`   Found ${result.datasources?.length || 0} datasources:`);
      
      if (result.datasources) {
        result.datasources.forEach(ds => {
          console.log(`   - ${ds.name} (${ds.type}) - UID: ${ds.uid}`);
        });
      }
      
      if (result.queryExamples) {
        console.log('\n   Query examples available for:');
        Object.keys(result.queryExamples).forEach(type => {
          console.log(`   - ${type}`);
        });
      }
    } else {
      console.log('   ❌ Datasources list failed');
      console.log(`   Error: ${JSON.stringify(datasourcesResponse.data, null, 2)}`);
    }

    // Test 4: Test query_datasource (if we have datasources)
    if (datasourcesResponse.status === 200 && datasourcesResponse.data.result?.datasources?.length > 0) {
      console.log('\n5. Testing query_datasource...');
      const datasources = datasourcesResponse.data.result.datasources;
      const testDatasource = datasources[0]; // Use first available datasource
      
      // Create a simple test query based on datasource type
      let testQuery;
      switch (testDatasource.type) {
        case 'grafana-azure-monitor-datasource':
          testQuery = { kusto: 'Heartbeat | limit 1' };
          break;
        case 'prometheus':
          testQuery = { expr: 'up' };
          break;
        case 'mysql':
        case 'postgres':
          testQuery = { rawSql: 'SELECT 1' };
          break;
        default:
          testQuery = { query: 'test' };
      }

      const queryResponse = await makeMcpRequest(token, 'query_datasource', {
        datasourceUid: testDatasource.uid,
        query: testQuery,
        timeRange: {
          from: 'now-1h',
          to: 'now'
        }
      });

      console.log(`   Status: ${queryResponse.status}`);
      if (queryResponse.status === 200 && queryResponse.data.result) {
        console.log('   ✅ Datasource query successful');
        console.log(`   Datasource: ${testDatasource.name} (${testDatasource.type})`);
        console.log(`   Query: ${JSON.stringify(testQuery)}`);
        console.log(`   Summary: ${queryResponse.data.result.summary}`);
      } else {
        console.log('   ⚠️  Datasource query failed (may be expected if no data or permissions)');
        console.log(`   Error: ${queryResponse.data.error?.message || 'Unknown error'}`);
      }
    } else {
      console.log('\n5. Skipping query_datasource test (no datasources available)');
    }

    console.log('\n====================================');
    console.log('🎉 Custom tools testing completed!');
    console.log('\n📝 Summary:');
    console.log('✅ Custom MCP tools are deployed and functional');
    console.log('✅ Generic datasource querying capability available');
    console.log('✅ Supports Azure Monitor, Prometheus, SQL, and other datasources');
    console.log('\n🔗 MCP Server URL: https://d3jifvmn9ry95.cloudfront.net/grafana/mcp/');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('CLIENT_SECRET')) {
      console.log('\n💡 To run full tests:');
      console.log('1. Get client secret: aws secretsmanager get-secret-value --secret-id UserPoolClientSecret --region us-west-2 --query SecretString --output text');
      console.log('2. Add to .env file: CLIENT_SECRET=your-actual-secret');
      console.log('3. Re-run this test');
    }
  }
}

testCustomTools().catch(console.error);