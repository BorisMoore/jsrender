/*global test, equal, module, ok*/
(function(global, $, undefined) {
"use strict";

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

var person = {name: "Jo"},
	people = [{name: "Jo"},{name: "Bill"}],
	towns = [{name: "Seattle"},{name: "Paris"},{name: "Delhi"}];

var tmplString = "A_{{:name}}_B";

QUnit.module("api");

QUnit.test("templates", function(assert) {
	var tmplElem = document.getElementById("./test/templates/file/path.html");

	// =============================== Arrange ===============================
	$.removeData(tmplElem, "jsvTmpl"); // In case data has been set in a previous test

	// ................................ Act ..................................
	var tmpl0 = $.templates({markup: "./test/templates/file/path.html"}); // Compile template but do not cache

	// ............................... Assert .................................
	assert.equal(!$.data(tmplElem).jsvTmpl && tmpl0.render({name: "Jo0"}),
		"ServerRenderedTemplate_Jo0_B",
		"Compile server-generated template, without caching");

	// ................................ Act ..................................
	var tmpl1 = $.templates("./test/templates/file/path.html"); // Compile and cache, using $.data(elem, "jsvTmpl", tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl1 !== tmpl0 && $.data(tmplElem).jsvTmpl === tmpl1 && tmpl1.render({name: "Jo1"}), "ServerRenderedTemplate_Jo1_B", "Compile server-generated template, and cache on file path");

	// ................................ Act ..................................
	var tmpl2 = $.templates("./test/templates/file/path.html"); // Use cached template, accessed by path as key

	// ............................... Assert .................................
	assert.equal(tmpl2 === tmpl1 && tmpl1.render({name: "Jo2"}),
		"ServerRenderedTemplate_Jo2_B",
		"Re-use cached server-generated template");

	// ................................ Act ..................................
	var tmpl3 = $.templates({markup: "./test/templates/file/path.html"}); // Re-compile template but do not cache. Leaved cached template.

	// ............................... Assert .................................
	assert.equal(tmpl3 !== tmpl0 && tmpl3 !== tmpl1 && $.data(tmplElem).jsvTmpl === tmpl1 && tmpl3.render({name: "Jo3"}),
		"ServerRenderedTemplate_Jo3_B",
		"Recompile server-generated template, without caching");

	// ................................ Reset ................................
	delete $.data(tmplElem).jsvTmpl;
	document.getElementById("./test/templates/file/path.html").removeAttribute("data-jsv-tmpl");

	tmplElem = $("#myTmpl")[0];
	delete $.data(tmplElem).jsvTmpl;
	tmplElem.removeAttribute("data-jsv-tmpl");

	// ................................ Act ..................................
	tmpl0 = $.templates({markup: "#myTmpl"}); // Compile template declared in script block, but do not cache

	// ............................... Assert .................................
	assert.equal(!$.data(tmplElem).jsvTmpl && tmpl0.render({name: "Jo0"}), "A_Jo0_B",
		"Compile template declared in script block, without caching");

	// ................................ Act ..................................
	tmpl1 = $.templates("#myTmpl"); // Compile and cache, using $.data(elem, "jsvTmpl", tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl1 !== tmpl0 && $.data(tmplElem).jsvTmpl === tmpl1 && tmpl1.render({name: "Jo1"}), "A_Jo1_B",
		"Compile template declared in script block, and cache on file path");

	// ................................ Act ..................................
	tmpl2 = $.templates("#myTmpl"); // Use cached template, accessed by $.data(elem, "jsvTmpl")

	// ............................... Assert .................................
	assert.equal(tmpl2 === tmpl1 && tmpl1.render({name: "Jo2"}), "A_Jo2_B",
		"Re-use cached template declared in script block");

	// ................................ Act ..................................
	var tmpl2b = $.templates(".myTmpl"); // Access script element by class selector. Still get cached template, accessed by $.data(elem, "jsvTmpl")

	// ............................... Assert .................................
	assert.equal(tmpl2b === tmpl2 && tmpl2.render({name: "Jo2"}), "A_Jo2_B",
		"Re-use cached template declared in script block - accessed by class selector");

	// ................................ Act ..................................
	tmpl2 = $.templates("#myAbsentTmpl");

	// ............................... Assert .................................
	assert.equal(tmpl2.render({name: "Jo2"}), "#myAbsentTmpl",
		"Access missing script block template - renders as string");

	// ................................ Act ..................................
	tmpl3 = $.templates({markup: "#myTmpl"}); // Re-compile template but do not cache. Leave cached template.

	// ............................... Assert .................................
	assert.equal(tmpl3 !== tmpl0 && tmpl3 !== tmpl1 && $.data(tmplElem).jsvTmpl === tmpl1 && tmpl3.render({name: "Jo3"}), "A_Jo3_B",
		"Recompile template declared in script block, without caching");

	// ................................ Reset ................................
	delete $.data(tmplElem).jsvTmpl;
	tmplElem.removeAttribute("data-jsv-tmpl");

	// =============================== Arrange ===============================
	// ............................... Assert .................................
	assert.equal($.templates("#my_tmpl2").render(), "' \" \\ \\' \\\"", "correct treatment of ' \" and ' in template declared in script block");

	assert.equal($.templates("' \" \\ \\' \\\"").render(), "' \" \\ \\' \\\"", "correct treatment of ' \" and ' in template compiled from string");

	$.templates("my_tmpl", tmplString);
	assert.equal($.render.my_tmpl(person), "A_Jo_B", 'Compile a template and then render it: $.templates("my_tmpl", tmplString); $.render.my_tmpl(data);');

	$.templates({myTmpl2: tmplString});
	assert.equal($.render.myTmpl2(person), "A_Jo_B", 'Compile and register templates: $.templates({"my_tmpl", tmplString, ...}); $.render.my_tmpl(data);');

	assert.equal($.templates.myTmpl2.render(person), "A_Jo_B", 'Get named template: $.templates.my_tmpl.render(data);');

	assert.equal($.templates(tmplString).render(person), "A_Jo_B", 'Compile without registering as named template: $.templates(tmplString).render(person);');

	tmpl2 = $.templates("#my_tmpl");
	tmpl3 = $.templates("#my_tmpl");
	assert.equal(tmpl2 === tmpl3 && $.trim(tmpl2.render(person)), "A_Jo_B", 'var tmpl = $.templates("#my_tmpl"); returns compiled template for script element');

	$.templates({
		my_tmpl3: {
			markup: "#my_tmpl"
		}
	});

	assert.equal($.render.my_tmpl3 === $.templates.my_tmpl3 && $.templates.my_tmpl3 !== tmpl2 && $.trim($.render.my_tmpl3(person)), "A_Jo_B", 'Named template for template object with selector: {markup: "#my_tmpl"}');

	tmpl3 = $.templates("", {
		markup: "#my_tmpl"
	});
	assert.equal($.trim(tmpl3.render(person)), "A_Jo_B", 'Compile from template object with selector, without registering: {markup: "#my_tmpl"}');

	var tmpl4 = $.templates({
		markup: "#my_tmpl"
	});
	assert.equal($.trim(tmpl4.render(person)), "A_Jo_B", 'Compile from template object with selector, without registering: {markup: "#my_tmpl"}');

	assert.equal($.templates("#my_tmpl"), $.templates("#my_tmpl"), '$.templates("#my_tmpl") caches compiled template, and does not recompile each time;');

	assert.ok($.templates({markup: "#my_tmpl"}) !== $.templates({markup: "#my_tmpl"}), '$.templates({markup: "#my_tmpl" ...}) recompiles template, so as to merge additional options;');

	assert.equal($.templates("", "#my_tmpl"), $.templates("#my_tmpl"), '$.templates("#my_tmpl") and $.templates("", "#my_tmpl") are equivalent');

	var renamed = $.templates("renamed", "#my_tmpl");
	assert.ok(renamed === tmpl2 && renamed.tmplName === "renamed", '$.templates("renamed", "#my_tmpl") will rename the cached template');

	$.templates({renamed2: "#my_tmpl"});
	assert.ok($.templates.renamed2 === tmpl2 && $.templates.renamed2.tmplName === "renamed2", '$.templates({renamed2: "#my_tmpl"}) will rename the cached template');

	$.templates("cloned", {markup: "#my_tmpl"});
	assert.ok($.templates.cloned !== tmpl2 && $.templates.cloned.tmplName === "cloned", '$.templates("cloned", {markup: "#my_tmpl"}}) will clone the cached template');

	$.templates({cloned2: {markup: "#my_tmpl"}});
	assert.ok($.templates.cloned2 !== tmpl2 && $.templates.cloned2.tmplName === "cloned2", '$.templates({cloned: {markup: "#my_tmpl"}}) will clone the cached template');

	$.templates("my_tmpl", null);
	assert.equal($.templates.my_tmpl, undefined, 'Remove a named template: $.templates("my_tmpl", null);');

	$.templates({
		scriptTmpl: {
			markup: "#my_tmpl",
			debug:true
		},
		tmplFromString: {
			markup: "X_{{:name}}_Y",
			debug:true
		}
	});
	assert.equal($.templates.tmplFromString.fn.toString().indexOf("debugger;") > 0
		&& $.templates.scriptTmpl.fn.toString().indexOf("debugger;") > 0
		&& $.templates.scriptTmpl({name: "Jo"}) + $.templates.tmplFromString({name: "Jo"}), "A_Jo_BX_Jo_Y",
		'Debug a template: set debug:true on object');

	// reset
	$("#my_tmpl")[0].removeAttribute("data-jsv-tmpl");

	delete $.templates.scriptTmpl;
});

QUnit.test("render", function(assert) {
	assert.equal($.trim($("#my_tmpl").render(person)), "A_Jo_B", '$(tmplSelector).render(data);'); // Trimming because IE adds whitespace

	var tmpl3 = $.templates("my_tmpl4", tmplString);

	assert.equal($.render.my_tmpl4(person), "A_Jo_B", '$.render.my_tmpl(object);');
	assert.equal($.render.my_tmpl4(people), "A_Jo_BA_Bill_B", '$.render.my_tmpl(array);');

	var tmplObject = $.templates.my_tmpl4;
	assert.equal(tmplObject.render(people), "A_Jo_BA_Bill_B", 'var tmplObject = $.templates.my_tmpl; tmplObject.render(data);');

	$.templates("my_tmpl5", "A_{{for}}inner{{:name}}content{{/for}}_B");
	assert.equal($.templates.my_tmpl5.tmpls[0].render(person), "innerJocontent", 'Nested template objects: $.templates.my_tmpl.tmpls');

	$("#result").html("<script id='tmpl' type='text/x-jsrender'>Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}</script>");
	assert.equal($("#tmpl").render([null,undefined,1], {foo:"foovalue"}, true), "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');

	$("#result").html("<script id='tmpl' type='text/x-jsrender'>Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}</script>");
	assert.equal($("#tmpl").render([null, undefined, 1], true), "Content012", 'render(array, true) renders an array without iteration');
	$("#result").empty();
});

QUnit.test("converters", function(assert) {
	function loc(data) {
		switch (data) {case "desktop": return "bureau"; }
	}
	$.views.converters({loc: loc});
	assert.equal($.templates("{{loc:#data}}:{{loc:'desktop'}}").render("desktop"), "bureau:bureau", "$.views.converters({loc: locFunction})");

	$.views.converters("loc2", loc);
	assert.equal($.views.converters.loc2 === loc, true, 'locFunction === $.views.converters.loc');

	$.views.converters({loc2: null});
	assert.equal($.views.converters.loc2, undefined, 'Remove a registered converter: $.views.converters({loc: null})');
});

QUnit.test("tags", function(assert) {
	$.views.tags({sort1: sort});
	assert.equal($.templates("{{sort1 people reverse=true}}{{:name}}{{/sort1}}").render({people: people}), "BillJo", "$.views.tags({sort: sortFunction})");

	$.views.tags("sort2", sort);
	assert.equal($.views.tags.sort1.render === sort, true, 'sortFunction === $.views.tags.sort');

	$.views.tags("sort2", null);
	assert.equal($.views.tags.sort2, undefined, 'Remove a registered tag: $.views.tag({sor: null})');
});

QUnit.test("helpers", function(assert) {
	function concat() {
		return "".concat.apply("", arguments);
	}

	$.views.helpers({
		not: function(value) {
			return !value;
		},
		concat: concat
	});
	assert.equal($.templates("{{:~concat(a, 'b', ~not(false))}}").render({a: "aVal"}), "aValbtrue", "$.views.helpers({concat: concatFunction})");

	$.views.helpers({concat2: concat});

	assert.equal($.views.helpers.concat === concat, true, 'concatFunction === $.views.helpers.concat');

	$.views.helpers("concat2", null);
	assert.equal($.views.helpers.concat2, undefined, 'Remove a registered helper: $.views.helpers({concat: null})');
});

QUnit.test("template encapsulation", function(assert) {
	$.templates({
		myTmpl6: {
			markup: "{{sort reverse=true people}}{{:name}}{{/sort}}",
			tags: {
				sort: sort
			}
		}
	});
	assert.equal($.render.myTmpl6({people: people}), "BillJo", '$.templates("my_tmpl", tmplObjWithNestedItems);');
});

QUnit.test("$.views.viewModels", function(assert) {
	// =============================== Arrange ===============================
	var Constr = $.views.viewModels({getters: ["a", "b"]});
	// ................................ Act ..................................
	var vm = Constr("a1 ", "b1 ");
	var result = vm.a() + vm.b();
	vm.a("a2 ");
	vm.b("b2 ");
	result += vm.a() + vm.b();
	// ............................... Assert .................................
	assert.equal(result, "a1 b1 a2 b2 ", "viewModels, two getters, no methods");

	// =============================== Arrange ===============================
	Constr = $.views.viewModels({getters: ["a", "b", "c"], extend: {add: function(val) {
		this.c(val + this.a() + this.b() + this.c());
	}}});
	// ................................ Act ..................................
	vm = Constr("a1 ", "b1 ", "c1 ");
	vm.add("before ");
	result = vm.c();
	// ............................... Assert .................................
	assert.equal(result, "before a1 b1 c1 ", "viewModels, two getters, one method");

	// =============================== Arrange ===============================
	Constr = $.views.viewModels({extend: {add: function(val) {
		this.foo = val;
	}}});
	// ................................ Act ..................................
	vm = Constr();
	vm.add("before");
	result = vm.foo;
	// ............................... Assert .................................
	assert.equal(result, "before", "viewModels, no getters, one method");

	// =============================== Arrange ===============================
	Constr = $.views.viewModels({getters: []});
	// ................................ Act ..................................
	vm = Constr();
	result = JSON.stringify(vm);
	// ............................... Assert .................................
	assert.equal(result, "{}", "viewModels, no getters, no methods");

	// =============================== Arrange ===============================
	$.views.viewModels({
		T1: {
			getters: ["a", "b"]
		}
	});
	// ................................ Act ..................................
	vm = $.views.viewModels.T1.map({a: "a1 ", b: "b1 "});

	result = vm.a() + vm.b();
	vm.a("a2 ");
	vm.b("b2 ");
	result += vm.a() + vm.b();

	// ............................... Assert .................................
	assert.equal(result, "a1 b1 a2 b2 ", "viewModels, two getters, no methods");

	// ................................ Act ..................................
	vm.merge({a: "a3 ", b: "b3 "});

	result = vm.a() + vm.b();

	// ............................... Assert .................................
	assert.equal(result, "a3 b3 ", "viewModels merge, two getters, no methods");

	// ................................ Act ..................................
	result = vm.unmap();
	result = JSON.stringify(result);

	// ............................... Assert .................................
	assert.equal(result, '{"a":"a3 ","b":"b3 "}', "viewModels unmap, two getters, no methods");

	// =============================== Arrange ===============================
	var viewModels = $.views.viewModels({
		T1: {
			getters: ["a", {getter: "b"}, "c", "d", {getter: "e", type: undefined}, {getter: "f", type: null}, {getter: "g", type: "foo"}, {getter: "h", type: ""}]
		}
	}, {});
	// ................................ Act ..................................
	vm = viewModels.T1.map({a: "a1 ", b: "b1 ", c: "c1 ", d: "d1 ", e: "e1 ", f: "f1 ", g: "g1 ", h: "h1 "});
	result = vm.a() + vm.b() + vm.c() + vm.d() + vm.e() + vm.f() + vm.g() + vm.h();
	vm.a("a2 ");
	vm.b("b2 ");
	result += vm.a() + vm.b();
	// ............................... Assert .................................
	assert.equal(result, "a1 b1 c1 d1 e1 f1 g1 h1 a2 b2 ",
		"viewModels, multiple unmapped getters, no methods");

	// ................................ Act ..................................
	vm.merge({a: "a3 ", b: "b3 ", c: "c3 ", d: "d3 ", e: "e3 ", f: "f3 ", g: "g3 ", h: "h3 "});

	result = vm.a() + vm.b() + vm.c() + vm.d() + vm.e() + vm.f() + vm.g() + vm.h();

	// ............................... Assert .................................
	assert.equal(result, "a3 b3 c3 d3 e3 f3 g3 h3 ",
		"viewModels merge, multiple unmapped getters, no methods");

	// ................................ Act ..................................
	result = vm.unmap();
	result = JSON.stringify(result);

	// ............................... Assert .................................
	assert.equal(result, '{"a":"a3 ","b":"b3 ","c":"c3 ","d":"d3 ","e":"e3 ","f":"f3 ","g":"g3 ","h":"h3 "}',
		"viewModels unmap, multiple unmapped getters, no methods");

	// =============================== Arrange ===============================
	$.views.viewModels({
		T1: {
			getters: ["a", "b", "c"],
			extend : {
				add: function(val) {
					this.c(val + this.a() + this.b() + this.c());
				}
			}
		}
	});

	// ................................ Act ..................................
	vm = $.views.viewModels.T1.map({a: "a1 ", b: "b1 ", c: "c1 "});

	vm.add("before ");
	result = vm.c();

	// ............................... Assert .................................
	assert.equal(result, "before a1 b1 c1 ", "viewModels, getters and one method");

	// ................................ Act ..................................
	vm.merge({a: "a3 ", b: "b3 ", c: "c3 "});
	vm.add("updated ");
	result = vm.c();

	// ............................... Assert .................................
	assert.equal(result, "updated a3 b3 c3 ", "viewModels merge, getters and one method");

	// ................................ Act ..................................
	result = vm.unmap();
	result = JSON.stringify(result);

	// ............................... Assert .................................
	assert.equal(result, '{"a":"a3 ","b":"b3 ","c":"updated a3 b3 c3 "}', "viewModels unmap, getters and one method");

	// =============================== Arrange ===============================
	$.views.viewModels({
		T1: {
			getters: ["a", "b"]
		},
		T2: {
			getters: [{getter: "t1", type: "T1"}, {getter: "t1Arr", type: "T1"}, {getter: "t1OrNull", type: "T1", defaultVal: null}]
		}
	});
	viewModels = $.views.viewModels;
	// ................................ Act ..................................
	var t1 = viewModels.T1.map({a: "a1 ", b: "b1 "}); // Create a T1
	var t2 = viewModels.T2.map({t1: {a: "a3 ", b: "b3 "}, t1Arr: [t1.unmap(), {a: "a2 ", b: "b2 "}]}); // Create a T2 (using unmap to scrape values the T1: vm)

	result = JSON.stringify(t2.unmap());

	// ............................... Assert .................................
	assert.equal(result, '{"t1":{"a":"a3 ","b":"b3 "},"t1Arr":[{"a":"a1 ","b":"b1 "},{"a":"a2 ","b":"b2 "}],"t1OrNull":null}',
		"viewModels, hierarchy");

	// ................................ Act ..................................
	t2.t1Arr()[0].merge({a: "a1x ", b: "b1x "}); // merge not the root, but a VM instance within hierarchy: vm2.t1Arr()[0] - leaving rest unchanged
	result = JSON.stringify(t2.unmap());

	// ............................... Assert .................................
	assert.equal(result, '{"t1":{"a":"a3 ","b":"b3 "},"t1Arr":[{"a":"a1x ","b":"b1x "},{"a":"a2 ","b":"b2 "}],"t1OrNull":null}',
		"viewModels, merge deep node");

	// ................................ Act ..................................
	var t1Arr = viewModels.T1.map([{a: "a1 ", b: "b1 "}, {a: "a2 ", b: "b2 "}]); // Create a T1 array
	var t2FromArr =  viewModels.T2.map({t1: {a: "a3 ", b: "b3 "}, t1Arr: t1Arr.unmap()}); // Create a T2 (using unmap to scrape values the T1: vm)
	result = JSON.stringify(t2FromArr.unmap());

	// ............................... Assert .................................
	assert.equal(result, '{"t1":{"a":"a3 ","b":"b3 "},"t1Arr":[{"a":"a1 ","b":"b1 "},{"a":"a2 ","b":"b2 "}],"t1OrNull":null}',
		"viewModels, hierarchy");

	// ................................ Act ..................................
	t1Arr = viewModels.T1.map([{a: "a1 ", b: "b1 "}, {a: "a2 ", b: "b2 "}]); // Create a T1 array
	t1Arr.push(viewModels.T1("a3 ", "b3 "));
	t2FromArr = viewModels.T2.map({t1: {a: "a4 ", b: "b4 "}, t1Arr: t1Arr.unmap()}); // Create a T2 (using unmap to scrape values the T1: vm)
	result = JSON.stringify(t2FromArr.unmap());

	// ............................... Assert .................................
	assert.equal(result, '{"t1":{"a":"a4 ","b":"b4 "},"t1Arr":[{"a":"a1 ","b":"b1 "},{"a":"a2 ","b":"b2 "},{"a":"a3 ","b":"b3 "}],"t1OrNull":null}',
		"viewModels, hierarchy");

	// ................................ Act ..................................
	var t2new= viewModels.T2(viewModels.T1("a3 ", "b3 "), [viewModels.T1("a1 ", "b1 "), viewModels.T1("a2 ", "b2 ")], viewModels.T1("a4 ", "b4 "));
	result = JSON.stringify(t2new.unmap());

	// ............................... Assert .................................
	assert.equal(result, '{"t1":{"a":"a3 ","b":"b3 "},"t1Arr":[{"a":"a1 ","b":"b1 "},{"a":"a2 ","b":"b2 "}],"t1OrNull":{"a":"a4 ","b":"b4 "}}',
		"viewModels, hierarchy");
});

})(this, this.jQuery);
