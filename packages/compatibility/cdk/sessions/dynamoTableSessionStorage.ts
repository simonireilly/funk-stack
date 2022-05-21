import type { SessionStorage } from "@remix-run/node";
import { createSessionStorage } from "@remix-run/node";
import { SessionData } from "@remix-run/server-runtime";
import * as crypto from "crypto";
import { documentClient } from "../utils/aws";
import { IArcTableSessionStorageOptions } from "./types";

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
}: IArcTableSessionStorageOptions): SessionStorage {
  return createSessionStorage({
    cookie,

    async createData(data, expires) {
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
      await documentClient.delete({
        TableName: props.tableName,
        Key: {
          [props.idx]: id,
        },
      });
    },
  });
}
