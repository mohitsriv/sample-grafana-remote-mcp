# Deployment Instructions

## MCP Server Deployment

To deploy the MCP server with Grafana integration:

```bash
cdk deploy MCP-Server --context grafanaApiKey="your_grafana_service_account_token"
```

**Important:** The Grafana API key should NOT be committed to source control. Always pass it via the `--context` parameter.

### Current Configuration
- Grafana URL: `https://g-32c428c16a.grafana-workspace.us-east-1.amazonaws.com`
- MCP Transport: `http`
- API Key: See `.env` file (not committed to source control)

### Example Deployment Command
```bash
cdk deploy MCP-Server --context grafanaApiKey="$(cat .env | grep GRAFANA_API_KEY | cut -d'=' -f2)"
```

Or manually:
```bash
cdk deploy MCP-Server --context grafanaApiKey="your_actual_api_key_here"
```