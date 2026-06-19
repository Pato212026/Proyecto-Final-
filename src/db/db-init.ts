import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is not defined!");
  process.exit(1);
}

const useSsl = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

const pool = new pg.Pool({
  connectionString: connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

const run = async () => {
  try {
    console.log('Verifying or creating tables in database...');

    // 1. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "uid" TEXT NOT NULL UNIQUE,
        "email" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "users" table verified/created.');

    // 2. Create clientes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "clientes" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "nombre" TEXT NOT NULL,
        "contacto" TEXT NOT NULL,
        "tipo" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "clientes" table verified/created.');

    // 3. Create servicios table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "servicios" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "nombre" TEXT NOT NULL,
        "descripcion" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "servicios" table verified/created.');

    // 4. Create proyectos table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "proyectos" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "cliente_id" INTEGER NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
        "servicio_id" INTEGER NOT NULL REFERENCES "servicios"("id"),
        "nombre" TEXT NOT NULL,
        "modelo_cobro" TEXT NOT NULL,
        "tarifa" INTEGER DEFAULT 0 NOT NULL,
        "estado" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "proyectos" table verified/created.');

    // 5. Create sesiones_tiempo table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "sesiones_tiempo" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "proyecto_id" INTEGER NOT NULL REFERENCES "proyectos"("id") ON DELETE CASCADE,
        "facturable" BOOLEAN DEFAULT true NOT NULL,
        "fecha" TEXT NOT NULL,
        "duracion" INTEGER NOT NULL,
        "descripcion" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "sesiones_tiempo" table verified/created.');

    // 6. Create facturas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "facturas" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "cliente_id" INTEGER NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
        "proyecto_id" INTEGER REFERENCES "proyectos"("id") ON DELETE CASCADE,
        "monto" INTEGER NOT NULL,
        "fecha_emision" TEXT NOT NULL,
        "fecha_origen_deuda" TEXT NOT NULL,
        "estado" TEXT NOT NULL,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('- "facturas" table verified/created.');

    console.log('All database tables verified and created successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error while creating database tables:', error);
    await pool.end();
    process.exit(1);
  }
};

run();
