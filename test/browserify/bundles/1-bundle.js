(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v1.0.13: http://jsviews.com/#jsrender */
/*! **VERSION FOR WEB** (For NODE.JS see http://jsviews.com/download/jsrender-node.js) */
/*
 * Best-of-breed templating in browser or on Node.js.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://jsviews.com/#jsviews)
 *
 * Copyright 2021, Boris Moore
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

var versionNumber = "v1.0.13",
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
					? storeView // Is a tag, not a view, or is a computed contextual parameter, so scope to the callView, no the 'scope view'
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

browserify.done.one = true;

QUnit.module("Browserify - client code");

var isIE8 = window.attachEvent && !window.addEventListener;

if (!isIE8) {

test("No jQuery global: require('jsrender')()", function() {
	// ............................... Hide QUnit global jQuery and any previous global jsrender.................................
	var jQuery = global.jQuery, jsr = global.jsrender;
	global.jQuery = global.jsrender = undefined;

	// =============================== Arrange ===============================
	var data = {name: "Jo"};

	// ................................ Act ..................................
	var jsrender = require('../../')(); // Not passing in jQuery, so returns the jsrender namespace

	// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
	var tmpl = require('../templates/name-template.html')(jsrender); // Provide jsrender

	var result = tmpl(data);

	result += " " + (jsrender !== jQuery);

	// ............................... Assert .................................
	equal(result, "Name: Jo (name-template.html) true", "result: No jQuery global: require('jsrender')()");

	// ............................... Reset .................................
	global.jQuery = jQuery; // Replace QUnit global jQuery
	global.jsrender = jsr; // Replace any previous global jsrender
});
}
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../":1,"../templates/name-template.html":3}],3:[function(require,module,exports){
(function (global){
var tmplRefs = [],
  mkup = 'Name: {{:name}} (name-template.html)',
  $ = global.jsrender || global.jQuery;

module.exports = $ ? $.templates("./test/templates/name-template.html", mkup) :
  function($) {
    if (!$ || !$.views) {throw "Requires jsrender/jQuery";}
    while (tmplRefs.length) {
      tmplRefs.pop()($); // compile nested template
    }

    return $.templates("./test/templates/name-template.html", mkup)
  };
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xLXVuaXQtdGVzdHMuanMiLCJ0ZXN0L3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDNzhGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIEpzUmVuZGVyIHYxLjAuMTM6IGh0dHA6Ly9qc3ZpZXdzLmNvbS8janNyZW5kZXIgKi9cbi8qISAqKlZFUlNJT04gRk9SIFdFQioqIChGb3IgTk9ERS5KUyBzZWUgaHR0cDovL2pzdmlld3MuY29tL2Rvd25sb2FkL2pzcmVuZGVyLW5vZGUuanMpICovXG4vKlxuICogQmVzdC1vZi1icmVlZCB0ZW1wbGF0aW5nIGluIGJyb3dzZXIgb3Igb24gTm9kZS5qcy5cbiAqIERvZXMgbm90IHJlcXVpcmUgalF1ZXJ5LCBvciBIVE1MIERPTVxuICogSW50ZWdyYXRlcyB3aXRoIEpzVmlld3MgKGh0dHA6Ly9qc3ZpZXdzLmNvbS8janN2aWV3cylcbiAqXG4gKiBDb3B5cmlnaHQgMjAyMSwgQm9yaXMgTW9vcmVcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuXG4vL2pzaGludCAtVzAxOCwgLVcwNDEsIC1XMTIwXG5cbihmdW5jdGlvbihmYWN0b3J5LCBnbG9iYWwpIHtcblx0Ly8gZ2xvYmFsIHZhciBpcyB0aGUgdGhpcyBvYmplY3QsIHdoaWNoIGlzIHdpbmRvdyB3aGVuIHJ1bm5pbmcgaW4gdGhlIHVzdWFsIGJyb3dzZXIgZW52aXJvbm1lbnRcblx0dmFyICQgPSBnbG9iYWwualF1ZXJ5O1xuXG5cdGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikgeyAvLyBDb21tb25KUyBlLmcuIEJyb3dzZXJpZnlcblx0XHRtb2R1bGUuZXhwb3J0cyA9ICRcblx0XHRcdD8gZmFjdG9yeShnbG9iYWwsICQpXG5cdFx0XHQ6IGZ1bmN0aW9uKCQpIHsgLy8gSWYgbm8gZ2xvYmFsIGpRdWVyeSwgdGFrZSBvcHRpb25hbCBqUXVlcnkgcGFzc2VkIGFzIHBhcmFtZXRlcjogcmVxdWlyZSgnanNyZW5kZXInKShqUXVlcnkpXG5cdFx0XHRcdGlmICgkICYmICEkLmZuKSB7XG5cdFx0XHRcdFx0dGhyb3cgXCJQcm92aWRlIGpRdWVyeSBvciBudWxsXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsLCAkKTtcblx0XHRcdH07XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHsgLy8gQU1EIHNjcmlwdCBsb2FkZXIsIGUuZy4gUmVxdWlyZUpTXG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsKTtcblx0XHR9KTtcblx0fSBlbHNlIHsgLy8gQnJvd3NlciB1c2luZyBwbGFpbiA8c2NyaXB0PiB0YWdcblx0XHRmYWN0b3J5KGdsb2JhbCwgZmFsc2UpO1xuXHR9XG59IChcblxuLy8gZmFjdG9yeSAoZm9yIGpzcmVuZGVyLmpzKVxuZnVuY3Rpb24oZ2xvYmFsLCAkKSB7XG5cInVzZSBzdHJpY3RcIjtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBUb3AtbGV2ZWwgdmFycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxudmFyIHNldEdsb2JhbHMgPSAkID09PSBmYWxzZTsgLy8gT25seSBzZXQgZ2xvYmFscyBpZiBzY3JpcHQgYmxvY2sgaW4gYnJvd3NlciAobm90IEFNRCBhbmQgbm90IENvbW1vbkpTKVxuXG4kID0gJCAmJiAkLmZuID8gJCA6IGdsb2JhbC5qUXVlcnk7IC8vICQgaXMgalF1ZXJ5IHBhc3NlZCBpbiBieSBDb21tb25KUyBsb2FkZXIgKEJyb3dzZXJpZnkpLCBvciBnbG9iYWwgalF1ZXJ5LlxuXG52YXIgdmVyc2lvbk51bWJlciA9IFwidjEuMC4xM1wiLFxuXHRqc3ZTdG9yZU5hbWUsIHJUYWcsIHJUbXBsU3RyaW5nLCB0b3BWaWV3LCAkdmlld3MsICRleHBhbmRvLFxuXHRfb2NwID0gXCJfb2NwXCIsICAgICAgLy8gT2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXG5cdCRpc0Z1bmN0aW9uLCAkaXNBcnJheSwgJHRlbXBsYXRlcywgJGNvbnZlcnRlcnMsICRoZWxwZXJzLCAkdGFncywgJHN1YiwgJHN1YlNldHRpbmdzLCAkc3ViU2V0dGluZ3NBZHZhbmNlZCwgJHZpZXdzU2V0dGluZ3MsXG5cdGRlbGltT3BlbkNoYXIwLCBkZWxpbU9wZW5DaGFyMSwgZGVsaW1DbG9zZUNoYXIwLCBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyLCBzZXR0aW5nLCBiYXNlT25FcnJvcixcblxuXHRpc1JlbmRlckNhbGwsXG5cdHJOZXdMaW5lID0gL1sgXFx0XSooXFxyXFxufFxcbnxcXHIpL2csXG5cdHJVbmVzY2FwZVF1b3RlcyA9IC9cXFxcKFsnXCJcXFxcXSkvZywgLy8gVW5lc2NhcGUgcXVvdGVzIGFuZCB0cmltXG5cdHJFc2NhcGVRdW90ZXMgPSAvWydcIlxcXFxdL2csIC8vIEVzY2FwZSBxdW90ZXMgYW5kIFxcIGNoYXJhY3RlclxuXHRyQnVpbGRIYXNoID0gLyg/OlxceDA4fF4pKG9uZXJyb3I6KT8oPzoofj8pKChbXFx3JC5dKyk6KT8oW15cXHgwOF0rKSlcXHgwOCgsKT8oW15cXHgwOF0rKS9naSxcblx0clRlc3RFbHNlSWYgPSAvXmlmXFxzLyxcblx0ckZpcnN0RWxlbSA9IC88KFxcdyspWz5cXHNdLyxcblx0ckF0dHJFbmNvZGUgPSAvW1xceDAwYD48XCInJj1dL2csIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0cklzSHRtbCA9IC9bXFx4MDBgPjxcXFwiJyY9XS8sXG5cdHJIYXNIYW5kbGVycyA9IC9eb25bQS1aXXxeY29udmVydChCYWNrKT8kLyxcblx0cldyYXBwZWRJblZpZXdNYXJrZXIgPSAvXlxcI1xcZCtfYFtcXHNcXFNdKlxcL1xcZCtfYCQvLFxuXHRySHRtbEVuY29kZSA9IHJBdHRyRW5jb2RlLFxuXHRyRGF0YUVuY29kZSA9IC9bJjw+XS9nLFxuXHRyRGF0YVVuZW5jb2RlID0gLyYoYW1wfGd0fGx0KTsvZyxcblx0ckJyYWNrZXRRdW90ZSA9IC9cXFtbJ1wiXT98WydcIl0/XFxdL2csXG5cdHZpZXdJZCA9IDAsXG5cdGNoYXJFbnRpdGllcyA9IHtcblx0XHRcIiZcIjogXCImYW1wO1wiLFxuXHRcdFwiPFwiOiBcIiZsdDtcIixcblx0XHRcIj5cIjogXCImZ3Q7XCIsXG5cdFx0XCJcXHgwMFwiOiBcIiYjMDtcIixcblx0XHRcIidcIjogXCImIzM5O1wiLFxuXHRcdCdcIic6IFwiJiMzNDtcIixcblx0XHRcImBcIjogXCImIzk2O1wiLFxuXHRcdFwiPVwiOiBcIiYjNjE7XCJcblx0fSxcblx0Y2hhcnNGcm9tRW50aXRpZXMgPSB7XG5cdFx0YW1wOiBcIiZcIixcblx0XHRndDogXCI+XCIsXG5cdFx0bHQ6IFwiPFwiXG5cdH0sXG5cdEhUTUwgPSBcImh0bWxcIixcblx0U1RSSU5HID0gXCJzdHJpbmdcIixcblx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0dG1wbEF0dHIgPSBcImRhdGEtanN2LXRtcGxcIixcblx0anN2VG1wbCA9IFwianN2VG1wbFwiLFxuXHRpbmRleFN0ciA9IFwiRm9yICNpbmRleCBpbiBuZXN0ZWQgYmxvY2sgdXNlICNnZXRJbmRleCgpLlwiLFxuXHRjcEZuU3RvcmUgPSB7fSwgICAgIC8vIENvbXBpbGVkIGZ1cm5jdGlvbnMgZm9yIGNvbXB1dGVkIHZhbHVlcyBpbiB0ZW1wbGF0ZSBleHByZXNzaW9ucyAocHJvcGVydGllcywgbWV0aG9kcywgaGVscGVycylcblx0JHJlbmRlciA9IHt9LFxuXG5cdGpzciA9IGdsb2JhbC5qc3JlbmRlcixcblx0anNyVG9KcSA9IGpzciAmJiAkICYmICEkLnJlbmRlciwgLy8gSnNSZW5kZXIgYWxyZWFkeSBsb2FkZWQsIHdpdGhvdXQgalF1ZXJ5LiBidXQgd2Ugd2lsbCByZS1sb2FkIGl0IG5vdyB0byBhdHRhY2ggdG8galF1ZXJ5XG5cblx0anN2U3RvcmVzID0ge1xuXHRcdHRlbXBsYXRlOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVG1wbFxuXHRcdH0sXG5cdFx0dGFnOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVGFnXG5cdFx0fSxcblx0XHR2aWV3TW9kZWw6IHtcblx0XHRcdGNvbXBpbGU6IGNvbXBpbGVWaWV3TW9kZWxcblx0XHR9LFxuXHRcdGhlbHBlcjoge30sXG5cdFx0Y29udmVydGVyOiB7fVxuXHR9O1xuXG5cdC8vIHZpZXdzIG9iamVjdCAoJC52aWV3cyBpZiBqUXVlcnkgaXMgbG9hZGVkLCBqc3JlbmRlci52aWV3cyBpZiBubyBqUXVlcnksIGUuZy4gaW4gTm9kZS5qcylcblx0JHZpZXdzID0ge1xuXHRcdGpzdmlld3M6IHZlcnNpb25OdW1iZXIsXG5cdFx0c3ViOiB7XG5cdFx0XHQvLyBzdWJzY3JpcHRpb24sIGUuZy4gSnNWaWV3cyBpbnRlZ3JhdGlvblxuXHRcdFx0clBhdGg6IC9eKCEqPykoPzpudWxsfHRydWV8ZmFsc2V8XFxkW1xcZC5dKnwoW1xcdyRdK3xcXC58fihbXFx3JF0rKXwjKHZpZXd8KFtcXHckXSspKT8pKFtcXHckLl5dKj8pKD86Wy5bXl0oW1xcdyRdKylcXF0/KT8pJC9nLFxuXHRcdFx0Ly8gICAgICAgIG5vdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgICAgIGhlbHBlciAgICB2aWV3ICB2aWV3UHJvcGVydHkgcGF0aFRva2VucyAgICAgIGxlYWZUb2tlblxuXG5cdFx0XHRyUHJtOiAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykofj9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18fig/IVtcXHckXSl8JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqPyhAKT9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfCg/OihcXCgpXFxzKik/XFxcXD8oPzooJyl8KFwiKSl8KD86XFxzKigoWylcXF1dKSg/PVsuXl18XFxzKiR8W14oW10pfFspXFxdXSkoWyhbXT8pKXwoXFxzKykvZyxcblx0XHRcdC8vICAgbGZ0UHJuMCAgICAgICAgICAgbGZ0UHJuICAgICAgICAgYm91bmQgICAgIHBhdGggICAgICAgICAgICAgICBvcGVyYXRvciAgICAgZXJyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXEgICAgICBwYXRoMiBsYXRlICAgICAgICAgICAgcHJuICAgICAgY29tbWEgIGxmdFBybjIgICAgICAgICAgYXBvcyBxdW90ICAgICAgICBydFBybiAgcnRQcm5Eb3QgICAgICAgICAgICAgICAgICBwcm4yICAgICBzcGFjZVxuXG5cdFx0XHRWaWV3OiBWaWV3LFxuXHRcdFx0RXJyOiBKc1ZpZXdzRXJyb3IsXG5cdFx0XHR0bXBsRm46IHRtcGxGbixcblx0XHRcdHBhcnNlOiBwYXJzZVBhcmFtcyxcblx0XHRcdGV4dGVuZDogJGV4dGVuZCxcblx0XHRcdGV4dGVuZEN0eDogZXh0ZW5kQ3R4LFxuXHRcdFx0c3ludGF4RXJyOiBzeW50YXhFcnJvcixcblx0XHRcdG9uU3RvcmU6IHtcblx0XHRcdFx0dGVtcGxhdGU6IGZ1bmN0aW9uKG5hbWUsIGl0ZW0pIHtcblx0XHRcdFx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlICRyZW5kZXJbbmFtZV07XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChuYW1lKSB7XG5cdFx0XHRcdFx0XHQkcmVuZGVyW25hbWVdID0gaXRlbTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRTZXR0aW5nOiBhZGRTZXR0aW5nLFxuXHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0YWxsb3dDb2RlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdGFkdlNldDogbm9vcCwgLy8gVXBkYXRlIGFkdmFuY2VkIHNldHRpbmdzXG5cdFx0XHRfdGhwOiB0YWdIYW5kbGVyc0Zyb21Qcm9wcyxcblx0XHRcdF9nbTogZ2V0TWV0aG9kLFxuXHRcdFx0X3RnOiBmdW5jdGlvbigpIHt9LCAvLyBDb25zdHJ1Y3RvciBmb3IgdGFnRGVmXG5cdFx0XHRfY252dDogY29udmVydFZhbCxcblx0XHRcdF90YWc6IHJlbmRlclRhZyxcblx0XHRcdF9lcjogZXJyb3IsXG5cdFx0XHRfZXJyOiBvblJlbmRlckVycm9yLFxuXHRcdFx0X2NwOiByZXRWYWwsIC8vIEdldCBvYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVycyAob3IgcHJvcGVydGllcykgfmZvbz1leHByLiBJbiBKc1JlbmRlciwgc2ltcGx5IHJldHVybnMgdmFsLlxuXHRcdFx0X3NxOiBmdW5jdGlvbih0b2tlbikge1xuXHRcdFx0XHRpZiAodG9rZW4gPT09IFwiY29uc3RydWN0b3JcIikge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKFwiXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0b2tlbjtcblx0XHRcdH1cblx0XHR9LFxuXHRcdHNldHRpbmdzOiB7XG5cdFx0XHRkZWxpbWl0ZXJzOiAkdmlld3NEZWxpbWl0ZXJzLFxuXHRcdFx0YWR2YW5jZWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0XHRcdD8gKFxuXHRcdFx0XHRcdFx0XHQkZXh0ZW5kKCRzdWJTZXR0aW5nc0FkdmFuY2VkLCB2YWx1ZSksXG5cdFx0XHRcdFx0XHRcdCRzdWIuYWR2U2V0KCksXG5cdFx0XHRcdFx0XHRcdCR2aWV3c1NldHRpbmdzXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQ6ICRzdWJTZXR0aW5nc0FkdmFuY2VkO1xuXHRcdFx0XHR9XG5cdFx0fSxcblx0XHRtYXA6IGRhdGFNYXAgLy8gSWYganNPYnNlcnZhYmxlIGxvYWRlZCBmaXJzdCwgdXNlIHRoYXQgZGVmaW5pdGlvbiBvZiBkYXRhTWFwXG5cdH07XG5cbmZ1bmN0aW9uIGdldERlcml2ZWRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcmV0LFxuXHRcdFx0dGFnID0gdGhpcyxcblx0XHRcdHByZXZCYXNlID0gdGFnLmJhc2U7XG5cblx0XHR0YWcuYmFzZSA9IGJhc2VNZXRob2Q7IC8vIFdpdGhpbiBtZXRob2QgY2FsbCwgY2FsbGluZyB0aGlzLmJhc2Ugd2lsbCBjYWxsIHRoZSBiYXNlIG1ldGhvZFxuXHRcdHJldCA9IG1ldGhvZC5hcHBseSh0YWcsIGFyZ3VtZW50cyk7IC8vIENhbGwgdGhlIG1ldGhvZFxuXHRcdHRhZy5iYXNlID0gcHJldkJhc2U7IC8vIFJlcGxhY2UgdGhpcy5iYXNlIHRvIGJlIHRoZSBiYXNlIG1ldGhvZCBvZiB0aGUgcHJldmlvdXMgY2FsbCwgZm9yIGNoYWluZWQgY2FsbHNcblx0XHRyZXR1cm4gcmV0O1xuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdC8vIEZvciBkZXJpdmVkIG1ldGhvZHMgKG9yIGhhbmRsZXJzIGRlY2xhcmVkIGRlY2xhcmF0aXZlbHkgYXMgaW4ge3s6Zm9vIG9uQ2hhbmdlPX5mb29DaGFuZ2VkfX0gcmVwbGFjZSBieSBhIGRlcml2ZWQgbWV0aG9kLCB0byBhbGxvdyB1c2luZyB0aGlzLmJhc2UoLi4uKVxuXHQvLyBvciB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIHRvIGNhbGwgdGhlIGJhc2UgaW1wbGVtZW50YXRpb24uIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyKC4uLikgYW5kIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdGlmICgkaXNGdW5jdGlvbihtZXRob2QpKSB7XG5cdFx0bWV0aG9kID0gZ2V0RGVyaXZlZE1ldGhvZChcblx0XHRcdFx0IWJhc2VNZXRob2Rcblx0XHRcdFx0XHQ/IG5vb3AgLy8gbm8gYmFzZSBtZXRob2QgaW1wbGVtZW50YXRpb24sIHNvIHVzZSBub29wIGFzIGJhc2UgbWV0aG9kXG5cdFx0XHRcdFx0OiBiYXNlTWV0aG9kLl9kXG5cdFx0XHRcdFx0XHQ/IGJhc2VNZXRob2QgLy8gYmFzZU1ldGhvZCBpcyBhIGRlcml2ZWQgbWV0aG9kLCBzbyB1c2UgaXRcblx0XHRcdFx0XHRcdDogZ2V0RGVyaXZlZE1ldGhvZChub29wLCBiYXNlTWV0aG9kKSwgLy8gYmFzZU1ldGhvZCBpcyBub3QgZGVyaXZlZCBzbyBtYWtlIGl0cyBiYXNlIG1ldGhvZCBiZSB0aGUgbm9vcCBtZXRob2Rcblx0XHRcdFx0bWV0aG9kXG5cdFx0XHQpO1xuXHRcdG1ldGhvZC5fZCA9IChiYXNlTWV0aG9kICYmIGJhc2VNZXRob2QuX2QgfHwgMCkgKyAxOyAvLyBBZGQgZmxhZyBmb3IgZGVyaXZlZCBtZXRob2QgKGluY3JlbWVudGVkIGZvciBkZXJpdmVkIG9mIGRlcml2ZWQuLi4pXG5cdH1cblx0cmV0dXJuIG1ldGhvZDtcbn1cblxuZnVuY3Rpb24gdGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpIHtcblx0dmFyIHByb3AsXG5cdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdGZvciAocHJvcCBpbiBwcm9wcykge1xuXHRcdGlmIChySGFzSGFuZGxlcnMudGVzdChwcm9wKSAmJiAhKHRhZ1twcm9wXSAmJiB0YWdbcHJvcF0uZml4KSkgeyAvLyBEb24ndCBvdmVycmlkZSBoYW5kbGVycyB3aXRoIGZpeCBleHBhbmRvICh1c2VkIGluIGRhdGVwaWNrZXIgYW5kIHNwaW5uZXIpXG5cdFx0XHR0YWdbcHJvcF0gPSBwcm9wICE9PSBcImNvbnZlcnRcIiA/IGdldE1ldGhvZCh0YWcuY29uc3RydWN0b3IucHJvdG90eXBlW3Byb3BdLCBwcm9wc1twcm9wXSkgOiBwcm9wc1twcm9wXTtcblx0XHRcdC8vIENvcHkgb3ZlciB0aGUgb25Gb28gcHJvcHMsIGNvbnZlcnQgYW5kIGNvbnZlcnRCYWNrIGZyb20gdGFnQ3R4LnByb3BzIHRvIHRhZyAob3ZlcnJpZGVzIHZhbHVlcyBpbiB0YWdEZWYpLlxuXHRcdFx0Ly8gTm90ZTogdW5zdXBwb3J0ZWQgc2NlbmFyaW86IGlmIGhhbmRsZXJzIGFyZSBkeW5hbWljYWxseSBhZGRlZCBeb25Gb289ZXhwcmVzc2lvbiB0aGlzIHdpbGwgd29yaywgYnV0IGR5bmFtaWNhbGx5IHJlbW92aW5nIHdpbGwgbm90IHdvcmsuXG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHJldFZhbCh2YWwpIHtcblx0cmV0dXJuIHZhbDtcbn1cblxuZnVuY3Rpb24gbm9vcCgpIHtcblx0cmV0dXJuIFwiXCI7XG59XG5cbmZ1bmN0aW9uIGRiZ0JyZWFrKHZhbCkge1xuXHQvLyBVc2FnZSBleGFtcGxlczoge3tkYmc6Li4ufX0sIHt7On5kYmcoLi4uKX19LCB7e2RiZyAuLi4vfX0sIHtee2ZvciAuLi4gb25BZnRlckxpbms9fmRiZ319IGV0Yy5cblx0dHJ5IHtcblx0XHRjb25zb2xlLmxvZyhcIkpzUmVuZGVyIGRiZyBicmVha3BvaW50OiBcIiArIHZhbCk7XG5cdFx0dGhyb3cgXCJkYmcgYnJlYWtwb2ludFwiOyAvLyBUbyBicmVhayBoZXJlLCBzdG9wIG9uIGNhdWdodCBleGNlcHRpb25zLlxuXHR9XG5cdGNhdGNoIChlKSB7fVxuXHRyZXR1cm4gdGhpcy5iYXNlID8gdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSA6IHZhbDtcbn1cblxuZnVuY3Rpb24gSnNWaWV3c0Vycm9yKG1lc3NhZ2UpIHtcblx0Ly8gRXJyb3IgZXhjZXB0aW9uIHR5cGUgZm9yIEpzVmlld3MvSnNSZW5kZXJcblx0Ly8gT3ZlcnJpZGUgb2YgJC52aWV3cy5zdWIuRXJyb3IgaXMgcG9zc2libGVcblx0dGhpcy5uYW1lID0gKCQubGluayA/IFwiSnNWaWV3c1wiIDogXCJKc1JlbmRlclwiKSArIFwiIEVycm9yXCI7XG5cdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgdGhpcy5uYW1lO1xufVxuXG5mdW5jdGlvbiAkZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG5cdGlmICh0YXJnZXQpIHtcblx0XHRmb3IgKHZhciBuYW1lIGluIHNvdXJjZSkge1xuXHRcdFx0dGFyZ2V0W25hbWVdID0gc291cmNlW25hbWVdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG59XG5cbihKc1ZpZXdzRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yKCkpLmNvbnN0cnVjdG9yID0gSnNWaWV3c0Vycm9yO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCBmdW5jdGlvbnMgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy89PT09PT09PT09PT09PT09PT09XG4vLyB2aWV3cy5kZWxpbWl0ZXJzXG4vLz09PT09PT09PT09PT09PT09PT1cblxuXHQvKipcblx0KiBTZXQgdGhlIHRhZyBvcGVuaW5nIGFuZCBjbG9zaW5nIGRlbGltaXRlcnMgYW5kICdsaW5rJyBjaGFyYWN0ZXIuIERlZmF1bHQgaXMgXCJ7e1wiLCBcIn19XCIgYW5kIFwiXlwiXG5cdCogb3BlbkNoYXJzLCBjbG9zZUNoYXJzOiBvcGVuaW5nIGFuZCBjbG9zaW5nIHN0cmluZ3MsIGVhY2ggd2l0aCB0d28gY2hhcmFjdGVyc1xuXHQqICQudmlld3Muc2V0dGluZ3MuZGVsaW1pdGVycyguLi4pXG5cdCpcblx0KiBAcGFyYW0ge3N0cmluZ30gICBvcGVuQ2hhcnNcblx0KiBAcGFyYW0ge3N0cmluZ30gICBbY2xvc2VDaGFyc11cblx0KiBAcGFyYW0ge3N0cmluZ30gICBbbGlua11cblx0KiBAcmV0dXJucyB7U2V0dGluZ3N9XG5cdCpcblx0KiBHZXQgZGVsaW1pdGVyc1xuXHQqIGRlbGltc0FycmF5ID0gJC52aWV3cy5zZXR0aW5ncy5kZWxpbWl0ZXJzKClcblx0KlxuXHQqIEByZXR1cm5zIHtzdHJpbmdbXX1cblx0Ki9cbmZ1bmN0aW9uICR2aWV3c0RlbGltaXRlcnMob3BlbkNoYXJzLCBjbG9zZUNoYXJzLCBsaW5rKSB7XG5cdGlmICghb3BlbkNoYXJzKSB7XG5cdFx0cmV0dXJuICRzdWJTZXR0aW5ncy5kZWxpbWl0ZXJzO1xuXHR9XG5cdGlmICgkaXNBcnJheShvcGVuQ2hhcnMpKSB7XG5cdFx0cmV0dXJuICR2aWV3c0RlbGltaXRlcnMuYXBwbHkoJHZpZXdzLCBvcGVuQ2hhcnMpO1xuXHR9XG5cdGxpbmtDaGFyID0gbGluayA/IGxpbmtbMF0gOiBsaW5rQ2hhcjtcblx0aWYgKCEvXihcXFd8Xyl7NX0kLy50ZXN0KG9wZW5DaGFycyArIGNsb3NlQ2hhcnMgKyBsaW5rQ2hhcikpIHtcblx0XHRlcnJvcihcIkludmFsaWQgZGVsaW1pdGVyc1wiKTsgLy8gTXVzdCBiZSBub24td29yZCBjaGFyYWN0ZXJzLCBhbmQgb3BlbkNoYXJzIGFuZCBjbG9zZUNoYXJzIG11c3QgZWFjaCBiZSBsZW5ndGggMlxuXHR9XG5cdGRlbGltT3BlbkNoYXIwID0gb3BlbkNoYXJzWzBdO1xuXHRkZWxpbU9wZW5DaGFyMSA9IG9wZW5DaGFyc1sxXTtcblx0ZGVsaW1DbG9zZUNoYXIwID0gY2xvc2VDaGFyc1swXTtcblx0ZGVsaW1DbG9zZUNoYXIxID0gY2xvc2VDaGFyc1sxXTtcblxuXHQkc3ViU2V0dGluZ3MuZGVsaW1pdGVycyA9IFtkZWxpbU9wZW5DaGFyMCArIGRlbGltT3BlbkNoYXIxLCBkZWxpbUNsb3NlQ2hhcjAgKyBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyXTtcblxuXHQvLyBFc2NhcGUgdGhlIGNoYXJhY3RlcnMgLSBzaW5jZSB0aGV5IGNvdWxkIGJlIHJlZ2V4IHNwZWNpYWwgY2hhcmFjdGVyc1xuXHRvcGVuQ2hhcnMgPSBcIlxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjE7IC8vIERlZmF1bHQgaXMgXCJ7XntcIlxuXHRjbG9zZUNoYXJzID0gXCJcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIlxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMTsgICAgICAgICAgICAgICAgICAgLy8gRGVmYXVsdCBpcyBcIn19XCJcblx0Ly8gQnVpbGQgcmVnZXggd2l0aCBuZXcgZGVsaW1pdGVyc1xuXHQvLyAgICAgICAgICBbdGFnICAgIChmb2xsb3dlZCBieSAvIHNwYWNlIG9yIH0pICBvciBjdnRyK2NvbG9uIG9yIGh0bWwgb3IgY29kZV0gZm9sbG93ZWQgYnkgc3BhY2UrcGFyYW1zIHRoZW4gY29udmVydEJhY2s/XG5cdHJUYWcgPSBcIig/OihcXFxcdysoPz1bXFxcXC9cXFxcc1xcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiXSkpfChcXFxcdyspPyg6KXwoPil8KFxcXFwqKSlcXFxccyooKD86W15cXFxcXCJcblx0XHQrIGRlbGltQ2xvc2VDaGFyMCArIFwiXXxcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIig/IVxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMSArIFwiKSkqPylcIjtcblxuXHQvLyBNYWtlIHJUYWcgYXZhaWxhYmxlIHRvIEpzVmlld3MgKG9yIG90aGVyIGNvbXBvbmVudHMpIGZvciBwYXJzaW5nIGJpbmRpbmcgZXhwcmVzc2lvbnNcblx0JHN1Yi5yVGFnID0gXCIoPzpcIiArIHJUYWcgKyBcIilcIjtcblx0Ly8gICAgICAgICAgICAgICAgICAgICAgICB7IF4/IHsgICB0YWcrcGFyYW1zIHNsYXNoPyAgb3IgY2xvc2luZ1RhZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yIGNvbW1lbnRcblx0clRhZyA9IG5ldyBSZWdFeHAoXCIoPzpcIiArIG9wZW5DaGFycyArIHJUYWcgKyBcIihcXFxcLyk/fFxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjEgKyBcIig/Oig/OlxcXFwvKFxcXFx3KykpXFxcXHMqfCEtLVtcXFxcc1xcXFxTXSo/LS0pKVwiICsgY2xvc2VDaGFycywgXCJnXCIpO1xuXG5cdC8vIERlZmF1bHQ6ICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcblx0Ly8gICAgICAvKD86eyhcXF4pP3soPzooXFx3Kyg/PVtcXC9cXHN9XSkpfChcXHcrKT8oOil8KD4pfChcXCopKVxccyooKD86W159XXx9KD8hfSkpKj8pKFxcLyk/fHsoXFxeKT97KD86KD86XFwvKFxcdyspKVxccyp8IS0tW1xcc1xcU10qPy0tKSl9fVxuXG5cdCRzdWIuclRtcGwgPSBuZXcgUmVnRXhwKFwiXlxcXFxzfFxcXFxzJHw8Lio+fChbXlxcXFxcXFxcXXxeKVt7fV18XCIgKyBvcGVuQ2hhcnMgKyBcIi4qXCIgKyBjbG9zZUNoYXJzKTtcblx0Ly8gJHN1Yi5yVG1wbCBsb29rcyBmb3IgaW5pdGlhbCBvciBmaW5hbCB3aGl0ZSBzcGFjZSwgaHRtbCB0YWdzIG9yIHsgb3IgfSBjaGFyIG5vdCBwcmVjZWRlZCBieSBcXFxcLCBvciBKc1JlbmRlciB0YWdzIHt7eHh4fX0uXG5cdC8vIEVhY2ggb2YgdGhlc2Ugc3RyaW5ncyBhcmUgY29uc2lkZXJlZCBOT1QgdG8gYmUgalF1ZXJ5IHNlbGVjdG9yc1xuXHRyZXR1cm4gJHZpZXdzU2V0dGluZ3M7XG59XG5cbi8vPT09PT09PT09XG4vLyBWaWV3LmdldFxuLy89PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0Vmlldyhpbm5lciwgdHlwZSkgeyAvL3ZpZXcuZ2V0KGlubmVyLCB0eXBlKVxuXHRpZiAoIXR5cGUgJiYgaW5uZXIgIT09IHRydWUpIHtcblx0XHQvLyB2aWV3LmdldCh0eXBlKVxuXHRcdHR5cGUgPSBpbm5lcjtcblx0XHRpbm5lciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHZhciB2aWV3cywgaSwgbCwgZm91bmQsXG5cdFx0dmlldyA9IHRoaXMsXG5cdFx0cm9vdCA9IHR5cGUgPT09IFwicm9vdFwiO1xuXHRcdC8vIHZpZXcuZ2V0KFwicm9vdFwiKSByZXR1cm5zIHZpZXcucm9vdCwgdmlldy5nZXQoKSByZXR1cm5zIHZpZXcucGFyZW50LCB2aWV3LmdldCh0cnVlKSByZXR1cm5zIHZpZXcudmlld3NbMF0uXG5cblx0aWYgKGlubmVyKSB7XG5cdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIG5lc3RlZCBvbmVzLCBkZXB0aC1maXJzdCAtIGFuZCByZXR1cm4gZmlyc3Qgb25lIHdpdGggZ2l2ZW4gdHlwZS5cblx0XHQvLyBJZiB0eXBlIGlzIHVuZGVmaW5lZCwgaS5lLiB2aWV3LmdldCh0cnVlKSwgcmV0dXJuIGZpcnN0IGNoaWxkIHZpZXcuXG5cdFx0Zm91bmQgPSB0eXBlICYmIHZpZXcudHlwZSA9PT0gdHlwZSAmJiB2aWV3O1xuXHRcdGlmICghZm91bmQpIHtcblx0XHRcdHZpZXdzID0gdmlldy52aWV3cztcblx0XHRcdGlmICh2aWV3Ll8udXNlS2V5KSB7XG5cdFx0XHRcdGZvciAoaSBpbiB2aWV3cykge1xuXHRcdFx0XHRcdGlmIChmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV0pIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChpID0gMCwgbCA9IHZpZXdzLmxlbmd0aDsgIWZvdW5kICYmIGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHRmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAocm9vdCkge1xuXHRcdC8vIEZpbmQgcm9vdCB2aWV3LiAodmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXcpXG5cdFx0Zm91bmQgPSB2aWV3LnJvb3Q7XG5cdH0gZWxzZSBpZiAodHlwZSkge1xuXHRcdHdoaWxlICh2aWV3ICYmICFmb3VuZCkge1xuXHRcdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIHBhcmVudCBvbmVzIC0gYW5kIHJldHVybiBmaXJzdCBvbmUgd2l0aCBnaXZlbiB0eXBlLlxuXHRcdFx0Zm91bmQgPSB2aWV3LnR5cGUgPT09IHR5cGUgPyB2aWV3IDogdW5kZWZpbmVkO1xuXHRcdFx0dmlldyA9IHZpZXcucGFyZW50O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRmb3VuZCA9IHZpZXcucGFyZW50O1xuXHR9XG5cdHJldHVybiBmb3VuZCB8fCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldE5lc3RlZEluZGV4KCkge1xuXHR2YXIgdmlldyA9IHRoaXMuZ2V0KFwiaXRlbVwiKTtcblx0cmV0dXJuIHZpZXcgPyB2aWV3LmluZGV4IDogdW5kZWZpbmVkO1xufVxuXG5nZXROZXN0ZWRJbmRleC5kZXBlbmRzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBbdGhpcy5nZXQoXCJpdGVtXCIpLCBcImluZGV4XCJdO1xufTtcblxuZnVuY3Rpb24gZ2V0SW5kZXgoKSB7XG5cdHJldHVybiB0aGlzLmluZGV4O1xufVxuXG5nZXRJbmRleC5kZXBlbmRzID0gXCJpbmRleFwiO1xuXG4vLz09PT09PT09PT09PT09PT09PVxuLy8gVmlldy5jdHhQcm0sIGV0Yy5cbi8vPT09PT09PT09PT09PT09PT09XG5cbi8qIEludGVybmFsIHByaXZhdGU6IHZpZXcuX2dldE9iKCkgKi9cbmZ1bmN0aW9uIGdldFBhdGhPYmplY3Qob2IsIHBhdGgsIGx0T2IsIGZuKSB7XG5cdC8vIEl0ZXJhdGUgdGhyb3VnaCBwYXRoIHRvIGxhdGUgcGF0aHM6IEBhLmIuYyBwYXRoc1xuXHQvLyBSZXR1cm4gXCJcIiAob3Igbm9vcCBpZiBsZWFmIGlzIGEgZnVuY3Rpb24gQGEuYi5jKC4uLikgKSBpZiBpbnRlcm1lZGlhdGUgb2JqZWN0IG5vdCB5ZXQgYXZhaWxhYmxlXG5cdHZhciBwcmV2T2IsIHRva2VucywgbCxcblx0XHRpID0gMDtcblx0aWYgKGx0T2IgPT09IDEpIHtcblx0XHRmbiA9IDE7XG5cdFx0bHRPYiA9IHVuZGVmaW5lZDtcblx0fVxuXHQvLyBQYXRocyBsaWtlIF5hXmJeYyBvciB+XmFeYl5jIHdpbGwgbm90IHRocm93IGlmIGFuIG9iamVjdCBpbiBwYXRoIGlzIHVuZGVmaW5lZC5cblx0aWYgKHBhdGgpIHtcblx0XHR0b2tlbnMgPSBwYXRoLnNwbGl0KFwiLlwiKTtcblx0XHRsID0gdG9rZW5zLmxlbmd0aDtcblxuXHRcdGZvciAoOyBvYiAmJiBpIDwgbDsgaSsrKSB7XG5cdFx0XHRwcmV2T2IgPSBvYjtcblx0XHRcdG9iID0gdG9rZW5zW2ldID8gb2JbdG9rZW5zW2ldXSA6IG9iO1xuXHRcdH1cblx0fVxuXHRpZiAobHRPYikge1xuXHRcdGx0T2IubHQgPSBsdE9iLmx0IHx8IGk8bDsgLy8gSWYgaSA8IGwgdGhlcmUgd2FzIGFuIG9iamVjdCBpbiB0aGUgcGF0aCBub3QgeWV0IGF2YWlsYWJsZVxuXHR9XG5cdHJldHVybiBvYiA9PT0gdW5kZWZpbmVkXG5cdFx0PyBmbiA/IG5vb3AgOiBcIlwiXG5cdFx0OiBmbiA/IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIG9iLmFwcGx5KHByZXZPYiwgYXJndW1lbnRzKTtcblx0XHR9IDogb2I7XG59XG5cbmZ1bmN0aW9uIGNvbnRleHRQYXJhbWV0ZXIoa2V5LCB2YWx1ZSwgZ2V0KSB7XG5cdC8vIEhlbHBlciBtZXRob2QgY2FsbGVkIGFzIHZpZXcuY3R4UHJtKGtleSkgZm9yIGhlbHBlcnMgb3IgdGVtcGxhdGUgcGFyYW1ldGVycyB+Zm9vIC0gZnJvbSBjb21waWxlZCB0ZW1wbGF0ZSBvciBmcm9tIGNvbnRleHQgY2FsbGJhY2tcblx0dmFyIHdyYXBwZWQsIGRlcHMsIHJlcywgb2JzQ3R4UHJtLCB0YWdFbHNlLCBjYWxsVmlldywgbmV3UmVzLFxuXHRcdHN0b3JlVmlldyA9IHRoaXMsXG5cdFx0aXNVcGRhdGUgPSAhaXNSZW5kZXJDYWxsICYmIGFyZ3VtZW50cy5sZW5ndGggPiAxLFxuXHRcdHN0b3JlID0gc3RvcmVWaWV3LmN0eDtcblx0aWYgKGtleSkge1xuXHRcdGlmICghc3RvcmVWaWV3Ll8pIHsgLy8gdGFnQ3R4LmN0eFBybSgpIGNhbGxcblx0XHRcdHRhZ0Vsc2UgPSBzdG9yZVZpZXcuaW5kZXg7XG5cdFx0XHRzdG9yZVZpZXcgPSBzdG9yZVZpZXcudGFnO1xuXHRcdH1cblx0XHRjYWxsVmlldyA9IHN0b3JlVmlldztcblx0XHRpZiAoc3RvcmUgJiYgc3RvcmUuaGFzT3duUHJvcGVydHkoa2V5KSB8fCAoc3RvcmUgPSAkaGVscGVycykuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0cmVzID0gc3RvcmVba2V5XTtcblx0XHRcdGlmIChrZXkgPT09IFwidGFnXCIgfHwga2V5ID09PSBcInRhZ0N0eFwiIHx8IGtleSA9PT0gXCJyb290XCIgfHwga2V5ID09PSBcInBhcmVudFRhZ3NcIikge1xuXHRcdFx0XHRyZXR1cm4gcmVzO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdG9yZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCFpc1JlbmRlckNhbGwgJiYgc3RvcmVWaWV3LnRhZ0N0eCB8fCBzdG9yZVZpZXcubGlua2VkKSB7IC8vIERhdGEtbGlua2VkIHZpZXcsIG9yIHRhZyBpbnN0YW5jZVxuXHRcdFx0aWYgKCFyZXMgfHwgIXJlcy5fY3hwKSB7XG5cdFx0XHRcdC8vIE5vdCBhIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdC8vIFNldCBzdG9yZVZpZXcgdG8gdGFnIChpZiB0aGlzIGlzIGEgdGFnLmN0eFBybSgpIGNhbGwpIG9yIHRvIHJvb3QgdmlldyAoXCJkYXRhXCIgdmlldyBvZiBsaW5rZWQgdGVtcGxhdGUpXG5cdFx0XHRcdHN0b3JlVmlldyA9IHN0b3JlVmlldy50YWdDdHggfHwgJGlzRnVuY3Rpb24ocmVzKVxuXHRcdFx0XHRcdD8gc3RvcmVWaWV3IC8vIElzIGEgdGFnLCBub3QgYSB2aWV3LCBvciBpcyBhIGNvbXB1dGVkIGNvbnRleHR1YWwgcGFyYW1ldGVyLCBzbyBzY29wZSB0byB0aGUgY2FsbFZpZXcsIG5vIHRoZSAnc2NvcGUgdmlldydcblx0XHRcdFx0XHQ6IChzdG9yZVZpZXcgPSBzdG9yZVZpZXcuc2NvcGUgfHwgc3RvcmVWaWV3LFxuXHRcdFx0XHRcdFx0IXN0b3JlVmlldy5pc1RvcCAmJiBzdG9yZVZpZXcuY3R4LnRhZyAvLyBJZiB0aGlzIHZpZXcgaXMgaW4gYSB0YWcsIHNldCBzdG9yZVZpZXcgdG8gdGhlIHRhZ1xuXHRcdFx0XHRcdFx0XHR8fCBzdG9yZVZpZXcpO1xuXHRcdFx0XHRpZiAocmVzICE9PSB1bmRlZmluZWQgJiYgc3RvcmVWaWV3LnRhZ0N0eCkge1xuXHRcdFx0XHRcdC8vIElmIHN0b3JlVmlldyBpcyBhIHRhZywgYnV0IHRoZSBjb250ZXh0dWFsIHBhcmFtZXRlciBoYXMgYmVlbiBzZXQgYXQgYXQgaGlnaGVyIGxldmVsIChlLmcuIGhlbHBlcnMpLi4uXG5cdFx0XHRcdFx0c3RvcmVWaWV3ID0gc3RvcmVWaWV3LnRhZ0N0eC52aWV3LnNjb3BlOyAvLyB0aGVuIG1vdmUgc3RvcmVWaWV3IHRvIHRoZSBvdXRlciBsZXZlbCAoc2NvcGUgb2YgdGFnIGNvbnRhaW5lciB2aWV3KVxuXHRcdFx0XHR9XG5cdFx0XHRcdHN0b3JlID0gc3RvcmVWaWV3Ll9vY3BzO1xuXHRcdFx0XHRyZXMgPSBzdG9yZSAmJiBzdG9yZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHN0b3JlW2tleV0gfHwgcmVzO1xuXHRcdFx0XHRpZiAoIShyZXMgJiYgcmVzLl9jeHApICYmIChnZXQgfHwgaXNVcGRhdGUpKSB7XG5cdFx0XHRcdFx0Ly8gQ3JlYXRlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHQoc3RvcmUgfHwgKHN0b3JlVmlldy5fb2NwcyA9IHN0b3JlVmlldy5fb2NwcyB8fCB7fSkpW2tleV1cblx0XHRcdFx0XHRcdD0gcmVzXG5cdFx0XHRcdFx0XHQ9IFt7XG5cdFx0XHRcdFx0XHRcdF9vY3A6IHJlcywgLy8gVGhlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgdmFsdWVcblx0XHRcdFx0XHRcdFx0X3Z3OiBjYWxsVmlldyxcblx0XHRcdFx0XHRcdFx0X2tleToga2V5XG5cdFx0XHRcdFx0XHR9XTtcblx0XHRcdFx0XHRyZXMuX2N4cCA9IHtcblx0XHRcdFx0XHRcdHBhdGg6IF9vY3AsXG5cdFx0XHRcdFx0XHRpbmQ6IDAsXG5cdFx0XHRcdFx0XHR1cGRhdGVWYWx1ZTogZnVuY3Rpb24odmFsLCBwYXRoKSB7XG5cdFx0XHRcdFx0XHRcdCQub2JzZXJ2YWJsZShyZXNbMF0pLnNldFByb3BlcnR5KF9vY3AsIHZhbCk7IC8vIFNldCB0aGUgdmFsdWUgKHJlc1swXS5fb2NwKVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAob2JzQ3R4UHJtID0gcmVzICYmIHJlcy5fY3hwKSB7XG5cdFx0XHRcdC8vIElmIHRoaXMgaGVscGVyIHJlc291cmNlIGlzIGFuIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiAyKSB7XG5cdFx0XHRcdFx0ZGVwcyA9IHJlc1sxXSA/ICRzdWIuX2NlbyhyZXNbMV0uZGVwcykgOiBbX29jcF07IC8vIGZuIGRlcHMgKHdpdGggYW55IGV4cHJPYnMgY2xvbmVkIHVzaW5nICRzdWIuX2Nlbylcblx0XHRcdFx0XHRkZXBzLnVuc2hpZnQocmVzWzBdKTsgLy8gdmlld1xuXHRcdFx0XHRcdGRlcHMuX2N4cCA9IG9ic0N0eFBybTtcblx0XHRcdFx0XHQvLyBJbiBhIGNvbnRleHQgY2FsbGJhY2sgZm9yIGEgY29udGV4dHVhbCBwYXJhbSwgd2Ugc2V0IGdldCA9IHRydWUsIHRvIGdldCBjdHhQcm0gW3ZpZXcsIGRlcGVuZGVuY2llcy4uLl0gYXJyYXkgLSBuZWVkZWQgZm9yIG9ic2VydmUgY2FsbFxuXHRcdFx0XHRcdHJldHVybiBkZXBzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRhZ0Vsc2UgPSBvYnNDdHhQcm0udGFnRWxzZTtcblx0XHRcdFx0bmV3UmVzID0gcmVzWzFdIC8vIGxpbmtGbiBmb3IgY29tcGlsZWQgZXhwcmVzc2lvblxuXHRcdFx0XHRcdD8gb2JzQ3R4UHJtLnRhZyAmJiBvYnNDdHhQcm0udGFnLmN2dEFyZ3Ncblx0XHRcdFx0XHRcdD8gb2JzQ3R4UHJtLnRhZy5jdnRBcmdzKHRhZ0Vsc2UsIDEpW29ic0N0eFBybS5pbmRdIC8vID0gdGFnLmJuZEFyZ3MoKSAtIGZvciB0YWcgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHRcdDogcmVzWzFdKHJlc1swXS5kYXRhLCByZXNbMF0sICRzdWIpIC8vID0gZm4oZGF0YSwgdmlldywgJHN1YikgZm9yIGNvbXBpbGVkIGJpbmRpbmcgZXhwcmVzc2lvblxuXHRcdFx0XHRcdDogcmVzWzBdLl9vY3A7IC8vIE9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgKHVuaW5pdGlhbGl6ZWQsIG9yIGluaXRpYWxpemVkIGFzIHN0YXRpYyBleHByZXNzaW9uLCBzbyBubyBwYXRoIGRlcGVuZGVuY2llcylcblx0XHRcdFx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0XHRcdFx0JHN1Yi5fdWNwKGtleSwgdmFsdWUsIHN0b3JlVmlldywgb2JzQ3R4UHJtKTsgLy8gVXBkYXRlIG9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHRyZXR1cm4gc3RvcmVWaWV3O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlcyA9IG5ld1Jlcztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHJlcyAmJiAkaXNGdW5jdGlvbihyZXMpKSB7XG5cdFx0XHQvLyBJZiBhIGhlbHBlciBpcyBvZiB0eXBlIGZ1bmN0aW9uIHdlIHdpbGwgd3JhcCBpdCwgc28gaWYgY2FsbGVkIHdpdGggbm8gdGhpcyBwb2ludGVyIGl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlXG5cdFx0XHQvLyB2aWV3IGFzICd0aGlzJyBjb250ZXh0LiBJZiB0aGUgaGVscGVyIH5mb28oKSB3YXMgaW4gYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiwgdGhlIHZpZXcgd2lsbCBoYXZlIGEgJ3RlbXBvcmFyeScgbGlua0N0eCBwcm9wZXJ0eSB0b28uXG5cdFx0XHQvLyBOb3RlIHRoYXQgaGVscGVyIGZ1bmN0aW9ucyBvbiBkZWVwZXIgcGF0aHMgd2lsbCBoYXZlIHNwZWNpZmljIHRoaXMgcG9pbnRlcnMsIGZyb20gdGhlIHByZWNlZGluZyBwYXRoLlxuXHRcdFx0Ly8gRm9yIGV4YW1wbGUsIH51dGlsLmZvbygpIHdpbGwgaGF2ZSB0aGUgfnV0aWwgb2JqZWN0IGFzICd0aGlzJyBwb2ludGVyXG5cdFx0XHR3cmFwcGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiByZXMuYXBwbHkoKCF0aGlzIHx8IHRoaXMgPT09IGdsb2JhbCkgPyBjYWxsVmlldyA6IHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHR9O1xuXHRcdFx0JGV4dGVuZCh3cmFwcGVkLCByZXMpOyAvLyBBdHRhY2ggc2FtZSBleHBhbmRvcyAoaWYgYW55KSB0byB0aGUgd3JhcHBlZCBmdW5jdGlvblxuXHRcdH1cblx0XHRyZXR1cm4gd3JhcHBlZCB8fCByZXM7XG5cdH1cbn1cblxuLyogSW50ZXJuYWwgcHJpdmF0ZTogdmlldy5fZ2V0VG1wbCgpICovXG5mdW5jdGlvbiBnZXRUZW1wbGF0ZSh0bXBsKSB7XG5cdHJldHVybiB0bXBsICYmICh0bXBsLmZuXG5cdFx0PyB0bXBsXG5cdFx0OiB0aGlzLmdldFJzYyhcInRlbXBsYXRlc1wiLCB0bXBsKSB8fCAkdGVtcGxhdGVzKHRtcGwpKTsgLy8gbm90IHlldCBjb21waWxlZFxufVxuXG4vLz09PT09PT09PT09PT09XG4vLyB2aWV3cy5fY252dFxuLy89PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb252ZXJ0VmFsKGNvbnZlcnRlciwgdmlldywgdGFnQ3R4LCBvbkVycm9yKSB7XG5cdC8vIENhbGxlZCBmcm9tIGNvbXBpbGVkIHRlbXBsYXRlIGNvZGUgZm9yIHt7On19XG5cdC8vIHNlbGYgaXMgdGVtcGxhdGUgb2JqZWN0IG9yIGxpbmtDdHggb2JqZWN0XG5cdHZhciB0YWcsIGxpbmtDdHgsIHZhbHVlLCBhcmdzTGVuLCBiaW5kVG8sXG5cdFx0Ly8gSWYgdGFnQ3R4IGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4XG5cdFx0Ym91bmRUYWcgPSB0eXBlb2YgdGFnQ3R4ID09PSBcIm51bWJlclwiICYmIHZpZXcudG1wbC5ibmRzW3RhZ0N0eC0xXTtcblxuXHRpZiAob25FcnJvciA9PT0gdW5kZWZpbmVkICYmIGJvdW5kVGFnICYmIGJvdW5kVGFnLl9scikgeyAvLyBsYXRlUmVuZGVyXG5cdFx0b25FcnJvciA9IFwiXCI7XG5cdH1cblx0aWYgKG9uRXJyb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdHRhZ0N0eCA9IG9uRXJyb3IgPSB7cHJvcHM6IHt9LCBhcmdzOiBbb25FcnJvcl19O1xuXHR9IGVsc2UgaWYgKGJvdW5kVGFnKSB7XG5cdFx0dGFnQ3R4ID0gYm91bmRUYWcodmlldy5kYXRhLCB2aWV3LCAkc3ViKTtcblx0fVxuXHRib3VuZFRhZyA9IGJvdW5kVGFnLl9iZCAmJiBib3VuZFRhZztcblx0aWYgKGNvbnZlcnRlciB8fCBib3VuZFRhZykge1xuXHRcdGxpbmtDdHggPSB2aWV3Ll9sYzsgLy8gRm9yIGRhdGEtbGluaz1cIntjdnQ6Li4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcblx0XHR0YWcgPSBsaW5rQ3R4ICYmIGxpbmtDdHgudGFnO1xuXHRcdHRhZ0N0eC52aWV3ID0gdmlldztcblx0XHRpZiAoIXRhZykge1xuXHRcdFx0dGFnID0gJGV4dGVuZChuZXcgJHN1Yi5fdGcoKSwge1xuXHRcdFx0XHRfOiB7XG5cdFx0XHRcdFx0Ym5kOiBib3VuZFRhZyxcblx0XHRcdFx0XHR1bmxpbmtlZDogdHJ1ZSxcblx0XHRcdFx0XHRsdDogdGFnQ3R4Lmx0IC8vIElmIGEgbGF0ZSBwYXRoIEBzb21lLnBhdGggaGFzIG5vdCByZXR1cm5lZCBAc29tZSBvYmplY3QsIG1hcmsgdGFnIGFzIGxhdGVcblx0XHRcdFx0fSxcblx0XHRcdFx0aW5saW5lOiAhbGlua0N0eCxcblx0XHRcdFx0dGFnTmFtZTogXCI6XCIsXG5cdFx0XHRcdGNvbnZlcnQ6IGNvbnZlcnRlcixcblx0XHRcdFx0b25BcnJheUNoYW5nZTogdHJ1ZSxcblx0XHRcdFx0ZmxvdzogdHJ1ZSxcblx0XHRcdFx0dGFnQ3R4OiB0YWdDdHgsXG5cdFx0XHRcdHRhZ0N0eHM6IFt0YWdDdHhdLFxuXHRcdFx0XHRfaXM6IFwidGFnXCJcblx0XHRcdH0pO1xuXHRcdFx0YXJnc0xlbiA9IHRhZ0N0eC5hcmdzLmxlbmd0aDtcblx0XHRcdGlmIChhcmdzTGVuPjEpIHtcblx0XHRcdFx0YmluZFRvID0gdGFnLmJpbmRUbyA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoYXJnc0xlbi0tKSB7XG5cdFx0XHRcdFx0YmluZFRvLnVuc2hpZnQoYXJnc0xlbik7IC8vIEJpbmQgdG8gYWxsIHRoZSBhcmd1bWVudHMgLSBnZW5lcmF0ZSBiaW5kVG8gYXJyYXk6IFswLDEsMi4uLl1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGxpbmtDdHgpIHtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHRcdHRhZy5saW5rQ3R4ID0gbGlua0N0eDtcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgodGFnQ3R4LmN0eCwgKGxpbmtDdHggPyBsaW5rQ3R4LnZpZXcgOiB2aWV3KS5jdHgpO1xuXHRcdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpO1xuXHRcdH1cblx0XHR0YWcuX2VyID0gb25FcnJvciAmJiB2YWx1ZTtcblx0XHR0YWcuY3R4ID0gdGFnQ3R4LmN0eCB8fCB0YWcuY3R4IHx8IHt9O1xuXHRcdHRhZ0N0eC5jdHggPSB1bmRlZmluZWQ7XG5cdFx0dmFsdWUgPSB0YWcuY3Z0QXJncygpWzBdOyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRCYWNrIGJ1dCBubyBjb252ZXJ0LCBjb252ZXJ0ZXIgd2lsbCBiZSBcInRydWVcIlxuXHRcdHRhZy5fZXIgPSBvbkVycm9yICYmIHZhbHVlO1xuXHR9IGVsc2Uge1xuXHRcdHZhbHVlID0gdGFnQ3R4LmFyZ3NbMF07XG5cdH1cblxuXHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdHZhbHVlID0gYm91bmRUYWcgJiYgdmlldy5fLm9uUmVuZGVyXG5cdFx0PyB2aWV3Ll8ub25SZW5kZXIodmFsdWUsIHZpZXcsIHRhZylcblx0XHQ6IHZhbHVlO1xuXHRyZXR1cm4gdmFsdWUgIT0gdW5kZWZpbmVkID8gdmFsdWUgOiBcIlwiO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXJncyh0YWdFbHNlLCBib3VuZCkgeyAvLyB0YWcuY3Z0QXJncygpIG9yIHRhZy5jdnRBcmdzKHRhZ0Vsc2U/LCB0cnVlPylcblx0dmFyIGwsIGtleSwgYm91bmRBcmdzLCBhcmdzLCBiaW5kRnJvbSwgdGFnLCBjb252ZXJ0ZXIsXG5cdFx0dGFnQ3R4ID0gdGhpcztcblxuXHRpZiAodGFnQ3R4LnRhZ05hbWUpIHtcblx0XHR0YWcgPSB0YWdDdHg7XG5cdFx0dGFnQ3R4ID0gKHRhZy50YWdDdHhzIHx8IFt0YWdDdHhdKVt0YWdFbHNlfHwwXTtcblx0XHRpZiAoIXRhZ0N0eCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR0YWcgPSB0YWdDdHgudGFnO1xuXHR9XG5cblx0YmluZEZyb20gPSB0YWcuYmluZEZyb207XG5cdGFyZ3MgPSB0YWdDdHguYXJncztcblxuXHRpZiAoKGNvbnZlcnRlciA9IHRhZy5jb252ZXJ0KSAmJiB0eXBlb2YgY29udmVydGVyID09PSBTVFJJTkcpIHtcblx0XHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIgPT09IFwidHJ1ZVwiXG5cdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0OiAodGFnQ3R4LnZpZXcuZ2V0UnNjKFwiY29udmVydGVyc1wiLCBjb252ZXJ0ZXIpIHx8IGVycm9yKFwiVW5rbm93biBjb252ZXJ0ZXI6ICdcIiArIGNvbnZlcnRlciArIFwiJ1wiKSk7XG5cdH1cblxuXHRpZiAoY29udmVydGVyICYmICFib3VuZCkgeyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRlciwgdXNlIGEgY29weSBvZiB0aGUgdGFnQ3R4LmFyZ3MgYXJyYXkgZm9yIHJlbmRlcmluZywgYW5kIHJlcGxhY2UgdGhlIGFyZ3NbMF0gaW5cblx0XHRhcmdzID0gYXJncy5zbGljZSgpOyAvLyB0aGUgY29waWVkIGFycmF5IHdpdGggdGhlIGNvbnZlcnRlZCB2YWx1ZS4gQnV0IHdlIGRvIG5vdCBtb2RpZnkgdGhlIHZhbHVlIG9mIHRhZy50YWdDdHguYXJnc1swXSAodGhlIG9yaWdpbmFsIGFyZ3MgYXJyYXkpXG5cdH1cblx0aWYgKGJpbmRGcm9tKSB7IC8vIEdldCB0aGUgdmFsdWVzIG9mIHRoZSBib3VuZEFyZ3Ncblx0XHRib3VuZEFyZ3MgPSBbXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0Ym91bmRBcmdzLnVuc2hpZnQoYXJnT3JQcm9wKHRhZ0N0eCwga2V5KSk7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkge1xuXHRcdFx0YXJncyA9IGJvdW5kQXJnczsgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSByZXR1cm5zIHRoZSBib3VuZEFyZ3Ncblx0XHR9XG5cdH1cblx0aWYgKGNvbnZlcnRlcikge1xuXHRcdGNvbnZlcnRlciA9IGNvbnZlcnRlci5hcHBseSh0YWcsIGJvdW5kQXJncyB8fCBhcmdzKTtcblx0XHRpZiAoY29udmVydGVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBhcmdzOyAvLyBSZXR1cm5pbmcgdW5kZWZpbmVkIGZyb20gYSBjb252ZXJ0ZXIgaXMgZXF1aXZhbGVudCB0byBub3QgaGF2aW5nIGEgY29udmVydGVyLlxuXHRcdH1cblx0XHRiaW5kRnJvbSA9IGJpbmRGcm9tIHx8IFswXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdGlmICghJGlzQXJyYXkoY29udmVydGVyKSB8fCAoY29udmVydGVyLmFyZzAgIT09IGZhbHNlICYmIChsID09PSAxIHx8IGNvbnZlcnRlci5sZW5ndGggIT09IGwgfHwgY29udmVydGVyLmFyZzApKSkge1xuXHRcdFx0Y29udmVydGVyID0gW2NvbnZlcnRlcl07IC8vIFJldHVybmluZyBjb252ZXJ0ZXIgYXMgZmlyc3QgYXJnLCBldmVuIGlmIGNvbnZlcnRlciB2YWx1ZSBpcyBhbiBhcnJheVxuXHRcdFx0YmluZEZyb20gPSBbMF07XG5cdFx0XHRsID0gMTtcblx0XHR9XG5cdFx0aWYgKGJvdW5kKSB7ICAgICAgICAvLyBDYWxsIHRvIGJuZEFyZ3MoKSAtIHNvIGFwcGx5IGNvbnZlcnRlciB0byBhbGwgYm91bmRBcmdzXG5cdFx0XHRhcmdzID0gY29udmVydGVyOyAvLyBUaGUgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGZyb20gdGhlIGNvbnZlcnRlclxuXHRcdH0gZWxzZSB7ICAgICAgICAgICAgLy8gQ2FsbCB0byBjdnRBcmdzKClcblx0XHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdFx0a2V5ID0gYmluZEZyb21bbF07XG5cdFx0XHRcdGlmICgra2V5ID09PSBrZXkpIHtcblx0XHRcdFx0XHRhcmdzW2tleV0gPSBjb252ZXJ0ZXJbbF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGFyZ3M7XG59XG5cbmZ1bmN0aW9uIGFyZ09yUHJvcChjb250ZXh0LCBrZXkpIHtcblx0Y29udGV4dCA9IGNvbnRleHRbK2tleSA9PT0ga2V5ID8gXCJhcmdzXCIgOiBcInByb3BzXCJdO1xuXHRyZXR1cm4gY29udGV4dCAmJiBjb250ZXh0W2tleV07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRCb3VuZEFyZ3ModGFnRWxzZSkgeyAvLyB0YWcuYm5kQXJncygpXG5cdHJldHVybiB0aGlzLmN2dEFyZ3ModGFnRWxzZSwgMSk7XG59XG5cbi8vPT09PT09PT09PT09PVxuLy8gdmlld3MudGFnXG4vLz09PT09PT09PT09PT1cblxuLyogdmlldy5nZXRSc2MoKSAqL1xuZnVuY3Rpb24gZ2V0UmVzb3VyY2UocmVzb3VyY2VUeXBlLCBpdGVtTmFtZSkge1xuXHR2YXIgcmVzLCBzdG9yZSxcblx0XHR2aWV3ID0gdGhpcztcblx0aWYgKHR5cGVvZiBpdGVtTmFtZSA9PT0gU1RSSU5HKSB7XG5cdFx0d2hpbGUgKChyZXMgPT09IHVuZGVmaW5lZCkgJiYgdmlldykge1xuXHRcdFx0c3RvcmUgPSB2aWV3LnRtcGwgJiYgdmlldy50bXBsW3Jlc291cmNlVHlwZV07XG5cdFx0XHRyZXMgPSBzdG9yZSAmJiBzdG9yZVtpdGVtTmFtZV07XG5cdFx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXMgfHwgJHZpZXdzW3Jlc291cmNlVHlwZV1baXRlbU5hbWVdO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRhZyh0YWdOYW1lLCBwYXJlbnRWaWV3LCB0bXBsLCB0YWdDdHhzLCBpc1VwZGF0ZSwgb25FcnJvcikge1xuXHRmdW5jdGlvbiBiaW5kVG9PckJpbmRGcm9tKHR5cGUpIHtcblx0XHR2YXIgYmluZEFycmF5ID0gdGFnW3R5cGVdO1xuXG5cdFx0aWYgKGJpbmRBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRiaW5kQXJyYXkgPSAkaXNBcnJheShiaW5kQXJyYXkpID8gYmluZEFycmF5IDogW2JpbmRBcnJheV07XG5cdFx0XHRtID0gYmluZEFycmF5Lmxlbmd0aDtcblx0XHRcdHdoaWxlIChtLS0pIHtcblx0XHRcdFx0a2V5ID0gYmluZEFycmF5W21dO1xuXHRcdFx0XHRpZiAoIWlzTmFOKHBhcnNlSW50KGtleSkpKSB7XG5cdFx0XHRcdFx0YmluZEFycmF5W21dID0gcGFyc2VJbnQoa2V5KTsgLy8gQ29udmVydCBcIjBcIiB0byAwLCBldGMuXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gYmluZEFycmF5IHx8IFswXTtcblx0fVxuXG5cdHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IHRvcFZpZXc7XG5cdHZhciB0YWcsIHRhZ0RlZiwgdGVtcGxhdGUsIHRhZ3MsIGF0dHIsIHBhcmVudFRhZywgbCwgbSwgbiwgaXRlbVJldCwgdGFnQ3R4LCB0YWdDdHhDdHgsIGN0eFBybSwgYmluZFRvLCBiaW5kRnJvbSwgaW5pdFZhbCxcblx0XHRjb250ZW50LCBjYWxsSW5pdCwgbWFwRGVmLCB0aGlzTWFwLCBhcmdzLCBiZEFyZ3MsIHByb3BzLCB0YWdEYXRhTWFwLCBjb250ZW50Q3R4LCBrZXksIGJpbmRGcm9tTGVuZ3RoLCBiaW5kVG9MZW5ndGgsIGxpbmtlZEVsZW1lbnQsIGRlZmF1bHRDdHgsXG5cdFx0aSA9IDAsXG5cdFx0cmV0ID0gXCJcIixcblx0XHRsaW5rQ3R4ID0gcGFyZW50Vmlldy5fbGMgfHwgZmFsc2UsIC8vIEZvciBkYXRhLWxpbms9XCJ7bXlUYWcuLi59XCIuLi4gU2VlIG9uRGF0YUxpbmtlZFRhZ0NoYW5nZVxuXHRcdGN0eCA9IHBhcmVudFZpZXcuY3R4LFxuXHRcdHBhcmVudFRtcGwgPSB0bXBsIHx8IHBhcmVudFZpZXcudG1wbCxcblx0XHQvLyBJZiB0YWdDdHhzIGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4c1xuXHRcdGJvdW5kVGFnID0gdHlwZW9mIHRhZ0N0eHMgPT09IFwibnVtYmVyXCIgJiYgcGFyZW50Vmlldy50bXBsLmJuZHNbdGFnQ3R4cy0xXTtcblxuXHRpZiAodGFnTmFtZS5faXMgPT09IFwidGFnXCIpIHtcblx0XHR0YWcgPSB0YWdOYW1lO1xuXHRcdHRhZ05hbWUgPSB0YWcudGFnTmFtZTtcblx0XHR0YWdDdHhzID0gdGFnLnRhZ0N0eHM7XG5cdFx0dGVtcGxhdGUgPSB0YWcudGVtcGxhdGU7XG5cdH0gZWxzZSB7XG5cdFx0dGFnRGVmID0gcGFyZW50Vmlldy5nZXRSc2MoXCJ0YWdzXCIsIHRhZ05hbWUpIHx8IGVycm9yKFwiVW5rbm93biB0YWc6IHt7XCIgKyB0YWdOYW1lICsgXCJ9fSBcIik7XG5cdFx0dGVtcGxhdGUgPSB0YWdEZWYudGVtcGxhdGU7XG5cdH1cblx0aWYgKG9uRXJyb3IgPT09IHVuZGVmaW5lZCAmJiBib3VuZFRhZyAmJiAoYm91bmRUYWcuX2xyID0gKHRhZ0RlZi5sYXRlUmVuZGVyICYmIGJvdW5kVGFnLl9sciE9PSBmYWxzZSB8fCBib3VuZFRhZy5fbHIpKSkge1xuXHRcdG9uRXJyb3IgPSBcIlwiOyAvLyBJZiBsYXRlUmVuZGVyLCBzZXQgdGVtcG9yYXJ5IG9uRXJyb3IsIHRvIHNraXAgaW5pdGlhbCByZW5kZXJpbmcgKGFuZCByZW5kZXIganVzdCBcIlwiKVxuXHR9XG5cdGlmIChvbkVycm9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXQgKz0gb25FcnJvcjtcblx0XHR0YWdDdHhzID0gb25FcnJvciA9IFt7cHJvcHM6IHt9LCBhcmdzOiBbXSwgcGFyYW1zOiB7cHJvcHM6e319fV07XG5cdH0gZWxzZSBpZiAoYm91bmRUYWcpIHtcblx0XHR0YWdDdHhzID0gYm91bmRUYWcocGFyZW50Vmlldy5kYXRhLCBwYXJlbnRWaWV3LCAkc3ViKTtcblx0fVxuXG5cdGwgPSB0YWdDdHhzLmxlbmd0aDtcblx0Zm9yICg7IGkgPCBsOyBpKyspIHtcblx0XHR0YWdDdHggPSB0YWdDdHhzW2ldO1xuXHRcdGNvbnRlbnQgPSB0YWdDdHgudG1wbDtcblx0XHRpZiAoIWxpbmtDdHggfHwgIWxpbmtDdHgudGFnIHx8IGkgJiYgIWxpbmtDdHgudGFnLmlubGluZSB8fCB0YWcuX2VyIHx8IGNvbnRlbnQgJiYgK2NvbnRlbnQ9PT1jb250ZW50KSB7XG5cdFx0XHQvLyBJbml0aWFsaXplIHRhZ0N0eFxuXHRcdFx0Ly8gRm9yIGJsb2NrIHRhZ3MsIHRhZ0N0eC50bXBsIGlzIGFuIGludGVnZXIgPiAwXG5cdFx0XHRpZiAoY29udGVudCAmJiBwYXJlbnRUbXBsLnRtcGxzKSB7XG5cdFx0XHRcdHRhZ0N0eC50bXBsID0gdGFnQ3R4LmNvbnRlbnQgPSBwYXJlbnRUbXBsLnRtcGxzW2NvbnRlbnQgLSAxXTsgLy8gU2V0IHRoZSB0bXBsIHByb3BlcnR5IHRvIHRoZSBjb250ZW50IG9mIHRoZSBibG9jayB0YWdcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5pbmRleCA9IGk7XG5cdFx0XHR0YWdDdHguY3R4UHJtID0gY29udGV4dFBhcmFtZXRlcjtcblx0XHRcdHRhZ0N0eC5yZW5kZXIgPSByZW5kZXJDb250ZW50O1xuXHRcdFx0dGFnQ3R4LmN2dEFyZ3MgPSBjb252ZXJ0QXJncztcblx0XHRcdHRhZ0N0eC5ibmRBcmdzID0gY29udmVydEJvdW5kQXJncztcblx0XHRcdHRhZ0N0eC52aWV3ID0gcGFyZW50Vmlldztcblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgoZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIHRhZ0RlZiAmJiB0YWdEZWYuY3R4KSwgY3R4KTsgLy8gQ2xvbmUgYW5kIGV4dGVuZCBwYXJlbnRWaWV3LmN0eFxuXHRcdH1cblx0XHRpZiAodG1wbCA9IHRhZ0N0eC5wcm9wcy50bXBsKSB7XG5cdFx0XHQvLyBJZiB0aGUgdG1wbCBwcm9wZXJ0eSBpcyBvdmVycmlkZGVuLCBzZXQgdGhlIHZhbHVlICh3aGVuIGluaXRpYWxpemluZywgb3IsIGluIGNhc2Ugb2YgYmluZGluZzogXnRtcGw9Li4uLCB3aGVuIHVwZGF0aW5nKVxuXHRcdFx0dGFnQ3R4LnRtcGwgPSBwYXJlbnRWaWV3Ll9nZXRUbXBsKHRtcGwpO1xuXHRcdFx0dGFnQ3R4LmNvbnRlbnQgPSB0YWdDdHguY29udGVudCB8fCB0YWdDdHgudG1wbDtcblx0XHR9XG5cblx0XHRpZiAoIXRhZykge1xuXHRcdFx0Ly8gVGhpcyB3aWxsIG9ubHkgYmUgaGl0IGZvciBpbml0aWFsIHRhZ0N0eCAobm90IGZvciB7e2Vsc2V9fSkgLSBpZiB0aGUgdGFnIGluc3RhbmNlIGRvZXMgbm90IGV4aXN0IHlldFxuXHRcdFx0Ly8gSWYgdGhlIHRhZyBoYXMgbm90IGFscmVhZHkgYmVlbiBpbnN0YW50aWF0ZWQsIHdlIHdpbGwgY3JlYXRlIGEgbmV3IGluc3RhbmNlLlxuXHRcdFx0Ly8gfnRhZyB3aWxsIGFjY2VzcyB0aGUgdGFnLCBldmVuIHdpdGhpbiB0aGUgcmVuZGVyaW5nIG9mIHRoZSB0ZW1wbGF0ZSBjb250ZW50IG9mIHRoaXMgdGFnLlxuXHRcdFx0Ly8gRnJvbSBjaGlsZC9kZXNjZW5kYW50IHRhZ3MsIGNhbiBhY2Nlc3MgdXNpbmcgfnRhZy5wYXJlbnQsIG9yIH5wYXJlbnRUYWdzLnRhZ05hbWVcblx0XHRcdHRhZyA9IG5ldyB0YWdEZWYuX2N0cigpO1xuXHRcdFx0Y2FsbEluaXQgPSAhIXRhZy5pbml0O1xuXG5cdFx0XHR0YWcucGFyZW50ID0gcGFyZW50VGFnID0gY3R4ICYmIGN0eC50YWc7XG5cdFx0XHR0YWcudGFnQ3R4cyA9IHRhZ0N0eHM7XG5cblx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdHRhZy5pbmxpbmUgPSBmYWxzZTtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHR9XG5cdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHRpZiAodGFnLl8uYm5kID0gYm91bmRUYWcgfHwgbGlua0N0eC5mbikge1xuXHRcdFx0XHQvLyBCb3VuZCBpZiB7Xnt0YWcuLi59fSBvciBkYXRhLWxpbms9XCJ7dGFnLi4ufVwiXG5cdFx0XHRcdHRhZy5fLnRocyA9IHRhZ0N0eC5wYXJhbXMucHJvcHNbXCJ0aGlzXCJdOyAvLyBUYWcgaGFzIGEgdGhpcz1leHByIGJpbmRpbmcsIHRvIGdldCBqYXZhc2NyaXB0IHJlZmVyZW5jZSB0byB0YWcgaW5zdGFuY2Vcblx0XHRcdFx0dGFnLl8ubHQgPSB0YWdDdHhzLmx0OyAvLyBJZiBhIGxhdGUgcGF0aCBAc29tZS5wYXRoIGhhcyBub3QgcmV0dXJuZWQgQHNvbWUgb2JqZWN0LCBtYXJrIHRhZyBhcyBsYXRlXG5cdFx0XHRcdHRhZy5fLmFyclZ3cyA9IHt9O1xuXHRcdFx0fSBlbHNlIGlmICh0YWcuZGF0YUJvdW5kT25seSkge1xuXHRcdFx0XHRlcnJvcih0YWdOYW1lICsgXCIgbXVzdCBiZSBkYXRhLWJvdW5kOlxcbntee1wiICsgdGFnTmFtZSArIFwifX1cIik7XG5cdFx0XHR9XG5cdFx0XHQvL1RPRE8gYmV0dGVyIHBlcmYgZm9yIGNoaWxkVGFncygpIC0ga2VlcCBjaGlsZCB0YWcudGFncyBhcnJheSwgKGFuZCByZW1vdmUgY2hpbGQsIHdoZW4gZGlzcG9zZWQpXG5cdFx0XHQvLyB0YWcudGFncyA9IFtdO1xuXHRcdH0gZWxzZSBpZiAobGlua0N0eCAmJiBsaW5rQ3R4LmZuLl9scikge1xuXHRcdFx0Y2FsbEluaXQgPSAhIXRhZy5pbml0O1xuXHRcdH1cblx0XHR0YWdEYXRhTWFwID0gdGFnLmRhdGFNYXA7XG5cblx0XHR0YWdDdHgudGFnID0gdGFnO1xuXHRcdGlmICh0YWdEYXRhTWFwICYmIHRhZ0N0eHMpIHtcblx0XHRcdHRhZ0N0eC5tYXAgPSB0YWdDdHhzW2ldLm1hcDsgLy8gQ29weSBvdmVyIHRoZSBjb21waWxlZCBtYXAgaW5zdGFuY2UgZnJvbSB0aGUgcHJldmlvdXMgdGFnQ3R4cyB0byB0aGUgcmVmcmVzaGVkIG9uZXNcblx0XHR9XG5cdFx0aWYgKCF0YWcuZmxvdykge1xuXHRcdFx0dGFnQ3R4Q3R4ID0gdGFnQ3R4LmN0eCA9IHRhZ0N0eC5jdHggfHwge307XG5cblx0XHRcdC8vIHRhZ3MgaGFzaDogdGFnLmN0eC50YWdzLCBtZXJnZWQgd2l0aCBwYXJlbnRWaWV3LmN0eC50YWdzLFxuXHRcdFx0dGFncyA9IHRhZy5wYXJlbnRzID0gdGFnQ3R4Q3R4LnBhcmVudFRhZ3MgPSBjdHggJiYgZXh0ZW5kQ3R4KHRhZ0N0eEN0eC5wYXJlbnRUYWdzLCBjdHgucGFyZW50VGFncykgfHwge307XG5cdFx0XHRpZiAocGFyZW50VGFnKSB7XG5cdFx0XHRcdHRhZ3NbcGFyZW50VGFnLnRhZ05hbWVdID0gcGFyZW50VGFnO1xuXHRcdFx0XHQvL1RPRE8gYmV0dGVyIHBlcmYgZm9yIGNoaWxkVGFnczogcGFyZW50VGFnLnRhZ3MucHVzaCh0YWcpO1xuXHRcdFx0fVxuXHRcdFx0dGFnc1t0YWcudGFnTmFtZV0gPSB0YWdDdHhDdHgudGFnID0gdGFnO1xuXHRcdFx0dGFnQ3R4Q3R4LnRhZ0N0eCA9IHRhZ0N0eDtcblx0XHR9XG5cdH1cblx0aWYgKCEodGFnLl9lciA9IG9uRXJyb3IpKSB7XG5cdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHhzWzBdKTtcblx0XHR0YWcucmVuZGVyaW5nID0ge3JuZHI6IHRhZy5yZW5kZXJpbmd9OyAvLyBQcm92aWRlIG9iamVjdCBmb3Igc3RhdGUgZHVyaW5nIHJlbmRlciBjYWxscyB0byB0YWcgYW5kIGVsc2VzLiAoVXNlZCBieSB7e2lmfX0gYW5kIHt7Zm9yfX0uLi4pXG5cdFx0Zm9yIChpID0gMDsgaSA8IGw7IGkrKykgeyAvLyBJdGVyYXRlIHRhZ0N0eCBmb3IgZWFjaCB7e2Vsc2V9fSBibG9ja1xuXHRcdFx0dGFnQ3R4ID0gdGFnLnRhZ0N0eCA9IHRhZ0N0eHNbaV07XG5cdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcztcblx0XHRcdHRhZy5jdHggPSB0YWdDdHguY3R4O1xuXG5cdFx0XHRpZiAoIWkpIHtcblx0XHRcdFx0aWYgKGNhbGxJbml0KSB7XG5cdFx0XHRcdFx0dGFnLmluaXQodGFnQ3R4LCBsaW5rQ3R4LCB0YWcuY3R4KTtcblx0XHRcdFx0XHRjYWxsSW5pdCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRhZ0N0eC5hcmdzLmxlbmd0aCAmJiB0YWdDdHguYXJnRGVmYXVsdCAhPT0gZmFsc2UgJiYgdGFnLmFyZ0RlZmF1bHQgIT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0dGFnQ3R4LmFyZ3MgPSBhcmdzID0gW3RhZ0N0eC52aWV3LmRhdGFdOyAvLyBNaXNzaW5nIGZpcnN0IGFyZyBkZWZhdWx0cyB0byB0aGUgY3VycmVudCBkYXRhIGNvbnRleHRcblx0XHRcdFx0XHR0YWdDdHgucGFyYW1zLmFyZ3MgPSBbXCIjZGF0YVwiXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJpbmRUbyA9IGJpbmRUb09yQmluZEZyb20oXCJiaW5kVG9cIik7XG5cblx0XHRcdFx0aWYgKHRhZy5iaW5kVG8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRhZy5iaW5kVG8gPSBiaW5kVG87XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGFnLmJpbmRGcm9tICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHR0YWcuYmluZEZyb20gPSBiaW5kVG9PckJpbmRGcm9tKFwiYmluZEZyb21cIik7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGFnLmJpbmRUbykge1xuXHRcdFx0XHRcdHRhZy5iaW5kRnJvbSA9IHRhZy5iaW5kVG8gPSBiaW5kVG87XG5cdFx0XHRcdH1cblx0XHRcdFx0YmluZEZyb20gPSB0YWcuYmluZEZyb20gfHwgYmluZFRvO1xuXG5cdFx0XHRcdGJpbmRUb0xlbmd0aCA9IGJpbmRUby5sZW5ndGg7XG5cdFx0XHRcdGJpbmRGcm9tTGVuZ3RoID0gYmluZEZyb20ubGVuZ3RoO1xuXG5cdFx0XHRcdGlmICh0YWcuXy5ibmQgJiYgKGxpbmtlZEVsZW1lbnQgPSB0YWcubGlua2VkRWxlbWVudCkpIHtcblx0XHRcdFx0XHR0YWcubGlua2VkRWxlbWVudCA9IGxpbmtlZEVsZW1lbnQgPSAkaXNBcnJheShsaW5rZWRFbGVtZW50KSA/IGxpbmtlZEVsZW1lbnQ6IFtsaW5rZWRFbGVtZW50XTtcblxuXHRcdFx0XHRcdGlmIChiaW5kVG9MZW5ndGggIT09IGxpbmtlZEVsZW1lbnQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRlcnJvcihcImxpbmtlZEVsZW1lbnQgbm90IHNhbWUgbGVuZ3RoIGFzIGJpbmRUb1wiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGxpbmtlZEVsZW1lbnQgPSB0YWcubGlua2VkQ3R4UGFyYW0pIHtcblx0XHRcdFx0XHR0YWcubGlua2VkQ3R4UGFyYW0gPSBsaW5rZWRFbGVtZW50ID0gJGlzQXJyYXkobGlua2VkRWxlbWVudCkgPyBsaW5rZWRFbGVtZW50OiBbbGlua2VkRWxlbWVudF07XG5cblx0XHRcdFx0XHRpZiAoYmluZEZyb21MZW5ndGggIT09IGxpbmtlZEVsZW1lbnQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRlcnJvcihcImxpbmtlZEN0eFBhcmFtIG5vdCBzYW1lIGxlbmd0aCBhcyBiaW5kRnJvbS9iaW5kVG9cIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGJpbmRGcm9tKSB7XG5cdFx0XHRcdFx0dGFnLl8uZnJvbUluZGV4ID0ge307IC8vIEhhc2ggb2YgYmluZEZyb20gaW5kZXggd2hpY2ggaGFzIHNhbWUgcGF0aCB2YWx1ZSBhcyBiaW5kVG8gaW5kZXguIGZyb21JbmRleCA9IHRhZy5fLmZyb21JbmRleFt0b0luZGV4XVxuXHRcdFx0XHRcdHRhZy5fLnRvSW5kZXggPSB7fTsgLy8gSGFzaCBvZiBiaW5kRnJvbSBpbmRleCB3aGljaCBoYXMgc2FtZSBwYXRoIHZhbHVlIGFzIGJpbmRUbyBpbmRleC4gZnJvbUluZGV4ID0gdGFnLl8uZnJvbUluZGV4W3RvSW5kZXhdXG5cdFx0XHRcdFx0biA9IGJpbmRGcm9tTGVuZ3RoO1xuXHRcdFx0XHRcdHdoaWxlIChuLS0pIHtcblx0XHRcdFx0XHRcdGtleSA9IGJpbmRGcm9tW25dO1xuXHRcdFx0XHRcdFx0bSA9IGJpbmRUb0xlbmd0aDtcblx0XHRcdFx0XHRcdHdoaWxlIChtLS0pIHtcblx0XHRcdFx0XHRcdFx0aWYgKGtleSA9PT0gYmluZFRvW21dKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGFnLl8uZnJvbUluZGV4W21dID0gbjtcblx0XHRcdFx0XHRcdFx0XHR0YWcuXy50b0luZGV4W25dID0gbTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdFx0Ly8gU2V0IGF0dHIgb24gbGlua0N0eCB0byBlbnN1cmUgb3V0cHV0dGluZyB0byB0aGUgY29ycmVjdCB0YXJnZXQgYXR0cmlidXRlLlxuXHRcdFx0XHRcdC8vIFNldHRpbmcgZWl0aGVyIGxpbmtDdHguYXR0ciBvciB0aGlzLmF0dHIgaW4gdGhlIGluaXQoKSBhbGxvd3MgcGVyLWluc3RhbmNlIGNob2ljZSBvZiB0YXJnZXQgYXR0cmliLlxuXHRcdFx0XHRcdGxpbmtDdHguYXR0ciA9IHRhZy5hdHRyID0gbGlua0N0eC5hdHRyIHx8IHRhZy5hdHRyIHx8IGxpbmtDdHguX2RmQXQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXR0ciA9IHRhZy5hdHRyO1xuXHRcdFx0XHR0YWcuXy5ub1Z3cyA9IGF0dHIgJiYgYXR0ciAhPT0gSFRNTDtcblx0XHRcdH1cblx0XHRcdGFyZ3MgPSB0YWcuY3Z0QXJncyhpKTtcblx0XHRcdGlmICh0YWcubGlua2VkQ3R4UGFyYW0pIHtcblx0XHRcdFx0YmRBcmdzID0gdGFnLmN2dEFyZ3MoaSwgMSk7XG5cdFx0XHRcdG0gPSBiaW5kRnJvbUxlbmd0aDtcblx0XHRcdFx0ZGVmYXVsdEN0eCA9IHRhZy5jb25zdHJ1Y3Rvci5wcm90b3R5cGUuY3R4O1xuXHRcdFx0XHR3aGlsZSAobS0tKSB7XG5cdFx0XHRcdFx0aWYgKGN0eFBybSA9IHRhZy5saW5rZWRDdHhQYXJhbVttXSkge1xuXHRcdFx0XHRcdFx0a2V5ID0gYmluZEZyb21bbV07XG5cdFx0XHRcdFx0XHRpbml0VmFsID0gYmRBcmdzW21dO1xuXHRcdFx0XHRcdFx0Ly8gQ3JlYXRlIHRhZyBjb250ZXh0dWFsIHBhcmFtZXRlclxuXHRcdFx0XHRcdFx0dGFnQ3R4LmN0eFtjdHhQcm1dID0gJHN1Yi5fY3AoXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHRDdHggJiYgaW5pdFZhbCA9PT0gdW5kZWZpbmVkID8gZGVmYXVsdEN0eFtjdHhQcm1dOiBpbml0VmFsLFxuXHRcdFx0XHRcdFx0XHRpbml0VmFsICE9PSB1bmRlZmluZWQgJiYgYXJnT3JQcm9wKHRhZ0N0eC5wYXJhbXMsIGtleSksXG5cdFx0XHRcdFx0XHRcdHRhZ0N0eC52aWV3LFxuXHRcdFx0XHRcdFx0XHR0YWcuXy5ibmQgJiYge3RhZzogdGFnLCBjdnQ6IHRhZy5jb252ZXJ0LCBpbmQ6IG0sIHRhZ0Vsc2U6IGl9XG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKChtYXBEZWYgPSBwcm9wcy5kYXRhTWFwIHx8IHRhZ0RhdGFNYXApICYmIChhcmdzLmxlbmd0aCB8fCBwcm9wcy5kYXRhTWFwKSkge1xuXHRcdFx0XHR0aGlzTWFwID0gdGFnQ3R4Lm1hcDtcblx0XHRcdFx0aWYgKCF0aGlzTWFwIHx8IHRoaXNNYXAuc3JjICE9PSBhcmdzWzBdIHx8IGlzVXBkYXRlKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXNNYXAgJiYgdGhpc01hcC5zcmMpIHtcblx0XHRcdFx0XHRcdHRoaXNNYXAudW5tYXAoKTsgLy8gb25seSBjYWxsZWQgaWYgb2JzZXJ2YWJsZSBtYXAgLSBub3Qgd2hlbiBvbmx5IHVzZWQgaW4gSnNSZW5kZXIsIGUuZy4gYnkge3twcm9wc319XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1hcERlZi5tYXAoYXJnc1swXSwgdGFnQ3R4LCB0aGlzTWFwLCAhdGFnLl8uYm5kKTtcblx0XHRcdFx0XHR0aGlzTWFwID0gdGFnQ3R4Lm1hcDtcblx0XHRcdFx0fVxuXHRcdFx0XHRhcmdzID0gW3RoaXNNYXAudGd0XTtcblx0XHRcdH1cblxuXHRcdFx0aXRlbVJldCA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0YWcucmVuZGVyKSB7XG5cdFx0XHRcdGl0ZW1SZXQgPSB0YWcucmVuZGVyLmFwcGx5KHRhZywgYXJncyk7XG5cdFx0XHRcdGlmIChwYXJlbnRWaWV3LmxpbmtlZCAmJiBpdGVtUmV0ICYmICFyV3JhcHBlZEluVmlld01hcmtlci50ZXN0KGl0ZW1SZXQpKSB7XG5cdFx0XHRcdFx0Ly8gV2hlbiBhIHRhZyByZW5kZXJzIGNvbnRlbnQgZnJvbSB0aGUgcmVuZGVyIG1ldGhvZCwgd2l0aCBkYXRhIGxpbmtpbmcgdGhlbiB3ZSBuZWVkIHRvIHdyYXAgd2l0aCB2aWV3IG1hcmtlcnMsIGlmIGFic2VudCxcblx0XHRcdFx0XHQvLyB0byBwcm92aWRlIGEgY29udGVudFZpZXcgZm9yIHRoZSB0YWcsIHdoaWNoIHdpbGwgY29ycmVjdGx5IGRpc3Bvc2UgYmluZGluZ3MgaWYgZGVsZXRlZC4gVGhlICd0bXBsJyBmb3IgdGhpcyB2aWV3IHdpbGxcblx0XHRcdFx0XHQvLyBiZSBhIGR1bWJlZC1kb3duIHRlbXBsYXRlIHdoaWNoIHdpbGwgYWx3YXlzIHJldHVybiB0aGUgaXRlbVJldCBzdHJpbmcgKG5vIG1hdHRlciB3aGF0IHRoZSBkYXRhIGlzKS4gVGhlIGl0ZW1SZXQgc3RyaW5nXG5cdFx0XHRcdFx0Ly8gaXMgbm90IGNvbXBpbGVkIGFzIHRlbXBsYXRlIG1hcmt1cCwgc28gY2FuIGluY2x1ZGUgXCJ7e1wiIG9yIFwifX1cIiB3aXRob3V0IHRyaWdnZXJpbmcgc3ludGF4IGVycm9yc1xuXHRcdFx0XHRcdHRtcGwgPSB7IC8vICdEdW1iZWQtZG93bicgdGVtcGxhdGUgd2hpY2ggYWx3YXlzIHJlbmRlcnMgJ3N0YXRpYycgaXRlbVJldCBzdHJpbmdcblx0XHRcdFx0XHRcdGxpbmtzOiBbXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dG1wbC5yZW5kZXIgPSB0bXBsLmZuID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXRlbVJldDtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGl0ZW1SZXQgPSByZW5kZXJXaXRoVmlld3ModG1wbCwgcGFyZW50Vmlldy5kYXRhLCB1bmRlZmluZWQsIHRydWUsIHBhcmVudFZpZXcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0YWcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWFyZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdGFyZ3MgPSBbcGFyZW50Vmlld107IC8vIG5vIGFyZ3VtZW50cyAtIChlLmcuIHt7ZWxzZX19KSBnZXQgZGF0YSBjb250ZXh0IGZyb20gdmlldy5cblx0XHRcdH1cblx0XHRcdGlmIChpdGVtUmV0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29udGVudEN0eCA9IGFyZ3NbMF07IC8vIERlZmF1bHQgZGF0YSBjb250ZXh0IGZvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaXMgdGhlIGZpcnN0IGFyZ3VtZW50XG5cdFx0XHRcdGlmICh0YWcuY29udGVudEN0eCkgeyAvLyBTZXQgdGFnLmNvbnRlbnRDdHggdG8gdHJ1ZSwgdG8gaW5oZXJpdCBwYXJlbnQgY29udGV4dCwgb3IgdG8gYSBmdW5jdGlvbiB0byBwcm92aWRlIGFsdGVybmF0ZSBjb250ZXh0LlxuXHRcdFx0XHRcdGNvbnRlbnRDdHggPSB0YWcuY29udGVudEN0eCA9PT0gdHJ1ZSA/IHBhcmVudFZpZXcgOiB0YWcuY29udGVudEN0eChjb250ZW50Q3R4KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpdGVtUmV0ID0gdGFnQ3R4LnJlbmRlcihjb250ZW50Q3R4LCB0cnVlKSB8fCAoaXNVcGRhdGUgPyB1bmRlZmluZWQgOiBcIlwiKTtcblx0XHRcdH1cblx0XHRcdHJldCA9IHJldFxuXHRcdFx0XHQ/IHJldCArIChpdGVtUmV0IHx8IFwiXCIpXG5cdFx0XHRcdDogaXRlbVJldCAhPT0gdW5kZWZpbmVkXG5cdFx0XHRcdFx0PyBcIlwiICsgaXRlbVJldFxuXHRcdFx0XHRcdDogdW5kZWZpbmVkOyAvLyBJZiBubyByZXR1cm4gdmFsdWUgZnJvbSByZW5kZXIsIGFuZCBubyB0ZW1wbGF0ZS9jb250ZW50IHRhZ0N0eC5yZW5kZXIoLi4uKSwgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdH1cblx0XHR0YWcucmVuZGVyaW5nID0gdGFnLnJlbmRlcmluZy5ybmRyOyAvLyBSZW1vdmUgdGFnLnJlbmRlcmluZyBvYmplY3QgKGlmIHRoaXMgaXMgb3V0ZXJtb3N0IHJlbmRlciBjYWxsLiAoSW4gY2FzZSBvZiBuZXN0ZWQgY2FsbHMpXG5cdH1cblx0dGFnLnRhZ0N0eCA9IHRhZ0N0eHNbMF07XG5cdHRhZy5jdHggPSB0YWcudGFnQ3R4LmN0eDtcblxuXHRpZiAodGFnLl8ubm9Wd3MgJiYgdGFnLmlubGluZSkge1xuXHRcdC8vIGlubGluZSB0YWcgd2l0aCBhdHRyIHNldCB0byBcInRleHRcIiB3aWxsIGluc2VydCBIVE1MLWVuY29kZWQgY29udGVudCAtIGFzIGlmIGl0IHdhcyBlbGVtZW50LWJhc2VkIGlubmVyVGV4dFxuXHRcdHJldCA9IGF0dHIgPT09IFwidGV4dFwiXG5cdFx0XHQ/ICRjb252ZXJ0ZXJzLmh0bWwocmV0KVxuXHRcdFx0OiBcIlwiO1xuXHR9XG5cdHJldHVybiBib3VuZFRhZyAmJiBwYXJlbnRWaWV3Ll8ub25SZW5kZXJcblx0XHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdFx0PyBwYXJlbnRWaWV3Ll8ub25SZW5kZXIocmV0LCBwYXJlbnRWaWV3LCB0YWcpXG5cdFx0OiByZXQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT1cbi8vIFZpZXcgY29uc3RydWN0b3Jcbi8vPT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gVmlldyhjb250ZXh0LCB0eXBlLCBwYXJlbnRWaWV3LCBkYXRhLCB0ZW1wbGF0ZSwga2V5LCBvblJlbmRlciwgY29udGVudFRtcGwpIHtcblx0Ly8gQ29uc3RydWN0b3IgZm9yIHZpZXcgb2JqZWN0IGluIHZpZXcgaGllcmFyY2h5LiAoQXVnbWVudGVkIGJ5IEpzVmlld3MgaWYgSnNWaWV3cyBpcyBsb2FkZWQpXG5cdHZhciB2aWV3cywgcGFyZW50Vmlld18sIHRhZywgc2VsZl8sXG5cdFx0c2VsZiA9IHRoaXMsXG5cdFx0aXNBcnJheSA9IHR5cGUgPT09IFwiYXJyYXlcIjtcblx0XHQvLyBJZiB0aGUgZGF0YSBpcyBhbiBhcnJheSwgdGhpcyBpcyBhbiAnYXJyYXkgdmlldycgd2l0aCBhIHZpZXdzIGFycmF5IGZvciBlYWNoIGNoaWxkICdpdGVtIHZpZXcnXG5cdFx0Ly8gSWYgdGhlIGRhdGEgaXMgbm90IGFuIGFycmF5LCB0aGlzIGlzIGFuICdpdGVtIHZpZXcnIHdpdGggYSB2aWV3cyAnaGFzaCcgb2JqZWN0IGZvciBhbnkgY2hpbGQgbmVzdGVkIHZpZXdzXG5cblx0c2VsZi5jb250ZW50ID0gY29udGVudFRtcGw7XG5cdHNlbGYudmlld3MgPSBpc0FycmF5ID8gW10gOiB7fTtcblx0c2VsZi5kYXRhID0gZGF0YTtcblx0c2VsZi50bXBsID0gdGVtcGxhdGU7XG5cdHNlbGZfID0gc2VsZi5fID0ge1xuXHRcdGtleTogMCxcblx0XHQvLyAuXy51c2VLZXkgaXMgbm9uIHplcm8gaWYgaXMgbm90IGFuICdhcnJheSB2aWV3JyAob3duaW5nIGEgZGF0YSBhcnJheSkuIFVzZSB0aGlzIGFzIG5leHQga2V5IGZvciBhZGRpbmcgdG8gY2hpbGQgdmlld3MgaGFzaFxuXHRcdHVzZUtleTogaXNBcnJheSA/IDAgOiAxLFxuXHRcdGlkOiBcIlwiICsgdmlld0lkKyssXG5cdFx0b25SZW5kZXI6IG9uUmVuZGVyLFxuXHRcdGJuZHM6IHt9XG5cdH07XG5cdHNlbGYubGlua2VkID0gISFvblJlbmRlcjtcblx0c2VsZi50eXBlID0gdHlwZSB8fCBcInRvcFwiO1xuXHRpZiAodHlwZSkge1xuXHRcdHNlbGYuY2FjaGUgPSB7X2N0OiAkc3ViU2V0dGluZ3MuX2NjaEN0fTsgLy8gVXNlZCBmb3IgY2FjaGluZyByZXN1bHRzIG9mIGNvbXB1dGVkIHByb3BlcnRpZXMgYW5kIGhlbHBlcnMgKHZpZXcuZ2V0Q2FjaGUpXG5cdH1cblxuXHRpZiAoIXBhcmVudFZpZXcgfHwgcGFyZW50Vmlldy50eXBlID09PSBcInRvcFwiKSB7XG5cdFx0KHNlbGYuY3R4ID0gY29udGV4dCB8fCB7fSkucm9vdCA9IHNlbGYuZGF0YTtcblx0fVxuXG5cdGlmIChzZWxmLnBhcmVudCA9IHBhcmVudFZpZXcpIHtcblx0XHRzZWxmLnJvb3QgPSBwYXJlbnRWaWV3LnJvb3QgfHwgc2VsZjsgLy8gdmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXdcblx0XHR2aWV3cyA9IHBhcmVudFZpZXcudmlld3M7XG5cdFx0cGFyZW50Vmlld18gPSBwYXJlbnRWaWV3Ll87XG5cdFx0c2VsZi5pc1RvcCA9IHBhcmVudFZpZXdfLnNjcDsgLy8gSXMgdG9wIGNvbnRlbnQgdmlldyBvZiBhIGxpbmsoXCIjY29udGFpbmVyXCIsIC4uLikgY2FsbFxuXHRcdHNlbGYuc2NvcGUgPSAoIWNvbnRleHQudGFnIHx8IGNvbnRleHQudGFnID09PSBwYXJlbnRWaWV3LmN0eC50YWcpICYmICFzZWxmLmlzVG9wICYmIHBhcmVudFZpZXcuc2NvcGUgfHwgc2VsZjtcblx0XHQvLyBTY29wZSBmb3IgY29udGV4dFBhcmFtcyAtIGNsb3Nlc3Qgbm9uIGZsb3cgdGFnIGFuY2VzdG9yIG9yIHJvb3Qgdmlld1xuXHRcdGlmIChwYXJlbnRWaWV3Xy51c2VLZXkpIHtcblx0XHRcdC8vIFBhcmVudCBpcyBub3QgYW4gJ2FycmF5IHZpZXcnLiBBZGQgdGhpcyB2aWV3IHRvIGl0cyB2aWV3cyBvYmplY3Rcblx0XHRcdC8vIHNlbGYuX2tleSA9IGlzIHRoZSBrZXkgaW4gdGhlIHBhcmVudCB2aWV3IGhhc2hcblx0XHRcdHZpZXdzW3NlbGZfLmtleSA9IFwiX1wiICsgcGFyZW50Vmlld18udXNlS2V5KytdID0gc2VsZjtcblx0XHRcdHNlbGYuaW5kZXggPSBpbmRleFN0cjtcblx0XHRcdHNlbGYuZ2V0SW5kZXggPSBnZXROZXN0ZWRJbmRleDtcblx0XHR9IGVsc2UgaWYgKHZpZXdzLmxlbmd0aCA9PT0gKHNlbGZfLmtleSA9IHNlbGYuaW5kZXggPSBrZXkpKSB7IC8vIFBhcmVudCBpcyBhbiAnYXJyYXkgdmlldycuIEFkZCB0aGlzIHZpZXcgdG8gaXRzIHZpZXdzIGFycmF5XG5cdFx0XHR2aWV3cy5wdXNoKHNlbGYpOyAvLyBBZGRpbmcgdG8gZW5kIG9mIHZpZXdzIGFycmF5LiAoVXNpbmcgcHVzaCB3aGVuIHBvc3NpYmxlIC0gYmV0dGVyIHBlcmYgdGhhbiBzcGxpY2UpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHZpZXdzLnNwbGljZShrZXksIDAsIHNlbGYpOyAvLyBJbnNlcnRpbmcgaW4gdmlld3MgYXJyYXlcblx0XHR9XG5cdFx0Ly8gSWYgbm8gY29udGV4dCB3YXMgcGFzc2VkIGluLCB1c2UgcGFyZW50IGNvbnRleHRcblx0XHQvLyBJZiBjb250ZXh0IHdhcyBwYXNzZWQgaW4sIGl0IHNob3VsZCBoYXZlIGJlZW4gbWVyZ2VkIGFscmVhZHkgd2l0aCBwYXJlbnQgY29udGV4dFxuXHRcdHNlbGYuY3R4ID0gY29udGV4dCB8fCBwYXJlbnRWaWV3LmN0eDtcblx0fSBlbHNlIGlmICh0eXBlKSB7XG5cdFx0c2VsZi5yb290ID0gc2VsZjsgLy8gdmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXdcblx0fVxufVxuXG5WaWV3LnByb3RvdHlwZSA9IHtcblx0Z2V0OiBnZXRWaWV3LFxuXHRnZXRJbmRleDogZ2V0SW5kZXgsXG5cdGN0eFBybTogY29udGV4dFBhcmFtZXRlcixcblx0Z2V0UnNjOiBnZXRSZXNvdXJjZSxcblx0X2dldFRtcGw6IGdldFRlbXBsYXRlLFxuXHRfZ2V0T2I6IGdldFBhdGhPYmplY3QsXG5cdGdldENhY2hlOiBmdW5jdGlvbihrZXkpIHsgLy8gR2V0IGNhY2hlZCB2YWx1ZSBvZiBjb21wdXRlZCB2YWx1ZVxuXHRcdGlmICgkc3ViU2V0dGluZ3MuX2NjaEN0ID4gdGhpcy5jYWNoZS5fY3QpIHtcblx0XHRcdHRoaXMuY2FjaGUgPSB7X2N0OiAkc3ViU2V0dGluZ3MuX2NjaEN0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuY2FjaGVba2V5XSAhPT0gdW5kZWZpbmVkID8gdGhpcy5jYWNoZVtrZXldIDogKHRoaXMuY2FjaGVba2V5XSA9IGNwRm5TdG9yZVtrZXldKHRoaXMuZGF0YSwgdGhpcywgJHN1YikpO1xuXHR9LFxuXHRfaXM6IFwidmlld1wiXG59O1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFJlZ2lzdHJhdGlvblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVDaGlsZFJlc291cmNlcyhwYXJlbnRUbXBsKSB7XG5cdHZhciBzdG9yZU5hbWUsIHN0b3JlTmFtZXMsIHJlc291cmNlcztcblx0Zm9yIChzdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0c3RvcmVOYW1lcyA9IHN0b3JlTmFtZSArIFwic1wiO1xuXHRcdGlmIChwYXJlbnRUbXBsW3N0b3JlTmFtZXNdKSB7XG5cdFx0XHRyZXNvdXJjZXMgPSBwYXJlbnRUbXBsW3N0b3JlTmFtZXNdOyAgICAgICAgLy8gUmVzb3VyY2VzIG5vdCB5ZXQgY29tcGlsZWRcblx0XHRcdHBhcmVudFRtcGxbc3RvcmVOYW1lc10gPSB7fTsgICAgICAgICAgICAgICAvLyBSZW1vdmUgdW5jb21waWxlZCByZXNvdXJjZXNcblx0XHRcdCR2aWV3c1tzdG9yZU5hbWVzXShyZXNvdXJjZXMsIHBhcmVudFRtcGwpOyAvLyBBZGQgYmFjayBpbiB0aGUgY29tcGlsZWQgcmVzb3VyY2VzXG5cdFx0fVxuXHR9XG59XG5cbi8vPT09PT09PT09PT09PT09XG4vLyBjb21waWxlVGFnXG4vLz09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb21waWxlVGFnKG5hbWUsIHRhZ0RlZiwgcGFyZW50VG1wbCkge1xuXHR2YXIgdG1wbCwgYmFzZVRhZywgcHJvcCxcblx0XHRjb21waWxlZERlZiA9IG5ldyAkc3ViLl90ZygpO1xuXG5cdGZ1bmN0aW9uIFRhZygpIHtcblx0XHR2YXIgdGFnID0gdGhpcztcblx0XHR0YWcuXyA9IHtcblx0XHRcdHVubGlua2VkOiB0cnVlXG5cdFx0fTtcblx0XHR0YWcuaW5saW5lID0gdHJ1ZTtcblx0XHR0YWcudGFnTmFtZSA9IG5hbWU7XG5cdH1cblxuXHRpZiAoJGlzRnVuY3Rpb24odGFnRGVmKSkge1xuXHRcdC8vIFNpbXBsZSB0YWcgZGVjbGFyZWQgYXMgZnVuY3Rpb24uIE5vIHByZXNlbnRlciBpbnN0YW50YXRpb24uXG5cdFx0dGFnRGVmID0ge1xuXHRcdFx0ZGVwZW5kczogdGFnRGVmLmRlcGVuZHMsXG5cdFx0XHRyZW5kZXI6IHRhZ0RlZlxuXHRcdH07XG5cdH0gZWxzZSBpZiAodHlwZW9mIHRhZ0RlZiA9PT0gU1RSSU5HKSB7XG5cdFx0dGFnRGVmID0ge3RlbXBsYXRlOiB0YWdEZWZ9O1xuXHR9XG5cblx0aWYgKGJhc2VUYWcgPSB0YWdEZWYuYmFzZVRhZykge1xuXHRcdHRhZ0RlZi5mbG93ID0gISF0YWdEZWYuZmxvdzsgLy8gU2V0IGZsb3cgcHJvcGVydHksIHNvIGRlZmF1bHRzIHRvIGZhbHNlIGV2ZW4gaWYgYmFzZVRhZyBoYXMgZmxvdz10cnVlXG5cdFx0YmFzZVRhZyA9IHR5cGVvZiBiYXNlVGFnID09PSBTVFJJTkdcblx0XHRcdD8gKHBhcmVudFRtcGwgJiYgcGFyZW50VG1wbC50YWdzW2Jhc2VUYWddIHx8ICR0YWdzW2Jhc2VUYWddKVxuXHRcdFx0OiBiYXNlVGFnO1xuXHRcdGlmICghYmFzZVRhZykge1xuXHRcdFx0ZXJyb3IoJ2Jhc2VUYWc6IFwiJyArIHRhZ0RlZi5iYXNlVGFnICsgJ1wiIG5vdCBmb3VuZCcpO1xuXHRcdH1cblx0XHRjb21waWxlZERlZiA9ICRleHRlbmQoY29tcGlsZWREZWYsIGJhc2VUYWcpO1xuXG5cdFx0Zm9yIChwcm9wIGluIHRhZ0RlZikge1xuXHRcdFx0Y29tcGlsZWREZWZbcHJvcF0gPSBnZXRNZXRob2QoYmFzZVRhZ1twcm9wXSwgdGFnRGVmW3Byb3BdKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Y29tcGlsZWREZWYgPSAkZXh0ZW5kKGNvbXBpbGVkRGVmLCB0YWdEZWYpO1xuXHR9XG5cblx0Ly8gVGFnIGRlY2xhcmVkIGFzIG9iamVjdCwgdXNlZCBhcyB0aGUgcHJvdG90eXBlIGZvciB0YWcgaW5zdGFudGlhdGlvbiAoY29udHJvbC9wcmVzZW50ZXIpXG5cdGlmICgodG1wbCA9IGNvbXBpbGVkRGVmLnRlbXBsYXRlKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29tcGlsZWREZWYudGVtcGxhdGUgPSB0eXBlb2YgdG1wbCA9PT0gU1RSSU5HID8gKCR0ZW1wbGF0ZXNbdG1wbF0gfHwgJHRlbXBsYXRlcyh0bXBsKSkgOiB0bXBsO1xuXHR9XG5cdChUYWcucHJvdG90eXBlID0gY29tcGlsZWREZWYpLmNvbnN0cnVjdG9yID0gY29tcGlsZWREZWYuX2N0ciA9IFRhZztcblxuXHRpZiAocGFyZW50VG1wbCkge1xuXHRcdGNvbXBpbGVkRGVmLl9wYXJlbnRUbXBsID0gcGFyZW50VG1wbDtcblx0fVxuXHRyZXR1cm4gY29tcGlsZWREZWY7XG59XG5cbmZ1bmN0aW9uIGJhc2VBcHBseShhcmdzKSB7XG5cdC8vIEluIGRlcml2ZWQgbWV0aG9kIChvciBoYW5kbGVyIGRlY2xhcmVkIGRlY2xhcmF0aXZlbHkgYXMgaW4ge3s6Zm9vIG9uQ2hhbmdlPX5mb29DaGFuZ2VkfX0gY2FuIGNhbGwgYmFzZSBtZXRob2QsXG5cdC8vIHVzaW5nIHRoaXMuYmFzZUFwcGx5KGFyZ3VtZW50cykgKEVxdWl2YWxlbnQgdG8gdGhpcy5fc3VwZXJBcHBseShhcmd1bWVudHMpIGluIGpRdWVyeSBVSSlcblx0cmV0dXJuIHRoaXMuYmFzZS5hcHBseSh0aGlzLCBhcmdzKTtcbn1cblxuLy89PT09PT09PT09PT09PT1cbi8vIGNvbXBpbGVUbXBsXG4vLz09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb21waWxlVG1wbChuYW1lLCB0bXBsLCBwYXJlbnRUbXBsLCBvcHRpb25zKSB7XG5cdC8vIHRtcGwgaXMgZWl0aGVyIGEgdGVtcGxhdGUgb2JqZWN0LCBhIHNlbGVjdG9yIGZvciBhIHRlbXBsYXRlIHNjcmlwdCBibG9jaywgb3IgdGhlIG5hbWUgb2YgYSBjb21waWxlZCB0ZW1wbGF0ZVxuXG5cdC8vPT09PSBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblx0ZnVuY3Rpb24gbG9va3VwVGVtcGxhdGUodmFsdWUpIHtcblx0XHQvLyBJZiB2YWx1ZSBpcyBvZiB0eXBlIHN0cmluZyAtIHRyZWF0IGFzIHNlbGVjdG9yLCBvciBuYW1lIG9mIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0Ly8gUmV0dXJuIHRoZSB0ZW1wbGF0ZSBvYmplY3QsIGlmIGFscmVhZHkgY29tcGlsZWQsIG9yIHRoZSBtYXJrdXAgc3RyaW5nXG5cdFx0dmFyIGN1cnJlbnROYW1lLCB0bXBsO1xuXHRcdGlmICgodHlwZW9mIHZhbHVlID09PSBTVFJJTkcpIHx8IHZhbHVlLm5vZGVUeXBlID4gMCAmJiAoZWxlbSA9IHZhbHVlKSkge1xuXHRcdFx0aWYgKCFlbGVtKSB7XG5cdFx0XHRcdGlmICgvXlxcLj9cXC9bXlxcXFw6Kj9cIjw+XSokLy50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHZhbHVlPVwiLi9zb21lL2ZpbGUuaHRtbFwiIChvciBcIi9zb21lL2ZpbGUuaHRtbFwiKVxuXHRcdFx0XHRcdC8vIElmIHRoZSB0ZW1wbGF0ZSBpcyBub3QgbmFtZWQsIHVzZSBcIi4vc29tZS9maWxlLmh0bWxcIiBhcyBuYW1lLlxuXHRcdFx0XHRcdGlmICh0bXBsID0gJHRlbXBsYXRlc1tuYW1lID0gbmFtZSB8fCB2YWx1ZV0pIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gdG1wbDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gQlJPV1NFUi1TUEVDSUZJQyBDT0RFIChub3Qgb24gTm9kZS5qcyk6XG5cdFx0XHRcdFx0XHQvLyBMb29rIGZvciBzZXJ2ZXItZ2VuZXJhdGVkIHNjcmlwdCBibG9jayB3aXRoIGlkIFwiLi9zb21lL2ZpbGUuaHRtbFwiXG5cdFx0XHRcdFx0XHRlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZS5jaGFyQXQoMCkgPT09IFwiI1wiKSB7XG5cdFx0XHRcdFx0ZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHZhbHVlLnNsaWNlKDEpKTtcblx0XHRcdFx0fSBpZiAoIWVsZW0gJiYgJC5mbiAmJiAhJHN1Yi5yVG1wbC50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRlbGVtID0gJCh2YWx1ZSwgZG9jdW1lbnQpWzBdOyAvLyBpZiBqUXVlcnkgaXMgbG9hZGVkLCB0ZXN0IGZvciBzZWxlY3RvciByZXR1cm5pbmcgZWxlbWVudHMsIGFuZCBnZXQgZmlyc3QgZWxlbWVudFxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHt9XG5cdFx0XHRcdH0vLyBFTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHR9IC8vQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHRpZiAoZWxlbSkge1xuXHRcdFx0XHRpZiAoZWxlbS50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG5cdFx0XHRcdFx0ZXJyb3IodmFsdWUgKyBcIjogVXNlIHNjcmlwdCBibG9jaywgbm90IFwiICsgZWxlbS50YWdOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0XHRcdC8vIFdlIHdpbGwgY29tcGlsZSBhIG5ldyB0ZW1wbGF0ZSB1c2luZyB0aGUgbWFya3VwIGluIHRoZSBzY3JpcHQgZWxlbWVudFxuXHRcdFx0XHRcdHZhbHVlID0gZWxlbS5pbm5lckhUTUw7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gV2Ugd2lsbCBjYWNoZSBhIHNpbmdsZSBjb3B5IG9mIHRoZSBjb21waWxlZCB0ZW1wbGF0ZSwgYW5kIGFzc29jaWF0ZSBpdCB3aXRoIHRoZSBuYW1lXG5cdFx0XHRcdFx0Ly8gKHJlbmFtaW5nIGZyb20gYSBwcmV2aW91cyBuYW1lIGlmIHRoZXJlIHdhcyBvbmUpLlxuXHRcdFx0XHRcdGN1cnJlbnROYW1lID0gZWxlbS5nZXRBdHRyaWJ1dGUodG1wbEF0dHIpO1xuXHRcdFx0XHRcdGlmIChjdXJyZW50TmFtZSkge1xuXHRcdFx0XHRcdFx0aWYgKGN1cnJlbnROYW1lICE9PSBqc3ZUbXBsKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gJHRlbXBsYXRlc1tjdXJyZW50TmFtZV07XG5cdFx0XHRcdFx0XHRcdGRlbGV0ZSAkdGVtcGxhdGVzW2N1cnJlbnROYW1lXTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoJC5mbikge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9ICQuZGF0YShlbGVtKVtqc3ZUbXBsXTsgLy8gR2V0IGNhY2hlZCBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIWN1cnJlbnROYW1lIHx8ICF2YWx1ZSkgeyAvLyBOb3QgeWV0IGNvbXBpbGVkLCBvciBjYWNoZWQgdmVyc2lvbiBsb3N0XG5cdFx0XHRcdFx0XHRuYW1lID0gbmFtZSB8fCAoJC5mbiA/IGpzdlRtcGwgOiB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGNvbXBpbGVUbXBsKG5hbWUsIGVsZW0uaW5uZXJIVE1MLCBwYXJlbnRUbXBsLCBvcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dmFsdWUudG1wbE5hbWUgPSBuYW1lID0gbmFtZSB8fCBjdXJyZW50TmFtZTtcblx0XHRcdFx0XHRpZiAobmFtZSAhPT0ganN2VG1wbCkge1xuXHRcdFx0XHRcdFx0JHRlbXBsYXRlc1tuYW1lXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbGVtLnNldEF0dHJpYnV0ZSh0bXBsQXR0ciwgbmFtZSk7XG5cdFx0XHRcdFx0aWYgKCQuZm4pIHtcblx0XHRcdFx0XHRcdCQuZGF0YShlbGVtLCBqc3ZUbXBsLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IC8vIEVORCBCUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdGVsZW0gPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIGlmICghdmFsdWUuZm4pIHtcblx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0Ly8gSWYgdmFsdWUgaXMgbm90IGEgc3RyaW5nLiBIVE1MIGVsZW1lbnQsIG9yIGNvbXBpbGVkIHRlbXBsYXRlLCByZXR1cm4gdW5kZWZpbmVkXG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdHZhciBlbGVtLCBjb21waWxlZFRtcGwsXG5cdFx0dG1wbE9yTWFya3VwID0gdG1wbCA9IHRtcGwgfHwgXCJcIjtcblx0JHN1Yi5faHRtbCA9ICRjb252ZXJ0ZXJzLmh0bWw7XG5cblx0Ly89PT09IENvbXBpbGUgdGhlIHRlbXBsYXRlID09PT1cblx0aWYgKG9wdGlvbnMgPT09IDApIHtcblx0XHRvcHRpb25zID0gdW5kZWZpbmVkO1xuXHRcdHRtcGxPck1hcmt1cCA9IGxvb2t1cFRlbXBsYXRlKHRtcGxPck1hcmt1cCk7IC8vIFRvcC1sZXZlbCBjb21waWxlIHNvIGRvIGEgdGVtcGxhdGUgbG9va3VwXG5cdH1cblxuXHQvLyBJZiBvcHRpb25zLCB0aGVuIHRoaXMgd2FzIGFscmVhZHkgY29tcGlsZWQgZnJvbSBhIChzY3JpcHQpIGVsZW1lbnQgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG5cdC8vIElmIG5vdCwgdGhlbiBpZiB0bXBsIGlzIGEgdGVtcGxhdGUgb2JqZWN0LCB1c2UgaXQgZm9yIG9wdGlvbnNcblx0b3B0aW9ucyA9IG9wdGlvbnMgfHwgKHRtcGwubWFya3VwXG5cdFx0PyB0bXBsLmJuZHNcblx0XHRcdD8gJGV4dGVuZCh7fSwgdG1wbClcblx0XHRcdDogdG1wbFxuXHRcdDoge31cblx0KTtcblxuXHRvcHRpb25zLnRtcGxOYW1lID0gb3B0aW9ucy50bXBsTmFtZSB8fCBuYW1lIHx8IFwidW5uYW1lZFwiO1xuXHRpZiAocGFyZW50VG1wbCkge1xuXHRcdG9wdGlvbnMuX3BhcmVudFRtcGwgPSBwYXJlbnRUbXBsO1xuXHR9XG5cdC8vIElmIHRtcGwgaXMgbm90IGEgbWFya3VwIHN0cmluZyBvciBhIHNlbGVjdG9yIHN0cmluZywgdGhlbiBpdCBtdXN0IGJlIGEgdGVtcGxhdGUgb2JqZWN0XG5cdC8vIEluIHRoYXQgY2FzZSwgZ2V0IGl0IGZyb20gdGhlIG1hcmt1cCBwcm9wZXJ0eSBvZiB0aGUgb2JqZWN0XG5cdGlmICghdG1wbE9yTWFya3VwICYmIHRtcGwubWFya3VwICYmICh0bXBsT3JNYXJrdXAgPSBsb29rdXBUZW1wbGF0ZSh0bXBsLm1hcmt1cCkpICYmIHRtcGxPck1hcmt1cC5mbikge1xuXHRcdC8vIElmIHRoZSBzdHJpbmcgcmVmZXJlbmNlcyBhIGNvbXBpbGVkIHRlbXBsYXRlIG9iamVjdCwgbmVlZCB0byByZWNvbXBpbGUgdG8gbWVyZ2UgYW55IG1vZGlmaWVkIG9wdGlvbnNcblx0XHR0bXBsT3JNYXJrdXAgPSB0bXBsT3JNYXJrdXAubWFya3VwO1xuXHR9XG5cdGlmICh0bXBsT3JNYXJrdXAgIT09IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0bXBsT3JNYXJrdXAucmVuZGVyIHx8IHRtcGwucmVuZGVyKSB7XG5cdFx0XHQvLyB0bXBsIGlzIGFscmVhZHkgY29tcGlsZWQsIHNvIHVzZSBpdFxuXHRcdFx0aWYgKHRtcGxPck1hcmt1cC50bXBscykge1xuXHRcdFx0XHRjb21waWxlZFRtcGwgPSB0bXBsT3JNYXJrdXA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRtcGxPck1hcmt1cCBpcyBhIG1hcmt1cCBzdHJpbmcsIG5vdCBhIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHQvLyBDcmVhdGUgdGVtcGxhdGUgb2JqZWN0XG5cdFx0XHR0bXBsID0gdG1wbE9iamVjdCh0bXBsT3JNYXJrdXAsIG9wdGlvbnMpO1xuXHRcdFx0Ly8gQ29tcGlsZSB0byBBU1QgYW5kIHRoZW4gdG8gY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdHRtcGxGbih0bXBsT3JNYXJrdXAucmVwbGFjZShyRXNjYXBlUXVvdGVzLCBcIlxcXFwkJlwiKSwgdG1wbCk7XG5cdFx0fVxuXHRcdGlmICghY29tcGlsZWRUbXBsKSB7XG5cdFx0XHRjb21waWxlZFRtcGwgPSAkZXh0ZW5kKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGlsZWRUbXBsLnJlbmRlci5hcHBseShjb21waWxlZFRtcGwsIGFyZ3VtZW50cyk7XG5cdFx0XHR9LCB0bXBsKTtcblxuXHRcdFx0Y29tcGlsZUNoaWxkUmVzb3VyY2VzKGNvbXBpbGVkVG1wbCk7XG5cdFx0fVxuXHRcdHJldHVybiBjb21waWxlZFRtcGw7XG5cdH1cbn1cblxuLy89PT09IC9lbmQgb2YgZnVuY3Rpb24gY29tcGlsZVRtcGwgPT09PVxuXG4vLz09PT09PT09PT09PT09PT09XG4vLyBjb21waWxlVmlld01vZGVsXG4vLz09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRWYWwoZGVmYXVsdFZhbCwgZGF0YSkge1xuXHRyZXR1cm4gJGlzRnVuY3Rpb24oZGVmYXVsdFZhbClcblx0XHQ/IGRlZmF1bHRWYWwuY2FsbChkYXRhKVxuXHRcdDogZGVmYXVsdFZhbDtcbn1cblxuZnVuY3Rpb24gYWRkUGFyZW50UmVmKG9iLCByZWYsIHBhcmVudCkge1xuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkob2IsIHJlZiwge1xuXHRcdHZhbHVlOiBwYXJlbnQsXG5cdFx0Y29uZmlndXJhYmxlOiB0cnVlXG5cdH0pO1xufVxuXG5mdW5jdGlvbiBjb21waWxlVmlld01vZGVsKG5hbWUsIHR5cGUpIHtcblx0dmFyIGksIGNvbnN0cnVjdG9yLCBwYXJlbnQsXG5cdFx0dmlld01vZGVscyA9IHRoaXMsXG5cdFx0Z2V0dGVycyA9IHR5cGUuZ2V0dGVycyxcblx0XHRleHRlbmQgPSB0eXBlLmV4dGVuZCxcblx0XHRpZCA9IHR5cGUuaWQsXG5cdFx0cHJvdG8gPSAkLmV4dGVuZCh7XG5cdFx0XHRfaXM6IG5hbWUgfHwgXCJ1bm5hbWVkXCIsXG5cdFx0XHR1bm1hcDogdW5tYXAsXG5cdFx0XHRtZXJnZTogbWVyZ2Vcblx0XHR9LCBleHRlbmQpLFxuXHRcdGFyZ3MgPSBcIlwiLFxuXHRcdGNuc3RyID0gXCJcIixcblx0XHRnZXR0ZXJDb3VudCA9IGdldHRlcnMgPyBnZXR0ZXJzLmxlbmd0aCA6IDAsXG5cdFx0JG9ic2VydmFibGUgPSAkLm9ic2VydmFibGUsXG5cdFx0Z2V0dGVyTmFtZXMgPSB7fTtcblxuXHRmdW5jdGlvbiBKc3ZWbShhcmdzKSB7XG5cdFx0Y29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJncyk7XG5cdH1cblxuXHRmdW5jdGlvbiB2bSgpIHtcblx0XHRyZXR1cm4gbmV3IEpzdlZtKGFyZ3VtZW50cyk7XG5cdH1cblxuXHRmdW5jdGlvbiBpdGVyYXRlKGRhdGEsIGFjdGlvbikge1xuXHRcdHZhciBnZXR0ZXJUeXBlLCBkZWZhdWx0VmFsLCBwcm9wLCBvYiwgcGFyZW50UmVmLFxuXHRcdFx0aiA9IDA7XG5cdFx0Zm9yICg7IGogPCBnZXR0ZXJDb3VudDsgaisrKSB7XG5cdFx0XHRwcm9wID0gZ2V0dGVyc1tqXTtcblx0XHRcdGdldHRlclR5cGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodHlwZW9mIHByb3AgIT09IFNUUklORykge1xuXHRcdFx0XHRnZXR0ZXJUeXBlID0gcHJvcDtcblx0XHRcdFx0cHJvcCA9IGdldHRlclR5cGUuZ2V0dGVyO1xuXHRcdFx0XHRwYXJlbnRSZWYgPSBnZXR0ZXJUeXBlLnBhcmVudFJlZjtcblx0XHRcdH1cblx0XHRcdGlmICgob2IgPSBkYXRhW3Byb3BdKSA9PT0gdW5kZWZpbmVkICYmIGdldHRlclR5cGUgJiYgKGRlZmF1bHRWYWwgPSBnZXR0ZXJUeXBlLmRlZmF1bHRWYWwpICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0b2IgPSBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0YWN0aW9uKG9iLCBnZXR0ZXJUeXBlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXSwgcHJvcCwgcGFyZW50UmVmKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBtYXAoZGF0YSkge1xuXHRcdGRhdGEgPSB0eXBlb2YgZGF0YSA9PT0gU1RSSU5HXG5cdFx0XHQ/IEpTT04ucGFyc2UoZGF0YSkgLy8gQWNjZXB0IEpTT04gc3RyaW5nXG5cdFx0XHQ6IGRhdGE7ICAgICAgICAgICAgLy8gb3Igb2JqZWN0L2FycmF5XG5cdFx0dmFyIGwsIHByb3AsIGNoaWxkT2IsIHBhcmVudFJlZixcblx0XHRcdGogPSAwLFxuXHRcdFx0b2IgPSBkYXRhLFxuXHRcdFx0YXJyID0gW107XG5cblx0XHRpZiAoJGlzQXJyYXkoZGF0YSkpIHtcblx0XHRcdGRhdGEgPSBkYXRhIHx8IFtdO1xuXHRcdFx0bCA9IGRhdGEubGVuZ3RoO1xuXHRcdFx0Zm9yICg7IGo8bDsgaisrKSB7XG5cdFx0XHRcdGFyci5wdXNoKHRoaXMubWFwKGRhdGFbal0pKTtcblx0XHRcdH1cblx0XHRcdGFyci5faXMgPSBuYW1lO1xuXHRcdFx0YXJyLnVubWFwID0gdW5tYXA7XG5cdFx0XHRhcnIubWVyZ2UgPSBtZXJnZTtcblx0XHRcdHJldHVybiBhcnI7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGl0ZXJhdGUoZGF0YSwgZnVuY3Rpb24ob2IsIHZpZXdNb2RlbCkge1xuXHRcdFx0XHRpZiAodmlld01vZGVsKSB7IC8vIEl0ZXJhdGUgdG8gYnVpbGQgZ2V0dGVycyBhcmcgYXJyYXkgKHZhbHVlLCBvciBtYXBwZWQgdmFsdWUpXG5cdFx0XHRcdFx0b2IgPSB2aWV3TW9kZWwubWFwKG9iKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhcnIucHVzaChvYik7XG5cdFx0XHR9KTtcblx0XHRcdG9iID0gdGhpcy5hcHBseSh0aGlzLCBhcnIpOyAvLyBJbnN0YW50aWF0ZSB0aGlzIFZpZXcgTW9kZWwsIHBhc3NpbmcgZ2V0dGVycyBhcmdzIGFycmF5IHRvIGNvbnN0cnVjdG9yXG5cdFx0XHRqID0gZ2V0dGVyQ291bnQ7XG5cdFx0XHR3aGlsZSAoai0tKSB7XG5cdFx0XHRcdGNoaWxkT2IgPSBhcnJbal07XG5cdFx0XHRcdHBhcmVudFJlZiA9IGdldHRlcnNbal0ucGFyZW50UmVmO1xuXHRcdFx0XHRpZiAocGFyZW50UmVmICYmIGNoaWxkT2IgJiYgY2hpbGRPYi51bm1hcCkge1xuXHRcdFx0XHRcdGlmICgkaXNBcnJheShjaGlsZE9iKSkge1xuXHRcdFx0XHRcdFx0bCA9IGNoaWxkT2IubGVuZ3RoO1xuXHRcdFx0XHRcdFx0d2hpbGUgKGwtLSkge1xuXHRcdFx0XHRcdFx0XHRhZGRQYXJlbnRSZWYoY2hpbGRPYltsXSwgcGFyZW50UmVmLCBvYik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFkZFBhcmVudFJlZihjaGlsZE9iLCBwYXJlbnRSZWYsIG9iKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAocHJvcCBpbiBkYXRhKSB7IC8vIENvcHkgb3ZlciBhbnkgb3RoZXIgcHJvcGVydGllcy4gdGhhdCBhcmUgbm90IGdldC9zZXQgcHJvcGVydGllc1xuXHRcdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gJiYgIWdldHRlck5hbWVzW3Byb3BdKSB7XG5cdFx0XHRcdFx0b2JbcHJvcF0gPSBkYXRhW3Byb3BdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvYjtcblx0fVxuXG5cdGZ1bmN0aW9uIG1lcmdlKGRhdGEsIHBhcmVudCwgcGFyZW50UmVmKSB7XG5cdFx0ZGF0YSA9IHR5cGVvZiBkYXRhID09PSBTVFJJTkdcblx0XHRcdD8gSlNPTi5wYXJzZShkYXRhKSAvLyBBY2NlcHQgSlNPTiBzdHJpbmdcblx0XHRcdDogZGF0YTsgICAgICAgICAgICAvLyBvciBvYmplY3QvYXJyYXlcblxuXHRcdHZhciBqLCBsLCBtLCBwcm9wLCBtb2QsIGZvdW5kLCBhc3NpZ25lZCwgb2IsIG5ld01vZEFyciwgY2hpbGRPYixcblx0XHRcdGsgPSAwLFxuXHRcdFx0bW9kZWwgPSB0aGlzO1xuXG5cdFx0aWYgKCRpc0FycmF5KG1vZGVsKSkge1xuXHRcdFx0YXNzaWduZWQgPSB7fTtcblx0XHRcdG5ld01vZEFyciA9IFtdO1xuXHRcdFx0bCA9IGRhdGEubGVuZ3RoO1xuXHRcdFx0bSA9IG1vZGVsLmxlbmd0aDtcblx0XHRcdGZvciAoOyBrPGw7IGsrKykge1xuXHRcdFx0XHRvYiA9IGRhdGFba107XG5cdFx0XHRcdGZvdW5kID0gZmFsc2U7XG5cdFx0XHRcdGZvciAoaj0wOyBqPG0gJiYgIWZvdW5kOyBqKyspIHtcblx0XHRcdFx0XHRpZiAoYXNzaWduZWRbal0pIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtb2QgPSBtb2RlbFtqXTtcblxuXHRcdFx0XHRcdGlmIChpZCkge1xuXHRcdFx0XHRcdFx0YXNzaWduZWRbal0gPSBmb3VuZCA9IHR5cGVvZiBpZCA9PT0gU1RSSU5HXG5cdFx0XHRcdFx0XHQ/IChvYltpZF0gJiYgKGdldHRlck5hbWVzW2lkXSA/IG1vZFtpZF0oKSA6IG1vZFtpZF0pID09PSBvYltpZF0pXG5cdFx0XHRcdFx0XHQ6IGlkKG1vZCwgb2IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0XHRtb2QubWVyZ2Uob2IpO1xuXHRcdFx0XHRcdG5ld01vZEFyci5wdXNoKG1vZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3TW9kQXJyLnB1c2goY2hpbGRPYiA9IHZtLm1hcChvYikpO1xuXHRcdFx0XHRcdGlmIChwYXJlbnRSZWYpIHtcblx0XHRcdFx0XHRcdGFkZFBhcmVudFJlZihjaGlsZE9iLCBwYXJlbnRSZWYsIHBhcmVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0JG9ic2VydmFibGUobW9kZWwpLnJlZnJlc2gobmV3TW9kQXJyLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1vZGVsLnNwbGljZS5hcHBseShtb2RlbCwgWzAsIG1vZGVsLmxlbmd0aF0uY29uY2F0KG5ld01vZEFycikpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpdGVyYXRlKGRhdGEsIGZ1bmN0aW9uKG9iLCB2aWV3TW9kZWwsIGdldHRlciwgcGFyZW50UmVmKSB7XG5cdFx0XHRpZiAodmlld01vZGVsKSB7XG5cdFx0XHRcdG1vZGVsW2dldHRlcl0oKS5tZXJnZShvYiwgbW9kZWwsIHBhcmVudFJlZik7IC8vIFVwZGF0ZSB0eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fSBlbHNlIGlmIChtb2RlbFtnZXR0ZXJdKCkgIT09IG9iKSB7XG5cdFx0XHRcdG1vZGVsW2dldHRlcl0ob2IpOyAvLyBVcGRhdGUgbm9uLXR5cGVkIHByb3BlcnR5XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Zm9yIChwcm9wIGluIGRhdGEpIHtcblx0XHRcdGlmIChwcm9wICE9PSAkZXhwYW5kbyAmJiAhZ2V0dGVyTmFtZXNbcHJvcF0pIHtcblx0XHRcdFx0bW9kZWxbcHJvcF0gPSBkYXRhW3Byb3BdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHVubWFwKCkge1xuXHRcdHZhciBvYiwgcHJvcCwgZ2V0dGVyVHlwZSwgYXJyLCB2YWx1ZSxcblx0XHRcdGsgPSAwLFxuXHRcdFx0bW9kZWwgPSB0aGlzO1xuXG5cdFx0ZnVuY3Rpb24gdW5tYXBBcnJheShtb2RlbEFycikge1xuXHRcdFx0dmFyIGFyciA9IFtdLFxuXHRcdFx0XHRpID0gMCxcblx0XHRcdFx0bCA9IG1vZGVsQXJyLmxlbmd0aDtcblx0XHRcdGZvciAoOyBpPGw7IGkrKykge1xuXHRcdFx0XHRhcnIucHVzaChtb2RlbEFycltpXS51bm1hcCgpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhcnI7XG5cdFx0fVxuXG5cdFx0aWYgKCRpc0FycmF5KG1vZGVsKSkge1xuXHRcdFx0cmV0dXJuIHVubWFwQXJyYXkobW9kZWwpO1xuXHRcdH1cblx0XHRvYiA9IHt9O1xuXHRcdGZvciAoOyBrIDwgZ2V0dGVyQ291bnQ7IGsrKykge1xuXHRcdFx0cHJvcCA9IGdldHRlcnNba107XG5cdFx0XHRnZXR0ZXJUeXBlID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHR5cGVvZiBwcm9wICE9PSBTVFJJTkcpIHtcblx0XHRcdFx0Z2V0dGVyVHlwZSA9IHByb3A7XG5cdFx0XHRcdHByb3AgPSBnZXR0ZXJUeXBlLmdldHRlcjtcblx0XHRcdH1cblx0XHRcdHZhbHVlID0gbW9kZWxbcHJvcF0oKTtcblx0XHRcdG9iW3Byb3BdID0gZ2V0dGVyVHlwZSAmJiB2YWx1ZSAmJiB2aWV3TW9kZWxzW2dldHRlclR5cGUudHlwZV1cblx0XHRcdFx0PyAkaXNBcnJheSh2YWx1ZSlcblx0XHRcdFx0XHQ/IHVubWFwQXJyYXkodmFsdWUpXG5cdFx0XHRcdFx0OiB2YWx1ZS51bm1hcCgpXG5cdFx0XHRcdDogdmFsdWU7XG5cdFx0fVxuXHRcdGZvciAocHJvcCBpbiBtb2RlbCkge1xuXHRcdFx0aWYgKG1vZGVsLmhhc093blByb3BlcnR5KHByb3ApICYmIChwcm9wLmNoYXJBdCgwKSAhPT0gXCJfXCIgfHwgIWdldHRlck5hbWVzW3Byb3Auc2xpY2UoMSldKSAmJiBwcm9wICE9PSAkZXhwYW5kbyAmJiAhJGlzRnVuY3Rpb24obW9kZWxbcHJvcF0pKSB7XG5cdFx0XHRcdG9iW3Byb3BdID0gbW9kZWxbcHJvcF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvYjtcblx0fVxuXG5cdEpzdlZtLnByb3RvdHlwZSA9IHByb3RvO1xuXG5cdGZvciAoaT0wOyBpIDwgZ2V0dGVyQ291bnQ7IGkrKykge1xuXHRcdChmdW5jdGlvbihnZXR0ZXIpIHtcblx0XHRcdGdldHRlciA9IGdldHRlci5nZXR0ZXIgfHwgZ2V0dGVyO1xuXHRcdFx0Z2V0dGVyTmFtZXNbZ2V0dGVyXSA9IGkrMTtcblx0XHRcdHZhciBwcml2RmllbGQgPSBcIl9cIiArIGdldHRlcjtcblxuXHRcdFx0YXJncyArPSAoYXJncyA/IFwiLFwiIDogXCJcIikgKyBnZXR0ZXI7XG5cdFx0XHRjbnN0ciArPSBcInRoaXMuXCIgKyBwcml2RmllbGQgKyBcIiA9IFwiICsgZ2V0dGVyICsgXCI7XFxuXCI7XG5cdFx0XHRwcm90b1tnZXR0ZXJdID0gcHJvdG9bZ2V0dGVyXSB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXNbcHJpdkZpZWxkXTsgLy8gSWYgdGhlcmUgaXMgbm8gYXJndW1lbnQsIHVzZSBhcyBhIGdldHRlclxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRcdCRvYnNlcnZhYmxlKHRoaXMpLnNldFByb3BlcnR5KGdldHRlciwgdmFsKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRwcm90b1tnZXR0ZXJdLnNldCA9IHByb3RvW2dldHRlcl0uc2V0IHx8IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0XHRcdHRoaXNbcHJpdkZpZWxkXSA9IHZhbDsgLy8gU2V0dGVyIGNhbGxlZCBieSBvYnNlcnZhYmxlIHByb3BlcnR5IGNoYW5nZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKGdldHRlcnNbaV0pO1xuXHR9XG5cblx0Ly8gQ29uc3RydWN0b3IgZm9yIG5ldyB2aWV3TW9kZWwgaW5zdGFuY2UuXG5cdGNuc3RyID0gbmV3IEZ1bmN0aW9uKGFyZ3MsIGNuc3RyKTtcblxuXHRjb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge1xuXHRcdGNuc3RyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0Ly8gUGFzcyBhZGRpdGlvbmFsIHBhcmVudFJlZiBzdHIgYW5kIHBhcmVudCBvYmogdG8gaGF2ZSBhIHBhcmVudFJlZiBwb2ludGVyIG9uIGluc3RhbmNlXG5cdFx0aWYgKHBhcmVudCA9IGFyZ3VtZW50c1tnZXR0ZXJDb3VudCArIDFdKSB7XG5cdFx0XHRhZGRQYXJlbnRSZWYodGhpcywgYXJndW1lbnRzW2dldHRlckNvdW50XSwgcGFyZW50KTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3RydWN0b3IucHJvdG90eXBlID0gcHJvdG87XG5cdHByb3RvLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7XG5cblx0dm0ubWFwID0gbWFwO1xuXHR2bS5nZXR0ZXJzID0gZ2V0dGVycztcblx0dm0uZXh0ZW5kID0gZXh0ZW5kO1xuXHR2bS5pZCA9IGlkO1xuXHRyZXR1cm4gdm07XG59XG5cbmZ1bmN0aW9uIHRtcGxPYmplY3QobWFya3VwLCBvcHRpb25zKSB7XG5cdC8vIFRlbXBsYXRlIG9iamVjdCBjb25zdHJ1Y3RvclxuXHR2YXIgaHRtbFRhZyxcblx0XHR3cmFwTWFwID0gJHN1YlNldHRpbmdzQWR2YW5jZWQuX3dtIHx8IHt9LCAvLyBPbmx5IHVzZWQgaW4gSnNWaWV3cy4gT3RoZXJ3aXNlIGVtcHR5OiB7fVxuXHRcdHRtcGwgPSB7XG5cdFx0XHR0bXBsczogW10sXG5cdFx0XHRsaW5rczoge30sIC8vIENvbXBpbGVkIGZ1bmN0aW9ucyBmb3IgbGluayBleHByZXNzaW9uc1xuXHRcdFx0Ym5kczogW10sXG5cdFx0XHRfaXM6IFwidGVtcGxhdGVcIixcblx0XHRcdHJlbmRlcjogcmVuZGVyQ29udGVudFxuXHRcdH07XG5cblx0aWYgKG9wdGlvbnMpIHtcblx0XHR0bXBsID0gJGV4dGVuZCh0bXBsLCBvcHRpb25zKTtcblx0fVxuXG5cdHRtcGwubWFya3VwID0gbWFya3VwO1xuXHRpZiAoIXRtcGwuaHRtbFRhZykge1xuXHRcdC8vIFNldCB0bXBsLnRhZyB0byB0aGUgdG9wLWxldmVsIEhUTUwgdGFnIHVzZWQgaW4gdGhlIHRlbXBsYXRlLCBpZiBhbnkuLi5cblx0XHRodG1sVGFnID0gckZpcnN0RWxlbS5leGVjKG1hcmt1cCk7XG5cdFx0dG1wbC5odG1sVGFnID0gaHRtbFRhZyA/IGh0bWxUYWdbMV0udG9Mb3dlckNhc2UoKSA6IFwiXCI7XG5cdH1cblx0aHRtbFRhZyA9IHdyYXBNYXBbdG1wbC5odG1sVGFnXTtcblx0aWYgKGh0bWxUYWcgJiYgaHRtbFRhZyAhPT0gd3JhcE1hcC5kaXYpIHtcblx0XHQvLyBXaGVuIHVzaW5nIEpzVmlld3MsIHdlIHRyaW0gdGVtcGxhdGVzIHdoaWNoIGFyZSBpbnNlcnRlZCBpbnRvIEhUTUwgY29udGV4dHMgd2hlcmUgdGV4dCBub2RlcyBhcmUgbm90IHJlbmRlcmVkIChpLmUuIG5vdCAnUGhyYXNpbmcgQ29udGVudCcpLlxuXHRcdC8vIEN1cnJlbnRseSBub3QgdHJpbW1lZCBmb3IgPGxpPiB0YWcuIChOb3Qgd29ydGggYWRkaW5nIHBlcmYgY29zdClcblx0XHR0bXBsLm1hcmt1cCA9ICQudHJpbSh0bXBsLm1hcmt1cCk7XG5cdH1cblxuXHRyZXR1cm4gdG1wbDtcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gcmVnaXN0ZXJTdG9yZVxuLy89PT09PT09PT09PT09PVxuXG4vKipcbiogSW50ZXJuYWwuIFJlZ2lzdGVyIGEgc3RvcmUgdHlwZSAodXNlZCBmb3IgdGVtcGxhdGUsIHRhZ3MsIGhlbHBlcnMsIGNvbnZlcnRlcnMpXG4qL1xuZnVuY3Rpb24gcmVnaXN0ZXJTdG9yZShzdG9yZU5hbWUsIHN0b3JlU2V0dGluZ3MpIHtcblxuLyoqXG4qIEdlbmVyaWMgc3RvcmUoKSBmdW5jdGlvbiB0byByZWdpc3RlciBpdGVtLCBuYW1lZCBpdGVtLCBvciBoYXNoIG9mIGl0ZW1zXG4qIEFsc28gdXNlZCBhcyBoYXNoIHRvIHN0b3JlIHRoZSByZWdpc3RlcmVkIGl0ZW1zXG4qIFVzZWQgYXMgaW1wbGVtZW50YXRpb24gb2YgJC50ZW1wbGF0ZXMoKSwgJC52aWV3cy50ZW1wbGF0ZXMoKSwgJC52aWV3cy50YWdzKCksICQudmlld3MuaGVscGVycygpIGFuZCAkLnZpZXdzLmNvbnZlcnRlcnMoKVxuKlxuKiBAcGFyYW0ge3N0cmluZ3xoYXNofSBuYW1lICAgICAgICAgbmFtZSAtIG9yIHNlbGVjdG9yLCBpbiBjYXNlIG9mICQudGVtcGxhdGVzKCkuIE9yIGhhc2ggb2YgaXRlbXNcbiogQHBhcmFtIHthbnl9ICAgICAgICAgW2l0ZW1dICAgICAgIChlLmcuIG1hcmt1cCBmb3IgbmFtZWQgdGVtcGxhdGUpXG4qIEBwYXJhbSB7dGVtcGxhdGV9ICAgIFtwYXJlbnRUbXBsXSBGb3IgaXRlbSBiZWluZyByZWdpc3RlcmVkIGFzIHByaXZhdGUgcmVzb3VyY2Ugb2YgdGVtcGxhdGVcbiogQHJldHVybnMge2FueXwkLnZpZXdzfSBpdGVtLCBlLmcuIGNvbXBpbGVkIHRlbXBsYXRlIC0gb3IgJC52aWV3cyBpbiBjYXNlIG9mIHJlZ2lzdGVyaW5nIGhhc2ggb2YgaXRlbXNcbiovXG5cdGZ1bmN0aW9uIHRoZVN0b3JlKG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwpIHtcblx0XHQvLyBUaGUgc3RvcmUgaXMgYWxzbyB0aGUgZnVuY3Rpb24gdXNlZCB0byBhZGQgaXRlbXMgdG8gdGhlIHN0b3JlLiBlLmcuICQudGVtcGxhdGVzLCBvciAkLnZpZXdzLnRhZ3NcblxuXHRcdC8vIEZvciBzdG9yZSBvZiBuYW1lICd0aGluZycsIENhbGwgYXM6XG5cdFx0Ly8gICAgJC52aWV3cy50aGluZ3MoaXRlbXNbLCBwYXJlbnRUbXBsXSksXG5cdFx0Ly8gb3IgJC52aWV3cy50aGluZ3MobmFtZVssIGl0ZW0sIHBhcmVudFRtcGxdKVxuXG5cdFx0dmFyIGNvbXBpbGUsIGl0ZW1OYW1lLCB0aGlzU3RvcmUsIGNudCxcblx0XHRcdG9uU3RvcmUgPSAkc3ViLm9uU3RvcmVbc3RvcmVOYW1lXTtcblxuXHRcdGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSBPQkpFQ1QgJiYgIW5hbWUubm9kZVR5cGUgJiYgIW5hbWUubWFya3VwICYmICFuYW1lLmdldFRndCAmJiAhKHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIiAmJiBuYW1lLmdldHRlcnMgfHwgbmFtZS5leHRlbmQpKSB7XG5cdFx0XHQvLyBDYWxsIHRvICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXG5cdFx0XHQvLyBBZGRpbmcgaXRlbXMgdG8gdGhlIHN0b3JlXG5cdFx0XHQvLyBJZiBuYW1lIGlzIGEgaGFzaCwgdGhlbiBpdGVtIGlzIHBhcmVudFRtcGwuIEl0ZXJhdGUgb3ZlciBoYXNoIGFuZCBjYWxsIHN0b3JlIGZvciBrZXkuXG5cdFx0XHRmb3IgKGl0ZW1OYW1lIGluIG5hbWUpIHtcblx0XHRcdFx0dGhlU3RvcmUoaXRlbU5hbWUsIG5hbWVbaXRlbU5hbWVdLCBpdGVtKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtIHx8ICR2aWV3cztcblx0XHR9XG5cdFx0Ly8gQWRkaW5nIGEgc2luZ2xlIHVubmFtZWQgaXRlbSB0byB0aGUgc3RvcmVcblx0XHRpZiAobmFtZSAmJiAgdHlwZW9mIG5hbWUgIT09IFNUUklORykgeyAvLyBuYW1lIG11c3QgYmUgYSBzdHJpbmdcblx0XHRcdHBhcmVudFRtcGwgPSBpdGVtO1xuXHRcdFx0aXRlbSA9IG5hbWU7XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzU3RvcmUgPSBwYXJlbnRUbXBsXG5cdFx0XHQ/IHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIlxuXHRcdFx0XHQ/IHBhcmVudFRtcGxcblx0XHRcdFx0OiAocGFyZW50VG1wbFtzdG9yZU5hbWVzXSA9IHBhcmVudFRtcGxbc3RvcmVOYW1lc10gfHwge30pXG5cdFx0XHQ6IHRoZVN0b3JlO1xuXHRcdGNvbXBpbGUgPSBzdG9yZVNldHRpbmdzLmNvbXBpbGU7XG5cblx0XHRpZiAoaXRlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpdGVtID0gY29tcGlsZSA/IG5hbWUgOiB0aGlzU3RvcmVbbmFtZV07XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0Ly8gSWYgaXRlbSBpcyBudWxsLCBkZWxldGUgdGhpcyBlbnRyeVxuXHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXNTdG9yZVtuYW1lXTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGNvbXBpbGUpIHtcblx0XHRcdFx0aXRlbSA9IGNvbXBpbGUuY2FsbCh0aGlzU3RvcmUsIG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwsIDApIHx8IHt9O1xuXHRcdFx0XHRpdGVtLl9pcyA9IHN0b3JlTmFtZTsgLy8gT25seSBkbyB0aGlzIGZvciBjb21waWxlZCBvYmplY3RzICh0YWdzLCB0ZW1wbGF0ZXMuLi4pXG5cdFx0XHR9XG5cdFx0XHRpZiAobmFtZSkge1xuXHRcdFx0XHR0aGlzU3RvcmVbbmFtZV0gPSBpdGVtO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAob25TdG9yZSkge1xuXHRcdFx0Ly8gZS5nLiBKc1ZpZXdzIGludGVncmF0aW9uXG5cdFx0XHRvblN0b3JlKG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwsIGNvbXBpbGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gaXRlbTtcblx0fVxuXG5cdHZhciBzdG9yZU5hbWVzID0gc3RvcmVOYW1lICsgXCJzXCI7XG5cdCR2aWV3c1tzdG9yZU5hbWVzXSA9IHRoZVN0b3JlO1xufVxuXG4vKipcbiogQWRkIHNldHRpbmdzIHN1Y2ggYXM6XG4qICQudmlld3Muc2V0dGluZ3MuYWxsb3dDb2RlKHRydWUpXG4qIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWVcbiogQHJldHVybnMge1NldHRpbmdzfVxuKlxuKiBhbGxvd0NvZGUgPSAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSgpXG4qIEByZXR1cm5zIHtib29sZWFufVxuKi9cbmZ1bmN0aW9uIGFkZFNldHRpbmcoc3QpIHtcblx0JHZpZXdzU2V0dGluZ3Nbc3RdID0gJHZpZXdzU2V0dGluZ3Nbc3RdIHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0cmV0dXJuIGFyZ3VtZW50cy5sZW5ndGhcblx0XHRcdD8gKCRzdWJTZXR0aW5nc1tzdF0gPSB2YWx1ZSwgJHZpZXdzU2V0dGluZ3MpXG5cdFx0XHQ6ICRzdWJTZXR0aW5nc1tzdF07XG5cdH07XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBkYXRhTWFwIGZvciByZW5kZXIgb25seVxuLy89PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZGF0YU1hcChtYXBEZWYpIHtcblx0ZnVuY3Rpb24gTWFwKHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdHRoaXMudGd0ID0gbWFwRGVmLmdldFRndChzb3VyY2UsIG9wdGlvbnMpO1xuXHRcdG9wdGlvbnMubWFwID0gdGhpcztcblx0fVxuXG5cdGlmICgkaXNGdW5jdGlvbihtYXBEZWYpKSB7XG5cdFx0Ly8gU2ltcGxlIG1hcCBkZWNsYXJlZCBhcyBmdW5jdGlvblxuXHRcdG1hcERlZiA9IHtcblx0XHRcdGdldFRndDogbWFwRGVmXG5cdFx0fTtcblx0fVxuXG5cdGlmIChtYXBEZWYuYmFzZU1hcCkge1xuXHRcdG1hcERlZiA9ICRleHRlbmQoJGV4dGVuZCh7fSwgbWFwRGVmLmJhc2VNYXApLCBtYXBEZWYpO1xuXHR9XG5cblx0bWFwRGVmLm1hcCA9IGZ1bmN0aW9uKHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdHJldHVybiBuZXcgTWFwKHNvdXJjZSwgb3B0aW9ucyk7XG5cdH07XG5cdHJldHVybiBtYXBEZWY7XG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHJlbmRlckNvbnRlbnRcbi8vPT09PT09PT09PT09PT1cblxuLyoqIFJlbmRlciB0aGUgdGVtcGxhdGUgYXMgYSBzdHJpbmcsIHVzaW5nIHRoZSBzcGVjaWZpZWQgZGF0YSBhbmQgaGVscGVycy9jb250ZXh0XG4qICQoXCIjdG1wbFwiKS5yZW5kZXIoKSwgdG1wbC5yZW5kZXIoKSwgdGFnQ3R4LnJlbmRlcigpLCAkLnJlbmRlci5uYW1lZFRtcGwoKVxuKlxuKiBAcGFyYW0ge2FueX0gICAgICAgIGRhdGFcbiogQHBhcmFtIHtoYXNofSAgICAgICBbY29udGV4dF0gICAgICAgICAgIGhlbHBlcnMgb3IgY29udGV4dFxuKiBAcGFyYW0ge2Jvb2xlYW59ICAgIFtub0l0ZXJhdGlvbl1cbiogQHBhcmFtIHtWaWV3fSAgICAgICBbcGFyZW50Vmlld10gICAgICAgIGludGVybmFsXG4qIEBwYXJhbSB7c3RyaW5nfSAgICAgW2tleV0gICAgICAgICAgICAgICBpbnRlcm5hbFxuKiBAcGFyYW0ge2Z1bmN0aW9ufSAgIFtvblJlbmRlcl0gICAgICAgICAgaW50ZXJuYWxcbiogQHJldHVybnMge3N0cmluZ30gICByZW5kZXJlZCB0ZW1wbGF0ZSAgIGludGVybmFsXG4qL1xuZnVuY3Rpb24gcmVuZGVyQ29udGVudChkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgcGFyZW50Vmlldywga2V5LCBvblJlbmRlcikge1xuXHR2YXIgaSwgbCwgdGFnLCB0bXBsLCB0YWdDdHgsIGlzVG9wUmVuZGVyQ2FsbCwgcHJldkRhdGEsIHByZXZJbmRleCxcblx0XHR2aWV3ID0gcGFyZW50Vmlldyxcblx0XHRyZXN1bHQgPSBcIlwiO1xuXG5cdGlmIChjb250ZXh0ID09PSB0cnVlKSB7XG5cdFx0bm9JdGVyYXRpb24gPSBjb250ZXh0OyAvLyBwYXNzaW5nIGJvb2xlYW4gYXMgc2Vjb25kIHBhcmFtIC0gbm9JdGVyYXRpb25cblx0XHRjb250ZXh0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBjb250ZXh0ICE9PSBPQkpFQ1QpIHtcblx0XHRjb250ZXh0ID0gdW5kZWZpbmVkOyAvLyBjb250ZXh0IG11c3QgYmUgYSBib29sZWFuIChub0l0ZXJhdGlvbikgb3IgYSBwbGFpbiBvYmplY3Rcblx0fVxuXG5cdGlmICh0YWcgPSB0aGlzLnRhZykge1xuXHRcdC8vIFRoaXMgaXMgYSBjYWxsIGZyb20gcmVuZGVyVGFnIG9yIHRhZ0N0eC5yZW5kZXIoLi4uKVxuXHRcdHRhZ0N0eCA9IHRoaXM7XG5cdFx0dmlldyA9IHZpZXcgfHwgdGFnQ3R4LnZpZXc7XG5cdFx0dG1wbCA9IHZpZXcuX2dldFRtcGwodGFnLnRlbXBsYXRlIHx8IHRhZ0N0eC50bXBsKTtcblx0XHRpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRcdGRhdGEgPSB0YWcuY29udGVudEN0eCAmJiAkaXNGdW5jdGlvbih0YWcuY29udGVudEN0eClcblx0XHRcdFx0PyBkYXRhID0gdGFnLmNvbnRlbnRDdHgoZGF0YSlcblx0XHRcdFx0OiB2aWV3OyAvLyBEZWZhdWx0IGRhdGEgY29udGV4dCBmb3Igd3JhcHBlZCBibG9jayBjb250ZW50IGlzIHRoZSBmaXJzdCBhcmd1bWVudFxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBUaGlzIGlzIGEgdGVtcGxhdGUucmVuZGVyKC4uLikgY2FsbFxuXHRcdHRtcGwgPSB0aGlzO1xuXHR9XG5cblx0aWYgKHRtcGwpIHtcblx0XHRpZiAoIXBhcmVudFZpZXcgJiYgZGF0YSAmJiBkYXRhLl9pcyA9PT0gXCJ2aWV3XCIpIHtcblx0XHRcdHZpZXcgPSBkYXRhOyAvLyBXaGVuIHBhc3NpbmcgaW4gYSB2aWV3IHRvIHJlbmRlciBvciBsaW5rIChhbmQgbm90IHBhc3NpbmcgaW4gYSBwYXJlbnQgdmlldykgdXNlIHRoZSBwYXNzZWQtaW4gdmlldyBhcyBwYXJlbnRWaWV3XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXcgJiYgZGF0YSA9PT0gdmlldykge1xuXHRcdFx0Ly8gSW5oZXJpdCB0aGUgZGF0YSBmcm9tIHRoZSBwYXJlbnQgdmlldy5cblx0XHRcdGRhdGEgPSB2aWV3LmRhdGE7XG5cdFx0fVxuXG5cdFx0aXNUb3BSZW5kZXJDYWxsID0gIXZpZXc7XG5cdFx0aXNSZW5kZXJDYWxsID0gaXNSZW5kZXJDYWxsIHx8IGlzVG9wUmVuZGVyQ2FsbDtcblx0XHRpZiAoaXNUb3BSZW5kZXJDYWxsKSB7XG5cdFx0XHQoY29udGV4dCA9IGNvbnRleHQgfHwge30pLnJvb3QgPSBkYXRhOyAvLyBQcm92aWRlIH5yb290IGFzIHNob3J0Y3V0IHRvIHRvcC1sZXZlbCBkYXRhLlxuXHRcdH1cblx0XHRpZiAoIWlzUmVuZGVyQ2FsbCB8fCAkc3ViU2V0dGluZ3NBZHZhbmNlZC51c2VWaWV3cyB8fCB0bXBsLnVzZVZpZXdzIHx8IHZpZXcgJiYgdmlldyAhPT0gdG9wVmlldykge1xuXHRcdFx0cmVzdWx0ID0gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCB2aWV3LCBrZXksIG9uUmVuZGVyLCB0YWcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmlldykgeyAvLyBJbiBhIGJsb2NrXG5cdFx0XHRcdHByZXZEYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0XHRwcmV2SW5kZXggPSB2aWV3LmluZGV4O1xuXHRcdFx0XHR2aWV3LmluZGV4ID0gaW5kZXhTdHI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aWV3ID0gdG9wVmlldztcblx0XHRcdFx0cHJldkRhdGEgPSB2aWV3LmRhdGE7XG5cdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdHZpZXcuY3R4ID0gY29udGV4dDtcblx0XHRcdH1cblx0XHRcdGlmICgkaXNBcnJheShkYXRhKSAmJiAhbm9JdGVyYXRpb24pIHtcblx0XHRcdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3IgdGhlIGFycmF5LCB3aG9zZSBjaGlsZCB2aWV3cyBjb3JyZXNwb25kIHRvIGVhY2ggZGF0YSBpdGVtLiAoTm90ZTogaWYga2V5IGFuZCBwYXJlbnRWaWV3IGFyZSBwYXNzZWQgaW5cblx0XHRcdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHBhcmVudFZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRcdFx0Zm9yIChpID0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdFx0XHRcdFx0dmlldy5pbmRleCA9IGk7XG5cdFx0XHRcdFx0dmlldy5kYXRhID0gZGF0YVtpXTtcblx0XHRcdFx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhW2ldLCB2aWV3LCAkc3ViKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmlldy5kYXRhID0gZGF0YTtcblx0XHRcdFx0cmVzdWx0ICs9IHRtcGwuZm4oZGF0YSwgdmlldywgJHN1Yik7XG5cdFx0XHR9XG5cdFx0XHR2aWV3LmRhdGEgPSBwcmV2RGF0YTtcblx0XHRcdHZpZXcuaW5kZXggPSBwcmV2SW5kZXg7XG5cdFx0fVxuXHRcdGlmIChpc1RvcFJlbmRlckNhbGwpIHtcblx0XHRcdGlzUmVuZGVyQ2FsbCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCB2aWV3LCBrZXksIG9uUmVuZGVyLCB0YWcpIHtcblx0Ly8gUmVuZGVyIHRlbXBsYXRlIGFnYWluc3QgZGF0YSBhcyBhIHRyZWUgb2Ygc3Vidmlld3MgKG5lc3RlZCByZW5kZXJlZCB0ZW1wbGF0ZSBpbnN0YW5jZXMpLCBvciBhcyBhIHN0cmluZyAodG9wLWxldmVsIHRlbXBsYXRlKS5cblx0Ly8gSWYgdGhlIGRhdGEgaXMgdGhlIHBhcmVudCB2aWV3LCB0cmVhdCBhcyBub0l0ZXJhdGlvbiwgcmUtcmVuZGVyIHdpdGggdGhlIHNhbWUgZGF0YSBjb250ZXh0LlxuXHQvLyB0bXBsIGNhbiBiZSBhIHN0cmluZyAoZS5nLiByZW5kZXJlZCBieSBhIHRhZy5yZW5kZXIoKSBtZXRob2QpLCBvciBhIGNvbXBpbGVkIHRlbXBsYXRlLlxuXHR2YXIgaSwgbCwgbmV3VmlldywgY2hpbGRWaWV3LCBpdGVtUmVzdWx0LCBzd2FwQ29udGVudCwgY29udGVudFRtcGwsIG91dGVyT25SZW5kZXIsIHRtcGxOYW1lLCBpdGVtVmFyLCBuZXdDdHgsIHRhZ0N0eCwgbm9MaW5raW5nLFxuXHRcdHJlc3VsdCA9IFwiXCI7XG5cblx0aWYgKHRhZykge1xuXHRcdC8vIFRoaXMgaXMgYSBjYWxsIGZyb20gcmVuZGVyVGFnIG9yIHRhZ0N0eC5yZW5kZXIoLi4uKVxuXHRcdHRtcGxOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4ID0gdGFnLnRhZ0N0eDtcblx0XHRjb250ZXh0ID0gY29udGV4dCA/IGV4dGVuZEN0eChjb250ZXh0LCB0YWcuY3R4KSA6IHRhZy5jdHg7XG5cblx0XHRpZiAodG1wbCA9PT0gdmlldy5jb250ZW50KSB7IC8vIHt7eHh4IHRtcGw9I2NvbnRlbnR9fVxuXHRcdFx0Y29udGVudFRtcGwgPSB0bXBsICE9PSB2aWV3LmN0eC5fd3JwIC8vIFdlIGFyZSByZW5kZXJpbmcgdGhlICNjb250ZW50XG5cdFx0XHRcdD8gdmlldy5jdHguX3dycCAvLyAjY29udGVudCB3YXMgdGhlIHRhZ0N0eC5wcm9wcy50bXBsIHdyYXBwZXIgb2YgdGhlIGJsb2NrIGNvbnRlbnQgLSBzbyB3aXRoaW4gdGhpcyB2aWV3LCAjY29udGVudCB3aWxsIG5vdyBiZSB0aGUgdmlldy5jdHguX3dycCBibG9jayBjb250ZW50XG5cdFx0XHRcdDogdW5kZWZpbmVkOyAvLyAjY29udGVudCB3YXMgdGhlIHZpZXcuY3R4Ll93cnAgYmxvY2sgY29udGVudCAtIHNvIHdpdGhpbiB0aGlzIHZpZXcsIHRoZXJlIGlzIG5vIGxvbmdlciBhbnkgI2NvbnRlbnQgdG8gd3JhcC5cblx0XHR9IGVsc2UgaWYgKHRtcGwgIT09IHRhZ0N0eC5jb250ZW50KSB7XG5cdFx0XHRpZiAodG1wbCA9PT0gdGFnLnRlbXBsYXRlKSB7IC8vIFJlbmRlcmluZyB7e3RhZ319IHRhZy50ZW1wbGF0ZSwgcmVwbGFjaW5nIGJsb2NrIGNvbnRlbnQuXG5cdFx0XHRcdGNvbnRlbnRUbXBsID0gdGFnQ3R4LnRtcGw7IC8vIFNldCAjY29udGVudCB0byBibG9jayBjb250ZW50IChvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaWYgdGFnQ3R4LnByb3BzLnRtcGwgaXMgc2V0KVxuXHRcdFx0XHRjb250ZXh0Ll93cnAgPSB0YWdDdHguY29udGVudDsgLy8gUGFzcyB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgdG8gbmVzdGVkIHZpZXdzXG5cdFx0XHR9IGVsc2UgeyAvLyBSZW5kZXJpbmcgdGFnQ3R4LnByb3BzLnRtcGwgd3JhcHBlclxuXHRcdFx0XHRjb250ZW50VG1wbCA9IHRhZ0N0eC5jb250ZW50IHx8IHZpZXcuY29udGVudDsgLy8gU2V0ICNjb250ZW50IHRvIHdyYXBwZWQgYmxvY2sgY29udGVudFxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50VG1wbCA9IHZpZXcuY29udGVudDsgLy8gTmVzdGVkIHZpZXdzIGluaGVyaXQgc2FtZSB3cmFwcGVkICNjb250ZW50IHByb3BlcnR5XG5cdFx0fVxuXG5cdFx0aWYgKHRhZ0N0eC5wcm9wcy5saW5rID09PSBmYWxzZSkge1xuXHRcdFx0Ly8gbGluaz1mYWxzZSBzZXR0aW5nIG9uIGJsb2NrIHRhZ1xuXHRcdFx0Ly8gV2Ugd2lsbCBvdmVycmlkZSBpbmhlcml0ZWQgdmFsdWUgb2YgbGluayBieSB0aGUgZXhwbGljaXQgc2V0dGluZyBsaW5rPWZhbHNlIHRha2VuIGZyb20gcHJvcHNcblx0XHRcdC8vIFRoZSBjaGlsZCB2aWV3cyBvZiBhbiB1bmxpbmtlZCB2aWV3IGFyZSBhbHNvIHVubGlua2VkLiBTbyBzZXR0aW5nIGNoaWxkIGJhY2sgdG8gdHJ1ZSB3aWxsIG5vdCBoYXZlIGFueSBlZmZlY3QuXG5cdFx0XHRjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcblx0XHRcdGNvbnRleHQubGluayA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGlmICh2aWV3KSB7XG5cdFx0b25SZW5kZXIgPSBvblJlbmRlciB8fCB2aWV3Ll8ub25SZW5kZXI7XG5cdFx0bm9MaW5raW5nID0gY29udGV4dCAmJiBjb250ZXh0LmxpbmsgPT09IGZhbHNlO1xuXG5cdFx0aWYgKG5vTGlua2luZyAmJiB2aWV3Ll8ubmwpIHtcblx0XHRcdG9uUmVuZGVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnRleHQgPSBleHRlbmRDdHgoY29udGV4dCwgdmlldy5jdHgpO1xuXHRcdHRhZ0N0eCA9ICF0YWcgJiYgdmlldy50YWdcblx0XHRcdD8gdmlldy50YWcudGFnQ3R4c1t2aWV3LnRhZ0Vsc2VdXG5cdFx0XHQ6IHRhZ0N0eDtcblx0fVxuXG5cdGlmIChpdGVtVmFyID0gdGFnQ3R4ICYmIHRhZ0N0eC5wcm9wcy5pdGVtVmFyKSB7XG5cdFx0aWYgKGl0ZW1WYXJbMF0gIT09IFwiflwiKSB7XG5cdFx0XHRzeW50YXhFcnJvcihcIlVzZSBpdGVtVmFyPSd+bXlJdGVtJ1wiKTtcblx0XHR9XG5cdFx0aXRlbVZhciA9IGl0ZW1WYXIuc2xpY2UoMSk7XG5cdH1cblxuXHRpZiAoa2V5ID09PSB0cnVlKSB7XG5cdFx0c3dhcENvbnRlbnQgPSB0cnVlO1xuXHRcdGtleSA9IDA7XG5cdH1cblxuXHQvLyBJZiBsaW5rPT09ZmFsc2UsIGRvIG5vdCBjYWxsIG9uUmVuZGVyLCBzbyBubyBkYXRhLWxpbmtpbmcgbWFya2VyIG5vZGVzXG5cdGlmIChvblJlbmRlciAmJiB0YWcgJiYgdGFnLl8ubm9Wd3MpIHtcblx0XHRvblJlbmRlciA9IHVuZGVmaW5lZDtcblx0fVxuXHRvdXRlck9uUmVuZGVyID0gb25SZW5kZXI7XG5cdGlmIChvblJlbmRlciA9PT0gdHJ1ZSkge1xuXHRcdC8vIFVzZWQgYnkgdmlldy5yZWZyZXNoKCkuIERvbid0IGNyZWF0ZSBhIG5ldyB3cmFwcGVyIHZpZXcuXG5cdFx0b3V0ZXJPblJlbmRlciA9IHVuZGVmaW5lZDtcblx0XHRvblJlbmRlciA9IHZpZXcuXy5vblJlbmRlcjtcblx0fVxuXHQvLyBTZXQgYWRkaXRpb25hbCBjb250ZXh0IG9uIHZpZXdzIGNyZWF0ZWQgaGVyZSwgKGFzIG1vZGlmaWVkIGNvbnRleHQgaW5oZXJpdGVkIGZyb20gdGhlIHBhcmVudCwgYW5kIHRvIGJlIGluaGVyaXRlZCBieSBjaGlsZCB2aWV3cylcblx0Y29udGV4dCA9IHRtcGwuaGVscGVyc1xuXHRcdD8gZXh0ZW5kQ3R4KHRtcGwuaGVscGVycywgY29udGV4dClcblx0XHQ6IGNvbnRleHQ7XG5cblx0bmV3Q3R4ID0gY29udGV4dDtcblx0aWYgKCRpc0FycmF5KGRhdGEpICYmICFub0l0ZXJhdGlvbikge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgdmlldyBhcmUgcGFzc2VkIGluXG5cdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRuZXdWaWV3ID0gc3dhcENvbnRlbnRcblx0XHRcdD8gdmlld1xuXHRcdFx0OiAoa2V5ICE9PSB1bmRlZmluZWQgJiYgdmlldylcblx0XHRcdFx0fHwgbmV3IFZpZXcoY29udGV4dCwgXCJhcnJheVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cdFx0bmV3Vmlldy5fLm5sPSBub0xpbmtpbmc7XG5cdFx0aWYgKHZpZXcgJiYgdmlldy5fLnVzZUtleSkge1xuXHRcdFx0Ly8gUGFyZW50IGlzIG5vdCBhbiAnYXJyYXkgdmlldydcblx0XHRcdG5ld1ZpZXcuXy5ibmQgPSAhdGFnIHx8IHRhZy5fLmJuZCAmJiB0YWc7IC8vIEZvciBhcnJheSB2aWV3cyB0aGF0IGFyZSBkYXRhIGJvdW5kIGZvciBjb2xsZWN0aW9uIGNoYW5nZSBldmVudHMsIHNldCB0aGVcblx0XHRcdC8vIHZpZXcuXy5ibmQgcHJvcGVydHkgdG8gdHJ1ZSBmb3IgdG9wLWxldmVsIGxpbmsoKSBvciBkYXRhLWxpbms9XCJ7Zm9yfVwiLCBvciB0byB0aGUgdGFnIGluc3RhbmNlIGZvciBhIGRhdGEtYm91bmQgdGFnLCBlLmcuIHtee2ZvciAuLi59fVxuXHRcdFx0bmV3Vmlldy50YWcgPSB0YWc7XG5cdFx0fVxuXHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3IgZWFjaCBkYXRhIGl0ZW0uXG5cdFx0XHRjaGlsZFZpZXcgPSBuZXcgVmlldyhuZXdDdHgsIFwiaXRlbVwiLCBuZXdWaWV3LCBkYXRhW2ldLCB0bXBsLCAoa2V5IHx8IDApICsgaSwgb25SZW5kZXIsIG5ld1ZpZXcuY29udGVudCk7XG5cdFx0XHRpZiAoaXRlbVZhcikge1xuXHRcdFx0XHQoY2hpbGRWaWV3LmN0eCA9ICRleHRlbmQoe30sIG5ld0N0eCkpW2l0ZW1WYXJdID0gJHN1Yi5fY3AoZGF0YVtpXSwgXCIjZGF0YVwiLCBjaGlsZFZpZXcpO1xuXHRcdFx0fVxuXHRcdFx0aXRlbVJlc3VsdCA9IHRtcGwuZm4oZGF0YVtpXSwgY2hpbGRWaWV3LCAkc3ViKTtcblx0XHRcdHJlc3VsdCArPSBuZXdWaWV3Ll8ub25SZW5kZXIgPyBuZXdWaWV3Ll8ub25SZW5kZXIoaXRlbVJlc3VsdCwgY2hpbGRWaWV3KSA6IGl0ZW1SZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHNpbmdsZXRvbiBkYXRhIG9iamVjdC4gVGhlIHR5cGUgb2YgdGhlIHZpZXcgd2lsbCBiZSB0aGUgdGFnIG5hbWUsIGUuZy4gXCJpZlwiIG9yIFwibXl0YWdcIiBleGNlcHQgZm9yXG5cdFx0Ly8gXCJpdGVtXCIsIFwiYXJyYXlcIiBhbmQgXCJkYXRhXCIgdmlld3MuIEEgXCJkYXRhXCIgdmlldyBpcyBmcm9tIHByb2dyYW1tYXRpYyByZW5kZXIob2JqZWN0KSBhZ2FpbnN0IGEgJ3NpbmdsZXRvbicuXG5cdFx0bmV3VmlldyA9IHN3YXBDb250ZW50ID8gdmlldyA6IG5ldyBWaWV3KG5ld0N0eCwgdG1wbE5hbWUgfHwgXCJkYXRhXCIsIHZpZXcsIGRhdGEsIHRtcGwsIGtleSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKTtcblxuXHRcdGlmIChpdGVtVmFyKSB7XG5cdFx0XHQobmV3Vmlldy5jdHggPSAkZXh0ZW5kKHt9LCBuZXdDdHgpKVtpdGVtVmFyXSA9ICRzdWIuX2NwKGRhdGEsIFwiI2RhdGFcIiwgbmV3Vmlldyk7XG5cdFx0fVxuXG5cdFx0bmV3Vmlldy50YWcgPSB0YWc7XG5cdFx0bmV3Vmlldy5fLm5sID0gbm9MaW5raW5nO1xuXHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGEsIG5ld1ZpZXcsICRzdWIpO1xuXHR9XG5cdGlmICh0YWcpIHtcblx0XHRuZXdWaWV3LnRhZ0Vsc2UgPSB0YWdDdHguaW5kZXg7XG5cdFx0dGFnQ3R4LmNvbnRlbnRWaWV3ID0gbmV3Vmlldztcblx0fVxuXHRyZXR1cm4gb3V0ZXJPblJlbmRlciA/IG91dGVyT25SZW5kZXIocmVzdWx0LCBuZXdWaWV3KSA6IHJlc3VsdDtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEJ1aWxkIGFuZCBjb21waWxlIHRlbXBsYXRlXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBHZW5lcmF0ZSBhIHJldXNhYmxlIGZ1bmN0aW9uIHRoYXQgd2lsbCBzZXJ2ZSB0byByZW5kZXIgYSB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGFcbi8vIChDb21waWxlIEFTVCB0aGVuIGJ1aWxkIHRlbXBsYXRlIGZ1bmN0aW9uKVxuXG5mdW5jdGlvbiBvblJlbmRlckVycm9yKGUsIHZpZXcsIGZhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlID0gZmFsbGJhY2sgIT09IHVuZGVmaW5lZFxuXHRcdD8gJGlzRnVuY3Rpb24oZmFsbGJhY2spXG5cdFx0XHQ/IGZhbGxiYWNrLmNhbGwodmlldy5kYXRhLCBlLCB2aWV3KVxuXHRcdFx0OiBmYWxsYmFjayB8fCBcIlwiXG5cdFx0OiBcIntFcnJvcjogXCIgKyAoZS5tZXNzYWdlfHxlKSArIFwifVwiO1xuXG5cdGlmICgkc3ViU2V0dGluZ3Mub25FcnJvciAmJiAoZmFsbGJhY2sgPSAkc3ViU2V0dGluZ3Mub25FcnJvci5jYWxsKHZpZXcuZGF0YSwgZSwgZmFsbGJhY2sgJiYgbWVzc2FnZSwgdmlldykpICE9PSB1bmRlZmluZWQpIHtcblx0XHRtZXNzYWdlID0gZmFsbGJhY2s7IC8vIFRoZXJlIGlzIGEgc2V0dGluZ3MuZGVidWdNb2RlKGhhbmRsZXIpIG9uRXJyb3Igb3ZlcnJpZGUuIENhbGwgaXQsIGFuZCB1c2UgcmV0dXJuIHZhbHVlIChpZiBhbnkpIHRvIHJlcGxhY2UgbWVzc2FnZVxuXHR9XG5cdHJldHVybiB2aWV3ICYmICF2aWV3Ll9sYyA/ICRjb252ZXJ0ZXJzLmh0bWwobWVzc2FnZSkgOiBtZXNzYWdlOyAvLyBGb3IgZGF0YS1saW5rPVxcXCJ7Li4uIG9uRXJyb3I9Li4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcbn1cblxuZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuXHR0aHJvdyBuZXcgJHN1Yi5FcnIobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIHN5bnRheEVycm9yKG1lc3NhZ2UpIHtcblx0ZXJyb3IoXCJTeW50YXggZXJyb3JcXG5cIiArIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiB0bXBsRm4obWFya3VwLCB0bXBsLCBpc0xpbmtFeHByLCBjb252ZXJ0QmFjaywgaGFzRWxzZSkge1xuXHQvLyBDb21waWxlIG1hcmt1cCB0byBBU1QgKGFidHJhY3Qgc3ludGF4IHRyZWUpIHRoZW4gYnVpbGQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGNvZGUgZnJvbSB0aGUgQVNUIG5vZGVzXG5cdC8vIFVzZWQgZm9yIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGFuZCBhbHNvIGJ5IEpzVmlld3MgdG8gYnVpbGQgZnVuY3Rpb25zIGZvciBkYXRhIGxpbmsgZXhwcmVzc2lvbnNcblxuXHQvLz09PT0gbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cdGZ1bmN0aW9uIHB1c2hwcmVjZWRpbmdDb250ZW50KHNoaWZ0KSB7XG5cdFx0c2hpZnQgLT0gbG9jO1xuXHRcdGlmIChzaGlmdCkge1xuXHRcdFx0Y29udGVudC5wdXNoKG1hcmt1cC5zdWJzdHIobG9jLCBzaGlmdCkucmVwbGFjZShyTmV3TGluZSwgXCJcXFxcblwiKSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYmxvY2tUYWdDaGVjayh0YWdOYW1lLCBibG9jaykge1xuXHRcdGlmICh0YWdOYW1lKSB7XG5cdFx0XHR0YWdOYW1lICs9ICd9fSc7XG5cdFx0XHQvL1x0XHRcdCd7e2luY2x1ZGV9fSBibG9jayBoYXMge3svZm9yfX0gd2l0aCBubyBvcGVuIHt7Zm9yfX0nXG5cdFx0XHRzeW50YXhFcnJvcigoXG5cdFx0XHRcdGJsb2NrXG5cdFx0XHRcdFx0PyAne3snICsgYmxvY2sgKyAnfX0gYmxvY2sgaGFzIHt7LycgKyB0YWdOYW1lICsgJyB3aXRob3V0IHt7JyArIHRhZ05hbWVcblx0XHRcdFx0XHQ6ICdVbm1hdGNoZWQgb3IgbWlzc2luZyB7ey8nICsgdGFnTmFtZSkgKyAnLCBpbiB0ZW1wbGF0ZTpcXG4nICsgbWFya3VwKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVRhZyhhbGwsIGJpbmQsIHRhZ05hbWUsIGNvbnZlcnRlciwgY29sb24sIGh0bWwsIGNvZGVUYWcsIHBhcmFtcywgc2xhc2gsIGJpbmQyLCBjbG9zZUJsb2NrLCBpbmRleCkge1xuLypcblxuICAgICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcbi8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19L2dcblxuKD86XG4gIHsoXFxeKT97ICAgICAgICAgICAgYmluZFxuICAoPzpcbiAgICAoXFx3KyAgICAgICAgICAgICB0YWdOYW1lXG4gICAgICAoPz1bXFwvXFxzfV0pXG4gICAgKVxuICAgIHxcbiAgICAoXFx3Kyk/KDopICAgICAgICBjb252ZXJ0ZXIgY29sb25cbiAgICB8XG4gICAgKD4pICAgICAgICAgICAgICBodG1sXG4gICAgfFxuICAgIChcXCopICAgICAgICAgICAgIGNvZGVUYWdcbiAgKVxuICBcXHMqXG4gICggICAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAoPzpbXn1dfH0oPyF9KSkqP1xuICApXG4gIChcXC8pPyAgICAgICAgICAgICAgc2xhc2hcbiAgfFxuICB7KFxcXik/eyAgICAgICAgICAgIGJpbmQyXG4gICg/OlxuICAgICg/OlxcLyhcXHcrKSlcXHMqICAgY2xvc2VCbG9ja1xuICAgIHxcbiAgICAhLS1bXFxzXFxTXSo/LS0gICAgY29tbWVudFxuICApXG4pXG59fS9nXG5cbiovXG5cdFx0aWYgKGNvZGVUYWcgJiYgYmluZCB8fCBzbGFzaCAmJiAhdGFnTmFtZSB8fCBwYXJhbXMgJiYgcGFyYW1zLnNsaWNlKC0xKSA9PT0gXCI6XCIgfHwgYmluZDIpIHtcblx0XHRcdHN5bnRheEVycm9yKGFsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gQnVpbGQgYWJzdHJhY3Qgc3ludGF4IHRyZWUgKEFTVCk6IFt0YWdOYW1lLCBjb252ZXJ0ZXIsIHBhcmFtcywgY29udGVudCwgaGFzaCwgYmluZGluZ3MsIGNvbnRlbnRNYXJrdXBdXG5cdFx0aWYgKGh0bWwpIHtcblx0XHRcdGNvbG9uID0gXCI6XCI7XG5cdFx0XHRjb252ZXJ0ZXIgPSBIVE1MO1xuXHRcdH1cblx0XHRzbGFzaCA9IHNsYXNoIHx8IGlzTGlua0V4cHIgJiYgIWhhc0Vsc2U7XG5cblx0XHR2YXIgbGF0ZSwgb3BlblRhZ05hbWUsIGlzTGF0ZU9iLFxuXHRcdFx0cGF0aEJpbmRpbmdzID0gKGJpbmQgfHwgaXNMaW5rRXhwcikgJiYgW1tdXSwgLy8gcGF0aEJpbmRpbmdzIGlzIGFuIGFycmF5IG9mIGFycmF5cyBmb3IgYXJnIGJpbmRpbmdzIGFuZCBhIGhhc2ggb2YgYXJyYXlzIGZvciBwcm9wIGJpbmRpbmdzXG5cdFx0XHRwcm9wcyA9IFwiXCIsXG5cdFx0XHRhcmdzID0gXCJcIixcblx0XHRcdGN0eFByb3BzID0gXCJcIixcblx0XHRcdHBhcmFtc0FyZ3MgPSBcIlwiLFxuXHRcdFx0cGFyYW1zUHJvcHMgPSBcIlwiLFxuXHRcdFx0cGFyYW1zQ3R4UHJvcHMgPSBcIlwiLFxuXHRcdFx0b25FcnJvciA9IFwiXCIsXG5cdFx0XHR1c2VUcmlnZ2VyID0gXCJcIixcblx0XHRcdC8vIEJsb2NrIHRhZyBpZiBub3Qgc2VsZi1jbG9zaW5nIGFuZCBub3Qge3s6fX0gb3Ige3s+fX0gKHNwZWNpYWwgY2FzZSkgYW5kIG5vdCBhIGRhdGEtbGluayBleHByZXNzaW9uXG5cdFx0XHRibG9jayA9ICFzbGFzaCAmJiAhY29sb247XG5cblx0XHQvLz09PT0gbmVzdGVkIGhlbHBlciBmdW5jdGlvbiA9PT09XG5cdFx0dGFnTmFtZSA9IHRhZ05hbWUgfHwgKHBhcmFtcyA9IHBhcmFtcyB8fCBcIiNkYXRhXCIsIGNvbG9uKTsgLy8ge3s6fX0gaXMgZXF1aXZhbGVudCB0byB7ezojZGF0YX19XG5cdFx0cHVzaHByZWNlZGluZ0NvbnRlbnQoaW5kZXgpO1xuXHRcdGxvYyA9IGluZGV4ICsgYWxsLmxlbmd0aDsgLy8gbG9jYXRpb24gbWFya2VyIC0gcGFyc2VkIHVwIHRvIGhlcmVcblx0XHRpZiAoY29kZVRhZykge1xuXHRcdFx0aWYgKGFsbG93Q29kZSkge1xuXHRcdFx0XHRjb250ZW50LnB1c2goW1wiKlwiLCBcIlxcblwiICsgcGFyYW1zLnJlcGxhY2UoL146LywgXCJyZXQrPSBcIikucmVwbGFjZShyVW5lc2NhcGVRdW90ZXMsIFwiJDFcIikgKyBcIjtcXG5cIl0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGFnTmFtZSkge1xuXHRcdFx0aWYgKHRhZ05hbWUgPT09IFwiZWxzZVwiKSB7XG5cdFx0XHRcdGlmIChyVGVzdEVsc2VJZi50ZXN0KHBhcmFtcykpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcignRm9yIFwie3tlbHNlIGlmIGV4cHJ9fVwiIHVzZSBcInt7ZWxzZSBleHByfX1cIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBhdGhCaW5kaW5ncyA9IGN1cnJlbnRbOV0gJiYgW1tdXTtcblx0XHRcdFx0Y3VycmVudFsxMF0gPSBtYXJrdXAuc3Vic3RyaW5nKGN1cnJlbnRbMTBdLCBpbmRleCk7IC8vIGNvbnRlbnRNYXJrdXAgZm9yIGJsb2NrIHRhZ1xuXHRcdFx0XHRvcGVuVGFnTmFtZSA9IGN1cnJlbnRbMTFdIHx8IGN1cnJlbnRbMF0gfHwgc3ludGF4RXJyb3IoXCJNaXNtYXRjaGVkOiBcIiArIGFsbCk7XG5cdFx0XHRcdC8vIGN1cnJlbnRbMF0gaXMgdGFnTmFtZSwgYnV0IGZvciB7e2Vsc2V9fSBub2RlcywgY3VycmVudFsxMV0gaXMgdGFnTmFtZSBvZiBwcmVjZWRpbmcgb3BlbiB0YWdcblx0XHRcdFx0Y3VycmVudCA9IHN0YWNrLnBvcCgpO1xuXHRcdFx0XHRjb250ZW50ID0gY3VycmVudFsyXTtcblx0XHRcdFx0YmxvY2sgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhcmFtcykge1xuXHRcdFx0XHQvLyByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgcGFyYW1zIHN0cmluZywgdG8gYXZvaWQgY29tcGlsZWQgY29kZSBlcnJvcnMgZm9yIHVudGVybWluYXRlZCBzdHJpbmdzXG5cdFx0XHRcdHBhcnNlUGFyYW1zKHBhcmFtcy5yZXBsYWNlKHJOZXdMaW5lLCBcIiBcIiksIHBhdGhCaW5kaW5ncywgdG1wbCwgaXNMaW5rRXhwcilcblx0XHRcdFx0XHQucmVwbGFjZShyQnVpbGRIYXNoLCBmdW5jdGlvbihhbGwsIG9uZXJyb3IsIGlzQ3R4UHJtLCBrZXksIGtleVRva2VuLCBrZXlWYWx1ZSwgYXJnLCBwYXJhbSkge1xuXHRcdFx0XHRcdFx0aWYgKGtleSA9PT0gXCJ0aGlzOlwiKSB7XG5cdFx0XHRcdFx0XHRcdGtleVZhbHVlID0gXCJ1bmRlZmluZWRcIjsgLy8gdGhpcz1zb21lLnBhdGggaXMgYWx3YXlzIGEgdG8gcGFyYW1ldGVyIChvbmUtd2F5KSwgc28gZG9uJ3QgbmVlZCB0byBjb21waWxlL2V2YWx1YXRlIHNvbWUucGF0aCBpbml0aWFsaXphdGlvblxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRcdGlzTGF0ZU9iID0gaXNMYXRlT2IgfHwgcGFyYW1bMF0gPT09IFwiQFwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0a2V5ID0gXCInXCIgKyBrZXlUb2tlbiArIFwiJzpcIjtcblx0XHRcdFx0XHRcdGlmIChhcmcpIHtcblx0XHRcdFx0XHRcdFx0YXJncyArPSBpc0N0eFBybSArIGtleVZhbHVlICsgXCIsXCI7XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0FyZ3MgKz0gXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNDdHhQcm0pIHsgLy8gQ29udGV4dHVhbCBwYXJhbWV0ZXIsIH5mb289ZXhwclxuXHRcdFx0XHRcdFx0XHRjdHhQcm9wcyArPSBrZXkgKyAnai5fY3AoJyArIGtleVZhbHVlICsgJyxcIicgKyBwYXJhbSArICdcIix2aWV3KSwnO1xuXHRcdFx0XHRcdFx0XHQvLyBDb21waWxlZCBjb2RlIGZvciBldmFsdWF0aW5nIHRhZ0N0eCBvbiBhIHRhZyB3aWxsIGhhdmU6IGN0eDp7J2Zvbyc6ai5fY3AoY29tcGlsZWRFeHByLCBcImV4cHJcIiwgdmlldyl9XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0N0eFByb3BzICs9IGtleSArIFwiJ1wiICsgcGFyYW0gKyBcIicsXCI7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG9uZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0b25FcnJvciArPSBrZXlWYWx1ZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGlmIChrZXlUb2tlbiA9PT0gXCJ0cmlnZ2VyXCIpIHtcblx0XHRcdFx0XHRcdFx0XHR1c2VUcmlnZ2VyICs9IGtleVZhbHVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChrZXlUb2tlbiA9PT0gXCJsYXRlUmVuZGVyXCIpIHtcblx0XHRcdFx0XHRcdFx0XHRsYXRlID0gcGFyYW0gIT09IFwiZmFsc2VcIjsgLy8gUmVuZGVyIGFmdGVyIGZpcnN0IHBhc3Ncblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRwcm9wcyArPSBrZXkgKyBrZXlWYWx1ZSArIFwiLFwiO1xuXHRcdFx0XHRcdFx0XHRwYXJhbXNQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0XHRoYXNIYW5kbGVycyA9IGhhc0hhbmRsZXJzIHx8IHJIYXNIYW5kbGVycy50ZXN0KGtleVRva2VuKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0XHRcdH0pLnNsaWNlKDAsIC0xKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0pIHtcblx0XHRcdFx0cGF0aEJpbmRpbmdzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGJpbmRpbmcgdGhhdCB3YXMgcHJlcGFyZWQgZm9yIG5leHQgYXJnLiAoVGhlcmUgaXMgYWx3YXlzIGFuIGV4dHJhIG9uZSByZWFkeSkuXG5cdFx0XHR9XG5cblx0XHRcdG5ld05vZGUgPSBbXG5cdFx0XHRcdFx0dGFnTmFtZSxcblx0XHRcdFx0XHRjb252ZXJ0ZXIgfHwgISFjb252ZXJ0QmFjayB8fCBoYXNIYW5kbGVycyB8fCBcIlwiLFxuXHRcdFx0XHRcdGJsb2NrICYmIFtdLFxuXHRcdFx0XHRcdHBhcnNlZFBhcmFtKHBhcmFtc0FyZ3MgfHwgKHRhZ05hbWUgPT09IFwiOlwiID8gXCInI2RhdGEnLFwiIDogXCJcIiksIHBhcmFtc1Byb3BzLCBwYXJhbXNDdHhQcm9wcyksIC8vIHt7On19IGVxdWl2YWxlbnQgdG8ge3s6I2RhdGF9fVxuXHRcdFx0XHRcdHBhcnNlZFBhcmFtKGFyZ3MgfHwgKHRhZ05hbWUgPT09IFwiOlwiID8gXCJkYXRhLFwiIDogXCJcIiksIHByb3BzLCBjdHhQcm9wcyksXG5cdFx0XHRcdFx0b25FcnJvcixcblx0XHRcdFx0XHR1c2VUcmlnZ2VyLFxuXHRcdFx0XHRcdGxhdGUsXG5cdFx0XHRcdFx0aXNMYXRlT2IsXG5cdFx0XHRcdFx0cGF0aEJpbmRpbmdzIHx8IDBcblx0XHRcdFx0XTtcblx0XHRcdGNvbnRlbnQucHVzaChuZXdOb2RlKTtcblx0XHRcdGlmIChibG9jaykge1xuXHRcdFx0XHRzdGFjay5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRjdXJyZW50ID0gbmV3Tm9kZTtcblx0XHRcdFx0Y3VycmVudFsxMF0gPSBsb2M7IC8vIFN0b3JlIGN1cnJlbnQgbG9jYXRpb24gb2Ygb3BlbiB0YWcsIHRvIGJlIGFibGUgdG8gYWRkIGNvbnRlbnRNYXJrdXAgd2hlbiB3ZSByZWFjaCBjbG9zaW5nIHRhZ1xuXHRcdFx0XHRjdXJyZW50WzExXSA9IG9wZW5UYWdOYW1lOyAvLyBVc2VkIGZvciBjaGVja2luZyBzeW50YXggKG1hdGNoaW5nIGNsb3NlIHRhZylcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGNsb3NlQmxvY2spIHtcblx0XHRcdGJsb2NrVGFnQ2hlY2soY2xvc2VCbG9jayAhPT0gY3VycmVudFswXSAmJiBjbG9zZUJsb2NrICE9PSBjdXJyZW50WzExXSAmJiBjbG9zZUJsb2NrLCBjdXJyZW50WzBdKTsgLy8gQ2hlY2sgbWF0Y2hpbmcgY2xvc2UgdGFnIG5hbWVcblx0XHRcdGN1cnJlbnRbMTBdID0gbWFya3VwLnN1YnN0cmluZyhjdXJyZW50WzEwXSwgaW5kZXgpOyAvLyBjb250ZW50TWFya3VwIGZvciBibG9jayB0YWdcblx0XHRcdGN1cnJlbnQgPSBzdGFjay5wb3AoKTtcblx0XHR9XG5cdFx0YmxvY2tUYWdDaGVjayghY3VycmVudCAmJiBjbG9zZUJsb2NrKTtcblx0XHRjb250ZW50ID0gY3VycmVudFsyXTtcblx0fVxuXHQvLz09PT0gL2VuZCBvZiBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblxuXHR2YXIgaSwgcmVzdWx0LCBuZXdOb2RlLCBoYXNIYW5kbGVycywgYmluZGluZ3MsXG5cdFx0YWxsb3dDb2RlID0gJHN1YlNldHRpbmdzLmFsbG93Q29kZSB8fCB0bXBsICYmIHRtcGwuYWxsb3dDb2RlXG5cdFx0XHR8fCAkdmlld3NTZXR0aW5ncy5hbGxvd0NvZGUgPT09IHRydWUsIC8vIGluY2x1ZGUgZGlyZWN0IHNldHRpbmcgb2Ygc2V0dGluZ3MuYWxsb3dDb2RlIHRydWUgZm9yIGJhY2t3YXJkIGNvbXBhdCBvbmx5XG5cdFx0YXN0VG9wID0gW10sXG5cdFx0bG9jID0gMCxcblx0XHRzdGFjayA9IFtdLFxuXHRcdGNvbnRlbnQgPSBhc3RUb3AsXG5cdFx0Y3VycmVudCA9IFssLGFzdFRvcF07XG5cblx0aWYgKGFsbG93Q29kZSAmJiB0bXBsLl9pcykge1xuXHRcdHRtcGwuYWxsb3dDb2RlID0gYWxsb3dDb2RlO1xuXHR9XG5cbi8vVE9ET1x0cmVzdWx0ID0gdG1wbEZuc0NhY2hlW21hcmt1cF07IC8vIE9ubHkgY2FjaGUgaWYgdGVtcGxhdGUgaXMgbm90IG5hbWVkIGFuZCBtYXJrdXAgbGVuZ3RoIDwgLi4uLFxuLy9hbmQgdGhlcmUgYXJlIG5vIGJpbmRpbmdzIG9yIHN1YnRlbXBsYXRlcz8/IENvbnNpZGVyIHN0YW5kYXJkIG9wdGltaXphdGlvbiBmb3IgZGF0YS1saW5rPVwiYS5iLmNcIlxuLy9cdFx0aWYgKHJlc3VsdCkge1xuLy9cdFx0XHR0bXBsLmZuID0gcmVzdWx0O1xuLy9cdFx0fSBlbHNlIHtcblxuLy9cdFx0cmVzdWx0ID0gbWFya3VwO1xuXHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdGlmIChjb252ZXJ0QmFjayAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRtYXJrdXAgPSBtYXJrdXAuc2xpY2UoMCwgLWNvbnZlcnRCYWNrLmxlbmd0aCAtIDIpICsgZGVsaW1DbG9zZUNoYXIwO1xuXHRcdH1cblx0XHRtYXJrdXAgPSBkZWxpbU9wZW5DaGFyMCArIG1hcmt1cCArIGRlbGltQ2xvc2VDaGFyMTtcblx0fVxuXG5cdGJsb2NrVGFnQ2hlY2soc3RhY2tbMF0gJiYgc3RhY2tbMF1bMl0ucG9wKClbMF0pO1xuXHQvLyBCdWlsZCB0aGUgQVNUIChhYnN0cmFjdCBzeW50YXggdHJlZSkgdW5kZXIgYXN0VG9wXG5cdG1hcmt1cC5yZXBsYWNlKHJUYWcsIHBhcnNlVGFnKTtcblxuXHRwdXNocHJlY2VkaW5nQ29udGVudChtYXJrdXAubGVuZ3RoKTtcblxuXHRpZiAobG9jID0gYXN0VG9wW2FzdFRvcC5sZW5ndGggLSAxXSkge1xuXHRcdGJsb2NrVGFnQ2hlY2sodHlwZW9mIGxvYyAhPT0gU1RSSU5HICYmICgrbG9jWzEwXSA9PT0gbG9jWzEwXSkgJiYgbG9jWzBdKTtcblx0fVxuLy9cdFx0XHRyZXN1bHQgPSB0bXBsRm5zQ2FjaGVbbWFya3VwXSA9IGJ1aWxkQ29kZShhc3RUb3AsIHRtcGwpO1xuLy9cdFx0fVxuXG5cdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0cmVzdWx0ID0gYnVpbGRDb2RlKGFzdFRvcCwgbWFya3VwLCBpc0xpbmtFeHByKTtcblx0XHRiaW5kaW5ncyA9IFtdO1xuXHRcdGkgPSBhc3RUb3AubGVuZ3RoO1xuXHRcdHdoaWxlIChpLS0pIHtcblx0XHRcdGJpbmRpbmdzLnVuc2hpZnQoYXN0VG9wW2ldWzldKTsgLy8gV2l0aCBkYXRhLWxpbmsgZXhwcmVzc2lvbnMsIHBhdGhCaW5kaW5ncyBhcnJheSBmb3IgdGFnQ3R4W2ldIGlzIGFzdFRvcFtpXVs5XVxuXHRcdH1cblx0XHRzZXRQYXRocyhyZXN1bHQsIGJpbmRpbmdzKTtcblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCB0bXBsKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzZXRQYXRocyhmbiwgcGF0aHNBcnIpIHtcblx0dmFyIGtleSwgcGF0aHMsXG5cdFx0aSA9IDAsXG5cdFx0bCA9IHBhdGhzQXJyLmxlbmd0aDtcblx0Zm4uZGVwcyA9IFtdO1xuXHRmbi5wYXRocyA9IFtdOyAvLyBUaGUgYXJyYXkgb2YgcGF0aCBiaW5kaW5nIChhcnJheS9kaWN0aW9uYXJ5KXMgZm9yIGVhY2ggdGFnL2Vsc2UgYmxvY2sncyBhcmdzIGFuZCBwcm9wc1xuXHRmb3IgKDsgaSA8IGw7IGkrKykge1xuXHRcdGZuLnBhdGhzLnB1c2gocGF0aHMgPSBwYXRoc0FycltpXSk7XG5cdFx0Zm9yIChrZXkgaW4gcGF0aHMpIHtcblx0XHRcdGlmIChrZXkgIT09IFwiX2pzdnRvXCIgJiYgcGF0aHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBwYXRoc1trZXldLmxlbmd0aCAmJiAhcGF0aHNba2V5XS5za3ApIHtcblx0XHRcdFx0Zm4uZGVwcyA9IGZuLmRlcHMuY29uY2F0KHBhdGhzW2tleV0pOyAvLyBkZXBzIGlzIHRoZSBjb25jYXRlbmF0aW9uIG9mIHRoZSBwYXRocyBhcnJheXMgZm9yIHRoZSBkaWZmZXJlbnQgYmluZGluZ3Ncblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcGFyc2VkUGFyYW0oYXJncywgcHJvcHMsIGN0eCkge1xuXHRyZXR1cm4gW2FyZ3Muc2xpY2UoMCwgLTEpLCBwcm9wcy5zbGljZSgwLCAtMSksIGN0eC5zbGljZSgwLCAtMSldO1xufVxuXG5mdW5jdGlvbiBwYXJhbVN0cnVjdHVyZShwYXJhbUNvZGUsIHBhcmFtVmFscykge1xuXHRyZXR1cm4gJ1xcblxcdHBhcmFtczp7YXJnczpbJyArIHBhcmFtQ29kZVswXSArICddLFxcblxcdHByb3BzOnsnICsgcGFyYW1Db2RlWzFdICsgJ30nXG5cdFx0KyAocGFyYW1Db2RlWzJdID8gJyxcXG5cXHRjdHg6eycgKyBwYXJhbUNvZGVbMl0gKyAnfScgOiBcIlwiKVxuXHRcdCsgJ30sXFxuXFx0YXJnczpbJyArIHBhcmFtVmFsc1swXSArICddLFxcblxcdHByb3BzOnsnICsgcGFyYW1WYWxzWzFdICsgJ30nXG5cdFx0KyAocGFyYW1WYWxzWzJdID8gJyxcXG5cXHRjdHg6eycgKyBwYXJhbVZhbHNbMl0gKyAnfScgOiBcIlwiKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXJhbXMocGFyYW1zLCBwYXRoQmluZGluZ3MsIHRtcGwsIGlzTGlua0V4cHIpIHtcblxuXHRmdW5jdGlvbiBwYXJzZVRva2VucyhhbGwsIGxmdFBybjAsIGxmdFBybiwgYm91bmQsIHBhdGgsIG9wZXJhdG9yLCBlcnIsIGVxLCBwYXRoMiwgbGF0ZSwgcHJuLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29tbWEsIGxmdFBybjIsIGFwb3MsIHF1b3QsIHJ0UHJuLCBydFBybkRvdCwgcHJuMiwgc3BhY2UsIGluZGV4LCBmdWxsKSB7XG5cdC8vIC8oXFwoKSg/PVxccypcXCgpfCg/OihbKFtdKVxccyopPyg/OihcXF4/KSh+P1tcXHckLl5dKyk/XFxzKigoXFwrXFwrfC0tKXxcXCt8LXx+KD8hW1xcdyRdKXwmJnxcXHxcXHx8PT09fCE9PXw9PXwhPXw8PXw+PXxbPD4lKjo/XFwvXXwoPSkpXFxzKnwoISo/KEApP1sjfl0/W1xcdyQuXl0rKShbKFtdKT8pfCgsXFxzKil8KD86KFxcKClcXHMqKT9cXFxcPyg/OignKXwoXCIpKXwoPzpcXHMqKChbKVxcXV0pKD89Wy5eXXxcXHMqJHxbXihbXSl8WylcXF1dKShbKFtdPykpfChcXHMrKS9nLFxuXHQvL2xmdFBybjAgICAgICAgICAgIGxmdFBybiAgICAgICAgIGJvdW5kICAgICBwYXRoICAgICAgICAgICAgICAgb3BlcmF0b3IgICAgIGVyciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxICAgICAgcGF0aDIgbGF0ZSAgICAgICAgICAgIHBybiAgICAgIGNvbW1hICBsZnRQcm4yICAgICAgICAgIGFwb3MgcXVvdCAgICAgICAgcnRQcm4gIHJ0UHJuRG90ICAgICAgICAgICAgICAgICAgcHJuMiAgICAgc3BhY2Vcblx0Ly8gKGxlZnQgcGFyZW4/IGZvbGxvd2VkIGJ5IChwYXRoPyBmb2xsb3dlZCBieSBvcGVyYXRvcikgb3IgKHBhdGggZm9sbG93ZWQgYnkgcGFyZW4/KSkgb3IgY29tbWEgb3IgYXBvcyBvciBxdW90IG9yIHJpZ2h0IHBhcmVuIG9yIHNwYWNlXG5cblx0XHRmdW5jdGlvbiBwYXJzZVBhdGgoYWxsUGF0aCwgbm90LCBvYmplY3QsIGhlbHBlciwgdmlldywgdmlld1Byb3BlcnR5LCBwYXRoVG9rZW5zLCBsZWFmVG9rZW4pIHtcblx0XHRcdC8vIC9eKCEqPykoPzpudWxsfHRydWV8ZmFsc2V8XFxkW1xcZC5dKnwoW1xcdyRdK3xcXC58fihbXFx3JF0rKXwjKHZpZXd8KFtcXHckXSspKT8pKFtcXHckLl5dKj8pKD86Wy5bXl0oW1xcdyRdKylcXF0/KT8pJC9nLFxuXHRcdFx0Ly8gICAgbm90ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdCAgICAgaGVscGVyICAgIHZpZXcgIHZpZXdQcm9wZXJ0eSBwYXRoVG9rZW5zICAgICAgbGVhZlRva2VuXG5cdFx0XHRzdWJQYXRoID0gb2JqZWN0ID09PSBcIi5cIjtcblx0XHRcdGlmIChvYmplY3QpIHtcblx0XHRcdFx0cGF0aCA9IHBhdGguc2xpY2Uobm90Lmxlbmd0aCk7XG5cdFx0XHRcdGlmICgvXlxcLj9jb25zdHJ1Y3RvciQvLnRlc3QobGVhZlRva2VufHxwYXRoKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKGFsbFBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghc3ViUGF0aCkge1xuXHRcdFx0XHRcdGFsbFBhdGggPSAobGF0ZSAvLyBsYXRlIHBhdGggQGEuYi5jOiBub3QgdGhyb3cgb24gJ3Byb3BlcnR5IG9mIHVuZGVmaW5lZCcgaWYgYSB1bmRlZmluZWQsIGFuZCB3aWxsIHVzZSBfZ2V0T2IoKSBhZnRlciBsaW5raW5nIHRvIHJlc29sdmUgbGF0ZS5cblx0XHRcdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/ICcnIDogJyhsdE9iLmx0PWx0T2IubHR8fCcpICsgJyhvYj0nXG5cdFx0XHRcdFx0XHRcdDogXCJcIlxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0KyAoaGVscGVyXG5cdFx0XHRcdFx0XHRcdD8gJ3ZpZXcuY3R4UHJtKFwiJyArIGhlbHBlciArICdcIiknXG5cdFx0XHRcdFx0XHRcdDogdmlld1xuXHRcdFx0XHRcdFx0XHRcdD8gXCJ2aWV3XCJcblx0XHRcdFx0XHRcdFx0XHQ6IFwiZGF0YVwiKVxuXHRcdFx0XHRcdFx0KyAobGF0ZVxuXHRcdFx0XHRcdFx0XHQ/ICcpPT09dW5kZWZpbmVkJyArIChpc0xpbmtFeHByID8gJycgOiAnKScpICsgJz9cIlwiOnZpZXcuX2dldE9iKG9iLFwiJ1xuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdCsgKGxlYWZUb2tlblxuXHRcdFx0XHRcdFx0XHQ/ICh2aWV3UHJvcGVydHlcblx0XHRcdFx0XHRcdFx0XHQ/IFwiLlwiICsgdmlld1Byb3BlcnR5XG5cdFx0XHRcdFx0XHRcdFx0OiBoZWxwZXJcblx0XHRcdFx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0XHRcdFx0OiAodmlldyA/IFwiXCIgOiBcIi5cIiArIG9iamVjdClcblx0XHRcdFx0XHRcdFx0XHQpICsgKHBhdGhUb2tlbnMgfHwgXCJcIilcblx0XHRcdFx0XHRcdFx0OiAobGVhZlRva2VuID0gaGVscGVyID8gXCJcIiA6IHZpZXcgPyB2aWV3UHJvcGVydHkgfHwgXCJcIiA6IG9iamVjdCwgXCJcIikpO1xuXHRcdFx0XHRcdGFsbFBhdGggPSBhbGxQYXRoICsgKGxlYWZUb2tlbiA/IFwiLlwiICsgbGVhZlRva2VuIDogXCJcIik7XG5cblx0XHRcdFx0XHRhbGxQYXRoID0gbm90ICsgKGFsbFBhdGguc2xpY2UoMCwgOSkgPT09IFwidmlldy5kYXRhXCJcblx0XHRcdFx0XHRcdD8gYWxsUGF0aC5zbGljZSg1KSAvLyBjb252ZXJ0ICN2aWV3LmRhdGEuLi4gdG8gZGF0YS4uLlxuXHRcdFx0XHRcdFx0OiBhbGxQYXRoKVxuXHRcdFx0XHRcdCsgKGxhdGVcblx0XHRcdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/ICdcIic6ICdcIixsdE9iJykgKyAocHJuID8gJywxKSc6JyknKVxuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0YmluZHMgPSBuYW1lZCA9PT0gXCJfbGlua1RvXCIgPyAoYmluZHRvID0gcGF0aEJpbmRpbmdzLl9qc3Z0byA9IHBhdGhCaW5kaW5ncy5fanN2dG8gfHwgW10pIDogYm5kQ3R4LmJkO1xuXHRcdFx0XHRcdGlmICh0aGVPYiA9IHN1YlBhdGggJiYgYmluZHNbYmluZHMubGVuZ3RoLTFdKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhlT2IuX2NwZm4pIHsgLy8gQ29tcHV0ZWQgcHJvcGVydHkgZXhwck9iXG5cdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYikge1xuXHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iLnBybSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0aGVPYi5ibmQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHBhdGggPSBcIl5cIiArIHBhdGguc2xpY2UoMSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHRoZU9iLnNiID0gcGF0aDtcblx0XHRcdFx0XHRcdFx0XHR0aGVPYi5ibmQgPSB0aGVPYi5ibmQgfHwgcGF0aFswXSA9PT0gXCJeXCI7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YmluZHMucHVzaChwYXRoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHBybiAmJiAhc3ViUGF0aCkge1xuXHRcdFx0XHRcdFx0cGF0aFN0YXJ0W2ZuRHBdID0gaW5kO1xuXHRcdFx0XHRcdFx0Y29tcGlsZWRQYXRoU3RhcnRbZm5EcF0gPSBjb21waWxlZFBhdGhbZm5EcF0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFsbFBhdGg7XG5cdFx0fVxuXG5cdFx0Ly9ib3VuZCA9IGJpbmRpbmdzICYmIGJvdW5kO1xuXHRcdGlmIChib3VuZCAmJiAhZXEpIHtcblx0XHRcdHBhdGggPSBib3VuZCArIHBhdGg7IC8vIGUuZy4gc29tZS5mbiguLi4pXnNvbWUucGF0aCAtIHNvIGhlcmUgcGF0aCBpcyBcIl5zb21lLnBhdGhcIlxuXHRcdH1cblx0XHRvcGVyYXRvciA9IG9wZXJhdG9yIHx8IFwiXCI7XG5cdFx0bGZ0UHJuMiA9IGxmdFBybjIgfHwgXCJcIjtcblx0XHRsZnRQcm4gPSBsZnRQcm4gfHwgbGZ0UHJuMCB8fCBsZnRQcm4yO1xuXHRcdHBhdGggPSBwYXRoIHx8IHBhdGgyO1xuXG5cdFx0aWYgKGxhdGUgJiYgKGxhdGUgPSAhL1xcKXxdLy50ZXN0KGZ1bGxbaW5kZXgtMV0pKSkge1xuXHRcdFx0cGF0aCA9IHBhdGguc2xpY2UoMSkuc3BsaXQoXCIuXCIpLmpvaW4oXCJeXCIpOyAvLyBMYXRlIHBhdGggQHouYi5jLiBVc2UgXCJeXCIgcmF0aGVyIHRoYW4gXCIuXCIgdG8gZW5zdXJlIHRoYXQgZGVlcCBiaW5kaW5nIHdpbGwgYmUgdXNlZFxuXHRcdH1cblx0XHQvLyBDb3VsZCBkbyB0aGlzIC0gYnV0IG5vdCB3b3J0aCBwZXJmIGNvc3Q/PyA6LVxuXHRcdC8vIGlmICghcGF0aC5sYXN0SW5kZXhPZihcIiNkYXRhLlwiLCAwKSkgeyBwYXRoID0gcGF0aC5zbGljZSg2KTsgfSAvLyBJZiBwYXRoIHN0YXJ0cyB3aXRoIFwiI2RhdGEuXCIsIHJlbW92ZSB0aGF0LlxuXHRcdHBybiA9IHBybiB8fCBwcm4yIHx8IFwiXCI7XG5cdFx0dmFyIGV4cHIsIGJpbmRzLCB0aGVPYiwgbmV3T2IsIHN1YlBhdGgsIGxmdFBybkZDYWxsLCByZXQsXG5cdFx0XHRpbmQgPSBpbmRleDtcblxuXHRcdGlmICghYXBvc2VkICYmICFxdW90ZWQpIHtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0c3ludGF4RXJyb3IocGFyYW1zKTtcblx0XHRcdH1cblx0XHRcdGlmIChydFBybkRvdCAmJiBiaW5kaW5ncykge1xuXHRcdFx0XHQvLyBUaGlzIGlzIGEgYmluZGluZyB0byBhIHBhdGggaW4gd2hpY2ggYW4gb2JqZWN0IGlzIHJldHVybmVkIGJ5IGEgaGVscGVyL2RhdGEgZnVuY3Rpb24vZXhwcmVzc2lvbiwgZS5nLiBmb28oKV54Lnkgb3IgKGE/YjpjKV54Lnlcblx0XHRcdFx0Ly8gV2UgY3JlYXRlIGEgY29tcGlsZWQgZnVuY3Rpb24gdG8gZ2V0IHRoZSBvYmplY3QgaW5zdGFuY2UgKHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIGRlcGVuZGVudCBkYXRhIG9mIHRoZSBzdWJleHByZXNzaW9uIGNoYW5nZXMsXG5cdFx0XHRcdC8vIHRvIHJldHVybiB0aGUgbmV3IG9iamVjdCwgYW5kIHRyaWdnZXIgcmUtYmluZGluZyBvZiB0aGUgc3Vic2VxdWVudCBwYXRoKVxuXHRcdFx0XHRleHByID0gcGF0aFN0YXJ0W2ZuRHAtMV07XG5cdFx0XHRcdGlmIChmdWxsLmxlbmd0aCAtIDEgPiBpbmQgLSAoZXhwciB8fCAwKSkgeyAvLyBXZSBuZWVkIHRvIGNvbXBpbGUgYSBzdWJleHByZXNzaW9uXG5cdFx0XHRcdFx0ZXhwciA9ICQudHJpbShmdWxsLnNsaWNlKGV4cHIsIGluZCArIGFsbC5sZW5ndGgpKTtcblx0XHRcdFx0XHRiaW5kcyA9IGJpbmR0byB8fCBibmRTdGFja1tmbkRwLTFdLmJkO1xuXHRcdFx0XHRcdC8vIEluc2VydCBleHByT2Igb2JqZWN0LCB0byBiZSB1c2VkIGR1cmluZyBiaW5kaW5nIHRvIHJldHVybiB0aGUgY29tcHV0ZWQgb2JqZWN0XG5cdFx0XHRcdFx0dGhlT2IgPSBiaW5kc1tiaW5kcy5sZW5ndGgtMV07XG5cdFx0XHRcdFx0aWYgKHRoZU9iICYmIHRoZU9iLnBybSkge1xuXHRcdFx0XHRcdFx0d2hpbGUgKHRoZU9iLnNiICYmIHRoZU9iLnNiLnBybSkge1xuXHRcdFx0XHRcdFx0XHR0aGVPYiA9IHRoZU9iLnNiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0bmV3T2IgPSB0aGVPYi5zYiA9IHtwYXRoOiB0aGVPYi5zYiwgYm5kOiB0aGVPYi5ibmR9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRiaW5kcy5wdXNoKG5ld09iID0ge3BhdGg6IGJpbmRzLnBvcCgpfSk7IC8vIEluc2VydCBleHByT2Igb2JqZWN0LCB0byBiZSB1c2VkIGR1cmluZyBiaW5kaW5nIHRvIHJldHVybiB0aGUgY29tcHV0ZWQgb2JqZWN0XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0aGVPYiAmJiB0aGVPYi5zYiA9PT0gbmV3T2IpIHtcblx0XHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSA9IGNvbXBpbGVkUGF0aFtmbkRwLTFdLnNsaWNlKHRoZU9iLl9jcFB0aFN0KSArIGNvbXBpbGVkUGF0aFtmbkRwXTtcblx0XHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwLTFdID0gY29tcGlsZWRQYXRoW2ZuRHAtMV0uc2xpY2UoMCwgdGhlT2IuX2NwUHRoU3QpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXdPYi5fY3BQdGhTdCA9IGNvbXBpbGVkUGF0aFN0YXJ0W2ZuRHAtMV07XG5cdFx0XHRcdFx0bmV3T2IuX2NwS2V5ID0gZXhwcjtcblxuXHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSArPSBmdWxsLnNsaWNlKHByZXZJbmRleCwgaW5kZXgpO1xuXHRcdFx0XHRcdHByZXZJbmRleCA9IGluZGV4O1xuXG5cdFx0XHRcdFx0bmV3T2IuX2NwZm4gPSBjcEZuU3RvcmVbZXhwcl0gPSBjcEZuU3RvcmVbZXhwcl0gfHwgLy8gQ29tcGlsZWQgZnVuY3Rpb24gZm9yIGNvbXB1dGVkIHZhbHVlOiBnZXQgZnJvbSBzdG9yZSwgb3IgY29tcGlsZSBhbmQgc3RvcmVcblx0XHRcdFx0XHRcdG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqXCIsIC8vIENvbXBpbGVkIGZ1bmN0aW9uIGZvciBjb21wdXRlZCB2YWx1ZSBpbiB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFwiLy9cIiArIGV4cHIgKyBcIlxcbnZhciB2O1xcbnJldHVybiAoKHY9XCIgKyBjb21waWxlZFBhdGhbZm5EcF0gKyAocnRQcm4gPT09IFwiXVwiID8gXCIpXVwiIDogcnRQcm4pICsgXCIpIT1udWxsP3Y6bnVsbCk7XCIpO1xuXG5cdFx0XHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHAtMV0gKz0gKGZuQ2FsbFtwcm5EcF0gJiYgJHN1YlNldHRpbmdzQWR2YW5jZWQuY2FjaGUgPyBcInZpZXcuZ2V0Q2FjaGUoXFxcIlwiICsgZXhwci5yZXBsYWNlKHJFc2NhcGVRdW90ZXMsIFwiXFxcXCQmXCIpICsgXCJcXFwiXCIgOiBjb21waWxlZFBhdGhbZm5EcF0pO1xuXG5cdFx0XHRcdFx0bmV3T2IucHJtID0gYm5kQ3R4LmJkO1xuXHRcdFx0XHRcdG5ld09iLmJuZCA9IG5ld09iLmJuZCB8fCBuZXdPYi5wYXRoICYmIG5ld09iLnBhdGguaW5kZXhPZihcIl5cIikgPj0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gPSBcIlwiO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBybiA9PT0gXCJbXCIpIHtcblx0XHRcdFx0cHJuID0gXCJbai5fc3EoXCI7XG5cdFx0XHR9XG5cdFx0XHRpZiAobGZ0UHJuID09PSBcIltcIikge1xuXHRcdFx0XHRsZnRQcm4gPSBcIltqLl9zcShcIjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0ID0gKGFwb3NlZFxuXHRcdFx0Ly8gd2l0aGluIHNpbmdsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHQ/IChhcG9zZWQgPSAhYXBvcywgKGFwb3NlZCA/IGFsbCA6IGxmdFBybjIgKyAnXCInKSlcblx0XHRcdDogcXVvdGVkXG5cdFx0XHQvLyB3aXRoaW4gZG91YmxlLXF1b3RlZCBzdHJpbmdcblx0XHRcdFx0PyAocXVvdGVkID0gIXF1b3QsIChxdW90ZWQgPyBhbGwgOiBsZnRQcm4yICsgJ1wiJykpXG5cdFx0XHRcdDpcblx0XHRcdChcblx0XHRcdFx0KGxmdFByblxuXHRcdFx0XHRcdD8gKFxuXHRcdFx0XHRcdFx0cHJuU3RhY2tbKytwcm5EcF0gPSB0cnVlLFxuXHRcdFx0XHRcdFx0cHJuSW5kW3BybkRwXSA9IDAsXG5cdFx0XHRcdFx0XHRiaW5kaW5ncyAmJiAoXG5cdFx0XHRcdFx0XHRcdHBhdGhTdGFydFtmbkRwKytdID0gaW5kKyssXG5cdFx0XHRcdFx0XHRcdGJuZEN0eCA9IGJuZFN0YWNrW2ZuRHBdID0ge2JkOiBbXX0sXG5cdFx0XHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSA9IFwiXCIsXG5cdFx0XHRcdFx0XHRcdGNvbXBpbGVkUGF0aFN0YXJ0W2ZuRHBdID0gMVxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdGxmdFBybikgLy8gTGVmdCBwYXJlbiwgKG5vdCBhIGZ1bmN0aW9uIGNhbGwgcGFyZW4pXG5cdFx0XHRcdFx0OiBcIlwiKVxuXHRcdFx0XHQrIChzcGFjZVxuXHRcdFx0XHRcdD8gKHBybkRwXG5cdFx0XHRcdFx0XHQ/IFwiXCIgLy8gQSBzcGFjZSB3aXRoaW4gcGFyZW5zIG9yIHdpdGhpbiBmdW5jdGlvbiBjYWxsIHBhcmVucywgc28gbm90IGEgc2VwYXJhdG9yIGZvciB0YWcgYXJnc1xuXHRcdFx0Ly8gTmV3IGFyZyBvciBwcm9wIC0gc28gaW5zZXJ0IGJhY2tzcGFjZSBcXGIgKFxceDA4KSBhcyBzZXBhcmF0b3IgZm9yIG5hbWVkIHBhcmFtcywgdXNlZCBzdWJzZXF1ZW50bHkgYnkgckJ1aWxkSGFzaCwgYW5kIHByZXBhcmUgbmV3IGJpbmRpbmdzIGFycmF5XG5cdFx0XHRcdFx0XHQ6IChwYXJhbUluZGV4ID0gZnVsbC5zbGljZShwYXJhbUluZGV4LCBpbmQpLCBuYW1lZFxuXHRcdFx0XHRcdFx0XHQ/IChuYW1lZCA9IGJvdW5kTmFtZSA9IGJpbmR0byA9IGZhbHNlLCBcIlxcYlwiKVxuXHRcdFx0XHRcdFx0XHQ6IFwiXFxiLFwiKSArIHBhcmFtSW5kZXggKyAocGFyYW1JbmRleCA9IGluZCArIGFsbC5sZW5ndGgsIGJpbmRpbmdzICYmIHBhdGhCaW5kaW5ncy5wdXNoKGJuZEN0eC5iZCA9IFtdKSwgXCJcXGJcIilcblx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0OiBlcVxuXHRcdFx0Ly8gbmFtZWQgcGFyYW0uIFJlbW92ZSBiaW5kaW5ncyBmb3IgYXJnIGFuZCBjcmVhdGUgaW5zdGVhZCBiaW5kaW5ncyBhcnJheSBmb3IgcHJvcFxuXHRcdFx0XHRcdFx0PyAoZm5EcCAmJiBzeW50YXhFcnJvcihwYXJhbXMpLCBiaW5kaW5ncyAmJiBwYXRoQmluZGluZ3MucG9wKCksIG5hbWVkID0gXCJfXCIgKyBwYXRoLCBib3VuZE5hbWUgPSBib3VuZCwgcGFyYW1JbmRleCA9IGluZCArIGFsbC5sZW5ndGgsXG5cdFx0XHRcdFx0XHRcdFx0YmluZGluZ3MgJiYgKChiaW5kaW5ncyA9IGJuZEN0eC5iZCA9IHBhdGhCaW5kaW5nc1tuYW1lZF0gPSBbXSksIGJpbmRpbmdzLnNrcCA9ICFib3VuZCksIHBhdGggKyAnOicpXG5cdFx0XHRcdFx0XHQ6IHBhdGhcblx0XHRcdC8vIHBhdGhcblx0XHRcdFx0XHRcdFx0PyAocGF0aC5zcGxpdChcIl5cIikuam9pbihcIi5cIikucmVwbGFjZSgkc3ViLnJQYXRoLCBwYXJzZVBhdGgpXG5cdFx0XHRcdFx0XHRcdFx0KyAocHJuIHx8IG9wZXJhdG9yKVxuXHRcdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHRcdDogb3BlcmF0b3Jcblx0XHRcdC8vIG9wZXJhdG9yXG5cdFx0XHRcdFx0XHRcdFx0PyBvcGVyYXRvclxuXHRcdFx0XHRcdFx0XHRcdDogcnRQcm5cblx0XHRcdC8vIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IHJ0UHJuID09PSBcIl1cIiA/IFwiKV1cIiA6IFwiKVwiXG5cdFx0XHRcdFx0XHRcdFx0XHQ6IGNvbW1hXG5cdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGZuQ2FsbFtwcm5EcF0gfHwgc3ludGF4RXJyb3IocGFyYW1zKSwgXCIsXCIpIC8vIFdlIGRvbid0IGFsbG93IHRvcC1sZXZlbCBsaXRlcmFsIGFycmF5cyBvciBvYmplY3RzXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDogbGZ0UHJuMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogKGFwb3NlZCA9IGFwb3MsIHF1b3RlZCA9IHF1b3QsICdcIicpXG5cdFx0XHQpKVxuXHRcdCk7XG5cblx0XHRpZiAoIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRpZiAocnRQcm4pIHtcblx0XHRcdFx0Zm5DYWxsW3BybkRwXSA9IGZhbHNlO1xuXHRcdFx0XHRwcm5EcC0tO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChiaW5kaW5ncykge1xuXHRcdFx0aWYgKCFhcG9zZWQgJiYgIXF1b3RlZCkge1xuXHRcdFx0XHRpZiAocnRQcm4pIHtcblx0XHRcdFx0XHRpZiAocHJuU3RhY2tbcHJuRHArMV0pIHtcblx0XHRcdFx0XHRcdGJuZEN0eCA9IGJuZFN0YWNrWy0tZm5EcF07XG5cdFx0XHRcdFx0XHRwcm5TdGFja1twcm5EcCsxXSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcm5TdGFydCA9IHBybkluZFtwcm5EcCsxXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocHJuKSB7XG5cdFx0XHRcdFx0cHJuSW5kW3BybkRwKzFdID0gY29tcGlsZWRQYXRoW2ZuRHBdLmxlbmd0aCArIChsZnRQcm4gPyAxIDogMCk7XG5cdFx0XHRcdFx0aWYgKHBhdGggfHwgcnRQcm4pIHtcblx0XHRcdFx0XHRcdGJuZEN0eCA9IGJuZFN0YWNrWysrZm5EcF0gPSB7YmQ6IFtdfTtcblx0XHRcdFx0XHRcdHByblN0YWNrW3BybkRwKzFdID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHBdID0gKGNvbXBpbGVkUGF0aFtmbkRwXXx8XCJcIikgKyBmdWxsLnNsaWNlKHByZXZJbmRleCwgaW5kZXgpO1xuXHRcdFx0cHJldkluZGV4ID0gaW5kZXgrYWxsLmxlbmd0aDtcblxuXHRcdFx0aWYgKCFhcG9zZWQgJiYgIXF1b3RlZCkge1xuXHRcdFx0XHRpZiAobGZ0UHJuRkNhbGwgPSBsZnRQcm4gJiYgcHJuU3RhY2tbcHJuRHArMV0pIHtcblx0XHRcdFx0XHRjb21waWxlZFBhdGhbZm5EcC0xXSArPSBsZnRQcm47XG5cdFx0XHRcdFx0Y29tcGlsZWRQYXRoU3RhcnRbZm5EcC0xXSsrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChwcm4gPT09IFwiKFwiICYmIHN1YlBhdGggJiYgIW5ld09iKSB7XG5cdFx0XHRcdFx0Y29tcGlsZWRQYXRoW2ZuRHBdID0gY29tcGlsZWRQYXRoW2ZuRHAtMV0uc2xpY2UocHJuU3RhcnQpICsgY29tcGlsZWRQYXRoW2ZuRHBdO1xuXHRcdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwLTFdID0gY29tcGlsZWRQYXRoW2ZuRHAtMV0uc2xpY2UoMCwgcHJuU3RhcnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb21waWxlZFBhdGhbZm5EcF0gKz0gbGZ0UHJuRkNhbGwgPyByZXQuc2xpY2UoMSkgOiByZXQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFhcG9zZWQgJiYgIXF1b3RlZCAmJiBwcm4pIHtcblx0XHRcdHBybkRwKys7XG5cdFx0XHRpZiAocGF0aCAmJiBwcm4gPT09IFwiKFwiKSB7XG5cdFx0XHRcdGZuQ2FsbFtwcm5EcF0gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghYXBvc2VkICYmICFxdW90ZWQgJiYgcHJuMikge1xuXHRcdFx0aWYgKGJpbmRpbmdzKSB7XG5cdFx0XHRcdGNvbXBpbGVkUGF0aFtmbkRwXSArPSBwcm47XG5cdFx0XHR9XG5cdFx0XHRyZXQgKz0gcHJuO1xuXHRcdH1cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0dmFyIG5hbWVkLCBiaW5kdG8sIGJvdW5kTmFtZSwgcmVzdWx0LFxuXHRcdHF1b3RlZCwgLy8gYm9vbGVhbiBmb3Igc3RyaW5nIGNvbnRlbnQgaW4gZG91YmxlIHF1b3Rlc1xuXHRcdGFwb3NlZCwgLy8gb3IgaW4gc2luZ2xlIHF1b3Rlc1xuXHRcdGJpbmRpbmdzID0gcGF0aEJpbmRpbmdzICYmIHBhdGhCaW5kaW5nc1swXSwgLy8gYmluZGluZ3MgYXJyYXkgZm9yIHRoZSBmaXJzdCBhcmdcblx0XHRibmRDdHggPSB7YmQ6IGJpbmRpbmdzfSxcblx0XHRibmRTdGFjayA9IHswOiBibmRDdHh9LFxuXHRcdHBhcmFtSW5kZXggPSAwLCAvLyBsaXN0LFxuXHRcdC8vIFRoZSBmb2xsb3dpbmcgYXJlIHVzZWQgZm9yIHRyYWNraW5nIHBhdGggcGFyc2luZyBpbmNsdWRpbmcgbmVzdGVkIHBhdGhzLCBzdWNoIGFzIFwiYS5iKGNeZCArIChlKSleZlwiLCBhbmQgY2hhaW5lZCBjb21wdXRlZCBwYXRocyBzdWNoIGFzXG5cdFx0Ly8gXCJhLmIoKS5jXmQoKS5lLmYoKS5nXCIgLSB3aGljaCBoYXMgZm91ciBjaGFpbmVkIHBhdGhzLCBcImEuYigpXCIsIFwiXmMuZCgpXCIsIFwiLmUuZigpXCIgYW5kIFwiLmdcIlxuXHRcdHBybkRwID0gMCwgICAgIC8vIEZvciB0cmFja2luZyBwYXJlbiBkZXB0aCAobm90IGZ1bmN0aW9uIGNhbGwgcGFyZW5zKVxuXHRcdGZuRHAgPSAwLCAgICAgIC8vIEZvciB0cmFja2luZyBkZXB0aCBvZiBmdW5jdGlvbiBjYWxsIHBhcmVuc1xuXHRcdHBybkluZCA9IHt9LCAgIC8vIFdlIGFyZSBpbiBhIGZ1bmN0aW9uIGNhbGxcblx0XHRwcm5TdGFydCA9IDAsICAvLyB0cmFja3MgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHBhdGggc3VjaCBhcyBjXmQoKSBpbiB0aGUgYWJvdmUgZXhhbXBsZVxuXHRcdHByblN0YWNrID0ge30sIC8vIHRyYWNrcyBwYXJlbnMgd2hpY2ggYXJlIG5vdCBmdW5jdGlvbiBjYWxscywgYW5kIHNvIGFyZSBhc3NvY2lhdGVkIHdpdGggbmV3IGJuZFN0YWNrIGNvbnRleHRzXG5cdFx0Zm5DYWxsID0ge30sICAgLy8gV2UgYXJlIGluIGEgZnVuY3Rpb24gY2FsbFxuXHRcdHBhdGhTdGFydCA9IHt9LC8vIHRyYWNrcyB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgcGF0aCBzdWNoIGFzIGNeZCgpIGluIHRoZSBhYm92ZSBleGFtcGxlXG5cdFx0Y29tcGlsZWRQYXRoU3RhcnQgPSB7MDogMH0sXG5cdFx0Y29tcGlsZWRQYXRoID0gezA6XCJcIn0sXG5cdFx0cHJldkluZGV4ID0gMDtcblxuXHRpZiAocGFyYW1zWzBdID09PSBcIkBcIikge1xuXHRcdHBhcmFtcyA9IHBhcmFtcy5yZXBsYWNlKHJCcmFja2V0UXVvdGUsIFwiLlwiKTtcblx0fVxuXHRyZXN1bHQgPSAocGFyYW1zICsgKHRtcGwgPyBcIiBcIiA6IFwiXCIpKS5yZXBsYWNlKCRzdWIuclBybSwgcGFyc2VUb2tlbnMpO1xuXG5cdGlmIChiaW5kaW5ncykge1xuXHRcdHJlc3VsdCA9IGNvbXBpbGVkUGF0aFswXTtcblx0fVxuXG5cdHJldHVybiAhcHJuRHAgJiYgcmVzdWx0IHx8IHN5bnRheEVycm9yKHBhcmFtcyk7IC8vIFN5bnRheCBlcnJvciBpZiB1bmJhbGFuY2VkIHBhcmVucyBpbiBwYXJhbXMgZXhwcmVzc2lvblxufVxuXG5mdW5jdGlvbiBidWlsZENvZGUoYXN0LCB0bXBsLCBpc0xpbmtFeHByKSB7XG5cdC8vIEJ1aWxkIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBjb2RlIGZyb20gdGhlIEFTVCBub2RlcywgYW5kIHNldCBhcyBwcm9wZXJ0eSBvbiB0aGUgcGFzc2VkLWluIHRlbXBsYXRlIG9iamVjdFxuXHQvLyBVc2VkIGZvciBjb21waWxpbmcgdGVtcGxhdGVzLCBhbmQgYWxzbyBieSBKc1ZpZXdzIHRvIGJ1aWxkIGZ1bmN0aW9ucyBmb3IgZGF0YSBsaW5rIGV4cHJlc3Npb25zXG5cdHZhciBpLCBub2RlLCB0YWdOYW1lLCBjb252ZXJ0ZXIsIHRhZ0N0eCwgaGFzVGFnLCBoYXNFbmNvZGVyLCBnZXRzVmFsLCBoYXNDbnZ0LCB1c2VDbnZ0LCB0bXBsQmluZGluZ3MsIHBhdGhCaW5kaW5ncywgcGFyYW1zLCBib3VuZE9uRXJyU3RhcnQsXG5cdFx0Ym91bmRPbkVyckVuZCwgdGFnUmVuZGVyLCBuZXN0ZWRUbXBscywgdG1wbE5hbWUsIG5lc3RlZFRtcGwsIHRhZ0FuZEVsc2VzLCBjb250ZW50LCBtYXJrdXAsIG5leHRJc0Vsc2UsIG9sZENvZGUsIGlzRWxzZSwgaXNHZXRWYWwsIHRhZ0N0eEZuLFxuXHRcdG9uRXJyb3IsIHRhZ1N0YXJ0LCB0cmlnZ2VyLCBsYXRlUmVuZGVyLCByZXRTdHJPcGVuLCByZXRTdHJDbG9zZSxcblx0XHR0bXBsQmluZGluZ0tleSA9IDAsXG5cdFx0dXNlVmlld3MgPSAkc3ViU2V0dGluZ3NBZHZhbmNlZC51c2VWaWV3cyB8fCB0bXBsLnVzZVZpZXdzIHx8IHRtcGwudGFncyB8fCB0bXBsLnRlbXBsYXRlcyB8fCB0bXBsLmhlbHBlcnMgfHwgdG1wbC5jb252ZXJ0ZXJzLFxuXHRcdGNvZGUgPSBcIlwiLFxuXHRcdHRtcGxPcHRpb25zID0ge30sXG5cdFx0bCA9IGFzdC5sZW5ndGg7XG5cblx0aWYgKHR5cGVvZiB0bXBsID09PSBTVFJJTkcpIHtcblx0XHR0bXBsTmFtZSA9IGlzTGlua0V4cHIgPyAnZGF0YS1saW5rPVwiJyArIHRtcGwucmVwbGFjZShyTmV3TGluZSwgXCIgXCIpLnNsaWNlKDEsIC0xKSArICdcIicgOiB0bXBsO1xuXHRcdHRtcGwgPSAwO1xuXHR9IGVsc2Uge1xuXHRcdHRtcGxOYW1lID0gdG1wbC50bXBsTmFtZSB8fCBcInVubmFtZWRcIjtcblx0XHRpZiAodG1wbC5hbGxvd0NvZGUpIHtcblx0XHRcdHRtcGxPcHRpb25zLmFsbG93Q29kZSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICh0bXBsLmRlYnVnKSB7XG5cdFx0XHR0bXBsT3B0aW9ucy5kZWJ1ZyA9IHRydWU7XG5cdFx0fVxuXHRcdHRtcGxCaW5kaW5ncyA9IHRtcGwuYm5kcztcblx0XHRuZXN0ZWRUbXBscyA9IHRtcGwudG1wbHM7XG5cdH1cblx0Zm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuXHRcdC8vIEFTVCBub2RlczogWzA6IHRhZ05hbWUsIDE6IGNvbnZlcnRlciwgMjogY29udGVudCwgMzogcGFyYW1zLCA0OiBjb2RlLCA1OiBvbkVycm9yLCA2OiB0cmlnZ2VyLCA3OnBhdGhCaW5kaW5ncywgODogY29udGVudE1hcmt1cF1cblx0XHRub2RlID0gYXN0W2ldO1xuXG5cdFx0Ly8gQWRkIG5ld2xpbmUgZm9yIGVhY2ggY2FsbG91dCB0byB0KCkgYygpIGV0Yy4gYW5kIGVhY2ggbWFya3VwIHN0cmluZ1xuXHRcdGlmICh0eXBlb2Ygbm9kZSA9PT0gU1RSSU5HKSB7XG5cdFx0XHQvLyBhIG1hcmt1cCBzdHJpbmcgdG8gYmUgaW5zZXJ0ZWRcblx0XHRcdGNvZGUgKz0gJytcIicgKyBub2RlICsgJ1wiJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYSBjb21waWxlZCB0YWcgZXhwcmVzc2lvbiB0byBiZSBpbnNlcnRlZFxuXHRcdFx0dGFnTmFtZSA9IG5vZGVbMF07XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCIqXCIpIHtcblx0XHRcdFx0Ly8gQ29kZSB0YWc6IHt7KiB9fVxuXHRcdFx0XHRjb2RlICs9IFwiO1xcblwiICsgbm9kZVsxXSArIFwiXFxucmV0PXJldFwiO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udmVydGVyID0gbm9kZVsxXTtcblx0XHRcdFx0Y29udGVudCA9ICFpc0xpbmtFeHByICYmIG5vZGVbMl07XG5cdFx0XHRcdHRhZ0N0eCA9IHBhcmFtU3RydWN0dXJlKG5vZGVbM10sIHBhcmFtcyA9IG5vZGVbNF0pO1xuXHRcdFx0XHR0cmlnZ2VyID0gbm9kZVs2XTtcblx0XHRcdFx0bGF0ZVJlbmRlciA9IG5vZGVbN107XG5cdFx0XHRcdGlmIChub2RlWzhdKSB7IC8vIGxhdGVQYXRoIEBhLmIuYyBvciBAfmEuYi5jXG5cdFx0XHRcdFx0cmV0U3RyT3BlbiA9IFwiXFxudmFyIG9iLGx0T2I9e30sY3R4cz1cIjtcblx0XHRcdFx0XHRyZXRTdHJDbG9zZSA9IFwiO1xcbmN0eHMubHQ9bHRPYi5sdDtcXG5yZXR1cm4gY3R4cztcIjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXRTdHJPcGVuID0gXCJcXG5yZXR1cm4gXCI7XG5cdFx0XHRcdFx0cmV0U3RyQ2xvc2UgPSBcIlwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcmt1cCA9IG5vZGVbMTBdICYmIG5vZGVbMTBdLnJlcGxhY2UoclVuZXNjYXBlUXVvdGVzLCBcIiQxXCIpO1xuXHRcdFx0XHRpZiAoaXNFbHNlID0gdGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MucHVzaChub2RlWzldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b25FcnJvciA9IG5vZGVbNV0gfHwgJHN1YlNldHRpbmdzLmRlYnVnTW9kZSAhPT0gZmFsc2UgJiYgXCJ1bmRlZmluZWRcIjsgLy8gSWYgZGVidWdNb2RlIG5vdCBmYWxzZSwgc2V0IGRlZmF1bHQgb25FcnJvciBoYW5kbGVyIG9uIHRhZyB0byBcInVuZGVmaW5lZFwiIChzZWUgb25SZW5kZXJFcnJvcilcblx0XHRcdFx0XHRpZiAodG1wbEJpbmRpbmdzICYmIChwYXRoQmluZGluZ3MgPSBub2RlWzldKSkgeyAvLyBBcnJheSBvZiBwYXRocywgb3IgZmFsc2UgaWYgbm90IGRhdGEtYm91bmRcblx0XHRcdFx0XHRcdHBhdGhCaW5kaW5ncyA9IFtwYXRoQmluZGluZ3NdO1xuXHRcdFx0XHRcdFx0dG1wbEJpbmRpbmdLZXkgPSB0bXBsQmluZGluZ3MucHVzaCgxKTsgLy8gQWRkIHBsYWNlaG9sZGVyIGluIHRtcGxCaW5kaW5ncyBmb3IgY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dXNlVmlld3MgPSB1c2VWaWV3cyB8fCBwYXJhbXNbMV0gfHwgcGFyYW1zWzJdIHx8IHBhdGhCaW5kaW5ncyB8fCAvdmlldy4oPyFpbmRleCkvLnRlc3QocGFyYW1zWzBdKTtcblx0XHRcdFx0Ly8gdXNlVmlld3MgaXMgZm9yIHBlcmYgb3B0aW1pemF0aW9uLiBGb3IgcmVuZGVyKCkgd2Ugb25seSB1c2Ugdmlld3MgaWYgbmVjZXNzYXJ5IC0gZm9yIHRoZSBtb3JlIGFkdmFuY2VkIHNjZW5hcmlvcy5cblx0XHRcdFx0Ly8gV2UgdXNlIHZpZXdzIGlmIHRoZXJlIGFyZSBwcm9wcywgY29udGV4dHVhbCBwcm9wZXJ0aWVzIG9yIGFyZ3Mgd2l0aCAjLi4uIChvdGhlciB0aGFuICNpbmRleCkgLSBidXQgeW91IGNhbiBmb3JjZVxuXHRcdFx0XHQvLyB1c2luZyB0aGUgZnVsbCB2aWV3IGluZnJhc3RydWN0dXJlLCAoYW5kIHBheSBhIHBlcmYgcHJpY2UpIGJ5IG9wdGluZyBpbjogU2V0IHVzZVZpZXdzOiB0cnVlIG9uIHRoZSB0ZW1wbGF0ZSwgbWFudWFsbHkuLi5cblx0XHRcdFx0aWYgKGlzR2V0VmFsID0gdGFnTmFtZSA9PT0gXCI6XCIpIHtcblx0XHRcdFx0XHRpZiAoY29udmVydGVyKSB7XG5cdFx0XHRcdFx0XHR0YWdOYW1lID0gY29udmVydGVyID09PSBIVE1MID8gXCI+XCIgOiBjb252ZXJ0ZXIgKyB0YWdOYW1lO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoY29udGVudCkgeyAvLyBUT0RPIG9wdGltaXplIC0gaWYgY29udGVudC5sZW5ndGggPT09IDAgb3IgaWYgdGhlcmUgaXMgYSB0bXBsPVwiLi4uXCIgc3BlY2lmaWVkIC0gc2V0IGNvbnRlbnQgdG8gbnVsbCAvIGRvbid0IHJ1biB0aGlzIGNvbXBpbGF0aW9uIGNvZGUgLSBzaW5jZSBjb250ZW50IHdvbid0IGdldCB1c2VkISFcblx0XHRcdFx0XHRcdC8vIENyZWF0ZSB0ZW1wbGF0ZSBvYmplY3QgZm9yIG5lc3RlZCB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbCA9IHRtcGxPYmplY3QobWFya3VwLCB0bXBsT3B0aW9ucyk7XG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBsLnRtcGxOYW1lID0gdG1wbE5hbWUgKyBcIi9cIiArIHRhZ05hbWU7XG5cdFx0XHRcdFx0XHQvLyBDb21waWxlIHRvIEFTVCBhbmQgdGhlbiB0byBjb21waWxlZCBmdW5jdGlvblxuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbC51c2VWaWV3cyA9IG5lc3RlZFRtcGwudXNlVmlld3MgfHwgdXNlVmlld3M7XG5cdFx0XHRcdFx0XHRidWlsZENvZGUoY29udGVudCwgbmVzdGVkVG1wbCk7XG5cdFx0XHRcdFx0XHR1c2VWaWV3cyA9IG5lc3RlZFRtcGwudXNlVmlld3M7XG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBscy5wdXNoKG5lc3RlZFRtcGwpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghaXNFbHNlKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIG5vdCBhbiBlbHNlIHRhZy5cblx0XHRcdFx0XHRcdHRhZ0FuZEVsc2VzID0gdGFnTmFtZTtcblx0XHRcdFx0XHRcdHVzZVZpZXdzID0gdXNlVmlld3MgfHwgdGFnTmFtZSAmJiAoISR0YWdzW3RhZ05hbWVdIHx8ICEkdGFnc1t0YWdOYW1lXS5mbG93KTtcblx0XHRcdFx0XHRcdC8vIFN3aXRjaCB0byBhIG5ldyBjb2RlIHN0cmluZyBmb3IgdGhpcyBib3VuZCB0YWcgKGFuZCBpdHMgZWxzZXMsIGlmIGl0IGhhcyBhbnkpIC0gZm9yIHJldHVybmluZyB0aGUgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdFx0b2xkQ29kZSA9IGNvZGU7XG5cdFx0XHRcdFx0XHRjb2RlID0gXCJcIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV4dElzRWxzZSA9IGFzdFtpICsgMV07XG5cdFx0XHRcdFx0bmV4dElzRWxzZSA9IG5leHRJc0Vsc2UgJiYgbmV4dElzRWxzZVswXSA9PT0gXCJlbHNlXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGFnU3RhcnQgPSBvbkVycm9yID8gXCI7XFxudHJ5e1xcbnJldCs9XCIgOiBcIlxcbitcIjtcblx0XHRcdFx0Ym91bmRPbkVyclN0YXJ0ID0gXCJcIjtcblx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiXCI7XG5cblx0XHRcdFx0aWYgKGlzR2V0VmFsICYmIChwYXRoQmluZGluZ3MgfHwgdHJpZ2dlciB8fCBjb252ZXJ0ZXIgJiYgY29udmVydGVyICE9PSBIVE1MIHx8IGxhdGVSZW5kZXIpKSB7XG5cdFx0XHRcdFx0Ly8gRm9yIGNvbnZlcnRWYWwgd2UgbmVlZCBhIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgbmV3IHRhZ0N0eChzKVxuXHRcdFx0XHRcdHRhZ0N0eEZuID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGpcIiwgXCIvLyBcIiArIHRtcGxOYW1lICsgXCIgXCIgKyAoKyt0bXBsQmluZGluZ0tleSkgKyBcIiBcIiArIHRhZ05hbWVcblx0XHRcdFx0XHRcdCsgcmV0U3RyT3BlbiArIFwie1wiICsgdGFnQ3R4ICsgXCJ9O1wiICsgcmV0U3RyQ2xvc2UpO1xuXHRcdFx0XHRcdHRhZ0N0eEZuLl9lciA9IG9uRXJyb3I7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX3RhZyA9IHRhZ05hbWU7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX2JkID0gISFwYXRoQmluZGluZ3M7IC8vIGRhdGEtbGlua2VkIHRhZyB7XnsuLi4vfX1cblx0XHRcdFx0XHR0YWdDdHhGbi5fbHIgPSBsYXRlUmVuZGVyO1xuXG5cdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0YWdDdHhGbjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzZXRQYXRocyh0YWdDdHhGbiwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHR0YWdSZW5kZXIgPSAnYyhcIicgKyBjb252ZXJ0ZXIgKyAnXCIsdmlldywnO1xuXHRcdFx0XHRcdHVzZUNudnQgPSB0cnVlO1xuXHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsXCI7XG5cdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvZGUgKz0gKGlzR2V0VmFsXG5cdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/IChvbkVycm9yID8gXCJ0cnl7XFxuXCIgOiBcIlwiKSArIFwicmV0dXJuIFwiIDogdGFnU3RhcnQpICsgKHVzZUNudnQgLy8gQ2FsbCBfY252dCBpZiB0aGVyZSBpcyBhIGNvbnZlcnRlcjoge3tjbnZ0OiAuLi4gfX0gb3Ige157Y252dDogLi4uIH19XG5cdFx0XHRcdFx0XHQ/ICh1c2VDbnZ0ID0gdW5kZWZpbmVkLCB1c2VWaWV3cyA9IGhhc0NudnQgPSB0cnVlLCB0YWdSZW5kZXIgKyAodGFnQ3R4Rm5cblx0XHRcdFx0XHRcdFx0PyAoKHRtcGxCaW5kaW5nc1t0bXBsQmluZGluZ0tleSAtIDFdID0gdGFnQ3R4Rm4pLCB0bXBsQmluZGluZ0tleSkgLy8gU3RvcmUgdGhlIGNvbXBpbGVkIHRhZ0N0eEZuIGluIHRtcGwuYm5kcywgYW5kIHBhc3MgdGhlIGtleSB0byBjb252ZXJ0VmFsKClcblx0XHRcdFx0XHRcdFx0OiBcIntcIiArIHRhZ0N0eCArIFwifVwiKSArIFwiKVwiKVxuXHRcdFx0XHRcdFx0OiB0YWdOYW1lID09PSBcIj5cIlxuXHRcdFx0XHRcdFx0XHQ/IChoYXNFbmNvZGVyID0gdHJ1ZSwgXCJoKFwiICsgcGFyYW1zWzBdICsgXCIpXCIpXG5cdFx0XHRcdFx0XHRcdDogKGdldHNWYWwgPSB0cnVlLCBcIigodj1cIiArIHBhcmFtc1swXSArICcpIT1udWxsP3Y6JyArIChpc0xpbmtFeHByID8gJ251bGwpJyA6ICdcIlwiKScpKVxuXHRcdFx0XHRcdFx0XHQvLyBOb24gc3RyaWN0IGVxdWFsaXR5IHNvIGRhdGEtbGluaz1cInRpdGxlezpleHByfVwiIHdpdGggZXhwcj1udWxsL3VuZGVmaW5lZCByZW1vdmVzIHRpdGxlIGF0dHJpYnV0ZVxuXHRcdFx0XHRcdClcblx0XHRcdFx0XHQ6IChoYXNUYWcgPSB0cnVlLCBcIlxcbnt2aWV3OnZpZXcsY29udGVudDpmYWxzZSx0bXBsOlwiIC8vIEFkZCB0aGlzIHRhZ0N0eCB0byB0aGUgY29tcGlsZWQgY29kZSBmb3IgdGhlIHRhZ0N0eHMgdG8gYmUgcGFzc2VkIHRvIHJlbmRlclRhZygpXG5cdFx0XHRcdFx0XHQrIChjb250ZW50ID8gbmVzdGVkVG1wbHMubGVuZ3RoIDogXCJmYWxzZVwiKSArIFwiLFwiIC8vIEZvciBibG9jayB0YWdzLCBwYXNzIGluIHRoZSBrZXkgKG5lc3RlZFRtcGxzLmxlbmd0aCkgdG8gdGhlIG5lc3RlZCBjb250ZW50IHRlbXBsYXRlXG5cdFx0XHRcdFx0XHQrIHRhZ0N0eCArIFwifSxcIikpO1xuXG5cdFx0XHRcdGlmICh0YWdBbmRFbHNlcyAmJiAhbmV4dElzRWxzZSkge1xuXHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiBvciBhbiBpbmxpbmUgdGFnIHdpdGhvdXQgYW55IGVsc2VzLCBvciB0aGUgbGFzdCB7e2Vsc2V9fSBvZiBhbiBpbmxpbmUgdGFnXG5cdFx0XHRcdFx0Ly8gV2UgY29tcGxldGUgdGhlIGNvZGUgZm9yIHJldHVybmluZyB0aGUgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdGNvZGUgPSBcIltcIiArIGNvZGUuc2xpY2UoMCwgLTEpICsgXCJdXCI7XG5cdFx0XHRcdFx0dGFnUmVuZGVyID0gJ3QoXCInICsgdGFnQW5kRWxzZXMgKyAnXCIsdmlldyx0aGlzLCc7XG5cdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIgfHwgcGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIGEgYm91bmQgdGFnIChkYXRhLWxpbmsgZXhwcmVzc2lvbiBvciBpbmxpbmUgYm91bmQgdGFnIHtee3RhZyAuLi59fSkgc28gd2Ugc3RvcmUgYSBjb21waWxlZCB0YWdDdHhzIGZ1bmN0aW9uIGluIHRtcC5ibmRzXG5cdFx0XHRcdFx0XHRjb2RlID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGpcIiwgXCIgLy8gXCIgKyB0bXBsTmFtZSArIFwiIFwiICsgdG1wbEJpbmRpbmdLZXkgKyBcIiBcIiArIHRhZ0FuZEVsc2VzICsgcmV0U3RyT3BlbiArIGNvZGVcblx0XHRcdFx0XHRcdFx0KyByZXRTdHJDbG9zZSk7XG5cdFx0XHRcdFx0XHRjb2RlLl9lciA9IG9uRXJyb3I7XG5cdFx0XHRcdFx0XHRjb2RlLl90YWcgPSB0YWdBbmRFbHNlcztcblx0XHRcdFx0XHRcdGlmIChwYXRoQmluZGluZ3MpIHtcblx0XHRcdFx0XHRcdFx0c2V0UGF0aHModG1wbEJpbmRpbmdzW3RtcGxCaW5kaW5nS2V5IC0gMV0gPSBjb2RlLCBwYXRoQmluZGluZ3MpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29kZS5fbHIgPSBsYXRlUmVuZGVyO1xuXHRcdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGNvZGU7IC8vIEZvciBhIGRhdGEtbGluayBleHByZXNzaW9uIHdlIHJldHVybiB0aGUgY29tcGlsZWQgdGFnQ3R4cyBmdW5jdGlvblxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ym91bmRPbkVyclN0YXJ0ID0gdGFnUmVuZGVyICsgdG1wbEJpbmRpbmdLZXkgKyBcIix1bmRlZmluZWQsXCI7XG5cdFx0XHRcdFx0XHRib3VuZE9uRXJyRW5kID0gXCIpXCI7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gVGhpcyBpcyB0aGUgbGFzdCB7e2Vsc2V9fSBmb3IgYW4gaW5saW5lIHRhZy5cblx0XHRcdFx0XHQvLyBGb3IgYSBib3VuZCB0YWcsIHBhc3MgdGhlIHRhZ0N0eHMgZm4gbG9va3VwIGtleSB0byByZW5kZXJUYWcuXG5cdFx0XHRcdFx0Ly8gRm9yIGFuIHVuYm91bmQgdGFnLCBpbmNsdWRlIHRoZSBjb2RlIGRpcmVjdGx5IGZvciBldmFsdWF0aW5nIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRjb2RlID0gb2xkQ29kZSArIHRhZ1N0YXJ0ICsgdGFnUmVuZGVyICsgKHBhdGhCaW5kaW5ncyAmJiB0bXBsQmluZGluZ0tleSB8fCBjb2RlKSArIFwiKVwiO1xuXHRcdFx0XHRcdHBhdGhCaW5kaW5ncyA9IDA7XG5cdFx0XHRcdFx0dGFnQW5kRWxzZXMgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvbkVycm9yICYmICFuZXh0SXNFbHNlKSB7XG5cdFx0XHRcdFx0dXNlVmlld3MgPSB0cnVlO1xuXHRcdFx0XHRcdGNvZGUgKz0gJztcXG59Y2F0Y2goZSl7cmV0JyArIChpc0xpbmtFeHByID8gXCJ1cm4gXCIgOiBcIis9XCIpICsgYm91bmRPbkVyclN0YXJ0ICsgJ2ouX2VycihlLHZpZXcsJyArIG9uRXJyb3IgKyAnKScgKyBib3VuZE9uRXJyRW5kICsgJzt9JyArIChpc0xpbmtFeHByID8gXCJcIiA6ICdcXG5yZXQ9cmV0Jyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0Ly8gSW5jbHVkZSBvbmx5IHRoZSB2YXIgcmVmZXJlbmNlcyB0aGF0IGFyZSBuZWVkZWQgaW4gdGhlIGNvZGVcblx0Y29kZSA9IFwiLy8gXCIgKyB0bXBsTmFtZVxuXHRcdCsgKHRtcGxPcHRpb25zLmRlYnVnID8gXCJcXG5kZWJ1Z2dlcjtcIiA6IFwiXCIpXG5cdFx0KyBcIlxcbnZhciB2XCJcblx0XHQrIChoYXNUYWcgPyBcIix0PWouX3RhZ1wiIDogXCJcIikgICAgICAgICAgICAgICAgLy8gaGFzIHRhZ1xuXHRcdCsgKGhhc0NudnQgPyBcIixjPWouX2NudnRcIiA6IFwiXCIpICAgICAgICAgICAgICAvLyBjb252ZXJ0ZXJcblx0XHQrIChoYXNFbmNvZGVyID8gXCIsaD1qLl9odG1sXCIgOiBcIlwiKSAgICAgICAgICAgLy8gaHRtbCBjb252ZXJ0ZXJcblx0XHQrIChpc0xpbmtFeHByXG5cdFx0XHRcdD8gKG5vZGVbOF0gLy8gbGF0ZSBALi4uIHBhdGg/XG5cdFx0XHRcdFx0XHQ/IFwiLCBvYlwiXG5cdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHQpICsgXCI7XFxuXCJcblx0XHRcdFx0OiAnLHJldD1cIlwiJylcblx0XHQrIGNvZGVcblx0XHQrIChpc0xpbmtFeHByID8gXCJcXG5cIiA6IFwiO1xcbnJldHVybiByZXQ7XCIpO1xuXG5cdHRyeSB7XG5cdFx0Y29kZSA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqXCIsIGNvZGUpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0c3ludGF4RXJyb3IoXCJDb21waWxlZCB0ZW1wbGF0ZSBjb2RlOlxcblxcblwiICsgY29kZSArICdcXG46IFwiJyArIChlLm1lc3NhZ2V8fGUpICsgJ1wiJyk7XG5cdH1cblx0aWYgKHRtcGwpIHtcblx0XHR0bXBsLmZuID0gY29kZTtcblx0XHR0bXBsLnVzZVZpZXdzID0gISF1c2VWaWV3cztcblx0fVxuXHRyZXR1cm4gY29kZTtcbn1cblxuLy89PT09PT09PT09XG4vLyBVdGlsaXRpZXNcbi8vPT09PT09PT09PVxuXG4vLyBNZXJnZSBvYmplY3RzLCBpbiBwYXJ0aWN1bGFyIGNvbnRleHRzIHdoaWNoIGluaGVyaXQgZnJvbSBwYXJlbnQgY29udGV4dHNcbmZ1bmN0aW9uIGV4dGVuZEN0eChjb250ZXh0LCBwYXJlbnRDb250ZXh0KSB7XG5cdC8vIFJldHVybiBjb3B5IG9mIHBhcmVudENvbnRleHQsIHVubGVzcyBjb250ZXh0IGlzIGRlZmluZWQgYW5kIGlzIGRpZmZlcmVudCwgaW4gd2hpY2ggY2FzZSByZXR1cm4gYSBuZXcgbWVyZ2VkIGNvbnRleHRcblx0Ly8gSWYgbmVpdGhlciBjb250ZXh0IG5vciBwYXJlbnRDb250ZXh0IGFyZSBkZWZpbmVkLCByZXR1cm4gdW5kZWZpbmVkXG5cdHJldHVybiBjb250ZXh0ICYmIGNvbnRleHQgIT09IHBhcmVudENvbnRleHRcblx0XHQ/IChwYXJlbnRDb250ZXh0XG5cdFx0XHQ/ICRleHRlbmQoJGV4dGVuZCh7fSwgcGFyZW50Q29udGV4dCksIGNvbnRleHQpXG5cdFx0XHQ6IGNvbnRleHQpXG5cdFx0OiBwYXJlbnRDb250ZXh0ICYmICRleHRlbmQoe30sIHBhcmVudENvbnRleHQpO1xufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXRQcm9wcyhzb3VyY2UsIHRhZ0N0eCkge1xuXHQvLyB0aGlzIHBvaW50ZXIgaXMgdGhlTWFwIC0gd2hpY2ggaGFzIHRhZ0N0eC5wcm9wcyB0b29cblx0Ly8gYXJndW1lbnRzOiB0YWdDdHguYXJncy5cblx0dmFyIGtleSwgcHJvcCxcblx0XHRtYXAgPSB0YWdDdHgubWFwLFxuXHRcdHByb3BzQXJyID0gbWFwICYmIG1hcC5wcm9wc0FycjtcblxuXHRpZiAoIXByb3BzQXJyKSB7IC8vIG1hcC5wcm9wc0FyciBpcyB0aGUgZnVsbCBhcnJheSBvZiB7a2V5Oi4uLiwgcHJvcDouLi59IG9iamVjdHNcblx0XHRwcm9wc0FyciA9IFtdO1xuXHRcdGlmICh0eXBlb2Ygc291cmNlID09PSBPQkpFQ1QgfHwgJGlzRnVuY3Rpb24oc291cmNlKSkge1xuXHRcdFx0Zm9yIChrZXkgaW4gc291cmNlKSB7XG5cdFx0XHRcdHByb3AgPSBzb3VyY2Vba2V5XTtcblx0XHRcdFx0aWYgKGtleSAhPT0gJGV4cGFuZG8gJiYgc291cmNlLmhhc093blByb3BlcnR5KGtleSkgJiYgKCF0YWdDdHgucHJvcHMubm9GdW5jdGlvbnMgfHwgISQuaXNGdW5jdGlvbihwcm9wKSkpIHtcblx0XHRcdFx0XHRwcm9wc0Fyci5wdXNoKHtrZXk6IGtleSwgcHJvcDogcHJvcH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChtYXApIHtcblx0XHRcdG1hcC5wcm9wc0FyciA9IG1hcC5vcHRpb25zICYmIHByb3BzQXJyOyAvLyBJZiBib3VuZCB7Xntwcm9wc319IGFuZCBub3QgaXNSZW5kZXJDYWxsLCBzdG9yZSBwcm9wc0FyciBvbiBtYXAgKG1hcC5vcHRpb25zIGlzIGRlZmluZWQgb25seSBmb3IgYm91bmQsICYmICFpc1JlbmRlckNhbGwpXG5cdFx0fVxuXHR9XG5cdHJldHVybiBnZXRUYXJnZXRTb3J0ZWQocHJvcHNBcnIsIHRhZ0N0eCk7IC8vIE9idGFpbnMgbWFwLnRndCwgYnkgZmlsdGVyaW5nLCBzb3J0aW5nIGFuZCBzcGxpY2luZyB0aGUgZnVsbCBwcm9wc0FyclxufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXRTb3J0ZWQodmFsdWUsIHRhZ0N0eCkge1xuXHQvLyBnZXRUZ3Rcblx0dmFyIG1hcHBlZCwgc3RhcnQsIGVuZCxcblx0XHR0YWcgPSB0YWdDdHgudGFnLFxuXHRcdHByb3BzID0gdGFnQ3R4LnByb3BzLFxuXHRcdHByb3BQYXJhbXMgPSB0YWdDdHgucGFyYW1zLnByb3BzLFxuXHRcdGZpbHRlciA9IHByb3BzLmZpbHRlcixcblx0XHRzb3J0ID0gcHJvcHMuc29ydCxcblx0XHRkaXJlY3RTb3J0ID0gc29ydCA9PT0gdHJ1ZSxcblx0XHRzdGVwID0gcGFyc2VJbnQocHJvcHMuc3RlcCksXG5cdFx0cmV2ZXJzZSA9IHByb3BzLnJldmVyc2UgPyAtMSA6IDE7XG5cblx0aWYgKCEkaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblx0aWYgKGRpcmVjdFNvcnQgfHwgc29ydCAmJiB0eXBlb2Ygc29ydCA9PT0gU1RSSU5HKSB7XG5cdFx0Ly8gVGVtcG9yYXJ5IG1hcHBlZCBhcnJheSBob2xkcyBvYmplY3RzIHdpdGggaW5kZXggYW5kIHNvcnQtdmFsdWVcblx0XHRtYXBwZWQgPSB2YWx1ZS5tYXAoZnVuY3Rpb24oaXRlbSwgaSkge1xuXHRcdFx0aXRlbSA9IGRpcmVjdFNvcnQgPyBpdGVtIDogZ2V0UGF0aE9iamVjdChpdGVtLCBzb3J0KTtcblx0XHRcdHJldHVybiB7aTogaSwgdjogdHlwZW9mIGl0ZW0gPT09IFNUUklORyA/IGl0ZW0udG9Mb3dlckNhc2UoKSA6IGl0ZW19O1xuXHRcdH0pO1xuXHRcdC8vIFNvcnQgbWFwcGVkIGFycmF5XG5cdFx0bWFwcGVkLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0cmV0dXJuIGEudiA+IGIudiA/IHJldmVyc2UgOiBhLnYgPCBiLnYgPyAtcmV2ZXJzZSA6IDA7XG5cdFx0fSk7XG5cdFx0Ly8gTWFwIHRvIG5ldyBhcnJheSB3aXRoIHJlc3VsdGluZyBvcmRlclxuXHRcdHZhbHVlID0gbWFwcGVkLm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHRcdHJldHVybiB2YWx1ZVtpdGVtLmldO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKChzb3J0IHx8IHJldmVyc2UgPCAwKSAmJiAhdGFnLmRhdGFNYXApIHtcblx0XHR2YWx1ZSA9IHZhbHVlLnNsaWNlKCk7IC8vIENsb25lIGFycmF5IGZpcnN0IGlmIG5vdCBhbHJlYWR5IGEgbmV3IGFycmF5XG5cdH1cblx0aWYgKCRpc0Z1bmN0aW9uKHNvcnQpKSB7XG5cdFx0dmFsdWUgPSB2YWx1ZS5zb3J0KGZ1bmN0aW9uKCkgeyAvLyBXcmFwIHRoZSBzb3J0IGZ1bmN0aW9uIHRvIHByb3ZpZGUgdGFnQ3R4IGFzICd0aGlzJyBwb2ludGVyXG5cdFx0XHRyZXR1cm4gc29ydC5hcHBseSh0YWdDdHgsIGFyZ3VtZW50cyk7XG5cdFx0fSk7XG5cdH1cblx0aWYgKHJldmVyc2UgPCAwICYmICghc29ydCB8fCAkaXNGdW5jdGlvbihzb3J0KSkpIHsgLy8gUmV2ZXJzZSByZXN1bHQgaWYgbm90IGFscmVhZHkgcmV2ZXJzZWQgaW4gc29ydFxuXHRcdHZhbHVlID0gdmFsdWUucmV2ZXJzZSgpO1xuXHR9XG5cblx0aWYgKHZhbHVlLmZpbHRlciAmJiBmaWx0ZXIpIHsgLy8gSUU4IGRvZXMgbm90IHN1cHBvcnQgZmlsdGVyXG5cdFx0dmFsdWUgPSB2YWx1ZS5maWx0ZXIoZmlsdGVyLCB0YWdDdHgpO1xuXHRcdGlmICh0YWdDdHgudGFnLm9uRmlsdGVyKSB7XG5cdFx0XHR0YWdDdHgudGFnLm9uRmlsdGVyKHRhZ0N0eCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHByb3BQYXJhbXMuc29ydGVkKSB7XG5cdFx0bWFwcGVkID0gKHNvcnQgfHwgcmV2ZXJzZSA8IDApID8gdmFsdWUgOiB2YWx1ZS5zbGljZSgpO1xuXHRcdGlmICh0YWcuc29ydGVkKSB7XG5cdFx0XHQkLm9ic2VydmFibGUodGFnLnNvcnRlZCkucmVmcmVzaChtYXBwZWQpOyAvLyBOb3RlIHRoYXQgdGhpcyBtaWdodCBjYXVzZSB0aGUgc3RhcnQgYW5kIGVuZCBwcm9wcyB0byBiZSBtb2RpZmllZCAtIGUuZy4gYnkgcGFnZXIgdGFnIGNvbnRyb2xcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFnQ3R4Lm1hcC5zb3J0ZWQgPSBtYXBwZWQ7XG5cdFx0fVxuXHR9XG5cblx0c3RhcnQgPSBwcm9wcy5zdGFydDsgLy8gR2V0IGN1cnJlbnQgdmFsdWUgLSBhZnRlciBwb3NzaWJsZSBjaGFuZ2VzIHRyaWdnZXJlZCBieSB0YWcuc29ydGVkIHJlZnJlc2goKSBhYm92ZVxuXHRlbmQgPSBwcm9wcy5lbmQ7XG5cdGlmIChwcm9wUGFyYW1zLnN0YXJ0ICYmIHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgcHJvcFBhcmFtcy5lbmQgJiYgZW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRzdGFydCA9IGVuZCA9IDA7XG5cdH1cblx0aWYgKCFpc05hTihzdGFydCkgfHwgIWlzTmFOKGVuZCkpIHsgLy8gc3RhcnQgb3IgZW5kIHNwZWNpZmllZCwgYnV0IG5vdCB0aGUgYXV0by1jcmVhdGUgTnVtYmVyIGFycmF5IHNjZW5hcmlvIG9mIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5fX1cblx0XHRzdGFydCA9ICtzdGFydCB8fCAwO1xuXHRcdGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHZhbHVlLmxlbmd0aCA/IHZhbHVlLmxlbmd0aCA6ICtlbmQ7XG5cdFx0dmFsdWUgPSB2YWx1ZS5zbGljZShzdGFydCwgZW5kKTtcblx0fVxuXHRpZiAoc3RlcCA+IDEpIHtcblx0XHRzdGFydCA9IDA7XG5cdFx0ZW5kID0gdmFsdWUubGVuZ3RoO1xuXHRcdG1hcHBlZCA9IFtdO1xuXHRcdGZvciAoOyBzdGFydDxlbmQ7IHN0YXJ0Kz1zdGVwKSB7XG5cdFx0XHRtYXBwZWQucHVzaCh2YWx1ZVtzdGFydF0pO1xuXHRcdH1cblx0XHR2YWx1ZSA9IG1hcHBlZDtcblx0fVxuXHRpZiAocHJvcFBhcmFtcy5wYWdlZCAmJiB0YWcucGFnZWQpIHtcblx0XHQkb2JzZXJ2YWJsZSh0YWcucGFnZWQpLnJlZnJlc2godmFsdWUpO1xuXHR9XG5cblx0cmV0dXJuIHZhbHVlO1xufVxuXG4vKiogUmVuZGVyIHRoZSB0ZW1wbGF0ZSBhcyBhIHN0cmluZywgdXNpbmcgdGhlIHNwZWNpZmllZCBkYXRhIGFuZCBoZWxwZXJzL2NvbnRleHRcbiogJChcIiN0bXBsXCIpLnJlbmRlcigpXG4qXG4qIEBwYXJhbSB7YW55fSAgICAgICAgZGF0YVxuKiBAcGFyYW0ge2hhc2h9ICAgICAgIFtoZWxwZXJzT3JDb250ZXh0XVxuKiBAcGFyYW0ge2Jvb2xlYW59ICAgIFtub0l0ZXJhdGlvbl1cbiogQHJldHVybnMge3N0cmluZ30gICByZW5kZXJlZCB0ZW1wbGF0ZVxuKi9cbmZ1bmN0aW9uICRmblJlbmRlcihkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbikge1xuXHR2YXIgdG1wbEVsZW0gPSB0aGlzLmpxdWVyeSAmJiAodGhpc1swXSB8fCBlcnJvcignVW5rbm93biB0ZW1wbGF0ZScpKSwgLy8gVGFyZ2V0ZWQgZWxlbWVudCBub3QgZm91bmQgZm9yIGpRdWVyeSB0ZW1wbGF0ZSBzZWxlY3RvciBzdWNoIGFzIFwiI215VG1wbFwiXG5cdFx0dG1wbCA9IHRtcGxFbGVtLmdldEF0dHJpYnV0ZSh0bXBsQXR0cik7XG5cblx0cmV0dXJuIHJlbmRlckNvbnRlbnQuY2FsbCh0bXBsICYmICQuZGF0YSh0bXBsRWxlbSlbanN2VG1wbF0gfHwgJHRlbXBsYXRlcyh0bXBsRWxlbSksXG5cdFx0ZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24pO1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFJlZ2lzdGVyIGNvbnZlcnRlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0Q2hhckVudGl0eShjaCkge1xuXHQvLyBHZXQgY2hhcmFjdGVyIGVudGl0eSBmb3IgSFRNTCwgQXR0cmlidXRlIGFuZCBvcHRpb25hbCBkYXRhIGVuY29kaW5nXG5cdHJldHVybiBjaGFyRW50aXRpZXNbY2hdIHx8IChjaGFyRW50aXRpZXNbY2hdID0gXCImI1wiICsgY2guY2hhckNvZGVBdCgwKSArIFwiO1wiKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2hhckZyb21FbnRpdHkobWF0Y2gsIHRva2VuKSB7XG5cdC8vIEdldCBjaGFyYWN0ZXIgZnJvbSBIVE1MIGVudGl0eSwgZm9yIG9wdGlvbmFsIGRhdGEgdW5lbmNvZGluZ1xuXHRyZXR1cm4gY2hhcnNGcm9tRW50aXRpZXNbdG9rZW5dIHx8IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGh0bWxFbmNvZGUodGV4dCkge1xuXHQvLyBIVE1MIGVuY29kZTogUmVwbGFjZSA8ID4gJiAnIFwiIGAgZXRjLiBieSBjb3JyZXNwb25kaW5nIGVudGl0aWVzLlxuXHRyZXR1cm4gdGV4dCAhPSB1bmRlZmluZWQgPyBySXNIdG1sLnRlc3QodGV4dCkgJiYgKFwiXCIgKyB0ZXh0KS5yZXBsYWNlKHJIdG1sRW5jb2RlLCBnZXRDaGFyRW50aXR5KSB8fCB0ZXh0IDogXCJcIjtcbn1cblxuZnVuY3Rpb24gZGF0YUVuY29kZSh0ZXh0KSB7XG5cdC8vIEVuY29kZSBqdXN0IDwgPiBhbmQgJiAtIGludGVuZGVkIGZvciAnc2FmZSBkYXRhJyBhbG9uZyB3aXRoIHt7On19IHJhdGhlciB0aGFuIHt7Pn19XG4gIHJldHVybiB0eXBlb2YgdGV4dCA9PT0gU1RSSU5HID8gdGV4dC5yZXBsYWNlKHJEYXRhRW5jb2RlLCBnZXRDaGFyRW50aXR5KSA6IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGRhdGFVbmVuY29kZSh0ZXh0KSB7XG4gIC8vIFVuZW5jb2RlIGp1c3QgPCA+IGFuZCAmIC0gaW50ZW5kZWQgZm9yICdzYWZlIGRhdGEnIGFsb25nIHdpdGgge3s6fX0gcmF0aGVyIHRoYW4ge3s+fX1cbiAgcmV0dXJuICB0eXBlb2YgdGV4dCA9PT0gU1RSSU5HID8gdGV4dC5yZXBsYWNlKHJEYXRhVW5lbmNvZGUsIGdldENoYXJGcm9tRW50aXR5KSA6IHRleHQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gSW5pdGlhbGl6ZSA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4kc3ViID0gJHZpZXdzLnN1YjtcbiR2aWV3c1NldHRpbmdzID0gJHZpZXdzLnNldHRpbmdzO1xuXG5pZiAoIShqc3IgfHwgJCAmJiAkLnJlbmRlcikpIHtcblx0Ly8gSnNSZW5kZXIvSnNWaWV3cyBub3QgYWxyZWFkeSBsb2FkZWQgKG9yIGxvYWRlZCB3aXRob3V0IGpRdWVyeSwgYW5kIHdlIGFyZSBub3cgbW92aW5nIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lcGFjZSlcblx0Zm9yIChqc3ZTdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0cmVnaXN0ZXJTdG9yZShqc3ZTdG9yZU5hbWUsIGpzdlN0b3Jlc1tqc3ZTdG9yZU5hbWVdKTtcblx0fVxuXG5cdCRjb252ZXJ0ZXJzID0gJHZpZXdzLmNvbnZlcnRlcnM7XG5cdCRoZWxwZXJzID0gJHZpZXdzLmhlbHBlcnM7XG5cdCR0YWdzID0gJHZpZXdzLnRhZ3M7XG5cblx0JHN1Yi5fdGcucHJvdG90eXBlID0ge1xuXHRcdGJhc2VBcHBseTogYmFzZUFwcGx5LFxuXHRcdGN2dEFyZ3M6IGNvbnZlcnRBcmdzLFxuXHRcdGJuZEFyZ3M6IGNvbnZlcnRCb3VuZEFyZ3MsXG5cdFx0Y3R4UHJtOiBjb250ZXh0UGFyYW1ldGVyXG5cdH07XG5cblx0dG9wVmlldyA9ICRzdWIudG9wVmlldyA9IG5ldyBWaWV3KCk7XG5cblx0Ly9CUk9XU0VSLVNQRUNJRklDIENPREVcblx0aWYgKCQpIHtcblxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSAoPSAkKSBpcyBsb2FkZWRcblxuXHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdGlmICgkLm9ic2VydmFibGUpIHtcblx0XHRcdGlmICh2ZXJzaW9uTnVtYmVyICE9PSAodmVyc2lvbk51bWJlciA9ICQudmlld3MuanN2aWV3cykpIHtcblx0XHRcdFx0Ly8gRGlmZmVyZW50IHZlcnNpb24gb2YganNSZW5kZXIgd2FzIGxvYWRlZFxuXHRcdFx0XHR0aHJvdyBcImpxdWVyeS5vYnNlcnZhYmxlLmpzIHJlcXVpcmVzIGpzcmVuZGVyLmpzIFwiICsgdmVyc2lvbk51bWJlcjtcblx0XHRcdH1cblx0XHRcdCRleHRlbmQoJHN1YiwgJC52aWV3cy5zdWIpOyAvLyBqcXVlcnkub2JzZXJ2YWJsZS5qcyB3YXMgbG9hZGVkIGJlZm9yZSBqc3JlbmRlci5qc1xuXHRcdFx0JHZpZXdzLm1hcCA9ICQudmlld3MubWFwO1xuXHRcdH1cblxuXHR9IGVsc2Uge1xuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSBpcyBub3QgbG9hZGVkLlxuXG5cdFx0JCA9IHt9O1xuXG5cdFx0aWYgKHNldEdsb2JhbHMpIHtcblx0XHRcdGdsb2JhbC5qc3JlbmRlciA9ICQ7IC8vIFdlIGFyZSBsb2FkaW5nIGpzcmVuZGVyLmpzIGZyb20gYSBzY3JpcHQgZWxlbWVudCwgbm90IEFNRCBvciBDb21tb25KUywgc28gc2V0IGdsb2JhbFxuXHRcdH1cblxuXHRcdC8vIEVycm9yIHdhcm5pbmcgaWYganNyZW5kZXIuanMgaXMgdXNlZCBhcyB0ZW1wbGF0ZSBlbmdpbmUgb24gTm9kZS5qcyAoZS5nLiBFeHByZXNzIG9yIEhhcGkuLi4pXG5cdFx0Ly8gVXNlIGpzcmVuZGVyLW5vZGUuanMgaW5zdGVhZC4uLlxuXHRcdCQucmVuZGVyRmlsZSA9ICQuX19leHByZXNzID0gJC5jb21waWxlID0gZnVuY3Rpb24oKSB7IHRocm93IFwiTm9kZS5qczogdXNlIG5wbSBqc3JlbmRlciwgb3IganNyZW5kZXItbm9kZS5qc1wiOyB9O1xuXG5cdFx0Ly9FTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0JC5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2IpIHtcblx0XHRcdHJldHVybiB0eXBlb2Ygb2IgPT09IFwiZnVuY3Rpb25cIjtcblx0XHR9O1xuXG5cdFx0JC5pc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcblx0XHRcdHJldHVybiAoe30udG9TdHJpbmcpLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuXHRcdH07XG5cblx0XHQkc3ViLl9qcSA9IGZ1bmN0aW9uKGpxKSB7IC8vIHByaXZhdGUgbWV0aG9kIHRvIG1vdmUgZnJvbSBKc1JlbmRlciBBUElzIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdGlmIChqcSAhPT0gJCkge1xuXHRcdFx0XHQkZXh0ZW5kKGpxLCAkKTsgLy8gbWFwIG92ZXIgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVzcGFjZVxuXHRcdFx0XHQkID0ganE7XG5cdFx0XHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdFx0XHRkZWxldGUgJC5qc3JlbmRlcjtcblx0XHRcdFx0JGV4cGFuZG8gPSAkLmV4cGFuZG87XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdCQuanNyZW5kZXIgPSB2ZXJzaW9uTnVtYmVyO1xuXHR9XG5cdCRzdWJTZXR0aW5ncyA9ICRzdWIuc2V0dGluZ3M7XG5cdCRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgPSBmYWxzZTtcblx0JGlzRnVuY3Rpb24gPSAkLmlzRnVuY3Rpb247XG5cdCQucmVuZGVyID0gJHJlbmRlcjtcblx0JC52aWV3cyA9ICR2aWV3cztcblx0JC50ZW1wbGF0ZXMgPSAkdGVtcGxhdGVzID0gJHZpZXdzLnRlbXBsYXRlcztcblxuXHRmb3IgKHNldHRpbmcgaW4gJHN1YlNldHRpbmdzKSB7XG5cdFx0YWRkU2V0dGluZyhzZXR0aW5nKTtcblx0fVxuXG5cdC8qKlxuXHQqICQudmlld3Muc2V0dGluZ3MuZGVidWdNb2RlKHRydWUpXG5cdCogQHBhcmFtIHtib29sZWFufSBkZWJ1Z01vZGVcblx0KiBAcmV0dXJucyB7U2V0dGluZ3N9XG5cdCpcblx0KiBkZWJ1Z01vZGUgPSAkLnZpZXdzLnNldHRpbmdzLmRlYnVnTW9kZSgpXG5cdCogQHJldHVybnMge2Jvb2xlYW59XG5cdCovXG5cdCgkdmlld3NTZXR0aW5ncy5kZWJ1Z01vZGUgPSBmdW5jdGlvbihkZWJ1Z01vZGUpIHtcblx0XHRyZXR1cm4gZGVidWdNb2RlID09PSB1bmRlZmluZWRcblx0XHRcdD8gJHN1YlNldHRpbmdzLmRlYnVnTW9kZVxuXHRcdFx0OiAoXG5cdFx0XHRcdCRzdWJTZXR0aW5ncy5fY2xGbnMgJiYgJHN1YlNldHRpbmdzLl9jbEZucygpLCAvLyBDbGVhciBsaW5rRXhwclN0b3JlIChjYWNoZWQgY29tcGlsZWQgZXhwcmVzc2lvbnMpLCBzaW5jZSBkZWJ1Z01vZGUgc2V0dGluZyBhZmZlY3RzIGNvbXBpbGF0aW9uIGZvciBleHByZXNzaW9uc1xuXHRcdFx0XHQkc3ViU2V0dGluZ3MuZGVidWdNb2RlID0gZGVidWdNb2RlLFxuXHRcdFx0XHQkc3ViU2V0dGluZ3Mub25FcnJvciA9IHR5cGVvZiBkZWJ1Z01vZGUgPT09IFNUUklOR1xuXHRcdFx0XHRcdD8gZnVuY3Rpb24oKSB7IHJldHVybiBkZWJ1Z01vZGU7IH1cblx0XHRcdFx0XHQ6ICRpc0Z1bmN0aW9uKGRlYnVnTW9kZSlcblx0XHRcdFx0XHRcdD8gZGVidWdNb2RlXG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0JHZpZXdzU2V0dGluZ3MpO1xuXHR9KShmYWxzZSk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuXG5cdCRzdWJTZXR0aW5nc0FkdmFuY2VkID0gJHN1YlNldHRpbmdzLmFkdmFuY2VkID0ge1xuXHRcdGNhY2hlOiB0cnVlLCAvLyBCeSBkZWZhdWx0IHVzZSBjYWNoZWQgdmFsdWVzIG9mIGNvbXB1dGVkIHZhbHVlcyAoT3RoZXJ3aXNlLCBzZXQgYWR2YW5jZWQgY2FjaGUgc2V0dGluZyB0byBmYWxzZSlcblx0XHR1c2VWaWV3czogZmFsc2UsXG5cdFx0X2pzdjogZmFsc2UgLy8gRm9yIGdsb2JhbCBhY2Nlc3MgdG8gSnNWaWV3cyBzdG9yZVxuXHR9O1xuXG5cdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0ZXIgdGFncyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdCR0YWdzKHtcblx0XHRcImlmXCI6IHtcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIHt7aWZ9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0Ly8gSWYgbm90IGRvbmUgKGEgcHJldmlvdXMgYmxvY2sgaGFzIG5vdCBiZWVuIHJlbmRlcmVkKSwgbG9vayBhdCBleHByZXNzaW9uIGZvciB0aGlzIGJsb2NrIGFuZCByZW5kZXIgdGhlIGJsb2NrIGlmIGV4cHJlc3Npb24gaXMgdHJ1dGh5XG5cdFx0XHRcdC8vIE90aGVyd2lzZSByZXR1cm4gXCJcIlxuXHRcdFx0XHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0dGFnQ3R4ID0gc2VsZi50YWdDdHgsXG5cdFx0XHRcdFx0cmV0ID0gKHNlbGYucmVuZGVyaW5nLmRvbmUgfHwgIXZhbCAmJiAodGFnQ3R4LmFyZ3MubGVuZ3RoIHx8ICF0YWdDdHguaW5kZXgpKVxuXHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHQ6IChzZWxmLnJlbmRlcmluZy5kb25lID0gdHJ1ZSxcblx0XHRcdFx0XHRcdFx0c2VsZi5zZWxlY3RlZCA9IHRhZ0N0eC5pbmRleCxcblx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkKTsgLy8gVGVzdCBpcyBzYXRpc2ZpZWQsIHNvIHJlbmRlciBjb250ZW50IG9uIGN1cnJlbnQgY29udGV4dFxuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fSxcblx0XHRcdGNvbnRlbnRDdHg6IHRydWUsIC8vIEluaGVyaXQgcGFyZW50IHZpZXcgZGF0YSBjb250ZXh0XG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcImZvclwiOiB7XG5cdFx0XHRzb3J0RGF0YU1hcDogZGF0YU1hcChnZXRUYXJnZXRTb3J0ZWQpLFxuXHRcdFx0aW5pdDogZnVuY3Rpb24odmFsLCBjbG9uZWQpIHtcblx0XHRcdFx0dGhpcy5zZXREYXRhTWFwKHRoaXMudGFnQ3R4cyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0Ly8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3Ige3tmb3J9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0dmFyIHZhbHVlLCBmaWx0ZXIsIHNydEZpZWxkLCBpc0FycmF5LCBpLCBzb3J0ZWQsIGVuZCwgc3RlcCxcblx0XHRcdFx0XHRzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyYW5nZSA9IHRhZ0N0eC5hcmdEZWZhdWx0ID09PSBmYWxzZSxcblx0XHRcdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcyxcblx0XHRcdFx0XHRpdGVyYXRlID0gcmFuZ2UgfHwgdGFnQ3R4LmFyZ3MubGVuZ3RoLCAvLyBOb3QgZmluYWwgZWxzZSBhbmQgbm90IGF1dG8tY3JlYXRlIHJhbmdlXG5cdFx0XHRcdFx0cmVzdWx0ID0gXCJcIixcblx0XHRcdFx0XHRkb25lID0gMDtcblxuXHRcdFx0XHRpZiAoIXNlbGYucmVuZGVyaW5nLmRvbmUpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGl0ZXJhdGUgPyB2YWwgOiB0YWdDdHgudmlldy5kYXRhOyAvLyBGb3IgdGhlIGZpbmFsIGVsc2UsIGRlZmF1bHRzIHRvIGN1cnJlbnQgZGF0YSB3aXRob3V0IGl0ZXJhdGlvbi5cblxuXHRcdFx0XHRcdGlmIChyYW5nZSkge1xuXHRcdFx0XHRcdFx0cmFuZ2UgPSBwcm9wcy5yZXZlcnNlID8gXCJ1bnNoaWZ0XCIgOiBcInB1c2hcIjtcblx0XHRcdFx0XHRcdGVuZCA9ICtwcm9wcy5lbmQ7XG5cdFx0XHRcdFx0XHRzdGVwID0gK3Byb3BzLnN0ZXAgfHwgMTtcblx0XHRcdFx0XHRcdHZhbHVlID0gW107IC8vIGF1dG8tY3JlYXRlIGludGVnZXIgYXJyYXkgc2NlbmFyaW8gb2Yge3tmb3Igc3RhcnQ9eHh4IGVuZD15eXl9fVxuXHRcdFx0XHRcdFx0Zm9yIChpID0gK3Byb3BzLnN0YXJ0IHx8IDA7IChlbmQgLSBpKSAqIHN0ZXAgPiAwOyBpICs9IHN0ZXApIHtcblx0XHRcdFx0XHRcdFx0dmFsdWVbcmFuZ2VdKGkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0aXNBcnJheSA9ICRpc0FycmF5KHZhbHVlKTtcblx0XHRcdFx0XHRcdHJlc3VsdCArPSB0YWdDdHgucmVuZGVyKHZhbHVlLCAhaXRlcmF0ZSB8fCBwcm9wcy5ub0l0ZXJhdGlvbik7XG5cdFx0XHRcdFx0XHQvLyBJdGVyYXRlcyBpZiBkYXRhIGlzIGFuIGFycmF5LCBleGNlcHQgb24gZmluYWwgZWxzZSAtIG9yIGlmIG5vSXRlcmF0aW9uIHByb3BlcnR5XG5cdFx0XHRcdFx0XHQvLyBzZXQgdG8gdHJ1ZS4gKFVzZSB7e2luY2x1ZGV9fSB0byBjb21wb3NlIHRlbXBsYXRlcyB3aXRob3V0IGFycmF5IGl0ZXJhdGlvbilcblx0XHRcdFx0XHRcdGRvbmUgKz0gaXNBcnJheSA/IHZhbHVlLmxlbmd0aCA6IDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzZWxmLnJlbmRlcmluZy5kb25lID0gZG9uZSkge1xuXHRcdFx0XHRcdFx0c2VsZi5zZWxlY3RlZCA9IHRhZ0N0eC5pbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gSWYgbm90aGluZyB3YXMgcmVuZGVyZWQgd2Ugd2lsbCBsb29rIGF0IHRoZSBuZXh0IHt7ZWxzZX19LiBPdGhlcndpc2UsIHdlIGFyZSBkb25lLlxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RGF0YU1hcDogZnVuY3Rpb24odGFnQ3R4cykge1xuXHRcdFx0XHR2YXIgdGFnQ3R4LCBwcm9wcywgcGFyYW1zUHJvcHMsXG5cdFx0XHRcdFx0c2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0bCA9IHRhZ0N0eHMubGVuZ3RoO1xuXHRcdFx0XHR3aGlsZSAobC0tKSB7XG5cdFx0XHRcdFx0dGFnQ3R4ID0gdGFnQ3R4c1tsXTtcblx0XHRcdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcztcblx0XHRcdFx0XHRwYXJhbXNQcm9wcyA9IHRhZ0N0eC5wYXJhbXMucHJvcHM7XG5cdFx0XHRcdFx0dGFnQ3R4LmFyZ0RlZmF1bHQgPSBwcm9wcy5lbmQgPT09IHVuZGVmaW5lZCB8fCB0YWdDdHguYXJncy5sZW5ndGggPiAwOyAvLyBEZWZhdWx0IHRvICNkYXRhIGV4Y2VwdCBmb3IgYXV0by1jcmVhdGUgcmFuZ2Ugc2NlbmFyaW8ge3tmb3Igc3RhcnQ9eHh4IGVuZD15eXkgc3RlcD16enp9fVxuXHRcdFx0XHRcdHByb3BzLmRhdGFNYXAgPSAodGFnQ3R4LmFyZ0RlZmF1bHQgIT09IGZhbHNlICYmICRpc0FycmF5KHRhZ0N0eC5hcmdzWzBdKSAmJlxuXHRcdFx0XHRcdFx0KHBhcmFtc1Byb3BzLnNvcnQgfHwgcGFyYW1zUHJvcHMuc3RhcnQgfHwgcGFyYW1zUHJvcHMuZW5kIHx8IHBhcmFtc1Byb3BzLnN0ZXAgfHwgcGFyYW1zUHJvcHMuZmlsdGVyIHx8IHBhcmFtc1Byb3BzLnJldmVyc2Vcblx0XHRcdFx0XHRcdHx8IHByb3BzLnNvcnQgfHwgcHJvcHMuc3RhcnQgfHwgcHJvcHMuZW5kIHx8IHByb3BzLnN0ZXAgfHwgcHJvcHMuZmlsdGVyIHx8IHByb3BzLnJldmVyc2UpKVxuXHRcdFx0XHRcdFx0JiYgc2VsZi5zb3J0RGF0YU1hcDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdHByb3BzOiB7XG5cdFx0XHRiYXNlVGFnOiBcImZvclwiLFxuXHRcdFx0ZGF0YU1hcDogZGF0YU1hcChnZXRUYXJnZXRQcm9wcyksXG5cdFx0XHRpbml0OiBub29wLCAvLyBEb24ndCBleGVjdXRlIHRoZSBiYXNlIGluaXQoKSBvZiB0aGUgXCJmb3JcIiB0YWdcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdGluY2x1ZGU6IHtcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiKlwiOiB7XG5cdFx0XHQvLyB7eyogY29kZS4uLiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0XCI6KlwiOiB7XG5cdFx0XHQvLyB7ezoqIHJldHVybmVkRXhwcmVzc2lvbiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0ZGJnOiAkaGVscGVycy5kYmcgPSAkY29udmVydGVycy5kYmcgPSBkYmdCcmVhayAvLyBSZWdpc3RlciB7e2RiZy99fSwge3tkYmc6Li4ufX0gYW5kIH5kYmcoKSB0byB0aHJvdyBhbmQgY2F0Y2gsIGFzIGJyZWFrcG9pbnRzIGZvciBkZWJ1Z2dpbmcuXG5cdH0pO1xuXG5cdCRjb252ZXJ0ZXJzKHtcblx0XHRodG1sOiBodG1sRW5jb2RlLFxuXHRcdGF0dHI6IGh0bWxFbmNvZGUsIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0XHRlbmNvZGU6IGRhdGFFbmNvZGUsXG5cdFx0dW5lbmNvZGU6IGRhdGFVbmVuY29kZSwgLy8gSW5jbHVkZXMgPiBlbmNvZGluZyBzaW5jZSByQ29udmVydE1hcmtlcnMgaW4gSnNWaWV3cyBkb2VzIG5vdCBza2lwID4gY2hhcmFjdGVycyBpbiBhdHRyaWJ1dGUgc3RyaW5nc1xuXHRcdHVybDogZnVuY3Rpb24odGV4dCkge1xuXHRcdFx0Ly8gVVJMIGVuY29kaW5nIGhlbHBlci5cblx0XHRcdHJldHVybiB0ZXh0ICE9IHVuZGVmaW5lZCA/IGVuY29kZVVSSShcIlwiICsgdGV4dCkgOiB0ZXh0ID09PSBudWxsID8gdGV4dCA6IFwiXCI7IC8vIG51bGwgcmV0dXJucyBudWxsLCBlLmcuIHRvIHJlbW92ZSBhdHRyaWJ1dGUuIHVuZGVmaW5lZCByZXR1cm5zIFwiXCJcblx0XHR9XG5cdH0pO1xufVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBEZWZpbmUgZGVmYXVsdCBkZWxpbWl0ZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG4kc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuJGlzQXJyYXkgPSAoJHx8anNyKS5pc0FycmF5O1xuJHZpZXdzU2V0dGluZ3MuZGVsaW1pdGVycyhcInt7XCIsIFwifX1cIiwgXCJeXCIpO1xuXG5pZiAoanNyVG9KcSkgeyAvLyBNb3ZpbmcgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVwYWNlIC0gY29weSBvdmVyIHRoZSBzdG9yZWQgaXRlbXMgKHRlbXBsYXRlcywgY29udmVydGVycywgaGVscGVycy4uLilcblx0anNyLnZpZXdzLnN1Yi5fanEoJCk7XG59XG5yZXR1cm4gJCB8fCBqc3I7XG59LCB3aW5kb3cpKTtcbiIsIi8qZ2xvYmFsIFFVbml0LCB0ZXN0LCBlcXVhbCwgb2sqL1xuKGZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbmJyb3dzZXJpZnkuZG9uZS5vbmUgPSB0cnVlO1xuXG5RVW5pdC5tb2R1bGUoXCJCcm93c2VyaWZ5IC0gY2xpZW50IGNvZGVcIik7XG5cbnZhciBpc0lFOCA9IHdpbmRvdy5hdHRhY2hFdmVudCAmJiAhd2luZG93LmFkZEV2ZW50TGlzdGVuZXI7XG5cbmlmICghaXNJRTgpIHtcblxudGVzdChcIk5vIGpRdWVyeSBnbG9iYWw6IHJlcXVpcmUoJ2pzcmVuZGVyJykoKVwiLCBmdW5jdGlvbigpIHtcblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBIaWRlIFFVbml0IGdsb2JhbCBqUXVlcnkgYW5kIGFueSBwcmV2aW91cyBnbG9iYWwganNyZW5kZXIuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblx0dmFyIGpRdWVyeSA9IGdsb2JhbC5qUXVlcnksIGpzciA9IGdsb2JhbC5qc3JlbmRlcjtcblx0Z2xvYmFsLmpRdWVyeSA9IGdsb2JhbC5qc3JlbmRlciA9IHVuZGVmaW5lZDtcblxuXHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IEFycmFuZ2UgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXHR2YXIgZGF0YSA9IHtuYW1lOiBcIkpvXCJ9O1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uIEFjdCAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdHZhciBqc3JlbmRlciA9IHJlcXVpcmUoJy4uLy4uLycpKCk7IC8vIE5vdCBwYXNzaW5nIGluIGpRdWVyeSwgc28gcmV0dXJucyB0aGUganNyZW5kZXIgbmFtZXNwYWNlXG5cblx0Ly8gVXNlIHJlcXVpcmUgdG8gZ2V0IHNlcnZlciB0ZW1wbGF0ZSwgdGhhbmtzIHRvIEJyb3dzZXJpZnkgYnVuZGxlIHRoYXQgdXNlZCBqc3JlbmRlci90bXBsaWZ5IHRyYW5zZm9ybVxuXHR2YXIgdG1wbCA9IHJlcXVpcmUoJy4uL3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWwnKShqc3JlbmRlcik7IC8vIFByb3ZpZGUganNyZW5kZXJcblxuXHR2YXIgcmVzdWx0ID0gdG1wbChkYXRhKTtcblxuXHRyZXN1bHQgKz0gXCIgXCIgKyAoanNyZW5kZXIgIT09IGpRdWVyeSk7XG5cblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBc3NlcnQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGVxdWFsKHJlc3VsdCwgXCJOYW1lOiBKbyAobmFtZS10ZW1wbGF0ZS5odG1sKSB0cnVlXCIsIFwicmVzdWx0OiBObyBqUXVlcnkgZ2xvYmFsOiByZXF1aXJlKCdqc3JlbmRlcicpKClcIik7XG5cblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBSZXNldCAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblx0Z2xvYmFsLmpRdWVyeSA9IGpRdWVyeTsgLy8gUmVwbGFjZSBRVW5pdCBnbG9iYWwgalF1ZXJ5XG5cdGdsb2JhbC5qc3JlbmRlciA9IGpzcjsgLy8gUmVwbGFjZSBhbnkgcHJldmlvdXMgZ2xvYmFsIGpzcmVuZGVyXG59KTtcbn1cbn0pKCk7XG4iLCJ2YXIgdG1wbFJlZnMgPSBbXSxcbiAgbWt1cCA9ICdOYW1lOiB7ezpuYW1lfX0gKG5hbWUtdGVtcGxhdGUuaHRtbCknLFxuICAkID0gZ2xvYmFsLmpzcmVuZGVyIHx8IGdsb2JhbC5qUXVlcnk7XG5cbm1vZHVsZS5leHBvcnRzID0gJCA/ICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWxcIiwgbWt1cCkgOlxuICBmdW5jdGlvbigkKSB7XG4gICAgaWYgKCEkIHx8ICEkLnZpZXdzKSB7dGhyb3cgXCJSZXF1aXJlcyBqc3JlbmRlci9qUXVlcnlcIjt9XG4gICAgd2hpbGUgKHRtcGxSZWZzLmxlbmd0aCkge1xuICAgICAgdG1wbFJlZnMucG9wKCkoJCk7IC8vIGNvbXBpbGUgbmVzdGVkIHRlbXBsYXRlXG4gICAgfVxuXG4gICAgcmV0dXJuICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWxcIiwgbWt1cClcbiAgfTsiXX0=
