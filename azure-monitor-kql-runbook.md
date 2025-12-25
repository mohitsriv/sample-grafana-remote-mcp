# Azure Monitor KQL Query Guide for Operational Investigations

## Overview
This runbook provides KQL (Kusto Query Language) examples for investigating operational issues across all Azure services using the `query_datasource` tool with Azure Monitor. Covers Container Insights, VM Insights, Application Insights, Activity Log, Resource Graph, Security Center, and all Azure resource logs.

## Workspace Discovery
**IMPORTANT**: The workspace ID is REQUIRED for all Azure Monitor queries. Use this method to discover it dynamically:

### Step 1: Discover Workspace ID
First, get the workspace ID from the datasource configuration:

```json
{
  "name": "list_datasources_detailed",
  "arguments": {}
}
```

Look for the Azure Monitor datasource which will show:
```
**Azure Monitor** (grafana-azure-monitor-datasource)
- UID: `azure-monitor-oob`
- Default: No
- URL: N/A
- Workspace ID: `your-workspace-id-here`
```

### Step 2: Use the Discovered Workspace ID
Copy the workspace ID from the output above and use it in all your Azure Monitor queries.

### Step 3: Verify Workspace Connectivity
Test the workspace with a simple query:

```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Heartbeat | limit 1",
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID"
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Step 4: List Available Tables
Use this query to see what tables are available in the workspace:

```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "search * | summarize count() by $table | order by count_ desc | limit 20",
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID"
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

## Tool Usage Pattern
Use the `query_datasource` tool with this format for Azure Monitor:

```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "YOUR_KQL_QUERY_HERE",
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID"
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

**CRITICAL**: The `workspace` parameter is REQUIRED for all Azure Monitor queries. Without it, you will get `PathNotFoundError`. Always discover the workspace ID first using `list_datasources_detailed`.

## Container and Kubernetes Monitoring

### Container App Console Logs
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ContainerAppConsoleLogs | where TimeGenerated > ago(1h) | where Log contains 'error' or Log contains 'ERROR' or Log contains 'exception' | project TimeGenerated, ContainerAppName, Log | order by TimeGenerated desc | limit 100",
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID"
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Container App System Logs
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ContainerAppSystemLogs | where TimeGenerated > ago(1h) | where Reason == 'Failed' or Reason == 'Warning' | project TimeGenerated, ContainerAppName, Reason, EventMessage | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Container Performance Issues
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ContainerCpuUsage | where TimeGenerated > ago(1h) | summarize AvgCpu = avg(UsagePercent) by ContainerName, Computer | where AvgCpu > 80 | order by AvgCpu desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Container Memory Issues
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ContainerMemoryUsage | where TimeGenerated > ago(1h) | summarize AvgMemory = avg(UsagePercent) by ContainerName, Computer | where AvgMemory > 85 | order by AvgMemory desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Pod Restart Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "KubePodInventory | where TimeGenerated > ago(24h) | where PodStatus == 'Running' | summarize RestartCount = max(PodRestartCount) by PodName, Namespace | where RestartCount > 5 | order by RestartCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Kubernetes Events
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "KubeEvents | where TimeGenerated > ago(1h) | where Type == 'Warning' or Type == 'Error' | project TimeGenerated, Type, Reason, Message, ObjectName, Namespace | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Container Node Health
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "KubeNodeInventory | where TimeGenerated > ago(15m) | where Status != 'Ready' | project TimeGenerated, Computer, Status, KubeletVersion, KubeProxyVersion | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-15m",
      "to": "now"
    }
  }
}
```

## Virtual Machine Monitoring

