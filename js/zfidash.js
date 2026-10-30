/* P&L Dashboard tile (zfi_dash). Same contract as js/mis.js: { mount(rootEl, serviceUri), unmount() }.
   The app lives in webapp/zfidash/ and runs inside an iframe so its global CSS (body/header/main),
   globals (doLogin, loadPL) and body-level popups cannot clash with the launcher.
   The iframe is same-origin (https://appassets.local), so its /sap/* calls go through the native proxy. */
sap.ui.define([], function () {
  "use strict";
  var oFrame = null;

  function unmount() {
    if (oFrame && oFrame.parentNode) {
      oFrame.parentNode.removeChild(oFrame);
    }
    oFrame = null;
  }

  function mount(rootEl) {
    unmount();
    oFrame = document.createElement("iframe");
    oFrame.src = "zfidash/index.html";
    oFrame.title = "P&L Dashboard";
    oFrame.style.cssText = "display:block;width:100%;height:calc(100vh - 54px);border:0;background:#eef0f2";
    rootEl.innerHTML = "";
    rootEl.appendChild(oFrame);
  }

  return { mount: mount, unmount: unmount };
});
