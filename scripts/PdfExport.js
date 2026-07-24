///////////////////////////////////////////////////////////
//
//		Vector PDF Exporter
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

// Turns the on-screen sheet into a true vector PDF, drawing every block, line,
// connector and label as PDF primitives (rectangles, strokes, circles,
// polygons, text) instead of rasterizing with html2canvas.
//
// Why vector: html2canvas re-clones and re-parses the ENTIRE 10000x10000 canvas
// once per exported page, so a fully populated multi-page sheet took minutes and
// could exhaust memory. Reading the DOM geometry once and emitting vector ops is
// linear, finishes in well under a second for the whole sheet, produces a small
// file, stays crisp at any zoom and keeps the text selectable.
//
// The renderer is deliberately generic: it walks the DOM and maps computed
// styles to primitives, so it covers every current and future block type
// without per-type drawing code. The full on-screen vocabulary is just:
//   * nested <div>/<span> with a background, borders and/or a text label,
//   * circles (border-radius >= 50% squares: junction dots, inversion bubbles),
//   * SVG <line> and <polygon> (draw-line, snap cross, jump arrows).

function PdfVectorRenderer(sheet) {
  this.sheet = sheet;
}

// CSS px -> PDF pt (jsPDF sets font size in points regardless of the doc unit).
PdfVectorRenderer.MM_PER_PT = 0.352777778;

// jsPDF's built-in fonts use WinAnsi (Latin-1) encoding, which covers ASCII and
// accented Latin (umlauts, sharp-s, accents) but not typographic symbols. Map
// the ones block labels actually use to ASCII equivalents; any remaining
// character above U+00FF is replaced with "?" so the output stays clean instead
// of rendering corrupted glyphs. (A future Unicode font could be embedded to
// support arbitrary scripts in comments and custom labels.)
// Symbols jsPDF's Latin-1 fonts cannot encode, mapped to ASCII equivalents.
// Built with String.fromCharCode so this source stays pure ASCII: the mapping
// then works even if the file is served or opened under the wrong character
// encoding (the failure mode that turned the Or-gate label into "?1").
PdfVectorRenderer.SYMBOLS = {};
(function (S) {
  S[String.fromCharCode(0x2265)] = ">="; // greater-or-equal (Or gate)
  S[String.fromCharCode(0x2264)] = "<="; // less-or-equal
  S[String.fromCharCode(0x2260)] = "!="; // not-equal
  S[String.fromCharCode(0x2192)] = "->"; // right arrow
  S[String.fromCharCode(0x2190)] = "<-"; // left arrow
  S[String.fromCharCode(0x00b1)] = "+/-"; // plus-minus
  S[String.fromCharCode(0x00a0)] = " "; // non-breaking space
})(PdfVectorRenderer.SYMBOLS);

// Classes that are pure editor chrome and must never appear in the export.
PdfVectorRenderer.SKIP_CLASSES = {
  "line-waypoint": 1,
  "page-line-v": 1,
  "page-line-h": 1,
  "page-label": 1,
  "page-context-menu": 1,
};

// Parse "rgb(r,g,b)" / "rgba(r,g,b,a)" into {r,g,b,a}, or null when the color is
// missing or fully transparent (so callers can simply test for null to skip).
PdfVectorRenderer.prototype._color = function (str) {
  if (!str) return null;
  var m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  var p = m[1].split(",");
  var a = p.length > 3 ? parseFloat(p[3]) : 1;
  if (!(a > 0)) return null;
  return {
    r: parseInt(p[0], 10) || 0,
    g: parseInt(p[1], 10) || 0,
    b: parseInt(p[2], 10) || 0,
    a: a,
  };
};

// Element bounding box in canvas coordinates (the same space page.left/top and
// block.style.left/top live in). Relies on the caller having neutralized the
// canvas zoom transform first, so 1 client px == 1 canvas px.
PdfVectorRenderer.prototype._rect = function (el) {
  var r = el.getBoundingClientRect();
  return {
    l: r.left - this._ox,
    t: r.top - this._oy,
    w: r.width,
    h: r.height,
  };
};

