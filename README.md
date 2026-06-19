Lúcida — Sistema de Gestión para Diseñadores Freelance.
Proyecto desarrollado para la asignatura Sistemas de Información (Ingeniería Comercial).
Caso asignado: "Freelance en Apuros — La vida desordenada de Lucía".
> El nombre **Lúcida** es un guiño a la protagonista del caso, Lucía: la herramienta busca darle
> claridad ("lucidez") financiera y operativa a su trabajo como diseñadora independiente.
---
El problema:
Lucía es diseñadora gráfica freelance con seis clientes fijos y varios esporádicos. Cobra de tres
formas distintas (por hora, por proyecto y por suscripción mensual), factura desde Word, anota sus
horas en las notas del celular y lleva los pagos en un Excel desactualizado. Como consecuencia, no
pudo demostrar que un cliente le debía dinero desde enero. El problema de fondo no es de orden
personal, sino una falla en la arquitectura de información de su negocio.
La solución:
Lúcida es una aplicación web que centraliza clientes, proyectos, horas trabajadas y pagos, y
ofrece un dashboard financiero que responde las tres preguntas clave del caso:
¿Cuánto he facturado este mes y cuánto me deben aún? (con desglose pagado / pendiente / vencido).
¿Qué cliente me genera más ingresos y cuál me consume más horas? (rankings por ingresos y por horas).
¿Cuál es mi tarifa efectiva por hora real? (cálculo automático del EHR — Effective Hourly Rate).
Además incluye un cronómetro asociado a cliente/servicio/proyecto con marca facturable / no
facturable, y un sistema de importación masiva desde Excel (clientes, proyectos, facturas y
sesiones de tiempo) que permite a Lucía migrar la información que hoy tiene dispersa en planillas.
---
Stack tecnológico
Capa	Tecnología
Frontend	React 19 + TypeScript, Vite, Tailwind CSS
Backend	Node.js + Express (TypeScript)
Base de datos	PostgreSQL (acceso mediante Drizzle ORM)
Autenticación	Firebase
Importación de datos	Librería XLSX (lectura de Excel/CSV)
Asistencia IA	Google AI Studio (Gemini) para la generación de código
Justificación: se eligió un stack moderno de JavaScript/TypeScript de extremo a extremo (React
en el cliente, Node/Express en el servidor) por su rapidez de desarrollo y su buen encaje con las
herramientas de IA generativa usadas en el proyecto. PostgreSQL se seleccionó por ser una base de
datos relacional robusta, adecuada para el modelo de datos del caso (clientes, servicios, proyectos,
sesiones de tiempo y facturas con sus relaciones), que es justamente lo que permite responder
"cuánto me debe este cliente y desde cuándo".
---
Estructura del repositorio
```
/docs    → Documentación del proyecto:
             - Lucida_Especificaciones_Funcionales.pdf  (informe ejecutivo, generado con apoyo de NotebookLM)
             - Link_Stitch.txt                          (enlace al prototipo de alta fidelidad en Stitch)
             - Prompts IA.pdf                            (bitácora de prompts / estrategia de Prompt Engineering)
/db      → lucida.sql  (script PostgreSQL con la estructura DDL y los datos de prueba DML)
/src     → Código fuente del frontend (React + TypeScript)
server.ts y archivos de configuración en la raíz → Backend (Node + Express) y configuración del proyecto
```
> **Nota sobre la estructura:** la aplicación fue generada con Google AI Studio, que organiza el
> código frontend en `/src` y el backend en `server.ts` (raíz), en lugar de carpetas separadas
> `/backend` y `/frontend`. Se mantuvo esta organización para no comprometer el funcionamiento de
> la aplicación. El frontend y el backend están claramente identificados.
---
Proceso de desarrollo (asistido por IA)
El proyecto siguió las dos fases del enunciado:
Fase 1 — Descubrimiento y prototipado: investigación de requerimientos con NotebookLM
(Deep Research) y prototipado de alta fidelidad en Stitch.
Fase 2 — Desarrollo: generación de la aplicación funcional con Google AI Studio, incluyendo
la base de datos PostgreSQL, el backend y el frontend a partir de los diseños de Stitch.
La estrategia de Prompt Engineering y el proceso iterativo de corrección de errores están
documentados en `/docs/Prompts IA.pdf`.
---
Prototipo (Stitch): https://stitch.withgoogle.com/projects/12412484818455014671
Video pitch (demostración): [pegar aquí el enlace de YouTube o Drive una vez grabado]
---
Grupo 4 — Caso "Freelance en Apuros":
Patricio Alarcón Salas/
Francisco Esquivel Rojas/
Allén Saray Noemí Flores Ortiz/
Camila Ignacia Soto Ceriche.

Asignatura: Sistemas de Información — Ingeniería Comercial


