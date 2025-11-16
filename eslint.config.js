import globals from 'globals'
import neostandard from 'neostandard'

export default [
  ...neostandard({
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  }),
  {
    files: ['__test__/**/*.js'],
    languageOptions: {
      globals: globals.jest
    }
  }
]
