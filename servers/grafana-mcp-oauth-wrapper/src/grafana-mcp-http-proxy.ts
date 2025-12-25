import { spawn, ChildProcess } from 'child_process';

export interface GrafanaMcpHttpProxyConfig {
  grafanaServiceAccountToken: string;
  grafanaUrl: string;
  mcpServerPort?: number;
}

export class GrafanaMcpHttpProxy {
  private mcpProcess: ChildProcess | null = null;
  private isInitialized = false;
  private mcpServerUrl: string;
  private sessionId: string | null = null;
  private sseConnection: AbortController | null = null;

  constructor(private config: GrafanaMcpHttpProxyConfig) {
    const port = config.mcpServerPort || 3001;
    this.mcpServerUrl = `http://localhost:${port}/mcp`;
  }

  private async initializeMcpServer(): Promise<void> {
    if (this.isInitialized && this.mcpProcess && !this.mcpProcess.killed) {
      console.log('MCP server already initialized and running, skipping initialization');
      return;
    }

    console.log(`MCP server needs initialization. Current state: initialized=${this.isInitialized}, process=${!!this.mcpProcess}, killed=${this.mcpProcess?.killed}`);

    const port = this.config.mcpServerPort || 3001;

    console.log(`Starting MCP server on port ${port} with Grafana URL: ${this.config.grafanaUrl}`);

    // Start Grafana MCP server with HTTP transport - use --address 0.0.0.0:port to bind to all interfaces
    this.mcpProcess = spawn('mcp-grafana', ['-t', 'streamable-http', '--address', `0.0.0.0:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GRAFANA_URL: this.config.grafanaUrl,
        GRAFANA_SERVICE_ACCOUNT_TOKEN: this.config.grafanaServiceAccountToken
      }
    });

    this.mcpProcess.stdout?.on('data', (data) => {
      console.log('MCP Server STDOUT:', data.toString().trim());
    });

    this.mcpProcess.stderr?.on('data', (data) => {
      console.error('MCP Server STDERR:', data.toString().trim());
    });

    this.mcpProcess.on('exit', (code, signal) => {
      console.log(`MCP server exited with code ${code}, signal ${signal}`);
      this.isInitialized = false;
    });

    this.mcpProcess.on('error', (error) => {
      console.error('MCP server spawn error:', error);
      this.isInitialized = false;
    });

    // Add process debugging
    console.log(`MCP process PID: ${this.mcpProcess.pid}`);
    console.log(`MCP process command: mcp-grafana -t streamable-http --address 0.0.0.0:${port}`);

    // Wait for server to start
    await this.waitForServer();
    this.isInitialized = true;
  }

  private async waitForServer(): Promise<void> {
    const maxRetries = 10;
    const retryDelayMs = 500;

    const url = this.mcpServerUrl; // e.g. http://127.0.0.1:3001/mcp
    console.log(`Waiting for MCP server to start at ${url}`);

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < maxRetries; i++) {
      console.log(`Connection attempt ${i + 1}/${maxRetries} to ${url}`);

      // 1) Try POST first (what we ultimately need for JSON-RPC)
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // minimal body is fine; server will complain about session if stream transport
          body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
          signal: ctrl.signal,
        });
        clearTimeout(t);

        console.log(`POST status: ${res.status} ${res.statusText}`);

        if (res.ok) {
          console.log('MCP server is ready (POST 2xx).');
          return;
        }

        // StreamableHTTP: server is alive but requires a session → 400 "Invalid session ID"
        const text = await res.text().catch(() => '');
        if (res.status === 400 && text.includes('Invalid session ID')) {
          console.log('MCP server is ready (POST 400 with "Invalid session ID").');
          return;
        }
      } catch (e) {
        console.log(`POST attempt failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // 2) Fallback probe: open SSE to confirm the stream endpoint is up
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);

        const sse = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream' },
          signal: ctrl.signal,
        });
        clearTimeout(t);

