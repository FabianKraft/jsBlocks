# jsBlocks Refactoring — Module Implementation Guide

## Overview

Refactor the jsBlocks browser-based FBD simulator into a **shared-core architecture**
that supports both the existing standalone web app **and** a new Node-RED node,
without maintaining two separate codebases.

```
jsBlocks/
├── core/                    ← Framework-agnostic. No DOM. No Node-RED.
│   ├── blocks/              ← Block definitions + Execute() logic
│   ├── engine/              ← Simulation runner, connection model
│   └── serializer/          ← JSON save/load + JS code export
│
├── web/                     ← Thin shell: browser UI (existing app, refactored)
│   ├── index.htm
│   ├── dom-renderer.js      ← Draws blocks as DIVs, handles mouse
│   ├── connector-renderer.js
│   ├── line-renderer.js
│   ├── sheet-ui.js          ← Canvas, pan/zoom, selection rectangle
│   ├── modal.js             ← Settings dialogs
│   └── adapter.js           ← Bridge: UI ↔ core (direct calls in standalone)
│
└── node-red/                ← Thin shell: Node-RED integration
    ├── package.json
    ├── nodes/
    │   ├── jsblocks.js      ← Server-side: wraps core engine, handles msg I/O
    │   └── jsblocks.html    ← Editor: embeds web/ UI in config dialog
    └── lib/
        └── node-red-adapter.js  ← Bridge: UI ↔ server-side core over HTTP/WS
```

---

## Implementation Order

Build and test incrementally. Each step must be testable before the next begins.

| Step | Module | Rationale |
|------|--------|-----------|
| 1 | `core/types.js` | Foundation — all other modules depend on these type definitions. Zero external deps. |
| 2 | `core/blocks/base-block.js` | Base class that all block types extend. Must exist before any concrete block. |
| 3 | `core/blocks/logic-blocks.js` | AND, OR, XOR, NOT — simplest stateless blocks. Proves the extraction pattern. |
| 4 | `core/blocks/math-blocks.js` | ADD, SUB, MUL, DIV, NORM_X, SCALE_X — stateless math. Same pattern as step 3. |
| 5 | `core/blocks/timer-blocks.js` | TON, TOF, TONR — stateful, needs time. Proves state persistence works. |
| 6 | `core/blocks/trigger-blocks.js` | R_TRIG, F_TRIG — stateful edge detection. Simple state. |
| 7 | `core/blocks/latch-blocks.js` | SR, RS — stateful latches. |
| 8 | `core/blocks/io-blocks.js` | DI, DO, AI, AQ — the msg boundary blocks for Node-RED. |
| 9 | `core/blocks/utility-blocks.js` | MOVE, LIMIT, SELECT, MUX, DEMUX, CONVERT, CONSTANT, VARIABLE, etc. |
| 10 | `core/blocks/panel-blocks.js` | LabelInPanel, LabelOutPanel, TagLabelIn, TagLabelOut, JumpIn, JumpOut, Junction. |
| 11 | `core/blocks/index.js` | Block registry. Depends on all block modules. |
| 12 | `core/engine/connection-model.js` | Wire/connection model. Depends on `core/types.js`. |
| 13 | `core/engine/simulation-runner.js` | Tick loop, execution order. Depends on blocks + connections. **First integration test point.** |
| 14 | `core/serializer/json-serializer.js` | Save/load JSON. Depends on block registry + connection model. Test: round-trip existing `.json` files from `Examples/`. |
| 15 | `core/serializer/js-exporter.js` | Export standalone JS. Depends on same as step 14. |
| 16 | `web/adapter.js` | Bridge interface. Must exist before web shell can use core. |
| 17 | `web/dom-renderer.js` + `web/connector-renderer.js` + `web/line-renderer.js` | Visual layer. Depends on adapter + core. |
| 18 | `web/sheet-ui.js` + `web/modal.js` | Canvas management, dialogs. Depends on renderers. |
| 19 | `web/index.htm` | Wire up the standalone web app. **Second integration test point: full standalone app works.** |
| 20 | `node-red/nodes/jsblocks.js` | Server-side node. Depends on core engine. |
| 21 | `node-red/nodes/jsblocks.html` | Editor UI embedding web/. Depends on step 19 + 20. **Final integration test.** |

---

## Shared Conventions

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Block type name (objectName) | PascalCase, matches class name minus "Block" suffix | `"And"`, `"Ton"`, `"Di"` |
| Block class | PascalCase + "Block" suffix | `AndBlock`, `TonBlock` |
| Core module files | kebab-case | `logic-blocks.js`, `simulation-runner.js` |
| Connector pin names | Uppercase, match IEC 61131-3 labels | `"IN"`, `"Q"`, `"PT"`, `"ET"` |
| Data types | Lowercase string enum | `"bool"`, `"int"`, `"real"` |
| Node-RED msg.topic | Matches the block's `tagName` property | `"S1"`, `"Motor_Start"` |

### Data Types

```javascript
// core/types.js
const DataType = {
  BOOL: "bool",   // 0 or 1
  INT: "int",     // integer (JS number, rounded)
  REAL: "real",   // float (JS number)
};
```

### Block/Connection Graph JSON Schema

This is the canonical save format, shared by standalone web and Node-RED:

```json
{
  "version": 1,
  "cycleTimeMs": 100,
  "blocks": [
    {
      "type": "And",
      "left": 200,
      "top": 100,
      "props": {
        "numberInputs": 3
      },
      "inInversions": [false, false, false],
      "outInversions": [false]
    },
    {
      "type": "Di",
      "left": 50,
      "top": 100,
      "props": {
        "tagName": "S1",
        "comment": "Start button"
      },
      "inInversions": [],
      "outInversions": [false]
    }
  ],
  "connections": [
    {
      "fromBlock": 1,
      "fromPin": 0,
      "toBlock": 0,
      "toPin": 0
    }
  ],
  "customDefinitions": {}
}
```

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version for forward compat |
| `cycleTimeMs` | number | Simulation cycle time in ms (default: 100) |
| `blocks[].type` | string | Block `objectName` (e.g., `"And"`, `"Ton"`) |
| `blocks[].left/top` | number | Position (used by web shell for rendering; ignored by core engine) |
| `blocks[].props` | object | Block-specific configurable properties |
| `blocks[].inInversions/outInversions` | boolean[] | Per-pin inversion state |
| `connections[].fromBlock/toBlock` | number | Index into `blocks[]` array |
| `connections[].fromPin/toPin` | number | Index into block's `outConnections[]` / `inConnections[]` |
| `customDefinitions` | object | Map of custom block name → definition (for CustomBlock support) |

### Node-RED msg Convention

| Block Type | Direction | msg.topic | msg.payload type |
|-----------|-----------|-----------|-----------------|
| DI | Input (into node) | `block.tagName` | `boolean` (true/false or 0/1) |
| AI | Input (into node) | `block.tagName` | `number` |
| DO | Output (from node) | `block.tagName` | `boolean` |
| AQ | Output (from node) | `block.tagName` | `number` |
| LabelOutPanel | Input (into node) | `block.labelName` | matches `block.labelType` |
| LabelInPanel | Output (from node) | `block.labelName` | matches `block.labelType` |

Messages are routed by `msg.topic`. Multiple DI blocks each have a unique `tagName`, so the Node-RED node routes incoming messages to the correct block by matching `msg.topic` against all DI/AI/LabelOutPanel `tagName`/`labelName` values.

### Block Properties — Where They Live

| Property | Stored In | Used By |
|----------|-----------|---------|
| `tagName`, `comment` | `block.props` in JSON, `this.tagName` in core block instance | Core (for I/O routing), Web (for display), Node-RED (for msg.topic) |
| `numberInputs` (AND/OR/XOR) | `block.props.numberInputs` | Core (for Execute logic + pin count), Web (for sizing) |
| `mathDataType` (ADD/SUB/MUL/DIV) | `block.props.mathDataType` | Core (for type casting in Execute) |
| `divWidth`, `divHeight` | Not in props — computed by web renderer | Web only |
| `left`, `top` | Top-level in JSON | Web only (core ignores position) |

