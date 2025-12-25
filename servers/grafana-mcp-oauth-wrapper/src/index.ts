import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { OAuthValidator } from './oauth-validator';
import { GrafanaMcpProxy } from './grafana-mcp-proxy';
import { GrafanaMcpHttpProxy } from './grafana-mcp-http-proxy';
import { CustomToolHandler } from './custom-tool-handler';

const app = new Hono();
const port = parseInt(process.env.PORT || '8080');
const basePath = process.env.BASE_PATH || '';
const mcpTransport = process.env.MCP_TRANSPORT || 'stdio'; // 'stdio' or 'http'

// Initialize OAuth validator
const oauthValidator = new OAuthValidator({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  region: process.env.AWS_REGION!,
});

// Initialize appropriate Grafana MCP proxy based on transport
const grafanaProxy = mcpTransport === 'http' 
  ? new GrafanaMcpHttpProxy({
      grafanaServiceAccountToken: process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN!,
      grafanaUrl: process.env.GRAFANA_URL || 'http://localhost:3000',
      mcpServerPort: parseInt(process.env.MCP_SERVER_PORT || '3001'),
    })
  : new GrafanaMcpProxy({
      grafanaServiceAccountToken: process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN!,
      grafanaUrl: process.env.GRAFANA_URL || 'http://localhost:3000',
    });

// Initialize custom tool handler for extended functionality
const customToolHandler = new CustomToolHandler(
  process.env.GRAFANA_URL || 'http://localhost:3000',
  process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN!
);

console.log(`Using MCP transport: ${mcpTransport}`);

// Health check endpoint
app.get(`${basePath}/health`, (c) => {
  return c.json({ 
    status: 'healthy', 
    transport: mcpTransport,
    timestamp: new Date().toISOString() 
  });
});

