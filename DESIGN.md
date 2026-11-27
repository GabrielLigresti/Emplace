---
name: Emplace
description: Gestión de restaurantes multi-sucursal; la landing, la carta del comensal y las pantallas del restaurante sobre un mismo sistema Clásico.
colors:
  papel: "#f3f2f2"
  papel-hondo: "#eae9e9"
  blanco-mantel: "#ffffff"
  linea: "#dad9d8"
  linea-firme: "#c0bfbe"
  control: "#8c8b89"
  linea-clasica: "#201f1d29"
  tinta-clasica: "#201f1d"
  texto: "#2b2a28"
  gris-nota: "#5f5c57"
  dorado: "#b68235"
  dorado-hondo: "#7d5411"
  dorado-oscuro: "#5a3b0a"
  dorado-suave: "#efe6d5"
  hoja-dorada: "#fff3e4"
  azul-listo: "#1d5fb4"
  azul-listo-suave: "#eaf1fb"
  naranja-aviso: "#a24f00"
  naranja-aviso-suave: "#fff1e0"
  rojo-falta: "#b91c1c"
  rojo-falta-suave: "#fef2f2"
  rol-mozo: "#2f6f8f"
  rol-cocinero: "#9b3d2b"
  rol-otro: "#6b5b95"
  base-verde-albahaca: "#16756b"
  base-verde-albahaca-hondo: "#125e56"
  base-verde-albahaca-suave: "#e3eeed"
  base-hoja-albahaca: "#dceae9"
  base-gris-bandeja: "#f4f5f7"
  base-linea-suave: "#e4e6e9"
  base-linea-firme: "#d3d7dc"
  base-tinta: "#15171a"
  base-texto: "#23262b"
  base-gris-nota: "#5d636b"
  base-amarillo-riesgo: "#a16207"
  base-amarillo-riesgo-suave: "#fefce8"
typography:
  display:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "30px"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
    fontFeature: "tnum"
  label:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "19.5px"
  caption:
    fontFamily: "Urbanist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
  titulo-clasico:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "84px"
    fontWeight: 400
    lineHeight: "1.06"
    letterSpacing: "-0.01em"
  texto-clasico:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "28px"
rounded:
  clasico: "4px"
  control: "10px"
  cuadrado: "12px"
  panel: "16px"
  hero: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.dorado-hondo}"
    textColor: "{colors.blanco-mantel}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.dorado-oscuro}"
  button-secondary:
    backgroundColor: "{colors.blanco-mantel}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.papel-hondo}"
  button-tonal:
    backgroundColor: "{colors.dorado-suave}"
    textColor: "{colors.dorado-oscuro}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.blanco-mantel}"
    textColor: "{colors.rojo-falta}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.gris-nota}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-icono:
    backgroundColor: "{colors.papel-hondo}"
    textColor: "{colors.tinta-clasica}"
    rounded: "{rounded.cuadrado}"
    size: "44px"
  input:
    backgroundColor: "{colors.blanco-mantel}"
    textColor: "{colors.texto}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.blanco-mantel}"
    textColor: "{colors.texto}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.dorado-hondo}"
    textColor: "{colors.blanco-mantel}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  segmented-option-active:
    backgroundColor: "{colors.dorado-suave}"
    textColor: "{colors.dorado-oscuro}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  tag-en-curso:
    backgroundColor: "{colors.dorado-suave}"
    textColor: "{colors.dorado-oscuro}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  tag-listo:
    backgroundColor: "{colors.azul-listo-suave}"
    textColor: "{colors.azul-listo}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  tag-riesgo:
    backgroundColor: "{colors.naranja-aviso-suave}"
    textColor: "{colors.naranja-aviso}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  tag-falta:
    backgroundColor: "{colors.rojo-falta-suave}"
    textColor: "{colors.rojo-falta}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.blanco-mantel}"
    rounded: "{rounded.panel}"
    padding: "16px"
  kpi:
    backgroundColor: "{colors.papel-hondo}"
    textColor: "{colors.tinta-clasica}"
    rounded: "{rounded.panel}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.dorado-suave}"
    textColor: "{colors.dorado-oscuro}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  button-clasico:
    backgroundColor: "{colors.dorado-hondo}"
    textColor: "{colors.blanco-mantel}"
    rounded: "{rounded.cuadrado}"
    padding: "0 24px"
    height: "44px"
  button-clasico-hover:
    backgroundColor: "{colors.dorado-oscuro}"
  button-clasico-secundario:
    backgroundColor: "{colors.papel-hondo}"
    textColor: "{colors.dorado-hondo}"
    rounded: "{rounded.cuadrado}"
    padding: "0 20px"
    height: "44px"
