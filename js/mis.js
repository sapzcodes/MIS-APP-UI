/* Monthly Report - live data from OData V4 service ZSRVB_MIS_REPORT (no mock data).
   Login: none here. The Android shell adds the SAP login and sap-client to every /sap/* call.
   Mounted by controller/App.controller.js into <div id="misRoot">.

   CHANGE LOG (16 Nov 2026, later):
   1. Sales are now NET of sales returns everywhere on the main screen (Sales Value, Sales Qty and YTD tiles, the
      monthly chart, the Brand-wise tile), so they tie to the P&L (zmm_cds_pl_summary total_sales_*).
      Reason: the CDS views ZI_MIS_SalesMonth / ZI_MIS_BrandSales now return Qty / Value = sales minus returns
      (company 1000, FY 2026-27 till 16.11.2026: net 2,05,78,41,613 = P&L; gross was 5,91,758 higher).
   2. Sales returns are shown separately ONLY in the popups, from the new fields ReturnQty / ReturnValue:
      - Month-wise Sales . FY Comparison (ytdModal): extra "Sales return" blocks for qty and value (both FYs).
      - Brand-wise Sales popup (brandMatrix): rows Gross Sales, Less: Sales Return, Net Sales (Grand Total).
        The brand rows themselves are net of returns, so they add up to Net Sales.
   3. ZC_MIS_SalesReturn is no longer read (the returns come with the sales rows), so the separate fetch, the
      "returns" entity / field config and the old "Sales Return (memo, not deducted)" row are removed.
   Sales Value = P&L revenue is now DONE (FS version PEPL is hard-coded in the CDS ZI_MIS_SalesGL).

   CHANGE LOG (16 Nov 2026):
   1. Payables, Advance (creditors) and Receivables are now ONE tile "Payables & Receivables" (same layout as the
      P&L dashboard tile: rows Payable / Advance / Receivable, columns Total, 0 to 60 days, >60 to <120, >120).
      Only the Receivable row is clickable (popup). Advance data comes from ZI_MIS_VendAgeBase (where-filter removed).
      0 to 60 = Total minus (>60 to <120) minus (>120), so receivables advance/PDC (bucket B6) lands in "0 to 60",
      exactly like the P&L dashboard.
   2. Receivables popup now lists one line per CUSTOMER GROUP (ZI_MIS_DebtorsAgeing sums per group; the OData field is
      still called Party). Rows sorted by total, largest first.
   3. Sales Value, Sales Qty and YTD Sales Value tiles all open "Month-wise Sales . FY Comparison" (ytdModal).
      The old brand-split popup (brandMonth) was removed.
   4. Brand-wise Sales tile on the main screen shows only the brands flagged MainBrand (= listed in ZMIS_BRAND_CFG),
      all other brands grouped as "Others". The popup (brandMatrix) still lists every brand.
      If no brand is flagged (table empty) the tile falls back to listing all brands.
   5. Ageing bucket headings corrected to what the table function really produces:
      B1 0-30 (incl. not due), B2 31-60, B3 61-90, B4 91-120, B5 above 120, B6 Adv / PDC.

   CHANGE LOG (4 Nov 2026, later):
   1. Header: the "Monthly Report" label is now "MIS Report", no company code anywhere in the header.
      The two header texts swap style and position: the company name now sits in the big heading (#title),
      "MIS Report · <Month Year>" in the small sub label (#crumb). Done by swapping the content only, so no CSS change.
   2. Brand-wise Sales tile on the main screen: .vscroll removed (no scrolling), shows max 10 brands, sorted by
      YTD value (largest first). Grand Total still covers ALL brands. The popup (brandMatrix) still lists every brand.
   3. Payables ageing tile: Advances row removed (the Payables row alone stays).

   CHANGE LOG (4 Nov 2026):
   1. Receivables total did not tie with the P&L dashboard (zfi_dash). Reason: the CDS
      ZI_MIS_DebtorsAgeing now returns bucket B6 (advance + PDC, umskz A / Y, 03.11.2026), but this file
      only handled B1..B5, so B6 was dropped from the Total row (col() summed 5 indexes only).
      Fix: bucketed() takes a bucket count (debtors = 6, creditors stay 5), col() sums 6 indexes,
      and the ageing tables show a 6th column "Adv / PDC" when the data has 6 buckets (ageHead()).
      Receivables total now = SUM(wrbtr_d) = dashboard SUNDRY_DEBT_TOT.
   2. Known remaining difference: MIS ageing is as on today (TF gets $session.system_date), the dashboard
      uses its selected date. Set the dashboard date to today for an exact tie.

   CHANGE LOG (2 Nov 2026):
   1. Company codes are no longer hardcoded (COMPANIES / DEFAULT_COMPANY removed).
      They are read at mount time from the CDS root ZC_MIS_Dashboard (CompanyCode, CompanyName)
      via loadCompanies() / initCompanies(). Reason: the CDS is the single source of truth, so a
      new company needs no UI change. The first returned company is selected by default.
   2. Header restyled to match the P&L dashboard (black bar, red title, light-on-dark controls).
      The unit dropdown became a segmented control (#unitSeg) that drives the hidden #unit select,
      so unitInfo() and the Excel export are unchanged. Styling is in the header block of the CSS.
      
         CHANGE LOG (18 Nov 2026):
   1. Month and year now always default to the CURRENT month (and current FY), not the last completed month.
      Reason: the report is used during the month, so it should open on the running month.
      Done in fillPeriods(): default index = (month + 9) % 12. FY already defaulted to FY_LIST[0] = current FY.
      Switching the FY dropdown still keeps the selected month (keepIdx), unchanged.
      
         CHANGE LOG (23 Nov 2026):
   1. Brand-wise tile and Brand-wise popup are now sorted by SortOrder (from ZMIS_BRAND_CFG-SORT_ORDER via
      ZC_MIS_BrandSales), not by value. Reason: the customer's PDF has a fixed brand sequence
      (Crompton, Dharani, Grundfos, Paranaa, Kirloskar, SFL, then Spares/Services).
      Spares/Services = 9000, unlisted brands = 9999 (set in ZI_MIS_SalesBase). Tie-break: value on the tile, name in the popup.
      
       CHANGE LOG (24 Nov 2026):
   1. Month-wise Sales . FY Comparison popup (ytdModal) re-laid out like the customer's sheet: one block per fiscal year,
      CURRENT FY ON TOP, previous FY below. Each block = month headings (Apr-26 ... Mar-27) + Total, then the rows
      "Sales - Qty" and "Sales - Value (<unit>)" one below the other. Total = Apr to the selected month for the current FY,
      full year for the previous FY. Months after the selected month stay blank in the current FY.
      The sales return rows (already deducted above) stay as grey memo rows under each block.
      Reason: the customer's sheet shows qty and value together per year, newest year first, so it can be compared line by line.
      The old "Change %" rows and the YTD / Full year columns are gone with this layout.
   2. Brand-wise tile: nothing changed. Brands that are not listed in ZMIS_BRAND_CFG were already grouped as "Others".

   ------------------------------------------------------------------------------------------------- */

