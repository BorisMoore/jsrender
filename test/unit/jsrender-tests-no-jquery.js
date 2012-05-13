/// <reference path="../../jsrender.js" />
function compileTmpl( template ) {
	try {
		return typeof jsviews.templates( template ).fn === "function" ? "compiled" : "failed compile";
	}
	catch(e) {
		return "error:" + e;
	}
}

function sort( array ) {
	var ret = "";
	if ( this.props.reverse ) {
		// Render in reverse order
		if (arguments.length > 1) {
			for ( i = arguments.length; i; i-- ) {
				ret += sort.call( this, arguments[ i - 1 ]);
			}
		} else for ( var i = array.length; i; i-- ) {
			ret += this.tmpl.render( array[ i - 1 ] );
		}
	} else {
		// Render in original order
		ret += this.tmpl.render( array );
	}
	return ret;
}

var person = { name: "Jo" },
	people = [{ name: "Jo" },{ name: "Bill" }],
	towns = [{ name: "Seattle" },{ name: "Paris" },{ name: "Delhi" }];

var tmplString = "A_{{:name}}_B";
jsviews.tags({ sort: sort });

module( "tagParser" );
test("{{if}} {{else}}", function() {
	expect(3);
	equal( compileTmpl( "A_{{if true}}{{/if}}_B" ), "compiled", "Empty if block: {{if}}{{/if}}" );
	equal( compileTmpl( "A_{{if true}}yes{{/if}}_B" ), "compiled", "{{if}}...{{/if}}" );
	equal( compileTmpl( "A_{{if true/}}yes{{/if}}_B" ), "error:Expected block tag", "Mismatching block tags: {{if/}} {{/if}}" );
});

module( "{{if}}" );
test("{{if}}", function() {
	expect(4);
	equal( jsviews.templates( "A_{{if true}}yes{{/if}}_B" ).render(), "A_yes_B", "{{if a}}: a" );
	equal( jsviews.templates( "A_{{if false}}yes{{/if}}_B" ).render(), "A__B", "{{if a}}: !a" );
	equal( jsviews.templates( "A_{{if true}}{{/if}}_B" ).render(), "A__B", "{{if a}}: empty: a" );
	equal( jsviews.templates( "A_{{if false}}{{/if}}_B" ).render(), "A__B", "{{if a}}: empty: !a" );
});

test("{{if}} {{else}}", function() {
	expect(5);
	equal( jsviews.templates( "A_{{if true}}yes{{else}}no{{/if}}_B" ).render(), "A_yes_B", "{{if a}} {{else}}: a" );
	equal( jsviews.templates( "A_{{if false}}yes{{else}}no{{/if}}_B" ).render(), "A_no_B", "{{if a}} {{else}}: !a" );
	equal( jsviews.templates( "A_{{if true}}yes{{else true}}or{{else}}no{{/if}}_B" ).render(), "A_yes_B", "{{if a}} {{else b}} {{else}}: a" );
	equal( jsviews.templates( "A_{{if false}}yes{{else true}}or{{else}}no{{/if}}_B" ).render(), "A_or_B", "{{if a}} {{else b}} {{else}}: b" );
	equal( jsviews.templates( "A_{{if false}}yes{{else false}}or{{else}}no{{/if}}_B" ).render(), "A_no_B", "{{if a}} {{else b}} {{else}}: !a!b" );
});

test("{{if}} {{else}} external templates", function() {
	expect(2);
	equal( jsviews.templates( "A_{{if true tmpl='yes<br/>'/}}_B" ).render(), "A_yes<br/>_B", "{{if a tmpl=foo/}}: a" );
	equal( jsviews.templates( "A_{{if false tmpl='yes<br/>'}}{{else false tmpl='or<br/>'}}{{else tmpl='no<br/>'}}{{/if}}_B" ).render(), "A_no<br/>_B", "{{if a tmpl=foo}}{{else b tmpl=bar}}{{else tmpl=baz}}: !a!b" );
});

