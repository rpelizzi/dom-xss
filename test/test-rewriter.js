var {rewriteJs, dbgEvalSearch, rewriteInlineJs, htmlAdd} = require("../rewriter");
var {Matcher} = require("../matcher");
var file = require("sdk/io/file");
var timers = require("sdk/timers");
var extData = require("sdk/self").data;

exports["test rewriter"] = function(assert) {
  // input -> expected output
  // null -> input == expected output
  var data = [
    ["aa \n window.a.bc", "aa \n __window.a.bc"],
    ["aa $window.a.bc", null],
    ["bf\ndf\nwindow.document", "bf\ndf\n__window.document"],
    [" $this this ", " $this __pthis(this) "],
    ["this.a; new this(qqq)", "__pthis(this).a; new (__pthis(this))(qqq)"],
    [" $this.this\na", null],
    ["\nvar a = $this+2", null],
    ["var document=window.document", "var __document=__window.document"],
    ["\n$\tdocument.write.window", "\n$\t__document.write.window"],
    ["a[\"window\"]", null],
    ["a[\"a;b;window.a = 2;\"]", null],
    ["\"a|b|c|this|document|window|location|z\".split(\"|\")", null],
    ["/hello;window/;", null],
    ["2/2;window;a/3;", "2/2;__window;a/3;"],
    ["2/4;/ab[z\\]q/d]s;/; window.a; a/2", "2/4;/ab[z\\]q/d]s;/; __window.a; a/2"],
    ["var a = {\nb: 2,\nwindow: 4\n}", null],
    ["var a = {\nb: 2,\nwindow : 4\n}", null],
    ["\"object\" == typeof window ? window: f", "\"object\" == typeof __window ? __window: f"],
    ["\"object\" == typeof window ? window : f", "\"object\" == typeof __window ? __window : f"],
    ["eval(\"window\")", "eval(__peval(\"window\"))"],
    ["var q = eval('2+2')", "var q = eval(__peval('2+2'))"],
    ["var $eval = eval(\"2\");\nvar b = 2;", "var $eval = eval(__peval(\"2\"));\nvar b = 2;"],
    ["var a = safe_eval(2)", null],
    ["return eval('(' + data + ');');", "return eval(__peval('(' + data + ');'));"],
    ["eval(c()[1])[0]", "eval(__peval(c()[1]))[0]"],
    ['eval("(function() {return " + ("(" + d + ")") + ";})()");', 'eval(__peval("(function() {return " + ("(" + d + ")") + ";})()"));'],
    ['_eval(button, button.handler);', null],
    ['eval(("".replace(/)))))) {p("g"))', '__indirectEval(("".replace(/)))))) {p("g"))'],
    // replace gives an offset relative to the original string,
    // so we can use the matcher as we substitute (but not after subsequent calls)
    ["this;this;this;this;\"a+window+a\"", "__pthis(this);__pthis(this);__pthis(this);__pthis(this);\"a+window+a\""],
    ["window.a // window\nwindow.a\n", "__window.a // window\n__window.a\n"]
  ];
  data.forEach(function([i, eo]) {
    if (eo === null)
      eo = i;
    var ro = dbgEvalSearch(rewriteJs(i));
    assert.ok(ro === eo, "JS Rewriter mismatch:\n\"" + eo + "\"\n!==\n\"" + ro + "\"\n");
  });
};

exports["test big file rewriter"] = function(assert, done) {
  var data = extData.load("samples/all.js");
  data = rewriteJs(data);
  assert.ok(data.substr(0, 300).indexOf("__window") > -1, data.substr(0, 300));
  data = extData.load("samples/richmedia.js");
  data = rewriteJs(data);
  done();
};

exports["test matcher"] = function(assert, done) {
  timers.setTimeout(function() {
    debugger;
    var data = extData.load("samples/regexes.js");
    var matcher = new Matcher(data, false);
    var matches = matcher.getMatches();
    var ematches = extData.load("samples/regexes-split.js").split("\n\n");
    assert.ok(matches.length === ematches.length, "Match lengths mismatch: " + matches.length + ", " + ematches.length);
    var zipped = matches.map((m, i) => [m, ematches[i]]);
    zipped.forEach(([m, e]) => assert.ok(m === e, "match mismatch:\n\"" + m + "\"\n!==\n\"" + e + "\"\n"));
    done();
  }, 500);
};

exports["test html rewriter"] = function(assert) {
  var data = [
    [" <script>a=1</script> ", null],
    ["\t\n<br />\n  <script>\n  window.a;\n  document;\n   </script>", "\t\n<br />\n  <script>\n  __window.a;\n  __document;\n   </script>"],
    ["<script >a=\"<script>\";window=3</script>", "<script>a=\"<script>\";__window=3</script>"],
    ["<script gino=3>window.b = '</scri'+'pt>';</script>", "<script gino=3>__window.b = '</scri'+'pt>';</script>"],
    ["<a qqq onload=\"document[&quot;window&quot;+window]\">hi</a>", "<a qqq onload=\"__document[&quot;window&quot;+__window]\">hi</a>"]
  ];
  data.forEach(function([i, eo]) {
    if (eo === null)
      eo = i;
    var ro = rewriteInlineJs(i, s => dbgEvalSearch(rewriteJs(s)));
    assert.ok(ro === eo, "Inline Rewriter mismatch:\n\"" + eo + "\"\n!==\n\"" + ro + "\"\n");
  });
}

// exports["test html adder"] = function(assert) {
//   var data = [
//     // nope not doing it until i export includedScript
//   ];
//   assert.pass();
//   data.forEach(function([i, eo]) {
//     if (eo === null)
//       eo = i;
//     var ro = htmlAdd(i);
//     assert.ok(ro === eo, "HTML Adder mismatch:\n\"" + eo + "\"\n!==\n\"" + ro + "\"\n");
//   });
// }


require("sdk/test").run(exports);
