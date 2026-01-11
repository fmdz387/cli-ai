/** @type {import('prettier').Config} */
module.exports = {
  // Core formatting
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',

  // Import sorting
  importOrder: [
    // 1. Node.js built-ins
    '^(node:)?[a-z]',
    // 2. External libraries
    '^(react|next)(/.*)?$',
    '^@((reduxjs|ink|react).*)$',
    '^[a-z]',
    // 3. Internal workspace packages
    '^@fmdz387/(.*)$',
    // 4. Internal relative imports
    '^@fmdz387/(.*)$',
    '^@([a-z]+)/(.*)$',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: false,
  importOrderGroupNamespaceSpecifiers: false,
  importOrderCaseInsensitive: true,

  // Plugins
  plugins: [
    require.resolve('@trivago/prettier-plugin-sort-imports'),
  ],

  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
  ],
};
