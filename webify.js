var fs = require("fs");
var {argv,stdout,exit} = require("process");

function webify(src) {
  src = src.replace(/require\(\"(.*?)\"\)/g, function(match, name) {
    if (!stubs[name])
      exit(-1);
    return stubs[name];
  })
  src = src.split("\n").map(l => "  " + l).join("\n");
  return "(function() {\n" + src + "\n})();\n";
}

var stubs = {
  fs: "{ a: 1}",
  process: "{a: 5}"
};

var input = fs.readFileSync(argv[1], "utf-8");
stdout.write(webify(input));
