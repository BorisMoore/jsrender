(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v1.0.14: http://jsviews.com/#jsrender */
/*! **VERSION FOR WEB** (For NODE.JS see http://jsviews.com/download/jsrender-node.js) */
/*
 * Best-of-breed templating in browser or on Node.js.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://jsviews.com/#jsviews)
 *
 * Copyright 2024, Boris Moore
 * Released under the MIT License.
 */

//jshint -W018, -W041, -W120

(function(factory, global) {
	// global var is the this object, which is window when running in the usual browser environment
	var $ = global.jQuery;

	if (typeof exports === "object") { // CommonJS e.g. Browserify
		module.exports = $
			? factory(global, $)
			: function($) { // If no global jQuery, take optional jQuery passed as parameter: require('jsrender')(jQuery)
				if ($ && !$.fn) {
					throw "Provide jQuery or null";
				}
				return factory(global, $);
			};
	} else if (typeof define === "function" && define.amd) { // AMD script loader, e.g. RequireJS
		define(function() {
			return factory(global);
		});
	} else { // Browser using plain <script> tag
		factory(global, false);
	}
} (

// factory (for jsrender.js)
function(global, $) {
"use strict";

//========================== Top-level vars ==========================

// global var is the this object, which is window when running in the usual browser environment
var setGlobals = $ === false; // Only set globals if script block in browser (not AMD and not CommonJS)

$ = $ && $.fn ? $ : global.jQuery; // $ is jQuery passed in by CommonJS loader (Browserify), or global jQuery.

var versionNumber = "v1.0.14",
	jsvStoreName, rTag, rTmplString, topView, $views, $expando,
	_ocp = "_ocp",      // Observable contextual parameter

	$isFunction, $isArray, $templates, $converters, $helpers, $tags, $sub, $subSettings, $subSettingsAdvanced, $viewsSettings,
	delimOpenChar0, delimOpenChar1, delimCloseChar0, delimCloseChar1, linkChar, setting, baseOnError,

	isRenderCall,
	rNewLine = /[ \t]*(\r\n|\n|\r)/g,
	rUnescapeQuotes = /\\(['"\\])/g, // Unescape quotes and trim
	rEscapeQuotes = /['"\\]/g, // Escape quotes and \ character
	rBuildHash = /(?:\x08|^)(onerror:)?(?:(~?)(([\w$.]+):)?([^\x08]+))\x08(,)?([^\x08]+)/gi,
	rTestElseIf = /^if\s/,
	rFirstElem = /<(\w+)[>\s]/,
	rAttrEncode = /[\x00`><"'&=]/g, // Includes > encoding since rConvertMarkers in JsViews does not skip > characters in attribute strings
	rIsHtml = /[\x00`><\"'&=]/,
	rHasHandlers = /^on[A-Z]|^convert(Back)?$/,
	rWrappedInViewMarker = /^\#\d+_`[\s\S]*\/\d+_`$/,
	rHtmlEncode = rAttrEncode,
	rDataEncode = /[&<>]/g,
	rDataUnencode = /&(amp|gt|lt);/g,
	rBracketQuote = /\[['"]?|['"]?\]/g,
	viewId = 0,
	charEntities = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\x00": "&#0;",
		"'": "&#39;",
		'"': "&#34;",
		"`": "&#96;",
		"=": "&#61;"
	},
	charsFromEntities = {
		amp: "&",
		gt: ">",
		lt: "<"
	},
	HTML = "html",
	STRING = "string",
	OBJECT = "object",
	tmplAttr = "data-jsv-tmpl",
	jsvTmpl = "jsvTmpl",
	indexStr = "For #index in nested block use #getIndex().",
	cpFnStore = {},     // Compiled furnctions for computed values in template expressions (properties, methods, helpers)
	$render = {},

	jsr = global.jsrender,
	jsrToJq = jsr && $ && !$.render, // JsRender already loaded, without jQuery. but we will re-load it now to attach to jQuery

	jsvStores = {
		template: {
			compile: compileTmpl
		},
		tag: {
			compile: compileTag
		},
		viewModel: {
			compile: compileViewModel
		},
		helper: {},
		converter: {}
	};

	// views object ($.views if jQuery is loaded, jsrender.views if no jQuery, e.g. in Node.js)
	$views = {
		jsviews: versionNumber,
		sub: {
			// subscription, e.g. JsViews integration
			rPath: /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
			//        not                               object     helper    view  viewProperty pathTokens      leafToken

			rPrm: /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|~(?![\w$])|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(?:(\()\s*)?\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
			//   lftPrn0           lftPrn         bound     path               operator     err                                          eq      path2 late            prn      comma  lftPrn2          apos quot        rtPrn  rtPrnDot                  prn2     space

			View: View,
			Err: JsViewsError,
			tmplFn: tmplFn,
			parse: parseParams,
			extend: $extend,
			extendCtx: extendCtx,
			syntaxErr: syntaxError,
			onStore: {
				template: function(name, item) {
					if (item === null) {
						delete $render[name];
					} else if (name) {
						$render[name] = item;
					}
				}
			},
			addSetting: addSetting,
			settings: {
				allowCode: false
			},
			advSet: noop, // Update advanced settings
			_thp: tagHandlersFromProps,
			_gm: getMethod,
			_tg: function() {}, // Constructor for tagDef
			_cnvt: convertVal,
			_tag: renderTag,
			_er: error,
			_err: onRenderError,
			_cp: retVal, // Get observable contextual parameters (or properties) ~foo=expr. In JsRender, simply returns val.
			_sq: function(token) {
				if (token === "constructor") {
					syntaxError("");
				}
				return token;
			}
		},
		settings: {
			delimiters: $viewsDelimiters,
			advanced: function(value) {
				return value
					? (
							$extend($subSettingsAdvanced, value),
							$sub.advSet(),
							$viewsSettings
						)
						: $subSettingsAdvanced;
				}
		},
		map: dataMap // If jsObservable loaded first, use that definition of dataMap
	};

function getDerivedMethod(baseMethod, method) {
	return function() {
		var ret,
			tag = this,
			prevBase = tag.base;

		tag.base = baseMethod; // Within method call, calling this.base will call the base method
		ret = method.apply(tag, arguments); // Call the method
		tag.base = prevBase; // Replace this.base to be the base method of the previous call, for chained calls
		return ret;
	};
}

function getMethod(baseMethod, method) {
	// For derived methods (or handlers declared declaratively as in {{:foo onChange=~fooChanged}} replace by a derived method, to allow using this.base(...)
	// or this.baseApply(arguments) to call the base implementation. (Equivalent to this._super(...) and this._superApply(arguments) in jQuery UI)
	if ($isFunction(method)) {
		method = getDerivedMethod(
				!baseMethod
					? noop // no base method implementation, so use noop as base method
					: baseMethod._d
						? baseMethod // baseMethod is a derived method, so use it
						: getDerivedMethod(noop, baseMethod), // baseMethod is not derived so make its base method be the noop method
				method
			);
		method._d = (baseMethod && baseMethod._d || 0) + 1; // Add flag for derived method (incremented for derived of derived...)
	}
	return method;
}

function tagHandlersFromProps(tag, tagCtx) {
	var prop,
		props = tagCtx.props;
	for (prop in props) {
		if (rHasHandlers.test(prop) && !(tag[prop] && tag[prop].fix)) { // Don't override handlers with fix expando (used in datepicker and spinner)
			tag[prop] = prop !== "convert" ? getMethod(tag.constructor.prototype[prop], props[prop]) : props[prop];
			// Copy over the onFoo props, convert and convertBack from tagCtx.props to tag (overrides values in tagDef).
			// Note: unsupported scenario: if handlers are dynamically added ^onFoo=expression this will work, but dynamically removing will not work.
		}
	}
}

function retVal(val) {
	return val;
}

function noop() {
	return "";
}

function dbgBreak(val) {
	// Usage examples: {{dbg:...}}, {{:~dbg(...)}}, {{dbg .../}}, {^{for ... onAfterLink=~dbg}} etc.
	try {
		console.log("JsRender dbg breakpoint: " + val);
		throw "dbg breakpoint"; // To break here, stop on caught exceptions.
	}
	catch (e) {}
	return this.base ? this.baseApply(arguments) : val;
}

function JsViewsError(message) {
	// Error exception type for JsViews/JsRender
	// Override of $.views.sub.Error is possible
	this.name = ($.link ? "JsViews" : "JsRender") + " Error";
	this.message = message || this.name;
}

function $extend(target, source) {
	if (target) {
		for (var name in source) {
			target[name] = source[name];
		}
		return target;
	}
}

(JsViewsError.prototype = new Error()).constructor = JsViewsError;

//========================== Top-level functions ==========================

//===================
// views.delimiters
//===================

	/**
	* Set the tag opening and closing delimiters and 'link' character. Default is "{{", "}}" and "^"
	* openChars, closeChars: opening and closing strings, each with two characters
	* $.views.settings.delimiters(...)
	*
	* @param {string}   openChars
	* @param {string}   [closeChars]
	* @param {string}   [link]
	* @returns {Settings}
	*
	* Get delimiters
	* delimsArray = $.views.settings.delimiters()
	*
	* @returns {string[]}
	*/
function $viewsDelimiters(openChars, closeChars, link) {
	if (!openChars) {
		return $subSettings.delimiters;
	}
	if ($isArray(openChars)) {
		return $viewsDelimiters.apply($views, openChars);
	}
	linkChar = link ? link[0] : linkChar;
	if (!/^(\W|_){5}$/.test(openChars + closeChars + linkChar)) {
		error("Invalid delimiters"); // Must be non-word characters, and openChars and closeChars must each be length 2
	}
	delimOpenChar0 = openChars[0];
	delimOpenChar1 = openChars[1];
	delimCloseChar0 = closeChars[0];
	delimCloseChar1 = closeChars[1];

	$subSettings.delimiters = [delimOpenChar0 + delimOpenChar1, delimCloseChar0 + delimCloseChar1, linkChar];

	// Escape the characters - since they could be regex special characters
	openChars = "\\" + delimOpenChar0 + "(\\" + linkChar + ")?\\" + delimOpenChar1; // Default is "{^{"
	closeChars = "\\" + delimCloseChar0 + "\\" + delimCloseChar1;                   // Default is "}}"
	// Build regex with new delimiters
	//          [tag    (followed by / space or })  or cvtr+colon or html or code] followed by space+params then convertBack?
	rTag = "(?:(\\w+(?=[\\/\\s\\" + delimCloseChar0 + "]))|(\\w+)?(:)|(>)|(\\*))\\s*((?:[^\\"
		+ delimCloseChar0 + "]|\\" + delimCloseChar0 + "(?!\\" + delimCloseChar1 + "))*?)";

	// Make rTag available to JsViews (or other components) for parsing binding expressions
	$sub.rTag = "(?:" + rTag + ")";
	//                        { ^? {   tag+params slash?  or closingTag                                                   or comment
	rTag = new RegExp("(?:" + openChars + rTag + "(\\/)?|\\" + delimOpenChar0 + "(\\" + linkChar + ")?\\" + delimOpenChar1 + "(?:(?:\\/(\\w+))\\s*|!--[\\s\\S]*?--))" + closeChars, "g");

	// Default:  bind     tagName         cvt   cln html code    params            slash   bind2         closeBlk  comment
	//      /(?:{(\^)?{(?:(\w+(?=[\/\s}]))|(\w+)?(:)|(>)|(\*))\s*((?:[^}]|}(?!}))*?)(\/)?|{(\^)?{(?:(?:\/(\w+))\s*|!--[\s\S]*?--))}}

	$sub.rTmpl = new RegExp("^\\s|\\s$|<.*>|([^\\\\]|^)[{}]|" + openChars + ".*" + closeChars);
	// $sub.rTmpl looks for initial or final white space, html tags or { or } char not preceded by \\, or JsRender tags {{xxx}}.
	// Each of these strings are considered NOT to be jQuery selectors
	return $viewsSettings;
}

//=========
// View.get
//=========

function getView(inner, type) { //view.get(inner, type)
	if (!type && inner !== true) {
		// view.get(type)
		type = inner;
		inner = undefined;
	}

	var views, i, l, found,
		view = this,
		root = type === "root";
		// view.get("root") returns view.root, view.get() returns view.parent, view.get(true) returns view.views[0].

	if (inner) {
		// Go through views - this one, and all nested ones, depth-first - and return first one with given type.
		// If type is undefined, i.e. view.get(true), return first child view.
		found = type && view.type === type && view;
		if (!found) {
			views = view.views;
			if (view._.useKey) {
				for (i in views) {
					if (found = type ? views[i].get(inner, type) : views[i]) {
						break;
					}
				}
			} else {
				for (i = 0, l = views.length; !found && i < l; i++) {
					found = type ? views[i].get(inner, type) : views[i];
				}
			}
		}
	} else if (root) {
		// Find root view. (view whose parent is top view)
		found = view.root;
	} else if (type) {
		while (view && !found) {
			// Go through views - this one, and all parent ones - and return first one with given type.
			found = view.type === type ? view : undefined;
			view = view.parent;
		}
	} else {
		found = view.parent;
	}
	return found || undefined;
}

function getNestedIndex() {
	var view = this.get("item");
	return view ? view.index : undefined;
}

getNestedIndex.depends = function() {
	return [this.get("item"), "index"];
};

function getIndex() {
	return this.index;
}

getIndex.depends = "index";

//==================
// View.ctxPrm, etc.
//==================

/* Internal private: view._getOb() */
function getPathObject(ob, path, ltOb, fn) {
	// Iterate through path to late paths: @a.b.c paths
	// Return "" (or noop if leaf is a function @a.b.c(...) ) if intermediate object not yet available
	var prevOb, tokens, l,
		i = 0;
	if (ltOb === 1) {
		fn = 1;
		ltOb = undefined;
	}
	// Paths like ^a^b^c or ~^a^b^c will not throw if an object in path is undefined.
	if (path) {
		tokens = path.split(".");
		l = tokens.length;

		for (; ob && i < l; i++) {
			prevOb = ob;
			ob = tokens[i] ? ob[tokens[i]] : ob;
		}
	}
	if (ltOb) {
		ltOb.lt = ltOb.lt || i<l; // If i < l there was an object in the path not yet available
	}
	return ob === undefined
		? fn ? noop : ""
		: fn ? function() {
			return ob.apply(prevOb, arguments);
		} : ob;
}

function contextParameter(key, value, get) {
	// Helper method called as view.ctxPrm(key) for helpers or template parameters ~foo - from compiled template or from context callback
	var wrapped, deps, res, obsCtxPrm, tagElse, callView, newRes,
		storeView = this,
		isUpdate = !isRenderCall && arguments.length > 1,
		store = storeView.ctx;
	if (key) {
		if (!storeView._) { // tagCtx.ctxPrm() call
			tagElse = storeView.index;
			storeView = storeView.tag;
		}
		callView = storeView;
		if (store && store.hasOwnProperty(key) || (store = $helpers).hasOwnProperty(key)) {
			res = store[key];
			if (key === "tag" || key === "tagCtx" || key === "root" || key === "parentTags") {
				return res;
			}
		} else {
			store = undefined;
		}
		if (!isRenderCall && storeView.tagCtx || storeView.linked) { // Data-linked view, or tag instance
			if (!res || !res._cxp) {
				// Not a contextual parameter
				// Set storeView to tag (if this is a tag.ctxPrm() call) or to root view ("data" view of linked template)
				storeView = storeView.tagCtx || $isFunction(res)
					? storeView // Is a tag, not a view, or is a computed contextual parameter, so scope to the callView, not the 'scope view'
					: (storeView = storeView.scope || storeView,
						!storeView.isTop && storeView.ctx.tag // If this view is in a tag, set storeView to the tag
							|| storeView);
				if (res !== undefined && storeView.tagCtx) {
					// If storeView is a tag, but the contextual parameter has been set at at higher level (e.g. helpers)...
					storeView = storeView.tagCtx.view.scope; // then move storeView to the outer level (scope of tag container view)
				}
				store = storeView._ocps;
				res = store && store.hasOwnProperty(key) && store[key] || res;
				if (!(res && res._cxp) && (get || isUpdate)) {
					// Create observable contextual parameter
					(store || (storeView._ocps = storeView._ocps || {}))[key]
						= res
						= [{
							_ocp: res, // The observable contextual parameter value
							_vw: callView,
							_key: key
						}];
					res._cxp = {
						path: _ocp,
						ind: 0,
						updateValue: function(val, path) {
							$.observable(res[0]).setProperty(_ocp, val); // Set the value (res[0]._ocp)
							return this;
						}
					};
				}
			}
			if (obsCtxPrm = res && res._cxp) {
				// If this helper resource is an observable contextual parameter
				if (arguments.length > 2) {
					deps = res[1] ? $sub._ceo(res[1].deps) : [_ocp]; // fn deps (with any exprObs cloned using $sub._ceo)
					deps.unshift(res[0]); // view
					deps._cxp = obsCtxPrm;
					// In a context callback for a contextual param, we set get = true, to get ctxPrm [view, dependencies...] array - needed for observe call
					return deps;
				}
				tagElse = obsCtxPrm.tagElse;
				newRes = res[1] // linkFn for compiled expression
					? obsCtxPrm.tag && obsCtxPrm.tag.cvtArgs
						? obsCtxPrm.tag.cvtArgs(tagElse, 1)[obsCtxPrm.ind] // = tag.bndArgs() - for tag contextual parameter
						: res[1](res[0].data, res[0], $sub) // = fn(data, view, $sub) for compiled binding expression
					: res[0]._ocp; // Observable contextual parameter (uninitialized, or initialized as static expression, so no path dependencies)
				if (isUpdate) {
					$sub._ucp(key, value, storeView, obsCtxPrm); // Update observable contextual parameter
					return storeView;
				}
				res = newRes;
			}
		}
		if (res && $isFunction(res)) {
			// If a helper is of type function we will wrap it, so if called with no this pointer it will be called with the
			// view as 'this' context. If the helper ~foo() was in a data-link expression, the view will have a 'temporary' linkCtx property too.
			// Note that helper functions on deeper paths will have specific this pointers, from the preceding path.
			// For example, ~util.foo() will have the ~util object as 'this' pointer
			wrapped = function() {
				return res.apply((!this || this === global) ? callView : this, arguments);
			};
			$extend(wrapped, res); // Attach same expandos (if any) to the wrapped function
		}
		return wrapped || res;
	}
}

/* Internal private: view._getTmpl() */
function getTemplate(tmpl) {
	return tmpl && (tmpl.fn
		? tmpl
		: this.getRsc("templates", tmpl) || $templates(tmpl)); // not yet compiled
}

//==============
// views._cnvt
//==============

function convertVal(converter, view, tagCtx, onError) {
	// Called from compiled template code for {{:}}
	// self is template object or linkCtx object
	var tag, linkCtx, value, argsLen, bindTo,
		// If tagCtx is an integer, then it is the key for the compiled function to return the boundTag tagCtx
		boundTag = typeof tagCtx === "number" && view.tmpl.bnds[tagCtx-1];

	if (onError === undefined && boundTag && boundTag._lr) { // lateRender
		onError = "";
	}
	if (onError !== undefined) {
		tagCtx = onError = {props: {}, args: [onError]};
	} else if (boundTag) {
		tagCtx = boundTag(view.data, view, $sub);
	}
	boundTag = boundTag._bd && boundTag;
	if (converter || boundTag) {
		linkCtx = view._lc; // For data-link="{cvt:...}"... See onDataLinkedTagChange
		tag = linkCtx && linkCtx.tag;
		tagCtx.view = view;
		if (!tag) {
			tag = $extend(new $sub._tg(), {
				_: {
					bnd: boundTag,
					unlinked: true,
					lt: tagCtx.lt // If a late path @some.path has not returned @some object, mark tag as late
				},
				inline: !linkCtx,
				tagName: ":",
				convert: converter,
				onArrayChange: true,
				flow: true,
				tagCtx: tagCtx,
				tagCtxs: [tagCtx],
				_is: "tag"
			});
			argsLen = tagCtx.args.length;
			if (argsLen>1) {
				bindTo = tag.bindTo = [];
				while (argsLen--) {
					bindTo.unshift(argsLen); // Bind to all the arguments - generate bindTo array: [0,1,2...]
				}
			}
			if (linkCtx) {
				linkCtx.tag = tag;
				tag.linkCtx = linkCtx;
			}
			tagCtx.ctx = extendCtx(tagCtx.ctx, (linkCtx ? linkCtx.view : view).ctx);
			tagHandlersFromProps(tag, tagCtx);
		}
		tag._er = onError && value;
		tag.ctx = tagCtx.ctx || tag.ctx || {};
		tagCtx.ctx = undefined;
		value = tag.cvtArgs()[0]; // If there is a convertBack but no convert, converter will be "true"
		tag._er = onError && value;
	} else {
		value = tagCtx.args[0];
	}

	// Call onRender (used by JsViews if present, to add binding annotations around rendered content)
	value = boundTag && view._.onRender
		? view._.onRender(value, view, tag)
		: value;
	return value != undefined ? value : "";
}

function convertArgs(tagElse, bound) { // tag.cvtArgs() or tag.cvtArgs(tagElse?, true?)
	var l, key, boundArgs, args, bindFrom, tag, converter,
		tagCtx = this;

	if (tagCtx.tagName) {
		tag = tagCtx;
		tagCtx = (tag.tagCtxs || [tagCtx])[tagElse||0];
		if (!tagCtx) {
			return;
		}
	} else {
		tag = tagCtx.tag;
	}

	bindFrom = tag.bindFrom;
	args = tagCtx.args;

	if ((converter = tag.convert) && typeof converter === STRING) {
		converter = converter === "true"
			? undefined
			: (tagCtx.view.getRsc("converters", converter) || error("Unknown converter: '" + converter + "'"));
	}

	if (converter && !bound) { // If there is a converter, use a copy of the tagCtx.args array for rendering, and replace the args[0] in
		args = args.slice(); // the copied array with the converted value. But we do not modify the value of tag.tagCtx.args[0] (the original args array)
	}
	if (bindFrom) { // Get the values of the boundArgs
		boundArgs = [];
		l = bindFrom.length;
		while (l--) {
			key = bindFrom[l];
			boundArgs.unshift(argOrProp(tagCtx, key));
		}
		if (bound) {
			args = boundArgs; // Call to bndArgs() - returns the boundArgs
		}
	}
	if (converter) {
		converter = converter.apply(tag, boundArgs || args);
		if (converter === undefined) {
			return args; // Returning undefined from a converter is equivalent to not having a converter.
		}
		bindFrom = bindFrom || [0];
		l = bindFrom.length;
		if (!$isArray(converter) || (converter.arg0 !== false && (l === 1 || converter.length !== l || converter.arg0))) {
			converter = [converter]; // Returning converter as first arg, even if converter value is an array
			bindFrom = [0];
			l = 1;
		}
		if (bound) {        // Call to bndArgs() - so apply converter to all boundArgs
			args = converter; // The array of values returned from the converter
		} else {            // Call to cvtArgs()
			while (l--) {
				key = bindFrom[l];
				if (+key === key) {
					args[key] = converter[l];
				}
			}
		}
	}
	return args;
}

function argOrProp(context, key) {
	context = context[+key === key ? "args" : "props"];
	return context && context[key];
}

function convertBoundArgs(tagElse) { // tag.bndArgs()
	return this.cvtArgs(tagElse, 1);
}

//=============
// views.tag
//=============

/* view.getRsc() */
function getResource(resourceType, itemName) {
	var res, store,
		view = this;
	if (typeof itemName === STRING) {
		while ((res === undefined) && view) {
			store = view.tmpl && view.tmpl[resourceType];
			res = store && store[itemName];
			view = view.parent;
		}
		return res || $views[resourceType][itemName];
	}
}

function renderTag(tagName, parentView, tmpl, tagCtxs, isUpdate, onError) {
	function bindToOrBindFrom(type) {
		var bindArray = tag[type];

		if (bindArray !== undefined) {
			bindArray = $isArray(bindArray) ? bindArray : [bindArray];
			m = bindArray.length;
			while (m--) {
				key = bindArray[m];
				if (!isNaN(parseInt(key))) {
					bindArray[m] = parseInt(key); // Convert "0" to 0, etc.
				}
			}
		}

		return bindArray || [0];
	}

	parentView = parentView || topView;
	var tag, tagDef, template, tags, attr, parentTag, l, m, n, itemRet, tagCtx, tagCtxCtx, ctxPrm, bindTo, bindFrom, initVal,
		content, callInit, mapDef, thisMap, args, bdArgs, props, tagDataMap, contentCtx, key, bindFromLength, bindToLength, linkedElement, defaultCtx,
		i = 0,
		ret = "",
		linkCtx = parentView._lc || false, // For data-link="{myTag...}"... See onDataLinkedTagChange
		ctx = parentView.ctx,
		parentTmpl = tmpl || parentView.tmpl,
		// If tagCtxs is an integer, then it is the key for the compiled function to return the boundTag tagCtxs
		boundTag = typeof tagCtxs === "number" && parentView.tmpl.bnds[tagCtxs-1];

	if (tagName._is === "tag") {
		tag = tagName;
		tagName = tag.tagName;
		tagCtxs = tag.tagCtxs;
		template = tag.template;
	} else {
		tagDef = parentView.getRsc("tags", tagName) || error("Unknown tag: {{" + tagName + "}} ");
		template = tagDef.template;
	}
	if (onError === undefined && boundTag && (boundTag._lr = (tagDef.lateRender && boundTag._lr!== false || boundTag._lr))) {
		onError = ""; // If lateRender, set temporary onError, to skip initial rendering (and render just "")
	}
	if (onError !== undefined) {
		ret += onError;
		tagCtxs = onError = [{props: {}, args: [], params: {props:{}}}];
	} else if (boundTag) {
		tagCtxs = boundTag(parentView.data, parentView, $sub);
	}

	l = tagCtxs.length;
	for (; i < l; i++) {
		tagCtx = tagCtxs[i];
		content = tagCtx.tmpl;
		if (!linkCtx || !linkCtx.tag || i && !linkCtx.tag.inline || tag._er || content && +content===content) {
			// Initialize tagCtx
			// For block tags, tagCtx.tmpl is an integer > 0
			if (content && parentTmpl.tmpls) {
				tagCtx.tmpl = tagCtx.content = parentTmpl.tmpls[content - 1]; // Set the tmpl property to the content of the block tag
			}
			tagCtx.index = i;
			tagCtx.ctxPrm = contextParameter;
			tagCtx.render = renderContent;
			tagCtx.cvtArgs = convertArgs;
			tagCtx.bndArgs = convertBoundArgs;
			tagCtx.view = parentView;
			tagCtx.ctx = extendCtx(extendCtx(tagCtx.ctx, tagDef && tagDef.ctx), ctx); // Clone and extend parentView.ctx
		}
		if (tmpl = tagCtx.props.tmpl) {
			// If the tmpl property is overridden, set the value (when initializing, or, in case of binding: ^tmpl=..., when updating)
			tagCtx.tmpl = parentView._getTmpl(tmpl);
			tagCtx.content = tagCtx.content || tagCtx.tmpl;
		}

		if (!tag) {
			// This will only be hit for initial tagCtx (not for {{else}}) - if the tag instance does not exist yet
			// If the tag has not already been instantiated, we will create a new instance.
			// ~tag will access the tag, even within the rendering of the template content of this tag.
			// From child/descendant tags, can access using ~tag.parent, or ~parentTags.tagName
			tag = new tagDef._ctr();
			callInit = !!tag.init;

			tag.parent = parentTag = ctx && ctx.tag;
			tag.tagCtxs = tagCtxs;

			if (linkCtx) {
				tag.inline = false;
				linkCtx.tag = tag;
			}
			tag.linkCtx = linkCtx;
			if (tag._.bnd = boundTag || linkCtx.fn) {
				// Bound if {^{tag...}} or data-link="{tag...}"
				tag._.ths = tagCtx.params.props["this"]; // Tag has a this=expr binding, to get javascript reference to tag instance
				tag._.lt = tagCtxs.lt; // If a late path @some.path has not returned @some object, mark tag as late
				tag._.arrVws = {};
			} else if (tag.dataBoundOnly) {
				error(tagName + " must be data-bound:\n{^{" + tagName + "}}");
			}
			//TODO better perf for childTags() - keep child tag.tags array, (and remove child, when disposed)
			// tag.tags = [];
		} else if (linkCtx && linkCtx.fn._lr) {
			callInit = !!tag.init;
		}
		tagDataMap = tag.dataMap;

		tagCtx.tag = tag;
		if (tagDataMap && tagCtxs) {
			tagCtx.map = tagCtxs[i].map; // Copy over the compiled map instance from the previous tagCtxs to the refreshed ones
		}
		if (!tag.flow) {
			tagCtxCtx = tagCtx.ctx = tagCtx.ctx || {};

			// tags hash: tag.ctx.tags, merged with parentView.ctx.tags,
			tags = tag.parents = tagCtxCtx.parentTags = ctx && extendCtx(tagCtxCtx.parentTags, ctx.parentTags) || {};
			if (parentTag) {
				tags[parentTag.tagName] = parentTag;
				//TODO better perf for childTags: parentTag.tags.push(tag);
			}
			tags[tag.tagName] = tagCtxCtx.tag = tag;
			tagCtxCtx.tagCtx = tagCtx;
		}
	}
	if (!(tag._er = onError)) {
		tagHandlersFromProps(tag, tagCtxs[0]);
		tag.rendering = {rndr: tag.rendering}; // Provide object for state during render calls to tag and elses. (Used by {{if}} and {{for}}...)
		for (i = 0; i < l; i++) { // Iterate tagCtx for each {{else}} block
			tagCtx = tag.tagCtx = tagCtxs[i];
			props = tagCtx.props;
			tag.ctx = tagCtx.ctx;

			if (!i) {
				if (callInit) {
					tag.init(tagCtx, linkCtx, tag.ctx);
					callInit = undefined;
				}
				if (!tagCtx.args.length && tagCtx.argDefault !== false && tag.argDefault !== false) {
					tagCtx.args = args = [tagCtx.view.data]; // Missing first arg defaults to the current data context
					tagCtx.params.args = ["#data"];
				}

				bindTo = bindToOrBindFrom("bindTo");

				if (tag.bindTo !== undefined) {
					tag.bindTo = bindTo;
				}

				if (tag.bindFrom !== undefined) {
					tag.bindFrom = bindToOrBindFrom("bindFrom");
				} else if (tag.bindTo) {
					tag.bindFrom = tag.bindTo = bindTo;
				}
				bindFrom = tag.bindFrom || bindTo;

				bindToLength = bindTo.length;
				bindFromLength = bindFrom.length;

				if (tag._.bnd && (linkedElement = tag.linkedElement)) {
					tag.linkedElement = linkedElement = $isArray(linkedElement) ? linkedElement: [linkedElement];

					if (bindToLength !== linkedElement.length) {
						error("linkedElement not same length as bindTo");
					}
				}
				if (linkedElement = tag.linkedCtxParam) {
					tag.linkedCtxParam = linkedElement = $isArray(linkedElement) ? linkedElement: [linkedElement];

					if (bindFromLength !== linkedElement.length) {
						error("linkedCtxParam not same length as bindFrom/bindTo");
					}
				}

				if (bindFrom) {
					tag._.fromIndex = {}; // Hash of bindFrom index which has same path value as bindTo index. fromIndex = tag._.fromIndex[toIndex]
					tag._.toIndex = {}; // Hash of bindFrom index which has same path value as bindTo index. fromIndex = tag._.fromIndex[toIndex]
					n = bindFromLength;
					while (n--) {
						key = bindFrom[n];
						m = bindToLength;
						while (m--) {
							if (key === bindTo[m]) {
								tag._.fromIndex[m] = n;
								tag._.toIndex[n] = m;
							}
						}
					}
				}

				if (linkCtx) {
					// Set attr on linkCtx to ensure outputting to the correct target attribute.
					// Setting either linkCtx.attr or this.attr in the init() allows per-instance choice of target attrib.
					linkCtx.attr = tag.attr = linkCtx.attr || tag.attr || linkCtx._dfAt;
				}
				attr = tag.attr;
				tag._.noVws = attr && attr !== HTML;
			}
			args = tag.cvtArgs(i);
			if (tag.linkedCtxParam) {
				bdArgs = tag.cvtArgs(i, 1);
				m = bindFromLength;
				defaultCtx = tag.constructor.prototype.ctx;
				while (m--) {
					if (ctxPrm = tag.linkedCtxParam[m]) {
						key = bindFrom[m];
						initVal = bdArgs[m];
						// Create tag contextual parameter
						tagCtx.ctx[ctxPrm] = $sub._cp(
							defaultCtx && initVal === undefined ? defaultCtx[ctxPrm]: initVal,
							initVal !== undefined && argOrProp(tagCtx.params, key),
							tagCtx.view,
							tag._.bnd && {tag: tag, cvt: tag.convert, ind: m, tagElse: i}
						);
					}
				}
			}
			if ((mapDef = props.dataMap || tagDataMap) && (args.length || props.dataMap)) {
				thisMap = tagCtx.map;
				if (!thisMap || thisMap.src !== args[0] || isUpdate) {
					if (thisMap && thisMap.src) {
						thisMap.unmap(); // only called if observable map - not when only used in JsRender, e.g. by {{props}}
					}
					mapDef.map(args[0], tagCtx, thisMap, !tag._.bnd);
					thisMap = tagCtx.map;
				}
				args = [thisMap.tgt];
			}

			itemRet = undefined;
			if (tag.render) {
				itemRet = tag.render.apply(tag, args);
				if (parentView.linked && itemRet && !rWrappedInViewMarker.test(itemRet)) {
					// When a tag renders content from the render method, with data linking then we need to wrap with view markers, if absent,
					// to provide a contentView for the tag, which will correctly dispose bindings if deleted. The 'tmpl' for this view will
					// be a dumbed-down template which will always return the itemRet string (no matter what the data is). The itemRet string
					// is not compiled as template markup, so can include "{{" or "}}" without triggering syntax errors
					tmpl = { // 'Dumbed-down' template which always renders 'static' itemRet string
						links: []
					};
					tmpl.render = tmpl.fn = function() {
						return itemRet;
					};
					itemRet = renderWithViews(tmpl, parentView.data, undefined, true, parentView, undefined, undefined, tag);
				}
			}
			if (!args.length) {
				args = [parentView]; // no arguments - (e.g. {{else}}) get data context from view.
			}
			if (itemRet === undefined) {
				contentCtx = args[0]; // Default data context for wrapped block content is the first argument
				if (tag.contentCtx) { // Set tag.contentCtx to true, to inherit parent context, or to a function to provide alternate context.
					contentCtx = tag.contentCtx === true ? parentView : tag.contentCtx(contentCtx);
				}
				itemRet = tagCtx.render(contentCtx, true) || (isUpdate ? undefined : "");
			}
			ret = ret
				? ret + (itemRet || "")
				: itemRet !== undefined
					? "" + itemRet
					: undefined; // If no return value from render, and no template/content tagCtx.render(...), return undefined
		}
		tag.rendering = tag.rendering.rndr; // Remove tag.rendering object (if this is outermost render call. (In case of nested calls)
	}
	tag.tagCtx = tagCtxs[0];
	tag.ctx = tag.tagCtx.ctx;

	if (tag._.noVws && tag.inline) {
		// inline tag with attr set to "text" will insert HTML-encoded content - as if it was element-based innerText
		ret = attr === "text"
			? $converters.html(ret)
			: "";
	}
	return boundTag && parentView._.onRender
		// Call onRender (used by JsViews if present, to add binding annotations around rendered content)
		? parentView._.onRender(ret, parentView, tag)
		: ret;
}

//=================
// View constructor
//=================

function View(context, type, parentView, data, template, key, onRender, contentTmpl) {
	// Constructor for view object in view hierarchy. (Augmented by JsViews if JsViews is loaded)
	var views, parentView_, tag, self_,
		self = this,
		isArray = type === "array";
		// If the data is an array, this is an 'array view' with a views array for each child 'item view'
		// If the data is not an array, this is an 'item view' with a views 'hash' object for any child nested views

	self.content = contentTmpl;
	self.views = isArray ? [] : {};
	self.data = data;
	self.tmpl = template;
	self_ = self._ = {
		key: 0,
		// ._.useKey is non zero if is not an 'array view' (owning a data array). Use this as next key for adding to child views hash
		useKey: isArray ? 0 : 1,
		id: "" + viewId++,
		onRender: onRender,
		bnds: {}
	};
	self.linked = !!onRender;
	self.type = type || "top";
	if (type) {
		self.cache = {_ct: $subSettings._cchCt}; // Used for caching results of computed properties and helpers (view.getCache)
	}

	if (!parentView || parentView.type === "top") {
		(self.ctx = context || {}).root = self.data;
	}

	if (self.parent = parentView) {
		self.root = parentView.root || self; // view whose parent is top view
		views = parentView.views;
		parentView_ = parentView._;
		self.isTop = parentView_.scp; // Is top content view of a link("#container", ...) call
		self.scope = (!context.tag || context.tag === parentView.ctx.tag) && !self.isTop && parentView.scope || self;
		// Scope for contextParams - closest non flow tag ancestor or root view
		if (parentView_.useKey) {
			// Parent is not an 'array view'. Add this view to its views object
			// self._key = is the key in the parent view hash
			views[self_.key = "_" + parentView_.useKey++] = self;
			self.index = indexStr;
			self.getIndex = getNestedIndex;
		} else if (views.length === (self_.key = self.index = key)) { // Parent is an 'array view'. Add this view to its views array
			views.push(self); // Adding to end of views array. (Using push when possible - better perf than splice)
		} else {
			views.splice(key, 0, self); // Inserting in views array
		}
		// If no context was passed in, use parent context
		// If context was passed in, it should have been merged already with parent context
		self.ctx = context || parentView.ctx;
	} else if (type) {
		self.root = self; // view whose parent is top view
	}
}

View.prototype = {
	get: getView,
	getIndex: getIndex,
	ctxPrm: contextParameter,
	getRsc: getResource,
	_getTmpl: getTemplate,
	_getOb: getPathObject,
	getCache: function(key) { // Get cached value of computed value
		if ($subSettings._cchCt > this.cache._ct) {
			this.cache = {_ct: $subSettings._cchCt};
		}
		return this.cache[key] !== undefined ? this.cache[key] : (this.cache[key] = cpFnStore[key](this.data, this, $sub));
	},
	_is: "view"
};

//====================================================
// Registration
//====================================================

function compileChildResources(parentTmpl) {
	var storeName, storeNames, resources;
	for (storeName in jsvStores) {
		storeNames = storeName + "s";
		if (parentTmpl[storeNames]) {
			resources = parentTmpl[storeNames];        // Resources not yet compiled
			parentTmpl[storeNames] = {};               // Remove uncompiled resources
			$views[storeNames](resources, parentTmpl); // Add back in the compiled resources
		}
	}
}

//===============
// compileTag
//===============

function compileTag(name, tagDef, parentTmpl) {
	var tmpl, baseTag, prop,
		compiledDef = new $sub._tg();

	function Tag() {
		var tag = this;
		tag._ = {
			unlinked: true
		};
		tag.inline = true;
		tag.tagName = name;
	}

	if ($isFunction(tagDef)) {
		// Simple tag declared as function. No presenter instantation.
		tagDef = {
			depends: tagDef.depends,
			render: tagDef
		};
	} else if (typeof tagDef === STRING) {
		tagDef = {template: tagDef};
	}

	if (baseTag = tagDef.baseTag) {
		tagDef.flow = !!tagDef.flow; // Set flow property, so defaults to false even if baseTag has flow=true
		baseTag = typeof baseTag === STRING
			? (parentTmpl && parentTmpl.tags[baseTag] || $tags[baseTag])
			: baseTag;
		if (!baseTag) {
			error('baseTag: "' + tagDef.baseTag + '" not found');
		}
		compiledDef = $extend(compiledDef, baseTag);

		for (prop in tagDef) {
			compiledDef[prop] = getMethod(baseTag[prop], tagDef[prop]);
		}
	} else {
		compiledDef = $extend(compiledDef, tagDef);
	}

	// Tag declared as object, used as the prototype for tag instantiation (control/presenter)
	if ((tmpl = compiledDef.template) !== undefined) {
		compiledDef.template = typeof tmpl === STRING ? ($templates[tmpl] || $templates(tmpl)) : tmpl;
	}
	(Tag.prototype = compiledDef).constructor = compiledDef._ctr = Tag;

	if (parentTmpl) {
		compiledDef._parentTmpl = parentTmpl;
	}
	return compiledDef;
}

function baseApply(args) {
	// In derived method (or handler declared declaratively as in {{:foo onChange=~fooChanged}} can call base method,
	// using this.baseApply(arguments) (Equivalent to this._superApply(arguments) in jQuery UI)
	return this.base.apply(this, args);
}

//===============
// compileTmpl
//===============

function compileTmpl(name, tmpl, parentTmpl, options) {
	// tmpl is either a template object, a selector for a template script block, or the name of a compiled template

	//==== nested functions ====
	function lookupTemplate(value) {
		// If value is of type string - treat as selector, or name of compiled template
		// Return the template object, if already compiled, or the markup string
		var currentName, tmpl;
		if ((typeof value === STRING) || value.nodeType > 0 && (elem = value)) {
			if (!elem) {
				if (/^\.?\/[^\\:*?"<>]*$/.test(value)) {
					// value="./some/file.html" (or "/some/file.html")
					// If the template is not named, use "./some/file.html" as name.
					if (tmpl = $templates[name = name || value]) {
						value = tmpl;
					} else {
						// BROWSER-SPECIFIC CODE (not on Node.js):
						// Look for server-generated script block with id "./some/file.html"
						elem = document.getElementById(value);
					}
				} else if (value.charAt(0) === "#") {
					elem = document.getElementById(value.slice(1));
				} if (!elem && $.fn && !$sub.rTmpl.test(value)) {
					try {
						elem = $(value, document)[0]; // if jQuery is loaded, test for selector returning elements, and get first element
					} catch (e) {}
				}// END BROWSER-SPECIFIC CODE
			} //BROWSER-SPECIFIC CODE
			if (elem) {
				if (elem.tagName !== "SCRIPT") {
					error(value + ": Use script block, not " + elem.tagName);
				}
				if (options) {
					// We will compile a new template using the markup in the script element
					value = elem.innerHTML;
				} else {
					// We will cache a single copy of the compiled template, and associate it with the name
					// (renaming from a previous name if there was one).
					currentName = elem.getAttribute(tmplAttr);
					if (currentName) {
						if (currentName !== jsvTmpl) {
							value = $templates[currentName];
							delete $templates[currentName];
						} else if ($.fn) {
							value = $.data(elem)[jsvTmpl]; // Get cached compiled template
						}
					}
					if (!currentName || !value) { // Not yet compiled, or cached version lost
						name = name || ($.fn ? jsvTmpl : value);
						value = compileTmpl(name, elem.innerHTML, parentTmpl, options);
					}
					value.tmplName = name = name || currentName;
					if (name !== jsvTmpl) {
						$templates[name] = value;
					}
					elem.setAttribute(tmplAttr, name);
					if ($.fn) {
						$.data(elem, jsvTmpl, value);
					}
				}
			} // END BROWSER-SPECIFIC CODE
			elem = undefined;
		} else if (!value.fn) {
			value = undefined;
			// If value is not a string. HTML element, or compiled template, return undefined
		}
		return value;
	}

	var elem, compiledTmpl,
		tmplOrMarkup = tmpl = tmpl || "";
	$sub._html = $converters.html;

	//==== Compile the template ====
	if (options === 0) {
		options = undefined;
		tmplOrMarkup = lookupTemplate(tmplOrMarkup); // Top-level compile so do a template lookup
	}

	// If options, then this was already compiled from a (script) element template declaration.
	// If not, then if tmpl is a template object, use it for options
	options = options || (tmpl.markup
		? tmpl.bnds
			? $extend({}, tmpl)
			: tmpl
		: {}
	);

	options.tmplName = options.tmplName || name || "unnamed";
	if (parentTmpl) {
		options._parentTmpl = parentTmpl;
	}
	// If tmpl is not a markup string or a selector string, then it must be a template object
	// In that case, get it from the markup property of the object
	if (!tmplOrMarkup && tmpl.markup && (tmplOrMarkup = lookupTemplate(tmpl.markup)) && tmplOrMarkup.fn) {
		// If the string references a compiled template object, need to recompile to merge any modified options
		tmplOrMarkup = tmplOrMarkup.markup;
	}
	if (tmplOrMarkup !== undefined) {
		if (tmplOrMarkup.render || tmpl.render) {
			// tmpl is already compiled, so use it
			if (tmplOrMarkup.tmpls) {
				compiledTmpl = tmplOrMarkup;
			}
		} else {
			// tmplOrMarkup is a markup string, not a compiled template
			// Create template object
			tmpl = tmplObject(tmplOrMarkup, options);
			// Compile to AST and then to compiled function
			tmplFn(tmplOrMarkup.replace(rEscapeQuotes, "\\$&"), tmpl);
		}
		if (!compiledTmpl) {
			compiledTmpl = $extend(function() {
				return compiledTmpl.render.apply(compiledTmpl, arguments);
			}, tmpl);

			compileChildResources(compiledTmpl);
		}
		return compiledTmpl;
	}
}

//==== /end of function compileTmpl ====

//=================
// compileViewModel
//=================

function getDefaultVal(defaultVal, data) {
	return $isFunction(defaultVal)
		? defaultVal.call(data)
		: defaultVal;
}

function addParentRef(ob, ref, parent) {
	Object.defineProperty(ob, ref, {
		value: parent,
		configurable: true
	});
}

function compileViewModel(name, type) {
	var i, constructor, parent,
		viewModels = this,
		getters = type.getters,
		extend = type.extend,
		id = type.id,
		proto = $.extend({
			_is: name || "unnamed",
			unmap: unmap,
			merge: merge
		}, extend),
		args = "",
		cnstr = "",
		getterCount = getters ? getters.length : 0,
		$observable = $.observable,
		getterNames = {};

	function JsvVm(args) {
		constructor.apply(this, args);
	}

	function vm() {
		return new JsvVm(arguments);
	}

	function iterate(data, action) {
		var getterType, defaultVal, prop, ob, parentRef,
			j = 0;
		for (; j < getterCount; j++) {
			prop = getters[j];
			getterType = undefined;
			if (typeof prop !== STRING) {
				getterType = prop;
				prop = getterType.getter;
				parentRef = getterType.parentRef;
			}
			if ((ob = data[prop]) === undefined && getterType && (defaultVal = getterType.defaultVal) !== undefined) {
				ob = getDefaultVal(defaultVal, data);
			}
			action(ob, getterType && viewModels[getterType.type], prop, parentRef);
		}
	}

	function map(data) {
		data = typeof data === STRING
			? JSON.parse(data) // Accept JSON string
			: data;            // or object/array
		var l, prop, childOb, parentRef,
			j = 0,
			ob = data,
			arr = [];

		if ($isArray(data)) {
			data = data || [];
			l = data.length;
			for (; j<l; j++) {
				arr.push(this.map(data[j]));
			}
			arr._is = name;
			arr.unmap = unmap;
			arr.merge = merge;
			return arr;
		}

		if (data) {
			iterate(data, function(ob, viewModel) {
				if (viewModel) { // Iterate to build getters arg array (value, or mapped value)
					ob = viewModel.map(ob);
				}
				arr.push(ob);
			});
			ob = this.apply(this, arr); // Instantiate this View Model, passing getters args array to constructor
			j = getterCount;
			while (j--) {
				childOb = arr[j];
				parentRef = getters[j].parentRef;
				if (parentRef && childOb && childOb.unmap) {
					if ($isArray(childOb)) {
						l = childOb.length;
						while (l--) {
							addParentRef(childOb[l], parentRef, ob);
						}
					} else {
						addParentRef(childOb, parentRef, ob);
					}
				}
			}
			for (prop in data) { // Copy over any other properties. that are not get/set properties
				if (prop !== $expando && !getterNames[prop]) {
					ob[prop] = data[prop];
				}
			}
		}
		return ob;
	}

	function merge(data, parent, parentRef) {
		data = typeof data === STRING
			? JSON.parse(data) // Accept JSON string
			: data;            // or object/array

		var j, l, m, prop, mod, found, assigned, ob, newModArr, childOb,
			k = 0,
			model = this;

		if ($isArray(model)) {
			assigned = {};
			newModArr = [];
			l = data.length;
			m = model.length;
			for (; k<l; k++) {
				ob = data[k];
				found = false;
				for (j=0; j<m && !found; j++) {
					if (assigned[j]) {
						continue;
					}
					mod = model[j];

					if (id) {
						assigned[j] = found = typeof id === STRING
						? (ob[id] && (getterNames[id] ? mod[id]() : mod[id]) === ob[id])
						: id(mod, ob);
					}
				}
				if (found) {
					mod.merge(ob);
					newModArr.push(mod);
				} else {
					newModArr.push(childOb = vm.map(ob));
					if (parentRef) {
						addParentRef(childOb, parentRef, parent);
					}
				}
			}
			if ($observable) {
				$observable(model).refresh(newModArr, true);
			} else {
				model.splice.apply(model, [0, model.length].concat(newModArr));
			}
			return;
		}
		iterate(data, function(ob, viewModel, getter, parentRef) {
			if (viewModel) {
				model[getter]().merge(ob, model, parentRef); // Update typed property
			} else if (model[getter]() !== ob) {
				model[getter](ob); // Update non-typed property
			}
		});
		for (prop in data) {
			if (prop !== $expando && !getterNames[prop]) {
				model[prop] = data[prop];
			}
		}
	}

	function unmap() {
		var ob, prop, getterType, arr, value,
			k = 0,
			model = this;

		function unmapArray(modelArr) {
			var arr = [],
				i = 0,
				l = modelArr.length;
			for (; i<l; i++) {
				arr.push(modelArr[i].unmap());
			}
			return arr;
		}

		if ($isArray(model)) {
			return unmapArray(model);
		}
		ob = {};
		for (; k < getterCount; k++) {
			prop = getters[k];
			getterType = undefined;
			if (typeof prop !== STRING) {
				getterType = prop;
				prop = getterType.getter;
			}
			value = model[prop]();
			ob[prop] = getterType && value && viewModels[getterType.type]
				? $isArray(value)
					? unmapArray(value)
					: value.unmap()
				: value;
		}
		for (prop in model) {
			if (model.hasOwnProperty(prop) && (prop.charAt(0) !== "_" || !getterNames[prop.slice(1)]) && prop !== $expando && !$isFunction(model[prop])) {
				ob[prop] = model[prop];
			}
		}
		return ob;
	}

	JsvVm.prototype = proto;

	for (i=0; i < getterCount; i++) {
		(function(getter) {
			getter = getter.getter || getter;
			getterNames[getter] = i+1;
			var privField = "_" + getter;

			args += (args ? "," : "") + getter;
			cnstr += "this." + privField + " = " + getter + ";\n";
			proto[getter] = proto[getter] || function(val) {
				if (!arguments.length) {
					return this[privField]; // If there is no argument, use as a getter
				}
				if ($observable) {
					$observable(this).setProperty(getter, val);
				} else {
					this[privField] = val;
				}
			};

			if ($observable) {
				proto[getter].set = proto[getter].set || function(val) {
					this[privField] = val; // Setter called by observable property change
				};
			}
		})(getters[i]);
	}

	// Constructor for new viewModel instance.
	cnstr = new Function(args, cnstr);

	constructor = function() {
		cnstr.apply(this, arguments);
		// Pass additional parentRef str and parent obj to have a parentRef pointer on instance
		if (parent = arguments[getterCount + 1]) {
			addParentRef(this, arguments[getterCount], parent);
		}
	};

	constructor.prototype = proto;
	proto.constructor = constructor;

	vm.map = map;
	vm.getters = getters;
	vm.extend = extend;
	vm.id = id;
	return vm;
}

function tmplObject(markup, options) {
	// Template object constructor
	var htmlTag,
		wrapMap = $subSettingsAdvanced._wm || {}, // Only used in JsViews. Otherwise empty: {}
		tmpl = {
			tmpls: [],
			links: {}, // Compiled functions for link expressions
			bnds: [],
			_is: "template",
			render: renderContent
		};

	if (options) {
		tmpl = $extend(tmpl, options);
	}

	tmpl.markup = markup;
	if (!tmpl.htmlTag) {
		// Set tmpl.tag to the top-level HTML tag used in the template, if any...
		htmlTag = rFirstElem.exec(markup);
		tmpl.htmlTag = htmlTag ? htmlTag[1].toLowerCase() : "";
	}
	htmlTag = wrapMap[tmpl.htmlTag];
	if (htmlTag && htmlTag !== wrapMap.div) {
		// When using JsViews, we trim templates which are inserted into HTML contexts where text nodes are not rendered (i.e. not 'Phrasing Content').
		// Currently not trimmed for <li> tag. (Not worth adding perf cost)
		tmpl.markup = $.trim(tmpl.markup);
	}

	return tmpl;
}

//==============
// registerStore
//==============

/**
* Internal. Register a store type (used for template, tags, helpers, converters)
*/
function registerStore(storeName, storeSettings) {

/**
* Generic store() function to register item, named item, or hash of items
* Also used as hash to store the registered items
* Used as implementation of $.templates(), $.views.templates(), $.views.tags(), $.views.helpers() and $.views.converters()
*
* @param {string|hash} name         name - or selector, in case of $.templates(). Or hash of items
* @param {any}         [item]       (e.g. markup for named template)
* @param {template}    [parentTmpl] For item being registered as private resource of template
* @returns {any|$.views} item, e.g. compiled template - or $.views in case of registering hash of items
*/
	function theStore(name, item, parentTmpl) {
		// The store is also the function used to add items to the store. e.g. $.templates, or $.views.tags

		// For store of name 'thing', Call as:
		//    $.views.things(items[, parentTmpl]),
		// or $.views.things(name[, item, parentTmpl])

		var compile, itemName, thisStore, cnt,
			onStore = $sub.onStore[storeName];

		if (name && typeof name === OBJECT && !name.nodeType && !name.markup && !name.getTgt && !(storeName === "viewModel" && name.getters || name.extend)) {
			// Call to $.views.things(items[, parentTmpl]),

			// Adding items to the store
			// If name is a hash, then item is parentTmpl. Iterate over hash and call store for key.
			for (itemName in name) {
				theStore(itemName, name[itemName], item);
			}
			return item || $views;
		}
		// Adding a single unnamed item to the store
		if (name &&  typeof name !== STRING) { // name must be a string
			parentTmpl = item;
			item = name;
			name = undefined;
		}
		thisStore = parentTmpl
			? storeName === "viewModel"
				? parentTmpl
				: (parentTmpl[storeNames] = parentTmpl[storeNames] || {})
			: theStore;
		compile = storeSettings.compile;

		if (item === undefined) {
			item = compile ? name : thisStore[name];
			name = undefined;
		}
		if (item === null) {
			// If item is null, delete this entry
			if (name) {
				delete thisStore[name];
			}
		} else {
			if (compile) {
				item = compile.call(thisStore, name, item, parentTmpl, 0) || {};
				item._is = storeName; // Only do this for compiled objects (tags, templates...)
			}
			if (name) {
				thisStore[name] = item;
			}
		}
		if (onStore) {
			// e.g. JsViews integration
			onStore(name, item, parentTmpl, compile);
		}
		return item;
	}

	var storeNames = storeName + "s";
	$views[storeNames] = theStore;
}

/**
* Add settings such as:
* $.views.settings.allowCode(true)
* @param {boolean} value
* @returns {Settings}
*
* allowCode = $.views.settings.allowCode()
* @returns {boolean}
*/
function addSetting(st) {
	$viewsSettings[st] = $viewsSettings[st] || function(value) {
		return arguments.length
			? ($subSettings[st] = value, $viewsSettings)
			: $subSettings[st];
	};
}

//========================
// dataMap for render only
//========================

function dataMap(mapDef) {
	function Map(source, options) {
		this.tgt = mapDef.getTgt(source, options);
		options.map = this;
	}

	if ($isFunction(mapDef)) {
		// Simple map declared as function
		mapDef = {
			getTgt: mapDef
		};
	}

	if (mapDef.baseMap) {
		mapDef = $extend($extend({}, mapDef.baseMap), mapDef);
	}

	mapDef.map = function(source, options) {
		return new Map(source, options);
	};
	return mapDef;
}

//==============
// renderContent
//==============

/** Render the template as a string, using the specified data and helpers/context
* $("#tmpl").render(), tmpl.render(), tagCtx.render(), $.render.namedTmpl()
*
* @param {any}        data
* @param {hash}       [context]           helpers or context
* @param {boolean}    [noIteration]
* @param {View}       [parentView]        internal
* @param {string}     [key]               internal
* @param {function}   [onRender]          internal
* @returns {string}   rendered template   internal
*/
function renderContent(data, context, noIteration, parentView, key, onRender) {
	var i, l, tag, tmpl, tagCtx, isTopRenderCall, prevData, prevIndex,
		view = parentView,
		result = "";

	if (context === true) {
		noIteration = context; // passing boolean as second param - noIteration
		context = undefined;
	} else if (typeof context !== OBJECT) {
		context = undefined; // context must be a boolean (noIteration) or a plain object
	}

	if (tag = this.tag) {
		// This is a call from renderTag or tagCtx.render(...)
		tagCtx = this;
		view = view || tagCtx.view;
		tmpl = view._getTmpl(tag.template || tagCtx.tmpl);
		if (!arguments.length) {
			data = tag.contentCtx && $isFunction(tag.contentCtx)
				? data = tag.contentCtx(data)
				: view; // Default data context for wrapped block content is the first argument
		}
	} else {
		// This is a template.render(...) call
		tmpl = this;
	}

	if (tmpl) {
		if (!parentView && data && data._is === "view") {
			view = data; // When passing in a view to render or link (and not passing in a parent view) use the passed-in view as parentView
		}

		if (view && data === view) {
			// Inherit the data from the parent view.
			data = view.data;
		}

		isTopRenderCall = !view;
		isRenderCall = isRenderCall || isTopRenderCall;
		if (isTopRenderCall) {
			(context = context || {}).root = data; // Provide ~root as shortcut to top-level data.
		}
		if (!isRenderCall || $subSettingsAdvanced.useViews || tmpl.useViews || view && view !== topView) {
			result = renderWithViews(tmpl, data, context, noIteration, view, key, onRender, tag);
		} else {
			if (view) { // In a block
				prevData = view.data;
				prevIndex = view.index;
				view.index = indexStr;
			} else {
				view = topView;
				prevData = view.data;
				view.data = data;
				view.ctx = context;
			}
			if ($isArray(data) && !noIteration) {
				// Create a view for the array, whose child views correspond to each data item. (Note: if key and parentView are passed in
				// along with parent view, treat as insert -e.g. from view.addViews - so parentView is already the view item for array)
				for (i = 0, l = data.length; i < l; i++) {
					view.index = i;
					view.data = data[i];
					result += tmpl.fn(data[i], view, $sub);
				}
			} else {
				view.data = data;
				result += tmpl.fn(data, view, $sub);
			}
			view.data = prevData;
			view.index = prevIndex;
		}
		if (isTopRenderCall) {
			isRenderCall = undefined;
		}
	}
	return result;
}

function renderWithViews(tmpl, data, context, noIteration, view, key, onRender, tag) {
	// Render template against data as a tree of subviews (nested rendered template instances), or as a string (top-level template).
	// If the data is the parent view, treat as noIteration, re-render with the same data context.
	// tmpl can be a string (e.g. rendered by a tag.render() method), or a compiled template.
	var i, l, newView, childView, itemResult, swapContent, contentTmpl, outerOnRender, tmplName, itemVar, newCtx, tagCtx, noLinking,
		result = "";

	if (tag) {
		// This is a call from renderTag or tagCtx.render(...)
		tmplName = tag.tagName;
		tagCtx = tag.tagCtx;
		context = context ? extendCtx(context, tag.ctx) : tag.ctx;

		if (tmpl === view.content) { // {{xxx tmpl=#content}}
			contentTmpl = tmpl !== view.ctx._wrp // We are rendering the #content
				? view.ctx._wrp // #content was the tagCtx.props.tmpl wrapper of the block content - so within this view, #content will now be the view.ctx._wrp block content
				: undefined; // #content was the view.ctx._wrp block content - so within this view, there is no longer any #content to wrap.
		} else if (tmpl !== tagCtx.content) {
			if (tmpl === tag.template) { // Rendering {{tag}} tag.template, replacing block content.
				contentTmpl = tagCtx.tmpl; // Set #content to block content (or wrapped block content if tagCtx.props.tmpl is set)
				context._wrp = tagCtx.content; // Pass wrapped block content to nested views
			} else { // Rendering tagCtx.props.tmpl wrapper
				contentTmpl = tagCtx.content || view.content; // Set #content to wrapped block content
			}
		} else {
			contentTmpl = view.content; // Nested views inherit same wrapped #content property
		}

		if (tagCtx.props.link === false) {
			// link=false setting on block tag
			// We will override inherited value of link by the explicit setting link=false taken from props
			// The child views of an unlinked view are also unlinked. So setting child back to true will not have any effect.
			context = context || {};
			context.link = false;
		}
	}

	if (view) {
		onRender = onRender || view._.onRender;
		noLinking = context && context.link === false;

		if (noLinking && view._.nl) {
			onRender = undefined;
		}

		context = extendCtx(context, view.ctx);
		tagCtx = !tag && view.tag
			? view.tag.tagCtxs[view.tagElse]
			: tagCtx;
	}

	if (itemVar = tagCtx && tagCtx.props.itemVar) {
		if (itemVar[0] !== "~") {
			syntaxError("Use itemVar='~myItem'");
		}
		itemVar = itemVar.slice(1);
	}

	if (key === true) {
		swapContent = true;
		key = 0;
	}

	// If link===false, do not call onRender, so no data-linking marker nodes
	if (onRender && tag && tag._.noVws) {
		onRender = undefined;
	}
	outerOnRender = onRender;
	if (onRender === true) {
		// Used by view.refresh(). Don't create a new wrapper view.
		outerOnRender = undefined;
		onRender = view._.onRender;
	}
	// Set additional context on views created here, (as modified context inherited from the parent, and to be inherited by child views)
	context = tmpl.helpers
		? extendCtx(tmpl.helpers, context)
		: context;

	newCtx = context;
	if ($isArray(data) && !noIteration) {
		// Create a view for the array, whose child views correspond to each data item. (Note: if key and view are passed in
		// along with parent view, treat as insert -e.g. from view.addViews - so view is already the view item for array)
		newView = swapContent
			? view
			: (key !== undefined && view)
				|| new View(context, "array", view, data, tmpl, key, onRender, contentTmpl);
		newView._.nl= noLinking;
		if (view && view._.useKey) {
			// Parent is not an 'array view'
			newView._.bnd = !tag || tag._.bnd && tag; // For array views that are data bound for collection change events, set the
			// view._.bnd property to true for top-level link() or data-link="{for}", or to the tag instance for a data-bound tag, e.g. {^{for ...}}
			newView.tag = tag;
		}
		for (i = 0, l = data.length; i < l; i++) {
			// Create a view for each data item.
			childView = new View(newCtx, "item", newView, data[i], tmpl, (key || 0) + i, onRender, newView.content);
			if (itemVar) {
				(childView.ctx = $extend({}, newCtx))[itemVar] = $sub._cp(data[i], "#data", childView);
			}
			itemResult = tmpl.fn(data[i], childView, $sub);
			result += newView._.onRender ? newView._.onRender(itemResult, childView) : itemResult;
		}
	} else {
		// Create a view for singleton data object. The type of the view will be the tag name, e.g. "if" or "mytag" except for
		// "item", "array" and "data" views. A "data" view is from programmatic render(object) against a 'singleton'.
		newView = swapContent ? view : new View(newCtx, tmplName || "data", view, data, tmpl, key, onRender, contentTmpl);

		if (itemVar) {
			(newView.ctx = $extend({}, newCtx))[itemVar] = $sub._cp(data, "#data", newView);
		}

		newView.tag = tag;
		newView._.nl = noLinking;
		result += tmpl.fn(data, newView, $sub);
	}
	if (tag) {
		newView.tagElse = tagCtx.index;
		tagCtx.contentView = newView;
	}
	return outerOnRender ? outerOnRender(result, newView) : result;
}

//===========================
// Build and compile template
//===========================

// Generate a reusable function that will serve to render a template against data
// (Compile AST then build template function)

function onRenderError(e, view, fallback) {
	var message = fallback !== undefined
		? $isFunction(fallback)
			? fallback.call(view.data, e, view)
			: fallback || ""
		: "{Error: " + (e.message||e) + "}";

	if ($subSettings.onError && (fallback = $subSettings.onError.call(view.data, e, fallback && message, view)) !== undefined) {
		message = fallback; // There is a settings.debugMode(handler) onError override. Call it, and use return value (if any) to replace message
	}
	return view && !view._lc ? $converters.html(message) : message; // For data-link=\"{... onError=...}"... See onDataLinkedTagChange
}

function error(message) {
	throw new $sub.Err(message);
}

function syntaxError(message) {
	error("Syntax error\n" + message);
}

function tmplFn(markup, tmpl, isLinkExpr, convertBack, hasElse) {
	// Compile markup to AST (abtract syntax tree) then build the template function code from the AST nodes
	// Used for compiling templates, and also by JsViews to build functions for data link expressions

	//==== nested functions ====
	function pushprecedingContent(shift) {
		shift -= loc;
		if (shift) {
			content.push(markup.substr(loc, shift).replace(rNewLine, "\\n"));
		}
	}

	function blockTagCheck(tagName, block) {
		if (tagName) {
			tagName += '}}';
			//			'{{include}} block has {{/for}} with no open {{for}}'
			syntaxError((
				block
					? '{{' + block + '}} block has {{/' + tagName + ' without {{' + tagName
					: 'Unmatched or missing {{/' + tagName) + ', in template:\n' + markup);
		}
	}

	function parseTag(all, bind, tagName, converter, colon, html, codeTag, params, slash, bind2, closeBlock, index) {
/*

     bind     tagName         cvt   cln html code    params            slash   bind2         closeBlk  comment
/(?:{(\^)?{(?:(\w+(?=[\/\s}]))|(\w+)?(:)|(>)|(\*))\s*((?:[^}]|}(?!}))*?)(\/)?|{(\^)?{(?:(?:\/(\w+))\s*|!--[\s\S]*?--))}}/g

(?:
  {(\^)?{            bind
  (?:
    (\w+             tagName
      (?=[\/\s}])
    )
    |
    (\w+)?(:)        converter colon
    |
    (>)              html
    |
    (\*)             codeTag
  )
  \s*
  (                  params
    (?:[^}]|}(?!}))*?
  )
  (\/)?              slash
  |
  {(\^)?{            bind2
  (?:
    (?:\/(\w+))\s*   closeBlock
    |
    !--[\s\S]*?--    comment
  )
)
}}/g

*/
		if (codeTag && bind || slash && !tagName || params && params.slice(-1) === ":" || bind2) {
			syntaxError(all);
		}

		// Build abstract syntax tree (AST): [tagName, converter, params, content, hash, bindings, contentMarkup]
		if (html) {
			colon = ":";
			converter = HTML;
		}
		slash = slash || isLinkExpr && !hasElse;

		var late, openTagName, isLateOb,
			pathBindings = (bind || isLinkExpr) && [[]], // pathBindings is an array of arrays for arg bindings and a hash of arrays for prop bindings
			props = "",
			args = "",
			ctxProps = "",
			paramsArgs = "",
			paramsProps = "",
			paramsCtxProps = "",
			onError = "",
			useTrigger = "",
			// Block tag if not self-closing and not {{:}} or {{>}} (special case) and not a data-link expression
			block = !slash && !colon;

		//==== nested helper function ====
		tagName = tagName || (params = params || "#data", colon); // {{:}} is equivalent to {{:#data}}
		pushprecedingContent(index);
		loc = index + all.length; // location marker - parsed up to here
		if (codeTag) {
			if (allowCode) {
				content.push(["*", "\n" + params.replace(/^:/, "ret+= ").replace(rUnescapeQuotes, "$1") + ";\n"]);
			}
		} else if (tagName) {
			if (tagName === "else") {
				if (rTestElseIf.test(params)) {
					syntaxError('For "{{else if expr}}" use "{{else expr}}"');
				}
				pathBindings = current[9] && [[]];
				current[10] = markup.substring(current[10], index); // contentMarkup for block tag
				openTagName = current[11] || current[0] || syntaxError("Mismatched: " + all);
				// current[0] is tagName, but for {{else}} nodes, current[11] is tagName of preceding open tag
				current = stack.pop();
				content = current[2];
				block = true;
			}
			if (params) {
				// remove newlines from the params string, to avoid compiled code errors for unterminated strings
				parseParams(params.replace(rNewLine, " "), pathBindings, tmpl, isLinkExpr)
					.replace(rBuildHash, function(all, onerror, isCtxPrm, key, keyToken, keyValue, arg, param) {
						if (key === "this:") {
							keyValue = "undefined"; // this=some.path is always a to parameter (one-way), so don't need to compile/evaluate some.path initialization
						}
						if (param) {
							isLateOb = isLateOb || param[0] === "@";
						}
						key = "'" + keyToken + "':";
						if (arg) {
							args += isCtxPrm + keyValue + ",";
							paramsArgs += "'" + param + "',";
						} else if (isCtxPrm) { // Contextual parameter, ~foo=expr
							ctxProps += key + 'j._cp(' + keyValue + ',"' + param + '",view),';
							// Compiled code for evaluating tagCtx on a tag will have: ctx:{'foo':j._cp(compiledExpr, "expr", view)}
							paramsCtxProps += key + "'" + param + "',";
						} else if (onerror) {
							onError += keyValue;
						} else {
							if (keyToken === "trigger") {
								useTrigger += keyValue;
							}
							if (keyToken === "lateRender") {
								late = param !== "false"; // Render after first pass
							}
							props += key + keyValue + ",";
							paramsProps += key + "'" + param + "',";
							hasHandlers = hasHandlers || rHasHandlers.test(keyToken);
						}
						return "";
					}).slice(0, -1);
			}

			if (pathBindings && pathBindings[0]) {
				pathBindings.pop(); // Remove the binding that was prepared for next arg. (There is always an extra one ready).
			}

			newNode = [
					tagName,
					converter || !!convertBack || hasHandlers || "",
					block && [],
					parsedParam(paramsArgs || (tagName === ":" ? "'#data'," : ""), paramsProps, paramsCtxProps), // {{:}} equivalent to {{:#data}}
					parsedParam(args || (tagName === ":" ? "data," : ""), props, ctxProps),
					onError,
					useTrigger,
					late,
					isLateOb,
					pathBindings || 0
				];
			content.push(newNode);
			if (block) {
				stack.push(current);
				current = newNode;
				current[10] = loc; // Store current location of open tag, to be able to add contentMarkup when we reach closing tag
				current[11] = openTagName; // Used for checking syntax (matching close tag)
			}
		} else if (closeBlock) {
			blockTagCheck(closeBlock !== current[0] && closeBlock !== current[11] && closeBlock, current[0]); // Check matching close tag name
			current[10] = markup.substring(current[10], index); // contentMarkup for block tag
			current = stack.pop();
		}
		blockTagCheck(!current && closeBlock);
		content = current[2];
	}
	//==== /end of nested functions ====

	var i, result, newNode, hasHandlers, bindings,
		allowCode = $subSettings.allowCode || tmpl && tmpl.allowCode
			|| $viewsSettings.allowCode === true, // include direct setting of settings.allowCode true for backward compat only
		astTop = [],
		loc = 0,
		stack = [],
		content = astTop,
		current = [,,astTop];

	if (allowCode && tmpl._is) {
		tmpl.allowCode = allowCode;
	}

//TODO	result = tmplFnsCache[markup]; // Only cache if template is not named and markup length < ...,
//and there are no bindings or subtemplates?? Consider standard optimization for data-link="a.b.c"
//		if (result) {
//			tmpl.fn = result;
//		} else {

//		result = markup;
	if (isLinkExpr) {
		if (convertBack !== undefined) {
			markup = markup.slice(0, -convertBack.length - 2) + delimCloseChar0;
		}
		markup = delimOpenChar0 + markup + delimCloseChar1;
	}

	blockTagCheck(stack[0] && stack[0][2].pop()[0]);
	// Build the AST (abstract syntax tree) under astTop
	markup.replace(rTag, parseTag);

	pushprecedingContent(markup.length);

	if (loc = astTop[astTop.length - 1]) {
		blockTagCheck(typeof loc !== STRING && (+loc[10] === loc[10]) && loc[0]);
	}
//			result = tmplFnsCache[markup] = buildCode(astTop, tmpl);
//		}

	if (isLinkExpr) {
		result = buildCode(astTop, markup, isLinkExpr);
		bindings = [];
		i = astTop.length;
		while (i--) {
			bindings.unshift(astTop[i][9]); // With data-link expressions, pathBindings array for tagCtx[i] is astTop[i][9]
		}
		setPaths(result, bindings);
	} else {
		result = buildCode(astTop, tmpl);
	}
	return result;
}

function setPaths(fn, pathsArr) {
	var key, paths,
		i = 0,
		l = pathsArr.length;
	fn.deps = [];
	fn.paths = []; // The array of path binding (array/dictionary)s for each tag/else block's args and props
	for (; i < l; i++) {
		fn.paths.push(paths = pathsArr[i]);
		for (key in paths) {
			if (key !== "_jsvto" && paths.hasOwnProperty(key) && paths[key].length && !paths[key].skp) {
				fn.deps = fn.deps.concat(paths[key]); // deps is the concatenation of the paths arrays for the different bindings
			}
		}
	}
}

function parsedParam(args, props, ctx) {
	return [args.slice(0, -1), props.slice(0, -1), ctx.slice(0, -1)];
}

function paramStructure(paramCode, paramVals) {
	return '\n\tparams:{args:[' + paramCode[0] + '],\n\tprops:{' + paramCode[1] + '}'
		+ (paramCode[2] ? ',\n\tctx:{' + paramCode[2] + '}' : "")
		+ '},\n\targs:[' + paramVals[0] + '],\n\tprops:{' + paramVals[1] + '}'
		+ (paramVals[2] ? ',\n\tctx:{' + paramVals[2] + '}' : "");
}

function parseParams(params, pathBindings, tmpl, isLinkExpr) {

	function parseTokens(all, lftPrn0, lftPrn, bound, path, operator, err, eq, path2, late, prn,
												comma, lftPrn2, apos, quot, rtPrn, rtPrnDot, prn2, space, index, full) {
	// /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|~(?![\w$])|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(?:(\()\s*)?\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//lftPrn0           lftPrn         bound     path               operator     err                                          eq      path2 late            prn      comma  lftPrn2          apos quot        rtPrn  rtPrnDot                  prn2     space
	// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space

		function parsePath(allPath, not, object, helper, view, viewProperty, pathTokens, leafToken) {
			// /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
			//    not                               object     helper    view  viewProperty pathTokens      leafToken
			subPath = object === ".";
			if (object) {
				path = path.slice(not.length);
				if (/^\.?constructor$/.test(leafToken||path)) {
					syntaxError(allPath);
				}
				if (!subPath) {
					allPath = (late // late path @a.b.c: not throw on 'property of undefined' if a undefined, and will use _getOb() after linking to resolve late.
							? (isLinkExpr ? '' : '(ltOb.lt=ltOb.lt||') + '(ob='
							: ""
						)
						+ (helper
							? 'view.ctxPrm("' + helper + '")'
							: view
								? "view"
								: "data")
						+ (late
							? ')===undefined' + (isLinkExpr ? '' : ')') + '?"":view._getOb(ob,"'
							: ""
						)
						+ (leafToken
							? (viewProperty
								? "." + viewProperty
								: helper
									? ""
									: (view ? "" : "." + object)
								) + (pathTokens || "")
							: (leafToken = helper ? "" : view ? viewProperty || "" : object, ""));
					allPath = allPath + (leafToken ? "." + leafToken : "");

					allPath = not + (allPath.slice(0, 9) === "view.data"
						? allPath.slice(5) // convert #view.data... to data...
						: allPath)
					+ (late
							? (isLinkExpr ? '"': '",ltOb') + (prn ? ',1)':')')
							: ""
						);
				}
				if (bindings) {
					binds = named === "_linkTo" ? (bindto = pathBindings._jsvto = pathBindings._jsvto || []) : bndCtx.bd;
					if (theOb = subPath && binds[binds.length-1]) {
						if (theOb._cpfn) { // Computed property exprOb
							while (theOb.sb) {
								theOb = theOb.sb;
							}
							if (theOb.prm) {
								if (theOb.bnd) {
									path = "^" + path.slice(1);
								}
								theOb.sb = path;
								theOb.bnd = theOb.bnd || path[0] === "^";
							}
						}
					} else {
						binds.push(path);
					}
					if (prn && !subPath) {
						pathStart[fnDp] = ind;
						compiledPathStart[fnDp] = compiledPath[fnDp].length;
					}
				}
			}
			return allPath;
		}

		//bound = bindings && bound;
		if (bound && !eq) {
			path = bound + path; // e.g. some.fn(...)^some.path - so here path is "^some.path"
		}
		operator = operator || "";
		lftPrn2 = lftPrn2 || "";
		lftPrn = lftPrn || lftPrn0 || lftPrn2;
		path = path || path2;

		if (late && (late = !/\)|]/.test(full[index-1]))) {
			path = path.slice(1).split(".").join("^"); // Late path @z.b.c. Use "^" rather than "." to ensure that deep binding will be used
		}
		// Could do this - but not worth perf cost?? :-
		// if (!path.lastIndexOf("#data.", 0)) { path = path.slice(6); } // If path starts with "#data.", remove that.
		prn = prn || prn2 || "";
		var expr, binds, theOb, newOb, subPath, lftPrnFCall, ret,
			ind = index;

		if (!aposed && !quoted) {
			if (err) {
				syntaxError(params);
			}
			if (rtPrnDot && bindings) {
				// This is a binding to a path in which an object is returned by a helper/data function/expression, e.g. foo()^x.y or (a?b:c)^x.y
				// We create a compiled function to get the object instance (which will be called when the dependent data of the subexpression changes,
				// to return the new object, and trigger re-binding of the subsequent path)
				expr = pathStart[fnDp-1];
				if (full.length - 1 > ind - (expr || 0)) { // We need to compile a subexpression
					expr = $.trim(full.slice(expr, ind + all.length));
					binds = bindto || bndStack[fnDp-1].bd;
					// Insert exprOb object, to be used during binding to return the computed object
					theOb = binds[binds.length-1];
					if (theOb && theOb.prm) {
						while (theOb.sb && theOb.sb.prm) {
							theOb = theOb.sb;
						}
						newOb = theOb.sb = {path: theOb.sb, bnd: theOb.bnd};
					} else {
						binds.push(newOb = {path: binds.pop()}); // Insert exprOb object, to be used during binding to return the computed object
					}
					if (theOb && theOb.sb === newOb) {
						compiledPath[fnDp] = compiledPath[fnDp-1].slice(theOb._cpPthSt) + compiledPath[fnDp];
						compiledPath[fnDp-1] = compiledPath[fnDp-1].slice(0, theOb._cpPthSt);
					}
					newOb._cpPthSt = compiledPathStart[fnDp-1];
					newOb._cpKey = expr;

					compiledPath[fnDp] += full.slice(prevIndex, index);
					prevIndex = index;

					newOb._cpfn = cpFnStore[expr] = cpFnStore[expr] || // Compiled function for computed value: get from store, or compile and store
						new Function("data,view,j", // Compiled function for computed value in template
					"//" + expr + "\nvar v;\nreturn ((v=" + compiledPath[fnDp] + (rtPrn === "]" ? ")]" : rtPrn) + ")!=null?v:null);");

					compiledPath[fnDp-1] += (fnCall[prnDp] && $subSettingsAdvanced.cache ? "view.getCache(\"" + expr.replace(rEscapeQuotes, "\\$&") + "\"" : compiledPath[fnDp]);

					newOb.prm = bndCtx.bd;
					newOb.bnd = newOb.bnd || newOb.path && newOb.path.indexOf("^") >= 0;
				}
				compiledPath[fnDp] = "";
			}
			if (prn === "[") {
				prn = "[j._sq(";
			}
			if (lftPrn === "[") {
				lftPrn = "[j._sq(";
			}
		}
		ret = (aposed
			// within single-quoted string
			? (aposed = !apos, (aposed ? all : lftPrn2 + '"'))
			: quoted
			// within double-quoted string
				? (quoted = !quot, (quoted ? all : lftPrn2 + '"'))
				:
			(
				(lftPrn
					? (
						prnStack[++prnDp] = true,
						prnInd[prnDp] = 0,
						bindings && (
							pathStart[fnDp++] = ind++,
							bndCtx = bndStack[fnDp] = {bd: []},
							compiledPath[fnDp] = "",
							compiledPathStart[fnDp] = 1
						),
						lftPrn) // Left paren, (not a function call paren)
					: "")
				+ (space
					? (prnDp
						? "" // A space within parens or within function call parens, so not a separator for tag args
			// New arg or prop - so insert backspace \b (\x08) as separator for named params, used subsequently by rBuildHash, and prepare new bindings array
						: (paramIndex = full.slice(paramIndex, ind), named
							? (named = boundName = bindto = false, "\b")
							: "\b,") + paramIndex + (paramIndex = ind + all.length, bindings && pathBindings.push(bndCtx.bd = []), "\b")
					)
					: eq
			// named param. Remove bindings for arg and create instead bindings array for prop
						? (fnDp && syntaxError(params), bindings && pathBindings.pop(), named = "_" + path, boundName = bound, paramIndex = ind + all.length,
								bindings && ((bindings = bndCtx.bd = pathBindings[named] = []), bindings.skp = !bound), path + ':')
						: path
			// path
							? (path.split("^").join(".").replace($sub.rPath, parsePath)
								+ (prn || operator)
							)
							: operator
			// operator
								? operator
								: rtPrn
			// function
									? rtPrn === "]" ? ")]" : ")"
									: comma
										? (fnCall[prnDp] || syntaxError(params), ",") // We don't allow top-level literal arrays or objects
										: lftPrn0
											? ""
											: (aposed = apos, quoted = quot, '"')
			))
		);

		if (!aposed && !quoted) {
			if (rtPrn) {
				fnCall[prnDp] = false;
				prnDp--;
			}
		}

		if (bindings) {
			if (!aposed && !quoted) {
				if (rtPrn) {
					if (prnStack[prnDp+1]) {
						bndCtx = bndStack[--fnDp];
						prnStack[prnDp+1] = false;
					}
					prnStart = prnInd[prnDp+1];
				}
				if (prn) {
					prnInd[prnDp+1] = compiledPath[fnDp].length + (lftPrn ? 1 : 0);
					if (path || rtPrn) {
						bndCtx = bndStack[++fnDp] = {bd: []};
						prnStack[prnDp+1] = true;
					}
				}
			}

			compiledPath[fnDp] = (compiledPath[fnDp]||"") + full.slice(prevIndex, index);
			prevIndex = index+all.length;

			if (!aposed && !quoted) {
				if (lftPrnFCall = lftPrn && prnStack[prnDp+1]) {
					compiledPath[fnDp-1] += lftPrn;
					compiledPathStart[fnDp-1]++;
				}
				if (prn === "(" && subPath && !newOb) {
					compiledPath[fnDp] = compiledPath[fnDp-1].slice(prnStart) + compiledPath[fnDp];
					compiledPath[fnDp-1] = compiledPath[fnDp-1].slice(0, prnStart);
				}
			}
			compiledPath[fnDp] += lftPrnFCall ? ret.slice(1) : ret;
		}

		if (!aposed && !quoted && prn) {
			prnDp++;
			if (path && prn === "(") {
				fnCall[prnDp] = true;
			}
		}

		if (!aposed && !quoted && prn2) {
			if (bindings) {
				compiledPath[fnDp] += prn;
			}
			ret += prn;
		}
		return ret;
	}

	var named, bindto, boundName, result,
		quoted, // boolean for string content in double quotes
		aposed, // or in single quotes
		bindings = pathBindings && pathBindings[0], // bindings array for the first arg
		bndCtx = {bd: bindings},
		bndStack = {0: bndCtx},
		paramIndex = 0, // list,
		// The following are used for tracking path parsing including nested paths, such as "a.b(c^d + (e))^f", and chained computed paths such as
		// "a.b().c^d().e.f().g" - which has four chained paths, "a.b()", "^c.d()", ".e.f()" and ".g"
		prnDp = 0,     // For tracking paren depth (not function call parens)
		fnDp = 0,      // For tracking depth of function call parens
		prnInd = {},   // We are in a function call
		prnStart = 0,  // tracks the start of the current path such as c^d() in the above example
		prnStack = {}, // tracks parens which are not function calls, and so are associated with new bndStack contexts
		fnCall = {},   // We are in a function call
		pathStart = {},// tracks the start of the current path such as c^d() in the above example
		compiledPathStart = {0: 0},
		compiledPath = {0:""},
		prevIndex = 0;

	if (params[0] === "@") {
		params = params.replace(rBracketQuote, ".");
	}
	result = (params + (tmpl ? " " : "")).replace($sub.rPrm, parseTokens);

	if (bindings) {
		result = compiledPath[0];
	}

	return !prnDp && result || syntaxError(params); // Syntax error if unbalanced parens in params expression
}

function buildCode(ast, tmpl, isLinkExpr) {
	// Build the template function code from the AST nodes, and set as property on the passed-in template object
	// Used for compiling templates, and also by JsViews to build functions for data link expressions
	var i, node, tagName, converter, tagCtx, hasTag, hasEncoder, getsVal, hasCnvt, useCnvt, tmplBindings, pathBindings, params, boundOnErrStart,
		boundOnErrEnd, tagRender, nestedTmpls, tmplName, nestedTmpl, tagAndElses, content, markup, nextIsElse, oldCode, isElse, isGetVal, tagCtxFn,
		onError, tagStart, trigger, lateRender, retStrOpen, retStrClose,
		tmplBindingKey = 0,
		useViews = $subSettingsAdvanced.useViews || tmpl.useViews || tmpl.tags || tmpl.templates || tmpl.helpers || tmpl.converters,
		code = "",
		tmplOptions = {},
		l = ast.length;

	if (typeof tmpl === STRING) {
		tmplName = isLinkExpr ? 'data-link="' + tmpl.replace(rNewLine, " ").slice(1, -1) + '"' : tmpl;
		tmpl = 0;
	} else {
		tmplName = tmpl.tmplName || "unnamed";
		if (tmpl.allowCode) {
			tmplOptions.allowCode = true;
		}
		if (tmpl.debug) {
			tmplOptions.debug = true;
		}
		tmplBindings = tmpl.bnds;
		nestedTmpls = tmpl.tmpls;
	}
	for (i = 0; i < l; i++) {
		// AST nodes: [0: tagName, 1: converter, 2: content, 3: params, 4: code, 5: onError, 6: trigger, 7:pathBindings, 8: contentMarkup]
		node = ast[i];

		// Add newline for each callout to t() c() etc. and each markup string
		if (typeof node === STRING) {
			// a markup string to be inserted
			code += '+"' + node + '"';
		} else {
			// a compiled tag expression to be inserted
			tagName = node[0];
			if (tagName === "*") {
				// Code tag: {{* }}
				code += ";\n" + node[1] + "\nret=ret";
			} else {
				converter = node[1];
				content = !isLinkExpr && node[2];
				tagCtx = paramStructure(node[3], params = node[4]);
				trigger = node[6];
				lateRender = node[7];
				if (node[8]) { // latePath @a.b.c or @~a.b.c
					retStrOpen = "\nvar ob,ltOb={},ctxs=";
					retStrClose = ";\nctxs.lt=ltOb.lt;\nreturn ctxs;";
				} else {
					retStrOpen = "\nreturn ";
					retStrClose = "";
				}
				markup = node[10] && node[10].replace(rUnescapeQuotes, "$1");
				if (isElse = tagName === "else") {
					if (pathBindings) {
						pathBindings.push(node[9]);
					}
				} else {
					onError = node[5] || $subSettings.debugMode !== false && "undefined"; // If debugMode not false, set default onError handler on tag to "undefined" (see onRenderError)
					if (tmplBindings && (pathBindings = node[9])) { // Array of paths, or false if not data-bound
						pathBindings = [pathBindings];
						tmplBindingKey = tmplBindings.push(1); // Add placeholder in tmplBindings for compiled function
					}
				}
				useViews = useViews || params[1] || params[2] || pathBindings || /view.(?!index)/.test(params[0]);
				// useViews is for perf optimization. For render() we only use views if necessary - for the more advanced scenarios.
				// We use views if there are props, contextual properties or args with #... (other than #index) - but you can force
				// using the full view infrastructure, (and pay a perf price) by opting in: Set useViews: true on the template, manually...
				if (isGetVal = tagName === ":") {
					if (converter) {
						tagName = converter === HTML ? ">" : converter + tagName;
					}
				} else {
					if (content) { // TODO optimize - if content.length === 0 or if there is a tmpl="..." specified - set content to null / don't run this compilation code - since content won't get used!!
						// Create template object for nested template
						nestedTmpl = tmplObject(markup, tmplOptions);
						nestedTmpl.tmplName = tmplName + "/" + tagName;
						// Compile to AST and then to compiled function
						nestedTmpl.useViews = nestedTmpl.useViews || useViews;
						buildCode(content, nestedTmpl);
						useViews = nestedTmpl.useViews;
						nestedTmpls.push(nestedTmpl);
					}

					if (!isElse) {
						// This is not an else tag.
						tagAndElses = tagName;
						useViews = useViews || tagName && (!$tags[tagName] || !$tags[tagName].flow);
						// Switch to a new code string for this bound tag (and its elses, if it has any) - for returning the tagCtxs array
						oldCode = code;
						code = "";
					}
					nextIsElse = ast[i + 1];
					nextIsElse = nextIsElse && nextIsElse[0] === "else";
				}
				tagStart = onError ? ";\ntry{\nret+=" : "\n+";
				boundOnErrStart = "";
				boundOnErrEnd = "";

				if (isGetVal && (pathBindings || trigger || converter && converter !== HTML || lateRender)) {
					// For convertVal we need a compiled function to return the new tagCtx(s)
					tagCtxFn = new Function("data,view,j", "// " + tmplName + " " + (++tmplBindingKey) + " " + tagName
						+ retStrOpen + "{" + tagCtx + "};" + retStrClose);
					tagCtxFn._er = onError;
					tagCtxFn._tag = tagName;
					tagCtxFn._bd = !!pathBindings; // data-linked tag {^{.../}}
					tagCtxFn._lr = lateRender;

					if (isLinkExpr) {
						return tagCtxFn;
					}

					setPaths(tagCtxFn, pathBindings);
					tagRender = 'c("' + converter + '",view,';
					useCnvt = true;
					boundOnErrStart = tagRender + tmplBindingKey + ",";
					boundOnErrEnd = ")";
				}
				code += (isGetVal
					? (isLinkExpr ? (onError ? "try{\n" : "") + "return " : tagStart) + (useCnvt // Call _cnvt if there is a converter: {{cnvt: ... }} or {^{cnvt: ... }}
						? (useCnvt = undefined, useViews = hasCnvt = true, tagRender + (tagCtxFn
							? ((tmplBindings[tmplBindingKey - 1] = tagCtxFn), tmplBindingKey) // Store the compiled tagCtxFn in tmpl.bnds, and pass the key to convertVal()
							: "{" + tagCtx + "}") + ")")
						: tagName === ">"
							? (hasEncoder = true, "h(" + params[0] + ")")
							: (getsVal = true, "((v=" + params[0] + ')!=null?v:' + (isLinkExpr ? 'null)' : '"")'))
							// Non strict equality so data-link="title{:expr}" with expr=null/undefined removes title attribute
					)
					: (hasTag = true, "\n{view:view,content:false,tmpl:" // Add this tagCtx to the compiled code for the tagCtxs to be passed to renderTag()
						+ (content ? nestedTmpls.length : "false") + "," // For block tags, pass in the key (nestedTmpls.length) to the nested content template
						+ tagCtx + "},"));

				if (tagAndElses && !nextIsElse) {
					// This is a data-link expression or an inline tag without any elses, or the last {{else}} of an inline tag
					// We complete the code for returning the tagCtxs array
					code = "[" + code.slice(0, -1) + "]";
					tagRender = 't("' + tagAndElses + '",view,this,';
					if (isLinkExpr || pathBindings) {
						// This is a bound tag (data-link expression or inline bound tag {^{tag ...}}) so we store a compiled tagCtxs function in tmp.bnds
						code = new Function("data,view,j", " // " + tmplName + " " + tmplBindingKey + " " + tagAndElses + retStrOpen + code
							+ retStrClose);
						code._er = onError;
						code._tag = tagAndElses;
						if (pathBindings) {
							setPaths(tmplBindings[tmplBindingKey - 1] = code, pathBindings);
						}
						code._lr = lateRender;
						if (isLinkExpr) {
							return code; // For a data-link expression we return the compiled tagCtxs function
						}
						boundOnErrStart = tagRender + tmplBindingKey + ",undefined,";
						boundOnErrEnd = ")";
					}

					// This is the last {{else}} for an inline tag.
					// For a bound tag, pass the tagCtxs fn lookup key to renderTag.
					// For an unbound tag, include the code directly for evaluating tagCtxs array
					code = oldCode + tagStart + tagRender + (pathBindings && tmplBindingKey || code) + ")";
					pathBindings = 0;
					tagAndElses = 0;
				}
				if (onError && !nextIsElse) {
					useViews = true;
					code += ';\n}catch(e){ret' + (isLinkExpr ? "urn " : "+=") + boundOnErrStart + 'j._err(e,view,' + onError + ')' + boundOnErrEnd + ';}' + (isLinkExpr ? "" : '\nret=ret');
				}
			}
		}
	}
	// Include only the var references that are needed in the code
	code = "// " + tmplName
		+ (tmplOptions.debug ? "\ndebugger;" : "")
		+ "\nvar v"
		+ (hasTag ? ",t=j._tag" : "")                // has tag
		+ (hasCnvt ? ",c=j._cnvt" : "")              // converter
		+ (hasEncoder ? ",h=j._html" : "")           // html converter
		+ (isLinkExpr
				? (node[8] // late @... path?
						? ", ob"
						: ""
					) + ";\n"
				: ',ret=""')
		+ code
		+ (isLinkExpr ? "\n" : ";\nreturn ret;");

	try {
		code = new Function("data,view,j", code);
	} catch (e) {
		syntaxError("Compiled template code:\n\n" + code + '\n: "' + (e.message||e) + '"');
	}
	if (tmpl) {
		tmpl.fn = code;
		tmpl.useViews = !!useViews;
	}
	return code;
}

//==========
// Utilities
//==========

// Merge objects, in particular contexts which inherit from parent contexts
function extendCtx(context, parentContext) {
	// Return copy of parentContext, unless context is defined and is different, in which case return a new merged context
	// If neither context nor parentContext are defined, return undefined
	return context && context !== parentContext
		? (parentContext
			? $extend($extend({}, parentContext), context)
			: context)
		: parentContext && $extend({}, parentContext);
}

function getTargetProps(source, tagCtx) {
	// this pointer is theMap - which has tagCtx.props too
	// arguments: tagCtx.args.
	var key, prop,
		map = tagCtx.map,
		propsArr = map && map.propsArr;

	if (!propsArr) { // map.propsArr is the full array of {key:..., prop:...} objects
		propsArr = [];
		if (typeof source === OBJECT || $isFunction(source)) {
			for (key in source) {
				prop = source[key];
				if (key !== $expando && source.hasOwnProperty(key) && (!tagCtx.props.noFunctions || !$.isFunction(prop))) {
					propsArr.push({key: key, prop: prop});
				}
			}
		}
		if (map) {
			map.propsArr = map.options && propsArr; // If bound {^{props}} and not isRenderCall, store propsArr on map (map.options is defined only for bound, && !isRenderCall)
		}
	}
	return getTargetSorted(propsArr, tagCtx); // Obtains map.tgt, by filtering, sorting and splicing the full propsArr
}

function getTargetSorted(value, tagCtx) {
	// getTgt
	var mapped, start, end,
		tag = tagCtx.tag,
		props = tagCtx.props,
		propParams = tagCtx.params.props,
		filter = props.filter,
		sort = props.sort,
		directSort = sort === true,
		step = parseInt(props.step),
		reverse = props.reverse ? -1 : 1;

	if (!$isArray(value)) {
		return value;
	}
	if (directSort || sort && typeof sort === STRING) {
		// Temporary mapped array holds objects with index and sort-value
		mapped = value.map(function(item, i) {
			item = directSort ? item : getPathObject(item, sort);
			return {i: i, v: typeof item === STRING ? item.toLowerCase() : item};
		});
		// Sort mapped array
		mapped.sort(function(a, b) {
			return a.v > b.v ? reverse : a.v < b.v ? -reverse : 0;
		});
		// Map to new array with resulting order
		value = mapped.map(function(item){
			return value[item.i];
		});
	} else if ((sort || reverse < 0) && !tag.dataMap) {
		value = value.slice(); // Clone array first if not already a new array
	}
	if ($isFunction(sort)) {
		value = value.sort(function() { // Wrap the sort function to provide tagCtx as 'this' pointer
			return sort.apply(tagCtx, arguments);
		});
	}
	if (reverse < 0 && (!sort || $isFunction(sort))) { // Reverse result if not already reversed in sort
		value = value.reverse();
	}

	if (value.filter && filter) { // IE8 does not support filter
		value = value.filter(filter, tagCtx);
		if (tagCtx.tag.onFilter) {
			tagCtx.tag.onFilter(tagCtx);
		}
	}

	if (propParams.sorted) {
		mapped = (sort || reverse < 0) ? value : value.slice();
		if (tag.sorted) {
			$.observable(tag.sorted).refresh(mapped); // Note that this might cause the start and end props to be modified - e.g. by pager tag control
		} else {
			tagCtx.map.sorted = mapped;
		}
	}

	start = props.start; // Get current value - after possible changes triggered by tag.sorted refresh() above
	end = props.end;
	if (propParams.start && start === undefined || propParams.end && end === undefined) {
		start = end = 0;
	}
	if (!isNaN(start) || !isNaN(end)) { // start or end specified, but not the auto-create Number array scenario of {{for start=xxx end=yyy}}
		start = +start || 0;
		end = end === undefined || end > value.length ? value.length : +end;
		value = value.slice(start, end);
	}
	if (step > 1) {
		start = 0;
		end = value.length;
		mapped = [];
		for (; start<end; start+=step) {
			mapped.push(value[start]);
		}
		value = mapped;
	}
	if (propParams.paged && tag.paged) {
		$observable(tag.paged).refresh(value);
	}

	return value;
}

/** Render the template as a string, using the specified data and helpers/context
* $("#tmpl").render()
*
* @param {any}        data
* @param {hash}       [helpersOrContext]
* @param {boolean}    [noIteration]
* @returns {string}   rendered template
*/
function $fnRender(data, context, noIteration) {
	var tmplElem = this.jquery && (this[0] || error('Unknown template')), // Targeted element not found for jQuery template selector such as "#myTmpl"
		tmpl = tmplElem.getAttribute(tmplAttr);

	return renderContent.call(tmpl && $.data(tmplElem)[jsvTmpl] || $templates(tmplElem),
		data, context, noIteration);
}

//========================== Register converters ==========================

function getCharEntity(ch) {
	// Get character entity for HTML, Attribute and optional data encoding
	return charEntities[ch] || (charEntities[ch] = "&#" + ch.charCodeAt(0) + ";");
}

function getCharFromEntity(match, token) {
	// Get character from HTML entity, for optional data unencoding
	return charsFromEntities[token] || "";
}

function htmlEncode(text) {
	// HTML encode: Replace < > & ' " ` etc. by corresponding entities.
	return text != undefined ? rIsHtml.test(text) && ("" + text).replace(rHtmlEncode, getCharEntity) || text : "";
}

function dataEncode(text) {
	// Encode just < > and & - intended for 'safe data' along with {{:}} rather than {{>}}
  return typeof text === STRING ? text.replace(rDataEncode, getCharEntity) : text;
}

function dataUnencode(text) {
  // Unencode just < > and & - intended for 'safe data' along with {{:}} rather than {{>}}
  return  typeof text === STRING ? text.replace(rDataUnencode, getCharFromEntity) : text;
}

//========================== Initialize ==========================

$sub = $views.sub;
$viewsSettings = $views.settings;

if (!(jsr || $ && $.render)) {
	// JsRender/JsViews not already loaded (or loaded without jQuery, and we are now moving from jsrender namespace to jQuery namepace)
	for (jsvStoreName in jsvStores) {
		registerStore(jsvStoreName, jsvStores[jsvStoreName]);
	}

	$converters = $views.converters;
	$helpers = $views.helpers;
	$tags = $views.tags;

	$sub._tg.prototype = {
		baseApply: baseApply,
		cvtArgs: convertArgs,
		bndArgs: convertBoundArgs,
		ctxPrm: contextParameter
	};

	topView = $sub.topView = new View();

	//BROWSER-SPECIFIC CODE
	if ($) {

		////////////////////////////////////////////////////////////////////////////////////////////////
		// jQuery (= $) is loaded

		$.fn.render = $fnRender;
		$expando = $.expando;
		if ($.observable) {
			if (versionNumber !== (versionNumber = $.views.jsviews)) {
				// Different version of jsRender was loaded
				throw "jquery.observable.js requires jsrender.js " + versionNumber;
			}
			$extend($sub, $.views.sub); // jquery.observable.js was loaded before jsrender.js
			$views.map = $.views.map;
		}

	} else {
		////////////////////////////////////////////////////////////////////////////////////////////////
		// jQuery is not loaded.

		$ = {};

		if (setGlobals) {
			global.jsrender = $; // We are loading jsrender.js from a script element, not AMD or CommonJS, so set global
		}

		// Error warning if jsrender.js is used as template engine on Node.js (e.g. Express or Hapi...)
		// Use jsrender-node.js instead...
		$.renderFile = $.__express = $.compile = function() { throw "Node.js: use npm jsrender, or jsrender-node.js"; };

		//END BROWSER-SPECIFIC CODE
		$.isFunction = function(ob) {
			return typeof ob === "function";
		};

		$.isArray = Array.isArray || function(obj) {
			return ({}.toString).call(obj) === "[object Array]";
		};

		$sub._jq = function(jq) { // private method to move from JsRender APIs from jsrender namespace to jQuery namespace
			if (jq !== $) {
				$extend(jq, $); // map over from jsrender namespace to jQuery namespace
				$ = jq;
				$.fn.render = $fnRender;
				delete $.jsrender;
				$expando = $.expando;
			}
		};

		$.jsrender = versionNumber;
	}
	$subSettings = $sub.settings;
	$subSettings.allowCode = false;
	$isFunction = $.isFunction;
	$.render = $render;
	$.views = $views;
	$.templates = $templates = $views.templates;

	for (setting in $subSettings) {
		addSetting(setting);
	}

	/**
	* $.views.settings.debugMode(true)
	* @param {boolean} debugMode
	* @returns {Settings}
	*
	* debugMode = $.views.settings.debugMode()
	* @returns {boolean}
	*/
	($viewsSettings.debugMode = function(debugMode) {
		return debugMode === undefined
			? $subSettings.debugMode
			: (
				$subSettings._clFns && $subSettings._clFns(), // Clear linkExprStore (cached compiled expressions), since debugMode setting affects compilation for expressions
				$subSettings.debugMode = debugMode,
				$subSettings.onError = typeof debugMode === STRING
					? function() { return debugMode; }
					: $isFunction(debugMode)
						? debugMode
						: undefined,
				$viewsSettings);
	})(false); // jshint ignore:line

	$subSettingsAdvanced = $subSettings.advanced = {
		cache: true, // By default use cached values of computed values (Otherwise, set advanced cache setting to false)
		useViews: false,
		_jsv: false // For global access to JsViews store
	};

	//========================== Register tags ==========================

	$tags({
		"if": {
			render: function(val) {
				// This function is called once for {{if}} and once for each {{else}}.
				// We will use the tag.rendering object for carrying rendering state across the calls.
				// If not done (a previous block has not been rendered), look at expression for this block and render the block if expression is truthy
				// Otherwise return ""
				var self = this,
					tagCtx = self.tagCtx,
					ret = (self.rendering.done || !val && (tagCtx.args.length || !tagCtx.index))
						? ""
						: (self.rendering.done = true,
							self.selected = tagCtx.index,
							undefined); // Test is satisfied, so render content on current context
				return ret;
			},
			contentCtx: true, // Inherit parent view data context
			flow: true
		},
		"for": {
			sortDataMap: dataMap(getTargetSorted),
			init: function(val, cloned) {
				this.setDataMap(this.tagCtxs);
			},
			render: function(val) {
				// This function is called once for {{for}} and once for each {{else}}.
				// We will use the tag.rendering object for carrying rendering state across the calls.
				var value, filter, srtField, isArray, i, sorted, end, step,
					self = this,
					tagCtx = self.tagCtx,
					range = tagCtx.argDefault === false,
					props = tagCtx.props,
					iterate = range || tagCtx.args.length, // Not final else and not auto-create range
					result = "",
					done = 0;

				if (!self.rendering.done) {
					value = iterate ? val : tagCtx.view.data; // For the final else, defaults to current data without iteration.

					if (range) {
						range = props.reverse ? "unshift" : "push";
						end = +props.end;
						step = +props.step || 1;
						value = []; // auto-create integer array scenario of {{for start=xxx end=yyy}}
						for (i = +props.start || 0; (end - i) * step > 0; i += step) {
							value[range](i);
						}
					}
					if (value !== undefined) {
						isArray = $isArray(value);
						result += tagCtx.render(value, !iterate || props.noIteration);
						// Iterates if data is an array, except on final else - or if noIteration property
						// set to true. (Use {{include}} to compose templates without array iteration)
						done += isArray ? value.length : 1;
					}
					if (self.rendering.done = done) {
						self.selected = tagCtx.index;
					}
					// If nothing was rendered we will look at the next {{else}}. Otherwise, we are done.
				}
				return result;
			},
			setDataMap: function(tagCtxs) {
				var tagCtx, props, paramsProps,
					self = this,
					l = tagCtxs.length;
				while (l--) {
					tagCtx = tagCtxs[l];
					props = tagCtx.props;
					paramsProps = tagCtx.params.props;
					tagCtx.argDefault = props.end === undefined || tagCtx.args.length > 0; // Default to #data except for auto-create range scenario {{for start=xxx end=yyy step=zzz}}
					props.dataMap = (tagCtx.argDefault !== false && $isArray(tagCtx.args[0]) &&
						(paramsProps.sort || paramsProps.start || paramsProps.end || paramsProps.step || paramsProps.filter || paramsProps.reverse
						|| props.sort || props.start || props.end || props.step || props.filter || props.reverse))
						&& self.sortDataMap;
				}
			},
			flow: true
		},
		props: {
			baseTag: "for",
			dataMap: dataMap(getTargetProps),
			init: noop, // Don't execute the base init() of the "for" tag
			flow: true
		},
		include: {
			flow: true
		},
		"*": {
			// {{* code... }} - Ignored if template.allowCode and $.views.settings.allowCode are false. Otherwise include code in compiled template
			render: retVal,
			flow: true
		},
		":*": {
			// {{:* returnedExpression }} - Ignored if template.allowCode and $.views.settings.allowCode are false. Otherwise include code in compiled template
			render: retVal,
			flow: true
		},
		dbg: $helpers.dbg = $converters.dbg = dbgBreak // Register {{dbg/}}, {{dbg:...}} and ~dbg() to throw and catch, as breakpoints for debugging.
	});

	$converters({
		html: htmlEncode,
		attr: htmlEncode, // Includes > encoding since rConvertMarkers in JsViews does not skip > characters in attribute strings
		encode: dataEncode,
		unencode: dataUnencode, // Includes > encoding since rConvertMarkers in JsViews does not skip > characters in attribute strings
		url: function(text) {
			// URL encoding helper.
			return text != undefined ? encodeURI("" + text) : text === null ? text : ""; // null returns null, e.g. to remove attribute. undefined returns ""
		}
	});
}
//========================== Define default delimiters ==========================
$subSettings = $sub.settings;
$isArray = ($||jsr).isArray;
$viewsSettings.delimiters("{{", "}}", "^");

if (jsrToJq) { // Moving from jsrender namespace to jQuery namepace - copy over the stored items (templates, converters, helpers...)
	jsr.views.sub._jq($);
}
return $ || jsr;
}, window));

},{}],2:[function(require,module,exports){
(function (global){
/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

browserify.done.twelve = true;

QUnit.module("Browserify - client code");

var isIE8 = window.attachEvent && !window.addEventListener;

if (!isIE8) {

test("No jQuery global: require('jsrender')() nested template", function() {
	// ............................... Hide QUnit global jQuery and any previous global jsrender.................................
	var jQuery = global.jQuery, jsr = global.jsrender;
	global.jQuery = global.jsrender = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	var jsrender = require('../../')(); // Not passing in jQuery, so returns the jsrender namespace

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/outer.html')(jsrender); // Provide jsrender

	var result = tmpl(data);

	result += " " + (jsrender !== jQuery);

	// ............................... Assert .................................
	equal(result, "Name: Jo (outer.html) Name: Jo (inner.html) true", "result: No jQuery global: require('jsrender')(), nested templates");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
	global.jsrender = jsr; // Replace any previous global jsrender
});
}
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../":1,"../templates/outer.html":4}],3:[function(require,module,exports){
(function (global){
var tmplRefs = [],
  mkup = 'Name: {{:name}} (inner.html)',
  $ = global.jsrender || global.jQuery;

module.exports = $ ? $.templates("./test/templates/inner.html", mkup) :
  function($) {
    if (!$ || !$.views) {throw "Requires jsrender/jQuery";}
    while (tmplRefs.length) {
      tmplRefs.pop()($); // compile nested template
    }

    return $.templates("./test/templates/inner.html", mkup)
  };
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],4:[function(require,module,exports){
(function (global){
var tmplRefs = [],
  mkup = 'Name: {{:name}} (outer.html) {{include tmpl=\"./test/templates/inner.html\"/}}',
  $ = global.jsrender || global.jQuery;

tmplRefs.push(require("./inner.html"));
module.exports = $ ? $.templates("./test/templates/outer.html", mkup) :
  function($) {
    if (!$ || !$.views) {throw "Requires jsrender/jQuery";}
    while (tmplRefs.length) {
      tmplRefs.pop()($); // compile nested template
    }

    return $.templates("./test/templates/outer.html", mkup)
  };
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./inner.html":3}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xMi1uZXN0ZWQtdW5pdC10ZXN0cy5qcyIsInRlc3QvdGVtcGxhdGVzL2lubmVyLmh0bWwiLCJ0ZXN0L3RlbXBsYXRlcy9vdXRlci5odG1sIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzc4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIEpzUmVuZGVyIHYxLjAuMTQ6IGh0dHA6Ly9qc3ZpZXdzLmNvbS8janNyZW5kZXIgKi9cbi8qISAqKlZFUlNJT04gRk9SIFdFQioqIChGb3IgTk9ERS5KUyBzZWUgaHR0cDovL2pzdmlld3MuY29tL2Rvd25sb2FkL2pzcmVuZGVyLW5vZGUuanMpICovXG4vKlxuICogQmVzdC1vZi1icmVlZCB0ZW1wbGF0aW5nIGluIGJyb3dzZXIgb3Igb24gTm9kZS5qcy5cbiAqIERvZXMgbm90IHJlcXVpcmUgalF1ZXJ5LCBvciBIVE1MIERPTVxuICogSW50ZWdyYXRlcyB3aXRoIEpzVmlld3MgKGh0dHA6Ly9qc3ZpZXdzLmNvbS8janN2aWV3cylcbiAqXG4gKiBDb3B5cmlnaHQgMjAyNCwgQm9yaXMgTW9vcmVcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuXG4vL2pzaGludCAtVzAxOCwgLVcwNDEsIC1XMTIwXG5cbihmdW5jdGlvbihmYWN0b3J5LCBnbG9iYWwpIHtcblx0Ly8gZ2xvYmFsIHZhciBpcyB0aGUgdGhpcyBvYmplY3QsIHdoaWNoIGlzIHdpbmRvdyB3aGVuIHJ1bm5pbmcgaW4gdGhlIHVzdWFsIGJyb3dzZXIgZW52aXJvbm1lbnRcblx0dmFyICQgPSBnbG9iYWwualF1ZXJ5O1xuXG5cdGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikgeyAvLyBDb21tb25KUyBlLmcuIEJyb3dzZXJpZnlcblx0XHRtb2R1bGUuZXhwb3J0cyA9ICRcblx0XHRcdD8gZmFjdG9yeShnbG9iYWwsICQpXG5cdFx0XHQ6IGZ1bmN0aW9uKCQpIHsgLy8gSWYgbm8gZ2xvYmFsIGpRdWVyeSwgdGFrZSBvcHRpb25hbCBqUXVlcnkgcGFzc2VkIGFzIHBhcmFtZXRlcjogcmVxdWlyZSgnanNyZW5kZXInKShqUXVlcnkpXG5cdFx0XHRcdGlmICgkICYmICEkLmZuKSB7XG5cdFx0XHRcdFx0dGhyb3cgXCJQcm92aWRlIGpRdWVyeSBvciBudWxsXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsLCAkKTtcblx0XHRcdH07XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHsgLy8gQU1EIHNjcmlwdCBsb2FkZXIsIGUuZy4gUmVxdWlyZUpTXG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsKTtcblx0XHR9KTtcblx0fSBlbHNlIHsgLy8gQnJvd3NlciB1c2luZyBwbGFpbiA8c2NyaXB0PiB0YWdcblx0XHRmYWN0b3J5KGdsb2JhbCwgZmFsc2UpO1xuXHR9XG59IChcblxuLy8gZmFjdG9yeSAoZm9yIGpzcmVuZGVyLmpzKVxuZnVuY3Rpb24oZ2xvYmFsLCAkKSB7XG5cInVzZSBzdHJpY3RcIjtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBUb3AtbGV2ZWwgdmFycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxudmFyIHNldEdsb2JhbHMgPSAkID09PSBmYWxzZTsgLy8gT25seSBzZXQgZ2xvYmFscyBpZiBzY3JpcHQgYmxvY2sgaW4gYnJvd3NlciAobm90IEFNRCBhbmQgbm90IENvbW1vbkpTKVxuXG4kID0gJCAmJiAkLmZuID8gJCA6IGdsb2JhbC5qUXVlcnk7IC8vICQgaXMgalF1ZXJ5IHBhc3NlZCBpbiBieSBDb21tb25KUyBsb2FkZXIgKEJyb3dzZXJpZnkpLCBvciBnbG9iYWwgalF1ZXJ5LlxuXG52YXIgdmVyc2lvbk51bWJlciA9IFwidjEuMC4xNFwiLFxuXHRqc3ZTdG9yZU5hbWUsIHJUYWcsIHJUbXBsU3RyaW5nLCB0b3BWaWV3LCAkdmlld3MsICRleHBhbmRvLFxuXHRfb2NwID0gXCJfb2NwXCIsICAgICAgLy8gT2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXG5cdCRpc0Z1bmN0aW9uLCAkaXNBcnJheSwgJHRlbXBsYXRlcywgJGNvbnZlcnRlcnMsICRoZWxwZXJzLCAkdGFncywgJHN1YiwgJHN1YlNldHRpbmdzLCAkc3ViU2V0dGluZ3NBZHZhbmNlZCwgJHZpZXdzU2V0dGluZ3MsXG5cdGRlbGltT3BlbkNoYXIwLCBkZWxpbU9wZW5DaGFyMSwgZGVsaW1DbG9zZUNoYXIwLCBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyLCBzZXR0aW5nLCBiYXNlT25FcnJvcixcblxuXHRpc1JlbmRlckNhbGwsXG5cdHJOZXdMaW5lID0gL1sgXFx0XSooXFxyXFxufFxcbnxcXHIpL2csXG5cdHJVbmVzY2FwZVF1b3RlcyA9IC9cXFxcKFsnXCJcXFxcXSkvZywgLy8gVW5lc2NhcGUgcXVvdGVzIGFuZCB0cmltXG5cdHJFc2NhcGVRdW90ZXMgPSAvWydcIlxcXFxdL2csIC8vIEVzY2FwZSBxdW90ZXMgYW5kIFxcIGNoYXJhY3RlclxuXHRyQnVpbGRIYXNoID0gLyg/OlxceDA4fF4pKG9uZXJyb3I6KT8oPzoofj8pKChbXFx3JC5dKyk6KT8oW15cXHgwOF0rKSlcXHgwOCgsKT8oW15cXHgwOF0rKS9naSxcblx0clRlc3RFbHNlSWYgPSAvXmlmXFxzLyxcblx0ckZpcnN0RWxlbSA9IC88KFxcdyspWz5cXHNdLyxcblx0ckF0dHJFbmNvZGUgPSAvW1xceDAwYD48XCInJj1dL2csIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0cklzSHRtbCA9IC9bXFx4MDBgPjxcXFwiJyY9XS8sXG5cdHJIYXNIYW5kbGVycyA9IC9eb25bQS1aXXxeY29udmVydChCYWNrKT8kLyxcblx0cldyYXBwZWRJblZpZXdNYXJrZXIgPSAvXlxcI1xcZCtfYFtcXHNcXFNdKlxcL1xcZCtfYCQvLFxuXHRySHRtbEVuY29kZSA9IHJBdHRyRW5jb2RlLFxuXHRyRGF0YUVuY29kZSA9IC9bJjw+XS9nLFxuXHRyRGF0YVVuZW5jb2RlID0gLyYoYW1wfGd0fGx0KTsvZyxcblx0ckJyYWNrZXRRdW90ZSA9IC9cXFtbJ1wiXT98WydcIl0/XFxdL2csXG5cdHZpZXdJZCA9IDAsXG5cdGNoYXJFbnRpdGllcyA9IHtcblx0XHRcIiZcIjogXCImYW1wO1wiLFxuXHRcdFwiPFwiOiBcIiZsdDtcIixcblx0XHRcIj5cIjogXCImZ3Q7XCIsXG5cdFx0XCJcXHgwMFwiOiBcIiYjMDtcIixcblx0XHRcIidcIjogXCImIzM5O1wiLFxuXHRcdCdcIic6IFwiJiMzNDtcIixcblx0XHRcImBcIjogXCImIzk2O1wiLFxuXHRcdFwiPVwiOiBcIiYjNjE7XCJcblx0fSxcblx0Y2hhcnNGcm9tRW50aXRpZXMgPSB7XG5cdFx0YW1wOiBcIiZcIixcblx0XHRndDogXCI+XCIsXG5cdFx0bHQ6IFwiPFwiXG5cdH0sXG5cdEhUTUwgPSBcImh0bWxcIixcblx0U1RSSU5HID0gXCJzdHJpbmdcIixcblx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0dG1wbEF0dHIgPSBcImRhdGEtanN2LXRtcGxcIixcblx0anN2VG1wbCA9IFwianN2VG1wbFwiLFxuXHRpbmRleFN0ciA9IFwiRm9yICNpbmRleCBpbiBuZXN0ZWQgYmxvY2sgdXNlICNnZXRJbmRleCgpLlwiLFxuXHRjcEZuU3RvcmUgPSB7fSwgICAgIC8vIENvbXBpbGVkIGZ1cm5jdGlvbnMgZm9yIGNvbXB1dGVkIHZhbHVlcyBpbiB0ZW1wbGF0ZSBleHByZXNzaW9ucyAocHJvcGVydGllcywgbWV0aG9kcywgaGVscGVycylcblx0JHJlbmRlciA9IHt9LFxuXG5cdGpzciA9IGdsb2JhbC5qc3JlbmRlcixcblx0anNyVG9KcSA9IGpzciAmJiAkICYmICEkLnJlbmRlciwgLy8gSnNSZW5kZXIgYWxyZWFkeSBsb2FkZWQsIHdpdGhvdXQgalF1ZXJ5LiBidXQgd2Ugd2lsbCByZS1sb2FkIGl0IG5vdyB0byBhdHRhY2ggdG8galF1ZXJ5XG5cblx0anN2U3RvcmVzID0ge1xuXHRcdHRlbXBsYXRlOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVG1wbFxuXHRcdH0sXG5cdFx0dGFnOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVGFnXG5cdFx0fSxcblx0XHR2aWV3TW9kZWw6IHtcblx0XHRcdGNvbXBpbGU6IGNvbXBpbGVWaWV3TW9kZWxcblx0XHR9LFxuXHRcdGhlbHBlcjoge30sXG5cdFx0Y29udmVydGVyOiB7fVxuXHR9O1xuXG5cdC8vIHZpZXdzIG9iamVjdCAoJC52aWV3cyBpZiBqUXVlcnkgaXMgbG9hZGVkLCBqc3JlbmRlci52aWV3cyBpZiBubyBqUXVlcnksIGUuZy4gaW4gTm9kZS5qcylcblx0JHZpZXdzID0ge1xuXHRcdGpzdmlld3M6IHZlcnNpb25OdW1iZXIsXG5cdFx0c3ViOiB7XG5cdFx0XHQvLyBzdWJzY3JpcHRpb24sIGUuZy4gSnNWaWV3cyBpbnRlZ3JhdGlvblxuXHRcdFx0clBhdGg6IC9eKCEqPykoPzpudWxsfHRydWV8ZmFsc2V8XFxkW1xcZC5dKnwoW1xcdyRdK3xcXC58fihbXFx3JF0rKXwjKHZpZXd8KFtcXHckXSspKT8pKFtcXHckLl5dKj8pKD86Wy5bXl0oW1xcdyRdKylcXF0/KT8pJC9nLFxuXHRcdFx0Ly8gICAgICAgIG5vdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgICAgIGhlbHBlciAgICB2aWV3ICB2aWV3UHJvcGVydHkgcGF0aFRva2VucyAgICAgIGxlYWZUb2tlblxuXG5cdFx0XHRyUHJtOiAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykofj9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18fig/IVtcXHckXSl8JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqPyhAKT9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfCg/OihcXCgpXFxzKik/XFxcXD8oPzooJyl8KFwiKSl8KD86XFxzKigoWylcXF1dKSg/PVsuXl18XFxzKiR8W14oW10pfFspXFxdXSkoWyhbXT8pKXwoXFxzKykvZyxcblx0XHRcdC8vICAgbGZ0UHJuMCAgICAgICAgICAgbGZ0UHJuICAgICAgICAgYm91bmQgICAgIHBhdGggICAgICAgICAgICAgICBvcGVyYXRvciAgICAgZXJyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXEgICAgICBwYXRoMiBsYXRlICAgICAgICAgICAgcHJuICAgICAgY29tbWEgIGxmdFBybjIgICAgICAgICAgYXBvcyBxdW90ICAgICAgICBydFBybiAgcnRQcm5Eb3QgICAgICAgICAgICAgICAgICBwcm4yICAgICBzcGFjZVxuXG5cdFx0XHRWaWV3OiBWaWV3LFxuXHRcdFx0RXJyOiBKc1ZpZXdzRXJyb3IsXG5cdFx0XHR0bXBsRm46IHRtcGxGbixcblx0XHRcdHBhcnNlOiBwYXJzZVBhcmFtcyxcblx0XHRcdGV4dGVuZDogJGV4dGVuZCxcblx0XHRcdGV4dGVuZEN0eDogZXh0ZW5kQ3R4LFxuXHRcdFx0c3ludGF4RXJyOiBzeW50YXhFcnJvcixcblx0XHRcdG9uU3RvcmU6IHtcblx0XHRcdFx0dGVtcGxhdGU6IGZ1bmN0aW9uKG5hbWUsIGl0ZW0pIHtcblx0XHRcdFx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlICRyZW5kZXJbbmFtZV07XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChuYW1lKSB7XG5cdFx0XHRcdFx0XHQkcmVuZGVyW25hbWVdID0gaXRlbTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRTZXR0aW5nOiBhZGRTZXR0aW5nLFxuXHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0YWxsb3dDb2RlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdGFkdlNldDogbm9vcCwgLy8gVXBkYXRlIGFkdmFuY2VkIHNldHRpbmdzXG5cdFx0XHRfdGhwOiB0YWdIYW5kbGVyc0Zyb21Qcm9wcyxcblx0XHRcdF9nbTogZ2V0TWV0aG9kLFxuXHRcdFx0X3RnOiBmdW5jdGlvbigpIHt9LCAvLyBDb25zdHJ1Y3RvciBmb3IgdGFnRGVmXG5cdFx0XHRfY252dDogY29udmVydFZhbCxcblx0XHRcdF90YWc6IHJlbmRlclRhZyxcblx0XHRcdF9lcjogZXJyb3IsXG5cdFx0XHRfZXJyOiBvblJlbmRlckVycm9yLFxuXHRcdFx0X2NwOiByZXRWYWwsIC8vIEdldCBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVycyAob3IgcHJvcGVydGllcykgfmZvbz1leHByLiBJbiBKc1JlbmRlciwgc2ltcGx5IHJldHVybnMgdmFsLlxuXHRcdFx0X3NxOiBmdW5jdGlvbih0b2tlbikge1xuXHRcdFx0XHRpZiAodG9rZW4gPT09IFwiY29uc3RydWN0b3JcIikge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKFwiXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0b2tlbjtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHNldHRpbmdzOiB7XG5cdFx0XHRkZWxpbWl0ZXJzOiAkdmlld3NEZWxpbWl0ZXJzLFxuXHRcdFx0YWR2YW5jZWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0XHRcdD8gKFxuXHRcdFx0XHRcdFx0XHQkZXh0ZW5kKCRzdWJTZXR0aW5nc0FkdmFuY2VkLCB2YWx1ZSksXG5cdFx0XHRcdFx0XHRcdCRzdWIuYWR2U2V0KCksXG5cdFx0XHRcdFx0XHRcdCR2aWV3c1NldHRpbmdzXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQ6ICRzdWJTZXR0aW5nc0FkdmFuY2VkO1xuXHRcdFx0XHR9XG5cdFx0fSxcblx0XHRtYXA6IGRhdGFNYXAgLy8gSWYganNPYnNlcnZhYmxlIGxvYWRlZCBmaXJzdCwgdXNlIHRoYXQgZGVmaW5pdGlvbiBvZiBkYXRhTWFwXG5cdH07XG5cbmZ1bmN0aW9uIGdldERlcml2ZWRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcmV0LFxuXHRcdFx0dGFnID0gdGhpcyxcblx0XHRcdHByZXZCYXNlID0gdGFnLmJhc2U7XG5cblx0XHR0YWcuYmFzZSA9IGJhc2VNZXRob2Q7IC8vIFdpdGhpbiBtZXRob2QgY2FsbCwgY2FsbGluZyB0aGlzLmJhc2Ugd2lsbCBjYWxsIHRoZSBiYXNlIG1ldGhvZFxuXHRcdHJldCA9IG1ldGhvZC5hcHBseSh0YWcsIGFyZ3VtZW50cyk7IC8vIENhbGwgdGhlIG1ldGhvZFxuXHRcdHRhZy5iYXNlID0gcHJldkJhc2U7IC8vIFJlcGxhY2UgdGhpcy5iYXNlIHRvIGJlIHRoZSBiYXNlIG1ldGhvZCBvZiB0aGUgcHJldmlvdXMgY2FsbCwgZm9yIGNoYWluZWQgY2FsbHNcblx0XHRyZXR1cm4gcmV0O1xuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdC8vIEZvciBkZXJpdmVkIG1ldGhvZHMgKG9yIGhhbmRsZXJzIGRlY2xhcmVkIGRlY2xhcmF0aXZlbHkgYXMgaW4ge3s6Zm9vIG9uQ2hhbmdlPX5mb29DaGFuZ2VkfX0gcmVwbGFjZSBieSBhIGRlcml2ZWQgbWV0aG9kLCB0byBhbGxvdyB1c2luZyB0aGlzLmJhc2UoLi4uKVxuXHQvLyBvciB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIHRvIGNhbGwgdGhlIGJhc2UgaW1wbGVtZW50YXRpb24uIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyKC4uLikgYW5kIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdGlmICgkaXNGdW5jdGlvbihtZXRob2QpKSB7XG5cdFx0bWV0aG9kID0gZ2V0RGVyaXZlZE1ldGhvZChcblx0XHRcdFx0IWJhc2VNZXRob2Rcblx0XHRcdFx0XHQ/IG5vb3AgLy8gbm8gYmFzZSBtZXRob2QgaW1wbGVtZW50YXRpb24sIHNvIHVzZSBub29wIGFzIGJhc2UgbWV0aG9kXG5cdFx0XHRcdFx0OiBiYXNlTWV0aG9kLl9kXG5cdFx0XHRcdFx0XHQ/IGJhc2VNZXRob2QgLy8gYmFzZU1ldGhvZCBpcyBhIGRlcml2ZWQgbWV0aG9kLCBzbyB1c2UgaXRcblx0XHRcdFx0XHRcdDogZ2V0RGVyaXZlZE1ldGhvZChub29wLCBiYXNlTWV0aG9kKSwgLy8gYmFzZU1ldGhvZCBpcyBub3QgZGVyaXZlZCBzbyBtYWtlIGl0cyBiYXNlIG1ldGhvZCBiZSB0aGUgbm9vcCBtZXRob2Rcblx0XHRcdFx0bWV0aG9kXG5cdFx0XHQpO1xuXHRcdG1ldGhvZC5fZCA9IChiYXNlTWV0aG9kICYmIGJhc2VNZXRob2QuX2QgfHwgMCkgKyAxOyAvLyBBZGQgZmxhZyBmb3IgZGVyaXZlZCBtZXRob2QgKGluY3JlbWVudGVkIGZvciBkZXJpdmVkIG9mIGRlcml2ZWQuLi4pXG5cdH1cblx0cmV0dXJuIG1ldGhvZDtcbn1cblxuZnVuY3Rpb24gdGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpIHtcblx0dmFyIHByb3AsXG5cdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdGZvciAocHJvcCBpbiBwcm9wcykge1xuXHRcdGlmIChySGFzSGFuZGxlcnMudGVzdChwcm9wKSAmJiAhKHRhZ1twcm9wXSAmJiB0YWdbcHJvcF0uZml4KSkgeyAvLyBEb24ndCBvdmVycmlkZSBoYW5kbGVycyB3aXRoIGZpeCBleHBhbmRvICh1c2VkIGluIGRhdGVwaWNrZXIgYW5kIHNwaW5uZXIpXG5cdFx0XHR0YWdbcHJvcF0gPSBwcm9wICE9PSBcImNvbnZlcnRcIiA/IGdldE1ldGhvZCh0YWcuY29uc3RydWN0b3IucHJvdG90eXBlW3Byb3BdLCBwcm9wc1twcm9wXSkgOiBwcm9wc1twcm9wXTtcblx0XHRcdC8vIENvcHkgb3ZlciB0aGUgb25Gb28gcHJvcHMsIGNvbnZlcnQgYW5kIGNvbnZlcnRCYWNrIGZyb20gdGFnQ3R4LnByb3BzIHRvIHRhZyAob3ZlcnJpZGVzIHZhbHVlcyBpbiB0YWdEZWYpLlxuXHRcdFx0Ly8gTm90ZTogdW5zdXBwb3J0ZWQgc2NlbmFyaW86IGlmIGhhbmRsZXJzIGFyZSBkeW5hbWljYWxseSBhZGRlZCBeb25Gb289ZXhwcmVzc2lvbiB0aGlzIHdpbGwgd29yaywgYnV0IGR5bmFtaWNhbGx5IHJlbW92aW5nIHdpbGwgbm90IHdvcmsuXG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHJldFZhbCh2YWwpIHtcblx0cmV0dXJuIHZhbDtcbn1cblxuZnVuY3Rpb24gbm9vcCgpIHtcblx0cmV0dXJuIFwiXCI7XG59XG5cbmZ1bmN0aW9uIGRiZ0JyZWFrKHZhbCkge1xuXHQvLyBVc2FnZSBleGFtcGxlczoge3tkYmc6Li4ufX0sIHt7On5kYmcoLi4uKX19LCB7e2RiZyAuLi4vfX0sIHtee2ZvciAuLi4gb25BZnRlckxpbms9fmRiZ319IGV0Yy5cblx0dHJ5IHtcblx0XHRjb25zb2xlLmxvZyhcIkpzUmVuZGVyIGRiZyBicmVha3BvaW50OiBcIiArIHZhbCk7XG5cdFx0dGhyb3cgXCJkYmcgYnJlYWtwb2ludFwiOyAvLyBUbyBicmVhayBoZXJlLCBzdG9wIG9uIGNhdWdodCBleGNlcHRpb25zLlxuXHR9XG5cdGNhdGNoIChlKSB7fVxuXHRyZXR1cm4gdGhpcy5iYXNlID8gdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSA6IHZhbDtcbn1cblxuZnVuY3Rpb24gSnNWaWV3c0Vycm9yKG1lc3NhZ2UpIHtcblx0Ly8gRXJyb3IgZXhjZXB0aW9uIHR5cGUgZm9yIEpzVmlld3MvSnNSZW5kZXJcblx0Ly8gT3ZlcnJpZGUgb2YgJC52aWV3cy5zdWIuRXJyb3IgaXMgcG9zc2libGVcblx0dGhpcy5uYW1lID0gKCQubGluayA/IFwiSnNWaWV3c1wiIDogXCJKc1JlbmRlclwiKSArIFwiIEVycm9yXCI7XG5cdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgdGhpcy5uYW1lO1xufVxuXG5mdW5jdGlvbiAkZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG5cdGlmICh0YXJnZXQpIHtcblx0XHRmb3IgKHZhciBuYW1lIGluIHNvdXJjZSkge1xuXHRcdFx0dGFyZ2V0W25hbWVdID0gc291cmNlW25hbWVdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG59XG5cbihKc1ZpZXdzRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yKCkpLmNvbnN0cnVjdG9yID0gSnNWaWV3c0Vycm9yO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCBmdW5jdGlvbnMgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy89PT09PT09PT09PT09PT09PT09XG4vLyB2aWV3cy5kZWxpbWl0ZXJzXG4vLz09PT09PT09PT09PT09PT09PT1cblxuXHQvKipcblx0KiBTZXQgdGhlIHRhZyBvcGVuaW5nIGFuZCBjbG9zaW5nIGRlbGltaXRlcnMgYW5kICdsaW5rJyBjaGFyYWN0ZXIuIERlZmF1bHQgaXMgXCJ7e1wiLCBcIn19XCIgYW5kIFwiXlwiXG5cdCogb3BlbkNoYXJzLCBjbG9zZUNoYXJzOiBvcGVuaW5nIGFuZCBjbG9zaW5nIHN0cmluZ3MsIGVhY2ggd2l0aCB0d28gY2hhcmFjdGVyc1xuXHQqICQudmlld3Muc2V0dGluZ3MuZGVsaW1pdGVycyguLi4pXG5cdCpcblx0KiBAcGFyYW0ge3N0cmluZ30gICBvcGVuQ2hhcnNcblx0KiBAcGFyYW0ge3N0cmluZ30gICBbY2xvc2VDaGFyc11cblx0KiBAcGFyYW0ge3N0cmluZ30gICBbbGlua11cblx0KiBAcmV0dXJucyB7U2V0dGluZ3N9XG5cdCpcblx0KiBHZXQgZGVsaW1pdGVyc1xuXHQqIGRlbGltc0FycmF5ID0gJC52aWV3cy5zZXR0aW5ncy5kZWxpbWl0ZXJzKClcblx0KlxuXHQqIEByZXR1cm5zIHtzdHJpbmdbXX1cblx0Ki9cbmZ1bmN0aW9uICR2aWV3c0RlbGltaXRlcnMob3BlbkNoYXJzLCBjbG9zZUNoYXJzLCBsaW5rKSB7XG5cdGlmICghb3BlbkNoYXJzKSB7XG5cdFx0cmV0dXJuICRzdWJTZXR0aW5ncy5kZWxpbWl0ZXJzO1xuXHR9XG5cdGlmICgkaXNBcnJheShvcGVuQ2hhcnMpKSB7XG5cdFx0cmV0dXJuICR2aWV3c0RlbGltaXRlcnMuYXBwbHkoJHZpZXdzLCBvcGVuQ2hhcnMpO1xuXHR9XG5cdGxpbmtDaGFyID0gbGluayA/IGxpbmtbMF0gOiBsaW5rQ2hhcjtcblx0aWYgKCEvXihcXFd8Xyl7NX0kLy50ZXN0KG9wZW5DaGFycyArIGNsb3NlQ2hhcnMgKyBsaW5rQ2hhcikpIHtcblx0XHRlcnJvcihcIkludmFsaWQgZGVsaW1pdGVyc1wiKTsgLy8gTXVzdCBiZSBub24td29yZCBjaGFyYWN0ZXJzLCBhbmQgb3BlbkNoYXJzIGFuZCBjbG9zZUNoYXJzIG11c3QgZWFjaCBiZSBsZW5ndGggMlxuXHR9XG5cdGRlbGltT3BlbkNoYXIwID0gb3BlbkNoYXJzWzBdO1xuXHRkZWxpbU9wZW5DaGFyMSA9IG9wZW5DaGFyc1sxXTtcblx0ZGVsaW1DbG9zZUNoYXIwID0gY2xvc2VDaGFyc1swXTtcblx0ZGVsaW1DbG9zZUNoYXIxID0gY2xvc2VDaGFyc1sxXTtcblxuXHQkc3ViU2V0dGluZ3MuZGVsaW1pdGVycyA9IFtkZWxpbU9wZW5DaGFyMCArIGRlbGltT3BlbkNoYXIxLCBkZWxpbUNsb3NlQ2hhcjAgKyBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyXTtcblxuXHQvLyBFc2NhcGUgdGhlIGNoYXJhY3RlcnMgLSBzaW5jZSB0aGV5IGNvdWxkIGJlIHJlZ2V4IHNwZWNpYWwgY2hhcmFjdGVyc1xuXHRvcGVuQ2hhcnMgPSBcIlxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjE7IC8vIERlZmF1bHQgaXMgXCJ7XntcIlxuXHRjbG9zZUNoYXJzID0gXCJcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIlxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMTsgICAgICAgICAgICAgICAgICAgLy8gRGVmYXVsdCBpcyBcIn19XCJcblx0Ly8gQnVpbGQgcmVnZXggd2l0aCBuZXcgZGVsaW1pdGVyc1xuXHQvLyAgICAgICAgICBbdGFnICAgIChmb2xsb3dlZCBieSAvIHNwYWNlIG9yIH0pICBvciBjdnRyK2NvbG9uIG9yIGh0bWwgb3IgY29kZV0gZm9sbG93ZWQgYnkgc3BhY2UrcGFyYW1zIHRoZW4gY29udmVydEJhY2s/XG5cdHJUYWcgPSBcIig/OihcXFxcdysoPz1bXFxcXC9cXFxcc1xcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiXSkpfChcXFxcdyspPyg6KXwoPil8KFxcXFwqKSlcXFxccyooKD86W15cXFxcXCJcblx0XHQrIGRlbGltQ2xvc2VDaGFyMCArIFwiXXxcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIig/IVxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMSArIFwiKSkqPylcIjtcblxuXHQvLyBNYWtlIHJUYWcgYXZhaWxhYmxlIHRvIEpzVmlld3MgKG9yIG90aGVyIGNvbXBvbmVudHMpIGZvciBwYXJzaW5nIGJpbmRpbmcgZXhwcmVzc2lvbnNcblx0JHN1Yi5yVGFnID0gXCIoPzpcIiArIHJUYWcgKyBcIilcIjtcblx0Ly8gICAgICAgICAgICAgICAgICAgICAgICB7IF4/IHsgICB0YWcrcGFyYW1zIHNsYXNoPyAgb3IgY2xvc2luZ1RhZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yIGNvbW1lbnRcblx0clRhZyA9IG5ldyBSZWdFeHAoXCIoPzpcIiArIG9wZW5DaGFycyArIHJUYWcgKyBcIihcXFxcLyk/fFxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjEgKyBcIig/Oig/OlxcXFwvKFxcXFx3KykpXFxcXHMqfCEtLVtcXFxcc1xcXFxTXSo/LS0pKVwiICsgY2xvc2VDaGFycywgXCJnXCIpO1xuXG5cdC8vIERlZmF1bHQ6ICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcblx0Ly8gICAgICAvKD86eyhcXF4pP3soPzooXFx3Kyg/PVtcXC9cXHN9XSkpfChcXHcrKT8oOil8KD4pfChcXCopKVxccyooKD86W159XXx9KD8hfSkpKj8pKFxcLyk/fHsoXFxeKT97KD86KD86XFwvKFxcdyspKVxccyp8IS0tW1xcc1xcU10qPy0tKSl9fVxuXG5cdCRzdWIuclRtcGwgPSBuZXcgUmVnRXhwKFwiXlxcXFxzfFxcXFxzJHw8Lio+fChbXlxcXFxcXFxcXXxeKVt7fV18XCIgKyBvcGVuQ2hhcnMgKyBcIi4qXCIgKyBjbG9zZUNoYXJzKTtcblx0Ly8gJHN1Yi5yVG1wbCBsb29rcyBmb3IgaW5pdGlhbCBvciBmaW5hbCB3aGl0ZSBzcGFjZSwgaHRtbCB0YWdzIG9yIHsgb3IgfSBjaGFyIG5vdCBwcmVjZWRlZCBieSBcXFxcLCBvciBKc1JlbmRlciB0YWdzIHt7eHh4fX0uXG5cdC8vIEVhY2ggb2YgdGhlc2Ugc3RyaW5ncyBhcmUgY29uc2lkZXJlZCBOT1QgdG8gYmUgalF1ZXJ5IHNlbGVjdG9yc1xuXHRyZXR1cm4gJHZpZXdzU2V0dGluZ3M7XG59XG5cbi8vPT09PT09PT09XG4vLyBWaWV3LmdldFxuLy89PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0Vmlldyhpbm5lciwgdHlwZSkgeyAvL3ZpZXcuZ2V0KGlubmVyLCB0eXBlKVxuXHRpZiAoIXR5cGUgJiYgaW5uZXIgIT09IHRydWUpIHtcblx0XHQvLyB2aWV3LmdldCh0eXBlKVxuXHRcdHR5cGUgPSBpbm5lcjtcblx0XHRpbm5lciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHZhciB2aWV3cywgaSwgbCwgZm91bmQsXG5cdFx0dmlldyA9IHRoaXMsXG5cdFx0cm9vdCA9IHR5cGUgPT09IFwicm9vdFwiO1xuXHRcdC8vIHZpZXcuZ2V0KFwicm9vdFwiKSByZXR1cm5zIHZpZXcucm9vdCwgdmlldy5nZXQoKSByZXR1cm5zIHZpZXcucGFyZW50LCB2aWV3LmdldCh0cnVlKSByZXR1cm5zIHZpZXcudmlld3NbMF0uXG5cblx0aWYgKGlubmVyKSB7XG5cdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIG5lc3RlZCBvbmVzLCBkZXB0aC1maXJzdCAtIGFuZCByZXR1cm4gZmlyc3Qgb25lIHdpdGggZ2l2ZW4gdHlwZS5cblx0XHQvLyBJZiB0eXBlIGlzIHVuZGVmaW5lZCwgaS5lLiB2aWV3LmdldCh0cnVlKSwgcmV0dXJuIGZpcnN0IGNoaWxkIHZpZXcuXG5cdFx0Zm91bmQgPSB0eXBlICYmIHZpZXcudHlwZSA9PT0gdHlwZSAmJiB2aWV3O1xuXHRcdGlmICghZm91bmQpIHtcblx0XHRcdHZpZXdzID0gdmlldy52aWV3cztcblx0XHRcdGlmICh2aWV3Ll8udXNlS2V5KSB7XG5cdFx0XHRcdGZvciAoaSBpbiB2aWV3cykge1xuXHRcdFx0XHRcdGlmIChmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV0pIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChpID0gMCwgbCA9IHZpZXdzLmxlbmd0aDsgIWZvdW5kICYmIGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHRmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAocm9vdCkge1xuXHRcdC8vIEZpbmQgcm9vdCB2aWV3LiAodmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXcpXG5cdFx0Zm91bmQgPSB2aWV3LnJvb3Q7XG5cdH0gZWxzZSBpZiAodHlwZSkge1xuXHRcdHdoaWxlICh2aWV3ICYmICFmb3VuZCkge1xuXHRcdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIHBhcmVudCBvbmVzIC0gYW5kIHJldHVybiBmaXJzdCBvbmUgd2l0aCBnaXZlbiB0eXBlLlxuXHRcdFx0Zm91bmQgPSB2aWV3LnR5cGUgPT09IHR5cGUgPyB2aWV3IDogdW5kZWZpbmVkO1xuXHRcdFx0dmlldyA9IHZpZXcucGFyZW50O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRmb3VuZCA9IHZpZXcucGFyZW50O1xuXHR9XG5cdHJldHVybiBmb3VuZCB8fCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldE5lc3RlZEluZGV4KCkge1xuXHR2YXIgdmlldyA9IHRoaXMuZ2V0KFwiaXRlbVwiKTtcblx0cmV0dXJuIHZpZXcgPyB2aWV3LmluZGV4IDogdW5kZWZpbmVkO1xufVxuXG5nZXROZXN0ZWRJbmRleC5kZXBlbmRzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBbdGhpcy5nZXQoXCJpdGVtXCIpLCBcImluZGV4XCJdO1xufTtcblxuZnVuY3Rpb24gZ2V0SW5kZXgoKSB7XG5cdHJldHVybiB0aGlzLmluZGV4O1xufVxuXG5nZXRJbmRleC5kZXBlbmRzID0gXCJpbmRleFwiO1xuXG4vLz09PT09PT09PT09PT09PT09PVxuLy8gVmlldy5jdHhQcm0sIGV0Yy5cbi8vPT09PT09PT09PT09PT09PT09XG5cbi8qIEludGVybmFsIHByaXZhdGU6IHZpZXcuX2dldE9iKCkgKi9cbmZ1bmN0aW9uIGdldFBhdGhPYmplY3Qob2IsIHBhdGgsIGx0T2IsIGZuKSB7XG5cdC8vIEl0ZXJhdGUgdGhyb3VnaCBwYXRoIHRvIGxhdGUgcGF0aHM6IEBhLmIuYyBwYXRoc1xuXHQvLyBSZXR1cm4gXCJcIiAob3Igbm9vcCBpZiBsZWFmIGlzIGEgZnVuY3Rpb24gQGEuYi5jKC4uLikgKSBpZiBpbnRlcm1lZGlhdGUgb2JqZWN0IG5vdCB5ZXQgYXZhaWxhYmxlXG5cdHZhciBwcmV2T2IsIHRva2VucywgbCxcblx0XHRpID0gMDtcblx0aWYgKGx0T2IgPT09IDEpIHtcblx0XHRmbiA9IDE7XG5cdFx0bHRPYiA9IHVuZGVmaW5lZDtcblx0fVxuXHQvLyBQYXRocyBsaWtlIF5hXmJeYyBvciB+XmFeYl5jIHdpbGwgbm90IHRocm93IGlmIGFuIG9iamVjdCBpbiBwYXRoIGlzIHVuZGVmaW5lZC5cblx0aWYgKHBhdGgpIHtcblx0XHR0b2tlbnMgPSBwYXRoLnNwbGl0KFwiLlwiKTtcblx0XHRsID0gdG9rZW5zLmxlbmd0aDtcblxuXHRcdGZvciAoOyBvYiAmJiBpIDwgbDsgaSsrKSB7XG5cdFx0XHRwcmV2T2IgPSBvYjtcblx0XHRcdG9iID0gdG9rZW5zW2ldID8gb2JbdG9rZW5zW2ldXSA6IG9iO1xuXHRcdH1cblx0fVxuXHRpZiAobHRPYikge1xuXHRcdGx0T2IubHQgPSBsdE9iLmx0IHx8IGk8bDsgLy8gSWYgaSA8IGwgdGhlcmUgd2FzIGFuIG9iamVjdCBpbiB0aGUgcGF0aCBub3QgeWV0IGF2YWlsYWJsZVxuXHR9XG5cdHJldHVybiBvYiA9PT0gdW5kZWZpbmVkXG5cdFx0PyBmbiA/IG5vb3AgOiBcIlwiXG5cdFx0OiBmbiA/IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIG9iLmFwcGx5KHByZXZPYiwgYXJndW1lbnRzKTtcblx0XHR9IDogb2I7XG59XG5cbmZ1bmN0aW9uIGNvbnRleHRQYXJhbWV0ZXIoa2V5LCB2YWx1ZSwgZ2V0KSB7XG5cdC8vIEhlbHBlciBtZXRob2QgY2FsbGVkIGFzIHZpZXcuY3R4UHJtKGtleSkgZm9yIGhlbHBlcnMgb3IgdGVtcGxhdGUgcGFyYW1ldGVycyB+Zm9vIC0gZnJvbSBjb21waWxlZCB0ZW1wbGF0ZSBvciBmcm9tIGNvbnRleHQgY2FsbGJhY2tcblx0dmFyIHdyYXBwZWQsIGRlcHMsIHJlcywgb2JzQ3R4UHJtLCB0YWdFbHNlLCBjYWxsVmlldywgbmV3UmVzLFxuXHRcdHN0b3JlVmlldyA9IHRoaXMsXG5cdFx0aXNVcGRhdGUgPSAhaXNSZW5kZXJDYWxsICYmIGFyZ3VtZW50cy5sZW5ndGggPiAxLFxuXHRcdHN0b3JlID0gc3RvcmVWaWV3LmN0eDtcblx0aWYgKGtleSkge1xuXHRcdGlmICghc3RvcmVWaWV3Ll8pIHsgLy8gdGFnQ3R4LmN0eFBybSgpIGNhbGxcblx0XHRcdHRhZ0Vsc2UgPSBzdG9yZVZpZXcuaW5kZXg7XG5cdFx0XHRzdG9yZVZpZXcgPSBzdG9yZVZpZXcudGFnO1xuXHRcdH1cblx0XHRjYWxsVmlldyA9IHN0b3JlVmlldztcblx0XHRpZiAoc3RvcmUgJiYgc3RvcmUuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAoc3RvcmUgPSAkaGVscGVycykuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0cmVzID0gc3RvcmVba2V5XTtcblx0XHRcdGlmIChrZXkgPT09IFwidGFnXCIgfHwga2V5ID09PSBcInRhZ0N0eFwiIHx8IGtleSA9PT0gXCJyb290XCIgfHwga2V5ID09PSBcInBhcmVudFRhZ3NcIikge1xuXHRcdFx0XHRyZXR1cm4gcmVzO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdG9yZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCFpc1JlbmRlckNhbGwgJiYgc3RvcmVWaWV3LnRhZ0N0eCB8fCBzdG9yZVZpZXcubGlua2VkKSB7IC8vIERhdGEtbGlua2VkIHZpZXcsIG9yIHRhZyBpbnN0YW5jZVxuXHRcdFx0aWYgKCFyZXMgfHwgIXJlcy5fY3hwKSB7XG5cdFx0XHRcdC8vIE5vdCBhIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdC8vIFNldCBzdG9yZVZpZXcgdG8gdGFnIChpZiB0aGlzIGlzIGEgdGFnLmN0eFBybSgpIGNhbGwpIG9yIHRvIHJvb3QgdmlldyAoXCJkYXRhXCIgdmlldyBvZiBsaW5rZWQgdGVtcGxhdGUpXG5cdFx0XHRcdHN0b3JlVmlldyA9IHN0b3JlVmlldy50YWdDdHggfHwgJGlzRnVuY3Rpb24ocmVzKVxuXHRcdFx0XHRcdD8gc3RvcmVWaWV3IC8vIElzIGEgdGFnLCBub3QgYSB2aWV3LCBvciBpcyBhIGNvbXB1dGVkIGNvbnRleHR1YWwgcGFyYW1ldGVyLCBzbyBzY29wZSB0byB0aGUgY2FsbFZpZXcsIG5vdCB0aGUgJ3Njb3BlIHZpZXcnXG5cdFx0XHRcdFx0OiAoc3RvcmVWaWV3ID0gc3RvcmVWaWV3LnNjb3BlIHx8IHN0b3JlVmlldyxcblx0XHRcdFx0XHRcdCFzdG9yZVZpZXcuaXNUb3AgJiYgc3RvcmVWaWV3LmN0eC50YWcgLy8gSWYgdGhpcyB2aWV3IGlzIGluIGEgdGFnLCBzZXQgc3RvcmVWaWV3IHRvIHRoZSB0YWdcblx0XHRcdFx0XHRcdFx0fHwgc3RvcmVWaWV3KTtcblx0XHRcdFx0aWYgKHJlcyAhPT0gdW5kZWZpbmVkICYmIHN0b3JlVmlldy50YWdDdHgpIHtcblx0XHRcdFx0XHQvLyBJZiBzdG9yZVZpZXcgaXMgYSB0YWcsIGJ1dCB0aGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgaGFzIGJlZW4gc2V0IGF0IGF0IGhpZ2hlciBsZXZlbCAoZS5nLiBoZWxwZXJzKS4uLlxuXHRcdFx0XHRcdHN0b3JlVmlldyA9IHN0b3JlVmlldy50YWdDdHgudmlldy5zY29wZTsgLy8gdGhlbiBtb3ZlIHN0b3JlVmlldyB0byB0aGUgb3V0ZXIgbGV2ZWwgKHNjb3BlIG9mIHRhZyBjb250YWluZXIgdmlldylcblx0XHRcdFx0fVxuXHRcdFx0XHRzdG9yZSA9IHN0b3JlVmlldy5fb2Nwcztcblx0XHRcdFx0cmVzID0gc3RvcmUgJiYgc3RvcmUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBzdG9yZVtrZXldIHx8IHJlcztcblx0XHRcdFx0aWYgKCEocmVzICYmIHJlcy5fY3hwKSAmJiAoZ2V0IHx8IGlzVXBkYXRlKSkge1xuXHRcdFx0XHRcdC8vIENyZWF0ZSBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdFx0KHN0b3JlIHx8IChzdG9yZVZpZXcuX29jcHMgPSBzdG9yZVZpZXcuX29jcHMgfHwge30pKVtrZXldXG5cdFx0XHRcdFx0XHQ9IHJlc1xuXHRcdFx0XHRcdFx0PSBbe1xuXHRcdFx0XHRcdFx0XHRfb2NwOiByZXMsIC8vIFRoZSBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyIHZhbHVlXG5cdFx0XHRcdFx0XHRcdF92dzogY2FsbFZpZXcsXG5cdFx0XHRcdFx0XHRcdF9rZXk6IGtleVxuXHRcdFx0XHRcdFx0fV07XG5cdFx0XHRcdFx0cmVzLl9jeHAgPSB7XG5cdFx0XHRcdFx0XHRwYXRoOiBfb2NwLFxuXHRcdFx0XHRcdFx0aW5kOiAwLFxuXHRcdFx0XHRcdFx0dXBkYXRlVmFsdWU6IGZ1bmN0aW9uKHZhbCwgcGF0aCkge1xuXHRcdFx0XHRcdFx0XHQkLm9ic2VydmFibGUocmVzWzBdKS5zZXRQcm9wZXJ0eShfb2NwLCB2YWwpOyAvLyBTZXQgdGhlIHZhbHVlIChyZXNbMF0uX29jcClcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9ic0N0eFBybSA9IHJlcyAmJiByZXMuX2N4cCkge1xuXHRcdFx0XHQvLyBJZiB0aGlzIGhlbHBlciByZXNvdXJjZSBpcyBhbiBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuXHRcdFx0XHRcdGRlcHMgPSByZXNbMV0gPyAkc3ViLl9jZW8ocmVzWzFdLmRlcHMpIDogW19vY3BdOyAvLyBmbiBkZXBzICh3aXRoIGFueSBleHByT2JzIGNsb25lZCB1c2luZyAkc3ViLl9jZW8pXG5cdFx0XHRcdFx0ZGVwcy51bnNoaWZ0KHJlc1swXSk7IC8vIHZpZXdcblx0XHRcdFx0XHRkZXBzLl9jeHAgPSBvYnNDdHhQcm07XG5cdFx0XHRcdFx0Ly8gSW4gYSBjb250ZXh0IGNhbGxiYWNrIGZvciBhIGNvbnRleHR1YWwgcGFyYW0sIHdlIHNldCBnZXQgPSB0cnVlLCB0byBnZXQgY3R4UHJtIFt2aWV3LCBkZXBlbmRlbmNpZXMuLi5dIGFycmF5IC0gbmVlZGVkIGZvciBvYnNlcnZlIGNhbGxcblx0XHRcdFx0XHRyZXR1cm4gZGVwcztcblx0XHRcdFx0fVxuXHRcdFx0XHR0YWdFbHNlID0gb2JzQ3R4UHJtLnRhZ0Vsc2U7XG5cdFx0XHRcdG5ld1JlcyA9IHJlc1sxXSAvLyBsaW5rRm4gZm9yIGNvbXBpbGVkIGV4cHJlc3Npb25cblx0XHRcdFx0XHQ/IG9ic0N0eFBybS50YWcgJiYgb2JzQ3R4UHJtLnRhZy5jdnRBcmdzXG5cdFx0XHRcdFx0XHQ/IG9ic0N0eFBybS50YWcuY3Z0QXJncyh0YWdFbHNlLCAxKVtvYnNDdHhQcm0uaW5kXSAvLyA9IHRhZy5ibmRBcmdzKCkgLSBmb3IgdGFnIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdFx0XHQ6IHJlc1sxXShyZXNbMF0uZGF0YSwgcmVzWzBdLCAkc3ViKSAvLyA9IGZuKGRhdGEsIHZpZXcsICRzdWIpIGZvciBjb21waWxlZCBiaW5kaW5nIGV4cHJlc3Npb25cblx0XHRcdFx0XHQ6IHJlc1swXS5fb2NwOyAvLyBPYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyICh1bmluaXRpYWxpemVkLCBvciBpbml0aWFsaXplZCBhcyBzdGF0aWMgZXhwcmVzc2lvbiwgc28gbm8gcGF0aCBkZXBlbmRlbmNpZXMpXG5cdFx0XHRcdGlmIChpc1VwZGF0ZSkge1xuXHRcdFx0XHRcdCRzdWIuX3VjcChrZXksIHZhbHVlLCBzdG9yZVZpZXcsIG9ic0N0eFBybSk7IC8vIFVwZGF0ZSBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdFx0cmV0dXJuIHN0b3JlVmlldztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXMgPSBuZXdSZXM7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZXMgJiYgJGlzRnVuY3Rpb24ocmVzKSkge1xuXHRcdFx0Ly8gSWYgYSBoZWxwZXIgaXMgb2YgdHlwZSBmdW5jdGlvbiB3ZSB3aWxsIHdyYXAgaXQsIHNvIGlmIGNhbGxlZCB3aXRoIG5vIHRoaXMgcG9pbnRlciBpdCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZVxuXHRcdFx0Ly8gdmlldyBhcyAndGhpcycgY29udGV4dC4gSWYgdGhlIGhlbHBlciB+Zm9vKCkgd2FzIGluIGEgZGF0YS1saW5rIGV4cHJlc3Npb24sIHRoZSB2aWV3IHdpbGwgaGF2ZSBhICd0ZW1wb3JhcnknIGxpbmtDdHggcHJvcGVydHkgdG9vLlxuXHRcdFx0Ly8gTm90ZSB0aGF0IGhlbHBlciBmdW5jdGlvbnMgb24gZGVlcGVyIHBhdGhzIHdpbGwgaGF2ZSBzcGVjaWZpYyB0aGlzIHBvaW50ZXJzLCBmcm9tIHRoZSBwcmVjZWRpbmcgcGF0aC5cblx0XHRcdC8vIEZvciBleGFtcGxlLCB+dXRpbC5mb28oKSB3aWxsIGhhdmUgdGhlIH51dGlsIG9iamVjdCBhcyAndGhpcycgcG9pbnRlclxuXHRcdFx0d3JhcHBlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzLmFwcGx5KCghdGhpcyB8fCB0aGlzID09PSBnbG9iYWwpID8gY2FsbFZpZXcgOiB0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0fTtcblx0XHRcdCRleHRlbmQod3JhcHBlZCwgcmVzKTsgLy8gQXR0YWNoIHNhbWUgZXhwYW5kb3MgKGlmIGFueSkgdG8gdGhlIHdyYXBwZWQgZnVuY3Rpb25cblx0XHR9XG5cdFx0cmV0dXJuIHdyYXBwZWQgfHwgcmVzO1xuXHR9XG59XG5cbi8qIEludGVybmFsIHByaXZhdGU6IHZpZXcuX2dldFRtcGwoKSAqL1xuZnVuY3Rpb24gZ2V0VGVtcGxhdGUodG1wbCkge1xuXHRyZXR1cm4gdG1wbCAmJiAodG1wbC5mblxuXHRcdD8gdG1wbFxuXHRcdDogdGhpcy5nZXRSc2MoXCJ0ZW1wbGF0ZXNcIiwgdG1wbCkgfHwgJHRlbXBsYXRlcyh0bXBsKSk7IC8vIG5vdCB5ZXQgY29tcGlsZWRcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gdmlld3MuX2NudnRcbi8vPT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29udmVydFZhbChjb252ZXJ0ZXIsIHZpZXcsIHRhZ0N0eCwgb25FcnJvcikge1xuXHQvLyBDYWxsZWQgZnJvbSBjb21waWxlZCB0ZW1wbGF0ZSBjb2RlIGZvciB7ezp9fVxuXHQvLyBzZWxmIGlzIHRlbXBsYXRlIG9iamVjdCBvciBsaW5rQ3R4IG9iamVjdFxuXHR2YXIgdGFnLCBsaW5rQ3R4LCB2YWx1ZSwgYXJnc0xlbiwgYmluZFRvLFxuXHRcdC8vIElmIHRhZ0N0eCBpcyBhbiBpbnRlZ2VyLCB0aGVuIGl0IGlzIHRoZSBrZXkgZm9yIHRoZSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIGJvdW5kVGFnIHRhZ0N0eFxuXHRcdGJvdW5kVGFnID0gdHlwZW9mIHRhZ0N0eCA9PT0gXCJudW1iZXJcIiAmJiB2aWV3LnRtcGwuYm5kc1t0YWdDdHgtMV07XG5cblx0aWYgKG9uRXJyb3IgPT09IHVuZGVmaW5lZCAmJiBib3VuZFRhZyAmJiBib3VuZFRhZy5fbHIpIHsgLy8gbGF0ZVJlbmRlclxuXHRcdG9uRXJyb3IgPSBcIlwiO1xuXHR9XG5cdGlmIChvbkVycm9yICE9PSB1bmRlZmluZWQpIHtcblx0XHR0YWdDdHggPSBvbkVycm9yID0ge3Byb3BzOiB7fSwgYXJnczogW29uRXJyb3JdfTtcblx0fSBlbHNlIGlmIChib3VuZFRhZykge1xuXHRcdHRhZ0N0eCA9IGJvdW5kVGFnKHZpZXcuZGF0YSwgdmlldywgJHN1Yik7XG5cdH1cblx0Ym91bmRUYWcgPSBib3VuZFRhZy5fYmQgJiYgYm91bmRUYWc7XG5cdGlmIChjb252ZXJ0ZXIgfHwgYm91bmRUYWcpIHtcblx0XHRsaW5rQ3R4ID0gdmlldy5fbGM7IC8vIEZvciBkYXRhLWxpbms9XCJ7Y3Z0Oi4uLn1cIi4uLiBTZWUgb25EYXRhTGlua2VkVGFnQ2hhbmdlXG5cdFx0dGFnID0gbGlua0N0eCAmJiBsaW5rQ3R4LnRhZztcblx0XHR0YWdDdHgudmlldyA9IHZpZXc7XG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdHRhZyA9ICRleHRlbmQobmV3ICRzdWIuX3RnKCksIHtcblx0XHRcdFx0Xzoge1xuXHRcdFx0XHRcdGJuZDogYm91bmRUYWcsXG5cdFx0XHRcdFx0dW5saW5rZWQ6IHRydWUsXG5cdFx0XHRcdFx0bHQ6IHRhZ0N0eC5sdCAvLyBJZiBhIGxhdGUgcGF0aCBAc29tZS5wYXRoIGhhcyBub3QgcmV0dXJuZWQgQHNvbWUgb2JqZWN0LCBtYXJrIHRhZyBhcyBsYXRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlubGluZTogIWxpbmtDdHgsXG5cdFx0XHRcdHRhZ05hbWU6IFwiOlwiLFxuXHRcdFx0XHRjb252ZXJ0OiBjb252ZXJ0ZXIsXG5cdFx0XHRcdG9uQXJyYXlDaGFuZ2U6IHRydWUsXG5cdFx0XHRcdGZsb3c6IHRydWUsXG5cdFx0XHRcdHRhZ0N0eDogdGFnQ3R4LFxuXHRcdFx0XHR0YWdDdHhzOiBbdGFnQ3R4XSxcblx0XHRcdFx0X2lzOiBcInRhZ1wiXG5cdFx0XHR9KTtcblx0XHRcdGFyZ3NMZW4gPSB0YWdDdHguYXJncy5sZW5ndGg7XG5cdFx0XHRpZiAoYXJnc0xlbj4xKSB7XG5cdFx0XHRcdGJpbmRUbyA9IHRhZy5iaW5kVG8gPSBbXTtcblx0XHRcdFx0d2hpbGUgKGFyZ3NMZW4tLSkge1xuXHRcdFx0XHRcdGJpbmRUby51bnNoaWZ0KGFyZ3NMZW4pOyAvLyBCaW5kIHRvIGFsbCB0aGUgYXJndW1lbnRzIC0gZ2VuZXJhdGUgYmluZFRvIGFycmF5OiBbMCwxLDIuLi5dXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIChsaW5rQ3R4ID8gbGlua0N0eC52aWV3IDogdmlldykuY3R4KTtcblx0XHRcdHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4KTtcblx0XHR9XG5cdFx0dGFnLl9lciA9IG9uRXJyb3IgJiYgdmFsdWU7XG5cdFx0dGFnLmN0eCA9IHRhZ0N0eC5jdHggfHwgdGFnLmN0eCB8fCB7fTtcblx0XHR0YWdDdHguY3R4ID0gdW5kZWZpbmVkO1xuXHRcdHZhbHVlID0gdGFnLmN2dEFyZ3MoKVswXTsgLy8gSWYgdGhlcmUgaXMgYSBjb252ZXJ0QmFjayBidXQgbm8gY29udmVydCwgY29udmVydGVyIHdpbGwgYmUgXCJ0cnVlXCJcblx0XHR0YWcuX2VyID0gb25FcnJvciAmJiB2YWx1ZTtcblx0fSBlbHNlIHtcblx0XHR2YWx1ZSA9IHRhZ0N0eC5hcmdzWzBdO1xuXHR9XG5cblx0Ly8gQ2FsbCBvblJlbmRlciAodXNlZCBieSBKc1ZpZXdzIGlmIHByZXNlbnQsIHRvIGFkZCBiaW5kaW5nIGFubm90YXRpb25zIGFyb3VuZCByZW5kZXJlZCBjb250ZW50KVxuXHR2YWx1ZSA9IGJvdW5kVGFnICYmIHZpZXcuXy5vblJlbmRlclxuXHRcdD8gdmlldy5fLm9uUmVuZGVyKHZhbHVlLCB2aWV3LCB0YWcpXG5cdFx0OiB2YWx1ZTtcblx0cmV0dXJuIHZhbHVlICE9IHVuZGVmaW5lZCA/IHZhbHVlIDogXCJcIjtcbn1cblxuZnVuY3Rpb24gY29udmVydEFyZ3ModGFnRWxzZSwgYm91bmQpIHsgLy8gdGFnLmN2dEFyZ3MoKSBvciB0YWcuY3Z0QXJncyh0YWdFbHNlPywgdHJ1ZT8pXG5cdHZhciBsLCBrZXksIGJvdW5kQXJncywgYXJncywgYmluZEZyb20sIHRhZywgY29udmVydGVyLFxuXHRcdHRhZ0N0eCA9IHRoaXM7XG5cblx0aWYgKHRhZ0N0eC50YWdOYW1lKSB7XG5cdFx0dGFnID0gdGFnQ3R4O1xuXHRcdHRhZ0N0eCA9ICh0YWcudGFnQ3R4cyB8fCBbdGFnQ3R4XSlbdGFnRWxzZXx8MF07XG5cdFx0aWYgKCF0YWdDdHgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0dGFnID0gdGFnQ3R4LnRhZztcblx0fVxuXG5cdGJpbmRGcm9tID0gdGFnLmJpbmRGcm9tO1xuXHRhcmdzID0gdGFnQ3R4LmFyZ3M7XG5cblx0aWYgKChjb252ZXJ0ZXIgPSB0YWcuY29udmVydCkgJiYgdHlwZW9mIGNvbnZlcnRlciA9PT0gU1RSSU5HKSB7XG5cdFx0Y29udmVydGVyID0gY29udmVydGVyID09PSBcInRydWVcIlxuXHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdDogKHRhZ0N0eC52aWV3LmdldFJzYyhcImNvbnZlcnRlcnNcIiwgY29udmVydGVyKSB8fCBlcnJvcihcIlVua25vd24gY29udmVydGVyOiAnXCIgKyBjb252ZXJ0ZXIgKyBcIidcIikpO1xuXHR9XG5cblx0aWYgKGNvbnZlcnRlciAmJiAhYm91bmQpIHsgLy8gSWYgdGhlcmUgaXMgYSBjb252ZXJ0ZXIsIHVzZSBhIGNvcHkgb2YgdGhlIHRhZ0N0eC5hcmdzIGFycmF5IGZvciByZW5kZXJpbmcsIGFuZCByZXBsYWNlIHRoZSBhcmdzWzBdIGluXG5cdFx0YXJncyA9IGFyZ3Muc2xpY2UoKTsgLy8gdGhlIGNvcGllZCBhcnJheSB3aXRoIHRoZSBjb252ZXJ0ZWQgdmFsdWUuIEJ1dCB3ZSBkbyBub3QgbW9kaWZ5IHRoZSB2YWx1ZSBvZiB0YWcudGFnQ3R4LmFyZ3NbMF0gKHRoZSBvcmlnaW5hbCBhcmdzIGFycmF5KVxuXHR9XG5cdGlmIChiaW5kRnJvbSkgeyAvLyBHZXQgdGhlIHZhbHVlcyBvZiB0aGUgYm91bmRBcmdzXG5cdFx0Ym91bmRBcmdzID0gW107XG5cdFx0bCA9IGJpbmRGcm9tLmxlbmd0aDtcblx0XHR3aGlsZSAobC0tKSB7XG5cdFx0XHRrZXkgPSBiaW5kRnJvbVtsXTtcblx0XHRcdGJvdW5kQXJncy51bnNoaWZ0KGFyZ09yUHJvcCh0YWdDdHgsIGtleSkpO1xuXHRcdH1cblx0XHRpZiAoYm91bmQpIHtcblx0XHRcdGFyZ3MgPSBib3VuZEFyZ3M7IC8vIENhbGwgdG8gYm5kQXJncygpIC0gcmV0dXJucyB0aGUgYm91bmRBcmdzXG5cdFx0fVxuXHR9XG5cdGlmIChjb252ZXJ0ZXIpIHtcblx0XHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIuYXBwbHkodGFnLCBib3VuZEFyZ3MgfHwgYXJncyk7XG5cdFx0aWYgKGNvbnZlcnRlciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gYXJnczsgLy8gUmV0dXJuaW5nIHVuZGVmaW5lZCBmcm9tIGEgY29udmVydGVyIGlzIGVxdWl2YWxlbnQgdG8gbm90IGhhdmluZyBhIGNvbnZlcnRlci5cblx0XHR9XG5cdFx0YmluZEZyb20gPSBiaW5kRnJvbSB8fCBbMF07XG5cdFx0bCA9IGJpbmRGcm9tLmxlbmd0aDtcblx0XHRpZiAoISRpc0FycmF5KGNvbnZlcnRlcikgfHwgKGNvbnZlcnRlci5hcmcwICE9PSBmYWxzZSAmJiAobCA9PT0gMSB8fCBjb252ZXJ0ZXIubGVuZ3RoICE9PSBsIHx8IGNvbnZlcnRlci5hcmcwKSkpIHtcblx0XHRcdGNvbnZlcnRlciA9IFtjb252ZXJ0ZXJdOyAvLyBSZXR1cm5pbmcgY29udmVydGVyIGFzIGZpcnN0IGFyZywgZXZlbiBpZiBjb252ZXJ0ZXIgdmFsdWUgaXMgYW4gYXJyYXlcblx0XHRcdGJpbmRGcm9tID0gWzBdO1xuXHRcdFx0bCA9IDE7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkgeyAgICAgICAgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSBzbyBhcHBseSBjb252ZXJ0ZXIgdG8gYWxsIGJvdW5kQXJnc1xuXHRcdFx0YXJncyA9IGNvbnZlcnRlcjsgLy8gVGhlIGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBmcm9tIHRoZSBjb252ZXJ0ZXJcblx0XHR9IGVsc2UgeyAgICAgICAgICAgIC8vIENhbGwgdG8gY3Z0QXJncygpXG5cdFx0XHR3aGlsZSAobC0tKSB7XG5cdFx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0XHRpZiAoK2tleSA9PT0ga2V5KSB7XG5cdFx0XHRcdFx0YXJnc1trZXldID0gY29udmVydGVyW2xdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBhcmdzO1xufVxuXG5mdW5jdGlvbiBhcmdPclByb3AoY29udGV4dCwga2V5KSB7XG5cdGNvbnRleHQgPSBjb250ZXh0WytrZXkgPT09IGtleSA/IFwiYXJnc1wiIDogXCJwcm9wc1wiXTtcblx0cmV0dXJuIGNvbnRleHQgJiYgY29udGV4dFtrZXldO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0Qm91bmRBcmdzKHRhZ0Vsc2UpIHsgLy8gdGFnLmJuZEFyZ3MoKVxuXHRyZXR1cm4gdGhpcy5jdnRBcmdzKHRhZ0Vsc2UsIDEpO1xufVxuXG4vLz09PT09PT09PT09PT1cbi8vIHZpZXdzLnRhZ1xuLy89PT09PT09PT09PT09XG5cbi8qIHZpZXcuZ2V0UnNjKCkgKi9cbmZ1bmN0aW9uIGdldFJlc291cmNlKHJlc291cmNlVHlwZSwgaXRlbU5hbWUpIHtcblx0dmFyIHJlcywgc3RvcmUsXG5cdFx0dmlldyA9IHRoaXM7XG5cdGlmICh0eXBlb2YgaXRlbU5hbWUgPT09IFNUUklORykge1xuXHRcdHdoaWxlICgocmVzID09PSB1bmRlZmluZWQpICYmIHZpZXcpIHtcblx0XHRcdHN0b3JlID0gdmlldy50bXBsICYmIHZpZXcudG1wbFtyZXNvdXJjZVR5cGVdO1xuXHRcdFx0cmVzID0gc3RvcmUgJiYgc3RvcmVbaXRlbU5hbWVdO1xuXHRcdFx0dmlldyA9IHZpZXcucGFyZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzIHx8ICR2aWV3c1tyZXNvdXJjZVR5cGVdW2l0ZW1OYW1lXTtcblx0fVxufVxuXG5mdW5jdGlvbiByZW5kZXJUYWcodGFnTmFtZSwgcGFyZW50VmlldywgdG1wbCwgdGFnQ3R4cywgaXNVcGRhdGUsIG9uRXJyb3IpIHtcblx0ZnVuY3Rpb24gYmluZFRvT3JCaW5kRnJvbSh0eXBlKSB7XG5cdFx0dmFyIGJpbmRBcnJheSA9IHRhZ1t0eXBlXTtcblxuXHRcdGlmIChiaW5kQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0YmluZEFycmF5ID0gJGlzQXJyYXkoYmluZEFycmF5KSA/IGJpbmRBcnJheSA6IFtiaW5kQXJyYXldO1xuXHRcdFx0bSA9IGJpbmRBcnJheS5sZW5ndGg7XG5cdFx0XHR3aGlsZSAobS0tKSB7XG5cdFx0XHRcdGtleSA9IGJpbmRBcnJheVttXTtcblx0XHRcdFx0aWYgKCFpc05hTihwYXJzZUludChrZXkpKSkge1xuXHRcdFx0XHRcdGJpbmRBcnJheVttXSA9IHBhcnNlSW50KGtleSk7IC8vIENvbnZlcnQgXCIwXCIgdG8gMCwgZXRjLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJpbmRBcnJheSB8fCBbMF07XG5cdH1cblxuXHRwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCB0b3BWaWV3O1xuXHR2YXIgdGFnLCB0YWdEZWYsIHRlbXBsYXRlLCB0YWdzLCBhdHRyLCBwYXJlbnRUYWcsIGwsIG0sIG4sIGl0ZW1SZXQsIHRhZ0N0eCwgdGFnQ3R4Q3R4LCBjdHhQcm0sIGJpbmRUbywgYmluZEZyb20sIGluaXRWYWwsXG5cdFx0Y29udGVudCwgY2FsbEluaXQsIG1hcERlZiwgdGhpc01hcCwgYXJncywgYmRBcmdzLCBwcm9wcywgdGFnRGF0YU1hcCwgY29udGVudEN0eCwga2V5LCBiaW5kRnJvbUxlbmd0aCwgYmluZFRvTGVuZ3RoLCBsaW5rZWRFbGVtZW50LCBkZWZhdWx0Q3R4LFxuXHRcdGkgPSAwLFxuXHRcdHJldCA9IFwiXCIsXG5cdFx0bGlua0N0eCA9IHBhcmVudFZpZXcuX2xjIHx8IGZhbHNlLCAvLyBGb3IgZGF0YS1saW5rPVwie215VGFnLi4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcblx0XHRjdHggPSBwYXJlbnRWaWV3LmN0eCxcblx0XHRwYXJlbnRUbXBsID0gdG1wbCB8fCBwYXJlbnRWaWV3LnRtcGwsXG5cdFx0Ly8gSWYgdGFnQ3R4cyBpcyBhbiBpbnRlZ2VyLCB0aGVuIGl0IGlzIHRoZSBrZXkgZm9yIHRoZSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIGJvdW5kVGFnIHRhZ0N0eHNcblx0XHRib3VuZFRhZyA9IHR5cGVvZiB0YWdDdHhzID09PSBcIm51bWJlclwiICYmIHBhcmVudFZpZXcudG1wbC5ibmRzW3RhZ0N0eHMtMV07XG5cblx0aWYgKHRhZ05hbWUuX2lzID09PSBcInRhZ1wiKSB7XG5cdFx0dGFnID0gdGFnTmFtZTtcblx0XHR0YWdOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4cyA9IHRhZy50YWdDdHhzO1xuXHRcdHRlbXBsYXRlID0gdGFnLnRlbXBsYXRlO1xuXHR9IGVsc2Uge1xuXHRcdHRhZ0RlZiA9IHBhcmVudFZpZXcuZ2V0UnNjKFwidGFnc1wiLCB0YWdOYW1lKSB8fCBlcnJvcihcIlVua25vd24gdGFnOiB7e1wiICsgdGFnTmFtZSArIFwifX0gXCIpO1xuXHRcdHRlbXBsYXRlID0gdGFnRGVmLnRlbXBsYXRlO1xuXHR9XG5cdGlmIChvbkVycm9yID09PSB1bmRlZmluZWQgJiYgYm91bmRUYWcgJiYgKGJvdW5kVGFnLl9sciA9ICh0YWdEZWYubGF0ZVJlbmRlciAmJiBib3VuZFRhZy5fbHIhPT0gZmFsc2UgfHwgYm91bmRUYWcuX2xyKSkpIHtcblx0XHRvbkVycm9yID0gXCJcIjsgLy8gSWYgbGF0ZVJlbmRlciwgc2V0IHRlbXBvcmFyeSBvbkVycm9yLCB0byBza2lwIGluaXRpYWwgcmVuZGVyaW5nIChhbmQgcmVuZGVyIGp1c3QgXCJcIilcblx0fVxuXHRpZiAob25FcnJvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0ICs9IG9uRXJyb3I7XG5cdFx0dGFnQ3R4cyA9IG9uRXJyb3IgPSBbe3Byb3BzOiB7fSwgYXJnczogW10sIHBhcmFtczoge3Byb3BzOnt9fX1dO1xuXHR9IGVsc2UgaWYgKGJvdW5kVGFnKSB7XG5cdFx0dGFnQ3R4cyA9IGJvdW5kVGFnKHBhcmVudFZpZXcuZGF0YSwgcGFyZW50VmlldywgJHN1Yik7XG5cdH1cblxuXHRsID0gdGFnQ3R4cy5sZW5ndGg7XG5cdGZvciAoOyBpIDwgbDsgaSsrKSB7XG5cdFx0dGFnQ3R4ID0gdGFnQ3R4c1tpXTtcblx0XHRjb250ZW50ID0gdGFnQ3R4LnRtcGw7XG5cdFx0aWYgKCFsaW5rQ3R4IHx8ICFsaW5rQ3R4LnRhZyB8fCBpICYmICFsaW5rQ3R4LnRhZy5pbmxpbmUgfHwgdGFnLl9lciB8fCBjb250ZW50ICYmICtjb250ZW50PT09Y29udGVudCkge1xuXHRcdFx0Ly8gSW5pdGlhbGl6ZSB0YWdDdHhcblx0XHRcdC8vIEZvciBibG9jayB0YWdzLCB0YWdDdHgudG1wbCBpcyBhbiBpbnRlZ2VyID4gMFxuXHRcdFx0aWYgKGNvbnRlbnQgJiYgcGFyZW50VG1wbC50bXBscykge1xuXHRcdFx0XHR0YWdDdHgudG1wbCA9IHRhZ0N0eC5jb250ZW50ID0gcGFyZW50VG1wbC50bXBsc1tjb250ZW50IC0gMV07IC8vIFNldCB0aGUgdG1wbCBwcm9wZXJ0eSB0byB0aGUgY29udGVudCBvZiB0aGUgYmxvY2sgdGFnXG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguaW5kZXggPSBpO1xuXHRcdFx0dGFnQ3R4LmN0eFBybSA9IGNvbnRleHRQYXJhbWV0ZXI7XG5cdFx0XHR0YWdDdHgucmVuZGVyID0gcmVuZGVyQ29udGVudDtcblx0XHRcdHRhZ0N0eC5jdnRBcmdzID0gY29udmVydEFyZ3M7XG5cdFx0XHR0YWdDdHguYm5kQXJncyA9IGNvbnZlcnRCb3VuZEFyZ3M7XG5cdFx0XHR0YWdDdHgudmlldyA9IHBhcmVudFZpZXc7XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KGV4dGVuZEN0eCh0YWdDdHguY3R4LCB0YWdEZWYgJiYgdGFnRGVmLmN0eCksIGN0eCk7IC8vIENsb25lIGFuZCBleHRlbmQgcGFyZW50Vmlldy5jdHhcblx0XHR9XG5cdFx0aWYgKHRtcGwgPSB0YWdDdHgucHJvcHMudG1wbCkge1xuXHRcdFx0Ly8gSWYgdGhlIHRtcGwgcHJvcGVydHkgaXMgb3ZlcnJpZGRlbiwgc2V0IHRoZSB2YWx1ZSAod2hlbiBpbml0aWFsaXppbmcsIG9yLCBpbiBjYXNlIG9mIGJpbmRpbmc6IF50bXBsPS4uLiwgd2hlbiB1cGRhdGluZylcblx0XHRcdHRhZ0N0eC50bXBsID0gcGFyZW50Vmlldy5fZ2V0VG1wbCh0bXBsKTtcblx0XHRcdHRhZ0N0eC5jb250ZW50ID0gdGFnQ3R4LmNvbnRlbnQgfHwgdGFnQ3R4LnRtcGw7XG5cdFx0fVxuXG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdC8vIFRoaXMgd2lsbCBvbmx5IGJlIGhpdCBmb3IgaW5pdGlhbCB0YWdDdHggKG5vdCBmb3Ige3tlbHNlfX0pIC0gaWYgdGhlIHRhZyBpbnN0YW5jZSBkb2VzIG5vdCBleGlzdCB5ZXRcblx0XHRcdC8vIElmIHRoZSB0YWcgaGFzIG5vdCBhbHJlYWR5IGJlZW4gaW5zdGFudGlhdGVkLCB3ZSB3aWxsIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cblx0XHRcdC8vIH50YWcgd2lsbCBhY2Nlc3MgdGhlIHRhZywgZXZlbiB3aXRoaW4gdGhlIHJlbmRlcmluZyBvZiB0aGUgdGVtcGxhdGUgY29udGVudCBvZiB0aGlzIHRhZy5cblx0XHRcdC8vIEZyb20gY2hpbGQvZGVzY2VuZGFudCB0YWdzLCBjYW4gYWNjZXNzIHVzaW5nIH50YWcucGFyZW50LCBvciB+cGFyZW50VGFncy50YWdOYW1lXG5cdFx0XHR0YWcgPSBuZXcgdGFnRGVmLl9jdHIoKTtcblx0XHRcdGNhbGxJbml0ID0gISF0YWcuaW5pdDtcblxuXHRcdFx0dGFnLnBhcmVudCA9IHBhcmVudFRhZyA9IGN0eCAmJiBjdHgudGFnO1xuXHRcdFx0dGFnLnRhZ0N0eHMgPSB0YWdDdHhzO1xuXG5cdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHR0YWcuaW5saW5lID0gZmFsc2U7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0fVxuXHRcdFx0dGFnLmxpbmtDdHggPSBsaW5rQ3R4O1xuXHRcdFx0aWYgKHRhZy5fLmJuZCA9IGJvdW5kVGFnIHx8IGxpbmtDdHguZm4pIHtcblx0XHRcdFx0Ly8gQm91bmQgaWYge157dGFnLi4ufX0gb3IgZGF0YS1saW5rPVwie3RhZy4uLn1cIlxuXHRcdFx0XHR0YWcuXy50aHMgPSB0YWdDdHgucGFyYW1zLnByb3BzW1widGhpc1wiXTsgLy8gVGFnIGhhcyBhIHRoaXM9ZXhwciBiaW5kaW5nLCB0byBnZXQgamF2YXNjcmlwdCByZWZlcmVuY2UgdG8gdGFnIGluc3RhbmNlXG5cdFx0XHRcdHRhZy5fLmx0ID0gdGFnQ3R4cy5sdDsgLy8gSWYgYSBsYXRlIHBhdGggQHNvbWUucGF0aCBoYXMgbm90IHJldHVybmVkIEBzb21lIG9iamVjdCwgbWFyayB0YWcgYXMgbGF0ZVxuXHRcdFx0XHR0YWcuXy5hcnJWd3MgPSB7fTtcblx0XHRcdH0gZWxzZSBpZiAodGFnLmRhdGFCb3VuZE9ubHkpIHtcblx0XHRcdFx0ZXJyb3IodGFnTmFtZSArIFwiIG11c3QgYmUgZGF0YS1ib3VuZDpcXG57XntcIiArIHRhZ05hbWUgKyBcIn19XCIpO1xuXHRcdFx0fVxuXHRcdFx0Ly9UT0RPIGJldHRlciBwZXJmIGZvciBjaGlsZFRhZ3MoKSAtIGtlZXAgY2hpbGQgdGFnLnRhZ3MgYXJyYXksIChhbmQgcmVtb3ZlIGNoaWxkLCB3aGVuIGRpc3Bvc2VkKVxuXHRcdFx0Ly8gdGFnLnRhZ3MgPSBbXTtcblx0XHR9IGVsc2UgaWYgKGxpbmtDdHggJiYgbGlua0N0eC5mbi5fbHIpIHtcblx0XHRcdGNhbGxJbml0ID0gISF0YWcuaW5pdDtcblx0XHR9XG5cdFx0dGFnRGF0YU1hcCA9IHRhZy5kYXRhTWFwO1xuXG5cdFx0dGFnQ3R4LnRhZyA9IHRhZztcblx0XHRpZiAodGFnRGF0YU1hcCAmJiB0YWdDdHhzKSB7XG5cdFx0XHR0YWdDdHgubWFwID0gdGFnQ3R4c1tpXS5tYXA7IC8vIENvcHkgb3ZlciB0aGUgY29tcGlsZWQgbWFwIGluc3RhbmNlIGZyb20gdGhlIHByZXZpb3VzIHRhZ0N0eHMgdG8gdGhlIHJlZnJlc2hlZCBvbmVzXG5cdFx0fVxuXHRcdGlmICghdGFnLmZsb3cpIHtcblx0XHRcdHRhZ0N0eEN0eCA9IHRhZ0N0eC5jdHggPSB0YWdDdHguY3R4IHx8IHt9O1xuXG5cdFx0XHQvLyB0YWdzIGhhc2g6IHRhZy5jdHgudGFncywgbWVyZ2VkIHdpdGggcGFyZW50Vmlldy5jdHgudGFncyxcblx0XHRcdHRhZ3MgPSB0YWcucGFyZW50cyA9IHRhZ0N0eEN0eC5wYXJlbnRUYWdzID0gY3R4ICYmIGV4dGVuZEN0eCh0YWdDdHhDdHgucGFyZW50VGFncywgY3R4LnBhcmVudFRhZ3MpIHx8IHt9O1xuXHRcdFx0aWYgKHBhcmVudFRhZykge1xuXHRcdFx0XHR0YWdzW3BhcmVudFRhZy50YWdOYW1lXSA9IHBhcmVudFRhZztcblx0XHRcdFx0Ly9UT0RPIGJldHRlciBwZXJmIGZvciBjaGlsZFRhZ3M6IHBhcmVudFRhZy50YWdzLnB1c2godGFnKTtcblx0XHRcdH1cblx0XHRcdHRhZ3NbdGFnLnRhZ05hbWVdID0gdGFnQ3R4Q3R4LnRhZyA9IHRhZztcblx0XHRcdHRhZ0N0eEN0eC50YWdDdHggPSB0YWdDdHg7XG5cdFx0fVxuXHR9XG5cdGlmICghKHRhZy5fZXIgPSBvbkVycm9yKSkge1xuXHRcdHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4c1swXSk7XG5cdFx0dGFnLnJlbmRlcmluZyA9IHtybmRyOiB0YWcucmVuZGVyaW5nfTsgLy8gUHJvdmlkZSBvYmplY3QgZm9yIHN0YXRlIGR1cmluZyByZW5kZXIgY2FsbHMgdG8gdGFnIGFuZCBlbHNlcy4gKFVzZWQgYnkge3tpZn19IGFuZCB7e2Zvcn19Li4uKVxuXHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHsgLy8gSXRlcmF0ZSB0YWdDdHggZm9yIGVhY2gge3tlbHNlfX0gYmxvY2tcblx0XHRcdHRhZ0N0eCA9IHRhZy50YWdDdHggPSB0YWdDdHhzW2ldO1xuXHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdFx0XHR0YWcuY3R4ID0gdGFnQ3R4LmN0eDtcblxuXHRcdFx0aWYgKCFpKSB7XG5cdFx0XHRcdGlmIChjYWxsSW5pdCkge1xuXHRcdFx0XHRcdHRhZy5pbml0KHRhZ0N0eCwgbGlua0N0eCwgdGFnLmN0eCk7XG5cdFx0XHRcdFx0Y2FsbEluaXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0YWdDdHguYXJncy5sZW5ndGggJiYgdGFnQ3R4LmFyZ0RlZmF1bHQgIT09IGZhbHNlICYmIHRhZy5hcmdEZWZhdWx0ICE9PSBmYWxzZSkge1xuXHRcdFx0XHRcdHRhZ0N0eC5hcmdzID0gYXJncyA9IFt0YWdDdHgudmlldy5kYXRhXTsgLy8gTWlzc2luZyBmaXJzdCBhcmcgZGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0XG5cdFx0XHRcdFx0dGFnQ3R4LnBhcmFtcy5hcmdzID0gW1wiI2RhdGFcIl07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiaW5kVG8gPSBiaW5kVG9PckJpbmRGcm9tKFwiYmluZFRvXCIpO1xuXG5cdFx0XHRcdGlmICh0YWcuYmluZFRvICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0YWcuYmluZFRvID0gYmluZFRvO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRhZy5iaW5kRnJvbSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGFnLmJpbmRGcm9tID0gYmluZFRvT3JCaW5kRnJvbShcImJpbmRGcm9tXCIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRhZy5iaW5kVG8pIHtcblx0XHRcdFx0XHR0YWcuYmluZEZyb20gPSB0YWcuYmluZFRvID0gYmluZFRvO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJpbmRGcm9tID0gdGFnLmJpbmRGcm9tIHx8IGJpbmRUbztcblxuXHRcdFx0XHRiaW5kVG9MZW5ndGggPSBiaW5kVG8ubGVuZ3RoO1xuXHRcdFx0XHRiaW5kRnJvbUxlbmd0aCA9IGJpbmRGcm9tLmxlbmd0aDtcblxuXHRcdFx0XHRpZiAodGFnLl8uYm5kICYmIChsaW5rZWRFbGVtZW50ID0gdGFnLmxpbmtlZEVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0dGFnLmxpbmtlZEVsZW1lbnQgPSBsaW5rZWRFbGVtZW50ID0gJGlzQXJyYXkobGlua2VkRWxlbWVudCkgPyBsaW5rZWRFbGVtZW50OiBbbGlua2VkRWxlbWVudF07XG5cblx0XHRcdFx0XHRpZiAoYmluZFRvTGVuZ3RoICE9PSBsaW5rZWRFbGVtZW50Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZXJyb3IoXCJsaW5rZWRFbGVtZW50IG5vdCBzYW1lIGxlbmd0aCBhcyBiaW5kVG9cIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChsaW5rZWRFbGVtZW50ID0gdGFnLmxpbmtlZEN0eFBhcmFtKSB7XG5cdFx0XHRcdFx0dGFnLmxpbmtlZEN0eFBhcmFtID0gbGlua2VkRWxlbWVudCA9ICRpc0FycmF5KGxpbmtlZEVsZW1lbnQpID8gbGlua2VkRWxlbWVudDogW2xpbmtlZEVsZW1lbnRdO1xuXG5cdFx0XHRcdFx0aWYgKGJpbmRGcm9tTGVuZ3RoICE9PSBsaW5rZWRFbGVtZW50Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZXJyb3IoXCJsaW5rZWRDdHhQYXJhbSBub3Qgc2FtZSBsZW5ndGggYXMgYmluZEZyb20vYmluZFRvXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChiaW5kRnJvbSkge1xuXHRcdFx0XHRcdHRhZy5fLmZyb21JbmRleCA9IHt9OyAvLyBIYXNoIG9mIGJpbmRGcm9tIGluZGV4IHdoaWNoIGhhcyBzYW1lIHBhdGggdmFsdWUgYXMgYmluZFRvIGluZGV4LiBmcm9tSW5kZXggPSB0YWcuXy5mcm9tSW5kZXhbdG9JbmRleF1cblx0XHRcdFx0XHR0YWcuXy50b0luZGV4ID0ge307IC8vIEhhc2ggb2YgYmluZEZyb20gaW5kZXggd2hpY2ggaGFzIHNhbWUgcGF0aCB2YWx1ZSBhcyBiaW5kVG8gaW5kZXguIGZyb21JbmRleCA9IHRhZy5fLmZyb21JbmRleFt0b0luZGV4XVxuXHRcdFx0XHRcdG4gPSBiaW5kRnJvbUxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAobi0tKSB7XG5cdFx0XHRcdFx0XHRrZXkgPSBiaW5kRnJvbVtuXTtcblx0XHRcdFx0XHRcdG0gPSBiaW5kVG9MZW5ndGg7XG5cdFx0XHRcdFx0XHR3aGlsZSAobS0tKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChrZXkgPT09IGJpbmRUb1ttXSkge1xuXHRcdFx0XHRcdFx0XHRcdHRhZy5fLmZyb21JbmRleFttXSA9IG47XG5cdFx0XHRcdFx0XHRcdFx0dGFnLl8udG9JbmRleFtuXSA9IG07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHRcdC8vIFNldCBhdHRyIG9uIGxpbmtDdHggdG8gZW5zdXJlIG91dHB1dHRpbmcgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IGF0dHJpYnV0ZS5cblx0XHRcdFx0XHQvLyBTZXR0aW5nIGVpdGhlciBsaW5rQ3R4LmF0dHIgb3IgdGhpcy5hdHRyIGluIHRoZSBpbml0KCkgYWxsb3dzIHBlci1pbnN0YW5jZSBjaG9pY2Ugb2YgdGFyZ2V0IGF0dHJpYi5cblx0XHRcdFx0XHRsaW5rQ3R4LmF0dHIgPSB0YWcuYXR0ciA9IGxpbmtDdHguYXR0ciB8fCB0YWcuYXR0ciB8fCBsaW5rQ3R4Ll9kZkF0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF0dHIgPSB0YWcuYXR0cjtcblx0XHRcdFx0dGFnLl8ubm9Wd3MgPSBhdHRyICYmIGF0dHIgIT09IEhUTUw7XG5cdFx0XHR9XG5cdFx0XHRhcmdzID0gdGFnLmN2dEFyZ3MoaSk7XG5cdFx0XHRpZiAodGFnLmxpbmtlZEN0eFBhcmFtKSB7XG5cdFx0XHRcdGJkQXJncyA9IHRhZy5jdnRBcmdzKGksIDEpO1xuXHRcdFx0XHRtID0gYmluZEZyb21MZW5ndGg7XG5cdFx0XHRcdGRlZmF1bHRDdHggPSB0YWcuY29uc3RydWN0b3IucHJvdG90eXBlLmN0eDtcblx0XHRcdFx0d2hpbGUgKG0tLSkge1xuXHRcdFx0XHRcdGlmIChjdHhQcm0gPSB0YWcubGlua2VkQ3R4UGFyYW1bbV0pIHtcblx0XHRcdFx0XHRcdGtleSA9IGJpbmRGcm9tW21dO1xuXHRcdFx0XHRcdFx0aW5pdFZhbCA9IGJkQXJnc1ttXTtcblx0XHRcdFx0XHRcdC8vIENyZWF0ZSB0YWcgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHRcdHRhZ0N0eC5jdHhbY3R4UHJtXSA9ICRzdWIuX2NwKFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0Q3R4ICYmIGluaXRWYWwgPT09IHVuZGVmaW5lZCA/IGRlZmF1bHRDdHhbY3R4UHJtXTogaW5pdFZhbCxcblx0XHRcdFx0XHRcdFx0aW5pdFZhbCAhPT0gdW5kZWZpbmVkICYmIGFyZ09yUHJvcCh0YWdDdHgucGFyYW1zLCBrZXkpLFxuXHRcdFx0XHRcdFx0XHR0YWdDdHgudmlldyxcblx0XHRcdFx0XHRcdFx0dGFnLl8uYm5kICYmIHt0YWc6IHRhZywgY3Z0OiB0YWcuY29udmVydCwgaW5kOiBtLCB0YWdFbHNlOiBpfVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICgobWFwRGVmID0gcHJvcHMuZGF0YU1hcCB8fCB0YWdEYXRhTWFwKSAmJiAoYXJncy5sZW5ndGggfHwgcHJvcHMuZGF0YU1hcCkpIHtcblx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXA7XG5cdFx0XHRcdGlmICghdGhpc01hcCB8fCB0aGlzTWFwLnNyYyAhPT0gYXJnc1swXSB8fCBpc1VwZGF0ZSkge1xuXHRcdFx0XHRcdGlmICh0aGlzTWFwICYmIHRoaXNNYXAuc3JjKSB7XG5cdFx0XHRcdFx0XHR0aGlzTWFwLnVubWFwKCk7IC8vIG9ubHkgY2FsbGVkIGlmIG9ic2VydmFibGUgbWFwIC0gbm90IHdoZW4gb25seSB1c2VkIGluIEpzUmVuZGVyLCBlLmcuIGJ5IHt7cHJvcHN9fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtYXBEZWYubWFwKGFyZ3NbMF0sIHRhZ0N0eCwgdGhpc01hcCwgIXRhZy5fLmJuZCk7XG5cdFx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXA7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJncyA9IFt0aGlzTWFwLnRndF07XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW1SZXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGFnLnJlbmRlcikge1xuXHRcdFx0XHRpdGVtUmV0ID0gdGFnLnJlbmRlci5hcHBseSh0YWcsIGFyZ3MpO1xuXHRcdFx0XHRpZiAocGFyZW50Vmlldy5saW5rZWQgJiYgaXRlbVJldCAmJiAhcldyYXBwZWRJblZpZXdNYXJrZXIudGVzdChpdGVtUmV0KSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gYSB0YWcgcmVuZGVycyBjb250ZW50IGZyb20gdGhlIHJlbmRlciBtZXRob2QsIHdpdGggZGF0YSBsaW5raW5nIHRoZW4gd2UgbmVlZCB0byB3cmFwIHdpdGggdmlldyBtYXJrZXJzLCBpZiBhYnNlbnQsXG5cdFx0XHRcdFx0Ly8gdG8gcHJvdmlkZSBhIGNvbnRlbnRWaWV3IGZvciB0aGUgdGFnLCB3aGljaCB3aWxsIGNvcnJlY3RseSBkaXNwb3NlIGJpbmRpbmdzIGlmIGRlbGV0ZWQuIFRoZSAndG1wbCcgZm9yIHRoaXMgdmlldyB3aWxsXG5cdFx0XHRcdFx0Ly8gYmUgYSBkdW1iZWQtZG93biB0ZW1wbGF0ZSB3aGljaCB3aWxsIGFsd2F5cyByZXR1cm4gdGhlIGl0ZW1SZXQgc3RyaW5nIChubyBtYXR0ZXIgd2hhdCB0aGUgZGF0YSBpcykuIFRoZSBpdGVtUmV0IHN0cmluZ1xuXHRcdFx0XHRcdC8vIGlzIG5vdCBjb21waWxlZCBhcyB0ZW1wbGF0ZSBtYXJrdXAsIHNvIGNhbiBpbmNsdWRlIFwie3tcIiBvciBcIn19XCIgd2l0aG91dCB0cmlnZ2VyaW5nIHN5bnRheCBlcnJvcnNcblx0XHRcdFx0XHR0bXBsID0geyAvLyAnRHVtYmVkLWRvd24nIHRlbXBsYXRlIHdoaWNoIGFsd2F5cyByZW5kZXJzICdzdGF0aWMnIGl0ZW1SZXQgc3RyaW5nXG5cdFx0XHRcdFx0XHRsaW5rczogW11cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRtcGwucmVuZGVyID0gdG1wbC5mbiA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW1SZXQ7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRpdGVtUmV0ID0gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIHBhcmVudFZpZXcuZGF0YSwgdW5kZWZpbmVkLCB0cnVlLCBwYXJlbnRWaWV3LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGFnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFhcmdzLmxlbmd0aCkge1xuXHRcdFx0XHRhcmdzID0gW3BhcmVudFZpZXddOyAvLyBubyBhcmd1bWVudHMgLSAoZS5nLiB7e2Vsc2V9fSkgZ2V0IGRhdGEgY29udGV4dCBmcm9tIHZpZXcuXG5cdFx0XHR9XG5cdFx0XHRpZiAoaXRlbVJldCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnRlbnRDdHggPSBhcmdzWzBdOyAvLyBEZWZhdWx0IGRhdGEgY29udGV4dCBmb3Igd3JhcHBlZCBibG9jayBjb250ZW50IGlzIHRoZSBmaXJzdCBhcmd1bWVudFxuXHRcdFx0XHRpZiAodGFnLmNvbnRlbnRDdHgpIHsgLy8gU2V0IHRhZy5jb250ZW50Q3R4IHRvIHRydWUsIHRvIGluaGVyaXQgcGFyZW50IGNvbnRleHQsIG9yIHRvIGEgZnVuY3Rpb24gdG8gcHJvdmlkZSBhbHRlcm5hdGUgY29udGV4dC5cblx0XHRcdFx0XHRjb250ZW50Q3R4ID0gdGFnLmNvbnRlbnRDdHggPT09IHRydWUgPyBwYXJlbnRWaWV3IDogdGFnLmNvbnRlbnRDdHgoY29udGVudEN0eCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aXRlbVJldCA9IHRhZ0N0eC5yZW5kZXIoY29udGVudEN0eCwgdHJ1ZSkgfHwgKGlzVXBkYXRlID8gdW5kZWZpbmVkIDogXCJcIik7XG5cdFx0XHR9XG5cdFx0XHRyZXQgPSByZXRcblx0XHRcdFx0PyByZXQgKyAoaXRlbVJldCB8fCBcIlwiKVxuXHRcdFx0XHQ6IGl0ZW1SZXQgIT09IHVuZGVmaW5lZFxuXHRcdFx0XHRcdD8gXCJcIiArIGl0ZW1SZXRcblx0XHRcdFx0XHQ6IHVuZGVmaW5lZDsgLy8gSWYgbm8gcmV0dXJuIHZhbHVlIGZyb20gcmVuZGVyLCBhbmQgbm8gdGVtcGxhdGUvY29udGVudCB0YWdDdHgucmVuZGVyKC4uLiksIHJldHVybiB1bmRlZmluZWRcblx0XHR9XG5cdFx0dGFnLnJlbmRlcmluZyA9IHRhZy5yZW5kZXJpbmcucm5kcjsgLy8gUmVtb3ZlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IChpZiB0aGlzIGlzIG91dGVybW9zdCByZW5kZXIgY2FsbC4gKEluIGNhc2Ugb2YgbmVzdGVkIGNhbGxzKVxuXHR9XG5cdHRhZy50YWdDdHggPSB0YWdDdHhzWzBdO1xuXHR0YWcuY3R4ID0gdGFnLnRhZ0N0eC5jdHg7XG5cblx0aWYgKHRhZy5fLm5vVndzICYmIHRhZy5pbmxpbmUpIHtcblx0XHQvLyBpbmxpbmUgdGFnIHdpdGggYXR0ciBzZXQgdG8gXCJ0ZXh0XCIgd2lsbCBpbnNlcnQgSFRNTC1lbmNvZGVkIGNvbnRlbnQgLSBhcyBpZiBpdCB3YXMgZWxlbWVudC1iYXNlZCBpbm5lclRleHRcblx0XHRyZXQgPSBhdHRyID09PSBcInRleHRcIlxuXHRcdFx0PyAkY29udmVydGVycy5odG1sKHJldClcblx0XHRcdDogXCJcIjtcblx0fVxuXHRyZXR1cm4gYm91bmRUYWcgJiYgcGFyZW50Vmlldy5fLm9uUmVuZGVyXG5cdFx0Ly8gQ2FsbCBvblJlbmRlciAodXNlZCBieSBKc1ZpZXdzIGlmIHByZXNlbnQsIHRvIGFkZCBiaW5kaW5nIGFubm90YXRpb25zIGFyb3VuZCByZW5kZXJlZCBjb250ZW50KVxuXHRcdD8gcGFyZW50Vmlldy5fLm9uUmVuZGVyKHJldCwgcGFyZW50VmlldywgdGFnKVxuXHRcdDogcmV0O1xufVxuXG4vLz09PT09PT09PT09PT09PT09XG4vLyBWaWV3IGNvbnN0cnVjdG9yXG4vLz09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIFZpZXcoY29udGV4dCwgdHlwZSwgcGFyZW50VmlldywgZGF0YSwgdGVtcGxhdGUsIGtleSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKSB7XG5cdC8vIENvbnN0cnVjdG9yIGZvciB2aWV3IG9iamVjdCBpbiB2aWV3IGhpZXJhcmNoeS4gKEF1Z21lbnRlZCBieSBKc1ZpZXdzIGlmIEpzVmlld3MgaXMgbG9hZGVkKVxuXHR2YXIgdmlld3MsIHBhcmVudFZpZXdfLCB0YWcsIHNlbGZfLFxuXHRcdHNlbGYgPSB0aGlzLFxuXHRcdGlzQXJyYXkgPSB0eXBlID09PSBcImFycmF5XCI7XG5cdFx0Ly8gSWYgdGhlIGRhdGEgaXMgYW4gYXJyYXksIHRoaXMgaXMgYW4gJ2FycmF5IHZpZXcnIHdpdGggYSB2aWV3cyBhcnJheSBmb3IgZWFjaCBjaGlsZCAnaXRlbSB2aWV3J1xuXHRcdC8vIElmIHRoZSBkYXRhIGlzIG5vdCBhbiBhcnJheSwgdGhpcyBpcyBhbiAnaXRlbSB2aWV3JyB3aXRoIGEgdmlld3MgJ2hhc2gnIG9iamVjdCBmb3IgYW55IGNoaWxkIG5lc3RlZCB2aWV3c1xuXG5cdHNlbGYuY29udGVudCA9IGNvbnRlbnRUbXBsO1xuXHRzZWxmLnZpZXdzID0gaXNBcnJheSA/IFtdIDoge307XG5cdHNlbGYuZGF0YSA9IGRhdGE7XG5cdHNlbGYudG1wbCA9IHRlbXBsYXRlO1xuXHRzZWxmXyA9IHNlbGYuXyA9IHtcblx0XHRrZXk6IDAsXG5cdFx0Ly8gLl8udXNlS2V5IGlzIG5vbiB6ZXJvIGlmIGlzIG5vdCBhbiAnYXJyYXkgdmlldycgKG93bmluZyBhIGRhdGEgYXJyYXkpLiBVc2UgdGhpcyBhcyBuZXh0IGtleSBmb3IgYWRkaW5nIHRvIGNoaWxkIHZpZXdzIGhhc2hcblx0XHR1c2VLZXk6IGlzQXJyYXkgPyAwIDogMSxcblx0XHRpZDogXCJcIiArIHZpZXdJZCsrLFxuXHRcdG9uUmVuZGVyOiBvblJlbmRlcixcblx0XHRibmRzOiB7fVxuXHR9O1xuXHRzZWxmLmxpbmtlZCA9ICEhb25SZW5kZXI7XG5cdHNlbGYudHlwZSA9IHR5cGUgfHwgXCJ0b3BcIjtcblx0aWYgKHR5cGUpIHtcblx0XHRzZWxmLmNhY2hlID0ge19jdDogJHN1YlNldHRpbmdzLl9jY2hDdH07IC8vIFVzZWQgZm9yIGNhY2hpbmcgcmVzdWx0cyBvZiBjb21wdXRlZCBwcm9wZXJ0aWVzIGFuZCBoZWxwZXJzICh2aWV3LmdldENhY2hlKVxuXHR9XG5cblx0aWYgKCFwYXJlbnRWaWV3IHx8IHBhcmVudFZpZXcudHlwZSA9PT0gXCJ0b3BcIikge1xuXHRcdChzZWxmLmN0eCA9IGNvbnRleHQgfHwge30pLnJvb3QgPSBzZWxmLmRhdGE7XG5cdH1cblxuXHRpZiAoc2VsZi5wYXJlbnQgPSBwYXJlbnRWaWV3KSB7XG5cdFx0c2VsZi5yb290ID0gcGFyZW50Vmlldy5yb290IHx8IHNlbGY7IC8vIHZpZXcgd2hvc2UgcGFyZW50IGlzIHRvcCB2aWV3XG5cdFx0dmlld3MgPSBwYXJlbnRWaWV3LnZpZXdzO1xuXHRcdHBhcmVudFZpZXdfID0gcGFyZW50Vmlldy5fO1xuXHRcdHNlbGYuaXNUb3AgPSBwYXJlbnRWaWV3Xy5zY3A7IC8vIElzIHRvcCBjb250ZW50IHZpZXcgb2YgYSBsaW5rKFwiI2NvbnRhaW5lclwiLCAuLi4pIGNhbGxcblx0XHRzZWxmLnNjb3BlID0gKCFjb250ZXh0LnRhZyB8fCBjb250ZXh0LnRhZyA9PT0gcGFyZW50Vmlldy5jdHgudGFnKSAmJiAhc2VsZi5pc1RvcCAmJiBwYXJlbnRWaWV3LnNjb3BlIHx8IHNlbGY7XG5cdFx0Ly8gU2NvcGUgZm9yIGNvbnRleHRQYXJhbXMgLSBjbG9zZXN0IG5vbiBmbG93IHRhZyBhbmNlc3RvciBvciByb290IHZpZXdcblx0XHRpZiAocGFyZW50Vmlld18udXNlS2V5KSB7XG5cdFx0XHQvLyBQYXJlbnQgaXMgbm90IGFuICdhcnJheSB2aWV3Jy4gQWRkIHRoaXMgdmlldyB0byBpdHMgdmlld3Mgb2JqZWN0XG5cdFx0XHQvLyBzZWxmLl9rZXkgPSBpcyB0aGUga2V5IGluIHRoZSBwYXJlbnQgdmlldyBoYXNoXG5cdFx0XHR2aWV3c1tzZWxmXy5rZXkgPSBcIl9cIiArIHBhcmVudFZpZXdfLnVzZUtleSsrXSA9IHNlbGY7XG5cdFx0XHRzZWxmLmluZGV4ID0gaW5kZXhTdHI7XG5cdFx0XHRzZWxmLmdldEluZGV4ID0gZ2V0TmVzdGVkSW5kZXg7XG5cdFx0fSBlbHNlIGlmICh2aWV3cy5sZW5ndGggPT09IChzZWxmXy5rZXkgPSBzZWxmLmluZGV4ID0ga2V5KSkgeyAvLyBQYXJlbnQgaXMgYW4gJ2FycmF5IHZpZXcnLiBBZGQgdGhpcyB2aWV3IHRvIGl0cyB2aWV3cyBhcnJheVxuXHRcdFx0dmlld3MucHVzaChzZWxmKTsgLy8gQWRkaW5nIHRvIGVuZCBvZiB2aWV3cyBhcnJheS4gKFVzaW5nIHB1c2ggd2hlbiBwb3NzaWJsZSAtIGJldHRlciBwZXJmIHRoYW4gc3BsaWNlKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR2aWV3cy5zcGxpY2Uoa2V5LCAwLCBzZWxmKTsgLy8gSW5zZXJ0aW5nIGluIHZpZXdzIGFycmF5XG5cdFx0fVxuXHRcdC8vIElmIG5vIGNvbnRleHQgd2FzIHBhc3NlZCBpbiwgdXNlIHBhcmVudCBjb250ZXh0XG5cdFx0Ly8gSWYgY29udGV4dCB3YXMgcGFzc2VkIGluLCBpdCBzaG91bGQgaGF2ZSBiZWVuIG1lcmdlZCBhbHJlYWR5IHdpdGggcGFyZW50IGNvbnRleHRcblx0XHRzZWxmLmN0eCA9IGNvbnRleHQgfHwgcGFyZW50Vmlldy5jdHg7XG5cdH0gZWxzZSBpZiAodHlwZSkge1xuXHRcdHNlbGYucm9vdCA9IHNlbGY7IC8vIHZpZXcgd2hvc2UgcGFyZW50IGlzIHRvcCB2aWV3XG5cdH1cbn1cblxuVmlldy5wcm90b3R5cGUgPSB7XG5cdGdldDogZ2V0Vmlldyxcblx0Z2V0SW5kZXg6IGdldEluZGV4LFxuXHRjdHhQcm06IGNvbnRleHRQYXJhbWV0ZXIsXG5cdGdldFJzYzogZ2V0UmVzb3VyY2UsXG5cdF9nZXRUbXBsOiBnZXRUZW1wbGF0ZSxcblx0X2dldE9iOiBnZXRQYXRoT2JqZWN0LFxuXHRnZXRDYWNoZTogZnVuY3Rpb24oa2V5KSB7IC8vIEdldCBjYWNoZWQgdmFsdWUgb2YgY29tcHV0ZWQgdmFsdWVcblx0XHRpZiAoJHN1YlNldHRpbmdzLl9jY2hDdCA+IHRoaXMuY2FjaGUuX2N0KSB7XG5cdFx0XHR0aGlzLmNhY2hlID0ge19jdDogJHN1YlNldHRpbmdzLl9jY2hDdH07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmNhY2hlW2tleV0gIT09IHVuZGVmaW5lZCA/IHRoaXMuY2FjaGVba2V5XSA6ICh0aGlzLmNhY2hlW2tleV0gPSBjcEZuU3RvcmVba2V5XSh0aGlzLmRhdGEsIHRoaXMsICRzdWIpKTtcblx0fSxcblx0X2lzOiBcInZpZXdcIlxufTtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBSZWdpc3RyYXRpb25cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb21waWxlQ2hpbGRSZXNvdXJjZXMocGFyZW50VG1wbCkge1xuXHR2YXIgc3RvcmVOYW1lLCBzdG9yZU5hbWVzLCByZXNvdXJjZXM7XG5cdGZvciAoc3RvcmVOYW1lIGluIGpzdlN0b3Jlcykge1xuXHRcdHN0b3JlTmFtZXMgPSBzdG9yZU5hbWUgKyBcInNcIjtcblx0XHRpZiAocGFyZW50VG1wbFtzdG9yZU5hbWVzXSkge1xuXHRcdFx0cmVzb3VyY2VzID0gcGFyZW50VG1wbFtzdG9yZU5hbWVzXTsgICAgICAgIC8vIFJlc291cmNlcyBub3QgeWV0IGNvbXBpbGVkXG5cdFx0XHRwYXJlbnRUbXBsW3N0b3JlTmFtZXNdID0ge307ICAgICAgICAgICAgICAgLy8gUmVtb3ZlIHVuY29tcGlsZWQgcmVzb3VyY2VzXG5cdFx0XHQkdmlld3Nbc3RvcmVOYW1lc10ocmVzb3VyY2VzLCBwYXJlbnRUbXBsKTsgLy8gQWRkIGJhY2sgaW4gdGhlIGNvbXBpbGVkIHJlc291cmNlc1xuXHRcdH1cblx0fVxufVxuXG4vLz09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVRhZ1xuLy89PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZVRhZyhuYW1lLCB0YWdEZWYsIHBhcmVudFRtcGwpIHtcblx0dmFyIHRtcGwsIGJhc2VUYWcsIHByb3AsXG5cdFx0Y29tcGlsZWREZWYgPSBuZXcgJHN1Yi5fdGcoKTtcblxuXHRmdW5jdGlvbiBUYWcoKSB7XG5cdFx0dmFyIHRhZyA9IHRoaXM7XG5cdFx0dGFnLl8gPSB7XG5cdFx0XHR1bmxpbmtlZDogdHJ1ZVxuXHRcdH07XG5cdFx0dGFnLmlubGluZSA9IHRydWU7XG5cdFx0dGFnLnRhZ05hbWUgPSBuYW1lO1xuXHR9XG5cblx0aWYgKCRpc0Z1bmN0aW9uKHRhZ0RlZikpIHtcblx0XHQvLyBTaW1wbGUgdGFnIGRlY2xhcmVkIGFzIGZ1bmN0aW9uLiBObyBwcmVzZW50ZXIgaW5zdGFudGF0aW9uLlxuXHRcdHRhZ0RlZiA9IHtcblx0XHRcdGRlcGVuZHM6IHRhZ0RlZi5kZXBlbmRzLFxuXHRcdFx0cmVuZGVyOiB0YWdEZWZcblx0XHR9O1xuXHR9IGVsc2UgaWYgKHR5cGVvZiB0YWdEZWYgPT09IFNUUklORykge1xuXHRcdHRhZ0RlZiA9IHt0ZW1wbGF0ZTogdGFnRGVmfTtcblx0fVxuXG5cdGlmIChiYXNlVGFnID0gdGFnRGVmLmJhc2VUYWcpIHtcblx0XHR0YWdEZWYuZmxvdyA9ICEhdGFnRGVmLmZsb3c7IC8vIFNldCBmbG93IHByb3BlcnR5LCBzbyBkZWZhdWx0cyB0byBmYWxzZSBldmVuIGlmIGJhc2VUYWcgaGFzIGZsb3c9dHJ1ZVxuXHRcdGJhc2VUYWcgPSB0eXBlb2YgYmFzZVRhZyA9PT0gU1RSSU5HXG5cdFx0XHQ/IChwYXJlbnRUbXBsICYmIHBhcmVudFRtcGwudGFnc1tiYXNlVGFnXSB8fCAkdGFnc1tiYXNlVGFnXSlcblx0XHRcdDogYmFzZVRhZztcblx0XHRpZiAoIWJhc2VUYWcpIHtcblx0XHRcdGVycm9yKCdiYXNlVGFnOiBcIicgKyB0YWdEZWYuYmFzZVRhZyArICdcIiBub3QgZm91bmQnKTtcblx0XHR9XG5cdFx0Y29tcGlsZWREZWYgPSAkZXh0ZW5kKGNvbXBpbGVkRGVmLCBiYXNlVGFnKTtcblxuXHRcdGZvciAocHJvcCBpbiB0YWdEZWYpIHtcblx0XHRcdGNvbXBpbGVkRGVmW3Byb3BdID0gZ2V0TWV0aG9kKGJhc2VUYWdbcHJvcF0sIHRhZ0RlZltwcm9wXSk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGNvbXBpbGVkRGVmID0gJGV4dGVuZChjb21waWxlZERlZiwgdGFnRGVmKTtcblx0fVxuXG5cdC8vIFRhZyBkZWNsYXJlZCBhcyBvYmplY3QsIHVzZWQgYXMgdGhlIHByb3RvdHlwZSBmb3IgdGFnIGluc3RhbnRpYXRpb24gKGNvbnRyb2wvcHJlc2VudGVyKVxuXHRpZiAoKHRtcGwgPSBjb21waWxlZERlZi50ZW1wbGF0ZSkgIT09IHVuZGVmaW5lZCkge1xuXHRcdGNvbXBpbGVkRGVmLnRlbXBsYXRlID0gdHlwZW9mIHRtcGwgPT09IFNUUklORyA/ICgkdGVtcGxhdGVzW3RtcGxdIHx8ICR0ZW1wbGF0ZXModG1wbCkpIDogdG1wbDtcblx0fVxuXHQoVGFnLnByb3RvdHlwZSA9IGNvbXBpbGVkRGVmKS5jb25zdHJ1Y3RvciA9IGNvbXBpbGVkRGVmLl9jdHIgPSBUYWc7XG5cblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRjb21waWxlZERlZi5fcGFyZW50VG1wbCA9IHBhcmVudFRtcGw7XG5cdH1cblx0cmV0dXJuIGNvbXBpbGVkRGVmO1xufVxuXG5mdW5jdGlvbiBiYXNlQXBwbHkoYXJncykge1xuXHQvLyBJbiBkZXJpdmVkIG1ldGhvZCAob3IgaGFuZGxlciBkZWNsYXJlZCBkZWNsYXJhdGl2ZWx5IGFzIGluIHt7OmZvbyBvbkNoYW5nZT1+Zm9vQ2hhbmdlZH19IGNhbiBjYWxsIGJhc2UgbWV0aG9kLFxuXHQvLyB1c2luZyB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdHJldHVybiB0aGlzLmJhc2UuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8vPT09PT09PT09PT09PT09XG4vLyBjb21waWxlVG1wbFxuLy89PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZVRtcGwobmFtZSwgdG1wbCwgcGFyZW50VG1wbCwgb3B0aW9ucykge1xuXHQvLyB0bXBsIGlzIGVpdGhlciBhIHRlbXBsYXRlIG9iamVjdCwgYSBzZWxlY3RvciBmb3IgYSB0ZW1wbGF0ZSBzY3JpcHQgYmxvY2ssIG9yIHRoZSBuYW1lIG9mIGEgY29tcGlsZWQgdGVtcGxhdGVcblxuXHQvLz09PT0gbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cdGZ1bmN0aW9uIGxvb2t1cFRlbXBsYXRlKHZhbHVlKSB7XG5cdFx0Ly8gSWYgdmFsdWUgaXMgb2YgdHlwZSBzdHJpbmcgLSB0cmVhdCBhcyBzZWxlY3Rvciwgb3IgbmFtZSBvZiBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdC8vIFJldHVybiB0aGUgdGVtcGxhdGUgb2JqZWN0LCBpZiBhbHJlYWR5IGNvbXBpbGVkLCBvciB0aGUgbWFya3VwIHN0cmluZ1xuXHRcdHZhciBjdXJyZW50TmFtZSwgdG1wbDtcblx0XHRpZiAoKHR5cGVvZiB2YWx1ZSA9PT0gU1RSSU5HKSB8fCB2YWx1ZS5ub2RlVHlwZSA+IDAgJiYgKGVsZW0gPSB2YWx1ZSkpIHtcblx0XHRcdGlmICghZWxlbSkge1xuXHRcdFx0XHRpZiAoL15cXC4/XFwvW15cXFxcOio/XCI8Pl0qJC8udGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyB2YWx1ZT1cIi4vc29tZS9maWxlLmh0bWxcIiAob3IgXCIvc29tZS9maWxlLmh0bWxcIilcblx0XHRcdFx0XHQvLyBJZiB0aGUgdGVtcGxhdGUgaXMgbm90IG5hbWVkLCB1c2UgXCIuL3NvbWUvZmlsZS5odG1sXCIgYXMgbmFtZS5cblx0XHRcdFx0XHRpZiAodG1wbCA9ICR0ZW1wbGF0ZXNbbmFtZSA9IG5hbWUgfHwgdmFsdWVdKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRtcGw7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIEJST1dTRVItU1BFQ0lGSUMgQ09ERSAobm90IG9uIE5vZGUuanMpOlxuXHRcdFx0XHRcdFx0Ly8gTG9vayBmb3Igc2VydmVyLWdlbmVyYXRlZCBzY3JpcHQgYmxvY2sgd2l0aCBpZCBcIi4vc29tZS9maWxlLmh0bWxcIlxuXHRcdFx0XHRcdFx0ZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAodmFsdWUuY2hhckF0KDApID09PSBcIiNcIikge1xuXHRcdFx0XHRcdGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2YWx1ZS5zbGljZSgxKSk7XG5cdFx0XHRcdH0gaWYgKCFlbGVtICYmICQuZm4gJiYgISRzdWIuclRtcGwudGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZWxlbSA9ICQodmFsdWUsIGRvY3VtZW50KVswXTsgLy8gaWYgalF1ZXJ5IGlzIGxvYWRlZCwgdGVzdCBmb3Igc2VsZWN0b3IgcmV0dXJuaW5nIGVsZW1lbnRzLCBhbmQgZ2V0IGZpcnN0IGVsZW1lbnRcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0XHR9Ly8gRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0fSAvL0JST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0aWYgKGVsZW0pIHtcblx0XHRcdFx0aWYgKGVsZW0udGFnTmFtZSAhPT0gXCJTQ1JJUFRcIikge1xuXHRcdFx0XHRcdGVycm9yKHZhbHVlICsgXCI6IFVzZSBzY3JpcHQgYmxvY2ssIG5vdCBcIiArIGVsZW0udGFnTmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9wdGlvbnMpIHtcblx0XHRcdFx0XHQvLyBXZSB3aWxsIGNvbXBpbGUgYSBuZXcgdGVtcGxhdGUgdXNpbmcgdGhlIG1hcmt1cCBpbiB0aGUgc2NyaXB0IGVsZW1lbnRcblx0XHRcdFx0XHR2YWx1ZSA9IGVsZW0uaW5uZXJIVE1MO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFdlIHdpbGwgY2FjaGUgYSBzaW5nbGUgY29weSBvZiB0aGUgY29tcGlsZWQgdGVtcGxhdGUsIGFuZCBhc3NvY2lhdGUgaXQgd2l0aCB0aGUgbmFtZVxuXHRcdFx0XHRcdC8vIChyZW5hbWluZyBmcm9tIGEgcHJldmlvdXMgbmFtZSBpZiB0aGVyZSB3YXMgb25lKS5cblx0XHRcdFx0XHRjdXJyZW50TmFtZSA9IGVsZW0uZ2V0QXR0cmlidXRlKHRtcGxBdHRyKTtcblx0XHRcdFx0XHRpZiAoY3VycmVudE5hbWUpIHtcblx0XHRcdFx0XHRcdGlmIChjdXJyZW50TmFtZSAhPT0ganN2VG1wbCkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9ICR0ZW1wbGF0ZXNbY3VycmVudE5hbWVdO1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgJHRlbXBsYXRlc1tjdXJyZW50TmFtZV07XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCQuZm4pIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkLmRhdGEoZWxlbSlbanN2VG1wbF07IC8vIEdldCBjYWNoZWQgY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFjdXJyZW50TmFtZSB8fCAhdmFsdWUpIHsgLy8gTm90IHlldCBjb21waWxlZCwgb3IgY2FjaGVkIHZlcnNpb24gbG9zdFxuXHRcdFx0XHRcdFx0bmFtZSA9IG5hbWUgfHwgKCQuZm4gPyBqc3ZUbXBsIDogdmFsdWUpO1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBjb21waWxlVG1wbChuYW1lLCBlbGVtLmlubmVySFRNTCwgcGFyZW50VG1wbCwgb3B0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlLnRtcGxOYW1lID0gbmFtZSA9IG5hbWUgfHwgY3VycmVudE5hbWU7XG5cdFx0XHRcdFx0aWYgKG5hbWUgIT09IGpzdlRtcGwpIHtcblx0XHRcdFx0XHRcdCR0ZW1wbGF0ZXNbbmFtZV0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxlbS5zZXRBdHRyaWJ1dGUodG1wbEF0dHIsIG5hbWUpO1xuXHRcdFx0XHRcdGlmICgkLmZuKSB7XG5cdFx0XHRcdFx0XHQkLmRhdGEoZWxlbSwganN2VG1wbCwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSAvLyBFTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHRlbGVtID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAoIXZhbHVlLmZuKSB7XG5cdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdC8vIElmIHZhbHVlIGlzIG5vdCBhIHN0cmluZy4gSFRNTCBlbGVtZW50LCBvciBjb21waWxlZCB0ZW1wbGF0ZSwgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblxuXHR2YXIgZWxlbSwgY29tcGlsZWRUbXBsLFxuXHRcdHRtcGxPck1hcmt1cCA9IHRtcGwgPSB0bXBsIHx8IFwiXCI7XG5cdCRzdWIuX2h0bWwgPSAkY29udmVydGVycy5odG1sO1xuXG5cdC8vPT09PSBDb21waWxlIHRoZSB0ZW1wbGF0ZSA9PT09XG5cdGlmIChvcHRpb25zID09PSAwKSB7XG5cdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHR0bXBsT3JNYXJrdXAgPSBsb29rdXBUZW1wbGF0ZSh0bXBsT3JNYXJrdXApOyAvLyBUb3AtbGV2ZWwgY29tcGlsZSBzbyBkbyBhIHRlbXBsYXRlIGxvb2t1cFxuXHR9XG5cblx0Ly8gSWYgb3B0aW9ucywgdGhlbiB0aGlzIHdhcyBhbHJlYWR5IGNvbXBpbGVkIGZyb20gYSAoc2NyaXB0KSBlbGVtZW50IHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuXHQvLyBJZiBub3QsIHRoZW4gaWYgdG1wbCBpcyBhIHRlbXBsYXRlIG9iamVjdCwgdXNlIGl0IGZvciBvcHRpb25zXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8ICh0bXBsLm1hcmt1cFxuXHRcdD8gdG1wbC5ibmRzXG5cdFx0XHQ/ICRleHRlbmQoe30sIHRtcGwpXG5cdFx0XHQ6IHRtcGxcblx0XHQ6IHt9XG5cdCk7XG5cblx0b3B0aW9ucy50bXBsTmFtZSA9IG9wdGlvbnMudG1wbE5hbWUgfHwgbmFtZSB8fCBcInVubmFtZWRcIjtcblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRvcHRpb25zLl9wYXJlbnRUbXBsID0gcGFyZW50VG1wbDtcblx0fVxuXHQvLyBJZiB0bXBsIGlzIG5vdCBhIG1hcmt1cCBzdHJpbmcgb3IgYSBzZWxlY3RvciBzdHJpbmcsIHRoZW4gaXQgbXVzdCBiZSBhIHRlbXBsYXRlIG9iamVjdFxuXHQvLyBJbiB0aGF0IGNhc2UsIGdldCBpdCBmcm9tIHRoZSBtYXJrdXAgcHJvcGVydHkgb2YgdGhlIG9iamVjdFxuXHRpZiAoIXRtcGxPck1hcmt1cCAmJiB0bXBsLm1hcmt1cCAmJiAodG1wbE9yTWFya3VwID0gbG9va3VwVGVtcGxhdGUodG1wbC5tYXJrdXApKSAmJiB0bXBsT3JNYXJrdXAuZm4pIHtcblx0XHQvLyBJZiB0aGUgc3RyaW5nIHJlZmVyZW5jZXMgYSBjb21waWxlZCB0ZW1wbGF0ZSBvYmplY3QsIG5lZWQgdG8gcmVjb21waWxlIHRvIG1lcmdlIGFueSBtb2RpZmllZCBvcHRpb25zXG5cdFx0dG1wbE9yTWFya3VwID0gdG1wbE9yTWFya3VwLm1hcmt1cDtcblx0fVxuXHRpZiAodG1wbE9yTWFya3VwICE9PSB1bmRlZmluZWQpIHtcblx0XHRpZiAodG1wbE9yTWFya3VwLnJlbmRlciB8fCB0bXBsLnJlbmRlcikge1xuXHRcdFx0Ly8gdG1wbCBpcyBhbHJlYWR5IGNvbXBpbGVkLCBzbyB1c2UgaXRcblx0XHRcdGlmICh0bXBsT3JNYXJrdXAudG1wbHMpIHtcblx0XHRcdFx0Y29tcGlsZWRUbXBsID0gdG1wbE9yTWFya3VwO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyB0bXBsT3JNYXJrdXAgaXMgYSBtYXJrdXAgc3RyaW5nLCBub3QgYSBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0Ly8gQ3JlYXRlIHRlbXBsYXRlIG9iamVjdFxuXHRcdFx0dG1wbCA9IHRtcGxPYmplY3QodG1wbE9yTWFya3VwLCBvcHRpb25zKTtcblx0XHRcdC8vIENvbXBpbGUgdG8gQVNUIGFuZCB0aGVuIHRvIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHR0bXBsRm4odG1wbE9yTWFya3VwLnJlcGxhY2UockVzY2FwZVF1b3RlcywgXCJcXFxcJCZcIiksIHRtcGwpO1xuXHRcdH1cblx0XHRpZiAoIWNvbXBpbGVkVG1wbCkge1xuXHRcdFx0Y29tcGlsZWRUbXBsID0gJGV4dGVuZChmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBpbGVkVG1wbC5yZW5kZXIuYXBwbHkoY29tcGlsZWRUbXBsLCBhcmd1bWVudHMpO1xuXHRcdFx0fSwgdG1wbCk7XG5cblx0XHRcdGNvbXBpbGVDaGlsZFJlc291cmNlcyhjb21waWxlZFRtcGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29tcGlsZWRUbXBsO1xuXHR9XG59XG5cbi8vPT09PSAvZW5kIG9mIGZ1bmN0aW9uIGNvbXBpbGVUbXBsID09PT1cblxuLy89PT09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVZpZXdNb2RlbFxuLy89PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpIHtcblx0cmV0dXJuICRpc0Z1bmN0aW9uKGRlZmF1bHRWYWwpXG5cdFx0PyBkZWZhdWx0VmFsLmNhbGwoZGF0YSlcblx0XHQ6IGRlZmF1bHRWYWw7XG59XG5cbmZ1bmN0aW9uIGFkZFBhcmVudFJlZihvYiwgcmVmLCBwYXJlbnQpIHtcblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KG9iLCByZWYsIHtcblx0XHR2YWx1ZTogcGFyZW50LFxuXHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZVZpZXdNb2RlbChuYW1lLCB0eXBlKSB7XG5cdHZhciBpLCBjb25zdHJ1Y3RvciwgcGFyZW50LFxuXHRcdHZpZXdNb2RlbHMgPSB0aGlzLFxuXHRcdGdldHRlcnMgPSB0eXBlLmdldHRlcnMsXG5cdFx0ZXh0ZW5kID0gdHlwZS5leHRlbmQsXG5cdFx0aWQgPSB0eXBlLmlkLFxuXHRcdHByb3RvID0gJC5leHRlbmQoe1xuXHRcdFx0X2lzOiBuYW1lIHx8IFwidW5uYW1lZFwiLFxuXHRcdFx0dW5tYXA6IHVubWFwLFxuXHRcdFx0bWVyZ2U6IG1lcmdlXG5cdFx0fSwgZXh0ZW5kKSxcblx0XHRhcmdzID0gXCJcIixcblx0XHRjbnN0ciA9IFwiXCIsXG5cdFx0Z2V0dGVyQ291bnQgPSBnZXR0ZXJzID8gZ2V0dGVycy5sZW5ndGggOiAwLFxuXHRcdCRvYnNlcnZhYmxlID0gJC5vYnNlcnZhYmxlLFxuXHRcdGdldHRlck5hbWVzID0ge307XG5cblx0ZnVuY3Rpb24gSnN2Vm0oYXJncykge1xuXHRcdGNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHR9XG5cblx0ZnVuY3Rpb24gdm0oKSB7XG5cdFx0cmV0dXJuIG5ldyBKc3ZWbShhcmd1bWVudHMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXRlcmF0ZShkYXRhLCBhY3Rpb24pIHtcblx0XHR2YXIgZ2V0dGVyVHlwZSwgZGVmYXVsdFZhbCwgcHJvcCwgb2IsIHBhcmVudFJlZixcblx0XHRcdGogPSAwO1xuXHRcdGZvciAoOyBqIDwgZ2V0dGVyQ291bnQ7IGorKykge1xuXHRcdFx0cHJvcCA9IGdldHRlcnNbal07XG5cdFx0XHRnZXR0ZXJUeXBlID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHR5cGVvZiBwcm9wICE9PSBTVFJJTkcpIHtcblx0XHRcdFx0Z2V0dGVyVHlwZSA9IHByb3A7XG5cdFx0XHRcdHByb3AgPSBnZXR0ZXJUeXBlLmdldHRlcjtcblx0XHRcdFx0cGFyZW50UmVmID0gZ2V0dGVyVHlwZS5wYXJlbnRSZWY7XG5cdFx0XHR9XG5cdFx0XHRpZiAoKG9iID0gZGF0YVtwcm9wXSkgPT09IHVuZGVmaW5lZCAmJiBnZXR0ZXJUeXBlICYmIChkZWZhdWx0VmFsID0gZ2V0dGVyVHlwZS5kZWZhdWx0VmFsKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdG9iID0gZ2V0RGVmYXVsdFZhbChkZWZhdWx0VmFsLCBkYXRhKTtcblx0XHRcdH1cblx0XHRcdGFjdGlvbihvYiwgZ2V0dGVyVHlwZSAmJiB2aWV3TW9kZWxzW2dldHRlclR5cGUudHlwZV0sIHByb3AsIHBhcmVudFJlZik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gbWFwKGRhdGEpIHtcblx0XHRkYXRhID0gdHlwZW9mIGRhdGEgPT09IFNUUklOR1xuXHRcdFx0PyBKU09OLnBhcnNlKGRhdGEpIC8vIEFjY2VwdCBKU09OIHN0cmluZ1xuXHRcdFx0OiBkYXRhOyAgICAgICAgICAgIC8vIG9yIG9iamVjdC9hcnJheVxuXHRcdHZhciBsLCBwcm9wLCBjaGlsZE9iLCBwYXJlbnRSZWYsXG5cdFx0XHRqID0gMCxcblx0XHRcdG9iID0gZGF0YSxcblx0XHRcdGFyciA9IFtdO1xuXG5cdFx0aWYgKCRpc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRkYXRhID0gZGF0YSB8fCBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdGZvciAoOyBqPGw7IGorKykge1xuXHRcdFx0XHRhcnIucHVzaCh0aGlzLm1hcChkYXRhW2pdKSk7XG5cdFx0XHR9XG5cdFx0XHRhcnIuX2lzID0gbmFtZTtcblx0XHRcdGFyci51bm1hcCA9IHVubWFwO1xuXHRcdFx0YXJyLm1lcmdlID0gbWVyZ2U7XG5cdFx0XHRyZXR1cm4gYXJyO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRpdGVyYXRlKGRhdGEsIGZ1bmN0aW9uKG9iLCB2aWV3TW9kZWwpIHtcblx0XHRcdFx0aWYgKHZpZXdNb2RlbCkgeyAvLyBJdGVyYXRlIHRvIGJ1aWxkIGdldHRlcnMgYXJnIGFycmF5ICh2YWx1ZSwgb3IgbWFwcGVkIHZhbHVlKVxuXHRcdFx0XHRcdG9iID0gdmlld01vZGVsLm1hcChvYik7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJyLnB1c2gob2IpO1xuXHRcdFx0fSk7XG5cdFx0XHRvYiA9IHRoaXMuYXBwbHkodGhpcywgYXJyKTsgLy8gSW5zdGFudGlhdGUgdGhpcyBWaWV3IE1vZGVsLCBwYXNzaW5nIGdldHRlcnMgYXJncyBhcnJheSB0byBjb25zdHJ1Y3RvclxuXHRcdFx0aiA9IGdldHRlckNvdW50O1xuXHRcdFx0d2hpbGUgKGotLSkge1xuXHRcdFx0XHRjaGlsZE9iID0gYXJyW2pdO1xuXHRcdFx0XHRwYXJlbnRSZWYgPSBnZXR0ZXJzW2pdLnBhcmVudFJlZjtcblx0XHRcdFx0aWYgKHBhcmVudFJlZiAmJiBjaGlsZE9iICYmIGNoaWxkT2IudW5tYXApIHtcblx0XHRcdFx0XHRpZiAoJGlzQXJyYXkoY2hpbGRPYikpIHtcblx0XHRcdFx0XHRcdGwgPSBjaGlsZE9iLmxlbmd0aDtcblx0XHRcdFx0XHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdFx0XHRcdFx0YWRkUGFyZW50UmVmKGNoaWxkT2JbbF0sIHBhcmVudFJlZiwgb2IpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhZGRQYXJlbnRSZWYoY2hpbGRPYiwgcGFyZW50UmVmLCBvYik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKHByb3AgaW4gZGF0YSkgeyAvLyBDb3B5IG92ZXIgYW55IG90aGVyIHByb3BlcnRpZXMuIHRoYXQgYXJlIG5vdCBnZXQvc2V0IHByb3BlcnRpZXNcblx0XHRcdFx0aWYgKHByb3AgIT09ICRleHBhbmRvICYmICFnZXR0ZXJOYW1lc1twcm9wXSkge1xuXHRcdFx0XHRcdG9iW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRmdW5jdGlvbiBtZXJnZShkYXRhLCBwYXJlbnQsIHBhcmVudFJlZikge1xuXHRcdGRhdGEgPSB0eXBlb2YgZGF0YSA9PT0gU1RSSU5HXG5cdFx0XHQ/IEpTT04ucGFyc2UoZGF0YSkgLy8gQWNjZXB0IEpTT04gc3RyaW5nXG5cdFx0XHQ6IGRhdGE7ICAgICAgICAgICAgLy8gb3Igb2JqZWN0L2FycmF5XG5cblx0XHR2YXIgaiwgbCwgbSwgcHJvcCwgbW9kLCBmb3VuZCwgYXNzaWduZWQsIG9iLCBuZXdNb2RBcnIsIGNoaWxkT2IsXG5cdFx0XHRrID0gMCxcblx0XHRcdG1vZGVsID0gdGhpcztcblxuXHRcdGlmICgkaXNBcnJheShtb2RlbCkpIHtcblx0XHRcdGFzc2lnbmVkID0ge307XG5cdFx0XHRuZXdNb2RBcnIgPSBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdG0gPSBtb2RlbC5sZW5ndGg7XG5cdFx0XHRmb3IgKDsgazxsOyBrKyspIHtcblx0XHRcdFx0b2IgPSBkYXRhW2tdO1xuXHRcdFx0XHRmb3VuZCA9IGZhbHNlO1xuXHRcdFx0XHRmb3IgKGo9MDsgajxtICYmICFmb3VuZDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKGFzc2lnbmVkW2pdKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kID0gbW9kZWxbal07XG5cblx0XHRcdFx0XHRpZiAoaWQpIHtcblx0XHRcdFx0XHRcdGFzc2lnbmVkW2pdID0gZm91bmQgPSB0eXBlb2YgaWQgPT09IFNUUklOR1xuXHRcdFx0XHRcdFx0PyAob2JbaWRdICYmIChnZXR0ZXJOYW1lc1tpZF0gPyBtb2RbaWRdKCkgOiBtb2RbaWRdKSA9PT0gb2JbaWRdKVxuXHRcdFx0XHRcdFx0OiBpZChtb2QsIG9iKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRcdFx0bW9kLm1lcmdlKG9iKTtcblx0XHRcdFx0XHRuZXdNb2RBcnIucHVzaChtb2QpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ld01vZEFyci5wdXNoKGNoaWxkT2IgPSB2bS5tYXAob2IpKTtcblx0XHRcdFx0XHRpZiAocGFyZW50UmVmKSB7XG5cdFx0XHRcdFx0XHRhZGRQYXJlbnRSZWYoY2hpbGRPYiwgcGFyZW50UmVmLCBwYXJlbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCRvYnNlcnZhYmxlKSB7XG5cdFx0XHRcdCRvYnNlcnZhYmxlKG1vZGVsKS5yZWZyZXNoKG5ld01vZEFyciwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb2RlbC5zcGxpY2UuYXBwbHkobW9kZWwsIFswLCBtb2RlbC5sZW5ndGhdLmNvbmNhdChuZXdNb2RBcnIpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aXRlcmF0ZShkYXRhLCBmdW5jdGlvbihvYiwgdmlld01vZGVsLCBnZXR0ZXIsIHBhcmVudFJlZikge1xuXHRcdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0XHRtb2RlbFtnZXR0ZXJdKCkubWVyZ2Uob2IsIG1vZGVsLCBwYXJlbnRSZWYpOyAvLyBVcGRhdGUgdHlwZWQgcHJvcGVydHlcblx0XHRcdH0gZWxzZSBpZiAobW9kZWxbZ2V0dGVyXSgpICE9PSBvYikge1xuXHRcdFx0XHRtb2RlbFtnZXR0ZXJdKG9iKTsgLy8gVXBkYXRlIG5vbi10eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGZvciAocHJvcCBpbiBkYXRhKSB7XG5cdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gJiYgIWdldHRlck5hbWVzW3Byb3BdKSB7XG5cdFx0XHRcdG1vZGVsW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiB1bm1hcCgpIHtcblx0XHR2YXIgb2IsIHByb3AsIGdldHRlclR5cGUsIGFyciwgdmFsdWUsXG5cdFx0XHRrID0gMCxcblx0XHRcdG1vZGVsID0gdGhpcztcblxuXHRcdGZ1bmN0aW9uIHVubWFwQXJyYXkobW9kZWxBcnIpIHtcblx0XHRcdHZhciBhcnIgPSBbXSxcblx0XHRcdFx0aSA9IDAsXG5cdFx0XHRcdGwgPSBtb2RlbEFyci5sZW5ndGg7XG5cdFx0XHRmb3IgKDsgaTxsOyBpKyspIHtcblx0XHRcdFx0YXJyLnB1c2gobW9kZWxBcnJbaV0udW5tYXAoKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXJyO1xuXHRcdH1cblxuXHRcdGlmICgkaXNBcnJheShtb2RlbCkpIHtcblx0XHRcdHJldHVybiB1bm1hcEFycmF5KG1vZGVsKTtcblx0XHR9XG5cdFx0b2IgPSB7fTtcblx0XHRmb3IgKDsgayA8IGdldHRlckNvdW50OyBrKyspIHtcblx0XHRcdHByb3AgPSBnZXR0ZXJzW2tdO1xuXHRcdFx0Z2V0dGVyVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0eXBlb2YgcHJvcCAhPT0gU1RSSU5HKSB7XG5cdFx0XHRcdGdldHRlclR5cGUgPSBwcm9wO1xuXHRcdFx0XHRwcm9wID0gZ2V0dGVyVHlwZS5nZXR0ZXI7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZSA9IG1vZGVsW3Byb3BdKCk7XG5cdFx0XHRvYltwcm9wXSA9IGdldHRlclR5cGUgJiYgdmFsdWUgJiYgdmlld01vZGVsc1tnZXR0ZXJUeXBlLnR5cGVdXG5cdFx0XHRcdD8gJGlzQXJyYXkodmFsdWUpXG5cdFx0XHRcdFx0PyB1bm1hcEFycmF5KHZhbHVlKVxuXHRcdFx0XHRcdDogdmFsdWUudW5tYXAoKVxuXHRcdFx0XHQ6IHZhbHVlO1xuXHRcdH1cblx0XHRmb3IgKHByb3AgaW4gbW9kZWwpIHtcblx0XHRcdGlmIChtb2RlbC5oYXNPd25Qcm9wZXJ0eShwcm9wKSAmJiAocHJvcC5jaGFyQXQoMCkgIT09IFwiX1wiIHx8ICFnZXR0ZXJOYW1lc1twcm9wLnNsaWNlKDEpXSkgJiYgcHJvcCAhPT0gJGV4cGFuZG8gJiYgISRpc0Z1bmN0aW9uKG1vZGVsW3Byb3BdKSkge1xuXHRcdFx0XHRvYltwcm9wXSA9IG1vZGVsW3Byb3BdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRKc3ZWbS5wcm90b3R5cGUgPSBwcm90bztcblxuXHRmb3IgKGk9MDsgaSA8IGdldHRlckNvdW50OyBpKyspIHtcblx0XHQoZnVuY3Rpb24oZ2V0dGVyKSB7XG5cdFx0XHRnZXR0ZXIgPSBnZXR0ZXIuZ2V0dGVyIHx8IGdldHRlcjtcblx0XHRcdGdldHRlck5hbWVzW2dldHRlcl0gPSBpKzE7XG5cdFx0XHR2YXIgcHJpdkZpZWxkID0gXCJfXCIgKyBnZXR0ZXI7XG5cblx0XHRcdGFyZ3MgKz0gKGFyZ3MgPyBcIixcIiA6IFwiXCIpICsgZ2V0dGVyO1xuXHRcdFx0Y25zdHIgKz0gXCJ0aGlzLlwiICsgcHJpdkZpZWxkICsgXCIgPSBcIiArIGdldHRlciArIFwiO1xcblwiO1xuXHRcdFx0cHJvdG9bZ2V0dGVyXSA9IHByb3RvW2dldHRlcl0gfHwgZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzW3ByaXZGaWVsZF07IC8vIElmIHRoZXJlIGlzIG5vIGFyZ3VtZW50LCB1c2UgYXMgYSBnZXR0ZXJcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0XHQkb2JzZXJ2YWJsZSh0aGlzKS5zZXRQcm9wZXJ0eShnZXR0ZXIsIHZhbCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpc1twcml2RmllbGRdID0gdmFsO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0cHJvdG9bZ2V0dGVyXS5zZXQgPSBwcm90b1tnZXR0ZXJdLnNldCB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7IC8vIFNldHRlciBjYWxsZWQgYnkgb2JzZXJ2YWJsZSBwcm9wZXJ0eSBjaGFuZ2Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KShnZXR0ZXJzW2ldKTtcblx0fVxuXG5cdC8vIENvbnN0cnVjdG9yIGZvciBuZXcgdmlld01vZGVsIGluc3RhbmNlLlxuXHRjbnN0ciA9IG5ldyBGdW5jdGlvbihhcmdzLCBjbnN0cik7XG5cblx0Y29uc3RydWN0b3IgPSBmdW5jdGlvbigpIHtcblx0XHRjbnN0ci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdC8vIFBhc3MgYWRkaXRpb25hbCBwYXJlbnRSZWYgc3RyIGFuZCBwYXJlbnQgb2JqIHRvIGhhdmUgYSBwYXJlbnRSZWYgcG9pbnRlciBvbiBpbnN0YW5jZVxuXHRcdGlmIChwYXJlbnQgPSBhcmd1bWVudHNbZ2V0dGVyQ291bnQgKyAxXSkge1xuXHRcdFx0YWRkUGFyZW50UmVmKHRoaXMsIGFyZ3VtZW50c1tnZXR0ZXJDb3VudF0sIHBhcmVudCk7XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0cnVjdG9yLnByb3RvdHlwZSA9IHByb3RvO1xuXHRwcm90by5jb25zdHJ1Y3RvciA9IGNvbnN0cnVjdG9yO1xuXG5cdHZtLm1hcCA9IG1hcDtcblx0dm0uZ2V0dGVycyA9IGdldHRlcnM7XG5cdHZtLmV4dGVuZCA9IGV4dGVuZDtcblx0dm0uaWQgPSBpZDtcblx0cmV0dXJuIHZtO1xufVxuXG5mdW5jdGlvbiB0bXBsT2JqZWN0KG1hcmt1cCwgb3B0aW9ucykge1xuXHQvLyBUZW1wbGF0ZSBvYmplY3QgY29uc3RydWN0b3Jcblx0dmFyIGh0bWxUYWcsXG5cdFx0d3JhcE1hcCA9ICRzdWJTZXR0aW5nc0FkdmFuY2VkLl93bSB8fCB7fSwgLy8gT25seSB1c2VkIGluIEpzVmlld3MuIE90aGVyd2lzZSBlbXB0eToge31cblx0XHR0bXBsID0ge1xuXHRcdFx0dG1wbHM6IFtdLFxuXHRcdFx0bGlua3M6IHt9LCAvLyBDb21waWxlZCBmdW5jdGlvbnMgZm9yIGxpbmsgZXhwcmVzc2lvbnNcblx0XHRcdGJuZHM6IFtdLFxuXHRcdFx0X2lzOiBcInRlbXBsYXRlXCIsXG5cdFx0XHRyZW5kZXI6IHJlbmRlckNvbnRlbnRcblx0XHR9O1xuXG5cdGlmIChvcHRpb25zKSB7XG5cdFx0dG1wbCA9ICRleHRlbmQodG1wbCwgb3B0aW9ucyk7XG5cdH1cblxuXHR0bXBsLm1hcmt1cCA9IG1hcmt1cDtcblx0aWYgKCF0bXBsLmh0bWxUYWcpIHtcblx0XHQvLyBTZXQgdG1wbC50YWcgdG8gdGhlIHRvcC1sZXZlbCBIVE1MIHRhZyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSwgaWYgYW55Li4uXG5cdFx0aHRtbFRhZyA9IHJGaXJzdEVsZW0uZXhlYyhtYXJrdXApO1xuXHRcdHRtcGwuaHRtbFRhZyA9IGh0bWxUYWcgPyBodG1sVGFnWzFdLnRvTG93ZXJDYXNlKCkgOiBcIlwiO1xuXHR9XG5cdGh0bWxUYWcgPSB3cmFwTWFwW3RtcGwuaHRtbFRhZ107XG5cdGlmIChodG1sVGFnICYmIGh0bWxUYWcgIT09IHdyYXBNYXAuZGl2KSB7XG5cdFx0Ly8gV2hlbiB1c2luZyBKc1ZpZXdzLCB3ZSB0cmltIHRlbXBsYXRlcyB3aGljaCBhcmUgaW5zZXJ0ZWQgaW50byBIVE1MIGNvbnRleHRzIHdoZXJlIHRleHQgbm9kZXMgYXJlIG5vdCByZW5kZXJlZCAoaS5lLiBub3QgJ1BocmFzaW5nIENvbnRlbnQnKS5cblx0XHQvLyBDdXJyZW50bHkgbm90IHRyaW1tZWQgZm9yIDxsaT4gdGFnLiAoTm90IHdvcnRoIGFkZGluZyBwZXJmIGNvc3QpXG5cdFx0dG1wbC5tYXJrdXAgPSAkLnRyaW0odG1wbC5tYXJrdXApO1xuXHR9XG5cblx0cmV0dXJuIHRtcGw7XG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHJlZ2lzdGVyU3RvcmVcbi8vPT09PT09PT09PT09PT1cblxuLyoqXG4qIEludGVybmFsLiBSZWdpc3RlciBhIHN0b3JlIHR5cGUgKHVzZWQgZm9yIHRlbXBsYXRlLCB0YWdzLCBoZWxwZXJzLCBjb252ZXJ0ZXJzKVxuKi9cbmZ1bmN0aW9uIHJlZ2lzdGVyU3RvcmUoc3RvcmVOYW1lLCBzdG9yZVNldHRpbmdzKSB7XG5cbi8qKlxuKiBHZW5lcmljIHN0b3JlKCkgZnVuY3Rpb24gdG8gcmVnaXN0ZXIgaXRlbSwgbmFtZWQgaXRlbSwgb3IgaGFzaCBvZiBpdGVtc1xuKiBBbHNvIHVzZWQgYXMgaGFzaCB0byBzdG9yZSB0aGUgcmVnaXN0ZXJlZCBpdGVtc1xuKiBVc2VkIGFzIGltcGxlbWVudGF0aW9uIG9mICQudGVtcGxhdGVzKCksICQudmlld3MudGVtcGxhdGVzKCksICQudmlld3MudGFncygpLCAkLnZpZXdzLmhlbHBlcnMoKSBhbmQgJC52aWV3cy5jb252ZXJ0ZXJzKClcbipcbiogQHBhcmFtIHtzdHJpbmd8aGFzaH0gbmFtZSAgICAgICAgIG5hbWUgLSBvciBzZWxlY3RvciwgaW4gY2FzZSBvZiAkLnRlbXBsYXRlcygpLiBPciBoYXNoIG9mIGl0ZW1zXG4qIEBwYXJhbSB7YW55fSAgICAgICAgIFtpdGVtXSAgICAgICAoZS5nLiBtYXJrdXAgZm9yIG5hbWVkIHRlbXBsYXRlKVxuKiBAcGFyYW0ge3RlbXBsYXRlfSAgICBbcGFyZW50VG1wbF0gRm9yIGl0ZW0gYmVpbmcgcmVnaXN0ZXJlZCBhcyBwcml2YXRlIHJlc291cmNlIG9mIHRlbXBsYXRlXG4qIEByZXR1cm5zIHthbnl8JC52aWV3c30gaXRlbSwgZS5nLiBjb21waWxlZCB0ZW1wbGF0ZSAtIG9yICQudmlld3MgaW4gY2FzZSBvZiByZWdpc3RlcmluZyBoYXNoIG9mIGl0ZW1zXG4qL1xuXHRmdW5jdGlvbiB0aGVTdG9yZShuYW1lLCBpdGVtLCBwYXJlbnRUbXBsKSB7XG5cdFx0Ly8gVGhlIHN0b3JlIGlzIGFsc28gdGhlIGZ1bmN0aW9uIHVzZWQgdG8gYWRkIGl0ZW1zIHRvIHRoZSBzdG9yZS4gZS5nLiAkLnRlbXBsYXRlcywgb3IgJC52aWV3cy50YWdzXG5cblx0XHQvLyBGb3Igc3RvcmUgb2YgbmFtZSAndGhpbmcnLCBDYWxsIGFzOlxuXHRcdC8vICAgICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXHRcdC8vIG9yICQudmlld3MudGhpbmdzKG5hbWVbLCBpdGVtLCBwYXJlbnRUbXBsXSlcblxuXHRcdHZhciBjb21waWxlLCBpdGVtTmFtZSwgdGhpc1N0b3JlLCBjbnQsXG5cdFx0XHRvblN0b3JlID0gJHN1Yi5vblN0b3JlW3N0b3JlTmFtZV07XG5cblx0XHRpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gT0JKRUNUICYmICFuYW1lLm5vZGVUeXBlICYmICFuYW1lLm1hcmt1cCAmJiAhbmFtZS5nZXRUZ3QgJiYgIShzdG9yZU5hbWUgPT09IFwidmlld01vZGVsXCIgJiYgbmFtZS5nZXR0ZXJzIHx8IG5hbWUuZXh0ZW5kKSkge1xuXHRcdFx0Ly8gQ2FsbCB0byAkLnZpZXdzLnRoaW5ncyhpdGVtc1ssIHBhcmVudFRtcGxdKSxcblxuXHRcdFx0Ly8gQWRkaW5nIGl0ZW1zIHRvIHRoZSBzdG9yZVxuXHRcdFx0Ly8gSWYgbmFtZSBpcyBhIGhhc2gsIHRoZW4gaXRlbSBpcyBwYXJlbnRUbXBsLiBJdGVyYXRlIG92ZXIgaGFzaCBhbmQgY2FsbCBzdG9yZSBmb3Iga2V5LlxuXHRcdFx0Zm9yIChpdGVtTmFtZSBpbiBuYW1lKSB7XG5cdFx0XHRcdHRoZVN0b3JlKGl0ZW1OYW1lLCBuYW1lW2l0ZW1OYW1lXSwgaXRlbSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbSB8fCAkdmlld3M7XG5cdFx0fVxuXHRcdC8vIEFkZGluZyBhIHNpbmdsZSB1bm5hbWVkIGl0ZW0gdG8gdGhlIHN0b3JlXG5cdFx0aWYgKG5hbWUgJiYgIHR5cGVvZiBuYW1lICE9PSBTVFJJTkcpIHsgLy8gbmFtZSBtdXN0IGJlIGEgc3RyaW5nXG5cdFx0XHRwYXJlbnRUbXBsID0gaXRlbTtcblx0XHRcdGl0ZW0gPSBuYW1lO1xuXHRcdFx0bmFtZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhpc1N0b3JlID0gcGFyZW50VG1wbFxuXHRcdFx0PyBzdG9yZU5hbWUgPT09IFwidmlld01vZGVsXCJcblx0XHRcdFx0PyBwYXJlbnRUbXBsXG5cdFx0XHRcdDogKHBhcmVudFRtcGxbc3RvcmVOYW1lc10gPSBwYXJlbnRUbXBsW3N0b3JlTmFtZXNdIHx8IHt9KVxuXHRcdFx0OiB0aGVTdG9yZTtcblx0XHRjb21waWxlID0gc3RvcmVTZXR0aW5ncy5jb21waWxlO1xuXG5cdFx0aWYgKGl0ZW0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aXRlbSA9IGNvbXBpbGUgPyBuYW1lIDogdGhpc1N0b3JlW25hbWVdO1xuXHRcdFx0bmFtZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKGl0ZW0gPT09IG51bGwpIHtcblx0XHRcdC8vIElmIGl0ZW0gaXMgbnVsbCwgZGVsZXRlIHRoaXMgZW50cnlcblx0XHRcdGlmIChuYW1lKSB7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzU3RvcmVbbmFtZV07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChjb21waWxlKSB7XG5cdFx0XHRcdGl0ZW0gPSBjb21waWxlLmNhbGwodGhpc1N0b3JlLCBuYW1lLCBpdGVtLCBwYXJlbnRUbXBsLCAwKSB8fCB7fTtcblx0XHRcdFx0aXRlbS5faXMgPSBzdG9yZU5hbWU7IC8vIE9ubHkgZG8gdGhpcyBmb3IgY29tcGlsZWQgb2JqZWN0cyAodGFncywgdGVtcGxhdGVzLi4uKVxuXHRcdFx0fVxuXHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0dGhpc1N0b3JlW25hbWVdID0gaXRlbTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKG9uU3RvcmUpIHtcblx0XHRcdC8vIGUuZy4gSnNWaWV3cyBpbnRlZ3JhdGlvblxuXHRcdFx0b25TdG9yZShuYW1lLCBpdGVtLCBwYXJlbnRUbXBsLCBjb21waWxlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGl0ZW07XG5cdH1cblxuXHR2YXIgc3RvcmVOYW1lcyA9IHN0b3JlTmFtZSArIFwic1wiO1xuXHQkdmlld3Nbc3RvcmVOYW1lc10gPSB0aGVTdG9yZTtcbn1cblxuLyoqXG4qIEFkZCBzZXR0aW5ncyBzdWNoIGFzOlxuKiAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSh0cnVlKVxuKiBAcGFyYW0ge2Jvb2xlYW59IHZhbHVlXG4qIEByZXR1cm5zIHtTZXR0aW5nc31cbipcbiogYWxsb3dDb2RlID0gJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUoKVxuKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiovXG5mdW5jdGlvbiBhZGRTZXR0aW5nKHN0KSB7XG5cdCR2aWV3c1NldHRpbmdzW3N0XSA9ICR2aWV3c1NldHRpbmdzW3N0XSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdHJldHVybiBhcmd1bWVudHMubGVuZ3RoXG5cdFx0XHQ/ICgkc3ViU2V0dGluZ3Nbc3RdID0gdmFsdWUsICR2aWV3c1NldHRpbmdzKVxuXHRcdFx0OiAkc3ViU2V0dGluZ3Nbc3RdO1xuXHR9O1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gZGF0YU1hcCBmb3IgcmVuZGVyIG9ubHlcbi8vPT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGRhdGFNYXAobWFwRGVmKSB7XG5cdGZ1bmN0aW9uIE1hcChzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHR0aGlzLnRndCA9IG1hcERlZi5nZXRUZ3Qoc291cmNlLCBvcHRpb25zKTtcblx0XHRvcHRpb25zLm1hcCA9IHRoaXM7XG5cdH1cblxuXHRpZiAoJGlzRnVuY3Rpb24obWFwRGVmKSkge1xuXHRcdC8vIFNpbXBsZSBtYXAgZGVjbGFyZWQgYXMgZnVuY3Rpb25cblx0XHRtYXBEZWYgPSB7XG5cdFx0XHRnZXRUZ3Q6IG1hcERlZlxuXHRcdH07XG5cdH1cblxuXHRpZiAobWFwRGVmLmJhc2VNYXApIHtcblx0XHRtYXBEZWYgPSAkZXh0ZW5kKCRleHRlbmQoe30sIG1hcERlZi5iYXNlTWFwKSwgbWFwRGVmKTtcblx0fVxuXG5cdG1hcERlZi5tYXAgPSBmdW5jdGlvbihzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gbmV3IE1hcChzb3VyY2UsIG9wdGlvbnMpO1xuXHR9O1xuXHRyZXR1cm4gbWFwRGVmO1xufVxuXG4vLz09PT09PT09PT09PT09XG4vLyByZW5kZXJDb250ZW50XG4vLz09PT09PT09PT09PT09XG5cbi8qKiBSZW5kZXIgdGhlIHRlbXBsYXRlIGFzIGEgc3RyaW5nLCB1c2luZyB0aGUgc3BlY2lmaWVkIGRhdGEgYW5kIGhlbHBlcnMvY29udGV4dFxuKiAkKFwiI3RtcGxcIikucmVuZGVyKCksIHRtcGwucmVuZGVyKCksIHRhZ0N0eC5yZW5kZXIoKSwgJC5yZW5kZXIubmFtZWRUbXBsKClcbipcbiogQHBhcmFtIHthbnl9ICAgICAgICBkYXRhXG4qIEBwYXJhbSB7aGFzaH0gICAgICAgW2NvbnRleHRdICAgICAgICAgICBoZWxwZXJzIG9yIGNvbnRleHRcbiogQHBhcmFtIHtib29sZWFufSAgICBbbm9JdGVyYXRpb25dXG4qIEBwYXJhbSB7Vmlld30gICAgICAgW3BhcmVudFZpZXddICAgICAgICBpbnRlcm5hbFxuKiBAcGFyYW0ge3N0cmluZ30gICAgIFtrZXldICAgICAgICAgICAgICAgaW50ZXJuYWxcbiogQHBhcmFtIHtmdW5jdGlvbn0gICBbb25SZW5kZXJdICAgICAgICAgIGludGVybmFsXG4qIEByZXR1cm5zIHtzdHJpbmd9ICAgcmVuZGVyZWQgdGVtcGxhdGUgICBpbnRlcm5hbFxuKi9cbmZ1bmN0aW9uIHJlbmRlckNvbnRlbnQoZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24sIHBhcmVudFZpZXcsIGtleSwgb25SZW5kZXIpIHtcblx0dmFyIGksIGwsIHRhZywgdG1wbCwgdGFnQ3R4LCBpc1RvcFJlbmRlckNhbGwsIHByZXZEYXRhLCBwcmV2SW5kZXgsXG5cdFx0dmlldyA9IHBhcmVudFZpZXcsXG5cdFx0cmVzdWx0ID0gXCJcIjtcblxuXHRpZiAoY29udGV4dCA9PT0gdHJ1ZSkge1xuXHRcdG5vSXRlcmF0aW9uID0gY29udGV4dDsgLy8gcGFzc2luZyBib29sZWFuIGFzIHNlY29uZCBwYXJhbSAtIG5vSXRlcmF0aW9uXG5cdFx0Y29udGV4dCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICh0eXBlb2YgY29udGV4dCAhPT0gT0JKRUNUKSB7XG5cdFx0Y29udGV4dCA9IHVuZGVmaW5lZDsgLy8gY29udGV4dCBtdXN0IGJlIGEgYm9vbGVhbiAobm9JdGVyYXRpb24pIG9yIGEgcGxhaW4gb2JqZWN0XG5cdH1cblxuXHRpZiAodGFnID0gdGhpcy50YWcpIHtcblx0XHQvLyBUaGlzIGlzIGEgY2FsbCBmcm9tIHJlbmRlclRhZyBvciB0YWdDdHgucmVuZGVyKC4uLilcblx0XHR0YWdDdHggPSB0aGlzO1xuXHRcdHZpZXcgPSB2aWV3IHx8IHRhZ0N0eC52aWV3O1xuXHRcdHRtcGwgPSB2aWV3Ll9nZXRUbXBsKHRhZy50ZW1wbGF0ZSB8fCB0YWdDdHgudG1wbCk7XG5cdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRkYXRhID0gdGFnLmNvbnRlbnRDdHggJiYgJGlzRnVuY3Rpb24odGFnLmNvbnRlbnRDdHgpXG5cdFx0XHRcdD8gZGF0YSA9IHRhZy5jb250ZW50Q3R4KGRhdGEpXG5cdFx0XHRcdDogdmlldzsgLy8gRGVmYXVsdCBkYXRhIGNvbnRleHQgZm9yIHdyYXBwZWQgYmxvY2sgY29udGVudCBpcyB0aGUgZmlyc3QgYXJndW1lbnRcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gVGhpcyBpcyBhIHRlbXBsYXRlLnJlbmRlciguLi4pIGNhbGxcblx0XHR0bXBsID0gdGhpcztcblx0fVxuXG5cdGlmICh0bXBsKSB7XG5cdFx0aWYgKCFwYXJlbnRWaWV3ICYmIGRhdGEgJiYgZGF0YS5faXMgPT09IFwidmlld1wiKSB7XG5cdFx0XHR2aWV3ID0gZGF0YTsgLy8gV2hlbiBwYXNzaW5nIGluIGEgdmlldyB0byByZW5kZXIgb3IgbGluayAoYW5kIG5vdCBwYXNzaW5nIGluIGEgcGFyZW50IHZpZXcpIHVzZSB0aGUgcGFzc2VkLWluIHZpZXcgYXMgcGFyZW50Vmlld1xuXHRcdH1cblxuXHRcdGlmICh2aWV3ICYmIGRhdGEgPT09IHZpZXcpIHtcblx0XHRcdC8vIEluaGVyaXQgdGhlIGRhdGEgZnJvbSB0aGUgcGFyZW50IHZpZXcuXG5cdFx0XHRkYXRhID0gdmlldy5kYXRhO1xuXHRcdH1cblxuXHRcdGlzVG9wUmVuZGVyQ2FsbCA9ICF2aWV3O1xuXHRcdGlzUmVuZGVyQ2FsbCA9IGlzUmVuZGVyQ2FsbCB8fCBpc1RvcFJlbmRlckNhbGw7XG5cdFx0aWYgKGlzVG9wUmVuZGVyQ2FsbCkge1xuXHRcdFx0KGNvbnRleHQgPSBjb250ZXh0IHx8IHt9KS5yb290ID0gZGF0YTsgLy8gUHJvdmlkZSB+cm9vdCBhcyBzaG9ydGN1dCB0byB0b3AtbGV2ZWwgZGF0YS5cblx0XHR9XG5cdFx0aWYgKCFpc1JlbmRlckNhbGwgfHwgJHN1YlNldHRpbmdzQWR2YW5jZWQudXNlVmlld3MgfHwgdG1wbC51c2VWaWV3cyB8fCB2aWV3ICYmIHZpZXcgIT09IHRvcFZpZXcpIHtcblx0XHRcdHJlc3VsdCA9IHJlbmRlcldpdGhWaWV3cyh0bXBsLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgdmlldywga2V5LCBvblJlbmRlciwgdGFnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHZpZXcpIHsgLy8gSW4gYSBibG9ja1xuXHRcdFx0XHRwcmV2RGF0YSA9IHZpZXcuZGF0YTtcblx0XHRcdFx0cHJldkluZGV4ID0gdmlldy5pbmRleDtcblx0XHRcdFx0dmlldy5pbmRleCA9IGluZGV4U3RyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmlldyA9IHRvcFZpZXc7XG5cdFx0XHRcdHByZXZEYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0XHR2aWV3LmRhdGEgPSBkYXRhO1xuXHRcdFx0XHR2aWV3LmN0eCA9IGNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoJGlzQXJyYXkoZGF0YSkgJiYgIW5vSXRlcmF0aW9uKSB7XG5cdFx0XHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgcGFyZW50VmlldyBhcmUgcGFzc2VkIGluXG5cdFx0XHRcdC8vIGFsb25nIHdpdGggcGFyZW50IHZpZXcsIHRyZWF0IGFzIGluc2VydCAtZS5nLiBmcm9tIHZpZXcuYWRkVmlld3MgLSBzbyBwYXJlbnRWaWV3IGlzIGFscmVhZHkgdGhlIHZpZXcgaXRlbSBmb3IgYXJyYXkpXG5cdFx0XHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0XHRcdHZpZXcuaW5kZXggPSBpO1xuXHRcdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGFbaV07XG5cdFx0XHRcdFx0cmVzdWx0ICs9IHRtcGwuZm4oZGF0YVtpXSwgdmlldywgJHN1Yik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGEsIHZpZXcsICRzdWIpO1xuXHRcdFx0fVxuXHRcdFx0dmlldy5kYXRhID0gcHJldkRhdGE7XG5cdFx0XHR2aWV3LmluZGV4ID0gcHJldkluZGV4O1xuXHRcdH1cblx0XHRpZiAoaXNUb3BSZW5kZXJDYWxsKSB7XG5cdFx0XHRpc1JlbmRlckNhbGwgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlcldpdGhWaWV3cyh0bXBsLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgdmlldywga2V5LCBvblJlbmRlciwgdGFnKSB7XG5cdC8vIFJlbmRlciB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGEgYXMgYSB0cmVlIG9mIHN1YnZpZXdzIChuZXN0ZWQgcmVuZGVyZWQgdGVtcGxhdGUgaW5zdGFuY2VzKSwgb3IgYXMgYSBzdHJpbmcgKHRvcC1sZXZlbCB0ZW1wbGF0ZSkuXG5cdC8vIElmIHRoZSBkYXRhIGlzIHRoZSBwYXJlbnQgdmlldywgdHJlYXQgYXMgbm9JdGVyYXRpb24sIHJlLXJlbmRlciB3aXRoIHRoZSBzYW1lIGRhdGEgY29udGV4dC5cblx0Ly8gdG1wbCBjYW4gYmUgYSBzdHJpbmcgKGUuZy4gcmVuZGVyZWQgYnkgYSB0YWcucmVuZGVyKCkgbWV0aG9kKSwgb3IgYSBjb21waWxlZCB0ZW1wbGF0ZS5cblx0dmFyIGksIGwsIG5ld1ZpZXcsIGNoaWxkVmlldywgaXRlbVJlc3VsdCwgc3dhcENvbnRlbnQsIGNvbnRlbnRUbXBsLCBvdXRlck9uUmVuZGVyLCB0bXBsTmFtZSwgaXRlbVZhciwgbmV3Q3R4LCB0YWdDdHgsIG5vTGlua2luZyxcblx0XHRyZXN1bHQgPSBcIlwiO1xuXG5cdGlmICh0YWcpIHtcblx0XHQvLyBUaGlzIGlzIGEgY2FsbCBmcm9tIHJlbmRlclRhZyBvciB0YWdDdHgucmVuZGVyKC4uLilcblx0XHR0bXBsTmFtZSA9IHRhZy50YWdOYW1lO1xuXHRcdHRhZ0N0eCA9IHRhZy50YWdDdHg7XG5cdFx0Y29udGV4dCA9IGNvbnRleHQgPyBleHRlbmRDdHgoY29udGV4dCwgdGFnLmN0eCkgOiB0YWcuY3R4O1xuXG5cdFx0aWYgKHRtcGwgPT09IHZpZXcuY29udGVudCkgeyAvLyB7e3h4eCB0bXBsPSNjb250ZW50fX1cblx0XHRcdGNvbnRlbnRUbXBsID0gdG1wbCAhPT0gdmlldy5jdHguX3dycCAvLyBXZSBhcmUgcmVuZGVyaW5nIHRoZSAjY29udGVudFxuXHRcdFx0XHQ/IHZpZXcuY3R4Ll93cnAgLy8gI2NvbnRlbnQgd2FzIHRoZSB0YWdDdHgucHJvcHMudG1wbCB3cmFwcGVyIG9mIHRoZSBibG9jayBjb250ZW50IC0gc28gd2l0aGluIHRoaXMgdmlldywgI2NvbnRlbnQgd2lsbCBub3cgYmUgdGhlIHZpZXcuY3R4Ll93cnAgYmxvY2sgY29udGVudFxuXHRcdFx0XHQ6IHVuZGVmaW5lZDsgLy8gI2NvbnRlbnQgd2FzIHRoZSB2aWV3LmN0eC5fd3JwIGJsb2NrIGNvbnRlbnQgLSBzbyB3aXRoaW4gdGhpcyB2aWV3LCB0aGVyZSBpcyBubyBsb25nZXIgYW55ICNjb250ZW50IHRvIHdyYXAuXG5cdFx0fSBlbHNlIGlmICh0bXBsICE9PSB0YWdDdHguY29udGVudCkge1xuXHRcdFx0aWYgKHRtcGwgPT09IHRhZy50ZW1wbGF0ZSkgeyAvLyBSZW5kZXJpbmcge3t0YWd9fSB0YWcudGVtcGxhdGUsIHJlcGxhY2luZyBibG9jayBjb250ZW50LlxuXHRcdFx0XHRjb250ZW50VG1wbCA9IHRhZ0N0eC50bXBsOyAvLyBTZXQgI2NvbnRlbnQgdG8gYmxvY2sgY29udGVudCAob3Igd3JhcHBlZCBibG9jayBjb250ZW50IGlmIHRhZ0N0eC5wcm9wcy50bXBsIGlzIHNldClcblx0XHRcdFx0Y29udGV4dC5fd3JwID0gdGFnQ3R4LmNvbnRlbnQ7IC8vIFBhc3Mgd3JhcHBlZCBibG9jayBjb250ZW50IHRvIG5lc3RlZCB2aWV3c1xuXHRcdFx0fSBlbHNlIHsgLy8gUmVuZGVyaW5nIHRhZ0N0eC5wcm9wcy50bXBsIHdyYXBwZXJcblx0XHRcdFx0Y29udGVudFRtcGwgPSB0YWdDdHguY29udGVudCB8fCB2aWV3LmNvbnRlbnQ7IC8vIFNldCAjY29udGVudCB0byB3cmFwcGVkIGJsb2NrIGNvbnRlbnRcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29udGVudFRtcGwgPSB2aWV3LmNvbnRlbnQ7IC8vIE5lc3RlZCB2aWV3cyBpbmhlcml0IHNhbWUgd3JhcHBlZCAjY29udGVudCBwcm9wZXJ0eVxuXHRcdH1cblxuXHRcdGlmICh0YWdDdHgucHJvcHMubGluayA9PT0gZmFsc2UpIHtcblx0XHRcdC8vIGxpbms9ZmFsc2Ugc2V0dGluZyBvbiBibG9jayB0YWdcblx0XHRcdC8vIFdlIHdpbGwgb3ZlcnJpZGUgaW5oZXJpdGVkIHZhbHVlIG9mIGxpbmsgYnkgdGhlIGV4cGxpY2l0IHNldHRpbmcgbGluaz1mYWxzZSB0YWtlbiBmcm9tIHByb3BzXG5cdFx0XHQvLyBUaGUgY2hpbGQgdmlld3Mgb2YgYW4gdW5saW5rZWQgdmlldyBhcmUgYWxzbyB1bmxpbmtlZC4gU28gc2V0dGluZyBjaGlsZCBiYWNrIHRvIHRydWUgd2lsbCBub3QgaGF2ZSBhbnkgZWZmZWN0LlxuXHRcdFx0Y29udGV4dCA9IGNvbnRleHQgfHwge307XG5cdFx0XHRjb250ZXh0LmxpbmsgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRpZiAodmlldykge1xuXHRcdG9uUmVuZGVyID0gb25SZW5kZXIgfHwgdmlldy5fLm9uUmVuZGVyO1xuXHRcdG5vTGlua2luZyA9IGNvbnRleHQgJiYgY29udGV4dC5saW5rID09PSBmYWxzZTtcblxuXHRcdGlmIChub0xpbmtpbmcgJiYgdmlldy5fLm5sKSB7XG5cdFx0XHRvblJlbmRlciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb250ZXh0ID0gZXh0ZW5kQ3R4KGNvbnRleHQsIHZpZXcuY3R4KTtcblx0XHR0YWdDdHggPSAhdGFnICYmIHZpZXcudGFnXG5cdFx0XHQ/IHZpZXcudGFnLnRhZ0N0eHNbdmlldy50YWdFbHNlXVxuXHRcdFx0OiB0YWdDdHg7XG5cdH1cblxuXHRpZiAoaXRlbVZhciA9IHRhZ0N0eCAmJiB0YWdDdHgucHJvcHMuaXRlbVZhcikge1xuXHRcdGlmIChpdGVtVmFyWzBdICE9PSBcIn5cIikge1xuXHRcdFx0c3ludGF4RXJyb3IoXCJVc2UgaXRlbVZhcj0nfm15SXRlbSdcIik7XG5cdFx0fVxuXHRcdGl0ZW1WYXIgPSBpdGVtVmFyLnNsaWNlKDEpO1xuXHR9XG5cblx0aWYgKGtleSA9PT0gdHJ1ZSkge1xuXHRcdHN3YXBDb250ZW50ID0gdHJ1ZTtcblx0XHRrZXkgPSAwO1xuXHR9XG5cblx0Ly8gSWYgbGluaz09PWZhbHNlLCBkbyBub3QgY2FsbCBvblJlbmRlciwgc28gbm8gZGF0YS1saW5raW5nIG1hcmtlciBub2Rlc1xuXHRpZiAob25SZW5kZXIgJiYgdGFnICYmIHRhZy5fLm5vVndzKSB7XG5cdFx0b25SZW5kZXIgPSB1bmRlZmluZWQ7XG5cdH1cblx0b3V0ZXJPblJlbmRlciA9IG9uUmVuZGVyO1xuXHRpZiAob25SZW5kZXIgPT09IHRydWUpIHtcblx0XHQvLyBVc2VkIGJ5IHZpZXcucmVmcmVzaCgpLiBEb24ndCBjcmVhdGUgYSBuZXcgd3JhcHBlciB2aWV3LlxuXHRcdG91dGVyT25SZW5kZXIgPSB1bmRlZmluZWQ7XG5cdFx0b25SZW5kZXIgPSB2aWV3Ll8ub25SZW5kZXI7XG5cdH1cblx0Ly8gU2V0IGFkZGl0aW9uYWwgY29udGV4dCBvbiB2aWV3cyBjcmVhdGVkIGhlcmUsIChhcyBtb2RpZmllZCBjb250ZXh0IGluaGVyaXRlZCBmcm9tIHRoZSBwYXJlbnQsIGFuZCB0byBiZSBpbmhlcml0ZWQgYnkgY2hpbGQgdmlld3MpXG5cdGNvbnRleHQgPSB0bXBsLmhlbHBlcnNcblx0XHQ/IGV4dGVuZEN0eCh0bXBsLmhlbHBlcnMsIGNvbnRleHQpXG5cdFx0OiBjb250ZXh0O1xuXG5cdG5ld0N0eCA9IGNvbnRleHQ7XG5cdGlmICgkaXNBcnJheShkYXRhKSAmJiAhbm9JdGVyYXRpb24pIHtcblx0XHQvLyBDcmVhdGUgYSB2aWV3IGZvciB0aGUgYXJyYXksIHdob3NlIGNoaWxkIHZpZXdzIGNvcnJlc3BvbmQgdG8gZWFjaCBkYXRhIGl0ZW0uIChOb3RlOiBpZiBrZXkgYW5kIHZpZXcgYXJlIHBhc3NlZCBpblxuXHRcdC8vIGFsb25nIHdpdGggcGFyZW50IHZpZXcsIHRyZWF0IGFzIGluc2VydCAtZS5nLiBmcm9tIHZpZXcuYWRkVmlld3MgLSBzbyB2aWV3IGlzIGFscmVhZHkgdGhlIHZpZXcgaXRlbSBmb3IgYXJyYXkpXG5cdFx0bmV3VmlldyA9IHN3YXBDb250ZW50XG5cdFx0XHQ/IHZpZXdcblx0XHRcdDogKGtleSAhPT0gdW5kZWZpbmVkICYmIHZpZXcpXG5cdFx0XHRcdHx8IG5ldyBWaWV3KGNvbnRleHQsIFwiYXJyYXlcIiwgdmlldywgZGF0YSwgdG1wbCwga2V5LCBvblJlbmRlciwgY29udGVudFRtcGwpO1xuXHRcdG5ld1ZpZXcuXy5ubD0gbm9MaW5raW5nO1xuXHRcdGlmICh2aWV3ICYmIHZpZXcuXy51c2VLZXkpIHtcblx0XHRcdC8vIFBhcmVudCBpcyBub3QgYW4gJ2FycmF5IHZpZXcnXG5cdFx0XHRuZXdWaWV3Ll8uYm5kID0gIXRhZyB8fCB0YWcuXy5ibmQgJiYgdGFnOyAvLyBGb3IgYXJyYXkgdmlld3MgdGhhdCBhcmUgZGF0YSBib3VuZCBmb3IgY29sbGVjdGlvbiBjaGFuZ2UgZXZlbnRzLCBzZXQgdGhlXG5cdFx0XHQvLyB2aWV3Ll8uYm5kIHByb3BlcnR5IHRvIHRydWUgZm9yIHRvcC1sZXZlbCBsaW5rKCkgb3IgZGF0YS1saW5rPVwie2Zvcn1cIiwgb3IgdG8gdGhlIHRhZyBpbnN0YW5jZSBmb3IgYSBkYXRhLWJvdW5kIHRhZywgZS5nLiB7Xntmb3IgLi4ufX1cblx0XHRcdG5ld1ZpZXcudGFnID0gdGFnO1xuXHRcdH1cblx0XHRmb3IgKGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0XHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIGVhY2ggZGF0YSBpdGVtLlxuXHRcdFx0Y2hpbGRWaWV3ID0gbmV3IFZpZXcobmV3Q3R4LCBcIml0ZW1cIiwgbmV3VmlldywgZGF0YVtpXSwgdG1wbCwgKGtleSB8fCAwKSArIGksIG9uUmVuZGVyLCBuZXdWaWV3LmNvbnRlbnQpO1xuXHRcdFx0aWYgKGl0ZW1WYXIpIHtcblx0XHRcdFx0KGNoaWxkVmlldy5jdHggPSAkZXh0ZW5kKHt9LCBuZXdDdHgpKVtpdGVtVmFyXSA9ICRzdWIuX2NwKGRhdGFbaV0sIFwiI2RhdGFcIiwgY2hpbGRWaWV3KTtcblx0XHRcdH1cblx0XHRcdGl0ZW1SZXN1bHQgPSB0bXBsLmZuKGRhdGFbaV0sIGNoaWxkVmlldywgJHN1Yik7XG5cdFx0XHRyZXN1bHQgKz0gbmV3Vmlldy5fLm9uUmVuZGVyID8gbmV3Vmlldy5fLm9uUmVuZGVyKGl0ZW1SZXN1bHQsIGNoaWxkVmlldykgOiBpdGVtUmVzdWx0O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBDcmVhdGUgYSB2aWV3IGZvciBzaW5nbGV0b24gZGF0YSBvYmplY3QuIFRoZSB0eXBlIG9mIHRoZSB2aWV3IHdpbGwgYmUgdGhlIHRhZyBuYW1lLCBlLmcuIFwiaWZcIiBvciBcIm15dGFnXCIgZXhjZXB0IGZvclxuXHRcdC8vIFwiaXRlbVwiLCBcImFycmF5XCIgYW5kIFwiZGF0YVwiIHZpZXdzLiBBIFwiZGF0YVwiIHZpZXcgaXMgZnJvbSBwcm9ncmFtbWF0aWMgcmVuZGVyKG9iamVjdCkgYWdhaW5zdCBhICdzaW5nbGV0b24nLlxuXHRcdG5ld1ZpZXcgPSBzd2FwQ29udGVudCA/IHZpZXcgOiBuZXcgVmlldyhuZXdDdHgsIHRtcGxOYW1lIHx8IFwiZGF0YVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cblx0XHRpZiAoaXRlbVZhcikge1xuXHRcdFx0KG5ld1ZpZXcuY3R4ID0gJGV4dGVuZCh7fSwgbmV3Q3R4KSlbaXRlbVZhcl0gPSAkc3ViLl9jcChkYXRhLCBcIiNkYXRhXCIsIG5ld1ZpZXcpO1xuXHRcdH1cblxuXHRcdG5ld1ZpZXcudGFnID0gdGFnO1xuXHRcdG5ld1ZpZXcuXy5ubCA9IG5vTGlua2luZztcblx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhLCBuZXdWaWV3LCAkc3ViKTtcblx0fVxuXHRpZiAodGFnKSB7XG5cdFx0bmV3Vmlldy50YWdFbHNlID0gdGFnQ3R4LmluZGV4O1xuXHRcdHRhZ0N0eC5jb250ZW50VmlldyA9IG5ld1ZpZXc7XG5cdH1cblx0cmV0dXJuIG91dGVyT25SZW5kZXIgPyBvdXRlck9uUmVuZGVyKHJlc3VsdCwgbmV3VmlldykgOiByZXN1bHQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBCdWlsZCBhbmQgY29tcGlsZSB0ZW1wbGF0ZVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gR2VuZXJhdGUgYSByZXVzYWJsZSBmdW5jdGlvbiB0aGF0IHdpbGwgc2VydmUgdG8gcmVuZGVyIGEgdGVtcGxhdGUgYWdhaW5zdCBkYXRhXG4vLyAoQ29tcGlsZSBBU1QgdGhlbiBidWlsZCB0ZW1wbGF0ZSBmdW5jdGlvbilcblxuZnVuY3Rpb24gb25SZW5kZXJFcnJvcihlLCB2aWV3LCBmYWxsYmFjaykge1xuXHR2YXIgbWVzc2FnZSA9IGZhbGxiYWNrICE9PSB1bmRlZmluZWRcblx0XHQ/ICRpc0Z1bmN0aW9uKGZhbGxiYWNrKVxuXHRcdFx0PyBmYWxsYmFjay5jYWxsKHZpZXcuZGF0YSwgZSwgdmlldylcblx0XHRcdDogZmFsbGJhY2sgfHwgXCJcIlxuXHRcdDogXCJ7RXJyb3I6IFwiICsgKGUubWVzc2FnZXx8ZSkgKyBcIn1cIjtcblxuXHRpZiAoJHN1YlNldHRpbmdzLm9uRXJyb3IgJiYgKGZhbGxiYWNrID0gJHN1YlNldHRpbmdzLm9uRXJyb3IuY2FsbCh2aWV3LmRhdGEsIGUsIGZhbGxiYWNrICYmIG1lc3NhZ2UsIHZpZXcpKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0bWVzc2FnZSA9IGZhbGxiYWNrOyAvLyBUaGVyZSBpcyBhIHNldHRpbmdzLmRlYnVnTW9kZShoYW5kbGVyKSBvbkVycm9yIG92ZXJyaWRlLiBDYWxsIGl0LCBhbmQgdXNlIHJldHVybiB2YWx1ZSAoaWYgYW55KSB0byByZXBsYWNlIG1lc3NhZ2Vcblx0fVxuXHRyZXR1cm4gdmlldyAmJiAhdmlldy5fbGMgPyAkY29udmVydGVycy5odG1sKG1lc3NhZ2UpIDogbWVzc2FnZTsgLy8gRm9yIGRhdGEtbGluaz1cXFwiey4uLiBvbkVycm9yPS4uLn1cIi4uLiBTZWUgb25EYXRhTGlua2VkVGFnQ2hhbmdlXG59XG5cbmZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcblx0dGhyb3cgbmV3ICRzdWIuRXJyKG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiBzeW50YXhFcnJvcihtZXNzYWdlKSB7XG5cdGVycm9yKFwiU3ludGF4IGVycm9yXFxuXCIgKyBtZXNzYWdlKTtcbn1cblxuZnVuY3Rpb24gdG1wbEZuKG1hcmt1cCwgdG1wbCwgaXNMaW5rRXhwciwgY29udmVydEJhY2ssIGhhc0Vsc2UpIHtcblx0Ly8gQ29tcGlsZSBtYXJrdXAgdG8gQVNUIChhYnRyYWN0IHN5bnRheCB0cmVlKSB0aGVuIGJ1aWxkIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBjb2RlIGZyb20gdGhlIEFTVCBub2Rlc1xuXHQvLyBVc2VkIGZvciBjb21waWxpbmcgdGVtcGxhdGVzLCBhbmQgYWxzbyBieSBKc1ZpZXdzIHRvIGJ1aWxkIGZ1bmN0aW9ucyBmb3IgZGF0YSBsaW5rIGV4cHJlc3Npb25zXG5cblx0Ly89PT09IG5lc3RlZCBmdW5jdGlvbnMgPT09PVxuXHRmdW5jdGlvbiBwdXNocHJlY2VkaW5nQ29udGVudChzaGlmdCkge1xuXHRcdHNoaWZ0IC09IGxvYztcblx0XHRpZiAoc2hpZnQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChtYXJrdXAuc3Vic3RyKGxvYywgc2hpZnQpLnJlcGxhY2Uock5ld0xpbmUsIFwiXFxcXG5cIikpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGJsb2NrVGFnQ2hlY2sodGFnTmFtZSwgYmxvY2spIHtcblx0XHRpZiAodGFnTmFtZSkge1xuXHRcdFx0dGFnTmFtZSArPSAnfX0nO1xuXHRcdFx0Ly9cdFx0XHQne3tpbmNsdWRlfX0gYmxvY2sgaGFzIHt7L2Zvcn19IHdpdGggbm8gb3BlbiB7e2Zvcn19J1xuXHRcdFx0c3ludGF4RXJyb3IoKFxuXHRcdFx0XHRibG9ja1xuXHRcdFx0XHRcdD8gJ3t7JyArIGJsb2NrICsgJ319IGJsb2NrIGhhcyB7ey8nICsgdGFnTmFtZSArICcgd2l0aG91dCB7eycgKyB0YWdOYW1lXG5cdFx0XHRcdFx0OiAnVW5tYXRjaGVkIG9yIG1pc3Npbmcge3svJyArIHRhZ05hbWUpICsgJywgaW4gdGVtcGxhdGU6XFxuJyArIG1hcmt1cCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcGFyc2VUYWcoYWxsLCBiaW5kLCB0YWdOYW1lLCBjb252ZXJ0ZXIsIGNvbG9uLCBodG1sLCBjb2RlVGFnLCBwYXJhbXMsIHNsYXNoLCBiaW5kMiwgY2xvc2VCbG9jaywgaW5kZXgpIHtcbi8qXG5cbiAgICAgYmluZCAgICAgdGFnTmFtZSAgICAgICAgIGN2dCAgIGNsbiBodG1sIGNvZGUgICAgcGFyYW1zICAgICAgICAgICAgc2xhc2ggICBiaW5kMiAgICAgICAgIGNsb3NlQmxrICBjb21tZW50XG4vKD86eyhcXF4pP3soPzooXFx3Kyg/PVtcXC9cXHN9XSkpfChcXHcrKT8oOil8KD4pfChcXCopKVxccyooKD86W159XXx9KD8hfSkpKj8pKFxcLyk/fHsoXFxeKT97KD86KD86XFwvKFxcdyspKVxccyp8IS0tW1xcc1xcU10qPy0tKSl9fS9nXG5cbig/OlxuICB7KFxcXik/eyAgICAgICAgICAgIGJpbmRcbiAgKD86XG4gICAgKFxcdysgICAgICAgICAgICAgdGFnTmFtZVxuICAgICAgKD89W1xcL1xcc31dKVxuICAgIClcbiAgICB8XG4gICAgKFxcdyspPyg6KSAgICAgICAgY29udmVydGVyIGNvbG9uXG4gICAgfFxuICAgICg+KSAgICAgICAgICAgICAgaHRtbFxuICAgIHxcbiAgICAoXFwqKSAgICAgICAgICAgICBjb2RlVGFnXG4gIClcbiAgXFxzKlxuICAoICAgICAgICAgICAgICAgICAgcGFyYW1zXG4gICAgKD86W159XXx9KD8hfSkpKj9cbiAgKVxuICAoXFwvKT8gICAgICAgICAgICAgIHNsYXNoXG4gIHxcbiAgeyhcXF4pP3sgICAgICAgICAgICBiaW5kMlxuICAoPzpcbiAgICAoPzpcXC8oXFx3KykpXFxzKiAgIGNsb3NlQmxvY2tcbiAgICB8XG4gICAgIS0tW1xcc1xcU10qPy0tICAgIGNvbW1lbnRcbiAgKVxuKVxufX0vZ1xuXG4qL1xuXHRcdGlmIChjb2RlVGFnICYmIGJpbmQgfHwgc2xhc2ggJiYgIXRhZ05hbWUgfHwgcGFyYW1zICYmIHBhcmFtcy5zbGljZSgtMSkgPT09IFwiOlwiIHx8IGJpbmQyKSB7XG5cdFx0XHRzeW50YXhFcnJvcihhbGwpO1xuXHRcdH1cblxuXHRcdC8vIEJ1aWxkIGFic3RyYWN0IHN5bnRheCB0cmVlIChBU1QpOiBbdGFnTmFtZSwgY29udmVydGVyLCBwYXJhbXMsIGNvbnRlbnQsIGhhc2gsIGJpbmRpbmdzLCBjb250ZW50TWFya3VwXVxuXHRcdGlmIChodG1sKSB7XG5cdFx0XHRjb2xvbiA9IFwiOlwiO1xuXHRcdFx0Y29udmVydGVyID0gSFRNTDtcblx0XHR9XG5cdFx0c2xhc2ggPSBzbGFzaCB8fCBpc0xpbmtFeHByICYmICFoYXNFbHNlO1xuXG5cdFx0dmFyIGxhdGUsIG9wZW5UYWdOYW1lLCBpc0xhdGVPYixcblx0XHRcdHBhdGhCaW5kaW5ncyA9IChiaW5kIHx8IGlzTGlua0V4cHIpICYmIFtbXV0sIC8vIHBhdGhCaW5kaW5ncyBpcyBhbiBhcnJheSBvZiBhcnJheXMgZm9yIGFyZyBiaW5kaW5ncyBhbmQgYSBoYXNoIG9mIGFycmF5cyBmb3IgcHJvcCBiaW5kaW5nc1xuXHRcdFx0cHJvcHMgPSBcIlwiLFxuXHRcdFx0YXJncyA9IFwiXCIsXG5cdFx0XHRjdHhQcm9wcyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNBcmdzID0gXCJcIixcblx0XHRcdHBhcmFtc1Byb3BzID0gXCJcIixcblx0XHRcdHBhcmFtc0N0eFByb3BzID0gXCJcIixcblx0XHRcdG9uRXJyb3IgPSBcIlwiLFxuXHRcdFx0dXNlVHJpZ2dlciA9IFwiXCIsXG5cdFx0XHQvLyBCbG9jayB0YWcgaWYgbm90IHNlbGYtY2xvc2luZyBhbmQgbm90IHt7On19IG9yIHt7Pn19IChzcGVjaWFsIGNhc2UpIGFuZCBub3QgYSBkYXRhLWxpbmsgZXhwcmVzc2lvblxuXHRcdFx0YmxvY2sgPSAhc2xhc2ggJiYgIWNvbG9uO1xuXG5cdFx0Ly89PT09IG5lc3RlZCBoZWxwZXIgZnVuY3Rpb24gPT09PVxuXHRcdHRhZ05hbWUgPSB0YWdOYW1lIHx8IChwYXJhbXMgPSBwYXJhbXMgfHwgXCIjZGF0YVwiLCBjb2xvbik7IC8vIHt7On19IGlzIGVxdWl2YWxlbnQgdG8ge3s6I2RhdGF9fVxuXHRcdHB1c2hwcmVjZWRpbmdDb250ZW50KGluZGV4KTtcblx0XHRsb2MgPSBpbmRleCArIGFsbC5sZW5ndGg7IC8vIGxvY2F0aW9uIG1hcmtlciAtIHBhcnNlZCB1cCB0byBoZXJlXG5cdFx0aWYgKGNvZGVUYWcpIHtcblx0XHRcdGlmIChhbGxvd0NvZGUpIHtcblx0XHRcdFx0Y29udGVudC5wdXNoKFtcIipcIiwgXCJcXG5cIiArIHBhcmFtcy5yZXBsYWNlKC9eOi8sIFwicmV0Kz0gXCIpLnJlcGxhY2UoclVuZXNjYXBlUXVvdGVzLCBcIiQxXCIpICsgXCI7XFxuXCJdKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHRhZ05hbWUpIHtcblx0XHRcdGlmICh0YWdOYW1lID09PSBcImVsc2VcIikge1xuXHRcdFx0XHRpZiAoclRlc3RFbHNlSWYudGVzdChwYXJhbXMpKSB7XG5cdFx0XHRcdFx0c3ludGF4RXJyb3IoJ0ZvciBcInt7ZWxzZSBpZiBleHByfX1cIiB1c2UgXCJ7e2Vsc2UgZXhwcn19XCInKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwYXRoQmluZGluZ3MgPSBjdXJyZW50WzldICYmIFtbXV07XG5cdFx0XHRcdGN1cnJlbnRbMTBdID0gbWFya3VwLnN1YnN0cmluZyhjdXJyZW50WzEwXSwgaW5kZXgpOyAvLyBjb250ZW50TWFya3VwIGZvciBibG9jayB0YWdcblx0XHRcdFx0b3BlblRhZ05hbWUgPSBjdXJyZW50WzExXSB8fCBjdXJyZW50WzBdIHx8IHN5bnRheEVycm9yKFwiTWlzbWF0Y2hlZDogXCIgKyBhbGwpO1xuXHRcdFx0XHQvLyBjdXJyZW50WzBdIGlzIHRhZ05hbWUsIGJ1dCBmb3Ige3tlbHNlfX0gbm9kZXMsIGN1cnJlbnRbMTFdIGlzIHRhZ05hbWUgb2YgcHJlY2VkaW5nIG9wZW4gdGFnXG5cdFx0XHRcdGN1cnJlbnQgPSBzdGFjay5wb3AoKTtcblx0XHRcdFx0Y29udGVudCA9IGN1cnJlbnRbMl07XG5cdFx0XHRcdGJsb2NrID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmIChwYXJhbXMpIHtcblx0XHRcdFx0Ly8gcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHBhcmFtcyBzdHJpbmcsIHRvIGF2b2lkIGNvbXBpbGVkIGNvZGUgZXJyb3JzIGZvciB1bnRlcm1pbmF0ZWQgc3RyaW5nc1xuXHRcdFx0XHRwYXJzZVBhcmFtcyhwYXJhbXMucmVwbGFjZShyTmV3TGluZSwgXCIgXCIpLCBwYXRoQmluZGluZ3MsIHRtcGwsIGlzTGlua0V4cHIpXG5cdFx0XHRcdFx0LnJlcGxhY2UockJ1aWxkSGFzaCwgZnVuY3Rpb24oYWxsLCBvbmVycm9yLCBpc0N0eFBybSwga2V5LCBrZXlUb2tlbiwga2V5VmFsdWUsIGFyZywgcGFyYW0pIHtcblx0XHRcdFx0XHRcdGlmIChrZXkgPT09IFwidGhpczpcIikge1xuXHRcdFx0XHRcdFx0XHRrZXlWYWx1ZSA9IFwidW5kZWZpbmVkXCI7IC8vIHRoaXM9c29tZS5wYXRoIGlzIGFsd2F5cyBhIHRvIHBhcmFtZXRlciAob25lLXdheSksIHNvIGRvbid0IG5lZWQgdG8gY29tcGlsZS9ldmFsdWF0ZSBzb21lLnBhdGggaW5pdGlhbGl6YXRpb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChwYXJhbSkge1xuXHRcdFx0XHRcdFx0XHRpc0xhdGVPYiA9IGlzTGF0ZU9iIHx8IHBhcmFtWzBdID09PSBcIkBcIjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGtleSA9IFwiJ1wiICsga2V5VG9rZW4gKyBcIic6XCI7XG5cdFx0XHRcdFx0XHRpZiAoYXJnKSB7XG5cdFx0XHRcdFx0XHRcdGFyZ3MgKz0gaXNDdHhQcm0gKyBrZXlWYWx1ZSArIFwiLFwiO1xuXHRcdFx0XHRcdFx0XHRwYXJhbXNBcmdzICs9IFwiJ1wiICsgcGFyYW0gKyBcIicsXCI7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGlzQ3R4UHJtKSB7IC8vIENvbnRleHR1YWwgcGFyYW1ldGVyLCB+Zm9vPWV4cHJcblx0XHRcdFx0XHRcdFx0Y3R4UHJvcHMgKz0ga2V5ICsgJ2ouX2NwKCcgKyBrZXlWYWx1ZSArICcsXCInICsgcGFyYW0gKyAnXCIsdmlldyksJztcblx0XHRcdFx0XHRcdFx0Ly8gQ29tcGlsZWQgY29kZSBmb3IgZXZhbHVhdGluZyB0YWdDdHggb24gYSB0YWcgd2lsbCBoYXZlOiBjdHg6eydmb28nOmouX2NwKGNvbXBpbGVkRXhwciwgXCJleHByXCIsIHZpZXcpfVxuXHRcdFx0XHRcdFx0XHRwYXJhbXNDdHhQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChvbmVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdG9uRXJyb3IgKz0ga2V5VmFsdWU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpZiAoa2V5VG9rZW4gPT09IFwidHJpZ2dlclwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0dXNlVHJpZ2dlciArPSBrZXlWYWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoa2V5VG9rZW4gPT09IFwibGF0ZVJlbmRlclwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0bGF0ZSA9IHBhcmFtICE9PSBcImZhbHNlXCI7IC8vIFJlbmRlciBhZnRlciBmaXJzdCBwYXNzXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cHJvcHMgKz0ga2V5ICsga2V5VmFsdWUgKyBcIixcIjtcblx0XHRcdFx0XHRcdFx0cGFyYW1zUHJvcHMgKz0ga2V5ICsgXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdFx0aGFzSGFuZGxlcnMgPSBoYXNIYW5kbGVycyB8fCBySGFzSGFuZGxlcnMudGVzdChrZXlUb2tlbik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gXCJcIjtcblx0XHRcdFx0XHR9KS5zbGljZSgwLCAtMSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwYXRoQmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzWzBdKSB7XG5cdFx0XHRcdHBhdGhCaW5kaW5ncy5wb3AoKTsgLy8gUmVtb3ZlIHRoZSBiaW5kaW5nIHRoYXQgd2FzIHByZXBhcmVkIGZvciBuZXh0IGFyZy4gKFRoZXJlIGlzIGFsd2F5cyBhbiBleHRyYSBvbmUgcmVhZHkpLlxuXHRcdFx0fVxuXG5cdFx0XHRuZXdOb2RlID0gW1xuXHRcdFx0XHRcdHRhZ05hbWUsXG5cdFx0XHRcdFx0Y29udmVydGVyIHx8ICEhY29udmVydEJhY2sgfHwgaGFzSGFuZGxlcnMgfHwgXCJcIixcblx0XHRcdFx0XHRibG9jayAmJiBbXSxcblx0XHRcdFx0XHRwYXJzZWRQYXJhbShwYXJhbXNBcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiJyNkYXRhJyxcIiA6IFwiXCIpLCBwYXJhbXNQcm9wcywgcGFyYW1zQ3R4UHJvcHMpLCAvLyB7ezp9fSBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRcdFx0XHRwYXJzZWRQYXJhbShhcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiZGF0YSxcIiA6IFwiXCIpLCBwcm9wcywgY3R4UHJvcHMpLFxuXHRcdFx0XHRcdG9uRXJyb3IsXG5cdFx0XHRcdFx0dXNlVHJpZ2dlcixcblx0XHRcdFx0XHRsYXRlLFxuXHRcdFx0XHRcdGlzTGF0ZU9iLFxuXHRcdFx0XHRcdHBhdGhCaW5kaW5ncyB8fCAwXG5cdFx0XHRcdF07XG5cdFx0XHRjb250ZW50LnB1c2gobmV3Tm9kZSk7XG5cdFx0XHRpZiAoYmxvY2spIHtcblx0XHRcdFx0c3RhY2sucHVzaChjdXJyZW50KTtcblx0XHRcdFx0Y3VycmVudCA9IG5ld05vZGU7XG5cdFx0XHRcdGN1cnJlbnRbMTBdID0gbG9jOyAvLyBTdG9yZSBjdXJyZW50IGxvY2F0aW9uIG9mIG9wZW4gdGFnLCB0byBiZSBhYmxlIHRvIGFkZCBjb250ZW50TWFya3VwIHdoZW4gd2UgcmVhY2ggY2xvc2luZyB0YWdcblx0XHRcdFx0Y3VycmVudFsxMV0gPSBvcGVuVGFnTmFtZTsgLy8gVXNlZCBmb3IgY2hlY2tpbmcgc3ludGF4IChtYXRjaGluZyBjbG9zZSB0YWcpXG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjbG9zZUJsb2NrKSB7XG5cdFx0XHRibG9ja1RhZ0NoZWNrKGNsb3NlQmxvY2sgIT09IGN1cnJlbnRbMF0gJiYgY2xvc2VCbG9jayAhPT0gY3VycmVudFsxMV0gJiYgY2xvc2VCbG9jaywgY3VycmVudFswXSk7IC8vIENoZWNrIG1hdGNoaW5nIGNsb3NlIHRhZyBuYW1lXG5cdFx0XHRjdXJyZW50WzEwXSA9IG1hcmt1cC5zdWJzdHJpbmcoY3VycmVudFsxMF0sIGluZGV4KTsgLy8gY29udGVudE1hcmt1cCBmb3IgYmxvY2sgdGFnXG5cdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0fVxuXHRcdGJsb2NrVGFnQ2hlY2soIWN1cnJlbnQgJiYgY2xvc2VCbG9jayk7XG5cdFx0Y29udGVudCA9IGN1cnJlbnRbMl07XG5cdH1cblx0Ly89PT09IC9lbmQgb2YgbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cblx0dmFyIGksIHJlc3VsdCwgbmV3Tm9kZSwgaGFzSGFuZGxlcnMsIGJpbmRpbmdzLFxuXHRcdGFsbG93Q29kZSA9ICRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgfHwgdG1wbCAmJiB0bXBsLmFsbG93Q29kZVxuXHRcdFx0fHwgJHZpZXdzU2V0dGluZ3MuYWxsb3dDb2RlID09PSB0cnVlLCAvLyBpbmNsdWRlIGRpcmVjdCBzZXR0aW5nIG9mIHNldHRpbmdzLmFsbG93Q29kZSB0cnVlIGZvciBiYWNrd2FyZCBjb21wYXQgb25seVxuXHRcdGFzdFRvcCA9IFtdLFxuXHRcdGxvYyA9IDAsXG5cdFx0c3RhY2sgPSBbXSxcblx0XHRjb250ZW50ID0gYXN0VG9wLFxuXHRcdGN1cnJlbnQgPSBbLCxhc3RUb3BdO1xuXG5cdGlmIChhbGxvd0NvZGUgJiYgdG1wbC5faXMpIHtcblx0XHR0bXBsLmFsbG93Q29kZSA9IGFsbG93Q29kZTtcblx0fVxuXG4vL1RPRE9cdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdOyAvLyBPbmx5IGNhY2hlIGlmIHRlbXBsYXRlIGlzIG5vdCBuYW1lZCBhbmQgbWFya3VwIGxlbmd0aCA8IC4uLixcbi8vYW5kIHRoZXJlIGFyZSBubyBiaW5kaW5ncyBvciBzdWJ0ZW1wbGF0ZXM/PyBDb25zaWRlciBzdGFuZGFyZCBvcHRpbWl6YXRpb24gZm9yIGRhdGEtbGluaz1cImEuYi5jXCJcbi8vXHRcdGlmIChyZXN1bHQpIHtcbi8vXHRcdFx0dG1wbC5mbiA9IHJlc3VsdDtcbi8vXHRcdH0gZWxzZSB7XG5cbi8vXHRcdHJlc3VsdCA9IG1hcmt1cDtcblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRpZiAoY29udmVydEJhY2sgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bWFya3VwID0gbWFya3VwLnNsaWNlKDAsIC1jb252ZXJ0QmFjay5sZW5ndGggLSAyKSArIGRlbGltQ2xvc2VDaGFyMDtcblx0XHR9XG5cdFx0bWFya3VwID0gZGVsaW1PcGVuQ2hhcjAgKyBtYXJrdXAgKyBkZWxpbUNsb3NlQ2hhcjE7XG5cdH1cblxuXHRibG9ja1RhZ0NoZWNrKHN0YWNrWzBdICYmIHN0YWNrWzBdWzJdLnBvcCgpWzBdKTtcblx0Ly8gQnVpbGQgdGhlIEFTVCAoYWJzdHJhY3Qgc3ludGF4IHRyZWUpIHVuZGVyIGFzdFRvcFxuXHRtYXJrdXAucmVwbGFjZShyVGFnLCBwYXJzZVRhZyk7XG5cblx0cHVzaHByZWNlZGluZ0NvbnRlbnQobWFya3VwLmxlbmd0aCk7XG5cblx0aWYgKGxvYyA9IGFzdFRvcFthc3RUb3AubGVuZ3RoIC0gMV0pIHtcblx0XHRibG9ja1RhZ0NoZWNrKHR5cGVvZiBsb2MgIT09IFNUUklORyAmJiAoK2xvY1sxMF0gPT09IGxvY1sxMF0pICYmIGxvY1swXSk7XG5cdH1cbi8vXHRcdFx0cmVzdWx0ID0gdG1wbEZuc0NhY2hlW21hcmt1cF0gPSBidWlsZENvZGUoYXN0VG9wLCB0bXBsKTtcbi8vXHRcdH1cblxuXHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdHJlc3VsdCA9IGJ1aWxkQ29kZShhc3RUb3AsIG1hcmt1cCwgaXNMaW5rRXhwcik7XG5cdFx0YmluZGluZ3MgPSBbXTtcblx0XHRpID0gYXN0VG9wLmxlbmd0aDtcblx0XHR3aGlsZSAoaS0tKSB7XG5cdFx0XHRiaW5kaW5ncy51bnNoaWZ0KGFzdFRvcFtpXVs5XSk7IC8vIFdpdGggZGF0YS1saW5rIGV4cHJlc3Npb25zLCBwYXRoQmluZGluZ3MgYXJyYXkgZm9yIHRhZ0N0eFtpXSBpcyBhc3RUb3BbaV1bOV1cblx0XHR9XG5cdFx0c2V0UGF0aHMocmVzdWx0LCBiaW5kaW5ncyk7XG5cdH0gZWxzZSB7XG5cdFx0cmVzdWx0ID0gYnVpbGRDb2RlKGFzdFRvcCwgdG1wbCk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gc2V0UGF0aHMoZm4sIHBhdGhzQXJyKSB7XG5cdHZhciBrZXksIHBhdGhzLFxuXHRcdGkgPSAwLFxuXHRcdGwgPSBwYXRoc0Fyci5sZW5ndGg7XG5cdGZuLmRlcHMgPSBbXTtcblx0Zm4ucGF0aHMgPSBbXTsgLy8gVGhlIGFycmF5IG9mIHBhdGggYmluZGluZyAoYXJyYXkvZGljdGlvbmFyeSlzIGZvciBlYWNoIHRhZy9lbHNlIGJsb2NrJ3MgYXJncyBhbmQgcHJvcHNcblx0Zm9yICg7IGkgPCBsOyBpKyspIHtcblx0XHRmbi5wYXRocy5wdXNoKHBhdGhzID0gcGF0aHNBcnJbaV0pO1xuXHRcdGZvciAoa2V5IGluIHBhdGhzKSB7XG5cdFx0XHRpZiAoa2V5ICE9PSBcIl9qc3Z0b1wiICYmIHBhdGhzLmhhc093blByb3BlcnR5KGtleSkgJiYgcGF0aHNba2V5XS5sZW5ndGggJiYgIXBhdGhzW2tleV0uc2twKSB7XG5cdFx0XHRcdGZuLmRlcHMgPSBmbi5kZXBzLmNvbmNhdChwYXRoc1trZXldKTsgLy8gZGVwcyBpcyB0aGUgY29uY2F0ZW5hdGlvbiBvZiB0aGUgcGF0aHMgYXJyYXlzIGZvciB0aGUgZGlmZmVyZW50IGJpbmRpbmdzXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHBhcnNlZFBhcmFtKGFyZ3MsIHByb3BzLCBjdHgpIHtcblx0cmV0dXJuIFthcmdzLnNsaWNlKDAsIC0xKSwgcHJvcHMuc2xpY2UoMCwgLTEpLCBjdHguc2xpY2UoMCwgLTEpXTtcbn1cblxuZnVuY3Rpb24gcGFyYW1TdHJ1Y3R1cmUocGFyYW1Db2RlLCBwYXJhbVZhbHMpIHtcblx0cmV0dXJuICdcXG5cXHRwYXJhbXM6e2FyZ3M6WycgKyBwYXJhbUNvZGVbMF0gKyAnXSxcXG5cXHRwcm9wczp7JyArIHBhcmFtQ29kZVsxXSArICd9J1xuXHRcdCsgKHBhcmFtQ29kZVsyXSA/ICcsXFxuXFx0Y3R4OnsnICsgcGFyYW1Db2RlWzJdICsgJ30nIDogXCJcIilcblx0XHQrICd9LFxcblxcdGFyZ3M6WycgKyBwYXJhbVZhbHNbMF0gKyAnXSxcXG5cXHRwcm9wczp7JyArIHBhcmFtVmFsc1sxXSArICd9J1xuXHRcdCsgKHBhcmFtVmFsc1syXSA/ICcsXFxuXFx0Y3R4OnsnICsgcGFyYW1WYWxzWzJdICsgJ30nIDogXCJcIik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUGFyYW1zKHBhcmFtcywgcGF0aEJpbmRpbmdzLCB0bXBsLCBpc0xpbmtFeHByKSB7XG5cblx0ZnVuY3Rpb24gcGFyc2VUb2tlbnMoYWxsLCBsZnRQcm4wLCBsZnRQcm4sIGJvdW5kLCBwYXRoLCBvcGVyYXRvciwgZXJyLCBlcSwgcGF0aDIsIGxhdGUsIHBybixcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbW1hLCBsZnRQcm4yLCBhcG9zLCBxdW90LCBydFBybiwgcnRQcm5Eb3QsIHBybjIsIHNwYWNlLCBpbmRleCwgZnVsbCkge1xuXHQvLyAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykofj9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18fig/IVtcXHckXSl8JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqPyhAKT9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfCg/OihcXCgpXFxzKik/XFxcXD8oPzooJyl8KFwiKSl8KD86XFxzKigoWylcXF1dKSg/PVsuXl18XFxzKiR8W14oW10pfFspXFxdXSkoWyhbXT8pKXwoXFxzKykvZyxcblx0Ly9sZnRQcm4wICAgICAgICAgICBsZnRQcm4gICAgICAgICBib3VuZCAgICAgcGF0aCAgICAgICAgICAgICAgIG9wZXJhdG9yICAgICBlcnIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcSAgICAgIHBhdGgyIGxhdGUgICAgICAgICAgICBwcm4gICAgICBjb21tYSAgbGZ0UHJuMiAgICAgICAgICBhcG9zIHF1b3QgICAgICAgIHJ0UHJuICBydFBybkRvdCAgICAgICAgICAgICAgICAgIHBybjIgICAgIHNwYWNlXG5cdC8vIChsZWZ0IHBhcmVuPyBmb2xsb3dlZCBieSAocGF0aD8gZm9sbG93ZWQgYnkgb3BlcmF0b3IpIG9yIChwYXRoIGZvbGxvd2VkIGJ5IHBhcmVuPykpIG9yIGNvbW1hIG9yIGFwb3Mgb3IgcXVvdCBvciByaWdodCBwYXJlbiBvciBzcGFjZVxuXG5cdFx0ZnVuY3Rpb24gcGFyc2VQYXRoKGFsbFBhdGgsIG5vdCwgb2JqZWN0LCBoZWxwZXIsIHZpZXcsIHZpZXdQcm9wZXJ0eSwgcGF0aFRva2VucywgbGVhZlRva2VuKSB7XG5cdFx0XHQvLyAvXighKj8pKD86bnVsbHx0cnVlfGZhbHNlfFxcZFtcXGQuXSp8KFtcXHckXSt8XFwufH4oW1xcdyRdKyl8Iyh2aWV3fChbXFx3JF0rKSk/KShbXFx3JC5eXSo/KSg/OlsuW15dKFtcXHckXSspXFxdPyk/KSQvZyxcblx0XHRcdC8vICAgIG5vdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgICAgIGhlbHBlciAgICB2aWV3ICB2aWV3UHJvcGVydHkgcGF0aFRva2VucyAgICAgIGxlYWZUb2tlblxuXHRcdFx0c3ViUGF0aCA9IG9iamVjdCA9PT0gXCIuXCI7XG5cdFx0XHRpZiAob2JqZWN0KSB7XG5cdFx0XHRcdHBhdGggPSBwYXRoLnNsaWNlKG5vdC5sZW5ndGgpO1xuXHRcdFx0XHRpZiAoL15cXC4/Y29uc3RydWN0b3IkLy50ZXN0KGxlYWZUb2tlbnx8cGF0aCkpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcihhbGxQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXN1YlBhdGgpIHtcblx0XHRcdFx0XHRhbGxQYXRoID0gKGxhdGUgLy8gbGF0ZSBwYXRoIEBhLmIuYzogbm90IHRocm93IG9uICdwcm9wZXJ0eSBvZiB1bmRlZmluZWQnIGlmIGEgdW5kZWZpbmVkLCBhbmQgd2lsbCB1c2UgX2dldE9iKCkgYWZ0ZXIgbGlua2luZyB0byByZXNvbHZlIGxhdGUuXG5cdFx0XHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAnJyA6ICcobHRPYi5sdD1sdE9iLmx0fHwnKSArICcob2I9J1xuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdCsgKGhlbHBlclxuXHRcdFx0XHRcdFx0XHQ/ICd2aWV3LmN0eFBybShcIicgKyBoZWxwZXIgKyAnXCIpJ1xuXHRcdFx0XHRcdFx0XHQ6IHZpZXdcblx0XHRcdFx0XHRcdFx0XHQ/IFwidmlld1wiXG5cdFx0XHRcdFx0XHRcdFx0OiBcImRhdGFcIilcblx0XHRcdFx0XHRcdCsgKGxhdGVcblx0XHRcdFx0XHRcdFx0PyAnKT09PXVuZGVmaW5lZCcgKyAoaXNMaW5rRXhwciA/ICcnIDogJyknKSArICc/XCJcIjp2aWV3Ll9nZXRPYihvYixcIidcblx0XHRcdFx0XHRcdFx0OiBcIlwiXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQrIChsZWFmVG9rZW5cblx0XHRcdFx0XHRcdFx0PyAodmlld1Byb3BlcnR5XG5cdFx0XHRcdFx0XHRcdFx0PyBcIi5cIiArIHZpZXdQcm9wZXJ0eVxuXHRcdFx0XHRcdFx0XHRcdDogaGVscGVyXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0XHRcdFx0XHRcdDogKHZpZXcgPyBcIlwiIDogXCIuXCIgKyBvYmplY3QpXG5cdFx0XHRcdFx0XHRcdFx0KSArIChwYXRoVG9rZW5zIHx8IFwiXCIpXG5cdFx0XHRcdFx0XHRcdDogKGxlYWZUb2tlbiA9IGhlbHBlciA/IFwiXCIgOiB2aWV3ID8gdmlld1Byb3BlcnR5IHx8IFwiXCIgOiBvYmplY3QsIFwiXCIpKTtcblx0XHRcdFx0XHRhbGxQYXRoID0gYWxsUGF0aCArIChsZWFmVG9rZW4gPyBcIi5cIiArIGxlYWZUb2tlbiA6IFwiXCIpO1xuXG5cdFx0XHRcdFx0YWxsUGF0aCA9IG5vdCArIChhbGxQYXRoLnNsaWNlKDAsIDkpID09PSBcInZpZXcuZGF0YVwiXG5cdFx0XHRcdFx0XHQ/IGFsbFBhdGguc2xpY2UoNSkgLy8gY29udmVydCAjdmlldy5kYXRhLi4uIHRvIGRhdGEuLi5cblx0XHRcdFx0XHRcdDogYWxsUGF0aClcblx0XHRcdFx0XHQrIChsYXRlXG5cdFx0XHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAnXCInOiAnXCIsbHRPYicpICsgKHBybiA/ICcsMSknOicpJylcblx0XHRcdFx0XHRcdFx0OiBcIlwiXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChiaW5kaW5ncykge1xuXHRcdFx0XHRcdGJpbmRzID0gbmFtZWQgPT09IFwiX2xpbmtUb1wiID8gKGJpbmR0byA9IHBhdGhCaW5kaW5ncy5fanN2dG8gPSBwYXRoQmluZGluZ3MuX2pzdnRvIHx8IFtdKSA6IGJuZEN0eC5iZDtcblx0XHRcdFx0XHRpZiAodGhlT2IgPSBzdWJQYXRoICYmIGJpbmRzW2JpbmRzLmxlbmd0aC0xXSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoZU9iLl9jcGZuKSB7IC8vIENvbXB1dGVkIHByb3BlcnR5IGV4cHJPYlxuXHRcdFx0XHRcdFx0XHR3aGlsZSAodGhlT2Iuc2IpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGVPYiA9IHRoZU9iLnNiO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICh0aGVPYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAodGhlT2IuYm5kKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRwYXRoID0gXCJeXCIgKyBwYXRoLnNsaWNlKDEpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR0aGVPYi5zYiA9IHBhdGg7XG5cdFx0XHRcdFx0XHRcdFx0dGhlT2IuYm5kID0gdGhlT2IuYm5kIHx8IHBhdGhbMF0gPT09IFwiXlwiO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGJpbmRzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChwcm4gJiYgIXN1YlBhdGgpIHtcblx0XHRcdFx0XHRcdHBhdGhTdGFydFtmbkRwXSA9IGluZDtcblx0XHRcdFx0XHRcdGNvbXBpbGVkUGF0aFN0YXJ0W2ZuRHBdID0gY29tcGlsZWRQYXRoW2ZuRHBdLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBhbGxQYXRoO1xuXHRcdH1cblxuXHRcdC8vYm91bmQgPSBiaW5kaW5ncyAmJiBib3VuZDtcblx0XHRpZiAoYm91bmQgJiYgIWVxKSB7XG5cdFx0XHRwYXRoID0gYm91bmQgKyBwYXRoOyAvLyBlLmcuIHNvbWUuZm4oLi4uKV5zb21lLnBhdGggLSBzbyBoZXJlIHBhdGggaXMgXCJec29tZS5wYXRoXCJcblx0XHR9XG5cdFx0b3BlcmF0b3IgPSBvcGVyYXRvciB8fCBcIlwiO1xuXHRcdGxmdFBybjIgPSBsZnRQcm4yIHx8IFwiXCI7XG5cdFx0bGZ0UHJuID0gbGZ0UHJuIHx8IGxmdFBybjAgfHwgbGZ0UHJuMjtcblx0XHRwYXRoID0gcGF0aCB8fCBwYXRoMjtcblxuXHRcdGlmIChsYXRlICYmIChsYXRlID0gIS9cXCl8XS8udGVzdChmdWxsW2luZGV4LTFdKSkpIHtcblx0XHRcdHBhdGggPSBwYXRoLnNsaWNlKDEpLnNwbGl0KFwiLlwiKS5qb2luKFwiXlwiKTsgLy8gTGF0ZSBwYXRoIEB6LmIuYy4gVXNlIFwiXlwiIHJhdGhlciB0aGFuIFwiLlwiIHRvIGVuc3VyZSB0aGF0IGRlZXAgYmluZGluZyB3aWxsIGJlIHVzZWRcblx0XHR9XG5cdFx0Ly8gQ291bGQgZG8gdGhpcyAtIGJ1dCBub3Qgd29ydGggcGVyZiBjb3N0Pz8gOi1cblx0XHQvLyBpZiAoIXBhdGgubGFzdEluZGV4T2YoXCIjZGF0YS5cIiwgMCkpIHsgcGF0aCA9IHBhdGguc2xpY2UoNik7IH0gLy8gSWYgcGF0aCBzdGFydHMgd2l0aCBcIiNkYXRhLlwiLCByZW1vdmUgdGhhdC5cblx0XHRwcm4gPSBwcm4gfHwgcHJuMiB8fCBcIlwiO1xuXHRcdHZhciBleHByLCBiaW5kcywgdGhlT2IsIG5ld09iLCBzdWJQYXRoLCBsZnRQcm5GQ2FsbCwgcmV0LFxuXHRcdFx0aW5kID0gaW5kZXg7XG5cblx0XHRpZiAoIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdHN5bnRheEVycm9yKHBhcmFtcyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAocnRQcm5Eb3QgJiYgYmluZGluZ3MpIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBhIGJpbmRpbmcgdG8gYSBwYXRoIGluIHdoaWNoIGFuIG9iamVjdCBpcyByZXR1cm5lZCBieSBhIGhlbHBlci9kYXRhIGZ1bmN0aW9uL2V4cHJlc3Npb24sIGUuZy4gZm9vKCleeC55IG9yIChhP2I6YyleeC55XG5cdFx0XHRcdC8vIFdlIGNyZWF0ZSBhIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIGdldCB0aGUgb2JqZWN0IGluc3RhbmNlICh3aGljaCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBkZXBlbmRlbnQgZGF0YSBvZiB0aGUgc3ViZXhwcmVzc2lvbiBjaGFuZ2VzLFxuXHRcdFx0XHQvLyB0byByZXR1cm4gdGhlIG5ldyBvYmplY3QsIGFuZCB0cmlnZ2VyIHJlLWJpbmRpbmcgb2YgdGhlIHN1YnNlcXVlbnQgcGF0aClcblx0XHRcdFx0ZXhwciA9IHBhdGhTdGFydFtmbkRwLTFdO1xuXHRcdFx0XHRpZiAoZnVsbC5sZW5ndGggLSAxID4gaW5kIC0gKGV4cHIgfHwgMCkpIHsgLy8gV2UgbmVlZCB0byBjb21waWxlIGEgc3ViZXhwcmVzc2lvblxuXHRcdFx0XHRcdGV4cHIgPSAkLnRyaW0oZnVsbC5zbGljZShleHByLCBpbmQgKyBhbGwubGVuZ3RoKSk7XG5cdFx0XHRcdFx0YmluZHMgPSBiaW5kdG8gfHwgYm5kU3RhY2tbZm5EcC0xXS5iZDtcblx0XHRcdFx0XHQvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdHRoZU9iID0gYmluZHNbYmluZHMubGVuZ3RoLTFdO1xuXHRcdFx0XHRcdGlmICh0aGVPYiAmJiB0aGVPYi5wcm0pIHtcblx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYiAmJiB0aGVPYi5zYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0dGhlT2IgPSB0aGVPYi5zYjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG5ld09iID0gdGhlT2Iuc2IgPSB7cGF0aDogdGhlT2Iuc2IsIGJuZDogdGhlT2IuYm5kfTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YmluZHMucHVzaChuZXdPYiA9IHtwYXRoOiBiaW5kcy5wb3AoKX0pOyAvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhlT2IgJiYgdGhlT2Iuc2IgPT09IG5ld09iKSB7XG5cdFx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gPSBjb21waWxlZFBhdGhbZm5EcC0xXS5zbGljZSh0aGVPYi5fY3BQdGhTdCkgKyBjb21waWxlZFBhdGhbZm5EcF07XG5cdFx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcC0xXSA9IGNvbXBpbGVkUGF0aFtmbkRwLTFdLnNsaWNlKDAsIHRoZU9iLl9jcFB0aFN0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV3T2IuX2NwUHRoU3QgPSBjb21waWxlZFBhdGhTdGFydFtmbkRwLTFdO1xuXHRcdFx0XHRcdG5ld09iLl9jcEtleSA9IGV4cHI7XG5cblx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gKz0gZnVsbC5zbGljZShwcmV2SW5kZXgsIGluZGV4KTtcblx0XHRcdFx0XHRwcmV2SW5kZXggPSBpbmRleDtcblxuXHRcdFx0XHRcdG5ld09iLl9jcGZuID0gY3BGblN0b3JlW2V4cHJdID0gY3BGblN0b3JlW2V4cHJdIHx8IC8vIENvbXBpbGVkIGZ1bmN0aW9uIGZvciBjb21wdXRlZCB2YWx1ZTogZ2V0IGZyb20gc3RvcmUsIG9yIGNvbXBpbGUgYW5kIHN0b3JlXG5cdFx0XHRcdFx0XHRuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsalwiLCAvLyBDb21waWxlZCBmdW5jdGlvbiBmb3IgY29tcHV0ZWQgdmFsdWUgaW4gdGVtcGxhdGVcblx0XHRcdFx0XHRcIi8vXCIgKyBleHByICsgXCJcXG52YXIgdjtcXG5yZXR1cm4gKCh2PVwiICsgY29tcGlsZWRQYXRoW2ZuRHBdICsgKHJ0UHJuID09PSBcIl1cIiA/IFwiKV1cIiA6IHJ0UHJuKSArIFwiKSE9bnVsbD92Om51bGwpO1wiKTtcblxuXHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwLTFdICs9IChmbkNhbGxbcHJuRHBdICYmICRzdWJTZXR0aW5nc0FkdmFuY2VkLmNhY2hlID8gXCJ2aWV3LmdldENhY2hlKFxcXCJcIiArIGV4cHIucmVwbGFjZShyRXNjYXBlUXVvdGVzLCBcIlxcXFwkJlwiKSArIFwiXFxcIlwiIDogY29tcGlsZWRQYXRoW2ZuRHBdKTtcblxuXHRcdFx0XHRcdG5ld09iLnBybSA9IGJuZEN0eC5iZDtcblx0XHRcdFx0XHRuZXdPYi5ibmQgPSBuZXdPYi5ibmQgfHwgbmV3T2IucGF0aCAmJiBuZXdPYi5wYXRoLmluZGV4T2YoXCJeXCIpID49IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHBdID0gXCJcIjtcblx0XHRcdH1cblx0XHRcdGlmIChwcm4gPT09IFwiW1wiKSB7XG5cdFx0XHRcdHBybiA9IFwiW2ouX3NxKFwiO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGxmdFBybiA9PT0gXCJbXCIpIHtcblx0XHRcdFx0bGZ0UHJuID0gXCJbai5fc3EoXCI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldCA9IChhcG9zZWRcblx0XHRcdC8vIHdpdGhpbiBzaW5nbGUtcXVvdGVkIHN0cmluZ1xuXHRcdFx0PyAoYXBvc2VkID0gIWFwb3MsIChhcG9zZWQgPyBhbGwgOiBsZnRQcm4yICsgJ1wiJykpXG5cdFx0XHQ6IHF1b3RlZFxuXHRcdFx0Ly8gd2l0aGluIGRvdWJsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHRcdD8gKHF1b3RlZCA9ICFxdW90LCAocXVvdGVkID8gYWxsIDogbGZ0UHJuMiArICdcIicpKVxuXHRcdFx0XHQ6XG5cdFx0XHQoXG5cdFx0XHRcdChsZnRQcm5cblx0XHRcdFx0XHQ/IChcblx0XHRcdFx0XHRcdHByblN0YWNrWysrcHJuRHBdID0gdHJ1ZSxcblx0XHRcdFx0XHRcdHBybkluZFtwcm5EcF0gPSAwLFxuXHRcdFx0XHRcdFx0YmluZGluZ3MgJiYgKFxuXHRcdFx0XHRcdFx0XHRwYXRoU3RhcnRbZm5EcCsrXSA9IGluZCsrLFxuXHRcdFx0XHRcdFx0XHRibmRDdHggPSBibmRTdGFja1tmbkRwXSA9IHtiZDogW119LFxuXHRcdFx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gPSBcIlwiLFxuXHRcdFx0XHRcdFx0XHRjb21waWxlZFBhdGhTdGFydFtmbkRwXSA9IDFcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRsZnRQcm4pIC8vIExlZnQgcGFyZW4sIChub3QgYSBmdW5jdGlvbiBjYWxsIHBhcmVuKVxuXHRcdFx0XHRcdDogXCJcIilcblx0XHRcdFx0KyAoc3BhY2Vcblx0XHRcdFx0XHQ/IChwcm5EcFxuXHRcdFx0XHRcdFx0PyBcIlwiIC8vIEEgc3BhY2Ugd2l0aGluIHBhcmVucyBvciB3aXRoaW4gZnVuY3Rpb24gY2FsbCBwYXJlbnMsIHNvIG5vdCBhIHNlcGFyYXRvciBmb3IgdGFnIGFyZ3Ncblx0XHRcdC8vIE5ldyBhcmcgb3IgcHJvcCAtIHNvIGluc2VydCBiYWNrc3BhY2UgXFxiIChcXHgwOCkgYXMgc2VwYXJhdG9yIGZvciBuYW1lZCBwYXJhbXMsIHVzZWQgc3Vic2VxdWVudGx5IGJ5IHJCdWlsZEhhc2gsIGFuZCBwcmVwYXJlIG5ldyBiaW5kaW5ncyBhcnJheVxuXHRcdFx0XHRcdFx0OiAocGFyYW1JbmRleCA9IGZ1bGwuc2xpY2UocGFyYW1JbmRleCwgaW5kKSwgbmFtZWRcblx0XHRcdFx0XHRcdFx0PyAobmFtZWQgPSBib3VuZE5hbWUgPSBiaW5kdG8gPSBmYWxzZSwgXCJcXGJcIilcblx0XHRcdFx0XHRcdFx0OiBcIlxcYixcIikgKyBwYXJhbUluZGV4ICsgKHBhcmFtSW5kZXggPSBpbmQgKyBhbGwubGVuZ3RoLCBiaW5kaW5ncyAmJiBwYXRoQmluZGluZ3MucHVzaChibmRDdHguYmQgPSBbXSksIFwiXFxiXCIpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRcdDogZXFcblx0XHRcdC8vIG5hbWVkIHBhcmFtLiBSZW1vdmUgYmluZGluZ3MgZm9yIGFyZyBhbmQgY3JlYXRlIGluc3RlYWQgYmluZGluZ3MgYXJyYXkgZm9yIHByb3Bcblx0XHRcdFx0XHRcdD8gKGZuRHAgJiYgc3ludGF4RXJyb3IocGFyYW1zKSwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnBvcCgpLCBuYW1lZCA9IFwiX1wiICsgcGF0aCwgYm91bmROYW1lID0gYm91bmQsIHBhcmFtSW5kZXggPSBpbmQgKyBhbGwubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRcdGJpbmRpbmdzICYmICgoYmluZGluZ3MgPSBibmRDdHguYmQgPSBwYXRoQmluZGluZ3NbbmFtZWRdID0gW10pLCBiaW5kaW5ncy5za3AgPSAhYm91bmQpLCBwYXRoICsgJzonKVxuXHRcdFx0XHRcdFx0OiBwYXRoXG5cdFx0XHQvLyBwYXRoXG5cdFx0XHRcdFx0XHRcdD8gKHBhdGguc3BsaXQoXCJeXCIpLmpvaW4oXCIuXCIpLnJlcGxhY2UoJHN1Yi5yUGF0aCwgcGFyc2VQYXRoKVxuXHRcdFx0XHRcdFx0XHRcdCsgKHBybiB8fCBvcGVyYXRvcilcblx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHQ6IG9wZXJhdG9yXG5cdFx0XHQvLyBvcGVyYXRvclxuXHRcdFx0XHRcdFx0XHRcdD8gb3BlcmF0b3Jcblx0XHRcdFx0XHRcdFx0XHQ6IHJ0UHJuXG5cdFx0XHQvLyBmdW5jdGlvblxuXHRcdFx0XHRcdFx0XHRcdFx0PyBydFBybiA9PT0gXCJdXCIgPyBcIildXCIgOiBcIilcIlxuXHRcdFx0XHRcdFx0XHRcdFx0OiBjb21tYVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ/IChmbkNhbGxbcHJuRHBdIHx8IHN5bnRheEVycm9yKHBhcmFtcyksIFwiLFwiKSAvLyBXZSBkb24ndCBhbGxvdyB0b3AtbGV2ZWwgbGl0ZXJhbCBhcnJheXMgb3Igb2JqZWN0c1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGxmdFBybjBcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IChhcG9zZWQgPSBhcG9zLCBxdW90ZWQgPSBxdW90LCAnXCInKVxuXHRcdFx0KSlcblx0XHQpO1xuXG5cdFx0aWYgKCFhcG9zZWQgJiYgIXF1b3RlZCkge1xuXHRcdFx0aWYgKHJ0UHJuKSB7XG5cdFx0XHRcdGZuQ2FsbFtwcm5EcF0gPSBmYWxzZTtcblx0XHRcdFx0cHJuRHAtLTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYmluZGluZ3MpIHtcblx0XHRcdGlmICghYXBvc2VkICYmICFxdW90ZWQpIHtcblx0XHRcdFx0aWYgKHJ0UHJuKSB7XG5cdFx0XHRcdFx0aWYgKHByblN0YWNrW3BybkRwKzFdKSB7XG5cdFx0XHRcdFx0XHRibmRDdHggPSBibmRTdGFja1stLWZuRHBdO1xuXHRcdFx0XHRcdFx0cHJuU3RhY2tbcHJuRHArMV0gPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJuU3RhcnQgPSBwcm5JbmRbcHJuRHArMV07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHBybikge1xuXHRcdFx0XHRcdHBybkluZFtwcm5EcCsxXSA9IGNvbXBpbGVkUGF0aFtmbkRwXS5sZW5ndGggKyAobGZ0UHJuID8gMSA6IDApO1xuXHRcdFx0XHRcdGlmIChwYXRoIHx8IHJ0UHJuKSB7XG5cdFx0XHRcdFx0XHRibmRDdHggPSBibmRTdGFja1srK2ZuRHBdID0ge2JkOiBbXX07XG5cdFx0XHRcdFx0XHRwcm5TdGFja1twcm5EcCsxXSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSA9IChjb21waWxlZFBhdGhbZm5EcF18fFwiXCIpICsgZnVsbC5zbGljZShwcmV2SW5kZXgsIGluZGV4KTtcblx0XHRcdHByZXZJbmRleCA9IGluZGV4K2FsbC5sZW5ndGg7XG5cblx0XHRcdGlmICghYXBvc2VkICYmICFxdW90ZWQpIHtcblx0XHRcdFx0aWYgKGxmdFBybkZDYWxsID0gbGZ0UHJuICYmIHByblN0YWNrW3BybkRwKzFdKSB7XG5cdFx0XHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHAtMV0gKz0gbGZ0UHJuO1xuXHRcdFx0XHRcdGNvbXBpbGVkUGF0aFN0YXJ0W2ZuRHAtMV0rKztcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocHJuID09PSBcIihcIiAmJiBzdWJQYXRoICYmICFuZXdPYikge1xuXHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSA9IGNvbXBpbGVkUGF0aFtmbkRwLTFdLnNsaWNlKHByblN0YXJ0KSArIGNvbXBpbGVkUGF0aFtmbkRwXTtcblx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcC0xXSA9IGNvbXBpbGVkUGF0aFtmbkRwLTFdLnNsaWNlKDAsIHByblN0YXJ0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHBdICs9IGxmdFBybkZDYWxsID8gcmV0LnNsaWNlKDEpIDogcmV0O1xuXHRcdH1cblxuXHRcdGlmICghYXBvc2VkICYmICFxdW90ZWQgJiYgcHJuKSB7XG5cdFx0XHRwcm5EcCsrO1xuXHRcdFx0aWYgKHBhdGggJiYgcHJuID09PSBcIihcIikge1xuXHRcdFx0XHRmbkNhbGxbcHJuRHBdID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWFwb3NlZCAmJiAhcXVvdGVkICYmIHBybjIpIHtcblx0XHRcdGlmIChiaW5kaW5ncykge1xuXHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gKz0gcHJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0ICs9IHBybjtcblx0XHR9XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHZhciBuYW1lZCwgYmluZHRvLCBib3VuZE5hbWUsIHJlc3VsdCxcblx0XHRxdW90ZWQsIC8vIGJvb2xlYW4gZm9yIHN0cmluZyBjb250ZW50IGluIGRvdWJsZSBxdW90ZXNcblx0XHRhcG9zZWQsIC8vIG9yIGluIHNpbmdsZSBxdW90ZXNcblx0XHRiaW5kaW5ncyA9IHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0sIC8vIGJpbmRpbmdzIGFycmF5IGZvciB0aGUgZmlyc3QgYXJnXG5cdFx0Ym5kQ3R4ID0ge2JkOiBiaW5kaW5nc30sXG5cdFx0Ym5kU3RhY2sgPSB7MDogYm5kQ3R4fSxcblx0XHRwYXJhbUluZGV4ID0gMCwgLy8gbGlzdCxcblx0XHQvLyBUaGUgZm9sbG93aW5nIGFyZSB1c2VkIGZvciB0cmFja2luZyBwYXRoIHBhcnNpbmcgaW5jbHVkaW5nIG5lc3RlZCBwYXRocywgc3VjaCBhcyBcImEuYihjXmQgKyAoZSkpXmZcIiwgYW5kIGNoYWluZWQgY29tcHV0ZWQgcGF0aHMgc3VjaCBhc1xuXHRcdC8vIFwiYS5iKCkuY15kKCkuZS5mKCkuZ1wiIC0gd2hpY2ggaGFzIGZvdXIgY2hhaW5lZCBwYXRocywgXCJhLmIoKVwiLCBcIl5jLmQoKVwiLCBcIi5lLmYoKVwiIGFuZCBcIi5nXCJcblx0XHRwcm5EcCA9IDAsICAgICAvLyBGb3IgdHJhY2tpbmcgcGFyZW4gZGVwdGggKG5vdCBmdW5jdGlvbiBjYWxsIHBhcmVucylcblx0XHRmbkRwID0gMCwgICAgICAvLyBGb3IgdHJhY2tpbmcgZGVwdGggb2YgZnVuY3Rpb24gY2FsbCBwYXJlbnNcblx0XHRwcm5JbmQgPSB7fSwgICAvLyBXZSBhcmUgaW4gYSBmdW5jdGlvbiBjYWxsXG5cdFx0cHJuU3RhcnQgPSAwLCAgLy8gdHJhY2tzIHRoZSBzdGFydCBvZiB0aGUgY3VycmVudCBwYXRoIHN1Y2ggYXMgY15kKCkgaW4gdGhlIGFib3ZlIGV4YW1wbGVcblx0XHRwcm5TdGFjayA9IHt9LCAvLyB0cmFja3MgcGFyZW5zIHdoaWNoIGFyZSBub3QgZnVuY3Rpb24gY2FsbHMsIGFuZCBzbyBhcmUgYXNzb2NpYXRlZCB3aXRoIG5ldyBibmRTdGFjayBjb250ZXh0c1xuXHRcdGZuQ2FsbCA9IHt9LCAgIC8vIFdlIGFyZSBpbiBhIGZ1bmN0aW9uIGNhbGxcblx0XHRwYXRoU3RhcnQgPSB7fSwvLyB0cmFja3MgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHBhdGggc3VjaCBhcyBjXmQoKSBpbiB0aGUgYWJvdmUgZXhhbXBsZVxuXHRcdGNvbXBpbGVkUGF0aFN0YXJ0ID0gezA6IDB9LFxuXHRcdGNvbXBpbGVkUGF0aCA9IHswOlwiXCJ9LFxuXHRcdHByZXZJbmRleCA9IDA7XG5cblx0aWYgKHBhcmFtc1swXSA9PT0gXCJAXCIpIHtcblx0XHRwYXJhbXMgPSBwYXJhbXMucmVwbGFjZShyQnJhY2tldFF1b3RlLCBcIi5cIik7XG5cdH1cblx0cmVzdWx0ID0gKHBhcmFtcyArICh0bXBsID8gXCIgXCIgOiBcIlwiKSkucmVwbGFjZSgkc3ViLnJQcm0sIHBhcnNlVG9rZW5zKTtcblxuXHRpZiAoYmluZGluZ3MpIHtcblx0XHRyZXN1bHQgPSBjb21waWxlZFBhdGhbMF07XG5cdH1cblxuXHRyZXR1cm4gIXBybkRwICYmIHJlc3VsdCB8fCBzeW50YXhFcnJvcihwYXJhbXMpOyAvLyBTeW50YXggZXJyb3IgaWYgdW5iYWxhbmNlZCBwYXJlbnMgaW4gcGFyYW1zIGV4cHJlc3Npb25cbn1cblxuZnVuY3Rpb24gYnVpbGRDb2RlKGFzdCwgdG1wbCwgaXNMaW5rRXhwcikge1xuXHQvLyBCdWlsZCB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gY29kZSBmcm9tIHRoZSBBU1Qgbm9kZXMsIGFuZCBzZXQgYXMgcHJvcGVydHkgb24gdGhlIHBhc3NlZC1pbiB0ZW1wbGF0ZSBvYmplY3Rcblx0Ly8gVXNlZCBmb3IgY29tcGlsaW5nIHRlbXBsYXRlcywgYW5kIGFsc28gYnkgSnNWaWV3cyB0byBidWlsZCBmdW5jdGlvbnMgZm9yIGRhdGEgbGluayBleHByZXNzaW9uc1xuXHR2YXIgaSwgbm9kZSwgdGFnTmFtZSwgY29udmVydGVyLCB0YWdDdHgsIGhhc1RhZywgaGFzRW5jb2RlciwgZ2V0c1ZhbCwgaGFzQ252dCwgdXNlQ252dCwgdG1wbEJpbmRpbmdzLCBwYXRoQmluZGluZ3MsIHBhcmFtcywgYm91bmRPbkVyclN0YXJ0LFxuXHRcdGJvdW5kT25FcnJFbmQsIHRhZ1JlbmRlciwgbmVzdGVkVG1wbHMsIHRtcGxOYW1lLCBuZXN0ZWRUbXBsLCB0YWdBbmRFbHNlcywgY29udGVudCwgbWFya3VwLCBuZXh0SXNFbHNlLCBvbGRDb2RlLCBpc0Vsc2UsIGlzR2V0VmFsLCB0YWdDdHhGbixcblx0XHRvbkVycm9yLCB0YWdTdGFydCwgdHJpZ2dlciwgbGF0ZVJlbmRlciwgcmV0U3RyT3BlbiwgcmV0U3RyQ2xvc2UsXG5cdFx0dG1wbEJpbmRpbmdLZXkgPSAwLFxuXHRcdHVzZVZpZXdzID0gJHN1YlNldHRpbmdzQWR2YW5jZWQudXNlVmlld3MgfHwgdG1wbC51c2VWaWV3cyB8fCB0bXBsLnRhZ3MgfHwgdG1wbC50ZW1wbGF0ZXMgfHwgdG1wbC5oZWxwZXJzIHx8IHRtcGwuY29udmVydGVycyxcblx0XHRjb2RlID0gXCJcIixcblx0XHR0bXBsT3B0aW9ucyA9IHt9LFxuXHRcdGwgPSBhc3QubGVuZ3RoO1xuXG5cdGlmICh0eXBlb2YgdG1wbCA9PT0gU1RSSU5HKSB7XG5cdFx0dG1wbE5hbWUgPSBpc0xpbmtFeHByID8gJ2RhdGEtbGluaz1cIicgKyB0bXBsLnJlcGxhY2Uock5ld0xpbmUsIFwiIFwiKS5zbGljZSgxLCAtMSkgKyAnXCInIDogdG1wbDtcblx0XHR0bXBsID0gMDtcblx0fSBlbHNlIHtcblx0XHR0bXBsTmFtZSA9IHRtcGwudG1wbE5hbWUgfHwgXCJ1bm5hbWVkXCI7XG5cdFx0aWYgKHRtcGwuYWxsb3dDb2RlKSB7XG5cdFx0XHR0bXBsT3B0aW9ucy5hbGxvd0NvZGUgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAodG1wbC5kZWJ1Zykge1xuXHRcdFx0dG1wbE9wdGlvbnMuZGVidWcgPSB0cnVlO1xuXHRcdH1cblx0XHR0bXBsQmluZGluZ3MgPSB0bXBsLmJuZHM7XG5cdFx0bmVzdGVkVG1wbHMgPSB0bXBsLnRtcGxzO1xuXHR9XG5cdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcblx0XHQvLyBBU1Qgbm9kZXM6IFswOiB0YWdOYW1lLCAxOiBjb252ZXJ0ZXIsIDI6IGNvbnRlbnQsIDM6IHBhcmFtcywgNDogY29kZSwgNTogb25FcnJvciwgNjogdHJpZ2dlciwgNzpwYXRoQmluZGluZ3MsIDg6IGNvbnRlbnRNYXJrdXBdXG5cdFx0bm9kZSA9IGFzdFtpXTtcblxuXHRcdC8vIEFkZCBuZXdsaW5lIGZvciBlYWNoIGNhbGxvdXQgdG8gdCgpIGMoKSBldGMuIGFuZCBlYWNoIG1hcmt1cCBzdHJpbmdcblx0XHRpZiAodHlwZW9mIG5vZGUgPT09IFNUUklORykge1xuXHRcdFx0Ly8gYSBtYXJrdXAgc3RyaW5nIHRvIGJlIGluc2VydGVkXG5cdFx0XHRjb2RlICs9ICcrXCInICsgbm9kZSArICdcIic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGEgY29tcGlsZWQgdGFnIGV4cHJlc3Npb24gdG8gYmUgaW5zZXJ0ZWRcblx0XHRcdHRhZ05hbWUgPSBub2RlWzBdO1xuXHRcdFx0aWYgKHRhZ05hbWUgPT09IFwiKlwiKSB7XG5cdFx0XHRcdC8vIENvZGUgdGFnOiB7eyogfX1cblx0XHRcdFx0Y29kZSArPSBcIjtcXG5cIiArIG5vZGVbMV0gKyBcIlxcbnJldD1yZXRcIjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnZlcnRlciA9IG5vZGVbMV07XG5cdFx0XHRcdGNvbnRlbnQgPSAhaXNMaW5rRXhwciAmJiBub2RlWzJdO1xuXHRcdFx0XHR0YWdDdHggPSBwYXJhbVN0cnVjdHVyZShub2RlWzNdLCBwYXJhbXMgPSBub2RlWzRdKTtcblx0XHRcdFx0dHJpZ2dlciA9IG5vZGVbNl07XG5cdFx0XHRcdGxhdGVSZW5kZXIgPSBub2RlWzddO1xuXHRcdFx0XHRpZiAobm9kZVs4XSkgeyAvLyBsYXRlUGF0aCBAYS5iLmMgb3IgQH5hLmIuY1xuXHRcdFx0XHRcdHJldFN0ck9wZW4gPSBcIlxcbnZhciBvYixsdE9iPXt9LGN0eHM9XCI7XG5cdFx0XHRcdFx0cmV0U3RyQ2xvc2UgPSBcIjtcXG5jdHhzLmx0PWx0T2IubHQ7XFxucmV0dXJuIGN0eHM7XCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0U3RyT3BlbiA9IFwiXFxucmV0dXJuIFwiO1xuXHRcdFx0XHRcdHJldFN0ckNsb3NlID0gXCJcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXJrdXAgPSBub2RlWzEwXSAmJiBub2RlWzEwXS5yZXBsYWNlKHJVbmVzY2FwZVF1b3RlcywgXCIkMVwiKTtcblx0XHRcdFx0aWYgKGlzRWxzZSA9IHRhZ05hbWUgPT09IFwiZWxzZVwiKSB7XG5cdFx0XHRcdFx0aWYgKHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0cGF0aEJpbmRpbmdzLnB1c2gobm9kZVs5XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG9uRXJyb3IgPSBub2RlWzVdIHx8ICRzdWJTZXR0aW5ncy5kZWJ1Z01vZGUgIT09IGZhbHNlICYmIFwidW5kZWZpbmVkXCI7IC8vIElmIGRlYnVnTW9kZSBub3QgZmFsc2UsIHNldCBkZWZhdWx0IG9uRXJyb3IgaGFuZGxlciBvbiB0YWcgdG8gXCJ1bmRlZmluZWRcIiAoc2VlIG9uUmVuZGVyRXJyb3IpXG5cdFx0XHRcdFx0aWYgKHRtcGxCaW5kaW5ncyAmJiAocGF0aEJpbmRpbmdzID0gbm9kZVs5XSkpIHsgLy8gQXJyYXkgb2YgcGF0aHMsIG9yIGZhbHNlIGlmIG5vdCBkYXRhLWJvdW5kXG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSBbcGF0aEJpbmRpbmdzXTtcblx0XHRcdFx0XHRcdHRtcGxCaW5kaW5nS2V5ID0gdG1wbEJpbmRpbmdzLnB1c2goMSk7IC8vIEFkZCBwbGFjZWhvbGRlciBpbiB0bXBsQmluZGluZ3MgZm9yIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHVzZVZpZXdzID0gdXNlVmlld3MgfHwgcGFyYW1zWzFdIHx8IHBhcmFtc1syXSB8fCBwYXRoQmluZGluZ3MgfHwgL3ZpZXcuKD8haW5kZXgpLy50ZXN0KHBhcmFtc1swXSk7XG5cdFx0XHRcdC8vIHVzZVZpZXdzIGlzIGZvciBwZXJmIG9wdGltaXphdGlvbi4gRm9yIHJlbmRlcigpIHdlIG9ubHkgdXNlIHZpZXdzIGlmIG5lY2Vzc2FyeSAtIGZvciB0aGUgbW9yZSBhZHZhbmNlZCBzY2VuYXJpb3MuXG5cdFx0XHRcdC8vIFdlIHVzZSB2aWV3cyBpZiB0aGVyZSBhcmUgcHJvcHMsIGNvbnRleHR1YWwgcHJvcGVydGllcyBvciBhcmdzIHdpdGggIy4uLiAob3RoZXIgdGhhbiAjaW5kZXgpIC0gYnV0IHlvdSBjYW4gZm9yY2Vcblx0XHRcdFx0Ly8gdXNpbmcgdGhlIGZ1bGwgdmlldyBpbmZyYXN0cnVjdHVyZSwgKGFuZCBwYXkgYSBwZXJmIHByaWNlKSBieSBvcHRpbmcgaW46IFNldCB1c2VWaWV3czogdHJ1ZSBvbiB0aGUgdGVtcGxhdGUsIG1hbnVhbGx5Li4uXG5cdFx0XHRcdGlmIChpc0dldFZhbCA9IHRhZ05hbWUgPT09IFwiOlwiKSB7XG5cdFx0XHRcdFx0aWYgKGNvbnZlcnRlcikge1xuXHRcdFx0XHRcdFx0dGFnTmFtZSA9IGNvbnZlcnRlciA9PT0gSFRNTCA/IFwiPlwiIDogY29udmVydGVyICsgdGFnTmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHsgLy8gVE9ETyBvcHRpbWl6ZSAtIGlmIGNvbnRlbnQubGVuZ3RoID09PSAwIG9yIGlmIHRoZXJlIGlzIGEgdG1wbD1cIi4uLlwiIHNwZWNpZmllZCAtIHNldCBjb250ZW50IHRvIG51bGwgLyBkb24ndCBydW4gdGhpcyBjb21waWxhdGlvbiBjb2RlIC0gc2luY2UgY29udGVudCB3b24ndCBnZXQgdXNlZCEhXG5cdFx0XHRcdFx0XHQvLyBDcmVhdGUgdGVtcGxhdGUgb2JqZWN0IGZvciBuZXN0ZWQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwgPSB0bXBsT2JqZWN0KG1hcmt1cCwgdG1wbE9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbC50bXBsTmFtZSA9IHRtcGxOYW1lICsgXCIvXCIgKyB0YWdOYW1lO1xuXHRcdFx0XHRcdFx0Ly8gQ29tcGlsZSB0byBBU1QgYW5kIHRoZW4gdG8gY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwudXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzIHx8IHVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0YnVpbGRDb2RlKGNvbnRlbnQsIG5lc3RlZFRtcGwpO1xuXHRcdFx0XHRcdFx0dXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbHMucHVzaChuZXN0ZWRUbXBsKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWlzRWxzZSkge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBub3QgYW4gZWxzZSB0YWcuXG5cdFx0XHRcdFx0XHR0YWdBbmRFbHNlcyA9IHRhZ05hbWU7XG5cdFx0XHRcdFx0XHR1c2VWaWV3cyA9IHVzZVZpZXdzIHx8IHRhZ05hbWUgJiYgKCEkdGFnc1t0YWdOYW1lXSB8fCAhJHRhZ3NbdGFnTmFtZV0uZmxvdyk7XG5cdFx0XHRcdFx0XHQvLyBTd2l0Y2ggdG8gYSBuZXcgY29kZSBzdHJpbmcgZm9yIHRoaXMgYm91bmQgdGFnIChhbmQgaXRzIGVsc2VzLCBpZiBpdCBoYXMgYW55KSAtIGZvciByZXR1cm5pbmcgdGhlIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRcdG9sZENvZGUgPSBjb2RlO1xuXHRcdFx0XHRcdFx0Y29kZSA9IFwiXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBhc3RbaSArIDFdO1xuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBuZXh0SXNFbHNlICYmIG5leHRJc0Vsc2VbMF0gPT09IFwiZWxzZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRhZ1N0YXJ0ID0gb25FcnJvciA/IFwiO1xcbnRyeXtcXG5yZXQrPVwiIDogXCJcXG4rXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IFwiXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIlwiO1xuXG5cdFx0XHRcdGlmIChpc0dldFZhbCAmJiAocGF0aEJpbmRpbmdzIHx8IHRyaWdnZXIgfHwgY29udmVydGVyICYmIGNvbnZlcnRlciAhPT0gSFRNTCB8fCBsYXRlUmVuZGVyKSkge1xuXHRcdFx0XHRcdC8vIEZvciBjb252ZXJ0VmFsIHdlIG5lZWQgYSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIG5ldyB0YWdDdHgocylcblx0XHRcdFx0XHR0YWdDdHhGbiA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqXCIsIFwiLy8gXCIgKyB0bXBsTmFtZSArIFwiIFwiICsgKCsrdG1wbEJpbmRpbmdLZXkpICsgXCIgXCIgKyB0YWdOYW1lXG5cdFx0XHRcdFx0XHQrIHJldFN0ck9wZW4gKyBcIntcIiArIHRhZ0N0eCArIFwifTtcIiArIHJldFN0ckNsb3NlKTtcblx0XHRcdFx0XHR0YWdDdHhGbi5fZXIgPSBvbkVycm9yO1xuXHRcdFx0XHRcdHRhZ0N0eEZuLl90YWcgPSB0YWdOYW1lO1xuXHRcdFx0XHRcdHRhZ0N0eEZuLl9iZCA9ICEhcGF0aEJpbmRpbmdzOyAvLyBkYXRhLWxpbmtlZCB0YWcge157Li4uL319XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX2xyID0gbGF0ZVJlbmRlcjtcblxuXHRcdFx0XHRcdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGFnQ3R4Rm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c2V0UGF0aHModGFnQ3R4Rm4sIHBhdGhCaW5kaW5ncyk7XG5cdFx0XHRcdFx0dGFnUmVuZGVyID0gJ2MoXCInICsgY29udmVydGVyICsgJ1wiLHZpZXcsJztcblx0XHRcdFx0XHR1c2VDbnZ0ID0gdHJ1ZTtcblx0XHRcdFx0XHRib3VuZE9uRXJyU3RhcnQgPSB0YWdSZW5kZXIgKyB0bXBsQmluZGluZ0tleSArIFwiLFwiO1xuXHRcdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIilcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb2RlICs9IChpc0dldFZhbFxuXHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAob25FcnJvciA/IFwidHJ5e1xcblwiIDogXCJcIikgKyBcInJldHVybiBcIiA6IHRhZ1N0YXJ0KSArICh1c2VDbnZ0IC8vIENhbGwgX2NudnQgaWYgdGhlcmUgaXMgYSBjb252ZXJ0ZXI6IHt7Y252dDogLi4uIH19IG9yIHtee2NudnQ6IC4uLiB9fVxuXHRcdFx0XHRcdFx0PyAodXNlQ252dCA9IHVuZGVmaW5lZCwgdXNlVmlld3MgPSBoYXNDbnZ0ID0gdHJ1ZSwgdGFnUmVuZGVyICsgKHRhZ0N0eEZuXG5cdFx0XHRcdFx0XHRcdD8gKCh0bXBsQmluZGluZ3NbdG1wbEJpbmRpbmdLZXkgLSAxXSA9IHRhZ0N0eEZuKSwgdG1wbEJpbmRpbmdLZXkpIC8vIFN0b3JlIHRoZSBjb21waWxlZCB0YWdDdHhGbiBpbiB0bXBsLmJuZHMsIGFuZCBwYXNzIHRoZSBrZXkgdG8gY29udmVydFZhbCgpXG5cdFx0XHRcdFx0XHRcdDogXCJ7XCIgKyB0YWdDdHggKyBcIn1cIikgKyBcIilcIilcblx0XHRcdFx0XHRcdDogdGFnTmFtZSA9PT0gXCI+XCJcblx0XHRcdFx0XHRcdFx0PyAoaGFzRW5jb2RlciA9IHRydWUsIFwiaChcIiArIHBhcmFtc1swXSArIFwiKVwiKVxuXHRcdFx0XHRcdFx0XHQ6IChnZXRzVmFsID0gdHJ1ZSwgXCIoKHY9XCIgKyBwYXJhbXNbMF0gKyAnKSE9bnVsbD92OicgKyAoaXNMaW5rRXhwciA/ICdudWxsKScgOiAnXCJcIiknKSlcblx0XHRcdFx0XHRcdFx0Ly8gTm9uIHN0cmljdCBlcXVhbGl0eSBzbyBkYXRhLWxpbms9XCJ0aXRsZXs6ZXhwcn1cIiB3aXRoIGV4cHI9bnVsbC91bmRlZmluZWQgcmVtb3ZlcyB0aXRsZSBhdHRyaWJ1dGVcblx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0OiAoaGFzVGFnID0gdHJ1ZSwgXCJcXG57dmlldzp2aWV3LGNvbnRlbnQ6ZmFsc2UsdG1wbDpcIiAvLyBBZGQgdGhpcyB0YWdDdHggdG8gdGhlIGNvbXBpbGVkIGNvZGUgZm9yIHRoZSB0YWdDdHhzIHRvIGJlIHBhc3NlZCB0byByZW5kZXJUYWcoKVxuXHRcdFx0XHRcdFx0KyAoY29udGVudCA/IG5lc3RlZFRtcGxzLmxlbmd0aCA6IFwiZmFsc2VcIikgKyBcIixcIiAvLyBGb3IgYmxvY2sgdGFncywgcGFzcyBpbiB0aGUga2V5IChuZXN0ZWRUbXBscy5sZW5ndGgpIHRvIHRoZSBuZXN0ZWQgY29udGVudCB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFx0KyB0YWdDdHggKyBcIn0sXCIpKTtcblxuXHRcdFx0XHRpZiAodGFnQW5kRWxzZXMgJiYgIW5leHRJc0Vsc2UpIHtcblx0XHRcdFx0XHQvLyBUaGlzIGlzIGEgZGF0YS1saW5rIGV4cHJlc3Npb24gb3IgYW4gaW5saW5lIHRhZyB3aXRob3V0IGFueSBlbHNlcywgb3IgdGhlIGxhc3Qge3tlbHNlfX0gb2YgYW4gaW5saW5lIHRhZ1xuXHRcdFx0XHRcdC8vIFdlIGNvbXBsZXRlIHRoZSBjb2RlIGZvciByZXR1cm5pbmcgdGhlIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRjb2RlID0gXCJbXCIgKyBjb2RlLnNsaWNlKDAsIC0xKSArIFwiXVwiO1xuXHRcdFx0XHRcdHRhZ1JlbmRlciA9ICd0KFwiJyArIHRhZ0FuZEVsc2VzICsgJ1wiLHZpZXcsdGhpcywnO1xuXHRcdFx0XHRcdGlmIChpc0xpbmtFeHByIHx8IHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBhIGJvdW5kIHRhZyAoZGF0YS1saW5rIGV4cHJlc3Npb24gb3IgaW5saW5lIGJvdW5kIHRhZyB7Xnt0YWcgLi4ufX0pIHNvIHdlIHN0b3JlIGEgY29tcGlsZWQgdGFnQ3R4cyBmdW5jdGlvbiBpbiB0bXAuYm5kc1xuXHRcdFx0XHRcdFx0Y29kZSA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqXCIsIFwiIC8vIFwiICsgdG1wbE5hbWUgKyBcIiBcIiArIHRtcGxCaW5kaW5nS2V5ICsgXCIgXCIgKyB0YWdBbmRFbHNlcyArIHJldFN0ck9wZW4gKyBjb2RlXG5cdFx0XHRcdFx0XHRcdCsgcmV0U3RyQ2xvc2UpO1xuXHRcdFx0XHRcdFx0Y29kZS5fZXIgPSBvbkVycm9yO1xuXHRcdFx0XHRcdFx0Y29kZS5fdGFnID0gdGFnQW5kRWxzZXM7XG5cdFx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdHNldFBhdGhzKHRtcGxCaW5kaW5nc1t0bXBsQmluZGluZ0tleSAtIDFdID0gY29kZSwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvZGUuX2xyID0gbGF0ZVJlbmRlcjtcblx0XHRcdFx0XHRcdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBjb2RlOyAvLyBGb3IgYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiB3ZSByZXR1cm4gdGhlIGNvbXBpbGVkIHRhZ0N0eHMgZnVuY3Rpb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsdW5kZWZpbmVkLFwiO1xuXHRcdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFRoaXMgaXMgdGhlIGxhc3Qge3tlbHNlfX0gZm9yIGFuIGlubGluZSB0YWcuXG5cdFx0XHRcdFx0Ly8gRm9yIGEgYm91bmQgdGFnLCBwYXNzIHRoZSB0YWdDdHhzIGZuIGxvb2t1cCBrZXkgdG8gcmVuZGVyVGFnLlxuXHRcdFx0XHRcdC8vIEZvciBhbiB1bmJvdW5kIHRhZywgaW5jbHVkZSB0aGUgY29kZSBkaXJlY3RseSBmb3IgZXZhbHVhdGluZyB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0Y29kZSA9IG9sZENvZGUgKyB0YWdTdGFydCArIHRhZ1JlbmRlciArIChwYXRoQmluZGluZ3MgJiYgdG1wbEJpbmRpbmdLZXkgfHwgY29kZSkgKyBcIilcIjtcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSAwO1xuXHRcdFx0XHRcdHRhZ0FuZEVsc2VzID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob25FcnJvciAmJiAhbmV4dElzRWxzZSkge1xuXHRcdFx0XHRcdHVzZVZpZXdzID0gdHJ1ZTtcblx0XHRcdFx0XHRjb2RlICs9ICc7XFxufWNhdGNoKGUpe3JldCcgKyAoaXNMaW5rRXhwciA/IFwidXJuIFwiIDogXCIrPVwiKSArIGJvdW5kT25FcnJTdGFydCArICdqLl9lcnIoZSx2aWV3LCcgKyBvbkVycm9yICsgJyknICsgYm91bmRPbkVyckVuZCArICc7fScgKyAoaXNMaW5rRXhwciA/IFwiXCIgOiAnXFxucmV0PXJldCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdC8vIEluY2x1ZGUgb25seSB0aGUgdmFyIHJlZmVyZW5jZXMgdGhhdCBhcmUgbmVlZGVkIGluIHRoZSBjb2RlXG5cdGNvZGUgPSBcIi8vIFwiICsgdG1wbE5hbWVcblx0XHQrICh0bXBsT3B0aW9ucy5kZWJ1ZyA/IFwiXFxuZGVidWdnZXI7XCIgOiBcIlwiKVxuXHRcdCsgXCJcXG52YXIgdlwiXG5cdFx0KyAoaGFzVGFnID8gXCIsdD1qLl90YWdcIiA6IFwiXCIpICAgICAgICAgICAgICAgIC8vIGhhcyB0YWdcblx0XHQrIChoYXNDbnZ0ID8gXCIsYz1qLl9jbnZ0XCIgOiBcIlwiKSAgICAgICAgICAgICAgLy8gY29udmVydGVyXG5cdFx0KyAoaGFzRW5jb2RlciA/IFwiLGg9ai5faHRtbFwiIDogXCJcIikgICAgICAgICAgIC8vIGh0bWwgY29udmVydGVyXG5cdFx0KyAoaXNMaW5rRXhwclxuXHRcdFx0XHQ/IChub2RlWzhdIC8vIGxhdGUgQC4uLiBwYXRoP1xuXHRcdFx0XHRcdFx0PyBcIiwgb2JcIlxuXHRcdFx0XHRcdFx0OiBcIlwiXG5cdFx0XHRcdFx0KSArIFwiO1xcblwiXG5cdFx0XHRcdDogJyxyZXQ9XCJcIicpXG5cdFx0KyBjb2RlXG5cdFx0KyAoaXNMaW5rRXhwciA/IFwiXFxuXCIgOiBcIjtcXG5yZXR1cm4gcmV0O1wiKTtcblxuXHR0cnkge1xuXHRcdGNvZGUgPSBuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsalwiLCBjb2RlKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHN5bnRheEVycm9yKFwiQ29tcGlsZWQgdGVtcGxhdGUgY29kZTpcXG5cXG5cIiArIGNvZGUgKyAnXFxuOiBcIicgKyAoZS5tZXNzYWdlfHxlKSArICdcIicpO1xuXHR9XG5cdGlmICh0bXBsKSB7XG5cdFx0dG1wbC5mbiA9IGNvZGU7XG5cdFx0dG1wbC51c2VWaWV3cyA9ICEhdXNlVmlld3M7XG5cdH1cblx0cmV0dXJuIGNvZGU7XG59XG5cbi8vPT09PT09PT09PVxuLy8gVXRpbGl0aWVzXG4vLz09PT09PT09PT1cblxuLy8gTWVyZ2Ugb2JqZWN0cywgaW4gcGFydGljdWxhciBjb250ZXh0cyB3aGljaCBpbmhlcml0IGZyb20gcGFyZW50IGNvbnRleHRzXG5mdW5jdGlvbiBleHRlbmRDdHgoY29udGV4dCwgcGFyZW50Q29udGV4dCkge1xuXHQvLyBSZXR1cm4gY29weSBvZiBwYXJlbnRDb250ZXh0LCB1bmxlc3MgY29udGV4dCBpcyBkZWZpbmVkIGFuZCBpcyBkaWZmZXJlbnQsIGluIHdoaWNoIGNhc2UgcmV0dXJuIGEgbmV3IG1lcmdlZCBjb250ZXh0XG5cdC8vIElmIG5laXRoZXIgY29udGV4dCBub3IgcGFyZW50Q29udGV4dCBhcmUgZGVmaW5lZCwgcmV0dXJuIHVuZGVmaW5lZFxuXHRyZXR1cm4gY29udGV4dCAmJiBjb250ZXh0ICE9PSBwYXJlbnRDb250ZXh0XG5cdFx0PyAocGFyZW50Q29udGV4dFxuXHRcdFx0PyAkZXh0ZW5kKCRleHRlbmQoe30sIHBhcmVudENvbnRleHQpLCBjb250ZXh0KVxuXHRcdFx0OiBjb250ZXh0KVxuXHRcdDogcGFyZW50Q29udGV4dCAmJiAkZXh0ZW5kKHt9LCBwYXJlbnRDb250ZXh0KTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0UHJvcHMoc291cmNlLCB0YWdDdHgpIHtcblx0Ly8gdGhpcyBwb2ludGVyIGlzIHRoZU1hcCAtIHdoaWNoIGhhcyB0YWdDdHgucHJvcHMgdG9vXG5cdC8vIGFyZ3VtZW50czogdGFnQ3R4LmFyZ3MuXG5cdHZhciBrZXksIHByb3AsXG5cdFx0bWFwID0gdGFnQ3R4Lm1hcCxcblx0XHRwcm9wc0FyciA9IG1hcCAmJiBtYXAucHJvcHNBcnI7XG5cblx0aWYgKCFwcm9wc0FycikgeyAvLyBtYXAucHJvcHNBcnIgaXMgdGhlIGZ1bGwgYXJyYXkgb2Yge2tleTouLi4sIHByb3A6Li4ufSBvYmplY3RzXG5cdFx0cHJvcHNBcnIgPSBbXTtcblx0XHRpZiAodHlwZW9mIHNvdXJjZSA9PT0gT0JKRUNUIHx8ICRpc0Z1bmN0aW9uKHNvdXJjZSkpIHtcblx0XHRcdGZvciAoa2V5IGluIHNvdXJjZSkge1xuXHRcdFx0XHRwcm9wID0gc291cmNlW2tleV07XG5cdFx0XHRcdGlmIChrZXkgIT09ICRleHBhbmRvICYmIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICghdGFnQ3R4LnByb3BzLm5vRnVuY3Rpb25zIHx8ICEkLmlzRnVuY3Rpb24ocHJvcCkpKSB7XG5cdFx0XHRcdFx0cHJvcHNBcnIucHVzaCh7a2V5OiBrZXksIHByb3A6IHByb3B9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAobWFwKSB7XG5cdFx0XHRtYXAucHJvcHNBcnIgPSBtYXAub3B0aW9ucyAmJiBwcm9wc0FycjsgLy8gSWYgYm91bmQge157cHJvcHN9fSBhbmQgbm90IGlzUmVuZGVyQ2FsbCwgc3RvcmUgcHJvcHNBcnIgb24gbWFwIChtYXAub3B0aW9ucyBpcyBkZWZpbmVkIG9ubHkgZm9yIGJvdW5kLCAmJiAhaXNSZW5kZXJDYWxsKVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gZ2V0VGFyZ2V0U29ydGVkKHByb3BzQXJyLCB0YWdDdHgpOyAvLyBPYnRhaW5zIG1hcC50Z3QsIGJ5IGZpbHRlcmluZywgc29ydGluZyBhbmQgc3BsaWNpbmcgdGhlIGZ1bGwgcHJvcHNBcnJcbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0U29ydGVkKHZhbHVlLCB0YWdDdHgpIHtcblx0Ly8gZ2V0VGd0XG5cdHZhciBtYXBwZWQsIHN0YXJ0LCBlbmQsXG5cdFx0dGFnID0gdGFnQ3R4LnRhZyxcblx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcyxcblx0XHRwcm9wUGFyYW1zID0gdGFnQ3R4LnBhcmFtcy5wcm9wcyxcblx0XHRmaWx0ZXIgPSBwcm9wcy5maWx0ZXIsXG5cdFx0c29ydCA9IHByb3BzLnNvcnQsXG5cdFx0ZGlyZWN0U29ydCA9IHNvcnQgPT09IHRydWUsXG5cdFx0c3RlcCA9IHBhcnNlSW50KHByb3BzLnN0ZXApLFxuXHRcdHJldmVyc2UgPSBwcm9wcy5yZXZlcnNlID8gLTEgOiAxO1xuXG5cdGlmICghJGlzQXJyYXkodmFsdWUpKSB7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cdGlmIChkaXJlY3RTb3J0IHx8IHNvcnQgJiYgdHlwZW9mIHNvcnQgPT09IFNUUklORykge1xuXHRcdC8vIFRlbXBvcmFyeSBtYXBwZWQgYXJyYXkgaG9sZHMgb2JqZWN0cyB3aXRoIGluZGV4IGFuZCBzb3J0LXZhbHVlXG5cdFx0bWFwcGVkID0gdmFsdWUubWFwKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcblx0XHRcdGl0ZW0gPSBkaXJlY3RTb3J0ID8gaXRlbSA6IGdldFBhdGhPYmplY3QoaXRlbSwgc29ydCk7XG5cdFx0XHRyZXR1cm4ge2k6IGksIHY6IHR5cGVvZiBpdGVtID09PSBTVFJJTkcgPyBpdGVtLnRvTG93ZXJDYXNlKCkgOiBpdGVtfTtcblx0XHR9KTtcblx0XHQvLyBTb3J0IG1hcHBlZCBhcnJheVxuXHRcdG1hcHBlZC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcblx0XHRcdHJldHVybiBhLnYgPiBiLnYgPyByZXZlcnNlIDogYS52IDwgYi52ID8gLXJldmVyc2UgOiAwO1xuXHRcdH0pO1xuXHRcdC8vIE1hcCB0byBuZXcgYXJyYXkgd2l0aCByZXN1bHRpbmcgb3JkZXJcblx0XHR2YWx1ZSA9IG1hcHBlZC5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRyZXR1cm4gdmFsdWVbaXRlbS5pXTtcblx0XHR9KTtcblx0fSBlbHNlIGlmICgoc29ydCB8fCByZXZlcnNlIDwgMCkgJiYgIXRhZy5kYXRhTWFwKSB7XG5cdFx0dmFsdWUgPSB2YWx1ZS5zbGljZSgpOyAvLyBDbG9uZSBhcnJheSBmaXJzdCBpZiBub3QgYWxyZWFkeSBhIG5ldyBhcnJheVxuXHR9XG5cdGlmICgkaXNGdW5jdGlvbihzb3J0KSkge1xuXHRcdHZhbHVlID0gdmFsdWUuc29ydChmdW5jdGlvbigpIHsgLy8gV3JhcCB0aGUgc29ydCBmdW5jdGlvbiB0byBwcm92aWRlIHRhZ0N0eCBhcyAndGhpcycgcG9pbnRlclxuXHRcdFx0cmV0dXJuIHNvcnQuYXBwbHkodGFnQ3R4LCBhcmd1bWVudHMpO1xuXHRcdH0pO1xuXHR9XG5cdGlmIChyZXZlcnNlIDwgMCAmJiAoIXNvcnQgfHwgJGlzRnVuY3Rpb24oc29ydCkpKSB7IC8vIFJldmVyc2UgcmVzdWx0IGlmIG5vdCBhbHJlYWR5IHJldmVyc2VkIGluIHNvcnRcblx0XHR2YWx1ZSA9IHZhbHVlLnJldmVyc2UoKTtcblx0fVxuXG5cdGlmICh2YWx1ZS5maWx0ZXIgJiYgZmlsdGVyKSB7IC8vIElFOCBkb2VzIG5vdCBzdXBwb3J0IGZpbHRlclxuXHRcdHZhbHVlID0gdmFsdWUuZmlsdGVyKGZpbHRlciwgdGFnQ3R4KTtcblx0XHRpZiAodGFnQ3R4LnRhZy5vbkZpbHRlcikge1xuXHRcdFx0dGFnQ3R4LnRhZy5vbkZpbHRlcih0YWdDdHgpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChwcm9wUGFyYW1zLnNvcnRlZCkge1xuXHRcdG1hcHBlZCA9IChzb3J0IHx8IHJldmVyc2UgPCAwKSA/IHZhbHVlIDogdmFsdWUuc2xpY2UoKTtcblx0XHRpZiAodGFnLnNvcnRlZCkge1xuXHRcdFx0JC5vYnNlcnZhYmxlKHRhZy5zb3J0ZWQpLnJlZnJlc2gobWFwcGVkKTsgLy8gTm90ZSB0aGF0IHRoaXMgbWlnaHQgY2F1c2UgdGhlIHN0YXJ0IGFuZCBlbmQgcHJvcHMgdG8gYmUgbW9kaWZpZWQgLSBlLmcuIGJ5IHBhZ2VyIHRhZyBjb250cm9sXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhZ0N0eC5tYXAuc29ydGVkID0gbWFwcGVkO1xuXHRcdH1cblx0fVxuXG5cdHN0YXJ0ID0gcHJvcHMuc3RhcnQ7IC8vIEdldCBjdXJyZW50IHZhbHVlIC0gYWZ0ZXIgcG9zc2libGUgY2hhbmdlcyB0cmlnZ2VyZWQgYnkgdGFnLnNvcnRlZCByZWZyZXNoKCkgYWJvdmVcblx0ZW5kID0gcHJvcHMuZW5kO1xuXHRpZiAocHJvcFBhcmFtcy5zdGFydCAmJiBzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHByb3BQYXJhbXMuZW5kICYmIGVuZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0c3RhcnQgPSBlbmQgPSAwO1xuXHR9XG5cdGlmICghaXNOYU4oc3RhcnQpIHx8ICFpc05hTihlbmQpKSB7IC8vIHN0YXJ0IG9yIGVuZCBzcGVjaWZpZWQsIGJ1dCBub3QgdGhlIGF1dG8tY3JlYXRlIE51bWJlciBhcnJheSBzY2VuYXJpbyBvZiB7e2ZvciBzdGFydD14eHggZW5kPXl5eX19XG5cdFx0c3RhcnQgPSArc3RhcnQgfHwgMDtcblx0XHRlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB2YWx1ZS5sZW5ndGggPyB2YWx1ZS5sZW5ndGggOiArZW5kO1xuXHRcdHZhbHVlID0gdmFsdWUuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdH1cblx0aWYgKHN0ZXAgPiAxKSB7XG5cdFx0c3RhcnQgPSAwO1xuXHRcdGVuZCA9IHZhbHVlLmxlbmd0aDtcblx0XHRtYXBwZWQgPSBbXTtcblx0XHRmb3IgKDsgc3RhcnQ8ZW5kOyBzdGFydCs9c3RlcCkge1xuXHRcdFx0bWFwcGVkLnB1c2godmFsdWVbc3RhcnRdKTtcblx0XHR9XG5cdFx0dmFsdWUgPSBtYXBwZWQ7XG5cdH1cblx0aWYgKHByb3BQYXJhbXMucGFnZWQgJiYgdGFnLnBhZ2VkKSB7XG5cdFx0JG9ic2VydmFibGUodGFnLnBhZ2VkKS5yZWZyZXNoKHZhbHVlKTtcblx0fVxuXG5cdHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFJlbmRlciB0aGUgdGVtcGxhdGUgYXMgYSBzdHJpbmcsIHVzaW5nIHRoZSBzcGVjaWZpZWQgZGF0YSBhbmQgaGVscGVycy9jb250ZXh0XG4qICQoXCIjdG1wbFwiKS5yZW5kZXIoKVxuKlxuKiBAcGFyYW0ge2FueX0gICAgICAgIGRhdGFcbiogQHBhcmFtIHtoYXNofSAgICAgICBbaGVscGVyc09yQ29udGV4dF1cbiogQHBhcmFtIHtib29sZWFufSAgICBbbm9JdGVyYXRpb25dXG4qIEByZXR1cm5zIHtzdHJpbmd9ICAgcmVuZGVyZWQgdGVtcGxhdGVcbiovXG5mdW5jdGlvbiAkZm5SZW5kZXIoZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24pIHtcblx0dmFyIHRtcGxFbGVtID0gdGhpcy5qcXVlcnkgJiYgKHRoaXNbMF0gfHwgZXJyb3IoJ1Vua25vd24gdGVtcGxhdGUnKSksIC8vIFRhcmdldGVkIGVsZW1lbnQgbm90IGZvdW5kIGZvciBqUXVlcnkgdGVtcGxhdGUgc2VsZWN0b3Igc3VjaCBhcyBcIiNteVRtcGxcIlxuXHRcdHRtcGwgPSB0bXBsRWxlbS5nZXRBdHRyaWJ1dGUodG1wbEF0dHIpO1xuXG5cdHJldHVybiByZW5kZXJDb250ZW50LmNhbGwodG1wbCAmJiAkLmRhdGEodG1wbEVsZW0pW2pzdlRtcGxdIHx8ICR0ZW1wbGF0ZXModG1wbEVsZW0pLFxuXHRcdGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uKTtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBSZWdpc3RlciBjb252ZXJ0ZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldENoYXJFbnRpdHkoY2gpIHtcblx0Ly8gR2V0IGNoYXJhY3RlciBlbnRpdHkgZm9yIEhUTUwsIEF0dHJpYnV0ZSBhbmQgb3B0aW9uYWwgZGF0YSBlbmNvZGluZ1xuXHRyZXR1cm4gY2hhckVudGl0aWVzW2NoXSB8fCAoY2hhckVudGl0aWVzW2NoXSA9IFwiJiNcIiArIGNoLmNoYXJDb2RlQXQoMCkgKyBcIjtcIik7XG59XG5cbmZ1bmN0aW9uIGdldENoYXJGcm9tRW50aXR5KG1hdGNoLCB0b2tlbikge1xuXHQvLyBHZXQgY2hhcmFjdGVyIGZyb20gSFRNTCBlbnRpdHksIGZvciBvcHRpb25hbCBkYXRhIHVuZW5jb2Rpbmdcblx0cmV0dXJuIGNoYXJzRnJvbUVudGl0aWVzW3Rva2VuXSB8fCBcIlwiO1xufVxuXG5mdW5jdGlvbiBodG1sRW5jb2RlKHRleHQpIHtcblx0Ly8gSFRNTCBlbmNvZGU6IFJlcGxhY2UgPCA+ICYgJyBcIiBgIGV0Yy4gYnkgY29ycmVzcG9uZGluZyBlbnRpdGllcy5cblx0cmV0dXJuIHRleHQgIT0gdW5kZWZpbmVkID8gcklzSHRtbC50ZXN0KHRleHQpICYmIChcIlwiICsgdGV4dCkucmVwbGFjZShySHRtbEVuY29kZSwgZ2V0Q2hhckVudGl0eSkgfHwgdGV4dCA6IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGRhdGFFbmNvZGUodGV4dCkge1xuXHQvLyBFbmNvZGUganVzdCA8ID4gYW5kICYgLSBpbnRlbmRlZCBmb3IgJ3NhZmUgZGF0YScgYWxvbmcgd2l0aCB7ezp9fSByYXRoZXIgdGhhbiB7ez59fVxuICByZXR1cm4gdHlwZW9mIHRleHQgPT09IFNUUklORyA/IHRleHQucmVwbGFjZShyRGF0YUVuY29kZSwgZ2V0Q2hhckVudGl0eSkgOiB0ZXh0O1xufVxuXG5mdW5jdGlvbiBkYXRhVW5lbmNvZGUodGV4dCkge1xuICAvLyBVbmVuY29kZSBqdXN0IDwgPiBhbmQgJiAtIGludGVuZGVkIGZvciAnc2FmZSBkYXRhJyBhbG9uZyB3aXRoIHt7On19IHJhdGhlciB0aGFuIHt7Pn19XG4gIHJldHVybiAgdHlwZW9mIHRleHQgPT09IFNUUklORyA/IHRleHQucmVwbGFjZShyRGF0YVVuZW5jb2RlLCBnZXRDaGFyRnJvbUVudGl0eSkgOiB0ZXh0O1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IEluaXRpYWxpemUgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuJHN1YiA9ICR2aWV3cy5zdWI7XG4kdmlld3NTZXR0aW5ncyA9ICR2aWV3cy5zZXR0aW5ncztcblxuaWYgKCEoanNyIHx8ICQgJiYgJC5yZW5kZXIpKSB7XG5cdC8vIEpzUmVuZGVyL0pzVmlld3Mgbm90IGFscmVhZHkgbG9hZGVkIChvciBsb2FkZWQgd2l0aG91dCBqUXVlcnksIGFuZCB3ZSBhcmUgbm93IG1vdmluZyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXBhY2UpXG5cdGZvciAoanN2U3RvcmVOYW1lIGluIGpzdlN0b3Jlcykge1xuXHRcdHJlZ2lzdGVyU3RvcmUoanN2U3RvcmVOYW1lLCBqc3ZTdG9yZXNbanN2U3RvcmVOYW1lXSk7XG5cdH1cblxuXHQkY29udmVydGVycyA9ICR2aWV3cy5jb252ZXJ0ZXJzO1xuXHQkaGVscGVycyA9ICR2aWV3cy5oZWxwZXJzO1xuXHQkdGFncyA9ICR2aWV3cy50YWdzO1xuXG5cdCRzdWIuX3RnLnByb3RvdHlwZSA9IHtcblx0XHRiYXNlQXBwbHk6IGJhc2VBcHBseSxcblx0XHRjdnRBcmdzOiBjb252ZXJ0QXJncyxcblx0XHRibmRBcmdzOiBjb252ZXJ0Qm91bmRBcmdzLFxuXHRcdGN0eFBybTogY29udGV4dFBhcmFtZXRlclxuXHR9O1xuXG5cdHRvcFZpZXcgPSAkc3ViLnRvcFZpZXcgPSBuZXcgVmlldygpO1xuXG5cdC8vQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdGlmICgkKSB7XG5cblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHQvLyBqUXVlcnkgKD0gJCkgaXMgbG9hZGVkXG5cblx0XHQkLmZuLnJlbmRlciA9ICRmblJlbmRlcjtcblx0XHQkZXhwYW5kbyA9ICQuZXhwYW5kbztcblx0XHRpZiAoJC5vYnNlcnZhYmxlKSB7XG5cdFx0XHRpZiAodmVyc2lvbk51bWJlciAhPT0gKHZlcnNpb25OdW1iZXIgPSAkLnZpZXdzLmpzdmlld3MpKSB7XG5cdFx0XHRcdC8vIERpZmZlcmVudCB2ZXJzaW9uIG9mIGpzUmVuZGVyIHdhcyBsb2FkZWRcblx0XHRcdFx0dGhyb3cgXCJqcXVlcnkub2JzZXJ2YWJsZS5qcyByZXF1aXJlcyBqc3JlbmRlci5qcyBcIiArIHZlcnNpb25OdW1iZXI7XG5cdFx0XHR9XG5cdFx0XHQkZXh0ZW5kKCRzdWIsICQudmlld3Muc3ViKTsgLy8ganF1ZXJ5Lm9ic2VydmFibGUuanMgd2FzIGxvYWRlZCBiZWZvcmUganNyZW5kZXIuanNcblx0XHRcdCR2aWV3cy5tYXAgPSAkLnZpZXdzLm1hcDtcblx0XHR9XG5cblx0fSBlbHNlIHtcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHQvLyBqUXVlcnkgaXMgbm90IGxvYWRlZC5cblxuXHRcdCQgPSB7fTtcblxuXHRcdGlmIChzZXRHbG9iYWxzKSB7XG5cdFx0XHRnbG9iYWwuanNyZW5kZXIgPSAkOyAvLyBXZSBhcmUgbG9hZGluZyBqc3JlbmRlci5qcyBmcm9tIGEgc2NyaXB0IGVsZW1lbnQsIG5vdCBBTUQgb3IgQ29tbW9uSlMsIHNvIHNldCBnbG9iYWxcblx0XHR9XG5cblx0XHQvLyBFcnJvciB3YXJuaW5nIGlmIGpzcmVuZGVyLmpzIGlzIHVzZWQgYXMgdGVtcGxhdGUgZW5naW5lIG9uIE5vZGUuanMgKGUuZy4gRXhwcmVzcyBvciBIYXBpLi4uKVxuXHRcdC8vIFVzZSBqc3JlbmRlci1ub2RlLmpzIGluc3RlYWQuLi5cblx0XHQkLnJlbmRlckZpbGUgPSAkLl9fZXhwcmVzcyA9ICQuY29tcGlsZSA9IGZ1bmN0aW9uKCkgeyB0aHJvdyBcIk5vZGUuanM6IHVzZSBucG0ganNyZW5kZXIsIG9yIGpzcmVuZGVyLW5vZGUuanNcIjsgfTtcblxuXHRcdC8vRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdCQuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIG9iID09PSBcImZ1bmN0aW9uXCI7XG5cdFx0fTtcblxuXHRcdCQuaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG5cdFx0XHRyZXR1cm4gKHt9LnRvU3RyaW5nKS5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcblx0XHR9O1xuXG5cdFx0JHN1Yi5fanEgPSBmdW5jdGlvbihqcSkgeyAvLyBwcml2YXRlIG1ldGhvZCB0byBtb3ZlIGZyb20gSnNSZW5kZXIgQVBJcyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXNwYWNlXG5cdFx0XHRpZiAoanEgIT09ICQpIHtcblx0XHRcdFx0JGV4dGVuZChqcSwgJCk7IC8vIG1hcCBvdmVyIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdFx0JCA9IGpxO1xuXHRcdFx0XHQkLmZuLnJlbmRlciA9ICRmblJlbmRlcjtcblx0XHRcdFx0ZGVsZXRlICQuanNyZW5kZXI7XG5cdFx0XHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQkLmpzcmVuZGVyID0gdmVyc2lvbk51bWJlcjtcblx0fVxuXHQkc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuXHQkc3ViU2V0dGluZ3MuYWxsb3dDb2RlID0gZmFsc2U7XG5cdCRpc0Z1bmN0aW9uID0gJC5pc0Z1bmN0aW9uO1xuXHQkLnJlbmRlciA9ICRyZW5kZXI7XG5cdCQudmlld3MgPSAkdmlld3M7XG5cdCQudGVtcGxhdGVzID0gJHRlbXBsYXRlcyA9ICR2aWV3cy50ZW1wbGF0ZXM7XG5cblx0Zm9yIChzZXR0aW5nIGluICRzdWJTZXR0aW5ncykge1xuXHRcdGFkZFNldHRpbmcoc2V0dGluZyk7XG5cdH1cblxuXHQvKipcblx0KiAkLnZpZXdzLnNldHRpbmdzLmRlYnVnTW9kZSh0cnVlKVxuXHQqIEBwYXJhbSB7Ym9vbGVhbn0gZGVidWdNb2RlXG5cdCogQHJldHVybnMge1NldHRpbmdzfVxuXHQqXG5cdCogZGVidWdNb2RlID0gJC52aWV3cy5zZXR0aW5ncy5kZWJ1Z01vZGUoKVxuXHQqIEByZXR1cm5zIHtib29sZWFufVxuXHQqL1xuXHQoJHZpZXdzU2V0dGluZ3MuZGVidWdNb2RlID0gZnVuY3Rpb24oZGVidWdNb2RlKSB7XG5cdFx0cmV0dXJuIGRlYnVnTW9kZSA9PT0gdW5kZWZpbmVkXG5cdFx0XHQ/ICRzdWJTZXR0aW5ncy5kZWJ1Z01vZGVcblx0XHRcdDogKFxuXHRcdFx0XHQkc3ViU2V0dGluZ3MuX2NsRm5zICYmICRzdWJTZXR0aW5ncy5fY2xGbnMoKSwgLy8gQ2xlYXIgbGlua0V4cHJTdG9yZSAoY2FjaGVkIGNvbXBpbGVkIGV4cHJlc3Npb25zKSwgc2luY2UgZGVidWdNb2RlIHNldHRpbmcgYWZmZWN0cyBjb21waWxhdGlvbiBmb3IgZXhwcmVzc2lvbnNcblx0XHRcdFx0JHN1YlNldHRpbmdzLmRlYnVnTW9kZSA9IGRlYnVnTW9kZSxcblx0XHRcdFx0JHN1YlNldHRpbmdzLm9uRXJyb3IgPSB0eXBlb2YgZGVidWdNb2RlID09PSBTVFJJTkdcblx0XHRcdFx0XHQ/IGZ1bmN0aW9uKCkgeyByZXR1cm4gZGVidWdNb2RlOyB9XG5cdFx0XHRcdFx0OiAkaXNGdW5jdGlvbihkZWJ1Z01vZGUpXG5cdFx0XHRcdFx0XHQ/IGRlYnVnTW9kZVxuXHRcdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRcdCR2aWV3c1NldHRpbmdzKTtcblx0fSkoZmFsc2UpOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcblxuXHQkc3ViU2V0dGluZ3NBZHZhbmNlZCA9ICRzdWJTZXR0aW5ncy5hZHZhbmNlZCA9IHtcblx0XHRjYWNoZTogdHJ1ZSwgLy8gQnkgZGVmYXVsdCB1c2UgY2FjaGVkIHZhbHVlcyBvZiBjb21wdXRlZCB2YWx1ZXMgKE90aGVyd2lzZSwgc2V0IGFkdmFuY2VkIGNhY2hlIHNldHRpbmcgdG8gZmFsc2UpXG5cdFx0dXNlVmlld3M6IGZhbHNlLFxuXHRcdF9qc3Y6IGZhbHNlIC8vIEZvciBnbG9iYWwgYWNjZXNzIHRvIEpzVmlld3Mgc3RvcmVcblx0fTtcblxuXHQvLz09PT09PT09PT09PT09PT09PT09PT09PT09IFJlZ2lzdGVyIHRhZ3MgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuXHQkdGFncyh7XG5cdFx0XCJpZlwiOiB7XG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0XHQvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBvbmNlIGZvciB7e2lmfX0gYW5kIG9uY2UgZm9yIGVhY2gge3tlbHNlfX0uXG5cdFx0XHRcdC8vIFdlIHdpbGwgdXNlIHRoZSB0YWcucmVuZGVyaW5nIG9iamVjdCBmb3IgY2FycnlpbmcgcmVuZGVyaW5nIHN0YXRlIGFjcm9zcyB0aGUgY2FsbHMuXG5cdFx0XHRcdC8vIElmIG5vdCBkb25lIChhIHByZXZpb3VzIGJsb2NrIGhhcyBub3QgYmVlbiByZW5kZXJlZCksIGxvb2sgYXQgZXhwcmVzc2lvbiBmb3IgdGhpcyBibG9jayBhbmQgcmVuZGVyIHRoZSBibG9jayBpZiBleHByZXNzaW9uIGlzIHRydXRoeVxuXHRcdFx0XHQvLyBPdGhlcndpc2UgcmV0dXJuIFwiXCJcblx0XHRcdFx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdFx0XHRcdHRhZ0N0eCA9IHNlbGYudGFnQ3R4LFxuXHRcdFx0XHRcdHJldCA9IChzZWxmLnJlbmRlcmluZy5kb25lIHx8ICF2YWwgJiYgKHRhZ0N0eC5hcmdzLmxlbmd0aCB8fCAhdGFnQ3R4LmluZGV4KSlcblx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0OiAoc2VsZi5yZW5kZXJpbmcuZG9uZSA9IHRydWUsXG5cdFx0XHRcdFx0XHRcdHNlbGYuc2VsZWN0ZWQgPSB0YWdDdHguaW5kZXgsXG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCk7IC8vIFRlc3QgaXMgc2F0aXNmaWVkLCBzbyByZW5kZXIgY29udGVudCBvbiBjdXJyZW50IGNvbnRleHRcblx0XHRcdFx0cmV0dXJuIHJldDtcblx0XHRcdH0sXG5cdFx0XHRjb250ZW50Q3R4OiB0cnVlLCAvLyBJbmhlcml0IHBhcmVudCB2aWV3IGRhdGEgY29udGV4dFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0XCJmb3JcIjoge1xuXHRcdFx0c29ydERhdGFNYXA6IGRhdGFNYXAoZ2V0VGFyZ2V0U29ydGVkKSxcblx0XHRcdGluaXQ6IGZ1bmN0aW9uKHZhbCwgY2xvbmVkKSB7XG5cdFx0XHRcdHRoaXMuc2V0RGF0YU1hcCh0aGlzLnRhZ0N0eHMpO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIHt7Zm9yfX0gYW5kIG9uY2UgZm9yIGVhY2gge3tlbHNlfX0uXG5cdFx0XHRcdC8vIFdlIHdpbGwgdXNlIHRoZSB0YWcucmVuZGVyaW5nIG9iamVjdCBmb3IgY2FycnlpbmcgcmVuZGVyaW5nIHN0YXRlIGFjcm9zcyB0aGUgY2FsbHMuXG5cdFx0XHRcdHZhciB2YWx1ZSwgZmlsdGVyLCBzcnRGaWVsZCwgaXNBcnJheSwgaSwgc29ydGVkLCBlbmQsIHN0ZXAsXG5cdFx0XHRcdFx0c2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0dGFnQ3R4ID0gc2VsZi50YWdDdHgsXG5cdFx0XHRcdFx0cmFuZ2UgPSB0YWdDdHguYXJnRGVmYXVsdCA9PT0gZmFsc2UsXG5cdFx0XHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHMsXG5cdFx0XHRcdFx0aXRlcmF0ZSA9IHJhbmdlIHx8IHRhZ0N0eC5hcmdzLmxlbmd0aCwgLy8gTm90IGZpbmFsIGVsc2UgYW5kIG5vdCBhdXRvLWNyZWF0ZSByYW5nZVxuXHRcdFx0XHRcdHJlc3VsdCA9IFwiXCIsXG5cdFx0XHRcdFx0ZG9uZSA9IDA7XG5cblx0XHRcdFx0aWYgKCFzZWxmLnJlbmRlcmluZy5kb25lKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBpdGVyYXRlID8gdmFsIDogdGFnQ3R4LnZpZXcuZGF0YTsgLy8gRm9yIHRoZSBmaW5hbCBlbHNlLCBkZWZhdWx0cyB0byBjdXJyZW50IGRhdGEgd2l0aG91dCBpdGVyYXRpb24uXG5cblx0XHRcdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0XHRcdHJhbmdlID0gcHJvcHMucmV2ZXJzZSA/IFwidW5zaGlmdFwiIDogXCJwdXNoXCI7XG5cdFx0XHRcdFx0XHRlbmQgPSArcHJvcHMuZW5kO1xuXHRcdFx0XHRcdFx0c3RlcCA9ICtwcm9wcy5zdGVwIHx8IDE7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IFtdOyAvLyBhdXRvLWNyZWF0ZSBpbnRlZ2VyIGFycmF5IHNjZW5hcmlvIG9mIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5fX1cblx0XHRcdFx0XHRcdGZvciAoaSA9ICtwcm9wcy5zdGFydCB8fCAwOyAoZW5kIC0gaSkgKiBzdGVwID4gMDsgaSArPSBzdGVwKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlW3JhbmdlXShpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGlzQXJyYXkgPSAkaXNBcnJheSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gdGFnQ3R4LnJlbmRlcih2YWx1ZSwgIWl0ZXJhdGUgfHwgcHJvcHMubm9JdGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0Ly8gSXRlcmF0ZXMgaWYgZGF0YSBpcyBhbiBhcnJheSwgZXhjZXB0IG9uIGZpbmFsIGVsc2UgLSBvciBpZiBub0l0ZXJhdGlvbiBwcm9wZXJ0eVxuXHRcdFx0XHRcdFx0Ly8gc2V0IHRvIHRydWUuIChVc2Uge3tpbmNsdWRlfX0gdG8gY29tcG9zZSB0ZW1wbGF0ZXMgd2l0aG91dCBhcnJheSBpdGVyYXRpb24pXG5cdFx0XHRcdFx0XHRkb25lICs9IGlzQXJyYXkgPyB2YWx1ZS5sZW5ndGggOiAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc2VsZi5yZW5kZXJpbmcuZG9uZSA9IGRvbmUpIHtcblx0XHRcdFx0XHRcdHNlbGYuc2VsZWN0ZWQgPSB0YWdDdHguaW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIElmIG5vdGhpbmcgd2FzIHJlbmRlcmVkIHdlIHdpbGwgbG9vayBhdCB0aGUgbmV4dCB7e2Vsc2V9fS4gT3RoZXJ3aXNlLCB3ZSBhcmUgZG9uZS5cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdHNldERhdGFNYXA6IGZ1bmN0aW9uKHRhZ0N0eHMpIHtcblx0XHRcdFx0dmFyIHRhZ0N0eCwgcHJvcHMsIHBhcmFtc1Byb3BzLFxuXHRcdFx0XHRcdHNlbGYgPSB0aGlzLFxuXHRcdFx0XHRcdGwgPSB0YWdDdHhzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKGwtLSkge1xuXHRcdFx0XHRcdHRhZ0N0eCA9IHRhZ0N0eHNbbF07XG5cdFx0XHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdFx0XHRcdFx0cGFyYW1zUHJvcHMgPSB0YWdDdHgucGFyYW1zLnByb3BzO1xuXHRcdFx0XHRcdHRhZ0N0eC5hcmdEZWZhdWx0ID0gcHJvcHMuZW5kID09PSB1bmRlZmluZWQgfHwgdGFnQ3R4LmFyZ3MubGVuZ3RoID4gMDsgLy8gRGVmYXVsdCB0byAjZGF0YSBleGNlcHQgZm9yIGF1dG8tY3JlYXRlIHJhbmdlIHNjZW5hcmlvIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5IHN0ZXA9enp6fX1cblx0XHRcdFx0XHRwcm9wcy5kYXRhTWFwID0gKHRhZ0N0eC5hcmdEZWZhdWx0ICE9PSBmYWxzZSAmJiAkaXNBcnJheSh0YWdDdHguYXJnc1swXSkgJiZcblx0XHRcdFx0XHRcdChwYXJhbXNQcm9wcy5zb3J0IHx8IHBhcmFtc1Byb3BzLnN0YXJ0IHx8IHBhcmFtc1Byb3BzLmVuZCB8fCBwYXJhbXNQcm9wcy5zdGVwIHx8IHBhcmFtc1Byb3BzLmZpbHRlciB8fCBwYXJhbXNQcm9wcy5yZXZlcnNlXG5cdFx0XHRcdFx0XHR8fCBwcm9wcy5zb3J0IHx8IHByb3BzLnN0YXJ0IHx8IHByb3BzLmVuZCB8fCBwcm9wcy5zdGVwIHx8IHByb3BzLmZpbHRlciB8fCBwcm9wcy5yZXZlcnNlKSlcblx0XHRcdFx0XHRcdCYmIHNlbGYuc29ydERhdGFNYXA7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRwcm9wczoge1xuXHRcdFx0YmFzZVRhZzogXCJmb3JcIixcblx0XHRcdGRhdGFNYXA6IGRhdGFNYXAoZ2V0VGFyZ2V0UHJvcHMpLFxuXHRcdFx0aW5pdDogbm9vcCwgLy8gRG9uJ3QgZXhlY3V0ZSB0aGUgYmFzZSBpbml0KCkgb2YgdGhlIFwiZm9yXCIgdGFnXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRpbmNsdWRlOiB7XG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcIipcIjoge1xuXHRcdFx0Ly8ge3sqIGNvZGUuLi4gfX0gLSBJZ25vcmVkIGlmIHRlbXBsYXRlLmFsbG93Q29kZSBhbmQgJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUgYXJlIGZhbHNlLiBPdGhlcndpc2UgaW5jbHVkZSBjb2RlIGluIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHRyZW5kZXI6IHJldFZhbCxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiOipcIjoge1xuXHRcdFx0Ly8ge3s6KiByZXR1cm5lZEV4cHJlc3Npb24gfX0gLSBJZ25vcmVkIGlmIHRlbXBsYXRlLmFsbG93Q29kZSBhbmQgJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUgYXJlIGZhbHNlLiBPdGhlcndpc2UgaW5jbHVkZSBjb2RlIGluIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHRyZW5kZXI6IHJldFZhbCxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdGRiZzogJGhlbHBlcnMuZGJnID0gJGNvbnZlcnRlcnMuZGJnID0gZGJnQnJlYWsgLy8gUmVnaXN0ZXIge3tkYmcvfX0sIHt7ZGJnOi4uLn19IGFuZCB+ZGJnKCkgdG8gdGhyb3cgYW5kIGNhdGNoLCBhcyBicmVha3BvaW50cyBmb3IgZGVidWdnaW5nLlxuXHR9KTtcblxuXHQkY29udmVydGVycyh7XG5cdFx0aHRtbDogaHRtbEVuY29kZSxcblx0XHRhdHRyOiBodG1sRW5jb2RlLCAvLyBJbmNsdWRlcyA+IGVuY29kaW5nIHNpbmNlIHJDb252ZXJ0TWFya2VycyBpbiBKc1ZpZXdzIGRvZXMgbm90IHNraXAgPiBjaGFyYWN0ZXJzIGluIGF0dHJpYnV0ZSBzdHJpbmdzXG5cdFx0ZW5jb2RlOiBkYXRhRW5jb2RlLFxuXHRcdHVuZW5jb2RlOiBkYXRhVW5lbmNvZGUsIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0XHR1cmw6IGZ1bmN0aW9uKHRleHQpIHtcblx0XHRcdC8vIFVSTCBlbmNvZGluZyBoZWxwZXIuXG5cdFx0XHRyZXR1cm4gdGV4dCAhPSB1bmRlZmluZWQgPyBlbmNvZGVVUkkoXCJcIiArIHRleHQpIDogdGV4dCA9PT0gbnVsbCA/IHRleHQgOiBcIlwiOyAvLyBudWxsIHJldHVybnMgbnVsbCwgZS5nLiB0byByZW1vdmUgYXR0cmlidXRlLiB1bmRlZmluZWQgcmV0dXJucyBcIlwiXG5cdFx0fVxuXHR9KTtcbn1cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gRGVmaW5lIGRlZmF1bHQgZGVsaW1pdGVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuJHN1YlNldHRpbmdzID0gJHN1Yi5zZXR0aW5ncztcbiRpc0FycmF5ID0gKCR8fGpzcikuaXNBcnJheTtcbiR2aWV3c1NldHRpbmdzLmRlbGltaXRlcnMoXCJ7e1wiLCBcIn19XCIsIFwiXlwiKTtcblxuaWYgKGpzclRvSnEpIHsgLy8gTW92aW5nIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lcGFjZSAtIGNvcHkgb3ZlciB0aGUgc3RvcmVkIGl0ZW1zICh0ZW1wbGF0ZXMsIGNvbnZlcnRlcnMsIGhlbHBlcnMuLi4pXG5cdGpzci52aWV3cy5zdWIuX2pxKCQpO1xufVxucmV0dXJuICQgfHwganNyO1xufSwgd2luZG93KSk7XG4iLCIvKmdsb2JhbCBRVW5pdCwgdGVzdCwgZXF1YWwsIG9rKi9cbihmdW5jdGlvbih1bmRlZmluZWQpIHtcblwidXNlIHN0cmljdFwiO1xuXG5icm93c2VyaWZ5LmRvbmUudHdlbHZlID0gdHJ1ZTtcblxuUVVuaXQubW9kdWxlKFwiQnJvd3NlcmlmeSAtIGNsaWVudCBjb2RlXCIpO1xuXG52YXIgaXNJRTggPSB3aW5kb3cuYXR0YWNoRXZlbnQgJiYgIXdpbmRvdy5hZGRFdmVudExpc3RlbmVyO1xuXG5pZiAoIWlzSUU4KSB7XG5cbnRlc3QoXCJObyBqUXVlcnkgZ2xvYmFsOiByZXF1aXJlKCdqc3JlbmRlcicpKCkgbmVzdGVkIHRlbXBsYXRlXCIsIGZ1bmN0aW9uKCkge1xuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uIEhpZGUgUVVuaXQgZ2xvYmFsIGpRdWVyeSBhbmQgYW55IHByZXZpb3VzIGdsb2JhbCBqc3JlbmRlci4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHR2YXIgalF1ZXJ5ID0gZ2xvYmFsLmpRdWVyeSwganNyID0gZ2xvYmFsLmpzcmVuZGVyO1xuXHRnbG9iYWwualF1ZXJ5ID0gZ2xvYmFsLmpzcmVuZGVyID0gdW5kZWZpbmVkO1xuXG5cdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gQXJyYW5nZSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cdHZhciBkYXRhID0ge25hbWU6IFwiSm9cIn07XG5cblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gQWN0IC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblx0dmFyIGpzcmVuZGVyID0gcmVxdWlyZSgnLi4vLi4vJykoKTsgLy8gTm90IHBhc3NpbmcgaW4galF1ZXJ5LCBzbyByZXR1cm5zIHRoZSBqc3JlbmRlciBuYW1lc3BhY2VcblxuXHQvLyBVc2UgcmVxdWlyZSB0byBnZXQgc2VydmVyIHRlbXBsYXRlLCB0aGFua3MgdG8gQnJvd3NlcmlmeSBidW5kbGUgdGhhdCB1c2VkIGpzcmVuZGVyL3RtcGxpZnkgdHJhbnNmb3JtXG5cdHZhciB0bXBsID0gcmVxdWlyZSgnLi4vdGVtcGxhdGVzL291dGVyLmh0bWwnKShqc3JlbmRlcik7IC8vIFByb3ZpZGUganNyZW5kZXJcblxuXHR2YXIgcmVzdWx0ID0gdG1wbChkYXRhKTtcblxuXHRyZXN1bHQgKz0gXCIgXCIgKyAoanNyZW5kZXIgIT09IGpRdWVyeSk7XG5cblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBc3NlcnQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGVxdWFsKHJlc3VsdCwgXCJOYW1lOiBKbyAob3V0ZXIuaHRtbCkgTmFtZTogSm8gKGlubmVyLmh0bWwpIHRydWVcIiwgXCJyZXN1bHQ6IE5vIGpRdWVyeSBnbG9iYWw6IHJlcXVpcmUoJ2pzcmVuZGVyJykoKSwgbmVzdGVkIHRlbXBsYXRlc1wiKTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uIFJlc2V0IC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHRnbG9iYWwualF1ZXJ5ID0galF1ZXJ5OyAvLyBSZXBsYWNlIFFVbml0IGdsb2JhbCBqUXVlcnlcblx0Z2xvYmFsLmpzcmVuZGVyID0ganNyOyAvLyBSZXBsYWNlIGFueSBwcmV2aW91cyBnbG9iYWwganNyZW5kZXJcbn0pO1xufVxufSkoKTtcbiIsInZhciB0bXBsUmVmcyA9IFtdLFxuICBta3VwID0gJ05hbWU6IHt7Om5hbWV9fSAoaW5uZXIuaHRtbCknLFxuICAkID0gZ2xvYmFsLmpzcmVuZGVyIHx8IGdsb2JhbC5qUXVlcnk7XG5cbm1vZHVsZS5leHBvcnRzID0gJCA/ICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9pbm5lci5odG1sXCIsIG1rdXApIDpcbiAgZnVuY3Rpb24oJCkge1xuICAgIGlmICghJCB8fCAhJC52aWV3cykge3Rocm93IFwiUmVxdWlyZXMganNyZW5kZXIvalF1ZXJ5XCI7fVxuICAgIHdoaWxlICh0bXBsUmVmcy5sZW5ndGgpIHtcbiAgICAgIHRtcGxSZWZzLnBvcCgpKCQpOyAvLyBjb21waWxlIG5lc3RlZCB0ZW1wbGF0ZVxuICAgIH1cblxuICAgIHJldHVybiAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvaW5uZXIuaHRtbFwiLCBta3VwKVxuICB9OyIsInZhciB0bXBsUmVmcyA9IFtdLFxuICBta3VwID0gJ05hbWU6IHt7Om5hbWV9fSAob3V0ZXIuaHRtbCkge3tpbmNsdWRlIHRtcGw9XFxcIi4vdGVzdC90ZW1wbGF0ZXMvaW5uZXIuaHRtbFxcXCIvfX0nLFxuICAkID0gZ2xvYmFsLmpzcmVuZGVyIHx8IGdsb2JhbC5qUXVlcnk7XG5cbnRtcGxSZWZzLnB1c2gocmVxdWlyZShcIi4vaW5uZXIuaHRtbFwiKSk7XG5tb2R1bGUuZXhwb3J0cyA9ICQgPyAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvb3V0ZXIuaHRtbFwiLCBta3VwKSA6XG4gIGZ1bmN0aW9uKCQpIHtcbiAgICBpZiAoISQgfHwgISQudmlld3MpIHt0aHJvdyBcIlJlcXVpcmVzIGpzcmVuZGVyL2pRdWVyeVwiO31cbiAgICB3aGlsZSAodG1wbFJlZnMubGVuZ3RoKSB7XG4gICAgICB0bXBsUmVmcy5wb3AoKSgkKTsgLy8gY29tcGlsZSBuZXN0ZWQgdGVtcGxhdGVcbiAgICB9XG5cbiAgICByZXR1cm4gJC50ZW1wbGF0ZXMoXCIuL3Rlc3QvdGVtcGxhdGVzL291dGVyLmh0bWxcIiwgbWt1cClcbiAgfTsiXX0=
