web_src = extension/data/p1.* extension/data/setup.js extension/data/utils.js extension/data/dxf.min.js extension/matcher.js extension/rewriter.js
ext_src = extension/*.js
p1_src  = nlearn/Makefile nlearn/*.cpp nlearn/*.h
all_src = $(web_src) $(ext_src) $(p1_src)

node_es6 = node --es_staging --harmony_destructuring

all: $(all_src)

extension/data/p1.js extension/data/p1.min.js: $(p1_src)
	make -C nlearn
	cp nlearn/p1.js extension/data/p1.js
	cp nlearn/p1.min.js extension/data/p1.min.js


extension/data/rewriter.web.js extension/data/matcher.web.js extension/data/utils.web.js extension/data/setup.web.js: extension/rewriter.js extension/matcher.js extension/data/setup.js extension/data/utils.js
	cd extension; \
	$(node_es6) ../webify.js rewriter rewriter.js > data/rewriter.web.js; $(node_es6) ../webify.js matcher.js > data/matcher.web.js

extension/data/dxf.min.js: extension/data/rewriter.web.js extension/data/matcher.web.js extension/data/setup.js extension/data/utils.js
	cat $^ | babel | uglifyjs > dxf.min.js

clean:
	rm -rf extension/data/p1.*
	rm -rf extension/data/*.web.js
	rm -rf extension/data/dxf.*
	rm -rf extension/bootstrap.js extension/install.rdf *.xpi
	rm -rf dxf.xpi

xpi: $(all_src)
	cd extension; jpm xpi; mv *.xpi ../dxf.xpi

post: $(all_src)
	cd extension; jpm post --post-url http://localhost:8889/

watch: $(all_src)
	node localserver.js & \
	while true; do \
		inotifywait -e modify extension/data/setup.js extension/data/utils.js extension/*.js && \
		make post; \
	done

lint:
	cd extension; jshint *.js; cd data; jshint setup.js utils.js

run: $(all_src)
	node localserver.js &
	firefox

test:
	cd test; mocha --harmony_destructuring --harmony_default_parameters test-rewriter.js 


.PHONY: run lint xpi clean watch test