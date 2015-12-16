/* globals require: false */
var proxy = require("addon-proxy");
var {Cu, Cc, Ci} = require("chrome");
var events = require("sdk/system/events");
var {rewriteJs, rewriteInlineJs, htmlAdd, removeSrcMap, dbgIframeFix, dbgEvalSearch} = require("./rewriter");
var {Menuitem} = require("menuitem");
var {js_beautify, html_beautify} = require("js-beautify");
var {Matcher} = require("./matcher");
var entities = require("html-entities").AllHtmlEntities;
var addGlobals = require("add-globals");

var file = require("sdk/io/file");
var extData = require("sdk/self").data;
var {setMyPrefs} = require("./prefs");

setMyPrefs();

var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
                  .getService(Ci.nsIEffectiveTLDService);

var config = {
  rewrite: true,
  beautify: false,
  debug: true,
  inline: false,
};

addGlobals(function(w, cloner) {
  w.dxfExt = cloner({
    config: config,
  });
  w.dxfExt.getFile = f => extData.load(f);
  w.dxfExt.js_beautify = js_beautify;
  w.dxfExt.html_beautify = html_beautify;
  w.dxfExt.decodeEntities = src => entities.decode(src);
  w.dxfExt.getBaseDomainFromHost = h => eTLDService.getBaseDomainFromHost(h);
});

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
    }
  });
  return item;
};
Object.keys(config).forEach((k, i) => mkOptionItem(config, k, i === 0));


var mkExternal = (url, id, attrs="") => `<script src="${url+'?proxypass=true'}" id="${id}" ${attrs}></script>\n`;
var mkInline = (src, id attrs="") => `<script id="${id}" ${attrs}>\n${src}\n</script>\n`;

proxy.rewrite({
  html: function(data, req) {
    var url = req.originalURI.spec;
    if (config.debug)
      console.log("HTML", url, data.length);
    if (config.rewrite) {
      data = rewriter.html.rewriteScripts(data, s => this.js(s, req));
      var runtime = "";
      runtime += mkExternal("http://localhost:8090/p1.min.js", "p1Url");
      if (config.inline) {
        runtime += mkInline(extData.load("dxf.min.js"), "dxfSrc");
      } else {
        ["utils.web.js", "setup.web.js", "matcher.web.js", "rewriter.web.js"].forEach(function(f,i) {
          runtime += mkExternal("http://localhost:8090/" + f, dxfUrl + i);
        });
      }
      data = rewriter.html.addFirst(data, runtime);
    }
    // TODO: hangs on vnexpress.net, already filed bug
    if (config.beautify && data.length < 5000)
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
      data = rewriter.js.addIframeCheck(data);
    }
    return data;
  },
  other: function(data, req) {
    return data;
  }
});