---

# Design System: Emplace

## Overview

**Creative North Star: "La mesa puesta"**

Todo a mano y en su lugar. Papel gris cálido de fondo, tarjetas blancas encima, tinta para el texto y un único Dorado Hondo que aparece solo donde se puede tocar o donde algo está pasando. Nada decora: la foto del plato, el precio y la acción siguiente son el contenido.

Toda la app usa el **registro Clásico**: papel, tinta y dorado. Cambia la tipografía según quién mira:

- **La landing pública** (`/`) es la versión editorial: Cormorant Garamond y Lora, héroe con foto y modelos 3D (ver "Registro Clásico").
- **El comensal** es "La mesa puesta" en el celular: Urbanist, tarjetas blancas con la foto arriba y densidad cómoda de 44 px. La carta y la ficha del plato siguen al pie de la letra el diseño de Claude Design (hoja dorada clara, Cormorant Garamond y Lora) y muestran la espera promedio del plato cuando hay pedidos suficientes.
- **El restaurante** (panel, cocina y salón) sigue la filosofía de **"El buen mozo"**: claro, rápido y amable, con jerarquía tipográfica fuerte en Urbanist y la acción siguiente siempre escrita, porque se lee de pie, a distancia y con apuro.

Tema claro único, sin modo oscuro.

### Marca
- **Logo Emplace** (`public/marca/emplace-logo.png`): solo donde el usuario todavía no está dentro de un restaurante. Va a 64 px de alto en el encabezado de la landing, a 80 px centrado sobre el login y a 44 px en el encabezado del comensal sin sesión, siempre sobre papel o blanco y con `alt="Emplace"`. La pestaña y la vista previa de los links usan el favicon y `og-emplace.png`.
- **Dentro de una sucursal** no aparece el logo Emplace: el encabezado muestra el nombre del restaurante y la sucursal, o el saludo si hay sesión.
- **Panel:** sin marca; la barra lateral no lleva logo.

**Key Characteristics:**
- Un solo acento, el Dorado Hondo, en todas las pantallas.
- Urbanist en el panel y el comensal, hoy de 400 a 600 (700–800 pendiente, para los títulos del comensal). Cormorant Garamond y Lora en la landing, la carta y la ficha del plato.
- Tres densidades: compacta (36 px) en escritorio, comensal (44 px) en el celular, táctil (48 px) en cocina y salón.
- Estados siempre con tono, ícono y texto; el OK es azul.
- Una sola sombra, solo para lo que flota.

## Cómo se aplica la paleta

Las pantallas usan nombres de token semánticos (`bg`, `panel`, `surface`, `line`, `line-strong`, `control`, `ink`, `text`, `meta`, `accent`, `accent-hover`, `accent-ink`, `accent-soft`, `hoja`, `ok`, `warn`, `bad` y sus `-soft`) y nunca la paleta de Tailwind directamente.

- **`@theme` en `index.css`** define los valores base de esos tokens. Son los verdes y grises fríos de la primera versión del sistema (ver "Valores base") y ninguna pantalla los muestra.
- **`.tema-staff`** redefine los mismos tokens con la paleta Clásica. `useTemaStaff` pone la clase en `<html>` mientras el panel, el selector de sucursal, el login o el alta de restaurante están montados, para que alcance también a los portales; `LayoutComensal` la pone en todas las pantallas del comensal. Los valores referencian los tokens Clásicos, no los duplican.
- **La landing** usa directamente los tokens Clásicos (`papel`, `tinta-clasica`, `dorado-700`…) dentro de `.landing-clasica`, que también lleva el foco en dorado.

Un token nuevo se agrega en `@theme` y, si cambia con el tema, también en `.tema-staff`, y se documenta acá en el mismo PR.

## Colors

Papel gris cálido, tinta y un dorado para la acción, con tres tonos de estado que nunca compiten con el acento. Los valores son los que se ven con `.tema-staff`.

