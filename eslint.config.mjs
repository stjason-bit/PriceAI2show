import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '.next/**',
      '.source/**',
      'node_modules/**',
      'src/config/db/migrations/**',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  {
    rules: {
      '@next/next/no-assign-module-variable': 'off',
      'react/display-name': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
];

export default config;
