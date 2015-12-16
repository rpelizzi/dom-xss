ext_files = extension/data/p1.js extension/data/p1.min.js extension/data/setup.web.js extension/data/utils.web.js \
 extension/data/matcher.web.js extension/data/rewriter.web.js \
 extension/data/dxf.min.js
p1_src = nlearn/Makefile nlearn/*.cpp nlearn/*.h nlearn/p1utils.js nlearn/Makefile
ext_src = extension/*.js extension/data/utils.js extension/data/setup.js
src = $(p1_src) $(ext_src)

node_es6 = node --es_staging --harmony_destructuring

all: $(ext_files)

extension/data/p1.js extension/data/p1.min.js: $(p1_src)
	make -C nlearn
	cp nlearn/p1.js extension/data/p1.js
	cp nlearn/p1.min.js extension/data/p1.min.js

extension/data/%.web.js: extension/%.js webify.json
	$(node_es6) webify $< > $@
extension/data/%.web.js: extension/data/%.js webify.json
	$(node_es6) webify $< > $@

extension/data/dxf.min.js: extension/data/rewriter.web.js extension/data/matcher.web.js extension/data/setup.web.js extension/data/utils.web.js
	cat $^ | babel | uglifyjs > extension/data/dxf.min.js

clean:
	rm -rf extension/data/p1.*
	rm -rf extension/data/*.web.js
	rm -rf extension/data/dxf.*
	rm -rf extension/bootstrap.js extension/install.rdf *.xpi
	rm -rf dxf.xpi

xpi: $(ext_files)
	cd extension; jpm xpi; mv *.xpi ../dxf.xpi

post: $(ext_files)
	cd extension; jpm post --post-url http://localhost:8889/

# broken if you modify nlearn
watch: $(ext_files)
	node localserver.js & \
	while true; do \
		inotifywait -e modify $(src) webify.json && \
		make post; \
	done

lint:
	cd extension; jshint *.js; cd data; jshint setup.js utils.js

run: $(ext_files)
	node localserver.js &
	firefox

test:
	cd test; mocha --harmony_destructuring --harmony_default_parameters test-rewriter.js 

.PHONY: run lint xpi clean watch test