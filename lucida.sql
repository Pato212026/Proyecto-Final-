-- =============================================================================
-- BASE DE DATOS LÚCIDA - SCRIPT COMPLETO DE RESPALDO (lucida.sql)
-- Base de Datos compatible con PostgreSQL
-- Contiene: DDL (Estructura de Tablas) y DML (Datos Reales de Producción)
-- Generado el: 2026-06-18
-- =============================================================================

-- ==========================================
-- 0. ELIMINACIÓN DE TABLAS EXISTENTES (Garantiza re-ejecución limpia)
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

-- Tabla de Usuarios (Mapeo de Cuentas)
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
    tarifa INTEGER NOT NULL DEFAULT 0,  -- Presupuesto tarifa de proyecto
    estado VARCHAR(100) NOT NULL,       -- Estado de fase/flujo de trabajo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Sesiones de Registro de Tiempo
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
    monto INTEGER NOT NULL,             -- Monto en CLP
    fecha_emision VARCHAR(10) NOT NULL, -- Formato YYYY-MM-DD
    fecha_origen_deuda VARCHAR(10) NOT NULL, -- Formato YYYY-MM-DD (para antigüedad de deudas)
    estado VARCHAR(50) NOT NULL,        -- 'pagada', 'pendiente', 'vencida'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 2. DATOS REALES EXTRAÍDOS (DML) EN ORDEN DE INTEGRIDAD
-- ==========================================

-- 2.1 Usuarios Registrados
INSERT INTO users (id, uid, email, created_at) VALUES
(1, 'jXNmNWTGu3PNK5fJYoyOk5VwXCu2', 'patricioalarconsalas@gmail.com', '2026-06-18 23:48:45.475483+00'),
(6, 'enoEOOsGG8Og1KDeaVQbAuu4scK2', 'estebansantosss14@gmail.com', '2026-06-19 00:46:09.485077+00');

-- 2.2 Catálogo de Servicios
INSERT INTO servicios (id, user_id, nombre, descripcion, created_at) VALUES
(1, 1, 'Diseño UI', 'Diseño de interfaces web y móviles', '2026-06-18 23:48:45.546965+00'),
(2, 1, 'Identidad de marca', 'Logos, paletas de colores y manuales de marca', '2026-06-18 23:48:45.621112+00'),
(3, 1, 'Mantenimiento', 'Soporte y actualización continua de piezas de diseño', '2026-06-18 23:48:45.690789+00'),
(4, 1, 'Ilustración', 'Ilustraciones personalizadas y assets vectoriales', '2026-06-18 23:48:45.759906+00'),
(5, 1, 'Diseño Web', 'Maquetación y diseño de sitios corporativos y landing pages', '2026-06-18 23:48:45.83156+00'),
(6, 6, 'Diseño UI', 'Diseño de interfaces web y móviles', '2026-06-19 00:46:09.569561+00'),
(7, 6, 'Identidad de marca', 'Logos, paletas de colores y manuales de marca', '2026-06-19 00:46:09.65274+00'),
(8, 6, 'Mantenimiento', 'Soporte y actualización continua de piezas de diseño', '2026-06-19 00:46:09.736161+00'),
(9, 6, 'Ilustración', 'Ilustraciones personalizadas y assets vectoriales', '2026-06-19 00:46:09.819486+00'),
(10, 6, 'Diseño Web', 'Maquetación y diseño de sitios corporativos y landing pages', '2026-06-19 00:46:09.90269+00'),
(11, 1, 'Consultoría', NULL, '2026-06-19 01:53:40.497784+00');

