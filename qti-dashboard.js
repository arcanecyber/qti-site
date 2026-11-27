/* Quantum Transition Index dashboard widget.
 *
 * Usage (any page, including an Elementor HTML widget):
 *   <link rel="stylesheet" href=".../qti-dashboard.css">
 *   <div data-qti-dashboard data-src=".../data.json"></div>
 *   <script src=".../qti-dashboard.js" defer></script>
 *
 * Attributes: data-src (required) is the dashboard JSON; data-live (optional) is a
 * Server-Sent Events URL that triggers a reload when new data is published.
 */
(function () {
  "use strict";

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  var compact = function (n) { return nf.format(n); };
  var conf = function (c) {
    return c ? '<span class="qti-conf ' + esc(c) + '">' + esc(c) + "</span>"
             : '<span class="qti-conf low">no data</span>';
  };
  var fmtRaw = function (p) {
    if (p.pillar === "hardware") return p.best_machine ? compact(p.best_machine.logical_qubits) + " LQ" : "";
    if (p.raw_value == null) return "";
    if (p.unit === "USD") return "$" + compact(p.raw_value);
    if (p.unit === "fraction") return Math.round(p.raw_value * 100) + "%";
    return compact(p.raw_value);
  };
  var machine = function (m) {
    return m ? esc(m.organization || m.country) + " · " + compact(m.logical_qubits) + " logical qubits × " +
               compact(m.logical_gate_budget) + " gates (" + esc(m.status) + ")" : "none yet";
  };

  function gapRows(rows) {
    var caps = [1];
    rows.forEach(function (r) {
      if (r.required) caps.push(r.required.capability);
      if (r.current) caps.push(r.current.capability);
    });
    var scale = Math.max.apply(null, caps) * 1.06;
    return rows.map(function (r) {
      var cur = r.current ? (r.current.capability / scale) * 100 : 0;
      var req = r.required ? (r.required.capability / scale) * 100 : null;
      var pct = r.progress != null ? Math.round(r.progress * 100) + "%" : "–";
      var short = r.required && r.current ? Math.max(0, r.required.capability - r.current.capability) : null;
      var gap = short == null ? "–" : short < 0.05 ? "reached" : compact(Math.pow(10, short)) + "× short";
      return '<div class="qti-bar-row" tabindex="0" role="button" aria-expanded="false">' +
          '<span class="qti-name">' + esc(r.name) + (r.kind === "risk" ? " (risk)" : "") + "</span>" +
          '<span class="qti-track"><span class="qti-fill' + (r.kind === "risk" ? " qti-risk" : "") +
          '" style="width:' + cur + '%"></span>' +
          (req != null ? '<span class="qti-marker" style="left:' + req + '%"></span>' : "") + "</span>" +
          '<span class="qti-num">' + gap + "</span></div>" +
        '<div class="qti-tip"><table>' +
          "<tr><td>Required" + (r.required ? " (" + esc(r.required.variant) + ")" : "") + "</td><td>" +
          (r.required ? compact(r.required.logical_qubits) + " logical qubits × " +
                        compact(r.required.logical_gate_budget) + " gates" : "no estimate yet") + "</td></tr>" +
          "<tr><td>Best today</td><td>" + machine(r.current) + "</td></tr>" +
          "<tr><td>Gap</td><td>" + gap + " (qubits × gates)</td></tr>" +
          "<tr><td>Progress on log scale</td><td>" + pct + "</td></tr>" +
          (r.required ? "<tr><td>Estimate confidence</td><td>" + conf(r.required.confidence) + "</td></tr>" : "") +
        "</table></div>";
    }).join("");
  }

  function countryRows(countries) {
    return countries.map(function (c) {
      return '<div class="qti-bar-row" tabindex="0" role="button" aria-expanded="false">' +
          '<span class="qti-name">' + esc(c.name) + "</span>" +
          '<span class="qti-track"><span class="qti-fill" style="width:' + c.score + '%"></span></span>' +
          '<span class="qti-num">' + Math.round(c.score) + "</span></div>" +
        '<div class="qti-tip"><table>' +
          c.pillars.map(function (p) {
            return "<tr><td>" + esc(p.name) + " <small>(" + Math.round(p.weight * 100) + "%)</small></td><td>" +
                   Math.round(p.score) + " · " + conf(p.confidence) + "</td></tr>";
          }).join("") +
          "<tr><td><b>Blended</b></td><td><b>" + Math.round(c.score) + "</b> · " + conf(c.confidence) + "</td></tr>" +
        "</table></div>";
    }).join("");
  }

  function countryCards(countries) {
    return countries.map(function (c) {
      return '<section class="qti-card"><div class="qti-ctitle"><h3>' + esc(c.name) + "</h3>" +
          '<span class="qti-score">Blended ' + Math.round(c.score) + " · " + conf(c.confidence) + "</span></div>" +
          '<p class="qti-label">Pillars</p>' +
          c.pillars.map(function (p) {
            return '<div class="qti-prow"><span>' + esc(p.name) + " <small>" + Math.round(p.weight * 100) + "%</small></span>" +
                   '<span class="qti-track"><span class="qti-fill" style="width:' + p.score + '%"></span></span>' +
                   '<span class="qti-raw">' + fmtRaw(p) + " " + conf(p.confidence) + "</span></div>";
          }).join("") + "</section>";
    }).join("");
  }

  function render(el, d) {
    var updated = new Date(d.generated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    el.innerHTML =
      '<div class="qti-head"><h2 class="qti-title">Quantum Transition Index</h2>' +
      '<div class="qti-meta">Last updated ' + esc(updated) + " · Methodology v" + esc(d.methodology_version) + "</div></div>" +
      (d.sample_data ? '<div class="qti-banner">SAMPLE DATA. Every number on this page is invented for layout preview and must not be cited.</div>' : "") +
      '<div class="qti-grid qti-row1">' +
        '<section class="qti-card"><p class="qti-label">Gap to application ( | = required )</p>' + gapRows(d.gap) +
        '<p class="qti-legend">Bar: best demonstrated machine (logical qubits × gate budget, log scale). Marker: what the application needs. Right: how many times more capability is still needed.</p></section>' +
        '<section class="qti-card"><p class="qti-label">By country</p>' + countryRows(d.by_country.countries) +
        '<p class="qti-foot">Publicly observable progress · confidence per country · hover or tap a bar for its pillars</p></section>' +
      "</div>" +
      '<div class="qti-grid qti-cards">' + countryCards(d.by_country.countries) + "</div>";
  }

  function wire(el) {
    el.addEventListener("click", function (e) {
      var row = e.target.closest(".qti-bar-row");
      el.querySelectorAll(".qti-bar-row.qti-open").forEach(function (r) {
        if (r !== row) { r.classList.remove("qti-open"); r.setAttribute("aria-expanded", "false"); }
      });
      if (row) {
        var open = row.classList.toggle("qti-open");
        row.setAttribute("aria-expanded", open ? "true" : "false");
      }
    });
    el.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("qti-bar-row")) {
        e.preventDefault();
        e.target.click();
      }
    });
  }

  function load(el) {
    var src = el.getAttribute("data-src");
    var bust = src + (src.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
    return fetch(bust, { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error(res.status + " " + res.statusText); return res.json(); })
      .then(function (d) { render(el, d); })
      .catch(function (e) {
        el.innerHTML = '<p class="qti-err">The Quantum Transition Index could not be loaded (' + esc(e.message) + ").</p>";
      });
  }

  function init(el) {
    if (el.getAttribute("data-qti-ready")) return;
    el.setAttribute("data-qti-ready", "1");
    el.classList.add("qti-dash");
    el.innerHTML = '<p class="qti-meta">Loading the Quantum Transition Index…</p>';
    wire(el);
    load(el);
    var live = el.getAttribute("data-live");
    if (live && window.EventSource && !/[?&]live=0/.test(location.search)) {
      try {
        var es = new EventSource(live);
        ["ingestion.completed", "panels.updated"].forEach(function (t) {
          es.addEventListener(t, function () { load(el); });
        });
      } catch (_) { /* live updates are optional */ }
    }
  }

  function boot() { document.querySelectorAll("[data-qti-dashboard]").forEach(init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
