(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v0.9.83 (Beta): http://jsviews.com/#jsrender */
/*! **VERSION FOR WEB** (For NODE.JS see http://jsviews.com/download/jsrender-node.js) */
/*
 * Best-of-breed templating in browser or on Node.js.
 * Does not require jQuery, or HTML DOM
 * Integrates with JsViews (http://jsviews.com/#jsviews)
 *
 * Copyright 2016, Boris Moore
 * Released under the MIT License.
 */

//jshint -W018, -W041

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

var versionNumber = "v0.9.83",
	jsvStoreName, rTag, rTmplString, topView, $views,	$expando,

//TODO	tmplFnsCache = {},
	$isFunction, $isArray, $templates, $converters, $helpers, $tags, $sub, $subSettings, $subSettingsAdvanced, $viewsSettings, delimOpenChar0, delimOpenChar1, delimCloseChar0, delimCloseChar1, linkChar, setting, baseOnError,

	rPath = /^(!*?)(?:null|true|false|\d[\d.]*|([\w$]+|\.|~([\w$]+)|#(view|([\w$]+))?)([\w$.^]*?)(?:[.[^]([\w$]+)\]?)?)$/g,
	//        not                               object     helper    view  viewProperty pathTokens      leafToken

	rParams = /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(!*?[#~]?[\w$.^]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=\s*[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//          lftPrn0        lftPrn        bound            path    operator err                                                eq             path2       prn    comma   lftPrn2   apos quot      rtPrn rtPrnDot                           prn2  space
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
			onStore: {},
			addSetting: addSetting,
			settings: {
				allowCode: false
			},
			advSet: noop, // Update advanced settings
			_ths: tagHandlersFromProps,
			_tg: function() {}, // Constructor for tagDef
			_cnvt: convertVal,
			_tag: renderTag,
			_er: error,
			_err: onRenderError,
			_html: htmlEncode,
			_cp: retVal, // Get compiled contextual parameters (or properties) ~foo=expr. In JsRender, simply returns val.
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
		getCtx: retVal, // Get ctx.foo value. In JsRender, simply returns val.
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
						? baseMethod // baseMethod is a derived method, so us it
						: getDerivedMethod(noop, baseMethod), // baseMethod is not derived so make its base method be the noop method
				method
			);
		method._d = 1; // Add flag that this is a derived method
	}
	return method;
}

function tagHandlersFromProps(tag, tagCtx) {
	for (var prop in tagCtx.props) {
		if (rHasHandlers.test(prop)) {
			tag[prop] = getMethod(tag[prop], tagCtx.props[prop]);
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
	for (var name in source) {
		target[name] = source[name];
	}
	return target;
}

(JsViewsError.prototype = new Error()).constructor = JsViewsError;

//========================== Top-level functions ==========================

//===================
// views.delimiters
//===================

function $viewsDelimiters(openChars, closeChars, link) {
	// Set the tag opening and closing delimiters and 'link' character. Default is "{{", "}}" and "^"
	// openChars, closeChars: opening and closing strings, each with two characters
	if (!openChars) {
		return $subSettings.delimiters;
	}
	if ($isArray(openChars)) {
		return $viewsDelimiters.apply($views, openChars);
	}

	$subSettings.delimiters = [openChars, closeChars, linkChar = link ? link.charAt(0) : linkChar];

	delimOpenChar0 = openChars.charAt(0); // Escape the characters - since they could be regex special characters
	delimOpenChar1 = openChars.charAt(1);
	delimCloseChar0 = closeChars.charAt(0);
	delimCloseChar1 = closeChars.charAt(1);
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

	$sub.rTmpl = new RegExp("<.*>|([^\\\\]|^)[{}]|" + openChars + ".*" + closeChars);
	// $sub.rTmpl looks for html tags or { or } char not preceded by \\, or JsRender tags {{xxx}}. Each of these strings are considered
	// NOT to be jQuery selectors
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
		root = !type || type === "root";
		// If type is undefined, returns root view (view under top view).

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
		while (view.parent) {
			found = view;
			view = view.parent;
		}
	} else {
		while (view && !found) {
			// Go through views - this one, and all parent ones - and return first one with given type.
			found = view.type === type ? view : undefined;
			view = view.parent;
		}
	}
	return found;
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

//==========
// View.hlp
//==========

function getHelper(helper, isContextCb) {
	// Helper method called as view.hlp(key) from compiled template, for helpers or template parameters ~foo
	var wrapped, deps,
	view = this,
	res = view.ctx;

	if (res) {
		res = res[helper];
	}
	if (res === undefined) {
		res = $helpers[helper];
	}
	if (res && res._cp) { // If this helper resource is a contextual parameter, ~foo=expr
		if (isContextCb) {  // In a context callback for a contextual param, return the [view, dependencies...] array - needed for observe call
			deps = $sub._ceo(res[1].deps);  // fn deps, with any exprObs cloned
			deps.unshift(res[0]);           // view
			deps._cp = true;
			return deps;
		}
		res = $views.getCtx(res); // If a contextual param, but not a context callback, return evaluated param - fn(data, view, j)
	}

	if (res) {
		if ($isFunction(res) && !res._wrp) {
			// If it is of type function, and not already wrapped, we will wrap it, so if called with no this pointer it will be called with the
			// view as 'this' context. If the helper ~foo() was in a data-link expression, the view will have a 'temporary' linkCtx property too.
			// Note that helper functions on deeper paths will have specific this pointers, from the preceding path.
			// For example, ~util.foo() will have the ~util object as 'this' pointer
			wrapped = function() {
				return res.apply((!this || this === global) ? view : this, arguments);
			};
			wrapped._wrp = view;
			$extend(wrapped, res); // Attach same expandos (if any) to the wrapped function
		}
	}
	return wrapped || res;
}

function getTemplate(tmpl) {
	return tmpl && (tmpl.fn
		? tmpl
		: this.getRsc("templates", tmpl) || $templates(tmpl)); // not yet compiled
}

//==============
// views._cnvt
//==============

function convertVal(converter, view, tagCtx, onError) {
	// self is template object or linkCtx object
	var tag, value,
		// if tagCtx is an integer, then it is the key for the compiled function to return the boundTag tagCtx
		boundTag = typeof tagCtx === "number" && view.tmpl.bnds[tagCtx-1],
		linkCtx = view.linkCtx; // For data-link="{cvt:...}"...

	if (onError !== undefined) {
		tagCtx = onError = {props: {}, args: [onError]};
	} else if (boundTag) {
		tagCtx = boundTag(view.data, view, $sub);
	}

	value = tagCtx.args[0];
	if (converter || boundTag) {
		tag = linkCtx && linkCtx.tag;
		if (!tag) {
			tag = $extend(new $sub._tg(), {
				_: {
					inline: !linkCtx,
					bnd: boundTag,
					unlinked: true
				},
				tagName: ":",
				cvt: converter,
				flow: true,
				tagCtx: tagCtx
			});
			if (linkCtx) {
				linkCtx.tag = tag;
				tag.linkCtx = linkCtx;
			}
			tagCtx.ctx = extendCtx(tagCtx.ctx, (linkCtx ? linkCtx.view : view).ctx);
		}
		tag._er = onError && value;
		tagHandlersFromProps(tag, tagCtx);

		tagCtx.view = view;

		tag.ctx = tagCtx.ctx || tag.ctx || {};
		tagCtx.ctx = undefined;

		value = tag.cvtArgs(converter !== "true" && converter)[0]; // If there is a convertBack but no convert, converter will be "true"

		// Call onRender (used by JsViews if present, to add binding annotations around rendered content)
		value = boundTag && view._.onRender
			? view._.onRender(value, view, tag)
			: value;
	}
	return value != undefined ? value : "";
}

function convertArgs(converter) {
	var tag = this,
		tagCtx = tag.tagCtx,
		view = tagCtx.view,
		args = tagCtx.args;

	converter = converter || tag.convert;
	converter = converter && ("" + converter === converter
		? (view.getRsc("converters", converter) || error("Unknown converter: '" + converter + "'"))
		: converter);

	args = !args.length && !tagCtx.index // On the opening tag with no args, bind to the current data context
		? [view.data]
		: converter
			? args.slice() // If there is a converter, use a copy of the tagCtx.args array for rendering, and replace the args[0] in
			// the copied array with the converted value. But we do not modify the value of tag.tagCtx.args[0] (the original args array)
			: args; // If no converter, get the original tagCtx.args

	if (converter) {
		if (converter.depends) {
			tag.depends = $sub.getDeps(tag.depends, tag, converter.depends, converter);
		}
		args[0] = converter.apply(tag, args);
	}
	return args;
}

//=============
// views._tag
//=============

function getResource(resourceType, itemName) {
	var res, store,
		view = this;
	while ((res === undefined) && view) {
		store = view.tmpl && view.tmpl[resourceType];
		res = store && store[itemName];
		view = view.parent;
	}
	return res || $views[resourceType][itemName];
}

function renderTag(tagName, parentView, tmpl, tagCtxs, isUpdate, onError) {
	parentView = parentView || topView;
	var tag, tag_, tagDef, template, tags, attr, parentTag, i, l, itemRet, tagCtx, tagCtxCtx,
		content, callInit, mapDef, thisMap, args, props, initialTmpl, tagDataMap, contentCtx,
		ret = "",
		linkCtx = parentView.linkCtx || 0,
		ctx = parentView.ctx,
		parentTmpl = tmpl || parentView.tmpl,
		// if tagCtx is an integer, then it is the key for the compiled function to return the boundTag tagCtxs
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

	if (onError !== undefined) {
		ret += onError;
		tagCtxs = onError = [{props: {}, args: []}];
	} else if (boundTag) {
		tagCtxs = boundTag(parentView.data, parentView, $sub);
	}

	l = tagCtxs.length;
	for (i = 0; i < l; i++) {
		tagCtx = tagCtxs[i];
		if (!linkCtx || !linkCtx.tag || i && !linkCtx.tag._.inline || tag._er) {
			// Initialize tagCtx
			// For block tags, tagCtx.tmpl is an integer > 0
			if (content = parentTmpl.tmpls && tagCtx.tmpl) {
				content = tagCtx.content = parentTmpl.tmpls[content - 1];
			}
			tagCtx.index = i;
			tagCtx.tmpl = content; // Set the tmpl property to the content of the block tag
			tagCtx.render = renderContent;
			tagCtx.view = parentView;
			tagCtx.ctx = extendCtx(tagCtx.ctx, ctx); // Clone and extend parentView.ctx
		}
		if (tmpl = tagCtx.props.tmpl) {
			// If the tmpl property is overridden, set the value (when initializing, or, in case of binding: ^tmpl=..., when updating)
			tagCtx.tmpl = parentView.getTmpl(tmpl);
		}

		if (!tag) {
			// This will only be hit for initial tagCtx (not for {{else}}) - if the tag instance does not exist yet
			// Instantiate tag if it does not yet exist
			// If the tag has not already been instantiated, we will create a new instance.
			// ~tag will access the tag, even within the rendering of the template content of this tag.
			// From child/descendant tags, can access using ~tag.parent, or ~parentTags.tagName
			tag = new tagDef._ctr();
			callInit = !!tag.init;

			tag.parent = parentTag = ctx && ctx.tag;
			tag.tagCtxs = tagCtxs;
			tagDataMap = tag.dataMap;

			if (linkCtx) {
				tag._.inline = false;
				linkCtx.tag = tag;
				tag.linkCtx = linkCtx;
			}
			if (tag._.bnd = boundTag || linkCtx.fn) {
				// Bound if {^{tag...}} or data-link="{tag...}"
				tag._.arrVws = {};
			} else if (tag.dataBoundOnly) {
				error("{^{" + tagName + "}} tag must be data-bound");
			}
			//TODO better perf for childTags() - keep child tag.tags array, (and remove child, when disposed)
			// tag.tags = [];
		}
		tagCtxs = tag.tagCtxs;
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
		}
	}
	if (!(tag._er = onError)) {
		tagHandlersFromProps(tag, tagCtxs[0]);
		tag.rendering = {}; // Provide object for state during render calls to tag and elses. (Used by {{if}} and {{for}}...)
		for (i = 0; i < l; i++) {
			tagCtx = tag.tagCtx = tagCtxs[i];
			props = tagCtx.props;
			args = tag.cvtArgs();

			if (mapDef = props.dataMap || tagDataMap) {
				if (args.length || props.dataMap) {
					thisMap = tagCtx.map;
					if (!thisMap || thisMap.src !== args[0] || isUpdate) {
						if (thisMap && thisMap.src) {
							thisMap.unmap(); // only called if observable map - not when only used in JsRender, e.g. by {{props}}
						}
						thisMap = tagCtx.map = mapDef.map(args[0], props, undefined, !tag._.bnd);
					}
					args = [thisMap.tgt];
				}
			}
			tag.ctx = tagCtx.ctx;

			if (!i) {
				if (callInit) {
					initialTmpl = tag.template;
					tag.init(tagCtx, linkCtx, tag.ctx);
					callInit = undefined;
				}
				if (linkCtx) {
					// Set attr on linkCtx to ensure outputting to the correct target attribute.
					// Setting either linkCtx.attr or this.attr in the init() allows per-instance choice of target attrib.
					linkCtx.attr = tag.attr = linkCtx.attr || tag.attr;
				}
				attr = tag.attr;
				tag._.noVws = attr && attr !== HTML;
			}

			itemRet = undefined;
			if (tag.render) {
				itemRet = tag.render.apply(tag, args);
				if (parentView.linked && itemRet && tag.linkedElem && !rWrappedInViewMarker.test(itemRet)) {
					// When a tag renders content from the render method, with data linking, and has a linkedElem binding, then we need to wrap with
					// view markers, if absent, so the content is a view associated with the tag, which will correctly dispose bindings if deleted.
					itemRet = renderWithViews($.templates(itemRet), args[0], undefined, undefined, parentView, undefined, undefined, tag);
				}
			}
			if (!args.length) {
				args = [parentView]; // no arguments - (e.g. {{else}}) get data context from view.
			}
			if (itemRet === undefined) {
				contentCtx = args[0]; // Default data context for wrapped block content is the first argument. Defined tag.contentCtx function to override this.
				if (tag.contentCtx) {
					contentCtx = tag.contentCtx(contentCtx);
				}
				itemRet = tagCtx.render(contentCtx, true) || (isUpdate ? undefined : "");
			}
			// No return value from render, and no template/content tagCtx.render(...), so return undefined
			ret = ret ? ret + (itemRet || "") : itemRet; // If no rendered content, this will be undefined
		}
		tag.rendering = undefined;
	}
	tag.tagCtx = tagCtxs[0];
	tag.ctx = tag.tagCtx.ctx;

	if (tag._.noVws) {
			if (tag._.inline) {
			// inline tag with attr set to "text" will insert HTML-encoded content - as if it was element-based innerText
			ret = attr === "text"
				? $converters.html(ret)
				: "";
		}
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

	self.content = contentTmpl;
	self.views = isArray ? [] : {};
	self.parent = parentView;
	self.type = type || "top";
	self.data = data;
	self.tmpl = template;
	// If the data is an array, this is an 'array view' with a views array for each child 'item view'
	// If the data is not an array, this is an 'item view' with a views 'hash' object for any child nested views
	// ._.useKey is non zero if is not an 'array view' (owning a data array). Use this as next key for adding to child views hash
	self_ = self._ = {
		key: 0,
		useKey: isArray ? 0 : 1,
		id: "" + viewId++,
		onRender: onRender,
		bnds: {}
	};
	self.linked = !!onRender;
	if (parentView) {
		views = parentView.views;
		parentView_ = parentView._;
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
		self.ctx = context;
	}
}

View.prototype = {
	get: getView,
	getIndex: getIndex,
	getRsc: getResource,
	getTmpl: getTemplate,
	hlp: getHelper,
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
			inline: true,
			unlinked: true
		};

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
		tagDef.baseTag = baseTag = "" + baseTag === baseTag
			? (parentTmpl && parentTmpl.tags[baseTag] || $tags[baseTag])
			: baseTag;

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
	if (compiledDef.init !== false) {
		// Set init: false on tagDef if you want to provide just a render method, or render and template, but no constructor or prototype.
		// so equivalent to setting tag to render function, except you can also provide a template.
		(Tag.prototype = compiledDef).constructor = compiledDef._ctr = Tag;
	}

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
						elem = $(document).find(value)[0]; // if jQuery is loaded, test for selector returning elements, and get first element
					} catch (e) {}
				}// END BROWSER-SPECIFIC CODE
			} //BROWSER-SPECIFIC CODE
			if (elem) {
				// Generally this is a script element.
				// However we allow it to be any element, so you can for example take the content of a div,
				// use it as a template, and replace it by the same content rendered against data.
				// e.g. for linking the content of a div to a container, and using the initial content as template:
				// $.link("#content", model, {tmpl: "#content"});
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
							value = $.data(elem)[jsvTmpl];
						}
					} else {
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

	//==== Compile the template ====
	if (options === 0) {
		options = undefined;
		tmplOrMarkup = lookupTemplate(tmplOrMarkup); // Top-level compile so do a template lookup
	}

	// If options, then this was already compiled from a (script) element template declaration.
	// If not, then if tmpl is a template object, use it for options
	options = options || (tmpl.markup ? tmpl : {});
	options.tmplName = name;
	if (parentTmpl) {
		options._parentTmpl = parentTmpl;
	}
	// If tmpl is not a markup string or a selector string, then it must be a template object
	// In that case, get it from the markup property of the object
	if (!tmplOrMarkup && tmpl.markup && (tmplOrMarkup = lookupTemplate(tmpl.markup))) {
		if (tmplOrMarkup.fn) {
			// If the string references a compiled template object, need to recompile to merge any modified options
			tmplOrMarkup = tmplOrMarkup.markup;
		}
	}
	if (tmplOrMarkup !== undefined) {
		if (tmplOrMarkup.fn || tmpl.fn) {
			// tmpl is already compiled, so use it
			if (tmplOrMarkup.fn) {
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
		if (name && !parentTmpl && name !== jsvTmpl) {
			$render[name] = compiledTmpl;
		}
		return compiledTmpl;
	}
}

//==== /end of function compileTmpl ====

//=================
// compileViewModel
//=================

function getDefaultVal(defaultVal, data) {
	return $.isFunction(defaultVal)
		? defaultVal.call(data)
		: defaultVal;
}

function unmapArray(modelArr) {
		var i, arr = [],
			l = modelArr.length;
		for (i=0; i<l; i++) {
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
		l = getters ? getters.length : 0,
		$observable = $.observable,
		getterNames = {};

	function GetNew(args) {
		constructor.apply(this, args);
	}

	function vm() {
		return new GetNew(arguments);
	}

	function iterate(data, action) {
		var j, getterType, defaultVal, prop, ob,
			m = getters.length;
		for (j=0; j<m; j++) {
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
		var i, j,  l, m, prop,
			ob = data,
			arr = [];

		if ($isArray(data)) {
			data = data || [];
			l = data.length;
			for (i=0; i<l; i++) {
				arr.push(this.map(data[i]));
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

			ob = this.apply(this, arr); // Insantiate this View Model, passing getters args array to constructor
			for (prop in data) { // Copy over any other properties. that are not get/set properties
				if (prop !== $expando  && !getterNames[prop]) {
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
		var i, j, l, m, prop, mod, found, assigned, ob, newModArr,
			model = this;

		if ($isArray(model)) {
			assigned = {};
			newModArr = [];
			l = data.length;
			m = model.length;
			for (i=0; i<l; i++) {
				ob = data[i];
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
		var ob, prop, i, l, getterType, arr, value,
			model = this;

		if ($isArray(model)) {
			return unmapArray(model);
		}
		ob = {};
		l = getters.length;
		for (i=0; i<l; i++) {
			prop = getters[i];
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
			if (prop !== "_is" && !getterNames[prop] && prop !== $expando  && (prop.charAt(0) !== "_" || !getterNames[prop.slice(1)]) && !$.isFunction(model[prop])) {
				ob[prop] = model[prop];
			}
		}
		return ob;
	}

	GetNew.prototype = proto;

	for (i=0; i<l; i++) {
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
		tmpl = $extend(
			{
				tmpls: [],
				links: {}, // Compiled functions for link expressions
				bnds: [],
				_is: "template",
				render: renderContent
			},
			options
		);

	tmpl.markup = markup;
	if (!options.htmlTag) {
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

function registerStore(storeName, storeSettings) {

	function theStore(name, item, parentTmpl) {
		// The store is also the function used to add items to the store. e.g. $.templates, or $.views.tags

		// For store of name 'thing', Call as:
		//    $.views.things(items[, parentTmpl]),
		// or $.views.things(name, item[, parentTmpl])

		var onStore, compile, itemName, thisStore;
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
			item = compile ? compile.call(thisStore, name, item, parentTmpl, 0) : item;
			if (name) {
				thisStore[name] = item;
			}
		}
		if (compile && item) {
			item._is = storeName; // Only do this for compiled objects (tags, templates...)
		}
		if (item && (onStore = $sub.onStore[storeName])) {
			// e.g. JsViews integration
			onStore(name, item, compile);
		}
		return item;
	}

	var storeNames = storeName + "s";

	$views[storeNames] = theStore;
}

function addSetting(st) {
	$viewsSettings[st] = function(value) {
		return arguments.length
			? ($subSettings[st] = value, $viewsSettings)
			: $subSettings[st];
	};
}

//=========
// dataMap
//=========

function dataMap(mapDef) {
	function Map(source, options) {
		this.tgt = mapDef.getTgt(source, options);
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
		tmpl = view.getTmpl(tag.template || tagCtx.tmpl);
		if (!arguments.length) {
			data = view;
		}
	} else {
		// This is a template.render(...) call
		tmpl = this;
	}

	if (tmpl) {
		if (!parentView && data && data._is === "view") {
			view = data; // When passing in a view to render or link (and not passing in a parent view) use the passed-in view as parentView
		}

		if (view) {
			if (data === view) {
				// Inherit the data from the parent view.
				// This may be the contents of an {{if}} block
				data = view.data;
			}
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
	var i, l, newView, childView, itemResult, swapContent, contentTmpl, outerOnRender, tmplName, itemVar, newCtx, tagCtx,
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
			if (itemVar.charAt(0) !== "~") {
				syntaxError("Use itemVar='~myItem'");
			}
			itemVar = itemVar.slice(1);
		}
	}

	if (view) {
		onRender = onRender || view._.onRender;
		context = extendCtx(context, view.ctx);
	}

	if (key === true) {
		swapContent = true;
		key = 0;
	}

	// If link===false, do not call onRender, so no data-linking marker nodes
	if (onRender && (context && context.link === false || tag && tag._.noVws)) {
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
		if (view && view._.useKey) {
			// Parent is not an 'array view'
			newView._.bnd = !tag || tag._.bnd && tag; // For array views that are data bound for collection change events, set the
			// view._.bnd property to true for top-level link() or data-link="{for}", or to the tag instance for a data-bound tag, e.g. {^{for ...}}
		}
		if (itemVar) {
			newView.it = itemVar;
		}
		itemVar = newView.it;
		for (i = 0, l = data.length; i < l; i++) {
			// Create a view for each data item.
			if (itemVar) {
				setItemVar(data[i]); // use modified ctx with user-named ~item
			}
			childView = new View(newCtx, "item", newView, data[i], tmpl, (key || 0) + i, onRender, newView.content);

			itemResult = tmpl.fn(data[i], childView, $sub);
			result += newView._.onRender ? newView._.onRender(itemResult, childView) : itemResult;
		}
	} else {
		// Create a view for singleton data object. The type of the view will be the tag name, e.g. "if" or "myTag" except for
		// "item", "array" and "data" views. A "data" view is from programmatic render(object) against a 'singleton'.
		if (itemVar) {
			setItemVar(data);
		}
		newView = swapContent ? view : new View(newCtx, tmplName || "data", view, data, tmpl, key, onRender, contentTmpl);
		if (tag && !tag.flow) {
			newView.tag = tag;
			tag.view = newView;
		}
		result += tmpl.fn(data, newView, $sub);
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
		: "{Error: " + e.message + "}";

	if ($subSettings.onError && (fallback = $subSettings.onError.call(view.data, e, fallback && message, view)) !== undefined) {
		message = fallback; // There is a settings.debugMode(handler) onError override. Call it, and use return value (if any) to replace message
	}

	return view && !view.linkCtx ? $converters.html(message) : message;
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

		var pathBindings = (bind || isLinkExpr) && [[]],
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
					syntaxError('for "{{else if expr}}" use "{{else expr}}"');
				}
				pathBindings = current[7] && [[]];
				current[8] = markup.substring(current[8], index); // contentMarkup for block tag
				current = stack.pop();
				content = current[2];
				block = true;
			}
			if (params) {
				// remove newlines from the params string, to avoid compiled code errors for unterminated strings
				parseParams(params.replace(rNewLine, " "), pathBindings, tmpl)
					.replace(rBuildHash, function(all, onerror, isCtx, key, keyToken, keyValue, arg, param) {
						key = "'" + keyToken + "':";
						if (arg) {
							args += keyValue + ",";
							paramsArgs += "'" + param + "',";
						} else if (isCtx) {
							ctxProps += key + 'j._cp(' + keyValue + ',"' + param + '",view),';
							// Compiled code for evaluating tagCtx on a tag will have: ctx:{'foo':j._cp(compiledExpr, "expr", view)}
							paramsCtxProps += key + "'" + param + "',";
						} else if (onerror) {
							onError += keyValue;
						} else {
							if (keyToken === "trigger") {
								useTrigger += keyValue;
							}
							props += key + keyValue + ",";
							paramsProps += key + "'" + param + "',";
							hasHandlers = hasHandlers || rHasHandlers.test(keyToken);
						}
						return "";
					}).slice(0, -1);
			}

			if (pathBindings && pathBindings[0]) {
				pathBindings.pop(); // Remove the bindings that was prepared for next arg. (There is always an extra one ready).
			}

			newNode = [
					tagName,
					converter || !!convertBack || hasHandlers || "",
					block && [],
					parsedParam(paramsArgs || (tagName === ":" ? "'#data'," : ""), paramsProps, paramsCtxProps), // {{:}} equivalent to {{:#data}}
					parsedParam(args || (tagName === ":" ? "data," : ""), props, ctxProps),
					onError,
					useTrigger,
					pathBindings || 0
				];
			content.push(newNode);
			if (block) {
				stack.push(current);
				current = newNode;
				current[8] = loc; // Store current location of open tag, to be able to add contentMarkup when we reach closing tag
			}
		} else if (closeBlock) {
			blockTagCheck(closeBlock !== current[0] && current[0] !== "else" && closeBlock, current[0]);
			current[8] = markup.substring(current[8], index); // contentMarkup for block tag
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
		blockTagCheck("" + loc !== loc && (+loc[8] === loc[8]) && loc[0]);
	}
//			result = tmplFnsCache[markup] = buildCode(astTop, tmpl);
//		}

	if (isLinkExpr) {
		result = buildCode(astTop, markup, isLinkExpr);
		bindings = [];
		i = astTop.length;
		while (i--) {
			bindings.unshift(astTop[i][7]);  // With data-link expressions, pathBindings array for tagCtx[i] is astTop[i][7]
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
		+ 'args:[' + parts[0] + ']'
		+ (parts[1] || !type
			? ',\n\tprops:{' + parts[1] + '}'
			: "")
		+ (parts[2] ? ',\n\tctx:{' + parts[2] + '}' : "");
}

function parseParams(params, pathBindings, tmpl) {

	function parseTokens(all, lftPrn0, lftPrn, bound, path, operator, err, eq, path2, prn, comma, lftPrn2, apos, quot, rtPrn, rtPrnDot, prn2, space, index, full) {
	// /(\()(?=\s*\()|(?:([([])\s*)?(?:(\^?)(!*?[#~]?[\w$.^]+)?\s*((\+\+|--)|\+|-|&&|\|\||===|!==|==|!=|<=|>=|[<>%*:?\/]|(=))\s*|(!*?[#~]?[\w$.^]+)([([])?)|(,\s*)|(\(?)\\?(?:(')|("))|(?:\s*(([)\]])(?=\s*[.^]|\s*$|[^([])|[)\]])([([]?))|(\s+)/g,
	//   lftPrn0        lftPrn        bound            path    operator err                                                eq             path2       prn    comma   lftPrn2   apos quot      rtPrn rtPrnDot                        prn2  space
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
					allPath = (helper
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

					allPath = allPath + (leafToken ? "." + leafToken : "");

					allPath = not + (allPath.slice(0, 9) === "view.data"
						? allPath.slice(5) // convert #view.data... to data...
						: allPath);
				}
				if (bindings) {
					binds = named === "linkTo" ? (bindto = pathBindings._jsvto = pathBindings._jsvto || []) : bndCtx.bd;
					if (theOb = subPath && binds[binds.length-1]) {
						if (theOb._jsv) {
							while (theOb.sb) {
								theOb = theOb.sb;
							}
							if (theOb.bnd) {
								path = "^" + path.slice(1);
							}
							theOb.sb = path;
							theOb.bnd = theOb.bnd || path.charAt(0) === "^";
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
		// Could do this - but not worth perf cost?? :-
		// if (!path.lastIndexOf("#data.", 0)) { path = path.slice(6); } // If path starts with "#data.", remove that.
		prn = prn || prn2 || "";

		var expr, exprFn, binds, theOb, newOb,
			rtSq = ")";

		if (prn === "[") {
			prn  ="[j._sq(";
			rtSq = ")]";
		}

		if (err && !aposed && !quoted) {
			syntaxError(params);
		} else {
			if (bindings && rtPrnDot && !aposed && !quoted) {
				// This is a binding to a path in which an object is returned by a helper/data function/expression, e.g. foo()^x.y or (a?b:c)^x.y
				// We create a compiled function to get the object instance (which will be called when the dependent data of the subexpression changes, to return the new object, and trigger re-binding of the subsequent path)
				if (!named || boundName || bindto) {
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
							newOb._jsv = exprFn;
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
							? (parenDepth && syntaxError(params), bindings && pathBindings.pop(), named = path, boundName = bound, paramIndex = index + all.length,
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
		result = (params + (tmpl ? " " : "")).replace(rParams, parseTokens);

	return !parenDepth && result || syntaxError(params); // Syntax error if unbalanced parens in params expression
}

function buildCode(ast, tmpl, isLinkExpr) {
	// Build the template function code from the AST nodes, and set as property on the passed-in template object
	// Used for compiling templates, and also by JsViews to build functions for data link expressions
	var i, node, tagName, converter, tagCtx, hasTag, hasEncoder, getsVal, hasCnvt, useCnvt, tmplBindings, pathBindings, params, boundOnErrStart, boundOnErrEnd,
		tagRender, nestedTmpls, tmplName, nestedTmpl, tagAndElses, content, markup, nextIsElse, oldCode, isElse, isGetVal, tagCtxFn, onError, tagStart, trigger,
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
				onError = node[5];
				trigger = node[6];
				markup = node[8] && node[8].replace(rUnescapeQuotes, "$1");
				if (isElse = tagName === "else") {
					if (pathBindings) {
						pathBindings.push(node[7]);
					}
				} else {
					tmplBindingKey = 0;
					if (tmplBindings && (pathBindings = node[7])) { // Array of paths, or false if not data-bound
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

				if (isGetVal && (pathBindings || trigger || converter && converter !== HTML)) {
					// For convertVal we need a compiled function to return the new tagCtx(s)
					tagCtxFn = new Function("data,view,j,u", " // " + tmplName + " " + tmplBindingKey + " " + tagName
										+ "\nreturn {" + tagCtx + "};");
					tagCtxFn._er = onError;
					tagCtxFn._tag = tagName;

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
						? (useCnvt = undefined, useViews = hasCnvt = true, tagRender + (pathBindings
							? ((tmplBindings[tmplBindingKey - 1] = tagCtxFn), tmplBindingKey) // Store the compiled tagCtxFn in tmpl.bnds, and pass the key to convertVal()
							: "{" + tagCtx + "}") + ")")
						: tagName === ">"
							? (hasEncoder = true, "h(" + params[0] + ")")
							: (getsVal = true, "((v=" + params[0] + ')!=null?v:' + (isLinkExpr ? 'null)' : '"")'))
							// Non strict equality so data-link="title{:expr}" with expr=null/undefined removes title attribute
					)
					: (hasTag = true, "\n{view:view,tmpl:" // Add this tagCtx to the compiled code for the tagCtxs to be passed to renderTag()
						+ (content ? nestedTmpls.length : "0") + "," // For block tags, pass in the key (nestedTmpls.length) to the nested content template
						+ tagCtx + "},"));

				if (tagAndElses && !nextIsElse) {
					// This is a data-link expression or an inline tag without any elses, or the last {{else}} of an inline tag
					// We complete the code for returning the tagCtxs array
					code = "[" + code.slice(0, -1) + "]";
					tagRender = 't("' + tagAndElses + '",view,this,';
					if (isLinkExpr || pathBindings) {
						// This is a bound tag (data-link expression or inline bound tag {^{tag ...}}) so we store a compiled tagCtxs function in tmp.bnds
						code = new Function("data,view,j,u", " // " + tmplName + " " + tmplBindingKey + " " + tagAndElses + "\nreturn " + code + ";");
						code._er = onError;
						code._tag = tagAndElses;
						if (pathBindings) {
							setPaths(tmplBindings[tmplBindingKey - 1] = code, pathBindings);
						}
						if (isLinkExpr) {
							return code; // For a data-link expression we return the compiled tagCtxs function
						}
						boundOnErrStart = tagRender + tmplBindingKey + ",undefined,";
						boundOnErrEnd = ")";
					}

					// This is the last {{else}} for an inline tag.
					// For a bound tag, pass the tagCtxs fn lookup key to renderTag.
					// For an unbound tag, include the code directly for evaluating tagCtxs array
					code = oldCode + tagStart + tagRender + (tmplBindingKey || code) + ")";
					pathBindings = 0;
					tagAndElses = 0;
				}
				if (onError) {
					useViews = true;
					code += ';\n}catch(e){ret' + (isLinkExpr ? "urn " : "+=") + boundOnErrStart + 'j._err(e,view,' + onError + ')' + boundOnErrEnd + ';}' + (isLinkExpr ? "" : 'ret=ret');
				}
			}
		}
	}
	// Include only the var references that are needed in the code
	code = "// " + tmplName

		+ "\nvar v"
		+ (hasTag ? ",t=j._tag" : "")                // has tag
		+ (hasCnvt ? ",c=j._cnvt" : "")              // converter
		+ (hasEncoder ? ",h=j._html" : "")           // html converter
		+ (isLinkExpr ? ";\n" : ',ret=""\n')
		+ (tmplOptions.debug ? "debugger;" : "")
		+ code
		+ (isLinkExpr ? "\n" : ";\nreturn ret;");

	if ($subSettings.debugMode !== false) {
		code = "try {\n" + code + "\n}catch(e){\nreturn j._err(e, view);\n}";
	}

	try {
		code = new Function("data,view,j,u", code);
	} catch (e) {
		syntaxError("Compiled template code:\n\n" + code + '\n: "' + e.message + '"');
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

// Get character entity for HTML and Attribute encoding
function getCharEntity(ch) {
	return charEntities[ch] || (charEntities[ch] = "&#" + ch.charCodeAt(0) + ";");
}

function getTargetProps(source) {
	// this pointer is theMap - which has tagCtx.props too
	// arguments: tagCtx.args.
	var key, prop,
		props = [];

	if (typeof source === OBJECT) {
		for (key in source) {
			prop = source[key];
			if (key !== $expando && source.hasOwnProperty(key) && !$isFunction(prop)) {
				props.push({key: key, prop: prop});
			}
		}
	}
	return props;
}

function $fnRender(data, context, noIteration) {
	var tmplElem = this.jquery && (this[0] || error('Unknown template')), // Targeted element not found for jQuery template selector such as "#myTmpl"
		tmpl = tmplElem.getAttribute(tmplAttr);

	return renderContent.call(tmpl ? $.data(tmplElem)[jsvTmpl] : $templates(tmplElem), data, context, noIteration);
}

//========================== Register converters ==========================

function htmlEncode(text) {
	// HTML encode: Replace < > & ' and " by corresponding entities.
	return text != undefined ? rIsHtml.test(text) && ("" + text).replace(rHtmlEncode, getCharEntity) || text : "";
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
		cvtArgs: convertArgs
	};

	topView = $sub.topView = new View();

	//BROWSER-SPECIFIC CODE
	if ($) {

		////////////////////////////////////////////////////////////////////////////////////////////////
		// jQuery (= $) is loaded

		$.fn.render = $fnRender;
		$expando = $.expando;
		if ($.observable) {
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

	($viewsSettings.debugMode = function(debugMode) {
		return debugMode === undefined
			? $subSettings.debugMode
			: (
				$subSettings.debugMode = debugMode,
				$subSettings.onError = debugMode + "" === debugMode
					? new Function("", "return '" + debugMode + "';" )
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
					ret = (self.rendering.done || !val && (arguments.length || !tagCtx.index))
						? ""
						: (self.rendering.done = true, self.selected = tagCtx.index,
							// Test is satisfied, so render content on current context. We call tagCtx.render() rather than return undefined
							// (which would also render the tmpl/content on the current context but would iterate if it is an array)
							tagCtx.render(tagCtx.view, true)); // no arg, so renders against parentView.data
				return ret;
			},
			flow: true
		},
		"for": {
			render: function(val) {
				// This function is called once for {{for}} and once for each {{else}}.
				// We will use the tag.rendering object for carrying rendering state across the calls.
				var finalElse = !arguments.length,
					value,
					self = this,
					tagCtx = self.tagCtx,
					result = "",
					done = 0;

				if (!self.rendering.done) {
					value = finalElse ? tagCtx.view.data : val; // For the final else, defaults to current data without iteration.
					if (value !== undefined) {
						result += tagCtx.render(value, finalElse); // Iterates except on final else, if data is an array. (Use {{include}} to compose templates without array iteration)
						done += $isArray(value) ? value.length : 1;
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xMi1uZXN0ZWQtdW5pdC10ZXN0cy5qcyIsInRlc3QvdGVtcGxhdGVzL2lubmVyLmh0bWwiLCJ0ZXN0L3RlbXBsYXRlcy9vdXRlci5odG1sIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDOXlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiEgSnNSZW5kZXIgdjAuOS44MyAoQmV0YSk6IGh0dHA6Ly9qc3ZpZXdzLmNvbS8janNyZW5kZXIgKi9cbi8qISAqKlZFUlNJT04gRk9SIFdFQioqIChGb3IgTk9ERS5KUyBzZWUgaHR0cDovL2pzdmlld3MuY29tL2Rvd25sb2FkL2pzcmVuZGVyLW5vZGUuanMpICovXG4vKlxuICogQmVzdC1vZi1icmVlZCB0ZW1wbGF0aW5nIGluIGJyb3dzZXIgb3Igb24gTm9kZS5qcy5cbiAqIERvZXMgbm90IHJlcXVpcmUgalF1ZXJ5LCBvciBIVE1MIERPTVxuICogSW50ZWdyYXRlcyB3aXRoIEpzVmlld3MgKGh0dHA6Ly9qc3ZpZXdzLmNvbS8janN2aWV3cylcbiAqXG4gKiBDb3B5cmlnaHQgMjAxNiwgQm9yaXMgTW9vcmVcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuXG4vL2pzaGludCAtVzAxOCwgLVcwNDFcblxuKGZ1bmN0aW9uKGZhY3RvcnksIGdsb2JhbCkge1xuXHQvLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxuXHR2YXIgJCA9IGdsb2JhbC5qUXVlcnk7XG5cblx0aWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7IC8vIENvbW1vbkpTIGUuZy4gQnJvd3NlcmlmeVxuXHRcdG1vZHVsZS5leHBvcnRzID0gJFxuXHRcdFx0PyBmYWN0b3J5KGdsb2JhbCwgJClcblx0XHRcdDogZnVuY3Rpb24oJCkgeyAvLyBJZiBubyBnbG9iYWwgalF1ZXJ5LCB0YWtlIG9wdGlvbmFsIGpRdWVyeSBwYXNzZWQgYXMgcGFyYW1ldGVyOiByZXF1aXJlKCdqc3JlbmRlcicpKGpRdWVyeSlcblx0XHRcdFx0aWYgKCQgJiYgISQuZm4pIHtcblx0XHRcdFx0XHR0aHJvdyBcIlByb3ZpZGUgalF1ZXJ5IG9yIG51bGxcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwsICQpO1xuXHRcdFx0fTtcblx0fSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgc2NyaXB0IGxvYWRlciwgZS5nLiBSZXF1aXJlSlNcblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZmFjdG9yeShnbG9iYWwpO1xuXHRcdH0pO1xuXHR9IGVsc2UgeyAvLyBCcm93c2VyIHVzaW5nIHBsYWluIDxzY3JpcHQ+IHRhZ1xuXHRcdGZhY3RvcnkoZ2xvYmFsLCBmYWxzZSk7XG5cdH1cbn0gKFxuXG4vLyBmYWN0b3J5IChmb3IganNyZW5kZXIuanMpXG5mdW5jdGlvbihnbG9iYWwsICQpIHtcblwidXNlIHN0cmljdFwiO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCB2YXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8vIGdsb2JhbCB2YXIgaXMgdGhlIHRoaXMgb2JqZWN0LCB3aGljaCBpcyB3aW5kb3cgd2hlbiBydW5uaW5nIGluIHRoZSB1c3VhbCBicm93c2VyIGVudmlyb25tZW50XG52YXIgc2V0R2xvYmFscyA9ICQgPT09IGZhbHNlOyAvLyBPbmx5IHNldCBnbG9iYWxzIGlmIHNjcmlwdCBibG9jayBpbiBicm93c2VyIChub3QgQU1EIGFuZCBub3QgQ29tbW9uSlMpXG5cbiQgPSAkICYmICQuZm4gPyAkIDogZ2xvYmFsLmpRdWVyeTsgLy8gJCBpcyBqUXVlcnkgcGFzc2VkIGluIGJ5IENvbW1vbkpTIGxvYWRlciAoQnJvd3NlcmlmeSksIG9yIGdsb2JhbCBqUXVlcnkuXG5cbnZhciB2ZXJzaW9uTnVtYmVyID0gXCJ2MC45LjgzXCIsXG5cdGpzdlN0b3JlTmFtZSwgclRhZywgclRtcGxTdHJpbmcsIHRvcFZpZXcsICR2aWV3cyxcdCRleHBhbmRvLFxuXG4vL1RPRE9cdHRtcGxGbnNDYWNoZSA9IHt9LFxuXHQkaXNGdW5jdGlvbiwgJGlzQXJyYXksICR0ZW1wbGF0ZXMsICRjb252ZXJ0ZXJzLCAkaGVscGVycywgJHRhZ3MsICRzdWIsICRzdWJTZXR0aW5ncywgJHN1YlNldHRpbmdzQWR2YW5jZWQsICR2aWV3c1NldHRpbmdzLCBkZWxpbU9wZW5DaGFyMCwgZGVsaW1PcGVuQ2hhcjEsIGRlbGltQ2xvc2VDaGFyMCwgZGVsaW1DbG9zZUNoYXIxLCBsaW5rQ2hhciwgc2V0dGluZywgYmFzZU9uRXJyb3IsXG5cblx0clBhdGggPSAvXighKj8pKD86bnVsbHx0cnVlfGZhbHNlfFxcZFtcXGQuXSp8KFtcXHckXSt8XFwufH4oW1xcdyRdKyl8Iyh2aWV3fChbXFx3JF0rKSk/KShbXFx3JC5eXSo/KSg/OlsuW15dKFtcXHckXSspXFxdPyk/KSQvZyxcblx0Ly8gICAgICAgIG5vdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgICAgIGhlbHBlciAgICB2aWV3ICB2aWV3UHJvcGVydHkgcGF0aFRva2VucyAgICAgIGxlYWZUb2tlblxuXG5cdHJQYXJhbXMgPSAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykoISo/WyN+XT9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqP1sjfl0/W1xcdyQuXl0rKShbKFtdKT8pfCgsXFxzKil8KFxcKD8pXFxcXD8oPzooJyl8KFwiKSl8KD86XFxzKigoWylcXF1dKSg/PVxccypbLl5dfFxccyokfFteKFtdKXxbKVxcXV0pKFsoW10/KSl8KFxccyspL2csXG5cdC8vICAgICAgICAgIGxmdFBybjAgICAgICAgIGxmdFBybiAgICAgICAgYm91bmQgICAgICAgICAgICBwYXRoICAgIG9wZXJhdG9yIGVyciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxICAgICAgICAgICAgIHBhdGgyICAgICAgIHBybiAgICBjb21tYSAgIGxmdFBybjIgICBhcG9zIHF1b3QgICAgICBydFBybiBydFBybkRvdCAgICAgICAgICAgICAgICAgICAgICAgICAgIHBybjIgIHNwYWNlXG5cdC8vIChsZWZ0IHBhcmVuPyBmb2xsb3dlZCBieSAocGF0aD8gZm9sbG93ZWQgYnkgb3BlcmF0b3IpIG9yIChwYXRoIGZvbGxvd2VkIGJ5IGxlZnQgcGFyZW4/KSkgb3IgY29tbWEgb3IgYXBvcyBvciBxdW90IG9yIHJpZ2h0IHBhcmVuIG9yIHNwYWNlXG5cblx0aXNSZW5kZXJDYWxsLFxuXHRyTmV3TGluZSA9IC9bIFxcdF0qKFxcclxcbnxcXG58XFxyKS9nLFxuXHRyVW5lc2NhcGVRdW90ZXMgPSAvXFxcXChbJ1wiXSkvZyxcblx0ckVzY2FwZVF1b3RlcyA9IC9bJ1wiXFxcXF0vZywgLy8gRXNjYXBlIHF1b3RlcyBhbmQgXFwgY2hhcmFjdGVyXG5cdHJCdWlsZEhhc2ggPSAvKD86XFx4MDh8Xikob25lcnJvcjopPyg/Oih+PykoKFtcXHckX1xcLl0rKTopPyhbXlxceDA4XSspKVxceDA4KCwpPyhbXlxceDA4XSspL2dpLFxuXHRyVGVzdEVsc2VJZiA9IC9eaWZcXHMvLFxuXHRyRmlyc3RFbGVtID0gLzwoXFx3KylbPlxcc10vLFxuXHRyQXR0ckVuY29kZSA9IC9bXFx4MDBgPjxcIicmPV0vZywgLy8gSW5jbHVkZXMgPiBlbmNvZGluZyBzaW5jZSByQ29udmVydE1hcmtlcnMgaW4gSnNWaWV3cyBkb2VzIG5vdCBza2lwID4gY2hhcmFjdGVycyBpbiBhdHRyaWJ1dGUgc3RyaW5nc1xuXHRySXNIdG1sID0gL1tcXHgwMGA+PFxcXCInJj1dLyxcblx0ckhhc0hhbmRsZXJzID0gL15vbltBLVpdfF5jb252ZXJ0KEJhY2spPyQvLFxuXHRyV3JhcHBlZEluVmlld01hcmtlciA9IC9eXFwjXFxkK19gW1xcc1xcU10qXFwvXFxkK19gJC8sXG5cdHJIdG1sRW5jb2RlID0gckF0dHJFbmNvZGUsXG5cdHZpZXdJZCA9IDAsXG5cdGNoYXJFbnRpdGllcyA9IHtcblx0XHRcIiZcIjogXCImYW1wO1wiLFxuXHRcdFwiPFwiOiBcIiZsdDtcIixcblx0XHRcIj5cIjogXCImZ3Q7XCIsXG5cdFx0XCJcXHgwMFwiOiBcIiYjMDtcIixcblx0XHRcIidcIjogXCImIzM5O1wiLFxuXHRcdCdcIic6IFwiJiMzNDtcIixcblx0XHRcImBcIjogXCImIzk2O1wiLFxuXHRcdFwiPVwiOiBcIiYjNjE7XCJcblx0fSxcblx0SFRNTCA9IFwiaHRtbFwiLFxuXHRPQkpFQ1QgPSBcIm9iamVjdFwiLFxuXHR0bXBsQXR0ciA9IFwiZGF0YS1qc3YtdG1wbFwiLFxuXHRqc3ZUbXBsID0gXCJqc3ZUbXBsXCIsXG5cdGluZGV4U3RyID0gXCJGb3IgI2luZGV4IGluIG5lc3RlZCBibG9jayB1c2UgI2dldEluZGV4KCkuXCIsXG5cdCRyZW5kZXIgPSB7fSxcblxuXHRqc3IgPSBnbG9iYWwuanNyZW5kZXIsXG5cdGpzclRvSnEgPSBqc3IgJiYgJCAmJiAhJC5yZW5kZXIsIC8vIEpzUmVuZGVyIGFscmVhZHkgbG9hZGVkLCB3aXRob3V0IGpRdWVyeS4gYnV0IHdlIHdpbGwgcmUtbG9hZCBpdCBub3cgdG8gYXR0YWNoIHRvIGpRdWVyeVxuXG5cdGpzdlN0b3JlcyA9IHtcblx0XHR0ZW1wbGF0ZToge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRtcGxcblx0XHR9LFxuXHRcdHRhZzoge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVRhZ1xuXHRcdH0sXG5cdFx0dmlld01vZGVsOiB7XG5cdFx0XHRjb21waWxlOiBjb21waWxlVmlld01vZGVsXG5cdFx0fSxcblx0XHRoZWxwZXI6IHt9LFxuXHRcdGNvbnZlcnRlcjoge31cblx0fTtcblxuXHQvLyB2aWV3cyBvYmplY3QgKCQudmlld3MgaWYgalF1ZXJ5IGlzIGxvYWRlZCwganNyZW5kZXIudmlld3MgaWYgbm8galF1ZXJ5LCBlLmcuIGluIE5vZGUuanMpXG5cdCR2aWV3cyA9IHtcblx0XHRqc3ZpZXdzOiB2ZXJzaW9uTnVtYmVyLFxuXHRcdHN1Yjoge1xuXHRcdFx0Ly8gc3Vic2NyaXB0aW9uLCBlLmcuIEpzVmlld3MgaW50ZWdyYXRpb25cblx0XHRcdFZpZXc6IFZpZXcsXG5cdFx0XHRFcnI6IEpzVmlld3NFcnJvcixcblx0XHRcdHRtcGxGbjogdG1wbEZuLFxuXHRcdFx0cGFyc2U6IHBhcnNlUGFyYW1zLFxuXHRcdFx0ZXh0ZW5kOiAkZXh0ZW5kLFxuXHRcdFx0ZXh0ZW5kQ3R4OiBleHRlbmRDdHgsXG5cdFx0XHRzeW50YXhFcnI6IHN5bnRheEVycm9yLFxuXHRcdFx0b25TdG9yZToge30sXG5cdFx0XHRhZGRTZXR0aW5nOiBhZGRTZXR0aW5nLFxuXHRcdFx0c2V0dGluZ3M6IHtcblx0XHRcdFx0YWxsb3dDb2RlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdGFkdlNldDogbm9vcCwgLy8gVXBkYXRlIGFkdmFuY2VkIHNldHRpbmdzXG5cdFx0XHRfdGhzOiB0YWdIYW5kbGVyc0Zyb21Qcm9wcyxcblx0XHRcdF90ZzogZnVuY3Rpb24oKSB7fSwgLy8gQ29uc3RydWN0b3IgZm9yIHRhZ0RlZlxuXHRcdFx0X2NudnQ6IGNvbnZlcnRWYWwsXG5cdFx0XHRfdGFnOiByZW5kZXJUYWcsXG5cdFx0XHRfZXI6IGVycm9yLFxuXHRcdFx0X2Vycjogb25SZW5kZXJFcnJvcixcblx0XHRcdF9odG1sOiBodG1sRW5jb2RlLFxuXHRcdFx0X2NwOiByZXRWYWwsIC8vIEdldCBjb21waWxlZCBjb250ZXh0dWFsIHBhcmFtZXRlcnMgKG9yIHByb3BlcnRpZXMpIH5mb289ZXhwci4gSW4gSnNSZW5kZXIsIHNpbXBseSByZXR1cm5zIHZhbC5cblx0XHRcdF9zcTogZnVuY3Rpb24odG9rZW4pIHtcblx0XHRcdFx0aWYgKHRva2VuID09PSBcImNvbnN0cnVjdG9yXCIpIHtcblx0XHRcdFx0XHRzeW50YXhFcnJvcihcIlwiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdG9rZW47XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRzZXR0aW5nczoge1xuXHRcdFx0ZGVsaW1pdGVyczogJHZpZXdzRGVsaW1pdGVycyxcblx0XHRcdGFkdmFuY2VkOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWVcblx0XHRcdFx0XHQ/IChcblx0XHRcdFx0XHRcdFx0JGV4dGVuZCgkc3ViU2V0dGluZ3NBZHZhbmNlZCwgdmFsdWUpLFxuXHRcdFx0XHRcdFx0XHQkc3ViLmFkdlNldCgpLFxuXHRcdFx0XHRcdFx0XHQkdmlld3NTZXR0aW5nc1xuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0OiAkc3ViU2V0dGluZ3NBZHZhbmNlZDtcblx0XHRcdFx0fVxuXHRcdH0sXG5cdFx0Z2V0Q3R4OiByZXRWYWwsIC8vIEdldCBjdHguZm9vIHZhbHVlLiBJbiBKc1JlbmRlciwgc2ltcGx5IHJldHVybnMgdmFsLlxuXHRcdG1hcDogZGF0YU1hcCAgICAvLyBJZiBqc09ic2VydmFibGUgbG9hZGVkIGZpcnN0LCB1c2UgdGhhdCBkZWZpbml0aW9uIG9mIGRhdGFNYXBcblx0fTtcblxuZnVuY3Rpb24gZ2V0RGVyaXZlZE1ldGhvZChiYXNlTWV0aG9kLCBtZXRob2QpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdHZhciByZXQsXG5cdFx0XHR0YWcgPSB0aGlzLFxuXHRcdFx0cHJldkJhc2UgPSB0YWcuYmFzZTtcblxuXHRcdHRhZy5iYXNlID0gYmFzZU1ldGhvZDsgLy8gV2l0aGluIG1ldGhvZCBjYWxsLCBjYWxsaW5nIHRoaXMuYmFzZSB3aWxsIGNhbGwgdGhlIGJhc2UgbWV0aG9kXG5cdFx0cmV0ID0gbWV0aG9kLmFwcGx5KHRhZywgYXJndW1lbnRzKTsgLy8gQ2FsbCB0aGUgbWV0aG9kXG5cdFx0dGFnLmJhc2UgPSBwcmV2QmFzZTsgLy8gUmVwbGFjZSB0aGlzLmJhc2UgdG8gYmUgdGhlIGJhc2UgbWV0aG9kIG9mIHRoZSBwcmV2aW91cyBjYWxsLCBmb3IgY2hhaW5lZCBjYWxsc1xuXHRcdHJldHVybiByZXQ7XG5cdH07XG59XG5cbmZ1bmN0aW9uIGdldE1ldGhvZChiYXNlTWV0aG9kLCBtZXRob2QpIHtcblx0Ly8gRm9yIGRlcml2ZWQgbWV0aG9kcyAob3IgaGFuZGxlcnMgZGVjbGFyZWQgZGVjbGFyYXRpdmVseSBhcyBpbiB7ezpmb28gb25DaGFuZ2U9fmZvb0NoYW5nZWR9fSByZXBsYWNlIGJ5IGEgZGVyaXZlZCBtZXRob2QsIHRvIGFsbG93IHVzaW5nIHRoaXMuYmFzZSguLi4pXG5cdC8vIG9yIHRoaXMuYmFzZUFwcGx5KGFyZ3VtZW50cykgdG8gY2FsbCB0aGUgYmFzZSBpbXBsZW1lbnRhdGlvbi4gKEVxdWl2YWxlbnQgdG8gdGhpcy5fc3VwZXIoLi4uKSBhbmQgdGhpcy5fc3VwZXJBcHBseShhcmd1bWVudHMpIGluIGpRdWVyeSBVSSlcblx0aWYgKCRpc0Z1bmN0aW9uKG1ldGhvZCkpIHtcblx0XHRtZXRob2QgPSBnZXREZXJpdmVkTWV0aG9kKFxuXHRcdFx0XHQhYmFzZU1ldGhvZFxuXHRcdFx0XHRcdD8gbm9vcCAvLyBubyBiYXNlIG1ldGhvZCBpbXBsZW1lbnRhdGlvbiwgc28gdXNlIG5vb3AgYXMgYmFzZSBtZXRob2Rcblx0XHRcdFx0XHQ6IGJhc2VNZXRob2QuX2Rcblx0XHRcdFx0XHRcdD8gYmFzZU1ldGhvZCAvLyBiYXNlTWV0aG9kIGlzIGEgZGVyaXZlZCBtZXRob2QsIHNvIHVzIGl0XG5cdFx0XHRcdFx0XHQ6IGdldERlcml2ZWRNZXRob2Qobm9vcCwgYmFzZU1ldGhvZCksIC8vIGJhc2VNZXRob2QgaXMgbm90IGRlcml2ZWQgc28gbWFrZSBpdHMgYmFzZSBtZXRob2QgYmUgdGhlIG5vb3AgbWV0aG9kXG5cdFx0XHRcdG1ldGhvZFxuXHRcdFx0KTtcblx0XHRtZXRob2QuX2QgPSAxOyAvLyBBZGQgZmxhZyB0aGF0IHRoaXMgaXMgYSBkZXJpdmVkIG1ldGhvZFxuXHR9XG5cdHJldHVybiBtZXRob2Q7XG59XG5cbmZ1bmN0aW9uIHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4KSB7XG5cdGZvciAodmFyIHByb3AgaW4gdGFnQ3R4LnByb3BzKSB7XG5cdFx0aWYgKHJIYXNIYW5kbGVycy50ZXN0KHByb3ApKSB7XG5cdFx0XHR0YWdbcHJvcF0gPSBnZXRNZXRob2QodGFnW3Byb3BdLCB0YWdDdHgucHJvcHNbcHJvcF0pO1xuXHRcdFx0Ly8gQ29weSBvdmVyIHRoZSBvbkZvbyBwcm9wcywgY29udmVydCBhbmQgY29udmVydEJhY2sgZnJvbSB0YWdDdHgucHJvcHMgdG8gdGFnIChvdmVycmlkZXMgdmFsdWVzIGluIHRhZ0RlZikuXG5cdFx0XHQvLyBOb3RlOiB1bnN1cHBvcnRlZCBzY2VuYXJpbzogaWYgaGFuZGxlcnMgYXJlIGR5bmFtaWNhbGx5IGFkZGVkIF5vbkZvbz1leHByZXNzaW9uIHRoaXMgd2lsbCB3b3JrLCBidXQgZHluYW1pY2FsbHkgcmVtb3Zpbmcgd2lsbCBub3Qgd29yay5cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcmV0VmFsKHZhbCkge1xuXHRyZXR1cm4gdmFsO1xufVxuXG5mdW5jdGlvbiBub29wKCkge1xuXHRyZXR1cm4gXCJcIjtcbn1cblxuZnVuY3Rpb24gZGJnQnJlYWsodmFsKSB7XG5cdC8vIFVzYWdlIGV4YW1wbGVzOiB7e2RiZzouLi59fSwge3s6fmRiZyguLi4pfX0sIHt7ZGJnIC4uLi99fSwge157Zm9yIC4uLiBvbkFmdGVyTGluaz1+ZGJnfX0gZXRjLlxuXHR0cnkge1xuXHRcdGNvbnNvbGUubG9nKFwiSnNSZW5kZXIgZGJnIGJyZWFrcG9pbnQ6IFwiICsgdmFsKTtcblx0XHR0aHJvdyBcImRiZyBicmVha3BvaW50XCI7IC8vIFRvIGJyZWFrIGhlcmUsIHN0b3Agb24gY2F1Z2h0IGV4Y2VwdGlvbnMuXG5cdH1cblx0Y2F0Y2ggKGUpIHt9XG5cdHJldHVybiB0aGlzLmJhc2UgPyB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIDogdmFsO1xufVxuXG5mdW5jdGlvbiBKc1ZpZXdzRXJyb3IobWVzc2FnZSkge1xuXHQvLyBFcnJvciBleGNlcHRpb24gdHlwZSBmb3IgSnNWaWV3cy9Kc1JlbmRlclxuXHQvLyBPdmVycmlkZSBvZiAkLnZpZXdzLnN1Yi5FcnJvciBpcyBwb3NzaWJsZVxuXHR0aGlzLm5hbWUgPSAoJC5saW5rID8gXCJKc1ZpZXdzXCIgOiBcIkpzUmVuZGVyXCIpICsgXCIgRXJyb3JcIjtcblx0dGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCB0aGlzLm5hbWU7XG59XG5cbmZ1bmN0aW9uICRleHRlbmQodGFyZ2V0LCBzb3VyY2UpIHtcblx0Zm9yICh2YXIgbmFtZSBpbiBzb3VyY2UpIHtcblx0XHR0YXJnZXRbbmFtZV0gPSBzb3VyY2VbbmFtZV07XG5cdH1cblx0cmV0dXJuIHRhcmdldDtcbn1cblxuKEpzVmlld3NFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKSkuY29uc3RydWN0b3IgPSBKc1ZpZXdzRXJyb3I7XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gVG9wLWxldmVsIGZ1bmN0aW9ucyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLz09PT09PT09PT09PT09PT09PT1cbi8vIHZpZXdzLmRlbGltaXRlcnNcbi8vPT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiAkdmlld3NEZWxpbWl0ZXJzKG9wZW5DaGFycywgY2xvc2VDaGFycywgbGluaykge1xuXHQvLyBTZXQgdGhlIHRhZyBvcGVuaW5nIGFuZCBjbG9zaW5nIGRlbGltaXRlcnMgYW5kICdsaW5rJyBjaGFyYWN0ZXIuIERlZmF1bHQgaXMgXCJ7e1wiLCBcIn19XCIgYW5kIFwiXlwiXG5cdC8vIG9wZW5DaGFycywgY2xvc2VDaGFyczogb3BlbmluZyBhbmQgY2xvc2luZyBzdHJpbmdzLCBlYWNoIHdpdGggdHdvIGNoYXJhY3RlcnNcblx0aWYgKCFvcGVuQ2hhcnMpIHtcblx0XHRyZXR1cm4gJHN1YlNldHRpbmdzLmRlbGltaXRlcnM7XG5cdH1cblx0aWYgKCRpc0FycmF5KG9wZW5DaGFycykpIHtcblx0XHRyZXR1cm4gJHZpZXdzRGVsaW1pdGVycy5hcHBseSgkdmlld3MsIG9wZW5DaGFycyk7XG5cdH1cblxuXHQkc3ViU2V0dGluZ3MuZGVsaW1pdGVycyA9IFtvcGVuQ2hhcnMsIGNsb3NlQ2hhcnMsIGxpbmtDaGFyID0gbGluayA/IGxpbmsuY2hhckF0KDApIDogbGlua0NoYXJdO1xuXG5cdGRlbGltT3BlbkNoYXIwID0gb3BlbkNoYXJzLmNoYXJBdCgwKTsgLy8gRXNjYXBlIHRoZSBjaGFyYWN0ZXJzIC0gc2luY2UgdGhleSBjb3VsZCBiZSByZWdleCBzcGVjaWFsIGNoYXJhY3RlcnNcblx0ZGVsaW1PcGVuQ2hhcjEgPSBvcGVuQ2hhcnMuY2hhckF0KDEpO1xuXHRkZWxpbUNsb3NlQ2hhcjAgPSBjbG9zZUNoYXJzLmNoYXJBdCgwKTtcblx0ZGVsaW1DbG9zZUNoYXIxID0gY2xvc2VDaGFycy5jaGFyQXQoMSk7XG5cdG9wZW5DaGFycyA9IFwiXFxcXFwiICsgZGVsaW1PcGVuQ2hhcjAgKyBcIihcXFxcXCIgKyBsaW5rQ2hhciArIFwiKT9cXFxcXCIgKyBkZWxpbU9wZW5DaGFyMTsgLy8gRGVmYXVsdCBpcyBcIntee1wiXG5cdGNsb3NlQ2hhcnMgPSBcIlxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIxOyAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGlzIFwifX1cIlxuXHQvLyBCdWlsZCByZWdleCB3aXRoIG5ldyBkZWxpbWl0ZXJzXG5cdC8vICAgICAgICAgIFt0YWcgICAgKGZvbGxvd2VkIGJ5IC8gc3BhY2Ugb3IgfSkgIG9yIGN2dHIrY29sb24gb3IgaHRtbCBvciBjb2RlXSBmb2xsb3dlZCBieSBzcGFjZStwYXJhbXMgdGhlbiBjb252ZXJ0QmFjaz9cblx0clRhZyA9IFwiKD86KFxcXFx3Kyg/PVtcXFxcL1xcXFxzXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIwICsgXCJdKSl8KFxcXFx3Kyk/KDopfCg+KXwoXFxcXCopKVxcXFxzKigoPzpbXlxcXFxcIlxuXHRcdCsgZGVsaW1DbG9zZUNoYXIwICsgXCJdfFxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiKD8hXFxcXFwiICsgZGVsaW1DbG9zZUNoYXIxICsgXCIpKSo/KVwiO1xuXG5cdC8vIE1ha2UgclRhZyBhdmFpbGFibGUgdG8gSnNWaWV3cyAob3Igb3RoZXIgY29tcG9uZW50cykgZm9yIHBhcnNpbmcgYmluZGluZyBleHByZXNzaW9uc1xuXHQkc3ViLnJUYWcgPSBcIig/OlwiICsgclRhZyArIFwiKVwiO1xuXHQvLyAgICAgICAgICAgICAgICAgICAgICAgIHsgXj8geyAgIHRhZytwYXJhbXMgc2xhc2g/ICBvciBjbG9zaW5nVGFnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3IgY29tbWVudFxuXHRyVGFnID0gbmV3IFJlZ0V4cChcIig/OlwiICsgb3BlbkNoYXJzICsgclRhZyArIFwiKFxcXFwvKT98XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjAgKyBcIihcXFxcXCIgKyBsaW5rQ2hhciArIFwiKT9cXFxcXCIgKyBkZWxpbU9wZW5DaGFyMSArIFwiKD86KD86XFxcXC8oXFxcXHcrKSlcXFxccyp8IS0tW1xcXFxzXFxcXFNdKj8tLSkpXCIgKyBjbG9zZUNoYXJzLCBcImdcIik7XG5cblx0Ly8gRGVmYXVsdDogIGJpbmQgICAgIHRhZ05hbWUgICAgICAgICBjdnQgICBjbG4gaHRtbCBjb2RlICAgIHBhcmFtcyAgICAgICAgICAgIHNsYXNoICAgYmluZDIgICAgICAgICBjbG9zZUJsayAgY29tbWVudFxuXHQvLyAgICAgIC8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19XG5cblx0JHN1Yi5yVG1wbCA9IG5ldyBSZWdFeHAoXCI8Lio+fChbXlxcXFxcXFxcXXxeKVt7fV18XCIgKyBvcGVuQ2hhcnMgKyBcIi4qXCIgKyBjbG9zZUNoYXJzKTtcblx0Ly8gJHN1Yi5yVG1wbCBsb29rcyBmb3IgaHRtbCB0YWdzIG9yIHsgb3IgfSBjaGFyIG5vdCBwcmVjZWRlZCBieSBcXFxcLCBvciBKc1JlbmRlciB0YWdzIHt7eHh4fX0uIEVhY2ggb2YgdGhlc2Ugc3RyaW5ncyBhcmUgY29uc2lkZXJlZFxuXHQvLyBOT1QgdG8gYmUgalF1ZXJ5IHNlbGVjdG9yc1xuXHRyZXR1cm4gJHZpZXdzU2V0dGluZ3M7XG59XG5cbi8vPT09PT09PT09XG4vLyBWaWV3LmdldFxuLy89PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0Vmlldyhpbm5lciwgdHlwZSkgeyAvL3ZpZXcuZ2V0KGlubmVyLCB0eXBlKVxuXHRpZiAoIXR5cGUgJiYgaW5uZXIgIT09IHRydWUpIHtcblx0XHQvLyB2aWV3LmdldCh0eXBlKVxuXHRcdHR5cGUgPSBpbm5lcjtcblx0XHRpbm5lciA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHZhciB2aWV3cywgaSwgbCwgZm91bmQsXG5cdFx0dmlldyA9IHRoaXMsXG5cdFx0cm9vdCA9ICF0eXBlIHx8IHR5cGUgPT09IFwicm9vdFwiO1xuXHRcdC8vIElmIHR5cGUgaXMgdW5kZWZpbmVkLCByZXR1cm5zIHJvb3QgdmlldyAodmlldyB1bmRlciB0b3AgdmlldykuXG5cblx0aWYgKGlubmVyKSB7XG5cdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIG5lc3RlZCBvbmVzLCBkZXB0aC1maXJzdCAtIGFuZCByZXR1cm4gZmlyc3Qgb25lIHdpdGggZ2l2ZW4gdHlwZS5cblx0XHQvLyBJZiB0eXBlIGlzIHVuZGVmaW5lZCwgaS5lLiB2aWV3LmdldCh0cnVlKSwgcmV0dXJuIGZpcnN0IGNoaWxkIHZpZXcuXG5cdFx0Zm91bmQgPSB0eXBlICYmIHZpZXcudHlwZSA9PT0gdHlwZSAmJiB2aWV3O1xuXHRcdGlmICghZm91bmQpIHtcblx0XHRcdHZpZXdzID0gdmlldy52aWV3cztcblx0XHRcdGlmICh2aWV3Ll8udXNlS2V5KSB7XG5cdFx0XHRcdGZvciAoaSBpbiB2aWV3cykge1xuXHRcdFx0XHRcdGlmIChmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV0pIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChpID0gMCwgbCA9IHZpZXdzLmxlbmd0aDsgIWZvdW5kICYmIGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHRmb3VuZCA9IHR5cGUgPyB2aWV3c1tpXS5nZXQoaW5uZXIsIHR5cGUpIDogdmlld3NbaV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSBpZiAocm9vdCkge1xuXHRcdC8vIEZpbmQgcm9vdCB2aWV3LiAodmlldyB3aG9zZSBwYXJlbnQgaXMgdG9wIHZpZXcpXG5cdFx0d2hpbGUgKHZpZXcucGFyZW50KSB7XG5cdFx0XHRmb3VuZCA9IHZpZXc7XG5cdFx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHdoaWxlICh2aWV3ICYmICFmb3VuZCkge1xuXHRcdFx0Ly8gR28gdGhyb3VnaCB2aWV3cyAtIHRoaXMgb25lLCBhbmQgYWxsIHBhcmVudCBvbmVzIC0gYW5kIHJldHVybiBmaXJzdCBvbmUgd2l0aCBnaXZlbiB0eXBlLlxuXHRcdFx0Zm91bmQgPSB2aWV3LnR5cGUgPT09IHR5cGUgPyB2aWV3IDogdW5kZWZpbmVkO1xuXHRcdFx0dmlldyA9IHZpZXcucGFyZW50O1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gZm91bmQ7XG59XG5cbmZ1bmN0aW9uIGdldE5lc3RlZEluZGV4KCkge1xuXHR2YXIgdmlldyA9IHRoaXMuZ2V0KFwiaXRlbVwiKTtcblx0cmV0dXJuIHZpZXcgPyB2aWV3LmluZGV4IDogdW5kZWZpbmVkO1xufVxuXG5nZXROZXN0ZWRJbmRleC5kZXBlbmRzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBbdGhpcy5nZXQoXCJpdGVtXCIpLCBcImluZGV4XCJdO1xufTtcblxuZnVuY3Rpb24gZ2V0SW5kZXgoKSB7XG5cdHJldHVybiB0aGlzLmluZGV4O1xufVxuXG5nZXRJbmRleC5kZXBlbmRzID0gXCJpbmRleFwiO1xuXG4vLz09PT09PT09PT1cbi8vIFZpZXcuaGxwXG4vLz09PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0SGVscGVyKGhlbHBlciwgaXNDb250ZXh0Q2IpIHtcblx0Ly8gSGVscGVyIG1ldGhvZCBjYWxsZWQgYXMgdmlldy5obHAoa2V5KSBmcm9tIGNvbXBpbGVkIHRlbXBsYXRlLCBmb3IgaGVscGVycyBvciB0ZW1wbGF0ZSBwYXJhbWV0ZXJzIH5mb29cblx0dmFyIHdyYXBwZWQsIGRlcHMsXG5cdHZpZXcgPSB0aGlzLFxuXHRyZXMgPSB2aWV3LmN0eDtcblxuXHRpZiAocmVzKSB7XG5cdFx0cmVzID0gcmVzW2hlbHBlcl07XG5cdH1cblx0aWYgKHJlcyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmVzID0gJGhlbHBlcnNbaGVscGVyXTtcblx0fVxuXHRpZiAocmVzICYmIHJlcy5fY3ApIHsgLy8gSWYgdGhpcyBoZWxwZXIgcmVzb3VyY2UgaXMgYSBjb250ZXh0dWFsIHBhcmFtZXRlciwgfmZvbz1leHByXG5cdFx0aWYgKGlzQ29udGV4dENiKSB7ICAvLyBJbiBhIGNvbnRleHQgY2FsbGJhY2sgZm9yIGEgY29udGV4dHVhbCBwYXJhbSwgcmV0dXJuIHRoZSBbdmlldywgZGVwZW5kZW5jaWVzLi4uXSBhcnJheSAtIG5lZWRlZCBmb3Igb2JzZXJ2ZSBjYWxsXG5cdFx0XHRkZXBzID0gJHN1Yi5fY2VvKHJlc1sxXS5kZXBzKTsgIC8vIGZuIGRlcHMsIHdpdGggYW55IGV4cHJPYnMgY2xvbmVkXG5cdFx0XHRkZXBzLnVuc2hpZnQocmVzWzBdKTsgICAgICAgICAgIC8vIHZpZXdcblx0XHRcdGRlcHMuX2NwID0gdHJ1ZTtcblx0XHRcdHJldHVybiBkZXBzO1xuXHRcdH1cblx0XHRyZXMgPSAkdmlld3MuZ2V0Q3R4KHJlcyk7IC8vIElmIGEgY29udGV4dHVhbCBwYXJhbSwgYnV0IG5vdCBhIGNvbnRleHQgY2FsbGJhY2ssIHJldHVybiBldmFsdWF0ZWQgcGFyYW0gLSBmbihkYXRhLCB2aWV3LCBqKVxuXHR9XG5cblx0aWYgKHJlcykge1xuXHRcdGlmICgkaXNGdW5jdGlvbihyZXMpICYmICFyZXMuX3dycCkge1xuXHRcdFx0Ly8gSWYgaXQgaXMgb2YgdHlwZSBmdW5jdGlvbiwgYW5kIG5vdCBhbHJlYWR5IHdyYXBwZWQsIHdlIHdpbGwgd3JhcCBpdCwgc28gaWYgY2FsbGVkIHdpdGggbm8gdGhpcyBwb2ludGVyIGl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlXG5cdFx0XHQvLyB2aWV3IGFzICd0aGlzJyBjb250ZXh0LiBJZiB0aGUgaGVscGVyIH5mb28oKSB3YXMgaW4gYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiwgdGhlIHZpZXcgd2lsbCBoYXZlIGEgJ3RlbXBvcmFyeScgbGlua0N0eCBwcm9wZXJ0eSB0b28uXG5cdFx0XHQvLyBOb3RlIHRoYXQgaGVscGVyIGZ1bmN0aW9ucyBvbiBkZWVwZXIgcGF0aHMgd2lsbCBoYXZlIHNwZWNpZmljIHRoaXMgcG9pbnRlcnMsIGZyb20gdGhlIHByZWNlZGluZyBwYXRoLlxuXHRcdFx0Ly8gRm9yIGV4YW1wbGUsIH51dGlsLmZvbygpIHdpbGwgaGF2ZSB0aGUgfnV0aWwgb2JqZWN0IGFzICd0aGlzJyBwb2ludGVyXG5cdFx0XHR3cmFwcGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiByZXMuYXBwbHkoKCF0aGlzIHx8IHRoaXMgPT09IGdsb2JhbCkgPyB2aWV3IDogdGhpcywgYXJndW1lbnRzKTtcblx0XHRcdH07XG5cdFx0XHR3cmFwcGVkLl93cnAgPSB2aWV3O1xuXHRcdFx0JGV4dGVuZCh3cmFwcGVkLCByZXMpOyAvLyBBdHRhY2ggc2FtZSBleHBhbmRvcyAoaWYgYW55KSB0byB0aGUgd3JhcHBlZCBmdW5jdGlvblxuXHRcdH1cblx0fVxuXHRyZXR1cm4gd3JhcHBlZCB8fCByZXM7XG59XG5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKHRtcGwpIHtcblx0cmV0dXJuIHRtcGwgJiYgKHRtcGwuZm5cblx0XHQ/IHRtcGxcblx0XHQ6IHRoaXMuZ2V0UnNjKFwidGVtcGxhdGVzXCIsIHRtcGwpIHx8ICR0ZW1wbGF0ZXModG1wbCkpOyAvLyBub3QgeWV0IGNvbXBpbGVkXG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHZpZXdzLl9jbnZ0XG4vLz09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbnZlcnRWYWwoY29udmVydGVyLCB2aWV3LCB0YWdDdHgsIG9uRXJyb3IpIHtcblx0Ly8gc2VsZiBpcyB0ZW1wbGF0ZSBvYmplY3Qgb3IgbGlua0N0eCBvYmplY3Rcblx0dmFyIHRhZywgdmFsdWUsXG5cdFx0Ly8gaWYgdGFnQ3R4IGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4XG5cdFx0Ym91bmRUYWcgPSB0eXBlb2YgdGFnQ3R4ID09PSBcIm51bWJlclwiICYmIHZpZXcudG1wbC5ibmRzW3RhZ0N0eC0xXSxcblx0XHRsaW5rQ3R4ID0gdmlldy5saW5rQ3R4OyAvLyBGb3IgZGF0YS1saW5rPVwie2N2dDouLi59XCIuLi5cblxuXHRpZiAob25FcnJvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0dGFnQ3R4ID0gb25FcnJvciA9IHtwcm9wczoge30sIGFyZ3M6IFtvbkVycm9yXX07XG5cdH0gZWxzZSBpZiAoYm91bmRUYWcpIHtcblx0XHR0YWdDdHggPSBib3VuZFRhZyh2aWV3LmRhdGEsIHZpZXcsICRzdWIpO1xuXHR9XG5cblx0dmFsdWUgPSB0YWdDdHguYXJnc1swXTtcblx0aWYgKGNvbnZlcnRlciB8fCBib3VuZFRhZykge1xuXHRcdHRhZyA9IGxpbmtDdHggJiYgbGlua0N0eC50YWc7XG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdHRhZyA9ICRleHRlbmQobmV3ICRzdWIuX3RnKCksIHtcblx0XHRcdFx0Xzoge1xuXHRcdFx0XHRcdGlubGluZTogIWxpbmtDdHgsXG5cdFx0XHRcdFx0Ym5kOiBib3VuZFRhZyxcblx0XHRcdFx0XHR1bmxpbmtlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0YWdOYW1lOiBcIjpcIixcblx0XHRcdFx0Y3Z0OiBjb252ZXJ0ZXIsXG5cdFx0XHRcdGZsb3c6IHRydWUsXG5cdFx0XHRcdHRhZ0N0eDogdGFnQ3R4XG5cdFx0XHR9KTtcblx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIChsaW5rQ3R4ID8gbGlua0N0eC52aWV3IDogdmlldykuY3R4KTtcblx0XHR9XG5cdFx0dGFnLl9lciA9IG9uRXJyb3IgJiYgdmFsdWU7XG5cdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpO1xuXG5cdFx0dGFnQ3R4LnZpZXcgPSB2aWV3O1xuXG5cdFx0dGFnLmN0eCA9IHRhZ0N0eC5jdHggfHwgdGFnLmN0eCB8fCB7fTtcblx0XHR0YWdDdHguY3R4ID0gdW5kZWZpbmVkO1xuXG5cdFx0dmFsdWUgPSB0YWcuY3Z0QXJncyhjb252ZXJ0ZXIgIT09IFwidHJ1ZVwiICYmIGNvbnZlcnRlcilbMF07IC8vIElmIHRoZXJlIGlzIGEgY29udmVydEJhY2sgYnV0IG5vIGNvbnZlcnQsIGNvbnZlcnRlciB3aWxsIGJlIFwidHJ1ZVwiXG5cblx0XHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdFx0dmFsdWUgPSBib3VuZFRhZyAmJiB2aWV3Ll8ub25SZW5kZXJcblx0XHRcdD8gdmlldy5fLm9uUmVuZGVyKHZhbHVlLCB2aWV3LCB0YWcpXG5cdFx0XHQ6IHZhbHVlO1xuXHR9XG5cdHJldHVybiB2YWx1ZSAhPSB1bmRlZmluZWQgPyB2YWx1ZSA6IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBcmdzKGNvbnZlcnRlcikge1xuXHR2YXIgdGFnID0gdGhpcyxcblx0XHR0YWdDdHggPSB0YWcudGFnQ3R4LFxuXHRcdHZpZXcgPSB0YWdDdHgudmlldyxcblx0XHRhcmdzID0gdGFnQ3R4LmFyZ3M7XG5cblx0Y29udmVydGVyID0gY29udmVydGVyIHx8IHRhZy5jb252ZXJ0O1xuXHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIgJiYgKFwiXCIgKyBjb252ZXJ0ZXIgPT09IGNvbnZlcnRlclxuXHRcdD8gKHZpZXcuZ2V0UnNjKFwiY29udmVydGVyc1wiLCBjb252ZXJ0ZXIpIHx8IGVycm9yKFwiVW5rbm93biBjb252ZXJ0ZXI6ICdcIiArIGNvbnZlcnRlciArIFwiJ1wiKSlcblx0XHQ6IGNvbnZlcnRlcik7XG5cblx0YXJncyA9ICFhcmdzLmxlbmd0aCAmJiAhdGFnQ3R4LmluZGV4IC8vIE9uIHRoZSBvcGVuaW5nIHRhZyB3aXRoIG5vIGFyZ3MsIGJpbmQgdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0XG5cdFx0PyBbdmlldy5kYXRhXVxuXHRcdDogY29udmVydGVyXG5cdFx0XHQ/IGFyZ3Muc2xpY2UoKSAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRlciwgdXNlIGEgY29weSBvZiB0aGUgdGFnQ3R4LmFyZ3MgYXJyYXkgZm9yIHJlbmRlcmluZywgYW5kIHJlcGxhY2UgdGhlIGFyZ3NbMF0gaW5cblx0XHRcdC8vIHRoZSBjb3BpZWQgYXJyYXkgd2l0aCB0aGUgY29udmVydGVkIHZhbHVlLiBCdXQgd2UgZG8gbm90IG1vZGlmeSB0aGUgdmFsdWUgb2YgdGFnLnRhZ0N0eC5hcmdzWzBdICh0aGUgb3JpZ2luYWwgYXJncyBhcnJheSlcblx0XHRcdDogYXJnczsgLy8gSWYgbm8gY29udmVydGVyLCBnZXQgdGhlIG9yaWdpbmFsIHRhZ0N0eC5hcmdzXG5cblx0aWYgKGNvbnZlcnRlcikge1xuXHRcdGlmIChjb252ZXJ0ZXIuZGVwZW5kcykge1xuXHRcdFx0dGFnLmRlcGVuZHMgPSAkc3ViLmdldERlcHModGFnLmRlcGVuZHMsIHRhZywgY29udmVydGVyLmRlcGVuZHMsIGNvbnZlcnRlcik7XG5cdFx0fVxuXHRcdGFyZ3NbMF0gPSBjb252ZXJ0ZXIuYXBwbHkodGFnLCBhcmdzKTtcblx0fVxuXHRyZXR1cm4gYXJncztcbn1cblxuLy89PT09PT09PT09PT09XG4vLyB2aWV3cy5fdGFnXG4vLz09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0UmVzb3VyY2UocmVzb3VyY2VUeXBlLCBpdGVtTmFtZSkge1xuXHR2YXIgcmVzLCBzdG9yZSxcblx0XHR2aWV3ID0gdGhpcztcblx0d2hpbGUgKChyZXMgPT09IHVuZGVmaW5lZCkgJiYgdmlldykge1xuXHRcdHN0b3JlID0gdmlldy50bXBsICYmIHZpZXcudG1wbFtyZXNvdXJjZVR5cGVdO1xuXHRcdHJlcyA9IHN0b3JlICYmIHN0b3JlW2l0ZW1OYW1lXTtcblx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdH1cblx0cmV0dXJuIHJlcyB8fCAkdmlld3NbcmVzb3VyY2VUeXBlXVtpdGVtTmFtZV07XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRhZyh0YWdOYW1lLCBwYXJlbnRWaWV3LCB0bXBsLCB0YWdDdHhzLCBpc1VwZGF0ZSwgb25FcnJvcikge1xuXHRwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCB0b3BWaWV3O1xuXHR2YXIgdGFnLCB0YWdfLCB0YWdEZWYsIHRlbXBsYXRlLCB0YWdzLCBhdHRyLCBwYXJlbnRUYWcsIGksIGwsIGl0ZW1SZXQsIHRhZ0N0eCwgdGFnQ3R4Q3R4LFxuXHRcdGNvbnRlbnQsIGNhbGxJbml0LCBtYXBEZWYsIHRoaXNNYXAsIGFyZ3MsIHByb3BzLCBpbml0aWFsVG1wbCwgdGFnRGF0YU1hcCwgY29udGVudEN0eCxcblx0XHRyZXQgPSBcIlwiLFxuXHRcdGxpbmtDdHggPSBwYXJlbnRWaWV3LmxpbmtDdHggfHwgMCxcblx0XHRjdHggPSBwYXJlbnRWaWV3LmN0eCxcblx0XHRwYXJlbnRUbXBsID0gdG1wbCB8fCBwYXJlbnRWaWV3LnRtcGwsXG5cdFx0Ly8gaWYgdGFnQ3R4IGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4c1xuXHRcdGJvdW5kVGFnID0gdHlwZW9mIHRhZ0N0eHMgPT09IFwibnVtYmVyXCIgJiYgcGFyZW50Vmlldy50bXBsLmJuZHNbdGFnQ3R4cy0xXTtcblxuXHRpZiAodGFnTmFtZS5faXMgPT09IFwidGFnXCIpIHtcblx0XHR0YWcgPSB0YWdOYW1lO1xuXHRcdHRhZ05hbWUgPSB0YWcudGFnTmFtZTtcblx0XHR0YWdDdHhzID0gdGFnLnRhZ0N0eHM7XG5cdFx0dGVtcGxhdGUgPSB0YWcudGVtcGxhdGU7XG5cdH0gZWxzZSB7XG5cdFx0dGFnRGVmID0gcGFyZW50Vmlldy5nZXRSc2MoXCJ0YWdzXCIsIHRhZ05hbWUpIHx8IGVycm9yKFwiVW5rbm93biB0YWc6IHt7XCIgKyB0YWdOYW1lICsgXCJ9fSBcIik7XG5cdFx0dGVtcGxhdGUgPSB0YWdEZWYudGVtcGxhdGU7XG5cdH1cblxuXHRpZiAob25FcnJvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0ICs9IG9uRXJyb3I7XG5cdFx0dGFnQ3R4cyA9IG9uRXJyb3IgPSBbe3Byb3BzOiB7fSwgYXJnczogW119XTtcblx0fSBlbHNlIGlmIChib3VuZFRhZykge1xuXHRcdHRhZ0N0eHMgPSBib3VuZFRhZyhwYXJlbnRWaWV3LmRhdGEsIHBhcmVudFZpZXcsICRzdWIpO1xuXHR9XG5cblx0bCA9IHRhZ0N0eHMubGVuZ3RoO1xuXHRmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG5cdFx0dGFnQ3R4ID0gdGFnQ3R4c1tpXTtcblx0XHRpZiAoIWxpbmtDdHggfHwgIWxpbmtDdHgudGFnIHx8IGkgJiYgIWxpbmtDdHgudGFnLl8uaW5saW5lIHx8IHRhZy5fZXIpIHtcblx0XHRcdC8vIEluaXRpYWxpemUgdGFnQ3R4XG5cdFx0XHQvLyBGb3IgYmxvY2sgdGFncywgdGFnQ3R4LnRtcGwgaXMgYW4gaW50ZWdlciA+IDBcblx0XHRcdGlmIChjb250ZW50ID0gcGFyZW50VG1wbC50bXBscyAmJiB0YWdDdHgudG1wbCkge1xuXHRcdFx0XHRjb250ZW50ID0gdGFnQ3R4LmNvbnRlbnQgPSBwYXJlbnRUbXBsLnRtcGxzW2NvbnRlbnQgLSAxXTtcblx0XHRcdH1cblx0XHRcdHRhZ0N0eC5pbmRleCA9IGk7XG5cdFx0XHR0YWdDdHgudG1wbCA9IGNvbnRlbnQ7IC8vIFNldCB0aGUgdG1wbCBwcm9wZXJ0eSB0byB0aGUgY29udGVudCBvZiB0aGUgYmxvY2sgdGFnXG5cdFx0XHR0YWdDdHgucmVuZGVyID0gcmVuZGVyQ29udGVudDtcblx0XHRcdHRhZ0N0eC52aWV3ID0gcGFyZW50Vmlldztcblx0XHRcdHRhZ0N0eC5jdHggPSBleHRlbmRDdHgodGFnQ3R4LmN0eCwgY3R4KTsgLy8gQ2xvbmUgYW5kIGV4dGVuZCBwYXJlbnRWaWV3LmN0eFxuXHRcdH1cblx0XHRpZiAodG1wbCA9IHRhZ0N0eC5wcm9wcy50bXBsKSB7XG5cdFx0XHQvLyBJZiB0aGUgdG1wbCBwcm9wZXJ0eSBpcyBvdmVycmlkZGVuLCBzZXQgdGhlIHZhbHVlICh3aGVuIGluaXRpYWxpemluZywgb3IsIGluIGNhc2Ugb2YgYmluZGluZzogXnRtcGw9Li4uLCB3aGVuIHVwZGF0aW5nKVxuXHRcdFx0dGFnQ3R4LnRtcGwgPSBwYXJlbnRWaWV3LmdldFRtcGwodG1wbCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdC8vIFRoaXMgd2lsbCBvbmx5IGJlIGhpdCBmb3IgaW5pdGlhbCB0YWdDdHggKG5vdCBmb3Ige3tlbHNlfX0pIC0gaWYgdGhlIHRhZyBpbnN0YW5jZSBkb2VzIG5vdCBleGlzdCB5ZXRcblx0XHRcdC8vIEluc3RhbnRpYXRlIHRhZyBpZiBpdCBkb2VzIG5vdCB5ZXQgZXhpc3Rcblx0XHRcdC8vIElmIHRoZSB0YWcgaGFzIG5vdCBhbHJlYWR5IGJlZW4gaW5zdGFudGlhdGVkLCB3ZSB3aWxsIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZS5cblx0XHRcdC8vIH50YWcgd2lsbCBhY2Nlc3MgdGhlIHRhZywgZXZlbiB3aXRoaW4gdGhlIHJlbmRlcmluZyBvZiB0aGUgdGVtcGxhdGUgY29udGVudCBvZiB0aGlzIHRhZy5cblx0XHRcdC8vIEZyb20gY2hpbGQvZGVzY2VuZGFudCB0YWdzLCBjYW4gYWNjZXNzIHVzaW5nIH50YWcucGFyZW50LCBvciB+cGFyZW50VGFncy50YWdOYW1lXG5cdFx0XHR0YWcgPSBuZXcgdGFnRGVmLl9jdHIoKTtcblx0XHRcdGNhbGxJbml0ID0gISF0YWcuaW5pdDtcblxuXHRcdFx0dGFnLnBhcmVudCA9IHBhcmVudFRhZyA9IGN0eCAmJiBjdHgudGFnO1xuXHRcdFx0dGFnLnRhZ0N0eHMgPSB0YWdDdHhzO1xuXHRcdFx0dGFnRGF0YU1hcCA9IHRhZy5kYXRhTWFwO1xuXG5cdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHR0YWcuXy5pbmxpbmUgPSBmYWxzZTtcblx0XHRcdFx0bGlua0N0eC50YWcgPSB0YWc7XG5cdFx0XHRcdHRhZy5saW5rQ3R4ID0gbGlua0N0eDtcblx0XHRcdH1cblx0XHRcdGlmICh0YWcuXy5ibmQgPSBib3VuZFRhZyB8fCBsaW5rQ3R4LmZuKSB7XG5cdFx0XHRcdC8vIEJvdW5kIGlmIHtee3RhZy4uLn19IG9yIGRhdGEtbGluaz1cInt0YWcuLi59XCJcblx0XHRcdFx0dGFnLl8uYXJyVndzID0ge307XG5cdFx0XHR9IGVsc2UgaWYgKHRhZy5kYXRhQm91bmRPbmx5KSB7XG5cdFx0XHRcdGVycm9yKFwie157XCIgKyB0YWdOYW1lICsgXCJ9fSB0YWcgbXVzdCBiZSBkYXRhLWJvdW5kXCIpO1xuXHRcdFx0fVxuXHRcdFx0Ly9UT0RPIGJldHRlciBwZXJmIGZvciBjaGlsZFRhZ3MoKSAtIGtlZXAgY2hpbGQgdGFnLnRhZ3MgYXJyYXksIChhbmQgcmVtb3ZlIGNoaWxkLCB3aGVuIGRpc3Bvc2VkKVxuXHRcdFx0Ly8gdGFnLnRhZ3MgPSBbXTtcblx0XHR9XG5cdFx0dGFnQ3R4cyA9IHRhZy50YWdDdHhzO1xuXHRcdHRhZ0RhdGFNYXAgPSB0YWcuZGF0YU1hcDtcblxuXHRcdHRhZ0N0eC50YWcgPSB0YWc7XG5cdFx0aWYgKHRhZ0RhdGFNYXAgJiYgdGFnQ3R4cykge1xuXHRcdFx0dGFnQ3R4Lm1hcCA9IHRhZ0N0eHNbaV0ubWFwOyAvLyBDb3B5IG92ZXIgdGhlIGNvbXBpbGVkIG1hcCBpbnN0YW5jZSBmcm9tIHRoZSBwcmV2aW91cyB0YWdDdHhzIHRvIHRoZSByZWZyZXNoZWQgb25lc1xuXHRcdH1cblx0XHRpZiAoIXRhZy5mbG93KSB7XG5cdFx0XHR0YWdDdHhDdHggPSB0YWdDdHguY3R4ID0gdGFnQ3R4LmN0eCB8fCB7fTtcblxuXHRcdFx0Ly8gdGFncyBoYXNoOiB0YWcuY3R4LnRhZ3MsIG1lcmdlZCB3aXRoIHBhcmVudFZpZXcuY3R4LnRhZ3MsXG5cdFx0XHR0YWdzID0gdGFnLnBhcmVudHMgPSB0YWdDdHhDdHgucGFyZW50VGFncyA9IGN0eCAmJiBleHRlbmRDdHgodGFnQ3R4Q3R4LnBhcmVudFRhZ3MsIGN0eC5wYXJlbnRUYWdzKSB8fCB7fTtcblx0XHRcdGlmIChwYXJlbnRUYWcpIHtcblx0XHRcdFx0dGFnc1twYXJlbnRUYWcudGFnTmFtZV0gPSBwYXJlbnRUYWc7XG5cdFx0XHRcdC8vVE9ETyBiZXR0ZXIgcGVyZiBmb3IgY2hpbGRUYWdzOiBwYXJlbnRUYWcudGFncy5wdXNoKHRhZyk7XG5cdFx0XHR9XG5cdFx0XHR0YWdzW3RhZy50YWdOYW1lXSA9IHRhZ0N0eEN0eC50YWcgPSB0YWc7XG5cdFx0fVxuXHR9XG5cdGlmICghKHRhZy5fZXIgPSBvbkVycm9yKSkge1xuXHRcdHRhZ0hhbmRsZXJzRnJvbVByb3BzKHRhZywgdGFnQ3R4c1swXSk7XG5cdFx0dGFnLnJlbmRlcmluZyA9IHt9OyAvLyBQcm92aWRlIG9iamVjdCBmb3Igc3RhdGUgZHVyaW5nIHJlbmRlciBjYWxscyB0byB0YWcgYW5kIGVsc2VzLiAoVXNlZCBieSB7e2lmfX0gYW5kIHt7Zm9yfX0uLi4pXG5cdFx0Zm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuXHRcdFx0dGFnQ3R4ID0gdGFnLnRhZ0N0eCA9IHRhZ0N0eHNbaV07XG5cdFx0XHRwcm9wcyA9IHRhZ0N0eC5wcm9wcztcblx0XHRcdGFyZ3MgPSB0YWcuY3Z0QXJncygpO1xuXG5cdFx0XHRpZiAobWFwRGVmID0gcHJvcHMuZGF0YU1hcCB8fCB0YWdEYXRhTWFwKSB7XG5cdFx0XHRcdGlmIChhcmdzLmxlbmd0aCB8fCBwcm9wcy5kYXRhTWFwKSB7XG5cdFx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXA7XG5cdFx0XHRcdFx0aWYgKCF0aGlzTWFwIHx8IHRoaXNNYXAuc3JjICE9PSBhcmdzWzBdIHx8IGlzVXBkYXRlKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpc01hcCAmJiB0aGlzTWFwLnNyYykge1xuXHRcdFx0XHRcdFx0XHR0aGlzTWFwLnVubWFwKCk7IC8vIG9ubHkgY2FsbGVkIGlmIG9ic2VydmFibGUgbWFwIC0gbm90IHdoZW4gb25seSB1c2VkIGluIEpzUmVuZGVyLCBlLmcuIGJ5IHt7cHJvcHN9fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0dGhpc01hcCA9IHRhZ0N0eC5tYXAgPSBtYXBEZWYubWFwKGFyZ3NbMF0sIHByb3BzLCB1bmRlZmluZWQsICF0YWcuXy5ibmQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhcmdzID0gW3RoaXNNYXAudGd0XTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGFnLmN0eCA9IHRhZ0N0eC5jdHg7XG5cblx0XHRcdGlmICghaSkge1xuXHRcdFx0XHRpZiAoY2FsbEluaXQpIHtcblx0XHRcdFx0XHRpbml0aWFsVG1wbCA9IHRhZy50ZW1wbGF0ZTtcblx0XHRcdFx0XHR0YWcuaW5pdCh0YWdDdHgsIGxpbmtDdHgsIHRhZy5jdHgpO1xuXHRcdFx0XHRcdGNhbGxJbml0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdFx0Ly8gU2V0IGF0dHIgb24gbGlua0N0eCB0byBlbnN1cmUgb3V0cHV0dGluZyB0byB0aGUgY29ycmVjdCB0YXJnZXQgYXR0cmlidXRlLlxuXHRcdFx0XHRcdC8vIFNldHRpbmcgZWl0aGVyIGxpbmtDdHguYXR0ciBvciB0aGlzLmF0dHIgaW4gdGhlIGluaXQoKSBhbGxvd3MgcGVyLWluc3RhbmNlIGNob2ljZSBvZiB0YXJnZXQgYXR0cmliLlxuXHRcdFx0XHRcdGxpbmtDdHguYXR0ciA9IHRhZy5hdHRyID0gbGlua0N0eC5hdHRyIHx8IHRhZy5hdHRyO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF0dHIgPSB0YWcuYXR0cjtcblx0XHRcdFx0dGFnLl8ubm9Wd3MgPSBhdHRyICYmIGF0dHIgIT09IEhUTUw7XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW1SZXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGFnLnJlbmRlcikge1xuXHRcdFx0XHRpdGVtUmV0ID0gdGFnLnJlbmRlci5hcHBseSh0YWcsIGFyZ3MpO1xuXHRcdFx0XHRpZiAocGFyZW50Vmlldy5saW5rZWQgJiYgaXRlbVJldCAmJiB0YWcubGlua2VkRWxlbSAmJiAhcldyYXBwZWRJblZpZXdNYXJrZXIudGVzdChpdGVtUmV0KSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gYSB0YWcgcmVuZGVycyBjb250ZW50IGZyb20gdGhlIHJlbmRlciBtZXRob2QsIHdpdGggZGF0YSBsaW5raW5nLCBhbmQgaGFzIGEgbGlua2VkRWxlbSBiaW5kaW5nLCB0aGVuIHdlIG5lZWQgdG8gd3JhcCB3aXRoXG5cdFx0XHRcdFx0Ly8gdmlldyBtYXJrZXJzLCBpZiBhYnNlbnQsIHNvIHRoZSBjb250ZW50IGlzIGEgdmlldyBhc3NvY2lhdGVkIHdpdGggdGhlIHRhZywgd2hpY2ggd2lsbCBjb3JyZWN0bHkgZGlzcG9zZSBiaW5kaW5ncyBpZiBkZWxldGVkLlxuXHRcdFx0XHRcdGl0ZW1SZXQgPSByZW5kZXJXaXRoVmlld3MoJC50ZW1wbGF0ZXMoaXRlbVJldCksIGFyZ3NbMF0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBwYXJlbnRWaWV3LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGFnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFhcmdzLmxlbmd0aCkge1xuXHRcdFx0XHRhcmdzID0gW3BhcmVudFZpZXddOyAvLyBubyBhcmd1bWVudHMgLSAoZS5nLiB7e2Vsc2V9fSkgZ2V0IGRhdGEgY29udGV4dCBmcm9tIHZpZXcuXG5cdFx0XHR9XG5cdFx0XHRpZiAoaXRlbVJldCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnRlbnRDdHggPSBhcmdzWzBdOyAvLyBEZWZhdWx0IGRhdGEgY29udGV4dCBmb3Igd3JhcHBlZCBibG9jayBjb250ZW50IGlzIHRoZSBmaXJzdCBhcmd1bWVudC4gRGVmaW5lZCB0YWcuY29udGVudEN0eCBmdW5jdGlvbiB0byBvdmVycmlkZSB0aGlzLlxuXHRcdFx0XHRpZiAodGFnLmNvbnRlbnRDdHgpIHtcblx0XHRcdFx0XHRjb250ZW50Q3R4ID0gdGFnLmNvbnRlbnRDdHgoY29udGVudEN0eCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aXRlbVJldCA9IHRhZ0N0eC5yZW5kZXIoY29udGVudEN0eCwgdHJ1ZSkgfHwgKGlzVXBkYXRlID8gdW5kZWZpbmVkIDogXCJcIik7XG5cdFx0XHR9XG5cdFx0XHQvLyBObyByZXR1cm4gdmFsdWUgZnJvbSByZW5kZXIsIGFuZCBubyB0ZW1wbGF0ZS9jb250ZW50IHRhZ0N0eC5yZW5kZXIoLi4uKSwgc28gcmV0dXJuIHVuZGVmaW5lZFxuXHRcdFx0cmV0ID0gcmV0ID8gcmV0ICsgKGl0ZW1SZXQgfHwgXCJcIikgOiBpdGVtUmV0OyAvLyBJZiBubyByZW5kZXJlZCBjb250ZW50LCB0aGlzIHdpbGwgYmUgdW5kZWZpbmVkXG5cdFx0fVxuXHRcdHRhZy5yZW5kZXJpbmcgPSB1bmRlZmluZWQ7XG5cdH1cblx0dGFnLnRhZ0N0eCA9IHRhZ0N0eHNbMF07XG5cdHRhZy5jdHggPSB0YWcudGFnQ3R4LmN0eDtcblxuXHRpZiAodGFnLl8ubm9Wd3MpIHtcblx0XHRcdGlmICh0YWcuXy5pbmxpbmUpIHtcblx0XHRcdC8vIGlubGluZSB0YWcgd2l0aCBhdHRyIHNldCB0byBcInRleHRcIiB3aWxsIGluc2VydCBIVE1MLWVuY29kZWQgY29udGVudCAtIGFzIGlmIGl0IHdhcyBlbGVtZW50LWJhc2VkIGlubmVyVGV4dFxuXHRcdFx0cmV0ID0gYXR0ciA9PT0gXCJ0ZXh0XCJcblx0XHRcdFx0PyAkY29udmVydGVycy5odG1sKHJldClcblx0XHRcdFx0OiBcIlwiO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gYm91bmRUYWcgJiYgcGFyZW50Vmlldy5fLm9uUmVuZGVyXG5cdFx0Ly8gQ2FsbCBvblJlbmRlciAodXNlZCBieSBKc1ZpZXdzIGlmIHByZXNlbnQsIHRvIGFkZCBiaW5kaW5nIGFubm90YXRpb25zIGFyb3VuZCByZW5kZXJlZCBjb250ZW50KVxuXHRcdD8gcGFyZW50Vmlldy5fLm9uUmVuZGVyKHJldCwgcGFyZW50VmlldywgdGFnKVxuXHRcdDogcmV0O1xufVxuXG4vLz09PT09PT09PT09PT09PT09XG4vLyBWaWV3IGNvbnN0cnVjdG9yXG4vLz09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIFZpZXcoY29udGV4dCwgdHlwZSwgcGFyZW50VmlldywgZGF0YSwgdGVtcGxhdGUsIGtleSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKSB7XG5cdC8vIENvbnN0cnVjdG9yIGZvciB2aWV3IG9iamVjdCBpbiB2aWV3IGhpZXJhcmNoeS4gKEF1Z21lbnRlZCBieSBKc1ZpZXdzIGlmIEpzVmlld3MgaXMgbG9hZGVkKVxuXHR2YXIgdmlld3MsIHBhcmVudFZpZXdfLCB0YWcsIHNlbGZfLFxuXHRcdHNlbGYgPSB0aGlzLFxuXHRcdGlzQXJyYXkgPSB0eXBlID09PSBcImFycmF5XCI7XG5cblx0c2VsZi5jb250ZW50ID0gY29udGVudFRtcGw7XG5cdHNlbGYudmlld3MgPSBpc0FycmF5ID8gW10gOiB7fTtcblx0c2VsZi5wYXJlbnQgPSBwYXJlbnRWaWV3O1xuXHRzZWxmLnR5cGUgPSB0eXBlIHx8IFwidG9wXCI7XG5cdHNlbGYuZGF0YSA9IGRhdGE7XG5cdHNlbGYudG1wbCA9IHRlbXBsYXRlO1xuXHQvLyBJZiB0aGUgZGF0YSBpcyBhbiBhcnJheSwgdGhpcyBpcyBhbiAnYXJyYXkgdmlldycgd2l0aCBhIHZpZXdzIGFycmF5IGZvciBlYWNoIGNoaWxkICdpdGVtIHZpZXcnXG5cdC8vIElmIHRoZSBkYXRhIGlzIG5vdCBhbiBhcnJheSwgdGhpcyBpcyBhbiAnaXRlbSB2aWV3JyB3aXRoIGEgdmlld3MgJ2hhc2gnIG9iamVjdCBmb3IgYW55IGNoaWxkIG5lc3RlZCB2aWV3c1xuXHQvLyAuXy51c2VLZXkgaXMgbm9uIHplcm8gaWYgaXMgbm90IGFuICdhcnJheSB2aWV3JyAob3duaW5nIGEgZGF0YSBhcnJheSkuIFVzZSB0aGlzIGFzIG5leHQga2V5IGZvciBhZGRpbmcgdG8gY2hpbGQgdmlld3MgaGFzaFxuXHRzZWxmXyA9IHNlbGYuXyA9IHtcblx0XHRrZXk6IDAsXG5cdFx0dXNlS2V5OiBpc0FycmF5ID8gMCA6IDEsXG5cdFx0aWQ6IFwiXCIgKyB2aWV3SWQrKyxcblx0XHRvblJlbmRlcjogb25SZW5kZXIsXG5cdFx0Ym5kczoge31cblx0fTtcblx0c2VsZi5saW5rZWQgPSAhIW9uUmVuZGVyO1xuXHRpZiAocGFyZW50Vmlldykge1xuXHRcdHZpZXdzID0gcGFyZW50Vmlldy52aWV3cztcblx0XHRwYXJlbnRWaWV3XyA9IHBhcmVudFZpZXcuXztcblx0XHRpZiAocGFyZW50Vmlld18udXNlS2V5KSB7XG5cdFx0XHQvLyBQYXJlbnQgaXMgbm90IGFuICdhcnJheSB2aWV3Jy4gQWRkIHRoaXMgdmlldyB0byBpdHMgdmlld3Mgb2JqZWN0XG5cdFx0XHQvLyBzZWxmLl9rZXkgPSBpcyB0aGUga2V5IGluIHRoZSBwYXJlbnQgdmlldyBoYXNoXG5cdFx0XHR2aWV3c1tzZWxmXy5rZXkgPSBcIl9cIiArIHBhcmVudFZpZXdfLnVzZUtleSsrXSA9IHNlbGY7XG5cdFx0XHRzZWxmLmluZGV4ID0gaW5kZXhTdHI7XG5cdFx0XHRzZWxmLmdldEluZGV4ID0gZ2V0TmVzdGVkSW5kZXg7XG5cdFx0fSBlbHNlIGlmICh2aWV3cy5sZW5ndGggPT09IChzZWxmXy5rZXkgPSBzZWxmLmluZGV4ID0ga2V5KSkgeyAvLyBQYXJlbnQgaXMgYW4gJ2FycmF5IHZpZXcnLiBBZGQgdGhpcyB2aWV3IHRvIGl0cyB2aWV3cyBhcnJheVxuXHRcdFx0dmlld3MucHVzaChzZWxmKTsgLy8gQWRkaW5nIHRvIGVuZCBvZiB2aWV3cyBhcnJheS4gKFVzaW5nIHB1c2ggd2hlbiBwb3NzaWJsZSAtIGJldHRlciBwZXJmIHRoYW4gc3BsaWNlKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR2aWV3cy5zcGxpY2Uoa2V5LCAwLCBzZWxmKTsgLy8gSW5zZXJ0aW5nIGluIHZpZXdzIGFycmF5XG5cdFx0fVxuXHRcdC8vIElmIG5vIGNvbnRleHQgd2FzIHBhc3NlZCBpbiwgdXNlIHBhcmVudCBjb250ZXh0XG5cdFx0Ly8gSWYgY29udGV4dCB3YXMgcGFzc2VkIGluLCBpdCBzaG91bGQgaGF2ZSBiZWVuIG1lcmdlZCBhbHJlYWR5IHdpdGggcGFyZW50IGNvbnRleHRcblx0XHRzZWxmLmN0eCA9IGNvbnRleHQgfHwgcGFyZW50Vmlldy5jdHg7XG5cdH0gZWxzZSB7XG5cdFx0c2VsZi5jdHggPSBjb250ZXh0O1xuXHR9XG59XG5cblZpZXcucHJvdG90eXBlID0ge1xuXHRnZXQ6IGdldFZpZXcsXG5cdGdldEluZGV4OiBnZXRJbmRleCxcblx0Z2V0UnNjOiBnZXRSZXNvdXJjZSxcblx0Z2V0VG1wbDogZ2V0VGVtcGxhdGUsXG5cdGhscDogZ2V0SGVscGVyLFxuXHRfaXM6IFwidmlld1wiXG59O1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFJlZ2lzdHJhdGlvblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVDaGlsZFJlc291cmNlcyhwYXJlbnRUbXBsKSB7XG5cdHZhciBzdG9yZU5hbWUsIHN0b3JlTmFtZXMsIHJlc291cmNlcztcblx0Zm9yIChzdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0c3RvcmVOYW1lcyA9IHN0b3JlTmFtZSArIFwic1wiO1xuXHRcdGlmIChwYXJlbnRUbXBsW3N0b3JlTmFtZXNdKSB7XG5cdFx0XHRyZXNvdXJjZXMgPSBwYXJlbnRUbXBsW3N0b3JlTmFtZXNdOyAgICAvLyBSZXNvdXJjZXMgbm90IHlldCBjb21waWxlZFxuXHRcdFx0cGFyZW50VG1wbFtzdG9yZU5hbWVzXSA9IHt9OyAgICAgICAgICAgICAgIC8vIFJlbW92ZSB1bmNvbXBpbGVkIHJlc291cmNlc1xuXHRcdFx0JHZpZXdzW3N0b3JlTmFtZXNdKHJlc291cmNlcywgcGFyZW50VG1wbCk7IC8vIEFkZCBiYWNrIGluIHRoZSBjb21waWxlZCByZXNvdXJjZXNcblx0XHR9XG5cdH1cbn1cblxuLy89PT09PT09PT09PT09PT1cbi8vIGNvbXBpbGVUYWdcbi8vPT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVUYWcobmFtZSwgdGFnRGVmLCBwYXJlbnRUbXBsKSB7XG5cdHZhciB0bXBsLCBiYXNlVGFnLCBwcm9wLFxuXHRcdGNvbXBpbGVkRGVmID0gbmV3ICRzdWIuX3RnKCk7XG5cblx0ZnVuY3Rpb24gVGFnKCkge1xuXHRcdHZhciB0YWcgPSB0aGlzO1xuXHRcdHRhZy5fID0ge1xuXHRcdFx0aW5saW5lOiB0cnVlLFxuXHRcdFx0dW5saW5rZWQ6IHRydWVcblx0XHR9O1xuXG5cdFx0dGFnLnRhZ05hbWUgPSBuYW1lO1xuXHR9XG5cblx0aWYgKCRpc0Z1bmN0aW9uKHRhZ0RlZikpIHtcblx0XHQvLyBTaW1wbGUgdGFnIGRlY2xhcmVkIGFzIGZ1bmN0aW9uLiBObyBwcmVzZW50ZXIgaW5zdGFudGF0aW9uLlxuXHRcdHRhZ0RlZiA9IHtcblx0XHRcdGRlcGVuZHM6IHRhZ0RlZi5kZXBlbmRzLFxuXHRcdFx0cmVuZGVyOiB0YWdEZWZcblx0XHR9O1xuXHR9IGVsc2UgaWYgKFwiXCIgKyB0YWdEZWYgPT09IHRhZ0RlZikge1xuXHRcdHRhZ0RlZiA9IHt0ZW1wbGF0ZTogdGFnRGVmfTtcblx0fVxuXHRpZiAoYmFzZVRhZyA9IHRhZ0RlZi5iYXNlVGFnKSB7XG5cdFx0dGFnRGVmLmZsb3cgPSAhIXRhZ0RlZi5mbG93OyAvLyBTZXQgZmxvdyBwcm9wZXJ0eSwgc28gZGVmYXVsdHMgdG8gZmFsc2UgZXZlbiBpZiBiYXNlVGFnIGhhcyBmbG93PXRydWVcblx0XHR0YWdEZWYuYmFzZVRhZyA9IGJhc2VUYWcgPSBcIlwiICsgYmFzZVRhZyA9PT0gYmFzZVRhZ1xuXHRcdFx0PyAocGFyZW50VG1wbCAmJiBwYXJlbnRUbXBsLnRhZ3NbYmFzZVRhZ10gfHwgJHRhZ3NbYmFzZVRhZ10pXG5cdFx0XHQ6IGJhc2VUYWc7XG5cblx0XHRjb21waWxlZERlZiA9ICRleHRlbmQoY29tcGlsZWREZWYsIGJhc2VUYWcpO1xuXG5cdFx0Zm9yIChwcm9wIGluIHRhZ0RlZikge1xuXHRcdFx0Y29tcGlsZWREZWZbcHJvcF0gPSBnZXRNZXRob2QoYmFzZVRhZ1twcm9wXSwgdGFnRGVmW3Byb3BdKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Y29tcGlsZWREZWYgPSAkZXh0ZW5kKGNvbXBpbGVkRGVmLCB0YWdEZWYpO1xuXHR9XG5cblx0Ly8gVGFnIGRlY2xhcmVkIGFzIG9iamVjdCwgdXNlZCBhcyB0aGUgcHJvdG90eXBlIGZvciB0YWcgaW5zdGFudGlhdGlvbiAoY29udHJvbC9wcmVzZW50ZXIpXG5cdGlmICgodG1wbCA9IGNvbXBpbGVkRGVmLnRlbXBsYXRlKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Y29tcGlsZWREZWYudGVtcGxhdGUgPSBcIlwiICsgdG1wbCA9PT0gdG1wbCA/ICgkdGVtcGxhdGVzW3RtcGxdIHx8ICR0ZW1wbGF0ZXModG1wbCkpIDogdG1wbDtcblx0fVxuXHRpZiAoY29tcGlsZWREZWYuaW5pdCAhPT0gZmFsc2UpIHtcblx0XHQvLyBTZXQgaW5pdDogZmFsc2Ugb24gdGFnRGVmIGlmIHlvdSB3YW50IHRvIHByb3ZpZGUganVzdCBhIHJlbmRlciBtZXRob2QsIG9yIHJlbmRlciBhbmQgdGVtcGxhdGUsIGJ1dCBubyBjb25zdHJ1Y3RvciBvciBwcm90b3R5cGUuXG5cdFx0Ly8gc28gZXF1aXZhbGVudCB0byBzZXR0aW5nIHRhZyB0byByZW5kZXIgZnVuY3Rpb24sIGV4Y2VwdCB5b3UgY2FuIGFsc28gcHJvdmlkZSBhIHRlbXBsYXRlLlxuXHRcdChUYWcucHJvdG90eXBlID0gY29tcGlsZWREZWYpLmNvbnN0cnVjdG9yID0gY29tcGlsZWREZWYuX2N0ciA9IFRhZztcblx0fVxuXG5cdGlmIChwYXJlbnRUbXBsKSB7XG5cdFx0Y29tcGlsZWREZWYuX3BhcmVudFRtcGwgPSBwYXJlbnRUbXBsO1xuXHR9XG5cdHJldHVybiBjb21waWxlZERlZjtcbn1cblxuZnVuY3Rpb24gYmFzZUFwcGx5KGFyZ3MpIHtcblx0Ly8gSW4gZGVyaXZlZCBtZXRob2QgKG9yIGhhbmRsZXIgZGVjbGFyZWQgZGVjbGFyYXRpdmVseSBhcyBpbiB7ezpmb28gb25DaGFuZ2U9fmZvb0NoYW5nZWR9fSBjYW4gY2FsbCBiYXNlIG1ldGhvZCxcblx0Ly8gdXNpbmcgdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSAoRXF1aXZhbGVudCB0byB0aGlzLl9zdXBlckFwcGx5KGFyZ3VtZW50cykgaW4galF1ZXJ5IFVJKVxuXHRyZXR1cm4gdGhpcy5iYXNlLmFwcGx5KHRoaXMsIGFyZ3MpO1xufVxuXG4vLz09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVRtcGxcbi8vPT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbXBpbGVUbXBsKG5hbWUsIHRtcGwsIHBhcmVudFRtcGwsIG9wdGlvbnMpIHtcblx0Ly8gdG1wbCBpcyBlaXRoZXIgYSB0ZW1wbGF0ZSBvYmplY3QsIGEgc2VsZWN0b3IgZm9yIGEgdGVtcGxhdGUgc2NyaXB0IGJsb2NrLCB0aGUgbmFtZSBvZiBhIGNvbXBpbGVkIHRlbXBsYXRlLCBvciBhIHRlbXBsYXRlIG9iamVjdFxuXG5cdC8vPT09PSBuZXN0ZWQgZnVuY3Rpb25zID09PT1cblx0ZnVuY3Rpb24gbG9va3VwVGVtcGxhdGUodmFsdWUpIHtcblx0XHQvLyBJZiB2YWx1ZSBpcyBvZiB0eXBlIHN0cmluZyAtIHRyZWF0IGFzIHNlbGVjdG9yLCBvciBuYW1lIG9mIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0Ly8gUmV0dXJuIHRoZSB0ZW1wbGF0ZSBvYmplY3QsIGlmIGFscmVhZHkgY29tcGlsZWQsIG9yIHRoZSBtYXJrdXAgc3RyaW5nXG5cdFx0dmFyIGN1cnJlbnROYW1lLCB0bXBsO1xuXHRcdGlmICgoXCJcIiArIHZhbHVlID09PSB2YWx1ZSkgfHwgdmFsdWUubm9kZVR5cGUgPiAwICYmIChlbGVtID0gdmFsdWUpKSB7XG5cdFx0XHRpZiAoIWVsZW0pIHtcblx0XHRcdFx0aWYgKC9eXFwuXFwvW15cXFxcOio/XCI8Pl0qJC8udGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyB0bXBsPVwiLi9zb21lL2ZpbGUuaHRtbFwiXG5cdFx0XHRcdFx0Ly8gSWYgdGhlIHRlbXBsYXRlIGlzIG5vdCBuYW1lZCwgdXNlIFwiLi9zb21lL2ZpbGUuaHRtbFwiIGFzIG5hbWUuXG5cdFx0XHRcdFx0aWYgKHRtcGwgPSAkdGVtcGxhdGVzW25hbWUgPSBuYW1lIHx8IHZhbHVlXSkge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSB0bXBsO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyBCUk9XU0VSLVNQRUNJRklDIENPREUgKG5vdCBvbiBOb2RlLmpzKTpcblx0XHRcdFx0XHRcdC8vIExvb2sgZm9yIHNlcnZlci1nZW5lcmF0ZWQgc2NyaXB0IGJsb2NrIHdpdGggaWQgXCIuL3NvbWUvZmlsZS5odG1sXCJcblx0XHRcdFx0XHRcdGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCQuZm4gJiYgISRzdWIuclRtcGwudGVzdCh2YWx1ZSkpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0ZWxlbSA9ICQoZG9jdW1lbnQpLmZpbmQodmFsdWUpWzBdOyAvLyBpZiBqUXVlcnkgaXMgbG9hZGVkLCB0ZXN0IGZvciBzZWxlY3RvciByZXR1cm5pbmcgZWxlbWVudHMsIGFuZCBnZXQgZmlyc3QgZWxlbWVudFxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHt9XG5cdFx0XHRcdH0vLyBFTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHR9IC8vQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0XHRpZiAoZWxlbSkge1xuXHRcdFx0XHQvLyBHZW5lcmFsbHkgdGhpcyBpcyBhIHNjcmlwdCBlbGVtZW50LlxuXHRcdFx0XHQvLyBIb3dldmVyIHdlIGFsbG93IGl0IHRvIGJlIGFueSBlbGVtZW50LCBzbyB5b3UgY2FuIGZvciBleGFtcGxlIHRha2UgdGhlIGNvbnRlbnQgb2YgYSBkaXYsXG5cdFx0XHRcdC8vIHVzZSBpdCBhcyBhIHRlbXBsYXRlLCBhbmQgcmVwbGFjZSBpdCBieSB0aGUgc2FtZSBjb250ZW50IHJlbmRlcmVkIGFnYWluc3QgZGF0YS5cblx0XHRcdFx0Ly8gZS5nLiBmb3IgbGlua2luZyB0aGUgY29udGVudCBvZiBhIGRpdiB0byBhIGNvbnRhaW5lciwgYW5kIHVzaW5nIHRoZSBpbml0aWFsIGNvbnRlbnQgYXMgdGVtcGxhdGU6XG5cdFx0XHRcdC8vICQubGluayhcIiNjb250ZW50XCIsIG1vZGVsLCB7dG1wbDogXCIjY29udGVudFwifSk7XG5cdFx0XHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHRcdFx0Ly8gV2Ugd2lsbCBjb21waWxlIGEgbmV3IHRlbXBsYXRlIHVzaW5nIHRoZSBtYXJrdXAgaW4gdGhlIHNjcmlwdCBlbGVtZW50XG5cdFx0XHRcdFx0dmFsdWUgPSBlbGVtLmlubmVySFRNTDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBXZSB3aWxsIGNhY2hlIGEgc2luZ2xlIGNvcHkgb2YgdGhlIGNvbXBpbGVkIHRlbXBsYXRlLCBhbmQgYXNzb2NpYXRlIGl0IHdpdGggdGhlIG5hbWVcblx0XHRcdFx0XHQvLyAocmVuYW1pbmcgZnJvbSBhIHByZXZpb3VzIG5hbWUgaWYgdGhlcmUgd2FzIG9uZSkuXG5cdFx0XHRcdFx0Y3VycmVudE5hbWUgPSBlbGVtLmdldEF0dHJpYnV0ZSh0bXBsQXR0cik7XG5cdFx0XHRcdFx0aWYgKGN1cnJlbnROYW1lKSB7XG5cdFx0XHRcdFx0XHRpZiAoY3VycmVudE5hbWUgIT09IGpzdlRtcGwpIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkdGVtcGxhdGVzW2N1cnJlbnROYW1lXTtcblx0XHRcdFx0XHRcdFx0ZGVsZXRlICR0ZW1wbGF0ZXNbY3VycmVudE5hbWVdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICgkLmZuKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlID0gJC5kYXRhKGVsZW0pW2pzdlRtcGxdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRuYW1lID0gbmFtZSB8fCAoJC5mbiA/IGpzdlRtcGwgOiB2YWx1ZSk7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGNvbXBpbGVUbXBsKG5hbWUsIGVsZW0uaW5uZXJIVE1MLCBwYXJlbnRUbXBsLCBvcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dmFsdWUudG1wbE5hbWUgPSBuYW1lID0gbmFtZSB8fCBjdXJyZW50TmFtZTtcblx0XHRcdFx0XHRpZiAobmFtZSAhPT0ganN2VG1wbCkge1xuXHRcdFx0XHRcdFx0JHRlbXBsYXRlc1tuYW1lXSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbGVtLnNldEF0dHJpYnV0ZSh0bXBsQXR0ciwgbmFtZSk7XG5cdFx0XHRcdFx0aWYgKCQuZm4pIHtcblx0XHRcdFx0XHRcdCQuZGF0YShlbGVtLCBqc3ZUbXBsLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IC8vIEVORCBCUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdGVsZW0gPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIGlmICghdmFsdWUuZm4pIHtcblx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0Ly8gSWYgdmFsdWUgaXMgbm90IGEgc3RyaW5nLiBIVE1MIGVsZW1lbnQsIG9yIGNvbXBpbGVkIHRlbXBsYXRlLCByZXR1cm4gdW5kZWZpbmVkXG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdHZhciBlbGVtLCBjb21waWxlZFRtcGwsXG5cdFx0dG1wbE9yTWFya3VwID0gdG1wbCA9IHRtcGwgfHwgXCJcIjtcblxuXHQvLz09PT0gQ29tcGlsZSB0aGUgdGVtcGxhdGUgPT09PVxuXHRpZiAob3B0aW9ucyA9PT0gMCkge1xuXHRcdG9wdGlvbnMgPSB1bmRlZmluZWQ7XG5cdFx0dG1wbE9yTWFya3VwID0gbG9va3VwVGVtcGxhdGUodG1wbE9yTWFya3VwKTsgLy8gVG9wLWxldmVsIGNvbXBpbGUgc28gZG8gYSB0ZW1wbGF0ZSBsb29rdXBcblx0fVxuXG5cdC8vIElmIG9wdGlvbnMsIHRoZW4gdGhpcyB3YXMgYWxyZWFkeSBjb21waWxlZCBmcm9tIGEgKHNjcmlwdCkgZWxlbWVudCB0ZW1wbGF0ZSBkZWNsYXJhdGlvbi5cblx0Ly8gSWYgbm90LCB0aGVuIGlmIHRtcGwgaXMgYSB0ZW1wbGF0ZSBvYmplY3QsIHVzZSBpdCBmb3Igb3B0aW9uc1xuXHRvcHRpb25zID0gb3B0aW9ucyB8fCAodG1wbC5tYXJrdXAgPyB0bXBsIDoge30pO1xuXHRvcHRpb25zLnRtcGxOYW1lID0gbmFtZTtcblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRvcHRpb25zLl9wYXJlbnRUbXBsID0gcGFyZW50VG1wbDtcblx0fVxuXHQvLyBJZiB0bXBsIGlzIG5vdCBhIG1hcmt1cCBzdHJpbmcgb3IgYSBzZWxlY3RvciBzdHJpbmcsIHRoZW4gaXQgbXVzdCBiZSBhIHRlbXBsYXRlIG9iamVjdFxuXHQvLyBJbiB0aGF0IGNhc2UsIGdldCBpdCBmcm9tIHRoZSBtYXJrdXAgcHJvcGVydHkgb2YgdGhlIG9iamVjdFxuXHRpZiAoIXRtcGxPck1hcmt1cCAmJiB0bXBsLm1hcmt1cCAmJiAodG1wbE9yTWFya3VwID0gbG9va3VwVGVtcGxhdGUodG1wbC5tYXJrdXApKSkge1xuXHRcdGlmICh0bXBsT3JNYXJrdXAuZm4pIHtcblx0XHRcdC8vIElmIHRoZSBzdHJpbmcgcmVmZXJlbmNlcyBhIGNvbXBpbGVkIHRlbXBsYXRlIG9iamVjdCwgbmVlZCB0byByZWNvbXBpbGUgdG8gbWVyZ2UgYW55IG1vZGlmaWVkIG9wdGlvbnNcblx0XHRcdHRtcGxPck1hcmt1cCA9IHRtcGxPck1hcmt1cC5tYXJrdXA7XG5cdFx0fVxuXHR9XG5cdGlmICh0bXBsT3JNYXJrdXAgIT09IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0bXBsT3JNYXJrdXAuZm4gfHwgdG1wbC5mbikge1xuXHRcdFx0Ly8gdG1wbCBpcyBhbHJlYWR5IGNvbXBpbGVkLCBzbyB1c2UgaXRcblx0XHRcdGlmICh0bXBsT3JNYXJrdXAuZm4pIHtcblx0XHRcdFx0Y29tcGlsZWRUbXBsID0gdG1wbE9yTWFya3VwO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyB0bXBsT3JNYXJrdXAgaXMgYSBtYXJrdXAgc3RyaW5nLCBub3QgYSBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0Ly8gQ3JlYXRlIHRlbXBsYXRlIG9iamVjdFxuXHRcdFx0dG1wbCA9IHRtcGxPYmplY3QodG1wbE9yTWFya3VwLCBvcHRpb25zKTtcblx0XHRcdC8vIENvbXBpbGUgdG8gQVNUIGFuZCB0aGVuIHRvIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHR0bXBsRm4odG1wbE9yTWFya3VwLnJlcGxhY2UockVzY2FwZVF1b3RlcywgXCJcXFxcJCZcIiksIHRtcGwpO1xuXHRcdH1cblx0XHRpZiAoIWNvbXBpbGVkVG1wbCkge1xuXHRcdFx0Y29tcGlsZWRUbXBsID0gJGV4dGVuZChmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbXBpbGVkVG1wbC5yZW5kZXIuYXBwbHkoY29tcGlsZWRUbXBsLCBhcmd1bWVudHMpO1xuXHRcdFx0fSwgdG1wbCk7XG5cblx0XHRcdGNvbXBpbGVDaGlsZFJlc291cmNlcyhjb21waWxlZFRtcGwpO1xuXHRcdH1cblx0XHRpZiAobmFtZSAmJiAhcGFyZW50VG1wbCAmJiBuYW1lICE9PSBqc3ZUbXBsKSB7XG5cdFx0XHQkcmVuZGVyW25hbWVdID0gY29tcGlsZWRUbXBsO1xuXHRcdH1cblx0XHRyZXR1cm4gY29tcGlsZWRUbXBsO1xuXHR9XG59XG5cbi8vPT09PSAvZW5kIG9mIGZ1bmN0aW9uIGNvbXBpbGVUbXBsID09PT1cblxuLy89PT09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVZpZXdNb2RlbFxuLy89PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpIHtcblx0cmV0dXJuICQuaXNGdW5jdGlvbihkZWZhdWx0VmFsKVxuXHRcdD8gZGVmYXVsdFZhbC5jYWxsKGRhdGEpXG5cdFx0OiBkZWZhdWx0VmFsO1xufVxuXG5mdW5jdGlvbiB1bm1hcEFycmF5KG1vZGVsQXJyKSB7XG5cdFx0dmFyIGksIGFyciA9IFtdLFxuXHRcdFx0bCA9IG1vZGVsQXJyLmxlbmd0aDtcblx0XHRmb3IgKGk9MDsgaTxsOyBpKyspIHtcblx0XHRcdGFyci5wdXNoKG1vZGVsQXJyW2ldLnVubWFwKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gYXJyO1xufVxuXG5mdW5jdGlvbiBjb21waWxlVmlld01vZGVsKG5hbWUsIHR5cGUpIHtcblx0dmFyIGksIGNvbnN0cnVjdG9yLFxuXHRcdHZpZXdNb2RlbHMgPSB0aGlzLFxuXHRcdGdldHRlcnMgPSB0eXBlLmdldHRlcnMsXG5cdFx0ZXh0ZW5kID0gdHlwZS5leHRlbmQsXG5cdFx0aWQgPSB0eXBlLmlkLFxuXHRcdHByb3RvID0gJC5leHRlbmQoe1xuXHRcdFx0X2lzOiBuYW1lIHx8IFwidW5uYW1lZFwiLFxuXHRcdFx0dW5tYXA6IHVubWFwLFxuXHRcdFx0bWVyZ2U6IG1lcmdlXG5cdFx0fSwgZXh0ZW5kKSxcblx0XHRhcmdzID0gXCJcIixcblx0XHRib2R5ID0gXCJcIixcblx0XHRsID0gZ2V0dGVycyA/IGdldHRlcnMubGVuZ3RoIDogMCxcblx0XHQkb2JzZXJ2YWJsZSA9ICQub2JzZXJ2YWJsZSxcblx0XHRnZXR0ZXJOYW1lcyA9IHt9O1xuXG5cdGZ1bmN0aW9uIEdldE5ldyhhcmdzKSB7XG5cdFx0Y29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJncyk7XG5cdH1cblxuXHRmdW5jdGlvbiB2bSgpIHtcblx0XHRyZXR1cm4gbmV3IEdldE5ldyhhcmd1bWVudHMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXRlcmF0ZShkYXRhLCBhY3Rpb24pIHtcblx0XHR2YXIgaiwgZ2V0dGVyVHlwZSwgZGVmYXVsdFZhbCwgcHJvcCwgb2IsXG5cdFx0XHRtID0gZ2V0dGVycy5sZW5ndGg7XG5cdFx0Zm9yIChqPTA7IGo8bTsgaisrKSB7XG5cdFx0XHRwcm9wID0gZ2V0dGVyc1tqXTtcblx0XHRcdGdldHRlclR5cGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocHJvcCArIFwiXCIgIT09IHByb3ApIHtcblx0XHRcdFx0Z2V0dGVyVHlwZSA9IHByb3A7XG5cdFx0XHRcdHByb3AgPSBnZXR0ZXJUeXBlLmdldHRlcjtcblx0XHRcdH1cblx0XHRcdGlmICgob2IgPSBkYXRhW3Byb3BdKSA9PT0gdW5kZWZpbmVkICYmIGdldHRlclR5cGUgJiYgKGRlZmF1bHRWYWwgPSBnZXR0ZXJUeXBlLmRlZmF1bHRWYWwpICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0b2IgPSBnZXREZWZhdWx0VmFsKGRlZmF1bHRWYWwsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0YWN0aW9uKG9iLCBnZXR0ZXJUeXBlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXSwgcHJvcCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gbWFwKGRhdGEpIHtcblx0XHRkYXRhID0gZGF0YSArIFwiXCIgPT09IGRhdGFcblx0XHRcdD8gSlNPTi5wYXJzZShkYXRhKSAvLyBBY2NlcHQgSlNPTiBzdHJpbmdcblx0XHRcdDogZGF0YTsgICAgICAgICAgICAvLyBvciBvYmplY3QvYXJyYXlcblx0XHR2YXIgaSwgaiwgIGwsIG0sIHByb3AsXG5cdFx0XHRvYiA9IGRhdGEsXG5cdFx0XHRhcnIgPSBbXTtcblxuXHRcdGlmICgkaXNBcnJheShkYXRhKSkge1xuXHRcdFx0ZGF0YSA9IGRhdGEgfHwgW107XG5cdFx0XHRsID0gZGF0YS5sZW5ndGg7XG5cdFx0XHRmb3IgKGk9MDsgaTxsOyBpKyspIHtcblx0XHRcdFx0YXJyLnB1c2godGhpcy5tYXAoZGF0YVtpXSkpO1xuXHRcdFx0fVxuXHRcdFx0YXJyLl9pcyA9IG5hbWU7XG5cdFx0XHRhcnIudW5tYXAgPSB1bm1hcDtcblx0XHRcdGFyci5tZXJnZSA9IG1lcmdlO1xuXHRcdFx0cmV0dXJuIGFycjtcblx0XHR9XG5cblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0aXRlcmF0ZShkYXRhLCBmdW5jdGlvbihvYiwgdmlld01vZGVsKSB7XG5cdFx0XHRcdGlmICh2aWV3TW9kZWwpIHsgLy8gSXRlcmF0ZSB0byBidWlsZCBnZXR0ZXJzIGFyZyBhcnJheSAodmFsdWUsIG9yIG1hcHBlZCB2YWx1ZSlcblx0XHRcdFx0XHRvYiA9IHZpZXdNb2RlbC5tYXAob2IpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFyci5wdXNoKG9iKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRvYiA9IHRoaXMuYXBwbHkodGhpcywgYXJyKTsgLy8gSW5zYW50aWF0ZSB0aGlzIFZpZXcgTW9kZWwsIHBhc3NpbmcgZ2V0dGVycyBhcmdzIGFycmF5IHRvIGNvbnN0cnVjdG9yXG5cdFx0XHRmb3IgKHByb3AgaW4gZGF0YSkgeyAvLyBDb3B5IG92ZXIgYW55IG90aGVyIHByb3BlcnRpZXMuIHRoYXQgYXJlIG5vdCBnZXQvc2V0IHByb3BlcnRpZXNcblx0XHRcdFx0aWYgKHByb3AgIT09ICRleHBhbmRvICAmJiAhZ2V0dGVyTmFtZXNbcHJvcF0pIHtcblx0XHRcdFx0XHRvYltwcm9wXSA9IGRhdGFbcHJvcF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG9iO1xuXHR9XG5cblx0ZnVuY3Rpb24gbWVyZ2UoZGF0YSkge1xuXHRcdGRhdGEgPSBkYXRhICsgXCJcIiA9PT0gZGF0YVxuXHRcdFx0PyBKU09OLnBhcnNlKGRhdGEpIC8vIEFjY2VwdCBKU09OIHN0cmluZ1xuXHRcdFx0OiBkYXRhOyAgICAgICAgICAgIC8vIG9yIG9iamVjdC9hcnJheVxuXHRcdHZhciBpLCBqLCBsLCBtLCBwcm9wLCBtb2QsIGZvdW5kLCBhc3NpZ25lZCwgb2IsIG5ld01vZEFycixcblx0XHRcdG1vZGVsID0gdGhpcztcblxuXHRcdGlmICgkaXNBcnJheShtb2RlbCkpIHtcblx0XHRcdGFzc2lnbmVkID0ge307XG5cdFx0XHRuZXdNb2RBcnIgPSBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdG0gPSBtb2RlbC5sZW5ndGg7XG5cdFx0XHRmb3IgKGk9MDsgaTxsOyBpKyspIHtcblx0XHRcdFx0b2IgPSBkYXRhW2ldO1xuXHRcdFx0XHRmb3VuZCA9IGZhbHNlO1xuXHRcdFx0XHRmb3IgKGo9MDsgajxtICYmICFmb3VuZDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKGFzc2lnbmVkW2pdKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kID0gbW9kZWxbal07XG5cblx0XHRcdFx0XHRpZiAoaWQpIHtcblx0XHRcdFx0XHRcdGFzc2lnbmVkW2pdID0gZm91bmQgPSBpZCArIFwiXCIgPT09IGlkXG5cdFx0XHRcdFx0XHQ/IChvYltpZF0gJiYgKGdldHRlck5hbWVzW2lkXSA/IG1vZFtpZF0oKSA6IG1vZFtpZF0pID09PSBvYltpZF0pXG5cdFx0XHRcdFx0XHQ6IGlkKG1vZCwgb2IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0XHRtb2QubWVyZ2Uob2IpO1xuXHRcdFx0XHRcdG5ld01vZEFyci5wdXNoKG1vZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3TW9kQXJyLnB1c2godm0ubWFwKG9iKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHQkb2JzZXJ2YWJsZShtb2RlbCkucmVmcmVzaChuZXdNb2RBcnIsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kZWwuc3BsaWNlLmFwcGx5KG1vZGVsLCBbMCwgbW9kZWwubGVuZ3RoXS5jb25jYXQobmV3TW9kQXJyKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGl0ZXJhdGUoZGF0YSwgZnVuY3Rpb24ob2IsIHZpZXdNb2RlbCwgZ2V0dGVyKSB7XG5cdFx0XHRpZiAodmlld01vZGVsKSB7XG5cdFx0XHRcdG1vZGVsW2dldHRlcl0oKS5tZXJnZShvYik7IC8vIFVwZGF0ZSB0eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kZWxbZ2V0dGVyXShvYik7IC8vIFVwZGF0ZSBub24tdHlwZWQgcHJvcGVydHlcblx0XHRcdH1cblx0XHR9KTtcblx0XHRmb3IgKHByb3AgaW4gZGF0YSkge1xuXHRcdFx0aWYgKHByb3AgIT09ICRleHBhbmRvICYmICFnZXR0ZXJOYW1lc1twcm9wXSkge1xuXHRcdFx0XHRtb2RlbFtwcm9wXSA9IGRhdGFbcHJvcF07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gdW5tYXAoKSB7XG5cdFx0dmFyIG9iLCBwcm9wLCBpLCBsLCBnZXR0ZXJUeXBlLCBhcnIsIHZhbHVlLFxuXHRcdFx0bW9kZWwgPSB0aGlzO1xuXG5cdFx0aWYgKCRpc0FycmF5KG1vZGVsKSkge1xuXHRcdFx0cmV0dXJuIHVubWFwQXJyYXkobW9kZWwpO1xuXHRcdH1cblx0XHRvYiA9IHt9O1xuXHRcdGwgPSBnZXR0ZXJzLmxlbmd0aDtcblx0XHRmb3IgKGk9MDsgaTxsOyBpKyspIHtcblx0XHRcdHByb3AgPSBnZXR0ZXJzW2ldO1xuXHRcdFx0Z2V0dGVyVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcm9wICsgXCJcIiAhPT0gcHJvcCkge1xuXHRcdFx0XHRnZXR0ZXJUeXBlID0gcHJvcDtcblx0XHRcdFx0cHJvcCA9IGdldHRlclR5cGUuZ2V0dGVyO1xuXHRcdFx0fVxuXHRcdFx0dmFsdWUgPSBtb2RlbFtwcm9wXSgpO1xuXHRcdFx0b2JbcHJvcF0gPSBnZXR0ZXJUeXBlICYmIHZhbHVlICYmIHZpZXdNb2RlbHNbZ2V0dGVyVHlwZS50eXBlXVxuXHRcdFx0XHQ/ICRpc0FycmF5KHZhbHVlKVxuXHRcdFx0XHRcdD8gdW5tYXBBcnJheSh2YWx1ZSlcblx0XHRcdFx0XHQ6IHZhbHVlLnVubWFwKClcblx0XHRcdFx0OiB2YWx1ZTtcblx0XHR9XG5cdFx0Zm9yIChwcm9wIGluIG1vZGVsKSB7XG5cdFx0XHRpZiAocHJvcCAhPT0gXCJfaXNcIiAmJiAhZ2V0dGVyTmFtZXNbcHJvcF0gJiYgcHJvcCAhPT0gJGV4cGFuZG8gICYmIChwcm9wLmNoYXJBdCgwKSAhPT0gXCJfXCIgfHwgIWdldHRlck5hbWVzW3Byb3Auc2xpY2UoMSldKSAmJiAhJC5pc0Z1bmN0aW9uKG1vZGVsW3Byb3BdKSkge1xuXHRcdFx0XHRvYltwcm9wXSA9IG1vZGVsW3Byb3BdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRHZXROZXcucHJvdG90eXBlID0gcHJvdG87XG5cblx0Zm9yIChpPTA7IGk8bDsgaSsrKSB7XG5cdFx0KGZ1bmN0aW9uKGdldHRlcikge1xuXHRcdFx0Z2V0dGVyID0gZ2V0dGVyLmdldHRlciB8fCBnZXR0ZXI7XG5cdFx0XHRnZXR0ZXJOYW1lc1tnZXR0ZXJdID0gaSsxO1xuXHRcdFx0dmFyIHByaXZGaWVsZCA9IFwiX1wiICsgZ2V0dGVyO1xuXG5cdFx0XHRhcmdzICs9IChhcmdzID8gXCIsXCIgOiBcIlwiKSArIGdldHRlcjtcblx0XHRcdGJvZHkgKz0gXCJ0aGlzLlwiICsgcHJpdkZpZWxkICsgXCIgPSBcIiArIGdldHRlciArIFwiO1xcblwiO1xuXHRcdFx0cHJvdG9bZ2V0dGVyXSA9IHByb3RvW2dldHRlcl0gfHwgZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzW3ByaXZGaWVsZF07IC8vIElmIHRoZXJlIGlzIG5vIGFyZ3VtZW50LCB1c2UgYXMgYSBnZXR0ZXJcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0XHQkb2JzZXJ2YWJsZSh0aGlzKS5zZXRQcm9wZXJ0eShnZXR0ZXIsIHZhbCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpc1twcml2RmllbGRdID0gdmFsO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoJG9ic2VydmFibGUpIHtcblx0XHRcdFx0cHJvdG9bZ2V0dGVyXS5zZXQgPSBwcm90b1tnZXR0ZXJdLnNldCB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7IC8vIFNldHRlciBjYWxsZWQgYnkgb2JzZXJ2YWJsZSBwcm9wZXJ0eSBjaGFuZ2Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KShnZXR0ZXJzW2ldKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yID0gbmV3IEZ1bmN0aW9uKGFyZ3MsIGJvZHkuc2xpY2UoMCwgLTEpKTtcblx0Y29uc3RydWN0b3IucHJvdG90eXBlID0gcHJvdG87XG5cdHByb3RvLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7XG5cblx0dm0ubWFwID0gbWFwO1xuXHR2bS5nZXR0ZXJzID0gZ2V0dGVycztcblx0dm0uZXh0ZW5kID0gZXh0ZW5kO1xuXHR2bS5pZCA9IGlkO1xuXHRyZXR1cm4gdm07XG59XG5cbmZ1bmN0aW9uIHRtcGxPYmplY3QobWFya3VwLCBvcHRpb25zKSB7XG5cdC8vIFRlbXBsYXRlIG9iamVjdCBjb25zdHJ1Y3RvclxuXHR2YXIgaHRtbFRhZyxcblx0XHR3cmFwTWFwID0gJHN1YlNldHRpbmdzQWR2YW5jZWQuX3dtIHx8IHt9LCAvLyBPbmx5IHVzZWQgaW4gSnNWaWV3cy4gT3RoZXJ3aXNlIGVtcHR5OiB7fVxuXHRcdHRtcGwgPSAkZXh0ZW5kKFxuXHRcdFx0e1xuXHRcdFx0XHR0bXBsczogW10sXG5cdFx0XHRcdGxpbmtzOiB7fSwgLy8gQ29tcGlsZWQgZnVuY3Rpb25zIGZvciBsaW5rIGV4cHJlc3Npb25zXG5cdFx0XHRcdGJuZHM6IFtdLFxuXHRcdFx0XHRfaXM6IFwidGVtcGxhdGVcIixcblx0XHRcdFx0cmVuZGVyOiByZW5kZXJDb250ZW50XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uc1xuXHRcdCk7XG5cblx0dG1wbC5tYXJrdXAgPSBtYXJrdXA7XG5cdGlmICghb3B0aW9ucy5odG1sVGFnKSB7XG5cdFx0Ly8gU2V0IHRtcGwudGFnIHRvIHRoZSB0b3AtbGV2ZWwgSFRNTCB0YWcgdXNlZCBpbiB0aGUgdGVtcGxhdGUsIGlmIGFueS4uLlxuXHRcdGh0bWxUYWcgPSByRmlyc3RFbGVtLmV4ZWMobWFya3VwKTtcblx0XHR0bXBsLmh0bWxUYWcgPSBodG1sVGFnID8gaHRtbFRhZ1sxXS50b0xvd2VyQ2FzZSgpIDogXCJcIjtcblx0fVxuXHRodG1sVGFnID0gd3JhcE1hcFt0bXBsLmh0bWxUYWddO1xuXHRpZiAoaHRtbFRhZyAmJiBodG1sVGFnICE9PSB3cmFwTWFwLmRpdikge1xuXHRcdC8vIFdoZW4gdXNpbmcgSnNWaWV3cywgd2UgdHJpbSB0ZW1wbGF0ZXMgd2hpY2ggYXJlIGluc2VydGVkIGludG8gSFRNTCBjb250ZXh0cyB3aGVyZSB0ZXh0IG5vZGVzIGFyZSBub3QgcmVuZGVyZWQgKGkuZS4gbm90ICdQaHJhc2luZyBDb250ZW50JykuXG5cdFx0Ly8gQ3VycmVudGx5IG5vdCB0cmltbWVkIGZvciA8bGk+IHRhZy4gKE5vdCB3b3J0aCBhZGRpbmcgcGVyZiBjb3N0KVxuXHRcdHRtcGwubWFya3VwID0gJC50cmltKHRtcGwubWFya3VwKTtcblx0fVxuXG5cdHJldHVybiB0bXBsO1xufVxuXG4vLz09PT09PT09PT09PT09XG4vLyByZWdpc3RlclN0b3JlXG4vLz09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyU3RvcmUoc3RvcmVOYW1lLCBzdG9yZVNldHRpbmdzKSB7XG5cblx0ZnVuY3Rpb24gdGhlU3RvcmUobmFtZSwgaXRlbSwgcGFyZW50VG1wbCkge1xuXHRcdC8vIFRoZSBzdG9yZSBpcyBhbHNvIHRoZSBmdW5jdGlvbiB1c2VkIHRvIGFkZCBpdGVtcyB0byB0aGUgc3RvcmUuIGUuZy4gJC50ZW1wbGF0ZXMsIG9yICQudmlld3MudGFnc1xuXG5cdFx0Ly8gRm9yIHN0b3JlIG9mIG5hbWUgJ3RoaW5nJywgQ2FsbCBhczpcblx0XHQvLyAgICAkLnZpZXdzLnRoaW5ncyhpdGVtc1ssIHBhcmVudFRtcGxdKSxcblx0XHQvLyBvciAkLnZpZXdzLnRoaW5ncyhuYW1lLCBpdGVtWywgcGFyZW50VG1wbF0pXG5cblx0XHR2YXIgb25TdG9yZSwgY29tcGlsZSwgaXRlbU5hbWUsIHRoaXNTdG9yZTtcblx0XHRpZiAobmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gT0JKRUNUICYmICFuYW1lLm5vZGVUeXBlICYmICFuYW1lLm1hcmt1cCAmJiAhbmFtZS5nZXRUZ3QgJiYgIShzdG9yZU5hbWUgPT09IFwidmlld01vZGVsXCIgJiYgbmFtZS5nZXR0ZXJzIHx8IG5hbWUuZXh0ZW5kKSkge1xuXHRcdFx0Ly8gQ2FsbCB0byAkLnZpZXdzLnRoaW5ncyhpdGVtc1ssIHBhcmVudFRtcGxdKSxcblxuXHRcdFx0Ly8gQWRkaW5nIGl0ZW1zIHRvIHRoZSBzdG9yZVxuXHRcdFx0Ly8gSWYgbmFtZSBpcyBhIGhhc2gsIHRoZW4gaXRlbSBpcyBwYXJlbnRUbXBsLiBJdGVyYXRlIG92ZXIgaGFzaCBhbmQgY2FsbCBzdG9yZSBmb3Iga2V5LlxuXHRcdFx0Zm9yIChpdGVtTmFtZSBpbiBuYW1lKSB7XG5cdFx0XHRcdHRoZVN0b3JlKGl0ZW1OYW1lLCBuYW1lW2l0ZW1OYW1lXSwgaXRlbSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbSB8fCAkdmlld3M7XG5cdFx0fVxuXHRcdC8vIEFkZGluZyBhIHNpbmdsZSB1bm5hbWVkIGl0ZW0gdG8gdGhlIHN0b3JlXG5cdFx0aWYgKGl0ZW0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aXRlbSA9IG5hbWU7XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAobmFtZSAmJiBcIlwiICsgbmFtZSAhPT0gbmFtZSkgeyAvLyBuYW1lIG11c3QgYmUgYSBzdHJpbmdcblx0XHRcdHBhcmVudFRtcGwgPSBpdGVtO1xuXHRcdFx0aXRlbSA9IG5hbWU7XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzU3RvcmUgPSBwYXJlbnRUbXBsXG5cdFx0XHQ/IHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIlxuXHRcdFx0XHQ/IHBhcmVudFRtcGxcblx0XHRcdFx0OiAocGFyZW50VG1wbFtzdG9yZU5hbWVzXSA9IHBhcmVudFRtcGxbc3RvcmVOYW1lc10gfHwge30pXG5cdFx0XHQ6IHRoZVN0b3JlO1xuXHRcdGNvbXBpbGUgPSBzdG9yZVNldHRpbmdzLmNvbXBpbGU7XG5cdFx0aWYgKGl0ZW0gPT09IG51bGwpIHtcblx0XHRcdC8vIElmIGl0ZW0gaXMgbnVsbCwgZGVsZXRlIHRoaXMgZW50cnlcblx0XHRcdGlmIChuYW1lKSB7XG5cdFx0XHRcdGRlbGV0ZSB0aGlzU3RvcmVbbmFtZV07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGl0ZW0gPSBjb21waWxlID8gY29tcGlsZS5jYWxsKHRoaXNTdG9yZSwgbmFtZSwgaXRlbSwgcGFyZW50VG1wbCwgMCkgOiBpdGVtO1xuXHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0dGhpc1N0b3JlW25hbWVdID0gaXRlbTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGNvbXBpbGUgJiYgaXRlbSkge1xuXHRcdFx0aXRlbS5faXMgPSBzdG9yZU5hbWU7IC8vIE9ubHkgZG8gdGhpcyBmb3IgY29tcGlsZWQgb2JqZWN0cyAodGFncywgdGVtcGxhdGVzLi4uKVxuXHRcdH1cblx0XHRpZiAoaXRlbSAmJiAob25TdG9yZSA9ICRzdWIub25TdG9yZVtzdG9yZU5hbWVdKSkge1xuXHRcdFx0Ly8gZS5nLiBKc1ZpZXdzIGludGVncmF0aW9uXG5cdFx0XHRvblN0b3JlKG5hbWUsIGl0ZW0sIGNvbXBpbGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gaXRlbTtcblx0fVxuXG5cdHZhciBzdG9yZU5hbWVzID0gc3RvcmVOYW1lICsgXCJzXCI7XG5cblx0JHZpZXdzW3N0b3JlTmFtZXNdID0gdGhlU3RvcmU7XG59XG5cbmZ1bmN0aW9uIGFkZFNldHRpbmcoc3QpIHtcblx0JHZpZXdzU2V0dGluZ3Nbc3RdID0gZnVuY3Rpb24odmFsdWUpIHtcblx0XHRyZXR1cm4gYXJndW1lbnRzLmxlbmd0aFxuXHRcdFx0PyAoJHN1YlNldHRpbmdzW3N0XSA9IHZhbHVlLCAkdmlld3NTZXR0aW5ncylcblx0XHRcdDogJHN1YlNldHRpbmdzW3N0XTtcblx0fTtcbn1cblxuLy89PT09PT09PT1cbi8vIGRhdGFNYXBcbi8vPT09PT09PT09XG5cbmZ1bmN0aW9uIGRhdGFNYXAobWFwRGVmKSB7XG5cdGZ1bmN0aW9uIE1hcChzb3VyY2UsIG9wdGlvbnMpIHtcblx0XHR0aGlzLnRndCA9IG1hcERlZi5nZXRUZ3Qoc291cmNlLCBvcHRpb25zKTtcblx0fVxuXG5cdGlmICgkaXNGdW5jdGlvbihtYXBEZWYpKSB7XG5cdFx0Ly8gU2ltcGxlIG1hcCBkZWNsYXJlZCBhcyBmdW5jdGlvblxuXHRcdG1hcERlZiA9IHtcblx0XHRcdGdldFRndDogbWFwRGVmXG5cdFx0fTtcblx0fVxuXG5cdGlmIChtYXBEZWYuYmFzZU1hcCkge1xuXHRcdG1hcERlZiA9ICRleHRlbmQoJGV4dGVuZCh7fSwgbWFwRGVmLmJhc2VNYXApLCBtYXBEZWYpO1xuXHR9XG5cblx0bWFwRGVmLm1hcCA9IGZ1bmN0aW9uKHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdHJldHVybiBuZXcgTWFwKHNvdXJjZSwgb3B0aW9ucyk7XG5cdH07XG5cdHJldHVybiBtYXBEZWY7XG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHJlbmRlckNvbnRlbnRcbi8vPT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gcmVuZGVyQ29udGVudChkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgcGFyZW50Vmlldywga2V5LCBvblJlbmRlcikge1xuXHR2YXIgaSwgbCwgdGFnLCB0bXBsLCB0YWdDdHgsIGlzVG9wUmVuZGVyQ2FsbCwgcHJldkRhdGEsIHByZXZJbmRleCxcblx0XHR2aWV3ID0gcGFyZW50Vmlldyxcblx0XHRyZXN1bHQgPSBcIlwiO1xuXG5cdGlmIChjb250ZXh0ID09PSB0cnVlKSB7XG5cdFx0bm9JdGVyYXRpb24gPSBjb250ZXh0OyAvLyBwYXNzaW5nIGJvb2xlYW4gYXMgc2Vjb25kIHBhcmFtIC0gbm9JdGVyYXRpb25cblx0XHRjb250ZXh0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBjb250ZXh0ICE9PSBPQkpFQ1QpIHtcblx0XHRjb250ZXh0ID0gdW5kZWZpbmVkOyAvLyBjb250ZXh0IG11c3QgYmUgYSBib29sZWFuIChub0l0ZXJhdGlvbikgb3IgYSBwbGFpbiBvYmplY3Rcblx0fVxuXG5cdGlmICh0YWcgPSB0aGlzLnRhZykge1xuXHRcdC8vIFRoaXMgaXMgYSBjYWxsIGZyb20gcmVuZGVyVGFnIG9yIHRhZ0N0eC5yZW5kZXIoLi4uKVxuXHRcdHRhZ0N0eCA9IHRoaXM7XG5cdFx0dmlldyA9IHZpZXcgfHwgdGFnQ3R4LnZpZXc7XG5cdFx0dG1wbCA9IHZpZXcuZ2V0VG1wbCh0YWcudGVtcGxhdGUgfHwgdGFnQ3R4LnRtcGwpO1xuXHRcdGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0ZGF0YSA9IHZpZXc7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIFRoaXMgaXMgYSB0ZW1wbGF0ZS5yZW5kZXIoLi4uKSBjYWxsXG5cdFx0dG1wbCA9IHRoaXM7XG5cdH1cblxuXHRpZiAodG1wbCkge1xuXHRcdGlmICghcGFyZW50VmlldyAmJiBkYXRhICYmIGRhdGEuX2lzID09PSBcInZpZXdcIikge1xuXHRcdFx0dmlldyA9IGRhdGE7IC8vIFdoZW4gcGFzc2luZyBpbiBhIHZpZXcgdG8gcmVuZGVyIG9yIGxpbmsgKGFuZCBub3QgcGFzc2luZyBpbiBhIHBhcmVudCB2aWV3KSB1c2UgdGhlIHBhc3NlZC1pbiB2aWV3IGFzIHBhcmVudFZpZXdcblx0XHR9XG5cblx0XHRpZiAodmlldykge1xuXHRcdFx0aWYgKGRhdGEgPT09IHZpZXcpIHtcblx0XHRcdFx0Ly8gSW5oZXJpdCB0aGUgZGF0YSBmcm9tIHRoZSBwYXJlbnQgdmlldy5cblx0XHRcdFx0Ly8gVGhpcyBtYXkgYmUgdGhlIGNvbnRlbnRzIG9mIGFuIHt7aWZ9fSBibG9ja1xuXHRcdFx0XHRkYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlzVG9wUmVuZGVyQ2FsbCA9ICF2aWV3O1xuXHRcdGlzUmVuZGVyQ2FsbCA9IGlzUmVuZGVyQ2FsbCB8fCBpc1RvcFJlbmRlckNhbGw7XG5cdFx0aWYgKCF2aWV3KSB7XG5cdFx0XHQoY29udGV4dCA9IGNvbnRleHQgfHwge30pLnJvb3QgPSBkYXRhOyAvLyBQcm92aWRlIH5yb290IGFzIHNob3J0Y3V0IHRvIHRvcC1sZXZlbCBkYXRhLlxuXHRcdH1cblx0XHRpZiAoIWlzUmVuZGVyQ2FsbCB8fCAkc3ViU2V0dGluZ3NBZHZhbmNlZC51c2VWaWV3cyB8fCB0bXBsLnVzZVZpZXdzIHx8IHZpZXcgJiYgdmlldyAhPT0gdG9wVmlldykge1xuXHRcdFx0cmVzdWx0ID0gcmVuZGVyV2l0aFZpZXdzKHRtcGwsIGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCB2aWV3LCBrZXksIG9uUmVuZGVyLCB0YWcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmlldykgeyAvLyBJbiBhIGJsb2NrXG5cdFx0XHRcdHByZXZEYXRhID0gdmlldy5kYXRhO1xuXHRcdFx0XHRwcmV2SW5kZXggPSB2aWV3LmluZGV4O1xuXHRcdFx0XHR2aWV3LmluZGV4ID0gaW5kZXhTdHI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aWV3ID0gdG9wVmlldztcblx0XHRcdFx0dmlldy5kYXRhID0gZGF0YTtcblx0XHRcdFx0dmlldy5jdHggPSBjb250ZXh0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCRpc0FycmF5KGRhdGEpICYmICFub0l0ZXJhdGlvbikge1xuXHRcdFx0XHQvLyBDcmVhdGUgYSB2aWV3IGZvciB0aGUgYXJyYXksIHdob3NlIGNoaWxkIHZpZXdzIGNvcnJlc3BvbmQgdG8gZWFjaCBkYXRhIGl0ZW0uIChOb3RlOiBpZiBrZXkgYW5kIHBhcmVudFZpZXcgYXJlIHBhc3NlZCBpblxuXHRcdFx0XHQvLyBhbG9uZyB3aXRoIHBhcmVudCB2aWV3LCB0cmVhdCBhcyBpbnNlcnQgLWUuZy4gZnJvbSB2aWV3LmFkZFZpZXdzIC0gc28gcGFyZW50VmlldyBpcyBhbHJlYWR5IHRoZSB2aWV3IGl0ZW0gZm9yIGFycmF5KVxuXHRcdFx0XHRmb3IgKGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0XHRcdFx0XHR2aWV3LmluZGV4ID0gaTtcblx0XHRcdFx0XHR2aWV3LmRhdGEgPSBkYXRhW2ldO1xuXHRcdFx0XHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGFbaV0sIHZpZXcsICRzdWIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aWV3LmRhdGEgPSBkYXRhO1xuXHRcdFx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhLCB2aWV3LCAkc3ViKTtcblx0XHRcdH1cblx0XHRcdHZpZXcuZGF0YSA9IHByZXZEYXRhO1xuXHRcdFx0dmlldy5pbmRleCA9IHByZXZJbmRleDtcblx0XHR9XG5cdFx0aWYgKGlzVG9wUmVuZGVyQ2FsbCkge1xuXHRcdFx0aXNSZW5kZXJDYWxsID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiByZW5kZXJXaXRoVmlld3ModG1wbCwgZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24sIHZpZXcsIGtleSwgb25SZW5kZXIsIHRhZykge1xuXHRmdW5jdGlvbiBzZXRJdGVtVmFyKGl0ZW0pIHtcblx0XHQvLyBXaGVuIGl0ZW1WYXIgaXMgc3BlY2lmaWVkLCBzZXQgbW9kaWZpZWQgY3R4IHdpdGggdXNlci1uYW1lZCB+aXRlbVxuXHRcdG5ld0N0eCA9ICRleHRlbmQoe30sIGNvbnRleHQpO1xuXHRcdG5ld0N0eFtpdGVtVmFyXSA9IGl0ZW07XG5cdH1cblxuXHQvLyBSZW5kZXIgdGVtcGxhdGUgYWdhaW5zdCBkYXRhIGFzIGEgdHJlZSBvZiBzdWJ2aWV3cyAobmVzdGVkIHJlbmRlcmVkIHRlbXBsYXRlIGluc3RhbmNlcyksIG9yIGFzIGEgc3RyaW5nICh0b3AtbGV2ZWwgdGVtcGxhdGUpLlxuXHQvLyBJZiB0aGUgZGF0YSBpcyB0aGUgcGFyZW50IHZpZXcsIHRyZWF0IGFzIG5vSXRlcmF0aW9uLCByZS1yZW5kZXIgd2l0aCB0aGUgc2FtZSBkYXRhIGNvbnRleHQuXG5cdHZhciBpLCBsLCBuZXdWaWV3LCBjaGlsZFZpZXcsIGl0ZW1SZXN1bHQsIHN3YXBDb250ZW50LCBjb250ZW50VG1wbCwgb3V0ZXJPblJlbmRlciwgdG1wbE5hbWUsIGl0ZW1WYXIsIG5ld0N0eCwgdGFnQ3R4LFxuXHRcdHJlc3VsdCA9IFwiXCI7XG5cblx0aWYgKHRhZykge1xuXHRcdC8vIFRoaXMgaXMgYSBjYWxsIGZyb20gcmVuZGVyVGFnIG9yIHRhZ0N0eC5yZW5kZXIoLi4uKVxuXHRcdHRtcGxOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4ID0gdGFnLnRhZ0N0eDtcblx0XHRjb250ZXh0ID0gY29udGV4dCA/IGV4dGVuZEN0eChjb250ZXh0LCB0YWcuY3R4KSA6IHRhZy5jdHg7XG5cblx0XHRpZiAodG1wbCA9PT0gdmlldy5jb250ZW50KSB7IC8vIHt7eHh4IHRtcGw9I2NvbnRlbnR9fVxuXHRcdFx0Y29udGVudFRtcGwgPSB0bXBsICE9PSB2aWV3LmN0eC5fd3JwIC8vIFdlIGFyZSByZW5kZXJpbmcgdGhlICNjb250ZW50XG5cdFx0XHRcdD8gdmlldy5jdHguX3dycCAvLyAjY29udGVudCB3YXMgdGhlIHRhZ0N0eC5wcm9wcy50bXBsIHdyYXBwZXIgb2YgdGhlIGJsb2NrIGNvbnRlbnQgLSBzbyB3aXRoaW4gdGhpcyB2aWV3LCAjY29udGVudCB3aWxsIG5vdyBiZSB0aGUgdmlldy5jdHguX3dycCBibG9jayBjb250ZW50XG5cdFx0XHRcdDogdW5kZWZpbmVkOyAvLyAjY29udGVudCB3YXMgdGhlIHZpZXcuY3R4Ll93cnAgYmxvY2sgY29udGVudCAtIHNvIHdpdGhpbiB0aGlzIHZpZXcsIHRoZXJlIGlzIG5vIGxvbmdlciBhbnkgI2NvbnRlbnQgdG8gd3JhcC5cblx0XHR9IGVsc2UgaWYgKHRtcGwgIT09IHRhZ0N0eC5jb250ZW50KSB7XG5cdFx0XHRpZiAodG1wbCA9PT0gdGFnLnRlbXBsYXRlKSB7IC8vIFJlbmRlcmluZyB7e3RhZ319IHRhZy50ZW1wbGF0ZSwgcmVwbGFjaW5nIGJsb2NrIGNvbnRlbnQuXG5cdFx0XHRcdGNvbnRlbnRUbXBsID0gdGFnQ3R4LnRtcGw7IC8vIFNldCAjY29udGVudCB0byBibG9jayBjb250ZW50IChvciB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgaWYgdGFnQ3R4LnByb3BzLnRtcGwgaXMgc2V0KVxuXHRcdFx0XHRjb250ZXh0Ll93cnAgPSB0YWdDdHguY29udGVudDsgLy8gUGFzcyB3cmFwcGVkIGJsb2NrIGNvbnRlbnQgdG8gbmVzdGVkIHZpZXdzXG5cdFx0XHR9IGVsc2UgeyAvLyBSZW5kZXJpbmcgdGFnQ3R4LnByb3BzLnRtcGwgd3JhcHBlclxuXHRcdFx0XHRjb250ZW50VG1wbCA9IHRhZ0N0eC5jb250ZW50IHx8IHZpZXcuY29udGVudDsgLy8gU2V0ICNjb250ZW50IHRvIHdyYXBwZWQgYmxvY2sgY29udGVudFxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50VG1wbCA9IHZpZXcuY29udGVudDsgLy8gTmVzdGVkIHZpZXdzIGluaGVyaXQgc2FtZSB3cmFwcGVkICNjb250ZW50IHByb3BlcnR5XG5cdFx0fVxuXG5cdFx0aWYgKHRhZ0N0eC5wcm9wcy5saW5rID09PSBmYWxzZSkge1xuXHRcdFx0Ly8gbGluaz1mYWxzZSBzZXR0aW5nIG9uIGJsb2NrIHRhZ1xuXHRcdFx0Ly8gV2Ugd2lsbCBvdmVycmlkZSBpbmhlcml0ZWQgdmFsdWUgb2YgbGluayBieSB0aGUgZXhwbGljaXQgc2V0dGluZyBsaW5rPWZhbHNlIHRha2VuIGZyb20gcHJvcHNcblx0XHRcdC8vIFRoZSBjaGlsZCB2aWV3cyBvZiBhbiB1bmxpbmtlZCB2aWV3IGFyZSBhbHNvIHVubGlua2VkLiBTbyBzZXR0aW5nIGNoaWxkIGJhY2sgdG8gdHJ1ZSB3aWxsIG5vdCBoYXZlIGFueSBlZmZlY3QuXG5cdFx0XHRjb250ZXh0ID0gY29udGV4dCB8fCB7fTtcblx0XHRcdGNvbnRleHQubGluayA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChpdGVtVmFyID0gdGFnQ3R4LnByb3BzLml0ZW1WYXIpIHtcblx0XHRcdGlmIChpdGVtVmFyLmNoYXJBdCgwKSAhPT0gXCJ+XCIpIHtcblx0XHRcdFx0c3ludGF4RXJyb3IoXCJVc2UgaXRlbVZhcj0nfm15SXRlbSdcIik7XG5cdFx0XHR9XG5cdFx0XHRpdGVtVmFyID0gaXRlbVZhci5zbGljZSgxKTtcblx0XHR9XG5cdH1cblxuXHRpZiAodmlldykge1xuXHRcdG9uUmVuZGVyID0gb25SZW5kZXIgfHwgdmlldy5fLm9uUmVuZGVyO1xuXHRcdGNvbnRleHQgPSBleHRlbmRDdHgoY29udGV4dCwgdmlldy5jdHgpO1xuXHR9XG5cblx0aWYgKGtleSA9PT0gdHJ1ZSkge1xuXHRcdHN3YXBDb250ZW50ID0gdHJ1ZTtcblx0XHRrZXkgPSAwO1xuXHR9XG5cblx0Ly8gSWYgbGluaz09PWZhbHNlLCBkbyBub3QgY2FsbCBvblJlbmRlciwgc28gbm8gZGF0YS1saW5raW5nIG1hcmtlciBub2Rlc1xuXHRpZiAob25SZW5kZXIgJiYgKGNvbnRleHQgJiYgY29udGV4dC5saW5rID09PSBmYWxzZSB8fCB0YWcgJiYgdGFnLl8ubm9Wd3MpKSB7XG5cdFx0b25SZW5kZXIgPSB1bmRlZmluZWQ7XG5cdH1cblx0b3V0ZXJPblJlbmRlciA9IG9uUmVuZGVyO1xuXHRpZiAob25SZW5kZXIgPT09IHRydWUpIHtcblx0XHQvLyBVc2VkIGJ5IHZpZXcucmVmcmVzaCgpLiBEb24ndCBjcmVhdGUgYSBuZXcgd3JhcHBlciB2aWV3LlxuXHRcdG91dGVyT25SZW5kZXIgPSB1bmRlZmluZWQ7XG5cdFx0b25SZW5kZXIgPSB2aWV3Ll8ub25SZW5kZXI7XG5cdH1cblx0Ly8gU2V0IGFkZGl0aW9uYWwgY29udGV4dCBvbiB2aWV3cyBjcmVhdGVkIGhlcmUsIChhcyBtb2RpZmllZCBjb250ZXh0IGluaGVyaXRlZCBmcm9tIHRoZSBwYXJlbnQsIGFuZCB0byBiZSBpbmhlcml0ZWQgYnkgY2hpbGQgdmlld3MpXG5cdGNvbnRleHQgPSB0bXBsLmhlbHBlcnNcblx0XHQ/IGV4dGVuZEN0eCh0bXBsLmhlbHBlcnMsIGNvbnRleHQpXG5cdFx0OiBjb250ZXh0O1xuXG5cdG5ld0N0eCA9IGNvbnRleHQ7XG5cdGlmICgkaXNBcnJheShkYXRhKSAmJiAhbm9JdGVyYXRpb24pIHtcblx0XHQvLyBDcmVhdGUgYSB2aWV3IGZvciB0aGUgYXJyYXksIHdob3NlIGNoaWxkIHZpZXdzIGNvcnJlc3BvbmQgdG8gZWFjaCBkYXRhIGl0ZW0uIChOb3RlOiBpZiBrZXkgYW5kIHZpZXcgYXJlIHBhc3NlZCBpblxuXHRcdC8vIGFsb25nIHdpdGggcGFyZW50IHZpZXcsIHRyZWF0IGFzIGluc2VydCAtZS5nLiBmcm9tIHZpZXcuYWRkVmlld3MgLSBzbyB2aWV3IGlzIGFscmVhZHkgdGhlIHZpZXcgaXRlbSBmb3IgYXJyYXkpXG5cdFx0bmV3VmlldyA9IHN3YXBDb250ZW50XG5cdFx0XHQ/IHZpZXdcblx0XHRcdDogKGtleSAhPT0gdW5kZWZpbmVkICYmIHZpZXcpXG5cdFx0XHRcdHx8IG5ldyBWaWV3KGNvbnRleHQsIFwiYXJyYXlcIiwgdmlldywgZGF0YSwgdG1wbCwga2V5LCBvblJlbmRlciwgY29udGVudFRtcGwpO1xuXHRcdGlmICh2aWV3ICYmIHZpZXcuXy51c2VLZXkpIHtcblx0XHRcdC8vIFBhcmVudCBpcyBub3QgYW4gJ2FycmF5IHZpZXcnXG5cdFx0XHRuZXdWaWV3Ll8uYm5kID0gIXRhZyB8fCB0YWcuXy5ibmQgJiYgdGFnOyAvLyBGb3IgYXJyYXkgdmlld3MgdGhhdCBhcmUgZGF0YSBib3VuZCBmb3IgY29sbGVjdGlvbiBjaGFuZ2UgZXZlbnRzLCBzZXQgdGhlXG5cdFx0XHQvLyB2aWV3Ll8uYm5kIHByb3BlcnR5IHRvIHRydWUgZm9yIHRvcC1sZXZlbCBsaW5rKCkgb3IgZGF0YS1saW5rPVwie2Zvcn1cIiwgb3IgdG8gdGhlIHRhZyBpbnN0YW5jZSBmb3IgYSBkYXRhLWJvdW5kIHRhZywgZS5nLiB7Xntmb3IgLi4ufX1cblx0XHR9XG5cdFx0aWYgKGl0ZW1WYXIpIHtcblx0XHRcdG5ld1ZpZXcuaXQgPSBpdGVtVmFyO1xuXHRcdH1cblx0XHRpdGVtVmFyID0gbmV3Vmlldy5pdDtcblx0XHRmb3IgKGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0XHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIGVhY2ggZGF0YSBpdGVtLlxuXHRcdFx0aWYgKGl0ZW1WYXIpIHtcblx0XHRcdFx0c2V0SXRlbVZhcihkYXRhW2ldKTsgLy8gdXNlIG1vZGlmaWVkIGN0eCB3aXRoIHVzZXItbmFtZWQgfml0ZW1cblx0XHRcdH1cblx0XHRcdGNoaWxkVmlldyA9IG5ldyBWaWV3KG5ld0N0eCwgXCJpdGVtXCIsIG5ld1ZpZXcsIGRhdGFbaV0sIHRtcGwsIChrZXkgfHwgMCkgKyBpLCBvblJlbmRlciwgbmV3Vmlldy5jb250ZW50KTtcblxuXHRcdFx0aXRlbVJlc3VsdCA9IHRtcGwuZm4oZGF0YVtpXSwgY2hpbGRWaWV3LCAkc3ViKTtcblx0XHRcdHJlc3VsdCArPSBuZXdWaWV3Ll8ub25SZW5kZXIgPyBuZXdWaWV3Ll8ub25SZW5kZXIoaXRlbVJlc3VsdCwgY2hpbGRWaWV3KSA6IGl0ZW1SZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHNpbmdsZXRvbiBkYXRhIG9iamVjdC4gVGhlIHR5cGUgb2YgdGhlIHZpZXcgd2lsbCBiZSB0aGUgdGFnIG5hbWUsIGUuZy4gXCJpZlwiIG9yIFwibXlUYWdcIiBleGNlcHQgZm9yXG5cdFx0Ly8gXCJpdGVtXCIsIFwiYXJyYXlcIiBhbmQgXCJkYXRhXCIgdmlld3MuIEEgXCJkYXRhXCIgdmlldyBpcyBmcm9tIHByb2dyYW1tYXRpYyByZW5kZXIob2JqZWN0KSBhZ2FpbnN0IGEgJ3NpbmdsZXRvbicuXG5cdFx0aWYgKGl0ZW1WYXIpIHtcblx0XHRcdHNldEl0ZW1WYXIoZGF0YSk7XG5cdFx0fVxuXHRcdG5ld1ZpZXcgPSBzd2FwQ29udGVudCA/IHZpZXcgOiBuZXcgVmlldyhuZXdDdHgsIHRtcGxOYW1lIHx8IFwiZGF0YVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cdFx0aWYgKHRhZyAmJiAhdGFnLmZsb3cpIHtcblx0XHRcdG5ld1ZpZXcudGFnID0gdGFnO1xuXHRcdFx0dGFnLnZpZXcgPSBuZXdWaWV3O1xuXHRcdH1cblx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhLCBuZXdWaWV3LCAkc3ViKTtcblx0fVxuXHRyZXR1cm4gb3V0ZXJPblJlbmRlciA/IG91dGVyT25SZW5kZXIocmVzdWx0LCBuZXdWaWV3KSA6IHJlc3VsdDtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEJ1aWxkIGFuZCBjb21waWxlIHRlbXBsYXRlXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBHZW5lcmF0ZSBhIHJldXNhYmxlIGZ1bmN0aW9uIHRoYXQgd2lsbCBzZXJ2ZSB0byByZW5kZXIgYSB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGFcbi8vIChDb21waWxlIEFTVCB0aGVuIGJ1aWxkIHRlbXBsYXRlIGZ1bmN0aW9uKVxuXG5mdW5jdGlvbiBvblJlbmRlckVycm9yKGUsIHZpZXcsIGZhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlID0gZmFsbGJhY2sgIT09IHVuZGVmaW5lZFxuXHRcdD8gJGlzRnVuY3Rpb24oZmFsbGJhY2spXG5cdFx0XHQ/IGZhbGxiYWNrLmNhbGwodmlldy5kYXRhLCBlLCB2aWV3KVxuXHRcdFx0OiBmYWxsYmFjayB8fCBcIlwiXG5cdFx0OiBcIntFcnJvcjogXCIgKyBlLm1lc3NhZ2UgKyBcIn1cIjtcblxuXHRpZiAoJHN1YlNldHRpbmdzLm9uRXJyb3IgJiYgKGZhbGxiYWNrID0gJHN1YlNldHRpbmdzLm9uRXJyb3IuY2FsbCh2aWV3LmRhdGEsIGUsIGZhbGxiYWNrICYmIG1lc3NhZ2UsIHZpZXcpKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0bWVzc2FnZSA9IGZhbGxiYWNrOyAvLyBUaGVyZSBpcyBhIHNldHRpbmdzLmRlYnVnTW9kZShoYW5kbGVyKSBvbkVycm9yIG92ZXJyaWRlLiBDYWxsIGl0LCBhbmQgdXNlIHJldHVybiB2YWx1ZSAoaWYgYW55KSB0byByZXBsYWNlIG1lc3NhZ2Vcblx0fVxuXG5cdHJldHVybiB2aWV3ICYmICF2aWV3LmxpbmtDdHggPyAkY29udmVydGVycy5odG1sKG1lc3NhZ2UpIDogbWVzc2FnZTtcbn1cblxuZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuXHR0aHJvdyBuZXcgJHN1Yi5FcnIobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIHN5bnRheEVycm9yKG1lc3NhZ2UpIHtcblx0ZXJyb3IoXCJTeW50YXggZXJyb3JcXG5cIiArIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiB0bXBsRm4obWFya3VwLCB0bXBsLCBpc0xpbmtFeHByLCBjb252ZXJ0QmFjaywgaGFzRWxzZSkge1xuXHQvLyBDb21waWxlIG1hcmt1cCB0byBBU1QgKGFidHJhY3Qgc3ludGF4IHRyZWUpIHRoZW4gYnVpbGQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGNvZGUgZnJvbSB0aGUgQVNUIG5vZGVzXG5cdC8vIFVzZWQgZm9yIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGFuZCBhbHNvIGJ5IEpzVmlld3MgdG8gYnVpbGQgZnVuY3Rpb25zIGZvciBkYXRhIGxpbmsgZXhwcmVzc2lvbnNcblxuXHQvLz09PT0gbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cdGZ1bmN0aW9uIHB1c2hwcmVjZWRpbmdDb250ZW50KHNoaWZ0KSB7XG5cdFx0c2hpZnQgLT0gbG9jO1xuXHRcdGlmIChzaGlmdCkge1xuXHRcdFx0Y29udGVudC5wdXNoKG1hcmt1cC5zdWJzdHIobG9jLCBzaGlmdCkucmVwbGFjZShyTmV3TGluZSwgXCJcXFxcblwiKSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYmxvY2tUYWdDaGVjayh0YWdOYW1lLCBibG9jaykge1xuXHRcdGlmICh0YWdOYW1lKSB7XG5cdFx0XHR0YWdOYW1lICs9ICd9fSc7XG5cdFx0XHQvL1x0XHRcdCd7e2luY2x1ZGV9fSBibG9jayBoYXMge3svZm9yfX0gd2l0aCBubyBvcGVuIHt7Zm9yfX0nXG5cdFx0XHRzeW50YXhFcnJvcigoXG5cdFx0XHRcdGJsb2NrXG5cdFx0XHRcdFx0PyAne3snICsgYmxvY2sgKyAnfX0gYmxvY2sgaGFzIHt7LycgKyB0YWdOYW1lICsgJyB3aXRob3V0IHt7JyArIHRhZ05hbWVcblx0XHRcdFx0XHQ6ICdVbm1hdGNoZWQgb3IgbWlzc2luZyB7ey8nICsgdGFnTmFtZSkgKyAnLCBpbiB0ZW1wbGF0ZTpcXG4nICsgbWFya3VwKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVRhZyhhbGwsIGJpbmQsIHRhZ05hbWUsIGNvbnZlcnRlciwgY29sb24sIGh0bWwsIGNvZGVUYWcsIHBhcmFtcywgc2xhc2gsIGJpbmQyLCBjbG9zZUJsb2NrLCBpbmRleCkge1xuLypcblxuICAgICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcbi8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19L2dcblxuKD86XG4gIHsoXFxeKT97ICAgICAgICAgICAgYmluZFxuICAoPzpcbiAgICAoXFx3KyAgICAgICAgICAgICB0YWdOYW1lXG4gICAgICAoPz1bXFwvXFxzfV0pXG4gICAgKVxuICAgIHxcbiAgICAoXFx3Kyk/KDopICAgICAgICBjb252ZXJ0ZXIgY29sb25cbiAgICB8XG4gICAgKD4pICAgICAgICAgICAgICBodG1sXG4gICAgfFxuICAgIChcXCopICAgICAgICAgICAgIGNvZGVUYWdcbiAgKVxuICBcXHMqXG4gICggICAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAoPzpbXn1dfH0oPyF9KSkqP1xuICApXG4gIChcXC8pPyAgICAgICAgICAgICAgc2xhc2hcbiAgfFxuICB7KFxcXik/eyAgICAgICAgICAgIGJpbmQyXG4gICg/OlxuICAgICg/OlxcLyhcXHcrKSlcXHMqICAgY2xvc2VCbG9ja1xuICAgIHxcbiAgICAhLS1bXFxzXFxTXSo/LS0gICAgY29tbWVudFxuICApXG4pXG59fS9nXG5cbiovXG5cdFx0aWYgKGNvZGVUYWcgJiYgYmluZCB8fCBzbGFzaCAmJiAhdGFnTmFtZSB8fCBwYXJhbXMgJiYgcGFyYW1zLnNsaWNlKC0xKSA9PT0gXCI6XCIgfHwgYmluZDIpIHtcblx0XHRcdHN5bnRheEVycm9yKGFsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gQnVpbGQgYWJzdHJhY3Qgc3ludGF4IHRyZWUgKEFTVCk6IFt0YWdOYW1lLCBjb252ZXJ0ZXIsIHBhcmFtcywgY29udGVudCwgaGFzaCwgYmluZGluZ3MsIGNvbnRlbnRNYXJrdXBdXG5cdFx0aWYgKGh0bWwpIHtcblx0XHRcdGNvbG9uID0gXCI6XCI7XG5cdFx0XHRjb252ZXJ0ZXIgPSBIVE1MO1xuXHRcdH1cblx0XHRzbGFzaCA9IHNsYXNoIHx8IGlzTGlua0V4cHIgJiYgIWhhc0Vsc2U7XG5cblx0XHR2YXIgcGF0aEJpbmRpbmdzID0gKGJpbmQgfHwgaXNMaW5rRXhwcikgJiYgW1tdXSxcblx0XHRcdHByb3BzID0gXCJcIixcblx0XHRcdGFyZ3MgPSBcIlwiLFxuXHRcdFx0Y3R4UHJvcHMgPSBcIlwiLFxuXHRcdFx0cGFyYW1zQXJncyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNQcm9wcyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNDdHhQcm9wcyA9IFwiXCIsXG5cdFx0XHRvbkVycm9yID0gXCJcIixcblx0XHRcdHVzZVRyaWdnZXIgPSBcIlwiLFxuXHRcdFx0Ly8gQmxvY2sgdGFnIGlmIG5vdCBzZWxmLWNsb3NpbmcgYW5kIG5vdCB7ezp9fSBvciB7ez59fSAoc3BlY2lhbCBjYXNlKSBhbmQgbm90IGEgZGF0YS1saW5rIGV4cHJlc3Npb25cblx0XHRcdGJsb2NrID0gIXNsYXNoICYmICFjb2xvbjtcblxuXHRcdC8vPT09PSBuZXN0ZWQgaGVscGVyIGZ1bmN0aW9uID09PT1cblx0XHR0YWdOYW1lID0gdGFnTmFtZSB8fCAocGFyYW1zID0gcGFyYW1zIHx8IFwiI2RhdGFcIiwgY29sb24pOyAvLyB7ezp9fSBpcyBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRwdXNocHJlY2VkaW5nQ29udGVudChpbmRleCk7XG5cdFx0bG9jID0gaW5kZXggKyBhbGwubGVuZ3RoOyAvLyBsb2NhdGlvbiBtYXJrZXIgLSBwYXJzZWQgdXAgdG8gaGVyZVxuXHRcdGlmIChjb2RlVGFnKSB7XG5cdFx0XHRpZiAoYWxsb3dDb2RlKSB7XG5cdFx0XHRcdGNvbnRlbnQucHVzaChbXCIqXCIsIFwiXFxuXCIgKyBwYXJhbXMucmVwbGFjZSgvXjovLCBcInJldCs9IFwiKS5yZXBsYWNlKHJVbmVzY2FwZVF1b3RlcywgXCIkMVwiKSArIFwiO1xcblwiXSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0YWdOYW1lKSB7XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0aWYgKHJUZXN0RWxzZUlmLnRlc3QocGFyYW1zKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKCdmb3IgXCJ7e2Vsc2UgaWYgZXhwcn19XCIgdXNlIFwie3tlbHNlIGV4cHJ9fVwiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGF0aEJpbmRpbmdzID0gY3VycmVudFs3XSAmJiBbW11dO1xuXHRcdFx0XHRjdXJyZW50WzhdID0gbWFya3VwLnN1YnN0cmluZyhjdXJyZW50WzhdLCBpbmRleCk7IC8vIGNvbnRlbnRNYXJrdXAgZm9yIGJsb2NrIHRhZ1xuXHRcdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0XHRcdGNvbnRlbnQgPSBjdXJyZW50WzJdO1xuXHRcdFx0XHRibG9jayA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGFyYW1zKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBwYXJhbXMgc3RyaW5nLCB0byBhdm9pZCBjb21waWxlZCBjb2RlIGVycm9ycyBmb3IgdW50ZXJtaW5hdGVkIHN0cmluZ3Ncblx0XHRcdFx0cGFyc2VQYXJhbXMocGFyYW1zLnJlcGxhY2Uock5ld0xpbmUsIFwiIFwiKSwgcGF0aEJpbmRpbmdzLCB0bXBsKVxuXHRcdFx0XHRcdC5yZXBsYWNlKHJCdWlsZEhhc2gsIGZ1bmN0aW9uKGFsbCwgb25lcnJvciwgaXNDdHgsIGtleSwga2V5VG9rZW4sIGtleVZhbHVlLCBhcmcsIHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRrZXkgPSBcIidcIiArIGtleVRva2VuICsgXCInOlwiO1xuXHRcdFx0XHRcdFx0aWYgKGFyZykge1xuXHRcdFx0XHRcdFx0XHRhcmdzICs9IGtleVZhbHVlICsgXCIsXCI7XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0FyZ3MgKz0gXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNDdHgpIHtcblx0XHRcdFx0XHRcdFx0Y3R4UHJvcHMgKz0ga2V5ICsgJ2ouX2NwKCcgKyBrZXlWYWx1ZSArICcsXCInICsgcGFyYW0gKyAnXCIsdmlldyksJztcblx0XHRcdFx0XHRcdFx0Ly8gQ29tcGlsZWQgY29kZSBmb3IgZXZhbHVhdGluZyB0YWdDdHggb24gYSB0YWcgd2lsbCBoYXZlOiBjdHg6eydmb28nOmouX2NwKGNvbXBpbGVkRXhwciwgXCJleHByXCIsIHZpZXcpfVxuXHRcdFx0XHRcdFx0XHRwYXJhbXNDdHhQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChvbmVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdG9uRXJyb3IgKz0ga2V5VmFsdWU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpZiAoa2V5VG9rZW4gPT09IFwidHJpZ2dlclwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0dXNlVHJpZ2dlciArPSBrZXlWYWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRwcm9wcyArPSBrZXkgKyBrZXlWYWx1ZSArIFwiLFwiO1xuXHRcdFx0XHRcdFx0XHRwYXJhbXNQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0XHRoYXNIYW5kbGVycyA9IGhhc0hhbmRsZXJzIHx8IHJIYXNIYW5kbGVycy50ZXN0KGtleVRva2VuKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0XHRcdH0pLnNsaWNlKDAsIC0xKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0pIHtcblx0XHRcdFx0cGF0aEJpbmRpbmdzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGJpbmRpbmdzIHRoYXQgd2FzIHByZXBhcmVkIGZvciBuZXh0IGFyZy4gKFRoZXJlIGlzIGFsd2F5cyBhbiBleHRyYSBvbmUgcmVhZHkpLlxuXHRcdFx0fVxuXG5cdFx0XHRuZXdOb2RlID0gW1xuXHRcdFx0XHRcdHRhZ05hbWUsXG5cdFx0XHRcdFx0Y29udmVydGVyIHx8ICEhY29udmVydEJhY2sgfHwgaGFzSGFuZGxlcnMgfHwgXCJcIixcblx0XHRcdFx0XHRibG9jayAmJiBbXSxcblx0XHRcdFx0XHRwYXJzZWRQYXJhbShwYXJhbXNBcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiJyNkYXRhJyxcIiA6IFwiXCIpLCBwYXJhbXNQcm9wcywgcGFyYW1zQ3R4UHJvcHMpLCAvLyB7ezp9fSBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRcdFx0XHRwYXJzZWRQYXJhbShhcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiZGF0YSxcIiA6IFwiXCIpLCBwcm9wcywgY3R4UHJvcHMpLFxuXHRcdFx0XHRcdG9uRXJyb3IsXG5cdFx0XHRcdFx0dXNlVHJpZ2dlcixcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgfHwgMFxuXHRcdFx0XHRdO1xuXHRcdFx0Y29udGVudC5wdXNoKG5ld05vZGUpO1xuXHRcdFx0aWYgKGJsb2NrKSB7XG5cdFx0XHRcdHN0YWNrLnB1c2goY3VycmVudCk7XG5cdFx0XHRcdGN1cnJlbnQgPSBuZXdOb2RlO1xuXHRcdFx0XHRjdXJyZW50WzhdID0gbG9jOyAvLyBTdG9yZSBjdXJyZW50IGxvY2F0aW9uIG9mIG9wZW4gdGFnLCB0byBiZSBhYmxlIHRvIGFkZCBjb250ZW50TWFya3VwIHdoZW4gd2UgcmVhY2ggY2xvc2luZyB0YWdcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGNsb3NlQmxvY2spIHtcblx0XHRcdGJsb2NrVGFnQ2hlY2soY2xvc2VCbG9jayAhPT0gY3VycmVudFswXSAmJiBjdXJyZW50WzBdICE9PSBcImVsc2VcIiAmJiBjbG9zZUJsb2NrLCBjdXJyZW50WzBdKTtcblx0XHRcdGN1cnJlbnRbOF0gPSBtYXJrdXAuc3Vic3RyaW5nKGN1cnJlbnRbOF0sIGluZGV4KTsgLy8gY29udGVudE1hcmt1cCBmb3IgYmxvY2sgdGFnXG5cdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0fVxuXHRcdGJsb2NrVGFnQ2hlY2soIWN1cnJlbnQgJiYgY2xvc2VCbG9jayk7XG5cdFx0Y29udGVudCA9IGN1cnJlbnRbMl07XG5cdH1cblx0Ly89PT09IC9lbmQgb2YgbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cblx0dmFyIGksIHJlc3VsdCwgbmV3Tm9kZSwgaGFzSGFuZGxlcnMsIGJpbmRpbmdzLFxuXHRcdGFsbG93Q29kZSA9ICRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgfHwgdG1wbCAmJiB0bXBsLmFsbG93Q29kZVxuXHRcdFx0fHwgJHZpZXdzU2V0dGluZ3MuYWxsb3dDb2RlID09PSB0cnVlLCAvLyBpbmNsdWRlIGRpcmVjdCBzZXR0aW5nIG9mIHNldHRpbmdzLmFsbG93Q29kZSB0cnVlIGZvciBiYWNrd2FyZCBjb21wYXQgb25seVxuXHRcdGFzdFRvcCA9IFtdLFxuXHRcdGxvYyA9IDAsXG5cdFx0c3RhY2sgPSBbXSxcblx0XHRjb250ZW50ID0gYXN0VG9wLFxuXHRcdGN1cnJlbnQgPSBbLCxhc3RUb3BdO1xuXG5cdGlmIChhbGxvd0NvZGUgJiYgdG1wbC5faXMpIHtcblx0XHR0bXBsLmFsbG93Q29kZSA9IGFsbG93Q29kZTtcblx0fVxuXG4vL1RPRE9cdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdOyAvLyBPbmx5IGNhY2hlIGlmIHRlbXBsYXRlIGlzIG5vdCBuYW1lZCBhbmQgbWFya3VwIGxlbmd0aCA8IC4uLixcbi8vYW5kIHRoZXJlIGFyZSBubyBiaW5kaW5ncyBvciBzdWJ0ZW1wbGF0ZXM/PyBDb25zaWRlciBzdGFuZGFyZCBvcHRpbWl6YXRpb24gZm9yIGRhdGEtbGluaz1cImEuYi5jXCJcbi8vXHRcdGlmIChyZXN1bHQpIHtcbi8vXHRcdFx0dG1wbC5mbiA9IHJlc3VsdDtcbi8vXHRcdH0gZWxzZSB7XG5cbi8vXHRcdHJlc3VsdCA9IG1hcmt1cDtcblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRpZiAoY29udmVydEJhY2sgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bWFya3VwID0gbWFya3VwLnNsaWNlKDAsIC1jb252ZXJ0QmFjay5sZW5ndGggLSAyKSArIGRlbGltQ2xvc2VDaGFyMDtcblx0XHR9XG5cdFx0bWFya3VwID0gZGVsaW1PcGVuQ2hhcjAgKyBtYXJrdXAgKyBkZWxpbUNsb3NlQ2hhcjE7XG5cdH1cblxuXHRibG9ja1RhZ0NoZWNrKHN0YWNrWzBdICYmIHN0YWNrWzBdWzJdLnBvcCgpWzBdKTtcblx0Ly8gQnVpbGQgdGhlIEFTVCAoYWJzdHJhY3Qgc3ludGF4IHRyZWUpIHVuZGVyIGFzdFRvcFxuXHRtYXJrdXAucmVwbGFjZShyVGFnLCBwYXJzZVRhZyk7XG5cblx0cHVzaHByZWNlZGluZ0NvbnRlbnQobWFya3VwLmxlbmd0aCk7XG5cblx0aWYgKGxvYyA9IGFzdFRvcFthc3RUb3AubGVuZ3RoIC0gMV0pIHtcblx0XHRibG9ja1RhZ0NoZWNrKFwiXCIgKyBsb2MgIT09IGxvYyAmJiAoK2xvY1s4XSA9PT0gbG9jWzhdKSAmJiBsb2NbMF0pO1xuXHR9XG4vL1x0XHRcdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdID0gYnVpbGRDb2RlKGFzdFRvcCwgdG1wbCk7XG4vL1x0XHR9XG5cblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCBtYXJrdXAsIGlzTGlua0V4cHIpO1xuXHRcdGJpbmRpbmdzID0gW107XG5cdFx0aSA9IGFzdFRvcC5sZW5ndGg7XG5cdFx0d2hpbGUgKGktLSkge1xuXHRcdFx0YmluZGluZ3MudW5zaGlmdChhc3RUb3BbaV1bN10pOyAgLy8gV2l0aCBkYXRhLWxpbmsgZXhwcmVzc2lvbnMsIHBhdGhCaW5kaW5ncyBhcnJheSBmb3IgdGFnQ3R4W2ldIGlzIGFzdFRvcFtpXVs3XVxuXHRcdH1cblx0XHRzZXRQYXRocyhyZXN1bHQsIGJpbmRpbmdzKTtcblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCB0bXBsKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzZXRQYXRocyhmbiwgcGF0aHNBcnIpIHtcblx0dmFyIGtleSwgcGF0aHMsXG5cdFx0aSA9IDAsXG5cdFx0bCA9IHBhdGhzQXJyLmxlbmd0aDtcblx0Zm4uZGVwcyA9IFtdO1xuXHRmbi5wYXRocyA9IFtdOyAvLyBUaGUgYXJyYXkgb2YgcGF0aCBiaW5kaW5nIChhcnJheS9kaWN0aW9uYXJ5KXMgZm9yIGVhY2ggdGFnL2Vsc2UgYmxvY2sncyBhcmdzIGFuZCBwcm9wc1xuXHRmb3IgKDsgaSA8IGw7IGkrKykge1xuXHRcdGZuLnBhdGhzLnB1c2gocGF0aHMgPSBwYXRoc0FycltpXSk7XG5cdFx0Zm9yIChrZXkgaW4gcGF0aHMpIHtcblx0XHRcdGlmIChrZXkgIT09IFwiX2pzdnRvXCIgJiYgcGF0aHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBwYXRoc1trZXldLmxlbmd0aCAmJiAhcGF0aHNba2V5XS5za3ApIHtcblx0XHRcdFx0Zm4uZGVwcyA9IGZuLmRlcHMuY29uY2F0KHBhdGhzW2tleV0pOyAvLyBkZXBzIGlzIHRoZSBjb25jYXRlbmF0aW9uIG9mIHRoZSBwYXRocyBhcnJheXMgZm9yIHRoZSBkaWZmZXJlbnQgYmluZGluZ3Ncblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcGFyc2VkUGFyYW0oYXJncywgcHJvcHMsIGN0eCkge1xuXHRyZXR1cm4gW2FyZ3Muc2xpY2UoMCwgLTEpLCBwcm9wcy5zbGljZSgwLCAtMSksIGN0eC5zbGljZSgwLCAtMSldO1xufVxuXG5mdW5jdGlvbiBwYXJhbVN0cnVjdHVyZShwYXJ0cywgdHlwZSkge1xuXHRyZXR1cm4gJ1xcblxcdCdcblx0XHQrICh0eXBlXG5cdFx0XHQ/IHR5cGUgKyAnOnsnXG5cdFx0XHQ6ICcnKVxuXHRcdCsgJ2FyZ3M6WycgKyBwYXJ0c1swXSArICddJ1xuXHRcdCsgKHBhcnRzWzFdIHx8ICF0eXBlXG5cdFx0XHQ/ICcsXFxuXFx0cHJvcHM6eycgKyBwYXJ0c1sxXSArICd9J1xuXHRcdFx0OiBcIlwiKVxuXHRcdCsgKHBhcnRzWzJdID8gJyxcXG5cXHRjdHg6eycgKyBwYXJ0c1syXSArICd9JyA6IFwiXCIpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVBhcmFtcyhwYXJhbXMsIHBhdGhCaW5kaW5ncywgdG1wbCkge1xuXG5cdGZ1bmN0aW9uIHBhcnNlVG9rZW5zKGFsbCwgbGZ0UHJuMCwgbGZ0UHJuLCBib3VuZCwgcGF0aCwgb3BlcmF0b3IsIGVyciwgZXEsIHBhdGgyLCBwcm4sIGNvbW1hLCBsZnRQcm4yLCBhcG9zLCBxdW90LCBydFBybiwgcnRQcm5Eb3QsIHBybjIsIHNwYWNlLCBpbmRleCwgZnVsbCkge1xuXHQvLyAvKFxcKCkoPz1cXHMqXFwoKXwoPzooWyhbXSlcXHMqKT8oPzooXFxePykoISo/WyN+XT9bXFx3JC5eXSspP1xccyooKFxcK1xcK3wtLSl8XFwrfC18JiZ8XFx8XFx8fD09PXwhPT18PT18IT18PD18Pj18Wzw+JSo6P1xcL118KD0pKVxccyp8KCEqP1sjfl0/W1xcdyQuXl0rKShbKFtdKT8pfCgsXFxzKil8KFxcKD8pXFxcXD8oPzooJyl8KFwiKSl8KD86XFxzKigoWylcXF1dKSg/PVxccypbLl5dfFxccyokfFteKFtdKXxbKVxcXV0pKFsoW10/KSl8KFxccyspL2csXG5cdC8vICAgbGZ0UHJuMCAgICAgICAgbGZ0UHJuICAgICAgICBib3VuZCAgICAgICAgICAgIHBhdGggICAgb3BlcmF0b3IgZXJyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXEgICAgICAgICAgICAgcGF0aDIgICAgICAgcHJuICAgIGNvbW1hICAgbGZ0UHJuMiAgIGFwb3MgcXVvdCAgICAgIHJ0UHJuIHJ0UHJuRG90ICAgICAgICAgICAgICAgICAgICAgICAgcHJuMiAgc3BhY2Vcblx0XHQvLyAobGVmdCBwYXJlbj8gZm9sbG93ZWQgYnkgKHBhdGg/IGZvbGxvd2VkIGJ5IG9wZXJhdG9yKSBvciAocGF0aCBmb2xsb3dlZCBieSBwYXJlbj8pKSBvciBjb21tYSBvciBhcG9zIG9yIHF1b3Qgb3IgcmlnaHQgcGFyZW4gb3Igc3BhY2Vcblx0XHRmdW5jdGlvbiBwYXJzZVBhdGgoYWxsUGF0aCwgbm90LCBvYmplY3QsIGhlbHBlciwgdmlldywgdmlld1Byb3BlcnR5LCBwYXRoVG9rZW5zLCBsZWFmVG9rZW4pIHtcblx0XHRcdC8vclBhdGggPSAvXighKj8pKD86bnVsbHx0cnVlfGZhbHNlfFxcZFtcXGQuXSp8KFtcXHckXSt8XFwufH4oW1xcdyRdKyl8Iyh2aWV3fChbXFx3JF0rKSk/KShbXFx3JC5eXSo/KSg/OlsuW15dKFtcXHckXSspXFxdPyk/KSQvZyxcblx0XHRcdC8vICAgICAgICAgIG5vdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmplY3QgICAgIGhlbHBlciAgICB2aWV3ICB2aWV3UHJvcGVydHkgcGF0aFRva2VucyAgICAgIGxlYWZUb2tlblxuXHRcdFx0dmFyIHN1YlBhdGggPSBvYmplY3QgPT09IFwiLlwiO1xuXHRcdFx0aWYgKG9iamVjdCkge1xuXHRcdFx0XHRwYXRoID0gcGF0aC5zbGljZShub3QubGVuZ3RoKTtcblx0XHRcdFx0aWYgKC9eXFwuP2NvbnN0cnVjdG9yJC8udGVzdChsZWFmVG9rZW58fHBhdGgpKSB7XG5cdFx0XHRcdFx0c3ludGF4RXJyb3IoYWxsUGF0aCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFzdWJQYXRoKSB7XG5cdFx0XHRcdFx0YWxsUGF0aCA9IChoZWxwZXJcblx0XHRcdFx0XHRcdFx0PyAndmlldy5obHAoXCInICsgaGVscGVyICsgJ1wiKSdcblx0XHRcdFx0XHRcdFx0OiB2aWV3XG5cdFx0XHRcdFx0XHRcdFx0PyBcInZpZXdcIlxuXHRcdFx0XHRcdFx0XHRcdDogXCJkYXRhXCIpXG5cdFx0XHRcdFx0XHQrIChsZWFmVG9rZW5cblx0XHRcdFx0XHRcdFx0PyAodmlld1Byb3BlcnR5XG5cdFx0XHRcdFx0XHRcdFx0PyBcIi5cIiArIHZpZXdQcm9wZXJ0eVxuXHRcdFx0XHRcdFx0XHRcdDogaGVscGVyXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0XHRcdFx0XHRcdDogKHZpZXcgPyBcIlwiIDogXCIuXCIgKyBvYmplY3QpXG5cdFx0XHRcdFx0XHRcdFx0KSArIChwYXRoVG9rZW5zIHx8IFwiXCIpXG5cdFx0XHRcdFx0XHRcdDogKGxlYWZUb2tlbiA9IGhlbHBlciA/IFwiXCIgOiB2aWV3ID8gdmlld1Byb3BlcnR5IHx8IFwiXCIgOiBvYmplY3QsIFwiXCIpKTtcblxuXHRcdFx0XHRcdGFsbFBhdGggPSBhbGxQYXRoICsgKGxlYWZUb2tlbiA/IFwiLlwiICsgbGVhZlRva2VuIDogXCJcIik7XG5cblx0XHRcdFx0XHRhbGxQYXRoID0gbm90ICsgKGFsbFBhdGguc2xpY2UoMCwgOSkgPT09IFwidmlldy5kYXRhXCJcblx0XHRcdFx0XHRcdD8gYWxsUGF0aC5zbGljZSg1KSAvLyBjb252ZXJ0ICN2aWV3LmRhdGEuLi4gdG8gZGF0YS4uLlxuXHRcdFx0XHRcdFx0OiBhbGxQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYmluZGluZ3MpIHtcblx0XHRcdFx0XHRiaW5kcyA9IG5hbWVkID09PSBcImxpbmtUb1wiID8gKGJpbmR0byA9IHBhdGhCaW5kaW5ncy5fanN2dG8gPSBwYXRoQmluZGluZ3MuX2pzdnRvIHx8IFtdKSA6IGJuZEN0eC5iZDtcblx0XHRcdFx0XHRpZiAodGhlT2IgPSBzdWJQYXRoICYmIGJpbmRzW2JpbmRzLmxlbmd0aC0xXSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoZU9iLl9qc3YpIHtcblx0XHRcdFx0XHRcdFx0d2hpbGUgKHRoZU9iLnNiKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhlT2IgPSB0aGVPYi5zYjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAodGhlT2IuYm5kKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGF0aCA9IFwiXlwiICsgcGF0aC5zbGljZSgxKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0aGVPYi5zYiA9IHBhdGg7XG5cdFx0XHRcdFx0XHRcdHRoZU9iLmJuZCA9IHRoZU9iLmJuZCB8fCBwYXRoLmNoYXJBdCgwKSA9PT0gXCJeXCI7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGJpbmRzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhdGhTdGFydFtwYXJlbkRlcHRoXSA9IGluZGV4ICsgKHN1YlBhdGggPyAxIDogMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBhbGxQYXRoO1xuXHRcdH1cblxuXHRcdC8vYm91bmQgPSBiaW5kaW5ncyAmJiBib3VuZDtcblx0XHRpZiAoYm91bmQgJiYgIWVxKSB7XG5cdFx0XHRwYXRoID0gYm91bmQgKyBwYXRoOyAvLyBlLmcuIHNvbWUuZm4oLi4uKV5zb21lLnBhdGggLSBzbyBoZXJlIHBhdGggaXMgXCJec29tZS5wYXRoXCJcblx0XHR9XG5cdFx0b3BlcmF0b3IgPSBvcGVyYXRvciB8fCBcIlwiO1xuXHRcdGxmdFBybiA9IGxmdFBybiB8fCBsZnRQcm4wIHx8IGxmdFBybjI7XG5cdFx0cGF0aCA9IHBhdGggfHwgcGF0aDI7XG5cdFx0Ly8gQ291bGQgZG8gdGhpcyAtIGJ1dCBub3Qgd29ydGggcGVyZiBjb3N0Pz8gOi1cblx0XHQvLyBpZiAoIXBhdGgubGFzdEluZGV4T2YoXCIjZGF0YS5cIiwgMCkpIHsgcGF0aCA9IHBhdGguc2xpY2UoNik7IH0gLy8gSWYgcGF0aCBzdGFydHMgd2l0aCBcIiNkYXRhLlwiLCByZW1vdmUgdGhhdC5cblx0XHRwcm4gPSBwcm4gfHwgcHJuMiB8fCBcIlwiO1xuXG5cdFx0dmFyIGV4cHIsIGV4cHJGbiwgYmluZHMsIHRoZU9iLCBuZXdPYixcblx0XHRcdHJ0U3EgPSBcIilcIjtcblxuXHRcdGlmIChwcm4gPT09IFwiW1wiKSB7XG5cdFx0XHRwcm4gID1cIltqLl9zcShcIjtcblx0XHRcdHJ0U3EgPSBcIildXCI7XG5cdFx0fVxuXG5cdFx0aWYgKGVyciAmJiAhYXBvc2VkICYmICFxdW90ZWQpIHtcblx0XHRcdHN5bnRheEVycm9yKHBhcmFtcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChiaW5kaW5ncyAmJiBydFBybkRvdCAmJiAhYXBvc2VkICYmICFxdW90ZWQpIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBhIGJpbmRpbmcgdG8gYSBwYXRoIGluIHdoaWNoIGFuIG9iamVjdCBpcyByZXR1cm5lZCBieSBhIGhlbHBlci9kYXRhIGZ1bmN0aW9uL2V4cHJlc3Npb24sIGUuZy4gZm9vKCleeC55IG9yIChhP2I6YyleeC55XG5cdFx0XHRcdC8vIFdlIGNyZWF0ZSBhIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIGdldCB0aGUgb2JqZWN0IGluc3RhbmNlICh3aGljaCB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBkZXBlbmRlbnQgZGF0YSBvZiB0aGUgc3ViZXhwcmVzc2lvbiBjaGFuZ2VzLCB0byByZXR1cm4gdGhlIG5ldyBvYmplY3QsIGFuZCB0cmlnZ2VyIHJlLWJpbmRpbmcgb2YgdGhlIHN1YnNlcXVlbnQgcGF0aClcblx0XHRcdFx0aWYgKCFuYW1lZCB8fCBib3VuZE5hbWUgfHwgYmluZHRvKSB7XG5cdFx0XHRcdFx0ZXhwciA9IHBhdGhTdGFydFtwYXJlbkRlcHRoIC0gMV07XG5cdFx0XHRcdFx0aWYgKGZ1bGwubGVuZ3RoIC0gMSA+IGluZGV4IC0gKGV4cHIgfHwgMCkpIHsgLy8gV2UgbmVlZCB0byBjb21waWxlIGEgc3ViZXhwcmVzc2lvblxuXHRcdFx0XHRcdFx0ZXhwciA9IGZ1bGwuc2xpY2UoZXhwciwgaW5kZXggKyBhbGwubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGlmIChleHByRm4gIT09IHRydWUpIHsgLy8gSWYgbm90IHJlZW50cmFudCBjYWxsIGR1cmluZyBjb21waWxhdGlvblxuXHRcdFx0XHRcdFx0XHRiaW5kcyA9IGJpbmR0byB8fCBibmRTdGFja1twYXJlbkRlcHRoLTFdLmJkO1xuXHRcdFx0XHRcdFx0XHQvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdFx0XHR0aGVPYiA9IGJpbmRzW2JpbmRzLmxlbmd0aC0xXTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iICYmIHRoZU9iLnBybSkge1xuXHRcdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYiAmJiB0aGVPYi5zYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdG5ld09iID0gdGhlT2Iuc2IgPSB7cGF0aDogdGhlT2Iuc2IsIGJuZDogdGhlT2IuYm5kfTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRiaW5kcy5wdXNoKG5ld09iID0ge3BhdGg6IGJpbmRzLnBvcCgpfSk7IC8vIEluc2VydCBleHByT2Igb2JqZWN0LCB0byBiZSB1c2VkIGR1cmluZyBiaW5kaW5nIHRvIHJldHVybiB0aGUgY29tcHV0ZWQgb2JqZWN0XG5cdFx0XHRcdFx0XHRcdH1cdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC8vIChlLmcuIFwic29tZS5vYmplY3QoKVwiIGluIFwic29tZS5vYmplY3QoKS5hLmJcIiAtIHRvIGJlIHVzZWQgYXMgY29udGV4dCBmb3IgYmluZGluZyB0aGUgZm9sbG93aW5nIHRva2VucyBcImEuYlwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cnRQcm5Eb3QgPSBkZWxpbU9wZW5DaGFyMSArIFwiOlwiICsgZXhwciAvLyBUaGUgcGFyYW1ldGVyIG9yIGZ1bmN0aW9uIHN1YmV4cHJlc3Npb25cblx0XHRcdFx0XHRcdFx0KyBcIiBvbmVycm9yPScnXCIgLy8gc2V0IG9uZXJyb3I9JycgaW4gb3JkZXIgdG8gd3JhcCBnZW5lcmF0ZWQgY29kZSB3aXRoIGEgdHJ5IGNhdGNoIC0gcmV0dXJuaW5nICcnIGFzIG9iamVjdCBpbnN0YW5jZSBpZiB0aGVyZSBpcyBhbiBlcnJvci9taXNzaW5nIHBhcmVudFxuXHRcdFx0XHRcdFx0XHQrIGRlbGltQ2xvc2VDaGFyMDtcblx0XHRcdFx0XHRcdGV4cHJGbiA9IHRtcGxMaW5rc1tydFBybkRvdF07XG5cdFx0XHRcdFx0XHRpZiAoIWV4cHJGbikge1xuXHRcdFx0XHRcdFx0XHR0bXBsTGlua3NbcnRQcm5Eb3RdID0gdHJ1ZTsgLy8gRmxhZyB0aGF0IHRoaXMgZXhwckZuIChmb3IgcnRQcm5Eb3QpIGlzIGJlaW5nIGNvbXBpbGVkXG5cdFx0XHRcdFx0XHRcdHRtcGxMaW5rc1tydFBybkRvdF0gPSBleHByRm4gPSB0bXBsRm4ocnRQcm5Eb3QsIHRtcGwsIHRydWUpOyAvLyBDb21waWxlIHRoZSBleHByZXNzaW9uIChvciB1c2UgY2FjaGVkIGNvcHkgYWxyZWFkeSBpbiB0bXBsLmxpbmtzKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGV4cHJGbiAhPT0gdHJ1ZSAmJiBuZXdPYikge1xuXHRcdFx0XHRcdFx0XHQvLyBJZiBub3QgcmVlbnRyYW50IGNhbGwgZHVyaW5nIGNvbXBpbGF0aW9uXG5cdFx0XHRcdFx0XHRcdG5ld09iLl9qc3YgPSBleHByRm47XG5cdFx0XHRcdFx0XHRcdG5ld09iLnBybSA9IGJuZEN0eC5iZDtcblx0XHRcdFx0XHRcdFx0bmV3T2IuYm5kID0gbmV3T2IuYm5kIHx8IG5ld09iLnBhdGggJiYgbmV3T2IucGF0aC5pbmRleE9mKFwiXlwiKSA+PSAwO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIChhcG9zZWRcblx0XHRcdFx0Ly8gd2l0aGluIHNpbmdsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHRcdD8gKGFwb3NlZCA9ICFhcG9zLCAoYXBvc2VkID8gYWxsIDogbGZ0UHJuMiArICdcIicpKVxuXHRcdFx0XHQ6IHF1b3RlZFxuXHRcdFx0XHQvLyB3aXRoaW4gZG91YmxlLXF1b3RlZCBzdHJpbmdcblx0XHRcdFx0XHQ/IChxdW90ZWQgPSAhcXVvdCwgKHF1b3RlZCA/IGFsbCA6IGxmdFBybjIgKyAnXCInKSlcblx0XHRcdFx0XHQ6XG5cdFx0XHRcdChcblx0XHRcdFx0XHQobGZ0UHJuXG5cdFx0XHRcdFx0XHQ/IChwYXRoU3RhcnRbcGFyZW5EZXB0aF0gPSBpbmRleCsrLCBibmRDdHggPSBibmRTdGFja1srK3BhcmVuRGVwdGhdID0ge2JkOiBbXX0sIGxmdFBybilcblx0XHRcdFx0XHRcdDogXCJcIilcblx0XHRcdFx0XHQrIChzcGFjZVxuXHRcdFx0XHRcdFx0PyAocGFyZW5EZXB0aFxuXHRcdFx0XHRcdFx0XHQ/IFwiXCJcblx0XHRcdFx0Ly8gTmV3IGFyZyBvciBwcm9wIC0gc28gaW5zZXJ0IGJhY2tzcGFjZSBcXGIgKFxceDA4KSBhcyBzZXBhcmF0b3IgZm9yIG5hbWVkIHBhcmFtcywgdXNlZCBzdWJzZXF1ZW50bHkgYnkgckJ1aWxkSGFzaCwgYW5kIHByZXBhcmUgbmV3IGJpbmRpbmdzIGFycmF5XG5cdFx0XHRcdFx0XHRcdDogKHBhcmFtSW5kZXggPSBmdWxsLnNsaWNlKHBhcmFtSW5kZXgsIGluZGV4KSwgbmFtZWRcblx0XHRcdFx0XHRcdFx0XHQ/IChuYW1lZCA9IGJvdW5kTmFtZSA9IGJpbmR0byA9IGZhbHNlLCBcIlxcYlwiKVxuXHRcdFx0XHRcdFx0XHRcdDogXCJcXGIsXCIpICsgcGFyYW1JbmRleCArIChwYXJhbUluZGV4ID0gaW5kZXggKyBhbGwubGVuZ3RoLCBiaW5kaW5ncyAmJiBwYXRoQmluZGluZ3MucHVzaChibmRDdHguYmQgPSBbXSksIFwiXFxiXCIpXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQ6IGVxXG5cdFx0XHRcdC8vIG5hbWVkIHBhcmFtLiBSZW1vdmUgYmluZGluZ3MgZm9yIGFyZyBhbmQgY3JlYXRlIGluc3RlYWQgYmluZGluZ3MgYXJyYXkgZm9yIHByb3Bcblx0XHRcdFx0XHRcdFx0PyAocGFyZW5EZXB0aCAmJiBzeW50YXhFcnJvcihwYXJhbXMpLCBiaW5kaW5ncyAmJiBwYXRoQmluZGluZ3MucG9wKCksIG5hbWVkID0gcGF0aCwgYm91bmROYW1lID0gYm91bmQsIHBhcmFtSW5kZXggPSBpbmRleCArIGFsbC5sZW5ndGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRiaW5kaW5ncyAmJiAoKGJpbmRpbmdzID0gYm5kQ3R4LmJkID0gcGF0aEJpbmRpbmdzW25hbWVkXSA9IFtdKSwgYmluZGluZ3Muc2twID0gIWJvdW5kKSwgcGF0aCArICc6Jylcblx0XHRcdFx0XHRcdFx0OiBwYXRoXG5cdFx0XHRcdC8vIHBhdGhcblx0XHRcdFx0XHRcdFx0XHQ/IChwYXRoLnNwbGl0KFwiXlwiKS5qb2luKFwiLlwiKS5yZXBsYWNlKHJQYXRoLCBwYXJzZVBhdGgpXG5cdFx0XHRcdFx0XHRcdFx0XHQrIChwcm5cblx0XHRcdFx0Ly8gc29tZS5mbmNhbGwoXG5cdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGJuZEN0eCA9IGJuZFN0YWNrWysrcGFyZW5EZXB0aF0gPSB7YmQ6IFtdfSwgZm5DYWxsW3BhcmVuRGVwdGhdID0gcnRTcSwgcHJuKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IG9wZXJhdG9yKVxuXHRcdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdFx0XHQ6IG9wZXJhdG9yXG5cdFx0XHRcdC8vIG9wZXJhdG9yXG5cdFx0XHRcdFx0XHRcdFx0XHQ/IG9wZXJhdG9yXG5cdFx0XHRcdFx0XHRcdFx0XHQ6IHJ0UHJuXG5cdFx0XHRcdC8vIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHRcdFx0XHRcdD8gKChydFBybiA9IGZuQ2FsbFtwYXJlbkRlcHRoXSB8fCBydFBybiwgZm5DYWxsW3BhcmVuRGVwdGhdID0gZmFsc2UsIGJuZEN0eCA9IGJuZFN0YWNrWy0tcGFyZW5EZXB0aF0sIHJ0UHJuKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgKHBybiAvLyBydFBybiBhbmQgcHJuLCBlLmcgKSggaW4gKGEpKCkgb3IgYSgpKCksIG9yIClbIGluIGEoKVtdXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IChibmRDdHggPSBibmRTdGFja1srK3BhcmVuRGVwdGhdLCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBydFNxLCBwcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IFwiXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdFx0XHRcdFx0OiBjb21tYVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGZuQ2FsbFtwYXJlbkRlcHRoXSB8fCBzeW50YXhFcnJvcihwYXJhbXMpLCBcIixcIikgLy8gV2UgZG9uJ3QgYWxsb3cgdG9wLWxldmVsIGxpdGVyYWwgYXJyYXlzIG9yIG9iamVjdHNcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGxmdFBybjBcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiAoYXBvc2VkID0gYXBvcywgcXVvdGVkID0gcXVvdCwgJ1wiJylcblx0XHRcdFx0KSlcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0dmFyIG5hbWVkLCBiaW5kdG8sIGJvdW5kTmFtZSxcblx0XHRxdW90ZWQsIC8vIGJvb2xlYW4gZm9yIHN0cmluZyBjb250ZW50IGluIGRvdWJsZSBxdW90ZXNcblx0XHRhcG9zZWQsIC8vIG9yIGluIHNpbmdsZSBxdW90ZXNcblx0XHRiaW5kaW5ncyA9IHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0sIC8vIGJpbmRpbmdzIGFycmF5IGZvciB0aGUgZmlyc3QgYXJnXG5cdFx0Ym5kQ3R4ID0ge2JkOiBiaW5kaW5nc30sXG5cdFx0Ym5kU3RhY2sgPSB7MDogYm5kQ3R4fSxcblx0XHRwYXJhbUluZGV4ID0gMCwgLy8gbGlzdCxcblx0XHR0bXBsTGlua3MgPSAodG1wbCA/IHRtcGwubGlua3MgOiBiaW5kaW5ncyAmJiAoYmluZGluZ3MubGlua3MgPSBiaW5kaW5ncy5saW5rcyB8fCB7fSkpIHx8IHRvcFZpZXcudG1wbC5saW5rcyxcblx0XHQvLyBUaGUgZm9sbG93aW5nIGFyZSB1c2VkIGZvciB0cmFja2luZyBwYXRoIHBhcnNpbmcgaW5jbHVkaW5nIG5lc3RlZCBwYXRocywgc3VjaCBhcyBcImEuYihjXmQgKyAoZSkpXmZcIiwgYW5kIGNoYWluZWQgY29tcHV0ZWQgcGF0aHMgc3VjaCBhc1xuXHRcdC8vIFwiYS5iKCkuY15kKCkuZS5mKCkuZ1wiIC0gd2hpY2ggaGFzIGZvdXIgY2hhaW5lZCBwYXRocywgXCJhLmIoKVwiLCBcIl5jLmQoKVwiLCBcIi5lLmYoKVwiIGFuZCBcIi5nXCJcblx0XHRwYXJlbkRlcHRoID0gMCxcblx0XHRmbkNhbGwgPSB7fSwgLy8gV2UgYXJlIGluIGEgZnVuY3Rpb24gY2FsbFxuXHRcdHBhdGhTdGFydCA9IHt9LCAvLyB0cmFja3MgdGhlIHN0YXJ0IG9mIHRoZSBjdXJyZW50IHBhdGggc3VjaCBhcyBjXmQoKSBpbiB0aGUgYWJvdmUgZXhhbXBsZVxuXHRcdHJlc3VsdCA9IChwYXJhbXMgKyAodG1wbCA/IFwiIFwiIDogXCJcIikpLnJlcGxhY2UoclBhcmFtcywgcGFyc2VUb2tlbnMpO1xuXG5cdHJldHVybiAhcGFyZW5EZXB0aCAmJiByZXN1bHQgfHwgc3ludGF4RXJyb3IocGFyYW1zKTsgLy8gU3ludGF4IGVycm9yIGlmIHVuYmFsYW5jZWQgcGFyZW5zIGluIHBhcmFtcyBleHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ29kZShhc3QsIHRtcGwsIGlzTGlua0V4cHIpIHtcblx0Ly8gQnVpbGQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGNvZGUgZnJvbSB0aGUgQVNUIG5vZGVzLCBhbmQgc2V0IGFzIHByb3BlcnR5IG9uIHRoZSBwYXNzZWQtaW4gdGVtcGxhdGUgb2JqZWN0XG5cdC8vIFVzZWQgZm9yIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGFuZCBhbHNvIGJ5IEpzVmlld3MgdG8gYnVpbGQgZnVuY3Rpb25zIGZvciBkYXRhIGxpbmsgZXhwcmVzc2lvbnNcblx0dmFyIGksIG5vZGUsIHRhZ05hbWUsIGNvbnZlcnRlciwgdGFnQ3R4LCBoYXNUYWcsIGhhc0VuY29kZXIsIGdldHNWYWwsIGhhc0NudnQsIHVzZUNudnQsIHRtcGxCaW5kaW5ncywgcGF0aEJpbmRpbmdzLCBwYXJhbXMsIGJvdW5kT25FcnJTdGFydCwgYm91bmRPbkVyckVuZCxcblx0XHR0YWdSZW5kZXIsIG5lc3RlZFRtcGxzLCB0bXBsTmFtZSwgbmVzdGVkVG1wbCwgdGFnQW5kRWxzZXMsIGNvbnRlbnQsIG1hcmt1cCwgbmV4dElzRWxzZSwgb2xkQ29kZSwgaXNFbHNlLCBpc0dldFZhbCwgdGFnQ3R4Rm4sIG9uRXJyb3IsIHRhZ1N0YXJ0LCB0cmlnZ2VyLFxuXHRcdHRtcGxCaW5kaW5nS2V5ID0gMCxcblx0XHR1c2VWaWV3cyA9ICRzdWJTZXR0aW5nc0FkdmFuY2VkLnVzZVZpZXdzIHx8IHRtcGwudXNlVmlld3MgfHwgdG1wbC50YWdzIHx8IHRtcGwudGVtcGxhdGVzIHx8IHRtcGwuaGVscGVycyB8fCB0bXBsLmNvbnZlcnRlcnMsXG5cdFx0Y29kZSA9IFwiXCIsXG5cdFx0dG1wbE9wdGlvbnMgPSB7fSxcblx0XHRsID0gYXN0Lmxlbmd0aDtcblxuXHRpZiAoXCJcIiArIHRtcGwgPT09IHRtcGwpIHtcblx0XHR0bXBsTmFtZSA9IGlzTGlua0V4cHIgPyAnZGF0YS1saW5rPVwiJyArIHRtcGwucmVwbGFjZShyTmV3TGluZSwgXCIgXCIpLnNsaWNlKDEsIC0xKSArICdcIicgOiB0bXBsO1xuXHRcdHRtcGwgPSAwO1xuXHR9IGVsc2Uge1xuXHRcdHRtcGxOYW1lID0gdG1wbC50bXBsTmFtZSB8fCBcInVubmFtZWRcIjtcblx0XHRpZiAodG1wbC5hbGxvd0NvZGUpIHtcblx0XHRcdHRtcGxPcHRpb25zLmFsbG93Q29kZSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICh0bXBsLmRlYnVnKSB7XG5cdFx0XHR0bXBsT3B0aW9ucy5kZWJ1ZyA9IHRydWU7XG5cdFx0fVxuXHRcdHRtcGxCaW5kaW5ncyA9IHRtcGwuYm5kcztcblx0XHRuZXN0ZWRUbXBscyA9IHRtcGwudG1wbHM7XG5cdH1cblx0Zm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuXHRcdC8vIEFTVCBub2RlczogWzA6IHRhZ05hbWUsIDE6IGNvbnZlcnRlciwgMjogY29udGVudCwgMzogcGFyYW1zLCA0OiBjb2RlLCA1OiBvbkVycm9yLCA2OiB0cmlnZ2VyLCA3OnBhdGhCaW5kaW5ncywgODogY29udGVudE1hcmt1cF1cblx0XHRub2RlID0gYXN0W2ldO1xuXG5cdFx0Ly8gQWRkIG5ld2xpbmUgZm9yIGVhY2ggY2FsbG91dCB0byB0KCkgYygpIGV0Yy4gYW5kIGVhY2ggbWFya3VwIHN0cmluZ1xuXHRcdGlmIChcIlwiICsgbm9kZSA9PT0gbm9kZSkge1xuXHRcdFx0Ly8gYSBtYXJrdXAgc3RyaW5nIHRvIGJlIGluc2VydGVkXG5cdFx0XHRjb2RlICs9ICdcXG4rXCInICsgbm9kZSArICdcIic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGEgY29tcGlsZWQgdGFnIGV4cHJlc3Npb24gdG8gYmUgaW5zZXJ0ZWRcblx0XHRcdHRhZ05hbWUgPSBub2RlWzBdO1xuXHRcdFx0aWYgKHRhZ05hbWUgPT09IFwiKlwiKSB7XG5cdFx0XHRcdC8vIENvZGUgdGFnOiB7eyogfX1cblx0XHRcdFx0Y29kZSArPSBcIjtcXG5cIiArIG5vZGVbMV0gKyBcIlxcbnJldD1yZXRcIjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnZlcnRlciA9IG5vZGVbMV07XG5cdFx0XHRcdGNvbnRlbnQgPSAhaXNMaW5rRXhwciAmJiBub2RlWzJdO1xuXHRcdFx0XHR0YWdDdHggPSBwYXJhbVN0cnVjdHVyZShub2RlWzNdLCAncGFyYW1zJykgKyAnfSwnICsgcGFyYW1TdHJ1Y3R1cmUocGFyYW1zID0gbm9kZVs0XSk7XG5cdFx0XHRcdG9uRXJyb3IgPSBub2RlWzVdO1xuXHRcdFx0XHR0cmlnZ2VyID0gbm9kZVs2XTtcblx0XHRcdFx0bWFya3VwID0gbm9kZVs4XSAmJiBub2RlWzhdLnJlcGxhY2UoclVuZXNjYXBlUXVvdGVzLCBcIiQxXCIpO1xuXHRcdFx0XHRpZiAoaXNFbHNlID0gdGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MucHVzaChub2RlWzddKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dG1wbEJpbmRpbmdLZXkgPSAwO1xuXHRcdFx0XHRcdGlmICh0bXBsQmluZGluZ3MgJiYgKHBhdGhCaW5kaW5ncyA9IG5vZGVbN10pKSB7IC8vIEFycmF5IG9mIHBhdGhzLCBvciBmYWxzZSBpZiBub3QgZGF0YS1ib3VuZFxuXHRcdFx0XHRcdFx0cGF0aEJpbmRpbmdzID0gW3BhdGhCaW5kaW5nc107XG5cdFx0XHRcdFx0XHR0bXBsQmluZGluZ0tleSA9IHRtcGxCaW5kaW5ncy5wdXNoKDEpOyAvLyBBZGQgcGxhY2Vob2xkZXIgaW4gdG1wbEJpbmRpbmdzIGZvciBjb21waWxlZCBmdW5jdGlvblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR1c2VWaWV3cyA9IHVzZVZpZXdzIHx8IHBhcmFtc1sxXSB8fCBwYXJhbXNbMl0gfHwgcGF0aEJpbmRpbmdzIHx8IC92aWV3Lig/IWluZGV4KS8udGVzdChwYXJhbXNbMF0pO1xuXHRcdFx0XHQvLyB1c2VWaWV3cyBpcyBmb3IgcGVyZiBvcHRpbWl6YXRpb24uIEZvciByZW5kZXIoKSB3ZSBvbmx5IHVzZSB2aWV3cyBpZiBuZWNlc3NhcnkgLSBmb3IgdGhlIG1vcmUgYWR2YW5jZWQgc2NlbmFyaW9zLlxuXHRcdFx0XHQvLyBXZSB1c2Ugdmlld3MgaWYgdGhlcmUgYXJlIHByb3BzLCBjb250ZXh0dWFsIHByb3BlcnRpZXMgb3IgYXJncyB3aXRoICMuLi4gKG90aGVyIHRoYW4gI2luZGV4KSAtIGJ1dCB5b3UgY2FuIGZvcmNlXG5cdFx0XHRcdC8vIHVzaW5nIHRoZSBmdWxsIHZpZXcgaW5mcmFzdHJ1Y3R1cmUsIChhbmQgcGF5IGEgcGVyZiBwcmljZSkgYnkgb3B0aW5nIGluOiBTZXQgdXNlVmlld3M6IHRydWUgb24gdGhlIHRlbXBsYXRlLCBtYW51YWxseS4uLlxuXHRcdFx0XHRpZiAoaXNHZXRWYWwgPSB0YWdOYW1lID09PSBcIjpcIikge1xuXHRcdFx0XHRcdGlmIChjb252ZXJ0ZXIpIHtcblx0XHRcdFx0XHRcdHRhZ05hbWUgPSBjb252ZXJ0ZXIgPT09IEhUTUwgPyBcIj5cIiA6IGNvbnZlcnRlciArIHRhZ05hbWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChjb250ZW50KSB7IC8vIFRPRE8gb3B0aW1pemUgLSBpZiBjb250ZW50Lmxlbmd0aCA9PT0gMCBvciBpZiB0aGVyZSBpcyBhIHRtcGw9XCIuLi5cIiBzcGVjaWZpZWQgLSBzZXQgY29udGVudCB0byBudWxsIC8gZG9uJ3QgcnVuIHRoaXMgY29tcGlsYXRpb24gY29kZSAtIHNpbmNlIGNvbnRlbnQgd29uJ3QgZ2V0IHVzZWQhIVxuXHRcdFx0XHRcdFx0Ly8gQ3JlYXRlIHRlbXBsYXRlIG9iamVjdCBmb3IgbmVzdGVkIHRlbXBsYXRlXG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBsID0gdG1wbE9iamVjdChtYXJrdXAsIHRtcGxPcHRpb25zKTtcblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwudG1wbE5hbWUgPSB0bXBsTmFtZSArIFwiL1wiICsgdGFnTmFtZTtcblx0XHRcdFx0XHRcdC8vIENvbXBpbGUgdG8gQVNUIGFuZCB0aGVuIHRvIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHRuZXN0ZWRUbXBsLnVzZVZpZXdzID0gbmVzdGVkVG1wbC51c2VWaWV3cyB8fCB1c2VWaWV3cztcblx0XHRcdFx0XHRcdGJ1aWxkQ29kZShjb250ZW50LCBuZXN0ZWRUbXBsKTtcblx0XHRcdFx0XHRcdHVzZVZpZXdzID0gbmVzdGVkVG1wbC51c2VWaWV3cztcblx0XHRcdFx0XHRcdG5lc3RlZFRtcGxzLnB1c2gobmVzdGVkVG1wbCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCFpc0Vsc2UpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgbm90IGFuIGVsc2UgdGFnLlxuXHRcdFx0XHRcdFx0dGFnQW5kRWxzZXMgPSB0YWdOYW1lO1xuXHRcdFx0XHRcdFx0dXNlVmlld3MgPSB1c2VWaWV3cyB8fCB0YWdOYW1lICYmICghJHRhZ3NbdGFnTmFtZV0gfHwgISR0YWdzW3RhZ05hbWVdLmZsb3cpO1xuXHRcdFx0XHRcdFx0Ly8gU3dpdGNoIHRvIGEgbmV3IGNvZGUgc3RyaW5nIGZvciB0aGlzIGJvdW5kIHRhZyAoYW5kIGl0cyBlbHNlcywgaWYgaXQgaGFzIGFueSkgLSBmb3IgcmV0dXJuaW5nIHRoZSB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0XHRvbGRDb2RlID0gY29kZTtcblx0XHRcdFx0XHRcdGNvZGUgPSBcIlwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXh0SXNFbHNlID0gYXN0W2kgKyAxXTtcblx0XHRcdFx0XHRuZXh0SXNFbHNlID0gbmV4dElzRWxzZSAmJiBuZXh0SXNFbHNlWzBdID09PSBcImVsc2VcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0YWdTdGFydCA9IG9uRXJyb3IgPyBcIjtcXG50cnl7XFxucmV0Kz1cIiA6IFwiXFxuK1wiO1xuXHRcdFx0XHRib3VuZE9uRXJyU3RhcnQgPSBcIlwiO1xuXHRcdFx0XHRib3VuZE9uRXJyRW5kID0gXCJcIjtcblxuXHRcdFx0XHRpZiAoaXNHZXRWYWwgJiYgKHBhdGhCaW5kaW5ncyB8fCB0cmlnZ2VyIHx8IGNvbnZlcnRlciAmJiBjb252ZXJ0ZXIgIT09IEhUTUwpKSB7XG5cdFx0XHRcdFx0Ly8gRm9yIGNvbnZlcnRWYWwgd2UgbmVlZCBhIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgbmV3IHRhZ0N0eChzKVxuXHRcdFx0XHRcdHRhZ0N0eEZuID0gbmV3IEZ1bmN0aW9uKFwiZGF0YSx2aWV3LGosdVwiLCBcIiAvLyBcIiArIHRtcGxOYW1lICsgXCIgXCIgKyB0bXBsQmluZGluZ0tleSArIFwiIFwiICsgdGFnTmFtZVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrIFwiXFxucmV0dXJuIHtcIiArIHRhZ0N0eCArIFwifTtcIik7XG5cdFx0XHRcdFx0dGFnQ3R4Rm4uX2VyID0gb25FcnJvcjtcblx0XHRcdFx0XHR0YWdDdHhGbi5fdGFnID0gdGFnTmFtZTtcblxuXHRcdFx0XHRcdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGFnQ3R4Rm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c2V0UGF0aHModGFnQ3R4Rm4sIHBhdGhCaW5kaW5ncyk7XG5cdFx0XHRcdFx0dGFnUmVuZGVyID0gJ2MoXCInICsgY29udmVydGVyICsgJ1wiLHZpZXcsJztcblx0XHRcdFx0XHR1c2VDbnZ0ID0gdHJ1ZTtcblx0XHRcdFx0XHRib3VuZE9uRXJyU3RhcnQgPSB0YWdSZW5kZXIgKyB0bXBsQmluZGluZ0tleSArIFwiLFwiO1xuXHRcdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIilcIjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb2RlICs9IChpc0dldFZhbFxuXHRcdFx0XHRcdD8gKGlzTGlua0V4cHIgPyAob25FcnJvciA/IFwidHJ5e1xcblwiIDogXCJcIikgKyBcInJldHVybiBcIiA6IHRhZ1N0YXJ0KSArICh1c2VDbnZ0IC8vIENhbGwgX2NudnQgaWYgdGhlcmUgaXMgYSBjb252ZXJ0ZXI6IHt7Y252dDogLi4uIH19IG9yIHtee2NudnQ6IC4uLiB9fVxuXHRcdFx0XHRcdFx0PyAodXNlQ252dCA9IHVuZGVmaW5lZCwgdXNlVmlld3MgPSBoYXNDbnZ0ID0gdHJ1ZSwgdGFnUmVuZGVyICsgKHBhdGhCaW5kaW5nc1xuXHRcdFx0XHRcdFx0XHQ/ICgodG1wbEJpbmRpbmdzW3RtcGxCaW5kaW5nS2V5IC0gMV0gPSB0YWdDdHhGbiksIHRtcGxCaW5kaW5nS2V5KSAvLyBTdG9yZSB0aGUgY29tcGlsZWQgdGFnQ3R4Rm4gaW4gdG1wbC5ibmRzLCBhbmQgcGFzcyB0aGUga2V5IHRvIGNvbnZlcnRWYWwoKVxuXHRcdFx0XHRcdFx0XHQ6IFwie1wiICsgdGFnQ3R4ICsgXCJ9XCIpICsgXCIpXCIpXG5cdFx0XHRcdFx0XHQ6IHRhZ05hbWUgPT09IFwiPlwiXG5cdFx0XHRcdFx0XHRcdD8gKGhhc0VuY29kZXIgPSB0cnVlLCBcImgoXCIgKyBwYXJhbXNbMF0gKyBcIilcIilcblx0XHRcdFx0XHRcdFx0OiAoZ2V0c1ZhbCA9IHRydWUsIFwiKCh2PVwiICsgcGFyYW1zWzBdICsgJykhPW51bGw/djonICsgKGlzTGlua0V4cHIgPyAnbnVsbCknIDogJ1wiXCIpJykpXG5cdFx0XHRcdFx0XHRcdC8vIE5vbiBzdHJpY3QgZXF1YWxpdHkgc28gZGF0YS1saW5rPVwidGl0bGV7OmV4cHJ9XCIgd2l0aCBleHByPW51bGwvdW5kZWZpbmVkIHJlbW92ZXMgdGl0bGUgYXR0cmlidXRlXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRcdDogKGhhc1RhZyA9IHRydWUsIFwiXFxue3ZpZXc6dmlldyx0bXBsOlwiIC8vIEFkZCB0aGlzIHRhZ0N0eCB0byB0aGUgY29tcGlsZWQgY29kZSBmb3IgdGhlIHRhZ0N0eHMgdG8gYmUgcGFzc2VkIHRvIHJlbmRlclRhZygpXG5cdFx0XHRcdFx0XHQrIChjb250ZW50ID8gbmVzdGVkVG1wbHMubGVuZ3RoIDogXCIwXCIpICsgXCIsXCIgLy8gRm9yIGJsb2NrIHRhZ3MsIHBhc3MgaW4gdGhlIGtleSAobmVzdGVkVG1wbHMubGVuZ3RoKSB0byB0aGUgbmVzdGVkIGNvbnRlbnQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdCsgdGFnQ3R4ICsgXCJ9LFwiKSk7XG5cblx0XHRcdFx0aWYgKHRhZ0FuZEVsc2VzICYmICFuZXh0SXNFbHNlKSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBpcyBhIGRhdGEtbGluayBleHByZXNzaW9uIG9yIGFuIGlubGluZSB0YWcgd2l0aG91dCBhbnkgZWxzZXMsIG9yIHRoZSBsYXN0IHt7ZWxzZX19IG9mIGFuIGlubGluZSB0YWdcblx0XHRcdFx0XHQvLyBXZSBjb21wbGV0ZSB0aGUgY29kZSBmb3IgcmV0dXJuaW5nIHRoZSB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0Y29kZSA9IFwiW1wiICsgY29kZS5zbGljZSgwLCAtMSkgKyBcIl1cIjtcblx0XHRcdFx0XHR0YWdSZW5kZXIgPSAndChcIicgKyB0YWdBbmRFbHNlcyArICdcIix2aWV3LHRoaXMsJztcblx0XHRcdFx0XHRpZiAoaXNMaW5rRXhwciB8fCBwYXRoQmluZGluZ3MpIHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBib3VuZCB0YWcgKGRhdGEtbGluayBleHByZXNzaW9uIG9yIGlubGluZSBib3VuZCB0YWcge157dGFnIC4uLn19KSBzbyB3ZSBzdG9yZSBhIGNvbXBpbGVkIHRhZ0N0eHMgZnVuY3Rpb24gaW4gdG1wLmJuZHNcblx0XHRcdFx0XHRcdGNvZGUgPSBuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsaix1XCIsIFwiIC8vIFwiICsgdG1wbE5hbWUgKyBcIiBcIiArIHRtcGxCaW5kaW5nS2V5ICsgXCIgXCIgKyB0YWdBbmRFbHNlcyArIFwiXFxucmV0dXJuIFwiICsgY29kZSArIFwiO1wiKTtcblx0XHRcdFx0XHRcdGNvZGUuX2VyID0gb25FcnJvcjtcblx0XHRcdFx0XHRcdGNvZGUuX3RhZyA9IHRhZ0FuZEVsc2VzO1xuXHRcdFx0XHRcdFx0aWYgKHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0XHRzZXRQYXRocyh0bXBsQmluZGluZ3NbdG1wbEJpbmRpbmdLZXkgLSAxXSA9IGNvZGUsIHBhdGhCaW5kaW5ncyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoaXNMaW5rRXhwcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY29kZTsgLy8gRm9yIGEgZGF0YS1saW5rIGV4cHJlc3Npb24gd2UgcmV0dXJuIHRoZSBjb21waWxlZCB0YWdDdHhzIGZ1bmN0aW9uXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRib3VuZE9uRXJyU3RhcnQgPSB0YWdSZW5kZXIgKyB0bXBsQmluZGluZ0tleSArIFwiLHVuZGVmaW5lZCxcIjtcblx0XHRcdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIilcIjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBUaGlzIGlzIHRoZSBsYXN0IHt7ZWxzZX19IGZvciBhbiBpbmxpbmUgdGFnLlxuXHRcdFx0XHRcdC8vIEZvciBhIGJvdW5kIHRhZywgcGFzcyB0aGUgdGFnQ3R4cyBmbiBsb29rdXAga2V5IHRvIHJlbmRlclRhZy5cblx0XHRcdFx0XHQvLyBGb3IgYW4gdW5ib3VuZCB0YWcsIGluY2x1ZGUgdGhlIGNvZGUgZGlyZWN0bHkgZm9yIGV2YWx1YXRpbmcgdGFnQ3R4cyBhcnJheVxuXHRcdFx0XHRcdGNvZGUgPSBvbGRDb2RlICsgdGFnU3RhcnQgKyB0YWdSZW5kZXIgKyAodG1wbEJpbmRpbmdLZXkgfHwgY29kZSkgKyBcIilcIjtcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSAwO1xuXHRcdFx0XHRcdHRhZ0FuZEVsc2VzID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob25FcnJvcikge1xuXHRcdFx0XHRcdHVzZVZpZXdzID0gdHJ1ZTtcblx0XHRcdFx0XHRjb2RlICs9ICc7XFxufWNhdGNoKGUpe3JldCcgKyAoaXNMaW5rRXhwciA/IFwidXJuIFwiIDogXCIrPVwiKSArIGJvdW5kT25FcnJTdGFydCArICdqLl9lcnIoZSx2aWV3LCcgKyBvbkVycm9yICsgJyknICsgYm91bmRPbkVyckVuZCArICc7fScgKyAoaXNMaW5rRXhwciA/IFwiXCIgOiAncmV0PXJldCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdC8vIEluY2x1ZGUgb25seSB0aGUgdmFyIHJlZmVyZW5jZXMgdGhhdCBhcmUgbmVlZGVkIGluIHRoZSBjb2RlXG5cdGNvZGUgPSBcIi8vIFwiICsgdG1wbE5hbWVcblxuXHRcdCsgXCJcXG52YXIgdlwiXG5cdFx0KyAoaGFzVGFnID8gXCIsdD1qLl90YWdcIiA6IFwiXCIpICAgICAgICAgICAgICAgIC8vIGhhcyB0YWdcblx0XHQrIChoYXNDbnZ0ID8gXCIsYz1qLl9jbnZ0XCIgOiBcIlwiKSAgICAgICAgICAgICAgLy8gY29udmVydGVyXG5cdFx0KyAoaGFzRW5jb2RlciA/IFwiLGg9ai5faHRtbFwiIDogXCJcIikgICAgICAgICAgIC8vIGh0bWwgY29udmVydGVyXG5cdFx0KyAoaXNMaW5rRXhwciA/IFwiO1xcblwiIDogJyxyZXQ9XCJcIlxcbicpXG5cdFx0KyAodG1wbE9wdGlvbnMuZGVidWcgPyBcImRlYnVnZ2VyO1wiIDogXCJcIilcblx0XHQrIGNvZGVcblx0XHQrIChpc0xpbmtFeHByID8gXCJcXG5cIiA6IFwiO1xcbnJldHVybiByZXQ7XCIpO1xuXG5cdGlmICgkc3ViU2V0dGluZ3MuZGVidWdNb2RlICE9PSBmYWxzZSkge1xuXHRcdGNvZGUgPSBcInRyeSB7XFxuXCIgKyBjb2RlICsgXCJcXG59Y2F0Y2goZSl7XFxucmV0dXJuIGouX2VycihlLCB2aWV3KTtcXG59XCI7XG5cdH1cblxuXHR0cnkge1xuXHRcdGNvZGUgPSBuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsaix1XCIsIGNvZGUpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0c3ludGF4RXJyb3IoXCJDb21waWxlZCB0ZW1wbGF0ZSBjb2RlOlxcblxcblwiICsgY29kZSArICdcXG46IFwiJyArIGUubWVzc2FnZSArICdcIicpO1xuXHR9XG5cdGlmICh0bXBsKSB7XG5cdFx0dG1wbC5mbiA9IGNvZGU7XG5cdFx0dG1wbC51c2VWaWV3cyA9ICEhdXNlVmlld3M7XG5cdH1cblx0cmV0dXJuIGNvZGU7XG59XG5cbi8vPT09PT09PT09PVxuLy8gVXRpbGl0aWVzXG4vLz09PT09PT09PT1cblxuLy8gTWVyZ2Ugb2JqZWN0cywgaW4gcGFydGljdWxhciBjb250ZXh0cyB3aGljaCBpbmhlcml0IGZyb20gcGFyZW50IGNvbnRleHRzXG5mdW5jdGlvbiBleHRlbmRDdHgoY29udGV4dCwgcGFyZW50Q29udGV4dCkge1xuXHQvLyBSZXR1cm4gY29weSBvZiBwYXJlbnRDb250ZXh0LCB1bmxlc3MgY29udGV4dCBpcyBkZWZpbmVkIGFuZCBpcyBkaWZmZXJlbnQsIGluIHdoaWNoIGNhc2UgcmV0dXJuIGEgbmV3IG1lcmdlZCBjb250ZXh0XG5cdC8vIElmIG5laXRoZXIgY29udGV4dCBub3IgcGFyZW50Q29udGV4dCBhcmUgZGVmaW5lZCwgcmV0dXJuIHVuZGVmaW5lZFxuXHRyZXR1cm4gY29udGV4dCAmJiBjb250ZXh0ICE9PSBwYXJlbnRDb250ZXh0XG5cdFx0PyAocGFyZW50Q29udGV4dFxuXHRcdFx0PyAkZXh0ZW5kKCRleHRlbmQoe30sIHBhcmVudENvbnRleHQpLCBjb250ZXh0KVxuXHRcdFx0OiBjb250ZXh0KVxuXHRcdDogcGFyZW50Q29udGV4dCAmJiAkZXh0ZW5kKHt9LCBwYXJlbnRDb250ZXh0KTtcbn1cblxuLy8gR2V0IGNoYXJhY3RlciBlbnRpdHkgZm9yIEhUTUwgYW5kIEF0dHJpYnV0ZSBlbmNvZGluZ1xuZnVuY3Rpb24gZ2V0Q2hhckVudGl0eShjaCkge1xuXHRyZXR1cm4gY2hhckVudGl0aWVzW2NoXSB8fCAoY2hhckVudGl0aWVzW2NoXSA9IFwiJiNcIiArIGNoLmNoYXJDb2RlQXQoMCkgKyBcIjtcIik7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFByb3BzKHNvdXJjZSkge1xuXHQvLyB0aGlzIHBvaW50ZXIgaXMgdGhlTWFwIC0gd2hpY2ggaGFzIHRhZ0N0eC5wcm9wcyB0b29cblx0Ly8gYXJndW1lbnRzOiB0YWdDdHguYXJncy5cblx0dmFyIGtleSwgcHJvcCxcblx0XHRwcm9wcyA9IFtdO1xuXG5cdGlmICh0eXBlb2Ygc291cmNlID09PSBPQkpFQ1QpIHtcblx0XHRmb3IgKGtleSBpbiBzb3VyY2UpIHtcblx0XHRcdHByb3AgPSBzb3VyY2Vba2V5XTtcblx0XHRcdGlmIChrZXkgIT09ICRleHBhbmRvICYmIHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICEkaXNGdW5jdGlvbihwcm9wKSkge1xuXHRcdFx0XHRwcm9wcy5wdXNoKHtrZXk6IGtleSwgcHJvcDogcHJvcH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gcHJvcHM7XG59XG5cbmZ1bmN0aW9uICRmblJlbmRlcihkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbikge1xuXHR2YXIgdG1wbEVsZW0gPSB0aGlzLmpxdWVyeSAmJiAodGhpc1swXSB8fCBlcnJvcignVW5rbm93biB0ZW1wbGF0ZScpKSwgLy8gVGFyZ2V0ZWQgZWxlbWVudCBub3QgZm91bmQgZm9yIGpRdWVyeSB0ZW1wbGF0ZSBzZWxlY3RvciBzdWNoIGFzIFwiI215VG1wbFwiXG5cdFx0dG1wbCA9IHRtcGxFbGVtLmdldEF0dHJpYnV0ZSh0bXBsQXR0cik7XG5cblx0cmV0dXJuIHJlbmRlckNvbnRlbnQuY2FsbCh0bXBsID8gJC5kYXRhKHRtcGxFbGVtKVtqc3ZUbXBsXSA6ICR0ZW1wbGF0ZXModG1wbEVsZW0pLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbik7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0ZXIgY29udmVydGVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiBodG1sRW5jb2RlKHRleHQpIHtcblx0Ly8gSFRNTCBlbmNvZGU6IFJlcGxhY2UgPCA+ICYgJyBhbmQgXCIgYnkgY29ycmVzcG9uZGluZyBlbnRpdGllcy5cblx0cmV0dXJuIHRleHQgIT0gdW5kZWZpbmVkID8gcklzSHRtbC50ZXN0KHRleHQpICYmIChcIlwiICsgdGV4dCkucmVwbGFjZShySHRtbEVuY29kZSwgZ2V0Q2hhckVudGl0eSkgfHwgdGV4dCA6IFwiXCI7XG59XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gSW5pdGlhbGl6ZSA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4kc3ViID0gJHZpZXdzLnN1YjtcbiR2aWV3c1NldHRpbmdzID0gJHZpZXdzLnNldHRpbmdzO1xuXG5pZiAoIShqc3IgfHwgJCAmJiAkLnJlbmRlcikpIHtcblx0Ly8gSnNSZW5kZXIgbm90IGFscmVhZHkgbG9hZGVkLCBvciBsb2FkZWQgd2l0aG91dCBqUXVlcnksIGFuZCB3ZSBhcmUgbm93IG1vdmluZyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXBhY2Vcblx0Zm9yIChqc3ZTdG9yZU5hbWUgaW4ganN2U3RvcmVzKSB7XG5cdFx0cmVnaXN0ZXJTdG9yZShqc3ZTdG9yZU5hbWUsIGpzdlN0b3Jlc1tqc3ZTdG9yZU5hbWVdKTtcblx0fVxuXG5cdCRjb252ZXJ0ZXJzID0gJHZpZXdzLmNvbnZlcnRlcnM7XG5cdCRoZWxwZXJzID0gJHZpZXdzLmhlbHBlcnM7XG5cdCR0YWdzID0gJHZpZXdzLnRhZ3M7XG5cblx0JHN1Yi5fdGcucHJvdG90eXBlID0ge1xuXHRcdGJhc2VBcHBseTogYmFzZUFwcGx5LFxuXHRcdGN2dEFyZ3M6IGNvbnZlcnRBcmdzXG5cdH07XG5cblx0dG9wVmlldyA9ICRzdWIudG9wVmlldyA9IG5ldyBWaWV3KCk7XG5cblx0Ly9CUk9XU0VSLVNQRUNJRklDIENPREVcblx0aWYgKCQpIHtcblxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSAoPSAkKSBpcyBsb2FkZWRcblxuXHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdGlmICgkLm9ic2VydmFibGUpIHtcblx0XHRcdCRleHRlbmQoJHN1YiwgJC52aWV3cy5zdWIpOyAvLyBqcXVlcnkub2JzZXJ2YWJsZS5qcyB3YXMgbG9hZGVkIGJlZm9yZSBqc3JlbmRlci5qc1xuXHRcdFx0JHZpZXdzLm1hcCA9ICQudmlld3MubWFwO1xuXHRcdH1cblxuXHR9IGVsc2Uge1xuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdC8vIGpRdWVyeSBpcyBub3QgbG9hZGVkLlxuXG5cdFx0JCA9IHt9O1xuXG5cdFx0aWYgKHNldEdsb2JhbHMpIHtcblx0XHRcdGdsb2JhbC5qc3JlbmRlciA9ICQ7IC8vIFdlIGFyZSBsb2FkaW5nIGpzcmVuZGVyLmpzIGZyb20gYSBzY3JpcHQgZWxlbWVudCwgbm90IEFNRCBvciBDb21tb25KUywgc28gc2V0IGdsb2JhbFxuXHRcdH1cblxuXHRcdC8vIEVycm9yIHdhcm5pbmcgaWYganNyZW5kZXIuanMgaXMgdXNlZCBhcyB0ZW1wbGF0ZSBlbmdpbmUgb24gTm9kZS5qcyAoZS5nLiBFeHByZXNzIG9yIEhhcGkuLi4pXG5cdFx0Ly8gVXNlIGpzcmVuZGVyLW5vZGUuanMgaW5zdGVhZC4uLlxuXHRcdCQucmVuZGVyRmlsZSA9ICQuX19leHByZXNzID0gJC5jb21waWxlID0gZnVuY3Rpb24oKSB7IHRocm93IFwiTm9kZS5qczogdXNlIG5wbSBqc3JlbmRlciwgb3IganNyZW5kZXItbm9kZS5qc1wiOyB9O1xuXG5cdFx0Ly9FTkQgQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdFx0JC5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2IpIHtcblx0XHRcdHJldHVybiB0eXBlb2Ygb2IgPT09IFwiZnVuY3Rpb25cIjtcblx0XHR9O1xuXG5cdFx0JC5pc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcblx0XHRcdHJldHVybiAoe30udG9TdHJpbmcpLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiO1xuXHRcdH07XG5cblx0XHQkc3ViLl9qcSA9IGZ1bmN0aW9uKGpxKSB7IC8vIHByaXZhdGUgbWV0aG9kIHRvIG1vdmUgZnJvbSBKc1JlbmRlciBBUElzIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdGlmIChqcSAhPT0gJCkge1xuXHRcdFx0XHQkZXh0ZW5kKGpxLCAkKTsgLy8gbWFwIG92ZXIgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVzcGFjZVxuXHRcdFx0XHQkID0ganE7XG5cdFx0XHRcdCQuZm4ucmVuZGVyID0gJGZuUmVuZGVyO1xuXHRcdFx0XHRkZWxldGUgJC5qc3JlbmRlcjtcblx0XHRcdFx0JGV4cGFuZG8gPSAkLmV4cGFuZG87XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdCQuanNyZW5kZXIgPSB2ZXJzaW9uTnVtYmVyO1xuXHR9XG5cdCRzdWJTZXR0aW5ncyA9ICRzdWIuc2V0dGluZ3M7XG5cdCRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgPSBmYWxzZTtcblx0JGlzRnVuY3Rpb24gPSAkLmlzRnVuY3Rpb247XG5cdCQucmVuZGVyID0gJHJlbmRlcjtcblx0JC52aWV3cyA9ICR2aWV3cztcblx0JC50ZW1wbGF0ZXMgPSAkdGVtcGxhdGVzID0gJHZpZXdzLnRlbXBsYXRlcztcblxuXHRmb3IgKHNldHRpbmcgaW4gJHN1YlNldHRpbmdzKSB7XG5cdFx0YWRkU2V0dGluZyhzZXR0aW5nKTtcblx0fVxuXG5cdCgkdmlld3NTZXR0aW5ncy5kZWJ1Z01vZGUgPSBmdW5jdGlvbihkZWJ1Z01vZGUpIHtcblx0XHRyZXR1cm4gZGVidWdNb2RlID09PSB1bmRlZmluZWRcblx0XHRcdD8gJHN1YlNldHRpbmdzLmRlYnVnTW9kZVxuXHRcdFx0OiAoXG5cdFx0XHRcdCRzdWJTZXR0aW5ncy5kZWJ1Z01vZGUgPSBkZWJ1Z01vZGUsXG5cdFx0XHRcdCRzdWJTZXR0aW5ncy5vbkVycm9yID0gZGVidWdNb2RlICsgXCJcIiA9PT0gZGVidWdNb2RlXG5cdFx0XHRcdFx0PyBuZXcgRnVuY3Rpb24oXCJcIiwgXCJyZXR1cm4gJ1wiICsgZGVidWdNb2RlICsgXCInO1wiIClcblx0XHRcdFx0XHQ6ICRpc0Z1bmN0aW9uKGRlYnVnTW9kZSlcblx0XHRcdFx0XHRcdD8gZGVidWdNb2RlXG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0JHZpZXdzU2V0dGluZ3MpO1xuXHR9KShmYWxzZSk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuXG5cdCRzdWJTZXR0aW5nc0FkdmFuY2VkID0gJHN1YlNldHRpbmdzLmFkdmFuY2VkID0ge1xuXHRcdHVzZVZpZXdzOiBmYWxzZSxcblx0XHRfanN2OiBmYWxzZSAvLyBGb3IgZ2xvYmFsIGFjY2VzcyB0byBKc1ZpZXdzIHN0b3JlXG5cdH07XG5cblx0Ly89PT09PT09PT09PT09PT09PT09PT09PT09PSBSZWdpc3RlciB0YWdzID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblx0JHRhZ3Moe1xuXHRcdFwiaWZcIjoge1xuXHRcdFx0cmVuZGVyOiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0Ly8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgb25jZSBmb3Ige3tpZn19IGFuZCBvbmNlIGZvciBlYWNoIHt7ZWxzZX19LlxuXHRcdFx0XHQvLyBXZSB3aWxsIHVzZSB0aGUgdGFnLnJlbmRlcmluZyBvYmplY3QgZm9yIGNhcnJ5aW5nIHJlbmRlcmluZyBzdGF0ZSBhY3Jvc3MgdGhlIGNhbGxzLlxuXHRcdFx0XHQvLyBJZiBub3QgZG9uZSAoYSBwcmV2aW91cyBibG9jayBoYXMgbm90IGJlZW4gcmVuZGVyZWQpLCBsb29rIGF0IGV4cHJlc3Npb24gZm9yIHRoaXMgYmxvY2sgYW5kIHJlbmRlciB0aGUgYmxvY2sgaWYgZXhwcmVzc2lvbiBpcyB0cnV0aHlcblx0XHRcdFx0Ly8gT3RoZXJ3aXNlIHJldHVybiBcIlwiXG5cdFx0XHRcdHZhciBzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyZXQgPSAoc2VsZi5yZW5kZXJpbmcuZG9uZSB8fCAhdmFsICYmIChhcmd1bWVudHMubGVuZ3RoIHx8ICF0YWdDdHguaW5kZXgpKVxuXHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHQ6IChzZWxmLnJlbmRlcmluZy5kb25lID0gdHJ1ZSwgc2VsZi5zZWxlY3RlZCA9IHRhZ0N0eC5pbmRleCxcblx0XHRcdFx0XHRcdFx0Ly8gVGVzdCBpcyBzYXRpc2ZpZWQsIHNvIHJlbmRlciBjb250ZW50IG9uIGN1cnJlbnQgY29udGV4dC4gV2UgY2FsbCB0YWdDdHgucmVuZGVyKCkgcmF0aGVyIHRoYW4gcmV0dXJuIHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHQvLyAod2hpY2ggd291bGQgYWxzbyByZW5kZXIgdGhlIHRtcGwvY29udGVudCBvbiB0aGUgY3VycmVudCBjb250ZXh0IGJ1dCB3b3VsZCBpdGVyYXRlIGlmIGl0IGlzIGFuIGFycmF5KVxuXHRcdFx0XHRcdFx0XHR0YWdDdHgucmVuZGVyKHRhZ0N0eC52aWV3LCB0cnVlKSk7IC8vIG5vIGFyZywgc28gcmVuZGVycyBhZ2FpbnN0IHBhcmVudFZpZXcuZGF0YVxuXHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0fSxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiZm9yXCI6IHtcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIHt7Zm9yfX0gYW5kIG9uY2UgZm9yIGVhY2gge3tlbHNlfX0uXG5cdFx0XHRcdC8vIFdlIHdpbGwgdXNlIHRoZSB0YWcucmVuZGVyaW5nIG9iamVjdCBmb3IgY2FycnlpbmcgcmVuZGVyaW5nIHN0YXRlIGFjcm9zcyB0aGUgY2FsbHMuXG5cdFx0XHRcdHZhciBmaW5hbEVsc2UgPSAhYXJndW1lbnRzLmxlbmd0aCxcblx0XHRcdFx0XHR2YWx1ZSxcblx0XHRcdFx0XHRzZWxmID0gdGhpcyxcblx0XHRcdFx0XHR0YWdDdHggPSBzZWxmLnRhZ0N0eCxcblx0XHRcdFx0XHRyZXN1bHQgPSBcIlwiLFxuXHRcdFx0XHRcdGRvbmUgPSAwO1xuXG5cdFx0XHRcdGlmICghc2VsZi5yZW5kZXJpbmcuZG9uZSkge1xuXHRcdFx0XHRcdHZhbHVlID0gZmluYWxFbHNlID8gdGFnQ3R4LnZpZXcuZGF0YSA6IHZhbDsgLy8gRm9yIHRoZSBmaW5hbCBlbHNlLCBkZWZhdWx0cyB0byBjdXJyZW50IGRhdGEgd2l0aG91dCBpdGVyYXRpb24uXG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdCArPSB0YWdDdHgucmVuZGVyKHZhbHVlLCBmaW5hbEVsc2UpOyAvLyBJdGVyYXRlcyBleGNlcHQgb24gZmluYWwgZWxzZSwgaWYgZGF0YSBpcyBhbiBhcnJheS4gKFVzZSB7e2luY2x1ZGV9fSB0byBjb21wb3NlIHRlbXBsYXRlcyB3aXRob3V0IGFycmF5IGl0ZXJhdGlvbilcblx0XHRcdFx0XHRcdGRvbmUgKz0gJGlzQXJyYXkodmFsdWUpID8gdmFsdWUubGVuZ3RoIDogMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHNlbGYucmVuZGVyaW5nLmRvbmUgPSBkb25lKSB7XG5cdFx0XHRcdFx0XHRzZWxmLnNlbGVjdGVkID0gdGFnQ3R4LmluZGV4O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBJZiBub3RoaW5nIHdhcyByZW5kZXJlZCB3ZSB3aWxsIGxvb2sgYXQgdGhlIG5leHQge3tlbHNlfX0uIE90aGVyd2lzZSwgd2UgYXJlIGRvbmUuXG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0sXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRwcm9wczoge1xuXHRcdFx0YmFzZVRhZzogXCJmb3JcIixcblx0XHRcdGRhdGFNYXA6IGRhdGFNYXAoZ2V0VGFyZ2V0UHJvcHMpLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0aW5jbHVkZToge1xuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0XCIqXCI6IHtcblx0XHRcdC8vIHt7KiBjb2RlLi4uIH19IC0gSWdub3JlZCBpZiB0ZW1wbGF0ZS5hbGxvd0NvZGUgYW5kICQudmlld3Muc2V0dGluZ3MuYWxsb3dDb2RlIGFyZSBmYWxzZS4gT3RoZXJ3aXNlIGluY2x1ZGUgY29kZSBpbiBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0cmVuZGVyOiByZXRWYWwsXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcIjoqXCI6IHtcblx0XHRcdC8vIHt7OiogcmV0dXJuZWRFeHByZXNzaW9uIH19IC0gSWdub3JlZCBpZiB0ZW1wbGF0ZS5hbGxvd0NvZGUgYW5kICQudmlld3Muc2V0dGluZ3MuYWxsb3dDb2RlIGFyZSBmYWxzZS4gT3RoZXJ3aXNlIGluY2x1ZGUgY29kZSBpbiBjb21waWxlZCB0ZW1wbGF0ZVxuXHRcdFx0cmVuZGVyOiByZXRWYWwsXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRkYmc6ICRoZWxwZXJzLmRiZyA9ICRjb252ZXJ0ZXJzLmRiZyA9IGRiZ0JyZWFrIC8vIFJlZ2lzdGVyIHt7ZGJnL319LCB7e2RiZzouLi59fSBhbmQgfmRiZygpIHRvIHRocm93IGFuZCBjYXRjaCwgYXMgYnJlYWtwb2ludHMgZm9yIGRlYnVnZ2luZy5cblx0fSk7XG5cblx0JGNvbnZlcnRlcnMoe1xuXHRcdGh0bWw6IGh0bWxFbmNvZGUsXG5cdFx0YXR0cjogaHRtbEVuY29kZSwgLy8gSW5jbHVkZXMgPiBlbmNvZGluZyBzaW5jZSByQ29udmVydE1hcmtlcnMgaW4gSnNWaWV3cyBkb2VzIG5vdCBza2lwID4gY2hhcmFjdGVycyBpbiBhdHRyaWJ1dGUgc3RyaW5nc1xuXHRcdHVybDogZnVuY3Rpb24odGV4dCkge1xuXHRcdFx0Ly8gVVJMIGVuY29kaW5nIGhlbHBlci5cblx0XHRcdHJldHVybiB0ZXh0ICE9IHVuZGVmaW5lZCA/IGVuY29kZVVSSShcIlwiICsgdGV4dCkgOiB0ZXh0ID09PSBudWxsID8gdGV4dCA6IFwiXCI7IC8vIG51bGwgcmV0dXJucyBudWxsLCBlLmcuIHRvIHJlbW92ZSBhdHRyaWJ1dGUuIHVuZGVmaW5lZCByZXR1cm5zIFwiXCJcblx0XHR9XG5cdH0pO1xufVxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBEZWZpbmUgZGVmYXVsdCBkZWxpbWl0ZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09XG4kc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuJGlzQXJyYXkgPSAoJHx8anNyKS5pc0FycmF5O1xuJHZpZXdzU2V0dGluZ3MuZGVsaW1pdGVycyhcInt7XCIsIFwifX1cIiwgXCJeXCIpO1xuXG5pZiAoanNyVG9KcSkgeyAvLyBNb3ZpbmcgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVwYWNlIC0gY29weSBvdmVyIHRoZSBzdG9yZWQgaXRlbXMgKHRlbXBsYXRlcywgY29udmVydGVycywgaGVscGVycy4uLilcblx0anNyLnZpZXdzLnN1Yi5fanEoJCk7XG59XG5yZXR1cm4gJCB8fCBqc3I7XG59LCB3aW5kb3cpKTtcbiIsIi8qZ2xvYmFsIFFVbml0LCB0ZXN0LCBlcXVhbCwgb2sqL1xuKGZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbmJyb3dzZXJpZnkuZG9uZS50d2VsdmUgPSB0cnVlO1xuXG5RVW5pdC5tb2R1bGUoXCJCcm93c2VyaWZ5IC0gY2xpZW50IGNvZGVcIik7XG5cbnZhciBpc0lFOCA9IHdpbmRvdy5hdHRhY2hFdmVudCAmJiAhd2luZG93LmFkZEV2ZW50TGlzdGVuZXI7XG5cbmlmICghaXNJRTgpIHtcblxudGVzdChcIk5vIGpRdWVyeSBnbG9iYWw6IHJlcXVpcmUoJ2pzcmVuZGVyJykoKSBuZXN0ZWQgdGVtcGxhdGVcIiwgZnVuY3Rpb24oKSB7XG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gSGlkZSBRVW5pdCBnbG9iYWwgalF1ZXJ5IGFuZCBhbnkgcHJldmlvdXMgZ2xvYmFsIGpzcmVuZGVyLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdHZhciBqUXVlcnkgPSBnbG9iYWwualF1ZXJ5LCBqc3IgPSBnbG9iYWwuanNyZW5kZXI7XG5cdGdsb2JhbC5qUXVlcnkgPSBnbG9iYWwuanNyZW5kZXIgPSB1bmRlZmluZWQ7XG5cblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBBcnJhbmdlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0dmFyIGRhdGEgPSB7bmFtZTogXCJKb1wifTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBY3QgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHR2YXIganNyZW5kZXIgPSByZXF1aXJlKCcuLi8uLi8nKSgpOyAvLyBOb3QgcGFzc2luZyBpbiBqUXVlcnksIHNvIHJldHVybnMgdGhlIGpzcmVuZGVyIG5hbWVzcGFjZVxuXG5cdC8vIFVzZSByZXF1aXJlIHRvIGdldCBzZXJ2ZXIgdGVtcGxhdGUsIHRoYW5rcyB0byBCcm93c2VyaWZ5IGJ1bmRsZSB0aGF0IHVzZWQganNyZW5kZXIvdG1wbGlmeSB0cmFuc2Zvcm1cblx0dmFyIHRtcGwgPSByZXF1aXJlKCcuLi90ZW1wbGF0ZXMvb3V0ZXIuaHRtbCcpKGpzcmVuZGVyKTsgLy8gUHJvdmlkZSBqc3JlbmRlclxuXG5cdHZhciByZXN1bHQgPSB0bXBsKGRhdGEpO1xuXG5cdHJlc3VsdCArPSBcIiBcIiArIChqc3JlbmRlciAhPT0galF1ZXJ5KTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uIEFzc2VydCAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cblx0ZXF1YWwocmVzdWx0LCBcIk5hbWU6IEpvIChvdXRlci5odG1sKSBOYW1lOiBKbyAoaW5uZXIuaHRtbCkgdHJ1ZVwiLCBcInJlc3VsdDogTm8galF1ZXJ5IGdsb2JhbDogcmVxdWlyZSgnanNyZW5kZXInKSgpLCBuZXN0ZWQgdGVtcGxhdGVzXCIpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gUmVzZXQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGdsb2JhbC5qUXVlcnkgPSBqUXVlcnk7IC8vIFJlcGxhY2UgUVVuaXQgZ2xvYmFsIGpRdWVyeVxuXHRnbG9iYWwuanNyZW5kZXIgPSBqc3I7IC8vIFJlcGxhY2UgYW55IHByZXZpb3VzIGdsb2JhbCBqc3JlbmRlclxufSk7XG59XG59KSgpO1xuIiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChpbm5lci5odG1sKScsXG4gICQgPSBnbG9iYWwuanNyZW5kZXIgfHwgZ2xvYmFsLmpRdWVyeTtcblxubW9kdWxlLmV4cG9ydHMgPSAkID8gJC50ZW1wbGF0ZXMoXCIuL3Rlc3QvdGVtcGxhdGVzL2lubmVyLmh0bWxcIiwgbWt1cCkgOlxuICBmdW5jdGlvbigkKSB7XG4gICAgaWYgKCEkIHx8ICEkLnZpZXdzKSB7dGhyb3cgXCJSZXF1aXJlcyBqc3JlbmRlci9qUXVlcnlcIjt9XG4gICAgd2hpbGUgKHRtcGxSZWZzLmxlbmd0aCkge1xuICAgICAgdG1wbFJlZnMucG9wKCkoJCk7IC8vIGNvbXBpbGUgbmVzdGVkIHRlbXBsYXRlXG4gICAgfVxuXG4gICAgcmV0dXJuICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9pbm5lci5odG1sXCIsIG1rdXApXG4gIH07IiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChvdXRlci5odG1sKSB7e2luY2x1ZGUgdG1wbD1cXFwiLi90ZXN0L3RlbXBsYXRlcy9pbm5lci5odG1sXFxcIi99fScsXG4gICQgPSBnbG9iYWwuanNyZW5kZXIgfHwgZ2xvYmFsLmpRdWVyeTtcblxudG1wbFJlZnMucHVzaChyZXF1aXJlKFwiLi9pbm5lci5odG1sXCIpKTtcbm1vZHVsZS5leHBvcnRzID0gJCA/ICQudGVtcGxhdGVzKFwiLi90ZXN0L3RlbXBsYXRlcy9vdXRlci5odG1sXCIsIG1rdXApIDpcbiAgZnVuY3Rpb24oJCkge1xuICAgIGlmICghJCB8fCAhJC52aWV3cykge3Rocm93IFwiUmVxdWlyZXMganNyZW5kZXIvalF1ZXJ5XCI7fVxuICAgIHdoaWxlICh0bXBsUmVmcy5sZW5ndGgpIHtcbiAgICAgIHRtcGxSZWZzLnBvcCgpKCQpOyAvLyBjb21waWxlIG5lc3RlZCB0ZW1wbGF0ZVxuICAgIH1cblxuICAgIHJldHVybiAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvb3V0ZXIuaHRtbFwiLCBta3VwKVxuICB9OyJdfQ==
