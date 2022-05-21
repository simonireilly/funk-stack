import {
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";

export type TSessionStorageHandler = ({
  cookie,
  ...props
}: IArcTableSessionStorageOptions) => SessionStorage;

export interface IArcTableSessionStorageOptions {
  /**
   * The name of the DynamoDB table used for storing sessions
   */
  tableName: string;

  /**
   * The name of the DynamoDB attribute used to store the session ID.
   * This should be the table's partition key.
   */
  idx: string;

  /**
   * The Cookie used to store the session id on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy["cookie"];

  /**
   * The name of the DynamoDB attribute used to store the expiration time.
   * If absent, then no TTL will be stored and session records will not expire.
   */
  ttl?: string;
}