module( "{{:}}" );
test("convert", function() {
	expect(4);
	equal( jsviews.templates( "{{>#data}}" ).render( "<br/>'\"&" ), "&lt;br/&gt;&#39;&#34;&amp;", "default html converter" );
	equal( jsviews.templates( "{{html:#data}}" ).render( "<br/>'\"&" ), "&lt;br/&gt;&#39;&#34;&amp;", "html converter" );
	equal( jsviews.templates( "{{:#data}}" ).render( "<br/>'\"&" ), "<br/>'\"&", "no convert" );

	function loc( data ) {
		switch (data) { case "desktop": return "bureau"; };
	}
	jsviews.converters("loc", loc);
	equal(jsviews.templates( "{{loc:#data}}:{{loc:'desktop'}}" ).render( "desktop" ), "bureau:bureau", 'jsviews.converters("loc", locFunction);... {{loc:#data}}' );
});

test("paths", function() {
	expect(16);
	equal( jsviews.templates( "{{:a}}" ).render({ a: "aVal" }), "aVal", "a" );
	equal( jsviews.templates( "{{:a.b}}" ).render({ a: { b: "bVal" }}), "bVal", "a.b" );
	equal( jsviews.templates( "{{:a.b.c}}" ).render({ a: { b: { c: "cVal" }}}), "cVal", "a.b.c" );
	equal( jsviews.templates( "{{:a.name}}" ).render({ a: { name: "aName" }} ), "aName", "a.name" );
	equal( jsviews.templates( "{{:a['name']}}" ).render({ a: { name: "aName"} } ), "aName", "a['name']");
	equal( jsviews.templates( "{{:a['x - _*!']}}" ).render({ a: { "x - _*!": "aName"} } ), "aName", "a['x - _*!']");
	equal( jsviews.templates( '{{:a["x - _*!"]}}').render({ a: { "x - _*!": "aName"} }), "aName", 'a["x - _*!"]');
	equal( jsviews.templates( "{{:a.b[1].d}}" ).render({ a: { b: [0, { d: "dVal"}]} }), "dVal", "a.b[1].d");
	equal( jsviews.templates( "{{:a.b[1].d}}" ).render({ a: { b: {1:{ d: "dVal" }}}}), "dVal", "a.b[1].d" );
	equal( jsviews.templates( "{{:a.b[~incr(1-1)].d}}" ).render({ a: { b: {1:{ d: "dVal" }}}}, { incr:function(val) { return val + 1; }}), "dVal", "a.b[~incr(1-1)].d" );
	equal( jsviews.templates( "{{:a.b.c.d}}" ).render({ a: { b: {'c':{ d: "dVal" }}}}), "dVal", "a.b.c.d" );
	equal( jsviews.templates( "{{:a[0]}}" ).render({ a: [ "bVal" ]}), "bVal", "a[0]" );
	equal( jsviews.templates( "{{:a.b[1][0].msg}}" ).render({ a: { b: [22,[{ msg: " yes - that's right. "}]] }}), " yes - that's right. ", "a.b[1][0].msg" );
	equal( jsviews.templates( "{{:#data.a}}" ).render({ a: "aVal" }), "aVal", "#data.a" );
	equal( jsviews.templates( "{{:#view.data.a}}" ).render({ a: "aVal" }), "aVal", "#view.data.a" );
	equal( jsviews.templates( "{{:#index === 0}}" ).render([{ a: "aVal" }]), "true", "#index" );
});

test("types", function() {
	expect(10);
	equal( jsviews.templates( "{{:'abc'}}" ).render(), "abc", "'abc'" );
	equal( jsviews.templates( "{{:true}}" ).render(), "true", "true" );
	equal( jsviews.templates( "{{:false}}" ).render(), "false", "false" );
	equal( jsviews.templates( "{{:null}}" ).render(), "", 'null -> ""' );
	equal( jsviews.templates( "{{:199}}" ).render(), "199", "199" );
	equal( jsviews.templates( "{{: 199.9 }}" ).render(), "199.9", "| 199.9 |" );
	equal( jsviews.templates( "{{:-33.33}}" ).render(), "-33.33", "-33.33" );
	equal( jsviews.templates( "{{: -33.33 }}" ).render(), "-33.33", "| -33.33 |" );
	equal( jsviews.templates( "{{:-33.33 - 2.2}}" ).render(), "-35.53", "-33.33 - 2.2" );
	equal( jsviews.templates( "{{:notdefined}}" ).render({}), "", "notdefined" );
});

