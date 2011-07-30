/*!
 * jQuery Render Plugin v1.0pre
 * Optimized version of jQuery Templates, for rendering to string
 * http://github.com/BorisMoore/jsrender
 */

(function( $, undefined ) {
var htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
	viewKey = 0, 
	stack = [], 
	autoName = 0,
	defaultOpen = "$view.calls($view,__,$1,$2);__=[];",
	defaultClose = ["call=$view.calls();__=call[1].concat($view.", "(call,__));"],
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	htmlSpecialChar = /[\x00"&'<>]/g;

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
		tmpl: tmplFn || null,
		_wrap: parentView._wrap
	});

	setViewContext( self, context );

	if ( tmplFn ) {
		// Build the hierarchical content of strings, by executing the compiled template function
		content = self.tmpl( $, self );
//annotate = !!$.view; // TEMPORARY - make extensible and configurable
		self._ctnt = ( !!$.view && $.isArray( parentView.data )) ? [].concat( "<!--item-->", content, "<!--/item-->" ) : content;
		self.key = ++viewKey;
	}
}
$.fn.extend({
	// Use first wrapped element as template markup.
	// Return string obtained by rendering the template against data.
	render: function( data, context, parentView ) {
		return $.render( this[0], data, context, parentView );
	},

	// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
	template: function( name, context ) {
		return $.template( name, this[0], context );
	}
});

function try$( selector ) {
	// If selector is valid, return jQuery object, otherwise return (invalid) selector string
	try {
		return $( selector );
	} catch( e) {}
	return selector;
}

$.extend({
	// Return string obtained by rendering template against data.
	render: function( tmpl, data, context, parentView, topLevel ) {
		var ret = renderViews( tmpl, data, context, parentView, topLevel );
		ret = ( !topLevel && parentView && tmpl) ? ret : buildStringArray( parentView, ret ).join("");
		viewKey = 0;
		return ret;
	},

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
			if ( typeof tmpl === "string" ) {
				// This is an HTML string being passed directly in.
				tmpl = buildTmplFn( tmpl );
			} else if ( tmpl instanceof $ ) {
				tmpl = tmpl[0];
			}
			if ( tmpl ) {
				if ( tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = $.data( tmpl, "tmpl" ) || $.data( tmpl, "tmpl", buildTmplFn( tmpl.innerHTML ));
				}
				$.template[ tmpl._name = tmpl._name || name || "_" + autoName++ ] = tmpl;
			}
			return tmpl;
		}
		// Return named compiled template
		return name
			? typeof name !== "string"
				? $.template( null, name )
				: $.template[name] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.template( null, htmlExpr.test( name ) ? name : try$( name ))
			: null;
	},

	encode: function( text ) {
		// Do HTML encoding replacing < > & and ' and " by corresponding entities.
		// Implementation, from Mike Samuel <msamuel@google.com>
		return text === undefined
			? "" : String( text ).replace( htmlSpecialChar, replacerForHtml );
	},

	// The following substitution terms can be uses in template tag definitions:
	// $1 is the target parameter - as in {{if targetParam}}
	// $1a is the target parameter as above, but with automatic detection of functions, so if targetParam is a function it will
	// be replaced by its return value during rendering
	// $2 is the comma-separated list of additional function parameters as in {{tmpl(functionParams) targetParam}}
	// $2s is the string corresponding to the comma-separated list of additional function parameters,
	// so with {{tmpl(param1, param2) targetParam}} it will be the string "param1, param2"
	tmplSettings: {
		tag: {
			"tmpl": {
				_default: { $2: "null" },
				open: "if($notnull_1){__=__.concat($view.nest($1,$2s,$2));}"
				// tmpl target parameter can be of type function, so use $1, not $1a (so not auto detection of functions)
				// This means that {{tmpl foo}} treats foo as a template (which IS a function).
				// Explicit parens can be used if foo is a function that returns a template: {{tmpl foo()}}.
			},
			"wrap": {
				_default: { $2: "null" },
				open: defaultOpen,
				close: defaultClose.join( "wrap" )
			},
			"each": {
				_default: { $2: "$index, $value" },
				open: "if($notnull_1){$.each($1a,function($2){with(this){",
				close: "}});}"
			},
			"if": {
				open: "if(($notnull_1) && $1a){",
				close: "}"
			},
			"else": {
				_default: { $1: "true" },
				open: "}else if(($notnull_1) && $1a){"
			},
			"html": {
				// Unencoded expression evaluation.
				open: "if($notnull_1){__.push($1a);}"
			},
			":": {
				// Code execution
				open: "$1"
			},
			"=": {
				// Encoded expression evaluation. Abbreviated form is ${}.
				_default: { $1: "$data" },
				open: "if($notnull_1){__.push($.encode($1a));}"
			},
			"!": {
				// Comment tag. Skipped by parser
				open: ""
			}
		},

		view: {
			tmpl: null,
			nodes: [],
			calls: function( content ) {
				if ( !content ) {
					return stack.pop();
				}
				stack.push( arguments );
			},
			nest: function( tmpl, paramString, data, context ) {
				// nested template, using {{tmpl}} tag
				return renderViews( tmpl, data, context, this, paramString );
			},
			wrap: function( call, wrapped ) {
				// nested template, using {{wrap}} tag
				call[0]._wrapped = wrapped; // Add to view
				// Apply the template, which may incorporate wrapped content,
				return $.render( $.template( call[2] ), call[3], call[4], call[0] ); // tmpl, data, context, view
			},
			html: function( filter, textOnly ) {
				var wrapped = this._wrap;
				return $.map(
					$( $.isArray( wrapped ) ? wrapped.join("") : wrapped ).filter( filter || "*" ),
					function(e) {
						return textOnly ?
							e.innerText || e.textContent :
							e.outerHTML || outerHtml(e);
					});
			}
		}
	}
});

