// @ts-check

'use strict';

const path = require('pathe');
const { globSync } = require('glob');

/**
	@param {{ globfileModuleSpecifier: string, importerFilepath: string }} args
	@return {string}
*/
exports.getAbsoluteGlobPattern = function ({
	globfileModuleSpecifier,
	importerFilepath
}) {
	if (globfileModuleSpecifier.startsWith('glob:')) {
		return path.resolve(
			path.dirname(importerFilepath),
			globfileModuleSpecifier.replace('glob:', '')
		);
	} else {
		return path.resolve(
			path.dirname(importerFilepath),
			globfileModuleSpecifier.replace('glob[files]:', '')
		);
	}
};

/**
	@param {string} specifier
*/
exports.isGlobSpecifier = function (specifier) {
	return /^glob(?:\[[^\]]+])?:/.test(specifier);
};

exports.createGlobfileManager = function ({ monorepoDirpath }) {
	/**
		@param {{ globfileModuleSpecifier: string, importerFilepath: string }} args
		@return {string}
	*/
	function getGlobfilePath({ globfileModuleSpecifier, importerFilepath }) {
		if (globfileModuleSpecifier.startsWith('glob:')) {
			return path.resolve(
				path.dirname(importerFilepath),
				globfileModuleSpecifier.replace('glob:', '').replaceAll('!', '%21'),
				'__virtual__:matches.ts'
			);
		} else if (globfileModuleSpecifier.startsWith('glob[files]:')) {
			return path.resolve(
				path.dirname(importerFilepath),
				globfileModuleSpecifier
					.replace('glob[files]:', '')
					.replaceAll('!', '%21'),
				'__virtual__:files.ts'
			);
		} else if (globfileModuleSpecifier.startsWith('glob[filepaths]:')) {
			return path.resolve(
				path.dirname(importerFilepath),
				globfileModuleSpecifier
					.replace('glob[filepaths]:', '')
					.replaceAll('!', '%21'),
				'__virtual__:filepaths.ts'
			);
		} else {
			return path.join(path.dirname(importerFilepath), globfileModuleSpecifier);
		}
	}

	/**
		@param {object} args
		@param {string} args.globfilePath
	*/
	function getGlobfileType({ globfilePath }) {
		return /** @type {'matches' | 'files' | 'filepaths'} */ (
			path
				.basename(globfilePath)
				.replace('__virtual__:', '')
				.replace(/\.[^.]+$/, '')
		);
	}

	/**
		@param {object} args
		@param {string} args.globfilePath
		@returns {Array<{ absoluteFilepath: string, relativeFilepath: string }>}
	*/
	function getGlobfileMatchedFiles({ globfilePath }) {
		const globPattern = path.dirname(globfilePath).replaceAll('%21', '!');

		// To support glob-based imports from TypeScript, we create a virtual file containing the imports
		const absoluteMatchedFilePaths = globSync(globPattern, {
			absolute: true
		});
		const matchedFiles = absoluteMatchedFilePaths.map(
			(absoluteMatchedFilePath) => {
				let relativeFilepath = path.relative(
					path.dirname(path.dirname(globfilePath)),
					absoluteMatchedFilePath
				);

				if (!relativeFilepath.startsWith('.')) {
					relativeFilepath = `./${relativeFilepath}`;
				}

				return {
					absoluteFilepath: absoluteMatchedFilePath,
					relativeFilepath
				};
			}
		);

		return matchedFiles;
	}

	/**
		@param {object} args
		@param {string} args.globfilePath
		@param {'module' | 'commonjs'} [args.moduleType]
		@param {'relative' | 'absolute'} [args.filepathType]
		@returns {string}
	*/
	function getGlobfileContents({
		globfilePath,
		moduleType = 'module',
		filepathType
	}) {
		const globfileType = getGlobfileType({ globfilePath });
		const matchedFiles = getGlobfileMatchedFiles({ globfilePath });

		/** @type {string[]} */
		const virtualFileContentLines = [];

		switch (globfileType) {
			case 'matches': {
				if (moduleType === 'module') {
					virtualFileContentLines.push(
						...matchedFiles.map(
							(matchedFile) =>
								`export * from ${JSON.stringify(
									filepathType === 'relative'
										? matchedFile.relativeFilepath
										: matchedFile.absoluteFilepath
								)};`
						)
					);
				} else {
					virtualFileContentLines.push(
						'module.exports = {',
						...matchedFiles.map(
							(matchedFile) =>
								`...require(${JSON.stringify(
									filepathType === 'relative'
										? matchedFile.relativeFilepath
										: matchedFile.absoluteFilepath
								)}),`
						),
						'};'
					);
				}

				break;
			}

			case 'files': {
				/** @param {string} filepath */
				const pathToIdentifier = (filepath) =>
					`__${filepath.replaceAll(/[^\w$]/g, '_')}`;

				for (const matchedFile of matchedFiles) {
					const relativeFilePath = path.relative(
						monorepoDirpath,
						matchedFile.absoluteFilepath
					);
					const identifier = pathToIdentifier(relativeFilePath);
					if (moduleType === 'module') {
						virtualFileContentLines.push(
							`import * as ${identifier} from ${JSON.stringify(
								filepathType === 'relative'
									? matchedFile.relativeFilepath
									: matchedFile.absoluteFilepath
							)};`
						);
					} else {
						virtualFileContentLines.push(
							`const ${identifier} = require(${JSON.stringify(
								filepathType === 'relative'
									? matchedFile.relativeFilepath
									: matchedFile.absoluteFilepath
							)});`
						);
					}
				}

				if (moduleType === 'module') {
					virtualFileContentLines.push('export default {');
				} else {
					virtualFileContentLines.push('module.exports = {');
				}

				for (const matchedFile of matchedFiles) {
					const relativeFilePath = path.relative(
						monorepoDirpath,
						matchedFile.absoluteFilepath
					);
					const identifier = pathToIdentifier(relativeFilePath);
					virtualFileContentLines.push(
						`${JSON.stringify(relativeFilePath)}: ${identifier},`
					);
				}

				virtualFileContentLines.push('}');
				break;
			}

			case 'filepaths': {
				if (moduleType === 'module') {
					virtualFileContentLines.push('export default {');
				} else {
					virtualFileContentLines.push('module.exports = {');
				}

				for (const matchedFile of matchedFiles) {
					const relativeFilePath = path.relative(
						monorepoDirpath,
						matchedFile.absoluteFilepath
					);
					virtualFileContentLines.push(
						`${JSON.stringify(relativeFilePath)}: true,`
					);
				}

				virtualFileContentLines.push('}');
				break;
			}

			default: {
				throw new Error(`Unknown virtual file type: ${globfileType}`);
			}
		}

		return virtualFileContentLines.join('\n');
	}

	return {
		getGlobfilePath,
		getGlobfileType,
		getGlobfileMatchedFiles,
		getGlobfileContents
	};
};
