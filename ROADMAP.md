# Roadmap MVP - Finanzar

## Objetivo

Construir una PWA web responsive para registrar ingresos, egresos, gastos con tarjeta, cuotas, gastos recurrentes y divisiones entre personas.

El objetivo principal es saber:

- cuanto gasto cada persona;
- cuanto pague yo;
- cuanto me debe cada persona;
- cuanto necesito pagar este mes;
- cuanto corresponde a tarjeta este mes, separado entre gastos propios y gastos de otras personas.

## Stack Decidido

- Framework: SvelteKit
- Deploy: Vercel
- Base de datos: Turso SQLite
- ORM/migraciones: Drizzle ORM
- Auth MVP: contraseña unica
- App: PWA web responsive
- Backup: export local descargable para guardar en la PC

No usar:

- Next.js
- MongoDB
- Google Sheets como base principal
- Flutter en el MVP
- sync offline complejo en el MVP

## Principios

- La carga debe ser rapida.
- El sistema debe priorizar registro y claridad, no dashboards decorativos.
- Cada gasto debe separar quien paga de quien debe.
- Las cuotas deben impactar en el mes que se pagan, no solo en el mes de compra.
- El MVP debe ser usable desde celular y PC.
- No agregar funcionalidades fuera de este roadmap sin aprobacion.

## Modelo Mental

Un gasto tiene:

- pagador: quien puso la plata o uso la tarjeta;
- responsables: una o mas personas que deben absorber el gasto;
- medio de pago: efectivo, debito, transferencia o tarjeta;
- impacto mensual: mes en el que cuenta para caja/tarjeta;
- estado: activo, anulado o pagado si aplica.

Ejemplo:

Augusto paga $30.000 con tarjeta por una compra de su suegra.

- pagador: Augusto
- responsable: Suegra
- medio: tarjeta
- resultado: aparece en tarjeta de Augusto, pero Suegra debe $30.000

## Entidades

### people

Personas que participan en gastos.

Campos minimos:

- id
- name
- is_owner
- created_at

Debe existir una persona owner: Augusto.

### payment_methods

Medios de pago.

Campos minimos:

- id
- name
- type: cash | debit | transfer | credit_card
- card_id nullable
- created_at

### cards

Tarjetas de credito.

Campos minimos:

- id
- name
- owner_person_id
- closing_day nullable
- due_day nullable
- created_at

### transactions

Movimiento base.

Campos minimos:

- id
- date
- month
- type: income | expense
- amount
- description
- payer_person_id
- payment_method_id
- card_id nullable
- installment_group_id nullable
- recurring_rule_id nullable
- status: active | void
- notes nullable
- created_at
- updated_at

### transaction_splits

Division economica del movimiento.

Campos minimos:

- id
- transaction_id
- person_id
- amount
- created_at

Regla:

- la suma de splits debe ser igual al amount de la transaction.

### installment_groups

Compra en cuotas.

Campos minimos:

- id
- description
- total_amount
- installments_total
- start_month
- created_at

Cada cuota debe existir como una transaction individual, con sus propios splits.

### recurring_rules

Gastos o ingresos recurrentes.

Campos minimos:

- id
- description
- amount
- type: income | expense
- payer_person_id
- payment_method_id
- card_id nullable
- frequency: monthly
- day_of_month
- active
- created_at

## Alcance MVP

### Incluido

- Login con contraseña unica.
- ABM simple de personas.
- ABM simple de tarjetas y medios de pago.
- Cargar ingreso.
- Cargar egreso directo.
- Cargar gasto con tarjeta en 1 pago.
- Cargar gasto con tarjeta en cuotas.
- Cargar cuotas ya empezadas.
- Cargar gasto recurrente mensual.
- Dividir cualquier gasto entre personas con montos distintos.
- Ver resumen mensual.
- Ver cuanto debe pagar cada persona.
- Exportar backup descargable en JSON y CSV.
- PWA instalable.

### Fuera del MVP

- App Flutter.
- OCR de tickets.
- Integracion bancaria.
- Notificaciones push.
- WhatsApp/Telegram bot.
- Presupuestos avanzados.
- Graficos complejos.
- Multiusuario real.
- Permisos por usuario.
- Sync offline avanzado.

## Fases

### Fase 1 - Base del proyecto

Tareas:

- Crear proyecto SvelteKit.
- Configurar TypeScript.
- Configurar Tailwind o CSS simple.
- Configurar Drizzle.
- Configurar Turso.
- Crear migraciones iniciales.
- Crear variables de entorno.
- Crear layout responsive basico.
- Crear auth por contraseña unica.

Criterios de aceptacion:

- La app corre localmente.
- La app conecta a Turso.
- Las migraciones se ejecutan.
- Una persona no autenticada no puede usar la app.
- El login funciona con una password definida por env.

### Fase 2 - Personas y medios de pago

Tareas:

- Crear pantalla de personas.
- Crear persona owner por defecto.
- Crear pantalla de medios de pago.
- Crear pantalla de tarjetas.
- Permitir asociar medio de pago tipo credit_card a una tarjeta.

Criterios de aceptacion:

- Se pueden crear, listar y editar personas.
- Se pueden crear, listar y editar tarjetas.
- Se pueden crear, listar y editar medios de pago.
- No se puede borrar una persona usada en movimientos.

### Fase 3 - Carga guiada de movimientos

Tareas:

