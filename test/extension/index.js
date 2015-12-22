var prefs = require("sdk/preferences/service");
var system = require("sdk/system");
var timers = require("sdk/timers");


var {Navigator} = require("addon-navigate");

var input = ["http://localhost/dom-xss/test/examples/dombased.php?sink=eval#alert('xss');"];
// var input = ["http://www.yahoo.com"]; //, "http://yahoo.com"];

var config = {
  wait: 2, // wait for the other extension to start
  ignoreFirst: 1 // remove first N time samples
};

function processHalf(h) {
  if (h.processed)
    return; // do not process twice
  h.processed = true;
  h.times = h.times.slice(config.ignoreFirst);
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

timers.setTimeout(function() {
  var n = new Navigator(input, {times: 4}, {
    extraProperties: function(site) {
      site.on.attack = false;
      if (site.off)
        site.off.attack = false;
    },
    extraGlobals: function(w, cloner) {
      w.onerror = msg => {
        if (msg.includes("DOM-Based XSS"))
          this.half.attack = true;
        else
          this.half.jsErrors.push(msg); // we could call the original handler
      };
    },
    doOff: function() { 
      prefs.set("security.dxf.rewrite", false);
    },
    doOn: function() {
      prefs.set("security.dxf.rewrite", true);
    },
    end: function() {
      this.doOn(); // reset
      this.sites.forEach(processSite);
      console.log("end", this.sites);
      // system.exit(0);
    }
  });
  n.start();
}, config.wait * 1000);