test("comparisons", function() {
	expect(22);
	equal( jsviews.templates( "{{:1<2}}" ).render(), "true", "1<2" );
	equal( jsviews.templates( "{{:2<1}}" ).render(), "false", "2<1" );
	equal( jsviews.templates( "{{:5===5}}" ).render(), "true", "5===5" );
	equal( jsviews.templates( "{{:0==''}}" ).render(), "true", "0==''" );
	equal( jsviews.templates( "{{:'ab'=='ab'}}" ).render(), "true", "'ab'=='ab'" );
	equal( jsviews.templates( "{{:2>1}}" ).render(), "true", "2>1" );
	equal( jsviews.templates( "{{:2 == 2}}" ).render(), "true", "2 == 2" );
	equal( jsviews.templates( "{{:2<=2}}" ).render(), "true", "2<=2" );
	equal( jsviews.templates( "{{:'ab'<'ac'}}" ).render(), "true", "'ab'<'ac'" );
	equal( jsviews.templates( "{{:3>=3}}" ).render(), "true", "3 =3" );
	equal( jsviews.templates( "{{:3>=2}}" ).render(), "true", "3>=2" );
	equal( jsviews.templates( "{{:3>=4}}" ).render(), "false", "3>=4" );
	equal( jsviews.templates( "{{:3 !== 2}}" ).render(), "true", "3 !== 2" );
	equal( jsviews.templates( "{{:3 != 2}}" ).render(), "true", "3 != 2" );
	equal( jsviews.templates( "{{:0 !== null}}" ).render(), "true", "0 !== null" );
	equal( jsviews.templates( "{{:(3 >= 4)}}" ).render(), "false", "3>=4" );
	equal( jsviews.templates( "{{:3 >= 4}}" ).render(), "false", "3>=4" );
	equal( jsviews.templates( "{{:(3>=4)}}" ).render(), "false", "3>=4" );
	equal( jsviews.templates( "{{:(3 < 4)}}" ).render(), "true", "3>=4" );
	equal( jsviews.templates( "{{:3 < 4}}" ).render(), "true", "3>=4" );
	equal( jsviews.templates( "{{:(3<4)}}" ).render(), "true", "3>=4" );
	equal( jsviews.templates( "{{:0 != null}}" ).render(), "true", "0 != null" );
});

test("array access", function() {
	equal( jsviews.templates( "{{:a[1]}}" ).render({ a: ["a0","a1"] }), "a1", "a[1]" );
	equal( jsviews.templates( "{{:a[1+1]+5}}" ).render({ a: [11,22,33] }), "38", "a[1+1]+5)" );
	equal( jsviews.templates( "{{:a[~incr(1)]+5}}" ).render({ a: [11,22,33] }, { incr:function(val) { return val + 1; }}), "38", "a[~incr(1)]+5" );
	equal( jsviews.templates( "{{:true && (a[0] || 'default')}}" ).render({ a: [0,22,33] }, { incr:function(val) { return val + 1; }}), "default", "true && (a[0] || 'default')" );
});

test("context", function() {
	expect(4);
	equal( jsviews.templates( "{{:~val}}" ).render( 1, { val: "myvalue" }), "myvalue", "~val" );
	function format(value, upper) {
		return value[upper ?  "toUpperCase" : "toLowerCase"]();
	}
	equal( jsviews.templates( "{{:~format(name) + ~format(name, true)}}" ).render( person, { format: format }), "joJO", "render( data, { format: formatFn }); ... {{:~format(name, true)}}" );
	equal( jsviews.templates( "{{for people[0]}}{{:~format(~type) + ~format(name, true)}}{{/for}}" ).render({ people: people}, { format: format, type: "PascalCase" }), "pascalcaseJO", "render( data, { format: formatFn }); ... {{:~format(name, true)}}" );
	equal( jsviews.templates( "{{for people ~twn=town}}{{:name}} lives in {{:~format(~twn, true)}}. {{/for}}" ).render({ people: people, town:"Redmond" }, { format: format }), "Jo lives in REDMOND. Bill lives in REDMOND. ", "Passing in context to nested templates: {{for people ~twn=town}}" );
});

test("values", function() {
	expect(4);
	equal( jsviews.templates( "{{:a}}" ).render({ a: 0 }), "0", "0" );
	equal( jsviews.templates( "{{:b}}" ).render({ a: 0 }), "", "undefined" );
	equal( jsviews.templates( "{{:a}}" ).render({ a: "" }), "", "" );
	equal( jsviews.templates( "{{:b}}" ).render({ a: null }), "", null );
});

