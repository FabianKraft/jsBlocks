///////////////////////////////////////////////////////////
//
//		Main Sheet Object
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
function SheetObject() {
  sheetObj = this;
  this.blockObjects = [];
  this.blockIndex = 0;
  this.currentBlock = null;
  this.overInstruction = 0;
  this.selectHeight = 0;
  this.selectWidth = 0;
  this.currentConnector = null;
  this.selectInProgress = 0;
  this.simulateOn = 0;
  this.simulationCycleMs = 15;
  this._simIntervalId = null;

  // Selection state: arrays for multi-select
  this.selectedBlocks = [];
  this.selectedLines = [];
  // Keep currentInstr for backward compatibility with block dragging
  this.currentInstr = null;
  this.currentLine = null;

  this.lastScan = 0;
  this.execOrderVisible = false; // Execution order numbers visibility
  this.delaySymbolVisible = false; // Delay symbols on lines visibility

  // Canvas / Pan / Zoom state
  this.canvas = document.getElementById("canvas");
  this.viewport = document.getElementById("viewport");
  this.scale = 1;
  this.panX = 0;
  this.panY = 0;
  this.isPanning = false;
  this.panStartX = 0;
  this.panStartY = 0;
  this.panStartPanX = 0;
  this.panStartPanY = 0;
  this.gridVisible = true;
  this.gridSize = 10;
  this.snapToGrid = false;
  this.snapEnabled = true;
  this.snapVisible = true;
  this.snapLinesToGrid = false;

  // Position viewport below toolbar
  var self = this;
  setTimeout(function () {
    var tb = document.getElementById("toolbar");
    var tbH = tb ? tb.offsetHeight : 36;
    self.viewport.style.top = tbH + "px";
    // Start with canvas showing top-left area
    self.panX = 0;
    self.panY = 0;
    self._applyTransform();
  }, 0);

  // --- Pan: middle mouse button or Alt+left click ---
  // --- Selection rectangle: left click on empty canvas ---
  this._lastMiddleClickTime = 0;
  this.isSelecting = false;
  this.selectRect = null;
  this.selectStartCanvas = null;

  this.viewport.addEventListener(
    "mousedown",
    function (e) {
      // Middle button (1) or Alt+left (0) → Pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();

        // Check for middle-mouse double-click (reset zoom)
        if (e.button === 1) {
          var now = Date.now();
          if (now - sheetObj._lastMiddleClickTime < 400) {
            var rect = sheetObj.viewport.getBoundingClientRect();
            var mouseX = e.clientX - rect.left;
            var mouseY = e.clientY - rect.top;
            var newScale = 1;
            sheetObj.panX =
              mouseX - (mouseX - sheetObj.panX) * (newScale / sheetObj.scale);
            sheetObj.panY =
              mouseY - (mouseY - sheetObj.panY) * (newScale / sheetObj.scale);
            sheetObj.scale = newScale;
            sheetObj._applyTransform();
            sheetObj._lastMiddleClickTime = 0;
            return;
          }
          sheetObj._lastMiddleClickTime = now;
        }

        sheetObj.isPanning = true;
        sheetObj.panStartX = e.clientX;
        sheetObj.panStartY = e.clientY;
        sheetObj.panStartPanX = sheetObj.panX;
        sheetObj.panStartPanY = sheetObj.panY;
        sheetObj.viewport.style.cursor = "grabbing";
      }
      // Left click on canvas background → selection rectangle
      else if (
        e.button === 0 &&
        !e.altKey &&
        (e.target === sheetObj.canvas || e.target === sheetObj.viewport)
      ) {
        var canvasPos = sheetObj.screenToCanvas(e.clientX, e.clientY);
        sheetObj.selectStartCanvas = { x: canvasPos.x, y: canvasPos.y };
        sheetObj.isSelecting = true;
        sheetObj._selectShiftHeld = e.shiftKey;

        // Create selection rectangle div in canvas
        sheetObj.selectRect = document.createElement("div");
        sheetObj.selectRect.style.position = "absolute";
        sheetObj.selectRect.style.border = "1px dashed rgb(0,120,215)";
        sheetObj.selectRect.style.backgroundColor = "rgba(0,120,215,0.1)";
        sheetObj.selectRect.style.zIndex = "200";
        sheetObj.selectRect.style.pointerEvents = "none";
        sheetObj.selectRect.style.left = canvasPos.x + "px";
        sheetObj.selectRect.style.top = canvasPos.y + "px";
        sheetObj.selectRect.style.width = "0px";
        sheetObj.selectRect.style.height = "0px";
        sheetObj.canvas.appendChild(sheetObj.selectRect);
      }
    },
    false,
  );

  document.addEventListener(
    "mousemove",
    function (e) {
      if (sheetObj.isPanning) {
        sheetObj.panX =
          sheetObj.panStartPanX + (e.clientX - sheetObj.panStartX);
        sheetObj.panY =
          sheetObj.panStartPanY + (e.clientY - sheetObj.panStartY);
        sheetObj._applyTransform();
      }
      if (sheetObj.isSelecting && sheetObj.selectRect) {
        var canvasPos = sheetObj.screenToCanvas(e.clientX, e.clientY);
        var sx = sheetObj.selectStartCanvas.x;
        var sy = sheetObj.selectStartCanvas.y;
        var left = Math.min(sx, canvasPos.x);
        var top = Math.min(sy, canvasPos.y);
        var width = Math.abs(canvasPos.x - sx);
        var height = Math.abs(canvasPos.y - sy);
        sheetObj.selectRect.style.left = left + "px";
        sheetObj.selectRect.style.top = top + "px";
        sheetObj.selectRect.style.width = width + "px";
        sheetObj.selectRect.style.height = height + "px";
      }
    },
    false,
  );

  document.addEventListener(
    "mouseup",
    function (e) {
      if (sheetObj.isPanning) {
        sheetObj.isPanning = false;
        sheetObj.viewport.style.cursor = "";
      }
      if (sheetObj.isSelecting && sheetObj.selectRect) {
        // Get selection rectangle bounds in canvas coords
        var rLeft = parseInt(sheetObj.selectRect.style.left);
        var rTop = parseInt(sheetObj.selectRect.style.top);
        var rWidth = parseInt(sheetObj.selectRect.style.width);
        var rHeight = parseInt(sheetObj.selectRect.style.height);
        var rRight = rLeft + rWidth;
        var rBottom = rTop + rHeight;

        // Only select if rectangle is big enough (avoid accidental clicks)
        if (rWidth > 3 || rHeight > 3) {
          // Deselect all unless shift is held
          if (!sheetObj._selectShiftHeld) {
            sheetObj.deselectAll();
          }

          // Find blocks that overlap with selection rectangle
          for (var i = 0; i < sheetObj.blockObjects.length; i++) {
            var block = sheetObj.blockObjects[i];
            var bLeft = parseInt(block.divObj.style.left);
            var bTop = parseInt(block.divObj.style.top);
            var bRight = bLeft + parseInt(block.divObj.style.width);
            var bBottom = bTop + parseInt(block.divObj.style.height);

            // Check overlap
            if (
              bLeft < rRight &&
              bRight > rLeft &&
              bTop < rBottom &&
              bBottom > rTop
            ) {
              // Add to selection if not already selected
              if (sheetObj.selectedBlocks.indexOf(block) < 0) {
                block.divObj.style.border = "1px solid red";
                sheetObj.selectedBlocks.push(block);
              }
            }
          }
        } else {
          // Tiny rectangle = click on empty space, deselect all
          if (!sheetObj._selectShiftHeld) {
            sheetObj.deselectAll();
          }
        }

        // Remove selection rectangle
        sheetObj.canvas.removeChild(sheetObj.selectRect);
        sheetObj.selectRect = null;
        sheetObj.isSelecting = false;
        sheetObj.selectStartCanvas = null;
      }
    },
    false,
  );

  // Prevent context menu on middle click
  this.viewport.addEventListener(
    "contextmenu",
    function (e) {
      if (e.button === 1) e.preventDefault();
    },
    false,
  );

  // --- Zoom: mouse wheel, centered on cursor ---
  this.viewport.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      var zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      var newScale = sheetObj.scale * zoomFactor;
      // Clamp scale
      if (newScale < 0.1) newScale = 0.1;
      if (newScale > 5) newScale = 5;

      // Zoom centered on mouse position
      var rect = sheetObj.viewport.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      // Adjust pan so the point under the mouse stays fixed
      sheetObj.panX =
        mouseX - (mouseX - sheetObj.panX) * (newScale / sheetObj.scale);
      sheetObj.panY =
        mouseY - (mouseY - sheetObj.panY) * (newScale / sheetObj.scale);
      sheetObj.scale = newScale;

      sheetObj._applyTransform();
    },
    { passive: false },
  );

  // --- Mouse coordinate tracking ---
  this.viewport.addEventListener(
    "mousemove",
    function (e) {
      var cp = sheetObj.screenToCanvas(e.clientX, e.clientY);
      sheetObj._updateCoordDisplay(Math.round(cp.x), Math.round(cp.y));
    },
    false,
  );

  document.addEventListener(
    "dblclick",
    function (e) {
      sheetObj.doubleClickHandler(e);
    },
    true,
  );

  document.addEventListener(
    "click",
    function (e) {
      sheetObj.clickHandler(e);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    function (e) {
      sheetObj.keyDownHandler(e);
    },
    true,
  );

  document.addEventListener(
    "keyup",
    function (e) {
      sheetObj.keyUpHandler(e);
    },
    true,
  );

  //Set up scan timer.
  //Each scan the sheet object loops
  //through its list of blocks and calls
  //their Execute function.
  var simLoop = function () {
    if (sheetObj.simulateOn) {
      for (i = 0; i < sheetObj.blockObjects.length; i++) {
        sheetObj.blockObjects[i].Execute();
        var block = sheetObj.blockObjects[i];
        // Update output connector colors and downstream
        for (var o = 0; o < block.outConnections.length; o++) {
          var outConn = block.outConnections[o];
          if (outConn.dataType === "bool") {
            var rawVal = outConn.value;
            var effVal = outConn.getEffectiveValue();
            // Output connector shows raw value
            outConn.theConnector.style.backgroundColor = rawVal
              ? "rgb(3,255,3)"
              : "rgb(0,0,255)";
            // Inversion circle: opposite of line color
            if (outConn.inverted) {
              outConn.invertCircle.style.borderColor = rawVal
                ? "rgb(3,255,3)"
                : "rgb(0,0,255)";
            }
            // Lines and downstream connectors use effective value
            for (var c = 0; c < outConn.connectedTo.length; c++) {
              var inConn = outConn.connectedTo[c];
              if (inConn.theLine) {
                inConn.theLine.changeColor(
                  effVal ? "rgb(3,255,3)" : "rgb(0,0,255)",
                );
              }
              // Input connector shows what it receives (before its own inversion)
              inConn.theConnector.style.backgroundColor = effVal
                ? "rgb(3,255,3)"
                : "rgb(0,0,255)";
              // Input inversion circle: opposite of what the line carries
              if (inConn.inverted) {
                inConn.invertCircle.style.borderColor = effVal
                  ? "rgb(0,0,255)"
                  : "rgb(3,255,3)";
              }
            }
          }
        }
        // Update unconnected bool input connectors to blue
        for (var inp = 0; inp < block.inConnections.length; inp++) {
          var inConn = block.inConnections[inp];
          if (inConn.dataType === "bool" && inConn.connectedFrom == null) {
            inConn.theConnector.style.backgroundColor = "rgb(0,0,255)";
            if (inConn.inverted) {
              inConn.invertCircle.style.borderColor = "rgb(3,255,3)";
            }
          }
        }
      }
      window.status = "Simulating";
    }
  };
  this._simIntervalId = window.setInterval(simLoop, this.simulationCycleMs);

  window.status = "Stopped";
}

