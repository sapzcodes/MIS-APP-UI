(function () {
  "use strict";

  /* ANDROID APP (MIS-Report.apk): no SAP login lives in this file (it is hosted publicly).
     The native shell injects the Authorization header and sap-client into every /sap/* request. */

  /* Change log (this session):
     - Sub-card expand: transition jank fixed. Removed padding from transition on .sub-card.
       Only transform+box-shadow+border transition on the card; font-size transitions
       consolidated on children so they all animate in one frame, not two.
     - Tile popup: attachTilePopup() added. Clicking a tile header opens a full-screen
       modal (backdrop + panel) showing only that tiles content. ESC and backdrop click close it.
       Popup clones the tile body HTML so the original dashboard is untouched underneath.
     - All other functions unchanged. */

  /* SESSION CHANGE LOG:
     1. Sub-card hover-only: Removed attachSubCardToggle() entirely. CSS :hover rules
        already handle the expand animation — no JS class toggling needed.
        Removed the call to attachSubCardToggle(el) in renderDashboard().
     2. Popup reopen fix: openPopup() now removes is-visible, forces a reflow via
        void popupPanel.offsetHeight, then re-adds is-visible so the browser always
        sees a fresh 0→1 CSS transition on every open — not just the first time.
        ESC listener guarded with a one-time flag so it only registers once. */

  /* CDS SPLIT CHANGE LOG (zmm_cds_pl_summary):
     1. CDS no longer returns one row per fagl_typ (A/B/C). It returns a SINGLE row
        with sales/purchase already split into 6 fields:
        total_sales_ason / _tillyest / _today and total_purchase_ason / _tillyest / _today.
        Reason: move the A/B/C split out of the UI and into the CDS.
     2. loadPL(): removed byTyp grouping, now passes rows[0] to renderDashboard().
     3. renderDashboard(r): takes the single row, maps the 6 fields directly.
     4. "For Date" cards (Sales & Purchase, Production vs Sales) now show the
        selected date, e.g. "For Date (05 Oct 2026)". No CSS changed. */

  /* CURRENCY + ORDER QTY CHANGE LOG:
     1. Added fmtRs(): prefixes ₹ to fmtAmt() results (sign stays in front: "- ₹ 1,234.00").
        Applied to Stock Value, Rejection Store Value, Sundry Creditors and Sundry Debtors
        (>120 / >60 days). Sales/Purchase cards already had ₹ via fmtSale/fmtPurch.
     2. Production Order cards now show "count / qty", mapped from the new CDS fields
        open_orders_qty, WIP_orders_qty, orders_gt7days_qty (from zmm_ord_count).
     No CSS changed. */

  /* STOCK VALUE SPLIT CHANGE LOG:
     1. Stock Value card (Stock & Rejection & Cost tile) now shows 2 rows:
        FG = CDS field stock_value_FG, RM = CDS field stock_value_RM.
        Reason: CDS zmm_cds_pl_summary exposes stock_value_RM / stock_value_FG
        separately; the old single rA.stock_value field no longer exists in the CDS
        so the card always showed 0. Uses the existing sub-val-block / sub-val-label /
        sub-val-amount classes (same as the Sales & Purchase card). No CSS changed.
     2. FG / RM rows: label on the left, value on the right (inline flex,
        space-between on each sub-val-block). No CSS file change.
     3. Selection screen: prefillDate() sets #inp-date to today (todayISO()) on load
        so the field no longer shows the dd-mm-yyyy placeholder. Only fills when empty,
        so changeParams() still restores the previously chosen date. */

  /* DASH v2 CHANGE LOG (26 Oct 2026):
     1. Production Order tile split into 2 lines: Open (current month) + Open pending till last
        month, then WIP + >7 days. FG only (mtart 50-59) from the CDS.
        New CDS fields: open_curr_qty/_value, open_prev_qty/_value. Added poCard() helper.
     2. "Sales" -> "Revenue" in tile titles (Revenue & Purchase, Production vs Revenue).
     3. COGS % card removed, COGM % now = (node 8 + node 63) / sales, calculated in the CDS
        (cogm_pct). cogs_pct is no longer read.
     4. Creditors / Debtors tiles: Total, >60 to <120, >120 (cols-3). Creditors now come from
        vendor ageing (was swapped), special GL included, excluded vendors via ZFI_VEND_EXCL.
        CDS fields SUNDRY_CRED_TOT/_120/_60 and SUNDRY_DEBT_TOT/_120/_60.
     5. Company name shown in header (CDS field company_name from T001), set in loadPL(). */

  /* DASH v3 CHANGE LOG (27 Oct 2026):
     1. Production Order tile now has two sub-headings with month names (from the selected date):
        "Current Month - <Month YYYY>": Open Order Qty, Open Order Value, Orders > 7 Days.
        "Till Previous Month - <Month YYYY>": Open Orders (qty / value), WIP Orders (qty / value).
        New CDS fields: open_curr_gt7_qty/_value, wip_prev_qty/_value (open_curr_* and open_prev_* exist).
        poCard() takes an optional value; without it only the first figure is shown.
     2. Last used selection (company, year, FS version, date) is saved in localStorage and
        restored on reload, which also logs in automatically. "Change" still opens the selection screen.
     3. COGM = node 8 + node 63 summed as they are, no sign flip (CDS change, nothing in this file).
     4. Spacing / hover tweaks are CSS only, see the override block in the chat (dashboard.css). */

  /* DASH v4 CHANGE LOG (27 Oct 2026, later):
     1. Production Order sub-headings: 15px left padding so they line up with the cards.
     2. Compact layout so all tiles fit one screen: inline gaps in saleBlock and the
        Stock Value FG/RM rows reduced 8px -> 4px. Rest of the spacing is in dashboard-compact.css. */

  /* DASH v5 CHANGE LOG (27 Oct 2026, evening):
     1. COGM % is now a single line (label left, value right) at the bottom of the
        Stock & Rejection & Cost tile instead of its own card (.cost-line).
     2. New "Ageing Mix" tile at the bottom of the right column: Debtors and Creditors as
        stacked bars (up to 60 / 60-120 / > 120 days), absolute values on a shared scale.
        It uses tile--grow so it stretches to the height of the left column.
        Built from existing CDS fields (SUNDRY_*_TOT / _60 / _120), no CDS change.
        outerTile() got an optional 4th argument (extra CSS class). */

  var B = "", Y = "", V = "", D = "";

  /* ── Last used selection (survives reload) ── */
  var LS_KEY = "pl_dash_sel_v1";

  function saveSel() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ b: B, y: Y, v: V, d: D })); } catch (e) {}
  }

  function restoreSel() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!s || !s.b || !s.y || !s.v || !s.d) return false;
      document.getElementById("inp-bukrs").value = s.b;
      document.getElementById("inp-year").value  = s.y;
      document.getElementById("inp-versn").value = s.v;
      document.getElementById("inp-date").value  = s.d;
      return true;
    } catch (e) { return false; }
  }

  /* "October 2026" for the month of iso, offset months away (-1 = previous month) */
  function monthLabel(iso, offset) {
    var names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1 + offset, 1));
    return names[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function todayISO() {
    var now = new Date();
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + mm + "-" + dd;
  }

  function isoToDisplay(iso) {
    var parts = iso.split("-");
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return parts[2] + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  function prevDayISO(iso) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function isoToOdata(e) { return "datetime'" + e + "T00:00:00'"; }

  function fmtAmt(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return { raw: "0", cls: "zero-val" };
    var abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return { raw: (n < 0 ? "- " : "") + abs, cls: n < 0 ? "neg" : "pos" };
  }

  function fmtSale(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return { raw: "\u20b9\u00a00", cls: "zero-val" };
    var abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return { raw: (n < 0 ? "- \u20b9\u00a0" : "\u20b9\u00a0") + abs, cls: "income" };
  }

  function fmtPurch(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return { raw: "\u20b9\u00a00", cls: "zero-val" };
    var abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return { raw: (n < 0 ? "- \u20b9\u00a0" : "\u20b9\u00a0") + abs, cls: "expense" };
  }

  function fmtPct(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return "0.00%";
    return n.toFixed(2) + "%";
  }

  function fmtNum(val) {
    var n = parseFloat(val);
    if (isNaN(n) || n === 0) return "0";
    return n.toLocaleString("en-IN");
  }

  /* Rupee prefix for fmtAmt() results. Sign goes before the symbol: "- ₹ 1,234.00" */
  function fmtRs(f) {
    return f.raw.indexOf("- ") === 0
      ? "- \u20b9\u00a0" + f.raw.slice(2)
      : "\u20b9\u00a0" + f.raw;
  }
  function fmtRsVal(v) { return fmtRs(fmtAmt(v)); }

  /* ── SVG icons ── */
  var IC = {
    calendar: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<rect x="1" y="2" width="14" height="13" rx="2" stroke="#1b3a52" stroke-width="1.4"/>'
      + '<path d="M1 6h14" stroke="#1b3a52" stroke-width="1.4"/>'
      + '<path d="M5 1v3M11 1v3" stroke="#1b3a52" stroke-width="1.4" stroke-linecap="round"/>'
      + '</svg>',
    chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 15l4-5 4 3 4-6"/>'
      + '</svg>',
    box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>'
      + '</svg>',
    factory: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M2 20h20M4 20V10l5 4V10l5 4V4l6 6v10"/>'
      + '</svg>',
    people: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>'
      + '<path d="M16 3a4 4 0 0 1 0 8M21 21v-2a4 4 0 0 0-3-3.87"/>'
      + '</svg>',
    coin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a2.5 2.5 0 0 1 0 5H9"/>'
      + '</svg>',
    block: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b3a52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="9"/><line x1="4.22" y1="4.22" x2="19.78" y2="19.78"/>'
      + '</svg>'
  };

  var CHEVRON = '<span class="tile-hdr-chevron">&#8250;</span>';

  var LOADING_HTML = '<div class="loading-wrap">'
    + '<div class="loading-spinner"></div>'
    + '<div class="loading-text">Fetching data\u2026</div>'
    + '</div>';

  /* ── HTML builder helpers ── */

  function outerTile(icon, title, body, extra) {
    return '<div class="tile' + (extra ? ' ' + extra : '') + '">'
      + '<div class="tile-hdr" role="button" tabindex="0" aria-label="Expand ' + title.replace(/&amp;/g,'&') + '">'
      + '<div class="tile-hdr-left">'
      + '<span class="tile-hdr-icon">' + icon + '</span>'
      + '<span class="tile-hdr-title">' + title + '</span>'
      + '</div>'
      + CHEVRON
      + '</div>'
      + '<div class="tile-body">' + body + '</div>'
      + '</div>';
  }

  function periodCard(label, bodyHtml) {
    return '<div class="sub-card" role="button" tabindex="0">'
      + '<div class="sub-card-hdr">'
      + '<span class="sub-card-hdr-icon">' + IC.calendar + '</span>'
      + '<span class="sub-card-hdr-title">' + label + '</span>'
      + '</div>'
      + bodyHtml
      + '</div>';
  }

  function saleBlock(saleF, purchF) {
    return '<div class="sub-val-block">'
      + '<div class="sub-val-label">Revenue</div>'
      + '<div class="sub-val-amount ' + saleF.cls + '">' + saleF.raw + '</div>'
      + '</div>'
      + '<div class="sub-val-block" style="margin-top:4px">'
      + '<div class="sub-val-label">Purchase</div>'
      + '<div class="sub-val-amount ' + purchF.cls + '">' + purchF.raw + '</div>'
      + '</div>';
  }

  function pvsBlock(prod, sale, stk) {
    return '<div class="pvs-row">'
      + '<span class="pvs-label">Production</span><span class="pvs-val">' + prod + '</span>'
      + '</div>'
      + '<div class="pvs-row">'
      + '<span class="pvs-label">Revenue</span><span class="pvs-val">' + sale + '</span>'
      + '</div>'
      + '<div class="pvs-row">'
      + '<span class="pvs-label">Stock</span><span class="pvs-val">' + stk + '</span>'
      + '</div>';
  }

  /* Production Order card: label + "qty / value" (or just q when v is not passed) */
  function poCard(label, q, v) {
    return '<div class="sub-card prod-order-card" role="button" tabindex="0">'
      + '<div class="prod-order-label">' + label + '</div>'
      + '<div class="prod-order-val">' + q + (v === undefined ? '' : ' / ' + v) + '</div>'
      + '</div>';
  }

  /* Production Order sub-heading (month name) */
  function poSubHdr(text, first) {
    return '<div class="po-subhdr" style="font-size:12px;font-weight:600;color:#1b3a52;padding-left:15px;margin:'
      + (first ? '2px' : '6px') + ' 0 4px">' + text + '</div>';
  }

  /* Ageing mix: split of one party type (debtors / creditors) into
     up to 60 days (= total - the two buckets, includes not due), 60 to 120 and > 120.
     Absolute values, so creditors (negative in the CDS) draw like debtors. */
  function ageParts(total, g60, g120) {
    var t = Math.abs(parseFloat(total) || 0);
    var b = Math.abs(parseFloat(g60)   || 0);
    var c = Math.abs(parseFloat(g120)  || 0);
    var a = Math.max(t - b - c, 0);
    return { t: t, a: a, b: b, c: c, sum: a + b + c };
  }

  function ageingRow(label, p, max) {
    var w = max > 0 ? (p.sum / max * 100) : 0;
    function seg(v, cls) {
      return (p.sum > 0 && v > 0)
        ? '<span class="ag-seg ' + cls + '" style="width:' + (v / p.sum * 100) + '%" title="' + fmtRs(fmtAmt(v)) + '"></span>'
        : '';
    }
    return '<div class="ag-row">'
      + '<span class="ag-lbl">' + label + '</span>'
      + '<div class="ag-track"><div class="ag-bar" style="width:' + (p.sum > 0 ? Math.max(w, 2) : 0) + '%">'
      + seg(p.a, "ag-a") + seg(p.b, "ag-b") + seg(p.c, "ag-c")
      + '</div></div>'
      + '<span class="ag-tot">' + fmtRs(fmtAmt(p.t)) + '</span>'
      + '</div>';
  }

  /* ── Tile popup ──
     Clicking the tile-hdr clones the tile-body HTML into a centred modal overlay.
     The modal has its own sub-card hover so expand works inside it too.
     Reason: user wants to focus on one tile at full size with everything else behind.

     FIX (this session): openPopup() strips is-visible and forces a reflow before
     re-adding it, so the CSS opacity/transform transition fires on every open, not
     just the first time. ESC listener registered only once via _escBound flag. */

  var popupBackdrop = null;
  var popupPanel    = null;

  function buildPopupDOM() {
    /* Create backdrop */
    popupBackdrop = document.createElement("div");
    popupBackdrop.className = "tile-popup-backdrop";
    popupBackdrop.addEventListener("click", closePopup);

    /* Create panel */
    popupPanel = document.createElement("div");
    popupPanel.className = "tile-popup";
    popupPanel.setAttribute("role", "dialog");
    popupPanel.setAttribute("aria-modal", "true");

    document.body.appendChild(popupBackdrop);
    document.body.appendChild(popupPanel);

    /* ESC closes — registered only once */
    if (!document._escBound) {
      document._escBound = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closePopup();
      });
    }
  }

  function openPopup(iconHtml, titleHtml, bodyHtml) {
    if (!popupBackdrop) buildPopupDOM();

    popupPanel.innerHTML =
      '<div class="tile-popup-hdr">'
      + '<div class="tile-popup-hdr-left">'
      + '<span class="tile-popup-hdr-icon">' + iconHtml + '</span>'
      + '<span class="tile-popup-hdr-title">' + titleHtml + '</span>'
      + '</div>'
      + '<button class="tile-popup-close" aria-label="Close">&times;</button>'
      + '</div>'
      + '<div class="tile-popup-body">' + bodyHtml + '</div>';

    /* Close button */
    popupPanel.querySelector(".tile-popup-close").addEventListener("click", closePopup);

    /* Strip is-visible + force reflow so CSS transition fires fresh every open */
    popupBackdrop.classList.remove("is-visible");
    popupPanel.classList.remove("is-visible");
    void popupBackdrop.offsetHeight; /* reflow */

    requestAnimationFrame(function () {
      popupBackdrop.classList.add("is-visible");
      popupPanel.classList.add("is-visible");
    });

    document.body.style.overflow = "hidden";
  }

  function closePopup() {
    if (!popupBackdrop) return;
    popupBackdrop.classList.remove("is-visible");
    popupPanel.classList.remove("is-visible");
    document.body.style.overflow = "";
  }

  function attachTilePopup(container) {
    container.querySelectorAll(".tile").forEach(function (tile) {
      var hdr  = tile.querySelector(".tile-hdr");
      var body = tile.querySelector(".tile-body");
      if (!hdr || !body) return;

      var iconEl  = hdr.querySelector(".tile-hdr-icon");
      var titleEl = hdr.querySelector(".tile-hdr-title");

      function open(e) {
        /* Don't fire if a sub-card inside body was clicked */
        if (e.target.closest && e.target.closest(".tile-body")) return;
        openPopup(
          iconEl  ? iconEl.innerHTML  : "",
          titleEl ? titleEl.innerHTML : "",
          body.innerHTML
        );
      }

      hdr.addEventListener("click", open);
      hdr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); }
      });
    });
  }

  /* ── Main render ──
     CDS now returns ONE row with sales/purchase pre-split into
     ason / tillyest / today. No more A/B/C row merging in the UI. */
  function renderDashboard(r) {
    var el = document.getElementById("grid-A");
    if (!el) return;

    var rA = r || {};

    var salePrev  = fmtSale(rA.total_sales_tillyest),  purchPrev  = fmtPurch(rA.total_purchase_tillyest);
    var saleToday = fmtSale(rA.total_sales_today),     purchToday = fmtPurch(rA.total_purchase_today);
    var saleAson  = fmtSale(rA.total_sales_ason),      purchAson  = fmtPurch(rA.total_purchase_ason);

    var stkFG = fmtAmt(rA.stock_value_FG);
    var stkRM = fmtAmt(rA.stock_value_RM);
    var rejS = fmtAmt(rA.Rejection_value);

    /* Creditors = vendor ageing, Debtors = customer ageing (swap fixed in the CDS) */
    var credT   = fmtAmt(rA.SUNDRY_CRED_TOT);
    var cred120 = fmtAmt(rA.SUNDRY_CRED_120);
    var cred60  = fmtAmt(rA.SUNDRY_CRED_60);

    var debtT   = fmtAmt(rA.SUNDRY_DEBT_TOT);
    var debt120 = fmtAmt(rA.SUNDRY_DEBT_120);
    var debt60  = fmtAmt(rA.SUNDRY_DEBT_60);

    /* Production orders: FG only (mtart 50-59).
       Current month: open qty, open value, orders > 7 days. Till previous month: open + WIP (qty / value). */
    var openC  = fmtNum(rA.open_curr_qty),  openCV = fmtRs(fmtAmt(rA.open_curr_value));
    var wipC   = fmtNum(rA.wip_curr_qty),   wipCV  = fmtRs(fmtAmt(rA.wip_curr_value));
    var gt7C   = fmtNum(rA.open_curr_gt7_qty), gt7CV = fmtRs(fmtAmt(rA.open_curr_gt7_value));
    var openP  = fmtNum(rA.open_prev_qty),  openPV = fmtRs(fmtAmt(rA.open_prev_value));
    var wipP   = fmtNum(rA.wip_prev_qty),   wipPV  = fmtRs(fmtAmt(rA.wip_prev_value));
    var curMonth  = monthLabel(D, 0);
    var prevMonth = monthLabel(D, -1);

    var pPrev  = fmtRsVal(rA.production_prev),  pToday  = fmtRsVal(rA.production_today), pAson  = fmtRsVal(rA.production_total);
    var sPrev  = fmtRsVal(rA.sales_prev),       sToday  = fmtRsVal(rA.sales_today),      sAson  = fmtRsVal(rA.sales_total);
    var skPrev = fmtRsVal(rA.Stock_prev),       skToday = fmtRsVal(rA.Stock_today),      skAson = fmtRsVal(rA.Stock_total);

    /* Selected date shown next to every "For Date" label */
    var forDateLabel = "For Date (" + isoToDisplay(D) + ")";
    var prevLabel = "Upto Prev. Date (" + isoToDisplay(prevDayISO(D)) + ")";
    var asonLabel = "As on Date (" + isoToDisplay(D) + ")";
    var left = "";

    left += outerTile(IC.chart, "Revenue &amp; Purchase",
      '<div class="sub-row cols-3">'
      + periodCard(prevLabel,    saleBlock(salePrev, purchPrev))
      + periodCard(forDateLabel, saleBlock(saleToday, purchToday))
      + periodCard(asonLabel,    saleBlock(saleAson, purchAson))
      + '</div>'
    );

    left += outerTile(IC.factory, "Production vs Revenue",
      '<div class="sub-row cols-3">'
      + periodCard(prevLabel,    pvsBlock(pPrev, sPrev, skPrev))
      + periodCard(forDateLabel, pvsBlock(pToday, sToday, skToday))
      + periodCard(asonLabel,    pvsBlock(pAson, sAson, skAson))
      + '</div>'
    );

    left += outerTile(IC.factory, "Production Order",
      poSubHdr("Current Month - " + curMonth, true)
      + '<div class="prod-order-row">'
      + poCard("Open Orders Qty / Value", openC, openCV)
      + poCard("WIP Orders Qty / Value", wipC, wipCV)
      + poCard("Orders &gt; 7 Days Qty / Value", gt7C, gt7CV)
      + '</div>'
      + poSubHdr("Till Previous Month - " + prevMonth, false)
      + '<div class="prod-order-row">'
      + poCard("Open Orders Qty / Value", openP, openPV)
      + poCard("WIP Orders Qty / Value", wipP, wipPV)
      + '</div>'
    );

    var right = "";

    right += outerTile(IC.box, "Stock &amp; Rejection &amp; Cost",
      '<div class="sub-row cols-2">'
      + '<div class="sub-card" role="button" tabindex="0">'
      + '<div class="sub-card-hdr"><span class="sub-card-hdr-icon">' + IC.box + '</span>'
      + '<span class="sub-card-hdr-title">Stock Value</span></div>'
      + '<div class="sub-val-block" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">'
      + '<div class="sub-val-label">FG</div>'
      + '<div class="sub-val-amount ' + stkFG.cls + '">' + fmtRs(stkFG) + '</div>'
      + '</div>'
      + '<div class="sub-val-block" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">'
      + '<div class="sub-val-label">RM</div>'
      + '<div class="sub-val-amount ' + stkRM.cls + '">' + fmtRs(stkRM) + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="sub-card" role="button" tabindex="0">'
      + '<div class="sub-card-hdr"><span class="sub-card-hdr-icon">' + IC.block + '</span>'
      + '<span class="sub-card-hdr-title">Rejection Store Value</span></div>'
      + '<div class="sub-val-amount ' + rejS.cls + '" style="font-size:18px;margin-top:6px">' + fmtRs(rejS) + '</div>'
      + '</div>'
      + '<div class="cost-line">'
      + '<span class="cost-line-lbl">' + IC.coin + 'COGM %</span>'
      + '<span class="cost-line-val">' + fmtPct(rA.cogm_pct) + '</span>'
      + '</div>'
      + '</div>'
    );

    right += outerTile(IC.people, "Sundry Creditors",
      '<div class="sub-row cols-3">'
      + periodCard("Total",
          '<div class="sub-val-label">Creditors</div>'
          + '<div class="sub-val-amount ' + credT.cls + '">' + fmtRs(credT) + '</div>')
      + periodCard("&gt; 60 to &lt; 120 Days",
          '<div class="sub-val-label">Creditors</div>'
          + '<div class="sub-val-amount ' + cred60.cls + '">' + fmtRs(cred60) + '</div>')
      + periodCard("&gt; 120 Days",
          '<div class="sub-val-label">Creditors</div>'
          + '<div class="sub-val-amount ' + cred120.cls + '">' + fmtRs(cred120) + '</div>')
      + '</div>'
    );

    right += outerTile(IC.people, "Sundry Debtors",
      '<div class="sub-row cols-3">'
      + periodCard("Total",
          '<div class="sub-val-label">Debtors</div>'
          + '<div class="sub-val-amount ' + debtT.cls + '">' + fmtRs(debtT) + '</div>')
      + periodCard("&gt; 60 to &lt; 120 Days",
          '<div class="sub-val-label">Debtors</div>'
          + '<div class="sub-val-amount ' + debt60.cls + '">' + fmtRs(debt60) + '</div>')
      + periodCard("&gt; 120 Days",
          '<div class="sub-val-label">Debtors</div>'
          + '<div class="sub-val-amount ' + debt120.cls + '">' + fmtRs(debt120) + '</div>')
      + '</div>'
    );

    /* Ageing mix chart: fills the space under the right column (tile--grow stretches it
       to the height of the left column). Shared scale so debtors vs creditors size compares. */
    var agD = ageParts(rA.SUNDRY_DEBT_TOT, rA.SUNDRY_DEBT_60, rA.SUNDRY_DEBT_120);
    var agC = ageParts(rA.SUNDRY_CRED_TOT, rA.SUNDRY_CRED_60, rA.SUNDRY_CRED_120);
    var agMax = Math.max(agD.sum, agC.sum);
    right += outerTile(IC.chart, "Ageing Mix",
      '<div class="ag-legend">'
      + '<span><i class="ag-dot ag-a"></i>Up to 60 days</span>'
      + '<span><i class="ag-dot ag-b"></i>60 - 120 days</span>'
      + '<span><i class="ag-dot ag-c"></i>&gt; 120 days</span>'
      + '</div>'
      + '<div class="ag-chart">'
      + ageingRow("Debtors", agD, agMax)
      + ageingRow("Creditors", agC, agMax)
      + '</div>',
      "tile--grow"
    );

    el.innerHTML =
      '<div class="dash-two-col">'
      + '<div class="dash-col">' + left  + '</div>'
      + '<div class="dash-col">' + right + '</div>'
      + '</div>';

    /* attachSubCardToggle removed — hover handled by CSS :hover rules in dashboard.css */
    attachTilePopup(el);
  }

  /* ── Hide grid-B and grid-C — UNCHANGED ── */
  function hideSections() {
    ["grid-B", "grid-C"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = "";
      var wrap = el.closest ? el.closest(".tile-grid") : el.parentElement;
      if (wrap) wrap.style.display = "none";
      var hdr = wrap && wrap.previousElementSibling;
      if (hdr && hdr.classList && hdr.classList.contains("section-hdr")) {
        hdr.style.display = "none";
      }
    });
  }

  /* ── Login — UNCHANGED ── */
  function doLogin() {
    var bukrs = document.getElementById("inp-bukrs").value.trim().toUpperCase();
    var year  = document.getElementById("inp-year").value.trim();
    var versn = document.getElementById("inp-versn").value.trim().toUpperCase();
    var date  = document.getElementById("inp-date").value.trim();
    var errEl = document.getElementById("login-err");
    errEl.style.display = "none";

    if (!bukrs) { errEl.textContent = "Please enter a company code."; errEl.style.display = "block"; return; }
    if (!year || !/^\d{4}$/.test(year)) { errEl.textContent = "Enter a valid 4-digit fiscal year."; errEl.style.display = "block"; return; }
    if (!versn) { errEl.textContent = "Please enter the FS version (e.g. PEPL)."; errEl.style.display = "block"; return; }

    B = bukrs; Y = year; V = versn; D = date || todayISO();
    saveSel();

    document.getElementById("hdr-bukrs").textContent = "Co: "  + B;
    document.getElementById("hdr-year").textContent  = "FY: "  + Y;
    document.getElementById("hdr-versn").textContent = "Ver: " + V;
    document.getElementById("hdr-date").textContent  = isoToDisplay(D);
    document.getElementById("login-screen").style.display = "none";
    hideSections();
    loadPL();
  }

  function changeParams() {
    document.getElementById("inp-bukrs").value = B;
    document.getElementById("inp-year").value  = Y;
    document.getElementById("inp-versn").value = V;
    document.getElementById("inp-date").value  = D;
    document.getElementById("login-err").style.display = "none";
    document.getElementById("login-screen").style.display = "flex";
  }

  /* ── Fetch ──
     CDS returns a single row, pass rows[0]. Company name (company_name) goes to the header. */
  async function loadPL() {
    var errEl = document.getElementById("err-bar");
    errEl.style.display = "none";

    var el = document.getElementById("grid-A");
    if (el) el.innerHTML = LOADING_HTML;

    var url = "/sap/opu/odata/sap/ZMM_CDS_PL_SUMMARY_CDS/zmm_cds_pl_summary"
      + "(p_bukrs='" + B + "',p_year='" + Y + "',p_versn='" + V + "',p_date=" + isoToOdata(D) + ")"
      + "/Set?$format=json";

    var maxRetries = 5;
    var retryDelay = 10000;

    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          if (el) el.innerHTML = '<div class="loading-wrap">'
            + '<div class="loading-spinner"></div>'
            + '<div class="loading-text">Retrying\u2026 attempt ' + attempt + ' of ' + maxRetries + '</div>'
            + '</div>';
          await new Promise(function(resolve) { setTimeout(resolve, retryDelay); });
        }

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 180000);
        var res = await fetch(url, { credentials: "omit", headers: { Accept: "application/json" }, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var j    = await res.json();
        var rows = j.d && j.d.results ? j.d.results : [];

        renderDashboard(rows[0]);
        if (rows[0] && rows[0].company_name) {
          document.getElementById("hdr-bukrs").textContent = B + " - " + rows[0].company_name;
        }
        return;

      } catch (e) {
        if (attempt === maxRetries) {
          if (el) el.innerHTML = "";
          errEl.textContent = "Could not load P&L data: " + e.message;
          errEl.style.display = "block";
        }
      }
    }
  }

  /* ── Events — UNCHANGED ── */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && document.getElementById("login-screen").style.display !== "none") doLogin();
  });

  /* Selection screen: pre-fill the date field with today instead of dd-mm-yyyy */
  function prefillDate() {
    var inp = document.getElementById("inp-date");
    if (inp && !inp.value) inp.value = todayISO();
  }
  /* Restore last used selection first (then auto login), else just prefill today's date */
  function initScreen() {
    var restored = restoreSel();
    prefillDate();
    if (restored) doLogin();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScreen);
  } else {
    initScreen();
  }

  setInterval(function () { if (B && Y && V) loadPL(); }, 300000);

  window.doLogin      = doLogin;
  window.changeParams = changeParams;
  window.loadPL       = loadPL;
})();
//# sourceMappingURL=dashboard.js.map