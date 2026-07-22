///////////////////////////////////////////////////////////
//
//		Orthogonal Line Router (A* pathfinding)
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

//
// LineRouter computes orthogonal (Manhattan) paths between an output pin and an
// input pin. It runs an A* search over a uniform grid whose cells are:
//   - blocked by block rectangles (inflated by a margin) so lines never cross
//     through blocks, and
//   - penalized ("occupancy") where other lines already run, so parallel lines
//     spread into separate lanes instead of stacking on top of each other.
//
// Directions are encoded 0=E, 1=W, 2=N, 3=S. Search states carry their incoming
// direction so bends can be penalized (turnCost) and so the path is forced to
// leave the output pin and enter the input pin horizontally (matching the way
// pins visually attach to blocks).
//
function LineRouter(sheet) {
  this.sheet = sheet;
  this.margin = 8; // px an obstacle is inflated by
  this.turnCost = 14; // extra cost (px equiv.) per 90° bend
  this.overlapCost = 60; // extra cost per already-occupied cell entered
  this.pad = 12; // cells of head-room around the endpoints' bbox
  this.maxIterations = 300000; // safety cap for a single search
  this.occupancy = {}; // "cx,cy" -> count of lines running through the cell
}

// Routing cell size, derived from the sheet grid but clamped to a sane range so
// tiny visual grids don't produce an unusably fine (slow) routing raster.
LineRouter.prototype.cellSize = function () {
  var g = this.sheet && this.sheet.gridSize ? this.sheet.gridSize : 12;
  if (g < 8) g = 8;
  if (g > 24) g = 24;
  return g;
};

LineRouter.prototype.clearOccupancy = function () {
  this.occupancy = {};
};

// Visit every grid cell a polyline passes through, calling cb(key).
LineRouter.prototype._walkCells = function (points, cb) {
  if (!points || points.length < 2) return;
  var C = this.cellSize();
  for (var i = 0; i < points.length - 1; i++) {
    var ax = Math.round(points[i].x / C);
    var ay = Math.round(points[i].y / C);
    var bx = Math.round(points[i + 1].x / C);
    var by = Math.round(points[i + 1].y / C);
    var stepX = ax === bx ? 0 : bx > ax ? 1 : -1;
    var stepY = ay === by ? 0 : by > ay ? 1 : -1;
    var cx = ax,
      cy = ay;
    var guard = 0;
    while (guard++ < 100000) {
      cb(cx + "," + cy);
      if (cx === bx && cy === by) break;
      cx += stepX;
      cy += stepY;
    }
  }
};

// Mark every cell a rendered polyline passes through as occupied.
LineRouter.prototype.stamp = function (points) {
  var occ = this.occupancy;
  this._walkCells(points, function (k) {
    occ[k] = (occ[k] || 0) + 1;
  });
};

// Add a polyline's cells to a plain set object (used to grow a net's shared
// trunk so sibling lines are attracted to it).
LineRouter.prototype.addPathCells = function (set, points) {
  this._walkCells(points, function (k) {
    set[k] = true;
  });
};

// Fold a set of cell keys into the occupancy map (so later nets avoid them).
LineRouter.prototype.stampCells = function (set) {
  for (var k in set) {
    if (set.hasOwnProperty(k)) this.occupancy[k] = (this.occupancy[k] || 0) + 1;
  }
};

// Build inflated obstacle rectangles (px) from every block. Pins sit just
// outside these rectangles, and A* start/goal cells are forced free, so
// endpoints stay reachable while line bodies never cross a block.
LineRouter.prototype._obstacles = function () {
  var rects = [];
  var blocks = this.sheet.blockObjects;
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (!b || !b.divObj) continue; // DrawLine annotations etc. have no rect
    var l = parseFloat(b.divObj.style.left) || 0;
    var t = parseFloat(b.divObj.style.top) || 0;
    var w = parseFloat(b.divObj.style.width) || b.divWidth || 0;
    var h = parseFloat(b.divObj.style.height) || b.divHeight || 0;
    rects.push({
      l: l - this.margin,
      t: t - this.margin,
      r: l + w + this.margin,
      b: t + h + this.margin,
    });
  }
  return rects;
};

LineRouter.prototype._pointBlocked = function (px, py, rects) {
  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    if (px >= r.l && px <= r.r && py >= r.t && py <= r.b) return true;
  }
  return false;
};