sap.ui.define([], function () {
  "use strict";

  /* =====================================================================
   1. CONFIG
   ===================================================================== */
  const CONFIG = {
    ODATA_VERSION: "v4", // 'v2' -> d.results | 'v4' -> value
    BASE_URL:
      "/sap/opu/odata4/sap/zsrvb_mis_report/srvd/sap/zsd_mis_report/0001", // overwritten from manifest dataSource "mainService"
    ENTITIES: {
      companies: "ZC_MIS_Dashboard", // root entity: CompanyCode, CompanyName (check $metadata if a call returns 404)
      sales: "ZC_MIS_SalesMonth", // V4 entity set = exposed CDS view name
      brands: "ZC_MIS_BrandSales",
      expenses: "ZC_MIS_PurchaseExpense",
      debtors: "ZC_MIS_DebtorsAgeing",
      creditors: "ZC_MIS_CreditorsAgeing",
    },
    // period = fiscal period number (1 = Apr ... 12 = Mar); bucket = B1...B5 (0-30 ... Above 120), debtors also B6 (advance + PDC)
    FIELDS: {
      companies: { code: "CompanyCode", name: "CompanyName" },
      // Qty / Value are NET of sales returns; retQty / retValue are the returns on their own (popups only)
      sales: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        qty: "Qty",
        value: "Value",
        retQty: "ReturnQty",
        retValue: "ReturnValue",
      },
      brands: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        brand: "Brand",
        main: "MainBrand", // 'X' = brand is listed in ZMIS_BRAND_CFG
        qty: "Qty",
        value: "Value",
        sort: "SortOrder",
      },
      expenses: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        label: "Category",
        value: "Amount",
      },
      // Party now carries the CUSTOMER GROUP text (ZI_MIS_DebtorsAgeing sums per customer group)
      debtors: {
        co: "CompanyCode",
        fy: "FiscalYear",
        party: "Party",
        bucket: "Bucket",
        value: "Amount",
      },
      creditors: {
        co: "CompanyCode",
        fy: "FiscalYear",
        type: "Type",
        bucket: "Bucket",
        value: "Amount",
      }, // Type: 'CR' | 'ADV'
    },
    VALUE_DIVISOR: 100000, // OData sends rupees; 1 Lac = 100000
  };

  let COMPANIES = []; // filled at runtime from ZC_MIS_Dashboard: [{ code, name }]
  const _now = new Date(),
    _sy = _now.getMonth() >= 3 ? _now.getFullYear() : _now.getFullYear() - 1;
  const FY_LIST = [0, 1].map((k) => `${_sy - k}-${_sy - k + 1}`); // current FY, previous FY
  const MONTHS = [
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
  ]; // fiscal order
  const FULL = [
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
    "March",
  ];
  const BUCKETS = ["0–30", "31–60", "61–90", "91–120", "Above 120"]; // B1 incl. not due
  const ADV = "Adv / PDC"; // 6th debtors bucket (B6): advances + post-dated cheques, shown as credit (negative)

  /* Heading list for an ageing table: 6th column only when the data has 6 buckets */
  const ageHead = (n) => (n > BUCKETS.length ? [...BUCKETS, ADV] : BUCKETS);

  const sumArr = (a, from = 0, to = a.length - 1) => {
    let s = 0,
      any = false;
    for (let i = from; i <= to; i++)
      if (a[i] != null) {
        s += a[i];
        any = true;
      }
    return any ? s : null;
  };

  /* a + b, null only when both are null (gross = net + returns) */
  const addN = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0));

  /* Fills derived totals */
  function finish(d, name) {
    const sb = (b) => b.reduce((s, x) => s + (x || 0), 0);
    const col = (rows) =>
      [0, 1, 2, 3, 4, 5].map((i) =>
        rows.reduce((s, r) => s + (r.b[i] || 0), 0),
      ); // 6 indexes: B6 (advance + PDC) must be in the total
    const fix = (t) => {
      if (!t) return;
      t.rows.forEach((r) => {
        if (r.t == null) r.t = sb(r.b);
      });
      if (!t.total) t.total = { b: col(t.rows) };
      if (t.total.t == null) t.total.t = sb(t.total.b);
    };
    fix(d.debtors);
    ["cr", "adv"].forEach((k) => {
      const c = d.creditors[k];
      if (c.t == null) c.t = sb(c.b);
    });
    if (!d.purchase.total) d.purchase.total = {};
    if (!d.purchase.total.v)
      d.purchase.total.v = MONTHS.map((_, i) =>
        sumArr(
          d.purchase.rows.map((r) => r.v[i]),
          0,
          0,
        ),
      );
    d.name = name;
    d.lastIdx = d.sales.cv.reduce((l, v, i) => (v != null ? i : l), -1);
    return d;
  }

  /* =====================================================================
   3. ODATA ADAPTER
   ===================================================================== */
  class AuthError extends Error {}

  async function odataGet(entity, filter, order) {
    const parts = ["$format=json"];
    if (filter) parts.push("$filter=" + encodeURIComponent(filter));
    if (order) parts.push("$orderby=" + encodeURIComponent(order));
    let url = `${CONFIG.BASE_URL}/${CONFIG.ENTITIES[entity]}?${parts.join("&")}`;
    const out = [];
    for (let page = 0; url && page < 50; page++) {
      // V4 may split big results into pages (@odata.nextLink)
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "omit",
      });
      if (res.status === 401 || res.status === 403)
        throw new AuthError(
          `${entity}: not allowed (HTTP ${res.status}) - check the SAP user's authorisation`,
        );
      if (!res.ok) throw new Error(`${entity}: HTTP ${res.status}`);
      const j = await res.json();
      out.push(
        ...(CONFIG.ODATA_VERSION === "v2"
          ? (j.d?.results ?? [])
          : (j.value ?? [])),
      );
      const next = j["@odata.nextLink"];
      url = next
        ? new URL(next, location.origin + CONFIG.BASE_URL + "/").pathname +
          new URL(next, location.origin + CONFIG.BASE_URL + "/").search
        : null;
    }
    return out;
  }

  /* Company list comes from the CDS root (no hardcoded company codes) */
  async function loadCompanies() {
    const F = CONFIG.FIELDS.companies;
    const rows = await odataGet("companies");
    COMPANIES = rows
      .map((r) => ({ code: r[F.code], name: r[F.name] || "" }))
      .filter((c) => c.code)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return COMPANIES;
  }

  async function odataData(co, fy) {
    const F = CONFIG.FIELDS,
      D = CONFIG.VALUE_DIVISOR;
    const prevFy = `${+fy.slice(0, 4) - 1}-${+fy.slice(5) - 1}`;
    const one = (f) => `${f.co} eq '${co}' and ${f.fy} eq '${fy}'`;
    const coOnly = (f) => `${f.co} eq '${co}'`; // ageing = open items as on today, no fiscal year
    const two = (f) =>
      `${f.co} eq '${co}' and (${f.fy} eq '${fy}' or ${f.fy} eq '${prevFy}')`;

    const [sR, bR, eR, dR, cR] = await Promise.all([
      odataGet("sales", two(F.sales)),
      odataGet("brands", one(F.brands)),
      odataGet("expenses", one(F.expenses), "SortOrder"),
      odataGet("debtors", coOnly(F.debtors)),
      odataGet("creditors", coOnly(F.creditors)),
    ]);

    const nulls = (n) => Array(n).fill(null);
    // q / v = net of returns, rq / rv = the returns alone (shown in popups only)
    const salesArr = (fyv) => {
      const q = nulls(12),
        v = nulls(12),
        rq = nulls(12),
        rv = nulls(12);
      sR.filter((r) => r[F.sales.fy] === fyv).forEach((r) => {
        const i = +r[F.sales.period] - 1;
        q[i] = +r[F.sales.qty];
        v[i] = +r[F.sales.value] / D;
        rq[i] = +r[F.sales.retQty] || 0;
        rv[i] = (+r[F.sales.retValue] || 0) / D;
      });
      return [q, v, rq, rv];
    };
    const [cq, cv, crq, crv] = salesArr(fy),
      [pq, pv, prq, prv] = salesArr(prevFy);

    const monthly = (rows, f, keyOf, withQty) => {
      // group by key -> 12-month arrays; o.main = true when any row of the key has f.main = 'X'
      const m = new Map();
      rows.forEach((r) => {
        const k = keyOf(r);
        if (!m.has(k))
          m.set(k, {
            n: k,
            q: nulls(12),
            v: nulls(12),
            main: false,
            sort: 9999,
          });
        const o = m.get(k),
          i = +r[f.period] - 1;
        if (f.main && r[f.main] === "X") o.main = true;
        if (f.sort && r[f.sort] != null) o.sort = +r[f.sort];
        if (withQty) o.q[i] = (o.q[i] || 0) + (+r[f.qty] || 0);
        o.v[i] = (o.v[i] || 0) + +r[f.value] / D;
      });
      return [...m.values()];
    };
    const bucketed = (rows, f, keyOf, n = 5) => {
      // group by key -> n bucket values (debtors 6 incl. B6 advance + PDC, creditors 5)
      const m = new Map();
      rows.forEach((r) => {
        const k = keyOf(r);
        if (!m.has(k)) m.set(k, { n: k, b: nulls(n) });
        const i = +String(r[f.bucket]).replace(/\D/g, "") - 1;
        m.get(k).b[i] = (m.get(k).b[i] || 0) + +r[f.value] / D;
      });
      return [...m.values()];
    };

    const brands = monthly(bR, F.brands, (r) => r[F.brands.brand], true).sort(
      (a, b) => a.sort - b.sort || String(a.n).localeCompare(String(b.n)),
    );
    const exp = monthly(eR, F.expenses, (r) => r[F.expenses.label], false).map(
      (x) => ({ n: x.n, v: x.v }),
    );
    const crRows = bucketed(cR, F.creditors, (r) => r[F.creditors.type]);
    const pick = (k) => crRows.find((x) => x.n === k) || { b: nulls(5) };

    return {
      counts: {
        sales: sR.length,
        brands: bR.length,
        expenses: eR.length,
        debtors: dR.length,
        creditors: cR.length,
      },
      sales: { cq, cv, pq, pv, crq, crv, prq, prv },
      brands,
      purchase: { rows: exp },
      expNote: null,
      debtors: {
        rows: bucketed(dR, F.debtors, (r) => r[F.debtors.party], 6),
      },
      creditors: { cr: { b: pick("CR").b }, adv: { b: pick("ADV").b } },
    };
  }

  async function loadData(co, fy) {
    const c = COMPANIES.find((x) => x.code === co);
    return finish(await odataData(co, fy), c ? c.name : co);
  }

  let root = null; // DOM element the report lives in

  /* =====================================================================
   4. HELPERS
   ===================================================================== */
  const $ = (id) => root.querySelector("#" + id);
  const unitInfo = () =>
    ({
      cr: { f: 0.01, label: "Cr", name: "Crores", dp: 2 },
      lacs: { f: 1, label: "Lacs", name: "Lacs", dp: 2 },
      abs: { f: 1e5, label: "", name: "Rupees", dp: 0 },
    })[$("unit").value];
  const nfIN = (n, dp = 2) =>
    n == null
      ? "–"
      : n.toLocaleString("en-IN", {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        });
  const money = (n) =>
    n == null ? "–" : "₹\u00a0" + nfIN(n * unitInfo().f, unitInfo().dp);
  /* liability shown with a leading minus, like the P&L dashboard: "- ₹ 47,68,95,494" */
  const moneyNeg = (n) =>
    n == null
      ? "–"
      : (n > 0 ? "-\u00a0" : "") +
        "₹\u00a0" +
        nfIN(Math.abs(n) * unitInfo().f, unitInfo().dp);
  const calYear = (fy, i) => (i < 9 ? +fy.slice(0, 4) : +fy.slice(5));
  const mLabel = (fy, i) => `${MONTHS[i]}-${String(calYear(fy, i)).slice(2)}`;
  const range = (i) => (i === 0 ? "Apr" : `Apr–${MONTHS[i]}`);
  const preHead = (pi) =>
    pi === 0 ? "–" : pi === 1 ? "Apr" : `Apr–${MONTHS[pi - 1]}`; // "Apr to previous month" heading
  const pct = (c, p) => (c == null || !p ? null : ((c - p) / p) * 100);
  const chg = (c, p) => {
    const x = pct(c, p);
    return x == null
      ? "–"
      : `<span class="${x >= 0 ? "up" : "down"}">${x >= 0 ? "▲" : "▼"} ${Math.abs(x).toFixed(1)}%</span>`;
  };

  function delta(cur, prev, prevLabel, fmt) {
    const p = pct(cur, prev);
    if (p == null) return `<div class="sub neutral">No comparison data</div>`;
    return `<div class="sub ${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1)}% vs ${prevLabel} (${fmt(prev)})</div>`;
  }

  /* aggregated brand totals: PDF totals win when the full available range is selected */
  function brandTot(b, d, pi) {
    const full = pi >= d.lastIdx;
    return {
      q: full && b.tq != null ? b.tq : sumArr(b.q, 0, pi),
      v: full && b.tv != null ? b.tv : sumArr(b.v, 0, pi),
    };
  }
  const rowTot = (r, d, pi) =>
    pi >= d.lastIdx && r.t != null ? r.t : sumArr(r.v, 0, pi);

  /* =====================================================================
   5. MAIN-PAGE RENDERERS
   ===================================================================== */
  let STATE = null;

  /* Ageing table for the receivables popup (customer groups x buckets) */
  function ageTable(rows, total, firstHead) {
    const H = ageHead(total.b.length);
    const cell = (x, i) =>
      `<td class="${i === 4 && x ? "down" : ""}">${x == null ? "–" : money(x)}</td>`;
    return (
      `<tr><th>${firstHead}</th>${H.map((b) => `<th>${b}</th>`).join("")}<th>Total</th></tr>` +
      rows
        .map(
          (r) =>
            `<tr><td>${r.n}</td>${r.b.map(cell).join("")}<td><b>${money(r.t)}</b></td></tr>`,
        )
        .join("") +
      `<tr class="total"><td>Total</td>${total.b.map(cell).join("")}<td>${money(total.t)}</td></tr>`
    );
  }

  /* One tile: Payable / Advance (creditors) / Receivable x Total, 0 to 60, >60 to <120, >120.
     0 to 60 = total - mid - high, so the receivables Adv / PDC bucket (B6) falls into it (same as the P&L dashboard).
     Only the Receivable row is clickable. */
  function parTile(d, u) {
    const split = (b, t) => {
      const a = (i) => b[i] || 0,
        hi = a(4),
        mid = a(2) + a(3);
      return { t, low: t - mid - hi, mid, hi };
    };
    const rows = [
      {
        label: "Payable",
        cls: "up",
        fmt: moneyNeg,
        ...split(d.creditors.cr.b, d.creditors.cr.t),
      },
      {
        label: "Advance",
        cls: "up",
        fmt: money,
        ...split(d.creditors.adv.b, d.creditors.adv.t),
      },
      {
        label: "Receivable",
        cls: "down",
        fmt: money,
        act: "debtors",
        ...split(d.debtors.total.b, d.debtors.total.t),
      },
    ];
    return `<div class="card kpi"><h2>Payables &amp; Receivables</h2>
    <div class="meta">As on today · tap Receivable for customer group breakup</div>
    <div class="scroll"><table class="mini par">
      <tr><th></th><th>Total</th><th>0 to 60 days</th><th>&gt;60 to &lt;120</th><th>&gt;120</th></tr>
      ${rows
        .map(
          (r) =>
            `<tr class="${r.act ? "rowclick" : ""}"${r.act ? ` data-act="${r.act}"` : ""}><td>${r.label}</td>` +
            [r.t, r.low, r.mid, r.hi]
              .map((x) => `<td class="${r.cls}"><b>${r.fmt(x)}</b></td>`)
              .join("") +
            `</tr>`,
        )
        .join("")}
    </table></div></div>`;
  }

  function render(d, co, fy, pi) {
    STATE = { d, co, fy, pi };
    const u = unitInfo(),
      cyr = calYear(fy, pi),
      S = d.sales;
    const cv = S.cv[pi],
      pv = S.pv[pi],
      cq = S.cq[pi],
      pq = S.pq[pi];
    const ytdC = sumArr(S.cv, 0, pi),
      ytdP = sumArr(S.pv, 0, pi);
    const lbl = mLabel(fy, pi),
      lblPrev = `${MONTHS[pi]}-${String(cyr - 1).slice(2)}`;

    /* header texts swapped: company name in the big heading, "MIS Report · Month Year" in the small sub label */
    $("title").textContent = d.name || co;
    $("crumb").textContent = `MIS Report · ${FULL[pi]} ${cyr}`;

    /* all three sales tiles open Month-wise Sales . FY Comparison (ACTIONS maps them to ytdModal).
       Values are net of sales returns (= P&L sales); the returns alone are shown in the popups. */
    $("kpis").innerHTML = `
    <div class="card kpi click" data-act="salesValue"><div class="lbl">Sales Value · ${lbl}</div>
      <div class="val">${money(cv)}<small>${u.label}</small></div>
      ${delta(cv, pv, lblPrev, money)}</div>
    <div class="card kpi click" data-act="salesQty"><div class="lbl">Sales Qty · ${lbl}</div>
      <div class="val">${nfIN(cq, 0)}</div>
      ${delta(cq, pq, lblPrev, (v) => nfIN(v, 0))}</div>
    <div class="card kpi click" data-act="ytd"><div class="lbl">YTD Sales Value · ${range(pi)}</div>
      <div class="val">${money(ytdC)}<small>${u.label}</small></div>
      ${delta(ytdC, ytdP, `${range(pi)} ${String(cyr - 1).slice(2)}`, money)}</div>`;

    $("parTile").innerHTML = parTile(d, u);

    renderChart(fy, pi, d, u);
    renderBrands(d, fy, pi, u);
    renderExpenses(d, fy, pi, u);
  }

  function renderChart(fy, pi, d, u) {
    const rows = MONTHS.slice(0, pi + 1).map((m, i) => ({
      m,
      pv: d.sales.pv[i] || 0,
      cv: d.sales.cv[i] || 0,
    }));
    const py = `${+fy.slice(0, 4) - 1}-${+fy.slice(5) - 1}`;
    $("chartMeta").textContent = `FY ${fy} vs FY ${py}, ${range(pi)}`;
    $("lgPrev").textContent = `FY ${py.slice(2, 4)}-${py.slice(7)}`;
    $("lgCur").textContent = `FY ${fy.slice(2, 4)}-${fy.slice(7)}`;

    const n = rows.length,
      rot = n > 6,
      W = 600,
      H = 300,
      L = 14,
      R = 14,
      T = rot ? 44 : 30,
      B = 34;
    const nice = Math.max(1, ...rows.flatMap((r) => [r.cv, r.pv])) * 1.08;
    const slot = (W - L - R) / n,
      bw = Math.min(rot ? 22 : 30, slot * 0.38);
    const y = (v) => T + (H - T - B) * (1 - v / nice);
    const lab = (v) => nfIN(v * u.f, u.f < 1 ? 1 : 0);
    const tag = (x, v, color) =>
      !v
        ? ""
        : rot
          ? `<text transform="translate(${x},${y(v) - 5}) rotate(-90)" font-size="10" fill="${color}">${lab(v)}</text>`
          : `<text x="${x}" y="${y(v) - 6}" text-anchor="middle" font-size="10.5" fill="${color}">${lab(v)}</text>`;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly sales comparison">`;
    s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#d5dae1"/>`;
    rows.forEach((r, i) => {
      const cx = L + slot * i + slot / 2;
      s += `<rect x="${cx - bw - 1}" y="${y(r.pv)}" width="${bw}" height="${H - B - y(r.pv)}" rx="2" fill="var(--prevbar)"><title>${r.m} prev: ${money(r.pv)} ${u.label}</title></rect>`;
      s += `<rect x="${cx + 1}" y="${y(r.cv)}" width="${bw}" height="${H - B - y(r.cv)}" rx="2" fill="var(--curbar)"><title>${r.m} cur: ${money(r.cv)} ${u.label}</title></rect>`;
      s +=
        tag(cx - 1 - bw / 2, r.pv, "#5f6b7a") +
        tag(cx + 1 + bw / 2, r.cv, "#2b3440");
      s += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#5f6b7a">${r.m}</text>`;
    });
    $("chart").innerHTML = s + "</svg>";
  }

  /* Brand-wise card: only brands listed in ZMIS_BRAND_CFG (MainBrand = 'X') are shown, largest YTD value first;
     every other brand is grouped as "Others". The popup (brandMatrix) lists all brands.
     Fallback: if no brand is flagged at all (config table empty) every brand is listed.
     Brand values and Grand Total are all net of sales returns, so the rows add up to the Grand Total. */
  function renderBrands(d, fy, pi, u) {
    $("brandMeta").textContent =
      `${range(pi)} ${calYear(fy, pi)} · Qty in numbers · Value in ${u.name}`;
    const S = d.sales,
      pre = pi > 0;
    const all = d.brands
      .map((b) => {
        const t = brandTot(b, d, pi);
        return {
          n: b.n,
          main: b.main,
          sort: b.sort,
          pq: pre ? sumArr(b.q, 0, pi - 1) : null,
          pv: pre ? sumArr(b.v, 0, pi - 1) : null,
          cq: b.q[pi],
          cv: b.v[pi],
          tq: t.q,
          tv: t.v,
        };
      })
      .filter((r) => r.tv != null)
      .sort((a, b) => a.sort - b.sort || b.tv - a.tv);
    const anyMain = all.some((r) => r.main);
    const rows = anyMain ? all.filter((r) => r.main) : all.slice(),
      rest = anyMain ? all.filter((r) => !r.main) : [];
    if (rest.length) {
      const add = (k) => rest.reduce((s, r) => s + (r[k] || 0), 0);
      rows.push({
        n: "Others",
        pq: pre ? add("pq") : null,
        pv: pre ? add("pv") : null,
        cq: add("cq"),
        cv: add("cv"),
        tq: add("tq"),
        tv: add("tv"),
      });
    }
    const grand = {
      n: "Grand Total",
      pq: pre ? sumArr(S.cq, 0, pi - 1) : null,
      pv: pre ? sumArr(S.cv, 0, pi - 1) : null,
      cq: S.cq[pi],
      cv: S.cv[pi],
      tq: sumArr(S.cq, 0, pi),
      tv: sumArr(S.cv, 0, pi),
    };
    const cells = (r) =>
      `<td class="pre">${nfIN(r.pq, 0)}</td><td class="pre">${money(r.pv)}</td><td>${nfIN(r.cq, 0)}</td><td>${money(r.cv)}</td><td>${nfIN(r.tq, 0)}</td><td>${money(r.tv)}</td>`;
    $("brandTbl").innerHTML =
      `<thead><tr><th rowspan="2" class="fc">Brand</th><th colspan="2" class="grp pre">${preHead(pi)}</th><th colspan="2" class="grp">${MONTHS[pi]}</th><th colspan="2" class="grp">Total</th></tr>` +
      `<tr><th class="grp pre">Qty</th><th class="pre">Value</th>${'<th class="grp">Qty</th><th>Value</th>'.repeat(2)}</tr></thead>` +
      `<tbody>${rows.map((r) => `<tr><td>${r.n}</td>${cells(r)}</tr>`).join("")}</tbody>` +
      `<tfoot><tr class="total"><td>${grand.n}</td>${cells(grand)}</tr></tfoot>`;
  }

  /* Purchase & Expenses card: Apr→previous month | current month | YTD total */
  function renderExpenses(d, fy, pi, u) {
    $("expMeta").textContent = `${range(pi)} ${calYear(fy, pi)}`;
    const pt = d.purchase.total,
      pre = pi > 0;
    const preOf = (r) => (pre ? sumArr(r.v, 0, pi - 1) : null);
    const line = (n, r, cls) =>
      `<tr${cls ? ` class="${cls}"` : ""}><td>${n}</td><td>${money(preOf(r))}</td><td>${money(r.v[pi])}</td><td>${money(rowTot(r, d, pi))}</td></tr>`;
    $("expTbl").innerHTML =
      `<tr><th>Particulars</th><th>${preHead(pi)}</th><th>${MONTHS[pi]}</th><th>Total</th></tr>` +
      d.purchase.rows.map((r) => line(r.n, r)).join("") +
      line("Total", { v: pt.v, t: pt.t }, "total");
  }

  /* =====================================================================
   6. BREAKUP MODALS
   ===================================================================== */
  function openModal(title, sub, html) {
    $("mTitle").textContent = title;
    $("mSub").textContent = sub;
    $("mBody").innerHTML = html;
    $("modal").classList.add("open");
  }
  function closeModal() {
    $("modal").classList.remove("open");
  }

  /* Sales Value, Sales Qty and YTD tiles -> Month-wise Sales · FY Comparison (months are the column headings).
     The qty / value blocks are net of returns (same as the tiles); the returns are listed separately below each block. */
  function ytdModal() {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      S = d.sales;
    const py = `${+fy.slice(0, 4) - 1}-${+fy.slice(5) - 1}`;
    const num = (x) => (x == null ? "" : nfIN(x, 0));
    const val = (x) => (x == null ? "" : nfIN(x * u.f, u.dp));

    /* last = last month index that is shown and totalled (selected month for the current FY, 11 for the previous FY).
       cmp (current FY block only) = previous FY qty / value arrays, used for the Change % rows. */
    const block = (f, q, v, rq, rv, last, cmp) => {
      const idx = MONTHS.map((_, i) => i);
      const row = (label, a, fmt, memo) =>
        `<tr${memo ? ' class="memo"' : ""}><td>${label}</td>` +
        idx.map((i) => `<td>${fmt(i <= last ? a[i] : null)}</td>`).join("") +
        `<td class="ytdc">${fmt(sumArr(a, 0, last))}</td></tr>`;
      /* Change % vs same month of the previous FY; Total = Apr to selected month in both years */
      const chgRow = (label, cur, prev) =>
        `<tr><td>${label}</td>` +
        idx
          .map((i) => `<td>${i <= last ? chg(cur[i], prev[i]) : ""}</td>`)
          .join("") +
        `<td class="ytdc">${chg(sumArr(cur, 0, last), sumArr(prev, 0, last))}</td></tr>`;
      return (
        `<table class="dense"><tr><th>FY ${f}</th>${idx.map((i) => `<th>${mLabel(f, i)}</th>`).join("")}<th class="ytdc">Total</th></tr>` +
        row("Sales - Qty", q, num) +
        row(`Sales - Value (${u.name})`, v, val) +
        (cmp ? chgRow("Change % - Qty", q, cmp.q) : "") +
        (cmp ? chgRow("Change % - Value", v, cmp.v) : "") +
        row("Sales return - Qty (already deducted)", rq, num, true) +
        row("Sales return - Value (already deducted)", rv, val, true) +
        "</table>"
      );
    };

    const h =
      block(fy, S.cq, S.cv, S.crq, S.crv, pi, { q: S.pq, v: S.pv }) +
      `<div style="height:16px"></div>` +
      block(py, S.pq, S.pv, S.prq, S.prv, 11);
    openModal(
      "Month-wise Sales · FY Comparison",
      `Qty in numbers · Value in ${u.name} · net of sales returns, returns listed separately · current year on top`,
      h,
    );
  }

  /* Brand-wise card -> month matrix with Qty + Value per month (ALL brands).
     Brand rows are net of returns; below them: Gross Sales, Less: Sales Return, Net Sales (= Grand Total on the tile). */
  function brandMatrix() {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      S = d.sales,
      idx = MONTHS.slice(0, pi + 1).map((_, i) => i);
    const pair = (q, v, bold) =>
      `<td>${q == null ? "" : nfIN(q, 0)}</td><td>${v == null ? "" : money(v)}</td>`;
    const tot = (a) => sumArr(a, 0, pi);
    let h = `<table class="dense"><thead><tr><th rowspan="2">Brand</th>${idx.map((i) => `<th colspan="2" class="grp">${mLabel(fy, i)}</th>`).join("")}<th colspan="2" class="grp">Total</th></tr>
    <tr>${[...idx, "T"].map(() => '<th class="grp">Qty</th><th>Value</th>').join("")}</tr></thead><tbody>`;
    d.brands.forEach((b) => {
      const t = brandTot(b, d, pi);
      if (t.v == null) return;
      h += `<tr><td>${b.n}</td>${idx.map((i) => pair(b.q[i], b.v[i])).join("")}${pair(t.q, t.v)}</tr>`;
    });
    h += `<tr class="memo"><td>Gross Sales</td>${idx.map((i) => pair(addN(S.cq[i], S.crq[i]), addN(S.cv[i], S.crv[i]))).join("")}${pair(addN(tot(S.cq), tot(S.crq)), addN(tot(S.cv), tot(S.crv)))}</tr>`;
    h += `<tr class="memo"><td>Less: Sales Return</td>${idx.map((i) => pair(S.crq[i], S.crv[i])).join("")}${pair(tot(S.crq), tot(S.crv))}</tr>`;
    h += `<tr class="total"><td>Net Sales (Grand Total)</td>${idx.map((i) => pair(S.cq[i], S.cv[i])).join("")}${pair(tot(S.cq), tot(S.cv))}</tr>`;
    openModal(
      `Brand-wise Sales`,
      `${range(pi)} · Qty in numbers · Value in ${u.name} · brand rows are net of sales returns`,
      h + "</tbody></table>",
    );
  }

  /* Purchase & Expenses card -> month-wise */
  function expMonthly() {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      idx = MONTHS.slice(0, pi + 1).map((_, i) => i),
      pt = d.purchase.total;
    let h =
      `<table class="dense"><tr><th>Particulars</th>${idx.map((i) => `<th>${mLabel(fy, i)}</th>`).join("")}<th>Total</th></tr>` +
      d.purchase.rows
        .map(
          (r) =>
            `<tr><td>${r.n}</td>${idx.map((i) => `<td>${money(r.v[i])}</td>`).join("")}<td><b>${money(rowTot(r, d, pi))}</b></td></tr>`,
        )
        .join("") +
      `<tr class="total"><td>Total</td>${idx.map((i) => `<td>${money(pt.v[i])}</td>`).join("")}<td>${money(rowTot({ v: pt.v, t: pt.t }, d, pi))}</td></tr></table>`;
    const n = d.expNote;
    if (n && n.idx <= pi) {
      const row = d.purchase.rows.find((r) => r.n === n.row);
      h += `<p class="note">${mLabel(fy, n.idx)} ${n.row} ${money(row.v[n.idx])} includes: ${n.items.map(([k, v]) => `${k} ${money(v)}`).join(" · ")}</p>`;
    }
    openModal("Purchase & Expenses", `${range(pi)}`, h);
  }

  /* Receivable row -> Receivables ageing by CUSTOMER GROUP (one line per group, largest first) */
  function debtorsModal() {
    const { d } = STATE,
      u = unitInfo();
    const rows = [...d.debtors.rows].sort((a, b) => (b.t || 0) - (a.t || 0));
    openModal(
      "Receivables · by Customer Group",
      `Open items as on today`,
      `<table class="dense">${ageTable(rows, d.debtors.total, "Customer Group")}</table>`,
    );
  }

  /* =====================================================================
   6b. EXPORT POPUP TO EXCEL
   Generic: reads whatever tables / notes are currently rendered inside
   #mBody, so any popup you add later (any rows, any columns) exports
   without extra code. Just build it through openModal().
   ===================================================================== */
  /* Display text -> typed Excel cell. Numbers stay numbers (₹, commas, ▲▼ % are stripped). */
  function xlCell(td) {
    const t = td.textContent.replace(/\u00a0/g, " ").trim();
    if (t === "" || t === "–") return "";
    let m;
    if ((m = t.match(/^([▲▼])\s*([\d.,]+)%$/)))
      // change %  (▲ 5.2% / ▼ 3.1%)
      return {
        t: "n",
        v: ((m[1] === "▼" ? -1 : 1) * parseFloat(m[2].replace(/,/g, ""))) / 100,
        z: "0.0%",
      };
    if ((m = t.match(/^(-?[\d.]+)%$/)))
      // share %
      return { t: "n", v: parseFloat(m[1]) / 100, z: "0.0%" };
    if ((m = t.match(/^₹?\s*(-?[\d,]+)(?:\.(\d+))?$/))) {
      // qty / money
      const dp = (m[2] || "").length;
      return {
        t: "n",
        v: parseFloat(m[1].replace(/,/g, "") + (dp ? "." + m[2] : "")),
        z: "#,##0" + (dp ? "." + "0".repeat(dp) : ""),
      };
    }
    return t;
  }

  /* <table> -> array of rows, honouring colspan / rowspan (recorded in merges) */
  function tableToRows(tbl, startRow, merges) {
    const rows = [],
      occ = {};
    [...tbl.rows].forEach((tr, r) => {
      rows[r] = rows[r] || [];
      let c = 0;
      [...tr.cells].forEach((td) => {
        while (occ[r + "," + c]) c++;
        const cs = td.colSpan || 1,
          rs = td.rowSpan || 1;
        rows[r][c] = xlCell(td);
        if (cs > 1 || rs > 1) {
          merges.push({
            s: { r: startRow + r, c },
            e: { r: startRow + r + rs - 1, c: c + cs - 1 },
          });
          for (let i = 0; i < rs; i++)
            for (let j = 0; j < cs; j++)
              if (i || j) occ[r + i + "," + (c + j)] = 1;
        }
        c += cs;
      });
    });
    return rows.map((r) => Array.from(r, (x) => (x === undefined ? "" : x)));
  }

  async function exportPopup() {
    const title = $("mTitle").textContent,
      sub = $("mSub").textContent;
    const aoa = [[title], [sub]],
      merges = [];
    if (STATE) {
      const { d, co, fy, pi } = STATE;
      aoa.push([
        `Company: ${co} - ${d.name}  |  FY ${fy}  |  Period: ${FULL[pi]} ${calYear(fy, pi)}`,
      ]);
    }
    aoa.push([]);

    [...$("mBody").querySelectorAll("table, p.note")].forEach((el) => {
      if (el.tagName === "TABLE") {
        const rows = tableToRows(el, aoa.length, merges);
        rows.forEach((r) => aoa.push(r));
        aoa.push([]);
      } else {
        aoa.push([el.textContent.trim()]);
      }
    });

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const base =
      title.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") +
      (STATE ? `_${STATE.co}` : "") +
      `_${stamp}`;

    let XL = null;
    try {
      XL = await loadXlsx();
    } catch (e) {
      console.error(e);
    }

    if (XL) {
      const XLSX = XL;
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = merges;
      const nCols = Math.max(...aoa.map((r) => r.length));
      ws["!cols"] = Array.from({ length: nCols }, (_, c) => {
        let w = 8;
        aoa.slice(4).forEach((r) => {
          const x = r[c];
          const s = x && typeof x === "object" ? String(x.v) : String(x ?? "");
          w = Math.max(w, Math.min(s.length + 2, 40));
        });
        return { wch: w };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, base + ".xlsx");
    } else {
      /* Fallback when SheetJS is unavailable: Excel opens an HTML table saved as .xls */
      const head = `<h3>${title}</h3><p>${sub}</p>`;
      const html = `<html><head><meta charset="utf-8"></head><body>${head}${$("mBody").innerHTML}</body></html>`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" }),
      );
      a.download = base + ".xls";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  }

  /* =====================================================================
   7. WIRING
   ===================================================================== */
  const ACTIONS = {
    salesValue: ytdModal, // all three sales tiles -> Month-wise Sales · FY Comparison
    salesQty: ytdModal,
    ytd: ytdModal,
    brandMatrix,
    expMonthly,
    debtors: debtorsModal,
  };

  function showBanner(msg) {
    const b = $("banner");
    b.textContent = msg;
    b.style.display = msg ? "block" : "none";
  }

  let reqSeq = 0;
  async function refresh() {
    const co = $("company").value,
      fy = $("fy").value,
      pi = +$("period").value;
    if (!co) return; // companies not loaded yet (or none returned)
    showBanner("Loading…");
    const my = ++reqSeq,
      r0 = root;
    try {
      const d = await loadData(co, fy);
      if (my !== reqSeq || root !== r0) return; // stale response / view re-mounted meanwhile
      if (!d || d.sales.cv[pi] == null) {
        const c = d && d.counts ? d.counts : {};
        showBanner(
          `No data available for ${FULL[pi]} in FY ${fy}. Rows returned by the service for company ${co}: ` +
            Object.keys(c)
              .map((k) => `${k} ${c[k]}`)
              .join(", ") +
            (d && c.sales
              ? ` (sales rows exist, but none for this month - try another period)`
              : ` (ZC_MIS_SalesMonth is empty for this company / fiscal year - check the service and the data)`),
        );
        return;
      }
      showBanner("");
      render(d, co, fy, pi);
    } catch (e) {
      if (my !== reqSeq || root !== r0) return;
      if (e instanceof AuthError) return showBanner(e.message);
      showBanner("Could not load data: " + e.message);
      console.error(e);
    }
  }

  function fillPeriods(keepIdx) {
    const fy = $("fy").value,
      y0 = +fy.slice(0, 4),
      y1 = +fy.slice(5);
    const def = keepIdx != null ? keepIdx : (_now.getMonth() + 9) % 12; // current month (fiscal index: Apr = 0 ... Mar = 11)
    $("period").innerHTML = MONTHS.map(
      (m, i) =>
        `<option value="${i}" ${i === def ? "selected" : ""}>${m} ${i < 9 ? y0 : y1}</option>`,
    ).join("");
  }

  /* Highlight the segmented unit button that matches the hidden #unit select */
  function syncUnitSeg() {
    root
      .querySelectorAll("#unitSeg button")
      .forEach((b) =>
        b.classList.toggle("is-active", b.dataset.unit === $("unit").value),
      );
  }

  /* Fill the company dropdown from the CDS, then load the first company */
  async function initCompanies() {
    const r0 = root;
    $("company").innerHTML = "<option value=''>Loading…</option>";
    showBanner("Loading…");
    try {
      await loadCompanies();
      if (root !== r0) return; // view re-mounted meanwhile
      if (!COMPANIES.length) {
        $("company").innerHTML = "<option value=''>–</option>";
        return showBanner(
          "No company code returned by the service. Check the CDS data and the SAP user's authorisation.",
        );
      }
      $("company").innerHTML = COMPANIES.map(
        (c) => `<option value="${c.code}">${c.code} - ${c.name}</option>`,
      ).join("");
      refresh(); // first company is selected by default
    } catch (e) {
      if (root !== r0) return;
      $("company").innerHTML = "<option value=''>–</option>";
      showBanner(
        e instanceof AuthError
          ? e.message
          : "Could not load company codes: " + e.message,
      );
      console.error(e);
    }
  }

  let onClick = null,
    onKey = null;

  /* Loads SheetJS from the app's own libs/ folder (no CDN / CSP dependency).
     UI5 defines a global AMD loader, so SheetJS's UMD wrapper would register
     itself as an anonymous AMD module and never set window.XLSX. We hide
     define.amd while the script loads so it falls back to the global. */
  let xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const src =
        window.sap && sap.ui && sap.ui.require && sap.ui.require.toUrl
          ? sap.ui.require.toUrl("zmisreport/libs/xlsx.full.min.js")
          : "libs/xlsx.full.min.js";
      const hadDefine =
        typeof window.define === "function" && window.define.amd;
      const savedAmd = hadDefine ? window.define.amd : undefined;
      const restore = () => {
        if (hadDefine) window.define.amd = savedAmd;
      };
      if (hadDefine) window.define.amd = undefined;
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        restore();
        window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX missing"));
      };
      s.onerror = () => {
        restore();
        xlsxPromise = null;
        reject(new Error("Could not load " + src));
      };
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  function unmount() {
    if (onKey) document.removeEventListener("keydown", onKey);
    if (root && onClick) root.removeEventListener("click", onClick);
    onKey = onClick = null;
    root = null;
    STATE = null;
  }

  function mount(rootEl, baseUrl) {
    unmount();
    root = rootEl;
    if (baseUrl) CONFIG.BASE_URL = baseUrl.replace(/\/+$/, "");
    root.innerHTML = MARKUP;

    onClick = (e) => {
      const el = e.target.closest("[data-act]");
      if (!el || !STATE) return;
      if (el.tagName === "A") e.preventDefault();
      (ACTIONS[el.dataset.act] || (() => {}))();
    };
    onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    $("modal").onclick = (e) => {
      if (e.target === $("modal")) closeModal();
    };
    $("mClose").onclick = closeModal;
    $("mExport").onclick = exportPopup;

    $("fy").innerHTML = FY_LIST.map((f) => `<option>${f}</option>`).join("");
    fillPeriods();
    $("fy").onchange = () => fillPeriods(+$("period").value);
    $("go").onclick = refresh;

    const onUnit = () => {
      syncUnitSeg();
      if (STATE) render(STATE.d, STATE.co, STATE.fy, STATE.pi); // unit change needs no refetch
    };
    $("unit").onchange = onUnit;
    root.querySelectorAll("#unitSeg button").forEach((b) => {
      b.onclick = () => {
        $("unit").value = b.dataset.unit;
        onUnit();
      };
    });
    syncUnitSeg();

    initCompanies(); // loads the company list from the CDS, then the first company's data
  }

  const MARKUP = `
<header>
  <div class="shell-title">
    <h1 id="title"></h1>
    <span id="crumb">MIS Report</span>
  </div>
  <div class="filters">
    <label>Company code<select id="company"></select></label>
    <label>Fiscal year<select id="fy"></select></label>
    <label>Period<select id="period"></select></label>
    <div class="shell-seg" id="unitSeg">
      <button data-unit="cr">Crores</button>
      <button data-unit="lacs">Lacs</button>
      <button data-unit="abs">Absolute</button>
    </div>
    <select id="unit" hidden>
      <option value="cr" selected>Value in Crores</option>
      <option value="lacs">Value in Lacs</option>
      <option value="abs">Absolute</option>
    </select>
    <button class="btn-go" id="go">Go</button>
  </div>
</header>

<main>
  <div id="banner"></div>
  <section class="kpis" id="kpis"></section>

  <section class="cols">
    <div class="stack">
      <div class="card">
        <h2>Monthly Sales Value</h2>
        <div class="meta" id="chartMeta"></div>
        <div id="chart"></div>
        <div class="legend">
          <span><i style="background:var(--prevbar)"></i><span id="lgPrev"></span></span>
          <span><i style="background:var(--curbar)"></i><span id="lgCur"></span></span>
        </div>
      </div>
      <div id="parTile"></div>
    </div>
    <div class="stack">
      <div class="card click" data-act="brandMatrix" title="Click for month-wise breakup">
        <h2>Brand-wise Sales · YTD</h2>
        <div class="meta" id="brandMeta"></div>
        <div><table class="dense" id="brandTbl"></table></div>
      </div>
      <div class="card click" data-act="expMonthly" title="Click for month-wise breakup">
        <h2>Purchase &amp; Expenses · YTD</h2>
        <div class="meta" id="expMeta"></div>
        <div class="scroll"><table class="dense" id="expTbl"></table></div>
      </div>
    </div>
  </section>
</main>

<div id="modal">
  <div class="sheet">
    <div class="sheet-head">
      <div><h2 id="mTitle"></h2><div class="meta" id="mSub"></div></div>
      <div class="sheet-actions">
        <button class="btn-export" id="mExport" title="Download this popup as Excel">⬇ Export to Excel</button>
        <button class="x" id="mClose" aria-label="Close">×</button>
      </div>
    </div>
    <div class="scroll" id="mBody"></div>
  </div>
</div>
`;

  return { mount, unmount };
});
