"use strict";

// Headless regression tests for the Node-RED exporter.
//
// Strategy: build a DOM-free fake sheet (blocks + connectors wired by object
// identity, exactly the shape buildGraph reads), run the FULL pipeline
// (buildGraph -> generateFlow), then EXECUTE the generated function-node code in
// a sandbox that stubs Node-RED's context / setInterval / node.send. We drive
// scans manually and assert the emitted {topic,payload} messages against the
// IEC 61131-3 semantics the simulator implements.
//
// Run with:  node --test scripts/__tests__/

const test = require("node:test");
const assert = require("node:assert");
const NodeRedExport = require("../NodeRedExport.js");

// --- fake sheet builders ----------------------------------------------------
function conn(dataType, inverted) {
  return { dataType: dataType, inverted: !!inverted, connectedFrom: null, value: 0 };
}
function block(objectName, opts) {
  opts = opts || {};
  return {
    objectName: objectName,
    tagName: opts.tagName != null ? opts.tagName : null,
    numberInputs: opts.numberInputs,
    inConnections: opts.ins || [],
    outConnections: opts.outs || [],
  };
}
function wire(srcOut, dstIn) {
  dstIn.connectedFrom = srcOut;
}
function sheet(blockObjects, cycleMs, name) {
  return {
    projectName: name || "test",
    simulationCycleMs: cycleMs || 15,
    blockObjects: blockObjects,
  };
}

// --- sandbox runner ---------------------------------------------------------
function runFlow(flow) {
  const fn = flow[0];
  const nodeObj = {
    sent: [],
    send(m) {
      this.sent.push(m);
    },
    warn() {},
    error() {},
    log() {},
    status() {},
  };
  const store = {};
  const context = {
    get: (k) => store[k],
    set: (k, v) => {
      store[k] = v;
    },
  };
  const setIntervalStub = (f, ms) => ({ f, ms }); // do not auto-run
  const clearIntervalStub = () => {};

  new Function("context", "node", "setInterval", "clearInterval", fn.initialize)(
    context,
    nodeObj,
    setIntervalStub,
    clearIntervalStub,
  );
  const rt = context.get("rt");
  const onMessage = new Function("context", "node", "msg", fn.func);
  const onStop = new Function("context", "node", "clearInterval", fn.finalize);

  return {
    rt,
    sent: nodeObj.sent,
    send(topic, payload) {
      onMessage(context, nodeObj, { topic: topic, payload: payload });
    },
    scan() {
      rt.scan();
    },
    stop() {
      onStop(context, nodeObj, clearIntervalStub);
    },
  };
}

// Deterministic clock control: the generated timer code calls Date.now(), so we
// monkeypatch it to simulate elapsed wall-clock time between scans.
let FAKE_NOW = 0;
const REAL_NOW = Date.now;
function setNow(ms) {
  FAKE_NOW = ms;
}
test.before(() => {
  Date.now = () => FAKE_NOW;
});
test.after(() => {
  Date.now = REAL_NOW;
});

function lastPayload(sent, topic) {
  for (let i = sent.length - 1; i >= 0; i--) {
    if (sent[i].topic === topic) return sent[i].payload;
  }
  return undefined;
}
function countSends(sent, topic) {
  return sent.filter((m) => m.topic === topic).length;
}

// ---------------------------------------------------------------------------
test("AND gate: output true only when both inputs true", () => {
  const di1 = block("Di", { tagName: "S1", outs: [conn("bool")] });
  const di2 = block("Di", { tagName: "S2", outs: [conn("bool")] });
  const and = block("And", {
    numberInputs: 2,
    ins: [conn("bool"), conn("bool")],
    outs: [conn("bool")],
  });
  const doOut = block("Do", { tagName: "OUT", ins: [conn("bool")] });
  wire(di1.outConnections[0], and.inConnections[0]);
  wire(di2.outConnections[0], and.inConnections[1]);
  wire(and.outConnections[0], doOut.inConnections[0]);

  const r = runFlow(NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([di1, di2, and, doOut]))));

  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), false, "initial: false");

  r.send("S1", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), false, "only S1: false");

  r.send("S2", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), true, "both: true");

  r.send("S1", false);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), false, "S1 off: false");
});

test("DO only sends on change (edge-triggered)", () => {
  const di = block("Di", { tagName: "S1", outs: [conn("bool")] });
  const doOut = block("Do", { tagName: "OUT", ins: [conn("bool")] });
  wire(di.outConnections[0], doOut.inConnections[0]);
  const r = runFlow(NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([di, doOut]))));

  r.scan(); // sends false once
  r.send("S1", true);
  r.scan(); // sends true
  r.scan(); // no change -> no send
  r.scan();
  assert.strictEqual(countSends(r.sent, "OUT"), 2, "one false + one true only");
});

test("inverted input (NOT bubble) is honoured", () => {
  const di = block("Di", { tagName: "S1", outs: [conn("bool")] });
  const doOut = block("Do", { tagName: "OUT", ins: [conn("bool", true)] }); // inverted input
  wire(di.outConnections[0], doOut.inConnections[0]);
  const r = runFlow(NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([di, doOut]))));

  r.send("S1", false);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), true, "not(false)=true");
  r.send("S1", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), false, "not(true)=false");
});

