/*global QUnit, test, equal, ok*/
(function(undefined) {
"use strict";

var data = {name: "Jo"};
//var jsrender = require('jsrender')(); // Not passing in jQuery, so returns the jsrender namespace
var jsrender = require('./../../')();
// Use require to get server template, thanks to Browserify bundle that used jsrender/tmplify transform
var tmpl = require('../templates/name-template.html')(jsrender); // Provide jsrender
var tmpl2 = require('../templates/name-template.jsr')(jsrender); // Provide jsrender

var result = tmpl(data) + tmpl2(data);
alert(result);
})();
