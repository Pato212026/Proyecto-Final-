import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { useState } from 'react';
import { LogIn } from 'lucide-react';

export function AuthScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error(err);
      setError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-12 bg-[#FDFCFB]">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
        {/* Geometric Balance Designed Emblem representing Lúcida */}
        <div className="relative w-16 h-16 mx-auto mb-8 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-indigo-600 rounded-lg transform rotate-45"></div>
          <div className="absolute inset-2.5 border border-slate-900 rounded-sm"></div>
          <div className="w-4 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
          LÚCIDA
        </h1>
        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold mb-6">
          Freelance Management
        </p>
        
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Sistema de gestión y control financiero diseñado para creadoras freelance. Controla proyectos, rentabilidad y facturación en un esquema visualmente equilibrado.
        </p>

        {error && (
          <div className="mb-6 bg-rose-50 text-rose-600 text-xs font-semibold p-3.5 rounded-lg border border-rose-100">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50"
        >
          <LogIn className="w-5 h-5 text-indigo-400" />
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión con Google'}
        </button>

        <p className="mt-8 text-xs text-slate-400 leading-relaxed">
          Al ingresar, accederás de manera segura y privada a tu panel personal de Lúcida. Estructura balanceada, decisiones lúcidas.
        </p>
      </div>
    </div>
  );
}