// Collect every drawable primitive on the sheet exactly once. Returns an array
// sorted into paint order (ascending z-index, then document order) so lines land
// under blocks and labels land on top, matching the screen.
PdfVectorRenderer.prototype.collect = function () {
  this._prims = [];
  this._seq = 0;

  var canvas = this.sheet.canvas;
  var cr = canvas.getBoundingClientRect();
  var cs = getComputedStyle(canvas);
  this._ox = cr.left + parseFloat(cs.borderLeftWidth);
  this._oy = cr.top + parseFloat(cs.borderTopWidth);

  var kids = canvas.children;
  for (var i = 0; i < kids.length; i++) this._walk(kids[i], 0);

  this._prims.sort(function (a, b) {
    return a.z - b.z || a.seq - b.seq;
  });
  return this._prims;
};

PdfVectorRenderer.prototype._push = function (prim) {
  prim.seq = this._seq++;
  this._prims.push(prim);
};

// Merge a primitive's bounding box into the min/max carried on the prim, used
// later for cheap page-intersection tests.
PdfVectorRenderer.prototype._bbox = function (prim, l, t, r, b) {
  prim.bl = l;
  prim.bt = t;
  prim.br = r;
  prim.bb = b;
};

PdfVectorRenderer.prototype._walk = function (el, parentZ) {
  if (el.nodeType !== 1) return;

  var cls = typeof el.className === "string" ? el.className : "";
  var parts = cls.split(/\s+/);
  for (var c = 0; c < parts.length; c++) {
    if (PdfVectorRenderer.SKIP_CLASSES[parts[c]]) return;
  }

  var cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")
    return;

  var z = cs.zIndex === "auto" ? parentZ : parseInt(cs.zIndex, 10) || parentZ;
  var tag = el.tagName.toLowerCase();

  if (tag === "svg") {
    this._walkSvg(el, z);
    return; // svg box itself is invisible; its children carry the drawing
  }

  var rect = this._rect(el);
  this._emitBox(el, cs, rect, z);
  this._emitText(el, cs, rect, z);

  var kids = el.children;
  for (var i = 0; i < kids.length; i++) this._walk(kids[i], z);
};

// Background fill, circle, and borders for one HTML element.
PdfVectorRenderer.prototype._emitBox = function (el, cs, rect, z) {
  if (rect.w <= 0 || rect.h <= 0) return;

  var bg = this._color(cs.backgroundColor);
  var radius = parseFloat(cs.borderTopLeftRadius) || 0;
  var isCircle =
    radius > 0 && Math.abs(rect.w - rect.h) < 0.6 && radius * 2 >= rect.w - 0.6;

  // Borders: read each side; a side counts when it has width, a solid-ish style
  // and a visible color.
  var sides = ["Top", "Right", "Bottom", "Left"];
  var bw = [],
    bc = [],
    bs = [];
  var anyBorder = false,
    uniform = true;
  for (var s = 0; s < 4; s++) {
    var w = parseFloat(cs["border" + sides[s] + "Width"]) || 0;
    var style = cs["border" + sides[s] + "Style"];
    var col = this._color(cs["border" + sides[s] + "Color"]);
    var on = w > 0 && style !== "none" && style !== "hidden" && col;
    bw[s] = on ? w : 0;
    bc[s] = col;
    bs[s] = style;
    if (on) anyBorder = true;
  }
  for (var u = 1; u < 4; u++) {
    if (
      bw[u] !== bw[0] ||
      bs[u] !== bs[0] ||
      !bc[0] ||
      !bc[u] ||
      bc[u].r !== bc[0].r ||
      bc[u].g !== bc[0].g ||
      bc[u].b !== bc[0].b
    ) {
      uniform = false;
    }
  }

  if (isCircle) {
    var cx = rect.l + rect.w / 2;
    var cy = rect.t + rect.h / 2;
    var rr = rect.w / 2;
    var prim = {
      type: "circle",
      z: z,
      cx: cx,
      cy: cy,
      rr: rr,
      fill: bg,
      stroke: bw[0] > 0 ? { color: bc[0], width: bw[0] } : null,
    };
    this._bbox(prim, cx - rr, cy - rr, cx + rr, cy + rr);
    this._push(prim);
    return;
  }

  if (bg) {
    var f = {
      type: "rect",
      z: z,
      x: rect.l,
      y: rect.t,
      w: rect.w,
      h: rect.h,
      fill: bg,
    };
    this._bbox(f, rect.l, rect.t, rect.l + rect.w, rect.t + rect.h);
    this._push(f);
  }

  if (!anyBorder) return;

  if (uniform && bw[0] > 0) {
    var st = {
      type: "rect",
      z: z,
      x: rect.l,
      y: rect.t,
      w: rect.w,
      h: rect.h,
      stroke: { color: bc[0], width: bw[0], dash: bs[0] === "dashed" },
    };
    this._bbox(st, rect.l, rect.t, rect.l + rect.w, rect.t + rect.h);
    this._push(st);
    return;
  }

  // Mixed borders (e.g. a single divider edge): one line per active side.
  var l = rect.l,
    t = rect.t,
    r = rect.l + rect.w,
    b = rect.t + rect.h;
  var edges = [
    [l, t, r, t], // Top
    [r, t, r, b], // Right
    [l, b, r, b], // Bottom
    [l, t, l, b], // Left
  ];
  for (var e = 0; e < 4; e++) {
    if (bw[e] <= 0) continue;
    this._pushLine(
      edges[e][0],
      edges[e][1],
      edges[e][2],
      edges[e][3],
      bc[e],
      bw[e],
      bs[e] === "dashed",
      z,
    );
  }
};

