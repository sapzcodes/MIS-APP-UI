/* Monthly Report - live data from OData V4 service ZSRVB_MIS_REPORT (no mock data).
   Login: none here. The Android shell adds the SAP login and sap-client to every /sap/* call.
   Mounted by controller/App.controller.js into <div id="misRoot">. */
sap.ui.define([], function () {
  "use strict";

  /* =====================================================================
   1. CONFIG
   ===================================================================== */
  const CONFIG = {
    ODATA_VERSION: "v4", // 'v2' -> d.results | 'v4' -> value
    BASE_URL: "/sap/opu/odata4/sap/zsrvb_mis_report/srvd/sap/zsd_mis_report/0001", // overwritten from manifest dataSource "mainService"
    ENTITIES: {
      sales: "ZC_MIS_SalesMonth", // V4 entity set = exposed CDS view name (check $metadata if a call returns 404)
      brands: "ZC_MIS_BrandSales",
      returns: "ZC_MIS_SalesReturn",
      expenses: "ZC_MIS_PurchaseExpense",
      debtors: "ZC_MIS_DebtorsAgeing",
      creditors: "ZC_MIS_CreditorsAgeing",
    },
    // period = fiscal period number (1 = Apr ... 12 = Mar); bucket = B1...B5 (0-30 ... Above 90)
    FIELDS: {
      sales: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        qty: "Qty",
        value: "Value",
      },
      brands: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        brand: "Brand",
        qty: "Qty",
        value: "Value",
      },
      returns: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        value: "Value",
      },
      expenses: {
        co: "CompanyCode",
        fy: "FiscalYear",
        period: "Period",
        label: "Category",
        value: "Amount",
      },
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

  const COMPANIES = [
    { code: "1000", name: "Perfect Engineers" },
    { code: "2000", name: "Aqua Flow" },
  ];
  const DEFAULT_COMPANY = "1000";
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
  const BUCKETS = ["0–30", "31–45", "46–60", "61–90", "Above 90"];

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

  /* Fills derived totals */
  function finish(d, name) {
    const sb = (b) => b.reduce((s, x) => s + (x || 0), 0);
    const col = (rows) =>
      [0, 1, 2, 3, 4].map((i) => rows.reduce((s, r) => s + (r.b[i] || 0), 0));
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
        throw new AuthError(`${entity}: not allowed (HTTP ${res.status}) - check the SAP user's authorisation`);
      if (!res.ok) throw new Error(`${entity}: HTTP ${res.status}`);
      const j = await res.json();
      out.push(...(CONFIG.ODATA_VERSION === "v2" ? (j.d?.results ?? []) : (j.value ?? [])));
      const next = j["@odata.nextLink"];
      url = next ? new URL(next, location.origin + CONFIG.BASE_URL + "/").pathname + new URL(next, location.origin + CONFIG.BASE_URL + "/").search : null;
    }
    return out;
  }

  async function odataData(co, fy) {
    const F = CONFIG.FIELDS,
      D = CONFIG.VALUE_DIVISOR,
      E = CONFIG.ENTITIES;
    const prevFy = `${+fy.slice(0, 4) - 1}-${+fy.slice(5) - 1}`;
    const one = (f) => `${f.co} eq '${co}' and ${f.fy} eq '${fy}'`;
    const coOnly = (f) => `${f.co} eq '${co}'`; // ageing = open items as on today, no fiscal year
    const two = (f) =>
      `${f.co} eq '${co}' and (${f.fy} eq '${fy}' or ${f.fy} eq '${prevFy}')`;

    const [sR, bR, rR, eR, dR, cR] = await Promise.all([
      odataGet("sales", two(F.sales)),
      odataGet("brands", one(F.brands)),
      E.returns ? odataGet("returns", one(F.returns)) : [],
      odataGet("expenses", one(F.expenses), "SortOrder"),
      odataGet("debtors", coOnly(F.debtors)),
      odataGet("creditors", coOnly(F.creditors)),
    ]);

    const nulls = (n) => Array(n).fill(null);
    const salesArr = (fyv) => {
      const q = nulls(12),
        v = nulls(12);
      sR.filter((r) => r[F.sales.fy] === fyv).forEach((r) => {
        const i = +r[F.sales.period] - 1;
        q[i] = +r[F.sales.qty];
        v[i] = +r[F.sales.value] / D;
      });
      return [q, v];
    };
    const [cq, cv] = salesArr(fy),
      [pq, pv] = salesArr(prevFy);

    const monthly = (rows, f, keyOf, withQty) => {
      // group by key -> 12-month arrays
      const m = new Map();
      rows.forEach((r) => {
        const k = keyOf(r);
        if (!m.has(k)) m.set(k, { n: k, q: nulls(12), v: nulls(12) });
        const o = m.get(k),
          i = +r[f.period] - 1;
        if (withQty) o.q[i] = (o.q[i] || 0) + (+r[f.qty] || 0);
        o.v[i] = (o.v[i] || 0) + +r[f.value] / D;
      });
      return [...m.values()];
    };
    const bucketed = (rows, f, keyOf) => {
      // group by key -> 5 bucket values
      const m = new Map();
      rows.forEach((r) => {
        const k = keyOf(r);
        if (!m.has(k)) m.set(k, { n: k, b: nulls(5) });
        const i = +String(r[f.bucket]).replace(/\D/g, "") - 1;
        m.get(k).b[i] = (m.get(k).b[i] || 0) + +r[f.value] / D;
      });
      return [...m.values()];
    };

    const brands = monthly(bR, F.brands, (r) => r[F.brands.brand], true);
    const exp = monthly(eR, F.expenses, (r) => r[F.expenses.label], false).map(
      (x) => ({ n: x.n, v: x.v }),
    );
    const ret = rR.length
      ? monthly(rR, F.returns, () => "ret", false)[0].v
      : null;
    const crRows = bucketed(cR, F.creditors, (r) => r[F.creditors.type]);
    const pick = (k) => crRows.find((x) => x.n === k) || { b: nulls(5) };

    return {
      counts: {
        sales: sR.length,
        brands: bR.length,
        returns: rR.length,
        expenses: eR.length,
        debtors: dR.length,
        creditors: cR.length,
      },
      sales: { cq, cv, pq, pv },
      brands,
      returns: ret,
      purchase: { rows: exp },
      expNote: null,
      debtors: { rows: bucketed(dR, F.debtors, (r) => r[F.debtors.party]) },
      creditors: { cr: { b: pick("CR").b }, adv: { b: pick("ADV").b } },
    };
  }

  async function loadData(co, fy) {
    const c = COMPANIES.find((x) => x.code === co);
    return finish(await odataData(co, fy), c.name);
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

  function ageTable(rows, total, firstHead, extra = "") {
    const cell = (x, i, bold) =>
      `<td class="${i === 4 && x ? "down" : ""}">${x == null ? "–" : money(x)}</td>`;
    return (
      `<tr><th>${firstHead}</th>${BUCKETS.map((b) => `<th>${b}</th>`).join("")}<th>Total</th></tr>` +
      rows
        .map(
          (r) =>
            `<tr><td>${r.n}</td>${r.b.map(cell).join("")}<td><b>${money(r.t)}</b></td></tr>`,
        )
        .join("") +
      `<tr class="total"><td>Total</td>${total.b.map(cell).join("")}<td>${money(total.t)}</td></tr>`
    );
  }

  function ageTile(title, rows, act) {
    return `<div class="card kpi${act ? " click" : ""}"${act ? ` data-act="${act}"` : ""}><div class="lbl">${title}</div>
    <div class="scroll"><table class="mini">
      <tr><th></th>${BUCKETS.map((b) => `<th>${b}</th>`).join("")}<th>Total</th></tr>
      ${rows.map((r) => `<tr><td>${r.label}</td>${r.b.map((x, i) => `<td class="${i === 4 && x ? "down" : ""}">${x == null ? "–" : money(x)}</td>`).join("")}<td><b>${money(r.t)}</b></td></tr>`).join("")}
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

    $("crumb").textContent = `Finance › MIS › ${co} - ${d.name}`;
    $("title").textContent = `Monthly Report · ${FULL[pi]} ${cyr}`;

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

    $("debTile").innerHTML = ageTile(
      "Sundry Debtors · Ageing",
      [{ label: "Sundry Debtors", ...d.debtors.total }],
      "debtors",
    );
    $("creTile").innerHTML = ageTile("Sundry Creditors · Ageing", [
      { label: "Sundry Creditors", ...d.creditors.cr },
      { label: "Creditors Advance", ...d.creditors.adv },
    ]);

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
    $("chartMeta").textContent =
      `FY ${fy} vs FY ${py}, ${range(pi)} · Value in ${u.name}`;
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

  /* Brand-wise card: scrolls inside .vscroll (header, first column and Grand Total stay pinned) */
  function renderBrands(d, fy, pi, u) {
    $("brandMeta").textContent =
      `${range(pi)} ${calYear(fy, pi)} · Qty in numbers · Value in ${u.name}`;
    const S = d.sales,
      pre = pi > 0;
    const rows = d.brands
      .map((b) => {
        const t = brandTot(b, d, pi);
        return {
          n: b.n,
          pq: pre ? sumArr(b.q, 0, pi - 1) : null,
          pv: pre ? sumArr(b.v, 0, pi - 1) : null,
          cq: b.q[pi],
          cv: b.v[pi],
          tq: t.q,
          tv: t.v,
        };
      })
      .filter((r) => r.tv != null);
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
      `<td>${nfIN(r.pq, 0)}</td><td>${money(r.pv)}</td><td>${nfIN(r.cq, 0)}</td><td>${money(r.cv)}</td><td>${nfIN(r.tq, 0)}</td><td>${money(r.tv)}</td>`;
    $("brandTbl").innerHTML =
      `<thead><tr><th rowspan="2" class="fc">Brand</th><th colspan="2" class="grp">${preHead(pi)}</th><th colspan="2" class="grp">${MONTHS[pi]}</th><th colspan="2" class="grp">Total</th></tr>` +
      `<tr>${'<th class="grp">Qty</th><th>Value</th>'.repeat(3)}</tr></thead>` +
      `<tbody>${rows.map((r) => `<tr><td>${r.n}</td>${cells(r)}</tr>`).join("")}</tbody>` +
      `<tfoot><tr class="total"><td>${grand.n}</td>${cells(grand)}</tr></tfoot>`;
  }

  /* Purchase & Expenses card: Apr→previous month | current month | YTD total */
  function renderExpenses(d, fy, pi, u) {
    $("expMeta").textContent =
      `${range(pi)} ${calYear(fy, pi)} · Value in ${u.name}`;
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

  /* Sales Value / Sales Qty tile -> brand split of the selected month */
  function brandMonth(kind) {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      S = d.sales,
      isV = kind === "value";
    const key = isV ? "v" : "q",
      tot = isV ? S.cv[pi] : S.cq[pi];
    const rows = d.brands.filter((b) => b[key][pi] != null);
    const fmt = isV ? money : (x) => nfIN(x, 0);
    openModal(
      `${isV ? "Sales Value" : "Sales Qty"} · ${mLabel(fy, pi)} · Brand-wise`,
      isV ? `Value in ${u.name}` : "Qty in numbers",
      `<table><tr><th>Brand</th><th>${isV ? "Value" : "Qty"}</th><th>Share</th></tr>` +
        rows
          .map(
            (b) =>
              `<tr><td>${b.n}</td><td>${fmt(b[key][pi])}</td><td>${((b[key][pi] / tot) * 100).toFixed(1)}%</td></tr>`,
          )
          .join("") +
        `<tr class="total"><td>Grand Total</td><td>${fmt(tot)}</td><td>100%</td></tr></table>`,
    );
  }

  /* YTD tile -> Month-wise Sales · FY Comparison (months are the column headings) */
  function ytdModal() {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      S = d.sales;
    const py = `${+fy.slice(0, 4) - 1}-${+fy.slice(5) - 1}`,
      a = `FY ${py.slice(2, 4)}-${py.slice(7)}`,
      b = `FY ${fy.slice(2, 4)}-${fy.slice(7)}`;
    const cols = MONTHS.map((m, i) => ({
      pq: S.pq[i],
      cq: i <= pi ? S.cq[i] : null,
      pv: S.pv[i],
      cv: i <= pi ? S.cv[i] : null,
    }));
    cols.push({
      pq: sumArr(S.pq, 0, pi),
      cq: sumArr(S.cq, 0, pi),
      pv: sumArr(S.pv, 0, pi),
      cv: sumArr(S.cv, 0, pi),
    }); // YTD
    cols.push({ pq: sumArr(S.pq), cq: null, pv: sumArr(S.pv), cv: null }); // full prev year
    const heads = [...MONTHS, `YTD ${range(pi)}`, "Full year"];
    const cls = (i) => (i >= 12 ? ' class="ytdc"' : "");
    const row = (label, f) =>
      `<tr><td>${label}</td>${cols.map((c, i) => `<td${cls(i)}>${f(c)}</td>`).join("")}</tr>`;
    const grp = (t) =>
      `<tr class="grprow"><td colspan="${cols.length + 1}">${t}</td></tr>`;
    const h =
      `<table class="dense"><tr><th></th>${heads.map((t, i) => `<th${cls(i)}>${t}</th>`).join("")}</tr>` +
      grp("Qty (numbers)") +
      row(a, (c) => nfIN(c.pq, 0)) +
      row(b, (c) => nfIN(c.cq, 0)) +
      row("Change", (c) => chg(c.cq, c.pq)) +
      grp(`Value (${u.name})`) +
      row(a, (c) => money(c.pv)) +
      row(b, (c) => money(c.cv)) +
      row("Change", (c) => chg(c.cv, c.pv)) +
      "</table>";
    openModal(
      "Month-wise Sales · FY Comparison",
      `Qty in numbers · Value in ${u.name}`,
      h,
    );
  }

  /* Brand-wise card -> month matrix with Qty + Value per month */
  function brandMatrix() {
    const { d, fy, pi } = STATE,
      u = unitInfo(),
      S = d.sales,
      idx = MONTHS.slice(0, pi + 1).map((_, i) => i);
    const pair = (q, v, bold) =>
      `<td>${q == null ? "" : nfIN(q, 0)}</td><td>${v == null ? "" : money(v)}</td>`;
    let h = `<table class="dense"><thead><tr><th rowspan="2">Brand</th>${idx.map((i) => `<th colspan="2" class="grp">${mLabel(fy, i)}</th>`).join("")}<th colspan="2" class="grp">Total</th></tr>
    <tr>${[...idx, "T"].map(() => '<th class="grp">Qty</th><th>Value</th>').join("")}</tr></thead><tbody>`;
    d.brands.forEach((b) => {
      const t = brandTot(b, d, pi);
      if (t.v == null) return;
      h += `<tr><td>${b.n}</td>${idx.map((i) => pair(b.q[i], b.v[i])).join("")}${pair(t.q, t.v)}</tr>`;
    });
    h += `<tr class="total"><td>Grand Total</td>${idx.map((i) => pair(S.cq[i], S.cv[i])).join("")}${pair(sumArr(S.cq, 0, pi), sumArr(S.cv, 0, pi))}</tr>`;
    if (d.returns)
      h += `<tr class="memo"><td>Sales Return</td>${idx.map((i) => pair(null, d.returns[i])).join("")}${pair(null, sumArr(d.returns, 0, pi))}</tr>`;
    openModal(
      `Brand-wise Sales`,
      `${range(pi)} · Qty in numbers · Value in ${u.name}`,
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
    openModal("Purchase & Expenses", `${range(pi)} · Value in ${u.name}`, h);
  }

  /* Sundry Debtors tile -> Debtors Ageing by party */
  function debtorsModal() {
    const { d } = STATE,
      u = unitInfo();
    openModal(
      "Debtors Ageing",
      `Sundry Debtors · Value in ${u.name}`,
      `<table class="dense">${ageTable(d.debtors.rows, d.debtors.total, "Party")}</table>`,
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
    salesValue: () => brandMonth("value"),
    salesQty: () => brandMonth("qty"),
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
    const def =
      keepIdx != null ? keepIdx : Math.max(0, ((_now.getMonth() + 9) % 12) - 1); // last completed month
    $("period").innerHTML = MONTHS.map(
      (m, i) =>
        `<option value="${i}" ${i === def ? "selected" : ""}>${m} ${i < 9 ? y0 : y1}</option>`,
    ).join("");
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

    $("company").innerHTML = COMPANIES.map(
      (c) =>
        `<option value="${c.code}" ${c.code === DEFAULT_COMPANY ? "selected" : ""}>${c.code} - ${c.name}</option>`,
    ).join("");
    $("fy").innerHTML = FY_LIST.map((f) => `<option>${f}</option>`).join("");
    fillPeriods();
    $("fy").onchange = () => fillPeriods(+$("period").value);
    $("go").onclick = refresh;
    $("unit").onchange = () =>
      STATE && render(STATE.d, STATE.co, STATE.fy, STATE.pi); // unit change needs no refetch
    refresh();
  }

  const MARKUP = `
<header>
  <div>
    <div class="crumb" id="crumb">Finance › MIS</div>
    <h1 id="title">Monthly Report</h1>
  </div>
  <div class="filters">
    <label>Company code<select id="company"></select></label>
    <label>Fiscal year<select id="fy"></select></label>
    <label>Period<select id="period"></select></label>
    <label>Unit
      <select id="unit">
        <option value="cr" selected>Value in Crores</option>
        <option value="lacs">Value in Lacs</option>
        <option value="abs">Absolute</option>
      </select>
    </label>
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
      <div id="debTile"></div>
      <div id="creTile"></div>
    </div>
    <div class="stack">
      <div class="card click" data-act="brandMatrix" title="Click for month-wise breakup">
        <h2>Brand-wise Sales · YTD</h2>
        <div class="meta" id="brandMeta"></div>
        <div class="vscroll"><table class="dense" id="brandTbl"></table></div>
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