---

## Module Specifications

---

### Module: `core/types.js`

**Target path:** `core/types.js`

**Purpose:** Shared type definitions, enums, and constants used by all core modules. No logic, just definitions.

**Public interface:**

```javascript
/** @enum {string} */
export const DataType = {
  BOOL: "bool",
  INT: "int",
  REAL: "real",
};

/**
 * @typedef {Object} PinDescriptor
 * @property {string} name        - Display label, e.g. "IN", "Q", "PT"
 * @property {DataType} dataType  - "bool", "int", or "real"
 * @property {number} position    - Percentage along edge (0-100), e.g. 38
 * @property {string} [tooltip]   - Optional tooltip text
 */

/**
 * @typedef {Object} BlockDescriptor
 * @property {string} objectName        - Unique type identifier, e.g. "And"
 * @property {string} displayName       - Header text, e.g. "&"
 * @property {PinDescriptor[]} inputs   - Input pin definitions
 * @property {PinDescriptor[]} outputs  - Output pin definitions
 * @property {Object} [defaultProps]    - Default configurable properties
 */

/**
 * @typedef {Object} ConnectionData
 * @property {number} fromBlock  - Source block index
 * @property {number} fromPin    - Source output pin index
 * @property {number} toBlock    - Target block index
 * @property {number} toPin      - Target input pin index
 */

/**
 * @typedef {Object} BlockData
 * @property {string} type              - objectName, e.g. "And"
 * @property {number} left
 * @property {number} top
 * @property {Object} props             - Block-specific properties
 * @property {boolean[]} inInversions   - Per-input inversion
 * @property {boolean[]} outInversions  - Per-output inversion
 */

/**
 * @typedef {Object} ProjectData
 * @property {number} version
 * @property {number} [cycleTimeMs]     - Simulation cycle time (default 100)
 * @property {BlockData[]} blocks
 * @property {ConnectionData[]} connections
 * @property {Object} customDefinitions
 */
```

**Internal state:** None — pure definitions.

**Dependencies:** None.

**Migration notes:** New file. Types are derived by analyzing the patterns across:
- `ConnectorObject.js` L22–28: `dataType` field, `type` (1=input, 0=output), `pinLocation` (percentage)
- `BaseBlockObject.js` L27–38: `Base` constructor fields (`divHeight`, `divWidth`, `text`, `objectName`)
- `SheetObject.js` L919–962: `saveProject()` structure — `blocks[]`, `connections[]`, `customDefinitions`

---

### Module: `core/blocks/base-block.js`

**Target path:** `core/blocks/base-block.js`

**Purpose:** Abstract base class for all block types. Manages pin arrays, inversion state, serialization hooks, and the `execute()` contract. **No DOM.** This is the core equivalent of the current `Base()` in `BaseBlockObject.js`, stripped of all visual concerns.

**Public interface:**

```javascript
export class BaseBlock {
  /**
   * @param {BlockDescriptor} descriptor
   * @param {Object} [props] - Override default props
   */
  constructor(descriptor, props);

  /** @type {string} */
  objectName;

  /** @type {string} */
  displayName;

  /** @type {Object} */
  props;

  /** @type {{ value: number|boolean, inverted: boolean, dataType: string }[]} */
  inPins;

  /** @type {{ value: number|boolean, inverted: boolean, dataType: string }[]} */
  outPins;

  /**
   * Read effective input value (traverses wire + applies inversion).
   * @param {number} pinIndex
   * @returns {number|boolean}
   */
  getInputValue(pinIndex);

  /**
   * Read effective output value (applies output inversion).
   * @param {number} pinIndex
   * @returns {number|boolean}
   */
  getOutputValue(pinIndex);

  /**
   * Execute the block's logic. Subclasses MUST override this.
   * Reads from inPins (via wires), writes to outPins.
   */
  execute();

  /**
   * Serialize block-specific properties.
   * @param {Object} target - Mutable object to write props into
   */
  serializeProps(target);

  /**
   * Restore block-specific properties from saved data.
   * Called after construction during project load.
   * @param {Object} props
   */
  applyProps(props);
}
```

**Internal state:**
- `inPins[]` / `outPins[]`: Array of pin objects with `{ value, inverted, dataType }`. These replace the DOM-bound `Connector` objects from `ConnectorObject.js`.
- `props`: Block-specific configurable values (e.g., `{ numberInputs: 2 }` for AND).

**State persistence/restoration:**
- `serializeProps(target)` writes current props to a plain object.
- `applyProps(props)` restores them. Called during `_restoreProject()`.

**Dependencies:** `core/types.js`

**Migration notes:**
- Extracted from `BaseBlockObject.js` L27–38 (`Base()` constructor), L298–302 (`addConnections`), L376–430 (`serialize`, `restoreInversions`, `_serializeProps`, `applySerializedProps`).
- **Removed:** All DOM creation (`document.createElement` in L47–71), mouse event handlers (L102–137), `mousedownHandler`/`moveHandler`/`mouseupHandler`/`mouseoverHandler`/`mouseoutHandler` (L139–292), `clickHandler`, `dblclickHandler` (L293–308), `removeConnectors` DOM cleanup (L350–372), `_updateExecOrderPosition` (L339–348).
- **Kept:** The `getInputValue()` pattern from `ConnectorObject.js` L188–195 (which handles `connectedFrom` traversal + inversion) — adapted to use wire references instead of DOM connector references.
- **Key change:** `inConnections[]` and `outConnections[]` become `inPins[]` and `outPins[]` — lightweight data objects instead of DOM-aware `Connector` instances. The wire/connection graph is managed externally by `core/engine/connection-model.js` rather than being embedded in connector objects.

---

### Module: `core/blocks/logic-blocks.js`

**Target path:** `core/blocks/logic-blocks.js`

**Purpose:** Stateless boolean logic blocks: AND, OR, XOR, NOT. These are the simplest blocks and serve as the template for all others.

**Public interface:**

```javascript
export class AndBlock extends BaseBlock {
  constructor(props);
  execute();
  serializeProps(target);
  applyProps(props);
}

export class OrBlock extends BaseBlock {
  constructor(props);
  execute();
  serializeProps(target);
  applyProps(props);
}

export class XorBlock extends BaseBlock {
  constructor(props);
  execute();
  serializeProps(target);
  applyProps(props);
}

export class NotBlock extends BaseBlock {
  constructor(props);
  execute();
}
```

**Internal state:**
- AND/OR/XOR: `props.numberInputs` (2–8). This drives the pin count dynamically.
- NOT: No extra state.

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source File | Lines | Key Extraction |
|-------|------------|-------|----------------|
| AND | `FunctionBlockObjects.js` | L28–126 | `Execute()` at L114–126: `this.stack = this.stack && this.inConnections[i].getInputValue()`. Remove border styling (L121, L124). `_applyInputCount` logic (L48–60) becomes `applyProps`. `addConnections` (L90–112) becomes pin definitions in descriptor. |
| OR | `FunctionBlockObjects.js` | L132–233 | `Execute()` at L218–230: Same pattern as AND but with `\|\|`. Remove border styling. |
| XOR | `FunctionBlockObjects.js` | L892–993 | `Execute()` at L976–988: XOR accumulation via `this.stack = this.stack ^ input`. Remove border styling. |
| NOT | `FunctionBlockObjects.js` | L3164–3193 | `Execute()` at L3185–3192: `if (input == 0) output = 1 else output = 0`. Remove border styling. |

