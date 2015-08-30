/*! JsRender tmplify submodule v1.0.0-rc.65 (Beta - Release Candidate): http://jsviews.com/#jsrender */
/*! Browserify transform for JsRender templates */
/*
 * Copyright 2015, Boris Moore
 * Released under the MIT License.

----- Usage -----

- Options:
  --extensions or -e:
  White-space separated list of extensions for jsrender templates
  Default value: "html jsrender jsr"

- Command line:

  browserify -t jsrender/tmplify ./source.js > ./bundle.js

  browserify -t [jsrender/tmplify --extensions 'htm jsrender'] ./source.js > ./bundle.js

  browserify -t [jsrender/tmplify -e 'htm jsrender'] ./source.js > ./bundle.js

- package.json:

  "browserify": {
    "transform": [
      [
        "jsrender/tmplify", {
          "extensions": "htm jsrender"
        }
      ]
    ]
  }

- API:

  browserify('./source.js')
    .transform(require('jsrender/tmplify'), {extensions: 'htm jsrender'})
    .bundle()
    .pipe(fs.createWriteStream('./bundle.js'))
    .on('error', function(err) {
      console.log(err);
    });

*/

(function() {
"use strict";
var jsrender = require('../'),
	path = require('path'),
	pathSep = path.sep,
	through = require('through2'),
	rootDirNameLen = path.resolve("./").length + 1;

function isTemplate(fileExt, extensions) {
	extensions = typeof extensions === "string"
		? extensions
		: "html jsrender jsr"; // Default extensions
	return new RegExp("\\s" + fileExt + "\\s").test(" " + extensions + " ");
}

module.exports = function(file, options) {
	var nodeFileDirName = path.dirname(file);

	if (!isTemplate(path.extname(file).slice(1), options && (options.extensions || options.e))) {
		return through();
	}

	return through(function(buf, enc, next) {
		var createTmplCode, ref, pathFromFileDir,
			markup = buf.toString().replace(/^\uFEFF/, ''), // Remove BOM if necessary
			tmpl = jsrender.templates(markup),
			bundledFile = '',
			templateName = './' + file.slice(rootDirNameLen).split(pathSep).join('/');

		for (ref in tmpl.refs) {
			// Recursively bundle any nested template references, e.g. {{include tmpl="./some/template.html/}}"
			pathFromFileDir = './' + path.relative(nodeFileDirName, ref).split(pathSep).join('/');
			bundledFile += 'require("' + pathFromFileDir + '");\n';
		}

		createTmplCode = '$.templates("' + templateName + '", mkup)';
		bundledFile +=
			"var mkup = '" + markup.replace(/['"\\]/g, "\\$&").replace(/[ \t]*(\r\n|\n|\r)/g, '\\n') + "',\n" // Normalize newlines, and escape quotes and \ character
			+ '  $ = global.jsrender || global.jQuery;\n\n'
			+ 'module.exports = $ ? ' + createTmplCode
			+ ' :\n  function($) {\n'
			+ '    if (!$ || !$.views) {throw "Requires jsrender/jQuery";}\n'
			+ '    return ' + createTmplCode
			+ '\n  };';
		this.push(bundledFile);
		next();
	});
};
}());
