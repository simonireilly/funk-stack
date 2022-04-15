import * as crypto from "crypto";
import type { SessionStorage, SessionIdStorageStrategy } from "@remix-run/node";
import { createSessionStorage } from "@remix-run/node";
import { SessionData } from "@remix-run/server-runtime";
import AWS, { DynamoDB } from "aws-sdk";
import { captureAWSClient } from "aws-xray-sdk";
import { isLambdaEnvironment } from "../utils/aws";

AWS.config.logger = console;

const baseClient = new DynamoDB();

const capturedClient = isLambdaEnvironment
  ? captureAWSClient(baseClient)
  : baseClient;

const documentClient = new DynamoDB.DocumentClient(capturedClient);

interface ArcTableSessionStorageOptions {
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

/**
 * Session storage using a DynamoDB table managed by aws-sdk.
 *
 * Configure the DynamoDB with any IaC tooling, ensure the lambda function is
 * granted read/write access.
 *
 */
export function createArcTableSessionStorage({
  cookie,
  ...props
}: ArcTableSessionStorageOptions): SessionStorage {
  return createSessionStorage({
    cookie,

    async createData(data, expires) {
      console.info("Create data", { props });
      while (true) {
        let randomBytes = crypto.randomBytes(8);
        // This storage manages an id space of 2^64 ids, which is far greater
        // than the maximum number of files allowed on an NTFS or ext4 volume
        // (2^32). However, the larger id space should help to avoid collisions
        // with existing ids when creating new sessions, which speeds things up.
        let id = [...randomBytes]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");

        if (
          await documentClient
            .get({
              TableName: props.tableName,
              Key: {
                [props.idx]: id,
              },
            })
            .promise()
        ) {
          continue;
        }

        let params = {
          [props.idx]: id,
          ...data,
        };
        if (props.ttl) {
          params[props.ttl] = expires
            ? Math.round(expires.getTime() / 1000)
            : undefined;
        }
        await documentClient
          .put({
            TableName: props.tableName,
            Item: params,
          })
          .promise();

        return id;
      }
    },

    async readData(id) {
      console.info("Read data", { props });
      let { Item } = await documentClient
        .get({
          TableName: props.tableName,
          Key: {
            [props.idx]: id,
          },
        })
        .promise();

      if (Item) {
        delete Item[props.idx];
        if (props.ttl) delete Item[props.ttl];
      }

      return Item as SessionData;
    },

    async updateData(id, data, expires) {
      console.info("Update data", { props });
      let params = {
        [props.idx]: id,
        ...data,
      };
      if (props.ttl) {
        params[props.ttl] = expires
          ? Math.round(expires.getTime() / 1000)
          : undefined;
      }
      await documentClient
        .put({
          TableName: props.tableName,
          Item: params,
        })
        .promise();
    },

    async deleteData(id) {
      console.info("Delete data", { props });
      await documentClient.delete({
        TableName: props.tableName,
        Key: {
          [props.idx]: id,
        },
      });
    },
  });
}