**Common change for all blocks:** Replace `this.inConnections[i].getInputValue()` with `this.getInputValue(i)`. Replace `this.outConnections[0].value = X` with `this.outPins[0].value = X`. All `this.divObj.style.border = ...` lines are removed — the web shell handles visual feedback.

---

### Module: `core/blocks/math-blocks.js`

**Target path:** `core/blocks/math-blocks.js`

**Purpose:** Arithmetic and scaling blocks: ADD, SUB, MUL, DIV, NORM_X, SCALE_X, LIMIT, GT, LT, CMP, IN_RANGE, OUT_OF_RANGE.

**Public interface:**

```javascript
export class AddBlock extends BaseBlock { ... }
export class SubtractBlock extends BaseBlock { ... }
export class MultiplyBlock extends BaseBlock { ... }
export class DivideBlock extends BaseBlock { ... }
export class NormXBlock extends BaseBlock { ... }
export class ScaleXBlock extends BaseBlock { ... }
export class LimitBlock extends BaseBlock { ... }
export class GtBlock extends BaseBlock { ... }
export class LtBlock extends BaseBlock { ... }
export class CmpBlock extends BaseBlock { ... }
export class InRangeBlock extends BaseBlock { ... }
export class OutOfRangeBlock extends BaseBlock { ... }
```

**Internal state:**
- ADD/SUB/MUL/DIV/LIMIT/MOVE/CMP: `props.mathDataType` (`"real"` or `"int"`). Drives pin data types and rounding behavior.

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| ADD | `FunctionBlockObjects.js` | L2838–2914 | `Execute()` L2904–2913: `a + b`, with `Math.round()` for int. Remove DOM. |
| SUB | `FunctionBlockObjects.js` | L3086–3162 | `Execute()` L3152–3161: `a - b`. Same int/real pattern. |
| MUL | `FunctionBlockObjects.js` | L2916–2992 | `Execute()` L2982–2991: `a * b`. |
| DIV | `FunctionBlockObjects.js` | L2994–3084 | `Execute()` L3072–3083: `a / b`, with division-by-zero guard at L3079. |
| NORM_X | `FunctionBlockObjects.js` | L1137–1184 | `Execute()` L1169–1183: `(value - min) / (max - min)`. Division-by-zero guard at L1179. |
| SCALE_X | `FunctionBlockObjects.js` | L1190–1240 | `Execute()` L1218–1239: `min + value * (max - min)`. |
| LIMIT | `FunctionBlockObjects.js` | L1241–1333 | `Execute()` L1306–1330: Clamp value between min and max. |
| GT | `FunctionBlockObjects.js` | L2557–2588 | `Execute()` L2577–2588: `in1 > in2`. Remove border. |
| LT | `FunctionBlockObjects.js` | L2594–2630 | `Execute()` L2609–2620: `in1 < in2`. |
| CMP | `FunctionBlockObjects.js` | L1996–2108 | `Execute()` — comparison block with EQ/NE/GT/LT/GE/LE outputs. |
| IN_RANGE | `FunctionBlockObjects.js` | L1808–1901 | Range check block. |
| OUT_OF_RANGE | `FunctionBlockObjects.js` | L1902–1995 | Inverse range check. |

---

### Module: `core/blocks/timer-blocks.js`

**Target path:** `core/blocks/timer-blocks.js`

**Purpose:** IEC 61131-3 timer blocks: TON (on-delay), TOF (off-delay), TONR (retentive on-delay), OneSecondTimer. These are **stateful** — they track timing state across execute calls.

**Public interface:**

```javascript
export class TonBlock extends BaseBlock {
  constructor(props);
  execute();
  serializeProps(target);
  applyProps(props);
}
export class TofBlock extends BaseBlock { ... }
export class TonrBlock extends BaseBlock { ... }
export class OneSecondTimerBlock extends BaseBlock { ... }
```

**Internal state (must persist across cycles):**

| Block | State Fields | Description |
|-------|-------------|-------------|
| TON | `startTime`, `isTiming` | Tracks when timing started and whether active |
| TOF | `startTime`, `isTiming`, `wasOn` | Tracks off-delay start and previous input state |
| TONR | `accumulatedTime`, `lastTime`, `isTiming` | Accumulates elapsed time across multiple start/stop cycles |
| OneSecondTimer | `isTiming`, `doneTiming`, `startTime`, `currentTime`, `timerTime` | 1-second interval timer |

**State persistence/restoration:**
- Timer state (`startTime`, `isTiming`, etc.) is **runtime-only** — it is NOT saved to JSON. On project load, timers start fresh.
- In Node-RED mode, state lives in the server-side block instance in memory. If Node-RED restarts, timer state resets (acceptable — same as PLC power cycle).

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| TON | `FunctionBlockObjects.js` | L558–640 | `Execute()` L609–640: `new Date().getTime()` for wall clock. Input: IN (bool), PT (int, ms). Output: Q (bool), ET (int, ms). Core change: accept current time as parameter `execute(now)` instead of calling `new Date()` — makes it testable and Node-RED-compatible. |
| TOF | `FunctionBlockObjects.js` | L646–728 | `Execute()` L692–728: Off-delay. State: `wasOn` flag, `startTime`. Same `execute(now)` pattern. |
| TONR | `FunctionBlockObjects.js` | L734–834 | `Execute()` L795–833: Retentive timer with Reset input. State: `accumulatedTime`, `lastTime`. Uses delta-time accumulation. |
| OneSecondTimer | `FunctionBlockObjects.js` | L460–556 | `Execute()` L497–555: Fixed 1-second timer. |

**Critical change for all timers:** Replace `new Date().getTime()` with a `now` parameter passed by the simulation runner. The runner provides the current timestamp. This decouples timers from the system clock and allows deterministic testing.

```javascript
// Before (in current code):
var elapsed = new Date().getTime() - this.startTime;

// After (in core):
execute(now) {
  const elapsed = now - this.startTime;
}
```

---

### Module: `core/blocks/trigger-blocks.js`

**Target path:** `core/blocks/trigger-blocks.js`

**Purpose:** Edge detection blocks: R_TRIG (rising edge) and F_TRIG (falling edge). Stateful — remember previous input value.

**Public interface:**

```javascript
export class RTrigBlock extends BaseBlock {
  constructor(props);
  execute();
}
export class FTrigBlock extends BaseBlock {
  constructor(props);
  execute();
}
```

**Internal state:**
- `lastInput` (boolean): Previous cycle's input value.

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| R_TRIG | `FunctionBlockObjects.js` | L1047–1086 | `Execute()` L1073–1086: `if (currentInput && !this.lastInput)` → rising edge. Pure logic, no DOM needed. |
| F_TRIG | `FunctionBlockObjects.js` | L1092–1131 | `Execute()` L1118–1131: `if (!currentInput && this.lastInput)` → falling edge. |

---

### Module: `core/blocks/latch-blocks.js`

**Target path:** `core/blocks/latch-blocks.js`

**Purpose:** Bistable latch blocks: SR (Set-dominant) and RS (Reset-dominant). Stateful.

**Public interface:**

```javascript
export class SetResetBlock extends BaseBlock { ... }  // SR - Set dominant
export class ResetSetBlock extends BaseBlock { ... }   // RS - Reset dominant
```

**Internal state:**
- `lastOutput` (boolean): Current latch state.

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| SR | `FunctionBlockObjects.js` | L840–886 | `Execute()` L869–886: Set-dominant. If S1 OR lastOutput → Q=1. If R AND NOT S1 → Q=0. |
| RS | `FunctionBlockObjects.js` | L995–1041 | `Execute()` L1025–1041: Reset-dominant. If R → Q=0. Else if S OR lastOutput → Q=1. |

---

### Module: `core/blocks/io-blocks.js`

**Target path:** `core/blocks/io-blocks.js`

**Purpose:** Digital and analog I/O blocks that form the boundary between the FBD simulation and the external world (user clicks in standalone, Node-RED messages in Node-RED mode).

