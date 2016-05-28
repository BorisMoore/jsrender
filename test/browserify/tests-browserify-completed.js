/*global test, equal, module, ok*/
(function(global, $, undefined) {
"use strict";

module("browserify");

var isIE8 = window.attachEvent && !window.addEventListener;

if (!isIE8) {

test("browserify tests all run", function() {
	equal(JSON.stringify(browserify.done),
	'{"one":true,"two":true,"three":true,"twelve":true,"html":true,"htm":true}',
	"Browserify tests succeeded");
});
}
})(this, this.jQuery);
