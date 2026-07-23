///////////////////////////////////////////////////////////
//
//		Cross-Reference Panel
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

// Dockable cross-reference list (bottom-right). Selecting a tagged element (DI,
// DO, AI, AQ or a Label) filters the list to every element sharing that
// identifier across all these types; with no single tagged element selected it
// shows the full index grouped by tag. Clicking a row recentres the view on that
// element without changing the zoom or the current selection.

function CrossRef(sheet) {
  this.sheet = sheet;
  this.visible = false;
  this._rows = []; // entries currently shown, indexed by row's data-i
  this._dom = null; // cached { panel, title, rows } once the DOM exists
}

// In-scope block types and the property that holds their cross-reference id.
CrossRef.TYPES = {
  Di: "tagName",
  Do: "tagName",
  Ai: "tagName",
  Aq: "tagName",
  TagLabelIn: "labelName",
  TagLabelOut: "labelName",
  LabelInPanel: "labelName",
  LabelOutPanel: "labelName",
  JumpIn: "labelName",
  JumpOut: "labelName",
};

// Short label shown in the "Typ" column.
CrossRef.TYPE_LABEL = {
  Di: "DI",
  Do: "DO",
  Ai: "AI",
  Aq: "AQ",
  TagLabelIn: "Label In",
  TagLabelOut: "Label Out",
  LabelInPanel: "Panel In",
  LabelOutPanel: "Panel Out",
  JumpIn: "Jump In",
  JumpOut: "Jump Out",
};

// Default/unedited identifiers (compared lower-case) that are hidden from the
// list, so untouched blocks do not clutter it until they are actually named.
CrossRef.PLACEHOLDERS = { "": 1, tagname: 1, ai: 1, aq: 1, "???": 1 };

// Resolve and cache the panel's DOM nodes; null until the panel exists.
CrossRef.prototype._els = function () {
  if (this._dom) return this._dom;
  var panel = document.getElementById("crossRefPanel");
  if (!panel) return null;
  this._dom = {
    panel: panel,
    title: document.getElementById("crossRefTitle"),
    rows: document.getElementById("crossRefRows"),
  };
  var self = this;
  // One delegated click handler for the whole table body.
  this._dom.rows.addEventListener("click", function (e) {
    var tr = e.target;
    while (tr && tr.tagName !== "TR") tr = tr.parentNode;
    if (!tr || tr.getAttribute("data-i") == null) return;
    var entry = self._rows[parseInt(tr.getAttribute("data-i"), 10)];
    if (entry) self.centerOn(entry.block);
  });
  return this._dom;
};

CrossRef.prototype._idField = function (block) {
  return block ? CrossRef.TYPES[block.objectName] : null;
};

CrossRef.prototype._tagOf = function (block) {
  var field = this._idField(block);
  if (!field) return "";
  var v = block[field];
  return v == null ? "" : String(v).trim();
};

CrossRef.prototype._isPlaceholder = function (tag) {
  return CrossRef.PLACEHOLDERS[tag.toLowerCase()] === 1;
};

// Collect one entry per in-scope, named element on the sheet.
CrossRef.prototype._collect = function () {
  var out = [];
  var blocks = this.sheet.blockObjects;
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (!b || !b.divObj || !CrossRef.TYPES[b.objectName]) continue;
    var tag = this._tagOf(b);
    if (!tag || this._isPlaceholder(tag)) continue;

    var x = parseInt(b.divObj.style.left) || 0;
    var y = parseInt(b.divObj.style.top) || 0;
    var w = b.divObj.offsetWidth || 0;
    var h = b.divObj.offsetHeight || 0;
    var page = this.sheet._pageNumberAtCanvas(x + w / 2, y + h / 2);

    out.push({
      block: b,
      typeLabel: CrossRef.TYPE_LABEL[b.objectName] || b.objectName,
      tag: tag,
      tagKey: tag.toLowerCase(),
      comment: b.comment == null ? "" : String(b.comment).trim(),
      x: x,
      y: y,
      page: page, // 1-based page number, or null when no page grid is active
    });
  }
  return out;
};

// The single tagged, in-scope block that is currently selected, or null.
CrossRef.prototype._selectedEntryTag = function () {
  var sel = this.sheet.selectedBlocks;
  if (!sel || sel.length !== 1) return null;
  var b = sel[0];
  if (!CrossRef.TYPES[b.objectName]) return null;
  var tag = this._tagOf(b);
  if (!tag || this._isPlaceholder(tag)) return null;
  return tag;
};

