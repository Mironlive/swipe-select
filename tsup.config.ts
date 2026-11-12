import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  external: ['react', 'react-native', 'react-native-gesture-handler', 'react-native-reanimated'],
  outDir: 'lib',
  format: ['esm', 'cjs'],
  dts: {
    entry: 'src/index.ts',
    tsconfig: './tsconfig.build.json',
  },
  sourcemap: true,
  splitting: false,
  target: 'es2021',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
