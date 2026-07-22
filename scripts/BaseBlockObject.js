///////////////////////////////////////////////////////////
//
//		Main Block Object
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

//**************************************************************************
//
//			Define a BASE BLOCK
//
//**************************************************************************
function Base() {
  this.divObj = null;
  this.divHeight = 80;
  this.divWidth = 60;
  this.text = "BLOCK";
  this.offsetX = 0;
  this.offsetY = 0;
  this.captured = 0;
  this.sheetObject = null;
  this.hasMoved = 0;
  this.indexNumber = 0;
}
Base.prototype.create = function (sheet, t, l) {
  var current = this;
  this.sheetObject = sheet;
  this.indexNumber = this.sheetObject.blockIndex;

  this.inConnections = [];
  this.outConnections = [];

  this.divObj = document.createElement("div");
  this.divObj.style.position = "absolute";
  var posTop = t - this.divHeight / 2;
  var posLeft = l - this.divWidth / 2;
  // Clamp to canvas
  var canvasW = parseInt(this.sheetObject.canvas.style.width) || 10000;
  var canvasH = parseInt(this.sheetObject.canvas.style.height) || 10000;
  if (posLeft < 0) posLeft = 0;
  if (posTop < 0) posTop = 0;
  if (posLeft + this.divWidth > canvasW) posLeft = canvasW - this.divWidth;
  if (posTop + this.divHeight > canvasH) posTop = canvasH - this.divHeight;
  this.divObj.style.top = posTop;
  this.divObj.style.left = posLeft;
  this.divObj.style.width = this.divWidth;
  this.divObj.style.height = this.divHeight;
  this.divObj.style.border = "1px solid black";
  this.divObj.style.backgroundColor = "rgb(223,223,231)";
  this.divObj.style.zIndex = "1";
  this.divObj.style.textAlign = "center";
  this.divObj.style.fontFamily = "Calibri";
  this.divObj.style.fontSize = "11";
  this.divObj.style.fontWeight = "normal";
  this.divObj.style.cursor = "move";
  this.divObj.style.overflow = "hidden";
  this.sheetObject.canvas.appendChild(this.divObj);

  // Create header bar
  this.headerDiv = document.createElement("div");
  this.headerDiv.style.backgroundColor = "rgb(201,203,217)";
  this.headerDiv.style.padding = "2px 0";
  this.headerDiv.style.fontWeight = "bold";
  this.headerDiv.style.fontSize = "11";
  this.headerDiv.innerHTML = this.text;
  this.divObj.appendChild(this.headerDiv);

  // Create execution order number display (above block on right side)
  // Appended to canvas (not divObj) because divObj has overflow:hidden
  this.execOrderDiv = document.createElement("div");
  this.execOrderDiv.style.position = "absolute";
  this.execOrderDiv.style.backgroundColor = "rgb(0,120,215)";
  this.execOrderDiv.style.color = "white";
  this.execOrderDiv.style.fontWeight = "bold";
  this.execOrderDiv.style.fontSize = "10px";
  this.execOrderDiv.style.padding = "2px 6px";
  this.execOrderDiv.style.borderRadius = "3px";
  this.execOrderDiv.style.zIndex = "10";
  this.execOrderDiv.style.pointerEvents = "none";
  this.execOrderDiv.style.fontFamily = "Calibri, Arial, sans-serif";
  this.execOrderDiv.style.display = this.sheetObject.execOrderVisible
    ? "block"
    : "none";
  this.execOrderDiv.innerHTML = "#" + this.indexNumber;
  this.sheetObject.canvas.appendChild(this.execOrderDiv);
  this._updateExecOrderPosition();

  this.divObj.addEventListener(
    "mousedown",
    function (e) {
      current.mousedownHandler(e);
    },
    true,
  );
  this.divObj.addEventListener(
    "mouseover",
    function (e) {
      current.mouseoverHandler(e);
    },
    true,
  );
  this.divObj.addEventListener(
    "mouseout",
    function (e) {
      current.mouseoutHandler(e);
    },
    true,
  );
  this.divObj.addEventListener(
    "click",
    function (e) {
      current.clickHandler(e);
    },
    true,
  );
  this.divObj.addEventListener(
    "dblclick",
    function (e) {
      current.dblclickHandler(e);
      e.stopPropagation();
    },
    true,
  );
};
Base.prototype.mousedownHandler = function (e) {
  if (!e.ctrlKey && !this.sheetObject.simulateOn && !this._isResizing) {
    var canvasPos = this.sheetObject.screenToCanvas(e.clientX, e.clientY);

    // Check if this block is already in the selection
    var alreadySelected = this.sheetObject.selectedBlocks.indexOf(this) >= 0;

    if (!alreadySelected) {
      // Not in selection — select this block (shift adds, no shift replaces)
      this.sheetObject.turnOffSelect();
      this.sheetObject.blockSelected(this, e.shiftKey);
    }
    // If already selected and no shift, keep entire selection for group drag

    // Store offsets for ALL selected blocks relative to mouse
    this._groupOffsets = [];
    for (var g = 0; g < this.sheetObject.selectedBlocks.length; g++) {
      var blk = this.sheetObject.selectedBlocks[g];
      this._groupOffsets.push({
        block: blk,
        ox: canvasPos.x - parseInt(blk.divObj.style.left),
        oy: canvasPos.y - parseInt(blk.divObj.style.top),
      });
    }

    this.offsetX = canvasPos.x - parseInt(this.divObj.style.left);
    this.offsetY = canvasPos.y - parseInt(this.divObj.style.top);
    this.captured = 1;
    this.sheetObject.turnOffSelect();

    var current = this;
    this._docMoveHandler = function (e) {
      current.moveHandler(e);
    };
    this._docUpHandler = function (e) {
      current.mouseupHandler(e);
    };
    document.addEventListener("mousemove", this._docMoveHandler, true);
    document.addEventListener("mouseup", this._docUpHandler, true);
  }
};
Base.prototype.moveHandler = function (e) {
  if (this.captured) {
    this.hasMoved = 1;
    var canvasPos = this.sheetObject.screenToCanvas(e.clientX, e.clientY);
    var canvasW = parseInt(this.sheetObject.canvas.style.width) || 10000;
    var canvasH = parseInt(this.sheetObject.canvas.style.height) || 10000;

    // Check for snap point (based on mouse position)
    var snapPt = this.sheetObject.findSnapPoint(canvasPos.x, canvasPos.y, 100);

    // Move all selected blocks
    for (var g = 0; g < this._groupOffsets.length; g++) {
      var item = this._groupOffsets[g];
      var blk = item.block;

      // Skip snap blocks themselves when snapping
      if (blk.objectName === "Snap") {
        var newLeft = canvasPos.x - item.ox;
        var newTop = canvasPos.y - item.oy;
      } else if (snapPt && blk === this) {
        // Primary block snaps: top-left to snap point
        var newLeft = snapPt.x;
        var newTop = snapPt.y;
      } else if (snapPt && blk !== this) {
        // Other selected blocks: maintain relative offset from primary
        var primaryItem = null;
        for (var p = 0; p < this._groupOffsets.length; p++) {
          if (this._groupOffsets[p].block === this) {
            primaryItem = this._groupOffsets[p];
            break;
          }
        }
        var primaryNonSnappedLeft = canvasPos.x - primaryItem.ox;
        var primaryNonSnappedTop = canvasPos.y - primaryItem.oy;
        var relX = canvasPos.x - item.ox - primaryNonSnappedLeft;
        var relY = canvasPos.y - item.oy - primaryNonSnappedTop;
        var newLeft = snapPt.x + relX;
        var newTop = snapPt.y + relY;
      } else {
        var newLeft = canvasPos.x - item.ox;
        var newTop = canvasPos.y - item.oy;
      }

      // Snap to grid
      if (this.sheetObject.snapToGrid) {
        newLeft =
          Math.round(newLeft / this.sheetObject.gridSize) *
          this.sheetObject.gridSize;
        newTop =
          Math.round(newTop / this.sheetObject.gridSize) *
          this.sheetObject.gridSize;
      }

      // Clamp to canvas boundaries
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      if (newLeft + blk.divWidth > canvasW) newLeft = canvasW - blk.divWidth;
      if (newTop + blk.divHeight > canvasH) newTop = canvasH - blk.divHeight;

      blk.divObj.style.left = newLeft;
      blk.divObj.style.top = newTop;
      blk.divObj.style.zIndex = "99";
      blk.divObj.style.filter = "alpha(opacity=80)";

      // Update execution order number position
      if (blk._updateExecOrderPosition) blk._updateExecOrderPosition();

      for (var ci = 0; ci < blk.inConnections.length; ci++) {
        blk.inConnections[ci].moveConnector();
      }
      for (var co = 0; co < blk.outConnections.length; co++) {
        blk.outConnections[co].moveConnector();
      }
    }
    this.sheetObject._updateSelCoords();
  }
};
Base.prototype.mouseupHandler = function (e) {
  if (this.captured) {
    this.captured = 0;
    // Reset zIndex/opacity for all blocks that were dragged
    if (this._groupOffsets) {
      for (var g = 0; g < this._groupOffsets.length; g++) {
        this._groupOffsets[g].block.divObj.style.zIndex = "1";
        this._groupOffsets[g].block.divObj.style.filter = "alpha(opacity=100)";
      }
      this._groupOffsets = null;
    }
    // Blocks settled → recompute all line routes so none overlap.
    if (this.hasMoved && this.sheetObject.rerouteAllLines) {
      this.sheetObject.rerouteAllLines();
    }
    this.hasMoved = 0;
  } else {
    this.captured = 0;
    this.sheetObject.turnOnSelect();
  }

  if (this._docMoveHandler) {
    document.removeEventListener("mousemove", this._docMoveHandler, true);
    document.removeEventListener("mouseup", this._docUpHandler, true);
    this._docMoveHandler = null;
    this._docUpHandler = null;
  }
};
Base.prototype.mouseoverHandler = function (e) {
  if (e.ctrlKey) this.divObj.style.border = "2px solid green";
  else {
    if (!this.sheetObject.selectInProgress) {
      this.sheetObject.turnOffSelect();
    }
  }
};
Base.prototype.mouseoutHandler = function (e) {
  //this.divObj.style.border="1px solid black";
  //this.sheetObject.turnOnSelect();
  //this.sheetObject.showSelected();
};
Base.prototype.clickHandler = function (e) {
  //There is not a default handler for the
  //Base block. Can override in subclasses
  //if needed.
};
Base.prototype.addConnections = function () {
  //There are no connections for a base block
  //Override this function in a custom definition
  //block and add input and output connections
};

