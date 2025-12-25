# Azure Monitor Query Format Fix

## Issue
The agent was getting `PathNotFoundError` because the Azure Monitor datasource requires a specific query format, not the simple KQL format shown in the runbook.

## Correct Query Format for Azure Monitor

Instead of:
```json
{
  "datasourceUid": "azure-monitor-oob",
  "query": {
    "kusto": "ContainerAppConsoleLogs | limit 10"
  }
}
```

Use this format:
```json
{
  "datasourceUid": "azure-monitor-oob", 
  "query": {
    "queryType": "Azure Log Analytics",
    "azureLogAnalytics": {
      "query": "ContainerAppConsoleLogs | limit 10",
      "workspace": "3f1ca7bf-456a-4c5e-9aa7-a18634691361"
    }
  },
  "timeRange": {
    "from": "now-1h",
    "to": "now"
  }
}
```

## Updated KQL Examples

### Container App Monitoring
```json
{
  "queryType": "Azure Log Analytics",
  "azureLogAnalytics": {
    "query": "ContainerAppConsoleLogs | where TimeGenerated > ago(1h) | where Log contains 'error' | limit 100",
    "workspace": "3f1ca7bf-456a-4c5e-9aa7-a18634691361"
  }
}
```

### System Logs
```json
{
  "queryType": "Azure Log Analytics", 
  "azureLogAnalytics": {
    "query": "ContainerAppSystemLogs | where TimeGenerated > ago(1h) | where Reason == 'Failed' | limit 50",
    "workspace": "3f1ca7bf-456a-4c5e-9aa7-a18634691361"
  }
}
```

### Azure Activity
```json
{
  "queryType": "Azure Log Analytics",
  "azureLogAnalytics": {
    "query": "AzureActivity | where TimeGenerated > ago(1h) | where ActivityStatus == 'Failed' | limit 50", 
    "workspace": "3f1ca7bf-456a-4c5e-9aa7-a18634691361"
  }
}
```

## Key Points
1. Always use `queryType: "Azure Log Analytics"`
2. Wrap KQL in `azureLogAnalytics.query`
3. Include the workspace ID: `"3f1ca7bf-456a-4c5e-9aa7-a18634691361"`
4. The datasource UID is: `"azure-monitor-oob"`

This format resolves the `PathNotFoundError` and allows successful querying of Azure Monitor logs.