-- 2.3 Clientes Reales
INSERT INTO clientes (id, user_id, nombre, contacto, tipo, created_at) VALUES
(1, 1, 'Estudio Austral', 'austral@contacto.cl', 'Fijo', '2026-06-18 23:53:18.477039+00'),
(2, 1, 'Agencia Mamba', 'mamba@contacto.cl', 'Esporádico', '2026-06-18 23:53:18.819449+00'),
(3, 1, 'Editorial Norte', 'norte@contacto.cl', 'Fijo', '2026-06-18 23:53:19.16972+00'),
(4, 1, 'Estudio Austral', 'austral@contacto.cl', 'Fijo', '2026-06-18 23:53:21.874994+00'),
(5, 1, 'Agencia Mamba', 'mamba@contacto.cl', 'Esporádico', '2026-06-18 23:53:22.224523+00'),
(6, 1, 'Editorial Norte', 'norte@contacto.cl', 'Fijo', '2026-06-18 23:53:22.571953+00'),
(8, 6, 'Estudio Austral', 'austral@contacto.cl', 'Fijo', '2026-06-19 00:47:35.330249+00'),
(9, 6, 'Agencia Mamba', 'mamba@contacto.cl', 'Esporádico', '2026-06-19 00:47:35.66568+00'),
(10, 6, 'Editorial Norte', 'norte@contacto.cl', 'Fijo', '2026-06-19 00:47:35.997288+00'),
(11, 1, 'Editorial Norte', 'contacto@editorialnorte.cl', 'Fijo', '2026-06-19 01:28:56.607636+00'),
(12, 1, 'Estudio Andes', 'hola@estudioandes.cl', 'Fijo', '2026-06-19 01:28:56.92932+00'),
(13, 1, 'Café Raíz', '+56 9 8765 4321', 'Fijo', '2026-06-19 01:28:57.246601+00'),
(14, 1, 'Boutique Lúmina', 'ventas@lumina.cl', 'Fijo', '2026-06-19 01:28:57.566541+00'),
(15, 1, 'Constructora Sur', 'proyectos@constructorasur.cl', 'Fijo', '2026-06-19 01:28:57.897327+00'),
(16, 1, 'Marca Personal · Javiera', 'javiera.dg@gmail.com', 'Esporádico', '2026-06-19 01:28:58.216042+00'),
(17, 1, 'Taller Bicicletas Pedal', 'info@tallerpedal.cl', 'Esporádico', '2026-06-19 01:28:58.527364+00');

-- 2.4 Proyectos Reales
INSERT INTO proyectos (id, user_id, cliente_id, servicio_id, nombre, modelo_cobro, tarifa, estado, created_at) VALUES
(1, 1, 1, 1, 'Rediseño Web', 'Por hora', 25000, 'Activo', '2026-06-18 23:53:19.511459+00'),
(2, 1, 2, 2, 'Identidad Corporativa', 'Precio fijo', 600000, 'Activo', '2026-06-18 23:53:19.856815+00'),
(3, 1, 3, 3, 'Mantenimiento Mensual', 'Suscripción', 400000, 'Activo', '2026-06-18 23:53:20.196605+00'),
(4, 1, 4, 1, 'Rediseño Web', 'Por hora', 25000, 'Activo', '2026-06-18 23:53:22.917744+00'),
(5, 1, 5, 2, 'Identidad Corporativa', 'Precio fijo', 600000, 'Activo', '2026-06-18 23:53:23.257393+00'),
(6, 1, 6, 3, 'Mantenimiento Mensual', 'Suscripción', 400000, 'Activo', '2026-06-18 23:53:23.593881+00'),
(8, 6, 8, 6, 'Rediseño Web', 'Por hora', 25000, 'Activo', '2026-06-19 00:47:36.307595+00'),
(9, 6, 9, 7, 'Identidad Corporativa', 'Precio fijo', 600000, 'Activo', '2026-06-19 00:47:36.628961+00'),
(10, 6, 10, 8, 'Mantenimiento Mensual', 'Suscripción', 400000, 'Activo', '2026-06-19 00:47:36.944389+00'),
(11, 1, 11, 2, 'Rediseño identidad de marca', 'Precio fijo', 1200000, 'Diseño', '2026-06-19 01:53:38.61622+00'),
(12, 1, 11, 3, 'Mantención web mensual', 'Suscripción', 150000, 'Activo', '2026-06-19 01:53:38.928258+00'),
(13, 1, 13, 1, 'App carta digital', 'Por hora', 25000, 'Briefing', '2026-06-19 01:53:39.257951+00'),
(14, 1, 14, 1, 'Catálogo de productos', 'Precio fijo', 800000, 'Feedback', '2026-06-19 01:53:39.570245+00'),
(15, 1, 15, 2, 'Brandbook corporativo', 'Precio fijo', 1500000, 'Activo', '2026-06-19 01:53:39.885187+00'),
(16, 1, 16, 4, 'Ilustraciones redes sociales', 'Suscripción', 90000, 'Activo', '2026-06-19 01:53:40.195371+00'),
(17, 1, 12, 11, 'Asesoría de marca', 'Por hora', 30000, 'Activo', '2026-06-19 01:53:40.817381+00');

