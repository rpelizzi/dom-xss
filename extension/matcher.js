/* jshint node: true */

/*
This module does two things:
1) Extracts the position of all the string literals, regular expressions
   and comments in a javascript file.
2) Provides an object to quickly ask whether a position in the same file is
   within these indexes. Subsequent calls to isWithin must have an increasing
   offset.
*/


// multi-line comments
// inline comments
// double and single quoted strings (escaping supported by skipping char after \)
// regexp
//   escaping supported by skipping char after \
//   also support heuristic for detection of regex vs dividend (set of symbols or "return" token preceding the expression)
//   also supports unescaped / in brackets
//   also lookahead to make sure the beginning is not /* (conflict with multi-line comment)
var lit_regex = /(?:\/\*(?:\*(?!\/)|[^\*])*\*\/|\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|((?:^|return|[\{\(\*&\^%\!\/\-+=~\|\[<>\:;\?\,])\s*)(?:\/(?!\*|\/)(?:\[(?:\\.|[^\]])*\]|\\.|[^\/])*\/[a-z]{0,3}))/gm;


// shouldFilter = false is only for testing so far.
var Matcher = function(src, shouldFilter = true) {
  this.src = src;

  var match, indexes = [];
  while (match = lit_regex.exec(src)) {
    if (shouldFilter) {
      if (match[0].length < 6)
        continue;
      // TODO: can this test be inserted into the regexp?
      if (!/window|document|location|this|eval/.test(match[0]))
        continue;
    }
    var shift = (match[1] && match[1].length) || (match[2] && match[2].length) || 0;
    indexes.push([match.index+shift, match.index+match[0].length-1]);
  }
  lit_regex.lastIndex = 0;

  this.ixs = indexes;
  this.cur = 0;
  this.done = this.ixs.length === 0;
};

Matcher.prototype = {
  isWithin: function(offset, len = 0) {
    if (this.done)
      return false;
    if (offset < this.ixs[this.cur][0])
      return false;
    else if (offset >= this.ixs[this.cur][0] && (offset + len) <= this.ixs[this.cur][1])
      return true;
    else { // > ixs[cur][1]
      this.cur++;
      if (this.cur === this.ixs.length)
        this.done = true;
      return this.isWithin(offset, len);
    }
  },
  reset: function() {
    this.done = this.ixs.length === 0;
    this.cur = 0;
  },
  getMatches: function() {
    return this.ixs.map(([b, e]) => this.src.substring(b, e+1)); 
  },
  print: function() {
    this.getMatches().forEach(console.log);
  }
};

exports.Matcher = Matcher;
