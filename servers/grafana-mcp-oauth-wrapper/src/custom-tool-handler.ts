import { customTools, QueryDatasourceParams, DatasourceInfo } from './custom-mcp-tools';

export class CustomToolHandler {
  constructor(
    private grafanaUrl: string,
    private grafanaApiKey: string
  ) {}

  async handleCustomTool(request: any): Promise<any> {
    const { method, params, id } = request;

    try {
      let result;
      
      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        case 'query_datasource':
          result = await this.queryDatasource(params);
          break;
        case 'list_datasources_detailed':
          result = await this.listDatasourcesDetailed();
          break;
        default:
          throw new Error(`Unknown custom tool: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: error
        }
      };
    }
  }

  private async handleInitialize(params: any) {
    return {
      protocolVersion: '2025-06-18',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'grafana-mcp-custom-tools',
        version: '1.0.0'
      },
      instructions: `Custom Grafana MCP tools for enhanced datasource querying.

Available tools:
- query_datasource: Query any Grafana datasource by UID with native query format
- list_datasources_detailed: Get detailed information about all configured datasources

These tools extend the official Grafana MCP server with generic datasource querying capabilities.`
    };
  }

  private async handleToolsList() {
    // Return only our custom tools - the main handler will combine with Grafana tools
    return {
      tools: Object.values(customTools)
    };
  }

  private async queryDatasource(params: QueryDatasourceParams) {
    const { datasourceUid, query, timeRange, maxDataPoints } = params;

    // Build the query request for Grafana's query API
    const queryRequest = {
      queries: [{
        datasource: { uid: datasourceUid },
        ...query,
        refId: 'A',
        ...(timeRange && {
          timeRange: {
            from: timeRange.from || 'now-1h',
            to: timeRange.to || 'now'
          }
        }),
        ...(maxDataPoints && { maxDataPoints })
      }]
    };

    console.log(`Executing custom datasource query:`, JSON.stringify(queryRequest, null, 2));

    const response = await fetch(`${this.grafanaUrl}/api/ds/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.grafanaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grafana query failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    // Format response for MCP protocol compliance
    const frameCount = (result as any).results?.A?.frames?.length || 0;
    const summary = `Query executed successfully. Returned ${frameCount} data frames.`;
    
    return {
      content: [
        {
          type: "text",
          text: `**Query Results Summary**\n\n${summary}\n\n**Datasource**: ${datasourceUid}\n**Query**: ${JSON.stringify(query, null, 2)}\n**Time Range**: ${timeRange?.from || 'now-1h'} to ${timeRange?.to || 'now'}\n\n**Data Frames**: ${frameCount}`
        },
        {
          type: "text", 
          text: `**Raw Data**:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
        }
      ]
    };
  }

  private async listDatasourcesDetailed() {
    console.log('Fetching detailed datasource information from Grafana');

    const response = await fetch(`${this.grafanaUrl}/api/datasources`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.grafanaApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch datasources: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const datasources = await response.json() as any[];
    
    const detailedDatasources: DatasourceInfo[] = datasources.map(ds => ({
      uid: ds.uid,
      name: ds.name,
      type: ds.type,
      url: ds.url,
      isDefault: ds.isDefault || false
    }));

    // Provide query examples for common datasource types
    const queryExamples = {
      'grafana-azure-monitor-datasource': {
        logs: {
          kusto: 'Heartbeat | where TimeGenerated > ago(1h) | limit 10',
          description: 'KQL query for Azure Monitor Logs'
        },
        metrics: {
          metricDefinition: {
            resourceGroup: 'your-resource-group',
            metricNamespace: 'Microsoft.Compute/virtualMachines',
            resourceName: 'your-vm-name',
            metricName: 'Percentage CPU'
          },
          description: 'Azure Monitor metrics query'
        }
      },
      'prometheus': {
        query: {
          expr: 'up',
          description: 'PromQL query for Prometheus'
        }
      },
      'loki': {
        query: {
          expr: '{job="your-job"} |= "error"',
          description: 'LogQL query for Loki'
        }
      },
      'mysql': {
        query: {
          rawSql: 'SELECT * FROM your_table LIMIT 10',
          description: 'SQL query for MySQL'
        }
      },
      'postgres': {
        query: {
          rawSql: 'SELECT * FROM your_table LIMIT 10',
          description: 'SQL query for PostgreSQL'
        }
      },
      'influxdb': {
        query: {
          query: 'from(bucket:"your-bucket") |> range(start: -1h) |> limit(n:10)',
          description: 'Flux query for InfluxDB'
        }
      }
    };

    return {
      content: [
        {
          type: "text",
          text: `**Datasources Found**: ${detailedDatasources.length}\n\n${detailedDatasources.map(ds => 
            `**${ds.name}** (${ds.type})\n- UID: \`${ds.uid}\`\n- Default: ${ds.isDefault ? 'Yes' : 'No'}\n- URL: ${ds.url || 'N/A'}`
          ).join('\n\n')}`
        },
        {
          type: "text",
          text: `**Query Examples**:\n\n${Object.entries(queryExamples).map(([type, examples]) => 
            `**${type}**:\n${Object.entries(examples as any).map(([key, value]) => 
              `- ${key}: \`${typeof value === 'object' ? JSON.stringify(value) : value}\``
            ).join('\n')}`
          ).join('\n\n')}`
        },
        {
          type: "text",
          text: `**Usage Guide**:\n- Azure Monitor: Use {queryType: "Azure Log Analytics", azureLogAnalytics: {query: "your KQL query", workspace: "workspace-id"}}\n- Prometheus: Use {expr: "your PromQL query"}\n- SQL databases: Use {rawSql: "your SQL query"}\n- Loki: Use {expr: "your LogQL query"}`
        }
      ]
    };
  }

  isCustomTool(method: string): boolean {
    // Only handle our 2 custom tools, let everything else go to Grafana MCP server
    return method === 'query_datasource' || method === 'list_datasources_detailed';
  }
}