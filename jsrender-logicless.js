/*!
 * jQuery Render Plugin v1.0pre
 * Optimized version of jQuery Templates, for rendering to string
 * http://github.com/BorisMoore/jsrender
 */
window.JsViews || window.jQuery && jQuery.jsViews || (function( window, undefined ) {

var $, helpers,
	FALSE = false, TRUE = true,
	jQuery = window.jQuery, document = window.document;
	htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
	viewKey = 0,
	stack = [],
	autoName = 0,
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	htmlSpecialChar = /[\x00"&'<>]/g;

if ( jQuery ) {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is loaded, so make $ the jQuery object
	$ = jQuery;

	$.fn.extend({
		// Use first wrapped element as template markup.
		// Return string obtained by rendering the template against data.
		renderTmpl: function( data, context, parentView ) {
			return $.renderTmpl( this[0], data, context, parentView );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		registerTmpl: function( name, context ) {
			return $.registerTmpl( name, this[0], context );
		}
	});
} else {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is not loaded. Make $ the JsViews object
	window.JsViews = window.$ = $ = {
		extend: function( target, source ) {
			if ( source === undefined ) {
				source = target;
				target = $;
			}
			for ( var name in source ) {
				target[ name ] = source[ name ];
			}
			return target;
		},
		map: function( elems, callback ) {
			var value, ret = [],
				i = 0,
				length = elems.length;

			if ( $.isArray( elems )) {
				for ( ; i < length; i++ ) {
					value = callback( elems[ i ], i );

					if ( value != null ) {
						ret.push( value );
					}
				}
			}
			// Flatten any nested arrays
			return ret.concat.apply( [], ret );
		},
		each: function( object, callback ) {
			var name,
				i = 0,
				length = object.length;

			if ( length === undefined || typeof object === "function" ) {
				for ( name in object ) {
					callback.call( object[ name ], name, object[ name ] );
				}
			} else for ( ; i < length; ) {
				callback.call( object[ i ], i, object[ i++ ] );
			}
			return object;
		},
		isArray: Array.isArray || function( obj ) {
			return Object.prototype.toString.call( obj ) === "[object Array]";
		}
	}
}

function replacerForHtml( ch ) {
	// Original code from Mike Samuel <msamuel@google.com>
	return escapeMapForHtml[ ch ]
		// Intentional assignment that caches the result of encoding ch.
		|| ( escapeMapForHtml[ ch ] = "&#" + ch.charCodeAt( 0 ) + ";" );
}

function setViewContext( view, context, merge ) {
	var parentContext = view.parent && view.parent.ctx;
	// Set additional context on this view (which will modify the context inherited from the parent, and be inherited by child views)
	view.ctx = context && context === parentContext
		? parentContext
		: (view._ctx = context, parentContext ? $.extend( {}, parentContext, context ) : context);
}

function View( context, parentView, tmplFn, data, path ) { //, index ) {
	// Returns a view data structure for a new rendered instance of a template.
	// The content field is a hierarchical array of strings and nested views.
	// Prototype is $.tmplSettings.view, which provides both methods and fields.

	var content,
		self = this,
		parentContext;

	self.parent = parentView;
	parentView = parentView || {};
	parentContext = parentView.ctx;

	$.extend( self, {
		path: path || "",
		// inherit context from parentView, merged with new context.
		data: data || parentView.data || {},
		tmpl: tmplFn || null
		//,_wrap: parentView._wrap
	});

	setViewContext( self, context );

	if ( tmplFn ) {
		// Build the hierarchical content of strings, by executing the compiled template function
		content = self.tmpl( self );
//annotate = !!$.view; // TEMPORARY - make extensible and configurable
		self._ctnt = ( !!$.view && $.isArray( parentView.data )) ? [].concat( "<!--item-->", content, "<!--/item-->" ) : content;
		self.key = ++viewKey;
	}
}

function try$( selector ) {
	// If selector is valid, return jQuery object, otherwise return (invalid) selector string
	try {
		return $( selector );
	} catch( e) {}
	return selector;
}

$.extend({
	tmpls: {},

	// Register declarative tag.
	registerHelper: function( name, fn ) {
		if ( typeof( name ) === "object" ) {
			// Object representation where property name is path and property value is value.
			// TODO: We've discussed an "objectchange" event to capture all N property updates here. See TODO note above about propertyChanges.
			for ( var key in name ) {
				this.registerHelper( key, name[ key ])
			}
		} else {
			// Simple single property case.
			helpers[ name ] = fn;
		}
		return this;
	},

	helpers: helpers = {
		encode: [
			// $.helpers.encode[1]: HTML encoding helper: Replace < > & and ' and " by corresponding entities.
			function( text ) {
				// Implementation, from Mike Samuel <msamuel@google.com>
				return String( text ).replace( htmlSpecialChar, replacerForHtml );
			}
//			,function( text ) { // TODO add URL encoding, and perhaps other encoding helpers...
//				// Do URL encoding
//				return ...;
//			}
		],
		"if": function( val, content ) {
			var args = arguments,
				i = 0,
				l = args.length - 1;
			for ( ; i < l; i++ ) {
				if (args[ i ]) {
					return content( this );
				}
			}
			return "";
		},
		each: function() {
			var result = "",
				args = arguments,
				i = 0,
				l = args.length - 1;
			for ( ; i < l; i++ ) {
				result += $.renderTmpl( args[ l ], args[ i ], this );
			}
			return result;
		}
	},

	// Return string obtained by rendering template against data.
	renderTmpl: function( tmpl, data, context, parentView, topLevel ) {
		var ret = renderViews( tmpl, data, context, parentView, topLevel );
		ret = ( !topLevel && parentView && tmpl) ? ret : buildStringArray( parentView, ret ).join("");
		viewKey = 0;
		return ret;
	},

	// Set:
	// Use $.registerTmpl( name, tmpl ) to cache a named template,
	// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
	// Use $( "selector" ).registerTmpl( name ) to provide access by name to a script block template declaration.

	// Get:
	// Use $.registerTmpl( name ) to access a cached template.
	// Also $( selectorToScriptBlock ).registerTmpl(), or $.registerTmpl( null, templateString )
	// will return the compiled template, without adding a name reference.
	// If templateString is not a selector, $.registerTmpl( templateString ) is equivalent
	// to $.registerTmpl( null, templateString ). To ensure a string is treated as a template,
	// include an HTML element, an HTML comment, or a template comment tag.
	registerTmpl: function( name, tmpl ) {
		if (tmpl) {
			// Compile template and associate with name
			if ( typeof tmpl === "string" ) {
				// This is an HTML string being passed directly in.
				tmpl = buildTmplFn( tmpl );
			} else if ( jQuery && tmpl instanceof $ ) {
				tmpl = tmpl[0];
			}
			if ( tmpl ) {
				if ( jQuery && tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = $.data( tmpl, "tmpl" ) || $.data( tmpl, "tmpl", buildTmplFn( tmpl.innerHTML ));
				}
				$.tmpls[ tmpl._name = tmpl._name || name || "_" + autoName++ ] = tmpl;
			}
			return tmpl;
		}
		// Return named compiled template
		return name
			? typeof name !== "string"
				? $.registerTmpl( null, name )
				: $.tmpls[ name ] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.registerTmpl( null, htmlExpr.test( name ) ? name : try$( name ))
			: null;
	},

	// The following substitution terms can be uses in template tag definitions:
	// $1 is the target parameter - as in {{if targetParam}}
	// $1a is the target parameter as above, but with automatic detection of functions, so if targetParam is a function it will
	// be replaced by its return value during rendering
	// $2 is the comma-separated list of additional function parameters as in {{tmpl(functionParams) targetParam}}
	// $2s is the string corresponding to the comma-separated list of additional function parameters,
	// so with {{tmpl(param1, param2) targetParam}} it will be the string "param1, param2"
	tmplSettings: {
//		tag: {
//			"tmpl": {
//				_default: { $2: "null" },
//				open: "if($notnull_1){__=__.concat($view.nest($1,$2s,$2));}"
//				// tmpl target parameter can be of type function, so use $1, not $1a (so not auto detection of functions)
//				// This means that {{tmpl foo}} treats foo as a template (which IS a function).
//				// Explicit parens can be used if foo is a function that returns a template: {{tmpl foo()}}.
//			},
//			"each": {
//				_default: { $2: "$index, $value" },
//				open: "if($notnull_1){$.each($1a,function($2){with(this){",
//				close: "}});}"
//			},
//			"if": {
//				open: "if(($notnull_1) && $1a){",
//				close: "}"
//			},
//			"else": {
//				_default: { $1: "true" },
//				open: "}else if(($notnull_1) && $1a){"
//			},
//			"html": {
//				// Unencoded expression evaluation.
//				open: "if($notnull_1){__.push($1a);}"
//			},
//			":": {
//				// Code execution
//				open: "$1"
//			},
//			"=": {
//				// Encoded expression evaluation. Abbreviated form is ${}.
//				_default: { $1: "$data" },
//				open: "if($notnull_1){__.push($.encode($1a));}"
//			},
//			"!": {
//				// Comment tag. Skipped by parser
//				open: ""
//			}
//		},

		view: View.prototype = {
			tmpl: null,
			nodes: [],
			get: function( path ) {
				var helper = helpers[ path ],
					self = this,
					args = arguments,
					l = args.length - 1;
					lastArg = args[ l ];
					encoding = (+lastArg !== lastArg) && lastArg; // If a string, lastArg is the encoding
					lastArg = !encoding && self.tmpl.nested[ lastArg  ]; // If a number, this is a block helper, and lastArg is the nested template function for this sub-content
				if ( !helper ) {
					// If not a helper, then get data. If a function, call it, with the $data as context
					helper = getData( self, path );
					self = self.data;
				}
				return encode( encoding,
					typeof helper === "function"
					? l > 1
						? helper.apply( self, [].concat( $.map( Array.prototype.slice.call( args, 1, -1 ), function( val ) {
							return /^(['"]).*\1$/.test( val )
								// If parameter is quoted text ('text' or "text") - replace by String(text)
								? String( val.slice( 1,-1 ))
								// Otherwise, treat as path or helper, to be evaluated by recursive call to get()
								: [ getData( self, val, encoding )];
						}), lastArg ))
						: helper.call( self, lastArg )
					: helper );
//			},
//			calls: function( content ) {
//				if ( !content ) {
//					return stack.pop();
//				}
//				stack.push( arguments );
//			},
//			nest: function( tmpl, paramString, data, context ) {
//				// nested template, using {{tmpl}} tag
//				return renderViews( tmpl, data, context, this, paramString );
			}
		}
	}
});

//========================== Private helper functions, used by code above ==========================

function encode( encoding, text ) {
	return text === undefined
		? ""
		: encoding
			? ( helpers.encode[ encoding ] || helpers.encode[ 0 ])( text ) // HTML encoding is the default
			: text;
}

function getData( view, source ) {
	return source = view.data[ source ];
}

//function testGetData( view, source ) {
//	source = view.data[ source ];
//	return encode( encoding, source );
//}

function renderViews( tmpl, data, context, parentView, path ) {
	// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
	var arrayView, ret;//, wrapped;

	if ( tmpl ) {
		tmpl = $.registerTmpl( tmpl );
		if ( typeof tmpl !== "function" ) {
			tmpl = $.tmpls[ tmpl ] || $.registerTmpl( null, tmpl );
		}
	}
	if ( !tmpl ) {
		return null; // Could throw...
	}
	if ( typeof data === "function" ) {
		data = data.call( parentView || {} );
	}

	if ( $.isArray( data )) {
		// Create a view item for the array, whose child views correspond to each data item.
		arrayView = new View( context, parentView, null, data, path );
		ret = $.map( data, function( dataItem ) {
			// Create child views corresponding to the rendered template for each data item.
			return dataItem ? new View( context, arrayView, tmpl, dataItem, "*" ) : null;
		});
	} else {
		ret = [ new View( context, parentView, tmpl, data, path ) ];
	}
	return $.view
		// If $.view is defined, include annotations
		? [].concat(
			"<!--tmpl(" + (arrayView||ret[0]).path + ") " + tmpl._name + "-->", //+ tmpl._name + ":"
			ret,
			"<!--/tmpl-->" )
		// else return just the string array
		: ret;
}

function buildStringArray( view, content ) {
	// Convert hierarchical content (tree of nested views) into flat string array of rendered content
	// (optionally with attribute annotations for views)
	// Add data-jq-path attribute to top-level elements (if any) of the rendered view...

//		var annotate = view && view.annotate;

	return content
		? $.map( content, function( view ) {
			return (typeof view === "string")
				? view
				: buildStringArray( view, [view._ctnt] ); //TODO not use string arrays...?
			})

		// If content is not defined, return view directly. Not a view. May be a string, or a string array, e.g. from {{html $view.html()}}.
		: view || [];
}

// Generate a reusable function that will serve to render a template against data
function buildTmplFn( markup ) {
	var helpers,
		loc = 0,
		inBlock = TRUE,
		stack = [],
		top = [],
		content = top,
		current = [,,top];

	function pushPreceedingContent( shift ) {
		shift -= loc;
		if ( shift ) {
			var text = markup.substr( loc, shift );
			if ( inBlock ) {
				content.push( text );
			} else {
				if ( !text.split('"').length%2 ) {
					// This is a {{ or }} within a string parameter, so skip parsing. (Leave in string)
					return TRUE;
				}
										//( path	or 	\"string\" )	   or (   path        =    ( path    or  \"string\" )
				(text + " ").replace( /([\w\$\.\[\]]+|\\(['"])(.*?)\\\2)(?=\s)|([\w\$\.\[\]]+)\=([\w\$\.\[\]]+|\\(['"]).*?\\\5)(?=\s)/g,
					function( all, path, quot, lhs, rhs ) {
						content.push( path ? path : [ lhs, rhs ] );
					}
				);
			}
		}
	}

	// Compile the template as a JavaScript function
	markup = markup
		.replace( /\\'|'/g, "\\\'" ).replace( /\\"|"/g, "\\\"" )  //escape ', and "
		.split( /\s+/g ).join( " " )
		.replace( /^\s+/, "" )
		.replace( /\s+$/, "" );
					   //{{   #   helper					      {{"string"}}		     ! }}		     {{/closeBlock}}
	markup.replace( /(?:\{\{(\#)?([\w\$\.\[\]]+(?=[\s\}!]))|\{\{\\(['"])(.*?)\\\3\}\})|(!(\d?))?(\}\})|(?:\{\{\/([\w\$\.\[\]]+)\}\})/g,
		function( all, isBlock, helper, quote, string, useEncode, encoding, endHelper, closeBlock, index ) {
			if ( pushPreceedingContent( index )) {
				return;
			}
			if ( string ) {
				content.push(  string );
			} else if ( helper) {
				stack.push( current );
				content.push( current = [ helper, [], isBlock && 1] );
			} else if ( endHelper ) {
				current[ 3 ] = useEncode ? encoding : "0";
				if ( current[ 2 ] ) {
					current[ 2 ] = [];
				} else {
					current = stack.pop();
				}
			} else if ( closeBlock ) {
				current = stack.pop();
			}
			loc = index + all.length;
			inBlock = !helper && current[ 2 ] !== 1;
			content = current[ inBlock ? 2 : 1 ];
		});

	pushPreceedingContent( markup.length );

	return compileTemplate( top );
}

function compileTemplate( nodes ) {
	var ret, j, k, content,
		nested = [],
		i = 0,
		l = nodes.length,
		code = 'return ';

	for ( ; i < l; i++ ) {
		node = nodes[ i ];
		content = node[ 2 ];
		if ( typeof node === "string" ) {
			code += '"' + node + '"+';
		} else {
			code += 'ctx.get("' + node[ 0 ] + '",';
			for ( j = 0, k = node[1].length; j < k; j++ ) {
				code += '"' + node[ 1 ][ j ] + '",';
			}
			code += (content ? nested.length : ('"' + (node[ 3 ]||"") + '"')) + ')+';
			if( content ) {
				nested.push( compileTemplate( content ));
			}
		}
	}
	ret = new Function( "ctx", code.slice( 0, -1 ) + ";" );
	ret.nested = nested;
	return ret;
}
})( window );
