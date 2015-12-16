/*
Usage: webify module_name js_file
Thin wrapper for node stuff so that basic modules can run in the browser.
*/
var fs = require("fs");
var {argv,stdout,exit} = require("process");

// console.log(argv);

function webify(src) {
  src = src.replace(/require\(\"(.*?)\"\)/g, function(match, name) {
    if (!stubs[name])
      exit(-1);
    return stubs[name];
  })
  src = src.split("\n").map(l => "  " + l).join("\n");
  return `var ${argv[2]}=(function(){var module={exports:{}},exports=module.exports;
${src}
  return module.exports;
})();`
}

var stubs = {
  fs: "{ a: 1}",
  process: "{a: 5}"
};

var input = fs.readFileSync(argv[3], "utf-8");
stdout.write(webify(input));