**Public interface:**

```javascript
export class DiBlock extends BaseBlock {
  constructor(props);
  execute();
  // props: { tagName: string, comment: string }
}
export class DoBlock extends BaseBlock {
  constructor(props);
  execute();
  // props: { tagName: string, comment: string }
}
export class AiBlock extends BaseBlock {
  constructor(props);
  execute();
  // props: { tagName: string, comment: string, rawValue: number, aiDataType: "int"|"real" }
}
export class AqBlock extends BaseBlock {
  constructor(props);
  execute();
  // props: { tagName: string, comment: string, aqDataType: "int"|"real" }
}
export class AinBlock extends BaseBlock {
  constructor(props);
  execute();
  // Analog input scaling block
}
```

**Internal state:**
- DI: `outPins[0].value` — current digital state. In standalone, toggled by click handler in web shell. In Node-RED, set by incoming `msg.payload`.
- AI: `props.rawValue` — current analog value. In standalone, modified by click handler. In Node-RED, set by incoming `msg.payload`.
- DO: No internal state — reads input and the web shell renders the visual indicator.
- AQ: No internal state — reads input and the web shell renders the value display.

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| DI | `FunctionBlockObjects.js` | L235–368 | `Execute()` L360–368: Just reads/normalizes `outConnections[0].value`. The click toggle (L336–345), keybinding handlers (L346–358), and DOM layout (L251–276) move to `web/`. Core block just has `tagName` prop and output pin. |
| DO | `FunctionBlockObjects.js` | L374–454 | `Execute()` L450–454: Reads input, sets border color. Core version just reads input. Visual is web shell's job. |
| AI | `FunctionBlockObjects.js` | L2191–2359 | `Execute()` L2344–2359: Sets `outConnections[0].value = this.rawValue` and updates info display. Click handler (L2307–2342) moves to web shell. Core version has `rawValue` as a settable prop. |
| AQ | `FunctionBlockObjects.js` | L2366–2489 | `Execute()` L2464–2489: Reads input value, formats display string. Core version just reads input. Display formatting moves to web shell. |
| AIN | `FunctionBlockObjects.js` | L2496–2550 | `Execute()` L2537–2550: Analog scaling formula `(raw - 819) / linearConstant`. Pure math — fully extractable. |

**Node-RED I/O mapping (implemented in `node-red/nodes/jsblocks.js`, not here):**
- On `node.on('input', msg)`: find DI/AI block where `block.props.tagName === msg.topic`, set `block.outPins[0].value = msg.payload` (for DI) or `block.props.rawValue = msg.payload` (for AI).
- After each simulation cycle: scan DO/AQ blocks, compare current value to previous value, if changed call `node.send({ topic: block.props.tagName, payload: currentValue })`.

---

### Module: `core/blocks/utility-blocks.js`

**Target path:** `core/blocks/utility-blocks.js`

**Purpose:** Remaining utility blocks: MOVE, SELECT, MUX, DEMUX, INT_TO_REAL, REAL_TO_INT, CONSTANT, VARIABLE, FIRST_ORDER_LAG, PACK, UNPACK, COMMENT, DRAW_LINE.

**Public interface:**

```javascript
export class MoveBlock extends BaseBlock { ... }
export class SelectBlock extends BaseBlock { ... }
export class MuxBlock extends BaseBlock { ... }
export class DemuxBlock extends BaseBlock { ... }
export class IntToRealBlock extends BaseBlock { ... }
export class RealToIntBlock extends BaseBlock { ... }
export class ConstantBlock extends BaseBlock { ... }
export class VariableBlock extends BaseBlock { ... }
export class FirstOrderLagBlock extends BaseBlock { ... }
export class PackSixteenBlock extends BaseBlock { ... }
export class UnpackSixteenBlock extends BaseBlock { ... }
export class CommentBlock extends BaseBlock { ... }
export class DrawLineBlock extends BaseBlock { ... }
```

**Internal state:**
- CONSTANT: `props.constantValue` (number)
- VARIABLE: `props.variableValue` (number) — display value, updated each cycle
- FIRST_ORDER_LAG: `lastpv`, `currentScan`, `lastScan`, `firstScan` — stateful filter
- SELECT: No state — pure mux
- MUX/DEMUX: `props.numberInputs` — configurable pin count
- MOVE: `props.moveDataType` — `"real"` or `"int"`
- REAL_TO_INT: `props.roundMode` — `"round"`, `"floor"`, `"ceil"`, `"truncate"`

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| MOVE | `FunctionBlockObjects.js` | L1334–1421 | Pass-through with type casting. `Execute()` L1399–1420. |
| SELECT | `FunctionBlockObjects.js` | L2795–2834 | `Execute()` L2828–2834: `if (selector) out = val1 else out = val2`. Pure logic. |
| MUX | `FunctionBlockObjects.js` | L1519–1659 | Configurable input count. Selects one of N inputs based on K selector. |
| DEMUX | `FunctionBlockObjects.js` | L1660–1807 | Routes one input to one of N outputs based on K selector. |
| INT_TO_REAL | `FunctionBlockObjects.js` | L1422–1452 | Simple type cast. |
| REAL_TO_INT | `FunctionBlockObjects.js` | L1453–1518 | Rounding modes. `Execute()` L1489–1517. |
| CONSTANT | `FunctionBlockObjects.js` | L2109–2156 | `Execute()` L2154–2156: `out = this.constantValue`. |
| VARIABLE | `FunctionBlockObjects.js` | L2162–2185 | `Execute()` L2182–2185: `variableValue = input`. Remove `headerDiv` update. |
| FIRST_ORDER_LAG | `FunctionBlockObjects.js` | L2729–2788 | Stateful filter. Uses `new Date().getTime()` → change to `execute(now)`. |
| PACK | `FunctionBlockObjects.js` | L2674–2728 | Packs 16 bools into int. |
| UNPACK | `FunctionBlockObjects.js` | L2631–2673 | Unpacks int into 16 bools. |
| COMMENT | `FunctionBlockObjects.js` | L3199–3265 | `Execute()` is empty (L3264). Purely visual — core block is a no-op. |
| DRAW_LINE | `FunctionBlockObjects.js` | L3366–3596 | Drawing primitive. `Execute()` is empty. Core block is a no-op; rendering handled by web shell. |

---

### Module: `core/blocks/panel-blocks.js`

**Target path:** `core/blocks/panel-blocks.js`

**Purpose:** Panel/label blocks and jump blocks used for organizing and routing signals on the sheet.

**Public interface:**

```javascript
export class LabelOutPanelBlock extends BaseBlock { ... }
export class LabelInPanelBlock extends BaseBlock { ... }
export class TagLabelOutBlock extends BaseBlock { ... }
export class TagLabelInBlock extends BaseBlock { ... }
export class JumpOutBlock extends BaseBlock { ... }
export class JumpInBlock extends BaseBlock { ... }
export class JunctionBlock extends BaseBlock { ... }
```

**Internal state:**
- LabelOutPanel: `props.labelName`, `props.labelType`, `receivedValue`
- LabelInPanel: `props.labelName`, `props.labelType`
- TagLabelOut/TagLabelIn: `props.tagName`, `props.tagType`
- JumpOut/JumpIn: `props.label` — matching labels create implicit connections

**Dependencies:** `core/blocks/base-block.js`, `core/types.js`

**Migration notes:**

