/* jshint browser:true, esnext: true */
/* globals HTMLDocument: true, __js_beautify: true, __html_beautify: true,
  __dbgEvalSearch: true, __rewriteJs: true, __rewriteInlineJs: true,
  __getBeautify: true, __getDebug: true, __dbgIframeFix: true,
  Document: true, Function: true, setTimeout: true,
  markSink: false, markSource: false, createProxy: false, autoUnwrap: false, wrap: false, unwrap: false,
  wrapGetter: false, wrapSetter: false, location: true, __location: false
  setInterval: true, Worker: true, Reflect: false, setupEnv: false,
  checkHTMLSink: false, checkJsSink: false, checkURLSink: false */ 

(function() {
  // if you activate it, you need to take care of [[This]]
  // semantics in wrappers
  //"use strict";

  if (window.__window) {
    console.log("setup.js has been inserted twice into the environment. aborting.");
    return;
  }

  // document.write, document.writeln, document.open
  // TODO: use document.readyState to see if you need to add the hack to the new HTML code
  var __olddocwrite = HTMLDocument.prototype.write;
  HTMLDocument.prototype.write = function _write(html) {
    markSink("document.write");
    checkHTMLSink(html);
    html = __rewriteInlineJs(html, function(s) {
      s = __rewriteJs(s);
      if (__getBeautify())
        s = __js_beautify(s);
      if (__getDebug()) {
        s = __dbgEvalSearch(s);
        s = __dbgIframeFix(s);
      }
      return s;
    });
    if (__getBeautify())
      html = __html_beautify(html);
    console.log("dwrite", html);
    var ret = __olddocwrite.apply(unwrap(this), [html]);
    if (!window.__window)
      setupEnv(eval);
    return ret;
  };
  HTMLDocument.prototype.writeln = function _writeln(html) {
    return this.write(html + "\n");
  };
  var __olddocopen = HTMLDocument.prototype.open;
  HTMLDocument.prototype.open = function _open() {
    console.log("dopen", arguments);
    // TODO: not sure if i need it, i could check directly in document.write
    var ret = __olddocopen.apply(unwrap(this), arguments);
    if (!window.__window)
      setupEnv(eval);
    return ret;
  };

  // Function, setTimeout, setInterval
  var __oldfunction = Function;
  Function = function _Function() {
    markSink("Function");
    checkJsSink(arguments[arguments.length-1]);
    var args = Array.prototype.slice.call(arguments);
    args = args.map((a) => __rewriteJs(a.toString()));
    console.log("func", args);
    return __oldfunction.apply(unwrap(this), args);
  };
  Function.prototype = __oldfunction.prototype;

  var __oldst = setTimeout;
  setTimeout = function _setTimeout(s, ms) {
    if (typeof s !== "string")
      return __oldst.apply(unwrap(this), arguments);
    markSink("window.setTimeout");
    checkJsSink(s);
    s = __rewriteJs(s);
    if (__getDebug())
      s = __dbgEvalSearch(s);
    console.log("settimeout", s, ms);
    return __oldst.apply(unwrap(this), [s, ms]);
  };

  var __oldsi = setInterval;
  setInterval = function _setInterval(s, ms) {
    if (typeof s !== "string")
      return __oldsi.apply(unwrap(this), arguments);
    markSink("window.setInterval");
    checkJsSink(s);
    s = __rewriteJs(s);
    if (__getDebug())
      s = __dbgEvalSearch(s);
    console.log("setinterval", s, ms);
    return __oldsi.apply(unwrap(this), [s, ms]);
  };

  // signal proxy not to rewrite worker scripts
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
    return __oldos.apply(unwrap(this));
  };

  // getPrototypeOf trap is not called on Object.getPrototypeOf
  Object.getPrototypeOf = function getPrototypeOf(obj) {
        return obj.__proto__;
  };
  // isPrototypeOf also bypasses stuff
  var __oldip = Object.prototype.isPrototypeOf;
  Object.prototype.isPrototypeOf = function isPrototypeOf(obj) {
    return __oldip.apply(unwrap(this), [unwrap(obj)]);
  };

  wrapGetter(document, "URL", function(orig) {
    markSource("document.URL");
    return orig();
  });

  wrapGetter(document, "documentURI", function(orig) {
    markSource("document.documentURI");
    return orig();
  });

  wrapGetter(document, "baseURI", function(orig) {
    markSource("document.baseURI");
    return orig();
  });


  wrapGetter(HTMLDocument.prototype, "cookie", function(orig) {
    markSource("document.cookie");
    return orig();
  });

  wrapGetter(Document.prototype, "referrer", function(orig) {
    markSource("document.referrer");
    return orig();
  });

  wrapGetter(window, "name", function(orig) {
    markSource("window.name");
    return orig();
  });

  wrapGetter(MessageEvent.prototype, "data", function(orig) {
    markSource("event.data");
    return orig();
  });



  wrapSetter(HTMLScriptElement.prototype, "text", function(v, orig) {
    markSink("script.text");
    checkJsSink(v);
    orig(v);
  });

  var isJavaScriptTag = node => node.tagName === "SCRIPT" && (node.type === "" || node.type.includes("javascript"));
  wrapSetter(Node.prototype, "textContent", function(v, orig, node) {
    if (isJavaScriptTag(node)) {
      markSink("script.textContent");
      checkJsSink(v);
    }
    orig(v);
  });

  wrapSetter(HTMLScriptElement.prototype, "src", function(v, orig) {
    markSink("script.src");
    checkURLSink(v);
    orig(v);
  });

  wrapSetter(Element.prototype, "innerHTML", function(v, orig) {
    markSink("element.innerHTML");
    checkHTMLSink(v, false);
    orig(v);
  });


  wrapGetter(window, "self", function() {
    return __window;
  });

  wrapGetter(window, "parent", function(orig) {
    var p = orig();
    try {
      return p.__proxy;
    } catch(e) {
      return p;
    }
  });

  wrapGetter(window, "frames", function() {
    return __window;
  });

  wrapGetter(HTMLIFrameElement.prototype, "contentWindow", function(orig) {
    try {
      if (!orig().__window) {
        // once the script is inlined, you can just go copy it,
        // so setupEnv is not a hack anymore
        setupEnv(orig().eval);
        orig().markSource("parent");
      }
      return orig().__window;
    } catch (e) {
      return orig();
    }
  });

  wrapGetter(HTMLIFrameElement.prototype, "contentDocument", function(orig, node) {
    return node.contentWindow.document;
  });

  wrapGetter(Node.prototype, "ownerDocument", function(orig) {
    return orig() && orig().__proxy;
  });

  wrapGetter(Document.prototype, "defaultView", function(orig) {
    return __window;
  });

  // parentElement can't get to the document
  wrapGetter(Node.prototype, "parentNode", function(orig) {
    var n = orig();
    return (n === document ? __document : n);
  });

  // LATER: wrap setAttributeNode or document.createAttributeNode
  var __oldsetattr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function _setAttribute(name, value) {
    if (name.toLowerCase().startsWith("on")) {
      markSink("element.setAttribute");
      checkJsSink(value);
    }
    return __oldsetattr.apply(this, [name, value]);
  }



  autoUnwrap(Node.prototype, "compareDocumentPosition");
  autoUnwrap(Node.prototype, "contains");
  autoUnwrap(Node.prototype, "isEqualNode");




  var __window = window.__window = createProxy(window, {
    get: {
      window: () => __window,
      document: () => __document,
      location: () => __location,
      eval: () => __indirectEval,
      top: function() {
        var t = window.top;
        try {
          return t.__proxy;
        } catch(e) {
          return t;
        }
      },
      __aIndex: function(i) {
        var f = window[i];
        // we might not have access to the frame
        try {
          if (f.__window)
            return f.__window;
          setupEnv(f.eval);
          return f.__window;
        } catch (e) {
          return f;
        }
      }
    },
    set: {
      location: function(v) {
        if (v.startsWith("javascript:")) {
          markSink("location");
          checkURLSink(v, false);
        }
        location = v;
      }
    }
  });

  var __document = window.__document = createProxy(document, {
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
  var ___location = createProxy(location, {
    get: {
      href: function() {
        markSource("location.href");
        return location.href;
      },
      search: function() {
        markSource("location.search");
        return location.search;
      },
      hash: function() {
        markSource("location.hash");
        return location.hash;
      },
      pathname: function() {
        markSource("location.pathname");
        return location.pathname;
      },
      toString: function() {
        markSource("location.toString");
        return () => location.toString();
      },
    },
    set: {
      href: function(v) {
        if (v.startsWith("javascript:")) {
          markSink("location.href");
          checkURLSink(v, false);
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
    markSink("window.eval");
    checkJsSink(s);
    s = __rewriteJs(s);
    if (__getBeautify())
      s = __js_beautify(s);
    if (__getDebug())
      s = __dbgEvalSearch(s);
    console.log("__ieval", s);
    return window.eval(s);
  };
  var __peval = window.__peval = function(s) {
    if (typeof s !== "string")
      return s;
    markSink("eval");
    checkJsSink(s);
    s = __rewriteJs(s);
    if (__getBeautify())
      s = __js_beautify(s);
    if (__getDebug())
      s = __dbgEvalSearch(s);
    console.log("__peval", s);
    return s;
  };
  var __pthis = window.__pthis = t => (t===window?__window:t);

})();
//NOTE: DOM nodes with ids are accessible as global variables. you can find
//them with $("[id]") and wrap them if necessary.
