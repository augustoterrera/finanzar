import type { Metadata } from 'next';
import { Database, FileSpreadsheet, Network } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Backup | Finanzar'
};

export default function BackupPage() {
  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Backup y Exportación</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Descarga tu información financiera para mantenerla segura o analizarla en otras herramientas como Excel o Google Sheets.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Copia de Seguridad (JSON)
            </h2>
            <p className="text-sm text-zinc-500 mt-2">Exporta absolutamente toda la base de datos (personas, reglas recurrentes, tarjetas, movimientos y divisiones) en un formato estructurado.</p>
          </div>
          <Link href="/backup/export/json" target="_blank" className="block text-center bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium py-2 rounded-lg transition-colors">
            Descargar backup completo
          </Link>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Movimientos (CSV)
            </h2>
            <p className="text-sm text-zinc-500 mt-2">Exporta la tabla principal de movimientos, ideal para abrir en Excel, hacer gráficos o cruzar con los extractos del banco.</p>
          </div>
          <Link href="/backup/export/transactions" target="_blank" className="block text-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium py-2 rounded-lg transition-colors">
            Descargar CSV Movimientos
          </Link>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col justify-between gap-4 sm:col-span-2">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-600" />
              Divisiones / Splits (CSV)
            </h2>
            <p className="text-sm text-zinc-500 mt-2">Exporta el detalle granular de quién gastó cuánto en cada movimiento. Útil para auditoría profunda de deudas.</p>
          </div>
          <Link href="/backup/export/splits" target="_blank" className="block text-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white font-medium py-2 rounded-lg transition-colors sm:w-1/2">
            Descargar CSV Divisiones
          </Link>
        </div>
      </div>
    </section>
  );
}
