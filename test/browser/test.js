function assert(cond, msg) {
  if (!cond)
    console.error("Assert failed", msg);
}

$(document).ready(function() {
  assert(window.location.toString() === window.__direct.location.toString(), "direct");
  eval("assert(window.__direct === window.window.self.__direct.__proxy.__direct, \"eval\")");
  $("body").append("<iframe src='about:blank' id='if' />");
  var w = $("#if")[0].contentWindow;
  w.document.write("<h1>Hi</h1><script>top.assert(window.location.href == window.top.location.href, \"location\");</script>");
  w.document.close();
  assert(Object.prototype.toString.call(window) === "[object Window]", "toString");
})