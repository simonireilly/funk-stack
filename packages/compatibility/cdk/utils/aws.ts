import AWS, { DynamoDB } from "aws-sdk";
import { captureAWSClient } from "aws-xray-sdk";
import { APIGatewayProxyEventV2, Context } from "aws-lambda";
import pino from "pino";

AWS.config.logger = console;

const baseClient = new DynamoDB();

export const isLambdaEnvironment = !!process.env.LAMBDA_TASK_ROOT;

export const capturedClient = isLambdaEnvironment
  ? captureAWSClient(baseClient)
  : baseClient;

export const documentClient = new DynamoDB.DocumentClient(capturedClient);

const logger = pino();

export const requestLogger = (
  event: APIGatewayProxyEventV2,
  context: Context
) => {
  return logger.child({
    ctx: {
      requestId: context.awsRequestId,
    },
    req: {
      key: event.routeKey,
      path: event.rawPath,
    },
  });
};
