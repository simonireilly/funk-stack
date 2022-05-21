// @ts-ignore
import { documentClient } from "@remix-vendor/cdk";
import bcrypt from "bcryptjs";
import invariant from "tiny-invariant";
import { logger } from "~/logger";
import { db } from "~/ports/db";

export type User = { id: `email#${string}`; email: string };
export type Password = { password: string };

export async function getUserById(id: User["id"]): Promise<User | null> {
  logger.info("Getting user by id");

  const result = await db.documentClient
    .get({
      TableName: db.tables.users,
      Key: {
        pk: id,
      },
    })
    .promise();

  const record = result.Item;
  if (record) return { id: record.pk, email: record.email };
  return null;
}

export async function getUserByEmail(email: User["email"]) {
  return getUserById(`email#${email}`);
}

async function getUserPasswordByEmail(email: User["email"]) {
  logger.info("Logging in user by email and password");
  const result = await db.documentClient
    .get({
      TableName: db.tables.passwords,
      Key: {
        pk: `email#${email}`,
      },
    })
    .promise();

  const record = result.Item;

  logger.info("Retrieved result", result);

  if (record) return { hash: record.password };
  return null;
}

export async function createUser(
  email: User["email"],
  password: Password["password"]
) {
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.documentClient
    .put({
      TableName: db.tables.passwords,
      Item: {
        pk: `email#${email}`,
        password: hashedPassword,
      },
    })
    .promise();

  await db.documentClient
    .put({
      TableName: db.tables.users,
      Item: {
        pk: `email#${email}`,
        email,
      },
    })
    .promise();

  const user = await getUserByEmail(email);
  invariant(user, `User not found after being created. This should not happen`);

  return user;
}

export async function deleteUser(email: User["email"]) {
  await documentClient
    .delete({
      TableName: db.tables.passwords,
      Key: {
        pk: `email#${email}`,
      },
    })
    .promise();
  await documentClient
    .delete({
      TableName: db.tables.users,
      Key: {
        pk: `email#${email}`,
      },
    })
    .promise();
}

export async function verifyLogin(
  email: User["email"],
  password: Password["password"]
) {
  const userPassword = await getUserPasswordByEmail(email);
  logger.info("Verifying login", userPassword);

  if (!userPassword) {
    return undefined;
  }

  const isValid = await bcrypt.compare(password, userPassword.hash);
  if (!isValid) {
    return undefined;
  }

  return getUserByEmail(email);
}
