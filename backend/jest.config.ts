import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
    "^.+\\.jsx?$": "ts-jest",
  },
  transformIgnorePatterns: ["node_modules/(?!(bcrypt-ts)/)"],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
};

export default config;
