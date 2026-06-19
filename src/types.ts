export interface Client {
  id: number;
  nombre: string;
  contacto: string;
  tipo: string; // 'Fijo' | 'Esporádico'
  createdAt?: string;
}

export interface Service {
  id: number;
  nombre: string;
  descripcion?: string;
  createdAt?: string;
}

export interface Project {
  id: number;
  nombre: string;
  clienteId: number;
  servicioId: number;
  modeloCobro: string; // 'Por hora', 'Precio fijo', 'Suscripción'
  tarifa: number; // Rate in CLP
  estado: string; // 'Activo', 'Completado', 'Pausado'
  cliente?: Client | null;
  servicio?: Service | null;
  createdAt?: string;
}

export interface TimeSession {
  id: number;
  proyectoId: number;
  facturable: boolean;
  fecha: string; // YYYY-MM-DD
  duracion: number; // In seconds
  descripcion?: string;
  proyecto?: Project | null;
  createdAt?: string;
}

export interface Invoice {
  id: number;
  clienteId: number;
  proyectoId?: number | null;
  monto: number; // In CLP (whole number)
  fechaEmision: string; // YYYY-MM-DD
  fechaOrigenDeuda: string; // YYYY-MM-DD
  estado: string; // 'pagada', 'pendiente', 'vencida'
  cliente?: Client | null;
  proyecto?: Project | null;
  createdAt?: string;
}
