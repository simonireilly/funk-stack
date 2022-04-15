import { isLambdaEnvironment } from "@remix-vendor/cdk/utils/aws";
import AWS, { DynamoDB } from 'aws-sdk'
import { captureAWSClient } from "aws-xray-sdk";
AWS.config.logger = console;

const baseClient = new DynamoDB();

const capturedClient = isLambdaEnvironment
  ? captureAWSClient(baseClient)
  : baseClient;

const documentClient = new DynamoDB.DocumentClient(capturedClient);

export const db = () => {
  note: {
    get: boundClient('note'),
  user: {

  }
}

const boundClient = (tableName: string, key: {[key: string]: any}) => ({
  get: documentClient.get({
    TableName: tableName,
    Key: key
  })
}