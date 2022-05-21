#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import "source-map-support/register";
import { GithubActionsStack } from "../lib/deployment-stack";
import { RemixStack } from "../lib/remix-stack";
import { TablesStack } from "../lib/tables-stack";

export interface BaseAppProps extends StackProps {
  githubOrganisation: string;
  repository: string;
}

const app = new cdk.App();

// Deployment stack
new GithubActionsStack(app, "GitHubActionsStack", {
  githubOrganisation: "simonireilly",
  repository: "funk-stack",
});

// Create the tables
const { sessionsTable, userTable, noteTable, passwordTable } = new TablesStack(
  app,
  "RemixTables",
  {}
);

// Deploy the Server and Static Assets
new RemixStack(app, "RemixStack", {
  sessionsTable,
  userTable,
  passwordTable,
  noteTable,
});
