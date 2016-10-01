(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! JsRender v0.9.81 (Beta): http://jsviews.com/#jsrender */
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

var versionNumber = "v0.9.81",
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
		if (isContextCb) { // In a context callback for a contextual param, return the [currentData, dependencies...] array - needed for observe call
			deps = $sub._ceo(res[1].deps);  // fn deps, with any exprObs cloned
			deps.unshift(res[0].data);      // view.data
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
	var tag, tag_, tagDef, template, tags, attr, parentTag, i, l, itemRet, tagCtx, tagCtxCtx, content, callInit, mapDef, thisMap, args, props, initialTmpl, tagDataMap,
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
				itemRet = tagCtx.render(args[0], true) || (isUpdate ? undefined : "");
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
		if (!view && data && data._is === "view") {
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
				|| new View(context, "array", view, data, tmpl, key, onRender);
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
			childView = new View(newCtx, "item", newView, data[i], tmpl, (key || 0) + i, onRender, contentTmpl);

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
	for (; i < l; i++) {
		paths = pathsArr[i];
		for (key in paths) {
			if (key !== "_jsvto" && paths.hasOwnProperty(key) && paths[key].length) {
				fn.deps = fn.deps.concat(paths[key]); // deps is the concatenation of the paths arrays for the different bindings
			}
		}
	}
	fn.paths = paths; // The array of paths arrays for the different bindings
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
							? (parenDepth && syntaxError(params), bindings && pathBindings.pop(), named = path, boundName = bound, paramIndex = index + all.length, bound && (bindings = bndCtx.bd = pathBindings[named] = []), path + ':')
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
	var tmplElem = this.jquery && (this[0] || error('Unknown template: "' + this.selector + '"')),
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqc3JlbmRlci5qcyIsInRlc3QvYnJvd3NlcmlmeS8xLXVuaXQtdGVzdHMuanMiLCJ0ZXN0L3RlbXBsYXRlcy9uYW1lLXRlbXBsYXRlLmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdnlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIEpzUmVuZGVyIHYwLjkuODEgKEJldGEpOiBodHRwOi8vanN2aWV3cy5jb20vI2pzcmVuZGVyICovXG4vKiEgKipWRVJTSU9OIEZPUiBXRUIqKiAoRm9yIE5PREUuSlMgc2VlIGh0dHA6Ly9qc3ZpZXdzLmNvbS9kb3dubG9hZC9qc3JlbmRlci1ub2RlLmpzKSAqL1xuLypcbiAqIEJlc3Qtb2YtYnJlZWQgdGVtcGxhdGluZyBpbiBicm93c2VyIG9yIG9uIE5vZGUuanMuXG4gKiBEb2VzIG5vdCByZXF1aXJlIGpRdWVyeSwgb3IgSFRNTCBET01cbiAqIEludGVncmF0ZXMgd2l0aCBKc1ZpZXdzIChodHRwOi8vanN2aWV3cy5jb20vI2pzdmlld3MpXG4gKlxuICogQ29weXJpZ2h0IDIwMTYsIEJvcmlzIE1vb3JlXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cblxuLy9qc2hpbnQgLVcwMTgsIC1XMDQxXG5cbihmdW5jdGlvbihmYWN0b3J5LCBnbG9iYWwpIHtcblx0Ly8gZ2xvYmFsIHZhciBpcyB0aGUgdGhpcyBvYmplY3QsIHdoaWNoIGlzIHdpbmRvdyB3aGVuIHJ1bm5pbmcgaW4gdGhlIHVzdWFsIGJyb3dzZXIgZW52aXJvbm1lbnRcblx0dmFyICQgPSBnbG9iYWwualF1ZXJ5O1xuXG5cdGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIikgeyAvLyBDb21tb25KUyBlLmcuIEJyb3dzZXJpZnlcblx0XHRtb2R1bGUuZXhwb3J0cyA9ICRcblx0XHRcdD8gZmFjdG9yeShnbG9iYWwsICQpXG5cdFx0XHQ6IGZ1bmN0aW9uKCQpIHsgLy8gSWYgbm8gZ2xvYmFsIGpRdWVyeSwgdGFrZSBvcHRpb25hbCBqUXVlcnkgcGFzc2VkIGFzIHBhcmFtZXRlcjogcmVxdWlyZSgnanNyZW5kZXInKShqUXVlcnkpXG5cdFx0XHRcdGlmICgkICYmICEkLmZuKSB7XG5cdFx0XHRcdFx0dGhyb3cgXCJQcm92aWRlIGpRdWVyeSBvciBudWxsXCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsLCAkKTtcblx0XHRcdH07XG5cdH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHsgLy8gQU1EIHNjcmlwdCBsb2FkZXIsIGUuZy4gUmVxdWlyZUpTXG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGZhY3RvcnkoZ2xvYmFsKTtcblx0XHR9KTtcblx0fSBlbHNlIHsgLy8gQnJvd3NlciB1c2luZyBwbGFpbiA8c2NyaXB0PiB0YWdcblx0XHRmYWN0b3J5KGdsb2JhbCwgZmFsc2UpO1xuXHR9XG59IChcblxuLy8gZmFjdG9yeSAoZm9yIGpzcmVuZGVyLmpzKVxuZnVuY3Rpb24oZ2xvYmFsLCAkKSB7XG5cInVzZSBzdHJpY3RcIjtcblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PSBUb3AtbGV2ZWwgdmFycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBnbG9iYWwgdmFyIGlzIHRoZSB0aGlzIG9iamVjdCwgd2hpY2ggaXMgd2luZG93IHdoZW4gcnVubmluZyBpbiB0aGUgdXN1YWwgYnJvd3NlciBlbnZpcm9ubWVudFxudmFyIHNldEdsb2JhbHMgPSAkID09PSBmYWxzZTsgLy8gT25seSBzZXQgZ2xvYmFscyBpZiBzY3JpcHQgYmxvY2sgaW4gYnJvd3NlciAobm90IEFNRCBhbmQgbm90IENvbW1vbkpTKVxuXG4kID0gJCAmJiAkLmZuID8gJCA6IGdsb2JhbC5qUXVlcnk7IC8vICQgaXMgalF1ZXJ5IHBhc3NlZCBpbiBieSBDb21tb25KUyBsb2FkZXIgKEJyb3dzZXJpZnkpLCBvciBnbG9iYWwgalF1ZXJ5LlxuXG52YXIgdmVyc2lvbk51bWJlciA9IFwidjAuOS44MVwiLFxuXHRqc3ZTdG9yZU5hbWUsIHJUYWcsIHJUbXBsU3RyaW5nLCB0b3BWaWV3LCAkdmlld3MsXHQkZXhwYW5kbyxcblxuLy9UT0RPXHR0bXBsRm5zQ2FjaGUgPSB7fSxcblx0JGlzRnVuY3Rpb24sICRpc0FycmF5LCAkdGVtcGxhdGVzLCAkY29udmVydGVycywgJGhlbHBlcnMsICR0YWdzLCAkc3ViLCAkc3ViU2V0dGluZ3MsICRzdWJTZXR0aW5nc0FkdmFuY2VkLCAkdmlld3NTZXR0aW5ncywgZGVsaW1PcGVuQ2hhcjAsIGRlbGltT3BlbkNoYXIxLCBkZWxpbUNsb3NlQ2hhcjAsIGRlbGltQ2xvc2VDaGFyMSwgbGlua0NoYXIsIHNldHRpbmcsIGJhc2VPbkVycm9yLFxuXG5cdHJQYXRoID0gL14oISo/KSg/Om51bGx8dHJ1ZXxmYWxzZXxcXGRbXFxkLl0qfChbXFx3JF0rfFxcLnx+KFtcXHckXSspfCModmlld3woW1xcdyRdKykpPykoW1xcdyQuXl0qPykoPzpbLlteXShbXFx3JF0rKVxcXT8pPykkL2csXG5cdC8vICAgICAgICBub3QgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ICAgICBoZWxwZXIgICAgdmlldyAgdmlld1Byb3BlcnR5IHBhdGhUb2tlbnMgICAgICBsZWFmVG9rZW5cblxuXHRyUGFyYW1zID0gLyhcXCgpKD89XFxzKlxcKCl8KD86KFsoW10pXFxzKik/KD86KFxcXj8pKCEqP1sjfl0/W1xcdyQuXl0rKT9cXHMqKChcXCtcXCt8LS0pfFxcK3wtfCYmfFxcfFxcfHw9PT18IT09fD09fCE9fDw9fD49fFs8PiUqOj9cXC9dfCg9KSlcXHMqfCghKj9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfChcXCg/KVxcXFw/KD86KCcpfChcIikpfCg/OlxccyooKFspXFxdXSkoPz1cXHMqWy5eXXxcXHMqJHxbXihbXSl8WylcXF1dKShbKFtdPykpfChcXHMrKS9nLFxuXHQvLyAgICAgICAgICBsZnRQcm4wICAgICAgICBsZnRQcm4gICAgICAgIGJvdW5kICAgICAgICAgICAgcGF0aCAgICBvcGVyYXRvciBlcnIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcSAgICAgICAgICAgICBwYXRoMiAgICAgICBwcm4gICAgY29tbWEgICBsZnRQcm4yICAgYXBvcyBxdW90ICAgICAgcnRQcm4gcnRQcm5Eb3QgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm4yICBzcGFjZVxuXHQvLyAobGVmdCBwYXJlbj8gZm9sbG93ZWQgYnkgKHBhdGg/IGZvbGxvd2VkIGJ5IG9wZXJhdG9yKSBvciAocGF0aCBmb2xsb3dlZCBieSBsZWZ0IHBhcmVuPykpIG9yIGNvbW1hIG9yIGFwb3Mgb3IgcXVvdCBvciByaWdodCBwYXJlbiBvciBzcGFjZVxuXG5cdGlzUmVuZGVyQ2FsbCxcblx0ck5ld0xpbmUgPSAvWyBcXHRdKihcXHJcXG58XFxufFxccikvZyxcblx0clVuZXNjYXBlUXVvdGVzID0gL1xcXFwoWydcIl0pL2csXG5cdHJFc2NhcGVRdW90ZXMgPSAvWydcIlxcXFxdL2csIC8vIEVzY2FwZSBxdW90ZXMgYW5kIFxcIGNoYXJhY3RlclxuXHRyQnVpbGRIYXNoID0gLyg/OlxceDA4fF4pKG9uZXJyb3I6KT8oPzoofj8pKChbXFx3JF9cXC5dKyk6KT8oW15cXHgwOF0rKSlcXHgwOCgsKT8oW15cXHgwOF0rKS9naSxcblx0clRlc3RFbHNlSWYgPSAvXmlmXFxzLyxcblx0ckZpcnN0RWxlbSA9IC88KFxcdyspWz5cXHNdLyxcblx0ckF0dHJFbmNvZGUgPSAvW1xceDAwYD48XCInJj1dL2csIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0cklzSHRtbCA9IC9bXFx4MDBgPjxcXFwiJyY9XS8sXG5cdHJIYXNIYW5kbGVycyA9IC9eb25bQS1aXXxeY29udmVydChCYWNrKT8kLyxcblx0cldyYXBwZWRJblZpZXdNYXJrZXIgPSAvXlxcI1xcZCtfYFtcXHNcXFNdKlxcL1xcZCtfYCQvLFxuXHRySHRtbEVuY29kZSA9IHJBdHRyRW5jb2RlLFxuXHR2aWV3SWQgPSAwLFxuXHRjaGFyRW50aXRpZXMgPSB7XG5cdFx0XCImXCI6IFwiJmFtcDtcIixcblx0XHRcIjxcIjogXCImbHQ7XCIsXG5cdFx0XCI+XCI6IFwiJmd0O1wiLFxuXHRcdFwiXFx4MDBcIjogXCImIzA7XCIsXG5cdFx0XCInXCI6IFwiJiMzOTtcIixcblx0XHQnXCInOiBcIiYjMzQ7XCIsXG5cdFx0XCJgXCI6IFwiJiM5NjtcIixcblx0XHRcIj1cIjogXCImIzYxO1wiXG5cdH0sXG5cdEhUTUwgPSBcImh0bWxcIixcblx0T0JKRUNUID0gXCJvYmplY3RcIixcblx0dG1wbEF0dHIgPSBcImRhdGEtanN2LXRtcGxcIixcblx0anN2VG1wbCA9IFwianN2VG1wbFwiLFxuXHRpbmRleFN0ciA9IFwiRm9yICNpbmRleCBpbiBuZXN0ZWQgYmxvY2sgdXNlICNnZXRJbmRleCgpLlwiLFxuXHQkcmVuZGVyID0ge30sXG5cblx0anNyID0gZ2xvYmFsLmpzcmVuZGVyLFxuXHRqc3JUb0pxID0ganNyICYmICQgJiYgISQucmVuZGVyLCAvLyBKc1JlbmRlciBhbHJlYWR5IGxvYWRlZCwgd2l0aG91dCBqUXVlcnkuIGJ1dCB3ZSB3aWxsIHJlLWxvYWQgaXQgbm93IHRvIGF0dGFjaCB0byBqUXVlcnlcblxuXHRqc3ZTdG9yZXMgPSB7XG5cdFx0dGVtcGxhdGU6IHtcblx0XHRcdGNvbXBpbGU6IGNvbXBpbGVUbXBsXG5cdFx0fSxcblx0XHR0YWc6IHtcblx0XHRcdGNvbXBpbGU6IGNvbXBpbGVUYWdcblx0XHR9LFxuXHRcdHZpZXdNb2RlbDoge1xuXHRcdFx0Y29tcGlsZTogY29tcGlsZVZpZXdNb2RlbFxuXHRcdH0sXG5cdFx0aGVscGVyOiB7fSxcblx0XHRjb252ZXJ0ZXI6IHt9XG5cdH07XG5cblx0Ly8gdmlld3Mgb2JqZWN0ICgkLnZpZXdzIGlmIGpRdWVyeSBpcyBsb2FkZWQsIGpzcmVuZGVyLnZpZXdzIGlmIG5vIGpRdWVyeSwgZS5nLiBpbiBOb2RlLmpzKVxuXHQkdmlld3MgPSB7XG5cdFx0anN2aWV3czogdmVyc2lvbk51bWJlcixcblx0XHRzdWI6IHtcblx0XHRcdC8vIHN1YnNjcmlwdGlvbiwgZS5nLiBKc1ZpZXdzIGludGVncmF0aW9uXG5cdFx0XHRWaWV3OiBWaWV3LFxuXHRcdFx0RXJyOiBKc1ZpZXdzRXJyb3IsXG5cdFx0XHR0bXBsRm46IHRtcGxGbixcblx0XHRcdHBhcnNlOiBwYXJzZVBhcmFtcyxcblx0XHRcdGV4dGVuZDogJGV4dGVuZCxcblx0XHRcdGV4dGVuZEN0eDogZXh0ZW5kQ3R4LFxuXHRcdFx0c3ludGF4RXJyOiBzeW50YXhFcnJvcixcblx0XHRcdG9uU3RvcmU6IHt9LFxuXHRcdFx0YWRkU2V0dGluZzogYWRkU2V0dGluZyxcblx0XHRcdHNldHRpbmdzOiB7XG5cdFx0XHRcdGFsbG93Q29kZTogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRhZHZTZXQ6IG5vb3AsIC8vIFVwZGF0ZSBhZHZhbmNlZCBzZXR0aW5nc1xuXHRcdFx0X3RoczogdGFnSGFuZGxlcnNGcm9tUHJvcHMsXG5cdFx0XHRfdGc6IGZ1bmN0aW9uKCkge30sIC8vIENvbnN0cnVjdG9yIGZvciB0YWdEZWZcblx0XHRcdF9jbnZ0OiBjb252ZXJ0VmFsLFxuXHRcdFx0X3RhZzogcmVuZGVyVGFnLFxuXHRcdFx0X2VyOiBlcnJvcixcblx0XHRcdF9lcnI6IG9uUmVuZGVyRXJyb3IsXG5cdFx0XHRfaHRtbDogaHRtbEVuY29kZSxcblx0XHRcdF9jcDogcmV0VmFsLCAvLyBHZXQgY29tcGlsZWQgY29udGV4dHVhbCBwYXJhbWV0ZXJzIChvciBwcm9wZXJ0aWVzKSB+Zm9vPWV4cHIuIEluIEpzUmVuZGVyLCBzaW1wbHkgcmV0dXJucyB2YWwuXG5cdFx0XHRfc3E6IGZ1bmN0aW9uKHRva2VuKSB7XG5cdFx0XHRcdGlmICh0b2tlbiA9PT0gXCJjb25zdHJ1Y3RvclwiKSB7XG5cdFx0XHRcdFx0c3ludGF4RXJyb3IoXCJcIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRva2VuO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2V0dGluZ3M6IHtcblx0XHRcdGRlbGltaXRlcnM6ICR2aWV3c0RlbGltaXRlcnMsXG5cdFx0XHRhZHZhbmNlZDogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlXG5cdFx0XHRcdFx0PyAoXG5cdFx0XHRcdFx0XHRcdCRleHRlbmQoJHN1YlNldHRpbmdzQWR2YW5jZWQsIHZhbHVlKSxcblx0XHRcdFx0XHRcdFx0JHN1Yi5hZHZTZXQoKSxcblx0XHRcdFx0XHRcdFx0JHZpZXdzU2V0dGluZ3Ncblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdDogJHN1YlNldHRpbmdzQWR2YW5jZWQ7XG5cdFx0XHRcdH1cblx0XHR9LFxuXHRcdGdldEN0eDogcmV0VmFsLCAvLyBHZXQgY3R4LmZvbyB2YWx1ZS4gSW4gSnNSZW5kZXIsIHNpbXBseSByZXR1cm5zIHZhbC5cblx0XHRtYXA6IGRhdGFNYXAgICAgLy8gSWYganNPYnNlcnZhYmxlIGxvYWRlZCBmaXJzdCwgdXNlIHRoYXQgZGVmaW5pdGlvbiBvZiBkYXRhTWFwXG5cdH07XG5cbmZ1bmN0aW9uIGdldERlcml2ZWRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHR2YXIgcmV0LFxuXHRcdFx0dGFnID0gdGhpcyxcblx0XHRcdHByZXZCYXNlID0gdGFnLmJhc2U7XG5cblx0XHR0YWcuYmFzZSA9IGJhc2VNZXRob2Q7IC8vIFdpdGhpbiBtZXRob2QgY2FsbCwgY2FsbGluZyB0aGlzLmJhc2Ugd2lsbCBjYWxsIHRoZSBiYXNlIG1ldGhvZFxuXHRcdHJldCA9IG1ldGhvZC5hcHBseSh0YWcsIGFyZ3VtZW50cyk7IC8vIENhbGwgdGhlIG1ldGhvZFxuXHRcdHRhZy5iYXNlID0gcHJldkJhc2U7IC8vIFJlcGxhY2UgdGhpcy5iYXNlIHRvIGJlIHRoZSBiYXNlIG1ldGhvZCBvZiB0aGUgcHJldmlvdXMgY2FsbCwgZm9yIGNoYWluZWQgY2FsbHNcblx0XHRyZXR1cm4gcmV0O1xuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRNZXRob2QoYmFzZU1ldGhvZCwgbWV0aG9kKSB7XG5cdC8vIEZvciBkZXJpdmVkIG1ldGhvZHMgKG9yIGhhbmRsZXJzIGRlY2xhcmVkIGRlY2xhcmF0aXZlbHkgYXMgaW4ge3s6Zm9vIG9uQ2hhbmdlPX5mb29DaGFuZ2VkfX0gcmVwbGFjZSBieSBhIGRlcml2ZWQgbWV0aG9kLCB0byBhbGxvdyB1c2luZyB0aGlzLmJhc2UoLi4uKVxuXHQvLyBvciB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIHRvIGNhbGwgdGhlIGJhc2UgaW1wbGVtZW50YXRpb24uIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyKC4uLikgYW5kIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdGlmICgkaXNGdW5jdGlvbihtZXRob2QpKSB7XG5cdFx0bWV0aG9kID0gZ2V0RGVyaXZlZE1ldGhvZChcblx0XHRcdFx0IWJhc2VNZXRob2Rcblx0XHRcdFx0XHQ/IG5vb3AgLy8gbm8gYmFzZSBtZXRob2QgaW1wbGVtZW50YXRpb24sIHNvIHVzZSBub29wIGFzIGJhc2UgbWV0aG9kXG5cdFx0XHRcdFx0OiBiYXNlTWV0aG9kLl9kXG5cdFx0XHRcdFx0XHQ/IGJhc2VNZXRob2QgLy8gYmFzZU1ldGhvZCBpcyBhIGRlcml2ZWQgbWV0aG9kLCBzbyB1cyBpdFxuXHRcdFx0XHRcdFx0OiBnZXREZXJpdmVkTWV0aG9kKG5vb3AsIGJhc2VNZXRob2QpLCAvLyBiYXNlTWV0aG9kIGlzIG5vdCBkZXJpdmVkIHNvIG1ha2UgaXRzIGJhc2UgbWV0aG9kIGJlIHRoZSBub29wIG1ldGhvZFxuXHRcdFx0XHRtZXRob2Rcblx0XHRcdCk7XG5cdFx0bWV0aG9kLl9kID0gMTsgLy8gQWRkIGZsYWcgdGhhdCB0aGlzIGlzIGEgZGVyaXZlZCBtZXRob2Rcblx0fVxuXHRyZXR1cm4gbWV0aG9kO1xufVxuXG5mdW5jdGlvbiB0YWdIYW5kbGVyc0Zyb21Qcm9wcyh0YWcsIHRhZ0N0eCkge1xuXHRmb3IgKHZhciBwcm9wIGluIHRhZ0N0eC5wcm9wcykge1xuXHRcdGlmIChySGFzSGFuZGxlcnMudGVzdChwcm9wKSkge1xuXHRcdFx0dGFnW3Byb3BdID0gZ2V0TWV0aG9kKHRhZ1twcm9wXSwgdGFnQ3R4LnByb3BzW3Byb3BdKTtcblx0XHRcdC8vIENvcHkgb3ZlciB0aGUgb25Gb28gcHJvcHMsIGNvbnZlcnQgYW5kIGNvbnZlcnRCYWNrIGZyb20gdGFnQ3R4LnByb3BzIHRvIHRhZyAob3ZlcnJpZGVzIHZhbHVlcyBpbiB0YWdEZWYpLlxuXHRcdFx0Ly8gTm90ZTogdW5zdXBwb3J0ZWQgc2NlbmFyaW86IGlmIGhhbmRsZXJzIGFyZSBkeW5hbWljYWxseSBhZGRlZCBeb25Gb289ZXhwcmVzc2lvbiB0aGlzIHdpbGwgd29yaywgYnV0IGR5bmFtaWNhbGx5IHJlbW92aW5nIHdpbGwgbm90IHdvcmsuXG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHJldFZhbCh2YWwpIHtcblx0cmV0dXJuIHZhbDtcbn1cblxuZnVuY3Rpb24gbm9vcCgpIHtcblx0cmV0dXJuIFwiXCI7XG59XG5cbmZ1bmN0aW9uIGRiZ0JyZWFrKHZhbCkge1xuXHQvLyBVc2FnZSBleGFtcGxlczoge3tkYmc6Li4ufX0sIHt7On5kYmcoLi4uKX19LCB7e2RiZyAuLi4vfX0sIHtee2ZvciAuLi4gb25BZnRlckxpbms9fmRiZ319IGV0Yy5cblx0dHJ5IHtcblx0XHRjb25zb2xlLmxvZyhcIkpzUmVuZGVyIGRiZyBicmVha3BvaW50OiBcIiArIHZhbCk7XG5cdFx0dGhyb3cgXCJkYmcgYnJlYWtwb2ludFwiOyAvLyBUbyBicmVhayBoZXJlLCBzdG9wIG9uIGNhdWdodCBleGNlcHRpb25zLlxuXHR9XG5cdGNhdGNoIChlKSB7fVxuXHRyZXR1cm4gdGhpcy5iYXNlID8gdGhpcy5iYXNlQXBwbHkoYXJndW1lbnRzKSA6IHZhbDtcbn1cblxuZnVuY3Rpb24gSnNWaWV3c0Vycm9yKG1lc3NhZ2UpIHtcblx0Ly8gRXJyb3IgZXhjZXB0aW9uIHR5cGUgZm9yIEpzVmlld3MvSnNSZW5kZXJcblx0Ly8gT3ZlcnJpZGUgb2YgJC52aWV3cy5zdWIuRXJyb3IgaXMgcG9zc2libGVcblx0dGhpcy5uYW1lID0gKCQubGluayA/IFwiSnNWaWV3c1wiIDogXCJKc1JlbmRlclwiKSArIFwiIEVycm9yXCI7XG5cdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2UgfHwgdGhpcy5uYW1lO1xufVxuXG5mdW5jdGlvbiAkZXh0ZW5kKHRhcmdldCwgc291cmNlKSB7XG5cdGZvciAodmFyIG5hbWUgaW4gc291cmNlKSB7XG5cdFx0dGFyZ2V0W25hbWVdID0gc291cmNlW25hbWVdO1xuXHR9XG5cdHJldHVybiB0YXJnZXQ7XG59XG5cbihKc1ZpZXdzRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yKCkpLmNvbnN0cnVjdG9yID0gSnNWaWV3c0Vycm9yO1xuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFRvcC1sZXZlbCBmdW5jdGlvbnMgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLy89PT09PT09PT09PT09PT09PT09XG4vLyB2aWV3cy5kZWxpbWl0ZXJzXG4vLz09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gJHZpZXdzRGVsaW1pdGVycyhvcGVuQ2hhcnMsIGNsb3NlQ2hhcnMsIGxpbmspIHtcblx0Ly8gU2V0IHRoZSB0YWcgb3BlbmluZyBhbmQgY2xvc2luZyBkZWxpbWl0ZXJzIGFuZCAnbGluaycgY2hhcmFjdGVyLiBEZWZhdWx0IGlzIFwie3tcIiwgXCJ9fVwiIGFuZCBcIl5cIlxuXHQvLyBvcGVuQ2hhcnMsIGNsb3NlQ2hhcnM6IG9wZW5pbmcgYW5kIGNsb3Npbmcgc3RyaW5ncywgZWFjaCB3aXRoIHR3byBjaGFyYWN0ZXJzXG5cdGlmICghb3BlbkNoYXJzKSB7XG5cdFx0cmV0dXJuICRzdWJTZXR0aW5ncy5kZWxpbWl0ZXJzO1xuXHR9XG5cdGlmICgkaXNBcnJheShvcGVuQ2hhcnMpKSB7XG5cdFx0cmV0dXJuICR2aWV3c0RlbGltaXRlcnMuYXBwbHkoJHZpZXdzLCBvcGVuQ2hhcnMpO1xuXHR9XG5cblx0JHN1YlNldHRpbmdzLmRlbGltaXRlcnMgPSBbb3BlbkNoYXJzLCBjbG9zZUNoYXJzLCBsaW5rQ2hhciA9IGxpbmsgPyBsaW5rLmNoYXJBdCgwKSA6IGxpbmtDaGFyXTtcblxuXHRkZWxpbU9wZW5DaGFyMCA9IG9wZW5DaGFycy5jaGFyQXQoMCk7IC8vIEVzY2FwZSB0aGUgY2hhcmFjdGVycyAtIHNpbmNlIHRoZXkgY291bGQgYmUgcmVnZXggc3BlY2lhbCBjaGFyYWN0ZXJzXG5cdGRlbGltT3BlbkNoYXIxID0gb3BlbkNoYXJzLmNoYXJBdCgxKTtcblx0ZGVsaW1DbG9zZUNoYXIwID0gY2xvc2VDaGFycy5jaGFyQXQoMCk7XG5cdGRlbGltQ2xvc2VDaGFyMSA9IGNsb3NlQ2hhcnMuY2hhckF0KDEpO1xuXHRvcGVuQ2hhcnMgPSBcIlxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjE7IC8vIERlZmF1bHQgaXMgXCJ7XntcIlxuXHRjbG9zZUNoYXJzID0gXCJcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIlxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMTsgICAgICAgICAgICAgICAgICAgLy8gRGVmYXVsdCBpcyBcIn19XCJcblx0Ly8gQnVpbGQgcmVnZXggd2l0aCBuZXcgZGVsaW1pdGVyc1xuXHQvLyAgICAgICAgICBbdGFnICAgIChmb2xsb3dlZCBieSAvIHNwYWNlIG9yIH0pICBvciBjdnRyK2NvbG9uIG9yIGh0bWwgb3IgY29kZV0gZm9sbG93ZWQgYnkgc3BhY2UrcGFyYW1zIHRoZW4gY29udmVydEJhY2s/XG5cdHJUYWcgPSBcIig/OihcXFxcdysoPz1bXFxcXC9cXFxcc1xcXFxcIiArIGRlbGltQ2xvc2VDaGFyMCArIFwiXSkpfChcXFxcdyspPyg6KXwoPil8KFxcXFwqKSlcXFxccyooKD86W15cXFxcXCJcblx0XHQrIGRlbGltQ2xvc2VDaGFyMCArIFwiXXxcXFxcXCIgKyBkZWxpbUNsb3NlQ2hhcjAgKyBcIig/IVxcXFxcIiArIGRlbGltQ2xvc2VDaGFyMSArIFwiKSkqPylcIjtcblxuXHQvLyBNYWtlIHJUYWcgYXZhaWxhYmxlIHRvIEpzVmlld3MgKG9yIG90aGVyIGNvbXBvbmVudHMpIGZvciBwYXJzaW5nIGJpbmRpbmcgZXhwcmVzc2lvbnNcblx0JHN1Yi5yVGFnID0gXCIoPzpcIiArIHJUYWcgKyBcIilcIjtcblx0Ly8gICAgICAgICAgICAgICAgICAgICAgICB7IF4/IHsgICB0YWcrcGFyYW1zIHNsYXNoPyAgb3IgY2xvc2luZ1RhZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yIGNvbW1lbnRcblx0clRhZyA9IG5ldyBSZWdFeHAoXCIoPzpcIiArIG9wZW5DaGFycyArIHJUYWcgKyBcIihcXFxcLyk/fFxcXFxcIiArIGRlbGltT3BlbkNoYXIwICsgXCIoXFxcXFwiICsgbGlua0NoYXIgKyBcIik/XFxcXFwiICsgZGVsaW1PcGVuQ2hhcjEgKyBcIig/Oig/OlxcXFwvKFxcXFx3KykpXFxcXHMqfCEtLVtcXFxcc1xcXFxTXSo/LS0pKVwiICsgY2xvc2VDaGFycywgXCJnXCIpO1xuXG5cdC8vIERlZmF1bHQ6ICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcblx0Ly8gICAgICAvKD86eyhcXF4pP3soPzooXFx3Kyg/PVtcXC9cXHN9XSkpfChcXHcrKT8oOil8KD4pfChcXCopKVxccyooKD86W159XXx9KD8hfSkpKj8pKFxcLyk/fHsoXFxeKT97KD86KD86XFwvKFxcdyspKVxccyp8IS0tW1xcc1xcU10qPy0tKSl9fVxuXG5cdCRzdWIuclRtcGwgPSBuZXcgUmVnRXhwKFwiPC4qPnwoW15cXFxcXFxcXF18Xilbe31dfFwiICsgb3BlbkNoYXJzICsgXCIuKlwiICsgY2xvc2VDaGFycyk7XG5cdC8vICRzdWIuclRtcGwgbG9va3MgZm9yIGh0bWwgdGFncyBvciB7IG9yIH0gY2hhciBub3QgcHJlY2VkZWQgYnkgXFxcXCwgb3IgSnNSZW5kZXIgdGFncyB7e3h4eH19LiBFYWNoIG9mIHRoZXNlIHN0cmluZ3MgYXJlIGNvbnNpZGVyZWRcblx0Ly8gTk9UIHRvIGJlIGpRdWVyeSBzZWxlY3RvcnNcblx0cmV0dXJuICR2aWV3c1NldHRpbmdzO1xufVxuXG4vLz09PT09PT09PVxuLy8gVmlldy5nZXRcbi8vPT09PT09PT09XG5cbmZ1bmN0aW9uIGdldFZpZXcoaW5uZXIsIHR5cGUpIHsgLy92aWV3LmdldChpbm5lciwgdHlwZSlcblx0aWYgKCF0eXBlICYmIGlubmVyICE9PSB0cnVlKSB7XG5cdFx0Ly8gdmlldy5nZXQodHlwZSlcblx0XHR0eXBlID0gaW5uZXI7XG5cdFx0aW5uZXIgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHR2YXIgdmlld3MsIGksIGwsIGZvdW5kLFxuXHRcdHZpZXcgPSB0aGlzLFxuXHRcdHJvb3QgPSAhdHlwZSB8fCB0eXBlID09PSBcInJvb3RcIjtcblx0XHQvLyBJZiB0eXBlIGlzIHVuZGVmaW5lZCwgcmV0dXJucyByb290IHZpZXcgKHZpZXcgdW5kZXIgdG9wIHZpZXcpLlxuXG5cdGlmIChpbm5lcikge1xuXHRcdC8vIEdvIHRocm91Z2ggdmlld3MgLSB0aGlzIG9uZSwgYW5kIGFsbCBuZXN0ZWQgb25lcywgZGVwdGgtZmlyc3QgLSBhbmQgcmV0dXJuIGZpcnN0IG9uZSB3aXRoIGdpdmVuIHR5cGUuXG5cdFx0Ly8gSWYgdHlwZSBpcyB1bmRlZmluZWQsIGkuZS4gdmlldy5nZXQodHJ1ZSksIHJldHVybiBmaXJzdCBjaGlsZCB2aWV3LlxuXHRcdGZvdW5kID0gdHlwZSAmJiB2aWV3LnR5cGUgPT09IHR5cGUgJiYgdmlldztcblx0XHRpZiAoIWZvdW5kKSB7XG5cdFx0XHR2aWV3cyA9IHZpZXcudmlld3M7XG5cdFx0XHRpZiAodmlldy5fLnVzZUtleSkge1xuXHRcdFx0XHRmb3IgKGkgaW4gdmlld3MpIHtcblx0XHRcdFx0XHRpZiAoZm91bmQgPSB0eXBlID8gdmlld3NbaV0uZ2V0KGlubmVyLCB0eXBlKSA6IHZpZXdzW2ldKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoaSA9IDAsIGwgPSB2aWV3cy5sZW5ndGg7ICFmb3VuZCAmJiBpIDwgbDsgaSsrKSB7XG5cdFx0XHRcdFx0Zm91bmQgPSB0eXBlID8gdmlld3NbaV0uZ2V0KGlubmVyLCB0eXBlKSA6IHZpZXdzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHJvb3QpIHtcblx0XHQvLyBGaW5kIHJvb3Qgdmlldy4gKHZpZXcgd2hvc2UgcGFyZW50IGlzIHRvcCB2aWV3KVxuXHRcdHdoaWxlICh2aWV3LnBhcmVudCkge1xuXHRcdFx0Zm91bmQgPSB2aWV3O1xuXHRcdFx0dmlldyA9IHZpZXcucGFyZW50O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR3aGlsZSAodmlldyAmJiAhZm91bmQpIHtcblx0XHRcdC8vIEdvIHRocm91Z2ggdmlld3MgLSB0aGlzIG9uZSwgYW5kIGFsbCBwYXJlbnQgb25lcyAtIGFuZCByZXR1cm4gZmlyc3Qgb25lIHdpdGggZ2l2ZW4gdHlwZS5cblx0XHRcdGZvdW5kID0gdmlldy50eXBlID09PSB0eXBlID8gdmlldyA6IHVuZGVmaW5lZDtcblx0XHRcdHZpZXcgPSB2aWV3LnBhcmVudDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGZvdW5kO1xufVxuXG5mdW5jdGlvbiBnZXROZXN0ZWRJbmRleCgpIHtcblx0dmFyIHZpZXcgPSB0aGlzLmdldChcIml0ZW1cIik7XG5cdHJldHVybiB2aWV3ID8gdmlldy5pbmRleCA6IHVuZGVmaW5lZDtcbn1cblxuZ2V0TmVzdGVkSW5kZXguZGVwZW5kcyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gW3RoaXMuZ2V0KFwiaXRlbVwiKSwgXCJpbmRleFwiXTtcbn07XG5cbmZ1bmN0aW9uIGdldEluZGV4KCkge1xuXHRyZXR1cm4gdGhpcy5pbmRleDtcbn1cblxuZ2V0SW5kZXguZGVwZW5kcyA9IFwiaW5kZXhcIjtcblxuLy89PT09PT09PT09XG4vLyBWaWV3LmhscFxuLy89PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldEhlbHBlcihoZWxwZXIsIGlzQ29udGV4dENiKSB7XG5cdC8vIEhlbHBlciBtZXRob2QgY2FsbGVkIGFzIHZpZXcuaGxwKGtleSkgZnJvbSBjb21waWxlZCB0ZW1wbGF0ZSwgZm9yIGhlbHBlcnMgb3IgdGVtcGxhdGUgcGFyYW1ldGVycyB+Zm9vXG5cdHZhciB3cmFwcGVkLCBkZXBzLFxuXHR2aWV3ID0gdGhpcyxcblx0cmVzID0gdmlldy5jdHg7XG5cblx0aWYgKHJlcykge1xuXHRcdHJlcyA9IHJlc1toZWxwZXJdO1xuXHR9XG5cdGlmIChyZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJlcyA9ICRoZWxwZXJzW2hlbHBlcl07XG5cdH1cblx0aWYgKHJlcyAmJiByZXMuX2NwKSB7IC8vIElmIHRoaXMgaGVscGVyIHJlc291cmNlIGlzIGEgY29udGV4dHVhbCBwYXJhbWV0ZXIsIH5mb289ZXhwclxuXHRcdGlmIChpc0NvbnRleHRDYikgeyAvLyBJbiBhIGNvbnRleHQgY2FsbGJhY2sgZm9yIGEgY29udGV4dHVhbCBwYXJhbSwgcmV0dXJuIHRoZSBbY3VycmVudERhdGEsIGRlcGVuZGVuY2llcy4uLl0gYXJyYXkgLSBuZWVkZWQgZm9yIG9ic2VydmUgY2FsbFxuXHRcdFx0ZGVwcyA9ICRzdWIuX2NlbyhyZXNbMV0uZGVwcyk7ICAvLyBmbiBkZXBzLCB3aXRoIGFueSBleHByT2JzIGNsb25lZFxuXHRcdFx0ZGVwcy51bnNoaWZ0KHJlc1swXS5kYXRhKTsgICAgICAvLyB2aWV3LmRhdGFcblx0XHRcdGRlcHMuX2NwID0gdHJ1ZTtcblx0XHRcdHJldHVybiBkZXBzO1xuXHRcdH1cblx0XHRyZXMgPSAkdmlld3MuZ2V0Q3R4KHJlcyk7IC8vIElmIGEgY29udGV4dHVhbCBwYXJhbSwgYnV0IG5vdCBhIGNvbnRleHQgY2FsbGJhY2ssIHJldHVybiBldmFsdWF0ZWQgcGFyYW0gLSBmbihkYXRhLCB2aWV3LCBqKVxuXHR9XG5cblx0aWYgKHJlcykge1xuXHRcdGlmICgkaXNGdW5jdGlvbihyZXMpICYmICFyZXMuX3dycCkge1xuXHRcdFx0Ly8gSWYgaXQgaXMgb2YgdHlwZSBmdW5jdGlvbiwgYW5kIG5vdCBhbHJlYWR5IHdyYXBwZWQsIHdlIHdpbGwgd3JhcCBpdCwgc28gaWYgY2FsbGVkIHdpdGggbm8gdGhpcyBwb2ludGVyIGl0IHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlXG5cdFx0XHQvLyB2aWV3IGFzICd0aGlzJyBjb250ZXh0LiBJZiB0aGUgaGVscGVyIH5mb28oKSB3YXMgaW4gYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiwgdGhlIHZpZXcgd2lsbCBoYXZlIGEgJ3RlbXBvcmFyeScgbGlua0N0eCBwcm9wZXJ0eSB0b28uXG5cdFx0XHQvLyBOb3RlIHRoYXQgaGVscGVyIGZ1bmN0aW9ucyBvbiBkZWVwZXIgcGF0aHMgd2lsbCBoYXZlIHNwZWNpZmljIHRoaXMgcG9pbnRlcnMsIGZyb20gdGhlIHByZWNlZGluZyBwYXRoLlxuXHRcdFx0Ly8gRm9yIGV4YW1wbGUsIH51dGlsLmZvbygpIHdpbGwgaGF2ZSB0aGUgfnV0aWwgb2JqZWN0IGFzICd0aGlzJyBwb2ludGVyXG5cdFx0XHR3cmFwcGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiByZXMuYXBwbHkoKCF0aGlzIHx8IHRoaXMgPT09IGdsb2JhbCkgPyB2aWV3IDogdGhpcywgYXJndW1lbnRzKTtcblx0XHRcdH07XG5cdFx0XHR3cmFwcGVkLl93cnAgPSB2aWV3O1xuXHRcdFx0JGV4dGVuZCh3cmFwcGVkLCByZXMpOyAvLyBBdHRhY2ggc2FtZSBleHBhbmRvcyAoaWYgYW55KSB0byB0aGUgd3JhcHBlZCBmdW5jdGlvblxuXHRcdH1cblx0fVxuXHRyZXR1cm4gd3JhcHBlZCB8fCByZXM7XG59XG5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKHRtcGwpIHtcblx0cmV0dXJuIHRtcGwgJiYgKHRtcGwuZm5cblx0XHQ/IHRtcGxcblx0XHQ6IHRoaXMuZ2V0UnNjKFwidGVtcGxhdGVzXCIsIHRtcGwpIHx8ICR0ZW1wbGF0ZXModG1wbCkpOyAvLyBub3QgeWV0IGNvbXBpbGVkXG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHZpZXdzLl9jbnZ0XG4vLz09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNvbnZlcnRWYWwoY29udmVydGVyLCB2aWV3LCB0YWdDdHgsIG9uRXJyb3IpIHtcblx0Ly8gc2VsZiBpcyB0ZW1wbGF0ZSBvYmplY3Qgb3IgbGlua0N0eCBvYmplY3Rcblx0dmFyIHRhZywgdmFsdWUsXG5cdFx0Ly8gaWYgdGFnQ3R4IGlzIGFuIGludGVnZXIsIHRoZW4gaXQgaXMgdGhlIGtleSBmb3IgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgYm91bmRUYWcgdGFnQ3R4XG5cdFx0Ym91bmRUYWcgPSB0eXBlb2YgdGFnQ3R4ID09PSBcIm51bWJlclwiICYmIHZpZXcudG1wbC5ibmRzW3RhZ0N0eC0xXSxcblx0XHRsaW5rQ3R4ID0gdmlldy5saW5rQ3R4OyAvLyBGb3IgZGF0YS1saW5rPVwie2N2dDouLi59XCIuLi5cblxuXHRpZiAob25FcnJvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0dGFnQ3R4ID0gb25FcnJvciA9IHtwcm9wczoge30sIGFyZ3M6IFtvbkVycm9yXX07XG5cdH0gZWxzZSBpZiAoYm91bmRUYWcpIHtcblx0XHR0YWdDdHggPSBib3VuZFRhZyh2aWV3LmRhdGEsIHZpZXcsICRzdWIpO1xuXHR9XG5cblx0dmFsdWUgPSB0YWdDdHguYXJnc1swXTtcblx0aWYgKGNvbnZlcnRlciB8fCBib3VuZFRhZykge1xuXHRcdHRhZyA9IGxpbmtDdHggJiYgbGlua0N0eC50YWc7XG5cdFx0aWYgKCF0YWcpIHtcblx0XHRcdHRhZyA9ICRleHRlbmQobmV3ICRzdWIuX3RnKCksIHtcblx0XHRcdFx0Xzoge1xuXHRcdFx0XHRcdGlubGluZTogIWxpbmtDdHgsXG5cdFx0XHRcdFx0Ym5kOiBib3VuZFRhZyxcblx0XHRcdFx0XHR1bmxpbmtlZDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0YWdOYW1lOiBcIjpcIixcblx0XHRcdFx0Y3Z0OiBjb252ZXJ0ZXIsXG5cdFx0XHRcdGZsb3c6IHRydWUsXG5cdFx0XHRcdHRhZ0N0eDogdGFnQ3R4XG5cdFx0XHR9KTtcblx0XHRcdGlmIChsaW5rQ3R4KSB7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIChsaW5rQ3R4ID8gbGlua0N0eC52aWV3IDogdmlldykuY3R4KTtcblx0XHR9XG5cdFx0dGFnLl9lciA9IG9uRXJyb3IgJiYgdmFsdWU7XG5cdFx0dGFnSGFuZGxlcnNGcm9tUHJvcHModGFnLCB0YWdDdHgpO1xuXG5cdFx0dGFnQ3R4LnZpZXcgPSB2aWV3O1xuXG5cdFx0dGFnLmN0eCA9IHRhZ0N0eC5jdHggfHwgdGFnLmN0eCB8fCB7fTtcblx0XHR0YWdDdHguY3R4ID0gdW5kZWZpbmVkO1xuXG5cdFx0dmFsdWUgPSB0YWcuY3Z0QXJncyhjb252ZXJ0ZXIgIT09IFwidHJ1ZVwiICYmIGNvbnZlcnRlcilbMF07IC8vIElmIHRoZXJlIGlzIGEgY29udmVydEJhY2sgYnV0IG5vIGNvbnZlcnQsIGNvbnZlcnRlciB3aWxsIGJlIFwidHJ1ZVwiXG5cblx0XHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdFx0dmFsdWUgPSBib3VuZFRhZyAmJiB2aWV3Ll8ub25SZW5kZXJcblx0XHRcdD8gdmlldy5fLm9uUmVuZGVyKHZhbHVlLCB2aWV3LCB0YWcpXG5cdFx0XHQ6IHZhbHVlO1xuXHR9XG5cdHJldHVybiB2YWx1ZSAhPSB1bmRlZmluZWQgPyB2YWx1ZSA6IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBcmdzKGNvbnZlcnRlcikge1xuXHR2YXIgdGFnID0gdGhpcyxcblx0XHR0YWdDdHggPSB0YWcudGFnQ3R4LFxuXHRcdHZpZXcgPSB0YWdDdHgudmlldyxcblx0XHRhcmdzID0gdGFnQ3R4LmFyZ3M7XG5cblx0Y29udmVydGVyID0gY29udmVydGVyIHx8IHRhZy5jb252ZXJ0O1xuXHRjb252ZXJ0ZXIgPSBjb252ZXJ0ZXIgJiYgKFwiXCIgKyBjb252ZXJ0ZXIgPT09IGNvbnZlcnRlclxuXHRcdD8gKHZpZXcuZ2V0UnNjKFwiY29udmVydGVyc1wiLCBjb252ZXJ0ZXIpIHx8IGVycm9yKFwiVW5rbm93biBjb252ZXJ0ZXI6ICdcIiArIGNvbnZlcnRlciArIFwiJ1wiKSlcblx0XHQ6IGNvbnZlcnRlcik7XG5cblx0YXJncyA9ICFhcmdzLmxlbmd0aCAmJiAhdGFnQ3R4LmluZGV4IC8vIE9uIHRoZSBvcGVuaW5nIHRhZyB3aXRoIG5vIGFyZ3MsIGJpbmQgdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0XG5cdFx0PyBbdmlldy5kYXRhXVxuXHRcdDogY29udmVydGVyXG5cdFx0XHQ/IGFyZ3Muc2xpY2UoKSAvLyBJZiB0aGVyZSBpcyBhIGNvbnZlcnRlciwgdXNlIGEgY29weSBvZiB0aGUgdGFnQ3R4LmFyZ3MgYXJyYXkgZm9yIHJlbmRlcmluZywgYW5kIHJlcGxhY2UgdGhlIGFyZ3NbMF0gaW5cblx0XHRcdC8vIHRoZSBjb3BpZWQgYXJyYXkgd2l0aCB0aGUgY29udmVydGVkIHZhbHVlLiBCdXQgd2UgZG8gbm90IG1vZGlmeSB0aGUgdmFsdWUgb2YgdGFnLnRhZ0N0eC5hcmdzWzBdICh0aGUgb3JpZ2luYWwgYXJncyBhcnJheSlcblx0XHRcdDogYXJnczsgLy8gSWYgbm8gY29udmVydGVyLCBnZXQgdGhlIG9yaWdpbmFsIHRhZ0N0eC5hcmdzXG5cblx0aWYgKGNvbnZlcnRlcikge1xuXHRcdGlmIChjb252ZXJ0ZXIuZGVwZW5kcykge1xuXHRcdFx0dGFnLmRlcGVuZHMgPSAkc3ViLmdldERlcHModGFnLmRlcGVuZHMsIHRhZywgY29udmVydGVyLmRlcGVuZHMsIGNvbnZlcnRlcik7XG5cdFx0fVxuXHRcdGFyZ3NbMF0gPSBjb252ZXJ0ZXIuYXBwbHkodGFnLCBhcmdzKTtcblx0fVxuXHRyZXR1cm4gYXJncztcbn1cblxuLy89PT09PT09PT09PT09XG4vLyB2aWV3cy5fdGFnXG4vLz09PT09PT09PT09PT1cblxuZnVuY3Rpb24gZ2V0UmVzb3VyY2UocmVzb3VyY2VUeXBlLCBpdGVtTmFtZSkge1xuXHR2YXIgcmVzLCBzdG9yZSxcblx0XHR2aWV3ID0gdGhpcztcblx0d2hpbGUgKChyZXMgPT09IHVuZGVmaW5lZCkgJiYgdmlldykge1xuXHRcdHN0b3JlID0gdmlldy50bXBsICYmIHZpZXcudG1wbFtyZXNvdXJjZVR5cGVdO1xuXHRcdHJlcyA9IHN0b3JlICYmIHN0b3JlW2l0ZW1OYW1lXTtcblx0XHR2aWV3ID0gdmlldy5wYXJlbnQ7XG5cdH1cblx0cmV0dXJuIHJlcyB8fCAkdmlld3NbcmVzb3VyY2VUeXBlXVtpdGVtTmFtZV07XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRhZyh0YWdOYW1lLCBwYXJlbnRWaWV3LCB0bXBsLCB0YWdDdHhzLCBpc1VwZGF0ZSwgb25FcnJvcikge1xuXHRwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCB0b3BWaWV3O1xuXHR2YXIgdGFnLCB0YWdfLCB0YWdEZWYsIHRlbXBsYXRlLCB0YWdzLCBhdHRyLCBwYXJlbnRUYWcsIGksIGwsIGl0ZW1SZXQsIHRhZ0N0eCwgdGFnQ3R4Q3R4LCBjb250ZW50LCBjYWxsSW5pdCwgbWFwRGVmLCB0aGlzTWFwLCBhcmdzLCBwcm9wcywgaW5pdGlhbFRtcGwsIHRhZ0RhdGFNYXAsXG5cdFx0cmV0ID0gXCJcIixcblx0XHRsaW5rQ3R4ID0gcGFyZW50Vmlldy5saW5rQ3R4IHx8IDAsXG5cdFx0Y3R4ID0gcGFyZW50Vmlldy5jdHgsXG5cdFx0cGFyZW50VG1wbCA9IHRtcGwgfHwgcGFyZW50Vmlldy50bXBsLFxuXHRcdC8vIGlmIHRhZ0N0eCBpcyBhbiBpbnRlZ2VyLCB0aGVuIGl0IGlzIHRoZSBrZXkgZm9yIHRoZSBjb21waWxlZCBmdW5jdGlvbiB0byByZXR1cm4gdGhlIGJvdW5kVGFnIHRhZ0N0eHNcblx0XHRib3VuZFRhZyA9IHR5cGVvZiB0YWdDdHhzID09PSBcIm51bWJlclwiICYmIHBhcmVudFZpZXcudG1wbC5ibmRzW3RhZ0N0eHMtMV07XG5cblx0aWYgKHRhZ05hbWUuX2lzID09PSBcInRhZ1wiKSB7XG5cdFx0dGFnID0gdGFnTmFtZTtcblx0XHR0YWdOYW1lID0gdGFnLnRhZ05hbWU7XG5cdFx0dGFnQ3R4cyA9IHRhZy50YWdDdHhzO1xuXHRcdHRlbXBsYXRlID0gdGFnLnRlbXBsYXRlO1xuXHR9IGVsc2Uge1xuXHRcdHRhZ0RlZiA9IHBhcmVudFZpZXcuZ2V0UnNjKFwidGFnc1wiLCB0YWdOYW1lKSB8fCBlcnJvcihcIlVua25vd24gdGFnOiB7e1wiICsgdGFnTmFtZSArIFwifX0gXCIpO1xuXHRcdHRlbXBsYXRlID0gdGFnRGVmLnRlbXBsYXRlO1xuXHR9XG5cblx0aWYgKG9uRXJyb3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldCArPSBvbkVycm9yO1xuXHRcdHRhZ0N0eHMgPSBvbkVycm9yID0gW3twcm9wczoge30sIGFyZ3M6IFtdfV07XG5cdH0gZWxzZSBpZiAoYm91bmRUYWcpIHtcblx0XHR0YWdDdHhzID0gYm91bmRUYWcocGFyZW50Vmlldy5kYXRhLCBwYXJlbnRWaWV3LCAkc3ViKTtcblx0fVxuXG5cdGwgPSB0YWdDdHhzLmxlbmd0aDtcblx0Zm9yIChpID0gMDsgaSA8IGw7IGkrKykge1xuXHRcdHRhZ0N0eCA9IHRhZ0N0eHNbaV07XG5cdFx0aWYgKCFsaW5rQ3R4IHx8ICFsaW5rQ3R4LnRhZyB8fCBpICYmICFsaW5rQ3R4LnRhZy5fLmlubGluZSB8fCB0YWcuX2VyKSB7XG5cdFx0XHQvLyBJbml0aWFsaXplIHRhZ0N0eFxuXHRcdFx0Ly8gRm9yIGJsb2NrIHRhZ3MsIHRhZ0N0eC50bXBsIGlzIGFuIGludGVnZXIgPiAwXG5cdFx0XHRpZiAoY29udGVudCA9IHBhcmVudFRtcGwudG1wbHMgJiYgdGFnQ3R4LnRtcGwpIHtcblx0XHRcdFx0Y29udGVudCA9IHRhZ0N0eC5jb250ZW50ID0gcGFyZW50VG1wbC50bXBsc1tjb250ZW50IC0gMV07XG5cdFx0XHR9XG5cdFx0XHR0YWdDdHguaW5kZXggPSBpO1xuXHRcdFx0dGFnQ3R4LnRtcGwgPSBjb250ZW50OyAvLyBTZXQgdGhlIHRtcGwgcHJvcGVydHkgdG8gdGhlIGNvbnRlbnQgb2YgdGhlIGJsb2NrIHRhZ1xuXHRcdFx0dGFnQ3R4LnJlbmRlciA9IHJlbmRlckNvbnRlbnQ7XG5cdFx0XHR0YWdDdHgudmlldyA9IHBhcmVudFZpZXc7XG5cdFx0XHR0YWdDdHguY3R4ID0gZXh0ZW5kQ3R4KHRhZ0N0eC5jdHgsIGN0eCk7IC8vIENsb25lIGFuZCBleHRlbmQgcGFyZW50Vmlldy5jdHhcblx0XHR9XG5cdFx0aWYgKHRtcGwgPSB0YWdDdHgucHJvcHMudG1wbCkge1xuXHRcdFx0Ly8gSWYgdGhlIHRtcGwgcHJvcGVydHkgaXMgb3ZlcnJpZGRlbiwgc2V0IHRoZSB2YWx1ZSAod2hlbiBpbml0aWFsaXppbmcsIG9yLCBpbiBjYXNlIG9mIGJpbmRpbmc6IF50bXBsPS4uLiwgd2hlbiB1cGRhdGluZylcblx0XHRcdHRhZ0N0eC50bXBsID0gcGFyZW50Vmlldy5nZXRUbXBsKHRtcGwpO1xuXHRcdH1cblxuXHRcdGlmICghdGFnKSB7XG5cdFx0XHQvLyBUaGlzIHdpbGwgb25seSBiZSBoaXQgZm9yIGluaXRpYWwgdGFnQ3R4IChub3QgZm9yIHt7ZWxzZX19KSAtIGlmIHRoZSB0YWcgaW5zdGFuY2UgZG9lcyBub3QgZXhpc3QgeWV0XG5cdFx0XHQvLyBJbnN0YW50aWF0ZSB0YWcgaWYgaXQgZG9lcyBub3QgeWV0IGV4aXN0XG5cdFx0XHQvLyBJZiB0aGUgdGFnIGhhcyBub3QgYWxyZWFkeSBiZWVuIGluc3RhbnRpYXRlZCwgd2Ugd2lsbCBjcmVhdGUgYSBuZXcgaW5zdGFuY2UuXG5cdFx0XHQvLyB+dGFnIHdpbGwgYWNjZXNzIHRoZSB0YWcsIGV2ZW4gd2l0aGluIHRoZSByZW5kZXJpbmcgb2YgdGhlIHRlbXBsYXRlIGNvbnRlbnQgb2YgdGhpcyB0YWcuXG5cdFx0XHQvLyBGcm9tIGNoaWxkL2Rlc2NlbmRhbnQgdGFncywgY2FuIGFjY2VzcyB1c2luZyB+dGFnLnBhcmVudCwgb3IgfnBhcmVudFRhZ3MudGFnTmFtZVxuXHRcdFx0dGFnID0gbmV3IHRhZ0RlZi5fY3RyKCk7XG5cdFx0XHRjYWxsSW5pdCA9ICEhdGFnLmluaXQ7XG5cblx0XHRcdHRhZy5wYXJlbnQgPSBwYXJlbnRUYWcgPSBjdHggJiYgY3R4LnRhZztcblx0XHRcdHRhZy50YWdDdHhzID0gdGFnQ3R4cztcblx0XHRcdHRhZ0RhdGFNYXAgPSB0YWcuZGF0YU1hcDtcblxuXHRcdFx0aWYgKGxpbmtDdHgpIHtcblx0XHRcdFx0dGFnLl8uaW5saW5lID0gZmFsc2U7XG5cdFx0XHRcdGxpbmtDdHgudGFnID0gdGFnO1xuXHRcdFx0XHR0YWcubGlua0N0eCA9IGxpbmtDdHg7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGFnLl8uYm5kID0gYm91bmRUYWcgfHwgbGlua0N0eC5mbikge1xuXHRcdFx0XHQvLyBCb3VuZCBpZiB7Xnt0YWcuLi59fSBvciBkYXRhLWxpbms9XCJ7dGFnLi4ufVwiXG5cdFx0XHRcdHRhZy5fLmFyclZ3cyA9IHt9O1xuXHRcdFx0fSBlbHNlIGlmICh0YWcuZGF0YUJvdW5kT25seSkge1xuXHRcdFx0XHRlcnJvcihcIntee1wiICsgdGFnTmFtZSArIFwifX0gdGFnIG11c3QgYmUgZGF0YS1ib3VuZFwiKTtcblx0XHRcdH1cblx0XHRcdC8vVE9ETyBiZXR0ZXIgcGVyZiBmb3IgY2hpbGRUYWdzKCkgLSBrZWVwIGNoaWxkIHRhZy50YWdzIGFycmF5LCAoYW5kIHJlbW92ZSBjaGlsZCwgd2hlbiBkaXNwb3NlZClcblx0XHRcdC8vIHRhZy50YWdzID0gW107XG5cdFx0fVxuXHRcdHRhZ0N0eHMgPSB0YWcudGFnQ3R4cztcblx0XHR0YWdEYXRhTWFwID0gdGFnLmRhdGFNYXA7XG5cblx0XHR0YWdDdHgudGFnID0gdGFnO1xuXHRcdGlmICh0YWdEYXRhTWFwICYmIHRhZ0N0eHMpIHtcblx0XHRcdHRhZ0N0eC5tYXAgPSB0YWdDdHhzW2ldLm1hcDsgLy8gQ29weSBvdmVyIHRoZSBjb21waWxlZCBtYXAgaW5zdGFuY2UgZnJvbSB0aGUgcHJldmlvdXMgdGFnQ3R4cyB0byB0aGUgcmVmcmVzaGVkIG9uZXNcblx0XHR9XG5cdFx0aWYgKCF0YWcuZmxvdykge1xuXHRcdFx0dGFnQ3R4Q3R4ID0gdGFnQ3R4LmN0eCA9IHRhZ0N0eC5jdHggfHwge307XG5cblx0XHRcdC8vIHRhZ3MgaGFzaDogdGFnLmN0eC50YWdzLCBtZXJnZWQgd2l0aCBwYXJlbnRWaWV3LmN0eC50YWdzLFxuXHRcdFx0dGFncyA9IHRhZy5wYXJlbnRzID0gdGFnQ3R4Q3R4LnBhcmVudFRhZ3MgPSBjdHggJiYgZXh0ZW5kQ3R4KHRhZ0N0eEN0eC5wYXJlbnRUYWdzLCBjdHgucGFyZW50VGFncykgfHwge307XG5cdFx0XHRpZiAocGFyZW50VGFnKSB7XG5cdFx0XHRcdHRhZ3NbcGFyZW50VGFnLnRhZ05hbWVdID0gcGFyZW50VGFnO1xuXHRcdFx0XHQvL1RPRE8gYmV0dGVyIHBlcmYgZm9yIGNoaWxkVGFnczogcGFyZW50VGFnLnRhZ3MucHVzaCh0YWcpO1xuXHRcdFx0fVxuXHRcdFx0dGFnc1t0YWcudGFnTmFtZV0gPSB0YWdDdHhDdHgudGFnID0gdGFnO1xuXHRcdH1cblx0fVxuXHRpZiAoISh0YWcuX2VyID0gb25FcnJvcikpIHtcblx0XHR0YWdIYW5kbGVyc0Zyb21Qcm9wcyh0YWcsIHRhZ0N0eHNbMF0pO1xuXHRcdHRhZy5yZW5kZXJpbmcgPSB7fTsgLy8gUHJvdmlkZSBvYmplY3QgZm9yIHN0YXRlIGR1cmluZyByZW5kZXIgY2FsbHMgdG8gdGFnIGFuZCBlbHNlcy4gKFVzZWQgYnkge3tpZn19IGFuZCB7e2Zvcn19Li4uKVxuXHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcblx0XHRcdHRhZ0N0eCA9IHRhZy50YWdDdHggPSB0YWdDdHhzW2ldO1xuXHRcdFx0cHJvcHMgPSB0YWdDdHgucHJvcHM7XG5cdFx0XHRhcmdzID0gdGFnLmN2dEFyZ3MoKTtcblxuXHRcdFx0aWYgKG1hcERlZiA9IHByb3BzLmRhdGFNYXAgfHwgdGFnRGF0YU1hcCkge1xuXHRcdFx0XHRpZiAoYXJncy5sZW5ndGggfHwgcHJvcHMuZGF0YU1hcCkge1xuXHRcdFx0XHRcdHRoaXNNYXAgPSB0YWdDdHgubWFwO1xuXHRcdFx0XHRcdGlmICghdGhpc01hcCB8fCB0aGlzTWFwLnNyYyAhPT0gYXJnc1swXSB8fCBpc1VwZGF0ZSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoaXNNYXAgJiYgdGhpc01hcC5zcmMpIHtcblx0XHRcdFx0XHRcdFx0dGhpc01hcC51bm1hcCgpOyAvLyBvbmx5IGNhbGxlZCBpZiBvYnNlcnZhYmxlIG1hcCAtIG5vdCB3aGVuIG9ubHkgdXNlZCBpbiBKc1JlbmRlciwgZS5nLiBieSB7e3Byb3BzfX1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXNNYXAgPSB0YWdDdHgubWFwID0gbWFwRGVmLm1hcChhcmdzWzBdLCBwcm9wcywgdW5kZWZpbmVkLCAhdGFnLl8uYm5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXJncyA9IFt0aGlzTWFwLnRndF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRhZy5jdHggPSB0YWdDdHguY3R4O1xuXG5cdFx0XHRpZiAoIWkpIHtcblx0XHRcdFx0aWYgKGNhbGxJbml0KSB7XG5cdFx0XHRcdFx0aW5pdGlhbFRtcGwgPSB0YWcudGVtcGxhdGU7XG5cdFx0XHRcdFx0dGFnLmluaXQodGFnQ3R4LCBsaW5rQ3R4LCB0YWcuY3R4KTtcblx0XHRcdFx0XHRjYWxsSW5pdCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGlua0N0eCkge1xuXHRcdFx0XHRcdC8vIFNldCBhdHRyIG9uIGxpbmtDdHggdG8gZW5zdXJlIG91dHB1dHRpbmcgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IGF0dHJpYnV0ZS5cblx0XHRcdFx0XHQvLyBTZXR0aW5nIGVpdGhlciBsaW5rQ3R4LmF0dHIgb3IgdGhpcy5hdHRyIGluIHRoZSBpbml0KCkgYWxsb3dzIHBlci1pbnN0YW5jZSBjaG9pY2Ugb2YgdGFyZ2V0IGF0dHJpYi5cblx0XHRcdFx0XHRsaW5rQ3R4LmF0dHIgPSB0YWcuYXR0ciA9IGxpbmtDdHguYXR0ciB8fCB0YWcuYXR0cjtcblx0XHRcdFx0fVxuXHRcdFx0XHRhdHRyID0gdGFnLmF0dHI7XG5cdFx0XHRcdHRhZy5fLm5vVndzID0gYXR0ciAmJiBhdHRyICE9PSBIVE1MO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVtUmV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRhZy5yZW5kZXIpIHtcblx0XHRcdFx0aXRlbVJldCA9IHRhZy5yZW5kZXIuYXBwbHkodGFnLCBhcmdzKTtcblx0XHRcdFx0aWYgKHBhcmVudFZpZXcubGlua2VkICYmIGl0ZW1SZXQgJiYgdGFnLmxpbmtlZEVsZW0gJiYgIXJXcmFwcGVkSW5WaWV3TWFya2VyLnRlc3QoaXRlbVJldCkpIHtcblx0XHRcdFx0XHQvLyBXaGVuIGEgdGFnIHJlbmRlcnMgY29udGVudCBmcm9tIHRoZSByZW5kZXIgbWV0aG9kLCB3aXRoIGRhdGEgbGlua2luZywgYW5kIGhhcyBhIGxpbmtlZEVsZW0gYmluZGluZywgdGhlbiB3ZSBuZWVkIHRvIHdyYXAgd2l0aFxuXHRcdFx0XHRcdC8vIHZpZXcgbWFya2VycywgaWYgYWJzZW50LCBzbyB0aGUgY29udGVudCBpcyBhIHZpZXcgYXNzb2NpYXRlZCB3aXRoIHRoZSB0YWcsIHdoaWNoIHdpbGwgY29ycmVjdGx5IGRpc3Bvc2UgYmluZGluZ3MgaWYgZGVsZXRlZC5cblx0XHRcdFx0XHRpdGVtUmV0ID0gcmVuZGVyV2l0aFZpZXdzKCQudGVtcGxhdGVzKGl0ZW1SZXQpLCBhcmdzWzBdLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcGFyZW50VmlldywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRhZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghYXJncy5sZW5ndGgpIHtcblx0XHRcdFx0YXJncyA9IFtwYXJlbnRWaWV3XTsgLy8gbm8gYXJndW1lbnRzIC0gKGUuZy4ge3tlbHNlfX0pIGdldCBkYXRhIGNvbnRleHQgZnJvbSB2aWV3LlxuXHRcdFx0fVxuXHRcdFx0aWYgKGl0ZW1SZXQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpdGVtUmV0ID0gdGFnQ3R4LnJlbmRlcihhcmdzWzBdLCB0cnVlKSB8fCAoaXNVcGRhdGUgPyB1bmRlZmluZWQgOiBcIlwiKTtcblx0XHRcdH1cblx0XHRcdC8vIE5vIHJldHVybiB2YWx1ZSBmcm9tIHJlbmRlciwgYW5kIG5vIHRlbXBsYXRlL2NvbnRlbnQgdGFnQ3R4LnJlbmRlciguLi4pLCBzbyByZXR1cm4gdW5kZWZpbmVkXG5cdFx0XHRyZXQgPSByZXQgPyByZXQgKyAoaXRlbVJldCB8fCBcIlwiKSA6IGl0ZW1SZXQ7IC8vIElmIG5vIHJlbmRlcmVkIGNvbnRlbnQsIHRoaXMgd2lsbCBiZSB1bmRlZmluZWRcblx0XHR9XG5cdFx0dGFnLnJlbmRlcmluZyA9IHVuZGVmaW5lZDtcblx0fVxuXHR0YWcudGFnQ3R4ID0gdGFnQ3R4c1swXTtcblx0dGFnLmN0eCA9IHRhZy50YWdDdHguY3R4O1xuXG5cdGlmICh0YWcuXy5ub1Z3cykge1xuXHRcdFx0aWYgKHRhZy5fLmlubGluZSkge1xuXHRcdFx0Ly8gaW5saW5lIHRhZyB3aXRoIGF0dHIgc2V0IHRvIFwidGV4dFwiIHdpbGwgaW5zZXJ0IEhUTUwtZW5jb2RlZCBjb250ZW50IC0gYXMgaWYgaXQgd2FzIGVsZW1lbnQtYmFzZWQgaW5uZXJUZXh0XG5cdFx0XHRyZXQgPSBhdHRyID09PSBcInRleHRcIlxuXHRcdFx0XHQ/ICRjb252ZXJ0ZXJzLmh0bWwocmV0KVxuXHRcdFx0XHQ6IFwiXCI7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBib3VuZFRhZyAmJiBwYXJlbnRWaWV3Ll8ub25SZW5kZXJcblx0XHQvLyBDYWxsIG9uUmVuZGVyICh1c2VkIGJ5IEpzVmlld3MgaWYgcHJlc2VudCwgdG8gYWRkIGJpbmRpbmcgYW5ub3RhdGlvbnMgYXJvdW5kIHJlbmRlcmVkIGNvbnRlbnQpXG5cdFx0PyBwYXJlbnRWaWV3Ll8ub25SZW5kZXIocmV0LCBwYXJlbnRWaWV3LCB0YWcpXG5cdFx0OiByZXQ7XG59XG5cbi8vPT09PT09PT09PT09PT09PT1cbi8vIFZpZXcgY29uc3RydWN0b3Jcbi8vPT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gVmlldyhjb250ZXh0LCB0eXBlLCBwYXJlbnRWaWV3LCBkYXRhLCB0ZW1wbGF0ZSwga2V5LCBvblJlbmRlciwgY29udGVudFRtcGwpIHtcblx0Ly8gQ29uc3RydWN0b3IgZm9yIHZpZXcgb2JqZWN0IGluIHZpZXcgaGllcmFyY2h5LiAoQXVnbWVudGVkIGJ5IEpzVmlld3MgaWYgSnNWaWV3cyBpcyBsb2FkZWQpXG5cdHZhciB2aWV3cywgcGFyZW50Vmlld18sIHRhZywgc2VsZl8sXG5cdFx0c2VsZiA9IHRoaXMsXG5cdFx0aXNBcnJheSA9IHR5cGUgPT09IFwiYXJyYXlcIjtcblxuXHRzZWxmLmNvbnRlbnQgPSBjb250ZW50VG1wbDtcblx0c2VsZi52aWV3cyA9IGlzQXJyYXkgPyBbXSA6IHt9O1xuXHRzZWxmLnBhcmVudCA9IHBhcmVudFZpZXc7XG5cdHNlbGYudHlwZSA9IHR5cGUgfHwgXCJ0b3BcIjtcblx0c2VsZi5kYXRhID0gZGF0YTtcblx0c2VsZi50bXBsID0gdGVtcGxhdGU7XG5cdC8vIElmIHRoZSBkYXRhIGlzIGFuIGFycmF5LCB0aGlzIGlzIGFuICdhcnJheSB2aWV3JyB3aXRoIGEgdmlld3MgYXJyYXkgZm9yIGVhY2ggY2hpbGQgJ2l0ZW0gdmlldydcblx0Ly8gSWYgdGhlIGRhdGEgaXMgbm90IGFuIGFycmF5LCB0aGlzIGlzIGFuICdpdGVtIHZpZXcnIHdpdGggYSB2aWV3cyAnaGFzaCcgb2JqZWN0IGZvciBhbnkgY2hpbGQgbmVzdGVkIHZpZXdzXG5cdC8vIC5fLnVzZUtleSBpcyBub24gemVybyBpZiBpcyBub3QgYW4gJ2FycmF5IHZpZXcnIChvd25pbmcgYSBkYXRhIGFycmF5KS4gVXNlIHRoaXMgYXMgbmV4dCBrZXkgZm9yIGFkZGluZyB0byBjaGlsZCB2aWV3cyBoYXNoXG5cdHNlbGZfID0gc2VsZi5fID0ge1xuXHRcdGtleTogMCxcblx0XHR1c2VLZXk6IGlzQXJyYXkgPyAwIDogMSxcblx0XHRpZDogXCJcIiArIHZpZXdJZCsrLFxuXHRcdG9uUmVuZGVyOiBvblJlbmRlcixcblx0XHRibmRzOiB7fVxuXHR9O1xuXHRzZWxmLmxpbmtlZCA9ICEhb25SZW5kZXI7XG5cdGlmIChwYXJlbnRWaWV3KSB7XG5cdFx0dmlld3MgPSBwYXJlbnRWaWV3LnZpZXdzO1xuXHRcdHBhcmVudFZpZXdfID0gcGFyZW50Vmlldy5fO1xuXHRcdGlmIChwYXJlbnRWaWV3Xy51c2VLZXkpIHtcblx0XHRcdC8vIFBhcmVudCBpcyBub3QgYW4gJ2FycmF5IHZpZXcnLiBBZGQgdGhpcyB2aWV3IHRvIGl0cyB2aWV3cyBvYmplY3Rcblx0XHRcdC8vIHNlbGYuX2tleSA9IGlzIHRoZSBrZXkgaW4gdGhlIHBhcmVudCB2aWV3IGhhc2hcblx0XHRcdHZpZXdzW3NlbGZfLmtleSA9IFwiX1wiICsgcGFyZW50Vmlld18udXNlS2V5KytdID0gc2VsZjtcblx0XHRcdHNlbGYuaW5kZXggPSBpbmRleFN0cjtcblx0XHRcdHNlbGYuZ2V0SW5kZXggPSBnZXROZXN0ZWRJbmRleDtcblx0XHR9IGVsc2UgaWYgKHZpZXdzLmxlbmd0aCA9PT0gKHNlbGZfLmtleSA9IHNlbGYuaW5kZXggPSBrZXkpKSB7IC8vIFBhcmVudCBpcyBhbiAnYXJyYXkgdmlldycuIEFkZCB0aGlzIHZpZXcgdG8gaXRzIHZpZXdzIGFycmF5XG5cdFx0XHR2aWV3cy5wdXNoKHNlbGYpOyAvLyBBZGRpbmcgdG8gZW5kIG9mIHZpZXdzIGFycmF5LiAoVXNpbmcgcHVzaCB3aGVuIHBvc3NpYmxlIC0gYmV0dGVyIHBlcmYgdGhhbiBzcGxpY2UpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHZpZXdzLnNwbGljZShrZXksIDAsIHNlbGYpOyAvLyBJbnNlcnRpbmcgaW4gdmlld3MgYXJyYXlcblx0XHR9XG5cdFx0Ly8gSWYgbm8gY29udGV4dCB3YXMgcGFzc2VkIGluLCB1c2UgcGFyZW50IGNvbnRleHRcblx0XHQvLyBJZiBjb250ZXh0IHdhcyBwYXNzZWQgaW4sIGl0IHNob3VsZCBoYXZlIGJlZW4gbWVyZ2VkIGFscmVhZHkgd2l0aCBwYXJlbnQgY29udGV4dFxuXHRcdHNlbGYuY3R4ID0gY29udGV4dCB8fCBwYXJlbnRWaWV3LmN0eDtcblx0fSBlbHNlIHtcblx0XHRzZWxmLmN0eCA9IGNvbnRleHQ7XG5cdH1cbn1cblxuVmlldy5wcm90b3R5cGUgPSB7XG5cdGdldDogZ2V0Vmlldyxcblx0Z2V0SW5kZXg6IGdldEluZGV4LFxuXHRnZXRSc2M6IGdldFJlc291cmNlLFxuXHRnZXRUbXBsOiBnZXRUZW1wbGF0ZSxcblx0aGxwOiBnZXRIZWxwZXIsXG5cdF9pczogXCJ2aWV3XCJcbn07XG5cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUmVnaXN0cmF0aW9uXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZUNoaWxkUmVzb3VyY2VzKHBhcmVudFRtcGwpIHtcblx0dmFyIHN0b3JlTmFtZSwgc3RvcmVOYW1lcywgcmVzb3VyY2VzO1xuXHRmb3IgKHN0b3JlTmFtZSBpbiBqc3ZTdG9yZXMpIHtcblx0XHRzdG9yZU5hbWVzID0gc3RvcmVOYW1lICsgXCJzXCI7XG5cdFx0aWYgKHBhcmVudFRtcGxbc3RvcmVOYW1lc10pIHtcblx0XHRcdHJlc291cmNlcyA9IHBhcmVudFRtcGxbc3RvcmVOYW1lc107ICAgIC8vIFJlc291cmNlcyBub3QgeWV0IGNvbXBpbGVkXG5cdFx0XHRwYXJlbnRUbXBsW3N0b3JlTmFtZXNdID0ge307ICAgICAgICAgICAgICAgLy8gUmVtb3ZlIHVuY29tcGlsZWQgcmVzb3VyY2VzXG5cdFx0XHQkdmlld3Nbc3RvcmVOYW1lc10ocmVzb3VyY2VzLCBwYXJlbnRUbXBsKTsgLy8gQWRkIGJhY2sgaW4gdGhlIGNvbXBpbGVkIHJlc291cmNlc1xuXHRcdH1cblx0fVxufVxuXG4vLz09PT09PT09PT09PT09PVxuLy8gY29tcGlsZVRhZ1xuLy89PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZVRhZyhuYW1lLCB0YWdEZWYsIHBhcmVudFRtcGwpIHtcblx0dmFyIHRtcGwsIGJhc2VUYWcsIHByb3AsXG5cdFx0Y29tcGlsZWREZWYgPSBuZXcgJHN1Yi5fdGcoKTtcblxuXHRmdW5jdGlvbiBUYWcoKSB7XG5cdFx0dmFyIHRhZyA9IHRoaXM7XG5cdFx0dGFnLl8gPSB7XG5cdFx0XHRpbmxpbmU6IHRydWUsXG5cdFx0XHR1bmxpbmtlZDogdHJ1ZVxuXHRcdH07XG5cblx0XHR0YWcudGFnTmFtZSA9IG5hbWU7XG5cdH1cblxuXHRpZiAoJGlzRnVuY3Rpb24odGFnRGVmKSkge1xuXHRcdC8vIFNpbXBsZSB0YWcgZGVjbGFyZWQgYXMgZnVuY3Rpb24uIE5vIHByZXNlbnRlciBpbnN0YW50YXRpb24uXG5cdFx0dGFnRGVmID0ge1xuXHRcdFx0ZGVwZW5kczogdGFnRGVmLmRlcGVuZHMsXG5cdFx0XHRyZW5kZXI6IHRhZ0RlZlxuXHRcdH07XG5cdH0gZWxzZSBpZiAoXCJcIiArIHRhZ0RlZiA9PT0gdGFnRGVmKSB7XG5cdFx0dGFnRGVmID0ge3RlbXBsYXRlOiB0YWdEZWZ9O1xuXHR9XG5cdGlmIChiYXNlVGFnID0gdGFnRGVmLmJhc2VUYWcpIHtcblx0XHR0YWdEZWYuZmxvdyA9ICEhdGFnRGVmLmZsb3c7IC8vIFNldCBmbG93IHByb3BlcnR5LCBzbyBkZWZhdWx0cyB0byBmYWxzZSBldmVuIGlmIGJhc2VUYWcgaGFzIGZsb3c9dHJ1ZVxuXHRcdHRhZ0RlZi5iYXNlVGFnID0gYmFzZVRhZyA9IFwiXCIgKyBiYXNlVGFnID09PSBiYXNlVGFnXG5cdFx0XHQ/IChwYXJlbnRUbXBsICYmIHBhcmVudFRtcGwudGFnc1tiYXNlVGFnXSB8fCAkdGFnc1tiYXNlVGFnXSlcblx0XHRcdDogYmFzZVRhZztcblxuXHRcdGNvbXBpbGVkRGVmID0gJGV4dGVuZChjb21waWxlZERlZiwgYmFzZVRhZyk7XG5cblx0XHRmb3IgKHByb3AgaW4gdGFnRGVmKSB7XG5cdFx0XHRjb21waWxlZERlZltwcm9wXSA9IGdldE1ldGhvZChiYXNlVGFnW3Byb3BdLCB0YWdEZWZbcHJvcF0pO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRjb21waWxlZERlZiA9ICRleHRlbmQoY29tcGlsZWREZWYsIHRhZ0RlZik7XG5cdH1cblxuXHQvLyBUYWcgZGVjbGFyZWQgYXMgb2JqZWN0LCB1c2VkIGFzIHRoZSBwcm90b3R5cGUgZm9yIHRhZyBpbnN0YW50aWF0aW9uIChjb250cm9sL3ByZXNlbnRlcilcblx0aWYgKCh0bXBsID0gY29tcGlsZWREZWYudGVtcGxhdGUpICE9PSB1bmRlZmluZWQpIHtcblx0XHRjb21waWxlZERlZi50ZW1wbGF0ZSA9IFwiXCIgKyB0bXBsID09PSB0bXBsID8gKCR0ZW1wbGF0ZXNbdG1wbF0gfHwgJHRlbXBsYXRlcyh0bXBsKSkgOiB0bXBsO1xuXHR9XG5cdGlmIChjb21waWxlZERlZi5pbml0ICE9PSBmYWxzZSkge1xuXHRcdC8vIFNldCBpbml0OiBmYWxzZSBvbiB0YWdEZWYgaWYgeW91IHdhbnQgdG8gcHJvdmlkZSBqdXN0IGEgcmVuZGVyIG1ldGhvZCwgb3IgcmVuZGVyIGFuZCB0ZW1wbGF0ZSwgYnV0IG5vIGNvbnN0cnVjdG9yIG9yIHByb3RvdHlwZS5cblx0XHQvLyBzbyBlcXVpdmFsZW50IHRvIHNldHRpbmcgdGFnIHRvIHJlbmRlciBmdW5jdGlvbiwgZXhjZXB0IHlvdSBjYW4gYWxzbyBwcm92aWRlIGEgdGVtcGxhdGUuXG5cdFx0KFRhZy5wcm90b3R5cGUgPSBjb21waWxlZERlZikuY29uc3RydWN0b3IgPSBjb21waWxlZERlZi5fY3RyID0gVGFnO1xuXHR9XG5cblx0aWYgKHBhcmVudFRtcGwpIHtcblx0XHRjb21waWxlZERlZi5fcGFyZW50VG1wbCA9IHBhcmVudFRtcGw7XG5cdH1cblx0cmV0dXJuIGNvbXBpbGVkRGVmO1xufVxuXG5mdW5jdGlvbiBiYXNlQXBwbHkoYXJncykge1xuXHQvLyBJbiBkZXJpdmVkIG1ldGhvZCAob3IgaGFuZGxlciBkZWNsYXJlZCBkZWNsYXJhdGl2ZWx5IGFzIGluIHt7OmZvbyBvbkNoYW5nZT1+Zm9vQ2hhbmdlZH19IGNhbiBjYWxsIGJhc2UgbWV0aG9kLFxuXHQvLyB1c2luZyB0aGlzLmJhc2VBcHBseShhcmd1bWVudHMpIChFcXVpdmFsZW50IHRvIHRoaXMuX3N1cGVyQXBwbHkoYXJndW1lbnRzKSBpbiBqUXVlcnkgVUkpXG5cdHJldHVybiB0aGlzLmJhc2UuYXBwbHkodGhpcywgYXJncyk7XG59XG5cbi8vPT09PT09PT09PT09PT09XG4vLyBjb21waWxlVG1wbFxuLy89PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gY29tcGlsZVRtcGwobmFtZSwgdG1wbCwgcGFyZW50VG1wbCwgb3B0aW9ucykge1xuXHQvLyB0bXBsIGlzIGVpdGhlciBhIHRlbXBsYXRlIG9iamVjdCwgYSBzZWxlY3RvciBmb3IgYSB0ZW1wbGF0ZSBzY3JpcHQgYmxvY2ssIHRoZSBuYW1lIG9mIGEgY29tcGlsZWQgdGVtcGxhdGUsIG9yIGEgdGVtcGxhdGUgb2JqZWN0XG5cblx0Ly89PT09IG5lc3RlZCBmdW5jdGlvbnMgPT09PVxuXHRmdW5jdGlvbiBsb29rdXBUZW1wbGF0ZSh2YWx1ZSkge1xuXHRcdC8vIElmIHZhbHVlIGlzIG9mIHR5cGUgc3RyaW5nIC0gdHJlYXQgYXMgc2VsZWN0b3IsIG9yIG5hbWUgb2YgY29tcGlsZWQgdGVtcGxhdGVcblx0XHQvLyBSZXR1cm4gdGhlIHRlbXBsYXRlIG9iamVjdCwgaWYgYWxyZWFkeSBjb21waWxlZCwgb3IgdGhlIG1hcmt1cCBzdHJpbmdcblx0XHR2YXIgY3VycmVudE5hbWUsIHRtcGw7XG5cdFx0aWYgKChcIlwiICsgdmFsdWUgPT09IHZhbHVlKSB8fCB2YWx1ZS5ub2RlVHlwZSA+IDAgJiYgKGVsZW0gPSB2YWx1ZSkpIHtcblx0XHRcdGlmICghZWxlbSkge1xuXHRcdFx0XHRpZiAoL15cXC5cXC9bXlxcXFw6Kj9cIjw+XSokLy50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHRtcGw9XCIuL3NvbWUvZmlsZS5odG1sXCJcblx0XHRcdFx0XHQvLyBJZiB0aGUgdGVtcGxhdGUgaXMgbm90IG5hbWVkLCB1c2UgXCIuL3NvbWUvZmlsZS5odG1sXCIgYXMgbmFtZS5cblx0XHRcdFx0XHRpZiAodG1wbCA9ICR0ZW1wbGF0ZXNbbmFtZSA9IG5hbWUgfHwgdmFsdWVdKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IHRtcGw7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIEJST1dTRVItU1BFQ0lGSUMgQ09ERSAobm90IG9uIE5vZGUuanMpOlxuXHRcdFx0XHRcdFx0Ly8gTG9vayBmb3Igc2VydmVyLWdlbmVyYXRlZCBzY3JpcHQgYmxvY2sgd2l0aCBpZCBcIi4vc29tZS9maWxlLmh0bWxcIlxuXHRcdFx0XHRcdFx0ZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoJC5mbiAmJiAhJHN1Yi5yVG1wbC50ZXN0KHZhbHVlKSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRlbGVtID0gJChkb2N1bWVudCkuZmluZCh2YWx1ZSlbMF07IC8vIGlmIGpRdWVyeSBpcyBsb2FkZWQsIHRlc3QgZm9yIHNlbGVjdG9yIHJldHVybmluZyBlbGVtZW50cywgYW5kIGdldCBmaXJzdCBlbGVtZW50XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge31cblx0XHRcdFx0fS8vIEVORCBCUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdH0gLy9CUk9XU0VSLVNQRUNJRklDIENPREVcblx0XHRcdGlmIChlbGVtKSB7XG5cdFx0XHRcdC8vIEdlbmVyYWxseSB0aGlzIGlzIGEgc2NyaXB0IGVsZW1lbnQuXG5cdFx0XHRcdC8vIEhvd2V2ZXIgd2UgYWxsb3cgaXQgdG8gYmUgYW55IGVsZW1lbnQsIHNvIHlvdSBjYW4gZm9yIGV4YW1wbGUgdGFrZSB0aGUgY29udGVudCBvZiBhIGRpdixcblx0XHRcdFx0Ly8gdXNlIGl0IGFzIGEgdGVtcGxhdGUsIGFuZCByZXBsYWNlIGl0IGJ5IHRoZSBzYW1lIGNvbnRlbnQgcmVuZGVyZWQgYWdhaW5zdCBkYXRhLlxuXHRcdFx0XHQvLyBlLmcuIGZvciBsaW5raW5nIHRoZSBjb250ZW50IG9mIGEgZGl2IHRvIGEgY29udGFpbmVyLCBhbmQgdXNpbmcgdGhlIGluaXRpYWwgY29udGVudCBhcyB0ZW1wbGF0ZTpcblx0XHRcdFx0Ly8gJC5saW5rKFwiI2NvbnRlbnRcIiwgbW9kZWwsIHt0bXBsOiBcIiNjb250ZW50XCJ9KTtcblx0XHRcdFx0aWYgKG9wdGlvbnMpIHtcblx0XHRcdFx0XHQvLyBXZSB3aWxsIGNvbXBpbGUgYSBuZXcgdGVtcGxhdGUgdXNpbmcgdGhlIG1hcmt1cCBpbiB0aGUgc2NyaXB0IGVsZW1lbnRcblx0XHRcdFx0XHR2YWx1ZSA9IGVsZW0uaW5uZXJIVE1MO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFdlIHdpbGwgY2FjaGUgYSBzaW5nbGUgY29weSBvZiB0aGUgY29tcGlsZWQgdGVtcGxhdGUsIGFuZCBhc3NvY2lhdGUgaXQgd2l0aCB0aGUgbmFtZVxuXHRcdFx0XHRcdC8vIChyZW5hbWluZyBmcm9tIGEgcHJldmlvdXMgbmFtZSBpZiB0aGVyZSB3YXMgb25lKS5cblx0XHRcdFx0XHRjdXJyZW50TmFtZSA9IGVsZW0uZ2V0QXR0cmlidXRlKHRtcGxBdHRyKTtcblx0XHRcdFx0XHRpZiAoY3VycmVudE5hbWUpIHtcblx0XHRcdFx0XHRcdGlmIChjdXJyZW50TmFtZSAhPT0ganN2VG1wbCkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9ICR0ZW1wbGF0ZXNbY3VycmVudE5hbWVdO1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgJHRlbXBsYXRlc1tjdXJyZW50TmFtZV07XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCQuZm4pIHtcblx0XHRcdFx0XHRcdFx0dmFsdWUgPSAkLmRhdGEoZWxlbSlbanN2VG1wbF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG5hbWUgPSBuYW1lIHx8ICgkLmZuID8ganN2VG1wbCA6IHZhbHVlKTtcblx0XHRcdFx0XHRcdHZhbHVlID0gY29tcGlsZVRtcGwobmFtZSwgZWxlbS5pbm5lckhUTUwsIHBhcmVudFRtcGwsIG9wdGlvbnMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YWx1ZS50bXBsTmFtZSA9IG5hbWUgPSBuYW1lIHx8IGN1cnJlbnROYW1lO1xuXHRcdFx0XHRcdGlmIChuYW1lICE9PSBqc3ZUbXBsKSB7XG5cdFx0XHRcdFx0XHQkdGVtcGxhdGVzW25hbWVdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsZW0uc2V0QXR0cmlidXRlKHRtcGxBdHRyLCBuYW1lKTtcblx0XHRcdFx0XHRpZiAoJC5mbikge1xuXHRcdFx0XHRcdFx0JC5kYXRhKGVsZW0sIGpzdlRtcGwsIHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gLy8gRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdFx0ZWxlbSA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKCF2YWx1ZS5mbikge1xuXHRcdFx0dmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0XHQvLyBJZiB2YWx1ZSBpcyBub3QgYSBzdHJpbmcuIEhUTUwgZWxlbWVudCwgb3IgY29tcGlsZWQgdGVtcGxhdGUsIHJldHVybiB1bmRlZmluZWRcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0dmFyIGVsZW0sIGNvbXBpbGVkVG1wbCxcblx0XHR0bXBsT3JNYXJrdXAgPSB0bXBsID0gdG1wbCB8fCBcIlwiO1xuXG5cdC8vPT09PSBDb21waWxlIHRoZSB0ZW1wbGF0ZSA9PT09XG5cdGlmIChvcHRpb25zID09PSAwKSB7XG5cdFx0b3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHR0bXBsT3JNYXJrdXAgPSBsb29rdXBUZW1wbGF0ZSh0bXBsT3JNYXJrdXApOyAvLyBUb3AtbGV2ZWwgY29tcGlsZSBzbyBkbyBhIHRlbXBsYXRlIGxvb2t1cFxuXHR9XG5cblx0Ly8gSWYgb3B0aW9ucywgdGhlbiB0aGlzIHdhcyBhbHJlYWR5IGNvbXBpbGVkIGZyb20gYSAoc2NyaXB0KSBlbGVtZW50IHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuXHQvLyBJZiBub3QsIHRoZW4gaWYgdG1wbCBpcyBhIHRlbXBsYXRlIG9iamVjdCwgdXNlIGl0IGZvciBvcHRpb25zXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8ICh0bXBsLm1hcmt1cCA/IHRtcGwgOiB7fSk7XG5cdG9wdGlvbnMudG1wbE5hbWUgPSBuYW1lO1xuXHRpZiAocGFyZW50VG1wbCkge1xuXHRcdG9wdGlvbnMuX3BhcmVudFRtcGwgPSBwYXJlbnRUbXBsO1xuXHR9XG5cdC8vIElmIHRtcGwgaXMgbm90IGEgbWFya3VwIHN0cmluZyBvciBhIHNlbGVjdG9yIHN0cmluZywgdGhlbiBpdCBtdXN0IGJlIGEgdGVtcGxhdGUgb2JqZWN0XG5cdC8vIEluIHRoYXQgY2FzZSwgZ2V0IGl0IGZyb20gdGhlIG1hcmt1cCBwcm9wZXJ0eSBvZiB0aGUgb2JqZWN0XG5cdGlmICghdG1wbE9yTWFya3VwICYmIHRtcGwubWFya3VwICYmICh0bXBsT3JNYXJrdXAgPSBsb29rdXBUZW1wbGF0ZSh0bXBsLm1hcmt1cCkpKSB7XG5cdFx0aWYgKHRtcGxPck1hcmt1cC5mbikge1xuXHRcdFx0Ly8gSWYgdGhlIHN0cmluZyByZWZlcmVuY2VzIGEgY29tcGlsZWQgdGVtcGxhdGUgb2JqZWN0LCBuZWVkIHRvIHJlY29tcGlsZSB0byBtZXJnZSBhbnkgbW9kaWZpZWQgb3B0aW9uc1xuXHRcdFx0dG1wbE9yTWFya3VwID0gdG1wbE9yTWFya3VwLm1hcmt1cDtcblx0XHR9XG5cdH1cblx0aWYgKHRtcGxPck1hcmt1cCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRtcGxPck1hcmt1cC5mbiB8fCB0bXBsLmZuKSB7XG5cdFx0XHQvLyB0bXBsIGlzIGFscmVhZHkgY29tcGlsZWQsIHNvIHVzZSBpdFxuXHRcdFx0aWYgKHRtcGxPck1hcmt1cC5mbikge1xuXHRcdFx0XHRjb21waWxlZFRtcGwgPSB0bXBsT3JNYXJrdXA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRtcGxPck1hcmt1cCBpcyBhIG1hcmt1cCBzdHJpbmcsIG5vdCBhIGNvbXBpbGVkIHRlbXBsYXRlXG5cdFx0XHQvLyBDcmVhdGUgdGVtcGxhdGUgb2JqZWN0XG5cdFx0XHR0bXBsID0gdG1wbE9iamVjdCh0bXBsT3JNYXJrdXAsIG9wdGlvbnMpO1xuXHRcdFx0Ly8gQ29tcGlsZSB0byBBU1QgYW5kIHRoZW4gdG8gY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdHRtcGxGbih0bXBsT3JNYXJrdXAucmVwbGFjZShyRXNjYXBlUXVvdGVzLCBcIlxcXFwkJlwiKSwgdG1wbCk7XG5cdFx0fVxuXHRcdGlmICghY29tcGlsZWRUbXBsKSB7XG5cdFx0XHRjb21waWxlZFRtcGwgPSAkZXh0ZW5kKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gY29tcGlsZWRUbXBsLnJlbmRlci5hcHBseShjb21waWxlZFRtcGwsIGFyZ3VtZW50cyk7XG5cdFx0XHR9LCB0bXBsKTtcblxuXHRcdFx0Y29tcGlsZUNoaWxkUmVzb3VyY2VzKGNvbXBpbGVkVG1wbCk7XG5cdFx0fVxuXHRcdGlmIChuYW1lICYmICFwYXJlbnRUbXBsICYmIG5hbWUgIT09IGpzdlRtcGwpIHtcblx0XHRcdCRyZW5kZXJbbmFtZV0gPSBjb21waWxlZFRtcGw7XG5cdFx0fVxuXHRcdHJldHVybiBjb21waWxlZFRtcGw7XG5cdH1cbn1cblxuLy89PT09IC9lbmQgb2YgZnVuY3Rpb24gY29tcGlsZVRtcGwgPT09PVxuXG4vLz09PT09PT09PT09PT09PT09XG4vLyBjb21waWxlVmlld01vZGVsXG4vLz09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRWYWwoZGVmYXVsdFZhbCwgZGF0YSkge1xuXHRyZXR1cm4gJC5pc0Z1bmN0aW9uKGRlZmF1bHRWYWwpXG5cdFx0PyBkZWZhdWx0VmFsLmNhbGwoZGF0YSlcblx0XHQ6IGRlZmF1bHRWYWw7XG59XG5cbmZ1bmN0aW9uIHVubWFwQXJyYXkobW9kZWxBcnIpIHtcblx0XHR2YXIgaSwgYXJyID0gW10sXG5cdFx0XHRsID0gbW9kZWxBcnIubGVuZ3RoO1xuXHRcdGZvciAoaT0wOyBpPGw7IGkrKykge1xuXHRcdFx0YXJyLnB1c2gobW9kZWxBcnJbaV0udW5tYXAoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnI7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVWaWV3TW9kZWwobmFtZSwgdHlwZSkge1xuXHR2YXIgaSwgY29uc3RydWN0b3IsXG5cdFx0dmlld01vZGVscyA9IHRoaXMsXG5cdFx0Z2V0dGVycyA9IHR5cGUuZ2V0dGVycyxcblx0XHRleHRlbmQgPSB0eXBlLmV4dGVuZCxcblx0XHRpZCA9IHR5cGUuaWQsXG5cdFx0cHJvdG8gPSAkLmV4dGVuZCh7XG5cdFx0XHRfaXM6IG5hbWUgfHwgXCJ1bm5hbWVkXCIsXG5cdFx0XHR1bm1hcDogdW5tYXAsXG5cdFx0XHRtZXJnZTogbWVyZ2Vcblx0XHR9LCBleHRlbmQpLFxuXHRcdGFyZ3MgPSBcIlwiLFxuXHRcdGJvZHkgPSBcIlwiLFxuXHRcdGwgPSBnZXR0ZXJzID8gZ2V0dGVycy5sZW5ndGggOiAwLFxuXHRcdCRvYnNlcnZhYmxlID0gJC5vYnNlcnZhYmxlLFxuXHRcdGdldHRlck5hbWVzID0ge307XG5cblx0ZnVuY3Rpb24gR2V0TmV3KGFyZ3MpIHtcblx0XHRjb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmdzKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZtKCkge1xuXHRcdHJldHVybiBuZXcgR2V0TmV3KGFyZ3VtZW50cyk7XG5cdH1cblxuXHRmdW5jdGlvbiBpdGVyYXRlKGRhdGEsIGFjdGlvbikge1xuXHRcdHZhciBqLCBnZXR0ZXJUeXBlLCBkZWZhdWx0VmFsLCBwcm9wLCBvYixcblx0XHRcdG0gPSBnZXR0ZXJzLmxlbmd0aDtcblx0XHRmb3IgKGo9MDsgajxtOyBqKyspIHtcblx0XHRcdHByb3AgPSBnZXR0ZXJzW2pdO1xuXHRcdFx0Z2V0dGVyVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcm9wICsgXCJcIiAhPT0gcHJvcCkge1xuXHRcdFx0XHRnZXR0ZXJUeXBlID0gcHJvcDtcblx0XHRcdFx0cHJvcCA9IGdldHRlclR5cGUuZ2V0dGVyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKChvYiA9IGRhdGFbcHJvcF0pID09PSB1bmRlZmluZWQgJiYgZ2V0dGVyVHlwZSAmJiAoZGVmYXVsdFZhbCA9IGdldHRlclR5cGUuZGVmYXVsdFZhbCkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRvYiA9IGdldERlZmF1bHRWYWwoZGVmYXVsdFZhbCwgZGF0YSk7XG5cdFx0XHR9XG5cdFx0XHRhY3Rpb24ob2IsIGdldHRlclR5cGUgJiYgdmlld01vZGVsc1tnZXR0ZXJUeXBlLnR5cGVdLCBwcm9wKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBtYXAoZGF0YSkge1xuXHRcdGRhdGEgPSBkYXRhICsgXCJcIiA9PT0gZGF0YVxuXHRcdFx0PyBKU09OLnBhcnNlKGRhdGEpIC8vIEFjY2VwdCBKU09OIHN0cmluZ1xuXHRcdFx0OiBkYXRhOyAgICAgICAgICAgIC8vIG9yIG9iamVjdC9hcnJheVxuXHRcdHZhciBpLCBqLCAgbCwgbSwgcHJvcCxcblx0XHRcdG9iID0gZGF0YSxcblx0XHRcdGFyciA9IFtdO1xuXG5cdFx0aWYgKCRpc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRkYXRhID0gZGF0YSB8fCBbXTtcblx0XHRcdGwgPSBkYXRhLmxlbmd0aDtcblx0XHRcdGZvciAoaT0wOyBpPGw7IGkrKykge1xuXHRcdFx0XHRhcnIucHVzaCh0aGlzLm1hcChkYXRhW2ldKSk7XG5cdFx0XHR9XG5cdFx0XHRhcnIuX2lzID0gbmFtZTtcblx0XHRcdGFyci51bm1hcCA9IHVubWFwO1xuXHRcdFx0YXJyLm1lcmdlID0gbWVyZ2U7XG5cdFx0XHRyZXR1cm4gYXJyO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRpdGVyYXRlKGRhdGEsIGZ1bmN0aW9uKG9iLCB2aWV3TW9kZWwpIHtcblx0XHRcdFx0aWYgKHZpZXdNb2RlbCkgeyAvLyBJdGVyYXRlIHRvIGJ1aWxkIGdldHRlcnMgYXJnIGFycmF5ICh2YWx1ZSwgb3IgbWFwcGVkIHZhbHVlKVxuXHRcdFx0XHRcdG9iID0gdmlld01vZGVsLm1hcChvYik7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXJyLnB1c2gob2IpO1xuXHRcdFx0fSk7XG5cblx0XHRcdG9iID0gdGhpcy5hcHBseSh0aGlzLCBhcnIpOyAvLyBJbnNhbnRpYXRlIHRoaXMgVmlldyBNb2RlbCwgcGFzc2luZyBnZXR0ZXJzIGFyZ3MgYXJyYXkgdG8gY29uc3RydWN0b3Jcblx0XHRcdGZvciAocHJvcCBpbiBkYXRhKSB7IC8vIENvcHkgb3ZlciBhbnkgb3RoZXIgcHJvcGVydGllcy4gdGhhdCBhcmUgbm90IGdldC9zZXQgcHJvcGVydGllc1xuXHRcdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gICYmICFnZXR0ZXJOYW1lc1twcm9wXSkge1xuXHRcdFx0XHRcdG9iW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb2I7XG5cdH1cblxuXHRmdW5jdGlvbiBtZXJnZShkYXRhKSB7XG5cdFx0ZGF0YSA9IGRhdGEgKyBcIlwiID09PSBkYXRhXG5cdFx0XHQ/IEpTT04ucGFyc2UoZGF0YSkgLy8gQWNjZXB0IEpTT04gc3RyaW5nXG5cdFx0XHQ6IGRhdGE7ICAgICAgICAgICAgLy8gb3Igb2JqZWN0L2FycmF5XG5cdFx0dmFyIGksIGosIGwsIG0sIHByb3AsIG1vZCwgZm91bmQsIGFzc2lnbmVkLCBvYiwgbmV3TW9kQXJyLFxuXHRcdFx0bW9kZWwgPSB0aGlzO1xuXG5cdFx0aWYgKCRpc0FycmF5KG1vZGVsKSkge1xuXHRcdFx0YXNzaWduZWQgPSB7fTtcblx0XHRcdG5ld01vZEFyciA9IFtdO1xuXHRcdFx0bCA9IGRhdGEubGVuZ3RoO1xuXHRcdFx0bSA9IG1vZGVsLmxlbmd0aDtcblx0XHRcdGZvciAoaT0wOyBpPGw7IGkrKykge1xuXHRcdFx0XHRvYiA9IGRhdGFbaV07XG5cdFx0XHRcdGZvdW5kID0gZmFsc2U7XG5cdFx0XHRcdGZvciAoaj0wOyBqPG0gJiYgIWZvdW5kOyBqKyspIHtcblx0XHRcdFx0XHRpZiAoYXNzaWduZWRbal0pIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtb2QgPSBtb2RlbFtqXTtcblxuXHRcdFx0XHRcdGlmIChpZCkge1xuXHRcdFx0XHRcdFx0YXNzaWduZWRbal0gPSBmb3VuZCA9IGlkICsgXCJcIiA9PT0gaWRcblx0XHRcdFx0XHRcdD8gKG9iW2lkXSAmJiAoZ2V0dGVyTmFtZXNbaWRdID8gbW9kW2lkXSgpIDogbW9kW2lkXSkgPT09IG9iW2lkXSlcblx0XHRcdFx0XHRcdDogaWQobW9kLCBvYik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRcdG1vZC5tZXJnZShvYik7XG5cdFx0XHRcdFx0bmV3TW9kQXJyLnB1c2gobW9kKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXdNb2RBcnIucHVzaCh2bS5tYXAob2IpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCRvYnNlcnZhYmxlKSB7XG5cdFx0XHRcdCRvYnNlcnZhYmxlKG1vZGVsKS5yZWZyZXNoKG5ld01vZEFyciwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb2RlbC5zcGxpY2UuYXBwbHkobW9kZWwsIFswLCBtb2RlbC5sZW5ndGhdLmNvbmNhdChuZXdNb2RBcnIpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aXRlcmF0ZShkYXRhLCBmdW5jdGlvbihvYiwgdmlld01vZGVsLCBnZXR0ZXIpIHtcblx0XHRcdGlmICh2aWV3TW9kZWwpIHtcblx0XHRcdFx0bW9kZWxbZ2V0dGVyXSgpLm1lcmdlKG9iKTsgLy8gVXBkYXRlIHR5cGVkIHByb3BlcnR5XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb2RlbFtnZXR0ZXJdKG9iKTsgLy8gVXBkYXRlIG5vbi10eXBlZCBwcm9wZXJ0eVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGZvciAocHJvcCBpbiBkYXRhKSB7XG5cdFx0XHRpZiAocHJvcCAhPT0gJGV4cGFuZG8gJiYgIWdldHRlck5hbWVzW3Byb3BdKSB7XG5cdFx0XHRcdG1vZGVsW3Byb3BdID0gZGF0YVtwcm9wXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiB1bm1hcCgpIHtcblx0XHR2YXIgb2IsIHByb3AsIGksIGwsIGdldHRlclR5cGUsIGFyciwgdmFsdWUsXG5cdFx0XHRtb2RlbCA9IHRoaXM7XG5cblx0XHRpZiAoJGlzQXJyYXkobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gdW5tYXBBcnJheShtb2RlbCk7XG5cdFx0fVxuXHRcdG9iID0ge307XG5cdFx0bCA9IGdldHRlcnMubGVuZ3RoO1xuXHRcdGZvciAoaT0wOyBpPGw7IGkrKykge1xuXHRcdFx0cHJvcCA9IGdldHRlcnNbaV07XG5cdFx0XHRnZXR0ZXJUeXBlID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHByb3AgKyBcIlwiICE9PSBwcm9wKSB7XG5cdFx0XHRcdGdldHRlclR5cGUgPSBwcm9wO1xuXHRcdFx0XHRwcm9wID0gZ2V0dGVyVHlwZS5nZXR0ZXI7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZSA9IG1vZGVsW3Byb3BdKCk7XG5cdFx0XHRvYltwcm9wXSA9IGdldHRlclR5cGUgJiYgdmFsdWUgJiYgdmlld01vZGVsc1tnZXR0ZXJUeXBlLnR5cGVdXG5cdFx0XHRcdD8gJGlzQXJyYXkodmFsdWUpXG5cdFx0XHRcdFx0PyB1bm1hcEFycmF5KHZhbHVlKVxuXHRcdFx0XHRcdDogdmFsdWUudW5tYXAoKVxuXHRcdFx0XHQ6IHZhbHVlO1xuXHRcdH1cblx0XHRmb3IgKHByb3AgaW4gbW9kZWwpIHtcblx0XHRcdGlmIChwcm9wICE9PSBcIl9pc1wiICYmICFnZXR0ZXJOYW1lc1twcm9wXSAmJiBwcm9wICE9PSAkZXhwYW5kbyAgJiYgKHByb3AuY2hhckF0KDApICE9PSBcIl9cIiB8fCAhZ2V0dGVyTmFtZXNbcHJvcC5zbGljZSgxKV0pICYmICEkLmlzRnVuY3Rpb24obW9kZWxbcHJvcF0pKSB7XG5cdFx0XHRcdG9iW3Byb3BdID0gbW9kZWxbcHJvcF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvYjtcblx0fVxuXG5cdEdldE5ldy5wcm90b3R5cGUgPSBwcm90bztcblxuXHRmb3IgKGk9MDsgaTxsOyBpKyspIHtcblx0XHQoZnVuY3Rpb24oZ2V0dGVyKSB7XG5cdFx0XHRnZXR0ZXIgPSBnZXR0ZXIuZ2V0dGVyIHx8IGdldHRlcjtcblx0XHRcdGdldHRlck5hbWVzW2dldHRlcl0gPSBpKzE7XG5cdFx0XHR2YXIgcHJpdkZpZWxkID0gXCJfXCIgKyBnZXR0ZXI7XG5cblx0XHRcdGFyZ3MgKz0gKGFyZ3MgPyBcIixcIiA6IFwiXCIpICsgZ2V0dGVyO1xuXHRcdFx0Ym9keSArPSBcInRoaXMuXCIgKyBwcml2RmllbGQgKyBcIiA9IFwiICsgZ2V0dGVyICsgXCI7XFxuXCI7XG5cdFx0XHRwcm90b1tnZXR0ZXJdID0gcHJvdG9bZ2V0dGVyXSB8fCBmdW5jdGlvbih2YWwpIHtcblx0XHRcdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXNbcHJpdkZpZWxkXTsgLy8gSWYgdGhlcmUgaXMgbm8gYXJndW1lbnQsIHVzZSBhcyBhIGdldHRlclxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRcdCRvYnNlcnZhYmxlKHRoaXMpLnNldFByb3BlcnR5KGdldHRlciwgdmFsKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzW3ByaXZGaWVsZF0gPSB2YWw7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGlmICgkb2JzZXJ2YWJsZSkge1xuXHRcdFx0XHRwcm90b1tnZXR0ZXJdLnNldCA9IHByb3RvW2dldHRlcl0uc2V0IHx8IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0XHRcdHRoaXNbcHJpdkZpZWxkXSA9IHZhbDsgLy8gU2V0dGVyIGNhbGxlZCBieSBvYnNlcnZhYmxlIHByb3BlcnR5IGNoYW5nZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKGdldHRlcnNbaV0pO1xuXHR9XG5cblx0Y29uc3RydWN0b3IgPSBuZXcgRnVuY3Rpb24oYXJncywgYm9keS5zbGljZSgwLCAtMSkpO1xuXHRjb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBwcm90bztcblx0cHJvdG8uY29uc3RydWN0b3IgPSBjb25zdHJ1Y3RvcjtcblxuXHR2bS5tYXAgPSBtYXA7XG5cdHZtLmdldHRlcnMgPSBnZXR0ZXJzO1xuXHR2bS5leHRlbmQgPSBleHRlbmQ7XG5cdHZtLmlkID0gaWQ7XG5cdHJldHVybiB2bTtcbn1cblxuZnVuY3Rpb24gdG1wbE9iamVjdChtYXJrdXAsIG9wdGlvbnMpIHtcblx0Ly8gVGVtcGxhdGUgb2JqZWN0IGNvbnN0cnVjdG9yXG5cdHZhciBodG1sVGFnLFxuXHRcdHdyYXBNYXAgPSAkc3ViU2V0dGluZ3NBZHZhbmNlZC5fd20gfHwge30sIC8vIE9ubHkgdXNlZCBpbiBKc1ZpZXdzLiBPdGhlcndpc2UgZW1wdHk6IHt9XG5cdFx0dG1wbCA9ICRleHRlbmQoXG5cdFx0XHR7XG5cdFx0XHRcdHRtcGxzOiBbXSxcblx0XHRcdFx0bGlua3M6IHt9LCAvLyBDb21waWxlZCBmdW5jdGlvbnMgZm9yIGxpbmsgZXhwcmVzc2lvbnNcblx0XHRcdFx0Ym5kczogW10sXG5cdFx0XHRcdF9pczogXCJ0ZW1wbGF0ZVwiLFxuXHRcdFx0XHRyZW5kZXI6IHJlbmRlckNvbnRlbnRcblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zXG5cdFx0KTtcblxuXHR0bXBsLm1hcmt1cCA9IG1hcmt1cDtcblx0aWYgKCFvcHRpb25zLmh0bWxUYWcpIHtcblx0XHQvLyBTZXQgdG1wbC50YWcgdG8gdGhlIHRvcC1sZXZlbCBIVE1MIHRhZyB1c2VkIGluIHRoZSB0ZW1wbGF0ZSwgaWYgYW55Li4uXG5cdFx0aHRtbFRhZyA9IHJGaXJzdEVsZW0uZXhlYyhtYXJrdXApO1xuXHRcdHRtcGwuaHRtbFRhZyA9IGh0bWxUYWcgPyBodG1sVGFnWzFdLnRvTG93ZXJDYXNlKCkgOiBcIlwiO1xuXHR9XG5cdGh0bWxUYWcgPSB3cmFwTWFwW3RtcGwuaHRtbFRhZ107XG5cdGlmIChodG1sVGFnICYmIGh0bWxUYWcgIT09IHdyYXBNYXAuZGl2KSB7XG5cdFx0Ly8gV2hlbiB1c2luZyBKc1ZpZXdzLCB3ZSB0cmltIHRlbXBsYXRlcyB3aGljaCBhcmUgaW5zZXJ0ZWQgaW50byBIVE1MIGNvbnRleHRzIHdoZXJlIHRleHQgbm9kZXMgYXJlIG5vdCByZW5kZXJlZCAoaS5lLiBub3QgJ1BocmFzaW5nIENvbnRlbnQnKS5cblx0XHQvLyBDdXJyZW50bHkgbm90IHRyaW1tZWQgZm9yIDxsaT4gdGFnLiAoTm90IHdvcnRoIGFkZGluZyBwZXJmIGNvc3QpXG5cdFx0dG1wbC5tYXJrdXAgPSAkLnRyaW0odG1wbC5tYXJrdXApO1xuXHR9XG5cblx0cmV0dXJuIHRtcGw7XG59XG5cbi8vPT09PT09PT09PT09PT1cbi8vIHJlZ2lzdGVyU3RvcmVcbi8vPT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTdG9yZShzdG9yZU5hbWUsIHN0b3JlU2V0dGluZ3MpIHtcblxuXHRmdW5jdGlvbiB0aGVTdG9yZShuYW1lLCBpdGVtLCBwYXJlbnRUbXBsKSB7XG5cdFx0Ly8gVGhlIHN0b3JlIGlzIGFsc28gdGhlIGZ1bmN0aW9uIHVzZWQgdG8gYWRkIGl0ZW1zIHRvIHRoZSBzdG9yZS4gZS5nLiAkLnRlbXBsYXRlcywgb3IgJC52aWV3cy50YWdzXG5cblx0XHQvLyBGb3Igc3RvcmUgb2YgbmFtZSAndGhpbmcnLCBDYWxsIGFzOlxuXHRcdC8vICAgICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXHRcdC8vIG9yICQudmlld3MudGhpbmdzKG5hbWUsIGl0ZW1bLCBwYXJlbnRUbXBsXSlcblxuXHRcdHZhciBvblN0b3JlLCBjb21waWxlLCBpdGVtTmFtZSwgdGhpc1N0b3JlO1xuXHRcdGlmIChuYW1lICYmIHR5cGVvZiBuYW1lID09PSBPQkpFQ1QgJiYgIW5hbWUubm9kZVR5cGUgJiYgIW5hbWUubWFya3VwICYmICFuYW1lLmdldFRndCAmJiAhKHN0b3JlTmFtZSA9PT0gXCJ2aWV3TW9kZWxcIiAmJiBuYW1lLmdldHRlcnMgfHwgbmFtZS5leHRlbmQpKSB7XG5cdFx0XHQvLyBDYWxsIHRvICQudmlld3MudGhpbmdzKGl0ZW1zWywgcGFyZW50VG1wbF0pLFxuXG5cdFx0XHQvLyBBZGRpbmcgaXRlbXMgdG8gdGhlIHN0b3JlXG5cdFx0XHQvLyBJZiBuYW1lIGlzIGEgaGFzaCwgdGhlbiBpdGVtIGlzIHBhcmVudFRtcGwuIEl0ZXJhdGUgb3ZlciBoYXNoIGFuZCBjYWxsIHN0b3JlIGZvciBrZXkuXG5cdFx0XHRmb3IgKGl0ZW1OYW1lIGluIG5hbWUpIHtcblx0XHRcdFx0dGhlU3RvcmUoaXRlbU5hbWUsIG5hbWVbaXRlbU5hbWVdLCBpdGVtKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtIHx8ICR2aWV3cztcblx0XHR9XG5cdFx0Ly8gQWRkaW5nIGEgc2luZ2xlIHVubmFtZWQgaXRlbSB0byB0aGUgc3RvcmVcblx0XHRpZiAoaXRlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpdGVtID0gbmFtZTtcblx0XHRcdG5hbWUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChuYW1lICYmIFwiXCIgKyBuYW1lICE9PSBuYW1lKSB7IC8vIG5hbWUgbXVzdCBiZSBhIHN0cmluZ1xuXHRcdFx0cGFyZW50VG1wbCA9IGl0ZW07XG5cdFx0XHRpdGVtID0gbmFtZTtcblx0XHRcdG5hbWUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXNTdG9yZSA9IHBhcmVudFRtcGxcblx0XHRcdD8gc3RvcmVOYW1lID09PSBcInZpZXdNb2RlbFwiXG5cdFx0XHRcdD8gcGFyZW50VG1wbFxuXHRcdFx0XHQ6IChwYXJlbnRUbXBsW3N0b3JlTmFtZXNdID0gcGFyZW50VG1wbFtzdG9yZU5hbWVzXSB8fCB7fSlcblx0XHRcdDogdGhlU3RvcmU7XG5cdFx0Y29tcGlsZSA9IHN0b3JlU2V0dGluZ3MuY29tcGlsZTtcblx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0Ly8gSWYgaXRlbSBpcyBudWxsLCBkZWxldGUgdGhpcyBlbnRyeVxuXHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXNTdG9yZVtuYW1lXTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aXRlbSA9IGNvbXBpbGUgPyBjb21waWxlLmNhbGwodGhpc1N0b3JlLCBuYW1lLCBpdGVtLCBwYXJlbnRUbXBsLCAwKSA6IGl0ZW07XG5cdFx0XHRpZiAobmFtZSkge1xuXHRcdFx0XHR0aGlzU3RvcmVbbmFtZV0gPSBpdGVtO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY29tcGlsZSAmJiBpdGVtKSB7XG5cdFx0XHRpdGVtLl9pcyA9IHN0b3JlTmFtZTsgLy8gT25seSBkbyB0aGlzIGZvciBjb21waWxlZCBvYmplY3RzICh0YWdzLCB0ZW1wbGF0ZXMuLi4pXG5cdFx0fVxuXHRcdGlmIChpdGVtICYmIChvblN0b3JlID0gJHN1Yi5vblN0b3JlW3N0b3JlTmFtZV0pKSB7XG5cdFx0XHQvLyBlLmcuIEpzVmlld3MgaW50ZWdyYXRpb25cblx0XHRcdG9uU3RvcmUobmFtZSwgaXRlbSwgY29tcGlsZSk7XG5cdFx0fVxuXHRcdHJldHVybiBpdGVtO1xuXHR9XG5cblx0dmFyIHN0b3JlTmFtZXMgPSBzdG9yZU5hbWUgKyBcInNcIjtcblxuXHQkdmlld3Nbc3RvcmVOYW1lc10gPSB0aGVTdG9yZTtcbn1cblxuZnVuY3Rpb24gYWRkU2V0dGluZyhzdCkge1xuXHQkdmlld3NTZXR0aW5nc1tzdF0gPSBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdHJldHVybiBhcmd1bWVudHMubGVuZ3RoXG5cdFx0XHQ/ICgkc3ViU2V0dGluZ3Nbc3RdID0gdmFsdWUsICR2aWV3c1NldHRpbmdzKVxuXHRcdFx0OiAkc3ViU2V0dGluZ3Nbc3RdO1xuXHR9O1xufVxuXG4vLz09PT09PT09PVxuLy8gZGF0YU1hcFxuLy89PT09PT09PT1cblxuZnVuY3Rpb24gZGF0YU1hcChtYXBEZWYpIHtcblx0ZnVuY3Rpb24gTWFwKHNvdXJjZSwgb3B0aW9ucykge1xuXHRcdHRoaXMudGd0ID0gbWFwRGVmLmdldFRndChzb3VyY2UsIG9wdGlvbnMpO1xuXHR9XG5cblx0aWYgKCRpc0Z1bmN0aW9uKG1hcERlZikpIHtcblx0XHQvLyBTaW1wbGUgbWFwIGRlY2xhcmVkIGFzIGZ1bmN0aW9uXG5cdFx0bWFwRGVmID0ge1xuXHRcdFx0Z2V0VGd0OiBtYXBEZWZcblx0XHR9O1xuXHR9XG5cblx0aWYgKG1hcERlZi5iYXNlTWFwKSB7XG5cdFx0bWFwRGVmID0gJGV4dGVuZCgkZXh0ZW5kKHt9LCBtYXBEZWYuYmFzZU1hcCksIG1hcERlZik7XG5cdH1cblxuXHRtYXBEZWYubWFwID0gZnVuY3Rpb24oc291cmNlLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIG5ldyBNYXAoc291cmNlLCBvcHRpb25zKTtcblx0fTtcblx0cmV0dXJuIG1hcERlZjtcbn1cblxuLy89PT09PT09PT09PT09PVxuLy8gcmVuZGVyQ29udGVudFxuLy89PT09PT09PT09PT09PVxuXG5mdW5jdGlvbiByZW5kZXJDb250ZW50KGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uLCBwYXJlbnRWaWV3LCBrZXksIG9uUmVuZGVyKSB7XG5cdHZhciBpLCBsLCB0YWcsIHRtcGwsIHRhZ0N0eCwgaXNUb3BSZW5kZXJDYWxsLCBwcmV2RGF0YSwgcHJldkluZGV4LFxuXHRcdHZpZXcgPSBwYXJlbnRWaWV3LFxuXHRcdHJlc3VsdCA9IFwiXCI7XG5cblx0aWYgKGNvbnRleHQgPT09IHRydWUpIHtcblx0XHRub0l0ZXJhdGlvbiA9IGNvbnRleHQ7IC8vIHBhc3NpbmcgYm9vbGVhbiBhcyBzZWNvbmQgcGFyYW0gLSBub0l0ZXJhdGlvblxuXHRcdGNvbnRleHQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGNvbnRleHQgIT09IE9CSkVDVCkge1xuXHRcdGNvbnRleHQgPSB1bmRlZmluZWQ7IC8vIGNvbnRleHQgbXVzdCBiZSBhIGJvb2xlYW4gKG5vSXRlcmF0aW9uKSBvciBhIHBsYWluIG9iamVjdFxuXHR9XG5cblx0aWYgKHRhZyA9IHRoaXMudGFnKSB7XG5cdFx0Ly8gVGhpcyBpcyBhIGNhbGwgZnJvbSByZW5kZXJUYWcgb3IgdGFnQ3R4LnJlbmRlciguLi4pXG5cdFx0dGFnQ3R4ID0gdGhpcztcblx0XHR2aWV3ID0gdmlldyB8fCB0YWdDdHgudmlldztcblx0XHR0bXBsID0gdmlldy5nZXRUbXBsKHRhZy50ZW1wbGF0ZSB8fCB0YWdDdHgudG1wbCk7XG5cdFx0aWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRkYXRhID0gdmlldztcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gVGhpcyBpcyBhIHRlbXBsYXRlLnJlbmRlciguLi4pIGNhbGxcblx0XHR0bXBsID0gdGhpcztcblx0fVxuXG5cdGlmICh0bXBsKSB7XG5cdFx0aWYgKCF2aWV3ICYmIGRhdGEgJiYgZGF0YS5faXMgPT09IFwidmlld1wiKSB7XG5cdFx0XHR2aWV3ID0gZGF0YTsgLy8gV2hlbiBwYXNzaW5nIGluIGEgdmlldyB0byByZW5kZXIgb3IgbGluayAoYW5kIG5vdCBwYXNzaW5nIGluIGEgcGFyZW50IHZpZXcpIHVzZSB0aGUgcGFzc2VkLWluIHZpZXcgYXMgcGFyZW50Vmlld1xuXHRcdH1cblxuXHRcdGlmICh2aWV3KSB7XG5cdFx0XHRpZiAoZGF0YSA9PT0gdmlldykge1xuXHRcdFx0XHQvLyBJbmhlcml0IHRoZSBkYXRhIGZyb20gdGhlIHBhcmVudCB2aWV3LlxuXHRcdFx0XHQvLyBUaGlzIG1heSBiZSB0aGUgY29udGVudHMgb2YgYW4ge3tpZn19IGJsb2NrXG5cdFx0XHRcdGRhdGEgPSB2aWV3LmRhdGE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aXNUb3BSZW5kZXJDYWxsID0gIXZpZXc7XG5cdFx0aXNSZW5kZXJDYWxsID0gaXNSZW5kZXJDYWxsIHx8IGlzVG9wUmVuZGVyQ2FsbDtcblx0XHRpZiAoIXZpZXcpIHtcblx0XHRcdChjb250ZXh0ID0gY29udGV4dCB8fCB7fSkucm9vdCA9IGRhdGE7IC8vIFByb3ZpZGUgfnJvb3QgYXMgc2hvcnRjdXQgdG8gdG9wLWxldmVsIGRhdGEuXG5cdFx0fVxuXHRcdGlmICghaXNSZW5kZXJDYWxsIHx8ICRzdWJTZXR0aW5nc0FkdmFuY2VkLnVzZVZpZXdzIHx8IHRtcGwudXNlVmlld3MgfHwgdmlldyAmJiB2aWV3ICE9PSB0b3BWaWV3KSB7XG5cdFx0XHRyZXN1bHQgPSByZW5kZXJXaXRoVmlld3ModG1wbCwgZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24sIHZpZXcsIGtleSwgb25SZW5kZXIsIHRhZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh2aWV3KSB7IC8vIEluIGEgYmxvY2tcblx0XHRcdFx0cHJldkRhdGEgPSB2aWV3LmRhdGE7XG5cdFx0XHRcdHByZXZJbmRleCA9IHZpZXcuaW5kZXg7XG5cdFx0XHRcdHZpZXcuaW5kZXggPSBpbmRleFN0cjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpZXcgPSB0b3BWaWV3O1xuXHRcdFx0XHR2aWV3LmRhdGEgPSBkYXRhO1xuXHRcdFx0XHR2aWV3LmN0eCA9IGNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoJGlzQXJyYXkoZGF0YSkgJiYgIW5vSXRlcmF0aW9uKSB7XG5cdFx0XHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgcGFyZW50VmlldyBhcmUgcGFzc2VkIGluXG5cdFx0XHRcdC8vIGFsb25nIHdpdGggcGFyZW50IHZpZXcsIHRyZWF0IGFzIGluc2VydCAtZS5nLiBmcm9tIHZpZXcuYWRkVmlld3MgLSBzbyBwYXJlbnRWaWV3IGlzIGFscmVhZHkgdGhlIHZpZXcgaXRlbSBmb3IgYXJyYXkpXG5cdFx0XHRcdGZvciAoaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0XHRcdHZpZXcuaW5kZXggPSBpO1xuXHRcdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGFbaV07XG5cdFx0XHRcdFx0cmVzdWx0ICs9IHRtcGwuZm4oZGF0YVtpXSwgdmlldywgJHN1Yik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpZXcuZGF0YSA9IGRhdGE7XG5cdFx0XHRcdHJlc3VsdCArPSB0bXBsLmZuKGRhdGEsIHZpZXcsICRzdWIpO1xuXHRcdFx0fVxuXHRcdFx0dmlldy5kYXRhID0gcHJldkRhdGE7XG5cdFx0XHR2aWV3LmluZGV4ID0gcHJldkluZGV4O1xuXHRcdH1cblx0XHRpZiAoaXNUb3BSZW5kZXJDYWxsKSB7XG5cdFx0XHRpc1JlbmRlckNhbGwgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlcldpdGhWaWV3cyh0bXBsLCBkYXRhLCBjb250ZXh0LCBub0l0ZXJhdGlvbiwgdmlldywga2V5LCBvblJlbmRlciwgdGFnKSB7XG5cdGZ1bmN0aW9uIHNldEl0ZW1WYXIoaXRlbSkge1xuXHRcdC8vIFdoZW4gaXRlbVZhciBpcyBzcGVjaWZpZWQsIHNldCBtb2RpZmllZCBjdHggd2l0aCB1c2VyLW5hbWVkIH5pdGVtXG5cdFx0bmV3Q3R4ID0gJGV4dGVuZCh7fSwgY29udGV4dCk7XG5cdFx0bmV3Q3R4W2l0ZW1WYXJdID0gaXRlbTtcblx0fVxuXG5cdC8vIFJlbmRlciB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGEgYXMgYSB0cmVlIG9mIHN1YnZpZXdzIChuZXN0ZWQgcmVuZGVyZWQgdGVtcGxhdGUgaW5zdGFuY2VzKSwgb3IgYXMgYSBzdHJpbmcgKHRvcC1sZXZlbCB0ZW1wbGF0ZSkuXG5cdC8vIElmIHRoZSBkYXRhIGlzIHRoZSBwYXJlbnQgdmlldywgdHJlYXQgYXMgbm9JdGVyYXRpb24sIHJlLXJlbmRlciB3aXRoIHRoZSBzYW1lIGRhdGEgY29udGV4dC5cblx0dmFyIGksIGwsIG5ld1ZpZXcsIGNoaWxkVmlldywgaXRlbVJlc3VsdCwgc3dhcENvbnRlbnQsIGNvbnRlbnRUbXBsLCBvdXRlck9uUmVuZGVyLCB0bXBsTmFtZSwgaXRlbVZhciwgbmV3Q3R4LCB0YWdDdHgsXG5cdFx0cmVzdWx0ID0gXCJcIjtcblxuXHRpZiAodGFnKSB7XG5cdFx0Ly8gVGhpcyBpcyBhIGNhbGwgZnJvbSByZW5kZXJUYWcgb3IgdGFnQ3R4LnJlbmRlciguLi4pXG5cdFx0dG1wbE5hbWUgPSB0YWcudGFnTmFtZTtcblx0XHR0YWdDdHggPSB0YWcudGFnQ3R4O1xuXHRcdGNvbnRleHQgPSBjb250ZXh0ID8gZXh0ZW5kQ3R4KGNvbnRleHQsIHRhZy5jdHgpIDogdGFnLmN0eDtcblxuXHRcdGlmICh0bXBsID09PSB2aWV3LmNvbnRlbnQpIHsgLy8ge3t4eHggdG1wbD0jY29udGVudH19XG5cdFx0XHRjb250ZW50VG1wbCA9IHRtcGwgIT09IHZpZXcuY3R4Ll93cnAgLy8gV2UgYXJlIHJlbmRlcmluZyB0aGUgI2NvbnRlbnRcblx0XHRcdFx0PyB2aWV3LmN0eC5fd3JwIC8vICNjb250ZW50IHdhcyB0aGUgdGFnQ3R4LnByb3BzLnRtcGwgd3JhcHBlciBvZiB0aGUgYmxvY2sgY29udGVudCAtIHNvIHdpdGhpbiB0aGlzIHZpZXcsICNjb250ZW50IHdpbGwgbm93IGJlIHRoZSB2aWV3LmN0eC5fd3JwIGJsb2NrIGNvbnRlbnRcblx0XHRcdFx0OiB1bmRlZmluZWQ7IC8vICNjb250ZW50IHdhcyB0aGUgdmlldy5jdHguX3dycCBibG9jayBjb250ZW50IC0gc28gd2l0aGluIHRoaXMgdmlldywgdGhlcmUgaXMgbm8gbG9uZ2VyIGFueSAjY29udGVudCB0byB3cmFwLlxuXHRcdH0gZWxzZSBpZiAodG1wbCAhPT0gdGFnQ3R4LmNvbnRlbnQpIHtcblx0XHRcdGlmICh0bXBsID09PSB0YWcudGVtcGxhdGUpIHsgLy8gUmVuZGVyaW5nIHt7dGFnfX0gdGFnLnRlbXBsYXRlLCByZXBsYWNpbmcgYmxvY2sgY29udGVudC5cblx0XHRcdFx0Y29udGVudFRtcGwgPSB0YWdDdHgudG1wbDsgLy8gU2V0ICNjb250ZW50IHRvIGJsb2NrIGNvbnRlbnQgKG9yIHdyYXBwZWQgYmxvY2sgY29udGVudCBpZiB0YWdDdHgucHJvcHMudG1wbCBpcyBzZXQpXG5cdFx0XHRcdGNvbnRleHQuX3dycCA9IHRhZ0N0eC5jb250ZW50OyAvLyBQYXNzIHdyYXBwZWQgYmxvY2sgY29udGVudCB0byBuZXN0ZWQgdmlld3Ncblx0XHRcdH0gZWxzZSB7IC8vIFJlbmRlcmluZyB0YWdDdHgucHJvcHMudG1wbCB3cmFwcGVyXG5cdFx0XHRcdGNvbnRlbnRUbXBsID0gdGFnQ3R4LmNvbnRlbnQgfHwgdmlldy5jb250ZW50OyAvLyBTZXQgI2NvbnRlbnQgdG8gd3JhcHBlZCBibG9jayBjb250ZW50XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRlbnRUbXBsID0gdmlldy5jb250ZW50OyAvLyBOZXN0ZWQgdmlld3MgaW5oZXJpdCBzYW1lIHdyYXBwZWQgI2NvbnRlbnQgcHJvcGVydHlcblx0XHR9XG5cblx0XHRpZiAodGFnQ3R4LnByb3BzLmxpbmsgPT09IGZhbHNlKSB7XG5cdFx0XHQvLyBsaW5rPWZhbHNlIHNldHRpbmcgb24gYmxvY2sgdGFnXG5cdFx0XHQvLyBXZSB3aWxsIG92ZXJyaWRlIGluaGVyaXRlZCB2YWx1ZSBvZiBsaW5rIGJ5IHRoZSBleHBsaWNpdCBzZXR0aW5nIGxpbms9ZmFsc2UgdGFrZW4gZnJvbSBwcm9wc1xuXHRcdFx0Ly8gVGhlIGNoaWxkIHZpZXdzIG9mIGFuIHVubGlua2VkIHZpZXcgYXJlIGFsc28gdW5saW5rZWQuIFNvIHNldHRpbmcgY2hpbGQgYmFjayB0byB0cnVlIHdpbGwgbm90IGhhdmUgYW55IGVmZmVjdC5cblx0XHRcdGNvbnRleHQgPSBjb250ZXh0IHx8IHt9O1xuXHRcdFx0Y29udGV4dC5saW5rID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW1WYXIgPSB0YWdDdHgucHJvcHMuaXRlbVZhcikge1xuXHRcdFx0aWYgKGl0ZW1WYXIuY2hhckF0KDApICE9PSBcIn5cIikge1xuXHRcdFx0XHRzeW50YXhFcnJvcihcIlVzZSBpdGVtVmFyPSd+bXlJdGVtJ1wiKTtcblx0XHRcdH1cblx0XHRcdGl0ZW1WYXIgPSBpdGVtVmFyLnNsaWNlKDEpO1xuXHRcdH1cblx0fVxuXG5cdGlmICh2aWV3KSB7XG5cdFx0b25SZW5kZXIgPSBvblJlbmRlciB8fCB2aWV3Ll8ub25SZW5kZXI7XG5cdFx0Y29udGV4dCA9IGV4dGVuZEN0eChjb250ZXh0LCB2aWV3LmN0eCk7XG5cdH1cblxuXHRpZiAoa2V5ID09PSB0cnVlKSB7XG5cdFx0c3dhcENvbnRlbnQgPSB0cnVlO1xuXHRcdGtleSA9IDA7XG5cdH1cblxuXHQvLyBJZiBsaW5rPT09ZmFsc2UsIGRvIG5vdCBjYWxsIG9uUmVuZGVyLCBzbyBubyBkYXRhLWxpbmtpbmcgbWFya2VyIG5vZGVzXG5cdGlmIChvblJlbmRlciAmJiAoY29udGV4dCAmJiBjb250ZXh0LmxpbmsgPT09IGZhbHNlIHx8IHRhZyAmJiB0YWcuXy5ub1Z3cykpIHtcblx0XHRvblJlbmRlciA9IHVuZGVmaW5lZDtcblx0fVxuXHRvdXRlck9uUmVuZGVyID0gb25SZW5kZXI7XG5cdGlmIChvblJlbmRlciA9PT0gdHJ1ZSkge1xuXHRcdC8vIFVzZWQgYnkgdmlldy5yZWZyZXNoKCkuIERvbid0IGNyZWF0ZSBhIG5ldyB3cmFwcGVyIHZpZXcuXG5cdFx0b3V0ZXJPblJlbmRlciA9IHVuZGVmaW5lZDtcblx0XHRvblJlbmRlciA9IHZpZXcuXy5vblJlbmRlcjtcblx0fVxuXHQvLyBTZXQgYWRkaXRpb25hbCBjb250ZXh0IG9uIHZpZXdzIGNyZWF0ZWQgaGVyZSwgKGFzIG1vZGlmaWVkIGNvbnRleHQgaW5oZXJpdGVkIGZyb20gdGhlIHBhcmVudCwgYW5kIHRvIGJlIGluaGVyaXRlZCBieSBjaGlsZCB2aWV3cylcblx0Y29udGV4dCA9IHRtcGwuaGVscGVyc1xuXHRcdD8gZXh0ZW5kQ3R4KHRtcGwuaGVscGVycywgY29udGV4dClcblx0XHQ6IGNvbnRleHQ7XG5cblx0bmV3Q3R4ID0gY29udGV4dDtcblx0aWYgKCRpc0FycmF5KGRhdGEpICYmICFub0l0ZXJhdGlvbikge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHRoZSBhcnJheSwgd2hvc2UgY2hpbGQgdmlld3MgY29ycmVzcG9uZCB0byBlYWNoIGRhdGEgaXRlbS4gKE5vdGU6IGlmIGtleSBhbmQgdmlldyBhcmUgcGFzc2VkIGluXG5cdFx0Ly8gYWxvbmcgd2l0aCBwYXJlbnQgdmlldywgdHJlYXQgYXMgaW5zZXJ0IC1lLmcuIGZyb20gdmlldy5hZGRWaWV3cyAtIHNvIHZpZXcgaXMgYWxyZWFkeSB0aGUgdmlldyBpdGVtIGZvciBhcnJheSlcblx0XHRuZXdWaWV3ID0gc3dhcENvbnRlbnRcblx0XHRcdD8gdmlld1xuXHRcdFx0OiAoa2V5ICE9PSB1bmRlZmluZWQgJiYgdmlldylcblx0XHRcdFx0fHwgbmV3IFZpZXcoY29udGV4dCwgXCJhcnJheVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyKTtcblx0XHRpZiAodmlldyAmJiB2aWV3Ll8udXNlS2V5KSB7XG5cdFx0XHQvLyBQYXJlbnQgaXMgbm90IGFuICdhcnJheSB2aWV3J1xuXHRcdFx0bmV3Vmlldy5fLmJuZCA9ICF0YWcgfHwgdGFnLl8uYm5kICYmIHRhZzsgLy8gRm9yIGFycmF5IHZpZXdzIHRoYXQgYXJlIGRhdGEgYm91bmQgZm9yIGNvbGxlY3Rpb24gY2hhbmdlIGV2ZW50cywgc2V0IHRoZVxuXHRcdFx0Ly8gdmlldy5fLmJuZCBwcm9wZXJ0eSB0byB0cnVlIGZvciB0b3AtbGV2ZWwgbGluaygpIG9yIGRhdGEtbGluaz1cIntmb3J9XCIsIG9yIHRvIHRoZSB0YWcgaW5zdGFuY2UgZm9yIGEgZGF0YS1ib3VuZCB0YWcsIGUuZy4ge157Zm9yIC4uLn19XG5cdFx0fVxuXHRcdGlmIChpdGVtVmFyKSB7XG5cdFx0XHRuZXdWaWV3Lml0ID0gaXRlbVZhcjtcblx0XHR9XG5cdFx0aXRlbVZhciA9IG5ld1ZpZXcuaXQ7XG5cdFx0Zm9yIChpID0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdFx0XHQvLyBDcmVhdGUgYSB2aWV3IGZvciBlYWNoIGRhdGEgaXRlbS5cblx0XHRcdGlmIChpdGVtVmFyKSB7XG5cdFx0XHRcdHNldEl0ZW1WYXIoZGF0YVtpXSk7IC8vIHVzZSBtb2RpZmllZCBjdHggd2l0aCB1c2VyLW5hbWVkIH5pdGVtXG5cdFx0XHR9XG5cdFx0XHRjaGlsZFZpZXcgPSBuZXcgVmlldyhuZXdDdHgsIFwiaXRlbVwiLCBuZXdWaWV3LCBkYXRhW2ldLCB0bXBsLCAoa2V5IHx8IDApICsgaSwgb25SZW5kZXIsIGNvbnRlbnRUbXBsKTtcblxuXHRcdFx0aXRlbVJlc3VsdCA9IHRtcGwuZm4oZGF0YVtpXSwgY2hpbGRWaWV3LCAkc3ViKTtcblx0XHRcdHJlc3VsdCArPSBuZXdWaWV3Ll8ub25SZW5kZXIgPyBuZXdWaWV3Ll8ub25SZW5kZXIoaXRlbVJlc3VsdCwgY2hpbGRWaWV3KSA6IGl0ZW1SZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIENyZWF0ZSBhIHZpZXcgZm9yIHNpbmdsZXRvbiBkYXRhIG9iamVjdC4gVGhlIHR5cGUgb2YgdGhlIHZpZXcgd2lsbCBiZSB0aGUgdGFnIG5hbWUsIGUuZy4gXCJpZlwiIG9yIFwibXlUYWdcIiBleGNlcHQgZm9yXG5cdFx0Ly8gXCJpdGVtXCIsIFwiYXJyYXlcIiBhbmQgXCJkYXRhXCIgdmlld3MuIEEgXCJkYXRhXCIgdmlldyBpcyBmcm9tIHByb2dyYW1tYXRpYyByZW5kZXIob2JqZWN0KSBhZ2FpbnN0IGEgJ3NpbmdsZXRvbicuXG5cdFx0aWYgKGl0ZW1WYXIpIHtcblx0XHRcdHNldEl0ZW1WYXIoZGF0YSk7XG5cdFx0fVxuXHRcdG5ld1ZpZXcgPSBzd2FwQ29udGVudCA/IHZpZXcgOiBuZXcgVmlldyhuZXdDdHgsIHRtcGxOYW1lIHx8IFwiZGF0YVwiLCB2aWV3LCBkYXRhLCB0bXBsLCBrZXksIG9uUmVuZGVyLCBjb250ZW50VG1wbCk7XG5cdFx0aWYgKHRhZyAmJiAhdGFnLmZsb3cpIHtcblx0XHRcdG5ld1ZpZXcudGFnID0gdGFnO1xuXHRcdH1cblx0XHRyZXN1bHQgKz0gdG1wbC5mbihkYXRhLCBuZXdWaWV3LCAkc3ViKTtcblx0fVxuXHRyZXR1cm4gb3V0ZXJPblJlbmRlciA/IG91dGVyT25SZW5kZXIocmVzdWx0LCBuZXdWaWV3KSA6IHJlc3VsdDtcbn1cblxuLy89PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEJ1aWxkIGFuZCBjb21waWxlIHRlbXBsYXRlXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vLyBHZW5lcmF0ZSBhIHJldXNhYmxlIGZ1bmN0aW9uIHRoYXQgd2lsbCBzZXJ2ZSB0byByZW5kZXIgYSB0ZW1wbGF0ZSBhZ2FpbnN0IGRhdGFcbi8vIChDb21waWxlIEFTVCB0aGVuIGJ1aWxkIHRlbXBsYXRlIGZ1bmN0aW9uKVxuXG5mdW5jdGlvbiBvblJlbmRlckVycm9yKGUsIHZpZXcsIGZhbGxiYWNrKSB7XG5cdHZhciBtZXNzYWdlID0gZmFsbGJhY2sgIT09IHVuZGVmaW5lZFxuXHRcdD8gJGlzRnVuY3Rpb24oZmFsbGJhY2spXG5cdFx0XHQ/IGZhbGxiYWNrLmNhbGwodmlldy5kYXRhLCBlLCB2aWV3KVxuXHRcdFx0OiBmYWxsYmFjayB8fCBcIlwiXG5cdFx0OiBcIntFcnJvcjogXCIgKyBlLm1lc3NhZ2UgKyBcIn1cIjtcblxuXHRpZiAoJHN1YlNldHRpbmdzLm9uRXJyb3IgJiYgKGZhbGxiYWNrID0gJHN1YlNldHRpbmdzLm9uRXJyb3IuY2FsbCh2aWV3LmRhdGEsIGUsIGZhbGxiYWNrICYmIG1lc3NhZ2UsIHZpZXcpKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0bWVzc2FnZSA9IGZhbGxiYWNrOyAvLyBUaGVyZSBpcyBhIHNldHRpbmdzLmRlYnVnTW9kZShoYW5kbGVyKSBvbkVycm9yIG92ZXJyaWRlLiBDYWxsIGl0LCBhbmQgdXNlIHJldHVybiB2YWx1ZSAoaWYgYW55KSB0byByZXBsYWNlIG1lc3NhZ2Vcblx0fVxuXG5cdHJldHVybiB2aWV3ICYmICF2aWV3LmxpbmtDdHggPyAkY29udmVydGVycy5odG1sKG1lc3NhZ2UpIDogbWVzc2FnZTtcbn1cblxuZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuXHR0aHJvdyBuZXcgJHN1Yi5FcnIobWVzc2FnZSk7XG59XG5cbmZ1bmN0aW9uIHN5bnRheEVycm9yKG1lc3NhZ2UpIHtcblx0ZXJyb3IoXCJTeW50YXggZXJyb3JcXG5cIiArIG1lc3NhZ2UpO1xufVxuXG5mdW5jdGlvbiB0bXBsRm4obWFya3VwLCB0bXBsLCBpc0xpbmtFeHByLCBjb252ZXJ0QmFjaywgaGFzRWxzZSkge1xuXHQvLyBDb21waWxlIG1hcmt1cCB0byBBU1QgKGFidHJhY3Qgc3ludGF4IHRyZWUpIHRoZW4gYnVpbGQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIGNvZGUgZnJvbSB0aGUgQVNUIG5vZGVzXG5cdC8vIFVzZWQgZm9yIGNvbXBpbGluZyB0ZW1wbGF0ZXMsIGFuZCBhbHNvIGJ5IEpzVmlld3MgdG8gYnVpbGQgZnVuY3Rpb25zIGZvciBkYXRhIGxpbmsgZXhwcmVzc2lvbnNcblxuXHQvLz09PT0gbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cdGZ1bmN0aW9uIHB1c2hwcmVjZWRpbmdDb250ZW50KHNoaWZ0KSB7XG5cdFx0c2hpZnQgLT0gbG9jO1xuXHRcdGlmIChzaGlmdCkge1xuXHRcdFx0Y29udGVudC5wdXNoKG1hcmt1cC5zdWJzdHIobG9jLCBzaGlmdCkucmVwbGFjZShyTmV3TGluZSwgXCJcXFxcblwiKSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gYmxvY2tUYWdDaGVjayh0YWdOYW1lLCBibG9jaykge1xuXHRcdGlmICh0YWdOYW1lKSB7XG5cdFx0XHR0YWdOYW1lICs9ICd9fSc7XG5cdFx0XHQvL1x0XHRcdCd7e2luY2x1ZGV9fSBibG9jayBoYXMge3svZm9yfX0gd2l0aCBubyBvcGVuIHt7Zm9yfX0nXG5cdFx0XHRzeW50YXhFcnJvcigoXG5cdFx0XHRcdGJsb2NrXG5cdFx0XHRcdFx0PyAne3snICsgYmxvY2sgKyAnfX0gYmxvY2sgaGFzIHt7LycgKyB0YWdOYW1lICsgJyB3aXRob3V0IHt7JyArIHRhZ05hbWVcblx0XHRcdFx0XHQ6ICdVbm1hdGNoZWQgb3IgbWlzc2luZyB7ey8nICsgdGFnTmFtZSkgKyAnLCBpbiB0ZW1wbGF0ZTpcXG4nICsgbWFya3VwKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBwYXJzZVRhZyhhbGwsIGJpbmQsIHRhZ05hbWUsIGNvbnZlcnRlciwgY29sb24sIGh0bWwsIGNvZGVUYWcsIHBhcmFtcywgc2xhc2gsIGJpbmQyLCBjbG9zZUJsb2NrLCBpbmRleCkge1xuLypcblxuICAgICBiaW5kICAgICB0YWdOYW1lICAgICAgICAgY3Z0ICAgY2xuIGh0bWwgY29kZSAgICBwYXJhbXMgICAgICAgICAgICBzbGFzaCAgIGJpbmQyICAgICAgICAgY2xvc2VCbGsgIGNvbW1lbnRcbi8oPzp7KFxcXik/eyg/OihcXHcrKD89W1xcL1xcc31dKSl8KFxcdyspPyg6KXwoPil8KFxcKikpXFxzKigoPzpbXn1dfH0oPyF9KSkqPykoXFwvKT98eyhcXF4pP3soPzooPzpcXC8oXFx3KykpXFxzKnwhLS1bXFxzXFxTXSo/LS0pKX19L2dcblxuKD86XG4gIHsoXFxeKT97ICAgICAgICAgICAgYmluZFxuICAoPzpcbiAgICAoXFx3KyAgICAgICAgICAgICB0YWdOYW1lXG4gICAgICAoPz1bXFwvXFxzfV0pXG4gICAgKVxuICAgIHxcbiAgICAoXFx3Kyk/KDopICAgICAgICBjb252ZXJ0ZXIgY29sb25cbiAgICB8XG4gICAgKD4pICAgICAgICAgICAgICBodG1sXG4gICAgfFxuICAgIChcXCopICAgICAgICAgICAgIGNvZGVUYWdcbiAgKVxuICBcXHMqXG4gICggICAgICAgICAgICAgICAgICBwYXJhbXNcbiAgICAoPzpbXn1dfH0oPyF9KSkqP1xuICApXG4gIChcXC8pPyAgICAgICAgICAgICAgc2xhc2hcbiAgfFxuICB7KFxcXik/eyAgICAgICAgICAgIGJpbmQyXG4gICg/OlxuICAgICg/OlxcLyhcXHcrKSlcXHMqICAgY2xvc2VCbG9ja1xuICAgIHxcbiAgICAhLS1bXFxzXFxTXSo/LS0gICAgY29tbWVudFxuICApXG4pXG59fS9nXG5cbiovXG5cdFx0aWYgKGNvZGVUYWcgJiYgYmluZCB8fCBzbGFzaCAmJiAhdGFnTmFtZSB8fCBwYXJhbXMgJiYgcGFyYW1zLnNsaWNlKC0xKSA9PT0gXCI6XCIgfHwgYmluZDIpIHtcblx0XHRcdHN5bnRheEVycm9yKGFsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gQnVpbGQgYWJzdHJhY3Qgc3ludGF4IHRyZWUgKEFTVCk6IFt0YWdOYW1lLCBjb252ZXJ0ZXIsIHBhcmFtcywgY29udGVudCwgaGFzaCwgYmluZGluZ3MsIGNvbnRlbnRNYXJrdXBdXG5cdFx0aWYgKGh0bWwpIHtcblx0XHRcdGNvbG9uID0gXCI6XCI7XG5cdFx0XHRjb252ZXJ0ZXIgPSBIVE1MO1xuXHRcdH1cblx0XHRzbGFzaCA9IHNsYXNoIHx8IGlzTGlua0V4cHIgJiYgIWhhc0Vsc2U7XG5cblx0XHR2YXIgcGF0aEJpbmRpbmdzID0gKGJpbmQgfHwgaXNMaW5rRXhwcikgJiYgW1tdXSxcblx0XHRcdHByb3BzID0gXCJcIixcblx0XHRcdGFyZ3MgPSBcIlwiLFxuXHRcdFx0Y3R4UHJvcHMgPSBcIlwiLFxuXHRcdFx0cGFyYW1zQXJncyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNQcm9wcyA9IFwiXCIsXG5cdFx0XHRwYXJhbXNDdHhQcm9wcyA9IFwiXCIsXG5cdFx0XHRvbkVycm9yID0gXCJcIixcblx0XHRcdHVzZVRyaWdnZXIgPSBcIlwiLFxuXHRcdFx0Ly8gQmxvY2sgdGFnIGlmIG5vdCBzZWxmLWNsb3NpbmcgYW5kIG5vdCB7ezp9fSBvciB7ez59fSAoc3BlY2lhbCBjYXNlKSBhbmQgbm90IGEgZGF0YS1saW5rIGV4cHJlc3Npb25cblx0XHRcdGJsb2NrID0gIXNsYXNoICYmICFjb2xvbjtcblxuXHRcdC8vPT09PSBuZXN0ZWQgaGVscGVyIGZ1bmN0aW9uID09PT1cblx0XHR0YWdOYW1lID0gdGFnTmFtZSB8fCAocGFyYW1zID0gcGFyYW1zIHx8IFwiI2RhdGFcIiwgY29sb24pOyAvLyB7ezp9fSBpcyBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRwdXNocHJlY2VkaW5nQ29udGVudChpbmRleCk7XG5cdFx0bG9jID0gaW5kZXggKyBhbGwubGVuZ3RoOyAvLyBsb2NhdGlvbiBtYXJrZXIgLSBwYXJzZWQgdXAgdG8gaGVyZVxuXHRcdGlmIChjb2RlVGFnKSB7XG5cdFx0XHRpZiAoYWxsb3dDb2RlKSB7XG5cdFx0XHRcdGNvbnRlbnQucHVzaChbXCIqXCIsIFwiXFxuXCIgKyBwYXJhbXMucmVwbGFjZSgvXjovLCBcInJldCs9IFwiKS5yZXBsYWNlKHJVbmVzY2FwZVF1b3RlcywgXCIkMVwiKSArIFwiO1xcblwiXSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0YWdOYW1lKSB7XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCJlbHNlXCIpIHtcblx0XHRcdFx0aWYgKHJUZXN0RWxzZUlmLnRlc3QocGFyYW1zKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKCdmb3IgXCJ7e2Vsc2UgaWYgZXhwcn19XCIgdXNlIFwie3tlbHNlIGV4cHJ9fVwiJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGF0aEJpbmRpbmdzID0gY3VycmVudFs3XSAmJiBbW11dO1xuXHRcdFx0XHRjdXJyZW50WzhdID0gbWFya3VwLnN1YnN0cmluZyhjdXJyZW50WzhdLCBpbmRleCk7IC8vIGNvbnRlbnRNYXJrdXAgZm9yIGJsb2NrIHRhZ1xuXHRcdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0XHRcdGNvbnRlbnQgPSBjdXJyZW50WzJdO1xuXHRcdFx0XHRibG9jayA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGFyYW1zKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBwYXJhbXMgc3RyaW5nLCB0byBhdm9pZCBjb21waWxlZCBjb2RlIGVycm9ycyBmb3IgdW50ZXJtaW5hdGVkIHN0cmluZ3Ncblx0XHRcdFx0cGFyc2VQYXJhbXMocGFyYW1zLnJlcGxhY2Uock5ld0xpbmUsIFwiIFwiKSwgcGF0aEJpbmRpbmdzLCB0bXBsKVxuXHRcdFx0XHRcdC5yZXBsYWNlKHJCdWlsZEhhc2gsIGZ1bmN0aW9uKGFsbCwgb25lcnJvciwgaXNDdHgsIGtleSwga2V5VG9rZW4sIGtleVZhbHVlLCBhcmcsIHBhcmFtKSB7XG5cdFx0XHRcdFx0XHRrZXkgPSBcIidcIiArIGtleVRva2VuICsgXCInOlwiO1xuXHRcdFx0XHRcdFx0aWYgKGFyZykge1xuXHRcdFx0XHRcdFx0XHRhcmdzICs9IGtleVZhbHVlICsgXCIsXCI7XG5cdFx0XHRcdFx0XHRcdHBhcmFtc0FyZ3MgKz0gXCInXCIgKyBwYXJhbSArIFwiJyxcIjtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNDdHgpIHtcblx0XHRcdFx0XHRcdFx0Y3R4UHJvcHMgKz0ga2V5ICsgJ2ouX2NwKCcgKyBrZXlWYWx1ZSArICcsXCInICsgcGFyYW0gKyAnXCIsdmlldyksJztcblx0XHRcdFx0XHRcdFx0Ly8gQ29tcGlsZWQgY29kZSBmb3IgZXZhbHVhdGluZyB0YWdDdHggb24gYSB0YWcgd2lsbCBoYXZlOiBjdHg6eydmb28nOmouX2NwKGNvbXBpbGVkRXhwciwgXCJleHByXCIsIHZpZXcpfVxuXHRcdFx0XHRcdFx0XHRwYXJhbXNDdHhQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChvbmVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdG9uRXJyb3IgKz0ga2V5VmFsdWU7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpZiAoa2V5VG9rZW4gPT09IFwidHJpZ2dlclwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0dXNlVHJpZ2dlciArPSBrZXlWYWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRwcm9wcyArPSBrZXkgKyBrZXlWYWx1ZSArIFwiLFwiO1xuXHRcdFx0XHRcdFx0XHRwYXJhbXNQcm9wcyArPSBrZXkgKyBcIidcIiArIHBhcmFtICsgXCInLFwiO1xuXHRcdFx0XHRcdFx0XHRoYXNIYW5kbGVycyA9IGhhc0hhbmRsZXJzIHx8IHJIYXNIYW5kbGVycy50ZXN0KGtleVRva2VuKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBcIlwiO1xuXHRcdFx0XHRcdH0pLnNsaWNlKDAsIC0xKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdGhCaW5kaW5ncyAmJiBwYXRoQmluZGluZ3NbMF0pIHtcblx0XHRcdFx0cGF0aEJpbmRpbmdzLnBvcCgpOyAvLyBSZW1vdmUgdGhlIGJpbmRpbmdzIHRoYXQgd2FzIHByZXBhcmVkIGZvciBuZXh0IGFyZy4gKFRoZXJlIGlzIGFsd2F5cyBhbiBleHRyYSBvbmUgcmVhZHkpLlxuXHRcdFx0fVxuXG5cdFx0XHRuZXdOb2RlID0gW1xuXHRcdFx0XHRcdHRhZ05hbWUsXG5cdFx0XHRcdFx0Y29udmVydGVyIHx8ICEhY29udmVydEJhY2sgfHwgaGFzSGFuZGxlcnMgfHwgXCJcIixcblx0XHRcdFx0XHRibG9jayAmJiBbXSxcblx0XHRcdFx0XHRwYXJzZWRQYXJhbShwYXJhbXNBcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiJyNkYXRhJyxcIiA6IFwiXCIpLCBwYXJhbXNQcm9wcywgcGFyYW1zQ3R4UHJvcHMpLCAvLyB7ezp9fSBlcXVpdmFsZW50IHRvIHt7OiNkYXRhfX1cblx0XHRcdFx0XHRwYXJzZWRQYXJhbShhcmdzIHx8ICh0YWdOYW1lID09PSBcIjpcIiA/IFwiZGF0YSxcIiA6IFwiXCIpLCBwcm9wcywgY3R4UHJvcHMpLFxuXHRcdFx0XHRcdG9uRXJyb3IsXG5cdFx0XHRcdFx0dXNlVHJpZ2dlcixcblx0XHRcdFx0XHRwYXRoQmluZGluZ3MgfHwgMFxuXHRcdFx0XHRdO1xuXHRcdFx0Y29udGVudC5wdXNoKG5ld05vZGUpO1xuXHRcdFx0aWYgKGJsb2NrKSB7XG5cdFx0XHRcdHN0YWNrLnB1c2goY3VycmVudCk7XG5cdFx0XHRcdGN1cnJlbnQgPSBuZXdOb2RlO1xuXHRcdFx0XHRjdXJyZW50WzhdID0gbG9jOyAvLyBTdG9yZSBjdXJyZW50IGxvY2F0aW9uIG9mIG9wZW4gdGFnLCB0byBiZSBhYmxlIHRvIGFkZCBjb250ZW50TWFya3VwIHdoZW4gd2UgcmVhY2ggY2xvc2luZyB0YWdcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGNsb3NlQmxvY2spIHtcblx0XHRcdGJsb2NrVGFnQ2hlY2soY2xvc2VCbG9jayAhPT0gY3VycmVudFswXSAmJiBjdXJyZW50WzBdICE9PSBcImVsc2VcIiAmJiBjbG9zZUJsb2NrLCBjdXJyZW50WzBdKTtcblx0XHRcdGN1cnJlbnRbOF0gPSBtYXJrdXAuc3Vic3RyaW5nKGN1cnJlbnRbOF0sIGluZGV4KTsgLy8gY29udGVudE1hcmt1cCBmb3IgYmxvY2sgdGFnXG5cdFx0XHRjdXJyZW50ID0gc3RhY2sucG9wKCk7XG5cdFx0fVxuXHRcdGJsb2NrVGFnQ2hlY2soIWN1cnJlbnQgJiYgY2xvc2VCbG9jayk7XG5cdFx0Y29udGVudCA9IGN1cnJlbnRbMl07XG5cdH1cblx0Ly89PT09IC9lbmQgb2YgbmVzdGVkIGZ1bmN0aW9ucyA9PT09XG5cblx0dmFyIGksIHJlc3VsdCwgbmV3Tm9kZSwgaGFzSGFuZGxlcnMsIGJpbmRpbmdzLFxuXHRcdGFsbG93Q29kZSA9ICRzdWJTZXR0aW5ncy5hbGxvd0NvZGUgfHwgdG1wbCAmJiB0bXBsLmFsbG93Q29kZVxuXHRcdFx0fHwgJHZpZXdzU2V0dGluZ3MuYWxsb3dDb2RlID09PSB0cnVlLCAvLyBpbmNsdWRlIGRpcmVjdCBzZXR0aW5nIG9mIHNldHRpbmdzLmFsbG93Q29kZSB0cnVlIGZvciBiYWNrd2FyZCBjb21wYXQgb25seVxuXHRcdGFzdFRvcCA9IFtdLFxuXHRcdGxvYyA9IDAsXG5cdFx0c3RhY2sgPSBbXSxcblx0XHRjb250ZW50ID0gYXN0VG9wLFxuXHRcdGN1cnJlbnQgPSBbLCxhc3RUb3BdO1xuXG5cdGlmIChhbGxvd0NvZGUgJiYgdG1wbC5faXMpIHtcblx0XHR0bXBsLmFsbG93Q29kZSA9IGFsbG93Q29kZTtcblx0fVxuXG4vL1RPRE9cdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdOyAvLyBPbmx5IGNhY2hlIGlmIHRlbXBsYXRlIGlzIG5vdCBuYW1lZCBhbmQgbWFya3VwIGxlbmd0aCA8IC4uLixcbi8vYW5kIHRoZXJlIGFyZSBubyBiaW5kaW5ncyBvciBzdWJ0ZW1wbGF0ZXM/PyBDb25zaWRlciBzdGFuZGFyZCBvcHRpbWl6YXRpb24gZm9yIGRhdGEtbGluaz1cImEuYi5jXCJcbi8vXHRcdGlmIChyZXN1bHQpIHtcbi8vXHRcdFx0dG1wbC5mbiA9IHJlc3VsdDtcbi8vXHRcdH0gZWxzZSB7XG5cbi8vXHRcdHJlc3VsdCA9IG1hcmt1cDtcblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRpZiAoY29udmVydEJhY2sgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bWFya3VwID0gbWFya3VwLnNsaWNlKDAsIC1jb252ZXJ0QmFjay5sZW5ndGggLSAyKSArIGRlbGltQ2xvc2VDaGFyMDtcblx0XHR9XG5cdFx0bWFya3VwID0gZGVsaW1PcGVuQ2hhcjAgKyBtYXJrdXAgKyBkZWxpbUNsb3NlQ2hhcjE7XG5cdH1cblxuXHRibG9ja1RhZ0NoZWNrKHN0YWNrWzBdICYmIHN0YWNrWzBdWzJdLnBvcCgpWzBdKTtcblx0Ly8gQnVpbGQgdGhlIEFTVCAoYWJzdHJhY3Qgc3ludGF4IHRyZWUpIHVuZGVyIGFzdFRvcFxuXHRtYXJrdXAucmVwbGFjZShyVGFnLCBwYXJzZVRhZyk7XG5cblx0cHVzaHByZWNlZGluZ0NvbnRlbnQobWFya3VwLmxlbmd0aCk7XG5cblx0aWYgKGxvYyA9IGFzdFRvcFthc3RUb3AubGVuZ3RoIC0gMV0pIHtcblx0XHRibG9ja1RhZ0NoZWNrKFwiXCIgKyBsb2MgIT09IGxvYyAmJiAoK2xvY1s4XSA9PT0gbG9jWzhdKSAmJiBsb2NbMF0pO1xuXHR9XG4vL1x0XHRcdHJlc3VsdCA9IHRtcGxGbnNDYWNoZVttYXJrdXBdID0gYnVpbGRDb2RlKGFzdFRvcCwgdG1wbCk7XG4vL1x0XHR9XG5cblx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCBtYXJrdXAsIGlzTGlua0V4cHIpO1xuXHRcdGJpbmRpbmdzID0gW107XG5cdFx0aSA9IGFzdFRvcC5sZW5ndGg7XG5cdFx0d2hpbGUgKGktLSkge1xuXHRcdFx0YmluZGluZ3MudW5zaGlmdChhc3RUb3BbaV1bN10pOyAgLy8gV2l0aCBkYXRhLWxpbmsgZXhwcmVzc2lvbnMsIHBhdGhCaW5kaW5ncyBhcnJheSBmb3IgdGFnQ3R4W2ldIGlzIGFzdFRvcFtpXVs3XVxuXHRcdH1cblx0XHRzZXRQYXRocyhyZXN1bHQsIGJpbmRpbmdzKTtcblx0fSBlbHNlIHtcblx0XHRyZXN1bHQgPSBidWlsZENvZGUoYXN0VG9wLCB0bXBsKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzZXRQYXRocyhmbiwgcGF0aHNBcnIpIHtcblx0dmFyIGtleSwgcGF0aHMsXG5cdFx0aSA9IDAsXG5cdFx0bCA9IHBhdGhzQXJyLmxlbmd0aDtcblx0Zm4uZGVwcyA9IFtdO1xuXHRmb3IgKDsgaSA8IGw7IGkrKykge1xuXHRcdHBhdGhzID0gcGF0aHNBcnJbaV07XG5cdFx0Zm9yIChrZXkgaW4gcGF0aHMpIHtcblx0XHRcdGlmIChrZXkgIT09IFwiX2pzdnRvXCIgJiYgcGF0aHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBwYXRoc1trZXldLmxlbmd0aCkge1xuXHRcdFx0XHRmbi5kZXBzID0gZm4uZGVwcy5jb25jYXQocGF0aHNba2V5XSk7IC8vIGRlcHMgaXMgdGhlIGNvbmNhdGVuYXRpb24gb2YgdGhlIHBhdGhzIGFycmF5cyBmb3IgdGhlIGRpZmZlcmVudCBiaW5kaW5nc1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmbi5wYXRocyA9IHBhdGhzOyAvLyBUaGUgYXJyYXkgb2YgcGF0aHMgYXJyYXlzIGZvciB0aGUgZGlmZmVyZW50IGJpbmRpbmdzXG59XG5cbmZ1bmN0aW9uIHBhcnNlZFBhcmFtKGFyZ3MsIHByb3BzLCBjdHgpIHtcblx0cmV0dXJuIFthcmdzLnNsaWNlKDAsIC0xKSwgcHJvcHMuc2xpY2UoMCwgLTEpLCBjdHguc2xpY2UoMCwgLTEpXTtcbn1cblxuZnVuY3Rpb24gcGFyYW1TdHJ1Y3R1cmUocGFydHMsIHR5cGUpIHtcblx0cmV0dXJuICdcXG5cXHQnXG5cdFx0KyAodHlwZVxuXHRcdFx0PyB0eXBlICsgJzp7J1xuXHRcdFx0OiAnJylcblx0XHQrICdhcmdzOlsnICsgcGFydHNbMF0gKyAnXSdcblx0XHQrIChwYXJ0c1sxXSB8fCAhdHlwZVxuXHRcdFx0PyAnLFxcblxcdHByb3BzOnsnICsgcGFydHNbMV0gKyAnfSdcblx0XHRcdDogXCJcIilcblx0XHQrIChwYXJ0c1syXSA/ICcsXFxuXFx0Y3R4OnsnICsgcGFydHNbMl0gKyAnfScgOiBcIlwiKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXJhbXMocGFyYW1zLCBwYXRoQmluZGluZ3MsIHRtcGwpIHtcblxuXHRmdW5jdGlvbiBwYXJzZVRva2VucyhhbGwsIGxmdFBybjAsIGxmdFBybiwgYm91bmQsIHBhdGgsIG9wZXJhdG9yLCBlcnIsIGVxLCBwYXRoMiwgcHJuLCBjb21tYSwgbGZ0UHJuMiwgYXBvcywgcXVvdCwgcnRQcm4sIHJ0UHJuRG90LCBwcm4yLCBzcGFjZSwgaW5kZXgsIGZ1bGwpIHtcblx0Ly8gLyhcXCgpKD89XFxzKlxcKCl8KD86KFsoW10pXFxzKik/KD86KFxcXj8pKCEqP1sjfl0/W1xcdyQuXl0rKT9cXHMqKChcXCtcXCt8LS0pfFxcK3wtfCYmfFxcfFxcfHw9PT18IT09fD09fCE9fDw9fD49fFs8PiUqOj9cXC9dfCg9KSlcXHMqfCghKj9bI35dP1tcXHckLl5dKykoWyhbXSk/KXwoLFxccyopfChcXCg/KVxcXFw/KD86KCcpfChcIikpfCg/OlxccyooKFspXFxdXSkoPz1cXHMqWy5eXXxcXHMqJHxbXihbXSl8WylcXF1dKShbKFtdPykpfChcXHMrKS9nLFxuXHQvLyAgIGxmdFBybjAgICAgICAgIGxmdFBybiAgICAgICAgYm91bmQgICAgICAgICAgICBwYXRoICAgIG9wZXJhdG9yIGVyciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVxICAgICAgICAgICAgIHBhdGgyICAgICAgIHBybiAgICBjb21tYSAgIGxmdFBybjIgICBhcG9zIHF1b3QgICAgICBydFBybiBydFBybkRvdCAgICAgICAgICAgICAgICAgICAgICAgIHBybjIgIHNwYWNlXG5cdFx0Ly8gKGxlZnQgcGFyZW4/IGZvbGxvd2VkIGJ5IChwYXRoPyBmb2xsb3dlZCBieSBvcGVyYXRvcikgb3IgKHBhdGggZm9sbG93ZWQgYnkgcGFyZW4/KSkgb3IgY29tbWEgb3IgYXBvcyBvciBxdW90IG9yIHJpZ2h0IHBhcmVuIG9yIHNwYWNlXG5cdFx0ZnVuY3Rpb24gcGFyc2VQYXRoKGFsbFBhdGgsIG5vdCwgb2JqZWN0LCBoZWxwZXIsIHZpZXcsIHZpZXdQcm9wZXJ0eSwgcGF0aFRva2VucywgbGVhZlRva2VuKSB7XG5cdFx0XHQvL3JQYXRoID0gL14oISo/KSg/Om51bGx8dHJ1ZXxmYWxzZXxcXGRbXFxkLl0qfChbXFx3JF0rfFxcLnx+KFtcXHckXSspfCModmlld3woW1xcdyRdKykpPykoW1xcdyQuXl0qPykoPzpbLlteXShbXFx3JF0rKVxcXT8pPykkL2csXG5cdFx0XHQvLyAgICAgICAgICBub3QgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ICAgICBoZWxwZXIgICAgdmlldyAgdmlld1Byb3BlcnR5IHBhdGhUb2tlbnMgICAgICBsZWFmVG9rZW5cblx0XHRcdHZhciBzdWJQYXRoID0gb2JqZWN0ID09PSBcIi5cIjtcblx0XHRcdGlmIChvYmplY3QpIHtcblx0XHRcdFx0cGF0aCA9IHBhdGguc2xpY2Uobm90Lmxlbmd0aCk7XG5cdFx0XHRcdGlmICgvXlxcLj9jb25zdHJ1Y3RvciQvLnRlc3QobGVhZlRva2VufHxwYXRoKSkge1xuXHRcdFx0XHRcdHN5bnRheEVycm9yKGFsbFBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghc3ViUGF0aCkge1xuXHRcdFx0XHRcdGFsbFBhdGggPSAoaGVscGVyXG5cdFx0XHRcdFx0XHRcdD8gJ3ZpZXcuaGxwKFwiJyArIGhlbHBlciArICdcIiknXG5cdFx0XHRcdFx0XHRcdDogdmlld1xuXHRcdFx0XHRcdFx0XHRcdD8gXCJ2aWV3XCJcblx0XHRcdFx0XHRcdFx0XHQ6IFwiZGF0YVwiKVxuXHRcdFx0XHRcdFx0KyAobGVhZlRva2VuXG5cdFx0XHRcdFx0XHRcdD8gKHZpZXdQcm9wZXJ0eVxuXHRcdFx0XHRcdFx0XHRcdD8gXCIuXCIgKyB2aWV3UHJvcGVydHlcblx0XHRcdFx0XHRcdFx0XHQ6IGhlbHBlclxuXHRcdFx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHRcdFx0XHQ6ICh2aWV3ID8gXCJcIiA6IFwiLlwiICsgb2JqZWN0KVxuXHRcdFx0XHRcdFx0XHRcdCkgKyAocGF0aFRva2VucyB8fCBcIlwiKVxuXHRcdFx0XHRcdFx0XHQ6IChsZWFmVG9rZW4gPSBoZWxwZXIgPyBcIlwiIDogdmlldyA/IHZpZXdQcm9wZXJ0eSB8fCBcIlwiIDogb2JqZWN0LCBcIlwiKSk7XG5cblx0XHRcdFx0XHRhbGxQYXRoID0gYWxsUGF0aCArIChsZWFmVG9rZW4gPyBcIi5cIiArIGxlYWZUb2tlbiA6IFwiXCIpO1xuXG5cdFx0XHRcdFx0YWxsUGF0aCA9IG5vdCArIChhbGxQYXRoLnNsaWNlKDAsIDkpID09PSBcInZpZXcuZGF0YVwiXG5cdFx0XHRcdFx0XHQ/IGFsbFBhdGguc2xpY2UoNSkgLy8gY29udmVydCAjdmlldy5kYXRhLi4uIHRvIGRhdGEuLi5cblx0XHRcdFx0XHRcdDogYWxsUGF0aCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0YmluZHMgPSBuYW1lZCA9PT0gXCJsaW5rVG9cIiA/IChiaW5kdG8gPSBwYXRoQmluZGluZ3MuX2pzdnRvID0gcGF0aEJpbmRpbmdzLl9qc3Z0byB8fCBbXSkgOiBibmRDdHguYmQ7XG5cdFx0XHRcdFx0aWYgKHRoZU9iID0gc3ViUGF0aCAmJiBiaW5kc1tiaW5kcy5sZW5ndGgtMV0pIHtcblx0XHRcdFx0XHRcdGlmICh0aGVPYi5fanN2KSB7XG5cdFx0XHRcdFx0XHRcdHdoaWxlICh0aGVPYi5zYikge1xuXHRcdFx0XHRcdFx0XHRcdHRoZU9iID0gdGhlT2Iuc2I7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKHRoZU9iLmJuZCkge1xuXHRcdFx0XHRcdFx0XHRcdHBhdGggPSBcIl5cIiArIHBhdGguc2xpY2UoMSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0dGhlT2Iuc2IgPSBwYXRoO1xuXHRcdFx0XHRcdFx0XHR0aGVPYi5ibmQgPSB0aGVPYi5ibmQgfHwgcGF0aC5jaGFyQXQoMCkgPT09IFwiXlwiO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRiaW5kcy5wdXNoKHBhdGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXRoU3RhcnRbcGFyZW5EZXB0aF0gPSBpbmRleCArIChzdWJQYXRoID8gMSA6IDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWxsUGF0aDtcblx0XHR9XG5cblx0XHQvL2JvdW5kID0gYmluZGluZ3MgJiYgYm91bmQ7XG5cdFx0aWYgKGJvdW5kICYmICFlcSkge1xuXHRcdFx0cGF0aCA9IGJvdW5kICsgcGF0aDsgLy8gZS5nLiBzb21lLmZuKC4uLilec29tZS5wYXRoIC0gc28gaGVyZSBwYXRoIGlzIFwiXnNvbWUucGF0aFwiXG5cdFx0fVxuXHRcdG9wZXJhdG9yID0gb3BlcmF0b3IgfHwgXCJcIjtcblx0XHRsZnRQcm4gPSBsZnRQcm4gfHwgbGZ0UHJuMCB8fCBsZnRQcm4yO1xuXHRcdHBhdGggPSBwYXRoIHx8IHBhdGgyO1xuXHRcdC8vIENvdWxkIGRvIHRoaXMgLSBidXQgbm90IHdvcnRoIHBlcmYgY29zdD8/IDotXG5cdFx0Ly8gaWYgKCFwYXRoLmxhc3RJbmRleE9mKFwiI2RhdGEuXCIsIDApKSB7IHBhdGggPSBwYXRoLnNsaWNlKDYpOyB9IC8vIElmIHBhdGggc3RhcnRzIHdpdGggXCIjZGF0YS5cIiwgcmVtb3ZlIHRoYXQuXG5cdFx0cHJuID0gcHJuIHx8IHBybjIgfHwgXCJcIjtcblxuXHRcdHZhciBleHByLCBleHByRm4sIGJpbmRzLCB0aGVPYiwgbmV3T2IsXG5cdFx0XHRydFNxID0gXCIpXCI7XG5cblx0XHRpZiAocHJuID09PSBcIltcIikge1xuXHRcdFx0cHJuICA9XCJbai5fc3EoXCI7XG5cdFx0XHRydFNxID0gXCIpXVwiO1xuXHRcdH1cblxuXHRcdGlmIChlcnIgJiYgIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRzeW50YXhFcnJvcihwYXJhbXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoYmluZGluZ3MgJiYgcnRQcm5Eb3QgJiYgIWFwb3NlZCAmJiAhcXVvdGVkKSB7XG5cdFx0XHRcdC8vIFRoaXMgaXMgYSBiaW5kaW5nIHRvIGEgcGF0aCBpbiB3aGljaCBhbiBvYmplY3QgaXMgcmV0dXJuZWQgYnkgYSBoZWxwZXIvZGF0YSBmdW5jdGlvbi9leHByZXNzaW9uLCBlLmcuIGZvbygpXngueSBvciAoYT9iOmMpXngueVxuXHRcdFx0XHQvLyBXZSBjcmVhdGUgYSBjb21waWxlZCBmdW5jdGlvbiB0byBnZXQgdGhlIG9iamVjdCBpbnN0YW5jZSAod2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgZGVwZW5kZW50IGRhdGEgb2YgdGhlIHN1YmV4cHJlc3Npb24gY2hhbmdlcywgdG8gcmV0dXJuIHRoZSBuZXcgb2JqZWN0LCBhbmQgdHJpZ2dlciByZS1iaW5kaW5nIG9mIHRoZSBzdWJzZXF1ZW50IHBhdGgpXG5cdFx0XHRcdGlmICghbmFtZWQgfHwgYm91bmROYW1lIHx8IGJpbmR0bykge1xuXHRcdFx0XHRcdGV4cHIgPSBwYXRoU3RhcnRbcGFyZW5EZXB0aCAtIDFdO1xuXHRcdFx0XHRcdGlmIChmdWxsLmxlbmd0aCAtIDEgPiBpbmRleCAtIChleHByIHx8IDApKSB7IC8vIFdlIG5lZWQgdG8gY29tcGlsZSBhIHN1YmV4cHJlc3Npb25cblx0XHRcdFx0XHRcdGV4cHIgPSBmdWxsLnNsaWNlKGV4cHIsIGluZGV4ICsgYWxsLmxlbmd0aCk7XG5cdFx0XHRcdFx0XHRpZiAoZXhwckZuICE9PSB0cnVlKSB7IC8vIElmIG5vdCByZWVudHJhbnQgY2FsbCBkdXJpbmcgY29tcGlsYXRpb25cblx0XHRcdFx0XHRcdFx0YmluZHMgPSBiaW5kdG8gfHwgYm5kU3RhY2tbcGFyZW5EZXB0aC0xXS5iZDtcblx0XHRcdFx0XHRcdFx0Ly8gSW5zZXJ0IGV4cHJPYiBvYmplY3QsIHRvIGJlIHVzZWQgZHVyaW5nIGJpbmRpbmcgdG8gcmV0dXJuIHRoZSBjb21wdXRlZCBvYmplY3Rcblx0XHRcdFx0XHRcdFx0dGhlT2IgPSBiaW5kc1tiaW5kcy5sZW5ndGgtMV07XG5cdFx0XHRcdFx0XHRcdGlmICh0aGVPYiAmJiB0aGVPYi5wcm0pIHtcblx0XHRcdFx0XHRcdFx0XHR3aGlsZSAodGhlT2Iuc2IgJiYgdGhlT2Iuc2IucHJtKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGVPYiA9IHRoZU9iLnNiO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRuZXdPYiA9IHRoZU9iLnNiID0ge3BhdGg6IHRoZU9iLnNiLCBibmQ6IHRoZU9iLmJuZH07XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0YmluZHMucHVzaChuZXdPYiA9IHtwYXRoOiBiaW5kcy5wb3AoKX0pOyAvLyBJbnNlcnQgZXhwck9iIG9iamVjdCwgdG8gYmUgdXNlZCBkdXJpbmcgYmluZGluZyB0byByZXR1cm4gdGhlIGNvbXB1dGVkIG9iamVjdFxuXHRcdFx0XHRcdFx0XHR9XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAvLyAoZS5nLiBcInNvbWUub2JqZWN0KClcIiBpbiBcInNvbWUub2JqZWN0KCkuYS5iXCIgLSB0byBiZSB1c2VkIGFzIGNvbnRleHQgZm9yIGJpbmRpbmcgdGhlIGZvbGxvd2luZyB0b2tlbnMgXCJhLmJcIilcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJ0UHJuRG90ID0gZGVsaW1PcGVuQ2hhcjEgKyBcIjpcIiArIGV4cHIgLy8gVGhlIHBhcmFtZXRlciBvciBmdW5jdGlvbiBzdWJleHByZXNzaW9uXG5cdFx0XHRcdFx0XHRcdCsgXCIgb25lcnJvcj0nJ1wiIC8vIHNldCBvbmVycm9yPScnIGluIG9yZGVyIHRvIHdyYXAgZ2VuZXJhdGVkIGNvZGUgd2l0aCBhIHRyeSBjYXRjaCAtIHJldHVybmluZyAnJyBhcyBvYmplY3QgaW5zdGFuY2UgaWYgdGhlcmUgaXMgYW4gZXJyb3IvbWlzc2luZyBwYXJlbnRcblx0XHRcdFx0XHRcdFx0KyBkZWxpbUNsb3NlQ2hhcjA7XG5cdFx0XHRcdFx0XHRleHByRm4gPSB0bXBsTGlua3NbcnRQcm5Eb3RdO1xuXHRcdFx0XHRcdFx0aWYgKCFleHByRm4pIHtcblx0XHRcdFx0XHRcdFx0dG1wbExpbmtzW3J0UHJuRG90XSA9IHRydWU7IC8vIEZsYWcgdGhhdCB0aGlzIGV4cHJGbiAoZm9yIHJ0UHJuRG90KSBpcyBiZWluZyBjb21waWxlZFxuXHRcdFx0XHRcdFx0XHR0bXBsTGlua3NbcnRQcm5Eb3RdID0gZXhwckZuID0gdG1wbEZuKHJ0UHJuRG90LCB0bXBsLCB0cnVlKTsgLy8gQ29tcGlsZSB0aGUgZXhwcmVzc2lvbiAob3IgdXNlIGNhY2hlZCBjb3B5IGFscmVhZHkgaW4gdG1wbC5saW5rcylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChleHByRm4gIT09IHRydWUgJiYgbmV3T2IpIHtcblx0XHRcdFx0XHRcdFx0Ly8gSWYgbm90IHJlZW50cmFudCBjYWxsIGR1cmluZyBjb21waWxhdGlvblxuXHRcdFx0XHRcdFx0XHRuZXdPYi5fanN2ID0gZXhwckZuO1xuXHRcdFx0XHRcdFx0XHRuZXdPYi5wcm0gPSBibmRDdHguYmQ7XG5cdFx0XHRcdFx0XHRcdG5ld09iLmJuZCA9IG5ld09iLmJuZCB8fCBuZXdPYi5wYXRoICYmIG5ld09iLnBhdGguaW5kZXhPZihcIl5cIikgPj0gMDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAoYXBvc2VkXG5cdFx0XHRcdC8vIHdpdGhpbiBzaW5nbGUtcXVvdGVkIHN0cmluZ1xuXHRcdFx0XHQ/IChhcG9zZWQgPSAhYXBvcywgKGFwb3NlZCA/IGFsbCA6IGxmdFBybjIgKyAnXCInKSlcblx0XHRcdFx0OiBxdW90ZWRcblx0XHRcdFx0Ly8gd2l0aGluIGRvdWJsZS1xdW90ZWQgc3RyaW5nXG5cdFx0XHRcdFx0PyAocXVvdGVkID0gIXF1b3QsIChxdW90ZWQgPyBhbGwgOiBsZnRQcm4yICsgJ1wiJykpXG5cdFx0XHRcdFx0OlxuXHRcdFx0XHQoXG5cdFx0XHRcdFx0KGxmdFByblxuXHRcdFx0XHRcdFx0PyAocGF0aFN0YXJ0W3BhcmVuRGVwdGhdID0gaW5kZXgrKywgYm5kQ3R4ID0gYm5kU3RhY2tbKytwYXJlbkRlcHRoXSA9IHtiZDogW119LCBsZnRQcm4pXG5cdFx0XHRcdFx0XHQ6IFwiXCIpXG5cdFx0XHRcdFx0KyAoc3BhY2Vcblx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGhcblx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdC8vIE5ldyBhcmcgb3IgcHJvcCAtIHNvIGluc2VydCBiYWNrc3BhY2UgXFxiIChcXHgwOCkgYXMgc2VwYXJhdG9yIGZvciBuYW1lZCBwYXJhbXMsIHVzZWQgc3Vic2VxdWVudGx5IGJ5IHJCdWlsZEhhc2gsIGFuZCBwcmVwYXJlIG5ldyBiaW5kaW5ncyBhcnJheVxuXHRcdFx0XHRcdFx0XHQ6IChwYXJhbUluZGV4ID0gZnVsbC5zbGljZShwYXJhbUluZGV4LCBpbmRleCksIG5hbWVkXG5cdFx0XHRcdFx0XHRcdFx0PyAobmFtZWQgPSBib3VuZE5hbWUgPSBiaW5kdG8gPSBmYWxzZSwgXCJcXGJcIilcblx0XHRcdFx0XHRcdFx0XHQ6IFwiXFxiLFwiKSArIHBhcmFtSW5kZXggKyAocGFyYW1JbmRleCA9IGluZGV4ICsgYWxsLmxlbmd0aCwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnB1c2goYm5kQ3R4LmJkID0gW10pLCBcIlxcYlwiKVxuXHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0OiBlcVxuXHRcdFx0XHQvLyBuYW1lZCBwYXJhbS4gUmVtb3ZlIGJpbmRpbmdzIGZvciBhcmcgYW5kIGNyZWF0ZSBpbnN0ZWFkIGJpbmRpbmdzIGFycmF5IGZvciBwcm9wXG5cdFx0XHRcdFx0XHRcdD8gKHBhcmVuRGVwdGggJiYgc3ludGF4RXJyb3IocGFyYW1zKSwgYmluZGluZ3MgJiYgcGF0aEJpbmRpbmdzLnBvcCgpLCBuYW1lZCA9IHBhdGgsIGJvdW5kTmFtZSA9IGJvdW5kLCBwYXJhbUluZGV4ID0gaW5kZXggKyBhbGwubGVuZ3RoLCBib3VuZCAmJiAoYmluZGluZ3MgPSBibmRDdHguYmQgPSBwYXRoQmluZGluZ3NbbmFtZWRdID0gW10pLCBwYXRoICsgJzonKVxuXHRcdFx0XHRcdFx0XHQ6IHBhdGhcblx0XHRcdFx0Ly8gcGF0aFxuXHRcdFx0XHRcdFx0XHRcdD8gKHBhdGguc3BsaXQoXCJeXCIpLmpvaW4oXCIuXCIpLnJlcGxhY2UoclBhdGgsIHBhcnNlUGF0aClcblx0XHRcdFx0XHRcdFx0XHRcdCsgKHByblxuXHRcdFx0XHQvLyBzb21lLmZuY2FsbChcblx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoYm5kQ3R4ID0gYm5kU3RhY2tbKytwYXJlbkRlcHRoXSA9IHtiZDogW119LCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBydFNxLCBwcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDogb3BlcmF0b3IpXG5cdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHRcdDogb3BlcmF0b3Jcblx0XHRcdFx0Ly8gb3BlcmF0b3Jcblx0XHRcdFx0XHRcdFx0XHRcdD8gb3BlcmF0b3Jcblx0XHRcdFx0XHRcdFx0XHRcdDogcnRQcm5cblx0XHRcdFx0Ly8gZnVuY3Rpb25cblx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoKHJ0UHJuID0gZm5DYWxsW3BhcmVuRGVwdGhdIHx8IHJ0UHJuLCBmbkNhbGxbcGFyZW5EZXB0aF0gPSBmYWxzZSwgYm5kQ3R4ID0gYm5kU3RhY2tbLS1wYXJlbkRlcHRoXSwgcnRQcm4pXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAocHJuIC8vIHJ0UHJuIGFuZCBwcm4sIGUuZyApKCBpbiAoYSkoKSBvciBhKCkoKSwgb3IgKVsgaW4gYSgpW11cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gKGJuZEN0eCA9IGJuZFN0YWNrWysrcGFyZW5EZXB0aF0sIGZuQ2FsbFtwYXJlbkRlcHRoXSA9IHJ0U3EsIHBybilcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogXCJcIilcblx0XHRcdFx0XHRcdFx0XHRcdFx0KVxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ6IGNvbW1hXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyAoZm5DYWxsW3BhcmVuRGVwdGhdIHx8IHN5bnRheEVycm9yKHBhcmFtcyksIFwiLFwiKSAvLyBXZSBkb24ndCBhbGxvdyB0b3AtbGV2ZWwgbGl0ZXJhbCBhcnJheXMgb3Igb2JqZWN0c1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogbGZ0UHJuMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyBcIlwiXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IChhcG9zZWQgPSBhcG9zLCBxdW90ZWQgPSBxdW90LCAnXCInKVxuXHRcdFx0XHQpKVxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHR2YXIgbmFtZWQsIGJpbmR0bywgYm91bmROYW1lLFxuXHRcdHF1b3RlZCwgLy8gYm9vbGVhbiBmb3Igc3RyaW5nIGNvbnRlbnQgaW4gZG91YmxlIHF1b3Rlc1xuXHRcdGFwb3NlZCwgLy8gb3IgaW4gc2luZ2xlIHF1b3Rlc1xuXHRcdGJpbmRpbmdzID0gcGF0aEJpbmRpbmdzICYmIHBhdGhCaW5kaW5nc1swXSwgLy8gYmluZGluZ3MgYXJyYXkgZm9yIHRoZSBmaXJzdCBhcmdcblx0XHRibmRDdHggPSB7YmQ6IGJpbmRpbmdzfSxcblx0XHRibmRTdGFjayA9IHswOiBibmRDdHh9LFxuXHRcdHBhcmFtSW5kZXggPSAwLCAvLyBsaXN0LFxuXHRcdHRtcGxMaW5rcyA9ICh0bXBsID8gdG1wbC5saW5rcyA6IGJpbmRpbmdzICYmIChiaW5kaW5ncy5saW5rcyA9IGJpbmRpbmdzLmxpbmtzIHx8IHt9KSkgfHwgdG9wVmlldy50bXBsLmxpbmtzLFxuXHRcdC8vIFRoZSBmb2xsb3dpbmcgYXJlIHVzZWQgZm9yIHRyYWNraW5nIHBhdGggcGFyc2luZyBpbmNsdWRpbmcgbmVzdGVkIHBhdGhzLCBzdWNoIGFzIFwiYS5iKGNeZCArIChlKSleZlwiLCBhbmQgY2hhaW5lZCBjb21wdXRlZCBwYXRocyBzdWNoIGFzXG5cdFx0Ly8gXCJhLmIoKS5jXmQoKS5lLmYoKS5nXCIgLSB3aGljaCBoYXMgZm91ciBjaGFpbmVkIHBhdGhzLCBcImEuYigpXCIsIFwiXmMuZCgpXCIsIFwiLmUuZigpXCIgYW5kIFwiLmdcIlxuXHRcdHBhcmVuRGVwdGggPSAwLFxuXHRcdGZuQ2FsbCA9IHt9LCAvLyBXZSBhcmUgaW4gYSBmdW5jdGlvbiBjYWxsXG5cdFx0cGF0aFN0YXJ0ID0ge30sIC8vIHRyYWNrcyB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgcGF0aCBzdWNoIGFzIGNeZCgpIGluIHRoZSBhYm92ZSBleGFtcGxlXG5cdFx0cmVzdWx0ID0gKHBhcmFtcyArICh0bXBsID8gXCIgXCIgOiBcIlwiKSkucmVwbGFjZShyUGFyYW1zLCBwYXJzZVRva2Vucyk7XG5cblx0cmV0dXJuICFwYXJlbkRlcHRoICYmIHJlc3VsdCB8fCBzeW50YXhFcnJvcihwYXJhbXMpOyAvLyBTeW50YXggZXJyb3IgaWYgdW5iYWxhbmNlZCBwYXJlbnMgaW4gcGFyYW1zIGV4cHJlc3Npb25cbn1cblxuZnVuY3Rpb24gYnVpbGRDb2RlKGFzdCwgdG1wbCwgaXNMaW5rRXhwcikge1xuXHQvLyBCdWlsZCB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gY29kZSBmcm9tIHRoZSBBU1Qgbm9kZXMsIGFuZCBzZXQgYXMgcHJvcGVydHkgb24gdGhlIHBhc3NlZC1pbiB0ZW1wbGF0ZSBvYmplY3Rcblx0Ly8gVXNlZCBmb3IgY29tcGlsaW5nIHRlbXBsYXRlcywgYW5kIGFsc28gYnkgSnNWaWV3cyB0byBidWlsZCBmdW5jdGlvbnMgZm9yIGRhdGEgbGluayBleHByZXNzaW9uc1xuXHR2YXIgaSwgbm9kZSwgdGFnTmFtZSwgY29udmVydGVyLCB0YWdDdHgsIGhhc1RhZywgaGFzRW5jb2RlciwgZ2V0c1ZhbCwgaGFzQ252dCwgdXNlQ252dCwgdG1wbEJpbmRpbmdzLCBwYXRoQmluZGluZ3MsIHBhcmFtcywgYm91bmRPbkVyclN0YXJ0LCBib3VuZE9uRXJyRW5kLFxuXHRcdHRhZ1JlbmRlciwgbmVzdGVkVG1wbHMsIHRtcGxOYW1lLCBuZXN0ZWRUbXBsLCB0YWdBbmRFbHNlcywgY29udGVudCwgbWFya3VwLCBuZXh0SXNFbHNlLCBvbGRDb2RlLCBpc0Vsc2UsIGlzR2V0VmFsLCB0YWdDdHhGbiwgb25FcnJvciwgdGFnU3RhcnQsIHRyaWdnZXIsXG5cdFx0dG1wbEJpbmRpbmdLZXkgPSAwLFxuXHRcdHVzZVZpZXdzID0gJHN1YlNldHRpbmdzQWR2YW5jZWQudXNlVmlld3MgfHwgdG1wbC51c2VWaWV3cyB8fCB0bXBsLnRhZ3MgfHwgdG1wbC50ZW1wbGF0ZXMgfHwgdG1wbC5oZWxwZXJzIHx8IHRtcGwuY29udmVydGVycyxcblx0XHRjb2RlID0gXCJcIixcblx0XHR0bXBsT3B0aW9ucyA9IHt9LFxuXHRcdGwgPSBhc3QubGVuZ3RoO1xuXG5cdGlmIChcIlwiICsgdG1wbCA9PT0gdG1wbCkge1xuXHRcdHRtcGxOYW1lID0gaXNMaW5rRXhwciA/ICdkYXRhLWxpbms9XCInICsgdG1wbC5yZXBsYWNlKHJOZXdMaW5lLCBcIiBcIikuc2xpY2UoMSwgLTEpICsgJ1wiJyA6IHRtcGw7XG5cdFx0dG1wbCA9IDA7XG5cdH0gZWxzZSB7XG5cdFx0dG1wbE5hbWUgPSB0bXBsLnRtcGxOYW1lIHx8IFwidW5uYW1lZFwiO1xuXHRcdGlmICh0bXBsLmFsbG93Q29kZSkge1xuXHRcdFx0dG1wbE9wdGlvbnMuYWxsb3dDb2RlID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRtcGwuZGVidWcpIHtcblx0XHRcdHRtcGxPcHRpb25zLmRlYnVnID0gdHJ1ZTtcblx0XHR9XG5cdFx0dG1wbEJpbmRpbmdzID0gdG1wbC5ibmRzO1xuXHRcdG5lc3RlZFRtcGxzID0gdG1wbC50bXBscztcblx0fVxuXHRmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG5cdFx0Ly8gQVNUIG5vZGVzOiBbMDogdGFnTmFtZSwgMTogY29udmVydGVyLCAyOiBjb250ZW50LCAzOiBwYXJhbXMsIDQ6IGNvZGUsIDU6IG9uRXJyb3IsIDY6IHRyaWdnZXIsIDc6cGF0aEJpbmRpbmdzLCA4OiBjb250ZW50TWFya3VwXVxuXHRcdG5vZGUgPSBhc3RbaV07XG5cblx0XHQvLyBBZGQgbmV3bGluZSBmb3IgZWFjaCBjYWxsb3V0IHRvIHQoKSBjKCkgZXRjLiBhbmQgZWFjaCBtYXJrdXAgc3RyaW5nXG5cdFx0aWYgKFwiXCIgKyBub2RlID09PSBub2RlKSB7XG5cdFx0XHQvLyBhIG1hcmt1cCBzdHJpbmcgdG8gYmUgaW5zZXJ0ZWRcblx0XHRcdGNvZGUgKz0gJ1xcbitcIicgKyBub2RlICsgJ1wiJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYSBjb21waWxlZCB0YWcgZXhwcmVzc2lvbiB0byBiZSBpbnNlcnRlZFxuXHRcdFx0dGFnTmFtZSA9IG5vZGVbMF07XG5cdFx0XHRpZiAodGFnTmFtZSA9PT0gXCIqXCIpIHtcblx0XHRcdFx0Ly8gQ29kZSB0YWc6IHt7KiB9fVxuXHRcdFx0XHRjb2RlICs9IFwiO1xcblwiICsgbm9kZVsxXSArIFwiXFxucmV0PXJldFwiO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udmVydGVyID0gbm9kZVsxXTtcblx0XHRcdFx0Y29udGVudCA9ICFpc0xpbmtFeHByICYmIG5vZGVbMl07XG5cdFx0XHRcdHRhZ0N0eCA9IHBhcmFtU3RydWN0dXJlKG5vZGVbM10sICdwYXJhbXMnKSArICd9LCcgKyBwYXJhbVN0cnVjdHVyZShwYXJhbXMgPSBub2RlWzRdKTtcblx0XHRcdFx0b25FcnJvciA9IG5vZGVbNV07XG5cdFx0XHRcdHRyaWdnZXIgPSBub2RlWzZdO1xuXHRcdFx0XHRtYXJrdXAgPSBub2RlWzhdICYmIG5vZGVbOF0ucmVwbGFjZShyVW5lc2NhcGVRdW90ZXMsIFwiJDFcIik7XG5cdFx0XHRcdGlmIChpc0Vsc2UgPSB0YWdOYW1lID09PSBcImVsc2VcIikge1xuXHRcdFx0XHRcdGlmIChwYXRoQmluZGluZ3MpIHtcblx0XHRcdFx0XHRcdHBhdGhCaW5kaW5ncy5wdXNoKG5vZGVbN10pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0bXBsQmluZGluZ0tleSA9IDA7XG5cdFx0XHRcdFx0aWYgKHRtcGxCaW5kaW5ncyAmJiAocGF0aEJpbmRpbmdzID0gbm9kZVs3XSkpIHsgLy8gQXJyYXkgb2YgcGF0aHMsIG9yIGZhbHNlIGlmIG5vdCBkYXRhLWJvdW5kXG5cdFx0XHRcdFx0XHRwYXRoQmluZGluZ3MgPSBbcGF0aEJpbmRpbmdzXTtcblx0XHRcdFx0XHRcdHRtcGxCaW5kaW5nS2V5ID0gdG1wbEJpbmRpbmdzLnB1c2goMSk7IC8vIEFkZCBwbGFjZWhvbGRlciBpbiB0bXBsQmluZGluZ3MgZm9yIGNvbXBpbGVkIGZ1bmN0aW9uXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHVzZVZpZXdzID0gdXNlVmlld3MgfHwgcGFyYW1zWzFdIHx8IHBhcmFtc1syXSB8fCBwYXRoQmluZGluZ3MgfHwgL3ZpZXcuKD8haW5kZXgpLy50ZXN0KHBhcmFtc1swXSk7XG5cdFx0XHRcdC8vIHVzZVZpZXdzIGlzIGZvciBwZXJmIG9wdGltaXphdGlvbi4gRm9yIHJlbmRlcigpIHdlIG9ubHkgdXNlIHZpZXdzIGlmIG5lY2Vzc2FyeSAtIGZvciB0aGUgbW9yZSBhZHZhbmNlZCBzY2VuYXJpb3MuXG5cdFx0XHRcdC8vIFdlIHVzZSB2aWV3cyBpZiB0aGVyZSBhcmUgcHJvcHMsIGNvbnRleHR1YWwgcHJvcGVydGllcyBvciBhcmdzIHdpdGggIy4uLiAob3RoZXIgdGhhbiAjaW5kZXgpIC0gYnV0IHlvdSBjYW4gZm9yY2Vcblx0XHRcdFx0Ly8gdXNpbmcgdGhlIGZ1bGwgdmlldyBpbmZyYXN0cnVjdHVyZSwgKGFuZCBwYXkgYSBwZXJmIHByaWNlKSBieSBvcHRpbmcgaW46IFNldCB1c2VWaWV3czogdHJ1ZSBvbiB0aGUgdGVtcGxhdGUsIG1hbnVhbGx5Li4uXG5cdFx0XHRcdGlmIChpc0dldFZhbCA9IHRhZ05hbWUgPT09IFwiOlwiKSB7XG5cdFx0XHRcdFx0aWYgKGNvbnZlcnRlcikge1xuXHRcdFx0XHRcdFx0dGFnTmFtZSA9IGNvbnZlcnRlciA9PT0gSFRNTCA/IFwiPlwiIDogY29udmVydGVyICsgdGFnTmFtZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHsgLy8gVE9ETyBvcHRpbWl6ZSAtIGlmIGNvbnRlbnQubGVuZ3RoID09PSAwIG9yIGlmIHRoZXJlIGlzIGEgdG1wbD1cIi4uLlwiIHNwZWNpZmllZCAtIHNldCBjb250ZW50IHRvIG51bGwgLyBkb24ndCBydW4gdGhpcyBjb21waWxhdGlvbiBjb2RlIC0gc2luY2UgY29udGVudCB3b24ndCBnZXQgdXNlZCEhXG5cdFx0XHRcdFx0XHQvLyBDcmVhdGUgdGVtcGxhdGUgb2JqZWN0IGZvciBuZXN0ZWQgdGVtcGxhdGVcblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwgPSB0bXBsT2JqZWN0KG1hcmt1cCwgdG1wbE9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbC50bXBsTmFtZSA9IHRtcGxOYW1lICsgXCIvXCIgKyB0YWdOYW1lO1xuXHRcdFx0XHRcdFx0Ly8gQ29tcGlsZSB0byBBU1QgYW5kIHRoZW4gdG8gY29tcGlsZWQgZnVuY3Rpb25cblx0XHRcdFx0XHRcdG5lc3RlZFRtcGwudXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzIHx8IHVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0YnVpbGRDb2RlKGNvbnRlbnQsIG5lc3RlZFRtcGwpO1xuXHRcdFx0XHRcdFx0dXNlVmlld3MgPSBuZXN0ZWRUbXBsLnVzZVZpZXdzO1xuXHRcdFx0XHRcdFx0bmVzdGVkVG1wbHMucHVzaChuZXN0ZWRUbXBsKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWlzRWxzZSkge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBub3QgYW4gZWxzZSB0YWcuXG5cdFx0XHRcdFx0XHR0YWdBbmRFbHNlcyA9IHRhZ05hbWU7XG5cdFx0XHRcdFx0XHR1c2VWaWV3cyA9IHVzZVZpZXdzIHx8IHRhZ05hbWUgJiYgKCEkdGFnc1t0YWdOYW1lXSB8fCAhJHRhZ3NbdGFnTmFtZV0uZmxvdyk7XG5cdFx0XHRcdFx0XHQvLyBTd2l0Y2ggdG8gYSBuZXcgY29kZSBzdHJpbmcgZm9yIHRoaXMgYm91bmQgdGFnIChhbmQgaXRzIGVsc2VzLCBpZiBpdCBoYXMgYW55KSAtIGZvciByZXR1cm5pbmcgdGhlIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRcdG9sZENvZGUgPSBjb2RlO1xuXHRcdFx0XHRcdFx0Y29kZSA9IFwiXCI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBhc3RbaSArIDFdO1xuXHRcdFx0XHRcdG5leHRJc0Vsc2UgPSBuZXh0SXNFbHNlICYmIG5leHRJc0Vsc2VbMF0gPT09IFwiZWxzZVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRhZ1N0YXJ0ID0gb25FcnJvciA/IFwiO1xcbnRyeXtcXG5yZXQrPVwiIDogXCJcXG4rXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IFwiXCI7XG5cdFx0XHRcdGJvdW5kT25FcnJFbmQgPSBcIlwiO1xuXG5cdFx0XHRcdGlmIChpc0dldFZhbCAmJiAocGF0aEJpbmRpbmdzIHx8IHRyaWdnZXIgfHwgY29udmVydGVyICYmIGNvbnZlcnRlciAhPT0gSFRNTCkpIHtcblx0XHRcdFx0XHQvLyBGb3IgY29udmVydFZhbCB3ZSBuZWVkIGEgY29tcGlsZWQgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSBuZXcgdGFnQ3R4KHMpXG5cdFx0XHRcdFx0dGFnQ3R4Rm4gPSBuZXcgRnVuY3Rpb24oXCJkYXRhLHZpZXcsaix1XCIsIFwiIC8vIFwiICsgdG1wbE5hbWUgKyBcIiBcIiArIHRtcGxCaW5kaW5nS2V5ICsgXCIgXCIgKyB0YWdOYW1lXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgXCJcXG5yZXR1cm4ge1wiICsgdGFnQ3R4ICsgXCJ9O1wiKTtcblx0XHRcdFx0XHR0YWdDdHhGbi5fZXIgPSBvbkVycm9yO1xuXHRcdFx0XHRcdHRhZ0N0eEZuLl90YWcgPSB0YWdOYW1lO1xuXG5cdFx0XHRcdFx0aWYgKGlzTGlua0V4cHIpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0YWdDdHhGbjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzZXRQYXRocyh0YWdDdHhGbiwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHR0YWdSZW5kZXIgPSAnYyhcIicgKyBjb252ZXJ0ZXIgKyAnXCIsdmlldywnO1xuXHRcdFx0XHRcdHVzZUNudnQgPSB0cnVlO1xuXHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsXCI7XG5cdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvZGUgKz0gKGlzR2V0VmFsXG5cdFx0XHRcdFx0PyAoaXNMaW5rRXhwciA/IChvbkVycm9yID8gXCJ0cnl7XFxuXCIgOiBcIlwiKSArIFwicmV0dXJuIFwiIDogdGFnU3RhcnQpICsgKHVzZUNudnQgLy8gQ2FsbCBfY252dCBpZiB0aGVyZSBpcyBhIGNvbnZlcnRlcjoge3tjbnZ0OiAuLi4gfX0gb3Ige157Y252dDogLi4uIH19XG5cdFx0XHRcdFx0XHQ/ICh1c2VDbnZ0ID0gdW5kZWZpbmVkLCB1c2VWaWV3cyA9IGhhc0NudnQgPSB0cnVlLCB0YWdSZW5kZXIgKyAocGF0aEJpbmRpbmdzXG5cdFx0XHRcdFx0XHRcdD8gKCh0bXBsQmluZGluZ3NbdG1wbEJpbmRpbmdLZXkgLSAxXSA9IHRhZ0N0eEZuKSwgdG1wbEJpbmRpbmdLZXkpIC8vIFN0b3JlIHRoZSBjb21waWxlZCB0YWdDdHhGbiBpbiB0bXBsLmJuZHMsIGFuZCBwYXNzIHRoZSBrZXkgdG8gY29udmVydFZhbCgpXG5cdFx0XHRcdFx0XHRcdDogXCJ7XCIgKyB0YWdDdHggKyBcIn1cIikgKyBcIilcIilcblx0XHRcdFx0XHRcdDogdGFnTmFtZSA9PT0gXCI+XCJcblx0XHRcdFx0XHRcdFx0PyAoaGFzRW5jb2RlciA9IHRydWUsIFwiaChcIiArIHBhcmFtc1swXSArIFwiKVwiKVxuXHRcdFx0XHRcdFx0XHQ6IChnZXRzVmFsID0gdHJ1ZSwgXCIoKHY9XCIgKyBwYXJhbXNbMF0gKyAnKSE9bnVsbD92OicgKyAoaXNMaW5rRXhwciA/ICdudWxsKScgOiAnXCJcIiknKSlcblx0XHRcdFx0XHRcdFx0Ly8gTm9uIHN0cmljdCBlcXVhbGl0eSBzbyBkYXRhLWxpbms9XCJ0aXRsZXs6ZXhwcn1cIiB3aXRoIGV4cHI9bnVsbC91bmRlZmluZWQgcmVtb3ZlcyB0aXRsZSBhdHRyaWJ1dGVcblx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0OiAoaGFzVGFnID0gdHJ1ZSwgXCJcXG57dmlldzp2aWV3LHRtcGw6XCIgLy8gQWRkIHRoaXMgdGFnQ3R4IHRvIHRoZSBjb21waWxlZCBjb2RlIGZvciB0aGUgdGFnQ3R4cyB0byBiZSBwYXNzZWQgdG8gcmVuZGVyVGFnKClcblx0XHRcdFx0XHRcdCsgKGNvbnRlbnQgPyBuZXN0ZWRUbXBscy5sZW5ndGggOiBcIjBcIikgKyBcIixcIiAvLyBGb3IgYmxvY2sgdGFncywgcGFzcyBpbiB0aGUga2V5IChuZXN0ZWRUbXBscy5sZW5ndGgpIHRvIHRoZSBuZXN0ZWQgY29udGVudCB0ZW1wbGF0ZVxuXHRcdFx0XHRcdFx0KyB0YWdDdHggKyBcIn0sXCIpKTtcblxuXHRcdFx0XHRpZiAodGFnQW5kRWxzZXMgJiYgIW5leHRJc0Vsc2UpIHtcblx0XHRcdFx0XHQvLyBUaGlzIGlzIGEgZGF0YS1saW5rIGV4cHJlc3Npb24gb3IgYW4gaW5saW5lIHRhZyB3aXRob3V0IGFueSBlbHNlcywgb3IgdGhlIGxhc3Qge3tlbHNlfX0gb2YgYW4gaW5saW5lIHRhZ1xuXHRcdFx0XHRcdC8vIFdlIGNvbXBsZXRlIHRoZSBjb2RlIGZvciByZXR1cm5pbmcgdGhlIHRhZ0N0eHMgYXJyYXlcblx0XHRcdFx0XHRjb2RlID0gXCJbXCIgKyBjb2RlLnNsaWNlKDAsIC0xKSArIFwiXVwiO1xuXHRcdFx0XHRcdHRhZ1JlbmRlciA9ICd0KFwiJyArIHRhZ0FuZEVsc2VzICsgJ1wiLHZpZXcsdGhpcywnO1xuXHRcdFx0XHRcdGlmIChpc0xpbmtFeHByIHx8IHBhdGhCaW5kaW5ncykge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBpcyBhIGJvdW5kIHRhZyAoZGF0YS1saW5rIGV4cHJlc3Npb24gb3IgaW5saW5lIGJvdW5kIHRhZyB7Xnt0YWcgLi4ufX0pIHNvIHdlIHN0b3JlIGEgY29tcGlsZWQgdGFnQ3R4cyBmdW5jdGlvbiBpbiB0bXAuYm5kc1xuXHRcdFx0XHRcdFx0Y29kZSA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqLHVcIiwgXCIgLy8gXCIgKyB0bXBsTmFtZSArIFwiIFwiICsgdG1wbEJpbmRpbmdLZXkgKyBcIiBcIiArIHRhZ0FuZEVsc2VzICsgXCJcXG5yZXR1cm4gXCIgKyBjb2RlICsgXCI7XCIpO1xuXHRcdFx0XHRcdFx0Y29kZS5fZXIgPSBvbkVycm9yO1xuXHRcdFx0XHRcdFx0Y29kZS5fdGFnID0gdGFnQW5kRWxzZXM7XG5cdFx0XHRcdFx0XHRpZiAocGF0aEJpbmRpbmdzKSB7XG5cdFx0XHRcdFx0XHRcdHNldFBhdGhzKHRtcGxCaW5kaW5nc1t0bXBsQmluZGluZ0tleSAtIDFdID0gY29kZSwgcGF0aEJpbmRpbmdzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChpc0xpbmtFeHByKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBjb2RlOyAvLyBGb3IgYSBkYXRhLWxpbmsgZXhwcmVzc2lvbiB3ZSByZXR1cm4gdGhlIGNvbXBpbGVkIHRhZ0N0eHMgZnVuY3Rpb25cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJvdW5kT25FcnJTdGFydCA9IHRhZ1JlbmRlciArIHRtcGxCaW5kaW5nS2V5ICsgXCIsdW5kZWZpbmVkLFwiO1xuXHRcdFx0XHRcdFx0Ym91bmRPbkVyckVuZCA9IFwiKVwiO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFRoaXMgaXMgdGhlIGxhc3Qge3tlbHNlfX0gZm9yIGFuIGlubGluZSB0YWcuXG5cdFx0XHRcdFx0Ly8gRm9yIGEgYm91bmQgdGFnLCBwYXNzIHRoZSB0YWdDdHhzIGZuIGxvb2t1cCBrZXkgdG8gcmVuZGVyVGFnLlxuXHRcdFx0XHRcdC8vIEZvciBhbiB1bmJvdW5kIHRhZywgaW5jbHVkZSB0aGUgY29kZSBkaXJlY3RseSBmb3IgZXZhbHVhdGluZyB0YWdDdHhzIGFycmF5XG5cdFx0XHRcdFx0Y29kZSA9IG9sZENvZGUgKyB0YWdTdGFydCArIHRhZ1JlbmRlciArICh0bXBsQmluZGluZ0tleSB8fCBjb2RlKSArIFwiKVwiO1xuXHRcdFx0XHRcdHBhdGhCaW5kaW5ncyA9IDA7XG5cdFx0XHRcdFx0dGFnQW5kRWxzZXMgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvbkVycm9yKSB7XG5cdFx0XHRcdFx0dXNlVmlld3MgPSB0cnVlO1xuXHRcdFx0XHRcdGNvZGUgKz0gJztcXG59Y2F0Y2goZSl7cmV0JyArIChpc0xpbmtFeHByID8gXCJ1cm4gXCIgOiBcIis9XCIpICsgYm91bmRPbkVyclN0YXJ0ICsgJ2ouX2VycihlLHZpZXcsJyArIG9uRXJyb3IgKyAnKScgKyBib3VuZE9uRXJyRW5kICsgJzt9JyArIChpc0xpbmtFeHByID8gXCJcIiA6ICdyZXQ9cmV0Jyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0Ly8gSW5jbHVkZSBvbmx5IHRoZSB2YXIgcmVmZXJlbmNlcyB0aGF0IGFyZSBuZWVkZWQgaW4gdGhlIGNvZGVcblx0Y29kZSA9IFwiLy8gXCIgKyB0bXBsTmFtZVxuXG5cdFx0KyBcIlxcbnZhciB2XCJcblx0XHQrIChoYXNUYWcgPyBcIix0PWouX3RhZ1wiIDogXCJcIikgICAgICAgICAgICAgICAgLy8gaGFzIHRhZ1xuXHRcdCsgKGhhc0NudnQgPyBcIixjPWouX2NudnRcIiA6IFwiXCIpICAgICAgICAgICAgICAvLyBjb252ZXJ0ZXJcblx0XHQrIChoYXNFbmNvZGVyID8gXCIsaD1qLl9odG1sXCIgOiBcIlwiKSAgICAgICAgICAgLy8gaHRtbCBjb252ZXJ0ZXJcblx0XHQrIChpc0xpbmtFeHByID8gXCI7XFxuXCIgOiAnLHJldD1cIlwiXFxuJylcblx0XHQrICh0bXBsT3B0aW9ucy5kZWJ1ZyA/IFwiZGVidWdnZXI7XCIgOiBcIlwiKVxuXHRcdCsgY29kZVxuXHRcdCsgKGlzTGlua0V4cHIgPyBcIlxcblwiIDogXCI7XFxucmV0dXJuIHJldDtcIik7XG5cblx0aWYgKCRzdWJTZXR0aW5ncy5kZWJ1Z01vZGUgIT09IGZhbHNlKSB7XG5cdFx0Y29kZSA9IFwidHJ5IHtcXG5cIiArIGNvZGUgKyBcIlxcbn1jYXRjaChlKXtcXG5yZXR1cm4gai5fZXJyKGUsIHZpZXcpO1xcbn1cIjtcblx0fVxuXG5cdHRyeSB7XG5cdFx0Y29kZSA9IG5ldyBGdW5jdGlvbihcImRhdGEsdmlldyxqLHVcIiwgY29kZSk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRzeW50YXhFcnJvcihcIkNvbXBpbGVkIHRlbXBsYXRlIGNvZGU6XFxuXFxuXCIgKyBjb2RlICsgJ1xcbjogXCInICsgZS5tZXNzYWdlICsgJ1wiJyk7XG5cdH1cblx0aWYgKHRtcGwpIHtcblx0XHR0bXBsLmZuID0gY29kZTtcblx0XHR0bXBsLnVzZVZpZXdzID0gISF1c2VWaWV3cztcblx0fVxuXHRyZXR1cm4gY29kZTtcbn1cblxuLy89PT09PT09PT09XG4vLyBVdGlsaXRpZXNcbi8vPT09PT09PT09PVxuXG4vLyBNZXJnZSBvYmplY3RzLCBpbiBwYXJ0aWN1bGFyIGNvbnRleHRzIHdoaWNoIGluaGVyaXQgZnJvbSBwYXJlbnQgY29udGV4dHNcbmZ1bmN0aW9uIGV4dGVuZEN0eChjb250ZXh0LCBwYXJlbnRDb250ZXh0KSB7XG5cdC8vIFJldHVybiBjb3B5IG9mIHBhcmVudENvbnRleHQsIHVubGVzcyBjb250ZXh0IGlzIGRlZmluZWQgYW5kIGlzIGRpZmZlcmVudCwgaW4gd2hpY2ggY2FzZSByZXR1cm4gYSBuZXcgbWVyZ2VkIGNvbnRleHRcblx0Ly8gSWYgbmVpdGhlciBjb250ZXh0IG5vciBwYXJlbnRDb250ZXh0IGFyZSBkZWZpbmVkLCByZXR1cm4gdW5kZWZpbmVkXG5cdHJldHVybiBjb250ZXh0ICYmIGNvbnRleHQgIT09IHBhcmVudENvbnRleHRcblx0XHQ/IChwYXJlbnRDb250ZXh0XG5cdFx0XHQ/ICRleHRlbmQoJGV4dGVuZCh7fSwgcGFyZW50Q29udGV4dCksIGNvbnRleHQpXG5cdFx0XHQ6IGNvbnRleHQpXG5cdFx0OiBwYXJlbnRDb250ZXh0ICYmICRleHRlbmQoe30sIHBhcmVudENvbnRleHQpO1xufVxuXG4vLyBHZXQgY2hhcmFjdGVyIGVudGl0eSBmb3IgSFRNTCBhbmQgQXR0cmlidXRlIGVuY29kaW5nXG5mdW5jdGlvbiBnZXRDaGFyRW50aXR5KGNoKSB7XG5cdHJldHVybiBjaGFyRW50aXRpZXNbY2hdIHx8IChjaGFyRW50aXRpZXNbY2hdID0gXCImI1wiICsgY2guY2hhckNvZGVBdCgwKSArIFwiO1wiKTtcbn1cblxuZnVuY3Rpb24gZ2V0VGFyZ2V0UHJvcHMoc291cmNlKSB7XG5cdC8vIHRoaXMgcG9pbnRlciBpcyB0aGVNYXAgLSB3aGljaCBoYXMgdGFnQ3R4LnByb3BzIHRvb1xuXHQvLyBhcmd1bWVudHM6IHRhZ0N0eC5hcmdzLlxuXHR2YXIga2V5LCBwcm9wLFxuXHRcdHByb3BzID0gW107XG5cblx0aWYgKHR5cGVvZiBzb3VyY2UgPT09IE9CSkVDVCkge1xuXHRcdGZvciAoa2V5IGluIHNvdXJjZSkge1xuXHRcdFx0cHJvcCA9IHNvdXJjZVtrZXldO1xuXHRcdFx0aWYgKGtleSAhPT0gJGV4cGFuZG8gJiYgc291cmNlLmhhc093blByb3BlcnR5KGtleSkgJiYgISRpc0Z1bmN0aW9uKHByb3ApKSB7XG5cdFx0XHRcdHByb3BzLnB1c2goe2tleToga2V5LCBwcm9wOiBwcm9wfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBwcm9wcztcbn1cblxuZnVuY3Rpb24gJGZuUmVuZGVyKGRhdGEsIGNvbnRleHQsIG5vSXRlcmF0aW9uKSB7XG5cdHZhciB0bXBsRWxlbSA9IHRoaXMuanF1ZXJ5ICYmICh0aGlzWzBdIHx8IGVycm9yKCdVbmtub3duIHRlbXBsYXRlOiBcIicgKyB0aGlzLnNlbGVjdG9yICsgJ1wiJykpLFxuXHRcdHRtcGwgPSB0bXBsRWxlbS5nZXRBdHRyaWJ1dGUodG1wbEF0dHIpO1xuXG5cdHJldHVybiByZW5kZXJDb250ZW50LmNhbGwodG1wbCA/ICQuZGF0YSh0bXBsRWxlbSlbanN2VG1wbF0gOiAkdGVtcGxhdGVzKHRtcGxFbGVtKSwgZGF0YSwgY29udGV4dCwgbm9JdGVyYXRpb24pO1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IFJlZ2lzdGVyIGNvbnZlcnRlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZnVuY3Rpb24gaHRtbEVuY29kZSh0ZXh0KSB7XG5cdC8vIEhUTUwgZW5jb2RlOiBSZXBsYWNlIDwgPiAmICcgYW5kIFwiIGJ5IGNvcnJlc3BvbmRpbmcgZW50aXRpZXMuXG5cdHJldHVybiB0ZXh0ICE9IHVuZGVmaW5lZCA/IHJJc0h0bWwudGVzdCh0ZXh0KSAmJiAoXCJcIiArIHRleHQpLnJlcGxhY2Uockh0bWxFbmNvZGUsIGdldENoYXJFbnRpdHkpIHx8IHRleHQgOiBcIlwiO1xufVxuXG4vLz09PT09PT09PT09PT09PT09PT09PT09PT09IEluaXRpYWxpemUgPT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuJHN1YiA9ICR2aWV3cy5zdWI7XG4kdmlld3NTZXR0aW5ncyA9ICR2aWV3cy5zZXR0aW5ncztcblxuaWYgKCEoanNyIHx8ICQgJiYgJC5yZW5kZXIpKSB7XG5cdC8vIEpzUmVuZGVyIG5vdCBhbHJlYWR5IGxvYWRlZCwgb3IgbG9hZGVkIHdpdGhvdXQgalF1ZXJ5LCBhbmQgd2UgYXJlIG5vdyBtb3ZpbmcgZnJvbSBqc3JlbmRlciBuYW1lc3BhY2UgdG8galF1ZXJ5IG5hbWVwYWNlXG5cdGZvciAoanN2U3RvcmVOYW1lIGluIGpzdlN0b3Jlcykge1xuXHRcdHJlZ2lzdGVyU3RvcmUoanN2U3RvcmVOYW1lLCBqc3ZTdG9yZXNbanN2U3RvcmVOYW1lXSk7XG5cdH1cblxuXHQkY29udmVydGVycyA9ICR2aWV3cy5jb252ZXJ0ZXJzO1xuXHQkaGVscGVycyA9ICR2aWV3cy5oZWxwZXJzO1xuXHQkdGFncyA9ICR2aWV3cy50YWdzO1xuXG5cdCRzdWIuX3RnLnByb3RvdHlwZSA9IHtcblx0XHRiYXNlQXBwbHk6IGJhc2VBcHBseSxcblx0XHRjdnRBcmdzOiBjb252ZXJ0QXJnc1xuXHR9O1xuXG5cdHRvcFZpZXcgPSAkc3ViLnRvcFZpZXcgPSBuZXcgVmlldygpO1xuXG5cdC8vQlJPV1NFUi1TUEVDSUZJQyBDT0RFXG5cdGlmICgkKSB7XG5cblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHQvLyBqUXVlcnkgKD0gJCkgaXMgbG9hZGVkXG5cblx0XHQkLmZuLnJlbmRlciA9ICRmblJlbmRlcjtcblx0XHQkZXhwYW5kbyA9ICQuZXhwYW5kbztcblx0XHRpZiAoJC5vYnNlcnZhYmxlKSB7XG5cdFx0XHQkZXh0ZW5kKCRzdWIsICQudmlld3Muc3ViKTsgLy8ganF1ZXJ5Lm9ic2VydmFibGUuanMgd2FzIGxvYWRlZCBiZWZvcmUganNyZW5kZXIuanNcblx0XHRcdCR2aWV3cy5tYXAgPSAkLnZpZXdzLm1hcDtcblx0XHR9XG5cblx0fSBlbHNlIHtcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHQvLyBqUXVlcnkgaXMgbm90IGxvYWRlZC5cblxuXHRcdCQgPSB7fTtcblxuXHRcdGlmIChzZXRHbG9iYWxzKSB7XG5cdFx0XHRnbG9iYWwuanNyZW5kZXIgPSAkOyAvLyBXZSBhcmUgbG9hZGluZyBqc3JlbmRlci5qcyBmcm9tIGEgc2NyaXB0IGVsZW1lbnQsIG5vdCBBTUQgb3IgQ29tbW9uSlMsIHNvIHNldCBnbG9iYWxcblx0XHR9XG5cblx0XHQvLyBFcnJvciB3YXJuaW5nIGlmIGpzcmVuZGVyLmpzIGlzIHVzZWQgYXMgdGVtcGxhdGUgZW5naW5lIG9uIE5vZGUuanMgKGUuZy4gRXhwcmVzcyBvciBIYXBpLi4uKVxuXHRcdC8vIFVzZSBqc3JlbmRlci1ub2RlLmpzIGluc3RlYWQuLi5cblx0XHQkLnJlbmRlckZpbGUgPSAkLl9fZXhwcmVzcyA9ICQuY29tcGlsZSA9IGZ1bmN0aW9uKCkgeyB0aHJvdyBcIk5vZGUuanM6IHVzZSBucG0ganNyZW5kZXIsIG9yIGpzcmVuZGVyLW5vZGUuanNcIjsgfTtcblxuXHRcdC8vRU5EIEJST1dTRVItU1BFQ0lGSUMgQ09ERVxuXHRcdCQuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iKSB7XG5cdFx0XHRyZXR1cm4gdHlwZW9mIG9iID09PSBcImZ1bmN0aW9uXCI7XG5cdFx0fTtcblxuXHRcdCQuaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG5cdFx0XHRyZXR1cm4gKHt9LnRvU3RyaW5nKS5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIjtcblx0XHR9O1xuXG5cdFx0JHN1Yi5fanEgPSBmdW5jdGlvbihqcSkgeyAvLyBwcml2YXRlIG1ldGhvZCB0byBtb3ZlIGZyb20gSnNSZW5kZXIgQVBJcyBmcm9tIGpzcmVuZGVyIG5hbWVzcGFjZSB0byBqUXVlcnkgbmFtZXNwYWNlXG5cdFx0XHRpZiAoanEgIT09ICQpIHtcblx0XHRcdFx0JGV4dGVuZChqcSwgJCk7IC8vIG1hcCBvdmVyIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lc3BhY2Vcblx0XHRcdFx0JCA9IGpxO1xuXHRcdFx0XHQkLmZuLnJlbmRlciA9ICRmblJlbmRlcjtcblx0XHRcdFx0ZGVsZXRlICQuanNyZW5kZXI7XG5cdFx0XHRcdCRleHBhbmRvID0gJC5leHBhbmRvO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQkLmpzcmVuZGVyID0gdmVyc2lvbk51bWJlcjtcblx0fVxuXHQkc3ViU2V0dGluZ3MgPSAkc3ViLnNldHRpbmdzO1xuXHQkc3ViU2V0dGluZ3MuYWxsb3dDb2RlID0gZmFsc2U7XG5cdCRpc0Z1bmN0aW9uID0gJC5pc0Z1bmN0aW9uO1xuXHQkLnJlbmRlciA9ICRyZW5kZXI7XG5cdCQudmlld3MgPSAkdmlld3M7XG5cdCQudGVtcGxhdGVzID0gJHRlbXBsYXRlcyA9ICR2aWV3cy50ZW1wbGF0ZXM7XG5cblx0Zm9yIChzZXR0aW5nIGluICRzdWJTZXR0aW5ncykge1xuXHRcdGFkZFNldHRpbmcoc2V0dGluZyk7XG5cdH1cblxuXHQoJHZpZXdzU2V0dGluZ3MuZGVidWdNb2RlID0gZnVuY3Rpb24oZGVidWdNb2RlKSB7XG5cdFx0cmV0dXJuIGRlYnVnTW9kZSA9PT0gdW5kZWZpbmVkXG5cdFx0XHQ/ICRzdWJTZXR0aW5ncy5kZWJ1Z01vZGVcblx0XHRcdDogKFxuXHRcdFx0XHQkc3ViU2V0dGluZ3MuZGVidWdNb2RlID0gZGVidWdNb2RlLFxuXHRcdFx0XHQkc3ViU2V0dGluZ3Mub25FcnJvciA9IGRlYnVnTW9kZSArIFwiXCIgPT09IGRlYnVnTW9kZVxuXHRcdFx0XHRcdD8gbmV3IEZ1bmN0aW9uKFwiXCIsIFwicmV0dXJuICdcIiArIGRlYnVnTW9kZSArIFwiJztcIiApXG5cdFx0XHRcdFx0OiAkaXNGdW5jdGlvbihkZWJ1Z01vZGUpXG5cdFx0XHRcdFx0XHQ/IGRlYnVnTW9kZVxuXHRcdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRcdCR2aWV3c1NldHRpbmdzKTtcblx0fSkoZmFsc2UpOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcblxuXHQkc3ViU2V0dGluZ3NBZHZhbmNlZCA9ICRzdWJTZXR0aW5ncy5hZHZhbmNlZCA9IHtcblx0XHR1c2VWaWV3czogZmFsc2UsXG5cdFx0X2pzdjogZmFsc2UgLy8gRm9yIGdsb2JhbCBhY2Nlc3MgdG8gSnNWaWV3cyBzdG9yZVxuXHR9O1xuXG5cdC8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0ZXIgdGFncyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cdCR0YWdzKHtcblx0XHRcImlmXCI6IHtcblx0XHRcdHJlbmRlcjogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uY2UgZm9yIHt7aWZ9fSBhbmQgb25jZSBmb3IgZWFjaCB7e2Vsc2V9fS5cblx0XHRcdFx0Ly8gV2Ugd2lsbCB1c2UgdGhlIHRhZy5yZW5kZXJpbmcgb2JqZWN0IGZvciBjYXJyeWluZyByZW5kZXJpbmcgc3RhdGUgYWNyb3NzIHRoZSBjYWxscy5cblx0XHRcdFx0Ly8gSWYgbm90IGRvbmUgKGEgcHJldmlvdXMgYmxvY2sgaGFzIG5vdCBiZWVuIHJlbmRlcmVkKSwgbG9vayBhdCBleHByZXNzaW9uIGZvciB0aGlzIGJsb2NrIGFuZCByZW5kZXIgdGhlIGJsb2NrIGlmIGV4cHJlc3Npb24gaXMgdHJ1dGh5XG5cdFx0XHRcdC8vIE90aGVyd2lzZSByZXR1cm4gXCJcIlxuXHRcdFx0XHR2YXIgc2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0dGFnQ3R4ID0gc2VsZi50YWdDdHgsXG5cdFx0XHRcdFx0cmV0ID0gKHNlbGYucmVuZGVyaW5nLmRvbmUgfHwgIXZhbCAmJiAoYXJndW1lbnRzLmxlbmd0aCB8fCAhdGFnQ3R4LmluZGV4KSlcblx0XHRcdFx0XHRcdD8gXCJcIlxuXHRcdFx0XHRcdFx0OiAoc2VsZi5yZW5kZXJpbmcuZG9uZSA9IHRydWUsIHNlbGYuc2VsZWN0ZWQgPSB0YWdDdHguaW5kZXgsXG5cdFx0XHRcdFx0XHRcdC8vIFRlc3QgaXMgc2F0aXNmaWVkLCBzbyByZW5kZXIgY29udGVudCBvbiBjdXJyZW50IGNvbnRleHQuIFdlIGNhbGwgdGFnQ3R4LnJlbmRlcigpIHJhdGhlciB0aGFuIHJldHVybiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdFx0Ly8gKHdoaWNoIHdvdWxkIGFsc28gcmVuZGVyIHRoZSB0bXBsL2NvbnRlbnQgb24gdGhlIGN1cnJlbnQgY29udGV4dCBidXQgd291bGQgaXRlcmF0ZSBpZiBpdCBpcyBhbiBhcnJheSlcblx0XHRcdFx0XHRcdFx0dGFnQ3R4LnJlbmRlcih0YWdDdHgudmlldywgdHJ1ZSkpOyAvLyBubyBhcmcsIHNvIHJlbmRlcnMgYWdhaW5zdCBwYXJlbnRWaWV3LmRhdGFcblx0XHRcdFx0cmV0dXJuIHJldDtcblx0XHRcdH0sXG5cdFx0XHRmbG93OiB0cnVlXG5cdFx0fSxcblx0XHRcImZvclwiOiB7XG5cdFx0XHRyZW5kZXI6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0XHQvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBvbmNlIGZvciB7e2Zvcn19IGFuZCBvbmNlIGZvciBlYWNoIHt7ZWxzZX19LlxuXHRcdFx0XHQvLyBXZSB3aWxsIHVzZSB0aGUgdGFnLnJlbmRlcmluZyBvYmplY3QgZm9yIGNhcnJ5aW5nIHJlbmRlcmluZyBzdGF0ZSBhY3Jvc3MgdGhlIGNhbGxzLlxuXHRcdFx0XHR2YXIgZmluYWxFbHNlID0gIWFyZ3VtZW50cy5sZW5ndGgsXG5cdFx0XHRcdFx0dmFsdWUsXG5cdFx0XHRcdFx0c2VsZiA9IHRoaXMsXG5cdFx0XHRcdFx0dGFnQ3R4ID0gc2VsZi50YWdDdHgsXG5cdFx0XHRcdFx0cmVzdWx0ID0gXCJcIixcblx0XHRcdFx0XHRkb25lID0gMDtcblxuXHRcdFx0XHRpZiAoIXNlbGYucmVuZGVyaW5nLmRvbmUpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGZpbmFsRWxzZSA/IHRhZ0N0eC52aWV3LmRhdGEgOiB2YWw7IC8vIEZvciB0aGUgZmluYWwgZWxzZSwgZGVmYXVsdHMgdG8gY3VycmVudCBkYXRhIHdpdGhvdXQgaXRlcmF0aW9uLlxuXHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgKz0gdGFnQ3R4LnJlbmRlcih2YWx1ZSwgZmluYWxFbHNlKTsgLy8gSXRlcmF0ZXMgZXhjZXB0IG9uIGZpbmFsIGVsc2UsIGlmIGRhdGEgaXMgYW4gYXJyYXkuIChVc2Uge3tpbmNsdWRlfX0gdG8gY29tcG9zZSB0ZW1wbGF0ZXMgd2l0aG91dCBhcnJheSBpdGVyYXRpb24pXG5cdFx0XHRcdFx0XHRkb25lICs9ICRpc0FycmF5KHZhbHVlKSA/IHZhbHVlLmxlbmd0aCA6IDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzZWxmLnJlbmRlcmluZy5kb25lID0gZG9uZSkge1xuXHRcdFx0XHRcdFx0c2VsZi5zZWxlY3RlZCA9IHRhZ0N0eC5pbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gSWYgbm90aGluZyB3YXMgcmVuZGVyZWQgd2Ugd2lsbCBsb29rIGF0IHRoZSBuZXh0IHt7ZWxzZX19LiBPdGhlcndpc2UsIHdlIGFyZSBkb25lLlxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0cHJvcHM6IHtcblx0XHRcdGJhc2VUYWc6IFwiZm9yXCIsXG5cdFx0XHRkYXRhTWFwOiBkYXRhTWFwKGdldFRhcmdldFByb3BzKSxcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdGluY2x1ZGU6IHtcblx0XHRcdGZsb3c6IHRydWVcblx0XHR9LFxuXHRcdFwiKlwiOiB7XG5cdFx0XHQvLyB7eyogY29kZS4uLiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0XCI6KlwiOiB7XG5cdFx0XHQvLyB7ezoqIHJldHVybmVkRXhwcmVzc2lvbiB9fSAtIElnbm9yZWQgaWYgdGVtcGxhdGUuYWxsb3dDb2RlIGFuZCAkLnZpZXdzLnNldHRpbmdzLmFsbG93Q29kZSBhcmUgZmFsc2UuIE90aGVyd2lzZSBpbmNsdWRlIGNvZGUgaW4gY29tcGlsZWQgdGVtcGxhdGVcblx0XHRcdHJlbmRlcjogcmV0VmFsLFxuXHRcdFx0ZmxvdzogdHJ1ZVxuXHRcdH0sXG5cdFx0ZGJnOiAkaGVscGVycy5kYmcgPSAkY29udmVydGVycy5kYmcgPSBkYmdCcmVhayAvLyBSZWdpc3RlciB7e2RiZy99fSwge3tkYmc6Li4ufX0gYW5kIH5kYmcoKSB0byB0aHJvdyBhbmQgY2F0Y2gsIGFzIGJyZWFrcG9pbnRzIGZvciBkZWJ1Z2dpbmcuXG5cdH0pO1xuXG5cdCRjb252ZXJ0ZXJzKHtcblx0XHRodG1sOiBodG1sRW5jb2RlLFxuXHRcdGF0dHI6IGh0bWxFbmNvZGUsIC8vIEluY2x1ZGVzID4gZW5jb2Rpbmcgc2luY2UgckNvbnZlcnRNYXJrZXJzIGluIEpzVmlld3MgZG9lcyBub3Qgc2tpcCA+IGNoYXJhY3RlcnMgaW4gYXR0cmlidXRlIHN0cmluZ3Ncblx0XHR1cmw6IGZ1bmN0aW9uKHRleHQpIHtcblx0XHRcdC8vIFVSTCBlbmNvZGluZyBoZWxwZXIuXG5cdFx0XHRyZXR1cm4gdGV4dCAhPSB1bmRlZmluZWQgPyBlbmNvZGVVUkkoXCJcIiArIHRleHQpIDogdGV4dCA9PT0gbnVsbCA/IHRleHQgOiBcIlwiOyAvLyBudWxsIHJldHVybnMgbnVsbCwgZS5nLiB0byByZW1vdmUgYXR0cmlidXRlLiB1bmRlZmluZWQgcmV0dXJucyBcIlwiXG5cdFx0fVxuXHR9KTtcbn1cbi8vPT09PT09PT09PT09PT09PT09PT09PT09PT0gRGVmaW5lIGRlZmF1bHQgZGVsaW1pdGVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxuJHN1YlNldHRpbmdzID0gJHN1Yi5zZXR0aW5ncztcbiRpc0FycmF5ID0gKCR8fGpzcikuaXNBcnJheTtcbiR2aWV3c1NldHRpbmdzLmRlbGltaXRlcnMoXCJ7e1wiLCBcIn19XCIsIFwiXlwiKTtcblxuaWYgKGpzclRvSnEpIHsgLy8gTW92aW5nIGZyb20ganNyZW5kZXIgbmFtZXNwYWNlIHRvIGpRdWVyeSBuYW1lcGFjZSAtIGNvcHkgb3ZlciB0aGUgc3RvcmVkIGl0ZW1zICh0ZW1wbGF0ZXMsIGNvbnZlcnRlcnMsIGhlbHBlcnMuLi4pXG5cdGpzci52aWV3cy5zdWIuX2pxKCQpO1xufVxucmV0dXJuICQgfHwganNyO1xufSwgd2luZG93KSk7XG4iLCIvKmdsb2JhbCBRVW5pdCwgdGVzdCwgZXF1YWwsIG9rKi9cbihmdW5jdGlvbih1bmRlZmluZWQpIHtcblwidXNlIHN0cmljdFwiO1xuXG5icm93c2VyaWZ5LmRvbmUub25lID0gdHJ1ZTtcblxuUVVuaXQubW9kdWxlKFwiQnJvd3NlcmlmeSAtIGNsaWVudCBjb2RlXCIpO1xuXG52YXIgaXNJRTggPSB3aW5kb3cuYXR0YWNoRXZlbnQgJiYgIXdpbmRvdy5hZGRFdmVudExpc3RlbmVyO1xuXG5pZiAoIWlzSUU4KSB7XG5cbnRlc3QoXCJObyBqUXVlcnkgZ2xvYmFsOiByZXF1aXJlKCdqc3JlbmRlcicpKClcIiwgZnVuY3Rpb24oKSB7XG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gSGlkZSBRVW5pdCBnbG9iYWwgalF1ZXJ5IGFuZCBhbnkgcHJldmlvdXMgZ2xvYmFsIGpzcmVuZGVyLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdHZhciBqUXVlcnkgPSBnbG9iYWwualF1ZXJ5LCBqc3IgPSBnbG9iYWwuanNyZW5kZXI7XG5cdGdsb2JhbC5qUXVlcnkgPSBnbG9iYWwuanNyZW5kZXIgPSB1bmRlZmluZWQ7XG5cblx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBBcnJhbmdlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblx0dmFyIGRhdGEgPSB7bmFtZTogXCJKb1wifTtcblxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiBBY3QgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHR2YXIganNyZW5kZXIgPSByZXF1aXJlKCcuLi8uLi8nKSgpOyAvLyBOb3QgcGFzc2luZyBpbiBqUXVlcnksIHNvIHJldHVybnMgdGhlIGpzcmVuZGVyIG5hbWVzcGFjZVxuXG5cdC8vIFVzZSByZXF1aXJlIHRvIGdldCBzZXJ2ZXIgdGVtcGxhdGUsIHRoYW5rcyB0byBCcm93c2VyaWZ5IGJ1bmRsZSB0aGF0IHVzZWQganNyZW5kZXIvdG1wbGlmeSB0cmFuc2Zvcm1cblx0dmFyIHRtcGwgPSByZXF1aXJlKCcuLi90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sJykoanNyZW5kZXIpOyAvLyBQcm92aWRlIGpzcmVuZGVyXG5cblx0dmFyIHJlc3VsdCA9IHRtcGwoZGF0YSk7XG5cblx0cmVzdWx0ICs9IFwiIFwiICsgKGpzcmVuZGVyICE9PSBqUXVlcnkpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gQXNzZXJ0IC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxuXHRlcXVhbChyZXN1bHQsIFwiTmFtZTogSm8gKG5hbWUtdGVtcGxhdGUuaHRtbCkgdHJ1ZVwiLCBcInJlc3VsdDogTm8galF1ZXJ5IGdsb2JhbDogcmVxdWlyZSgnanNyZW5kZXInKSgpXCIpO1xuXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4gUmVzZXQgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXG5cdGdsb2JhbC5qUXVlcnkgPSBqUXVlcnk7IC8vIFJlcGxhY2UgUVVuaXQgZ2xvYmFsIGpRdWVyeVxuXHRnbG9iYWwuanNyZW5kZXIgPSBqc3I7IC8vIFJlcGxhY2UgYW55IHByZXZpb3VzIGdsb2JhbCBqc3JlbmRlclxufSk7XG59XG59KSgpO1xuIiwidmFyIHRtcGxSZWZzID0gW10sXG4gIG1rdXAgPSAnTmFtZToge3s6bmFtZX19IChuYW1lLXRlbXBsYXRlLmh0bWwpJyxcbiAgJCA9IGdsb2JhbC5qc3JlbmRlciB8fCBnbG9iYWwualF1ZXJ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9ICQgPyAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sXCIsIG1rdXApIDpcbiAgZnVuY3Rpb24oJCkge1xuICAgIGlmICghJCB8fCAhJC52aWV3cykge3Rocm93IFwiUmVxdWlyZXMganNyZW5kZXIvalF1ZXJ5XCI7fVxuICAgIHdoaWxlICh0bXBsUmVmcy5sZW5ndGgpIHtcbiAgICAgIHRtcGxSZWZzLnBvcCgpKCQpOyAvLyBjb21waWxlIG5lc3RlZCB0ZW1wbGF0ZVxuICAgIH1cblxuICAgIHJldHVybiAkLnRlbXBsYXRlcyhcIi4vdGVzdC90ZW1wbGF0ZXMvbmFtZS10ZW1wbGF0ZS5odG1sXCIsIG1rdXApXG4gIH07Il19