// Rebuild and repaint the list. Cheap; skipped entirely while the panel is
// hidden and re-run when it is shown or the selection changes.
CrossRef.prototype.refresh = function () {
  if (!this.visible) return;
  var dom = this._els();
  if (!dom) return;

  var entries = this._collect();
  var focusTag = this._selectedEntryTag();
  var title;

  if (focusTag != null) {
    var key = focusTag.toLowerCase();
    entries = entries.filter(function (e) {
      return e.tagKey === key;
    });
    title = 'Querverweise: "' + focusTag + '"';
    // Within one tag: reading order (page, then top-to-bottom, left-to-right).
    entries.sort(function (a, b) {
      return cmpPage(a.page, b.page) || a.y - b.y || a.x - b.x;
    });
  } else {
    title = "Querverweise (alle)";
    // Full index: cluster by tag, then reading order inside each tag.
    entries.sort(function (a, b) {
      if (a.tagKey !== b.tagKey) return a.tagKey < b.tagKey ? -1 : 1;
      return cmpPage(a.page, b.page) || a.y - b.y || a.x - b.x;
    });
  }

  this._rows = entries;
  this._render(dom, title, entries, focusTag != null);

  function cmpPage(pa, pb) {
    // Blocks off the page grid (null) sort after numbered pages.
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  }
};

CrossRef.prototype._render = function (dom, title, entries, filtered) {
  dom.title.textContent = title;

  if (entries.length === 0) {
    dom.rows.innerHTML =
      '<tr class="crossref-empty"><td colspan="5">' +
      (filtered
        ? "Keine weiteren Elemente mit diesem Tag."
        : "Keine benannten Elemente vorhanden.") +
      "</td></tr>";
    return;
  }

  var html = "";
  var prevKey = null;
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    // In the full index, a thin separator marks the start of each tag group.
    var groupStart = !filtered && e.tagKey !== prevKey;
    prevKey = e.tagKey;
    html +=
      '<tr data-i="' +
      i +
      '"' +
      (groupStart ? ' class="crossref-group"' : "") +
      ">" +
      "<td>" +
      esc(e.typeLabel) +
      "</td>" +
      "<td>" +
      esc(e.tag) +
      "</td>" +
      '<td class="crossref-comment">' +
      esc(e.comment) +
      "</td>" +
      "<td>" +
      (e.page == null ? "—" : e.page) +
      "</td>" +
      '<td class="crossref-pos">X:' +
      e.x +
      " Y:" +
      e.y +
      "</td>" +
      "</tr>";
  }
  dom.rows.innerHTML = html;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
};

// Recentre the viewport on a block without touching the zoom or the selection.
CrossRef.prototype.centerOn = function (block) {
  if (!block || !block.divObj) return;
  var x = parseInt(block.divObj.style.left) || 0;
  var y = parseInt(block.divObj.style.top) || 0;
  var w = block.divObj.offsetWidth || 0;
  var h = block.divObj.offsetHeight || 0;
  var cx = x + w / 2;
  var cy = y + h / 2;

  var rect = this.sheet.viewport.getBoundingClientRect();
  this.sheet.panX = rect.width / 2 - cx * this.sheet.scale;
  this.sheet.panY = rect.height / 2 - cy * this.sheet.scale;
  this.sheet._applyTransform();

  this._blink(block);
};

// Brief highlight so the eye can find the just-centred element. Uses a throwaway
// overlay so the block's own styling (borders, simulation colors) is untouched.
CrossRef.prototype._blink = function (block) {
  var canvas = this.sheet.canvas;
  var x = parseInt(block.divObj.style.left) || 0;
  var y = parseInt(block.divObj.style.top) || 0;
  var w = block.divObj.offsetWidth || 0;
  var h = block.divObj.offsetHeight || 0;

  var mark = document.createElement("div");
  mark.style.cssText =
    "position:absolute;pointer-events:none;z-index:50;border:2px solid #ff9800;" +
    "box-shadow:0 0 0 3px rgba(255,152,0,0.35);border-radius:2px;" +
    "transition:opacity 0.4s ease;opacity:1;";
  mark.style.left = x - 4 + "px";
  mark.style.top = y - 4 + "px";
  mark.style.width = w + 8 + "px";
  mark.style.height = h + 8 + "px";
  canvas.appendChild(mark);

  window.setTimeout(function () {
    mark.style.opacity = "0";
  }, 700);
  window.setTimeout(function () {
    if (mark.parentNode) mark.parentNode.removeChild(mark);
  }, 1200);
};

// --- Visibility ---

CrossRef.prototype.show = function () {
  var dom = this._els();
  if (!dom) return;
  this.visible = true;
  dom.panel.classList.add("visible");
  this._syncButton();
  this.refresh();
};

CrossRef.prototype.hide = function () {
  var dom = this._els();
  if (!dom) return;
  this.visible = false;
  dom.panel.classList.remove("visible");
  this._syncButton();
};

CrossRef.prototype.toggle = function () {
  if (this.visible) this.hide();
  else this.show();
};

CrossRef.prototype._syncButton = function () {
  var btn = document.getElementById("crossRefButton");
  if (btn) btn.classList.toggle("active", this.visible);
};

// Called by the sheet whenever the selection changes.
CrossRef.prototype.onSelectionChanged = function () {
  this.refresh();
};
