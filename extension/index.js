/* globals require: false */
var proxy = require("addon-proxy");
var {Cu, Cc, Ci} = require("chrome");
var events = require("sdk/system/events");
var {rewriteJs, rewriteInlineJs, htmlAdd, removeSrcMap, dbgIframeFix, dbgEvalSearch} = require("./rewriter");
var {Menuitem} = require("menuitem");
var {js_beautify, html_beautify} = require("js-beautify");
var {Matcher} = require("./matcher");
var entities = require("html-entities").AllHtmlEntities;

var file = require("sdk/io/file");
var extData = require("sdk/self").data;
var {env} = require('sdk/system/environment');
var {setMyPrefs} = require("./prefs");

setMyPrefs();

var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                  .getService(Ci.nsIEffectiveTLDService);

// recycle rewriter
var observe = function(ev) {
  if (ev.data.indexOf("http") !== 0)
    return;
  var docWin = Cu.waiveXrays(ev.subject);
  docWin.__rewriteJs = rewriteJs;
  docWin.__rewriteInlineJs = rewriteInlineJs;
  if (config.debug) {
    docWin.__dbgIframeFix = dbgIframeFix;
    docWin.__dbgEvalSearch = dbgEvalSearch;
    docWin.__getFile = f => (env.DBG_FILE ? file.read(env.DBG_FILE + f) : extData.load(f));
    docWin.__getDebug = () => config.debug;
    docWin.__getBeautify = () => config.beautify;
    docWin.__js_beautify = js_beautify;
    docWin.__html_beautify = html_beautify;
    docWin.__decodeEntities = src => entities.decode(src);
    docWin.__getBaseDomainFromHost = h => eTLDService.getBaseDomainFromHost(h);
  }
};
events.on("content-document-global-created", observe, true);

var config = {
  rewrite: true,
  beautify: false,
  debug: true
};

var mir = Menuitem({
  id: "rewrite-opt",
  menuid: "menu_ToolsPopup",
  "label": "Rewriter Enabled",
  disabled: false,
  checked: config.rewrite,
  separatorbefore: true,
  onCommand: function() {
    mir.checked = !mir.checked;
    config.rewrite = !config.rewrite;
  }
});
var mib = Menuitem({
  id: "beautify-opt",
  menuid: "menu_ToolsPopup",
  "label": "Beautifier Enabled",
  disabled: false,
  checked: config.beautify,
  separatorbefore: false,
  onCommand: function() {
    mib.checked = !mib.checked;
    config.beautify = !config.beautify;
  }
});

proxy.rewrite({
  html: function(data, req) {
    console.log("HTML", req.originalURI.spec, data.length);
    if (config.rewrite) {
      data = rewriteInlineJs(data, s => this.js(s, req));
      data = htmlAdd(data, req);
    }
    // TODO: hangs on vnexpress.net, already filed bug
    if (config.beautify && data.length < 5000)
      data = html_beautify(data);
    return data;
  },
  js: function(data, req) {
    if (req.originalURI.scheme !== "view-source" && req.originalURI.host === "www.tunghackserver.com")
      return data;
    console.log("JS", req.originalURI.spec, data.length);
    if (config.rewrite) {
      data = rewriteJs(data);
    }
    if (config.beautify) {
      data = js_beautify(data);
      data = removeSrcMap(data);
    }
    if (config.rewrite && config.debug) {
      data = dbgEvalSearch(data);
      data = dbgIframeFix(data);
    }
    return data;
  },
  other: function(data, req) {
    // console.log("OTHER", req.originalURI.scheme, req.contentType, data.length);
    return data;
  }
});

