/*! JsRender v1.0pre: http://github.com/BorisMoore/jsrender */
/*
 * Optimized version of jQuery Templates, for rendering to string.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://github.com/BorisMoore/jsviews)
 * Copyright 2012, Boris Moore
 * Released under the MIT License.
 */
// informal pre beta commit counter: 3

this.jsviews || this.jQuery && jQuery.views || (function( window, undefined ) {

//========================== Top-level vars ==========================

var versionNumber = "v1.0pre",

	$, rTag, rTmplString, extend,
	sub = {},
	FALSE = false, TRUE = true,
	jQuery = window.jQuery,

	rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
	//                                 nil    object   helper    view  viewProperty pathTokens   leafToken     string

	rParams = /(\()(?=|\s*\()|(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
	//          lftPrn        lftPrn2                path    operator err                                                eq         path2       prn    comma   lftPrn2   apos quot        rtPrn   prn2   space
	// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space

    rNewLine = /\r?\n/g,
	rUnescapeQuotes = /\\(['"])/g,
	rEscapeQuotes = /\\?(['"])/g,
	rBuildHash = /\x08(~)?([^\x08]+)\x08/g,

	autoViewKey = 0,
	autoTmplName = 0,
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	tmplAttr = "data-jsv-tmpl",
	fnDeclStr = "var j=j||" + (jQuery ? "jQuery." : "js") + "views,",
	htmlSpecialChar = /[\x00"&'<>]/g,
	slice = Array.prototype.slice,

	render = {},

	// jsviews object ($.views if jQuery is loaded)
	jsv = {
		jsviews: versionNumber,
		sub: sub, // subscription, e.g. JsViews integration
		debugMode: TRUE,
		err: function( e ) {
			return jsv.debugMode ? ("<br/><b>Error:</b> <em> " + (e.message || e) + ". </em>") : '""';
		},
		tmplFn: tmplFn,
		render: render,
		templates: templates,
		tags: tags,
		helpers: helpers,
		converters: converters,
		View: View,
		convert: convert,
		delimiters: setDelimiters,
		tag: renderTag
	};

//========================== Top-level functions ==========================

//===================
// jsviews.delimiters
//===================

function setDelimiters( openChars, closeChars ) {
	// Set the tag opening and closing delimiters. Default is "{{" and "}}"
	// openChar, closeChars: opening and closing strings, each with two characters
	var firstOpenChar = "\\" + openChars.charAt( 0 ), // Escape the characters - since they could be regex special characters
		secondOpenChar = "\\" + openChars.charAt( 1 ),
		firstCloseChar = "\\" + closeChars.charAt( 0 ),
		secondCloseChar = "\\" + closeChars.charAt( 1 );
	// Build regex with new delimiters
	jsv.rTag = rTag // make rTag available to JsViews (or other components) for parsing binding expressions
		= secondOpenChar
			//          tag    (followed by / space or })   or  colon     or  html or code
		+ "(?:(?:(\\w+(?=[\\/\\s" + firstCloseChar + "]))|(?:(\\w+)?(:)|(>)|(\\*)))"
		//     params
		+ "\\s*((?:[^" + firstCloseChar + "]|" + firstCloseChar + "(?!" + secondCloseChar + "))*?)"
		//  slash or closeBlock
		+ "(\\/)?|(?:\\/(\\w+)))"
	//  }}
	+ firstCloseChar;

	// Default rTag:    tag          converter colon  html  code     params         slash   closeBlock
	//	    /{{(?:(?:(\w+(?=[\/\s\}]))|(?:(\w+)?(:)|(>)|(\*)))\s*((?:[^}]|}(?!\}))*?)(\/)?|(?:\/(\w+)))}}

	//      /{{(?:(?:(\w+(?=[\/!\s\}!]))|(?:(\w+)?(:)|(>)|(\*)))((?:[^\}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}/g;
	rTag = new RegExp( firstOpenChar + rTag + secondCloseChar, "g" );
	rTmplString = new RegExp( "<.*>|" + openChars + ".*" + closeChars );
	return this;
}

//=================
// View.hlp
//=================

function getHelper( helper ) {
	// Helper method called as view.hlp() from compiled template, for helper functions or template parameters ~foo
	var view = this,
	tmplHelpers = view.tmpl.helpers || {};
	helper = (view.ctx[ helper ] !== undefined ? view.ctx : tmplHelpers[ helper ] !== undefined ? tmplHelpers : helpers[ helper ] !== undefined ? helpers : {})[ helper ];
	return typeof helper !== "function" ? helper : function() {
		return helper.apply(view, arguments);
	};
}

//=================
// jsviews.convert
//=================

function convert( converter, view, text ) {
	var tmplConverters = view.tmpl.converters;
	converter = tmplConverters && tmplConverters[ converter ] || converters[ converter ];
	return converter ? converter.call( view, text ) : text;
}

//=================
// jsviews.tag
//=================

function renderTag( tag, parentView, converter, content, tagObject ) {
	// Called from within compiled template function, to render a nested tag
	// Returns the rendered tag
	tagObject.props = tagObject.props || {};
	var ret,
		tmpl = tagObject.props.tmpl,
		tmplTags = parentView.tmpl.tags,
		nestedTemplates = parentView.tmpl.templates,
		args = arguments,
		tagFn = tmplTags && tmplTags[ tag ] || tags[ tag ];

	if ( !tagFn ) {
		return "";
	}
	// Set the tmpl property to the content of the block tag, unless set as an override property on the tag
	content = content && parentView.tmpl.tmpls[ content - 1 ];
	tmpl = tmpl || content || undefined;
	tagObject.tmpl =
		"" + tmpl === tmpl // if a string
			? nestedTemplates && nestedTemplates[ tmpl ] || templates[ tmpl ] || templates( tmpl )
			: tmpl;

	tagObject.isTag = TRUE;
	tagObject.converter = converter;
	tagObject.view = parentView;
	tagObject.renderContent = renderContent;
	if ( parentView.ctx ) {
		extend( tagObject.ctx, parentView.ctx);
	}

	ret = tagFn.apply( tagObject, args.length > 5 ? slice.call( args, 5 ) : [] );
	return ret || ( ret == undefined ? "" : ret.toString()); // (If ret is the value 0 or false, will render to string)
}

//=================
// View constructor
//=================

function View( context, path, parentView, data, template, index ) {
	// Constructor for view object in view hierarchy. (Augmented by JsViews if JsViews is loaded)
	var views = parentView.views,
//	TODO: add this, as part of smart re-linking on existing content ($.link method), or remove completely
//			self = parentView.views[ index ];
//			if ( !self ) { ... }
		self = {
			tmpl: template,
			path: path,
			parent: parentView,
			data: data,
			ctx: context,
			views: $.isArray( data ) ? [] : {},
			hlp: getHelper
		};

	if ( $.isArray( views ))  {
		views.splice(
			self.index = index !== undefined
				? index
				: views.length, 0, self
		);
	} else {
		views[ self.index = "_" + autoViewKey++ ] = self;
	}
	return self;
}

//=================
// Registration
//=================

function addToStore( self, store, name, item, process ) {
	// Add item to named store such as templates, helpers, converters...
	var key, onStore;
	if ( name && typeof name === "object" && !name.nodeType ) {
		// If name is a map, iterate over map and call store for key
		for ( key in name ) {
			store( key, name[ key ]);
		}
		return self;
	}
	if ( !name || item === undefined ) {
		if ( process ) {
			item = process( undefined, item || name );
		}
	} else if ( "" + name === name ) { // name must be a string
		if ( item === null ) {
			// If item is null, delete this entry
			delete store[name];
		} else if ( item = process ? process( name, item ) : item ) {
			store[ name ] = item;
		}
	}
	if ( onStore = sub.onStoreItem ) {
		// e.g. JsViews integration
		onStore( store, name, item, process );
	}
	return item;
}

function templates( name, tmpl ) {
	// Register templates
	// Setter: Use $.view.tags( name, tagFn ) or $.view.tags({ name: tagFn, ... }) to add additional tags to the registered tags collection.
	// Getter: Use var tagFn = $.views.tags( name ) or $.views.tags[name] or $.views.tags.name to return the function for the registered tag.
	// Remove: Use $.view.tags( name, null ) to remove a registered tag from $.view.tags.

	// When registering for {{foo a b c==d e=f}}, tagFn should be a function with the signature:
	// function(a,b). The 'this' pointer will be a hash with properties c and e.
	return addToStore( this, templates, name, tmpl, compile );
}

function tags( name, tagFn ) {
	// Register template tags
	// Setter: Use $.view.tags( name, tagFn ) or $.view.tags({ name: tagFn, ... }) to add additional tags to the registered tags collection.
	// Getter: Use var tagFn = $.views.tags( name ) or $.views.tags[name] or $.views.tags.name to return the function for the registered tag.
	// Remove: Use $.view.tags( name, null ) to remove a registered tag from $.view.tags.

	// When registering for {{foo a b c==d e=f}}, tagFn should be a function with the signature:
	// function(a,b). The 'this' pointer will be a hash with properties c and e.
	return addToStore( this, tags, name, tagFn );
}

function helpers( name, helperFn ) {
	// Register helper functions for use in templates (or in data-link expressions if JsViews is loaded)
	// Setter: Use $.view.helpers( name, helperFn ) or $.view.helpers({ name: helperFn, ... }) to add additional helpers to the registered helpers collection.
	// Getter: Use var helperFn = $.views.helpers( name ) or $.views.helpers[name] or $.views.helpers.name to return the function.
	// Remove: Use $.view.helpers( name, null ) to remove a registered helper function from $.view.helpers.
	// Within a template, access the helper using the syntax: {{... ~myHelper(...) ...}}.
	return addToStore( this, helpers, name, helperFn );
}

function converters( name, converterFn ) {
	// Register converter functions for use in templates (or in data-link expressions if JsViews is loaded)
	// Setter: Use $.view.converters( name, converterFn ) or $.view.converters({ name: converterFn, ... }) to add additional converters to the registered converters collection.
	// Getter: Use var converterFn = $.views.converters( name ) or $.views.converters[name] or $.views.converters.name to return the converter function.
	// Remove: Use $.view.converters( name, null ) to remove a registered converter from $.view.converters.
	// Within a template, access the converter using the syntax: {{myConverter:...}}.
	return addToStore( this, converters, name, converterFn );
}

//=================
// renderContent
//=================

function renderContent( data, context, parentView, path, index ) {
	// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
	// tagName parameter for internal use only. Used for rendering templates registered as tags (which may have associated presenter objects)
	var i, l, dataItem, newView, itemWrap, itemsWrap, itemResult, parentContext, tmpl, layout,
		props = {},
		swapContent = index === TRUE,
		self = this,
		result = "";

	if ( self.isTag ) {
		// This is a call from renderTag
		tmpl = self.tmpl;
		context = context || self.ctx;
		parentView = parentView || self.view;
		path = path || self.path;
		index = index || self.index;
		props = self.props;
	} else {
		tmpl = self.jquery && self[0] // This is a call $.fn.render
			|| self; // This is a call from tmpl.render
	}
	parentView = parentView || jsv.topView;
	parentContext = parentView.ctx;
	layout = tmpl.layout;
	if ( data === parentView ) {
		// Inherit the data from the parent view.
		// This may be the contents of an {{if}} block
		data = parentView.data;
		layout = TRUE;
	}

	// Set additional context on views created here, (as modified context inherited from the parent, and be inherited by child views)
	// Note: If no jQuery, extend does not support chained copies - so limit extend() to two parameters
	context = (context && context === parentContext)
		? parentContext
		: (parentContext
			// if parentContext, make copy
			? ((parentContext = extend( {}, parentContext ), context)
				// If context, merge context with copied parentContext
				? extend( parentContext, context )
				: parentContext)
			// if no parentContext, use context, or default to {}
			: context || {});

	if ( props.link === FALSE ) {
		// Override inherited value of link by an explicit setting in props: link=false
		// The child views of an unlinked view are also unlinked. So setting child back to true will not have any effect.
		context.link = FALSE;
	}
	if ( !tmpl.fn ) {
		tmpl = templates[ tmpl ] || templates( tmpl );
	}
	itemWrap = context.link && sub.onRenderItem;
	itemsWrap = context.link && sub.onRenderItems;

	if ( tmpl ) {
		if ( $.isArray( data ) && !layout ) {
			// Create a view for the array, whose child views correspond to each data item.
			// (Note: if index and parentView are passed in along with parent view, treat as
			// insert -e.g. from view.addViews - so parentView is already the view item for array)
			newView = swapContent ? parentView : (index !== undefined && parentView) || View( context, path, parentView, data, tmpl, index );

			for ( i = 0, l = data.length; i < l; i++ ) {
				// Create a view for each data item.
				dataItem = data[ i ];
				itemResult = tmpl.fn( dataItem, View( context, path, newView, dataItem, tmpl, (index||0) + i ), jsv );
				result += itemWrap ? itemWrap( itemResult, props ) : itemResult;
			}
		} else {
			// Create a view for singleton data object.
			newView = swapContent ? parentView : View( context, path, parentView, data, tmpl, index );
			result += (data || layout) ? tmpl.fn( data, newView, jsv ) : "";
		}
		parentView.topKey = newView.index;
		return itemsWrap ? itemsWrap( result, path, newView.index, tmpl, props ) : result;
	}
	return ""; // No tmpl. Could throw...
}

//===========================
// Build and compile template
//===========================

// Generate a reusable function that will serve to render a template against data
// (Compile AST then build template function)

function syntaxError() {
	throw "Syntax error";
}

function tmplFn( markup, tmpl, bind ) {
	// Compile markup to AST (abtract syntax tree) then build the template function code from the AST nodes
	// Used for compiling templates, and also by JsViews to build functions for data link expressions
	var newNode, node, i, l, code, hasTag, hasEncoder, getsValue, hasConverter, hasViewPath, tag, converter, params, hash, nestedTmpl, allowCode,
		tmplOptions = tmpl ? {
			allowCode: allowCode = tmpl.allowCode,
			debug: tmpl.debug
		} : {},
		nested = tmpl && tmpl.tmpls,
		astTop = [],
		loc = 0,
		stack = [],
		content = astTop,
		current = [,,,astTop],
		nestedIndex = 0;

	//==== nested functions ====
	function pushPreceedingContent( shift ) {
		shift -= loc;
		if ( shift ) {
			content.push( markup.substr( loc, shift ).replace( rNewLine, "\\n" ));
		}
	}

	function parseTag( all, tagName, converter, colon, html, code, params, slash, closeBlock, index ) {
		//                  tag           converter colon  html  code     params         slash   closeBlock
		//      /{{(?:(?:(\w+(?=[\/!\s\}!]))|(?:(\w+)?(:)|(?:(>)|(\*)))((?:[^\}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}/g;
		// Build abstract syntax tree (AST): [ tagName, converter, params, content, hash, contentMarkup ]
		if ( html ) {
			colon = ":";
			converter = "html";
		}
		var hash = "",
			passedCtx = "",
			block = !slash && !colon; // Block tag if not self-closing and not {{:}} or {{>}} (special case)

		//==== nested helper function ====

		tagName = tagName || colon;
		pushPreceedingContent( index );
		loc = index + all.length; // location marker - parsed up to here
		if ( code ) {
			if ( allowCode ) {
				content.push([ "*", params.replace( rUnescapeQuotes, "$1" ) ]);
			}
		} else if ( tagName ) {
			if ( tagName === "else" ) {
				current[ 5 ] = markup.substring( current[ 5 ], index ); // contentMarkup for block tag
				current = stack.pop();
				content = current[ 3 ];
				block = TRUE;
			}
			params = (params
				? parseParams( params, bind )
					.replace( rBuildHash, function( all, isCtx, keyValue ) {
						if ( isCtx ) {
							passedCtx += keyValue + ",";
						} else {
							hash += keyValue + ",";
						}
						return "";
					})
				: "");
			hash = hash.slice( 0, -1 );
			params = params.slice( 0, -1 );
			newNode = [
				tagName,
				converter || "",
				params,
				block && [],
				"{" + (hash ? ("props:{" + hash + "},"): "") + "path:'" + params + "'" + (passedCtx ? ",ctx:{" + passedCtx.slice( 0, -1 ) + "}" : "") + "}"
			];
			if ( block ) {
				stack.push( current );
				current = newNode;
				current[ 5 ] = loc; // Store current location of open tag, to be able to add contentMarkup when we reach closing tag
			}
			content.push( newNode );
		} else if ( closeBlock ) {
			//if ( closeBlock !== current[ 0 ]) {
			//	throw "unmatched close tag: /" + closeBlock + ". Expected /" + current[ 0 ];
			//}
			current[ 5 ] = markup.substring( current[ 5 ], index ); // contentMarkup for block tag
			current = stack.pop();
		}
		if ( !current ) {
			throw "Expected block tag";
		}
		content = current[ 3 ];
	}
	//==== /end of nested functions ====

	markup = markup.replace( rEscapeQuotes, "\\$1" );

	// Build the AST (abstract syntax tree) under astTop
	markup.replace( rTag, parseTag );

	pushPreceedingContent( markup.length );

	// Use the AST (astTop) to build the template function
	l = astTop.length;
	code = (l ? "" : '"";');

	for ( i = 0; i < l; i++ ) {
		// AST nodes: [ tagName, converter, params, content, hash, contentMarkup ]
		node = astTop[ i ];
		if ( node[ 0 ] === "*" ) {
			code = code.slice( 0, i ? -1 : -3 ) + ";" + node[ 1 ] + (i + 1 < l ? "ret+=" : "");
		} else if ( "" + node === node ) { // type string
			code += '"' + node + '"+';
		} else {
			tag = node[ 0 ];
			converter = node[ 1 ];
			params = node[ 2 ];
			content = node[ 3 ];
			hash = node[ 4 ];
			markup = node[ 5 ];
			if ( content ) {
				// Create template object for nested template
				nestedTmpl = TmplObject( markup, tmplOptions, tmpl, nestedIndex++ );
				// Compile to AST and then to compiled function
				tmplFn( markup, nestedTmpl);
				nested.push( nestedTmpl );
			}
			hasViewPath = hasViewPath || hash.indexOf( "view" ) > -1;
			code += (tag === ":"
				? (converter === "html"
					? (hasEncoder = TRUE, "e(" + params)
					: converter
						? (hasConverter = TRUE, 'c("' + converter + '",view,' + params)
						: (getsValue = TRUE, "((v=" + params + ')!=u?v:""')
				)
				: (hasTag = TRUE, 't("' + tag + '",view,"' + (converter || "") + '",'
					+ (content ? nested.length : '""') // For block tags, pass in the key (nested.length) to the nested content template
					+ "," + hash + (params ? "," : "") + params))
					+ ")+";
		}
	}
	code =  new Function( "data, view, j, b, u", fnDeclStr
		+ (getsValue ? "v," : "")
		+ (hasTag ? "t=j.tag," : "")
		+ (hasConverter ? "c=j.convert," : "")
		+ (hasEncoder ? "e=j.converters.html," : "")
		+ "ret; try{\n\n"
		+ (tmplOptions.debug ? "debugger;" : "")
		+ (allowCode ? 'ret=' : 'return ')
		+ code.slice( 0, -1 ) + ";\n\n"
		+ (allowCode ? "return ret;" : "")
		+ "}catch(e){return j.err(e);}"
	);

	// Include only the var references that are needed in the code
	if ( tmpl ) {
		tmpl.fn = code;
		tmpl.useVw = hasConverter || hasViewPath || hasTag;
	}
	return code;
}

function parseParams( params, bind ) {
	var named,
		fnCall = {},
		parenDepth = 0,
		quoted = FALSE, // boolean for string content in double quotes
		aposed = FALSE; // or in single quotes

	function parseTokens( all, lftPrn0, lftPrn, path, operator, err, eq, path2, prn, comma, lftPrn2, apos, quot, rtPrn, prn2, space ) {
		// rParams = /(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
		//            lftPrn                  path    operator err                                                eq         path2       prn    comma   lftPrn3   apos quot        rtPrn   prn2   space
		// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space
		operator = operator || "";
		lftPrn = lftPrn || lftPrn0 || lftPrn2;
		path = path || path2;
		prn = prn || prn2 || "";
		operator = operator || "";

		function parsePath( all, object, helper, view, viewProperty, pathTokens, leafToken ) {
		// rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
		//                                        object   helper    view  viewProperty pathTokens   leafToken     string
			if ( object ) {
				var ret = (helper
					? 'view.hlp("' + helper + '")'
					: view
						? "view"
						: "data")
				+ (leafToken
					? (viewProperty
						? "." + viewProperty
						: helper
							? ""
							: (view ? "" : "." + object)
						) + (pathTokens || "")
					: (leafToken = helper ? "" : view ? viewProperty || "" : object, ""));

				if ( bind && prn !== "(" ) {
					ret = "b(" + ret + ',"' + leafToken + '")';
				}
				return ret + (leafToken ? "." + leafToken : "");
			}
			return all;
		}

		if ( err ) {
			syntaxError();
		} else {
			return (aposed
				// within single-quoted string
				? (aposed = !apos, (aposed ? all : '"'))
				: quoted
					// within double-quoted string
					? (quoted = !quot, (quoted ? all : '"'))
					:
				(
					(lftPrn
							? (parenDepth++, lftPrn)
							: "")
					+ (space
						? (parenDepth
							? ""
							: named
								? (named = FALSE, "\b")
								: ","
						)
						: eq
							// named param
							? (parenDepth && syntaxError(), named = TRUE, '\b' + path + ':')
							: path
								// path
								? (path.replace( rPath, parsePath )
									+ (prn
										? (fnCall[ ++parenDepth ] = TRUE, prn)
										: operator)
								)
								: operator
									? all
									: rtPrn
										// function
										? ((fnCall[ parenDepth-- ] = FALSE, rtPrn)
											+ (prn
												? (fnCall[ ++parenDepth ] = TRUE, prn)
												: "")
										)
										: comma
											? (fnCall[ parenDepth ] || syntaxError(), ",") // We don't allow top-level literal arrays or objects
											: lftPrn0
												? ""
												: (aposed = apos, quoted = quot, '"')
				))
			);
		}
	}
	params = (params + " " ).replace( rParams, parseTokens );
	return params;
}

function compile( name, tmpl, parent, options ) {
	// tmpl is either a template object, a selector for a template script block, the name of a compiled template, or a template object
	// options is the set of template properties, c
	var tmplOrMarkup, elem, key, nested, nestedItem;

	//==== nested functions ====
	function tmplOrMarkupFromStr( value ) {
		// If value is of type string - treat as selector, or name of compiled template
		// Return the template object, if already compiled, or the markup string

		if ( ("" + value === value) || value.nodeType > 0 ) {
			// If selector is valid and returns at least one element, get first element
			elem = value.nodeType > 0 ? value : !rTmplString.test( value ) && jQuery && jQuery( value )[0];
			if ( elem && elem.type ) {
				// It is a script element
				// Create a name for data linking if none provided
				value = templates[ elem.getAttribute( tmplAttr )];
				if ( !value ) {
					// Not already compiled and cached, so compile and cache the name
					name = name || "_" + autoTmplName++;
					elem.setAttribute( tmplAttr, name );
					value = compile( name, elem.innerHTML, parent, options ); // Use tmpl as options
					templates[ name ] = value;
				}
			}
			return value;
		}
		// If value is not a string or dom element, return undefined
	}

	//==== Compile the template ====
	tmplOrMarkup = tmplOrMarkupFromStr( tmpl );

	// If tmpl is a template object, use it for options
	options = options || (tmpl.markup ? tmpl : {});
	options.name = name;
	nested = options.templates;

	// If tmpl is not a markup string or a selector string, then it must be a template object
	// In that case, get it from the markup property of the object
	if ( !tmplOrMarkup && tmpl.markup && (tmplOrMarkup = tmplOrMarkupFromStr( tmpl.markup ))) {
		if ( tmplOrMarkup.fn && (tmplOrMarkup.debug !== tmpl.debug || tmplOrMarkup.allowCode !== tmpl.allowCode )) {
			// if the string references a compiled template object, but the debug or allowCode props are different, need to recompile
			tmplOrMarkup = tmplOrMarkup.markup;
		}
	}
	if ( tmplOrMarkup !== undefined ) {
		if ( name && !parent ) {
			render[ name ] = function() {
				return tmpl.render.apply( tmpl, arguments );
			};
		}
		if ( tmplOrMarkup.fn || tmpl.fn ) {
			// tmpl is already compiled, so use it, or if different name is provided, clone it
			if ( tmplOrMarkup.fn ) {
				if ( name && name !== tmplOrMarkup.name ) {
					tmpl = extend( extend( {}, tmplOrMarkup ), options);
				} else {
					tmpl = tmplOrMarkup;
				}
			}
		} else {
			// tmplOrMarkup is a markup string, not a compiled template
			// Create template object
			tmpl = TmplObject( tmplOrMarkup, options, parent, 0 );
			// Compile to AST and then to compiled function
			tmplFn( tmplOrMarkup, tmpl );
		}
		for ( key in nested ) {
			// compile nested template declarations
			nestedItem = nested[ key ];
			if ( nestedItem.name !== key ) {
				nested[ key ] = compile( key, nestedItem, tmpl );
			}
		}
		return tmpl;
	}
}
//==== /end of function compile ====

function TmplObject( markup, options, parent, index ) {
	// Template object constructor

	// nested helper function
	function extendStore( storeName ) {
		if ( parent[ storeName ]) {
			// Include parent items except if overridden by item of same name in options
			tmpl[ storeName ] = extend( extend( {}, parent[ storeName ] ), options[ storeName ] );
		}
	}

	options = options || {};
	var tmpl = {
			markup: markup,
			tmpls: [],
			links: [],
			render: renderContent
		};
	if ( parent ) {
		if ( parent.templates ) {
			tmpl.templates = extend( extend( {}, parent.templates ), options.templates );
		}
		tmpl.parent = parent;
		tmpl.name = parent.name + "[" + index + "]";
		tmpl.index = index;
	}

	extend( tmpl, options );
	if ( parent ) {
		extendStore( "templates" );
		extendStore( "tags" );
		extendStore( "helpers" );
		extendStore( "converters" );
	}
	return tmpl;
}

//========================== Initialize ==========================

if ( jQuery ) {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is loaded, so make $ the jQuery object
	$ = jQuery;
	$.templates = templates;
	$.render = render;
	$.views = jsv;
	$.fn.render = renderContent;

} else {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is not loaded.

	$ = window.jsviews = jsv;
	$.extend = function( target, source ) {
		var name;
		target =  target || {};
		for ( name in source ) {
			target[ name ] = source[ name ];
		}
		return target;
	};

	$.isArray = Array && Array.isArray || function( obj ) {
		return Object.prototype.toString.call( obj ) === "[object Array]";
	};
}

extend = $.extend;

jsv.topView = { views: {}, tmpl: {}, hlp: getHelper, ctx: jsv.helpers };

function replacerForHtml( ch ) {
	// Original code from Mike Samuel <msamuel@google.com>
	return escapeMapForHtml[ ch ]
		// Intentional assignment that caches the result of encoding ch.
		|| (escapeMapForHtml[ ch ] = "&#" + ch.charCodeAt( 0 ) + ";");
}

//========================== Register tags ==========================

tags({
	"if": function() {
		var ifTag = this,
			view = ifTag.view;

		view.onElse = function( tagObject, args ) {
			var i = 0,
				l = args.length;

			while ( l && !args[ i++ ]) {
				// Only render content if args.length === 0 (i.e. this is an else with no condition) or if a condition argument is truey
				if ( i === l ) {
					return "";
				}
			}
			view.onElse = undefined; // If condition satisfied, so won't run 'else'.
			tagObject.path = "";
			return tagObject.renderContent( view );
			// Test is satisfied, so render content, while remaining in current data context
			// By passing the view, we inherit data context from the parent view, and the content is treated as a layout template
			// (so if the data is an array, it will not iterate over the data
		};
		return view.onElse( this, arguments );
	},
	"else": function() {
		var view = this.view;
		return view.onElse ? view.onElse( this, arguments ) : "";
	},
	"for": function() {
		var i,
			self = this,
			result = "",
			args = arguments,
			l = args.length;
		if ( self.props.layout ) {
			self.tmpl.layout = TRUE;
		}
		for ( i = 0; i < l; i++ ) {
			result += self.renderContent( args[ i ]);
		}
		return result;
	},
	"=": function( value ) {
		return value;
	},
	"*": function( value ) {
		return value;
	}
});

//========================== Register global helpers ==========================

//	helpers({ // Global helper functions
//		// TODO add any useful built-in helper functions
//	});

//========================== Register converters ==========================

converters({
	html: function( text ) {
		// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
		// inspired by Mike Samuel <msamuel@google.com>
		return text != undefined ? String( text ).replace( htmlSpecialChar, replacerForHtml ) : "";
	}
});

//========================== Define default delimiters ==========================
setDelimiters( "{{", "}}" );

})( this );