test("expressions", function() {
	expect(7);
	equal( compileTmpl( "{{:a++}}" ), "error:Syntax error", "a++" );
	equal( compileTmpl( "{{:(a,b)}}" ), "error:Syntax error", "(a,b)" );
	equal( jsviews.templates( "{{: a+2}}" ).render({ a: 2, b: false }), "4", "a+2");
	equal( jsviews.templates( "{{: b?'yes':'no' }}" ).render({ a: 2, b: false }), "no", "b?'yes':'no'");
	equal( jsviews.templates( "{{:(a||-1) + (b||-1) }}" ).render({ a: 2, b: 0 }), "1", "a||-1");
	equal( jsviews.templates( "{{:3*b()*!a*4/3}}" ).render({ a: false, b: function () { return 3; }}), "12", "3*b()*!a*4/3");
	equal( jsviews.templates( "{{:a%b}}" ).render({ a: 30, b: 16}), "14", "a%b");
});

module( "{{for}}" );
test("{{for}}", function() {
	expect(15);
	jsviews.templates( {
		forTmpl: "header_{{for people}}{{:name}}{{/for}}_footer",
		templateForArray: "header_{{for #data}}{{:name}}{{/for}}_footer",
		pageTmpl: '{{for [people] tmpl="templateForArray"/}}',
		simpleFor: "a{{for people}}Content{{:#data}}|{{/for}}b",
		forPrimitiveDataTypes: "a{{for people}}|{{:#data}}{{/for}}b"
	});

	equal( jsviews.render.forTmpl({ people: people }), "header_JoBill_footer", '{{for people}}...{{/for}}' );
	equal( jsviews.render.templateForArray( [people] ), "header_JoBill_footer", 'Can render a template against an array, as a "layout template", by wrapping array in an array' );
	equal( jsviews.render.pageTmpl({ people: people }), "header_JoBill_footer", '{{for [people] tmpl="templateForArray"/}}' );
	equal( jsviews.templates( "{{for people towns}}{{:name}}{{/for}}" ).render({ people: people, towns: towns }), "JoBillSeattleParisDelhi", "concatenated targets: {{for people towns}}" );
	equal( jsviews.templates( "{{for}}xxx{{:#data===~undefined}}{{/for}}" ).render(), "xxxtrue", "no parameter - renders once with #data undefined: {{for}}" );
	equal( jsviews.templates( "{{for missingProperty}}xxx{{:#data===~undefined}}{{/for}}" ).render({}), "xxxtrue", "missingProperty - renders once with #data undefined: {{for missingProperty}}" );
	equal( jsviews.templates( "{{for null}}xxx{{:#data===null}}{{/for}}" ).render(), "xxxtrue", "null - renders once with #data null: {{for null}}" );
	equal( jsviews.templates( "{{for false}}xxx{{:#data}}{{/for}}" ).render(), "xxxfalse", "false - renders once with #data false: {{for false}}" );
	equal( jsviews.templates( "{{for 0}}xxx{{:#data}}{{/for}}" ).render(), "xxx0", "0 - renders once with #data false: {{for 0}}" );
	equal( jsviews.templates( "{{for ''}}xxx{{:#data===''}}{{/for}}" ).render(), "xxxtrue", "'' - renders once with #data false: {{for ''}}" );

	equal( jsviews.render.simpleFor({people:[]}), "ab", 'Empty array renders empty string' );
	equal( jsviews.render.simpleFor({people:["",false,null,undefined,1]}), "aContent|Contentfalse|Content|Content|Content1|b", 'Empty string, false, null or undefined members of array are also rendered' );
	equal( jsviews.render.simpleFor({people:null}), "aContent|b", 'null is rendered once with #data null' );
	equal( jsviews.render.simpleFor({}), "aContent|b", 'if #data is undefined, renders once with #data undefined' );
	equal( jsviews.render.forPrimitiveDataTypes({people:[0,1,"abc","",,null,true,false]}), "a|0|1|abc||||true|falseb", 'Primitive types render correctly, even if falsey' );
});

