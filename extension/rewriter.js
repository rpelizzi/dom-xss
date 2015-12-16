/*globals exports: false */
/* jshint node: true */

var entities = require("html-entities").AllHtmlEntities;
var Matcher = require("./matcher").Matcher;

Object.defineProperty(String.prototype, "splice", {
  value: function(idx, rem, s) {
    return this.slice(0,idx) + s + this.slice(idx + Math.abs(rem));
  }
});

exports.html = {};
exports.js = {};

// uses lookahead to avoid intersecting matches.
// it would use lookbehind too if js had it.
// the only non-lookahead forward match we do is \s*:, we use it together
// with \?\s* at the beginning to differentiate between "{window: a}" and "a?window:b"
var wdt_regex = /(\?\s*|[^\w\$\.\"\']|^)(window|document|location|top|this)(\s*:|(?![\w\$\"\']))/g;
// definitely incomplete, that's what the dbgEvalSearch is for
// there is a repetition in there to support one level of nested parentheses (plus another level of empty nested parens)
var eval_regex = /([^\w\$\.\"\']|^)eval\(((?:'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|[^'"\(\)\/]|\((?:'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\(\)|[^'"\(\)\/])*\))+)\)/g;
exports.js.rewrite = function(src) {
  var matcher = new Matcher(src);
  src = src.replace(wdt_regex, function(match, b, kw, colon, offset, curSrc) {
    if (matcher.isWithin(offset+b.length))
      return match;
    if (kw === "this") {
      if (b === " " && curSrc.substring(offset-3,offset) === 'new')
        return b + "(__pthis(this))" + colon;
      return b + "__pthis(this)" + colon;
    } else {
      if (colon && !/\?\s*/.test(b))
        return match;
     return b + "__" + kw + colon;
   }
  });
  // TODO: eventually merge the two regexes for performance and to avoid recreating the matcher
  matcher = new Matcher(src);
  src = src.replace(eval_regex, function(match, b, arg, offset) {
    if (matcher.isWithin(offset+b.length))
      return match;
    return b + "eval(__peval(" + arg + "))";
  });
  return src;
};

// src map conflicts with error reporting
var srcmap_regex = /^\s*\/\/(#|@)\s*sourceMappingURL.*$/gm;
exports.js.removeSrcMap = function(src) {
  return src.replace(srcmap_regex, "");
};

var iframeCheck = `
if (window.__window === undefined) {
  console.log("HACK: missing setup.js", document.location, document.referrer);
}\n`;
exports.js.addIframeCheck = function(src) {
  return iframeCheck + src;
};

// checks how many unmodified evals are left after the transformation
var nopeval_regex = /([^\w\$\.\"\']|^)eval\((?!__peval)/g;
exports.js.patchEval = function(src) {
  var matcher = new Matcher(src);
  src = src.replace(nopeval_regex, function(match, b, offset) {
    if (matcher.isWithin(offset+b.length))
      return match;
    //console.log("MISSING EVAL", src.substr(offset, 100));
    // TODO: if this happens often enough, there is another way. take the
    // matcher again (this time do not filter anything) and now you can skip
    // anything except for closed and open parentheses, stopping at a
    // balanced number.
    // eval_src = src.substring(offset+b.length);
    // var count = 0;
    // do {
    //   match = paren_regex.exec(src);
    //   if (matcher.isWithin(match.index+offset))
    //     continue;
    //   if (match === "(")
    //     count++;
    //   else
    //     count--;
    // } while (count !== 0)
    // this works also for jate's more complex transformations i think
    // the other option is to just let the eval go untransformed. indirect eval can cause errors.
    return b + "__indirectEval(";
  });
  return src;
};


function findTag(html, tagName) {
  var m = html.substr(0,1000).match(new RegExp("<" + tagName + "[^>]*>", 'i'));
  return m && (m.index + m[0].length);
}

exports.html.addFirst = function(html, src) {
  var eIndex = findTag(html, "head") || findTag(html, "!doctype") ||
    findTag(html, "html") || findTag(html, "/title");
  if (eIndex)
    return html.splice(eIndex, 0, src);
  else {
    console.log("weird page without head or html tag", html.substr(0,200));
    return src + html; // give up guessing, weird page
  }
};

// the following regexes are based on HTMLParser.js

// this one is based on the generic tag, fixes the tag name and also captures the script content
var script_regex = /<script((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*>([^]*?)<\/script[^>]*>/igm;
// this abomination is just the basic tag regex with the attribute part repeated 3 times,
// where the middle one is a mandatory on* attribute with a mandatory value.
var evel_regex = /<([-A-Za-z0-9_\:]+)((?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*(?:\s+on\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)))+(?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/igm;
// and then we replace the correct attribute, using HTMLParser's regex
var attr_regex = /([-A-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;

exports.html.rewriteScripts = function(src, jsf) {
  src = src.replace(script_regex, function(script, rest, code) {
    // TODO: skip non-js content types
    return "<script" + rest + ">" + (code === "" || code === "\n" ? code : jsf(code)) + "</scr" + "ipt>";
  });
  src = src.replace(evel_regex, function(script, tagName, rest, unary) {
    
    rest = rest.replace(attr_regex, function(match, name) {
      name = name.toLowerCase();
      var value = arguments[2] ? arguments[2] :
        arguments[3] ? arguments[3] :
        arguments[4] ? arguments[4] : null;
      if (name.startsWith("on") && value) {
        value = entities.decode(value);
        value = value.replace(/^javascript:/, ""); // useless, messes with our rewriting
        value = jsf(value);
        value = entities.encode(value);
        return name + "=\"" + value.replace(/\n/g, " ") + "\"";
      }
      return match;
    });

    return "<" + tagName + rest + (unary ? "/" : "") + ">";

  });
  return src;

};