test("SR latch (set-dominant) holds state across scans", () => {
  const s = block("Di", { tagName: "S", outs: [conn("bool")] });
  const rr = block("Di", { tagName: "R", outs: [conn("bool")] });
  const sr = block("SetReset", {
    ins: [conn("bool"), conn("bool")],
    outs: [conn("bool")],
  });
  const doOut = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(s.outConnections[0], sr.inConnections[0]);
  wire(rr.outConnections[0], sr.inConnections[1]);
  wire(sr.outConnections[0], doOut.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([s, rr, sr, doOut]))),
  );

  r.send("S", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "set");
  r.send("S", false);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "holds after set released");
  r.send("R", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "reset");

  // Set-dominant: S and R together -> Q stays 1
  r.send("S", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "set wins over reset");
});

test("R_TRIG emits a single-scan pulse on rising edge", () => {
  const di = block("Di", { tagName: "CLK", outs: [conn("bool")] });
  const rtrig = block("RTrig", { ins: [conn("bool")], outs: [conn("bool")] });
  const doOut = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(di.outConnections[0], rtrig.inConnections[0]);
  wire(rtrig.outConnections[0], doOut.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([di, rtrig, doOut]))),
  );

  r.scan(); // false
  r.send("CLK", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "pulse on rising edge");
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "pulse only one scan");
});

test("analog AI -> AQ passthrough with change detection", () => {
  const ai = block("Ai", { tagName: "IN", outs: [conn("int")] });
  const aq = block("Aq", { tagName: "OUT", ins: [conn("int")] });
  wire(ai.outConnections[0], aq.inConnections[0]);
  const r = runFlow(NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([ai, aq]))));

  r.scan(); // initial: unconnected/unset AI reads 0 -> AQ sends 0
  assert.strictEqual(lastPayload(r.sent, "OUT"), 0);
  r.send("IN", 42);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), 42);
  r.scan();
  assert.strictEqual(countSends(r.sent, "OUT"), 2, "0 then 42, no repeat"); // initial 0 + 42
  r.send("IN", 7);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), 7);
});

test("feedback loop reads previous-scan value (toggle via SR)", () => {
  // Q feeds back into its own reset through a rising-edge — classic 1-scan delay.
  // Here we simply verify a feedback edge does not throw and uses seeded 0.
  const en = block("Di", { tagName: "EN", outs: [conn("bool")] });
  const and = block("And", {
    numberInputs: 2,
    ins: [conn("bool"), conn("bool")],
    outs: [conn("bool")],
  });
  const doOut = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(en.outConnections[0], and.inConnections[0]);
  wire(and.outConnections[0], and.inConnections[1]); // feedback into itself
  wire(and.outConnections[0], doOut.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([en, and, doOut]))),
  );
  r.send("EN", true);
  r.scan(); // and = EN && (prev=0) = 0
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
  r.scan(); // still 0 (latched low)
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
});

test("hard-fail: unknown block type aborts export with a clear list", () => {
  const bogus = block("TotallyUnknownBlock", { ins: [], outs: [conn("bool")] });
  const g = NodeRedExport.buildGraph(sheet([bogus]));
  const v = NodeRedExport.validate(g);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.unsupported[0].type, "TotallyUnknownBlock");
  assert.throws(() => NodeRedExport.generateFlow(g), /TotallyUnknownBlock/);
});

test("hard-fail: custom block without a definition is rejected", () => {
  const c = block("Custom_Missing", { ins: [conn("bool")], outs: [conn("bool")] });
  // no .definition
  const g = NodeRedExport.buildGraph(sheet([c]));
  assert.strictEqual(NodeRedExport.validate(g).ok, false);
  assert.throws(() => NodeRedExport.generateFlow(g), /Custom_Missing/);
});

test("visual blocks (Comment/DrawLine/Snap) are ignored", () => {
  const di = block("Di", { tagName: "S1", outs: [conn("bool")] });
  const doOut = block("Do", { tagName: "OUT", ins: [conn("bool")] });
  wire(di.outConnections[0], doOut.inConnections[0]);
  const cmt = block("Comment", {});
  const g = NodeRedExport.buildGraph(sheet([cmt, di, doOut]));
  assert.strictEqual(NodeRedExport.validate(g).ok, true);
  const r = runFlow(NodeRedExport.generateFlow(g));
  r.send("S1", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), true);
});

test("generated flow has one function node named after the project", () => {
  const di = block("Di", { tagName: "S1", outs: [conn("bool")] });
  const flow = NodeRedExport.generateFlow(
    NodeRedExport.buildGraph(sheet([di], 100, "My Plant")),
  );
  assert.strictEqual(flow.length, 1);
  assert.strictEqual(flow[0].type, "function");
  assert.strictEqual(flow[0].name, "My Plant");
  assert.match(flow[0].initialize, /CYCLE_MS = 100/);
});

// --- Timers (Phase 2) -------------------------------------------------------
// Build: AI(PT) + DI(IN[/R]) -> timer -> DO(Q) + AQ(ET). Execution order in
// blockObjects puts the input feeders before the timer.