// Main entry: returns an orthogonal polyline (array of {x,y} in canvas coords)
// from -> to, or null if no path was found (caller should fall back).
//
// options:
//   overlap  – when true, entering a cell used by another net costs extra
//              (spreads unrelated signals into separate lanes)
//   prefer   – set of cell keys ("cx,cy") belonging to the same net's already
//              routed lines; traversing them is cheap so sibling lines merge
//              onto a shared trunk before branching off.
LineRouter.prototype.route = function (from, to, options) {
  options = options || {};
  var useOverlap = !!options.overlap;
  var prefer = options.prefer || null;
  var C = this.cellSize();
  var rects = this._obstacles();

  var sx = Math.round(from.x / C),
    sy = Math.round(from.y / C);
  var gx = Math.round(to.x / C),
    gy = Math.round(to.y / C);

  // Bounding box for the search (keep it small for speed).
  var minX = Math.min(sx, gx) - this.pad;
  var maxX = Math.max(sx, gx) + this.pad;
  var minY = Math.min(sy, gy) - this.pad;
  var maxY = Math.max(sy, gy) + this.pad;
  if (minX < 0) minX = 0;
  if (minY < 0) minY = 0;
  var canvasW = parseInt(this.sheet.canvas.style.width) || 10000;
  var canvasH = parseInt(this.sheet.canvas.style.height) || 10000;
  var cellsW = Math.ceil(canvasW / C);
  var cellsH = Math.ceil(canvasH / C);
  if (maxX > cellsW) maxX = cellsW;
  if (maxY > cellsH) maxY = cellsH;

  var self = this;
  var blockedCache = {};
  var isBlocked = function (cx, cy) {
    if (cx === sx && cy === sy) return false; // endpoints always free
    if (cx === gx && cy === gy) return false;
    var key = cx + "," + cy;
    if (blockedCache[key] !== undefined) return blockedCache[key];
    var res = self._pointBlocked(cx * C, cy * C, rects);
    blockedCache[key] = res;
    return res;
  };

  // Direction vectors: 0=E,1=W,2=N,3=S
  var DX = [1, -1, 0, 0];
  var DY = [0, 0, -1, 1];
  var OPP = [1, 0, 3, 2];

  var heap = new LineRouter._Heap();
  var gScore = {}; // stateKey -> cost so far
  var cameFrom = {}; // stateKey -> { key, cx, cy, dir }

  var h = function (cx, cy) {
    return (Math.abs(cx - gx) + Math.abs(cy - gy)) * C;
  };

  // Seed: start forced to exit East (horizontal), so dir = 0.
  var startKey = sx + "," + sy + ",0";
  gScore[startKey] = 0;
  heap.push({ f: h(sx, sy), cx: sx, cy: sy, dir: 0, key: startKey, start: 1 });

  var iterations = 0;
  var goalKey = null;

  while (heap.size() > 0) {
    if (++iterations > this.maxIterations) break;
    var cur = heap.pop();

    // Goal must be entered horizontally (dir East) to match pin attachment.
    if (cur.cx === gx && cur.cy === gy && cur.dir === 0 && !cur.start) {
      goalKey = cur.key;
      break;
    }

    var curG = gScore[cur.key];
    if (curG === undefined || cur.f - h(cur.cx, cur.cy) > curG + 0.001) {
      // stale heap entry
      if (curG === undefined) continue;
    }

    for (var d = 0; d < 4; d++) {
      // From the start cell only an eastward move is allowed.
      if (cur.start && d !== 0) continue;
      if (!cur.start && d === OPP[cur.dir]) continue; // no U-turns

      var nx = cur.cx + DX[d];
      var ny = cur.cy + DY[d];
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      if (isBlocked(nx, ny)) continue;

      var nKeyCell = nx + "," + ny;
      var step;
      if (prefer && prefer[nKeyCell]) {
        // On the net's shared trunk: very cheap so siblings merge onto it.
        step = C * 0.1;
      } else {
        step = C;
        if (useOverlap) {
          var occ = this.occupancy[nKeyCell];
          if (occ) step += this.overlapCost * Math.min(occ, 3);
        }
      }
      if (!cur.start && d !== cur.dir) step += this.turnCost;

      var tentative = curG + step;
      var nKey = nx + "," + ny + "," + d;
      if (gScore[nKey] === undefined || tentative < gScore[nKey]) {
        gScore[nKey] = tentative;
        cameFrom[nKey] = {
          key: cur.key,
          cx: cur.cx,
          cy: cur.cy,
          dir: cur.dir,
        };
        heap.push({
          f: tentative + h(nx, ny),
          cx: nx,
          cy: ny,
          dir: d,
          key: nKey,
          start: 0,
        });
      }
    }
  }

  if (!goalKey) return null;

  // Reconstruct cell path.
  var cells = [];
  var k = goalKey;
  var guard = 0;
  while (k !== undefined && guard++ < 100000) {
    var parts = k.split(",");
    cells.push({ cx: parseInt(parts[0]), cy: parseInt(parts[1]) });
    var prev = cameFrom[k];
    if (!prev) break;
    k = prev.key;
  }
  cells.reverse();

  // Cells -> canvas points, then snap the endpoints to the exact pin positions.
  var pts = [];
  for (var i = 0; i < cells.length; i++) {
    pts.push({ x: cells[i].cx * C, y: cells[i].cy * C });
  }
  pts = LineRouter._simplify(pts);

  if (pts.length >= 2) {
    // First segment is horizontal (start exits East) -> lift it to exact from.y.
    pts[0] = { x: from.x, y: from.y };
    pts[1].y = from.y;
    var n = pts.length;
    // Last segment is horizontal (goal entered from West) -> exact to.y.
    pts[n - 1] = { x: to.x, y: to.y };
    pts[n - 2].y = to.y;
  } else {
    pts = [
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    ];
  }

  pts = LineRouter._orthogonalize(pts);
  pts = LineRouter._simplify(pts);
  return pts;
};