| Block | Source | Lines | Key Extraction |
|-------|--------|-------|----------------|
| LabelOutPanel | `FunctionBlockObjects.js` | L3960–4088 | `Execute()` L4067–4073: `outConnections[0].value = this.receivedValue`. |
| LabelInPanel | `FunctionBlockObjects.js` | L4095–4253 | Reads input, passes through. |
| TagLabelOut | `FunctionBlockObjects.js` | L4368–4499 | Like LabelOutPanel but with tag-based routing. |
| TagLabelIn | `FunctionBlockObjects.js` | L4500–4644 | Like LabelInPanel but with tag-based routing. |
| JumpOut | `FunctionBlockObjects.js` | L4645–4836 | Implicit connection by label matching. |
| JumpIn | `FunctionBlockObjects.js` | L4837–4990 | Implicit connection by label matching. |
| Junction | `FunctionBlockObjects.js` | L4254–4367 | Signal splitting/routing node. |

**Note on Jump blocks:** The simulation runner must resolve jump connections at build time — find all JumpOut/JumpIn pairs with matching labels and create virtual wires. This logic lives in `core/engine/simulation-runner.js`.

---

### Module: `core/blocks/index.js`

**Target path:** `core/blocks/index.js`

**Purpose:** Block registry — maps `objectName` strings to block constructors. Used by the serializer to instantiate blocks during project load.

**Public interface:**

```javascript
import { AndBlock } from './logic-blocks.js';
// ... all imports

/** @type {Map<string, typeof BaseBlock>} */
export const BlockRegistry = new Map();

BlockRegistry.set("And", AndBlock);
BlockRegistry.set("Or", OrBlock);
// ... all registrations

/**
 * Create a block instance by type name.
 * @param {string} typeName - e.g. "And", "Ton"
 * @param {Object} [props]
 * @returns {BaseBlock|null}
 */
export function createBlock(typeName, props);
```

**Dependencies:** All `core/blocks/*.js` modules.

**Migration notes:** Replaces the `eval("new " + typeName + "Block")` pattern from `SheetObject.js` L909–917 (`_createBlockInstance`). The registry is safer (no eval) and works in Node.js where `eval` of global constructors is unreliable.

---

### Module: `core/engine/connection-model.js`

**Target path:** `core/engine/connection-model.js`

**Purpose:** Represents the wiring between blocks. A `Wire` connects one output pin to one input pin. The `WireGraph` holds all wires and provides traversal methods (replacing the `connectedFrom` / `connectedTo` reference chains on DOM `Connector` objects).

**Public interface:**

```javascript
/**
 * A single wire connecting one output pin to one input pin.
 */
export class Wire {
  /**
   * @param {BaseBlock} fromBlock
   * @param {number} fromPinIndex
   * @param {BaseBlock} toBlock
   * @param {number} toPinIndex
   */
  constructor(fromBlock, fromPinIndex, toBlock, toPinIndex);

  fromBlock; fromPinIndex;
  toBlock; toPinIndex;
}

/**
 * Manages all wires in a project.
 */
export class WireGraph {
  constructor();

  /** @type {Wire[]} */
  wires;

  /**
   * Add a wire. Validates pin indices exist.
   * @param {Wire} wire
   */
  addWire(wire);

  /**
   * Remove a wire.
   * @param {Wire} wire
   */
  removeWire(wire);

  /**
   * Get the wire connected to a specific input pin.
   * @param {BaseBlock} block
   * @param {number} pinIndex
   * @returns {Wire|null}
   */
  getWireToInput(block, pinIndex);

  /**
   * Get all wires from a specific output pin.
   * @param {BaseBlock} block
   * @param {number} pinIndex
   * @returns {Wire[]}
   */
  getWiresFromOutput(block, pinIndex);

  /**
   * Read the effective value at an input pin by traversing the wire
   * to the source output pin, applying inversions.
   * @param {BaseBlock} block
   * @param {number} pinIndex
   * @returns {number|boolean}
   */
  readInputValue(block, pinIndex);
}
```

**Internal state:** `wires[]` array.

**Dependencies:** `core/blocks/base-block.js`

**Migration notes:**
- Replaces the bidirectional reference chain in `ConnectorObject.js`:
  - `connectedFrom` (L46): input connector → output connector (single wire)
  - `connectedTo[]` (L44): output connector → input connectors[] (fan-out)
  - `addConnector()` (L227–232), `removeConnectedTo()` (L234–256), `removeConnectedFrom()` (L258–270)
- Also replaces `LineObject.js` entirely (L22–326) — the `LineObject` was purely visual (DOM divs for wire rendering). Its connection tracking logic is absorbed here; its visual rendering moves to `web/line-renderer.js`.
- `readInputValue()` replaces `Connector.getInputValue()` from `ConnectorObject.js` L188–195.

---

### Module: `core/engine/simulation-runner.js`

**Target path:** `core/engine/simulation-runner.js`

**Purpose:** Loads a project (blocks + wires), resolves execution order, and runs the simulation tick loop. This is the heart of the core engine.

**Public interface:**

```javascript
export class SimulationRunner {
  /**
   * @param {ProjectData} projectData
   */
  constructor(projectData);

  /** @type {BaseBlock[]} */
  blocks;

  /** @type {WireGraph} */
  wireGraph;

  /** @type {number} */
  cycleTimeMs;

  /** @type {boolean} */
  running;

  /**
   * Build the runtime from project data. Instantiates blocks,
   * creates wires, resolves jump connections, determines execution order.
   */
  build();

  /**
   * Execute one simulation cycle.
   * @param {number} [now] - Current timestamp (ms). Defaults to Date.now().
   */
  tick(now);

  /**
   * Start cyclic execution.
   * @param {number} cycleMs - Cycle time in milliseconds
   * @param {Function} [onCycleComplete] - Optional callback after each tick
   */
  start(cycleMs, onCycleComplete);

  /**
   * Stop cyclic execution.
   */
  stop();

  /**
   * Get a specific block by index.
   * @param {number} index
   * @returns {BaseBlock}
   */
  getBlock(index);

  /**
   * Get all blocks of a given type.
   * @param {string} typeName - e.g. "Di", "Do", "Ai", "Aq"
   * @returns {BaseBlock[]}
   */
  getBlocksByType(typeName);

  /**
   * Get I/O summary for Node-RED msg routing.
   * @returns {{ inputs: {tagName, type, blockIndex}[], outputs: {tagName, type, blockIndex}[] }}
   */
  getIOSummary();
}
```

**Internal state:**
- `blocks[]`: Instantiated `BaseBlock` subclasses.
- `wireGraph`: The `WireGraph` instance.
- `executionOrder[]`: Blocks sorted by their `indexNumber` (execution order).
- `_intervalId`: Handle for `setInterval`/`clearInterval`.
- `_previousOutputValues`: Map tracking DO/AQ output values from previous cycle for change detection.

**Execution order:** Blocks execute in the order they were added (matching `blockIndex` / `indexNumber` from the JSON). This matches the current behavior in `SheetObject.js` where `blockObjects[]` is iterated in array order during simulation.

**Dependencies:** `core/blocks/index.js` (registry), `core/engine/connection-model.js`

**Migration notes:**
- Replaces the simulation loop in `SheetObject.js`. The current loop is at the `_simIntervalId = window.setInterval(simLoop, this.simulationCycleMs)` line (L371–375), and `setSimulationSpeed()` (L587–648) which restarts the interval.
- `toggleSimulate()` (L1489–1522) — start/stop logic moves here.
- The `tick()` method iterates `executionOrder[]` and calls `block.execute(now)` on each, just like the current loop iterates `blockObjects[]` calling `Execute()`.
- `getIOSummary()` is new — provides the Node-RED node with a manifest of I/O tags for message routing.

---

### Module: `core/serializer/json-serializer.js`

**Target path:** `core/serializer/json-serializer.js`

**Purpose:** Serialize a running `SimulationRunner` to `ProjectData` JSON, and deserialize `ProjectData` back into a `SimulationRunner`. This is the shared save/load mechanism for both standalone web and Node-RED.

**Public interface:**

