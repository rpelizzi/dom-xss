// if you activate it, you need to take care of [[This]]
// semantics in wrappers
//"use strict";

var {js_beautify, html_beautify} = require("js-beautify");
var rewriter = require("../rewriter");
var dxf = require("./utils");

window.dxf = dxf; // allow parent to use utils

// document.write, document.writeln, document.open
// TODO: use document.readyState to see if you need to add the hack to the new HTML code
var __olddocwrite = HTMLDocument.prototype.write;
HTMLDocument.prototype.write = function _write(html) {
  dxf.markSink("document.write");
  dxf.checkHTMLSink(html);
  html = rewriter.html.rewriteScripts(html, function(s) {
    s = rewriter.js.rewrite(s);
    if (dxfExt.config.beautify)
      s = js_beautify(s);
    if (dxfExt.config.debug) {
      s = rewriter.js.patchEval(s);
      s = rewriter.js.addIframeCheck(s);
    }
    return s;
  });
  if (dxfExt.config.beautify)
    html = html_beautify(html);
  var ret = __olddocwrite.apply(dxf.unwrap(this), [html]);
  dxf.putRuntime(window);
  return ret;
};
HTMLDocument.prototype.writeln = function _writeln(html) {
  return this.write(html + "\n");
};
var __olddocopen = HTMLDocument.prototype.open;
HTMLDocument.prototype.open = function _open() {
  console.log("dopen", arguments);
  // TODO: not sure if i need it, i could check directly in document.write
  var ret = __olddocopen.apply(dxf.unwrap(this), arguments);
  dxf.putRuntime(window);
  return ret;
};

// Function, setTimeout, setInterval
var __oldfunction = Function;
Function = function _Function() {
  dxf.markSink("Function");
  dxf.checkJsSink(arguments[arguments.length-1]);
  var args = Array.prototype.slice.call(arguments);
  args = args.map((a) => rewriter.js.rewrite(a.toString()));
  console.log("func", args);
  return __oldfunction.apply(dxf.unwrap(this), args);
};
Function.prototype = __oldfunction.prototype;

var __oldst = setTimeout;
setTimeout = function _setTimeout(s, ms) {
  if (typeof s !== "string")
    return __oldst.apply(dxf.unwrap(this), arguments);
  dxf.markSink("window.setTimeout");
  dxf.checkJsSink(s);
  s = rewriter.js.rewrite(s);
  if (dxfExt.config.debug)
    s = rewriter.js.patchEval(s);
  console.log("settimeout", s, ms);
  return __oldst.apply(dxf.unwrap(this), [s, ms]);
};

var __oldsi = setInterval;
setInterval = function _setInterval(s, ms) {
  if (typeof s !== "string")
    return __oldsi.apply(dxf.unwrap(this), arguments);
  dxf.markSink("window.setInterval");
  dxf.checkJsSink(s);
  s = rewriter.js.rewrite(s);
  if (dxfExt.config.debug)
    s = rewriter.js.patchEval(s);
  console.log("setinterval", s, ms);
  return __oldsi.apply(dxf.unwrap(this), [s, ms]);
};

// tell proxy not to rewrite worker scripts
var __oldw = Worker;
Worker = function _Worker(url) {
  // blob urls can't have query strings
  if (url.startsWith("blob:"))
    return Reflect.construct(__oldw, [url]);
  if (url.includes("?"))
    url += "&proxypass=true";
  else
    url += "?proxypass=true";
  return Reflect.construct(__oldw, [url]);
};
Worker.prototype = __oldw.prototype;


// wrap toString to only use direct Objects
var __oldos = Object.prototype.toString;
Object.prototype.toString = function _toString() {
  return __oldos.apply(dxf.unwrap(this));
};

// getPrototypeOf trap is not called on Object.getPrototypeOf
Object.getPrototypeOf = function getPrototypeOf(obj) {
      return obj.__proto__;
};
// isPrototypeOf also bypasses stuff
var __oldip = Object.prototype.isPrototypeOf;
Object.prototype.isPrototypeOf = function isPrototypeOf(obj) {
  return __oldip.apply(dxf.unwrap(this), [dxf.unwrap(obj)]);
};

dxf.wrapGetter(document, "URL", function(orig) {
  dxf.markSource("document.URL");
  return orig();
});

dxf.wrapGetter(document, "documentURI", function(orig) {
  dxf.markSource("document.documentURI");
  return orig();
});

dxf.wrapGetter(document, "baseURI", function(orig) {
  dxf.markSource("document.baseURI");
  return orig();
});


dxf.wrapGetter(HTMLDocument.prototype, "cookie", function(orig) {
  dxf.markSource("document.cookie");
  return orig();
});

dxf.wrapGetter(Document.prototype, "referrer", function(orig) {
  dxf.markSource("document.referrer");
  return orig();
});

dxf.wrapGetter(window, "name", function(orig) {
  dxf.markSource("window.name");
  return orig();
});

dxf.wrapGetter(MessageEvent.prototype, "data", function(orig) {
  dxf.markSource("event.data");
  return orig();
});



dxf.wrapSetter(HTMLScriptElement.prototype, "text", function(v, orig) {
  dxf.markSink("script.text");
  dxf.checkJsSink(v);
  orig(v);
});

