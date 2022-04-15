import cuid from "cuid";
import { db } from "~/ports/db";
import type { User } from "./user.server";

export type Note = {
  id: ReturnType<typeof cuid>;
  userId: User["id"];
  title: string;
  body: string;
};

type NoteSk = `note#${Note["id"]}`;

type NoteItem = {
  pk: User["id"];
  sk: NoteSk;
};

const skToId = (sk: NoteItem["sk"]): Note["id"] => sk.replace(/^note#/, "");
const idToSk = (id: Note["id"]): NoteItem["sk"] => `note#${id}`;

export async function getNote({
  id,
  userId,
}: Pick<Note, "id" | "userId">): Promise<Note | null> {
  const result = await db.documentClient
    .get({
      TableName: db.tables.notes,
      Key: {
        pk: userId,
        sk: idToSk(id),
      },
    })
    .promise();

  const record = result.Item;

  if (record) {
    return {
      userId: record?.pk,
      id: record?.sk,
      title: record?.title,
      body: record?.body,
    };
  }
  return null;
}

export async function getNoteListItems({
  userId,
}: Pick<Note, "userId">): Promise<Array<Pick<Note, "id" | "title">>> {
  const result = await db.documentClient
    .query({
      TableName: db.tables.notes,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": userId },
    })
    .promise();

  const records = result.Items;

  if (records) {
    return records.map((n: any) => ({
      title: n.title,
      id: skToId(n.sk),
    }));
  }

  return [];
}

export async function createNote({
  body,
  title,
  userId,
}: Pick<Note, "body" | "title" | "userId">): Promise<Note> {
  const sk = `note#${cuid()}` as NoteSk;
  await db.documentClient
    .put({
      TableName: db.tables.notes,
      Item: {
        pk: userId,
        sk: `note#${cuid()}`,
        title: title,
        body: body,
      },
    })
    .promise();

  return {
    id: skToId(sk),
    userId,
    title: title,
    body: body,
  };
}

export async function deleteNote({ id, userId }: Pick<Note, "id" | "userId">) {
  return db.documentClient
    .delete({
      TableName: db.tables.notes,
      Key: {
        pk: userId,
        sk: idToSk(id),
      },
    })
    .promise();
}
