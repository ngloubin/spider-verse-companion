import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, evConversationTurns, evIntegrations, evMemories, evPreferences, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getPreferences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evPreferences).where(eq(evPreferences.userId, userId));
}

export async function setPreference(userId: number, preferenceKey: string, preferenceValue: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(evPreferences).values({ userId, preferenceKey, preferenceValue }).onDuplicateKeyUpdate({
    set: { preferenceValue, updatedAt: new Date() },
  });
}

export async function getMemories(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evMemories).where(eq(evMemories.userId, userId)).orderBy(desc(evMemories.updatedAt)).limit(limit);
}

export async function addMemory(userId: number, memoryType: "important_fact" | "learned_context" | "system_note", content: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(evMemories).values({ userId, memoryType, content: content.slice(0, 2000), source: "conversation" });
}

export async function getRecentTurns(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  const turns = await db.select().from(evConversationTurns).where(eq(evConversationTurns.userId, userId)).orderBy(desc(evConversationTurns.createdAt)).limit(limit);
  return turns.reverse();
}

export async function addConversationTurn(userId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(evConversationTurns).values({ userId, role, content: content.slice(0, 6000) });
}

export async function addPendingIntegration(userId: number, name: string, endpoint: string, capabilities: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(evIntegrations).values({ userId, name: name.slice(0, 120), endpoint: endpoint.slice(0, 500), capabilities: capabilities.slice(0, 2000), status: "pending_confirmation" });
}

export async function getIntegrations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evIntegrations).where(and(eq(evIntegrations.userId, userId), eq(evIntegrations.status, "connected")));
}
