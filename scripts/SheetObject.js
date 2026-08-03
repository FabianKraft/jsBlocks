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
  // Grid and page sizes are derived from a fixed pixels-per-millimeter scale
  // (see PX_PER_MM). The default 12px grid == 3mm, the largest raster that
  // divides every A-format edge (210, 297, 420mm) evenly, so page boundaries
  // always land on grid lines.
  this.gridSize = 12;
  this.snapToGrid = false;
  this.snapEnabled = true;
  this.snapVisible = true;
  this.snapLinesToGrid = false;

  // Orthogonal A* router for connection lines (obstacle + overlap aware).
  this.lineRouter = new LineRouter(this);

  // Cross-reference panel (tag/label lookup, docked bottom-right).
  this.crossRef = new CrossRef(this);

  // Project name (used in the saved file and its filename).
  this.projectName = "";

  // Caption shown in the small type box of every Label In/Out panel. Purely
  // cosmetic (does not affect label name, simulation, or export).
  this.labelPanelText = "LABEL";

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

  // Context menu: middle click never shows one; right click opens the
  // page Copy/Move menu when a page format is active.
  this.viewport.addEventListener(
    "contextmenu",
    function (e) {
      if (e.button === 1) {
        e.preventDefault();
        return;
      }
      sheetObj._handlePageContextMenu(e);
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
            // Junction dots carry the same signal as the net's lines.
            if (outConn.junctionDots) {
              var dotColor = effVal ? "rgb(3,255,3)" : "rgb(0,0,255)";
              for (var jd = 0; jd < outConn.junctionDots.length; jd++) {
                outConn.junctionDots[jd].style.backgroundColor = dotColor;
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
  this.rerouteAllLines();
};

// Collect every connection line on the sheet, in a stable order.
SheetObject.prototype._allLines = function () {
  var lines = [];
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    if (!block.inConnections) continue;
    for (var j = 0; j < block.inConnections.length; j++) {
      var conn = block.inConnections[j];
      if (conn && conn.theLine) lines.push(conn.theLine);
    }
  }
  return lines;
};

SheetObject.prototype._redrawAllLines = function () {
  var lines = this._allLines();
  for (var i = 0; i < lines.length; i++) lines[i].connectTo();
};

// Full-quality reroute of every line, grouped into nets by their output pin.
// Lines of the SAME net (same signal) are attracted onto a shared trunk and get
// junction dots where they branch; lines of DIFFERENT nets repel each other so
// unrelated signals stay in separate lanes and simply cross without a dot.
SheetObject.prototype.rerouteAllLines = function () {
  if (!this.lineRouter) {
    this._redrawAllLines();
    return;
  }

  this._clearAllJunctionDots();

  // Group lines by output connector (= one signal / net).
  var nets = [];
  var outs = [];
  var all = this._allLines();
  for (var i = 0; i < all.length; i++) {
    var out = all[i].fromConnectorObj;
    var idx = outs.indexOf(out);
    if (idx < 0) {
      outs.push(out);
      nets.push({ out: out, lines: [all[i]] });
    } else {
      nets[idx].lines.push(all[i]);
    }
  }

  var byLen = function (a, b) {
    var ea = a._endpoints();
    var eb = b._endpoints();
    var da = Math.abs(ea.to.x - ea.from.x) + Math.abs(ea.to.y - ea.from.y);
    var db = Math.abs(eb.to.x - eb.from.x) + Math.abs(eb.to.y - eb.from.y);
    return da - db;
  };

  this.lineRouter.clearOccupancy();
  for (var n = 0; n < nets.length; n++) {
    var net = nets[n];
    net.lines.sort(byLen); // grow the trunk from the shortest branch outward
    var prefer = {};
    for (var l = 0; l < net.lines.length; l++) {
      var line = net.lines[l];
      var pts = line.computeNetPath(prefer);
      line._applyPath(pts);
      this.lineRouter.addPathCells(prefer, pts);
    }
    // Fold the whole net into occupancy so later nets route around it.
    this.lineRouter.stampCells(prefer);
    // Draw connection dots where this net's lines branch (T / crossing).
    this._drawNetJunctions(net);
  }
};

// Remove every net's junction dots from the canvas.
SheetObject.prototype._clearAllJunctionDots = function () {
  for (var i = 0; i < this.blockObjects.length; i++) {
    var block = this.blockObjects[i];
    if (!block.outConnections) continue;
    for (var o = 0; o < block.outConnections.length; o++) {
      var oc = block.outConnections[o];
      if (oc.junctionDots) {
        for (var d = 0; d < oc.junctionDots.length; d++) {
          if (oc.junctionDots[d].parentNode) {
            oc.junctionDots[d].parentNode.removeChild(oc.junctionDots[d]);
          }
        }
        oc.junctionDots = [];
      }
    }
  }
};

// Create the junction dots for a single net.
SheetObject.prototype._drawNetJunctions = function (net) {
  var out = net.out;
  if (!out.junctionDots) out.junctionDots = [];
  if (net.lines.length < 2) return;

  var points = this._computeNetJunctions(net.lines);
  var color = out.defaultColor || "black";
  for (var i = 0; i < points.length; i++) {
    var dot = document.createElement("div");
    dot.className = "line-junction";
    dot.style.position = "absolute";
    dot.style.width = "7px";
    dot.style.height = "7px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = color;
    dot.style.zIndex = "1";
    dot.style.pointerEvents = "none";
    dot.style.left = points[i].x - 3.5 + "px";
    dot.style.top = points[i].y - 3.5 + "px";
    this.canvas.appendChild(dot);
    out.junctionDots.push(dot);
  }
};

// Find branch points of a net: a point where, within this net, three or more
// orthogonal directions meet (a T-junction or crossing). Straight pass-throughs
// and simple corners (degree 2) are ignored.
SheetObject.prototype._computeNetJunctions = function (lines) {
  var segs = [];
  var candMap = {};
  var cand = [];
  var addCand = function (p) {
    var key = Math.round(p.x) + "," + Math.round(p.y);
    if (!candMap[key]) {
      candMap[key] = true;
      cand.push({ x: p.x, y: p.y });
    }
  };
  for (var i = 0; i < lines.length; i++) {
    var p = lines[i]._path;
    if (!p || p.length < 2) continue;
    for (var j = 0; j < p.length - 1; j++) {
      segs.push({ ax: p[j].x, ay: p[j].y, bx: p[j + 1].x, by: p[j + 1].y });
      addCand(p[j]);
      addCand(p[j + 1]);
    }
  }

  var eps = 0.5;
  var result = [];
  for (var c = 0; c < cand.length; c++) {
    var P = cand[c];
    var L = false,
      R = false,
      U = false,
      D = false;
    for (var s = 0; s < segs.length; s++) {
      var sg = segs[s];
      if (Math.abs(sg.ay - sg.by) < eps) {
        // horizontal segment
        if (Math.abs(P.y - sg.ay) < eps) {
          var lo = Math.min(sg.ax, sg.bx);
          var hi = Math.max(sg.ax, sg.bx);
          if (P.x > lo - eps && P.x < hi + eps) {
            if (P.x > lo + eps) L = true;
            if (P.x < hi - eps) R = true;
          }
        }
      } else if (Math.abs(sg.ax - sg.bx) < eps) {
        // vertical segment
        if (Math.abs(P.x - sg.ax) < eps) {
          var loy = Math.min(sg.ay, sg.by);
          var hiy = Math.max(sg.ay, sg.by);
          if (P.y > loy - eps && P.y < hiy + eps) {
            if (P.y > loy + eps) U = true;
            if (P.y < hiy - eps) D = true;
          }
        }
      }
    }
    var deg = (L ? 1 : 0) + (R ? 1 : 0) + (U ? 1 : 0) + (D ? 1 : 0);
    if (deg >= 3) result.push(P);
  }
  return result;
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

// Logical pixels per millimeter. Every page and grid dimension is derived from
// this so page edges always fall on whole grid cells. 4 px/mm keeps all
// A-format sizes integer (e.g. 210mm -> 840px) and makes a 3mm grid == 12px.
// The on-screen size is purely logical (the canvas is zoomable); PDF export
// uses the pdfW/pdfH millimeter values below, so print scale stays exact.
SheetObject.prototype.PX_PER_MM = 4;

SheetObject.prototype.PAGE_FORMATS = {
  none: null,
  a4p: {
    w: 840, // 210mm * 4
    h: 1188, // 297mm * 4
    label: "A4 Portrait",
    orient: "portrait",
    pdfW: 210,
    pdfH: 297,
  },
  a4l: {
    w: 1188, // 297mm * 4
    h: 840, // 210mm * 4
    label: "A4 Landscape",
    orient: "landscape",
    pdfW: 297,
    pdfH: 210,
  },
  a3p: {
    w: 1188, // 297mm * 4
    h: 1680, // 420mm * 4
    label: "A3 Portrait",
    orient: "portrait",
    pdfW: 297,
    pdfH: 420,
  },
  a3l: {
    w: 1680, // 420mm * 4
    h: 1188, // 297mm * 4
    label: "A3 Landscape",
    orient: "landscape",
    pdfW: 420,
    pdfH: 297,
  },
};

// Set the grid to the largest raster that divides the active page format's
// width and height evenly (the gcd of its mm edges, scaled to px). For every
// A-format this is 3mm (12px), so page boundaries land exactly on grid lines.
SheetObject.prototype.fitGridToPage = function () {
  var fmt = this.PAGE_FORMATS[this.currentPageFormat];
  if (!fmt) {
    alert("Please select a page format first (Settings → Page).");
    return;
  }
  var gcd = function (a, b) {
    return b ? gcd(b, a % b) : a;
  };
  var gridMm = gcd(fmt.pdfW, fmt.pdfH); // 3mm for A4/A3
  this.setGridSize(gridMm * this.PX_PER_MM);
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

// --- Page Copy / Move (right-click context menu) ---

// Describe the current page grid, or null when no page format is active.
SheetObject.prototype._getPageGrid = function () {
  var format = this.currentPageFormat;
  if (!format || format === "none") return null;
  var fmt = this.PAGE_FORMATS[format];
  if (!fmt) return null;
  var canvasW = parseInt(this.canvas.style.width) || 10000;
  var canvasH = parseInt(this.canvas.style.height) || 10000;
  var cols = Math.floor(canvasW / fmt.w);
  var rows = Math.floor(canvasH / fmt.h);
  return { fmt: fmt, cols: cols, rows: rows, count: cols * rows };
};

// Bounding rect (in canvas coordinates) of a 1-based page number, or null.
SheetObject.prototype._pageRect = function (pageNumber) {
  var grid = this._getPageGrid();
  if (!grid) return null;
  if (pageNumber < 1 || pageNumber > grid.count) return null;
  var idx = pageNumber - 1;
  var r = Math.floor(idx / grid.cols);
  var c = idx % grid.cols;
  var left = c * grid.fmt.w;
  var top = r * grid.fmt.h;
  return {
    left: left,
    top: top,
    right: left + grid.fmt.w,
    bottom: top + grid.fmt.h,
    row: r,
    col: c,
  };
};

// 1-based page number containing a canvas point, or null when outside the grid.
SheetObject.prototype._pageNumberAtCanvas = function (x, y) {
  var grid = this._getPageGrid();
  if (!grid) return null;
  if (x < 0 || y < 0) return null;
  var c = Math.floor(x / grid.fmt.w);
  var r = Math.floor(y / grid.fmt.h);
  if (c >= grid.cols || r >= grid.rows) return null;
  return r * grid.cols + c + 1;
};

// All blocks lying fully inside the given page's bounds.
SheetObject.prototype._blocksOnPage = function (pageNumber) {
  var rect = this._pageRect(pageNumber);
  var result = [];
  if (!rect) return result;
  for (var i = 0; i < this.blockObjects.length; i++) {
    var blk = this.blockObjects[i];
    if (!blk || !blk.divObj) continue;
    var bLeft = parseInt(blk.divObj.style.left) || 0;
    var bTop = parseInt(blk.divObj.style.top) || 0;
    var bW = parseInt(blk.divObj.style.width) || blk.divWidth || 0;
    var bH = parseInt(blk.divObj.style.height) || blk.divHeight || 0;
    var bRight = bLeft + bW;
    var bBottom = bTop + bH;
    if (
      bLeft >= rect.left &&
      bTop >= rect.top &&
      bRight <= rect.right &&
      bBottom <= rect.bottom
    ) {
      result.push(blk);
    }
  }
  return result;
};

// Entry point wired to the viewport "contextmenu" event.
SheetObject.prototype._handlePageContextMenu = function (e) {
  this._removePageContextMenu();
  var grid = this._getPageGrid();
  if (!grid) return; // No page format → let the browser menu appear

  var cp = this.screenToCanvas(e.clientX, e.clientY);
  var pageNumber = this._pageNumberAtCanvas(cp.x, cp.y);
  if (pageNumber == null) return; // Outside the page grid

  e.preventDefault();
  this._showPageContextMenu(e.clientX, e.clientY, pageNumber);
};

SheetObject.prototype._removePageContextMenu = function () {
  if (this._pageContextMenu && this._pageContextMenu.parentNode) {
    this._pageContextMenu.parentNode.removeChild(this._pageContextMenu);
  }
  this._pageContextMenu = null;
  if (this._pageContextMenuCloser) {
    document.removeEventListener("mousedown", this._pageContextMenuCloser, true);
    window.removeEventListener("blur", this._pageContextMenuCloser);
    this._pageContextMenuCloser = null;
  }
};

SheetObject.prototype._showPageContextMenu = function (
  clientX,
  clientY,
  pageNumber,
) {
  var sheet = this;
  var menu = document.createElement("div");
  menu.className = "page-context-menu";
  menu.style.position = "fixed";
  menu.style.left = clientX + "px";
  menu.style.top = clientY + "px";
  menu.style.zIndex = "1200";
  menu.style.minWidth = "120px";
  menu.style.background = "#ffffff";
  menu.style.border = "1px solid #888";
  menu.style.borderRadius = "4px";
  menu.style.boxShadow = "0 3px 10px rgba(0,0,0,0.25)";
  menu.style.padding = "4px 0";
  menu.style.fontFamily = "Calibri, Arial, sans-serif";
  menu.style.fontSize = "13px";
  menu.style.userSelect = "none";

  var header = document.createElement("div");
  header.textContent = "Page " + pageNumber;
  header.style.padding = "2px 14px 4px 14px";
  header.style.color = "#888";
  header.style.fontSize = "11px";
  header.style.borderBottom = "1px solid #eee";
  header.style.marginBottom = "3px";
  menu.appendChild(header);

  function addItem(text, handler) {
    var item = document.createElement("div");
    item.textContent = text;
    item.style.padding = "5px 14px";
    item.style.cursor = "pointer";
    item.addEventListener("mouseenter", function () {
      item.style.background = "#e8f0fe";
    });
    item.addEventListener("mouseleave", function () {
      item.style.background = "";
    });
    item.addEventListener("mousedown", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      sheet._removePageContextMenu();
      handler();
    });
    menu.appendChild(item);
  }

  addItem("Copy", function () {
    sheet._openPageTransferDialog("copy", pageNumber);
  });
  addItem("Move", function () {
    sheet._openPageTransferDialog("move", pageNumber);
  });

  document.body.appendChild(menu);
  this._pageContextMenu = menu;

  // Keep the menu inside the viewport
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = window.innerWidth - rect.width - 4 + "px";
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = window.innerHeight - rect.height - 4 + "px";
  }

  // Dismiss on any outside interaction
  this._pageContextMenuCloser = function (ev) {
    if (ev && ev.type === "mousedown" && menu.contains(ev.target)) return;
    sheet._removePageContextMenu();
  };
  document.addEventListener("mousedown", this._pageContextMenuCloser, true);
  window.addEventListener("blur", this._pageContextMenuCloser);
};

// Parse a page selection like "2, 4, 7-10" into a de-duplicated list of page
// numbers, in the order they were entered. Ranges are inclusive and may be
// written in either direction ("10-7" == "7-10"). Returns either
// { targets: [...] } or { error: "..." } for the caller to report.
//
// The source page is silently dropped when it only appears inside a range —
// "copy page 3 onto 1-10" plainly means the other nine pages — but naming it
// on its own stays an error, because that is a mistake rather than shorthand.
SheetObject.prototype._parsePageSelection = function (raw, max, sourcePage) {
  var parts = String(raw == null ? "" : raw).split(",");
  var targets = [];

  var addTarget = function (n) {
    if (targets.indexOf(n) === -1) targets.push(n);
  };
  var outOfRange = function (n) {
    return n < 1 || n > max;
  };

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part === "") continue;

    var range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      var from = parseInt(range[1], 10);
      var to = parseInt(range[2], 10);
      if (from > to) {
        var swap = from;
        from = to;
        to = swap;
      }
      if (outOfRange(from) || outOfRange(to)) {
        return {
          error:
            'Range "' + part + '" is out of range (1–' + max + ").",
        };
      }
      for (var n = from; n <= to; n++) {
        if (n !== sourcePage) addTarget(n);
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      return { error: 'Invalid page number: "' + part + '"' };
    }
    var single = parseInt(part, 10);
    if (outOfRange(single)) {
      return { error: "Page " + single + " is out of range (1–" + max + ")." };
    }
    if (single === sourcePage) {
      return { error: "Target page must differ from the source page." };
    }
    addTarget(single);
  }

  return { targets: targets };
};

