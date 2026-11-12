const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');
const escape = (p) => p.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Библиотека подключена через `file:..` и читается из исходников.
 * Корневой node_modules библиотеки блокируем, чтобы React / RN / Reanimated
 * всегда брались из example — иначе будет две копии и всё упадёт.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [libraryRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    blockList: [new RegExp(`^${escape(path.join(libraryRoot, 'node_modules'))}\\/.*$`)],
    unstable_enableSymlinks: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
