"use strict";

var entities = require("html-entities").AllHtmlEntities;
var tld = require("tldjs");
var Matcher = require("../matcher").Matcher;

/* Functional wrapper around RegExp.exec */
RegExp.prototype.exec_loop = function(str, f) {
  var m;
  try {
    while ((m = this.exec(str)) !== null) {
        f(m);
    }
  } finally {
    this.lastIndex = 0;
  }
};

/*
 * Object's version of Array.[forEach|filter|map]
 * They probably have weird semantics unless they are used straightforwardly.
 */
Object.defineProperties(Object.prototype, {
  oForEach: {
    value: function(f) {
      Object.keys(this).forEach(k => f(k, this[k]));
    }
  },
  oFilter: {
    value: function(f) {
      var obj = Object.assign({}, this);
      obj.oForEach((k, v) => { if (!f(k, v)) delete obj[k]; });
      return obj;
    }
  },
  oMap: {
    value: function(f) {
      var obj = {};
      Object.keys(this).forEach(k => {
        var [nk, nv] = f(k, this[k]);
        obj[nk] = nv;
      });
      return obj;
    }
  }
});

var sources = {}; // We track which sources are being used and we don't match them otherwise
var sinks = {}; // Sinks are only tracked for accounting purposes
var dxfStack = 0; // Prevents marking sources and sinks while running our own code


exports.markSource = function(s) {
  if (dxfStack)
    return;
  if (!sources[s]) {
    console.log("Source", s);
  }
  sources[s] = true;
};

exports.markSink = function(s) {
  if (dxfStack)
    return;
  if (!sinks[s]) {
    console.log("Sink", s);
  }
  sinks[s] = true;
};

// Ensure that you are getting the proxied/direct version respectively.
var wrap = o => o.__proxy || o;
var unwrap = o => o.__direct || o;
exports.wrap = wrap;
exports.unwrap = unwrap;

/* Encapsulates all the defineProperty stuff so you can focus on doing
 * something with the original getter, which is provided as an argument to the
 * callback. */
exports.wrapGetter = function(obj, prop, f) {
  var getter = obj.__lookupGetter__(prop);
  if (!getter)
    throw "Cannot wrap getter " + prop;
  // must be configurable, because document.open does not delete them
  Object.defineProperty(obj, "__get_" + prop, {value: getter, configurable: true});
  obj.__defineGetter__(prop, function() {
    return f(getter.bind(unwrap(this)), unwrap(this));
  });
  obj["__oldget" + prop] = getter;
};

exports.wrapSetter = function(obj, prop, f) {
  var setter = obj.__lookupSetter__(prop);
  if (!setter)
    throw "Cannot wrap setter " + prop;
  Object.defineProperty(obj, "__set_" + prop, {value: setter, configurable: true});
  obj.__defineSetter__(prop, function(v) {
    f(v, setter.bind(unwrap(this)), unwrap(this));
  });
  obj["__oldset" + prop] = setter; 
};

/* Many native DOM methods don't work on a proxied object or don't support
 * proxies arguments, this patches them. */
exports.autoUnwrap = function(obj, prop) {
  var oldf = obj[prop];
  obj[prop] = function() {
    var args = Array.prototype.slice.call(arguments);
    return oldf.apply(unwrap(this), args.map(unwrap));
  };
  // cannot write name, only configure it
  Object.defineProperty(obj[prop], "name",
    {configurable: true, writable: false, enumerable: false, value: prop});
};

var isNativeFunction = function(f) {
  return (typeof f === "function" && /^[a-z]/.test(f.name) &&
          f.toString().indexOf("[native code]") > -1);
};

/* Creates a fairly transparent proxy and supports a list of get/set
 * accessors. */
