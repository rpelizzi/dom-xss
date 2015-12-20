var prefs = require("sdk/preferences/service");
var system = require("sdk/system");

var {navigate} = require("addon-navigate");

var input = ["http://www.yahoo.com"]; //, "http://yahoo.com"];

var config = {
  ignoreFirst: 3,
  minSamples: 2,
  close: true
};

function processHalf(h) {
  h.times = h.times.slice(config.ignoreFirst);
  if (h.times.length < config.minSamples)
    return;
  console.log(h);
  h.min = Math.min.apply(null, h.times);
  h.max = Math.max.apply(null, h.times);
  var sum = h.times.reduce((acc, cur) => acc + cur, 0);
  var sumsqr = h.times.reduce((acc, cur) => acc + Math.pow(cur, 2), 0);
  h.avg = Math.round(sum / h.times.length);
  h.stddev = Math.round(Math.sqrt(sumsqr / h.times.length - Math.pow(h.avg, 2)));
}

function processSite(s) {
  console.log("ps", s);
  processHalf(s.on);
  processHalf(s.off);
  if (s.on.avg && s.off.avg)
    s.overhead = (s.on.avg - s.off.avg) / s.off.avg * 100;
}

navigate(input, {
  times: 8,
  errors: 1,
  random: true,
  doOff: true,
  timeout: 10,
  loadDelay: 0
}, {
  extraGlobals: function(w, cloner) {
    w.onerror = function(msg) {
      console.log("w error", msg);
    };
  },
  beforeOpen: function(site, which) {
    console.log("open", site, which);
  },
  beforeClose: function(site, which, tab, isTimeout) {
    console.log("close", site, which, isTimeout);
  },
  doOff: function() { 
    prefs.set("security.dxf.rewrite", false);
  },
  doOn: function() {
    prefs.set("security.dxf.rewrite", true);
  },
  end: function(sites) {
    this.doOn(); // reset
    sites.forEach(processSite);
    console.log("end", sites);
    if (config.close) {
      system.exit(0);
    }
  }
});