PdfVectorRenderer.prototype._pushLine = function (
  x1,
  y1,
  x2,
  y2,
  color,
  width,
  dash,
  z,
) {
  if (!color) return;
  var prim = {
    type: "line",
    z: z,
    x1: x1,
    y1: y1,
    x2: x2,
    y2: y2,
    color: color,
    width: width || 1,
    dash: !!dash,
  };
  this._bbox(
    prim,
    Math.min(x1, x2) - width,
    Math.min(y1, y2) - width,
    Math.max(x1, x2) + width,
    Math.max(y1, y2) + width,
  );
  this._push(prim);
};

// Direct text-node content of an element (child elements are handled by the
// walker's recursion, so only this element's own label is emitted here).
PdfVectorRenderer.prototype._emitText = function (el, cs, rect, z) {
  var str = "";
  for (var i = 0; i < el.childNodes.length; i++) {
    var n = el.childNodes[i];
    if (n.nodeType === 3) str += n.nodeValue;
  }
  str = str.replace(/\s+/g, " ").trim();
  if (!str) return;
  str = this._sanitizeText(str);
  if (!str) return;

  var color = this._color(cs.color) || { r: 0, g: 0, b: 0 };
  var weight = cs.fontWeight;
  var bold = weight === "bold" || parseInt(weight, 10) >= 600;
  var align = cs.textAlign;
  if (align === "start" || align === "justify" || !align) align = "left";
  if (align === "end") align = "right";

  var prim = {
    type: "text",
    z: z,
    str: str,
    sizePx: parseFloat(cs.fontSize) || 11,
    bold: bold,
    italic: cs.fontStyle === "italic",
    color: color,
    align: align,
    x: rect.l,
    y: rect.t,
    w: rect.w,
    h: rect.h,
  };
  this._bbox(prim, rect.l, rect.t, rect.l + rect.w, rect.t + rect.h);
  this._push(prim);
};

// Replace symbols jsPDF's Latin-1 fonts cannot encode, then drop any remaining
// character above U+00FF (keeps accented Latin, discards e.g. CJK/emoji safely).
PdfVectorRenderer.prototype._sanitizeText = function (str) {
  var map = PdfVectorRenderer.SYMBOLS;
  var out = "";
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (map[ch] !== undefined) out += map[ch];
    else if (ch.charCodeAt(0) > 255) out += "?";
    else out += ch;
  }
  return out;
};