```javascript
/**
 * Serialize a SimulationRunner's current state to ProjectData.
 * @param {SimulationRunner} runner
 * @returns {ProjectData}
 */
export function serializeProject(runner);

/**
 * Deserialize ProjectData into a SimulationRunner.
 * @param {ProjectData} projectData
 * @returns {SimulationRunner}
 */
export function deserializeProject(projectData);

/**
 * Validate a ProjectData object against the schema.
 * @param {Object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProject(data);
```

**Dependencies:** `core/blocks/index.js`, `core/engine/simulation-runner.js`, `core/engine/connection-model.js`, `core/types.js`

**Migration notes:**
- Replaces `SheetObject.prototype.saveProject()` (L919–973) and `SheetObject.prototype._restoreProject()` (L1114–1215).
- `saveProject()` (L919–965): The current logic iterates `blockObjects[]`, calls `block.serialize()` (defined in `BaseBlockObject.js` L376–395), then iterates connections. The new `serializeProject()` does the same but uses core's `SimulationRunner.blocks[]` and `WireGraph.wires[]`.
- `_restoreProject()` (L1114–1215): Currently creates blocks via `_createBlockInstance()` (L909–917, uses `eval`), calls `block.create(sheet, x, y)`, then `applySerializedProps()`, then recreates `LineObject` connections. The new version uses `BlockRegistry` (no eval), constructs blocks without DOM, and creates `Wire` objects instead of `LineObject`s.
- `validateProject()` is new — validates JSON structure before loading.

---

### Module: `core/serializer/js-exporter.js`

**Target path:** `core/serializer/js-exporter.js`

**Purpose:** **New feature.** Generate a standalone JavaScript file from a `ProjectData` graph. The emitted code is a self-contained simulation that can run in any JS environment (Node.js, browser, embedded) without the jsBlocks framework.

**Public interface:**

```javascript
/**
 * Generate standalone JavaScript code from a project.
 * @param {ProjectData} projectData
 * @param {Object} [options]
 * @param {number} [options.cycleTimeMs=100] - Default cycle time
 * @param {boolean} [options.includeRunLoop=true] - Include setInterval loop
 * @param {string} [options.moduleFormat="iife"] - "iife" | "esm" | "cjs"
 * @returns {string} - Complete JavaScript source code
 */
export function exportJavaScript(projectData, options);
```

**Generated code structure:**

```javascript
// === Generated jsBlocks Simulation ===
// Project: exported YYYY-MM-DD HH:MM:SS

// 1. Wire variables
let wire_0_0_to_1_0 = 0;  // Block0.out[0] → Block1.in[0]
let wire_2_0_to_0_1 = 0;  // Block2.out[0] → Block0.in[1]

// 2. Block state
const block_0 = { type: "And", numberInputs: 2, outPins: [0] };
const block_1 = { type: "Ton", startTime: 0, isTiming: false, outPins: [0, 0] };
// ...

// 3. Execute functions
function executeBlock_0() {
  // AND block
  let result = 1;
  result = result && wire_0_0_to_1_0; // from wire
  result = result && wire_2_0_to_0_1; // from wire
  block_0.outPins[0] = result;
  // Write to outgoing wires
  wire_0_0_to_1_0 = block_0.outPins[0];
}
// ... one function per block

// 4. Main cycle
function cycle() {
  executeBlock_0();
  executeBlock_1();
  // ... in execution order
}

// 5. Run loop
let intervalId = setInterval(cycle, 100);
```

**Internal logic:**
1. Walk `projectData.blocks[]` — for each block, emit a `block_N` state object and an `executeBlock_N()` function based on the block type's logic.
2. Walk `projectData.connections[]` — for each connection, emit a `wire_N` variable declaration.
3. Wire reads/writes: In each `executeBlock_N()`, replace `this.getInputValue(i)` with reading the corresponding wire variable, and replace `this.outPins[j].value = X` with writing to all outgoing wire variables.
4. Emit the main `cycle()` function calling all `executeBlock_N()` in order.
5. Optionally emit a `setInterval` run loop.

