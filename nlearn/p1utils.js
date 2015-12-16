(function() {
  "use strict";
  var MIN_LENGTH = 5; // global minimum match length
  var _p1 = Module['cwrap']('p1FastMatch', 'pointer', ['string', 'string']);
  var _p1FastMatch = function(p, s) {
    var ptr = _p1(p, s);
    var length = Module['getValue'](ptr, 'i32');
    var arr;
    if (length === 0)
      arr = [];
    else if (length === 2)
      arr = [[Module['getValue'](ptr+4, 'i32'), Module['getValue'](ptr+8, 'i32')]];
    else {
      var tarr = new Int32Array(Module['HEAPU32'].buffer, ptr+4, length);
      arr = [];
      for (var i = 0; i < tarr.length / 2; i++)
        arr[i] = [tarr[i*2], tarr[i*2+1]];
    }
    Module['_free'](ptr);
    return arr;
  };
  window['p1FastMatch'] = function(p, s) {
    if (p.length < MIN_LENGTH || s.length < MIN_LENGTH)
      return [];
    if (p.length <= s.length)
      return _p1FastMatch(p, s).filter(function(m) {
        m[1]-m[0] > MIN_LENGTH; // +1?
      });
    var matches = _p1FastMatch(s, p);
    if (matches.length > 0)
      return [[0, s.length]];
    else
      return [];
  };
})();
