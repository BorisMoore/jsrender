/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

QUnit.module("Browserify - client code");

test("No jQuery global: require('jsrender')($)", function() {
	// ............................... Hide QUnit global jQuery .................................
	var jQuery = global.jQuery;
	global.jQuery = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	var $jq = require('jquery');
	var jsrender = require('../../')($jq); // Provide jQuery, so jsrender === $jq is local jQuery namespace

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/name-template.html')(jsrender); // Provide jsrender

	var result = tmpl(data);

	result += " " + (jsrender !== jQuery);

	// ............................... Assert .................................
	equal(result, "Name: Jo (name-template.html) true", "result");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
});

})();