// Build and show the Copy/Move dialog. mode is "copy" or "move".
SheetObject.prototype._openPageTransferDialog = function (mode, sourcePage) {
  var grid = this._getPageGrid();
  if (!grid) return;
  var sheet = this;
  var isCopy = mode === "copy";
  var title = isCopy ? "Copy Page" : "Move Page";
  var targetHint = isCopy
    ? "Target page(s) — comma separated, ranges allowed, e.g. 2, 4, 7-10"
    : "Target page";

  var html =
    "<h3>" +
    title +
    "</h3>" +
    '<div class="modal-row">' +
    "<label>Source</label>" +
    '<input type="text" value="' +
    sourcePage +
    '" readonly style="background:#f0f0f0;" />' +
    "</div>" +
    '<div class="modal-row">' +
    "<label>Target</label>" +
    '<input type="text" id="pageTransferTarget" placeholder="' +
    (isCopy ? "e.g. 2, 4, 7-10" : "e.g. 3") +
    '" />' +
    "</div>" +
    '<div style="font-size:11px;color:#888;margin:-4px 0 8px 108px;">' +
    targetHint +
    " (1–" +
    grid.count +
    ")</div>" +
    '<div class="modal-row">' +
    '<label>Destructive</label>' +
    '<input type="checkbox" id="pageTransferDestructive" style="width:auto;flex:none;" />' +
    '<span style="font-size:11px;color:#888;">overwrite target instead of adding</span>' +
    "</div>";

  Base.showModal(html, function () {
    var raw = document.getElementById("pageTransferTarget").value || "";
    var destructive = document.getElementById(
      "pageTransferDestructive",
    ).checked;

    // Parse target page numbers — single pages and ranges ("2, 4, 7-10")
    var parsed = sheet._parsePageSelection(raw, grid.count, sourcePage);
    if (parsed.error) {
      alert(parsed.error);
      return;
    }
    var targets = parsed.targets;

    if (targets.length === 0) {
      alert("Please enter at least one target page.");
      return;
    }
    if (!isCopy && targets.length > 1) {
      alert("Move supports only a single target page.");
      return;
    }

    sheet._transferPage(sourcePage, targets, {
      destructive: destructive,
      keepSource: isCopy,
    });
  });
};

