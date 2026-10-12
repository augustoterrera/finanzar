# Consultas disponibles para la IA

Todas las herramientas de esta lista son de solo lectura. Los importes devueltos llevan `currency: ARS` y `unit: centavos`, salvo campos explícitos de presentación. Los IDs se obtienen primero con `finanzar_get_context`.

| Lo que preguntás | Herramienta | Qué responde |
| --- | --- | --- |
| “¿Qué personas, tarjetas y medios de pago hay?” | `finanzar_get_context` | Catálogos con IDs para filtrar consultas posteriores. |
| “¿Cuánto suma octubre por cada responsable y tarjeta?” | `finanzar_get_month_summary` | Resumen del mes de impacto con partes asignadas; no agrupa por pagador. |
| “¿Cuánto gastó Leo este año y en qué tarjeta?” | `finanzar_get_spending_summary` | Agregados por persona/tarjeta en un rango de meses. Al agrupar por responsable suma su parte, no la compra completa. |
| “¿Qué total cargado tiene Naranja para octubre?” | `finanzar_get_card_statement` | Movimientos activos de esa tarjeta/mes y desglose por responsables. No acredita pago ni agrega impuestos no cargados. |
| “Mostrame los movimientos de octubre de Leo” | `finanzar_list_transactions` | Lista acotada del mes; la responsabilidad se filtra por `transaction_splits`. |
| “Buscá gastos entre enero y marzo pagados por Augusto, de ICBC, mayores a $20.000 que digan service” | `finanzar_search_transactions` | Historial filtrable por período, fecha guardada, descripción, importe, responsable, pagador, tarjeta, medio, tipo y estado; devuelve cursor para continuar. |
| “¿Hay gastos sin responsable o con una división que no suma?” | `finanzar_audit_data_integrity` | Inconsistencias verificables, por período o en todo el historial, con resultados acotados. Las series parcialmente cargadas no se consideran error por sí solas. |
| “¿Qué era este movimiento?” | `finanzar_get_transaction` | Detalle del movimiento, pagador, responsable, tarjeta, medio de pago y grupo de cuotas. |
| “¿Cuál era el total de compra de esta cuota 4/6?” | `finanzar_get_installment_group` | Total original guardado y cuotas registradas, separando el calendario cargado del total de compra. |
| “¿Qué gastos recurrentes tengo activos?” | `finanzar_list_recurring_rules` | Reglas, importe, periodicidad y estado. Una regla no confirma que el movimiento se haya generado o pagado. |

## Reglas de interpretación

- Responsable y pagador son conceptos diferentes. Para “a cargo de Leo”, filtrar por responsable; para “pagado por Augusto”, filtrar por pagador.
- `month`/`impact_month` es el mes de impacto guardado. `date` es la fecha de la fila y, en cuotas, puede ser una fecha de calendario asignada a esa cuota; no garantiza ser la fecha original de consumo.
- El importe de una fila de cuota es esa cuota. Para el importe completo de una compra en cuotas, consultar el grupo y leer `purchase_total_cents`.
- Un total de tarjeta es la suma de movimientos cargados en Finanzar para ese mes. La app no registra de forma confiable si se pagó el resumen ni contiene necesariamente mora, impuestos o cargos bancarios.
- Si una consulta se trunca, continuar con el cursor devuelto o acotar el período. No sumar nuevamente páginas ya vistas.
- Una coincidencia por nombre debe resolverse a su ID desde el contexto. Ante nombres duplicados, consultar antes de filtrar.

No hay herramienta de escritura expuesta. Cargar, editar o anular gastos desde IA seguirá bloqueado hasta que estén implementadas propuestas, aprobación en Finanzar, auditoría y pruebas de concurrencia.