**Dependencies:** `core/types.js`, block logic knowledge (the exporter encodes each block type's algorithm as a code-generation template).

**Migration notes:** Entirely new module. No existing code to migrate from. However, the logic for each block type's code generation mirrors the `Execute()` methods already in `FunctionBlockObjects.js` — just transcribed as string templates.

---

### Module: `web/adapter.js`

**Target path:** `web/adapter.js`

**Purpose:** Abstraction layer between the web UI and the core engine. In standalone mode, the adapter calls core directly in the browser. In Node-RED mode, a different adapter (`node-red-adapter.js`) communicates with the server-side core over HTTP/WebSocket. Both adapters implement the same interface so the UI code is identical.

**Public interface:**

```javascript
/**
 * @interface SimulationAdapter
 */
export class StandaloneAdapter {
  /**
   * Load a project from JSON data.
   * @param {ProjectData} data
   */
  async loadProject(data);

  /**
   * Serialize current project to JSON data.
   * @returns {ProjectData}
   */
  async saveProject();

  /**
   * Export current project as standalone JavaScript.
   * @returns {string}
   */
  async exportJavaScript();

  /**
   * Start simulation.
   * @param {number} cycleMs
   * @param {Function} onTick - Called after each simulation cycle
   */
  async startSimulation(cycleMs, onTick);

  /**
   * Stop simulation.
   */
  async stopSimulation();

  /**
   * Set a DI block's value (from user interaction).
   * @param {number} blockIndex
   * @param {boolean|number} value
   */
  async setInputValue(blockIndex, value);

  /**
   * Set an AI block's raw value (from user interaction).
   * @param {number} blockIndex
   * @param {number} value
   */
  async setAnalogValue(blockIndex, value);

  /**
   * Get current output values of all DO/AQ blocks.
   * @returns {{ blockIndex: number, tagName: string, value: any }[]}
   */
  async getOutputValues();

  /**
   * Get the full current state of all blocks (for rendering).
   * @returns {{ blocks: { index, objectName, left, top, width, height, props, inPins, outPins, execOrder }[] }}
   */
  async getState();
}
```

**Internal state:** Holds a `SimulationRunner` instance (in standalone mode).

**Dependencies:** `core/engine/simulation-runner.js`, `core/serializer/json-serializer.js`, `core/serializer/js-exporter.js`

**Migration notes:** New module. This is the **seam** that allows the same UI code to work in both environments. The current codebase has no such abstraction — the UI directly manipulates `SheetObject` and block instances.

---

### Module: `web/dom-renderer.js`

**Target path:** `web/dom-renderer.js`

**Purpose:** Render blocks as HTML `<div>` elements on the canvas. Handles creation, positioning, sizing, header bars, execution order badges, and visual state feedback (green/dashed borders). This is the DOM rendering layer that was previously embedded in every block's `create()` and `Execute()` methods.

**Public interface:**

```javascript
export class DomRenderer {
  /**
   * @param {HTMLElement} canvas - The canvas container element
   * @param {SimulationAdapter} adapter
   */
  constructor(canvas, adapter);

  /**
   * Render a block on the canvas.
   * @param {Object} blockState - From adapter.getState()
   * @returns {HTMLElement} The block's div element
   */
  renderBlock(blockState);

  /**
   * Update a block's visual state (borders, values, badges).
   * @param {HTMLElement} div
   * @param {Object} blockState
   */
  updateBlock(div, blockState);

  /**
   * Remove a block's div from the canvas.
   * @param {HTMLElement} div
   */
  removeBlock(div);

  /**
   * Render all blocks from current state.
   */
  renderAll();

  /**
   * Update all blocks' visual state.
   */
  updateAll();
}
```

**Internal state:** Map of `blockIndex → HTMLElement` for tracking rendered elements.

**Dependencies:** `web/adapter.js`

**Migration notes:**
- Extracted from `BaseBlockObject.js` `Base.prototype.create()` (L39–138): div creation, header bar, exec order badge, event listener attachment.
- Extracted from every block's `create()` override (e.g., `DiBlock` L251–276 two-panel layout, `TonBlock` L568–575 pin labels, `DoBlock` L386–410 layout).
- Border color feedback (`2px solid rgb(3,255,3)` / `2px dashed rgb(0,0,255)`) from every `Execute()` method moves here — `updateBlock()` reads pin values and sets border accordingly.
- DOM layout specifics (type boxes, info boxes, SVG for snap points) become renderer sub-methods per block type.

---

### Module: `web/connector-renderer.js`

**Target path:** `web/connector-renderer.js`

**Purpose:** Render connector pins (input/output stubs), hitboxes, inversion circles, and handle the mouse interaction for creating wires (drag from output to input).

**Public interface:**

```javascript
export class ConnectorRenderer {
  /**
   * @param {HTMLElement} canvas
   * @param {SimulationAdapter} adapter
   */
  constructor(canvas, adapter);

  /**
   * Render all connectors for a block.
   * @param {HTMLElement} blockDiv
   * @param {Object} blockState
   */
  renderConnectors(blockDiv, blockState);

  /**
   * Update connector positions (after block move).
   * @param {HTMLElement} blockDiv
   * @param {Object} blockState
   */
  updatePositions(blockDiv, blockState);

  /**
   * Handle connector double-click (toggle inversion).
   * @param {number} blockIndex
   * @param {string} direction - "in" or "out"
   * @param {number} pinIndex
   */
  toggleInversion(blockIndex, direction, pinIndex);
}
```

**Dependencies:** `web/adapter.js`

**Migration notes:**
- Extracted from `ConnectorObject.js`:
  - Constructor (L22–119): DOM creation of `theConnector` div, `invertCircle`, `hitbox` — all pure rendering.
  - `calcConnector()` (L120–135): Pixel position calculation from block position + pin percentage.
  - `moveConnector()` (L136–149): Position update on block move.
  - `_positionInvertCircle()` (L151–167): Inversion circle placement.
  - `dblclickHandler()` (L169–178): Toggle inversion — calls adapter instead of modifying state directly.
- **Removed from core:** All mouse event handlers for wire creation (`clickHandler` L196–201, `mouseupHandler` L203–225) — these move to `web/sheet-ui.js` which coordinates the drag interaction.

---

### Module: `web/line-renderer.js`

**Target path:** `web/line-renderer.js`

**Purpose:** Render wire lines on the canvas as HTML divs (horizontal and vertical segments). Purely cosmetic — the wire data model lives in core.

**Public interface:**

```javascript
export class LineRenderer {
  /**
   * @param {HTMLElement} canvas
   */
  constructor(canvas);

  /**
   * Draw a wire between two connector positions.
   * @param {Object} fromPos - { x, y }
   * @param {Object} toPos - { x, y }
   * @param {Object} [options] - { snapToGrid, gridSize, color }
   * @returns {HTMLElement[]} Array of segment divs
   */
  drawWire(fromPos, toPos, options);

  /**
   * Remove a wire's segments from the canvas.
   * @param {HTMLElement[]} segments
   */
  removeWire(segments);

  /**
   * Update all wires (e.g., after block move).
   * @param {WireGraph} wireGraph
   * @param {Function} getConnectorPosition - (blockIndex, direction, pinIndex) => {x,y}
   */
  updateAll(wireGraph, getConnectorPosition);

  /**
   * Draw/remove delay symbols (orange diamonds).
   */
  updateDelaySymbols(wireGraph, executionOrder);
}
```

**Dependencies:** None (pure rendering).

**Migration notes:**
- Direct migration from `LineObject.js` (L22–326):
  - `_createSegment()` (L31–55): DOM div creation for line segments.
  - `_hSeg()` / `_vSeg()` (L66–84): Horizontal/vertical segment positioning.
  - `connectTo()` (L122–262): The routing algorithm (Z-shape, reverse routing, grid snapping). This is the most complex rendering function.
  - `removeLine()` (L264–277): DOM cleanup.
  - Delay symbol (L86–120, L255–261): Orange diamond for stale-data indicators.
  - `changeColor()`, `select()`, `deselect()` (L279–301): Selection highlighting.

---

### Module: `web/sheet-ui.js`

**Target path:** `web/sheet-ui.js`

**Purpose:** Canvas management — pan/zoom, grid rendering, selection rectangle, block drag-and-drop, wire creation via mouse drag, keyboard shortcuts, snap points. Orchestrates the renderers and adapter.

**Public interface:**

```javascript
export class SheetUI {
  /**
   * @param {HTMLElement} viewport
   * @param {HTMLElement} canvas
   * @param {SimulationAdapter} adapter
   */
  constructor(viewport, canvas, adapter);

  /** Initialize event listeners, grid, toolbar bindings. */
  init();

  /** @type {DomRenderer} */
  domRenderer;
  /** @type {ConnectorRenderer} */
  connectorRenderer;
  /** @type {LineRenderer} */
  lineRenderer;

  // Pan/Zoom
  zoomIn(); zoomOut(); resetZoom();

  // Selection
  selectBlock(index, additive);
  deselectAll();
  deleteSelection();

  // Simulation
  toggleSimulation();

  // Project
  newProject();
  saveProject();
  loadProject(file);
  exportJS();
}
```

**Internal state:**
- `scale`, `panX`, `panY`: Viewport transform.
- `selectedBlocks[]`, `selectedLines[]`: Current selection.
- `isPanning`, `isSelecting`, `isDragging`: Interaction state.

**Dependencies:** `web/adapter.js`, `web/dom-renderer.js`, `web/connector-renderer.js`, `web/line-renderer.js`, `web/modal.js`

**Migration notes:**
- Extracted from `SheetObject.js` — the **entire** class, minus simulation logic and serialization:
  - Constructor (L21–166): Canvas/pan/zoom state, viewport event listeners.
  - Pan/zoom (L76–166, plus `_applyTransform()` which is in the outline): Mouse-driven pan (middle button, Alt+click), zoom (wheel), double-click reset.
  - Selection rectangle (L118+): Left-click drag on empty canvas.
  - Block drag-and-drop: Delegated to `BaseBlockObject.js` `mousedownHandler`/`moveHandler` (L139–256) — moves to SheetUI as a coordinated operation using the adapter.
  - Wire creation drag: Currently in `ConnectorObject.js` `clickHandler` (L196) + `mouseupHandler` (L203) + `SheetObject.startDragPreview/stopDragPreview`. Moves here.
  - `toggleSimulate()` (L1489–1522): UI-only part (button state, block list disable). Calls `adapter.startSimulation()` / `adapter.stopSimulation()`.
  - `setSimulationSpeed()` (L587–648): UI-only — calls adapter.
  - `addBlock()` from toolbar dropdown: Calls `adapter.addBlock()` then renders.
  - **Removed:** All simulation loop management (`_simIntervalId`, `setInterval`) — moved to core engine.
  - **Removed:** `saveProject()` / `_restoreProject()` / `copySelection()` / `pasteClipboard()` — moved to core serializer. SheetUI just calls adapter methods and re-renders.

---

### Module: `web/modal.js`

**Target path:** `web/modal.js`

**Purpose:** Reusable modal dialog system for block settings, project settings, and prompts.

**Public interface:**

```javascript
/**
 * Show a modal dialog.
 * @param {string} contentHTML - Inner HTML for the dialog body
 * @param {Function} onSave - Called when OK is clicked
 * @param {Function} [onCancel] - Called when Cancel is clicked
 */
export function showModal(contentHTML, onSave, onCancel);

/**
 * Close the currently open modal.
 */
export function closeModal();
```

**Dependencies:** None.

**Migration notes:**
- Extracted from `Base.showModal()` static method in `BaseBlockObject.js` L315–337.
- Currently creates overlay + box, attaches Save/Cancel handlers, focuses first input.
- The HTML templates for each block's settings dialog (currently in each block's `openSettings()`, e.g., `AndBlock` L62–88, `DiBlock` L288–325, `AiBlock` L2246–2294) move to the web shell as view concerns. The core block only knows about its `props` object.

