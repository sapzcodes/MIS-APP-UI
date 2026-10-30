/* APK-only shim: WebView cannot download blob: files, so hand them to the native side. */
(function () {
  if (!window.AndroidBridge) return;
  var blobs = {};
  var origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = origCreate(obj);
    try { if (obj instanceof Blob) blobs[u] = obj; } catch (e) {}
    return u;
  };
  function save(a) {
    var href = a.href || "", name = a.download || "download";
    var blob = blobs[href];
    if (!blob) return false;
    var fr = new FileReader();
    fr.onloadend = function () {
      var s = String(fr.result || "");
      window.AndroidBridge.saveFile(name, blob.type || "application/octet-stream", s.substring(s.indexOf(",") + 1));
    };
    fr.readAsDataURL(blob);
    return true;
  }
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute("download") && save(this)) return;
    return origClick.apply(this, arguments);
  };
  var origDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (ev) {
    if (this instanceof HTMLAnchorElement && ev && ev.type === "click" &&
        this.hasAttribute("download") && save(this)) return true;
    return origDispatch.apply(this, arguments);
  };
})();