- Crear formulario de ingreso.
- Crear formulario de egreso.
- Permitir elegir fecha, monto, descripcion, pagador y medio.
- Permitir agregar splits por persona.
- Validar que la suma de splits sea igual al monto.
- Guardar transaction y transaction_splits.

Criterios de aceptacion:

- Se puede cargar un gasto 100% propio.
- Se puede cargar un gasto 100% de otra persona.
- Se puede cargar un gasto dividido entre varias personas.
- La app muestra errores claros si los splits no cierran.

### Fase 4 - Tarjeta y cuotas

Tareas:

- Permitir gasto con tarjeta en 1 pago.
- Permitir gasto con tarjeta en N cuotas.
- Permitir indicar cuota inicial para cuotas ya empezadas.
- Generar una transaction por cada cuota.
- Permitir que cada persona tenga distinto monto por cuota.

Ejemplo:

- Persona A paga $5.000 por cuota.
- Persona B paga $10.000 por cuota.
- Total cuota mensual: $15.000.

Criterios de aceptacion:

- Una compra en 6 cuotas genera 6 transactions mensuales.
- Una compra ya empezada en cuota 4/12 genera solo cuotas 4 a 12.
- Cada cuota impacta en su mes correspondiente.
- Los splits de cada cuota pueden tener montos distintos por persona.

### Fase 5 - Recurrentes

Tareas:

- Crear pantalla de recurrentes.
- Crear regla mensual.
- Boton para generar recurrentes del mes.
- Evitar duplicados para el mismo mes.

Criterios de aceptacion:

- Se puede crear una suscripcion mensual.
- La app genera el gasto del mes.
- Si se presiona dos veces, no duplica el gasto.
- Se puede desactivar un recurrente.

### Fase 6 - Resumen mensual

Tareas:

- Crear selector de mes.
- Mostrar ingresos del mes.
- Mostrar egresos directos del mes.
- Mostrar tarjeta del mes.
- Mostrar total pagado por Augusto.
- Mostrar gasto propio de Augusto.
- Mostrar cuanto debe cada persona.
- Mostrar cuanto necesita pagar Augusto este mes.

Calculos minimos:

- total_pagado_owner: suma de transactions donde payer es owner.
- gasto_propio_owner: suma de splits donde person es owner.
- deuda_persona: suma de splits de persona cuando payer es owner y persona no es owner.
- tarjeta_total_mes: suma de transactions con card_id en el mes.
- tarjeta_owner_mes: suma de splits del owner en transactions con card_id.
- tarjeta_otros_mes: suma de splits de no-owner en transactions con card_id.

Criterios de aceptacion:

- El resumen separa gastos propios y gastos de otras personas.
- El resumen muestra cuanto debe pagar cada persona.
- El resumen muestra cuanto corresponde a tarjeta.
- El resumen filtra correctamente por mes.

### Fase 7 - Carga rapida

Tareas:

- Crear input de carga rapida.
- Implementar parser simple.
- Confirmar antes de guardar.
- Permitir editar campos detectados antes de guardar.

Sintaxis inicial:

- `3500 cafe`
- `12000 super @Augusto`
- `30000 farmacia @Suegra`
- `40000 cena @Augusto=20000 @Novia=20000`
- `15000 tarjeta cena @Augusto=5000 @Novia=10000`

Criterios de aceptacion:

- La carga rapida nunca guarda sin mostrar confirmacion.
- Si no entiende algo, abre el formulario guiado con datos precargados.
- La carga rapida soporta monto, descripcion y splits basicos.

### Fase 8 - Backup

Tareas:

- Exportar JSON completo.
- Exportar CSV de transactions.
- Exportar CSV de splits.
- Agregar pantalla de backup.

Criterios de aceptacion:

- Se puede descargar un backup desde la app.
- El backup contiene datos suficientes para reconstruir el estado.
- Los archivos descargados pueden guardarse localmente en la PC.

### Fase 9 - Deploy

Tareas:

- Configurar adapter para Vercel.
- Configurar env vars en Vercel.
- Deploy inicial.
- Probar login.
- Probar carga de gasto.
- Probar resumen mensual.
- Probar export backup.

Criterios de aceptacion:

- La app funciona en produccion.
- La app funciona desde celular.
- La app funciona desde PC.
- No hay rutas privadas accesibles sin login.

## Orden Estricto de Implementacion

1. Base del proyecto.
2. Base de datos.
3. Auth.
4. Personas.
5. Medios de pago y tarjetas.
6. Movimientos simples.
7. Splits.
8. Cuotas.
9. Recurrentes.
10. Resumen mensual.
11. Carga rapida.
12. Backup.
13. PWA.
14. Deploy.

No implementar una fase si la anterior no cumple sus criterios de aceptacion.

## Riesgos

- Modelar mal splits y cuotas.
- Mezclar fecha de compra con mes de impacto.
- Crear dashboards antes de resolver carga y resumen.
- Hacer parser inteligente demasiado pronto.
- Agregar multiusuario real antes de necesitarlo.
- Depender de edicion manual directa en la base.

## Regla Para Cualquier IA Que Ejecute

Antes de escribir codigo:

1. leer `README.md`;
2. leer este archivo completo;
3. implementar solo la fase solicitada;
4. no agregar features fuera de alcance;
5. dejar criterios de aceptacion verificables;
6. correr checks disponibles;
7. reportar que se cambio y que falta.

