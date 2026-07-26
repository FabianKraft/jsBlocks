///////////////////////////////////////////////////////////
//
//		Node-RED Function-Node Exporter
//		Copyright 2026 Fabian Kraft
//
//		Permission is hereby granted, free of charge, to any person obtaining a copy of this
//		software and associated documentation files (the "Software"), to deal in the Software without restriction,
//		including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//		sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
//		the following conditions:
//
//		The above copyright notice and this permission notice shall be included in all copies or
//		substantial portions of the Software.
//
//		THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
//		INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
//		PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
//		DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
//		CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//////////////////////////////////////////////////////////

// Turns the on-screen FBD sheet into a single self-contained Node-RED Function
// node (delivered as a Node-RED clipboard flow that imports as one ready node).
//
// Design (see also the module discussion): the exported node holds a tiny
// scan engine that mirrors jsBlocks' own simulation model exactly:
//
//   * On Start   -> build the runtime, seed nets/state, start setInterval(scan)
//   * On Message -> write msg.payload into a process image keyed by msg.topic
//   * scan()     -> evaluate every block ONCE, in the same order the simulator
//                   uses (blockObjects index order), reading/writing a shared,
//                   persistent `net` store so feedback loops behave like the sim
//   * outputs    -> DO/AQ emit {topic, payload} only when their value changes
//   * On Stop    -> clearInterval
//
// Timers use wall-clock time (Date.now), so they stay real-time correct
// regardless of the scan interval — matching the simulator's timer blocks.
//
// ROBUSTNESS CONTRACT
//   * BLOCK_REGISTRY is the single source of truth for each block's emitted
//     logic. Adding a block = one registry entry.
//   * Purely visual blocks are skipped (IGNORE).
//   * Any block that is neither in the registry nor ignored makes the export
//     FAIL LOUDLY with the offending list — it never emits silently-wrong code.
//   * The pure generation path (buildGraph/generateFlow/generateCode) has no DOM
//     dependency, so it can be unit-tested headless under Node.