module( "api" );
test("templates", function() {
	expect(14);
	var tmpl = jsviews.templates( tmplString );
	equal( tmpl.render( person ), "A_Jo_B", 'Compile from string: var tmpl = jsviews.templates( tmplString );' );

	var fnToString = tmpl.fn.toString();
	equal( jsviews.templates( "", tmplString ).fn.toString() === fnToString && jsviews.templates( null, tmplString ).fn.toString() === fnToString && jsviews.templates( undefined, tmplString ).fn.toString() === fnToString, true, 'if name is "", null, or undefined, then jsviews.templates( name, tmplString ) = jsviews.templates( tmplString );' );

	jsviews.templates( "myTmpl", tmplString );
	equal( jsviews.render.myTmpl( person ), "A_Jo_B", 'Compile and register named template: jsviews.templates( "myTmpl", tmplString );' );

	jsviews.templates({ myTmpl2: tmplString, myTmpl3: "X_{{:name}}_Y" });
	equal( jsviews.render.myTmpl2( person ) + jsviews.render.myTmpl3( person ), "A_Jo_BX_Jo_Y", 'Compile and register named templates: jsviews.templates({ myTmpl: tmplString, myTmpl2: tmplString2 });' );

	jsviews.templates( "!'-#==", "x" );
	jsviews.templates({ '&^~>"2': "y" });
	equal( jsviews.render["!'-#=="]( person ) + jsviews.render['&^~>"2']( person ), "xy", 'Named templates can have arbitrary names;' );

	jsviews.templates({ myTmpl4: "A_B" });
	equal( jsviews.render.myTmpl4( person ), "A_B", 'jsviews.templates({ myTmpl: htmlWithNoTags });' );


	jsviews.templates({
		myTmpl5: {
			markup: tmplString
		}
	});
	equal( jsviews.render.myTmpl5( person ), "A_Jo_B", 'jsviews.templates( "myTmpl", tmplObjWithMarkupString );' );

	equal( jsviews.templates( "", { markup: tmplString }).render( person ), "A_Jo_B", 'Compile from template object without registering: jsviews.templates( "", tmplObjWithMarkupString );' );

	jsviews.templates({
		myTmpl6: {
			markup: tmplString
		}
	});
	equal( jsviews.render.myTmpl6( person ), "A_Jo_B", 'jsviews.templates( "myTmpl", tmplObjWithMarkupString );' );

	jsviews.templates( "myTmpl7", tmpl );
	equal( jsviews.render.myTmpl7( person ), "A_Jo_B", 'Cloning a template: jsviews.templates( "newName", tmpl );' );

	equal( jsviews.templates( "", tmpl ) === tmpl, true, 'jsviews.templates( tmpl ) returns tmpl' );

	equal( jsviews.templates( "" ).render(), "", 'jsviews.templates( "" ) is a template with empty string as content' );

	jsviews.templates( "myEmptyTmpl", "" );
	equal( jsviews.templates.myEmptyTmpl.render(), "", 'jsviews.templates( "myEmptyTmpl", "" ) is a template with empty string as content' );

	jsviews.templates( "myTmpl", null );
	equal( jsviews.templates.myTmpl, undefined, 'Remove a named template:  jsviews.templates( "myTmpl", null );' );
});