// SVG blocks (draw-line, snap cross, jump arrows): emit their <line> and
// <polygon> children. Geometry is in user units == px, offset by the svg's
// canvas-space origin. Presentational values come from attributes, falling back
// to computed style, so both attribute- and CSS-styled shapes work.
PdfVectorRenderer.prototype._walkSvg = function (svg, z) {
  var svgRect = svg.getBoundingClientRect();
  var ox = svgRect.left - this._ox;
  var oy = svgRect.top - this._oy;

  var lines = svg.getElementsByTagName("line");
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var lcs = getComputedStyle(ln);
    var stroke =
      this._color(ln.getAttribute("stroke")) || this._color(lcs.stroke);
    if (!stroke) continue; // transparent hit lines
    var w = parseFloat(ln.getAttribute("stroke-width") || lcs.strokeWidth) || 1;
    var dash = (ln.getAttribute("stroke-dasharray") || lcs.strokeDasharray) + "";
    this._pushLine(
      ox + (parseFloat(ln.getAttribute("x1")) || 0),
      oy + (parseFloat(ln.getAttribute("y1")) || 0),
      ox + (parseFloat(ln.getAttribute("x2")) || 0),
      oy + (parseFloat(ln.getAttribute("y2")) || 0),
      stroke,
      w,
      dash && dash !== "none" && dash !== "",
      z,
    );
  }

  var polys = svg.getElementsByTagName("polygon");
  for (var p = 0; p < polys.length; p++) {
    var poly = polys[p];
    var pcs = getComputedStyle(poly);
    var fill = this._color(poly.getAttribute("fill")) || this._color(pcs.fill);
    var pstroke =
      this._color(poly.getAttribute("stroke")) || this._color(pcs.stroke);
    if (!fill && !pstroke) continue;
    var raw = (poly.getAttribute("points") || "").trim();
    if (!raw) continue;
    var nums = raw.split(/[\s,]+/).map(parseFloat);
    var pts = [];
    var minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (var k = 0; k + 1 < nums.length; k += 2) {
      var px = ox + nums[k];
      var py = oy + nums[k + 1];
      pts.push([px, py]);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    if (pts.length < 2) continue;
    var sw = parseFloat(poly.getAttribute("stroke-width") || pcs.strokeWidth) || 1;
    var prim = {
      type: "poly",
      z: z,
      pts: pts,
      fill: fill,
      stroke: pstroke ? { color: pstroke, width: sw } : null,
    };
    this._bbox(prim, minX - sw, minY - sw, maxX + sw, maxY + sw);
    this._push(prim);
  }
};

// Paint every primitive that touches this page onto the current PDF page.
// k = millimetres per canvas pixel. Primitives are pre-sorted into paint order.
PdfVectorRenderer.prototype.paintPage = function (pdf, prims, page, fmt, k) {
  var pxL = page.left,
    pxT = page.top;
  var pxR = pxL + fmt.w,
    pxB = pxT + fmt.h;
  var mmPerPt = PdfVectorRenderer.MM_PER_PT;

  // canvas px -> page mm
  var X = function (v) {
    return (v - pxL) * k;
  };
  var Y = function (v) {
    return (v - pxT) * k;
  };

  for (var i = 0; i < prims.length; i++) {
    var p = prims[i];
    // Skip primitives that lie entirely outside this page.
    if (p.br < pxL || p.bl > pxR || p.bb < pxT || p.bt > pxB) continue;

    if (p.type === "rect") {
      if (p.fill) {
        pdf.setFillColor(p.fill.r, p.fill.g, p.fill.b);
        pdf.rect(X(p.x), Y(p.y), p.w * k, p.h * k, "F");
      }
      if (p.stroke) {
        pdf.setDrawColor(p.stroke.color.r, p.stroke.color.g, p.stroke.color.b);
        pdf.setLineWidth(Math.max(p.stroke.width * k, 0.1));
        pdf.setLineDashPattern(p.stroke.dash ? [1, 1] : [], 0);
        pdf.rect(X(p.x), Y(p.y), p.w * k, p.h * k, "S");
        pdf.setLineDashPattern([], 0);
      }
    } else if (p.type === "line") {
      pdf.setDrawColor(p.color.r, p.color.g, p.color.b);
      pdf.setLineWidth(Math.max(p.width * k, 0.1));
      pdf.setLineDashPattern(p.dash ? [1, 1] : [], 0);
      pdf.line(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2));
      pdf.setLineDashPattern([], 0);
    } else if (p.type === "circle") {
      if (p.fill) {
        pdf.setFillColor(p.fill.r, p.fill.g, p.fill.b);
      }
      if (p.stroke) {
        pdf.setDrawColor(p.stroke.color.r, p.stroke.color.g, p.stroke.color.b);
        pdf.setLineWidth(Math.max(p.stroke.width * k, 0.1));
      }
      var style = p.fill && p.stroke ? "FD" : p.fill ? "F" : "S";
      pdf.circle(X(p.cx), Y(p.cy), p.rr * k, style);
    } else if (p.type === "poly") {
      var pts = p.pts;
      if (p.fill) pdf.setFillColor(p.fill.r, p.fill.g, p.fill.b);
      if (p.stroke) {
        pdf.setDrawColor(p.stroke.color.r, p.stroke.color.g, p.stroke.color.b);
        pdf.setLineWidth(Math.max(p.stroke.width * k, 0.1));
      }
      this._paintPoly(pdf, pts, X, Y, p.fill, p.stroke);
    } else if (p.type === "text") {
      this._paintText(pdf, p, X, Y, k, mmPerPt);
    }
  }
};

