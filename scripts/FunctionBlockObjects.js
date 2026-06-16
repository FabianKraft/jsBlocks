///////////////////////////////////////////////////////////
//
//		Block Object Definitions
//		Copyright 2007 Shawn Summey
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
//
//////////////////////////////////////////////////////////

//**************************************************************************
//
//			Define an AND BLOCK
//
//**************************************************************************
function AndBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "And";
  this.text = "&";
  this.YOffset = 25;
  this.stack = 1;
  this.numberInputs = 2;
  this.inputFactor = 50;
  this._needsInitialSettings = true;
}
AndBlock.prototype = new Base(); //Derive from Base class

AndBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

AndBlock.prototype._applyInputCount = function (val) {
  this.numberInputs = val;
  this.divHeight = 80;
  if (this.numberInputs > 4) {
    this.divHeight = 80 + (this.numberInputs - 4) * 20;
  }
  this.divObj.style.height = this.divHeight;
  if (this.numberInputs == 2) this.YOffset = 25;
  else if (this.numberInputs == 3) this.YOffset = 15;
  else if (this.numberInputs == 4) this.YOffset = 10;
  else this.YOffset = (this.numberInputs + 45) / this.numberInputs;
  this.inputFactor = 100 / this.numberInputs;
};

AndBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>AND Settings</h3>" +
    '<div class="modal-row"><label>Eing\u00e4nge (2-8):</label>' +
    '<input type="text" id="modalInputs" value="' +
    self.numberInputs +
    '"></div>';

  Base.showModal(html, function () {
    var val = parseInt(document.getElementById("modalInputs").value);
    if (val >= 2 && val <= 8) {
      // Remove old connectors
      for (var i = 0; i < self.inConnections.length; i++) {
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      }
      for (var i = 0; i < self.outConnections.length; i++) {
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      }
      self.inConnections = [];
      self.outConnections = [];
      self._applyInputCount(val);
      self.addConnections();
    }
  });
};

AndBlock.prototype.addConnections = function () {
  //Override connections function
  for (
    connectorIndex = 0;
    connectorIndex < this.numberInputs;
    connectorIndex++
  ) {
    this.inConnections[connectorIndex] = new Connector(
      this,
      1,
      connectorIndex * this.inputFactor + this.YOffset,
      "bool",
      "Bool - IN" + (connectorIndex + 1),
    );
  }
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - AND result",
  );
};

AndBlock.prototype.Execute = function () {
  this.stack = 1;
  for (var i = 0; i < this.numberInputs; i++) {
    this.stack = this.stack && this.inConnections[i].getInputValue();
  }
  if (this.stack) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define an OR BLOCK
//
//**************************************************************************
function OrBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Or";
  this.text = "\u22651";
  this.YOffset = 25;
  this.stack = 0;
  this.numberInputs = 2;
  this.inputFactor = 50;
  this._needsInitialSettings = true;
}

OrBlock.prototype = new Base(); //Derive from Base class

OrBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

OrBlock.prototype._applyInputCount = function (val) {
  this.numberInputs = val;
  this.divHeight = 80;
  if (this.numberInputs > 4) {
    this.divHeight = 80 + (this.numberInputs - 4) * 20;
  }
  this.divObj.style.height = this.divHeight;
  if (this.numberInputs == 2) this.YOffset = 25;
  else if (this.numberInputs == 3) this.YOffset = 15;
  else if (this.numberInputs == 4) this.YOffset = 10;
  else this.YOffset = (this.numberInputs + 45) / this.numberInputs;
  this.inputFactor = 100 / this.numberInputs;
};

OrBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>OR Settings</h3>" +
    '<div class="modal-row"><label>Eing\u00e4nge (2-8):</label>' +
    '<input type="text" id="modalInputs" value="' +
    self.numberInputs +
    '"></div>';

  Base.showModal(html, function () {
    var val = parseInt(document.getElementById("modalInputs").value);
    if (val >= 2 && val <= 8) {
      for (var i = 0; i < self.inConnections.length; i++) {
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      }
      for (var i = 0; i < self.outConnections.length; i++) {
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      }
      self.inConnections = [];
      self.outConnections = [];
      self._applyInputCount(val);
      self.addConnections();
    }
  });
};

OrBlock.prototype.addConnections = function () {
  for (
    connectorIndex = 0;
    connectorIndex < this.numberInputs;
    connectorIndex++
  ) {
    this.inConnections[connectorIndex] = new Connector(
      this,
      1,
      connectorIndex * this.inputFactor + this.YOffset,
      "bool",
      "Bool - IN" + (connectorIndex + 1),
    );
  }

  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - OR result",
  );
};
OrBlock.prototype.Execute = function () {
  this.stack = 0;
  for (var i = 0; i < this.numberInputs; i++) {
    this.stack = this.stack || this.inConnections[i].getInputValue();
  }
  if (this.stack) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define a DI BLOCK
//
//**************************************************************************
function DiBlock() {
  this.objectName = "Di";
  this.text = "DI";
  this.divHeight = 26;
  this.divWidth = 178;
  this.tagName = "tagname";
  this.comment = "";
  this.keySet = "";
  this.keyReset = "";
  this.keyNormal = "";
  this._normalKeyHeld = false;
  this._needsInitialSettings = true;
}

DiBlock.prototype = new Base();

DiBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  // Remove default header
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Build two-panel layout: small left (45px) + large right (133px)
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;left:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-right:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "DI";
  this.divObj.appendChild(this._typeBox);
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:46px;top:0;right:0;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

DiBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

DiBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>DI Settings</h3>" +
    '<div class="modal-row"><label>Tagname:</label>' +
    '<input type="text" id="modalTagName" value="' +
    self.tagName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-section-title">Keybindings (optional)</div>' +
    '<div class="modal-row"><label>Set (on):</label>' +
    '<input type="text" id="modalKeySet" class="key-input" maxlength="1" value="' +
    self.keySet +
    '" placeholder="-"></div>' +
    '<div class="modal-row"><label>Reset (off):</label>' +
    '<input type="text" id="modalKeyReset" class="key-input" maxlength="1" value="' +
    self.keyReset +
    '" placeholder="-"></div>' +
    '<div class="modal-row"><label>Normal (hold):</label>' +
    '<input type="text" id="modalKeyNormal" class="key-input" maxlength="1" value="' +
    self.keyNormal +
    '" placeholder="-"></div>';
  Base.showModal(html, function () {
    self.tagName = document.getElementById("modalTagName").value || "tagname";
    self.comment = document.getElementById("modalComment").value || "";
    self.keySet = document.getElementById("modalKeySet").value.toLowerCase();
    self.keyReset = document
      .getElementById("modalKeyReset")
      .value.toLowerCase();
    self.keyNormal = document
      .getElementById("modalKeyNormal")
      .value.toLowerCase();
    self._updateInfoBox();
  });
};

DiBlock.prototype.addConnections = function () {
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - Digital Input",
  );
};
DiBlock.prototype.clickHandler = function (e) {
  if (!this.hasMoved) {
    if (this.outConnections[0].isConnected && this.sheetObject.simulateOn) {
      if (this.outConnections[0].value == 0) this.outConnections[0].value = 1;
      else this.outConnections[0].value = 0;
    }
  } else {
    this.hasMoved = 0;
  }
};
DiBlock.prototype.handleKeyDown = function (key) {
  if (this.keySet && key === this.keySet) this.outConnections[0].value = 1;
  if (this.keyReset && key === this.keyReset) this.outConnections[0].value = 0;
  if (this.keyNormal && key === this.keyNormal) {
    this.outConnections[0].value = 1;
    this._normalKeyHeld = true;
  }
};
DiBlock.prototype.handleKeyUp = function (key) {
  if (this.keyNormal && key === this.keyNormal) {
    this.outConnections[0].value = 0;
    this._normalKeyHeld = false;
  }
};
DiBlock.prototype.Execute = function () {
  if (this.outConnections[0].value) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define a DO BLOCK
//
//**************************************************************************
function DoBlock() {
  this.objectName = "Do";
  this.text = "DO";
  this.divHeight = 26;
  this.divWidth = 178;
  this.tagName = "tagname";
  this.comment = "";
  this._needsInitialSettings = true;
}

DoBlock.prototype = new Base();

DoBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Layout: large left (133px) + small right (45px)
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:0;top:0;width:132px;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;text-align:left;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;right:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-left:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "DO";
  this.divObj.appendChild(this._typeBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

DoBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

DoBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>DO Settings</h3>" +
    '<div class="modal-row"><label>Tagname:</label>' +
    '<input type="text" id="modalTagName" value="' +
    self.tagName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>';
  Base.showModal(html, function () {
    self.tagName = document.getElementById("modalTagName").value || "tagname";
    self.comment = document.getElementById("modalComment").value || "";
    self._updateInfoBox();
  });
};

DoBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    "bool",
    "Bool - Digital Output",
  );
};
DoBlock.prototype.Execute = function () {
  if (this.inConnections[0].getInputValue())
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a 1 SEC TIMER BLOCK
//
//**************************************************************************
function OneSecondTimerBlock() {
  this.objectName = "OneSecondTimer";
  this.text = "1 SEC TIMER";
  //this.d=new Date();
  this.isTiming = 0;
  this.doneTiming = 0;
  this.startTime = 0;
  this.currentTime = 0;
  this.timerTime = 0;
}

OneSecondTimerBlock.prototype = new Base();

OneSecondTimerBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    20,
    "bool",
    "Bool - Timer Start",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    50,
    "bool",
    "Bool - Enable/Reset",
  );
  this.inConnections[2] = new Connector(
    this,
    1,
    80,
    "int",
    "Int - Preset (seconds)",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    20,
    "bool",
    "Bool - Timer Done",
  );
  this.outConnections[1] = new Connector(
    this,
    0,
    80,
    "int",
    "Int - Elapsed (seconds)",
  );
};

OneSecondTimerBlock.prototype.Execute = function () {
  if (this.inConnections[1].getInputValue()) //timer EN/RST is ON
  {
    if (this.inConnections[0].getInputValue() && !this.isTiming) //start timer
    {
      this.d = new Date();
      this.startTime = this.d.getTime();
      this.isTiming = 1;
      delete this.d;
    }
    if (this.isTiming && !this.doneTiming) {
      this.d = new Date();
      this.currentTime = this.d.getTime();
      this.timerTime = parseInt((this.currentTime - this.startTime) / 1000);
      this.outConnections[1].value = this.timerTime;
      delete this.d;
    }
    if (this.timerTime >= this.inConnections[2].connectedFrom.value) {
      this.outConnections[0].value = 1;
      this.doneTiming = 1;
    }
    if (
      this.inConnections[0].getInputValue() &&
      this.outConnections[0].value == 0
    ) {
      this.doneTiming = 0;
    } else {
      this.doneTiming = 1;
    }
  } else {
    this.timerTime = 0;
    this.outConnections[1].value = this.timerTime;
    this.outConnections[0].value = 0;
    this.isTiming = 0;
    this.doneTiming = 0;
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a TON BLOCK (IEC 61131-3 Timer On-Delay)
//
//**************************************************************************
function TonBlock() {
  this.objectName = "Ton";
  this.text = "TON";
  this.divHeight = 80;
  this.startTime = 0;
  this.isTiming = false;
}

TonBlock.prototype = new Base();

TonBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>PT</span><span>ET</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

TonBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    38,
    "bool",
    "Bool - IN (Start)",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    75,
    "int",
    "Int - PT (Preset ms, 1000=1s)",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    "bool",
    "Bool - Q (Output)",
  );
  this.outConnections[1] = new Connector(
    this,
    0,
    75,
    "int",
    "Int - ET (Elapsed ms)",
  );
};

TonBlock.prototype.Execute = function () {
  var IN = this.inConnections[0].connectedFrom
    ? this.inConnections[0].getInputValue()
    : 0;
  var PT = this.inConnections[1].connectedFrom
    ? parseInt(this.inConnections[1].connectedFrom.value)
    : 0;

  if (IN) {
    if (!this.isTiming) {
      this.startTime = new Date().getTime();
      this.isTiming = true;
    }
    var elapsed = new Date().getTime() - this.startTime;
    if (elapsed >= PT) {
      this.outConnections[1].value = PT;
      this.outConnections[0].value = 1;
    } else {
      this.outConnections[1].value = Math.floor(elapsed);
      this.outConnections[0].value = 0;
    }
  } else {
    this.isTiming = false;
    this.startTime = 0;
    this.outConnections[0].value = 0;
    this.outConnections[1].value = 0;
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a TOF BLOCK (IEC 61131-3 Timer Off-Delay)
//
//**************************************************************************
function TofBlock() {
  this.objectName = "Tof";
  this.text = "TOF";
  this.divHeight = 80;
  this.startTime = 0;
  this.isTiming = false;
  this.wasOn = false;
}

TofBlock.prototype = new Base();

TofBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>PT</span><span>ET</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

TofBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 38, "bool", "Bool - IN");
  this.inConnections[1] = new Connector(
    this,
    1,
    75,
    "int",
    "Int - PT (Preset ms, 1000=1s)",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    "bool",
    "Bool - Q (Output)",
  );
  this.outConnections[1] = new Connector(
    this,
    0,
    75,
    "int",
    "Int - ET (Elapsed ms)",
  );
};

TofBlock.prototype.Execute = function () {
  var IN = this.inConnections[0].connectedFrom
    ? this.inConnections[0].getInputValue()
    : 0;
  var PT = this.inConnections[1].connectedFrom
    ? parseInt(this.inConnections[1].connectedFrom.value)
    : 0;

  if (IN) {
    this.outConnections[0].value = 1;
    this.outConnections[1].value = 0;
    this.isTiming = false;
    this.wasOn = true;
  } else if (this.wasOn) {
    if (!this.isTiming) {
      this.startTime = new Date().getTime();
      this.isTiming = true;
    }
    var elapsed = new Date().getTime() - this.startTime;
    if (elapsed >= PT) {
      this.outConnections[1].value = PT;
      this.outConnections[0].value = 0;
      this.wasOn = false;
      this.isTiming = false;
    } else {
      this.outConnections[1].value = Math.floor(elapsed);
      this.outConnections[0].value = 1;
    }
  } else {
    this.outConnections[0].value = 0;
    this.outConnections[1].value = 0;
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a TONR BLOCK (IEC 61131-3 Timer On-Delay Retentive)
//
//**************************************************************************
function TonrBlock() {
  this.objectName = "Tonr";
  this.text = "TONR";
  this.divHeight = 100;
  this.accumulatedTime = 0;
  this.lastTime = 0;
  this.isTiming = false;
}

TonrBlock.prototype = new Base();

TonrBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>IN</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>R</span><span>ET</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>PT</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

TonrBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    30,
    "bool",
    "Bool - IN (Start)",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    55,
    "bool",
    "Bool - R (Reset)",
  );
  this.inConnections[2] = new Connector(
    this,
    1,
    80,
    "int",
    "Int - PT (Preset ms, 1000=1s)",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    30,
    "bool",
    "Bool - Q (Output)",
  );
  this.outConnections[1] = new Connector(
    this,
    0,
    55,
    "int",
    "Int - ET (Elapsed ms)",
  );
};

