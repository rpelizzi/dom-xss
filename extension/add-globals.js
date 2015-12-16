var events = require("sdk/system/events");
var {Cu} = require("chrome");

module.exports = function(f) {

  var observer = function(ev) {
    if (ev.data.indexOf("http") !== 0)
      return;
    var docWin = Cu.waiveXrays(ev.subject);
    return f(docWin, o => Cu.cloneInto(o, docWin));
  };

  events.on("content-document-global-created", observer, true);
  require("sdk/system/unload").when(function() {
    events.off("content-document-global-created", observer);
  });
};