(function () {
  "use strict";

  var VERSION = "1.3.0-phase4";

  // ---------------------------------------------------------------------------
  // Blocks that carry no runtime logic and are safely skipped on export.
  // ---------------------------------------------------------------------------
  var IGNORE = {
    Comment: true,
    DrawLine: true,
    Snap: true,
  };

  // ---------------------------------------------------------------------------
  // Small string helpers used by the emitters.
  // ---------------------------------------------------------------------------

  // Safe JS string literal for a tag name (used as object key and msg.topic).
  function lit(s) {
    return JSON.stringify(s == null ? "" : String(s));
  }

  // Safe numeric literal (defaults to 0 for null/undefined/NaN).
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? String(n) : "0";
  }

  // Name of the persistent net variable produced by a given output connector.
  function netName(blockIndex, outPin) {
    return "net.b" + blockIndex + "o" + outPin;
  }

  // Name of the persistent per-block state object.
  function stateName(blockIndex) {
    return "st.b" + blockIndex;
  }

  // ---------------------------------------------------------------------------
  // buildGraph(sheet) — read the live sheet into a plain, DOM-free description.
  //
  // Block identity is the index in sheet.blockObjects, exactly as saveProject()
  // uses it. We resolve every input connector to the (block,pin) of its source
  // output so the code generator can name nets without touching the DOM again.
  // ---------------------------------------------------------------------------
  function buildGraph(sheet) {
    var blocks = sheet.blockObjects || [];

    // Map every OUTPUT connector object -> { block, pin } so inputs can find
    // their source. Connectors are compared by identity.
    var outLookup =
      typeof Map !== "undefined"
        ? new Map()
        : {
            _k: [],
            _v: [],
            set: function (k, v) {
              this._k.push(k);
              this._v.push(v);
            },
            get: function (k) {
              var i = this._k.indexOf(k);
              return i < 0 ? undefined : this._v[i];
            },
          };

    for (var i = 0; i < blocks.length; i++) {
      var outs = blocks[i].outConnections || [];
      for (var o = 0; o < outs.length; o++) {
        if (outs[o]) outLookup.set(outs[o], { block: i, pin: o });
      }
    }

    var nodes = [];
    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      var ins = blk.inConnections || [];
      var inputs = [];
      for (var p = 0; p < ins.length; p++) {
        var c = ins[p];
        if (!c) {
          inputs.push(null);
          continue;
        }
        var src = c.connectedFrom ? outLookup.get(c.connectedFrom) : null;
        inputs.push({
          dataType: c.dataType, // "bool" | "int" | "real"
          inverted: !!c.inverted,
          source: src || null, // { block, pin } or null when unconnected
          sourceInverted: c.connectedFrom ? !!c.connectedFrom.inverted : false,
        });
      }

      var outputs = [];
      var outs = blk.outConnections || [];
      for (var q = 0; q < outs.length; q++) {
        outputs.push(outs[q] ? { dataType: outs[q].dataType } : null);
      }

      nodes.push({
        index: b,
        type: blk.objectName,
        tagName: blk.tagName != null ? String(blk.tagName) : null,
        // Extra per-type props the emitters need (kept minimal and explicit).
        numberInputs: blk.numberInputs, // And/Or/Xor
        constantValue: blk.constantValue, // Constant
        limitDataType: blk.limitDataType, // Limit
        moveDataType: blk.moveDataType, // Move
        roundMode: blk.roundMode, // RealToInt
        muxDataType: blk.muxDataType, // Mux
        numInputs: blk.numInputs, // Mux
        demuxDataType: blk.demuxDataType, // Demux
        numOutputs: blk.numOutputs, // Demux
        cmpMode: blk.cmpMode, // Cmp
        mathDataType: blk.mathDataType, // Add/Sub/Mul/Div
        labelName: blk.labelName, // Label/Tag/Jump connectors
        definition: blk.definition || null, // Custom blocks
        inputs: inputs,
        outputs: outputs,
      });
    }

    return {
      name: sheet.projectName || "",
      cycleMs: Math.max(10, sheet.simulationCycleMs || 15),
      nodes: nodes,
    };
  }

  // ---------------------------------------------------------------------------
  // Expression for reading one input pin, honouring inversion and connectivity,
  // faithful to Connector.getInputValue():
  //   * bool, unconnected -> (own inversion ? 1 : 0)
  //   * bool, connected   -> source net, with source+own inversion XORed in
  //   * analog            -> source net raw value, or 0 when unconnected
  // ---------------------------------------------------------------------------
  function inExpr(node, pin) {
    var c = node.inputs[pin];
    if (!c) return "0";

    if (c.dataType === "bool") {
      if (!c.source) return c.inverted ? "1" : "0";
      var src = netName(c.source.block, c.source.pin);
      var invert = (c.sourceInverted ? 1 : 0) ^ (c.inverted ? 1 : 0);
      return invert ? "(" + src + " ? 0 : 1)" : src;
    }

    // analog (int/real): no inversion semantics
    if (!c.source) return "0";
    return netName(c.source.block, c.source.pin);
  }

  // Timer blocks read bool inputs as `connectedFrom ? getInputValue() : 0` —
  // i.e. an UNCONNECTED input is 0 regardless of its inversion bubble (unlike
  // AND/OR which use getInputValue() directly). Match that exactly.
  function boolGuard(node, pin) {
    var c = node.inputs[pin];
    if (!c || !c.source) return "0";
    return inExpr(node, pin);
  }

  // Timer preset reads: `connectedFrom ? parseInt(connectedFrom.value) : 0`.
  function intPreset(node, pin) {
    var c = node.inputs[pin];
    if (!c || !c.source) return "0";
    return "parseInt(" + netName(c.source.block, c.source.pin) + ")";
  }

  // Analog read helpers, faithful to how the analog/math blocks read inputs:
  //   floatIn -> `connectedFrom ? parseFloat(connectedFrom.value) : 0`
  //   intIn   -> `connectedFrom ? parseInt(connectedFrom.value) : 0`
  //   rawIn   -> `connectedFrom ? connectedFrom.value : 0` (no coercion)
  // Nets always hold numbers, so parseFloat/parseInt are safe no-ops when
  // connected; the guard supplies 0 for unconnected inputs (blocks that read
  // `.value` with no null-check in the sim would throw — we default to 0).
  function floatIn(node, pin) {
    var c = node.inputs[pin];
    if (!c || !c.source) return "0";
    return "parseFloat(" + netName(c.source.block, c.source.pin) + ")";
  }
  function intIn(node, pin) {
    var c = node.inputs[pin];
    if (!c || !c.source) return "0";
    return "parseInt(" + netName(c.source.block, c.source.pin) + ")";
  }
  function rawIn(node, pin) {
    var c = node.inputs[pin];
    if (!c || !c.source) return "0";
    return netName(c.source.block, c.source.pin);
  }

  // Emit `Math.round(expr)` for int data type, else the real-valued expression.
  function roundIfInt(dataType, intExpr, realExpr) {
    return dataType === "int" ? intExpr : realExpr;
  }

  // ---------------------------------------------------------------------------
  // Named signal buses (cross-page connectors). Each is a "wireless" link: a
  // source block (with an INPUT pin) captures a value under a label name, and
  // sink blocks (with an OUTPUT pin) reproduce it. The three pairs are
  // independent, so each gets its own namespace:
  //   L = LabelInPanel  -> LabelOutPanel
  //   T = TagLabelIn     -> TagLabelOut
  //   J = JumpOut        -> JumpIn        (note: JumpOut is the SOURCE here)
  // Values persist across scans in rt.bus, so a sink evaluated before its
  // source reads the previous scan's value — matching the simulator, which
  // pushes onto a persistent `receivedValue` on the sink block.
  // ---------------------------------------------------------------------------
  var BUS_NS = {
    LabelInPanel: "L",
    LabelOutPanel: "L",
    TagLabelIn: "T",
    TagLabelOut: "T",
    JumpOut: "J",
    JumpIn: "J",
  };
  function busKey(ns, name) {
    return "bus[" + lit(ns + ":" + (name == null ? "???" : name)) + "]";
  }

  // Value a bus source pushes: bool via getInputValue(), analog raw.
  function busSourceValue(n, ctx) {
    var c = n.inputs[0];
    if (!c || !c.source) return null; // unconnected
    return c.dataType === "bool" ? ctx.in(0) : rawIn(n, 0);
  }

  // ---- Custom blocks --------------------------------------------------------
  // Mirror of CustomBlock._FORBIDDEN (kept local so this module stays testable
  // without loading CustomBlock.js). Used to refuse unsafe user code at export.
  var CUSTOM_FORBIDDEN =
    /\b(window|document|eval|Function|fetch|XMLHttpRequest|import|require|location|navigator|cookie|localStorage|sessionStorage|alert|confirm|prompt)\b/;

  function isCustom(type) {
    return typeof type === "string" && type.indexOf("Custom_") === 0;
  }

  // Reconstruct CustomBlock._compileCode's function body verbatim so the
  // exported node runs identical logic to the simulator.
  function customBody(def) {
    var inNames = (def.inputs || []).map(function (p) {
      return p.name;
    });
    var outNames = (def.outputs || []).map(function (p) {
      return p.name;
    });
    var stateNames = (def.state || []).map(function (p) {
      return p.name;
    });
    var body = "";
    for (var i = 0; i < inNames.length; i++)
      body += "var " + inNames[i] + " = __in[" + i + "];\n";
    for (var i = 0; i < stateNames.length; i++)
      body += "var " + stateNames[i] + " = __state['" + stateNames[i] + "'];\n";
    for (var i = 0; i < outNames.length; i++)
      body += "var " + outNames[i] + " = 0;\n";
    body += (def.code || "") + "\n";
    for (var i = 0; i < stateNames.length; i++)
      body += "__state['" + stateNames[i] + "'] = " + stateNames[i] + ";\n";
    body += "return [" + outNames.join(",") + "];\n";
    return body;
  }

  // Initial state object literal for a custom block, from its definition.
  function customStateInit(def) {
    var parts = [];
    var st = def.state || [];
    for (var i = 0; i < st.length; i++) {
      var v = st[i].initial !== undefined ? Number(st[i].initial) || 0 : 0;
      parts.push(lit(st[i].name) + ": " + num(v));
    }
    return "{ " + parts.join(", ") + " }";
  }

  // Emit a custom block: build __in, run the (validated) user body in an IIFE,
  // assign outputs. Errors are caught so one bad block cannot kill the scan
  // (matching CustomBlock.Execute's try/catch, which leaves outputs unchanged).
  function customEmit(n, ctx) {
    var def = n.definition;
    var inExprs = [];
    for (var i = 0; i < n.inputs.length; i++) {
      var c = n.inputs[i];
      inExprs.push(c && c.dataType === "bool" ? ctx.in(i) : rawIn(n, i));
    }
    var v = "_c" + n.index;
    var lines = [
      "try {",
      "  var " + v + " = (function (__in, __state) {",
      indent(customBody(def), 4),
      "  })([" + inExprs.join(", ") + "], " + ctx.state + ");",
    ];
    for (var o = 0; o < n.outputs.length; o++) {
      if (n.outputs[o]) {
        lines.push(
          "  " + ctx.out(o) + " = (" + v + " && " + v + "[" + o + "] !== undefined) ? " + v + "[" + o + "] : 0;",
        );
      }
    }
    lines.push(
      '} catch (e) { node.warn(' + lit("Custom block '" + (def.name || "?") + "': ") + ' + e.message); }',
    );
    return lines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // BLOCK_REGISTRY — single source of truth. Each emit(node, ctx) returns the
  // body statements (without the wrapping block braces). ctx exposes:
  //   ctx.in(pin)  -> input expression string
  //   ctx.out(pin) -> net variable name for an output
  //   ctx.state    -> this block's persistent state object name
  //   ctx.tag      -> JS string literal of the block's tag name
  //   ctx.emitSend(valueExpr) -> change-detected node.send() for outputs
  //
  // `init` (optional) returns the initial state object literal for stateful
  // blocks, emitted once in On Start.
  // ---------------------------------------------------------------------------
  var BLOCK_REGISTRY = {
    // ---- Inputs / Outputs -------------------------------------------------
    Di: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + ctx.tag + " in reg ? (reg[" + ctx.tag + "] ? 1 : 0) : 0;";
      },
    },
    Ai: {
      emit: function (n, ctx) {
        return (
          "var v = Number(reg[" + ctx.tag + "]); " +
          ctx.out(0) + " = isNaN(v) ? 0 : v;"
        );
      },
    },
    Do: {
      emit: function (n, ctx) {
        return ctx.emitSend("!!(" + ctx.in(0) + ")");
      },
    },
    Aq: {
      emit: function (n, ctx) {
        return ctx.emitSend(ctx.in(0));
      },
    },

    // ---- Bit logic --------------------------------------------------------
    And: {
      emit: function (n, ctx) {
        var terms = [];
        for (var i = 0; i < n.numberInputs; i++) terms.push(ctx.in(i));
        return ctx.out(0) + " = (" + terms.join(" && ") + ") ? 1 : 0;";
      },
    },
    Or: {
      emit: function (n, ctx) {
        var terms = [];
        for (var i = 0; i < n.numberInputs; i++) terms.push(ctx.in(i));
        return ctx.out(0) + " = (" + terms.join(" || ") + ") ? 1 : 0;";
      },
    },
    Xor: {
      emit: function (n, ctx) {
        var terms = [];
        for (var i = 0; i < n.numberInputs; i++)
          terms.push("(" + ctx.in(i) + " ? 1 : 0)");
        // true when an odd number of inputs are true
        return ctx.out(0) + " = ((" + terms.join(" + ") + ") % 2) ? 1 : 0;";
      },
    },
    SetReset: {
      // Set-dominant SR latch (S1 wins).
      init: function () {
        return "{ q: 0 }";
      },
      emit: function (n, ctx) {
        return [
          "var S = " + ctx.in(0) + ", R = " + ctx.in(1) + ";",
          "var q = " + ctx.state + ".q;",
          "if (S || q) q = 1;",
          "if (R && !S) q = 0;",
          ctx.state + ".q = q; " + ctx.out(0) + " = q;",
        ].join("\n");
      },
    },
    ResetSet: {
      // Reset-dominant RS latch (R1 wins).
      init: function () {
        return "{ q: 0 }";
      },
      emit: function (n, ctx) {
        return [
          "var S = " + ctx.in(0) + ", R = " + ctx.in(1) + ";",
          "var q;",
          "if (R) q = 0; else if (S || " + ctx.state + ".q) q = 1; else q = 0;",
          ctx.state + ".q = q; " + ctx.out(0) + " = q;",
        ].join("\n");
      },
    },
    RTrig: {
      init: function () {
        return "{ last: 0 }";
      },
      emit: function (n, ctx) {
        return [
          "var clk = " + ctx.in(0) + " ? 1 : 0;",
          ctx.out(0) + " = (clk && !" + ctx.state + ".last) ? 1 : 0;",
          ctx.state + ".last = clk;",
        ].join("\n");
      },
    },
    FTrig: {
      init: function () {
        return "{ last: 0 }";
      },
      emit: function (n, ctx) {
        return [
          "var clk = " + ctx.in(0) + " ? 1 : 0;",
          ctx.out(0) + " = (!clk && " + ctx.state + ".last) ? 1 : 0;",
          ctx.state + ".last = clk;",
        ].join("\n");
      },
    },

    // ---- Timers -----------------------------------------------------------
    // All timers use Date.now() (wall-clock), so they stay real-time accurate
    // regardless of the scan interval. TON/TOF/TONR work in milliseconds;
    // OneSecondTimer works in whole seconds.
    Ton: {
      // IN=in0, PT=in1(ms); Q=out0, ET=out1
      init: function () {
        return "{ startTime: 0, isTiming: false }";
      },
      emit: function (n, ctx) {
        var s = ctx.state,
          Q = ctx.out(0),
          ET = ctx.out(1);
        return [
          "var IN = " + boolGuard(n, 0) + ", PT = " + intPreset(n, 1) + ";",
          "if (IN) {",
          "  if (!" + s + ".isTiming) { " + s + ".startTime = Date.now(); " + s + ".isTiming = true; }",
          "  var elapsed = Date.now() - " + s + ".startTime;",
          "  if (elapsed >= PT) { " + ET + " = PT; " + Q + " = 1; }",
          "  else { " + ET + " = Math.floor(elapsed); " + Q + " = 0; }",
          "} else {",
          "  " + s + ".isTiming = false; " + s + ".startTime = 0; " + Q + " = 0; " + ET + " = 0;",
          "}",
        ].join("\n");
      },
    },
    Tof: {
      // IN=in0, PT=in1(ms); Q=out0, ET=out1
      init: function () {
        return "{ startTime: 0, isTiming: false, wasOn: false }";
      },
      emit: function (n, ctx) {
        var s = ctx.state,
          Q = ctx.out(0),
          ET = ctx.out(1);
        return [
          "var IN = " + boolGuard(n, 0) + ", PT = " + intPreset(n, 1) + ";",
          "if (IN) {",
          "  " + Q + " = 1; " + ET + " = 0; " + s + ".isTiming = false; " + s + ".wasOn = true;",
          "} else if (" + s + ".wasOn) {",
          "  if (!" + s + ".isTiming) { " + s + ".startTime = Date.now(); " + s + ".isTiming = true; }",
          "  var elapsed = Date.now() - " + s + ".startTime;",
          "  if (elapsed >= PT) { " + ET + " = PT; " + Q + " = 0; " + s + ".wasOn = false; " + s + ".isTiming = false; }",
          "  else { " + ET + " = Math.floor(elapsed); " + Q + " = 1; }",
          "} else {",
          "  " + Q + " = 0; " + ET + " = 0;",
          "}",
        ].join("\n");
      },
    },
    Tonr: {
      // IN=in0, R=in1, PT=in2(ms); Q=out0, ET=out1 (retentive/accumulating)
      init: function () {
        return "{ accumulatedTime: 0, lastTime: 0, isTiming: false }";
      },
      emit: function (n, ctx) {
        var s = ctx.state,
          Q = ctx.out(0),
          ET = ctx.out(1);
        return [
          "var IN = " + boolGuard(n, 0) + ", R = " + boolGuard(n, 1) + ", PT = " + intPreset(n, 2) + ";",
          "if (R) {",
          "  " + s + ".accumulatedTime = 0; " + s + ".isTiming = false; " + Q + " = 0; " + ET + " = 0;",
          "} else if (IN) {",
          "  if (!" + s + ".isTiming) { " + s + ".lastTime = Date.now(); " + s + ".isTiming = true; }",
          "  var now = Date.now();",
          "  " + s + ".accumulatedTime += now - " + s + ".lastTime;",
          "  " + s + ".lastTime = now;",
          "  if (" + s + ".accumulatedTime >= PT) { " + s + ".accumulatedTime = PT; " + Q + " = 1; }",
          "  else { " + Q + " = 0; }",
          "  " + ET + " = Math.floor(" + s + ".accumulatedTime);",
          "} else {",
          "  " + s + ".isTiming = false; " + ET + " = Math.floor(" + s + ".accumulatedTime);",
          "}",
        ].join("\n");
      },
    },
    OneSecondTimer: {
      // START=in0, EN/RST=in1, PT=in2 (SECONDS); Q=out0, ET=out1 (seconds)
      // in0/in1 use getInputValue() directly; PT is read raw (.value) like the
      // simulator (which has no unconnected guard — we default to 0 instead of
      // throwing).
      init: function () {
        return "{ startTime: 0, timerTime: 0, isTiming: 0, doneTiming: 0 }";
      },
      emit: function (n, ctx) {
        var s = ctx.state,
          Q = ctx.out(0),
          ET = ctx.out(1),
          PT = ctx.in(2); // raw analog (net var or 0)
        return [
          "if (" + ctx.in(1) + ") {",
          "  if (" + ctx.in(0) + " && !" + s + ".isTiming) { " + s + ".startTime = Date.now(); " + s + ".isTiming = 1; }",
          "  if (" + s + ".isTiming && !" + s + ".doneTiming) {",
          "    " + s + ".timerTime = parseInt((Date.now() - " + s + ".startTime) / 1000);",
          "    " + ET + " = " + s + ".timerTime;",
          "  }",
          "  if (" + s + ".timerTime >= " + PT + ") { " + Q + " = 1; " + s + ".doneTiming = 1; }",
          "  if (" + ctx.in(0) + " && " + Q + " == 0) { " + s + ".doneTiming = 0; } else { " + s + ".doneTiming = 1; }",
          "} else {",
          "  " + s + ".timerTime = 0; " + ET + " = 0; " + Q + " = 0; " + s + ".isTiming = 0; " + s + ".doneTiming = 0;",
          "}",
        ].join("\n");
      },
    },

    // ---- Values -----------------------------------------------------------
    Constant: {
      // Fixed integer value at the output (no inputs).
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + num(n.constantValue) + ";";
      },
    },
    Variable: {
      // Display-only sink: an input pin but no output — nothing to emit.
      emit: function () {
        return "// Variable: display only (no output) — nothing to compute.";
      },
    },

    // ---- Math (Add/Sub/Mul/Div share the int-round vs real-toFixed rule) --
    Add: {
      emit: function (n, ctx) {
        return mathEmit(n, ctx, "a + b");
      },
    },
    Sub: {
      emit: function (n, ctx) {
        return mathEmit(n, ctx, "a - b");
      },
    },
    Mul: {
      emit: function (n, ctx) {
        return mathEmit(n, ctx, "a * b");
      },
    },
    Div: {
      // Division by zero leaves the output unchanged (persistent net), matching
      // the simulator which only assigns when the divisor is non-zero.
      emit: function (n, ctx) {
        var val = roundIfInt(
          n.mathDataType,
          "Math.round(a / b)",
          "parseFloat((a / b).toFixed(6))",
        );
        return [
          "var a = " + floatIn(n, 0) + ", b = " + floatIn(n, 1) + ";",
          "if (b !== 0) { " + ctx.out(0) + " = " + val + "; }",
        ].join("\n");
      },
    },

    // ---- Conversions ------------------------------------------------------
    IntToReal: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + intIn(n, 0) + ";";
      },
    },
    RealToInt: {
      emit: function (n, ctx) {
        var fn =
          n.roundMode === "floor"
            ? "Math.floor"
            : n.roundMode === "ceil"
              ? "Math.ceil"
              : "Math.round";
        return ctx.out(0) + " = " + fn + "(" + floatIn(n, 0) + ");";
      },
    },

    // ---- Analog scaling ---------------------------------------------------
    NormX: {
      // OUT = (VALUE - MIN) / (MAX - MIN), 0 when MAX==MIN
      emit: function (n, ctx) {
        return [
          "var min = " + floatIn(n, 0) + ", value = " + floatIn(n, 1) + ", max = " + floatIn(n, 2) + ";",
          ctx.out(0) + " = (max - min !== 0) ? parseFloat(((value - min) / (max - min)).toFixed(6)) : 0;",
        ].join("\n");
      },
    },
    ScaleX: {
      // OUT = MIN + VALUE * (MAX - MIN)
      emit: function (n, ctx) {
        return [
          "var min = " + floatIn(n, 0) + ", value = " + floatIn(n, 1) + ", max = " + floatIn(n, 2) + ";",
          ctx.out(0) + " = parseFloat((min + value * (max - min)).toFixed(6));",
        ].join("\n");
      },
    },
    Limit: {
      // OUT = clamp(VALUE, MIN, MAX)
      emit: function (n, ctx) {
        var out = roundIfInt(
          n.limitDataType,
          "Math.round(out)",
          "parseFloat(out.toFixed(6))",
        );
        return [
          "var min = " + floatIn(n, 0) + ", value = " + floatIn(n, 1) + ", max = " + floatIn(n, 2) + ";",
          "var out = value;",
          "if (out < min) out = min;",
          "if (out > max) out = max;",
          ctx.out(0) + " = " + out + ";",
        ].join("\n");
      },
    },
    Move: {
      // When EN is true, copy IN to OUT; otherwise hold last value.
      emit: function (n, ctx) {
        var val = roundIfInt(n.moveDataType, "Math.round(val)", "val");
        return [
          "var en = " + boolGuard(n, 0) + ";",
          "if (en) {",
          "  var val = " + floatIn(n, 1) + ";",
          "  " + ctx.out(0) + " = " + val + ";",
          "}",
        ].join("\n");
      },
    },
    Ain: {
      // Legacy 0-4095 ADC scaler: lc = 3276/(max-min); OUT = (raw-819)/lc
      // (in0 = raw, in1 = scale max, in2 = scale min)
      emit: function (n, ctx) {
        return [
          "var raw = " + rawIn(n, 0) + ", smax = " + rawIn(n, 1) + ", smin = " + rawIn(n, 2) + ";",
          "var lc = 3276 / (smax - smin);",
          ctx.out(0) + " = parseFloat(((raw - 819) / lc).toFixed(2));",
        ].join("\n");
      },
    },
    FirstOrderLag: {
      // Real-time first-order filter; recomputes at most once per second, matching
      // the simulator (parseInt((now-lastScan)/1000) >= 1).
      init: function () {
        return "{ lastpv: 0, lastScan: 0, firstScan: 1 }";
      },
      emit: function (n, ctx) {
        var s = ctx.state;
        return [
          "var now = Date.now();",
          "if (" + s + ".firstScan) { " + s + ".lastScan = now; " + s + ".firstScan = 0; }",
          "else if (parseInt((now - " + s + ".lastScan) / 1000) >= 1) {",
          "  var pv = " + floatIn(n, 0) + ", delay = " + floatIn(n, 1) + ", lag = " + floatIn(n, 2) + ";",
          "  var outpv = " + s + ".lastpv + (delay / (delay + lag)) * (pv - " + s + ".lastpv);",
          "  " + ctx.out(0) + " = parseFloat(outpv.toFixed(1));",
          "  " + s + ".lastpv = outpv;",
          "  " + s + ".lastScan = now;",
          "}",
        ].join("\n");
      },
    },

    // ---- Comparators (bool output) ---------------------------------------
    Gt: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = (" + floatIn(n, 0) + " > " + floatIn(n, 1) + ") ? 1 : 0;";
      },
    },
    Lt: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = (" + floatIn(n, 0) + " < " + floatIn(n, 1) + ") ? 1 : 0;";
      },
    },
    Cmp: {
      emit: function (n, ctx) {
        var op =
          n.cmpMode === ">="
            ? ">="
            : n.cmpMode === "<="
              ? "<="
              : n.cmpMode === "<>"
                ? "!=="
                : "==="; // default "=="
        return [
          "var a = " + floatIn(n, 0) + ", b = " + floatIn(n, 1) + ";",
          ctx.out(0) + " = (a " + op + " b) ? 1 : 0;",
        ].join("\n");
      },
    },
    InRange: {
      emit: function (n, ctx) {
        return [
          "var min = " + floatIn(n, 0) + ", value = " + floatIn(n, 1) + ", max = " + floatIn(n, 2) + ";",
          ctx.out(0) + " = (value >= min && value <= max) ? 1 : 0;",
        ].join("\n");
      },
    },
    OutOfRange: {
      emit: function (n, ctx) {
        return [
          "var min = " + floatIn(n, 0) + ", value = " + floatIn(n, 1) + ", max = " + floatIn(n, 2) + ";",
          ctx.out(0) + " = (value < min || value > max) ? 1 : 0;",
        ].join("\n");
      },
    },
    Not: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = (" + ctx.in(0) + " == 0) ? 1 : 0;";
      },
    },

    // ---- Selection / routing ---------------------------------------------
    Select: {
      // Selector (bool) picks IN1 (true) or IN2 (false).
      emit: function (n, ctx) {
        return ctx.out(0) + " = (" + ctx.in(0) + ") ? " + rawIn(n, 1) + " : " + rawIn(n, 2) + ";";
      },
    },
    Mux: {
      // SEL (in0) chooses among IN1..INn (in1..inN); data type rounds ints.
      emit: function (n, ctx) {
        var cnt = n.numInputs || 2;
        var vals = [];
        for (var i = 0; i < cnt; i++) vals.push(floatIn(n, i + 1));
        var pick = roundIfInt(n.muxDataType, "Math.round(val)", "val");
        return [
          "var sel = " + intIn(n, 0) + ";",
          "if (sel < 0) sel = 0;",
          "if (sel >= " + cnt + ") sel = " + (cnt - 1) + ";",
          "var _mux = [" + vals.join(", ") + "];",
          "var val = _mux[sel];",
          ctx.out(0) + " = " + pick + ";",
        ].join("\n");
      },
    },
    Demux: {
      // SEL (in0) routes IN (in1) to one of OUT1..OUTm; others 0.
      emit: function (n, ctx) {
        var cnt = n.numOutputs || 2;
        var v = roundIfInt(n.demuxDataType, "Math.round(val)", "val");
        var lines = [
          "var sel = " + intIn(n, 0) + ";",
          "if (sel < 0) sel = 0;",
          "if (sel >= " + cnt + ") sel = " + (cnt - 1) + ";",
          "var val = " + floatIn(n, 1) + ";",
          "var _dv = " + v + ";",
        ];
        for (var i = 0; i < cnt; i++) {
          lines.push(ctx.out(i) + " = (sel === " + i + ") ? _dv : 0;");
        }
        return lines.join("\n");
      },
    },

    // ---- Word / bit packing ----------------------------------------------
    UnpackSixteen: {
      // 16-bit input word -> 16 boolean bit outputs (bit 0 = LSB).
      emit: function (n, ctx) {
        var lines = ["var w = " + intIn(n, 0) + ";"];
        for (var i = 0; i < 16; i++) {
          lines.push(ctx.out(i) + " = (w >> " + i + ") & 1;");
        }
        return lines.join("\n");
      },
    },
    PackSixteen: {
      // 16 boolean bit inputs -> integer word (bit i weight 2^i).
      emit: function (n, ctx) {
        var terms = [];
        for (var i = 0; i < 16; i++) {
          terms.push("(" + boolGuard(n, i) + ") * " + Math.pow(2, i));
        }
        return ctx.out(0) + " = " + terms.join(" + ") + ";";
      },
    },

    // ---- Cross-page connectors -------------------------------------------
    Junction: {
      // Pass-through node (visual wire junction with a data type).
      emit: function (n, ctx) {
        var c = n.inputs[0];
        var val = c && c.dataType === "bool" ? ctx.in(0) : rawIn(n, 0);
        return ctx.out(0) + " = " + val + ";";
      },
    },
    // Bus sinks (output pin): reproduce the value under their label.
    LabelOutPanel: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + busKey("L", n.labelName) + ";";
      },
    },
    TagLabelOut: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + busKey("T", n.labelName) + ";";
      },
    },
    JumpIn: {
      emit: function (n, ctx) {
        return ctx.out(0) + " = " + busKey("J", n.labelName) + ";";
      },
    },
    // Bus sources (input pin): capture the value under their label.
    // LabelInPanel / JumpOut only write when connected (sink holds last).
    LabelInPanel: {
      emit: function (n, ctx) {
        var v = busSourceValue(n, ctx);
        return v == null
          ? "// LabelInPanel '" + (n.labelName || "???") + "': input unconnected."
          : busKey("L", n.labelName) + " = " + v + ";";
      },
    },
    JumpOut: {
      emit: function (n, ctx) {
        var v = busSourceValue(n, ctx);
        return v == null
          ? "// JumpOut '" + (n.labelName || "???") + "': input unconnected."
          : busKey("J", n.labelName) + " = " + v + ";";
      },
    },
    // TagLabelIn always writes (pushes 0 when unconnected), matching the sim.
    TagLabelIn: {
      emit: function (n, ctx) {
        var v = busSourceValue(n, ctx);
        return busKey("T", n.labelName) + " = " + (v == null ? "0" : v) + ";";
      },
    },
  };

  // Shared emitter for Add/Sub/Mul: int -> Math.round, real -> toFixed(6).
  function mathEmit(n, ctx, expr) {
    var val = roundIfInt(
      n.mathDataType,
      "Math.round(" + expr + ")",
      "parseFloat((" + expr + ").toFixed(6))",
    );
    return [
      "var a = " + floatIn(n, 0) + ", b = " + floatIn(n, 1) + ";",
      ctx.out(0) + " = " + val + ";",
    ].join("\n");
  }

  // ---------------------------------------------------------------------------
  // validate(graph) -> { ok, unsupported:[{type,index,tag}] }
  // ---------------------------------------------------------------------------
  function validate(graph) {
    var unsupported = [];
    for (var i = 0; i < graph.nodes.length; i++) {
      var n = graph.nodes[i];
      if (IGNORE[n.type]) continue;
      if (isCustom(n.type)) {
        // Custom blocks are supported when their definition is present and the
        // user code passes the same safety check the editor applies.
        if (!n.definition) {
          unsupported.push({ type: n.type, index: n.index, tag: n.tagName });
        }
        continue;
      }
      if (!BLOCK_REGISTRY[n.type]) {
        unsupported.push({ type: n.type, index: n.index, tag: n.tagName });
      }
    }
    return { ok: unsupported.length === 0, unsupported: unsupported };
  }

  // Validate custom block user code: refuse forbidden APIs and syntax errors so
  // a broken definition fails the export loudly instead of shipping a bad node.
  function checkCustomCode(graph) {
    for (var i = 0; i < graph.nodes.length; i++) {
      var n = graph.nodes[i];
      if (!isCustom(n.type) || !n.definition) continue;
      var code = n.definition.code || "";
      if (CUSTOM_FORBIDDEN.test(code)) {
        throw new Error(
          "Custom-Block '" + (n.definition.name || "?") +
            "' verwendet nicht erlaubte APIs (window/document/eval/…). Export abgebrochen.",
        );
      }
      try {
        // Compile-check only; the generated node inlines the body directly.
        new Function("__in", "__state", customBody(n.definition));
      } catch (e) {
        throw new Error(
          "Custom-Block '" + (n.definition.name || "?") +
            "' hat einen Syntaxfehler: " + e.message + ". Export abgebrochen.",
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // generateCode(graph) -> { initialize, func, finalize }
  // Throws if the graph contains unsupported blocks.
  // ---------------------------------------------------------------------------
  function generateCode(graph) {
    var check = validate(graph);
    if (!check.ok) {
      var names = check.unsupported.map(function (u) {
        return u.type + (u.tag ? " (" + u.tag + ")" : "");
      });
      var err = new Error(
        "Nicht unterstützte Blöcke für den Node-RED-Export:\n  " +
          names.join("\n  ") +
          "\n\nDer Export wurde abgebrochen, damit kein fehlerhafter Node entsteht.",
      );
      err.unsupported = check.unsupported;
      throw err;
    }
    checkCustomCode(graph);

    var netInits = [];
    var stateInits = [];
    var busInits = {}; // deduped: bus key literal -> seed line
    var scanLines = [];

    for (var i = 0; i < graph.nodes.length; i++) {
      var n = graph.nodes[i];
      if (IGNORE[n.type]) continue;
      var custom = isCustom(n.type);
      var def = custom ? null : BLOCK_REGISTRY[n.type];

      // Seed every output net to 0 so feedback reads are defined on scan 1.
      for (var o = 0; o < n.outputs.length; o++) {
        if (n.outputs[o]) netInits.push(netName(n.index, o) + " = 0;");
      }

      // Seed persistent state.
      if (custom) {
        if ((n.definition.state || []).length) {
          stateInits.push(stateName(n.index) + " = " + customStateInit(n.definition) + ";");
        }
      } else if (def.init) {
        stateInits.push(stateName(n.index) + " = " + def.init(n) + ";");
      }

      // Seed any bus this block touches (deduped across sources and sinks).
      if (BUS_NS[n.type]) {
        var key = busKey(BUS_NS[n.type], n.labelName);
        busInits[key] = key + " = 0;";
      }

      var ctx = makeCtx(n);
      var body = custom ? customEmit(n, ctx) : def.emit(n, ctx);
      var label =
        "// [" + n.index + "] " + n.type + (n.tagName ? " — " + n.tagName : "") +
        (n.labelName ? " — " + n.labelName : "");
      scanLines.push(label + "\n{\n" + indent(body, 2) + "\n}");
    }

    var busInitLines = Object.keys(busInits).map(function (k) {
      return busInits[k];
    });
    var initialize = buildInitialize(graph, netInits, stateInits, busInitLines, scanLines);
    var func = buildFunc();
    var finalize = buildFinalize();

    return { initialize: initialize, func: func, finalize: finalize };
  }

  // Per-block emit context.
  function makeCtx(n) {
    return {
      in: function (pin) {
        return inExpr(n, pin);
      },
      out: function (pin) {
        return netName(n.index, pin);
      },
      state: stateName(n.index),
      tag: lit(n.tagName),
      emitSend: function (valueExpr) {
        var tag = lit(n.tagName);
        return (
          "var v = " + valueExpr + ";\n" +
          "if (rt.last[" + tag + "] !== v) {\n" +
          "  rt.last[" + tag + "] = v;\n" +
          "  node.send({ topic: " + tag + ", payload: v });\n" +
          "}"
        );
      },
    };
  }

  function buildInitialize(graph, netInits, stateInits, busInits, scanLines) {
    var header =
      "// ===================================================================\n" +
      "// jsBlocks -> Node-RED export" +
      (graph.name ? " — " + graph.name : "") +
      "\n// Generated by NodeRedExport " + VERSION +
      "\n// Scan cycle: " + graph.cycleMs + " ms (timers use real wall-clock time)\n" +
      "// ===================================================================";

    return [
      header,
      "var CYCLE_MS = " + graph.cycleMs + ";",
      "",
      "var rt = {",
      "  reg: {},   // process image: msg.topic -> latest payload (DI/AI)",
      "  net: {},   // net values, persistent across scans (feedback support)",
      "  st: {},    // per-block state (latches, edges, timers)",
      "  bus: {},   // named signal buses (Label/Tag/Jump connectors)",
      "  last: {}   // last sent value per output tag (change detection)",
      "};",
      "",
      "var net = rt.net, st = rt.st, bus = rt.bus;",
      "// Seed nets",
      netInits.join("\n"),
      stateInits.length ? "// Seed block state" : "",
      stateInits.join("\n"),
      busInits.length ? "// Seed signal buses" : "",
      busInits.join("\n"),
      "",
      "rt.scan = function () {",
      "  var net = rt.net, st = rt.st, reg = rt.reg, bus = rt.bus;",
      indent(scanLines.join("\n\n"), 2),
      "};",
      "",
      "rt.timer = setInterval(rt.scan, CYCLE_MS);",
      'context.set("rt", rt);',
    ]
      .filter(function (l) {
        return l !== "";
      })
      .join("\n");
  }

  function buildFunc() {
    return [
      "// Incoming messages update the process image only; the scan loop drives",
      "// all outputs. Nothing is passed straight through.",
      'var rt = context.get("rt");',
      "if (rt && msg && msg.topic !== undefined) {",
      "  rt.reg[msg.topic] = msg.payload;",
      "}",
      "return null;",
    ].join("\n");
  }

  function buildFinalize() {
    return [
      'var rt = context.get("rt");',
      "if (rt && rt.timer) { clearInterval(rt.timer); }",
      'context.set("rt", undefined);',
    ].join("\n");
  }

  // ---------------------------------------------------------------------------
  // generateFlow(graph) -> Node-RED clipboard array with a single function node.
  // ---------------------------------------------------------------------------
  function generateFlow(graph) {
    var code = generateCode(graph);
    var node = {
      id: randomId(),
      type: "function",
      z: "",
      name: graph.name || "jsBlocks",
      func: code.func,
      outputs: 1,
      timeout: 0,
      noerr: 0,
      initialize: code.initialize,
      finalize: code.finalize,
      libs: [],
      x: 200,
      y: 160,
      wires: [[]],
    };
    return [node];
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function indent(text, spaces) {
    var pad = new Array(spaces + 1).join(" ");
    return String(text)
      .split("\n")
      .map(function (l) {
        return l.length ? pad + l : l;
      })
      .join("\n");
  }

  function randomId() {
    // 16 hex chars, Node-RED id style.
    var s = "";
    for (var i = 0; i < 16; i++) {
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return s.slice(0, 8) + "." + s.slice(8, 14);
  }

  // ---------------------------------------------------------------------------
  // export(sheet) — browser entry: validate, generate, download.
  // ---------------------------------------------------------------------------
  function exportSheet(sheet) {
    var graph = buildGraph(sheet);
    var flow;
    try {
      flow = generateFlow(graph);
    } catch (e) {
      if (typeof alert === "function") alert(e.message);
      else throw e;
      return;
    }

    var json = JSON.stringify(flow, null, 2);
    if (typeof document === "undefined") return json; // headless safety

    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var clean =
      sheet._sanitizeFilename && sheet.projectName
        ? sheet._sanitizeFilename(sheet.projectName)
        : "";
    var ts = sheet._timestampString ? sheet._timestampString() : "";
    var fileName =
      "nodered_" + (clean ? clean + "_" : "") + (ts || "flow") + ".json";
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return json;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  var api = {
    VERSION: VERSION,
    IGNORE: IGNORE,
    SUPPORTED: Object.keys(BLOCK_REGISTRY),
    buildGraph: buildGraph,
    validate: validate,
    generateCode: generateCode,
    generateFlow: generateFlow,
    export: exportSheet,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.NodeRedExport = api;
  }
})();
