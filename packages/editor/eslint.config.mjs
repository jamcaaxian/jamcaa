import tseslint from "typescript-eslint";

const config = [{ ignores: ["dist/**", "node_modules/**"] }, ...tseslint.configs.recommended];

export default config;