var isJavaScriptTag = node => node.tagName === "SCRIPT" && (node.type === "" || node.type.includes("javascript"));
dxf.wrapSetter(Node.prototype, "textContent", function(v, orig, node) {
  if (isJavaScriptTag(node)) {
    dxf.markSink("script.textContent");
    dxf.checkJsSink(v);
  }
  orig(v);
});

dxf.wrapSetter(HTMLScriptElement.prototype, "src", function(v, orig) {
  dxf.markSink("script.src");
  dxf.checkURLSink(v);
  orig(v);
});

dxf.wrapSetter(Element.prototype, "innerHTML", function(v, orig) {
  dxf.markSink("element.innerHTML");
  dxf.checkHTMLSink(v, false);
  orig(v);
});


dxf.wrapGetter(window, "self", function() {
  return dxf.wrap(window);
});

dxf.wrapGetter(window, "parent", function(orig) {
  var p = orig();
  try {
    return dxf.wrap(p);
  } catch(e) {
    return p;
  }
});

dxf.wrapGetter(window, "frames", function() {
  return dxf.wrap(window);
});

dxf.wrapGetter(HTMLIFrameElement.prototype, "contentWindow", function(orig) {
  try {
    var w = orig();
    dxf.putRuntime(w);
    w.dxf.markSource("parent");
    return dxf.wrap(w);
  } catch (e) {
    return orig();
  }
});

dxf.wrapGetter(HTMLIFrameElement.prototype, "contentDocument", function(orig, node) {
  return node.contentWindow.document;
});

dxf.wrapGetter(Node.prototype, "ownerDocument", function(orig) {
  var doc = orig();
  return doc && dxf.wrap(doc);
});

dxf.wrapGetter(Document.prototype, "defaultView", function(orig) {
  var w = orig();
  return dxf.wrap(w);
});

// parentElement can't get to the document
dxf.wrapGetter(Node.prototype, "parentNode", function(orig) {
  var n = orig();
  return (n === document ? dxf.wrap(document) : n);
});

// LATER: wrap setAttributeNode or document.createAttributeNode
var __oldsetattr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function _setAttribute(name, value) {
  if (name.toLowerCase().startsWith("on")) {
    dxf.markSink("element.setAttribute");
    dxf.checkJsSink(value);
  }
  return __oldsetattr.apply(this, [name, value]);
};



dxf.autoUnwrap(Node.prototype, "compareDocumentPosition");
dxf.autoUnwrap(Node.prototype, "contains");
dxf.autoUnwrap(Node.prototype, "isEqualNode");




var __window = window.__window = dxf.createProxy(window, {
  get: {
    window: () => __window,
    document: () => __document,
    location: () => ___location,
    eval: () => __indirectEval,
    top: function() {
      var t = window.top;
      try {
        return dxf.wrap(t);
      } catch(e) {
        return t;
      }
    },
    __aIndex: function(i) {
      var f = window[i];
      // we might not have access to the frame
      try {
        dxf.putRuntime(f);
        return f.dxf.wrap(f);
      } catch (e) {
        return f;
      }
    }
  },
  set: {
    location: function(v) {
      if (v.startsWith("javascript:")) {
        dxf.markSink("location");
        dxf.checkURLSink(v, false);
      }
      location = v;
    }
  }
});

var __document = window.__document = dxf.createProxy(document, {
  get: {
    location: () => window.__location
  },
  set: {
    location: function(v) {
      __window.location = v;
    }
  }
});

// cannot declar var __location because that would make it non-configurable
var ___location = dxf.createProxy(location, {
  get: {
    href: function() {
      dxf.markSource("location.href");
      return location.href;
    },
    search: function() {
      dxf.markSource("location.search");
      return location.search;
    },
    hash: function() {
      dxf.markSource("location.hash");
      return location.hash;
    },
    pathname: function() {
      dxf.markSource("location.pathname");
      return location.pathname;
    },
    toString: function() {
      dxf.markSource("location.toString");
      return () => location.toString();
    },
  },
  set: {
    href: function(v) {
      if (v.startsWith("javascript:")) {
        dxf.markSink("location.href");
        dxf.checkURLSink(v, false);
      }
      location.href = v;
    }
  }
});
// redirect __location to ___location so that we can check the setter
Object.defineProperty(window, "__location", {
  enumerable: true, configurable: false,
  get: () => ___location, set: v => (__window.location = v)
});
// top
Object.defineProperty(window, "__top", {
  enumerable: true, configurable: false,
  get: () => __window.top, set: v => (__window.top = v)
});

var __indirectEval = window.__indirectEval = function(s) {
  if (typeof s !== "string")
    return window.eval(s);
  dxf.markSink("window.eval");
  dxf.checkJsSink(s);
  s = rewriter.js.rewrite(s);
  if (dxfExt.config.beautify)
    s = js_beautify(s);
  if (dxfExt.config.debug)
    s = rewriter.js.patchEval(s);
  console.log("__ieval", s);
  return window.eval(s);
};
var __peval = window.__peval = function(s) {
  if (typeof s !== "string")
    return s;
  dxf.markSink("eval");
  dxf.checkJsSink(s);
  s = rewriter.js.rewrite(s);
  if (dxfExt.config.beautify)
    s = js_beautify(s);
  if (dxfExt.config.debug)
    s = rewriter.js.patchEval(s);
  console.log("__peval", s);
  return s;
};
var __pthis = window.__pthis = t => (t===window?__window:t);

