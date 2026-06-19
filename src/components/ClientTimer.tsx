import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, X, CheckSquare, Clock, Edit3, Save } from 'lucide-react';
import { Project } from '../types.ts';

interface ClientTimerProps {
  projects: Project[];
  onSaveSession: (data: {
    proyectoId: number;
    facturable: boolean;
    duracion: number; // in seconds
    fecha: string;
    descripcion: string;
  }) => Promise<void>;
}

export function ClientTimer({ projects, onSaveSession }: ClientTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isFacturable, setIsFacturable] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  const [isOpen, setIsOpen] = useState(false); // Modal visibility

  // Manual session logging state
  const [isManual, setIsManual] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // Set default project when list populated
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id.toString());
    }
  }, [projects]);

  const getSelectedProjectInfo = () => {
    const proj = projects.find(p => p.id.toString() === selectedProjectId);
    if (!proj) return null;
    return proj;
  };

  const handleStartStop = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      setIsRunning(true);
      setIsManual(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      alert('Debes seleccionar un proyecto para guardar la sesión.');
      return;
    }

    const duration = isManual ? parseFloat(manualMinutes) * 60 : seconds;
    if (isNaN(duration) || duration <= 0) {
      alert('La duración debe ser mayor a 0.');
      return;
    }

    try {
      await onSaveSession({
        proyectoId: parseInt(selectedProjectId),
        facturable: isFacturable,
        duracion: Math.round(duration),
        fecha: isManual ? manualDate : new Date().toISOString().split('T')[0],
        descripcion,
      });

      // Reset
      setIsRunning(false);
      setSeconds(0);
      setDescripcion('');
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar la sesión de tiempo.');
    }
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      remainingSecs.toString().padStart(2, '0'),
    ].join(':');
  };

  const currentProject = getSelectedProjectInfo();

  return (
    <>
      {/* Contextual Timer FAB (Floating above nav) */}
      <div className="fixed bottom-[85px] left-1/2 transform -translate-x-1/2 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2.5 rounded-full px-6 py-3 font-bold text-sm border shadow-md transition-all duration-300 ${
            isRunning
              ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title={isRunning ? 'Ver / Detener Cronómetro Activo' : 'Iniciar Nuevo Cronómetro'}
        >
          {isRunning ? (
            <Pause className="w-4 h-4 text-white fill-white" />
          ) : (
            <Play className="w-4 h-4 text-slate-600 fill-slate-600" />
          )}
          <span className="font-mono text-base tracking-wider">{formatTime(seconds)}</span>
          {isRunning && currentProject && (
            <span className="max-w-[110px] truncate text-xs font-normal border-l border-white/30 pl-2.5">
              {currentProject.nombre}
            </span>
          )}
        </button>
      </div>

      {/* Slide-Up Modal Tray */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-end md:items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className="bg-[#FDFCFB] border border-slate-200 rounded-t-2xl md:rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-xl max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg tracking-tight">
                  {isRunning ? 'Cronómetro en Progreso' : 'Registrar Sesión de Tiempo'}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
              {/* Selector Mode (Live Timer vs Manual) */}
              {!isRunning && (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsManual(false)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      !isManual ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Usar Cronómetro
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManual(true)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      isManual ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Ingreso Manual
                  </button>
                </div>
              )}

              {/* Timer Block */}
              {!isManual ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-xs">
                  <div className="font-mono text-5xl font-extrabold text-slate-900 mb-5 tracking-tight">
                    {formatTime(seconds)}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleStartStop}
                      className={`flex items-center gap-2 py-2 px-6 rounded-md font-bold text-sm transition-colors cursor-pointer ${
                        isRunning
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          Pausar Cronómetro
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          {seconds > 0 ? 'Reanudar Cronómetro' : 'Iniciar Cronómetro'}
                        </>
                      )}
                    </button>
                    {!isRunning && seconds > 0 && (
                      <button
                        type="button"
                        onClick={() => setSeconds(0)}
                        className="flex items-center gap-2 py-2 px-4 rounded-md font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      >
                        Reiniciar
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Duración (Minutos)
                    </label>
                    <input
                      type="number"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      min="1"
                      className="w-full text-sm border border-slate-200 bg-white rounded-md p-2.5 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full text-sm border border-slate-200 bg-white rounded-md p-2.5 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Configurations */}
              <div className="flex flex-col gap-4 mt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Proyecto Asociado
                  </label>
                  {projects.length === 0 ? (
                    <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
                      Crea un cliente y un proyecto primero para asociar tareas.
                    </div>
                  ) : (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full text-sm border border-slate-200 bg-white rounded-md p-2.5 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden text-slate-850"
                    >
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          [{proj.cliente?.nombre}] - {proj.nombre} ({proj.servicio?.nombre})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {currentProject && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs flex justify-between text-slate-600 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800">Cliente:</span> {currentProject.cliente?.nombre} ({currentProject.cliente?.tipo})
                    </div>
                    <div>
                      <span className="font-bold text-slate-800">Cobro:</span> {currentProject.modeloCobro} |{' '}
                      <span className="font-bold text-slate-800">Tarifa:</span> ${currentProject.tarifa.toLocaleString('es-CL')}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3.5">
                  <input
                    type="checkbox"
                    id="facturable"
                    checked={isFacturable}
                    onChange={(e) => setIsFacturable(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300"
                  />
                  <label htmlFor="facturable" className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer select-none">
                    <CheckSquare className={`w-4 h-4 ${isFacturable ? 'text-emerald-600' : 'text-slate-400'}`} />
                    Marcar sesión como Facturable ({isFacturable ? 'Suma ingresos' : 'Apoyo / No facturable'})
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Nota / Descripción de Actividad
                  </label>
                  <textarea
                    rows={2}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Ej. Rediseño del home, layouts de instagram, feedback..."
                    className="w-full text-sm border border-slate-200 bg-white rounded-md p-2.5 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-5 flex gap-3 justify-end border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="py-2 px-4 rounded-md text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="py-2 px-6 rounded-md text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-indigo-400" />
                Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