---

### Module: `node-red/nodes/jsblocks.js`

**Target path:** `node-red/nodes/jsblocks.js`

**Purpose:** Server-side Node-RED node implementation. Creates a `SimulationRunner` from the stored project JSON, runs it cyclically, routes incoming `msg` objects to DI/AI blocks, and sends outgoing `msg` objects from DO/AQ blocks on value change.

**Public interface (Node-RED registration):**

```javascript
module.exports = function(RED) {
  function JsBlocksNode(config) {
    RED.nodes.createNode(this, config);
    // ...
  }
  RED.nodes.registerType("jsblocks", JsBlocksNode);
};
```

**Internal behavior:**

```
On deploy:
  1. Load project JSON from Node-RED context store (or config)
  2. deserializeProject() → SimulationRunner
  3. runner.build()
  4. runner.getIOSummary() → build topic→blockIndex lookup maps
  5. runner.start(config.cycleTimeMs, onCycleComplete)

On incoming msg:
  1. Match msg.topic against DI/AI/LabelOutPanel tagNames
  2. Set the matched block's input value via runner
  3. (Simulation continues on its own cycle)

On each cycle (onCycleComplete callback):
  1. Scan all DO/AQ/LabelInPanel blocks
  2. Compare current output value to previous cycle's value
  3. If changed: node.send({ topic: tagName, payload: value })
  4. Update previous values

On close/undeploy:
  1. runner.stop()
  2. Clear interval
```

**State persistence:**
- Project JSON stored in Node-RED node's `config` or in `node.context().flow` for persistence across deploys.
- Runtime state (timer accumulators, edge detector memory) lives in-memory only — resets on deploy/restart.

**Dependencies:** `core/engine/simulation-runner.js`, `core/serializer/json-serializer.js`

**Admin API endpoints** (for the editor UI to communicate with):

```javascript
// Serve the web/ UI assets
RED.httpAdmin.get("/jsblocks/ui/*", function(req, res) { ... });

// Get current project JSON
RED.httpAdmin.get("/jsblocks/:id/project", function(req, res) { ... });

// Save project JSON from editor
RED.httpAdmin.post("/jsblocks/:id/project", function(req, res) { ... });

// Export JavaScript
RED.httpAdmin.get("/jsblocks/:id/export", function(req, res) { ... });
```

---

### Module: `node-red/nodes/jsblocks.html`

**Target path:** `node-red/nodes/jsblocks.html`

**Purpose:** Node-RED editor-side definition. Registers the node type in the palette, defines the config dialog (which embeds the jsBlocks web UI via iframe), and handles the deploy workflow.

**Structure:**

```html
<!-- Node palette registration -->
<script type="text/javascript">
  RED.nodes.registerType('jsblocks', {
    category: 'function',
    color: '#E2D96E',
    defaults: {
      name: { value: "" },
      cycleTimeMs: { value: 100 },
      projectData: { value: null }  // Stored JSON
    },
    inputs: 1,
    outputs: 1,
    label: function() { return this.name || "jsBlocks"; },
    oneditprepare: function() {
      // Load jsBlocks web UI in iframe
      // Fetch project JSON from admin API
      // Populate the editor
    },
    oneditsave: function() {
      // Collect project JSON from iframe
      // Store in projectData
    }
  });
</script>

<!-- Edit dialog template -->
<script type="text/html" data-template-name="jsblocks">
  <div class="form-row">
    <label>Name</label>
    <input type="text" id="node-input-name">
  </div>
  <div class="form-row">
    <label>Cycle (ms)</label>
    <input type="number" id="node-input-cycleTimeMs" min="1" max="1000">
  </div>
  <div class="form-row" style="height:500px;">
    <iframe id="jsblocks-editor" src="/jsblocks/ui/index.htm"
            style="width:100%;height:100%;border:1px solid #ccc;">
    </iframe>
  </div>
</script>
```

**Dependencies:** `web/` (served as static assets via admin API).

---

### Module: `node-red/package.json`

**Target path:** `node-red/package.json`

**Purpose:** NPM package definition for the Node-RED node.

```json
{
  "name": "node-red-contrib-jsblocks",
  "version": "1.0.0",
  "description": "Function Block Diagram (FBD) simulator for Node-RED",
  "node-red": {
    "nodes": {
      "jsblocks": "nodes/jsblocks.js"
    }
  },
  "dependencies": {
    "jsblocks-core": "file:../core"
  },
  "keywords": ["node-red", "plc", "fbd", "function-block", "simulation"]
}
```

---

## Open Questions / Assumptions

| # | Question | Default Assumption (follow unless told otherwise) |
|---|----------|--------------------------------------------------|
| 1 | **Module system:** Should `core/` use ES modules (`import/export`) or CommonJS (`require/module.exports`)? | **ES modules.** Modern Node.js supports them natively. The web shell can use `<script type="module">`. Node-RED nodes traditionally use CJS, but the `node-red/` wrapper can use CJS while importing ESM core via dynamic `import()`. |
| 2 | **CustomBlock support in core:** The current `CustomBlock` (`CustomBlock.js`) allows users to define blocks in-browser with custom `execute()` JS code. Should this work in Node-RED? | **Yes, but with a sandbox.** Custom block definitions are stored in `project.customDefinitions` and loaded into the core registry at runtime. In Node-RED, the custom `execute()` code runs in a `vm` sandbox (Node.js `vm` module) for safety. |
| 3 | **Timer resolution:** Current timers use `new Date().getTime()` which has ~1ms resolution. Should core timers accept an injected clock? | **Yes.** `execute(now)` receives the timestamp from the runner. The runner uses `Date.now()` by default but allows injection for testing. |
| 4 | **Execution order:** Currently blocks execute in `blockIndex` order (insertion order). Should the core engine implement topological sort based on wire dependencies? | **No, keep insertion order.** This matches current behavior and PLC scan order semantics. The existing "delay symbol" feature (orange diamond on `LineObject.js` L86–120) already warns users about backward-referencing wires. |
| 5 | **Multiple Node-RED instances:** Can a user place multiple jsBlocks nodes in one flow? | **Yes.** Each node instance has its own `SimulationRunner`, its own project JSON, and its own I/O context. They are independent. |
| 6 | **Label/Jump block resolution:** JumpIn/JumpOut and TagLabelIn/TagLabelOut create implicit connections by label matching. When is this resolved? | **At build time.** `SimulationRunner.build()` scans for matching label pairs and creates virtual wires. If labels change during runtime, `build()` must be called again (i.e., redeploy). |
| 7 | **File structure for web/:** Should `web/` be a build step (bundler) or plain script tags? | **Plain script tags with ES modules.** No build step required. The current `index.htm` loads scripts via `<script>` tags — this continues with `type="module"`. |
| 8 | **Backward compatibility:** Should the refactored standalone web app load existing `.json` project files from the `Examples/` directory? | **Yes.** The `core/serializer/json-serializer.js` must round-trip the existing format. The `version` field in the JSON schema is reserved for future migrations. |
| 9 | **Node-RED msg on value change vs. every cycle:** Should DO/AQ blocks emit a `msg` every cycle or only when the value changes? | **Only on value change** (as stated in the requirements). The `SimulationRunner` tracks previous output values and the Node-RED node compares. |
| 10 | **DI/AI blocks as msg inputs AND as manual controls:** In Node-RED mode, can the user still click DI blocks in the embedded editor to toggle them? | **Yes.** The embedded editor is a live view. Clicks in the editor call the adapter's `setInputValue()`, which updates the core block. Incoming `msg` objects also update the same value. Last write wins. |
