/*! JsRender v1.0pre - (jsrender.js version: does not require jQuery): http://github.com/BorisMoore/jsrender */
/*
 * Optimized version of jQuery Templates, for rendering to string, using 'codeless' markup.
 */
window.JsViews || window.jQuery && jQuery.views || (function( window, undefined ) {

var $, _$, JsViews, viewsNs, tmplEncode, render, tagRegex, registerTags,
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
		render: function( data, context, parentView, path ) {
			return render( this[0], data, context, parentView, path );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		template: function( name, context ) {
			return $.template( name, this[0], context );
		}
	});

} else {

	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is not loaded. Make $ the JsViews object
	
	// Map over the $ in case of overwrite
	_$ = window.$,
	
	window.JsViews = JsViews = window.$ = $ = {
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
		isArray: Array.isArray || function( obj ) {
			return Object.prototype.toString.call( obj ) === "[object Array]";
		},
		noConflict: function() {
			if ( window.$ === JsViews ) {
				window.$ = _$;
			}
			return JsViews;
		}
	}
}

//=================
// View constructor
//=================

function View( context, path, parentView, data, template ) {
	// Returns a view data structure for a new rendered instance of a template.
	// The content field is a hierarchical array of strings and nested views.

	var self, content,
		parentContext = parentView && parentView.ctx;

	parentView = parentView || { viewsCount:0 };

	self = {
		jsViews: "v1.0pre",
		path: path || "",
		// inherit context from parentView, merged with new context.
		itemNumber: ++parentView.viewsCount || 1,
		viewsCount: 0,
		tmpl: template,
		data: data || parentView.data || {},
		// Set additional context on this view (which will modify the context inherited from the parent, and be inherited by child views)
		ctx : context && context === parentContext
			? parentContext
			: (parentContext ? $.extend( {}, parentContext, context ) : context),
		parent: parentView
	};
	return self;
}