PdfVectorRenderer.prototype._paintPoly = function (pdf, pts, X, Y, fill, stroke) {
  // jsPDF has no public polygon primitive; stroke via connected line segments
  // and fill via the lines() path helper.
  if (fill) {
    var first = pts[0];
    var rel = [];
    for (var i = 1; i < pts.length; i++) {
      rel.push([X(pts[i][0]) - X(pts[i - 1][0]), Y(pts[i][1]) - Y(pts[i - 1][1])]);
    }
    var style = stroke ? "DF" : "F";
    pdf.lines(rel, X(first[0]), Y(first[1]), [1, 1], style, true);
    return;
  }
  if (stroke) {
    for (var j = 0; j < pts.length; j++) {
      var a = pts[j];
      var b = pts[(j + 1) % pts.length];
      pdf.line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]));
    }
  }
};

PdfVectorRenderer.prototype._paintText = function (pdf, p, X, Y, k, mmPerPt) {
  var mm = p.sizePx * k;
  var pt = mm / mmPerPt;
  if (pt < 1) return;

  pdf.setFont("helvetica", p.bold ? "bold" : "normal");
  pdf.setFontSize(pt);
  pdf.setTextColor(p.color.r, p.color.g, p.color.b);

  // Shrink to fit the box width (on screen the box has overflow:hidden, and
  // Helvetica is wider than the on-screen Calibri so labels could spill).
  var boxW = p.w * k;
  if (boxW > 0) {
    var tw = pdf.getTextWidth(p.str);
    if (tw > boxW && tw > 0) {
      pdf.setFontSize(Math.max(pt * (boxW / tw), 1));
    }
  }

  var ax;
  if (p.align === "center") ax = X(p.x + p.w / 2);
  else if (p.align === "right") ax = X(p.x + p.w);
  else ax = X(p.x);

  var ay = Y(p.y + p.h / 2);
  pdf.text(p.str, ax, ay, { align: p.align, baseline: "middle" });
};

// Build the whole document. pages is the list from _pagesWithContent; fmt is the
// active PAGE_FORMATS entry; pdfFactory returns a fresh jsPDF for a given page
// count. Returns the jsPDF instance (not yet saved).
PdfVectorRenderer.prototype.render = function (pdf, pages, fmt, addPage) {
  var prims = this.collect();
  var k = fmt.pdfW / fmt.w; // mm per canvas px (== 1 / PX_PER_MM)

  for (var i = 0; i < pages.length; i++) {
    if (i > 0) addPage();
    this.paintPage(pdf, prims, pages[i], fmt, k);
  }
  return pdf;
};
