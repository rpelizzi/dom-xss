var prefs = require("sdk/preferences/service");

exports.setMyPrefs = function() {
  // useful until we find a place for setup.js
  prefs.set("security.mixed_content.block_active_content", false);
  prefs.set("security.csp.enable", false);
  // disable caching
  prefs.set("general.warnOnAboutConfig", false);
  prefs.set("browser.cache.disk.enable", false);
  prefs.set("browser.cache.disk_cache_ssl", false);
  prefs.set("browser.cache.memory.enable", false);
  prefs.set("browser.cache.offline.enable", false);
  prefs.set("network.http.use-cache", false);
  // conflicts with beautifier
  // prefs.set("devtools.debugger.source-maps-enabled", false);
  // disable console warnings
  prefs.set("javascript.options.strict", false);
  // disable self-repair, it gets rewritten twice???
  prefs.set("browser.selfsupport.url", "");
  // disable reader, annoying
  prefs.set("reader.parse-on-load.enabled", false);
  // disable telemetry prompt
  prefs.set("toolkit.telemetry.prompted", 2);
  prefs.set("browser.newtabpage.enabled", false);
  prefs.set("browser.newtabpage.enhanced", false);
  prefs.set("startup.homepage_welcome_url.additional", "about:blank");
  // prefs.set("browser.startup.homepage_override.mstone", "42.0");
  // prefs.set("browser.startup.homepage_override.buildID", "");
  prefs.set("devtools.debugger.remote-enabled", true);
  prefs.set("devtools.chrome.enabled", true);


  // Disable updater
  prefs.set("app.update.enabled", false);
  // make absolutely sure it is really off
  prefs.set("app.update.auto", false);
  prefs.set("app.update.mode", 0);
  prefs.set("app.update.service.enabled", false);

  // Disable Add-ons compatibility checking
  prefs.reset("extensions.lastAppVersion"); 

  // Don't show 'know your rights' on first run
  prefs.set("browser.rights.3.shown", true);

  // Don't show WhatsNew on first run after every update
  prefs.set("browser.startup.homepage_override.mstone","ignore");

  // Set default homepage - users can change
  // Requires a complex preference
  // defaultPref("browser.startup.homepage","about:blank");

  // Disable the internal PDF viewer
  prefs.set("pdfjs.disabled", true);

  // Disable the flash to javascript converter
  prefs.set("shumway.disabled", true);

  // Don't ask to install the Flash plugin
  prefs.set("plugins.notifyMissingFlash", false);

  //Disable plugin checking
  prefs.set("plugins.hide_infobar_for_outdated_plugin", true);
  prefs.reset("plugins.update.url");

  // Disable health reporter
  prefs.set("datareporting.healthreport.service.enabled", false);

  // Disable all data upload (Telemetry and FHR)
  prefs.set("datareporting.policy.dataSubmissionEnabled", false);

  // Disable crash reporter
  // prefs.set("toolkit.crashreporter.enabled", false);
  // Components.classes["@mozilla.org/toolkit/crash-reporter;1"].getService(Components.interfaces.nsICrashReporter).submitReports = false;
};