/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

browserify.done.two = true;

QUnit.module("Browserify - client code");

var isIE8 = window.attachEvent && !window.addEventListener;

if (!isIE8) {

test("No jQuery global: require('jsrender')($)", function() {
	// ............................... Hide QUnit global jQuery and any previous global jsrender.................................
	var jQuery = global.jQuery, jsr = global.jsrender;
	global.jQuery = global.jsrender = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	var $jq = require('jquery');
	var $jsr = require('../../')($jq); // Provide jQuery, so $jsr === $jq is local jQuery namespace

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/name-template.html')($jsr); // Provide jsrender

	var result = tmpl(data);

	result += " " + ($jsr !== jQuery);

	// ............................... Assert .................................
	equal(result, "Name: Jo (name-template.html) true", "result: No jQuery global: require('jsrender')($)");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
	global.jsrender = jsr; // Replace any previous global jsrender
});
}
})();