### Acento
- **Dorado Hondo** (#7d5411, `accent` y `dorado-700`): acción principal, navegación activa, foco, chip seleccionado, enlaces y todo lo que está "en curso" (En preparación, Mesa en curso, Cuenta abierta). Blanco encima pasa AA.
- **Dorado Oscuro** (#5a3b0a, `accent-hover`, `accent-ink` y `dorado-800`): hover de la acción y texto sobre fondos dorados suaves.
- **Dorado Suave** (#efe6d5, `accent-soft`): fondo de la opción activa, del botón tonal, del ítem activo del panel y de la etiqueta "en curso". Sobre `panel` casi no se ve, así que las barras de datos (por ejemplo la demanda en Apertura) van en `accent` pleno.
- **Dorado** (#b68235): solo el borde de los campos Clásicos en hover y foco, y el borde del carrito flotante del comensal. Nunca texto ni fondo de botón: no pasa AA sobre papel.
- **Hoja Dorada** (#fff3e4, `dorado-100`): hoja de la carta del comensal.

### Neutral
- **Papel** (#f3f2f2, `bg`): fondo de página.
- **Papel Hondo** (#eae9e9, `panel` y `hoja`): paneles secundarios, KPI, hover de filas, botones de ícono, botón Clásico secundario y hoja que agrupa contenido detrás de tarjetas blancas.
- **Blanco Mantel** (#ffffff, `surface`): tarjetas, campos, barras fijas y la franja "Ver en mi mesa" de la landing.
- **Línea** (#dad9d8, `line`) y **Línea Firme** (#c0bfbe, `line-strong`): bordes de tarjetas y divisores. Son opacas porque también se usan como relleno y pista de progreso.
- **Control** (#8c8b89, `control`): borde de campos y botones de contorno; 3:1 sobre blanco y papel (WCAG 1.4.11).
- **Línea Clásica** (tinta al 16 %): bordes de campos y fichas de la landing.
- **Tinta Clásica** (#201f1d, `ink`): títulos y cifras.
- **Texto** (#2b2a28, `text`): texto corrido.
- **Gris Nota** (#5f5c57, `meta`): metadatos, ayudas y etiquetas secundarias; AA sobre papel y Papel Hondo.

### Estados
- **Azul Listo** (#1d5fb4) sobre **#eaf1fb**: OK, Listo, Aprobado, Confirmada, mesa libre, reserva finalizada, guardado con éxito.
- **Naranja Aviso** (#a24f00) sobre **#fff1e0**: en riesgo, demorado, inasistencia. Se parece al dorado y al rojo en luminancia, así que nunca va solo: siempre con ícono y texto (en Cocina, "Demorado" y "Muy demorado" se leen escritos). La inasistencia del comensal va en este tono, sin rojo, para no reprochar.
- **Rojo Falta** (#b91c1c) sobre **#fef2f2**: faltante, error, cancelado, rechazado.

### Categoría de rol
- **Colores de categoría de rol** (Mozo #2f6f8f, Cocinero #9b3d2b, Otro #6b5b95): punto de 12 px junto al nombre del rol; nunca texto, fondo de botón ni estado. No cambian con el tema.

### Valores base (sin uso en pantalla)
Los valores de `@theme` fuera de `.tema-staff`: Verde Albahaca #16756b (hondo #125e56, suave #e3eeed, hoja #dceae9), Gris Bandeja #f4f5f7, líneas #e4e6e9 y #d3d7dc, tinta #15171a, texto #23262b, nota #5d636b y Amarillo Riesgo #a16207 sobre #fefce8. Se conservan como respaldo de los tokens; una pantalla que los muestre está fuera del tema y es un error.

### Named Rules
**The Dorado Is Touch Rule.** El acento solo marca lo que se puede tocar, el ítem activo, lo que está en curso y las etiquetas de sección de la landing. Si un elemento con el acento no hace nada y no está pasando, no lleva el acento; los énfasis van en peso 600, no en color.

**The Listo Is Blue Rule.** El estado OK es azul, nunca verde ni dorado, para que "En preparación" y "Listo" no se confundan en la cola de cocina.

**The One Accent Rule.** No hay un segundo acento: ni el verde Albahaca de la versión anterior ni terracota.

## Registro Clásico (landing pública)

La landing (`/`) es la versión más editorial del sistema: papel, tinta, el dorado para lo que se toca y dos serifs. Se apoya en el sistema "Classical" del diseño de Claude Design. Los radios propios son `radius-clasico` (4 px) y `radius-hero` (20 px).

### Tipografía
- **Títulos:** Cormorant Garamond. Display a 84 px en escritorio y 52 px en celular, siempre en peso 400; los títulos de ficha y botones, en 600. Cormorant se queda en 600 como máximo, porque es fina.
- **Texto:** Lora, 15,5 a 17 px con interlineado de 28 px. Las etiquetas de sección van en Lora de 13 px, mayúsculas y 0,08 em de tracking, en Dorado Hondo.
- Se cargan con `@fontsource` (pesos 400 y 600); la pila de respaldo es Georgia.
- `/inicio` del comensal reusa el buscador de la landing con Urbanist (clase `tipografia-app`).

### Formas y componentes
- **Botones:** esquinas de 12 px (`rounded-cuadrado`), 44 px de alto, texto en Cormorant 600 de 16 px (la acción fija de la carta y la ficha: 56 px y 18 px, como el diseño de Claude Design). Principal en Dorado Hondo con texto blanco; secundario en Papel Hondo con texto Dorado Hondo y flecha "→". Sin sombra, sin borde.
- **Campos y fichas:** borde de 1 px en la Línea Clásica y esquina de 4 px, fondo transparente; el campo enfocado toma borde Dorado.
- **Héroe:** foto a la derecha con esquinas de 20 px a la izquierda en escritorio; en celular, la foto ocupa todo el fondo con un velo oscuro y el texto va en blanco.
- **Fichas de modelos 3D:** 300 px de alto, nombre debajo en Cormorant 24 px y botón "Ver en mi mesa" dentro del recuadro. El carrusel se desliza con el dedo en celular; las flechas existen solo en escritorio. Los modelos de muestra son CC BY 4.0 y sus créditos van en el pie de la landing.
- **Resultados de búsqueda:** sin tarjeta. Foto de la sucursal arriba, en 16:9 con esquina de 4 px; después, nombre en Cormorant, datos en Lora chico y dos botones. Sin foto, o si no carga, queda solo el texto.

### Reglas del registro
**The Mobile Trim Rule.** En el celular se oculta lo que no funciona con el dedo o repite otro control (flechas del carrusel, menú sin destino, el botón "Reservar mesa" de la barra cuando el héroe ya lo tiene). No se achica ni se apila: se saca.

**The Honest Placeholder Rule.** Si un modelo o una foto todavía no existe, la ficha queda vacía y sin botón; no se muestra un control que no hace nada ni se inventa contenido.

## Typography

**Alcance:** esta sección rige el panel y el comensal; la landing, la carta y la ficha del plato usan la tipografía del registro Clásico (arriba).

**Display Font:** Urbanist Variable (con ui-sans-serif, system-ui)
**Body Font:** Urbanist Variable (con ui-sans-serif, system-ui)

**Character:** una geométrica amable de una sola familia: redonda y abierta en el texto, compacta y firme en los títulos (hoy 600; 700–800 pendiente). Las cifras van tabulares en toda la app.

### Hierarchy
- **Display** (600, 26px, 30px): títulos de las pantallas del comensal.
- **Headline** (600, 22px, 28px): título de página del panel y cifras de KPI.
- **Title** (600, 16px, 28px): títulos de panel, modal y sección.
- **Body** (400, 15px, 22px): texto corrido y celdas; textos largos a 65–75ch.
- **Label** (500, 13px, 19.5px): botones compactos, campos y navegación de escritorio.
- **Caption** (600, 12px, 16px): etiquetas de estado y metadatos.

### Named Rules
**The Sixteen-Pixel Field Rule.** En el celular, el texto de los campos va a 16 px; con menos, iOS hace zoom al enfocar.

**The Tabular Rule.** Precios, cantidades, horas y totales usan cifras tabulares para que se alineen en columna.

## Layout

Una columna en el celular y grillas por rol en escritorio. El comensal usa un ancho máximo de 480 px con la acción principal fija abajo, al alcance del pulgar. El panel usa una barra lateral (80 px con íconos en tablet, 224 px con texto desde `lg`) y contenido con márgenes de 16 a 24 px.

Las tres densidades fijan la altura de los controles: compacta 36 px (44 px en celular), comensal 44 px y táctil 48 px. El espaciado sigue la escala de 4 px; los grupos se separan con `gap`, no con márgenes.

**The Thumb Rule.** En el celular, la acción principal de la pantalla queda fija abajo; nunca arriba ni escondida en un menú.

## Elevation & Depth

Plano por defecto. La profundidad sale de bordes de 1 px, del Papel Hondo y de las hojas; las tarjetas apoyadas no llevan sombra.

### Shadow Vocabulary
- **Flotante** (`shadow-flotante`: `0 10px 28px` de la tinta al 16 %): solo para lo que flota sobre la pantalla: modales, desplegables, avisos, el carrito flotante del comensal, los botones del visor de RA y la barra de guardado fija del editor de roles. Las pestañas inferiores del comensal llevan solo borde superior.

### Named Rules
**The One Shadow Rule.** Hay una sola sombra y es para lo que flota. Si está apoyado, lleva borde, no sombra.

## Shapes

Esquinas suaves y consistentes: 10 px en controles, 12 px en botones de ícono, botones Clásicos y el carrito flotante, 16 px en tarjetas, paneles, modales y desplegables, y píldora para chips, etiquetas y el óvalo de la pestaña activa del comensal. En la landing, 4 px en campos y fichas y 20 px en el héroe. Los bordes son de 1 px; el borde punteado se reserva para estados vacíos.

## Components

### Buttons
- **Shape:** esquinas de 10 px; un solo botón principal por pantalla.
- **Primary:** Dorado Hondo con texto blanco; alto por densidad (36, 44 o 48 px).
- **Hover / Focus:** hover a Dorado Oscuro; foco con contorno de 2 px en Dorado Hondo separado 2 px (`:focus-visible` global).
- **Secundario:** blanco con borde `control`. **Tonal:** Dorado Suave con texto Dorado Oscuro, para acciones repetidas en filas o tarjetas. **Peligro:** blanco con texto Rojo Falta y borde rojo al 30 %. **Fantasma:** sin fondo, texto Gris Nota.
- **Ícono:** cuadrado de 44 px con esquinas de 12 px sobre Papel Hondo.
- **Clásico** (landing, carta y ficha del plato): ver "Registro Clásico".

### Chips
- **Style:** píldora de 44 px, blanco con borde Línea Firme.
- **State:** seleccionado en Dorado Hondo con texto blanco.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Blanco Mantel; los KPI van sobre Papel Hondo.
- **Shadow Strategy:** sin sombra (ver Elevation & Depth).
- **Border:** Línea de 1 px.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** borde `control`, fondo blanco, esquinas de 10 px; 44 px de alto en el celular y 36 px en escritorio.
- **Focus:** borde Dorado Hondo con un halo del 20 % del mismo dorado.
- **Error / Disabled:** error con mensaje en Rojo Falta y su ícono, y borde rojo al 30 % donde el campo lo marca; deshabilitado sobre Papel Hondo con texto Gris Nota.

### Navigation
- **Panel:** barra lateral blanca; el ítem activo va en Dorado Suave con texto Dorado Oscuro y el ícono en Dorado Hondo. En tablet, ícono arriba y texto chico debajo.
- **Comensal:** pestañas inferiores blancas con borde superior, ícono y texto; la activa en Dorado Oscuro y peso 600, con un óvalo del acento al 20 % detrás del ícono. "Mi cuenta" es siempre la última.

### Estado
Etiqueta en píldora con ícono, texto y tono; la única fuente es `lib/estados.ts` y ninguna pantalla elige el color a mano.

## Do's and Don'ts

### Do:
- **Do** usar el Dorado Hondo solo en acciones, navegación activa, foco y estados en curso.
- **Do** usar los tokens semánticos (`accent`, `panel`, `meta`…) en las pantallas de la app y los Clásicos (`dorado-700`, `papel`…) solo en la landing, la carta y la ficha del plato.
- **Do** acompañar cada estado con ícono y texto, y usar Azul Listo (#1d5fb4) para OK.
- **Do** escribir la acción siguiente en el restaurante ("Marcar listo", "Activar mesa") en lugar de dejar un ícono solo.
- **Do** apoyar las tarjetas blancas sobre el papel o el Papel Hondo.
- **Do** respetar las alturas por densidad: 36, 44 y 48 px.

### Don't:
- **Don't** mostrar los valores base verdes en una pantalla: toda pantalla nueva va dentro de `.tema-staff` o de la landing.
- **Don't** sumar un segundo color de acento ni volver al verde o al terracota.
- **Don't** usar el Dorado claro (#b68235) para texto o fondos de botón.
- **Don't** usar verde ni dorado para un estado OK.
- **Don't** dejar el Naranja Aviso sin ícono y texto.
- **Don't** poner sombra a tarjetas apoyadas.
- **Don't** usar modo oscuro: el tema es claro único.

## Future Expansions

Fuera del alcance actual; no se implementan hasta que se decida la expansión.

- **Logo del restaurante:** iría arriba de la barra lateral del panel y en el encabezado del comensal dentro de la sucursal, en lugar del nombre escrito. Sin logo cargado, se mantiene el comportamiento actual.
- **Color del restaurante:** reemplazaría los tokens `accent`, `accent-hover`, `accent-ink` y `accent-soft` dentro de `.tema-staff` para ese restaurante, sin tocar la landing ni los estados. El color elegido tendría que pasar AA con texto blanco; si no, se queda el Dorado Hondo.
