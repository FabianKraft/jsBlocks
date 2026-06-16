///////////////////////////////////////////////////////////
//
//		Main Connector Object
//		Copyright 2007 Shawn Summey (original author)
//		Copyright 2026 Fabian Kraft (current maintainer)
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

function Connector(obj, type, number, dataType, tooltip) {
  this.instruction = obj; //instruction object connector is connected to
  var thisConnector = this;
  this.pinLocation = number;
  this.type = type;
  this.dataType = dataType || "bool";
  this.tooltip = tooltip || "";
  this.value = 0;
  this.inverted = false;
  this.connectorX = 0;
  this.connectorY = 0;
  this.connectorHeight = 1;
  this.connectorWidth = 10;
  this.isConnected = 0;

  // Default color based on data type
  this.defaultColor = this.dataType === "bool" ? "black" : "rgb(255,172,26)";

  //New connector references
  //connectedTo (Outputs) can be connected to multiple
  //input pins. A connectedFrom (Inputs) can have only one
  //line connected to it.
  this.connectedTo = [];
  this.connectedToIndex = 0;
  this.connectedFrom = null;

  //The one and only lines object for input pins.
  //The line object belongs to the Input Connector
  //object. Output pin theLine variable is always
  //null
  this.theLine = null;

  this.calcConnector(this.pinLocation);

  // Visible connector line (thin horizontal stroke)
  this.theConnector = document.createElement("div");
  this.theConnector.style.position = "absolute";
  this.theConnector.style.top = this.connectorY;
  this.theConnector.style.left = this.connectorX;
  this.theConnector.style.height = this.connectorHeight;
  this.theConnector.style.width = this.connectorWidth;
  this.theConnector.style.backgroundColor = this.defaultColor;
  this.theConnector.style.fontSize = "1";
  this.theConnector.style.pointerEvents = "none";
  this.instruction.sheetObject.canvas.appendChild(this.theConnector);

  // Inversion circle (hidden by default)
  this.invertCircle = document.createElement("div");
  this.invertCircle.style.position = "absolute";
  this.invertCircle.style.width = "5px";
  this.invertCircle.style.height = "5px";
  this.invertCircle.style.borderRadius = "50%";
  this.invertCircle.style.border = "1px solid black";
  this.invertCircle.style.backgroundColor = "rgb(255,255,255)";
  this.invertCircle.style.display = "none";
  this.invertCircle.style.pointerEvents = "none";
  this.invertCircle.style.zIndex = "1";
  this.instruction.sheetObject.canvas.appendChild(this.invertCircle);
  this._positionInvertCircle();

  // Invisible hitbox for easier clicking and tooltip
  this.hitbox = document.createElement("div");
  this.hitbox.style.position = "absolute";
  this.hitbox.style.top = this.connectorY - 5;
  this.hitbox.style.left = this.connectorX;
  this.hitbox.style.height = 12;
  this.hitbox.style.width = this.connectorWidth;
  this.hitbox.style.backgroundColor = "transparent";
  this.hitbox.style.cursor = "crosshair";
  this.hitbox.style.zIndex = "2";
  if (this.tooltip) {
    this.hitbox.title = this.tooltip;
  }
  this.instruction.sheetObject.canvas.appendChild(this.hitbox);

  this.hitbox.addEventListener(
    "mousedown",
    function (e) {
      thisConnector.clickHandler(e);
    },
    true,
  );
  this.hitbox.addEventListener(
    "mouseup",
    function (e) {
      thisConnector.mouseupHandler(e);
    },
    true,
  );
  this.hitbox.addEventListener(
    "dblclick",
    function (e) {
      thisConnector.dblclickHandler(e);
      e.stopPropagation();
    },
    true,
  );
}
Connector.prototype.calcConnector = function (pinNo) {
  var blockLeft = parseFloat(this.instruction.divObj.style.left) || 0;
  var blockTop = parseFloat(this.instruction.divObj.style.top) || 0;
  var blockHeight = parseFloat(this.instruction.divObj.style.height) || 0;
  var blockWidth = parseFloat(this.instruction.divObj.style.width) || 0;

  if (this.type == 1) {
    this.connectorX = Math.round(blockLeft - this.connectorWidth);
    this.connectorY = Math.round(blockTop + (pinNo / 100) * blockHeight);
  } else if (this.type == 0) {
    this.connectorX = Math.round(blockLeft + blockWidth + 2);
    this.connectorY = Math.round(blockTop + (pinNo / 100) * blockHeight);
  } else {
    alert("Error: no associated connector type!");
  }
};
Connector.prototype.moveConnector = function () {
  this.calcConnector(this.pinLocation);
  this.theConnector.style.top = this.connectorY;
  this.theConnector.style.left = this.connectorX;
  this.hitbox.style.top = this.connectorY - 5;
  this.hitbox.style.left = this.connectorX;
  this._positionInvertCircle();
  if (this.connectedFrom != null) this.theLine.connectTo();

  if (this.connectedTo.length > 0) {
    for (var i = 0; i < this.connectedTo.length; i++)
      this.connectedTo[i].theLine.connectTo();
  }
};

