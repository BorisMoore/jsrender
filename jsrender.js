/*! JsRender v1.0pre: http://github.com/BorisMoore/jsrender */
/*
* Optimized version of jQuery Templates, for rendering to string.
* Does not require jQuery, or HTML DOM
* Integrates with JsViews (http://github.com/BorisMoore/jsviews)
* Copyright 2012, Boris Moore
* Released under the MIT License.
*/
// informal pre beta commit counter: 20

this.jsviews || this.jQuery && jQuery.views || (function(global, undefined) {

	//========================== Top-level vars ==========================

	var versionNumber = "v1.0pre",

		$, rTag, rTmplString, $extend,
		delimOpenChar0 = "{", delimOpenChar1 = "{", delimCloseChar0 = "}", delimCloseChar1 = "}",
		$viewsSub = {},
		FALSE = false, TRUE = true,
		jQuery = global.jQuery,

		rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
		//                               nil   object   helper    view  viewProperty pathTokens   leafToken     string

		rParams = /(\()(?=|\s*\()|(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
		//          lftPrn        lftPrn2                path    operator err                                                eq         path2       prn    comma   lftPrn2   apos quot        rtPrn   prn2   space
		// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space

		rNewLine = /\r?\n/g,
		rUnescapeQuotes = /\\(['"])/g,
		rEscapeQuotes = /\\?(['"])/g,
		rBuildHash = /\x08(~)?([^\x08]+)\x08/g,

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

		$render = {},

		// jsviews object ($.views if jQuery is loaded)
		$views = {
			jsviews: versionNumber,
			sub: $viewsSub, // subscription, e.g. JsViews integration
			debugMode: TRUE,
			render: $render,
			templates: $templates,
			tags: $viewsTags,
			helpers: $viewsHelpers,
			converters: $viewsConverters,
			delimiters: $viewsDelimiters,
			View: View,
			_convert: convert,
			_err: function(e) {
				return $views.debugMode ? ("Error: " + (e.message || e)) + ". " : '""';
			},
			_tmplFn: tmplFn,
			_tag: renderTag,
			error: error,
			Error: JsViewsError
		};

		function JsViewsError(message) { // Error exception type for JsViews/JsRender
			this.name = "JsRender Error",
			this.message = message || "JsRender error"
		}

		(JsViewsError.prototype = new Error()).constructor = JsViewsError;
	//========================== Top-level functions ==========================

	//===================
	// jsviews.delimiters
	//===================

	function $viewsDelimiters(openChars, closeChars) {
		// Set the tag opening and closing delimiters. Default is "{{" and "}}"
		// openChar, closeChars: opening and closing strings, each with two characters

		if (!$views.rTag || arguments.length) {
			delimOpenChar0 = openChars ? "\\" + openChars.charAt(0) : delimOpenChar0; // Escape the characters - since they could be regex special characters
			delimOpenChar1 = openChars ? "\\" + openChars.charAt(1) : delimOpenChar1;
			delimCloseChar0 = closeChars ? "\\" + closeChars.charAt(0) : delimCloseChar0;
			delimCloseChar1 = closeChars ? "\\" + closeChars.charAt(0) : delimCloseChar1;

			// Build regex with new delimiters
			$views.rTag = rTag // make rTag available to JsViews (or other components) for parsing binding expressions
				//          tag    (followed by / space or })   or cvtr+colon or html or code
				= "(?:(?:(\\w+(?=[\\/\\s" + delimCloseChar0 + "]))|(?:(\\w+)?(:)|(>)|(\\*)))"
				//     params
				+ "\\s*((?:[^" + delimCloseChar0 + "]|" + delimCloseChar0 + "(?!" + delimCloseChar1 + "))*?)";

			//                                         slash or closeBlock           }}
			rTag = new RegExp(delimOpenChar0 + delimOpenChar1 + rTag + "(\\/)?|(?:\\/(\\w+)))" + delimCloseChar0 + delimCloseChar1, "g");

			// Default rTag:    tag      converter colon html code     params            slash   closeBlock
			//    /{{(?:(?:(\w+(?=[\/\s}]))|(?:(\w+)?(:)|(>)|(\*)))\s*((?:[^}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}

			rTmplString = new RegExp("<.*>|([^\\\\]|^)[{}]|" + delimOpenChar0 + delimOpenChar1 + ".*" + delimCloseChar0 + delimCloseChar1);
			// rTmplString looks for html tags or { or } char not preceeded by \\, or JsRender tags {{xxx}}. Each of these strings are considered NOT to be jQuery selectors
		}
		return [delimOpenChar0, delimOpenChar1, delimCloseChar0, delimCloseChar1];
	}

	//=================
	// View._hlp
	//=================

	function getHelper(helper) {
		// Helper method called as view._hlp() from compiled template, for helper functions or template parameters ~foo
		var view = this,
			tmplHelpers = view.tmpl.helpers || {};

		helper = (
			view.ctx[helper] !== undefined
				? view.ctx
				: tmplHelpers[helper] !== undefined
					? tmplHelpers
					: $viewsHelpers[helper] !== undefined
						? $viewsHelpers
						: {}
		)[helper];
		return typeof helper !== "function" ? helper : function() {
			return helper.apply(view, arguments);
		};
	}

	//=================
	// jsviews._convert
	//=================

	function convert(converter, view, tmpl, text) {
		var tmplConverter = tmpl.converters;
		tmplConverter = tmplConverter && tmplConverter[converter] || $viewsConverters[converter];
		return tmplConverter ? tmplConverter.call(view, text) : (error("Unknown converter: {{"+ converter + ":"), text);
	}

	//=================
	// jsviews._tag
	//=================

	function renderTag(tag, parentView, parentTmpl, converter, content, tagInstance) {
		// Called from within compiled template function, to render a nested tag
		// Returns the rendered tag
		var ret,
			tmplTags = parentTmpl.tags,
			nestedTemplates = parentTmpl.templates,
			props = tagInstance.props = tagInstance.props || {},
			tmpl = props.tmpl,
			args = arguments.length > 6 ? slice.call(arguments, 6) : [],
			tagFn = tmplTags && tmplTags[tag] || $viewsTags[tag];

		if (!tagFn) {
			error("Unknown tag: {{"+ tag + "}}");
			return "";
		}
		if (tmpl) {
			// We don't want to expose tmpl as a prop to view context in rendered content
			delete props.tmpl;
		}

		// Set the tmpl property to the content of the block tag, unless set as an override property on the tag
		content = content && parentTmpl.tmpls[content - 1];
		tmpl = tmpl || content || undefined;

		tagInstance.tmpl =
			"" + tmpl === tmpl // if a string
				? nestedTemplates && nestedTemplates[tmpl] || $templates[tmpl] || $templates(tmpl)
				: tmpl;

		tagInstance.isTag = TRUE;
		tagInstance.converter = converter;
		tagInstance.view = parentView;
		tagInstance.renderContent = renderContent;

		ret = tagFn.apply(tagInstance, args);
		return ret || (ret == undefined ? "" : ret.toString()); // (If ret is the value 0 or false, will render to string)
	}

	//=================
	// View constructor
	//=================

	function View(context, path, parentView, data, template, key, onRender, isArray) {
		// Constructor for view object in view hierarchy. (Augmented by JsViews if JsViews is loaded)
		var views,
			self = {
				tmpl: template,
				path: path,
				parent: parentView,
				data: data,
				ctx: context,
				// If the data is an array, this is an 'Array View' with a views array for each child 'Instance View'
				// If the data is not an array, this is an 'Instance View' with a views 'map' object for any child nested views
				views: isArray ? [] : {},
				// _useKey is non zero if is not an 'Array View' (owning a data array). Uuse this as next key for adding to child views map
				_useKey: isArray ? 0 : 1,
				_hlp: getHelper,
				_onRender: onRender
			};

		if (parentView) {
			views = parentView.views;
			if (parentView._useKey) {
				// Parent is an 'Instance View'. Add this view to its views object
				// self.key = is the key in the parent view map
				views[self.key = "_" + parentView._useKey++] = self;
				// self.index = is index of the parent
				self.index = parentView.index;
			} else {
				// Parent is an 'Array View'. Add this view to its views array
				views.splice(
				// self.key = self.index - the index in the parent view array
				self.key = self.index = key !== undefined
					? key
					: views.length,
				0, self);
			}
		}
		return self;
	}

	//=================
	// Registration
	//=================

	function addToStore(self, store, name, item, process) {
		// Add item to named store such as templates, helpers, converters...
		var key, onStore;
		if (name && typeof name === "object" && !name.nodeType) {
			// If name is a map, iterate over map and call store for key
			for (key in name) {
				store(key, name[key]);
			}
			return self;
		}
		if (!name || item === undefined) {
			if (process) {
				item = process(undefined, item || name);
			}
		} else if ("" + name === name) { // name must be a string
			if (item === null) {
				// If item is null, delete this entry
				delete store[name];
			} else if (item = process ? process(name, item) : item) {
				store[name] = item;
			}
		}
		if (onStore = $viewsSub.onStoreItem) {
			// e.g. JsViews integration
			onStore(store, name, item, process);
		}
		return item;
	}

	function $templates(name, tmpl) {
		// Register templates
		// Setter: Use $.templates( name, tmpl ) or $.templates({ name: tmpl, ... }) to add additional templates to the registered templates collection.
		// Getter: Use var tmpl = $.templates( name ) or $.templates[name] or $.templates.name to return the object for the registered template.
		// Remove: Use $.templates( name, null ) to remove a registered template from $.templates.
		return addToStore(this, $templates, name, tmpl, compile);
	}

	function $viewsTags(name, tagFn) {
		// Register template tags
		// Setter: Use $.view.tags( name, tagFn ) or $.view.tags({ name: tagFn, ... }) to add additional tags to the registered tags collection.
		// Getter: Use var tagFn = $.views.tags( name ) or $.views.tags[name] or $.views.tags.name to return the object for the registered tag.
		// Remove: Use $.view.tags( name, null ) to remove a registered tag from $.view.tags.

		// When registering for {{foo a b c==d e=f}}, tag should be a function with the signature:
		// function(a,b). The 'this' pointer will be a hash with properties c and e.
		return addToStore(this, $viewsTags, name, tagFn);
	}

	function $viewsHelpers(name, helperFn) {
		// Register helper functions for use in templates (or in data-link expressions if JsViews is loaded)
		// Setter: Use $.view.helpers( name, helperFn ) or $.view.helpers({ name: helperFn, ... }) to add additional helpers to the registered helpers collection.
		// Getter: Use var helperFn = $.views.helpers( name ) or $.views.helpers[name] or $.views.helpers.name to return the function.
		// Remove: Use $.view.helpers( name, null ) to remove a registered helper function from $.view.helpers.
		// Within a template, access the helper using the syntax: {{... ~myHelper(...) ...}}.
		return addToStore(this, $viewsHelpers, name, helperFn);
	}

	function $viewsConverters(name, converterFn) {
		// Register converter functions for use in templates (or in data-link expressions if JsViews is loaded)
		// Setter: Use $.view.converters( name, converterFn ) or $.view.converters({ name: converterFn, ... }) to add additional converters to the registered converters collection.
		// Getter: Use var converterFn = $.views.converters( name ) or $.views.converters[name] or $.views.converters.name to return the converter function.
		// Remove: Use $.view.converters( name, null ) to remove a registered converter from $.view.converters.
		// Within a template, access the converter using the syntax: {{myConverter:...}}.
		return addToStore(this, $viewsConverters, name, converterFn);
	}

	//=================
	// renderContent
	//=================

	function renderContent(data, context, parentView, key, isLayout, path, onRender) {
		// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
		var i, l, dataItem, newView, itemResult, parentContext, tmpl, props, swapContent, mergedCtx,
			self = this,
			result = "";

		if (key === TRUE) {
			swapContent = TRUE;
			key = 0;
		}
		if (self.isTag) {
			// This is a call from renderTag
			tmpl = self.tmpl;
			if (context || self.ctx) {// || hasProp) {
				// We need to create an augmented context for the view(s) we are about to render
				mergedCtx = {};
				if (self.ctx) {
					// self.ctx is an object with the contextual template parameters on the tag, such as ~foo: {{tag ~foo=expression...}}
					$extend(mergedCtx, self.ctx);
				}
				if (context) {
					// This is a context object passed programmatically from the tag function
					$extend(mergedCtx, context);
				}
			}
			context = mergedCtx;
			props = self.props;
			if ( props && props.link === FALSE ) {
				// link=false setting on block tag
				// We will override inherited value of link by the explicit setting link=false taken from props
				// The child views of an unlinked view are also unlinked. So setting child back to true will not have any effect.
				context =  context || {};
				context.link = FALSE;
			}
			parentView = parentView || self.view;
			path = path || self.path;
			key = key || self.key;
		} else {
			tmpl = self.jquery && (self[0] || error('Unknown template: "' + self.selector + '"')) // This is a call from $(selector).render
				|| self;
		}
		if (tmpl) {
			if (parentView) {
				parentContext = parentView.ctx;
				if (data === parentView) {
					// Inherit the data from the parent view.
					// This may be the contents of an {{if}} block
					// Set isLayout = true so we don't iterate the if block if the data is an array.
					data = parentView.data;
					isLayout = TRUE;
				}
				onRender = onRender || parentView._onRender;
			} else {
				parentContext = $viewsHelpers;
			}

			// Set additional context on views created here, (as modified context inherited from the parent, and to be inherited by child views)
			// Note: If no jQuery, $extend does not support chained copies - so limit $extend() to two parameters
			// TODO could make this a reusable helper for merging context.
			context = (context && context !== parentContext)
				? $extend($extend({}, parentContext), context)
				: parentContext;

			if (!tmpl.fn) {
				tmpl = $templates[tmpl] || $templates(tmpl);
			}

			if (tmpl) {
				onRender = context.link !== FALSE && onRender; // If link===false, do not call onRender, so no data-linking annotations
				if ($.isArray(data) && !isLayout) {
					// Create a view for the array, whose child views correspond to each data item.
					// (Note: if key and parentView are passed in along with parent view, treat as
					// insert -e.g. from view.addViews - so parentView is already the view item for array)
					newView = swapContent ? parentView : (key !== undefined && parentView) || View(context, path, parentView, data, tmpl, key, onRender, TRUE);
					for (i = 0, l = data.length; i < l; i++) {
						// Create a view for each data item.
						dataItem = data[i];
						itemResult = tmpl.fn(dataItem, View(context, path, newView, dataItem, tmpl, (key || 0) + i, onRender), $views);
						result += onRender ? onRender(itemResult, tmpl, props) : itemResult;
					}
				} else {
					// Create a view for singleton data object.
					newView = swapContent ? parentView : View(context, path, parentView, data, tmpl, key, onRender);
					newView._onRender = onRender;
					result += tmpl.fn(data, newView, $views);
				}
				return onRender ? onRender(result, tmpl, props, newView.key, path) : result;
			}
		}
		error("No template found");
		return "";
	}

	//===========================
	// Build and compile template
	//===========================

	// Generate a reusable function that will serve to render a template against data
	// (Compile AST then build template function)

	function error(message) {
		if ($views.debugMode) {
			throw new $views.Error(message);
		}
	}

	function syntaxError(message) {
		error("Syntax error\n" + message);
	}


	function tmplFn(markup, tmpl, bind) {
		// Compile markup to AST (abtract syntax tree) then build the template function code from the AST nodes
		// Used for compiling templates, and also by JsViews to build functions for data link expressions

		var newNode,
			allowCode = tmpl && tmpl.allowCode,
			astTop = [],
			loc = 0,
			stack = [],
			content = astTop,
			current = [, , , astTop];

		//==== nested functions ====
		function pushPreceedingContent(shift) {
			shift -= loc;
			if (shift) {
				content.push(markup.substr(loc, shift).replace(rNewLine, "\\n"));
			}
		}

		function blockTagCheck(tagName) {
			tagName && syntaxError('Unmatched or missing tag: "{{/' + tagName + '}}" in template:\n' + markup);
		}

		function parseTag(all, tagName, converter, colon, html, code, params, slash, closeBlock, index) {
			//                  tag           converter colon  html  code     params         slash   closeBlock
			//      /{{(?:(?:(\w+(?=[\/!\s\}!]))|(?:(\w+)?(:)|(?:(>)|(\*)))((?:[^\}]|}(?!}))*?)(\/)?|(?:\/(\w+)))}}/g;
			// Build abstract syntax tree (AST): [ tagName, converter, params, content, hash, contentMarkup, link ]
			if (html) {
				colon = ":";
				converter = "html";
			}
			var current0,
				hash = "",
				passedCtx = "",
				// Block tag if not self-closing and not {{:}} or {{>}} (special case) and not a data-link expression (has bind parameter)
				block = !slash && !colon && !bind;

			//==== nested helper function ====

			tagName = tagName || colon;
			pushPreceedingContent(index);
			loc = index + all.length; // location marker - parsed up to here
			if (code) {
				if (allowCode) {
					content.push(["*", params.replace(rUnescapeQuotes, "$1")]);
				}
			} else if (tagName) {
				if (tagName === "else") {
					current[5] = markup.substring(current[5], index); // contentMarkup for block tag
					current = stack.pop();
					content = current[3];
					block = TRUE;
				}
				params = (params
					? parseParams(params, bind)
						.replace(rBuildHash, function(all, isCtx, keyValue) {
							if (isCtx) {
								passedCtx += keyValue + ",";
							} else {
								hash += keyValue + ",";
							}
							return "";
						})
					: "");
				hash = hash.slice(0, -1);
				params = params.slice(0, -1);
				newNode = [
						tagName,
						converter || "",
						params,
						block && [],
						"{" + (hash ? ("props:{" + hash + "},") : "") + "path:'" + params + "'" + (passedCtx ? ",ctx:{" + passedCtx.slice(0, -1) + "}" : "") + "}"
					];
				content.push(newNode);
				if (block) {
					stack.push(current);
					current = newNode;
					current[5] = loc; // Store current location of open tag, to be able to add contentMarkup when we reach closing tag
				}
			} else if (closeBlock) {
				current0 = current[0];
				blockTagCheck(closeBlock !== current0 && !(closeBlock === "if" && current0 === "else") && current0); 
				current[5] = markup.substring(current[5], index); // contentMarkup for block tag
				current = stack.pop();
			}
			blockTagCheck(!current && closeBlock);
			content = current[3];
		}
		//==== /end of nested functions ====

		markup = markup.replace(rEscapeQuotes, "\\$1");
		blockTagCheck(stack[0] && stack[0][3].pop()[0]);

		// Build the AST (abstract syntax tree) under astTop
		markup.replace(rTag, parseTag);

		pushPreceedingContent(markup.length);
		return  buildCode(astTop, tmpl);
	}

	function buildCode(ast, tmpl) {
		// Build the template function code from the AST nodes, and set as property on the passed in template object
		// Used for compiling templates, and also by JsViews to build functions for data link expressions
		var node, i, l, code, hasTag, hasEncoder, getsValue, hasConverter, hasViewPath, tag, converter, params, hash, nestedTmpl, allowCode, content,
			tmplOptions = tmpl ? {
				allowCode: allowCode = tmpl.allowCode,
				debug: tmpl.debug
			} : {},
			nested = tmpl && tmpl.tmpls,
			nestedIndex = 0;

		// Use the AST (ast) to build the template function
		l = ast.length;
		code = (l ? "" : '"";');

		for (i = 0; i < l; i++) {
			// AST nodes: [ tagName, converter, params, content, hash, contentMarkup, link ]
			node = ast[i];
			if ("" + node === node) { // type string
				code += '"' + node + '"+';
			} else {
				tag = node[0];
				if (tag === "*") {
					code = code.slice(0, i ? -1 : -3) + ";" + node[1] + (i + 1 < l ? "ret+=" : "");
				} else {
					converter = node[1];
					params = node[2];
					content = node[3];
					hash = node[4];
					markup = node[5];

					if (content) {
						// Create template object for nested template
						nestedTmpl = TmplObject(markup, tmplOptions, tmpl, nestedIndex++);
						// Compile to AST and then to compiled function
						buildCode(node[3], nestedTmpl);
						nested.push(nestedTmpl);
					}
					hasViewPath = hasViewPath || hash.indexOf("view") > -1;
					code += (tag === ":"
					? (converter === "html"
						? (hasEncoder = TRUE, "e(" + params)
						: converter
							? (hasConverter = TRUE, 'c("' + converter + '",view,this,' + params)
							: (getsValue = TRUE, "((v=" + params + ')!=u?v:""')
					)
					: (hasTag = TRUE, 't("' + tag + '",view,this,"' + (converter || "") + '",'
						+ (content ? nested.length : '""') // For block tags, pass in the key (nested.length) to the nested content template
						+ "," + hash + (params ? "," : "") + params))
						+ ")+";
				}
			}
		}
		code = fnDeclStr
		+ (getsValue ? "v," : "")
		+ (hasTag ? "t=j._tag," : "")
		+ (hasConverter ? "c=j._convert," : "")
		+ (hasEncoder ? "e=j.converters.html," : "")
		+ "ret; try{\n\n"
		+ (tmplOptions.debug ? "debugger;" : "")
		+ (allowCode ? 'ret=' : 'return ')
		+ code.slice(0, -1) + ";\n\n"
		+ (allowCode ? "return ret;" : "")
		+ "}catch(e){return j._err(e);}";

		try {
			code = new Function("data, view, j, b, u", code);
		} catch (e) {
			syntaxError("Compiled template code:\n\n" + code, e);
		}

		// Include only the var references that are needed in the code
		if (tmpl) {
			tmpl.fn = code;
		}
		return code;
	}


	function parseParams(params, bind) {
		var named,
			fnCall = {},
			parenDepth = 0,
			quoted = FALSE, // boolean for string content in double quotes
			aposed = FALSE; // or in single quotes

		function parseTokens(all, lftPrn0, lftPrn, path, operator, err, eq, path2, prn, comma, lftPrn2, apos, quot, rtPrn, prn2, space) {
			// rParams = /(?:([([])\s*)?(?:([#~]?[\w$.]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*!:?\/]|(=))\s*|([#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*([)\]])([([]?))|(\s+)/g,
			//            lftPrn                  path    operator err                                                eq         path2       prn    comma   lftPrn3   apos quot        rtPrn   prn2   space
			// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space
			operator = operator || "";
			lftPrn = lftPrn || lftPrn0 || lftPrn2;
			path = path || path2;
			prn = prn || prn2 || "";
			operator = operator || "";
			var bindParam = bind && prn !== "(";

			function parsePath(all, object, helper, view, viewProperty, pathTokens, leafToken) {
				// rPath = /^(?:null|true|false|\d[\d.]*|([\w$]+|~([\w$]+)|#(view|([\w$]+))?)([\w$.]*?)(?:[.[]([\w$]+)\]?)?|(['"]).*\8)$/g,
				//                                        object   helper    view  viewProperty pathTokens   leafToken     string
				if (object) {
					var leaf,
						ret = (helper
							? 'view._hlp("' + helper + '")'
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

					leaf = (leafToken ? "." + leafToken : "")
					if (!bindParam) {
						ret = ret + leaf;
					}
					ret = ret.slice(0, 9) === "view.data"
					? ret.slice(5) // convert #view.data... to data...
					: ret;
					if (bindParam) {
						ret = "b(" + ret + ',"' + leafToken + '")' + leaf;
					}
					return ret;
				}
				return all;
			}

			if (err) {
				syntaxError(params);
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
							? (parenDepth && syntaxError(params), named = TRUE, '\b' + path + ':')
							: path
				// path
								? (path.replace(rPath, parsePath)
									+ (prn
										? (fnCall[++parenDepth] = TRUE, prn)
										: operator)
								)
								: operator
									? operator
									: rtPrn
				// function
										? ((fnCall[parenDepth--] = FALSE, rtPrn)
											+ (prn
												? (fnCall[++parenDepth] = TRUE, prn)
												: "")
										)
										: comma
											? (fnCall[parenDepth] || syntaxError(params), ",") // We don't allow top-level literal arrays or objects
											: lftPrn0
												? ""
												: (aposed = apos, quoted = quot, '"')
				))
			);
			}
		}
		params = (params + " ").replace(rParams, parseTokens);
		return params;
	}

	function compile(name, tmpl, parent, options) {
		// tmpl is either a template object, a selector for a template script block, the name of a compiled template, or a template object
		// options is the set of template properties, c
		var tmplOrMarkup, elem, key, nested, nestedItem;

		//==== nested functions ====
		function tmplOrMarkupFromStr(value) {
			// If value is of type string - treat as selector, or name of compiled template
			// Return the template object, if already compiled, or the markup string

			if (("" + value === value) || value.nodeType > 0) {
				try {
					elem = value.nodeType > 0
					? value
					: !rTmplString.test(value)
					// If value is a string and does not contain HTML or tag content, then test as selector
						&& jQuery && jQuery(value)[0];
					// If selector is valid and returns at least one element, get first element
					// If invalid, jQuery will throw. We will stay with the original string.
				} catch (e) { }

				if (elem) {
					if (!elem.type) {
						// If elem is not a script element, return undefined
						return;
					}
					// It is a script element
					// Create a name for data linking if none provided
					value = $templates[elem.getAttribute(tmplAttr)];
					if (!value) {
						// Not already compiled and cached, so compile and cache the name
						name = name || "_" + autoTmplName++;
						elem.setAttribute(tmplAttr, name);
						value = compile(name, elem.innerHTML, parent, options); // Use tmpl as options
						$templates[name] = value;
					}
				}
				return value;
			}
			// If value is not a string, return undefined
		}

		//==== Compile the template ====
		tmpl = tmpl || "";
		tmplOrMarkup = tmplOrMarkupFromStr(tmpl);

		// If tmpl is a template object, use it for options
		options = options || (tmpl.markup ? tmpl : {});
		options.name = name;
		nested = options.templates;

		// If tmpl is not a markup string or a selector string, then it must be a template object
		// In that case, get it from the markup property of the object
		if (!tmplOrMarkup && tmpl.markup && (tmplOrMarkup = tmplOrMarkupFromStr(tmpl.markup))) {
			if (tmplOrMarkup.fn && (tmplOrMarkup.debug !== tmpl.debug || tmplOrMarkup.allowCode !== tmpl.allowCode)) {
				// if the string references a compiled template object, but the debug or allowCode props are different, need to recompile
				tmplOrMarkup = tmplOrMarkup.markup;
			}
		}
		if (tmplOrMarkup !== undefined) {
			if (name && !parent) {
				$render[name] = function() {
					return tmpl.render.apply(tmpl, arguments);
				};
			}
			if (tmplOrMarkup.fn || tmpl.fn) {
				// tmpl is already compiled, so use it, or if different name is provided, clone it
				if (tmplOrMarkup.fn) {
					if (name && name !== tmplOrMarkup.name) {
						tmpl = $extend($extend({}, tmplOrMarkup), options);
					} else {
						tmpl = tmplOrMarkup;
					}
				}
			} else {
				// tmplOrMarkup is a markup string, not a compiled template
				// Create template object
				tmpl = TmplObject(tmplOrMarkup, options, parent, 0);
				// Compile to AST and then to compiled function
				tmplFn(tmplOrMarkup, tmpl);
			}
			for (key in nested) {
				// compile nested template declarations
				nestedItem = nested[key];
				if (nestedItem.name !== key) {
					nested[key] = compile(key, nestedItem, tmpl);
				}
			}
			return tmpl;
		}
	}
	//==== /end of function compile ====

	function TmplObject(markup, options, parent, key) {
		// Template object constructor

		// nested helper function
		function extendStore(storeName) {
			if (parent[storeName]) {
				// Include parent items except if overridden by item of same name in options
				tmpl[storeName] = $extend($extend({}, parent[storeName]), options[storeName]);
			}
		}

		options = options || {};
		var tmpl = {
			markup: markup,
			tmpls: [],
			links: [],
			render: renderContent
		};

		if (parent) {
			if (parent.templates) {
				tmpl.templates = $extend($extend({}, parent.templates), options.templates);
			}
			tmpl.parent = parent;
			tmpl.name = parent.name + "[" + key + "]";
			tmpl.key = key;
		}

		$extend(tmpl, options);
		if (parent) {
			extendStore("templates");
			extendStore("tags");
			extendStore("helpers");
			extendStore("converters");
		}
		return tmpl;
	}

	//========================== Initialize ==========================

	if (jQuery) {
		////////////////////////////////////////////////////////////////////////////////////////////////
		// jQuery is loaded, so make $ the jQuery object
		$ = jQuery;
		$.templates = $templates;
		$.render = $render;
		$.views = $views;
		$.fn.render = renderContent;

	} else {
		////////////////////////////////////////////////////////////////////////////////////////////////
		// jQuery is not loaded.

		$ = global.jsviews = $views;
		$.extend = function(target, source) {
			var name;
			target = target || {};
			for (name in source) {
				target[name] = source[name];
			}
			return target;
		};

		$.isArray = Array && Array.isArray || function(obj) {
			return Object.prototype.toString.call(obj) === "[object Array]";
		};
	}

	$extend = $.extend;

	function replacerForHtml(ch) {
		// Original code from Mike Samuel <msamuel@google.com>
		return escapeMapForHtml[ch]
			// Intentional assignment that caches the result of encoding ch.
			|| (escapeMapForHtml[ch] = "&#" + ch.charCodeAt(0) + ";");
	}

	//========================== Register tags ==========================

	$viewsTags({
		"if": function() {
			var ifTag = this,
				view = ifTag.view;

			view.onElse = function(tagInstance, args) {
				var i = 0,
					l = args.length;

				while (l && !args[i++]) {
					// Only render content if args.length === 0 (i.e. this is an else with no condition) or if a condition argument is truey
					if (i === l) {
						return "";
					}
				}
				view.onElse = undefined; // If condition satisfied, so won't run 'else'.
				tagInstance.path = "";
				return tagInstance.renderContent(view);
				// Test is satisfied, so render content, while remaining in current data context
				// By passing the view, we inherit data context from the parent view, and the content is treated as a layout template
				// (so if the data is an array, it will not iterate over the data
			};
			return view.onElse(this, arguments);
		},
		"else": function() {
			var view = this.view;
			return view.onElse ? view.onElse(this, arguments) : "";
		},
		"for": function() {
			var i,
				self = this,
				result = "",
				args = arguments,
				l = args.length;

			if (l === 0) {
				// If no parameters, render once, with #data undefined
				l = 1;
			}
			for (i = 0; i < l; i++) {
				result += self.renderContent(args[i]);
			}
			return result;
		},
		"*": function(value) {
			return value;
		}
	});

	//========================== Register global helpers ==========================

	//	$viewsHelpers({ // Global helper functions
	//		// TODO add any useful built-in helper functions
	//	});

	//========================== Register converters ==========================

	$viewsConverters({
		html: function(text) {
			// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
			// inspired by Mike Samuel <msamuel@google.com>
			return text != undefined ? String(text).replace(htmlSpecialChar, replacerForHtml) : "";
		}
	});

	//========================== Define default delimiters ==========================
	$viewsDelimiters();

})(this);
