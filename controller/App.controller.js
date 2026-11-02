sap.ui.define(
  ["sap/ui/core/mvc/Controller", "zmisreport/js/dashboards"],
  function (Controller, DASHBOARDS) {
    "use strict";

    return Controller.extend("zmisreport.controller.App", {
      onAfterRendering: function () {
        var oRoot = document.getElementById("misRoot");
        // onAfterRendering fires on every re-render of the view; build the shell only
        // when the DOM element is new, otherwise the open dashboard would be wiped.
        if (!oRoot || oRoot === this._oMountedRoot) {
          return;
        }
        this._oMountedRoot = oRoot;
        // service URL comes from manifest.json > sap.app > dataSources > mainService
        this._sUri = this.getOwnerComponent().getManifestEntry(
          "/sap.app/dataSources/mainService/uri",
        );
        this._buildShell(oRoot);
      },

      _getUserName: function () {
        try {
          if (window.AndroidBridge && typeof window.AndroidBridge.getUsername === "function") {
            return window.AndroidBridge.getUsername() || "";
          }
        } catch (e) {}
        return "";
      },

      _updateUserBadge: function () {
        var sUser = this._getUserName();
        var oBadge = this._oHome ? this._oHome.querySelector(".launcherUserName") : null;
        if (oBadge) {
          oBadge.textContent = sUser || "SAP User";
        }
      },

      _onSignOut: function () {
        if (window.AndroidBridge && typeof window.AndroidBridge.signOut === "function") {
          window.AndroidBridge.signOut();
        } else if (confirm("Sign out and switch user?")) {
          localStorage.clear();
          window.location.reload();
        }
      },

      /* Home (tile grid) + slim top bar + the dashboard container (misRoot) */
      _buildShell: function (oRoot) {
        var that = this,
          oParent = oRoot.parentNode;

        this._oRoot = oRoot;
        oRoot.style.display = "none";

        var sUser = this._getUserName();

        this._oBar = document.createElement("div");
        this._oBar.className = "launcherBar";
        this._oBar.style.display = "none";
        this._oBar.innerHTML =
          '<div class="launcherBarLeft">' +
          '  <button type="button" class="launcherBack">‹ Home</button>' +
          '  <span class="launcherBarTitle"></span>' +
          '</div>' +
          '<div class="launcherBarRight">' +
          '  <button type="button" class="launcherBarSignOut" title="Sign out / Switch user">Sign out</button>' +
          '</div>';

        this._oBar.querySelector(".launcherBack").onclick = function () {
          if (window.history.state && window.history.state.dash) {
            window.history.back(); // popstate -> home
          } else {
            that._showHome();
          }
        };
        var oBarSignOut = this._oBar.querySelector(".launcherBarSignOut");
        if (oBarSignOut) {
          oBarSignOut.onclick = function () { that._onSignOut(); };
        }

        this._oHome = document.createElement("div");
        this._oHome.className = "launcher";
        this._oHome.innerHTML =
          '<div class="launcherHeader">' +
          '  <div class="launcherHeaderLeft">' +
          '    <h1>Dashboards</h1>' +
          '  </div>' +
          '  <div class="launcherHeaderRight">' +
          '    <span class="launcherUser" title="Current SAP User">' +
          '      <span class="launcherUserIcon" aria-hidden="true">👤</span>' +
          '      <span class="launcherUserName">' + (sUser || "SAP User") + '</span>' +
          '    </span>' +
          '    <button type="button" class="launcherSignOutBtn" title="Sign out / Switch user">' +
          '      <span class="launcherSignOutIcon" aria-hidden="true">⎋</span>' +
          '      <span>Sign out</span>' +
          '    </button>' +
          '  </div>' +
          '</div>' +
          '<div class="launcherGrid">' +
          DASHBOARDS.map(function (d) {
            return (
              "<button type='button' class='launcherTile' data-id='" +
              d.id +
              "'><span class='launcherIcon'>" +
              (d.icon || "") +
              "</span><span class='launcherName'>" +
              d.title +
              "</span><span class='launcherSub'>" +
              (d.subtitle || "") +
              "</span></button>"
            );
          }).join("") +
          '</div>';

        var oSignOutBtn = this._oHome.querySelector(".launcherSignOutBtn");
        if (oSignOutBtn) {
          oSignOutBtn.onclick = function (e) {
            e.stopPropagation();
            that._onSignOut();
          };
        }

        this._oHome.onclick = function (e) {
          var el = e.target.closest(".launcherTile");
          if (el) {
            that._open(el.getAttribute("data-id"), true);
          }
        };

        oParent.insertBefore(this._oHome, oRoot);
        oParent.insertBefore(this._oBar, this._oHome);

        // Browser / Android back button: dashboard -> home
        this._fnPop = function (e) {
          var s = e.state;
          if (s && s.dash) {
            that._open(s.dash, false);
          } else {
            that._showHome();
          }
        };
        window.addEventListener("popstate", this._fnPop);
      },

      _open: function (sId, bPush) {
        var that = this,
          oDash = DASHBOARDS.filter(function (d) {
            return d.id === sId;
          })[0];
        if (!oDash) {
          return;
        }
        sap.ui.require([oDash.module], function (oModule) {
          that._closeActive();
          that._oModule = oModule;
          that._oHome.style.display = "none";
          that._oBar.style.display = "";
          that._oBar.querySelector(".launcherBarTitle").textContent = oDash.title;
          that._oRoot.style.display = "";
          if (bPush) {
            window.history.pushState({ dash: sId }, "");
          }
          oModule.mount(that._oRoot, that._sUri);
        });
      },

      _closeActive: function () {
        if (this._oModule) {
          this._oModule.unmount();
          this._oModule = null;
        }
        if (this._oRoot) {
          this._oRoot.innerHTML = "";
        }
      },

      _showHome: function () {
        this._closeActive();
        if (this._oRoot) {
          this._oRoot.style.display = "none";
          this._oBar.style.display = "none";
          this._updateUserBadge();
          this._oHome.style.display = "";
        }
      },

      onExit: function () {
        window.removeEventListener("popstate", this._fnPop);
        this._closeActive();
        this._oMountedRoot = null;
      },
    });
  },
);
