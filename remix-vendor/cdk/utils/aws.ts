import AWS, { DynamoDB } from "aws-sdk";
import { captureAWSClient } from "aws-xray-sdk";
AWS.config.logger = console;

const baseClient = new DynamoDB();

export const isLambdaEnvironment = !!process.env.LAMBDA_TASK_ROOT;

export const capturedClient = isLambdaEnvironment
  ? captureAWSClient(baseClient)
  : baseClient;

export const documentClient = new DynamoDB.DocumentClient(capturedClient);
