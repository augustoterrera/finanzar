'use client';

import { useState, useActionState, useEffect } from 'react';
import { createCardAction, updateCardAction, deleteCardAction } from './actions';

export default function TarjetasClient({ cards, people }: { cards: any[], people: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createState, createAction] = useActionState(createCardAction, null);
  const [updateState, updateAction] = useActionState(updateCardAction, null);
  const [deleteState, deleteAction] = useActionState(deleteCardAction, null);

  useEffect(() => {
    if (updateState?.success) {
      setEditingId(null);
    }
  }, [updateState]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Tarjetas de Crédito</h1>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold mb-4">Agregar Tarjeta</h2>
        <form action={createAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Ej: Visa Santander"
                required
                className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
            <div>
              <label htmlFor="owner_person_id" className="block text-sm font-medium mb-1">Titular (Owner)</label>
              <select
                id="owner_person_id"
                name="owner_person_id"
                required
                className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              >
                <option value="">Selecciona un titular</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="closing_day" className="block text-sm font-medium mb-1">Día de cierre (Opcional)</label>
              <input
                type="number"
                id="closing_day"
                name="closing_day"
                min="1"
                max="31"
                placeholder="Ej: 25"
                className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
            <div>
              <label htmlFor="due_day" className="block text-sm font-medium mb-1">Día de venc. (Opcional)</label>
              <input
                type="number"
                id="due_day"
                name="due_day"
                min="1"
                max="31"
                placeholder="Ej: 5"
                className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
            </div>
            <div>
              <label htmlFor="color" className="block text-sm font-medium mb-1">Color (Opcional)</label>
              <input
                type="color"
                id="color"
                name="color"
                defaultValue="#3b82f6"
                className="w-full h-10 p-1 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors w-full sm:w-auto">
              Crear Tarjeta
            </button>
          </div>
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
          {cards.map(card => (
            <li key={card.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors gap-4">
              {editingId === card.id ? (
                <form action={updateAction} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={card.id} />
                  <input name="name" defaultValue={card.name} required aria-label="Nombre" className="rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900" />
                  <select name="owner_person_id" defaultValue={card.owner_person_id} required aria-label="Titular" className="rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900">
                    {people.map(person => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                  <input type="number" name="closing_day" defaultValue={card.closing_day ?? ''} min="1" max="31" aria-label="Día de cierre" className="rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900" />
                  <input type="number" name="due_day" defaultValue={card.due_day ?? ''} min="1" max="31" aria-label="Día de vencimiento" className="rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900" />
                  <input type="color" name="color" defaultValue={card.color ?? '#3b82f6'} aria-label="Color" className="rounded-md border border-zinc-300 p-1 w-full h-[42px] dark:border-zinc-600 dark:bg-zinc-900 cursor-pointer" title="Color de la tarjeta" />
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Guardar</button>
                    <button type="button" className="rounded-md px-3 py-2 text-sm font-medium" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="font-medium text-lg flex items-center gap-2">
                      {card.color && (
                        <span className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: card.color }} aria-hidden="true"></span>
                      )}
                      {card.name}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Titular: {card.owner_name}
                      {(card.closing_day || card.due_day) && ' • '}
                      {card.closing_day && `Cierra el ${card.closing_day}`}
                      {(card.closing_day && card.due_day) && ' | '}
                      {card.due_day && `Vence el ${card.due_day}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-800" onClick={() => setEditingId(card.id)}>Editar</button>
                    <form action={deleteAction} onSubmit={(e) => !confirm(`¿Estás seguro de eliminar la tarjeta ${card.name}?`) && e.preventDefault()}>
                      <input type="hidden" name="id" value={card.id} />
                      <button 
                        type="submit" 
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium px-2 py-1"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </>
              )}
            </li>
          ))}
          
          {cards.length === 0 && (
            <li className="p-4 text-center text-zinc-500">No hay tarjetas registradas.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
