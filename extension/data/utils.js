/* globals __getFile: false, unwrap: false, Symbol: false */
/* jshint browser:true, esnext: true */

RegExp.prototype.exec_loop = function(str, f) {
  var m;
  try {
    while ((m = this.exec(str)) != null) {
        f(m);
    }
  } finally {
    this.lastIndex = 0;
  }
};


// copying semantics might be a bit different than Array conterparts
Object.defineProperties(Object.prototype, {
  oForEach: {
    value: function(f) {
      Object.keys(this).forEach(k => f(k, this[k]));
    }
  },
  oFilter: {
    value: function(f) {
      var obj = Object.assign({}, this);
      obj.oForEach((k, v) => { if (!f(k, v)) delete obj[k] });
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


(function() {
  "use strict";

  if (window.__window)
    return;

  var sources = {};
  var sinks = {};

  // prevent marking sources and sinks when running our own code
  var filterCode = false;

  var markSource = window.markSource = function(s) {
    if (filterCode)
      return;
    if (!sources[s]) {
      console.log("Source", s);
    }
    sources[s] = true;
  };

  var markSink = window.markSink = function(s) {
    if (filterCode)
      return;
    if (!sinks[s]) {
      console.log("Sink", s);
    }
    sinks[s] = true;
  };

  var wrap = window.wrap = o => o.__proxy || o;
  var unwrap = window.unwrap = o => o.__direct || o;

  var wrapGetter = window.wrapGetter = function(obj, prop, f) {
    var getter = obj.__lookupGetter__(prop);
    if (!getter)
      throw "Nope";
    // must be configurable, because document.open does not delete them
    Object.defineProperty(obj, "__get_" + prop, {value: getter, configurable: true});
    obj.__defineGetter__(prop, function() {
      return f(getter.bind(unwrap(this)), unwrap(this));
    });
    obj["__oldget" + prop] = getter;
  };

  var wrapSetter = window.wrapSetter = function(obj, prop, f) {
    var setter = obj.__lookupSetter__(prop);
    if (!setter)
      throw "Nope";
    Object.defineProperty(obj, "__set_" + prop, {value: setter, configurable: true});
    obj.__defineSetter__(prop, function(v) {
      f(v, setter.bind(unwrap(this)), unwrap(this));
    });
    obj["__oldset" + prop] = setter; 
  };

  window.autoUnwrap = function(obj, prop) {
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

  window.createProxy = function(obj, custom) {
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
  var setupEnv = window.setupEnv = function(_eval) {
    _eval(__getFile("p1.js") + mkSrcMap("p1.js"));
    _eval(__getFile("matcher.js") + mkSrcMap("matcher.js"));
    _eval(__getFile("utils.js") + mkSrcMap("utils.js"));
    _eval(__getFile("setup.js") + mkSrcMap("setup.js"));
  };


  var unescapeLoop = window.unescapeLoop = function(src) {
    var prev, cur = src;
    do {
      prev = cur;
      cur = unescape(__decodeEntities(cur));
    } while (prev != cur);
    return cur;
  }
  // TODO: trimmer like in the C++ version

  var filter_regex = /^[\w-\?#$]+$/;
  var param_regex = /[(\?|\&)]([^=]+)\=([^&#]+)/g;

  var getSources = window.getSources = function() {
    var allSources = {
      "document.URL": document.URL,
      "location.hash": location.hash.substr(1),
      "location.search": location.search.substr(1),
      "location.pathname": location.pathname.substr(1),
      "document.cookie": document.cookie,
      "document.referrer": document.referrer,
      "window.name": window.name,
    };
    param_regex.exec_loop(location.search, m => { allSources[m[1]] = m[2] });
    allSources = allSources.oFilter((k,p) =>
      p.length >= 6 && !filter_regex.test(p) &&
      (k === "document.URL" || sources[k] == true)
    );
    if (sources["parent"]) {
      var parentSources = parent.getSources().oMap((k,v) => ["parent__" + k, v]);
      Object.assign(allSources, parentSources);
    }
    return allSources.oMap((k,v) => [k, unescapeLoop(v)]);
  };

  var matchSources = function(s, f) {
    getSources().oForEach(function(k, p) {
      p1FastMatch(p, s).forEach(([b, e]) => f(k, b, e));
    });
  };

  // these are copied from rewriter.js
  var script_regex = /(<script((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*>)([^]*?)<\/script[^>]*>/im;
  var evel_regex = /<([-A-Za-z0-9_\:]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*(?:\s+on\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)))+(?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/igm;
  var attr_regex = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;


/*
Vectors: document.write, element.innerHTML
Policy: find script tags (only if canInjectTags) and event handlers
(either way), including outer/inner bounds.
Creation of new script tags or event handlers (i.e. match on outer boundary) is not allowed.
If the match is inside a script tag (inner boundary), find string boundaries. Matches inside
script tags are allowed as long as they stay within strings.
Quick Filtering: [\w-] (is this correct?)
Examples:
- location.hash = "'><script>alert(1)</script>", document.write("<div id='" + location.hash + "'></div>")
  <div id=''><script>alert(1)</script>'></div> => p is location.hash. found a match, it include the outer bound of a script, flag as attack
- location.hash = "'><script src='evil.com'></script>"
- location.href = "http://www.a.com/?b=<script>alert(1)</script>", document.write("Current URL: " + document.location)
- location.hash = "); alert(1", node.innerHTML = "<img onload='loaded(" + location.hash) + ")' />"
- location.hash = "3pz"
*/

// TODO: use DOMParser to verify that you are not being blindsided by scripts.
// how to deal with document.write? unlike innerHTML, it does not have to be well-formed.

  var checkHTMLSink = window.checkHTMLSink = function(html, canInjectTags = true) {
    filterCode = true;
    try {
      matchSources(html, function(name, beg, end) {
        if (canInjectTags)
          script_regex.exec_loop(html, function(m) {
            debugger;
          });
        evel_regex.exec_loop(html, function(m) {
          debugger;
        });
      });
    } finally {
      filterCode = false;
    }
  };

/*
Vectors: Function, setTimeout, setInterval, script.text, script.textContent, eval
Policy: find string boundaries, matches need to be within strings.
Quick Filtering: TODO
*/

  

  var checkJsSink = window.checkJsSink = function(js) {
    filterCode = true;
    try {
      var m = new Matcher(js, false);
      matchSources(js, function(name, beg, end) {
        if (!m.isWithin(beg, end-beg)) // no xss when matching within strings
          debugger;
          throw new Error("DOM-Based XSS Attack using " + name + " (checkJsSink): " + js.substring(beg, end+1));
      });
    } finally {
      filterCode = false;
    }
  };


  var getSafeIndex = function(pURL) {
    var rest = pURL.pathname + pURL.search + pURL.hash;
    return pURL.href.length - rest.length + 1;
  };

  var hostCache = {};

  // TODO: minimum length filtering, only one minimum is enforced in p1utils.js
  var checkURLSink = window.checkURLSink = function(url, loadsJS = true) {
  /*
  Vectors: script.src, location/location.href (TODO: a.href, form.action)
  Possible refinement: allow matches in strings in javascript: URLs.
  */
    filterCode = true;
    try {
      var pBase = new URL(document.baseURI);
      var pURL = new URL(url, document.baseURI);
      var domain = __getBaseDomainFromHost(pURL.hostname);
      var bDomain = __getBaseDomainFromHost(pBase.hostname);
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
          debugger;
          throw new Error("DOM-Based XSS Attack using " + name + " (checkURLSink): " + url);
        } else
          hostCache[domain] = true;
          return;
      });
    } finally {
      filterCode = false;
    }
  };


})();
