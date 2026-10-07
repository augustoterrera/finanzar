---
name: Finanzar — Inicio
description: Cuentas mensuales legibles por responsable y tarjeta.
colors:
  zinc-50: "oklch(98.5% 0 0)"
  zinc-200: "oklch(92% 0.004 286.32)"
  zinc-600: "oklch(44.2% 0.017 285.786)"
  zinc-800: "oklch(27.4% 0.006 286.033)"
  zinc-900: "oklch(21% 0.006 285.885)"
  blue-600: "oklch(54.6% 0.245 262.881)"
  card-fallback: "#71717a"
typography:
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.3333
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5556
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4286
rounded:
  summary: "12px"
  account: "16px"
spacing:
  small: "8px"
  medium: "16px"
  account: "20px"
  desktop: "24px"
components:
  expense-account:
    textColor: "{colors.zinc-900}"
    rounded: "{rounded.account}"
    padding: "20px"
---

# Diseño del inicio de Finanzar

## Overview

**Creative North Star: "La cuenta en papel"**

Registro del inicio aprobado por el usuario, no una sustitución del diseño de las otras rutas. Se conserva la tipografía y las tres cards de importes anteriores. Las nuevas cuentas hacen visible cada sumando y su resultado.

## Colors

Se conserva la escala zinc de Tailwind. Las cuentas claras usan zinc-50 con opacidad y bordes zinc-200; en modo oscuro, zinc-800 y zinc-700. El nombre y un punto con el color registrado identifican la tarjeta; no se comunica información solo mediante color. Azul sigue identificando acciones y selección.

## Typography

Inter compartida con la app. Título de página 24px/700; responsable 18px/600; tarjeta y gastos 14px; aclaraciones 12px. Importe minimizado 16px/600, o 18px desde 640px; total de cuenta expandida 24px/600. Cifras tabulares en los importes y descripción completa con salto de línea cuando hace falta.

## Layout

Contenedor existente de 1024px con 16px de margen interior. Grupos de responsables en una columna hasta 768px y en dos desde ese ancho, separados por 24px horizontalmente y 32px verticalmente. Cada responsable reúne sus tarjetas en una pila con 12px entre cuentas. Las cards de resumen conservan su grilla anterior de una o tres columnas.

## Elevation & Depth

Las cuentas nuevas usan borde fino y superficie tonal sin sombra. Las cards de importes conservan su apariencia previa, incluida su sombra suave. No extrapolar esa combinación a nuevas cuentas.

## Shapes

Radios de 16px en cuentas, 12px en cards de resumen. Divisiones finas entre gastos y una regla de 2px antes del resultado.

## Components

Cada grupo muestra el responsable y su total mensual; Augusto aparece primero con la etiqueta «Vos». Sus tarjetas son desplegables nativos details/summary, cerrados por defecto. El encabezado muestra tarjeta, cantidad de gastos, «Ver suma» e importe. La flecha gira al abrir y la etiqueta pasa a «Ocultar suma». Toda la fila es un control con foco visible y admite teclado. Al cambiar de mes, los desplegables se reinician cerrados.

El detalle conserva gastos con importes alineados a la derecha y total al pie. Las filas usan la parte asignada a esa persona. Los compartidos tienen una aclaración; los no asignados y los gastos sin tarjeta no se ocultan.

Selector mensual y navegación existentes se preservan. Mes vacío: explicación y enlace «Cargar gasto», con foco visible. Solo la flecha de estado tiene una transición de 150ms, desactivada con prefers-reduced-motion.

## Do's and Don'ts

- Do mostrar cada sumando y total en centavos, formateados en pesos argentinos.
- Do mantener legible la descripción completa y alineados los importes.
- Don't confundir responsable con quien pagó la compra.
- Don't presentar las sumas de gastos cargados como un resumen bancario que incluye cargos no registrados.
