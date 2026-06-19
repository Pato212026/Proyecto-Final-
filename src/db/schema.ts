import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Users table (maps to Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), 
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Clientes table
export const clientes = pgTable('clientes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  nombre: text('nombre').notNull(),
  contacto: text('contacto').notNull(),
  tipo: text('tipo').notNull(), // 'Fijo' or 'Esporádico'
  createdAt: timestamp('created_at').defaultNow(),
});

// Servicios table
export const servicios = pgTable('servicios', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  nombre: text('nombre').notNull(), // UI design, brand identity, etc.
  descripcion: text('descripcion'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Proyectos table
export const proyectos = pgTable('proyectos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  clienteId: integer('cliente_id')
    .references(() => clientes.id, { onDelete: 'cascade' })
    .notNull(),
  servicioId: integer('servicio_id')
    .references(() => servicios.id)
    .notNull(),
  nombre: text('nombre').notNull(),
  modeloCobro: text('modelo_cobro').notNull(), // 'Por hora', 'Precio fijo', 'Suscripción'
  tarifa: integer('tarifa').default(0).notNull(), // Rate in CLP (integer) e.g. per hour, total project, or subscription
  estado: text('estado').notNull(), // 'Activo', 'Completado', 'Pausado'
  createdAt: timestamp('created_at').defaultNow(),
});

// Sesiones de Tiempo table (Timer sessions)
export const sesionesTiempo = pgTable('sesiones_tiempo', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  proyectoId: integer('proyecto_id')
    .references(() => proyectos.id, { onDelete: 'cascade' })
    .notNull(),
  facturable: boolean('facturable').default(true).notNull(),
  fecha: text('fecha').notNull(), // Format: YYYY-MM-DD
  duracion: integer('duracion').notNull(), // Duration in seconds
  descripcion: text('descripcion'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Facturas table
export const facturas = pgTable('facturas', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  clienteId: integer('cliente_id')
    .references(() => clientes.id, { onDelete: 'cascade' })
    .notNull(),
  proyectoId: integer('proyecto_id')
    .references(() => proyectos.id, { onDelete: 'cascade' }), // Can be null if generic
  monto: integer('monto').notNull(), // In CLP (whole number)
  fechaEmision: text('fecha_emision').notNull(), // YYYY-MM-DD
  fechaOrigenDeuda: text('fecha_origen_deuda').notNull(), // YYYY-MM-DD, e.g. start date or invoice period origin
  estado: text('estado').notNull(), // 'pagada', 'pendiente', 'vencida'
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  clientes: many(clientes),
  servicios: many(servicios),
  proyectos: many(proyectos),
  sesionesTiempo: many(sesionesTiempo),
  facturas: many(facturas),
}));

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  user: one(users, {
    fields: [clientes.userId],
    references: [users.id],
  }),
  proyectos: many(proyectos),
  facturas: many(facturas),
}));

export const serviciosRelations = relations(servicios, ({ one, many }) => ({
  user: one(users, {
    fields: [servicios.userId],
    references: [users.id],
  }),
  proyectos: many(proyectos),
}));

export const proyectosRelations = relations(proyectos, ({ one, many }) => ({
  user: one(users, {
    fields: [proyectos.userId],
    references: [users.id],
  }),
  cliente: one(clientes, {
    fields: [proyectos.clienteId],
    references: [clientes.id],
  }),
  servicio: one(servicios, {
    fields: [proyectos.servicioId],
    references: [servicios.id],
  }),
  sesionesTiempo: many(sesionesTiempo),
  facturas: many(facturas),
}));

export const sesionesTiempoRelations = relations(sesionesTiempo, ({ one }) => ({
  user: one(users, {
    fields: [sesionesTiempo.userId],
    references: [users.id],
  }),
  proyecto: one(proyectos, {
    fields: [sesionesTiempo.proyectoId],
    references: [proyectos.id],
  }),
}));

export const facturasRelations = relations(facturas, ({ one }) => ({
  user: one(users, {
    fields: [facturas.userId],
    references: [users.id],
  }),
  cliente: one(clientes, {
    fields: [facturas.clienteId],
    references: [clientes.id],
  }),
  proyecto: one(proyectos, {
    fields: [facturas.proyectoId],
    references: [proyectos.id],
  }),
}));