exports.createProxy = function(obj, custom) {
  var shadow = Object.create(Object.getPrototypeOf(obj) || null, {});

  var strDesc = Object.getOwnPropertyDescriptor(obj, "toString");
  var vDesc = Object.getOwnPropertyDescriptor(obj, "valueOf");
  Object.defineProperties(shadow, {
    "toString": {
      enumerable: strDesc ? strDesc.enumerable : false,
      configurable:true,
      writable:true,
      value: () => obj.toString()
    },
    "valueOf": {
      enumerable: vDesc ? vDesc.enumerable : false,
      configurable:true,
      writable:true,
      value: function() {
        var vobj = obj.valueOf();
        return vobj.__proxy || vobj;
      }
    }
  });

  var proxy = new Proxy({}, {
    getPrototypeOf: function(st) {
      return Object.getPrototypeOf(obj);
    },
    setPrototypeOf: function(st, p) {
      Object.setPrototypeOf(st, p);
      return Object.setPrototypeOf(obj, p);
    },
    isExtensible: function(st) {
      return Object.isExtensible(obj);
    },
    preventExtensions: function(st) {
      Object.preventExtensions(st);
      return Object.preventExtensions(obj);
    },
    getOwnPropertyDescriptor: function(st, name) {
      if (name === "__proxy")
        return null;
      var d = Object.getOwnPropertyDescriptor(obj, name);
      if (d)
        d.configurable = true;
      return d;
    },
    defineProperty: function(st, name, desc) {
      return Object.defineProperty(obj, name, desc);
    },
    has: function(st, name) {
      if (name === "__proxy")
        return false;
      return (name in obj);
    },
    get: function(st, name) {
      if (custom.get && custom.get.hasOwnProperty(name))
        return custom.get[name](obj, proxy, name);
      if (custom.get && custom.get.__aIndex && /^\d+$/.test(name))
        return custom.get.__aIndex(parseInt(name), obj, proxy, name);

      switch (name) {
        case "__direct":
          return obj;
        case "__proxy":
          return undefined;
        case "toString":
          return shadow.toString;
        case "valueOf":
          return shadow.valueOf;
      }

      var got = obj[name];

      if (isNativeFunction(got)) {
        return got.bind(obj);
      }
      return got;
    },
    set: function(st, name, value) {
      if (custom.set && custom.set.hasOwnProperty(name)) {
        custom.set[name](value, obj, proxy, name);
        return true;
      }

      if (name === "__proto__") {
        st.__proto__ = value;
        return true;
      }

      obj[name] = value;
      return true;
    },
    deleteProperty: function(st, name) {
      return (delete obj[name]);
    },
    enumerate: function(st) {
      var ret = [];
      for (var v in obj)
        ret.push(v);
      return ret.filter(n => n !== "__proxy")[Symbol.iterator]();
    },
    ownKeys: function(st) {
      return Object.getOwnPropertyNames(obj).filter(n => n !== "__proxy");
    }

  });

  Object.defineProperty(obj, "__proxy", {value: proxy, configurable: true});
  Object.defineProperty(obj, "__shadow", {value: shadow, configurable: true});  
  return proxy;
};

var mkSrcMap = f => "//# sourceURL=child_" + f;

/* Although the extension tries to insert the filtering runtime in all pages
 * by adding scripts to HTML responses, some frames are not generated by an
 * HTML response (e.g. blank iframe). This manually injects the runtime. */
exports.putRuntime = function(w) {
  if (w.__window) {
    console.log("__window already exists");
    return;
  }
  // recycle existing emscripten module
  w.p1FastMatch = p1FastMatch;
  if (dxfExt.config.minify) {
    var dxf = dxfExt.getFile("dxf.min.js");
    w.eval(dxf + mkSrcMap("dxf.min.js"));
  } else {
    ["matcher.web.js", "rewriter.web.js", "utils.web.js", "setup.web.js"].forEach(function(f) {
      var file = dxfExt.getFile(f);
      w.eval(file + mkSrcMap(f));
    });
  }
  console.log("Inserted runtime", w.location);
};


var unescapeLoop = function(src) {
  var prev, cur = src;
  do {
    prev = cur;
    cur = unescape(entities.decode(cur));
  } while (prev !== cur);
  return cur;
};
// TODO: trimmer like in the C++ version

