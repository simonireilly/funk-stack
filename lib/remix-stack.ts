import { HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";
import {
  HttpLambdaIntegration,
  HttpUrlIntegration,
} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { join } from "path";
import { ITables } from "./tables-stack";

/**
 * This stack deploys remix server to an AWS lambda behind a HTTP APIGateway
 *
 * It is also deploying the static assets to an s3 bucket, and, proxying to
 * those assets through the APIGateway.
 */
export class RemixStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & ITables) {
    super(scope, id, props);

    const { sessionsTable, userTable, passwordTable, noteTable } = props;

    const remixServerFunction = new NodejsFunction(this, "RemixRunServer", {
      entry: join(__dirname, "..", "/server/index.js"),
      handler: "handler",
      environment: {
        NODE_ENV: "production",
        SESSION_SECRET: "basic-secret-for-lambda",
        DYNAMODB_SESSION_TABLE_NAME: sessionsTable.tableName,
        DYNAMODB_USER_TABLE_NAME: userTable.tableName,
        DYNAMODB_PASSWORD_TABLE_NAME: passwordTable.tableName,
        DYNAMODB_NOTE_TABLE_NAME: noteTable.tableName,
      },
      memorySize: 1024,
      bundling: {
        environment: {
          NODE_ENV: "production",
        },
        commandHooks: {
          beforeBundling() {
            return ["npm run build"];
          },
          beforeInstall() {
            return [];
          },
          afterBundling() {
            return [];
          },
        },
      },
      tracing: Tracing.ACTIVE,
    });

    sessionsTable.grantReadWriteData(remixServerFunction);
    noteTable.grantReadWriteData(remixServerFunction);
    passwordTable.grantReadWriteData(remixServerFunction);
    userTable.grantReadWriteData(remixServerFunction);

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
      publicReadAccess: true,
    });

    new BucketDeployment(this, "DeployWebsite", {
      sources: [Source.asset("./public", {})],
      prune: false,
      destinationBucket: websiteBucket,
      memoryLimit: 1024,
    });

    const remixIntegration = new HttpLambdaIntegration(
      "RemixIntegration",
      remixServerFunction
    );

    const httpApi = new HttpApi(this, "RemixRunGateway", {
      defaultIntegration: remixIntegration,
    });

    httpApi.addRoutes({
      path: "/_static/{proxy+}",
      integration: new HttpUrlIntegration(
        "RemixAssetsProxy",
        `${websiteBucket.bucketWebsiteUrl}/{proxy}`,
        {
          method: HttpMethod.GET,
        }
      ),
    });

    new CfnOutput(this, "RemixUrl", {
      value: String(httpApi.url),
    });
  }
}
