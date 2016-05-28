/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

browserify.done.three = true;

QUnit.module("Browserify - client code");

var isIE8 = window.attachEvent && !window.addEventListener;

if (!isIE8) {

test("jQuery global: require('jsrender')", function() {
	// ............................... Hide QUnit global jQuery and any previous global jsrender.................................
	var jQuery = global.jQuery, jsr = global.jsrender;
	global.jQuery = global.jsrender = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	global.jQuery = require('jquery');
	var $jsr = require('../../'); // Uses global jQuery, so $jsr === global.jQuery is global jQuery namespace

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/name-template.html'); // Uses jsrender attached to global jQuery

	var result = tmpl(data);

	result += " " + ($jsr !== jQuery) + " " + ($jsr === global.jQuery);

	// ............................... Assert .................................
	equal(result, "Name: Jo (name-template.html) true true", "result: jQuery global: require('jsrender')");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
	global.jsrender = jsr; // Replace any previous global jsrender
});
}
})();
