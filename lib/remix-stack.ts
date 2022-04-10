import { HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";
import {
  HttpLambdaIntegration,
  HttpUrlIntegration,
} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {
  AssetHashType,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import {
  AttributeType,
  BillingMode,
  Table,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { join } from "path";

export class RemixStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sessionsTable = new Table(this, "RemixSessionsTable", {
      partitionKey: {
        name: "_idx",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: "arc-sessions",
      timeToLiveAttribute: "_ttl",
    });

    const mockUserTable = new StringParameter(this, "RemixUserTable", {
      parameterName: `/${this.stackName}/tables/user`,
      stringValue: sessionsTable.tableName,
    });

    const remixServerFunction = new NodejsFunction(this, "RemixRunServer", {
      entry: join(__dirname, "..", "/server/index.js"),
      handler: "handler",
      environment: {
        NODE_ENV: "production",
        SESSION_SECRET: "basic-secret-for-lambda",
        // TODO: Remove ARC Deps once Lambda compatibility layers are separated
        // from IaC framework dependencies like arc, SAM, and aws-cdk
        ARC_SESSION_TABLE_NAME: sessionsTable.tableName,
        ARC_ENV: "production",
        ARC_APP_NAME: "pop-punk",
        ARC_STACK_NAME: this.stackName,
      },
      bundling: {
        environment: {
          NODE_ENV: "production",
          ARC_ENV: "production",
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

    mockUserTable.grantRead(remixServerFunction);
    sessionsTable.grantReadWriteData(remixServerFunction);
    remixServerFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ssm:GetParametersByPath"],
        resources: [
          this.formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: this.stackName,
          }),
        ],
      })
    );

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
      publicReadAccess: true,
    });

    const bucket = new BucketDeployment(this, "DeployWebsite", {
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
