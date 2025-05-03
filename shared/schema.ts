import { pgTable, text, serial, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Schema for DEMOS application
export const utenti = pgTable("utenti", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  nome: text("nome").notNull(),
  cognome: text("cognome").notNull(),
  data_nascita: text("data_nascita").notNull(),
  genere: text("genere").notNull(),
  cittadinanza: text("cittadinanza").notNull(),
  
  paese_residenza: text("paese_residenza").notNull(),
  regione_residenza: text("regione_residenza").notNull(),
  provincia_residenza: text("provincia_residenza").notNull(),
  comune_residenza: text("comune_residenza").notNull(),
  
  paese_elezione: text("paese_elezione"),
  regione_elezione: text("regione_elezione"),
  provincia_elezione: text("provincia_elezione"),
  comune_elezione: text("comune_elezione"),
  
  paese_candidatura: text("paese_candidatura"),
  regione_candidatura: text("regione_candidatura"),
  provincia_candidatura: text("provincia_candidatura"),
  comune_candidatura: text("comune_candidatura"),
  
  ruolo: text("ruolo").notNull(),
  grado_elezione: text("grado_elezione"),
  grado_candidatura: text("grado_candidatura"),
});

// Relazioni tra tabelle
export const usersRelations = relations(users, ({ one }) => ({
  utente: one(utenti, {
    fields: [users.id],
    references: [utenti.user_id],
  }),
}));

export const utentiRelations = relations(utenti, ({ one }) => ({
  user: one(users, {
    fields: [utenti.user_id],
    references: [users.id],
  }),
}));

export const utentiInsertSchema = createInsertSchema(utenti);
export type UtentiInsert = z.infer<typeof utentiInsertSchema>;
export type Utenti = typeof utenti.$inferSelect;
