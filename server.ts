import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { clientes, servicios, proyectos, sesionesTiempo, facturas } from './src/db/schema.ts';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from './src/middleware/auth.ts';

// Path resolution safe for both ESM and CJS formats
const _filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== 'undefined' ? __filename : '');

const _dirname = typeof import.meta !== 'undefined' && import.meta.url
  ? path.dirname(_filename)
  : (typeof __dirname !== 'undefined' ? __dirname : '');

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global middleware
  app.use(express.json());

  // --- API ROUTES FIRST ---

  // Register / Ping
  app.post('/api/register', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({ status: 'ok', user: req.dbUser });
    } catch (error: any) {
      console.error('Error on register:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clientes Router
  app.get('/api/clientes', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await db.select().from(clientes)
        .where(eq(clientes.userId, req.dbUser!.id))
        .orderBy(desc(clientes.createdAt));
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ error: 'Fallo al obtener clientes.' });
    }
  });

  app.post('/api/clientes', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { nombre, contacto, tipo } = req.body;
    if (!nombre || !contacto || !tipo) {
      return res.status(400).json({ error: 'Nombre, contacto y tipo son requeridos.' });
    }
    try {
      const result = await db.insert(clientes).values({
        userId: req.dbUser!.id,
        nombre,
        contacto,
        tipo,
      }).returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Fallo al crear cliente.' });
    }
  });

  app.put('/api/clientes/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { nombre, contacto, tipo } = req.body;
    try {
      const result = await db.update(clientes)
        .set({ nombre, contacto, tipo })
        .where(and(eq(clientes.id, parseInt(id)), eq(clientes.userId, req.dbUser!.id)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado o no pertenece a este usuario.' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Fallo al actualizar cliente.' });
    }
  });

  app.delete('/api/clientes/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const clientId = parseInt(id);
      const userId = req.dbUser!.id;

      // 1. Get associated projects
      const clientProjs = await db.select({ id: proyectos.id }).from(proyectos)
        .where(and(eq(proyectos.clienteId, clientId), eq(proyectos.userId, userId)));
      const projectIds = clientProjs.map(p => p.id);

      // 2. Clear related timer sessions for those projects
      if (projectIds.length > 0) {
        await db.delete(sesionesTiempo)
          .where(and(
            inArray(sesionesTiempo.proyectoId, projectIds),
            eq(sesionesTiempo.userId, userId)
          ));
      }

      // 3. Clear invoices associated with those projects
      if (projectIds.length > 0) {
        await db.delete(facturas)
          .where(and(
            inArray(facturas.proyectoId, projectIds),
            eq(facturas.userId, userId)
          ));
      }

      // 4. Clear any generic invoices associated with the client directly
      await db.delete(facturas)
        .where(and(
          eq(facturas.clienteId, clientId),
          eq(facturas.userId, userId)
        ));

      // 5. Clear projects associated with the client
      await db.delete(proyectos)
        .where(and(
          eq(proyectos.clienteId, clientId),
          eq(proyectos.userId, userId)
        ));

      // 6. Delete the client itself
      const result = await db.delete(clientes)
        .where(and(eq(clientes.id, clientId), eq(clientes.userId, userId)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado.' });
      }
      res.json({ message: 'Cliente y todos sus datos relacionados fueron eliminados correctamente.' });
    } catch (error: any) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Fallo al eliminar cliente.' });
    }
  });

  // Servicios Router
  app.get('/api/servicios', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await db.select().from(servicios)
        .where(eq(servicios.userId, req.dbUser!.id))
        .orderBy(desc(servicios.createdAt));
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching services:', error);
      res.status(500).json({ error: 'Fallo al obtener servicios.' });
    }
  });

  app.post('/api/servicios', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del servicio es requerido.' });
    }
    try {
      const result = await db.insert(servicios).values({
        userId: req.dbUser!.id,
        nombre,
        descripcion: descripcion || '',
      }).returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating service:', error);
      res.status(500).json({ error: 'Fallo al crear servicio.' });
    }
  });

  // Proyectos Router
  app.get('/api/proyectos', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // We can fetch projects and join with client and service details
      const list = await db.select().from(proyectos)
        .where(eq(proyectos.userId, req.dbUser!.id))
        .orderBy(desc(proyectos.createdAt));

      // Fetch all clients and services for simpler manual mapping mapping, in a fast single hit
      const allClients = await db.select().from(clientes).where(eq(clientes.userId, req.dbUser!.id));
      const allServices = await db.select().from(servicios).where(eq(servicios.userId, req.dbUser!.id));

      const enriched = list.map(proj => {
        const cli = allClients.find(c => c.id === proj.clienteId);
        const srv = allServices.find(s => s.id === proj.servicioId);
        return {
          ...proj,
          cliente: cli || null,
          servicio: srv || null,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Fallo al obtener proyectos.' });
    }
  });

  app.post('/api/proyectos', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { nombre, clienteId, servicioId, modeloCobro, tarifa, estado } = req.body;
    if (!nombre || !clienteId || !servicioId || !modeloCobro || estado === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para el proyecto.' });
    }
    try {
      const result = await db.insert(proyectos).values({
        userId: req.dbUser!.id,
        clienteId: parseInt(clienteId),
        servicioId: parseInt(servicioId),
        nombre,
        modeloCobro,
        tarifa: parseInt(tarifa) || 0,
        estado: estado || 'Activo',
      }).returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Fallo al crear proyecto.' });
    }
  });

  app.put('/api/proyectos/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { nombre, clienteId, servicioId, modeloCobro, tarifa, estado } = req.body;
    try {
      const result = await db.update(proyectos)
        .set({
          nombre,
          clienteId: clienteId ? parseInt(clienteId) : undefined,
          servicioId: servicioId ? parseInt(servicioId) : undefined,
          modeloCobro,
          tarifa: tarifa !== undefined ? parseInt(tarifa) : undefined,
          estado,
        })
        .where(and(eq(proyectos.id, parseInt(id)), eq(proyectos.userId, req.dbUser!.id)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Proyecto no encontrado.' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Fallo al actualizar proyecto.' });
    }
  });

  app.delete('/api/proyectos/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const projectId = parseInt(id);
      const userId = req.dbUser!.id;

      // 1. Delete associated sessions
      await db.delete(sesionesTiempo)
        .where(and(
          eq(sesionesTiempo.proyectoId, projectId),
          eq(sesionesTiempo.userId, userId)
        ));

      // 2. Delete associated invoices
      await db.delete(facturas)
        .where(and(
          eq(facturas.proyectoId, projectId),
          eq(facturas.userId, userId)
        ));

      // 3. Delete the project itself
      const result = await db.delete(proyectos)
        .where(and(eq(proyectos.id, projectId), eq(proyectos.userId, userId)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Proyecto no encontrado.' });
      }
      res.json({ message: 'Proyecto y registros de horas/facturas relaciones fueron eliminados correctamente.' });
    } catch (error: any) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Fallo al eliminar proyecto.' });
    }
  });

  // Sesiones de Tiempo Router
  app.get('/api/sesiones', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.select().from(sesionesTiempo)
        .where(eq(sesionesTiempo.userId, req.dbUser!.id))
        .orderBy(desc(sesionesTiempo.createdAt));

      // Fetch projects, clients, and services to enrich
      const allProjects = await db.select().from(proyectos).where(eq(proyectos.userId, req.dbUser!.id));
      const allClients = await db.select().from(clientes).where(eq(clientes.userId, req.dbUser!.id));
      const allServices = await db.select().from(servicios).where(eq(servicios.userId, req.dbUser!.id));

      const enriched = list.map(sess => {
        const proj = allProjects.find(p => p.id === sess.proyectoId);
        const cli = proj ? allClients.find(c => c.id === proj.clienteId) : null;
        const srv = proj ? allServices.find(s => s.id === proj.servicioId) : null;
        return {
          ...sess,
          proyecto: proj ? {
            ...proj,
            cliente: cli || null,
            servicio: srv || null,
          } : null,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Fallo al obtener sesiones de tiempo.' });
    }
  });

  app.post('/api/sesiones', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { proyectoId, facturable, fecha, duracion, descripcion } = req.body;
    if (!proyectoId || !fecha || duracion === undefined) {
      return res.status(400).json({ error: 'Proyecto, fecha y duración son requeridos.' });
    }
    try {
      const result = await db.insert(sesionesTiempo).values({
        userId: req.dbUser!.id,
        proyectoId: parseInt(proyectoId),
        facturable: facturable !== undefined ? !!facturable : true,
        fecha,
        duracion: parseInt(duracion),
        descripcion: descripcion || '',
      }).returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating time session:', error);
      res.status(500).json({ error: 'Fallo al registrar sesión de tiempo.' });
    }
  });

  app.delete('/api/sesiones/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const result = await db.delete(sesionesTiempo)
        .where(and(eq(sesionesTiempo.id, parseInt(id)), eq(sesionesTiempo.userId, req.dbUser!.id)))
        .returning();
      if (result.length === 0) {
        return res.status(404).json({ error: 'Sesión no encontrada.' });
      }
      res.json({ message: 'Sesión eliminada de forma exitosa.' });
    } catch (error: any) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Fallo al eliminar sesión de tiempo.' });
    }
  });

  // Facturas Router
  app.get('/api/facturas', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db.select().from(facturas)
        .where(eq(facturas.userId, req.dbUser!.id))
        .orderBy(desc(facturas.createdAt));

      // Fetch related customers and projects for enriching
      const allClients = await db.select().from(clientes).where(eq(clientes.userId, req.dbUser!.id));
      const allProjects = await db.select().from(proyectos).where(eq(proyectos.userId, req.dbUser!.id));

      const enriched = list.map(fac => {
        const cli = allClients.find(c => c.id === fac.clienteId);
        const proj = fac.proyectoId ? allProjects.find(p => p.id === fac.proyectoId) : null;
        return {
          ...fac,
          cliente: cli || null,
          proyecto: proj || null,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Fallo al obtener facturas.' });
    }
  });

  app.post('/api/facturas', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { clienteId, proyectoId, monto, fechaEmision, fechaOrigenDeuda, estado } = req.body;
    if (!clienteId || monto === undefined || !fechaEmision || !fechaOrigenDeuda || !estado) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para emitir factura.' });
    }
    try {
      const result = await db.insert(facturas).values({
        userId: req.dbUser!.id,
        clienteId: parseInt(clienteId),
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        monto: parseInt(monto),
        fechaEmision,
        fechaOrigenDeuda,
        estado,
      }).returning();
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Fallo al emitir factura.' });
    }
  });

  app.put('/api/facturas/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { clienteId, proyectoId, monto, fechaEmision, fechaOrigenDeuda, estado } = req.body;
    try {
      const result = await db.update(facturas)
        .set({
          clienteId: clienteId ? parseInt(clienteId) : undefined,
          proyectoId: proyectoId !== undefined ? (proyectoId ? parseInt(proyectoId) : null) : undefined,
          monto: monto !== undefined ? parseInt(monto) : undefined,
          fechaEmision,
          fechaOrigenDeuda,
          estado,
        })
        .where(and(eq(facturas.id, parseInt(id)), eq(facturas.userId, req.dbUser!.id)))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Factura no encontrada o no pertenece a este usuario.' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      res.status(500).json({ error: 'Fallo al actualizar factura.' });
    }
  });

  app.delete('/api/facturas/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const result = await db.delete(facturas)
        .where(and(eq(facturas.id, parseInt(id)), eq(facturas.userId, req.dbUser!.id)))
        .returning();
      if (result.length === 0) {
        return res.status(404).json({ error: 'Factura no encontrada.' });
      }
      res.json({ message: 'Factura eliminada.' });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: 'Fallo al eliminar factura.' });
    }
  });

  // Demo Reset endpoint to prevent duplicates and clean old demo data before inserting
  app.post('/api/demo/reset', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.dbUser!.id;
      // 1. Delete associated sessions
      await db.delete(sesionesTiempo).where(eq(sesionesTiempo.userId, userId));
      // 2. Delete associated invoices
      await db.delete(facturas).where(eq(facturas.userId, userId));
      // 3. Delete associated projects
      await db.delete(proyectos).where(eq(proyectos.userId, userId));
      // 4. Delete associated clients
      await db.delete(clientes).where(eq(clientes.userId, userId));
      // 5. Delete associated services
      await db.delete(servicios).where(eq(servicios.userId, userId));

      res.json({ message: 'Todos los datos previos fueron eliminados con éxito.' });
    } catch (error: any) {
      console.error('Error resetting user demo data:', error);
      res.status(500).json({ error: 'Fallo al reiniciar los datos de demostración.' });
    }
  });

  // --- MIDDLEWARE FOR DEV OR ASSET SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
