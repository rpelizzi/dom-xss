var server = require('http').createServer();
var buffet = require('buffet')("extension/data/");

server.on("request", function (req, res) {
  buffet(req, res, function () {
    buffet.notFound(req, res);
  });
});

server.listen(8090);