TonrBlock.prototype.Execute = function () {
  var IN = this.inConnections[0].connectedFrom
    ? this.inConnections[0].getInputValue()
    : 0;
  var R = this.inConnections[1].connectedFrom
    ? this.inConnections[1].getInputValue()
    : 0;
  var PT = this.inConnections[2].connectedFrom
    ? parseInt(this.inConnections[2].connectedFrom.value)
    : 0;

  if (R) {
    this.accumulatedTime = 0;
    this.isTiming = false;
    this.outConnections[0].value = 0;
    this.outConnections[1].value = 0;
  } else if (IN) {
    if (!this.isTiming) {
      this.lastTime = new Date().getTime();
      this.isTiming = true;
    }
    var now = new Date().getTime();
    this.accumulatedTime += now - this.lastTime;
    this.lastTime = now;
    if (this.accumulatedTime >= PT) {
      this.accumulatedTime = PT;
      this.outConnections[0].value = 1;
    } else {
      this.outConnections[0].value = 0;
    }
    this.outConnections[1].value = Math.floor(this.accumulatedTime);
  } else {
    this.isTiming = false;
    this.outConnections[1].value = Math.floor(this.accumulatedTime);
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a SET/RESET BLOCK
//
//**************************************************************************
function SetResetBlock() {
  this.objectName = "SetReset";
  this.text = "SR";
  this.lastOutput = 0;
}

SetResetBlock.prototype = new Base();

SetResetBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>S1</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>R</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

SetResetBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 38, "bool", "Bool - Set1");
  this.inConnections[1] = new Connector(this, 1, 75, "bool", "Bool - Reset");

  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    "bool",
    "Bool - Output Q",
  );
};
SetResetBlock.prototype.Execute = function () {
  if (this.inConnections[0].getInputValue() || this.lastOutput) {
    this.outConnections[0].value = 1;
    this.lastOutput = 1;
  }

  if (
    this.inConnections[1].getInputValue() &&
    !this.inConnections[0].getInputValue()
  ) {
    this.outConnections[0].value = 0;
    this.lastOutput = 0;
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a XOR BLOCK
//
//**************************************************************************
function XorBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Xor";
  this.text = "x";
  this.YOffset = 25;
  this.stack = 0;
  this.numberInputs = 2;
  this.inputFactor = 50;
  this._needsInitialSettings = true;
}
XorBlock.prototype = new Base();

XorBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

XorBlock.prototype._applyInputCount = function (val) {
  this.numberInputs = val;
  this.divHeight = 80;
  if (this.numberInputs > 4) {
    this.divHeight = 80 + (this.numberInputs - 4) * 20;
  }
  this.divObj.style.height = this.divHeight;
  if (this.numberInputs == 2) this.YOffset = 25;
  else if (this.numberInputs == 3) this.YOffset = 15;
  else if (this.numberInputs == 4) this.YOffset = 10;
  else this.YOffset = (this.numberInputs + 45) / this.numberInputs;
  this.inputFactor = 100 / this.numberInputs;
};

XorBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>XOR Einstellungen</h3>" +
    '<div class="modal-row"><label>Eing\u00e4nge (2-8):</label>' +
    '<input type="text" id="modalInputs" value="' +
    self.numberInputs +
    '"></div>';

  Base.showModal(html, function () {
    var val = parseInt(document.getElementById("modalInputs").value);
    if (val >= 2 && val <= 8) {
      for (var i = 0; i < self.inConnections.length; i++) {
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      }
      for (var i = 0; i < self.outConnections.length; i++) {
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      }
      self.inConnections = [];
      self.outConnections = [];
      self._applyInputCount(val);
      self.addConnections();
    }
  });
};

XorBlock.prototype.addConnections = function () {
  for (
    connectorIndex = 0;
    connectorIndex < this.numberInputs;
    connectorIndex++
  ) {
    this.inConnections[connectorIndex] = new Connector(
      this,
      1,
      connectorIndex * this.inputFactor + this.YOffset,
      "bool",
      "Bool - IN" + (connectorIndex + 1),
    );
  }
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - XOR Ergebnis",
  );
};

XorBlock.prototype.Execute = function () {
  var trueCount = 0;
  for (var i = 0; i < this.numberInputs; i++) {
    if (this.inConnections[i].getInputValue()) trueCount++;
  }
  // XOR: output is true if odd number of inputs are true
  if (trueCount % 2 === 1) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define a RS BLOCK (Reset-dominant)
//
//**************************************************************************
function ResetSetBlock() {
  this.objectName = "ResetSet";
  this.text = "RS";
  this.lastOutput = 0;
}

ResetSetBlock.prototype = new Base();

ResetSetBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>S</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>R1</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

ResetSetBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 38, "bool", "Bool - Set");
  this.inConnections[1] = new Connector(this, 1, 75, "bool", "Bool - Reset1");

  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    "bool",
    "Bool - Output Q",
  );
};

ResetSetBlock.prototype.Execute = function () {
  // Reset-dominant: if both Set and Reset are true, Reset wins
  if (this.inConnections[1].getInputValue()) {
    this.outConnections[0].value = 0;
    this.lastOutput = 0;
  } else if (this.inConnections[0].getInputValue() || this.lastOutput) {
    this.outConnections[0].value = 1;
    this.lastOutput = 1;
  } else {
    this.outConnections[0].value = 0;
    this.lastOutput = 0;
  }

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a R_TRIG BLOCK (Rising edge detection)
//
//**************************************************************************
function RTrigBlock() {
  this.objectName = "RTrig";
  this.text = "R_TRIG";
  this.lastInput = 0;
}

RTrigBlock.prototype = new Base();

RTrigBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:16px;padding:0 2px;"><span>CLK</span><span>Q</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

RTrigBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 50, "bool", "Bool - CLK");
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - Q (Steigende Flanke)",
  );
};

RTrigBlock.prototype.Execute = function () {
  var currentInput = this.inConnections[0].getInputValue();
  // Rising edge: output true for one scan when input goes from 0 to 1
  if (currentInput && !this.lastInput) {
    this.outConnections[0].value = 1;
  } else {
    this.outConnections[0].value = 0;
  }
  this.lastInput = currentInput;

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a F_TRIG BLOCK (Falling edge detection)
//
//**************************************************************************
function FTrigBlock() {
  this.objectName = "FTrig";
  this.text = "F_TRIG";
  this.lastInput = 0;
}

FTrigBlock.prototype = new Base();

FTrigBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:16px;padding:0 2px;"><span>CLK</span><span>Q</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

FTrigBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 50, "bool", "Bool - CLK");
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - Q (Fallende Flanke)",
  );
};

FTrigBlock.prototype.Execute = function () {
  var currentInput = this.inConnections[0].getInputValue();
  // Falling edge: output true for one scan when input goes from 1 to 0
  if (!currentInput && this.lastInput) {
    this.outConnections[0].value = 1;
  } else {
    this.outConnections[0].value = 0;
  }
  this.lastInput = currentInput;

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a NORM_X BLOCK
//
//**************************************************************************
function NormXBlock() {
  this.objectName = "NormX";
  this.text = "NORM_X";
  this.divHeight = 100;
}

NormXBlock.prototype = new Base();

NormXBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>MIN</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>VALUE</span><span></span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>MAX</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

NormXBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 30, "int", "Int - MIN");
  this.inConnections[1] = new Connector(this, 1, 55, "int", "Int - VALUE");
  this.inConnections[2] = new Connector(this, 1, 80, "int", "Int - MAX");
  this.outConnections[0] = new Connector(
    this,
    0,
    30,
    "real",
    "Real - OUT (normalized)",
  );
};

NormXBlock.prototype.Execute = function () {
  var min = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var value = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var max = this.inConnections[2].connectedFrom
    ? parseFloat(this.inConnections[2].connectedFrom.value)
    : 0;
  if (max - min !== 0)
    this.outConnections[0].value = parseFloat(
      ((value - min) / (max - min)).toFixed(6),
    );
  else this.outConnections[0].value = 0;
};
//**************************************************************************
//
//			Define a SCALE_X BLOCK
//
//**************************************************************************
function ScaleXBlock() {
  this.objectName = "ScaleX";
  this.text = "SCALE_X";
  this.divHeight = 100;
}

ScaleXBlock.prototype = new Base();

ScaleXBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>MIN</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>VALUE</span><span></span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>MAX</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

ScaleXBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 30, "real", "Real - MIN");
  this.inConnections[1] = new Connector(
    this,
    1,
    55,
    "real",
    "Real - VALUE (0..1)",
  );
  this.inConnections[2] = new Connector(this, 1, 80, "real", "Real - MAX");
  this.outConnections[0] = new Connector(this, 0, 30, "real", "Real - OUT");
};

ScaleXBlock.prototype.Execute = function () {
  var min = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var value = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var max = this.inConnections[2].connectedFrom
    ? parseFloat(this.inConnections[2].connectedFrom.value)
    : 0;
  this.outConnections[0].value = parseFloat(
    (min + value * (max - min)).toFixed(6),
  );
};
//**************************************************************************
//
//			Define a LIMIT BLOCK
//
//**************************************************************************
function LimitBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Limit";
  this.text = "LIMIT";
  this.divHeight = 100;
  this.limitDataType = "real";
  this._needsInitialSettings = true;
}

LimitBlock.prototype = new Base();

LimitBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>MIN</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>VALUE</span><span></span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>MAX</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

LimitBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>LIMIT Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalLimitType">' +
    '<option value="real"' +
    (self.limitDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.limitDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var newType = document.getElementById("modalLimitType").value;
    if (newType !== self.limitDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.limitDataType = newType;
      self.addConnections();
    }
  });
};

LimitBlock.prototype.addConnections = function () {
  var dt = this.limitDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 30, dt, tip + " - MIN");
  this.inConnections[1] = new Connector(this, 1, 55, dt, tip + " - VALUE");
  this.inConnections[2] = new Connector(this, 1, 80, dt, tip + " - MAX");
  this.outConnections[0] = new Connector(
    this,
    0,
    30,
    dt,
    tip + " - OUT (clamped)",
  );
};

LimitBlock.prototype.Execute = function () {
  var min = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var value = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var max = this.inConnections[2].connectedFrom
    ? parseFloat(this.inConnections[2].connectedFrom.value)
    : 0;
  var out = value;
  if (out < min) out = min;
  if (out > max) out = max;
  if (this.limitDataType === "int")
    this.outConnections[0].value = Math.round(out);
  else this.outConnections[0].value = parseFloat(out.toFixed(6));
};
//**************************************************************************
//
//			Define a MOVE BLOCK
//
//**************************************************************************
function MoveBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Move";
  this.text = "MOVE";
  this.divHeight = 80;
  this.moveDataType = "real";
  this._needsInitialSettings = true;
}

MoveBlock.prototype = new Base();

MoveBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>EN</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

MoveBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>MOVE Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMoveType">' +
    '<option value="real"' +
    (self.moveDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.moveDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var newType = document.getElementById("modalMoveType").value;
    if (newType !== self.moveDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.moveDataType = newType;
      self.addConnections();
    }
  });
};

MoveBlock.prototype.addConnections = function () {
  var dt = this.moveDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(
    this,
    1,
    38,
    "bool",
    "Bool - EN (Enable)",
  );
  this.inConnections[1] = new Connector(this, 1, 75, dt, tip + " - IN");
  this.outConnections[0] = new Connector(this, 0, 38, dt, tip + " - OUT");
};

MoveBlock.prototype.Execute = function () {
  var en = this.inConnections[0].connectedFrom
    ? this.inConnections[0].getInputValue()
    : 0;
  if (en) {
    var val = this.inConnections[1].connectedFrom
      ? parseFloat(this.inConnections[1].connectedFrom.value)
      : 0;
    if (this.moveDataType === "int")
      this.outConnections[0].value = Math.round(val);
    else this.outConnections[0].value = val;
  }
  if (en) this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define an INT_TO_REAL BLOCK
//
//**************************************************************************
function IntToRealBlock() {
  this.objectName = "IntToReal";
  this.text = "INT_TO_REAL";
  this.divWidth = 80;
}

IntToRealBlock.prototype = new Base();

IntToRealBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:16px;padding:0 2px;"><span>IN</span><span>OUT</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
};

IntToRealBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 50, "int", "Int - IN");
  this.outConnections[0] = new Connector(this, 0, 50, "real", "Real - OUT");
};

IntToRealBlock.prototype.Execute = function () {
  var val = this.inConnections[0].connectedFrom
    ? parseInt(this.inConnections[0].connectedFrom.value)
    : 0;
  this.outConnections[0].value = parseFloat(val);
};
//**************************************************************************
//
//			Define a REAL_TO_INT BLOCK
//
//**************************************************************************
function RealToIntBlock() {
  this.objectName = "RealToInt";
  this.text = "REAL_TO_INT (R)";
  this.divWidth = 100;
  this.roundMode = "round";
  this._needsInitialSettings = true;
}

RealToIntBlock.prototype = new Base();

RealToIntBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:16px;padding:0 2px;"><span>IN</span><span>OUT</span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

RealToIntBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>REAL_TO_INT Settings</h3>" +
    '<div class="modal-row"><label>Mode:</label>' +
    '<select id="modalRoundMode">' +
    '<option value="round"' +
    (self.roundMode === "round" ? " selected" : "") +
    ">Round (R)</option>" +
    '<option value="floor"' +
    (self.roundMode === "floor" ? " selected" : "") +
    ">Floor (F)</option>" +
    '<option value="ceil"' +
    (self.roundMode === "ceil" ? " selected" : "") +
    ">Ceil (C)</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    self.roundMode = document.getElementById("modalRoundMode").value;
    var modeChar =
      self.roundMode === "round" ? "R" : self.roundMode === "floor" ? "F" : "C";
    self.headerDiv.innerHTML = "REAL_TO_INT (" + modeChar + ")";
  });
};

RealToIntBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 50, "real", "Real - IN");
  this.outConnections[0] = new Connector(this, 0, 50, "int", "Int - OUT");
};

