/**
 * TODO: Figure out a better way to do this.
 *
 * Currently we pull the client, as configured with AWS Xray into this package
 * from the vendor. If we published the package, we would not be able to do this.
 *
 * A better way, IMO, is in server.ts to ask for a dynamoDB to be injected there
 * allowing for xray configuration to fall to the end user to configure
 *
 */
// @ts-ignore
import { documentClient, capturedClient } from "@remix-vendor/cdk";

export const db = {
  tables: {
    notes: String(process.env.DYNAMODB_NOTE_TABLE_NAME),
    passwords: String(process.env.DYNAMODB_PASSWORD_TABLE_NAME),
    sessions: String(process.env.DYNAMODB_SESSION_TABLE_NAME),
    users: String(process.env.DYNAMODB_USER_TABLE_NAME),
  },
  documentClient,
  baseClient: capturedClient,
};
