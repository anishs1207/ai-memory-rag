import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default [
  // Ignore compiler and build output directories to prevent ESLint from linting bundled files
  {
    ignores: ['dist/**', 'dist-electron/**', 'dist-react/**', 'release/**', 'out/**'],
  },
  // Use recommended configurations
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Define workspace files and rules
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
]

