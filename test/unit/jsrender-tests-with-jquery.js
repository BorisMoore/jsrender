/// <reference path="../../jquery-1.7.1.js" />
/// <reference path="../qunit/qunit.js" />
/// <reference path="../../jsrender.js" />
function compileTmpl( template ) {
	try {
		return typeof $.templates( null, template ).fn === "function" ? "compiled" : "failed compile";
	}
	catch(e) {
		return "error:" + e;
	}
}

function sort( array ){
	var ret = "";
	if ( this.props.reverse ) {
		// Render in reverse order
		for ( var i = array.length; i; i-- ) {
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

var tmplString =  "A_{{:name}}_B";
$.views.allowCode = true;
module( "api" );
test("templates", function() {
	expect(14);
	$.templates( "myTmpl", tmplString );
	equal( $.render.myTmpl( person ), "A_Jo_B", 'Compile a template and then render it: $.templates( "myTmpl", tmplString ); $.render.myTmpl( data );' );

	$.templates({ myTmpl2: tmplString });
	equal( $.render.myTmpl2( person ), "A_Jo_B", 'Compile and register templates: $.templates({ "myTmpl", tmplString, ...  }); $.render.myTmpl( data );' );

	equal( $.templates.myTmpl2.render( person ), "A_Jo_B", 'Get named template: $.templates.myTmpl.render( data );' );

	equal( $.templates( tmplString ).render( person ), "A_Jo_B", 'Compile without registering as named template: $.templates( tmplString ).render( person );' );

	var tmpl2 = $.templates( "#myTmpl" );
	equal( $.trim( tmpl2.render( person )), "A_Jo_B", 'var tmpl = $.templates( "#myTmpl" ); returns compiled template for script element' );

	$.templates({
		myTmpl3: {
			markup: "#myTmpl"
		}
	});
	equal( $.trim( $.render.myTmpl3( person )), "A_Jo_B", 'Named template for template object with selector: { markup: "#myTmpl" }' );

	var tmpl2 = $.templates( "#myTmpl" );
	equal( $.trim( tmpl2.render( person )), "A_Jo_B", 'var tmpl = $.templates( "#myTmpl" ); returns compiled template for script element' );

	var tmpl3 = $.templates( "", {
		markup: "#myTmpl"
	});
	equal( $.trim( tmpl3.render( person )), "A_Jo_B", 'Compile from template object with selector, without registering: { markup: "#myTmpl" }' );

	equal( 	$.templates( "#myTmpl" ).fn === tmpl2.fn && tmpl2.fn === tmpl3.fn, true, '$.templates( "#myTmpl" ) caches compiled template, and does not recompile each time;' );

	equal( 	tmpl2 === $.templates( "", "#myTmpl" ), true, '$.templates( "#myTmpl" ) and $.templates( "", "#myTmpl" ) are equivalent' );

	var cloned = $.templates( "cloned", "#myTmpl" );
	equal( 	cloned !== tmpl2 && cloned.name == "cloned", true, '$.templates( "cloned", "#myTmpl" ) will clone the cached template' );

	$.templates({ cloned: "#myTmpl" });
	equal( 	$.templates.cloned !== tmpl2 && $.templates.cloned.name == "cloned", true, '$.templates({ cloned: "#myTmpl" }) will clone the cached template' );

	$.templates( "myTmpl", null );
	equal( $.templates.myTmpl, undefined, 'Remove a named template:  $.templates( "myTmpl", null );' );

	var tmpl3 = $.templates({
		"scriptTmpl": {
			markup: "#myTmpl",
			debug:true
		},
		"tmplFromString": {
			markup: "testDebug",
			debug:true
		}
	});
	equal( $.templates.tmplFromString.fn.toString().indexOf("debugger;") > 0 && $.templates.scriptTmpl.fn.toString().indexOf("debugger;") > 0, true, 'Debug a template:  set debug:true on object' );
});

test("render", function() {
	expect(5);
	equal( $.trim( $("#myTmpl").render( person )), "A_Jo_B", '$( tmplSelector ).render( data );' ); // Trimming because IE adds whitespace

	var tmpl3 = $.templates( "myTmpl4", tmplString );

	equal( $.render.myTmpl4( person ), "A_Jo_B", '$.render.myTmpl( object );' );
	equal( $.render.myTmpl4( people ), "A_Jo_BA_Bill_B", '$.render.myTmpl( array );' );

	var tmplObject = $.templates.myTmpl4;
	equal( tmplObject.render( people ), "A_Jo_BA_Bill_B", 'var tmplObject = $.templates.myTmpl; tmplObject.render( data );' );

	$.templates( "myTmpl5", "A_{{for}}inner{{:name}}content{{/for}}_B" );
	equal( $.templates.myTmpl5.tmpls[0].render( person ), "innerJocontent", 'Nested template objects: $.templates.myTmpl.tmpls' );
});

test("converters", function() {
	expect(3);
	function loc( data ) {
		switch (data) { case "desktop": return "bureau"; };
	}
	$.views.converters({ loc: loc });
	equal( $.templates( "{{loc:#data}}:{{loc:'desktop'}}" ).render( "desktop" ), "bureau:bureau", "$.views.converters({ loc: locFunction })" );

	$.views.converters( "loc2", loc );
	equal( $.views.converters.loc2 === loc, true, 'locFunction === $.views.converters.loc' );

	$.views.converters({ loc2: null});
	equal( $.views.converters.loc2, undefined, 'Remove a registered converter: $.views.converters({ loc: null })');
});

test("tags", function() {
	expect(3);

	$.views.tags({ sort: sort });
	equal( $.templates( "{{sort people reverse=true}}{{:name}}{{/sort}}" ).render({ people: people }), "BillJo", "$.views.tags({ sort: sortFunction })" );

	$.views.tags( "sort2", sort );
	equal( $.views.tags.sort === sort, true, 'sortFunction === $.views.tags.sort' );

	$.views.tags( "sort2", null );
	equal( $.views.tags.sort2, undefined, 'Remove a registered tag: $.views.tag({ sor: null })' );
});

test("helpers", function() {
	expect(3);
	function concat() {
		return "".concat.apply( "", arguments );
	}

	$.views.helpers({
		not: function( value ) {
			return !value;
		},
		concat: concat
	})
	equal( $.templates( "{{:~concat(a, 'b', ~not(false))}}" ).render({ a: "aVal" }), "aValbtrue", "$.views.helpers({ concat: concatFunction })");

	$.views.helpers({ concat2: concat });

	equal( $.views.helpers.concat === concat, true, 'concatFunction === $.views.helpers.concat' );

	$.views.helpers("concat2", null);
	equal($.views.helpers.concat2, undefined,  'Remove a registered helper: $.views.helpers({ concat: null })' );
});

test("template encapsulation", function() {
	expect(1);
	$.templates({
		myTmpl6: {
			markup: "{{sort reverse=true people}}{{:name}}{{/sort}}",
			tags: {
				sort: sort
			}
		}
	});
	equal( $.render.myTmpl6({ people: people }), "BillJo", '$.templates( "myTmpl", tmplObjWithNestedItems );' );
});