### VM Performance Issues
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Perf | where TimeGenerated > ago(1h) | where ObjectName == 'Processor' and CounterName == '% Processor Time' | where InstanceName == '_Total' | summarize AvgCpu = avg(CounterValue) by Computer | where AvgCpu > 80 | order by AvgCpu desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### VM Memory Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Perf | where TimeGenerated > ago(1h) | where ObjectName == 'Memory' and CounterName == 'Available MBytes' | summarize AvgAvailableMemory = avg(CounterValue) by Computer | where AvgAvailableMemory < 1024 | order by AvgAvailableMemory asc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Disk Space Issues
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Perf | where TimeGenerated > ago(1h) | where ObjectName == 'LogicalDisk' and CounterName == '% Free Space' | where InstanceName != '_Total' | summarize AvgFreeSpace = avg(CounterValue) by Computer, InstanceName | where AvgFreeSpace < 10 | order by AvgFreeSpace asc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### VM Heartbeat Monitoring
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Heartbeat | where TimeGenerated > ago(15m) | summarize LastHeartbeat = max(TimeGenerated) by Computer | where LastHeartbeat < ago(10m) | order by LastHeartbeat asc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-15m",
      "to": "now"
    }
  }
}
```

## Application Performance Monitoring

### Application Exceptions
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "exceptions | where timestamp > ago(1h) | summarize ExceptionCount = count() by type, method, outerMessage | order by ExceptionCount desc | limit 20"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Slow Requests
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "requests | where timestamp > ago(1h) | where duration > 5000 | project timestamp, name, url, duration, resultCode | order by duration desc | limit 50"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Failed Requests
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "requests | where timestamp > ago(1h) | where success == false | summarize FailureCount = count() by name, resultCode | order by FailureCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Dependency Failures
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "dependencies | where timestamp > ago(1h) | where success == false | summarize FailureCount = count() by name, type, target | order by FailureCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Application Availability
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "requests | where timestamp > ago(24h) | summarize TotalRequests = count(), SuccessfulRequests = countif(success == true), AvailabilityPercent = (countif(success == true) * 100.0) / count() by bin(timestamp, 1h) | order by timestamp desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

## Azure Activity Log Analysis

### Failed Azure Operations
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureActivity | where TimeGenerated > ago(1h) | where ActivityStatus == 'Failed' | project TimeGenerated, OperationName, Caller, ResourceGroup, ResourceId, ActivityStatus | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Administrative Operations
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureActivity | where TimeGenerated > ago(24h) | where CategoryValue == 'Administrative' | where ActivityStatus == 'Succeeded' | project TimeGenerated, OperationName, Caller, ResourceGroup, ResourceId | order by TimeGenerated desc | limit 50"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Security-Related Activities
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureActivity | where TimeGenerated > ago(24h) | where OperationName contains 'Security' or OperationName contains 'Policy' or OperationName contains 'Role' | project TimeGenerated, OperationName, Caller, ResourceGroup, ActivityStatus | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Resource Scaling Events
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureActivity | where TimeGenerated > ago(24h) | where OperationName contains 'Scale' or OperationName contains 'Autoscale' | project TimeGenerated, OperationName, ResourceGroup, ResourceId, ActivityStatus | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

## Security Center and Defender

### Security Alerts
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "SecurityAlert | where TimeGenerated > ago(24h) | where AlertSeverity in ('High', 'Medium') | project TimeGenerated, AlertName, AlertSeverity, Description, CompromisedEntity | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Security Recommendations
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "SecurityRecommendation | where TimeGenerated > ago(7d) | where RecommendationSeverity == 'High' | summarize Count = count() by RecommendationDisplayName, RecommendationSeverity | order by Count desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-7d",
      "to": "now"
    }
  }
}
```

