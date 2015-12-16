prod = extension/data/p1.js extension/data/p1.min.js extension/data/dxf.js extension/data/dxf.min.js

all: $(prod)

extension/data/p1.js: nlearn/Makefile nlearn/*.cpp nlearn/*.h
	make -C nlearn
	cp nlearn/p1.js extension/data/p1.js

extension/data/p1.min.js: nlearn/Makefile nlearn/*.cpp nlearn/*.h
	make -C nlearn opt
	cp nlearn/p1.min.js extension/data/p1.min.js

extension/data/dxf.js extension/data/dxf.js.map: extension/data/setup.js extension/data/utils.js extension/*.js
	cd extension/data; browserify -t brfs -d setup.js > dxf.js

extension/data/dxf.min.js: extension/data/setup.js extension/data/utils.js extension/*.js
	cd extension/data; browserify -t brfs -t [ babelify --presets [ es2015 ] ] setup.js | uglifyjs > dxf.min.js

clean:
	rm -rf extension/data/p1.*
	rm -rf extension/data/dxf.*
	rm -rf extension/bootstrap.js extension/install.rdf *.xpi
	rm -rf dxf.xpi

xpi: $(prod)
	cd extension; jpm xpi; mv *.xpi ../dxf.xpi

post: $(prod)
	cd extension; jpm post --post-url http://localhost:8889/

watch: $(prod)
	node localserver.js & \
	while true; do \
		inotifywait -e modify extension/data/setup.js extension/data/utils.js extension/*.js && \
		make post; \
	done

lint:
	cd extension; jshint *.js; cd data; jshint setup.js utils.js

run: $(prod)
	node fakeserver.js &
	firefox

test:
	cd test; mocha --harmony_destructuring --harmony_default_parameters test-rewriter.js 


.PHONY: run lint xpi clean watch test