// Copy (keepSource) or Move the content of sourcePage onto one or more targets.
SheetObject.prototype._transferPage = function (sourcePage, targets, opts) {
  var sourceRect = this._pageRect(sourcePage);
  if (!sourceRect) return;

  var sourceBlocks = this._blocksOnPage(sourcePage);
  if (sourceBlocks.length === 0) {
    alert("The source page is empty — nothing to " +
      (opts.keepSource ? "copy" : "move") + ".");
    return;
  }

  // Serialize the source once; every target is rebuilt from this snapshot.
  var snapshot = this._snapshotBlocks(sourceBlocks);

  this.deselectAll();

  for (var t = 0; t < targets.length; t++) {
    var targetRect = this._pageRect(targets[t]);
    if (!targetRect) continue;

    if (opts.destructive) {
      this._deleteBlocks(this._blocksOnPage(targets[t]));
    }

    var dx = targetRect.left - sourceRect.left;
    var dy = targetRect.top - sourceRect.top;
    this._rebuildSnapshot(snapshot, dx, dy);
  }

  // Move removes the source content after it has been replicated.
  if (!opts.keepSource) {
    this._deleteBlocks(this._blocksOnPage(sourcePage));
  }
};

// Serialize a set of blocks together with the connections *between* them.
SheetObject.prototype._snapshotBlocks = function (blocks) {
  var snap = { blocks: [], connections: [] };
  for (var i = 0; i < blocks.length; i++) {
    var data = blocks[i].serialize();
    snap.blocks.push(data);
  }
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    for (var o = 0; o < block.outConnections.length; o++) {
      var outConn = block.outConnections[o];
      for (var c = 0; c < outConn.connectedTo.length; c++) {
        var inConn = outConn.connectedTo[c];
        var targetBlock = inConn.instruction;
        var targetIdx = blocks.indexOf(targetBlock);
        if (targetIdx >= 0) {
          var inIdx = targetBlock.inConnections.indexOf(inConn);
          snap.connections.push({
            fromBlock: i,
            fromPin: o,
            toBlock: targetIdx,
            toPin: inIdx,
            waypoints: this._serializeWaypoints(inConn.theLine),
          });
        }
      }
    }
  }
  return snap;
};

