import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, Upload, AlertCircle, CheckCircle2, RefreshCw, FileSpreadsheet, ArrowRight, Table, AlertTriangle
} from 'lucide-react';

export interface ColumnMapping {
  key: string;              // Target property name (e.g., 'nombre')
  label: string;            // Visual name (e.g., 'Nombre del Cliente')
  synonyms: string[];       // Synonyms for mapping header columns (e.g., ['nombre', 'name', 'cliente', 'customer'])
  required: boolean;        // If the field is mandatory
  validate?: (val: any) => string | null;  // Custom validation rule, returns error message or null if valid
  normalize?: (val: any) => any;           // Normalize data (e.g., 'fijo' -> 'Fijo')
  defaultValue?: any;
}

interface ExcelImporterProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  columnConfig: ColumnMapping[];
  onImport: (validData: any[]) => Promise<void>;
  sampleColumnsMessage: string;
}

export function ExcelImporter({
  isOpen,
  onClose,
  title,
  subtitle,
  columnConfig,
  onImport,
  sampleColumnsMessage
}: ExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({}); // Target key -> file header found
  const [rowDiagnostics, setRowDiagnostics] = useState<{ rowNum: number; errors: string[]; rowData: any }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Flexible column mapping algorithm
  const detectHeaders = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    
    columnConfig.forEach(col => {
      // Find a matching header based on exact match or synonyms
      const matchedHeader = headers.find(h => {
        const normalizedHeader = h.trim().toLowerCase();
        return (
          normalizedHeader === col.key.toLowerCase() ||
          normalizedHeader === col.label.toLowerCase() ||
          col.synonyms.some(syn => normalizedHeader.includes(syn.toLowerCase()) || syn.toLowerCase().includes(normalizedHeader))
        );
      });
      if (matchedHeader) {
        mapping[col.key] = matchedHeader;
      }
    });
    
    return mapping;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setParsedRows([]);
    setRowDiagnostics([]);
    setHeaderMap({});

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to 2D array to inspect full raw table
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rawRows.length === 0) {
          alert('El archivo cargado está vacío.');
          return;
        }

        // The first row should contain the headers
        const headers = rawRows[0].map((h: any) => h?.toString() || '');
        const mappings = detectHeaders(headers);
        setHeaderMap(mappings);

        // Process data rows
        const dataRows = rawRows.slice(1);
        const resolvedRows: any[] = [];
        const diagnostics: { rowNum: number; errors: string[]; rowData: any }[] = [];

        dataRows.forEach((rawRow, index) => {
          // Adjust physical row number (1-based index, row 1 is header, so data row starting index is rawRow + 2)
          const physicalRowNum = index + 2; 
          
          // Map array format or object format
          const item: Record<string, any> = {};
          const rowErrors: string[] = [];

          columnConfig.forEach(col => {
            const fileHeader = mappings[col.key];
            let rawValue = undefined;

            if (fileHeader) {
              const headerIndex = headers.indexOf(fileHeader);
              if (headerIndex !== -1) {
                rawValue = rawRow[headerIndex];
              }
            }

            // Fallback to defaults or mark missing
            if (rawValue === undefined || rawValue === null || rawValue.toString().trim() === '') {
              if (col.required) {
                rowErrors.push(`Falta el campo obligatorio "${col.label}"`);
              } else {
                item[col.key] = col.defaultValue !== undefined ? col.defaultValue : '';
              }
            } else {
              // Apply normalization if any
              let value = rawValue.toString().trim();
              if (col.normalize) {
                value = col.normalize(value);
              }
              
              // Validate structure
              if (col.validate) {
                const validationError = col.validate(value);
                if (validationError) {
                  rowErrors.push(validationError);
                }
              }
              
              item[col.key] = value;
            }
          });

          if (rowErrors.length > 0) {
            diagnostics.push({
              rowNum: physicalRowNum,
              errors: rowErrors,
              rowData: item
            });
          }

          // Build a preview object
          resolvedRows.push({
            _rowNum: physicalRowNum,
            _hasErrors: rowErrors.length > 0,
            ...item
          });
        });

        setParsedRows(resolvedRows);
        setRowDiagnostics(diagnostics);

      } catch (err) {
        console.error(err);
        alert('Ocurrió un error al procesar el archivo Excel. Asegúrate de que sea un formato .xlsx o .csv válido.');
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleConfirmImport = async () => {
    // Only import rows that DO NOT have errors
    const validRows = parsedRows.filter(r => !r._hasErrors);
    if (validRows.length === 0) {
      alert('No hay filas válidas para importar. Resuelve los errores de datos detallados antes de continuar.');
      return;
    }

    setIsProcessing(true);
    try {
      // Stripping utility fields
      const formattedRows = validRows.map(({ _rowNum, _hasErrors, ...rest }) => rest);
      await onImport(formattedRows);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al realizar la importación. Comprueba tu conexión e intenta otra vez.');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const validRowsCount = parsedRows.filter(r => !r._hasErrors).length;
  const invalidRowsCount = rowDiagnostics.length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#FDFCFB] border border-slate-200 rounded-2xl overflow-hidden w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight text-white">{title}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
          {/* File Upload Stage */}
          {!file ? (
            <div className="flex flex-col gap-6">
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all duration-200 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50/40 text-emerald-800' 
                    : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 text-slate-500'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <div className="p-4 bg-emerald-100/50 rounded-2xl text-emerald-600">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 text-sm">Arrastra tu archivo aquí o haz clic para buscar</p>
                  <p className="text-xs text-slate-400 mt-1">Soporta hojas de cálculo de Microsoft Excel (.xlsx, .xls) o archivadores separados por coma (.csv)</p>
                </div>
              </div>

              {/* Requirements & Info */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                <h4 className="font-extrabold text-slate-800 text-xs tracking-wider uppercase mb-2.5">Estructura esperada del archivo</h4>
                <div className="text-xs text-slate-600 leading-relaxed gap-2 flex flex-col">
                  <p>{sampleColumnsMessage}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-2">
                    {columnConfig.map(col => (
                      <div key={col.key} className="bg-white border border-slate-200 p-2.5 rounded-lg flex flex-col gap-1">
                        <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                          {col.label} {col.required && <span className="text-rose-500">*</span>}
                        </span>
                        <span className="text-[10px] text-slate-450 font-mono">Nombre columna o sinónimos:</span>
                        <span className="text-[10px] text-slate-500 bg-slate-50 py-0.5 px-1.5 rounded border border-slate-100 font-mono overflow-x-auto break-all">
                          {[col.key, ...col.synonyms].join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* File Info Banner */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs">{file.name}</h4>
                    <p className="text-slate-400 text-[10px] font-mono">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                    setRowDiagnostics([]);
                    setHeaderMap({});
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Columns Detected Map */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 mb-2.5">
                  <Table className="w-3.5 h-3.5 text-indigo-500" />
                  Mapeo de Columnas Detectado
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {columnConfig.map(col => {
                    const detected = headerMap[col.key];
                    return (
                      <div 
                        key={col.key} 
                        className={`p-3 rounded-lg border flex flex-col justify-between gap-1.5 ${
                          detected 
                            ? 'bg-emerald-50/40 border-emerald-150' 
                            : col.required 
                              ? 'bg-rose-50/40 border-rose-150' 
                              : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-700">{col.label}</span>
                          {col.required && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">Requerido</span>}
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                          {detected ? (
                            <>
                              <span className="font-mono text-emerald-700 bg-emerald-100 px-1 rounded truncate max-w-[120px]">{detected}</span>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            </>
                          ) : col.required ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> No mapeada
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No detectada (Usará default)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Errors & Diagnostics Box */}
              {invalidRowsCount > 0 && (
                <div className="bg-rose-50 border border-rose-150 rounded-xl p-4">
                  <h4 className="font-extrabold text-rose-900 text-xs flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Se encontraron {invalidRowsCount} {invalidRowsCount === 1 ? 'fila con observaciones' : 'filas con observaciones'}
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed mb-3">
                    Las siguientes filas tienen datos incompletos o errores de validación. 
                    <strong> No se importarán estas filas</strong> para mantener la consistencia de tu base de datos, mientras que el resto de filas válidas sí se registrarán.
                  </p>
                  
                  <div className="max-h-40 overflow-y-auto border border-rose-200 rounded-lg bg-[#FFFDFD] divide-y divide-rose-100">
                    {rowDiagnostics.map((diag, idx) => (
                      <div key={idx} className="p-2.5 text-[11px] flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-rose-50/30">
                        <span className="font-bold text-rose-700 font-mono flex-shrink-0">Fila {diag.rowNum}</span>
                        <div className="flex-1 text-slate-600 leading-relaxed font-semibold">
                          {diag.errors.join(' • ')}
                        </div>
                        <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded font-mono truncate max-w-sm">
                          {JSON.stringify(diag.rowData)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              {parsedRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="font-extrabold text-slate-800 text-xs tracking-tight flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-emerald-500" />
                      Vista previa de Registros a Importar ({validRowsCount} válidos de {parsedRows.length} totales)
                    </h4>
                  </div>
                  
                  <div className="overflow-x-auto max-h-60 scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/85 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-4 font-mono w-16">Fila</th>
                          <th className="py-2.5 px-4">Estado</th>
                          {columnConfig.map(col => (
                            <th key={col.key} className="py-2.5 px-4">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-[11px] text-slate-705">
                        {parsedRows.map((row, idx) => (
                          <tr 
                            key={idx} 
                            className={`hover:bg-slate-50/55 transition-colors ${
                              row._hasErrors ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4 font-mono text-slate-400">{row._rowNum}</td>
                            <td className="py-2.5 px-4">
                              {row._hasErrors ? (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                                  <AlertCircle className="w-3 h-3" /> Error
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Válido
                                </span>
                              )}
                            </td>
                            {columnConfig.map(col => {
                              const val = row[col.key];
                              return (
                                <td 
                                  key={col.key} 
                                  className={`py-2.5 px-4 truncate max-w-xs ${
                                    row._hasErrors && col.required && (!val || val.toString().trim() === '')
                                      ? 'text-rose-600 font-bold bg-rose-50/50'
                                      : ''
                                  }`}
                                >
                                  {val !== undefined && val !== null ? val.toString() : <span className="text-slate-400 italic">n/a</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                    setRowDiagnostics([]);
                    setHeaderMap({});
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs font-bold text-slate-505 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Recomenzar
                </button>
                <button
                  type="button"
                  disabled={validRowsCount === 0 || isProcessing}
                  onClick={handleConfirmImport}
                  className={`px-5 py-2.5 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all duration-200 flex items-center gap-2 ${
                    validRowsCount === 0 
                      ? 'bg-slate-300 cursor-not-allowed opacity-50' 
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirmar Importación ({validRowsCount} {validRowsCount === 1 ? 'cliente' : 'clientes'})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