        const ctype = (sse.headers.get('content-type') || '').toLowerCase();
        console.log(`GET(SSE) status: ${sse.status} ${sse.statusText} ctype=${ctype}`);

        if (sse.status === 200 && ctype.includes('text/event-stream')) {
          console.log('MCP server is ready (SSE 200).');
          return;
        }
      } catch (e) {
        console.log(`SSE attempt failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      await sleep(retryDelayMs);
    }

    throw new Error('MCP server failed to start');
  }

  private async establishSession(): Promise<void> {
    if (this.sessionId && this.sseConnection) {
      console.log('Session already established:', this.sessionId);
      return;
    }

    console.log('Establishing SSE session with MCP server...');
    
    return new Promise((resolve, reject) => {
      this.sseConnection = new AbortController();
      
      const timeout = setTimeout(() => {
        this.sseConnection?.abort();
        reject(new Error('SSE session establishment timeout'));
      }, 10000);

      fetch(this.mcpServerUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
        signal: this.sseConnection.signal,
        // @ts-ignore - Node.js specific fetch options
        bodyTimeout: 0, // Disable body timeout for SSE streams
        headersTimeout: 10000,
      }).then(response => {
        if (!response.ok || !response.body) {
          clearTimeout(timeout);
          reject(new Error(`Failed to establish SSE connection: ${response.status}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processChunk = async () => {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('SSE stream ended');
              this.sessionId = null;
              this.sseConnection = null;
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            console.log('SSE chunk received:', buffer);

            // Look for session ID in the buffer
            if (!this.sessionId) {
              const match = buffer.match(/"sessionId"\s*:\s*"([^"]+)"/);
              if (match) {
                this.sessionId = match[1];
                console.log('Session established:', this.sessionId);
                clearTimeout(timeout);
                resolve();
                // Continue reading to keep connection alive
                processChunk();
              } else {
                // Keep reading until we get the session ID
                processChunk();
              }
            } else {
              // Session already established, just keep reading
              processChunk();
            }
          } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error('SSE connection error:', error);
              this.sessionId = null;
              this.sseConnection = null;
            }
          }
        };

        processChunk();
      }).catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async handleMcpRequest(requestBody: any, sessionId?: string): Promise<Response> {
    await this.initializeMcpServer();

    console.log(`Forwarding request to MCP server with session ${sessionId}:`, requestBody);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Only add session ID if we have one
      if (sessionId) {
        headers['mcp-session-id'] = sessionId;
      }

      const response = await fetch(`${this.mcpServerUrl}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log(`MCP server response: ${response.status} ${response.statusText}`);

      const responseBody = await response.text();
      console.log(`MCP server response body length: ${responseBody.length}`);
      console.log(`MCP server response body:`, responseBody);

      // If we get "Invalid session ID" error, try without session ID for basic operations
      if (response.status === 400 && responseBody.includes('Invalid session ID')) {
        console.log('Retrying request without session ID for basic operations');
        
        // Retry without session ID for basic operations like tools/list
        const retryResponse = await fetch(`${this.mcpServerUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`MCP server retry response: ${retryResponse.status} ${retryResponse.statusText}`);
        const retryBody = await retryResponse.text();
        console.log(`MCP server retry response body:`, retryBody);

        return new Response(retryBody, {
          status: retryResponse.status,
          statusText: retryResponse.statusText,
          headers: retryResponse.headers
        });
      }

      // If response is not JSON parseable and contains error text, convert to proper JSON error
      if (!response.ok && responseBody && !responseBody.trim().startsWith('{')) {
        console.log('Converting plain text error to JSON format');
        const errorResponse = {
          jsonrpc: '2.0',
          id: requestBody.id || 1,
          error: {
            code: -32603,
            message: 'Internal error',
            data: responseBody.trim()
          }
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 200, // Return 200 with JSON-RPC error format
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.error(`MCP server request failed:`, error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.sseConnection) {
      this.sseConnection.abort();
      this.sseConnection = null;
      this.sessionId = null;
    }
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isInitialized = false;
    }
  }
}