// --- Canvas transform and coordinate helpers ---

SheetObject.prototype._applyTransform = function () {
  this.canvas.style.transform =
    "translate(" +
    this.panX +
    "px," +
    this.panY +
    "px) scale(" +
    this.scale +
    ")";
  var zoomEl = document.getElementById("zoomLevel");
  if (zoomEl) zoomEl.innerHTML = Math.round(this.scale * 100) + "%";
};

SheetObject.prototype._updateCoordDisplay = function (mx, my) {
  if (mx !== undefined && my !== undefined) {
    var mouseEl = document.getElementById("coordMouse");
    if (mouseEl) mouseEl.innerHTML = "Mouse: X:" + mx + " Y:" + my;
  }
  this._updateSelCoords();
};

SheetObject.prototype._updateSelCoords = function () {
  var selEl = document.getElementById("coordSel");
  if (!selEl) return;
  if (this.selectedBlocks.length === 1) {
    var blk = this.selectedBlocks[0];
    var sx, sy;
    if (blk.objectName === "DrawLine") {
      sx = Math.round(blk.x1);
      sy = Math.round(blk.y1);
    } else {
      sx = parseInt(blk.divObj.style.left);
      sy = parseInt(blk.divObj.style.top);
    }
    selEl.innerHTML = "Sel: X:" + sx + " Y:" + sy;
  } else if (this.selectedBlocks.length > 1) {
    var minX = Infinity,
      minY = Infinity;
    for (var i = 0; i < this.selectedBlocks.length; i++) {
      var bx, by;
      if (this.selectedBlocks[i].objectName === "DrawLine") {
        bx = Math.round(
          Math.min(this.selectedBlocks[i].x1, this.selectedBlocks[i].x2),
        );
        by = Math.round(
          Math.min(this.selectedBlocks[i].y1, this.selectedBlocks[i].y2),
        );
      } else {
        bx = parseInt(this.selectedBlocks[i].divObj.style.left);
        by = parseInt(this.selectedBlocks[i].divObj.style.top);
      }
      if (bx < minX) minX = bx;
      if (by < minY) minY = by;
    }
    selEl.innerHTML =
      "Sel: X:" + minX + " Y:" + minY + " (" + this.selectedBlocks.length + ")";
  } else {
    selEl.innerHTML = "Sel: X:- Y:-";
  }
};

SheetObject.prototype.screenToCanvas = function (screenX, screenY) {
  var rect = this.viewport.getBoundingClientRect();
  return {
    x: (screenX - rect.left - this.panX) / this.scale,
    y: (screenY - rect.top - this.panY) / this.scale,
  };
};

SheetObject.prototype.canvasToScreen = function (canvasX, canvasY) {
  var rect = this.viewport.getBoundingClientRect();
  return {
    x: canvasX * this.scale + this.panX + rect.left,
    y: canvasY * this.scale + this.panY + rect.top,
  };
};

SheetObject.prototype.toggleGrid = function () {
  this.gridVisible = !this.gridVisible;
  if (this.gridVisible) {
    this.canvas.classList.add("show-grid");
  } else {
    this.canvas.classList.remove("show-grid");
  }
  // Update settings switch
  var sw = document.getElementById("settingsGridSwitch");
  if (sw) sw.checked = this.gridVisible;
};

SheetObject.prototype.toggleSnapEnable = function () {
  this.snapEnabled = !this.snapEnabled;
  // Update settings switch
  var sw = document.getElementById("settingsSnapEnableSwitch");
  if (sw) sw.checked = this.snapEnabled;
};

