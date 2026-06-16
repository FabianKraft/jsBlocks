///////////////////////////////////////////////////////////
//
//		Main Line Object
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
//////////////////////////////////////////////////////////

function LineObject(toObj, fromObj) {
  this.toConnectorObj = toObj; // Input pin (left side of block)
  this.fromConnectorObj = fromObj; // Output pin (right side of block)
  this.connectLines = [];
  this.delaySymbol = null;
  // Use the output connector's default color
  this.currentColor = fromObj.defaultColor || "black";
}

LineObject.prototype._createSegment = function (isVertical) {
  var seg = document.createElement("div");
  var thisLine = this;
  seg.style.position = "absolute";
  seg.style.fontSize = "1";
  seg.style.backgroundColor = this.currentColor;
  seg.style.zIndex = "0";
  seg.style.cursor = "pointer";
  seg.className = "line-seg";
  if (isVertical) {
    seg.style.width = 1;
  } else {
    seg.style.height = 1;
  }
  seg.addEventListener(
    "click",
    function (e) {
      thisLine.clickHandler(e);
      e.stopPropagation();
    },
    true,
  );
  this.toConnectorObj.instruction.sheetObject.canvas.appendChild(seg);
  return seg;
};

LineObject.prototype._clearSegments = function () {
  for (var i = 0; i < this.connectLines.length; i++) {
    this.toConnectorObj.instruction.sheetObject.canvas.removeChild(
      this.connectLines[i],
    );
  }
  this.connectLines = [];
};

LineObject.prototype._hSeg = function (x, y, width) {
  var seg = this._createSegment(false);
  var startX = width >= 0 ? x : x + width;
  var endX = width >= 0 ? x + width : x;
  seg.style.left = Math.floor(startX);
  seg.style.top = Math.floor(y);
  seg.style.width = Math.max(Math.ceil(endX) - Math.floor(startX), 1);
  this.connectLines.push(seg);
};

LineObject.prototype._vSeg = function (x, y, height) {
  var seg = this._createSegment(true);
  var startY = height >= 0 ? y : y + height;
  var endY = height >= 0 ? y + height : y;
  seg.style.left = Math.floor(x);
  seg.style.top = Math.floor(startY);
  seg.style.height = Math.max(Math.ceil(endY) - Math.floor(startY), 1);
  this.connectLines.push(seg);
};

LineObject.prototype._createDelaySymbol = function () {
  var sheet = this.toConnectorObj.instruction.sheetObject;
  var sym = document.createElement("div");
  sym.style.position = "absolute";
  sym.style.width = "8px";
  sym.style.height = "8px";
  sym.style.backgroundColor = "#ff6b35";
  sym.style.transform = "rotate(45deg)";
  sym.style.zIndex = "1";
  sym.style.pointerEvents = "none";
  sym.style.borderRadius = "1px";
  sym.style.marginLeft = "-4px";
  sym.style.marginTop = "-4px";
  sym.style.display = "none";
  sheet.canvas.appendChild(sym);
  this.delaySymbol = sym;
};

LineObject.prototype._updateDelaySymbol = function () {
  if (!this.delaySymbol) return;

  var sheet = this.toConnectorObj.instruction.sheetObject;
  if (!sheet.delaySymbolVisible) {
    this.delaySymbol.style.display = "none";
    return;
  }

  var fromBlock = this.fromConnectorObj.instruction;
  var toBlock = this.toConnectorObj.instruction;

  // Delay: output executes after or at same time as input → stale data or self-loop
  var hasDelay = fromBlock.indexNumber >= toBlock.indexNumber;

  this.delaySymbol.style.display = hasDelay ? "block" : "none";
};

