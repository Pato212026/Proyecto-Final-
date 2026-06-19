-- =============================================================================
-- BASE DE DATOS LÚCIDA - SCRIPT DE CREACIÓN Y POBLAMIENTO (lucida.sql)
-- Sistema de Gestión para Diseñadoras Freelance
-- Caso: "Freelance en Apuros - La vida desordenada de Lucía"
-- Motor: PostgreSQL
-- Contiene: DDL (estructura de tablas) y DML (datos de prueba)
-- =============================================================================

-- ==========================================
-- 0. ELIMINACIÓN DE TABLAS EXISTENTES (permite re-ejecución limpia)
-- ==========================================
DROP TABLE IF EXISTS facturas CASCADE;
DROP TABLE IF EXISTS sesiones_tiempo CASCADE;
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==========================================
-- 1. ESTRUCTURA (DDL) EN ORDEN DE RELACIÓN
-- ==========================================

-- Tabla de Usuarios (la dueña del sistema: Lucía)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Clientes
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'Fijo' o 'Esporádico'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Catálogo de Servicios
CREATE TABLE servicios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Proyectos
CREATE TABLE proyectos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    nombre VARCHAR(255) NOT NULL,
    modelo_cobro VARCHAR(100) NOT NULL, -- 'Por hora', 'Precio fijo', 'Suscripción'
    tarifa INTEGER NOT NULL DEFAULT 0,  -- Tarifa del proyecto en CLP
    estado VARCHAR(100) NOT NULL,       -- Estado de fase/flujo de trabajo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Sesiones de Registro de Tiempo (cronómetro)