SheetObject.prototype.toggleSnapShow = function () {
  this.snapVisible = !this.snapVisible;
  // Update settings switch
  var sw = document.getElementById("settingsSnapShowSwitch");
  if (sw) sw.checked = this.snapVisible;
  // Show/hide all snap blocks
  for (var i = 0; i < this.blockObjects.length; i++) {
    if (this.blockObjects[i].objectName === "Snap") {
      this.blockObjects[i].divObj.style.display = this.snapVisible
        ? ""
        : "none";
    }
  }
};

SheetObject.prototype.toggleSnapLinesToGrid = function () {
  this.snapLinesToGrid = !this.snapLinesToGrid;
  var sw = document.getElementById("settingsSnapLinesToGridSwitch");
  if (sw) sw.checked = this.snapLinesToGrid;
  // Redraw all lines with the new routing
  this._redrawAllLines();
};

SheetObject.prototype._redrawAllLines = function () {
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    for (var j = 0; j < block.inConnections.length; j++) {
      var conn = block.inConnections[j];
      if (conn.theLine) {
        conn.theLine.connectTo();
      }
    }
  }
};

SheetObject.prototype.toggleDelaySymbol = function () {
  this.delaySymbolVisible = !this.delaySymbolVisible;
  // Update settings switch
  var sw = document.getElementById("settingsDelaySwitch");
  if (sw) sw.checked = this.delaySymbolVisible;

  // Update delay symbols on all existing lines
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    for (var j = 0; j < block.inConnections.length; j++) {
      var conn = block.inConnections[j];
      if (conn.theLine && conn.theLine._updateDelaySymbol) {
        conn.theLine._updateDelaySymbol();
      }
    }
  }
};

SheetObject.prototype.toggleExecOrder = function () {
  this.execOrderVisible = !this.execOrderVisible;
  // Update settings switch
  var sw = document.getElementById("settingsExecOrderSwitch");
  if (sw) sw.checked = this.execOrderVisible;
  // Show/hide execution order numbers on all blocks
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    // Create execOrderDiv if it doesn't exist (for blocks created before this feature)
    if (!block.execOrderDiv && block.divObj) {
      block.execOrderDiv = document.createElement("div");
      block.execOrderDiv.style.position = "absolute";
      block.execOrderDiv.style.backgroundColor = "rgb(0,120,215)";
      block.execOrderDiv.style.color = "white";
      block.execOrderDiv.style.fontWeight = "bold";
      block.execOrderDiv.style.fontSize = "10px";
      block.execOrderDiv.style.padding = "2px 6px";
      block.execOrderDiv.style.borderRadius = "3px";
      block.execOrderDiv.style.zIndex = "10";
      block.execOrderDiv.style.pointerEvents = "none";
      block.execOrderDiv.style.fontFamily = "Calibri, Arial, sans-serif";
      block.execOrderDiv.innerHTML = "#" + block.indexNumber;
      this.canvas.appendChild(block.execOrderDiv);
    }
    if (block.execOrderDiv) {
      // Always refresh the displayed number (in case index changed)
      block.execOrderDiv.innerHTML = "#" + block.indexNumber;
      block.execOrderDiv.style.display = this.execOrderVisible
        ? "block"
        : "none";
      if (block._updateExecOrderPosition) block._updateExecOrderPosition();
    }
  }
};

SheetObject.prototype.snapToGridPoint = function (x, y) {
  return {
    x: Math.round(x / this.gridSize) * this.gridSize,
    y: Math.round(y / this.gridSize) * this.gridSize,
  };
};

SheetObject.prototype.toggleSnapToGrid = function () {
  this.snapToGrid = !this.snapToGrid;
  var sw = document.getElementById("settingsSnapToGridSwitch");
  if (sw) sw.checked = this.snapToGrid;
};

SheetObject.prototype.setGridSize = function (value) {
  var v = parseInt(value);
  if (isNaN(v) || v < 1) v = 1;
  if (v > 100) v = 100;
  this.gridSize = v;
  this.canvas.style.backgroundSize = v + "px " + v + "px";
  var inp = document.getElementById("settingsGridSizeInput");
  if (inp && document.activeElement !== inp) inp.value = v;
};

SheetObject.prototype.setSimulationSpeed = function (value) {
  var v = parseInt(value);
  if (isNaN(v) || v < 1) v = 1;
  if (v > 1000) v = 1000;
  this.simulationCycleMs = v;
  // Restart interval if simulation is running
  if (this._simIntervalId !== null) {
    window.clearInterval(this._simIntervalId);
    // Re-create the loop with new cycle time
    var sheetObj = this;
    var simLoop = function () {
      if (sheetObj.simulateOn) {
        for (var i = 0; i < sheetObj.blockObjects.length; i++) {
          sheetObj.blockObjects[i].Execute();
          var block = sheetObj.blockObjects[i];
          for (var o = 0; o < block.outConnections.length; o++) {
            var outConn = block.outConnections[o];
            if (outConn.dataType === "bool") {
              var rawVal = outConn.value;
              var effVal = outConn.getEffectiveValue();
              outConn.theConnector.style.backgroundColor = rawVal
                ? "rgb(3,255,3)"
                : "rgb(0,0,255)";
              if (outConn.inverted) {
                outConn.invertCircle.style.borderColor = rawVal
                  ? "rgb(3,255,3)"
                  : "rgb(0,0,255)";
              }
              for (var c = 0; c < outConn.connectedTo.length; c++) {
                var inConn = outConn.connectedTo[c];
                if (inConn.theLine) {
                  inConn.theLine.changeColor(
                    effVal ? "rgb(3,255,3)" : "rgb(0,0,255)",
                  );
                }
                inConn.theConnector.style.backgroundColor = effVal
                  ? "rgb(3,255,3)"
                  : "rgb(0,0,255)";
                if (inConn.inverted) {
                  inConn.invertCircle.style.borderColor = effVal
                    ? "rgb(0,0,255)"
                    : "rgb(3,255,3)";
                }
              }
            }
          }
          for (var inp = 0; inp < block.inConnections.length; inp++) {
            var inConn = block.inConnections[inp];
            if (inConn.dataType === "bool" && inConn.connectedFrom == null) {
              inConn.theConnector.style.backgroundColor = "rgb(0,0,255)";
              if (inConn.inverted) {
                inConn.invertCircle.style.borderColor = "rgb(3,255,3)";
              }
            }
          }
        }
        window.status = "Simulating";
      }
    };
    this._simIntervalId = window.setInterval(simLoop, this.simulationCycleMs);
  }
  var inp = document.getElementById("settingsSimSpeedInput");
  if (inp && document.activeElement !== inp) inp.value = v;
};

// Find nearest snap point within radius, returns {x,y} or null
SheetObject.prototype.findSnapPoint = function (
  mouseCanvasX,
  mouseCanvasY,
  radius,
) {
  if (!this.snapEnabled) return null;
  var closest = null;
  var closestDist = Infinity;
  for (var i = 0; i < this.blockObjects.length; i++) {
    if (this.blockObjects[i].objectName === "Snap") {
      var sp = this.blockObjects[i].getSnapPoint();
      var dx = mouseCanvasX - sp.x;
      var dy = mouseCanvasY - sp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist < closestDist) {
        closestDist = dist;
        closest = sp;
      }
    }
  }
  return closest;
};

SheetObject.prototype.selectBlock = function (blockType) {
  var list = document.getElementById("blockList");
  list.value = blockType;
  // Highlight the active shortcut button briefly
  var btns = document.querySelectorAll(".shortcut-btn");
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
  event.target.classList.add("active");
  setTimeout(function () {
    var active = document.querySelector(".shortcut-btn.active");
    if (active) active.classList.remove("active");
  }, 300);
};

