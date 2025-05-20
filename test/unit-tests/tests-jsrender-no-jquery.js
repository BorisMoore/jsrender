/*global QUnit*/
(function(undefined) {
"use strict";

var global = (0, eval)('this'), // jshint ignore:line

	isBrowser = !!global.document,

	jsv = global.jsviews || global.jsrender || global.jQuery; // On Node.js with QUnit, jsrender is added as namespace, to global

if (!isBrowser) {
	global.document = {};
}

function compileTmpl(template) {
	try {
		return typeof jsv.templates(template).fn === "function" ? "compiled" : "failed compile";
	} catch(e) {
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

var person = {name: "Jo"},
	people = [{name: "Jo"}, {name: "Bill"}],
	towns = [{name: "Seattle"}, {name: "Paris"}, {name: "Delhi"}];

var tmplString = "A_{{:name}}_B";
jsv.views.tags({sort: sort});

QUnit.module("tagParser");
QUnit.test("{{if}} {{else}}", function(assert) {
	assert.equal(compileTmpl("A_{{if true}}{{/if}}_B"), "compiled", "Empty if block: {{if}}{{/if}}");
	assert.equal(compileTmpl("A_{{if true}}yes{{/if}}_B"), "compiled", "{{if}}...{{/if}}");
	assert.equal(compileTmpl("A_{{if true/}}yes{{/if}}_B"), "Syntax error\nUnmatched or missing {{/if}}, in template:\nA_{{if true/}}yes{{/if}}_B", "unmatched or missing tag error");
	assert.equal(jsv.templates("<span id='x'></span> a'b\"c\\").render(), "<span id=\'x\'></span> a\'b\"c\\", "Correct escaping of quotes and backslash");
});

QUnit.test("syntax errors", function(assert) {
	assert.equal(compileTmpl("{^{*:foo}}"), "Syntax error\n{^{*:foo}}", "Syntax error for {^{* ...}}");
	assert.equal(compileTmpl("{{:foo/}}"), "Syntax error\n{{:foo/}}", "Syntax error for {{: ... /}}");
	assert.equal(compileTmpl("{{:foo:}}"), "Syntax error\n{{:foo:}}", "Syntax error for {{: ... :}}");
	assert.equal(compileTmpl("{^{:foo:}}"), "Syntax error\n{^{:foo:}}", "Syntax error for {^{: ... :}}");
	assert.equal(compileTmpl("{{mytag foo :}}"), "Syntax error\n{{mytag foo :}}", "Syntax error for {{mytag ... :}}");
	assert.equal(compileTmpl("{^{mytag foo :}}"), "Syntax error\n{^{mytag foo :}}", "Syntax error for {^{mytag ... :}}");
	assert.equal(compileTmpl("{{if foo?bar:baz}}{{/if}}"), "compiled", "No syntax error for {{tag foo?bar:baz}}");
	assert.equal(compileTmpl("{{for [1,2]/}}"), "Syntax error\n[1,2]", "Syntax error for {{for [1,2]}} - top-level array");
	assert.equal(compileTmpl("{{:constructor()}}"), "Syntax error\nconstructor", "Syntax error for {{: ...constructor ...}}");
	assert.equal(compileTmpl("{{for #tmpl.constructor()}}"), "Syntax error\n#tmpl.constructor", "Syntax error for {{for ...constructor ...}}");

jsv.views.settings.debugMode(true);
	assert.equal(jsv.templates('{{:#data["constructor"]["constructor"]("alert(0);")()}}').render(), "{Error: Syntax error\n}", 'Syntax error 1 for ["constructor]"');
	assert.equal(jsv.templates('{{:valueOf["constructor"]("alert(1);")()}}').render(1), "{Error: Syntax error\n}", 'Syntax error 2 for ["constructor]"');
	assert.equal(jsv.templates('{{:valueOf["const"+"ructor"]("alert(2);")()}}').render(1), "{Error: Syntax error\n}", 'Syntax error 3 for ["constructor]"');
	assert.equal(jsv.templates('{{if true ~c=toString["con" + foo + "or"]}}{{:convert=~c("alert(3);")}}{{/if}}').render({foo: "struct"}), "{Error: Syntax error\n}", 'Syntax error 1 for indirect ["constructor]"');
	assert.equal(jsv.templates('{{if true ~tmp="constructo"}}{{if true ~tmp2="r"}}{{:toString[~tmp + ~tmp2]}}{{/if}}{{/if}}').render(1), "{Error: Syntax error\n}", 'Syntax error 2 for indirect ["constructor]"');
jsv.views.settings.debugMode(false);
});

QUnit.module("{{if}}");
QUnit.test("{{if}}", function(assert) {
	assert.equal(jsv.templates("A_{{if true}}yes{{/if}}_B").render(), "A_yes_B", "{{if a}}: a");
	assert.equal(jsv.templates("A_{{if false}}yes{{/if}}_B").render(), "A__B", "{{if a}}: !a");
	assert.equal(jsv.templates("A_{{if true}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: a");
	assert.equal(jsv.templates("A_{{if false}}{{/if}}_B").render(), "A__B", "{{if a}}: empty: !a");
});

QUnit.test("{{if}} {{else}}", function(assert) {
	assert.equal(jsv.templates("A_{{if true}}yes{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else}}: a");
	assert.equal(jsv.templates("A_{{if false}}yes{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else}}: !a");
	assert.equal(jsv.templates("A_{{if true}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_yes_B", "{{if a}} {{else b}} {{else}}: a");
	assert.equal(jsv.templates("A_{{if false}}yes{{else true}}or{{else}}no{{/if}}_B").render(), "A_or_B", "{{if a}} {{else b}} {{else}}: b");
	assert.equal(jsv.templates("A_{{if false}}yes{{else false}}or{{else}}no{{/if}}_B").render(), "A_no_B", "{{if a}} {{else b}} {{else}}: !a!b");
	assert.equal(jsv.templates("A_{{if undefined}}yes{{else true}}or{{else}}no{{/if}}_B").render({}), "A_or_B", "{{if undefined}} {{else b}} {{else}}: !a!b");
	assert.equal(jsv.templates("A_{{if false}}yes{{else undefined}}or{{else}}no{{/if}}_B").render({}), "A_no_B", "{{if a}} {{else undefined}} {{else}}: !a!b");
	assert.equal(jsv.templates("A_{{if false}}<div title='yes'{{else}}<div title='no'{{/if}}>x</div>_B").render(), "A_<div title='no'>x</div>_B", "{{if}} and {{else}} work across HTML tags");
	assert.equal(jsv.templates("A_<div title='{{if true}}yes'{{else}}no'{{/if}}>x</div>_B").render(), "A_<div title='yes'>x</div>_B", "{{if}} and {{else}} work across quoted strings");
});

QUnit.test("{{if}} {{else}} external templates", function(assert) {
	assert.equal(jsv.templates("A_{{if true tmpl='yes<br/>'/}}_B").render(), "A_yes<br/>_B", "{{if a tmpl=foo/}}: a");
	assert.equal(jsv.templates("A_{{if false tmpl='yes<br/>'}}{{else false tmpl='or<br/>'}}{{else tmpl='no<br/>'}}{{/if}}_B").render(), "A_no<br/>_B", "{{if a tmpl=foo}}{{else b tmpl=bar}}{{else tmpl=baz}}: !a!b");
});

QUnit.module("{{:}}");
QUnit.test("convert", function(assert) {
	assert.equal(jsv.templates("{{>#data}}").render("<br/>'\"&"), "&lt;br/&gt;&#39;&#34;&amp;", "default html converter");
	assert.equal(jsv.templates("{{html:#data}}").render("<br/>'\"&"), "&lt;br/&gt;&#39;&#34;&amp;", "html converter");
	assert.equal(jsv.templates("{{:#data}}").render("<br/>'\"&"), "<br/>'\"&", "no convert");

	function loc(data) {
		switch (data) {case "desktop": return "bureau";}
	}
	jsv.views.converters("loc", loc);
	assert.equal(jsv.templates("{{loc:#data}}:{{loc:'desktop'}}").render("desktop"), "bureau:bureau", 'jsv.views.converters("loc", locFunction);... {{loc:#data}}');
});

QUnit.test("paths", function(assert) {
	assert.equal(jsv.templates("{{:a}}").render({a: "aVal"}), "aVal", "a");
	assert.equal(jsv.templates("{{:a.b}}").render({a: {b: "bVal"}}), "bVal", "a.b");
	assert.equal(jsv.templates("{{:a.b.c}}").render({a: {b: {c: "cVal"}}}), "cVal", "a.b.c");
	assert.equal(jsv.templates("{{:a.name}}").render({a: {name: "aName"}}), "aName", "a.name");
	assert.equal(jsv.templates("{{:a['name']}}").render({a: {name: "aName"}}), "aName", "a['name']");
	assert.equal(jsv.templates("{{:a['x - _*!']}}").render({a: {"x - _*!": "aName"}}), "aName", "a['x - _*!']");
	assert.equal(jsv.templates("{{:#data['x - _*!']}}").render({"x - _*!": "aName"}), "aName", "#data['x - _*!']");
	assert.equal(jsv.templates('{{:a["x - _*!"]}}').render({a: {"x - _*!": "aName"}}), "aName", 'a["x - _*!"]');
	assert.equal(jsv.templates("{{:a.b[1].d}}").render({a: {b: [0, {d: "dVal"}]}}), "dVal", "a.b[1].d");
	assert.equal(jsv.templates("{{:a.b[1].d}}").render({a: {b: {1:{d: "dVal"}}}}), "dVal", "a.b[1].d");
	assert.equal(jsv.templates("{{:a.b[~incr(1-1)].d}}").render({a: {b: {1:{d: "dVal"}}}}, {incr:function(val) {return val + 1;}}), "dVal", "a.b[~incr(1-1)].d");
	assert.equal(jsv.templates("{{:a.b.c.d}}").render({a: {b: {c:{d: "dVal"}}}}), "dVal", "a.b.c.d");
	assert.equal(jsv.templates("{{:a[0]}}").render({a: [ "bVal" ]}), "bVal", "a[0]");
	assert.equal(jsv.templates("{{:a.b[1][0].msg}}").render({a: {b: [22,[{msg: " yes - that's right. "}]]}}), " yes - that's right. ", "a.b[1][0].msg");
	assert.equal(jsv.templates("{{:#data.a}}").render({a: "aVal"}), "aVal", "#data.a");
	assert.equal(jsv.templates("{{:#view.data.a}}").render({a: "aVal"}), "aVal", "#view.data.a");
	assert.equal(jsv.templates("{{:#index === 0}}").render([{a: "aVal"}]), "true", "#index");
});

QUnit.test("types", function(assert) {
	assert.equal(jsv.templates("{{:'abc'}}").render(), "abc", "'abc'");
	assert.equal(jsv.templates('{{:"abc"}}').render(), "abc", '"abc"');
	assert.equal(jsv.templates("{{:true}}").render(), "true", "true");
	assert.equal(jsv.templates("{{:false}}").render(), "false", "false");
	assert.equal(jsv.templates("{{:null}}").render(), "", 'null -> ""');
	assert.equal(jsv.templates("{{:199}}").render(), "199", "199");
	assert.equal(jsv.templates("{{: 199.9}}").render(), "199.9", "| 199.9 |");
	assert.equal(jsv.templates("{{:-33.33}}").render(), "-33.33", "-33.33");
	assert.equal(jsv.templates("{{: -33.33}}").render(), "-33.33", "| -33.33 |");
	assert.equal(jsv.templates("{{:-33.33 - 2.2}}").render(), "-35.53", "-33.33 - 2.2");
	assert.equal(jsv.templates("{{:notdefined}}").render({}), "", "notdefined");
	assert.equal(jsv.templates("{{:}}").render("aString"), "aString", "{{:}} returns current data item");
	assert.equal(jsv.templates("{{:x=22}}").render("aString"), "aString", "{{:x=...}} returns current data item");
	assert.equal(jsv.templates("{{html:x=22}}").render("aString"), "aString", "{{html:x=...}} returns current data item");
	assert.equal(jsv.templates("{{>x=22}}").render("aString"), "aString", "{{>x=...}} returns current data item");
	assert.equal(jsv.templates("{{:'abc('}}").render(), "abc(", "'abc(': final paren in string is rendered correctly"); // https://github.com/BorisMoore/jsviews/issues/300
	assert.equal(jsv.templates('{{:"abc("}}').render(), "abc(", '"abc(": final paren in string is rendered correctly');
	assert.equal(jsv.templates("{{:(('(abc('))}}").render(), "(abc(", "(('(abc('))");
	assert.equal(jsv.templates('{{:((")abc)"))}}').render(), ")abc)", '((")abc)"))');
});

QUnit.test("Fallbacks for missing or undefined paths:\nusing {{:some.path onError = 'fallback'}}, etc.", function(assert) {
	var message;
	try {
		jsv.templates("{{:a.missing.willThrow.path}}").render({a:1});
	} catch(e) {
		message = e.message;
	}
	assert.ok(!!message,
		"{{:a.missing.willThrow.path}} throws: " + message);

	assert.equal(jsv.templates("{{:a.missing.willThrow.path onError='Missing Object'}}").render({a:1}), "Missing Object",
		'{{:a.missing.willThrow.path onError="Missing Object"}} renders "Missing Object"');
	assert.equal(jsv.templates('{{:a.missing.willThrow.path onError=""}}').render({a:1}), "",
		'{{:a.missing.willThrow.path onError=""}} renders ""');
	assert.equal(jsv.templates("{{:a.missing.willThrow.path onError=null}}").render({a:1}), "",
		'{{:a.missing.willThrow.path onError=null}} renders ""');
	assert.equal(jsv.templates("{{>a.missing.willThrow.path onError='Missing Object'}}").render({a:1}), "Missing Object",
		'{{>a.missing.willThrow.path onError="Missing Object"}} renders "Missing Object"');
	assert.equal(jsv.templates('{{>a.missing.willThrow.path onError=""}}').render({a:1}), "",
		'{{>a.missing.willThrow.path onError=""}} renders ""');
	assert.equal(jsv.templates("{{>a.missing.willThrow.path onError=defaultVal}}").render(
		{
			a:1,
			defaultVal: "defaultFromData"
		}), "defaultFromData",
		'{{>a.missing.willThrow.path onError=defaultVal}} renders "defaultFromData"');

	assert.equal(jsv.templates("{{>a.missing.willThrow.path onError=~myOnErrorFunction}}").render({a:1}, {
		myOnErrorFunction: function(e, view) {
			return "Override onError using a callback: " + view.ctx.helperValue + e.message;
		},
		helperValue: "hlp"
	}).slice(0, 38), "Override onError using a callback: hlp",
		'{{>a.missing.willThrow.path onError=~myOnErrorFunction}}" >' +
		'\nProviding a function "onError=~myOnErrorFunction" calls the function as onError callback');

	assert.equal(jsv.templates("{{>a.missing.willThrow.path onError=myOnErrorDataMethod}}").render(
		{
			a: "dataValue",
			myOnErrorDataMethod: function(e) {
				var data = this;
				return "Override onError using a callback data method: " + data.a;
			}
		}), "Override onError using a callback data method: dataValue",
		'{{>a.missing.willThrow.path onError=myOnErrorDataMethod}}" >' +
		'\nProviding a function "onError=myOnErrorDataMethod" calls the function as onError callback');

	assert.equal(jsv.templates("1: {{>a.missing.willThrow.path onError=defaultVal}}" +
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
				return "myCallback: " + this.a;
			}
		}), "1: defaultFromData 2: Missing Object 3:  4:  5: aVal 6:  7: myCallback: aVal end",
		'multiple onError fallbacks in same template - correctly concatenated into output');

	assert.equal(jsv.templates({
		markup: "{{withfallback:a.notdefined fallback='fallback for undefined'}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render({a:"yes"}), "fallback for undefined",
		'{{withfallback:a.notdefined fallback="fallback for undefined"}}' +
		'\nusing converter to get fallback value for undefined properties');

	assert.equal(jsv.templates({
		markup: "1: {{withfallback:a.missing.y onError='Missing object' fallback='undefined prop'}}" +
			" 2: {{withfallback:a.undefined onError='Missing object' fallback='undefined prop'}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		}
	}).render({a:"yes"}), "1: Missing object 2: undefined prop",
		'both fallback for undefined and onError for missing on same tags');

	assert.equal(jsv.templates({
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
			return "myCallback: " + this.a;
		}
	}), "1: defaultFromData 2: Missing Object 3:  4: aVal 5:  6: myCallback: aVal 7: undefined prop end",
	'multiple onError fallbacks or undefined property fallbacks in same template - correctly concatenated into output');

	try {
		message = "";
		jsv.templates({
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
				return "myCallback: " + this.a;
			}
		});
	} catch(e) {
		message = e.message;
	}

	assert.ok(!!message,
		'onError/fallback converter and regular thrown error message in same template: throws:\n"' + message + '"');

	assert.equal(jsv.templates("{{for missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	assert.equal(jsv.templates("{{for true missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for true missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	assert.equal(jsv.templates("{{for true foo=missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for ... foo=missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	assert.equal(jsv.templates("{{for true ~foo=missing.willThrow.path onError='Missing Object'}}yes{{/for}}").render({a:1}), "Missing Object",
		'{{for ... ~foo=missing.willThrow.path onError="Missing Object"}} -> "Missing Object"');

	assert.equal(jsv.templates({
			markup: "{{mytag foo='a'/}} {{mytag foo=missing.willThrow.path onError='Missing Object'/}} {{mytag foo='c' bar=missing.willThrow.path onError='Missing Object'/}} {{mytag foo='c' missing.willThrow.path onError='Missing Object'/}} {{mytag foo='b'/}}",
			tags: {
				mytag: {template: "MyTag: {{:~tagCtx.props.foo}} end"}
			}
		}).render({a:1}), "MyTag: a end Missing Object Missing Object Missing Object MyTag: b end",
		'onError=... for custom tags: e.g. {{mytag foo=missing.willThrow.path onError="Missing Object"/}}');

	assert.equal(jsv.templates({
		markup: "1: {{for a.missing.willThrow.path onError=defaultVal}}yes{{/for}}" +
		" 2: {{if a.missing.willThrow.path onError='Missing Object'}}yes{{/if}}" +
		" 3: {{include a.missing.willThrow.path onError=''/}}" +
		" 4: {{if a onError='missing'}}yes{{/if}}" +
		" 5: {{for a.undefined onError='missing'}}yes{{/for}}" +
		" 6: {{if a.missing.willThrow onError=myCb}}yes{{/if}}" +
		" 7: {{withfallback:a.undefined fallback='undefined prop'}} end" +
		" 8: {{mytag foo=missing.willThrow.path onError='Missing Object'/}}",
		converters: {
			withfallback: function(val) {
				return val || this.tagCtx.props.fallback;
			}
		},
		tags: {
			mytag: {template: "MyTag: {{:~tagCtx.props.foo}} end"}
		}
	}).render(
		{
		a:"aVal",
		defaultVal: "defaultFromData",
		myCb: function(e, view) {
			return "myCallback: " + this.a;
		}
	}), "1: defaultFromData 2: Missing Object 3:  4: yes 5:  6: myCallback: aVal 7: undefined prop end 8: Missing Object",
	'multiple onError fallbacks or undefined property fallbacks in same template - correctly concatenated into output');

	try {
		message = "";
		jsv.templates({
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
				return "myCallback: " + this.a;
			}
		});
	} catch(e) {
		message = e.message;
	}

	assert.ok(!!message,
		'onError/fallback converter and regular thrown error message in same template: throws: \n"' + message + '"');

	jsv.views.settings.debugMode(true);
	assert.equal(jsv.templates({
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
			return "myCallback: " + this.a;
		}
	}).slice(0, 21), "1: defaultFromData 2:",
	'In debug mode, onError/fallback converter and regular thrown error message in same template:' +
	'\override errors and regular thrown error each render for the corrresponding tag');
	jsv.views.settings.debugMode(false);

});

QUnit.test("comparisons", function(assert) {
	assert.equal(jsv.templates("{{:1<2}}").render(), "true", "1<2");
	assert.equal(jsv.templates("{{:2<1}}").render(), "false", "2<1");
	assert.equal(jsv.templates("{{:5===5}}").render(), "true", "5===5");
	assert.equal(jsv.templates("{{:0==''}}").render(), "true", "0==''");
	assert.equal(jsv.templates("{{:'ab'=='ab'}}").render(), "true", "'ab'=='ab'");
	assert.equal(jsv.templates("{{:2>1}}").render(), "true", "2>1");
	assert.equal(jsv.templates("{{:2 == 2}}").render(), "true", "2 == 2");
	assert.equal(jsv.templates("{{:2<=2}}").render(), "true", "2<=2");
	assert.equal(jsv.templates("{{:'ab'<'ac'}}").render(), "true", "'ab'<'ac'");
	assert.equal(jsv.templates("{{:3>=3}}").render(), "true", "3 =3");
	assert.equal(jsv.templates("{{:3>=2}}").render(), "true", "3>=2");
	assert.equal(jsv.templates("{{:3>=4}}").render(), "false", "3>=4");
	assert.equal(jsv.templates("{{:3 !== 2}}").render(), "true", "3 !== 2");
	assert.equal(jsv.templates("{{:3 != 2}}").render(), "true", "3 != 2");
	assert.equal(jsv.templates("{{:0 !== null}}").render(), "true", "0 !== null");
	assert.equal(jsv.templates("{{:(3 >= 4)}}").render(), "false", "3>=4");
	assert.equal(jsv.templates("{{:3 >= 4}}").render(), "false", "3>=4");
	assert.equal(jsv.templates("{{:(3>=4)}}").render(), "false", "3>=4");
	assert.equal(jsv.templates("{{:(3 < 4)}}").render(), "true", "3>=4");
	assert.equal(jsv.templates("{{:3 < 4}}").render(), "true", "3>=4");
	assert.equal(jsv.templates("{{:(3<4)}}").render(), "true", "3>=4");
	assert.equal(jsv.templates("{{:0 != null}}").render(), "true", "0 != null");
});

QUnit.test("array access", function(assert) {
	assert.equal(jsv.templates("{{:a[1]}}").render({a: ["a0","a1"]}), "a1", "a[1]");
	assert.equal(jsv.templates("{{:a[1+1]+5}}").render({a: [11,22,33]}), "38", "a[1+1]+5)");
	assert.equal(jsv.templates("{{:a[~incr(1)]+5}}").render({a: [11,22,33]}, {incr:function(val) {return val + 1;}}), "38", "a[~incr(1)]+5");
	assert.equal(jsv.templates("{{:true && (a[0] || 'default')}}").render({a: [0,22,33]}, {incr:function(val) {return val + 1;}}), "default", "true && (a[0] || 'default')");
});

QUnit.test("context", function(assert) {
	assert.equal(jsv.templates("{{:~val}}").render(1, {val: "myvalue"}), "myvalue", "~val");
	function format(value, upper) {
		return value[upper ? "toUpperCase" : "toLowerCase"]();
	}
	assert.equal(jsv.templates("{{:~format(name) + ~format(name, true)}}").render(person, {format: format}), "joJO",
		"render(data, {format: formatFn}); ... {{:~format(name, true)}}");
	assert.equal(jsv.templates("{{for people[0]}}{{:~format(~type) + ~format(name, true)}}{{/for}}").render({people: people}, {format: format, type: "PascalCase"}), "pascalcaseJO",
		"render(data, {format: formatFn}); ... {{:~format(name, true)}}");
	assert.equal(jsv.templates("{{for people ~twn=town}}{{:name}} lives in {{:~format(~twn, true)}}. {{/for}}").render({people: people, town:"Redmond"}, {format: format}),
		"Jo lives in REDMOND. Bill lives in REDMOND. ",
		"Passing in context to nested templates: {{for people ~twn=town}}");
	assert.equal(jsv.templates("{{if true}}{{for people}}{{:~root.people[0].name}}{{/for}}{{/if}}").render({people: people}), "JoJo",
		"{{:~root}} returns the top-level data");
});

QUnit.test("values", function(assert) {
	assert.equal(jsv.templates("{{:a}}").render({a: 0}), "0", '{{:0}} returns "0"');
	assert.equal(jsv.templates("{{:a}}").render({}), "", "{{:undefined}} returns empty string");
	assert.equal(jsv.templates("{{:a}}").render({a: ""}), "", "{{:''}} returns empty string");
	assert.equal(jsv.templates("{{:a}}").render({a: null}), "", "{{:null}} returns empty string");
});

QUnit.test("expressions", function(assert) {
	assert.equal(compileTmpl("{{:a++}}"), "Syntax error\na++", "a++");
	assert.equal(compileTmpl("{{:(a,b)}}"), "Syntax error\n(a,b)", "(a,b)");
	assert.equal(jsv.templates("{{: a+2}}").render({a: 2, b: false}), "4", "a+2");
	assert.equal(jsv.templates("{{: b?'yes':'no'}}").render({a: 2, b: false}), "no", "b?'yes':'no'");
	assert.equal(jsv.templates("{{:(a||-1) + (b||-1)}}").render({a: 2, b: 0}), "1", "a||-1");
	assert.equal(jsv.templates("{{:3*b()*!a*4/3}}").render({a: false, b: function() {return 3;}}), "12", "3*b()*!a*4/3");
	assert.equal(jsv.templates("{{:a%b}}").render({a: 30, b: 16}), "14", "a%b");
	assert.equal(jsv.templates("A_{{if v1 && v2 && v3 && v4}}no{{else !v1 && v2 || v3 && v4}}yes{{/if}}_B").render({v1:true,v2:false,v3:2,v4:"foo"}), "A_yes_B", "x && y || z");
	assert.equal(jsv.templates("{{:!true}}").render({}), "false", "!true");
	assert.equal(jsv.templates("{{if !true}}yes{{else}}no{{/if}}").render({}), "no", "{{if !true}}...");
	assert.equal(jsv.templates("{{:!false}}").render({}), "true", "!false");
	assert.equal(jsv.templates("{{if !false}}yes{{else}}no{{/if}}").render({}), "yes", "{{if !false}}...");
	assert.equal(jsv.templates("{{:!!true}}").render({}), "true", "!!true");
	assert.equal(jsv.templates("{{if !!true}}yes{{else}}no{{/if}}").render({}), "yes", "{{if !!true}}...");
	assert.equal(jsv.templates("{{:!(true)}}").render({}), "false", "!(true)");
	assert.equal(jsv.templates("{{:!true === false}}").render({}), "true", "!true === false");
	assert.equal(jsv.templates("{{:false === !true}}").render({}), "true", "false === !true");
	assert.equal(jsv.templates("{{:false === !null}}").render({}), "false", "false === !null");
	assert.equal(jsv.templates("{{:\"'\" + 1 + '\"' + 2 + '\\' + 3}}").render({}), "'1\"2\\3", "'1\"2\\3");
});

QUnit.module("{{for}}");
QUnit.test("{{for}}", function(assert) {
	jsv.templates({
		forTmpl: "header_{{for people}}{{:name}}{{/for}}_footer",
		templateForArray: "header_{{for #data}}{{:name}}{{/for}}_footer",
		pageTmpl: '{{for [people] tmpl="templateForArray"/}}',
		simpleFor: "a{{for people}}Content{{:#data}}|{{/for}}b",
		forPrimitiveDataTypes: "a{{for people}}|{{:#data}}{{/for}}b",
		testTmpl: "xxx{{:name}} {{:~foo}}"
	});

	assert.equal(jsv.render.forTmpl({people: people}), "header_JoBill_footer", '{{for people}}...{{/for}}');
	assert.equal(jsv.render.templateForArray([people]), "header_JoBill_footer", 'Can render a template against an array, as a "layout template", by wrapping array in an array');
	assert.equal(jsv.render.pageTmpl({people: people}), "header_JoBill_footer", '{{for [people] tmpl="templateForArray"/}}');
	assert.equal(jsv.templates("{{for}}xxx{{:name}} {{:~foo}}{{/for}}").render({name: "Jeff"}, {foo:"fooVal"}), "xxxJeff fooVal", "no parameter - renders once with parent #data context: {{for}}");
	assert.equal(jsv.templates("{{for tmpl='testTmpl'/}}").render({name: "Jeff"}, {foo:"fooVal"}), "xxxJeff fooVal", ": {{for tmpl=.../}} no parameter - equivalent to {{include tmpl=.../}} - renders once with parent #data context");
	assert.equal(jsv.templates("{{include tmpl='testTmpl'/}}").render({name: "Jeff"}, {foo:"fooVal"}), "xxxJeff fooVal", "{{include tmpl=.../}} with tmpl parameter - renders once with parent #data context. Equivalent to {{for tmpl=.../}}");
	assert.equal(jsv.templates("{{for missingProperty}}xxx{{:#data===~undefined}}{{/for}}").render({}), "", "missingProperty - renders empty string");
	assert.equal(jsv.templates("{{for null}}xxx{{:#data===null}}{{/for}}").render(), "xxxtrue", "null - renders once with #data null: {{for null}}");
	assert.equal(jsv.templates("{{for false}}xxx{{:#data}}{{/for}}").render(), "xxxfalse", "false - renders once with #data false: {{for false}}");
	assert.equal(jsv.templates("{{for 0}}xxx{{:#data}}{{/for}}").render(), "xxx0", "0 - renders once with #data false: {{for 0}}");
	assert.equal(jsv.templates("{{for ''}}xxx{{:#data===''}}{{/for}}").render(), "xxxtrue", "'' - renders once with #data false: {{for ''}}");
	assert.equal(jsv.templates("{{for #data}}{{:name}}{{/for}}").render(people), "JoBill", "If #data is an array, {{for #data}} iterates");

	assert.equal(jsv.render.simpleFor({people:[]}), "ab", 'Empty array renders empty string');
	assert.equal(jsv.render.simpleFor({people:["", false, null, undefined, 1]}), "aContent|Contentfalse|Content|Content|Content1|b", 'Empty string, false, null or undefined members of array are also rendered');
	assert.equal(jsv.render.simpleFor({people:null}), "aContent|b", 'null is rendered once with #data null');
	assert.equal(jsv.render.simpleFor({}), "ab", 'if #data is undefined, renders empty string');
	assert.equal(jsv.render.forPrimitiveDataTypes({people:[0, 1, "abc", "", ,null ,true ,false]}), "a|0|1|abc||||true|falseb", 'Primitive types render correctly, even if falsey');
});
QUnit.test("{{for start end sort filter reverse}}", function(assert) {
	// =============================== Arrange ===============================
	function level(aField, bField) {
		return aField > bField ? 1 : aField < bField ? -1 : 0;
	}

	var oddValue = function(item, index, items) { return item%2; };
	var oddIndex = function(item, index, items) { return index%2; };
	var sortAgeName = function(a, b) {
		return level(a.details.role.toLowerCase(), b.details.role.toLowerCase()) // First level sort: by role
			|| (this.props.reverseAge ? level(b.details.age, a.details.age) : level(a.details.age, b.details.age)) // 2nd level sort: sort by age, or reverse sort by age
			|| level(a.name.toLowerCase(), b.name.toLowerCase()); // 3rd level sort: sort by name
	};
	var underLimit = function(item, index, items) {
		return item.details.age < this.props.limit;
	};

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for start=0 end=10}}{{:}} {{/for}}").render(), "0 1 2 3 4 5 6 7 8 9 ", "{{for start=0 end=10}}: Auto-create array");
	assert.equal(jsv.templates("{{for start=5 end=9 reverse=1}}{{:}} {{/for}}").render(), "8 7 6 5 ", "{{for start=5 end=9 reverse=1}}: Auto-create array");
	assert.equal(jsv.templates("{{for start=8 end=4 step=-1}}{{:}} {{/for}}").render(), "8 7 6 5 ", "{{for start=8 end=4 step=-1}}: Auto-create array");
	assert.equal(jsv.templates("{{for start=8 end=4  step=-1 reverse=true}}{{:}} {{/for}}").render(), "5 6 7 8 ", "{{for start=8 end=4 step=-1 reverse=true}}: Auto-create array, with reverse");
	assert.equal(jsv.templates("{{for start=20 end='10' step=-2}}{{:}} {{/for}}").render(), "20 18 16 14 12 ", "{{for start=20 end='10' step=-2}}: Auto-create array");
	assert.equal(jsv.templates("{{for start=20 end='10' step=2}}{{:}} {{/for}}").render(), "", "{{for start=20 end='10' step=2}}: Auto-create array (outputs nothing)");
	assert.equal(jsv.templates("{{for start=2 end=-1.5 step=-.5}}{{:}} {{/for}}").render(), "2 1.5 1 0.5 0 -0.5 -1 ", "{{for start=0 end='10' step=-1}}: Auto-create array");
	assert.equal(jsv.templates("{{for start=2}}{{:}} {{/for}}").render(), "", "{{for start=2}}: (outputs nothing)");
	assert.equal(jsv.templates("{{for end=4}}{{:}} {{/for}}").render(), "0 1 2 3 ", "{{for end=4}}: (start defaults to 0)");
	assert.equal(jsv.templates("{{for start=8 end=4  step=-1 reverse=true sort=true filter=~oddIndex}}{{:}} {{/for}}").render({}, {oddIndex: oddIndex}), "5 6 7 8 ", "{{for start=8 end=4 step=-1 reverse=true sort=true}}: Auto-create array, sort and filter not supported with auto-create arrays - do nothing");

	// =============================== Arrange ===============================

	var myarray = [1, 9, 2, 8, 3, 7, 4, 6, 5];

	assert.equal(jsv.templates("{{for #data }}{{:}} {{/for}}").render(myarray, true), "1 9 2 8 3 7 4 6 5 ", "{{for #data}}");
	assert.equal(jsv.templates("{{for #data sort=true}}{{:}} {{/for}}").render(myarray, true), "1 2 3 4 5 6 7 8 9 ", "{{for #data sort=true}}");
	assert.equal(jsv.templates("{{for myarray reverse=true}}{{:}} {{/for}}").render({myarray: myarray}), "5 6 4 7 3 8 2 9 1 ", "{{for myarray reverse=true}}");
	assert.equal(jsv.templates("{{for myarray start=1 end=-1}}{{:}} {{/for}}").render({myarray: myarray}), "9 2 8 3 7 4 6 ", "{{for myarray start=1 end=-1}}");
	assert.equal(jsv.templates("{{for myarray start=1}}{{:}} {{/for}}").render({myarray: myarray}), "9 2 8 3 7 4 6 5 ", "{{for myarray start=1}}");
	assert.equal(jsv.templates("{{for myarray end=-1}}{{:}} {{/for}}").render({myarray: myarray}), "1 9 2 8 3 7 4 6 ", "{{for myarray end=-1}}");
	assert.equal(jsv.templates("{{for myarray sort=true}}{{:}} {{/for}}").render({myarray: myarray}), "1 2 3 4 5 6 7 8 9 ", "{{for myarray sort=true}}");
	assert.equal(jsv.templates("{{for myarray sort=true reverse=true}}{{:}} {{/for}}").render({myarray: myarray}), "9 8 7 6 5 4 3 2 1 ", "{{for myarray sort=true reverse=true}}");

	assert.equal(jsv.templates("{{for myarray filter=~oddValue}}{{:}} {{/for}}").render({myarray: myarray}, {oddValue: oddValue}), "1 9 3 7 5 ", "{{for myarray filter=~oddValue}}");
	assert.equal(jsv.templates("{{for myarray filter=~oddIndex}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "9 8 7 6 ", "{{for myarray filter=~oddIndex}}");
	assert.equal(jsv.templates("{{for myarray sort=true filter=~oddValue}}{{:}} {{/for}}").render({myarray: myarray}, {oddValue: oddValue}), "1 3 5 7 9 ", "{{for myarray sort=true filter=~oddValue}}");
	assert.equal(jsv.templates("{{for myarray sort=true filter=~oddIndex}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "2 4 6 8 ", "{{for myarray sort=true filter=~oddIndex}}");
	assert.equal(jsv.templates("{{for myarray sort=true filter=~oddIndex start=1 end=3}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "4 6 ", "{{for myarray sort=true filter=~oddIndex start=1 end=3}}");
	assert.equal(jsv.templates("{{for myarray sort=true filter=~oddIndex start=-3 end=-1}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "4 6 ", "{{for myarray sort=true filter=~oddIndex start=-3 end=-1}} Negative start or end count from the end");
	assert.equal(jsv.templates("{{for myarray sort=true filter=~oddIndex start=3 end=3}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "", "{{for myarray sort=true filter=~oddIndex start=3 end=3}} (outputs nothing)");

	assert.equal(jsv.templates("{{for myarray step=2 start=1}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "9 8 7 6 ", "{{for myarray step=2 start=1}}");
	assert.equal(jsv.templates("{{for myarray sort=true step=2 start=1}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "2 4 6 8 ", "{{for myarray sort=true step=2 start=1}}");
	assert.equal(jsv.templates("{{for myarray sort=true step=2 start=3 end=6}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "4 6 ", "{{for myarray sort=true step=2 start=3 end=6}}");
	assert.equal(jsv.templates("{{for myarray sort=true step=2 start=-6 end=-3}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "4 6 ", "{{for myarray sort=true step=2 start=-6 end=-3}} Negative start or end count from the end");
	assert.equal(jsv.templates("{{for myarray sort=true step=2 start=3 end=3}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "", "{{for myarray sort=true step=2 start=3 end=3}} (outputs nothing)");
	assert.equal(jsv.templates("{{for myarray step=3.5}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "1 8 4 ", "{{for myarray step=3.5}} - equivalent to step=3");
	assert.equal(jsv.templates("{{for myarray step=-2}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "1 9 2 8 3 7 4 6 5 ", "{{for myarray step=-2}} equivalent to no step");
	assert.equal(jsv.templates("{{for myarray step=1}}{{:}} {{/for}}").render({myarray: myarray}, {oddIndex: oddIndex}), "1 9 2 8 3 7 4 6 5 ", "{{for myarray step=1}} equivalent to no step");
	// =============================== Arrange ===============================

	var mypeople = [
		{name: "Jo", details: {age: 22}},
		{name: "Bob", details: {age: 2}},
		{name: "Emma", details: {age: 12}},
		{name: "Jeff", details: {age: 13.5}},
		{name: "Julia", details: {age: 0.6}},
		{name: "Xavier", details: {age: 0}}
	];

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for mypeople sort='name'}}{{:name}}: age {{:details.age}} - {{/for}}").render({mypeople: mypeople}), "Bob: age 2 - Emma: age 12 - Jeff: age 13.5 - Jo: age 22 - Julia: age 0.6 - Xavier: age 0 - ",
		"{{for mypeople  sort='name'}}");
	assert.equal(jsv.templates("{{for mypeople sort='details.age'}}{{:name}}: age {{:details.age}} - {{/for}}").render({mypeople: mypeople}), "Xavier: age 0 - Julia: age 0.6 - Bob: age 2 - Emma: age 12 - Jeff: age 13.5 - Jo: age 22 - ",
		"{{for mypeople  sort='details.age'}}");

	assert.equal(jsv.templates("{{for mypeople sort='details.age' reverse=true filter=~underLimit limit=20}}{{:name}}: age {{:details.age}} - {{/for}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Jeff: age 13.5 - Emma: age 12 - Bob: age 2 - Julia: age 0.6 - Xavier: age 0 - ",
		"{{for mypeople  sort='details.age' reverse=true filter=~underLimit...}}");
	assert.equal(jsv.templates("{{for mypeople sort='details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:name}}: age {{:details.age}} - {{/for}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ",
		"{{for mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}}");
	assert.equal(jsv.templates("{{for mypeople sort='details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:name}}: age {{:details.age}} - {{/for}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ",
		"{{for mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}}");

	// =============================== Arrange ===============================

	var mypeople2 = [
		{name: "Bill", details: {age: 22, role: "Lead"}},
		{name: "Anne", details: {age: 32, role: "Assistant"}},
		{name: "Emma", details: {age: 19.1, role: "Team member"}},
		{name: "Jeff", details: {age: 33.5, role: "Lead"}},
		{name: "Xavier", details: {age: 32, role: "Team member"}},
		{name: "Julia", details: {age: 18, role: "Assistant"}},
		{name: "Bill", details: {age: 32, role: "Team member"}}
	];

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for mypeople sort=~sortAgeName}}{{:name}}: ({{:details.role}}) age {{:details.age}} -{{/for}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Julia: (Assistant) age 18 -Anne: (Assistant) age 32 -Bill: (Lead) age 22 -Jeff: (Lead) age 33.5 -Emma: (Team member) age 19.1 -Bill: (Team member) age 32 -Xavier: (Team member) age 32 -",
		"{{for mypeople sort=~sortAgeName}}: custom sort function");

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for mypeople sort=~sortAgeName reverseAge=true}}{{:name}}: ({{:details.role}}) age {{:details.age}} -{{/for}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Anne: (Assistant) age 32 -Julia: (Assistant) age 18 -Jeff: (Lead) age 33.5 -Bill: (Lead) age 22 -Bill: (Team member) age 32 -Xavier: (Team member) age 32 -Emma: (Team member) age 19.1 -",
		"{{for mypeople sort=~sortAgeName}}: custom sort function - this pointer is tagCtx");

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for start=0 end=0}}{{else mypeople sort=~sortAgeName reverseAge=true}}{{:name}}: ({{:details.role}}) age {{:details.age}} -{{/for}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Anne: (Assistant) age 32 -Julia: (Assistant) age 18 -Jeff: (Lead) age 33.5 -Bill: (Lead) age 22 -Bill: (Team member) age 32 -Xavier: (Team member) age 32 -Emma: (Team member) age 19.1 -",
		"{{for start=0 end=0}}{{else mypeople sort=~sortAgeName}}: custom sort function - this pointer is tagCtx (else block)");

	// =============================== Arrange ===============================

	jsv.views.tags("for2", {
		baseTag: "for"
	});

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{for2 mypeople sort='details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:name}}: age {{:details.age}} - {{/for2}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ",
		"{{for2 mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}} Derived tag");
});

QUnit.module("{{props}}");
QUnit.test("{{props}}", function(assert) {
	jsv.templates({
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

	assert.equal(jsv.render.propsTmpl({person: people[0]}), "header_Key: name - Prop: Jo| _footer", '{{props person}}...{{/props}} for an object iterates over properties');
	assert.equal(jsv.render.propsTmplObjectArray({people: people}), "header_Key: 0 - Prop: Jo Key: 1 - Prop: Bill _footer", '{{props people}}...{{/props}} for an array iterates over the array - with index as key and object a prop');
	assert.equal(jsv.render.templatePropsArray([people]), "header_Key: 0 - Prop: Jo Key: 1 - Prop: Bill _footer", 'Can render a template against an array, as a "layout template", by wrapping array in an array');
	assert.equal(jsv.render.pageTmpl({person: people[0]}), "Key: name - Prop: Jo", '{{props person tmpl="propTmpl"/}}');
	assert.equal(jsv.templates("{{props}}{{:key}} {{:prop}}{{/props}}").render({name: "Jeff"}), "name Jeff", "no parameter - defaults to current data item");
	assert.equal(jsv.templates("{{props foo}}xxx{{:key}} {{:prop}} {{:~foo}}{{/props}}").render({name: "Jeff"}), "", "undefined arg - renders nothing");
	assert.equal(jsv.templates("{{props tmpl='propTmpl'/}}").render({name: "Jeff"}), "Key: name - Prop: Jeff", ": {{props tmpl=.../}} no parameter - defaults to current data item");

	assert.equal(jsv.templates("{{props null}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "null - renders nothing");
	assert.equal(jsv.templates("{{props false}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "false - renders nothing");
	assert.equal(jsv.templates("{{props 0}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "0 - renders nothing");
	assert.equal(jsv.templates("{{props 'abc'}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "'abc' - renders nothing");
	assert.equal(jsv.templates("{{props ''}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(), "", "'' - renders nothing");
	assert.equal(jsv.templates("{{props #data}}Key: {{:key}} - Prop: {{:prop}}| {{/props}}").render(people),
	"Key: name - Prop: Jo| Key: name - Prop: Bill| ",
	"If #data is an array, {{props #data}} iterates");

	assert.equal(jsv.render.propsTmpl({person:{}}), "header__footer", 'Empty object renders empty string');
	assert.equal(jsv.render.propsTmpl({person:{zero: 0, one: 1, str: "abc", emptyStr: "", nullVal: null , trueVal: true , falseVal: false}}),
	"header_Key: zero - Prop: 0| Key: one - Prop: 1| Key: str - Prop: abc| Key: emptyStr - Prop: | Key: nullVal - Prop: | Key: trueVal - Prop: true| Key: falseVal - Prop: false| _footer",
	'Primitive types render correctly, even if falsey');
});

QUnit.test("{{props start end sort filter reverse}}", function(assert) {
	// =============================== Arrange ===============================
		function level(aField, bField) {
			return aField > bField ? 1 : aField < bField ? -1 : 0;
		}

	var oddValue = function(item, index, items) { return item.prop%2; };
	var oddIndex = function(item, index, items) { return index%2; };
	var sortAgeName = function(a, b) {
		return level(a.prop.details.role.toLowerCase(), b.prop.details.role.toLowerCase()) // First level sort: by role
			|| (this.props.reverseAge ? level(b.prop.details.age, a.prop.details.age) : level(a.prop.details.age, b.prop.details.age)) // 2nd level sort: sort by age, or reverse sort by age
			|| level(a.prop.name.toLowerCase(), b.prop.name.toLowerCase()); // 3rd level sort: sort by name
	};

	var underLimit = function(item, index, items) {
		return item.prop.details.age < this.props.limit;
	};

	var myobject = {a: 1, b: 9, c: 2, d:8, A:3, B:7, C:4, D:6, e:5};

	assert.equal(jsv.templates("{{props myobject}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}), "a 1 - b 9 - c 2 - d 8 - A 3 - B 7 - C 4 - D 6 - e 5 - ", "{{props myobject}} (original order)");
	assert.equal(jsv.templates("{{props #data sort='prop'}}{{:key}} {{:prop}} - {{/props}}").render(myobject, true), "a 1 - c 2 - A 3 - C 4 - e 5 - D 6 - B 7 - d 8 - b 9 - ", "{{props #data sort='prop'}}");
	assert.equal(jsv.templates("{{props #data sort='key'}}{{:key}} {{:prop}} - {{/props}}").render(myobject, true), 	"a 1 - A 3 - b 9 - B 7 - c 2 - C 4 - d 8 - D 6 - e 5 - ", "{{props #data sort='key'}}");
	assert.equal(jsv.templates("{{props #data sort='prop' reverse=true}}{{:key}} {{:prop}} - {{/props}}").render(myobject, true), "b 9 - d 8 - B 7 - D 6 - e 5 - C 4 - A 3 - c 2 - a 1 - ", "{{props #data sort='prop' reverse=true}}");
	assert.equal(jsv.templates("{{props #data sort='key' reverse=true}}{{:key}} {{:prop}} - {{/props}}").render(myobject, true), "e 5 - d 8 - D 6 - c 2 - C 4 - b 9 - B 7 - a 1 - A 3 - ", "{{props #data sort='key' reverse=true}}");
	assert.equal(jsv.templates("{{props myobject reverse=true}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}), "e 5 - D 6 - C 4 - B 7 - A 3 - d 8 - c 2 - b 9 - a 1 - ", "{{props myobject reverse=true}}");
	assert.equal(jsv.templates("{{props myobject sort='key' reverse=true}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}), "e 5 - d 8 - D 6 - c 2 - C 4 - b 9 - B 7 - a 1 - A 3 - ", "{{props myobject sort='key' reverse=true}}");
	assert.equal(jsv.templates("{{props myobject start=1 end=-1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "b 9 - c 2 - d 8 - A 3 - B 7 - C 4 - D 6 - ", "{{props myobject start=1 end=-1}}");
	assert.equal(jsv.templates("{{props myobject start=1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "b 9 - c 2 - d 8 - A 3 - B 7 - C 4 - D 6 - e 5 - ", "{{props myobject start=1}}");
	assert.equal(jsv.templates("{{props myobject end=-1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}),  "a 1 - b 9 - c 2 - d 8 - A 3 - B 7 - C 4 - D 6 - ", "{{props myobject end=-1}}");

	assert.equal(jsv.templates("{{props myobject filter=~oddValue}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddValue: oddValue}), "a 1 - b 9 - A 3 - B 7 - e 5 - ", "{{props myobject filter=~oddValue}}");
	assert.equal(jsv.templates("{{props myobject filter=~oddIndex}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "b 9 - d 8 - B 7 - D 6 - ", "{{props myobject filter=~oddIndex}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' filter=~oddValue}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddValue: oddValue}), "a 1 - A 3 - e 5 - B 7 - b 9 - ", "{{props myobject sort='prop' filter=~oddValue}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' filter=~oddIndex}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "c 2 - C 4 - D 6 - d 8 - ", "{{props myobject sort='prop' filter=~oddIndex}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' filter=~oddIndex start=1 end=3}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "C 4 - D 6 - ", "{{props myobject sort='prop' filter=~oddIndex start=1 end=3}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' filter=~oddIndex start=-3 end=-1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "C 4 - D 6 - ", "{{props myobject sort='prop' filter=~oddIndex start=-3 end=-1}} Negative start or end count from the end");
	assert.equal(jsv.templates("{{props myobject sort='prop' filter=~oddIndex start=3 end=3}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "", "{{props myobject sort='key' filter=~oddIndex start=3 end=3}} (outputs nothing)");

	assert.equal(jsv.templates("{{props myobject step=2 start=1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "b 9 - d 8 - B 7 - D 6 - ", "{{props myobject step=2 start=1}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' step=2 start=1}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "c 2 - C 4 - D 6 - d 8 - ", "{{props myobject sort='prop' step=2 start=1}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' step=2 start=3 end=6}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "C 4 - D 6 - ", "{{props myobject sort='prop' step=2 start=3 end=6}}");
	assert.equal(jsv.templates("{{props myobject sort='prop' step=2 start=-6 end=-3}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "C 4 - D 6 - ", "{{props myobject sort='prop' step=2 start=-6 end=-3}} Negative start or end count from the end");
	assert.equal(jsv.templates("{{props myobject sort='prop' step=2 start=3 end=3}}{{:key}} {{:prop}} - {{/props}}").render({myobject: myobject}, {oddIndex: oddIndex}), "", "{{props myobject sort='key' step=2 start=3 end=3}} (outputs nothing)");
	// =============================== Arrange ===============================

	var mypeople = {
		p1: {name: "Jo", details: {age: 22}},
		p2: {name: "Bob", details: {age: 2}},
		p3: {name: "Emma", details: {age: 12}},
		p7: {name: "Jeff", details: {age: 13.5}},
		p6: {name: "Julia", details: {age: 0.6}},
		p5: {name: "Xavier", details: {age: 0}}
	};

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{props mypeople sort='prop.name'}}{{:prop.name}}: age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople}), "Bob: age 2 - Emma: age 12 - Jeff: age 13.5 - Jo: age 22 - Julia: age 0.6 - Xavier: age 0 - ", "{{props mypeople  sort='name'}}");
	assert.equal(jsv.templates("{{props mypeople sort='prop.details.age'}}{{:prop.name}}: age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople}), "Xavier: age 0 - Julia: age 0.6 - Bob: age 2 - Emma: age 12 - Jeff: age 13.5 - Jo: age 22 - ", "{{props mypeople  sort='details.age'}}");

	assert.equal(jsv.templates("{{props mypeople sort='prop.details.age' reverse=true filter=~underLimit limit=20}}{{:prop.name}}: age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Jeff: age 13.5 - Emma: age 12 - Bob: age 2 - Julia: age 0.6 - Xavier: age 0 - ", "{{props mypeople sort='details.age' reverse=true filter=~underLimit...}}");
	assert.equal(jsv.templates("{{props mypeople sort='prop.details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:prop.name}}: age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ", "{{props mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}}");
	assert.equal(jsv.templates("{{props mypeople sort='prop.details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:prop.name}}: age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ", "{{props mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}}");

	// =============================== Arrange ===============================

	var mypeople2 = {
		p1: {name: "Bill", details: {age: 22, role: "Lead"}},
		p2: {name: "Anne", details: {age: 32, role: "Assistant"}},
		p3: {name: "Emma", details: {age: 19.1, role: "Team member"}},
		p7: {name: "Jeff", details: {age: 33.5, role: "Lead"}},
		p6: {name: "Xavier", details: {age: 32, role: "Team member"}},
		p5: {name: "Julia", details: {age: 18, role: "Assistant"}},
		p4: {name: "Bill", details: {age: 32, role: "Team member"}}
	};

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{props mypeople sort=~sortAgeName}}{{:prop.name}}: ({{:prop.details.role}}) age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Julia: (Assistant) age 18 - Anne: (Assistant) age 32 - Bill: (Lead) age 22 - Jeff: (Lead) age 33.5 - Emma: (Team member) age 19.1 - Bill: (Team member) age 32 - Xavier: (Team member) age 32 - ",
		"{{props mypeople sort=~sortAgeName}}: custom sort function");

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{props mypeople sort=~sortAgeName reverseAge=true}}{{:prop.name}}: ({{:prop.details.role}}) age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Anne: (Assistant) age 32 - Julia: (Assistant) age 18 - Jeff: (Lead) age 33.5 - Bill: (Lead) age 22 - Bill: (Team member) age 32 - Xavier: (Team member) age 32 - Emma: (Team member) age 19.1 - ",
		"{{props mypeople sort=~sortAgeName}}: custom sort function - this pointer is tagCtx");

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{props ''}}{{else mypeople sort=~sortAgeName reverseAge=true}}{{:prop.name}}: ({{:prop.details.role}}) age {{:prop.details.age}} - {{/props}}").render({mypeople: mypeople2}, {sortAgeName: sortAgeName}),
		"Anne: (Assistant) age 32 - Julia: (Assistant) age 18 - Jeff: (Lead) age 33.5 - Bill: (Lead) age 22 - Bill: (Team member) age 32 - Xavier: (Team member) age 32 - Emma: (Team member) age 19.1 - ",
		"{{props ''}}{{else mypeople sort=~sortAgeName}}: custom sort function - this pointer is tagCtx (else block)");

	// =============================== Arrange ===============================

	jsv.views.tags("props2", {
		baseTag: "props"
	});

	// ................................ Assert ..................................

	assert.equal(jsv.templates("{{props2 mypeople sort='prop.details.age' reverse=true filter=~underLimit limit=20 start=1 end=-1}}{{:prop.name}}: age {{:prop.details.age}} - {{/props2}}").render({mypeople: mypeople}, {underLimit: underLimit}), "Emma: age 12 - Bob: age 2 - Julia: age 0.6 - ", "{{for2 mypeople  sort='details.age' reverse=true filter=~underLimit... start=1 end=-1}} Derived tag");
});

QUnit.module("{{!-- --}}");
QUnit.test("{{!-- --}}", function(assert) {
	// =============================== Arrange ===============================
	var result,
		tmpl = jsv.templates("a {{:'--1'}}\n {{for '--2} }'}} {{:}} {{/for}} \n b"),
		tmplWrappedInComment = jsv.templates("a {{!-- {{:'--1'}}\n {{for '--2} }'}} {{:}} {{/for}} \n--}} b");

	// ................................ Assert ..................................
	result = tmpl.render() + "|" + tmplWrappedInComment.render();
	assert.equal(result, "a --1\n  --2} } \n b|a  b",
		"{{!-- --}} comments out blocks including newlines and --");
});

QUnit.module("allowCode");
QUnit.test("{{*}}", function(assert) {
	// =============================== Arrange ===============================
	jsv.views.settings.allowCode(false);
	global.glob = {a: "AA"};

	var tmpl = jsv.templates("_{{*:glob.a}}_");

	// ................................ Assert ..................................
	assert.equal(tmpl.render(), "__",
		"{{*:expression}} returns nothing if allowCode not set to true");

	// =============================== Arrange ===============================
	jsv.views.settings.allowCode(true);

	var result = "" + !!tmpl.allowCode + " " + tmpl.render(); // Still returns "__" until we recompile

	tmpl.allowCode = true;

	result += "|" + !!tmpl.allowCode + " " + tmpl.render(); // Still returns "__" until we recompile

	// ................................ Assert ..................................
	assert.equal(result, "false __|true __",
		"If jsv.settings.allowCode() or tmpl.allowCode are set to true, previously compiled template is unchanged, so {{*}} still inactive");

	// ................................ Act ..................................
	tmpl = jsv.templates("_{{*:glob.a}}_");

	result = "" + !!tmpl.allowCode + " " + tmpl.render(); // Now {{*}} is active

	// ................................ Assert ..................................
	assert.equal(result, "true _AA_",
		"If jsv.settings.allowCode() set to true, {{*: expression}} returns evaluated expression, with access to globals");

	// =============================== Arrange ===============================
	jsv.views.settings.allowCode(false);

	tmpl = jsv.templates({
		markup: "_{{*:glob.a}}_",
		allowCode: true
	});

	// ................................ Assert ..................................
	assert.equal(tmpl.render(), "_AA_",
		"If template allowCode property set to true, {{*: expression}} returns evaluated expression, with access to globals");

	// ................................ Act ..................................
	tmpl = jsv.templates({
		markup: "_{{*:glob.a}}_"
	});

	result = "" + !!tmpl.allowCode + ":" + tmpl();

	tmpl = jsv.templates({markup: tmpl, allowCode: true});

	result += "|" + tmpl.allowCode + ":" + tmpl();

	// ................................ Assert ..................................
	assert.equal(result, "false:__|true:_AA_",
		"Can recompile tmpl to allow code, using tmpl = jsv.templates({markup: tmpl, allowCode: true})");

	// ................................ Act ..................................
	jsv.templates("myTmpl", {
		markup: "_{{*:glob.a}}_"
	});

	tmpl = jsv.templates.myTmpl;

	result = "" + !!tmpl.allowCode + ":" + tmpl();

	jsv.templates("myTmpl", {markup: jsv.templates.myTmpl, allowCode: true});

	tmpl = jsv.templates.myTmpl;

	result += "|" + tmpl.allowCode + ":" + tmpl();

	// ................................ Assert ..................................
	assert.equal(result, "false:__|true:_AA_",
		'Can recompile named tmpl to allow code, using jsv.templates("myTemplateName", {markup: jsv.templates.myTmpl, allowCode:true})"');

	// =============================== Arrange ===============================
	jsv.views.settings.allowCode(true);

	// ................................ Act ..................................
	global.myVar = 0;

	tmpl = jsv.templates(
		"{{* myvar=2; myvar+=4; }}"
		+ "Initial value: {{*:myvar}} "
		+ "{{* myvar+=11; }}"
		+ "New value: {{*:myvar}}");

	// ................................ Assert ..................................
	assert.equal(tmpl.render(), "Initial value: 6 New value: 17",
		"{{* expression}} or {{*: expression}} can access globals as window.myVar or myVar");

	// ................................ Act ..................................
	global.people = people;
	tmpl = jsv.templates("{{:start}}"

		+ "{{* for (var i=0, l=people.length; i<l; i++) { }}"
			+ " {{:title}} = {{*: people[i].name + ' ' + data.sep + ' '}}!"
		+ "{{* } }}"

		+ "{{:end}}");

	// ................................ Assert ..................................
	assert.equal(tmpl.render({title: "name", start: "Start", end: "End", sep: "..."}), "Start name = Jo ... ! name = Bill ... !End",
		"If allowCode set to true, on recompiling the template, {{*:expression}} returns evaluated expression, with access to globals");

	// ................................ Act ..................................
	global.myFunction = function() {
		return "myGlobalfunction ";
	};
	document.title = "myTitle";
	tmpl = jsv.templates("{{for people}}"
		+ "{{*: ' ' + glob.a}} {{*: data.name}} {{*: view.index}} {{*: view.ctx.myHelper}} {{*: myFunction() + document.title}}"
	+ "{{/for}}");

	// ................................ Assert ..................................
	assert.equal(tmpl.render({people: people}, {myHelper: "hi"}), " AA Jo 0 hi myGlobalfunction myTitle AA Bill 1 hi myGlobalfunction myTitle",
		"{{* expression}} or {{*: expression}} can access globals, the data, the view, the view context, global functions etc.");

	document.title = "";

	jsv.views.settings.allowCode(false);

});

QUnit.module("useViews");
QUnit.test("", function(assert) {

	// =============================== Arrange ===============================
	jsv.views.settings.allowCode(true);
	jsv.views.tags("exclaim", "!!! ");
	var message = "",

		tmpl = jsv.templates(
			"{{for towns}}"
				+ "{{>name}}"
				+ "{{*:view.index===view.parent.data.length-2 ? ' and ' : view.index<view.parent.data.length-2 ? ', ': ''}}"
			+ "{{/for}}");

	// ................................ Act ..................................
	try {
		tmpl.render({towns: towns});
	} catch(e) {
		message = e.message;
	}

	// ................................ Assert ..................................
	assert.ok(!tmpl.useViews && message.indexOf("undefined") > 0,
		"A simple template with useViews=false will not provide access to the views through allowCode");

	// ................................ Act ..................................
	message = "";
	tmpl.useViews = true;

	// ................................ Assert ..................................
	assert.equal(tmpl.render({towns: towns}), "Seattle, Paris and Delhi",
		"If tmpl.useViews set to true (for an existing template - without recompiling), the template renders with view hierarchy");

	// ................................ Act ..................................
	tmpl.useViews = false;

	jsv.views.settings.advanced({useViews: true});
	// ................................ Assert ..................................
	assert.equal(tmpl.render({towns: towns}), "Seattle, Paris and Delhi",
		"If tmpl.useViews is set to false, but jsv.views.settings.advanced({useViews: ...}) is set to true, the template renders with view hierarchy, (without recompiling).");

	// ................................ Act ..................................
	jsv.views.settings.advanced({useViews: false});

	tmpl = jsv.templates({markup: tmpl,
		useViews: true
	});

	// ................................ Assert ..................................
		tmpl = jsv.templates(
			"{{:#type}} "
			+ "{{for towns}}"
				+ "{{>name}}"
				+ "{{*:view.index===view.parent.data.length-2 ? ' and ' : view.index<view.parent.data.length-2 ? ', ': ''}}"
			+ "{{/for}}");

	var html = tmpl.render({towns: towns});

	assert.equal(tmpl.useViews && html, "data Seattle, Paris and Delhi",
		"Recompiling the template with useViews: true will create a template that has tmpl.useViews = true, which renders with a 'data' view");

	// ................................ Act ..................................
	tmpl.useViews = false;

	html = tmpl.render({towns: towns});

	// ................................ Assert ..................................
	assert.equal(!tmpl.useViews && html, "top Seattle, Paris and Delhi",
		"If tmpl.useViews set to false (for an existing template - without recompiling), the template renders without a 'data' view");

	// ................................ Act ..................................
	jsv.views.settings.advanced({useViews: true});

	tmpl = jsv.templates({markup: tmpl});

	jsv.views.settings.advanced({useViews: false});

	// ................................ Assert ..................................
	assert.equal(tmpl.useViews && tmpl.render({towns: towns}), "data Seattle, Paris and Delhi",
		"If jsv.views.settings.advanced({useViews: ...}) was true when the template was compiled, then the template renders with views, even if jsv.views.settings.advanced({useViews: ...}) is no longer set to true");

	// =============================== Arrange ===============================
	jsv.views.settings.advanced({useViews: false});

		tmpl = jsv.templates(
			"{{exclaim/}}"
			+ "{{for towns}}"
				+ "{{>name}}"
				+ "{{*:view.index===view.parent.data.length-2 ? ' and ' : view.index<view.parent.data.length-2 ? ', ': ''}}"
			+ "{{/for}}");

	// ................................ Assert ..................................
	assert.equal(tmpl.useViews && tmpl.render({towns: towns}), "!!! Seattle, Paris and Delhi",
		"A template with richer features, (such as a custom tag, or nested tags) will automatically have tmpl.useViews=true and will render with views, even if jsv.views.settings.advanced({useViews: ...}) is set to false");

	// ................................ Act ..................................
	var originalUseViews = tmpl.useViews;
	tmpl.useViews = false;

	// ................................ Assert ..................................
	assert.equal(originalUseViews && !tmpl.useViews && tmpl.render({towns: towns}), "!!! Seattle, Paris and Delhi",
		"Setting tmpl.useViews=false will NOT prevent a richer template from rendering views.");

	// =============================== Arrange ===============================
		tmpl = jsv.templates(
			"{{for towns}}"
				+ "{{>name}}"
				+ "{{*:view.index===view.parent.data.length-2 ? ' and ' : view.index<view.parent.data.length-2 ? ', ': ''}}"
			+ "{{/for}}");

	// ................................ Act ..................................
	originalUseViews = tmpl.useViews;
	tmpl.useViews = true;

	// ................................ Assert ..................................
	assert.equal(!originalUseViews && tmpl.useViews && tmpl.render({towns: towns}), "Seattle, Paris and Delhi",
		"Setting tmpl.useViews=true WILL prevent a simpler template from rendering without views.");

	// ................................ Act ..................................
	tmpl.useViews = originalUseViews;
	jsv.views.settings.advanced({useViews: true});

	// ................................ Assert ..................................
	assert.equal(!tmpl.useViews && tmpl.render({towns: towns}), "Seattle, Paris and Delhi",
		"Setting jsv.views.settings.advanced({useViews: true}) WILL prevent a simpler template from rendering without views.");

	// =========================== Reset settings ============================
	jsv.views.settings.advanced({useViews: false});
	jsv.views.settings.allowCode(false);
	document.title = "";

	// =============================== Arrange ===============================
	tmpl = jsv.templates("{{:a.getHtml()}} {{if true}}{{:b}} {{/if}}");
	var innerTmpl = jsv.templates("{{:inner}}"),

		data = {
			a: {
				getHtml: function() {
					return jsv.templates("{{:inner}}").render(this);
				},
				inner: "INNER"
			},
			b: "OUTER"
		};

	// ................................ Act ..................................
		html = tmpl.render(data);

	// ................................ Assert ..................................
	assert.equal(!tmpl.useViews && !innerTmpl.useViews && html, "INNER OUTER ",
		"Nested top-level programmatic template calls which do not use views work correctly");
		// See https://github.com/BorisMoore/jsrender/issues/333

	// ................................ Act ..................................
	tmpl = jsv.templates({
		markup: "{{:a.getHtml()}} {{if true}}{{:b}} {{/if}}",
		useViews: true
	});
	innerTmpl = jsv.templates({
		markup: "{{:inner}}",
		useViews: true
	});
	html = tmpl.render(data);

	// ................................ Assert ..................................
	assert.equal(tmpl.useViews && innerTmpl.useViews && html, "INNER OUTER ",
		"Nested top-level programmatic template calls using views work correctly");
		// See https://github.com/BorisMoore/jsrender/issues/333

});

QUnit.module("All tags");
QUnit.test("itemVar", function(assert) {
	var otherPeople = [
		{name: "Jo", otherTels: [1, 2]},
		{name: "Bill", tels: [91,92]},
		{name: "Fred"}
	];
	var message = "";
	try {
		jsv.templates(
			"{{for people itemVar='person'}}"
				+ "{{:~person.name}} "
			+ "{{/for}}"
			).render({people: people});
	} catch(e) {
		message = e.message;
	}

	assert.equal(message, "Syntax error\nUse itemVar='~myItem'",
		"Setting itemVar='something' without initial '~' throws syntax error");

	assert.equal(jsv.templates(
		"{{for people itemVar='~person'}}"
			+ "{{:~person.name}} "
		+ "{{/for}}"
		).render({people: people}),
		"Jo Bill ",
		"Setting {{for people itemVar='~person'}} creates ~person contextual parameter");

	assert.equal(jsv.templates(
		"{{for people}}"
			+ "{{:name}}"
		+ "{{else others itemVar='~otherPerson'}}"
			+ "{{:~otherPerson.name}} "
		+ "{{/for}}"
		).render({others: people}),
		"Jo Bill ",
		"Can use itemVar on {{for}}{{else}} too: {{else others itemVar='~otherPerson'}}");

	assert.equal(jsv.templates(
		"{{for people}}"
			+ "{{if tels itemVar='~person'}}"
				+ "{{:name}} {{:~person.name}} "
			+ "{{else otherTels itemVar='~sameperson'}}"
				+ "{{:~sameperson.name}} "
			+ "{{else itemVar='~stillperson'}}"
				+ "{{:~stillperson.name}} "
			+ "{{/if}}"
		+ "{{/for}}"
		).render({people: otherPeople}),
		"Jo Bill Bill Fred ",
		"itemVar works also on {{if}}{{else}}{{/if}} even though the context is same as outer context for {{if}}.");

	assert.equal(jsv.templates(
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
		).render({people: otherPeople}),
		"Jo 1 Jo 2 Bill 91 Bill 92 true Fred no phones",
		"itemVar works also on {{for arr1}}{{else arr2}}{{else}}{{/for}}" +
		"\neven though the context for the final {{else}} is the same as outer context for {{if}}.");

	assert.equal(jsv.templates(
		"{{for people itemVar='~person'}}"
			+ "{{:~person.name}}"
			+ "{{if ~person.tels itemVar='~ifVar'}}"
					+ " Phones:"
					+ "{{for ~ifVar.tels itemVar='~tel'}}"
						+ " {{:~tel}}"
					+ "{{/for}}"
				+ "{{/if}}. "
			+ "{{/for}}"
		).render({people: otherPeople}),
		"Jo. Bill Phones: 91 92. Fred. ",
		"Using itemVar and passing context to nested templates");

	assert.equal(jsv.templates(
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
		).render({people: otherPeople}),
		"Jo 1 2. Bill 91 92. Fred (No phones). ",
		"Additional example using itemVar and passing context to nested templates");

	assert.equal(jsv.templates({
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
		}).render({people: otherPeople}),
		"<u>Jo  <b>1 2 </b>Bill <i>91 92 </i> Fred   </u>",
		"itemVar with custom tags {{wrappedFor}}{{else}}{{/wrappedFor}}, and passing context to nested templates");

	assert.equal(jsv.templates(
		"{{for people itemVar='~person'}}"
			+ "{{props ~person itemVar='~prop'}}"
				+ "{{:~prop.key}}: {{:~prop.prop}} "
			+ "{{/props}}"
		+ "{{/for}}"
		).render({people: otherPeople}),
		"name: Jo otherTels: 1,2 name: Bill tels: 91,92 name: Fred ",
		"itemVar with {{props}}, and passing context to nested templates");

	assert.equal(jsv.templates(
		"{{for people itemVar='~person'}}"
			+ "{{props ~person.tels itemVar='~prop'}}"
				+ "{{:~person.name}} Tel: {{:~prop.key}}: {{:~prop.prop}} "
			+ "{{else itemVar='~personWithoutTels'}}"
				+ "{{:~personWithoutTels.name}}: has no tels "
			+ "{{/props}}"
		+ "{{/for}}"
		).render({people: otherPeople}),
		"Jo: has no tels Bill Tel: 0: 91 Bill Tel: 1: 92 Fred: has no tels ",
		"itemVar with {{props}}{{else}}{{/props}}, and passing context to nested templates");
});

QUnit.test("contextual parameter", function(assert) {
var teams = [
	{title: "The A Team", members: [{name: "Jeff"}, {name: "Maria"}]},
	{title: "The B Team", members: [{name: "Francis"}]}
];

	assert.equal(jsv.templates(
"{{if members.length ~teamTitle=title ~teamData=#data ~teamIndex=#index}}"
	+ "{{for members itemVar='~member'}}"
		+ "{{:~teamTitle}} "
		+ "{{:~teamData.title}} "
		+ "{{:~teamIndex}} "
		+ "{{:~member.name}} "
	+ "{{/for}}"
+ "{{/if}}"
).render(teams),
		"The A Team The A Team 0 Jeff The A Team The A Team 0 Maria The B Team The B Team 1 Francis ",
		"contextual parameter passing to inner context");

	assert.equal(jsv.templates(
"{^{if 1 ~a='A'+\"B\"+'\"'+\"'\"+\"\\'\"}}{^{:'Inner'+~a}}{{/if}}").render(),
		"InnerAB\"'\\'",
		"contextual parameter correctly escaping quotes and backslash");
});

QUnit.module("api no jQuery");
QUnit.test("templates", function(assert) {

	// ................................ Arrange ..................................
	jsv.templates("./test/templates/file/path.html", null); // In case template has been stored in a previous test

	// ................................ Act ..................................
	var tmpl0 = jsv.templates({markup: "./test/templates/file/path.html"}); // Compile template but do not cache

	// ............................... Assert .................................
	assert.equal(!jsv.templates["./test/templates/file/path.html"] && tmpl0.render({name: "Jo0"}),
		"ServerRenderedTemplate_Jo0_B",
		"Compile server-generated template, without caching");

	// ................................ Act ..................................
	var tmpl1 = jsv.templates("./test/templates/file/path.html"); // Compile and cache, using path as key

	// ............................... Assert .................................
	assert.equal(tmpl1 !== tmpl0 && jsv.templates["./test/templates/file/path.html"] === tmpl1 && tmpl1.render({name: "Jo1"}),
		"ServerRenderedTemplate_Jo1_B",
		"Compile server-generated template, and cache on file path");

	// ................................ Act ..................................
	var tmpl2 = jsv.templates("./test/templates/file/path.html"); // Use cached template, accessed by path as key

	// ............................... Assert .................................
	assert.equal(tmpl2 === tmpl1 && tmpl1.render({name: "Jo2"}),
		"ServerRenderedTemplate_Jo2_B",
		"Re-use cached server-generated template");

	// ................................ Act ..................................
	var tmpl3 = jsv.templates({markup: "./test/templates/file/path.html"}); // Re-compile template but do not cache. Leaved cached template.

	// ............................... Assert .................................
	assert.equal(tmpl3 !== tmpl0 && tmpl3 !== tmpl1 && jsv.templates["./test/templates/file/path.html"] === tmpl1 && tmpl3.render({name: "Jo3"}),
		"ServerRenderedTemplate_Jo3_B",
		"Recompile server-generated template, without caching");

	// ................................ Reset ................................
	delete jsv.templates["./test/templates/file/path.html"];
	if (isBrowser) {
		document.getElementById("./test/templates/file/path.html").removeAttribute("data-jsv-tmpl");
	}

if (isBrowser) {
	var tmplElem = document.getElementById("myTmpl");

	// ................................ Act ..................................
	tmpl0 = jsv.templates({markup: "#myTmpl"}); // Compile template declared in script block, but do not cache

	// ............................... Assert .................................
	assert.equal(tmpl0.render({name: "Jo0"}), "A_Jo0_B",
		"Compile template declared in script block, without caching");

	// ................................ Act ..................................
	tmpl1 = jsv.templates("#myTmpl"); // Compile and cache, using "#myTmpl" as key);

	// ............................... Assert .................................
	assert.equal(tmpl1 !== tmpl0 && tmpl1.render({name: "Jo1"}), "A_Jo1_B",
		"Compile template declared in script block, and cache on file path");

	// ................................ Act ..................................
	tmpl2 = jsv.templates("#myTmpl"); // Use cached template, accessed by jsv.templates["#myTmpl"]

	// ............................... Assert .................................
	assert.equal(tmpl2 === tmpl1 && tmpl1.render({name: "Jo2"}), "A_Jo2_B",
		"Re-use cached template declared in script block");

	// ................................ Act ..................................
	var tmpl2b = jsv.templates(".myTmpl"); // Try to access script element by class selector - but fail because jQuery not loaded, so only "#xxx" selector is supported

	// ............................... Assert .................................
	if (jsv.fn || window._$ || tmpl2b === tmpl2) {
		assert.equal(tmpl2b === tmpl2 && tmpl2b.render({name: "Jo2"}), "A_Jo2_B",
		"Try to access script block using class selector - but not supported, by design, when jQuery not loaded");
	} else {
		assert.equal(tmpl2b !== tmpl2 && tmpl2b.render({name: "Jo2"}), ".myTmpl",
		"Can access script block using class selector - when jQuery loaded");
	}

	// ................................ Act ..................................
	tmpl2 = jsv.templates("#myAbsentTmpl");

	// ............................... Assert .................................
	assert.equal(tmpl2.render({name: "Jo2"}), "#myAbsentTmpl",
		"Access missing script block template - renders as string");

	// ................................ Act ..................................
	tmpl3 = jsv.templates({markup: "#myTmpl"}); // Re-compile template but do not cache. Leave cached template.

	// ............................... Assert .................................
	assert.equal(tmpl3 !== tmpl0 && tmpl3 !== tmpl1 && tmpl3.render({name: "Jo3"}), "A_Jo3_B",
		"Recompile template declared in script block, without caching");

	// ................................ Reset ................................
	tmplElem.removeAttribute("data-jsv-tmpl");
}

// =============================== Arrange ===============================
	tmplString = "A_{{:name}}_B";

	var tmpl = jsv.templates(tmplString);
	// ............................... Assert .................................
	assert.equal(tmpl.render(person), "A_Jo_B",
		'Compile from string: var tmpl = jsv.templates(tmplString);');

	// ............................... Assert .................................
	assert.equal(tmpl(person), "A_Jo_B",
		'Compiled template is itself the render function: html = tmpl(data);');

	// =============================== Arrange ===============================
	var fnToString = tmpl.fn.toString();

	// ............................... Assert .................................
	assert.equal(jsv.templates("", tmplString).fn.toString() === fnToString && jsv.templates(null, tmplString).fn.toString() === fnToString && jsv.templates(undefined, tmplString).fn.toString() === fnToString, true,
		'if name is "", null, or undefined, then var tmpl = jsv.templates(name, tmplString)' +
		'\nis equivalent to var tmpl = jsv.templates(tmplString);');

	// =============================== Arrange ===============================
	jsv.templates("myTmpl", tmplString);

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl(person), "A_Jo_B",
		'Compile and register named template: jsv.templates("myTmpl", tmplString);');

	// =============================== Arrange ===============================
	jsv.templates({myTmpl2: tmplString, myTmpl3: "X_{{:name}}_Y"});

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl2(person) + jsv.render.myTmpl3(person), "A_Jo_BX_Jo_Y",
		'Compile and register named templates: jsv.templates({myTmpl: tmplString, myTmpl2: tmplString2});');

	// =============================== Arrange ===============================
	jsv.templates("!'-#==", "x");
	jsv.templates({'&^~>"2': "y"});
	assert.equal(jsv.render["!'-#=="](person) + jsv.render['&^~>"2'](person), "xy",
		'Named templates can have arbitrary names;');

	jsv.templates({myTmpl4: "A_B"});

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl4(person), "A_B",
		'jsv.templates({myTmpl: htmlWithNoTags});');

	// =============================== Arrange ===============================
	jsv.templates("myTmpl5", {
		markup: tmplString
	});

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl5(person), "A_Jo_B",
		'jsv.templates("myTmpl", {markup: markupString});');

	// ............................... Assert .................................
	assert.equal(jsv.templates("", {markup: tmplString}).render(person), "A_Jo_B",
		'Compile from template object without registering: var tmpl = jsv.templates("", {markup: markupString});');

	// ............................... Assert .................................
	assert.equal(jsv.templates({markup: tmplString}).render(person), "A_Jo_B",
		'Compile from template object without registering: var tmpl = jsv.templates({markup: markupString});');

	// =============================== Arrange ===============================
	jsv.templates({
		myTmpl6: {
			markup: tmplString
		}
	});

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl6(person), "A_Jo_B",
		'jsv.templates({myTmpl: {markup: markupString}});');

	// =============================== Arrange ===============================
	jsv.templates("myTmpl7", tmpl);

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl7(person), "A_Jo_B",
		'Cloning a template: jsv.templates("newName", tmpl);');

	// ............................... Assert .................................
	assert.equal(jsv.templates(tmpl) === tmpl, true,
		'jsv.templates(tmpl) returns tmpl');

	// ............................... Assert .................................
	assert.equal(jsv.templates("", tmpl) === tmpl, true,
		'jsv.templates("", tmpl) returns tmpl');

	// =============================== Arrange ===============================
	var tmplWithHelper = jsv.templates("A_{{:name}}_B{{:~foo}}");
	var result = tmplWithHelper(person, {foo: "thisFoo"});

	var tmplWithHelper2 = jsv.templates({markup: tmplWithHelper, helpers: {foo: "thatFoo"}});
	result += "|" + tmplWithHelper2(person);

	// ............................... Assert .................................
	assert.equal(result, "A_Jo_BthisFoo|A_Jo_BthatFoo",
		'Cloning a template to add/replace/change some template properties: var tmpl2 = jsv.templates({markup: tmpl1, otherOptions...});');

	// ............................... Assert .................................
	assert.equal(jsv.templates("", tmpl) === tmpl, true,
		'jsv.templates(tmpl) returns tmpl');

	// ............................... Assert .................................
	assert.equal(jsv.templates("").render(), "",
		'jsv.templates("") is a template with empty string as content');

	// =============================== Arrange ===============================
	jsv.templates("myEmptyTmpl", "");

	// ............................... Assert .................................
	assert.equal(jsv.templates.myEmptyTmpl.render(), "",
		'jsv.templates("myEmptyTmpl", "") is a template with empty string as content');

	// =============================== Arrange ===============================
	jsv.templates("myTmpl", null);

	// ............................... Assert .................................
	assert.equal(jsv.templates.myTmpl === undefined && jsv.render.myTmpl === undefined, true,
		'Remove a named template: jsv.templates("myTmpl", null);');
});

QUnit.test("render", function(assert) {
	var tmpl1 = jsv.templates("myTmpl8", tmplString);
	jsv.templates({
		simple: "Content{{:#data}}|",
		templateForArray: "Content{{for #data}}{{:#index}}{{/for}}{{:~foo}}",
		primitiveDataTypes: "|{{:#data}}"
	});

	assert.equal(tmpl1.render(person), "A_Jo_B", 'tmpl1.render(data);');
	assert.equal(jsv.render.myTmpl8(person), "A_Jo_B", 'jsv.render.myTmpl8(data);');

	jsv.templates("myTmpl9", "A_{{for}}inner{{:name}}content{{/for}}_B");
	assert.equal(jsv.templates.myTmpl9.tmpls[0].render(person), "innerJocontent", 'Access nested templates: jsv.templates["myTmpl9[0]"];');

	jsv.templates("myTmpl10", "top index:{{:#index}}|{{for 1}}nested index:{{:#get('item').index}}|{{if #get('item').index===0}}nested if index:{{:#get('item').index}}|{{else}}nested else index:{{:#get('item').index}}|{{/if}}{{/for}}");

	assert.equal(jsv.render.myTmpl10(people), "top index:0|nested index:0|nested if index:0|top index:1|nested index:1|nested else index:1|",
										"#get('item').index gives the integer index even in nested blocks");

	jsv.templates("myTmpl11", "top index:{{:#index}}|{{for people}}nested index:{{:#index}}|{{if #index===0}}nested if index:{{:#get('item').index}}|{{else}}nested else index:{{:#get('item').index}}|{{/if}}{{/for}}");

	assert.equal(jsv.render.myTmpl11({people: people}), "top index:|nested index:0|nested if index:0|nested index:1|nested else index:1|",
										"#get('item').index gives the integer index even in nested blocks");

	jsv.views.tags({
		myWrap: {}
	});

	var templateWithIndex = jsv.templates(
			'{{for people}}'
			+ 'a{{:#index}} '
			+ '{{if true}}b{{:#index}}{{/if}} '
			+ 'c{{:#index}} '
			+ '{{myWrap}}d{{:#index}} {{/myWrap}}'
		+ '{{/for}}');

	jsv.views.settings.debugMode(true);
	var result = templateWithIndex.render({people: [1,2]});

	jsv.views.settings.debugMode(false);
	var result2 = templateWithIndex.render({people: [1,2]});

	assert.equal(result2 === result && result,
		"a0 bFor #index in nested block use #getIndex(). c0 dFor #index in nested block use #getIndex(). a1 bFor #index in nested block use #getIndex(). c1 dFor #index in nested block use #getIndex(). ",
		"#index gives error message in nested blocks (whether or not debugMode is true).");

	var templateWithGetIndex = jsv.templates(
			'{{for people}}'
			+ 'a{{:#getIndex()}} '
			+ '{{if true}}b{{:#getIndex()}}{{/if}} '
			+ 'c{{:#getIndex()}} '
			+ '{{myWrap}}d{{:#getIndex()}} {{/myWrap}}'
		+ '{{/for}}');

	assert.equal(templateWithGetIndex.render({people: [1,2]}),
		"a0 b0 c0 d0 a1 b1 c1 d1 ",
		"#getIndex gives inherited index in nested blocks.");

	jsv.views.helpers({myKeyIsCorrect: function(view) {
		return view.parent.views[view._.key] === view;
	}});
	jsv.templates("myTmpl12", "{{for people}}nested {{:~myKeyIsCorrect(#view)}}|{{if #index===0}}nested if {{:~myKeyIsCorrect(#view)}}|{{else}}nested else {{:~myKeyIsCorrect(#view)}}|{{/if}}{{/for}}");

	assert.equal(jsv.render.myTmpl12({people: people}), "nested true|nested if true|nested true|nested else true|",
										'view._key gives the key of this view in the parent views collection/object');

	assert.equal(jsv.templates(tmplString).render(person), "A_Jo_B", 'Compile from string: var html = jsv.templates(tmplString).render(data);');
	assert.equal(jsv.render.myTmpl8(people), "A_Jo_BA_Bill_B", 'jsv.render.myTmpl(array);');
	assert.equal(jsv.render.simple([]), "", 'Empty array renders empty string');
	assert.equal(jsv.render.simple(["",false,null,undefined,1]), "Content|Contentfalse|Content|Content|Content1|", 'Empty string, false, null or undefined members of array are also rendered');
	assert.equal(jsv.render.simple(null), "Content|", 'null renders once with #data null');
	assert.equal(jsv.render.simple(), "Content|", 'Undefined renders once with #data undefined');
	assert.equal(jsv.render.simple(false), "Contentfalse|", 'false renders once with #data false');
	assert.equal(jsv.render.simple(0), "Content0|", '0 renders once with #data 0');
	assert.equal(jsv.render.simple(""), "Content|", '"" renders once with #data ""');

	assert.equal(jsv.render.templateForArray([[null,undefined,1]]), "Content012", 'Can render a template against an array without iteration, by wrapping array in an array');
	assert.equal(jsv.render.templateForArray([null,undefined,1], true), "Content012", 'render(array, true) renders an array without iteration');
	assert.equal(jsv.render.templateForArray([null,undefined,1], {foo:"foovalue"}, true), "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');
	assert.equal(jsv.templates.templateForArray.render([null,undefined,1], {foo:"foovalue"}, true), "Content012foovalue", 'render(array, helpers, true) renders an array without iteration, while passing in helpers');
	assert.equal(jsv.render.templateForArray([[]]), "Content", 'Can render a template against an empty array without iteration, by wrapping array in an array');
	assert.equal(jsv.render.templateForArray([], true), "Content", 'Can render a template against an empty array without iteration, by passing in true as second parameter');
	assert.equal(jsv.render.templateForArray([], {foo: "foovalue"}, true), "Contentfoovalue", 'Can render a template against an empty array without iteration, by by passing in true as third parameter');
	assert.equal(jsv.render.primitiveDataTypes([0,1,"abc","",,true,false]), "|0|1|abc|||true|false", 'Primitive types render correctly, even if falsey');
});

QUnit.test("converters", function(assert) {
	function loc(data) {
		switch (data) {case "desktop": return "bureau";}
		return data;
	}
	jsv.views.converters({loc2: loc});
	assert.equal(jsv.templates("{{loc2:#data}}:{{loc2:'desktop'}}").render("desktop"), "bureau:bureau", "jsv.views.converters({loc: locFunction})");

	var locFn = jsv.views.converters("loc", loc);
	assert.equal(locFn === loc && jsv.views.converters.loc === loc && jsv.views.converters.loc2 === loc, true, 'locFunction === jsv.views.converters.loc === jsv.views.converters.loc2');

	jsv.views.converters({loc2: null});
	assert.equal(jsv.views.converters.loc2, undefined, 'jsv.views.converters({loc2: null}) to remove registered converter');

	assert.equal(jsv.templates("{{attr:a}}").render({a: 0}), "0", '{{attr:0}} returns "0"');
	assert.equal(jsv.templates("{{attr:a}}").render({}), "", "{{attr:undefined}} returns empty string");
	assert.equal(jsv.templates("{{attr:a}}").render({a: ""}), "", "{{attr:''}} returns empty string");
	assert.equal(jsv.templates("{{attr:a}}").render({a: null}), "", '{{attr:null}} returns empty string');
	assert.equal(jsv.templates("{{attr:a}}").render({a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{attr:"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	assert.equal(jsv.templates("{{>a}}").render({a: 0}), "0", '{{>0}} returns "0"');
	assert.equal(jsv.templates("{{>a}}").render({}), "", "{{>undefined}} returns empty string");
	assert.equal(jsv.templates("{{>a}}").render({a: ""}), "", "{{>''}} returns empty string");
	assert.equal(jsv.templates("{{>a}}").render({a: null}), "", "{{>null}} returns empty string");
	assert.equal(jsv.templates("{{>a}}").render({a: "<>&'" + '"'}), "&lt;&gt;&amp;&#39;&#34;", '{{>"<>&' + "'" + '}} returns "&lt;&gt;&amp;&#39;&#34;"');

	assert.equal(jsv.templates("{{loc:a}}").render({a: 0}), "0", '{{cnvt:0}} returns "0"');
	assert.equal(jsv.templates("{{loc:a}}").render({}), "", '{{cnvt:undefined}} returns empty string');
	assert.equal(jsv.templates("{{loc:a}}").render({a: ""}), "", "{{cnvt:''}} returns empty string");
	assert.equal(jsv.templates("{{loc:a}}").render({a: null}), "", "{{cnvt:null}} returns empty string");

	assert.equal(jsv.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({}), "|||", "{{attr:undefined}}|{{>undefined}}|{{loc:undefined}}|{{:undefined}} returns correct values");
	assert.equal(jsv.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:0}), "0|0|0|0", "{{attr:0}}|{{>0}}|{{loc:0}}|{{:0}} returns correct values");
	assert.equal(jsv.templates("{{attr:a}}|{{>a}}|{{loc:a}}|{{:a}}").render({a:false}), "false|false|false|false", "{{attr:false}}|{{>false}}|{{loc:false}}|{{:false}} returns correct values");
});

QUnit.test("{{sometag convert=converter}}", function(assert) {
	function loc(data) {
		switch (data) {
			case "desktop": return "bureau";
			case "a<b": return "a moins <que b";}
		return data;
	}
	jsv.views.converters("loc", loc);

	assert.equal(jsv.templates("1{{:#data convert='loc'}} 2{{:'desktop' convert='loc'}} 3{{:#data convert=~myloc}} 4{{:'desktop' convert=~myloc}}").render("desktop", {myloc: loc}), "1bureau 2bureau 3bureau 4bureau", "{{: convert=~myconverter}}");
	assert.equal(jsv.templates("1:{{:'a<b' convert=~myloc}} 2:{{> 'a<b'}} 3:{{html: 'a<b' convert=~myloc}} 4:{{> 'a<b' convert=~myloc}} 5:{{attr: 'a<b' convert=~myloc}}").render(1, {myloc: loc}),
		"1:a moins <que b 2:a&lt;b 3:a&lt;b 4:a&lt;b 5:a moins <que b",
		"{{foo: convert=~myconverter}} convert=converter is used rather than {{foo:, but with {{html: convert=~myconverter}}" +
		"\nor {{> convert=~myconverter}} html converter takes precedence and ~myconverter is ignored");
	assert.equal(jsv.templates("{{if true convert=~invert}}yes{{else false convert=~invert}}no{{else}}neither{{/if}}").render('desktop', {invert: function(val) {return !val;}}), "no", "{{if expression convert=~myconverter}}...{{else expression2 convert=~myconverter}}... ");
	assert.equal(jsv.templates("{{for #data convert=~reverse}}{{:#data}}{{/for}}").render([1,2,3], {reverse: function(val) {return val.reverse();}}, true), "321", "{{for expression convert=~myconverter}}");
});

QUnit.test("tags", function(assert) {
	// ................................ Reset ..................................
	towns = [{name: "Seattle"}, {name: "Paris"}, {name: "Delhi"}];

	// ................................ Act ..................................
	assert.equal(jsv.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({people: people}), "BillJo", "jsv.views.tags({sort: sortFunction})");

	assert.equal(jsv.templates("{^{sort people reverse=true}}{^{:name}}{{/sort}}").render({people: people}), "BillJo", "Calling render() with inline data-binding {^{...}} renders normally without binding");

	assert.equal(jsv.templates("{{sort people reverse=true towns}}{{:name}}{{/sort}}").render({people: people, towns:towns}), "DelhiParisSeattleBillJo", "Multiple parameters in arbitrary order: {{sort people reverse=true towns}}");

	assert.equal(jsv.templates("{{sort reverse=false people reverse=true towns}}{{:name}}{{/sort}}").render({people: people, towns:towns}), "DelhiParisSeattleBillJo", "Duplicate named parameters - last wins: {{sort reverse=false people reverse=true towns}}");

	var sort2 = jsv.views.tags("sort2", sort);
	assert.equal(sort2.render === sort && jsv.views.tags.sort.render === sort && jsv.views.tags.sort2.render === sort, true, 'sortFunction === jsv.views.tags.sort.render === jsv.views.tags.sort2.render');

	jsv.views.tags("sort2", null);
	assert.equal(jsv.views.tags.sort2, undefined, 'jsv.views.tags("sort2", null) to remove registered tag');

	jsv.views.tags("boldTag", {
		render: function() {
			return "<em>" + this.tagCtx.render() + "</em>";
		},
		template: "{{:#data}}"
	});
	assert.equal(jsv.templates("{{boldTag}}{{:#data}}{{/boldTag}}").render("theData"), "<em>theData</em>",
		'Data context inside a block tag using tagCtx.render() is the same as the outer context');

	assert.equal(jsv.templates("{{boldTag/}}").render("theData"), "<em>theData</em>",
		'Data context inside the built-in template of a self-closing tag using tagCtx.render() is the same as the outer context');

	assert.equal(jsv.templates("{{sort people reverse=true}}{{:name}}{{/sort}}").render({people: people}), "BillJo", "jsv.views.tags({sort: sortFunction})");

	// =============================== Arrange ===============================
	// ................................ Act ..................................
	var eventData = "",

		renderedOutput = jsv.templates({
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
	assert.equal(renderedOutput + "|" + eventData, "Jo special| init render getType", '{^{myWidget/}} - Events fire in order during rendering: init render');

	// =============================== Arrange ===============================
	jsv.views.tags({
		noRenderNoTemplate: {},
		voidRender: function() {},
		emptyRender: function() {return "";},
		emptyTemplate: {
			template: ""
		},
		templateReturnsEmpty: {
			template: "{{:a}}"
		}
	});

	// ............................... Assert .................................
	assert.equal(jsv.templates("a{{noRenderNoTemplate/}}b{^{noRenderNoTemplate/}}c{{noRenderNoTemplate}}{{/noRenderNoTemplate}}d{^{noRenderNoTemplate}}{{/noRenderNoTemplate}}e").render(1), "abcde",
	"non-rendering tag (no template, no render function) renders empty string");

	assert.equal(jsv.templates("a{{voidRender/}}b{^{voidRender/}}c{{voidRender}}{{/voidRender}}d{^{voidRender}}{{/voidRender}}e").render(1), "abcde",
	"non-rendering tag (no template, no return from render function) renders empty string");

	assert.equal(jsv.templates("a{{emptyRender/}}b{^{emptyRender/}}c{{emptyRender}}{{/emptyRender}}d{^{emptyRender}}{{/emptyRender}}e").render(1), "abcde",
	"non-rendering tag (no template, empty string returned from render function) renders empty string");

	assert.equal(jsv.templates("a{{emptyTemplate/}}b{^{emptyTemplate/}}c{{emptyTemplate}}{{/emptyTemplate}}d{^{emptyTemplate}}{{/emptyTemplate}}e").render(1), "abcde",
	"non-rendering tag (template has no content, no render function) renders empty string");

	assert.equal(jsv.templates("a{{templateReturnsEmpty/}}b{^{templateReturnsEmpty/}}c{{templateReturnsEmpty}}{{/templateReturnsEmpty}}d{^{templateReturnsEmpty}}{{/templateReturnsEmpty}}e").render(1), "abcde",
	"non-rendering tag (template returns empty string, no render function) renders empty string");

	jsv.views.tags({
		tagJustTemplate: {
			argDefault: false,
			template: "{{:#data ? name||length : 'Not defined'}} "
		},
		tagJustTemplateObject: {
			argDefault: false,
			template: {markup: "{{:#data ? name||length : 'Not defined'}} "}
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
			contentCtx: true,
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
		},
		tagWithTemplateWhichIteratesFirstArgNoDefaultArg: {
			template: "{{:#data ? name : 'Not defined'}} ",
			argDefault: false,
			render: function(val) {
				return this.tagCtx.render(val); // Renders against first arg and iterates if array. Does not default to current data
			}
		}
	});

	assert.equal(jsv.templates("a{{include person}}{{tagJustTemplate/}}{{/include}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a template and no param renders once against current data, if object");

	assert.equal(jsv.templates("a{{include person}}{{tagJustTemplateObject/}}{{/include}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a template object and no param renders once against current data, if object");

	assert.equal(jsv.templates("a{{include person}}{{tagJustTemplate undefinedProperty/}}{{/include}}").render({person: {name: "Jo"}}), "aNot defined ",
	"Tag with just a template and a parameter which is not defined renders once against 'undefined'");

	assert.equal(jsv.templates("a{{include people}}{{tagJustTemplate/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a template and no param renders once against current data, even if array" +
	"\n- but can add render method with tagCtx.render(val) to iterate - (next test)");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateWhichIteratesAgainstCurrentData/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render() iterates against current data if array");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateWhichIteratesAgainstCurrentData thisisignored/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render() iterates against current data if array" +
	"\n- and ignores argument if provided");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateWhichIteratesFirstArg/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render(val) renders against first arg" +
	"\n- or defaults to current data, and iterates if array");

	assert.equal(jsv.templates("a{{tagWithTemplateWhichIteratesFirstArg people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and no param and render method calling tagCtx.render(val) iterates against argument if array");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateNoIteration/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"If current data is an array, a tag with a template and a render method calling" +
	"\ntagCtx.render(val, true) and no param renders against array without iteration");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateWhichIteratesFirstArgNoDefaultArg/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aNot defined ",
	"Tag with a template and no param and render method calling tagCtx.render(val) but with tag.argDefault=false renders against first arg" +
	"\n- and does not default to current data if arg is undefined");

	assert.equal(jsv.templates("a{{include people}}{{tagWithTemplateNoIterationWithHelpers/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 foovalue",
	"If current data is an array, a tag with a template and a render method calling" +
	"\ntagCtx.render(val, helpers, true) and no param renders against array without iteration");

	assert.equal(jsv.templates("a{{include person}}{{tagJustRender/}}{{/include}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a render and no param renders once against current data, if object");

	assert.equal(jsv.templates("a{{include people}}{{tagJustRenderArray/}}{{/include}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a render and no param renders once against current data, even if array - but render method can choose to iterate");

	assert.equal(jsv.templates("a{{tagJustTemplate person/}}").render({person: {name: "Jo"}}), "aJo ",
	"Tag with just a template and renders once against first argument data, if object");

	assert.equal(jsv.templates("a{{tagJustTemplate people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "a2 ",
	"Tag with just a template renders once against first argument data even if it is an array" +
	"\n- but can add render method with tagCtx.render(val) to iterate - (next test)");

	assert.equal(jsv.templates("a{{tagWithTemplateWhichIteratesFirstArg people/}}").render({people: [{name: "Jo"}, {name: "Mary"}]}), "aJo Mary ",
	"Tag with a template and render method calling tagCtx.render(val) renders against first param data, and iterates if array");

});

QUnit.test("derived tags", function(assert) {
	// =============================== Arrange ===============================
	var tmpl = jsv.templates("a:{{A 1/}} b:{{B 2/}}"),

		tagA = jsv.views.tags("A",
			function(val) {return "A" + val;},
			tmpl
		);

		jsv.views.tags("B",
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
	assert.equal(result, "a:A1 b:B2A2", "One level tag inheritance chain - calling base method");

	// =============================== Arrange ===============================
	tmpl = jsv.templates("a:{{A 1 2 3/}} b:{{B 11 12 13/}} c:{{C 21 22 23/}} d:{{D 31 32 33/}} e:{{E 41 42 43/}}");

		tagA = jsv.views.tags("A",
			function(val) {return "A" + val;},
			tmpl
		);

		jsv.views.tags("B",
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

		var tagC = jsv.views.tags("C",
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

		jsv.views.tags("D",
			{
				baseTag: tagC,
				render: function(val) {
					return "D" + val + this.base(val);
				}
			},
			tmpl
		);

		jsv.views.tags("E",
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
	assert.equal(result, "a:A1 b:B11A11 c:C21A21FOO-C:21BAR-C212223 d:D31C31A31FOO-C:31BAR-C313233 e:E41D41C41A41FOO-E41FOO-C:41BAR-E414243BAR-C414243", "Complex multi-level inheritance chain");

	// =============================== Arrange ===============================
	jsv.views.settings.debugMode(true);
	tmpl = jsv.templates("a:{{A 1 2 3/}}");

		tagA = jsv.views.tags("A",
			function(val) {
				return "A" + val + this.baseApply(arguments);
			},
			tmpl
		);
	jsv.views.settings.debugMode(false);

	// ................................ Act ..................................
	result = tmpl.render({});

	// ............................... Assert .................................
	assert.equal(result.slice(0, 10), "a:{Error: ", "Calling base or baseApply when there is no base tag: Type Error");

	// =============================== Arrange ===============================
	tmpl = jsv.templates("a:{{A 1 2 3/}} b:{{B 11 12 13/}} c:{{C 21 22 23/}}");

		tagA = jsv.views.tags("A",
			function(val) {
				return "A" + val;
			},
			tmpl
		);

		jsv.views.tags("B",
			{
				baseTag: tagA,
				render: function(val) {
					return "B" + val + this.base(val);
				}
			},
			tmpl
		);

		tagC = jsv.views.tags("C",
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
	assert.equal(result, "a:A1 b:B11A11 c:C21BAR-C212223 Missing base method call: .",
	'Calling base or baseApply when there is no corresponding method on base tag implementation: noop - returning ""');

});

QUnit.test('{{include}} and wrapping content', function(assert) {
	var result = jsv.templates({
			markup:
					'Before {{include tmpl="wrapper"}}'
					+ '{{:name}}'
				+ '{{/include}} After',
			templates: {
				wrapper: "header{{include tmpl=#content/}}footer"
			}
		}).render(people);

	assert.equal(result, "Before headerJofooter AfterBefore headerBillfooter After", 'Using {{include ... tmpl="wrapper"}}wrapped{{/include}}');

	result = jsv.templates({
		markup:
			 'This (render method) replaces: {{mytag override="replacementText" tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/mytag}} | '
			+ 'This (original template) adds: {{mytag}}'
				+ '{{:name}}'
			+ '{{/mytag}} | '
			+ 'This (new template) wraps: {{mytag setTmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/mytag}} | ',
		tags: {
			mytag: {
				template: "add{{include tmpl=#content/}}",
				init: function() {
					this.template = this.tagCtx.props.setTmpl || this.template;
				},
				render: function() {
					return this.tagCtx.props.override;
				}
			}
		},
		templates: {
			wrapper: "header{{include tmpl=#content/}}footer"
		}
	}).render(people);

	assert.equal(result,
		"This (render method) replaces: replacementText |"
		+ " This (original template) adds: addJo |"
		+ " This (new template) wraps: headerJofooter |"
		+ " This (render method) replaces: replacementText |"
		+ " This (original template) adds: addBill |"
		+ " This (new template) wraps: headerBillfooter | ",
		'Custom tag with wrapped content: {{mytag ... tmpl="wrapper"}}wrapped{{/myTmpl}}');

	result = jsv.templates({
		markup:
				'Before {{include tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/include}} After',
		templates: {
			wrapper: "header{{for people tmpl=#content/}}footer"
		}
	}).render({people: people});

	assert.equal(result, "Before headerJoBillfooter After", 'Using {{for ... tmpl="wrapper"}}wrapped{{/for}}');

	result = jsv.templates({
		markup:
				'This replaces:{{mytag override="replacementText"}}'
				+ '{{:name}}'
			+ '{{/mytag}}'
			+ 'This wraps:{{mytag tmpl="wrapper"}}'
				+ '{{:name}}'
			+ '{{/mytag}}',
		tags: {
			mytag: function() {
				return this.tagCtx.props.override;
			}
		},
		templates: {
			wrapper: "header{{for people tmpl=#content/}}footer"
		}
	}).render({people: people});

	assert.equal(result, "This replaces:replacementTextThis wraps:headerJoBillfooter", 'Using {{mytag ... tmpl="wrapper"}}wrapped{{/myTmpl}}');

	result = jsv.templates({
		markup:
		'{{mytag}}'
			+ '{{:name}}'
		+ '{{/mytag}} | '
		+ '{{mytag tmpl="innerwrap"}}'
			+ '{{:name}}'
		+ '{{/mytag}} | '
		+ '{{mytag tmpl="middlewrap"}}'
			+ '{{:name}}'
		+ '{{/mytag}} | '
		+ '{{mytag tmpl="wrapper"}}'
			+ '{{:name}}'
		+ '{{/mytag}} | '

		+ '{{mytag2}}'
			+ '{{:name}}'
		+ '{{/mytag2}} | '
		+ '{{mytag2 tmpl="innerwrap"}}'
			+ '{{:name}}'
		+ '{{/mytag2}} | '
		+ '{{mytag2 tmpl="middlewrap"}}'
			+ '{{:name}}'
		+ '{{/mytag2}} | '
		+ '{{mytag2 tmpl="wrapper"}}'
			+ '{{:name}}'
		+ '{{/mytag2}} | ',
		templates: {
			wrapper: "middle {{include tmpl=#content/}} {{include tmpl='middlewrap'/}} {{include tmpl='innerwrap'/}}/middle",
			middlewrap: "inner {{include tmpl=#content/}} and {{include tmpl='innerwrap'/}} /inner",
			innerwrap: "innermost {{include tmpl=#content/}} /innermost"
		},
		tags: {
			mytag: {
			template: "outer {{include tmpl=#content/}} /outer"
			},
			mytag2: {
			}
		}
	}).render(people);

	assert.equal(result,
		"outer Jo /outer |"
		+ " outer innermost Jo /innermost /outer |"
		+ " outer inner Jo and innermost Jo /innermost /inner /outer |"
		+ " outer middle Jo inner Jo and innermost Jo /innermost /inner innermost Jo /innermost/middle /outer |"

		+ " Jo |"
		+ " innermost Jo /innermost |"
		+ " inner Jo and innermost Jo /innermost /inner |"
		+ " middle Jo inner Jo and innermost Jo /innermost /inner innermost Jo /innermost/middle |"

		+ " outer Bill /outer |"
		+ " outer innermost Bill /innermost /outer |"
		+ " outer inner Bill and innermost Bill /innermost /inner /outer |"
		+ " outer middle Bill inner Bill and innermost Bill /innermost /inner innermost Bill /innermost/middle /outer |"

		+ " Bill |"
		+ " innermost Bill /innermost |"
		+ " inner Bill and innermost Bill /innermost /inner |"
		+ " middle Bill inner Bill and innermost Bill /innermost /inner innermost Bill /innermost/middle | ",
		'Cascading multi-level wrappers around #content'
	);

	var data = [{
	phones: [
		{number: "Ph0", alt: "Alt0"},
		{number: "Ph1", alt: "Alt1"},
		{number: "Ph2", alt: "Alt2"}
	]
	}];

	result = jsv.templates({
		markup:
		  '{{mytag tmpl="phonelist"}}'
			+ '{{:number}} '
		+ '{{/mytag}} | '
		+ '{{mytag2 tmpl="phonelist"}}'
		  + '{{:number}} '
		+ '{{/mytag2}}',
		templates: {
			phonelist: "{{for phones}}{{include tmpl=#content/}}{{/for}}"
		},
		tags: {
			mytag: {
				template: "outer {{include tmpl=#content/}} /outer"
			},
			mytag2: {
			}
		}
	}).render(data);

	assert.equal(result,
		"outer Ph0 Ph1 Ph2  /outer | Ph0 Ph1 Ph2 ",
		'Cascading multi-level wrapper around #content with {{for}}'
	);

	result = jsv.templates({
		markup:
		  '{{mytag tmpl="phonelist"}}'
			+ '{{:number}}'
		+ '{{else tmpl="altlist"}}'
		  + '{{:alt}}'
		+ '{{else tmpl="altlist2"}}'
		  + '{{:alt}}'
		+ '{{/mytag}}'
		+ '{{mytag2 tmpl="phonelist"}}'
		  + '{{:number}}'
		+ '{{else tmpl="altlist"}}'
		  + '{{:alt}}'
		+ '{{else tmpl="altlist2"}}'
		  + '{{:alt}}'
		+ '{{/mytag2}}',
		templates: {
			phonelist: "A< {{for phones}}{{include tmpl=#content/}} {{/for}} > ",
			altlist: "B< {{for phones tmpl='titlewrap'/}} > ",
			altlist2: "C< {{for phones}}{{include tmpl='titlewrap'/}}{{/for}} > ",
			titlewrap: "alternate: {{include tmpl=#content/}} "
		},
		tags: {
			mytag: {
				template: "outer {{include tmpl=#content/}} /outer | "
			},
			mytag2: {
			}
		}
	}).render(data);

	assert.equal(result,
		  "outer A< Ph0 Ph1 Ph2  >  /outer |"
		+ " outer B< alternate: Alt0 alternate: Alt1 alternate: Alt2  >  /outer |"
		+ " outer C< alternate: Alt0 alternate: Alt1 alternate: Alt2  >  /outer |"
		+ " A< Ph0 Ph1 Ph2  >"
		+ " B< alternate: Alt0 alternate: Alt1 alternate: Alt2  >"
		+ " C< alternate: Alt0 alternate: Alt1 alternate: Alt2  > ",
		'Cascading multi-level wrapper around #content with {{for}}{{else}}'
	);
});

QUnit.test("helpers", function(assert) {
	jsv.views.helpers({
		not: function(value) {
			return !value;
		},
		concat: function() {
			return "".concat.apply("", arguments) + "top";
		}
	});
	assert.equal(jsv.templates("{{:~concat(a, 'b', ~not(false))}}").render({a: "aVal"}), "aValbtruetop", "~concat('a')");

	function toUpperCase(value) {
		return value.toUpperCase();
	}
	var toUpperCaseFn = jsv.views.helpers("toUpperCase", toUpperCase);
	assert.equal(jsv.templates("{{:~toUpperCase(name)}} {{:~toUpperCase('Foo')}}").render(person), "JO FOO", 'jsv.views.helpers("toUpperCase", toUpperCaseFn);... {{:~toUpperCase(name)}}');

	jsv.views.helpers({toUpperCase2: toUpperCase});
	assert.equal(toUpperCaseFn === toUpperCase && jsv.views.helpers.toUpperCase === toUpperCase && jsv.views.helpers.toUpperCase2 === toUpperCase, true, 'sortFunction === jsv.views.helpers.toUpperCase === jsv.views.helpers("toUpperCase")');

	jsv.views.helpers("toUpperCase2", null);
	assert.equal(jsv.views.helpers.toUpperCase2, undefined, 'jsv.views.helpers("toUpperCase2", null) to remove registered helper');
});

QUnit.test("settings", function(assert) {
	// ................................ Act ..................................
	// Delimiters

	jsv.views.settings.delimiters("@%","%@");
	var result = jsv.templates("A_@%if true%@yes@%/if%@_B").render()
		+ "|" + jsv.views.settings.delimiters() + "|" + jsv.views.sub.settings.delimiters;

	jsv.views.settings.delimiters("<<",">>", "*");

	result += "|" + jsv.views.settings.delimiters() + "|" + jsv.views.sub.settings.delimiters;

	jsv.views.settings.delimiters("{{","}}", "^");
	result += "|" + jsv.templates("A_{{if true}}YES{{/if}}_B").render()
		+ "|" + jsv.views.settings.delimiters() + "|" + jsv.views.sub.settings.delimiters;

	// ............................... Assert .................................
	assert.equal(result, "A_yes_B|@%,%@,^|@%,%@,^|<<,>>,*|<<,>>,*|A_YES_B|{{,}},^|{{,}},^", "Custom delimiters with render()");

	// =============================== Arrange ===============================
	// Debug mode false

	var oldDebugMode = jsv.views.settings.debugMode();
	var app = {choose: true, name: "Jo"};
	result = "";

	// ................................ Act ..................................
	jsv.views.settings.debugMode(false);

	try {
		result = jsv.templates('{{:missing.willThrow}}').render(app);
	} catch(e) {
		result += !!e.message;
	}

	// ............................... Assert .................................
	assert.equal(jsv.views.settings.debugMode() + " " + result, 'false true',
		'Debug mode false: {{:missing.willThrow}} throws error');

	// ................................ Act ..................................
	// Debug mode true

	jsv.views.settings.debugMode(true);

	try {
		result = jsv.templates('{{:missing.willThrow}}').render(app);
	} catch(e) {
		result += !!e.message;
	}

	// ............................... Assert .................................
	assert.equal(jsv.views.settings.debugMode() + " " + result.slice(0, 8), 'true {Error: ',
		'Debug mode true: {{:missing.willThrow}} renders error');

	// ................................ Act ..................................
	// Debug mode 'onError' handler function with return value

	jsv.views.settings.debugMode(function(e, fallback, view) {
		var data = this;
		return "Override error - " + (fallback||"") + "_" + (view ? data.name + " " + (e.message.indexOf("undefined")>-1): e); // For syntax errors e is a string, and view is undefined
	});

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{:missing.willThrow}}').render(app);

	// ............................... Assert .................................
	assert.equal(result, "function Override error - _Jo true",
		"Debug mode 'onError' handler override, with {{:missing.willThrow}}");

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{:missing.willThrow onError="myFallback"}}').render(app);

	// ............................... Assert .................................
	assert.equal(result, "function Override error - myFallback_Jo true",
		'Debug mode \'onError\' handler override, with onError fallback: {{:missing.willThrow onError="myFallback"}}');

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{if missing.willThrow onError="myFallback"}}yes{{/if}}').render(app);

	// ............................... Assert .................................
	assert.equal(result, 'function Override error - myFallback_Jo true',
		'Debug mode \'onError\' handler override, with onError fallback: {{if missing.willThrow onError="myFallback"}}');

	// ................................ Act ..................................
	// Debug mode 'onError' handler function without return value
	var ret = "";
	jsv.views.settings.debugMode(function(e, fallback, view) {
		var data = this;
		ret = "Override error - " + (fallback||"") + "_" + data.name + " " + (e.message.indexOf("undefined")>-1); // For syntax errors e is a string, and view is undefined
	});

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{:missing.willThrow}}').render(app);

	// ............................... Assert .................................
	assert.equal(ret + "|" + result.slice(0, 17), "Override error - _Jo true|function {Error: ",
		"Debug mode 'onError' handler (no return) with {{:missing.willThrow}}");

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{:missing.willThrow onError="myFallback"}}').render(app);

	// ............................... Assert .................................
	assert.equal(ret + "|" + result, "Override error - myFallback_Jo true|function myFallback",
		'Debug mode \'onError\' handler (no return) with onError fallback: {{:missing.willThrow onError="myFallback"}}');

	// ................................ Act ..................................
	result = typeof jsv.views.settings.debugMode() + " ";
	result += jsv.templates('{{if missing.willThrow onError="myFallback"}}yes{{/if}}').render(app);

	// ............................... Assert .................................
	assert.equal(ret + "|" + result, "Override error - myFallback_Jo true|function myFallback",
		'Debug mode \'onError\' handler (no return) with onError fallback: {{if missing.willThrow onError="myFallback"}}');

	// ................................ Reset ..................................
	jsv.views.settings.debugMode(oldDebugMode);
});

QUnit.test("template encapsulation", function(assert) {
		// =============================== Arrange ===============================
jsv.templates({
		myTmpl6: {
			markup: "{{sort reverse=true people}}{{:name}}{{/sort}}",
			tags: {
				sort: sort
			}
		}
	});

	// ............................... Assert .................................
	assert.equal(jsv.render.myTmpl6({people: people}), "BillJo", 'jsv.templates("myTmpl", tmplObjWithNestedItems);');

	// =============================== Arrange ===============================
	jsv.views.helpers("h1", "globalHelper");

	var tmpl = jsv.templates({
		markup: "{{if true}}{{:~h1}} {{:~h2}} {{:~h3}}{{/if}}",
		helpers: {
			h2: "templateHelper"
		}
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}, {h3:"optionHelper"}), "globalHelper templateHelper optionHelper", 'Passing in helpers - global, template or option');

	// =============================== Arrange ===============================
	tmpl = jsv.templates({
		markup: "{{if true}}{{:~h1}}{{/if}}",
		helpers: {
			h1: "templateHelper"
		}
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}), "templateHelper", 'template helper overrides global helper');

	// =============================== Arrange ===============================
	tmpl = jsv.templates({
		markup: "{{if true}}{{:~h1}}{{/if}}"
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}, {h1: "optionHelper"}), "optionHelper", 'option helper overrides global helper');

	// =============================== Arrange ===============================
	tmpl = jsv.templates({
		markup: "{{if true}}{{:~h2}}{{/if}}",
		helpers: {
			h2: "templateHelper"
		}
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}, {h2: "optionHelper"}), "templateHelper", 'template helper overrides option helper');

	// =============================== Arrange ===============================
	jsv.views.converters("c1", function(val) {return val + "globalCvt";});

	tmpl = jsv.templates({
		markup: "{{if true}}{{c1:1}}{{c2:2}}{{/if}}",
		converters: {
			c2: function(val) {return val + "templateCvt";}
		}
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}), "1globalCvt2templateCvt", 'template converter and global converter');

	// =============================== Arrange ===============================
	tmpl = jsv.templates({
		markup: "{{if true}}{{c1:1}}{{/if}}",
		converters: {
			c1: function(val) {return val + "templateCvt";}
		}
	});

	// ............................... Assert .................................
	assert.equal(tmpl.render({}), "1templateCvt", 'template converter overrides global converter');

	// =============================== Arrange ===============================

	jsv.templates({
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
	assert.equal(jsv.templates.nesting.render({}, {b: "optionHelper"}), " templateHelper templateCvt innerTemplateHelper innerTemplateCvt innerInnerCascade innerCascade",
		'Inner template, helper, and converter override outer template, helper, and converter');
});

QUnit.module("Custom tags");

QUnit.test("contentCtx", function(assert) {

var tmpl = jsv.templates("{{for 'parent'}}{{mytag 'arg1' 'arg2' 'arg3'}}  {{:#data}}A{{else 'elseArg1'}}  {{:#data}}B{{else}}  {{:#data}}C{{/mytag}}{{/for}}");

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  arg1A  elseArg1B  parentC", 'No contentCtx - context is 1st arg or parentView.data');

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return 0;
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  0A  0B  0C", 'contentCtx returns 0 - context is 0 (even for falsy values like 0');

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return val;
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  arg1A  elseArg1B  parentC", 'contentCtx returns first arg/parentView - context is 1st arg or parentView.data');

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return this.tagCtx.view;
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  parentA  parentB  parentC", 'contentCtx returns this.tagCtx.view - context is parentView.data');

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return this.tagCtx.view.data;
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  parentA  parentB  parentC", 'contentCtx returns this.tagCtx.view.data - context is parentView.data');

	// =============================== Arrange ===============================

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return this.tagCtxs[0].args[this.tagCtx.index];
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  arg1A  arg2B  arg3C", 'contentCtx returns arg from first tagCtx indexed on else - context is arg1/arg2/arg3');

	// =============================== Arrange ===============================

	tmpl = jsv.templates("{{for 'outerparent'}}{{for 'parent'}}{{mytag 'arg1' 'arg2' 'arg3'}}  {{:#data}}A{{else 'elseArg1'}}  {{:#data}}B{{else}}  {{:#data}}C{{/mytag}}{{/for}}{{/for}}");

jsv.views.tags({mytag: {
	contentCtx: function(val) {
		return this.tagCtx.view.parent;
	}
}}, tmpl);

	// ............................... Assert .................................
	assert.equal(tmpl.render("outer"), "  outerparentA  outerparentB  outerparentC", 'contentCtx returns this.tagCtx.view.parent');

});

})();