RealToIntBlock.prototype.Execute = function () {
  var val = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  if (this.roundMode === "floor")
    this.outConnections[0].value = Math.floor(val);
  else if (this.roundMode === "ceil")
    this.outConnections[0].value = Math.ceil(val);
  else this.outConnections[0].value = Math.round(val);
};
//**************************************************************************
//
//			Define a MUX BLOCK
//
//**************************************************************************
function MuxBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Mux";
  this.text = "MUX";
  this.divHeight = 100;
  this.muxDataType = "real";
  this.numInputs = 2;
  this._needsInitialSettings = true;
}

MuxBlock.prototype = new Base();

MuxBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

MuxBlock.prototype._buildLabels = function () {
  // Remove old labels
  var old = this.divObj.querySelectorAll(".pin-label");
  for (var i = 0; i < old.length; i++) this.divObj.removeChild(old[i]);
  // SEL label at first input position
  var positions = this._getPositions();
  var lbl = document.createElement("div");
  lbl.className = "pin-label";
  lbl.style.cssText =
    "display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;";
  lbl.innerHTML = "<span>SEL</span><span>OUT</span>";
  this.divObj.appendChild(lbl);
  for (var i = 0; i < this.numInputs; i++) {
    var row = document.createElement("div");
    row.className = "pin-label";
    row.style.cssText =
      "display:flex;justify-content:space-between;font-size:9px;margin-top:" +
      (i === 0 ? "4" : "8") +
      "px;padding:0 2px;";
    row.innerHTML = "<span>IN" + (i + 1) + "</span><span></span>";
    this.divObj.appendChild(row);
  }
};

MuxBlock.prototype._getPositions = function () {
  var total = this.numInputs + 1; // SEL + inputs
  var positions = [];
  for (var i = 0; i < total; i++) {
    positions.push(20 + (60 / (total - 1)) * i);
  }
  return positions;
};

MuxBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>MUX Settings</h3>" +
    '<div class="modal-row"><label>Inputs (2-8):</label>' +
    '<input type="text" id="modalMuxInputs" value="' +
    self.numInputs +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMuxType">' +
    '<option value="real"' +
    (self.muxDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.muxDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var num = parseInt(document.getElementById("modalMuxInputs").value);
    if (num < 2) num = 2;
    if (num > 8) num = 8;
    var newType = document.getElementById("modalMuxType").value;
    // Remove old connectors
    for (var i = 0; i < self.inConnections.length; i++)
      if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
    for (var i = 0; i < self.outConnections.length; i++)
      if (self.outConnections[i]) self.outConnections[i].removeConnectedFrom();
    self.inConnections = [];
    self.outConnections = [];
    self.numInputs = num;
    self.muxDataType = newType;
    // Adjust height
    self.divHeight = 80 + Math.max(0, (num - 2) * 20);
    self.divObj.style.height = self.divHeight;
    self.addConnections();
    self._buildLabels();
  });
};

MuxBlock.prototype.addConnections = function () {
  var dt = this.muxDataType;
  var tip = dt === "real" ? "Real" : "Int";
  var positions = this._getPositions();
  // SEL is first input
  this.inConnections[0] = new Connector(
    this,
    1,
    positions[0],
    "int",
    "Int - SEL (0.." + (this.numInputs - 1) + ")",
  );
  for (var i = 0; i < this.numInputs; i++) {
    this.inConnections[i + 1] = new Connector(
      this,
      1,
      positions[i + 1],
      dt,
      tip + " - IN" + (i + 1),
    );
  }
  this.outConnections[0] = new Connector(
    this,
    0,
    positions[0],
    dt,
    tip + " - OUT",
  );
};

MuxBlock.prototype.Execute = function () {
  var sel = this.inConnections[0].connectedFrom
    ? parseInt(this.inConnections[0].connectedFrom.value)
    : 0;
  if (sel < 0) sel = 0;
  if (sel >= this.numInputs) sel = this.numInputs - 1;
  var inConn = this.inConnections[sel + 1];
  var val =
    inConn && inConn.connectedFrom ? parseFloat(inConn.connectedFrom.value) : 0;
  if (this.muxDataType === "int")
    this.outConnections[0].value = Math.round(val);
  else this.outConnections[0].value = val;
};
//**************************************************************************
//
//			Define a DEMUX BLOCK
//
//**************************************************************************
function DemuxBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Demux";
  this.text = "DEMUX";
  this.divHeight = 100;
  this.demuxDataType = "real";
  this.numOutputs = 2;
  this._needsInitialSettings = true;
}

DemuxBlock.prototype = new Base();

DemuxBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

DemuxBlock.prototype._buildLabels = function () {
  var old = this.divObj.querySelectorAll(".pin-label");
  for (var i = 0; i < old.length; i++) this.divObj.removeChild(old[i]);
  var lbl = document.createElement("div");
  lbl.className = "pin-label";
  lbl.style.cssText =
    "display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;";
  lbl.innerHTML = "<span>SEL</span><span>OUT1</span>";
  this.divObj.appendChild(lbl);
  var lbl2 = document.createElement("div");
  lbl2.className = "pin-label";
  lbl2.style.cssText =
    "display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;";
  lbl2.innerHTML =
    "<span>IN</span><span>" + (this.numOutputs > 1 ? "OUT2" : "") + "</span>";
  this.divObj.appendChild(lbl2);
  for (var i = 2; i < this.numOutputs; i++) {
    var row = document.createElement("div");
    row.className = "pin-label";
    row.style.cssText =
      "display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;";
    row.innerHTML = "<span></span><span>OUT" + (i + 1) + "</span>";
    this.divObj.appendChild(row);
  }
};

DemuxBlock.prototype._getPositions = function () {
  var total = Math.max(this.numOutputs, 2);
  var positions = [];
  for (var i = 0; i < total; i++) {
    positions.push(20 + (60 / (total - 1)) * i);
  }
  return positions;
};

DemuxBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>DEMUX Settings</h3>" +
    '<div class="modal-row"><label>Outputs (2-8):</label>' +
    '<input type="text" id="modalDemuxOutputs" value="' +
    self.numOutputs +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalDemuxType">' +
    '<option value="real"' +
    (self.demuxDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.demuxDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var num = parseInt(document.getElementById("modalDemuxOutputs").value);
    if (num < 2) num = 2;
    if (num > 8) num = 8;
    var newType = document.getElementById("modalDemuxType").value;
    for (var i = 0; i < self.inConnections.length; i++)
      if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
    for (var i = 0; i < self.outConnections.length; i++)
      if (self.outConnections[i]) self.outConnections[i].removeConnectedFrom();
    self.inConnections = [];
    self.outConnections = [];
    self.numOutputs = num;
    self.demuxDataType = newType;
    self.divHeight = 80 + Math.max(0, (num - 2) * 20);
    self.divObj.style.height = self.divHeight;
    self.addConnections();
    self._buildLabels();
  });
};

DemuxBlock.prototype.addConnections = function () {
  var dt = this.demuxDataType;
  var tip = dt === "real" ? "Real" : "Int";
  var positions = this._getPositions();
  // SEL and IN on left
  this.inConnections[0] = new Connector(
    this,
    1,
    positions[0],
    "int",
    "Int - SEL (0.." + (this.numOutputs - 1) + ")",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    positions[1],
    dt,
    tip + " - IN",
  );
  // Outputs on right
  for (var i = 0; i < this.numOutputs; i++) {
    this.outConnections[i] = new Connector(
      this,
      0,
      positions[i],
      dt,
      tip + " - OUT" + (i + 1),
    );
  }
};

DemuxBlock.prototype.Execute = function () {
  var sel = this.inConnections[0].connectedFrom
    ? parseInt(this.inConnections[0].connectedFrom.value)
    : 0;
  if (sel < 0) sel = 0;
  if (sel >= this.numOutputs) sel = this.numOutputs - 1;
  var val = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  for (var i = 0; i < this.numOutputs; i++) {
    if (i === sel) {
      if (this.demuxDataType === "int")
        this.outConnections[i].value = Math.round(val);
      else this.outConnections[i].value = val;
    } else {
      this.outConnections[i].value = 0;
    }
  }
};
//**************************************************************************
//
//			Define an IN_RANGE BLOCK
//
//**************************************************************************
function InRangeBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "InRange";
  this.text = "IN_RANGE";
  this.divHeight = 100;
  this.rangeDataType = "real";
  this._needsInitialSettings = true;
}

InRangeBlock.prototype = new Base();

InRangeBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>MIN</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>VALUE</span><span></span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>MAX</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

InRangeBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>IN_RANGE Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalRangeType">' +
    '<option value="real"' +
    (self.rangeDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.rangeDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var newType = document.getElementById("modalRangeType").value;
    if (newType !== self.rangeDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.rangeDataType = newType;
      self.addConnections();
    }
  });
};

InRangeBlock.prototype.addConnections = function () {
  var dt = this.rangeDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 30, dt, tip + " - MIN");
  this.inConnections[1] = new Connector(this, 1, 55, dt, tip + " - VALUE");
  this.inConnections[2] = new Connector(this, 1, 80, dt, tip + " - MAX");
  this.outConnections[0] = new Connector(
    this,
    0,
    30,
    "bool",
    "Bool - Q (in range)",
  );
};

InRangeBlock.prototype.Execute = function () {
  var min = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var value = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var max = this.inConnections[2].connectedFrom
    ? parseFloat(this.inConnections[2].connectedFrom.value)
    : 0;

  if (value >= min && value <= max) this.outConnections[0].value = 1;
  else this.outConnections[0].value = 0;

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define an OUT_OF_RANGE BLOCK
//
//**************************************************************************
function OutOfRangeBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "OutOfRange";
  this.text = "OUT_RANGE";
  this.divHeight = 100;
  this.rangeDataType = "real";
  this._needsInitialSettings = true;
}

OutOfRangeBlock.prototype = new Base();

OutOfRangeBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:4px;padding:0 2px;"><span>MIN</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>VALUE</span><span></span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:12px;padding:0 2px;"><span>MAX</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

OutOfRangeBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>OUT_OF_RANGE Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalRangeType">' +
    '<option value="real"' +
    (self.rangeDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.rangeDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var newType = document.getElementById("modalRangeType").value;
    if (newType !== self.rangeDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.rangeDataType = newType;
      self.addConnections();
    }
  });
};

OutOfRangeBlock.prototype.addConnections = function () {
  var dt = this.rangeDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 30, dt, tip + " - MIN");
  this.inConnections[1] = new Connector(this, 1, 55, dt, tip + " - VALUE");
  this.inConnections[2] = new Connector(this, 1, 80, dt, tip + " - MAX");
  this.outConnections[0] = new Connector(
    this,
    0,
    30,
    "bool",
    "Bool - Q (out of range)",
  );
};

OutOfRangeBlock.prototype.Execute = function () {
  var min = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var value = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var max = this.inConnections[2].connectedFrom
    ? parseFloat(this.inConnections[2].connectedFrom.value)
    : 0;

  if (value < min || value > max) this.outConnections[0].value = 1;
  else this.outConnections[0].value = 0;

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a CMP BLOCK (Comparator)
//
//**************************************************************************
function CmpBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Cmp";
  this.text = "CMP ==";
  this.divHeight = 80;
  this.cmpDataType = "real";
  this.cmpMode = "==";
  this._needsInitialSettings = true;
}

CmpBlock.prototype = new Base();

CmpBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN1</span><span>Q</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN2</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

CmpBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>CMP Settings</h3>" +
    '<div class="modal-row"><label>Mode:</label>' +
    '<select id="modalCmpMode">' +
    '<option value="=="' +
    (self.cmpMode === "==" ? " selected" : "") +
    ">== (Equal)</option>" +
    '<option value="&gt;="' +
    (self.cmpMode === ">=" ? " selected" : "") +
    ">&gt;= (Greater or equal)</option>" +
    '<option value="&lt;="' +
    (self.cmpMode === "<=" ? " selected" : "") +
    ">&lt;= (Less or equal)</option>" +
    '<option value="&lt;&gt;"' +
    (self.cmpMode === "<>" ? " selected" : "") +
    ">&lt;&gt; (Not equal)</option>" +
    "</select></div>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalCmpType">' +
    '<option value="real"' +
    (self.cmpDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.cmpDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    self.cmpMode = document.getElementById("modalCmpMode").value;
    var newType = document.getElementById("modalCmpType").value;
    if (newType !== self.cmpDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.cmpDataType = newType;
      self.addConnections();
    }
    self.headerDiv.innerHTML = "CMP " + self.cmpMode;
  });
};

CmpBlock.prototype.addConnections = function () {
  var dt = this.cmpDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 38, dt, tip + " - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, dt, tip + " - IN2");
  this.outConnections[0] = new Connector(this, 0, 38, "bool", "Bool - Q");
};

CmpBlock.prototype.Execute = function () {
  var in1 = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var in2 = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  var result = false;
  switch (this.cmpMode) {
    case "==":
      result = in1 === in2;
      break;
    case ">=":
      result = in1 >= in2;
      break;
    case "<=":
      result = in1 <= in2;
      break;
    case "<>":
      result = in1 !== in2;
      break;
  }
  this.outConnections[0].value = result ? 1 : 0;

  if (this.outConnections[0].value)
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  else this.divObj.style.border = "2px dashed rgb(0,0,255)";
};
//**************************************************************************
//
//			Define a Constant Block
//
//**************************************************************************
function ConstantBlock() {
  this.objectName = "Constant";
  this.divHeight = 16;
  this.divWidth = 40;
  this.constantValue = 0;
  this.text = "0";
  this._needsInitialSettings = true;
}
ConstantBlock.prototype = new Base();

ConstantBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

ConstantBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Konstante</h3>" +
    '<div class="modal-row"><label>Wert:</label>' +
    '<input type="text" id="modalValue" value="' +
    self.constantValue +
    '"></div>';

  Base.showModal(html, function () {
    var val = parseInt(document.getElementById("modalValue").value);
    if (!isNaN(val)) {
      self.constantValue = val;
      self.headerDiv.innerHTML = self.constantValue;
    }
  });
};

ConstantBlock.prototype.addConnections = function () {
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "int",
    "Int - Constant value",
  );
};
ConstantBlock.prototype.Execute = function () {
  this.outConnections[0].value = this.constantValue;
};
//**************************************************************************
//
//			Define a Variable Block
//
//**************************************************************************
function VariableBlock() {
  this.objectName = "Variable";
  this.divHeight = 16;
  this.divWidth = 40;
  this.variableValue = 0;
  this.text = 0;
}

VariableBlock.prototype = new Base();

VariableBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    "int",
    "Int - Variable input",
  );
};

