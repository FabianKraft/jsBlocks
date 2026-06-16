///////////////////////////////////////////////////////////
//
//		Custom User Block System
//		Copyright 2007 Shawn Summey (original author)
//		Copyright 2026 Fabian Kraft (current maintainer)
//
//		Allows end-users to create, edit, save, load and
//		simulate custom function blocks without modifying
//		the JavaScript source code.
//
//		Components:
//		  - CustomBlock          : runtime block class
//		  - CustomBlockRegistry  : localStorage persistence + dropdown sync
//		  - CustomBlockEditor    : visual block definition editor
//
///////////////////////////////////////////////////////////

//**************************************************************************
//  Forbidden keywords check for user code safety
//**************************************************************************
CustomBlock._FORBIDDEN =
  /\b(window|document|eval|Function|fetch|XMLHttpRequest|import|require|location|navigator|cookie|localStorage|sessionStorage|alert|confirm|prompt)\b/;

//**************************************************************************
//  Compile user code into a callable function
//  Returns { fn: Function, error: string|null }
//**************************************************************************
CustomBlock._compileCode = function (definition) {
  var inputNames = (definition.inputs || []).map(function (p) {
    return p.name;
  });
  var outputNames = (definition.outputs || []).map(function (p) {
    return p.name;
  });
  var stateNames = (definition.state || []).map(function (p) {
    return p.name;
  });

  var body = "";
  // Inputs are read-only locals
  for (var i = 0; i < inputNames.length; i++) {
    body += "var " + inputNames[i] + " = __in[" + i + "];\n";
  }
  // State variables are mutable locals
  for (var i = 0; i < stateNames.length; i++) {
    body += "var " + stateNames[i] + " = __state['" + stateNames[i] + "'];\n";
  }
  // Output variables initialized to 0
  for (var i = 0; i < outputNames.length; i++) {
    body += "var " + outputNames[i] + " = 0;\n";
  }
  // User code
  body += (definition.code || "") + "\n";
  // Write state back
  for (var i = 0; i < stateNames.length; i++) {
    body += "__state['" + stateNames[i] + "'] = " + stateNames[i] + ";\n";
  }
  // Return outputs as array
  body += "return [" + outputNames.join(",") + "];\n";

  try {
    var fn = new Function("__in", "__state", body);
    return { fn: fn, error: null };
  } catch (e) {
    return { fn: null, error: e.message };
  }
};

//**************************************************************************
//  CustomBlock — runtime wrapper for user-defined blocks
//**************************************************************************
function CustomBlock(definition) {
  // If no definition passed (eval path), look up by name
  if (!definition && this._pendingDefName) {
    definition = CustomBlockRegistry.get(this._pendingDefName);
  }

  this.definition = definition || null;
  this.objectName = definition ? "Custom_" + definition.name : "Custom_unknown";
  this.text = definition ? definition.text || definition.name : "?";

  // Custom dimensions (Base defaults: divWidth=60, divHeight=80)
  if (definition) {
    if (definition.width && definition.width > 0)
      this.divWidth = definition.width;
    if (definition.height && definition.height > 0)
      this.divHeight = definition.height;
  }

  // Internal state — initialized from definition defaults
  this._state = {};
  if (definition && definition.state) {
    for (var i = 0; i < definition.state.length; i++) {
      var s = definition.state[i];
      this._state[s.name] =
        s.initial !== undefined ? Number(s.initial) || 0 : 0;
    }
  }

  // Pre-compile user code
  this._compiledFn = null;
  this._compileError = null;
  if (definition) {
    var result = CustomBlock._compileCode(definition);
    this._compiledFn = result.fn;
    this._compileError = result.error;
  }
}

// Derive from Base
CustomBlock.prototype = new Base();

CustomBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
};

CustomBlock.prototype.addConnections = function () {
  if (!this.definition) return;
  var def = this.definition;
  for (var i = 0; i < (def.inputs || []).length; i++) {
    var pin = def.inputs[i];
    var tooltip =
      (pin.symbol || pin.name) + (pin.comment ? " - " + pin.comment : "");
    this.inConnections[i] = new Connector(
      this,
      1,
      pin.percent,
      pin.type || "bool",
      tooltip,
    );
  }
  for (var i = 0; i < (def.outputs || []).length; i++) {
    var pin = def.outputs[i];
    var tooltip =
      (pin.symbol || pin.name) + (pin.comment ? " - " + pin.comment : "");
    this.outConnections[i] = new Connector(
      this,
      0,
      pin.percent,
      pin.type || "bool",
      tooltip,
    );
  }
  // Render pin symbols AFTER connectors exist, using their actual Y positions
  this._renderPinSymbols();
};

