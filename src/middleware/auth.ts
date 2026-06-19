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

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Check if the user already exists in the Postgres DB
    let pgUser = await db.query.users.findFirst({
      where: eq(users.uid, decodedToken.uid),
    });

    if (!pgUser) {
      try {
        // Create user
        const inserted = await db.insert(users)
          .values({
            uid: decodedToken.uid,
            email: decodedToken.email || 'unknown@example.com',
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
        console.warn('Concurrent user insertion handled in requireAuth:', insertError.message || insertError);
        
        // Re-find the user in case they were created in a concurrent transaction
        pgUser = await db.query.users.findFirst({
          where: eq(users.uid, decodedToken.uid),
        });

        if (!pgUser) {
          throw insertError;
        }
      }
    }

    req.dbUser = {
      id: pgUser.id,
      uid: pgUser.uid,
      email: pgUser.email,
    };

    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
