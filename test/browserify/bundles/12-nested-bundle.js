(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v1.0.0: http://jsviews.com/#jsrender */
/*! **VERSION FOR WEB** (For NODE.JS see http://jsviews.com/download/jsrender-node.js) */
/*
 * Best-of-breed templating in browser or on Node.js.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://jsviews.com/#jsviews)
 *
 * Copyright 2018, Boris Moore
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

var versionNumber = "v1.0.0",
	jsvStoreName, rTag, rTmplString, topView, $views, $expando,
	_ocp = "_ocp", // Observable contextual parameter

//TODO	tmplFnsCache = {},
	$isFunction, $isArray, $templates, $converters, $helpers, $tags, $sub, $subSettings, $subSettingsAdvanced, $viewsSettings, delimOpenChar0, delimOpenChar1, delimCloseChar0, delimCloseChar1, linkChar, setting, baseOnError,

	rPath = /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
	//        not                               object     helper    view  viewProperty pathTokens      leafToken

	rParams = /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|~(?![\w$_])|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//         lftPrn0          lftPrn        bound path             operator err                                         eq      path2 late            prn      comma  lftPrn2   apos quot        rtPrn  rtPrnDot                  prn2     space
	// (left paren? followed by (path? followed by operator) or (path followed by left paren?)) or comma or apos or quot or right paren or space

	isRenderCall,
	rNewLine = /[ \t]*(\r\n|\n|\r)/g,
	rUnescapeQuotes = /\\(['"])/g,
	rEscapeQuotes = /['"\\]/g, // Escape quotes and \ character
	rBuildHash = /(?:\x08|^)(onerror:)?(?:(~?)(([\w$_\.]+):)?([^\x08]+))\x08(,)?([^\x08]+)/gi,
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
	charsFromEntities  = {
		amp: "&",
		gt: ">",
		lt: "<"
	},
	HTML = "html",
	OBJECT = "object",
	tmplAttr = "data-jsv-tmpl",
	jsvTmpl = "jsvTmpl",
	indexStr = "For #index in nested block use #getIndex().",
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
		map: dataMap    // If jsObservable loaded first, use that definition of dataMap
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
			if (key === "tag" || key === "tagCtx" || key === "root" || key === "parentTags" || storeView._.it === key ) {
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
					? storeView // Is a tag, not a view, or is a computed contextual parameter, so scope to the callView, no the 'scope view'
					: (storeView = storeView.scope || storeView,
						!storeView.isTop && storeView.ctx.tag // If this view is in a tag, set storeView to the tag
							|| storeView);
				if (res !== undefined && storeView.tagCtx) {
					// If storeView is a tag, but the contextual parameter has been set at at higher level (e.g. helpers)...
					storeView = storeView.tagCtx.view.scope; //  then move storeView to the outer level (scope of tag container view)
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
					// In a context callback for a contextual param, we set get = true, to get ctxPrm  [view, dependencies...] array - needed for observe call
					return deps;
				}
				tagElse = obsCtxPrm.tagElse;
				newRes = res[1] // linkFn for compiled expression
					? obsCtxPrm.tag && obsCtxPrm.tag.cvtArgs
						? obsCtxPrm.tag.cvtArgs(tagElse, 1)[obsCtxPrm.ind] // = tag.bndArgs() - for tag contextual parameter
						: res[1](res[0].data, res[0], $sub)    // = fn(data, view, $sub) for compiled binding expression
					: res[0]._ocp; // Observable contextual parameter (uninitialized, or initialized as static expression, so no path dependencies)
				if (isUpdate) {
					if (res && newRes !== value) {
						$sub._ucp(key, value, storeView, obsCtxPrm); // Update observable contextual parameter
					}
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
			wrapped._vw = callView;
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
	var tag, value, argsLen, bindTo,
		// If tagCtx is an integer, then it is the key for the compiled function to return the boundTag tagCtx
		boundTag = typeof tagCtx === "number" && view.tmpl.bnds[tagCtx-1],
		linkCtx = view._lc; // For data-link="{cvt:...}"...

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

	if ((converter = tag.convert) && "" + converter === converter) {
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
		if (!$isArray(converter) || converter.length !== l) {
			converter = [converter];
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
	if ("" + itemName === itemName) {
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
					bindArray[m] = parseInt(key); // Convert "0" to 0,  etc.
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
		linkCtx = parentView._lc || false,
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
				tag._.ths = tagCtx.params.props.this; // Tag has a this=expr binding, to get javascript reference to tag instance
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
					// be a dumbed-down template which will always return the  itemRet string (no matter what the data is). The itemRet string
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
	} else {
		self.ctx = context || {};
	}
}

View.prototype = {
	get: getView,
	getIndex: getIndex,
	ctxPrm: contextParameter,
	getRsc: getResource,
	_getTmpl: getTemplate,
	_getOb: getPathObject,
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
			resources = parentTmpl[storeNames];    // Resources not yet compiled
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
	} else if ("" + tagDef === tagDef) {
		tagDef = {template: tagDef};
	}

	if (baseTag = tagDef.baseTag) {
		tagDef.flow = !!tagDef.flow; // Set flow property, so defaults to false even if baseTag has flow=true
		baseTag = "" + baseTag === baseTag
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
		compiledDef.template = "" + tmpl === tmpl ? ($templates[tmpl] || $templates(tmpl)) : tmpl;
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
	// tmpl is either a template object, a selector for a template script block, the name of a compiled template, or a template object

	//==== nested functions ====
	function lookupTemplate(value) {
		// If value is of type string - treat as selector, or name of compiled template
		// Return the template object, if already compiled, or the markup string
		var currentName, tmpl;
		if (("" + value === value) || value.nodeType > 0 && (elem = value)) {
			if (!elem) {
				if (/^\.\/[^\\:*?"<>]*$/.test(value)) {
					// tmpl="./some/file.html"
					// If the template is not named, use "./some/file.html" as name.
					if (tmpl = $templates[name = name || value]) {
						value = tmpl;
					} else {
						// BROWSER-SPECIFIC CODE (not on Node.js):
						// Look for server-generated script block with id "./some/file.html"
						elem = document.getElementById(value);
					}
				} else if ($.fn && !$sub.rTmpl.test(value)) {
					try {
						elem = $ (value, document)[0]; // if jQuery is loaded, test for selector returning elements, and get first element
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

function unmapArray(modelArr) {
		var arr = [],
			i = 0,
			l = modelArr.length;
		for (; i<l; i++) {
			arr.push(modelArr[i].unmap());
		}
		return arr;
}

function compileViewModel(name, type) {
	var i, constructor,
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
		body = "",
		g = getters ? getters.length : 0,
		$observable = $.observable,
		getterNames = {};

	function GetNew(args) {
		constructor.apply(this, args);
	}

	function vm() {
		return new GetNew(arguments);
	}

	function iterate(data, action) {
		var getterType, defaultVal, prop, ob,
			j = 0;
		for (; j<g; j++) {
			prop = getters[j];
			getterType = undefined;
			if (prop + "" !== prop) {
				getterType = prop;
				prop = getterType.getter;
			}
			if ((ob = data[prop]) === undefined && getterType && (defaultVal = getterType.defaultVal) !== undefined) {
				ob = getDefaultVal(defaultVal, data);
			}
			action(ob, getterType && viewModels[getterType.type], prop);
		}
	}

	function map(data) {
		data = data + "" === data
			? JSON.parse(data) // Accept JSON string
			: data;            // or object/array
		var l, prop,
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
			for (prop in data) { // Copy over any other properties. that are not get/set properties
				if (prop !== $expando && !getterNames[prop]) {
					ob[prop] = data[prop];
				}
			}
		}
		return ob;
	}

	function merge(data) {
		data = data + "" === data
			? JSON.parse(data) // Accept JSON string
			: data;            // or object/array
		var j, l, m, prop, mod, found, assigned, ob, newModArr,
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
						assigned[j] = found = id + "" === id
						? (ob[id] && (getterNames[id] ? mod[id]() : mod[id]) === ob[id])
						: id(mod, ob);
					}
				}
				if (found) {
					mod.merge(ob);
					newModArr.push(mod);
				} else {
					newModArr.push(vm.map(ob));
				}
			}
			if ($observable) {
				$observable(model).refresh(newModArr, true);
			} else {
				model.splice.apply(model, [0, model.length].concat(newModArr));
			}
			return;
		}
		iterate(data, function(ob, viewModel, getter) {
			if (viewModel) {
				model[getter]().merge(ob); // Update typed property
			} else {
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

		if ($isArray(model)) {
			return unmapArray(model);
		}
		ob = {};
		for (; k<g; k++) {
			prop = getters[k];
			getterType = undefined;
			if (prop + "" !== prop) {
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
			if (prop !== "_is" && !getterNames[prop] && prop !== $expando  && (prop.charAt(0) !== "_" || !getterNames[prop.slice(1)]) && !$isFunction(model[prop])) {
				ob[prop] = model[prop];
			}
		}
		return ob;
	}

	GetNew.prototype = proto;

	for (i=0; i<g; i++) {
		(function(getter) {
			getter = getter.getter || getter;
			getterNames[getter] = i+1;
			var privField = "_" + getter;

			args += (args ? "," : "") + getter;
			body += "this." + privField + " = " + getter + ";\n";
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

	constructor = new Function(args, body.slice(0, -1));
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
		if (item === undefined) {
			item = name;
			name = undefined;
		}
		if (name && "" + name !== name) { // name must be a string
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
* @param {boolean}  value
* @returns {Settings}
*
* allowCode = $.views.settings.allowCode()
* @returns {boolean}
*/
function addSetting(st) {
	$viewsSettings[st] = function(value) {
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
		if (!view) {
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
	function setItemVar(item) {
		// When itemVar is specified, set modified ctx with user-named ~item
		newCtx = $extend({}, context);
		newCtx[itemVar] = item;
	}

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
		if (itemVar = tagCtx.props.itemVar) {
			if (itemVar[0] !== "~") {
				syntaxError("Use itemVar='~myItem'");
			}
			itemVar = itemVar.slice(1);
		}
	}

	if (view) {
		onRender = onRender || view._.onRender;
		noLinking = context && context.link === false;

		if (noLinking && view._.nl) {
			onRender = undefined;
		}

		context = extendCtx(context, view.ctx);
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
			if (itemVar) {
				setItemVar(data[i]); // use modified ctx with user-named ~item
			}
			childView = new View(newCtx, "item", newView, data[i], tmpl, (key || 0) + i, onRender, newView.content);
			childView._.it = itemVar;

			itemResult = tmpl.fn(data[i], childView, $sub);
			result += newView._.onRender ? newView._.onRender(itemResult, childView) : itemResult;
		}
	} else {
		// Create a view for singleton data object. The type of the view will be the tag name, e.g. "if" or "mytag" except for
		// "item", "array" and "data" views. A "data" view is from programmatic render(object) against a 'singleton'.
		if (itemVar) {
			setItemVar(data);
		}
		newView = swapContent ? view : new View(newCtx, tmplName || "data", view, data, tmpl, key, onRender, contentTmpl);
		newView._.it = itemVar;
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

	return view && !view._lc ? $converters.html(message) : message;
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
		blockTagCheck("" + loc !== loc && (+loc[10] === loc[10]) && loc[0]);
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

function paramStructure(parts, type) {
	return '\n\t'
		+ (type
			? type + ':{'
			: '')
		+ 'args:[' + parts[0] + '],\n\tprops:{' + parts[1] + '}'
		+ (parts[2] ? ',\n\tctx:{' + parts[2] + '}' : "");
}

function parseParams(params, pathBindings, tmpl, isLinkExpr) {

	function parseTokens(all, lftPrn0, lftPrn, bound, path, operator, err, eq, path2, late, prn, comma, lftPrn2, apos, quot, rtPrn, rtPrnDot, prn2, space, index, full) {
	// /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//  lftPrn0          lftPrn        bound path             operator err                                         eq      path2 late            prn      comma  lftPrn2   apos quot        rtPrn  rtPrnDot                  prn2     space
		// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space
		function parsePath(allPath, not, object, helper, view, viewProperty, pathTokens, leafToken) {
			//rPath = /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
			//          not                               object     helper    view  viewProperty pathTokens      leafToken
			var subPath = object === ".";
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
							if (theOb.bnd) {
								path = "^" + path.slice(1);
							}
							theOb.sb = path;
							theOb.bnd = theOb.bnd || path[0] === "^";
						}
					} else {
						binds.push(path);
					}
					pathStart[parenDepth] = index + (subPath ? 1 : 0);
				}
			}
			return allPath;
		}

		//bound = bindings && bound;
		if (bound && !eq) {
			path = bound + path; // e.g. some.fn(...)^some.path - so here path is "^some.path"
		}
		operator = operator || "";
		lftPrn = lftPrn || lftPrn0 || lftPrn2;
		path = path || path2;

		if (late && (late = !/\)|]/.test(full[index-1]))) {
			path = path.slice(1).split(".").join("^"); // Late path @z.b.c. Use "^" rather than "." to ensure that deep binding will be used
		}
		// Could do this - but not worth perf cost?? :-
		// if (!path.lastIndexOf("#data.", 0)) { path = path.slice(6); } // If path starts with "#data.", remove that.
		prn = prn || prn2 || "";

		var expr, exprFn, binds, theOb, newOb,
			rtSq = ")";

		if (prn === "[") {
			prn = "[j._sq(";
			rtSq = ")]";
		}

		if (err && !aposed && !quoted) {
			syntaxError(params);
		} else {
			if (bindings && rtPrnDot && !aposed && !quoted) {
				// This is a binding to a path in which an object is returned by a helper/data function/expression, e.g. foo()^x.y or (a?b:c)^x.y
				// We create a compiled function to get the object instance (which will be called when the dependent data of the subexpression changes, to return the new object, and trigger re-binding of the subsequent path)
				if (parenDepth && (!named || boundName || bindto)) {
					expr = pathStart[parenDepth - 1];
					if (full.length - 1 > index - (expr || 0)) { // We need to compile a subexpression
						expr = full.slice(expr, index + all.length);
						if (exprFn !== true) { // If not reentrant call during compilation
							binds = bindto || bndStack[parenDepth-1].bd;
							// Insert exprOb object, to be used during binding to return the computed object
							theOb = binds[binds.length-1];
							if (theOb && theOb.prm) {
								while (theOb.sb && theOb.sb.prm) {
									theOb = theOb.sb;
								}
								newOb = theOb.sb = {path: theOb.sb, bnd: theOb.bnd};
							} else {
								binds.push(newOb = {path: binds.pop()}); // Insert exprOb object, to be used during binding to return the computed object
							}											 // (e.g. "some.object()" in "some.object().a.b" - to be used as context for binding the following tokens "a.b")
						}
						rtPrnDot = delimOpenChar1 + ":" + expr // The parameter or function subexpression
							+ " onerror=''" // set onerror='' in order to wrap generated code with a try catch - returning '' as object instance if there is an error/missing parent
							+ delimCloseChar0;
						exprFn = tmplLinks[rtPrnDot];
						if (!exprFn) {
							tmplLinks[rtPrnDot] = true; // Flag that this exprFn (for rtPrnDot) is being compiled
							tmplLinks[rtPrnDot] = exprFn = tmplFn(rtPrnDot, tmpl, true); // Compile the expression (or use cached copy already in tmpl.links)
						}
						if (exprFn !== true && newOb) {
							// If not reentrant call during compilation
							newOb._cpfn = exprFn;
							newOb.prm = bndCtx.bd;
							newOb.bnd = newOb.bnd || newOb.path && newOb.path.indexOf("^") >= 0;
						}
					}
				}
			}
			return (aposed
				// within single-quoted string
				? (aposed = !apos, (aposed ? all : lftPrn2 + '"'))
				: quoted
				// within double-quoted string
					? (quoted = !quot, (quoted ? all : lftPrn2 + '"'))
					:
				(
					(lftPrn
						? (pathStart[parenDepth] = index++, bndCtx = bndStack[++parenDepth] = {bd: []}, lftPrn)
						: "")
					+ (space
						? (parenDepth
							? ""
				// New arg or prop - so insert backspace \b (\x08) as separator for named params, used subsequently by rBuildHash, and prepare new bindings array
							: (paramIndex = full.slice(paramIndex, index), named
								? (named = boundName = bindto = false, "\b")
								: "\b,") + paramIndex + (paramIndex = index + all.length, bindings && pathBindings.push(bndCtx.bd = []), "\b")
						)
						: eq
				// named param. Remove bindings for arg and create instead bindings array for prop
							? (parenDepth && syntaxError(params), bindings && pathBindings.pop(), named = "_" + path, boundName = bound, paramIndex = index + all.length,
									bindings && ((bindings = bndCtx.bd = pathBindings[named] = []), bindings.skp = !bound), path + ':')
							: path
				// path
								? (path.split("^").join(".").replace(rPath, parsePath)
									+ (prn
				// some.fncall(
										? (bndCtx = bndStack[++parenDepth] = {bd: []}, fnCall[parenDepth] = rtSq, prn)
										: operator)
								)
								: operator
				// operator
									? operator
									: rtPrn
				// function
										? ((rtPrn = fnCall[parenDepth] || rtPrn, fnCall[parenDepth] = false, bndCtx = bndStack[--parenDepth], rtPrn)
											+ (prn // rtPrn and prn, e.g )( in (a)() or a()(), or )[ in a()[]
												? (bndCtx = bndStack[++parenDepth], fnCall[parenDepth] = rtSq, prn)
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

	var named, bindto, boundName,
		quoted, // boolean for string content in double quotes
		aposed, // or in single quotes
		bindings = pathBindings && pathBindings[0], // bindings array for the first arg
		bndCtx = {bd: bindings},
		bndStack = {0: bndCtx},
		paramIndex = 0, // list,
		tmplLinks = (tmpl ? tmpl.links : bindings && (bindings.links = bindings.links || {})) || topView.tmpl.links,
		// The following are used for tracking path parsing including nested paths, such as "a.b(c^d + (e))^f", and chained computed paths such as
		// "a.b().c^d().e.f().g" - which has four chained paths, "a.b()", "^c.d()", ".e.f()" and ".g"
		parenDepth = 0,
		fnCall = {}, // We are in a function call
		pathStart = {}, // tracks the start of the current path such as c^d() in the above example
		result;

	if (params[0] === "@") {
		params = params.replace(rBracketQuote, ".");
	}
	result = (params + (tmpl ? " " : "")).replace(rParams, parseTokens);

	return !parenDepth && result || syntaxError(params); // Syntax error if unbalanced parens in params expression
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

	if ("" + tmpl === tmpl) {
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
		if ("" + node === node) {
			// a markup string to be inserted
			code += '\n+"' + node + '"';
		} else {
			// a compiled tag expression to be inserted
			tagName = node[0];
			if (tagName === "*") {
				// Code tag: {{* }}
				code += ";\n" + node[1] + "\nret=ret";
			} else {
				converter = node[1];
				content = !isLinkExpr && node[2];
				tagCtx = paramStructure(node[3], 'params') + '},' + paramStructure(params = node[4]);
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
					tagCtxFn = new Function("data,view,j,u", "// " + tmplName + " " + (++tmplBindingKey) + " " + tagName
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
						code = new Function("data,view,j,u", " // " + tmplName + " " + tmplBindingKey + " " + tagAndElses + retStrOpen + code
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
					code += ';\n}catch(e){ret' + (isLinkExpr ? "urn " : "+=") + boundOnErrStart + 'j._err(e,view,' + onError + ')' + boundOnErrEnd + ';}' + (isLinkExpr ? "" : 'ret=ret');
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
				? (node[8]  // late @... path?
						? ", ob"
						: ""
					) + ";\n"
				: ',ret=""')
		+ code
		+ (isLinkExpr ? "\n" : ";\nreturn ret;");

	try {
		code = new Function("data,view,j,u", code);
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
		props = [];

	if (typeof source === OBJECT || $isFunction(source)) {
		for (key in source) {
			prop = source[key];
			if (key !== $expando && source.hasOwnProperty(key) && (!tagCtx.props.noFunctions || !$.isFunction(prop))) {
				props.push({key: key, prop: prop});
			}
		}
	}
	return getTargetSorted(props, tagCtx);
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
	if (directSort || sort && "" + sort === sort) {
		// Temporary mapped array holds objects with index and sort-value
		mapped = value.map(function(item, i) {
			item = directSort ? item : getPathObject(item, sort);
			return {i: i, v: "" + item === item ? item.toLowerCase() : item};
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
		value = value.sort(sort);
	}
	if (reverse < 0 && !sort) { // Reverse result if not already reversed in sort
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

	start = props.start; // Get current value - after possible  changes triggered by tag.sorted refresh() above
	end = props.end;
	if (propParams.start && start === undefined || propParams.end && end === undefined) {
		start = end = 0;
	}
	if (!isNaN(start) || !isNaN(end)) { // start or end specified, but not the auto-create Number array scenario of {{for start=xxx end=yyy}}
		start = +start || 0;
		end = end === undefined || end > value.length ? value.length : +end;
//		end = end === undefined ? value.length : +end;
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
  return "" + text === text ? text.replace(rDataEncode, getCharEntity) : text;
}

function dataUnencode(text) {
  // Unencode just < > and & - intended for 'safe data' along with {{:}} rather than {{>}}
  return "" + text === text ? text.replace(rDataUnencode, getCharFromEntity) : text;
}

//========================== Initialize ==========================

$sub = $views.sub;
$viewsSettings = $views.settings;

if (!(jsr || $ && $.render)) {
	// JsRender not already loaded, or loaded without jQuery, and we are now moving from jsrender namespace to jQuery namepace
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
				throw "JsObservable requires JsRender " + versionNumber;
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
	* @param {boolean}  debugMode
	* @returns {Settings}
	*
	* debugMode = $.views.settings.debugMode()
	* @returns {boolean}
	*/
	($viewsSettings.debugMode = function(debugMode) {
		return debugMode === undefined
			? $subSettings.debugMode
			: (
				$subSettings.debugMode = debugMode,
				$subSettings.onError = debugMode + "" === debugMode
					? function() { return debugMode; }
					: $isFunction(debugMode)
						? debugMode
						: undefined,
				$viewsSettings);
	})(false); // jshint ignore:line

	$subSettingsAdvanced = $subSettings.advanced = {
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
				var l, tagCtx, props, sort,
					self = this,
					tagCtxs = self.tagCtxs;
				l = tagCtxs.length;
				while (l--) {
					tagCtx = tagCtxs[l];
					props = tagCtx.props;
					tagCtx.argDefault = props.end === undefined || tagCtx.args.length > 0; // Default to #data except for auto-create range scenario {{for start=xxx end=yyy step=zzz}}

					if (tagCtx.argDefault !== false && $isArray(tagCtx.args[0])
						&& (props.sort !== undefined || tagCtx.params.props.start || tagCtx.params.props.end || props.step !== undefined || props.filter || props.reverse)) {
						props.dataMap = self.sortDataMap;
					}
				}
			},
			render: function(val) {
				// This function is called once for {{for}} and once for each {{else}}.
				// We will use the tag.rendering object for carrying rendering state across the calls.
				var value, filter, srtField, isArray, i, sorted, end, step,
					self = this,
					tagCtx = self.tagCtx,
					range = tagCtx.argDefault === false,
					props = tagCtx.props,
					iterate =  range || tagCtx.args.length, // Not final else and not auto-create range
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xMi1uZXN0ZWQtdW5pdC10ZXN0cy5qcyIsInRlc3QvdGVtcGxhdGVzL2lubmVyLmh0bWwiLCJ0ZXN0L3RlbXBsYXRlcy9vdXRlci5odG1sIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3QwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIEpzUmVuZGVyIHYxLjAuMDogaHR0cDovL2pzdmlld3MuY29tLyNqc3JlbmRlciAqL1xuLyohICoqVkVSU0lPTiBGT1IgV0VCKiogKEZvciBOT0RFLkpTIHNlZSBodHRwOi8vanN2aWV3cy5jb20vZG93bmxvYWQvanNyZW5kZXItbm9kZS5qcykgKi9cbi8qXG4gKiBCZXN0LW9mLWJyZWVkIHRlbXBsYXRpbmcgaW4gYnJvd3NlciBvciBvbiBOb2RlLmpzLlxuICogRG9lcyBub3QgcmVxdWlyZSBqUXVlcnksIG9yIEhUTUwgRE9NXG4gKiBJbnRlZ3JhdGVzIHdpdGggSnNWaWV3cyAoaHR0cDovL2pzdmlld3MuY29tLyNqc3ZpZXdzKVxuICpcbiAqIENvcHlyaWdodCAyMDE4LCBCb3JpcyBNb29yZVxuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLlxuICovXG5cbi8vanNoaW50IC1XMDE4LCAtVzA0MSwgLVcxMjBcblxuKGZ1bmN0aW9uKGZhY3RvcnksIGdsb2JhbCkge1xuXHQvLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxuXHR2YXIgJCA9IGdsb2JhbC5qUXVlcnk7XG5cblx0aWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7IC8vIENvbW1vbkpTIGUuZy4gQnJvd3NlcmlmeVxuXHRcdG1vZHVsZS5leHBvcnRzID0gJFxuXHRcdFx0PyBmYWN0b3J5KGdsb2JhbCwgJClcblx0XHRcdDogZnVuY3Rpb24oJCkgeyAvLyBJZiBubyBnbG9iYWwgalF1ZXJ5LCB0YWtlIG9wdGlvbmFsIGpRdWVyeSBwYXNzZWQgYXMgcGFyYW1ldGVyOiByZXF1aXJlKCdqc3JlbmRlcicpKGpRdWVyeSlcblx0XHRcdFx0aWYgKCQgJiYgISQuZm4pIHtcblx0XHRcdFx0XHR0aHJvdyBcIlByb3ZpZGUgalF1ZXJ5IG9yIG51bGxcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwsICQpO1xuXHRcdFx0fTtcblx0fSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgc2NyaXB0IGxvYWRlciwgZS5nLiBSZXF1aXJlSlNcblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwpO1xuXHRcdH0pO1xuXHR9IGVsc2UgeyAvLyBCcm93c2VyIHVzaW5nIHBsYWluIDxzY3JpcHQ+IHRhZ1xuXHRcdGZhY3RvcnkoZ2xvYmFsLCBmYWxzZSk7XG5cdH1cbn0gKFxuXG4vLyBmYWN0b3J5IChmb3IganNyZW5kZXIuanMpXG5mdW5jdGlvbihnbG9iYWwsICQpIHtcblwidXNlIHN0cmljdFwiO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCB2YXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIGdsb2JhbCB2YXIgaXMgdGhlIHRoaXMgb2JqZWN0LCB3aGljaCBpcyB3aW5kb3cgd2hlbiBydW5uaW5nIGluIHRoZSB1c3VhbCBicm93c2VyIGVudmlyb25tZW50XG52YXIgc2V0R2xvYmFscyA9ICQgPT09IGZhbHNlOyAvLyBPbmx5IHNldCBnbG9iYWxzIGlmIHNjcmlwdCBibG9jayBpbiBicm93c2VyIChub3QgQU1EIGFuZCBub3QgQ29tbW9uSlMpXG5cbiQgPSAkICYmICQuZm4gPyAkIDogZ2xvYmFsLmpRdWVyeTsgLy8gJCBpcyBqUXVlcnkgcGFzc2VkIGluIGJ5IENvbW1vbkpTIGxvYWRlciAoQnJvd3NlcmlmeSksIG9yIGdsb2JhbCBqUXVlcnkuXG5cbnZhciB2ZXJzaW9uTnVtYmVyID0gXCJ2MS4wLjBcIixcblx0anN2U3RvcmVOYW1lLCByVGFnLCByVG1wbFN0cmluZywgdG9wVmlldywgJHZpZXdzLCAkZXhwYW5kbyxcblx0X29jcCA9IFwiX29jcFwiLCAvLyBPYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cbi8vVE9ET1x0dG1wbEZuc0NhY2hlID0ge30sXG5cdCRpc0Z1bmN0aW9uLCAkaXNBcnJheSwgJHRlbXBsYXRlcywgJGNvbnZlcnRlcnMsICRoZWxwZXJzLCAkdGFncywgJHN1YiwgJHN1YlNldHRpbmdzLCAkc3ViU2V0dGluZ3NBZHZhbmNlZCwgJHZpZXdzU2V0dGluZ3MsIGRlbGltT3BlbkNoYXIwLCBkZWxpbU9wZW5DaGFyMSwgZGVsaW1DbG9zZUNoYXIwLCBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyLCBzZXR0aW5nLCBiYXNlT25FcnJvcixcblxuXHRyUGF0aCA9IC9eKCEqPykoPzpudWxsfHRydWV8ZmFsc2V8XFxkW1xcZC5dKnwoW1xcdyRdK3xcXC58fihbXFx3JF0rKXwjKHZpZXd8KFtcXHckXSspKT8pKFtcXHckLl5dKj8pKD86Wy5bXl0oW1xcdyRdKylcXF0/KT8pJC9nLFxuXHQvLyAgICAgICAgbm90ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdCAgICAgaGVscGVyICAgIHZpZXcgIHZpZXdQcm9wZXJ0eSBwYXRoVG9rZW5zICAgICAgbGVhZlRva2VuXG5cblx0clBhcmFtcyA9IC8oXFwoKSg/PVxccypcXCgpfCg/OihbKFtdKVxccyopPyg/OihcXF4/KSh+P1tcXHckLl5dKyk/XFxzKigoXFwrXFwrfC0tKXxcXCt8LXx+KD8hW1xcdyRfXSl8JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqPyhAKT9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfChcXCg/KVxcXFw/KD86KCcpfChcIikpfCg/OlxccyooKFspXFxdXSkoPz1bLl5dfFxccyokfFteKFtdKXxbKVxcXV0pKFsoW10/KSl8KFxccyspL2csXG5cdC8vICAgICAgICAgbGZ0UHJuMCAgICAgICAgICBsZnRQcm4gICAgICAgIGJvdW5kIHBhdGggICAgICAgICAgICAgb3BlcmF0b3IgZXJyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcSAgICAgIHBhdGgyIGxhdGUgICAgICAgICAgICBwcm4gICAgICBjb21tYSAgbGZ0UHJuMiAgIGFwb3MgcXVvdCAgICAgICAgcnRQcm4gIHJ0UHJuRG90ICAgICAgICAgICAgICAgICAgcHJuMiAgICAgc3BhY2Vcblx0Ly8gKGxlZnQgcGFyZW4/IGZvbGxvd2VkIGJ5IChwYXRoPyBmb2xsb3dlZCBieSBvcGVyYXRvcikgb3IgKHBhdGggZm9sbG93ZWQgYnkgbGVmdCBwYXJlbj8pKSBvciBjb21tYSBvciBhcG9zIG9yIHF1b3Qgb3IgcmlnaHQgcGFyZW4gb3Igc3BhY2VcblxuXHRpc1JlbmRlckNhbGwsXG5cdHJOZXdMaW5lID0gL1sgXFx0XSooXFxyXFxufFxcbnxcXHIpL2csXG5cdHJVbmVzY2FwZVF1b3RlcyA9IC9cXFxcKFsnXCJdKS9nLFxuXHRyRXNjYXBlUXVvdGVzID0gL1snXCJcXFxcXS9nLCAvLyBFc2NhcGUgcXVvdGVzIGFuZCBcXCBjaGFyYWN0ZXJcblx0ckJ1aWxkSGFzaCA9IC8oPzpcXHgwOHxeKShvbmVycm9yOik/KD86KH4/KSgoW1xcdyRfXFwuXSspOik/KFteXFx4MDhdKykpXFx4MDgoLCk/KFteXFx4MDhdKykvZ2ksXG5cdHJUZXN0RWxzZUlmID0gL15pZlxccy8sXG5cdHJGaXJzdEVsZW0gPSAvPChcXHcrKVs+XFxzXS8sXG5cdHJBdHRyRW5jb2RlID0gL1tcXHgwMGA+PFwiJyY9XS9nLCAvLyBJbmNsdWRlcyA+IGVuY29kaW5nIHNpbmNlIHJDb252ZXJ0TWFya2VycyBpbiBKc1ZpZXdzIGRvZXMgbm90IHNraXAgPiBjaGFyYWN0ZXJzIGluIGF0dHJpYnV0ZSBzdHJpbmdzXG5cdHJJc0h0bWwgPSAvW1xceDAwYD48XFxcIicmPV0vLFxuXHRySGFzSGFuZGxlcnMgPSAvXm9uW0EtWl18XmNvbnZlcnQoQmFjayk/JC8sXG5cdHJXcmFwcGVkSW5WaWV3TWFya2VyID0gL15cXCNcXGQrX2BbXFxzXFxTXSpcXC9cXGQrX2AkLyxcblx0ckh0bWxFbmNvZGUgPSByQXR0ckVuY29kZSxcblx0ckRhdGFFbmNvZGUgPSAvWyY8Pl0vZyxcblx0ckRhdGFVbmVuY29kZSA9IC8mKGFtcHxndHxsdCk7L2csXG5cdHJCcmFja2V0UXVvdGUgPSAvXFxbWydcIl0/fFsnXCJdP1xcXS9nLFxuXHR2aWV3SWQgPSAwLFxuXHRjaGFyRW50aXRpZXMgPSB7XG5cdFx0XCImXCI6IFwiJmFtcDtcIixcblx0XHRcIjxcIjogXCImbHQ7XCIsXG5cdFx0XCI+XCI6IFwiJmd0O1wiLFxuXHRcdFwiXFx4MDBcIjogXCImIzA7XCIsXG5cdFx0XCInXCI6IFwiJiMzOTtcIixcblx0XHQnXCInOiBcIiYjMzQ7XCIsXG5cdFx0XCJgXCI6IFwiJiM5NjtcIixcblx0XHRcIj1cIjogXCImIzYxO1wiXG5cdH0sXG5cdGNoYXJzRnJvbUVudGl0aWVzICA9IHtcblx0XHRhbXA6IFwiJlwiLFxuXHRcdGd0OiBcIj5cIixcblx0XHRsdDogXCI8XCJcblx0fSxcblx0SFRNTCA9IFwiaHRtbFwiLFxuXHRPQkpFQ1QgPSBcIm9iamVjdFwiLFxuXHR0bXBsQXR0ciA9IFwiZGF0YS1qc3YtdG1wbFwiLFxuXHRqc3ZUbXBsID0gXCJqc3ZUbXBsXCIsXG5cdGluZGV4U3RyID0gXCJGb3IgI2luZGV4IGluIG5lc3RlZCBibG9jayB1c2UgI2dldEluZGV4KCkuXCIsXG5cdCRyZW5kZXIgPSB7fSxcblxuXHRqc3IgPSBnbG9iYWwuanNyZW5kZXIsXG5cdGpzclRvSnEgPSBqc3IgJiYgJCAmJiAhJC5yZW5kZXIsIC8vIEpzUmVuZGVyIGFscmVhZHkgbG9hZGVkLCB3aXRob3V0IGpRdWVyeS4gYnV0IHdlIHdpbGwgcmUtbG9hZCBpdCBub3cgdG8gYXR0YWNoIHRvIGpRdWVyeVxuXG5cdGpzdlN0b3JlcyA9IHtcblx0XHR0ZW1wbGF0ZToge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRtcGxcblx0XHR9LFxuXHRcdHRhZzoge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRhZ1xuXHRcdH0sXG5cdFx0dmlld01vZGVsOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVmlld01vZGVsXG5cdFx0fSxcblx0XHRoZWxwZXI6IHt9LFxuXHRcdGNvbnZlcnRlcjoge31cblx0fTtcblxuXHQvLyB2aWV3cyBvYmplY3QgKCQudmlld3MgaWYgalF1ZXJ5IGlzIGxvYWRlZCwganNyZW5kZXIudmlld3MgaWYgbm8galF1ZXJ5LCBlLmcuIGluIE5vZGUuanMpXG5cdCR2aWV3cyA9IHtcblx0XHRqc3ZpZXdzOiB2ZXJzaW9uTnVtYmVyLFxuXHRcdHN1Yjoge1xuXHRcdFx0Ly8gc3Vic2NyaXB0aW9uLCBlLmcuIEpzVmlld3MgaW50ZWdyYXRpb25cblx0XHRcdFZpZXc6IFZpZXcsXG5cdFx0XHRFcnI6IEpzVmlld3NFcnJvcixcblx0XHRcdHRtcGxGbjogdG1wbEZuLFxuXHRcdFx0cGFyc2U6IHBhcnNlUGFyYW1zLFxuXHRcdFx0ZXh0ZW5kOiAkZXh0ZW5kLFxuXHRcdFx0ZXh0ZW5kQ3R4OiBleHRlbmRDdHgsXG5cdFx0XHRzeW50YXhFcnI6IHN5bnRheEVycm9yLFxuXHRcdFx0b25TdG9yZToge1xuXHRcdFx0XHR0ZW1wbGF0ZTogZnVuY3Rpb24obmFtZSwgaXRlbSkge1xuXHRcdFx0XHRcdGlmIChpdGVtID09PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgJHJlbmRlcltuYW1lXTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKG5hbWUpIHtcblx0XHRcdFx0XHRcdCRyZW5kZXJbbmFtZV0gPSBpdGVtO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZFNldHRpbmc6IGFkZFNldHRpbmcsXG5cdFx0XHRzZXR0aW5nczoge1xuXHRcdFx0XHRhbGxvd0NvZGU6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0YWR2U2V0OiBub29wLCAvLyBVcGRhdGUgYWR2YW5jZWQgc2V0dGluZ3Ncblx0XHRcdF90aHA6IHRhZ0hhbmRsZXJzRnJvbVByb3BzLFxuXHRcdFx0X2dtOiBnZXRNZXRob2QsXG5cdFx0XHRfdGc6IGZ1bmN0aW9uKCkge30sIC8vIENvbnN0cnVjdG9yIGZvciB0YWdEZWZcblx0XHRcdF9jbnZ0OiBjb252ZXJ0VmFsLFxuXHRcdFx0X3RhZzogcmVuZGVyVGFnLFxuXHRcdFx0X2VyOiBlcnJvcixcblx0XHRcdF9lcnI6IG9uUmVuZGVyRXJyb3IsXG5cdFx0XHRfY3A6IHJldFZhbCwgLy8gR2V0IG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJzIChvciBwcm9wZXJ0aWVzKSB+Zm9vPWV4cHIuIEluIEpzUmVuZGVyLCBzaW1wbHkgcmV0dXJucyB2YWwuXG5cdFx0XHRfc3E6IGZ1bmN0aW9uKHRva2VuKSB7XG5cdFx0XHRcdGlmICh0b2tlbiA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG5cdFx0XHRcdFx0c3ludGF4RXJyb3IoXCJcIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRva2VuO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2V0dGluZ3M6IHtcblx0XHRcdGRlbGltaXRlcnM6ICR2aWV3c0RlbGltaXRlcnMsXG5cdFx0XHRhZHZhbmNlZDogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlXG5cdFx0XHRcdFx0PyAoXG5cdFx0XHRcdFx0XHRcdCRleHRlbmQoJHN1YlNldHRpbmdzQWR2YW5jZWQsIHZhbHVlKSxcblx0XHRcdFx0XHRcdFx0JHN1Yi5hZHZTZXQoKSxcblx0XHRcdFx0XHRcdFx0JHZpZXdzU2V0dGluZ3Ncblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdDogJHN1YlNldHRpbmdzQWR2YW5jZWQ7XG5cdFx0XHRcdH1cblx0XHR9LFxuXHRcdG1hcDogZGF0YU1hcCAgICAvLyBJZiBqc09ic2VydmFibGUgbG9hZGVkIGZpcnN0LCB1c2UgdGhhdCBkZWZpbml0aW9uIG9mIGRhdGFNYXBcblx0fTtcblxuZnVuY3Rpb24gZ2V0RGVyaXZlZE1ldGhvZChiYXNlTWV0aG9kLCBtZXRob2QpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdHZhciByZXQsXG5cdFx0XHR0YWcgPSB0aGlzLFxuXHRcdFx0cHJldkJhc2UgPSB0YWcuYmFzZTtcblxuXHRcdHRhZy5iYXNlID0gYmFzZU1ldGhvZDsgLy8gV2l0aGluIG1ldGhvZCBjYWxsLCBjYWxsaW5nIHRoaXMuYmFzZSB3aWxsIGNhbGwgdGhlIGJhc2UgbWV0aG9kXG5cdFx0cmV0ID0gbWV0aG9kLmFwcGx5KHRhZywgYXJndW1lbnRzKTsgLy8gQ2FsbCB0aGUgbWV0aG9kXG5cdFx0dGFnLmJhc2UgPSBwcmV2QmFzZTsgLy8gUmVwbGFjZSB0aGlzLmJhc2UgdG8gYmUgdGhlIGJhc2UgbWV0aG9kIG9mIHRoZSBwcmV2aW91cyBjYWxsLCBmb3IgY2hhaW5lZCBjYWxsc1xuXHRcdHJldHVybiByZXQ7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGdldE1ldGhvZChiYXNlTWV0aG9kLCBtZXRob2QpIHtcblx0Ly8gRm9yIGRlcml2ZWQgbWV0aG9kcyAob3IgaGFuZGxlcnMgZGVjbGFyZWQgZGVjbGFyYXRpdmVseSBhcyBpbiB7ezpmb28gb25DaGFuZ2U9fmZvb0NoYW5nZWR9fSByZXBsYWNlIGJ5IGEgZGVyaXZlZCBtZXRob2QsIHRvIGFsbG93IHVzaW5nIHRoaXMuYmFzZSguLi4pXG5cdC8vIG9yIHRoaXMuYmFzZUFwcGx5KGFyZ3VtZW50cykgdG8gY2FsbCB0aGUgYmFzZSBpbXBsZW1lbnRhdGlvbi4gKEVxdWl2YWxlbnQgdG8gdGhpcy5fc3VwZXIoLi4uKSBhbmQgdGhpcy5fc3VwZXJBcHBseShhcmd1bWVudHMpIGluIGpRdWVyeSBVSSlcblx0aWYgKCRpc0Z1bmN0aW9uKG1ldGhvZCkpIHtcblx0XHRtZXRob2QgPSBnZXREZXJpdmVkTWV0aG9kKFxuXHRcdFx0XHQhYmFzZU1ldGhvZFxuXHRcdFx0XHRcdD8gbm9vcCAvLyBubyBiYXNlIG1ldGhvZCBpbXBsZW1lbnRhdGlvbiwgc28gdXNlIG5vb3AgYXMgYmFzZSBtZXRob2Rcblx0XHRcdFx0XHQ6IGJhc2VNZXRob2QuX2Rcblx0XHRcdFx0XHRcdD8gYmFzZU1ldGhvZCAvLyBiYXNlTWV0aG9kIGlzIGEgZGVyaXZlZCBtZXRob2QsIHNvIHVzZSBpdFxuXHRcdFx0XHRcdFx0OiBnZXREZXJpdmVkTWV0aG9kKG5vb3AsIGJhc2VNZXRob2QpLCAvLyBiYXNlTWV0aG9kIGlzIG5vdCBkZXJpdmVkIHNvIG1ha2UgaXRzIGJhc2UgbWV0aG9kIGJlIHRoZSBub29wIG1ldGhvZFxuXHRcdFx0XHRtZXRob2Rcblx0XHRcdCk7XG5cdFx0bWV0aG9kLl9kID0gKGJhc2VNZXRob2QgJiYgYmFzZU1ldGhvZC5fZCB8fCAwKSArIDE7IC8vIEFkZCBmbGFnIGZvciBkZXJpdmVkIG1ldGhvZCAoaW5jcmVtZW50ZWQgZm9yIGRlcml2ZWQgb2YgZGVyaXZlZC4uLilcblx0fVxuXHRyZXR1cm4gbWV0aG9kO1xufVxuXG5mdW5jdGlvbiB0YWdIYW5kbGVyc0Zyb21Qcm9wcyh0YWcsIHRhZ0N0eCkge1xuXHR2YXIgcHJvcCxcblx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcztcblx0Zm9yIChwcm9wIGluIHByb3BzKSB7XG5cdFx0aWYgKHJIYXNIYW5kbGVycy50ZXN0KHByb3ApICYmICEodGFnW3Byb3BdICYmIHRhZ1twcm9wXS5maXgpKSB7IC8vIERvbid0IG92ZXJyaWRlIGhhbmRsZXJzIHdpdGggZml4IGV4cGFuZG8gKHVzZWQgaW4gZGF0ZXBpY2tlciBhbmQgc3Bpbm5lcilcblx0XHRcdHRhZ1twcm9wXSA9IHByb3AgIT09IFwiY29udmVydFwiID8gZ2V0TWV0aG9kKHRhZy5jb25zdHJ1Y3Rvci5wcm90b3R5cGVbcHJvcF0sIHByb3BzW3Byb3BdKSA6IHByb3BzW3Byb3BdO1xuXHRcdFx0Ly8gQ29weSBvdmVyIHRoZSBvbkZvbyBwcm9wcywgY29udmVydCBhbmQgY29udmVydEJhY2sgZnJvbSB0YWdDdHgucHJvcHMgdG8gdGFnIChvdmVycmlkZXMgdmFsdWVzIGluIHRhZ0RlZikuXG5cdFx0XHQvLyBOb3RlOiB1bnN1cHBvcnRlZCBzY2VuYXJpbzogaWYgaGFuZGxlcnMgYXJlIGR5bmFtaWNhbGx5IGFkZGVkIF5vbkZvbz1leHByZXNzaW9uIHRoaXMgd2lsbCB3b3JrLCBidXQgZHluYW1pY2FsbHkgcmVtb3Zpbmcgd2lsbCBub3Qgd29yay5cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcmV0VmFsKHZhbCkge1xuXHRyZXR1cm4gdmFsO1xufVxuXG5mdW5jdGlvbiBub29wKCkge1xuXHRyZXR1cm4gXCJcIjtcbn1cblxuZnVuY3Rpb24gZGJnQnJlYWsodmFsKSB7XG5cdC8vIFVzYWdlIGV4YW1wbGVzOiB7e2RiZzouLi59fSwge3s6fmRiZyguLi4pfX0sIHt7ZGJnIC4uLi99fSwge157Zm9yIC4uLiBvbkFmdGVyTGluaz1+ZGJnfX0gZXRjLlxuXHR0cnkge1xuXHRcdGNvbnNvbGUubG9nKFwiSnNSZW5kZXIgZGJnIGJyZWFrcG9pbnQ6IFwiICsgdmFsKTtcblx0XHR0aHJvdyBcImRiZyBicmVha3BvaW50XCI7IC8vIFRvIGJyZWFrIGhlcmUsIHN0b3Agb24gY2F1Z2h0IGV4Y2VwdGlvbnMuXG5cdH1cblx0Y2F0Y2ggKGUpIHt9XG5cdHJldHVybiB0aGlzLmJhc2UgPyB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIDogdmFsO1xufVxuXG5mdW5jdGlvbiBKc1ZpZXdzRXJyb3IobWVzc2FnZSkge1xuXHQvLyBFcnJvciBleGNlcHRpb24gdHlwZSBmb3IgSnNWaWV3cy9Kc1JlbmRlclxuXHQvLyBPdmVycmlkZSBvZiAkLnZpZXdzLnN1Yi5FcnJvciBpcyBwb3NzaWJsZVxuXHR0aGlzLm5hbWUgPSAoJC5saW5rID8gXCJKc1ZpZXdzXCIgOiBcIkpzUmVuZGVyXCIpICsgXCIgRXJyb3JcIjtcblx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCB0aGlzLm5hbWU7XG59XG5cbmZ1bmN0aW9uICRleHRlbmQodGFyZ2V0LCBzb3VyY2UpIHtcblx0aWYgKHRhcmdldCkge1xuXHRcdGZvciAodmFyIG5hbWUgaW4gc291cmNlKSB7XG5cdFx0XHR0YXJnZXRbbmFtZV0gPSBzb3VyY2VbbmFtZV07XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH1cbn1cblxuKEpzVmlld3NFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKSkuY29uc3RydWN0b3IgPSBKc1ZpZXdzRXJyb3I7XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gVG9wLWxldmVsIGZ1bmN0aW9ucyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLz09PT09PT09PT09PT09PT09PT1cbi8vIHZpZXdzLmRlbGltaXRlcnNcbi8vPT09PT09PT09PT09PT09PT09PVxuXG5cdC8qKlxuXHQqIFNldCB0aGUgdGFnIG9wZW5pbmcgYW5kIGNsb3NpbmcgZGVsaW1pdGVycyBhbmQgJ2xpbmsnIGNoYXJhY3Rlci4gRGVmYXVsdCBpcyBcInt7XCIsIFwifX1cIiBhbmQgXCJeXCJcblx0KiBvcGVuQ2hhcnMsIGNsb3NlQ2hhcnM6IG9wZW5pbmcgYW5kIGNsb3Npbmcgc3RyaW5ncywgZWFjaCB3aXRoIHR3byBjaGFyYWN0ZXJzXG5cdCogJC52aWV3cy5zZXR0aW5ncy5kZWxpbWl0ZXJzKC4uLilcblx0KlxuXHQqIEBwYXJhbSB7c3RyaW5nfSAgIG9wZW5DaGFyc1xuXHQqIEBwYXJhbSB7c3RyaW5nfSAgIFtjbG9zZUNoYXJzXVxuXHQqIEBwYXJhbSB7c3RyaW5nfSAgIFtsaW5rXVxuXHQqIEByZXR1cm5zIHtTZXR0aW5nc31cblx0KlxuXHQqIEdldCBkZWxpbWl0ZXJzXG5cdCogZGVsaW1zQXJyYXkgPSAkLnZpZXdzLnNldHRpbmdzLmRlbGltaXRlcnMoKVxuXHQqXG5cdCogQHJldHVybnMge3N0cmluZ1tdfVxuXHQqL1xuZnVuY3Rpb24gJHZpZXdzRGVsaW1pdGVycyhvcGVuQ2hhcnMsIGNsb3NlQ2hhcnMsIGxpbmspIHtcblx0aWYgKCFvcGVuQ2hhcnMpIHtcblx0XHRyZXR1cm4gJHN1YlNldHRpbmdzLmRlbGltaXRlcnM7XG5cdH1cblx0aWYgKCRpc0FycmF5KG9wZW5DaGFycykpIHtcblx0XHRyZXR1cm4gJHZpZXdzRGVsaW1pdGVycy5hcHBseSgkdmlld3MsIG9wZW5DaGFycyk7XG5cdH1cblx0bGlua0NoYXIgPSBsaW5rID8gbGlua1swXSA6IGxpbmtDaGFyO1xuXHRpZiAoIS9eKFxcV3xfKXs1fSQvLnRlc3Qob3BlbkNoYXJzICsgY2xvc2VDaGFycyArIGxpbmtDaGFyKSkge1xuXHRcdGVycm9yKFwiSW52YWxpZCBkZWxpbWl0ZXJzXCIpOyAvLyBNdXN0IGJlIG5vbi13b3JkIGNoYXJhY3RlcnMsIGFuZCBvcGVuQ2hhcnMgYW5kIGNsb3NlQ2hhcnMgbXVzdCBlYWNoIGJlIGxlbmd0aCAyXG5cdH1cblx0ZGVsaW1PcGVuQ2hhcjAgPSBvcGVuQ2hhcnNbMF07XG5cdGRlbGltT3BlbkNoYXIxID0gb3BlbkNoYXJzWzFdO1xuXHRkZWxpbUNsb3NlQ2hhcjAgPSBjbG9zZUNoYXJzWzBdO1xuXHRkZWxpbUNsb3NlQ2hhcjEgPSBjbG9zZUNoYXJzWzFdO1xuXG5cdCRzdWJTZXR0aW5ncy5kZWxpbWl0ZXJzID0gW2RlbGltT3BlbkNoYXIwICsgZGVsaW1PcGVuQ2hhcjEsIGRlbGltQ2xvc2VDaGFyMCArIGRlbGltQ2xvc2VDaGFyMSwgbGlua0NoYXJdO1xuXG5cdC8vIEVzY2FwZSB0aGUgY2hhcmFjdGVycyAtIHNpbmNlIHRoZXkgY291bGQgYmUgcmVnZXggc3BlY2lhbCBjaGFyYWN0ZXJzXG5cdG9wZW5DaGFycyA9IFwiXFxcXFwiICsgZGVsaW1PcGVuQ2hhcjAgKyBcIihcXFxcXCIgKyBsaW5rQ2hhciArIFwiKT9cXFxcXCIgKyBkZWxpbU9wZW5DaGFyMTsgLy8gRGVmYXVsdCBpcyBcIntee1wiXG5cdGNsb3NlQ2hhcnMgPSBcIlxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIxOyAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGlzIFwifX1cIlxuXHQvLyBCdWlsZCByZWdleCB3aXRoIG5ldyBkZWxpbWl0ZXJzXG5cdC8vICAgICAgICAgIFt0YWcgICAgKGZvbGxvd2VkIGJ5IC8gc3BhY2Ugb3IgfSkgIG9yIGN2dHIrY29sb24gb3IgaHRtbCBvciBjb2RlXSBmb2xsb3dlZCBieSBzcGFjZStwYXJhbXMgdGhlbiBjb252ZXJ0QmFjaz9cblx0clRhZyA9IFwiKD86KFxcXFx3Kyg/PVtcXFxcL1xcXFxzXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIwICsgXCJdKSl8KFxcXFx3Kyk/KDopfCg+KXwoXFxcXCopKVxcXFxzKigoPzpbXlxcXFxcIlxuXHRcdCsgZGVsaW1DbG9zZUNoYXIwICsgXCJdfFxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiKD8hXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIxICsgXCIpKSo/KVwiO1xuXG5cdC8vIE1ha2UgclRhZyBhdmFpbGFibGUgdG8gSnNWaWV3cyAob3Igb3RoZXIgY29tcG9uZW50cykgZm9yIHBhcnNpbmcgYmluZGluZyBleHByZXNzaW9uc1xuXHQkc3ViLnJUYWcgPSBcIig/OlwiICsgclRhZyArIFwiKVwiO1xuXHQvLyAgICAgICAgICAgICAgICAgICAgICAgIHsgXj8geyAgIHRhZytwYXJhbXMgc2xhc2g/ICBvciBjbG9zaW5nVGFnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3IgY29tbWVudFxuXHRyVGFnID0gbmV3IFJlZ0V4cChcIig/OlwiICsgb3BlbkNoYXJzICsgclRhZyArIFwiKFxcXFwvKT98XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjAgKyBcIihcXFxcXCIgKyBsaW5rQ2hhciArIFwiKT9cXFxcXCIgKyBkZWxpbU9wZW5DaGFyMSArIFwiKD86KD86XFxcXC8oXFxcXHcrKSlcXFxccyp8IS0tW1xcXFxzXFxcXFNdKj8tLSkpXCIgKyBjbG9zZUNoYXJzLCBcImdcIik7XG5cblx0Ly8gRGVmYXVsdDogIGJpbmQgICAgIHRhZ05hbWUgICAgICAgICBjdnQgICBjbG4gaHRtbCBjb2RlICAgIHBhcmFtcyAgICAgICAgICAgIHNsYXNoICAgYmluZDIgICAgICAgICBjbG9zZUJsayAgY29tbWVudFxuXHQvLyAgICAgIC8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19XG5cblx0JHN1Yi5yVG1wbCA9IG5ldyBSZWdFeHAoXCJeXFxcXHN8XFxcXHMkfDwuKj58KFteXFxcXFxcXFxdfF4pW3t9XXxcIiArIG9wZW5DaGFycyArIFwiLipcIiArIGNsb3NlQ2hhcnMpO1xuXHQvLyAkc3ViLnJUbXBsIGxvb2tzIGZvciBpbml0aWFsIG9yIGZpbmFsIHdoaXRlIHNwYWNlLCBodG1sIHRhZ3Mgb3IgeyBvciB9IGNoYXIgbm90IHByZWNlZGVkIGJ5IFxcXFwsIG9yIEpzUmVuZGVyIHRhZ3Mge3t4eHh9fS5cblx0Ly8gRWFjaCBvZiB0aGVzZSBzdHJpbmdzIGFyZSBjb25zaWRlcmVkIE5PVCB0byBiZSBqUXVlcnkgc2VsZWN0b3JzXG5cdHJldHVybiAkdmlld3NTZXR0aW5ncztcbn1cblxuLy89PT09PT09PT1cbi8vIFZpZXcuZ2V0XG4vLz09PT09PT09PVxuXG5mdW5jdGlvbiBnZXRWaWV3KGlubmVyLCB0eXBlKSB7IC8vdmlldy5nZXQoaW5uZXIsIHR5cGUpXG5cdGlmICghdHlwZSAmJiBpbm5lciAhPT0gdHJ1ZSkge1xuXHRcdC8vIHZpZXcuZ2V0KHR5cGUpXG5cdFx0dHlwZSA9IGlubmVyO1xuXHRcdGlubmVyID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0dmFyIHZpZXdzLCBpLCBsLCBmb3VuZCxcblx0XHR2aWV3ID0gdGhpcyxcblx0XHRyb290ID0gdHlwZSA9PT0gXCJyb290XCI7XG5cdFx0Ly8gdmlldy5nZXQoXCJyb290XCIpIHJldHVybnMgdmlldy5yb290LCB2aWV3LmdldCgpIHJldHVybnMgdmlldy5wYXJlbnQsIHZpZXcuZ2V0KHRydWUpIHJldHVybnMgdmlldy52aWV3c1swXS5cblxuXHRpZiAoaW5uZXIpIHtcblx0XHQvLyBHbyB0aHJvdWdoIHZpZXdzIC0gdGhpcyBvbmUsIGFuZCBhbGwgbmVzdGVkIG9uZXMsIGRlcHRoLWZpcnN0IC0gYW5kIHJldHVybiBmaXJzdCBvbmUgd2l0aCBnaXZlbiB0eXBlLlxuXHRcdC8vIElmIHR5cGUgaXMgdW5kZWZpbmVkLCBpLmUuIHZpZXcuZ2V0KHRydWUpLCByZXR1cm4gZmlyc3QgY2hpbGQgdmlldy5cblx0XHRmb3VuZCA9IHR5cGUgJiYgdmlldy50eXBlID09PSB0eXBlICYmIHZpZXc7XG5cdFx0aWYgKCFmb3VuZCkge1xuXHRcdFx0dmlld3MgPSB2aWV3LnZpZXdzO1xuXHRcdFx0aWYgKHZpZXcuXy51c2VLZXkpIHtcblx0XHRcdFx0Zm9yIChpIGluIHZpZXdzKSB7XG5cdFx0XHRcdFx0aWYgKGZvdW5kID0gdHlwZSA/IHZpZXdzW2ldLmdldChpbm5lciwgdHlwZSkgOiB2aWV3c1tpXSkge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3IgKGkgPSAwLCBsID0gdmlld3MubGVuZ3RoOyAhZm91bmQgJiYgaSA8IGw7IGkrKykge1xuXHRcdFx0XHRcdGZvdW5kID0gdHlwZSA/IHZpZXdzW2ldLmdldChpbm5lciwgdHlwZSkgOiB2aWV3c1tpXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIGlmIChyb290KSB7XG5cdFx0Ly8gRmluZCByb290IHZpZXcuICh2aWV3IHdob3NlIHBhcmVudCBpcyB0b3Agdmlldylcblx0XHRmb3VuZCA9IHZpZXcucm9vdDtcblx0fSBlbHNlIGlmICh0eXBlKSB7XG5cdFx0d2hpbGUgKHZpZXcgJiYgIWZvdW5kKSB7XG5cdFx0XHQvLyBHbyB0aHJvdWdoIHZpZXdzIC0gdGhpcyBvbmUsIGFuZCBhbGwgcGFyZW50IG9uZXMgLSBhbmQgcmV0dXJuIGZpcnN0IG9uZSB3aXRoIGdpdmVuIHR5cGUuXG5cdFx0XHRmb3VuZCA9IHZpZXcudHlwZSA9PT0gdHlwZSA/IHZpZXcgOiB1bmRlZmluZWQ7XG5cdFx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGZvdW5kID0gdmlldy5wYXJlbnQ7XG5cdH1cblx0cmV0dXJuIGZvdW5kIHx8IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0TmVzdGVkSW5kZXgoKSB7XG5cdHZhciB2aWV3ID0gdGhpcy5nZXQoXCJpdGVtXCIpO1xuXHRyZXR1cm4gdmlldyA/IHZpZXcuaW5kZXggOiB1bmRlZmluZWQ7XG59XG5cbmdldE5lc3RlZEluZGV4LmRlcGVuZHMgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIFt0aGlzLmdldChcIml0ZW1cIiksIFwiaW5kZXhcIl07XG59O1xuXG5mdW5jdGlvbiBnZXRJbmRleCgpIHtcblx0cmV0dXJuIHRoaXMuaW5kZXg7XG59XG5cbmdldEluZGV4LmRlcGVuZHMgPSBcImluZGV4XCI7XG5cbi8vPT09PT09PT09PT09PT09PT09XG4vLyBWaWV3LmN0eFBybSwgZXRjLlxuLy89PT09PT09PT09PT09PT09PT1cblxuLyogSW50ZXJuYWwgcHJpdmF0ZTogdmlldy5fZ2V0T2IoKSAqL1xuZnVuY3Rpb24gZ2V0UGF0aE9iamVjdChvYiwgcGF0aCwgbHRPYiwgZm4pIHtcblx0Ly8gSXRlcmF0ZSB0aHJvdWdoIHBhdGggdG8gbGF0ZSBwYXRoczogQGEuYi5jIHBhdGhzXG5cdC8vIFJldHVybiBcIlwiIChvciBub29wIGlmIGxlYWYgaXMgYSBmdW5jdGlvbiBAYS5iLmMoLi4uKSApIGlmIGludGVybWVkaWF0ZSBvYmplY3Qgbm90IHlldCBhdmFpbGFibGVcblx0dmFyIHByZXZPYiwgdG9rZW5zLCBsLFxuXHRcdGkgPSAwO1xuXHRpZiAobHRPYiA9PT0gMSkge1xuXHRcdGZuID0gMTtcblx0XHRsdE9iID0gdW5kZWZpbmVkO1xuXHR9XG5cdC8vIFBhdGhzIGxpa2UgXmFeYl5jIG9yIH5eYV5iXmMgd2lsbCBub3QgdGhyb3cgaWYgYW4gb2JqZWN0IGluIHBhdGggaXMgdW5kZWZpbmVkLlxuXHRpZiAocGF0aCkge1xuXHRcdHRva2VucyA9IHBhdGguc3BsaXQoXCIuXCIpO1xuXHRcdGwgPSB0b2tlbnMubGVuZ3RoO1xuXG5cdFx0Zm9yICg7IG9iICYmIGkgPCBsOyBpKyspIHtcblx0XHRcdHByZXZPYiA9IG9iO1xuXHRcdFx0b2IgPSB0b2tlbnNbaV0gPyBvYlt0b2tlbnNbaV1dIDogb2I7XG5cdFx0fVxuXHR9XG5cdGlmIChsdE9iKSB7XG5cdFx0bHRPYi5sdCA9IGx0T2IubHQgfHwgaTxsOyAvLyBJZiBpIDwgbCB0aGVyZSB3YXMgYW4gb2JqZWN0IGluIHRoZSBwYXRoIG5vdCB5ZXQgYXZhaWxhYmxlXG5cdH1cblx0cmV0dXJuIG9iID09PSB1bmRlZmluZWRcblx0XHQ/IGZuID8gbm9vcCA6IFwiXCJcblx0XHQ6IGZuID8gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gb2IuYXBwbHkocHJldk9iLCBhcmd1bWVudHMpO1xuXHRcdH0gOiBvYjtcbn1cblxuZnVuY3Rpb24gY29udGV4dFBhcmFtZXRlcihrZXksIHZhbHVlLCBnZXQpIHtcblx0Ly8gSGVscGVyIG1ldGhvZCBjYWxsZWQgYXMgdmlldy5jdHhQcm0oa2V5KSBmb3IgaGVscGVycyBvciB0ZW1wbGF0ZSBwYXJhbWV0ZXJzIH5mb28gLSBmcm9tIGNvbXBpbGVkIHRlbXBsYXRlIG9yIGZyb20gY29udGV4dCBjYWxsYmFja1xuXHR2YXIgd3JhcHBlZCwgZGVwcywgcmVzLCBvYnNDdHhQcm0sIHRhZ0Vsc2UsIGNhbGxWaWV3LCBuZXdSZXMsXG5cdFx0c3RvcmVWaWV3ID0gdGhpcyxcblx0XHRpc1VwZGF0ZSA9ICFpc1JlbmRlckNhbGwgJiYgYXJndW1lbnRzLmxlbmd0aCA+IDEsXG5cdFx0c3RvcmUgPSBzdG9yZVZpZXcuY3R4O1xuXHRpZiAoa2V5KSB7XG5cdFx0aWYgKCFzdG9yZVZpZXcuXykgeyAvLyB0YWdDdHguY3R4UHJtKCkgY2FsbFxuXHRcdFx0dGFnRWxzZSA9IHN0b3JlVmlldy5pbmRleDtcblx0XHRcdHN0b3JlVmlldyA9IHN0b3JlVmlldy50YWc7XG5cdFx0fVxuXHRcdGNhbGxWaWV3ID0gc3RvcmVWaWV3O1xuXHRcdGlmIChzdG9yZSAmJiBzdG9yZS5oYXNPd25Qcm9wZXJ0eShrZXkpIHx8IChzdG9yZSA9ICRoZWxwZXJzKS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRyZXMgPSBzdG9yZVtrZXldO1xuXHRcdFx0aWYgKGtleSA9PT0gXCJ0YWdcIiB8fCBrZXkgPT09IFwidGFnQ3R4XCIgfHwga2V5ID09PSBcInJvb3RcIiB8fCBrZXkgPT09IFwicGFyZW50VGFnc1wiIHx8IHN0b3JlVmlldy5fLml0ID09PSBrZXkgKSB7XG5cdFx0XHRcdHJldHVybiByZXM7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0b3JlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoIWlzUmVuZGVyQ2FsbCAmJiBzdG9yZVZpZXcudGFnQ3R4IHx8IHN0b3JlVmlldy5saW5rZWQpIHsgLy8gRGF0YS1saW5rZWQgdmlldywgb3IgdGFnIGluc3RhbmNlXG5cdFx0XHRpZiAoIXJlcyB8fCAhcmVzLl9jeHApIHtcblx0XHRcdFx0Ly8gTm90IGEgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0Ly8gU2V0IHN0b3JlVmlldyB0byB0YWcgKGlmIHRoaXMgaXMgYSB0YWcuY3R4UHJtKCkgY2FsbCkgb3IgdG8gcm9vdCB2aWV3IChcImRhdGFcIiB2aWV3IG9mIGxpbmtlZCB0ZW1wbGF0ZSlcblx0XHRcdFx0c3RvcmVWaWV3ID0gc3RvcmVWaWV3LnRhZ0N0eCB8fCAkaXNGdW5jdGlvbihyZXMpXG5cdFx0XHRcdFx0PyBzdG9yZVZpZXcgLy8gSXMgYSB0YWcsIG5vdCBhIHZpZXcsIG9yIGlzIGEgY29tcHV0ZWQgY29udGV4dHVhbCBwYXJhbWV0ZXIsIHNvIHNjb3BlIHRvIHRoZSBjYWxsVmlldywgbm8gdGhlICdzY29wZSB2aWV3J1xuXHRcdFx0XHRcdDogKHN0b3JlVmlldyA9IHN0b3JlVmlldy5zY29wZSB8fCBzdG9yZVZpZXcsXG5cdFx0XHRcdFx0XHQhc3RvcmVWaWV3LmlzVG9wICYmIHN0b3JlVmlldy5jdHgudGFnIC8vIElmIHRoaXMgdmlldyBpcyBpbiBhIHRhZywgc2V0IHN0b3JlVmlldyB0byB0aGUgdGFnXG5cdFx0XHRcdFx0XHRcdHx8IHN0b3JlVmlldyk7XG5cdFx0XHRcdGlmIChyZXMgIT09IHVuZGVmaW5lZCAmJiBzdG9yZVZpZXcudGFnQ3R4KSB7XG5cdFx0XHRcdFx0Ly8gSWYgc3RvcmVWaWV3IGlzIGEgdGFnLCBidXQgdGhlIGNvbnRleHR1YWwgcGFyYW1ldGVyIGhhcyBiZWVuIHNldCBhdCBhdCBoaWdoZXIgbGV2ZWwgKGUuZy4gaGVscGVycykuLi5cblx0XHRcdFx0XHRzdG9yZVZpZXcgPSBzdG9yZVZpZXcudGFnQ3R4LnZpZXcuc2NvcGU7IC8vICB0aGVuIG1vdmUgc3RvcmVWaWV3IHRvIHRoZSBvdXRlciBsZXZlbCAoc2NvcGUgb2YgdGFnIGNvbnRhaW5lciB2aWV3KVxuXHRcdFx0XHR9XG5cdFx0XHRcdHN0b3JlID0gc3RvcmVWaWV3Ll9vY3BzO1xuXHRcdFx0XHRyZXMgPSBzdG9yZSAmJiBzdG9yZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHN0b3JlW2tleV0gfHwgcmVzO1xuXHRcdFx0XHRpZiAoIShyZXMgJiYgcmVzLl9jeHApICYmIChnZXQgfHwgaXNVcGRhdGUpKSB7XG5cdFx0XHRcdFx0Ly8gQ3JlYXRlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHQoc3RvcmUgfHwgKHN0b3JlVmlldy5fb2NwcyA9IHN0b3JlVmlldy5fb2NwcyB8fCB7fSkpW2tleV1cblx0XHRcdFx0XHRcdD0gcmVzXG5cdFx0XHRcdFx0XHQ9IFt7XG5cdFx0XHRcdFx0XHRcdF9vY3A6IHJlcywgLy8gVGhlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgdmFsdWVcblx0XHRcdFx0XHRcdFx0X3Z3OiBjYWxsVmlldyxcblx0XHRcdFx0XHRcdFx0X2tleToga2V5XG5cdFx0XHRcdFx0XHR9XTtcblx0XHRcdFx0XHRyZXMuX2N4cCA9IHtcblx0XHRcdFx0XHRcdHBhdGg6IF9vY3AsXG5cdFx0XHRcdFx0XHRpbmQ6IDAsXG5cdFx0XHRcdFx0XHR1cGRhdGVWYWx1ZTogZnVuY3Rpb24odmFsLCBwYXRoKSB7XG5cdFx0XHRcdFx0XHRcdCQub2JzZXJ2YWJsZShyZXNbMF0pLnNldFByb3BlcnR5KF9vY3AsIHZhbCk7IC8vIFNldCB0aGUgdmFsdWUgKHJlc1swXS5fb2NwKVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAob2JzQ3R4UHJtID0gcmVzICYmIHJlcy5fY3hwKSB7XG5cdFx0XHRcdC8vIElmIHRoaXMgaGVscGVyIHJlc291cmNlIGlzIGFuIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG5cdFx0XHRcdFx0ZGVwcyA9IHJlc1sxXSA/ICRzdWIuX2NlbyhyZXNbMV0uZGVwcykgOiBbX29jcF07IC8vIGZuIGRlcHMgKHdpdGggYW55IGV4cHJPYnMgY2xvbmVkIHVzaW5nICRzdWIuX2Nlbylcblx0XHRcdFx0XHRkZXBzLnVuc2hpZnQocmVzWzBdKTsgLy8gdmlld1xuXHRcdFx0XHRcdGRlcHMuX2N4cCA9IG9ic0N0eFBybTtcblx0XHRcdFx0XHQvLyBJbiBhIGNvbnRleHQgY2FsbGJhY2sgZm9yIGEgY29udGV4dHVhbCBwYXJhbSwgd2Ugc2V0IGdldCA9IHRydWUsIHRvIGdldCBjdHhQcm0gIFt2aWV3LCBkZXBlbmRlbmNpZXMuLi5dIGFycmF5IC0gbmVlZGVkIGZvciBvYnNlcnZlIGNhbGxcblx0XHRcdFx0XHRyZXR1cm4gZGVwcztcblx0XHRcdFx0fVxuXHRcdFx0XHR0YWdFbHNlID0gb2JzQ3R4UHJtLnRhZ0Vsc2U7XG5cdFx0XHRcdG5ld1JlcyA9IHJlc1sxXSAvLyBsaW5rRm4gZm9yIGNvbXBpbGVkIGV4cHJlc3Npb25cblx0XHRcdFx0XHQ/IG9ic0N0eFBybS50YWcgJiYgb2JzQ3R4UHJtLnRhZy5jdnRBcmdzXG5cdFx0XHRcdFx0XHQ/IG9ic0N0eFBybS50YWcuY3Z0QXJncyh0YWdFbHNlLCAxKVtvYnNDdHhQcm0uaW5kXSAvLyA9IHRhZy5ibmRBcmdzKCkgLSBmb3IgdGFnIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdFx0XHQ6IHJlc1sxXShyZXNbMF0uZGF0YSwgcmVzWzBdLCAkc3ViKSAgICAvLyA9IGZuKGRhdGEsIHZpZXcsICRzdWIpIGZvciBjb21waWxlZCBiaW5kaW5nIGV4cHJlc3Npb25cblx0XHRcdFx0XHQ6IHJlc1swXS5fb2NwOyAvLyBPYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyICh1bmluaXRpYWxpemVkLCBvciBpbml0aWFsaXplZCBhcyBzdGF0aWMgZXhwcmVzc2lvbiwgc28gbm8gcGF0aCBkZXBlbmRlbmNpZXMpXG5cdFx0XHRcdGlmIChpc1VwZGF0ZSkge1xuXHRcdFx0XHRcdGlmIChyZXMgJiYgbmV3UmVzICE9PSB2YWx1ZSkge1xuXHRcdFx0XHRcdFx0JHN1Yi5fdWNwKGtleSwgdmFsdWUsIHN0b3JlVmlldywgb2JzQ3R4UHJtKTsgLy8gVXBkYXRlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHN0b3JlVmlldztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXMgPSBuZXdSZXM7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZXMgJiYgJGlzRnVuY3Rpb24ocmVzKSkge1xuXHRcdFx0Ly8gSWYgYSBoZWxwZXIgaXMgb2YgdHlwZSBmdW5jdGlvbiB3ZSB3aWxsIHdyYXAgaXQsIHNvIGlmIGNhbGxlZCB3aXRoIG5vIHRoaXMgcG9pbnRlciBpdCB3aWxsIGJlIGNhbGxlZCB3aXRoIHRoZVxuXHRcdFx0Ly8gdmlldyBhcyAndGhpcycgY29udGV4dC4gSWYgdGhlIGhlbHBlciB+Zm9vKCkgd2FzIGluIGEgZGF0YS1saW5rIGV4cHJlc3Npb24sIHRoZSB2aWV3IHdpbGwgaGF2ZSBhICd0ZW1wb3JhcnknIGxpbmtDdHggcHJvcGVydHkgdG9vLlxuXHRcdFx0Ly8gTm90ZSB0aGF0IGhlbHBlciBmdW5jdGlvbnMgb24gZGVlcGVyIHBhdGhzIHdpbGwgaGF2ZSBzcGVjaWZpYyB0aGlzIHBvaW50ZXJzLCBmcm9tIHRoZSBwcmVjZWRpbmcgcGF0aC5cblx0XHRcdC8vIEZvciBleGFtcGxlLCB+dXRpbC5mb28oKSB3aWxsIGhhdmUgdGhlIH51dGlsIG9iamVjdCBhcyAndGhpcycgcG9pbnRlclxuXHRcdFx0d3JhcHBlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzLmFwcGx5KCghdGhpcyB8fCB0aGlzID09PSBnbG9iYWwpID8gY2FsbFZpZXcgOiB0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0fTtcblx0XHRcdCRleHRlbmQod3JhcHBlZCwgcmVzKTsgLy8gQXR0YWNoIHNhbWUgZXhwYW5kb3MgKGlmIGFueSkgdG8gdGhlIHdyYXBwZWQgZnVuY3Rpb25cblx0XHRcdHdyYXBwZWQuX3Z3ID0gY2FsbFZpZXc7XG5cdFx0fVxuXHRcdHJldHVybiB3cmFwcGVkIHx8IHJlcztcblx0fVxufVxuXG4vKiBJbnRlcm5hbCBwcml2YXRlOiB2aWV3Ll9nZXRUbXBsKCkgKi9cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKHRtcGwpIHtcblx0cmV0dXJuIHRtcGwgJiYgKHRtcGwuZm5cblx0XHQ/IHRtcGxcblx0XHQ6IHRoaXMuZ2V0UnNjKFwidGVtcGxhdGVzXCIsIHRtcGwpIHx8ICR0ZW1wbGF0ZXModG1wbCkpOyAvLyBub3QgeWV0IGNvbXBpbGVkXG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHZpZXdzLl9jbnZ0XG4vLz09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbnZlcnRWYWwoY29udmVydGVyLCB2aWV3LCB0YWdDdHgsIG9uRXJyb3IpIHtcblx0Ly8gQ2FsbGVkIGZyb20gY29tcGlsZWQgdGVtcGxhdGUgY29kZSBmb3Ige3s6fX1cblx0Ly8gc2VsZiBpcyB0ZW1wbGF0ZSBvYmplY3Qgb3IgbGlua0N0eCBvYmplY3Rcblx0dmFyIHRhZywgdmFsdWUsIGFyZ3NMZW4sIGJpbmRUbyxcblx0XHQvLyBJZiB0YWdDdHggaXMgYW4gaW50ZWdlciwgdGhlbiBpdCBpcyB0aGUga2V5IGZvciB0aGUgY29tcGlsZWQgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSBib3VuZFRhZyB0YWdDdHhcblx0XHRib3VuZFRhZyA9IHR5cGVvZiB0YWdDdHggPT09IFwibnVtYmVyXCIgJiYgdmlldy50bXBsLmJuZHNbdGFnQ3R4LTFdLFxuXHRcdGxpbmtDdHggPSB2aWV3Ll9sYzsgLy8gRm9yIGRhdGEtbGluaz1cIntjdnQ6Li4ufVwiLi4uXG5cblx0aWYgKG9uRXJyb3IgPT09IHVuZGVmaW5lZCAmJiBib3VuZFRhZyAmJiBib3VuZFRhZy5fbHIpIHsgLy8gbGF0ZVJlbmRlclxuXHRcdG9uRXJyb3IgPSBcIlwiO1xuXHR9XG5cdGlmIChvbkVycm9yICE9PSB1bmRlZmluZWQpIHtcblx0XHR0YWdDdHggPSBvbkVycm9yID0ge3Byb3BzOiB7fSwgYXJnczogW29uRXJyb3JdfTtcblx0fSBlbHNlIGlmIChib3VuZFRhZykge1xuXHRcdHRhZ0N0eCA9IGJvdW5kVGFnKHZpZXcuZGF0YSwgdmlldywgJHN1Yik7XG5cdH1cblx0Ym91bmRUYWcgPSBib3VuZFRhZy5fYmQgJiYgYm91bmRUYWc7XG5cdGlmIChjb252ZXJ0ZXIgfHwgYm91bmRUYWcpIHtcblx0XHR0YWcgPSBsaW5rQ3R4ICYmIGxpbmtDdHgudGFnO1xuXHRcdHRhZ0N0eC52aWV3ID0gdmlldztcblx0XHRpZiAoIXRhZykge1xuXHRcdFx0dGFnID0gJGV4dGVuZChuZXcgJHN1Yi5fdGcoKSwge1xuXHRcdFx0XHRfOiB7XG5cdFx0XHRcdFx0Ym5kOiBib3VuZFRhZyxcblx0XHRcdFx0XHR1bmxpbmtlZDogdHJ1ZSxcblx0XHRcdFx0XHRsdDogdGFnQ3R4Lmx0IC8vIElmIGEgbGF0ZSBwYXRoIEBzb21lLnBhdGggaGFzIG5vdCByZXR1cm5lZCBAc29tZSBvYmplY3QsIG1hcmsgdGFnIGFzIGxhdGVcblx0XHRcdFx0fSxcblx0XHRcdFx0aW5saW5lOiAhbGlua0N0eCxcblx0XHRcdFx0dGFnTmFtZTogXCI6XCIsXG5cdFx0XHRcdGNvbnZlcnQ6IGNvbnZlcnRlcixcblx0XHRcdFx0ZmxvdzogdHJ1ZSxcblx0XHRcdFx0dGFnQ3R4OiB0YWdDdHgsXG5cdFx0XHRcdHRhZ0N0eHM6IFt0YWdDdHhdLFxuXHRcdFx0XHRfaXM6IFwidGFnXCJcblx0XHRcdH0pO1xuXHRcdFx0YXJnc0xlbiA9IHRhZ0N0eC5hcmdzLmxlbmd0aDtcblx0XHRcdGlmIChhcmdzTGVuPjEpIHtcblx0XHRcdFx0YmluZFRvID0gdGFnLmJpbmRUbyA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoYXJnc0xlbi0tKSB7XG5cdFx0XHRcdFx0YmluZFRvLnVuc2hpZnQoYXJnc0xlbik7IC8vIEJpbmQgdG8gYWxsIHRoZSBhcmd1bWVudHMgLSBnZW5lcmF0ZSBiaW5kVG8gYXJyYXk6IFswLDEsMi4uLl1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGxpbmtDdHgpIHtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHRcdHRhZy5saW5rQ3R4ID0gbGlua0N0eDtcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgodGFnQ3R4LmN0eCwgKGxpbmtDdHggPyBsaW5rQ3R4LnZpZXcgOiB2aWV3KS5jdHgpO1xuXHRcdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpO1xuXHRcdH1cblx0XHR0YWcuX2VyID0gb25FcnJvciAmJiB2YWx1ZTtcblx0XHR0YWcuY3R4ID0gdGFnQ3R4LmN0eCB8fCB0YWcuY3R4IHx8IHt9O1xuXHRcdHRhZ0N0eC5jdHggPSB1bmRlZmluZWQ7XG5cdFx0dmFsdWUgPSB0YWcuY3Z0QXJncygpWzBdOyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRCYWNrIGJ1dCBubyBjb252ZXJ0LCBjb252ZXJ0ZXIgd2lsbCBiZSBcInRydWVcIlxuXHRcdHRhZy5fZXIgPSBvbkVycm9yICYmIHZhbHVlO1xuXHR9IGVsc2Uge1xuXHRcdHZhbHVlID0gdGFnQ3R4LmFyZ3NbMF07XG5cdH1cblxuXHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdHZhbHVlID0gYm91bmRUYWcgJiYgdmlldy5fLm9uUmVuZGVyXG5cdFx0PyB2aWV3Ll8ub25SZW5kZXIodmFsdWUsIHZpZXcsIHRhZylcblx0XHQ6IHZhbHVlO1xuXHRyZXR1cm4gdmFsdWUgIT0gdW5kZWZpbmVkID8gdmFsdWUgOiBcIlwiO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXJncyh0YWdFbHNlLCBib3VuZCkgeyAvLyB0YWcuY3Z0QXJncygpIG9yIHRhZy5jdnRBcmdzKHRhZ0Vsc2U/LCB0cnVlPylcblx0dmFyIGwsIGtleSwgYm91bmRBcmdzLCBhcmdzLCBiaW5kRnJvbSwgdGFnLCBjb252ZXJ0ZXIsXG5cdFx0dGFnQ3R4ID0gdGhpcztcblxuXHRpZiAodGFnQ3R4LnRhZ05hbWUpIHtcblx0XHR0YWcgPSB0YWdDdHg7XG5cdFx0dGFnQ3R4ID0gKHRhZy50YWdDdHhzIHx8IFt0YWdDdHhdKVt0YWdFbHNlfHwwXTtcblx0XHRpZiAoIXRhZ0N0eCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR0YWcgPSB0YWdDdHgudGFnO1xuXHR9XG5cblx0YmluZEZyb20gPSB0YWcuYmluZEZyb207XG5cdGFyZ3MgPSB0YWdDdHguYXJncztcblxuXHRpZiAoKGNvbnZlcnRlciA9IHRhZy5jb252ZXJ0KSAmJiBcIlwiICsgY29udmVydGVyID09PSBjb252ZXJ0ZXIpIHtcblx0XHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIgPT09IFwidHJ1ZVwiXG5cdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0OiAodGFnQ3R4LnZpZXcuZ2V0UnNjKFwiY29udmVydGVyc1wiLCBjb252ZXJ0ZXIpIHx8IGVycm9yKFwiVW5rbm93biBjb252ZXJ0ZXI6ICdcIiArIGNvbnZlcnRlciArIFwiJ1wiKSk7XG5cdH1cblxuXHRpZiAoY29udmVydGVyICYmICFib3VuZCkgeyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRlciwgdXNlIGEgY29weSBvZiB0aGUgdGFnQ3R4LmFyZ3MgYXJyYXkgZm9yIHJlbmRlcmluZywgYW5kIHJlcGxhY2UgdGhlIGFyZ3NbMF0gaW5cblx0XHRhcmdzID0gYXJncy5zbGljZSgpOyAvLyB0aGUgY29waWVkIGFycmF5IHdpdGggdGhlIGNvbnZlcnRlZCB2YWx1ZS4gQnV0IHdlIGRvIG5vdCBtb2RpZnkgdGhlIHZhbHVlIG9mIHRhZy50YWdDdHguYXJnc1swXSAodGhlIG9yaWdpbmFsIGFyZ3MgYXJyYXkpXG5cdH1cblx0aWYgKGJpbmRGcm9tKSB7IC8vIEdldCB0aGUgdmFsdWVzIG9mIHRoZSBib3VuZEFyZ3Ncblx0XHRib3VuZEFyZ3MgPSBbXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0Ym91bmRBcmdzLnVuc2hpZnQoYXJnT3JQcm9wKHRhZ0N0eCwga2V5KSk7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkge1xuXHRcdFx0YXJncyA9IGJvdW5kQXJnczsgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSByZXR1cm5zIHRoZSBib3VuZEFyZ3Ncblx0XHR9XG5cdH1cblx0aWYgKGNvbnZlcnRlcikge1xuXHRcdGNvbnZlcnRlciA9IGNvbnZlcnRlci5hcHBseSh0YWcsIGJvdW5kQXJncyB8fCBhcmdzKTtcblx0XHRpZiAoY29udmVydGVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBhcmdzOyAvLyBSZXR1cm5pbmcgdW5kZWZpbmVkIGZyb20gYSBjb252ZXJ0ZXIgaXMgZXF1aXZhbGVudCB0byBub3QgaGF2aW5nIGEgY29udmVydGVyLlxuXHRcdH1cblx0XHRiaW5kRnJvbSA9IGJpbmRGcm9tIHx8IFswXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdGlmICghJGlzQXJyYXkoY29udmVydGVyKSB8fCBjb252ZXJ0ZXIubGVuZ3RoICE9PSBsKSB7XG5cdFx0XHRjb252ZXJ0ZXIgPSBbY29udmVydGVyXTtcblx0XHRcdGJpbmRGcm9tID0gWzBdO1xuXHRcdFx0bCA9IDE7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkgeyAgICAgICAgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSBzbyBhcHBseSBjb252ZXJ0ZXIgdG8gYWxsIGJvdW5kQXJnc1xuXHRcdFx0YXJncyA9IGNvbnZlcnRlcjsgLy8gVGhlIGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBmcm9tIHRoZSBjb252ZXJ0ZXJcblx0XHR9IGVsc2UgeyAgICAgICAgICAgIC8vIENhbGwgdG8gY3Z0QXJncygpXG5cdFx0XHR3aGlsZSAobC0tKSB7XG5cdFx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0XHRpZiAoK2tleSA9PT0ga2V5KSB7XG5cdFx0XHRcdFx0YXJnc1trZXldID0gY29udmVydGVyW2xdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBhcmdzO1xufVxuXG5mdW5jdGlvbiBhcmdPclByb3AoY29udGV4dCwga2V5KSB7XG5cdGNvbnRleHQgPSBjb250ZXh0WytrZXkgPT09IGtleSA/IFwiYXJnc1wiIDogXCJwcm9wc1wiXTtcblx0cmV0dXJuIGNvbnRleHQgJiYgY29udGV4dFtrZXldO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0Qm91bmRBcmdzKHRhZ0Vsc2UpIHsgLy8gdGFnLmJuZEFyZ3MoKVxuXHRyZXR1cm4gdGhpcy5jdnRBcmdzKHRhZ0Vsc2UsIDEpO1xufVxuXG4vLz09PT09PT09PT09PT1cbi8vIHZpZXdzLnRhZ1xuLy89PT09PT09PT09PT09XG5cbi8qIHZpZXcuZ2V0UnNjKCkgKi9cbmZ1bmN0aW9uIGdldFJlc291cmNlKHJlc291cmNlVHlwZSwgaXRlbU5hbWUpIHtcblx0dmFyIHJlcywgc3RvcmUsXG5cdFx0dmlldyA9IHRoaXM7XG5cdGlmIChcIlwiICsgaXRlbU5hbWUgPT09IGl0ZW1OYW1lKSB7XG5cdFx0d2hpbGUgKChyZXMgPT09IHVuZGVmaW5lZCkgJiYgdmlldykge1xuXHRcdFx0c3RvcmUgPSB2aWV3LnRtcGwgJiYgdmlldy50bXBsW3Jlc291cmNlVHlwZV07XG5cdFx0XHRyZXMgPSBzdG9yZSAmJiBzdG9yZVtpdGVtTmFtZV07XG5cdFx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXMgfHwgJHZpZXdzW3Jlc291cmNlVHlwZV1baXRlbU5hbWVdO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRhZyh0YWdOYW1lLCBwYXJlbnRWaWV3LCB0bXBsLCB0YWdDdHhzLCBpc1VwZGF0ZSwgb25FcnJvcikge1xuXHRmdW5jdGlvbiBiaW5kVG9PckJpbmRGcm9tKHR5cGUpIHtcblx0XHR2YXIgYmluZEFycmF5ID0gdGFnW3R5cGVdO1xuXG5cdFx0aWYgKGJpbmRBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRiaW5kQXJyYXkgPSAkaXNBcnJheShiaW5kQXJyYXkpID8gYmluZEFycmF5IDogW2JpbmRBcnJheV07XG5cdFx0XHRtID0gYmluZEFycmF5Lmxlbmd0aDtcblx0XHRcdHdoaWxlIChtLS0pIHtcblx0XHRcdFx0a2V5ID0gYmluZEFycmF5W21dO1xuXHRcdFx0XHRpZiAoIWlzTmFOKHBhcnNlSW50KGtleSkpKSB7XG5cdFx0XHRcdFx0YmluZEFycmF5W21dID0gcGFyc2VJbnQoa2V5KTsgLy8gQ29udmVydCBcIjBcIiB0byAwLCAgZXRjLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJpbmRBcnJheSB8fCBbMF07XG5cdH1cblxuXHRwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCB0b3BWaWV3O1xuXHR2YXIgdGFnLCB0YWdEZWYsIHRlbXBsYXRlLCB0YWdzLCBhdHRyLCBwYXJlbnRUYWcsIGwsIG0sIG4sIGl0ZW1SZXQsIHRhZ0N0eCwgdGFnQ3R4Q3R4LCBjdHhQcm0sIGJpbmRUbywgYmluZEZyb20sIGluaXRWYWwsXG5cdFx0Y29udGVudCwgY2FsbEluaXQsIG1hcERlZiwgdGhpc01hcCwgYXJncywgYmRBcmdzLCBwcm9wcywgdGFnRGF0YU1hcCwgY29udGVudEN0eCwga2V5LCBiaW5kRnJvbUxlbmd0aCwgYmluZFRvTGVuZ3RoLCBsaW5rZWRFbGVtZW50LCBkZWZhdWx0Q3R4LFxuXHRcdGkgPSAwLFxuXHRcdHJldCA9IFwiXCIsXG5cdFx0bGlua0N0eCA9IHBhcmVudFZpZXcuX2xjIHx8IGZhbHNlLFxuXHRcdGN0eCA9IHBhcmVudFZpZXcuY3R4LFxuXHRcdHBhcmVudFRtcGwgPSB0bXBsIHx8IHBhcmVudFZpZXcudG1wbCxcblx0XHQvLyBJZiB0YWdDdHhzIGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4c1xuXHRcdGJvdW5kVGFnID0gdHlwZW9mIHRhZ0N0eHMgPT09IFwibnVtYmVyXCIgJiYgcGFyZW50Vmlldy50bXBsLmJuZHNbdGFnQ3R4cy0xXTtcblxuXHRpZiAodGFnTmFtZS5faXMgPT09IFwidGFnXCIpIHtcblx0XHR0YWcgPSB0YWdOYW1lO1xuXHRcdHRhZ05hbWUgPSB0YWcudGFnTmFtZTtcblx0XHR0YWdDdHhzID0gdGFnLnRhZ0N0eHM7XG5cdFx0dGVtcGxhdGUgPSB0YWcudGVtcGxhdGU7XG5cdH0gZWxzZSB7XG5cdFx0dGFnRGVmID0gcGFyZW50Vmlldy5nZXRSc2MoXCJ0YWdzXCIsIHRhZ05hbWUpIHx8IGVycm9yKFwiVW5rbm93biB0YWc6IHt7XCIgKyB0YWdOYW1lICsgXCJ9fSBcIik7XG5cdFx0dGVtcGxhdGUgPSB0YWdEZWYudGVtcGxhdGU7XG5cdH1cblx0aWYgKG9uRXJyb3IgPT09IHVuZGVmaW5lZCAmJiBib3VuZFRhZyAmJiAoYm91bmRUYWcuX2xyID0gKHRhZ0RlZi5sYXRlUmVuZGVyICYmIGJvdW5kVGFnLl9sciE9PSBmYWxzZSB8fCBib3VuZFRhZy5fbHIpKSkge1xuXHRcdG9uRXJyb3IgPSBcIlwiOyAvLyBJZiBsYXRlUmVuZGVyLCBzZXQgdGVtcG9yYXJ5IG9uRXJyb3IsIHRvIHNraXAgaW5pdGlhbCByZW5kZXJpbmcgKGFuZCByZW5kZXIganVzdCBcIlwiKVxuXHR9XG5cdGlmIChvbkVycm9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXQgKz0gb25FcnJvcjtcblx0XHR0YWdDdHhzID0gb25FcnJvciA9IFt7cHJvcHM6IHt9LCBhcmdzOiBbXSwgcGFyYW1zOiB7cHJvcHM6e319fV07XG5cdH0gZWxzZSBpZiAoYm91bmRUYWcpIHtcblx0XHR0YWdDdHhzID0gYm91bmRUYWcocGFyZW50Vmlldy5kYXRhLCBwYXJlbnRWaWV3LCAkc3ViKTtcblx0fVxuXG5cdGwgPSB0YWdDdHhzLmxlbmd0aDtcblx0Zm9yICg7IGkgPCBsOyBpKyspIHtcblx0XHR0YWdDdHggPSB0YWdDdHhzW2ldO1xuXHRcdGNvbnRlbnQgPSB0YWdDdHgudG1wbDtcblx0XHRpZiAoIWxpbmtDdHggfHwgIWxpbmtDdHgudGFnIHx8IGkgJiYgIWxpbmtDdHgudGFnLmlubGluZSB8fCB0YWcuX2VyIHx8IGNvbnRlbnQgJiYgK2NvbnRlbnQ9PT1jb250ZW50KSB7XG5cdFx0XHQvLyBJbml0aWFsaXplIHRhZ0N0eFxuXHRcdFx0Ly8gRm9yIGJsb2NrIHRhZ3MsIHRhZ0N0eC50bXBsIGlzIGFuIGludGVnZXIgPiAwXG5cdFx0XHRpZiAoY29udGVudCAmJiBwYXJlbnRUbXBsLnRtcGxzKSB7XG5cdFx0XHRcdHRhZ0N0eC50bXBsID0gdGFnQ3R4LmNvbnRlbnQgPSBwYXJlbnRUbXBsLnRtcGxzW2NvbnRlbnQgLSAxXTsgLy8gU2V0IHRoZSB0bXBsIHByb3BlcnR5IHRvIHRoZSBjb250ZW50IG9mIHRoZSBibG9jayB0YWdcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5pbmRleCA9IGk7XG5cdFx0XHR0YWdDdHguY3R4UHJtID0gY29udGV4dFBhcmFtZXRlcjtcblx0XHRcdHRhZ0N0eC5yZW5kZXIgPSByZW5kZXJDb250ZW50O1xuXHRcdFx0dGFnQ3R4LmN2dEFyZ3MgPSBjb252ZXJ0QXJncztcblx0XHRcdHRhZ0N0eC5ibmRBcmdzID0gY29udmVydEJvdW5kQXJncztcblx0XHRcdHRhZ0N0eC52aWV3ID0gcGFyZW50Vmlldztcblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgoZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIHRhZ0RlZiAmJiB0YWdEZWYuY3R4KSwgY3R4KTsgLy8gQ2xvbmUgYW5kIGV4dGVuZCBwYXJlbnRWaWV3LmN0eFxuXHRcdH1cblx0XHRpZiAodG1wbCA9IHRhZ0N0eC5wcm9wcy50bXBsKSB7XG5cdFx0XHQvLyBJZiB0aGUgdG1wbCBwcm9wZXJ0eSBpcyBvdmVycmlkZGVuLCBzZXQgdGhlIHZhbHVlICh3aGVuIGluaXRpYWxpemluZywgb3IsIGluIGNhc2Ugb2YgYmluZGluZzogXnRtcGw9Li4uLCB3aGVuIHVwZGF0aW5nKVxuXHRcdFx0dGFnQ3R4LnRtcGwgPSBwYXJlbnRWaWV3Ll9nZXRUbXBsKHRtcGwpO1xuXHRcdFx0dGFnQ3R4LmNvbnRlbnQgPSB0YWdDdHguY29udGVudCB8fCB0YWdDdHgudG1wbDtcblx0XHR9XG5cblx0XHRpZiAoIXRhZykge1xuXHRcdFx0Ly8gVGhpcyB3aWxsIG9ubHkgYmUgaGl0IGZvciBpbml0aWFsIHRhZ0N0eCAobm90IGZvciB7e2Vsc2V9fSkgLSBpZiB0aGUgdGFnIGluc3RhbmNlIGRvZXMgbm90IGV4aXN0IHlldFxuXHRcdFx0Ly8gSWYgdGhlIHRhZyBoYXMgbm90IGFscmVhZHkgYmVlbiBpbnN0YW50aWF0ZWQsIHdlIHdpbGwgY3JlYXRlIGEgbmV3IGluc3RhbmNlLlxuXHRcdFx0Ly8gfnRhZyB3aWxsIGFjY2VzcyB0aGUgdGFnLCBldmVuIHdpdGhpbiB0aGUgcmVuZGVyaW5nIG9mIHRoZSB0ZW1wbGF0ZSBjb250ZW50IG9mIHRoaXMgdGFnLlxuXHRcdFx0Ly8gRnJvbSBjaGlsZC9kZXNjZW5kYW50IHRhZ3MsIGNhbiBhY2Nlc3MgdXNpbmcgfnRhZy5wYXJlbnQsIG9yIH5wYXJlbnRUYWdzLnRhZ05hbWVcblx0XHRcdHRhZyA9IG5ldyB0YWdEZWYuX2N0cigpO1xuXHRcdFx0Y2FsbEluaXQgPSAhIXRhZy5pbml0O1xuXG5cdFx0XHR0YWcucGFyZW50ID0gcGFyZW50VGFnID0gY3R4ICYmIGN0eC50YWc7XG5cdFx0XHR0YWcudGFnQ3R4cyA9IHRhZ0N0eHM7XG5cblx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdHRhZy5pbmxpbmUgPSBmYWxzZTtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHR9XG5cdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHRpZiAodGFnLl8uYm5kID0gYm91bmRUYWcgfHwgbGlua0N0eC5mbikge1xuXHRcdFx0XHQvLyBCb3VuZCBpZiB7Xnt0YWcuLi59fSBvciBkYXRhLWxpbms9XCJ7dGFnLi4ufVwiXG5cdFx0XHRcdHRhZy5fLnRocyA9IHRhZ0N0eC5wYXJhbXMucHJvcHMudGhpczsgLy8gVGFnIGhhcyBhIHRoaXM9ZXhwciBiaW5kaW5nLCB0byBnZXQgamF2YXNjcmlwdCByZWZlcmVuY2UgdG8gdGFnIGluc3RhbmNlXG5cdFx0XHRcdHRhZy5fLmx0ID0gdGFnQ3R4cy5sdDsgLy8gSWYgYSBsYXRlIHBhdGggQHNvbWUucGF0aCBoYXMgbm90IHJldHVybmVkIEBzb21lIG9iamVjdCwgbWFyayB0YWcgYXMgbGF0ZVxuXHRcdFx0XHR0YWcuXy5hcnJWd3MgPSB7fTtcblx0XHRcdH0gZWxzZSBpZiAodGFnLmRhdGFCb3VuZE9ubHkpIHtcblx0XHRcdFx0ZXJyb3IodGFnTmFtZSArIFwiIG11c3QgYmUgZGF0YS1ib3VuZDpcXG57XntcIiArIHRhZ05hbWUgKyBcIn19XCIpO1xuXHRcdFx0fVxuXHRcdFx0Ly9UT0RPIGJldHRlciBwZXJmIGZvciBjaGlsZFRhZ3MoKSAtIGtlZXAgY2hpbGQgdGFnLnRhZ3MgYXJyYXksIChhbmQgcmVtb3ZlIGNoaWxkLCB3aGVuIGRpc3Bvc2VkKVxuXHRcdFx0Ly8gdGFnLnRhZ3MgPSBbXTtcblx0XHR9IGVsc2UgaWYgKGxpbmtDdHggJiYgbGlua0N0eC5mbi5fbHIpIHtcblx0XHRcdGNhbGxJbml0ID0gISF0YWcuaW5pdDtcblx0XHR9XG5cdFx0dGFnRGF0YU1hcCA9IHRhZy5kYXRhTWFwO1xuXG5cdFx0dGFnQ3R4LnRhZyA9IHRhZztcblx0XHRpZiAodGFnRGF0YU1hcCAmJiB0YWdDdHhzKSB7XG5cdFx0XHR0YWdDdHgubWFwID0gdGFnQ3R4c1tpXS5tYXA7IC8vIENvcHkgb3ZlciB0aGUgY29tcGlsZWQgbWFwIGluc3RhbmNlIGZyb20gdGhlIHByZXZpb3VzIHRhZ0N0eHMgdG8gdGhlIHJlZnJlc2hlZCBvbmVzXG5cdFx0fVxuXHRcdGlmICghdGFnLmZsb3cpIHtcblx0XHRcdHRhZ0N0eEN0eCA9IHRhZ0N0eC5jdHggPSB0YWdDdHguY3R4IHx8IHt9O1xuXG5cdFx0XHQvLyB0YWdzIGhhc2g6IHRhZy5jdHgudGFncywgbWVyZ2VkIHdpdGggcGFyZW50Vmlldy5jdHgudGFncyxcblx0XHRcdHRhZ3MgPSB0YWcucGFyZW50cyA9IHRhZ0N0eEN0eC5wYXJlbnRUYWdzID0gY3R4ICYmIGV4dGVuZEN0eCh0YWdDdHhDdHgucGFyZW50VGFncywgY3R4LnBhcmVudFRhZ3MpIHx8IHt9O1xuXHRcdFx0aWYgKHBhcmVudFRhZykge1xuXHRcdFx0XHR0YWdzW3BhcmVudFRhZy50YWdOYW1lXSA9IHBhcmVudFRhZztcblx0XHRcdFx0Ly9UT0RPIGJldHRlciBwZXJmIGZvciBjaGlsZFRhZ3M6IHBhcmVudFRhZy50YWdzLnB1c2godGFnKTtcblx0XHRcdH1cblx0XHRcdHRhZ3NbdGFnLnRhZ05hbWVdID0gdGFnQ3R4Q3R4LnRhZyA9IHRhZztcblx0XHRcdHRhZ0N0eEN0eC50YWdDdHggPSB0YWdDdHg7XG5cdFx0fVxuXHR9XG5cdGlmICghKHRhZy5fZXIgPSBvbkVycm9yKSkge1xuXHRcdHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4c1swXSk7XG5cdFx0dGFnLnJlbmRlcmluZyA9IHtybmRyOiB0YWcucmVuZGVyaW5nfTsgLy8gUHJvdmlkZSBvYmplY3QgZm9yIHN0YXRlIGR1cmluZyByZW5kZXIgY2FsbHMgdG8gdGFnIGFuZCBlbHNlcy4gKFVzZWQgYnkge3tpZn19IGFuZCB7e2Zvcn19Li4uKVxuXHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHsgLy8gSXRlcmF0ZSB0YWdDdHggZm9yIGVhY2gge3tlbHNlfX0gYmxvY2tcblx0XHRcdHRhZ0N0eCA9IHRhZy50YWdDdHggPSB0YWdDdHhzW2ldO1xuXHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdFx0XHR0YWcuY3R4ID0gdGFnQ3R4LmN0eDtcblxuXHRcdFx0aWYgKCFpKSB7XG5cdFx0XHRcdGlmIChjYWxsSW5pdCkge1xuXHRcdFx0XHRcdHRhZy5pbml0KHRhZ0N0eCwgbGlua0N0eCwgdGFnLmN0eCk7XG5cdFx0XHRcdFx0Y2FsbEluaXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF0YWdDdHguYXJncy5sZW5ndGggJiYgdGFnQ3R4LmFyZ0RlZmF1bHQgIT09IGZhbHNlICYmIHRhZy5hcmdEZWZhdWx0ICE9PSBmYWxzZSkge1xuXHRcdFx0XHRcdHRhZ0N0eC5hcmdzID0gYXJncyA9IFt0YWdDdHgudmlldy5kYXRhXTsgLy8gTWlzc2luZyBmaXJzdCBhcmcgZGVmYXVsdHMgdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0XG5cdFx0XHRcdFx0dGFnQ3R4LnBhcmFtcy5hcmdzID0gW1wiI2RhdGFcIl07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiaW5kVG8gPSBiaW5kVG9PckJpbmRGcm9tKFwiYmluZFRvXCIpO1xuXG5cdFx0XHRcdGlmICh0YWcuYmluZFRvICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0YWcuYmluZFRvID0gYmluZFRvO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRhZy5iaW5kRnJvbSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGFnLmJpbmRGcm9tID0gYmluZFRvT3JCaW5kRnJvbShcImJpbmRGcm9tXCIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRhZy5iaW5kVG8pIHtcblx0XHRcdFx0XHR0YWcuYmluZEZyb20gPSB0YWcuYmluZFRvID0gYmluZFRvO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJpbmRGcm9tID0gdGFnLmJpbmRGcm9tIHx8IGJpbmRUbztcblxuXHRcdFx0XHRiaW5kVG9MZW5ndGggPSBiaW5kVG8ubGVuZ3RoO1xuXHRcdFx0XHRiaW5kRnJvbUxlbmd0aCA9IGJpbmRGcm9tLmxlbmd0aDtcblxuXHRcdFx0XHRpZiAodGFnLl8uYm5kICYmIChsaW5rZWRFbGVtZW50ID0gdGFnLmxpbmtlZEVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0dGFnLmxpbmtlZEVsZW1lbnQgPSBsaW5rZWRFbGVtZW50ID0gJGlzQXJyYXkobGlua2VkRWxlbWVudCkgPyBsaW5rZWRFbGVtZW50OiBbbGlua2VkRWxlbWVudF07XG5cblx0XHRcdFx0XHRpZiAoYmluZFRvTGVuZ3RoICE9PSBsaW5rZWRFbGVtZW50Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZXJyb3IoXCJsaW5rZWRFbGVtZW50IG5vdCBzYW1lIGxlbmd0aCBhcyBiaW5kVG9cIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChsaW5rZWRFbGVtZW50ID0gdGFnLmxpbmtlZEN0eFBhcmFtKSB7XG5cdFx0XHRcdFx0dGFnLmxpbmtlZEN0eFBhcmFtID0gbGlua2VkRWxlbWVudCA9ICRpc0FycmF5KGxpbmtlZEVsZW1lbnQpID8gbGlua2VkRWxlbWVudDogW2xpbmtlZEVsZW1lbnRdO1xuXG5cdFx0XHRcdFx0aWYgKGJpbmRGcm9tTGVuZ3RoICE9PSBsaW5rZWRFbGVtZW50Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZXJyb3IoXCJsaW5rZWRDdHhQYXJhbSBub3Qgc2FtZSBsZW5ndGggYXMgYmluZEZyb20vYmluZFRvXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChiaW5kRnJvbSkge1xuXHRcdFx0XHRcdHRhZy5fLmZyb21JbmRleCA9IHt9OyAvLyBIYXNoIG9mIGJpbmRGcm9tIGluZGV4IHdoaWNoIGhhcyBzYW1lIHBhdGggdmFsdWUgYXMgYmluZFRvIGluZGV4LiBmcm9tSW5kZXggPSB0YWcuXy5mcm9tSW5kZXhbdG9JbmRleF1cblx0XHRcdFx0XHR0YWcuXy50b0luZGV4ID0ge307IC8vIEhhc2ggb2YgYmluZEZyb20gaW5kZXggd2hpY2ggaGFzIHNhbWUgcGF0aCB2YWx1ZSBhcyBiaW5kVG8gaW5kZXguIGZyb21JbmRleCA9IHRhZy5fLmZyb21JbmRleFt0b0luZGV4XVxuXHRcdFx0XHRcdG4gPSBiaW5kRnJvbUxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAobi0tKSB7XG5cdFx0XHRcdFx0XHRrZXkgPSBiaW5kRnJvbVtuXTtcblx0XHRcdFx0XHRcdG0gPSBiaW5kVG9MZW5ndGg7XG5cdFx0XHRcdFx0XHR3aGlsZSAobS0tKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChrZXkgPT09IGJpbmRUb1ttXSkge1xuXHRcdFx0XHRcdFx0XHRcdHRhZy5fLmZyb21JbmRleFttXSA9IG47XG5cdFx0XHRcdFx0XHRcdFx0dGFnLl8udG9JbmRleFtuXSA9IG07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHRcdC8vIFNldCBhdHRyIG9uIGxpbmtDdHggdG8gZW5zdXJlIG91dHB1dHRpbmcgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IGF0dHJpYnV0ZS5cblx0XHRcdFx0XHQvLyBTZXR0aW5nIGVpdGhlciBsaW5rQ3R4LmF0dHIgb3IgdGhpcy5hdHRyIGluIHRoZSBpbml0KCkgYWxsb3dzIHBlci1pbnN0YW5jZSBjaG9pY2Ugb2YgdGFyZ2V0IGF0dHJpYi5cblx0XHRcdFx0XHRsaW5rQ3R4LmF0dHIgPSB0YWcuYXR0ciA9IGxpbmtDdHguYXR0ciB8fCB0YWcuYXR0ciB8fCBsaW5rQ3R4Ll9kZkF0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF0dHIgPSB0YWcuYXR0cjtcblx0XHRcdFx0dGFnLl8ubm9Wd3MgPSBhdHRyICYmIGF0dHIgIT09IEhUTUw7XG5cdFx0XHR9XG5cdFx0XHRhcmdzID0gdGFnLmN2dEFyZ3MoaSk7XG5cdFx0XHRpZiAodGFnLmxpbmtlZEN0eFBhcmFtKSB7XG5cdFx0XHRcdGJkQXJncyA9IHRhZy5jdnRBcmdzKGksIDEpO1xuXHRcdFx0XHRtID0gYmluZEZyb21MZW5ndGg7XG5cdFx0XHRcdGRlZmF1bHRDdHggPSB0YWcuY29uc3RydWN0b3IucHJvdG90eXBlLmN0eDtcblx0XHRcdFx0d2hpbGUgKG0tLSkge1xuXHRcdFx0XHRcdGlmIChjdHhQcm0gPSB0YWcubGlua2VkQ3R4UGFyYW1bbV0pIHtcblx0XHRcdFx0XHRcdGtleSA9IGJpbmRGcm9tW21dO1xuXHRcdFx0XHRcdFx0aW5pdFZhbCA9IGJkQXJnc1ttXTtcblx0XHRcdFx0XHRcdC8vIENyZWF0ZSB0YWcgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHRcdHRhZ0N0eC5jdHhbY3R4UHJtXSA9ICRzdWIuX2NwKFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0Q3R4ICYmIGluaXRWYWwgPT09IHVuZGVmaW5lZCA/IGRlZmF1bHRDdHhbY3R4UHJtXTogaW5pdFZhbCxcblx0XHRcdFx0XHRcdFx0aW5pdFZhbCAhPT0gdW5kZWZpbmVkICYmIGFyZ09yUHJvcCh0YWdDdHgucGFyYW1zLCBrZXkpLFxuXHRcdFx0XHRcdFx0XHR0YWdDdHgudmlldyxcblx0XHRcdFx0XHRcdFx0dGFnLl8uYm5kICYmIHt0YWc6IHRhZywgY3Z0OiB0YWcuY29udmVydCwgaW5kOiBtLCB0YWdFbHNlOiBpfVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICgobWFwRGVmID0gcHJvcHMuZGF0YU1hcCB8fCB0YWdEYXRhTWFwKSAmJiAoYXJncy5sZW5ndGggfHwgcHJvcHMuZGF0YU1hcCkpIHtcblx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXA7XG5cdFx0XHRcdGlmICghdGhpc01hcCB8fCB0aGlzTWFwLnNyYyAhPT0gYXJnc1swXSB8fCBpc1VwZGF0ZSkge1xuXHRcdFx0XHRcdGlmICh0aGlzTWFwICYmIHRoaXNNYXAuc3JjKSB7XG5cdFx0XHRcdFx0XHR0aGlzTWFwLnVubWFwKCk7IC8vIG9ubHkgY2FsbGVkIGlmIG9ic2VydmFibGUgbWFwIC0gbm90IHdoZW4gb25seSB1c2VkIGluIEpzUmVuZGVyLCBlLmcuIGJ5IHt7cHJvcHN9fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtYXBEZWYubWFwKGFyZ3NbMF0sIHRhZ0N0eCwgdGhpc01hcCwgIXRhZy5fLmJuZCk7XG5cdFx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXA7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJncyA9IFt0aGlzTWFwLnRndF07XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW1SZXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGFnLnJlbmRlcikge1xuXHRcdFx0XHRpdGVtUmV0ID0gdGFnLnJlbmRlci5hcHBseSh0YWcsIGFyZ3MpO1xuXHRcdFx0XHRpZiAocGFyZW50Vmlldy5saW5rZWQgJiYgaXRlbVJldCAmJiAhcldyYXBwZWRJblZpZXdNYXJrZXIudGVzdChpdGVtUmV0KSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gYSB0YWcgcmVuZGVycyBjb250ZW50IGZyb20gdGhlIHJlbmRlciBtZXRob2QsIHdpdGggZGF0YSBsaW5raW5nIHRoZW4gd2UgbmVlZCB0byB3cmFwIHdpdGggdmlldyBtYXJrZXJzLCBpZiBhYnNlbnQsXG5cdFx0XHRcdFx0Ly8gdG8gcHJvdmlkZSBhIGNvbnRlbnRWaWV3IGZvciB0aGUgdGFnLCB3aGljaCB3aWxsIGNvcnJlY3RseSBkaXNwb3NlIGJpbmRpbmdzIGlmIGRlbGV0ZWQuIFRoZSAndG1wbCcgZm9yIHRoaXMgdmlldyB3aWxsXG5cdFx0XHRcdFx0Ly8gYmUgYSBkdW1iZWQtZG93biB0ZW1wbGF0ZSB3aGljaCB3aWxsIGFsd2F5cyByZXR1cm4gdGhlICBpdGVtUmV0IHN0cmluZyAobm8gbWF0dGVyIHdoYXQgdGhlIGRhdGEgaXMpLiBUaGUgaXRlbVJldCBzdHJpbmdcblx0XHRcdFx0XHQvLyBpcyBub3QgY29tcGlsZWQgYXMgdGVtcGxhdGUgbWFya3VwLCBzbyBjYW4gaW5jbHVkZSBcInt7XCIgb3IgXCJ9fVwiIHdpdGhvdXQgdHJpZ2dlcmluZyBzeW50YXggZXJyb3JzXG5cdFx0XHRcdFx0dG1wbCA9IHsgLy8gJ0R1bWJlZC1kb3duJyB0ZW1wbGF0ZSB3aGljaCBhbHdheXMgcmVuZGVycyAnc3RhdGljJyBpdGVtUmV0IHN0cmluZ1xuXHRcdFx0XHRcdFx0bGlua3M6IFtdXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0bXBsLnJlbmRlciA9IHRtcGwuZm4gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdHJldHVybiBpdGVtUmV0O1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0aXRlbVJldCA9IHJlbmRlcldpdGhWaWV3cyh0bXBsLCBwYXJlbnRWaWV3LmRhdGEsIHVuZGVmaW5lZCwgdHJ1ZSwgcGFyZW50VmlldywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRhZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghYXJncy5sZW5ndGgpIHtcblx0XHRcdFx0YXJncyA9IFtwYXJlbnRWaWV3XTsgLy8gbm8gYXJndW1lbnRzIC0gKGUuZy4ge3tlbHNlfX0pIGdldCBkYXRhIGNvbnRleHQgZnJvbSB2aWV3LlxuXHRcdFx0fVxuXHRcdFx0aWYgKGl0ZW1SZXQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb250ZW50Q3R4ID0gYXJnc1swXTsgLy8gRGVmYXVsdCBkYXRhIGNvbnRleHQgZm9yIHdyYXBwZWQgYmxvY2sgY29udGVudCBpcyB0aGUgZmlyc3QgYXJndW1lbnRcblx0XHRcdFx0aWYgKHRhZy5jb250ZW50Q3R4KSB7IC8vIFNldCB0YWcuY29udGVudEN0eCB0byB0cnVlLCB0byBpbmhlcml0IHBhcmVudCBjb250ZXh0LCBvciB0byBhIGZ1bmN0aW9uIHRvIHByb3ZpZGUgYWx0ZXJuYXRlIGNvbnRleHQuXG5cdFx0XHRcdFx0Y29udGVudEN0eCA9IHRhZy5jb250ZW50Q3R4ID09PSB0cnVlID8gcGFyZW50VmlldyA6IHRhZy5jb250ZW50Q3R4KGNvbnRlbnRDdHgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGl0ZW1SZXQgPSB0YWdDdHgucmVuZGVyKGNvbnRlbnRDdHgsIHRydWUpIHx8IChpc1VwZGF0ZSA/IHVuZGVmaW5lZCA6IFwiXCIpO1xuXHRcdFx0fVxuXHRcdFx0cmV0ID0gcmV0XG5cdFx0XHRcdD8gcmV0ICsgKGl0ZW1SZXQgfHwgXCJcIilcblx0XHRcdFx0OiBpdGVtUmV0ICE9PSB1bmRlZmluZWRcblx0XHRcdFx0XHQ/IFwiXCIgKyBpdGVtUmV0XG5cdFx0XHRcdFx0OiB1bmRlZmluZWQ7IC8vIElmIG5vIHJldHVybiB2YWx1ZSBmcm9tIHJlbmRlciwgYW5kIG5vIHRlbXBsYXRlL2NvbnRlbnQgdGFnQ3R4LnJlbmRlciguLi4pLCByZXR1cm4gdW5kZWZpbmVkXG5cdFx0fVxuXHRcdHRhZy5yZW5kZXJpbmcgPSB0YWcucmVuZGVyaW5nLnJuZHI7IC8vIFJlbW92ZSB0YWcucmVuZGVyaW5nIG9iamVjdCAoaWYgdGhpcyBpcyBvdXRlcm1vc3QgcmVuZGVyIGNhbGwuIChJbiBjYXNlIG9mIG5lc3RlZCBjYWxscylcblx0fVxuXHR0YWcudGFnQ3R4ID0gdGFnQ3R4c1swXTtcblx0dGFnLmN0eCA9IHRhZy50YWdDdHguY3R4O1xuXG5cdGlmICh0YWcuXy5ub1Z3cyAmJiB0YWcuaW5saW5lKSB7XG5cdFx0Ly8gaW5saW5lIHRhZyB3aXRoIGF0dHIgc2V0IHRvIFwidGV4dFwiIHdpbGwgaW5zZXJ0IEhUTUwtZW5jb2RlZCBjb250ZW50IC0gYXMgaWYgaXQgd2FzIGVsZW1lbnQtYmFzZWQgaW5uZXJUZXh0XG5cdFx0cmV0ID0gYXR0ciA9PT0gXCJ0ZXh0XCJcblx0XHRcdD8gJGNvbnZlcnRlcnMuaHRtbChyZXQpXG5cdFx0XHQ6IFwiXCI7XG5cdH1cblx0cmV0dXJuIGJvdW5kVGFnICYmIHBhcmVudFZpZXcuXy5vblJlbmRlclxuXHRcdC8vIENhbGwgb25SZW5kZXIgKHVzZWQgYnkgSnNWaWV3cyBpZiBwcmVzZW50LCB0byBhZGQgYmluZGluZyBhbm5vdGF0aW9ucyBhcm91bmQgcmVuZGVyZWQgY29udGVudClcblx0XHQ/IHBhcmVudFZpZXcuXy5vblJlbmRlcihyZXQsIHBhcmVudFZpZXcsIHRhZylcblx0XHQ6IHJldDtcbn1cblxuLy89PT09PT09PT09PT09PT09PVxuLy8gVmlldyBjb25zdHJ1Y3RvclxuLy89PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBWaWV3KGNvbnRleHQsIHR5cGUsIHBhcmVudFZpZXcsIGRhdGEsIHRlbXBsYXRlLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCkge1xuXHQvLyBDb25zdHJ1Y3RvciBmb3IgdmlldyBvYmplY3QgaW4gdmlldyBoaWVyYXJjaHkuIChBdWdtZW50ZWQgYnkgSnNWaWV3cyBpZiBKc1ZpZXdzIGlzIGxvYWRlZClcblx0dmFyIHZpZXdzLCBwYXJlbnRWaWV3XywgdGFnLCBzZWxmXyxcblx0XHRzZWxmID0gdGhpcyxcblx0XHRpc0FycmF5ID0gdHlwZSA9PT0gXCJhcnJheVwiO1xuXHRcdC8vIElmIHRoZSBkYXRhIGlzIGFuIGFycmF5LCB0aGlzIGlzIGFuICdhcnJheSB2aWV3JyB3aXRoIGEgdmlld3MgYXJyYXkgZm9yIGVhY2ggY2hpbGQgJ2l0ZW0gdmlldydcblx0XHQvLyBJZiB0aGUgZGF0YSBpcyBub3QgYW4gYXJyYXksIHRoaXMgaXMgYW4gJ2l0ZW0gdmlldycgd2l0aCBhIHZpZXdzICdoYXNoJyBvYmplY3QgZm9yIGFueSBjaGlsZCBuZXN0ZWQgdmlld3NcblxuXHRzZWxmLmNvbnRlbnQgPSBjb250ZW50VG1wbDtcblx0c2VsZi52aWV3cyA9IGlzQXJyYXkgPyBbXSA6IHt9O1xuXHRzZWxmLmRhdGEgPSBkYXRhO1xuXHRzZWxmLnRtcGwgPSB0ZW1wbGF0ZTtcblx0c2VsZl8gPSBzZWxmLl8gPSB7XG5cdFx0a2V5OiAwLFxuXHRcdC8vIC5fLnVzZUtleSBpcyBub24gemVybyBpZiBpcyBub3QgYW4gJ2FycmF5IHZpZXcnIChvd25pbmcgYSBkYXRhIGFycmF5KS4gVXNlIHRoaXMgYXMgbmV4dCBrZXkgZm9yIGFkZGluZyB0byBjaGlsZCB2aWV3cyBoYXNoXG5cdFx0dXNlS2V5OiBpc0FycmF5ID8gMCA6IDEsXG5cdFx0aWQ6IFwiXCIgKyB2aWV3SWQrKyxcblx0XHRvblJlbmRlcjogb25SZW5kZXIsXG5cdFx0Ym5kczoge31cblx0fTtcblx0c2VsZi5saW5rZWQgPSAhIW9uUmVuZGVyO1xuXHRzZWxmLnR5cGUgPSB0eXBlIHx8IFwidG9wXCI7XG5cdGlmIChzZWxmLnBhcmVudCA9IHBhcmVudFZpZXcpIHtcblx0XHRzZWxmLnJvb3QgPSBwYXJlbnRWaWV3LnJvb3QgfHwgc2VsZjsgLy8gdmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXdcblx0XHR2aWV3cyA9IHBhcmVudFZpZXcudmlld3M7XG5cdFx0cGFyZW50Vmlld18gPSBwYXJlbnRWaWV3Ll87XG5cdFx0c2VsZi5pc1RvcCA9IHBhcmVudFZpZXdfLnNjcDsgLy8gSXMgdG9wIGNvbnRlbnQgdmlldyBvZiBhIGxpbmsoXCIjY29udGFpbmVyXCIsIC4uLikgY2FsbFxuXHRcdHNlbGYuc2NvcGUgPSAoIWNvbnRleHQudGFnIHx8IGNvbnRleHQudGFnID09PSBwYXJlbnRWaWV3LmN0eC50YWcpICYmICFzZWxmLmlzVG9wICYmIHBhcmVudFZpZXcuc2NvcGUgfHwgc2VsZjtcblx0XHQvLyBTY29wZSBmb3IgY29udGV4dFBhcmFtcyAtIGNsb3Nlc3Qgbm9uIGZsb3cgdGFnIGFuY2VzdG9yIG9yIHJvb3Qgdmlld1xuXHRcdGlmIChwYXJlbnRWaWV3Xy51c2VLZXkpIHtcblx0XHRcdC8vIFBhcmVudCBpcyBub3QgYW4gJ2FycmF5IHZpZXcnLiBBZGQgdGhpcyB2aWV3IHRvIGl0cyB2aWV3cyBvYmplY3Rcblx0XHRcdC8vIHNlbGYuX2tleSA9IGlzIHRoZSBrZXkgaW4gdGhlIHBhcmVudCB2aWV3IGhhc2hcblx0XHRcdHZpZXdzW3NlbGZfLmtleSA9IFwiX1wiICsgcGFyZW50Vmlld18udXNlS2V5KytdID0gc2VsZjtcblx0XHRcdHNlbGYuaW5kZXggPSBpbmRleFN0cjtcblx0XHRcdHNlbGYuZ2V0SW5kZXggPSBnZXROZXN0ZWRJbmRleDtcblx0XHR9IGVsc2UgaWYgKHZpZXdzLmxlbmd0aCA9PT0gKHNlbGZfLmtleSA9IHNlbGYuaW5kZXggPSBrZXkpKSB7IC8vIFBhcmVudCBpcyBhbiAnYXJyYXkgdmlldycuIEFkZCB0aGlzIHZpZXcgdG8gaXRzIHZpZXdzIGFycmF5XG5cdFx0XHR2aWV3cy5wdXNoKHNlbGYpOyAvLyBBZGRpbmcgdG8gZW5kIG9mIHZpZXdzIGFycmF5LiAoVXNpbmcgcHVzaCB3aGVuIHBvc3NpYmxlIC0gYmV0dGVyIHBlcmYgdGhhbiBzcGxpY2UpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHZpZXdzLnNwbGljZShrZXksIDAsIHNlbGYpOyAvLyBJbnNlcnRpbmcgaW4gdmlld3MgYXJyYXlcblx0XHR9XG5cdFx0Ly8gSWYgbm8gY29udGV4dCB3YXMgcGFzc2VkIGluLCB1c2UgcGFyZW50IGNvbnRleHRcblx0XHQvLyBJZiBjb250ZXh0IHdhcyBwYXNzZWQgaW4sIGl0IHNob3VsZCBoYXZlIGJlZW4gbWVyZ2VkIGFscmVhZHkgd2l0aCBwYXJlbnQgY29udGV4dFxuXHRcdHNlbGYuY3R4ID0gY29udGV4dCB8fCBwYXJlbnRWaWV3LmN0eDtcblx0fSBlbHNlIHtcblx0XHRzZWxmLmN0eCA9IGNvbnRleHQgfHwge307XG5cdH1cbn1cblxuVmlldy5wcm90b3R5cGUgPSB7XG5cdGdldDogZ2V0Vmlldyxcblx0Z2V0SW5kZXg6IGdldEluZGV4LFxuXHRjdHhQcm06IGNvbnRleHRQYXJhbWV0ZXIsXG5cdGdldFJzYzogZ2V0UmVzb3VyY2UsXG5cdF9nZXRUbXBsOiBnZXRUZW1wbGF0ZSxcblx0X2dldE9iOiBnZXRQYXRoT2JqZWN0LFxuXHRfaXM6IFwidmlld1wiXG59O1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFJlZ2lzdHJhdGlvblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVDaGlsZFJlc291cmNlcyhwYXJlbnRUbXBsKSB7XG5cdHZhciBzdG9yZU5hbWUsIHN0b3JlTmFtZXMsIHJlc291cmNlcztcblx0Zm9yIChzdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0c3RvcmVOYW1lcyA9IHN0b3JlTmFtZSArIFwic1wiO1xuXHRcdGlmIChwYXJlbnRUbXBsW3N0b3JlTmFtZXNdKSB7XG5cdFx0XHRyZXNvdXJjZXMgPSBwYXJlbnRUbXBsW3N0b3JlTmFtZXNdOyAgICAvLyBSZXNvdXJjZXMgbm90IHlldCBjb21waWxlZFxuXHRcdFx0cGFyZW50VG1wbFtzdG9yZU5hbWVzXSA9IHt9OyAgICAgICAgICAgICAgIC8vIFJlbW92ZSB1bmNvbXBpbGVkIHJlc291cmNlc1xuXHRcdFx0JHZpZXdzW3N0b3JlTmFtZXNdKHJlc291cmNlcywgcGFyZW50VG1wbCk7IC8vIEFkZCBiYWNrIGluIHRoZSBjb21waWxlZCByZXNvdXJjZXNcblx0XHR9XG5cdH1cbn1cblxuLy89PT09PT09PT09PT09PT1cbi8vIGNvbXBpbGVUYWdcbi8vPT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVUYWcobmFtZSwgdGFnRGVmLCBwYXJlbnRUbXBsKSB7XG5cdHZhciB0bXBsLCBiYXNlVGFnLCBwcm9wLFxuXHRcdGNvbXBpbGVkRGVmID0gbmV3ICRzdWIuX3RnKCk7XG5cblx0ZnVuY3Rpb24gVGFnKCkge1xuXHRcdHZhciB0YWcgPSB0aGlzO1xuXHRcdHRhZy5fID0ge1xuXHRcdFx0dW5saW5rZWQ6IHRydWVcblx0XHR9O1xuXHRcdHRhZy5pbmxpbmUgPSB0cnVlO1xuXHRcdHRhZy50YWdOYW1lID0gbmFtZTtcblx0fVxuXG5cdGlmICgkaXNGdW5jdGlvbih0YWdEZWYpKSB7XG5cdFx0Ly8gU2ltcGxlIHRhZyBkZWNsYXJlZCBhcyBmdW5jdGlvbi4gTm8gcHJlc2VudGVyIGluc3RhbnRhdGlvbi5cblx0XHR0YWdEZWYgPSB7XG5cdFx0XHRkZXBlbmRzOiB0YWdEZWYuZGVwZW5kcyxcblx0XHRcdHJlbmRlcjogdGFnRGVmXG5cdFx0fTtcblx0fSBlbHNlIGlmIChcIlwiICsgdGFnRGVmID09PSB0YWdEZWYpIHtcblx0XHR0YWdEZWYgPSB7dGVtcGxhdGU6IHRhZ0RlZn07XG5cdH1cblxuXHRpZiAoYmFzZVRhZyA9IHRhZ0RlZi5iYXNlVGFnKSB7XG5cdFx0dGFnRGVmLmZsb3cgPSAhIXRhZ0RlZi5mbG93OyAvLyBTZXQgZmxvdyBwcm9wZXJ0eSwgc28gZGVmYXVsdHMgdG8gZmFsc2UgZXZlbiBpZiBiYXNlVGFnIGhhcyBmbG93PXRydWVcblx0XHRiYXNlVGFnID0gXCJcIiArIGJhc2VUYWcgPT09IGJhc2VUYWdcblx0XHRcdD8gKHBhcmVudFRtcGwgJiYgcGFyZW50VG1wbC50YWdzW2Jhc2VUYWddIHx8ICR0YWdzW2Jhc2VUYWddKVxuXHRcdFx0OiBiYXNlVGFnO1xuXHRcdGlmICghYmFzZVRhZykge1xuXHRcdFx0ZXJyb3IoJ2Jhc2VUYWc6IFwiJyArIHRhZ0RlZi5iYXNlVGFnICsgJ1wiIG5vdCBmb3VuZCcpO1xuXHRcdH1cblx0XHRjb21waWxlZERlZiA9ICRleHRlbmQoY29tcGlsZWREZWYsIGJhc2VUYWcpO1xuXG5cdFx0Zm9yIChwcm9wIGluIHRhZ0RlZikge1xuXHRcdFx0Y29tcGlsZWREZWZbcHJvcF0gPSBnZXRNZXRob2QoYmFzZVRhZ1twcm9wXSwgdGFnRGVmW3Byb3BdKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Y29tcGlsZWREZWYgPSAkZXh0ZW5kKGNvbXBpbGVkRGVmLCB0YWdEZWYpO1xuXHR9XG5cblx0Ly8gVGFnIGRlY2xhcmVkIGFzIG9iamVjdCwgdXNlZCBhcyB0aGUgcHJvdG90eXBlIGZvciB0YWcgaW5zdGFudGlhdGlvbiAoY29udHJvbC9wcmVzZW50ZXIpXG5cdGlmICgodG1wbCA9IGNvbXBpbGVkRGVmLnRlbXBsYXRlKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29tcGlsZWREZWYudGVtcGxhdGUgPSBcIlwiICsgdG1wbCA9PT0gdG1wbCA/ICgkdGVtcGxhdGVzW3RtcGxdIHx8ICR0ZW1wbGF0ZXModG1wbCkpIDogdG1wbDtcblx0fVxuXHQoVGFnLnByb3RvdHlwZSA9IGNvbXBpbGVkRGVmKS5jb25zdHJ1Y3RvciA9IGNvbXBpbGVkRGVmLl9jdHIgPSBUYWc7XG5cblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRjb21waWxlZERlZi5fcGFyZW50VG1wbCA9IHBhcmVudFRtcGw7XG5cdH1cblx0cmV0dXJuIGNvbXBpbGVkRGVmO1xufVxuXG5mdW5jdGlvbiBiYXNlQXBwbHkoYXJncykge1xuXHQvLyBJbiBkZXJpdmVkIG1ldGhvZCAob3IgaGFuZGxlciBkZWNsYXJlZCBkZWNsYXJhdGl2ZWx5IGFzIGluIHt7OmZvbyBvbkNoYW5nZT1+Zm9vQ2hhbmdlZH19IGNhbiBjYWxsIGJhc2UgbWV0aG9kLFxuXHQvLyB1c2luZyB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdHJldHVybiB0aGlzLmJhc2UuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8vPT09PT09PT09PT09PT09XG4vLyBjb21waWxlVG1wbFxuLy89PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZVRtcGwobmFtZSwgdG1wbCwgcGFyZW50VG1wbCwgb3B0aW9ucykge1xuXHQvLyB0bXBsIGlzIGVpdGhlciBhIHRlbXBsYXRlIG9iamVjdCwgYSBzZWxlY3RvciBmb3IgYSB0ZW1wbGF0ZSBzY3JpcHQgYmxvY2ssIHRoZSBuYW1lIG9mIGEgY29tcGlsZWQgdGVtcGxhdGUsIG9yIGEgdGVtcGxhdGUgb2JqZWN0XG5cblx0Ly89PT09IG5lc3RlZCBmdW5jdGlvbnMgPT09PVxuXHRmdW5jdGlvbiBsb29rdXBUZW1wbGF0ZSh2YWx1ZSkge1xuXHRcdC8vIElmIHZhbHVlIGlzIG9mIHR5cGUgc3RyaW5nIC0gdHJlYXQgYXMgc2VsZWN0b3IsIG9yIG5hbWUgb2YgY29tcGlsZWQgdGVtcGxhdGVcblx0XHQvLyBSZXR1cm4gdGhlIHRlbXBsYXRlIG9iamVjdCwgaWYgYWxyZWFkeSBjb21waWxlZCwgb3IgdGhlIG1hcmt1cCBzdHJpbmdcblx0XHR2YXIgY3VycmVudE5hbWUsIHRtcGw7XG5cdFx0aWYgKChcIlwiICsgdmFsdWUgPT09IHZhbHVlKSB8fCB2YWx1ZS5ub2RlVHlwZSA+IDAgJiYgKGVsZW0gPSB2YWx1ZSkpIHtcblx0XHRcdGlmICghZWxlbSkge1xuXHRcdFx0XHRpZiAoL15cXC5cXC9bXlxcXFw6Kj9cIjw+XSokLy50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHRtcGw9XCIuL3NvbWUvZmlsZS5odG1sXCJcblx0XHRcdFx0XHQvLyBJZiB0aGUgdGVtcGxhdGUgaXMgbm90IG5hbWVkLCB1c2UgXCIuL3NvbWUvZmlsZS5odG1sXCIgYXMgbmFtZS5cblx0XHRcdFx0XHRpZiAodG1wbCA9ICR0ZW1wbGF0ZXNbbmFtZSA9IG5hbWUgfHwgdmFsdWVdKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRtcGw7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIEJST1dTRVItU1BFQ0lGSUMgQ09ERSAobm90IG9uIE5vZGUuanMpOlxuXHRcdFx0XHRcdFx0Ly8gTG9vayBmb3Igc2VydmVyLWdlbmVyYXRlZCBzY3JpcHQgYmxvY2sgd2l0aCBpZCBcIi4vc29tZS9maWxlLmh0bWxcIlxuXHRcdFx0XHRcdFx0ZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoJC5mbiAmJiAhJHN1Yi5yVG1wbC50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRlbGVtID0gJCAodmFsdWUsIGRvY3VtZW50KVswXTsgLy8gaWYgalF1ZXJ5IGlzIGxvYWRlZCwgdGVzdCBmb3Igc2VsZWN0b3IgcmV0dXJuaW5nIGVsZW1lbnRzLCBhbmQgZ2V0IGZpcnN0IGVsZW1lbnRcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0XHR9Ly8gRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0fSAvL0JST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0aWYgKGVsZW0pIHtcblx0XHRcdFx0aWYgKGVsZW0udGFnTmFtZSAhPT0gXCJTQ1JJUFRcIikge1xuXHRcdFx0XHRcdGVycm9yKHZhbHVlICsgXCI6IFVzZSBzY3JpcHQgYmxvY2ssIG5vdCBcIiArIGVsZW0udGFnTmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9wdGlvbnMpIHtcblx0XHRcdFx0XHQvLyBXZSB3aWxsIGNvbXBpbGUgYSBuZXcgdGVtcGxhdGUgdXNpbmcgdGhlIG1hcmt1cCBpbiB0aGUgc2NyaXB0IGVsZW1lbnRcblx0XHRcdFx0XHR2YWx1ZSA9IGVsZW0uaW5uZXJIVE1MO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFdlIHdpbGwgY2FjaGUgYSBzaW5nbGUgY29weSBvZiB0aGUgY29tcGlsZWQgdGVtcGxhdGUsIGFuZCBhc3NvY2lhdGUgaXQgd2l0aCB0aGUgbmFtZVxuXHRcdFx0XHRcdC8vIChyZW5hbWluZyBmcm9tIGEgcHJldmlvdXMgbmFtZSBpZiB0aGVyZSB3YXMgb25lKS5cblx0XHRcdFx0XHRjdXJyZW50TmFtZSA9IGVsZW0uZ2V0QXR0cmlidXRlKHRtcGxBdHRyKTtcblx0XHRcdFx0XHRpZiAoY3VycmVudE5hbWUpIHtcblx0XHRcdFx0XHRcdGlmIChjdXJyZW50TmFtZSAhPT0ganN2VG1wbCkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9ICR0ZW1wbGF0ZXNbY3VycmVudE5hbWVdO1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgJHRlbXBsYXRlc1tjdXJyZW50TmFtZV07XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCQuZm4pIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkLmRhdGEoZWxlbSlbanN2VG1wbF07IC8vIEdldCBjYWNoZWQgY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFjdXJyZW50TmFtZSB8fCAhdmFsdWUpIHsgLy8gTm90IHlldCBjb21waWxlZCwgb3IgY2FjaGVkIHZlcnNpb24gbG9zdFxuXHRcdFx0XHRcdFx0bmFtZSA9IG5hbWUgfHwgKCQuZm4gPyBqc3ZUbXBsIDogdmFsdWUpO1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBjb21waWxlVG1wbChuYW1lLCBlbGVtLmlubmVySFRNTCwgcGFyZW50VG1wbCwgb3B0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlLnRtcGxOYW1lID0gbmFtZSA9IG5hbWUgfHwgY3VycmVudE5hbWU7XG5cdFx0XHRcdFx0aWYgKG5hbWUgIT09IGpzdlRtcGwpIHtcblx0XHRcdFx0XHRcdCR0ZW1wbGF0ZXNbbmFtZV0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxlbS5zZXRBdHRyaWJ1dGUodG1wbEF0dHIsIG5hbWUpO1xuXHRcdFx0XHRcdGlmICgkLmZuKSB7XG5cdFx0XHRcdFx0XHQkLmRhdGEoZWxlbSwganN2VG1wbCwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSAvLyBFTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHRlbGVtID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAoIXZhbHVlLmZuKSB7XG5cdFx0XHR2YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdC8vIElmIHZhbHVlIGlzIG5vdCBhIHN0cmluZy4gSFRNTCBlbGVtZW50LCBvciBjb21waWxlZCB0ZW1wbGF0ZSwgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblxuXHR2YXIgZWxlbSwgY29tcGlsZWRUbXBsLFxuXHRcdHRtcGxPck1hcmt1cCA9IHRtcGwgPSB0bXBsIHx8IFwiXCI7XG5cdCRzdWIuX2h0bWwgPSAkY29udmVydGVycy5odG1sO1xuXG5cdC8vPT09PSBDb21waWxlIHRoZSB0ZW1wbGF0ZSA9PT09XG5cdGlmIChvcHRpb25zID09PSAwKSB7XG5cdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHR0bXBsT3JNYXJrdXAgPSBsb29rdXBUZW1wbGF0ZSh0bXBsT3JNYXJrdXApOyAvLyBUb3AtbGV2ZWwgY29tcGlsZSBzbyBkbyBhIHRlbXBsYXRlIGxvb2t1cFxuXHR9XG5cblx0Ly8gSWYgb3B0aW9ucywgdGhlbiB0aGlzIHdhcyBhbHJlYWR5IGNvbXBpbGVkIGZyb20gYSAoc2NyaXB0KSBlbGVtZW50IHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuXHQvLyBJZiBub3QsIHRoZW4gaWYgdG1wbCBpcyBhIHRlbXBsYXRlIG9iamVjdCwgdXNlIGl0IGZvciBvcHRpb25zXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8ICh0bXBsLm1hcmt1cFxuXHRcdD8gdG1wbC5ibmRzXG5cdFx0XHQ/ICRleHRlbmQoe30sIHRtcGwpXG5cdFx0XHQ6IHRtcGxcblx0XHQ6IHt9XG5cdCk7XG5cblx0b3B0aW9ucy50bXBsTmFtZSA9IG9wdGlvbnMudG1wbE5hbWUgfHwgbmFtZSB8fCBcInVubmFtZWRcIjtcblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRvcHRpb25zLl9wYXJlbnRUbXBsID0gcGFyZW50VG1wbDtcblx0fVxuXHQvLyBJZiB0bXBsIGlzIG5vdCBhIG1hcmt1cCBzdHJpbmcgb3IgYSBzZWxlY3RvciBzdHJpbmcsIHRoZW4gaXQgbXVzdCBiZSBhIHRlbXBsYXRlIG9iamVjdFxuXHQvLyBJbiB0aGF0IGNhc2UsIGdldCBpdCBmcm9tIHRoZSBtYXJrdXAgcHJvcGVydHkgb2YgdGhlIG9iamVjdFxuXHRpZiAoIXRtcGxPck1hcmt1cCAmJiB0bXBsLm1hcmt1cCAmJiAodG1wbE9yTWFya3VwID0gbG9va3VwVGVtcGxhdGUodG1wbC5tYXJrdXApKSAmJiB0bXBsT3JNYXJrdXAuZm4pIHtcblx0XHQvLyBJZiB0aGUgc3RyaW5nIHJlZmVyZW5jZXMgYSBjb21waWxlZCB0ZW1wbGF0ZSBvYmplY3QsIG5lZWQgdG8gcmVjb21waWxlIHRvIG1lcmdlIGFueSBtb2RpZmllZCBvcHRpb25zXG5cdFx0dG1wbE9yTWFya3VwID0gdG1wbE9yTWFya3VwLm1hcmt1cDtcblx0fVxuXHRpZiAodG1wbE9yTWFya3VwICE9PSB1bmRlZmluZWQpIHtcblx0XHRpZiAodG1wbE9yTWFya3VwLnJlbmRlciB8fCB0bXBsLnJlbmRlcikge1xuXHRcdFx0Ly8gdG1wbCBpcyBhbHJlYWR5IGNvbXBpbGVkLCBzbyB1c2UgaXRcblx0XHRcdGlmICh0bXBsT3JNYXJrdXAudG1wbHMpIHtcblx0XHRcdFx0Y29tcGlsZWRUbXBsID0gdG1wbE9yTWFya3VwO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyB0bXBsT3JNYXJrdXAgaXMgYSBtYXJrdXAgc3RyaW5nLCBub3QgYSBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0Ly8gQ3JlYXRlIHRlbXBsYXRlIG9iamVjdFxuXHRcdFx0dG1wbCA9IHRtcGxPYmplY3QodG1wbE9yTWFya3VwLCBvcHRpb25zKTtcblx0XHRcdC8vIENvbXBpbGUgdG8gQVNUIGFuZCB0aGVuIHRvIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHR0bXBsRm4odG1wbE9yTWFya3VwLnJlcGxhY2UockVzY2FwZVF1b3RlcywgXCJcXFxcJCZcIiksIHRtcGwpO1xuXHRcdH1cblx0XHRpZiAoIWNvbXBpbGVkVG1wbCkge1xuXHRcdFx0Y29tcGlsZWRUbXBsID0gJGV4dGVuZChmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBpbGVkVG1wbC5yZW5kZXIuYXBwbHkoY29tcGlsZWRUbXBsLCBhcmd1bWVudHMpO1xuXHRcdFx0fSwgdG1wbCk7XG5cblx0XHRcdGNvbXBpbGVDaGlsZFJlc291cmNlcyhjb21waWxlZFRtcGwpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29tcGlsZWRUbXBsO1xuXHR9XG59XG5cbi8vPT09PSAvZW5kIG9mIGZ1bmN0aW9uIGNvbXBpbGVUbXBsID09PT1cblxuLy89PT09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVZpZXdNb2RlbFxuLy89PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpIHtcblx0cmV0dXJuICRpc0Z1bmN0aW9uKGRlZmF1bHRWYWwpXG5cdFx0PyBkZWZhdWx0VmFsLmNhbGwoZGF0YSlcblx0XHQ6IGRlZmF1bHRWYWw7XG59XG5cbmZ1bmN0aW9uIHVubWFwQXJyYXkobW9kZWxBcnIpIHtcblx0XHR2YXIgYXJyID0gW10sXG5cdFx0XHRpID0gMCxcblx0XHRcdGwgPSBtb2RlbEFyci5sZW5ndGg7XG5cdFx0Zm9yICg7IGk8bDsgaSsrKSB7XG5cdFx0XHRhcnIucHVzaChtb2RlbEFycltpXS51bm1hcCgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gY29tcGlsZVZpZXdNb2RlbChuYW1lLCB0eXBlKSB7XG5cdHZhciBpLCBjb25zdHJ1Y3Rvcixcblx0XHR2aWV3TW9kZWxzID0gdGhpcyxcblx0XHRnZXR0ZXJzID0gdHlwZS5nZXR0ZXJzLFxuXHRcdGV4dGVuZCA9IHR5cGUuZXh0ZW5kLFxuXHRcdGlkID0gdHlwZS5pZCxcblx0XHRwcm90byA9ICQuZXh0ZW5kKHtcblx0XHRcdF9pczogbmFtZSB8fCBcInVubmFtZWRcIixcblx0XHRcdHVubWFwOiB1bm1hcCxcblx0XHRcdG1lcmdlOiBtZXJnZVxuXHRcdH0sIGV4dGVuZCksXG5cdFx0YXJncyA9IFwiXCIsXG5cdFx0Ym9keSA9IFwiXCIsXG5cdFx0ZyA9IGdldHRlcnMgPyBnZXR0ZXJzLmxlbmd0aCA6IDAsXG5cdFx0JG9ic2VydmFibGUgPSAkLm9ic2VydmFibGUsXG5cdFx0Z2V0dGVyTmFtZXMgPSB7fTtcblxuXHRmdW5jdGlvbiBHZXROZXcoYXJncykge1xuXHRcdGNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHR9XG5cblx0ZnVuY3Rpb24gdm0oKSB7XG5cdFx0cmV0dXJuIG5ldyBHZXROZXcoYXJndW1lbnRzKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGl0ZXJhdGUoZGF0YSwgYWN0aW9uKSB7XG5cdFx0dmFyIGdldHRlclR5cGUsIGRlZmF1bHRWYWwsIHByb3AsIG9iLFxuXHRcdFx0aiA9IDA7XG5cdFx0Zm9yICg7IGo8ZzsgaisrKSB7XG5cdFx0XHRwcm9wID0gZ2V0dGVyc1tqXTtcblx0XHRcdGdldHRlclR5cGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocHJvcCArIFwiXCIgIT09IHByb3ApIHtcblx0XHRcdFx0Z2V0dGVyVHlwZSA9IHByb3A7XG5cdFx0XHRcdHByb3AgPSBnZXR0ZXJUeXBlLmdldHRlcjtcblx0XHRcdH1cblx0XHRcdGlmICgob2IgPSBkYXRhW3Byb3BdKSA9PT0gdW5kZWZpbmVkICYmIGdldHRlclR5cGUgJiYgKGRlZmF1bHRWYWwgPSBnZXR0ZXJUeXBlLmRlZmF1bHRWYWwpICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0b2IgPSBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0YWN0aW9uKG9iLCBnZXR0ZXJUeXBlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXSwgcHJvcCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gbWFwKGRhdGEpIHtcblx0XHRkYXRhID0gZGF0YSArIFwiXCIgPT09IGRhdGFcblx0XHRcdD8gSlNPTi5wYXJzZShkYXRhKSAvLyBBY2NlcHQgSlNPTiBzdHJpbmdcblx0XHRcdDogZGF0YTsgICAgICAgICAgICAvLyBvciBvYmplY3QvYXJyYXlcblx0XHR2YXIgbCwgcHJvcCxcblx0XHRcdGogPSAwLFxuXHRcdFx0b2IgPSBkYXRhLFxuXHRcdFx0YXJyID0gW107XG5cblx0XHRpZiAoJGlzQXJyYXkoZGF0YSkpIHtcblx0XHRcdGRhdGEgPSBkYXRhIHx8IFtdO1xuXHRcdFx0bCA9IGRhdGEubGVuZ3RoO1xuXHRcdFx0Zm9yICg7IGo8bDsgaisrKSB7XG5cdFx0XHRcdGFyci5wdXNoKHRoaXMubWFwKGRhdGFbal0pKTtcblx0XHRcdH1cblx0XHRcdGFyci5faXMgPSBuYW1lO1xuXHRcdFx0YXJyLnVubWFwID0gdW5tYXA7XG5cdFx0XHRhcnIubWVyZ2UgPSBtZXJnZTtcblx0XHRcdHJldHVybiBhcnI7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGl0ZXJhdGUoZGF0YSwgZnVuY3Rpb24ob2IsIHZpZXdNb2RlbCkge1xuXHRcdFx0XHRpZiAodmlld01vZGVsKSB7IC8vIEl0ZXJhdGUgdG8gYnVpbGQgZ2V0dGVycyBhcmcgYXJyYXkgKHZhbHVlLCBvciBtYXBwZWQgdmFsdWUpXG5cdFx0XHRcdFx0b2IgPSB2aWV3TW9kZWwubWFwKG9iKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhcnIucHVzaChvYik7XG5cdFx0XHR9KTtcblxuXHRcdFx0b2IgPSB0aGlzLmFwcGx5KHRoaXMsIGFycik7IC8vIEluc3RhbnRpYXRlIHRoaXMgVmlldyBNb2RlbCwgcGFzc2luZyBnZXR0ZXJzIGFyZ3MgYXJyYXkgdG8gY29uc3RydWN0b3Jcblx0XHRcdGZvciAocHJvcCBpbiBkYXRhKSB7IC8vIENvcHkgb3ZlciBhbnkgb3RoZXIgcHJvcGVydGllcy4gdGhhdCBhcmUgbm90IGdldC9zZXQgcHJvcGVydGllc1xuXHRcdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gJiYgIWdldHRlck5hbWVzW3Byb3BdKSB7XG5cdFx0XHRcdFx0b2JbcHJvcF0gPSBkYXRhW3Byb3BdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvYjtcblx0fVxuXG5cdGZ1bmN0aW9uIG1lcmdlKGRhdGEpIHtcblx0XHRkYXRhID0gZGF0YSArIFwiXCIgPT09IGRhdGFcblx0XHRcdD8gSlNPTi5wYXJzZShkYXRhKSAvLyBBY2NlcHQgSlNPTiBzdHJpbmdcblx0XHRcdDogZGF0YTsgICAgICAgICAgICAvLyBvciBvYmplY3QvYXJyYXlcblx0XHR2YXIgaiwgbCwgbSwgcHJvcCwgbW9kLCBmb3VuZCwgYXNzaWduZWQsIG9iLCBuZXdNb2RBcnIsXG5cdFx0XHRrID0gMCxcblx0XHRcdG1vZGVsID0gdGhpcztcblxuXHRcdGlmICgkaXNBcnJheShtb2RlbCkpIHtcblx0XHRcdGFzc2lnbmVkID0ge307XG5cdFx0XHRuZXdNb2RBcnIgPSBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdG0gPSBtb2RlbC5sZW5ndGg7XG5cdFx0XHRmb3IgKDsgazxsOyBrKyspIHtcblx0XHRcdFx0b2IgPSBkYXRhW2tdO1xuXHRcdFx0XHRmb3VuZCA9IGZhbHNlO1xuXHRcdFx0XHRmb3IgKGo9MDsgajxtICYmICFmb3VuZDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKGFzc2lnbmVkW2pdKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kID0gbW9kZWxbal07XG5cblx0XHRcdFx0XHRpZiAoaWQpIHtcblx0XHRcdFx0XHRcdGFzc2lnbmVkW2pdID0gZm91bmQgPSBpZCArIFwiXCIgPT09IGlkXG5cdFx0XHRcdFx0XHQ/IChvYltpZF0gJiYgKGdldHRlck5hbWVzW2lkXSA/IG1vZFtpZF0oKSA6IG1vZFtpZF0pID09PSBvYltpZF0pXG5cdFx0XHRcdFx0XHQ6IGlkKG1vZCwgb2IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0XHRtb2QubWVyZ2Uob2IpO1xuXHRcdFx0XHRcdG5ld01vZEFyci5wdXNoKG1vZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3TW9kQXJyLnB1c2godm0ubWFwKG9iKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHQkb2JzZXJ2YWJsZShtb2RlbCkucmVmcmVzaChuZXdNb2RBcnIsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kZWwuc3BsaWNlLmFwcGx5KG1vZGVsLCBbMCwgbW9kZWwubGVuZ3RoXS5jb25jYXQobmV3TW9kQXJyKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGl0ZXJhdGUoZGF0YSwgZnVuY3Rpb24ob2IsIHZpZXdNb2RlbCwgZ2V0dGVyKSB7XG5cdFx0XHRpZiAodmlld01vZGVsKSB7XG5cdFx0XHRcdG1vZGVsW2dldHRlcl0oKS5tZXJnZShvYik7IC8vIFVwZGF0ZSB0eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kZWxbZ2V0dGVyXShvYik7IC8vIFVwZGF0ZSBub24tdHlwZWQgcHJvcGVydHlcblx0XHRcdH1cblx0XHR9KTtcblx0XHRmb3IgKHByb3AgaW4gZGF0YSkge1xuXHRcdFx0aWYgKHByb3AgIT09ICRleHBhbmRvICYmICFnZXR0ZXJOYW1lc1twcm9wXSkge1xuXHRcdFx0XHRtb2RlbFtwcm9wXSA9IGRhdGFbcHJvcF07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gdW5tYXAoKSB7XG5cdFx0dmFyIG9iLCBwcm9wLCBnZXR0ZXJUeXBlLCBhcnIsIHZhbHVlLFxuXHRcdFx0ayA9IDAsXG5cdFx0XHRtb2RlbCA9IHRoaXM7XG5cblx0XHRpZiAoJGlzQXJyYXkobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gdW5tYXBBcnJheShtb2RlbCk7XG5cdFx0fVxuXHRcdG9iID0ge307XG5cdFx0Zm9yICg7IGs8ZzsgaysrKSB7XG5cdFx0XHRwcm9wID0gZ2V0dGVyc1trXTtcblx0XHRcdGdldHRlclR5cGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocHJvcCArIFwiXCIgIT09IHByb3ApIHtcblx0XHRcdFx0Z2V0dGVyVHlwZSA9IHByb3A7XG5cdFx0XHRcdHByb3AgPSBnZXR0ZXJUeXBlLmdldHRlcjtcblx0XHRcdH1cblx0XHRcdHZhbHVlID0gbW9kZWxbcHJvcF0oKTtcblx0XHRcdG9iW3Byb3BdID0gZ2V0dGVyVHlwZSAmJiB2YWx1ZSAmJiB2aWV3TW9kZWxzW2dldHRlclR5cGUudHlwZV1cblx0XHRcdFx0PyAkaXNBcnJheSh2YWx1ZSlcblx0XHRcdFx0XHQ/IHVubWFwQXJyYXkodmFsdWUpXG5cdFx0XHRcdFx0OiB2YWx1ZS51bm1hcCgpXG5cdFx0XHRcdDogdmFsdWU7XG5cdFx0fVxuXHRcdGZvciAocHJvcCBpbiBtb2RlbCkge1xuXHRcdFx0aWYgKHByb3AgIT09IFwiX2lzXCIgJiYgIWdldHRlck5hbWVzW3Byb3BdICYmIHByb3AgIT09ICRleHBhbmRvICAmJiAocHJvcC5jaGFyQXQoMCkgIT09IFwiX1wiIHx8ICFnZXR0ZXJOYW1lc1twcm9wLnNsaWNlKDEpXSkgJiYgISRpc0Z1bmN0aW9uKG1vZGVsW3Byb3BdKSkge1xuXHRcdFx0XHRvYltwcm9wXSA9IG1vZGVsW3Byb3BdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRHZXROZXcucHJvdG90eXBlID0gcHJvdG87XG5cblx0Zm9yIChpPTA7IGk8ZzsgaSsrKSB7XG5cdFx0KGZ1bmN0aW9uKGdldHRlcikge1xuXHRcdFx0Z2V0dGVyID0gZ2V0dGVyLmdldHRlciB8fCBnZXR0ZXI7XG5cdFx0XHRnZXR0ZXJOYW1lc1tnZXR0ZXJdID0gaSsxO1xuXHRcdFx0dmFyIHByaXZGaWVsZCA9IFwiX1wiICsgZ2V0dGVyO1xuXG5cdFx0XHRhcmdzICs9IChhcmdzID8gXCIsXCIgOiBcIlwiKSArIGdldHRlcjtcblx0XHRcdGJvZHkgKz0gXCJ0aGlzLlwiICsgcHJpdkZpZWxkICsgXCIgPSBcIiArIGdldHRlciArIFwiO1xcblwiO1xuXHRcdFx0cHJvdG9bZ2V0dGVyXSA9IHByb3RvW2dldHRlcl0gfHwgZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzW3ByaXZGaWVsZF07IC8vIElmIHRoZXJlIGlzIG5vIGFyZ3VtZW50LCB1c2UgYXMgYSBnZXR0ZXJcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0XHQkb2JzZXJ2YWJsZSh0aGlzKS5zZXRQcm9wZXJ0eShnZXR0ZXIsIHZhbCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpc1twcml2RmllbGRdID0gdmFsO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0cHJvdG9bZ2V0dGVyXS5zZXQgPSBwcm90b1tnZXR0ZXJdLnNldCB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7IC8vIFNldHRlciBjYWxsZWQgYnkgb2JzZXJ2YWJsZSBwcm9wZXJ0eSBjaGFuZ2Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KShnZXR0ZXJzW2ldKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yID0gbmV3IEZ1bmN0aW9uKGFyZ3MsIGJvZHkuc2xpY2UoMCwgLTEpKTtcblx0Y29uc3RydWN0b3IucHJvdG90eXBlID0gcHJvdG87XG5cdHByb3RvLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7XG5cblx0dm0ubWFwID0gbWFwO1xuXHR2bS5nZXR0ZXJzID0gZ2V0dGVycztcblx0dm0uZXh0ZW5kID0gZXh0ZW5kO1xuXHR2bS5pZCA9IGlkO1xuXHRyZXR1cm4gdm07XG59XG5cbmZ1bmN0aW9uIHRtcGxPYmplY3QobWFya3VwLCBvcHRpb25zKSB7XG5cdC8vIFRlbXBsYXRlIG9iamVjdCBjb25zdHJ1Y3RvclxuXHR2YXIgaHRtbFRhZyxcblx0XHR3cmFwTWFwID0gJHN1YlNldHRpbmdzQWR2YW5jZWQuX3dtIHx8IHt9LCAvLyBPbmx5IHVzZWQgaW4gSnNWaWV3cy4gT3RoZXJ3aXNlIGVtcHR5OiB7fVxuXHRcdHRtcGwgPSB7XG5cdFx0XHR0bXBsczogW10sXG5cdFx0XHRsaW5rczoge30sIC8vIENvbXBpbGVkIGZ1bmN0aW9ucyBmb3IgbGluayBleHByZXNzaW9uc1xuXHRcdFx0Ym5kczogW10sXG5cdFx0XHRfaXM6IFwidGVtcGxhdGVcIixcblx0XHRcdHJlbmRlcjogcmVuZGVyQ29udGVudFxuXHRcdH07XG5cblx0aWYgKG9wdGlvbnMpIHtcblx0XHR0bXBsID0gJGV4dGVuZCh0bXBsLCBvcHRpb25zKTtcblx0fVxuXG5cdHRtcGwubWFya3VwID0gbWFya3VwO1xuXHRpZiAoIXRtcGwuaHRtbFRhZykge1xuXHRcdC8vIFNldCB0bXBsLnRhZyB0byB0aGUgdG9wLWxldmVsIEhUTUwgdGFnIHVzZWQgaW4gdGhlIHRlbXBsYXRlLCBpZiBhbnkuLi5cblx0XHRodG1sVGFnID0gckZpcnN0RWxlbS5leGVjKG1hcmt1cCk7XG5cdFx0dG1wbC5odG1sVGFnID0gaHRtbFRhZyA/IGh0bWxUYWdbMV0udG9Mb3dlckNhc2UoKSA6IFwiXCI7XG5cdH1cblx0aHRtbFRhZyA9IHdyYXBNYXBbdG1wbC5odG1sVGFnXTtcblx0aWYgKGh0bWxUYWcgJiYgaHRtbFRhZyAhPT0gd3JhcE1hcC5kaXYpIHtcblx0XHQvLyBXaGVuIHVzaW5nIEpzVmlld3MsIHdlIHRyaW0gdGVtcGxhdGVzIHdoaWNoIGFyZSBpbnNlcnRlZCBpbnRvIEhUTUwgY29udGV4dHMgd2hlcmUgdGV4dCBub2RlcyBhcmUgbm90IHJlbmRlcmVkIChpLmUuIG5vdCAnUGhyYXNpbmcgQ29udGVudCcpLlxuXHRcdC8vIEN1cnJlbnRseSBub3QgdHJpbW1lZCBmb3IgPGxpPiB0YWcuIChOb3Qgd29ydGggYWRkaW5nIHBlcmYgY29zdClcblx0XHR0bXBsLm1hcmt1cCA9ICQudHJpbSh0bXBsLm1hcmt1cCk7XG5cdH1cblxuXHRyZXR1cm4gdG1wbDtcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gcmVnaXN0ZXJTdG9yZVxuLy89PT09PT09PT09PT09PVxuXG4vKipcbiogSW50ZXJuYWwuIFJlZ2lzdGVyIGEgc3RvcmUgdHlwZSAodXNlZCBmb3IgdGVtcGxhdGUsIHRhZ3MsIGhlbHBlcnMsIGNvbnZlcnRlcnMpXG4qL1xuZnVuY3Rpb24gcmVnaXN0ZXJTdG9yZShzdG9yZU5hbWUsIHN0b3JlU2V0dGluZ3MpIHtcblxuLyoqXG4qIEdlbmVyaWMgc3RvcmUoKSBmdW5jdGlvbiB0byByZWdpc3RlciBpdGVtLCBuYW1lZCBpdGVtLCBvciBoYXNoIG9mIGl0ZW1zXG4qIEFsc28gdXNlZCBhcyBoYXNoIHRvIHN0b3JlIHRoZSByZWdpc3RlcmVkIGl0ZW1zXG4qIFVzZWQgYXMgaW1wbGVtZW50YXRpb24gb2YgJC50ZW1wbGF0ZXMoKSwgJC52aWV3cy50ZW1wbGF0ZXMoKSwgJC52aWV3cy50YWdzKCksICQudmlld3MuaGVscGVycygpIGFuZCAkLnZpZXdzLmNvbnZlcnRlcnMoKVxuKlxuKiBAcGFyYW0ge3N0cmluZ3xoYXNofSBuYW1lICAgICAgICAgbmFtZSAtIG9yIHNlbGVjdG9yLCBpbiBjYXNlIG9mICQudGVtcGxhdGVzKCkuIE9yIGhhc2ggb2YgaXRlbXNcbiogQHBhcmFtIHthbnl9ICAgICAgICAgW2l0ZW1dICAgICAgIChlLmcuIG1hcmt1cCBmb3IgbmFtZWQgdGVtcGxhdGUpXG4qIEBwYXJhbSB7dGVtcGxhdGV9ICAgIFtwYXJlbnRUbXBsXSBGb3IgaXRlbSBiZWluZyByZWdpc3RlcmVkIGFzIHByaXZhdGUgcmVzb3VyY2Ugb2YgdGVtcGxhdGVcbiogQHJldHVybnMge2FueXwkLnZpZXdzfSBpdGVtLCBlLmcuIGNvbXBpbGVkIHRlbXBsYXRlIC0gb3IgJC52aWV3cyBpbiBjYXNlIG9mIHJlZ2lzdGVyaW5nIGhhc2ggb2YgaXRlbXNcbiovXG5cdGZ1bmN0aW9uIHRoZVN0b3JlKG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwpIHtcblx0XHQvLyBUaGUgc3RvcmUgaXMgYWxzbyB0aGUgZnVuY3Rpb24gdXNlZCB0byBhZGQgaXRlbXMgdG8gdGhlIHN0b3JlLiBlLmcuICQudGVtcGxhdGVzLCBvciAkLnZpZXdzLnRhZ3NcblxuXHRcdC8vIEZvciBzdG9yZSBvZiBuYW1lICd0aGluZycsIENhbGwgYXM6XG5cdFx0Ly8gICAgJC52aWV3cy50aGluZ3MoaXRlbXNbLCBwYXJlbnRUbXBsXSksXG5cdFx0Ly8gb3IgJC52aWV3cy50aGluZ3MobmFtZVssIGl0ZW0sIHBhcmVudFRtcGxdKVxuXG5cdFx0dmFyIGNvbXBpbGUsIGl0ZW1OYW1lLCB0aGlzU3RvcmUsIGNudCxcblx0XHRcdG9uU3RvcmUgPSAkc3ViLm9uU3RvcmVbc3RvcmVOYW1lXTtcblxuXHRcdGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSBPQkpFQ1QgJiYgIW5hbWUubm9kZVR5cGUgJiYgIW5hbWUubWFya3VwICYmICFuYW1lLmdldFRndCAmJiAhKHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIiAmJiBuYW1lLmdldHRlcnMgfHwgbmFtZS5leHRlbmQpKSB7XG5cdFx0XHQvLyBDYWxsIHRvICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXG5cdFx0XHQvLyBBZGRpbmcgaXRlbXMgdG8gdGhlIHN0b3JlXG5cdFx0XHQvLyBJZiBuYW1lIGlzIGEgaGFzaCwgdGhlbiBpdGVtIGlzIHBhcmVudFRtcGwuIEl0ZXJhdGUgb3ZlciBoYXNoIGFuZCBjYWxsIHN0b3JlIGZvciBrZXkuXG5cdFx0XHRmb3IgKGl0ZW1OYW1lIGluIG5hbWUpIHtcblx0XHRcdFx0dGhlU3RvcmUoaXRlbU5hbWUsIG5hbWVbaXRlbU5hbWVdLCBpdGVtKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtIHx8ICR2aWV3cztcblx0XHR9XG5cdFx0Ly8gQWRkaW5nIGEgc2luZ2xlIHVubmFtZWQgaXRlbSB0byB0aGUgc3RvcmVcblx0XHRpZiAoaXRlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpdGVtID0gbmFtZTtcblx0XHRcdG5hbWUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChuYW1lICYmIFwiXCIgKyBuYW1lICE9PSBuYW1lKSB7IC8vIG5hbWUgbXVzdCBiZSBhIHN0cmluZ1xuXHRcdFx0cGFyZW50VG1wbCA9IGl0ZW07XG5cdFx0XHRpdGVtID0gbmFtZTtcblx0XHRcdG5hbWUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXNTdG9yZSA9IHBhcmVudFRtcGxcblx0XHRcdD8gc3RvcmVOYW1lID09PSBcInZpZXdNb2RlbFwiXG5cdFx0XHRcdD8gcGFyZW50VG1wbFxuXHRcdFx0XHQ6IChwYXJlbnRUbXBsW3N0b3JlTmFtZXNdID0gcGFyZW50VG1wbFtzdG9yZU5hbWVzXSB8fCB7fSlcblx0XHRcdDogdGhlU3RvcmU7XG5cdFx0Y29tcGlsZSA9IHN0b3JlU2V0dGluZ3MuY29tcGlsZTtcblxuXHRcdGlmIChpdGVtID09PSBudWxsKSB7XG5cdFx0XHQvLyBJZiBpdGVtIGlzIG51bGwsIGRlbGV0ZSB0aGlzIGVudHJ5XG5cdFx0XHRpZiAobmFtZSkge1xuXHRcdFx0XHRkZWxldGUgdGhpc1N0b3JlW25hbWVdO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoY29tcGlsZSkge1xuXHRcdFx0XHRpdGVtID0gY29tcGlsZS5jYWxsKHRoaXNTdG9yZSwgbmFtZSwgaXRlbSwgcGFyZW50VG1wbCwgMCkgfHwge307XG5cdFx0XHRcdGl0ZW0uX2lzID0gc3RvcmVOYW1lOyAvLyBPbmx5IGRvIHRoaXMgZm9yIGNvbXBpbGVkIG9iamVjdHMgKHRhZ3MsIHRlbXBsYXRlcy4uLilcblx0XHRcdH1cblx0XHRcdGlmIChuYW1lKSB7XG5cdFx0XHRcdHRoaXNTdG9yZVtuYW1lXSA9IGl0ZW07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChvblN0b3JlKSB7XG5cdFx0XHQvLyBlLmcuIEpzVmlld3MgaW50ZWdyYXRpb25cblx0XHRcdG9uU3RvcmUobmFtZSwgaXRlbSwgcGFyZW50VG1wbCwgY29tcGlsZSk7XG5cdFx0fVxuXHRcdHJldHVybiBpdGVtO1xuXHR9XG5cblx0dmFyIHN0b3JlTmFtZXMgPSBzdG9yZU5hbWUgKyBcInNcIjtcblx0JHZpZXdzW3N0b3JlTmFtZXNdID0gdGhlU3RvcmU7XG59XG5cbi8qKlxuKiBBZGQgc2V0dGluZ3Mgc3VjaCBhczpcbiogJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUodHJ1ZSlcbiogQHBhcmFtIHtib29sZWFufSAgdmFsdWVcbiogQHJldHVybnMge1NldHRpbmdzfVxuKlxuKiBhbGxvd0NvZGUgPSAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSgpXG4qIEByZXR1cm5zIHtib29sZWFufVxuKi9cbmZ1bmN0aW9uIGFkZFNldHRpbmcoc3QpIHtcblx0JHZpZXdzU2V0dGluZ3Nbc3RdID0gZnVuY3Rpb24odmFsdWUpIHtcblx0XHRyZXR1cm4gYXJndW1lbnRzLmxlbmd0aFxuXHRcdFx0PyAoJHN1YlNldHRpbmdzW3N0XSA9IHZhbHVlLCAkdmlld3NTZXR0aW5ncylcblx0XHRcdDogJHN1YlNldHRpbmdzW3N0XTtcblx0fTtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIGRhdGFNYXAgZm9yIHJlbmRlciBvbmx5XG4vLz09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBkYXRhTWFwKG1hcERlZikge1xuXHRmdW5jdGlvbiBNYXAoc291cmNlLCBvcHRpb25zKSB7XG5cdFx0dGhpcy50Z3QgPSBtYXBEZWYuZ2V0VGd0KHNvdXJjZSwgb3B0aW9ucyk7XG5cdFx0b3B0aW9ucy5tYXAgPSB0aGlzO1xuXHR9XG5cblx0aWYgKCRpc0Z1bmN0aW9uKG1hcERlZikpIHtcblx0XHQvLyBTaW1wbGUgbWFwIGRlY2xhcmVkIGFzIGZ1bmN0aW9uXG5cdFx0bWFwRGVmID0ge1xuXHRcdFx0Z2V0VGd0OiBtYXBEZWZcblx0XHR9O1xuXHR9XG5cblx0aWYgKG1hcERlZi5iYXNlTWFwKSB7XG5cdFx0bWFwRGVmID0gJGV4dGVuZCgkZXh0ZW5kKHt9LCBtYXBEZWYuYmFzZU1hcCksIG1hcERlZik7XG5cdH1cblxuXHRtYXBEZWYubWFwID0gZnVuY3Rpb24oc291cmNlLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIG5ldyBNYXAoc291cmNlLCBvcHRpb25zKTtcblx0fTtcblx0cmV0dXJuIG1hcERlZjtcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gcmVuZGVyQ29udGVudFxuLy89PT09PT09PT09PT09PVxuXG4vKiogUmVuZGVyIHRoZSB0ZW1wbGF0ZSBhcyBhIHN0cmluZywgdXNpbmcgdGhlIHNwZWNpZmllZCBkYXRhIGFuZCBoZWxwZXJzL2NvbnRleHRcbiogJChcIiN0bXBsXCIpLnJlbmRlcigpLCB0bXBsLnJlbmRlcigpLCB0YWdDdHgucmVuZGVyKCksICQucmVuZGVyLm5hbWVkVG1wbCgpXG4qXG4qIEBwYXJhbSB7YW55fSAgICAgICAgZGF0YVxuKiBAcGFyYW0ge2hhc2h9ICAgICAgIFtjb250ZXh0XSAgICAgICAgICAgaGVscGVycyBvciBjb250ZXh0XG4qIEBwYXJhbSB7Ym9vbGVhbn0gICAgW25vSXRlcmF0aW9uXVxuKiBAcGFyYW0ge1ZpZXd9ICAgICAgIFtwYXJlbnRWaWV3XSAgICAgICAgaW50ZXJuYWxcbiogQHBhcmFtIHtzdHJpbmd9ICAgICBba2V5XSAgICAgICAgICAgICAgIGludGVybmFsXG4qIEBwYXJhbSB7ZnVuY3Rpb259ICAgW29uUmVuZGVyXSAgICAgICAgICBpbnRlcm5hbFxuKiBAcmV0dXJucyB7c3RyaW5nfSAgIHJlbmRlcmVkIHRlbXBsYXRlICAgaW50ZXJuYWxcbiovXG5mdW5jdGlvbiByZW5kZXJDb250ZW50KGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCBwYXJlbnRWaWV3LCBrZXksIG9uUmVuZGVyKSB7XG5cdHZhciBpLCBsLCB0YWcsIHRtcGwsIHRhZ0N0eCwgaXNUb3BSZW5kZXJDYWxsLCBwcmV2RGF0YSwgcHJldkluZGV4LFxuXHRcdHZpZXcgPSBwYXJlbnRWaWV3LFxuXHRcdHJlc3VsdCA9IFwiXCI7XG5cblx0aWYgKGNvbnRleHQgPT09IHRydWUpIHtcblx0XHRub0l0ZXJhdGlvbiA9IGNvbnRleHQ7IC8vIHBhc3NpbmcgYm9vbGVhbiBhcyBzZWNvbmQgcGFyYW0gLSBub0l0ZXJhdGlvblxuXHRcdGNvbnRleHQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGNvbnRleHQgIT09IE9CSkVDVCkge1xuXHRcdGNvbnRleHQgPSB1bmRlZmluZWQ7IC8vIGNvbnRleHQgbXVzdCBiZSBhIGJvb2xlYW4gKG5vSXRlcmF0aW9uKSBvciBhIHBsYWluIG9iamVjdFxuXHR9XG5cblx0aWYgKHRhZyA9IHRoaXMudGFnKSB7XG5cdFx0Ly8gVGhpcyBpcyBhIGNhbGwgZnJvbSByZW5kZXJUYWcgb3IgdGFnQ3R4LnJlbmRlciguLi4pXG5cdFx0dGFnQ3R4ID0gdGhpcztcblx0XHR2aWV3ID0gdmlldyB8fCB0YWdDdHgudmlldztcblx0XHR0bXBsID0gdmlldy5fZ2V0VG1wbCh0YWcudGVtcGxhdGUgfHwgdGFnQ3R4LnRtcGwpO1xuXHRcdGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0ZGF0YSA9IHRhZy5jb250ZW50Q3R4ICYmICRpc0Z1bmN0aW9uKHRhZy5jb250ZW50Q3R4KVxuXHRcdFx0XHQ/IGRhdGEgPSB0YWcuY29udGVudEN0eChkYXRhKVxuXHRcdFx0XHQ6IHZpZXc7IC8vIERlZmF1bHQgZGF0YSBjb250ZXh0IGZvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaXMgdGhlIGZpcnN0IGFyZ3VtZW50XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIFRoaXMgaXMgYSB0ZW1wbGF0ZS5yZW5kZXIoLi4uKSBjYWxsXG5cdFx0dG1wbCA9IHRoaXM7XG5cdH1cblxuXHRpZiAodG1wbCkge1xuXHRcdGlmICghcGFyZW50VmlldyAmJiBkYXRhICYmIGRhdGEuX2lzID09PSBcInZpZXdcIikge1xuXHRcdFx0dmlldyA9IGRhdGE7IC8vIFdoZW4gcGFzc2luZyBpbiBhIHZpZXcgdG8gcmVuZGVyIG9yIGxpbmsgKGFuZCBub3QgcGFzc2luZyBpbiBhIHBhcmVudCB2aWV3KSB1c2UgdGhlIHBhc3NlZC1pbiB2aWV3IGFzIHBhcmVudFZpZXdcblx0XHR9XG5cblx0XHRpZiAodmlldyAmJiBkYXRhID09PSB2aWV3KSB7XG5cdFx0XHQvLyBJbmhlcml0IHRoZSBkYXRhIGZyb20gdGhlIHBhcmVudCB2aWV3LlxuXHRcdFx0ZGF0YSA9IHZpZXcuZGF0YTtcblx0XHR9XG5cblx0XHRpc1RvcFJlbmRlckNhbGwgPSAhdmlldztcblx0XHRpc1JlbmRlckNhbGwgPSBpc1JlbmRlckNhbGwgfHwgaXNUb3BSZW5kZXJDYWxsO1xuXHRcdGlmICghdmlldykge1xuXHRcdFx0KGNvbnRleHQgPSBjb250ZXh0IHx8IHt9KS5yb290ID0gZGF0YTsgLy8gUHJvdmlkZSB+cm9vdCBhcyBzaG9ydGN1dCB0byB0b3AtbGV2ZWwgZGF0YS5cblx0XHR9XG5cdFx0aWYgKCFpc1JlbmRlckNhbGwgfHwgJHN1YlNldHRpbmdzQWR2YW5jZWQudXNlVmlld3MgfHwgdG1wbC51c2VWaWV3cyB8fCB2aWV3ICYmIHZpZXcgIT09IHRvcFZpZXcpIHtcblx0XHRcdHJlc3VsdCA9IHJlbmRlcldpdGhWaWV3cyh0bXBsLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgdmlldywga2V5LCBvblJlbmRlciwgdGFnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHZpZXcpIHsgLy8gSW4gYSBibG9ja1xuXHRcdFx0XHRwcmV2RGF0YSA9IHZpZXcuZGF0YTtcblx0XHRcdFx0cHJldkluZGV4ID0gdmlldy5pbmRleDtcblx0XHRcdFx0dmlldy5pbmRleCA9IGluZGV4U3RyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmlldyA9IHRvcFZpZXc7XG5cdFx0XHRcdHByZXZEYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0XHR2aWV3LmRhdGEgPSBkYXRhO1xuXHRcdFx0XHR2aWV3LmN0eCA9IGNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoJGlzQXJyYXkoZGF0YSkgJiYgIW5vSXRlcmF0aW9uKSB7XG5cdFx0XHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgcGFyZW50VmlldyBhcmUgcGFzc2VkIGluXG5cdFx0XHRcdC8vIGFsb25nIHdpdGggcGFyZW50IHZpZXcsIHRyZWF0IGFzIGluc2VydCAtZS5nLiBmcm9tIHZpZXcuYWRkVmlld3MgLSBzbyBwYXJlbnRWaWV3IGlzIGFscmVhZHkgdGhlIHZpZXcgaXRlbSBmb3IgYXJyYXkpXG5cdFx0XHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0XHRcdHZpZXcuaW5kZXggPSBpO1xuXHRcdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGFbaV07XG5cdFx0XHRcdFx0cmVzdWx0ICs9IHRtcGwuZm4oZGF0YVtpXSwgdmlldywgJHN1Yik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGEsIHZpZXcsICRzdWIpO1xuXHRcdFx0fVxuXHRcdFx0dmlldy5kYXRhID0gcHJldkRhdGE7XG5cdFx0XHR2aWV3LmluZGV4ID0gcHJldkluZGV4O1xuXHRcdH1cblx0XHRpZiAoaXNUb3BSZW5kZXJDYWxsKSB7XG5cdFx0XHRpc1JlbmRlckNhbGwgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlcldpdGhWaWV3cyh0bXBsLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgdmlldywga2V5LCBvblJlbmRlciwgdGFnKSB7XG5cdGZ1bmN0aW9uIHNldEl0ZW1WYXIoaXRlbSkge1xuXHRcdC8vIFdoZW4gaXRlbVZhciBpcyBzcGVjaWZpZWQsIHNldCBtb2RpZmllZCBjdHggd2l0aCB1c2VyLW5hbWVkIH5pdGVtXG5cdFx0bmV3Q3R4ID0gJGV4dGVuZCh7fSwgY29udGV4dCk7XG5cdFx0bmV3Q3R4W2l0ZW1WYXJdID0gaXRlbTtcblx0fVxuXG5cdC8vIFJlbmRlciB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGEgYXMgYSB0cmVlIG9mIHN1YnZpZXdzIChuZXN0ZWQgcmVuZGVyZWQgdGVtcGxhdGUgaW5zdGFuY2VzKSwgb3IgYXMgYSBzdHJpbmcgKHRvcC1sZXZlbCB0ZW1wbGF0ZSkuXG5cdC8vIElmIHRoZSBkYXRhIGlzIHRoZSBwYXJlbnQgdmlldywgdHJlYXQgYXMgbm9JdGVyYXRpb24sIHJlLXJlbmRlciB3aXRoIHRoZSBzYW1lIGRhdGEgY29udGV4dC5cblx0Ly8gdG1wbCBjYW4gYmUgYSBzdHJpbmcgKGUuZy4gcmVuZGVyZWQgYnkgYSB0YWcucmVuZGVyKCkgbWV0aG9kKSwgb3IgYSBjb21waWxlZCB0ZW1wbGF0ZS5cblx0dmFyIGksIGwsIG5ld1ZpZXcsIGNoaWxkVmlldywgaXRlbVJlc3VsdCwgc3dhcENvbnRlbnQsIGNvbnRlbnRUbXBsLCBvdXRlck9uUmVuZGVyLCB0bXBsTmFtZSwgaXRlbVZhciwgbmV3Q3R4LCB0YWdDdHgsIG5vTGlua2luZyxcblx0XHRyZXN1bHQgPSBcIlwiO1xuXG5cdGlmICh0YWcpIHtcblx0XHQvLyBUaGlzIGlzIGEgY2FsbCBmcm9tIHJlbmRlclRhZyBvciB0YWdDdHgucmVuZGVyKC4uLilcblx0XHR0bXBsTmFtZSA9IHRhZy50YWdOYW1lO1xuXHRcdHRhZ0N0eCA9IHRhZy50YWdDdHg7XG5cdFx0Y29udGV4dCA9IGNvbnRleHQgPyBleHRlbmRDdHgoY29udGV4dCwgdGFnLmN0eCkgOiB0YWcuY3R4O1xuXG5cdFx0aWYgKHRtcGwgPT09IHZpZXcuY29udGVudCkgeyAvLyB7e3h4eCB0bXBsPSNjb250ZW50fX1cblx0XHRcdGNvbnRlbnRUbXBsID0gdG1wbCAhPT0gdmlldy5jdHguX3dycCAvLyBXZSBhcmUgcmVuZGVyaW5nIHRoZSAjY29udGVudFxuXHRcdFx0XHQ/IHZpZXcuY3R4Ll93cnAgLy8gI2NvbnRlbnQgd2FzIHRoZSB0YWdDdHgucHJvcHMudG1wbCB3cmFwcGVyIG9mIHRoZSBibG9jayBjb250ZW50IC0gc28gd2l0aGluIHRoaXMgdmlldywgI2NvbnRlbnQgd2lsbCBub3cgYmUgdGhlIHZpZXcuY3R4Ll93cnAgYmxvY2sgY29udGVudFxuXHRcdFx0XHQ6IHVuZGVmaW5lZDsgLy8gI2NvbnRlbnQgd2FzIHRoZSB2aWV3LmN0eC5fd3JwIGJsb2NrIGNvbnRlbnQgLSBzbyB3aXRoaW4gdGhpcyB2aWV3LCB0aGVyZSBpcyBubyBsb25nZXIgYW55ICNjb250ZW50IHRvIHdyYXAuXG5cdFx0fSBlbHNlIGlmICh0bXBsICE9PSB0YWdDdHguY29udGVudCkge1xuXHRcdFx0aWYgKHRtcGwgPT09IHRhZy50ZW1wbGF0ZSkgeyAvLyBSZW5kZXJpbmcge3t0YWd9fSB0YWcudGVtcGxhdGUsIHJlcGxhY2luZyBibG9jayBjb250ZW50LlxuXHRcdFx0XHRjb250ZW50VG1wbCA9IHRhZ0N0eC50bXBsOyAvLyBTZXQgI2NvbnRlbnQgdG8gYmxvY2sgY29udGVudCAob3Igd3JhcHBlZCBibG9jayBjb250ZW50IGlmIHRhZ0N0eC5wcm9wcy50bXBsIGlzIHNldClcblx0XHRcdFx0Y29udGV4dC5fd3JwID0gdGFnQ3R4LmNvbnRlbnQ7IC8vIFBhc3Mgd3JhcHBlZCBibG9jayBjb250ZW50IHRvIG5lc3RlZCB2aWV3c1xuXHRcdFx0fSBlbHNlIHsgLy8gUmVuZGVyaW5nIHRhZ0N0eC5wcm9wcy50bXBsIHdyYXBwZXJcblx0XHRcdFx0Y29udGVudFRtcGwgPSB0YWdDdHguY29udGVudCB8fCB2aWV3LmNvbnRlbnQ7IC8vIFNldCAjY29udGVudCB0byB3cmFwcGVkIGJsb2NrIGNvbnRlbnRcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29udGVudFRtcGwgPSB2aWV3LmNvbnRlbnQ7IC8vIE5lc3RlZCB2aWV3cyBpbmhlcml0IHNhbWUgd3JhcHBlZCAjY29udGVudCBwcm9wZXJ0eVxuXHRcdH1cblxuXHRcdGlmICh0YWdDdHgucHJvcHMubGluayA9PT0gZmFsc2UpIHtcblx0XHRcdC8vIGxpbms9ZmFsc2Ugc2V0dGluZyBvbiBibG9jayB0YWdcblx0XHRcdC8vIFdlIHdpbGwgb3ZlcnJpZGUgaW5oZXJpdGVkIHZhbHVlIG9mIGxpbmsgYnkgdGhlIGV4cGxpY2l0IHNldHRpbmcgbGluaz1mYWxzZSB0YWtlbiBmcm9tIHByb3BzXG5cdFx0XHQvLyBUaGUgY2hpbGQgdmlld3Mgb2YgYW4gdW5saW5rZWQgdmlldyBhcmUgYWxzbyB1bmxpbmtlZC4gU28gc2V0dGluZyBjaGlsZCBiYWNrIHRvIHRydWUgd2lsbCBub3QgaGF2ZSBhbnkgZWZmZWN0LlxuXHRcdFx0Y29udGV4dCA9IGNvbnRleHQgfHwge307XG5cdFx0XHRjb250ZXh0LmxpbmsgPSBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGl0ZW1WYXIgPSB0YWdDdHgucHJvcHMuaXRlbVZhcikge1xuXHRcdFx0aWYgKGl0ZW1WYXJbMF0gIT09IFwiflwiKSB7XG5cdFx0XHRcdHN5bnRheEVycm9yKFwiVXNlIGl0ZW1WYXI9J35teUl0ZW0nXCIpO1xuXHRcdFx0fVxuXHRcdFx0aXRlbVZhciA9IGl0ZW1WYXIuc2xpY2UoMSk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHZpZXcpIHtcblx0XHRvblJlbmRlciA9IG9uUmVuZGVyIHx8IHZpZXcuXy5vblJlbmRlcjtcblx0XHRub0xpbmtpbmcgPSBjb250ZXh0ICYmIGNvbnRleHQubGluayA9PT0gZmFsc2U7XG5cblx0XHRpZiAobm9MaW5raW5nICYmIHZpZXcuXy5ubCkge1xuXHRcdFx0b25SZW5kZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29udGV4dCA9IGV4dGVuZEN0eChjb250ZXh0LCB2aWV3LmN0eCk7XG5cdH1cblxuXHRpZiAoa2V5ID09PSB0cnVlKSB7XG5cdFx0c3dhcENvbnRlbnQgPSB0cnVlO1xuXHRcdGtleSA9IDA7XG5cdH1cblxuXHQvLyBJZiBsaW5rPT09ZmFsc2UsIGRvIG5vdCBjYWxsIG9uUmVuZGVyLCBzbyBubyBkYXRhLWxpbmtpbmcgbWFya2VyIG5vZGVzXG5cdGlmIChvblJlbmRlciAmJiB0YWcgJiYgdGFnLl8ubm9Wd3MpIHtcblx0XHRvblJlbmRlciA9IHVuZGVmaW5lZDtcblx0fVxuXHRvdXRlck9uUmVuZGVyID0gb25SZW5kZXI7XG5cdGlmIChvblJlbmRlciA9PT0gdHJ1ZSkge1xuXHRcdC8vIFVzZWQgYnkgdmlldy5yZWZyZXNoKCkuIERvbid0IGNyZWF0ZSBhIG5ldyB3cmFwcGVyIHZpZXcuXG5cdFx0b3V0ZXJPblJlbmRlciA9IHVuZGVmaW5lZDtcblx0XHRvblJlbmRlciA9IHZpZXcuXy5vblJlbmRlcjtcblx0fVxuXHQvLyBTZXQgYWRkaXRpb25hbCBjb250ZXh0IG9uIHZpZXdzIGNyZWF0ZWQgaGVyZSwgKGFzIG1vZGlmaWVkIGNvbnRleHQgaW5oZXJpdGVkIGZyb20gdGhlIHBhcmVudCwgYW5kIHRvIGJlIGluaGVyaXRlZCBieSBjaGlsZCB2aWV3cylcblx0Y29udGV4dCA9IHRtcGwuaGVscGVyc1xuXHRcdD8gZXh0ZW5kQ3R4KHRtcGwuaGVscGVycywgY29udGV4dClcblx0XHQ6IGNvbnRleHQ7XG5cblx0bmV3Q3R4ID0gY29udGV4dDtcblx0aWYgKCRpc0FycmF5KGRhdGEpICYmICFub0l0ZXJhdGlvbikge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgdmlldyBhcmUgcGFzc2VkIGluXG5cdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRuZXdWaWV3ID0gc3dhcENvbnRlbnRcblx0XHRcdD8gdmlld1xuXHRcdFx0OiAoa2V5ICE9PSB1bmRlZmluZWQgJiYgdmlldylcblx0XHRcdFx0fHwgbmV3IFZpZXcoY29udGV4dCwgXCJhcnJheVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cdFx0bmV3Vmlldy5fLm5sPSBub0xpbmtpbmc7XG5cdFx0aWYgKHZpZXcgJiYgdmlldy5fLnVzZUtleSkge1xuXHRcdFx0Ly8gUGFyZW50IGlzIG5vdCBhbiAnYXJyYXkgdmlldydcblx0XHRcdG5ld1ZpZXcuXy5ibmQgPSAhdGFnIHx8IHRhZy5fLmJuZCAmJiB0YWc7IC8vIEZvciBhcnJheSB2aWV3cyB0aGF0IGFyZSBkYXRhIGJvdW5kIGZvciBjb2xsZWN0aW9uIGNoYW5nZSBldmVudHMsIHNldCB0aGVcblx0XHRcdC8vIHZpZXcuXy5ibmQgcHJvcGVydHkgdG8gdHJ1ZSBmb3IgdG9wLWxldmVsIGxpbmsoKSBvciBkYXRhLWxpbms9XCJ7Zm9yfVwiLCBvciB0byB0aGUgdGFnIGluc3RhbmNlIGZvciBhIGRhdGEtYm91bmQgdGFnLCBlLmcuIHtee2ZvciAuLi59fVxuXHRcdFx0bmV3Vmlldy50YWcgPSB0YWc7XG5cdFx0fVxuXHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3IgZWFjaCBkYXRhIGl0ZW0uXG5cdFx0XHRpZiAoaXRlbVZhcikge1xuXHRcdFx0XHRzZXRJdGVtVmFyKGRhdGFbaV0pOyAvLyB1c2UgbW9kaWZpZWQgY3R4IHdpdGggdXNlci1uYW1lZCB+aXRlbVxuXHRcdFx0fVxuXHRcdFx0Y2hpbGRWaWV3ID0gbmV3IFZpZXcobmV3Q3R4LCBcIml0ZW1cIiwgbmV3VmlldywgZGF0YVtpXSwgdG1wbCwgKGtleSB8fCAwKSArIGksIG9uUmVuZGVyLCBuZXdWaWV3LmNvbnRlbnQpO1xuXHRcdFx0Y2hpbGRWaWV3Ll8uaXQgPSBpdGVtVmFyO1xuXG5cdFx0XHRpdGVtUmVzdWx0ID0gdG1wbC5mbihkYXRhW2ldLCBjaGlsZFZpZXcsICRzdWIpO1xuXHRcdFx0cmVzdWx0ICs9IG5ld1ZpZXcuXy5vblJlbmRlciA/IG5ld1ZpZXcuXy5vblJlbmRlcihpdGVtUmVzdWx0LCBjaGlsZFZpZXcpIDogaXRlbVJlc3VsdDtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3Igc2luZ2xldG9uIGRhdGEgb2JqZWN0LiBUaGUgdHlwZSBvZiB0aGUgdmlldyB3aWxsIGJlIHRoZSB0YWcgbmFtZSwgZS5nLiBcImlmXCIgb3IgXCJteXRhZ1wiIGV4Y2VwdCBmb3Jcblx0XHQvLyBcIml0ZW1cIiwgXCJhcnJheVwiIGFuZCBcImRhdGFcIiB2aWV3cy4gQSBcImRhdGFcIiB2aWV3IGlzIGZyb20gcHJvZ3JhbW1hdGljIHJlbmRlcihvYmplY3QpIGFnYWluc3QgYSAnc2luZ2xldG9uJy5cblx0XHRpZiAoaXRlbVZhcikge1xuXHRcdFx0c2V0SXRlbVZhcihkYXRhKTtcblx0XHR9XG5cdFx0bmV3VmlldyA9IHN3YXBDb250ZW50ID8gdmlldyA6IG5ldyBWaWV3KG5ld0N0eCwgdG1wbE5hbWUgfHwgXCJkYXRhXCIsIHZpZXcsIGRhdGEsIHRtcGwsIGtleSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKTtcblx0XHRuZXdWaWV3Ll8uaXQgPSBpdGVtVmFyO1xuXHRcdG5ld1ZpZXcudGFnID0gdGFnO1xuXHRcdG5ld1ZpZXcuXy5ubCA9IG5vTGlua2luZztcblx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhLCBuZXdWaWV3LCAkc3ViKTtcblx0fVxuXHRpZiAodGFnKSB7XG5cdFx0bmV3Vmlldy50YWdFbHNlID0gdGFnQ3R4LmluZGV4O1xuXHRcdHRhZ0N0eC5jb250ZW50VmlldyA9IG5ld1ZpZXc7XG5cdH1cblx0cmV0dXJuIG91dGVyT25SZW5kZXIgPyBvdXRlck9uUmVuZGVyKHJlc3VsdCwgbmV3VmlldykgOiByZXN1bHQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBCdWlsZCBhbmQgY29tcGlsZSB0ZW1wbGF0ZVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy8gR2VuZXJhdGUgYSByZXVzYWJsZSBmdW5jdGlvbiB0aGF0IHdpbGwgc2VydmUgdG8gcmVuZGVyIGEgdGVtcGxhdGUgYWdhaW5zdCBkYXRhXG4vLyAoQ29tcGlsZSBBU1QgdGhlbiBidWlsZCB0ZW1wbGF0ZSBmdW5jdGlvbilcblxuZnVuY3Rpb24gb25SZW5kZXJFcnJvcihlLCB2aWV3LCBmYWxsYmFjaykge1xuXHR2YXIgbWVzc2FnZSA9IGZhbGxiYWNrICE9PSB1bmRlZmluZWRcblx0XHQ/ICRpc0Z1bmN0aW9uKGZhbGxiYWNrKVxuXHRcdFx0PyBmYWxsYmFjay5jYWxsKHZpZXcuZGF0YSwgZSwgdmlldylcblx0XHRcdDogZmFsbGJhY2sgfHwgXCJcIlxuXHRcdDogXCJ7RXJyb3I6IFwiICsgKGUubWVzc2FnZXx8ZSkgKyBcIn1cIjtcblxuXHRpZiAoJHN1YlNldHRpbmdzLm9uRXJyb3IgJiYgKGZhbGxiYWNrID0gJHN1YlNldHRpbmdzLm9uRXJyb3IuY2FsbCh2aWV3LmRhdGEsIGUsIGZhbGxiYWNrICYmIG1lc3NhZ2UsIHZpZXcpKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0bWVzc2FnZSA9IGZhbGxiYWNrOyAvLyBUaGVyZSBpcyBhIHNldHRpbmdzLmRlYnVnTW9kZShoYW5kbGVyKSBvbkVycm9yIG92ZXJyaWRlLiBDYWxsIGl0LCBhbmQgdXNlIHJldHVybiB2YWx1ZSAoaWYgYW55KSB0byByZXBsYWNlIG1lc3NhZ2Vcblx0fVxuXG5cdHJldHVybiB2aWV3ICYmICF2aWV3Ll9sYyA/ICRjb252ZXJ0ZXJzLmh0bWwobWVzc2FnZSkgOiBtZXNzYWdlO1xufVxuXG5mdW5jdGlvbiBlcnJvcihtZXNzYWdlKSB7XG5cdHRocm93IG5ldyAkc3ViLkVycihtZXNzYWdlKTtcbn1cblxuZnVuY3Rpb24gc3ludGF4RXJyb3IobWVzc2FnZSkge1xuXHRlcnJvcihcIlN5bnRheCBlcnJvclxcblwiICsgbWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIHRtcGxGbihtYXJrdXAsIHRtcGwsIGlzTGlua0V4cHIsIGNvbnZlcnRCYWNrLCBoYXNFbHNlKSB7XG5cdC8vIENvbXBpbGUgbWFya3VwIHRvIEFTVCAoYWJ0cmFjdCBzeW50YXggdHJlZSkgdGhlbiBidWlsZCB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gY29kZSBmcm9tIHRoZSBBU1Qgbm9kZXNcblx0Ly8gVXNlZCBmb3IgY29tcGlsaW5nIHRlbXBsYXRlcywgYW5kIGFsc28gYnkgSnNWaWV3cyB0byBidWlsZCBmdW5jdGlvbnMgZm9yIGRhdGEgbGluayBleHByZXNzaW9uc1xuXG5cdC8vPT09PSBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblx0ZnVuY3Rpb24gcHVzaHByZWNlZGluZ0NvbnRlbnQoc2hpZnQpIHtcblx0XHRzaGlmdCAtPSBsb2M7XG5cdFx0aWYgKHNoaWZ0KSB7XG5cdFx0XHRjb250ZW50LnB1c2gobWFya3VwLnN1YnN0cihsb2MsIHNoaWZ0KS5yZXBsYWNlKHJOZXdMaW5lLCBcIlxcXFxuXCIpKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBibG9ja1RhZ0NoZWNrKHRhZ05hbWUsIGJsb2NrKSB7XG5cdFx0aWYgKHRhZ05hbWUpIHtcblx0XHRcdHRhZ05hbWUgKz0gJ319Jztcblx0XHRcdC8vXHRcdFx0J3t7aW5jbHVkZX19IGJsb2NrIGhhcyB7ey9mb3J9fSB3aXRoIG5vIG9wZW4ge3tmb3J9fSdcblx0XHRcdHN5bnRheEVycm9yKChcblx0XHRcdFx0YmxvY2tcblx0XHRcdFx0XHQ/ICd7eycgKyBibG9jayArICd9fSBibG9jayBoYXMge3svJyArIHRhZ05hbWUgKyAnIHdpdGhvdXQge3snICsgdGFnTmFtZVxuXHRcdFx0XHRcdDogJ1VubWF0Y2hlZCBvciBtaXNzaW5nIHt7LycgKyB0YWdOYW1lKSArICcsIGluIHRlbXBsYXRlOlxcbicgKyBtYXJrdXApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHBhcnNlVGFnKGFsbCwgYmluZCwgdGFnTmFtZSwgY29udmVydGVyLCBjb2xvbiwgaHRtbCwgY29kZVRhZywgcGFyYW1zLCBzbGFzaCwgYmluZDIsIGNsb3NlQmxvY2ssIGluZGV4KSB7XG4vKlxuXG4gICAgIGJpbmQgICAgIHRhZ05hbWUgICAgICAgICBjdnQgICBjbG4gaHRtbCBjb2RlICAgIHBhcmFtcyAgICAgICAgICAgIHNsYXNoICAgYmluZDIgICAgICAgICBjbG9zZUJsayAgY29tbWVudFxuLyg/OnsoXFxeKT97KD86KFxcdysoPz1bXFwvXFxzfV0pKXwoXFx3Kyk/KDopfCg+KXwoXFwqKSlcXHMqKCg/OltefV18fSg/IX0pKSo/KShcXC8pP3x7KFxcXik/eyg/Oig/OlxcLyhcXHcrKSlcXHMqfCEtLVtcXHNcXFNdKj8tLSkpfX0vZ1xuXG4oPzpcbiAgeyhcXF4pP3sgICAgICAgICAgICBiaW5kXG4gICg/OlxuICAgIChcXHcrICAgICAgICAgICAgIHRhZ05hbWVcbiAgICAgICg/PVtcXC9cXHN9XSlcbiAgICApXG4gICAgfFxuICAgIChcXHcrKT8oOikgICAgICAgIGNvbnZlcnRlciBjb2xvblxuICAgIHxcbiAgICAoPikgICAgICAgICAgICAgIGh0bWxcbiAgICB8XG4gICAgKFxcKikgICAgICAgICAgICAgY29kZVRhZ1xuICApXG4gIFxccypcbiAgKCAgICAgICAgICAgICAgICAgIHBhcmFtc1xuICAgICg/OltefV18fSg/IX0pKSo/XG4gIClcbiAgKFxcLyk/ICAgICAgICAgICAgICBzbGFzaFxuICB8XG4gIHsoXFxeKT97ICAgICAgICAgICAgYmluZDJcbiAgKD86XG4gICAgKD86XFwvKFxcdyspKVxccyogICBjbG9zZUJsb2NrXG4gICAgfFxuICAgICEtLVtcXHNcXFNdKj8tLSAgICBjb21tZW50XG4gIClcbilcbn19L2dcblxuKi9cblx0XHRpZiAoY29kZVRhZyAmJiBiaW5kIHx8IHNsYXNoICYmICF0YWdOYW1lIHx8IHBhcmFtcyAmJiBwYXJhbXMuc2xpY2UoLTEpID09PSBcIjpcIiB8fCBiaW5kMikge1xuXHRcdFx0c3ludGF4RXJyb3IoYWxsKTtcblx0XHR9XG5cblx0XHQvLyBCdWlsZCBhYnN0cmFjdCBzeW50YXggdHJlZSAoQVNUKTogW3RhZ05hbWUsIGNvbnZlcnRlciwgcGFyYW1zLCBjb250ZW50LCBoYXNoLCBiaW5kaW5ncywgY29udGVudE1hcmt1cF1cblx0XHRpZiAoaHRtbCkge1xuXHRcdFx0Y29sb24gPSBcIjpcIjtcblx0XHRcdGNvbnZlcnRlciA9IEhUTUw7XG5cdFx0fVxuXHRcdHNsYXNoID0gc2xhc2ggfHwgaXNMaW5rRXhwciAmJiAhaGFzRWxzZTtcblxuXHRcdHZhciBsYXRlLCBvcGVuVGFnTmFtZSwgaXNMYXRlT2IsXG5cdFx0XHRwYXRoQmluZGluZ3MgPSAoYmluZCB8fCBpc0xpbmtFeHByKSAmJiBbW11dLCAvLyBwYXRoQmluZGluZ3MgaXMgYW4gYXJyYXkgb2YgYXJyYXlzIGZvciBhcmcgYmluZGluZ3MgYW5kIGEgaGFzaCBvZiBhcnJheXMgZm9yIHByb3AgYmluZGluZ3Ncblx0XHRcdHByb3BzID0gXCJcIixcblx0XHRcdGFyZ3MgPSBcIlwiLFxuXHRcdFx0Y3R4UHJvcHMgPSBcIlwiLFxuXHRcdFx0cGFyYW1zQXJncyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNQcm9wcyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNDdHhQcm9wcyA9IFwiXCIsXG5cdFx0XHRvbkVycm9yID0gXCJcIixcblx0XHRcdHVzZVRyaWdnZXIgPSBcIlwiLFxuXHRcdFx0Ly8gQmxvY2sgdGFnIGlmIG5vdCBzZWxmLWNsb3NpbmcgYW5kIG5vdCB7ezp9fSBvciB7ez59fSAoc3BlY2lhbCBjYXNlKSBhbmQgbm90IGEgZGF0YS1saW5rIGV4cHJlc3Npb25cblx0XHRcdGJsb2NrID0gIXNsYXNoICYmICFjb2xvbjtcblxuXHRcdC8vPT09PSBuZXN0ZWQgaGVscGVyIGZ1bmN0aW9uID09PT1cblx0XHR0YWdOYW1lID0gdGFnTmFtZSB8fCAocGFyYW1zID0gcGFyYW1zIHx8IFwiI2RhdGFcIiwgY29sb24pOyAvLyB7ezp9fSBpcyBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRwdXNocHJlY2VkaW5nQ29udGVudChpbmRleCk7XG5cdFx0bG9jID0gaW5kZXggKyBhbGwubGVuZ3RoOyAvLyBsb2NhdGlvbiBtYXJrZXIgLSBwYXJzZWQgdXAgdG8gaGVyZVxuXHRcdGlmIChjb2RlVGFnKSB7XG5cdFx0XHRpZiAoYWxsb3dDb2RlKSB7XG5cdFx0XHRcdGNvbnRlbnQucHVzaChbXCIqXCIsIFwiXFxuXCIgKyBwYXJhbXMucmVwbGFjZSgvXjovLCBcInJldCs9IFwiKS5yZXBsYWNlKHJVbmVzY2FwZVF1b3RlcywgXCIkMVwiKSArIFwiO1xcblwiXSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0YWdOYW1lKSB7XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0aWYgKHJUZXN0RWxzZUlmLnRlc3QocGFyYW1zKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKCdGb3IgXCJ7e2Vsc2UgaWYgZXhwcn19XCIgdXNlIFwie3tlbHNlIGV4cHJ9fVwiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGF0aEJpbmRpbmdzID0gY3VycmVudFs5XSAmJiBbW11dO1xuXHRcdFx0XHRjdXJyZW50WzEwXSA9IG1hcmt1cC5zdWJzdHJpbmcoY3VycmVudFsxMF0sIGluZGV4KTsgLy8gY29udGVudE1hcmt1cCBmb3IgYmxvY2sgdGFnXG5cdFx0XHRcdG9wZW5UYWdOYW1lID0gY3VycmVudFsxMV0gfHwgY3VycmVudFswXSB8fCBzeW50YXhFcnJvcihcIk1pc21hdGNoZWQ6IFwiICsgYWxsKTtcblx0XHRcdFx0Ly8gY3VycmVudFswXSBpcyB0YWdOYW1lLCBidXQgZm9yIHt7ZWxzZX19IG5vZGVzLCBjdXJyZW50WzExXSBpcyB0YWdOYW1lIG9mIHByZWNlZGluZyBvcGVuIHRhZ1xuXHRcdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0XHRcdGNvbnRlbnQgPSBjdXJyZW50WzJdO1xuXHRcdFx0XHRibG9jayA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGFyYW1zKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBwYXJhbXMgc3RyaW5nLCB0byBhdm9pZCBjb21waWxlZCBjb2RlIGVycm9ycyBmb3IgdW50ZXJtaW5hdGVkIHN0cmluZ3Ncblx0XHRcdFx0cGFyc2VQYXJhbXMocGFyYW1zLnJlcGxhY2Uock5ld0xpbmUsIFwiIFwiKSwgcGF0aEJpbmRpbmdzLCB0bXBsLCBpc0xpbmtFeHByKVxuXHRcdFx0XHRcdC5yZXBsYWNlKHJCdWlsZEhhc2gsIGZ1bmN0aW9uKGFsbCwgb25lcnJvciwgaXNDdHhQcm0sIGtleSwga2V5VG9rZW4sIGtleVZhbHVlLCBhcmcsIHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRpZiAoa2V5ID09PSBcInRoaXM6XCIpIHtcblx0XHRcdFx0XHRcdFx0a2V5VmFsdWUgPSBcInVuZGVmaW5lZFwiOyAvLyB0aGlzPXNvbWUucGF0aCBpcyBhbHdheXMgYSB0byBwYXJhbWV0ZXIgKG9uZS13YXkpLCBzbyBkb24ndCBuZWVkIHRvIGNvbXBpbGUvZXZhbHVhdGUgc29tZS5wYXRoIGluaXRpYWxpemF0aW9uXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAocGFyYW0pIHtcblx0XHRcdFx0XHRcdFx0aXNMYXRlT2IgPSBpc0xhdGVPYiB8fCBwYXJhbVswXSA9PT0gXCJAXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRrZXkgPSBcIidcIiArIGtleVRva2VuICsgXCInOlwiO1xuXHRcdFx0XHRcdFx0aWYgKGFyZykge1xuXHRcdFx0XHRcdFx0XHRhcmdzICs9IGlzQ3R4UHJtICsga2V5VmFsdWUgKyBcIixcIjtcblx0XHRcdFx0XHRcdFx0cGFyYW1zQXJncyArPSBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChpc0N0eFBybSkgeyAvLyBDb250ZXh0dWFsIHBhcmFtZXRlciwgfmZvbz1leHByXG5cdFx0XHRcdFx0XHRcdGN0eFByb3BzICs9IGtleSArICdqLl9jcCgnICsga2V5VmFsdWUgKyAnLFwiJyArIHBhcmFtICsgJ1wiLHZpZXcpLCc7XG5cdFx0XHRcdFx0XHRcdC8vIENvbXBpbGVkIGNvZGUgZm9yIGV2YWx1YXRpbmcgdGFnQ3R4IG9uIGEgdGFnIHdpbGwgaGF2ZTogY3R4OnsnZm9vJzpqLl9jcChjb21waWxlZEV4cHIsIFwiZXhwclwiLCB2aWV3KX1cblx0XHRcdFx0XHRcdFx0cGFyYW1zQ3R4UHJvcHMgKz0ga2V5ICsgXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAob25lcnJvcikge1xuXHRcdFx0XHRcdFx0XHRvbkVycm9yICs9IGtleVZhbHVlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aWYgKGtleVRva2VuID09PSBcInRyaWdnZXJcIikge1xuXHRcdFx0XHRcdFx0XHRcdHVzZVRyaWdnZXIgKz0ga2V5VmFsdWU7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKGtleVRva2VuID09PSBcImxhdGVSZW5kZXJcIikge1xuXHRcdFx0XHRcdFx0XHRcdGxhdGUgPSBwYXJhbSAhPT0gXCJmYWxzZVwiOyAvLyBSZW5kZXIgYWZ0ZXIgZmlyc3QgcGFzc1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHByb3BzICs9IGtleSArIGtleVZhbHVlICsgXCIsXCI7XG5cdFx0XHRcdFx0XHRcdHBhcmFtc1Byb3BzICs9IGtleSArIFwiJ1wiICsgcGFyYW0gKyBcIicsXCI7XG5cdFx0XHRcdFx0XHRcdGhhc0hhbmRsZXJzID0gaGFzSGFuZGxlcnMgfHwgckhhc0hhbmRsZXJzLnRlc3Qoa2V5VG9rZW4pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIFwiXCI7XG5cdFx0XHRcdFx0fSkuc2xpY2UoMCwgLTEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocGF0aEJpbmRpbmdzICYmIHBhdGhCaW5kaW5nc1swXSkge1xuXHRcdFx0XHRwYXRoQmluZGluZ3MucG9wKCk7IC8vIFJlbW92ZSB0aGUgYmluZGluZyB0aGF0IHdhcyBwcmVwYXJlZCBmb3IgbmV4dCBhcmcuIChUaGVyZSBpcyBhbHdheXMgYW4gZXh0cmEgb25lIHJlYWR5KS5cblx0XHRcdH1cblxuXHRcdFx0bmV3Tm9kZSA9IFtcblx0XHRcdFx0XHR0YWdOYW1lLFxuXHRcdFx0XHRcdGNvbnZlcnRlciB8fCAhIWNvbnZlcnRCYWNrIHx8IGhhc0hhbmRsZXJzIHx8IFwiXCIsXG5cdFx0XHRcdFx0YmxvY2sgJiYgW10sXG5cdFx0XHRcdFx0cGFyc2VkUGFyYW0ocGFyYW1zQXJncyB8fCAodGFnTmFtZSA9PT0gXCI6XCIgPyBcIicjZGF0YScsXCIgOiBcIlwiKSwgcGFyYW1zUHJvcHMsIHBhcmFtc0N0eFByb3BzKSwgLy8ge3s6fX0gZXF1aXZhbGVudCB0byB7ezojZGF0YX19XG5cdFx0XHRcdFx0cGFyc2VkUGFyYW0oYXJncyB8fCAodGFnTmFtZSA9PT0gXCI6XCIgPyBcImRhdGEsXCIgOiBcIlwiKSwgcHJvcHMsIGN0eFByb3BzKSxcblx0XHRcdFx0XHRvbkVycm9yLFxuXHRcdFx0XHRcdHVzZVRyaWdnZXIsXG5cdFx0XHRcdFx0bGF0ZSxcblx0XHRcdFx0XHRpc0xhdGVPYixcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgfHwgMFxuXHRcdFx0XHRdO1xuXHRcdFx0Y29udGVudC5wdXNoKG5ld05vZGUpO1xuXHRcdFx0aWYgKGJsb2NrKSB7XG5cdFx0XHRcdHN0YWNrLnB1c2goY3VycmVudCk7XG5cdFx0XHRcdGN1cnJlbnQgPSBuZXdOb2RlO1xuXHRcdFx0XHRjdXJyZW50WzEwXSA9IGxvYzsgLy8gU3RvcmUgY3VycmVudCBsb2NhdGlvbiBvZiBvcGVuIHRhZywgdG8gYmUgYWJsZSB0byBhZGQgY29udGVudE1hcmt1cCB3aGVuIHdlIHJlYWNoIGNsb3NpbmcgdGFnXG5cdFx0XHRcdGN1cnJlbnRbMTFdID0gb3BlblRhZ05hbWU7IC8vIFVzZWQgZm9yIGNoZWNraW5nIHN5bnRheCAobWF0Y2hpbmcgY2xvc2UgdGFnKVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoY2xvc2VCbG9jaykge1xuXHRcdFx0YmxvY2tUYWdDaGVjayhjbG9zZUJsb2NrICE9PSBjdXJyZW50WzBdICYmIGNsb3NlQmxvY2sgIT09IGN1cnJlbnRbMTFdICYmIGNsb3NlQmxvY2ssIGN1cnJlbnRbMF0pOyAvLyBDaGVjayBtYXRjaGluZyBjbG9zZSB0YWcgbmFtZVxuXHRcdFx0Y3VycmVudFsxMF0gPSBtYXJrdXAuc3Vic3RyaW5nKGN1cnJlbnRbMTBdLCBpbmRleCk7IC8vIGNvbnRlbnRNYXJrdXAgZm9yIGJsb2NrIHRhZ1xuXHRcdFx0Y3VycmVudCA9IHN0YWNrLnBvcCgpO1xuXHRcdH1cblx0XHRibG9ja1RhZ0NoZWNrKCFjdXJyZW50ICYmIGNsb3NlQmxvY2spO1xuXHRcdGNvbnRlbnQgPSBjdXJyZW50WzJdO1xuXHR9XG5cdC8vPT09PSAvZW5kIG9mIG5lc3RlZCBmdW5jdGlvbnMgPT09PVxuXG5cdHZhciBpLCByZXN1bHQsIG5ld05vZGUsIGhhc0hhbmRsZXJzLCBiaW5kaW5ncyxcblx0XHRhbGxvd0NvZGUgPSAkc3ViU2V0dGluZ3MuYWxsb3dDb2RlIHx8IHRtcGwgJiYgdG1wbC5hbGxvd0NvZGVcblx0XHRcdHx8ICR2aWV3c1NldHRpbmdzLmFsbG93Q29kZSA9PT0gdHJ1ZSwgLy8gaW5jbHVkZSBkaXJlY3Qgc2V0dGluZyBvZiBzZXR0aW5ncy5hbGxvd0NvZGUgdHJ1ZSBmb3IgYmFja3dhcmQgY29tcGF0IG9ubHlcblx0XHRhc3RUb3AgPSBbXSxcblx0XHRsb2MgPSAwLFxuXHRcdHN0YWNrID0gW10sXG5cdFx0Y29udGVudCA9IGFzdFRvcCxcblx0XHRjdXJyZW50ID0gWywsYXN0VG9wXTtcblxuXHRpZiAoYWxsb3dDb2RlICYmIHRtcGwuX2lzKSB7XG5cdFx0dG1wbC5hbGxvd0NvZGUgPSBhbGxvd0NvZGU7XG5cdH1cblxuLy9UT0RPXHRyZXN1bHQgPSB0bXBsRm5zQ2FjaGVbbWFya3VwXTsgLy8gT25seSBjYWNoZSBpZiB0ZW1wbGF0ZSBpcyBub3QgbmFtZWQgYW5kIG1hcmt1cCBsZW5ndGggPCAuLi4sXG4vL2FuZCB0aGVyZSBhcmUgbm8gYmluZGluZ3Mgb3Igc3VidGVtcGxhdGVzPz8gQ29uc2lkZXIgc3RhbmRhcmQgb3B0aW1pemF0aW9uIGZvciBkYXRhLWxpbms9XCJhLmIuY1wiXG4vL1x0XHRpZiAocmVzdWx0KSB7XG4vL1x0XHRcdHRtcGwuZm4gPSByZXN1bHQ7XG4vL1x0XHR9IGVsc2Uge1xuXG4vL1x0XHRyZXN1bHQgPSBtYXJrdXA7XG5cdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0aWYgKGNvbnZlcnRCYWNrICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdG1hcmt1cCA9IG1hcmt1cC5zbGljZSgwLCAtY29udmVydEJhY2subGVuZ3RoIC0gMikgKyBkZWxpbUNsb3NlQ2hhcjA7XG5cdFx0fVxuXHRcdG1hcmt1cCA9IGRlbGltT3BlbkNoYXIwICsgbWFya3VwICsgZGVsaW1DbG9zZUNoYXIxO1xuXHR9XG5cblx0YmxvY2tUYWdDaGVjayhzdGFja1swXSAmJiBzdGFja1swXVsyXS5wb3AoKVswXSk7XG5cdC8vIEJ1aWxkIHRoZSBBU1QgKGFic3RyYWN0IHN5bnRheCB0cmVlKSB1bmRlciBhc3RUb3Bcblx0bWFya3VwLnJlcGxhY2UoclRhZywgcGFyc2VUYWcpO1xuXG5cdHB1c2hwcmVjZWRpbmdDb250ZW50KG1hcmt1cC5sZW5ndGgpO1xuXG5cdGlmIChsb2MgPSBhc3RUb3BbYXN0VG9wLmxlbmd0aCAtIDFdKSB7XG5cdFx0YmxvY2tUYWdDaGVjayhcIlwiICsgbG9jICE9PSBsb2MgJiYgKCtsb2NbMTBdID09PSBsb2NbMTBdKSAmJiBsb2NbMF0pO1xuXHR9XG4vL1x0XHRcdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdID0gYnVpbGRDb2RlKGFzdFRvcCwgdG1wbCk7XG4vL1x0XHR9XG5cblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCBtYXJrdXAsIGlzTGlua0V4cHIpO1xuXHRcdGJpbmRpbmdzID0gW107XG5cdFx0aSA9IGFzdFRvcC5sZW5ndGg7XG5cdFx0d2hpbGUgKGktLSkge1xuXHRcdFx0YmluZGluZ3MudW5zaGlmdChhc3RUb3BbaV1bOV0pOyAvLyBXaXRoIGRhdGEtbGluayBleHByZXNzaW9ucywgcGF0aEJpbmRpbmdzIGFycmF5IGZvciB0YWdDdHhbaV0gaXMgYXN0VG9wW2ldWzldXG5cdFx0fVxuXHRcdHNldFBhdGhzKHJlc3VsdCwgYmluZGluZ3MpO1xuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9IGJ1aWxkQ29kZShhc3RUb3AsIHRtcGwpO1xuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHNldFBhdGhzKGZuLCBwYXRoc0Fycikge1xuXHR2YXIga2V5LCBwYXRocyxcblx0XHRpID0gMCxcblx0XHRsID0gcGF0aHNBcnIubGVuZ3RoO1xuXHRmbi5kZXBzID0gW107XG5cdGZuLnBhdGhzID0gW107IC8vIFRoZSBhcnJheSBvZiBwYXRoIGJpbmRpbmcgKGFycmF5L2RpY3Rpb25hcnkpcyBmb3IgZWFjaCB0YWcvZWxzZSBibG9jaydzIGFyZ3MgYW5kIHByb3BzXG5cdGZvciAoOyBpIDwgbDsgaSsrKSB7XG5cdFx0Zm4ucGF0aHMucHVzaChwYXRocyA9IHBhdGhzQXJyW2ldKTtcblx0XHRmb3IgKGtleSBpbiBwYXRocykge1xuXHRcdFx0aWYgKGtleSAhPT0gXCJfanN2dG9cIiAmJiBwYXRocy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHBhdGhzW2tleV0ubGVuZ3RoICYmICFwYXRoc1trZXldLnNrcCkge1xuXHRcdFx0XHRmbi5kZXBzID0gZm4uZGVwcy5jb25jYXQocGF0aHNba2V5XSk7IC8vIGRlcHMgaXMgdGhlIGNvbmNhdGVuYXRpb24gb2YgdGhlIHBhdGhzIGFycmF5cyBmb3IgdGhlIGRpZmZlcmVudCBiaW5kaW5nc1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBwYXJzZWRQYXJhbShhcmdzLCBwcm9wcywgY3R4KSB7XG5cdHJldHVybiBbYXJncy5zbGljZSgwLCAtMSksIHByb3BzLnNsaWNlKDAsIC0xKSwgY3R4LnNsaWNlKDAsIC0xKV07XG59XG5cbmZ1bmN0aW9uIHBhcmFtU3RydWN0dXJlKHBhcnRzLCB0eXBlKSB7XG5cdHJldHVybiAnXFxuXFx0J1xuXHRcdCsgKHR5cGVcblx0XHRcdD8gdHlwZSArICc6eydcblx0XHRcdDogJycpXG5cdFx0KyAnYXJnczpbJyArIHBhcnRzWzBdICsgJ10sXFxuXFx0cHJvcHM6eycgKyBwYXJ0c1sxXSArICd9J1xuXHRcdCsgKHBhcnRzWzJdID8gJyxcXG5cXHRjdHg6eycgKyBwYXJ0c1syXSArICd9JyA6IFwiXCIpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVBhcmFtcyhwYXJhbXMsIHBhdGhCaW5kaW5ncywgdG1wbCwgaXNMaW5rRXhwcikge1xuXG5cdGZ1bmN0aW9uIHBhcnNlVG9rZW5zKGFsbCwgbGZ0UHJuMCwgbGZ0UHJuLCBib3VuZCwgcGF0aCwgb3BlcmF0b3IsIGVyciwgZXEsIHBhdGgyLCBsYXRlLCBwcm4sIGNvbW1hLCBsZnRQcm4yLCBhcG9zLCBxdW90LCBydFBybiwgcnRQcm5Eb3QsIHBybjIsIHNwYWNlLCBpbmRleCwgZnVsbCkge1xuXHQvLyAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykofj9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqPyhAKT9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfChcXCg/KVxcXFw/KD86KCcpfChcIikpfCg/OlxccyooKFspXFxdXSkoPz1bLl5dfFxccyokfFteKFtdKXxbKVxcXV0pKFsoW10/KSl8KFxccyspL2csXG5cdC8vICBsZnRQcm4wICAgICAgICAgIGxmdFBybiAgICAgICAgYm91bmQgcGF0aCAgICAgICAgICAgICBvcGVyYXRvciBlcnIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxICAgICAgcGF0aDIgbGF0ZSAgICAgICAgICAgIHBybiAgICAgIGNvbW1hICBsZnRQcm4yICAgYXBvcyBxdW90ICAgICAgICBydFBybiAgcnRQcm5Eb3QgICAgICAgICAgICAgICAgICBwcm4yICAgICBzcGFjZVxuXHRcdC8vIChsZWZ0IHBhcmVuPyBmb2xsb3dlZCBieSAocGF0aD8gZm9sbG93ZWQgYnkgb3BlcmF0b3IpIG9yIChwYXRoIGZvbGxvd2VkIGJ5IHBhcmVuPykpIG9yIGNvbW1hIG9yIGFwb3Mgb3IgcXVvdCBvciByaWdodCBwYXJlbiBvciBzcGFjZVxuXHRcdGZ1bmN0aW9uIHBhcnNlUGF0aChhbGxQYXRoLCBub3QsIG9iamVjdCwgaGVscGVyLCB2aWV3LCB2aWV3UHJvcGVydHksIHBhdGhUb2tlbnMsIGxlYWZUb2tlbikge1xuXHRcdFx0Ly9yUGF0aCA9IC9eKCEqPykoPzpudWxsfHRydWV8ZmFsc2V8XFxkW1xcZC5dKnwoW1xcdyRdK3xcXC58fihbXFx3JF0rKXwjKHZpZXd8KFtcXHckXSspKT8pKFtcXHckLl5dKj8pKD86Wy5bXl0oW1xcdyRdKylcXF0/KT8pJC9nLFxuXHRcdFx0Ly8gICAgICAgICAgbm90ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdCAgICAgaGVscGVyICAgIHZpZXcgIHZpZXdQcm9wZXJ0eSBwYXRoVG9rZW5zICAgICAgbGVhZlRva2VuXG5cdFx0XHR2YXIgc3ViUGF0aCA9IG9iamVjdCA9PT0gXCIuXCI7XG5cdFx0XHRpZiAob2JqZWN0KSB7XG5cdFx0XHRcdHBhdGggPSBwYXRoLnNsaWNlKG5vdC5sZW5ndGgpO1xuXHRcdFx0XHRpZiAoL15cXC4/Y29uc3RydWN0b3IkLy50ZXN0KGxlYWZUb2tlbnx8cGF0aCkpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcihhbGxQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXN1YlBhdGgpIHtcblx0XHRcdFx0XHRhbGxQYXRoID0gKGxhdGUgLy8gbGF0ZSBwYXRoIEBhLmIuYzogbm90IHRocm93IG9uICdwcm9wZXJ0eSBvZiB1bmRlZmluZWQnIGlmIGEgdW5kZWZpbmVkLCBhbmQgd2lsbCB1c2UgX2dldE9iKCkgYWZ0ZXIgbGlua2luZyB0byByZXNvbHZlIGxhdGUuXG5cdFx0XHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAnJyA6ICcobHRPYi5sdD1sdE9iLmx0fHwnKSArICcob2I9J1xuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdCsgKGhlbHBlclxuXHRcdFx0XHRcdFx0XHQ/ICd2aWV3LmN0eFBybShcIicgKyBoZWxwZXIgKyAnXCIpJ1xuXHRcdFx0XHRcdFx0XHQ6IHZpZXdcblx0XHRcdFx0XHRcdFx0XHQ/IFwidmlld1wiXG5cdFx0XHRcdFx0XHRcdFx0OiBcImRhdGFcIilcblx0XHRcdFx0XHRcdCsgKGxhdGVcblx0XHRcdFx0XHRcdFx0PyAnKT09PXVuZGVmaW5lZCcgKyAoaXNMaW5rRXhwciA/ICcnIDogJyknKSArICc/XCJcIjp2aWV3Ll9nZXRPYihvYixcIidcblx0XHRcdFx0XHRcdFx0OiBcIlwiXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQrIChsZWFmVG9rZW5cblx0XHRcdFx0XHRcdFx0PyAodmlld1Byb3BlcnR5XG5cdFx0XHRcdFx0XHRcdFx0PyBcIi5cIiArIHZpZXdQcm9wZXJ0eVxuXHRcdFx0XHRcdFx0XHRcdDogaGVscGVyXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0XHRcdFx0XHRcdDogKHZpZXcgPyBcIlwiIDogXCIuXCIgKyBvYmplY3QpXG5cdFx0XHRcdFx0XHRcdFx0KSArIChwYXRoVG9rZW5zIHx8IFwiXCIpXG5cdFx0XHRcdFx0XHRcdDogKGxlYWZUb2tlbiA9IGhlbHBlciA/IFwiXCIgOiB2aWV3ID8gdmlld1Byb3BlcnR5IHx8IFwiXCIgOiBvYmplY3QsIFwiXCIpKTtcblx0XHRcdFx0XHRhbGxQYXRoID0gYWxsUGF0aCArIChsZWFmVG9rZW4gPyBcIi5cIiArIGxlYWZUb2tlbiA6IFwiXCIpO1xuXG5cdFx0XHRcdFx0YWxsUGF0aCA9IG5vdCArIChhbGxQYXRoLnNsaWNlKDAsIDkpID09PSBcInZpZXcuZGF0YVwiXG5cdFx0XHRcdFx0XHQ/IGFsbFBhdGguc2xpY2UoNSkgLy8gY29udmVydCAjdmlldy5kYXRhLi4uIHRvIGRhdGEuLi5cblx0XHRcdFx0XHRcdDogYWxsUGF0aClcblx0XHRcdFx0XHQrIChsYXRlXG5cdFx0XHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAnXCInOiAnXCIsbHRPYicpICsgKHBybiA/ICcsMSknOicpJylcblx0XHRcdFx0XHRcdFx0OiBcIlwiXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChiaW5kaW5ncykge1xuXHRcdFx0XHRcdGJpbmRzID0gbmFtZWQgPT09IFwiX2xpbmtUb1wiID8gKGJpbmR0byA9IHBhdGhCaW5kaW5ncy5fanN2dG8gPSBwYXRoQmluZGluZ3MuX2pzdnRvIHx8IFtdKSA6IGJuZEN0eC5iZDtcblx0XHRcdFx0XHRpZiAodGhlT2IgPSBzdWJQYXRoICYmIGJpbmRzW2JpbmRzLmxlbmd0aC0xXSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoZU9iLl9jcGZuKSB7IC8vIENvbXB1dGVkIHByb3BlcnR5IGV4cHJPYlxuXHRcdFx0XHRcdFx0XHR3aGlsZSAodGhlT2Iuc2IpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGVPYiA9IHRoZU9iLnNiO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICh0aGVPYi5ibmQpIHtcblx0XHRcdFx0XHRcdFx0XHRwYXRoID0gXCJeXCIgKyBwYXRoLnNsaWNlKDEpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHRoZU9iLnNiID0gcGF0aDtcblx0XHRcdFx0XHRcdFx0dGhlT2IuYm5kID0gdGhlT2IuYm5kIHx8IHBhdGhbMF0gPT09IFwiXlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRiaW5kcy5wdXNoKHBhdGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXRoU3RhcnRbcGFyZW5EZXB0aF0gPSBpbmRleCArIChzdWJQYXRoID8gMSA6IDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWxsUGF0aDtcblx0XHR9XG5cblx0XHQvL2JvdW5kID0gYmluZGluZ3MgJiYgYm91bmQ7XG5cdFx0aWYgKGJvdW5kICYmICFlcSkge1xuXHRcdFx0cGF0aCA9IGJvdW5kICsgcGF0aDsgLy8gZS5nLiBzb21lLmZuKC4uLilec29tZS5wYXRoIC0gc28gaGVyZSBwYXRoIGlzIFwiXnNvbWUucGF0aFwiXG5cdFx0fVxuXHRcdG9wZXJhdG9yID0gb3BlcmF0b3IgfHwgXCJcIjtcblx0XHRsZnRQcm4gPSBsZnRQcm4gfHwgbGZ0UHJuMCB8fCBsZnRQcm4yO1xuXHRcdHBhdGggPSBwYXRoIHx8IHBhdGgyO1xuXG5cdFx0aWYgKGxhdGUgJiYgKGxhdGUgPSAhL1xcKXxdLy50ZXN0KGZ1bGxbaW5kZXgtMV0pKSkge1xuXHRcdFx0cGF0aCA9IHBhdGguc2xpY2UoMSkuc3BsaXQoXCIuXCIpLmpvaW4oXCJeXCIpOyAvLyBMYXRlIHBhdGggQHouYi5jLiBVc2UgXCJeXCIgcmF0aGVyIHRoYW4gXCIuXCIgdG8gZW5zdXJlIHRoYXQgZGVlcCBiaW5kaW5nIHdpbGwgYmUgdXNlZFxuXHRcdH1cblx0XHQvLyBDb3VsZCBkbyB0aGlzIC0gYnV0IG5vdCB3b3J0aCBwZXJmIGNvc3Q/PyA6LVxuXHRcdC8vIGlmICghcGF0aC5sYXN0SW5kZXhPZihcIiNkYXRhLlwiLCAwKSkgeyBwYXRoID0gcGF0aC5zbGljZSg2KTsgfSAvLyBJZiBwYXRoIHN0YXJ0cyB3aXRoIFwiI2RhdGEuXCIsIHJlbW92ZSB0aGF0LlxuXHRcdHBybiA9IHBybiB8fCBwcm4yIHx8IFwiXCI7XG5cblx0XHR2YXIgZXhwciwgZXhwckZuLCBiaW5kcywgdGhlT2IsIG5ld09iLFxuXHRcdFx0cnRTcSA9IFwiKVwiO1xuXG5cdFx0aWYgKHBybiA9PT0gXCJbXCIpIHtcblx0XHRcdHBybiA9IFwiW2ouX3NxKFwiO1xuXHRcdFx0cnRTcSA9IFwiKV1cIjtcblx0XHR9XG5cblx0XHRpZiAoZXJyICYmICFhcG9zZWQgJiYgIXF1b3RlZCkge1xuXHRcdFx0c3ludGF4RXJyb3IocGFyYW1zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGJpbmRpbmdzICYmIHJ0UHJuRG90ICYmICFhcG9zZWQgJiYgIXF1b3RlZCkge1xuXHRcdFx0XHQvLyBUaGlzIGlzIGEgYmluZGluZyB0byBhIHBhdGggaW4gd2hpY2ggYW4gb2JqZWN0IGlzIHJldHVybmVkIGJ5IGEgaGVscGVyL2RhdGEgZnVuY3Rpb24vZXhwcmVzc2lvbiwgZS5nLiBmb28oKV54Lnkgb3IgKGE/YjpjKV54Lnlcblx0XHRcdFx0Ly8gV2UgY3JlYXRlIGEgY29tcGlsZWQgZnVuY3Rpb24gdG8gZ2V0IHRoZSBvYmplY3QgaW5zdGFuY2UgKHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIGRlcGVuZGVudCBkYXRhIG9mIHRoZSBzdWJleHByZXNzaW9uIGNoYW5nZXMsIHRvIHJldHVybiB0aGUgbmV3IG9iamVjdCwgYW5kIHRyaWdnZXIgcmUtYmluZGluZyBvZiB0aGUgc3Vic2VxdWVudCBwYXRoKVxuXHRcdFx0XHRpZiAocGFyZW5EZXB0aCAmJiAoIW5hbWVkIHx8IGJvdW5kTmFtZSB8fCBiaW5kdG8pKSB7XG5cdFx0XHRcdFx0ZXhwciA9IHBhdGhTdGFydFtwYXJlbkRlcHRoIC0gMV07XG5cdFx0XHRcdFx0aWYgKGZ1bGwubGVuZ3RoIC0gMSA+IGluZGV4IC0gKGV4cHIgfHwgMCkpIHsgLy8gV2UgbmVlZCB0byBjb21waWxlIGEgc3ViZXhwcmVzc2lvblxuXHRcdFx0XHRcdFx0ZXhwciA9IGZ1bGwuc2xpY2UoZXhwciwgaW5kZXggKyBhbGwubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGlmIChleHByRm4gIT09IHRydWUpIHsgLy8gSWYgbm90IHJlZW50cmFudCBjYWxsIGR1cmluZyBjb21waWxhdGlvblxuXHRcdFx0XHRcdFx0XHRiaW5kcyA9IGJpbmR0byB8fCBibmRTdGFja1twYXJlbkRlcHRoLTFdLmJkO1xuXHRcdFx0XHRcdFx0XHQvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdFx0XHR0aGVPYiA9IGJpbmRzW2JpbmRzLmxlbmd0aC0xXTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iICYmIHRoZU9iLnBybSkge1xuXHRcdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYiAmJiB0aGVPYi5zYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdG5ld09iID0gdGhlT2Iuc2IgPSB7cGF0aDogdGhlT2Iuc2IsIGJuZDogdGhlT2IuYm5kfTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRiaW5kcy5wdXNoKG5ld09iID0ge3BhdGg6IGJpbmRzLnBvcCgpfSk7IC8vIEluc2VydCBleHByT2Igb2JqZWN0LCB0byBiZSB1c2VkIGR1cmluZyBiaW5kaW5nIHRvIHJldHVybiB0aGUgY29tcHV0ZWQgb2JqZWN0XG5cdFx0XHRcdFx0XHRcdH1cdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC8vIChlLmcuIFwic29tZS5vYmplY3QoKVwiIGluIFwic29tZS5vYmplY3QoKS5hLmJcIiAtIHRvIGJlIHVzZWQgYXMgY29udGV4dCBmb3IgYmluZGluZyB0aGUgZm9sbG93aW5nIHRva2VucyBcImEuYlwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cnRQcm5Eb3QgPSBkZWxpbU9wZW5DaGFyMSArIFwiOlwiICsgZXhwciAvLyBUaGUgcGFyYW1ldGVyIG9yIGZ1bmN0aW9uIHN1YmV4cHJlc3Npb25cblx0XHRcdFx0XHRcdFx0KyBcIiBvbmVycm9yPScnXCIgLy8gc2V0IG9uZXJyb3I9JycgaW4gb3JkZXIgdG8gd3JhcCBnZW5lcmF0ZWQgY29kZSB3aXRoIGEgdHJ5IGNhdGNoIC0gcmV0dXJuaW5nICcnIGFzIG9iamVjdCBpbnN0YW5jZSBpZiB0aGVyZSBpcyBhbiBlcnJvci9taXNzaW5nIHBhcmVudFxuXHRcdFx0XHRcdFx0XHQrIGRlbGltQ2xvc2VDaGFyMDtcblx0XHRcdFx0XHRcdGV4cHJGbiA9IHRtcGxMaW5rc1tydFBybkRvdF07XG5cdFx0XHRcdFx0XHRpZiAoIWV4cHJGbikge1xuXHRcdFx0XHRcdFx0XHR0bXBsTGlua3NbcnRQcm5Eb3RdID0gdHJ1ZTsgLy8gRmxhZyB0aGF0IHRoaXMgZXhwckZuIChmb3IgcnRQcm5Eb3QpIGlzIGJlaW5nIGNvbXBpbGVkXG5cdFx0XHRcdFx0XHRcdHRtcGxMaW5rc1tydFBybkRvdF0gPSBleHByRm4gPSB0bXBsRm4ocnRQcm5Eb3QsIHRtcGwsIHRydWUpOyAvLyBDb21waWxlIHRoZSBleHByZXNzaW9uIChvciB1c2UgY2FjaGVkIGNvcHkgYWxyZWFkeSBpbiB0bXBsLmxpbmtzKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGV4cHJGbiAhPT0gdHJ1ZSAmJiBuZXdPYikge1xuXHRcdFx0XHRcdFx0XHQvLyBJZiBub3QgcmVlbnRyYW50IGNhbGwgZHVyaW5nIGNvbXBpbGF0aW9uXG5cdFx0XHRcdFx0XHRcdG5ld09iLl9jcGZuID0gZXhwckZuO1xuXHRcdFx0XHRcdFx0XHRuZXdPYi5wcm0gPSBibmRDdHguYmQ7XG5cdFx0XHRcdFx0XHRcdG5ld09iLmJuZCA9IG5ld09iLmJuZCB8fCBuZXdPYi5wYXRoICYmIG5ld09iLnBhdGguaW5kZXhPZihcIl5cIikgPj0gMDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAoYXBvc2VkXG5cdFx0XHRcdC8vIHdpdGhpbiBzaW5nbGUtcXVvdGVkIHN0cmluZ1xuXHRcdFx0XHQ/IChhcG9zZWQgPSAhYXBvcywgKGFwb3NlZCA/IGFsbCA6IGxmdFBybjIgKyAnXCInKSlcblx0XHRcdFx0OiBxdW90ZWRcblx0XHRcdFx0Ly8gd2l0aGluIGRvdWJsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHRcdFx0PyAocXVvdGVkID0gIXF1b3QsIChxdW90ZWQgPyBhbGwgOiBsZnRQcm4yICsgJ1wiJykpXG5cdFx0XHRcdFx0OlxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KGxmdFByblxuXHRcdFx0XHRcdFx0PyAocGF0aFN0YXJ0W3BhcmVuRGVwdGhdID0gaW5kZXgrKywgYm5kQ3R4ID0gYm5kU3RhY2tbKytwYXJlbkRlcHRoXSA9IHtiZDogW119LCBsZnRQcm4pXG5cdFx0XHRcdFx0XHQ6IFwiXCIpXG5cdFx0XHRcdFx0KyAoc3BhY2Vcblx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGhcblx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdC8vIE5ldyBhcmcgb3IgcHJvcCAtIHNvIGluc2VydCBiYWNrc3BhY2UgXFxiIChcXHgwOCkgYXMgc2VwYXJhdG9yIGZvciBuYW1lZCBwYXJhbXMsIHVzZWQgc3Vic2VxdWVudGx5IGJ5IHJCdWlsZEhhc2gsIGFuZCBwcmVwYXJlIG5ldyBiaW5kaW5ncyBhcnJheVxuXHRcdFx0XHRcdFx0XHQ6IChwYXJhbUluZGV4ID0gZnVsbC5zbGljZShwYXJhbUluZGV4LCBpbmRleCksIG5hbWVkXG5cdFx0XHRcdFx0XHRcdFx0PyAobmFtZWQgPSBib3VuZE5hbWUgPSBiaW5kdG8gPSBmYWxzZSwgXCJcXGJcIilcblx0XHRcdFx0XHRcdFx0XHQ6IFwiXFxiLFwiKSArIHBhcmFtSW5kZXggKyAocGFyYW1JbmRleCA9IGluZGV4ICsgYWxsLmxlbmd0aCwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnB1c2goYm5kQ3R4LmJkID0gW10pLCBcIlxcYlwiKVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0OiBlcVxuXHRcdFx0XHQvLyBuYW1lZCBwYXJhbS4gUmVtb3ZlIGJpbmRpbmdzIGZvciBhcmcgYW5kIGNyZWF0ZSBpbnN0ZWFkIGJpbmRpbmdzIGFycmF5IGZvciBwcm9wXG5cdFx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGggJiYgc3ludGF4RXJyb3IocGFyYW1zKSwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnBvcCgpLCBuYW1lZCA9IFwiX1wiICsgcGF0aCwgYm91bmROYW1lID0gYm91bmQsIHBhcmFtSW5kZXggPSBpbmRleCArIGFsbC5sZW5ndGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRiaW5kaW5ncyAmJiAoKGJpbmRpbmdzID0gYm5kQ3R4LmJkID0gcGF0aEJpbmRpbmdzW25hbWVkXSA9IFtdKSwgYmluZGluZ3Muc2twID0gIWJvdW5kKSwgcGF0aCArICc6Jylcblx0XHRcdFx0XHRcdFx0OiBwYXRoXG5cdFx0XHRcdC8vIHBhdGhcblx0XHRcdFx0XHRcdFx0XHQ/IChwYXRoLnNwbGl0KFwiXlwiKS5qb2luKFwiLlwiKS5yZXBsYWNlKHJQYXRoLCBwYXJzZVBhdGgpXG5cdFx0XHRcdFx0XHRcdFx0XHQrIChwcm5cblx0XHRcdFx0Ly8gc29tZS5mbmNhbGwoXG5cdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGJuZEN0eCA9IGJuZFN0YWNrWysrcGFyZW5EZXB0aF0gPSB7YmQ6IFtdfSwgZm5DYWxsW3BhcmVuRGVwdGhdID0gcnRTcSwgcHJuKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IG9wZXJhdG9yKVxuXHRcdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdFx0XHQ6IG9wZXJhdG9yXG5cdFx0XHRcdC8vIG9wZXJhdG9yXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IG9wZXJhdG9yXG5cdFx0XHRcdFx0XHRcdFx0XHQ6IHJ0UHJuXG5cdFx0XHRcdC8vIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHRcdFx0XHRcdD8gKChydFBybiA9IGZuQ2FsbFtwYXJlbkRlcHRoXSB8fCBydFBybiwgZm5DYWxsW3BhcmVuRGVwdGhdID0gZmFsc2UsIGJuZEN0eCA9IGJuZFN0YWNrWy0tcGFyZW5EZXB0aF0sIHJ0UHJuKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgKHBybiAvLyBydFBybiBhbmQgcHJuLCBlLmcgKSggaW4gKGEpKCkgb3IgYSgpKCksIG9yIClbIGluIGEoKVtdXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IChibmRDdHggPSBibmRTdGFja1srK3BhcmVuRGVwdGhdLCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBydFNxLCBwcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IFwiXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdFx0XHRcdFx0OiBjb21tYVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGZuQ2FsbFtwYXJlbkRlcHRoXSB8fCBzeW50YXhFcnJvcihwYXJhbXMpLCBcIixcIikgLy8gV2UgZG9uJ3QgYWxsb3cgdG9wLWxldmVsIGxpdGVyYWwgYXJyYXlzIG9yIG9iamVjdHNcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGxmdFBybjBcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiAoYXBvc2VkID0gYXBvcywgcXVvdGVkID0gcXVvdCwgJ1wiJylcblx0XHRcdFx0KSlcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0dmFyIG5hbWVkLCBiaW5kdG8sIGJvdW5kTmFtZSxcblx0XHRxdW90ZWQsIC8vIGJvb2xlYW4gZm9yIHN0cmluZyBjb250ZW50IGluIGRvdWJsZSBxdW90ZXNcblx0XHRhcG9zZWQsIC8vIG9yIGluIHNpbmdsZSBxdW90ZXNcblx0XHRiaW5kaW5ncyA9IHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0sIC8vIGJpbmRpbmdzIGFycmF5IGZvciB0aGUgZmlyc3QgYXJnXG5cdFx0Ym5kQ3R4ID0ge2JkOiBiaW5kaW5nc30sXG5cdFx0Ym5kU3RhY2sgPSB7MDogYm5kQ3R4fSxcblx0XHRwYXJhbUluZGV4ID0gMCwgLy8gbGlzdCxcblx0XHR0bXBsTGlua3MgPSAodG1wbCA/IHRtcGwubGlua3MgOiBiaW5kaW5ncyAmJiAoYmluZGluZ3MubGlua3MgPSBiaW5kaW5ncy5saW5rcyB8fCB7fSkpIHx8IHRvcFZpZXcudG1wbC5saW5rcyxcblx0XHQvLyBUaGUgZm9sbG93aW5nIGFyZSB1c2VkIGZvciB0cmFja2luZyBwYXRoIHBhcnNpbmcgaW5jbHVkaW5nIG5lc3RlZCBwYXRocywgc3VjaCBhcyBcImEuYihjXmQgKyAoZSkpXmZcIiwgYW5kIGNoYWluZWQgY29tcHV0ZWQgcGF0aHMgc3VjaCBhc1xuXHRcdC8vIFwiYS5iKCkuY15kKCkuZS5mKCkuZ1wiIC0gd2hpY2ggaGFzIGZvdXIgY2hhaW5lZCBwYXRocywgXCJhLmIoKVwiLCBcIl5jLmQoKVwiLCBcIi5lLmYoKVwiIGFuZCBcIi5nXCJcblx0XHRwYXJlbkRlcHRoID0gMCxcblx0XHRmbkNhbGwgPSB7fSwgLy8gV2UgYXJlIGluIGEgZnVuY3Rpb24gY2FsbFxuXHRcdHBhdGhTdGFydCA9IHt9LCAvLyB0cmFja3MgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHBhdGggc3VjaCBhcyBjXmQoKSBpbiB0aGUgYWJvdmUgZXhhbXBsZVxuXHRcdHJlc3VsdDtcblxuXHRpZiAocGFyYW1zWzBdID09PSBcIkBcIikge1xuXHRcdHBhcmFtcyA9IHBhcmFtcy5yZXBsYWNlKHJCcmFja2V0UXVvdGUsIFwiLlwiKTtcblx0fVxuXHRyZXN1bHQgPSAocGFyYW1zICsgKHRtcGwgPyBcIiBcIiA6IFwiXCIpKS5yZXBsYWNlKHJQYXJhbXMsIHBhcnNlVG9rZW5zKTtcblxuXHRyZXR1cm4gIXBhcmVuRGVwdGggJiYgcmVzdWx0IHx8IHN5bnRheEVycm9yKHBhcmFtcyk7IC8vIFN5bnRheCBlcnJvciBpZiB1bmJhbGFuY2VkIHBhcmVucyBpbiBwYXJhbXMgZXhwcmVzc2lvblxufVxuXG5mdW5jdGlvbiBidWlsZENvZGUoYXN0LCB0bXBsLCBpc0xpbmtFeHByKSB7XG5cdC8vIEJ1aWxkIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBjb2RlIGZyb20gdGhlIEFTVCBub2RlcywgYW5kIHNldCBhcyBwcm9wZXJ0eSBvbiB0aGUgcGFzc2VkLWluIHRlbXBsYXRlIG9iamVjdFxuXHQvLyBVc2VkIGZvciBjb21waWxpbmcgdGVtcGxhdGVzLCBhbmQgYWxzbyBieSBKc1ZpZXdzIHRvIGJ1aWxkIGZ1bmN0aW9ucyBmb3IgZGF0YSBsaW5rIGV4cHJlc3Npb25zXG5cdHZhciBpLCBub2RlLCB0YWdOYW1lLCBjb252ZXJ0ZXIsIHRhZ0N0eCwgaGFzVGFnLCBoYXNFbmNvZGVyLCBnZXRzVmFsLCBoYXNDbnZ0LCB1c2VDbnZ0LCB0bXBsQmluZGluZ3MsIHBhdGhCaW5kaW5ncywgcGFyYW1zLCBib3VuZE9uRXJyU3RhcnQsXG5cdFx0Ym91bmRPbkVyckVuZCwgdGFnUmVuZGVyLCBuZXN0ZWRUbXBscywgdG1wbE5hbWUsIG5lc3RlZFRtcGwsIHRhZ0FuZEVsc2VzLCBjb250ZW50LCBtYXJrdXAsIG5leHRJc0Vsc2UsIG9sZENvZGUsIGlzRWxzZSwgaXNHZXRWYWwsIHRhZ0N0eEZuLFxuXHRcdG9uRXJyb3IsIHRhZ1N0YXJ0LCB0cmlnZ2VyLCBsYXRlUmVuZGVyLCByZXRTdHJPcGVuLCByZXRTdHJDbG9zZSxcblx0XHR0bXBsQmluZGluZ0tleSA9IDAsXG5cdFx0dXNlVmlld3MgPSAkc3ViU2V0dGluZ3NBZHZhbmNlZC51c2VWaWV3cyB8fCB0bXBsLnVzZVZpZXdzIHx8IHRtcGwudGFncyB8fCB0bXBsLnRlbXBsYXRlcyB8fCB0bXBsLmhlbHBlcnMgfHwgdG1wbC5jb252ZXJ0ZXJzLFxuXHRcdGNvZGUgPSBcIlwiLFxuXHRcdHRtcGxPcHRpb25zID0ge30sXG5cdFx0bCA9IGFzdC5sZW5ndGg7XG5cblx0aWYgKFwiXCIgKyB0bXBsID09PSB0bXBsKSB7XG5cdFx0dG1wbE5hbWUgPSBpc0xpbmtFeHByID8gJ2RhdGEtbGluaz1cIicgKyB0bXBsLnJlcGxhY2Uock5ld0xpbmUsIFwiIFwiKS5zbGljZSgxLCAtMSkgKyAnXCInIDogdG1wbDtcblx0XHR0bXBsID0gMDtcblx0fSBlbHNlIHtcblx0XHR0bXBsTmFtZSA9IHRtcGwudG1wbE5hbWUgfHwgXCJ1bm5hbWVkXCI7XG5cdFx0aWYgKHRtcGwuYWxsb3dDb2RlKSB7XG5cdFx0XHR0bXBsT3B0aW9ucy5hbGxvd0NvZGUgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAodG1wbC5kZWJ1Zykge1xuXHRcdFx0dG1wbE9wdGlvbnMuZGVidWcgPSB0cnVlO1xuXHRcdH1cblx0XHR0bXBsQmluZGluZ3MgPSB0bXBsLmJuZHM7XG5cdFx0bmVzdGVkVG1wbHMgPSB0bXBsLnRtcGxzO1xuXHR9XG5cdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcblx0XHQvLyBBU1Qgbm9kZXM6IFswOiB0YWdOYW1lLCAxOiBjb252ZXJ0ZXIsIDI6IGNvbnRlbnQsIDM6IHBhcmFtcywgNDogY29kZSwgNTogb25FcnJvciwgNjogdHJpZ2dlciwgNzpwYXRoQmluZGluZ3MsIDg6IGNvbnRlbnRNYXJrdXBdXG5cdFx0bm9kZSA9IGFzdFtpXTtcblxuXHRcdC8vIEFkZCBuZXdsaW5lIGZvciBlYWNoIGNhbGxvdXQgdG8gdCgpIGMoKSBldGMuIGFuZCBlYWNoIG1hcmt1cCBzdHJpbmdcblx0XHRpZiAoXCJcIiArIG5vZGUgPT09IG5vZGUpIHtcblx0XHRcdC8vIGEgbWFya3VwIHN0cmluZyB0byBiZSBpbnNlcnRlZFxuXHRcdFx0Y29kZSArPSAnXFxuK1wiJyArIG5vZGUgKyAnXCInO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBhIGNvbXBpbGVkIHRhZyBleHByZXNzaW9uIHRvIGJlIGluc2VydGVkXG5cdFx0XHR0YWdOYW1lID0gbm9kZVswXTtcblx0XHRcdGlmICh0YWdOYW1lID09PSBcIipcIikge1xuXHRcdFx0XHQvLyBDb2RlIHRhZzoge3sqIH19XG5cdFx0XHRcdGNvZGUgKz0gXCI7XFxuXCIgKyBub2RlWzFdICsgXCJcXG5yZXQ9cmV0XCI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb252ZXJ0ZXIgPSBub2RlWzFdO1xuXHRcdFx0XHRjb250ZW50ID0gIWlzTGlua0V4cHIgJiYgbm9kZVsyXTtcblx0XHRcdFx0dGFnQ3R4ID0gcGFyYW1TdHJ1Y3R1cmUobm9kZVszXSwgJ3BhcmFtcycpICsgJ30sJyArIHBhcmFtU3RydWN0dXJlKHBhcmFtcyA9IG5vZGVbNF0pO1xuXHRcdFx0XHR0cmlnZ2VyID0gbm9kZVs2XTtcblx0XHRcdFx0bGF0ZVJlbmRlciA9IG5vZGVbN107XG5cdFx0XHRcdGlmIChub2RlWzhdKSB7IC8vIGxhdGVQYXRoIEBhLmIuYyBvciBAfmEuYi5jXG5cdFx0XHRcdFx0cmV0U3RyT3BlbiA9IFwiXFxudmFyIG9iLGx0T2I9e30sY3R4cz1cIjtcblx0XHRcdFx0XHRyZXRTdHJDbG9zZSA9IFwiO1xcbmN0eHMubHQ9bHRPYi5sdDtcXG5yZXR1cm4gY3R4cztcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXRTdHJPcGVuID0gXCJcXG5yZXR1cm4gXCI7XG5cdFx0XHRcdFx0cmV0U3RyQ2xvc2UgPSBcIlwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcmt1cCA9IG5vZGVbMTBdICYmIG5vZGVbMTBdLnJlcGxhY2UoclVuZXNjYXBlUXVvdGVzLCBcIiQxXCIpO1xuXHRcdFx0XHRpZiAoaXNFbHNlID0gdGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MucHVzaChub2RlWzldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b25FcnJvciA9IG5vZGVbNV0gfHwgJHN1YlNldHRpbmdzLmRlYnVnTW9kZSAhPT0gZmFsc2UgJiYgXCJ1bmRlZmluZWRcIjsgLy8gSWYgZGVidWdNb2RlIG5vdCBmYWxzZSwgc2V0IGRlZmF1bHQgb25FcnJvciBoYW5kbGVyIG9uIHRhZyB0byBcInVuZGVmaW5lZFwiIChzZWUgb25SZW5kZXJFcnJvcilcblx0XHRcdFx0XHRpZiAodG1wbEJpbmRpbmdzICYmIChwYXRoQmluZGluZ3MgPSBub2RlWzldKSkgeyAvLyBBcnJheSBvZiBwYXRocywgb3IgZmFsc2UgaWYgbm90IGRhdGEtYm91bmRcblx0XHRcdFx0XHRcdHBhdGhCaW5kaW5ncyA9IFtwYXRoQmluZGluZ3NdO1xuXHRcdFx0XHRcdFx0dG1wbEJpbmRpbmdLZXkgPSB0bXBsQmluZGluZ3MucHVzaCgxKTsgLy8gQWRkIHBsYWNlaG9sZGVyIGluIHRtcGxCaW5kaW5ncyBmb3IgY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dXNlVmlld3MgPSB1c2VWaWV3cyB8fCBwYXJhbXNbMV0gfHwgcGFyYW1zWzJdIHx8IHBhdGhCaW5kaW5ncyB8fCAvdmlldy4oPyFpbmRleCkvLnRlc3QocGFyYW1zWzBdKTtcblx0XHRcdFx0Ly8gdXNlVmlld3MgaXMgZm9yIHBlcmYgb3B0aW1pemF0aW9uLiBGb3IgcmVuZGVyKCkgd2Ugb25seSB1c2Ugdmlld3MgaWYgbmVjZXNzYXJ5IC0gZm9yIHRoZSBtb3JlIGFkdmFuY2VkIHNjZW5hcmlvcy5cblx0XHRcdFx0Ly8gV2UgdXNlIHZpZXdzIGlmIHRoZXJlIGFyZSBwcm9wcywgY29udGV4dHVhbCBwcm9wZXJ0aWVzIG9yIGFyZ3Mgd2l0aCAjLi4uIChvdGhlciB0aGFuICNpbmRleCkgLSBidXQgeW91IGNhbiBmb3JjZVxuXHRcdFx0XHQvLyB1c2luZyB0aGUgZnVsbCB2aWV3IGluZnJhc3RydWN0dXJlLCAoYW5kIHBheSBhIHBlcmYgcHJpY2UpIGJ5IG9wdGluZyBpbjogU2V0IHVzZVZpZXdzOiB0cnVlIG9uIHRoZSB0ZW1wbGF0ZSwgbWFudWFsbHkuLi5cblx0XHRcdFx0aWYgKGlzR2V0VmFsID0gdGFnTmFtZSA9PT0gXCI6XCIpIHtcblx0XHRcdFx0XHRpZiAoY29udmVydGVyKSB7XG5cdFx0XHRcdFx0XHR0YWdOYW1lID0gY29udmVydGVyID09PSBIVE1MID8gXCI+XCIgOiBjb252ZXJ0ZXIgKyB0YWdOYW1lO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoY29udGVudCkgeyAvLyBUT0RPIG9wdGltaXplIC0gaWYgY29udGVudC5sZW5ndGggPT09IDAgb3IgaWYgdGhlcmUgaXMgYSB0bXBsPVwiLi4uXCIgc3BlY2lmaWVkIC0gc2V0IGNvbnRlbnQgdG8gbnVsbCAvIGRvbid0IHJ1biB0aGlzIGNvbXBpbGF0aW9uIGNvZGUgLSBzaW5jZSBjb250ZW50IHdvbid0IGdldCB1c2VkISFcblx0XHRcdFx0XHRcdC8vIENyZWF0ZSB0ZW1wbGF0ZSBvYmplY3QgZm9yIG5lc3RlZCB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbCA9IHRtcGxPYmplY3QobWFya3VwLCB0bXBsT3B0aW9ucyk7XG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBsLnRtcGxOYW1lID0gdG1wbE5hbWUgKyBcIi9cIiArIHRhZ05hbWU7XG5cdFx0XHRcdFx0XHQvLyBDb21waWxlIHRvIEFTVCBhbmQgdGhlbiB0byBjb21waWxlZCBmdW5jdGlvblxuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbC51c2VWaWV3cyA9IG5lc3RlZFRtcGwudXNlVmlld3MgfHwgdXNlVmlld3M7XG5cdFx0XHRcdFx0XHRidWlsZENvZGUoY29udGVudCwgbmVzdGVkVG1wbCk7XG5cdFx0XHRcdFx0XHR1c2VWaWV3cyA9IG5lc3RlZFRtcGwudXNlVmlld3M7XG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBscy5wdXNoKG5lc3RlZFRtcGwpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghaXNFbHNlKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIG5vdCBhbiBlbHNlIHRhZy5cblx0XHRcdFx0XHRcdHRhZ0FuZEVsc2VzID0gdGFnTmFtZTtcblx0XHRcdFx0XHRcdHVzZVZpZXdzID0gdXNlVmlld3MgfHwgdGFnTmFtZSAmJiAoISR0YWdzW3RhZ05hbWVdIHx8ICEkdGFnc1t0YWdOYW1lXS5mbG93KTtcblx0XHRcdFx0XHRcdC8vIFN3aXRjaCB0byBhIG5ldyBjb2RlIHN0cmluZyBmb3IgdGhpcyBib3VuZCB0YWcgKGFuZCBpdHMgZWxzZXMsIGlmIGl0IGhhcyBhbnkpIC0gZm9yIHJldHVybmluZyB0aGUgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdFx0b2xkQ29kZSA9IGNvZGU7XG5cdFx0XHRcdFx0XHRjb2RlID0gXCJcIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV4dElzRWxzZSA9IGFzdFtpICsgMV07XG5cdFx0XHRcdFx0bmV4dElzRWxzZSA9IG5leHRJc0Vsc2UgJiYgbmV4dElzRWxzZVswXSA9PT0gXCJlbHNlXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGFnU3RhcnQgPSBvbkVycm9yID8gXCI7XFxudHJ5e1xcbnJldCs9XCIgOiBcIlxcbitcIjtcblx0XHRcdFx0Ym91bmRPbkVyclN0YXJ0ID0gXCJcIjtcblx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiXCI7XG5cblx0XHRcdFx0aWYgKGlzR2V0VmFsICYmIChwYXRoQmluZGluZ3MgfHwgdHJpZ2dlciB8fCBjb252ZXJ0ZXIgJiYgY29udmVydGVyICE9PSBIVE1MIHx8IGxhdGVSZW5kZXIpKSB7XG5cdFx0XHRcdFx0Ly8gRm9yIGNvbnZlcnRWYWwgd2UgbmVlZCBhIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgbmV3IHRhZ0N0eChzKVxuXHRcdFx0XHRcdHRhZ0N0eEZuID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGosdVwiLCBcIi8vIFwiICsgdG1wbE5hbWUgKyBcIiBcIiArICgrK3RtcGxCaW5kaW5nS2V5KSArIFwiIFwiICsgdGFnTmFtZVxuXHRcdFx0XHRcdFx0KyByZXRTdHJPcGVuICsgXCJ7XCIgKyB0YWdDdHggKyBcIn07XCIgKyByZXRTdHJDbG9zZSk7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX2VyID0gb25FcnJvcjtcblx0XHRcdFx0XHR0YWdDdHhGbi5fdGFnID0gdGFnTmFtZTtcblx0XHRcdFx0XHR0YWdDdHhGbi5fYmQgPSAhIXBhdGhCaW5kaW5nczsgLy8gZGF0YS1saW5rZWQgdGFnIHteey4uLi99fVxuXHRcdFx0XHRcdHRhZ0N0eEZuLl9sciA9IGxhdGVSZW5kZXI7XG5cblx0XHRcdFx0XHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRhZ0N0eEZuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNldFBhdGhzKHRhZ0N0eEZuLCBwYXRoQmluZGluZ3MpO1xuXHRcdFx0XHRcdHRhZ1JlbmRlciA9ICdjKFwiJyArIGNvbnZlcnRlciArICdcIix2aWV3LCc7XG5cdFx0XHRcdFx0dXNlQ252dCA9IHRydWU7XG5cdFx0XHRcdFx0Ym91bmRPbkVyclN0YXJ0ID0gdGFnUmVuZGVyICsgdG1wbEJpbmRpbmdLZXkgKyBcIixcIjtcblx0XHRcdFx0XHRib3VuZE9uRXJyRW5kID0gXCIpXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29kZSArPSAoaXNHZXRWYWxcblx0XHRcdFx0XHQ/IChpc0xpbmtFeHByID8gKG9uRXJyb3IgPyBcInRyeXtcXG5cIiA6IFwiXCIpICsgXCJyZXR1cm4gXCIgOiB0YWdTdGFydCkgKyAodXNlQ252dCAvLyBDYWxsIF9jbnZ0IGlmIHRoZXJlIGlzIGEgY29udmVydGVyOiB7e2NudnQ6IC4uLiB9fSBvciB7XntjbnZ0OiAuLi4gfX1cblx0XHRcdFx0XHRcdD8gKHVzZUNudnQgPSB1bmRlZmluZWQsIHVzZVZpZXdzID0gaGFzQ252dCA9IHRydWUsIHRhZ1JlbmRlciArICh0YWdDdHhGblxuXHRcdFx0XHRcdFx0XHQ/ICgodG1wbEJpbmRpbmdzW3RtcGxCaW5kaW5nS2V5IC0gMV0gPSB0YWdDdHhGbiksIHRtcGxCaW5kaW5nS2V5KSAvLyBTdG9yZSB0aGUgY29tcGlsZWQgdGFnQ3R4Rm4gaW4gdG1wbC5ibmRzLCBhbmQgcGFzcyB0aGUga2V5IHRvIGNvbnZlcnRWYWwoKVxuXHRcdFx0XHRcdFx0XHQ6IFwie1wiICsgdGFnQ3R4ICsgXCJ9XCIpICsgXCIpXCIpXG5cdFx0XHRcdFx0XHQ6IHRhZ05hbWUgPT09IFwiPlwiXG5cdFx0XHRcdFx0XHRcdD8gKGhhc0VuY29kZXIgPSB0cnVlLCBcImgoXCIgKyBwYXJhbXNbMF0gKyBcIilcIilcblx0XHRcdFx0XHRcdFx0OiAoZ2V0c1ZhbCA9IHRydWUsIFwiKCh2PVwiICsgcGFyYW1zWzBdICsgJykhPW51bGw/djonICsgKGlzTGlua0V4cHIgPyAnbnVsbCknIDogJ1wiXCIpJykpXG5cdFx0XHRcdFx0XHRcdC8vIE5vbiBzdHJpY3QgZXF1YWxpdHkgc28gZGF0YS1saW5rPVwidGl0bGV7OmV4cHJ9XCIgd2l0aCBleHByPW51bGwvdW5kZWZpbmVkIHJlbW92ZXMgdGl0bGUgYXR0cmlidXRlXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRcdDogKGhhc1RhZyA9IHRydWUsIFwiXFxue3ZpZXc6dmlldyxjb250ZW50OmZhbHNlLHRtcGw6XCIgLy8gQWRkIHRoaXMgdGFnQ3R4IHRvIHRoZSBjb21waWxlZCBjb2RlIGZvciB0aGUgdGFnQ3R4cyB0byBiZSBwYXNzZWQgdG8gcmVuZGVyVGFnKClcblx0XHRcdFx0XHRcdCsgKGNvbnRlbnQgPyBuZXN0ZWRUbXBscy5sZW5ndGggOiBcImZhbHNlXCIpICsgXCIsXCIgLy8gRm9yIGJsb2NrIHRhZ3MsIHBhc3MgaW4gdGhlIGtleSAobmVzdGVkVG1wbHMubGVuZ3RoKSB0byB0aGUgbmVzdGVkIGNvbnRlbnQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdCsgdGFnQ3R4ICsgXCJ9LFwiKSk7XG5cblx0XHRcdFx0aWYgKHRhZ0FuZEVsc2VzICYmICFuZXh0SXNFbHNlKSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBpcyBhIGRhdGEtbGluayBleHByZXNzaW9uIG9yIGFuIGlubGluZSB0YWcgd2l0aG91dCBhbnkgZWxzZXMsIG9yIHRoZSBsYXN0IHt7ZWxzZX19IG9mIGFuIGlubGluZSB0YWdcblx0XHRcdFx0XHQvLyBXZSBjb21wbGV0ZSB0aGUgY29kZSBmb3IgcmV0dXJuaW5nIHRoZSB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0Y29kZSA9IFwiW1wiICsgY29kZS5zbGljZSgwLCAtMSkgKyBcIl1cIjtcblx0XHRcdFx0XHR0YWdSZW5kZXIgPSAndChcIicgKyB0YWdBbmRFbHNlcyArICdcIix2aWV3LHRoaXMsJztcblx0XHRcdFx0XHRpZiAoaXNMaW5rRXhwciB8fCBwYXRoQmluZGluZ3MpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBib3VuZCB0YWcgKGRhdGEtbGluayBleHByZXNzaW9uIG9yIGlubGluZSBib3VuZCB0YWcge157dGFnIC4uLn19KSBzbyB3ZSBzdG9yZSBhIGNvbXBpbGVkIHRhZ0N0eHMgZnVuY3Rpb24gaW4gdG1wLmJuZHNcblx0XHRcdFx0XHRcdGNvZGUgPSBuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsaix1XCIsIFwiIC8vIFwiICsgdG1wbE5hbWUgKyBcIiBcIiArIHRtcGxCaW5kaW5nS2V5ICsgXCIgXCIgKyB0YWdBbmRFbHNlcyArIHJldFN0ck9wZW4gKyBjb2RlXG5cdFx0XHRcdFx0XHRcdCsgcmV0U3RyQ2xvc2UpO1xuXHRcdFx0XHRcdFx0Y29kZS5fZXIgPSBvbkVycm9yO1xuXHRcdFx0XHRcdFx0Y29kZS5fdGFnID0gdGFnQW5kRWxzZXM7XG5cdFx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdHNldFBhdGhzKHRtcGxCaW5kaW5nc1t0bXBsQmluZGluZ0tleSAtIDFdID0gY29kZSwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvZGUuX2xyID0gbGF0ZVJlbmRlcjtcblx0XHRcdFx0XHRcdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBjb2RlOyAvLyBGb3IgYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiB3ZSByZXR1cm4gdGhlIGNvbXBpbGVkIHRhZ0N0eHMgZnVuY3Rpb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsdW5kZWZpbmVkLFwiO1xuXHRcdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFRoaXMgaXMgdGhlIGxhc3Qge3tlbHNlfX0gZm9yIGFuIGlubGluZSB0YWcuXG5cdFx0XHRcdFx0Ly8gRm9yIGEgYm91bmQgdGFnLCBwYXNzIHRoZSB0YWdDdHhzIGZuIGxvb2t1cCBrZXkgdG8gcmVuZGVyVGFnLlxuXHRcdFx0XHRcdC8vIEZvciBhbiB1bmJvdW5kIHRhZywgaW5jbHVkZSB0aGUgY29kZSBkaXJlY3RseSBmb3IgZXZhbHVhdGluZyB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0Y29kZSA9IG9sZENvZGUgKyB0YWdTdGFydCArIHRhZ1JlbmRlciArIChwYXRoQmluZGluZ3MgJiYgdG1wbEJpbmRpbmdLZXkgfHwgY29kZSkgKyBcIilcIjtcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSAwO1xuXHRcdFx0XHRcdHRhZ0FuZEVsc2VzID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob25FcnJvciAmJiAhbmV4dElzRWxzZSkge1xuXHRcdFx0XHRcdHVzZVZpZXdzID0gdHJ1ZTtcblx0XHRcdFx0XHRjb2RlICs9ICc7XFxufWNhdGNoKGUpe3JldCcgKyAoaXNMaW5rRXhwciA/IFwidXJuIFwiIDogXCIrPVwiKSArIGJvdW5kT25FcnJTdGFydCArICdqLl9lcnIoZSx2aWV3LCcgKyBvbkVycm9yICsgJyknICsgYm91bmRPbkVyckVuZCArICc7fScgKyAoaXNMaW5rRXhwciA/IFwiXCIgOiAncmV0PXJldCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdC8vIEluY2x1ZGUgb25seSB0aGUgdmFyIHJlZmVyZW5jZXMgdGhhdCBhcmUgbmVlZGVkIGluIHRoZSBjb2RlXG5cdGNvZGUgPSBcIi8vIFwiICsgdG1wbE5hbWVcblx0XHQrICh0bXBsT3B0aW9ucy5kZWJ1ZyA/IFwiXFxuZGVidWdnZXI7XCIgOiBcIlwiKVxuXHRcdCsgXCJcXG52YXIgdlwiXG5cdFx0KyAoaGFzVGFnID8gXCIsdD1qLl90YWdcIiA6IFwiXCIpICAgICAgICAgICAgICAgIC8vIGhhcyB0YWdcblx0XHQrIChoYXNDbnZ0ID8gXCIsYz1qLl9jbnZ0XCIgOiBcIlwiKSAgICAgICAgICAgICAgLy8gY29udmVydGVyXG5cdFx0KyAoaGFzRW5jb2RlciA/IFwiLGg9ai5faHRtbFwiIDogXCJcIikgICAgICAgICAgIC8vIGh0bWwgY29udmVydGVyXG5cdFx0KyAoaXNMaW5rRXhwclxuXHRcdFx0XHQ/IChub2RlWzhdICAvLyBsYXRlIEAuLi4gcGF0aD9cblx0XHRcdFx0XHRcdD8gXCIsIG9iXCJcblx0XHRcdFx0XHRcdDogXCJcIlxuXHRcdFx0XHRcdCkgKyBcIjtcXG5cIlxuXHRcdFx0XHQ6ICcscmV0PVwiXCInKVxuXHRcdCsgY29kZVxuXHRcdCsgKGlzTGlua0V4cHIgPyBcIlxcblwiIDogXCI7XFxucmV0dXJuIHJldDtcIik7XG5cblx0dHJ5IHtcblx0XHRjb2RlID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGosdVwiLCBjb2RlKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHN5bnRheEVycm9yKFwiQ29tcGlsZWQgdGVtcGxhdGUgY29kZTpcXG5cXG5cIiArIGNvZGUgKyAnXFxuOiBcIicgKyAoZS5tZXNzYWdlfHxlKSArICdcIicpO1xuXHR9XG5cdGlmICh0bXBsKSB7XG5cdFx0dG1wbC5mbiA9IGNvZGU7XG5cdFx0dG1wbC51c2VWaWV3cyA9ICEhdXNlVmlld3M7XG5cdH1cblx0cmV0dXJuIGNvZGU7XG59XG5cbi8vPT09PT09PT09PVxuLy8gVXRpbGl0aWVzXG4vLz09PT09PT09PT1cblxuLy8gTWVyZ2Ugb2JqZWN0cywgaW4gcGFydGljdWxhciBjb250ZXh0cyB3aGljaCBpbmhlcml0IGZyb20gcGFyZW50IGNvbnRleHRzXG5mdW5jdGlvbiBleHRlbmRDdHgoY29udGV4dCwgcGFyZW50Q29udGV4dCkge1xuXHQvLyBSZXR1cm4gY29weSBvZiBwYXJlbnRDb250ZXh0LCB1bmxlc3MgY29udGV4dCBpcyBkZWZpbmVkIGFuZCBpcyBkaWZmZXJlbnQsIGluIHdoaWNoIGNhc2UgcmV0dXJuIGEgbmV3IG1lcmdlZCBjb250ZXh0XG5cdC8vIElmIG5laXRoZXIgY29udGV4dCBub3IgcGFyZW50Q29udGV4dCBhcmUgZGVmaW5lZCwgcmV0dXJuIHVuZGVmaW5lZFxuXHRyZXR1cm4gY29udGV4dCAmJiBjb250ZXh0ICE9PSBwYXJlbnRDb250ZXh0XG5cdFx0PyAocGFyZW50Q29udGV4dFxuXHRcdFx0PyAkZXh0ZW5kKCRleHRlbmQoe30sIHBhcmVudENvbnRleHQpLCBjb250ZXh0KVxuXHRcdFx0OiBjb250ZXh0KVxuXHRcdDogcGFyZW50Q29udGV4dCAmJiAkZXh0ZW5kKHt9LCBwYXJlbnRDb250ZXh0KTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0UHJvcHMoc291cmNlLCB0YWdDdHgpIHtcblx0Ly8gdGhpcyBwb2ludGVyIGlzIHRoZU1hcCAtIHdoaWNoIGhhcyB0YWdDdHgucHJvcHMgdG9vXG5cdC8vIGFyZ3VtZW50czogdGFnQ3R4LmFyZ3MuXG5cdHZhciBrZXksIHByb3AsXG5cdFx0cHJvcHMgPSBbXTtcblxuXHRpZiAodHlwZW9mIHNvdXJjZSA9PT0gT0JKRUNUIHx8ICRpc0Z1bmN0aW9uKHNvdXJjZSkpIHtcblx0XHRmb3IgKGtleSBpbiBzb3VyY2UpIHtcblx0XHRcdHByb3AgPSBzb3VyY2Vba2V5XTtcblx0XHRcdGlmIChrZXkgIT09ICRleHBhbmRvICYmIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICghdGFnQ3R4LnByb3BzLm5vRnVuY3Rpb25zIHx8ICEkLmlzRnVuY3Rpb24ocHJvcCkpKSB7XG5cdFx0XHRcdHByb3BzLnB1c2goe2tleToga2V5LCBwcm9wOiBwcm9wfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBnZXRUYXJnZXRTb3J0ZWQocHJvcHMsIHRhZ0N0eCk7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFNvcnRlZCh2YWx1ZSwgdGFnQ3R4KSB7XG5cdC8vIGdldFRndFxuXHR2YXIgbWFwcGVkLCBzdGFydCwgZW5kLFxuXHRcdHRhZyA9IHRhZ0N0eC50YWcsXG5cdFx0cHJvcHMgPSB0YWdDdHgucHJvcHMsXG5cdFx0cHJvcFBhcmFtcyA9IHRhZ0N0eC5wYXJhbXMucHJvcHMsXG5cdFx0ZmlsdGVyID0gcHJvcHMuZmlsdGVyLFxuXHRcdHNvcnQgPSBwcm9wcy5zb3J0LFxuXHRcdGRpcmVjdFNvcnQgPSBzb3J0ID09PSB0cnVlLFxuXHRcdHN0ZXAgPSBwYXJzZUludChwcm9wcy5zdGVwKSxcblx0XHRyZXZlcnNlID0gcHJvcHMucmV2ZXJzZSA/IC0xIDogMTtcblxuXHRpZiAoISRpc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXHRpZiAoZGlyZWN0U29ydCB8fCBzb3J0ICYmIFwiXCIgKyBzb3J0ID09PSBzb3J0KSB7XG5cdFx0Ly8gVGVtcG9yYXJ5IG1hcHBlZCBhcnJheSBob2xkcyBvYmplY3RzIHdpdGggaW5kZXggYW5kIHNvcnQtdmFsdWVcblx0XHRtYXBwZWQgPSB2YWx1ZS5tYXAoZnVuY3Rpb24oaXRlbSwgaSkge1xuXHRcdFx0aXRlbSA9IGRpcmVjdFNvcnQgPyBpdGVtIDogZ2V0UGF0aE9iamVjdChpdGVtLCBzb3J0KTtcblx0XHRcdHJldHVybiB7aTogaSwgdjogXCJcIiArIGl0ZW0gPT09IGl0ZW0gPyBpdGVtLnRvTG93ZXJDYXNlKCkgOiBpdGVtfTtcblx0XHR9KTtcblx0XHQvLyBTb3J0IG1hcHBlZCBhcnJheVxuXHRcdG1hcHBlZC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcblx0XHRcdHJldHVybiBhLnYgPiBiLnYgPyByZXZlcnNlIDogYS52IDwgYi52ID8gLXJldmVyc2UgOiAwO1xuXHRcdH0pO1xuXHRcdC8vIE1hcCB0byBuZXcgYXJyYXkgd2l0aCByZXN1bHRpbmcgb3JkZXJcblx0XHR2YWx1ZSA9IG1hcHBlZC5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRyZXR1cm4gdmFsdWVbaXRlbS5pXTtcblx0XHR9KTtcblx0fSBlbHNlIGlmICgoc29ydCB8fCByZXZlcnNlIDwgMCkgJiYgIXRhZy5kYXRhTWFwKSB7XG5cdFx0dmFsdWUgPSB2YWx1ZS5zbGljZSgpOyAvLyBDbG9uZSBhcnJheSBmaXJzdCBpZiBub3QgYWxyZWFkeSBhIG5ldyBhcnJheVxuXHR9XG5cdGlmICgkaXNGdW5jdGlvbihzb3J0KSkge1xuXHRcdHZhbHVlID0gdmFsdWUuc29ydChzb3J0KTtcblx0fVxuXHRpZiAocmV2ZXJzZSA8IDAgJiYgIXNvcnQpIHsgLy8gUmV2ZXJzZSByZXN1bHQgaWYgbm90IGFscmVhZHkgcmV2ZXJzZWQgaW4gc29ydFxuXHRcdHZhbHVlID0gdmFsdWUucmV2ZXJzZSgpO1xuXHR9XG5cblx0aWYgKHZhbHVlLmZpbHRlciAmJiBmaWx0ZXIpIHsgLy8gSUU4IGRvZXMgbm90IHN1cHBvcnQgZmlsdGVyXG5cdFx0dmFsdWUgPSB2YWx1ZS5maWx0ZXIoZmlsdGVyLCB0YWdDdHgpO1xuXHRcdGlmICh0YWdDdHgudGFnLm9uRmlsdGVyKSB7XG5cdFx0XHR0YWdDdHgudGFnLm9uRmlsdGVyKHRhZ0N0eCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHByb3BQYXJhbXMuc29ydGVkKSB7XG5cdFx0bWFwcGVkID0gKHNvcnQgfHwgcmV2ZXJzZSA8IDApID8gdmFsdWUgOiB2YWx1ZS5zbGljZSgpO1xuXHRcdGlmICh0YWcuc29ydGVkKSB7XG5cdFx0XHQkLm9ic2VydmFibGUodGFnLnNvcnRlZCkucmVmcmVzaChtYXBwZWQpOyAvLyBOb3RlIHRoYXQgdGhpcyBtaWdodCBjYXVzZSB0aGUgc3RhcnQgYW5kIGVuZCBwcm9wcyB0byBiZSBtb2RpZmllZCAtIGUuZy4gYnkgcGFnZXIgdGFnIGNvbnRyb2xcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFnQ3R4Lm1hcC5zb3J0ZWQgPSBtYXBwZWQ7XG5cdFx0fVxuXHR9XG5cblx0c3RhcnQgPSBwcm9wcy5zdGFydDsgLy8gR2V0IGN1cnJlbnQgdmFsdWUgLSBhZnRlciBwb3NzaWJsZSAgY2hhbmdlcyB0cmlnZ2VyZWQgYnkgdGFnLnNvcnRlZCByZWZyZXNoKCkgYWJvdmVcblx0ZW5kID0gcHJvcHMuZW5kO1xuXHRpZiAocHJvcFBhcmFtcy5zdGFydCAmJiBzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHByb3BQYXJhbXMuZW5kICYmIGVuZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0c3RhcnQgPSBlbmQgPSAwO1xuXHR9XG5cdGlmICghaXNOYU4oc3RhcnQpIHx8ICFpc05hTihlbmQpKSB7IC8vIHN0YXJ0IG9yIGVuZCBzcGVjaWZpZWQsIGJ1dCBub3QgdGhlIGF1dG8tY3JlYXRlIE51bWJlciBhcnJheSBzY2VuYXJpbyBvZiB7e2ZvciBzdGFydD14eHggZW5kPXl5eX19XG5cdFx0c3RhcnQgPSArc3RhcnQgfHwgMDtcblx0XHRlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB2YWx1ZS5sZW5ndGggPyB2YWx1ZS5sZW5ndGggOiArZW5kO1xuLy9cdFx0ZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB2YWx1ZS5sZW5ndGggOiArZW5kO1xuXHRcdHZhbHVlID0gdmFsdWUuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdH1cblx0aWYgKHN0ZXAgPiAxKSB7XG5cdFx0c3RhcnQgPSAwO1xuXHRcdGVuZCA9IHZhbHVlLmxlbmd0aDtcblx0XHRtYXBwZWQgPSBbXTtcblx0XHRmb3IgKDsgc3RhcnQ8ZW5kOyBzdGFydCs9c3RlcCkge1xuXHRcdFx0bWFwcGVkLnB1c2godmFsdWVbc3RhcnRdKTtcblx0XHR9XG5cdFx0dmFsdWUgPSBtYXBwZWQ7XG5cdH1cblx0aWYgKHByb3BQYXJhbXMucGFnZWQgJiYgdGFnLnBhZ2VkKSB7XG5cdFx0JG9ic2VydmFibGUodGFnLnBhZ2VkKS5yZWZyZXNoKHZhbHVlKTtcblx0fVxuXG5cdHJldHVybiB2YWx1ZTtcbn1cblxuLyoqIFJlbmRlciB0aGUgdGVtcGxhdGUgYXMgYSBzdHJpbmcsIHVzaW5nIHRoZSBzcGVjaWZpZWQgZGF0YSBhbmQgaGVscGVycy9jb250ZXh0XG4qICQoXCIjdG1wbFwiKS5yZW5kZXIoKVxuKlxuKiBAcGFyYW0ge2FueX0gICAgICAgIGRhdGFcbiogQHBhcmFtIHtoYXNofSAgICAgICBbaGVscGVyc09yQ29udGV4dF1cbiogQHBhcmFtIHtib29sZWFufSAgICBbbm9JdGVyYXRpb25dXG4qIEByZXR1cm5zIHtzdHJpbmd9ICAgcmVuZGVyZWQgdGVtcGxhdGVcbiovXG5mdW5jdGlvbiAkZm5SZW5kZXIoZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24pIHtcblx0dmFyIHRtcGxFbGVtID0gdGhpcy5qcXVlcnkgJiYgKHRoaXNbMF0gfHwgZXJyb3IoJ1Vua25vd24gdGVtcGxhdGUnKSksIC8vIFRhcmdldGVkIGVsZW1lbnQgbm90IGZvdW5kIGZvciBqUXVlcnkgdGVtcGxhdGUgc2VsZWN0b3Igc3VjaCBhcyBcIiNteVRtcGxcIlxuXHRcdHRtcGwgPSB0bXBsRWxlbS5nZXRBdHRyaWJ1dGUodG1wbEF0dHIpO1xuXG5cdHJldHVybiByZW5kZXJDb250ZW50LmNhbGwodG1wbCAmJiAkLmRhdGEodG1wbEVsZW0pW2pzdlRtcGxdIHx8ICR0ZW1wbGF0ZXModG1wbEVsZW0pLFxuXHRcdGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uKTtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBSZWdpc3RlciBjb252ZXJ0ZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldENoYXJFbnRpdHkoY2gpIHtcblx0Ly8gR2V0IGNoYXJhY3RlciBlbnRpdHkgZm9yIEhUTUwsIEF0dHJpYnV0ZSBhbmQgb3B0aW9uYWwgZGF0YSBlbmNvZGluZ1xuXHRyZXR1cm4gY2hhckVudGl0aWVzW2NoXSB8fCAoY2hhckVudGl0aWVzW2NoXSA9IFwiJiNcIiArIGNoLmNoYXJDb2RlQXQoMCkgKyBcIjtcIik7XG59XG5cbmZ1bmN0aW9uIGdldENoYXJGcm9tRW50aXR5KG1hdGNoLCB0b2tlbikge1xuXHQvLyBHZXQgY2hhcmFjdGVyIGZyb20gSFRNTCBlbnRpdHksIGZvciBvcHRpb25hbCBkYXRhIHVuZW5jb2Rpbmdcblx0cmV0dXJuIGNoYXJzRnJvbUVudGl0aWVzW3Rva2VuXSB8fCBcIlwiO1xufVxuXG5mdW5jdGlvbiBodG1sRW5jb2RlKHRleHQpIHtcblx0Ly8gSFRNTCBlbmNvZGU6IFJlcGxhY2UgPCA+ICYgJyBcIiBgIGV0Yy4gYnkgY29ycmVzcG9uZGluZyBlbnRpdGllcy5cblx0cmV0dXJuIHRleHQgIT0gdW5kZWZpbmVkID8gcklzSHRtbC50ZXN0KHRleHQpICYmIChcIlwiICsgdGV4dCkucmVwbGFjZShySHRtbEVuY29kZSwgZ2V0Q2hhckVudGl0eSkgfHwgdGV4dCA6IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGRhdGFFbmNvZGUodGV4dCkge1xuXHQvLyBFbmNvZGUganVzdCA8ID4gYW5kICYgLSBpbnRlbmRlZCBmb3IgJ3NhZmUgZGF0YScgYWxvbmcgd2l0aCB7ezp9fSByYXRoZXIgdGhhbiB7ez59fVxuICByZXR1cm4gXCJcIiArIHRleHQgPT09IHRleHQgPyB0ZXh0LnJlcGxhY2UockRhdGFFbmNvZGUsIGdldENoYXJFbnRpdHkpIDogdGV4dDtcbn1cblxuZnVuY3Rpb24gZGF0YVVuZW5jb2RlKHRleHQpIHtcbiAgLy8gVW5lbmNvZGUganVzdCA8ID4gYW5kICYgLSBpbnRlbmRlZCBmb3IgJ3NhZmUgZGF0YScgYWxvbmcgd2l0aCB7ezp9fSByYXRoZXIgdGhhbiB7ez59fVxuICByZXR1cm4gXCJcIiArIHRleHQgPT09IHRleHQgPyB0ZXh0LnJlcGxhY2UockRhdGFVbmVuY29kZSwgZ2V0Q2hhckZyb21FbnRpdHkpIDogdGV4dDtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBJbml0aWFsaXplID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiRzdWIgPSAkdmlld3Muc3ViO1xuJHZpZXdzU2V0dGluZ3MgPSAkdmlld3Muc2V0dGluZ3M7XG5cbmlmICghKGpzciB8fCAkICYmICQucmVuZGVyKSkge1xuXHQvLyBKc1JlbmRlciBub3QgYWxyZWFkeSBsb2FkZWQsIG9yIGxvYWRlZCB3aXRob3V0IGpRdWVyeSwgYW5kIHdlIGFyZSBub3cgbW92aW5nIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lcGFjZVxuXHRmb3IgKGpzdlN0b3JlTmFtZSBpbiBqc3ZTdG9yZXMpIHtcblx0XHRyZWdpc3RlclN0b3JlKGpzdlN0b3JlTmFtZSwganN2U3RvcmVzW2pzdlN0b3JlTmFtZV0pO1xuXHR9XG5cblx0JGNvbnZlcnRlcnMgPSAkdmlld3MuY29udmVydGVycztcblx0JGhlbHBlcnMgPSAkdmlld3MuaGVscGVycztcblx0JHRhZ3MgPSAkdmlld3MudGFncztcblxuXHQkc3ViLl90Zy5wcm90b3R5cGUgPSB7XG5cdFx0YmFzZUFwcGx5OiBiYXNlQXBwbHksXG5cdFx0Y3Z0QXJnczogY29udmVydEFyZ3MsXG5cdFx0Ym5kQXJnczogY29udmVydEJvdW5kQXJncyxcblx0XHRjdHhQcm06IGNvbnRleHRQYXJhbWV0ZXJcblx0fTtcblxuXHR0b3BWaWV3ID0gJHN1Yi50b3BWaWV3ID0gbmV3IFZpZXcoKTtcblxuXHQvL0JST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRpZiAoJCkge1xuXG5cdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cdFx0Ly8galF1ZXJ5ICg9ICQpIGlzIGxvYWRlZFxuXG5cdFx0JC5mbi5yZW5kZXIgPSAkZm5SZW5kZXI7XG5cdFx0JGV4cGFuZG8gPSAkLmV4cGFuZG87XG5cdFx0aWYgKCQub2JzZXJ2YWJsZSkge1xuXHRcdFx0aWYgKHZlcnNpb25OdW1iZXIgIT09ICh2ZXJzaW9uTnVtYmVyID0gJC52aWV3cy5qc3ZpZXdzKSkge1xuXHRcdFx0XHQvLyBEaWZmZXJlbnQgdmVyc2lvbiBvZiBqc1JlbmRlciB3YXMgbG9hZGVkXG5cdFx0XHRcdHRocm93IFwiSnNPYnNlcnZhYmxlIHJlcXVpcmVzIEpzUmVuZGVyIFwiICsgdmVyc2lvbk51bWJlcjtcblx0XHRcdH1cblx0XHRcdCRleHRlbmQoJHN1YiwgJC52aWV3cy5zdWIpOyAvLyBqcXVlcnkub2JzZXJ2YWJsZS5qcyB3YXMgbG9hZGVkIGJlZm9yZSBqc3JlbmRlci5qc1xuXHRcdFx0JHZpZXdzLm1hcCA9ICQudmlld3MubWFwO1xuXHRcdH1cblxuXHR9IGVsc2Uge1xuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSBpcyBub3QgbG9hZGVkLlxuXG5cdFx0JCA9IHt9O1xuXG5cdFx0aWYgKHNldEdsb2JhbHMpIHtcblx0XHRcdGdsb2JhbC5qc3JlbmRlciA9ICQ7IC8vIFdlIGFyZSBsb2FkaW5nIGpzcmVuZGVyLmpzIGZyb20gYSBzY3JpcHQgZWxlbWVudCwgbm90IEFNRCBvciBDb21tb25KUywgc28gc2V0IGdsb2JhbFxuXHRcdH1cblxuXHRcdC8vIEVycm9yIHdhcm5pbmcgaWYganNyZW5kZXIuanMgaXMgdXNlZCBhcyB0ZW1wbGF0ZSBlbmdpbmUgb24gTm9kZS5qcyAoZS5nLiBFeHByZXNzIG9yIEhhcGkuLi4pXG5cdFx0Ly8gVXNlIGpzcmVuZGVyLW5vZGUuanMgaW5zdGVhZC4uLlxuXHRcdCQucmVuZGVyRmlsZSA9ICQuX19leHByZXNzID0gJC5jb21waWxlID0gZnVuY3Rpb24oKSB7IHRocm93IFwiTm9kZS5qczogdXNlIG5wbSBqc3JlbmRlciwgb3IganNyZW5kZXItbm9kZS5qc1wiOyB9O1xuXG5cdFx0Ly9FTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0JC5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2IpIHtcblx0XHRcdHJldHVybiB0eXBlb2Ygb2IgPT09IFwiZnVuY3Rpb25cIjtcblx0XHR9O1xuXG5cdFx0JC5pc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcblx0XHRcdHJldHVybiAoe30udG9TdHJpbmcpLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuXHRcdH07XG5cblx0XHQkc3ViLl9qcSA9IGZ1bmN0aW9uKGpxKSB7IC8vIHByaXZhdGUgbWV0aG9kIHRvIG1vdmUgZnJvbSBKc1JlbmRlciBBUElzIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdGlmIChqcSAhPT0gJCkge1xuXHRcdFx0XHQkZXh0ZW5kKGpxLCAkKTsgLy8gbWFwIG92ZXIgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVzcGFjZVxuXHRcdFx0XHQkID0ganE7XG5cdFx0XHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdFx0XHRkZWxldGUgJC5qc3JlbmRlcjtcblx0XHRcdFx0JGV4cGFuZG8gPSAkLmV4cGFuZG87XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdCQuanNyZW5kZXIgPSB2ZXJzaW9uTnVtYmVyO1xuXHR9XG5cdCRzdWJTZXR0aW5ncyA9ICRzdWIuc2V0dGluZ3M7XG5cdCRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgPSBmYWxzZTtcblx0JGlzRnVuY3Rpb24gPSAkLmlzRnVuY3Rpb247XG5cdCQucmVuZGVyID0gJHJlbmRlcjtcblx0JC52aWV3cyA9ICR2aWV3cztcblx0JC50ZW1wbGF0ZXMgPSAkdGVtcGxhdGVzID0gJHZpZXdzLnRlbXBsYXRlcztcblxuXHRmb3IgKHNldHRpbmcgaW4gJHN1YlNldHRpbmdzKSB7XG5cdFx0YWRkU2V0dGluZyhzZXR0aW5nKTtcblx0fVxuXG5cdC8qKlxuXHQqICQudmlld3Muc2V0dGluZ3MuZGVidWdNb2RlKHRydWUpXG5cdCogQHBhcmFtIHtib29sZWFufSAgZGVidWdNb2RlXG5cdCogQHJldHVybnMge1NldHRpbmdzfVxuXHQqXG5cdCogZGVidWdNb2RlID0gJC52aWV3cy5zZXR0aW5ncy5kZWJ1Z01vZGUoKVxuXHQqIEByZXR1cm5zIHtib29sZWFufVxuXHQqL1xuXHQoJHZpZXdzU2V0dGluZ3MuZGVidWdNb2RlID0gZnVuY3Rpb24oZGVidWdNb2RlKSB7XG5cdFx0cmV0dXJuIGRlYnVnTW9kZSA9PT0gdW5kZWZpbmVkXG5cdFx0XHQ/ICRzdWJTZXR0aW5ncy5kZWJ1Z01vZGVcblx0XHRcdDogKFxuXHRcdFx0XHQkc3ViU2V0dGluZ3MuZGVidWdNb2RlID0gZGVidWdNb2RlLFxuXHRcdFx0XHQkc3ViU2V0dGluZ3Mub25FcnJvciA9IGRlYnVnTW9kZSArIFwiXCIgPT09IGRlYnVnTW9kZVxuXHRcdFx0XHRcdD8gZnVuY3Rpb24oKSB7IHJldHVybiBkZWJ1Z01vZGU7IH1cblx0XHRcdFx0XHQ6ICRpc0Z1bmN0aW9uKGRlYnVnTW9kZSlcblx0XHRcdFx0XHRcdD8gZGVidWdNb2RlXG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0JHZpZXdzU2V0dGluZ3MpO1xuXHR9KShmYWxzZSk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuXG5cdCRzdWJTZXR0aW5nc0FkdmFuY2VkID0gJHN1YlNldHRpbmdzLmFkdmFuY2VkID0ge1xuXHRcdHVzZVZpZXdzOiBmYWxzZSxcblx0XHRfanN2OiBmYWxzZSAvLyBGb3IgZ2xvYmFsIGFjY2VzcyB0byBKc1ZpZXdzIHN0b3JlXG5cdH07XG5cblx0Ly89PT09PT09PT09PT09PT09PT09PT09PT09PSBSZWdpc3RlciB0YWdzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblx0JHRhZ3Moe1xuXHRcdFwiaWZcIjoge1xuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0Ly8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3Ige3tpZn19IGFuZCBvbmNlIGZvciBlYWNoIHt7ZWxzZX19LlxuXHRcdFx0XHQvLyBXZSB3aWxsIHVzZSB0aGUgdGFnLnJlbmRlcmluZyBvYmplY3QgZm9yIGNhcnJ5aW5nIHJlbmRlcmluZyBzdGF0ZSBhY3Jvc3MgdGhlIGNhbGxzLlxuXHRcdFx0XHQvLyBJZiBub3QgZG9uZSAoYSBwcmV2aW91cyBibG9jayBoYXMgbm90IGJlZW4gcmVuZGVyZWQpLCBsb29rIGF0IGV4cHJlc3Npb24gZm9yIHRoaXMgYmxvY2sgYW5kIHJlbmRlciB0aGUgYmxvY2sgaWYgZXhwcmVzc2lvbiBpcyB0cnV0aHlcblx0XHRcdFx0Ly8gT3RoZXJ3aXNlIHJldHVybiBcIlwiXG5cdFx0XHRcdHZhciBzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyZXQgPSAoc2VsZi5yZW5kZXJpbmcuZG9uZSB8fCAhdmFsICYmICh0YWdDdHguYXJncy5sZW5ndGggfHwgIXRhZ0N0eC5pbmRleCkpXG5cdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0XHRcdDogKHNlbGYucmVuZGVyaW5nLmRvbmUgPSB0cnVlLFxuXHRcdFx0XHRcdFx0XHRzZWxmLnNlbGVjdGVkID0gdGFnQ3R4LmluZGV4LFxuXHRcdFx0XHRcdFx0XHR1bmRlZmluZWQpOyAvLyBUZXN0IGlzIHNhdGlzZmllZCwgc28gcmVuZGVyIGNvbnRlbnQgb24gY3VycmVudCBjb250ZXh0XG5cdFx0XHRcdHJldHVybiByZXQ7XG5cdFx0XHR9LFxuXHRcdFx0Y29udGVudEN0eDogdHJ1ZSwgLy8gSW5oZXJpdCBwYXJlbnQgdmlldyBkYXRhIGNvbnRleHRcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiZm9yXCI6IHtcblx0XHRcdHNvcnREYXRhTWFwOiBkYXRhTWFwKGdldFRhcmdldFNvcnRlZCksXG5cdFx0XHRpbml0OiBmdW5jdGlvbih2YWwsIGNsb25lZCkge1xuXHRcdFx0XHR2YXIgbCwgdGFnQ3R4LCBwcm9wcywgc29ydCxcblx0XHRcdFx0XHRzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHhzID0gc2VsZi50YWdDdHhzO1xuXHRcdFx0XHRsID0gdGFnQ3R4cy5sZW5ndGg7XG5cdFx0XHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdFx0XHR0YWdDdHggPSB0YWdDdHhzW2xdO1xuXHRcdFx0XHRcdHByb3BzID0gdGFnQ3R4LnByb3BzO1xuXHRcdFx0XHRcdHRhZ0N0eC5hcmdEZWZhdWx0ID0gcHJvcHMuZW5kID09PSB1bmRlZmluZWQgfHwgdGFnQ3R4LmFyZ3MubGVuZ3RoID4gMDsgLy8gRGVmYXVsdCB0byAjZGF0YSBleGNlcHQgZm9yIGF1dG8tY3JlYXRlIHJhbmdlIHNjZW5hcmlvIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5IHN0ZXA9enp6fX1cblxuXHRcdFx0XHRcdGlmICh0YWdDdHguYXJnRGVmYXVsdCAhPT0gZmFsc2UgJiYgJGlzQXJyYXkodGFnQ3R4LmFyZ3NbMF0pXG5cdFx0XHRcdFx0XHQmJiAocHJvcHMuc29ydCAhPT0gdW5kZWZpbmVkIHx8IHRhZ0N0eC5wYXJhbXMucHJvcHMuc3RhcnQgfHwgdGFnQ3R4LnBhcmFtcy5wcm9wcy5lbmQgfHwgcHJvcHMuc3RlcCAhPT0gdW5kZWZpbmVkIHx8IHByb3BzLmZpbHRlciB8fCBwcm9wcy5yZXZlcnNlKSkge1xuXHRcdFx0XHRcdFx0cHJvcHMuZGF0YU1hcCA9IHNlbGYuc29ydERhdGFNYXA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0Ly8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3Ige3tmb3J9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0dmFyIHZhbHVlLCBmaWx0ZXIsIHNydEZpZWxkLCBpc0FycmF5LCBpLCBzb3J0ZWQsIGVuZCwgc3RlcCxcblx0XHRcdFx0XHRzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyYW5nZSA9IHRhZ0N0eC5hcmdEZWZhdWx0ID09PSBmYWxzZSxcblx0XHRcdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcyxcblx0XHRcdFx0XHRpdGVyYXRlID0gIHJhbmdlIHx8IHRhZ0N0eC5hcmdzLmxlbmd0aCwgLy8gTm90IGZpbmFsIGVsc2UgYW5kIG5vdCBhdXRvLWNyZWF0ZSByYW5nZVxuXHRcdFx0XHRcdHJlc3VsdCA9IFwiXCIsXG5cdFx0XHRcdFx0ZG9uZSA9IDA7XG5cblx0XHRcdFx0aWYgKCFzZWxmLnJlbmRlcmluZy5kb25lKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBpdGVyYXRlID8gdmFsIDogdGFnQ3R4LnZpZXcuZGF0YTsgLy8gRm9yIHRoZSBmaW5hbCBlbHNlLCBkZWZhdWx0cyB0byBjdXJyZW50IGRhdGEgd2l0aG91dCBpdGVyYXRpb24uXG5cblx0XHRcdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0XHRcdHJhbmdlID0gcHJvcHMucmV2ZXJzZSA/IFwidW5zaGlmdFwiIDogXCJwdXNoXCI7XG5cdFx0XHRcdFx0XHRlbmQgPSArcHJvcHMuZW5kO1xuXHRcdFx0XHRcdFx0c3RlcCA9ICtwcm9wcy5zdGVwIHx8IDE7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IFtdOyAvLyBhdXRvLWNyZWF0ZSBpbnRlZ2VyIGFycmF5IHNjZW5hcmlvIG9mIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5fX1cblx0XHRcdFx0XHRcdGZvciAoaSA9ICtwcm9wcy5zdGFydCB8fCAwOyAoZW5kIC0gaSkgKiBzdGVwID4gMDsgaSArPSBzdGVwKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlW3JhbmdlXShpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGlzQXJyYXkgPSAkaXNBcnJheSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gdGFnQ3R4LnJlbmRlcih2YWx1ZSwgIWl0ZXJhdGUgfHwgcHJvcHMubm9JdGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0Ly8gSXRlcmF0ZXMgaWYgZGF0YSBpcyBhbiBhcnJheSwgZXhjZXB0IG9uIGZpbmFsIGVsc2UgLSBvciBpZiBub0l0ZXJhdGlvbiBwcm9wZXJ0eVxuXHRcdFx0XHRcdFx0Ly8gc2V0IHRvIHRydWUuIChVc2Uge3tpbmNsdWRlfX0gdG8gY29tcG9zZSB0ZW1wbGF0ZXMgd2l0aG91dCBhcnJheSBpdGVyYXRpb24pXG5cdFx0XHRcdFx0XHRkb25lICs9IGlzQXJyYXkgPyB2YWx1ZS5sZW5ndGggOiAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc2VsZi5yZW5kZXJpbmcuZG9uZSA9IGRvbmUpIHtcblx0XHRcdFx0XHRcdHNlbGYuc2VsZWN0ZWQgPSB0YWdDdHguaW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIElmIG5vdGhpbmcgd2FzIHJlbmRlcmVkIHdlIHdpbGwgbG9vayBhdCB0aGUgbmV4dCB7e2Vsc2V9fS4gT3RoZXJ3aXNlLCB3ZSBhcmUgZG9uZS5cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdHByb3BzOiB7XG5cdFx0XHRiYXNlVGFnOiBcImZvclwiLFxuXHRcdFx0ZGF0YU1hcDogZGF0YU1hcChnZXRUYXJnZXRQcm9wcyksXG5cdFx0XHRpbml0OiBub29wLCAvLyBEb24ndCBleGVjdXRlIHRoZSBiYXNlIGluaXQoKSBvZiB0aGUgXCJmb3JcIiB0YWdcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdGluY2x1ZGU6IHtcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiKlwiOiB7XG5cdFx0XHQvLyB7eyogY29kZS4uLiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0XCI6KlwiOiB7XG5cdFx0XHQvLyB7ezoqIHJldHVybmVkRXhwcmVzc2lvbiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0ZGJnOiAkaGVscGVycy5kYmcgPSAkY29udmVydGVycy5kYmcgPSBkYmdCcmVhayAvLyBSZWdpc3RlciB7e2RiZy99fSwge3tkYmc6Li4ufX0gYW5kIH5kYmcoKSB0byB0aHJvdyBhbmQgY2F0Y2gsIGFzIGJyZWFrcG9pbnRzIGZvciBkZWJ1Z2dpbmcuXG5cdH0pO1xuXG5cdCRjb252ZXJ0ZXJzKHtcblx0XHRodG1sOiBodG1sRW5jb2RlLFxuXHRcdGF0dHI6IGh0bWxFbmNvZGUsIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0XHRlbmNvZGU6IGRhdGFFbmNvZGUsXG5cdFx0dW5lbmNvZGU6IGRhdGFVbmVuY29kZSwgLy8gSW5jbHVkZXMgPiBlbmNvZGluZyBzaW5jZSByQ29udmVydE1hcmtlcnMgaW4gSnNWaWV3cyBkb2VzIG5vdCBza2lwID4gY2hhcmFjdGVycyBpbiBhdHRyaWJ1dGUgc3RyaW5nc1xuXHRcdHVybDogZnVuY3Rpb24odGV4dCkge1xuXHRcdFx0Ly8gVVJMIGVuY29kaW5nIGhlbHBlci5cblx0XHRcdHJldHVybiB0ZXh0ICE9IHVuZGVmaW5lZCA/IGVuY29kZVVSSShcIlwiICsgdGV4dCkgOiB0ZXh0ID09PSBudWxsID8gdGV4dCA6IFwiXCI7IC8vIG51bGwgcmV0dXJucyBudWxsLCBlLmcuIHRvIHJlbW92ZSBhdHRyaWJ1dGUuIHVuZGVmaW5lZCByZXR1cm5zIFwiXCJcblx0XHR9XG5cdH0pO1xufVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBEZWZpbmUgZGVmYXVsdCBkZWxpbWl0ZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG4kc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuJGlzQXJyYXkgPSAoJHx8anNyKS5pc0FycmF5O1xuJHZpZXdzU2V0dGluZ3MuZGVsaW1pdGVycyhcInt7XCIsIFwifX1cIiwgXCJeXCIpO1xuXG5pZiAoanNyVG9KcSkgeyAvLyBNb3ZpbmcgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVwYWNlIC0gY29weSBvdmVyIHRoZSBzdG9yZWQgaXRlbXMgKHRlbXBsYXRlcywgY29udmVydGVycywgaGVscGVycy4uLilcblx0anNyLnZpZXdzLnN1Yi5fanEoJCk7XG59XG5yZXR1cm4gJCB8fCBqc3I7XG59LCB3aW5kb3cpKTtcbiIsIi8qZ2xvYmFsIFFVbml0LCB0ZXN0LCBlcXVhbCwgb2sqL1xuKGZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbmJyb3dzZXJpZnkuZG9uZS50d2VsdmUgPSB0cnVlO1xuXG5RVW5pdC5tb2R1bGUoXCJCcm93c2VyaWZ5IC0gY2xpZW50IGNvZGVcIik7XG5cbnZhciBpc0lFOCA9IHdpbmRvdy5hdHRhY2hFdmVudCAmJiAhd2luZG93LmFkZEV2ZW50TGlzdGVuZXI7XG5cbmlmICghaXNJRTgpIHtcblxudGVzdChcIk5vIGpRdWVyeSBnbG9iYWw6IHJlcXVpcmUoJ2pzcmVuZGVyJykoKSBuZXN0ZWQgdGVtcGxhdGVcIiwgZnVuY3Rpb24oKSB7XG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gSGlkZSBRVW5pdCBnbG9iYWwgalF1ZXJ5IGFuZCBhbnkgcHJldmlvdXMgZ2xvYmFsIGpzcmVuZGVyLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdHZhciBqUXVlcnkgPSBnbG9iYWwualF1ZXJ5LCBqc3IgPSBnbG9iYWwuanNyZW5kZXI7XG5cdGdsb2JhbC5qUXVlcnkgPSBnbG9iYWwuanNyZW5kZXIgPSB1bmRlZmluZWQ7XG5cblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBBcnJhbmdlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0dmFyIGRhdGEgPSB7bmFtZTogXCJKb1wifTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBY3QgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHR2YXIganNyZW5kZXIgPSByZXF1aXJlKCcuLi8uLi8nKSgpOyAvLyBOb3QgcGFzc2luZyBpbiBqUXVlcnksIHNvIHJldHVybnMgdGhlIGpzcmVuZGVyIG5hbWVzcGFjZVxuXG5cdC8vIFVzZSByZXF1aXJlIHRvIGdldCBzZXJ2ZXIgdGVtcGxhdGUsIHRoYW5rcyB0byBCcm93c2VyaWZ5IGJ1bmRsZSB0aGF0IHVzZWQganNyZW5kZXIvdG1wbGlmeSB0cmFuc2Zvcm1cblx0dmFyIHRtcGwgPSByZXF1aXJlKCcuLi90ZW1wbGF0ZXMvb3V0ZXIuaHRtbCcpKGpzcmVuZGVyKTsgLy8gUHJvdmlkZSBqc3JlbmRlclxuXG5cdHZhciByZXN1bHQgPSB0bXBsKGRhdGEpO1xuXG5cdHJlc3VsdCArPSBcIiBcIiArIChqc3JlbmRlciAhPT0galF1ZXJ5KTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uIEFzc2VydCAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblx0ZXF1YWwocmVzdWx0LCBcIk5hbWU6IEpvIChvdXRlci5odG1sKSBOYW1lOiBKbyAoaW5uZXIuaHRtbCkgdHJ1ZVwiLCBcInJlc3VsdDogTm8galF1ZXJ5IGdsb2JhbDogcmVxdWlyZSgnanNyZW5kZXInKSgpLCBuZXN0ZWQgdGVtcGxhdGVzXCIpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gUmVzZXQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGdsb2JhbC5qUXVlcnkgPSBqUXVlcnk7IC8vIFJlcGxhY2UgUVVuaXQgZ2xvYmFsIGpRdWVyeVxuXHRnbG9iYWwuanNyZW5kZXIgPSBqc3I7IC8vIFJlcGxhY2UgYW55IHByZXZpb3VzIGdsb2JhbCBqc3JlbmRlclxufSk7XG59XG59KSgpO1xuIiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChpbm5lci5odG1sKScsXG4gICQgPSBnbG9iYWwuanNyZW5kZXIgfHwgZ2xvYmFsLmpRdWVyeTtcblxubW9kdWxlLmV4cG9ydHMgPSAkID8gJC50ZW1wbGF0ZXMoXCIuL3Rlc3QvdGVtcGxhdGVzL2lubmVyLmh0bWxcIiwgbWt1cCkgOlxuICBmdW5jdGlvbigkKSB7XG4gICAgaWYgKCEkIHx8ICEkLnZpZXdzKSB7dGhyb3cgXCJSZXF1aXJlcyBqc3JlbmRlci9qUXVlcnlcIjt9XG4gICAgd2hpbGUgKHRtcGxSZWZzLmxlbmd0aCkge1xuICAgICAgdG1wbFJlZnMucG9wKCkoJCk7IC8vIGNvbXBpbGUgbmVzdGVkIHRlbXBsYXRlXG4gICAgfVxuXG4gICAgcmV0dXJuICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9pbm5lci5odG1sXCIsIG1rdXApXG4gIH07IiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChvdXRlci5odG1sKSB7e2luY2x1ZGUgdG1wbD1cXFwiLi90ZXN0L3RlbXBsYXRlcy9pbm5lci5odG1sXFxcIi99fScsXG4gICQgPSBnbG9iYWwuanNyZW5kZXIgfHwgZ2xvYmFsLmpRdWVyeTtcblxudG1wbFJlZnMucHVzaChyZXF1aXJlKFwiLi9pbm5lci5odG1sXCIpKTtcbm1vZHVsZS5leHBvcnRzID0gJCA/ICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9vdXRlci5odG1sXCIsIG1rdXApIDpcbiAgZnVuY3Rpb24oJCkge1xuICAgIGlmICghJCB8fCAhJC52aWV3cykge3Rocm93IFwiUmVxdWlyZXMganNyZW5kZXIvalF1ZXJ5XCI7fVxuICAgIHdoaWxlICh0bXBsUmVmcy5sZW5ndGgpIHtcbiAgICAgIHRtcGxSZWZzLnBvcCgpKCQpOyAvLyBjb21waWxlIG5lc3RlZCB0ZW1wbGF0ZVxuICAgIH1cblxuICAgIHJldHVybiAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvb3V0ZXIuaHRtbFwiLCBta3VwKVxuICB9OyJdfQ==