VariableBlock.prototype.Execute = function () {
  this.variableValue = this.inConnections[0].connectedFrom.value;
  this.headerDiv.innerHTML = this.variableValue;
};
//**************************************************************************
//
//			Define an AI Block
//
//**************************************************************************
function AiBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Ai";
  this.divHeight = 26;
  this.divWidth = 178;
  this.text = "AI";
  this.tagName = "AI";
  this.comment = "";
  this.rawValue = 0;
  this.aiDataType = "int";
  this._needsInitialSettings = true;
}

AiBlock.prototype = new Base();

AiBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Small rect left (45px) + large right (133px)
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;left:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-right:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "AI";
  this.divObj.appendChild(this._typeBox);
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:46px;top:0;right:0;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

AiBlock.prototype._updateInfoBox = function () {
  var displayVal;
  if (this.aiDataType === "real")
    displayVal = parseFloat(this.rawValue.toFixed(3));
  else displayVal = parseInt(this.rawValue);
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

AiBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>AI Settings</h3>" +
    '<div class="modal-row"><label>Tagname:</label>' +
    '<input type="text" id="modalTagName" value="' +
    self.tagName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Value:</label>' +
    '<input type="text" id="modalValue" value="' +
    self.rawValue +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalAiType">' +
    '<option value="int"' +
    (self.aiDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.aiDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.tagName = document.getElementById("modalTagName").value || "AI";
    self.comment = document.getElementById("modalComment").value || "";
    var valStr = document.getElementById("modalValue").value;
    var newType = document.getElementById("modalAiType").value;
    if (newType === "real") {
      var val = parseFloat(valStr);
      if (!isNaN(val)) self.rawValue = val;
    } else {
      var val = parseInt(valStr);
      if (!isNaN(val)) self.rawValue = val;
    }
    if (newType !== self.aiDataType || self.outConnections.length === 0) {
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.outConnections = [];
      self.aiDataType = newType;
      self.addConnections();
    }
    self.aiDataType = newType;
    self._updateInfoBox();
  });
};

AiBlock.prototype.addConnections = function () {
  var tipType = this.aiDataType === "real" ? "Real" : "Int";
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    this.aiDataType,
    tipType + " - Analog Input",
  );
};

AiBlock.prototype.clickHandler = function (e) {
  if (!this.hasMoved) {
    if (this.sheetObject.simulateOn) {
      var canvasPos = this.sheetObject.screenToCanvas(e.clientX, e.clientY);
      var blockLeft = parseInt(this.divObj.style.left) + 46; // info box area
      var infoW = 132;
      var third = infoW / 3;
      if (canvasPos.x < blockLeft + third)
        this.rawValue =
          this.aiDataType === "real"
            ? parseFloat((this.rawValue - 0.1).toFixed(3))
            : this.rawValue - 1;
      else if (canvasPos.x > blockLeft + third * 2)
        this.rawValue =
          this.aiDataType === "real"
            ? parseFloat((this.rawValue + 0.1).toFixed(3))
            : this.rawValue + 1;
      else {
        var self = this;
        var html =
          '<h3>AI Value</h3><div class="modal-row"><label>Value:</label><input type="text" id="modalValue" value="' +
          self.rawValue +
          '"></div>';
        Base.showModal(html, function () {
          var val =
            self.aiDataType === "real"
              ? parseFloat(document.getElementById("modalValue").value)
              : parseInt(document.getElementById("modalValue").value);
          if (!isNaN(val)) self.rawValue = val;
        });
      }
    }
  } else {
    this.hasMoved = 0;
  }
};

AiBlock.prototype.Execute = function () {
  var displayVal;
  if (this.aiDataType === "real")
    displayVal = parseFloat(this.rawValue.toFixed(3));
  else displayVal = parseInt(this.rawValue);
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    ": " +
    displayVal +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
  this.outConnections[0].value = this.rawValue;
};

//**************************************************************************
//
//			Define an AQ Block (Analog Output Display)
//
//**************************************************************************
function AqBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Aq";
  this.divHeight = 26;
  this.divWidth = 178;
  this.text = "AQ";
  this.tagName = "AQ";
  this.comment = "";
  this.aqDataType = "int";
  this._needsInitialSettings = true;
}

AqBlock.prototype = new Base();

AqBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Large left (133px) + small right (45px)
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:0;top:0;width:132px;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;text-align:left;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;right:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-left:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "AQ";
  this.divObj.appendChild(this._typeBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

AqBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

AqBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>AQ Settings</h3>" +
    '<div class="modal-row"><label>Tagname:</label>' +
    '<input type="text" id="modalTagName" value="' +
    self.tagName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalAqType">' +
    '<option value="int"' +
    (self.aqDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.aqDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.tagName = document.getElementById("modalTagName").value || "AQ";
    self.comment = document.getElementById("modalComment").value || "";
    var newType = document.getElementById("modalAqType").value;
    if (newType !== self.aqDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      self.inConnections = [];
      self.aqDataType = newType;
      self.addConnections();
    }
    self.aqDataType = newType;
    self._updateInfoBox();
  });
};

AqBlock.prototype.addConnections = function () {
  var tipType = this.aqDataType === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    this.aqDataType,
    tipType + " - Analog Output",
  );
};

AqBlock.prototype.Execute = function () {
  var val = this.inConnections[0].connectedFrom
    ? this.inConnections[0].connectedFrom.value
    : 0;
  var displayVal;
  if (this.aqDataType === "real") {
    val = parseFloat(val);
    if (val === Math.floor(val)) displayVal = val.toFixed(1);
    else {
      var str = val.toFixed(3).replace(/0+$/, "");
      if (str.endsWith(".")) str += "0";
      displayVal = str;
    }
  } else {
    displayVal = parseInt(val);
  }
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.tagName +
    ": " +
    displayVal +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

//**************************************************************************
//
//			Define an AIN Block
//
//**************************************************************************
function AinBlock() {
  this.objectName = "Ain";
  this.text = "AIN";
  this.linearConstant = 0.0;
  this.scaledValue = 0.0;
}

AinBlock.prototype = new Base();

AinBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    25,
    "int",
    "Int - Raw input (0-4095)",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    50,
    "real",
    "Real - Scale max",
  );
  this.inConnections[2] = new Connector(
    this,
    1,
    75,
    "real",
    "Real - Scale min",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    25,
    "real",
    "Real - Scaled value",
  );
};

AinBlock.prototype.Execute = function () {
  this.linearConstant = parseFloat(
    3276 /
      (this.inConnections[1].connectedFrom.value -
        this.inConnections[2].connectedFrom.value),
  );

  this.scaledValue = parseFloat(
    (this.inConnections[0].connectedFrom.value - 819.0) / this.linearConstant,
  );
  //y=mx+b or x=(y-b)/m

  this.outConnections[0].value = this.scaledValue.toFixed(2);
};

//**************************************************************************
//
//			Define a Greater Than Block
//
//**************************************************************************
function GtBlock() {
  this.objectName = "Gt";
  this.text = "GT";
}

GtBlock.prototype = new Base();

GtBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 25, "real", "Real - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, "real", "Real - IN2");

  this.outConnections[0] = new Connector(
    this,
    0,
    25,
    "bool",
    "Bool - IN1 > IN2",
  );
};

GtBlock.prototype.Execute = function () {
  if (
    parseFloat(this.inConnections[0].connectedFrom.value) >
    parseFloat(this.inConnections[1].connectedFrom.value)
  ) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define a Less Than Block
//
//**************************************************************************
function LtBlock() {
  this.objectName = "Lt";
  this.text = "LT";
}

LtBlock.prototype = new Base();

LtBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 25, "real", "Real - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, "real", "Real - IN2");

  this.outConnections[0] = new Connector(
    this,
    0,
    25,
    "bool",
    "Bool - IN1 < IN2",
  );
};

LtBlock.prototype.Execute = function () {
  if (
    parseFloat(this.inConnections[0].connectedFrom.value) <
    parseFloat(this.inConnections[1].connectedFrom.value)
  ) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define an Unpack 16 Block
//
//**************************************************************************
function UnpackSixteenBlock() {
  this.objectName = "UnpackSixteen";
  this.text = "UNPACK 16";
  this.divHeight = 320;
  this.inputNumber = 0;
  this.indexCounter = 0;
}

UnpackSixteenBlock.prototype = new Base();

UnpackSixteenBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    "int",
    "Int - 16-bit input word",
  );

  for (connectorIndex = 0; connectorIndex < 16; connectorIndex++)
    this.outConnections[connectorIndex] = new Connector(
      this,
      0,
      connectorIndex * 6.25 + 4,
      "bool",
      "Bool - Bit " + connectorIndex,
    );
};

UnpackSixteenBlock.prototype.Execute = function () {
  this.inputNumber = parseInt(this.inConnections[0].connectedFrom.value);

  for (this.indexCounter = 0; this.indexCounter < 16; this.indexCounter++) {
    this.outConnections[this.indexCounter].value = this.inputNumber & 1;
    this.inputNumber = this.inputNumber >> 1;
  }
};

//**************************************************************************
//
//			Define a Pack 16 Block
//
//**************************************************************************
function PackSixteenBlock() {
  this.objectName = "PackSixteen";
  this.text = "PACK 16";
  this.divHeight = 320;
  this.outputNumber = 0;
  this.tempNumber = 0;
  this.indexCounter = 0;
}

PackSixteenBlock.prototype = new Base();

PackSixteenBlock.prototype.addConnections = function () {
  for (connectorIndex = 0; connectorIndex < 16; connectorIndex++)
    this.inConnections[connectorIndex] = new Connector(
      this,
      1,
      connectorIndex * 6.25 + 4,
      "bool",
      "Bool - Bit " + connectorIndex,
    );

  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "int",
    "Int - 16-bit output word",
  );
};

PackSixteenBlock.prototype.Execute = function () {
  this.inputNumber = this.inConnections[0].connectedFrom.value;
  this.outputNumber = 0;
  this.outConnections[0].value = 0;

  for (this.indexCounter = 0; this.indexCounter < 16; this.indexCounter++) {
    if (this.inConnections[this.indexCounter].connectedFrom == null)
      this.tempNumber = 0;
    else {
      if (this.inConnections[this.indexCounter].getInputValue())
        this.tempNumber = Math.pow(2, this.indexCounter);
      else this.tempNumber = 0;
    }

    this.outputNumber = this.outputNumber + this.tempNumber;

    this.outConnections[0].value = this.outputNumber;
  }
};

//**************************************************************************
//
//			Define a First Order Lag Block
//
//**************************************************************************
function FirstOrderLagBlock() {
  this.objectName = "FirstOrderLag";
  this.text = "1ST ORDER";
  this.lastpv = 0.0;
  this.currentScan = 0;
  this.lastScan = 0;
  this.firstScan = 1;
}

FirstOrderLagBlock.prototype = new Base();

FirstOrderLagBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    20,
    "real",
    "Real - Process value",
  );
  this.inConnections[1] = new Connector(this, 1, 50, "real", "Real - Delay");
  this.inConnections[2] = new Connector(this, 1, 80, "real", "Real - Lag");

  this.outConnections[0] = new Connector(
    this,
    0,
    20,
    "real",
    "Real - Filtered output",
  );
};

FirstOrderLagBlock.prototype.Execute = function () {
  this.d = new Date();
  this.currentScan = this.d.getTime();
  delete this.d;

  if (this.firstScan) {
    this.lastScan = this.currentScan;
    this.firstScan = 0;
  } else {
    this.scan = parseInt((this.currentScan - this.lastScan) / 1000);
    if (this.scan >= 1) {
      this.pv = parseFloat(this.inConnections[0].connectedFrom.value);
      this.delay = parseFloat(this.inConnections[1].connectedFrom.value);
      this.lag = parseFloat(this.inConnections[2].connectedFrom.value);

      this.outpv = parseFloat(
        this.lastpv +
          (this.delay / (this.delay + this.lag)) * (this.pv - this.lastpv),
      );

      this.outConnections[0].value = this.outpv.toFixed(1);
      this.lastpv = this.outpv;

      this.lastScan = this.currentScan;
    } else {
      //this.lastScan = this.currentScan;
    }
  }
};

//**************************************************************************
//
//			Define a Select Block
//
//**************************************************************************
function SelectBlock() {
  this.objectName = "Select";
  this.text = "SELECT";
}

SelectBlock.prototype = new Base();

SelectBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 20, "bool", "Bool - Selector");
  this.inConnections[1] = new Connector(
    this,
    1,
    50,
    "real",
    "Real - Value if true",
  );
  this.inConnections[2] = new Connector(
    this,
    1,
    80,
    "real",
    "Real - Value if false",
  );

  this.outConnections[0] = new Connector(
    this,
    0,
    20,
    "real",
    "Real - Selected value",
  );
};

SelectBlock.prototype.Execute = function () {
  if (this.inConnections[0].getInputValue()) {
    this.outConnections[0].value = this.inConnections[1].connectedFrom.value;
  } else {
    this.outConnections[0].value = this.inConnections[2].connectedFrom.value;
  }
};

//New blocks below

function AddBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Add";
  this.text = "ADD";
  this.mathDataType = "real";
  this._needsInitialSettings = true;
}

AddBlock.prototype = new Base();

AddBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN1</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN2</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

AddBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>ADD Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMathType">' +
    '<option value="real"' +
    (self.mathDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.mathDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    var newType = document.getElementById("modalMathType").value;
    if (newType !== self.mathDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.mathDataType = newType;
      self.addConnections();
    }
  });
};

AddBlock.prototype.addConnections = function () {
  var dt = this.mathDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 38, dt, tip + " - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, dt, tip + " - IN2");
  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    dt,
    tip + " - OUT (IN1 + IN2)",
  );
};

AddBlock.prototype.Execute = function () {
  var a = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var b = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  if (this.mathDataType === "int")
    this.outConnections[0].value = Math.round(a + b);
  else this.outConnections[0].value = parseFloat((a + b).toFixed(6));
};

function MultiplyBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Mul";
  this.text = "MUL";
  this.mathDataType = "real";
  this._needsInitialSettings = true;
}

MultiplyBlock.prototype = new Base();

MultiplyBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN1</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN2</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

MultiplyBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>MUL Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMathType">' +
    '<option value="real"' +
    (self.mathDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.mathDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    var newType = document.getElementById("modalMathType").value;
    if (newType !== self.mathDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.mathDataType = newType;
      self.addConnections();
    }
  });
};

MultiplyBlock.prototype.addConnections = function () {
  var dt = this.mathDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 38, dt, tip + " - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, dt, tip + " - IN2");
  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    dt,
    tip + " - OUT (IN1 * IN2)",
  );
};

