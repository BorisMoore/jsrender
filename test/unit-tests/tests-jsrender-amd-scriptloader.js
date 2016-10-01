/*global test, equal, module, ok*/
(function(global, jQuery, undefined) {
"use strict";

function undefine() { // Undefine registered modules from previously run tests.
	require.undef("jsrender");
	require.undef("jquery");
	delete window.jQuery;
}

if (!window.attachEvent || window.addEventListener) { // Running RequireJS in qunit async test seems to fail in IE8

module("AMD Script Loader");

test("Loading JsRender, without jQuery, using RequireJS", function(assert) { 
	var done = assert.async(),
		jq = window.jQuery;
	undefine();
	console.log("1");


	require(["//www.jsviews.com/download/jsrender.js"], function($) { // Or point to correct local path for jsrender.js on your system
//	require(["../../download/jsrender.js"], function($) { // Or point to correct local path for jsrender.js on your system
		// Here $ is the global jQuery object, (jq - loaded by script block in page header, for QUnit)
		// If there was no global jQuery it would be the jsviews object - but no global would be created.

		var result = $.templates("Name: {{:name}}").render({name: "Jo"}) + " " + (!!$.jsrender);
		equal(result, "Name: Jo true", "JsRender Loaded");
		done();
	});
});

test("Loading JsRender and jQuery, without forcing load order, using RequireJS", function(assert) {
	var done = assert.async(),
		jq = window.jQuery;
	undefine();
	console.log("2");

// Note JsRender does not require jQuery - so its AMD definition does not specify jQuery dependency.

	require(["./unit-tests/requirejs-config"], function() {
		require(["jquery", "jsrender"], function($jq, $) {
			// Note: $ is either the jQuery loaded by RequireJS, or the window.jsrender object, depending on load order
			// Either way, it is the jQuery instance that has a $.views, $.templates etc.

			var result = $.templates("Name: {{:name}}").render({name: "Jo"}) + " " + ($ === $jq || !!$.jsrender);
			equal(result, "Name: Jo true", "JsRender Loaded");
			done();
		});
	});
});

test("Loading JsRender with jQuery, and force jQuery to load before JsRender, using RequireJS", function(assert) {
	var done = assert.async(),
		jq = window.jQuery;
	undefine();
	console.log("3");

// Note JsRender does not require jQuery - so its AMD definition does not specify jQuery dependency.
// So we will force loading order here by nesting require call for JsRender inside require call for jQuery.
// This is not optimized for loading speed.

	require(["./unit-tests/requirejs-config"], function() {
		require(["jquery"], function($jq) {
			require(["jsrender"], function($) {
				// Note: $ is a new instance of jQuery (=== $jq) loaded by RequireJS, not the instance loaded by script block in page header, for QUnit.

				var result = $.templates("Name: {{:name}}").render({name: "Jo"}) + " " + (jq !== $ && $ === window.jQuery && $ === $jq);
				equal(result, "Name: Jo true", "JsRender LoadedX");
				done();
			});
		});
	});
});

}
})(this, this.jQuery);
