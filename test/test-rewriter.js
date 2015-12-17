var assert = require("assert");
var fs = require("fs");

rewriter = require("../extension/rewriter");
var Matcher = require("../extension/matcher").Matcher;

var testAll = function(data, f) {
  data.forEach(function([i,eo]) {
    if (eo === null)
      eo = i;
    var ro = f(i);
    assert.equal(ro, eo);
  });
}

// input -> expected output
// null -> input == expected output

describe("rewriter.js.rewrite", function() {
  describe("simple", function() {
    it("should have matching input and output", function() {
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
        ["this;this;this;this;\"a+window+a\"", "__pthis(this);__pthis(this);__pthis(this);__pthis(this);\"a+window+a\""],
        ["window.a // window\nwindow.a\n", "__window.a // window\n__window.a\n"]
      ];
      testAll(data, rewriter.js.rewrite);
    });
  });

  describe("regex", function() {
    it("should have matching input and output", function() {
      var data = [
        ["/hello;window/;", null],
        ["2/2;window;a/3;", "2/2;__window;a/3;"],
        ["2/4;/ab[z\\]q/d]s;/; window.a; a/2", "2/4;/ab[z\\]q/d]s;/; __window.a; a/2"]
      ];
      testAll(data, rewriter.js.rewrite);
    });
  });

  describe("window as key", function() {
    it("should have matching input and output", function() {
      var data = [
        ["var a = {\nb: 2,\nwindow: 4\n}", null],
        ["var a = {\nb: 2,\nwindow : 4\n}", null],
        ["\"object\" == typeof window ? window: f", "\"object\" == typeof __window ? __window: f"],
        ["\"object\" == typeof window ? window : f", "\"object\" == typeof __window ? __window : f"]
      ];
      testAll(data, rewriter.js.rewrite);
    });
  });

  describe("eval", function() {
    it("should have matching input and output", function() {
      var data = [
        ["eval(\"window\")", "eval(__peval(\"window\"))"],
        ["var q = eval('2+2')", "var q = eval(__peval('2+2'))"],
        ["var $eval = eval(\"2\");\nvar b = 2;", "var $eval = eval(__peval(\"2\"));\nvar b = 2;"],
        ["var a = safe_eval(2)", null],
        ["return eval('(' + data + ');');", "return eval(__peval('(' + data + ');'));"],
        ["eval(c()[1])[0]", "eval(__peval(c()[1]))[0]"],
        ['eval("(function() {return " + ("(" + d + ")") + ";})()");', 'eval(__peval("(function() {return " + ("(" + d + ")") + ";})()"));'],
        ['_eval(button, button.handler);', null],
        ['eval(("".replace(/)))))) {p("g"))', '__indirectEval(("".replace(/)))))) {p("g"))'],
      ];
      testAll(data, js => rewriter.js.patchEval(rewriter.js.rewrite(js)));
    });
  });

  describe("big files", function() {
    it("should load big files successfully", function() {
      var data = fs.readFileSync("samples/all.js", "utf-8");
      data = rewriter.js.rewrite(data);
      assert(data.substr(0, 300).indexOf("__window") > -1, data.substr(0, 300));
      data = fs.readFileSync("samples/richmedia.js", "utf-8");
      data = rewriter.js.rewrite(data);
    });
  });
});



describe("rewriter.html.rewriteScripts", function() {
  it("should rewrite all scripts found in html", function() {
    var data = [
      [" <script>a=1</script> ", null],
      ["\t\n<br />\n  <script>\n  window.a;\n  document;\n   </script>", "\t\n<br />\n  <script>\n  __window.a;\n  __document;\n   </script>"],
      ["<script >a=\"<script>\";window=3</script>", "<script>a=\"<script>\";__window=3</script>"],
      ["<script gino=3>window.b = '</scri'+'pt>';</script>", "<script gino=3>__window.b = '</scri'+'pt>';</script>"],
      ["<a qqq onload=\"document[&quot;window&quot;+window]\">hi</a>", "<a qqq onload=\"__document[&quot;window&quot;+__window]\">hi</a>"],
      ["<a href=\"reflected.php?body=<script>alert(1)</script>\">Inline Script</a><br>", null],
      ["<a href=\"reflected.php?body=<img src=&quot;fsgf&quot; onerror=&quot;alert(1)&quot;/>\">Img OnError</a><br>", null],
      ["<a href=\"dombased.php?sink=innerHTML#<img src=&quot;http://sdfgofgd.net/&quot; onerror=&quot;alert(1)&quot;>\">node.innerHTML</a>", null]
    ];
    testAll(data, s => rewriter.html.rewriteScripts(s, rewriter.js.rewrite));
  });
});

describe("matcher", function() {
  it("should tokenize the sample file correctly", function() {
    var data = fs.readFileSync("samples/regexes.js", "utf-8");
    var matcher = new Matcher(data, false);
    var matches = matcher.getMatches();
    var ematches = fs.readFileSync("samples/regexes-split.js", "utf-8").split("\n\n");
    assert.equal(matches.length, ematches.length, "Match length mismatch");
    var zipped = matches.map((m, i) => [m, ematches[i]]);
    zipped.forEach(([m, e]) => assert.equal(m, e, "Match mismatch"));
  });
});
