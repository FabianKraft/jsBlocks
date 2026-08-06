///////////////////////////////////////////////////////////
//
//		Performance instrumentation for jsBlocks
//		Copyright 2026 Fabian Kraft
//
//		Lightweight timing helper. Costs nothing while Perf.enabled is
//		false (every hook is guarded), so it can stay in the shipped code.
//
//		Usage from the browser console:
//		  Perf.reset();            // clear old samples
//		  Perf.enabled = true;     // start measuring
//		  ... drag blocks / draw connections in the app ...
//		  Perf.report();           // print a table, sorted by total time
//		  Perf.enabled = false;    // stop measuring
//
//		  Perf.verbose = true;     // also log every rerouteAllLines call live
//
//		Labels currently recorded:
//		  rerouteAllLines        - the full reroute that runs on every block
//		                           drop and every new connection (the freeze)
//		  LineRouter.route       - one A* path search (called once per line)
//		  LineRouter.buildIndex  - building the shared obstacle index; now once
//		                           per reroute instead of once per line
//		  LineRouter._obstacles  - legacy per-call obstacle build (only if some
//		                           caller still routes without a shared index)
//////////////////////////////////////////////////////////

var Perf = {
  enabled: false,
  verbose: false,
  stats: {},

  _rec: function (label, ms) {
    var s = this.stats[label];
    if (!s) {
      s = this.stats[label] = {
        count: 0,
        total: 0,
        min: Infinity,
        max: 0,
        last: 0,
      };
    }
    s.count++;
    s.total += ms;
    s.last = ms;
    if (ms < s.min) s.min = ms;
    if (ms > s.max) s.max = ms;
  },

  // Record a duration you measured yourself (used inside hot loops).
  add: function (label, ms) {
    if (this.enabled) this._rec(label, ms);
  },

  // Time a function call and record it under `label`. Returns the fn's result.
  // Early returns inside fn are preserved.
  time: function (label, fn) {
    if (!this.enabled) return fn();
    var t0 = performance.now();
    try {
      return fn();
    } finally {
      this._rec(label, performance.now() - t0);
    }
  },

  reset: function () {
    this.stats = {};
  },

  // Print a table sorted by total time spent. Returns the rows array too.
  report: function () {
    var rows = [];
    for (var k in this.stats) {
      if (!this.stats.hasOwnProperty(k)) continue;
      var s = this.stats[k];
      rows.push({
        label: k,
        calls: s.count,
        "total ms": Math.round(s.total * 10) / 10,
        "avg ms": Math.round((s.total / s.count) * 1000) / 1000,
        "min ms": Math.round(s.min * 1000) / 1000,
        "max ms": Math.round(s.max * 1000) / 1000,
        "last ms": Math.round(s.last * 1000) / 1000,
      });
    }
    rows.sort(function (a, b) {
      return b["total ms"] - a["total ms"];
    });
    if (rows.length === 0) {
      console.log("[Perf] no samples yet — set Perf.enabled = true first.");
    } else if (console.table) {
      console.table(rows);
    } else {
      console.log(rows);
    }
    return rows;
  },
};

if (typeof window !== "undefined") window.Perf = Perf;
