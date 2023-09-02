// @ts-check

'use strict';

const {
	isGlobSpecifier,
	getAbsoluteGlobPattern,
	createGlobfileManager
} = require('./utils/virtual-file.js');

module.exports = {
	createGlobfileManager,
	isGlobSpecifier,
	getAbsoluteGlobPattern
};