CREATE TABLE sesiones_tiempo (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    facturable BOOLEAN NOT NULL DEFAULT TRUE,
    fecha VARCHAR(10) NOT NULL,         -- Formato YYYY-MM-DD
    duracion INTEGER NOT NULL,          -- Duración en segundos
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Facturas Emitidas
CREATE TABLE facturas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE SET NULL, -- Relación opcional
    monto INTEGER NOT NULL,                  -- Monto en CLP
    fecha_emision VARCHAR(10) NOT NULL,      -- Formato YYYY-MM-DD
    fecha_origen_deuda VARCHAR(10) NOT NULL, -- Formato YYYY-MM-DD (antigüedad de deuda)
    estado VARCHAR(50) NOT NULL,             -- 'pagada', 'pendiente', 'vencida'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 2. DATOS DE PRUEBA (DML) EN ORDEN DE INTEGRIDAD
-- ==========================================

-- 2.1 Usuario (Lucía, dueña del sistema)
INSERT INTO users (id, uid, email) VALUES
(1, 'lucida-user-01', 'lucia.freelance@lucida.cl');

-- 2.2 Catálogo de Servicios
INSERT INTO servicios (id, user_id, nombre, descripcion) VALUES
(1, 1, 'Diseño UI', 'Diseño de interfaces web y móviles'),
(2, 1, 'Identidad de marca', 'Logos, paletas de colores y manuales de marca'),
(3, 1, 'Mantenimiento', 'Soporte y actualización continua de piezas de diseño'),
(4, 1, 'Ilustración', 'Ilustraciones personalizadas y assets vectoriales'),
(5, 1, 'Diseño Web', 'Maquetación y diseño de sitios corporativos y landing pages'),
(6, 1, 'Consultoría', 'Asesoría estratégica de marca y diseño');

-- 2.3 Clientes (6 fijos + esporádicos, según el caso de Lucía)
INSERT INTO clientes (id, user_id, nombre, contacto, tipo) VALUES
(1, 1, 'Editorial Norte', 'contacto@editorialnorte.cl', 'Fijo'),
(2, 1, 'Estudio Andes', 'hola@estudioandes.cl', 'Fijo'),
(3, 1, 'Café Raíz', '+56 9 8765 4321', 'Fijo'),
(4, 1, 'Boutique Lúmina', 'ventas@lumina.cl', 'Fijo'),
(5, 1, 'Constructora Sur', 'proyectos@constructorasur.cl', 'Fijo'),
(6, 1, 'Marca Personal · Javiera', 'javiera.dg@gmail.com', 'Esporádico'),
(7, 1, 'Taller Bicicletas Pedal', 'info@tallerpedal.cl', 'Esporádico');

-- 2.4 Proyectos (vinculados a cliente y servicio, con su modelo de cobro)
INSERT INTO proyectos (id, user_id, cliente_id, servicio_id, nombre, modelo_cobro, tarifa, estado) VALUES
(1, 1, 1, 2, 'Rediseño identidad de marca', 'Precio fijo', 1200000, 'Diseño'),
(2, 1, 1, 3, 'Mantención web mensual',      'Suscripción', 150000,  'Activo'),
(3, 1, 3, 1, 'App carta digital',           'Por hora',    25000,   'Briefing'),
(4, 1, 4, 1, 'Catálogo de productos',       'Precio fijo', 800000,  'Feedback'),
(5, 1, 5, 2, 'Brandbook corporativo',       'Precio fijo', 1500000, 'Activo'),
(6, 1, 6, 4, 'Ilustraciones redes sociales','Suscripción', 90000,   'Activo'),
(7, 1, 2, 6, 'Asesoría de marca',           'Por hora',    30000,   'Activo');

-- 2.5 Sesiones de Tiempo (registros del cronómetro; duración en segundos)
INSERT INTO sesiones_tiempo (id, user_id, proyecto_id, facturable, fecha, duracion, descripcion) VALUES
(1, 1, 1, TRUE,  '2026-06-15', 122400, 'Bocetos y propuestas de identidad'),       -- 34 h
(2, 1, 3, TRUE,  '2026-06-16', 86400,  'Maquetado de pantallas de la carta'),      -- 24 h
(3, 1, 7, TRUE,  '2026-06-17', 43200,  'Sesión de asesoría y revisión de marca'),  -- 12 h
(4, 1, 2, FALSE, '2026-06-17', 18000,  'Reuniones de coordinación (no facturable)'),-- 5 h
(5, 1, 5, TRUE,  '2026-06-18', 64800,  'Desarrollo del brandbook corporativo');    -- 18 h

-- 2.6 Facturas (incluye la deuda vencida desde enero: caso central de Lucía)
INSERT INTO facturas (id, user_id, cliente_id, proyecto_id, monto, fecha_emision, fecha_origen_deuda, estado) VALUES
(1, 1, 1,  1, 1200000, '2026-03-10', '2026-03-10', 'pagada'),
(2, 1, 1,  2, 150000,  '2026-02-01', '2026-02-01', 'pendiente'),
(3, 1, 3,  3, 450000,  '2026-01-15', '2026-01-15', 'vencida'),    -- << pendiente desde enero
(4, 1, 4,  4, 800000,  '2026-03-15', '2026-03-15', 'pendiente'),
(5, 1, 5,  5, 1500000, '2026-02-20', '2026-02-20', 'pagada'),
(6, 1, 6,  NULL, 90000,'2026-04-01', '2026-04-01', 'pendiente'),
(7, 1, 2,  7, 300000,  '2026-04-05', '2026-04-05', 'pendiente');


-- =============================================================================
-- 3. ACTUALIZACIÓN DE SECUENCIAS (corrección de llaves seriales en PostgreSQL)
-- =============================================================================
SELECT setval('users_id_seq',           (SELECT MAX(id) FROM users));
SELECT setval('clientes_id_seq',         (SELECT MAX(id) FROM clientes));
SELECT setval('servicios_id_seq',        (SELECT MAX(id) FROM servicios));
SELECT setval('proyectos_id_seq',        (SELECT MAX(id) FROM proyectos));
SELECT setval('sesiones_tiempo_id_seq',  (SELECT MAX(id) FROM sesiones_tiempo));
SELECT setval('facturas_id_seq',         (SELECT MAX(id) FROM facturas));
