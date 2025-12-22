# Grafana MCP Server with OAuth 2.1 & Enhanced Datasource Querying

Secure [Grafana MCP](https://github.com/grafana/mcp-grafana) (Model Context Protocol) server with OAuth 2.1 authentication on AWS, enabling AI agents to query Grafana dashboards, metrics, traces, and logs. **Enhanced with custom tools for generic datasource querying including Azure Monitor, Prometheus, SQL databases, and more.**

## Features

🔐 **OAuth 2.1 Security**: Cognito-based authentication with JWT validation  
🌐 **Global CDN**: CloudFront with WAF protection  
🚀 **Serverless**: ECS Fargate with auto-scaling  
📊 **58 MCP Tools**: All official Grafana tools + 2 enhanced custom tools  
🔍 **Generic Datasource Querying**: Query any Grafana datasource with native formats  
☁️ **Azure Monitor Support**: KQL queries for logs and metrics  
📈 **Multi-Datasource**: Prometheus (PromQL), SQL databases, InfluxDB, Loki, and more  

## Enhanced MCP Tools

### Official Grafana Tools (56)
- Dashboard management and querying
- Alert rule management  
- User and organization management
- Datasource-specific tools (Prometheus, Loki, etc.)

### Custom Enhanced Tools (2)

#### `list_datasources_detailed`
Lists all Grafana datasources with:
- Detailed type information
- Query format examples for each datasource type
- Azure Monitor KQL examples
- Prometheus PromQL examples  
- SQL query templates
- Usage guidance

#### `query_datasource`
Query any Grafana datasource with native query formats:
- **Azure Monitor**: KQL queries for logs and metrics
- **Prometheus**: PromQL for metrics
- **MySQL/PostgreSQL**: SQL queries
- **InfluxDB**: Flux or InfluxQL queries
- **Loki**: LogQL queries
- **Any datasource type** supported by Grafana

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  CloudFront  │────│     WAF      │────│     ALB      │
│     CDN      │    │  Protection  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                    ┌──────────────────────────┴────────┐
                    │                                   │
                    ▼                                   ▼
            ┌──────────────┐                  ┌──────────────┐
            │   Cognito    │                  │  ECS Fargate │
            │  User Pool   │                  │   (Single    │
            │ (OAuth 2.1)  │                  │  Container)  │
            └──────────────┘                  │ ┌──────────┐ │
                    │                         │ │  OAuth   │ │
                    │ JWT Validation          │ │ Wrapper  │ │
                    └─────────────────────────┤ └────┬─────┘ │
                                              │      │       │
                                              │      ▼       │
                                              │ ┌──────────┐ │
                                              │ │ Custom   │ │
                                              │ │ Tools +  │ │
                                              │ │ Grafana  │ │
                                              │ │   MCP    │ │
                                              │ │  Server  │ │
                                              │ └──────────┘ │
                                              └──────────────┘
```

## Components

- **Cognito User Pool**: OAuth 2.1 authorization with MFA support
- **CloudFront + WAF**: Global CDN with multi-layer protection  
- **ECS Fargate**: Single container for session continuity
- **OAuth Wrapper**: JWT token validation and request proxying
- **Custom Tool Handler**: Enhanced datasource querying capabilities
- **Grafana MCP Server**: Official MCP server with 56 tools

## Prerequisites

- AWS CLI configured
- AWS CDK installed: `npm install -g aws-cdk`
- Docker running
- **Grafana instance with service account token**: Deploy [sample-grafana-prometheus-stack](https://github.com/aws-samples/sample-grafana-prometheus-stack) if needed

## Deployment

### Quick Start

```bash
cdk deploy MCP-Server \
  --context grafanaUrl="https://your-grafana-instance.com" \
  --context grafanaApiKey="your-service-account-token" \
  --context mcpTransport="http" \
  --require-approval never
```

**Important**: Use `mcpTransport="http"` for streamable-http transport with proper session management.

### Automated Setup

```bash
scripts/complete-setup.sh
```

Retrieves Grafana configuration from Parameter Store (`/workshop/grafana-url`, `/workshop/grafana-api-key`) and deploys all stacks.

### Optional: Use Existing VPC

```bash
cdk deploy --all \
  --context existingVpcId=vpc-12345678 \
  --context publicSubnetIds=subnet-123,subnet-456 \
  --context privateSubnetIds=subnet-abc,subnet-def \
  --context grafanaUrl=https://your-grafana-instance.com \
  --context grafanaApiKey=your-service-account-token
```

## Getting Grafana Credentials

### Service Account Token
In Grafana UI:
1. Go to **Administration → Service Accounts**
2. Create service account with **Admin** role
3. Generate token and copy value

### Grafana URL
Your publicly accessible Grafana instance URL (e.g., `https://grafana.company.com`)

## Accessing Your MCP Server

### Get CloudFront URL
```bash
aws cloudformation describe-stacks \
  --stack-name MCP-Server \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionUrl`].OutputValue' \
  --output text
