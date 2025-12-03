import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/tests/**',
  ],
  rules: {
    'no-console': 0,
    'node/prefer-global/process': 0,
  },
})
