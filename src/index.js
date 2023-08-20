// @ts-check

'use strict';

const {
	getGlobfileContents,
	getGlobfilePath,
	isGlobSpecifier,
	getAbsoluteGlobPattern,
	getGlobfileType,
	getGlobfileMatchedFiles
} = require('./utils/virtual-file.js');

module.exports = {
	getGlobfileType,
	getGlobfileMatchedFiles,
	getGlobfileContents,
	getGlobfilePath,
	isGlobSpecifier,
	getAbsoluteGlobPattern
};
