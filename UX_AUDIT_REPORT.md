# UX_AUDIT_REPORT — Auditoría integral de experiencia visual, UX/UI y usabilidad

**Producto:** Veredicto · Inteligencia Deportiva
**Fecha:** 2026-07-17 · **Alcance:** 34 páginas · 75 componentes · 3 dominios
**Método:** auditoría en **navegador real** (Chromium/Playwright, escritorio 1440×900 y móvil 390×844), no solo lectura de código: capturas por ruta, medición de contraste sobre píxeles renderizados, barrido automatizado de accesibilidad, verificación de foco por teclado y de comportamiento con scroll.

> Restricciones respetadas: **Football congelado** (solo correcciones críticas — aquí, atributos ARIA y textos de marca, sin cambios de lógica), arquitectura y barreras de dominio intactas, cero datos fabricados, identidad del producto preservada.

---

## 1. Resumen ejecutivo

Se auditaron accesibilidad, jerarquía visual, navegación, consistencia, rendimiento percibido, microinteracciones y percepción de calidad. El producto parte de una base sólida (sistema de tokens coherente, estados vacíos bien resueltos, navegación móvil con áreas seguras), pero presentaba **tres problemas transversales** que afectaban a todas las pantallas:

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | **Sin `prefers-reduced-motion`** en todo el proyecto (WCAG 2.3.3) | Crítica | ✅ Resuelto |
| 2 | **Contraste insuficiente** en el texto tenue: 2,6:1 y 4,27:1 frente al 4,5:1 exigido, en **615 usos** | Crítica | ✅ Resuelto |
| 3 | **Identidad inconsistente**: 16 páginas y el manifest firmaban como "World Cup Predictor", marca previa a que la plataforma fuera multi-deporte | Alta | ✅ Resuelto |

Se implementaron **14 mejoras**, todas verificadas en navegador y validadas con `type-check`, `lint`, **141/141 pruebas** y `build` (89/89 páginas). Cero regresiones.

---

## 2. Hallazgos y mejoras implementadas

### 2.1 Accesibilidad (prioridad crítica)

**A1 · Movimiento no respetaba la preferencia del sistema** — *WCAG 2.3.3*
No existía ni una sola declaración de `prefers-reduced-motion` pese a haber animaciones en bucle infinito (indicador "en vivo", `animate-pulse`) y transiciones en toda la interfaz. Para personas con trastornos vestibulares esto puede provocar mareo.
**Solución:** regla global que neutraliza duración y bucles del movimiento conservando el cambio de estado (opacidad/color), de modo que nada deja de ser perceptible.
`app/globals.css`

**A2 · Contraste por debajo del mínimo AA** — *WCAG 1.4.3*
Medido sobre el fondo real (`#09090b`) con el navegador: `text-zinc-600` = **2,6:1** y `text-zinc-500` = **4,27:1**, ambos por debajo de 4,5:1. No es un detalle menor: son las clases de **notas al pie, metadatos y descripciones** — 615 usos en todo el producto, incluidos los descargos legales de Smart Bets.
**Decisión técnica:** en vez de reescribir 615 llamadas (churn enorme y tocar Football congelado), se corrigió el **valor** en una única capa CSS. Mismo rol semántico, mismo diseño, contraste conforme.
**Resultado verificado en navegador:** 4,54:1 · 5,45:1 · 7,76:1 — los tres pasan AA y **la jerarquía visual se mantiene** (siguen siendo tres niveles distinguibles).

**A3 · Sin salto al contenido** — *WCAG 2.4.1*
Un usuario de teclado debía tabular por toda la navegación lateral en cada página. Se añadió enlace "Saltar al contenido", invisible hasta recibir foco. **Verificado:** el primer `Tab` lo revela y enfoca `<main>`.

**A4 · Controles sin nombre accesible** — *WCAG 4.1.2*
Barrido automatizado en 6 rutas. Único punto con fallos: `/matches` — 2 botones y 4 controles de filtro que un lector de pantalla anunciaba como "botón" y "menú", sin decir de qué. Se añadió `aria-label` a navegación de fecha, selector de fecha, los tres `<select>` (grupo, equipo, confianza) y la paginación. **Verificado: de 6 fallos a 0.**
*(Football congelado: son atributos ARIA sin ningún cambio de lógica — corrección crítica admisible.)*