// --- Page Format & Markings ---

SheetObject.prototype.PAGE_FORMATS = {
  none: null,
  a4p: {
    w: 794,
    h: 1123,
    label: "A4 Portrait",
    orient: "portrait",
    pdfW: 210,
    pdfH: 297,
  },
  a4l: {
    w: 1123,
    h: 794,
    label: "A4 Landscape",
    orient: "landscape",
    pdfW: 297,
    pdfH: 210,
  },
  a3p: {
    w: 1123,
    h: 1587,
    label: "A3 Portrait",
    orient: "portrait",
    pdfW: 297,
    pdfH: 420,
  },
  a3l: {
    w: 1587,
    h: 1123,
    label: "A3 Landscape",
    orient: "landscape",
    pdfW: 420,
    pdfH: 297,
  },
};

SheetObject.prototype.setPageFormat = function (format) {
  this.currentPageFormat = format;
  this._clearPageMarkings();

  // Sync settings dropdown
  var sel = document.getElementById("settingsPageFormat");
  if (sel) sel.value = format;

  var printBtn = document.getElementById("printButton");
  if (format === "none" || !this.PAGE_FORMATS[format]) {
    printBtn.disabled = true;
    return;
  }
  printBtn.disabled = false;
  this._drawPageMarkings(this.PAGE_FORMATS[format]);
};

SheetObject.prototype._clearPageMarkings = function () {
  var old = this.canvas.querySelectorAll(
    ".page-line-v, .page-line-h, .page-label",
  );
  for (var i = 0; i < old.length; i++) {
    this.canvas.removeChild(old[i]);
  }
};

SheetObject.prototype._drawPageMarkings = function (fmt) {
  var canvasW = parseInt(this.canvas.style.width) || 10000;
  var canvasH = parseInt(this.canvas.style.height) || 10000;
  var cols = Math.floor(canvasW / fmt.w);
  var rows = Math.floor(canvasH / fmt.h);

  // Vertical page boundary lines
  for (var c = 1; c <= cols; c++) {
    var line = document.createElement("div");
    line.className = "page-line-v";
    line.style.left = c * fmt.w + "px";
    line.style.top = "0";
    line.style.height = rows * fmt.h + "px";
    this.canvas.appendChild(line);
  }

  // Horizontal page boundary lines
  for (var r = 1; r <= rows; r++) {
    var line = document.createElement("div");
    line.className = "page-line-h";
    line.style.left = "0";
    line.style.top = r * fmt.h + "px";
    line.style.width = cols * fmt.w + "px";
    this.canvas.appendChild(line);
  }

  // Page number labels
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var label = document.createElement("div");
      label.className = "page-label";
      label.style.left = c * fmt.w + 4 + "px";
      label.style.top = r * fmt.h + 2 + "px";
      label.innerHTML = fmt.label + " — Page " + (r * cols + c + 1);
      this.canvas.appendChild(label);
    }
  }
};

// --- PDF Export ---

SheetObject.prototype.printPDF = function () {
  var format = this.currentPageFormat;
  if (!format || format === "none") return;

  var fmt = this.PAGE_FORMATS[format];
  if (!fmt) return;

  var canvasW = parseInt(this.canvas.style.width) || 10000;
  var canvasH = parseInt(this.canvas.style.height) || 10000;
  var cols = Math.floor(canvasW / fmt.w);
  var rows = Math.floor(canvasH / fmt.h);

  // Find pages that contain blocks
  var pagesWithContent = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var pageLeft = c * fmt.w;
      var pageTop = r * fmt.h;
      var pageRight = pageLeft + fmt.w;
      var pageBottom = pageTop + fmt.h;

      var hasContent = false;
      for (var b = 0; b < this.blockObjects.length; b++) {
        var blk = this.blockObjects[b];
        var bLeft = parseInt(blk.divObj.style.left);
        var bTop = parseInt(blk.divObj.style.top);
        var bRight = bLeft + parseInt(blk.divObj.style.width);
        var bBottom = bTop + parseInt(blk.divObj.style.height);
        if (
          bLeft < pageRight &&
          bRight > pageLeft &&
          bTop < pageBottom &&
          bBottom > pageTop
        ) {
          hasContent = true;
          break;
        }
      }
      if (hasContent) {
        pagesWithContent.push({ row: r, col: c, left: pageLeft, top: pageTop });
      }
    }
  }

  if (pagesWithContent.length === 0) {
    alert("No content to print.");
    return;
  }

  // Temporarily hide markings and grid, reset transform for capture
  var hadGrid = this.canvas.classList.contains("show-grid");
  this.canvas.classList.remove("show-grid");
  this._clearPageMarkings();
  var savedTransform = this.canvas.style.transform;
  this.canvas.style.transform = "none";

  var sheet = this;
  var pageIndex = 0;
  var orientation = fmt.orient === "landscape" ? "l" : "p";
  var pdfFormat = format.indexOf("a3") === 0 ? "a3" : "a4";
  var pdf = new jspdf.jsPDF(orientation, "mm", pdfFormat);

  function renderNextPage() {
    if (pageIndex >= pagesWithContent.length) {
      // Done — restore and save
      sheet.canvas.style.transform = savedTransform;
      if (hadGrid) sheet.canvas.classList.add("show-grid");
      sheet.setPageFormat(sheet.currentPageFormat);
      pdf.save("jsblocks_print.pdf");
      return;
    }

    var page = pagesWithContent[pageIndex];

    html2canvas(sheet.canvas, {
      x: page.left,
      y: page.top,
      width: fmt.w,
      height: fmt.h,
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    })
      .then(function (pageCanvas) {
        if (pageIndex > 0) {
          pdf.addPage(pdfFormat, orientation);
        }
        var imgData = pageCanvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, fmt.pdfW, fmt.pdfH);
        pageIndex++;
        renderNextPage();
      })
      .catch(function (err) {
        alert("Error rendering page: " + err.message);
        sheet.canvas.style.transform = savedTransform;
        if (hadGrid) sheet.canvas.classList.add("show-grid");
        sheet.setPageFormat(sheet.currentPageFormat);
      });
  }

  renderNextPage();
};

SheetObject.prototype.toggleKeybinds = function () {
  var overlay = document.getElementById("keybindOverlay");
  overlay.classList.toggle("visible");
};

SheetObject.prototype.toggleSettings = function () {
  var overlay = document.getElementById("settingsOverlay");
  overlay.classList.toggle("visible");
};

// --- Save / Load ---

SheetObject.prototype._createBlockInstance = function (typeName) {
  if (typeof typeName === "string" && typeName.indexOf("Custom_") === 0) {
    var defName = typeName.substring(7);
    var def = CustomBlockRegistry.get(defName);
    if (!def) return null;
    return new CustomBlock(def);
  }
  return eval("new " + typeName + "Block");
};

// Collect the current sheet settings into a plain object for saving.
SheetObject.prototype._collectSettings = function () {
  return {
    gridVisible: this.gridVisible,
    gridSize: this.gridSize,
    snapToGrid: this.snapToGrid,
    snapEnabled: this.snapEnabled,
    snapVisible: this.snapVisible,
    snapLinesToGrid: this.snapLinesToGrid,
    execOrderVisible: this.execOrderVisible,
    delaySymbolVisible: this.delaySymbolVisible,
    currentPageFormat: this.currentPageFormat,
    simulationCycleMs: this.simulationCycleMs,
  };
};