LineObject.prototype.connectTo = function () {
  this._clearSegments();

  // From = output pin (right side), To = input pin (left side)
  var fromX =
    parseFloat(this.fromConnectorObj.theConnector.style.left) +
    this.fromConnectorObj.connectorWidth;
  var fromY = parseFloat(this.fromConnectorObj.theConnector.style.top);
  var toX = parseFloat(this.toConnectorObj.theConnector.style.left);
  var toY = parseFloat(this.toConnectorObj.theConnector.style.top);

  var stub = 20;
  var midX = 0,
    midY = 0;

  var sheet = this.toConnectorObj.instruction.sheetObject;
  var snapToGrid = sheet && sheet.snapLinesToGrid;
  var gridSize = sheet ? sheet.gridSize : 10;

  // Grid-snap helpers
  var snapRight = function (x) {
    return Math.ceil(x / gridSize) * gridSize;
  };
  var snapLeft = function (x) {
    return Math.floor(x / gridSize) * gridSize;
  };
  var snapY = function (y) {
    return Math.round(y / gridSize) * gridSize;
  };

  if (toX - fromX >= stub * 2) {
    // Normal case: To is to the right of From
    if (snapToGrid) {
      // Route along grid lines:
      // 1. Horizontal from output → next grid line to the right
      // 2. Vertical along that grid line → input's exact Y (pin position)
      // 3. Horizontal from grid line → input pin
      var gridX = snapRight(fromX);
      // Ensure gridX stays between fromX and toX
      if (gridX >= toX) gridX = toX; // fallback: straight H line

      this._hSeg(fromX, fromY, gridX - fromX);
      this._vSeg(gridX, fromY, toY - fromY);
      this._hSeg(gridX, toY, toX - gridX);
      midX = gridX;
      midY = (fromY + toY) / 2;
    } else {
      // 3 segments: horizontal - vertical - horizontal (Z-shape)
      var midSegX = fromX + (toX - fromX) / 2;
      midX = midSegX;
      midY = (fromY + toY) / 2;

      this._hSeg(fromX, fromY, midSegX - fromX);
      this._vSeg(midSegX, fromY, toY - fromY);
      this._hSeg(midSegX, toY, toX - midSegX);
    }
  } else {
    // Reverse case: From is at or to the right of To
    if (snapToGrid) {
      // Grid-snapped reverse routing:
      // 1. H right from output → next grid line
      // 2. V along that grid line → bypass Y (above/below both blocks, snapped to grid)
      // 3. H left along bypass grid line → grid line left of input
      // 4. V → input's exact Y (pin)
      // 5. H right → input pin
      var fromBlockBottom =
        parseFloat(this.fromConnectorObj.instruction.divObj.style.top) +
        parseFloat(this.fromConnectorObj.instruction.divObj.style.height);
      var fromBlockTop = parseFloat(
        this.fromConnectorObj.instruction.divObj.style.top,
      );
      var toBlockBottom =
        parseFloat(this.toConnectorObj.instruction.divObj.style.top) +
        parseFloat(this.toConnectorObj.instruction.divObj.style.height);
      var toBlockTop = parseFloat(
        this.toConnectorObj.instruction.divObj.style.top,
      );

      // Choose bypass direction based on relative block heights:
      // - If input block is higher (above) → route just above output, then continue up to input
      // - If output block is higher (above) → route just below output, then continue down to input
      var gridY =
        toBlockTop < fromBlockTop
          ? snapY(fromBlockTop - 20) // input is higher → clear output going up
          : snapY(fromBlockBottom + 20); // output is higher → clear output going down

      var rightGridX = snapRight(fromX + stub);
      var leftGridX = snapLeft(toX - stub);
      if (leftGridX < 0) leftGridX = 0;

      midX = (rightGridX + leftGridX) / 2;
      midY = gridY;

      this._hSeg(fromX, fromY, rightGridX - fromX);
      this._vSeg(rightGridX, fromY, gridY - fromY);
      this._hSeg(rightGridX, gridY, leftGridX - rightGridX);
      this._vSeg(leftGridX, gridY, toY - gridY);
      this._hSeg(leftGridX, toY, toX - leftGridX);
    } else {
      // Original reverse case
      var fromBlockBottom =
        parseFloat(this.fromConnectorObj.instruction.divObj.style.top) +
        parseFloat(this.fromConnectorObj.instruction.divObj.style.height);
      var fromBlockTop = parseFloat(
        this.fromConnectorObj.instruction.divObj.style.top,
      );
      var toBlockBottom =
        parseFloat(this.toConnectorObj.instruction.divObj.style.top) +
        parseFloat(this.toConnectorObj.instruction.divObj.style.height);
      var toBlockTop = parseFloat(
        this.toConnectorObj.instruction.divObj.style.top,
      );

      var rightX = fromX + stub;
      var leftX = toX - stub;

      // Choose bypass direction: clear only the output block
      var bypassY =
        toBlockTop < fromBlockTop
          ? fromBlockTop - 20 // input is higher → clear output going up
          : fromBlockBottom + 20; // output is higher → clear output going down

      midX = (rightX + leftX) / 2;
      midY = bypassY;

      this._hSeg(fromX, fromY, stub);
      this._vSeg(rightX, fromY, bypassY - fromY);
      this._hSeg(rightX, bypassY, leftX - rightX);
      this._vSeg(leftX, bypassY, toY - bypassY);
      this._hSeg(leftX, toY, stub);
    }
  }

  // --- Delay symbol: create if needed, then position ---
  if (!this.delaySymbol) {
    this._createDelaySymbol();
  }
  this.delaySymbol.style.left = midX + "px";
  this.delaySymbol.style.top = midY + "px";
  this._updateDelaySymbol();
};

LineObject.prototype.removeLine = function () {
  for (var i = 0; i < this.connectLines.length; i++) {
    this.toConnectorObj.instruction.sheetObject.canvas.removeChild(
      this.connectLines[i],
    );
  }
  this.connectLines = [];

  // Remove delay symbol
  if (this.delaySymbol && this.delaySymbol.parentNode) {
    this.delaySymbol.parentNode.removeChild(this.delaySymbol);
    this.delaySymbol = null;
  }
};

LineObject.prototype.changeColor = function (color) {
  this.currentColor = color;
  for (var i = 0; i < this.connectLines.length; i++) {
    this.connectLines[i].style.backgroundColor = color;
  }
};

LineObject.prototype.clickHandler = function (e) {
  var sheet = this.toConnectorObj.instruction.sheetObject;
  sheet.lineSelected(this, e.shiftKey);
};

LineObject.prototype.select = function () {
  for (var i = 0; i < this.connectLines.length; i++) {
    this.connectLines[i].style.backgroundColor = "red";
  }
};

LineObject.prototype.deselect = function () {
  for (var i = 0; i < this.connectLines.length; i++) {
    this.connectLines[i].style.backgroundColor = this.currentColor;
  }
};

LineObject.prototype.deleteLine = function () {
  // Get the input connector (toConnectorObj owns this line)
  var inputConn = this.toConnectorObj;
  var outputConn = this.fromConnectorObj;

  // Remove this input connector from the output's connectedTo array
  for (var i = 0; i < outputConn.connectedTo.length; i++) {
    if (outputConn.connectedTo[i] === inputConn) {
      outputConn.connectedTo.splice(i, 1);
      outputConn.connectedToIndex--;
      break;
    }
  }
  if (outputConn.connectedTo.length == 0) {
    outputConn.isConnected = 0;
  }

  // Clear the input connector's reference
  inputConn.connectedFrom = null;
  inputConn.theLine = null;

  // Remove visual segments
  this.removeLine();
};