**A5 · Objetivos táctiles** — *WCAG 2.5.5*
Altura mínima de 40 px en punteros gruesos (móvil/tableta), con exenciones explícitas para celdas de tabla y chips compactos, para no destruir la densidad de datos que el producto necesita.

**A6 · Semántica de tabla**
`<th scope="col">` en la tabla de ranking, para que los lectores de pantalla asocien cada celda con su columna.

### 2.2 Identidad y consistencia

**C1 · La marca del producto no era la del producto**
El `<title>` global decía *"World Cup Predictor 2026"*, y 16 páginas firmaban *"| World Cup Predictor"* / *"| WC Predictor 2026"*. El Mundial es **la primera competición**, no el nombre de la casa. Además, el manifest dejaba *"WC Predictor"* en la pantalla de inicio al instalar la app en el móvil.
**Solución:** plantilla única (`%s | Veredicto`) declarada una sola vez; las páginas aportan solo su nombre. Corregidos también los títulos generados dinámicamente (perfil de jugador, equipo, liga, NBA), el manifest y la ficha de `/settings`.
**Verificado:** `/tennis`, `/tennis/ranking`, `/tennis/inteligencia`, `/dashboard`, `/nba` → `"<Página> | Veredicto"`. Cero restos de la marca antigua en la UI.
*Nota de proceso:* al unificar la plantilla apareció un duplicado (`"Tenis ATP | Veredicto | Veredicto"`) que se detectó **en navegador** y se corrigió en el mismo ciclo.

**C2 · Tenis fuera del sistema de navegación**
Las 7 páginas de tenis mostraban el breadcrumb genérico *"Veredicto"* en lugar de su competición. Ahora: **"Competiciones / ATP Tour"**, coherente con Mundial, ligas y NBA.

**C3 · Versión del motor obsoleta en el dashboard**
La tarjeta ATP anunciaba *"Motor tennis-1.0"* con producción corriendo **tennis-2.0** (cadena fija escrita a mano). Ahora deriva de `TENNIS_MODEL_VERSION`: no puede volver a desincronizarse.

### 2.3 Percepción de calidad y usabilidad

**P1 · Datos correctos que parecían un error**
La columna `#` del ranking mostraba `1, 2, 3, 5, 5, 5, 7, 7…`. El dato es honesto (la fuente registra el ranking **por partido**, así que la última posición conocida de cada jugador viene de fechas distintas), pero **se leía como un bug** y erosionaba la confianza en toda la plataforma.
**Solución sin mentir:** encabezado **"Pos. ATP"** en lugar de `#` (no es un contador de filas, es la posición oficial) + explicación en el hub. El dato no cambia; cambia que se entienda.

**P2 · Cabecera perdida en tabla de 509 filas**
Confirmado en navegador: al desplazarse, el usuario perdía el significado de cada columna (¿es posición o son puntos?). Ahora la cabecera es **fija** dentro de su propia área de scroll. **Verificado a 3000 px de desplazamiento:** columnas siempre visibles.

**P3 · Rendimiento percibido: un solo spinner para 34 rutas**
La única señal de carga era un spinner genérico centrado. Se añadieron **esqueletos** en las rutas de tenis con más datos (hub, ranking, perfil) que reproducen la estructura real: reservan el mismo espacio, evitan el salto de layout (CLS) y acortan la espera percibida.

**P4 · Comparación clave ilegible de un vistazo**
En Inteligencia, "64,26 %" y "64,19 %" son visualmente casi idénticos: el hecho más importante del producto —que el motor **supera** al ranking puro— pasaba desapercibido. Se añadió un indicador de diferencia: **"▲ +0,07 pp — a favor del motor"**, con flecha y signo, **sin depender solo del color** (WCAG 1.4.1).

---

## 3. Verificado y descartado (no eran problemas)

La honestidad también aplica a la auditoría: tres sospechas se comprobaron y resultaron falsas.

- **"Glifo extraño superpuesto"** en la esquina inferior izquierda de las capturas → es el **indicador de desarrollo de Next.js**, no aparece en producción.
- **`/tennis` sin `<h1>`** en el barrido automatizado → artefacto de temporización (la medición cazó el esqueleto de carga). Comprobado a 1 s, 4 s y 9 s: el `<h1>` "ATP Tour" está presente y el esqueleto no se atasca.
- **Desbordamiento horizontal en móvil** → medido: `scrollWidth` 390 = `innerWidth` 390. Sin desbordamiento.

