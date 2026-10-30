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

      /* Home (tile grid) + slim top bar + the dashboard container (misRoot) */
      _buildShell: function (oRoot) {
        var that = this,
          oParent = oRoot.parentNode;

        this._oRoot = oRoot;
        oRoot.style.display = "none";

        this._oBar = document.createElement("div");
        this._oBar.className = "launcherBar";
        this._oBar.style.display = "none";
        this._oBar.innerHTML =
          '<button type="button" class="launcherBack">‹ Home</button><span class="launcherBarTitle"></span>';
        this._oBar.querySelector(".launcherBack").onclick = function () {
          if (window.history.state && window.history.state.dash) {
            window.history.back(); // popstate -> home
          } else {
            that._showHome();
          }
        };

        this._oHome = document.createElement("div");
        this._oHome.className = "launcher";
        this._oHome.innerHTML =
          "<h1>Dashboards</h1><div class='launcherGrid'>" +
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
          "</div>";
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