test("TON: on-delay in milliseconds", () => {
  const aiPT = block("Ai", { tagName: "PT", outs: [conn("int")] });
  const diIN = block("Di", { tagName: "IN", outs: [conn("bool")] });
  const ton = block("Ton", {
    ins: [conn("bool"), conn("int")],
    outs: [conn("bool"), conn("int")],
  });
  const doQ = block("Do", { tagName: "Q", ins: [conn("bool")] });
  const aqET = block("Aq", { tagName: "ET", ins: [conn("int")] });
  wire(diIN.outConnections[0], ton.inConnections[0]);
  wire(aiPT.outConnections[0], ton.inConnections[1]);
  wire(ton.outConnections[0], doQ.inConnections[0]);
  wire(ton.outConnections[1], aqET.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(
      NodeRedExport.buildGraph(sheet([aiPT, diIN, ton, doQ, aqET])),
    ),
  );

  r.send("PT", 1000);
  setNow(0);
  r.send("IN", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "t=0: not yet");
  assert.strictEqual(lastPayload(r.sent, "ET"), 0);

  setNow(500);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "t=500: still timing");
  assert.strictEqual(lastPayload(r.sent, "ET"), 500);

  setNow(1000);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "t=1000: elapsed");
  assert.strictEqual(lastPayload(r.sent, "ET"), 1000);

  r.send("IN", false);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "reset on IN low");
  assert.strictEqual(lastPayload(r.sent, "ET"), 0);
});

test("TOF: off-delay in milliseconds", () => {
  const aiPT = block("Ai", { tagName: "PT", outs: [conn("int")] });
  const diIN = block("Di", { tagName: "IN", outs: [conn("bool")] });
  const tof = block("Tof", {
    ins: [conn("bool"), conn("int")],
    outs: [conn("bool"), conn("int")],
  });
  const doQ = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(diIN.outConnections[0], tof.inConnections[0]);
  wire(aiPT.outConnections[0], tof.inConnections[1]);
  wire(tof.outConnections[0], doQ.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(
      NodeRedExport.buildGraph(sheet([aiPT, diIN, tof, doQ])),
    ),
  );

  r.send("PT", 1000);
  setNow(0);
  r.send("IN", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "IN on -> Q on");

  r.send("IN", false);
  setNow(0);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "off-delay: still on at t=0");
  setNow(500);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "still on at t=500");
  setNow(1000);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "off after PT");
});

test("TONR: retentive accumulation across IN gaps, reset by R", () => {
  const aiPT = block("Ai", { tagName: "PT", outs: [conn("int")] });
  const diIN = block("Di", { tagName: "IN", outs: [conn("bool")] });
  const diR = block("Di", { tagName: "R", outs: [conn("bool")] });
  const tonr = block("Tonr", {
    ins: [conn("bool"), conn("bool"), conn("int")],
    outs: [conn("bool"), conn("int")],
  });
  const doQ = block("Do", { tagName: "Q", ins: [conn("bool")] });
  const aqET = block("Aq", { tagName: "ET", ins: [conn("int")] });
  wire(diIN.outConnections[0], tonr.inConnections[0]);
  wire(diR.outConnections[0], tonr.inConnections[1]);
  wire(aiPT.outConnections[0], tonr.inConnections[2]);
  wire(tonr.outConnections[0], doQ.inConnections[0]);
  wire(tonr.outConnections[1], aqET.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(
      NodeRedExport.buildGraph(sheet([aiPT, diIN, diR, tonr, doQ, aqET])),
    ),
  );

  r.send("PT", 1000);
  // Accumulate 400ms
  setNow(0);
  r.send("IN", true);
  r.scan(); // starts, +0
  setNow(400);
  r.scan(); // +400
  assert.strictEqual(lastPayload(r.sent, "ET"), 400);
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
  // Pause IN — accumulator retained
  r.send("IN", false);
  setNow(900);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "ET"), 400, "retained while IN low");
  // Resume — add 600 more to reach 1000
  r.send("IN", true);
  r.scan(); // restart timing at now=900, +0
  setNow(1500);
  r.scan(); // +600 -> total 1000
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "reaches preset cumulatively");
  assert.strictEqual(lastPayload(r.sent, "ET"), 1000);
  // Reset
  r.send("R", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "R clears");
  assert.strictEqual(lastPayload(r.sent, "ET"), 0);
});

test("Constant feeds a fixed preset (Constant -> TON.PT)", () => {
  const kPT = block("Constant", { outs: [conn("int")] });
  kPT.constantValue = 800;
  const diIN = block("Di", { tagName: "IN", outs: [conn("bool")] });
  const ton = block("Ton", {
    ins: [conn("bool"), conn("int")],
    outs: [conn("bool"), conn("int")],
  });
  const doQ = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(diIN.outConnections[0], ton.inConnections[0]);
  wire(kPT.outConnections[0], ton.inConnections[1]);
  wire(ton.outConnections[0], doQ.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(
      NodeRedExport.buildGraph(sheet([kPT, diIN, ton, doQ])),
    ),
  );

  setNow(0);
  r.send("IN", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "no message needed for PT");
  setNow(799);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "just under preset");
  setNow(800);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "reaches constant preset");
});

test("Constant emits its integer value", () => {
  const k = block("Constant", { outs: [conn("int")] });
  k.constantValue = -5;
  const aq = block("Aq", { tagName: "OUT", ins: [conn("int")] });
  wire(k.outConnections[0], aq.inConnections[0]);
  const r = runFlow(NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet([k, aq]))));
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "OUT"), -5);
});

