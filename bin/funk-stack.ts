#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RemixStack } from "../lib/remix-stack";
import { TablesStack } from "../lib/tables-stack";

const app = new cdk.App();

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
