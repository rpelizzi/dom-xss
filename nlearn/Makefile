all: p1.js p1.min.js

# -s TOTAL_STACK=2048 -s TOTAL_MEMORY=131072
p1.min.js: DistMetric.h DistMetric.cpp MatchRes.h p1.cpp p1utils.js Makefile
	emcc p1.cpp DistMetric.cpp -Oz -o p1.min.js --closure 1 -s EXPORTED_FUNCTIONS="['_p1FastMatch']" -s NO_EXIT_RUNTIME=1 -s NO_FILESYSTEM=1 -s NO_BROWSER=1 -s EXPORTED_RUNTIME_METHODS="['cwrap', 'setValue', 'getValue', '_free']" -s MODULARIZE=1 --memory-init-file 0 -s MEM_INIT_METHOD=2 -s INVOKE_RUN=0 -s DISABLE_EXCEPTION_CATCHING=1 --llvm-lto 1 --post-js p1utils.js
	echo "Module = Module({});" >> p1.min.js

p1.js: DistMetric.h DistMetric.cpp MatchRes.h p1.cpp p1utils.js Makefile
	emcc p1.cpp DistMetric.cpp -Wall -Wno-char-subscripts -o p1.js -s ASSERTIONS=2 -s SAFE_HEAP=1 -s EXPORTED_FUNCTIONS="['_p1FastMatch']" --post-js p1utils.js

clean:
	rm -rf p1.js p1.min.js