test("OneSecondTimer: on-delay in whole seconds, gated by enable", () => {
  const aiPT = block("Ai", { tagName: "PT", outs: [conn("int")] });
  const diStart = block("Di", { tagName: "START", outs: [conn("bool")] });
  const diEN = block("Di", { tagName: "EN", outs: [conn("bool")] });
  const t1s = block("OneSecondTimer", {
    ins: [conn("bool"), conn("bool"), conn("int")],
    outs: [conn("bool"), conn("int")],
  });
  const doQ = block("Do", { tagName: "Q", ins: [conn("bool")] });
  const aqET = block("Aq", { tagName: "ET", ins: [conn("int")] });
  wire(diStart.outConnections[0], t1s.inConnections[0]);
  wire(diEN.outConnections[0], t1s.inConnections[1]);
  wire(aiPT.outConnections[0], t1s.inConnections[2]);
  wire(t1s.outConnections[0], doQ.inConnections[0]);
  wire(t1s.outConnections[1], aqET.inConnections[0]);
  const r = runFlow(
    NodeRedExport.generateFlow(
      NodeRedExport.buildGraph(sheet([aiPT, diStart, diEN, t1s, doQ, aqET])),
    ),
  );

  r.send("PT", 2); // 2 seconds preset
  r.send("EN", true);
  setNow(0);
  r.send("START", true);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "t=0s");
  setNow(2000);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "ET"), 2, "elapsed 2 seconds");
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "reaches preset");
  // Disable resets
  r.send("EN", false);
  r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false, "disable clears");
});

// --- Phase 3: analog / math -------------------------------------------------
// Feed analog values via AI blocks, read results via AQ (or DO for bool).
function mk(blocks, cycle, name) {
  return runFlow(
    NodeRedExport.generateFlow(NodeRedExport.buildGraph(sheet(blocks, cycle, name))),
  );
}

test("Add/Sub/Mul: real vs int rounding", () => {
  function twoInOneOut(type, dt) {
    const a = block("Ai", { tagName: "A", outs: [conn("real")] });
    const b = block("Ai", { tagName: "B", outs: [conn("real")] });
    const op = block(type, { ins: [conn(dt), conn(dt)], outs: [conn(dt)] });
    op.mathDataType = dt;
    const out = block("Aq", { tagName: "R", ins: [conn(dt)] });
    wire(a.outConnections[0], op.inConnections[0]);
    wire(b.outConnections[0], op.inConnections[1]);
    wire(op.outConnections[0], out.inConnections[0]);
    return mk([a, b, op, out]);
  }
  let r = twoInOneOut("Add", "real");
  r.send("A", 2.5); r.send("B", 3.2); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 5.7);
  r = twoInOneOut("Add", "int");
  r.send("A", 2.5); r.send("B", 3.2); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 6, "int rounds 5.7 -> 6");
  r = twoInOneOut("Sub", "real");
  r.send("A", 10); r.send("B", 4); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 6);
  r = twoInOneOut("Mul", "real");
  r.send("A", 3); r.send("B", 1.5); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 4.5);
});

test("Div: normal and divide-by-zero holds previous value", () => {
  const a = block("Ai", { tagName: "A", outs: [conn("real")] });
  const b = block("Ai", { tagName: "B", outs: [conn("real")] });
  const div = block("Div", { ins: [conn("real"), conn("real")], outs: [conn("real")] });
  div.mathDataType = "real";
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(a.outConnections[0], div.inConnections[0]);
  wire(b.outConnections[0], div.inConnections[1]);
  wire(div.outConnections[0], out.inConnections[0]);
  const r = mk([a, b, div, out]);
  r.send("A", 10); r.send("B", 2); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 5);
  r.send("B", 0); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 5, "div-by-zero keeps last value");
});

test("IntToReal and RealToInt (round/floor/ceil)", () => {
  function conv(type, mode) {
    const a = block("Ai", { tagName: "A", outs: [conn("real")] });
    const cv = block(type, {
      ins: [conn(type === "IntToReal" ? "int" : "real")],
      outs: [conn(type === "IntToReal" ? "real" : "int")],
    });
    if (mode) cv.roundMode = mode;
    const out = block("Aq", { tagName: "R", ins: [conn("real")] });
    wire(a.outConnections[0], cv.inConnections[0]);
    wire(cv.outConnections[0], out.inConnections[0]);
    return mk([a, cv, out]);
  }
  let r = conv("IntToReal");
  r.send("A", 7.9); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 7, "IntToReal truncates via parseInt");
  r = conv("RealToInt", "round"); r.send("A", 2.6); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 3);
  r = conv("RealToInt", "floor"); r.send("A", 2.9); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 2);
  r = conv("RealToInt", "ceil"); r.send("A", 2.1); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 3);
});

test("NormX and ScaleX scalings", () => {
  const a = block("Ai", { tagName: "V", outs: [conn("real")] });
  const mn = block("Ai", { tagName: "MN", outs: [conn("real")] });
  const mx = block("Ai", { tagName: "MX", outs: [conn("real")] });
  const norm = block("NormX", { ins: [conn("int"), conn("int"), conn("int")], outs: [conn("real")] });
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(mn.outConnections[0], norm.inConnections[0]);
  wire(a.outConnections[0], norm.inConnections[1]);
  wire(mx.outConnections[0], norm.inConnections[2]);
  wire(norm.outConnections[0], out.inConnections[0]);
  const r = mk([a, mn, mx, norm, out]);
  r.send("MN", 0); r.send("MX", 200); r.send("V", 50); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 0.25);
  r.send("MX", 0); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 0, "zero span -> 0");
});