// Remove collinear intermediate points.
LineRouter._simplify = function (pts) {
  if (pts.length <= 2) return pts;
  var out = [pts[0]];
  for (var i = 1; i < pts.length - 1; i++) {
    var a = out[out.length - 1];
    var b = pts[i];
    var c = pts[i + 1];
    // Skip duplicate points.
    if (a.x === b.x && a.y === b.y) continue;
    var abH = a.y === b.y,
      bcH = b.y === c.y;
    var abV = a.x === b.x,
      bcV = b.x === c.x;
    // Remove b only when a-b-c are collinear AND b lies between a and c (same
    // travel direction). A direction reversal (a "spike", e.g. a manually
    // placed waypoint straight off the line) must be kept, not collapsed.
    if (abH && bcH && (b.x - a.x) * (c.x - b.x) >= 0) continue;
    if (abV && bcV && (b.y - a.y) * (c.y - b.y) >= 0) continue;
    out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

// Ensure every segment is strictly axis-aligned; break diagonals into an elbow.
LineRouter._orthogonalize = function (pts) {
  var out = [pts[0]];
  for (var i = 1; i < pts.length; i++) {
    var a = out[out.length - 1];
    var b = pts[i];
    if (a.x !== b.x && a.y !== b.y) {
      out.push({ x: b.x, y: a.y }); // horizontal first, then vertical
    }
    out.push(b);
  }
  return out;
};

// Minimal binary min-heap keyed on .f
LineRouter._Heap = function () {
  this.items = [];
};
LineRouter._Heap.prototype.size = function () {
  return this.items.length;
};
LineRouter._Heap.prototype.push = function (item) {
  var a = this.items;
  a.push(item);
  var i = a.length - 1;
  while (i > 0) {
    var p = (i - 1) >> 1;
    if (a[p].f <= a[i].f) break;
    var t = a[p];
    a[p] = a[i];
    a[i] = t;
    i = p;
  }
};
LineRouter._Heap.prototype.pop = function () {
  var a = this.items;
  var top = a[0];
  var last = a.pop();
  if (a.length > 0) {
    a[0] = last;
    var i = 0,
      n = a.length;
    while (true) {
      var l = 2 * i + 1,
        r = 2 * i + 2,
        s = i;
      if (l < n && a[l].f < a[s].f) s = l;
      if (r < n && a[r].f < a[s].f) s = r;
      if (s === i) break;
      var t = a[s];
      a[s] = a[i];
      a[i] = t;
      i = s;
    }
  }
  return top;
};
