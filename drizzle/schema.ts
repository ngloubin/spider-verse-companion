import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const evPreferences = mysqlTable("ev_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  preferenceKey: varchar("preferenceKey", { length: 80 }).notNull(),
  preferenceValue: varchar("preferenceValue", { length: 255 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userPreferenceKey: uniqueIndex("ev_preferences_user_key").on(table.userId, table.preferenceKey) }));

export const evMemories = mysqlTable("ev_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  memoryType: mysqlEnum("memoryType", ["important_fact", "learned_context", "system_note"]).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 80 }).default("conversation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const evConversationTurns = mysqlTable("ev_conversation_turns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const evIntegrations = mysqlTable("ev_integrations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  status: mysqlEnum("status", ["pending_confirmation", "connected", "disabled"]).default("pending_confirmation").notNull(),
  capabilities: text("capabilities"),
  secretRef: varchar("secretRef", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type EvPreference = typeof evPreferences.$inferSelect;
export type EvMemory = typeof evMemories.$inferSelect;
export type EvConversationTurn = typeof evConversationTurns.$inferSelect;
export type EvIntegration = typeof evIntegrations.$inferSelect;

// These tables intentionally reference users.id at the application layer so the existing
// auth migration remains backwards-compatible across the hosted database environments.