// Recreate a snapshot on the canvas, offset by (dx, dy). Returns the new blocks.
SheetObject.prototype._rebuildSnapshot = function (snapshot, dx, dy) {
  var newBlocks = [];

  for (var i = 0; i < snapshot.blocks.length; i++) {
    var data = snapshot.blocks[i];
    var block = this._createBlockInstance(data.type);
    if (!block) {
      console.warn("Cannot transfer block type: " + data.type + ", skipping.");
      newBlocks.push(null);
      continue;
    }
    block._needsInitialSettings = false;
    block._handlesOwnConnectors = true;

    var newLeft = data.left + dx;
    var newTop = data.top + dy;
    var centerX = newLeft + (block.divWidth || 60) / 2;
    var centerY = newTop + (block.divHeight || 80) / 2;
    block.create(this, centerX, centerY);

    block.divObj.style.left = newLeft;
    block.divObj.style.top = newTop;
    if (block._updateExecOrderPosition) block._updateExecOrderPosition();

    if (block.applySerializedProps && Object.keys(data.props).length > 0) {
      block.applySerializedProps(JSON.parse(JSON.stringify(data.props)));
    }

    if (block.inConnections.length === 0 && block.outConnections.length === 0) {
      block.addConnections();
    }

    block.restoreInversions(data);

    block.indexNumber = this.blockIndex;
    this.blockObjects[this.blockIndex] = block;
    this.blockIndex++;
    newBlocks.push(block);
  }

  // Sync connector positions after placement
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

  // Recreate intra-page connections
  for (var c = 0; c < snapshot.connections.length; c++) {
    var conn = snapshot.connections[c];
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
        inConn.theLine.waypoints = this._deserializeWaypoints(
          conn.waypoints,
          dx,
          dy,
        );
        inConn.theLine.connectTo();
        outConn.addConnector(inConn);
        inConn.connectedFrom = outConn;
      }
    }
  }

  this.rerouteAllLines();
  return newBlocks;
};

