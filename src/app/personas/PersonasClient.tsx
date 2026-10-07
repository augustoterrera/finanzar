'use client';

import { useState, useActionState, useEffect } from 'react';
import { createPersonAction, updatePersonAction, deletePersonAction } from './actions';

export default function PersonasClient({ people }: { people: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createState, createAction] = useActionState(createPersonAction, null);
  const [updateState, updateAction] = useActionState(updatePersonAction, null);
  const [deleteState, deleteAction] = useActionState(deletePersonAction, null);

  useEffect(() => {
    if (updateState?.success) {
      setEditingId(null);
    }
  }, [updateState]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Personas</h1>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold mb-4">Agregar Persona</h2>
        <form action={createAction} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            name="name"
            placeholder="Nombre de la persona"
            required
            className="flex-1 rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
            Crear
          </button>
        </form>
        {createState?.error && (
          <p className="text-red-500 text-sm mt-2">{createState.error}</p>
        )}
      </div>

      {(deleteState?.error || updateState?.error) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-100 dark:border-red-800">
          {deleteState?.error || updateState?.error}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-800 shadow-sm rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {people.map(person => (
            <li key={person.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors">
              {editingId === person.id ? (
                <form action={updateAction} className="flex w-full flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={person.id} />
                  <input name="name" defaultValue={person.name} required className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900" />
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Guardar</button>
                    <button type="button" className="rounded-md px-3 py-2 text-sm font-medium" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{person.name}</span>
                    {person.is_owner && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-semibold">Owner</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-800" onClick={() => setEditingId(person.id)}>Editar</button>
                    {!person.is_owner && (
                      <form action={deleteAction} onSubmit={(e) => !confirm(`¿Estás seguro de eliminar a ${person.name}?`) && e.preventDefault()}>
                        <input type="hidden" name="id" value={person.id} />
                        <button 
                          type="submit" 
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium px-2 py-1"
                        >
                          Eliminar
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
          
          {people.length === 0 && (
            <li className="p-4 text-center text-zinc-500">No hay personas registradas.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
