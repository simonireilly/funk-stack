import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface ITables {
  readonly sessionsTable: Table;
  readonly userTable: Table;
  readonly passwordTable: Table;
  readonly noteTable: Table;
}

/**
 * Tables are added in this stack, because often, you will not update them
 *
 * This keeps tables separate. You can add tables of course at any time.
 */
export class TablesStack extends Stack implements ITables {
  readonly sessionsTable: Table;
  readonly userTable: Table;
  readonly passwordTable: Table;
  readonly noteTable: Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.sessionsTable = new Table(this, "RemixSessionTable", {
      partitionKey: {
        name: "_idx",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "_ttl",
    });

    this.userTable = new Table(this, "RemixUsersTable", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.passwordTable = new Table(this, "RemixPasswordTable", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.noteTable = new Table(this, "RemixNoteTable", {
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
  }
}
