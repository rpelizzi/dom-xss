/*
Usage: babel-node webify.js js_file

Thin wrapper for node stuff so that simple node modules can run in the browser.
Compared to browserify, there is no support for static resolution and ordering:
every module must be imported with a script tag after all of its dependencies,
and require errors will happen at runtime.

The stubs are read from webify.json (hardcoded for now).

The name of the module is just the filename stripped of the extension.
Require will ignore paths, so it will fail if two modules have the same
name.

The first blank line in the file is stripped so line numbers match without a
sourcemap.
*/

var fs = require("fs");
var {argv,stdout,exit} = require("process");
var path = require("path");

var filename = argv[2];
var stubs = JSON.parse(fs.readFileSync("webify.json", "utf-8"));
var src = fs.readFileSync(filename, "utf-8");
var name = path.parse(filename).name;

var prelude = `
if (!window.__require) {
  window.__requireCache = {};
  window.__require = function(n) {
    return __requireCache[n.split("/").reverse()[0]] || (() => { throw new Error("Module " + n + " not found");})();
  };
}`;

var rem = false; // remove first blank line
src = src.replace(/require\(\"(.*?)\"\)/g, (match, name) => stubs[name] || match);
src = src.split("\n").filter(l => rem || l !== "" || !(rem = true)).map(l => "  " + l).join("\n");
src = `window.__requireCache["${name}"]=(function(require){var module={exports:{}},exports=module.exports,global=window;
${src}
  return module.exports;
})(__require);
`;

stdout.write(prelude.replace(/\n/g, "")+src);