-- 2.5 Sesiones de Tiempo Reales
INSERT INTO sesiones_tiempo (id, user_id, proyecto_id, facturable, fecha, duracion, descripcion, created_at) VALUES
(1, 1, 1, TRUE, '2026-06-18', 122400, 'Layouts iniciales y wireframes del landing', '2026-06-18 23:53:20.53902+00'),
(2, 1, 2, TRUE, '2026-06-18', 151200, 'Creación de logo corporativo y manual', '2026-06-18 23:53:20.880115+00'),
(3, 1, 3, FALSE, '2026-06-18', 57600, 'Reuniones de planificación y soporte técnico', '2026-06-18 23:53:21.225923+00'),
(4, 1, 4, TRUE, '2026-06-18', 122400, 'Layouts iniciales y wireframes del landing', '2026-06-18 23:53:23.936025+00'),
(5, 1, 5, TRUE, '2026-06-18', 151200, 'Creación de logo corporativo y manual', '2026-06-18 23:53:24.282351+00'),
(6, 1, 6, FALSE, '2026-06-18', 57600, 'Reuniones de planificación y soporte técnico', '2026-06-18 23:53:24.634365+00'),
(7, 1, 4, TRUE, '2026-06-18', 9, NULL, '2026-06-18 23:56:00.410761+00'),
(12, 6, 8, TRUE, '2026-06-19', 122400, 'Layouts iniciales y wireframes del landing', '2026-06-19 00:47:37.25321+00'),
(13, 6, 9, TRUE, '2026-06-19', 151200, 'Creación de logo corporativo y manual', '2026-06-19 00:47:37.566329+00'),
(14, 6, 10, FALSE, '2026-06-19', 57600, 'Reuniones de planificación y soporte técnico', '2026-06-19 00:47:37.883798+00');

-- 2.6 Facturas Reales Extraídas (incluyendo históricas y deudas pasadas)
INSERT INTO facturas (id, user_id, cliente_id, proyecto_id, monto, fecha_emision, fecha_origen_deuda, estado, created_at) VALUES
(1, 1, 1, 1, 850000, '2026-06-18', '2026-06-18', 'pagada', '2026-06-18 23:53:21.575794+00'),
(2, 1, 2, 2, 600000, '2026-06-18', '2026-06-18', 'pendiente', '2026-06-18 23:53:21.921562+00'),
(3, 1, 3, 3, 400000, '2026-06-18', '2026-06-18', 'pendiente', '2026-06-18 23:53:22.260811+00'),
(4, 1, 2, 2, 120000, '2026-01-10', '2026-01-10', 'vencida', '2026-06-18 23:53:22.600937+00'),
(5, 1, 4, 4, 850000, '2026-06-18', '2026-06-18', 'pagada', '2026-06-18 23:53:24.979578+00'),
(6, 1, 5, 5, 600000, '2026-06-18', '2026-06-18', 'pendiente', '2026-06-18 23:53:25.327467+00'),
(7, 1, 6, 6, 400000, '2026-06-18', '2026-06-18', 'pendiente', '2026-06-18 23:53:25.674923+00'),
(8, 1, 5, 5, 120000, '2026-01-10', '2026-01-10', 'vencida', '2026-06-18 23:53:26.01263+00'),
(11, 6, 8, 8, 850000, '2026-06-19', '2026-06-19', 'pagada', '2026-06-19 00:47:38.203629+00'),
(12, 6, 9, 9, 600000, '2026-06-19', '2026-06-19', 'pendiente', '2026-06-19 00:47:38.520333+00'),
(13, 6, 10, 10, 400000, '2026-06-19', '2026-06-19', 'pendiente', '2026-06-19 00:47:38.839062+00'),
(14, 6, 9, 9, 120000, '2026-01-10', '2026-01-10', 'vencida', '2026-06-19 00:47:39.157225+00'),
(15, 1, 11, 11, 1200000, '2026-03-10', '2026-03-10', 'pagada', '2026-06-19 02:09:33.664988+00'),
(16, 1, 11, 12, 150000, '2026-02-01', '2026-02-01', 'pendiente', '2026-06-19 02:09:33.99178+00'),
(17, 1, 13, 13, 450000, '2026-01-15', '2026-01-15', 'vencida', '2026-06-19 02:09:34.303951+00'),
(18, 1, 14, 14, 800000, '2026-03-15', '2026-03-15', 'pendiente', '2026-06-19 02:09:34.619902+00'),
(19, 1, 15, 15, 1500000, '2026-02-20', '2026-02-20', 'pagada', '2026-06-19 02:09:34.933761+00'),
(20, 1, 16, NULL, 90000, '2026-04-01', '2026-04-01', 'pendiente', '2026-06-19 02:09:35.248206+00');


-- =============================================================================
-- 3. ACTUALIZACIÓN DE SECUENCIAS (PostgreSQL Serial Primary Keys Correction)
-- =============================================================================
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('clientes_id_seq', (SELECT MAX(id) FROM clientes));
SELECT setval('servicios_id_seq', (SELECT MAX(id) FROM servicios));
SELECT setval('proyectos_id_seq', (SELECT MAX(id) FROM proyectos));
SELECT setval('sesiones_tiempo_id_seq', (SELECT MAX(id) FROM sesiones_tiempo));
SELECT setval('facturas_id_seq', (SELECT MAX(id) FROM facturas));
