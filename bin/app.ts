#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/stacks/vpc-stack";
import { SecurityStack } from "../lib/stacks/security-stack";
import { MCPServerStack } from "../lib/stacks/mcp-server-stack";
import { CloudFrontWafStack } from "../lib/stacks/cloudfront-waf-stack";
import { Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new cdk.App();

// Get stack suffix from context (e.g., "AWS" or "Azure")
const stackSuffix = app.node.tryGetContext("stackSuffix") || "";
const stackPrefix = stackSuffix ? `MCP-${stackSuffix}` : "MCP";

const resourceSuffix = app.node.addr
  .substring(0, 8)
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "");

// Use consistent suffix based on account/region instead of random
const domainSuffix = `${process.env.CDK_DEFAULT_ACCOUNT?.substring(0, 4) || 'dev'}-${process.env.CDK_DEFAULT_REGION?.replace(/-/g, '') || 'useast1'}`;

// Get context values for existing VPC if provided
const existingVpcId = app.node.tryGetContext("existingVpcId");
const publicSubnetIds = app.node.tryGetContext("publicSubnetIds")?.split(",");
const privateSubnetIds = app.node.tryGetContext("privateSubnetIds")?.split(",");

// Create VPC stack (or use existing VPC) - shared across deployments
const vpcStack = new VpcStack(app, "MCP-VPC", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  existingVpcId,
  publicSubnetIds,
  privateSubnetIds,
});

// Create security stack (Cognito + WAF) - shared across deployments
const securityStack = new SecurityStack(app, "MCP-Security", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  vpc: vpcStack.vpc,
  resourceSuffix,
  domainSuffix: domainSuffix,
});

// Get the target region (where the MCP server stack will be deployed)
const targetRegion = process.env.CDK_DEFAULT_REGION || "us-west-2";

// Create CloudFront WAF stack in us-east-1 (required for CloudFront WAF)
const cloudFrontWafStack = new CloudFrontWafStack(app, `${stackPrefix}-CloudFront-WAF`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1", // CloudFront WAF must be in us-east-1
  },
  resourceSuffix: stackSuffix ? `${resourceSuffix}-${stackSuffix.toLowerCase()}` : resourceSuffix,
  targetRegion, // Pass the target region to the CloudFront WAF stack
});

// Create MCPServerStack which includes both platform and servers
const serverStack = new MCPServerStack(app, `${stackPrefix}-Server`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: `Grafana MCP Server ${stackSuffix ? `(${stackSuffix}) ` : ""}with OAuth 2.1 Authentication (SO9018)`,
  resourceSuffix: stackSuffix ? `${resourceSuffix}-${stackSuffix.toLowerCase()}` : resourceSuffix,
  vpc: vpcStack.vpc,
});
serverStack.addDependency(cloudFrontWafStack);

// Tag all resources
cdk.Tags.of(app).add("Project", "Grafana-MCP-Server");
if (stackSuffix) {
  cdk.Tags.of(app).add("Environment", stackSuffix);
}

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
