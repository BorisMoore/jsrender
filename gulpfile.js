var gulp = require('gulp'),
	browserify = require('browserify'),
	fs = require('fs');

//================================= BUNDLE - Run Browserify - create client bundles for test cases =================================//
// See https://github.com/gulpjs/gulp/blob/master/docs/recipes/browserify-with-globs.md

// Task to create Browserify client-side bundle scripts for Browserify test cases.
gulp.task('bundle', function() {
	var tmplify = require('./tmplify');
	var gs = require('glob-stream');

	return gs.create('./test/browserify/*-unit-tests.js')
		.on('data', function(file) {
			// file has path, base, and cwd attrs
			var fileName = file.path.slice(file.base.length, -14);
			browserify(file.path, {debug:true})
				.transform(tmplify)
				.bundle()
				.pipe(fs.createWriteStream('./test/browserify/bundles/' + fileName + "-bundle.js"))
				.on('error', function(err) {
					// Make sure failed tests cause gulp to exit non-zero 
					throw err;
				});
		});
});
