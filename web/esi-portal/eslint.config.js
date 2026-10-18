// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = (async () => {
  const { default: featureBoundaries } = await import('./eslint/feature-boundaries.mjs');
  return tseslint.config(
    { ignores: ['src/app/core/api/generated/**'] },
    {
      files: ['**/*.ts'],
      extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.stylistic, ...angular.configs.tsRecommended],
      processor: angular.processInlineTemplates,
      plugins: { esi: { rules: { 'feature-boundaries': featureBoundaries } } },
      rules: {
        'esi/feature-boundaries': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
        '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
        '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      },
    },
    {
      files: ['**/*.html'],
      extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    },
  );
})();
