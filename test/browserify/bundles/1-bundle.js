(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v1.0.4: http://jsviews.com/#jsrender */
/*! **VERSION FOR WEB** (For NODE.JS see http://jsviews.com/download/jsrender-node.js) */
/*
 * Best-of-breed templating in browser or on Node.js.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://jsviews.com/#jsviews)
 *
 * Copyright 2019, Boris Moore
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

var versionNumber = "v1.0.4",
	jsvStoreName, rTag, rTmplString, topView, $views, $expando,
	_ocp = "_ocp", // Observable contextual parameter

//TODO	tmplFnsCache = {},
	$isFunction, $isArray, $templates, $converters, $helpers, $tags, $sub, $subSettings, $subSettingsAdvanced, $viewsSettings,
	delimOpenChar0, delimOpenChar1, delimCloseChar0, delimCloseChar1, linkChar, setting, baseOnError,

	isRenderCall,
	rNewLine = /[ \t]*(\r\n|\n|\r)/g,
	rUnescapeQuotes = /\\(['"])/g,
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
			rPath: /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
			//        not                               object     helper    view  viewProperty pathTokens      leafToken

			rPrm: /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|~(?![\w$])|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
			//   lftPrn0           lftPrn         bound     path               operator     err                                          eq      path2 late            prn      comma  lftPrn2   apos quot        rtPrn  rtPrnDot                  prn2     space

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
			if (prop + "" !== prop) {
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
		data = data + "" === data
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
		data = data + "" === data
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
						assigned[j] = found = id + "" === id
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
			if (model.hasOwnProperty(prop) && (prop.charAt(0) !== "_" || !getterNames[prop.slice(1)]) && prop !== $expando  && !$isFunction(model[prop])) {
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
* @param {boolean}  value
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
	// /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(~?[\w$.^]+)?\s*((\+\+|--)|\+|-|~(?![\w$])|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?(@)?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//lftPrn0           lftPrn         bound     path               operator     err                                          eq      path2 late            prn      comma  lftPrn2   apos quot        rtPrn  rtPrnDot                  prn2     space
	// (left paren? followed by (path? followed by operator) or (path followed by paren?)) or comma or apos or quot or right paren or space

		function parsePath(allPath, not, object, helper, view, viewProperty, pathTokens, leafToken) {
			// /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
			//    not                               object     helper    view  viewProperty pathTokens      leafToken
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
				if (parenDepth) {
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
								? (path.split("^").join(".").replace($sub.rPath, parsePath)
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
	result = (params + (tmpl ? " " : "")).replace($sub.rPrm, parseTokens);

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

	start = props.start; // Get current value - after possible  changes triggered by tag.sorted refresh() above
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xLXVuaXQtdGVzdHMuanMiLCJ0ZXN0L3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdDNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIEpzUmVuZGVyIHYxLjAuNDogaHR0cDovL2pzdmlld3MuY29tLyNqc3JlbmRlciAqL1xuLyohICoqVkVSU0lPTiBGT1IgV0VCKiogKEZvciBOT0RFLkpTIHNlZSBodHRwOi8vanN2aWV3cy5jb20vZG93bmxvYWQvanNyZW5kZXItbm9kZS5qcykgKi9cbi8qXG4gKiBCZXN0LW9mLWJyZWVkIHRlbXBsYXRpbmcgaW4gYnJvd3NlciBvciBvbiBOb2RlLmpzLlxuICogRG9lcyBub3QgcmVxdWlyZSBqUXVlcnksIG9yIEhUTUwgRE9NXG4gKiBJbnRlZ3JhdGVzIHdpdGggSnNWaWV3cyAoaHR0cDovL2pzdmlld3MuY29tLyNqc3ZpZXdzKVxuICpcbiAqIENvcHlyaWdodCAyMDE5LCBCb3JpcyBNb29yZVxuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLlxuICovXG5cbi8vanNoaW50IC1XMDE4LCAtVzA0MSwgLVcxMjBcblxuKGZ1bmN0aW9uKGZhY3RvcnksIGdsb2JhbCkge1xuXHQvLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxuXHR2YXIgJCA9IGdsb2JhbC5qUXVlcnk7XG5cblx0aWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7IC8vIENvbW1vbkpTIGUuZy4gQnJvd3NlcmlmeVxuXHRcdG1vZHVsZS5leHBvcnRzID0gJFxuXHRcdFx0PyBmYWN0b3J5KGdsb2JhbCwgJClcblx0XHRcdDogZnVuY3Rpb24oJCkgeyAvLyBJZiBubyBnbG9iYWwgalF1ZXJ5LCB0YWtlIG9wdGlvbmFsIGpRdWVyeSBwYXNzZWQgYXMgcGFyYW1ldGVyOiByZXF1aXJlKCdqc3JlbmRlcicpKGpRdWVyeSlcblx0XHRcdFx0aWYgKCQgJiYgISQuZm4pIHtcblx0XHRcdFx0XHR0aHJvdyBcIlByb3ZpZGUgalF1ZXJ5IG9yIG51bGxcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwsICQpO1xuXHRcdFx0fTtcblx0fSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgc2NyaXB0IGxvYWRlciwgZS5nLiBSZXF1aXJlSlNcblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwpO1xuXHRcdH0pO1xuXHR9IGVsc2UgeyAvLyBCcm93c2VyIHVzaW5nIHBsYWluIDxzY3JpcHQ+IHRhZ1xuXHRcdGZhY3RvcnkoZ2xvYmFsLCBmYWxzZSk7XG5cdH1cbn0gKFxuXG4vLyBmYWN0b3J5IChmb3IganNyZW5kZXIuanMpXG5mdW5jdGlvbihnbG9iYWwsICQpIHtcblwidXNlIHN0cmljdFwiO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCB2YXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIGdsb2JhbCB2YXIgaXMgdGhlIHRoaXMgb2JqZWN0LCB3aGljaCBpcyB3aW5kb3cgd2hlbiBydW5uaW5nIGluIHRoZSB1c3VhbCBicm93c2VyIGVudmlyb25tZW50XG52YXIgc2V0R2xvYmFscyA9ICQgPT09IGZhbHNlOyAvLyBPbmx5IHNldCBnbG9iYWxzIGlmIHNjcmlwdCBibG9jayBpbiBicm93c2VyIChub3QgQU1EIGFuZCBub3QgQ29tbW9uSlMpXG5cbiQgPSAkICYmICQuZm4gPyAkIDogZ2xvYmFsLmpRdWVyeTsgLy8gJCBpcyBqUXVlcnkgcGFzc2VkIGluIGJ5IENvbW1vbkpTIGxvYWRlciAoQnJvd3NlcmlmeSksIG9yIGdsb2JhbCBqUXVlcnkuXG5cbnZhciB2ZXJzaW9uTnVtYmVyID0gXCJ2MS4wLjRcIixcblx0anN2U3RvcmVOYW1lLCByVGFnLCByVG1wbFN0cmluZywgdG9wVmlldywgJHZpZXdzLCAkZXhwYW5kbyxcblx0X29jcCA9IFwiX29jcFwiLCAvLyBPYnNlcnZhYmxlIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cbi8vVE9ET1x0dG1wbEZuc0NhY2hlID0ge30sXG5cdCRpc0Z1bmN0aW9uLCAkaXNBcnJheSwgJHRlbXBsYXRlcywgJGNvbnZlcnRlcnMsICRoZWxwZXJzLCAkdGFncywgJHN1YiwgJHN1YlNldHRpbmdzLCAkc3ViU2V0dGluZ3NBZHZhbmNlZCwgJHZpZXdzU2V0dGluZ3MsXG5cdGRlbGltT3BlbkNoYXIwLCBkZWxpbU9wZW5DaGFyMSwgZGVsaW1DbG9zZUNoYXIwLCBkZWxpbUNsb3NlQ2hhcjEsIGxpbmtDaGFyLCBzZXR0aW5nLCBiYXNlT25FcnJvcixcblxuXHRpc1JlbmRlckNhbGwsXG5cdHJOZXdMaW5lID0gL1sgXFx0XSooXFxyXFxufFxcbnxcXHIpL2csXG5cdHJVbmVzY2FwZVF1b3RlcyA9IC9cXFxcKFsnXCJdKS9nLFxuXHRyRXNjYXBlUXVvdGVzID0gL1snXCJcXFxcXS9nLCAvLyBFc2NhcGUgcXVvdGVzIGFuZCBcXCBjaGFyYWN0ZXJcblx0ckJ1aWxkSGFzaCA9IC8oPzpcXHgwOHxeKShvbmVycm9yOik/KD86KH4/KSgoW1xcdyQuXSspOik/KFteXFx4MDhdKykpXFx4MDgoLCk/KFteXFx4MDhdKykvZ2ksXG5cdHJUZXN0RWxzZUlmID0gL15pZlxccy8sXG5cdHJGaXJzdEVsZW0gPSAvPChcXHcrKVs+XFxzXS8sXG5cdHJBdHRyRW5jb2RlID0gL1tcXHgwMGA+PFwiJyY9XS9nLCAvLyBJbmNsdWRlcyA+IGVuY29kaW5nIHNpbmNlIHJDb252ZXJ0TWFya2VycyBpbiBKc1ZpZXdzIGRvZXMgbm90IHNraXAgPiBjaGFyYWN0ZXJzIGluIGF0dHJpYnV0ZSBzdHJpbmdzXG5cdHJJc0h0bWwgPSAvW1xceDAwYD48XFxcIicmPV0vLFxuXHRySGFzSGFuZGxlcnMgPSAvXm9uW0EtWl18XmNvbnZlcnQoQmFjayk/JC8sXG5cdHJXcmFwcGVkSW5WaWV3TWFya2VyID0gL15cXCNcXGQrX2BbXFxzXFxTXSpcXC9cXGQrX2AkLyxcblx0ckh0bWxFbmNvZGUgPSByQXR0ckVuY29kZSxcblx0ckRhdGFFbmNvZGUgPSAvWyY8Pl0vZyxcblx0ckRhdGFVbmVuY29kZSA9IC8mKGFtcHxndHxsdCk7L2csXG5cdHJCcmFja2V0UXVvdGUgPSAvXFxbWydcIl0/fFsnXCJdP1xcXS9nLFxuXHR2aWV3SWQgPSAwLFxuXHRjaGFyRW50aXRpZXMgPSB7XG5cdFx0XCImXCI6IFwiJmFtcDtcIixcblx0XHRcIjxcIjogXCImbHQ7XCIsXG5cdFx0XCI+XCI6IFwiJmd0O1wiLFxuXHRcdFwiXFx4MDBcIjogXCImIzA7XCIsXG5cdFx0XCInXCI6IFwiJiMzOTtcIixcblx0XHQnXCInOiBcIiYjMzQ7XCIsXG5cdFx0XCJgXCI6IFwiJiM5NjtcIixcblx0XHRcIj1cIjogXCImIzYxO1wiXG5cdH0sXG5cdGNoYXJzRnJvbUVudGl0aWVzICA9IHtcblx0XHRhbXA6IFwiJlwiLFxuXHRcdGd0OiBcIj5cIixcblx0XHRsdDogXCI8XCJcblx0fSxcblx0SFRNTCA9IFwiaHRtbFwiLFxuXHRPQkpFQ1QgPSBcIm9iamVjdFwiLFxuXHR0bXBsQXR0ciA9IFwiZGF0YS1qc3YtdG1wbFwiLFxuXHRqc3ZUbXBsID0gXCJqc3ZUbXBsXCIsXG5cdGluZGV4U3RyID0gXCJGb3IgI2luZGV4IGluIG5lc3RlZCBibG9jayB1c2UgI2dldEluZGV4KCkuXCIsXG5cdCRyZW5kZXIgPSB7fSxcblxuXHRqc3IgPSBnbG9iYWwuanNyZW5kZXIsXG5cdGpzclRvSnEgPSBqc3IgJiYgJCAmJiAhJC5yZW5kZXIsIC8vIEpzUmVuZGVyIGFscmVhZHkgbG9hZGVkLCB3aXRob3V0IGpRdWVyeS4gYnV0IHdlIHdpbGwgcmUtbG9hZCBpdCBub3cgdG8gYXR0YWNoIHRvIGpRdWVyeVxuXG5cdGpzdlN0b3JlcyA9IHtcblx0XHR0ZW1wbGF0ZToge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRtcGxcblx0XHR9LFxuXHRcdHRhZzoge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRhZ1xuXHRcdH0sXG5cdFx0dmlld01vZGVsOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVmlld01vZGVsXG5cdFx0fSxcblx0XHRoZWxwZXI6IHt9LFxuXHRcdGNvbnZlcnRlcjoge31cblx0fTtcblxuXHQvLyB2aWV3cyBvYmplY3QgKCQudmlld3MgaWYgalF1ZXJ5IGlzIGxvYWRlZCwganNyZW5kZXIudmlld3MgaWYgbm8galF1ZXJ5LCBlLmcuIGluIE5vZGUuanMpXG5cdCR2aWV3cyA9IHtcblx0XHRqc3ZpZXdzOiB2ZXJzaW9uTnVtYmVyLFxuXHRcdHN1Yjoge1xuXHRcdFx0Ly8gc3Vic2NyaXB0aW9uLCBlLmcuIEpzVmlld3MgaW50ZWdyYXRpb25cblx0XHRcdHJQYXRoOiAvXighKj8pKD86bnVsbHx0cnVlfGZhbHNlfFxcZFtcXGQuXSp8KFtcXHckXSt8XFwufH4oW1xcdyRdKyl8Iyh2aWV3fChbXFx3JF0rKSk/KShbXFx3JC5eXSo/KSg/OlsuW15dKFtcXHckXSspXFxdPyk/KSQvZyxcblx0XHRcdC8vICAgICAgICBub3QgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ICAgICBoZWxwZXIgICAgdmlldyAgdmlld1Byb3BlcnR5IHBhdGhUb2tlbnMgICAgICBsZWFmVG9rZW5cblxuXHRcdFx0clBybTogLyhcXCgpKD89XFxzKlxcKCl8KD86KFsoW10pXFxzKik/KD86KFxcXj8pKH4/W1xcdyQuXl0rKT9cXHMqKChcXCtcXCt8LS0pfFxcK3wtfH4oPyFbXFx3JF0pfCYmfFxcfFxcfHw9PT18IT09fD09fCE9fDw9fD49fFs8PiUqOj9cXC9dfCg9KSlcXHMqfCghKj8oQCk/WyN+XT9bXFx3JC5eXSspKFsoW10pPyl8KCxcXHMqKXwoXFwoPylcXFxcPyg/OignKXwoXCIpKXwoPzpcXHMqKChbKVxcXV0pKD89Wy5eXXxcXHMqJHxbXihbXSl8WylcXF1dKShbKFtdPykpfChcXHMrKS9nLFxuXHRcdFx0Ly8gICBsZnRQcm4wICAgICAgICAgICBsZnRQcm4gICAgICAgICBib3VuZCAgICAgcGF0aCAgICAgICAgICAgICAgIG9wZXJhdG9yICAgICBlcnIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcSAgICAgIHBhdGgyIGxhdGUgICAgICAgICAgICBwcm4gICAgICBjb21tYSAgbGZ0UHJuMiAgIGFwb3MgcXVvdCAgICAgICAgcnRQcm4gIHJ0UHJuRG90ICAgICAgICAgICAgICAgICAgcHJuMiAgICAgc3BhY2VcblxuXHRcdFx0VmlldzogVmlldyxcblx0XHRcdEVycjogSnNWaWV3c0Vycm9yLFxuXHRcdFx0dG1wbEZuOiB0bXBsRm4sXG5cdFx0XHRwYXJzZTogcGFyc2VQYXJhbXMsXG5cdFx0XHRleHRlbmQ6ICRleHRlbmQsXG5cdFx0XHRleHRlbmRDdHg6IGV4dGVuZEN0eCxcblx0XHRcdHN5bnRheEVycjogc3ludGF4RXJyb3IsXG5cdFx0XHRvblN0b3JlOiB7XG5cdFx0XHRcdHRlbXBsYXRlOiBmdW5jdGlvbihuYW1lLCBpdGVtKSB7XG5cdFx0XHRcdFx0aWYgKGl0ZW0gPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSAkcmVuZGVyW25hbWVdO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAobmFtZSkge1xuXHRcdFx0XHRcdFx0JHJlbmRlcltuYW1lXSA9IGl0ZW07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkU2V0dGluZzogYWRkU2V0dGluZyxcblx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdGFsbG93Q29kZTogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRhZHZTZXQ6IG5vb3AsIC8vIFVwZGF0ZSBhZHZhbmNlZCBzZXR0aW5nc1xuXHRcdFx0X3RocDogdGFnSGFuZGxlcnNGcm9tUHJvcHMsXG5cdFx0XHRfZ206IGdldE1ldGhvZCxcblx0XHRcdF90ZzogZnVuY3Rpb24oKSB7fSwgLy8gQ29uc3RydWN0b3IgZm9yIHRhZ0RlZlxuXHRcdFx0X2NudnQ6IGNvbnZlcnRWYWwsXG5cdFx0XHRfdGFnOiByZW5kZXJUYWcsXG5cdFx0XHRfZXI6IGVycm9yLFxuXHRcdFx0X2Vycjogb25SZW5kZXJFcnJvcixcblx0XHRcdF9jcDogcmV0VmFsLCAvLyBHZXQgb2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlcnMgKG9yIHByb3BlcnRpZXMpIH5mb289ZXhwci4gSW4gSnNSZW5kZXIsIHNpbXBseSByZXR1cm5zIHZhbC5cblx0XHRcdF9zcTogZnVuY3Rpb24odG9rZW4pIHtcblx0XHRcdFx0aWYgKHRva2VuID09PSBcImNvbnN0cnVjdG9yXCIpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcihcIlwiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdG9rZW47XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRzZXR0aW5nczoge1xuXHRcdFx0ZGVsaW1pdGVyczogJHZpZXdzRGVsaW1pdGVycyxcblx0XHRcdGFkdmFuY2VkOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWVcblx0XHRcdFx0XHQ/IChcblx0XHRcdFx0XHRcdFx0JGV4dGVuZCgkc3ViU2V0dGluZ3NBZHZhbmNlZCwgdmFsdWUpLFxuXHRcdFx0XHRcdFx0XHQkc3ViLmFkdlNldCgpLFxuXHRcdFx0XHRcdFx0XHQkdmlld3NTZXR0aW5nc1xuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0OiAkc3ViU2V0dGluZ3NBZHZhbmNlZDtcblx0XHRcdFx0fVxuXHRcdH0sXG5cdFx0bWFwOiBkYXRhTWFwICAgIC8vIElmIGpzT2JzZXJ2YWJsZSBsb2FkZWQgZmlyc3QsIHVzZSB0aGF0IGRlZmluaXRpb24gb2YgZGF0YU1hcFxuXHR9O1xuXG5mdW5jdGlvbiBnZXREZXJpdmVkTWV0aG9kKGJhc2VNZXRob2QsIG1ldGhvZCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHJldCxcblx0XHRcdHRhZyA9IHRoaXMsXG5cdFx0XHRwcmV2QmFzZSA9IHRhZy5iYXNlO1xuXG5cdFx0dGFnLmJhc2UgPSBiYXNlTWV0aG9kOyAvLyBXaXRoaW4gbWV0aG9kIGNhbGwsIGNhbGxpbmcgdGhpcy5iYXNlIHdpbGwgY2FsbCB0aGUgYmFzZSBtZXRob2Rcblx0XHRyZXQgPSBtZXRob2QuYXBwbHkodGFnLCBhcmd1bWVudHMpOyAvLyBDYWxsIHRoZSBtZXRob2Rcblx0XHR0YWcuYmFzZSA9IHByZXZCYXNlOyAvLyBSZXBsYWNlIHRoaXMuYmFzZSB0byBiZSB0aGUgYmFzZSBtZXRob2Qgb2YgdGhlIHByZXZpb3VzIGNhbGwsIGZvciBjaGFpbmVkIGNhbGxzXG5cdFx0cmV0dXJuIHJldDtcblx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0TWV0aG9kKGJhc2VNZXRob2QsIG1ldGhvZCkge1xuXHQvLyBGb3IgZGVyaXZlZCBtZXRob2RzIChvciBoYW5kbGVycyBkZWNsYXJlZCBkZWNsYXJhdGl2ZWx5IGFzIGluIHt7OmZvbyBvbkNoYW5nZT1+Zm9vQ2hhbmdlZH19IHJlcGxhY2UgYnkgYSBkZXJpdmVkIG1ldGhvZCwgdG8gYWxsb3cgdXNpbmcgdGhpcy5iYXNlKC4uLilcblx0Ly8gb3IgdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSB0byBjYWxsIHRoZSBiYXNlIGltcGxlbWVudGF0aW9uLiAoRXF1aXZhbGVudCB0byB0aGlzLl9zdXBlciguLi4pIGFuZCB0aGlzLl9zdXBlckFwcGx5KGFyZ3VtZW50cykgaW4galF1ZXJ5IFVJKVxuXHRpZiAoJGlzRnVuY3Rpb24obWV0aG9kKSkge1xuXHRcdG1ldGhvZCA9IGdldERlcml2ZWRNZXRob2QoXG5cdFx0XHRcdCFiYXNlTWV0aG9kXG5cdFx0XHRcdFx0PyBub29wIC8vIG5vIGJhc2UgbWV0aG9kIGltcGxlbWVudGF0aW9uLCBzbyB1c2Ugbm9vcCBhcyBiYXNlIG1ldGhvZFxuXHRcdFx0XHRcdDogYmFzZU1ldGhvZC5fZFxuXHRcdFx0XHRcdFx0PyBiYXNlTWV0aG9kIC8vIGJhc2VNZXRob2QgaXMgYSBkZXJpdmVkIG1ldGhvZCwgc28gdXNlIGl0XG5cdFx0XHRcdFx0XHQ6IGdldERlcml2ZWRNZXRob2Qobm9vcCwgYmFzZU1ldGhvZCksIC8vIGJhc2VNZXRob2QgaXMgbm90IGRlcml2ZWQgc28gbWFrZSBpdHMgYmFzZSBtZXRob2QgYmUgdGhlIG5vb3AgbWV0aG9kXG5cdFx0XHRcdG1ldGhvZFxuXHRcdFx0KTtcblx0XHRtZXRob2QuX2QgPSAoYmFzZU1ldGhvZCAmJiBiYXNlTWV0aG9kLl9kIHx8IDApICsgMTsgLy8gQWRkIGZsYWcgZm9yIGRlcml2ZWQgbWV0aG9kIChpbmNyZW1lbnRlZCBmb3IgZGVyaXZlZCBvZiBkZXJpdmVkLi4uKVxuXHR9XG5cdHJldHVybiBtZXRob2Q7XG59XG5cbmZ1bmN0aW9uIHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4KSB7XG5cdHZhciBwcm9wLFxuXHRcdHByb3BzID0gdGFnQ3R4LnByb3BzO1xuXHRmb3IgKHByb3AgaW4gcHJvcHMpIHtcblx0XHRpZiAockhhc0hhbmRsZXJzLnRlc3QocHJvcCkgJiYgISh0YWdbcHJvcF0gJiYgdGFnW3Byb3BdLmZpeCkpIHsgLy8gRG9uJ3Qgb3ZlcnJpZGUgaGFuZGxlcnMgd2l0aCBmaXggZXhwYW5kbyAodXNlZCBpbiBkYXRlcGlja2VyIGFuZCBzcGlubmVyKVxuXHRcdFx0dGFnW3Byb3BdID0gcHJvcCAhPT0gXCJjb252ZXJ0XCIgPyBnZXRNZXRob2QodGFnLmNvbnN0cnVjdG9yLnByb3RvdHlwZVtwcm9wXSwgcHJvcHNbcHJvcF0pIDogcHJvcHNbcHJvcF07XG5cdFx0XHQvLyBDb3B5IG92ZXIgdGhlIG9uRm9vIHByb3BzLCBjb252ZXJ0IGFuZCBjb252ZXJ0QmFjayBmcm9tIHRhZ0N0eC5wcm9wcyB0byB0YWcgKG92ZXJyaWRlcyB2YWx1ZXMgaW4gdGFnRGVmKS5cblx0XHRcdC8vIE5vdGU6IHVuc3VwcG9ydGVkIHNjZW5hcmlvOiBpZiBoYW5kbGVycyBhcmUgZHluYW1pY2FsbHkgYWRkZWQgXm9uRm9vPWV4cHJlc3Npb24gdGhpcyB3aWxsIHdvcmssIGJ1dCBkeW5hbWljYWxseSByZW1vdmluZyB3aWxsIG5vdCB3b3JrLlxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiByZXRWYWwodmFsKSB7XG5cdHJldHVybiB2YWw7XG59XG5cbmZ1bmN0aW9uIG5vb3AoKSB7XG5cdHJldHVybiBcIlwiO1xufVxuXG5mdW5jdGlvbiBkYmdCcmVhayh2YWwpIHtcblx0Ly8gVXNhZ2UgZXhhbXBsZXM6IHt7ZGJnOi4uLn19LCB7ezp+ZGJnKC4uLil9fSwge3tkYmcgLi4uL319LCB7Xntmb3IgLi4uIG9uQWZ0ZXJMaW5rPX5kYmd9fSBldGMuXG5cdHRyeSB7XG5cdFx0Y29uc29sZS5sb2coXCJKc1JlbmRlciBkYmcgYnJlYWtwb2ludDogXCIgKyB2YWwpO1xuXHRcdHRocm93IFwiZGJnIGJyZWFrcG9pbnRcIjsgLy8gVG8gYnJlYWsgaGVyZSwgc3RvcCBvbiBjYXVnaHQgZXhjZXB0aW9ucy5cblx0fVxuXHRjYXRjaCAoZSkge31cblx0cmV0dXJuIHRoaXMuYmFzZSA/IHRoaXMuYmFzZUFwcGx5KGFyZ3VtZW50cykgOiB2YWw7XG59XG5cbmZ1bmN0aW9uIEpzVmlld3NFcnJvcihtZXNzYWdlKSB7XG5cdC8vIEVycm9yIGV4Y2VwdGlvbiB0eXBlIGZvciBKc1ZpZXdzL0pzUmVuZGVyXG5cdC8vIE92ZXJyaWRlIG9mICQudmlld3Muc3ViLkVycm9yIGlzIHBvc3NpYmxlXG5cdHRoaXMubmFtZSA9ICgkLmxpbmsgPyBcIkpzVmlld3NcIiA6IFwiSnNSZW5kZXJcIikgKyBcIiBFcnJvclwiO1xuXHR0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlIHx8IHRoaXMubmFtZTtcbn1cblxuZnVuY3Rpb24gJGV4dGVuZCh0YXJnZXQsIHNvdXJjZSkge1xuXHRpZiAodGFyZ2V0KSB7XG5cdFx0Zm9yICh2YXIgbmFtZSBpbiBzb3VyY2UpIHtcblx0XHRcdHRhcmdldFtuYW1lXSA9IHNvdXJjZVtuYW1lXTtcblx0XHR9XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fVxufVxuXG4oSnNWaWV3c0Vycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpKS5jb25zdHJ1Y3RvciA9IEpzVmlld3NFcnJvcjtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBUb3AtbGV2ZWwgZnVuY3Rpb25zID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vPT09PT09PT09PT09PT09PT09PVxuLy8gdmlld3MuZGVsaW1pdGVyc1xuLy89PT09PT09PT09PT09PT09PT09XG5cblx0LyoqXG5cdCogU2V0IHRoZSB0YWcgb3BlbmluZyBhbmQgY2xvc2luZyBkZWxpbWl0ZXJzIGFuZCAnbGluaycgY2hhcmFjdGVyLiBEZWZhdWx0IGlzIFwie3tcIiwgXCJ9fVwiIGFuZCBcIl5cIlxuXHQqIG9wZW5DaGFycywgY2xvc2VDaGFyczogb3BlbmluZyBhbmQgY2xvc2luZyBzdHJpbmdzLCBlYWNoIHdpdGggdHdvIGNoYXJhY3RlcnNcblx0KiAkLnZpZXdzLnNldHRpbmdzLmRlbGltaXRlcnMoLi4uKVxuXHQqXG5cdCogQHBhcmFtIHtzdHJpbmd9ICAgb3BlbkNoYXJzXG5cdCogQHBhcmFtIHtzdHJpbmd9ICAgW2Nsb3NlQ2hhcnNdXG5cdCogQHBhcmFtIHtzdHJpbmd9ICAgW2xpbmtdXG5cdCogQHJldHVybnMge1NldHRpbmdzfVxuXHQqXG5cdCogR2V0IGRlbGltaXRlcnNcblx0KiBkZWxpbXNBcnJheSA9ICQudmlld3Muc2V0dGluZ3MuZGVsaW1pdGVycygpXG5cdCpcblx0KiBAcmV0dXJucyB7c3RyaW5nW119XG5cdCovXG5mdW5jdGlvbiAkdmlld3NEZWxpbWl0ZXJzKG9wZW5DaGFycywgY2xvc2VDaGFycywgbGluaykge1xuXHRpZiAoIW9wZW5DaGFycykge1xuXHRcdHJldHVybiAkc3ViU2V0dGluZ3MuZGVsaW1pdGVycztcblx0fVxuXHRpZiAoJGlzQXJyYXkob3BlbkNoYXJzKSkge1xuXHRcdHJldHVybiAkdmlld3NEZWxpbWl0ZXJzLmFwcGx5KCR2aWV3cywgb3BlbkNoYXJzKTtcblx0fVxuXHRsaW5rQ2hhciA9IGxpbmsgPyBsaW5rWzBdIDogbGlua0NoYXI7XG5cdGlmICghL14oXFxXfF8pezV9JC8udGVzdChvcGVuQ2hhcnMgKyBjbG9zZUNoYXJzICsgbGlua0NoYXIpKSB7XG5cdFx0ZXJyb3IoXCJJbnZhbGlkIGRlbGltaXRlcnNcIik7IC8vIE11c3QgYmUgbm9uLXdvcmQgY2hhcmFjdGVycywgYW5kIG9wZW5DaGFycyBhbmQgY2xvc2VDaGFycyBtdXN0IGVhY2ggYmUgbGVuZ3RoIDJcblx0fVxuXHRkZWxpbU9wZW5DaGFyMCA9IG9wZW5DaGFyc1swXTtcblx0ZGVsaW1PcGVuQ2hhcjEgPSBvcGVuQ2hhcnNbMV07XG5cdGRlbGltQ2xvc2VDaGFyMCA9IGNsb3NlQ2hhcnNbMF07XG5cdGRlbGltQ2xvc2VDaGFyMSA9IGNsb3NlQ2hhcnNbMV07XG5cblx0JHN1YlNldHRpbmdzLmRlbGltaXRlcnMgPSBbZGVsaW1PcGVuQ2hhcjAgKyBkZWxpbU9wZW5DaGFyMSwgZGVsaW1DbG9zZUNoYXIwICsgZGVsaW1DbG9zZUNoYXIxLCBsaW5rQ2hhcl07XG5cblx0Ly8gRXNjYXBlIHRoZSBjaGFyYWN0ZXJzIC0gc2luY2UgdGhleSBjb3VsZCBiZSByZWdleCBzcGVjaWFsIGNoYXJhY3RlcnNcblx0b3BlbkNoYXJzID0gXCJcXFxcXCIgKyBkZWxpbU9wZW5DaGFyMCArIFwiKFxcXFxcIiArIGxpbmtDaGFyICsgXCIpP1xcXFxcIiArIGRlbGltT3BlbkNoYXIxOyAvLyBEZWZhdWx0IGlzIFwie157XCJcblx0Y2xvc2VDaGFycyA9IFwiXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIwICsgXCJcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjE7ICAgICAgICAgICAgICAgICAgIC8vIERlZmF1bHQgaXMgXCJ9fVwiXG5cdC8vIEJ1aWxkIHJlZ2V4IHdpdGggbmV3IGRlbGltaXRlcnNcblx0Ly8gICAgICAgICAgW3RhZyAgICAoZm9sbG93ZWQgYnkgLyBzcGFjZSBvciB9KSAgb3IgY3Z0citjb2xvbiBvciBodG1sIG9yIGNvZGVdIGZvbGxvd2VkIGJ5IHNwYWNlK3BhcmFtcyB0aGVuIGNvbnZlcnRCYWNrP1xuXHRyVGFnID0gXCIoPzooXFxcXHcrKD89W1xcXFwvXFxcXHNcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIl0pKXwoXFxcXHcrKT8oOil8KD4pfChcXFxcKikpXFxcXHMqKCg/OlteXFxcXFwiXG5cdFx0KyBkZWxpbUNsb3NlQ2hhcjAgKyBcIl18XFxcXFwiICsgZGVsaW1DbG9zZUNoYXIwICsgXCIoPyFcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjEgKyBcIikpKj8pXCI7XG5cblx0Ly8gTWFrZSByVGFnIGF2YWlsYWJsZSB0byBKc1ZpZXdzIChvciBvdGhlciBjb21wb25lbnRzKSBmb3IgcGFyc2luZyBiaW5kaW5nIGV4cHJlc3Npb25zXG5cdCRzdWIuclRhZyA9IFwiKD86XCIgKyByVGFnICsgXCIpXCI7XG5cdC8vICAgICAgICAgICAgICAgICAgICAgICAgeyBePyB7ICAgdGFnK3BhcmFtcyBzbGFzaD8gIG9yIGNsb3NpbmdUYWcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvciBjb21tZW50XG5cdHJUYWcgPSBuZXcgUmVnRXhwKFwiKD86XCIgKyBvcGVuQ2hhcnMgKyByVGFnICsgXCIoXFxcXC8pP3xcXFxcXCIgKyBkZWxpbU9wZW5DaGFyMCArIFwiKFxcXFxcIiArIGxpbmtDaGFyICsgXCIpP1xcXFxcIiArIGRlbGltT3BlbkNoYXIxICsgXCIoPzooPzpcXFxcLyhcXFxcdyspKVxcXFxzKnwhLS1bXFxcXHNcXFxcU10qPy0tKSlcIiArIGNsb3NlQ2hhcnMsIFwiZ1wiKTtcblxuXHQvLyBEZWZhdWx0OiAgYmluZCAgICAgdGFnTmFtZSAgICAgICAgIGN2dCAgIGNsbiBodG1sIGNvZGUgICAgcGFyYW1zICAgICAgICAgICAgc2xhc2ggICBiaW5kMiAgICAgICAgIGNsb3NlQmxrICBjb21tZW50XG5cdC8vICAgICAgLyg/OnsoXFxeKT97KD86KFxcdysoPz1bXFwvXFxzfV0pKXwoXFx3Kyk/KDopfCg+KXwoXFwqKSlcXHMqKCg/OltefV18fSg/IX0pKSo/KShcXC8pP3x7KFxcXik/eyg/Oig/OlxcLyhcXHcrKSlcXHMqfCEtLVtcXHNcXFNdKj8tLSkpfX1cblxuXHQkc3ViLnJUbXBsID0gbmV3IFJlZ0V4cChcIl5cXFxcc3xcXFxccyR8PC4qPnwoW15cXFxcXFxcXF18Xilbe31dfFwiICsgb3BlbkNoYXJzICsgXCIuKlwiICsgY2xvc2VDaGFycyk7XG5cdC8vICRzdWIuclRtcGwgbG9va3MgZm9yIGluaXRpYWwgb3IgZmluYWwgd2hpdGUgc3BhY2UsIGh0bWwgdGFncyBvciB7IG9yIH0gY2hhciBub3QgcHJlY2VkZWQgYnkgXFxcXCwgb3IgSnNSZW5kZXIgdGFncyB7e3h4eH19LlxuXHQvLyBFYWNoIG9mIHRoZXNlIHN0cmluZ3MgYXJlIGNvbnNpZGVyZWQgTk9UIHRvIGJlIGpRdWVyeSBzZWxlY3RvcnNcblx0cmV0dXJuICR2aWV3c1NldHRpbmdzO1xufVxuXG4vLz09PT09PT09PVxuLy8gVmlldy5nZXRcbi8vPT09PT09PT09XG5cbmZ1bmN0aW9uIGdldFZpZXcoaW5uZXIsIHR5cGUpIHsgLy92aWV3LmdldChpbm5lciwgdHlwZSlcblx0aWYgKCF0eXBlICYmIGlubmVyICE9PSB0cnVlKSB7XG5cdFx0Ly8gdmlldy5nZXQodHlwZSlcblx0XHR0eXBlID0gaW5uZXI7XG5cdFx0aW5uZXIgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHR2YXIgdmlld3MsIGksIGwsIGZvdW5kLFxuXHRcdHZpZXcgPSB0aGlzLFxuXHRcdHJvb3QgPSB0eXBlID09PSBcInJvb3RcIjtcblx0XHQvLyB2aWV3LmdldChcInJvb3RcIikgcmV0dXJucyB2aWV3LnJvb3QsIHZpZXcuZ2V0KCkgcmV0dXJucyB2aWV3LnBhcmVudCwgdmlldy5nZXQodHJ1ZSkgcmV0dXJucyB2aWV3LnZpZXdzWzBdLlxuXG5cdGlmIChpbm5lcikge1xuXHRcdC8vIEdvIHRocm91Z2ggdmlld3MgLSB0aGlzIG9uZSwgYW5kIGFsbCBuZXN0ZWQgb25lcywgZGVwdGgtZmlyc3QgLSBhbmQgcmV0dXJuIGZpcnN0IG9uZSB3aXRoIGdpdmVuIHR5cGUuXG5cdFx0Ly8gSWYgdHlwZSBpcyB1bmRlZmluZWQsIGkuZS4gdmlldy5nZXQodHJ1ZSksIHJldHVybiBmaXJzdCBjaGlsZCB2aWV3LlxuXHRcdGZvdW5kID0gdHlwZSAmJiB2aWV3LnR5cGUgPT09IHR5cGUgJiYgdmlldztcblx0XHRpZiAoIWZvdW5kKSB7XG5cdFx0XHR2aWV3cyA9IHZpZXcudmlld3M7XG5cdFx0XHRpZiAodmlldy5fLnVzZUtleSkge1xuXHRcdFx0XHRmb3IgKGkgaW4gdmlld3MpIHtcblx0XHRcdFx0XHRpZiAoZm91bmQgPSB0eXBlID8gdmlld3NbaV0uZ2V0KGlubmVyLCB0eXBlKSA6IHZpZXdzW2ldKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoaSA9IDAsIGwgPSB2aWV3cy5sZW5ndGg7ICFmb3VuZCAmJiBpIDwgbDsgaSsrKSB7XG5cdFx0XHRcdFx0Zm91bmQgPSB0eXBlID8gdmlld3NbaV0uZ2V0KGlubmVyLCB0eXBlKSA6IHZpZXdzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHJvb3QpIHtcblx0XHQvLyBGaW5kIHJvb3Qgdmlldy4gKHZpZXcgd2hvc2UgcGFyZW50IGlzIHRvcCB2aWV3KVxuXHRcdGZvdW5kID0gdmlldy5yb290O1xuXHR9IGVsc2UgaWYgKHR5cGUpIHtcblx0XHR3aGlsZSAodmlldyAmJiAhZm91bmQpIHtcblx0XHRcdC8vIEdvIHRocm91Z2ggdmlld3MgLSB0aGlzIG9uZSwgYW5kIGFsbCBwYXJlbnQgb25lcyAtIGFuZCByZXR1cm4gZmlyc3Qgb25lIHdpdGggZ2l2ZW4gdHlwZS5cblx0XHRcdGZvdW5kID0gdmlldy50eXBlID09PSB0eXBlID8gdmlldyA6IHVuZGVmaW5lZDtcblx0XHRcdHZpZXcgPSB2aWV3LnBhcmVudDtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm91bmQgPSB2aWV3LnBhcmVudDtcblx0fVxuXHRyZXR1cm4gZm91bmQgfHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXROZXN0ZWRJbmRleCgpIHtcblx0dmFyIHZpZXcgPSB0aGlzLmdldChcIml0ZW1cIik7XG5cdHJldHVybiB2aWV3ID8gdmlldy5pbmRleCA6IHVuZGVmaW5lZDtcbn1cblxuZ2V0TmVzdGVkSW5kZXguZGVwZW5kcyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gW3RoaXMuZ2V0KFwiaXRlbVwiKSwgXCJpbmRleFwiXTtcbn07XG5cbmZ1bmN0aW9uIGdldEluZGV4KCkge1xuXHRyZXR1cm4gdGhpcy5pbmRleDtcbn1cblxuZ2V0SW5kZXguZGVwZW5kcyA9IFwiaW5kZXhcIjtcblxuLy89PT09PT09PT09PT09PT09PT1cbi8vIFZpZXcuY3R4UHJtLCBldGMuXG4vLz09PT09PT09PT09PT09PT09PVxuXG4vKiBJbnRlcm5hbCBwcml2YXRlOiB2aWV3Ll9nZXRPYigpICovXG5mdW5jdGlvbiBnZXRQYXRoT2JqZWN0KG9iLCBwYXRoLCBsdE9iLCBmbikge1xuXHQvLyBJdGVyYXRlIHRocm91Z2ggcGF0aCB0byBsYXRlIHBhdGhzOiBAYS5iLmMgcGF0aHNcblx0Ly8gUmV0dXJuIFwiXCIgKG9yIG5vb3AgaWYgbGVhZiBpcyBhIGZ1bmN0aW9uIEBhLmIuYyguLi4pICkgaWYgaW50ZXJtZWRpYXRlIG9iamVjdCBub3QgeWV0IGF2YWlsYWJsZVxuXHR2YXIgcHJldk9iLCB0b2tlbnMsIGwsXG5cdFx0aSA9IDA7XG5cdGlmIChsdE9iID09PSAxKSB7XG5cdFx0Zm4gPSAxO1xuXHRcdGx0T2IgPSB1bmRlZmluZWQ7XG5cdH1cblx0Ly8gUGF0aHMgbGlrZSBeYV5iXmMgb3Igfl5hXmJeYyB3aWxsIG5vdCB0aHJvdyBpZiBhbiBvYmplY3QgaW4gcGF0aCBpcyB1bmRlZmluZWQuXG5cdGlmIChwYXRoKSB7XG5cdFx0dG9rZW5zID0gcGF0aC5zcGxpdChcIi5cIik7XG5cdFx0bCA9IHRva2Vucy5sZW5ndGg7XG5cblx0XHRmb3IgKDsgb2IgJiYgaSA8IGw7IGkrKykge1xuXHRcdFx0cHJldk9iID0gb2I7XG5cdFx0XHRvYiA9IHRva2Vuc1tpXSA/IG9iW3Rva2Vuc1tpXV0gOiBvYjtcblx0XHR9XG5cdH1cblx0aWYgKGx0T2IpIHtcblx0XHRsdE9iLmx0ID0gbHRPYi5sdCB8fCBpPGw7IC8vIElmIGkgPCBsIHRoZXJlIHdhcyBhbiBvYmplY3QgaW4gdGhlIHBhdGggbm90IHlldCBhdmFpbGFibGVcblx0fVxuXHRyZXR1cm4gb2IgPT09IHVuZGVmaW5lZFxuXHRcdD8gZm4gPyBub29wIDogXCJcIlxuXHRcdDogZm4gPyBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBvYi5hcHBseShwcmV2T2IsIGFyZ3VtZW50cyk7XG5cdFx0fSA6IG9iO1xufVxuXG5mdW5jdGlvbiBjb250ZXh0UGFyYW1ldGVyKGtleSwgdmFsdWUsIGdldCkge1xuXHQvLyBIZWxwZXIgbWV0aG9kIGNhbGxlZCBhcyB2aWV3LmN0eFBybShrZXkpIGZvciBoZWxwZXJzIG9yIHRlbXBsYXRlIHBhcmFtZXRlcnMgfmZvbyAtIGZyb20gY29tcGlsZWQgdGVtcGxhdGUgb3IgZnJvbSBjb250ZXh0IGNhbGxiYWNrXG5cdHZhciB3cmFwcGVkLCBkZXBzLCByZXMsIG9ic0N0eFBybSwgdGFnRWxzZSwgY2FsbFZpZXcsIG5ld1Jlcyxcblx0XHRzdG9yZVZpZXcgPSB0aGlzLFxuXHRcdGlzVXBkYXRlID0gIWlzUmVuZGVyQ2FsbCAmJiBhcmd1bWVudHMubGVuZ3RoID4gMSxcblx0XHRzdG9yZSA9IHN0b3JlVmlldy5jdHg7XG5cdGlmIChrZXkpIHtcblx0XHRpZiAoIXN0b3JlVmlldy5fKSB7IC8vIHRhZ0N0eC5jdHhQcm0oKSBjYWxsXG5cdFx0XHR0YWdFbHNlID0gc3RvcmVWaWV3LmluZGV4O1xuXHRcdFx0c3RvcmVWaWV3ID0gc3RvcmVWaWV3LnRhZztcblx0XHR9XG5cdFx0Y2FsbFZpZXcgPSBzdG9yZVZpZXc7XG5cdFx0aWYgKHN0b3JlICYmIHN0b3JlLmhhc093blByb3BlcnR5KGtleSkgfHwgKHN0b3JlID0gJGhlbHBlcnMpLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdHJlcyA9IHN0b3JlW2tleV07XG5cdFx0XHRpZiAoa2V5ID09PSBcInRhZ1wiIHx8IGtleSA9PT0gXCJ0YWdDdHhcIiB8fCBrZXkgPT09IFwicm9vdFwiIHx8IGtleSA9PT0gXCJwYXJlbnRUYWdzXCIpIHtcblx0XHRcdFx0cmV0dXJuIHJlcztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0c3RvcmUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghaXNSZW5kZXJDYWxsICYmIHN0b3JlVmlldy50YWdDdHggfHwgc3RvcmVWaWV3LmxpbmtlZCkgeyAvLyBEYXRhLWxpbmtlZCB2aWV3LCBvciB0YWcgaW5zdGFuY2Vcblx0XHRcdGlmICghcmVzIHx8ICFyZXMuX2N4cCkge1xuXHRcdFx0XHQvLyBOb3QgYSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXHRcdFx0XHQvLyBTZXQgc3RvcmVWaWV3IHRvIHRhZyAoaWYgdGhpcyBpcyBhIHRhZy5jdHhQcm0oKSBjYWxsKSBvciB0byByb290IHZpZXcgKFwiZGF0YVwiIHZpZXcgb2YgbGlua2VkIHRlbXBsYXRlKVxuXHRcdFx0XHRzdG9yZVZpZXcgPSBzdG9yZVZpZXcudGFnQ3R4IHx8ICRpc0Z1bmN0aW9uKHJlcylcblx0XHRcdFx0XHQ/IHN0b3JlVmlldyAvLyBJcyBhIHRhZywgbm90IGEgdmlldywgb3IgaXMgYSBjb21wdXRlZCBjb250ZXh0dWFsIHBhcmFtZXRlciwgc28gc2NvcGUgdG8gdGhlIGNhbGxWaWV3LCBubyB0aGUgJ3Njb3BlIHZpZXcnXG5cdFx0XHRcdFx0OiAoc3RvcmVWaWV3ID0gc3RvcmVWaWV3LnNjb3BlIHx8IHN0b3JlVmlldyxcblx0XHRcdFx0XHRcdCFzdG9yZVZpZXcuaXNUb3AgJiYgc3RvcmVWaWV3LmN0eC50YWcgLy8gSWYgdGhpcyB2aWV3IGlzIGluIGEgdGFnLCBzZXQgc3RvcmVWaWV3IHRvIHRoZSB0YWdcblx0XHRcdFx0XHRcdFx0fHwgc3RvcmVWaWV3KTtcblx0XHRcdFx0aWYgKHJlcyAhPT0gdW5kZWZpbmVkICYmIHN0b3JlVmlldy50YWdDdHgpIHtcblx0XHRcdFx0XHQvLyBJZiBzdG9yZVZpZXcgaXMgYSB0YWcsIGJ1dCB0aGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgaGFzIGJlZW4gc2V0IGF0IGF0IGhpZ2hlciBsZXZlbCAoZS5nLiBoZWxwZXJzKS4uLlxuXHRcdFx0XHRcdHN0b3JlVmlldyA9IHN0b3JlVmlldy50YWdDdHgudmlldy5zY29wZTsgLy8gIHRoZW4gbW92ZSBzdG9yZVZpZXcgdG8gdGhlIG91dGVyIGxldmVsIChzY29wZSBvZiB0YWcgY29udGFpbmVyIHZpZXcpXG5cdFx0XHRcdH1cblx0XHRcdFx0c3RvcmUgPSBzdG9yZVZpZXcuX29jcHM7XG5cdFx0XHRcdHJlcyA9IHN0b3JlICYmIHN0b3JlLmhhc093blByb3BlcnR5KGtleSkgJiYgc3RvcmVba2V5XSB8fCByZXM7XG5cdFx0XHRcdGlmICghKHJlcyAmJiByZXMuX2N4cCkgJiYgKGdldCB8fCBpc1VwZGF0ZSkpIHtcblx0XHRcdFx0XHQvLyBDcmVhdGUgb2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXHRcdFx0XHRcdChzdG9yZSB8fCAoc3RvcmVWaWV3Ll9vY3BzID0gc3RvcmVWaWV3Ll9vY3BzIHx8IHt9KSlba2V5XVxuXHRcdFx0XHRcdFx0PSByZXNcblx0XHRcdFx0XHRcdD0gW3tcblx0XHRcdFx0XHRcdFx0X29jcDogcmVzLCAvLyBUaGUgb2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlciB2YWx1ZVxuXHRcdFx0XHRcdFx0XHRfdnc6IGNhbGxWaWV3LFxuXHRcdFx0XHRcdFx0XHRfa2V5OiBrZXlcblx0XHRcdFx0XHRcdH1dO1xuXHRcdFx0XHRcdHJlcy5fY3hwID0ge1xuXHRcdFx0XHRcdFx0cGF0aDogX29jcCxcblx0XHRcdFx0XHRcdGluZDogMCxcblx0XHRcdFx0XHRcdHVwZGF0ZVZhbHVlOiBmdW5jdGlvbih2YWwsIHBhdGgpIHtcblx0XHRcdFx0XHRcdFx0JC5vYnNlcnZhYmxlKHJlc1swXSkuc2V0UHJvcGVydHkoX29jcCwgdmFsKTsgLy8gU2V0IHRoZSB2YWx1ZSAocmVzWzBdLl9vY3ApXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChvYnNDdHhQcm0gPSByZXMgJiYgcmVzLl9jeHApIHtcblx0XHRcdFx0Ly8gSWYgdGhpcyBoZWxwZXIgcmVzb3VyY2UgaXMgYW4gb2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXHRcdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDIpIHtcblx0XHRcdFx0XHRkZXBzID0gcmVzWzFdID8gJHN1Yi5fY2VvKHJlc1sxXS5kZXBzKSA6IFtfb2NwXTsgLy8gZm4gZGVwcyAod2l0aCBhbnkgZXhwck9icyBjbG9uZWQgdXNpbmcgJHN1Yi5fY2VvKVxuXHRcdFx0XHRcdGRlcHMudW5zaGlmdChyZXNbMF0pOyAvLyB2aWV3XG5cdFx0XHRcdFx0ZGVwcy5fY3hwID0gb2JzQ3R4UHJtO1xuXHRcdFx0XHRcdC8vIEluIGEgY29udGV4dCBjYWxsYmFjayBmb3IgYSBjb250ZXh0dWFsIHBhcmFtLCB3ZSBzZXQgZ2V0ID0gdHJ1ZSwgdG8gZ2V0IGN0eFBybSAgW3ZpZXcsIGRlcGVuZGVuY2llcy4uLl0gYXJyYXkgLSBuZWVkZWQgZm9yIG9ic2VydmUgY2FsbFxuXHRcdFx0XHRcdHJldHVybiBkZXBzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRhZ0Vsc2UgPSBvYnNDdHhQcm0udGFnRWxzZTtcblx0XHRcdFx0bmV3UmVzID0gcmVzWzFdIC8vIGxpbmtGbiBmb3IgY29tcGlsZWQgZXhwcmVzc2lvblxuXHRcdFx0XHRcdD8gb2JzQ3R4UHJtLnRhZyAmJiBvYnNDdHhQcm0udGFnLmN2dEFyZ3Ncblx0XHRcdFx0XHRcdD8gb2JzQ3R4UHJtLnRhZy5jdnRBcmdzKHRhZ0Vsc2UsIDEpW29ic0N0eFBybS5pbmRdIC8vID0gdGFnLmJuZEFyZ3MoKSAtIGZvciB0YWcgY29udGV4dHVhbCBwYXJhbWV0ZXJcblx0XHRcdFx0XHRcdDogcmVzWzFdKHJlc1swXS5kYXRhLCByZXNbMF0sICRzdWIpICAgIC8vID0gZm4oZGF0YSwgdmlldywgJHN1YikgZm9yIGNvbXBpbGVkIGJpbmRpbmcgZXhwcmVzc2lvblxuXHRcdFx0XHRcdDogcmVzWzBdLl9vY3A7IC8vIE9ic2VydmFibGUgY29udGV4dHVhbCBwYXJhbWV0ZXIgKHVuaW5pdGlhbGl6ZWQsIG9yIGluaXRpYWxpemVkIGFzIHN0YXRpYyBleHByZXNzaW9uLCBzbyBubyBwYXRoIGRlcGVuZGVuY2llcylcblx0XHRcdFx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0XHRcdFx0aWYgKHJlcyAmJiBuZXdSZXMgIT09IHZhbHVlKSB7XG5cdFx0XHRcdFx0XHQkc3ViLl91Y3Aoa2V5LCB2YWx1ZSwgc3RvcmVWaWV3LCBvYnNDdHhQcm0pOyAvLyBVcGRhdGUgb2JzZXJ2YWJsZSBjb250ZXh0dWFsIHBhcmFtZXRlclxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gc3RvcmVWaWV3O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlcyA9IG5ld1Jlcztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHJlcyAmJiAkaXNGdW5jdGlvbihyZXMpKSB7XG5cdFx0XHQvLyBJZiBhIGhlbHBlciBpcyBvZiB0eXBlIGZ1bmN0aW9uIHdlIHdpbGwgd3JhcCBpdCwgc28gaWYgY2FsbGVkIHdpdGggbm8gdGhpcyBwb2ludGVyIGl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlXG5cdFx0XHQvLyB2aWV3IGFzICd0aGlzJyBjb250ZXh0LiBJZiB0aGUgaGVscGVyIH5mb28oKSB3YXMgaW4gYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiwgdGhlIHZpZXcgd2lsbCBoYXZlIGEgJ3RlbXBvcmFyeScgbGlua0N0eCBwcm9wZXJ0eSB0b28uXG5cdFx0XHQvLyBOb3RlIHRoYXQgaGVscGVyIGZ1bmN0aW9ucyBvbiBkZWVwZXIgcGF0aHMgd2lsbCBoYXZlIHNwZWNpZmljIHRoaXMgcG9pbnRlcnMsIGZyb20gdGhlIHByZWNlZGluZyBwYXRoLlxuXHRcdFx0Ly8gRm9yIGV4YW1wbGUsIH51dGlsLmZvbygpIHdpbGwgaGF2ZSB0aGUgfnV0aWwgb2JqZWN0IGFzICd0aGlzJyBwb2ludGVyXG5cdFx0XHR3cmFwcGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiByZXMuYXBwbHkoKCF0aGlzIHx8IHRoaXMgPT09IGdsb2JhbCkgPyBjYWxsVmlldyA6IHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHR9O1xuXHRcdFx0JGV4dGVuZCh3cmFwcGVkLCByZXMpOyAvLyBBdHRhY2ggc2FtZSBleHBhbmRvcyAoaWYgYW55KSB0byB0aGUgd3JhcHBlZCBmdW5jdGlvblxuXHRcdH1cblx0XHRyZXR1cm4gd3JhcHBlZCB8fCByZXM7XG5cdH1cbn1cblxuLyogSW50ZXJuYWwgcHJpdmF0ZTogdmlldy5fZ2V0VG1wbCgpICovXG5mdW5jdGlvbiBnZXRUZW1wbGF0ZSh0bXBsKSB7XG5cdHJldHVybiB0bXBsICYmICh0bXBsLmZuXG5cdFx0PyB0bXBsXG5cdFx0OiB0aGlzLmdldFJzYyhcInRlbXBsYXRlc1wiLCB0bXBsKSB8fCAkdGVtcGxhdGVzKHRtcGwpKTsgLy8gbm90IHlldCBjb21waWxlZFxufVxuXG4vLz09PT09PT09PT09PT09XG4vLyB2aWV3cy5fY252dFxuLy89PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb252ZXJ0VmFsKGNvbnZlcnRlciwgdmlldywgdGFnQ3R4LCBvbkVycm9yKSB7XG5cdC8vIENhbGxlZCBmcm9tIGNvbXBpbGVkIHRlbXBsYXRlIGNvZGUgZm9yIHt7On19XG5cdC8vIHNlbGYgaXMgdGVtcGxhdGUgb2JqZWN0IG9yIGxpbmtDdHggb2JqZWN0XG5cdHZhciB0YWcsIGxpbmtDdHgsIHZhbHVlLCBhcmdzTGVuLCBiaW5kVG8sXG5cdFx0Ly8gSWYgdGFnQ3R4IGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4XG5cdFx0Ym91bmRUYWcgPSB0eXBlb2YgdGFnQ3R4ID09PSBcIm51bWJlclwiICYmIHZpZXcudG1wbC5ibmRzW3RhZ0N0eC0xXTtcblxuXHRpZiAob25FcnJvciA9PT0gdW5kZWZpbmVkICYmIGJvdW5kVGFnICYmIGJvdW5kVGFnLl9scikgeyAvLyBsYXRlUmVuZGVyXG5cdFx0b25FcnJvciA9IFwiXCI7XG5cdH1cblx0aWYgKG9uRXJyb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdHRhZ0N0eCA9IG9uRXJyb3IgPSB7cHJvcHM6IHt9LCBhcmdzOiBbb25FcnJvcl19O1xuXHR9IGVsc2UgaWYgKGJvdW5kVGFnKSB7XG5cdFx0dGFnQ3R4ID0gYm91bmRUYWcodmlldy5kYXRhLCB2aWV3LCAkc3ViKTtcblx0fVxuXHRib3VuZFRhZyA9IGJvdW5kVGFnLl9iZCAmJiBib3VuZFRhZztcblx0aWYgKGNvbnZlcnRlciB8fCBib3VuZFRhZykge1xuXHRcdGxpbmtDdHggPSB2aWV3Ll9sYzsgLy8gRm9yIGRhdGEtbGluaz1cIntjdnQ6Li4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcblx0XHR0YWcgPSBsaW5rQ3R4ICYmIGxpbmtDdHgudGFnO1xuXHRcdHRhZ0N0eC52aWV3ID0gdmlldztcblx0XHRpZiAoIXRhZykge1xuXHRcdFx0dGFnID0gJGV4dGVuZChuZXcgJHN1Yi5fdGcoKSwge1xuXHRcdFx0XHRfOiB7XG5cdFx0XHRcdFx0Ym5kOiBib3VuZFRhZyxcblx0XHRcdFx0XHR1bmxpbmtlZDogdHJ1ZSxcblx0XHRcdFx0XHRsdDogdGFnQ3R4Lmx0IC8vIElmIGEgbGF0ZSBwYXRoIEBzb21lLnBhdGggaGFzIG5vdCByZXR1cm5lZCBAc29tZSBvYmplY3QsIG1hcmsgdGFnIGFzIGxhdGVcblx0XHRcdFx0fSxcblx0XHRcdFx0aW5saW5lOiAhbGlua0N0eCxcblx0XHRcdFx0dGFnTmFtZTogXCI6XCIsXG5cdFx0XHRcdGNvbnZlcnQ6IGNvbnZlcnRlcixcblx0XHRcdFx0b25BcnJheUNoYW5nZTogdHJ1ZSxcblx0XHRcdFx0ZmxvdzogdHJ1ZSxcblx0XHRcdFx0dGFnQ3R4OiB0YWdDdHgsXG5cdFx0XHRcdHRhZ0N0eHM6IFt0YWdDdHhdLFxuXHRcdFx0XHRfaXM6IFwidGFnXCJcblx0XHRcdH0pO1xuXHRcdFx0YXJnc0xlbiA9IHRhZ0N0eC5hcmdzLmxlbmd0aDtcblx0XHRcdGlmIChhcmdzTGVuPjEpIHtcblx0XHRcdFx0YmluZFRvID0gdGFnLmJpbmRUbyA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoYXJnc0xlbi0tKSB7XG5cdFx0XHRcdFx0YmluZFRvLnVuc2hpZnQoYXJnc0xlbik7IC8vIEJpbmQgdG8gYWxsIHRoZSBhcmd1bWVudHMgLSBnZW5lcmF0ZSBiaW5kVG8gYXJyYXk6IFswLDEsMi4uLl1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGxpbmtDdHgpIHtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHRcdHRhZy5saW5rQ3R4ID0gbGlua0N0eDtcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgodGFnQ3R4LmN0eCwgKGxpbmtDdHggPyBsaW5rQ3R4LnZpZXcgOiB2aWV3KS5jdHgpO1xuXHRcdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpO1xuXHRcdH1cblx0XHR0YWcuX2VyID0gb25FcnJvciAmJiB2YWx1ZTtcblx0XHR0YWcuY3R4ID0gdGFnQ3R4LmN0eCB8fCB0YWcuY3R4IHx8IHt9O1xuXHRcdHRhZ0N0eC5jdHggPSB1bmRlZmluZWQ7XG5cdFx0dmFsdWUgPSB0YWcuY3Z0QXJncygpWzBdOyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRCYWNrIGJ1dCBubyBjb252ZXJ0LCBjb252ZXJ0ZXIgd2lsbCBiZSBcInRydWVcIlxuXHRcdHRhZy5fZXIgPSBvbkVycm9yICYmIHZhbHVlO1xuXHR9IGVsc2Uge1xuXHRcdHZhbHVlID0gdGFnQ3R4LmFyZ3NbMF07XG5cdH1cblxuXHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdHZhbHVlID0gYm91bmRUYWcgJiYgdmlldy5fLm9uUmVuZGVyXG5cdFx0PyB2aWV3Ll8ub25SZW5kZXIodmFsdWUsIHZpZXcsIHRhZylcblx0XHQ6IHZhbHVlO1xuXHRyZXR1cm4gdmFsdWUgIT0gdW5kZWZpbmVkID8gdmFsdWUgOiBcIlwiO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXJncyh0YWdFbHNlLCBib3VuZCkgeyAvLyB0YWcuY3Z0QXJncygpIG9yIHRhZy5jdnRBcmdzKHRhZ0Vsc2U/LCB0cnVlPylcblx0dmFyIGwsIGtleSwgYm91bmRBcmdzLCBhcmdzLCBiaW5kRnJvbSwgdGFnLCBjb252ZXJ0ZXIsXG5cdFx0dGFnQ3R4ID0gdGhpcztcblxuXHRpZiAodGFnQ3R4LnRhZ05hbWUpIHtcblx0XHR0YWcgPSB0YWdDdHg7XG5cdFx0dGFnQ3R4ID0gKHRhZy50YWdDdHhzIHx8IFt0YWdDdHhdKVt0YWdFbHNlfHwwXTtcblx0XHRpZiAoIXRhZ0N0eCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR0YWcgPSB0YWdDdHgudGFnO1xuXHR9XG5cblx0YmluZEZyb20gPSB0YWcuYmluZEZyb207XG5cdGFyZ3MgPSB0YWdDdHguYXJncztcblxuXHRpZiAoKGNvbnZlcnRlciA9IHRhZy5jb252ZXJ0KSAmJiBcIlwiICsgY29udmVydGVyID09PSBjb252ZXJ0ZXIpIHtcblx0XHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIgPT09IFwidHJ1ZVwiXG5cdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0OiAodGFnQ3R4LnZpZXcuZ2V0UnNjKFwiY29udmVydGVyc1wiLCBjb252ZXJ0ZXIpIHx8IGVycm9yKFwiVW5rbm93biBjb252ZXJ0ZXI6ICdcIiArIGNvbnZlcnRlciArIFwiJ1wiKSk7XG5cdH1cblxuXHRpZiAoY29udmVydGVyICYmICFib3VuZCkgeyAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRlciwgdXNlIGEgY29weSBvZiB0aGUgdGFnQ3R4LmFyZ3MgYXJyYXkgZm9yIHJlbmRlcmluZywgYW5kIHJlcGxhY2UgdGhlIGFyZ3NbMF0gaW5cblx0XHRhcmdzID0gYXJncy5zbGljZSgpOyAvLyB0aGUgY29waWVkIGFycmF5IHdpdGggdGhlIGNvbnZlcnRlZCB2YWx1ZS4gQnV0IHdlIGRvIG5vdCBtb2RpZnkgdGhlIHZhbHVlIG9mIHRhZy50YWdDdHguYXJnc1swXSAodGhlIG9yaWdpbmFsIGFyZ3MgYXJyYXkpXG5cdH1cblx0aWYgKGJpbmRGcm9tKSB7IC8vIEdldCB0aGUgdmFsdWVzIG9mIHRoZSBib3VuZEFyZ3Ncblx0XHRib3VuZEFyZ3MgPSBbXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0Ym91bmRBcmdzLnVuc2hpZnQoYXJnT3JQcm9wKHRhZ0N0eCwga2V5KSk7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkge1xuXHRcdFx0YXJncyA9IGJvdW5kQXJnczsgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSByZXR1cm5zIHRoZSBib3VuZEFyZ3Ncblx0XHR9XG5cdH1cblx0aWYgKGNvbnZlcnRlcikge1xuXHRcdGNvbnZlcnRlciA9IGNvbnZlcnRlci5hcHBseSh0YWcsIGJvdW5kQXJncyB8fCBhcmdzKTtcblx0XHRpZiAoY29udmVydGVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBhcmdzOyAvLyBSZXR1cm5pbmcgdW5kZWZpbmVkIGZyb20gYSBjb252ZXJ0ZXIgaXMgZXF1aXZhbGVudCB0byBub3QgaGF2aW5nIGEgY29udmVydGVyLlxuXHRcdH1cblx0XHRiaW5kRnJvbSA9IGJpbmRGcm9tIHx8IFswXTtcblx0XHRsID0gYmluZEZyb20ubGVuZ3RoO1xuXHRcdGlmICghJGlzQXJyYXkoY29udmVydGVyKSB8fCBjb252ZXJ0ZXIubGVuZ3RoICE9PSBsKSB7XG5cdFx0XHRjb252ZXJ0ZXIgPSBbY29udmVydGVyXTtcblx0XHRcdGJpbmRGcm9tID0gWzBdO1xuXHRcdFx0bCA9IDE7XG5cdFx0fVxuXHRcdGlmIChib3VuZCkgeyAgICAgICAgLy8gQ2FsbCB0byBibmRBcmdzKCkgLSBzbyBhcHBseSBjb252ZXJ0ZXIgdG8gYWxsIGJvdW5kQXJnc1xuXHRcdFx0YXJncyA9IGNvbnZlcnRlcjsgLy8gVGhlIGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBmcm9tIHRoZSBjb252ZXJ0ZXJcblx0XHR9IGVsc2UgeyAgICAgICAgICAgIC8vIENhbGwgdG8gY3Z0QXJncygpXG5cdFx0XHR3aGlsZSAobC0tKSB7XG5cdFx0XHRcdGtleSA9IGJpbmRGcm9tW2xdO1xuXHRcdFx0XHRpZiAoK2tleSA9PT0ga2V5KSB7XG5cdFx0XHRcdFx0YXJnc1trZXldID0gY29udmVydGVyW2xdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBhcmdzO1xufVxuXG5mdW5jdGlvbiBhcmdPclByb3AoY29udGV4dCwga2V5KSB7XG5cdGNvbnRleHQgPSBjb250ZXh0WytrZXkgPT09IGtleSA/IFwiYXJnc1wiIDogXCJwcm9wc1wiXTtcblx0cmV0dXJuIGNvbnRleHQgJiYgY29udGV4dFtrZXldO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0Qm91bmRBcmdzKHRhZ0Vsc2UpIHsgLy8gdGFnLmJuZEFyZ3MoKVxuXHRyZXR1cm4gdGhpcy5jdnRBcmdzKHRhZ0Vsc2UsIDEpO1xufVxuXG4vLz09PT09PT09PT09PT1cbi8vIHZpZXdzLnRhZ1xuLy89PT09PT09PT09PT09XG5cbi8qIHZpZXcuZ2V0UnNjKCkgKi9cbmZ1bmN0aW9uIGdldFJlc291cmNlKHJlc291cmNlVHlwZSwgaXRlbU5hbWUpIHtcblx0dmFyIHJlcywgc3RvcmUsXG5cdFx0dmlldyA9IHRoaXM7XG5cdGlmIChcIlwiICsgaXRlbU5hbWUgPT09IGl0ZW1OYW1lKSB7XG5cdFx0d2hpbGUgKChyZXMgPT09IHVuZGVmaW5lZCkgJiYgdmlldykge1xuXHRcdFx0c3RvcmUgPSB2aWV3LnRtcGwgJiYgdmlldy50bXBsW3Jlc291cmNlVHlwZV07XG5cdFx0XHRyZXMgPSBzdG9yZSAmJiBzdG9yZVtpdGVtTmFtZV07XG5cdFx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXMgfHwgJHZpZXdzW3Jlc291cmNlVHlwZV1baXRlbU5hbWVdO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRhZyh0YWdOYW1lLCBwYXJlbnRWaWV3LCB0bXBsLCB0YWdDdHhzLCBpc1VwZGF0ZSwgb25FcnJvcikge1xuXHRmdW5jdGlvbiBiaW5kVG9PckJpbmRGcm9tKHR5cGUpIHtcblx0XHR2YXIgYmluZEFycmF5ID0gdGFnW3R5cGVdO1xuXG5cdFx0aWYgKGJpbmRBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRiaW5kQXJyYXkgPSAkaXNBcnJheShiaW5kQXJyYXkpID8gYmluZEFycmF5IDogW2JpbmRBcnJheV07XG5cdFx0XHRtID0gYmluZEFycmF5Lmxlbmd0aDtcblx0XHRcdHdoaWxlIChtLS0pIHtcblx0XHRcdFx0a2V5ID0gYmluZEFycmF5W21dO1xuXHRcdFx0XHRpZiAoIWlzTmFOKHBhcnNlSW50KGtleSkpKSB7XG5cdFx0XHRcdFx0YmluZEFycmF5W21dID0gcGFyc2VJbnQoa2V5KTsgLy8gQ29udmVydCBcIjBcIiB0byAwLCAgZXRjLlxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJpbmRBcnJheSB8fCBbMF07XG5cdH1cblxuXHRwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCB0b3BWaWV3O1xuXHR2YXIgdGFnLCB0YWdEZWYsIHRlbXBsYXRlLCB0YWdzLCBhdHRyLCBwYXJlbnRUYWcsIGwsIG0sIG4sIGl0ZW1SZXQsIHRhZ0N0eCwgdGFnQ3R4Q3R4LCBjdHhQcm0sIGJpbmRUbywgYmluZEZyb20sIGluaXRWYWwsXG5cdFx0Y29udGVudCwgY2FsbEluaXQsIG1hcERlZiwgdGhpc01hcCwgYXJncywgYmRBcmdzLCBwcm9wcywgdGFnRGF0YU1hcCwgY29udGVudEN0eCwga2V5LCBiaW5kRnJvbUxlbmd0aCwgYmluZFRvTGVuZ3RoLCBsaW5rZWRFbGVtZW50LCBkZWZhdWx0Q3R4LFxuXHRcdGkgPSAwLFxuXHRcdHJldCA9IFwiXCIsXG5cdFx0bGlua0N0eCA9IHBhcmVudFZpZXcuX2xjIHx8IGZhbHNlLCAvLyBGb3IgZGF0YS1saW5rPVwie215VGFnLi4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcblx0XHRjdHggPSBwYXJlbnRWaWV3LmN0eCxcblx0XHRwYXJlbnRUbXBsID0gdG1wbCB8fCBwYXJlbnRWaWV3LnRtcGwsXG5cdFx0Ly8gSWYgdGFnQ3R4cyBpcyBhbiBpbnRlZ2VyLCB0aGVuIGl0IGlzIHRoZSBrZXkgZm9yIHRoZSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIGJvdW5kVGFnIHRhZ0N0eHNcblx0XHRib3VuZFRhZyA9IHR5cGVvZiB0YWdDdHhzID09PSBcIm51bWJlclwiICYmIHBhcmVudFZpZXcudG1wbC5ibmRzW3RhZ0N0eHMtMV07XG5cblx0aWYgKHRhZ05hbWUuX2lzID09PSBcInRhZ1wiKSB7XG5cdFx0dGFnID0gdGFnTmFtZTtcblx0XHR0YWdOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4cyA9IHRhZy50YWdDdHhzO1xuXHRcdHRlbXBsYXRlID0gdGFnLnRlbXBsYXRlO1xuXHR9IGVsc2Uge1xuXHRcdHRhZ0RlZiA9IHBhcmVudFZpZXcuZ2V0UnNjKFwidGFnc1wiLCB0YWdOYW1lKSB8fCBlcnJvcihcIlVua25vd24gdGFnOiB7e1wiICsgdGFnTmFtZSArIFwifX0gXCIpO1xuXHRcdHRlbXBsYXRlID0gdGFnRGVmLnRlbXBsYXRlO1xuXHR9XG5cdGlmIChvbkVycm9yID09PSB1bmRlZmluZWQgJiYgYm91bmRUYWcgJiYgKGJvdW5kVGFnLl9sciA9ICh0YWdEZWYubGF0ZVJlbmRlciAmJiBib3VuZFRhZy5fbHIhPT0gZmFsc2UgfHwgYm91bmRUYWcuX2xyKSkpIHtcblx0XHRvbkVycm9yID0gXCJcIjsgLy8gSWYgbGF0ZVJlbmRlciwgc2V0IHRlbXBvcmFyeSBvbkVycm9yLCB0byBza2lwIGluaXRpYWwgcmVuZGVyaW5nIChhbmQgcmVuZGVyIGp1c3QgXCJcIilcblx0fVxuXHRpZiAob25FcnJvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0ICs9IG9uRXJyb3I7XG5cdFx0dGFnQ3R4cyA9IG9uRXJyb3IgPSBbe3Byb3BzOiB7fSwgYXJnczogW10sIHBhcmFtczoge3Byb3BzOnt9fX1dO1xuXHR9IGVsc2UgaWYgKGJvdW5kVGFnKSB7XG5cdFx0dGFnQ3R4cyA9IGJvdW5kVGFnKHBhcmVudFZpZXcuZGF0YSwgcGFyZW50VmlldywgJHN1Yik7XG5cdH1cblxuXHRsID0gdGFnQ3R4cy5sZW5ndGg7XG5cdGZvciAoOyBpIDwgbDsgaSsrKSB7XG5cdFx0dGFnQ3R4ID0gdGFnQ3R4c1tpXTtcblx0XHRjb250ZW50ID0gdGFnQ3R4LnRtcGw7XG5cdFx0aWYgKCFsaW5rQ3R4IHx8ICFsaW5rQ3R4LnRhZyB8fCBpICYmICFsaW5rQ3R4LnRhZy5pbmxpbmUgfHwgdGFnLl9lciB8fCBjb250ZW50ICYmICtjb250ZW50PT09Y29udGVudCkge1xuXHRcdFx0Ly8gSW5pdGlhbGl6ZSB0YWdDdHhcblx0XHRcdC8vIEZvciBibG9jayB0YWdzLCB0YWdDdHgudG1wbCBpcyBhbiBpbnRlZ2VyID4gMFxuXHRcdFx0aWYgKGNvbnRlbnQgJiYgcGFyZW50VG1wbC50bXBscykge1xuXHRcdFx0XHR0YWdDdHgudG1wbCA9IHRhZ0N0eC5jb250ZW50ID0gcGFyZW50VG1wbC50bXBsc1tjb250ZW50IC0gMV07IC8vIFNldCB0aGUgdG1wbCBwcm9wZXJ0eSB0byB0aGUgY29udGVudCBvZiB0aGUgYmxvY2sgdGFnXG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguaW5kZXggPSBpO1xuXHRcdFx0dGFnQ3R4LmN0eFBybSA9IGNvbnRleHRQYXJhbWV0ZXI7XG5cdFx0XHR0YWdDdHgucmVuZGVyID0gcmVuZGVyQ29udGVudDtcblx0XHRcdHRhZ0N0eC5jdnRBcmdzID0gY29udmVydEFyZ3M7XG5cdFx0XHR0YWdDdHguYm5kQXJncyA9IGNvbnZlcnRCb3VuZEFyZ3M7XG5cdFx0XHR0YWdDdHgudmlldyA9IHBhcmVudFZpZXc7XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KGV4dGVuZEN0eCh0YWdDdHguY3R4LCB0YWdEZWYgJiYgdGFnRGVmLmN0eCksIGN0eCk7IC8vIENsb25lIGFuZCBleHRlbmQgcGFyZW50Vmlldy5jdHhcblx0XHR9XG5cdFx0aWYgKHRtcGwgPSB0YWdDdHgucHJvcHMudG1wbCkge1xuXHRcdFx0Ly8gSWYgdGhlIHRtcGwgcHJvcGVydHkgaXMgb3ZlcnJpZGRlbiwgc2V0IHRoZSB2YWx1ZSAod2hlbiBpbml0aWFsaXppbmcsIG9yLCBpbiBjYXNlIG9mIGJpbmRpbmc6IF50bXBsPS4uLiwgd2hlbiB1cGRhdGluZylcblx0XHRcdHRhZ0N0eC50bXBsID0gcGFyZW50Vmlldy5fZ2V0VG1wbCh0bXBsKTtcblx0XHRcdHRhZ0N0eC5jb250ZW50ID0gdGFnQ3R4LmNvbnRlbnQgfHwgdGFnQ3R4LnRtcGw7XG5cdFx0fVxuXG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdC8vIFRoaXMgd2lsbCBvbmx5IGJlIGhpdCBmb3IgaW5pdGlhbCB0YWdDdHggKG5vdCBmb3Ige3tlbHNlfX0pIC0gaWYgdGhlIHRhZyBpbnN0YW5jZSBkb2VzIG5vdCBleGlzdCB5ZXRcblx0XHRcdC8vIElmIHRoZSB0YWcgaGFzIG5vdCBhbHJlYWR5IGJlZW4gaW5zdGFudGlhdGVkLCB3ZSB3aWxsIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cblx0XHRcdC8vIH50YWcgd2lsbCBhY2Nlc3MgdGhlIHRhZywgZXZlbiB3aXRoaW4gdGhlIHJlbmRlcmluZyBvZiB0aGUgdGVtcGxhdGUgY29udGVudCBvZiB0aGlzIHRhZy5cblx0XHRcdC8vIEZyb20gY2hpbGQvZGVzY2VuZGFudCB0YWdzLCBjYW4gYWNjZXNzIHVzaW5nIH50YWcucGFyZW50LCBvciB+cGFyZW50VGFncy50YWdOYW1lXG5cdFx0XHR0YWcgPSBuZXcgdGFnRGVmLl9jdHIoKTtcblx0XHRcdGNhbGxJbml0ID0gISF0YWcuaW5pdDtcblxuXHRcdFx0dGFnLnBhcmVudCA9IHBhcmVudFRhZyA9IGN0eCAmJiBjdHgudGFnO1xuXHRcdFx0dGFnLnRhZ0N0eHMgPSB0YWdDdHhzO1xuXG5cdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHR0YWcuaW5saW5lID0gZmFsc2U7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0fVxuXHRcdFx0dGFnLmxpbmtDdHggPSBsaW5rQ3R4O1xuXHRcdFx0aWYgKHRhZy5fLmJuZCA9IGJvdW5kVGFnIHx8IGxpbmtDdHguZm4pIHtcblx0XHRcdFx0Ly8gQm91bmQgaWYge157dGFnLi4ufX0gb3IgZGF0YS1saW5rPVwie3RhZy4uLn1cIlxuXHRcdFx0XHR0YWcuXy50aHMgPSB0YWdDdHgucGFyYW1zLnByb3BzLnRoaXM7IC8vIFRhZyBoYXMgYSB0aGlzPWV4cHIgYmluZGluZywgdG8gZ2V0IGphdmFzY3JpcHQgcmVmZXJlbmNlIHRvIHRhZyBpbnN0YW5jZVxuXHRcdFx0XHR0YWcuXy5sdCA9IHRhZ0N0eHMubHQ7IC8vIElmIGEgbGF0ZSBwYXRoIEBzb21lLnBhdGggaGFzIG5vdCByZXR1cm5lZCBAc29tZSBvYmplY3QsIG1hcmsgdGFnIGFzIGxhdGVcblx0XHRcdFx0dGFnLl8uYXJyVndzID0ge307XG5cdFx0XHR9IGVsc2UgaWYgKHRhZy5kYXRhQm91bmRPbmx5KSB7XG5cdFx0XHRcdGVycm9yKHRhZ05hbWUgKyBcIiBtdXN0IGJlIGRhdGEtYm91bmQ6XFxue157XCIgKyB0YWdOYW1lICsgXCJ9fVwiKTtcblx0XHRcdH1cblx0XHRcdC8vVE9ETyBiZXR0ZXIgcGVyZiBmb3IgY2hpbGRUYWdzKCkgLSBrZWVwIGNoaWxkIHRhZy50YWdzIGFycmF5LCAoYW5kIHJlbW92ZSBjaGlsZCwgd2hlbiBkaXNwb3NlZClcblx0XHRcdC8vIHRhZy50YWdzID0gW107XG5cdFx0fSBlbHNlIGlmIChsaW5rQ3R4ICYmIGxpbmtDdHguZm4uX2xyKSB7XG5cdFx0XHRjYWxsSW5pdCA9ICEhdGFnLmluaXQ7XG5cdFx0fVxuXHRcdHRhZ0RhdGFNYXAgPSB0YWcuZGF0YU1hcDtcblxuXHRcdHRhZ0N0eC50YWcgPSB0YWc7XG5cdFx0aWYgKHRhZ0RhdGFNYXAgJiYgdGFnQ3R4cykge1xuXHRcdFx0dGFnQ3R4Lm1hcCA9IHRhZ0N0eHNbaV0ubWFwOyAvLyBDb3B5IG92ZXIgdGhlIGNvbXBpbGVkIG1hcCBpbnN0YW5jZSBmcm9tIHRoZSBwcmV2aW91cyB0YWdDdHhzIHRvIHRoZSByZWZyZXNoZWQgb25lc1xuXHRcdH1cblx0XHRpZiAoIXRhZy5mbG93KSB7XG5cdFx0XHR0YWdDdHhDdHggPSB0YWdDdHguY3R4ID0gdGFnQ3R4LmN0eCB8fCB7fTtcblxuXHRcdFx0Ly8gdGFncyBoYXNoOiB0YWcuY3R4LnRhZ3MsIG1lcmdlZCB3aXRoIHBhcmVudFZpZXcuY3R4LnRhZ3MsXG5cdFx0XHR0YWdzID0gdGFnLnBhcmVudHMgPSB0YWdDdHhDdHgucGFyZW50VGFncyA9IGN0eCAmJiBleHRlbmRDdHgodGFnQ3R4Q3R4LnBhcmVudFRhZ3MsIGN0eC5wYXJlbnRUYWdzKSB8fCB7fTtcblx0XHRcdGlmIChwYXJlbnRUYWcpIHtcblx0XHRcdFx0dGFnc1twYXJlbnRUYWcudGFnTmFtZV0gPSBwYXJlbnRUYWc7XG5cdFx0XHRcdC8vVE9ETyBiZXR0ZXIgcGVyZiBmb3IgY2hpbGRUYWdzOiBwYXJlbnRUYWcudGFncy5wdXNoKHRhZyk7XG5cdFx0XHR9XG5cdFx0XHR0YWdzW3RhZy50YWdOYW1lXSA9IHRhZ0N0eEN0eC50YWcgPSB0YWc7XG5cdFx0XHR0YWdDdHhDdHgudGFnQ3R4ID0gdGFnQ3R4O1xuXHRcdH1cblx0fVxuXHRpZiAoISh0YWcuX2VyID0gb25FcnJvcikpIHtcblx0XHR0YWdIYW5kbGVyc0Zyb21Qcm9wcyh0YWcsIHRhZ0N0eHNbMF0pO1xuXHRcdHRhZy5yZW5kZXJpbmcgPSB7cm5kcjogdGFnLnJlbmRlcmluZ307IC8vIFByb3ZpZGUgb2JqZWN0IGZvciBzdGF0ZSBkdXJpbmcgcmVuZGVyIGNhbGxzIHRvIHRhZyBhbmQgZWxzZXMuIChVc2VkIGJ5IHt7aWZ9fSBhbmQge3tmb3J9fS4uLilcblx0XHRmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7IC8vIEl0ZXJhdGUgdGFnQ3R4IGZvciBlYWNoIHt7ZWxzZX19IGJsb2NrXG5cdFx0XHR0YWdDdHggPSB0YWcudGFnQ3R4ID0gdGFnQ3R4c1tpXTtcblx0XHRcdHByb3BzID0gdGFnQ3R4LnByb3BzO1xuXHRcdFx0dGFnLmN0eCA9IHRhZ0N0eC5jdHg7XG5cblx0XHRcdGlmICghaSkge1xuXHRcdFx0XHRpZiAoY2FsbEluaXQpIHtcblx0XHRcdFx0XHR0YWcuaW5pdCh0YWdDdHgsIGxpbmtDdHgsIHRhZy5jdHgpO1xuXHRcdFx0XHRcdGNhbGxJbml0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghdGFnQ3R4LmFyZ3MubGVuZ3RoICYmIHRhZ0N0eC5hcmdEZWZhdWx0ICE9PSBmYWxzZSAmJiB0YWcuYXJnRGVmYXVsdCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0XHR0YWdDdHguYXJncyA9IGFyZ3MgPSBbdGFnQ3R4LnZpZXcuZGF0YV07IC8vIE1pc3NpbmcgZmlyc3QgYXJnIGRlZmF1bHRzIHRvIHRoZSBjdXJyZW50IGRhdGEgY29udGV4dFxuXHRcdFx0XHRcdHRhZ0N0eC5wYXJhbXMuYXJncyA9IFtcIiNkYXRhXCJdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YmluZFRvID0gYmluZFRvT3JCaW5kRnJvbShcImJpbmRUb1wiKTtcblxuXHRcdFx0XHRpZiAodGFnLmJpbmRUbyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGFnLmJpbmRUbyA9IGJpbmRUbztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0YWcuYmluZEZyb20gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRhZy5iaW5kRnJvbSA9IGJpbmRUb09yQmluZEZyb20oXCJiaW5kRnJvbVwiKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0YWcuYmluZFRvKSB7XG5cdFx0XHRcdFx0dGFnLmJpbmRGcm9tID0gdGFnLmJpbmRUbyA9IGJpbmRUbztcblx0XHRcdFx0fVxuXHRcdFx0XHRiaW5kRnJvbSA9IHRhZy5iaW5kRnJvbSB8fCBiaW5kVG87XG5cblx0XHRcdFx0YmluZFRvTGVuZ3RoID0gYmluZFRvLmxlbmd0aDtcblx0XHRcdFx0YmluZEZyb21MZW5ndGggPSBiaW5kRnJvbS5sZW5ndGg7XG5cblx0XHRcdFx0aWYgKHRhZy5fLmJuZCAmJiAobGlua2VkRWxlbWVudCA9IHRhZy5saW5rZWRFbGVtZW50KSkge1xuXHRcdFx0XHRcdHRhZy5saW5rZWRFbGVtZW50ID0gbGlua2VkRWxlbWVudCA9ICRpc0FycmF5KGxpbmtlZEVsZW1lbnQpID8gbGlua2VkRWxlbWVudDogW2xpbmtlZEVsZW1lbnRdO1xuXG5cdFx0XHRcdFx0aWYgKGJpbmRUb0xlbmd0aCAhPT0gbGlua2VkRWxlbWVudC5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGVycm9yKFwibGlua2VkRWxlbWVudCBub3Qgc2FtZSBsZW5ndGggYXMgYmluZFRvXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGlua2VkRWxlbWVudCA9IHRhZy5saW5rZWRDdHhQYXJhbSkge1xuXHRcdFx0XHRcdHRhZy5saW5rZWRDdHhQYXJhbSA9IGxpbmtlZEVsZW1lbnQgPSAkaXNBcnJheShsaW5rZWRFbGVtZW50KSA/IGxpbmtlZEVsZW1lbnQ6IFtsaW5rZWRFbGVtZW50XTtcblxuXHRcdFx0XHRcdGlmIChiaW5kRnJvbUxlbmd0aCAhPT0gbGlua2VkRWxlbWVudC5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGVycm9yKFwibGlua2VkQ3R4UGFyYW0gbm90IHNhbWUgbGVuZ3RoIGFzIGJpbmRGcm9tL2JpbmRUb1wiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYmluZEZyb20pIHtcblx0XHRcdFx0XHR0YWcuXy5mcm9tSW5kZXggPSB7fTsgLy8gSGFzaCBvZiBiaW5kRnJvbSBpbmRleCB3aGljaCBoYXMgc2FtZSBwYXRoIHZhbHVlIGFzIGJpbmRUbyBpbmRleC4gZnJvbUluZGV4ID0gdGFnLl8uZnJvbUluZGV4W3RvSW5kZXhdXG5cdFx0XHRcdFx0dGFnLl8udG9JbmRleCA9IHt9OyAvLyBIYXNoIG9mIGJpbmRGcm9tIGluZGV4IHdoaWNoIGhhcyBzYW1lIHBhdGggdmFsdWUgYXMgYmluZFRvIGluZGV4LiBmcm9tSW5kZXggPSB0YWcuXy5mcm9tSW5kZXhbdG9JbmRleF1cblx0XHRcdFx0XHRuID0gYmluZEZyb21MZW5ndGg7XG5cdFx0XHRcdFx0d2hpbGUgKG4tLSkge1xuXHRcdFx0XHRcdFx0a2V5ID0gYmluZEZyb21bbl07XG5cdFx0XHRcdFx0XHRtID0gYmluZFRvTGVuZ3RoO1xuXHRcdFx0XHRcdFx0d2hpbGUgKG0tLSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoa2V5ID09PSBiaW5kVG9bbV0pIHtcblx0XHRcdFx0XHRcdFx0XHR0YWcuXy5mcm9tSW5kZXhbbV0gPSBuO1xuXHRcdFx0XHRcdFx0XHRcdHRhZy5fLnRvSW5kZXhbbl0gPSBtO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGxpbmtDdHgpIHtcblx0XHRcdFx0XHQvLyBTZXQgYXR0ciBvbiBsaW5rQ3R4IHRvIGVuc3VyZSBvdXRwdXR0aW5nIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBhdHRyaWJ1dGUuXG5cdFx0XHRcdFx0Ly8gU2V0dGluZyBlaXRoZXIgbGlua0N0eC5hdHRyIG9yIHRoaXMuYXR0ciBpbiB0aGUgaW5pdCgpIGFsbG93cyBwZXItaW5zdGFuY2UgY2hvaWNlIG9mIHRhcmdldCBhdHRyaWIuXG5cdFx0XHRcdFx0bGlua0N0eC5hdHRyID0gdGFnLmF0dHIgPSBsaW5rQ3R4LmF0dHIgfHwgdGFnLmF0dHIgfHwgbGlua0N0eC5fZGZBdDtcblx0XHRcdFx0fVxuXHRcdFx0XHRhdHRyID0gdGFnLmF0dHI7XG5cdFx0XHRcdHRhZy5fLm5vVndzID0gYXR0ciAmJiBhdHRyICE9PSBIVE1MO1xuXHRcdFx0fVxuXHRcdFx0YXJncyA9IHRhZy5jdnRBcmdzKGkpO1xuXHRcdFx0aWYgKHRhZy5saW5rZWRDdHhQYXJhbSkge1xuXHRcdFx0XHRiZEFyZ3MgPSB0YWcuY3Z0QXJncyhpLCAxKTtcblx0XHRcdFx0bSA9IGJpbmRGcm9tTGVuZ3RoO1xuXHRcdFx0XHRkZWZhdWx0Q3R4ID0gdGFnLmNvbnN0cnVjdG9yLnByb3RvdHlwZS5jdHg7XG5cdFx0XHRcdHdoaWxlIChtLS0pIHtcblx0XHRcdFx0XHRpZiAoY3R4UHJtID0gdGFnLmxpbmtlZEN0eFBhcmFtW21dKSB7XG5cdFx0XHRcdFx0XHRrZXkgPSBiaW5kRnJvbVttXTtcblx0XHRcdFx0XHRcdGluaXRWYWwgPSBiZEFyZ3NbbV07XG5cdFx0XHRcdFx0XHQvLyBDcmVhdGUgdGFnIGNvbnRleHR1YWwgcGFyYW1ldGVyXG5cdFx0XHRcdFx0XHR0YWdDdHguY3R4W2N0eFBybV0gPSAkc3ViLl9jcChcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdEN0eCAmJiBpbml0VmFsID09PSB1bmRlZmluZWQgPyBkZWZhdWx0Q3R4W2N0eFBybV06IGluaXRWYWwsXG5cdFx0XHRcdFx0XHRcdGluaXRWYWwgIT09IHVuZGVmaW5lZCAmJiBhcmdPclByb3AodGFnQ3R4LnBhcmFtcywga2V5KSxcblx0XHRcdFx0XHRcdFx0dGFnQ3R4LnZpZXcsXG5cdFx0XHRcdFx0XHRcdHRhZy5fLmJuZCAmJiB7dGFnOiB0YWcsIGN2dDogdGFnLmNvbnZlcnQsIGluZDogbSwgdGFnRWxzZTogaX1cblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoKG1hcERlZiA9IHByb3BzLmRhdGFNYXAgfHwgdGFnRGF0YU1hcCkgJiYgKGFyZ3MubGVuZ3RoIHx8IHByb3BzLmRhdGFNYXApKSB7XG5cdFx0XHRcdHRoaXNNYXAgPSB0YWdDdHgubWFwO1xuXHRcdFx0XHRpZiAoIXRoaXNNYXAgfHwgdGhpc01hcC5zcmMgIT09IGFyZ3NbMF0gfHwgaXNVcGRhdGUpIHtcblx0XHRcdFx0XHRpZiAodGhpc01hcCAmJiB0aGlzTWFwLnNyYykge1xuXHRcdFx0XHRcdFx0dGhpc01hcC51bm1hcCgpOyAvLyBvbmx5IGNhbGxlZCBpZiBvYnNlcnZhYmxlIG1hcCAtIG5vdCB3aGVuIG9ubHkgdXNlZCBpbiBKc1JlbmRlciwgZS5nLiBieSB7e3Byb3BzfX1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bWFwRGVmLm1hcChhcmdzWzBdLCB0YWdDdHgsIHRoaXNNYXAsICF0YWcuXy5ibmQpO1xuXHRcdFx0XHRcdHRoaXNNYXAgPSB0YWdDdHgubWFwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFyZ3MgPSBbdGhpc01hcC50Z3RdO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVtUmV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRhZy5yZW5kZXIpIHtcblx0XHRcdFx0aXRlbVJldCA9IHRhZy5yZW5kZXIuYXBwbHkodGFnLCBhcmdzKTtcblx0XHRcdFx0aWYgKHBhcmVudFZpZXcubGlua2VkICYmIGl0ZW1SZXQgJiYgIXJXcmFwcGVkSW5WaWV3TWFya2VyLnRlc3QoaXRlbVJldCkpIHtcblx0XHRcdFx0XHQvLyBXaGVuIGEgdGFnIHJlbmRlcnMgY29udGVudCBmcm9tIHRoZSByZW5kZXIgbWV0aG9kLCB3aXRoIGRhdGEgbGlua2luZyB0aGVuIHdlIG5lZWQgdG8gd3JhcCB3aXRoIHZpZXcgbWFya2VycywgaWYgYWJzZW50LFxuXHRcdFx0XHRcdC8vIHRvIHByb3ZpZGUgYSBjb250ZW50VmlldyBmb3IgdGhlIHRhZywgd2hpY2ggd2lsbCBjb3JyZWN0bHkgZGlzcG9zZSBiaW5kaW5ncyBpZiBkZWxldGVkLiBUaGUgJ3RtcGwnIGZvciB0aGlzIHZpZXcgd2lsbFxuXHRcdFx0XHRcdC8vIGJlIGEgZHVtYmVkLWRvd24gdGVtcGxhdGUgd2hpY2ggd2lsbCBhbHdheXMgcmV0dXJuIHRoZSAgaXRlbVJldCBzdHJpbmcgKG5vIG1hdHRlciB3aGF0IHRoZSBkYXRhIGlzKS4gVGhlIGl0ZW1SZXQgc3RyaW5nXG5cdFx0XHRcdFx0Ly8gaXMgbm90IGNvbXBpbGVkIGFzIHRlbXBsYXRlIG1hcmt1cCwgc28gY2FuIGluY2x1ZGUgXCJ7e1wiIG9yIFwifX1cIiB3aXRob3V0IHRyaWdnZXJpbmcgc3ludGF4IGVycm9yc1xuXHRcdFx0XHRcdHRtcGwgPSB7IC8vICdEdW1iZWQtZG93bicgdGVtcGxhdGUgd2hpY2ggYWx3YXlzIHJlbmRlcnMgJ3N0YXRpYycgaXRlbVJldCBzdHJpbmdcblx0XHRcdFx0XHRcdGxpbmtzOiBbXVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0dG1wbC5yZW5kZXIgPSB0bXBsLmZuID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gaXRlbVJldDtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGl0ZW1SZXQgPSByZW5kZXJXaXRoVmlld3ModG1wbCwgcGFyZW50Vmlldy5kYXRhLCB1bmRlZmluZWQsIHRydWUsIHBhcmVudFZpZXcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0YWcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWFyZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdGFyZ3MgPSBbcGFyZW50Vmlld107IC8vIG5vIGFyZ3VtZW50cyAtIChlLmcuIHt7ZWxzZX19KSBnZXQgZGF0YSBjb250ZXh0IGZyb20gdmlldy5cblx0XHRcdH1cblx0XHRcdGlmIChpdGVtUmV0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29udGVudEN0eCA9IGFyZ3NbMF07IC8vIERlZmF1bHQgZGF0YSBjb250ZXh0IGZvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaXMgdGhlIGZpcnN0IGFyZ3VtZW50XG5cdFx0XHRcdGlmICh0YWcuY29udGVudEN0eCkgeyAvLyBTZXQgdGFnLmNvbnRlbnRDdHggdG8gdHJ1ZSwgdG8gaW5oZXJpdCBwYXJlbnQgY29udGV4dCwgb3IgdG8gYSBmdW5jdGlvbiB0byBwcm92aWRlIGFsdGVybmF0ZSBjb250ZXh0LlxuXHRcdFx0XHRcdGNvbnRlbnRDdHggPSB0YWcuY29udGVudEN0eCA9PT0gdHJ1ZSA/IHBhcmVudFZpZXcgOiB0YWcuY29udGVudEN0eChjb250ZW50Q3R4KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpdGVtUmV0ID0gdGFnQ3R4LnJlbmRlcihjb250ZW50Q3R4LCB0cnVlKSB8fCAoaXNVcGRhdGUgPyB1bmRlZmluZWQgOiBcIlwiKTtcblx0XHRcdH1cblx0XHRcdHJldCA9IHJldFxuXHRcdFx0XHQ/IHJldCArIChpdGVtUmV0IHx8IFwiXCIpXG5cdFx0XHRcdDogaXRlbVJldCAhPT0gdW5kZWZpbmVkXG5cdFx0XHRcdFx0PyBcIlwiICsgaXRlbVJldFxuXHRcdFx0XHRcdDogdW5kZWZpbmVkOyAvLyBJZiBubyByZXR1cm4gdmFsdWUgZnJvbSByZW5kZXIsIGFuZCBubyB0ZW1wbGF0ZS9jb250ZW50IHRhZ0N0eC5yZW5kZXIoLi4uKSwgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdH1cblx0XHR0YWcucmVuZGVyaW5nID0gdGFnLnJlbmRlcmluZy5ybmRyOyAvLyBSZW1vdmUgdGFnLnJlbmRlcmluZyBvYmplY3QgKGlmIHRoaXMgaXMgb3V0ZXJtb3N0IHJlbmRlciBjYWxsLiAoSW4gY2FzZSBvZiBuZXN0ZWQgY2FsbHMpXG5cdH1cblx0dGFnLnRhZ0N0eCA9IHRhZ0N0eHNbMF07XG5cdHRhZy5jdHggPSB0YWcudGFnQ3R4LmN0eDtcblxuXHRpZiAodGFnLl8ubm9Wd3MgJiYgdGFnLmlubGluZSkge1xuXHRcdC8vIGlubGluZSB0YWcgd2l0aCBhdHRyIHNldCB0byBcInRleHRcIiB3aWxsIGluc2VydCBIVE1MLWVuY29kZWQgY29udGVudCAtIGFzIGlmIGl0IHdhcyBlbGVtZW50LWJhc2VkIGlubmVyVGV4dFxuXHRcdHJldCA9IGF0dHIgPT09IFwidGV4dFwiXG5cdFx0XHQ/ICRjb252ZXJ0ZXJzLmh0bWwocmV0KVxuXHRcdFx0OiBcIlwiO1xuXHR9XG5cdHJldHVybiBib3VuZFRhZyAmJiBwYXJlbnRWaWV3Ll8ub25SZW5kZXJcblx0XHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdFx0PyBwYXJlbnRWaWV3Ll8ub25SZW5kZXIocmV0LCBwYXJlbnRWaWV3LCB0YWcpXG5cdFx0OiByZXQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT1cbi8vIFZpZXcgY29uc3RydWN0b3Jcbi8vPT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gVmlldyhjb250ZXh0LCB0eXBlLCBwYXJlbnRWaWV3LCBkYXRhLCB0ZW1wbGF0ZSwga2V5LCBvblJlbmRlciwgY29udGVudFRtcGwpIHtcblx0Ly8gQ29uc3RydWN0b3IgZm9yIHZpZXcgb2JqZWN0IGluIHZpZXcgaGllcmFyY2h5LiAoQXVnbWVudGVkIGJ5IEpzVmlld3MgaWYgSnNWaWV3cyBpcyBsb2FkZWQpXG5cdHZhciB2aWV3cywgcGFyZW50Vmlld18sIHRhZywgc2VsZl8sXG5cdFx0c2VsZiA9IHRoaXMsXG5cdFx0aXNBcnJheSA9IHR5cGUgPT09IFwiYXJyYXlcIjtcblx0XHQvLyBJZiB0aGUgZGF0YSBpcyBhbiBhcnJheSwgdGhpcyBpcyBhbiAnYXJyYXkgdmlldycgd2l0aCBhIHZpZXdzIGFycmF5IGZvciBlYWNoIGNoaWxkICdpdGVtIHZpZXcnXG5cdFx0Ly8gSWYgdGhlIGRhdGEgaXMgbm90IGFuIGFycmF5LCB0aGlzIGlzIGFuICdpdGVtIHZpZXcnIHdpdGggYSB2aWV3cyAnaGFzaCcgb2JqZWN0IGZvciBhbnkgY2hpbGQgbmVzdGVkIHZpZXdzXG5cblx0c2VsZi5jb250ZW50ID0gY29udGVudFRtcGw7XG5cdHNlbGYudmlld3MgPSBpc0FycmF5ID8gW10gOiB7fTtcblx0c2VsZi5kYXRhID0gZGF0YTtcblx0c2VsZi50bXBsID0gdGVtcGxhdGU7XG5cdHNlbGZfID0gc2VsZi5fID0ge1xuXHRcdGtleTogMCxcblx0XHQvLyAuXy51c2VLZXkgaXMgbm9uIHplcm8gaWYgaXMgbm90IGFuICdhcnJheSB2aWV3JyAob3duaW5nIGEgZGF0YSBhcnJheSkuIFVzZSB0aGlzIGFzIG5leHQga2V5IGZvciBhZGRpbmcgdG8gY2hpbGQgdmlld3MgaGFzaFxuXHRcdHVzZUtleTogaXNBcnJheSA/IDAgOiAxLFxuXHRcdGlkOiBcIlwiICsgdmlld0lkKyssXG5cdFx0b25SZW5kZXI6IG9uUmVuZGVyLFxuXHRcdGJuZHM6IHt9XG5cdH07XG5cdHNlbGYubGlua2VkID0gISFvblJlbmRlcjtcblx0c2VsZi50eXBlID0gdHlwZSB8fCBcInRvcFwiO1xuXG5cdGlmICghcGFyZW50VmlldyB8fCBwYXJlbnRWaWV3LnR5cGUgPT09IFwidG9wXCIpIHtcblx0XHQoc2VsZi5jdHggPSBjb250ZXh0IHx8IHt9KS5yb290ID0gc2VsZi5kYXRhO1xuXHR9XG5cblx0aWYgKHNlbGYucGFyZW50ID0gcGFyZW50Vmlldykge1xuXHRcdHNlbGYucm9vdCA9IHBhcmVudFZpZXcucm9vdCB8fCBzZWxmOyAvLyB2aWV3IHdob3NlIHBhcmVudCBpcyB0b3Agdmlld1xuXHRcdHZpZXdzID0gcGFyZW50Vmlldy52aWV3cztcblx0XHRwYXJlbnRWaWV3XyA9IHBhcmVudFZpZXcuXztcblx0XHRzZWxmLmlzVG9wID0gcGFyZW50Vmlld18uc2NwOyAvLyBJcyB0b3AgY29udGVudCB2aWV3IG9mIGEgbGluayhcIiNjb250YWluZXJcIiwgLi4uKSBjYWxsXG5cdFx0c2VsZi5zY29wZSA9ICghY29udGV4dC50YWcgfHwgY29udGV4dC50YWcgPT09IHBhcmVudFZpZXcuY3R4LnRhZykgJiYgIXNlbGYuaXNUb3AgJiYgcGFyZW50Vmlldy5zY29wZSB8fCBzZWxmO1xuXHRcdC8vIFNjb3BlIGZvciBjb250ZXh0UGFyYW1zIC0gY2xvc2VzdCBub24gZmxvdyB0YWcgYW5jZXN0b3Igb3Igcm9vdCB2aWV3XG5cdFx0aWYgKHBhcmVudFZpZXdfLnVzZUtleSkge1xuXHRcdFx0Ly8gUGFyZW50IGlzIG5vdCBhbiAnYXJyYXkgdmlldycuIEFkZCB0aGlzIHZpZXcgdG8gaXRzIHZpZXdzIG9iamVjdFxuXHRcdFx0Ly8gc2VsZi5fa2V5ID0gaXMgdGhlIGtleSBpbiB0aGUgcGFyZW50IHZpZXcgaGFzaFxuXHRcdFx0dmlld3Nbc2VsZl8ua2V5ID0gXCJfXCIgKyBwYXJlbnRWaWV3Xy51c2VLZXkrK10gPSBzZWxmO1xuXHRcdFx0c2VsZi5pbmRleCA9IGluZGV4U3RyO1xuXHRcdFx0c2VsZi5nZXRJbmRleCA9IGdldE5lc3RlZEluZGV4O1xuXHRcdH0gZWxzZSBpZiAodmlld3MubGVuZ3RoID09PSAoc2VsZl8ua2V5ID0gc2VsZi5pbmRleCA9IGtleSkpIHsgLy8gUGFyZW50IGlzIGFuICdhcnJheSB2aWV3Jy4gQWRkIHRoaXMgdmlldyB0byBpdHMgdmlld3MgYXJyYXlcblx0XHRcdHZpZXdzLnB1c2goc2VsZik7IC8vIEFkZGluZyB0byBlbmQgb2Ygdmlld3MgYXJyYXkuIChVc2luZyBwdXNoIHdoZW4gcG9zc2libGUgLSBiZXR0ZXIgcGVyZiB0aGFuIHNwbGljZSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmlld3Muc3BsaWNlKGtleSwgMCwgc2VsZik7IC8vIEluc2VydGluZyBpbiB2aWV3cyBhcnJheVxuXHRcdH1cblx0XHQvLyBJZiBubyBjb250ZXh0IHdhcyBwYXNzZWQgaW4sIHVzZSBwYXJlbnQgY29udGV4dFxuXHRcdC8vIElmIGNvbnRleHQgd2FzIHBhc3NlZCBpbiwgaXQgc2hvdWxkIGhhdmUgYmVlbiBtZXJnZWQgYWxyZWFkeSB3aXRoIHBhcmVudCBjb250ZXh0XG5cdFx0c2VsZi5jdHggPSBjb250ZXh0IHx8IHBhcmVudFZpZXcuY3R4O1xuXHR9IGVsc2UgaWYgKHR5cGUpIHtcblx0XHRzZWxmLnJvb3QgPSBzZWxmOyAvLyB2aWV3IHdob3NlIHBhcmVudCBpcyB0b3Agdmlld1xuXHR9XG59XG5cblZpZXcucHJvdG90eXBlID0ge1xuXHRnZXQ6IGdldFZpZXcsXG5cdGdldEluZGV4OiBnZXRJbmRleCxcblx0Y3R4UHJtOiBjb250ZXh0UGFyYW1ldGVyLFxuXHRnZXRSc2M6IGdldFJlc291cmNlLFxuXHRfZ2V0VG1wbDogZ2V0VGVtcGxhdGUsXG5cdF9nZXRPYjogZ2V0UGF0aE9iamVjdCxcblx0X2lzOiBcInZpZXdcIlxufTtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBSZWdpc3RyYXRpb25cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb21waWxlQ2hpbGRSZXNvdXJjZXMocGFyZW50VG1wbCkge1xuXHR2YXIgc3RvcmVOYW1lLCBzdG9yZU5hbWVzLCByZXNvdXJjZXM7XG5cdGZvciAoc3RvcmVOYW1lIGluIGpzdlN0b3Jlcykge1xuXHRcdHN0b3JlTmFtZXMgPSBzdG9yZU5hbWUgKyBcInNcIjtcblx0XHRpZiAocGFyZW50VG1wbFtzdG9yZU5hbWVzXSkge1xuXHRcdFx0cmVzb3VyY2VzID0gcGFyZW50VG1wbFtzdG9yZU5hbWVzXTsgICAgLy8gUmVzb3VyY2VzIG5vdCB5ZXQgY29tcGlsZWRcblx0XHRcdHBhcmVudFRtcGxbc3RvcmVOYW1lc10gPSB7fTsgICAgICAgICAgICAgICAvLyBSZW1vdmUgdW5jb21waWxlZCByZXNvdXJjZXNcblx0XHRcdCR2aWV3c1tzdG9yZU5hbWVzXShyZXNvdXJjZXMsIHBhcmVudFRtcGwpOyAvLyBBZGQgYmFjayBpbiB0aGUgY29tcGlsZWQgcmVzb3VyY2VzXG5cdFx0fVxuXHR9XG59XG5cbi8vPT09PT09PT09PT09PT09XG4vLyBjb21waWxlVGFnXG4vLz09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBjb21waWxlVGFnKG5hbWUsIHRhZ0RlZiwgcGFyZW50VG1wbCkge1xuXHR2YXIgdG1wbCwgYmFzZVRhZywgcHJvcCxcblx0XHRjb21waWxlZERlZiA9IG5ldyAkc3ViLl90ZygpO1xuXG5cdGZ1bmN0aW9uIFRhZygpIHtcblx0XHR2YXIgdGFnID0gdGhpcztcblx0XHR0YWcuXyA9IHtcblx0XHRcdHVubGlua2VkOiB0cnVlXG5cdFx0fTtcblx0XHR0YWcuaW5saW5lID0gdHJ1ZTtcblx0XHR0YWcudGFnTmFtZSA9IG5hbWU7XG5cdH1cblxuXHRpZiAoJGlzRnVuY3Rpb24odGFnRGVmKSkge1xuXHRcdC8vIFNpbXBsZSB0YWcgZGVjbGFyZWQgYXMgZnVuY3Rpb24uIE5vIHByZXNlbnRlciBpbnN0YW50YXRpb24uXG5cdFx0dGFnRGVmID0ge1xuXHRcdFx0ZGVwZW5kczogdGFnRGVmLmRlcGVuZHMsXG5cdFx0XHRyZW5kZXI6IHRhZ0RlZlxuXHRcdH07XG5cdH0gZWxzZSBpZiAoXCJcIiArIHRhZ0RlZiA9PT0gdGFnRGVmKSB7XG5cdFx0dGFnRGVmID0ge3RlbXBsYXRlOiB0YWdEZWZ9O1xuXHR9XG5cblx0aWYgKGJhc2VUYWcgPSB0YWdEZWYuYmFzZVRhZykge1xuXHRcdHRhZ0RlZi5mbG93ID0gISF0YWdEZWYuZmxvdzsgLy8gU2V0IGZsb3cgcHJvcGVydHksIHNvIGRlZmF1bHRzIHRvIGZhbHNlIGV2ZW4gaWYgYmFzZVRhZyBoYXMgZmxvdz10cnVlXG5cdFx0YmFzZVRhZyA9IFwiXCIgKyBiYXNlVGFnID09PSBiYXNlVGFnXG5cdFx0XHQ/IChwYXJlbnRUbXBsICYmIHBhcmVudFRtcGwudGFnc1tiYXNlVGFnXSB8fCAkdGFnc1tiYXNlVGFnXSlcblx0XHRcdDogYmFzZVRhZztcblx0XHRpZiAoIWJhc2VUYWcpIHtcblx0XHRcdGVycm9yKCdiYXNlVGFnOiBcIicgKyB0YWdEZWYuYmFzZVRhZyArICdcIiBub3QgZm91bmQnKTtcblx0XHR9XG5cdFx0Y29tcGlsZWREZWYgPSAkZXh0ZW5kKGNvbXBpbGVkRGVmLCBiYXNlVGFnKTtcblxuXHRcdGZvciAocHJvcCBpbiB0YWdEZWYpIHtcblx0XHRcdGNvbXBpbGVkRGVmW3Byb3BdID0gZ2V0TWV0aG9kKGJhc2VUYWdbcHJvcF0sIHRhZ0RlZltwcm9wXSk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGNvbXBpbGVkRGVmID0gJGV4dGVuZChjb21waWxlZERlZiwgdGFnRGVmKTtcblx0fVxuXG5cdC8vIFRhZyBkZWNsYXJlZCBhcyBvYmplY3QsIHVzZWQgYXMgdGhlIHByb3RvdHlwZSBmb3IgdGFnIGluc3RhbnRpYXRpb24gKGNvbnRyb2wvcHJlc2VudGVyKVxuXHRpZiAoKHRtcGwgPSBjb21waWxlZERlZi50ZW1wbGF0ZSkgIT09IHVuZGVmaW5lZCkge1xuXHRcdGNvbXBpbGVkRGVmLnRlbXBsYXRlID0gXCJcIiArIHRtcGwgPT09IHRtcGwgPyAoJHRlbXBsYXRlc1t0bXBsXSB8fCAkdGVtcGxhdGVzKHRtcGwpKSA6IHRtcGw7XG5cdH1cblx0KFRhZy5wcm90b3R5cGUgPSBjb21waWxlZERlZikuY29uc3RydWN0b3IgPSBjb21waWxlZERlZi5fY3RyID0gVGFnO1xuXG5cdGlmIChwYXJlbnRUbXBsKSB7XG5cdFx0Y29tcGlsZWREZWYuX3BhcmVudFRtcGwgPSBwYXJlbnRUbXBsO1xuXHR9XG5cdHJldHVybiBjb21waWxlZERlZjtcbn1cblxuZnVuY3Rpb24gYmFzZUFwcGx5KGFyZ3MpIHtcblx0Ly8gSW4gZGVyaXZlZCBtZXRob2QgKG9yIGhhbmRsZXIgZGVjbGFyZWQgZGVjbGFyYXRpdmVseSBhcyBpbiB7ezpmb28gb25DaGFuZ2U9fmZvb0NoYW5nZWR9fSBjYW4gY2FsbCBiYXNlIG1ldGhvZCxcblx0Ly8gdXNpbmcgdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSAoRXF1aXZhbGVudCB0byB0aGlzLl9zdXBlckFwcGx5KGFyZ3VtZW50cykgaW4galF1ZXJ5IFVJKVxuXHRyZXR1cm4gdGhpcy5iYXNlLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vLz09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVRtcGxcbi8vPT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVUbXBsKG5hbWUsIHRtcGwsIHBhcmVudFRtcGwsIG9wdGlvbnMpIHtcblx0Ly8gdG1wbCBpcyBlaXRoZXIgYSB0ZW1wbGF0ZSBvYmplY3QsIGEgc2VsZWN0b3IgZm9yIGEgdGVtcGxhdGUgc2NyaXB0IGJsb2NrLCB0aGUgbmFtZSBvZiBhIGNvbXBpbGVkIHRlbXBsYXRlLCBvciBhIHRlbXBsYXRlIG9iamVjdFxuXG5cdC8vPT09PSBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblx0ZnVuY3Rpb24gbG9va3VwVGVtcGxhdGUodmFsdWUpIHtcblx0XHQvLyBJZiB2YWx1ZSBpcyBvZiB0eXBlIHN0cmluZyAtIHRyZWF0IGFzIHNlbGVjdG9yLCBvciBuYW1lIG9mIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0Ly8gUmV0dXJuIHRoZSB0ZW1wbGF0ZSBvYmplY3QsIGlmIGFscmVhZHkgY29tcGlsZWQsIG9yIHRoZSBtYXJrdXAgc3RyaW5nXG5cdFx0dmFyIGN1cnJlbnROYW1lLCB0bXBsO1xuXHRcdGlmICgoXCJcIiArIHZhbHVlID09PSB2YWx1ZSkgfHwgdmFsdWUubm9kZVR5cGUgPiAwICYmIChlbGVtID0gdmFsdWUpKSB7XG5cdFx0XHRpZiAoIWVsZW0pIHtcblx0XHRcdFx0aWYgKC9eXFwuXFwvW15cXFxcOio/XCI8Pl0qJC8udGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyB0bXBsPVwiLi9zb21lL2ZpbGUuaHRtbFwiXG5cdFx0XHRcdFx0Ly8gSWYgdGhlIHRlbXBsYXRlIGlzIG5vdCBuYW1lZCwgdXNlIFwiLi9zb21lL2ZpbGUuaHRtbFwiIGFzIG5hbWUuXG5cdFx0XHRcdFx0aWYgKHRtcGwgPSAkdGVtcGxhdGVzW25hbWUgPSBuYW1lIHx8IHZhbHVlXSkge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSB0bXBsO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyBCUk9XU0VSLVNQRUNJRklDIENPREUgKG5vdCBvbiBOb2RlLmpzKTpcblx0XHRcdFx0XHRcdC8vIExvb2sgZm9yIHNlcnZlci1nZW5lcmF0ZWQgc2NyaXB0IGJsb2NrIHdpdGggaWQgXCIuL3NvbWUvZmlsZS5odG1sXCJcblx0XHRcdFx0XHRcdGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCQuZm4gJiYgISRzdWIuclRtcGwudGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZWxlbSA9ICQgKHZhbHVlLCBkb2N1bWVudClbMF07IC8vIGlmIGpRdWVyeSBpcyBsb2FkZWQsIHRlc3QgZm9yIHNlbGVjdG9yIHJldHVybmluZyBlbGVtZW50cywgYW5kIGdldCBmaXJzdCBlbGVtZW50XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge31cblx0XHRcdFx0fS8vIEVORCBCUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdH0gLy9CUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdGlmIChlbGVtKSB7XG5cdFx0XHRcdGlmIChlbGVtLnRhZ05hbWUgIT09IFwiU0NSSVBUXCIpIHtcblx0XHRcdFx0XHRlcnJvcih2YWx1ZSArIFwiOiBVc2Ugc2NyaXB0IGJsb2NrLCBub3QgXCIgKyBlbGVtLnRhZ05hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHRcdFx0Ly8gV2Ugd2lsbCBjb21waWxlIGEgbmV3IHRlbXBsYXRlIHVzaW5nIHRoZSBtYXJrdXAgaW4gdGhlIHNjcmlwdCBlbGVtZW50XG5cdFx0XHRcdFx0dmFsdWUgPSBlbGVtLmlubmVySFRNTDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBXZSB3aWxsIGNhY2hlIGEgc2luZ2xlIGNvcHkgb2YgdGhlIGNvbXBpbGVkIHRlbXBsYXRlLCBhbmQgYXNzb2NpYXRlIGl0IHdpdGggdGhlIG5hbWVcblx0XHRcdFx0XHQvLyAocmVuYW1pbmcgZnJvbSBhIHByZXZpb3VzIG5hbWUgaWYgdGhlcmUgd2FzIG9uZSkuXG5cdFx0XHRcdFx0Y3VycmVudE5hbWUgPSBlbGVtLmdldEF0dHJpYnV0ZSh0bXBsQXR0cik7XG5cdFx0XHRcdFx0aWYgKGN1cnJlbnROYW1lKSB7XG5cdFx0XHRcdFx0XHRpZiAoY3VycmVudE5hbWUgIT09IGpzdlRtcGwpIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkdGVtcGxhdGVzW2N1cnJlbnROYW1lXTtcblx0XHRcdFx0XHRcdFx0ZGVsZXRlICR0ZW1wbGF0ZXNbY3VycmVudE5hbWVdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICgkLmZuKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gJC5kYXRhKGVsZW0pW2pzdlRtcGxdOyAvLyBHZXQgY2FjaGVkIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghY3VycmVudE5hbWUgfHwgIXZhbHVlKSB7IC8vIE5vdCB5ZXQgY29tcGlsZWQsIG9yIGNhY2hlZCB2ZXJzaW9uIGxvc3Rcblx0XHRcdFx0XHRcdG5hbWUgPSBuYW1lIHx8ICgkLmZuID8ganN2VG1wbCA6IHZhbHVlKTtcblx0XHRcdFx0XHRcdHZhbHVlID0gY29tcGlsZVRtcGwobmFtZSwgZWxlbS5pbm5lckhUTUwsIHBhcmVudFRtcGwsIG9wdGlvbnMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YWx1ZS50bXBsTmFtZSA9IG5hbWUgPSBuYW1lIHx8IGN1cnJlbnROYW1lO1xuXHRcdFx0XHRcdGlmIChuYW1lICE9PSBqc3ZUbXBsKSB7XG5cdFx0XHRcdFx0XHQkdGVtcGxhdGVzW25hbWVdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsZW0uc2V0QXR0cmlidXRlKHRtcGxBdHRyLCBuYW1lKTtcblx0XHRcdFx0XHRpZiAoJC5mbikge1xuXHRcdFx0XHRcdFx0JC5kYXRhKGVsZW0sIGpzdlRtcGwsIHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gLy8gRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0ZWxlbSA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKCF2YWx1ZS5mbikge1xuXHRcdFx0dmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0XHQvLyBJZiB2YWx1ZSBpcyBub3QgYSBzdHJpbmcuIEhUTUwgZWxlbWVudCwgb3IgY29tcGlsZWQgdGVtcGxhdGUsIHJldHVybiB1bmRlZmluZWRcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0dmFyIGVsZW0sIGNvbXBpbGVkVG1wbCxcblx0XHR0bXBsT3JNYXJrdXAgPSB0bXBsID0gdG1wbCB8fCBcIlwiO1xuXHQkc3ViLl9odG1sID0gJGNvbnZlcnRlcnMuaHRtbDtcblxuXHQvLz09PT0gQ29tcGlsZSB0aGUgdGVtcGxhdGUgPT09PVxuXHRpZiAob3B0aW9ucyA9PT0gMCkge1xuXHRcdG9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dG1wbE9yTWFya3VwID0gbG9va3VwVGVtcGxhdGUodG1wbE9yTWFya3VwKTsgLy8gVG9wLWxldmVsIGNvbXBpbGUgc28gZG8gYSB0ZW1wbGF0ZSBsb29rdXBcblx0fVxuXG5cdC8vIElmIG9wdGlvbnMsIHRoZW4gdGhpcyB3YXMgYWxyZWFkeSBjb21waWxlZCBmcm9tIGEgKHNjcmlwdCkgZWxlbWVudCB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cblx0Ly8gSWYgbm90LCB0aGVuIGlmIHRtcGwgaXMgYSB0ZW1wbGF0ZSBvYmplY3QsIHVzZSBpdCBmb3Igb3B0aW9uc1xuXHRvcHRpb25zID0gb3B0aW9ucyB8fCAodG1wbC5tYXJrdXBcblx0XHQ/IHRtcGwuYm5kc1xuXHRcdFx0PyAkZXh0ZW5kKHt9LCB0bXBsKVxuXHRcdFx0OiB0bXBsXG5cdFx0OiB7fVxuXHQpO1xuXG5cdG9wdGlvbnMudG1wbE5hbWUgPSBvcHRpb25zLnRtcGxOYW1lIHx8IG5hbWUgfHwgXCJ1bm5hbWVkXCI7XG5cdGlmIChwYXJlbnRUbXBsKSB7XG5cdFx0b3B0aW9ucy5fcGFyZW50VG1wbCA9IHBhcmVudFRtcGw7XG5cdH1cblx0Ly8gSWYgdG1wbCBpcyBub3QgYSBtYXJrdXAgc3RyaW5nIG9yIGEgc2VsZWN0b3Igc3RyaW5nLCB0aGVuIGl0IG11c3QgYmUgYSB0ZW1wbGF0ZSBvYmplY3Rcblx0Ly8gSW4gdGhhdCBjYXNlLCBnZXQgaXQgZnJvbSB0aGUgbWFya3VwIHByb3BlcnR5IG9mIHRoZSBvYmplY3Rcblx0aWYgKCF0bXBsT3JNYXJrdXAgJiYgdG1wbC5tYXJrdXAgJiYgKHRtcGxPck1hcmt1cCA9IGxvb2t1cFRlbXBsYXRlKHRtcGwubWFya3VwKSkgJiYgdG1wbE9yTWFya3VwLmZuKSB7XG5cdFx0Ly8gSWYgdGhlIHN0cmluZyByZWZlcmVuY2VzIGEgY29tcGlsZWQgdGVtcGxhdGUgb2JqZWN0LCBuZWVkIHRvIHJlY29tcGlsZSB0byBtZXJnZSBhbnkgbW9kaWZpZWQgb3B0aW9uc1xuXHRcdHRtcGxPck1hcmt1cCA9IHRtcGxPck1hcmt1cC5tYXJrdXA7XG5cdH1cblx0aWYgKHRtcGxPck1hcmt1cCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRtcGxPck1hcmt1cC5yZW5kZXIgfHwgdG1wbC5yZW5kZXIpIHtcblx0XHRcdC8vIHRtcGwgaXMgYWxyZWFkeSBjb21waWxlZCwgc28gdXNlIGl0XG5cdFx0XHRpZiAodG1wbE9yTWFya3VwLnRtcGxzKSB7XG5cdFx0XHRcdGNvbXBpbGVkVG1wbCA9IHRtcGxPck1hcmt1cDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdG1wbE9yTWFya3VwIGlzIGEgbWFya3VwIHN0cmluZywgbm90IGEgY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdC8vIENyZWF0ZSB0ZW1wbGF0ZSBvYmplY3Rcblx0XHRcdHRtcGwgPSB0bXBsT2JqZWN0KHRtcGxPck1hcmt1cCwgb3B0aW9ucyk7XG5cdFx0XHQvLyBDb21waWxlIHRvIEFTVCBhbmQgdGhlbiB0byBjb21waWxlZCBmdW5jdGlvblxuXHRcdFx0dG1wbEZuKHRtcGxPck1hcmt1cC5yZXBsYWNlKHJFc2NhcGVRdW90ZXMsIFwiXFxcXCQmXCIpLCB0bXBsKTtcblx0XHR9XG5cdFx0aWYgKCFjb21waWxlZFRtcGwpIHtcblx0XHRcdGNvbXBpbGVkVG1wbCA9ICRleHRlbmQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb21waWxlZFRtcGwucmVuZGVyLmFwcGx5KGNvbXBpbGVkVG1wbCwgYXJndW1lbnRzKTtcblx0XHRcdH0sIHRtcGwpO1xuXG5cdFx0XHRjb21waWxlQ2hpbGRSZXNvdXJjZXMoY29tcGlsZWRUbXBsKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbXBpbGVkVG1wbDtcblx0fVxufVxuXG4vLz09PT0gL2VuZCBvZiBmdW5jdGlvbiBjb21waWxlVG1wbCA9PT09XG5cbi8vPT09PT09PT09PT09PT09PT1cbi8vIGNvbXBpbGVWaWV3TW9kZWxcbi8vPT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdFZhbChkZWZhdWx0VmFsLCBkYXRhKSB7XG5cdHJldHVybiAkaXNGdW5jdGlvbihkZWZhdWx0VmFsKVxuXHRcdD8gZGVmYXVsdFZhbC5jYWxsKGRhdGEpXG5cdFx0OiBkZWZhdWx0VmFsO1xufVxuXG5mdW5jdGlvbiBhZGRQYXJlbnRSZWYob2IsIHJlZiwgcGFyZW50KSB7XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYiwgcmVmLCB7XG5cdFx0dmFsdWU6IHBhcmVudCxcblx0XHRjb25maWd1cmFibGU6IHRydWVcblx0fSk7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVWaWV3TW9kZWwobmFtZSwgdHlwZSkge1xuXHR2YXIgaSwgY29uc3RydWN0b3IsIHBhcmVudCxcblx0XHR2aWV3TW9kZWxzID0gdGhpcyxcblx0XHRnZXR0ZXJzID0gdHlwZS5nZXR0ZXJzLFxuXHRcdGV4dGVuZCA9IHR5cGUuZXh0ZW5kLFxuXHRcdGlkID0gdHlwZS5pZCxcblx0XHRwcm90byA9ICQuZXh0ZW5kKHtcblx0XHRcdF9pczogbmFtZSB8fCBcInVubmFtZWRcIixcblx0XHRcdHVubWFwOiB1bm1hcCxcblx0XHRcdG1lcmdlOiBtZXJnZVxuXHRcdH0sIGV4dGVuZCksXG5cdFx0YXJncyA9IFwiXCIsXG5cdFx0Y25zdHIgPSBcIlwiLFxuXHRcdGdldHRlckNvdW50ID0gZ2V0dGVycyA/IGdldHRlcnMubGVuZ3RoIDogMCxcblx0XHQkb2JzZXJ2YWJsZSA9ICQub2JzZXJ2YWJsZSxcblx0XHRnZXR0ZXJOYW1lcyA9IHt9O1xuXG5cdGZ1bmN0aW9uIEpzdlZtKGFyZ3MpIHtcblx0XHRjb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmdzKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZtKCkge1xuXHRcdHJldHVybiBuZXcgSnN2Vm0oYXJndW1lbnRzKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGl0ZXJhdGUoZGF0YSwgYWN0aW9uKSB7XG5cdFx0dmFyIGdldHRlclR5cGUsIGRlZmF1bHRWYWwsIHByb3AsIG9iLCBwYXJlbnRSZWYsXG5cdFx0XHRqID0gMDtcblx0XHRmb3IgKDsgaiA8IGdldHRlckNvdW50OyBqKyspIHtcblx0XHRcdHByb3AgPSBnZXR0ZXJzW2pdO1xuXHRcdFx0Z2V0dGVyVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcm9wICsgXCJcIiAhPT0gcHJvcCkge1xuXHRcdFx0XHRnZXR0ZXJUeXBlID0gcHJvcDtcblx0XHRcdFx0cHJvcCA9IGdldHRlclR5cGUuZ2V0dGVyO1xuXHRcdFx0XHRwYXJlbnRSZWYgPSBnZXR0ZXJUeXBlLnBhcmVudFJlZjtcblx0XHRcdH1cblx0XHRcdGlmICgob2IgPSBkYXRhW3Byb3BdKSA9PT0gdW5kZWZpbmVkICYmIGdldHRlclR5cGUgJiYgKGRlZmF1bHRWYWwgPSBnZXR0ZXJUeXBlLmRlZmF1bHRWYWwpICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0b2IgPSBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0YWN0aW9uKG9iLCBnZXR0ZXJUeXBlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXSwgcHJvcCwgcGFyZW50UmVmKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBtYXAoZGF0YSkge1xuXHRcdGRhdGEgPSBkYXRhICsgXCJcIiA9PT0gZGF0YVxuXHRcdFx0PyBKU09OLnBhcnNlKGRhdGEpIC8vIEFjY2VwdCBKU09OIHN0cmluZ1xuXHRcdFx0OiBkYXRhOyAgICAgICAgICAgIC8vIG9yIG9iamVjdC9hcnJheVxuXHRcdHZhciBsLCBwcm9wLCBjaGlsZE9iLCBwYXJlbnRSZWYsXG5cdFx0XHRqID0gMCxcblx0XHRcdG9iID0gZGF0YSxcblx0XHRcdGFyciA9IFtdO1xuXG5cdFx0aWYgKCRpc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRkYXRhID0gZGF0YSB8fCBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdGZvciAoOyBqPGw7IGorKykge1xuXHRcdFx0XHRhcnIucHVzaCh0aGlzLm1hcChkYXRhW2pdKSk7XG5cdFx0XHR9XG5cdFx0XHRhcnIuX2lzID0gbmFtZTtcblx0XHRcdGFyci51bm1hcCA9IHVubWFwO1xuXHRcdFx0YXJyLm1lcmdlID0gbWVyZ2U7XG5cdFx0XHRyZXR1cm4gYXJyO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRpdGVyYXRlKGRhdGEsIGZ1bmN0aW9uKG9iLCB2aWV3TW9kZWwpIHtcblx0XHRcdFx0aWYgKHZpZXdNb2RlbCkgeyAvLyBJdGVyYXRlIHRvIGJ1aWxkIGdldHRlcnMgYXJnIGFycmF5ICh2YWx1ZSwgb3IgbWFwcGVkIHZhbHVlKVxuXHRcdFx0XHRcdG9iID0gdmlld01vZGVsLm1hcChvYik7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJyLnB1c2gob2IpO1xuXHRcdFx0fSk7XG5cdFx0XHRvYiA9IHRoaXMuYXBwbHkodGhpcywgYXJyKTsgLy8gSW5zdGFudGlhdGUgdGhpcyBWaWV3IE1vZGVsLCBwYXNzaW5nIGdldHRlcnMgYXJncyBhcnJheSB0byBjb25zdHJ1Y3RvclxuXHRcdFx0aiA9IGdldHRlckNvdW50O1xuXHRcdFx0d2hpbGUgKGotLSkge1xuXHRcdFx0XHRjaGlsZE9iID0gYXJyW2pdO1xuXHRcdFx0XHRwYXJlbnRSZWYgPSBnZXR0ZXJzW2pdLnBhcmVudFJlZjtcblx0XHRcdFx0aWYgKHBhcmVudFJlZiAmJiBjaGlsZE9iICYmIGNoaWxkT2IudW5tYXApIHtcblx0XHRcdFx0XHRpZiAoJGlzQXJyYXkoY2hpbGRPYikpIHtcblx0XHRcdFx0XHRcdGwgPSBjaGlsZE9iLmxlbmd0aDtcblx0XHRcdFx0XHRcdHdoaWxlIChsLS0pIHtcblx0XHRcdFx0XHRcdFx0YWRkUGFyZW50UmVmKGNoaWxkT2JbbF0sIHBhcmVudFJlZiwgb2IpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhZGRQYXJlbnRSZWYoY2hpbGRPYiwgcGFyZW50UmVmLCBvYik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKHByb3AgaW4gZGF0YSkgeyAvLyBDb3B5IG92ZXIgYW55IG90aGVyIHByb3BlcnRpZXMuIHRoYXQgYXJlIG5vdCBnZXQvc2V0IHByb3BlcnRpZXNcblx0XHRcdFx0aWYgKHByb3AgIT09ICRleHBhbmRvICYmICFnZXR0ZXJOYW1lc1twcm9wXSkge1xuXHRcdFx0XHRcdG9iW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRmdW5jdGlvbiBtZXJnZShkYXRhLCBwYXJlbnQsIHBhcmVudFJlZikge1xuXHRcdGRhdGEgPSBkYXRhICsgXCJcIiA9PT0gZGF0YVxuXHRcdFx0PyBKU09OLnBhcnNlKGRhdGEpIC8vIEFjY2VwdCBKU09OIHN0cmluZ1xuXHRcdFx0OiBkYXRhOyAgICAgICAgICAgIC8vIG9yIG9iamVjdC9hcnJheVxuXG5cdFx0dmFyIGosIGwsIG0sIHByb3AsIG1vZCwgZm91bmQsIGFzc2lnbmVkLCBvYiwgbmV3TW9kQXJyLCBjaGlsZE9iLFxuXHRcdFx0ayA9IDAsXG5cdFx0XHRtb2RlbCA9IHRoaXM7XG5cblx0XHRpZiAoJGlzQXJyYXkobW9kZWwpKSB7XG5cdFx0XHRhc3NpZ25lZCA9IHt9O1xuXHRcdFx0bmV3TW9kQXJyID0gW107XG5cdFx0XHRsID0gZGF0YS5sZW5ndGg7XG5cdFx0XHRtID0gbW9kZWwubGVuZ3RoO1xuXHRcdFx0Zm9yICg7IGs8bDsgaysrKSB7XG5cdFx0XHRcdG9iID0gZGF0YVtrXTtcblx0XHRcdFx0Zm91bmQgPSBmYWxzZTtcblx0XHRcdFx0Zm9yIChqPTA7IGo8bSAmJiAhZm91bmQ7IGorKykge1xuXHRcdFx0XHRcdGlmIChhc3NpZ25lZFtqXSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZCA9IG1vZGVsW2pdO1xuXG5cdFx0XHRcdFx0aWYgKGlkKSB7XG5cdFx0XHRcdFx0XHRhc3NpZ25lZFtqXSA9IGZvdW5kID0gaWQgKyBcIlwiID09PSBpZFxuXHRcdFx0XHRcdFx0PyAob2JbaWRdICYmIChnZXR0ZXJOYW1lc1tpZF0gPyBtb2RbaWRdKCkgOiBtb2RbaWRdKSA9PT0gb2JbaWRdKVxuXHRcdFx0XHRcdFx0OiBpZChtb2QsIG9iKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRcdFx0bW9kLm1lcmdlKG9iKTtcblx0XHRcdFx0XHRuZXdNb2RBcnIucHVzaChtb2QpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ld01vZEFyci5wdXNoKGNoaWxkT2IgPSB2bS5tYXAob2IpKTtcblx0XHRcdFx0XHRpZiAocGFyZW50UmVmKSB7XG5cdFx0XHRcdFx0XHRhZGRQYXJlbnRSZWYoY2hpbGRPYiwgcGFyZW50UmVmLCBwYXJlbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCRvYnNlcnZhYmxlKSB7XG5cdFx0XHRcdCRvYnNlcnZhYmxlKG1vZGVsKS5yZWZyZXNoKG5ld01vZEFyciwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb2RlbC5zcGxpY2UuYXBwbHkobW9kZWwsIFswLCBtb2RlbC5sZW5ndGhdLmNvbmNhdChuZXdNb2RBcnIpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aXRlcmF0ZShkYXRhLCBmdW5jdGlvbihvYiwgdmlld01vZGVsLCBnZXR0ZXIsIHBhcmVudFJlZikge1xuXHRcdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0XHRtb2RlbFtnZXR0ZXJdKCkubWVyZ2Uob2IsIG1vZGVsLCBwYXJlbnRSZWYpOyAvLyBVcGRhdGUgdHlwZWQgcHJvcGVydHlcblx0XHRcdH0gZWxzZSBpZiAobW9kZWxbZ2V0dGVyXSgpICE9PSBvYikge1xuXHRcdFx0XHRtb2RlbFtnZXR0ZXJdKG9iKTsgLy8gVXBkYXRlIG5vbi10eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGZvciAocHJvcCBpbiBkYXRhKSB7XG5cdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gJiYgIWdldHRlck5hbWVzW3Byb3BdKSB7XG5cdFx0XHRcdG1vZGVsW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiB1bm1hcCgpIHtcblx0XHR2YXIgb2IsIHByb3AsIGdldHRlclR5cGUsIGFyciwgdmFsdWUsXG5cdFx0XHRrID0gMCxcblx0XHRcdG1vZGVsID0gdGhpcztcblxuXHRcdGZ1bmN0aW9uIHVubWFwQXJyYXkobW9kZWxBcnIpIHtcblx0XHRcdHZhciBhcnIgPSBbXSxcblx0XHRcdFx0aSA9IDAsXG5cdFx0XHRcdGwgPSBtb2RlbEFyci5sZW5ndGg7XG5cdFx0XHRmb3IgKDsgaTxsOyBpKyspIHtcblx0XHRcdFx0YXJyLnB1c2gobW9kZWxBcnJbaV0udW5tYXAoKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYXJyO1xuXHRcdH1cblxuXHRcdGlmICgkaXNBcnJheShtb2RlbCkpIHtcblx0XHRcdHJldHVybiB1bm1hcEFycmF5KG1vZGVsKTtcblx0XHR9XG5cdFx0b2IgPSB7fTtcblx0XHRmb3IgKDsgayA8IGdldHRlckNvdW50OyBrKyspIHtcblx0XHRcdHByb3AgPSBnZXR0ZXJzW2tdO1xuXHRcdFx0Z2V0dGVyVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcm9wICsgXCJcIiAhPT0gcHJvcCkge1xuXHRcdFx0XHRnZXR0ZXJUeXBlID0gcHJvcDtcblx0XHRcdFx0cHJvcCA9IGdldHRlclR5cGUuZ2V0dGVyO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWUgPSBtb2RlbFtwcm9wXSgpO1xuXHRcdFx0b2JbcHJvcF0gPSBnZXR0ZXJUeXBlICYmIHZhbHVlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXVxuXHRcdFx0XHQ/ICRpc0FycmF5KHZhbHVlKVxuXHRcdFx0XHRcdD8gdW5tYXBBcnJheSh2YWx1ZSlcblx0XHRcdFx0XHQ6IHZhbHVlLnVubWFwKClcblx0XHRcdFx0OiB2YWx1ZTtcblx0XHR9XG5cdFx0Zm9yIChwcm9wIGluIG1vZGVsKSB7XG5cdFx0XHRpZiAobW9kZWwuaGFzT3duUHJvcGVydHkocHJvcCkgJiYgKHByb3AuY2hhckF0KDApICE9PSBcIl9cIiB8fCAhZ2V0dGVyTmFtZXNbcHJvcC5zbGljZSgxKV0pICYmIHByb3AgIT09ICRleHBhbmRvICAmJiAhJGlzRnVuY3Rpb24obW9kZWxbcHJvcF0pKSB7XG5cdFx0XHRcdG9iW3Byb3BdID0gbW9kZWxbcHJvcF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvYjtcblx0fVxuXG5cdEpzdlZtLnByb3RvdHlwZSA9IHByb3RvO1xuXG5cdGZvciAoaT0wOyBpIDwgZ2V0dGVyQ291bnQ7IGkrKykge1xuXHRcdChmdW5jdGlvbihnZXR0ZXIpIHtcblx0XHRcdGdldHRlciA9IGdldHRlci5nZXR0ZXIgfHwgZ2V0dGVyO1xuXHRcdFx0Z2V0dGVyTmFtZXNbZ2V0dGVyXSA9IGkrMTtcblx0XHRcdHZhciBwcml2RmllbGQgPSBcIl9cIiArIGdldHRlcjtcblxuXHRcdFx0YXJncyArPSAoYXJncyA/IFwiLFwiIDogXCJcIikgKyBnZXR0ZXI7XG5cdFx0XHRjbnN0ciArPSBcInRoaXMuXCIgKyBwcml2RmllbGQgKyBcIiA9IFwiICsgZ2V0dGVyICsgXCI7XFxuXCI7XG5cdFx0XHRwcm90b1tnZXR0ZXJdID0gcHJvdG9bZ2V0dGVyXSB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXNbcHJpdkZpZWxkXTsgLy8gSWYgdGhlcmUgaXMgbm8gYXJndW1lbnQsIHVzZSBhcyBhIGdldHRlclxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRcdCRvYnNlcnZhYmxlKHRoaXMpLnNldFByb3BlcnR5KGdldHRlciwgdmFsKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRwcm90b1tnZXR0ZXJdLnNldCA9IHByb3RvW2dldHRlcl0uc2V0IHx8IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0XHRcdHRoaXNbcHJpdkZpZWxkXSA9IHZhbDsgLy8gU2V0dGVyIGNhbGxlZCBieSBvYnNlcnZhYmxlIHByb3BlcnR5IGNoYW5nZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKGdldHRlcnNbaV0pO1xuXHR9XG5cblx0Ly8gQ29uc3RydWN0b3IgZm9yIG5ldyB2aWV3TW9kZWwgaW5zdGFuY2UuXG5cdGNuc3RyID0gbmV3IEZ1bmN0aW9uKGFyZ3MsIGNuc3RyKTtcblxuXHRjb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKCkge1xuXHRcdGNuc3RyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0Ly8gUGFzcyBhZGRpdGlvbmFsIHBhcmVudFJlZiBzdHIgYW5kIHBhcmVudCBvYmogdG8gaGF2ZSBhIHBhcmVudFJlZiBwb2ludGVyIG9uIGluc3RhbmNlXG5cdFx0aWYgKHBhcmVudCA9IGFyZ3VtZW50c1tnZXR0ZXJDb3VudCArIDFdKSB7XG5cdFx0XHRhZGRQYXJlbnRSZWYodGhpcywgYXJndW1lbnRzW2dldHRlckNvdW50XSwgcGFyZW50KTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3RydWN0b3IucHJvdG90eXBlID0gcHJvdG87XG5cdHByb3RvLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7XG5cblx0dm0ubWFwID0gbWFwO1xuXHR2bS5nZXR0ZXJzID0gZ2V0dGVycztcblx0dm0uZXh0ZW5kID0gZXh0ZW5kO1xuXHR2bS5pZCA9IGlkO1xuXHRyZXR1cm4gdm07XG59XG5cbmZ1bmN0aW9uIHRtcGxPYmplY3QobWFya3VwLCBvcHRpb25zKSB7XG5cdC8vIFRlbXBsYXRlIG9iamVjdCBjb25zdHJ1Y3RvclxuXHR2YXIgaHRtbFRhZyxcblx0XHR3cmFwTWFwID0gJHN1YlNldHRpbmdzQWR2YW5jZWQuX3dtIHx8IHt9LCAvLyBPbmx5IHVzZWQgaW4gSnNWaWV3cy4gT3RoZXJ3aXNlIGVtcHR5OiB7fVxuXHRcdHRtcGwgPSB7XG5cdFx0XHR0bXBsczogW10sXG5cdFx0XHRsaW5rczoge30sIC8vIENvbXBpbGVkIGZ1bmN0aW9ucyBmb3IgbGluayBleHByZXNzaW9uc1xuXHRcdFx0Ym5kczogW10sXG5cdFx0XHRfaXM6IFwidGVtcGxhdGVcIixcblx0XHRcdHJlbmRlcjogcmVuZGVyQ29udGVudFxuXHRcdH07XG5cblx0aWYgKG9wdGlvbnMpIHtcblx0XHR0bXBsID0gJGV4dGVuZCh0bXBsLCBvcHRpb25zKTtcblx0fVxuXG5cdHRtcGwubWFya3VwID0gbWFya3VwO1xuXHRpZiAoIXRtcGwuaHRtbFRhZykge1xuXHRcdC8vIFNldCB0bXBsLnRhZyB0byB0aGUgdG9wLWxldmVsIEhUTUwgdGFnIHVzZWQgaW4gdGhlIHRlbXBsYXRlLCBpZiBhbnkuLi5cblx0XHRodG1sVGFnID0gckZpcnN0RWxlbS5leGVjKG1hcmt1cCk7XG5cdFx0dG1wbC5odG1sVGFnID0gaHRtbFRhZyA/IGh0bWxUYWdbMV0udG9Mb3dlckNhc2UoKSA6IFwiXCI7XG5cdH1cblx0aHRtbFRhZyA9IHdyYXBNYXBbdG1wbC5odG1sVGFnXTtcblx0aWYgKGh0bWxUYWcgJiYgaHRtbFRhZyAhPT0gd3JhcE1hcC5kaXYpIHtcblx0XHQvLyBXaGVuIHVzaW5nIEpzVmlld3MsIHdlIHRyaW0gdGVtcGxhdGVzIHdoaWNoIGFyZSBpbnNlcnRlZCBpbnRvIEhUTUwgY29udGV4dHMgd2hlcmUgdGV4dCBub2RlcyBhcmUgbm90IHJlbmRlcmVkIChpLmUuIG5vdCAnUGhyYXNpbmcgQ29udGVudCcpLlxuXHRcdC8vIEN1cnJlbnRseSBub3QgdHJpbW1lZCBmb3IgPGxpPiB0YWcuIChOb3Qgd29ydGggYWRkaW5nIHBlcmYgY29zdClcblx0XHR0bXBsLm1hcmt1cCA9ICQudHJpbSh0bXBsLm1hcmt1cCk7XG5cdH1cblxuXHRyZXR1cm4gdG1wbDtcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gcmVnaXN0ZXJTdG9yZVxuLy89PT09PT09PT09PT09PVxuXG4vKipcbiogSW50ZXJuYWwuIFJlZ2lzdGVyIGEgc3RvcmUgdHlwZSAodXNlZCBmb3IgdGVtcGxhdGUsIHRhZ3MsIGhlbHBlcnMsIGNvbnZlcnRlcnMpXG4qL1xuZnVuY3Rpb24gcmVnaXN0ZXJTdG9yZShzdG9yZU5hbWUsIHN0b3JlU2V0dGluZ3MpIHtcblxuLyoqXG4qIEdlbmVyaWMgc3RvcmUoKSBmdW5jdGlvbiB0byByZWdpc3RlciBpdGVtLCBuYW1lZCBpdGVtLCBvciBoYXNoIG9mIGl0ZW1zXG4qIEFsc28gdXNlZCBhcyBoYXNoIHRvIHN0b3JlIHRoZSByZWdpc3RlcmVkIGl0ZW1zXG4qIFVzZWQgYXMgaW1wbGVtZW50YXRpb24gb2YgJC50ZW1wbGF0ZXMoKSwgJC52aWV3cy50ZW1wbGF0ZXMoKSwgJC52aWV3cy50YWdzKCksICQudmlld3MuaGVscGVycygpIGFuZCAkLnZpZXdzLmNvbnZlcnRlcnMoKVxuKlxuKiBAcGFyYW0ge3N0cmluZ3xoYXNofSBuYW1lICAgICAgICAgbmFtZSAtIG9yIHNlbGVjdG9yLCBpbiBjYXNlIG9mICQudGVtcGxhdGVzKCkuIE9yIGhhc2ggb2YgaXRlbXNcbiogQHBhcmFtIHthbnl9ICAgICAgICAgW2l0ZW1dICAgICAgIChlLmcuIG1hcmt1cCBmb3IgbmFtZWQgdGVtcGxhdGUpXG4qIEBwYXJhbSB7dGVtcGxhdGV9ICAgIFtwYXJlbnRUbXBsXSBGb3IgaXRlbSBiZWluZyByZWdpc3RlcmVkIGFzIHByaXZhdGUgcmVzb3VyY2Ugb2YgdGVtcGxhdGVcbiogQHJldHVybnMge2FueXwkLnZpZXdzfSBpdGVtLCBlLmcuIGNvbXBpbGVkIHRlbXBsYXRlIC0gb3IgJC52aWV3cyBpbiBjYXNlIG9mIHJlZ2lzdGVyaW5nIGhhc2ggb2YgaXRlbXNcbiovXG5cdGZ1bmN0aW9uIHRoZVN0b3JlKG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwpIHtcblx0XHQvLyBUaGUgc3RvcmUgaXMgYWxzbyB0aGUgZnVuY3Rpb24gdXNlZCB0byBhZGQgaXRlbXMgdG8gdGhlIHN0b3JlLiBlLmcuICQudGVtcGxhdGVzLCBvciAkLnZpZXdzLnRhZ3NcblxuXHRcdC8vIEZvciBzdG9yZSBvZiBuYW1lICd0aGluZycsIENhbGwgYXM6XG5cdFx0Ly8gICAgJC52aWV3cy50aGluZ3MoaXRlbXNbLCBwYXJlbnRUbXBsXSksXG5cdFx0Ly8gb3IgJC52aWV3cy50aGluZ3MobmFtZVssIGl0ZW0sIHBhcmVudFRtcGxdKVxuXG5cdFx0dmFyIGNvbXBpbGUsIGl0ZW1OYW1lLCB0aGlzU3RvcmUsIGNudCxcblx0XHRcdG9uU3RvcmUgPSAkc3ViLm9uU3RvcmVbc3RvcmVOYW1lXTtcblxuXHRcdGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSBPQkpFQ1QgJiYgIW5hbWUubm9kZVR5cGUgJiYgIW5hbWUubWFya3VwICYmICFuYW1lLmdldFRndCAmJiAhKHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIiAmJiBuYW1lLmdldHRlcnMgfHwgbmFtZS5leHRlbmQpKSB7XG5cdFx0XHQvLyBDYWxsIHRvICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXG5cdFx0XHQvLyBBZGRpbmcgaXRlbXMgdG8gdGhlIHN0b3JlXG5cdFx0XHQvLyBJZiBuYW1lIGlzIGEgaGFzaCwgdGhlbiBpdGVtIGlzIHBhcmVudFRtcGwuIEl0ZXJhdGUgb3ZlciBoYXNoIGFuZCBjYWxsIHN0b3JlIGZvciBrZXkuXG5cdFx0XHRmb3IgKGl0ZW1OYW1lIGluIG5hbWUpIHtcblx0XHRcdFx0dGhlU3RvcmUoaXRlbU5hbWUsIG5hbWVbaXRlbU5hbWVdLCBpdGVtKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtIHx8ICR2aWV3cztcblx0XHR9XG5cdFx0Ly8gQWRkaW5nIGEgc2luZ2xlIHVubmFtZWQgaXRlbSB0byB0aGUgc3RvcmVcblx0XHRpZiAobmFtZSAmJiBcIlwiICsgbmFtZSAhPT0gbmFtZSkgeyAvLyBuYW1lIG11c3QgYmUgYSBzdHJpbmdcblx0XHRcdHBhcmVudFRtcGwgPSBpdGVtO1xuXHRcdFx0aXRlbSA9IG5hbWU7XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzU3RvcmUgPSBwYXJlbnRUbXBsXG5cdFx0XHQ/IHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIlxuXHRcdFx0XHQ/IHBhcmVudFRtcGxcblx0XHRcdFx0OiAocGFyZW50VG1wbFtzdG9yZU5hbWVzXSA9IHBhcmVudFRtcGxbc3RvcmVOYW1lc10gfHwge30pXG5cdFx0XHQ6IHRoZVN0b3JlO1xuXHRcdGNvbXBpbGUgPSBzdG9yZVNldHRpbmdzLmNvbXBpbGU7XG5cblx0XHRpZiAoaXRlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpdGVtID0gY29tcGlsZSA/IG5hbWUgOiB0aGlzU3RvcmVbbmFtZV07XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0Ly8gSWYgaXRlbSBpcyBudWxsLCBkZWxldGUgdGhpcyBlbnRyeVxuXHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXNTdG9yZVtuYW1lXTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGNvbXBpbGUpIHtcblx0XHRcdFx0aXRlbSA9IGNvbXBpbGUuY2FsbCh0aGlzU3RvcmUsIG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwsIDApIHx8IHt9O1xuXHRcdFx0XHRpdGVtLl9pcyA9IHN0b3JlTmFtZTsgLy8gT25seSBkbyB0aGlzIGZvciBjb21waWxlZCBvYmplY3RzICh0YWdzLCB0ZW1wbGF0ZXMuLi4pXG5cdFx0XHR9XG5cdFx0XHRpZiAobmFtZSkge1xuXHRcdFx0XHR0aGlzU3RvcmVbbmFtZV0gPSBpdGVtO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAob25TdG9yZSkge1xuXHRcdFx0Ly8gZS5nLiBKc1ZpZXdzIGludGVncmF0aW9uXG5cdFx0XHRvblN0b3JlKG5hbWUsIGl0ZW0sIHBhcmVudFRtcGwsIGNvbXBpbGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gaXRlbTtcblx0fVxuXG5cdHZhciBzdG9yZU5hbWVzID0gc3RvcmVOYW1lICsgXCJzXCI7XG5cdCR2aWV3c1tzdG9yZU5hbWVzXSA9IHRoZVN0b3JlO1xufVxuXG4vKipcbiogQWRkIHNldHRpbmdzIHN1Y2ggYXM6XG4qICQudmlld3Muc2V0dGluZ3MuYWxsb3dDb2RlKHRydWUpXG4qIEBwYXJhbSB7Ym9vbGVhbn0gIHZhbHVlXG4qIEByZXR1cm5zIHtTZXR0aW5nc31cbipcbiogYWxsb3dDb2RlID0gJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUoKVxuKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiovXG5mdW5jdGlvbiBhZGRTZXR0aW5nKHN0KSB7XG5cdCR2aWV3c1NldHRpbmdzW3N0XSA9ICR2aWV3c1NldHRpbmdzW3N0XSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdHJldHVybiBhcmd1bWVudHMubGVuZ3RoXG5cdFx0XHQ/ICgkc3ViU2V0dGluZ3Nbc3RdID0gdmFsdWUsICR2aWV3c1NldHRpbmdzKVxuXHRcdFx0OiAkc3ViU2V0dGluZ3Nbc3RdO1xuXHR9O1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gZGF0YU1hcCBmb3IgcmVuZGVyIG9ubHlcbi8vPT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGRhdGFNYXAobWFwRGVmKSB7XG5cdGZ1bmN0aW9uIE1hcChzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHR0aGlzLnRndCA9IG1hcERlZi5nZXRUZ3Qoc291cmNlLCBvcHRpb25zKTtcblx0XHRvcHRpb25zLm1hcCA9IHRoaXM7XG5cdH1cblxuXHRpZiAoJGlzRnVuY3Rpb24obWFwRGVmKSkge1xuXHRcdC8vIFNpbXBsZSBtYXAgZGVjbGFyZWQgYXMgZnVuY3Rpb25cblx0XHRtYXBEZWYgPSB7XG5cdFx0XHRnZXRUZ3Q6IG1hcERlZlxuXHRcdH07XG5cdH1cblxuXHRpZiAobWFwRGVmLmJhc2VNYXApIHtcblx0XHRtYXBEZWYgPSAkZXh0ZW5kKCRleHRlbmQoe30sIG1hcERlZi5iYXNlTWFwKSwgbWFwRGVmKTtcblx0fVxuXG5cdG1hcERlZi5tYXAgPSBmdW5jdGlvbihzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gbmV3IE1hcChzb3VyY2UsIG9wdGlvbnMpO1xuXHR9O1xuXHRyZXR1cm4gbWFwRGVmO1xufVxuXG4vLz09PT09PT09PT09PT09XG4vLyByZW5kZXJDb250ZW50XG4vLz09PT09PT09PT09PT09XG5cbi8qKiBSZW5kZXIgdGhlIHRlbXBsYXRlIGFzIGEgc3RyaW5nLCB1c2luZyB0aGUgc3BlY2lmaWVkIGRhdGEgYW5kIGhlbHBlcnMvY29udGV4dFxuKiAkKFwiI3RtcGxcIikucmVuZGVyKCksIHRtcGwucmVuZGVyKCksIHRhZ0N0eC5yZW5kZXIoKSwgJC5yZW5kZXIubmFtZWRUbXBsKClcbipcbiogQHBhcmFtIHthbnl9ICAgICAgICBkYXRhXG4qIEBwYXJhbSB7aGFzaH0gICAgICAgW2NvbnRleHRdICAgICAgICAgICBoZWxwZXJzIG9yIGNvbnRleHRcbiogQHBhcmFtIHtib29sZWFufSAgICBbbm9JdGVyYXRpb25dXG4qIEBwYXJhbSB7Vmlld30gICAgICAgW3BhcmVudFZpZXddICAgICAgICBpbnRlcm5hbFxuKiBAcGFyYW0ge3N0cmluZ30gICAgIFtrZXldICAgICAgICAgICAgICAgaW50ZXJuYWxcbiogQHBhcmFtIHtmdW5jdGlvbn0gICBbb25SZW5kZXJdICAgICAgICAgIGludGVybmFsXG4qIEByZXR1cm5zIHtzdHJpbmd9ICAgcmVuZGVyZWQgdGVtcGxhdGUgICBpbnRlcm5hbFxuKi9cbmZ1bmN0aW9uIHJlbmRlckNvbnRlbnQoZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24sIHBhcmVudFZpZXcsIGtleSwgb25SZW5kZXIpIHtcblx0dmFyIGksIGwsIHRhZywgdG1wbCwgdGFnQ3R4LCBpc1RvcFJlbmRlckNhbGwsIHByZXZEYXRhLCBwcmV2SW5kZXgsXG5cdFx0dmlldyA9IHBhcmVudFZpZXcsXG5cdFx0cmVzdWx0ID0gXCJcIjtcblxuXHRpZiAoY29udGV4dCA9PT0gdHJ1ZSkge1xuXHRcdG5vSXRlcmF0aW9uID0gY29udGV4dDsgLy8gcGFzc2luZyBib29sZWFuIGFzIHNlY29uZCBwYXJhbSAtIG5vSXRlcmF0aW9uXG5cdFx0Y29udGV4dCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICh0eXBlb2YgY29udGV4dCAhPT0gT0JKRUNUKSB7XG5cdFx0Y29udGV4dCA9IHVuZGVmaW5lZDsgLy8gY29udGV4dCBtdXN0IGJlIGEgYm9vbGVhbiAobm9JdGVyYXRpb24pIG9yIGEgcGxhaW4gb2JqZWN0XG5cdH1cblxuXHRpZiAodGFnID0gdGhpcy50YWcpIHtcblx0XHQvLyBUaGlzIGlzIGEgY2FsbCBmcm9tIHJlbmRlclRhZyBvciB0YWdDdHgucmVuZGVyKC4uLilcblx0XHR0YWdDdHggPSB0aGlzO1xuXHRcdHZpZXcgPSB2aWV3IHx8IHRhZ0N0eC52aWV3O1xuXHRcdHRtcGwgPSB2aWV3Ll9nZXRUbXBsKHRhZy50ZW1wbGF0ZSB8fCB0YWdDdHgudG1wbCk7XG5cdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRkYXRhID0gdGFnLmNvbnRlbnRDdHggJiYgJGlzRnVuY3Rpb24odGFnLmNvbnRlbnRDdHgpXG5cdFx0XHRcdD8gZGF0YSA9IHRhZy5jb250ZW50Q3R4KGRhdGEpXG5cdFx0XHRcdDogdmlldzsgLy8gRGVmYXVsdCBkYXRhIGNvbnRleHQgZm9yIHdyYXBwZWQgYmxvY2sgY29udGVudCBpcyB0aGUgZmlyc3QgYXJndW1lbnRcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gVGhpcyBpcyBhIHRlbXBsYXRlLnJlbmRlciguLi4pIGNhbGxcblx0XHR0bXBsID0gdGhpcztcblx0fVxuXG5cdGlmICh0bXBsKSB7XG5cdFx0aWYgKCFwYXJlbnRWaWV3ICYmIGRhdGEgJiYgZGF0YS5faXMgPT09IFwidmlld1wiKSB7XG5cdFx0XHR2aWV3ID0gZGF0YTsgLy8gV2hlbiBwYXNzaW5nIGluIGEgdmlldyB0byByZW5kZXIgb3IgbGluayAoYW5kIG5vdCBwYXNzaW5nIGluIGEgcGFyZW50IHZpZXcpIHVzZSB0aGUgcGFzc2VkLWluIHZpZXcgYXMgcGFyZW50Vmlld1xuXHRcdH1cblxuXHRcdGlmICh2aWV3ICYmIGRhdGEgPT09IHZpZXcpIHtcblx0XHRcdC8vIEluaGVyaXQgdGhlIGRhdGEgZnJvbSB0aGUgcGFyZW50IHZpZXcuXG5cdFx0XHRkYXRhID0gdmlldy5kYXRhO1xuXHRcdH1cblxuXHRcdGlzVG9wUmVuZGVyQ2FsbCA9ICF2aWV3O1xuXHRcdGlzUmVuZGVyQ2FsbCA9IGlzUmVuZGVyQ2FsbCB8fCBpc1RvcFJlbmRlckNhbGw7XG5cdFx0aWYgKCF2aWV3KSB7XG5cdFx0XHQoY29udGV4dCA9IGNvbnRleHQgfHwge30pLnJvb3QgPSBkYXRhOyAvLyBQcm92aWRlIH5yb290IGFzIHNob3J0Y3V0IHRvIHRvcC1sZXZlbCBkYXRhLlxuXHRcdH1cblx0XHRpZiAoIWlzUmVuZGVyQ2FsbCB8fCAkc3ViU2V0dGluZ3NBZHZhbmNlZC51c2VWaWV3cyB8fCB0bXBsLnVzZVZpZXdzIHx8IHZpZXcgJiYgdmlldyAhPT0gdG9wVmlldykge1xuXHRcdFx0cmVzdWx0ID0gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCB2aWV3LCBrZXksIG9uUmVuZGVyLCB0YWcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmlldykgeyAvLyBJbiBhIGJsb2NrXG5cdFx0XHRcdHByZXZEYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0XHRwcmV2SW5kZXggPSB2aWV3LmluZGV4O1xuXHRcdFx0XHR2aWV3LmluZGV4ID0gaW5kZXhTdHI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aWV3ID0gdG9wVmlldztcblx0XHRcdFx0cHJldkRhdGEgPSB2aWV3LmRhdGE7XG5cdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdHZpZXcuY3R4ID0gY29udGV4dDtcblx0XHRcdH1cblx0XHRcdGlmICgkaXNBcnJheShkYXRhKSAmJiAhbm9JdGVyYXRpb24pIHtcblx0XHRcdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3IgdGhlIGFycmF5LCB3aG9zZSBjaGlsZCB2aWV3cyBjb3JyZXNwb25kIHRvIGVhY2ggZGF0YSBpdGVtLiAoTm90ZTogaWYga2V5IGFuZCBwYXJlbnRWaWV3IGFyZSBwYXNzZWQgaW5cblx0XHRcdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHBhcmVudFZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRcdFx0Zm9yIChpID0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdFx0XHRcdFx0dmlldy5pbmRleCA9IGk7XG5cdFx0XHRcdFx0dmlldy5kYXRhID0gZGF0YVtpXTtcblx0XHRcdFx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhW2ldLCB2aWV3LCAkc3ViKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmlldy5kYXRhID0gZGF0YTtcblx0XHRcdFx0cmVzdWx0ICs9IHRtcGwuZm4oZGF0YSwgdmlldywgJHN1Yik7XG5cdFx0XHR9XG5cdFx0XHR2aWV3LmRhdGEgPSBwcmV2RGF0YTtcblx0XHRcdHZpZXcuaW5kZXggPSBwcmV2SW5kZXg7XG5cdFx0fVxuXHRcdGlmIChpc1RvcFJlbmRlckNhbGwpIHtcblx0XHRcdGlzUmVuZGVyQ2FsbCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCB2aWV3LCBrZXksIG9uUmVuZGVyLCB0YWcpIHtcblx0Ly8gUmVuZGVyIHRlbXBsYXRlIGFnYWluc3QgZGF0YSBhcyBhIHRyZWUgb2Ygc3Vidmlld3MgKG5lc3RlZCByZW5kZXJlZCB0ZW1wbGF0ZSBpbnN0YW5jZXMpLCBvciBhcyBhIHN0cmluZyAodG9wLWxldmVsIHRlbXBsYXRlKS5cblx0Ly8gSWYgdGhlIGRhdGEgaXMgdGhlIHBhcmVudCB2aWV3LCB0cmVhdCBhcyBub0l0ZXJhdGlvbiwgcmUtcmVuZGVyIHdpdGggdGhlIHNhbWUgZGF0YSBjb250ZXh0LlxuXHQvLyB0bXBsIGNhbiBiZSBhIHN0cmluZyAoZS5nLiByZW5kZXJlZCBieSBhIHRhZy5yZW5kZXIoKSBtZXRob2QpLCBvciBhIGNvbXBpbGVkIHRlbXBsYXRlLlxuXHR2YXIgaSwgbCwgbmV3VmlldywgY2hpbGRWaWV3LCBpdGVtUmVzdWx0LCBzd2FwQ29udGVudCwgY29udGVudFRtcGwsIG91dGVyT25SZW5kZXIsIHRtcGxOYW1lLCBpdGVtVmFyLCBuZXdDdHgsIHRhZ0N0eCwgbm9MaW5raW5nLFxuXHRcdHJlc3VsdCA9IFwiXCI7XG5cblx0aWYgKHRhZykge1xuXHRcdC8vIFRoaXMgaXMgYSBjYWxsIGZyb20gcmVuZGVyVGFnIG9yIHRhZ0N0eC5yZW5kZXIoLi4uKVxuXHRcdHRtcGxOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4ID0gdGFnLnRhZ0N0eDtcblx0XHRjb250ZXh0ID0gY29udGV4dCA/IGV4dGVuZEN0eChjb250ZXh0LCB0YWcuY3R4KSA6IHRhZy5jdHg7XG5cblx0XHRpZiAodG1wbCA9PT0gdmlldy5jb250ZW50KSB7IC8vIHt7eHh4IHRtcGw9I2NvbnRlbnR9fVxuXHRcdFx0Y29udGVudFRtcGwgPSB0bXBsICE9PSB2aWV3LmN0eC5fd3JwIC8vIFdlIGFyZSByZW5kZXJpbmcgdGhlICNjb250ZW50XG5cdFx0XHRcdD8gdmlldy5jdHguX3dycCAvLyAjY29udGVudCB3YXMgdGhlIHRhZ0N0eC5wcm9wcy50bXBsIHdyYXBwZXIgb2YgdGhlIGJsb2NrIGNvbnRlbnQgLSBzbyB3aXRoaW4gdGhpcyB2aWV3LCAjY29udGVudCB3aWxsIG5vdyBiZSB0aGUgdmlldy5jdHguX3dycCBibG9jayBjb250ZW50XG5cdFx0XHRcdDogdW5kZWZpbmVkOyAvLyAjY29udGVudCB3YXMgdGhlIHZpZXcuY3R4Ll93cnAgYmxvY2sgY29udGVudCAtIHNvIHdpdGhpbiB0aGlzIHZpZXcsIHRoZXJlIGlzIG5vIGxvbmdlciBhbnkgI2NvbnRlbnQgdG8gd3JhcC5cblx0XHR9IGVsc2UgaWYgKHRtcGwgIT09IHRhZ0N0eC5jb250ZW50KSB7XG5cdFx0XHRpZiAodG1wbCA9PT0gdGFnLnRlbXBsYXRlKSB7IC8vIFJlbmRlcmluZyB7e3RhZ319IHRhZy50ZW1wbGF0ZSwgcmVwbGFjaW5nIGJsb2NrIGNvbnRlbnQuXG5cdFx0XHRcdGNvbnRlbnRUbXBsID0gdGFnQ3R4LnRtcGw7IC8vIFNldCAjY29udGVudCB0byBibG9jayBjb250ZW50IChvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaWYgdGFnQ3R4LnByb3BzLnRtcGwgaXMgc2V0KVxuXHRcdFx0XHRjb250ZXh0Ll93cnAgPSB0YWdDdHguY29udGVudDsgLy8gUGFzcyB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgdG8gbmVzdGVkIHZpZXdzXG5cdFx0XHR9IGVsc2UgeyAvLyBSZW5kZXJpbmcgdGFnQ3R4LnByb3BzLnRtcGwgd3JhcHBlclxuXHRcdFx0XHRjb250ZW50VG1wbCA9IHRhZ0N0eC5jb250ZW50IHx8IHZpZXcuY29udGVudDsgLy8gU2V0ICNjb250ZW50IHRvIHdyYXBwZWQgYmxvY2sgY29udGVudFxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50VG1wbCA9IHZpZXcuY29udGVudDsgLy8gTmVzdGVkIHZpZXdzIGluaGVyaXQgc2FtZSB3cmFwcGVkICNjb250ZW50IHByb3BlcnR5XG5cdFx0fVxuXG5cdFx0aWYgKHRhZ0N0eC5wcm9wcy5saW5rID09PSBmYWxzZSkge1xuXHRcdFx0Ly8gbGluaz1mYWxzZSBzZXR0aW5nIG9uIGJsb2NrIHRhZ1xuXHRcdFx0Ly8gV2Ugd2lsbCBvdmVycmlkZSBpbmhlcml0ZWQgdmFsdWUgb2YgbGluayBieSB0aGUgZXhwbGljaXQgc2V0dGluZyBsaW5rPWZhbHNlIHRha2VuIGZyb20gcHJvcHNcblx0XHRcdC8vIFRoZSBjaGlsZCB2aWV3cyBvZiBhbiB1bmxpbmtlZCB2aWV3IGFyZSBhbHNvIHVubGlua2VkLiBTbyBzZXR0aW5nIGNoaWxkIGJhY2sgdG8gdHJ1ZSB3aWxsIG5vdCBoYXZlIGFueSBlZmZlY3QuXG5cdFx0XHRjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcblx0XHRcdGNvbnRleHQubGluayA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGlmICh2aWV3KSB7XG5cdFx0b25SZW5kZXIgPSBvblJlbmRlciB8fCB2aWV3Ll8ub25SZW5kZXI7XG5cdFx0bm9MaW5raW5nID0gY29udGV4dCAmJiBjb250ZXh0LmxpbmsgPT09IGZhbHNlO1xuXG5cdFx0aWYgKG5vTGlua2luZyAmJiB2aWV3Ll8ubmwpIHtcblx0XHRcdG9uUmVuZGVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnRleHQgPSBleHRlbmRDdHgoY29udGV4dCwgdmlldy5jdHgpO1xuXHRcdHRhZ0N0eCA9ICF0YWcgJiYgdmlldy50YWdcblx0XHRcdD8gdmlldy50YWcudGFnQ3R4c1t2aWV3LnRhZ0Vsc2VdXG5cdFx0XHQ6IHRhZ0N0eDtcblx0fVxuXG5cdGlmIChpdGVtVmFyID0gdGFnQ3R4ICYmIHRhZ0N0eC5wcm9wcy5pdGVtVmFyKSB7XG5cdFx0aWYgKGl0ZW1WYXJbMF0gIT09IFwiflwiKSB7XG5cdFx0XHRzeW50YXhFcnJvcihcIlVzZSBpdGVtVmFyPSd+bXlJdGVtJ1wiKTtcblx0XHR9XG5cdFx0aXRlbVZhciA9IGl0ZW1WYXIuc2xpY2UoMSk7XG5cdH1cblxuXHRpZiAoa2V5ID09PSB0cnVlKSB7XG5cdFx0c3dhcENvbnRlbnQgPSB0cnVlO1xuXHRcdGtleSA9IDA7XG5cdH1cblxuXHQvLyBJZiBsaW5rPT09ZmFsc2UsIGRvIG5vdCBjYWxsIG9uUmVuZGVyLCBzbyBubyBkYXRhLWxpbmtpbmcgbWFya2VyIG5vZGVzXG5cdGlmIChvblJlbmRlciAmJiB0YWcgJiYgdGFnLl8ubm9Wd3MpIHtcblx0XHRvblJlbmRlciA9IHVuZGVmaW5lZDtcblx0fVxuXHRvdXRlck9uUmVuZGVyID0gb25SZW5kZXI7XG5cdGlmIChvblJlbmRlciA9PT0gdHJ1ZSkge1xuXHRcdC8vIFVzZWQgYnkgdmlldy5yZWZyZXNoKCkuIERvbid0IGNyZWF0ZSBhIG5ldyB3cmFwcGVyIHZpZXcuXG5cdFx0b3V0ZXJPblJlbmRlciA9IHVuZGVmaW5lZDtcblx0XHRvblJlbmRlciA9IHZpZXcuXy5vblJlbmRlcjtcblx0fVxuXHQvLyBTZXQgYWRkaXRpb25hbCBjb250ZXh0IG9uIHZpZXdzIGNyZWF0ZWQgaGVyZSwgKGFzIG1vZGlmaWVkIGNvbnRleHQgaW5oZXJpdGVkIGZyb20gdGhlIHBhcmVudCwgYW5kIHRvIGJlIGluaGVyaXRlZCBieSBjaGlsZCB2aWV3cylcblx0Y29udGV4dCA9IHRtcGwuaGVscGVyc1xuXHRcdD8gZXh0ZW5kQ3R4KHRtcGwuaGVscGVycywgY29udGV4dClcblx0XHQ6IGNvbnRleHQ7XG5cblx0bmV3Q3R4ID0gY29udGV4dDtcblx0aWYgKCRpc0FycmF5KGRhdGEpICYmICFub0l0ZXJhdGlvbikge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgdmlldyBhcmUgcGFzc2VkIGluXG5cdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRuZXdWaWV3ID0gc3dhcENvbnRlbnRcblx0XHRcdD8gdmlld1xuXHRcdFx0OiAoa2V5ICE9PSB1bmRlZmluZWQgJiYgdmlldylcblx0XHRcdFx0fHwgbmV3IFZpZXcoY29udGV4dCwgXCJhcnJheVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cdFx0bmV3Vmlldy5fLm5sPSBub0xpbmtpbmc7XG5cdFx0aWYgKHZpZXcgJiYgdmlldy5fLnVzZUtleSkge1xuXHRcdFx0Ly8gUGFyZW50IGlzIG5vdCBhbiAnYXJyYXkgdmlldydcblx0XHRcdG5ld1ZpZXcuXy5ibmQgPSAhdGFnIHx8IHRhZy5fLmJuZCAmJiB0YWc7IC8vIEZvciBhcnJheSB2aWV3cyB0aGF0IGFyZSBkYXRhIGJvdW5kIGZvciBjb2xsZWN0aW9uIGNoYW5nZSBldmVudHMsIHNldCB0aGVcblx0XHRcdC8vIHZpZXcuXy5ibmQgcHJvcGVydHkgdG8gdHJ1ZSBmb3IgdG9wLWxldmVsIGxpbmsoKSBvciBkYXRhLWxpbms9XCJ7Zm9yfVwiLCBvciB0byB0aGUgdGFnIGluc3RhbmNlIGZvciBhIGRhdGEtYm91bmQgdGFnLCBlLmcuIHtee2ZvciAuLi59fVxuXHRcdFx0bmV3Vmlldy50YWcgPSB0YWc7XG5cdFx0fVxuXHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0Ly8gQ3JlYXRlIGEgdmlldyBmb3IgZWFjaCBkYXRhIGl0ZW0uXG5cdFx0XHRjaGlsZFZpZXcgPSBuZXcgVmlldyhuZXdDdHgsIFwiaXRlbVwiLCBuZXdWaWV3LCBkYXRhW2ldLCB0bXBsLCAoa2V5IHx8IDApICsgaSwgb25SZW5kZXIsIG5ld1ZpZXcuY29udGVudCk7XG5cdFx0XHRpZiAoaXRlbVZhcikge1xuXHRcdFx0XHQoY2hpbGRWaWV3LmN0eCA9ICRleHRlbmQoe30sIG5ld0N0eCkpW2l0ZW1WYXJdID0gJHN1Yi5fY3AoZGF0YVtpXSwgXCIjZGF0YVwiLCBjaGlsZFZpZXcpO1xuXHRcdFx0fVxuXHRcdFx0aXRlbVJlc3VsdCA9IHRtcGwuZm4oZGF0YVtpXSwgY2hpbGRWaWV3LCAkc3ViKTtcblx0XHRcdHJlc3VsdCArPSBuZXdWaWV3Ll8ub25SZW5kZXIgPyBuZXdWaWV3Ll8ub25SZW5kZXIoaXRlbVJlc3VsdCwgY2hpbGRWaWV3KSA6IGl0ZW1SZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHNpbmdsZXRvbiBkYXRhIG9iamVjdC4gVGhlIHR5cGUgb2YgdGhlIHZpZXcgd2lsbCBiZSB0aGUgdGFnIG5hbWUsIGUuZy4gXCJpZlwiIG9yIFwibXl0YWdcIiBleGNlcHQgZm9yXG5cdFx0Ly8gXCJpdGVtXCIsIFwiYXJyYXlcIiBhbmQgXCJkYXRhXCIgdmlld3MuIEEgXCJkYXRhXCIgdmlldyBpcyBmcm9tIHByb2dyYW1tYXRpYyByZW5kZXIob2JqZWN0KSBhZ2FpbnN0IGEgJ3NpbmdsZXRvbicuXG5cdFx0bmV3VmlldyA9IHN3YXBDb250ZW50ID8gdmlldyA6IG5ldyBWaWV3KG5ld0N0eCwgdG1wbE5hbWUgfHwgXCJkYXRhXCIsIHZpZXcsIGRhdGEsIHRtcGwsIGtleSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKTtcblxuXHRcdGlmIChpdGVtVmFyKSB7XG5cdFx0XHQobmV3Vmlldy5jdHggPSAkZXh0ZW5kKHt9LCBuZXdDdHgpKVtpdGVtVmFyXSA9ICRzdWIuX2NwKGRhdGEsIFwiI2RhdGFcIiwgbmV3Vmlldyk7XG5cdFx0fVxuXG5cdFx0bmV3Vmlldy50YWcgPSB0YWc7XG5cdFx0bmV3Vmlldy5fLm5sID0gbm9MaW5raW5nO1xuXHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGEsIG5ld1ZpZXcsICRzdWIpO1xuXHR9XG5cdGlmICh0YWcpIHtcblx0XHRuZXdWaWV3LnRhZ0Vsc2UgPSB0YWdDdHguaW5kZXg7XG5cdFx0dGFnQ3R4LmNvbnRlbnRWaWV3ID0gbmV3Vmlldztcblx0fVxuXHRyZXR1cm4gb3V0ZXJPblJlbmRlciA/IG91dGVyT25SZW5kZXIocmVzdWx0LCBuZXdWaWV3KSA6IHJlc3VsdDtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEJ1aWxkIGFuZCBjb21waWxlIHRlbXBsYXRlXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBHZW5lcmF0ZSBhIHJldXNhYmxlIGZ1bmN0aW9uIHRoYXQgd2lsbCBzZXJ2ZSB0byByZW5kZXIgYSB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGFcbi8vIChDb21waWxlIEFTVCB0aGVuIGJ1aWxkIHRlbXBsYXRlIGZ1bmN0aW9uKVxuXG5mdW5jdGlvbiBvblJlbmRlckVycm9yKGUsIHZpZXcsIGZhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlID0gZmFsbGJhY2sgIT09IHVuZGVmaW5lZFxuXHRcdD8gJGlzRnVuY3Rpb24oZmFsbGJhY2spXG5cdFx0XHQ/IGZhbGxiYWNrLmNhbGwodmlldy5kYXRhLCBlLCB2aWV3KVxuXHRcdFx0OiBmYWxsYmFjayB8fCBcIlwiXG5cdFx0OiBcIntFcnJvcjogXCIgKyAoZS5tZXNzYWdlfHxlKSArIFwifVwiO1xuXG5cdGlmICgkc3ViU2V0dGluZ3Mub25FcnJvciAmJiAoZmFsbGJhY2sgPSAkc3ViU2V0dGluZ3Mub25FcnJvci5jYWxsKHZpZXcuZGF0YSwgZSwgZmFsbGJhY2sgJiYgbWVzc2FnZSwgdmlldykpICE9PSB1bmRlZmluZWQpIHtcblx0XHRtZXNzYWdlID0gZmFsbGJhY2s7IC8vIFRoZXJlIGlzIGEgc2V0dGluZ3MuZGVidWdNb2RlKGhhbmRsZXIpIG9uRXJyb3Igb3ZlcnJpZGUuIENhbGwgaXQsIGFuZCB1c2UgcmV0dXJuIHZhbHVlIChpZiBhbnkpIHRvIHJlcGxhY2UgbWVzc2FnZVxuXHR9XG5cdHJldHVybiB2aWV3ICYmICF2aWV3Ll9sYyA/ICRjb252ZXJ0ZXJzLmh0bWwobWVzc2FnZSkgOiBtZXNzYWdlOyAvLyBGb3IgZGF0YS1saW5rPVxcXCJ7Li4uIG9uRXJyb3I9Li4ufVwiLi4uIFNlZSBvbkRhdGFMaW5rZWRUYWdDaGFuZ2Vcbn1cblxuZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuXHR0aHJvdyBuZXcgJHN1Yi5FcnIobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIHN5bnRheEVycm9yKG1lc3NhZ2UpIHtcblx0ZXJyb3IoXCJTeW50YXggZXJyb3JcXG5cIiArIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiB0bXBsRm4obWFya3VwLCB0bXBsLCBpc0xpbmtFeHByLCBjb252ZXJ0QmFjaywgaGFzRWxzZSkge1xuXHQvLyBDb21waWxlIG1hcmt1cCB0byBBU1QgKGFidHJhY3Qgc3ludGF4IHRyZWUpIHRoZW4gYnVpbGQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGNvZGUgZnJvbSB0aGUgQVNUIG5vZGVzXG5cdC8vIFVzZWQgZm9yIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGFuZCBhbHNvIGJ5IEpzVmlld3MgdG8gYnVpbGQgZnVuY3Rpb25zIGZvciBkYXRhIGxpbmsgZXhwcmVzc2lvbnNcblxuXHQvLz09PT0gbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cdGZ1bmN0aW9uIHB1c2hwcmVjZWRpbmdDb250ZW50KHNoaWZ0KSB7XG5cdFx0c2hpZnQgLT0gbG9jO1xuXHRcdGlmIChzaGlmdCkge1xuXHRcdFx0Y29udGVudC5wdXNoKG1hcmt1cC5zdWJzdHIobG9jLCBzaGlmdCkucmVwbGFjZShyTmV3TGluZSwgXCJcXFxcblwiKSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYmxvY2tUYWdDaGVjayh0YWdOYW1lLCBibG9jaykge1xuXHRcdGlmICh0YWdOYW1lKSB7XG5cdFx0XHR0YWdOYW1lICs9ICd9fSc7XG5cdFx0XHQvL1x0XHRcdCd7e2luY2x1ZGV9fSBibG9jayBoYXMge3svZm9yfX0gd2l0aCBubyBvcGVuIHt7Zm9yfX0nXG5cdFx0XHRzeW50YXhFcnJvcigoXG5cdFx0XHRcdGJsb2NrXG5cdFx0XHRcdFx0PyAne3snICsgYmxvY2sgKyAnfX0gYmxvY2sgaGFzIHt7LycgKyB0YWdOYW1lICsgJyB3aXRob3V0IHt7JyArIHRhZ05hbWVcblx0XHRcdFx0XHQ6ICdVbm1hdGNoZWQgb3IgbWlzc2luZyB7ey8nICsgdGFnTmFtZSkgKyAnLCBpbiB0ZW1wbGF0ZTpcXG4nICsgbWFya3VwKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVRhZyhhbGwsIGJpbmQsIHRhZ05hbWUsIGNvbnZlcnRlciwgY29sb24sIGh0bWwsIGNvZGVUYWcsIHBhcmFtcywgc2xhc2gsIGJpbmQyLCBjbG9zZUJsb2NrLCBpbmRleCkge1xuLypcblxuICAgICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcbi8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19L2dcblxuKD86XG4gIHsoXFxeKT97ICAgICAgICAgICAgYmluZFxuICAoPzpcbiAgICAoXFx3KyAgICAgICAgICAgICB0YWdOYW1lXG4gICAgICAoPz1bXFwvXFxzfV0pXG4gICAgKVxuICAgIHxcbiAgICAoXFx3Kyk/KDopICAgICAgICBjb252ZXJ0ZXIgY29sb25cbiAgICB8XG4gICAgKD4pICAgICAgICAgICAgICBodG1sXG4gICAgfFxuICAgIChcXCopICAgICAgICAgICAgIGNvZGVUYWdcbiAgKVxuICBcXHMqXG4gICggICAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAoPzpbXn1dfH0oPyF9KSkqP1xuICApXG4gIChcXC8pPyAgICAgICAgICAgICAgc2xhc2hcbiAgfFxuICB7KFxcXik/eyAgICAgICAgICAgIGJpbmQyXG4gICg/OlxuICAgICg/OlxcLyhcXHcrKSlcXHMqICAgY2xvc2VCbG9ja1xuICAgIHxcbiAgICAhLS1bXFxzXFxTXSo/LS0gICAgY29tbWVudFxuICApXG4pXG59fS9nXG5cbiovXG5cdFx0aWYgKGNvZGVUYWcgJiYgYmluZCB8fCBzbGFzaCAmJiAhdGFnTmFtZSB8fCBwYXJhbXMgJiYgcGFyYW1zLnNsaWNlKC0xKSA9PT0gXCI6XCIgfHwgYmluZDIpIHtcblx0XHRcdHN5bnRheEVycm9yKGFsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gQnVpbGQgYWJzdHJhY3Qgc3ludGF4IHRyZWUgKEFTVCk6IFt0YWdOYW1lLCBjb252ZXJ0ZXIsIHBhcmFtcywgY29udGVudCwgaGFzaCwgYmluZGluZ3MsIGNvbnRlbnRNYXJrdXBdXG5cdFx0aWYgKGh0bWwpIHtcblx0XHRcdGNvbG9uID0gXCI6XCI7XG5cdFx0XHRjb252ZXJ0ZXIgPSBIVE1MO1xuXHRcdH1cblx0XHRzbGFzaCA9IHNsYXNoIHx8IGlzTGlua0V4cHIgJiYgIWhhc0Vsc2U7XG5cblx0XHR2YXIgbGF0ZSwgb3BlblRhZ05hbWUsIGlzTGF0ZU9iLFxuXHRcdFx0cGF0aEJpbmRpbmdzID0gKGJpbmQgfHwgaXNMaW5rRXhwcikgJiYgW1tdXSwgLy8gcGF0aEJpbmRpbmdzIGlzIGFuIGFycmF5IG9mIGFycmF5cyBmb3IgYXJnIGJpbmRpbmdzIGFuZCBhIGhhc2ggb2YgYXJyYXlzIGZvciBwcm9wIGJpbmRpbmdzXG5cdFx0XHRwcm9wcyA9IFwiXCIsXG5cdFx0XHRhcmdzID0gXCJcIixcblx0XHRcdGN0eFByb3BzID0gXCJcIixcblx0XHRcdHBhcmFtc0FyZ3MgPSBcIlwiLFxuXHRcdFx0cGFyYW1zUHJvcHMgPSBcIlwiLFxuXHRcdFx0cGFyYW1zQ3R4UHJvcHMgPSBcIlwiLFxuXHRcdFx0b25FcnJvciA9IFwiXCIsXG5cdFx0XHR1c2VUcmlnZ2VyID0gXCJcIixcblx0XHRcdC8vIEJsb2NrIHRhZyBpZiBub3Qgc2VsZi1jbG9zaW5nIGFuZCBub3Qge3s6fX0gb3Ige3s+fX0gKHNwZWNpYWwgY2FzZSkgYW5kIG5vdCBhIGRhdGEtbGluayBleHByZXNzaW9uXG5cdFx0XHRibG9jayA9ICFzbGFzaCAmJiAhY29sb247XG5cblx0XHQvLz09PT0gbmVzdGVkIGhlbHBlciBmdW5jdGlvbiA9PT09XG5cdFx0dGFnTmFtZSA9IHRhZ05hbWUgfHwgKHBhcmFtcyA9IHBhcmFtcyB8fCBcIiNkYXRhXCIsIGNvbG9uKTsgLy8ge3s6fX0gaXMgZXF1aXZhbGVudCB0byB7ezojZGF0YX19XG5cdFx0cHVzaHByZWNlZGluZ0NvbnRlbnQoaW5kZXgpO1xuXHRcdGxvYyA9IGluZGV4ICsgYWxsLmxlbmd0aDsgLy8gbG9jYXRpb24gbWFya2VyIC0gcGFyc2VkIHVwIHRvIGhlcmVcblx0XHRpZiAoY29kZVRhZykge1xuXHRcdFx0aWYgKGFsbG93Q29kZSkge1xuXHRcdFx0XHRjb250ZW50LnB1c2goW1wiKlwiLCBcIlxcblwiICsgcGFyYW1zLnJlcGxhY2UoL146LywgXCJyZXQrPSBcIikucmVwbGFjZShyVW5lc2NhcGVRdW90ZXMsIFwiJDFcIikgKyBcIjtcXG5cIl0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGFnTmFtZSkge1xuXHRcdFx0aWYgKHRhZ05hbWUgPT09IFwiZWxzZVwiKSB7XG5cdFx0XHRcdGlmIChyVGVzdEVsc2VJZi50ZXN0KHBhcmFtcykpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcignRm9yIFwie3tlbHNlIGlmIGV4cHJ9fVwiIHVzZSBcInt7ZWxzZSBleHByfX1cIicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBhdGhCaW5kaW5ncyA9IGN1cnJlbnRbOV0gJiYgW1tdXTtcblx0XHRcdFx0Y3VycmVudFsxMF0gPSBtYXJrdXAuc3Vic3RyaW5nKGN1cnJlbnRbMTBdLCBpbmRleCk7IC8vIGNvbnRlbnRNYXJrdXAgZm9yIGJsb2NrIHRhZ1xuXHRcdFx0XHRvcGVuVGFnTmFtZSA9IGN1cnJlbnRbMTFdIHx8IGN1cnJlbnRbMF0gfHwgc3ludGF4RXJyb3IoXCJNaXNtYXRjaGVkOiBcIiArIGFsbCk7XG5cdFx0XHRcdC8vIGN1cnJlbnRbMF0gaXMgdGFnTmFtZSwgYnV0IGZvciB7e2Vsc2V9fSBub2RlcywgY3VycmVudFsxMV0gaXMgdGFnTmFtZSBvZiBwcmVjZWRpbmcgb3BlbiB0YWdcblx0XHRcdFx0Y3VycmVudCA9IHN0YWNrLnBvcCgpO1xuXHRcdFx0XHRjb250ZW50ID0gY3VycmVudFsyXTtcblx0XHRcdFx0YmxvY2sgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhcmFtcykge1xuXHRcdFx0XHQvLyByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgcGFyYW1zIHN0cmluZywgdG8gYXZvaWQgY29tcGlsZWQgY29kZSBlcnJvcnMgZm9yIHVudGVybWluYXRlZCBzdHJpbmdzXG5cdFx0XHRcdHBhcnNlUGFyYW1zKHBhcmFtcy5yZXBsYWNlKHJOZXdMaW5lLCBcIiBcIiksIHBhdGhCaW5kaW5ncywgdG1wbCwgaXNMaW5rRXhwcilcblx0XHRcdFx0XHQucmVwbGFjZShyQnVpbGRIYXNoLCBmdW5jdGlvbihhbGwsIG9uZXJyb3IsIGlzQ3R4UHJtLCBrZXksIGtleVRva2VuLCBrZXlWYWx1ZSwgYXJnLCBwYXJhbSkge1xuXHRcdFx0XHRcdFx0aWYgKGtleSA9PT0gXCJ0aGlzOlwiKSB7XG5cdFx0XHRcdFx0XHRcdGtleVZhbHVlID0gXCJ1bmRlZmluZWRcIjsgLy8gdGhpcz1zb21lLnBhdGggaXMgYWx3YXlzIGEgdG8gcGFyYW1ldGVyIChvbmUtd2F5KSwgc28gZG9uJ3QgbmVlZCB0byBjb21waWxlL2V2YWx1YXRlIHNvbWUucGF0aCBpbml0aWFsaXphdGlvblxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRcdGlzTGF0ZU9iID0gaXNMYXRlT2IgfHwgcGFyYW1bMF0gPT09IFwiQFwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0a2V5ID0gXCInXCIgKyBrZXlUb2tlbiArIFwiJzpcIjtcblx0XHRcdFx0XHRcdGlmIChhcmcpIHtcblx0XHRcdFx0XHRcdFx0YXJncyArPSBpc0N0eFBybSArIGtleVZhbHVlICsgXCIsXCI7XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0FyZ3MgKz0gXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNDdHhQcm0pIHsgLy8gQ29udGV4dHVhbCBwYXJhbWV0ZXIsIH5mb289ZXhwclxuXHRcdFx0XHRcdFx0XHRjdHhQcm9wcyArPSBrZXkgKyAnai5fY3AoJyArIGtleVZhbHVlICsgJyxcIicgKyBwYXJhbSArICdcIix2aWV3KSwnO1xuXHRcdFx0XHRcdFx0XHQvLyBDb21waWxlZCBjb2RlIGZvciBldmFsdWF0aW5nIHRhZ0N0eCBvbiBhIHRhZyB3aWxsIGhhdmU6IGN0eDp7J2Zvbyc6ai5fY3AoY29tcGlsZWRFeHByLCBcImV4cHJcIiwgdmlldyl9XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0N0eFByb3BzICs9IGtleSArIFwiJ1wiICsgcGFyYW0gKyBcIicsXCI7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKG9uZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0b25FcnJvciArPSBrZXlWYWx1ZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGlmIChrZXlUb2tlbiA9PT0gXCJ0cmlnZ2VyXCIpIHtcblx0XHRcdFx0XHRcdFx0XHR1c2VUcmlnZ2VyICs9IGtleVZhbHVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChrZXlUb2tlbiA9PT0gXCJsYXRlUmVuZGVyXCIpIHtcblx0XHRcdFx0XHRcdFx0XHRsYXRlID0gcGFyYW0gIT09IFwiZmFsc2VcIjsgLy8gUmVuZGVyIGFmdGVyIGZpcnN0IHBhc3Ncblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRwcm9wcyArPSBrZXkgKyBrZXlWYWx1ZSArIFwiLFwiO1xuXHRcdFx0XHRcdFx0XHRwYXJhbXNQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0XHRoYXNIYW5kbGVycyA9IGhhc0hhbmRsZXJzIHx8IHJIYXNIYW5kbGVycy50ZXN0KGtleVRva2VuKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0XHRcdH0pLnNsaWNlKDAsIC0xKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0pIHtcblx0XHRcdFx0cGF0aEJpbmRpbmdzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGJpbmRpbmcgdGhhdCB3YXMgcHJlcGFyZWQgZm9yIG5leHQgYXJnLiAoVGhlcmUgaXMgYWx3YXlzIGFuIGV4dHJhIG9uZSByZWFkeSkuXG5cdFx0XHR9XG5cblx0XHRcdG5ld05vZGUgPSBbXG5cdFx0XHRcdFx0dGFnTmFtZSxcblx0XHRcdFx0XHRjb252ZXJ0ZXIgfHwgISFjb252ZXJ0QmFjayB8fCBoYXNIYW5kbGVycyB8fCBcIlwiLFxuXHRcdFx0XHRcdGJsb2NrICYmIFtdLFxuXHRcdFx0XHRcdHBhcnNlZFBhcmFtKHBhcmFtc0FyZ3MgfHwgKHRhZ05hbWUgPT09IFwiOlwiID8gXCInI2RhdGEnLFwiIDogXCJcIiksIHBhcmFtc1Byb3BzLCBwYXJhbXNDdHhQcm9wcyksIC8vIHt7On19IGVxdWl2YWxlbnQgdG8ge3s6I2RhdGF9fVxuXHRcdFx0XHRcdHBhcnNlZFBhcmFtKGFyZ3MgfHwgKHRhZ05hbWUgPT09IFwiOlwiID8gXCJkYXRhLFwiIDogXCJcIiksIHByb3BzLCBjdHhQcm9wcyksXG5cdFx0XHRcdFx0b25FcnJvcixcblx0XHRcdFx0XHR1c2VUcmlnZ2VyLFxuXHRcdFx0XHRcdGxhdGUsXG5cdFx0XHRcdFx0aXNMYXRlT2IsXG5cdFx0XHRcdFx0cGF0aEJpbmRpbmdzIHx8IDBcblx0XHRcdFx0XTtcblx0XHRcdGNvbnRlbnQucHVzaChuZXdOb2RlKTtcblx0XHRcdGlmIChibG9jaykge1xuXHRcdFx0XHRzdGFjay5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRjdXJyZW50ID0gbmV3Tm9kZTtcblx0XHRcdFx0Y3VycmVudFsxMF0gPSBsb2M7IC8vIFN0b3JlIGN1cnJlbnQgbG9jYXRpb24gb2Ygb3BlbiB0YWcsIHRvIGJlIGFibGUgdG8gYWRkIGNvbnRlbnRNYXJrdXAgd2hlbiB3ZSByZWFjaCBjbG9zaW5nIHRhZ1xuXHRcdFx0XHRjdXJyZW50WzExXSA9IG9wZW5UYWdOYW1lOyAvLyBVc2VkIGZvciBjaGVja2luZyBzeW50YXggKG1hdGNoaW5nIGNsb3NlIHRhZylcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGNsb3NlQmxvY2spIHtcblx0XHRcdGJsb2NrVGFnQ2hlY2soY2xvc2VCbG9jayAhPT0gY3VycmVudFswXSAmJiBjbG9zZUJsb2NrICE9PSBjdXJyZW50WzExXSAmJiBjbG9zZUJsb2NrLCBjdXJyZW50WzBdKTsgLy8gQ2hlY2sgbWF0Y2hpbmcgY2xvc2UgdGFnIG5hbWVcblx0XHRcdGN1cnJlbnRbMTBdID0gbWFya3VwLnN1YnN0cmluZyhjdXJyZW50WzEwXSwgaW5kZXgpOyAvLyBjb250ZW50TWFya3VwIGZvciBibG9jayB0YWdcblx0XHRcdGN1cnJlbnQgPSBzdGFjay5wb3AoKTtcblx0XHR9XG5cdFx0YmxvY2tUYWdDaGVjayghY3VycmVudCAmJiBjbG9zZUJsb2NrKTtcblx0XHRjb250ZW50ID0gY3VycmVudFsyXTtcblx0fVxuXHQvLz09PT0gL2VuZCBvZiBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblxuXHR2YXIgaSwgcmVzdWx0LCBuZXdOb2RlLCBoYXNIYW5kbGVycywgYmluZGluZ3MsXG5cdFx0YWxsb3dDb2RlID0gJHN1YlNldHRpbmdzLmFsbG93Q29kZSB8fCB0bXBsICYmIHRtcGwuYWxsb3dDb2RlXG5cdFx0XHR8fCAkdmlld3NTZXR0aW5ncy5hbGxvd0NvZGUgPT09IHRydWUsIC8vIGluY2x1ZGUgZGlyZWN0IHNldHRpbmcgb2Ygc2V0dGluZ3MuYWxsb3dDb2RlIHRydWUgZm9yIGJhY2t3YXJkIGNvbXBhdCBvbmx5XG5cdFx0YXN0VG9wID0gW10sXG5cdFx0bG9jID0gMCxcblx0XHRzdGFjayA9IFtdLFxuXHRcdGNvbnRlbnQgPSBhc3RUb3AsXG5cdFx0Y3VycmVudCA9IFssLGFzdFRvcF07XG5cblx0aWYgKGFsbG93Q29kZSAmJiB0bXBsLl9pcykge1xuXHRcdHRtcGwuYWxsb3dDb2RlID0gYWxsb3dDb2RlO1xuXHR9XG5cbi8vVE9ET1x0cmVzdWx0ID0gdG1wbEZuc0NhY2hlW21hcmt1cF07IC8vIE9ubHkgY2FjaGUgaWYgdGVtcGxhdGUgaXMgbm90IG5hbWVkIGFuZCBtYXJrdXAgbGVuZ3RoIDwgLi4uLFxuLy9hbmQgdGhlcmUgYXJlIG5vIGJpbmRpbmdzIG9yIHN1YnRlbXBsYXRlcz8/IENvbnNpZGVyIHN0YW5kYXJkIG9wdGltaXphdGlvbiBmb3IgZGF0YS1saW5rPVwiYS5iLmNcIlxuLy9cdFx0aWYgKHJlc3VsdCkge1xuLy9cdFx0XHR0bXBsLmZuID0gcmVzdWx0O1xuLy9cdFx0fSBlbHNlIHtcblxuLy9cdFx0cmVzdWx0ID0gbWFya3VwO1xuXHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdGlmIChjb252ZXJ0QmFjayAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRtYXJrdXAgPSBtYXJrdXAuc2xpY2UoMCwgLWNvbnZlcnRCYWNrLmxlbmd0aCAtIDIpICsgZGVsaW1DbG9zZUNoYXIwO1xuXHRcdH1cblx0XHRtYXJrdXAgPSBkZWxpbU9wZW5DaGFyMCArIG1hcmt1cCArIGRlbGltQ2xvc2VDaGFyMTtcblx0fVxuXG5cdGJsb2NrVGFnQ2hlY2soc3RhY2tbMF0gJiYgc3RhY2tbMF1bMl0ucG9wKClbMF0pO1xuXHQvLyBCdWlsZCB0aGUgQVNUIChhYnN0cmFjdCBzeW50YXggdHJlZSkgdW5kZXIgYXN0VG9wXG5cdG1hcmt1cC5yZXBsYWNlKHJUYWcsIHBhcnNlVGFnKTtcblxuXHRwdXNocHJlY2VkaW5nQ29udGVudChtYXJrdXAubGVuZ3RoKTtcblxuXHRpZiAobG9jID0gYXN0VG9wW2FzdFRvcC5sZW5ndGggLSAxXSkge1xuXHRcdGJsb2NrVGFnQ2hlY2soXCJcIiArIGxvYyAhPT0gbG9jICYmICgrbG9jWzEwXSA9PT0gbG9jWzEwXSkgJiYgbG9jWzBdKTtcblx0fVxuLy9cdFx0XHRyZXN1bHQgPSB0bXBsRm5zQ2FjaGVbbWFya3VwXSA9IGJ1aWxkQ29kZShhc3RUb3AsIHRtcGwpO1xuLy9cdFx0fVxuXG5cdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0cmVzdWx0ID0gYnVpbGRDb2RlKGFzdFRvcCwgbWFya3VwLCBpc0xpbmtFeHByKTtcblx0XHRiaW5kaW5ncyA9IFtdO1xuXHRcdGkgPSBhc3RUb3AubGVuZ3RoO1xuXHRcdHdoaWxlIChpLS0pIHtcblx0XHRcdGJpbmRpbmdzLnVuc2hpZnQoYXN0VG9wW2ldWzldKTsgLy8gV2l0aCBkYXRhLWxpbmsgZXhwcmVzc2lvbnMsIHBhdGhCaW5kaW5ncyBhcnJheSBmb3IgdGFnQ3R4W2ldIGlzIGFzdFRvcFtpXVs5XVxuXHRcdH1cblx0XHRzZXRQYXRocyhyZXN1bHQsIGJpbmRpbmdzKTtcblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCB0bXBsKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzZXRQYXRocyhmbiwgcGF0aHNBcnIpIHtcblx0dmFyIGtleSwgcGF0aHMsXG5cdFx0aSA9IDAsXG5cdFx0bCA9IHBhdGhzQXJyLmxlbmd0aDtcblx0Zm4uZGVwcyA9IFtdO1xuXHRmbi5wYXRocyA9IFtdOyAvLyBUaGUgYXJyYXkgb2YgcGF0aCBiaW5kaW5nIChhcnJheS9kaWN0aW9uYXJ5KXMgZm9yIGVhY2ggdGFnL2Vsc2UgYmxvY2sncyBhcmdzIGFuZCBwcm9wc1xuXHRmb3IgKDsgaSA8IGw7IGkrKykge1xuXHRcdGZuLnBhdGhzLnB1c2gocGF0aHMgPSBwYXRoc0FycltpXSk7XG5cdFx0Zm9yIChrZXkgaW4gcGF0aHMpIHtcblx0XHRcdGlmIChrZXkgIT09IFwiX2pzdnRvXCIgJiYgcGF0aHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBwYXRoc1trZXldLmxlbmd0aCAmJiAhcGF0aHNba2V5XS5za3ApIHtcblx0XHRcdFx0Zm4uZGVwcyA9IGZuLmRlcHMuY29uY2F0KHBhdGhzW2tleV0pOyAvLyBkZXBzIGlzIHRoZSBjb25jYXRlbmF0aW9uIG9mIHRoZSBwYXRocyBhcnJheXMgZm9yIHRoZSBkaWZmZXJlbnQgYmluZGluZ3Ncblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcGFyc2VkUGFyYW0oYXJncywgcHJvcHMsIGN0eCkge1xuXHRyZXR1cm4gW2FyZ3Muc2xpY2UoMCwgLTEpLCBwcm9wcy5zbGljZSgwLCAtMSksIGN0eC5zbGljZSgwLCAtMSldO1xufVxuXG5mdW5jdGlvbiBwYXJhbVN0cnVjdHVyZShwYXJ0cywgdHlwZSkge1xuXHRyZXR1cm4gJ1xcblxcdCdcblx0XHQrICh0eXBlXG5cdFx0XHQ/IHR5cGUgKyAnOnsnXG5cdFx0XHQ6ICcnKVxuXHRcdCsgJ2FyZ3M6WycgKyBwYXJ0c1swXSArICddLFxcblxcdHByb3BzOnsnICsgcGFydHNbMV0gKyAnfSdcblx0XHQrIChwYXJ0c1syXSA/ICcsXFxuXFx0Y3R4OnsnICsgcGFydHNbMl0gKyAnfScgOiBcIlwiKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXJhbXMocGFyYW1zLCBwYXRoQmluZGluZ3MsIHRtcGwsIGlzTGlua0V4cHIpIHtcblxuXHRmdW5jdGlvbiBwYXJzZVRva2VucyhhbGwsIGxmdFBybjAsIGxmdFBybiwgYm91bmQsIHBhdGgsIG9wZXJhdG9yLCBlcnIsIGVxLCBwYXRoMiwgbGF0ZSwgcHJuLCBjb21tYSwgbGZ0UHJuMiwgYXBvcywgcXVvdCwgcnRQcm4sIHJ0UHJuRG90LCBwcm4yLCBzcGFjZSwgaW5kZXgsIGZ1bGwpIHtcblx0Ly8gLyhcXCgpKD89XFxzKlxcKCl8KD86KFsoW10pXFxzKik/KD86KFxcXj8pKH4/W1xcdyQuXl0rKT9cXHMqKChcXCtcXCt8LS0pfFxcK3wtfH4oPyFbXFx3JF0pfCYmfFxcfFxcfHw9PT18IT09fD09fCE9fDw9fD49fFs8PiUqOj9cXC9dfCg9KSlcXHMqfCghKj8oQCk/WyN+XT9bXFx3JC5eXSspKFsoW10pPyl8KCxcXHMqKXwoXFwoPylcXFxcPyg/OignKXwoXCIpKXwoPzpcXHMqKChbKVxcXV0pKD89Wy5eXXxcXHMqJHxbXihbXSl8WylcXF1dKShbKFtdPykpfChcXHMrKS9nLFxuXHQvL2xmdFBybjAgICAgICAgICAgIGxmdFBybiAgICAgICAgIGJvdW5kICAgICBwYXRoICAgICAgICAgICAgICAgb3BlcmF0b3IgICAgIGVyciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxICAgICAgcGF0aDIgbGF0ZSAgICAgICAgICAgIHBybiAgICAgIGNvbW1hICBsZnRQcm4yICAgYXBvcyBxdW90ICAgICAgICBydFBybiAgcnRQcm5Eb3QgICAgICAgICAgICAgICAgICBwcm4yICAgICBzcGFjZVxuXHQvLyAobGVmdCBwYXJlbj8gZm9sbG93ZWQgYnkgKHBhdGg/IGZvbGxvd2VkIGJ5IG9wZXJhdG9yKSBvciAocGF0aCBmb2xsb3dlZCBieSBwYXJlbj8pKSBvciBjb21tYSBvciBhcG9zIG9yIHF1b3Qgb3IgcmlnaHQgcGFyZW4gb3Igc3BhY2VcblxuXHRcdGZ1bmN0aW9uIHBhcnNlUGF0aChhbGxQYXRoLCBub3QsIG9iamVjdCwgaGVscGVyLCB2aWV3LCB2aWV3UHJvcGVydHksIHBhdGhUb2tlbnMsIGxlYWZUb2tlbikge1xuXHRcdFx0Ly8gL14oISo/KSg/Om51bGx8dHJ1ZXxmYWxzZXxcXGRbXFxkLl0qfChbXFx3JF0rfFxcLnx+KFtcXHckXSspfCModmlld3woW1xcdyRdKykpPykoW1xcdyQuXl0qPykoPzpbLlteXShbXFx3JF0rKVxcXT8pPykkL2csXG5cdFx0XHQvLyAgICBub3QgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ICAgICBoZWxwZXIgICAgdmlldyAgdmlld1Byb3BlcnR5IHBhdGhUb2tlbnMgICAgICBsZWFmVG9rZW5cblx0XHRcdHZhciBzdWJQYXRoID0gb2JqZWN0ID09PSBcIi5cIjtcblx0XHRcdGlmIChvYmplY3QpIHtcblx0XHRcdFx0cGF0aCA9IHBhdGguc2xpY2Uobm90Lmxlbmd0aCk7XG5cdFx0XHRcdGlmICgvXlxcLj9jb25zdHJ1Y3RvciQvLnRlc3QobGVhZlRva2VufHxwYXRoKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKGFsbFBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghc3ViUGF0aCkge1xuXHRcdFx0XHRcdGFsbFBhdGggPSAobGF0ZSAvLyBsYXRlIHBhdGggQGEuYi5jOiBub3QgdGhyb3cgb24gJ3Byb3BlcnR5IG9mIHVuZGVmaW5lZCcgaWYgYSB1bmRlZmluZWQsIGFuZCB3aWxsIHVzZSBfZ2V0T2IoKSBhZnRlciBsaW5raW5nIHRvIHJlc29sdmUgbGF0ZS5cblx0XHRcdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/ICcnIDogJyhsdE9iLmx0PWx0T2IubHR8fCcpICsgJyhvYj0nXG5cdFx0XHRcdFx0XHRcdDogXCJcIlxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0KyAoaGVscGVyXG5cdFx0XHRcdFx0XHRcdD8gJ3ZpZXcuY3R4UHJtKFwiJyArIGhlbHBlciArICdcIiknXG5cdFx0XHRcdFx0XHRcdDogdmlld1xuXHRcdFx0XHRcdFx0XHRcdD8gXCJ2aWV3XCJcblx0XHRcdFx0XHRcdFx0XHQ6IFwiZGF0YVwiKVxuXHRcdFx0XHRcdFx0KyAobGF0ZVxuXHRcdFx0XHRcdFx0XHQ/ICcpPT09dW5kZWZpbmVkJyArIChpc0xpbmtFeHByID8gJycgOiAnKScpICsgJz9cIlwiOnZpZXcuX2dldE9iKG9iLFwiJ1xuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdCsgKGxlYWZUb2tlblxuXHRcdFx0XHRcdFx0XHQ/ICh2aWV3UHJvcGVydHlcblx0XHRcdFx0XHRcdFx0XHQ/IFwiLlwiICsgdmlld1Byb3BlcnR5XG5cdFx0XHRcdFx0XHRcdFx0OiBoZWxwZXJcblx0XHRcdFx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0XHRcdFx0OiAodmlldyA/IFwiXCIgOiBcIi5cIiArIG9iamVjdClcblx0XHRcdFx0XHRcdFx0XHQpICsgKHBhdGhUb2tlbnMgfHwgXCJcIilcblx0XHRcdFx0XHRcdFx0OiAobGVhZlRva2VuID0gaGVscGVyID8gXCJcIiA6IHZpZXcgPyB2aWV3UHJvcGVydHkgfHwgXCJcIiA6IG9iamVjdCwgXCJcIikpO1xuXHRcdFx0XHRcdGFsbFBhdGggPSBhbGxQYXRoICsgKGxlYWZUb2tlbiA/IFwiLlwiICsgbGVhZlRva2VuIDogXCJcIik7XG5cblx0XHRcdFx0XHRhbGxQYXRoID0gbm90ICsgKGFsbFBhdGguc2xpY2UoMCwgOSkgPT09IFwidmlldy5kYXRhXCJcblx0XHRcdFx0XHRcdD8gYWxsUGF0aC5zbGljZSg1KSAvLyBjb252ZXJ0ICN2aWV3LmRhdGEuLi4gdG8gZGF0YS4uLlxuXHRcdFx0XHRcdFx0OiBhbGxQYXRoKVxuXHRcdFx0XHRcdCsgKGxhdGVcblx0XHRcdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/ICdcIic6ICdcIixsdE9iJykgKyAocHJuID8gJywxKSc6JyknKVxuXHRcdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0YmluZHMgPSBuYW1lZCA9PT0gXCJfbGlua1RvXCIgPyAoYmluZHRvID0gcGF0aEJpbmRpbmdzLl9qc3Z0byA9IHBhdGhCaW5kaW5ncy5fanN2dG8gfHwgW10pIDogYm5kQ3R4LmJkO1xuXHRcdFx0XHRcdGlmICh0aGVPYiA9IHN1YlBhdGggJiYgYmluZHNbYmluZHMubGVuZ3RoLTFdKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhlT2IuX2NwZm4pIHsgLy8gQ29tcHV0ZWQgcHJvcGVydHkgZXhwck9iXG5cdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYikge1xuXHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iLmJuZCkge1xuXHRcdFx0XHRcdFx0XHRcdHBhdGggPSBcIl5cIiArIHBhdGguc2xpY2UoMSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGhlT2Iuc2IgPSBwYXRoO1xuXHRcdFx0XHRcdFx0XHR0aGVPYi5ibmQgPSB0aGVPYi5ibmQgfHwgcGF0aFswXSA9PT0gXCJeXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGJpbmRzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhdGhTdGFydFtwYXJlbkRlcHRoXSA9IGluZGV4ICsgKHN1YlBhdGggPyAxIDogMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBhbGxQYXRoO1xuXHRcdH1cblxuXHRcdC8vYm91bmQgPSBiaW5kaW5ncyAmJiBib3VuZDtcblx0XHRpZiAoYm91bmQgJiYgIWVxKSB7XG5cdFx0XHRwYXRoID0gYm91bmQgKyBwYXRoOyAvLyBlLmcuIHNvbWUuZm4oLi4uKV5zb21lLnBhdGggLSBzbyBoZXJlIHBhdGggaXMgXCJec29tZS5wYXRoXCJcblx0XHR9XG5cdFx0b3BlcmF0b3IgPSBvcGVyYXRvciB8fCBcIlwiO1xuXHRcdGxmdFBybiA9IGxmdFBybiB8fCBsZnRQcm4wIHx8IGxmdFBybjI7XG5cdFx0cGF0aCA9IHBhdGggfHwgcGF0aDI7XG5cblx0XHRpZiAobGF0ZSAmJiAobGF0ZSA9ICEvXFwpfF0vLnRlc3QoZnVsbFtpbmRleC0xXSkpKSB7XG5cdFx0XHRwYXRoID0gcGF0aC5zbGljZSgxKS5zcGxpdChcIi5cIikuam9pbihcIl5cIik7IC8vIExhdGUgcGF0aCBAei5iLmMuIFVzZSBcIl5cIiByYXRoZXIgdGhhbiBcIi5cIiB0byBlbnN1cmUgdGhhdCBkZWVwIGJpbmRpbmcgd2lsbCBiZSB1c2VkXG5cdFx0fVxuXHRcdC8vIENvdWxkIGRvIHRoaXMgLSBidXQgbm90IHdvcnRoIHBlcmYgY29zdD8/IDotXG5cdFx0Ly8gaWYgKCFwYXRoLmxhc3RJbmRleE9mKFwiI2RhdGEuXCIsIDApKSB7IHBhdGggPSBwYXRoLnNsaWNlKDYpOyB9IC8vIElmIHBhdGggc3RhcnRzIHdpdGggXCIjZGF0YS5cIiwgcmVtb3ZlIHRoYXQuXG5cdFx0cHJuID0gcHJuIHx8IHBybjIgfHwgXCJcIjtcblxuXHRcdHZhciBleHByLCBleHByRm4sIGJpbmRzLCB0aGVPYiwgbmV3T2IsXG5cdFx0XHRydFNxID0gXCIpXCI7XG5cblx0XHRpZiAocHJuID09PSBcIltcIikge1xuXHRcdFx0cHJuID0gXCJbai5fc3EoXCI7XG5cdFx0XHRydFNxID0gXCIpXVwiO1xuXHRcdH1cblxuXHRcdGlmIChlcnIgJiYgIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRzeW50YXhFcnJvcihwYXJhbXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoYmluZGluZ3MgJiYgcnRQcm5Eb3QgJiYgIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRcdC8vIFRoaXMgaXMgYSBiaW5kaW5nIHRvIGEgcGF0aCBpbiB3aGljaCBhbiBvYmplY3QgaXMgcmV0dXJuZWQgYnkgYSBoZWxwZXIvZGF0YSBmdW5jdGlvbi9leHByZXNzaW9uLCBlLmcuIGZvbygpXngueSBvciAoYT9iOmMpXngueVxuXHRcdFx0XHQvLyBXZSBjcmVhdGUgYSBjb21waWxlZCBmdW5jdGlvbiB0byBnZXQgdGhlIG9iamVjdCBpbnN0YW5jZSAod2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgZGVwZW5kZW50IGRhdGEgb2YgdGhlIHN1YmV4cHJlc3Npb24gY2hhbmdlcywgdG8gcmV0dXJuIHRoZSBuZXcgb2JqZWN0LCBhbmQgdHJpZ2dlciByZS1iaW5kaW5nIG9mIHRoZSBzdWJzZXF1ZW50IHBhdGgpXG5cdFx0XHRcdGlmIChwYXJlbkRlcHRoKSB7XG5cdFx0XHRcdFx0ZXhwciA9IHBhdGhTdGFydFtwYXJlbkRlcHRoIC0gMV07XG5cdFx0XHRcdFx0aWYgKGZ1bGwubGVuZ3RoIC0gMSA+IGluZGV4IC0gKGV4cHIgfHwgMCkpIHsgLy8gV2UgbmVlZCB0byBjb21waWxlIGEgc3ViZXhwcmVzc2lvblxuXHRcdFx0XHRcdFx0ZXhwciA9IGZ1bGwuc2xpY2UoZXhwciwgaW5kZXggKyBhbGwubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGlmIChleHByRm4gIT09IHRydWUpIHsgLy8gSWYgbm90IHJlZW50cmFudCBjYWxsIGR1cmluZyBjb21waWxhdGlvblxuXHRcdFx0XHRcdFx0XHRiaW5kcyA9IGJpbmR0byB8fCBibmRTdGFja1twYXJlbkRlcHRoLTFdLmJkO1xuXHRcdFx0XHRcdFx0XHQvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdFx0XHR0aGVPYiA9IGJpbmRzW2JpbmRzLmxlbmd0aC0xXTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iICYmIHRoZU9iLnBybSkge1xuXHRcdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYiAmJiB0aGVPYi5zYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdG5ld09iID0gdGhlT2Iuc2IgPSB7cGF0aDogdGhlT2Iuc2IsIGJuZDogdGhlT2IuYm5kfTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRiaW5kcy5wdXNoKG5ld09iID0ge3BhdGg6IGJpbmRzLnBvcCgpfSk7IC8vIEluc2VydCBleHByT2Igb2JqZWN0LCB0byBiZSB1c2VkIGR1cmluZyBiaW5kaW5nIHRvIHJldHVybiB0aGUgY29tcHV0ZWQgb2JqZWN0XG5cdFx0XHRcdFx0XHRcdH1cdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC8vIChlLmcuIFwic29tZS5vYmplY3QoKVwiIGluIFwic29tZS5vYmplY3QoKS5hLmJcIiAtIHRvIGJlIHVzZWQgYXMgY29udGV4dCBmb3IgYmluZGluZyB0aGUgZm9sbG93aW5nIHRva2VucyBcImEuYlwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cnRQcm5Eb3QgPSBkZWxpbU9wZW5DaGFyMSArIFwiOlwiICsgZXhwciAvLyBUaGUgcGFyYW1ldGVyIG9yIGZ1bmN0aW9uIHN1YmV4cHJlc3Npb25cblx0XHRcdFx0XHRcdFx0KyBcIiBvbmVycm9yPScnXCIgLy8gc2V0IG9uZXJyb3I9JycgaW4gb3JkZXIgdG8gd3JhcCBnZW5lcmF0ZWQgY29kZSB3aXRoIGEgdHJ5IGNhdGNoIC0gcmV0dXJuaW5nICcnIGFzIG9iamVjdCBpbnN0YW5jZSBpZiB0aGVyZSBpcyBhbiBlcnJvci9taXNzaW5nIHBhcmVudFxuXHRcdFx0XHRcdFx0XHQrIGRlbGltQ2xvc2VDaGFyMDtcblx0XHRcdFx0XHRcdGV4cHJGbiA9IHRtcGxMaW5rc1tydFBybkRvdF07XG5cdFx0XHRcdFx0XHRpZiAoIWV4cHJGbikge1xuXHRcdFx0XHRcdFx0XHR0bXBsTGlua3NbcnRQcm5Eb3RdID0gdHJ1ZTsgLy8gRmxhZyB0aGF0IHRoaXMgZXhwckZuIChmb3IgcnRQcm5Eb3QpIGlzIGJlaW5nIGNvbXBpbGVkXG5cdFx0XHRcdFx0XHRcdHRtcGxMaW5rc1tydFBybkRvdF0gPSBleHByRm4gPSB0bXBsRm4ocnRQcm5Eb3QsIHRtcGwsIHRydWUpOyAvLyBDb21waWxlIHRoZSBleHByZXNzaW9uIChvciB1c2UgY2FjaGVkIGNvcHkgYWxyZWFkeSBpbiB0bXBsLmxpbmtzKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGV4cHJGbiAhPT0gdHJ1ZSAmJiBuZXdPYikge1xuXHRcdFx0XHRcdFx0XHQvLyBJZiBub3QgcmVlbnRyYW50IGNhbGwgZHVyaW5nIGNvbXBpbGF0aW9uXG5cdFx0XHRcdFx0XHRcdG5ld09iLl9jcGZuID0gZXhwckZuO1xuXHRcdFx0XHRcdFx0XHRuZXdPYi5wcm0gPSBibmRDdHguYmQ7XG5cdFx0XHRcdFx0XHRcdG5ld09iLmJuZCA9IG5ld09iLmJuZCB8fCBuZXdPYi5wYXRoICYmIG5ld09iLnBhdGguaW5kZXhPZihcIl5cIikgPj0gMDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAoYXBvc2VkXG5cdFx0XHRcdC8vIHdpdGhpbiBzaW5nbGUtcXVvdGVkIHN0cmluZ1xuXHRcdFx0XHQ/IChhcG9zZWQgPSAhYXBvcywgKGFwb3NlZCA/IGFsbCA6IGxmdFBybjIgKyAnXCInKSlcblx0XHRcdFx0OiBxdW90ZWRcblx0XHRcdFx0Ly8gd2l0aGluIGRvdWJsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHRcdFx0PyAocXVvdGVkID0gIXF1b3QsIChxdW90ZWQgPyBhbGwgOiBsZnRQcm4yICsgJ1wiJykpXG5cdFx0XHRcdFx0OlxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KGxmdFByblxuXHRcdFx0XHRcdFx0PyAocGF0aFN0YXJ0W3BhcmVuRGVwdGhdID0gaW5kZXgrKywgYm5kQ3R4ID0gYm5kU3RhY2tbKytwYXJlbkRlcHRoXSA9IHtiZDogW119LCBsZnRQcm4pXG5cdFx0XHRcdFx0XHQ6IFwiXCIpXG5cdFx0XHRcdFx0KyAoc3BhY2Vcblx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGhcblx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdC8vIE5ldyBhcmcgb3IgcHJvcCAtIHNvIGluc2VydCBiYWNrc3BhY2UgXFxiIChcXHgwOCkgYXMgc2VwYXJhdG9yIGZvciBuYW1lZCBwYXJhbXMsIHVzZWQgc3Vic2VxdWVudGx5IGJ5IHJCdWlsZEhhc2gsIGFuZCBwcmVwYXJlIG5ldyBiaW5kaW5ncyBhcnJheVxuXHRcdFx0XHRcdFx0XHQ6IChwYXJhbUluZGV4ID0gZnVsbC5zbGljZShwYXJhbUluZGV4LCBpbmRleCksIG5hbWVkXG5cdFx0XHRcdFx0XHRcdFx0PyAobmFtZWQgPSBib3VuZE5hbWUgPSBiaW5kdG8gPSBmYWxzZSwgXCJcXGJcIilcblx0XHRcdFx0XHRcdFx0XHQ6IFwiXFxiLFwiKSArIHBhcmFtSW5kZXggKyAocGFyYW1JbmRleCA9IGluZGV4ICsgYWxsLmxlbmd0aCwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnB1c2goYm5kQ3R4LmJkID0gW10pLCBcIlxcYlwiKVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0OiBlcVxuXHRcdFx0XHQvLyBuYW1lZCBwYXJhbS4gUmVtb3ZlIGJpbmRpbmdzIGZvciBhcmcgYW5kIGNyZWF0ZSBpbnN0ZWFkIGJpbmRpbmdzIGFycmF5IGZvciBwcm9wXG5cdFx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGggJiYgc3ludGF4RXJyb3IocGFyYW1zKSwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnBvcCgpLCBuYW1lZCA9IFwiX1wiICsgcGF0aCwgYm91bmROYW1lID0gYm91bmQsIHBhcmFtSW5kZXggPSBpbmRleCArIGFsbC5sZW5ndGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRiaW5kaW5ncyAmJiAoKGJpbmRpbmdzID0gYm5kQ3R4LmJkID0gcGF0aEJpbmRpbmdzW25hbWVkXSA9IFtdKSwgYmluZGluZ3Muc2twID0gIWJvdW5kKSwgcGF0aCArICc6Jylcblx0XHRcdFx0XHRcdFx0OiBwYXRoXG5cdFx0XHRcdC8vIHBhdGhcblx0XHRcdFx0XHRcdFx0XHQ/IChwYXRoLnNwbGl0KFwiXlwiKS5qb2luKFwiLlwiKS5yZXBsYWNlKCRzdWIuclBhdGgsIHBhcnNlUGF0aClcblx0XHRcdFx0XHRcdFx0XHRcdCsgKHByblxuXHRcdFx0XHQvLyBzb21lLmZuY2FsbChcblx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoYm5kQ3R4ID0gYm5kU3RhY2tbKytwYXJlbkRlcHRoXSA9IHtiZDogW119LCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBydFNxLCBwcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDogb3BlcmF0b3IpXG5cdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHRcdDogb3BlcmF0b3Jcblx0XHRcdFx0Ly8gb3BlcmF0b3Jcblx0XHRcdFx0XHRcdFx0XHRcdD8gb3BlcmF0b3Jcblx0XHRcdFx0XHRcdFx0XHRcdDogcnRQcm5cblx0XHRcdFx0Ly8gZnVuY3Rpb25cblx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoKHJ0UHJuID0gZm5DYWxsW3BhcmVuRGVwdGhdIHx8IHJ0UHJuLCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBmYWxzZSwgYm5kQ3R4ID0gYm5kU3RhY2tbLS1wYXJlbkRlcHRoXSwgcnRQcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAocHJuIC8vIHJ0UHJuIGFuZCBwcm4sIGUuZyApKCBpbiAoYSkoKSBvciBhKCkoKSwgb3IgKVsgaW4gYSgpW11cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGJuZEN0eCA9IGJuZFN0YWNrWysrcGFyZW5EZXB0aF0sIGZuQ2FsbFtwYXJlbkRlcHRoXSA9IHJ0U3EsIHBybilcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogXCJcIilcblx0XHRcdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGNvbW1hXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoZm5DYWxsW3BhcmVuRGVwdGhdIHx8IHN5bnRheEVycm9yKHBhcmFtcyksIFwiLFwiKSAvLyBXZSBkb24ndCBhbGxvdyB0b3AtbGV2ZWwgbGl0ZXJhbCBhcnJheXMgb3Igb2JqZWN0c1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogbGZ0UHJuMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IChhcG9zZWQgPSBhcG9zLCBxdW90ZWQgPSBxdW90LCAnXCInKVxuXHRcdFx0XHQpKVxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHR2YXIgbmFtZWQsIGJpbmR0bywgYm91bmROYW1lLFxuXHRcdHF1b3RlZCwgLy8gYm9vbGVhbiBmb3Igc3RyaW5nIGNvbnRlbnQgaW4gZG91YmxlIHF1b3Rlc1xuXHRcdGFwb3NlZCwgLy8gb3IgaW4gc2luZ2xlIHF1b3Rlc1xuXHRcdGJpbmRpbmdzID0gcGF0aEJpbmRpbmdzICYmIHBhdGhCaW5kaW5nc1swXSwgLy8gYmluZGluZ3MgYXJyYXkgZm9yIHRoZSBmaXJzdCBhcmdcblx0XHRibmRDdHggPSB7YmQ6IGJpbmRpbmdzfSxcblx0XHRibmRTdGFjayA9IHswOiBibmRDdHh9LFxuXHRcdHBhcmFtSW5kZXggPSAwLCAvLyBsaXN0LFxuXHRcdHRtcGxMaW5rcyA9ICh0bXBsID8gdG1wbC5saW5rcyA6IGJpbmRpbmdzICYmIChiaW5kaW5ncy5saW5rcyA9IGJpbmRpbmdzLmxpbmtzIHx8IHt9KSkgfHwgdG9wVmlldy50bXBsLmxpbmtzLFxuXHRcdC8vIFRoZSBmb2xsb3dpbmcgYXJlIHVzZWQgZm9yIHRyYWNraW5nIHBhdGggcGFyc2luZyBpbmNsdWRpbmcgbmVzdGVkIHBhdGhzLCBzdWNoIGFzIFwiYS5iKGNeZCArIChlKSleZlwiLCBhbmQgY2hhaW5lZCBjb21wdXRlZCBwYXRocyBzdWNoIGFzXG5cdFx0Ly8gXCJhLmIoKS5jXmQoKS5lLmYoKS5nXCIgLSB3aGljaCBoYXMgZm91ciBjaGFpbmVkIHBhdGhzLCBcImEuYigpXCIsIFwiXmMuZCgpXCIsIFwiLmUuZigpXCIgYW5kIFwiLmdcIlxuXHRcdHBhcmVuRGVwdGggPSAwLFxuXHRcdGZuQ2FsbCA9IHt9LCAvLyBXZSBhcmUgaW4gYSBmdW5jdGlvbiBjYWxsXG5cdFx0cGF0aFN0YXJ0ID0ge30sIC8vIHRyYWNrcyB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgcGF0aCBzdWNoIGFzIGNeZCgpIGluIHRoZSBhYm92ZSBleGFtcGxlXG5cdFx0cmVzdWx0O1xuXG5cdGlmIChwYXJhbXNbMF0gPT09IFwiQFwiKSB7XG5cdFx0cGFyYW1zID0gcGFyYW1zLnJlcGxhY2UockJyYWNrZXRRdW90ZSwgXCIuXCIpO1xuXHR9XG5cdHJlc3VsdCA9IChwYXJhbXMgKyAodG1wbCA/IFwiIFwiIDogXCJcIikpLnJlcGxhY2UoJHN1Yi5yUHJtLCBwYXJzZVRva2Vucyk7XG5cblx0cmV0dXJuICFwYXJlbkRlcHRoICYmIHJlc3VsdCB8fCBzeW50YXhFcnJvcihwYXJhbXMpOyAvLyBTeW50YXggZXJyb3IgaWYgdW5iYWxhbmNlZCBwYXJlbnMgaW4gcGFyYW1zIGV4cHJlc3Npb25cbn1cblxuZnVuY3Rpb24gYnVpbGRDb2RlKGFzdCwgdG1wbCwgaXNMaW5rRXhwcikge1xuXHQvLyBCdWlsZCB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gY29kZSBmcm9tIHRoZSBBU1Qgbm9kZXMsIGFuZCBzZXQgYXMgcHJvcGVydHkgb24gdGhlIHBhc3NlZC1pbiB0ZW1wbGF0ZSBvYmplY3Rcblx0Ly8gVXNlZCBmb3IgY29tcGlsaW5nIHRlbXBsYXRlcywgYW5kIGFsc28gYnkgSnNWaWV3cyB0byBidWlsZCBmdW5jdGlvbnMgZm9yIGRhdGEgbGluayBleHByZXNzaW9uc1xuXHR2YXIgaSwgbm9kZSwgdGFnTmFtZSwgY29udmVydGVyLCB0YWdDdHgsIGhhc1RhZywgaGFzRW5jb2RlciwgZ2V0c1ZhbCwgaGFzQ252dCwgdXNlQ252dCwgdG1wbEJpbmRpbmdzLCBwYXRoQmluZGluZ3MsIHBhcmFtcywgYm91bmRPbkVyclN0YXJ0LFxuXHRcdGJvdW5kT25FcnJFbmQsIHRhZ1JlbmRlciwgbmVzdGVkVG1wbHMsIHRtcGxOYW1lLCBuZXN0ZWRUbXBsLCB0YWdBbmRFbHNlcywgY29udGVudCwgbWFya3VwLCBuZXh0SXNFbHNlLCBvbGRDb2RlLCBpc0Vsc2UsIGlzR2V0VmFsLCB0YWdDdHhGbixcblx0XHRvbkVycm9yLCB0YWdTdGFydCwgdHJpZ2dlciwgbGF0ZVJlbmRlciwgcmV0U3RyT3BlbiwgcmV0U3RyQ2xvc2UsXG5cdFx0dG1wbEJpbmRpbmdLZXkgPSAwLFxuXHRcdHVzZVZpZXdzID0gJHN1YlNldHRpbmdzQWR2YW5jZWQudXNlVmlld3MgfHwgdG1wbC51c2VWaWV3cyB8fCB0bXBsLnRhZ3MgfHwgdG1wbC50ZW1wbGF0ZXMgfHwgdG1wbC5oZWxwZXJzIHx8IHRtcGwuY29udmVydGVycyxcblx0XHRjb2RlID0gXCJcIixcblx0XHR0bXBsT3B0aW9ucyA9IHt9LFxuXHRcdGwgPSBhc3QubGVuZ3RoO1xuXG5cdGlmIChcIlwiICsgdG1wbCA9PT0gdG1wbCkge1xuXHRcdHRtcGxOYW1lID0gaXNMaW5rRXhwciA/ICdkYXRhLWxpbms9XCInICsgdG1wbC5yZXBsYWNlKHJOZXdMaW5lLCBcIiBcIikuc2xpY2UoMSwgLTEpICsgJ1wiJyA6IHRtcGw7XG5cdFx0dG1wbCA9IDA7XG5cdH0gZWxzZSB7XG5cdFx0dG1wbE5hbWUgPSB0bXBsLnRtcGxOYW1lIHx8IFwidW5uYW1lZFwiO1xuXHRcdGlmICh0bXBsLmFsbG93Q29kZSkge1xuXHRcdFx0dG1wbE9wdGlvbnMuYWxsb3dDb2RlID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRtcGwuZGVidWcpIHtcblx0XHRcdHRtcGxPcHRpb25zLmRlYnVnID0gdHJ1ZTtcblx0XHR9XG5cdFx0dG1wbEJpbmRpbmdzID0gdG1wbC5ibmRzO1xuXHRcdG5lc3RlZFRtcGxzID0gdG1wbC50bXBscztcblx0fVxuXHRmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG5cdFx0Ly8gQVNUIG5vZGVzOiBbMDogdGFnTmFtZSwgMTogY29udmVydGVyLCAyOiBjb250ZW50LCAzOiBwYXJhbXMsIDQ6IGNvZGUsIDU6IG9uRXJyb3IsIDY6IHRyaWdnZXIsIDc6cGF0aEJpbmRpbmdzLCA4OiBjb250ZW50TWFya3VwXVxuXHRcdG5vZGUgPSBhc3RbaV07XG5cblx0XHQvLyBBZGQgbmV3bGluZSBmb3IgZWFjaCBjYWxsb3V0IHRvIHQoKSBjKCkgZXRjLiBhbmQgZWFjaCBtYXJrdXAgc3RyaW5nXG5cdFx0aWYgKFwiXCIgKyBub2RlID09PSBub2RlKSB7XG5cdFx0XHQvLyBhIG1hcmt1cCBzdHJpbmcgdG8gYmUgaW5zZXJ0ZWRcblx0XHRcdGNvZGUgKz0gJ1xcbitcIicgKyBub2RlICsgJ1wiJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYSBjb21waWxlZCB0YWcgZXhwcmVzc2lvbiB0byBiZSBpbnNlcnRlZFxuXHRcdFx0dGFnTmFtZSA9IG5vZGVbMF07XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCIqXCIpIHtcblx0XHRcdFx0Ly8gQ29kZSB0YWc6IHt7KiB9fVxuXHRcdFx0XHRjb2RlICs9IFwiO1xcblwiICsgbm9kZVsxXSArIFwiXFxucmV0PXJldFwiO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udmVydGVyID0gbm9kZVsxXTtcblx0XHRcdFx0Y29udGVudCA9ICFpc0xpbmtFeHByICYmIG5vZGVbMl07XG5cdFx0XHRcdHRhZ0N0eCA9IHBhcmFtU3RydWN0dXJlKG5vZGVbM10sICdwYXJhbXMnKSArICd9LCcgKyBwYXJhbVN0cnVjdHVyZShwYXJhbXMgPSBub2RlWzRdKTtcblx0XHRcdFx0dHJpZ2dlciA9IG5vZGVbNl07XG5cdFx0XHRcdGxhdGVSZW5kZXIgPSBub2RlWzddO1xuXHRcdFx0XHRpZiAobm9kZVs4XSkgeyAvLyBsYXRlUGF0aCBAYS5iLmMgb3IgQH5hLmIuY1xuXHRcdFx0XHRcdHJldFN0ck9wZW4gPSBcIlxcbnZhciBvYixsdE9iPXt9LGN0eHM9XCI7XG5cdFx0XHRcdFx0cmV0U3RyQ2xvc2UgPSBcIjtcXG5jdHhzLmx0PWx0T2IubHQ7XFxucmV0dXJuIGN0eHM7XCI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0U3RyT3BlbiA9IFwiXFxucmV0dXJuIFwiO1xuXHRcdFx0XHRcdHJldFN0ckNsb3NlID0gXCJcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXJrdXAgPSBub2RlWzEwXSAmJiBub2RlWzEwXS5yZXBsYWNlKHJVbmVzY2FwZVF1b3RlcywgXCIkMVwiKTtcblx0XHRcdFx0aWYgKGlzRWxzZSA9IHRhZ05hbWUgPT09IFwiZWxzZVwiKSB7XG5cdFx0XHRcdFx0aWYgKHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0cGF0aEJpbmRpbmdzLnB1c2gobm9kZVs5XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG9uRXJyb3IgPSBub2RlWzVdIHx8ICRzdWJTZXR0aW5ncy5kZWJ1Z01vZGUgIT09IGZhbHNlICYmIFwidW5kZWZpbmVkXCI7IC8vIElmIGRlYnVnTW9kZSBub3QgZmFsc2UsIHNldCBkZWZhdWx0IG9uRXJyb3IgaGFuZGxlciBvbiB0YWcgdG8gXCJ1bmRlZmluZWRcIiAoc2VlIG9uUmVuZGVyRXJyb3IpXG5cdFx0XHRcdFx0aWYgKHRtcGxCaW5kaW5ncyAmJiAocGF0aEJpbmRpbmdzID0gbm9kZVs5XSkpIHsgLy8gQXJyYXkgb2YgcGF0aHMsIG9yIGZhbHNlIGlmIG5vdCBkYXRhLWJvdW5kXG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSBbcGF0aEJpbmRpbmdzXTtcblx0XHRcdFx0XHRcdHRtcGxCaW5kaW5nS2V5ID0gdG1wbEJpbmRpbmdzLnB1c2goMSk7IC8vIEFkZCBwbGFjZWhvbGRlciBpbiB0bXBsQmluZGluZ3MgZm9yIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHVzZVZpZXdzID0gdXNlVmlld3MgfHwgcGFyYW1zWzFdIHx8IHBhcmFtc1syXSB8fCBwYXRoQmluZGluZ3MgfHwgL3ZpZXcuKD8haW5kZXgpLy50ZXN0KHBhcmFtc1swXSk7XG5cdFx0XHRcdC8vIHVzZVZpZXdzIGlzIGZvciBwZXJmIG9wdGltaXphdGlvbi4gRm9yIHJlbmRlcigpIHdlIG9ubHkgdXNlIHZpZXdzIGlmIG5lY2Vzc2FyeSAtIGZvciB0aGUgbW9yZSBhZHZhbmNlZCBzY2VuYXJpb3MuXG5cdFx0XHRcdC8vIFdlIHVzZSB2aWV3cyBpZiB0aGVyZSBhcmUgcHJvcHMsIGNvbnRleHR1YWwgcHJvcGVydGllcyBvciBhcmdzIHdpdGggIy4uLiAob3RoZXIgdGhhbiAjaW5kZXgpIC0gYnV0IHlvdSBjYW4gZm9yY2Vcblx0XHRcdFx0Ly8gdXNpbmcgdGhlIGZ1bGwgdmlldyBpbmZyYXN0cnVjdHVyZSwgKGFuZCBwYXkgYSBwZXJmIHByaWNlKSBieSBvcHRpbmcgaW46IFNldCB1c2VWaWV3czogdHJ1ZSBvbiB0aGUgdGVtcGxhdGUsIG1hbnVhbGx5Li4uXG5cdFx0XHRcdGlmIChpc0dldFZhbCA9IHRhZ05hbWUgPT09IFwiOlwiKSB7XG5cdFx0XHRcdFx0aWYgKGNvbnZlcnRlcikge1xuXHRcdFx0XHRcdFx0dGFnTmFtZSA9IGNvbnZlcnRlciA9PT0gSFRNTCA/IFwiPlwiIDogY29udmVydGVyICsgdGFnTmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHsgLy8gVE9ETyBvcHRpbWl6ZSAtIGlmIGNvbnRlbnQubGVuZ3RoID09PSAwIG9yIGlmIHRoZXJlIGlzIGEgdG1wbD1cIi4uLlwiIHNwZWNpZmllZCAtIHNldCBjb250ZW50IHRvIG51bGwgLyBkb24ndCBydW4gdGhpcyBjb21waWxhdGlvbiBjb2RlIC0gc2luY2UgY29udGVudCB3b24ndCBnZXQgdXNlZCEhXG5cdFx0XHRcdFx0XHQvLyBDcmVhdGUgdGVtcGxhdGUgb2JqZWN0IGZvciBuZXN0ZWQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwgPSB0bXBsT2JqZWN0KG1hcmt1cCwgdG1wbE9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbC50bXBsTmFtZSA9IHRtcGxOYW1lICsgXCIvXCIgKyB0YWdOYW1lO1xuXHRcdFx0XHRcdFx0Ly8gQ29tcGlsZSB0byBBU1QgYW5kIHRoZW4gdG8gY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwudXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzIHx8IHVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0YnVpbGRDb2RlKGNvbnRlbnQsIG5lc3RlZFRtcGwpO1xuXHRcdFx0XHRcdFx0dXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbHMucHVzaChuZXN0ZWRUbXBsKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWlzRWxzZSkge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBub3QgYW4gZWxzZSB0YWcuXG5cdFx0XHRcdFx0XHR0YWdBbmRFbHNlcyA9IHRhZ05hbWU7XG5cdFx0XHRcdFx0XHR1c2VWaWV3cyA9IHVzZVZpZXdzIHx8IHRhZ05hbWUgJiYgKCEkdGFnc1t0YWdOYW1lXSB8fCAhJHRhZ3NbdGFnTmFtZV0uZmxvdyk7XG5cdFx0XHRcdFx0XHQvLyBTd2l0Y2ggdG8gYSBuZXcgY29kZSBzdHJpbmcgZm9yIHRoaXMgYm91bmQgdGFnIChhbmQgaXRzIGVsc2VzLCBpZiBpdCBoYXMgYW55KSAtIGZvciByZXR1cm5pbmcgdGhlIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRcdG9sZENvZGUgPSBjb2RlO1xuXHRcdFx0XHRcdFx0Y29kZSA9IFwiXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBhc3RbaSArIDFdO1xuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBuZXh0SXNFbHNlICYmIG5leHRJc0Vsc2VbMF0gPT09IFwiZWxzZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRhZ1N0YXJ0ID0gb25FcnJvciA/IFwiO1xcbnRyeXtcXG5yZXQrPVwiIDogXCJcXG4rXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IFwiXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIlwiO1xuXG5cdFx0XHRcdGlmIChpc0dldFZhbCAmJiAocGF0aEJpbmRpbmdzIHx8IHRyaWdnZXIgfHwgY29udmVydGVyICYmIGNvbnZlcnRlciAhPT0gSFRNTCB8fCBsYXRlUmVuZGVyKSkge1xuXHRcdFx0XHRcdC8vIEZvciBjb252ZXJ0VmFsIHdlIG5lZWQgYSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIG5ldyB0YWdDdHgocylcblx0XHRcdFx0XHR0YWdDdHhGbiA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqLHVcIiwgXCIvLyBcIiArIHRtcGxOYW1lICsgXCIgXCIgKyAoKyt0bXBsQmluZGluZ0tleSkgKyBcIiBcIiArIHRhZ05hbWVcblx0XHRcdFx0XHRcdCsgcmV0U3RyT3BlbiArIFwie1wiICsgdGFnQ3R4ICsgXCJ9O1wiICsgcmV0U3RyQ2xvc2UpO1xuXHRcdFx0XHRcdHRhZ0N0eEZuLl9lciA9IG9uRXJyb3I7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX3RhZyA9IHRhZ05hbWU7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX2JkID0gISFwYXRoQmluZGluZ3M7IC8vIGRhdGEtbGlua2VkIHRhZyB7XnsuLi4vfX1cblx0XHRcdFx0XHR0YWdDdHhGbi5fbHIgPSBsYXRlUmVuZGVyO1xuXG5cdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0YWdDdHhGbjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzZXRQYXRocyh0YWdDdHhGbiwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHR0YWdSZW5kZXIgPSAnYyhcIicgKyBjb252ZXJ0ZXIgKyAnXCIsdmlldywnO1xuXHRcdFx0XHRcdHVzZUNudnQgPSB0cnVlO1xuXHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsXCI7XG5cdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvZGUgKz0gKGlzR2V0VmFsXG5cdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/IChvbkVycm9yID8gXCJ0cnl7XFxuXCIgOiBcIlwiKSArIFwicmV0dXJuIFwiIDogdGFnU3RhcnQpICsgKHVzZUNudnQgLy8gQ2FsbCBfY252dCBpZiB0aGVyZSBpcyBhIGNvbnZlcnRlcjoge3tjbnZ0OiAuLi4gfX0gb3Ige157Y252dDogLi4uIH19XG5cdFx0XHRcdFx0XHQ/ICh1c2VDbnZ0ID0gdW5kZWZpbmVkLCB1c2VWaWV3cyA9IGhhc0NudnQgPSB0cnVlLCB0YWdSZW5kZXIgKyAodGFnQ3R4Rm5cblx0XHRcdFx0XHRcdFx0PyAoKHRtcGxCaW5kaW5nc1t0bXBsQmluZGluZ0tleSAtIDFdID0gdGFnQ3R4Rm4pLCB0bXBsQmluZGluZ0tleSkgLy8gU3RvcmUgdGhlIGNvbXBpbGVkIHRhZ0N0eEZuIGluIHRtcGwuYm5kcywgYW5kIHBhc3MgdGhlIGtleSB0byBjb252ZXJ0VmFsKClcblx0XHRcdFx0XHRcdFx0OiBcIntcIiArIHRhZ0N0eCArIFwifVwiKSArIFwiKVwiKVxuXHRcdFx0XHRcdFx0OiB0YWdOYW1lID09PSBcIj5cIlxuXHRcdFx0XHRcdFx0XHQ/IChoYXNFbmNvZGVyID0gdHJ1ZSwgXCJoKFwiICsgcGFyYW1zWzBdICsgXCIpXCIpXG5cdFx0XHRcdFx0XHRcdDogKGdldHNWYWwgPSB0cnVlLCBcIigodj1cIiArIHBhcmFtc1swXSArICcpIT1udWxsP3Y6JyArIChpc0xpbmtFeHByID8gJ251bGwpJyA6ICdcIlwiKScpKVxuXHRcdFx0XHRcdFx0XHQvLyBOb24gc3RyaWN0IGVxdWFsaXR5IHNvIGRhdGEtbGluaz1cInRpdGxlezpleHByfVwiIHdpdGggZXhwcj1udWxsL3VuZGVmaW5lZCByZW1vdmVzIHRpdGxlIGF0dHJpYnV0ZVxuXHRcdFx0XHRcdClcblx0XHRcdFx0XHQ6IChoYXNUYWcgPSB0cnVlLCBcIlxcbnt2aWV3OnZpZXcsY29udGVudDpmYWxzZSx0bXBsOlwiIC8vIEFkZCB0aGlzIHRhZ0N0eCB0byB0aGUgY29tcGlsZWQgY29kZSBmb3IgdGhlIHRhZ0N0eHMgdG8gYmUgcGFzc2VkIHRvIHJlbmRlclRhZygpXG5cdFx0XHRcdFx0XHQrIChjb250ZW50ID8gbmVzdGVkVG1wbHMubGVuZ3RoIDogXCJmYWxzZVwiKSArIFwiLFwiIC8vIEZvciBibG9jayB0YWdzLCBwYXNzIGluIHRoZSBrZXkgKG5lc3RlZFRtcGxzLmxlbmd0aCkgdG8gdGhlIG5lc3RlZCBjb250ZW50IHRlbXBsYXRlXG5cdFx0XHRcdFx0XHQrIHRhZ0N0eCArIFwifSxcIikpO1xuXG5cdFx0XHRcdGlmICh0YWdBbmRFbHNlcyAmJiAhbmV4dElzRWxzZSkge1xuXHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiBvciBhbiBpbmxpbmUgdGFnIHdpdGhvdXQgYW55IGVsc2VzLCBvciB0aGUgbGFzdCB7e2Vsc2V9fSBvZiBhbiBpbmxpbmUgdGFnXG5cdFx0XHRcdFx0Ly8gV2UgY29tcGxldGUgdGhlIGNvZGUgZm9yIHJldHVybmluZyB0aGUgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdGNvZGUgPSBcIltcIiArIGNvZGUuc2xpY2UoMCwgLTEpICsgXCJdXCI7XG5cdFx0XHRcdFx0dGFnUmVuZGVyID0gJ3QoXCInICsgdGFnQW5kRWxzZXMgKyAnXCIsdmlldyx0aGlzLCc7XG5cdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIgfHwgcGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGlzIGlzIGEgYm91bmQgdGFnIChkYXRhLWxpbmsgZXhwcmVzc2lvbiBvciBpbmxpbmUgYm91bmQgdGFnIHtee3RhZyAuLi59fSkgc28gd2Ugc3RvcmUgYSBjb21waWxlZCB0YWdDdHhzIGZ1bmN0aW9uIGluIHRtcC5ibmRzXG5cdFx0XHRcdFx0XHRjb2RlID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGosdVwiLCBcIiAvLyBcIiArIHRtcGxOYW1lICsgXCIgXCIgKyB0bXBsQmluZGluZ0tleSArIFwiIFwiICsgdGFnQW5kRWxzZXMgKyByZXRTdHJPcGVuICsgY29kZVxuXHRcdFx0XHRcdFx0XHQrIHJldFN0ckNsb3NlKTtcblx0XHRcdFx0XHRcdGNvZGUuX2VyID0gb25FcnJvcjtcblx0XHRcdFx0XHRcdGNvZGUuX3RhZyA9IHRhZ0FuZEVsc2VzO1xuXHRcdFx0XHRcdFx0aWYgKHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0XHRzZXRQYXRocyh0bXBsQmluZGluZ3NbdG1wbEJpbmRpbmdLZXkgLSAxXSA9IGNvZGUsIHBhdGhCaW5kaW5ncyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb2RlLl9sciA9IGxhdGVSZW5kZXI7XG5cdFx0XHRcdFx0XHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY29kZTsgLy8gRm9yIGEgZGF0YS1saW5rIGV4cHJlc3Npb24gd2UgcmV0dXJuIHRoZSBjb21waWxlZCB0YWdDdHhzIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRib3VuZE9uRXJyU3RhcnQgPSB0YWdSZW5kZXIgKyB0bXBsQmluZGluZ0tleSArIFwiLHVuZGVmaW5lZCxcIjtcblx0XHRcdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIilcIjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBUaGlzIGlzIHRoZSBsYXN0IHt7ZWxzZX19IGZvciBhbiBpbmxpbmUgdGFnLlxuXHRcdFx0XHRcdC8vIEZvciBhIGJvdW5kIHRhZywgcGFzcyB0aGUgdGFnQ3R4cyBmbiBsb29rdXAga2V5IHRvIHJlbmRlclRhZy5cblx0XHRcdFx0XHQvLyBGb3IgYW4gdW5ib3VuZCB0YWcsIGluY2x1ZGUgdGhlIGNvZGUgZGlyZWN0bHkgZm9yIGV2YWx1YXRpbmcgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdGNvZGUgPSBvbGRDb2RlICsgdGFnU3RhcnQgKyB0YWdSZW5kZXIgKyAocGF0aEJpbmRpbmdzICYmIHRtcGxCaW5kaW5nS2V5IHx8IGNvZGUpICsgXCIpXCI7XG5cdFx0XHRcdFx0cGF0aEJpbmRpbmdzID0gMDtcblx0XHRcdFx0XHR0YWdBbmRFbHNlcyA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9uRXJyb3IgJiYgIW5leHRJc0Vsc2UpIHtcblx0XHRcdFx0XHR1c2VWaWV3cyA9IHRydWU7XG5cdFx0XHRcdFx0Y29kZSArPSAnO1xcbn1jYXRjaChlKXtyZXQnICsgKGlzTGlua0V4cHIgPyBcInVybiBcIiA6IFwiKz1cIikgKyBib3VuZE9uRXJyU3RhcnQgKyAnai5fZXJyKGUsdmlldywnICsgb25FcnJvciArICcpJyArIGJvdW5kT25FcnJFbmQgKyAnO30nICsgKGlzTGlua0V4cHIgPyBcIlwiIDogJ3JldD1yZXQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHQvLyBJbmNsdWRlIG9ubHkgdGhlIHZhciByZWZlcmVuY2VzIHRoYXQgYXJlIG5lZWRlZCBpbiB0aGUgY29kZVxuXHRjb2RlID0gXCIvLyBcIiArIHRtcGxOYW1lXG5cdFx0KyAodG1wbE9wdGlvbnMuZGVidWcgPyBcIlxcbmRlYnVnZ2VyO1wiIDogXCJcIilcblx0XHQrIFwiXFxudmFyIHZcIlxuXHRcdCsgKGhhc1RhZyA/IFwiLHQ9ai5fdGFnXCIgOiBcIlwiKSAgICAgICAgICAgICAgICAvLyBoYXMgdGFnXG5cdFx0KyAoaGFzQ252dCA/IFwiLGM9ai5fY252dFwiIDogXCJcIikgICAgICAgICAgICAgIC8vIGNvbnZlcnRlclxuXHRcdCsgKGhhc0VuY29kZXIgPyBcIixoPWouX2h0bWxcIiA6IFwiXCIpICAgICAgICAgICAvLyBodG1sIGNvbnZlcnRlclxuXHRcdCsgKGlzTGlua0V4cHJcblx0XHRcdFx0PyAobm9kZVs4XSAgLy8gbGF0ZSBALi4uIHBhdGg/XG5cdFx0XHRcdFx0XHQ/IFwiLCBvYlwiXG5cdFx0XHRcdFx0XHQ6IFwiXCJcblx0XHRcdFx0XHQpICsgXCI7XFxuXCJcblx0XHRcdFx0OiAnLHJldD1cIlwiJylcblx0XHQrIGNvZGVcblx0XHQrIChpc0xpbmtFeHByID8gXCJcXG5cIiA6IFwiO1xcbnJldHVybiByZXQ7XCIpO1xuXG5cdHRyeSB7XG5cdFx0Y29kZSA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqLHVcIiwgY29kZSk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRzeW50YXhFcnJvcihcIkNvbXBpbGVkIHRlbXBsYXRlIGNvZGU6XFxuXFxuXCIgKyBjb2RlICsgJ1xcbjogXCInICsgKGUubWVzc2FnZXx8ZSkgKyAnXCInKTtcblx0fVxuXHRpZiAodG1wbCkge1xuXHRcdHRtcGwuZm4gPSBjb2RlO1xuXHRcdHRtcGwudXNlVmlld3MgPSAhIXVzZVZpZXdzO1xuXHR9XG5cdHJldHVybiBjb2RlO1xufVxuXG4vLz09PT09PT09PT1cbi8vIFV0aWxpdGllc1xuLy89PT09PT09PT09XG5cbi8vIE1lcmdlIG9iamVjdHMsIGluIHBhcnRpY3VsYXIgY29udGV4dHMgd2hpY2ggaW5oZXJpdCBmcm9tIHBhcmVudCBjb250ZXh0c1xuZnVuY3Rpb24gZXh0ZW5kQ3R4KGNvbnRleHQsIHBhcmVudENvbnRleHQpIHtcblx0Ly8gUmV0dXJuIGNvcHkgb2YgcGFyZW50Q29udGV4dCwgdW5sZXNzIGNvbnRleHQgaXMgZGVmaW5lZCBhbmQgaXMgZGlmZmVyZW50LCBpbiB3aGljaCBjYXNlIHJldHVybiBhIG5ldyBtZXJnZWQgY29udGV4dFxuXHQvLyBJZiBuZWl0aGVyIGNvbnRleHQgbm9yIHBhcmVudENvbnRleHQgYXJlIGRlZmluZWQsIHJldHVybiB1bmRlZmluZWRcblx0cmV0dXJuIGNvbnRleHQgJiYgY29udGV4dCAhPT0gcGFyZW50Q29udGV4dFxuXHRcdD8gKHBhcmVudENvbnRleHRcblx0XHRcdD8gJGV4dGVuZCgkZXh0ZW5kKHt9LCBwYXJlbnRDb250ZXh0KSwgY29udGV4dClcblx0XHRcdDogY29udGV4dClcblx0XHQ6IHBhcmVudENvbnRleHQgJiYgJGV4dGVuZCh7fSwgcGFyZW50Q29udGV4dCk7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFByb3BzKHNvdXJjZSwgdGFnQ3R4KSB7XG5cdC8vIHRoaXMgcG9pbnRlciBpcyB0aGVNYXAgLSB3aGljaCBoYXMgdGFnQ3R4LnByb3BzIHRvb1xuXHQvLyBhcmd1bWVudHM6IHRhZ0N0eC5hcmdzLlxuXHR2YXIga2V5LCBwcm9wLFxuXHRcdG1hcCA9IHRhZ0N0eC5tYXAsXG5cdFx0cHJvcHNBcnIgPSBtYXAgJiYgbWFwLnByb3BzQXJyO1xuXG5cdGlmICghcHJvcHNBcnIpIHsgLy8gbWFwLnByb3BzQXJyIGlzIHRoZSBmdWxsIGFycmF5IG9mIHtrZXk6Li4uLCBwcm9wOi4uLn0gb2JqZWN0c1xuXHRcdHByb3BzQXJyID0gW107XG5cdFx0aWYgKHR5cGVvZiBzb3VyY2UgPT09IE9CSkVDVCB8fCAkaXNGdW5jdGlvbihzb3VyY2UpKSB7XG5cdFx0XHRmb3IgKGtleSBpbiBzb3VyY2UpIHtcblx0XHRcdFx0cHJvcCA9IHNvdXJjZVtrZXldO1xuXHRcdFx0XHRpZiAoa2V5ICE9PSAkZXhwYW5kbyAmJiBzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoIXRhZ0N0eC5wcm9wcy5ub0Z1bmN0aW9ucyB8fCAhJC5pc0Z1bmN0aW9uKHByb3ApKSkge1xuXHRcdFx0XHRcdHByb3BzQXJyLnB1c2goe2tleToga2V5LCBwcm9wOiBwcm9wfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKG1hcCkge1xuXHRcdFx0bWFwLnByb3BzQXJyID0gbWFwLm9wdGlvbnMgJiYgcHJvcHNBcnI7IC8vIElmIGJvdW5kIHtee3Byb3BzfX0gYW5kIG5vdCBpc1JlbmRlckNhbGwsIHN0b3JlIHByb3BzQXJyIG9uIG1hcCAobWFwLm9wdGlvbnMgaXMgZGVmaW5lZCBvbmx5IGZvciBib3VuZCwgJiYgIWlzUmVuZGVyQ2FsbClcblx0XHR9XG5cdH1cblx0cmV0dXJuIGdldFRhcmdldFNvcnRlZChwcm9wc0FyciwgdGFnQ3R4KTsgLy8gT2J0YWlucyBtYXAudGd0LCBieSBmaWx0ZXJpbmcsIHNvcnRpbmcgYW5kIHNwbGljaW5nIHRoZSBmdWxsIHByb3BzQXJyXG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFNvcnRlZCh2YWx1ZSwgdGFnQ3R4KSB7XG5cdC8vIGdldFRndFxuXHR2YXIgbWFwcGVkLCBzdGFydCwgZW5kLFxuXHRcdHRhZyA9IHRhZ0N0eC50YWcsXG5cdFx0cHJvcHMgPSB0YWdDdHgucHJvcHMsXG5cdFx0cHJvcFBhcmFtcyA9IHRhZ0N0eC5wYXJhbXMucHJvcHMsXG5cdFx0ZmlsdGVyID0gcHJvcHMuZmlsdGVyLFxuXHRcdHNvcnQgPSBwcm9wcy5zb3J0LFxuXHRcdGRpcmVjdFNvcnQgPSBzb3J0ID09PSB0cnVlLFxuXHRcdHN0ZXAgPSBwYXJzZUludChwcm9wcy5zdGVwKSxcblx0XHRyZXZlcnNlID0gcHJvcHMucmV2ZXJzZSA/IC0xIDogMTtcblxuXHRpZiAoISRpc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXHRpZiAoZGlyZWN0U29ydCB8fCBzb3J0ICYmIFwiXCIgKyBzb3J0ID09PSBzb3J0KSB7XG5cdFx0Ly8gVGVtcG9yYXJ5IG1hcHBlZCBhcnJheSBob2xkcyBvYmplY3RzIHdpdGggaW5kZXggYW5kIHNvcnQtdmFsdWVcblx0XHRtYXBwZWQgPSB2YWx1ZS5tYXAoZnVuY3Rpb24oaXRlbSwgaSkge1xuXHRcdFx0aXRlbSA9IGRpcmVjdFNvcnQgPyBpdGVtIDogZ2V0UGF0aE9iamVjdChpdGVtLCBzb3J0KTtcblx0XHRcdHJldHVybiB7aTogaSwgdjogXCJcIiArIGl0ZW0gPT09IGl0ZW0gPyBpdGVtLnRvTG93ZXJDYXNlKCkgOiBpdGVtfTtcblx0XHR9KTtcblx0XHQvLyBTb3J0IG1hcHBlZCBhcnJheVxuXHRcdG1hcHBlZC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcblx0XHRcdHJldHVybiBhLnYgPiBiLnYgPyByZXZlcnNlIDogYS52IDwgYi52ID8gLXJldmVyc2UgOiAwO1xuXHRcdH0pO1xuXHRcdC8vIE1hcCB0byBuZXcgYXJyYXkgd2l0aCByZXN1bHRpbmcgb3JkZXJcblx0XHR2YWx1ZSA9IG1hcHBlZC5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRyZXR1cm4gdmFsdWVbaXRlbS5pXTtcblx0XHR9KTtcblx0fSBlbHNlIGlmICgoc29ydCB8fCByZXZlcnNlIDwgMCkgJiYgIXRhZy5kYXRhTWFwKSB7XG5cdFx0dmFsdWUgPSB2YWx1ZS5zbGljZSgpOyAvLyBDbG9uZSBhcnJheSBmaXJzdCBpZiBub3QgYWxyZWFkeSBhIG5ldyBhcnJheVxuXHR9XG5cdGlmICgkaXNGdW5jdGlvbihzb3J0KSkge1xuXHRcdHZhbHVlID0gdmFsdWUuc29ydChmdW5jdGlvbigpIHsgLy8gV3JhcCB0aGUgc29ydCBmdW5jdGlvbiB0byBwcm92aWRlIHRhZ0N0eCBhcyAndGhpcycgcG9pbnRlclxuXHRcdFx0cmV0dXJuIHNvcnQuYXBwbHkodGFnQ3R4LCBhcmd1bWVudHMpO1xuXHRcdH0pO1xuXHR9XG5cdGlmIChyZXZlcnNlIDwgMCAmJiAoIXNvcnQgfHwgJGlzRnVuY3Rpb24oc29ydCkpKSB7IC8vIFJldmVyc2UgcmVzdWx0IGlmIG5vdCBhbHJlYWR5IHJldmVyc2VkIGluIHNvcnRcblx0XHR2YWx1ZSA9IHZhbHVlLnJldmVyc2UoKTtcblx0fVxuXG5cdGlmICh2YWx1ZS5maWx0ZXIgJiYgZmlsdGVyKSB7IC8vIElFOCBkb2VzIG5vdCBzdXBwb3J0IGZpbHRlclxuXHRcdHZhbHVlID0gdmFsdWUuZmlsdGVyKGZpbHRlciwgdGFnQ3R4KTtcblx0XHRpZiAodGFnQ3R4LnRhZy5vbkZpbHRlcikge1xuXHRcdFx0dGFnQ3R4LnRhZy5vbkZpbHRlcih0YWdDdHgpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChwcm9wUGFyYW1zLnNvcnRlZCkge1xuXHRcdG1hcHBlZCA9IChzb3J0IHx8IHJldmVyc2UgPCAwKSA/IHZhbHVlIDogdmFsdWUuc2xpY2UoKTtcblx0XHRpZiAodGFnLnNvcnRlZCkge1xuXHRcdFx0JC5vYnNlcnZhYmxlKHRhZy5zb3J0ZWQpLnJlZnJlc2gobWFwcGVkKTsgLy8gTm90ZSB0aGF0IHRoaXMgbWlnaHQgY2F1c2UgdGhlIHN0YXJ0IGFuZCBlbmQgcHJvcHMgdG8gYmUgbW9kaWZpZWQgLSBlLmcuIGJ5IHBhZ2VyIHRhZyBjb250cm9sXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhZ0N0eC5tYXAuc29ydGVkID0gbWFwcGVkO1xuXHRcdH1cblx0fVxuXG5cdHN0YXJ0ID0gcHJvcHMuc3RhcnQ7IC8vIEdldCBjdXJyZW50IHZhbHVlIC0gYWZ0ZXIgcG9zc2libGUgIGNoYW5nZXMgdHJpZ2dlcmVkIGJ5IHRhZy5zb3J0ZWQgcmVmcmVzaCgpIGFib3ZlXG5cdGVuZCA9IHByb3BzLmVuZDtcblx0aWYgKHByb3BQYXJhbXMuc3RhcnQgJiYgc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBwcm9wUGFyYW1zLmVuZCAmJiBlbmQgPT09IHVuZGVmaW5lZCkge1xuXHRcdHN0YXJ0ID0gZW5kID0gMDtcblx0fVxuXHRpZiAoIWlzTmFOKHN0YXJ0KSB8fCAhaXNOYU4oZW5kKSkgeyAvLyBzdGFydCBvciBlbmQgc3BlY2lmaWVkLCBidXQgbm90IHRoZSBhdXRvLWNyZWF0ZSBOdW1iZXIgYXJyYXkgc2NlbmFyaW8gb2Yge3tmb3Igc3RhcnQ9eHh4IGVuZD15eXl9fVxuXHRcdHN0YXJ0ID0gK3N0YXJ0IHx8IDA7XG5cdFx0ZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdmFsdWUubGVuZ3RoID8gdmFsdWUubGVuZ3RoIDogK2VuZDtcblx0XHR2YWx1ZSA9IHZhbHVlLnNsaWNlKHN0YXJ0LCBlbmQpO1xuXHR9XG5cdGlmIChzdGVwID4gMSkge1xuXHRcdHN0YXJ0ID0gMDtcblx0XHRlbmQgPSB2YWx1ZS5sZW5ndGg7XG5cdFx0bWFwcGVkID0gW107XG5cdFx0Zm9yICg7IHN0YXJ0PGVuZDsgc3RhcnQrPXN0ZXApIHtcblx0XHRcdG1hcHBlZC5wdXNoKHZhbHVlW3N0YXJ0XSk7XG5cdFx0fVxuXHRcdHZhbHVlID0gbWFwcGVkO1xuXHR9XG5cdGlmIChwcm9wUGFyYW1zLnBhZ2VkICYmIHRhZy5wYWdlZCkge1xuXHRcdCRvYnNlcnZhYmxlKHRhZy5wYWdlZCkucmVmcmVzaCh2YWx1ZSk7XG5cdH1cblxuXHRyZXR1cm4gdmFsdWU7XG59XG5cbi8qKiBSZW5kZXIgdGhlIHRlbXBsYXRlIGFzIGEgc3RyaW5nLCB1c2luZyB0aGUgc3BlY2lmaWVkIGRhdGEgYW5kIGhlbHBlcnMvY29udGV4dFxuKiAkKFwiI3RtcGxcIikucmVuZGVyKClcbipcbiogQHBhcmFtIHthbnl9ICAgICAgICBkYXRhXG4qIEBwYXJhbSB7aGFzaH0gICAgICAgW2hlbHBlcnNPckNvbnRleHRdXG4qIEBwYXJhbSB7Ym9vbGVhbn0gICAgW25vSXRlcmF0aW9uXVxuKiBAcmV0dXJucyB7c3RyaW5nfSAgIHJlbmRlcmVkIHRlbXBsYXRlXG4qL1xuZnVuY3Rpb24gJGZuUmVuZGVyKGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uKSB7XG5cdHZhciB0bXBsRWxlbSA9IHRoaXMuanF1ZXJ5ICYmICh0aGlzWzBdIHx8IGVycm9yKCdVbmtub3duIHRlbXBsYXRlJykpLCAvLyBUYXJnZXRlZCBlbGVtZW50IG5vdCBmb3VuZCBmb3IgalF1ZXJ5IHRlbXBsYXRlIHNlbGVjdG9yIHN1Y2ggYXMgXCIjbXlUbXBsXCJcblx0XHR0bXBsID0gdG1wbEVsZW0uZ2V0QXR0cmlidXRlKHRtcGxBdHRyKTtcblxuXHRyZXR1cm4gcmVuZGVyQ29udGVudC5jYWxsKHRtcGwgJiYgJC5kYXRhKHRtcGxFbGVtKVtqc3ZUbXBsXSB8fCAkdGVtcGxhdGVzKHRtcGxFbGVtKSxcblx0XHRkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbik7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0ZXIgY29udmVydGVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBnZXRDaGFyRW50aXR5KGNoKSB7XG5cdC8vIEdldCBjaGFyYWN0ZXIgZW50aXR5IGZvciBIVE1MLCBBdHRyaWJ1dGUgYW5kIG9wdGlvbmFsIGRhdGEgZW5jb2Rpbmdcblx0cmV0dXJuIGNoYXJFbnRpdGllc1tjaF0gfHwgKGNoYXJFbnRpdGllc1tjaF0gPSBcIiYjXCIgKyBjaC5jaGFyQ29kZUF0KDApICsgXCI7XCIpO1xufVxuXG5mdW5jdGlvbiBnZXRDaGFyRnJvbUVudGl0eShtYXRjaCwgdG9rZW4pIHtcblx0Ly8gR2V0IGNoYXJhY3RlciBmcm9tIEhUTUwgZW50aXR5LCBmb3Igb3B0aW9uYWwgZGF0YSB1bmVuY29kaW5nXG5cdHJldHVybiBjaGFyc0Zyb21FbnRpdGllc1t0b2tlbl0gfHwgXCJcIjtcbn1cblxuZnVuY3Rpb24gaHRtbEVuY29kZSh0ZXh0KSB7XG5cdC8vIEhUTUwgZW5jb2RlOiBSZXBsYWNlIDwgPiAmICcgXCIgYCBldGMuIGJ5IGNvcnJlc3BvbmRpbmcgZW50aXRpZXMuXG5cdHJldHVybiB0ZXh0ICE9IHVuZGVmaW5lZCA/IHJJc0h0bWwudGVzdCh0ZXh0KSAmJiAoXCJcIiArIHRleHQpLnJlcGxhY2Uockh0bWxFbmNvZGUsIGdldENoYXJFbnRpdHkpIHx8IHRleHQgOiBcIlwiO1xufVxuXG5mdW5jdGlvbiBkYXRhRW5jb2RlKHRleHQpIHtcblx0Ly8gRW5jb2RlIGp1c3QgPCA+IGFuZCAmIC0gaW50ZW5kZWQgZm9yICdzYWZlIGRhdGEnIGFsb25nIHdpdGgge3s6fX0gcmF0aGVyIHRoYW4ge3s+fX1cbiAgcmV0dXJuIFwiXCIgKyB0ZXh0ID09PSB0ZXh0ID8gdGV4dC5yZXBsYWNlKHJEYXRhRW5jb2RlLCBnZXRDaGFyRW50aXR5KSA6IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGRhdGFVbmVuY29kZSh0ZXh0KSB7XG4gIC8vIFVuZW5jb2RlIGp1c3QgPCA+IGFuZCAmIC0gaW50ZW5kZWQgZm9yICdzYWZlIGRhdGEnIGFsb25nIHdpdGgge3s6fX0gcmF0aGVyIHRoYW4ge3s+fX1cbiAgcmV0dXJuIFwiXCIgKyB0ZXh0ID09PSB0ZXh0ID8gdGV4dC5yZXBsYWNlKHJEYXRhVW5lbmNvZGUsIGdldENoYXJGcm9tRW50aXR5KSA6IHRleHQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gSW5pdGlhbGl6ZSA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4kc3ViID0gJHZpZXdzLnN1YjtcbiR2aWV3c1NldHRpbmdzID0gJHZpZXdzLnNldHRpbmdzO1xuXG5pZiAoIShqc3IgfHwgJCAmJiAkLnJlbmRlcikpIHtcblx0Ly8gSnNSZW5kZXIgbm90IGFscmVhZHkgbG9hZGVkLCBvciBsb2FkZWQgd2l0aG91dCBqUXVlcnksIGFuZCB3ZSBhcmUgbm93IG1vdmluZyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXBhY2Vcblx0Zm9yIChqc3ZTdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0cmVnaXN0ZXJTdG9yZShqc3ZTdG9yZU5hbWUsIGpzdlN0b3Jlc1tqc3ZTdG9yZU5hbWVdKTtcblx0fVxuXG5cdCRjb252ZXJ0ZXJzID0gJHZpZXdzLmNvbnZlcnRlcnM7XG5cdCRoZWxwZXJzID0gJHZpZXdzLmhlbHBlcnM7XG5cdCR0YWdzID0gJHZpZXdzLnRhZ3M7XG5cblx0JHN1Yi5fdGcucHJvdG90eXBlID0ge1xuXHRcdGJhc2VBcHBseTogYmFzZUFwcGx5LFxuXHRcdGN2dEFyZ3M6IGNvbnZlcnRBcmdzLFxuXHRcdGJuZEFyZ3M6IGNvbnZlcnRCb3VuZEFyZ3MsXG5cdFx0Y3R4UHJtOiBjb250ZXh0UGFyYW1ldGVyXG5cdH07XG5cblx0dG9wVmlldyA9ICRzdWIudG9wVmlldyA9IG5ldyBWaWV3KCk7XG5cblx0Ly9CUk9XU0VSLVNQRUNJRklDIENPREVcblx0aWYgKCQpIHtcblxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSAoPSAkKSBpcyBsb2FkZWRcblxuXHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdGlmICgkLm9ic2VydmFibGUpIHtcblx0XHRcdGlmICh2ZXJzaW9uTnVtYmVyICE9PSAodmVyc2lvbk51bWJlciA9ICQudmlld3MuanN2aWV3cykpIHtcblx0XHRcdFx0Ly8gRGlmZmVyZW50IHZlcnNpb24gb2YganNSZW5kZXIgd2FzIGxvYWRlZFxuXHRcdFx0XHR0aHJvdyBcIkpzT2JzZXJ2YWJsZSByZXF1aXJlcyBKc1JlbmRlciBcIiArIHZlcnNpb25OdW1iZXI7XG5cdFx0XHR9XG5cdFx0XHQkZXh0ZW5kKCRzdWIsICQudmlld3Muc3ViKTsgLy8ganF1ZXJ5Lm9ic2VydmFibGUuanMgd2FzIGxvYWRlZCBiZWZvcmUganNyZW5kZXIuanNcblx0XHRcdCR2aWV3cy5tYXAgPSAkLnZpZXdzLm1hcDtcblx0XHR9XG5cblx0fSBlbHNlIHtcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHQvLyBqUXVlcnkgaXMgbm90IGxvYWRlZC5cblxuXHRcdCQgPSB7fTtcblxuXHRcdGlmIChzZXRHbG9iYWxzKSB7XG5cdFx0XHRnbG9iYWwuanNyZW5kZXIgPSAkOyAvLyBXZSBhcmUgbG9hZGluZyBqc3JlbmRlci5qcyBmcm9tIGEgc2NyaXB0IGVsZW1lbnQsIG5vdCBBTUQgb3IgQ29tbW9uSlMsIHNvIHNldCBnbG9iYWxcblx0XHR9XG5cblx0XHQvLyBFcnJvciB3YXJuaW5nIGlmIGpzcmVuZGVyLmpzIGlzIHVzZWQgYXMgdGVtcGxhdGUgZW5naW5lIG9uIE5vZGUuanMgKGUuZy4gRXhwcmVzcyBvciBIYXBpLi4uKVxuXHRcdC8vIFVzZSBqc3JlbmRlci1ub2RlLmpzIGluc3RlYWQuLi5cblx0XHQkLnJlbmRlckZpbGUgPSAkLl9fZXhwcmVzcyA9ICQuY29tcGlsZSA9IGZ1bmN0aW9uKCkgeyB0aHJvdyBcIk5vZGUuanM6IHVzZSBucG0ganNyZW5kZXIsIG9yIGpzcmVuZGVyLW5vZGUuanNcIjsgfTtcblxuXHRcdC8vRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdCQuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIG9iID09PSBcImZ1bmN0aW9uXCI7XG5cdFx0fTtcblxuXHRcdCQuaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG5cdFx0XHRyZXR1cm4gKHt9LnRvU3RyaW5nKS5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcblx0XHR9O1xuXG5cdFx0JHN1Yi5fanEgPSBmdW5jdGlvbihqcSkgeyAvLyBwcml2YXRlIG1ldGhvZCB0byBtb3ZlIGZyb20gSnNSZW5kZXIgQVBJcyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXNwYWNlXG5cdFx0XHRpZiAoanEgIT09ICQpIHtcblx0XHRcdFx0JGV4dGVuZChqcSwgJCk7IC8vIG1hcCBvdmVyIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdFx0JCA9IGpxO1xuXHRcdFx0XHQkLmZuLnJlbmRlciA9ICRmblJlbmRlcjtcblx0XHRcdFx0ZGVsZXRlICQuanNyZW5kZXI7XG5cdFx0XHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQkLmpzcmVuZGVyID0gdmVyc2lvbk51bWJlcjtcblx0fVxuXHQkc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuXHQkc3ViU2V0dGluZ3MuYWxsb3dDb2RlID0gZmFsc2U7XG5cdCRpc0Z1bmN0aW9uID0gJC5pc0Z1bmN0aW9uO1xuXHQkLnJlbmRlciA9ICRyZW5kZXI7XG5cdCQudmlld3MgPSAkdmlld3M7XG5cdCQudGVtcGxhdGVzID0gJHRlbXBsYXRlcyA9ICR2aWV3cy50ZW1wbGF0ZXM7XG5cblx0Zm9yIChzZXR0aW5nIGluICRzdWJTZXR0aW5ncykge1xuXHRcdGFkZFNldHRpbmcoc2V0dGluZyk7XG5cdH1cblxuXHQvKipcblx0KiAkLnZpZXdzLnNldHRpbmdzLmRlYnVnTW9kZSh0cnVlKVxuXHQqIEBwYXJhbSB7Ym9vbGVhbn0gIGRlYnVnTW9kZVxuXHQqIEByZXR1cm5zIHtTZXR0aW5nc31cblx0KlxuXHQqIGRlYnVnTW9kZSA9ICQudmlld3Muc2V0dGluZ3MuZGVidWdNb2RlKClcblx0KiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0Ki9cblx0KCR2aWV3c1NldHRpbmdzLmRlYnVnTW9kZSA9IGZ1bmN0aW9uKGRlYnVnTW9kZSkge1xuXHRcdHJldHVybiBkZWJ1Z01vZGUgPT09IHVuZGVmaW5lZFxuXHRcdFx0PyAkc3ViU2V0dGluZ3MuZGVidWdNb2RlXG5cdFx0XHQ6IChcblx0XHRcdFx0JHN1YlNldHRpbmdzLmRlYnVnTW9kZSA9IGRlYnVnTW9kZSxcblx0XHRcdFx0JHN1YlNldHRpbmdzLm9uRXJyb3IgPSBkZWJ1Z01vZGUgKyBcIlwiID09PSBkZWJ1Z01vZGVcblx0XHRcdFx0XHQ/IGZ1bmN0aW9uKCkgeyByZXR1cm4gZGVidWdNb2RlOyB9XG5cdFx0XHRcdFx0OiAkaXNGdW5jdGlvbihkZWJ1Z01vZGUpXG5cdFx0XHRcdFx0XHQ/IGRlYnVnTW9kZVxuXHRcdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRcdCR2aWV3c1NldHRpbmdzKTtcblx0fSkoZmFsc2UpOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcblxuXHQkc3ViU2V0dGluZ3NBZHZhbmNlZCA9ICRzdWJTZXR0aW5ncy5hZHZhbmNlZCA9IHtcblx0XHR1c2VWaWV3czogZmFsc2UsXG5cdFx0X2pzdjogZmFsc2UgLy8gRm9yIGdsb2JhbCBhY2Nlc3MgdG8gSnNWaWV3cyBzdG9yZVxuXHR9O1xuXG5cdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0ZXIgdGFncyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdCR0YWdzKHtcblx0XHRcImlmXCI6IHtcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIHt7aWZ9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0Ly8gSWYgbm90IGRvbmUgKGEgcHJldmlvdXMgYmxvY2sgaGFzIG5vdCBiZWVuIHJlbmRlcmVkKSwgbG9vayBhdCBleHByZXNzaW9uIGZvciB0aGlzIGJsb2NrIGFuZCByZW5kZXIgdGhlIGJsb2NrIGlmIGV4cHJlc3Npb24gaXMgdHJ1dGh5XG5cdFx0XHRcdC8vIE90aGVyd2lzZSByZXR1cm4gXCJcIlxuXHRcdFx0XHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0dGFnQ3R4ID0gc2VsZi50YWdDdHgsXG5cdFx0XHRcdFx0cmV0ID0gKHNlbGYucmVuZGVyaW5nLmRvbmUgfHwgIXZhbCAmJiAodGFnQ3R4LmFyZ3MubGVuZ3RoIHx8ICF0YWdDdHguaW5kZXgpKVxuXHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHQ6IChzZWxmLnJlbmRlcmluZy5kb25lID0gdHJ1ZSxcblx0XHRcdFx0XHRcdFx0c2VsZi5zZWxlY3RlZCA9IHRhZ0N0eC5pbmRleCxcblx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkKTsgLy8gVGVzdCBpcyBzYXRpc2ZpZWQsIHNvIHJlbmRlciBjb250ZW50IG9uIGN1cnJlbnQgY29udGV4dFxuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fSxcblx0XHRcdGNvbnRlbnRDdHg6IHRydWUsIC8vIEluaGVyaXQgcGFyZW50IHZpZXcgZGF0YSBjb250ZXh0XG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcImZvclwiOiB7XG5cdFx0XHRzb3J0RGF0YU1hcDogZGF0YU1hcChnZXRUYXJnZXRTb3J0ZWQpLFxuXHRcdFx0aW5pdDogZnVuY3Rpb24odmFsLCBjbG9uZWQpIHtcblx0XHRcdFx0dGhpcy5zZXREYXRhTWFwKHRoaXMudGFnQ3R4cyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0Ly8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3Ige3tmb3J9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0dmFyIHZhbHVlLCBmaWx0ZXIsIHNydEZpZWxkLCBpc0FycmF5LCBpLCBzb3J0ZWQsIGVuZCwgc3RlcCxcblx0XHRcdFx0XHRzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyYW5nZSA9IHRhZ0N0eC5hcmdEZWZhdWx0ID09PSBmYWxzZSxcblx0XHRcdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcyxcblx0XHRcdFx0XHRpdGVyYXRlID0gIHJhbmdlIHx8IHRhZ0N0eC5hcmdzLmxlbmd0aCwgLy8gTm90IGZpbmFsIGVsc2UgYW5kIG5vdCBhdXRvLWNyZWF0ZSByYW5nZVxuXHRcdFx0XHRcdHJlc3VsdCA9IFwiXCIsXG5cdFx0XHRcdFx0ZG9uZSA9IDA7XG5cblx0XHRcdFx0aWYgKCFzZWxmLnJlbmRlcmluZy5kb25lKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBpdGVyYXRlID8gdmFsIDogdGFnQ3R4LnZpZXcuZGF0YTsgLy8gRm9yIHRoZSBmaW5hbCBlbHNlLCBkZWZhdWx0cyB0byBjdXJyZW50IGRhdGEgd2l0aG91dCBpdGVyYXRpb24uXG5cblx0XHRcdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0XHRcdHJhbmdlID0gcHJvcHMucmV2ZXJzZSA/IFwidW5zaGlmdFwiIDogXCJwdXNoXCI7XG5cdFx0XHRcdFx0XHRlbmQgPSArcHJvcHMuZW5kO1xuXHRcdFx0XHRcdFx0c3RlcCA9ICtwcm9wcy5zdGVwIHx8IDE7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IFtdOyAvLyBhdXRvLWNyZWF0ZSBpbnRlZ2VyIGFycmF5IHNjZW5hcmlvIG9mIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5fX1cblx0XHRcdFx0XHRcdGZvciAoaSA9ICtwcm9wcy5zdGFydCB8fCAwOyAoZW5kIC0gaSkgKiBzdGVwID4gMDsgaSArPSBzdGVwKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlW3JhbmdlXShpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGlzQXJyYXkgPSAkaXNBcnJheSh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gdGFnQ3R4LnJlbmRlcih2YWx1ZSwgIWl0ZXJhdGUgfHwgcHJvcHMubm9JdGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0Ly8gSXRlcmF0ZXMgaWYgZGF0YSBpcyBhbiBhcnJheSwgZXhjZXB0IG9uIGZpbmFsIGVsc2UgLSBvciBpZiBub0l0ZXJhdGlvbiBwcm9wZXJ0eVxuXHRcdFx0XHRcdFx0Ly8gc2V0IHRvIHRydWUuIChVc2Uge3tpbmNsdWRlfX0gdG8gY29tcG9zZSB0ZW1wbGF0ZXMgd2l0aG91dCBhcnJheSBpdGVyYXRpb24pXG5cdFx0XHRcdFx0XHRkb25lICs9IGlzQXJyYXkgPyB2YWx1ZS5sZW5ndGggOiAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc2VsZi5yZW5kZXJpbmcuZG9uZSA9IGRvbmUpIHtcblx0XHRcdFx0XHRcdHNlbGYuc2VsZWN0ZWQgPSB0YWdDdHguaW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIElmIG5vdGhpbmcgd2FzIHJlbmRlcmVkIHdlIHdpbGwgbG9vayBhdCB0aGUgbmV4dCB7e2Vsc2V9fS4gT3RoZXJ3aXNlLCB3ZSBhcmUgZG9uZS5cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdHNldERhdGFNYXA6IGZ1bmN0aW9uKHRhZ0N0eHMpIHtcblx0XHRcdFx0dmFyIHRhZ0N0eCwgcHJvcHMsIHBhcmFtc1Byb3BzLFxuXHRcdFx0XHRcdHNlbGYgPSB0aGlzLFxuXHRcdFx0XHRcdGwgPSB0YWdDdHhzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKGwtLSkge1xuXHRcdFx0XHRcdHRhZ0N0eCA9IHRhZ0N0eHNbbF07XG5cdFx0XHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdFx0XHRcdFx0cGFyYW1zUHJvcHMgPSB0YWdDdHgucGFyYW1zLnByb3BzO1xuXHRcdFx0XHRcdHRhZ0N0eC5hcmdEZWZhdWx0ID0gcHJvcHMuZW5kID09PSB1bmRlZmluZWQgfHwgdGFnQ3R4LmFyZ3MubGVuZ3RoID4gMDsgLy8gRGVmYXVsdCB0byAjZGF0YSBleGNlcHQgZm9yIGF1dG8tY3JlYXRlIHJhbmdlIHNjZW5hcmlvIHt7Zm9yIHN0YXJ0PXh4eCBlbmQ9eXl5IHN0ZXA9enp6fX1cblx0XHRcdFx0XHRwcm9wcy5kYXRhTWFwID0gKHRhZ0N0eC5hcmdEZWZhdWx0ICE9PSBmYWxzZSAmJiAkaXNBcnJheSh0YWdDdHguYXJnc1swXSkgJiZcblx0XHRcdFx0XHRcdChwYXJhbXNQcm9wcy5zb3J0IHx8IHBhcmFtc1Byb3BzLnN0YXJ0IHx8IHBhcmFtc1Byb3BzLmVuZCB8fCBwYXJhbXNQcm9wcy5zdGVwIHx8IHBhcmFtc1Byb3BzLmZpbHRlciB8fCBwYXJhbXNQcm9wcy5yZXZlcnNlXG5cdFx0XHRcdFx0XHR8fCBwcm9wcy5zb3J0IHx8IHByb3BzLnN0YXJ0IHx8IHByb3BzLmVuZCB8fCBwcm9wcy5zdGVwIHx8IHByb3BzLmZpbHRlciB8fCBwcm9wcy5yZXZlcnNlKSlcblx0XHRcdFx0XHRcdCYmIHNlbGYuc29ydERhdGFNYXA7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRwcm9wczoge1xuXHRcdFx0YmFzZVRhZzogXCJmb3JcIixcblx0XHRcdGRhdGFNYXA6IGRhdGFNYXAoZ2V0VGFyZ2V0UHJvcHMpLFxuXHRcdFx0aW5pdDogbm9vcCwgLy8gRG9uJ3QgZXhlY3V0ZSB0aGUgYmFzZSBpbml0KCkgb2YgdGhlIFwiZm9yXCIgdGFnXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRpbmNsdWRlOiB7XG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcIipcIjoge1xuXHRcdFx0Ly8ge3sqIGNvZGUuLi4gfX0gLSBJZ25vcmVkIGlmIHRlbXBsYXRlLmFsbG93Q29kZSBhbmQgJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUgYXJlIGZhbHNlLiBPdGhlcndpc2UgaW5jbHVkZSBjb2RlIGluIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHRyZW5kZXI6IHJldFZhbCxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiOipcIjoge1xuXHRcdFx0Ly8ge3s6KiByZXR1cm5lZEV4cHJlc3Npb24gfX0gLSBJZ25vcmVkIGlmIHRlbXBsYXRlLmFsbG93Q29kZSBhbmQgJC52aWV3cy5zZXR0aW5ncy5hbGxvd0NvZGUgYXJlIGZhbHNlLiBPdGhlcndpc2UgaW5jbHVkZSBjb2RlIGluIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHRyZW5kZXI6IHJldFZhbCxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdGRiZzogJGhlbHBlcnMuZGJnID0gJGNvbnZlcnRlcnMuZGJnID0gZGJnQnJlYWsgLy8gUmVnaXN0ZXIge3tkYmcvfX0sIHt7ZGJnOi4uLn19IGFuZCB+ZGJnKCkgdG8gdGhyb3cgYW5kIGNhdGNoLCBhcyBicmVha3BvaW50cyBmb3IgZGVidWdnaW5nLlxuXHR9KTtcblxuXHQkY29udmVydGVycyh7XG5cdFx0aHRtbDogaHRtbEVuY29kZSxcblx0XHRhdHRyOiBodG1sRW5jb2RlLCAvLyBJbmNsdWRlcyA+IGVuY29kaW5nIHNpbmNlIHJDb252ZXJ0TWFya2VycyBpbiBKc1ZpZXdzIGRvZXMgbm90IHNraXAgPiBjaGFyYWN0ZXJzIGluIGF0dHJpYnV0ZSBzdHJpbmdzXG5cdFx0ZW5jb2RlOiBkYXRhRW5jb2RlLFxuXHRcdHVuZW5jb2RlOiBkYXRhVW5lbmNvZGUsIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0XHR1cmw6IGZ1bmN0aW9uKHRleHQpIHtcblx0XHRcdC8vIFVSTCBlbmNvZGluZyBoZWxwZXIuXG5cdFx0XHRyZXR1cm4gdGV4dCAhPSB1bmRlZmluZWQgPyBlbmNvZGVVUkkoXCJcIiArIHRleHQpIDogdGV4dCA9PT0gbnVsbCA/IHRleHQgOiBcIlwiOyAvLyBudWxsIHJldHVybnMgbnVsbCwgZS5nLiB0byByZW1vdmUgYXR0cmlidXRlLiB1bmRlZmluZWQgcmV0dXJucyBcIlwiXG5cdFx0fVxuXHR9KTtcbn1cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gRGVmaW5lIGRlZmF1bHQgZGVsaW1pdGVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuJHN1YlNldHRpbmdzID0gJHN1Yi5zZXR0aW5ncztcbiRpc0FycmF5ID0gKCR8fGpzcikuaXNBcnJheTtcbiR2aWV3c1NldHRpbmdzLmRlbGltaXRlcnMoXCJ7e1wiLCBcIn19XCIsIFwiXlwiKTtcblxuaWYgKGpzclRvSnEpIHsgLy8gTW92aW5nIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lcGFjZSAtIGNvcHkgb3ZlciB0aGUgc3RvcmVkIGl0ZW1zICh0ZW1wbGF0ZXMsIGNvbnZlcnRlcnMsIGhlbHBlcnMuLi4pXG5cdGpzci52aWV3cy5zdWIuX2pxKCQpO1xufVxucmV0dXJuICQgfHwganNyO1xufSwgd2luZG93KSk7XG4iLCIvKmdsb2JhbCBRVW5pdCwgdGVzdCwgZXF1YWwsIG9rKi9cbihmdW5jdGlvbih1bmRlZmluZWQpIHtcblwidXNlIHN0cmljdFwiO1xuXG5icm93c2VyaWZ5LmRvbmUub25lID0gdHJ1ZTtcblxuUVVuaXQubW9kdWxlKFwiQnJvd3NlcmlmeSAtIGNsaWVudCBjb2RlXCIpO1xuXG52YXIgaXNJRTggPSB3aW5kb3cuYXR0YWNoRXZlbnQgJiYgIXdpbmRvdy5hZGRFdmVudExpc3RlbmVyO1xuXG5pZiAoIWlzSUU4KSB7XG5cbnRlc3QoXCJObyBqUXVlcnkgZ2xvYmFsOiByZXF1aXJlKCdqc3JlbmRlcicpKClcIiwgZnVuY3Rpb24oKSB7XG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gSGlkZSBRVW5pdCBnbG9iYWwgalF1ZXJ5IGFuZCBhbnkgcHJldmlvdXMgZ2xvYmFsIGpzcmVuZGVyLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdHZhciBqUXVlcnkgPSBnbG9iYWwualF1ZXJ5LCBqc3IgPSBnbG9iYWwuanNyZW5kZXI7XG5cdGdsb2JhbC5qUXVlcnkgPSBnbG9iYWwuanNyZW5kZXIgPSB1bmRlZmluZWQ7XG5cblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBBcnJhbmdlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0dmFyIGRhdGEgPSB7bmFtZTogXCJKb1wifTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBY3QgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHR2YXIganNyZW5kZXIgPSByZXF1aXJlKCcuLi8uLi8nKSgpOyAvLyBOb3QgcGFzc2luZyBpbiBqUXVlcnksIHNvIHJldHVybnMgdGhlIGpzcmVuZGVyIG5hbWVzcGFjZVxuXG5cdC8vIFVzZSByZXF1aXJlIHRvIGdldCBzZXJ2ZXIgdGVtcGxhdGUsIHRoYW5rcyB0byBCcm93c2VyaWZ5IGJ1bmRsZSB0aGF0IHVzZWQganNyZW5kZXIvdG1wbGlmeSB0cmFuc2Zvcm1cblx0dmFyIHRtcGwgPSByZXF1aXJlKCcuLi90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sJykoanNyZW5kZXIpOyAvLyBQcm92aWRlIGpzcmVuZGVyXG5cblx0dmFyIHJlc3VsdCA9IHRtcGwoZGF0YSk7XG5cblx0cmVzdWx0ICs9IFwiIFwiICsgKGpzcmVuZGVyICE9PSBqUXVlcnkpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gQXNzZXJ0IC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHRlcXVhbChyZXN1bHQsIFwiTmFtZTogSm8gKG5hbWUtdGVtcGxhdGUuaHRtbCkgdHJ1ZVwiLCBcInJlc3VsdDogTm8galF1ZXJ5IGdsb2JhbDogcmVxdWlyZSgnanNyZW5kZXInKSgpXCIpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gUmVzZXQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGdsb2JhbC5qUXVlcnkgPSBqUXVlcnk7IC8vIFJlcGxhY2UgUVVuaXQgZ2xvYmFsIGpRdWVyeVxuXHRnbG9iYWwuanNyZW5kZXIgPSBqc3I7IC8vIFJlcGxhY2UgYW55IHByZXZpb3VzIGdsb2JhbCBqc3JlbmRlclxufSk7XG59XG59KSgpO1xuIiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChuYW1lLXRlbXBsYXRlLmh0bWwpJyxcbiAgJCA9IGdsb2JhbC5qc3JlbmRlciB8fCBnbG9iYWwualF1ZXJ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9ICQgPyAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sXCIsIG1rdXApIDpcbiAgZnVuY3Rpb24oJCkge1xuICAgIGlmICghJCB8fCAhJC52aWV3cykge3Rocm93IFwiUmVxdWlyZXMganNyZW5kZXIvalF1ZXJ5XCI7fVxuICAgIHdoaWxlICh0bXBsUmVmcy5sZW5ndGgpIHtcbiAgICAgIHRtcGxSZWZzLnBvcCgpKCQpOyAvLyBjb21waWxlIG5lc3RlZCB0ZW1wbGF0ZVxuICAgIH1cblxuICAgIHJldHVybiAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sXCIsIG1rdXApXG4gIH07Il19
