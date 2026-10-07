'use client';

import { useState, useActionState, useEffect } from 'react';
import { createRuleAction, toggleRuleAction, generateRulesAction } from './actions';
import { formatCents } from '@/lib/format';

export default function RecurrentesClient({ rules, people, paymentMethods }: { rules: any[], people: any[], paymentMethods: any[] }) {
  const [generateState, generateAction] = useActionState(generateRulesAction, null);
  const [createState, createAction] = useActionState(createRuleAction, null);

  const [currentMonth, setCurrentMonth] = useState('');
  useEffect(() => {
    setCurrentMonth(new Date().toISOString().substring(0, 7));
  }, []);

  const [type, setType] = useState('expense');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  
  const selectedPaymentMethodType = paymentMethods.find((pm) => pm.id === paymentMethodId)?.type;

  useEffect(() => {
    if (type === 'income' && selectedPaymentMethodType === 'credit_card') {
      setPaymentMethodId('');
    }
  }, [type, selectedPaymentMethodType]);

  const handleToggle = async (id: string, active: boolean) => {
    await toggleRuleAction(id, active);
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Movimientos Recurrentes</h1>
      </div>

      <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Generar gastos del mes</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Selecciona un mes para crear automáticamente las transacciones de las suscripciones activas. Las reglas que ya fueron generadas este mes serán ignoradas para no duplicar.</p>
        
        <form action={generateAction} className="flex flex-col sm:flex-row items-center gap-4">
          <input type="month" name="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} required className="rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border font-medium" />
          <button type="submit" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Generar {currentMonth}
          </button>
        </form>

        {generateState?.success && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-sm font-medium border border-green-200 dark:border-green-800">
            {generateState.success}
          </div>
        )}
        {generateState?.info && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md text-sm font-medium border border-blue-200 dark:border-blue-800">
            {generateState.info}
          </div>
        )}
        {generateState?.error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm font-medium border border-red-200 dark:border-red-800">
            {generateState.error}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold mb-4">Nueva Regla Mensual</h2>
        
        <form action={createAction} className="space-y-4">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg max-w-sm">
            <label className="flex-1 text-center cursor-pointer">
              <input type="radio" name="type" value="expense" checked={type === 'expense'} onChange={() => setType('expense')} className="peer sr-only" />
              <div className="py-1 text-sm font-medium rounded-md transition-colors peer-checked:bg-white dark:peer-checked:bg-zinc-800 peer-checked:shadow peer-checked:text-zinc-900 dark:peer-checked:text-white text-zinc-500">Egreso</div>
            </label>
            <label className="flex-1 text-center cursor-pointer">
              <input type="radio" name="type" value="income" checked={type === 'income'} onChange={() => setType('income')} className="peer sr-only" />
              <div className="py-1 text-sm font-medium rounded-md transition-colors peer-checked:bg-white dark:peer-checked:bg-zinc-800 peer-checked:shadow peer-checked:text-zinc-900 dark:peer-checked:text-white text-zinc-500">Ingreso</div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium mb-1">Descripción</label>
              <input type="text" id="description" name="description" required placeholder="Ej: Netflix, Expensas..." className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border" />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium mb-1">Monto Mensual</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-zinc-500">$</span>
                <input type="number" step="0.01" id="amount" name="amount" required min="0.01" className="w-full pl-8 rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label htmlFor="day_of_month" className="block text-sm font-medium mb-1">Día del mes (1-31)</label>
              <input type="number" id="day_of_month" name="day_of_month" min="1" max="31" defaultValue="1" required className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border" />
            </div>
            <div>
              <label htmlFor="payer_person_id" className="block text-sm font-medium mb-1">Responsable</label>
              <select id="payer_person_id" name="payer_person_id" required className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border">
                <option value="">Seleccionar...</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payment_method_id" className="block text-sm font-medium mb-1">Medio de pago</label>
              <select id="payment_method_id" name="payment_method_id" value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} required className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 shadow-sm p-2 border">
                <option value="">Seleccionar...</option>
                {paymentMethods.map(method => (
                  <option key={method.id} value={method.id} disabled={type === 'income' && method.type === 'credit_card'}>{method.name} {method.card_name ? `(${method.card_name})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white font-medium py-2 px-6 rounded-lg transition-colors">
              Crear Regla
            </button>
          </div>
          {createState?.error && (
            <p className="text-red-500 text-sm mt-2">{createState.error}</p>
          )}
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Suscripciones Actuales</h2>

        <div className="bg-white dark:bg-zinc-800 shadow-sm rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {rules.map(rule => (
              <li key={rule.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors gap-4 ${rule.active ? '' : 'opacity-60'}`}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-lg ${rule.type === 'income' ? 'text-green-600 dark:text-green-400' : ''}`}>
                      {rule.description}
                    </span>
                    {!rule.active && (
                      <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-medium">Inactiva</span>
                    )}
                  </div>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {formatCents(rule.amount)} • Día {rule.day_of_month} • 
                    Paga: {rule.payer_name} con {rule.payment_method_name}
                  </span>
                </div>
                
                <button 
                  onClick={() => handleToggle(rule.id, !rule.active)}
                  className={`self-end sm:self-auto text-sm font-medium px-3 py-1.5 rounded-md border ${rule.active ? 'text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20' : 'text-green-600 border-green-200 hover:bg-green-50 dark:border-green-900/50 dark:hover:bg-green-900/20'}`}
                >
                  {rule.active ? 'Desactivar' : 'Activar'}
                </button>
              </li>
            ))}
            
            {rules.length === 0 && (
              <li className="p-6 text-center text-zinc-500">No hay reglas recurrentes configuradas.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