// Apply saved settings back onto the sheet. Reuses the existing toggle/setter
// methods so both internal state and the settings UI stay in sync. Boolean
// toggles are only flipped when the saved value differs from the current one.
SheetObject.prototype._applySettings = function (settings) {
  if (!settings) return;

  if (
    typeof settings.gridVisible === "boolean" &&
    settings.gridVisible !== this.gridVisible
  )
    this.toggleGrid();
  if (
    typeof settings.snapToGrid === "boolean" &&
    settings.snapToGrid !== this.snapToGrid
  )
    this.toggleSnapToGrid();
  if (
    typeof settings.snapEnabled === "boolean" &&
    settings.snapEnabled !== this.snapEnabled
  )
    this.toggleSnapEnable();
  if (
    typeof settings.snapVisible === "boolean" &&
    settings.snapVisible !== this.snapVisible
  )
    this.toggleSnapShow();
  if (
    typeof settings.snapLinesToGrid === "boolean" &&
    settings.snapLinesToGrid !== this.snapLinesToGrid
  )
    this.toggleSnapLinesToGrid();
  if (
    typeof settings.execOrderVisible === "boolean" &&
    settings.execOrderVisible !== this.execOrderVisible
  )
    this.toggleExecOrder();
  if (
    typeof settings.delaySymbolVisible === "boolean" &&
    settings.delaySymbolVisible !== this.delaySymbolVisible
  )
    this.toggleDelaySymbol();

  if (settings.gridSize != null) this.setGridSize(settings.gridSize);
  if (settings.simulationCycleMs != null)
    this.setSimulationSpeed(settings.simulationCycleMs);
  if (settings.currentPageFormat != null)
    this.setPageFormat(settings.currentPageFormat);
};

SheetObject.prototype.saveProject = function () {
  var project = {
    version: 1,
    blocks: [],
    connections: [],
    customDefinitions: {},
    settings: this._collectSettings(),
  };

  // Collect custom block definitions used in this project
  for (var i = 0; i < this.blockObjects.length; i++) {
    var b = this.blockObjects[i];
    if (b.definition && b.objectName && b.objectName.indexOf("Custom_") === 0) {
      project.customDefinitions[b.definition.name] = b.definition;
    }
  }

  // Serialize all blocks
  for (var i = 0; i < this.blockObjects.length; i++) {
    var data = this.blockObjects[i].serialize();
    data._saveIndex = i;
    project.blocks.push(data);
  }

  // Serialize ALL connections
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    for (var o = 0; o < block.outConnections.length; o++) {
      var outConn = block.outConnections[o];
      for (var c = 0; c < outConn.connectedTo.length; c++) {
        var inConn = outConn.connectedTo[c];
        var targetBlock = inConn.instruction;
        var targetIdx = this.blockObjects.indexOf(targetBlock);
        if (targetIdx >= 0) {
          var inIdx = targetBlock.inConnections.indexOf(inConn);
          project.connections.push({
            fromBlock: i,
            fromPin: o,
            toBlock: targetIdx,
            toPin: inIdx,
          });
        }
      }
    }
  }

  // Download as JSON
  var json = JSON.stringify(project, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "jsblocks_project.json";
  a.click();
  URL.revokeObjectURL(url);
};

SheetObject.prototype.loadProject = function (fileInput) {
  var self = this;
  var file = fileInput.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var project = JSON.parse(e.target.result);
      self._restoreProject(project);
    } catch (err) {
      alert("Error loading project: " + err.message);
    }
    // Reset file input so same file can be loaded again
    fileInput.value = "";
  };
  reader.readAsText(file);
};

// ===== Templates =====

SheetObject.prototype.toggleTemplates = function () {
  var overlay = document.getElementById("templatesOverlay");
  var isVisible = overlay.classList.contains("visible");
  if (isVisible) {
    overlay.classList.remove("visible");
  } else {
    overlay.classList.add("visible");
    this._loadTemplateList();
  }
};

SheetObject.prototype._loadTemplateList = function () {
  var self = this;
  var listEl = document.getElementById("templatesList");
  listEl.innerHTML =
    '<div class="templates-loading">Loading templates...</div>';

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "templates/templates.json", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
      try {
        var templates = JSON.parse(xhr.responseText);
        self._renderTemplateList(templates);
      } catch (e) {
        listEl.innerHTML =
          '<div class="templates-empty">Error parsing template list: ' +
          e.message +
          "</div>";
      }
    } else {
      listEl.innerHTML =
        '<div class="templates-empty">Could not load templates. ' +
        "Serve the app via a web server (e.g. python3 -m http.server)" +
        "</div>";
    }
  };
  xhr.send();
};

SheetObject.prototype._renderTemplateList = function (templates) {
  var self = this;
  var listEl = document.getElementById("templatesList");

  if (!templates || templates.length === 0) {
    listEl.innerHTML =
      '<div class="templates-empty">No templates available.</div>';
    return;
  }

  // Group by category
  var categories = {};
  var categoryOrder = [];
  for (var i = 0; i < templates.length; i++) {
    var cat = templates[i].category || "General";
    if (!categories[cat]) {
      categories[cat] = [];
      categoryOrder.push(cat);
    }
    categories[cat].push(templates[i]);
  }

  listEl.innerHTML = "";
  for (var c = 0; c < categoryOrder.length; c++) {
    var catName = categoryOrder[c];
    var header = document.createElement("div");
    header.className = "template-category";
    header.textContent = catName;
    listEl.appendChild(header);

    var items = categories[catName];
    for (var j = 0; j < items.length; j++) {
      (function (tmpl) {
        var item = document.createElement("div");
        item.className = "template-item";
        item.innerHTML =
          '<div class="template-name">' +
          tmpl.name +
          "</div>" +
          '<div class="template-desc">' +
          (tmpl.description || "") +
          "</div>";
        item.onclick = function () {
          self._loadTemplate(tmpl.file);
        };
        listEl.appendChild(item);
      })(items[j]);
    }
  }
};

SheetObject.prototype._loadTemplate = function (filename) {
  var self = this;
  var listEl = document.getElementById("templatesList");
  listEl.innerHTML = '<div class="templates-loading">Loading template...</div>';

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "templates/" + filename, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
      try {
        var project = JSON.parse(xhr.responseText);
        self._restoreProject(project);
        document.getElementById("templatesOverlay").classList.remove("visible");
      } catch (e) {
        alert("Error parsing template: " + e.message);
        self._loadTemplateList();
      }
    } else {
      alert("Error loading template. Serve the app via a web server.");
      self._loadTemplateList();
    }
  };
  xhr.send();
};