var filter_regex = /^[\w-\?#$]+$/;
var param_regex = /[(\?|\&)]([^=]+)\=([^&#]+)/g;

/* Returns the list of sourceName/sourceValue pairs that can influence the
 * sink at the time this function is called */
var getSources = exports.getSources = function() {
  dxfStack++;
  try {
    // TODO: cache some of this work
    var allSources = {
      "document.URL": document.URL,
      "location.hash": location.hash.substr(1),
      "location.search": location.search.substr(1),
      "location.pathname": location.pathname.substr(1),
      "document.cookie": document.cookie,
      "document.referrer": document.referrer,
      "window.name": window.name,
    };
    param_regex.exec_loop(location.search, m => { allSources[m[1]] = m[2]; });
    allSources = allSources.oFilter((k,p) =>
      p.length >= 6 && !filter_regex.test(p) &&
      (k === "document.URL" || sources[k] === true)
    );
    if (sources.parent) {
      var parentSources = parent.dxf.getSources().oMap((k,v) => ["parent__" + k, v]);
      Object.assign(allSources, parentSources);
    }
    return allSources.oMap((k,v) => [k, unescapeLoop(v)]);
  } finally {
    dxfStack--;
  }
};

/* Executes function f for every match on every valid source */
var matchSources = function(s, f) {
  getSources().oForEach(function(k, p) {
    p1FastMatch(p, s).forEach(([b, e]) => f(k, b, e));
  });
};

var notifyAttack = function(vector, source, code) {
  var msg = `DOM-Based XSS Attack using ${source} (${vector}): ${code}`;
  // only block execution if cfg.enforce is true
  if (dxfExt.config.enforce)
    throw new Error(msg);
  else
    console.warn(msg);
};


// these are similar to those in rewriter.js, but they have been modified to extract more parts
var script_regex = /(<script(?:(?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*>)([^]*?)(<\/script[^>]*>)/igm;
var evel_regex = /(<[-a-z0-9_\:]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*(?:\s+on\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)))+(?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/igm;
var attr_regex = /(on[a-z]+)(?:(\s*=\s*)(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/ig;

/*
Vectors: document.write, element.innerHTML
Policy: find script tags (only for document.write) and event handlers.
Insertion of new JavaScript code is not allowed.
Matches inside script tags are allowed as long as they stay within strings.
Quick Filtering: [\w-] (is this correct?)
Examples:
- location.hash = "'><script>alert(1)</scr#pt>", document.write("<div id='" + location.hash + "'></div>")
<div id=''><script>alert(1)</scr#pt>'></div> => p is location.hash. found a match, it include the outer bound of a script, flag as attack
- location.hash = "'><script src='evil.com'></scr#pt>"
- location.href = "http://www.a.com/?b=<script>alert(1)</scr#pt>", document.write("Current URL: " + document.location)
- location.hash = "); alert(1", node.innerHTML = "<img onload='loaded(" + location.hash) + ")' />"
- location.hash = "3pz"
*/

// TODO: trimming

// TODO: this version is vulnerable to browser quirks.
// in the case of docwrite, it might not even be a complete tag
exports.checkHTMLSink = function(html, canInjectTags = true) {
  dxfStack++;
  try {
    matchSources(html, function(name, beg, end) {
      if (canInjectTags)
        script_regex.exec_loop(html, function(m) {
          // console.log("script_regex", m);
          var jsBeg = m.index + m[1].length;
          var jsEnd = jsBeg + m[2].length;
          var js = m[2];
          var jsm = new Matcher(js, false);
          if (!jsm.isWithin(Math.max(0,beg-jsBeg), Math.min(jsEnd-jsBeg,end-jsBeg)))
            throw new Error("DOM-Based XSS Attack using " + name + " (checkHTMLSink/inline): " + js.substring(beg-jsBeg, end-jsBeg));
        });
      // for each tag, find the ones with an event handler
      evel_regex.exec_loop(html, function(m) {
        var attrOffset = m.index + m[1].length;
        // for each ev handler attribute, extract the js value
        attr_regex.exec_loop(m[2], function(m) {
          var code = m[3] || m[4] || m[5];
          var sep = (m[3] && '"') || (m[4] && "'") || "";
          var jsBeg = attrOffset + m.index + m[1].length + m[2].length + sep.length;
          var jsEnd = jsBeg + code.length;
          // now run checkJSSink on those, shifting the offsets properly
          // console.log("attr", html.substring(jsBeg, jsEnd), html.substring(beg, end));
          var js = entities.decode(code);
          var jsm = new Matcher(js, false);
          if (!jsm.isWithin(Math.max(0,beg-jsBeg), Math.min(jsEnd-jsBeg,end-jsBeg)))
            throw new Error("DOM-Based XSS Attack using " + name + " (checkHTMLSink/event): " + js.substring(beg-jsBeg, end-jsBeg));
        });
      });
    });
  } finally {
    dxfStack--;
  }
};

/*
Vectors: Function, setTimeout, setInterval, script.text, script.textContent, eval
Policy: find string boundaries, matches need to be within strings.
Quick Filtering: TODO
*/
exports.checkJsSink = function(js) {
  dxfStack++;
  try {
    var m = new Matcher(js, false);
    matchSources(js, function(name, beg, end) {
      if (!m.isWithin(beg, end-beg)) // no xss when matching within strings
        notifyAttack("checkJSSink", name, js.substring(beg, end));
    });
  } finally {
    dxfStack--;
  }
};


var getSafeIndex = function(pURL) {
  var rest = pURL.pathname + pURL.search + pURL.hash;
  return pURL.href.length - rest.length + 1;
};

var hostCache = {};

// TODO: minimum length filtering, only one minimum is enforced in p1utils.js
exports.checkURLSink = function(url, loadsJS = true) {
/*
Vectors: script.src, location/location.href (TODO: a.href, form.action)
Possible refinement: allow matches in strings in javascript: URLs.
*/
  dxfStack++;
  try {
    var pBase = new URL(document.baseURI);
    var pURL = new URL(url, document.baseURI);
    var domain = tld.getDomain(pURL.hostname);
    var bDomain = tld.getDomain(pBase.hostname);
    if (domain === bDomain)
      return; // no same-origin xss
    if (pURL.protocol !== "javascript:" && loadsJS === false)
      return; // javascript: is required for some vectors
    if (hostCache[domain] === true)
      return;
    if (hostCache[domain] === false)
      throw new Error("DOM-Based XSS Attack (host already in cache): " + url);
    matchSources(url, function(name, beg, end) {
      var safeIndex = getSafeIndex(pURL);
      if (beg < safeIndex) {
        hostCache[domain] = false;
        throw new Error("DOM-Based XSS Attack using " + name + " (checkURLSink): " + url);
      } else
        hostCache[domain] = true;
        return;
    });
  } finally {
    dxfStack--;
  }
};
