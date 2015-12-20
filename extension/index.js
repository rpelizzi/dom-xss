var extData = require("sdk/self").data;
var prefs = require("sdk/preferences/service");
var {Cc, Ci, Cu} = require("chrome");

var {Menuitem} = require("menuitem");
var proxy = require("addon-proxy");
var {js_beautify, html_beautify} = require("js-beautify");
var entities = require("html-entities").AllHtmlEntities;

var rewriter = require("./rewriter");
var addGlobals = require("./add-globals");
var {setMyPrefs} = require("./prefs");

setMyPrefs();

var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                  .getService(Ci.nsIEffectiveTLDService);

var setPref = (n, v) => prefs.set(n, v) || v;
var getPref = (n, d) => prefs.has(n) ? prefs.get(n) : setPref(n, d);

// synced to security.dxf.*
var config = {
  rewrite: getPref("security.dxf.rewrite", true),
  beautify: getPref("security.dxf.beautify", false),
  enforce: getPref("security.dxf.enforce", true),
  debug: getPref("security.dxf.debug", true),
  minify: getPref("security.dxf.minify", false)
};

// just fill them automatically
var mkOptionItem = function(obj, key, isFirst) {
  var item = Menuitem({
    id: `${key}-opt`,
    menuid: "menu_ToolsPopup",
    "label": `${key[0].toUpperCase()+key.slice(1)} Enabled`,
    disabled: false,
    checked: obj[key],
    separatorbefore: isFirst,
    onCommand: function() {
      item.checked = !item.checked;
      obj[key] = !obj[key];
      setPref("security.dxf." + key, obj[key]);
    }
  });
  return item;
};
var optionItems = {};
Object.keys(config).forEach((k, i) => { optionItems[k] = mkOptionItem(config, k, i === 0); });

Cu.import("resource://gre/modules/Services.jsm");
var prefObs = {
  observe: function(branch, topic, data) {
    var newVal = getPref(data);
    if (newVal === undefined)
      return;
    var k = data.split(".")[2];
    config[k] = newVal;
    optionItems[k].checked = newVal;
  }
};
Services.prefs.addObserver("security.dxf.", prefObs, false);
require("sdk/system/unload").when(function() {
  Services.prefs.removeObserver("security.dxf.", prefObs);
});


addGlobals(function(w, cloner) {
  w.dxfExt = cloner({
    config: config,
  });
  w.dxfExt.getFile = f => extData.load(f);
  w.dxfExt.js_beautify = js_beautify;
  w.dxfExt.html_beautify = html_beautify;
  w.dxfExt.decodeEntities = src => entities.decode(src);
  w.dxfExt.getBaseDomainFromHost = function(h) {
    if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h === "") return h;
    return eTLDService.getBaseDomainFromHost(h);
  };
});

var mkExternal = (url, id, attrs="") => `<script src="${url+'?proxypass=true'}" id="${id}" ${attrs}></script>\n`;
var mkInline = (src, id, attrs="") => `<script id="${id}" ${attrs}>\n${src}\n</script>\n`;

proxy.rewrite({
  html: function(data, req) {
    var url = req.originalURI.spec;
    if (config.debug)
      console.log("HTML", url, data.length);
    if (config.rewrite) {
      data = rewriter.html.rewriteScripts(data, s => this.js(s, req));
      var runtime = "";
      runtime += mkExternal("http://localhost:8090/p1.min.js", "p1Url");
      if (config.minify) {
        runtime += mkExternal("http://localhost:8090/dxf.min.js", "dxfSrc");
      } else {
        ["matcher.web.js", "rewriter.web.js", "utils.web.js", "setup.web.js"].forEach(function(f,i) {
          runtime += mkExternal("http://localhost:8090/" + f, "dxfUrl" + i);
        });
      }
      data = rewriter.html.addFirst(data, runtime);
    }
    // TODO: hangs on vnexpress.net, already filed bug
    if (config.beautify)
      data = html_beautify(data);
    return data;
  },
  js: function(data, req) {
    var url = req.originalURI.spec;
    if (config.debug)
      console.log("JS", url, data.length);
    if (config.rewrite) {
      data = rewriter.js.rewrite(data);
    }
    if (config.beautify) {
      data = js_beautify(data);
      data = rewriter.js.removeSrcMap(data);
    }
    if (config.rewrite && config.debug) {
      data = rewriter.js.patchEval(data);
      //data = rewriter.js.addIframeCheck(data);
    }
    return data;
  }
});

