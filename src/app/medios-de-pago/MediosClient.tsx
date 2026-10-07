'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createPaymentMethodAction, updatePaymentMethodAction, deletePaymentMethodAction } from './actions';

const typeLabels: Record<string, string> = {
  'cash': 'Efectivo',
  'debit': 'Débito',
  'transfer': 'Transferencia',
  'credit_card': 'Tarjeta de Crédito'
};

export default function MediosClient({ 
  paymentMethods, 
  cards 
}: { 
  paymentMethods: Array<{
    id: string;
    name: string;
    type: 'cash' | 'debit' | 'transfer' | 'credit_card';
    card_id: string | null;
    color?: string | null;
    card_name: string | null;
    card_color?: string | null;
  }>; 
  cards: Array<{
    id: string;
    name: string;
    color?: string | null;
    closing_day?: number | null;
    due_day?: number | null;
  }>; 
}) {
  const linkedCardIds = new Set(paymentMethods.filter(p => p.card_id).map(p => p.card_id));
  const availableCards = cards.filter(c => !linkedCardIds.has(c.id));

  const [creationMode, setCreationMode] = useState<'card' | 'custom'>(() => {
    return availableCards.length > 0 ? 'card' : 'custom';
  });

  const [selectedCardColor, setSelectedCardColor] = useState<string>('#3b82f6');
  const [selectedType, setSelectedType] = useState('debit');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState('debit');

  const [createState, createAction] = useActionState(createPaymentMethodAction, null);
  const [updateState, updateAction] = useActionState(updatePaymentMethodAction, null);
  const [deleteState, deleteAction] = useActionState(deletePaymentMethodAction, null);

  const customFormRef = useRef<HTMLFormElement>(null);
  const cardFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (updateState?.success) {
      setEditingId(null);
    }
  }, [updateState]);

  useEffect(() => {
    if (createState?.success) {
      customFormRef.current?.reset();
      cardFormRef.current?.reset();
    }
  }, [createState]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Medios de Pago</h1>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Agregar Medio de Pago</h2>
          
          <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-700/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCreationMode('card')}
              className={`py-1.5 px-3.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                creationMode === 'card'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>💳</span> Vincular Tarjeta
            </button>
            <button
              type="button"
              onClick={() => setCreationMode('custom')}
              className={`py-1.5 px-3.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                creationMode === 'custom'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>➕</span> Otro Medio de Pago
            </button>
          </div>
        </div>

        {creationMode === 'card' ? (
          <form ref={cardFormRef} action={createAction} className="space-y-4">
            <input type="hidden" name="mode" value="card" />
            
            {availableCards.length > 0 ? (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label htmlFor="card_id" className="block text-sm font-medium mb-1">
                    Seleccionar Tarjeta
                  </label>
                  <select
                    id="card_id"
                    name="card_id"
                    required
                    defaultValue=""
                    onChange={(e) => {
                      const c = availableCards.find(card => card.id === e.target.value);
                      if (c?.color) setSelectedCardColor(c.color);
                    }}
                    className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  >
                    <option value="" disabled>Selecciona la tarjeta a vincular...</option>
                    {availableCards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-28">
                  <label htmlFor="card_color" className="block text-sm font-medium mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    id="card_color"
                    name="color"
                    value={selectedCardColor}
                    onChange={(e) => setSelectedCardColor(e.target.value)}
                    className="w-full h-[38px] p-1 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors h-[38px] whitespace-nowrap w-full sm:w-auto"
                >
                  Vincular Tarjeta
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-4 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>
                  {cards.length === 0
                    ? 'No tienes tarjetas registradas aún.'
                    : 'Todas tus tarjetas ya están vinculadas como medios de pago.'}
                </span>
                <Link
                  href="/tarjetas"
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm inline-flex items-center gap-1"
                >
                  {cards.length === 0 ? 'Crear tarjeta en Tarjetas →' : 'Administrar Tarjetas →'}
                </Link>
              </div>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Al vincular una tarjeta, se crea automáticamente como medio de pago con su nombre, color y tipo Tarjeta de Crédito.
            </p>
          </form>
        ) : (
          <form ref={customFormRef} action={createAction} className="flex flex-col gap-4">
            <input type="hidden" name="mode" value="custom" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Ej: Mercado Pago, Efectivo, BNA Débito"
                  required
                  className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  id="type"
                  name="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  required
                  className="w-full rounded-lg border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                >
                  <option value="debit">Débito</option>
                  <option value="transfer">Transferencia / Billetera</option>
                  <option value="cash">Efectivo</option>
                </select>
              </div>
              <div>
                <label htmlFor="custom_color" className="block text-sm font-medium mb-1">Color (Opcional)</label>
                <input
                  type="color"
                  id="custom_color"
                  name="color"
                  defaultValue="#10b981"
                  className="w-full h-10 p-1 rounded-lg border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-2">
              <button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors w-full sm:w-auto"
              >
                Crear Medio de Pago
              </button>
            </div>
          </form>
        )}

        {createState?.error && (
          <p className="text-red-500 text-sm mt-3">{createState.error}</p>
        )}
      </div>

      {(deleteState?.error || updateState?.error) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-100 dark:border-red-800">
          {deleteState?.error || updateState?.error}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-800 shadow-sm rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {paymentMethods.map(method => {
            const displayColor = method.color || method.card_color || '#64748b';

            return (
              <li key={method.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors gap-4">
                {editingId === method.id ? (
                  <form action={updateAction} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={method.id} />
                    <div>
                      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Nombre</label>
                      <input 
                        name="name" 
                        defaultValue={method.name} 
                        required 
                        aria-label="Nombre" 
                        className="w-full rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900 text-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Tipo</label>
                      <select 
                        name="type" 
                        value={editingType} 
                        onChange={e => setEditingType(e.target.value)} 
                        aria-label="Tipo" 
                        className="w-full rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900 text-sm"
                      >
                        <option value="debit">Débito</option>
                        <option value="credit_card">Tarjeta de Crédito</option>
                        <option value="transfer">Transferencia / Billetera</option>
                        <option value="cash">Efectivo</option>
                      </select>
                    </div>

                    {editingType === 'credit_card' && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Tarjeta Asociada</label>
                        <select 
                          name="card_id" 
                          defaultValue={method.card_id ?? ''} 
                          required 
                          aria-label="Tarjeta asociada" 
                          className="w-full rounded-md border border-zinc-300 p-2 dark:border-zinc-600 dark:bg-zinc-900 text-sm"
                        >
                          <option value="">Selecciona la tarjeta</option>
                          {cards.map(card => (
                            <option key={card.id} value={card.id}>{card.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Color</label>
                      <input 
                        type="color" 
                        name="color" 
                        defaultValue={displayColor} 
                        aria-label="Color"
                        className="h-10 w-28 p-1 rounded-md border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 cursor-pointer"
                      />
                    </div>

                    <div className="flex gap-2 sm:col-span-2 mt-1">
                      <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Guardar</button>
                      <button type="button" className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3.5 h-9 rounded-full flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: displayColor }}
                        title={`Color: ${displayColor}`}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-lg flex items-center gap-2">
                          {method.name}
                          {method.type === 'credit_card' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
                              Tarjeta
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          Tipo: {typeLabels[method.type]}
                          {method.type === 'credit_card' && method.card_name && method.card_name !== method.name && (
                            ` • Tarjeta: ${method.card_name}`
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <button 
                        type="button" 
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" 
                        onClick={() => { setEditingId(method.id); setEditingType(method.type); }}
                      >
                        Editar
                      </button>
                      <form action={deleteAction} onSubmit={(e) => !confirm(`¿Estás seguro de eliminar el medio de pago ${method.name}?`) && e.preventDefault()}>
                        <input type="hidden" name="id" value={method.id} />
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
            );
          })}
          
          {paymentMethods.length === 0 && (
            <li className="p-4 text-center text-zinc-500">No hay medios de pago registrados.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