// --- Waypoint (manual line route) serialization helpers ---

SheetObject.prototype._serializeWaypoints = function (line) {
  if (!line || !line.waypoints || line.waypoints.length === 0) return undefined;
  var out = [];
  for (var i = 0; i < line.waypoints.length; i++) {
    out.push({ x: line.waypoints[i].x, y: line.waypoints[i].y });
  }
  return out;
};

SheetObject.prototype._deserializeWaypoints = function (wps, dx, dy) {
  if (!wps || !wps.length) return [];
  dx = dx || 0;
  dy = dy || 0;
  var out = [];
  for (var i = 0; i < wps.length; i++) {
    out.push({ x: wps[i].x + dx, y: wps[i].y + dy });
  }
  return out;
};

// Fully remove a list of blocks (connectors, lines, DOM node) from the sheet.
SheetObject.prototype._deleteBlocks = function (blocks) {
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (!block) continue;
    block.removeConnectors();

    var selIdx = this.selectedBlocks.indexOf(block);
    if (selIdx >= 0) this.selectedBlocks.splice(selIdx, 1);
    if (this.currentInstr === block) this.currentInstr = null;

    var idx = this.blockObjects.indexOf(block);
    if (idx >= 0) {
      this.blockObjects.splice(idx, 1);
      this.blockIndex--;
    }
  }
  // Reindex remaining blocks
  for (var x = 0; x < this.blockObjects.length; x++) {
    this.blockObjects[x].indexNumber = x;
  }
  // A deleted Label In may leave Label Out panels without a reference.
  this.refreshLabelPanels();
};