```

### OAuth Discovery Endpoint
```bash
curl https://your-cloudfront-url/.well-known/oauth-protected-resource
```

### Test MCP Endpoint
```bash
# Should return 401 without valid token
curl https://your-cloudfront-url/grafana/mcp/
```

## Usage Examples

### Azure Monitor Logs
```bash
# 1. List datasources with query examples
curl -X POST https://your-cloudfront-url/grafana/mcp/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"list_datasources_detailed","id":1}'

# 2. Query Azure Monitor logs with KQL
curl -X POST https://your-cloudfront-url/grafana/mcp/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"query_datasource",
    "params":{
      "datasourceUid":"azure-monitor-uid",
      "query":{"kusto":"Heartbeat | where TimeGenerated > ago(1h) | limit 10"},
      "timeRange":{"from":"now-1h","to":"now"}
    },
    "id":2
  }'
```

### Prometheus Metrics
```bash
# Query Prometheus with PromQL
curl -X POST https://your-cloudfront-url/grafana/mcp/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"query_datasource",
    "params":{
      "datasourceUid":"prometheus-uid",
      "query":{"expr":"up"},
      "timeRange":{"from":"now-1h","to":"now"}
    },
    "id":3
  }'
```

## Testing

```bash
# Test OAuth and basic functionality
node test/test-mcp-server.js

# Test custom tools (requires CLIENT_SECRET in .env)
node test/test-custom-tools.js
```

## Current Deployment Status

✅ **Session Management**: Fixed multi-container load balancing issues  
✅ **Custom Tools**: Enhanced datasource querying deployed  
✅ **Azure Monitor**: KQL query support active  
✅ **58 MCP Tools**: All tools enumerable and functional  
✅ **Single Container**: ECS configured for session continuity  

**MCP Server URL**: `https://d3jifvmn9ry95.cloudfront.net/grafana/mcp/`

## Agentic Observability

This MCP server enables AI agents to interact with Grafana for:
- **Generic Datasource Querying**: Query any datasource with native query formats
- **Azure Monitor Integration**: KQL queries for logs and metrics  
- **Multi-Cloud Observability**: Prometheus, SQL, InfluxDB, Loki support
- **Dashboard Analysis**: Query and analyze Grafana dashboards
- **Incident Investigation**: Intelligent troubleshooting with observability data
- **Automated Monitoring**: AI-driven alerting and analysis

Perfect for agentic workflows with [sample-grafana-prometheus-stack](https://github.com/aws-samples/sample-grafana-prometheus-stack) or Azure Grafana instances.

## Security Features

✅ OAuth 2.1 compliant (RFC9728)  
✅ Multi-layer WAF protection  
✅ VPC isolation with private subnets  
✅ Encrypted at rest and in transit  
✅ Non-root containers  
✅ Secrets Manager integration  

## Cleanup

```bash
cdk destroy --all
```

## License

This library is licensed under the MIT-0 License. See the LICENSE file.