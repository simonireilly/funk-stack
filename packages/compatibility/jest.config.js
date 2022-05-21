/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.test.json",
    },
  },
  testEnvironment: "node",
  testPathIgnorePatterns: [".*setup.ts$"],
  testRegex: "^.*.test.ts",
  setupFiles: ["<rootDir>/__tests__/setup.ts"],
};