### Vulnerability Assessments
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "SecurityBaseline | where TimeGenerated > ago(7d) | where AnalyzeResult == 'Failed' | summarize FailedChecks = count() by Computer, BaselineName | order by FailedChecks desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-7d",
      "to": "now"
    }
  }
}
```

## Network and Connectivity Monitoring

### Network Security Group Flow Logs
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureNetworkAnalytics_CL | where TimeGenerated > ago(1h) | where FlowStatus_s == 'D' | summarize BlockedCount = count() by SrcIP_s, DestIP_s, DestPort_d, NSGRule_s | order by BlockedCount desc | limit 20"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Application Gateway Logs
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.NETWORK' and Category == 'ApplicationGatewayAccessLog' | where httpStatus_d >= 400 | summarize ErrorCount = count() by httpStatus_d, requestUri_s | order by ErrorCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Load Balancer Health
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.NETWORK' and Category == 'LoadBalancerProbeHealthStatus' | where probeResult_s == 'Failed' | summarize FailureCount = count() by backendIPAddress_s, backendPort_d | order by FailureCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### VPN Gateway Diagnostics
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.NETWORK' and Category == 'GatewayDiagnosticLog' | where Level == 'Error' or Level == 'Warning' | project TimeGenerated, Level, Message, Resource | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## Database Monitoring

### SQL Database Performance
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.SQL' and Category == 'QueryStoreRuntimeStatistics' | where avg_duration_d > 5000 | project TimeGenerated, query_hash_s, avg_duration_d, total_execution_count_d | order by avg_duration_d desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Database Connection Issues
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.SQL' and Category == 'Errors' | where error_number_d in (2, 53, 233, 10053, 10054, 10060, 10061) | project TimeGenerated, error_message_s, client_ip_s, database_name_s | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Database Blocking
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.SQL' and Category == 'Blocks' | project TimeGenerated, duration_d, blocked_process_report_s | order by duration_d desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Cosmos DB Monitoring
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AzureDiagnostics | where TimeGenerated > ago(1h) | where ResourceProvider == 'MICROSOFT.DOCUMENTDB' and Category == 'DataPlaneRequests' | where statusCode_s == '429' | summarize ThrottleCount = count() by databaseName_s, collectionName_s | order by ThrottleCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## Storage Monitoring

### Storage Account Errors
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "StorageBlobLogs | where TimeGenerated > ago(1h) | where StatusCode >= 400 | summarize ErrorCount = count() by StatusCode, OperationName, AccountName | order by ErrorCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### High Storage Latency
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "StorageBlobLogs | where TimeGenerated > ago(1h) | where DurationMs > 1000 | project TimeGenerated, OperationName, DurationMs, StatusCode, Uri | order by DurationMs desc | limit 50"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Storage Capacity Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Usage | where TimeGenerated > ago(7d) | where MetricName == 'UsedCapacity' | where Namespace == 'Microsoft.Storage/storageAccounts' | summarize AvgUsedCapacity = avg(Quantity) by bin(TimeGenerated, 1d), Resource | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-7d",
      "to": "now"
    }
  }
}
```

## Azure Functions and App Services

### Function App Errors
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "FunctionAppLogs | where TimeGenerated > ago(1h) | where Level == 'Error' | summarize ErrorCount = count() by FunctionName, ExceptionType | order by ErrorCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### App Service Performance
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AppServiceHTTPLogs | where TimeGenerated > ago(1h) | where TimeTaken > 5000 | project TimeGenerated, CsUriStem, TimeTaken, ScStatus | order by TimeTaken desc | limit 50"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### App Service Availability
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "AppServiceHTTPLogs | where TimeGenerated > ago(24h) | summarize TotalRequests = count(), SuccessfulRequests = countif(ScStatus < 400), AvailabilityPercent = (countif(ScStatus < 400) * 100.0) / count() by bin(TimeGenerated, 1h) | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

## Key Vault and Secrets Management

### Key Vault Access Monitoring
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "KeyVaultData | where TimeGenerated > ago(24h) | where ResultType != 'Success' | summarize FailedAttempts = count() by CallerIPAddress, OperationName, ResultType | order by FailedAttempts desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Certificate Expiration
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "KeyVaultData | where TimeGenerated > ago(1d) | where OperationName == 'CertificateGet' | where ResultType == 'Success' | extend DaysToExpiry = datetime_diff('day', todatetime(Properties.exp), now()) | where DaysToExpiry <= 30 | project TimeGenerated, KeyVaultName = Resource, CertificateName = Id, DaysToExpiry | order by DaysToExpiry asc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1d",
      "to": "now"
    }
  }
}
```

## Service Health and Incidents

### Service Health Incidents
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ServiceHealth | where TimeGenerated > ago(24h) | where Status == 'Active' | project TimeGenerated, Title, Service, Region, Status, Summary | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Planned Maintenance
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "ServiceHealth | where TimeGenerated > ago(7d) | where EventType == 'PlannedMaintenance' | project TimeGenerated, Title, Service, Region, Summary | order by TimeGenerated desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-7d",
      "to": "now"
    }
  }
}
```

