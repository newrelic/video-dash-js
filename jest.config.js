module.exports = {
  testEnvironment: "node",
  moduleFileExtensions: ["js", "jsx"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!@shotgunjed)/"],
  testMatch: ["**/__tests__/**/*.js?(x)", "**/?(*.)+(spec|test).js?(x)"],

  // Use video-core mock for testing
  moduleNameMapper: {
    "^@newrelic/video-core$": "<rootDir>/src/__mocks__/@newrelic-video-core.mock.js"
  }
};