MultiplyBlock.prototype.Execute = function () {
  var a = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var b = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  if (this.mathDataType === "int")
    this.outConnections[0].value = Math.round(a * b);
  else this.outConnections[0].value = parseFloat((a * b).toFixed(6));
};

function DivideBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Div";
  this.text = "DIV";
  this.mathDataType = "real";
  this._needsInitialSettings = true;
}

DivideBlock.prototype = new Base();

DivideBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN1</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN2</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

DivideBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>DIV Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMathType">' +
    '<option value="real"' +
    (self.mathDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.mathDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    var newType = document.getElementById("modalMathType").value;
    if (newType !== self.mathDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.mathDataType = newType;
      self.addConnections();
    }
  });
};

DivideBlock.prototype.addConnections = function () {
  var dt = this.mathDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(
    this,
    1,
    38,
    dt,
    tip + " - IN1 (Dividend)",
  );
  this.inConnections[1] = new Connector(
    this,
    1,
    75,
    dt,
    tip + " - IN2 (Divisor)",
  );
  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    dt,
    tip + " - OUT (IN1 / IN2)",
  );
};

DivideBlock.prototype.Execute = function () {
  var a = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var b = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  if (b !== 0) {
    if (this.mathDataType === "int")
      this.outConnections[0].value = Math.round(a / b);
    else this.outConnections[0].value = parseFloat((a / b).toFixed(6));
  }
};

function SubtractBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Sub";
  this.text = "SUB";
  this.mathDataType = "real";
  this._needsInitialSettings = true;
}

SubtractBlock.prototype = new Base();

SubtractBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  var labelHTML =
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:8px;padding:0 2px;"><span>IN1</span><span>OUT</span></div>';
  labelHTML +=
    '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:20px;padding:0 2px;"><span>IN2</span><span></span></div>';
  this.divObj.insertAdjacentHTML("beforeend", labelHTML);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

SubtractBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>SUB Settings</h3>" +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalMathType">' +
    '<option value="real"' +
    (self.mathDataType === "real" ? " selected" : "") +
    ">Real</option>" +
    '<option value="int"' +
    (self.mathDataType === "int" ? " selected" : "") +
    ">Int</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    var newType = document.getElementById("modalMathType").value;
    if (newType !== self.mathDataType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.inConnections = [];
      self.outConnections = [];
      self.mathDataType = newType;
      self.addConnections();
    }
  });
};

SubtractBlock.prototype.addConnections = function () {
  var dt = this.mathDataType;
  var tip = dt === "real" ? "Real" : "Int";
  this.inConnections[0] = new Connector(this, 1, 38, dt, tip + " - IN1");
  this.inConnections[1] = new Connector(this, 1, 75, dt, tip + " - IN2");
  this.outConnections[0] = new Connector(
    this,
    0,
    38,
    dt,
    tip + " - OUT (IN1 - IN2)",
  );
};

SubtractBlock.prototype.Execute = function () {
  var a = this.inConnections[0].connectedFrom
    ? parseFloat(this.inConnections[0].connectedFrom.value)
    : 0;
  var b = this.inConnections[1].connectedFrom
    ? parseFloat(this.inConnections[1].connectedFrom.value)
    : 0;
  if (this.mathDataType === "int")
    this.outConnections[0].value = Math.round(a - b);
  else this.outConnections[0].value = parseFloat((a - b).toFixed(6));
};

function NotBlock() {
  this.objectName = "Not";
  this.text = "NOT";
  this.divHeight = 30;
  this.divWidth = 100;
}

NotBlock.prototype = new Base();

NotBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(this, 1, 50, "bool", "Bool - Input");

  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    "bool",
    "Bool - Inverted output",
  );
};

NotBlock.prototype.Execute = function () {
  if (this.inConnections[0].getInputValue() == 0) {
    this.outConnections[0].value = 1;
    this.divObj.style.border = "2px solid rgb(3,255,3)";
  } else {
    this.outConnections[0].value = 0;
    this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};
//**************************************************************************
//
//			Define a COMMENT BLOCK
//
//**************************************************************************
function CommentBlock() {
  this.objectName = "Comment";
  this.text = "";
  this.divHeight = 60;
  this.divWidth = 150;
  this.commentHTML = "Comment";
  this.commentWidth = 150;
  this.commentHeight = 60;
  this._needsInitialSettings = true;
}

CommentBlock.prototype = new Base();

CommentBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  // Override styling for comment block
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.border = "1px solid black";
  this.divObj.style.cursor = "move";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.textAlign = "left";
  this.divObj.style.padding = "0";

  // Remove header
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }

  // Create content area
  this._contentDiv = document.createElement("div");
  this._contentDiv.style.padding = "4px 6px";
  this._contentDiv.style.fontSize = "11px";
  this._contentDiv.style.fontFamily = "Calibri, Arial, sans-serif";
  this._contentDiv.style.fontWeight = "normal";
  this._contentDiv.style.lineHeight = "1.3";
  this._contentDiv.style.wordWrap = "break-word";
  this._contentDiv.style.pointerEvents = "none";
  this._contentDiv.innerHTML = this.commentHTML;
  this.divObj.appendChild(this._contentDiv);

  // Create resize handle
  this._resizeHandle = document.createElement("div");
  this._resizeHandle.style.position = "absolute";
  this._resizeHandle.style.right = "0";
  this._resizeHandle.style.bottom = "0";
  this._resizeHandle.style.width = "10px";
  this._resizeHandle.style.height = "10px";
  this._resizeHandle.style.cursor = "nwse-resize";
  this._resizeHandle.style.borderRight = "2px solid #999";
  this._resizeHandle.style.borderBottom = "2px solid #999";
  this.divObj.appendChild(this._resizeHandle);

  // Resize drag logic
  var self = this;
  this._isResizing = false;
  this._resizeHandle.addEventListener(
    "mousedown",
    function (e) {
      e.stopPropagation();
      e.preventDefault();
      self._isResizing = true;
      self.captured = 0; // Cancel any block drag
      var startX = e.clientX;
      var startY = e.clientY;
      var startW = parseInt(self.divObj.style.width);
      var startH = parseInt(self.divObj.style.height);

      function onMove(ev) {
        var dx = (ev.clientX - startX) / self.sheetObject.scale;
        var dy = (ev.clientY - startY) / self.sheetObject.scale;
        var newW = Math.max(60, startW + dx);
        var newH = Math.max(30, startH + dy);
        self.divObj.style.width = newW;
        self.divObj.style.height = newH;
        self.divWidth = newW;
        self.divHeight = newH;
        self.commentWidth = newW;
        self.commentHeight = newH;
      }
      function onUp() {
        self._isResizing = false;
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
      }
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    },
    true,
  );

  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

CommentBlock.prototype.openSettings = function () {
  var self = this;
  var escaped = self.commentHTML.replace(/"/g, "&quot;");
  var html =
    "<h3>Comment</h3>" +
    '<div style="margin-bottom:6px;">' +
    '<button onclick="document.execCommand(\'bold\')" title="Bold" style="font-weight:bold;padding:2px 6px;margin-right:2px;cursor:pointer;">B</button>' +
    '<button onclick="document.execCommand(\'italic\')" title="Italic" style="font-style:italic;padding:2px 6px;margin-right:2px;cursor:pointer;">I</button>' +
    '<button onclick="document.execCommand(\'underline\')" title="Underline" style="text-decoration:underline;padding:2px 6px;margin-right:2px;cursor:pointer;">U</button>' +
    "<select onchange=\"document.execCommand('fontSize',false,this.value);this.value='';\" style=\"padding:2px;font-size:11px;margin-left:4px;\">" +
    '<option value="">Size</option>' +
    '<option value="1">8px</option>' +
    '<option value="2">10px</option>' +
    '<option value="3">12px</option>' +
    '<option value="4">14px</option>' +
    '<option value="5">18px</option>' +
    '<option value="6">24px</option>' +
    '<option value="7">36px</option>' +
    "</select>" +
    "</div>" +
    '<div id="commentEditor" contenteditable="true" style="border:1px solid #aaa;border-radius:3px;padding:6px;min-height:80px;max-height:200px;overflow-y:auto;font-family:Calibri,Arial,sans-serif;font-size:12px;line-height:1.3;outline:none;">' +
    self.commentHTML +
    "</div>";

  Base.showModal(html, function () {
    self.commentHTML = document.getElementById("commentEditor").innerHTML;
    self._contentDiv.innerHTML = self.commentHTML;
  });

  // Focus editor
  setTimeout(function () {
    var editor = document.getElementById("commentEditor");
    if (editor) editor.focus();
  }, 50);
};

CommentBlock.prototype.addConnections = function () {
  // No connections for comments
};

CommentBlock.prototype.Execute = function () {
  // No logic
};

CommentBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "1px solid black";
};

CommentBlock.prototype._serializeProps = function (p) {
  p.commentHTML = this.commentHTML;
  p.commentWidth = this.commentWidth;
  p.commentHeight = this.commentHeight;
};

CommentBlock.prototype.applySerializedProps = function (p) {
  this.commentHTML = p.commentHTML || "Comment";
  this.commentWidth = p.commentWidth || 150;
  this.commentHeight = p.commentHeight || 60;
  this.divObj.style.width = this.commentWidth;
  this.divObj.style.height = this.commentHeight;
  this.divWidth = this.commentWidth;
  this.divHeight = this.commentHeight;
  if (this._contentDiv) this._contentDiv.innerHTML = this.commentHTML;
};

//**************************************************************************
//
//			Define a DRAW LINE BLOCK (visual decoration line)
//
//**************************************************************************
function DrawLineBlock() {
  this.objectName = "DrawLine";
  this.text = "";
  this.divHeight = 2;
  this.divWidth = 100;
  // Line endpoints relative to canvas
  this.x1 = 0;
  this.y1 = 0;
  this.x2 = 100;
  this.y2 = 0;
  this.lineColor = "#000000";
  this.lineThickness = 2;
  this.lineStyle = ""; // SVG dash pattern: "" = solid
  this.lineStyleName = "solid";
  this._needsInitialSettings = true;
}

DrawLineBlock.prototype = new Base();