Base.prototype.dblclickHandler = function (e) {
  if (!this.sheetObject.simulateOn) {
    this.openSettings();
  }
};

Base.prototype.openSettings = function () {
  // Default: no settings dialog. Override in subclasses.
};

// Static modal helper
Base.showModal = function (contentHTML, onSave, onCancel) {
  var overlay = document.getElementById("modalOverlay");
  var box = document.getElementById("modalBox");
  box.innerHTML =
    contentHTML +
    '<div class="modal-buttons">' +
    '<button id="modalCancel">Abbrechen</button>' +
    '<button id="modalSave" class="primary">OK</button>' +
    "</div>";
  overlay.classList.add("visible");

  document.getElementById("modalSave").addEventListener("click", function () {
    overlay.classList.remove("visible");
    if (onSave) onSave();
  });
  document.getElementById("modalCancel").addEventListener("click", function () {
    overlay.classList.remove("visible");
    if (onCancel) onCancel();
  });
  // Focus first input
  var firstInput = box.querySelector("input");
  if (firstInput) firstInput.focus();
};

Base.prototype._updateExecOrderPosition = function () {
  if (!this.execOrderDiv || !this.divObj) return;
  var blockLeft = parseInt(this.divObj.style.left) || 0;
  var blockTop = parseInt(this.divObj.style.top) || 0;
  var blockWidth = parseInt(this.divObj.style.width) || this.divWidth;
  // Position above the block, aligned to the right edge
  // Approximate badge width ~ 28px, height ~ 16px
  this.execOrderDiv.style.left = blockLeft + blockWidth - 28 + "px";
  this.execOrderDiv.style.top = blockTop - 18 + "px";
};