test("render", function() {
	expect(18);
	var tmpl1 = jsviews.templates( "myTmpl8", tmplString );
	jsviews.templates( {
		simple: "Content{{:#data}}|",
		templateForArray: "Content{{for #data}}{{:#index}}{{/for}}",
		primitiveDataTypes: "|{{:#data}}"
	});

	equal( tmpl1.render( person ), "A_Jo_B", 'tmpl1.render( data );' );
	equal( jsviews.render.myTmpl8( person ), "A_Jo_B", 'jsviews.render.myTmpl8( data );' );

	jsviews.templates( "myTmpl9", "A_{{for}}inner{{:name}}content{{/for}}_B" );
	equal( jsviews.templates.myTmpl9.tmpls[0].render( person ), "innerJocontent", 'Access nested templates: jsviews.templates["myTmpl9[0]"];' );

	jsviews.templates( "myTmpl10", "top index:{{:#index}}|{{for 1}}nested index:{{:#index}}|{{if #index===0}}nested if index:{{:#index}}|{{else}}nested else index:{{:#index}}|{{/if}}{{/for}}" );
	equal( jsviews.render.myTmpl10(people), "top index:0|nested index:0|nested if index:0|top index:1|nested index:1|nested else index:1|",
										'#index gives the integer index even in nested blocks' );
	jsviews.templates( "myTmpl11", "top index:{{:#index}}|{{for people}}nested index:{{:#index}}|{{if #index===0}}nested if index:{{:#index}}|{{else}}nested else index:{{:#index}}|{{/if}}{{/for}}" );

	equal( jsviews.render.myTmpl11({ people: people }), "top index:|nested index:0|nested if index:0|nested index:1|nested else index:1|",
										'#index gives the integer index even in nested blocks' );

	jsviews.helpers({ myKeyIsCorrect: function() {
		return this.parent.views[this.key] === this;
	}});
	jsviews.templates( "myTmpl12", "top key:{{:~myKeyIsCorrect()}}|{{for people}}nested {{:~myKeyIsCorrect()}}|{{if #index===0}}nested if {{:~myKeyIsCorrect()}}|{{else}}nested else {{:~myKeyIsCorrect()}}|{{/if}}{{/for}}" );

	equal( jsviews.render.myTmpl12({ people: people }), "top key:true|nested true|nested if true|nested true|nested else true|",
										'#key gives the key of this view in the parent views collection/object' );

	equal( jsviews.templates( tmplString ).render( person ), "A_Jo_B", 'Compile from string: var html = jsviews.templates( tmplString ).render( data );' );
	equal( jsviews.render.myTmpl8( people ), "A_Jo_BA_Bill_B", 'jsviews.render.myTmpl( array );' );
	equal( jsviews.render.simple([]), "", 'Empty array renders empty string' );
	equal( jsviews.render.simple(["",false,null,undefined,1]), "Content|Contentfalse|Content|Content|Content1|", 'Empty string, false, null or undefined members of array are also rendered' );
	equal( jsviews.render.simple(null), "Content|", 'null renders once with #data null' );
	equal( jsviews.render.simple(), "Content|", 'Undefined renders once with #data undefined' );
	equal( jsviews.render.simple(false), "Contentfalse|", 'false renders once with #data false' );
	equal( jsviews.render.simple(0), "Content0|", '0 renders once with #data 0' );
	equal( jsviews.render.simple(""), "Content|", '"" renders once with #data ""' );

	equal( jsviews.render.templateForArray([[null,undefined,1]]), "Content012", 'Can render a template against an array, and render once only, by wrapping array in an array' );
	equal( jsviews.render.templateForArray([[]]), "Content", 'Can render a template against an empty array, and render once only, by wrapping array in an array' );
	equal( jsviews.render.primitiveDataTypes([0,1,"abc","",,true,false]), "|0|1|abc|||true|false", 'Primitive types render correctly, even if falsey' );
});

test("converters", function() {
	expect(3);
	function loc( data ) {
		switch (data) { case "desktop": return "bureau"; };
	}
	jsviews.converters({ loc2: loc });
	equal(jsviews.templates( "{{loc2:#data}}:{{loc2:'desktop'}}" ).render( "desktop" ), "bureau:bureau", "jsviews.converters({ loc: locFunction })" );

	var locFn = jsviews.converters("loc", loc);
	equal(locFn === loc && jsviews.converters.loc === loc && jsviews.converters.loc2 === loc, true, 'locFunction === jsviews.converters.loc === jsviews.converters.loc2' );

	jsviews.converters({ loc2: null});
	equal(jsviews.converters("loc2"), undefined, 'jsviews.converters({ loc2: null }) to remove registered converter' );
});

test("tags", function() {
	expect(5);
	equal(jsviews.templates( "{{sort people reverse=true}}{{:name}}{{/sort}}" ).render({ people: people }), "BillJo", "jsviews.tags({ sort: sortFunction })" );

	equal(jsviews.templates( "{{sort people reverse=true towns}}{{:name}}{{/sort}}" ).render({ people: people, towns:towns }), "DelhiParisSeattleBillJo", "Multiple parameters in arbitrary order: {{sort people reverse=true towns}}" );

	equal(jsviews.templates( "{{sort reverse=false people reverse=true towns}}{{:name}}{{/sort}}" ).render({ people: people, towns:towns }), "DelhiParisSeattleBillJo", "Duplicate named parameters - last wins: {{sort reverse=false people reverse=true towns}}" );

	var sortFn = jsviews.tags("sort2", sort);
	equal(sortFn === sort && jsviews.tags.sort === sort && jsviews.tags.sort2 === sort, true, 'sortFunction === jsviews.tags.sort === jsviews.tags.sort2' );

	jsviews.tags("sort2", null);
	equal(jsviews.tags("locsort2"), undefined, 'jsviews.tags( "sort2", null ) to remove registered tag' );
});

