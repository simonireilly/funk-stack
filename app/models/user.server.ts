import arc from "@architect/functions";
import bcrypt from "bcryptjs";
import invariant from "tiny-invariant";
import { logger } from "~/logger";

export type User = { id: `email#${string}`; email: string };
export type Password = { password: string };

export async function getUserById(id: User["id"]): Promise<User | null> {
  logger.info("Get user by id");
  const db = await arc.tables();
  const result = await db.user.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": id },
  });

  const [record] = result.Items;
  if (record) return { id: record.pk, email: record.email };
  return null;
}

export async function getUserByEmail(email: User["email"]) {
  logger.info("Checking if existing user exists");
  return getUserById(`email#${email}`);
}

async function getUserPasswordByEmail(email: User["email"]) {
  const db = await arc.tables();
  const result = await db.password.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` },
  });

  const [record] = result.Items;

  if (record) return { hash: record.password };
  return null;
}

export async function createUser(
  email: User["email"],
  password: Password["password"]
) {
  logger.info("Creating user in dynamoDb");
  let hashedPassword;
  try {
    logger.info("Hashing password");
    hashedPassword = await bcrypt.hash(password, 10);
  } catch (e) {
    logger.error(e);
  }
  logger.info("Hashed password");
  const db = await arc.tables();
  logger.info("Inserting password");
  await db.password.put({
    pk: `email#${email}`,
    password: hashedPassword,
  });

  logger.info("Inserting user");
  await db.user.put({
    pk: `email#${email}`,
    email,
  });

  const user = await getUserByEmail(email);
  invariant(user, `User not found after being created. This should not happen`);

  return user;
}

export async function deleteUser(email: User["email"]) {
  const db = await arc.tables();
  await db.password.delete({ pk: `email#${email}` });
  await db.user.delete({ pk: `email#${email}` });
}

export async function verifyLogin(
  email: User["email"],
  password: Password["password"]
) {
  const userPassword = await getUserPasswordByEmail(email);

  if (!userPassword) {
    return undefined;
  }

  const isValid = await bcrypt.compare(password, userPassword.hash);
  if (!isValid) {
    return undefined;
  }

  return getUserByEmail(email);
}