CustomBlock.prototype._renderPinSymbols = function () {
  if (!this.definition || !this.divObj) return;
  var def = this.definition;
  var headerH = this.headerDiv ? this.headerDiv.offsetHeight : 16;
  var blockTop = parseFloat(this.divObj.style.top) || 0;

  // Input symbols
  for (var i = 0; i < this.inConnections.length; i++) {
    var pin = (def.inputs || [])[i];
    if (!pin || !pin.symbol) continue;
    var connY = parseFloat(this.inConnections[i].theConnector.style.top) || 0;
    var topPx = Math.round(connY - blockTop - 7);
    if (topPx < headerH) topPx = headerH;
    var lbl = document.createElement("div");
    lbl.style.position = "absolute";
    lbl.style.left = "2px";
    lbl.style.top = topPx + "px";
    lbl.style.fontSize = "9px";
    lbl.style.fontWeight = "bold";
    lbl.style.pointerEvents = "none";
    lbl.textContent = pin.symbol;
    this.divObj.appendChild(lbl);
  }
  // Output symbols
  for (var i = 0; i < this.outConnections.length; i++) {
    var pin = (def.outputs || [])[i];
    if (!pin || !pin.symbol) continue;
    var connY = parseFloat(this.outConnections[i].theConnector.style.top) || 0;
    var topPx = Math.round(connY - blockTop - 7);
    if (topPx < headerH) topPx = headerH;
    var lbl = document.createElement("div");
    lbl.style.position = "absolute";
    lbl.style.right = "2px";
    lbl.style.top = topPx + "px";
    lbl.style.fontSize = "9px";
    lbl.style.fontWeight = "bold";
    lbl.style.pointerEvents = "none";
    lbl.textContent = pin.symbol;
    this.divObj.appendChild(lbl);
  }
};

CustomBlock.prototype.Execute = function () {
  if (!this._compiledFn) {
    this.divObj.style.border = "2px dashed red";
    return;
  }

  // Gather input values
  var inputs = [];
  for (var i = 0; i < this.inConnections.length; i++) {
    var conn = this.inConnections[i];
    if (conn.dataType === "bool") {
      inputs.push(conn.getInputValue());
    } else {
      inputs.push(
        conn.connectedFrom ? conn.connectedFrom.getEffectiveValue() : 0,
      );
    }
  }

  try {
    var results = this._compiledFn(inputs, this._state);
    for (var i = 0; i < this.outConnections.length; i++) {
      this.outConnections[i].value =
        results && results[i] !== undefined ? results[i] : 0;
    }
    // Visual feedback: green border when executing OK
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } catch (e) {
    this.divObj.style.border = "2px dashed red";
    if (console && console.error)
      console.error(
        "CustomBlock '" + this.definition.name + "' Execute error:",
        e,
      );
  }
};

// Double-click opens the block definition editor for this custom block type
CustomBlock.prototype.dblclickHandler = function (e) {
  if (!this.sheetObject.simulateOn && this.definition) {
    CustomBlockEditor.open(this.definition.name, this.sheetObject);
  }
  e.stopPropagation();
};

// Serialization
CustomBlock.prototype._serializeProps = function (props) {
  if (this.definition) {
    props.defName = this.definition.name;
  }
  props.state = JSON.parse(JSON.stringify(this._state));
};

CustomBlock.prototype.applySerializedProps = function (props) {
  if (props.state) {
    this._state = props.state;
  }
  // Re-link definition if missing
  if (props.defName && !this.definition) {
    this.definition = CustomBlockRegistry.get(props.defName);
    if (this.definition) {
      this.objectName = "Custom_" + this.definition.name;
      this.text = this.definition.text || this.definition.name;
      var result = CustomBlock._compileCode(this.definition);
      this._compiledFn = result.fn;
      this._compileError = result.error;
    }
  }
};

// Recompiles after definition is edited
CustomBlock.prototype.recompile = function () {
  if (!this.definition) return;
  var result = CustomBlock._compileCode(this.definition);
  this._compiledFn = result.fn;
  this._compileError = result.error;
  // Update display text
  this.text = this.definition.text || this.definition.name;
  if (this.headerDiv) {
    this.headerDiv.innerHTML = this.text;
  }
};