// --- PDF Export ---

// Bounding boxes (in canvas coordinates) of everything that counts as drawing
// content: the blocks plus the routed connection lines and their junction dots.
// Page markings are deliberately left out — they span the whole sheet and would
// make every single page look occupied. Layout offsets are used rather than the
// inline styles because line segments carry no inline width/height and the
// offsets are unaffected by the canvas zoom transform.
SheetObject.prototype._contentRects = function () {
  var rects = [];
  var add = function (el) {
    if (!el) return;
    rects.push({
      left: el.offsetLeft,
      top: el.offsetTop,
      // A horizontal or vertical line segment is 0/1px thin; keep a minimal
      // extent so it still intersects the page it runs through.
      right: el.offsetLeft + (el.offsetWidth || 1),
      bottom: el.offsetTop + (el.offsetHeight || 1),
    });
  };

  for (var i = 0; i < this.blockObjects.length; i++) {
    if (this.blockObjects[i]) add(this.blockObjects[i].divObj);
  }
  var wires = this.canvas.querySelectorAll(".line-seg, .line-junction");
  for (var w = 0; w < wires.length; w++) add(wires[w]);

  return rects;
};

// Pages of the given format that actually carry content, in reading order.
// Empty pages are skipped so the PDF only contains sheets that show something.
SheetObject.prototype._pagesWithContent = function (fmt) {
  var canvasW = parseInt(this.canvas.style.width) || 10000;
  var canvasH = parseInt(this.canvas.style.height) || 10000;
  var cols = Math.floor(canvasW / fmt.w);
  var rows = Math.floor(canvasH / fmt.h);
  var rects = this._contentRects();
  var pages = [];

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var left = c * fmt.w;
      var top = r * fmt.h;
      var right = left + fmt.w;
      var bottom = top + fmt.h;

      for (var i = 0; i < rects.length; i++) {
        var q = rects[i];
        if (
          q.left < right &&
          q.right > left &&
          q.top < bottom &&
          q.bottom > top
        ) {
          pages.push({ row: r, col: c, left: left, top: top });
          break;
        }
      }
    }
  }
  return pages;
};