var tags = $.tmplSettings.tag;

View.prototype = $.tmplSettings.view;

//========================== Private helper functions, used by code above ==========================

function renderViews( tmpl, data, context, parentView, path ) {
	// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
	var arrayView, ret, wrapped;

	if ( tmpl ) {
		tmpl  = $.template( tmpl );
		if ( !$.isFunction( tmpl ) ) {
			tmpl = $.template[tmpl] || $.template( null, tmpl );
		}
	}
	if ( !tmpl ) {
		return null; // Could throw...
	}
	if ( typeof data === "function" ) {
		data = data.call( parentView || {} );
	}
	if ( parentView && parentView._wrapped ) {
		// Build the wrapped content.
		wrapped = parentView._wrapped;
		parentView._wrap = buildStringArray( parentView,
			// Suport imperative scenario in which context.wrapped can be set to a selector or an HTML string.
			$.isArray( wrapped ) ? wrapped : [htmlExpr.test( wrapped ) ? wrapped : $( wrapped ).html()]
		).join("");
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
				: buildStringArray( view, view._ctnt );
			})

		// If content is not defined, return view directly. Not a view. May be a string, or a string array, e.g. from {{html $view.html()}}.
		: view || [];
}

// Generate a reusable function that will serve to render a template against data
function buildTmplFn( markup ) {
	var regExShortCut = /\$\{([^\}]*)\}/g,

		code = "var call,__=[],$data=$view.data,$ctx=$view.ctx||{};" +

		// Introduce the data as local variables using with(){}
		"with($data){__.push('" +

		// Convert the template into pure JavaScript
		$.trim(markup)
			.replace( /([\\'])/g, "\\$1" )
			.replace( /[\r\t\n]/g, " " )  // TODO This can now be removed, or made optional, for a 'preserve white-space mode
			.replace( regExShortCut, "{{= $1}}" )
			.replace( /\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*)\))?\s*\}\}/g,
			function( all, slash, type, fnargs, target, parens, args ) {
				var tag = tags[ type ], def, expr, exprAutoFnDetect;
				def = tag._default || [];
				if ( parens && !/\w$/.test(target)) {
					target += parens;
					parens = "";
				}
				if ( target ) {
					target = unescape( target );
					args = args ? ("," + unescape( args ) + ")") : (parens ? ")" : "");
					// Support for target being things like a.toLowerCase();
					// In that case don't call with view as 'this' pointer. Just evaluate...
					expr = parens ? (target.indexOf(".") > -1 ? target + unescape( parens ) : ("(" + target + ").call($view" + args)) : target;
					exprAutoFnDetect = parens ? expr : "(typeof(" + target + ")==='function'?(" + target + ").call($view):(" + target + "))";
				} else {
					exprAutoFnDetect = expr = def.$1 || "null";
				}
				fnargs = unescape( fnargs );
				return "');" +
					tag[ slash ? "close" : "open" ]
						.split( "$notnull_1" ).join( target ? "typeof(" + target + ")!=='undefined' && (" + target + ")!=null" : "true" )
						.split( "$1a" ).join( exprAutoFnDetect )
						.split( "$2s" ).join( "'" + fnargs + "'" )  // This means fnargs must not include single quotes!! // TODO Optimize for perf later...
						.split( "$1" ).join( expr )
						.split( "$2" ).join( fnargs || def.$2 || "" ) +
					"__.push('";
			}) +
		"');}return __;";
	return new Function( "$","$view", code );
}

function unescape( args ) {
	return args ? args.replace( /\\'/g, "'").replace(/\\\\/g, "\\" ) : null;
}

function outerHtml( elem ) {
	var div = document.createElement( "div" );
	div.appendChild( elem.cloneNode( true ));
	return div.innerHTML;
}
})( jQuery );