//**************************************************************************
//  CustomBlockRegistry — manages user block definitions in localStorage
//**************************************************************************
var CustomBlockRegistry = {
  _storageKey: "jsblocks_custom_definitions",
  _definitions: {},

  init: function () {
    try {
      var stored = localStorage.getItem(this._storageKey);
      if (stored) {
        var arr = JSON.parse(stored);
        for (var i = 0; i < arr.length; i++) {
          this._definitions[arr[i].name] = arr[i];
        }
      }
    } catch (e) {
      if (console && console.warn)
        console.warn("Could not load custom blocks:", e);
    }
    this._syncDropdown();
  },

  _persist: function () {
    var arr = [];
    for (var name in this._definitions) {
      if (this._definitions.hasOwnProperty(name)) {
        arr.push(this._definitions[name]);
      }
    }
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(arr));
    } catch (e) {
      if (console && console.warn)
        console.warn("Could not save custom blocks:", e);
    }
  },

  add: function (definition) {
    this._definitions[definition.name] = definition;
    this._persist();
    this._syncDropdown();
  },

  update: function (oldName, definition) {
    // If name changed, remove old entry
    if (oldName !== definition.name) {
      delete this._definitions[oldName];
    }
    this._definitions[definition.name] = definition;
    this._persist();
    this._syncDropdown();
  },

  remove: function (name) {
    delete this._definitions[name];
    this._persist();
    this._syncDropdown();
  },

  get: function (name) {
    return this._definitions[name] || null;
  },

  getAll: function () {
    var result = [];
    for (var name in this._definitions) {
      if (this._definitions.hasOwnProperty(name)) {
        result.push(this._definitions[name]);
      }
    }
    return result;
  },

  has: function (name) {
    return this._definitions.hasOwnProperty(name);
  },

  // Import definitions from a project file (merges into localStorage)
  importFromProject: function (definitions) {
    for (var name in definitions) {
      if (definitions.hasOwnProperty(name)) {
        this._definitions[name] = definitions[name];
      }
    }
    this._persist();
    this._syncDropdown();
  },

  // Export all definitions as JSON string
  exportAll: function () {
    return JSON.stringify(this.getAll(), null, 2);
  },

  // Import definitions from JSON string
  importFromJSON: function (jsonString) {
    try {
      var arr = JSON.parse(jsonString);
      if (!Array.isArray(arr)) {
        alert("Invalid format: expected an array of definitions.");
        return false;
      }
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].name) {
          this._definitions[arr[i].name] = arr[i];
        }
      }
      this._persist();
      this._syncDropdown();
      return true;
    } catch (e) {
      alert("Error importing: " + e.message);
      return false;
    }
  },

  // Rebuild the "User Defined" optgroup in the blockList dropdown
  _syncDropdown: function () {
    var list = document.getElementById("blockList");
    if (!list) return;

    // Remove existing "User Defined" optgroup
    var groups = list.querySelectorAll("optgroup");
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].label === "User Defined") {
        list.removeChild(groups[i]);
      }
    }

    // Add custom blocks
    var defs = this.getAll();
    if (defs.length > 0) {
      var group = document.createElement("optgroup");
      group.label = "User Defined";
      for (var i = 0; i < defs.length; i++) {
        var opt = document.createElement("option");
        opt.value = "Custom_" + defs[i].name;
        opt.textContent = defs[i].text || defs[i].name;
        group.appendChild(opt);
      }
      list.appendChild(group);
    }
  },
};