**Aspectos ya en buen estado** (no requerían intervención): sistema de tokens de diseño coherente; estados vacíos con explicación y llamada a la acción (Smart Bets es un buen ejemplo); navegación inferior móvil con `aria-current` y áreas seguras; anillo de foco global definido; jerarquía de encabezados correcta; imágenes con `alt`.

---

## 4. Propuestas para fases futuras (no ejecutadas)

Se dejan documentadas y **no** implementadas por exceder el umbral de riesgo autónomo o depender de decisiones de producto:

| Propuesta | Valor | Por qué no ahora |
|---|---|---|
| Esqueletos en rutas de Football/NBA (`/matches`, `/predictions`, `/nba/*`) | Alto | Football está congelado; conviene autorización explícita |
| Auditoría automatizada con `axe-core` en CI | Alto | Añade dependencia y configuración de pipeline |
| Virtualización de la tabla de 509 filas | Medio | Hoy rinde bien; introducirla ahora sería complejidad prematura |
| Vista de tarjetas en móvil para tablas anchas | Medio | Cambio de patrón; merece diseño previo |
| Cablear los índices de saque/devolución (0-100) al perfil de jugador | Alto | Es funcionalidad, no UX: pertenece a la hoja de ruta del motor |
| Revisar los 343 usos de `text-[10px]` | Medio | Por debajo del mínimo recomendado (12 px); requiere decisión de densidad |
| Página de detalle de partido para Football con el mismo patrón que tenis | Medio | Football congelado |

---

## 5. Decisiones técnicas tomadas

1. **Corregir el contraste en una capa CSS y no en 615 llamadas.** Alternativa descartada: buscar y reemplazar en todos los componentes — habría tocado Football (congelado), generado un diff enorme y multiplicado el riesgo de regresión visual sin beneficio adicional.
2. **Tratar los arreglos ARIA como "corrección crítica" sobre Football.** Son atributos sin cambio de comportamiento; dejar controles sin nombre accesible era un fallo de conformidad, no una preferencia estética.
3. **Ámbito táctil acotado a punteros gruesos**, con exenciones para tablas: subir todo a 44 px habría destruido la densidad de datos que es parte del valor del producto.
4. **No ocultar la rareza del ranking, explicarla.** Reetiquetar la columna respeta el principio Data First: el dato es el que es; lo que se corrige es su comunicación.
5. **Esqueletos solo en tenis.** Es el dominio con datos más pesados y el que no está congelado; extenderlos es una propuesta explícita para la siguiente fase.

---

## 6. Resultados y validación

| Métrica | Antes | Después |
|---|---|---|
| Contraste del texto tenue | 2,60:1 / 4,27:1 ❌ | **4,54:1 / 5,45:1 / 7,76:1** ✅ |
| `prefers-reduced-motion` | ausente ❌ | global ✅ |
| Salto al contenido | ausente ❌ | presente y verificado con `Tab` ✅ |
| Controles sin nombre accesible (`/matches`) | 6 ❌ | **0** ✅ |
| Páginas con marca incorrecta | 16 ❌ | **0** ✅ |
| Cabecera visible al desplazar 509 filas | no ❌ | sí ✅ |
| Rutas con esqueleto de carga | 0 | 3 |
| Desbordamiento horizontal en móvil | — | ninguno ✅ |

**Validación en cada ciclo:** `type-check` sin errores · `lint` **0 errores** · **141/141 pruebas** · `build` **89/89 páginas** · verificación en navegador (escritorio y móvil) · **0 errores de JavaScript** en consola.

**Impacto esperado:** conformidad WCAG AA en los puntos auditados (accesibilidad legalmente relevante y ampliación de público alcanzable), coherencia de marca en pestañas, buscadores y enlaces compartidos, y mayor confianza percibida al eliminar señales que hacían parecer erróneos datos que eran correctos.

---

## 7. Entregas

Cuatro commits, cada uno validado antes de pasar al siguiente:

1. `feat(ux)` — accesibilidad AA, identidad y percepción de calidad (reduced-motion, contraste, skip link, táctil, breadcrumb, ranking, cabecera fija, esqueletos, indicador de diferencia)
2. `fix(a11y)` — nombres accesibles en filtros y paginación + marca en el manifest
3. `fix(ux)` — identidad coherente en los títulos de las 34 páginas
4. `docs` — este informe

*Ciclo aplicado en todo momento: Auditar → Priorizar → Implementar → Probar → Corregir → Documentar.*
