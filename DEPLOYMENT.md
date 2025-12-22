# Deployment Instructions

## MCP Server Deployment

To deploy the MCP server with Grafana integration:

```bash
cdk deploy MCP-Server --context grafanaApiKey="your_grafana_service_account_token"
```

**Important:** The Grafana API key should NOT be committed to source control. Always pass it via the `--context` parameter.

### Current Configuration
**Currently using: Azure Grafana**
- Grafana URL: `https://grafana-obs-52061-cmhvcqfee7cwg2ar.eus.grafana.azure.com`
- MCP Transport: `http`
- API Key: See `.env` file (not committed to source control)

### Deployment Commands

#### Azure Grafana (Current)
```bash
cdk deploy --all \
  --context grafanaUrl="https://your-grafana-instance.eus.grafana.azure.com" \
  --context grafanaApiKey="your-grafana-service-account-token" \
  --context mcpTransport="http" \
  --require-approval never
```

#### AWS Managed Grafana (Alternative)
```bash
cdk deploy --all \
  --context grafanaUrl="https://your-workspace.grafana-workspace.us-east-1.amazonaws.com" \
  --context grafanaApiKey="your-grafana-service-account-token" \
  --context mcpTransport="http" \
  --require-approval never
```

#### Using .env file (recommended for security)
```bash
cdk deploy --all \
  --context grafanaUrl="$(grep '^GRAFANA_URL=' .env | cut -d'=' -f2)" \
  --context grafanaApiKey="$(grep '^GRAFANA_API_KEY=' .env | cut -d'=' -f2)" \
  --context mcpTransport="http" \
  --require-approval never
```