//**************************************************************************
//  CustomBlockEditor — UI for creating/editing custom block definitions
//**************************************************************************
var CustomBlockEditor = {
  _editingOldName: null, // null = creating new, string = editing existing
  _sheet: null,

  // Open the editor. defName = null for new block, string to edit existing.
  open: function (defName, sheet) {
    this._sheet = sheet || null;
    this._editingOldName = defName || null;

    var existing = defName ? CustomBlockRegistry.get(defName) : null;

    // Build the modal content
    var overlay = document.getElementById("customBlockOverlay");
    var box = document.getElementById("customBlockBox");

    box.innerHTML = this._buildHTML(existing);
    this._bindEvents();

    // Populate pin/state lists from existing definition
    if (existing) {
      document.getElementById("cbName").value = existing.name;
      document.getElementById("cbText").value = existing.text || "";
      document.getElementById("cbWidth").value = existing.width || 60;
      document.getElementById("cbHeight").value = existing.height || 80;
      document.getElementById("cbCode").value = existing.code || "";

      for (var i = 0; i < (existing.inputs || []).length; i++) {
        this._addPinRow("cbInputsList", existing.inputs[i]);
      }
      for (var i = 0; i < (existing.outputs || []).length; i++) {
        this._addPinRow("cbOutputsList", existing.outputs[i]);
      }
      for (var i = 0; i < (existing.state || []).length; i++) {
        this._addStateRow("cbStateList", existing.state[i]);
      }
    } else {
      // Default: 2 bool inputs, 1 bool output
      this._addPinRow("cbInputsList", {
        symbol: "IN1",
        name: "IN1",
        comment: "",
        type: "bool",
        percent: 25,
      });
      this._addPinRow("cbInputsList", {
        symbol: "IN2",
        name: "IN2",
        comment: "",
        type: "bool",
        percent: 75,
      });
      this._addPinRow("cbOutputsList", {
        symbol: "OUT",
        name: "OUT",
        comment: "",
        type: "bool",
        percent: 50,
      });
    }

    overlay.classList.add("visible");
    document.getElementById("cbName").focus();
  },

  close: function () {
    document.getElementById("customBlockOverlay").classList.remove("visible");
  },

  // Build the full HTML for the editor modal
  _buildHTML: function (existing) {
    var isEdit = !!existing;
    var title = isEdit ? "Edit Custom Block" : "Create Custom Block";

    return (
      "<h3>" +
      title +
      "</h3>" +
      '<div class="cb-section">' +
      '<div class="cb-row">' +
      "<label>Name (ID):</label>" +
      '<input type="text" id="cbName" placeholder="MyBlock" style="flex:1">' +
      "</div>" +
      '<div class="cb-row">' +
      "<label>Label:</label>" +
      '<input type="text" id="cbText" placeholder="MY_BLK" style="flex:1">' +
      "</div>" +
      '<div class="cb-row">' +
      "<label>Width:</label>" +
      '<input type="number" id="cbWidth" value="60" min="30" max="500" step="10">' +
      '<span class="cb-size-unit">px</span>' +
      '<label class="cb-size-label">Height:</label>' +
      '<input type="number" id="cbHeight" value="80" min="30" max="800" step="10">' +
      '<span class="cb-size-unit">px</span>' +
      "</div>" +
      "</div>" +
      '<div class="cb-section">' +
      '<div class="cb-section-title">Inputs <button class="cb-mini-btn" id="cbAddInput">+ Add</button></div>' +
      '<div id="cbInputsList" class="cb-pin-list"></div>' +
      "</div>" +
      '<div class="cb-section">' +
      '<div class="cb-section-title">Outputs <button class="cb-mini-btn" id="cbAddOutput">+ Add</button></div>' +
      '<div id="cbOutputsList" class="cb-pin-list"></div>' +
      '<div style="margin-top:4px"><button class="cb-mini-btn" id="cbAutoPosition">Auto Position</button></div>' +
      "</div>" +
      '<div class="cb-section">' +
      '<div class="cb-section-title">State Variables <button class="cb-mini-btn" id="cbAddState">+ Add</button></div>' +
      '<div id="cbStateList" class="cb-pin-list"></div>' +
      "</div>" +
      '<div class="cb-section">' +
      '<div class="cb-section-title">Logic (JavaScript)</div>' +
      '<textarea id="cbCode" rows="8" spellcheck="false" placeholder="// Use input names as variables, assign to output names&#10;// State variables persist between cycles&#10;// Example: OUT = IN1 &amp;&amp; IN2;"></textarea>' +
      "</div>" +
      '<div class="cb-hint" id="cbHint"></div>' +
      '<div class="cb-buttons">' +
      (isEdit
        ? '<button id="cbDelete" style="float:left;color:#c00">Delete Block</button>'
        : "") +
      '<button id="cbCancel">Cancel</button>' +
      '<button id="cbTest">Test</button>' +
      '<button id="cbSave" class="primary">Save</button>' +
      "</div>"
    );
  },

  _bindEvents: function () {
    var self = this;

    document.getElementById("cbAddInput").onclick = function () {
      self._addPinRow("cbInputsList", {
        symbol: "IN",
        name: "IN",
        comment: "",
        type: "bool",
        percent: 50,
      });
    };
    document.getElementById("cbAddOutput").onclick = function () {
      self._addPinRow("cbOutputsList", {
        symbol: "OUT",
        name: "OUT",
        comment: "",
        type: "bool",
        percent: 50,
      });
    };
    document.getElementById("cbAddState").onclick = function () {
      self._addStateRow("cbStateList", { name: "var1", initial: 0 });
    };

    document.getElementById("cbAutoPosition").onclick = function () {
      self._redistributePins("cbInputsList");
      self._redistributePins("cbOutputsList");
    };

    document.getElementById("cbCancel").onclick = function () {
      self.close();
    };
    document.getElementById("cbTest").onclick = function () {
      self._test();
    };
    document.getElementById("cbSave").onclick = function () {
      self._save();
    };

    var deleteBtn = document.getElementById("cbDelete");
    if (deleteBtn) {
      deleteBtn.onclick = function () {
        self._deleteBlock();
      };
    }
  },

  // Auto-distribute pin positions evenly within a list
  _redistributePins: function (listId) {
    var rows = document.getElementById(listId).querySelectorAll(".cb-pin-row");
    var count = rows.length;
    if (count === 0) return;
    for (var i = 0; i < count; i++) {
      var pct = Math.round(((i + 1) / (count + 1)) * 100);
      var pctInput = rows[i].querySelector(".cb-pin-pct");
      if (pctInput) pctInput.value = pct;
    }
  },

  // Add a pin row to an input/output list
  _addPinRow: function (listId, pin) {
    var self = this;
    var list = document.getElementById(listId);
    var row = document.createElement("div");
    row.className = "cb-pin-row";
    row.innerHTML =
      '<input type="text" class="cb-pin-symbol" value="' +
      (pin.symbol || "") +
      '" placeholder="Sym" title="Displayed on block">' +
      '<input type="text" class="cb-pin-name" value="' +
      (pin.name || "") +
      '" placeholder="Name" title="Used in JS code">' +
      '<input type="text" class="cb-pin-comment" value="' +
      (pin.comment || "") +
      '" placeholder="Comment" title="Tooltip on hover">' +
      '<select class="cb-pin-type" title="Data type">' +
      '<option value="bool"' +
      (pin.type === "bool" ? " selected" : "") +
      ">Bool</option>" +
      '<option value="int"' +
      (pin.type === "int" ? " selected" : "") +
      ">Int</option>" +
      '<option value="real"' +
      (pin.type === "real" ? " selected" : "") +
      ">Real</option>" +
      "</select>" +
      '<input type="number" class="cb-pin-pct" value="' +
      (pin.percent || 50) +
      '" min="5" max="95" title="Position %">' +
      '<span class="cb-pct-label">%</span>' +
      '<button class="cb-remove-btn" title="Remove">&times;</button>';

    row.querySelector(".cb-remove-btn").onclick = function () {
      list.removeChild(row);
    };

    list.appendChild(row);
  },

  // Add a state variable row
  _addStateRow: function (listId, stateVar) {
    var list = document.getElementById(listId);
    var row = document.createElement("div");
    row.className = "cb-pin-row";
    row.innerHTML =
      '<input type="text" class="cb-state-name" value="' +
      (stateVar.name || "") +
      '" placeholder="Name">' +
      '<label class="cb-state-init-label">Init:</label>' +
      '<input type="number" class="cb-state-init" value="' +
      (stateVar.initial || 0) +
      '" step="any">' +
      '<button class="cb-remove-btn" title="Remove">&times;</button>';

    row.querySelector(".cb-remove-btn").onclick = function () {
      list.removeChild(row);
    };

    list.appendChild(row);
  },

  // Collect pin data from a list
  _collectPins: function (listId) {
    var rows = document.getElementById(listId).querySelectorAll(".cb-pin-row");
    var pins = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var symEl = r.querySelector(".cb-pin-symbol");
      var nameEl = r.querySelector(".cb-pin-name");
      var commentEl = r.querySelector(".cb-pin-comment");
      var typeEl = r.querySelector(".cb-pin-type");
      var pctEl = r.querySelector(".cb-pin-pct");
      pins.push({
        symbol: symEl ? symEl.value.trim() : "",
        name: nameEl ? nameEl.value.trim() : "",
        comment: commentEl ? commentEl.value.trim() : "",
        type: typeEl ? typeEl.value : "bool",
        percent: pctEl ? Number(pctEl.value) : 50,
      });
    }
    return pins;
  },

  // Build a definition object from the current form state
  _buildDefinition: function () {
    var name = document.getElementById("cbName").value.trim();
    var text = document.getElementById("cbText").value.trim();
    var width = parseInt(document.getElementById("cbWidth").value) || 60;
    var height = parseInt(document.getElementById("cbHeight").value) || 80;
    var code = document.getElementById("cbCode").value;

    var inputs = this._collectPins("cbInputsList");
    var outputs = this._collectPins("cbOutputsList");

    var stateRows = document
      .getElementById("cbStateList")
      .querySelectorAll(".cb-pin-row");
    var state = [];
    for (var i = 0; i < stateRows.length; i++) {
      state.push({
        name: stateRows[i].querySelector(".cb-state-name").value.trim(),
        initial:
          Number(stateRows[i].querySelector(".cb-state-init").value) || 0,
      });
    }

    return {
      name: name,
      text: text || name,
      width: width,
      height: height,
      inputs: inputs,
      outputs: outputs,
      state: state,
      code: code,
    };
  },

  // Validate a definition, return error string or null
  _validate: function (def) {
    if (!def.name) return "Name is required.";
    if (!def.width || def.width < 30 || def.width > 500)
      return "Width must be between 30 and 500 px.";
    if (!def.height || def.height < 30 || def.height > 800)
      return "Height must be between 30 and 800 px.";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.name))
      return "Name must start with a letter/underscore and contain only letters, digits, underscores.";

    // Check for collision with built-in block types
    var builtins = [
      "And",
      "Or",
      "Xor",
      "Not",
      "SetReset",
      "ResetSet",
      "RTrig",
      "FTrig",
      "Ton",
      "Tof",
      "Tonr",
      "Di",
      "Do",
      "Ai",
      "Aq",
      "Constant",
      "Variable",
      "Add",
      "Subtract",
      "Multiply",
      "Divide",
      "NormX",
      "ScaleX",
      "Limit",
      "Move",
      "IntToReal",
      "RealToInt",
      "Mux",
      "Demux",
      "InRange",
      "OutOfRange",
      "Cmp",
      "PackSixteen",
      "UnpackSixteen",
      "Select",
      "FirstOrderLag",
      "Gt",
      "Lt",
      "Comment",
      "DrawLine",
      "Snap",
      "Junction",
      "JumpOut",
      "JumpIn",
      "LabelInPanel",
      "LabelOutPanel",
      "TagLabelOut",
      "TagLabelIn",
      "OneSecondTimer",
    ];
    for (var i = 0; i < builtins.length; i++) {
      if (def.name === builtins[i])
        return "Name '" + def.name + "' conflicts with a built-in block type.";
    }

    // If editing and name changed, check for collision with other custom blocks
    if (
      this._editingOldName &&
      this._editingOldName !== def.name &&
      CustomBlockRegistry.has(def.name)
    ) {
      return "A custom block named '" + def.name + "' already exists.";
    }
    if (!this._editingOldName && CustomBlockRegistry.has(def.name)) {
      return "A custom block named '" + def.name + "' already exists.";
    }

    // Validate pins
    var allNames = {};
    for (var i = 0; i < def.inputs.length; i++) {
      if (!def.inputs[i].name) return "Input " + (i + 1) + " has no name.";
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.inputs[i].name))
        return (
          "Input name '" +
          def.inputs[i].name +
          "' is invalid (use letters, digits, underscores)."
        );
      if (allNames[def.inputs[i].name])
        return "Duplicate pin name: '" + def.inputs[i].name + "'.";
      allNames[def.inputs[i].name] = true;
    }
    for (var i = 0; i < def.outputs.length; i++) {
      if (!def.outputs[i].name) return "Output " + (i + 1) + " has no name.";
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.outputs[i].name))
        return "Output name '" + def.outputs[i].name + "' is invalid.";
      if (allNames[def.outputs[i].name])
        return "Duplicate pin name: '" + def.outputs[i].name + "'.";
      allNames[def.outputs[i].name] = true;
    }
    for (var i = 0; i < def.state.length; i++) {
      if (!def.state[i].name)
        return "State variable " + (i + 1) + " has no name.";
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.state[i].name))
        return "State name '" + def.state[i].name + "' is invalid.";
      if (allNames[def.state[i].name])
        return "Duplicate name: '" + def.state[i].name + "'.";
      allNames[def.state[i].name] = true;
    }

    if (def.inputs.length === 0 && def.outputs.length === 0)
      return "Block needs at least one input or output.";

    // Check forbidden keywords in code
    if (CustomBlock._FORBIDDEN.test(def.code)) {
      return "Code contains forbidden keywords (window, document, eval, fetch, etc.).";
    }

    // Try to compile
    var result = CustomBlock._compileCode(def);
    if (result.error) return "Code error: " + result.error;

    return null;
  },

  // Test the block definition with sample inputs
  _test: function () {
    var def = this._buildDefinition();
    var hint = document.getElementById("cbHint");

    var error = this._validate(def);
    if (error) {
      hint.innerHTML = '<span style="color:#c00">' + error + "</span>";
      return;
    }

    // Build sample inputs (all zeros)
    var sampleInputs = [];
    for (var i = 0; i < def.inputs.length; i++) {
      sampleInputs.push(0);
    }

    // Build fresh state
    var sampleState = {};
    for (var i = 0; i < def.state.length; i++) {
      sampleState[def.state[i].name] = def.state[i].initial || 0;
    }

    var result = CustomBlock._compileCode(def);
    try {
      // Run 3 cycles to show state persistence
      var outputs;
      var cycleResults = [];
      for (var cycle = 0; cycle < 3; cycle++) {
        outputs = result.fn(sampleInputs, sampleState);
        cycleResults.push(
          "Cycle " + (cycle + 1) + ": outputs=[" + outputs.join(", ") + "]",
        );
      }
      var stateStr =
        Object.keys(sampleState).length > 0
          ? " | state={" +
            Object.keys(sampleState)
              .map(function (k) {
                return k + "=" + sampleState[k];
              })
              .join(", ") +
            "}"
          : "";

      hint.innerHTML =
        '<span style="color:#2a2">' +
        cycleResults.join("<br>") +
        stateStr +
        "</span>";
    } catch (e) {
      hint.innerHTML =
        '<span style="color:#c00">Runtime error: ' + e.message + "</span>";
    }
  },

  // Save the block definition
  _save: function () {
    var def = this._buildDefinition();
    var hint = document.getElementById("cbHint");

    var error = this._validate(def);
    if (error) {
      hint.innerHTML = '<span style="color:#c00">' + error + "</span>";
      return;
    }

    // Save to registry
    if (this._editingOldName) {
      CustomBlockRegistry.update(this._editingOldName, def);
    } else {
      CustomBlockRegistry.add(def);
    }

    // Update all existing instances on the sheet
    if (this._sheet) {
      var oldObjName = "Custom_" + (this._editingOldName || def.name);
      var newObjName = "Custom_" + def.name;
      for (var i = 0; i < this._sheet.blockObjects.length; i++) {
        var block = this._sheet.blockObjects[i];
        if (block instanceof CustomBlock) {
          // Check if this block uses the old or new definition name
          if (
            block.definition &&
            (block.definition.name === def.name ||
              block.definition.name === this._editingOldName)
          ) {
            block.definition = def;
            block.recompile();
          }
        }
      }

      // If name changed, update the type in serialized data would be handled by objectName
      // The objectName is used during serialization
    }

    this.close();
  },

  // Delete the block definition
  _deleteBlock: function () {
    if (!this._editingOldName) return;
    var name = this._editingOldName;

    // Check if any instances exist on the sheet
    var instanceCount = 0;
    if (this._sheet) {
      for (var i = 0; i < this._sheet.blockObjects.length; i++) {
        var block = this._sheet.blockObjects[i];
        if (
          block instanceof CustomBlock &&
          block.definition &&
          block.definition.name === name
        ) {
          instanceCount++;
        }
      }
    }

    var msg = "Delete custom block '" + name + "'?";
    if (instanceCount > 0) {
      msg +=
        "\n\nWarning: " +
        instanceCount +
        " instance(s) on the sheet will stop working.";
    }
    if (!confirm(msg)) return;

    CustomBlockRegistry.remove(name);
    this.close();
  },
};

