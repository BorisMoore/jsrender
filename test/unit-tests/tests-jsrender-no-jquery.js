/*global test, equal, module, ok, QUnit, _jsv, viewsAndBindings */
(function(global, $, undefined) {
"use strict";

function compileTmpl(template) {
	try {
		return typeof $.templates(template).fn === "function" ? "compiled" : "failed compile";
	}
	catch (e) {
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
		} else {
			for (var i = array.length; i; i--) {
				ret += this.tagCtx.render(array[ i - 1 ]);
			}
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
test("{{if}} {{else}}", 4, function() {
	equal(compileTmpl("A_{{if true}}{{/if}}_B"), "compiled", "Empty if block: {{if}}{{/if}}");
	equal(compileTmpl("A_{{if true}}yes{{/if}}_B"), "compiled", "{{if}}...{{/if}}");
$.views.settings.debugMode(true);
	equal(compileTmpl("A_{{if true/}}yes{{/if}}_B"), "Syntax error\nUnmatched or missing {{/if}}, in template:\nA_{{if true/}}yes{{/if}}_B", "unmatched or missing tag error");
$.views.settings.debugMode(false);
	equal($.templates("<span id='x'></span> a'b\"c\\").render(), "<span id=\'x\'></span> a\'b\"c\\", "Correct escaping of quotes and backslash");
});

module("{{if}}");
test("{{if}}", 4, function() {
	equal($.templates("A_{{if true}}yes{{/if}}_B").render(), "A_yes_B", "{{if a}}: a");
	equal($.templates("A_{{if false}}yes{{/if}}_B").render(), "A__B", "{{if a}}: !a");
	equal($.templates("A_{{if true}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: a");
	equal($.templates("A_{{if false}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: !a");
});

test("{{if}} {{else}}", 9, function() {
	equal($.templates("A_{{if true}}yes{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else}}: a");
	equal($.templates("A_{{if false}}yes{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else}}: !a");
	equal($.templates("A_{{if true}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else b}} {{else}}: a");
	equal($.templates("A_{{if false}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_or_B", "{{if a}} {{else b}} {{else}}: b");
	equal($.templates("A_{{if false}}yes{{else false}}or{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else b}} {{else}}: !a!b");
	equal($.templates("A_{{if undefined}}yes{{else true}}or{{else}}no{{/if}}_B").render({}), "A_or_B", "{{if undefined}} {{else b}} {{else}}: !a!b");
	equal($.templates("A_{{if false}}yes{{else undefined}}or{{else}}no{{/if}}_B").render({}), "A_no_B", "{{if a}} {{else undefined}} {{else}}: !a!b");
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
	equal($.templates('{{:"abc"}}').render(), "abc", '"abc"');
	equal($.templates("{{:true}}").render(), "true", "true");
	equal($.templates("{{:false}}").render(), "false", "false");
	equal($.templates("{{:null}}").render(), "", 'null -> ""');
	equal($.templates("{{:199}}").render(), "199", "199");
	equal($.templates("{{: 199.9 }}").render(), "199.9", "| 199.9 |");
	equal($.templates("{{:-33.33}}").render(), "-33.33", "-33.33");
	equal($.templates("{{: -33.33 }}").render(), "-33.33", "| -33.33 |");
	equal($.templates("{{:-33.33 - 2.2}}").render(), "-35.53", "-33.33 - 2.2");
	equal($.templates("{{:notdefined}}").render({}), "", "notdefined");
	equal($.templates("{{:}}").render("aString"), "aString", "{{:}} returns current data item");
	equal($.templates("{{:x=22}}").render("aString"), "aString", "{{:x=...}} returns current data item");
	equal($.templates("{{:'abc('}}").render(), "abc(", "'abc(': final paren in string is rendered correctly"); // https://github.com/BorisMoore/jsviews/issues/300
	equal($.templates('{{:"abc("}}').render(), "abc(", '"abc(": final paren in string is rendered correctly');
	equal($.templates("{{:(('(abc('))}}").render(), "(abc(", "(('(abc('))");
	equal($.templates('{{:((")abc)"))}}').render(), ")abc)", '((")abc)"))');
});

test("Fallbacks for missing or undefined paths: using {{:some.path onError = 'fallback'}}, etc.", function() {
	var message;
	try {
		$.templates("{{:a.missing.willThrow.path}}").render({a:1});
	} catch (e) {
		message = e.message;
	}
	ok(!!message,
		"{{:a.missing.willThrow.path}} throws: " + message);

	equal($.templates("{{:a.missing.willThrow.path onError='Missing Object'}}").render({a:1}), "Missing Object",
		'{{:a.missing.willThrow.path onError="Missing Object"}} renders "Missing Object"');
	equal($.templates('{{:a.missing.willThrow.path onError=""}}').render({a:1}), "",
		'{{:a.missing.willThrow.path onError=""}} renders ""');
	equal($.templates("{{:a.missing.willThrow.path onError=null}}").render({a:1}), "",
		'{{:a.missing.willThrow.path onError=null}} renders ""');
	equal($.templates("{{>a.missing.willThrow.path onError='Missing Object'}}").render({a:1}), "Missing Object",
		'{{>a.missing.willThrow.path onError="Missing Object"}} renders "Missing Object"');
	equal($.templates('{{>a.missing.willThrow.path onError=""}}').render({a:1}), "",
		'{{>a.missing.willThrow.path onError=""}} renders ""');
	equal($.templates("{{>a.missing.willThrow.path onError=defaultVal}}").render(
		{
			a:1,
			defaultVal: "defaultFromData"
		}), "defaultFromData",
		'{{>a.missing.willThrow.path onError=defaultVal}} renders "defaultFromData"');

	equal($.templates("{{>a.missing.willThrow.path onError=~myOnErrorFunction}}").render({a:1}, {
		myOnErrorFunction: function(e, view) {
			return "Override onError using a callback: " + view.ctx.helperValue + e.message;
		},
		helperValue: "hlp"
	}).slice(0, 38), "Override onError using a callback: hlp",
		'{{>a.missing.willThrow.path onError=~myOnErrorFunction}}" >' +
		' Providing a function "onError=~myOnErrorFunction" calls the function as onError callback');

	equal($.templates("{{>a.missing.willThrow.path onError=myOnErrorDataMethod}}").render(
		{
			a: "dataValue",
			myOnErrorDataMethod: function(e, view) {
				return "Override onError using a callback data method: " + view.data.a;
			}
		}), "Override onError using a callback data method: dataValue",
		'{{>a.missing.willThrow.path onError=myOnErrorDataMethod}}" >' +
		' Providing a function "onError=myOnErrorDataMethod" calls the function as onError callback');

	equal($.templates("1: {{>a.missing.willThrow.path onError=defaultVal}}" +
		" 2: {{:a.missing.willThrow.path onError='Missing Object'}}" +
		" 3: {{:a.missing.willThrow.path onError=''}}" +
		" 4: {{:a.missing.willThrow.path onError=null}}" +
		" 5: {{:a onError='missing'}}" +
		" 6: {{:a.undefined onError='missing'}}" +
		" 7: {{:a.missing.willThrow onError=myCb}} end").render(
		{
			a:"aVal",
			defaultVal: "defaultFromData",
			myCb: function(e, view) {
				return "myCallback: " + view.data.a;
			}
		}), "1: defaultFromData 2: Missing Object 3:  4:  5: aVal 6:  7: myCallback: aVal end",
		'multiple onError fallbacks in same template - correctly concatenated into output');

	equal($.templates({
		markup: "{{withfallback:a.notdefined fallback='fallback for undefined'}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render({a:"yes"}), "fallback for undefined",
		'{{withfallback:a.notdefined fallback="fallback for undefined"}} using converter to get fallback value for undefined properties');

	equal($.templates({
		markup: "1: {{withfallback:a.missing.y onError='Missing object' fallback='undefined prop'}}" +
			" 2: {{withfallback:a.undefined onError='Missing object' fallback='undefined prop'}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render({a:"yes"}), "1: Missing object 2: undefined prop",
		'both fallback for undefined and onError for missing on same tags');

	equal($.templates({
		markup: "1: {{>a.missing.willThrow.path onError=defaultVal}}" +
		" 2: {{:a.missing.willThrow.path onError='Missing Object'}}" +
		" 3: {{:a.missing.willThrow.path onError=''}}" +
		" 4: {{:a onError='missing'}}" +
		" 5: {{:a.undefined onError='missing'}}" +
		" 6: {{:a.missing.willThrow onError=myCb}}" +
		" 7: {{withfallback:a.undefined fallback='undefined prop'}} end",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render(
		{
		a:"aVal",
		defaultVal: "defaultFromData",
		myCb: function(e, view) {
			return "myCallback: " + view.data.a;
		}
	}), "1: defaultFromData 2: Missing Object 3:  4: aVal 5:  6: myCallback: aVal 7: undefined prop end",
	'multiple onError fallbacks or undefined property fallbacks in same template - correctly concatenated into output');

	try {
		message = "";
		$.templates({
			markup: "1: {{>a.missing.willThrow.path onError=defaultVal}}" +
			" 2: {{:a.missing.willThrow.path onError='Missing Object'}}" +
			" 3: {{:a.missing.willThrow.path onError=''}}" +
			" 4: {{:a onError='missing'}}" +
			" 5: {{:a.missing.willThrow.foo}}" +
			" 6: {{:a.undefined onError='missing'}}" +
			" 7: {{:a.missing.willThrow onError=myCb}}" +
			" 8: {{withfallback:a.undefined fallback='undefined prop'}} end",
			converters: {
				withfallback: function(val) {
					return val || this.tagCtx.props.fallback;
				}
			}
		}).render({
			a:"aVal",
			defaultVal: "defaultFromData",
			myCb: function(e, view) {
				return "myCallback: " + view.data.a;
			}
		});
	} catch (e) {
		message = e.message;
	}
	
	ok(!!message,
		'onError/fallback converter and regular thrown error message in same template: throws: "' + message + '"');

	equal($.templates("{{for missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	equal($.templates("{{for true missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for true missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	equal($.templates("{{for true foo=missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for ... foo=missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	equal($.templates("{{for true ~foo=missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for ... ~foo=missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	equal($.templates({
			markup: "{{myTag foo='a'/}} {{myTag foo=missing.willThrow.path onError='Missing Object'/}} {{myTag foo='c' bar=missing.willThrow.path onError='Missing Object'/}} {{myTag foo='c' missing.willThrow.path onError='Missing Object'/}} {{myTag foo='b'/}}",
			tags: {
				myTag: {template: "MyTag: {{:~tag.tagCtx.props.foo}} end"}
			}
		}).render({a:1}), "MyTag: a end Missing Object Missing Object Missing Object MyTag: b end",
		'onError=... for custom tags: e.g. {{myTag foo=missing.willThrow.path onError="Missing Object"/}}');

	equal($.templates({
		markup: "1: {{for a.missing.willThrow.path onError=defaultVal}}yes{{/for}}" +
		" 2: {{if a.missing.willThrow.path onError='Missing Object'}}yes{{/if}}" +
		" 3: {{include a.missing.willThrow.path onError=''/}}" +
		" 4: {{if a onError='missing'}}yes{{/if}}" +
		" 5: {{for a.undefined onError='missing'}}yes{{/for}}" +
		" 6: {{if a.missing.willThrow onError=myCb}}yes{{/if}}" +
		" 7: {{withfallback:a.undefined fallback='undefined prop'}} end" +
		" 8: {{myTag foo=missing.willThrow.path onError='Missing Object'/}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		},
		tags: {
			myTag: {template: "MyTag: {{:~tag.tagCtx.props.foo}} end"}
		}
	}).render(
		{
		a:"aVal",
		defaultVal: "defaultFromData",
		myCb: function(e, view) {
			return "myCallback: " + view.data.a;
		}
	}), "1: defaultFromData 2: Missing Object 3:  4: yes 5:  6: myCallback: aVal 7: undefined prop end 8: Missing Object",
	'multiple onError fallbacks or undefined property fallbacks in same template - correctly concatenated into output');

	try {
		message = "";
		$.templates({
			markup: "1: {{for a.missing.willThrow.path onError=defaultVal}}yes{{/for}}" +
			" 2: {{if a.missing.willThrow.path onError='Missing Object'}}yes{{/if}}" +
			" 3: {{include a.missing.willThrow.path onError=''/}}" +
			" 4: {{if a onError='missing'}}yes{{/if}}" +
			" 5: {{for missing.willThrow.foo}}yes{{/for}}" +
			" 6: {{for a.undefined onError='missing'}}yes{{/for}}" +
			" 7: {{if a.missing.willThrow onError=myCb}}yes{{/if}}" +
			" 8: {{withfallback:a.undefined fallback='undefined prop'}} end",
			converters: {
				withfallback: function(val) {
					return val || this.tagCtx.props.fallback;
				}
			}
		}).render({
			a:"aVal",
			defaultVal: "defaultFromData",
			myCb: function(e, view) {
				return "myCallback: " + view.data.a;
			}
		});
	} catch (e) {
		message = e.message;
	}
	
	ok(!!message,
		'onError/fallback converter and regular thrown error message in same template: throws: "' + message + '"');

	$.views.settings.debugMode(true);
	equal($.templates({
		markup: "1: {{for a.missing.willThrow.path onError=defaultVal}}yes{{/for}}" +
		" 2: {{if a.missing.willThrow.path onError='Missing Object'}}yes{{/if}}" +
		" 3: {{include a.missing.willThrow.path onError=''/}}" +
		" 4: {{if a onError='missing'}}yes{{/if}}" +
		" 5: {{for missing.willThrow.foo}}yes{{/for}}" +
		" 6: {{for a.undefined onError='missing'}}yes{{/for}}" +
		" 7: {{if a.missing.willThrow onError=myCb}}yes{{/if}}" +
		" 8: {{withfallback:a.undefined fallback='undefined prop'}} end",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render(
		{
		a:"aVal",
		defaultVal: "defaultFromData",
		myCb: function(e, view) {
			return "myCallback: " + view.data.a;
		}
	}).slice(0, 8), "{Error: ",
	'In debug mode, onError/fallback converter and regular thrown error message in same template: thrown error replaces the rest of the output (rather than concatenating)');
	$.views.settings.debugMode(false);

});

test("comparisons", 22,function() {
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
		return value[upper ? "toUpperCase" : "toLowerCase"]();
	}
	equal($.templates("{{:~format(name) + ~format(name, true)}}").render(person, { format: format }), "joJO",
		"render(data, { format: formatFn }); ... {{:~format(name, true)}}");
	equal($.templates("{{for people[0]}}{{:~format(~type) + ~format(name, true)}}{{/for}}").render({ people: people}, { format: format, type: "PascalCase" }), "pascalcaseJO",
		"render(data, { format: formatFn }); ... {{:~format(name, true)}}");
	equal($.templates("{{for people ~twn=town}}{{:name}} lives in {{:~format(~twn, true)}}. {{/for}}").render({ people: people, town:"Redmond" }, { format: format }),
		"Jo lives in REDMOND. Bill lives in REDMOND. ",
		"Passing in context to nested templates: {{for people ~twn=town}}");
	equal($.templates("{{if true}}{{for people}}{{:~root.people[0].name}}{{/for}}{{/if}}").render({ people: people}), "JoJo",
		"{{:~root}} returns the top-level data");
});

test("values", 4, function() {
	equal($.templates("{{:a}}").render({ a: 0 }), "0", '{{:0}} returns "0"');
	equal($.templates("{{:a}}").render({}), "", "{{:undefined}} returns empty string");
	equal($.templates("{{:a}}").render({ a: "" }), "", "{{:''}} returns empty string");
	equal($.templates("{{:a}}").render({ a: null }), "", "{{:null}} returns empty string");
});

test("expressions", 18, function() {
	equal(compileTmpl("{{:a++}}"), "Syntax error\na++", "a++");
	equal(compileTmpl("{{:(a,b)}}"), "Syntax error\n(a,b)", "(a,b)");
	equal($.templates("{{: a+2}}").render({ a: 2, b: false }), "4", "a+2");
	equal($.templates("{{: b?'yes':'no' }}").render({ a: 2, b: false }), "no", "b?'yes':'no'");
	equal($.templates("{{:(a||-1) + (b||-1) }}").render({ a: 2, b: 0 }), "1", "a||-1");
	equal($.templates("{{:3*b()*!a*4/3}}").render({ a: false, b: function() { return 3; }}), "12", "3*b()*!a*4/3");
	equal($.templates("{{:a%b}}").render({ a: 30, b: 16}), "14", "a%b");
	equal($.templates("A_{{if v1 && v2 && v3 && v4}}no{{else !v1 && v2 || v3 && v4}}yes{{/if}}_B").render({v1:true,v2:false,v3:2,v4:"foo"}), "A_yes_B", "x && y || z");
	equal($.templates("{{:!true}}").render({}), "false", "!true");
	equal($.templates("{{if !true}}yes{{else}}no{{/if}}").render({}), "no", "{{if !true}}...");
	equal($.templates("{{:!false}}").render({}), "true", "!false");
	equal($.templates("{{if !false}}yes{{else}}no{{/if}}").render({}), "yes", "{{if !false}}...");
	equal($.templates("{{:!!true}}").render({}), "true", "!!true");
	equal($.templates("{{if !!true}}yes{{else}}no{{/if}}").render({}), "yes", "{{if !!true}}...");
	equal($.templates("{{:!(true)}}").render({}), "false", "!(true)");
	equal($.templates("{{:!true === false}}").render({}), "true", "!true === false");
	equal($.templates("{{:false === !true}}").render({}), "true", "false === !true");
	equal($.templates("{{:false === !null}}").render({}), "false", "false === !null");
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

module("{{props}}");
test("{{props}}", 15, function() {
	$.templates({
		propsTmpl: "header_{{props person}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}_footer",
		propsTmplObjectArray: "header_{{props people}}Key: {{:key}} - Prop: {{for prop}}{{:name}} {{/for}}{{/props}}_footer",
		propsTmplPrimitivesArray: "header_{{props people}}Key: {{:key}} - Prop: {{for prop}}{{:name}} {{/for}}{{/props}}_footer",
		templatePropsArray: "header_{{props #data}}Key: {{:key}} - Prop: {{for prop}}{{:name}} {{/for}}{{/props}}_footer",
		propTmpl: "Key: {{:key}} - Prop: {{:prop}}",
		pageTmpl: '{{props person tmpl="propTmpl"/}}',
		simpleProps: "a{{props people}}Content{{:#data}}|{{/props}}b",
		propsPrimitiveDataTypes: "a{{props people}}|{{:#data}}{{/props}}b",
		testTmpl: "xxx{{:name}} {{:~foo}}"
	});

	equal($.render.propsTmpl({ person: people[0] }), "header_Key: name - Prop: Jo| _footer", '{{props person}}...{{/props}} for an object iterates over properties');
	equal($.render.propsTmplObjectArray({ people: people }), "header_Key: 0 - Prop: Jo Key: 1 - Prop: Bill _footer", '{{props people}}...{{/props}} for an array iterates over the array - with index as key and object a prop');
	equal($.render.templatePropsArray([people]), "header_Key: 0 - Prop: Jo Key: 1 - Prop: Bill _footer", 'Can render a template against an array, as a "layout template", by wrapping array in an array');
	equal($.render.pageTmpl({ person: people[0] }), "Key: name - Prop: Jo", '{{props person tmpl="propTmpl"/}}');
	equal($.templates("{{props}}{{:key}} {{:prop}}{{/props}}").render({name: "Jeff"}), "name Jeff", "no parameter - defaults to current data item");
	equal($.templates("{{props foo}}xxx{{:key}} {{:prop}} {{:~foo}}{{/props}}").render({name: "Jeff"}), "", "undefined arg - renders nothing");
	equal($.templates("{{props tmpl='propTmpl'/}}").render({name: "Jeff"}), "Key: name - Prop: Jeff", ": {{props tmpl=.../}} no parameter - defaults to current data item");

	equal($.templates("{{props null}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "null - renders nothing");
	equal($.templates("{{props false}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "false - renders nothing");
	equal($.templates("{{props 0}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "0 - renders nothing");
	equal($.templates("{{props 'abc'}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "'abc' - renders nothing");
	equal($.templates("{{props ''}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "'' - renders nothing");
	equal($.templates("{{props #data}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(people),
	"Key: name - Prop: Jo| Key: name - Prop: Bill| ",
	"If #data is an array, {{props #data}} iterates");

	equal($.render.propsTmpl({person:{}}), "header__footer", 'Empty object renders empty string');
	equal($.render.propsTmpl({person:{zero: 0, one: 1, str: "abc", emptyStr: "", nullVal: null , trueVal: true , falseVal: false}}),
	"header_Key: zero - Prop: 0| Key: one - Prop: 1| Key: str - Prop: abc| Key: emptyStr - Prop: | Key: nullVal - Prop: | Key: trueVal - Prop: true| Key: falseVal - Prop: false| _footer",
	'Primitive types render correctly, even if falsey');
});

module("allowCode");
test("{{*}}", function() {
	// =============================== Arrange ===============================
	window.glob = {a: "AA"};

	var tmpl = $.templates("_{{*:glob.a}}_");

	// ................................ Assert ..................................
	equal(tmpl.render(), "__",
		"{{*:expression}} returns nothing if allowCode not set to true");

	// =============================== Arrange ===============================
	$.views.settings.allowCode = true;

	var result = "" + !!tmpl.allowCode + " " + tmpl.render(); // Still returns "__" until we recompile

	tmpl.allowCode = true;

	result += "|" + !!tmpl.allowCode + " " + tmpl.render(); // Still returns "__" until we recompile

	// ................................ Assert ..................................
	equal(result, "false __|true __",
		"If $.settings.allowCode or tmpl.allowCode are set to true, previously compiled template is unchanged, so {{*}} still inactive");

	// ................................ Act ..................................
	tmpl = $.templates("_{{*:glob.a}}_");

	result = "" + !!tmpl.allowCode + " " + tmpl.render(); // Now {{*}} is active

	// ................................ Assert ..................................
	equal(result, "true _AA_",
		"If $.settings.allowCode set to true, {{*: expression}} returns evaluated expression, with access to globals");
	
	// =============================== Arrange ===============================
	$.views.settings.allowCode = false;

	tmpl = $.templates({
		markup: "_{{*:glob.a}}_",
		allowCode: true
	});

	// ................................ Assert ..................................
	equal(tmpl.render(), "_AA_",
		"If template allowCode property set to true, {{*: expression}} returns evaluated expression, with access to globals");

	// ................................ Act ..................................
	tmpl = $.templates({
		markup: "_{{*:glob.a}}_",
	});

	result = "" + !!tmpl.allowCode + ":" + tmpl();

	tmpl = $.templates({markup: tmpl, allowCode: true});

	result += "|" + tmpl.allowCode + ":" + tmpl();

	// ................................ Assert ..................................
	equal(result, "false:__|true:_AA_",
		"Can recompile tmpl to allow code, using tmpl = $.templates({markup: tmpl, allowCode: true})");

	// ................................ Act ..................................
	$.templates("myTmpl", {
		markup: "_{{*:glob.a}}_",
	});

	tmpl = $.templates.myTmpl;
	
	result = "" + !!tmpl.allowCode + ":" + tmpl();

	$.templates("myTmpl", {markup: $.templates.myTmpl, allowCode: true});

	tmpl = $.templates.myTmpl;

	result += "|" + tmpl.allowCode + ":" + tmpl();

	// ................................ Assert ..................................
	equal(result, "false:__|true:_AA_",
		'Can recompile named tmpl to allow code, using $.templates("myTemplateName", {markup: $.templates.myTmpl, allowCode:true})"');

	// =============================== Arrange ===============================
	$.views.settings.allowCode = true;
	window.people = people;
	tmpl = $.templates("{{:start}}"

		+ "{{* for (var i=0, l=people.length; i<l; i++) { }}"
			+ " {{:title}} = {{*: people[i].name + ' ' + data.sep + ' '}}!"
		+ "{{* } }}"

		+ "{{:end}}");

	// ................................ Assert ..................................
	equal(tmpl.render({title: "name", start: "Start", end: "End", sep: "..."}), "Start name = Jo ... ! name = Bill ... !End",
		"If allowCode set to true, on recompiling the template, {{*:expression}} returns evaluated expression, with access to globals");

	// ................................ Act ..................................
	window.myFunction = function() {
		return "myGlobalfunction ";
	};
	document.title = "myTitle";
	tmpl = $.templates("{{for people}}"
		+ "{{*: ' ' + glob.a}} {{*: data.name}} {{*: view.index}} {{*: view.ctx.myHelper}} {{*: myFunction() + document.title}}"
	+ "{{/for}}"

	);
	// ................................ Assert ..................................
	equal(tmpl.render({people: people}, {myHelper: "hi"}), " AA Jo 0 hi myGlobalfunction myTitle AA Bill 1 hi myGlobalfunction myTitle",
		"{{* expression}} or {{*: expression}} can access globals, the data, the view, the view context, global functions etc.");

	document.title = "";
});

module("All tags");
test("itemVar", 10, function() {
	var otherPeople = [
		{name: "Jo", otherTels: [1, 2]},
		{name: "Bill", tels: [91,92]},
		{name: "Fred"}
	];
	var message = "";
	try {
		$.templates(
			"{{for people itemVar='person'}}"
				+ "{{:~person.name}} "
			+ "{{/for}}"
			).render({ people: people});
	}
	catch (e) {
		message = e.message;	
	}

	equal(message, "Syntax error\nUse itemVar='~myItem'",
		"Setting itemVar='something' without initial '~' throws syntax error");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{:~person.name}} "
		+ "{{/for}}"
		).render({ people: people}),
		"Jo Bill ",
		"Setting {{for people itemVar='~person'}} creates ~person contextual variable");

	equal($.templates(
		"{{for people}}"
			+ "{{:name}}"
		+ "{{else others itemVar='~otherPerson'}}"
			+ "{{:~otherPerson.name}} "
		+ "{{/for}}"
		).render({others: people}),
		"Jo Bill ",
		"Can use itemVar on {{for}}{{else}} too: {{else others itemVar='~otherPerson'}}");

	equal($.templates(
		"{{for people}}"
			+ "{{if tels itemVar='~person'}}"
				+ "{{:name}} {{:~person.name}} "
			+ "{{else otherTels itemVar='~sameperson'}}"
				+ "{{:~sameperson.name}} "
			+ "{{else itemVar='~stillperson'}}"
				+ "{{:~stillperson.name}} "
			+ "{{/if}}"
		+ "{{/for}}"
		).render({ people: otherPeople }),
		"Jo Bill Bill Fred ",
		"itemVar works also on {{if}}{{else}}{{/if}} even though the context is same as outer context for {{if}}.");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{for tels itemVar='~tel'}}"
				+ "{{:~person.name}} "
				+ "{{:~tel}} "
			+ "{{else otherTels itemVar='~othertel'}}"
				+ "{{:~person.name}} "
				+ "{{:~othertel}} "
			+ "{{else itemVar='~theperson'}}"
				+ "{{:~theperson===~person&&~person===#data}} "
				+ "{{:~theperson.name}} "
				+ "no phones"
			+ "{{/for}}"
		+ "{{/for}}"
		).render({ people: otherPeople }),
		"Jo 1 Jo 2 Bill 91 Bill 92 true Fred no phones",
		"itemVar works also on {{for arr1}}{{else arr2}}{{else}}{{/for}} even though the context for the final {{else}} is the same as outer context for {{if}}.");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{:~person.name}}"
			+ "{{if ~person.tels itemVar='~ifVar'}}"
					+ " Phones:"
					+ "{{for ~ifVar.tels itemVar='~tel'}}"
						+ " {{:~tel}}"
					+ "{{/for}}"
				+ "{{/if}}. "
			+ "{{/for}}"
		).render({ people: otherPeople }),
		"Jo. Bill Phones: 91 92. Fred. ",
		"Using itemVar and passing context to nested templates");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{:~person.name}}"
			+ "{{for ~person.tels itemVar='~tel'}}"
				+ " {{:~tel}}"
			+ "{{else otherTels itemVar='~tel'}}"
				+ " {{:~tel}}"
			+ "{{else}}"
				+ " (No phones)"
			+ "{{/for}}"
			+ ". "
		+ "{{/for}}"
		).render({ people: otherPeople }),
		"Jo 1 2. Bill 91 92. Fred (No phones). ",
		"Additional example using itemVar and passing context to nested templates");

	equal($.templates({
		markup:
			"{{wrappedFor people 'u' itemVar='~person'}}"
				+ "{{:~person.name}} "
				+ "{{wrappedFor ~person.tels 'i' itemVar='~tel'}}"
					+ "{{:~tel}} "
				+ "{{else otherTels 'b' itemVar='~tel'}}"
					+ "{{:~tel}} "
				+ "{{/wrappedFor}}"
			+ "{{/wrappedFor}}",
			tags: {
				wrappedFor: function(val, wrapTag) {
					if (val) {
						return "<" + wrapTag + ">" + this.tagCtx.render(val) + "</" + wrapTag + ">";
					}
				}
			}
		}).render({ people: otherPeople }),
		"<u>Jo  <b>1 2 </b>Bill <i>91 92 </i> Fred   </u>",
		"itemVar with custom tags {{wrappedFor}}{{else}}{{/wrappedFor}}, and passing context to nested templates");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{props ~person itemVar='~prop'}}"
				+ "{{:~prop.key}}: {{:~prop.prop}} "
			+ "{{/props}}"
		+ "{{/for}}"
		).render({ people: otherPeople }),
		"name: Jo otherTels: 1,2 name: Bill tels: 91,92 name: Fred ",
		"itemVar with {{props}}, and passing context to nested templates");

	equal($.templates(
		"{{for people itemVar='~person'}}"
			+ "{{props ~person.tels itemVar='~prop'}}"
				+ "{{:~person.name}} Tel: {{:~prop.key}}: {{:~prop.prop}} "
			+ "{{else itemVar='~personWithoutTels'}}"
				+ "{{:~personWithoutTels.name}}: has no tels "
			+ "{{/props}}"
		+ "{{/for}}"
		).render({ people: otherPeople }),
		"Jo: has no tels Bill Tel: 0: 91 Bill Tel: 1: 92 Fred: has no tels ",
		"itemVar with {{props}}{{else}}{{/props}}, and passing context to nested templates");
});

module("api");
test("templates", function() {
	// =============================== Arrange ===============================
	tmplString = "A_{{:name}}_B";

	var tmpl = $.templates(tmplString);
	// ............................... Assert .................................
	equal(tmpl.render(person), "A_Jo_B",
		'Compile from string: var tmpl = $.templates(tmplString);');

	// ............................... Assert .................................
	equal(tmpl(person), "A_Jo_B",
		'Compiled template is itself the render function: html = tmpl(data);');

	// =============================== Arrange ===============================
	var fnToString = tmpl.fn.toString();

	// ............................... Assert .................................
	equal($.templates("", tmplString).fn.toString() === fnToString && $.templates(null, tmplString).fn.toString() === fnToString && $.templates(undefined, tmplString).fn.toString() === fnToString, true,
		'if name is "", null, or undefined, then var tmpl = $.templates(name, tmplString) is equivalent to var tmpl = $.templates(tmplString);');

	// =============================== Arrange ===============================
	$.templates("myTmpl", tmplString);

	// ............................... Assert .................................
	equal($.render.myTmpl(person), "A_Jo_B",
		'Compile and register named template: $.templates("myTmpl", tmplString);');

	// =============================== Arrange ===============================
	$.templates({ myTmpl2: tmplString, myTmpl3: "X_{{:name}}_Y" });

	// ............................... Assert .................................
	equal($.render.myTmpl2(person) + $.render.myTmpl3(person), "A_Jo_BX_Jo_Y",
		'Compile and register named templates: $.templates({ myTmpl: tmplString, myTmpl2: tmplString2 });');

	// =============================== Arrange ===============================
	$.templates("!'-#==", "x");
	$.templates({ '&^~>"2': "y" });
	equal($.render["!'-#=="](person) + $.render['&^~>"2'](person), "xy",
		'Named templates can have arbitrary names;');

	$.templates({ myTmpl4: "A_B" });

	// ............................... Assert .................................
	equal($.render.myTmpl4(person), "A_B",
		'$.templates({ myTmpl: htmlWithNoTags });');

	// =============================== Arrange ===============================
	$.templates("myTmpl5", {
		markup: tmplString
	});

	// ............................... Assert .................................
	equal($.render.myTmpl5(person), "A_Jo_B",
		'$.templates("myTmpl", {markup: markupString});');

	// ............................... Assert .................................
	equal($.templates("", { markup: tmplString }).render(person), "A_Jo_B",
		'Compile from template object without registering: var tmpl = $.templates("", {markup: markupString});');

	// ............................... Assert .................................
	equal($.templates({ markup: tmplString }).render(person), "A_Jo_B",
		'Compile from template object without registering: var tmpl = $.templates({markup: markupString});');

	// =============================== Arrange ===============================
	$.templates({
		myTmpl6: {
			markup: tmplString
		}
	});

	// ............................... Assert .................................
	equal($.render.myTmpl6(person), "A_Jo_B",
		'$.templates({myTmpl: {markup: markupString}});');

	// =============================== Arrange ===============================
	$.templates("myTmpl7", tmpl);

	// ............................... Assert .................................
	equal($.render.myTmpl7(person), "A_Jo_B",
		'Cloning a template: $.templates("newName", tmpl);');

	// ............................... Assert .................................
	equal($.templates(tmpl) === tmpl, true,
		'$.templates(tmpl) returns tmpl');

	// ............................... Assert .................................
	equal($.templates("", tmpl) === tmpl, true,
		'$.templates("", tmpl) returns tmpl');

	// =============================== Arrange ===============================
	var tmplWithHelper = $.templates("A_{{:name}}_B{{:~foo}}");
	var result = tmplWithHelper(person, {foo: "thisFoo"});

	var tmplWithHelper2 = $.templates({markup: tmplWithHelper, helpers: {foo: "thatFoo"}});
	result += "|" + tmplWithHelper2(person)

	// ............................... Assert .................................
	equal(result, "A_Jo_BthisFoo|A_Jo_BthatFoo",
		'Cloning a template to add/replace/change some template properties: var tmpl2 = $.templates({markup: tmpl1, otherOptions...});');

	// ............................... Assert .................................
	equal($.templates("", tmpl) === tmpl, true,
		'$.templates(tmpl) returns tmpl');

	// ............................... Assert .................................
	equal($.templates("").render(), "",
		'$.templates("") is a template with empty string as content');

	// =============================== Arrange ===============================
	$.templates("myEmptyTmpl", "");

	// ............................... Assert .................................
	equal($.templates.myEmptyTmpl.render(), "",
		'$.templates("myEmptyTmpl", "") is a template with empty string as content');

	// =============================== Arrange ===============================
	$.templates("myTmpl", null);

	// ............................... Assert .................................
	equal($.templates.myTmpl === undefined && $.render.myTmpl === undefined, false,
		'Remove a named template: $.templates("myTmpl", null);');
});

test("render", 26, function() {
	var tmpl1 = $.templates("myTmpl8", tmplString);
	$.templates({
		simple: "Content{{:#data}}|",
		templateForArray: "Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}",
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

	$.views.tags({
		myWrap: {}
	});

	var templateWithIndex = $.templates(
			'{{for people}}'
			+ 'a{{:#index}} '
			+ '{{if true}}b{{:#index}}{{/if}} '
			+ 'c{{:#index}} '
			+ '{{myWrap}}d{{:#index}} {{/myWrap}}'
		+ '{{/for}}');

	$.views.settings.debugMode(true);

	equal(templateWithIndex.render({people: [1,2]}),
		"a0 bFor #index in nested block use #getIndex(). c0 dFor #index in nested block use #getIndex(). a1 bFor #index in nested block use #getIndex(). c1 dFor #index in nested block use #getIndex(). ",
		"If debug mode is true, #index gives error message in nested blocks.");

	$.views.settings.debugMode(false);

	equal(templateWithIndex.render({people: [1,2]}),
		"a0 bFor #index in nested block use #getIndex(). c0 dFor #index in nested block use #getIndex(). a1 bFor #index in nested block use #getIndex(). c1 dFor #index in nested block use #getIndex(). ",
		"If debug mode is false, #index still gives error message in nested blocks");

	var templateWithGetIndex = $.templates(
			'{{for people}}'
			+ 'a{{:#getIndex()}} '
			+ '{{if true}}b{{:#getIndex()}}{{/if}} '
			+ 'c{{:#getIndex()}} '
			+ '{{myWrap}}d{{:#getIndex()}} {{/myWrap}}'
		+ '{{/for}}');

	equal(templateWithGetIndex.render({people: [1,2]}),
		"a0 b0 c0 d0 a1 b1 c1 d1 ",
		"#getIndex gives inherited index in nested blocks.");

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

	equal($.render.templateForArray([[null,undefined,1]]), "Content012", 'Can render a template against an array without iteration, by wrapping array in an array');
	equal($.render.templateForArray([null,undefined,1], true), "Content012", 'render(array, true) renders an array without iteration');
	equal($.render.templateForArray([null,undefined,1], {foo:"foovalue"}, true), "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');
	equal($.templates.templateForArray.render([null,undefined,1], {foo:"foovalue"}, true), "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');
	equal($.render.templateForArray([[]]), "Content", 'Can render a template against an empty array without iteration, by wrapping array in an array');
	equal($.render.templateForArray([], true), "Content", 'Can render a template against an empty array without iteration, by passing in true as second parameter');
	equal($.render.templateForArray([], {foo: "foovalue"}, true), "Contentfoovalue", 'Can render a template against an empty array without iteration, by by passing in true as third parameter');
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
	equal($.templates("{{attr:a}}").render({ a: null }), "", '{{attr:null}} returns empty string');
	equal($.templates("{{attr:a}}").render({ a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{attr:"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	equal($.templates("{{>a}}").render({ a: 0 }), "0", '{{>0}} returns "0"');
	equal($.templates("{{>a}}").render({}), "", "{{>undefined}} returns empty string");
	equal($.templates("{{>a}}").render({ a: "" }), "", "{{>''}} returns empty string");
	equal($.templates("{{>a}}").render({ a: null }), "", "{{>null}} returns empty string");
	equal($.templates("{{>a}}").render({ a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{>"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	equal($.templates("{{loc:a}}").render({ a: 0 }), "0", '{{cnvt:0}} returns "0"');
	equal($.templates("{{loc:a}}").render({}), "", '{{cnvt:undefined}} returns empty string');
	equal($.templates("{{loc:a}}").render({ a: "" }), "", "{{cnvt:''}} returns empty string");
	equal($.templates("{{loc:a}}").render({ a: null }), "", "{{cnvt:null}} returns empty string");

	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({}), "|||", "{{attr:undefined}}|{{>undefined}}|{{loc:undefined}}|{{:undefined}} returns correct values");
	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:0}), "0|0|0|0", "{{attr:0}}|{{>0}}|{{loc:0}}|{{:0}} returns correct values");
	equal($.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:false}), "false|false|false|false", "{{attr:false}}|{{>false}}|{{loc:false}}|{{:false}} returns correct values");
});

test("{{sometag convert=converter}}", function() {
	function loc(data) {
		switch (data) {
			case "desktop": return "bureau";
			case "a<b": return "a moins <que b";}
		return data;
	}
	$.views.converters("loc", loc);

	equal($.templates("1{{:#data convert='loc'}} 2{{:'desktop' convert='loc'}} 3{{:#data convert=~myloc}} 4{{:'desktop' convert=~myloc}}").render("desktop", {myloc: loc}), "1bureau 2bureau 3bureau 4bureau", "{{: convert=~myconverter}}");
	equal($.templates("1:{{:'a<b' convert=~myloc}} 2:{{> 'a<b'}} 3:{{html: 'a<b' convert=~myloc}} 4:{{> 'a<b' convert=~myloc}} 5:{{attr: 'a<b' convert=~myloc}}").render(1, {myloc: loc}),
		"1:a moins <que b 2:a&lt;b 3:a&lt;b 4:a&lt;b 5:a moins <que b",
		"{{foo: convert=~myconverter}} convert=converter is used rather than {{foo:, but with {{html: convert=~myconverter}} or {{> convert=~myconverter}} html converter takes precedence and ~myconverter is ignored");
	equal($.templates("{{if true convert=~invert}}yes{{else false convert=~invert}}no{{else}}neither{{/if}}").render('desktop', {invert: function(val) {return !val;}}), "no", "{{if expression convert=~myconverter}}...{{else expression2 convert=~myconverter}}... ");
	equal($.templates("{{for #data convert=~reverse}}{{:#data}}{{/for}}").render([1,2,3], {reverse: function(val) {return val.reverse();}}, true), "321", "{{for expression convert=~myconverter}}");
});

test("tags", function() {
	equal($.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({ people: people }), "BillJo", "$.views.tags({ sort: sortFunction })");

	equal($.templates("{^{sort people reverse=true}}{^{:name}}{{/sort}}").render({ people: people }), "BillJo", "Calling render() with inline data-binding {^{...}} renders normally without binding");

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

	equal($.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({ people: people }), "BillJo", "$.views.tags({ sort: sortFunction })");

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
	equal(renderedOutput + "|" + eventData, "Jo special| init render getType", '{^{myWidget/}} - Events fire in order during rendering: render, onBeforeLink and onAfterLink');

	// =============================== Arrange ===============================
	$.views.tags({
		noRenderNoTemplate: {},
		voidRender: function() {},
		emptyRender: function() { return ""; },
		emptyTemplate: {
			template: ""
		},
		templateReturnsEmpty: {
			template: "{{:a}}"
		}
	});

	// ............................... Assert .................................
	equal($.templates("a{{noRenderNoTemplate/}}b{^{noRenderNoTemplate/}}c{{noRenderNoTemplate}}{{/noRenderNoTemplate}}d{^{noRenderNoTemplate}}{{/noRenderNoTemplate}}e").render(1), "abcde",
	"non-rendering tag (no template, no render function) renders empty string");

	equal($.templates("a{{voidRender/}}b{^{voidRender/}}c{{voidRender}}{{/voidRender}}d{^{voidRender}}{{/voidRender}}e").render(1), "abcde",
	"non-rendering tag (no template, no return from render function) renders empty string");

	equal($.templates("a{{emptyRender/}}b{^{emptyRender/}}c{{emptyRender}}{{/emptyRender}}d{^{emptyRender}}{{/emptyRender}}e").render(1), "abcde",
	"non-rendering tag (no template, empty string returned from render function) renders empty string");

	equal($.templates("a{{emptyTemplate/}}b{^{emptyTemplate/}}c{{emptyTemplate}}{{/emptyTemplate}}d{^{emptyTemplate}}{{/emptyTemplate}}e").render(1), "abcde",
	"non-rendering tag (template has no content, no render function) renders empty string");

	equal($.templates("a{{templateReturnsEmpty/}}b{^{templateReturnsEmpty/}}c{{templateReturnsEmpty}}{{/templateReturnsEmpty}}d{^{templateReturnsEmpty}}{{/templateReturnsEmpty}}e").render(1), "abcde",
	"non-rendering tag (template returns empty string, no render function) renders empty string");

	$.views.tags({
		tagJustTemplate: {
			template: "{{:#data ? name||length : 'Not defined'}} "
		},
		tagWithTemplateWhichIteratesAgainstCurrentData: {
			template: "{{:#data ? name : 'Not defined'}} ",
			render: function() {
				return this.tagCtx.render(); // Renders against current data - and iterates if array
			}
		},
		tagJustRender: function(val) {
			return val.name + " ";
		},
		tagJustRenderArray: function(val) {
			return val.length + " ";
		},
		tagWithTemplateNoIteration: {
			render: function(val) {
				return this.tagCtx.render(val, true); // Render without iteration
			},
			template: "{{:#data.length}} "
		},
		tagWithTemplateNoIterationWithHelpers: {
			render: function(val) {
				return this.tagCtx.render(val, {foo: "foovalue"}, true); // Render without iteration
			},
			template: "{{:#data.length}} {{:~foo}}"
		},
		tagWithTemplateWhichIteratesFirstArg: {
			template: "{{:#data ? name : 'Not defined'}} ",
			render: function(val) {
				return this.tagCtx.render(val); // Renders against first arg - defaults to current data - and iterates if array
			}
		}
	});

	equal($.templates("a{{include person}}{{tagJustTemplate/}}{{/include}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a template and no param renders once against current data, if object");

	equal($.templates("a{{include person}}{{tagJustTemplate undefinedProperty/}}{{/include}}").render({person: {name: "Jo"}}), "aNot defined ",
	"Tag with just a template and a parameter which is not defined renders once against 'undefined'");

	equal($.templates("a{{include people}}{{tagJustTemplate/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a template and no param renders once against current data, even if array - but can add render method with tagCtx.render(val) to iterate - (next test)");

	equal($.templates("a{{include people}}{{tagWithTemplateWhichIteratesAgainstCurrentData/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render() iterates against current data if array");

	equal($.templates("a{{include people}}{{tagWithTemplateWhichIteratesAgainstCurrentData thisisignored/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render() iterates against current data if array - and ignores argument if provided");

	equal($.templates("a{{include people}}{{tagWithTemplateWhichIteratesFirstArg/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render(val) renders against first arg - or defaults to current data, and iterates if array");

	equal($.templates("a{{tagWithTemplateWhichIteratesFirstArg people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render(val) iterates against argument if array");

	equal($.templates("a{{include people}}{{tagWithTemplateNoIteration/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"If current data is an array, a tag with a template and a render method calling tagCtx.render(val, true) and no param renders against array without iteration");

	equal($.templates("a{{include people}}{{tagWithTemplateNoIterationWithHelpers/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 foovalue",
	"If current data is an array, a tag with a template and a render method calling tagCtx.render(val, helpers, true) and no param renders against array without iteration");

	equal($.templates("a{{include person}}{{tagJustRender/}}{{/include}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a render and no param renders once against current data, if object");

	equal($.templates("a{{include people}}{{tagJustRenderArray/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a render and no param renders once against current data, even if array - but render method can choose to iterate");

	equal($.templates("a{{tagJustTemplate person/}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a template and renders once against first argument data, if object");

	equal($.templates("a{{tagJustTemplate people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a template renders once against first argument data even if it is an array - but can add render method with tagCtx.render(val) to iterate - (next test)");

	equal($.templates("a{{tagWithTemplateWhichIteratesFirstArg people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and render method calling tagCtx.render(val) renders against first param data, and iterates if array");

});

test("derived tags", function() {
	// =============================== Arrange ===============================
	var tmpl = $.templates("a:{{A 1/}} b:{{B 2/}}"),

		tagA = $.views.tags("A",
			function(val) { return "A" + val; },
			tmpl
		);

		$.views.tags("B",
			{
				baseTag: tagA,
				render: function(val) {
					return "B" + val + this.base(val);
				}
			},
			tmpl
		);

	// ................................ Act ..................................
	var result = tmpl.render({});

	// ............................... Assert .................................
	equal(result, "a:A1 b:B2A2", "One level tag inheritance chain - calling base method");

	// =============================== Arrange ===============================
	tmpl = $.templates("a:{{A 1 2 3/}} b:{{B 11 12 13/}} c:{{C 21 22 23/}} d:{{D 31 32 33/}} e:{{E 41 42 43/}}");

		tagA = $.views.tags("A",
			function(val) { return "A" + val; },
			tmpl
		);

		$.views.tags("B",
			{
				baseTag: tagA,
				foo: function(val) {
					return "FOO-B:" + val;
				},
				render: function(val) {
					return "B" + val + this.base(val);
				}
			},
			tmpl
		);

		var tagC = $.views.tags("C",
			{
				baseTag: "A",
				foo: function(val) {
					return "FOO-C:" + val;
				},
				bar: function(x, y, z) {
					return "BAR-C" + x + y + z;
				},
				render: function(val) {
					return "C" + val + this.base(val) + this.foo(val) + this.bar.apply(this, this.tagCtx.args);
				}
			},
			tmpl
		);

		$.views.tags("D",
			{
				baseTag: tagC,
				render: function(val) {
					return "D" + val + this.base(val);
				}
			},
			tmpl
		),

		$.views.tags("E",
			{
				baseTag: "D",
				foo: function(val) {
					return "FOO-E" + val + this.base(val);
				},
				bar: function(x, y, z) {
					return "BAR-E" + x + y + z + this.baseApply(arguments);
				},
				render: function(val) {
					return "E" + val + this.base(val);
				}
			},
			tmpl
		);

	// ................................ Act ..................................
	result = tmpl.render({});

	// ............................... Assert .................................
	equal(result, "a:A1 b:B11A11 c:C21A21FOO-C:21BAR-C212223 d:D31C31A31FOO-C:31BAR-C313233 e:E41D41C41A41FOO-E41FOO-C:41BAR-E414243BAR-C414243", "Complex multi-level inheritance chain");

	// =============================== Arrange ===============================
	$.views.settings.debugMode(true);
	tmpl = $.templates("a:{{A 1 2 3/}}");

		tagA = $.views.tags("A",
			function(val) {
				return "A" + val + this.baseApply(arguments);
			},
			tmpl
		);
	$.views.settings.debugMode(false);

	// ................................ Act ..................................
	result = tmpl.render({});
	
	// ............................... Assert .................................
	equal(result.slice(0, 8), "{Error: ", "Calling base or baseApply when there is no base tag: Type Error");

	// =============================== Arrange ===============================
	tmpl = $.templates("a:{{A 1 2 3/}} b:{{B 11 12 13/}} c:{{C 21 22 23/}}");

		tagA = $.views.tags("A",
			function(val) {
				return "A" + val;
			},
			tmpl
		);

		$.views.tags("B",
			{
				baseTag: tagA,
				render: function(val) {
					return "B" + val + this.base(val);
				}
			},
			tmpl
		);

		tagC = $.views.tags("C",
			{
				baseTag: "A",
				bar: function(x, y, z) {
					return "BAR-C" + x + y + z + " Missing base method call: " + this.base(x) + this.baseApply(arguments) + ".";
				},
				render: function(val) {
					return "C" + val + this.bar.apply(this, this.tagCtx.args);
				}
			},
			tmpl
		);

	// ................................ Act ..................................
	result = tmpl.render({});

	// ............................... Assert .................................
	equal(result, "a:A1 b:B11A11 c:C21BAR-C212223 Missing base method call: .",
	'Calling base or baseApply when there is no corresponding method on base tag implementation: noop - returning ""');

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

	result = $.templates({
		markup:
				'This replaces:{{myTag override="replacementText" tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/myTag}}'
			+ 'This wraps:{{myTag tmpl="wrapper"}}'
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

	result = $.templates({
		markup:
				'Before {{include tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/include}} After',
		templates: {
			wrapper: "header{{for people tmpl=#content/}}footer"
		}
	}).render({people: people});

	equal(result, "Before headerJoBillfooter After", 'Using {{for ... tmpl="wrapper"}}}wrapped{{/for}}');

	result = $.templates({
		markup:
				'This replaces:{{myTag override="replacementText"}}'
				+ '{{:name}}'
			+ '{{/myTag}}'
			+ 'This wraps:{{myTag tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/myTag}}',
		tags: {
			myTag: function() {
				return this.tagCtx.props.override;
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
	});
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

test("settings", function() {
	// ................................ Act ..................................
	$.views.settings.delimiters("@%","%@");
	var result = $.templates("A_@%if true%@yes@%/if%@_B").render();
	$.views.settings.delimiters("{{","}}");
	result += "|" + $.templates("A_{{if true}}YES{{/if}}_B").render();
	// ............................... Assert .................................
	equal(result, "A_yes_B|A_YES_B", "Custom delimiters with render()");

	// =============================== Arrange ===============================
	var app = {choose: true, name: "Jo"};
	result = "";
	var oldOnError = $.views.settings.onError;

	$.views.settings({
		onError: function(e, view, fallback) {
			return "Override error - " + (fallback ? ("(Fallback string: " + fallback + ") ") : "") + (view ? "Rendering error: " + e.message : "JsViews error: " + e);
		}
	});

	// ................................ Act ..................................
	$.views.settings.debugMode(true);
	result = $.templates('{{:missing.willThrow}}').render(app);
	$.views.settings.debugMode();

	// ............................... Assert .................................
	equal(result.slice(0, 34), "Override error - Rendering error: ", "Override onError()");

	// ................................ Act ..................................
	result = $.templates('{{:missing.willThrow onError="myFallback"}}').render(app);

	// ............................... Assert .................................
	equal(result.slice(0, 64), "Override error - (Fallback string: myFallback) Rendering error: ", 'Override onError() - with {{:missing.willThrow onError="myFallback"}}');

	// ................................ Act ..................................
	try {
		$.templates('{{if}}').render(app);
	}
	catch (e) {
		result = e.message;
	}

	// ............................... Assert .................................
	equal(result, 'Override error - JsViews error: Syntax error\nUnmatched or missing {{/if}}, in template:\n{{if}}', 'Override onError() - with thrown syntax error (missing {{/if}})');

	// ................................ Act ..................................
	result = $.templates('{{if missing.willThrow onError="myFallback"}}yes{{/if}}').render(app);

	// ............................... Assert .................................
	equal(result.slice(0,64), 'Override error - (Fallback string: myFallback) Rendering error: ', 'Override onError() - with {{if missing.willThrow onError="myFallback"}}');

	// ................................ Reset ..................................
	$.views.settings({
		onError: oldOnError
	});
});

test("template encapsulation", 8, function() {
		// =============================== Arrange ===============================
$.templates({
		myTmpl6: {
			markup: "{{sort reverse=true people}}{{:name}}{{/sort}}",
			tags: {
				sort: sort
			}
		}
	});

	// ............................... Assert .................................
	equal($.render.myTmpl6({ people: people }), "BillJo", '$.templates("myTmpl", tmplObjWithNestedItems);');

	// =============================== Arrange ===============================
	$.views.helpers("h1", "globalHelper");

	var tmpl = $.templates({
		markup: "{{if true}}{{:~h1}} {{:~h2}} {{:~h3}}{{/if}}",
		helpers: {
			h2: "templateHelper"
		}
	});

	// ............................... Assert .................................
	equal(tmpl.render({}, {h3:"optionHelper"}), "globalHelper templateHelper optionHelper", 'Passing in helpers - global, template or option');

	// =============================== Arrange ===============================
	tmpl = $.templates({
		markup: "{{if true}}{{:~h1}}{{/if}}",
		helpers: {
			h1: "templateHelper"
		}
	});

	// ............................... Assert .................................
	equal(tmpl.render({}), "templateHelper", 'template helper overrides global helper');

	// =============================== Arrange ===============================
	tmpl = $.templates({
		markup: "{{if true}}{{:~h1}}{{/if}}"
	});

	// ............................... Assert .................................
	equal(tmpl.render({}, {h1: "optionHelper"}), "optionHelper", 'option helper overrides global helper');

	// =============================== Arrange ===============================
	tmpl = $.templates({
		markup: "{{if true}}{{:~h2}}{{/if}}",
		helpers: {
			h2: "templateHelper"
		}
	});

	// ............................... Assert .................................
	equal(tmpl.render({}, {h2: "optionHelper"}), "templateHelper", 'template helper overrides option helper');

	// =============================== Arrange ===============================
	$.views.converters("c1", function(val) {return val + "globalCvt";});

	tmpl = $.templates({
		markup: "{{if true}}{{c1:1}}{{c2:2}}{{/if}}",
		converters: {
			c2: function(val) {return val + "templateCvt";}
		}
	});

	// ............................... Assert .................................
	equal(tmpl.render({}), "1globalCvt2templateCvt", 'template converter and global converter');

	// =============================== Arrange ===============================
	tmpl = $.templates({
		markup: "{{if true}}{{c1:1}}{{/if}}",
		converters: {
			c1: function(val) {return val + "templateCvt";}
		}
	});

	// ............................... Assert .................................
	equal(tmpl.render({}), "1templateCvt", 'template converter overrides global converter');

	// =============================== Arrange ===============================

	tmpl = $.templates({
		cascade: "outerCascade",
		nesting: {
			markup: "{{if true}} {{c1:~h1}} {{include tmpl='inner'/}}{{/if}} {{include tmpl='cascade'/}}",
			helpers: {
				h1: "templateHelper"
			},
			converters: {
				c1: function(val) {return val + " templateCvt";}
			},
			templates: {
				cascade: "innerCascade",
				inner: {
					markup: "{{if true}}{{c1:~h1}}{{/if}} {{include tmpl='cascade'/}}",
					helpers: {
						h1: "innerTemplateHelper"
					},
					converters: {
						c1: function(val) {return val + " innerTemplateCvt";}
					},
					templates: {
						cascade: "innerInnerCascade"
					}
				}
			}
		}
	});

	// ............................... Assert .................................
	equal($.templates.nesting.render({}, {b: "optionHelper"}), " templateHelper templateCvt innerTemplateHelper innerTemplateCvt innerInnerCascade innerCascade",
		'Inner template, helper, and converter override outer template, helper, and converter');

});

module("noConflict");

test("jsviews.noConflict()", function() {
	ok(noConflictTest === true, "jsviews.noConflict() works correctly");
});

})(this, this.jsviews || jQuery);