Base.prototype.removeConnectors = function () {
  //send terminate notification to connectors

  //delete input connections
  for (var i = 0; i < this.inConnections.length; i++) {
    this.inConnections[i].removeConnectedTo();
    delete this.inConnections[i];
  }

  //delete output connections
  for (var i = 0; i < this.outConnections.length; i++) {
    this.outConnections[i].removeConnectedFrom();
    delete this.outConnections[i];
  }

  // Remove execution order display from canvas
  if (this.execOrderDiv && this.execOrderDiv.parentNode) {
    this.execOrderDiv.parentNode.removeChild(this.execOrderDiv);
  }

  //remove block from page
  this.sheetObject.canvas.removeChild(this.divObj);
};

// --- Serialization for copy/paste and save/load ---

Base.prototype.serialize = function () {
  var data = {
    type: this.objectName,
    left: parseInt(this.divObj.style.left),
    top: parseInt(this.divObj.style.top),
    props: {},
  };
  // Capture connector inversions
  data.inInversions = [];
  for (var i = 0; i < this.inConnections.length; i++) {
    data.inInversions.push(this.inConnections[i].inverted || false);
  }
  data.outInversions = [];
  for (var i = 0; i < this.outConnections.length; i++) {
    data.outInversions.push(this.outConnections[i].inverted || false);
  }
  // Subclasses override _serializeProps to add their properties
  this._serializeProps(data.props);
  return data;
};

Base.prototype._serializeProps = function (props) {
  // Override in subclasses
};

Base.prototype.applySerializedProps = function (props) {
  // Override in subclasses to restore settings after create
};

Base.prototype.restoreInversions = function (data) {
  if (data.inInversions) {
    for (
      var i = 0;
      i < Math.min(data.inInversions.length, this.inConnections.length);
      i++
    ) {
      if (data.inInversions[i]) {
        this.inConnections[i].inverted = true;
        this.inConnections[i].invertCircle.style.display = "block";
      }
    }
  }
  if (data.outInversions) {
    for (
      var i = 0;
      i < Math.min(data.outInversions.length, this.outConnections.length);
      i++
    ) {
      if (data.outInversions[i]) {
        this.outConnections[i].inverted = true;
        this.outConnections[i].invertCircle.style.display = "block";
      }
    }
  }
};