## Investigation Workflows

### 1. System Health Overview
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "union (Heartbeat | where TimeGenerated > ago(5m) | summarize LiveVMs = dcount(Computer)), (ContainerLog | where TimeGenerated > ago(5m) | summarize ActiveContainers = dcount(ContainerName)), (requests | where timestamp > ago(5m) | summarize AppRequests = count()), (exceptions | where timestamp > ago(5m) | summarize AppExceptions = count()), (AzureActivity | where TimeGenerated > ago(5m) | summarize AzureOperations = count())"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-5m",
      "to": "now"
    }
  }
}
```

### 2. Error Pattern Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "union (ContainerLog | where LogEntry contains 'error' | extend Source = 'Container'), (Event | where EventLevelName == 'Error' | extend Source = 'System'), (exceptions | extend Source = 'Application'), (AzureActivity | where ActivityStatus == 'Failed' | extend Source = 'Azure') | summarize ErrorCount = count() by Source | order by ErrorCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### 3. Performance Bottleneck Detection
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "union (Perf | where CounterName == '% Processor Time' and CounterValue > 80 | extend Issue = 'VM CPU'), (ContainerCpuUsage | where UsagePercent > 80 | extend Issue = 'Container CPU'), (requests | where duration > 5000 | extend Issue = 'App Response'), (StorageBlobLogs | where DurationMs > 1000 | extend Issue = 'Storage Latency') | summarize IssueCount = count() by Issue | order by IssueCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### 4. Security Incident Investigation
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "union (SecurityAlert | where AlertSeverity in ('High', 'Medium') | extend EventType = 'Security Alert'), (AzureActivity | where OperationName contains 'Role' or OperationName contains 'Policy' | extend EventType = 'RBAC Change'), (KeyVaultData | where ResultType != 'Success' | extend EventType = 'Key Vault Access'), (AzureNetworkAnalytics_CL | where FlowStatus_s == 'D' | extend EventType = 'Network Block') | summarize EventCount = count() by EventType | order by EventCount desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### 5. Resource Utilization Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "union (Perf | where CounterName == '% Processor Time' | summarize AvgCPU = avg(CounterValue) by Computer), (ContainerCpuUsage | summarize AvgContainerCPU = avg(UsagePercent) by ContainerName), (Usage | where MetricName == 'UsedCapacity' | summarize AvgStorage = avg(Quantity) by Resource) | extend ResourceType = case(isnotempty(Computer), 'Virtual Machine', isnotempty(ContainerName), 'Container', isnotempty(Resource), 'Storage', 'Unknown')"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## Prometheus Queries (for AWS datasources)
For Prometheus datasources, use this format:
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "ff3extm5n24u8e",
    "query": {
      "expr": "up{job='kubernetes-nodes'}",
      "legendFormat": "{{instance}}"
    },
    "timeRange": {
      "from": "now-1h", 
      "to": "now"
    }
  }
}
```

