import type { CodegenConfig } from '@graphql-codegen/cli';
import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';

const config: CodegenConfig = {
  schema: 'src/schema/**/schema.graphql',
  generates: {
    'src/schema': defineConfig({
      // NodeNext ESM requires explicit .js extensions in relative imports.
      importExtension: '.js',
      // Custom scalars are implemented by hand; no graphql-scalars dependency.
      scalarsModule: false,
      typesPluginsConfig: {
        useTypeImports: true,
        // Third resolver argument; the path is relative to src/schema/types.generated.ts.
        contextType: '../context.js#GraphQLContext',
        // 'UAH' | 'EUR' string unions instead of TS enums, so Tracker JSON fits without casts.
        enumsAsTypes: true,
      },
    }),
  },
};

export default config;