//**************************************************************************
//  CustomBlockManager — UI for listing, exporting, importing custom blocks
//**************************************************************************
var CustomBlockManager = {
  open: function () {
    var overlay = document.getElementById("customBlockOverlay");
    var box = document.getElementById("customBlockBox");

    box.innerHTML = this._buildHTML();
    this._bindEvents();
    this._refreshList();

    overlay.classList.add("visible");
  },

  close: function () {
    document.getElementById("customBlockOverlay").classList.remove("visible");
  },

  _buildHTML: function () {
    return (
      "<h3>Manage Custom Blocks</h3>" +
      '<div id="cbManagerList" class="cb-manager-list"></div>' +
      '<div class="cb-manager-empty" id="cbManagerEmpty" style="display:none">' +
      'No custom blocks created yet.<br>Click "+ New Block" in the toolbar to create one.' +
      "</div>" +
      '<div class="cb-buttons">' +
      '<button id="cbMgrImport">Import JSON</button>' +
      '<button id="cbMgrExport">Export All</button>' +
      '<button id="cbMgrClose" class="primary">Close</button>' +
      "</div>" +
      '<input type="file" id="cbMgrFileInput" accept=".json" style="display:none">'
    );
  },

  _bindEvents: function () {
    var self = this;
    document.getElementById("cbMgrClose").onclick = function () {
      self.close();
    };
    document.getElementById("cbMgrExport").onclick = function () {
      self._export();
    };
    document.getElementById("cbMgrImport").onclick = function () {
      document.getElementById("cbMgrFileInput").click();
    };
    document.getElementById("cbMgrFileInput").onchange = function () {
      self._importFile(this);
    };
  },

  _refreshList: function () {
    var list = document.getElementById("cbManagerList");
    var empty = document.getElementById("cbManagerEmpty");
    list.innerHTML = "";

    var defs = CustomBlockRegistry.getAll();
    if (defs.length === 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      var row = document.createElement("div");
      row.className = "cb-manager-row";

      var info =
        '<span class="cb-mgr-name">' +
        (def.text || def.name) +
        "</span>" +
        '<span class="cb-mgr-detail">' +
        def.inputs.length +
        " in / " +
        def.outputs.length +
        " out" +
        (def.state.length > 0 ? " / " + def.state.length + " state" : "") +
        "</span>";

      var actions =
        '<button class="cb-mini-btn cb-mgr-edit" data-name="' +
        def.name +
        '">Edit</button>' +
        '<button class="cb-mini-btn cb-mgr-export1" data-name="' +
        def.name +
        '">Export</button>' +
        '<button class="cb-mini-btn cb-mgr-delete" data-name="' +
        def.name +
        '" style="color:#c00">Delete</button>';

      row.innerHTML =
        info + '<span class="cb-mgr-actions">' + actions + "</span>";
      list.appendChild(row);
    }

    // Bind action buttons
    var editBtns = list.querySelectorAll(".cb-mgr-edit");
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].onclick = function () {
        CustomBlockManager.close();
        CustomBlockEditor.open(this.getAttribute("data-name"), window.my_Sheet);
      };
    }
    var exportBtns = list.querySelectorAll(".cb-mgr-export1");
    for (var i = 0; i < exportBtns.length; i++) {
      exportBtns[i].onclick = function () {
        CustomBlockManager._exportOne(this.getAttribute("data-name"));
      };
    }
    var deleteBtns = list.querySelectorAll(".cb-mgr-delete");
    for (var i = 0; i < deleteBtns.length; i++) {
      deleteBtns[i].onclick = function () {
        var name = this.getAttribute("data-name");
        if (confirm("Delete custom block '" + name + "'?")) {
          CustomBlockRegistry.remove(name);
          CustomBlockManager._refreshList();
        }
      };
    }
  },

  _export: function () {
    var json = CustomBlockRegistry.exportAll();
    this._downloadJSON(json, "jsblocks_custom_blocks.json");
  },

  _exportOne: function (name) {
    var def = CustomBlockRegistry.get(name);
    if (!def) return;
    var json = JSON.stringify([def], null, 2);
    this._downloadJSON(json, "jsblocks_" + name + ".json");
  },

  _downloadJSON: function (json, filename) {
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  _importFile: function (fileInput) {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    var self = this;
    reader.onload = function (e) {
      if (CustomBlockRegistry.importFromJSON(e.target.result)) {
        self._refreshList();
      }
    };
    reader.readAsText(file);
    fileInput.value = "";
  },
};
