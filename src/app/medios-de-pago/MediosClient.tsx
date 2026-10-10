'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { activateCardAction, createPaymentMethodAction, deletePaymentMethodAction, updatePaymentMethodAction } from './actions';

type MethodType = 'cash' | 'debit' | 'transfer' | 'credit_card';
type Person = { id: string; name: string; is_owner: boolean };
type Card = { id: string; name: string; color: string | null; owner_person_id: string; owner_name: string | null; closing_day: number | null; due_day: number | null };
type Method = { id: string; name: string; type: MethodType; card_id: string | null; color: string | null; card_name: string | null; card_color: string | null; owner_person_id: string | null; owner_name: string | null; closing_day: number | null; due_day: number | null };

const labels: Record<MethodType, string> = {
  credit_card: 'Tarjeta de crédito',
  transfer: 'Billetera o cuenta',
  debit: 'Débito',
  cash: 'Efectivo',
};
const field = 'w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white';
const label = 'mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending ? 'Guardando…' : children}</button>;
}

function CardFields({ people, ownerId, closingDay, dueDay }: { people: Person[]; ownerId?: string | null; closingDay?: number | null; dueDay?: number | null }) {
  const prefix = ownerId === undefined ? 'new' : 'edit';
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor={`${prefix}-owner`} className={label}>Titular</label>
        <select id={`${prefix}-owner`} name="owner_person_id" defaultValue={ownerId ?? people.find(person => person.is_owner)?.id ?? ''} required className={field}>
          <option value="" disabled>Elegí un titular</option>
          {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-closing`} className={label}>Cierra el día <span className="font-normal text-zinc-500">(opcional)</span></label>
        <input id={`${prefix}-closing`} name="closing_day" type="number" min="1" max="31" defaultValue={closingDay ?? ''} className={field} />
      </div>
      <div>
        <label htmlFor={`${prefix}-due`} className={label}>Vence el día <span className="font-normal text-zinc-500">(opcional)</span></label>
        <input id={`${prefix}-due`} name="due_day" type="number" min="1" max="31" defaultValue={dueDay ?? ''} className={field} />
      </div>
    </div>
  );
}

export default function MediosClient({ paymentMethods, cards, people }: { paymentMethods: Method[]; cards: Card[]; people: Person[] }) {
  const [type, setType] = useState<MethodType>('credit_card');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<MethodType>('transfer');
  const [createState, createAction] = useActionState(createPaymentMethodAction, null);
  const [activateState, activateAction] = useActionState(activateCardAction, null);
  const [updateState, updateAction] = useActionState(updatePaymentMethodAction, null);
  const [deleteState, deleteAction] = useActionState(deletePaymentMethodAction, null);
  const createForm = useRef<HTMLFormElement>(null);
  const availableCards = cards.filter(card => !paymentMethods.some(method => method.card_id === card.id));

  useEffect(() => {
    if (createState?.success) createForm.current?.reset();
  }, [createState]);
  useEffect(() => {
    if (updateState?.success) setEditingId(null);
  }, [updateState]);

  return (
    <section className="mx-auto max-w-4xl space-y-7">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Medios de pago</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Agregá una tarjeta, billetera o cuenta. Queda lista para usar en tus movimientos.</p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:p-6">
        <h2 className="text-lg font-semibold">Agregar medio de pago</h2>
        <form ref={createForm} action={createAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="new-type" className={label}>¿Qué querés agregar?</label>
            <select id="new-type" name="type" value={type} onChange={event => setType(event.target.value as MethodType)} className={field}>
              {Object.entries(labels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="new-name" className={label}>Nombre</label>
              <input id="new-name" name="name" required maxLength={100} placeholder={type === 'credit_card' ? 'Ej.: ICBC Visa' : type === 'transfer' ? 'Ej.: Mercado Pago' : 'Ej.: Brubank'} className={field} />
            </div>
            <div>
              <label htmlFor="new-color" className={label}>Color</label>
              <input id="new-color" name="color" type="color" defaultValue="#3b82f6" className="h-[42px] w-20 cursor-pointer rounded-lg border border-zinc-300 p-1 dark:border-zinc-600 dark:bg-zinc-900" />
            </div>
          </div>
          {type === 'credit_card' && <CardFields people={people} />}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{type === 'credit_card' ? 'La tarjeta aparecerá inmediatamente al cargar un gasto. Los días sirven para ubicar el mes de cada resumen.' : 'Aparecerá inmediatamente en el selector de medios de pago.'}</p>
          {createState?.error && <p role="alert" className="text-sm text-red-600">{createState.error}</p>}
          <SubmitButton>Agregar {type === 'credit_card' ? 'tarjeta' : 'medio de pago'}</SubmitButton>
        </form>
      </div>

      {availableCards.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Tarjetas anteriores sin activar</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Ya están cargadas; activalas acá para usarlas, sin volver a crearlas.</p>
          <ul className="mt-4 space-y-3">
            {availableCards.map(card => (
              <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 dark:border-amber-900 dark:bg-zinc-900">
                <span className="font-medium">{card.name}</span>
                <form action={activateAction}>
                  <input type="hidden" name="card_id" value={card.id} />
                  <SubmitButton>Activar para usar</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          {activateState?.error && <p role="alert" className="mt-3 text-sm text-red-600">{activateState.error}</p>}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tus medios de pago</h2>
        {(updateState?.error || deleteState?.error) && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{updateState?.error || deleteState?.error}</p>}
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800">
          {paymentMethods.map(method => (
            <li key={method.id} className="p-4 sm:p-5">
              {editingId === method.id ? (
                <form action={updateAction} className="space-y-4">
                  <input type="hidden" name="id" value={method.id} />
                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                    <div><label className={label}>Nombre</label><input name="name" defaultValue={method.name} required maxLength={100} className={field} /></div>
                    <div>
                      <label className={label}>Tipo</label>
                      {method.card_id ? <><input type="hidden" name="type" value="credit_card" /><div className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-600">Tarjeta de crédito</div></> : (
                        <select name="type" value={editingType} onChange={event => setEditingType(event.target.value as MethodType)} className={field}>
                          <option value="transfer">Billetera o cuenta</option><option value="debit">Débito</option><option value="cash">Efectivo</option>
                        </select>
                      )}
                    </div>
                    <div><label className={label}>Color</label><input name="color" type="color" defaultValue={method.color || method.card_color || '#3b82f6'} className="h-[42px] w-20 cursor-pointer rounded-lg border border-zinc-300 p-1 dark:border-zinc-600" /></div>
                  </div>
                  {method.card_id && <CardFields people={people} ownerId={method.owner_person_id} closingDay={method.closing_day} dueDay={method.due_day} />}
                  <div className="flex gap-3"><SubmitButton>Guardar cambios</SubmitButton><button type="button" onClick={() => setEditingId(null)} className="px-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">Cancelar</button></div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: method.color || method.card_color || '#71717a' }} />
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{method.name}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{labels[method.type]}{method.card_id && method.owner_name ? ` · ${method.owner_name}` : ''}{method.card_id && method.closing_day ? ` · Cierra el ${method.closing_day}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setEditingId(method.id); setEditingType(method.type); }} className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Editar</button>
                    <form action={deleteAction} onSubmit={event => { if (!window.confirm(`¿Eliminar ${method.name}? Solo se permite si no tiene movimientos ni reglas.`)) event.preventDefault(); }}>
                      <input type="hidden" name="id" value={method.id} />
                      <button type="submit" className="text-sm font-semibold text-red-600 hover:underline dark:text-red-400">Eliminar</button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
          {paymentMethods.length === 0 && <li className="p-6 text-sm text-zinc-500">Todavía no agregaste medios de pago.</li>}
        </ul>
      </div>
    </section>
  );
}