test("Limit clamps (int rounds)", () => {
  const v = block("Ai", { tagName: "V", outs: [conn("real")] });
  const mn = block("Ai", { tagName: "MN", outs: [conn("real")] });
  const mx = block("Ai", { tagName: "MX", outs: [conn("real")] });
  const lim = block("Limit", { ins: [conn("int"), conn("int"), conn("int")], outs: [conn("int")] });
  lim.limitDataType = "int";
  const out = block("Aq", { tagName: "R", ins: [conn("int")] });
  wire(mn.outConnections[0], lim.inConnections[0]);
  wire(v.outConnections[0], lim.inConnections[1]);
  wire(mx.outConnections[0], lim.inConnections[2]);
  wire(lim.outConnections[0], out.inConnections[0]);
  const r = mk([v, mn, mx, lim, out]);
  r.send("MN", 0); r.send("MX", 10);
  r.send("V", 15); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 10, "clamped to max");
  r.send("V", -3); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 0, "clamped to min");
  r.send("V", 4.6); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 5, "int rounds 4.6 -> 5");
});

test("Move gates on EN and holds when disabled", () => {
  const en = block("Di", { tagName: "EN", outs: [conn("bool")] });
  const inp = block("Ai", { tagName: "IN", outs: [conn("real")] });
  const mv = block("Move", { ins: [conn("bool"), conn("real")], outs: [conn("real")] });
  mv.moveDataType = "real";
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(en.outConnections[0], mv.inConnections[0]);
  wire(inp.outConnections[0], mv.inConnections[1]);
  wire(mv.outConnections[0], out.inConnections[0]);
  const r = mk([en, inp, mv, out]);
  r.send("IN", 42); r.send("EN", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 42);
  r.send("EN", false); r.send("IN", 99); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 42, "holds while EN low");
});

test("Cmp modes, Gt, Lt", () => {
  function cmp(mode) {
    const a = block("Ai", { tagName: "A", outs: [conn("real")] });
    const b = block("Ai", { tagName: "B", outs: [conn("real")] });
    const c = block("Cmp", { ins: [conn("real"), conn("real")], outs: [conn("bool")] });
    c.cmpMode = mode;
    const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
    wire(a.outConnections[0], c.inConnections[0]);
    wire(b.outConnections[0], c.inConnections[1]);
    wire(c.outConnections[0], out.inConnections[0]);
    return mk([a, b, c, out]);
  }
  let r = cmp("=="); r.send("A", 5); r.send("B", 5); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);
  r = cmp(">="); r.send("A", 5); r.send("B", 6); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
  r = cmp("<>"); r.send("A", 5); r.send("B", 6); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);

  const a = block("Ai", { tagName: "A", outs: [conn("real")] });
  const b = block("Ai", { tagName: "B", outs: [conn("real")] });
  const gt = block("Gt", { ins: [conn("real"), conn("real")], outs: [conn("bool")] });
  const lt = block("Lt", { ins: [conn("real"), conn("real")], outs: [conn("bool")] });
  const dg = block("Do", { tagName: "G", ins: [conn("bool")] });
  const dl = block("Do", { tagName: "L", ins: [conn("bool")] });
  wire(a.outConnections[0], gt.inConnections[0]); wire(b.outConnections[0], gt.inConnections[1]);
  wire(a.outConnections[0], lt.inConnections[0]); wire(b.outConnections[0], lt.inConnections[1]);
  wire(gt.outConnections[0], dg.inConnections[0]); wire(lt.outConnections[0], dl.inConnections[0]);
  const r2 = mk([a, b, gt, lt, dg, dl]);
  r2.send("A", 7); r2.send("B", 3); r2.scan();
  assert.strictEqual(lastPayload(r2.sent, "G"), true);
  assert.strictEqual(lastPayload(r2.sent, "L"), false);
});

test("InRange / OutOfRange", () => {
  const v = block("Ai", { tagName: "V", outs: [conn("real")] });
  const mn = block("Ai", { tagName: "MN", outs: [conn("real")] });
  const mx = block("Ai", { tagName: "MX", outs: [conn("real")] });
  const ir = block("InRange", { ins: [conn("real"), conn("real"), conn("real")], outs: [conn("bool")] });
  const or = block("OutOfRange", { ins: [conn("real"), conn("real"), conn("real")], outs: [conn("bool")] });
  const din = block("Do", { tagName: "IN", ins: [conn("bool")] });
  const dout = block("Do", { tagName: "OUT", ins: [conn("bool")] });
  [ir, or].forEach((blk) => {
    wire(mn.outConnections[0], blk.inConnections[0]);
    wire(v.outConnections[0], blk.inConnections[1]);
    wire(mx.outConnections[0], blk.inConnections[2]);
  });
  wire(ir.outConnections[0], din.inConnections[0]);
  wire(or.outConnections[0], dout.inConnections[0]);
  const r = mk([v, mn, mx, ir, or, din, dout]);
  r.send("MN", 0); r.send("MX", 10);
  r.send("V", 5); r.scan();
  assert.strictEqual(lastPayload(r.sent, "IN"), true);
  assert.strictEqual(lastPayload(r.sent, "OUT"), false);
  r.send("V", 20); r.scan();
  assert.strictEqual(lastPayload(r.sent, "IN"), false);
  assert.strictEqual(lastPayload(r.sent, "OUT"), true);
});

test("Not inverts bool", () => {
  const di = block("Di", { tagName: "S", outs: [conn("bool")] });
  const nt = block("Not", { ins: [conn("bool")], outs: [conn("bool")] });
  const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(di.outConnections[0], nt.inConnections[0]);
  wire(nt.outConnections[0], out.inConnections[0]);
  const r = mk([di, nt, out]);
  r.send("S", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
  r.send("S", false); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);
});

