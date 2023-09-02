// @ts-check

'use strict';

// eslint-disable-next-line unicorn/prefer-node-protocol -- Parcel doesn't support protocol imports
const path = require('pathe');
const { globSync } = require('glob');

/**
	@param {{ globfileModuleSpecifier: string, importerFilePath: string }} args
	@return {string}
*/
exports.getAbsoluteGlobPattern = function ({
	globfileModuleSpecifier,
	importerFilePath
}) {
	if (globfileModuleSpecifier.startsWith('glob:')) {
		return path.resolve(
			path.dirname(importerFilePath),
			globfileModuleSpecifier.replace('glob:', '')
		);
	} else {
		return path.resolve(
			path.dirname(importerFilePath),
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
		@param {{ globfileModuleSpecifier: string, importerFilePath: string }} args
		@return {string}
	*/
	function getGlobfilePath({ globfileModuleSpecifier, importerFilePath }) {
		if (globfileModuleSpecifier.startsWith('glob:')) {
			return path.resolve(
				path.dirname(importerFilePath),
				globfileModuleSpecifier.replace('glob:', '').replaceAll('!', '%21'),
				'__virtual__:matches.ts'
			);
		} else if (globfileModuleSpecifier.startsWith('glob[files]:')) {
			return path.resolve(
				path.dirname(importerFilePath),
				globfileModuleSpecifier
					.replace('glob[files]:', '')
					.replaceAll('!', '%21'),
				'__virtual__:files.ts'
			);
		} else if (globfileModuleSpecifier.startsWith('glob[filepaths]:')) {
			return path.resolve(
				path.dirname(importerFilePath),
				globfileModuleSpecifier
					.replace('glob[filepaths]:', '')
					.replaceAll('!', '%21'),
				'__virtual__:filepaths.ts'
			);
		} else {
			return path.join(path.dirname(importerFilePath), globfileModuleSpecifier);
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
		@returns {Array<{ absoluteFilePath: string, relativeFilePath: string }>}
	*/
	function getGlobfileMatchedFiles({ globfilePath }) {
		const globPattern = path.dirname(globfilePath).replaceAll('%21', '!');

		// To support glob-based imports from TypeScript, we create a virtual file containing the imports
		const absoluteMatchedFilePaths = globSync(globPattern, {
			absolute: true
		});
		const matchedFiles = absoluteMatchedFilePaths.map(
			(absoluteMatchedFilePath) => ({
				absoluteFilePath: absoluteMatchedFilePath,
				relativeFilePath: path.relative(
					path.dirname(globfilePath),
					absoluteMatchedFilePath
				)
			})
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
										? matchedFile.relativeFilePath
										: matchedFile.absoluteFilePath
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
										? matchedFile.relativeFilePath
										: matchedFile.absoluteFilePath
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
						matchedFile.absoluteFilePath
					);
					const identifier = pathToIdentifier(relativeFilePath);
					if (moduleType === 'module') {
						virtualFileContentLines.push(
							`import * as ${identifier} from ${JSON.stringify(
								filepathType === 'relative'
									? matchedFile.relativeFilePath
									: matchedFile.absoluteFilePath
							)};`
						);
					} else {
						virtualFileContentLines.push(
							`const ${identifier} = require(${JSON.stringify(
								filepathType === 'relative'
									? matchedFile.relativeFilePath
									: matchedFile.absoluteFilePath
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
						matchedFile.absoluteFilePath
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
						matchedFile.absoluteFilePath
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