SheetObject.prototype._restoreProject = function (project) {
  // Stop simulation if running
  if (this.simulateOn) this.toggleSimulate();

  // Clear all existing blocks
  this.deselectAll();
  while (this.blockObjects.length > 0) {
    var block = this.blockObjects[0];
    block.removeConnectors();
    this.blockObjects.splice(0, 1);
    this.blockIndex--;
  }
  this.blockIndex = 0;

  var newBlocks = [];

  // Import custom block definitions from project
  if (project.customDefinitions) {
    CustomBlockRegistry.importFromProject(project.customDefinitions);
  }

  // Step 1: Create all blocks
  for (var i = 0; i < project.blocks.length; i++) {
    var data = project.blocks[i];
    var typeName = data.type;

    var block = this._createBlockInstance(typeName);
    if (!block) {
      console.warn("Cannot create block type: " + typeName + ", skipping.");
      newBlocks.push(null);
      continue;
    }
    block._needsInitialSettings = false;
    block._handlesOwnConnectors = true;

    // Create at target position
    var centerX = data.left + (block.divWidth || 60) / 2;
    var centerY = data.top + (block.divHeight || 80) / 2;
    block.create(this, centerX, centerY);

    // Set exact position
    block.divObj.style.left = data.left;
    block.divObj.style.top = data.top;
    if (block._updateExecOrderPosition) block._updateExecOrderPosition();

    // Apply properties
    if (block.applySerializedProps && Object.keys(data.props).length > 0) {
      block.applySerializedProps(data.props);
    }

    // Ensure connectors exist
    if (block.inConnections.length === 0 && block.outConnections.length === 0) {
      block.addConnections();
    }

    // Restore inversions
    block.restoreInversions(data);

    // Register
    block.indexNumber = this.blockIndex;
    this.blockObjects[this.blockIndex] = block;
    this.blockIndex++;

    newBlocks.push(block);
  }

  // Step 2: Sync connector positions
  for (var i = 0; i < newBlocks.length; i++) {
    var block = newBlocks[i];
    if (!block) continue;
    for (var ci = 0; ci < block.inConnections.length; ci++) {
      block.inConnections[ci].moveConnector();
    }
    for (var co = 0; co < block.outConnections.length; co++) {
      block.outConnections[co].moveConnector();
    }
  }

  // Step 3: Recreate all connections
  for (var c = 0; c < project.connections.length; c++) {
    var conn = project.connections[c];
    var fromBlock = newBlocks[conn.fromBlock];
    var toBlock = newBlocks[conn.toBlock];

    if (
      fromBlock &&
      toBlock &&
      conn.fromPin < fromBlock.outConnections.length &&
      conn.toPin < toBlock.inConnections.length
    ) {
      var outConn = fromBlock.outConnections[conn.fromPin];
      var inConn = toBlock.inConnections[conn.toPin];

      if (inConn.connectedFrom == null) {
        inConn.theLine = new LineObject(inConn, outConn);
        inConn.theLine.connectTo();
        outConn.addConnector(inConn);
        inConn.connectedFrom = outConn;
      }
    }
  }

  // Step 4: Restore sheet settings (after blocks/lines exist so visual
  // toggles such as snap visibility and exec-order numbers apply correctly)
  this._applySettings(project.settings);
};

// --- Copy / Paste ---

SheetObject.prototype.copySelection = function () {
  if (this.selectedBlocks.length === 0) return;

  this._clipboard = {
    blocks: [],
    connections: [],
  };

  // Serialize all selected blocks
  for (var i = 0; i < this.selectedBlocks.length; i++) {
    var data = this.selectedBlocks[i].serialize();
    data._selIndex = i; // temporary index for connection mapping
    this._clipboard.blocks.push(data);
  }

  // Find connections BETWEEN selected blocks
  for (var i = 0; i < this.selectedBlocks.length; i++) {
    var block = this.selectedBlocks[i];
    for (var o = 0; o < block.outConnections.length; o++) {
      var outConn = block.outConnections[o];
      for (var c = 0; c < outConn.connectedTo.length; c++) {
        var inConn = outConn.connectedTo[c];
        // Find which block and which input index this connects to
        var targetBlock = inConn.instruction;
        var targetSelIdx = this.selectedBlocks.indexOf(targetBlock);
        if (targetSelIdx >= 0) {
          // Both blocks are in selection — record connection
          var inIdx = targetBlock.inConnections.indexOf(inConn);
          this._clipboard.connections.push({
            fromBlock: i,
            fromPin: o,
            toBlock: targetSelIdx,
            toPin: inIdx,
          });
        }
      }
    }
  }
};

SheetObject.prototype.pasteClipboard = function () {
  if (!this._clipboard || this._clipboard.blocks.length === 0) return;

  var offset = 30; // Pixel offset from original position
  var newBlocks = [];

  // Deselect current selection
  this.deselectAll();

  // Step 1: Create all blocks
  for (var i = 0; i < this._clipboard.blocks.length; i++) {
    var data = this._clipboard.blocks[i];
    var typeName = data.type;

    // Create the block
    var block = this._createBlockInstance(typeName);
    if (!block) {
      console.warn("Cannot paste block type: " + typeName + ", skipping.");
      continue;
    }
    block._needsInitialSettings = false; // Don't show modal
    block._handlesOwnConnectors = true; // We manage connectors ourselves

    // Create at the target position (create uses center-based positioning)
    var newLeft = data.left + offset;
    var newTop = data.top + offset;
    var centerX = newLeft + (block.divWidth || 60) / 2;
    var centerY = newTop + (block.divHeight || 80) / 2;
    block.create(this, centerX, centerY);

    // Override position directly to match original exactly
    block.divObj.style.left = newLeft;
    block.divObj.style.top = newTop;
    if (block._updateExecOrderPosition) block._updateExecOrderPosition();

    // Apply serialized properties (may rebuild connectors for configurable blocks)
    if (block.applySerializedProps && Object.keys(data.props).length > 0) {
      var props = JSON.parse(JSON.stringify(data.props));
      // For DrawLine, offset the endpoints
      if (typeName === "DrawLine" && props.x1 !== undefined) {
        props.x1 += offset;
        props.y1 += offset;
        props.x2 += offset;
        props.y2 += offset;
      }
      block.applySerializedProps(props);
    }

    // Ensure connectors exist (for blocks that don't rebuild in applySerializedProps)
    if (block.inConnections.length === 0 && block.outConnections.length === 0) {
      block.addConnections();
    }

    // Restore inversions
    block.restoreInversions(data);

    // Register block
    block.indexNumber = this.blockIndex;
    this.blockObjects[this.blockIndex] = block;
    this.blockIndex++;

    newBlocks.push(block);

    // Select the new block
    block.divObj.style.border = "1px solid red";
    this.selectedBlocks.push(block);
  }

  // Step 2: Sync all connector positions (in case create positioned them differently)
  for (var i = 0; i < newBlocks.length; i++) {
    var block = newBlocks[i];
    for (var ci = 0; ci < block.inConnections.length; ci++) {
      block.inConnections[ci].moveConnector();
    }
    for (var co = 0; co < block.outConnections.length; co++) {
      block.outConnections[co].moveConnector();
    }
  }

  // Step 3: Recreate connections between pasted blocks
  for (var c = 0; c < this._clipboard.connections.length; c++) {
    var conn = this._clipboard.connections[c];
    var fromBlock = newBlocks[conn.fromBlock];
    var toBlock = newBlocks[conn.toBlock];

    if (
      fromBlock &&
      toBlock &&
      conn.fromPin < fromBlock.outConnections.length &&
      conn.toPin < toBlock.inConnections.length
    ) {
      var outConn = fromBlock.outConnections[conn.fromPin];
      var inConn = toBlock.inConnections[conn.toPin];

      // Only connect if input isn't already connected
      if (inConn.connectedFrom == null) {
        inConn.theLine = new LineObject(inConn, outConn);
        inConn.theLine.connectTo();
        outConn.addConnector(inConn);
        inConn.connectedFrom = outConn;
      }
    }
  }

  // Increase offset for next paste
  for (var i = 0; i < this._clipboard.blocks.length; i++) {
    this._clipboard.blocks[i].left += offset;
    this._clipboard.blocks[i].top += offset;
  }
};

