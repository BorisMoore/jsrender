/*!
 * jQuery Render Plugin v1.0pre
 * Optimized version of jQuery Templates, for rendering to string
 * http://github.com/BorisMoore/jsrender
 */

(function( $, undefined ) {
	var oldManip = $.fn.domManip, htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
		viewKey = 0, stack = [], autoName = 0,
		defaultOpen = "$view.calls($view,__,$1,$2);__=[];",
		defaultClose = ["call=$view.calls();__=call[1].concat($view.", "(call,__));"];

	function View( options, parentView, tmplFn, data ) { //, index ) {
		// Returns a view data structure for a new rendered instance of a template.
		// The content field is a hierarchical array of strings and nested views.
		// Prototype is $.tmplSettings.view, which provides both methods and fields.

		var self = this,
			annotate = !!$.view || ( parentView||options ).annotate; // Temporary. Need to provide callout that JsViews can use to insert annotations
		self.parent = parentView || null;
		parentView = parentView || {};
		options.path = options.path || "~";
		$.extend( self, options, {
			data: data || parentView.data || {},
			annotate: annotate,
			tmpl: tmplFn || null,
			_wrap: parentView._wrap
		});

		if ( tmplFn ) {
			// Build the hierarchical content to be used during insertion into DOM
			content = self.tmpl( $, self );
			self._ctnt = ( annotate && $.isArray( parentView.data )) ? [].concat( "<!--item-->", content, "<!--/item-->" ) : content;
			self.key = ++viewKey;
		}
	}
	$.fn.extend({
		// Use first wrapped element as template markup.
		// Return string obtained by rendering the template against data.
		render: function( data, options, parentView ) {
			return $.render( this[0], data, options, parentView );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		template: function( name, options ) {
			return $.template( name, this[0], options );
		}
	});

	$.extend({
		// Return string obtained by rendering template against data.
		render: function( tmpl, data, options, parentView ) {
			var ret = renderTemplate( tmpl, data, options, parentView );
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
		// If templateString includes at least one HTML tag, $.template( templateString ) is equivalent
		// to $.template( null, templateString )
		template: function( name, tmpl ) {
			if (tmpl) {
				// Compile template and associate with name
				if ( typeof tmpl === "string" ) {
					// This is an HTML string being passed directly in.
					tmpl = buildTmplFn( tmpl )
				} else if ( tmpl instanceof $ ) {
					tmpl = tmpl[0] || null; // WAS || {};
				}
				if ( tmpl && tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = $.data( tmpl, "tmpl" ) || $.data( tmpl, "tmpl", buildTmplFn( tmpl.innerHTML ));
				}
				tmpl._name = tmpl._name || "_" + autoName++;
				return $.template[ tmpl._name ] = tmpl;
			}
			// Return named compiled template
			return name ? (typeof name !== "string" ? $.template( null, name ):
				($.template[name] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.template( null, htmlExpr.test( name ) ? name : $( name )))) : null;
		},

		encode: function( text ) {
			// Do HTML encoding replacing < > & and ' and " by corresponding entities.
			return ("" + text).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
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
				nest: function( tmpl, paramString, data, options ) {
					// nested template, using {{tmpl}} tag
					options = options || {};
					options.path = paramString;
					var ret = renderViews( $.template( tmpl ), data, options, this );
					return ret;

				},
				wrap: function( call, wrapped ) {
					// nested template, using {{wrap}} tag
					var options = call[4] || {};
					options.wrapped = wrapped;
					// Apply the template, which may incorporate wrapped content,
					return $.render( $.template( call[2] ), call[3], options, call[0] ); // tmpl, data, options, view
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

	var tags = $.tmplSettings.tag,
		pluginsWrapperTmpl = $.template( null, "{{html this.html()}}" );

	View.prototype = $.tmplSettings.view;

	//========================== Private helper functions, used by code above ==========================

	function renderTemplate( tmpl, data, options, parentView ) {
		var ret = renderViews( tmpl, data, options, parentView );
		return (parentView && tmpl) ? ret : buildStringArray( parentView, ret ).join("");
	}

	function renderViews( tmpl, data, options, parentView ) {
		// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
		options = options || {};
		options.annotate = options.annotate || !!$.view; // Temporary. Need to provide callout that JsViews can use to insert annotations
		var arrayView, ret, topLevel = !parentView;
		if ( topLevel ) {
			// This is a top-level tmpl call (not from a nested template using {{tmpl}})
//			parentView = topView;
			if ( !$.isFunction( tmpl ) ) {
				tmpl = $.template[tmpl] || $.template( null, tmpl );
			}
//			wrappedViews = {}; // Any wrapped views will be rebuilt, since this is top level
		} else if ( !tmpl ) {
			// The view is already associated with DOM - this is a refresh.
			// Re-evaluate rendered template for the parentView
			tmpl = parentView.tmpl;
//			newViews[parentView.key] = parentView;
			parentView.nodes = [];
			if ( parentView.wrapped ) {
				updateWrapped( parentView, parentView.wrapped );
			}
			// Rebuild, without creating a new view
			return parentView.tmpl( $, parentView );
		}
		if ( !tmpl ) {
			return null; // Could throw...
		}
	//	options =  $.extend( {}, options, tmpl )
		if ( typeof data === "function" ) {
			data = data.call( parentView || {} );
		}
		if ( options.wrapped ) {
			updateWrapped( options, options.wrapped );
			if ( options.addIds ) {
				// TEMPORARY?
				tmpl = $.template( null, options._wrap );
				options._wrap = null;
				options.wrapped = null;
				delete options.addIds;
			}
		}
//		if ( $.isArray( data )) {
//			arrayView = new View( options, parentView, null, data );
//			return $.map( data, function( dataItem ) {
//				options.path = "*";
//				return dataItem ? new View( options, arrayView, tmpl, dataItem ) : null;
//			})
//		}
//		return [ new View( options, parentView, tmpl, data ) ];

		if ( $.isArray( data )) {
			arrayView = new View( options, parentView, null, data );
			ret = $.map( data, function( dataItem ) {
				options.path = "*";
				return dataItem ? new View( options, arrayView, tmpl, dataItem ) : null;
			})
		} else {
			ret = [ new View( options, parentView, tmpl, data ) ];
		}
		return ( parentView || options ).annotate
			? [].concat(
				"<!--tmpl(" + (arrayView||ret[0]).path + ") " + tmpl._name + "-->", //+ tmpl._name + ":"
				ret,
				"<!--/tmpl-->" )
			: ret;
	}

	function buildStringArray( view, content ) {
		// Convert hierarchical content (tree of nested views) into flat string array of rendered content
		// (optionally with attribute annotations for views)
		// Add data-jq-path attribute to top-level elements (if any) of the rendered view...

		var annotate = view && view.annotate;

		return content
			? $.map( content, function( view ) {
				return (typeof view === "string")
					? view
					: buildStringArray( view, view._ctnt );
				})

			// If content is not defined, return view directly. Not a view. May be a string, or a string array, e.g. from {{html $view.html()}}.
			: view;
	}

	function jqObjectWithTextNodes( content ) {
		// take string content and create jQuery wrapper, including initial or final text nodes
		// Also support HTML entities within the HTML markup.
		var ret;
		content.replace( /^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/, function( all, before, middle, after) {
			ret = $( middle );
			if ( before || after ) {
				ret = ret.get();
				if ( before ) {
					ret = unencode( before ).concat( ret );
				}
				if ( after ) {
					ret = ret.concat(unencode( after ));
				}
				ret = $( ret );
			}
		});
		return ret || $();
	}

	function unencode( text ) {
		// Use createElement, since createTextNode will not render HTML entities correctly
		var el = document.createElement( "div" );
		el.innerHTML = text || "";
		return $.makeArray(el.childNodes);
	}

	// Generate a reusable function that will serve to render a template against data
	function buildTmplFn( markup ) {
		var regExShortCut = /\$\{([^\}]*)\}/g;

		var code = "var $=jQuery,call,__=[],$data=$view.data;" +

			// Introduce the data as local variables using with(){}
			"with($data){__.push('" +

			// Convert the template into pure JavaScript
			$.trim(markup)
				.replace( /([\\'])/g, "\\$1" )
				.replace( /[\r\t\n]/g, " " )
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
							.split( "$2s" ).join( "'" + fnargs + "'" )  // TODO Optimize for perf later...
							.split( "$1" ).join( expr )
							.split( "$2" ).join( fnargs || def.$2 || "" ) +
						"__.push('";
					return test;
				}) +
			"');}return __;"
		return new Function( "jQuery","$view", code );
	}

	function updateWrapped( options, wrapped ) {
		// Build the wrapped content.
		options._wrap = buildStringArray( options,
			// Suport imperative scenario in which options.wrapped can be set to a selector or an HTML string.
			$.isArray( wrapped ) ? wrapped : [htmlExpr.test( wrapped ) ? wrapped : $( wrapped ).html()]
		).join("");
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
