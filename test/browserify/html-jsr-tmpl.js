/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

browserify.done.html = true;

QUnit.module("Browserify - client code");

test("jQuery global: require('jsrender')", function() {

	// ............................... Hide QUnit global jQuery .................................
	var jQuery = global.jQuery;
	global.jQuery = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	var jsrender = require('./../../')();

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/name-template.html')(jsrender); // Provide jsrender
	var tmpl2 = require('../templates/name-template.jsr')(jsrender); // Provide jsrender

	var result = tmpl(data) + " " + tmpl2(data);

	// ............................... Assert .................................
	equal(result, "Name: Jo (name-template.html) Name: Jo (name-template.jsr)", "result: jQuery global: require('jsrender') - html");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
});

})();