test("Select picks by boolean", () => {
  const sel = block("Di", { tagName: "SEL", outs: [conn("bool")] });
  const t = block("Ai", { tagName: "T", outs: [conn("real")] });
  const f = block("Ai", { tagName: "F", outs: [conn("real")] });
  const s = block("Select", { ins: [conn("bool"), conn("real"), conn("real")], outs: [conn("real")] });
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(sel.outConnections[0], s.inConnections[0]);
  wire(t.outConnections[0], s.inConnections[1]);
  wire(f.outConnections[0], s.inConnections[2]);
  wire(s.outConnections[0], out.inConnections[0]);
  const r = mk([sel, t, f, s, out]);
  r.send("T", 111); r.send("F", 222);
  r.send("SEL", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 111);
  r.send("SEL", false); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 222);
});

test("Mux selects input, clamps SEL", () => {
  const sel = block("Ai", { tagName: "SEL", outs: [conn("int")] });
  const i1 = block("Ai", { tagName: "I1", outs: [conn("real")] });
  const i2 = block("Ai", { tagName: "I2", outs: [conn("real")] });
  const i3 = block("Ai", { tagName: "I3", outs: [conn("real")] });
  const mux = block("Mux", { ins: [conn("int"), conn("real"), conn("real"), conn("real")], outs: [conn("real")] });
  mux.numInputs = 3; mux.muxDataType = "real";
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(sel.outConnections[0], mux.inConnections[0]);
  wire(i1.outConnections[0], mux.inConnections[1]);
  wire(i2.outConnections[0], mux.inConnections[2]);
  wire(i3.outConnections[0], mux.inConnections[3]);
  wire(mux.outConnections[0], out.inConnections[0]);
  const r = mk([sel, i1, i2, i3, mux, out]);
  r.send("I1", 10); r.send("I2", 20); r.send("I3", 30);
  r.send("SEL", 1); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 20);
  r.send("SEL", 9); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 30, "SEL clamped to last input");
});

test("Demux routes to selected output, others 0", () => {
  const sel = block("Ai", { tagName: "SEL", outs: [conn("int")] });
  const inp = block("Ai", { tagName: "IN", outs: [conn("real")] });
  const dmx = block("Demux", { ins: [conn("int"), conn("real")], outs: [conn("real"), conn("real"), conn("real")] });
  dmx.numOutputs = 3; dmx.demuxDataType = "real";
  const o0 = block("Aq", { tagName: "O0", ins: [conn("real")] });
  const o1 = block("Aq", { tagName: "O1", ins: [conn("real")] });
  const o2 = block("Aq", { tagName: "O2", ins: [conn("real")] });
  wire(sel.outConnections[0], dmx.inConnections[0]);
  wire(inp.outConnections[0], dmx.inConnections[1]);
  wire(dmx.outConnections[0], o0.inConnections[0]);
  wire(dmx.outConnections[1], o1.inConnections[0]);
  wire(dmx.outConnections[2], o2.inConnections[0]);
  const r = mk([sel, inp, dmx, o0, o1, o2]);
  r.send("IN", 77); r.send("SEL", 1); r.scan();
  assert.strictEqual(lastPayload(r.sent, "O1"), 77);
  assert.strictEqual(lastPayload(r.sent, "O0"), 0);
  assert.strictEqual(lastPayload(r.sent, "O2"), 0);
});

test("Pack16 / Unpack16 round-trip", () => {
  const b0 = block("Di", { tagName: "B0", outs: [conn("bool")] });
  const b3 = block("Di", { tagName: "B3", outs: [conn("bool")] });
  const pack = block("PackSixteen", { ins: [], outs: [conn("int")] });
  for (let i = 0; i < 16; i++) pack.inConnections[i] = conn("bool");
  wire(b0.outConnections[0], pack.inConnections[0]);
  wire(b3.outConnections[0], pack.inConnections[3]);
  const word = block("Aq", { tagName: "W", ins: [conn("int")] });
  wire(pack.outConnections[0], word.inConnections[0]);
  const unpack = block("UnpackSixteen", { ins: [conn("int")], outs: [] });
  for (let i = 0; i < 16; i++) unpack.outConnections[i] = conn("bool");
  wire(pack.outConnections[0], unpack.inConnections[0]);
  const q0 = block("Do", { tagName: "Q0", ins: [conn("bool")] });
  const q3 = block("Do", { tagName: "Q3", ins: [conn("bool")] });
  const q1 = block("Do", { tagName: "Q1", ins: [conn("bool")] });
  wire(unpack.outConnections[0], q0.inConnections[0]);
  wire(unpack.outConnections[3], q3.inConnections[0]);
  wire(unpack.outConnections[1], q1.inConnections[0]);
  const r = mk([b0, b3, pack, word, unpack, q0, q3, q1]);
  r.send("B0", true); r.send("B3", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "W"), 9, "1 + 8");
  assert.strictEqual(lastPayload(r.sent, "Q0"), true);
  assert.strictEqual(lastPayload(r.sent, "Q3"), true);
  assert.strictEqual(lastPayload(r.sent, "Q1"), false);
});