### Common Prometheus Queries
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "ff3extm5n24u8e",
    "query": {
      "expr": "rate(http_requests_total[5m])",
      "legendFormat": "{{method}} {{status}}"
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "ff3extm5n24u8e",
    "query": {
      "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
      "legendFormat": "95th percentile"
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "ff3extm5n24u8e",
    "query": {
      "expr": "container_memory_usage_bytes / container_spec_memory_limit_bytes * 100",
      "legendFormat": "{{pod}} memory %"
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

## Time Range Examples
- Last 15 minutes: `"from": "now-15m", "to": "now"`
- Last hour: `"from": "now-1h", "to": "now"`
- Last 24 hours: `"from": "now-24h", "to": "now"`
- Last 7 days: `"from": "now-7d", "to": "now"`
- Last 30 days: `"from": "now-30d", "to": "now"`
- Specific time: `"from": "2024-01-01T10:00:00Z", "to": "2024-01-01T11:00:00Z"`

## Common KQL Functions
- `summarize`: Aggregate data (`count()`, `avg()`, `max()`, `min()`, `sum()`)
- `where`: Filter results
- `project`: Select specific columns
- `extend`: Add calculated columns
- `join`: Combine tables (`inner`, `left`, `right`)
- `union`: Combine multiple queries
- `order by`: Sort results (`asc`, `desc`)
- `limit`/`take`: Limit result count
- `bin()`: Time bucketing for aggregations
- `mv-expand`: Expand multi-value fields
- `parse`: Extract data from strings
- `split()`: Split strings
- `strcat()`: Concatenate strings
- `todatetime()`: Convert to datetime
- `toint()`: Convert to integer

## Advanced KQL Patterns

### Time Series Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "Perf | where TimeGenerated > ago(24h) | where CounterName == '% Processor Time' | summarize AvgCPU = avg(CounterValue) by bin(TimeGenerated, 1h), Computer | order by TimeGenerated asc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-24h",
      "to": "now"
    }
  }
}
```

### Correlation Analysis
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "let HighCPUTimes = Perf | where TimeGenerated > ago(1h) | where CounterName == '% Processor Time' and CounterValue > 80 | project TimeGenerated, Computer; exceptions | where timestamp > ago(1h) | join kind=inner (HighCPUTimes) on $left.timestamp == $right.TimeGenerated | summarize ExceptionCount = count() by Computer"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### Anomaly Detection
```json
{
  "name": "query_datasource",
  "arguments": {
    "datasourceUid": "azure-monitor-oob",
    "query": {
      "queryType": "Azure Log Analytics",
      "azureLogAnalytics": {
        "query": "requests | where timestamp > ago(7d) | summarize RequestCount = count() by bin(timestamp, 1h) | extend Baseline = avg(RequestCount) | extend Anomaly = abs(RequestCount - Baseline) > (2 * stdev(RequestCount)) | where Anomaly == true | order by timestamp desc"
        "workspace": "YOUR_DISCOVERED_WORKSPACE_ID",
      }
    },
    "timeRange": {
      "from": "now-7d",
      "to": "now"
    }
  }
}
```

## Best Practices
1. Always use the correct query format for Azure Monitor with `queryType` and `azureLogAnalytics`
2. The workspace parameter is optional if the datasource has a default workspace configured
3. Use appropriate time ranges to improve performance
4. Use `limit` to prevent overwhelming results
5. Start broad, then narrow down with specific filters
6. Use `summarize` for aggregated insights
7. Combine multiple data sources with `union` for comprehensive analysis
8. Use `bin()` for time-based aggregations
9. Index on commonly filtered fields
10. Use `project` to reduce data transfer
11. Cache frequently used queries
12. Monitor query performance and optimize as needed

## Datasource UIDs
- **Azure Monitor**: `azure-monitor-oob`
- **AWS Prometheus**: `ff3extm5n24u8e`
- **CloudWatch**: `ff3exwnu3jim8c`
- **Loki**: `ef3exwmw1fcw0b`
- **Tempo**: `df3exwqheokjka`
- **Azure Prometheus**: `cf3pikwrshc74b`

## Initial Setup Workflow
1. **Discover Datasources**: Use `list_datasources_detailed` to see available datasources and their UIDs
2. **Get Workspace ID**: Extract the workspace ID from the Azure Monitor datasource output (REQUIRED for all queries)
3. **Test Workspace**: Run a simple query like `Heartbeat | limit 1` WITH the discovered workspace parameter to confirm connectivity
4. **List Available Tables**: Use `search * | summarize count() by $table | order by count_ desc | limit 20` to see what data is available
5. **Start Investigating**: Use the specific queries above based on your investigation needs, replacing `YOUR_DISCOVERED_WORKSPACE_ID` with the actual workspace ID

**REMEMBER**: All Azure Monitor queries MUST include the workspace parameter or they will fail with `PathNotFoundError`. Always run `list_datasources_detailed` first to get the workspace ID.