DrawLineBlock.prototype.create = function (sheet, t, l) {
  this.sheetObject = sheet;
  this.indexNumber = this.sheetObject.blockIndex;
  this.inConnections = [];
  this.outConnections = [];

  // Set initial endpoints based on placement position
  this.x1 = l - 50;
  this.y1 = t;
  this.x2 = l + 50;
  this.y2 = t;

  // Container div — will be resized to bounding box
  this.divObj = document.createElement("div");
  this.divObj.style.position = "absolute";
  this.divObj.style.zIndex = "-1";
  this.divObj.style.overflow = "visible";
  this.divObj.style.border = "none";
  this.divObj.style.backgroundColor = "transparent";
  this.divObj.style.cursor = "move";
  this.sheetObject.canvas.appendChild(this.divObj);

  // SVG for the line
  var svgNS = "http://www.w3.org/2000/svg";
  this._svg = document.createElementNS(svgNS, "svg");
  this._svg.style.position = "absolute";
  this._svg.style.left = "0";
  this._svg.style.top = "0";
  this._svg.style.overflow = "visible";
  this._svg.style.pointerEvents = "none";
  this.divObj.appendChild(this._svg);

  this._svgLine = document.createElementNS(svgNS, "line");
  this._svgLine.setAttribute("stroke", this.lineColor);
  this._svgLine.setAttribute("stroke-width", this.lineThickness);
  this._svg.appendChild(this._svgLine);

  // Two endpoint handles
  this._handle1 = this._createHandle();
  this._handle2 = this._createHandle();
  this.sheetObject.canvas.appendChild(this._handle1);
  this.sheetObject.canvas.appendChild(this._handle2);

  // Invisible hitbox over the line for clicking/dragging
  this._hitLine = document.createElementNS(svgNS, "line");
  this._hitLine.setAttribute("stroke", "transparent");
  this._hitLine.setAttribute("stroke-width", "12");
  this._hitLine.style.cursor = "move";
  this._hitLine.style.pointerEvents = "stroke";
  this._svg.appendChild(this._hitLine);

  this._updateGeometry();

  // Drag handlers for the whole line (via hitbox)
  var self = this;
  this._hitLine.addEventListener(
    "mousedown",
    function (e) {
      if (self.sheetObject.simulateOn) return;
      e.stopPropagation();
      var canvasPos = self.sheetObject.screenToCanvas(e.clientX, e.clientY);
      var ox1 = canvasPos.x - self.x1;
      var oy1 = canvasPos.y - self.y1;
      var ox2 = canvasPos.x - self.x2;
      var oy2 = canvasPos.y - self.y2;

      self.sheetObject.turnOffSelect();
      self.sheetObject.blockSelected(self, e.shiftKey);

      function onMove(ev) {
        var cp = self.sheetObject.screenToCanvas(ev.clientX, ev.clientY);
        var canvasW = parseInt(self.sheetObject.canvas.style.width) || 10000;
        var canvasH = parseInt(self.sheetObject.canvas.style.height) || 10000;
        var nx1 = cp.x - ox1,
          ny1 = cp.y - oy1;
        var nx2 = cp.x - ox2,
          ny2 = cp.y - oy2;
        // Clamp both endpoints
        if (nx1 < 0) {
          nx2 -= nx1;
          nx1 = 0;
        }
        if (ny1 < 0) {
          ny2 -= ny1;
          ny1 = 0;
        }
        if (nx2 < 0) {
          nx1 -= nx2;
          nx2 = 0;
        }
        if (ny2 < 0) {
          ny1 -= ny2;
          ny2 = 0;
        }
        if (nx1 > canvasW) {
          nx2 -= nx1 - canvasW;
          nx1 = canvasW;
        }
        if (ny1 > canvasH) {
          ny2 -= ny1 - canvasH;
          ny1 = canvasH;
        }
        if (nx2 > canvasW) {
          nx1 -= nx2 - canvasW;
          nx2 = canvasW;
        }
        if (ny2 > canvasH) {
          ny1 -= ny2 - canvasH;
          ny2 = canvasH;
        }
        // Snap beginning point to grid (anchor), adjust ending point to maintain shape
        if (self.sheetObject.snapToGrid) {
          var gridSize = self.sheetObject.gridSize;
          var snappedX1 = Math.round(nx1 / gridSize) * gridSize;
          var snappedY1 = Math.round(ny1 / gridSize) * gridSize;
          var dx = nx2 - nx1;
          var dy = ny2 - ny1;
          nx1 = snappedX1;
          ny1 = snappedY1;
          nx2 = nx1 + dx;
          ny2 = ny1 + dy;
        }
        self.x1 = nx1;
        self.y1 = ny1;
        self.x2 = nx2;
        self.y2 = ny2;
        self._updateGeometry();
        self.sheetObject._updateSelCoords();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
      }
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    },
    true,
  );

  // Drag handler for endpoint 1
  this._setupEndpointDrag(this._handle1, 1);
  // Drag handler for endpoint 2
  this._setupEndpointDrag(this._handle2, 2);

  // Dblclick on hitline opens settings
  this._hitLine.addEventListener(
    "dblclick",
    function (e) {
      e.stopPropagation();
      self.sheetObject.dblclickHandled = true;
      self.openSettings();
    },
    true,
  );

  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

DrawLineBlock.prototype._createHandle = function () {
  var h = document.createElement("div");
  h.style.position = "absolute";
  h.style.width = "10px";
  h.style.height = "10px";
  h.style.backgroundColor = "transparent";
  h.style.border = "1.5px solid red";
  h.style.borderRadius = "50%";
  h.style.cursor = "crosshair";
  h.style.zIndex = "200";
  h.style.display = "none";
  h.style.marginLeft = "-5px";
  h.style.marginTop = "-5px";
  return h;
};

DrawLineBlock.prototype._setupEndpointDrag = function (handle, which) {
  var self = this;
  handle.addEventListener(
    "mousedown",
    function (e) {
      if (self.sheetObject.simulateOn) return;
      e.stopPropagation();
      e.preventDefault();

      function onMove(ev) {
        var cp = self.sheetObject.screenToCanvas(ev.clientX, ev.clientY);
        var canvasW = parseInt(self.sheetObject.canvas.style.width) || 10000;
        var canvasH = parseInt(self.sheetObject.canvas.style.height) || 10000;
        var cx = Math.max(0, Math.min(cp.x, canvasW));
        var cy = Math.max(0, Math.min(cp.y, canvasH));
        // Snap endpoint to grid
        if (self.sheetObject.snapToGrid) {
          var gridSize = self.sheetObject.gridSize;
          cx = Math.round(cx / gridSize) * gridSize;
          cy = Math.round(cy / gridSize) * gridSize;
        }
        if (which === 1) {
          self.x1 = cx;
          self.y1 = cy;
        } else {
          self.x2 = cx;
          self.y2 = cy;
        }
        self._updateGeometry();
        self.sheetObject._updateSelCoords();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
      }
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("mouseup", onUp, true);
    },
    true,
  );
};

DrawLineBlock.prototype._updateGeometry = function () {
  var pad = 10;
  var minX = Math.min(this.x1, this.x2) - pad;
  var minY = Math.min(this.y1, this.y2) - pad;
  var maxX = Math.max(this.x1, this.x2) + pad;
  var maxY = Math.max(this.y1, this.y2) + pad;
  var w = maxX - minX;
  var h = Math.max(maxY - minY, 1);

  // Position container
  this.divObj.style.left = minX + "px";
  this.divObj.style.top = minY + "px";
  this.divObj.style.width = w + "px";
  this.divObj.style.height = h + "px";
  this.divWidth = w;
  this.divHeight = h;

  // SVG size
  this._svg.setAttribute("width", w);
  this._svg.setAttribute("height", h);

  // Line coordinates relative to container
  var lx1 = this.x1 - minX;
  var ly1 = this.y1 - minY;
  var lx2 = this.x2 - minX;
  var ly2 = this.y2 - minY;

  this._svgLine.setAttribute("x1", lx1);
  this._svgLine.setAttribute("y1", ly1);
  this._svgLine.setAttribute("x2", lx2);
  this._svgLine.setAttribute("y2", ly2);
  this._svgLine.setAttribute("stroke", this.lineColor);
  this._svgLine.setAttribute("stroke-width", this.lineThickness);
  if (this.lineStyle) {
    this._svgLine.setAttribute("stroke-dasharray", this.lineStyle);
  } else {
    this._svgLine.removeAttribute("stroke-dasharray");
  }

  this._hitLine.setAttribute("x1", lx1);
  this._hitLine.setAttribute("y1", ly1);
  this._hitLine.setAttribute("x2", lx2);
  this._hitLine.setAttribute("y2", ly2);

  // Position handles
  this._handle1.style.left = this.x1 + "px";
  this._handle1.style.top = this.y1 + "px";
  this._handle2.style.left = this.x2 + "px";
  this._handle2.style.top = this.y2 + "px";
};

DrawLineBlock.prototype.openSettings = function () {
  var self = this;
  var dx = Math.round(self.x2 - self.x1);
  var dy = Math.round(self.y2 - self.y1);
  var html =
    "<h3>Line Settings</h3>" +
    '<div class="modal-section-title">Start Point</div>' +
    '<div class="modal-row"><label>X:</label><input type="text" id="dlX1" value="' +
    Math.round(self.x1) +
    '" style="width:60px;"><label style="width:30px;margin-left:10px;">Y:</label><input type="text" id="dlY1" value="' +
    Math.round(self.y1) +
    '" style="width:60px;"></div>' +
    '<div class="modal-section-title">End Point</div>' +
    '<div class="modal-row"><label>X:</label><input type="text" id="dlX2" value="' +
    Math.round(self.x2) +
    '" style="width:60px;"><label style="width:30px;margin-left:10px;">Y:</label><input type="text" id="dlY2" value="' +
    Math.round(self.y2) +
    '" style="width:60px;"></div>' +
    '<div class="modal-section-title">Delta (Start = Anchor)</div>' +
    '<div class="modal-row"><label>dX:</label><input type="text" id="dlDX" value="' +
    dx +
    '" style="width:60px;"><label style="width:30px;margin-left:10px;">dY:</label><input type="text" id="dlDY" value="' +
    dy +
    '" style="width:60px;"></div>' +
    '<div class="modal-section-title">Style</div>' +
    '<div class="modal-row"><label>Color:</label><input type="color" id="dlColor" value="' +
    self.lineColor +
    '" style="width:50px;height:24px;cursor:pointer;"></div>' +
    '<div class="modal-row"><label>Thickness:</label><input type="text" id="dlThick" value="' +
    self.lineThickness +
    '" style="width:50px;"></div>' +
    '<div class="modal-row"><label>Style:</label><select id="dlStyle">' +
    '<option value="solid"' +
    (self.lineStyleName === "solid" ? " selected" : "") +
    ">Solid</option>" +
    '<option value="dashed"' +
    (self.lineStyleName === "dashed" ? " selected" : "") +
    ">Dashed</option>" +
    '<option value="dotted"' +
    (self.lineStyleName === "dotted" ? " selected" : "") +
    ">Dotted</option>" +
    '<option value="dashdot"' +
    (self.lineStyleName === "dashdot" ? " selected" : "") +
    ">Dash-Dot</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    self.x1 = parseFloat(document.getElementById("dlX1").value) || 0;
    self.y1 = parseFloat(document.getElementById("dlY1").value) || 0;
    self.x2 = parseFloat(document.getElementById("dlX2").value) || 0;
    self.y2 = parseFloat(document.getElementById("dlY2").value) || 0;
    self.lineColor = document.getElementById("dlColor").value;
    var thick = parseInt(document.getElementById("dlThick").value);
    if (!isNaN(thick) && thick >= 1 && thick <= 20) self.lineThickness = thick;
    var styleName = document.getElementById("dlStyle").value;
    self.lineStyleName = styleName;
    switch (styleName) {
      case "dashed":
        self.lineStyle = "8,4";
        break;
      case "dotted":
        self.lineStyle = "2,3";
        break;
      case "dashdot":
        self.lineStyle = "8,3,2,3";
        break;
      default:
        self.lineStyle = "";
        break;
    }
    self._updateGeometry();
  });

  // Wire up delta fields after modal is shown
  setTimeout(function () {
    var dxEl = document.getElementById("dlDX");
    var dyEl = document.getElementById("dlDY");
    var x1El = document.getElementById("dlX1");
    var y1El = document.getElementById("dlY1");
    var x2El = document.getElementById("dlX2");
    var y2El = document.getElementById("dlY2");
    if (dxEl) {
      dxEl.addEventListener("input", function () {
        var x1 = parseFloat(x1El.value) || 0;
        x2El.value = Math.round(x1 + (parseFloat(this.value) || 0));
      });
    }
    if (dyEl) {
      dyEl.addEventListener("input", function () {
        var y1 = parseFloat(y1El.value) || 0;
        y2El.value = Math.round(y1 + (parseFloat(this.value) || 0));
      });
    }
    // Also update delta when start/end changes
    if (x1El)
      x1El.addEventListener("input", function () {
        dxEl.value = Math.round(
          (parseFloat(x2El.value) || 0) - (parseFloat(this.value) || 0),
        );
      });
    if (y1El)
      y1El.addEventListener("input", function () {
        dyEl.value = Math.round(
          (parseFloat(y2El.value) || 0) - (parseFloat(this.value) || 0),
        );
      });
    if (x2El)
      x2El.addEventListener("input", function () {
        dxEl.value = Math.round(
          (parseFloat(this.value) || 0) - (parseFloat(x1El.value) || 0),
        );
      });
    if (y2El)
      y2El.addEventListener("input", function () {
        dyEl.value = Math.round(
          (parseFloat(this.value) || 0) - (parseFloat(y1El.value) || 0),
        );
      });
  }, 50);
};

DrawLineBlock.prototype.addConnections = function () {};
DrawLineBlock.prototype.Execute = function () {};

DrawLineBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "none";
};

// Show/hide handles on select/deselect
DrawLineBlock.prototype._showHandles = function () {
  this._handle1.style.display = "block";
  this._handle2.style.display = "block";
};
DrawLineBlock.prototype._hideHandles = function () {
  this._handle1.style.display = "none";
  this._handle2.style.display = "none";
};

DrawLineBlock.prototype.removeConnectors = function () {
  this.sheetObject.canvas.removeChild(this.divObj);
  this.sheetObject.canvas.removeChild(this._handle1);
  this.sheetObject.canvas.removeChild(this._handle2);
};

DrawLineBlock.prototype._serializeProps = function (p) {
  p.x1 = this.x1;
  p.y1 = this.y1;
  p.x2 = this.x2;
  p.y2 = this.y2;
  p.lineColor = this.lineColor;
  p.lineThickness = this.lineThickness;
  p.lineStyle = this.lineStyle;
  p.lineStyleName = this.lineStyleName;
};

DrawLineBlock.prototype.serialize = function () {
  return {
    type: this.objectName,
    left: Math.round(this.x1),
    top: Math.round(this.y1),
    props: {
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      lineColor: this.lineColor,
      lineThickness: this.lineThickness,
      lineStyle: this.lineStyle,
      lineStyleName: this.lineStyleName,
    },
    inInversions: [],
    outInversions: [],
  };
};

DrawLineBlock.prototype.applySerializedProps = function (p) {
  // Calculate the offset between the original position and where paste placed us
  var pasteLeft = parseInt(this.divObj.style.left) || 0;
  var pasteTop = parseInt(this.divObj.style.top) || 0;
  var origLeft = p.x1 || 0;
  var origTop = p.y1 || 0;
  var offsetX = pasteLeft - origLeft;
  var offsetY = pasteTop - origTop;

  this.x1 = (p.x1 || 0) + offsetX;
  this.y1 = (p.y1 || 0) + offsetY;
  this.x2 = (p.x2 || 100) + offsetX;
  this.y2 = (p.y2 || 0) + offsetY;
  this.lineColor = p.lineColor || "#000000";
  this.lineThickness = p.lineThickness || 2;
  this.lineStyle = p.lineStyle || "";
  this.lineStyleName = p.lineStyleName || "solid";
  this._updateGeometry();
};

//**************************************************************************
//
//			Define a SNAP BLOCK (magnetic snap point)
//
//**************************************************************************
function SnapBlock() {
  this.objectName = "Snap";
  this.text = "";
  this.divHeight = 14;
  this.divWidth = 14;
}

SnapBlock.prototype = new Base();

SnapBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "transparent";
  this.divObj.style.border = "none";
  this.divObj.style.overflow = "visible";
  this.divObj.style.zIndex = "0";

  // Remove header
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }

  // Draw green X using SVG
  var svgNS = "http://www.w3.org/2000/svg";
  this._svg = document.createElementNS(svgNS, "svg");
  this._svg.setAttribute("width", "14");
  this._svg.setAttribute("height", "14");
  this._svg.style.position = "absolute";
  this._svg.style.left = "0";
  this._svg.style.top = "0";
  this._svg.style.pointerEvents = "none";

  var line1 = document.createElementNS(svgNS, "line");
  line1.setAttribute("x1", "0");
  line1.setAttribute("y1", "0");
  line1.setAttribute("x2", "14");
  line1.setAttribute("y2", "14");
  line1.setAttribute("stroke", "rgb(0,180,0)");
  line1.setAttribute("stroke-width", "2");
  this._svg.appendChild(line1);

  var line2 = document.createElementNS(svgNS, "line");
  line2.setAttribute("x1", "14");
  line2.setAttribute("y1", "0");
  line2.setAttribute("x2", "0");
  line2.setAttribute("y2", "14");
  line2.setAttribute("stroke", "rgb(0,180,0)");
  line2.setAttribute("stroke-width", "2");
  this._svg.appendChild(line2);

  this.divObj.appendChild(this._svg);
};

SnapBlock.prototype.openSettings = function () {
  var self = this;
  var cx = parseInt(self.divObj.style.left) + 7;
  var cy = parseInt(self.divObj.style.top) + 7;
  var html =
    "<h3>Snap Point</h3>" +
    '<div class="modal-row"><label>X:</label>' +
    '<input type="text" id="modalSnapX" value="' +
    cx +
    '" style="width:80px;"></div>' +
    '<div class="modal-row"><label>Y:</label>' +
    '<input type="text" id="modalSnapY" value="' +
    cy +
    '" style="width:80px;"></div>';

  Base.showModal(html, function () {
    var nx = parseInt(document.getElementById("modalSnapX").value);
    var ny = parseInt(document.getElementById("modalSnapY").value);
    if (!isNaN(nx) && !isNaN(ny)) {
      self.divObj.style.left = nx - 7;
      self.divObj.style.top = ny - 7;
      for (var ci = 0; ci < self.inConnections.length; ci++)
        self.inConnections[ci].moveConnector();
      for (var co = 0; co < self.outConnections.length; co++)
        self.outConnections[co].moveConnector();
    }
  });
};

SnapBlock.prototype.addConnections = function () {};
SnapBlock.prototype.Execute = function () {};

SnapBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "none";
};

// Get the snap point (center of the X)
SnapBlock.prototype.getSnapPoint = function () {
  return {
    x: parseInt(this.divObj.style.left) + 7,
    y: parseInt(this.divObj.style.top) + 7,
  };
};