Connector.prototype._positionInvertCircle = function () {
  // Total circle size: 5px content + 1px border * 2 = 7px
  var circleSize = 7;
  if (this.type == 1) {
    // Input connector is on the left side of the block
    // Circle goes further left (outward), inner edge touches connector end
    this.invertCircle.style.left =
      this.connectorX + this.connectorWidth - circleSize + "px";
  } else {
    // Output connector is on the right side of the block
    // Circle goes further right (outward), inner edge touches connector start
    this.invertCircle.style.left = this.connectorX + "px";
  }
  // Center vertically on the 1px connector line
  this.invertCircle.style.top =
    this.connectorY - Math.floor(circleSize / 2) + "px";
};

Connector.prototype.dblclickHandler = function (e) {
  // Clean up any connection drag state
  this.instruction.sheetObject.currentConnector = null;
  this.instruction.sheetObject.stopDragPreview();

  if (this.dataType !== "bool") return;
  if (this.instruction.sheetObject.simulateOn) return;
  this.inverted = !this.inverted;
  this.invertCircle.style.display = this.inverted ? "block" : "none";
};

Connector.prototype.getEffectiveValue = function () {
  // Returns the value after applying inversion
  if (this.inverted) {
    return this.value ? 0 : 1;
  }
  return this.value;
};

Connector.prototype.getInputValue = function () {
  // For input connectors: get the value from connected output,
  // apply output inversion, then apply own inversion
  if (this.connectedFrom == null) return this.inverted ? 1 : 0;
  var val = this.connectedFrom.getEffectiveValue();
  if (this.inverted) val = val ? 0 : 1;
  return val;
};
Connector.prototype.clickHandler = function (e) {
  if (this.type == 0 || this.type == 2) {
    this.instruction.sheetObject.turnOffSelect();
    this.instruction.sheetObject.currentConnector = this;
    this.instruction.sheetObject.startDragPreview(this, e);
  }
};
Connector.prototype.mouseupHandler = function (e) {
  if (this.instruction.sheetObject.currentConnector != null) {
    if (this.instruction.sheetObject.currentConnector == this) {
      // Self-connect: silently ignore (happens on dblclick)
    } else if (this.instruction.sheetObject.currentConnector.type == this.type)
      alert("Error connecting: Cannot connect two outputs together!");
    else if (this.connectedFrom != null)
      alert("Error connecting: Input connector already connected!");
    else {
      this.theLine = new LineObject(
        this,
        this.instruction.sheetObject.currentConnector,
      );
      this.theLine.connectTo();
      this.instruction.sheetObject.currentConnector.addConnector(this);
      this.connectedFrom = this.instruction.sheetObject.currentConnector;
    }
  }
  this.instruction.sheetObject.currentConnector = null;
  this.instruction.sheetObject.stopDragPreview();

  if (document.selection) document.selection.empty();
};

Connector.prototype.addConnector = function (obj) {
  this.connectedTo[this.connectedToIndex] = obj;
  this.connectedToIndex++;
  if (this.connectedToIndex > 0) this.isConnected = 1;
  else this.isConnected = 0;
};

Connector.prototype.removeConnectedTo = function () {
  //Input pins call this function to notify output
  //pin that it is being deleted and then sets
  //itself to null
  var removeIndex = -1;
  if (this.connectedFrom != null) {
    for (var i = 0; i < this.connectedFrom.connectedTo.length; i++) {
      if (this.connectedFrom.connectedTo[i] == this) {
        removeIndex = i;
      }
    }
  }
  if (removeIndex >= 0) {
    this.connectedFrom.connectedTo.splice(removeIndex, 1);
    this.connectedFrom.connectedToIndex--;
    this.theLine.removeLine();
    delete this.theLine;
  }
  this.connectedFrom = null;
  this.instruction.sheetObject.canvas.removeChild(this.theConnector);
  this.instruction.sheetObject.canvas.removeChild(this.hitbox);
  this.instruction.sheetObject.canvas.removeChild(this.invertCircle);
};

Connector.prototype.removeConnectedFrom = function () {
  //Output pins call this function to notify input
  //pins that it is being deleted.
  if (this.connectedTo.length > 0) {
    for (var i = 0; i < this.connectedTo.length; i++) {
      this.connectedTo[i].theLine.removeLine();
      this.connectedTo[i].connectedFrom = null;
    }
  }
  this.instruction.sheetObject.canvas.removeChild(this.theConnector);
  this.instruction.sheetObject.canvas.removeChild(this.hitbox);
  this.instruction.sheetObject.canvas.removeChild(this.invertCircle);
};