test("helpers", function() {
	expect(4);
	jsviews.helpers({
		not: function( value ) {
			return !value;
		},
		concat: function() {
			return "".concat.apply( "", arguments ) + "top";
		}
	})
	equal( jsviews.templates( "{{:~concat(a, 'b', ~not(false))}}" ).render({ a: "aVal" }), "aValbtruetop", "~concat('a')" );

	function toUpperCase(value) {
		return value.toUpperCase();
	}
	var toUpperCaseFn = jsviews.helpers( "toUpperCase", toUpperCase );
	equal( jsviews.templates( "{{:~toUpperCase(name)}} {{:~toUpperCase('Foo')}}" ).render( person ), "JO FOO", 'jsviews.helpers( "toUpperCase", toUpperCaseFn );... {{:~toUpperCase(name)}}' );

	jsviews.helpers({ toUpperCase2: toUpperCase });
	equal( toUpperCaseFn === toUpperCase && jsviews.helpers.toUpperCase === toUpperCase && jsviews.helpers.toUpperCase2 === toUpperCase, true, 'sortFunction === jsviews.helpers.toUpperCase === jsviews.helpers("toUpperCase")' );

	jsviews.helpers("toUpperCase2", null);
	equal(jsviews.helpers("toUpperCase2"), undefined, 'jsviews.helpers( "toUpperCase2", null ) to remove registered helper' );
});

test("template encapsulation", function() {
	expect(5);
	jsviews.helpers({
		not: function( value ) {
			return !value;
		},
		concat: function() {
			return "".concat.apply( "", arguments ) + "inner";
		}
	});

	jsviews.templates({
		encapsulate1: {
			markup: "{{str:~not(true)}} {{sort people reverse=true tmpl='personTmpl'/}} {{str:~not2(false)}}",
			tags: {
				sort2: sort
			},
			templates: {
				personTmpl: "{{upper:name}}"
			},
			helpers: {
				not2: function( value ) {
					return "not2:" + !value;
				}
			},
			converters: {
				str: function( value ) {
					return value.toString() + ":tostring";
				},
				upper: function( value ) {
					return value.toUpperCase();
				}
			}
		}
	});
	equal( $.trim( jsviews.render.encapsulate1({ people: people })), "false:tostring BILLJO not2:true:tostring", 'jsviews.templates( "myTmpl", tmplObjWithNestedItems);' );

	jsviews.templates({
		useLower: "{{lower a/}}",
		tmplWithNestedResources: {
			markup: "{{lower a/}} {{:~concat2(a, 'b', ~not2(false))}} {{for #data tmpl='nestedTmpl1'/}} {{for #data tmpl='nestedTmpl2'/}}",
			helpers: {
				not2: function( value ) {
					return !value;
				},
				concat2: function() {
					return "".concat.apply( "", arguments ) + "%";
				}
			},
			converters: {
				"double": function( value ) {
					return "(double:" +  value + "&" + value + ")";
				}
			},
			tags: {
				lower: function( val ) {
					return val.toLowerCase()
				}
			},
			templates: {
				nestedTmpl1: "{{double:a}}",
				nestedTmpl2: {
					markup: "{{double:~upper(a)}}",
					helpers: {
						upper: function( value ) {
							return value.toUpperCase();
						}
					},
					converters: {
						"double": function( value ) {
							return "(override outer double:" +  value + "|" + value + ")";
						}
					}
				},
				templateWithDebug: {
					markup: "{{double:~upper(a)}}",
					debug: true
				}
			}
		}
	});
	var context = {
		upper: function( value ) {
			return "contextualUpper" + value.toUpperCase();
		},
		not: function( value ) {
			return "contextualNot" + !value;
		},
		not2: function( value ) {
			return "contextualNot2" + !value;
		}
	};
	equal( jsviews.render.tmplWithNestedResources({ a: "aVal" }), "aval aValbtrue% (double:aVal&aVal) (override outer double:AVAL|AVAL)", 'Access nested resources from template' );
	equal( jsviews.render.useLower({ a: "aVal" }), "", 'Cannot access nested resources from a different template' );
	equal( jsviews.render.tmplWithNestedResources({ a: "aVal" }, context), "aval aValbcontextualNot2true% (double:aVal&aVal) (override outer double:contextualUpperAVAL|contextualUpperAVAL)", 'Resources passed in with context override nested resources' );
	equal( jsviews.templates.tmplWithNestedResources.templates.templateWithDebug.fn.toString().indexOf("debugger;") > 0, true, 'Can set debug=true on nested template' );
});
