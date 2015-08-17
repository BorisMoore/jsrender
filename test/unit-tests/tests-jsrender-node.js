/*global test, equal, ok, QUnit*/
(function(undefined) {
"use strict";

QUnit.module("node");
test("$jsr.renderFile", function() {
	var $jsr = global.jsrender; //require('jsrender');
	var html = $jsr.renderFile('./test/templates/name-template.html', { name: "Jo" });
	equal(html, "Name: Jo (name-template.html)", "Correct loading and rendering");
});

})();