// OAuth 2.0 Protected Resource Metadata endpoint (RFC9728)
app.get(`${basePath}/.well-known/oauth-protected-resource`, (c) => {
  // Force HTTPS for OAuth discovery endpoint - CloudFront should always be HTTPS
  const baseUrl = `https://${c.req.header('host')}${basePath}`;
  
  return c.json({
    resource: baseUrl,
    authorization_servers: [`https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`],
    scopes_supported: ['mcp-server/read', 'mcp-server/write'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/docs`,
  });
});

// Proxy MCP GET requests (SSE) to Grafana MCP server
app.get(`${basePath}/`, async (c) => {
  try {
    console.log(`Received GET request`);
    console.log(`Request headers:`, c.req.header());
    
    const acceptHeader = c.req.header('accept') || '';
    
    // If client accepts text/event-stream, establish SSE connection
    if (acceptHeader.includes('text/event-stream')) {
      console.log('Establishing SSE connection');
      
      return new Response(
        new ReadableStream({
          start(controller) {
            // Send initial SSE connection established message
            controller.enqueue(new TextEncoder().encode('data: {"type":"connection","status":"established"}\n\n'));
            
            // Keep connection alive with periodic heartbeat
            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(new TextEncoder().encode('data: {"type":"heartbeat"}\n\n'));
              } catch (error) {
                clearInterval(heartbeat);
              }
            }, 30000); // 30 second heartbeat
            
            // Handle connection close
            return () => {
              clearInterval(heartbeat);
            };
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
          },
        }
      );
    }
    
    // For regular HTTP requests (like agent validation), return server info
    console.log('Returning server info for validation');
    return c.json({
      server: 'grafana-mcp-oauth-wrapper',
      version: '1.0.0',
      transport: 'http',
      capabilities: ['tools', 'resources'],
      status: 'ready'
    });
    
  } catch (error) {
    console.error('MCP GET request error:', error);
    return c.json({ 
      error: 'internal_error', 
      error_description: 'Failed to process request' 
    }, 500);
  }
});

// Proxy MCP POST requests (JSON-RPC) to Grafana MCP server
app.post(`${basePath}/`, async (c) => {
  try {
    // Validate OAuth token for all POST requests
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        error: 'unauthorized', 
        error_description: 'Missing or invalid authorization header' 
      }, 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      await oauthValidator.validateToken(token);
    } catch (error) {
      console.error('OAuth validation failed:', error);
      return c.json({ 
        error: 'unauthorized', 
        error_description: 'Invalid or expired access token' 
      }, 401);
    }

    const body = await c.req.json();
    console.log(`Received authenticated request:`, body);
    console.log(`Request headers:`, c.req.header());
    
    // Check if this is a tools/call request for our custom tools
    if (body.method === 'tools/call' && body.params?.name) {
      const toolName = body.params.name;
      if (customToolHandler.isCustomTool(toolName)) {
        console.log(`Handling custom tool call: ${toolName}`);
        // Convert tools/call format to direct method call format for our handler
        const customRequest = {
          method: toolName,
          params: body.params.arguments || {},
          id: body.id
        };
        const response = await customToolHandler.handleCustomTool(customRequest);
        return c.json(response);
      }
    }
    
    // Special handling for tools/list to combine Grafana tools with our custom tools
    if (body.method === 'tools/list') {
      console.log('Handling tools/list - combining Grafana and custom tools');
      
      try {
        // Get tools from Grafana MCP server
        const sessionId = c.req.header('mcp-session-id');
        const grafanaResponse = await grafanaProxy.handleMcpRequest(body, sessionId);
        const responseText = await grafanaResponse.text();
        
        console.log('Grafana tools response text:', responseText);
        
        let grafanaData;
        try {
          grafanaData = JSON.parse(responseText);
        } catch (parseError) {
          console.log('Failed to parse Grafana response as JSON, treating as error:', parseError);
          // If we can't parse the response, it might be a plain text error
          // In this case, just return our custom tools
          grafanaData = { result: { tools: [] } };
        }
        
        console.log('Grafana tools response parsed:', JSON.stringify(grafanaData, null, 2));
        
        // Get our custom tools directly (not through handleCustomTool)
        const customTools = [
          {
            name: 'list_datasources_detailed',
            description: 'List all Grafana datasources with detailed information including query examples for Azure Monitor (KQL), Prometheus (PromQL), SQL databases, and more',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'query_datasource',
            description: 'Query any Grafana datasource using native query formats (KQL for Azure Monitor, PromQL for Prometheus, SQL for databases, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                datasourceUid: {
                  type: 'string',
                  description: 'The UID of the datasource to query'
                },
                query: {
                  type: 'object',
                  description: 'Query object in native format (e.g., {kusto: "KQL query"} for Azure Monitor, {expr: "PromQL"} for Prometheus)'
                },
                timeRange: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', description: 'Start time (e.g., "now-1h")' },
                    to: { type: 'string', description: 'End time (e.g., "now")' }
                  }
                },
                maxDataPoints: {
                  type: 'number',
                  description: 'Maximum number of data points to return'
                }
              },
              required: ['datasourceUid', 'query']
            }
          }
        ];
        
        // Combine the tools
        if (grafanaData.result && grafanaData.result.tools) {
          const combinedTools = [
            ...grafanaData.result.tools,
            ...customTools
          ];
          
          console.log(`Combined ${grafanaData.result.tools.length} Grafana tools with ${customTools.length} custom tools = ${combinedTools.length} total`);
          
          return c.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: combinedTools
            }
          });
        }
        
        // Fallback to Grafana response if no tools found
        console.log('No Grafana tools found, returning Grafana response');
        return c.json(grafanaData);
        
      } catch (error) {
        console.error('Error in tools/list handling:', error);
        return c.json({ 
          error: 'internal_error', 
          error_description: `Failed to combine tools: ${error}` 
        }, 500);
      }
    }
    
    // Forward ALL other requests (including initialize) to official Grafana MCP server
    const sessionId = c.req.header('mcp-session-id');
    const response = await grafanaProxy.handleMcpRequest(body, sessionId);
    return response;
  } catch (error) {
    console.error('MCP request error:', error);
    return c.json({ 
      error: 'internal_error', 
      error_description: 'Failed to process MCP request' 
    }, 500);
  }
});

// Proxy MCP DELETE requests (session termination) to Grafana MCP server
app.delete(`${basePath}/`, async (c) => {
  try {
    console.log(`Received session termination request`);
    console.log(`Request headers:`, c.req.header());
    
    // For HTTP transport, forward DELETE to terminate session
    if (mcpTransport === 'http') {
      const mcpServerPort = parseInt(process.env.MCP_SERVER_PORT || '3001');
      const mcpServerUrl = `http://localhost:${mcpServerPort}/mcp`;
      const sessionId = c.req.header('mcp-session-id');
      
      const headers: Record<string, string> = {};
      if (sessionId) {
        headers['mcp-session-id'] = sessionId;
      }
      
      const response = await fetch(mcpServerUrl, {
        method: 'DELETE',
        headers,
      });
      
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }
    
    return c.json({ error: 'not_supported' }, 400);
  } catch (error) {
    console.error('MCP session termination error:', error);
    return c.json({ 
      error: 'internal_error', 
      error_description: 'Failed to terminate session' 
    }, 500);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await grafanaProxy.shutdown();
  process.exit(0);
});

// Start server
console.log(`Starting Grafana MCP OAuth Wrapper on port ${port}`);
serve({
  fetch: app.fetch,
  port,
});

console.log(`Grafana MCP OAuth Wrapper is running on http://localhost:${port}${basePath}`);
