module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
      // Désactive le check TS2564 (propriété non initialisée dans le constructeur)
      '@typescript-eslint/class-property-no-initialization': 'off',
    // Désactive les erreurs sur le type 'unknown' dans catch et les erreurs de type
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-implicit-any-catch': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
  },
};
