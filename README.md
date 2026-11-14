# mimo

Aplicación de notas personal de escritorio, construida con **Tauri 2**, **React 19** y **SQLite**. Combina un editor por bloques, historial de versiones, dictado local por voz y un asistente **Codex** que propone cambios sobre tus notas sin modificarlas directamente.

![Versión](https://img.shields.io/github/v/release/Gxstavo-dev/Mimo?label=versi%C3%B3n)
![Licencia](https://img.shields.io/badge/licencia-Apache--2.0-blue)
![Plataforma](https://img.shields.io/badge/plataforma-Linux-lightgrey)

<!-- Mockup: guarda una captura en docs/mockup.png y reemplaza este comentario por:
<p align="center"><img src="docs/mockup.png" alt="Mockup de mimo" width="720"></p>
-->

## Características

- **Editor por bloques** con menú `/`: títulos `h1`–`h3`, párrafos, texto en negrita, listas, enlaces, imágenes, videos, código, fórmulas, diagramas de flujo y texto con dictado.
- **Guardado automático** del contenido (debounce de 500 ms) y edición de título con confirmación por `Enter`.
- **Tags por nota** con creación, edición en línea y eliminación.
- **Búsqueda de notas** por título, creación y borrado desde la barra lateral.
- **Historial de versiones** automático por nota, con resúmenes de cambios y agrupación de ediciones cercanas (15 s).
- **Dictado local** con micrófono, `cpal` y Whisper tiny vía `sherpa-onnx`; el modelo se descarga solo la primera vez y después funciona sin conexión.
- **Chat con Codex** en un panel lateral, con sesiones por nota o chat general, streaming de respuestas, renderizado Markdown y contador de contexto.
- **Propuestas revisables**: Codex puede proponer crear, actualizar o borrar una nota, pero la app valida el payload y exige confirmación antes de aplicarlo.
- **Tema claro/oscuro** persistente y UI con scrollbars personalizados.

## Stack

| Capa | Tecnología |
| --- | --- |
| Shell de escritorio | Tauri 2 |
| Frontend | React 19, TypeScript 6, Vite 8 |
| Estilos | Tailwind CSS 4 |
| Estado | Zustand 5 |
| Persistencia | SQLite vía `@tauri-apps/plugin-sql` |
| Backend nativo | Rust (edition 2024) |
| IA | Codex CLI (`codex app-server`) |
| Voz | `cpal` + `sherpa-onnx` (Whisper tiny) |
| Iconos | lucide-react |
| Markdown | react-markdown + remark-gfm |

## Requisitos

### Para usar la app

- Linux (los paquetes publicados actualmente son AppImage, `.deb` y `.rpm`). El proyecto está construido sobre Tauri, pero todavía no se publican binarios para Windows ni macOS.
- **Codex CLI** instalado y disponible en `PATH`, con una cuenta iniciada (`codex login`). Es necesario para el chat lateral.
- Micrófono (opcional, solo para dictado).
- Conexión a internet en el primer uso del dictado, para descargar el modelo.

### Para compilar

- Node.js 20.19+ (o 22.12+) y [pnpm](https://pnpm.io/).
- Rust estable y Cargo.
- Dependencias del sistema para Tauri 2 en Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.
- Para el dictado: `libasound2-dev` (ALSA) y las librerías de desarrollo que requiera `sherpa-onnx`.

Consulta los [prerrequisitos oficiales de Tauri](https://tauri.app/start/prerequisites/) si usas otra distribución.

## Instalación

### Desde GitHub Releases

Descarga el paquete desde [v0.1.0](https://github.com/Gxstavo-dev/Mimo/releases/tag/v0.1.0):

- **AppImage**: `mimo_0.1.0_amd64.AppImage`
- **Debian/Ubuntu**: `mimo_0.1.0_amd64.deb`
- **Fedora/RHEL**: `mimo-0.1.0-1.x86_64.rpm`

```bash
chmod +x mimo_0.1.0_amd64.AppImage
./mimo_0.1.0_amd64.AppImage
```

Si el sistema no tiene FUSE 2, ejecuta `./mimo_0.1.0_amd64.AppImage --appimage-extract-and-run`.

En Debian/Ubuntu:

```bash
sudo apt install ./mimo_0.1.0_amd64.deb
```

En Fedora/RHEL:

```bash
sudo dnf install ./mimo-0.1.0-1.x86_64.rpm
```

### Desde el código fuente

```bash
git clone https://github.com/Gxstavo-dev/Mimo.git
cd Mimo
pnpm install
pnpm tauri dev
```

Para generar los paquetes de distribución:

```bash
pnpm tauri build
```

Los artefactos quedan en `src-tauri/target/release/` (binario) y `src-tauri/target/release/bundle/` (`.deb`, `.rpm`, `.AppImage`).

## Uso

1. Pulsa `+` en la barra lateral para crear una nota.
2. Haz clic en el título para editarlo; `Enter` guarda y `Escape` cancela.
3. Escribe `/` en el editor para abrir el menú de bloques.
4. Añade tags con `+ Add tag`; se editan en línea y se eliminan con la `×`.
5. Pulsa `Escape` dos veces seguidas para cerrar la nota actual.
6. Abre el panel de Codex con el icono de la esquina superior derecha. Selecciona una nota o usa el chat general.
7. En el chat, `Enter` envía y `Shift+Enter` añade una línea. Los cambios propuestos aparecen como una tarjeta para revisar y confirmar.
8. El icono de historial (rama) en el panel de Codex muestra las versiones guardadas de la nota vinculada.

## Arquitectura

```
React (UI)
  ├── Zustand: notas, tags, tema, visibilidad del panel, conexión SQLite
  ├── Capa SQL: Notes, Tags, NoteHistory, Tables
  └── Componentes: Sidebar, Content, Editor, EditorBlocks, CodexChat
        │
        │ invoke() / listen()
        ▼
Rust (Tauri)
  ├── plugin-sql ──────────────► SQLite local (appmimo.db)
  ├── dictation.rs ────────────► cpal + sherpa-onnx (Whisper tiny)
  └── codex.rs ────────────────► codex app-server (JSON-RPC por stdio)
```

- La base de datos se crea en el directorio de datos de la app e incluye las tablas `notes`, `tags` y `note_revisions`.
- El editor guarda el contenido como un arreglo JSON de bloques; cada bloque tiene un `id` estable generado en el frontend.
- Los cambios de título, contenido y tags generan revisiones automáticas. Las ediciones separadas por 15 segundos o menos se consolidan en una sola revisión.
- El tema se persiste en `localStorage` (`mimo-theme`) y se aplica con la clase `dark` en `<html>`.

## Integración con Codex

- El backend inicia `codex app-server --listen stdio://` y se comunica mediante JSON-RPC.
- Cada sesión de chat se vincula a una nota o al chat general; los IDs de hilo se guardan en `localStorage` para reanudarlos.
- El hilo se crea con `sandbox: "read-only"` y `approvalPolicy: "on-request"`. Mimo rechaza las solicitudes de ejecución de comandos, cambios de archivos y permisos.
- Solo se envía como contexto la nota seleccionada (título, bloques y tags), tratada explícitamente como datos y no como instrucciones.
- Las instrucciones del agente viven en [`Agent.md`](Agent.md) y se inyectan en cada hilo.
- El modelo responde con un sobre `<MIMO_ACTION>{...}</MIMO_ACTION>`. La app valida tipos de bloque, URLs y límites de tamaño, y muestra una tarjeta de confirmación antes de crear, actualizar o borrar.

Comandos Tauri expuestos:

| Comando | Función |
| --- | --- |
| `codex_status` | Comprueba instalación y cuenta de Codex |
| `codex_ensure_session` | Crea o reanuda un hilo por sesión |
| `codex_send` | Envía un turno y emite eventos de streaming |
| `start_dictation` / `stop_dictation` | Controlan la captura y transcripción |
| `greet` | Comando de ejemplo generado por Tauri |

Eventos del backend: `codex-delta`, `codex-complete`, `codex-context`, `dictation-status`, `dictation-transcript`.

## Dictado

El dictado se ejecuta íntegramente en local:

1. `cpal` captura audio del micrófono.
2. El audio se procesa en segmentos y se transcribe con `sherpa-onnx` usando el modelo **Whisper tiny**.
3. El texto se emite por el evento `dictation-transcript` y se inserta en el bloque activo.
4. El modelo se descarga desde el release oficial de `sherpa-onnx` en el primer uso y se guarda en el directorio de datos de la app.

## Estructura del proyecto

```
.
├── src/
│   ├── components/       # Sidebar, editor, bloques y chat de Codex
│   ├── sql/              # Acceso a SQLite y migraciones
│   ├── store/            # Stores de Zustand
│   ├── assets/
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── codex.rs      # Puente con codex app-server
│   │   ├── dictation.rs  # Captura y transcripción local
│   │   ├── lib.rs        # Plugins y comandos Tauri
│   │   └── main.rs
│   ├── capabilities/
│   ├── icons/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── Agent.md              # Contrato del agente de notas
├── LICENSE
├── NOTICE
└── package.json
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia Vite en el puerto 1420 |
| `pnpm build` | Typecheck y build del frontend |
| `pnpm preview` | Sirve el build de producción |
| `pnpm tauri dev` | Ejecuta la app en modo desarrollo |
| `pnpm tauri build` | Compila binario y paquetes |

## Licencia

Distribuido bajo la **Apache License 2.0**. Consulta [`LICENSE`](LICENSE) y [`NOTICE`](NOTICE).

Las dependencias de terceros conservan sus propias licencias; las versiones están fijadas en `Cargo.lock` y `pnpm-lock.yaml`.

## Créditos

Creado por [Gxstavo-dev](https://github.com/Gxstavo-dev).

Inspirado en la simplicidad de las notas personales y potenciado por [Codex](https://openai.com/codex/), [Tauri](https://tauri.app/), [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) y el ecosistema de React.