test("Ain scales 0-4095 raw to engineering units", () => {
  const raw = block("Ai", { tagName: "RAW", outs: [conn("int")] });
  const smax = block("Ai", { tagName: "SMAX", outs: [conn("real")] });
  const smin = block("Ai", { tagName: "SMIN", outs: [conn("real")] });
  const ain = block("Ain", { ins: [conn("int"), conn("real"), conn("real")], outs: [conn("real")] });
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(raw.outConnections[0], ain.inConnections[0]);
  wire(smax.outConnections[0], ain.inConnections[1]);
  wire(smin.outConnections[0], ain.inConnections[2]);
  wire(ain.outConnections[0], out.inConnections[0]);
  const r = mk([raw, smax, smin, ain, out]);
  r.send("SMAX", 100); r.send("SMIN", 0); r.send("RAW", 2048); r.scan();
  // lc = 3276/100 = 32.76; (2048-819)/32.76 = 37.515... -> 37.52
  assert.strictEqual(lastPayload(r.sent, "R"), 37.52);
});

test("FirstOrderLag filters at most once per second", () => {
  const pv = block("Ai", { tagName: "PV", outs: [conn("real")] });
  const dly = block("Ai", { tagName: "DLY", outs: [conn("real")] });
  const lag = block("Ai", { tagName: "LAG", outs: [conn("real")] });
  const fol = block("FirstOrderLag", { ins: [conn("real"), conn("real"), conn("real")], outs: [conn("real")] });
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(pv.outConnections[0], fol.inConnections[0]);
  wire(dly.outConnections[0], fol.inConnections[1]);
  wire(lag.outConnections[0], fol.inConnections[2]);
  wire(fol.outConnections[0], out.inConnections[0]);
  const r = mk([pv, dly, lag, fol, out]);
  r.send("PV", 10); r.send("DLY", 1); r.send("LAG", 1); // factor 0.5
  setNow(0); r.scan(); // firstScan seeds lastScan
  assert.strictEqual(lastPayload(r.sent, "R"), 0, "no update on first scan");
  setNow(1000); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 5, "0 + 0.5*(10-0)");
  setNow(2000); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 7.5, "5 + 0.5*(10-5)");
  setNow(2500); r.scan(); // < 1s since last update -> no change
  assert.strictEqual(lastPayload(r.sent, "R"), 7.5, "holds within the second");
});

test("Variable is a no-op sink (no output, does not break export)", () => {
  const ai = block("Ai", { tagName: "IN", outs: [conn("real")] });
  const v = block("Variable", { ins: [conn("int")], outs: [] });
  wire(ai.outConnections[0], v.inConnections[0]);
  const g = NodeRedExport.buildGraph(sheet([ai, v]));
  assert.strictEqual(NodeRedExport.validate(g).ok, true);
  const r = runFlow(NodeRedExport.generateFlow(g));
  r.send("IN", 5);
  r.scan(); // must not throw
});

// --- Phase 4: cross-page connectors + custom blocks -------------------------

test("Junction passes signal through", () => {
  const di = block("Di", { tagName: "S", outs: [conn("bool")] });
  const j = block("Junction", { ins: [conn("bool")], outs: [conn("bool")] });
  const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(di.outConnections[0], j.inConnections[0]);
  wire(j.outConnections[0], out.inConnections[0]);
  const r = mk([di, j, out]);
  r.send("S", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);
});

test("LabelInPanel -> LabelOutPanel bus by name", () => {
  const di = block("Di", { tagName: "S", outs: [conn("bool")] });
  const lin = block("LabelInPanel", { ins: [conn("bool")], outs: [] });
  lin.labelName = "MOTOR";
  const lout = block("LabelOutPanel", { ins: [], outs: [conn("bool")] });
  lout.labelName = "MOTOR";
  const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(di.outConnections[0], lin.inConnections[0]);
  wire(lout.outConnections[0], out.inConnections[0]);
  const r = mk([di, lin, lout, out]);
  r.send("S", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true, "value crosses the bus");
  r.send("S", false); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
});

test("TagLabelIn -> TagLabelOut bus (analog)", () => {
  const ai = block("Ai", { tagName: "V", outs: [conn("real")] });
  const tin = block("TagLabelIn", { ins: [conn("real")], outs: [] });
  tin.labelName = "SP";
  const tout = block("TagLabelOut", { ins: [], outs: [conn("real")] });
  tout.labelName = "SP";
  const out = block("Aq", { tagName: "R", ins: [conn("real")] });
  wire(ai.outConnections[0], tin.inConnections[0]);
  wire(tout.outConnections[0], out.inConnections[0]);
  const r = mk([ai, tin, tout, out]);
  r.send("V", 3.14); r.scan();
  assert.strictEqual(lastPayload(r.sent, "R"), 3.14);
});

test("JumpOut -> JumpIn bus by name", () => {
  const di = block("Di", { tagName: "S", outs: [conn("bool")] });
  const jout = block("JumpOut", { ins: [conn("bool")], outs: [] });
  jout.labelName = "STEP1";
  const jin = block("JumpIn", { ins: [], outs: [conn("bool")] });
  jin.labelName = "STEP1";
  const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(di.outConnections[0], jout.inConnections[0]);
  wire(jin.outConnections[0], out.inConnections[0]);
  const r = mk([di, jout, jin, out]);
  r.send("S", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);
});

