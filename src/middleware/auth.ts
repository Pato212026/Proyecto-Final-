import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users, servicios } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: any;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
  };
}

let cachedUser: any = null;
let initPromise: Promise<any> | null = null;

async function getOrCreateStaticUser(): Promise<any> {
  if (cachedUser) return cachedUser;

  if (initPromise) {
    return initPromise;
  }

  const staticUid = 'default-user-uid';
  const staticEmail = 'lucida@example.com';

  initPromise = (async () => {
    // Check if the user already exists in the Postgres DB
    let pgUser = await db.query.users.findFirst({
      where: eq(users.uid, staticUid),
    });

    if (!pgUser) {
      try {
        // Create user
        const inserted = await db.insert(users)
          .values({
            uid: staticUid,
            email: staticEmail,
          })
          .returning();
        pgUser = inserted[0];

        // Seed catalog of services for new user
        const defaultServices = [
          { nombre: 'Diseño UI', descripcion: 'Diseño de interfaces web y móviles' },
          { nombre: 'Identidad de marca', descripcion: 'Logos, paletas de colores y manuales de marca' },
          { nombre: 'Mantenimiento', descripcion: 'Soporte y actualización continua de piezas de diseño' },
          { nombre: 'Ilustración', descripcion: 'Ilustraciones personalizadas y assets vectoriales' },
          { nombre: 'Diseño Web', descripcion: 'Maquetación y diseño de sitios corporativos y landing pages' }
        ];

        for (const service of defaultServices) {
          await db.insert(servicios).values({
            userId: pgUser.id,
            nombre: service.nombre,
            descripcion: service.descripcion
          });
        }
      } catch (insertError: any) {
        // Fallback silently if some other mechanism inserted concurrently
        pgUser = await db.query.users.findFirst({
          where: eq(users.uid, staticUid),
        });
        if (!pgUser) {
          throw insertError;
        }
      }
    }

    cachedUser = pgUser;
    return pgUser;
  })();

  try {
    const user = await initPromise;
    return user;
  } catch (err) {
    initPromise = null; // Clear promise on failure to allow retry on next requests
    throw err;
  }
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const staticUid = 'default-user-uid';
    const staticEmail = 'lucida@example.com';

    const pgUser = await getOrCreateStaticUser();

    req.user = {
      uid: staticUid,
      email: staticEmail,
      name: 'Lucía'
    };

    req.dbUser = {
      id: pgUser.id,
      uid: pgUser.uid,
      email: pgUser.email,
    };

    next();
  } catch (error: any) {
    console.error('Error during automatic authenticate fallback user bypass:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
