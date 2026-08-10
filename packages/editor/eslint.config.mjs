import tseslint from "typescript-eslint";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

const config = [
    { ignores: ["dist/**", "node_modules/**"] },
    ...tseslint.configs.recommended,
    { languageOptions: { parserOptions: { tsconfigRootDir } } }
];

export default config;
