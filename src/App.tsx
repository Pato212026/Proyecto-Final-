import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, onIdTokenChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { ClientTimer } from './components/ClientTimer.tsx';
import { ExcelImporter, ColumnMapping } from './components/ExcelImporter.tsx';
import { Client, Project, Service, TimeSession, Invoice } from './types.ts';
import { 
  Users, Briefcase, Receipt, Timer, Home, LogOut, Plus, Edit2, Trash2, Calendar, FileText, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, BarChart2, FileSpreadsheet
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [apiToken, setApiToken] = useState<string | null>(null);

  // Entities state
  const [clientes, setClientes] = useState<Client[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [servicios, setServicios] = useState<Service[]>([]);
  const [sesiones, setSesiones] = useState<TimeSession[]>([]);
  const [facturas, setFacturas] = useState<Invoice[]>([]);

  // Navigation: 'dashboard' | 'proyectos' | 'clientes' | 'facturas' | 'sesiones'
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'proyectos' | 'clientes' | 'facturas' | 'sesiones'>('dashboard');

  // Loading of individual lists
  const [loadingData, setLoadingData] = useState(false);

  // Modal / Form state
  const [showClientModal, setShowClientModal] = useState(false);
  const [showImportClientModal, setShowImportClientModal] = useState(false);
  const [showImportProjectModal, setShowImportProjectModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({ nombre: '', contacto: '', tipo: 'Fijo' });

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({ nombre: '', clienteId: '', servicioId: '', modeloCobro: 'Por hora', tarifa: '25000', estado: 'Activo' });

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showImportInvoiceModal, setShowImportInvoiceModal] = useState(false);
  const [showImportSessionModal, setShowImportSessionModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ clienteId: '', proyectoId: '', monto: '200000', fechaEmision: '', fechaOrigenDeuda: '', estado: 'pendiente' });

  // Custom service helper state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');

  // Deletion confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    type: 'client' | 'project' | 'invoice' | 'session' | 'reset' | null;
    id: number | null;
    message: string;
  }>({
    show: false,
    type: null,
    id: null,
    message: '¿Estás seguro de que quieres eliminar esto?'
  });

  // Setup current date as default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setInvoiceForm(prev => ({
      ...prev,
      fechaEmision: today,
      fechaOrigenDeuda: today
    }));
  }, []);

  // Listen to Auth State and Token Refreshes
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setApiToken(token);
        } catch (e) {
          console.error("Error getting user ID Token", e);
        }
      } else {
        setApiToken(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Periodic Token Auto-Refresh (Every 10 minutes to guarantee token never expires)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          const freshToken = await auth.currentUser.getIdToken(true);
          setApiToken(freshToken);
        } catch (err) {
          console.error("Error during background token auto-refresh:", err);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
  }, []);

  // Fetch all data from API whenever token is ready
  const fetchAllData = async (token: string) => {
    setLoadingData(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Make concurrent fetches
      const [resCli, resProj, resServ, resSess, resFac] = await Promise.all([
        fetch('/api/clientes', { headers }),
        fetch('/api/proyectos', { headers }),
        fetch('/api/servicios', { headers }),
        fetch('/api/sesiones', { headers }),
        fetch('/api/facturas', { headers })
      ]);

      if (resCli.ok) setClientes(await resCli.json());
      if (resProj.ok) setProyectos(await resProj.json());
      if (resServ.ok) setServicios(await resServ.json());
      if (resSess.ok) setSesiones(await resSess.json());
      if (resFac.ok) setFacturas(await resFac.json());

    } catch (error) {
      console.error("Error fetching Lúcida data", error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (apiToken) {
      fetchAllData(apiToken);
    }
  }, [apiToken]);

  // Seeding initial template data so Lucía doesn't start with a blank screen on her first workspace load.
  const handleLoadDemoData = async () => {
    if (!confirm('¿Deseas cargar los datos de demostración? Esto restablecerá tus datos actuales (clientes, proyectos, facturas, bitácora) para evitar duplicados y dejar un estado demo limpio.')) return;
    
    let activeToken = apiToken;
    if (!activeToken && auth.currentUser) {
      try {
        activeToken = await auth.currentUser.getIdToken(true);
        setApiToken(activeToken);
      } catch (e) {
        console.error("Error securing active token:", e);
      }
    }

    if (!activeToken) {
      alert('No se pudo verificar tu sesión. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoadingData(true);
    try {
      const headers = { 
        'Authorization': `Bearer ${activeToken}`, 
        'Content-Type': 'application/json' 
      };

      // 0. Reset prev demo/user data
      await fetch('/api/demo/reset', {
        method: 'POST',
        headers
      });

      // 1. Create 3 Clientes
      const c1 = await fetch('/api/clientes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Estudio Austral', contacto: 'austral@contacto.cl', tipo: 'Fijo' })
      }).then(r => r.json());

      const c2 = await fetch('/api/clientes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Agencia Mamba', contacto: 'mamba@contacto.cl', tipo: 'Esporádico' })
      }).then(r => r.json());

      const c3 = await fetch('/api/clientes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Editorial Norte', contacto: 'norte@contacto.cl', tipo: 'Fijo' })
      }).then(r => r.json());

      // Find services (should have seeded 'Diseño UI', 'Identidad de marca', 'Mantenimiento' on register)
      let currentServs = servicios;
      if (currentServs.length === 0) {
        const sRes = await fetch('/api/servicios', { headers });
        currentServs = await sRes.json();
        setServicios(currentServs);
      }

      const sUI = currentServs.find(s => s.nombre === 'Diseño UI')?.id || 1;
      const sBrand = currentServs.find(s => s.nombre === 'Identidad de marca')?.id || 2;
      const sMaint = currentServs.find(s => s.nombre === 'Mantenimiento')?.id || 3;

      // 2. Create Projects
      const p1 = await fetch('/api/proyectos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Rediseño Web', clienteId: c1.id, servicioId: sUI, modeloCobro: 'Por hora', tarifa: 25000, estado: 'Activo' })
      }).then(r => r.json());

      const p2 = await fetch('/api/proyectos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Identidad Corporativa', clienteId: c2.id, servicioId: sBrand, modeloCobro: 'Precio fijo', tarifa: 600000, estado: 'Activo' })
      }).then(r => r.json());

      const p3 = await fetch('/api/proyectos', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nombre: 'Mantenimiento Mensual', clienteId: c3.id, servicioId: sMaint, modeloCobro: 'Suscripción', tarifa: 400000, estado: 'Activo' })
      }).then(r => r.json());

      // 3. Create Time Sessions
      const today = new Date().toISOString().split('T')[0];
      await fetch('/api/sesiones', {
        method: 'POST',
        headers,
        body: JSON.stringify({ proyectoId: p1.id, facturable: true, fecha: today, duracion: 34 * 3600, descripcion: 'Layouts iniciales y wireframes del landing' }) // 34 hours
      });

      await fetch('/api/sesiones', {
        method: 'POST',
        headers,
        body: JSON.stringify({ proyectoId: p2.id, facturable: true, fecha: today, duracion: 42 * 3600, descripcion: 'Creación de logo corporativo y manual' }) // 42 hours
      });

      await fetch('/api/sesiones', {
        method: 'POST',
        headers,
        body: JSON.stringify({ proyectoId: p3.id, facturable: false, fecha: today, duracion: 16 * 3600, descripcion: 'Reuniones de planificación y soporte técnico' }) // 16 hours
      });

      // 4. Create Invoices
      await fetch('/api/facturas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clienteId: c1.id, proyectoId: p1.id, monto: 850000, fechaEmision: today, fechaOrigenDeuda: today, estado: 'pagada' })
      });

      await fetch('/api/facturas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clienteId: c2.id, proyectoId: p2.id, monto: 600000, fechaEmision: today, fechaOrigenDeuda: today, estado: 'pendiente' })
      });

      await fetch('/api/facturas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clienteId: c3.id, proyectoId: p3.id, monto: 400000, fechaEmision: today, fechaOrigenDeuda: today, estado: 'pendiente' })
      });

      // Overdue Demo Invoice
      await fetch('/api/facturas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clienteId: c2.id, proyectoId: p2.id, monto: 120000, fechaEmision: '2026-01-10', fechaOrigenDeuda: '2026-01-10', estado: 'vencida' })
      });

      // Refresh
      await fetchAllData(activeToken);
      alert('¡Datos de demostración cargados exitosamente!');
    } catch (error) {
      console.error(error);
      alert('Error inicializando datos.');
    } finally {
      setLoadingData(false);
    }
  };

  // ---------------- CRUD ACTION FUNCTIONS ----------------

  // Client CRUD
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiToken) return;
    try {
      const headers = { 
        'Authorization': `Bearer ${apiToken}`, 
        'Content-Type': 'application/json' 
      };

      if (editingClient) {
        // Update
        const res = await fetch(`/api/clientes/${editingClient.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(clientForm)
        });
        if (res.ok) {
          setClientes(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientForm } : c));
          setShowClientModal(false);
          setEditingClient(null);
        }
      } else {
        // Create
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers,
          body: JSON.stringify(clientForm)
        });
        if (res.ok) {
          const fresh = await res.json();
          setClientes(prev => [fresh, ...prev]);
          setShowClientModal(false);
        }
      }
      setClientForm({ nombre: '', contacto: '', tipo: 'Fijo' });
    } catch (err) {
      console.error(err);
    }
  };

  const clientColumnConfig: ColumnMapping[] = [
    {
      key: 'nombre',
      label: 'Nombre de Cliente',
      synonyms: ['nombre', 'name', 'cliente', 'customer', 'empresa', 'razon social'],
      required: true,
      validate: (val) => {
        if (!val || val.toString().trim().length === 0) return 'El nombre de cliente es obligatorio';
        return null;
      }
    },
    {
      key: 'contacto',
      label: 'Información de Contacto',
      synonyms: ['contacto', 'contact', 'email', 'correo', 'fono', 'telefono', 'teléfono', 'phone'],
      required: true,
      validate: (val) => {
        if (!val || val.toString().trim().length === 0) return 'La información de contacto es obligatoria';
        return null;
      }
    },
    {
      key: 'tipo',
      label: 'Tipo de Cliente',
      synonyms: ['tipo', 'type', 'tipo de cliente', 'client type'],
      required: false,
      defaultValue: 'Fijo',
      normalize: (val) => {
        const v = val.toString().toLowerCase().trim();
        if (v.includes('fijo') || v.includes('fixed')) return 'Fijo';
        if (v.includes('espor') || v.includes('tem') || v.includes('one') || v.includes('esp')) return 'Esporádico';
        return 'Fijo'; // Default fallback
      },
      validate: (val) => {
        const normalized = val.toString();
        if (normalized !== 'Fijo' && normalized !== 'Esporádico') {
          return "El tipo de cliente debe ser o bien 'Fijo' o 'Esporádico'.";
        }
        return null;
      }
    }
  ];

  const handleImportClients = async (validClients: any[]) => {
    if (!apiToken) return;
    const headers = { 
      'Authorization': `Bearer ${apiToken}`, 
      'Content-Type': 'application/json' 
    };

    let importedCount = 0;
    for (const cli of validClients) {
      try {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            nombre: cli.nombre,
            contacto: cli.contacto,
            tipo: cli.tipo || 'Fijo'
          })
        });
        if (res.ok) {
          importedCount++;
        } else {
          console.error('Error importing client row:', await res.text());
        }
      } catch (err) {
        console.error('Network error during client import:', err);
      }
    }

    // Refresh client list
    await fetchAllData(apiToken);
    alert(`Se han importado exitosamente ${importedCount} de ${validClients.length} clientes.`);
  };

  const projectColumnConfig: ColumnMapping[] = [
    {
      key: 'nombre',
      label: 'Nombre del Proyecto',
      synonyms: ['nombre del proyecto', 'nombre proyecto', 'nombre', 'proyecto', 'project name', 'project'],
      required: true,
      validate: (val) => {
        if (!val || val.toString().trim().length === 0) return 'El nombre del proyecto es obligatorio';
        return null;
      }
    },
    {
      key: 'clienteNombre',
      label: 'Cliente',
      synonyms: ['clienteNombre', 'cliente', 'client', 'customer', 'empresa'],
      required: true,
      validate: (val) => {
        const trimmedVal = val?.toString().trim();
        if (!trimmedVal) return 'El cliente es obligatorio';
        const found = clientes.some(c => c.nombre.trim().toLowerCase() === trimmedVal.toLowerCase());
        if (!found) return `El cliente "${trimmedVal}" no existe en la base de datos`;
        return null;
      }
    },
    {
      key: 'servicio',
      label: 'Servicio',
      synonyms: ['servicio', 'service', 'catálogo', 'catalogo', 'tipo de servicio'],
      required: false,
      defaultValue: 'Diseño UI',
      normalize: (val) => val.toString().trim(),
      validate: (val) => {
        if (!val || val.toString().trim().length === 0) return 'El servicio no puede estar totalmente vacío';
        return null;
      }
    },
    {
      key: 'modeloCobro',
      label: 'Modelo de Cobro',
      synonyms: ['modelo de cobro', 'modelo', 'cobro', 'billing model', 'charge model'],
      required: true,
      normalize: (val) => {
        const v = val.toString().toLowerCase().trim();
        if (v.includes('hora') || v.includes('hour')) return 'Por hora';
        if (v.includes('fijo') || v.includes('fixed') || v.includes('precio')) return 'Precio fijo';
        if (v.includes('suscrip') || v.includes('subs') || v.includes('abono') || v.includes('mensual')) return 'Suscripción';
        return 'Precio fijo'; // Default fallback
      },
      validate: (val) => {
        const normalized = val.toString();
        if (normalized !== 'Por hora' && normalized !== 'Precio fijo' && normalized !== 'Suscripción') {
          return "El modelo de cobro debe ser uno de: 'Por hora', 'Precio fijo' o 'Suscripción'";
        }
        return null;
      }
    },
    {
      key: 'tarifa',
      label: 'Tarifa',
      synonyms: ['tarifa', 'rate', 'costo', 'precio', 'monto', 'fee', 'charge'],
      required: false,
      defaultValue: 0,
      normalize: (val) => {
        const clean = val.toString().replace(/[^0-9]/g, '');
        const parsed = parseInt(clean);
        return isNaN(parsed) ? 0 : parsed;
      },
      validate: (val) => {
        const num = Number(val);
        if (isNaN(num) || num < 0) return 'La tarifa debe ser un número entero mayor o igual a 0';
        return null;
      }
    },
    {
      key: 'estado',
      label: 'Estado',
      synonyms: ['estado', 'status', 'fase', 'etapa', 'stage'],
      required: false,
      defaultValue: 'Activo',
      normalize: (val) => {
        const s = val.toString().trim();
        if (!s) return 'Activo';
        return s.slice(0, 1).toUpperCase() + s.slice(1);
      }
    }
  ];

  const handleImportProjects = async (validProjects: any[]) => {
    if (!apiToken) return;
    const headers = { 
      'Authorization': `Bearer ${apiToken}`, 
      'Content-Type': 'application/json' 
    };

    let importedCount = 0;
    for (const proj of validProjects) {
      try {
        const foundClient = clientes.find(c => c.nombre.trim().toLowerCase() === proj.clienteNombre.trim().toLowerCase());
        if (!foundClient) {
          console.error(`Client ${proj.clienteNombre} not found, skipping.`);
          continue;
        }

        let sId = 0;
        const servName = (proj.servicio || '').trim();
        
        // Find existing service or create on the fly
        const matchedService = servicios.find(s => s.nombre.toLowerCase().trim() === servName.toLowerCase());
        if (matchedService) {
          sId = matchedService.id;
        } else if (servName) {
          try {
            const sRes = await fetch('/api/servicios', {
              method: 'POST',
              headers,
              body: JSON.stringify({ nombre: servName })
            });
            if (sRes.ok) {
              const newSrv = await sRes.json();
              servicios.push(newSrv);
              sId = newSrv.id;
            }
          } catch (err) {
            console.error("Error creating service on-the-fly:", err);
          }
        }

        // Default fallback if we still don't have a valid service id
        if (sId === 0) {
          if (servicios.length > 0) {
            sId = servicios[0].id;
          } else {
            try {
              const sRes = await fetch('/api/servicios', {
                method: 'POST',
                headers,
                body: JSON.stringify({ nombre: 'Diseño UI' })
              });
              if (sRes.ok) {
                const newSrv = await sRes.json();
                servicios.push(newSrv);
                sId = newSrv.id;
              }
            } catch (err) {
              console.error("Error seeding emergency fallback service:", err);
            }
          }
        }

        const res = await fetch('/api/proyectos', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            nombre: proj.nombre,
            clienteId: foundClient.id.toString(),
            servicioId: sId.toString(),
            modeloCobro: proj.modeloCobro,
            tarifa: (proj.tarifa || 0).toString(),
            estado: proj.estado || 'Activo'
          })
        });

        if (res.ok) {
          importedCount++;
        } else {
          console.error('Error importing project row:', await res.text());
        }
      } catch (err) {
        console.error('Network error during project import:', err);
      }
    }

    // Refresh data
    await fetchAllData(apiToken);
    alert(`Se han importado exitosamente ${importedCount} de ${validProjects.length} proyectos.`);
  };

  const parseImportDate = (val: any): string => {
    if (!val) return '';
    const str = val.toString().trim();
    // Check if it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    // Check for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Check if it's a number (Excel date code)
    const num = Number(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Try native JS Date parsing
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    return str; // Fallback as-is
  };

  const invoiceColumnConfig: ColumnMapping[] = [
    {
      key: 'clienteNombre',
      label: 'Cliente',
      synonyms: ['clienteNombre', 'cliente', 'client', 'customer', 'empresa', 'razon social', 'razón social'],
      required: true,
      validate: (val) => {
        const trimmedVal = val?.toString().trim();
        if (!trimmedVal) return 'El cliente es obligatorio';
        const found = clientes.some(c => c.nombre.trim().toLowerCase() === trimmedVal.toLowerCase());
        if (!found) return `El cliente "${trimmedVal}" no existe en la base de datos`;
        return null;
      }
    },
    {
      key: 'proyectoNombre',
      label: 'Proyecto',
      synonyms: ['proyectoNombre', 'proyecto', 'project', 'nombre del proyecto'],
      required: false,
      validate: (val, rowContext) => {
        const trimmedVal = val?.toString().trim();
        if (!trimmedVal) return null; // Opcional
        const clientVal = rowContext?.['clienteNombre']?.toString().trim();
        if (!clientVal) return null; // El validador del cliente se encargará

        const foundClient = clientes.find(c => c.nombre.trim().toLowerCase() === clientVal.toLowerCase());
        if (foundClient) {
          const foundProject = proyectos.find(p => 
            p.clienteId === foundClient.id && 
            p.nombre.trim().toLowerCase() === trimmedVal.toLowerCase()
          );
          if (!foundProject) {
            return `El proyecto "${trimmedVal}" no existe para el cliente "${clientVal}"`;
          }
        }
        return null;
      }
    },
    {
      key: 'monto',
      label: 'Monto',
      synonyms: ['monto', 'amount', 'total', 'valor', 'pesos', 'cobro', 'precio'],
      required: true,
      normalize: (val) => {
        const clean = val.toString().replace(/[^0-9]/g, '');
        const parsed = parseInt(clean);
        return isNaN(parsed) ? 0 : parsed;
      },
      validate: (val) => {
        const num = Number(val);
        if (isNaN(num) || num < 0) return 'El monto debe ser un número entero mayor o igual a 0';
        return null;
      }
    },
    {
      key: 'fechaEmision',
      label: 'Fecha Emisión',
      synonyms: ['fecha emision', 'fecha de emision', 'fecha emisión', 'fecha de emisión', 'emision', 'emisión', 'date', 'issue date'],
      required: true,
      normalize: (val) => parseImportDate(val),
      validate: (val) => {
        if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return 'La fecha de emisión debe tener un formato válido (YYYY-MM-DD)';
        }
        return null;
      }
    },
    {
      key: 'fechaOrigenDeuda',
      label: 'Origen de Deuda',
      synonyms: ['origen de deuda', 'origen deuda', 'fecha origen', 'fecha origen deuda', 'deuda desde', 'desde', 'debt date', 'source date'],
      required: false,
      normalize: (val) => {
        if (!val || val.toString().trim() === '') return '';
        return parseImportDate(val);
      },
      validate: (val) => {
        if (val && val.toString().trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return 'La fecha de origen de la deuda debe tener un formato válido (YYYY-MM-DD)';
        }
        return null;
      }
    },
    {
      key: 'estado',
      label: 'Estado',
      synonyms: ['estado', 'status', 'estado de pago', 'pago'],
      required: true,
      normalize: (val) => {
        const v = val.toString().toLowerCase().trim();
        if (v.includes('pag') || v.includes('paid')) return 'pagada';
        if (v.includes('pend') || v.includes('due') || v.includes('unpaid')) return 'pendiente';
        if (v.includes('venc') || v.includes('over') || v.includes('exp')) return 'vencida';
        return 'pendiente';
      },
      validate: (val) => {
        if (val !== 'pagada' && val !== 'pendiente' && val !== 'vencida') {
          return "El estado debe ser uno de: 'Pagada', 'Pendiente' o 'Vencida'";
        }
        return null;
      }
    }
  ];

  const handleImportInvoices = async (validInvoices: any[]) => {
    if (!apiToken) return;
    const headers = { 
      'Authorization': `Bearer ${apiToken}`, 
      'Content-Type': 'application/json' 
    };

    let importedCount = 0;
    for (const inv of validInvoices) {
      try {
        const foundClient = clientes.find(c => c.nombre.trim().toLowerCase() === inv.clienteNombre.trim().toLowerCase());
        if (!foundClient) continue;

        let projId = null;
        if (inv.proyectoNombre) {
          const foundProject = proyectos.find(p => 
            p.clienteId === foundClient.id && 
            p.nombre.trim().toLowerCase() === inv.proyectoNombre.trim().toLowerCase()
          );
          if (foundProject) {
            projId = foundProject.id;
          }
        }

        const fEmision = inv.fechaEmision;
        const fOrigen = (inv.fechaOrigenDeuda && inv.fechaOrigenDeuda.trim() !== '') ? inv.fechaOrigenDeuda : fEmision;

        const res = await fetch('/api/facturas', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            clienteId: foundClient.id.toString(),
            proyectoId: projId ? projId.toString() : null,
            monto: (inv.monto || 0).toString(),
            fechaEmision: fEmision,
            fechaOrigenDeuda: fOrigen,
            estado: inv.estado || 'pendiente'
          })
        });

        if (res.ok) {
          importedCount++;
        } else {
          console.error('Error importing invoice row:', await res.text());
        }
      } catch (err) {
        console.error('Network error during invoice import:', err);
      }
    }

    // Refresh data
    await fetchAllData(apiToken);
    alert(`Se han importado exitosamente ${importedCount} de ${validInvoices.length} facturas.`);
  };

  const sessionColumnConfig: ColumnMapping[] = [
    {
      key: 'proyectoNombre',
      label: 'Proyecto',
      synonyms: ['proyectoNombre', 'proyecto', 'project', 'nombre de proyecto', 'nombre del proyecto'],
      required: true,
      validate: (val) => {
        const trimmedVal = val?.toString().trim();
        if (!trimmedVal) return 'El proyecto es obligatorio';
        const found = proyectos.some(p => p.nombre.trim().toLowerCase() === trimmedVal.toLowerCase());
        if (!found) return `El proyecto "${trimmedVal}" no existe en la base de datos`;
        return null;
      }
    },
    {
      key: 'duracionHoras',
      label: 'Duración (Horas)',
      synonyms: ['duración (horas)', 'duracion (horas)', 'duracion horas', 'duración horas', 'duración', 'duracion', 'hours', 'hour', 'tiempo', 'time', 'duration', 'horas'],
      required: true,
      normalize: (val) => {
        const parsed = parseFloat(val.toString().trim().replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
      },
      validate: (val) => {
        const num = Number(val);
        if (isNaN(num) || num <= 0) return 'La duración debe ser un número mayor a 0 (ej. 1.5)';
        return null;
      }
    },
    {
      key: 'facturable',
      label: 'Facturable',
      synonyms: ['facturable', 'billable', 'es facturable', 'es_facturable', 'cobrar'],
      required: true,
      normalize: (val) => {
        const v = val.toString().toLowerCase().trim();
        if (v === 'sí' || v === 'si' || v === 'yes' || v === 'y' || v === 's' || v === 'facturable' || v === 'true' || v === '1' || v === 'verdadero') {
          return 'Sí';
        }
        return 'No';
      },
      validate: (val) => {
        const normalized = val.toString();
        if (normalized !== 'Sí' && normalized !== 'No') {
          return "Debe indicar si es facturable ('Sí' o 'No')";
        }
        return null;
      }
    },
    {
      key: 'fecha',
      label: 'Fecha',
      synonyms: ['fecha', 'date', 'día', 'dia', 'fecha de la sesión', 'fecha de la sesion', 'fecha sesión', 'fecha sesion'],
      required: true,
      normalize: (val) => parseImportDate(val),
      validate: (val) => {
        if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return 'La fecha debe tener un formato válido (YYYY-MM-DD o similar)';
        }
        return null;
      }
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      synonyms: ['descripción', 'descripcion', 'description', 'detalle', 'notas', 'nota', 'comentario', 'comentarios'],
      required: false,
      defaultValue: '',
      normalize: (val) => val.toString().trim()
    }
  ];

  const handleImportSessions = async (validSessions: any[]) => {
    if (!apiToken) return;
    const headers = { 
      'Authorization': `Bearer ${apiToken}`, 
      'Content-Type': 'application/json' 
    };

    let importedCount = 0;
    for (const sess of validSessions) {
      try {
        const foundProject = proyectos.find(p => p.nombre.trim().toLowerCase() === sess.proyectoNombre.trim().toLowerCase());
        if (!foundProject) continue;

        const duracionSegundos = Math.round((sess.duracionHoras || 0) * 3600);
        const facturableBool = sess.facturable === 'Sí';

        const res = await fetch('/api/sesiones', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            proyectoId: foundProject.id,
            facturable: facturableBool,
            duracion: duracionSegundos,
            fecha: sess.fecha,
            descripcion: sess.descripcion || ''
          })
        });

        if (res.ok) {
          importedCount++;
        } else {
          console.error('Error importing session row:', await res.text());
        }
      } catch (err) {
        console.error('Network error during session import:', err);
      }
    }

    // Refresh data
    await fetchAllData(apiToken);
    alert(`Se han importado exitosamente ${importedCount} de ${validSessions.length} sesiones de tiempo.`);
  };

  const handleResetData = () => {
    setDeleteConfirm({
      show: true,
      type: 'reset',
      id: -1,
      message: '¿Estás seguro de que deseas continuar? Esto eliminará todos los datos de forma permanente y dejará la app como recién instalada.'
    });
  };

  const handleEditClient = (cli: Client) => {
    setEditingClient(cli);
    setClientForm({ nombre: cli.nombre, contacto: cli.contacto, tipo: cli.tipo });
    setShowClientModal(true);
  };

  const handleDeleteClient = (id: number) => {
    setDeleteConfirm({
      show: true,
      type: 'client',
      id,
      message: '¿Estás seguro de que quieres eliminar esto?'
    });
  };

  const executeDeleteClient = async (id: number) => {
    if (!apiToken) return;
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      if (res.ok) {
        setClientes(prev => prev.filter(c => c.id !== id));
        fetchAllData(apiToken);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom Service Catalogue Creation helper
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !apiToken) return;
    try {
      const res = await fetch('/api/servicios', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiToken}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ nombre: newServiceName, descripcion: newServiceDesc })
      });
      if (res.ok) {
        const fresh = await res.json();
        setServicios(prev => [fresh, ...prev]);
        setNewServiceName('');
        setNewServiceDesc('');
        setShowServiceForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Project CRUD
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiToken) return;
    if (!projectForm.clienteId || !projectForm.servicioId) {
      alert('Debes seleccionar un cliente y un catálogo de servicio.');
      return;
    }
    try {
      const headers = { 
        'Authorization': `Bearer ${apiToken}`, 
        'Content-Type': 'application/json' 
      };

      if (editingProject) {
        const res = await fetch(`/api/proyectos/${editingProject.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(projectForm)
        });
        if (res.ok) {
          setShowProjectModal(false);
          setEditingProject(null);
          fetchAllData(apiToken);
        }
      } else {
        const res = await fetch('/api/proyectos', {
          method: 'POST',
          headers,
          body: JSON.stringify(projectForm)
        });
        if (res.ok) {
          setShowProjectModal(false);
          fetchAllData(apiToken);
        }
      }
      setProjectForm(prev => ({ ...prev, nombre: '', tarifa: '25000' }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditProject = (proj: Project) => {
    setEditingProject(proj);
    setProjectForm({
      nombre: proj.nombre,
      clienteId: proj.clienteId.toString(),
      servicioId: proj.servicioId.toString(),
      modeloCobro: proj.modeloCobro,
      tarifa: proj.tarifa.toString(),
      estado: proj.estado
    });
    setShowProjectModal(true);
  };

  const handleDeleteProject = (id: number) => {
    setDeleteConfirm({
      show: true,
      type: 'project',
      id,
      message: '¿Estás seguro de que quieres eliminar esto?'
    });
  };

  const executeDeleteProject = async (id: number) => {
    if (!apiToken) return;
    try {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      if (res.ok) {
        setProyectos(prev => prev.filter(p => p.id !== id));
        fetchAllData(apiToken);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Invoice CRUD
  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiToken) return;
    if (!invoiceForm.clienteId) {
      alert('Debe seleccionar un cliente.');
      return;
    }
    try {
      const headers = { 
        'Authorization': `Bearer ${apiToken}`, 
        'Content-Type': 'application/json' 
      };

      const payload = {
        ...invoiceForm,
        proyectoId: invoiceForm.proyectoId ? parseInt(invoiceForm.proyectoId) : null
      };

      if (editingInvoice) {
        const res = await fetch(`/api/facturas/${editingInvoice.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setShowInvoiceModal(false);
          setEditingInvoice(null);
          fetchAllData(apiToken);
        }
      } else {
        const res = await fetch('/api/facturas', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setShowInvoiceModal(false);
          fetchAllData(apiToken);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditInvoiceStatus = async (fac: Invoice, newState: string) => {
    if (!apiToken) return;
    try {
      const res = await fetch(`/api/facturas/${fac.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${apiToken}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ estado: newState })
      });
      if (res.ok) {
        setFacturas(prev => prev.map(f => f.id === fac.id ? { ...f, estado: newState } : f));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteInvoice = (id: number) => {
    setDeleteConfirm({
      show: true,
      type: 'invoice',
      id,
      message: '¿Estás seguro de que quieres eliminar esto?'
    });
  };

  const executeDeleteInvoice = async (id: number) => {
    if (!apiToken) return;
    try {
      const res = await fetch(`/api/facturas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      if (res.ok) {
        setFacturas(prev => prev.filter(f => f.id !== id));
        fetchAllData(apiToken);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Timer Session CRUD
  const handleSaveTimeSession = async (sessionData: {
    proyectoId: number;
    facturable: boolean;
    duracion: number;
    fecha: string;
    descripcion: string;
  }) => {
    if (!apiToken) return;
    try {
      const res = await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiToken}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(sessionData)
      });
      if (res.ok) {
        fetchAllData(apiToken);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSession = (id: number) => {
    setDeleteConfirm({
      show: true,
      type: 'session',
      id,
      message: '¿Estás seguro de que quieres eliminar esto?'
    });
  };

  const executeDeleteSession = async (id: number) => {
    if (!apiToken) return;
    try {
      const res = await fetch(`/api/sesiones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      if (res.ok) {
        setSesiones(prev => prev.filter(s => s.id !== id));
        fetchAllData(apiToken);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executeResetData = async () => {
    if (!apiToken) return;
    try {
      const res = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiToken}`, 
          'Content-Type': 'application/json' 
        }
      });
      if (res.ok) {
        setClientes([]);
        setProyectos([]);
        setServicios([]);
        setSesiones([]);
        setFacturas([]);
        alert('Toda la información ha sido eliminada. La aplicación ha quedado limpia.');
      } else {
        alert('Ocurrió un error al intentar reiniciar los datos.');
      }
    } catch (err) {
      console.error('Error resetting data:', err);
      alert('Error de conexión al reiniciar los datos.');
    }
  };


  // ---------------- FINANCE METRICS / MATH ----------------

  // Total Invoiced overall (Sum of all invoices except maybe we classify into Paid, Pending, Overdue)
  const totalFacturadoSum = facturas.reduce((sum, f) => sum + f.monto, 0);
  const totalPagadoSum = facturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.monto, 0);
  const totalPendienteSum = facturas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + f.monto, 0);
  const totalVencidoSum = facturas.filter(f => f.estado === 'vencida').reduce((sum, f) => sum + f.monto, 0);

  // Time logging calculations for EHR
  // EHR (Effective Hourly Rate) = total ingresos / (total horas facturables + no facturables)
  const totalSecondsLogged = sesiones.reduce((sum, s) => sum + s.duracion, 0);
  const totalHoursLogged = totalSecondsLogged / 3600;

  // EHR: Let's calculate EHR dynamically. It uses (Ingresos Totales / Total Horas). 
  // Here, let's treat "Ingresos Totales" as our Total Facturado, or the sum of all invoices.
  const dynamicEHR = totalHoursLogged > 0 ? (totalFacturadoSum / totalHoursLogged) : 25000;

  // Render ranking of clients by revenue
  const getClientRanking = () => {
    const clientsData: { 
      [key: number]: { 
        id: number; 
        nombre: string; 
        ingresos: number; 
        segundos: number;
        segundosFacturables: number;
        segundosNoFacturables: number;
      } 
    } = {};
    
    // Initialize
    clientes.forEach(c => {
      clientsData[c.id] = { 
        id: c.id, 
        nombre: c.nombre, 
        ingresos: 0, 
        segundos: 0,
        segundosFacturables: 0,
        segundosNoFacturables: 0
      };
    });

    // Sum invoices
    facturas.forEach(f => {
      if (clientsData[f.clienteId]) {
        clientsData[f.clienteId].ingresos += f.monto;
      }
    });

    // Sum timer seconds
    sesiones.forEach(s => {
      let clientID = s.proyecto?.clienteId;
      if (!clientID && s.proyectoId) {
        const proj = proyectos.find(p => p.id === s.proyectoId);
        if (proj) {
          clientID = proj.clienteId;
        }
      }
      
      if (clientID && clientsData[clientID]) {
        clientsData[clientID].segundos += s.duracion;
        if (s.facturable) {
          clientsData[clientID].segundosFacturables += s.duracion;
        } else {
          clientsData[clientID].segundosNoFacturables += s.duracion;
        }
      }
    });

    return Object.values(clientsData).sort((a, b) => b.ingresos - a.ingresos);
  };

  const clientRanking = getClientRanking();


  // ---------------- HELPERS / RENDERING ----------------

  const formatCLP = (amount: number) => {
    return '$' + Math.round(amount).toLocaleString('es-CL');
  };

  const formatHours = (secs: number) => {
    const hrs = Math.round((secs / 3600) * 10) / 10;
    return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
  };

  if (loadingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fbf9f8]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#E8602C] animate-spin" />
          <p className="text-[#78767d] text-sm font-semibold">Cargando espacio Lúcida...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <div className="bg-[#FDFCFB] text-slate-800 min-h-screen pb-[120px] font-sans">
      {/* TopAppBar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[820px] mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-extrabold text-lg select-none border border-slate-200 shadow-xs">
              {currentUser.displayName ? currentUser.displayName[0] : 'L'}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">LÚCIDA</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-1 leading-none">Freelance Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetData}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Borrar todos los datos y empezar de cero"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Empezar de cero</span>
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[820px] mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Tab Selector - Desktop Navigation (Hidden on mobile) */}
        <div className="hidden md:flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              currentTab === 'dashboard' 
                ? 'bg-slate-904 bg-slate-900 text-white' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentTab('proyectos')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              currentTab === 'proyectos' 
                ? 'bg-slate-904 bg-slate-900 text-white' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Proyectos
          </button>
          <button
            onClick={() => setCurrentTab('clientes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              currentTab === 'clientes' 
                ? 'bg-slate-904 bg-slate-900 text-white' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Clientes
          </button>
          <button
            onClick={() => setCurrentTab('facturas')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              currentTab === 'facturas' 
                ? 'bg-slate-904 bg-slate-900 text-white' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Facturas
          </button>
          <button
            onClick={() => setCurrentTab('sesiones')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
              currentTab === 'sesiones' 
                ? 'bg-slate-904 bg-slate-900 text-white' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Timer className="w-4 h-4" />
            Bitácora
          </button>
        </div>

        {/* Seed helper for demo account (Always available) */}
        {!loadingData && (
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs">
            <div>
              <h4 className="font-extrabold text-indigo-900 text-sm">
                {clientes.length === 0 ? '¡Te damos la bienvenida a Lúcida!' : '¿Quieres restablecer la demostración?'}
              </h4>
              <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">
                {clientes.length === 0 
                  ? 'Para ver en acción el control de rentabilidad de Lúcida, EHR y bitácora con cronómetros, inicializa los datos de demostración.'
                  : 'Puedes volver a cargar los datos de demostración limpios en cualquier momento para reiniciar tu entorno de prueba de forma consistente.'}
              </p>
            </div>
            <button
              onClick={handleLoadDemoData}
              className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wide transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Cargar datos demo
            </button>
          </div>
        )}

        {/* Global spinner while loading data */}
        {loadingData && (
          <div className="bg-white border border-slate-200 p-3.5 text-center rounded-xl text-xs font-semibold text-slate-500 animate-pulse shadow-xs">
            Sincronizando información Lúcida con la nube...
          </div>
        )}

        {/* ---------------- 1. TAB: DASHBOARD ---------------- */}
        {currentTab === 'dashboard' && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
                Dashboard Financiero
              </h2>
              <p className="text-sm text-slate-500">Control en tiempo real de rentabilidad, cobros y facturación (CLP).</p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Total Facturado (Mes) */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Facturado (Mes)</p>
                <div className="flex items-baseline gap-2 mt-4">
                  <h2 className="text-3xl font-extrabold text-slate-900">{formatCLP(totalFacturadoSum)}</h2>
                  <span className="text-emerald-500 text-xs font-bold">100% emitido</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-6">
                  <div className="h-full bg-indigo-500" style={{ width: totalFacturadoSum > 0 ? '75%' : '0%' }}></div>
                </div>
              </div>

              {/* Card 2: Total por Cobrar */}
              <div className="bg-white p-6 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total por Cobrar</p>
                <div className="flex flex-col justify-between mt-4">
                  <h2 className="text-3xl font-extrabold text-slate-900">{formatCLP(totalPendienteSum + totalVencidoSum)}</h2>
                  <div className="flex space-x-3 mt-4 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Pendiente: {formatCLP(totalPendienteSum)}</span>
                    <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded">Vencido: {formatCLP(totalVencidoSum)}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Tarifa Efectiva (EHR) */}
              <div className="bg-slate-900 p-6 rounded-2xl flex flex-col justify-between text-white shadow-sm relative overflow-hidden">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-white/10 rounded-full pointer-events-none transform rotate-45"></div>
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Tarifa Efectiva (EHR)</p>
                <div className="flex items-baseline gap-1 mt-4">
                  <h2 className="text-3xl font-extrabold text-white">{formatCLP(dynamicEHR)}</h2>
                  <span className="text-white/70 text-xs font-semibold">/ hr</span>
                </div>
                <p className="text-[10px] text-white/40 italic mt-6">Meta de rentabilidad: $25.000 / hr</p>
              </div>

            </div>

            {/* Formula Detail Accordion Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                Eficiencia Operativa Real de Lúcida
              </h4>
              <p className="text-xs text-slate-500 font-mono leading-relaxed">
                Fórmula de eficiencia: EHR = Ingresos Totales ({formatCLP(totalFacturadoSum)}) ÷ (Horas Facturables + Apoyo ({totalHoursLogged.toFixed(1)} hrs)). 
                Permite auditar el rendimiento efectivo versus nominal.
              </p>
            </div>

            {/* Rankings & Insights Bento Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Rank list */}
              <div className="col-span-12 md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-slate-900 tracking-tight text-base">Ranking Clientes por Ingresos</h3>
                    <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Reporte Lúcida</span>
                  </div>

                  <div className="space-y-1">
                    {clientRanking.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No hay clientes suficientes para calcular rankings.</p>
                    ) : (
                      (() => {
                        const maxIngresos = Math.max(...clientRanking.map(r => r.ingresos), 1);
                        return clientRanking.slice(0, 5).map((rank, idx) => {
                          const barWidth = `${Math.min(100, Math.max(12, (rank.ingresos / maxIngresos) * 100))}%`;
                          const formattedRank = (idx + 1).toString().padStart(2, '0');
                          return (
                            <div key={rank.id || idx} className="flex items-center justify-between text-sm border-b border-slate-100 py-2.5 last:border-0 min-h-[64px]">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-slate-300 font-extrabold text-xs">{formattedRank}</span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-slate-800 block truncate text-sm">{rank.nombre}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">Ingresos acumulados</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="font-mono font-bold text-slate-950 text-right text-sm">{formatCLP(rank.ingresos)}</span>
                                <div className="hidden sm:block w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: barWidth }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Right Client time consumption */}
              <div className="col-span-12 md:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-extrabold text-slate-900 tracking-tight text-base">Horas Consumidas por Cliente</h3>
                    <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Bitácora</span>
                  </div>
                  
                  <div className="space-y-1">
                    {clientRanking.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">Registra horas usando nuestro cronómetro.</p>
                    ) : (
                      (() => {
                        const clientsByHours = [...clientRanking].sort((a, b) => b.segundos - a.segundos);
                        return clientsByHours.slice(0, 5).map((rank) => {
                          const originalClient = clientes.find(c => c.id === rank.id);
                          
                          const totalHours = rank.segundos / 3600;
                          const billableHours = (rank.segundosFacturables || 1) / 3600;
                          const nonBillableHours = (rank.segundosNoFacturables || 0) / 3600;
                          
                          const pctBillable = totalHours > 0 ? (billableHours / totalHours) * 100 : 100;
                          const tarifaEfectiva = totalHours > 0 ? rank.ingresos / totalHours : 0;
                          
                          let statusLabel = '✓ Rentable';
                          let statusClass = 'text-emerald-600';
                          
                          if (totalHours > 0) {
                            if (pctBillable < 60 || nonBillableHours > 12 || (rank.segundos > 10 * 3600 && tarifaEfectiva < 15000)) {
                              statusLabel = '⚠️ Rentabilidad Baja';
                              statusClass = 'text-rose-600';
                            } else if (pctBillable < 85 || nonBillableHours > 5) {
                              statusLabel = '⚠️ Rentabilidad Media';
                              statusClass = 'text-amber-600';
                            }
                          } else {
                            statusLabel = '✓ Sin horas';
                            statusClass = 'text-slate-400';
                          }
                          
                          return (
                            <div key={rank.id} className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0 min-h-[64px]">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{rank.nombre}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  Cuota: {originalClient?.tipo || 'Fijo'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-mono font-bold text-slate-700 text-sm">{formatHours(rank.segundos)}</p>
                                <p className={`text-[10px] font-extrabold ${statusClass}`}>
                                  {statusLabel}
                                </p>
                                {totalHours > 0 && (
                                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    Ef: {formatCLP(tarifaEfectiva)}/h • {Math.round(pctBillable)}% Fac
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ---------------- 2. TAB: PROYECTOS ---------------- */}
        {currentTab === 'proyectos' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
                  Gestión de Proyectos
                </h2>
                <p className="text-slate-400 text-xs mt-1">Vincula clientes fijos con modelos de cobro y presupuestos (CLP).</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportProjectModal(true)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title="Importar Proyectos"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importar desde Excel</span>
                </button>
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setProjectForm({
                      nombre: '',
                      clienteId: clientes[0]?.id.toString() || '',
                      servicioId: servicios[0]?.id.toString() || '',
                      modeloCobro: 'Por hora',
                      tarifa: '25000',
                      estado: 'Activo'
                    });
                    setShowProjectModal(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Nuevo Proyecto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Proyecto</span>
                </button>
              </div>
            </div>

            {/* Catalog Helper block */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Catálogo de Servicios</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Define tus especialidades (Ej: Mantenimiento, Branding, UI/UX) para aplicarlas a proyectos.</p>
              </div>
              <button
                onClick={() => setShowServiceForm(!showServiceForm)}
                className="text-xs font-bold text-indigo-600 border border-slate-250 bg-white rounded-lg px-3.5 py-2 hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                {showServiceForm ? 'Ocultar catálogo' : 'Expandir servicios'}
              </button>
            </div>

            {showServiceForm && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-xs">
                <h4 className="font-bold text-sm text-slate-900">Servicios Ofrecidos</h4>
                <ul className="text-xs text-slate-650 list-disc pl-5 flex flex-col gap-1.5">
                  {servicios.map(s => (
                    <li key={s.id}>
                      <span className="font-bold text-slate-900">{s.nombre}</span>: {s.descripcion || 'Sin descripción.'}
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleServiceSubmit} className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="Nuevo Servicio (Ej. Diseño de Packaging...)"
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 focus:border-indigo-600 outline-hidden"
                    required
                  />
                  <input
                    type="text"
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    placeholder="Breve descripción..."
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 focus:border-indigo-600 outline-hidden"
                  />
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg cursor-pointer">
                    Agregar
                  </button>
                </form>
              </div>
            )}

            {/* Projects list */}
            <div className="grid grid-cols-1 gap-4">
              {proyectos.length === 0 ? (
                <div className="bg-white border border-slate-200 text-center p-12 text-slate-400 rounded-2xl shadow-xs">
                  No tienes proyectos creados. Haz clic en 'Crear Proyecto' arriba para registrar uno nuevo.
                </div>
              ) : (
                proyectos.map(p => (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between gap-5 hover:border-slate-350 hover:shadow-xs transition-all duration-200">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.estado === 'Activo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                        <h3 className="font-bold text-lg text-slate-905">{p.nombre}</h3>
                      </div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 leading-none">
                        <Users className="w-4 h-4 text-slate-400" /> Cliente: {p.cliente?.nombre || 'Desconocido'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Especialidad: <span className="font-bold bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 ml-1 text-slate-700">{p.servicio?.nombre || 'General'}</span>
                      </p>
                    </div>
                    {/* Tarification details / Action */}
                    <div className="flex sm:flex-col justify-between items-end gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-widest">Modelo / Tarifa</span>
                        <span className="font-black text-slate-900 text-md">
                          {p.modeloCobro} ({formatCLP(p.tarifa)}{p.modeloCobro === 'Por hora' ? '/hr' : ''})
                        </span>
                      </div>
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => handleEditProject(p)}
                          className="p-2 rounded-lg hover:bg-slate-50 border border-slate-200 text-slate-500 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="p-2 rounded-lg hover:bg-rose-50 border border-rose-100 text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------------- 3. TAB: CLIENTES ---------------- */}
        {currentTab === 'clientes' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
                  Mis Clientes
                </h2>
                <p className="text-slate-400 text-xs mt-1">Lleva control de datos de contacto de clientes recurrentes o esporádicos.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportClientModal(true)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title="Importar Clientes"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importar desde Excel</span>
                </button>
                <button
                  onClick={() => {
                    setEditingClient(null);
                    setClientForm({ nombre: '', contacto: '', tipo: 'Fijo' });
                    setShowClientModal(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Nuevo Cliente"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Cliente</span>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {clientes.length === 0 ? (
                <div className="bg-white border border-slate-200 text-center p-12 text-slate-400 rounded-2xl col-span-2 shadow-xs">
                  No tienes clientes configurados. Presiona 'Agregar Cliente' arriba para iniciar.
                </div>
              ) : (
                clientes.map(c => {
                  // Count projects
                  const clientProjs = proyectos.filter(p => p.clienteId === c.id);
                  return (
                    <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-350 hover:shadow-xs transition-all duration-200">
                      <div className="mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">{c.nombre}</h3>
                          <span className="text-xs bg-indigo-50 font-bold text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                            {c.tipo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-mono break-all bg-slate-50 p-2 rounded-md border border-slate-100">{c.contacto}</p>
                        <p className="text-xs text-slate-450 mt-3.5 flex items-center gap-1.5 font-semibold">
                          <Briefcase className="w-3.5 h-3.5 text-indigo-500" /> {clientProjs.length} {clientProjs.length === 1 ? 'proyecto asociado' : 'proyectos asociados'}
                        </p>
                      </div>
                      <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
                        <button
                          onClick={() => handleEditClient(c)}
                          className="flex-1 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeleteClient(c.id)}
                          className="py-1.5 px-3 rounded-lg hover:bg-rose-50 border border-rose-100 text-rose-500 text-xs font-bold cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ---------------- 4. TAB: FACTURAS ---------------- */}
        {currentTab === 'facturas' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
                  Gestión de Facturas
                </h2>
                <p className="text-slate-400 text-xs mt-1">Suma ingresos y vigila el estado de pago de cada entrega.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportInvoiceModal(true)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title="Importar Facturas desde Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importar desde Excel</span>
                </button>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setInvoiceForm({
                      clienteId: clientes[0]?.id.toString() || '',
                      proyectoId: proyectos[0]?.id.toString() || '',
                      monto: '200000',
                      fechaEmision: new Date().toISOString().split('T')[0],
                      fechaOrigenDeuda: new Date().toISOString().split('T')[0],
                      estado: 'pendiente'
                    });
                    setShowInvoiceModal(true);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  title="Emitir Factura"
                >
                  <Plus className="w-4 h-4" />
                  <span>Emitir Factura</span>
                </button>
              </div>
            </div>

            {/* Invoices overall stats mini grid */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-xs">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pagado</span>
                <span className="block text-lg font-black text-emerald-600 mt-1">{formatCLP(totalPagadoSum)}</span>
              </div>
              <div className="text-center border-x border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pendiente</span>
                <span className="block text-lg font-black text-amber-600 mt-1">{formatCLP(totalPendienteSum)}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vencido</span>
                <span className="block text-lg font-black text-rose-600 mt-1">{formatCLP(totalVencidoSum)}</span>
              </div>
            </div>

            {/* Invoices list */}
            <div className="flex flex-col gap-4">
              {facturas.length === 0 ? (
                <div className="bg-white border border-slate-200 text-center p-12 text-slate-400 rounded-2xl shadow-xs">
                  No has registrado ninguna factura. Presiona 'Emitir Factura' arriba para agregar la primera.
                </div>
              ) : (
                facturas.map(f => {
                  const stateColors: { [key: string]: string } = {
                    pagada: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    pendiente: 'bg-amber-50 text-amber-700 border-amber-100',
                    vencida: 'bg-rose-50 text-rose-700 border-rose-100',
                  };

                  return (
                    <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-5 hover:border-slate-350 hover:shadow-xs transition-all duration-200">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${stateColors[f.estado]}`}>
                            {f.estado}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">Factura #{f.id.toString().substring(0, 6)}</span>
                        </div>
                        <h4 className="font-extrabold text-lg text-slate-900 mt-1">{f.cliente?.nombre}</h4>
                        {f.proyecto && (
                          <p className="text-xs text-slate-600 flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md self-start font-semibold">
                            Proyecto: {f.proyecto.nombre}
                          </p>
                        )}
                        <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 mt-1 font-mono">
                          <span>Emisión: {f.fechaEmision}</span>
                          <span>Origen: {f.fechaOrigenDeuda}</span>
                        </div>
                      </div>

                      <div className="flex md:flex-col justify-between items-end gap-3 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono tracking-widest">Monto Total CLP</span>
                          <span className="text-xl font-black text-slate-900">{formatCLP(f.monto)}</span>
                        </div>

                        {/* Status toggles & actions */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                            <button
                              onClick={() => handleEditInvoiceStatus(f, 'pagada')}
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                f.estado === 'pagada' ? 'bg-[#10b981] text-white shadow-xs' : 'text-slate-500 hover:text-slate-805'
                              }`}
                            >
                              Pagada
                            </button>
                            <button
                              onClick={() => handleEditInvoiceStatus(f, 'pendiente')}
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                f.estado === 'pendiente' ? 'bg-[#f59e0b] text-white shadow-xs' : 'text-slate-500 hover:text-slate-805'
                              }`}
                            >
                              Pendiente
                            </button>
                            <button
                              onClick={() => handleEditInvoiceStatus(f, 'vencida')}
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors cursor-pointer ${
                                f.estado === 'vencida' ? 'bg-[#f43f5e] text-white shadow-xs' : 'text-slate-500 hover:text-slate-805'
                              }`}
                            >
                              Vencida
                            </button>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteInvoice(f.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 border border-rose-100 text-rose-500 cursor-pointer"
                            title="Eliminar Factura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ---------------- 5. TAB: SESIONES (BITÁCORA) ---------------- */}
        {currentTab === 'sesiones' && (
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
                  Bitácora de Tiempos
                </h2>
                <p className="text-slate-400 text-xs mt-1">Historial del cronómetro Lúcida. Suma horas facturables y de apoyo.</p>
              </div>
              <div>
                <button
                  onClick={() => setShowImportSessionModal(true)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-all cursor-pointer"
                  title="Importar Sesiones de Tiempo desde Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Importar desde Excel</span>
                </button>
              </div>
            </div>

            {/* Overall sum summary stats */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl flex justify-between items-center shadow-xs">
              <div>
                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Total Acumulado</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{formatHours(totalSecondsLogged)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Sesiones Registradas</span>
                <span className="text-lg font-bold text-indigo-600 mt-1 block">{sesiones.length} sesiones</span>
              </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-4">
              {sesiones.length === 0 ? (
                <div className="bg-white border border-slate-200 text-center p-12 text-slate-400 rounded-2xl shadow-xs">
                  No has registrado sesiones de tiempo aún. Usa el cronómetro flotante de Lúcida en el centro inferior para registrar tu actividad.
                </div>
              ) : (
                sesiones.map(s => (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-5 hover:border-slate-350 hover:shadow-xs transition-all duration-200">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          s.facturable 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {s.facturable ? 'FACTURABLE' : 'APOYO'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{s.fecha}</span>
                      </div>
                      <h4 className="font-bold text-slate-905 text-base mt-2">{s.proyecto ? s.proyecto.nombre : 'Proyecto Eliminado'}</h4>
                      <p className="text-xs text-slate-405 font-bold text-slate-400">Cliente: {s.proyecto?.cliente?.nombre || 'General'}</p>
                      {s.descripcion && (
                        <p className="text-xs text-slate-600 italic mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 inline-block font-medium leading-relaxed">
                          "{s.descripcion}"
                        </p>
                      )}
                    </div>

                    <div className="flex sm:flex-col justify-between items-end gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-mono tracking-widest uppercase">DURACIÓN</span>
                        <span className="font-mono font-bold text-lg text-slate-900">{formatHours(s.duracion)}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 border border-transparent hover:border-rose-100 mt-auto transition-colors cursor-pointer"
                        title="Eliminar Registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Floating Client Timer Setup */}
      <ClientTimer 
        projects={proyectos} 
        onSaveSession={handleSaveTimeSession} 
      />

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center bg-white border-t border-slate-200 py-3 md:hidden px-2 shadow-lg">
        {/* Tab: Dashboard */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 transition-all py-1.5 rounded-xl cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-indigo-600 bg-indigo-50/75 font-extrabold scale-100'
              : 'text-slate-400 hover:text-indigo-600'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1">Dashboard</span>
        </button>

        {/* Tab: Proyectos */}
        <button
          onClick={() => setCurrentTab('proyectos')}
          className={`flex flex-col items-center justify-center flex-1 transition-all py-1.5 rounded-xl cursor-pointer ${
            currentTab === 'proyectos'
              ? 'text-indigo-600 bg-indigo-50/75 font-extrabold scale-100'
              : 'text-slate-400 hover:text-indigo-600'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1">Proyectos</span>
        </button>

        {/* Spacer for FAB centering safety margin */}
        <div className="w-16"></div>

        {/* Tab: Clientes */}
        <button
          onClick={() => setCurrentTab('clientes')}
          className={`flex flex-col items-center justify-center flex-1 transition-all py-1.5 rounded-xl cursor-pointer ${
            currentTab === 'clientes'
              ? 'text-indigo-600 bg-indigo-50/75 font-extrabold scale-100'
              : 'text-slate-400 hover:text-indigo-600'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1">Clientes</span>
        </button>

        {/* Tab: Facturas */}
        <button
          onClick={() => setCurrentTab('facturas')}
          className={`flex flex-col items-center justify-center flex-1 transition-all py-1.5 rounded-xl cursor-pointer ${
            currentTab === 'facturas'
              ? 'text-indigo-600 bg-indigo-50/75 font-extrabold scale-100'
              : 'text-slate-400 hover:text-indigo-600'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1">Facturas</span>
        </button>
      </nav>

      {/* ---------------- DELETION CONFIRMATION MODAL ---------------- */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] border border-slate-200 rounded-2xl overflow-hidden w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-rose-600 text-white p-5 font-bold tracking-tight text-lg flex items-center gap-2">
              {deleteConfirm.type === 'reset' ? (
                <>
                  <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin-slow" />
                  <span>Reiniciar Lúcida</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 flex-shrink-0" />
                  <span>Confirmar Eliminación</span>
                </>
              )}
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-slate-800">
                {deleteConfirm.message}
              </p>
              
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 p-3.5 rounded-xl leading-relaxed">
                {deleteConfirm.type === 'client' && (
                  <span>
                    <strong>Impacto en Cascada:</strong> Al eliminar este cliente, también se eliminarán de forma segura todos sus proyectos, facturas emitidas y sesiones de tiempo registradas en la base de datos SQL para mantener la integridad relacional de la aplicación.
                  </span>
                )}
                {deleteConfirm.type === 'project' && (
                  <span>
                    <strong>Impacto en Cascada:</strong> Al eliminar este proyecto, se borrarán todos sus registros de tiempo y facturas relacionadas asociadas en la base de datos SQL.
                  </span>
                )}
                {deleteConfirm.type === 'invoice' && (
                  <span>
                    Esta factura se eliminará permanentemente de la base de datos SQL.
                  </span>
                )}
                {deleteConfirm.type === 'session' && (
                  <span>
                    Este registro de tiempo y las horas contabilizadas se eliminarán permanentemente de la base de datos SQL.
                  </span>
                )}
                {deleteConfirm.type === 'reset' && (
                  <span>
                    <strong>Impacto Total:</strong> Se eliminarán de forma definitiva todos tus clientes, proyectos, servicios, facturas y sesiones de tiempo de la base de datos para habilitar una demostración limpia. Esta acción es irreversible.
                  </span>
                )}
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(prev => ({ ...prev, show: false }))}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { type, id } = deleteConfirm;
                    setDeleteConfirm(prev => ({ ...prev, show: false }));
                    if (id !== null) {
                      if (type === 'client') {
                        await executeDeleteClient(id);
                      } else if (type === 'project') {
                        await executeDeleteProject(id);
                      } else if (type === 'invoice') {
                        await executeDeleteInvoice(id);
                      } else if (type === 'session') {
                        await executeDeleteSession(id);
                      } else if (type === 'reset') {
                        await executeResetData();
                      }
                    }
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all duration-200"
                >
                  {deleteConfirm.type === 'reset' ? 'Empezar de cero' : 'Eliminar permanentemente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ---------------- CLIENT IMPORT MODAL ---------------- */}
      <ExcelImporter
        isOpen={showImportClientModal}
        onClose={() => setShowImportClientModal(false)}
        title="Importar Clientes desde Excel"
        subtitle="Sube tu planilla de clientes (.xlsx o .csv) para cargarlos de una vez en Lúcida"
        columnConfig={clientColumnConfig}
        onImport={handleImportClients}
        sampleColumnsMessage="Tu planilla debe contener columnas correspondientes a: Nombre de Cliente, Información de Contacto y Tipo de Cliente (Fijo o Esporádico)."
      />

      {/* ---------------- PROJECT IMPORT MODAL ---------------- */}
      <ExcelImporter
        isOpen={showImportProjectModal}
        onClose={() => setShowImportProjectModal(false)}
        title="Importar Proyectos desde Excel"
        subtitle="Sube tu planilla de proyectos (.xlsx o .csv) para cargarlos de una vez en Lúcida"
        columnConfig={projectColumnConfig}
        onImport={handleImportProjects}
        sampleColumnsMessage="Tu planilla debe contener columnas correspondientes a: Nombre del Proyecto, Cliente (que ya debe existir), Servicio, Modelo de Cobro (Por hora, Precio fijo, Suscripción), Tarifa (monto numérico) y Estado (Activo, Completado, Pausado, etc.)."
      />

      {/* ---------------- INVOICE IMPORT MODAL ---------------- */}
      <ExcelImporter
        isOpen={showImportInvoiceModal}
        onClose={() => setShowImportInvoiceModal(false)}
        title="Importar Facturas desde Excel"
        subtitle="Sube tu planilla de facturas (.xlsx o .csv) para cargarlas de una vez en Lúcida"
        columnConfig={invoiceColumnConfig}
        onImport={handleImportInvoices}
        sampleColumnsMessage="Tu planilla debe contener columnas correspondientes a: Cliente (debe existir), Proyecto (opcional, debe ser del cliente), Monto (valor numérico), Fecha Emisión (YYYY-MM-DD), Origen de Deuda (opcional, YYYY-MM-DD) y Estado (Pagada, Pendiente o Vencida)."
      />

      {/* ---------------- TIME SESSIONS IMPORT MODAL ---------------- */}
      <ExcelImporter
        isOpen={showImportSessionModal}
        onClose={() => setShowImportSessionModal(false)}
        title="Importar Sesiones de Tiempo desde Excel"
        subtitle="Sube tu planilla de sesiones de tiempo (.xlsx o .csv) para cargarlas de una vez en Lúcida"
        columnConfig={sessionColumnConfig}
        onImport={handleImportSessions}
        importTypeLabelSingular="sesión de tiempo"
        importTypeLabelPlural="sesiones de tiempo"
        sampleColumnsMessage="Tu planilla debe contener columnas correspondientes a: Proyecto (que ya debe existir en la base de datos), Duración en horas (por ejemplo: 2 o 1.5), Facturable (Sí/No, Facturable/No facturable o true/false), Fecha (YYYY-MM-DD) y Descripción opcional."
      />


      {/* ---------------- CLIENT CREATION/EDITION MODAL ---------------- */}
      {showClientModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] border border-slate-200 rounded-2xl overflow-hidden w-full max-w-md shadow-xl">
            <div className="bg-slate-900 text-white p-5 font-bold tracking-tight text-lg">
              {editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
            </div>
            <form onSubmit={handleClientSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre / Empresa</label>
                <input
                  type="text"
                  value={clientForm.nombre}
                  onChange={(e) => setClientForm({ ...clientForm, nombre: e.target.value })}
                  placeholder="Ej. Estudio Austral"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contacto (Email, Teléfono, etc.)</label>
                <input
                  type="text"
                  value={clientForm.contacto}
                  onChange={(e) => setClientForm({ ...clientForm, contacto: e.target.value })}
                  placeholder="Ej. marta@austral.cl, +569..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Modelo de Relación</label>
                <select
                  value={clientForm.tipo}
                  onChange={(e) => setClientForm({ ...clientForm, tipo: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="Fijo">Fijo (Cuentas recurrentes / suscripción mensual)</option>
                  <option value="Esporádico">Esporádico (Proyectos únicos/precio cerrado)</option>
                </select>
              </div>
              <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- PROJECT CREATION/EDITION MODAL ---------------- */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] border border-slate-200 rounded-2xl overflow-hidden w-full max-w-md shadow-xl">
            <div className="bg-slate-900 text-white p-5 font-bold tracking-tight text-lg">
              {editingProject ? 'Editar Proyecto' : 'Crear Proyecto'}
            </div>
            <form onSubmit={handleProjectSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={projectForm.nombre}
                  onChange={(e) => setProjectForm({ ...projectForm, nombre: e.target.value })}
                  placeholder="Ej. Rediseño Web Corporativo"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cliente Asociado</label>
                <select
                  value={projectForm.clienteId}
                  onChange={(e) => setProjectForm({ ...projectForm, clienteId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                >
                  <option value="">-- Seleccionar cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Categoría del Servicio</label>
                <select
                  value={projectForm.servicioId}
                  onChange={(e) => setProjectForm({ ...projectForm, servicioId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                >
                  <option value="">-- Seleccionar catálogo --</option>
                  {servicios.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Modelo de Cobro</label>
                  <select
                    value={projectForm.modeloCobro}
                    onChange={(e) => setProjectForm({ ...projectForm, modeloCobro: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="Por hora">Por hora</option>
                    <option value="Precio fijo">Precio fijo</option>
                    <option value="Suscripción">Suscripción mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Tarifa (CLP)</label>
                  <input
                    type="number"
                    value={projectForm.tarifa}
                    onChange={(e) => setProjectForm({ ...projectForm, tarifa: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Estado</label>
                <select
                  value={projectForm.estado}
                  onChange={(e) => setProjectForm({ ...projectForm, estado: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="Activo">Activo</option>
                  <option value="Completado">Completado</option>
                  <option value="Pausado">Pausado</option>
                </select>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- INVOICE EMISSION/EDITION MODAL ---------------- */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FDFCFB] border border-slate-200 rounded-2xl overflow-hidden w-full max-w-md shadow-xl">
            <div className="bg-slate-900 text-white p-5 font-bold tracking-tight text-lg">
              {editingInvoice ? 'Editar Factura' : 'Emitir Factura'}
            </div>
            <form onSubmit={handleInvoiceSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Cliente Receptor</label>
                <select
                  value={invoiceForm.clienteId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, clienteId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                >
                  <option value="">-- Seleccionar cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Proyecto (Opcional)</label>
                <select
                  value={invoiceForm.proyectoId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, proyectoId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="">-- Sin proyecto (Facturación General) --</option>
                  {proyectos.filter(p => !invoiceForm.clienteId || p.clienteId.toString() === invoiceForm.clienteId).map(p => (
                    <option key={p.id} value={p.id}>[{p.cliente?.nombre}] - {p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Monto en CLP (Pesos Chilenos)</label>
                <input
                  type="number"
                  value={invoiceForm.monto}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, monto: e.target.value })}
                  placeholder="Ej. 1850000"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Fecha Emisión</label>
                  <input
                    type="date"
                    value={invoiceForm.fechaEmision}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, fechaEmision: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Origen de Deuda</label>
                  <input
                    type="date"
                    value={invoiceForm.fechaOrigenDeuda}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, fechaOrigenDeuda: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-sans">Estado de Pago</label>
                <select
                  value={invoiceForm.estado}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, estado: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-hidden bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pagada">Pagada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>

              <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  Emitir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
