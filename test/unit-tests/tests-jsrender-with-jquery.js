/*global test, equal, module, ok, QUnit, _jsv, viewsAndBindings */
(function(global, $, undefined) {
"use strict";

var isIE8 = window.attachEvent && !window.addEventListener;

function sort(array) {
	var ret = "";
	if (this.tagCtx.props.reverse) {
		// Render in reverse order
		for (var i = array.length; i; i--) {
			ret += this.tagCtx.render(array[ i - 1 ]);
		}
	} else {
		// Render in original order
		ret += this.tmpl.render(array);
	}
	return ret;
}

var person = { name: "Jo" },
	people = [{ name: "Jo" },{ name: "Bill" }],
	towns = [{ name: "Seattle" },{ name: "Paris" },{ name: "Delhi" }];

var tmplString =  "A_{{:name}}_B";

module("api");

test("templates", function() {
	equal($.templates("#my_tmpl2").render(), isIE8 ? "\n' \" \\ \\' \\\"" : "' \" \\ \\' \\\"", "correct treatment of ' \" and ' in template declared in script block");
	equal($.templates("' \" \\ \\' \\\"").render(), "' \" \\ \\' \\\"", "correct treatment of ' \" and ' in template compiled from string");

	$.templates("my_tmpl", tmplString);
	equal($.render.my_tmpl(person), "A_Jo_B", 'Compile a template and then render it: $.templates("my_tmpl", tmplString); $.render.my_tmpl(data);');

	$.templates({ myTmpl2: tmplString });
	equal($.render.myTmpl2(person), "A_Jo_B", 'Compile and register templates: $.templates({ "my_tmpl", tmplString, ...  }); $.render.my_tmpl(data);');

	equal($.templates.myTmpl2.render(person), "A_Jo_B", 'Get named template: $.templates.my_tmpl.render(data);');

	equal($.templates(tmplString).render(person), "A_Jo_B", 'Compile without registering as named template: $.templates(tmplString).render(person);');

	var tmpl2 = $.templates("#my_tmpl");
	tmpl2 = $.templates("#my_tmpl");
	equal($.trim(tmpl2.render(person)), "A_Jo_B", 'var tmpl = $.templates("#my_tmpl"); returns compiled template for script element');

	$.templates({
		my_tmpl3: {
			markup: "#my_tmpl"
		}
	});
	equal($.trim($.render.my_tmpl3(person)), "A_Jo_B", 'Named template for template object with selector: { markup: "#my_tmpl" }');

	var tmpl3 = $.templates("", {
		markup: "#my_tmpl"
	});
	equal($.trim(tmpl3.render(person)), "A_Jo_B", 'Compile from template object with selector, without registering: { markup: "#my_tmpl" }');

	var tmpl4 = $.templates({
		markup: "#my_tmpl"
	});
	equal($.trim(tmpl4.render(person)), "A_Jo_B", 'Compile from template object with selector, without registering: { markup: "#my_tmpl" }');

	equal($.templates("#my_tmpl"), $.templates("#my_tmpl"), '$.templates("#my_tmpl") caches compiled template, and does not recompile each time;');

	ok($.templates({markup: "#my_tmpl"}) !== $.templates({markup: "#my_tmpl"}), '$.templates({markup: "#my_tmpl" ...}) recompiles template, so as to merge additional options;');

	equal($.templates("", "#my_tmpl"), $.templates("#my_tmpl"), '$.templates("#my_tmpl") and $.templates("", "#my_tmpl") are equivalent');

	var renamed = $.templates("renamed", "#my_tmpl");
	ok(renamed === tmpl2 && renamed.tmplName === "renamed", '$.templates("renamed", "#my_tmpl") will rename the cached template');

	$.templates({ renamed2: "#my_tmpl" });
	ok($.templates.renamed2 === tmpl2 && $.templates.renamed2.tmplName === "renamed2", '$.templates({ renamed2: "#my_tmpl" }) will rename the cached template');

	$.templates("cloned", {markup: "#my_tmpl"});
	ok($.templates.cloned !== tmpl2 && $.templates.cloned.tmplName === "cloned", '$.templates("cloned", {markup: "#my_tmpl" } }) will clone the cached template');

	$.templates({ cloned2: {markup: "#my_tmpl"} });
	ok($.templates.cloned2 !== tmpl2 && $.templates.cloned2.tmplName === "cloned2", '$.templates({ cloned: {markup: "#my_tmpl" } }) will clone the cached template');

	$.templates("my_tmpl", null);
	equal($.templates.my_tmpl, undefined, 'Remove a named template:  $.templates("my_tmpl", null);');

	$.templates({
		"scriptTmpl": {
			markup: "#my_tmpl",
			debug:true
		},
		"tmplFromString": {
			markup: "testDebug",
			debug:true
		}
	});
	equal($.templates.tmplFromString.fn.toString().indexOf("debugger;") > 0 && $.templates.scriptTmpl.fn.toString().indexOf("debugger;") > 0, true, 'Debug a template:  set debug:true on object');

	// reset
	$("#my_tmpl")[0].removeAttribute("data-jsv-tmpl");

	delete $.templates.scriptTmpl;
});

test("render", 7, function() {
	equal($.trim($("#my_tmpl").render(person)), "A_Jo_B", '$(tmplSelector).render(data);'); // Trimming because IE adds whitespace

	var tmpl3 = $.templates("my_tmpl4", tmplString);

	equal($.render.my_tmpl4(person), "A_Jo_B", '$.render.my_tmpl(object);');
	equal($.render.my_tmpl4(people), "A_Jo_BA_Bill_B", '$.render.my_tmpl(array);');

	var tmplObject = $.templates.my_tmpl4;
	equal(tmplObject.render(people), "A_Jo_BA_Bill_B", 'var tmplObject = $.templates.my_tmpl; tmplObject.render(data);');

	$.templates("my_tmpl5", "A_{{for}}inner{{:name}}content{{/for}}_B");
	equal($.templates.my_tmpl5.tmpls[0].render(person), "innerJocontent", 'Nested template objects: $.templates.my_tmpl.tmpls');

	$("#result").html("<script id='tmpl' type='text/x-jsrender'>Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}</script>");
	equal($("#tmpl").render([null,undefined,1], {foo:"foovalue"}, true), (isIE8 ? "\n" : "") + "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');

	$("#result").html("<script id='tmpl' type='text/x-jsrender'>Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}</script>");
	equal($("#tmpl").render([null, undefined, 1], true), (isIE8 ? "\n" : "") + "Content012", 'render(array, true) renders an array without iteration');
	$("#result").empty();
});

test("converters", 3, function() {
	function loc(data) {
		switch (data) { case "desktop": return "bureau"; }
	}
	$.views.converters({ loc: loc });
	equal($.templates("{{loc:#data}}:{{loc:'desktop'}}").render("desktop"), "bureau:bureau", "$.views.converters({ loc: locFunction })");

	$.views.converters("loc2", loc);
	equal($.views.converters.loc2 === loc, true, 'locFunction === $.views.converters.loc');

	$.views.converters({ loc2: null});
	equal($.views.converters.loc2, undefined, 'Remove a registered converter: $.views.converters({ loc: null })');
});

test("tags", 3, function() {
	$.views.tags({ sort: sort });
	equal($.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({ people: people }), "BillJo", "$.views.tags({ sort: sortFunction })");

	$.views.tags("sort2", sort);
	equal($.views.tags.sort.render === sort, true, 'sortFunction === $.views.tags.sort');

	$.views.tags("sort2", null);
	equal($.views.tags.sort2, undefined, 'Remove a registered tag: $.views.tag({ sor: null })');
});

test("helpers", 3, function() {
	function concat() {
		return "".concat.apply("", arguments);
	}

	$.views.helpers({
		not: function(value) {
			return !value;
		},
		concat: concat
	});
	equal($.templates("{{:~concat(a, 'b', ~not(false))}}").render({ a: "aVal" }), "aValbtrue", "$.views.helpers({ concat: concatFunction })");

	$.views.helpers({ concat2: concat });

	equal($.views.helpers.concat === concat, true, 'concatFunction === $.views.helpers.concat');

	$.views.helpers("concat2", null);
	equal($.views.helpers.concat2, undefined,  'Remove a registered helper: $.views.helpers({ concat: null })');
});

test("template encapsulation", 1, function() {
	$.templates({
		myTmpl6: {
			markup: "{{sort reverse=true people}}{{:name}}{{/sort}}",
			tags: {
				sort: sort
			}
		}
	});
	equal($.render.myTmpl6({ people: people }), "BillJo", '$.templates("my_tmpl", tmplObjWithNestedItems);');
});

})(this, this.jQuery);
