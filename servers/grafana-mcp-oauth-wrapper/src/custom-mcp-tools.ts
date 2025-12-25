export interface CustomTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const customTools: Record<string, CustomTool> = {
  query_datasource: {
    name: "query_datasource",
    description: `Query any Grafana datasource with native query formats:
- Azure Monitor: KQL queries for logs and metrics
- Prometheus: PromQL for metrics  
- MySQL/PostgreSQL: SQL queries
- InfluxDB: Flux or InfluxQL queries
- Loki: LogQL queries
- Any other datasource type supported by Grafana

IMPORTANT: Use list_datasources_detailed (not list_datasources) first to get datasource UIDs and query format examples.`,
    inputSchema: {
      type: "object",
      properties: {
        datasourceUid: {
          type: "string",
          description: "UID of the datasource (get from list_datasources_detailed)"
        },
        query: {
          type: "object",
          description: "Query object - format depends on datasource type. Examples: {kusto: 'KQL query'} for Azure Monitor, {expr: 'PromQL'} for Prometheus, {rawSql: 'SQL'} for SQL databases"
        },
        timeRange: {
          type: "object",
          description: "Time range for the query",
          properties: {
            from: { type: "string", description: "Start time (ISO string or relative like 'now-1h')" },
            to: { type: "string", description: "End time (ISO string or relative like 'now')" }
          }
        },
        maxDataPoints: {
          type: "number",
          description: "Maximum number of data points to return (optional)"
        }
      },
      required: ["datasourceUid", "query"]
    }
  },

  list_datasources_detailed: {
    name: "list_datasources_detailed",
    description: "Enhanced datasource listing with query examples and detailed type information. Use this instead of list_datasources when you need to query datasources, as it provides query format examples for Azure Monitor (KQL), Prometheus (PromQL), SQL databases, and other types. The basic list_datasources only shows names and UIDs.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

export interface QueryDatasourceParams {
  datasourceUid: string;
  query: Record<string, any>;
  timeRange?: {
    from?: string;
    to?: string;
  };
  maxDataPoints?: number;
}

export interface DatasourceInfo {
  uid: string;
  name: string;
  type: string;
  url?: string;
  isDefault?: boolean;
  workspaceId?: string;
}