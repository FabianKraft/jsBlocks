# jsBlocks

**Function Block Diagram (FBD) Simulator for PLCs — written in pure JavaScript.**

jsBlocks is a browser-based simulator for designing and simulating Function Block Diagrams following the [IEC 61131-3](https://en.wikipedia.org/wiki/IEC_61131-3) standard for process control programming. Build PLC logic visually using 40+ built-in block types, wire them together, and run real-time simulation — all with zero build steps or server requirements.

**[Watch the Demo Video](https://youtu.be/VDzM3FngfBk)**

> **Original Author:** Shawn Summey (created 2007) · **Current Maintainer:** Fabian Kraft (actively developed since early 2026, with AI assistance) · **License:** [MIT](LICENSE)

---

## Table of Contents

- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Block Library](#block-library)
  - [Bit Logic](#bit-logic)
  - [Timers](#timers)
  - [Inputs and Outputs](#inputs-and-outputs)
  - [Math](#math)
  - [Analog Logic](#analog-logic)
  - [Organization and Drawing](#organization-and-drawing)
- [Keyboard and Mouse Shortcuts](#keyboard-and-mouse-shortcuts)
- [Custom Blocks](#custom-blocks)
- [Templates](#templates)
- [Project Structure](#project-structure)
- [Technical Notes](#technical-notes)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Key Features

### Canvas and Navigation

- **Infinite Pan/Zoom Canvas** — 10,000 × 10,000 px canvas with mouse wheel zoom (10%–500%), middle-mouse or Alt+drag panning, and middle-mouse double-click to reset zoom.
- **Grid and Snap** — Toggleable background grid, snap-to-grid for block placement, configurable grid size (1–100 px).
- **Snap Points** — Special SNAP blocks act as magnetic alignment anchors for placing blocks precisely.
- **Page Format Markings** — Dashed page boundary lines and page labels overlaid on the canvas for print layout (A4/A3, portrait/landscape).
- **Coordinate Display** — Real-time mouse position and selected block position shown in the toolbar.

### Block Editing

- **40+ Built-in Block Types** — Organized into categories: Bit Logic, Timers, I/O, Math, Analog Logic, and Organization/Drawing.
- **Visual Wiring** — Click an output connector and drag to an input connector to create a connection. Lines auto-route with Z-shaped paths and can be grid-snapped.
- **Connector Inversion** — Double-click any boolean connector to add or remove an inversion bubble (NOT gate).
- **Delay Symbols** — Orange diamond indicators on wires when a connection has an execution-order delay.
- **Execution Order Display** — Toggle numbered badges showing block execution sequence.
- **Multi-select and Group Move** — Click blocks, Shift+click for multi-select, drag on empty canvas for rectangle selection. Drag any selected block to move the entire group.
- **Copy and Paste** — Ctrl+C copies selected blocks (including connections between them), Ctrl+V pastes with offset. Repeated pastes cascade position.
- **Arrow Key Nudging** — Move selected blocks 1 px (or 10 px with Shift).
- **Line Selection and Deletion** — Click wires to select, Shift+click for multi-select, Delete to remove.
- **Block Drag Preview** — Visual arrow/line preview while dragging a connection.
- **Modal Dialogs** — Clean modal system for block configuration (e.g., AND/OR input count, math data type selection).
- **Toolbar Shortcut Buttons** — Quick-access buttons for common block types (DI, DO, AI, AQ, V, C, &, ≥1, SR, RS, RT, FT, TON, TOF, Comment, Line, Snap).

### Simulation

- **Real-time Simulation** — Configurable scan cycle (1 ms to 500 ms) with visual feedback using color-coded boolean states (green = true, blue = false).

### Save, Load, and Export

- **Save and Load Projects** — Export to JSON file and import back. Preserves all blocks, connections, inversions, custom block definitions, and block properties.
- **PDF Export** — Export canvas to multi-page PDF with page format options (A4/A3, portrait/landscape). Only pages that contain content are exported. Rendered as true vector graphics (crisp at any zoom, selectable text, tiny files) via [jsPDF](https://github.com/parallax/jsPDF) from CDN.
- **Node-RED Export** — Export the logic as a ready-to-import [Node-RED](https://nodered.org/) **Function node** (the `NR` toolbar button). See [Node-RED Export](#node-red-export) below.

### Customization

- **Custom Block Editor** — Visual editor for creating user-defined blocks with custom name, symbol, dimensions, configurable I/O pins (Bool, Int, Real types), internal state variables, JavaScript code body, validation, and test-before-save.
- **Custom Block Manager** — List, edit, delete, export, and import custom blocks. Persistent storage in browser `localStorage`.
- **Settings Panel** — Centralized settings overlay with toggles for grid, snap, execution order, delay symbols, page format, simulation speed, and more.
- **Keyboard Shortcuts Help** — Dedicated overlay showing all keyboard and mouse shortcuts (accessed via the `?` button).

### Templates

- **Built-in Template Library** — Categorized example projects loaded from the `templates/` directory, including AND gate layout, digital I/O logic, dual input timer, timer delay logic, timer off-delay, XOR edge detection, XOR with trigger, drawing template, and page layout frame.

---

## Getting Started

1. **Clone or download** the repository.
2. **Open `index.htm`** in a modern web browser (Chrome, Firefox, Edge, or Safari).
3. **Select a block type** from the dropdown or click a toolbar shortcut button.
4. **Double-click on the canvas** to place the block.
5. **Wire blocks** by clicking an output connector (right side) and dragging to an input connector (left side).
6. **Click the ▶ Start button** to begin simulation.

> **Tip:** To use **Templates**, serve the files via a local web server (e.g., `python3 -m http.server`) because templates are loaded via `XMLHttpRequest` and require the `http://` protocol.

---

## Block Library

### Bit Logic

| Block | Symbol | Description |
|-------|--------|-------------|
| AND | `&` | 2–8 input AND gate. Configurable input count. |
| OR | `≥1` | 2–8 input OR gate. Configurable input count. |
| XOR | `x` | 2-input exclusive OR. |
| NOT | | Single-input negation. |
| SR | `SR` | Set-dominant set/reset latch. |
| RS | `RS` | Reset-dominant reset/set latch. |
| R_TRIG | `R_TRIG` | Rising edge detector. |
| F_TRIG | `F_TRIG` | Falling edge detector. |

### Timers

| Block | Description |
|-------|-------------|
| TON | Timer on-delay. |
| TOF | Timer off-delay. |
| TONR | Retentive timer on-delay. |

### Inputs and Outputs

| Block | Description |
|-------|-------------|
| DI | Digital input — click to toggle on/off. Supports keyboard key binding during simulation. |
| DO | Digital output — displays connected boolean value with color feedback. |
| AI | Analog input — click center to enter value, click left/right to increment/decrement. |
| AQ | Analog output — displays connected analog value. |
| CONST | Constant value output. |
| VAR | Named variable — acts as a named signal bus (all VARs with same name share value). |

### Math

| Block | Description |
|-------|-------------|
| ADD | Addition (IN1 + IN2). Configurable: Real or Int. |
| SUB | Subtraction (IN1 − IN2). |
| MUL | Multiplication (IN1 × IN2). |
| DIV | Division (IN1 ÷ IN2). |

### Analog Logic

| Block | Description |
|-------|-------------|
| NORM_X | Normalize value to 0.0–1.0 range. |
| SCALE_X | Scale normalized value to engineering range. |
| LIMIT | Clamp value between min and max. |
| MOVE | Pass-through / signal routing. |
| INT_TO_REAL | Convert integer to real. |
| REAL_TO_INT | Convert real to integer (with round mode). |
| MUX | Multiplexer — select one of multiple inputs. |
| DEMUX | Demultiplexer — route input to selected output. |
| IN_RANGE | Check if value is within range. |
| OUT_RANGE | Check if value is outside range. |
| CMP | Compare two values. |
| BIT_TO_WORD | Pack 16 boolean inputs into a word. |
| WORD_TO_BIT | Unpack a word into 16 boolean outputs. |

### Organization and Drawing

| Block | Description |
|-------|-------------|
| JUNCTION | Wire junction point for routing. |
| LABEL IN / LABEL OUT | Named jump connections (wires across the sheet without visible lines). |
| LABEL IN (Panel) / LABEL OUT (Panel) | Panel-style label connectors. |
| TAG LABEL IN / TAG LABEL OUT | Tag-based label connectors. |
| COMMENT | Resizable text annotation block. |
| LINE | Free drawing line with configurable color, thickness, and style (solid, dashed, dotted). |
| SNAP | Magnetic snap point for block alignment. |

### Additional Blocks (available in code)

These blocks are defined in the source but may not appear in the default dropdown:

- **FirstOrderLag** — First-order lag filter.
- **Select** — Conditional selection.
- **OneSecondTimer** — 1-second pulse timer.
- **Ain** — Analog input (alternate).

---

## Keyboard and Mouse Shortcuts

### Navigation

| Action | Shortcut |
|--------|----------|
| Pan canvas | Middle Mouse drag or Alt + drag |
| Zoom in / out | Scroll Wheel |
| Reset zoom to 100% | Middle Mouse double-click |

### Blocks

| Action | Shortcut |
|--------|----------|
| Place block | Double-click on canvas |
| Move block | Drag block |
| Nudge block 1 px | Arrow keys |
| Nudge block 10 px | Shift + Arrow keys |
| Open block settings | Double-click on block |
| Select block | Click on block |
| Multi-select | Shift + click |
| Selection rectangle | Drag on empty canvas |
| Add to selection (rect) | Shift + drag on empty canvas |
| Delete selected | Delete or Backspace |
| Copy selected blocks | Ctrl + C |
| Paste blocks | Ctrl + V |
| Deselect all | Escape |

### Connections

| Action | Shortcut |
|--------|----------|
| Connect blocks | Click output → release on input |
| Select line | Click on line |
| Delete line | Select line + Delete |
| Invert connector (bool) | Double-click on connector |

### Simulation

| Action | Shortcut |
|--------|----------|
| Start / Stop | Click Start / Stop button |
| Toggle DI (if key-bound) | Press assigned key during simulation |

---

## Custom Blocks

jsBlocks includes a powerful visual editor for creating user-defined blocks with custom logic.

### Creating a Custom Block

1. Click **"+ New Block"** in the toolbar.
2. Define the block **name**, **symbol text**, and **dimensions**.
3. Add **input/output pins** with data types (`Bool`, `Int`, `Real`) and positions.
4. Add **state variables** if the block needs memory between scan cycles.
5. Write the **JavaScript code body** using `__in[index]` to read inputs and `__state.name` for state.
6. Click **Test** to validate, then **Save**.
7. The custom block appears in the block dropdown and can be placed like any built-in block.

### Managing Custom Blocks

- Use the **"☰ Blocks"** menu to list, edit, delete, export, and import custom blocks.
- Custom block definitions are stored in browser `localStorage` and persist across sessions.
- Export and import custom block definitions as JSON files for sharing.

### Custom Block Code API

| API | Description |
|-----|-------------|
| `__in[index]` | Read the value of the input pin at the given index. |
| `__state.name` | Read/write a persistent state variable. |
| `__out[index]` | Set the value of the output pin at the given index. |

---

## Templates

The `templates/` directory contains categorized example projects to help you get started quickly.

| Template | Description |
|----------|-------------|
| `and_gate_layout.json` | AND gate layout example. |
| `digital_io_logic.json` | Digital I/O logic example. |
| `dual_input_timer.json` | Dual input timer example. |
| `timer_delay_logic.json` | Timer delay logic example. |
| `timer_off_delay.json` | Timer off-delay example. |
| `xor_edge_detection.json` | XOR edge detection example. |
| `xor_with_trigger.json` | XOR with trigger example. |
| `drawing_template.json` | Drawing and annotation example. |
| `page_layout_frame.json` | Page layout frame example. |

> **Note:** Templates are loaded via `XMLHttpRequest`. To use them, serve the project via a local web server (e.g., `python3 -m http.server`) rather than opening `index.htm` directly from the file system.

---

## Project Structure

```
jsBlocks/
├── index.htm                         # Main application (open in browser)
├── scripts/
│   ├── SheetObject.js                # Canvas manager, simulation engine, save/load
│   ├── BaseBlockObject.js            # Base class for all blocks
│   ├── FunctionBlockObjects.js       # All 40+ built-in block implementations
│   ├── ConnectorObject.js            # Connector (pin) logic and rendering
│   ├── LineObject.js                 # Wire rendering and routing
│   ├── CustomBlock.js                # Custom block editor, manager, and runtime
│   ├── PdfExport.js                  # Vector PDF exporter
│   ├── NodeRedExport.js              # Node-RED Function-node exporter
│   └── __tests__/                    # Headless tests (node --test)
├── templates/
│   ├── templates.json                # Template index file
│   ├── and_gate_layout.json          # AND gate example
│   ├── digital_io_logic.json         # Digital I/O example
│   ├── timer_delay_logic.json        # Timer delay example
│   ├── timer_off_delay.json          # Timer off-delay example
│   ├── dual_input_timer.json         # Dual input timer example
│   ├── xor_edge_detection.json       # XOR edge detection example
│   ├── xor_with_trigger.json         # XOR with trigger example
│   ├── drawing_template.json         # Drawing template
│   └── page_layout_frame.json        # Page layout frame
├── Examples/
│   └── jsblocks_project*.json        # Example project files (9 samples)
├── LICENSE                           # MIT License
├── jsBlocksModules.md                # Module refactoring guide (future plans)
└── README.md                         # This file
```

---

## Node-RED Export

The **`NR`** toolbar button exports the current logic as a [Node-RED](https://nodered.org/) clipboard flow containing a **single, self-contained Function node**. In Node-RED, use **Import → paste the JSON → Import**, and drop the ready node onto a flow. No manual editing is required.

### How the exported node behaves

- **Name** — the exported Function node is named after the project.
- **Inputs** — `DI`/`AI` blocks are driven by incoming messages: `msg.topic` selects the tag, `msg.payload` its value. Example: `{ topic: "S1", payload: true }` sets the `DI` tagged `S1`. The latest value per tag is held in a process image (like a PLC I/O table); messages are not queued.
- **Scan loop** — an internal `setInterval` re-evaluates all blocks once per cycle, in the same execution order as the simulator, using the project's configured simulation cycle (floored at 10 ms). It starts automatically on deploy (*On Start*) and stops cleanly on redeploy (*On Stop*).
- **Timers** — use real wall-clock time, so `TON`/`TOF`/etc. stay accurate regardless of the scan interval. (Accelerated simulation is intentionally not supported.)
- **Outputs** — `DO`/`AQ` blocks emit a message in the same shape as the inputs (`{ topic, payload }`) **only when their value changes**, keeping the flow quiet.

### Robustness

- **Single source of truth** — every block's emitted logic lives in one registry (`BLOCK_REGISTRY` in `scripts/NodeRedExport.js`).
- **Fails loud, never silent** — if the sheet contains a block the exporter does not yet support, the export **aborts** and lists the offending blocks instead of generating a subtly wrong node.
- **Headless tests** — `scripts/__tests__/nodeRedExport.test.js` executes the generated node against IEC 61131-3 semantics. Run with:

  ```bash
  node --test scripts/__tests__/nodeRedExport.test.js
  ```

### Currently supported blocks

- **I/O:** `DI`, `DO`, `AI`, `AQ`
- **Bit logic:** `AND`, `OR`, `XOR`, `NOT`, `SR`, `RS`, `R_TRIG`, `F_TRIG`
- **Timers:** `TON`, `TOF`, `TONR`, `1 SEC TIMER` (real wall-clock; ms except `1 SEC TIMER` in seconds)
- **Math:** `ADD`, `SUB`, `MUL`, `DIV`, `INT_TO_REAL`, `REAL_TO_INT`
- **Analog:** `NORM_X`, `SCALE_X`, `LIMIT`, `MOVE`, `AIN`, `1ST ORDER` (first-order lag), `MUX`, `DEMUX`, `SELECT`
- **Comparators:** `CMP`, `GT`, `LT`, `IN_RANGE`, `OUT_OF_RANGE`
- **Word/bit:** `PACK 16`, `UNPACK 16`
- **Values:** `Constant`, `Variable` (display-only sink)
- **Cross-page connectors:** `Junction`, `Label In/Out (Panel)`, `Tag Label In/Out`, `Jump In/Out` — resolved to named in-memory signal buses
- **Custom blocks** — the user's JavaScript body is inlined verbatim (same `__in`/`__out`/`__state` contract as the editor), with state bound to the node's context. Unsafe APIs or syntax errors abort the export.

**All computational block types are supported.** Only purely visual elements (comments, lines, snap points) are ignored. Cross-page connectors carry a one-scan delay when the sink is evaluated before its source, exactly as in the simulator.

---

## Technical Notes

- **Pure vanilla JavaScript** — no frameworks, no build tools, no npm install.
- All blocks are **HTML DIV elements** positioned absolutely on the canvas.
- Simulation runs on a `setInterval` loop calling each block's `Execute()` method in index order.
- **Boolean visualization:** green = true (high), blue = false (low).
- **Analog connectors** are colored orange (`rgb(255, 172, 26)`); boolean connectors are black.
- Canvas uses CSS `transform: translate() scale()` for pan and zoom.
- Custom blocks are stored in `localStorage` and persist across sessions.
- Project files use a JSON schema with `version`, `blocks`, `connections`, and `customDefinitions` fields.
- External CDN dependency (for PDF export only): [jsPDF](https://github.com/parallax/jsPDF). The sheet is walked and drawn as PDF vector primitives by `scripts/PdfExport.js` — no rasterization library is needed.

---

## Known Limitations

- **No type checking** — connecting a boolean output to an analog input is allowed without warning.
- **Simple line routing** — Z-shaped or reverse-routing only, with no automatic collision avoidance.
- **No undo/redo** support.
- **Single-sheet design** — no multi-page tabs, though page markings help with print layout.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.