SheetObject.prototype.addBlock = function (selection, t, l) {
  if (!this.simulateOn) {
    var block = this._createBlockInstance(selection);
    if (!block) {
      alert("Block type '" + selection + "' not found.");
      return;
    }
    this.blockObjects[this.blockIndex] = block;

    block.create(this, l, t);
    // Blocks with _handlesOwnConnectors skip automatic addConnections
    // (they call it themselves in their modal callback)
    if (!block._handlesOwnConnectors) {
      block.addConnections();
    }
    this.blockIndex++;
  } else {
    //alert("Error Adding: Cannot add while simulating!");
  }
};
SheetObject.prototype.blockSelected = function (obj, shiftKey) {
  if (shiftKey) {
    // Toggle this block in selection
    var idx = this.selectedBlocks.indexOf(obj);
    if (idx >= 0) {
      if (obj.resetStyle) obj.resetStyle();
      else obj.divObj.style.border = "1px solid black";
      if (obj._hideHandles) obj._hideHandles();
      this.selectedBlocks.splice(idx, 1);
    } else {
      obj.divObj.style.border = "1px solid red";
      if (obj._showHandles) obj._showHandles();
      this.selectedBlocks.push(obj);
    }
  } else {
    // Deselect everything, then select this block
    this.deselectAll();
    obj.divObj.style.border = "1px solid red";
    if (obj._showHandles) obj._showHandles();
    this.selectedBlocks.push(obj);
  }
  this.currentInstr = obj;
};
SheetObject.prototype.turnOffSelect = function () {
  this.selectBox = 0;
};
SheetObject.prototype.turnOnSelect = function () {
  this.selectBox = 1;
};
SheetObject.prototype.deselectAll = function () {
  // Deselect all blocks
  for (var i = 0; i < this.selectedBlocks.length; i++) {
    if (this.selectedBlocks[i].resetStyle) this.selectedBlocks[i].resetStyle();
    else this.selectedBlocks[i].divObj.style.border = "1px solid black";
    if (this.selectedBlocks[i]._hideHandles)
      this.selectedBlocks[i]._hideHandles();
  }
  this.selectedBlocks = [];
  this.currentInstr = null;

  // Deselect all lines
  for (var i = 0; i < this.selectedLines.length; i++) {
    this.selectedLines[i].deselect();
  }
  this.selectedLines = [];
  this.currentLine = null;
};
SheetObject.prototype.clickHandler = function (e) {
  // Clicking on white space - no action needed
};
SheetObject.prototype.lineSelected = function (lineObj, shiftKey) {
  if (shiftKey) {
    // Toggle this line in selection
    var idx = this.selectedLines.indexOf(lineObj);
    if (idx >= 0) {
      lineObj.deselect();
      this.selectedLines.splice(idx, 1);
    } else {
      lineObj.select();
      this.selectedLines.push(lineObj);
    }
  } else {
    // Deselect everything, then select this line
    this.deselectAll();
    lineObj.select();
    this.selectedLines.push(lineObj);
  }
  this.currentLine = lineObj;
  this.turnOffSelect();
};
SheetObject.prototype.showSelected = function () {
  if (this.currentInstr != null)
    this.currentInstr.divObj.style.border = "2px solid red";
};
SheetObject.prototype.removeSelectBox = function (e) {
  if (this.selectDiv != null) {
    this.canvas.removeChild(this.selectDiv);
    this.selectDiv = null;
  }
};
SheetObject.prototype.growSelectBox = function (e) {
  if (this.selectDiv != null && this.selectBox == 1) {
    if (
      e.clientX >= parseInt(this.selectDiv.style.left) &&
      e.clientY >= parseInt(this.selectDiv.style.top)
    ) {
      this.selectWidth = e.clientX - parseInt(this.selectDiv.style.left);
      this.selectHeight = e.clientY - parseInt(this.selectDiv.style.top);
      window.status = this.selectWidth + " : " + this.selectHeight;
    } else {
      this.selectWidth = 5;
      this.selectHeight = 5;
    }
    this.selectDiv.style.width = this.selectWidth;
    this.selectDiv.style.height = this.selectHeight;
    this.selectInProgress = 1;
  }
};

SheetObject.prototype.toggleSimulate = function () {
  var btn = document.getElementById("simButton");
  var blockList = document.getElementById("blockList");

  if (this.simulateOn == 0) {
    this.simulateOn = 1;
    btn.innerHTML = "&#9724;";
    btn.classList.add("running");
    blockList.disabled = true;
  } else {
    this.simulateOn = 0;
    btn.innerHTML = "&#9654;";
    btn.classList.remove("running");
    blockList.disabled = false;
    // Reset all block, line and connector colors to engineering mode
    for (var i = 0; i < this.blockObjects.length; i++) {
      var block = this.blockObjects[i];
      if (block.resetStyle) {
        block.resetStyle();
      } else {
        block.divObj.style.border = "1px solid black";
      }
      for (var o = 0; o < block.outConnections.length; o++) {
        var outConn = block.outConnections[o];
        outConn.theConnector.style.backgroundColor = outConn.defaultColor;
        if (outConn.inverted) outConn.invertCircle.style.borderColor = "black";
        for (var c = 0; c < outConn.connectedTo.length; c++) {
          if (outConn.connectedTo[c].theLine) {
            outConn.connectedTo[c].theLine.changeColor(outConn.defaultColor);
          }
          outConn.connectedTo[c].theConnector.style.backgroundColor =
            outConn.connectedTo[c].defaultColor;
          if (outConn.connectedTo[c].inverted)
            outConn.connectedTo[c].invertCircle.style.borderColor = "black";
        }
      }
      for (var inp = 0; inp < block.inConnections.length; inp++) {
        block.inConnections[inp].theConnector.style.backgroundColor =
          block.inConnections[inp].defaultColor;
        if (block.inConnections[inp].inverted)
          block.inConnections[inp].invertCircle.style.borderColor = "black";
      }
    }
  }
};
SheetObject.prototype.doubleClickHandler = function (e) {
  if (document.getElementById("modalOverlay").classList.contains("visible"))
    return;
  if (e.altKey) return; // Alt is used for panning
  if (!this.canvas.contains(e.target) && e.target !== this.canvas) return; // Click outside canvas

  // Check if dblclick happened on an existing block
  for (var i = 0; i < this.blockObjects.length; i++) {
    if (this.blockObjects[i].divObj.contains(e.target)) return;
    // Also check connectors (they're not children of the block div)
    var block = this.blockObjects[i];
    for (var c = 0; c < block.inConnections.length; c++) {
      if (block.inConnections[c].hitbox === e.target) return;
    }
    for (var c = 0; c < block.outConnections.length; c++) {
      if (block.outConnections[c].hitbox === e.target) return;
    }
  }

  try {
    var currentBlock = document.getElementById("blockList").value;
    if (!this.simulateOn) {
      var canvasPos = this.screenToCanvas(e.clientX, e.clientY);
      if (this.snapToGrid) {
        var snapped = this.snapToGridPoint(canvasPos.x, canvasPos.y);
        this.addBlock(currentBlock, snapped.x, snapped.y);
      } else {
        this.addBlock(currentBlock, canvasPos.x, canvasPos.y);
      }
    }
  } catch (e) {}
};

SheetObject.prototype.clickHandler = function (e) {
  // No action on white space click
};

