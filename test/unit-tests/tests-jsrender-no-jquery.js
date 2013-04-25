/// <reference path="../qunit/qunit.js" />
/// <reference path="../../jsrender.js" />
(function(global, $, undefined) {
"use strict";
(function() {

function compileTmpl(template) {
	try {
		return typeof $.templates(template).fn === "function" ? "compiled" : "failed compile";
	}
	catch(e) {
		return e.message;
	}
}

function sort(array) {
	var ret = "";
	if (this.tagCtx.props.reverse) {
		// Render in reverse order
		if (arguments.length > 1) {
			for (i = arguments.length; i; i--) {
				ret += sort.call(this, arguments[ i - 1 ]);
			}
		} else for (var i = array.length; i; i--) {
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

var tmplString = "A_{{:name}}_B";
$.views.tags({ sort: sort });

module("tagParser");
test("{{if}} {{else}}", 3, function() {
	equal(compileTmpl("A_{{if true}}{{/if}}_B"), "compiled", "Empty if block: {{if}}{{/if}}");
	equal(compileTmpl("A_{{if true}}yes{{/if}}_B"), "compiled", "{{if}}...{{/if}}");
	equal(compileTmpl("A_{{if true/}}yes{{/if}}_B"), "Syntax error\nUnmatched or missing tag: \"{{/if}}\" in template:\nA_{{if true/}}yes{{/if}}_B");
});

module("{{if}}");
test("{{if}}", 4, function() {
	equal($.templates("A_{{if true}}yes{{/if}}_B").render(), "A_yes_B", "{{if a}}: a");
	equal($.templates("A_{{if false}}yes{{/if}}_B").render(), "A__B", "{{if a}}: !a");
	equal($.templates("A_{{if true}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: a");
	equal($.templates("A_{{if false}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: !a");
});

test("{{if}} {{else}}", 7, function() {
	equal($.templates("A_{{if true}}yes{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else}}: a");
	equal($.templates("A_{{if false}}yes{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else}}: !a");
	equal($.templates("A_{{if true}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else b}} {{else}}: a");
	equal($.templates("A_{{if false}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_or_B", "{{if a}} {{else b}} {{else}}: b");
	equal($.templates("A_{{if false}}yes{{else false}}or{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else b}} {{else}}: !a!b");
	equal($.templates("A_{{if false}}<div title='yes'{{else}}<div title='no'{{/if}}>x</div>_B").render(), "A_<div title='no'>x</div>_B", "{{if}} and {{else}} work across HTML tags");
	equal($.templates("A_<div title='{{if true}}yes'{{else}}no'{{/if}}>x</div>_B").render(), "A_<div title='yes'>x</div>_B", "{{if}} and {{else}} work across quoted strings");
});

test("{{if}} {{else}} external templates", 2, function() {
	equal($.templates("A_{{if true tmpl='yes<br/>'/}}_B").render(), "A_yes<br/>_B", "{{if a tmpl=foo/}}: a");
	equal($.templates("A_{{if false tmpl='yes<br/>'}}{{else false tmpl='or<br/>'}}{{else tmpl='no<br/>'}}{{/if}}_B").render(), "A_no<br/>_B", "{{if a tmpl=foo}}{{else b tmpl=bar}}{{else tmpl=baz}}: !a!b");
});

module("{{:}}");
test("convert", 4, function() {
	equal($.templates("{{>#data}}").render("<br/>'\"&"), "&lt;br/&gt;&#39;&#34;&amp;", "default html converter");
	equal($.templates("{{html:#data}}").render("<br/>'\"&"), "&lt;br/&gt;&#39;&#34;&amp;", "html converter");
	equal($.templates("{{:#data}}").render("<br/>'\"&"), "<br/>'\"&", "no convert");

	function loc(data) {
		switch (data) { case "desktop": return "bureau"; }
	}
	$.views.converters("loc", loc);
	equal($.templates("{{loc:#data}}:{{loc:'desktop'}}").render("desktop"), "bureau:bureau", '$.views.converters("loc", locFunction);... {{loc:#data}}');
});

test("paths", 17, function() {
	equal($.templates("{{:a}}").render({ a: "aVal" }), "aVal", "a");
	equal($.templates("{{:a.b}}").render({ a: { b: "bVal" }}), "bVal", "a.b");
	equal($.templates("{{:a.b.c}}").render({ a: { b: { c: "cVal" }}}), "cVal", "a.b.c");
	equal($.templates("{{:a.name}}").render({ a: { name: "aName" }}), "aName", "a.name");
	equal($.templates("{{:a['name']}}").render({ a: { name: "aName"} }), "aName", "a['name']");
	equal($.templates("{{:a['x - _*!']}}").render({ a: { "x - _*!": "aName"} }), "aName", "a['x - _*!']");
	equal($.templates("{{:#data['x - _*!']}}").render({ "x - _*!": "aName"}), "aName", "#data['x - _*!']");
	equal($.templates('{{:a["x - _*!"]}}').render({ a: { "x - _*!": "aName"} }), "aName", 'a["x - _*!"]');
	equal($.templates("{{:a.b[1].d}}").render({ a: { b: [0, { d: "dVal"}]} }), "dVal", "a.b[1].d");
	equal($.templates("{{:a.b[1].d}}").render({ a: { b: {1:{ d: "dVal" }}}}), "dVal", "a.b[1].d");
	equal($.templates("{{:a.b[~incr(1-1)].d}}").render({ a: { b: {1:{ d: "dVal" }}}}, { incr:function(val) { return val + 1; }}), "dVal", "a.b[~incr(1-1)].d");
	equal($.templates("{{:a.b.c.d}}").render({ a: { b: {'c':{ d: "dVal" }}}}), "dVal", "a.b.c.d");
	equal($.templates("{{:a[0]}}").render({ a: [ "bVal" ]}), "bVal", "a[0]");
	equal($.templates("{{:a.b[1][0].msg}}").render({ a: { b: [22,[{ msg: " yes - that's right. "}]] }}), " yes - that's right. ", "a.b[1][0].msg");
	equal($.templates("{{:#data.a}}").render({ a: "aVal" }), "aVal", "#data.a");
	equal($.templates("{{:#view.data.a}}").render({ a: "aVal" }), "aVal", "#view.data.a");
	equal($.templates("{{:#index === 0}}").render([{ a: "aVal" }]), "true", "#index");
});

test("types", function() {
	equal($.templates("{{:'abc'}}").render(), "abc", "'abc'");
	equal($.templates("{{:true}}").render(), "true", "true");
	equal($.templates("{{:false}}").render(), "false", "false");
	equal($.templates("{{:null}}").render(), "", 'null -> ""');
	equal($.templates("{{:199}}").render(), "199", "199");
	equal($.templates("{{: 199.9 }}").render(), "199.9", "| 199.9 |");
	equal($.templates("{{:-33.33}}").render(), "-33.33", "-33.33");
	equal($.templates("{{: -33.33 }}").render(), "-33.33", "| -33.33 |");
	equal($.templates("{{:-33.33 - 2.2}}").render(), "-35.53", "-33.33 - 2.2");
	equal($.templates("{{:notdefined}}").render({}), "", "notdefined");
});

test("noerror = true", function() {
	equal($.templates("{{:a.b.c.d.e noerror=true}}").render(), "", '{{:a.b.c.d.e noerror=true}} -> ""');
	equal($.templates("{{>a.b.c.d.e noerror=true}}").render(), "", '{{>a.b.c.d.e noerror=true}} -> ""');
	equal($.templates({
		markup: "{{withfallback:a.b noerror=true fallback='Missing Object'}} and {{withfallback:a noerror=true fallback='xx'}} and {{>a noerror=true}} and {{withfallback:a.x.y noerror=true fallback='xx'}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render({a:"yes"}), "Missing Object and yes and yes and xx", '{{withfallback:a.b noerror=true fallback="Missing Object"}} -> "Missing Object"');
});

test("comparisons", 22,function () {
	equal($.templates("{{:1<2}}").render(), "true", "1<2");
	equal($.templates("{{:2<1}}").render(), "false", "2<1");
	equal($.templates("{{:5===5}}").render(), "true", "5===5");
	equal($.templates("{{:0==''}}").render(), "true", "0==''");
	equal($.templates("{{:'ab'=='ab'}}").render(), "true", "'ab'=='ab'");
	equal($.templates("{{:2>1}}").render(), "true", "2>1");
	equal($.templates("{{:2 == 2}}").render(), "true", "2 == 2");
	equal($.templates("{{:2<=2}}").render(), "true", "2<=2");
	equal($.templates("{{:'ab'<'ac'}}").render(), "true", "'ab'<'ac'");
	equal($.templates("{{:3>=3}}").render(), "true", "3 =3");
	equal($.templates("{{:3>=2}}").render(), "true", "3>=2");
	equal($.templates("{{:3>=4}}").render(), "false", "3>=4");
	equal($.templates("{{:3 !== 2}}").render(), "true", "3 !== 2");
	equal($.templates("{{:3 != 2}}").render(), "true", "3 != 2");
	equal($.templates("{{:0 !== null}}").render(), "true", "0 !== null");
	equal($.templates("{{:(3 >= 4)}}").render(), "false", "3>=4");
	equal($.templates("{{:3 >= 4}}").render(), "false", "3>=4");
	equal($.templates("{{:(3>=4)}}").render(), "false", "3>=4");
	equal($.templates("{{:(3 < 4)}}").render(), "true", "3>=4");
	equal($.templates("{{:3 < 4}}").render(), "true", "3>=4");
	equal($.templates("{{:(3<4)}}").render(), "true", "3>=4");
	equal($.templates("{{:0 != null}}").render(), "true", "0 != null");
});

test("array access", function() {
	equal($.templates("{{:a[1]}}").render({ a: ["a0","a1"] }), "a1", "a[1]");
	equal($.templates("{{:a[1+1]+5}}").render({ a: [11,22,33] }), "38", "a[1+1]+5)");
	equal($.templates("{{:a[~incr(1)]+5}}").render({ a: [11,22,33] }, { incr:function(val) { return val + 1; }}), "38", "a[~incr(1)]+5");
	equal($.templates("{{:true && (a[0] || 'default')}}").render({ a: [0,22,33] }, { incr:function(val) { return val + 1; }}), "default", "true && (a[0] || 'default')");
});

test("context", 5, function() {
	equal($.templates("{{:~val}}").render(1, { val: "myvalue" }), "myvalue", "~val");
	function format(value, upper) {
		return value[upper ?  "toUpperCase" : "toLowerCase"]();
	}
	equal($.templates("{{:~format(name) + ~format(name, true)}}").render(person, { format: format }), "joJO", "render(data, { format: formatFn }); ... {{:~format(name, true)}}");
	equal($.templates("{{for people[0]}}{{:~format(~type) + ~format(name, true)}}{{/for}}").render({ people: people}, { format: format, type: "PascalCase" }), "pascalcaseJO", "render(data, { format: formatFn }); ... {{:~format(name, true)}}");
	equal($.templates("{{for people ~twn=town}}{{:name}} lives in {{:~format(~twn, true)}}. {{/for}}").render({ people: people, town:"Redmond" }, { format: format }), "Jo lives in REDMOND. Bill lives in REDMOND. ", "Passing in context to nested templates: {{for people ~twn=town}}");
	equal($.templates("{{if true}}{{for people}}{{:~root.people[0].name}}{{/for}}{{/if}}").render({ people: people}), "JoJo", "{{:~root}} returns the top-level data");
});

test("values", 4, function() {
	equal($.templates("{{:a}}").render({ a: 0 }), "0", '{{:undefined}} returns "0"');
	equal($.templates("{{:a}}").render({}), "", "{{:undefined}} returns empty string");
	equal($.templates("{{:a}}").render({ a: "" }), "", "{{:''}} returns empty string");
	equal($.templates("{{:a}}").render({ a: null }), "", "{{:null}} returns empty string");
});

test("expressions", 8, function() {
	equal(compileTmpl("{{:a++}}"), "Syntax error\na++", "a++");
	equal(compileTmpl("{{:(a,b)}}"), "Syntax error\n(a,b)", "(a,b)");
	equal($.templates("{{: a+2}}").render({ a: 2, b: false }), "4", "a+2");
	equal($.templates("{{: b?'yes':'no' }}").render({ a: 2, b: false }), "no", "b?'yes':'no'");
	equal($.templates("{{:(a||-1) + (b||-1) }}").render({ a: 2, b: 0 }), "1", "a||-1");
	equal($.templates("{{:3*b()*!a*4/3}}").render({ a: false, b: function () { return 3; }}), "12", "3*b()*!a*4/3");
	equal($.templates("{{:a%b}}").render({ a: 30, b: 16}), "14", "a%b");
	equal($.templates("A_{{if v1 && v2 && v3 && v4}}no{{else !v1 && v2 || v3 && v4}}yes{{/if}}_B").render({v1:true,v2:false,v3:2,v4:"foo"}), "A_yes_B", "x && y || z");
});

module("{{for}}");
test("{{for}}", 17, function() {
	$.templates({
		forTmpl: "header_{{for people}}{{:name}}{{/for}}_footer",
		templateForArray: "header_{{for #data}}{{:name}}{{/for}}_footer",
		pageTmpl: '{{for [people] tmpl="templateForArray"/}}',
		simpleFor: "a{{for people}}Content{{:#data}}|{{/for}}b",
		forPrimitiveDataTypes: "a{{for people}}|{{:#data}}{{/for}}b",
		testTmpl: "xxx{{:name}} {{:~foo}}"
	});

	equal($.render.forTmpl({ people: people }), "header_JoBill_footer", '{{for people}}...{{/for}}');
	equal($.render.templateForArray([people]), "header_JoBill_footer", 'Can render a template against an array, as a "layout template", by wrapping array in an array');
	equal($.render.pageTmpl({ people: people }), "header_JoBill_footer", '{{for [people] tmpl="templateForArray"/}}');
	equal($.templates("{{for}}xxx{{:name}} {{:~foo}}{{/for}}").render({name: "Jeff"},{foo:"fooVal"}), "xxxJeff fooVal", "no parameter - renders once with parent #data context: {{for}}");
	equal($.templates("{{for tmpl='testTmpl'/}}").render({name: "Jeff"},{foo:"fooVal"}), "xxxJeff fooVal", ": {{for tmpl=.../}} no parameter - equivalent to {{include tmpl=.../}} - renders once with parent #data context");
	equal($.templates("{{include tmpl='testTmpl'/}}").render({name: "Jeff"},{foo:"fooVal"}), "xxxJeff fooVal", "{{include tmpl=.../}} with tmpl parameter - renders once with parent #data context. Equivalent to {{for tmpl=.../}}");
	equal($.templates("{{for missingProperty}}xxx{{:#data===~undefined}}{{/for}}").render({}), "", "missingProperty - renders empty string");
	equal($.templates("{{for null}}xxx{{:#data===null}}{{/for}}").render(), "xxxtrue", "null - renders once with #data null: {{for null}}");
	equal($.templates("{{for false}}xxx{{:#data}}{{/for}}").render(), "xxxfalse", "false - renders once with #data false: {{for false}}");
	equal($.templates("{{for 0}}xxx{{:#data}}{{/for}}").render(), "xxx0", "0 - renders once with #data false: {{for 0}}");
	equal($.templates("{{for ''}}xxx{{:#data===''}}{{/for}}").render(), "xxxtrue", "'' - renders once with #data false: {{for ''}}");
	equal($.templates("{{for #data}}{{:name}}{{/for}}").render(people), "JoBill", "If #data is an array, {{for #data}} iterates");

	equal($.render.simpleFor({people:[]}), "ab", 'Empty array renders empty string');
	equal($.render.simpleFor({people:["", false, null, undefined, 1]}), "aContent|Contentfalse|Content|Content|Content1|b", 'Empty string, false, null or undefined members of array are also rendered');
	equal($.render.simpleFor({people:null}), "aContent|b", 'null is rendered once with #data null');
	equal($.render.simpleFor({}), "ab", 'if #data is undefined, renders empty string');
	equal($.render.forPrimitiveDataTypes({people:[0, 1, "abc", "", ,null ,true ,false]}), "a|0|1|abc||||true|falseb", 'Primitive types render correctly, even if falsey');
});

module("api");
test("templates", 14, function() {
	var tmpl = $.templates(tmplString);
	equal(tmpl.render(person), "A_Jo_B", 'Compile from string: var tmpl = $.templates(tmplString);');

	var fnToString = tmpl.fn.toString();
	equal($.templates("", tmplString).fn.toString() === fnToString && $.templates(null, tmplString).fn.toString() === fnToString && $.templates(undefined, tmplString).fn.toString() === fnToString, true,
	'if name is "", null, or undefined, then $.templates(name, tmplString) = $.templates(tmplString);');

	$.templates("myTmpl", tmplString);
	equal($.render.myTmpl(person), "A_Jo_B", 'Compile and register named template: $.templates("myTmpl", tmplString);');

	$.templates({ myTmpl2: tmplString, myTmpl3: "X_{{:name}}_Y" });
	equal($.render.myTmpl2(person) + $.render.myTmpl3(person), "A_Jo_BX_Jo_Y", 'Compile and register named templates: $.templates({ myTmpl: tmplString, myTmpl2: tmplString2 });');

	$.templates("!'-#==", "x");
	$.templates({ '&^~>"2': "y" });
	equal($.render["!'-#=="](person) + $.render['&^~>"2'](person), "xy", 'Named templates can have arbitrary names;');

	$.templates({ myTmpl4: "A_B" });
	equal($.render.myTmpl4(person), "A_B", '$.templates({ myTmpl: htmlWithNoTags });');


	$.templates({
		myTmpl5: {
			markup: tmplString
		}
	});
	equal($.render.myTmpl5(person), "A_Jo_B", '$.templates("myTmpl", tmplObjWithMarkupString);');

	equal($.templates("", { markup: tmplString }).render(person), "A_Jo_B", 'Compile from template object without registering: $.templates("", tmplObjWithMarkupString);');

	$.templates({
		myTmpl6: {
			markup: tmplString
		}
	});
	equal($.render.myTmpl6(person), "A_Jo_B", '$.templates("myTmpl", tmplObjWithMarkupString);');

	$.templates("myTmpl7", tmpl);
	equal($.render.myTmpl7(person), "A_Jo_B", 'Cloning a template: $.templates("newName", tmpl);');

	equal($.templates("", tmpl) === tmpl, true, '$.templates(tmpl) returns tmpl');

	equal($.templates("").render(), "", '$.templates("") is a template with empty string as content');

	$.templates("myEmptyTmpl", "");
	equal($.templates.myEmptyTmpl.render(), "", '$.templates("myEmptyTmpl", "") is a template with empty string as content');

	$.templates("myTmpl", null);
	equal($.templates.myTmpl, undefined, 'Remove a named template:  $.templates("myTmpl", null);');
});

test("render", 18, function() {
	var tmpl1 = $.templates("myTmpl8", tmplString);
	$.templates({
		simple: "Content{{:#data}}|",
		templateForArray: "Content{{for #data}}{{:#index}}{{/for}}",
		primitiveDataTypes: "|{{:#data}}"
	});

	equal(tmpl1.render(person), "A_Jo_B", 'tmpl1.render(data);');
	equal($.render.myTmpl8(person), "A_Jo_B", '$.render.myTmpl8(data);');

	$.templates("myTmpl9", "A_{{for}}inner{{:name}}content{{/for}}_B");
	equal($.templates.myTmpl9.tmpls[0].render(person), "innerJocontent", 'Access nested templates: $.templates["myTmpl9[0]"];');

	$.templates("myTmpl10", "top index:{{:#index}}|{{for 1}}nested index:{{:#get('item').index}}|{{if #get('item').index===0}}nested if index:{{:#get('item').index}}|{{else}}nested else index:{{:#get('item').index}}|{{/if}}{{/for}}");

	equal($.render.myTmpl10(people), "top index:0|nested index:0|nested if index:0|top index:1|nested index:1|nested else index:1|",
										"#get('item').index gives the integer index even in nested blocks");
	$.templates("myTmpl11", "top index:{{:#index}}|{{for people}}nested index:{{:#index}}|{{if #index===0}}nested if index:{{:#get('item').index}}|{{else}}nested else index:{{:#get('item').index}}|{{/if}}{{/for}}");

	equal($.render.myTmpl11({ people: people }), "top index:|nested index:0|nested if index:0|nested index:1|nested else index:1|",
										"#get('item').index gives the integer index even in nested blocks");

	$.views.helpers({ myKeyIsCorrect: function() {
		var view = this;
		return view.parent.views[view._.key] === view;
	}});
	$.templates("myTmpl12", "{{for people}}nested {{:~myKeyIsCorrect()}}|{{if #index===0}}nested if {{:~myKeyIsCorrect()}}|{{else}}nested else {{:~myKeyIsCorrect()}}|{{/if}}{{/for}}");

	equal($.render.myTmpl12({ people: people }), "nested true|nested if true|nested true|nested else true|",
										'view._key gives the key of this view in the parent views collection/object');

	equal($.templates(tmplString).render(person), "A_Jo_B", 'Compile from string: var html = $.templates(tmplString).render(data);');
	equal($.render.myTmpl8(people), "A_Jo_BA_Bill_B", '$.render.myTmpl(array);');
	equal($.render.simple([]), "", 'Empty array renders empty string');
	equal($.render.simple(["",false,null,undefined,1]), "Content|Contentfalse|Content|Content|Content1|", 'Empty string, false, null or undefined members of array are also rendered');
	equal($.render.simple(null), "Content|", 'null renders once with #data null');
	equal($.render.simple(), "Content|", 'Undefined renders once with #data undefined');
	equal($.render.simple(false), "Contentfalse|", 'false renders once with #data false');
	equal($.render.simple(0), "Content0|", '0 renders once with #data 0');
	equal($.render.simple(""), "Content|", '"" renders once with #data ""');

	equal($.render.templateForArray([[null,undefined,1]]), "Content012", 'Can render a template against an array, and render once only, by wrapping array in an array');
	equal($.render.templateForArray([[]]), "Content", 'Can render a template against an empty array, and render once only, by wrapping array in an array');
	equal($.render.primitiveDataTypes([0,1,"abc","",,true,false]), "|0|1|abc|||true|false", 'Primitive types render correctly, even if falsey');
});

test("converters", function() {
	function loc(data) {
		switch (data) { case "desktop": return "bureau"; }
		return data;
	}
	$.views.converters({ loc2: loc });
	equal($.templates("{{loc2:#data}}:{{loc2:'desktop'}}").render("desktop"), "bureau:bureau", "$.views.converters({ loc: locFunction })");

	var locFn = $.views.converters("loc", loc);
	equal(locFn === loc && $.views.converters.loc === loc && $.views.converters.loc2 === loc, true, 'locFunction === $.views.converters.loc === $.views.converters.loc2');

	$.views.converters({ loc2: null});
	equal($.views.converters.loc2, undefined, '$.views.converters({ loc2: null }) to remove registered converter');

	equal($.templates("{{attr:a}}").render({ a: 0 }), "0", '{{attr:0}} returns "0"');
	equal($.templates("{{attr:a}}").render({}), "", "{{attr:undefined}} returns empty string");
	equal($.templates("{{attr:a}}").render({ a: "" }), "", "{{attr:''}} returns empty string");
	equal($.templates("{{attr:a}}").render({ a: null }), "null", '{{attr:null}} returns "null"');
	equal($.templates("{{attr:a}}").render({ a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{attr:"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	equal($.templates("{{>a}}").render({ a: 0 }), "0", '{{>0}} returns "0"');
	equal($.templates("{{>a}}").render({}), "", "{{>undefined}} returns empty string");
	equal($.templates("{{>a}}").render({ a: "" }), "", "{{>''}} returns empty string");
	equal($.templates("{{>a}}").render({ a: null }), "", "{{>null}} returns empty string");
	equal($.templates("{{>a}}").render({ a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{>"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	equal($.templates("{{loc:a}}").render({ a: 0 }), "0", '{{cnvt:0}} returns "0"');
	equal($.templates("{{loc:a}}").render({}), "undefined", '{{cnvt:undefined}} returns empty "undefined"');
	equal($.templates("{{loc:a}}").render({ a: "" }), "", "{{cnvt:''}} returns empty string");
	equal($.templates("{{loc:a}}").render({ a: null }), "null", "{{cnvt:null}} returns null");

	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({}), "||undefined|", "{{attr:undefined}}|{{>undefined}}|{{loc:undefined}}|{{:undefined}} returns correct values");
	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:0}), "0|0|0|0", "{{attr:0}}|{{>0}}|{{loc:0}}|{{:0}} returns correct values");
	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:false}), "false|false|false|false", "{{attr:false}}|{{>false}}|{{loc:false}}|{{:false}} returns correct values");
});

test("tags", function() {
	equal($.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({ people: people }), "BillJo", "$.views.tags({ sort: sortFunction })");

	equal($.templates("{^{sort people reverse=true}}{^{:name}}{{/sort}}").render({ people: people }), "BillJo", "Calling render() with inline data-binding {^{...}} renders normnally without binding");

	equal($.templates("{{sort people reverse=true towns}}{{:name}}{{/sort}}").render({ people: people, towns:towns }), "DelhiParisSeattleBillJo", "Multiple parameters in arbitrary order: {{sort people reverse=true towns}}");

	equal($.templates("{{sort reverse=false people reverse=true towns}}{{:name}}{{/sort}}").render({ people: people, towns:towns }), "DelhiParisSeattleBillJo", "Duplicate named parameters - last wins: {{sort reverse=false people reverse=true towns}}");

	var sort2 = $.views.tags("sort2", sort);
	equal(sort2.render === sort && $.views.tags.sort.render === sort && $.views.tags.sort2.render === sort, true, 'sortFunction === $.views.tags.sort.render === $.views.tags.sort2.render');

	$.views.tags("sort2", null);
	equal($.views.tags.sort2, undefined, '$.views.tags("sort2", null) to remove registered tag');

	$.views.tags("boldTag", {
		render: function() {
			return "<em>" + this.tagCtx.render() + "</em>";
		},
		template: "{{:#data}}"
	});
	equal($.templates("{{boldTag}}{{:#data}}{{/boldTag}}").render("theData"), "<em>theData</em>",
		'Data context inside a block tag using tagCtx.render() is the same as the outer context');

	equal($.templates("{{boldTag/}}").render("theData"), "<em>theData</em>",
		'Data context inside the built-in template of a self-closing tag using tagCtx.render() is the same as the outer context');

	// =============================== Arrange ===============================
	// ................................ Act ..................................
	var eventData = "",

		renderedOutput = $.templates({
			markup: '{^{myWidget name/}}',
			tags: {
				myWidget: {
					init: function(tagCtx, linkCtx) {
						eventData += " init";
					},
					render: function(name, things) {
						eventData += " render";
						return name + " " + this.getType();
					},
					getType: function() {
						eventData += " getType";
						return this.type;
					},
					type: "special"
				}
			}
		}).render(person);

	// ............................... Assert .................................
	equals(renderedOutput + "|" + eventData, "Jo special| init render getType", '{^{myWidget/}} - Events fire in order during rendering: render, onBeforeLink and onAfterLink');
});

test('{{include}} and wrapping content', function() {
	var result = $.templates({
			markup:
				  'Before {{include tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/include}} After',
			templates: {
				wrapper: "header{{include tmpl=#content/}}footer"
			}
		}).render(people);

	equal(result, "Before headerJofooter AfterBefore headerBillfooter After", 'Using {{include ... tmpl="wrapper"}}}wrapped{{/include}}');

	var result = $.templates({
			markup:
				  'This replaces:{{myTag override="replacementText" tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/myTag}}'
				+  'This wraps:{{myTag tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/myTag}}',
			tags: {
				myTag: {
					template: "add{{include tmpl=#content/}}",
					render: function() {
						return this.tagCtx.props.override;
					}
				}
			},
			templates: {
				wrapper: "header{{include tmpl=#content/}}footer"
			}
		}).render(people);

	equal(result, "This replaces:replacementTextThis wraps:headerJofooterThis replaces:replacementTextThis wraps:headerBillfooter", 'Custom tag with wrapped content: {{myTag ... tmpl="wrapper"}}wrapped{{/myTmpl}}');

	var result = $.templates({
			markup:
				  'Before {{include tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/include}} After',
			templates: {
				wrapper: "header{{for people tmpl=#content/}}footer"
			}
		}).render({people: people});

	equal(result, "Before headerJoBillfooter After", 'Using {{for ... tmpl="wrapper"}}}wrapped{{/for}}');

	var result = $.templates({
			markup:
				  'This replaces:{{myTag override="replacementText"}}'
					+ '{{:name}}'
				+ '{{/myTag}}'
				+  'This wraps:{{myTag tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/myTag}}',
			tags: {
				myTag: {
					render: function() {
						return this.tagCtx.props.override;
					}
				}
			},
			templates: {
				wrapper: "header{{for people tmpl=#content/}}footer"
			}
		}).render({people: people});

	equal(result, "This replaces:replacementTextThis wraps:headerJoBillfooter", 'Using {{myTag ... tmpl="wrapper"}}wrapped{{/myTmpl}}');
});

test("helpers", 4, function() {
	$.views.helpers({
		not: function(value) {
			return !value;
		},
		concat: function() {
			return "".concat.apply("", arguments) + "top";
		}
	})
	equal($.templates("{{:~concat(a, 'b', ~not(false))}}").render({ a: "aVal" }), "aValbtruetop", "~concat('a')");

	function toUpperCase(value) {
		return value.toUpperCase();
	}
	var toUpperCaseFn = $.views.helpers("toUpperCase", toUpperCase);
	equal($.templates("{{:~toUpperCase(name)}} {{:~toUpperCase('Foo')}}").render(person), "JO FOO", '$.views.helpers("toUpperCase", toUpperCaseFn);... {{:~toUpperCase(name)}}');

	$.views.helpers({ toUpperCase2: toUpperCase });
	equal(toUpperCaseFn === toUpperCase && $.views.helpers.toUpperCase === toUpperCase && $.views.helpers.toUpperCase2 === toUpperCase, true, 'sortFunction === $.views.helpers.toUpperCase === $.views.helpers("toUpperCase")');

	$.views.helpers("toUpperCase2", null);
	equal($.views.helpers.toUpperCase2, undefined, '$.views.helpers("toUpperCase2", null) to remove registered helper');
});

test("delimiters", 1, function() {
	$.views.settings.delimiters("@%","%@");
	var result = $.templates("A_@%if true%@yes@%/if%@_B").render();
	$.views.settings.delimiters("{{","}}");
	equal(result, "A_yes_B", "Custom delimiters");
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
	equal($.render.myTmpl6({ people: people }), "BillJo", '$.templates("myTmpl", tmplObjWithNestedItems);');
});

})();
})(this, this.jsviews);