// Export the current logic as a ready-to-import Node-RED Function node.
// Delegates to the standalone NodeRedExport module (see scripts/NodeRedExport.js).
SheetObject.prototype.exportNodeRed = function () {
  if (typeof NodeRedExport === "undefined") {
    alert("Node-RED export module not loaded.");
    return;
  }
  NodeRedExport.export(this);
};

SheetObject.prototype.printPDF = function () {
  var format = this.currentPageFormat;
  if (!format || format === "none") return;

  var fmt = this.PAGE_FORMATS[format];
  if (!fmt) return;

  var pagesWithContent = this._pagesWithContent(fmt);

  if (pagesWithContent.length === 0) {
    alert("No content to print.");
    return;
  }

  // One export at a time — a second run would capture the already-neutralized
  // transform as its "saved" state and leave the canvas unzoomed afterwards.
  if (this._pdfExportRunning) return;
  this._pdfExportRunning = true;

  // Neutralize editor-only state so the exported geometry matches a clean sheet:
  // hide the grid and page markings, drop selection handles, and remove the zoom
  // transform so 1 canvas px reads as 1 px while measuring element boxes.
  var hadGrid = this.canvas.classList.contains("show-grid");
  this.canvas.classList.remove("show-grid");
  this._clearPageMarkings();
  this.deselectAll();
  var savedTransform = this.canvas.style.transform;
  this.canvas.style.transform = "none";

  var orientation = fmt.orient === "landscape" ? "l" : "p";
  var pdfFormat = format.indexOf("a3") === 0 ? "a3" : "a4";
  // compress:true keeps the (already tiny) vector streams flate-compressed.
  var pdf = new jspdf.jsPDF({
    orientation: orientation,
    unit: "mm",
    format: pdfFormat,
    compress: true,
  });

  var restored = false;
  var restoreCanvas = function () {
    if (restored) return;
    restored = true;
    this.canvas.style.transform = savedTransform;
    if (hadGrid) this.canvas.classList.add("show-grid");
    this.setPageFormat(this.currentPageFormat);
    this._pdfExportRunning = false;
  }.bind(this);

  try {
    var renderer = new PdfVectorRenderer(this);
    renderer.render(pdf, pagesWithContent, fmt, function () {
      pdf.addPage(pdfFormat, orientation);
    });
  } catch (err) {
    restoreCanvas();
    alert("PDF export failed (render): " + ((err && err.message) || err));
    return;
  }

  // Restore the editor before saving so the sheet stays usable even if the
  // browser's download step throws.
  restoreCanvas();
  try {
    pdf.save(this._pdfFilename());
  } catch (err) {
    alert("PDF export failed (save): " + ((err && err.message) || err));
  }
};

// Filename for the exported PDF, following the same convention as saveProject:
// jsblocks_<project name>_<timestamp>.pdf (name omitted when it is not set).
SheetObject.prototype._pdfFilename = function () {
  var clean = this._sanitizeFilename(this.projectName);
  var ts = this._timestampString();
  return clean
    ? "jsblocks_" + clean + "_" + ts + ".pdf"
    : "jsblocks_" + ts + ".pdf";
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
    labelPanelText: this.labelPanelText,
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
  if (settings.labelPanelText != null)
    this.setLabelPanelText(settings.labelPanelText);

  // Blocks now exist and settings are applied — refresh the label panels so the
  // type-box caption and each Label Out's derived comment resolve correctly
  // (also covers older files that carry no labelPanelText setting).
  this.refreshLabelPanels();
};

// Update the project name from the toolbar input (or programmatically).
SheetObject.prototype.setProjectName = function (value) {
  this.projectName = value == null ? "" : String(value);
  var inp = document.getElementById("projectNameInput");
  if (inp && document.activeElement !== inp) inp.value = this.projectName;
};

// Set the caption shown in every Label In/Out panel's type box. Purely
// cosmetic; keeps the settings input in sync and re-renders all label panels.
SheetObject.prototype.setLabelPanelText = function (value) {
  this.labelPanelText =
    value == null || value === "" ? "LABEL" : String(value);
  var inp = document.getElementById("settingsLabelPanelText");
  if (inp && document.activeElement !== inp) inp.value = this.labelPanelText;
  this.refreshLabelPanels();
};

