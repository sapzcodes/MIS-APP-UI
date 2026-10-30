/* Dashboard registry - the home screen builds one tile per entry.
   To add a new dashboard:
   1. Create webapp/js/<name>.js as a UI5 module returning { mount(rootEl, serviceUri), unmount() }
      (same contract as js/mis.js).
   2. Add one entry below. Nothing else needs to change. */
sap.ui.define([], function () {
  "use strict";
  return [
    {
      id: "zfidash",
      title: "P&L Dashboard",
      subtitle: "Sales, purchase, cost, stock, rejection and ageing summary",
      icon: "📈",
      module: "zmisreport/js/zfidash",
    },
    {
      id: "mis",
      title: "Monthly Report",
      subtitle: "Sales, brands, purchase & expenses, debtors and creditors ageing",
      icon: "📊",
      module: "zmisreport/js/mis",
    },
    // { id: "stock", title: "Stock Dashboard", subtitle: "...", icon: "📦", module: "zmisreport/js/stock" },
  ];
});