SnapBlock.prototype._serializeProps = function (p) {};
SnapBlock.prototype.applySerializedProps = function (p) {};

//**************************************************************************
//
//			Define a LABEL OUT PANEL BLOCK (DI/AI style - signal goes out right)
//
//**************************************************************************
function LabelOutPanelBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "LabelOutPanel";
  this.text = "";
  this.divHeight = 26;
  this.divWidth = 178;
  this.labelName = "???";
  this.labelType = "bool";
  this.comment = "";
  this.receivedValue = 0;
  this._needsInitialSettings = true;
}

LabelOutPanelBlock.prototype = new Base();

LabelOutPanelBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Small rect left (45px) + large right (133px) — like DI/AI
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;left:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-right:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "LABEL";
  this.divObj.appendChild(this._typeBox);
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:46px;top:0;right:0;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

LabelOutPanelBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.labelName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

LabelOutPanelBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label Out (Panel)</h3>" +
    '<div class="modal-row"><label>Name:</label>' +
    '<input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    self.comment = document.getElementById("modalComment").value || "";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.outConnections.length === 0) {
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.outConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._updateInfoBox();
  });
};

LabelOutPanelBlock.prototype.addConnections = function () {
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    this.labelType,
    (this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real") +
      " - " +
      this.labelName,
  );
};

LabelOutPanelBlock.prototype.Execute = function () {
  this.outConnections[0].value = this.receivedValue;
  if (this.labelType === "bool") {
    if (this.receivedValue) this.divObj.style.border = "2px solid rgb(3,255,3)";
    else this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};

LabelOutPanelBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.labelType = this.labelType;
  p.comment = this.comment;
};
LabelOutPanelBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.labelType = p.labelType || "bool";
  this.comment = p.comment || "";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

//**************************************************************************
//
//			Define a LABEL IN PANEL BLOCK (DO/AQ style - signal goes in left)
//
//**************************************************************************
function LabelInPanelBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "LabelInPanel";
  this.text = "";
  this.divHeight = 26;
  this.divWidth = 178;
  this.labelName = "???";
  this.labelType = "bool";
  this.comment = "";
  this._needsInitialSettings = true;
}

LabelInPanelBlock.prototype = new Base();

LabelInPanelBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Large left (133px) + small right (45px) — like DO/AQ
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:0;top:0;width:132px;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;text-align:left;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;right:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-left:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "LABEL";
  this.divObj.appendChild(this._typeBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

LabelInPanelBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.labelName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

LabelInPanelBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label In (Panel)</h3>" +
    '<div class="modal-row"><label>Name:</label>' +
    '<input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label>' +
    '<input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label>' +
    '<select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    self.comment = document.getElementById("modalComment").value || "";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      self.inConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._updateInfoBox();
  });
};

LabelInPanelBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    this.labelType,
    (this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real") +
      " - " +
      this.labelName,
  );
};

LabelInPanelBlock.prototype.Execute = function () {
  // Find all LabelOutPanelBlocks with matching name and get their value
  var sheet = this.sheetObject;
  for (var i = 0; i < sheet.blockObjects.length; i++) {
    var block = sheet.blockObjects[i];
    if (block.objectName === "LabelInPanel" && block !== this) continue;
    // Actually, LabelInPanel RECEIVES — it reads from its input connector
    // The signal comes through the wire, not through label matching
  }
  // LabelInPanel simply passes input to matching LabelOutPanel blocks
  if (this.inConnections[0] && this.inConnections[0].connectedFrom) {
    var val;
    if (this.labelType === "bool") val = this.inConnections[0].getInputValue();
    else val = this.inConnections[0].connectedFrom.value;
    // Push to all matching LabelOutPanel blocks
    for (var i = 0; i < sheet.blockObjects.length; i++) {
      var block = sheet.blockObjects[i];
      if (
        block.objectName === "LabelOutPanel" &&
        block.labelName === this.labelName
      ) {
        block.receivedValue = val;
      }
    }
  }
  if (this.labelType === "bool") {
    var inputVal = this.inConnections[0].connectedFrom
      ? this.inConnections[0].getInputValue()
      : 0;
    if (inputVal) this.divObj.style.border = "2px solid rgb(3,255,3)";
    else this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};

LabelInPanelBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.labelType = this.labelType;
  p.comment = this.comment;
};
LabelInPanelBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.labelType = p.labelType || "bool";
  this.comment = p.comment || "";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

//**************************************************************************
//
//			Define a JUNCTION (KNOTEN) BLOCK
//
//**************************************************************************
function JunctionBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "Junction";
  this.text = "";
  this.divHeight = 8;
  this.divWidth = 8;
  this.junctionType = "bool";
  this._needsInitialSettings = true;
}

JunctionBlock.prototype = new Base();

JunctionBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  // Override the default block style for junction
  this.divObj.style.borderRadius = "50%";
  this.divObj.style.backgroundColor = "black";
  this.divObj.style.border = "none";
  this.divObj.style.overflow = "visible";
  // Remove header
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings(true);
  }
};

JunctionBlock.prototype.openSettings = function (isNew) {
  var self = this;
  var html =
    "<h3>Junction Einstellungen</h3>" +
    '<div class="modal-row"><label>Datentyp:</label>' +
    '<select id="modalJunctionType">' +
    '<option value="bool"' +
    (self.junctionType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.junctionType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.junctionType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    var newType = document.getElementById("modalJunctionType").value;
    if (!isNew) {
      for (var i = 0; i < self.inConnections.length; i++) {
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      }
      for (var i = 0; i < self.outConnections.length; i++) {
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      }
      self.inConnections = [];
      self.outConnections = [];
    }
    self.junctionType = newType;
    self.addConnections();
    // Update dot color based on type
    if (self.junctionType !== "bool") {
      self.divObj.style.backgroundColor = "rgb(255,172,26)";
    } else {
      self.divObj.style.backgroundColor = "black";
    }
  });
};

JunctionBlock.prototype.addConnections = function () {
  var dt = this.junctionType || "bool";
  var tipLabel = dt === "bool" ? "Bool" : dt === "int" ? "Int" : "Real";
  this.inConnections[0] = new Connector(this, 1, 50, dt, tipLabel + " - Input");
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    dt,
    tipLabel + " - Output",
  );
};

JunctionBlock.prototype.Execute = function () {
  var val;
  if (this.junctionType === "bool") {
    val = this.inConnections[0].getInputValue();
  } else {
    val = this.inConnections[0].connectedFrom
      ? this.inConnections[0].connectedFrom.value
      : 0;
  }
  this.outConnections[0].value = val;
  // Animate dot color during simulation
  if (this.junctionType === "bool") {
    this.divObj.style.backgroundColor = val ? "rgb(3,255,3)" : "rgb(0,0,255)";
  }
};

JunctionBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "none";
  if (this.junctionType !== "bool") {
    this.divObj.style.backgroundColor = "rgb(255,172,26)";
  } else {
    this.divObj.style.backgroundColor = "black";
  }
};

//**************************************************************************
//
//			Define a TAG LABEL OUT (box-style, signal out right, like DI/AI)
//
//**************************************************************************
function TagLabelOutBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "TagLabelOut";
  this.text = "LABEL";
  this.divHeight = 26;
  this.divWidth = 178;
  this.labelName = "???";
  this.comment = "";
  this.labelType = "bool";
  this._needsInitialSettings = true;
}

TagLabelOutBlock.prototype = new Base();

TagLabelOutBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;left:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-right:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "LABEL";
  this.divObj.appendChild(this._typeBox);
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:46px;top:0;right:0;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

TagLabelOutBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.labelName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

TagLabelOutBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label Out Settings</h3>" +
    '<div class="modal-row"><label>Name:</label><input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label><input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label><select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    self.comment = document.getElementById("modalComment").value || "";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.outConnections.length === 0) {
      for (var i = 0; i < self.outConnections.length; i++)
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      self.outConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._updateInfoBox();
  });
};

TagLabelOutBlock.prototype.addConnections = function () {
  var tip =
    this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real";
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    this.labelType,
    tip + " - " + this.labelName,
  );
};

TagLabelOutBlock.prototype.Execute = function () {
  // Receive value from matching TagLabelIn blocks
  this.outConnections[0].value = this._receivedValue || 0;
  if (this.labelType === "bool") {
    if (this.outConnections[0].value)
      this.divObj.style.border = "2px solid rgb(3,255,3)";
    else this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};

TagLabelOutBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.comment = this.comment;
  p.labelType = this.labelType;
};
TagLabelOutBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.comment = p.comment || "";
  this.labelType = p.labelType || "bool";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

//**************************************************************************
//
//			Define a TAG LABEL IN (box-style, signal in left, like DO/AQ)
//
//**************************************************************************
function TagLabelInBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "TagLabelIn";
  this.text = "LABEL";
  this.divHeight = 26;
  this.divWidth = 178;
  this.labelName = "???";
  this.comment = "";
  this.labelType = "bool";
  this._needsInitialSettings = true;
}

TagLabelInBlock.prototype = new Base();

TagLabelInBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.backgroundColor = "white";
  this.divObj.style.overflow = "hidden";
  this.divObj.style.padding = "0";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  this._infoBox = document.createElement("div");
  this._infoBox.style.cssText =
    "position:absolute;left:0;top:0;width:132px;height:100%;padding:1px 4px;font-size:9px;font-family:Calibri,Arial,sans-serif;line-height:1.2;overflow:hidden;display:flex;flex-direction:column;justify-content:center;text-align:left;";
  this._updateInfoBox();
  this.divObj.appendChild(this._infoBox);
  this._typeBox = document.createElement("div");
  this._typeBox.style.cssText =
    "position:absolute;right:0;top:0;width:45px;height:100%;background:rgb(201,203,217);border-left:1px solid black;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;font-family:Calibri,Arial,sans-serif;";
  this._typeBox.innerHTML = "LABEL";
  this.divObj.appendChild(this._typeBox);
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

TagLabelInBlock.prototype._updateInfoBox = function () {
  this._infoBox.innerHTML =
    '<div style="font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    this.labelName +
    "</div>" +
    '<div style="color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' +
    (this.comment || "&nbsp;") +
    "</div>";
};

TagLabelInBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label In Settings</h3>" +
    '<div class="modal-row"><label>Name:</label><input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Comment:</label><input type="text" id="modalComment" value="' +
    self.comment +
    '"></div>' +
    '<div class="modal-row"><label>Data type:</label><select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";
  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    self.comment = document.getElementById("modalComment").value || "";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++)
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      self.inConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._updateInfoBox();
  });
};

TagLabelInBlock.prototype.addConnections = function () {
  var tip =
    this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real";
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    this.labelType,
    tip + " - " + this.labelName,
  );
};

TagLabelInBlock.prototype.Execute = function () {
  // Push value to all matching TagLabelOut blocks
  var sheet = this.sheetObject;
  var val = 0;
  if (this.inConnections[0] && this.inConnections[0].connectedFrom) {
    if (this.labelType === "bool") val = this.inConnections[0].getInputValue();
    else val = this.inConnections[0].connectedFrom.value;
  }
  for (var i = 0; i < sheet.blockObjects.length; i++) {
    var block = sheet.blockObjects[i];
    if (
      block.objectName === "TagLabelOut" &&
      block.labelName === this.labelName
    ) {
      block._receivedValue = val;
    }
  }
  if (this.labelType === "bool") {
    if (val) this.divObj.style.border = "2px solid rgb(3,255,3)";
    else this.divObj.style.border = "2px dashed rgb(0,0,255)";
  }
};

TagLabelInBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.comment = this.comment;
  p.labelType = this.labelType;
};
TagLabelInBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.comment = p.comment || "";
  this.labelType = p.labelType || "bool";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

//**************************************************************************
//
//			Define a JUMP LABEL OUTPUT (Sprungmarke Ausgang)
//          Sends signal to all matching input labels
//
//**************************************************************************
function JumpOutBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "JumpOut";
  this.text = "???";
  this.divHeight = 16;
  this.divWidth = 60;
  this.labelName = "???";
  this.labelType = "bool";
  this._needsInitialSettings = true;
}

JumpOutBlock.prototype = new Base();

JumpOutBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  // Arrow shape: pointing right (signal goes in)
  // Shape like: >______|  (arrow on left, flat on right)
  this.divObj.style.border = "none";
  this.divObj.style.backgroundColor = "transparent";
  this.divObj.style.overflow = "visible";
  // Remove default header
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  // Create SVG arrow shape
  this._createArrowShape();
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

JumpOutBlock.prototype._createArrowShape = function () {
  var w = this.divWidth;
  var h = this.divHeight;
  var arrowW = 12; // arrow point width
  // Arrow pointing right into block: flat right side, arrow left side
  var svgNS = "http://www.w3.org/2000/svg";
  if (this._svgEl) this.divObj.removeChild(this._svgEl);

  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.overflow = "visible";

  var polygon = document.createElementNS(svgNS, "polygon");
  // Shape: arrow from left pointing right, flat right side
  // Points: left-tip, top-left, top-right, bottom-right, bottom-left
  polygon.setAttribute(
    "points",
    "0," +
      h / 2 +
      " " +
      arrowW +
      ",0 " +
      w +
      ",0 " +
      w +
      "," +
      h +
      " " +
      arrowW +
      "," +
      h,
  );
  polygon.setAttribute("fill", "rgb(223,223,231)");
  polygon.setAttribute("stroke", "black");
  polygon.setAttribute("stroke-width", "1");
  svg.appendChild(polygon);

  this._svgEl = svg;
  this.divObj.appendChild(svg);

  // Label text
  if (this._labelEl) this.divObj.removeChild(this._labelEl);
  var label = document.createElement("div");
  label.style.position = "absolute";
  label.style.left = arrowW + 2 + "px";
  label.style.top = "0";
  label.style.width = w - arrowW - 2 + "px";
  label.style.height = h + "px";
  label.style.lineHeight = h + "px";
  label.style.textAlign = "center";
  label.style.fontSize = "10px";
  label.style.fontFamily = "Calibri, Arial, sans-serif";
  label.style.pointerEvents = "none";
  label.innerHTML = this.labelName;
  this._labelEl = label;
  this.divObj.appendChild(label);
};

JumpOutBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label In</h3>" +
    '<div class="modal-row"><label>Name:</label>' +
    '<input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Datentyp:</label>' +
    '<select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.inConnections.length === 0) {
      for (var i = 0; i < self.inConnections.length; i++) {
        if (self.inConnections[i]) self.inConnections[i].removeConnectedTo();
      }
      self.inConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._labelEl.innerHTML = self.labelName;
  });
};