// Re-apply the type-box caption to every Label In/Out block and recompute each
// Label Out's derived comment (taken from the matching Label In by name, or
// "No Reference!" when none exists).
SheetObject.prototype.refreshLabelPanels = function () {
  var caption = this.labelPanelText || "LABEL";
  for (var i = 0; i < this.blockObjects.length; i++) {
    var b = this.blockObjects[i];
    var on = b.objectName;
    // All four blocks show the "LABEL" caption box.
    if (
      on !== "LabelInPanel" &&
      on !== "LabelOutPanel" &&
      on !== "TagLabelOut" &&
      on !== "TagLabelIn"
    )
      continue;
    if (b._typeBox) b._typeBox.innerHTML = caption;
    // Only the Label Out panel derives its comment from a matching Label In.
    if (on === "LabelOutPanel" && b._infoBox) b._updateInfoBox();
  }
};

// Strip characters that are illegal in filenames and turn spaces into
// underscores, so the project name can be embedded safely on any OS.
SheetObject.prototype._sanitizeFilename = function (name) {
  var s = (name == null ? "" : String(name)).trim();
  s = s.replace(/[\\/:*?"<>|]/g, ""); // drop illegal characters
  s = s.replace(/\s+/g, "_"); // spaces -> underscore
  s = s.replace(/_+/g, "_"); // collapse repeats
  s = s.replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
  return s;
};

// Local timestamp "YYYY-MM-DD_HH-MM" for the save filename.
SheetObject.prototype._timestampString = function () {
  var d = new Date();
  var pad = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    "-" +
    pad(d.getMinutes())
  );
};

SheetObject.prototype.saveProject = function () {
  var project = {
    version: 1,
    name: this.projectName || "",
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
            waypoints: this._serializeWaypoints(inConn.theLine),
          });
        }
      }
    }
  }

  // Download as JSON. Filename: jsblocks_<name>_<timestamp>.json
  // (falls back to jsblocks_<timestamp>.json when no name is set).
  var json = JSON.stringify(project, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var clean = this._sanitizeFilename(this.projectName);
  var ts = this._timestampString();
  var fileName = clean
    ? "jsblocks_" + clean + "_" + ts + ".json"
    : "jsblocks_" + ts + ".json";
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
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

  // Restore project name into state and the toolbar field.
  this.setProjectName(project.name || "");

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
        inConn.theLine.waypoints = this._deserializeWaypoints(conn.waypoints);
        inConn.theLine.connectTo();
        outConn.addConnector(inConn);
        inConn.connectedFrom = outConn;
      }
    }
  }

  // Step 4: Restore sheet settings (after blocks/lines exist so visual
  // toggles such as snap visibility and exec-order numbers apply correctly)
  this._applySettings(project.settings);

  // Final overlap-aware reroute (auto-routed lines only; manual routes kept).
  this.rerouteAllLines();
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
            waypoints: this._serializeWaypoints(inConn.theLine),
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
        inConn.theLine.waypoints = this._deserializeWaypoints(
          conn.waypoints,
          offset,
          offset,
        );
        inConn.theLine.connectTo();
        outConn.addConnector(inConn);
        inConn.connectedFrom = outConn;
      }
    }
  }

  // Overlap-aware reroute of auto-routed lines (manual routes are preserved).
  this.rerouteAllLines();

  // Increase offset for next paste, keeping stored waypoints in sync.
  for (var i = 0; i < this._clipboard.blocks.length; i++) {
    this._clipboard.blocks[i].left += offset;
    this._clipboard.blocks[i].top += offset;
  }
  for (var k = 0; k < this._clipboard.connections.length; k++) {
    var wps = this._clipboard.connections[k].waypoints;
    if (wps) {
      for (var w = 0; w < wps.length; w++) {
        wps[w].x += offset;
        wps[w].y += offset;
      }
    }
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
  this._onSelectionChanged();
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
  this._onSelectionChanged();
};

// Notify dependents (currently the cross-reference panel) that the set of
// selected blocks changed. Cheap and safe to over-call; the panel ignores it
// while hidden.
SheetObject.prototype._onSelectionChanged = function () {
  if (this.crossRef) this.crossRef.onSelectionChanged();
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
        if (outConn.junctionDots) {
          for (var jd = 0; jd < outConn.junctionDots.length; jd++) {
            outConn.junctionDots[jd].style.backgroundColor =
              outConn.defaultColor;
          }
        }
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

  // Double-clicking a connection line (segment or waypoint handle) is handled
  // by the line itself (adds a waypoint) — don't drop a new block here.
  if (e.target && e.target.className) {
    var cn = "" + e.target.className;
    if (cn.indexOf("line-seg") >= 0 || cn.indexOf("line-waypoint") >= 0) return;
  }

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
    this.rerouteAllLines();
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

    // Reroute so remaining nets and their junction dots update.
    this.rerouteAllLines();
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
