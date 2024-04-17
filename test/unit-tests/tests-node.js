/*global QUnit*/
(function(undefined) {
"use strict";

var jsrender = require('./../../jsrender-node.js');
var tmplify = require('./../../tmplify/index.js');

function upper(val) {
	return val.toUpperCase();
}
function lower(val) {
	return val.toLowerCase();
}
QUnit.module("node");
QUnit.test("jsrender.renderFile / jsrender.__express", function(assert) {
	var html = jsrender.renderFile('./test/templates/name-template.html', {name: "Jo"});
	assert.equal(html, "Name: Jo (name-template.html)", 'jsrender.renderFile("./file.path.html", data) loads and renders template');

	html = jsrender.__express('./test/templates/name-template.html', {name: "Jo"});
	assert.equal(html, "Name: Jo (name-template.html)", 'jsrender.__express("./file.path.html", data) loads and renders template');
});

QUnit.test("jsrender.templates", function(assert) {
	var tmpl = jsrender.templates('./test/templates/name-template.html');
	var html = tmpl({name: "Jo"});
	assert.equal(html, "Name: Jo (name-template.html)", 'jsrender.templates("./file.path.html") compiles template');

	tmpl = jsrender.templates({markup: 'Some {{:~upper("Markup")}} Name: {{:~upper(name)}} {{lower:name}}', helpers: {upper:upper}, converters: {lower:lower}});
	html = tmpl({name: "Jo"});
	assert.equal(html, "Some MARKUP Name: JO jo", 'jsrender.templates({markup: ..., helpers: ..., ...}) compiles template with options');
});

QUnit.test("jsrender.compile", function(assert) {
	var tmpl = jsrender.compile('./test/templates/name-template.html');
	var html = tmpl({name: "Jo"});
	assert.equal(html, "Name: Jo (name-template.html)", 'jsrender.compile("./file.path.html") compiles template');

	tmpl = jsrender.compile('Some {{:~upper("Markup")}} Name: {{:~upper(name)}} {{lower:name}}', {helpers: {upper:upper}, converters: {lower:lower}});
	html = tmpl({name: "Jo"});
	assert.equal(html, "Some MARKUP Name: JO jo", 'jsrender.compile("markup", {helpers: ..., ...}) compiles template with options');
});

QUnit.test("jsrender.tags.clientTemplate", function(assert) {
	jsrender.views.settings.delimiters("<%", "%>");
	var tmpl = jsrender.compile(
		'<script src="//code.jquery.com/jquery-3.6.4.js"></script>\n'
		+ '<script src="//www.jsviews.com/download/jsrender.js"></script>\n'
		+ '<%clientTemplate "./test/templates/outer.html"/%>\n'
		+ '<%clientTemplate "./test/templates/inner.html"/%>\n'
		+ '<script id="clientonly" type="test/x-jsrender">{{include tmpl="./test/templates/outer.html"/}}</script>\n'
		+ '<div id="result"></div>\n'
		+ '<script>var tmpl = $.templates("#clientonly"); $("#result").html(tmpl({name: "Jeff"}));</script>');
	var html = tmpl({name: "Jo"});
	assert.equal(html,
		'<script src="//code.jquery.com/jquery-3.6.4.js"></script>\n'
		+ '<script src="//www.jsviews.com/download/jsrender.js"></script>\n'
		+ '<script id="./test/templates/outer.html" type="text/x-jsrender">Name: {{:name}} (outer.html) {{include tmpl="./test/templates/inner.html"/}}</script>\n'
		+ '<script id="./test/templates/inner.html" type="text/x-jsrender">Name: {{:name}} (inner.html)</script>\n'
		+ '<script id="clientonly" type="test/x-jsrender">{{include tmpl="./test/templates/outer.html"/}}</script>\n'
		+ '<div id="result"></div>\n'
		+ '<script>var tmpl = $.templates("#clientonly"); $("#result").html(tmpl({name: "Jeff"}));</script>',
	'Server-rendered templates using {{clientTemplate "./.../tmpl.html"}}\nand direct rendering using different delimiters on server/client');
});

QUnit.test("jsrender/tmplify .html template", function(assert) {
	const done = assert.async();
	var outputFile = 'test/browserify/bundles/html-jsr-tmpl-bundle.js';
	var fs = require('fs');
	var browserify = require('browserify');
	browserify('test/browserify/html-jsr-tmpl.js')

	.transform(tmplify) // Use default extensions: "html jsr jsrender"
	.bundle()
	.pipe(fs.createWriteStream(outputFile)
		.on('finish', function() {
			assert.ok(fs.readFileSync(outputFile, 'utf8').indexOf("browserify.done.html ") > 0, 'browserify().transform(tmplify)');
			done();
		})
	)
	.on('error', function(err) {
		console.log(err);
	});
});

QUnit.test("jsrender/tmplify options: 'htm jsr'", function(assert) {
	const done = assert.async();
	var outputFile = 'test/browserify/bundles/htm-jsrender-tmpl-bundle.js';
	var fs = require('fs');
	var browserify = require('browserify');
	browserify('test/browserify/htm-jsrender-tmpl.js')
	.transform(tmplify, {extensions: 'htm jsrender'})
	.bundle()
	.pipe(fs.createWriteStream(outputFile))
		.on('finish', function() {
			assert.ok(fs.readFileSync(outputFile, 'utf8').indexOf("browserify.done.htm ") > 0, 'browserify().transform(tmplify, {extensions: "..., ..."})');
			done();
		})
	.on('error', function(err) {
		console.log(err);
	});
});

})();
