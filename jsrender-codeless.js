/*!
 * jQuery Render Plugin v1.0pre
 * Optimized version of jQuery Templates, for rendering to string
 * http://github.com/BorisMoore/jsrender
 */
window.JsViews || window.jQuery && jQuery.jsViews || (function( window, undefined ) {

var $, tmplTags, tmplEncode,
	FALSE = false, TRUE = true,
	jQuery = window.jQuery, document = window.document;
	htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
	stack = [],
	autoName = 0,
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	htmlSpecialChar = /[\x00"&'<>]/g,
	slice = Array.prototype.slice;

if ( jQuery ) {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is loaded, so make $ the jQuery object
	$ = jQuery;

	$.fn.extend({
		// Use first wrapped element as template markup.
		// Return string obtained by rendering the template against data.
		renderTmpl: function( data, context, parentView, path ) {
			return $.renderTmpl( this[0], data, context, parentView, path );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		compiledTmpl: function( name, context ) {
			return $.compiledTmpl( name, this[0], context );
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

			if ( length === undefined || $.isFunctiontype( object )) {
				for ( name in object ) {
					callback.call( object[ name ], name, object[ name ] );
				}
			} else for ( ; i < length; ) {
				callback.call( object[ i ], i, object[ i++ ] );
			}
			return object;
		},
		isFunction: function( obj ) {
			return typeof obj === "function";
		},
		isArray: Array.isArray || function( obj ) {
			return Object.prototype.toString.call( obj ) === "[object Array]";
		}
	}
}

//=================
// View constructor
//=================

function View( context, parentView, tmplFn, data, path ) {
	// Returns a view data structure for a new rendered instance of a template.
	// The content field is a hierarchical array of strings and nested views.
	// Prototype is $.tmplSettings.view, which provides both methods and fields.

	var content,
		self = this,
		parentContext = parentView && parentView.ctx;

	self.parent = parentView;
	parentView = parentView || {};

	$.extend( self, {
		path: path || "",
		// inherit context from parentView, merged with new context.
		index: parentView.viewsCount++ || 0,
		viewsCount: 0,
		data: data || parentView.data || {},
		// Set additional context on this view (which will modify the context inherited from the parent, and be inherited by child views)
		ctx : context && context === parentContext
			? parentContext
			: (parentContext ? $.extend( {}, parentContext, context ) : context),
		tmpl: tmplFn || null
	});

}

$.extend({
	tmpls: {},

	tmplSettings: {

//===============
// View prototype
//===============
		view: View.prototype = {
			tmpl: null,
			nodes: [],
			tag: function() {
				var content,
					args = slice.call( arguments ),
					tagFn = tmplTags[ args.shift() ],
					view = this,
					lastArg = args.pop();

				if ( +lastArg === lastArg ) {
					// Is a number, so this is a block tagFn: lastArg is the nested template key
					// assign the sub-content template function as last arg
					content = view.tmpl.nested[ lastArg ];
				}
				encoding = content ? args.pop() : lastArg;
				if ( !tagFn ) {
					// If not a tagFn, return empty string, and throw if in debug mode
					return "";
				}
				return encode( encoding,
					$.isFunction( tagFn )
						? args.length
							? tagFn.apply( view, [].concat( $.map( args, function( val ) {
								return /^(['"]).*\1$/.test( val )
									// If parameter is quoted text ('text' or "text") - replace by string: text
									? val.slice( 1,-1 )
									// Otherwise, treat as path to be evaluated
									: [ getValue( view, val )];
							}), content, args.toString(), encoding ))
							: tagFn.call( view, content, encoding )
						: tagFn.toString());
			},
			val: function( value, encoding ) {
				var view = this;
				value = /^(['"]).*\1$/.test( value )
					// If parameter is quoted text ('text' or "text") - replace by string: text
					? value.slice( 1,-1 )
					// Otherwise, treat as path to be evaluated
					: [ getValue( view, value )];

				return encode( encoding, $.isFunction( value )
					? value.apply( view.data, slice.call( arguments, 1 ))
					: value
				);
			}
		},
		allowCode: FALSE
	},

//===============
// renderTmpl
//===============

	renderTmpl: function( tmpl, data, context, parentView, path ) {
		// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
		var arrayView, result = "";

		if ( tmpl ) {
			tmpl = $.compiledTmpl( tmpl );
		}
		if ( !tmpl ) {
			return null; // Could throw...
		}
		if (  $.isFunction( data )) {
			data = data.call( parentView || {} );
		}

		if ( $.isArray( data )) {
			// Create a view item for the array, whose child views correspond to each data item.
			arrayView = getContent( new View( context, parentView, null, data, path ));
			$.each( data, function( i, dataItem ) {
				// Create child views corresponding to the rendered template for each data item.
				dataItem && getContent( new View( context, arrayView, tmpl, dataItem, "*" ));
			});
		} else {
			getContent( new View( context, parentView, tmpl, data, path ))
		}

		result = $.view
			// If $.view is defined, include annotations
			? "<!--tmpl(" + (path || "") + ") " + tmpl._name + "-->" + result + "<!--/tmpl-->"
			// else return just the string array
			: result;

		return result;

		function getContent( view ) {
			if ( view.tmpl ) {
				// Build the hierarchical content of strings, by executing the compiled template function
				var content = view.tmpl( view, view.data );
		//annotate = !!$.view; // TEMPORARY - make extensible and configurable
				result+= !!$.view && view.parent && $.isArray( view.parent.data ) ? "<!--item-->" + content + "<!--/item-->" : content;
			}
			return view;
		}
	},

//===============
// compiledTmpl
//===============

	// Set:
	// Use $.compiledTmpl( name, tmpl ) to cache a named template,
	// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
	// Use $( "selector" ).compiledTmpl( name ) to provide access by name to a script block template declaration.

	// Get:
	// Use $.compiledTmpl( name ) to access a cached template.
	// Also $( selectorToScriptBlock ).compiledTmpl(), or $.compiledTmpl( null, templateString )
	// will return the compiled template, without adding a name reference.
	// If templateString is not a selector, $.compiledTmpl( templateString ) is equivalent
	// to $.compiledTmpl( null, templateString ). To ensure a string is treated as a template,
	// include an HTML element, an HTML comment, or a template comment tag.
	compiledTmpl: function( name, tmpl ) {
		if (tmpl) {
			// Compile template and associate with name
			if ( typeof tmpl === "string" ) {
				// This is an HTML string being passed directly in.
				tmpl = compile( tmpl );
			} else if ( jQuery && tmpl instanceof $ ) {
				tmpl = tmpl[0];
			}
			if ( tmpl ) {
				if ( jQuery && tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = $.data( tmpl, "tmpl" ) || $.data( tmpl, "tmpl", compile( tmpl.innerHTML ));
				}
				$.tmpls[ tmpl._name = tmpl._name || name || "_" + autoName++ ] = tmpl;
			}
			return tmpl;
		}
		// Return named compiled template
		return name
			? typeof name !== "string"
				? $.compiledTmpl( null, name )
				: $.tmpls[ name ] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.compiledTmpl( null, htmlExpr.test( name ) ? name : try$( name ))
			: null;
	},

//===============
// registerTags
//===============

	// Register declarative tag.
	registerTags: function( name, fn ) {
		if ( typeof( name ) === "object" ) {
			// Object representation where property name is path and property value is value.
			// TODO: We've discussed an "objectchange" event to capture all N property updates here. See TODO note above about propertyChanges.
			for ( var key in name ) {
				this.registerTags( key, name[ key ])
			}
		} else {
			// Simple single property case.
			tmplTags[ name ] = fn;
		}
		return this;
	},

//===============
// Built-in tags
//===============

	tmplTags: tmplTags = {
		"if": function() {
			function ifArgs( args ) {
				var i = 0,
					l = args.length - 3;
				while ( l > -1 && !args[ i++ ]) {
					// Only render content if args.length < 3 (i.e. this is an else with no condition) or if a condition argument is truey
					if ( i === l ) {
						return "";
					}
				}
				self.onElse = undefined;
				return $.renderTmpl( args[ l < 0 ? 0 : l ], self.data, self.context, self, l > 0 && args[ l + 1 ] );
			}
			var self = this;
			self.onElse = function() {
				return ifArgs( arguments );
			};
			return ifArgs( arguments );
		},
		"else": function() {
			var onElse = this.onElse;
			if ( onElse ) {
				return onElse.apply( this, arguments );
			}
		},
		each: function() {
			var result = "",
				args = arguments,
				i = 0,
				l = args.length - 1,
				tmpl = args[ l - 2 ];
				if ( !tmpl ) {
					l--;
					tmpl = args[ l - 2 ];
				}
			for ( ; i < l - 2; i++ ) {
				result += args[ i ] ? $.renderTmpl( tmpl, args[ i ], this.context, this, args[ l - 1 ] ) : "";
			}
			return result;
		},
		"*": function( value ) {
			return value;
		}
	},

//===============
// tmplEncode
//===============

	tmplEncode: tmplEncode = {
		"none": function( text ) {
			return text;
		},
		"html": function( text ) {
			// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
			// Implementation, from Mike Samuel <msamuel@google.com>
			return String( text ).replace( htmlSpecialChar, replacerForHtml );
		}
		//TODO add URL encoding, and perhaps other encoding helpers...
	}
});

//=================
// compile template
//=================

// Generate a reusable function that will serve to render a template against data
// (Compile AST then build template function)
function compile( markup ) {
	var loc = 0,
		inBlock = TRUE,
		stack = [],
		top = [],
		content = top,
		current = [,,top];

	function pushPreceedingContent( shift ) {
		shift -= loc;
		if ( shift ) {
			var text = markup.substr( loc, shift ).replace(/\n/g,"\\n");
			if ( inBlock ) {
				content.push( text );
			} else {
				if ( !text.split('"').length%2 ) {
					// This is a {{ or }} within a string parameter, so skip parsing. (Leave in string)
					return TRUE;
				}
										//( path	or 	\"string\" )	   or (   path        =    ( path    or  \"string\" )
				(text + " ").replace( /([\w\$\.\[\]]+|(\\?['"])(.*?)\2)(?=\s)|([\w\$\.\[\]]+)\=([\w\$\.\[\]]+|\\(['"]).*?\\\5)(?=\s)/g,
					function( all, path, quot, lhs, rhs ) {
						content.push( path ? path : [ lhs, rhs ] ); // lhs and rhs are for named params
					}
				);
			}
		}
	}

	// Build abstract syntax tree: [ tag, params, content, encoding ]
	markup = markup
		.replace( /\\'|'/g, "\\\'" ).replace( /\\"|"/g, "\\\"" )  //escape ', and "
		.split( /\s+/g ).join( " " ) // collapse white-space
		.replace( /^\s+/, "" ) // trim left
		.replace( /\s+$/, "" ); // trim right;

	//					 {{		 #		helper					singleCharHelper							code						 !encoding }}		{{/closeBlock}}
	markup.replace( /(?:\{\{(?:(\#)?([\w\$\.\[\]]+(?=[\s\}!]))|([^\/\*\w\s\d\x7f\x00-\x1f](?=[\s\w\$\[]))|\*((?:[^\}]|\}(?!\}))+)\}\}))|(!(\w*))?(\}\})|(?:\{\{\/([\w\$\.\[\]]+)\}\})/g,
		function( all, isBlock, helper, singleCharHelper, code, useEncode, encoding, endHelper, closeBlock, index ) {
			helper = helper || singleCharHelper;
			if ( pushPreceedingContent( index )) {
				return;
			}
			if ( code ) {
				if ( $.tmplSettings.allowCode ) {
					content.push([ "*", code.replace( /\\(['"])/g, "$1" )]);   // unescape ', and "
				}
			} else if ( helper) {
				if ( helper === "else" ) {
					current = stack.pop();
					content = current[ 2 ];
					isBlock = TRUE;
				}
				stack.push( current );
				content.push( current = [ helper, [], isBlock && 1] );
			} else if ( endHelper ) {
				current[ 3 ] = useEncode ? encoding : content ? "none" : "html";
				if ( current[ 2 ] ) {
					current[ 2 ] = [];
				} else {
					current = stack.pop();
				}
			} else if ( closeBlock ) {
				current = stack.pop();
			}
			loc = index + all.length; // location marker - parsed up to here
			inBlock = !helper && current[ 2 ] && current[ 2 ] !== 1;
			content = current[ inBlock ? 2 : 1 ];
		});

	pushPreceedingContent( markup.length );

	return buildTmplFunction( top );
}

// Build javascript compiled template function, from AST
function buildTmplFunction( nodes ) {
	var ret, content, endsInPlus, node,
		helperDepth = 0,
		nested = [],
		i = 0,
		l = nodes.length,
		code = 'var result="";\nresult+=';

	function nestedCall( node ) {
		if ( typeof node === "string" ) {
			return '"' + node + '"';
		}
		var tag = node[ 0 ],
			code = tag === "=" // TODO test for helperDepth: using {{= }} at depth>0 is an error.
				? '$view.val('
				: '$view.tag("' + tag + '",';
		helperDepth++;
		for ( var j = 0, k = node[ 1 ].length; j < k; j++ ) {
			code += nestedCall( node[ 1 ][ j ]) + ',';
		}
		helperDepth--;
		content = node[ 2 ];
		code += '"' + ( helperDepth ? "" : node[ 3 ] || "none" ) + '"'
			// TODO Test for If node[ 3 ] && helperDepth: error. Only encode at top-level, not in nested helpers
			+ ( content ? "," + nested.length : "" );
		if( content ) {
			nested.push( buildTmplFunction( content ));
		}
		return code  + ')';
	}

	for ( ; i < l; i++ ) {
		endsInPlus = FALSE;
		node = nodes[ i ];
		if ( node[ 0 ] === "*" ) {
			code = code.slice( 0, -1 ) + ";" + node[ 1 ] + "result+=";
		} else {
			code += nestedCall( node ) + "+";
			endsInPlus = TRUE;
		}
	}
	ret = new Function( "$view, $data", code.slice( 0, endsInPlus ? -1 : -8 ) + ";\nreturn result;" );
	ret.nested = nested;
	return ret;
}

//========================== Private helper functions, used by code above ==========================

function encode( encoding, text ) {
	return text
		? encoding
			? ( tmplEncode[ encoding ] || tmplEncode.html)( text ) // HTML encoding is the default
			: '"' + text + '"'
		: "";
}

function getValue( view, path ) {
	var object, varName;
	path = path.split(".");
	object = path[ 0 ].charAt( 0 ) === "$"
		? (varName = path.shift().slice( 1 ), varName === "view" ? view : view[ varName ])
		: view.data;

	// If 'from' path points to a property of a descendant 'leaf object',
	// link not only from leaf object, but also from intermediate objects
	while ( object && path.length > 1 ) {
		object = object[ path.shift() ];
	}
	path = path[ 0 ];
	return path ? object && object[ path ] : object;
}

function replacerForHtml( ch ) {
	// Original code from Mike Samuel <msamuel@google.com>
	return escapeMapForHtml[ ch ]
		// Intentional assignment that caches the result of encoding ch.
		|| ( escapeMapForHtml[ ch ] = "&#" + ch.charCodeAt( 0 ) + ";" );
}

function try$( selector ) {
	// If selector is valid, return jQuery object, otherwise return (invalid) selector string
	try {
		return $( selector );
	} catch( e) {}
	return selector;
}

})( window );