SheetObject.prototype.startDragPreview = function (connector, e) {
  var sheet = this;
  // Create preview line in canvas
  this.dragPreviewLine = document.createElement("div");
  this.dragPreviewLine.style.position = "absolute";
  this.dragPreviewLine.style.height = "2px";
  this.dragPreviewLine.style.backgroundColor = "rgb(100,180,255)";
  this.dragPreviewLine.style.transformOrigin = "0 0";
  this.dragPreviewLine.style.zIndex = "100";
  this.dragPreviewLine.style.pointerEvents = "none";
  this.canvas.appendChild(this.dragPreviewLine);

  // Arrow head
  this.dragPreviewArrow = document.createElement("div");
  this.dragPreviewArrow.style.position = "absolute";
  this.dragPreviewArrow.style.width = "0";
  this.dragPreviewArrow.style.height = "0";
  this.dragPreviewArrow.style.borderLeft = "8px solid rgb(100,180,255)";
  this.dragPreviewArrow.style.borderTop = "5px solid transparent";
  this.dragPreviewArrow.style.borderBottom = "5px solid transparent";
  this.dragPreviewArrow.style.zIndex = "100";
  this.dragPreviewArrow.style.pointerEvents = "none";
  this.canvas.appendChild(this.dragPreviewArrow);

  var startX =
    parseInt(connector.theConnector.style.left) + connector.connectorWidth;
  var startY = parseInt(connector.theConnector.style.top);

  this._dragMoveHandler = function (ev) {
    var mouseCanvas = sheet.screenToCanvas(ev.clientX, ev.clientY);
    var dx = mouseCanvas.x - startX;
    var dy = mouseCanvas.y - startY;
    var len = Math.sqrt(dx * dx + dy * dy);
    var angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    sheet.dragPreviewLine.style.left = startX + "px";
    sheet.dragPreviewLine.style.top = startY + "px";
    sheet.dragPreviewLine.style.width = Math.max(len - 8, 0) + "px";
    sheet.dragPreviewLine.style.transform = "rotate(" + angle + "deg)";

    // Position arrowhead at mouse in canvas coords
    sheet.dragPreviewArrow.style.left = mouseCanvas.x - 8 + "px";
    sheet.dragPreviewArrow.style.top = mouseCanvas.y - 5 + "px";
    sheet.dragPreviewArrow.style.transform = "rotate(" + angle + "deg)";
  };

  this._dragUpHandler = function (ev) {
    sheet.stopDragPreview();
  };

  document.addEventListener("mousemove", this._dragMoveHandler, true);
  document.addEventListener("mouseup", this._dragUpHandler, true);
};

SheetObject.prototype.stopDragPreview = function () {
  if (this.dragPreviewLine) {
    this.canvas.removeChild(this.dragPreviewLine);
    this.dragPreviewLine = null;
  }
  if (this.dragPreviewArrow) {
    this.canvas.removeChild(this.dragPreviewArrow);
    this.dragPreviewArrow = null;
  }
  if (this._dragMoveHandler) {
    document.removeEventListener("mousemove", this._dragMoveHandler, true);
    document.removeEventListener("mouseup", this._dragUpHandler, true);
    this._dragMoveHandler = null;
    this._dragUpHandler = null;
  }
};

SheetObject.prototype.keyDownHandler = function (e) {
  // Don't handle keys when a modal is open
  if (document.getElementById("modalOverlay").classList.contains("visible"))
    return;
  var cbOverlay = document.getElementById("customBlockOverlay");
  if (cbOverlay && cbOverlay.classList.contains("visible")) return;

  // Escape: deselect all
  if (e.keyCode == 27) {
    this.deselectAll();
    return;
  }

  // During simulation: dispatch keybindings to DI blocks
  if (this.simulateOn) {
    var key = e.key.toLowerCase();
    for (var k = 0; k < this.blockObjects.length; k++) {
      if (this.blockObjects[k].handleKeyDown) {
        this.blockObjects[k].handleKeyDown(key);
      }
    }
    return;
  }

  // Ctrl+C: Copy selected blocks
  if ((e.ctrlKey || e.metaKey) && e.keyCode == 67) {
    this.copySelection();
    return;
  }

  // Ctrl+V: Paste clipboard
  if ((e.ctrlKey || e.metaKey) && e.keyCode == 86) {
    e.preventDefault();
    this.pasteClipboard();
    return;
  }

  // Arrow keys: move selected blocks by 1px
  if (e.keyCode >= 37 && e.keyCode <= 40 && this.selectedBlocks.length > 0) {
    e.preventDefault();
    var step = e.shiftKey ? 10 : 1;
    var dx = 0,
      dy = 0;
    if (e.keyCode == 37) dx = -step; // left
    if (e.keyCode == 39) dx = step; // right
    if (e.keyCode == 38) dy = -step; // up
    if (e.keyCode == 40) dy = step; // down
    var canvasW = parseInt(this.canvas.style.width) || 10000;
    var canvasH = parseInt(this.canvas.style.height) || 10000;
    for (var b = 0; b < this.selectedBlocks.length; b++) {
      var block = this.selectedBlocks[b];
      // DrawLine needs special handling — move endpoints
      if (block.objectName === "DrawLine") {
        block.x1 += dx;
        block.y1 += dy;
        block.x2 += dx;
        block.y2 += dy;
        // Clamp
        var lminX = Math.min(block.x1, block.x2);
        var lminY = Math.min(block.y1, block.y2);
        var lmaxX = Math.max(block.x1, block.x2);
        var lmaxY = Math.max(block.y1, block.y2);
        if (lminX < 0) {
          block.x1 -= lminX;
          block.x2 -= lminX;
        }
        if (lminY < 0) {
          block.y1 -= lminY;
          block.y2 -= lminY;
        }
        if (lmaxX > canvasW) {
          var d = lmaxX - canvasW;
          block.x1 -= d;
          block.x2 -= d;
        }
        if (lmaxY > canvasH) {
          var d = lmaxY - canvasH;
          block.y1 -= d;
          block.y2 -= d;
        }
        block._updateGeometry();
        continue;
      }
      var newLeft = parseInt(block.divObj.style.left) + dx;
      var newTop = parseInt(block.divObj.style.top) + dy;
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      if (newLeft + block.divWidth > canvasW)
        newLeft = canvasW - block.divWidth;
      if (newTop + block.divHeight > canvasH)
        newTop = canvasH - block.divHeight;
      block.divObj.style.left = newLeft;
      block.divObj.style.top = newTop;
      if (block._updateExecOrderPosition) block._updateExecOrderPosition();
      for (var ci = 0; ci < block.inConnections.length; ci++) {
        block.inConnections[ci].moveConnector();
      }
      for (var co = 0; co < block.outConnections.length; co++) {
        block.outConnections[co].moveConnector();
      }
    }
    this._updateSelCoords();
    return;
  }

  // Delete or Backspace
  if (e.keyCode == 46 || e.keyCode == 8) {
    // Delete all selected lines
    for (var l = 0; l < this.selectedLines.length; l++) {
      this.selectedLines[l].deleteLine();
    }
    this.selectedLines = [];
    this.currentLine = null;

    // Delete all selected blocks
    for (var b = 0; b < this.selectedBlocks.length; b++) {
      var block = this.selectedBlocks[b];
      block.removeConnectors();
      for (var i = 0; i < this.blockObjects.length; i++) {
        if (this.blockObjects[i] == block) {
          this.blockObjects.splice(i, 1);
          this.blockIndex--;
          i--; // adjust index after splice
        }
      }
    }
    this.selectedBlocks = [];
    this.currentInstr = null;

    // Reindex block array
    for (var x = 0; x < this.blockObjects.length; x++)
      this.blockObjects[x].indexNumber = x;
  }
};

SheetObject.prototype.keyUpHandler = function (e) {
  if (document.getElementById("modalOverlay").classList.contains("visible"))
    return;

  if (this.simulateOn) {
    var key = e.key.toLowerCase();
    for (var k = 0; k < this.blockObjects.length; k++) {
      if (this.blockObjects[k].handleKeyUp) {
        this.blockObjects[k].handleKeyUp(key);
      }
    }
  }
};

SheetObject.prototype.getJSON = function (index) {
  var tempObj = {
    index: 0,
    objecttype: "null",
    l: 0,
    t: 0,
    outConnections: [],
  };

  tempObj.index = this.blockObjects[index].indexNumber;
  tempObj.objecttype = this.blockObjects[index].objectName;
  tempObj.l = this.blockObjects[index].divObj.style.left;
  tempObj.t = this.blockObjects[index].divObj.style.top;

  if (this.blockObjects[index].outConnections.length > 1) {
    //get all connectors and the indexes of the blocks
    //they are connected to
    var tempConnections = this.blockObjects[index].outConnections;
    for (var i = 0; i < tempConnections.length - 1; i++) {
      //check the connectedTo array and get indexes
      if (tempConnections[i].connectedTo.length > 1) {
      }
    }
  }
};