$.extend({
	views: viewsNs = {
		templates: {},
		tags: {},
		allowCode: FALSE,
		debugMode: TRUE,
//===============
// setDelimiters
//===============

		setDelimiters: function( openTag, closeTag ) {
			var firstCloseChar = closeTag.charAt( 1 ),
				secondCloseChar = closeTag.charAt( 0 );
			openTag = openTag.charAt( 0 ) + "\\" + openTag.charAt( 1 ); // Not including first escape '\'
			closeTag = firstCloseChar + "\\" + secondCloseChar; // Not including first escape '\'
			tagRegex =
				//         OPEN
				"(?:\\" + openTag 
				
					// EITHER #?    tagname
					+ "(?:(\\#)?(\\w+(?=[\\s\\" + firstCloseChar + "!]))"
					// OR       =
					+ "|(\\=(?=[\\s\\w\\$\\[]))"
					// OR   code
					+ "|\\*((?:[^\\" + firstCloseChar + "]|\\" + firstCloseChar + "(?!\\" + secondCloseChar + "))+)\\" + closeTag + "))"
				
				// OR !encoding?      CLOSE
				+ "|(!(\\w*))?(\\" + closeTag + ")"
				// OR  {{/closeBlock}}
				+ "|(?:\\" + openTag + "\\/([\\w\\$\\.\\[\\]]+)\\" + closeTag + ")";
			
			tagRegex = new RegExp( tagRegex, "g" );
		},

//===============
// renderTag
//===============

		renderTag: function( tagName ) {
			// This is a tag call, with arguments: "tagName", [params, ...], [content,] [params.toString,] view, encoding, [hash,] [nestedTemplateFnIndex]
			var content, ret, key, view, encoding, hash, l,
				hashString = "",
				path = "",
				args = slice.call( arguments, 1 ),
			tagFn = viewsNs.tags[ tagName ];

			function getValue( val ) { // TODO optimize in case whether this a simple path on an object - no bindings etc.
				var result, object, varName;

				if ( /^(['"]).*\1$/.test( val )) {
					// If parameter is quoted text ('text' or "text") - replace by string: text
					result = val.slice( 1,-1 );
				} else if ( "" + val !== val ) { // not type string
					// Otherwise, treat as path to be evaluated
					result = val;
				} else {
					val = val.split(".");
					object = val[ 0 ].charAt( 0 ) === "$"
						? (varName = val.shift().slice( 1 ), varName === "view" ? view : view[ varName ])
						: view.data;

					// If 'from' val points to a property of a descendant 'leaf object',
					// link not only from leaf object, but also from intermediate objects
					while ( object && val.length > 1 ) {
						object = object[ val.shift() ];
					}
					val = val[ 0 ];
					result = val ? object && object[ val ] : object;
				}
				return [ result ];
			}

			encoding = args.pop();
			if ( +encoding === encoding ) { // type number
				// Last arg is a number, so this is a block tagFn and last arg is the nested template index (integer key)
				// assign the sub-content template function as last arg
				content = encoding;
				encoding = args.pop(); // In this case, encoding is the next to last arg
			}
			if ( "" + encoding !== encoding ) { // not type string
				// This arg is not a string, so must be the hash
				hash = encoding;
				encoding = args.pop(); // In this case, encoding is the next to last arg
			}
			view = args.pop();
			content = content && view.tmpl.nested[ content - 1 ];
			l = args.length;
			if ( l ) {
				path = args.toString()
				args = $.map( args, getValue );
			}
			if ( hash ) {
				hashString = hash._hash;
				delete hash._hash;
				for ( key in hash ) { 
					hash[ key ] = getValue( hash[ key ])[0];
				}
			}
			hash = hash || {};
			hash._content = content || hash._content || "";
			hash._hash = hashString;
			args.push( hash, path, encoding );
			// Parameters are params..., hash, content, path, encoding
			ret = tagFn && (tagFn.apply( view, args ) || "");

			return encoding === "string" ? ('"' + ret + '"') : ret;
			// Useful to force chained tags to return results as string values,
			// (wrapped as quoted string) for passing as arguments to calling tag
		},

//===============
// registerTags
//===============

		// Register declarative tag.
		registerTags: registerTags = function( name, tag ) {
			if ( typeof name === "object" ) {
				// Object representation where property name is path and property value is value.
				// TODO: We've discussed an "objectchange" event to capture all N property updates here. See TODO note above about propertyChanges.
				for ( var key in name ) {
					registerTags( key, name[ key ])
				}
			} else {
				// Simple single property case.
				viewsNs.tags[ name ] = tag;
			}
			return this;
		},


//===============
// tmpl.encode
//===============

		encode: tmplEncode = {
			"none": function( text ) {
				return text;
			},
			"html": function( text ) {
				// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
				// Implementation, from Mike Samuel <msamuel@google.com>
				return String( text ).replace( htmlSpecialChar, replacerForHtml );
			},
			"string": function( text ) {
				return '"' + text + '"'; // Used for chained helpers to return quoted strings
			}
			//TODO add URL encoding, and perhaps other encoding helpers...
		}
	},

//===============
// render
//===============

	render: render = function( tmpl, data, context, parentView, path ) {
		// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
		var i, l, dataItem, arrayView, content, result = "";

		if ( arguments.length === 2 && data.jsViews ) {
			parentView = data;
			context = parentView.ctx;
			data = parentView.data;
		}
		tmpl = $.template( tmpl );
		if ( !tmpl ) {
			return ""; // Could throw...
		}

		if ( $.isArray( data )) {
			// Create a view item for the array, whose child views correspond to each data item.
			arrayView = View( context, path, parentView, data);
			l = data.length;
			for ( i = 0, l = data.length; i < l; i++ ) {
				dataItem = data[ i ];
				content = dataItem ? tmpl( dataItem, View( context, path, arrayView, dataItem, tmpl )) : "";
				result += viewsNs.activeViews ? "<!--item-->" + content + "<!--/item-->" : content;
			}
		} else {
			result += tmpl( data, View( context, path, parentView, data, tmpl ));
		}

		return viewsNs.activeViews
			// If in activeView mode, include annotations
			? "<!--tmpl(" + (path || "") + ") " + tmpl._name + "-->" + result + "<!--/tmpl-->"
			// else return just the string result
			: result;
	},

//===============
// template
//===============

	// Set:
	// Use $.template( name, tmpl ) to cache a named template,
	// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
	// Use $( "selector" ).template( name ) to provide access by name to a script block template declaration.

	// Get:
	// Use $.template( name ) to access a cached template.
	// Also $( selectorToScriptBlock ).template(), or $.template( null, templateString )
	// will return the compiled template, without adding a name reference.
	// If templateString is not a selector, $.template( templateString ) is equivalent
	// to $.template( null, templateString ). To ensure a string is treated as a template,
	// include an HTML element, an HTML comment, or a template comment tag.
	template: function( name, tmpl ) {
		if (tmpl) {
			// Compile template and associate with name
			if ( "" + tmpl === tmpl ) { // type string
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
				viewsNs.templates[ tmpl._name = tmpl._name || name || "_" + autoName++ ] = tmpl;
			}
			return tmpl;
		}
		// Return named compiled template
		return name
			? "" + name !== name
				? (name._name
					? name // already compiled
					: $.template( null, name ))
				: viewsNs.templates[ name ] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.template( null, htmlExpr.test( name ) ? name : try$( name ))
			: null;
	}
});

//===============
// Built-in tags
//===============

viewsNs.setDelimiters( "{{", "}}" );

viewsNs.registerTags({
	"if": function() {
		function ifArgs( args ) {
			var i = 0,
				l = args.length - 3
				hash = args[ l ]; // number of 'condition' parameters, since args are: (conditions..., hash, path, encoding
			while ( l > -1 && !args[ i++ ]) {
				// Only render content if args.length < 3 (i.e. this is an else with no condition) or if a condition argument is truey
				if ( i === l ) {
					return "";
				}
			}
			self.onElse = undefined;
			return render( hash._content, self.data, self.context, self);
		}
		var self = this;
		self.onElse = function() {
			return ifArgs( arguments );
		};
		return ifArgs( arguments );
	},
	"else": function() {
		return this.onElse ? this.onElse.apply( this, arguments ) : "";
	},
	each: function() {
		var result = "",
			args = arguments,
			i = 0,
			l = args.length - 3; // number of 'for' parameters, since args are: (for..., hash, path, encoding
			content = args[ l ]._content,
			path = args[ l + 1 ];
		for ( ; i < l; i++ ) {
			result += args[ i ] ? render( content, args[ i ], this.context, this, path ) : "";
		}
		return result;
	},
	"*": function( value ) {
		return value;
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
				(text + " ").replace( /([\w\$\.\[\]]+|(\\?['"])(.*?)\2)(?=\s)|([\w\$\.\[\]]+)\=([\w\$\.\[\]]+|\\(['"]).*?\\\6)(?=\s)/g,
					function( all, path, quot, string, lhs, rhs, quot2 ) {
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

// Note: In the case of the default delimiters {{}} tagRegex is:
//     {{     #   tag               =                code                           !encoding  endTag    {{/closeBlock}}
// /(?:\{\{(?:(\#)?(\w+(?=[\s\}!]))|(\=(?=[\s\w\$\[]))|\*((?:[^\}]|\}(?!\}))+)\}\}))|(!(\w*))?(\}\})|(?:\{\{\/([\w\$\.\[\]]+)\}\})/g;

	markup.replace( tagRegex, function( all, isBlock, tagName, singleCharTag, code, useEncode, encoding, endTag, closeBlock, index ) {
			tagName = tagName || singleCharTag;
			if ( inBlock && endTag || pushPreceedingContent( index )) {
				return;
			}
			if ( code ) {
				if ( viewsNs.allowCode ) {
					content.push([ "*", code.replace( /\\(['"])/g, "$1" )]);   // unescape ', and "
				}
			} else if ( tagName ) {
				if ( tagName === "else" ) {
					current = stack.pop();
					content = current[ 2 ];
					isBlock = TRUE;
				}
				stack.push( current );
				content.push( current = [ tagName, [], isBlock && 1] );
			} else if ( endTag ) {
				current[ 3 ] = useEncode ? encoding || "none" : "";
				if ( current[ 2 ] ) {
					current[ 2 ] = [];
				} else {
					current = stack.pop();
				}
			} else if ( closeBlock ) {
				current = stack.pop();
			}
			loc = index + all.length; // location marker - parsed up to here
			inBlock = !tagName && current[ 2 ] && current[ 2 ] !== 1;
			content = current[ inBlock ? 2 : 1 ];
		});

	pushPreceedingContent( markup.length );

	return buildTmplFunction( top );
}

// Build javascript compiled template function, from AST
function buildTmplFunction( nodes ) {
	var ret, content, node,
		chainingDepth = 0,
		nested = [],
		i = 0,
		l = nodes.length,
		code = "try{var views=" + (jQuery ? "jQuery" : "JsViews") + '.views,tag=views.renderTag,enc=views.encode,html=enc.html,\nresult=""+';

	function nestedCall( node, outParams ) {
		if ( "" + node === node ) { // type string
			return '"' + node + '"'; 
		}
		if ( node.length < 3 ) {
			// Named parameter
			key = (outParams[ 0 ] && ",") + node[ 0 ] + ":";
			outParams[ 0 ] += key + nestedCall( node[ 1 ]); // key:value for hash
			outParams[ 1 ] += key + node[ 1 ]; // key:path for hash
			return FALSE;
		}
		var codeFrag, tokens, j, k, ctx, val, hash, key, out,
			tag = node[ 0 ],
			params = node[ 1 ],
			encoding = node[ 3 ];
		if ( tag === "=" && params.length === 1 ) {
			if ( chainingDepth ) {
				// Using {{= }} at depth>0 is an error.
				return "''"; // Could throw...
			}
			params = params[ 0 ];
			if ( tokens = /^((?:\$view|\$data|\$(itemNumber)|\$(ctx))(?:$|\.))?[\w\.]*$/.exec( params )) {
				// Can optimize for perf and not go through call to renderTag()
				codeFrag = 
					(encoding
						? encoding === "none"
							? ""
							: "enc." + encoding
						: "html")  
					+ "(" + (tokens[ 1 ]
					? tokens[ 2 ] || tokens[ 3 ]
						? ('$view.' + params.slice( 1 )) // $itemNumber, $ctx -> $view.itemNumber, $view.ctx
						: params // $view, $data - unchanged
					: '$data.' + params) + "||'')"; // other paths -> $data.path
			} else {
				// Cannot optimize here. Must call renderTag() for processing, encoding etc.
				codeFrag = 'tag("=","' + params + '",$view,"' + encoding + '")';
			}
		} else {
			codeFrag = 'tag("' + tag + '",';
			chainingDepth++;
			out = [ "", "" ]; // out param
			for ( j = 0, k = params.length; j < k; j++ ) {
				val = nestedCall( params[ j ], out );
				codeFrag += val ? (val + ',') : "";
			}
			hash = out[ 0 ]; // key:value
			chainingDepth--;
			content = node[ 2 ];
			if( content ) {
				nested.push( buildTmplFunction( content ));
			}
			codeFrag += '$view,"'
				+ ( encoding
					? encoding
					: chainingDepth
						? "string"		// Default encoding for chained tags is "string"
						: "" ) + '"'
				+ (hash ? ",{ _hash:'{" + out[ 1 ] + "}'," + hash + "}" : "") // key:value pairs, plus _hash for key:path pairs  
				+ (content ? "," + nested.length : ""); // For block tags, pass in the key (nested.length) to the nested content template
			codeFrag += ')';
		}
		return codeFrag;
	}

	for ( ; i < l; i++ ) {
		node = nodes[ i ];
		if ( node[ 0 ] === "*" ) {
			code = code.slice( 0, -1 ) + ";" + node[ 1 ] + "result+=";
		} else {
			code += nestedCall( node ) + "+";
		}
	}
	ret = new Function( "$data, $view", code.slice( 0, -1) + ";}catch(e){result=" + (viewsNs.debugMode ? "e.message" : '""') + ";}\nreturn result;" );
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