test("buses of different types with the same name do not interfere", () => {
  // A Label bus "X" (true) and a Jump bus "X" (unused) must stay separate.
  const di = block("Di", { tagName: "S", outs: [conn("bool")] });
  const lin = block("LabelInPanel", { ins: [conn("bool")], outs: [] });
  lin.labelName = "X";
  const lout = block("LabelOutPanel", { ins: [], outs: [conn("bool")] });
  lout.labelName = "X";
  const jin = block("JumpIn", { ins: [], outs: [conn("bool")] }); // Jump "X", no source
  jin.labelName = "X";
  const ql = block("Do", { tagName: "QL", ins: [conn("bool")] });
  const qj = block("Do", { tagName: "QJ", ins: [conn("bool")] });
  wire(di.outConnections[0], lin.inConnections[0]);
  wire(lout.outConnections[0], ql.inConnections[0]);
  wire(jin.outConnections[0], qj.inConnections[0]);
  const r = mk([di, lin, lout, jin, ql, qj]);
  r.send("S", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "QL"), true, "Label bus X set");
  assert.strictEqual(lastPayload(r.sent, "QJ"), false, "Jump bus X untouched");
});

// Custom block helper: build a definition-bearing block.
function customBlock(def, inTypes, outCount) {
  const b = block("Custom_" + def.name, {
    ins: (inTypes || []).map((t) => conn(t)),
    outs: Array.from({ length: outCount || 0 }, () => conn("real")),
  });
  b.definition = def;
  return b;
}

test("Custom block: combinational logic (a AND b)", () => {
  const def = {
    name: "MyAnd",
    inputs: [{ name: "a" }, { name: "b" }],
    outputs: [{ name: "q" }],
    state: [],
    code: "q = (a && b) ? 1 : 0;",
  };
  const da = block("Di", { tagName: "A", outs: [conn("bool")] });
  const db = block("Di", { tagName: "B", outs: [conn("bool")] });
  const cb = customBlock(def, ["bool", "bool"], 1);
  const out = block("Do", { tagName: "Q", ins: [conn("bool")] });
  wire(da.outConnections[0], cb.inConnections[0]);
  wire(db.outConnections[0], cb.inConnections[1]);
  wire(cb.outConnections[0], out.inConnections[0]);
  const r = mk([da, db, cb, out]);
  r.send("A", true); r.send("B", true); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), true);
  r.send("B", false); r.scan();
  assert.strictEqual(lastPayload(r.sent, "Q"), false);
});

test("Custom block: stateful counter with persistent state", () => {
  const def = {
    name: "Counter",
    inputs: [{ name: "clk" }],
    outputs: [{ name: "count" }],
    state: [{ name: "n", initial: 0 }, { name: "last", initial: 0 }],
    code: "if (clk && !last) { n = n + 1; } last = clk; count = n;",
  };
  const clk = block("Di", { tagName: "CLK", outs: [conn("bool")] });
  const cb = customBlock(def, ["bool"], 1);
  const out = block("Aq", { tagName: "N", ins: [conn("int")] });
  wire(clk.outConnections[0], cb.inConnections[0]);
  wire(cb.outConnections[0], out.inConnections[0]);
  const r = mk([clk, cb, out]);
  r.scan(); // 0
  r.send("CLK", true); r.scan(); // rising -> 1
  assert.strictEqual(lastPayload(r.sent, "N"), 1);
  r.send("CLK", false); r.scan();
  r.send("CLK", true); r.scan(); // rising -> 2
  assert.strictEqual(lastPayload(r.sent, "N"), 2, "state persists across scans");
  r.send("CLK", false); r.scan();
  r.send("CLK", true); r.scan(); // rising -> 3
  assert.strictEqual(lastPayload(r.sent, "N"), 3);
});

test("Custom block: multiple outputs", () => {
  const def = {
    name: "MinMax",
    inputs: [{ name: "x" }, { name: "y" }],
    outputs: [{ name: "lo" }, { name: "hi" }],
    state: [],
    code: "lo = Math.min(x, y); hi = Math.max(x, y);",
  };
  const ax = block("Ai", { tagName: "X", outs: [conn("real")] });
  const ay = block("Ai", { tagName: "Y", outs: [conn("real")] });
  const cb = customBlock(def, ["real", "real"], 2);
  const lo = block("Aq", { tagName: "LO", ins: [conn("real")] });
  const hi = block("Aq", { tagName: "HI", ins: [conn("real")] });
  wire(ax.outConnections[0], cb.inConnections[0]);
  wire(ay.outConnections[0], cb.inConnections[1]);
  wire(cb.outConnections[0], lo.inConnections[0]);
  wire(cb.outConnections[1], hi.inConnections[0]);
  const r = mk([ax, ay, cb, lo, hi]);
  r.send("X", 7); r.send("Y", 3); r.scan();
  assert.strictEqual(lastPayload(r.sent, "LO"), 3);
  assert.strictEqual(lastPayload(r.sent, "HI"), 7);
});

test("Custom block: forbidden API in code is rejected at export", () => {
  const def = {
    name: "Evil",
    inputs: [{ name: "a" }],
    outputs: [{ name: "q" }],
    state: [],
    code: "q = window.location.href;",
  };
  const cb = customBlock(def, ["bool"], 1);
  const g = NodeRedExport.buildGraph(sheet([cb]));
  assert.throws(() => NodeRedExport.generateFlow(g), /nicht erlaubte APIs|window/);
});

test("Custom block: syntax error in code is rejected at export", () => {
  const def = {
    name: "Broken",
    inputs: [{ name: "a" }],
    outputs: [{ name: "q" }],
    state: [],
    code: "q = (a +;",
  };
  const cb = customBlock(def, ["bool"], 1);
  const g = NodeRedExport.buildGraph(sheet([cb]));
  assert.throws(() => NodeRedExport.generateFlow(g), /Syntaxfehler/);
});
