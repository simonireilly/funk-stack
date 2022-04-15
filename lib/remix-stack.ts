import { HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";
import {
  HttpLambdaIntegration,
  HttpUrlIntegration,
} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
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

    const sessionsTable = new Table(this, "RemixSessionTable", {
      partitionKey: {
        name: "_idx",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "_ttl",
    });

    const mockSessionTable = new StringParameter(
      this,
      "RemixSessionTableName",
      {
        parameterName: `/${this.stackName}/tables/session`,
        stringValue: sessionsTable.tableName,
      }
    );

    const userTable = new Table(this, "RemixUsersTable", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const mockUserTable = new StringParameter(this, "RemixUsersTableName", {
      parameterName: `/${this.stackName}/tables/user`,
      stringValue: userTable.tableName,
    });

    const passwordTable = new Table(this, "RemixPasswordTable", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const mockPasswordTable = new StringParameter(
      this,
      "RemixPasswordTableName",
      {
        parameterName: `/${this.stackName}/tables/password`,
        stringValue: passwordTable.tableName,
      }
    );

    const noteTable = new Table(this, "RemixNoteTable", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const mockNoteTable = new StringParameter(this, "RemixNoteTableName", {
      parameterName: `/${this.stackName}/tables/note`,
      stringValue: noteTable.tableName,
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
        ARC_USER_TABLE_NAME: userTable.tableName,
        ARC_PASSWORD_TABLE_NAME: passwordTable.tableName,
        ARC_NOTE_TABLE_NAME: noteTable.tableName,
        ARC_ENV: "production",
        ARC_APP_NAME: "pop-punk",
        ARC_STACK_NAME: this.stackName,
      },
      memorySize: 1024,
      bundling: {
        environment: {
          NODE_ENV: "production",
          ARC_ENV: "production",
        },
        nodeModules: ["bcryptjs"],
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
    mockSessionTable.grantRead(remixServerFunction);
    mockPasswordTable.grantRead(remixServerFunction);
    mockNoteTable.grantRead(remixServerFunction);
    sessionsTable.grantReadWriteData(remixServerFunction);
    noteTable.grantReadWriteData(remixServerFunction);
    passwordTable.grantReadWriteData(remixServerFunction);
    userTable.grantReadWriteData(remixServerFunction);
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
