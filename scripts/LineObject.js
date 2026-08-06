///////////////////////////////////////////////////////////
//
//		Main Line Object
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

function LineObject(toObj, fromObj) {
  this.toConnectorObj = toObj; // Input pin (left side of block)
  this.fromConnectorObj = fromObj; // Output pin (right side of block)
  this.connectLines = [];
  this.delaySymbol = null;
  // Manual bend points (canvas coords). When non-empty the line follows these
  // exactly instead of being auto-routed.
  this.waypoints = [];
  this.handleEls = [];
  this.isSelected = false;
  this._path = null; // last rendered polyline (array of {x,y})
  // Use the output connector's default color
  this.currentColor = fromObj.defaultColor || "black";
}

LineObject.prototype._sheet = function () {
  return this.toConnectorObj.instruction.sheetObject;
};

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
  // Double-click a segment to drop a manual waypoint at that spot.
  seg.addEventListener(
    "dblclick",
    function (e) {
      var sheet = thisLine._sheet();
      if (sheet.simulateOn) return;
      var pos = sheet.screenToCanvas(e.clientX, e.clientY);
      thisLine._addWaypointAt(pos.x, pos.y);
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  this._sheet().canvas.appendChild(seg);
  return seg;
};

LineObject.prototype._clearSegments = function () {
  var canvas = this._sheet().canvas;
  for (var i = 0; i < this.connectLines.length; i++) {
    canvas.removeChild(this.connectLines[i]);
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
  var sheet = this._sheet();
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

  var sheet = this._sheet();
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

// --- Endpoint (pin) coordinates -----------------------------------------

LineObject.prototype._endpoints = function () {
  var fromX =
    parseFloat(this.fromConnectorObj.theConnector.style.left) +
    this.fromConnectorObj.connectorWidth;
  var fromY = parseFloat(this.fromConnectorObj.theConnector.style.top);
  var toX = parseFloat(this.toConnectorObj.theConnector.style.left);
  var toY = parseFloat(this.toConnectorObj.theConnector.style.top);
  return {
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
  };
};

// --- Path computation ---------------------------------------------------

// Returns the polyline for this line. When manual waypoints exist the path
// follows them exactly; otherwise the A* router is used (falling back to a
// simple Z / bypass route if the router yields nothing).
LineObject.prototype._computePath = function (useOverlap) {
  var ep = this._endpoints();

  if (this.waypoints.length > 0) {
    return this._pathThroughWaypoints(ep.from, ep.to);
  }

  var sheet = this._sheet();
  if (sheet.lineRouter) {
    // All blocks (including this line's own source/target) are treated as
    // obstacles so the line never crosses a block body. The pins sit just
    // outside the inflated block rectangles, and the A* start/goal cells are
    // forced free, so both endpoints stay reachable.
    var pts = sheet.lineRouter.route(ep.from, ep.to, { overlap: !!useOverlap });
    if (pts && pts.length >= 2) return pts;
  }
  return this._fallbackPath(ep.from, ep.to);
};

// Net-aware path used by SheetObject.rerouteAllLines(): sibling lines of the
// same output pin share a trunk via the `preferCells` discount. Manual
// waypoints still take precedence.
LineObject.prototype.computeNetPath = function (preferCells, obstacleIndex) {
  var ep = this._endpoints();
  if (this.waypoints.length > 0) {
    return this._pathThroughWaypoints(ep.from, ep.to);
  }
  var sheet = this._sheet();
  if (sheet.lineRouter) {
    var pts = sheet.lineRouter.route(ep.from, ep.to, {
      overlap: true,
      prefer: preferCells,
      obstacles: obstacleIndex, // shared prebuilt index (may be undefined)
    });
    if (pts && pts.length >= 2) return pts;
  }
  return this._fallbackPath(ep.from, ep.to);
};

// Orthogonal polyline through the manual waypoints. The line leaves the output
// pin horizontally and enters the input pin horizontally.
LineObject.prototype._pathThroughWaypoints = function (from, to) {
  var anchors = [from].concat(this.waypoints).concat([to]);
  var pts = [{ x: from.x, y: from.y }];
  for (var i = 1; i < anchors.length; i++) {
    var c = pts[pts.length - 1];
    var n = { x: anchors[i].x, y: anchors[i].y };
    var isLast = i === anchors.length - 1;
    if (c.x !== n.x && c.y !== n.y) {
      if (isLast) {
        pts.push({ x: c.x, y: n.y }); // vertical first → enter horizontally
      } else {
        pts.push({ x: n.x, y: c.y }); // horizontal first → exit horizontally
      }
    }
    pts.push(n);
  }
  pts = LineRouter._orthogonalize(pts);
  pts = LineRouter._simplify(pts);
  return pts;
};

// Legacy direct routing, used only if the A* router fails to find a path.
LineObject.prototype._fallbackPath = function (from, to) {
  var stub = 20;
  if (to.x - from.x >= stub * 2) {
    var mid = from.x + (to.x - from.x) / 2;
    return [
      { x: from.x, y: from.y },
      { x: mid, y: from.y },
      { x: mid, y: to.y },
      { x: to.x, y: to.y },
    ];
  }
  var fromTop = parseFloat(this.fromConnectorObj.instruction.divObj.style.top);
  var fromBottom =
    fromTop + parseFloat(this.fromConnectorObj.instruction.divObj.style.height);
  var toTop = parseFloat(this.toConnectorObj.instruction.divObj.style.top);
  var rightX = from.x + stub;
  var leftX = to.x - stub;
  var bypassY = toTop < fromTop ? fromTop - 20 : fromBottom + 20;
  return [
    { x: from.x, y: from.y },
    { x: rightX, y: from.y },
    { x: rightX, y: bypassY },
    { x: leftX, y: bypassY },
    { x: leftX, y: to.y },
    { x: to.x, y: to.y },
  ];
};

// --- Rendering ----------------------------------------------------------

LineObject.prototype._renderPath = function (points) {
  for (var i = 0; i < points.length - 1; i++) {
    var a = points[i];
    var b = points[i + 1];
    if (a.y === b.y) {
      this._hSeg(a.x, a.y, b.x - a.x);
    } else {
      this._vSeg(a.x, a.y, b.y - a.y);
    }
  }
};

LineObject.prototype._pathMidpoint = function (points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  var total = 0;
  for (var i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1].x - points[i].x) +
      Math.abs(points[i + 1].y - points[i].y);
  }
  var half = total / 2;
  var acc = 0;
  for (var j = 0; j < points.length - 1; j++) {
    var a = points[j];
    var b = points[j + 1];
    var segLen = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (acc + segLen >= half) {
      var t = segLen === 0 ? 0 : (half - acc) / segLen;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += segLen;
  }
  return points[Math.floor(points.length / 2)];
};

LineObject.prototype.connectTo = function (useOverlap) {
  this._applyPath(this._computePath(useOverlap));
};

// Render a pre-computed polyline and refresh the delay symbol, selection
// highlight and waypoint handles.
LineObject.prototype._applyPath = function (points) {
  this._clearSegments();
  this._path = points;
  this._renderPath(points);

  // --- Delay symbol: create if needed, then position at the path midpoint ---
  if (!this.delaySymbol) {
    this._createDelaySymbol();
  }
  var mid = this._pathMidpoint(points);
  this.delaySymbol.style.left = mid.x + "px";
  this.delaySymbol.style.top = mid.y + "px";
  this._updateDelaySymbol();

  // Restore selection highlight and reposition waypoint handles.
  if (this.isSelected) {
    for (var i = 0; i < this.connectLines.length; i++) {
      this.connectLines[i].style.backgroundColor = "red";
    }
  }
  this._updateHandles();
};

// --- Manual waypoint handles -------------------------------------------

LineObject.prototype._clearHandles = function () {
  var canvas = this._sheet().canvas;
  for (var i = 0; i < this.handleEls.length; i++) {
    if (this.handleEls[i].parentNode) {
      canvas.removeChild(this.handleEls[i]);
    }
  }
  this.handleEls = [];
};

LineObject.prototype._updateHandles = function () {
  this._clearHandles();
  if (!this.isSelected) return;
  for (var i = 0; i < this.waypoints.length; i++) {
    this._createHandle(i);
  }
};

LineObject.prototype._createHandle = function (index) {
  var thisLine = this;
  var sheet = this._sheet();
  var wp = this.waypoints[index];
  var h = document.createElement("div");
  h.className = "line-waypoint";
  h.style.position = "absolute";
  h.style.width = "10px";
  h.style.height = "10px";
  h.style.boxSizing = "border-box";
  h.style.border = "1px solid rgb(0,120,215)";
  h.style.backgroundColor = "rgb(255,255,255)";
  h.style.borderRadius = "2px";
  h.style.zIndex = "6";
  h.style.cursor = "move";
  h.style.left = wp.x - 5 + "px";
  h.style.top = wp.y - 5 + "px";
  sheet.canvas.appendChild(h);
  this.handleEls.push(h);

  var moveHandler, upHandler;
  h.addEventListener(
    "mousedown",
    function (e) {
      if (e.button !== 0) return;
      if (sheet.simulateOn) return;
      e.preventDefault();
      e.stopPropagation();
      moveHandler = function (ev) {
        var pos = sheet.screenToCanvas(ev.clientX, ev.clientY);
        if (sheet.snapToGrid) {
          pos = sheet.snapToGridPoint(pos.x, pos.y);
        }
        thisLine.waypoints[index] = { x: pos.x, y: pos.y };
        thisLine.connectTo();
      };
      upHandler = function () {
        document.removeEventListener("mousemove", moveHandler, true);
        document.removeEventListener("mouseup", upHandler, true);
        sheet.rerouteAllLines();
      };
      document.addEventListener("mousemove", moveHandler, true);
      document.addEventListener("mouseup", upHandler, true);
    },
    true,
  );

  // Right-click removes the waypoint.
  h.addEventListener(
    "contextmenu",
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      thisLine.waypoints.splice(index, 1);
      thisLine.connectTo();
      sheet.rerouteAllLines();
    },
    true,
  );
};

// Insert a new waypoint at (cx, cy), keeping waypoints ordered start → goal.
LineObject.prototype._addWaypointAt = function (cx, cy) {
  var sheet = this._sheet();
  if (sheet.snapToGrid) {
    var s = sheet.snapToGridPoint(cx, cy);
    cx = s.x;
    cy = s.y;
  }
  var idx = this._waypointInsertIndex(cx, cy);
  this.waypoints.splice(idx, 0, { x: cx, y: cy });
  sheet.lineSelected(this, false); // select so handles are visible
  this.connectTo();
  sheet.rerouteAllLines();
};

LineObject.prototype._waypointInsertIndex = function (cx, cy) {
  if (!this._path || this.waypoints.length === 0) return this.waypoints.length;
  var clickT = this._paramOnPath(this._path, { x: cx, y: cy });
  for (var i = 0; i < this.waypoints.length; i++) {
    var wt = this._paramOnPath(this._path, this.waypoints[i]);
    if (clickT < wt) return i;
  }
  return this.waypoints.length;
};

// Distance along the polyline to the projection of p (used to order waypoints).
LineObject.prototype._paramOnPath = function (points, p) {
  var best = Infinity;
  var bestT = 0;
  var acc = 0;
  for (var i = 0; i < points.length - 1; i++) {
    var a = points[i];
    var b = points[i + 1];
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var projX = a.x + t * dx;
    var projY = a.y + t * dy;
    var dist = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
    var segLen = Math.sqrt(len2);
    if (dist < best) {
      best = dist;
      bestT = acc + t * segLen;
    }
    acc += segLen;
  }
  return bestT;
};

// --- Lifecycle & selection ---------------------------------------------

LineObject.prototype.removeLine = function () {
  var canvas = this._sheet().canvas;
  for (var i = 0; i < this.connectLines.length; i++) {
    canvas.removeChild(this.connectLines[i]);
  }
  this.connectLines = [];

  this._clearHandles();

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
  this._sheet().lineSelected(this, e.shiftKey);
};

LineObject.prototype.select = function () {
  this.isSelected = true;
  for (var i = 0; i < this.connectLines.length; i++) {
    this.connectLines[i].style.backgroundColor = "red";
  }
  this._updateHandles();
};

LineObject.prototype.deselect = function () {
  this.isSelected = false;
  for (var i = 0; i < this.connectLines.length; i++) {
    this.connectLines[i].style.backgroundColor = this.currentColor;
  }
  this._clearHandles();
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
