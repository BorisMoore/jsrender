/*global test, equal, module, ok*/
(function(global, $, undefined) {
"use strict";

module("browserify");

test("browserify tests all run", function() {
	equal(JSON.stringify(browserify.done),
	'{"one":true,"two":true,"three":true,"html":true,"htm":true}',
	"Browserify tests succeeded");
});

})(this, this.jQuery);