JumpOutBlock.prototype.addConnections = function () {
  this.inConnections[0] = new Connector(
    this,
    1,
    50,
    this.labelType,
    (this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real") +
      " - " +
      this.labelName,
  );
};

JumpOutBlock.prototype.Execute = function () {
  var sheet = this.sheetObject;
  for (var i = 0; i < sheet.blockObjects.length; i++) {
    var block = sheet.blockObjects[i];
    if (block.objectName === "JumpIn" && block.labelName === this.labelName) {
      if (this.inConnections[0] && this.inConnections[0].connectedFrom) {
        if (this.labelType === "bool") {
          block.receivedValue = this.inConnections[0].getInputValue();
        } else {
          block.receivedValue = this.inConnections[0].connectedFrom.value;
        }
      }
    }
  }

  if (this.labelType === "bool") {
    var val = this.inConnections[0].connectedFrom
      ? this.inConnections[0].getInputValue()
      : 0;
    var polygon = this._svgEl.querySelector("polygon");
    if (val) {
      polygon.setAttribute("stroke", "rgb(3,255,3)");
      polygon.setAttribute("stroke-width", "2");
    } else {
      polygon.setAttribute("stroke", "rgb(0,0,255)");
      polygon.setAttribute("stroke-width", "2");
      polygon.setAttribute("stroke-dasharray", "4,2");
    }
  }
};

JumpOutBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "none";
  var polygon = this._svgEl.querySelector("polygon");
  polygon.setAttribute("stroke", "black");
  polygon.setAttribute("stroke-width", "1");
  polygon.removeAttribute("stroke-dasharray");
};

//**************************************************************************
//
//			Define a JUMP LABEL INPUT (Sprungmarke Eingang)
//          Receives signal from matching output labels
//
//**************************************************************************
function JumpInBlock() {
  this._handlesOwnConnectors = true;
  this.objectName = "JumpIn";
  this.text = "???";
  this.divHeight = 16;
  this.divWidth = 60;
  this.labelName = "???";
  this.labelType = "bool";
  this.receivedValue = 0;
  this._needsInitialSettings = true;
}

JumpInBlock.prototype = new Base();

JumpInBlock.prototype.create = function (sheet, t, l) {
  Base.prototype.create.call(this, sheet, t, l);
  this.divObj.style.border = "none";
  this.divObj.style.backgroundColor = "transparent";
  this.divObj.style.overflow = "visible";
  if (this.headerDiv) {
    this.divObj.removeChild(this.headerDiv);
    this.headerDiv = null;
  }
  this._createArrowShape();
  if (this._needsInitialSettings) {
    this._needsInitialSettings = false;
    this.openSettings();
  }
};

JumpInBlock.prototype._createArrowShape = function () {
  var w = this.divWidth;
  var h = this.divHeight;
  var arrowW = 12;
  var svgNS = "http://www.w3.org/2000/svg";
  if (this._svgEl) this.divObj.removeChild(this._svgEl);

  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.overflow = "visible";

  var polygon = document.createElementNS(svgNS, "polygon");
  // Shape: flat left side, arrow pointing right
  // Points: top-left, top-right, right-tip, bottom-right, bottom-left
  polygon.setAttribute(
    "points",
    "0,0 " +
      (w - arrowW) +
      ",0 " +
      w +
      "," +
      h / 2 +
      " " +
      (w - arrowW) +
      "," +
      h +
      " 0," +
      h,
  );
  polygon.setAttribute("fill", "rgb(223,223,231)");
  polygon.setAttribute("stroke", "black");
  polygon.setAttribute("stroke-width", "1");
  svg.appendChild(polygon);

  this._svgEl = svg;
  this.divObj.appendChild(svg);

  if (this._labelEl) this.divObj.removeChild(this._labelEl);
  var label = document.createElement("div");
  label.style.position = "absolute";
  label.style.left = "2px";
  label.style.top = "0";
  label.style.width = w - arrowW - 2 + "px";
  label.style.height = h + "px";
  label.style.lineHeight = h + "px";
  label.style.textAlign = "center";
  label.style.fontSize = "10px";
  label.style.fontFamily = "Calibri, Arial, sans-serif";
  label.style.pointerEvents = "none";
  label.innerHTML = this.labelName;
  this._labelEl = label;
  this.divObj.appendChild(label);
};

JumpInBlock.prototype.openSettings = function () {
  var self = this;
  var html =
    "<h3>Label Out</h3>" +
    '<div class="modal-row"><label>Name:</label>' +
    '<input type="text" id="modalLabelName" value="' +
    self.labelName +
    '"></div>' +
    '<div class="modal-row"><label>Datentyp:</label>' +
    '<select id="modalLabelType">' +
    '<option value="bool"' +
    (self.labelType === "bool" ? " selected" : "") +
    ">Bool</option>" +
    '<option value="int"' +
    (self.labelType === "int" ? " selected" : "") +
    ">Int</option>" +
    '<option value="real"' +
    (self.labelType === "real" ? " selected" : "") +
    ">Real</option>" +
    "</select></div>";

  Base.showModal(html, function () {
    self.labelName = document.getElementById("modalLabelName").value || "???";
    var newType = document.getElementById("modalLabelType").value;
    if (newType !== self.labelType || self.outConnections.length === 0) {
      for (var i = 0; i < self.outConnections.length; i++) {
        if (self.outConnections[i])
          self.outConnections[i].removeConnectedFrom();
      }
      self.outConnections = [];
      self.labelType = newType;
      self.addConnections();
    }
    self._labelEl.innerHTML = self.labelName;
  });
};

JumpInBlock.prototype.addConnections = function () {
  this.outConnections[0] = new Connector(
    this,
    0,
    50,
    this.labelType,
    (this.labelType === "bool"
      ? "Bool"
      : this.labelType === "int"
        ? "Int"
        : "Real") +
      " - " +
      this.labelName,
  );
};

JumpInBlock.prototype.Execute = function () {
  this.outConnections[0].value = this.receivedValue;

  if (this.labelType === "bool") {
    var polygon = this._svgEl.querySelector("polygon");
    if (this.receivedValue) {
      polygon.setAttribute("stroke", "rgb(3,255,3)");
      polygon.setAttribute("stroke-width", "2");
      polygon.removeAttribute("stroke-dasharray");
    } else {
      polygon.setAttribute("stroke", "rgb(0,0,255)");
      polygon.setAttribute("stroke-width", "2");
      polygon.setAttribute("stroke-dasharray", "4,2");
    }
  }
};

JumpInBlock.prototype.resetStyle = function () {
  this.divObj.style.border = "none";
  var polygon = this._svgEl.querySelector("polygon");
  polygon.setAttribute("stroke", "black");
  polygon.setAttribute("stroke-width", "1");
  polygon.removeAttribute("stroke-dasharray");
};

// ========== SERIALIZATION OVERRIDES ==========

// --- AND ---
AndBlock.prototype._serializeProps = function (p) {
  p.numberInputs = this.numberInputs;
};
AndBlock.prototype.applySerializedProps = function (p) {
  this.numberInputs = p.numberInputs || 2;
  this._applyInputCount(this.numberInputs);
  // Rebuild connectors
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- OR ---
OrBlock.prototype._serializeProps = function (p) {
  p.numberInputs = this.numberInputs;
};
OrBlock.prototype.applySerializedProps = function (p) {
  this.numberInputs = p.numberInputs || 2;
  this._applyInputCount(this.numberInputs);
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- XOR ---
XorBlock.prototype._serializeProps = function (p) {
  p.numberInputs = this.numberInputs;
};
XorBlock.prototype.applySerializedProps = function (p) {
  this.numberInputs = p.numberInputs || 2;
  this._applyInputCount(this.numberInputs);
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- DI ---
DiBlock.prototype._serializeProps = function (p) {
  p.tagName = this.tagName;
  p.comment = this.comment;
  p.keySet = this.keySet;
  p.keyReset = this.keyReset;
  p.keyNormal = this.keyNormal;
};
DiBlock.prototype.applySerializedProps = function (p) {
  this.tagName = p.tagName || "tagname";
  this.comment = p.comment || "";
  this.keySet = p.keySet || "";
  this.keyReset = p.keyReset || "";
  this.keyNormal = p.keyNormal || "";
  if (this._infoBox) this._updateInfoBox();
};

// --- DO ---
DoBlock.prototype._serializeProps = function (p) {
  p.tagName = this.tagName;
  p.comment = this.comment;
};
DoBlock.prototype.applySerializedProps = function (p) {
  this.tagName = p.tagName || "tagname";
  this.comment = p.comment || "";
  if (this._infoBox) this._updateInfoBox();
};

// --- Constant ---
ConstantBlock.prototype._serializeProps = function (p) {
  p.constantValue = this.constantValue;
};
ConstantBlock.prototype.applySerializedProps = function (p) {
  this.constantValue = p.constantValue || 0;
  this.headerDiv.innerHTML = this.constantValue;
};

// --- AI ---
AiBlock.prototype._serializeProps = function (p) {
  p.tagName = this.tagName;
  p.comment = this.comment;
  p.rawValue = this.rawValue;
  p.aiDataType = this.aiDataType;
};
AiBlock.prototype.applySerializedProps = function (p) {
  this.tagName = p.tagName || "AI";
  this.comment = p.comment || "";
  this.rawValue = p.rawValue || 0;
  this.aiDataType = p.aiDataType || "int";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- AQ ---
AqBlock.prototype._serializeProps = function (p) {
  p.tagName = this.tagName;
  p.comment = this.comment;
  p.aqDataType = this.aqDataType;
};
AqBlock.prototype.applySerializedProps = function (p) {
  this.tagName = p.tagName || "AQ";
  this.comment = p.comment || "";
  this.aqDataType = p.aqDataType || "int";
  if (this._infoBox) this._updateInfoBox();
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- LIMIT ---
LimitBlock.prototype._serializeProps = function (p) {
  p.limitDataType = this.limitDataType;
};
LimitBlock.prototype.applySerializedProps = function (p) {
  this.limitDataType = p.limitDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- MOVE ---
MoveBlock.prototype._serializeProps = function (p) {
  p.moveDataType = this.moveDataType;
};
MoveBlock.prototype.applySerializedProps = function (p) {
  this.moveDataType = p.moveDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- REAL_TO_INT ---
RealToIntBlock.prototype._serializeProps = function (p) {
  p.roundMode = this.roundMode;
};
RealToIntBlock.prototype.applySerializedProps = function (p) {
  this.roundMode = p.roundMode || "round";
  var modeChar =
    this.roundMode === "round" ? "R" : this.roundMode === "floor" ? "F" : "C";
  this.headerDiv.innerHTML = "REAL_TO_INT (" + modeChar + ")";
};

// --- MUX ---
MuxBlock.prototype._serializeProps = function (p) {
  p.numInputs = this.numInputs;
  p.muxDataType = this.muxDataType;
};
MuxBlock.prototype.applySerializedProps = function (p) {
  this.numInputs = p.numInputs || 2;
  this.muxDataType = p.muxDataType || "real";
  this.divHeight = 80 + Math.max(0, (this.numInputs - 2) * 20);
  this.divObj.style.height = this.divHeight;
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
  this._buildLabels();
};

// --- DEMUX ---
DemuxBlock.prototype._serializeProps = function (p) {
  p.numOutputs = this.numOutputs;
  p.demuxDataType = this.demuxDataType;
};
DemuxBlock.prototype.applySerializedProps = function (p) {
  this.numOutputs = p.numOutputs || 2;
  this.demuxDataType = p.demuxDataType || "real";
  this.divHeight = 80 + Math.max(0, (this.numOutputs - 2) * 20);
  this.divObj.style.height = this.divHeight;
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
  this._buildLabels();
};

// --- IN_RANGE ---
InRangeBlock.prototype._serializeProps = function (p) {
  p.rangeDataType = this.rangeDataType;
};
InRangeBlock.prototype.applySerializedProps = function (p) {
  this.rangeDataType = p.rangeDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- OUT_OF_RANGE ---
OutOfRangeBlock.prototype._serializeProps = function (p) {
  p.rangeDataType = this.rangeDataType;
};
OutOfRangeBlock.prototype.applySerializedProps = function (p) {
  this.rangeDataType = p.rangeDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- CMP ---
CmpBlock.prototype._serializeProps = function (p) {
  p.cmpMode = this.cmpMode;
  p.cmpDataType = this.cmpDataType;
};
CmpBlock.prototype.applySerializedProps = function (p) {
  this.cmpMode = p.cmpMode || "==";
  this.cmpDataType = p.cmpDataType || "real";
  this.headerDiv.innerHTML = "CMP " + this.cmpMode;
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- ADD/SUB/MUL/DIV ---
AddBlock.prototype._serializeProps = function (p) {
  p.mathDataType = this.mathDataType;
};
AddBlock.prototype.applySerializedProps = function (p) {
  this.mathDataType = p.mathDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};
SubtractBlock.prototype._serializeProps = function (p) {
  p.mathDataType = this.mathDataType;
};
SubtractBlock.prototype.applySerializedProps = function (p) {
  this.mathDataType = p.mathDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};
MultiplyBlock.prototype._serializeProps = function (p) {
  p.mathDataType = this.mathDataType;
};
MultiplyBlock.prototype.applySerializedProps = function (p) {
  this.mathDataType = p.mathDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};
DivideBlock.prototype._serializeProps = function (p) {
  p.mathDataType = this.mathDataType;
};
DivideBlock.prototype.applySerializedProps = function (p) {
  this.mathDataType = p.mathDataType || "real";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- Junction ---
JunctionBlock.prototype._serializeProps = function (p) {
  p.junctionType = this.junctionType;
};
JunctionBlock.prototype.applySerializedProps = function (p) {
  this.junctionType = p.junctionType || "bool";
  if (this.junctionType !== "bool")
    this.divObj.style.backgroundColor = "rgb(255,172,26)";
  else this.divObj.style.backgroundColor = "black";
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- JumpOut (Label In) ---
JumpOutBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.labelType = this.labelType;
};
JumpOutBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.labelType = p.labelType || "bool";
  if (this._labelEl) this._labelEl.innerHTML = this.labelName;
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};

// --- JumpIn (Label Out) ---
JumpInBlock.prototype._serializeProps = function (p) {
  p.labelName = this.labelName;
  p.labelType = this.labelType;
};
JumpInBlock.prototype.applySerializedProps = function (p) {
  this.labelName = p.labelName || "???";
  this.labelType = p.labelType || "bool";
  if (this._labelEl) this._labelEl.innerHTML = this.labelName;
  this.inConnections = [];
  this.outConnections = [];
  this.addConnections();
};
