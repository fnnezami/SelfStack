
import { register } from 'tsconfig-paths';
import { compilerOptions } from './tsconfig.json';
import path from 'path';

// Register paths for @/ alias
const baseUrl = path.resolve(compilerOptions.baseUrl || '.');
register({
    baseUrl,
    paths: compilerOptions.paths
});

process.env.IS_SERVERLESS = "true";

async function run() {
    console.log("Verifying Serverless constraints...");

    try {
        // 1. Install Route
        const { POST: installPost } = require("./app/api/admin/modules/install/route.ts");
        const res1 = await installPost(new Request("http://localhost", { method: "POST" }));
        console.log(`[Install] Status: ${res1.status} (Expected: 403)`);
        if (res1.status !== 403) throw new Error("Install route did not block!");

        // 2. Code Save Route
        const { POST: codeSavePost } = require("./app/api/admin/code/save/route.ts");
        const res2 = await codeSavePost(new Request("http://localhost", { method: "POST" }));
        console.log(`[CodeSave] Status: ${res2.status} (Expected: 403)`);
        if (res2.status !== 403) throw new Error("Code Save route did not block!");

        // 3. Theme Overrides Route
        const { POST: themePost } = require("./app/admin/api/theme/overrides/route.ts");
        const res3 = await themePost(new Request("http://localhost", { method: "POST" }));
        console.log(`[Theme] Status: ${res3.status} (Expected: 403)`);
        if (res3.status !== 403) throw new Error("Theme route did not block!");

        console.log("SUCCESS: All routes blocked correctly.");
    } catch (err) {
        console.error("FAILED:", err);
        process.exit(1);
    }
}

run();
