
const { spawn } = require('child_process');
const http = require('http');

const PORT = 3001;

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({});
        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            resolve(res.statusCode);
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("Starting Next.js server with IS_SERVERLESS=true...");

    // Use 'npm run dev' but override port
    const server = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '-p', PORT], {
        env: { ...process.env, IS_SERVERLESS: 'true', PORT: String(PORT) },
        stdio: 'inherit',
        cwd: process.cwd()
    });

    server.on('error', (err) => {
        console.error("Failed to start server:", err);
        process.exit(1);
    });

    // Wait for server to be ready
    console.log("Waiting for server to start...");
    await sleep(10000);

    try {
        console.log("Probing endpoints...");

        // 1. Install
        const status1 = await makeRequest('/api/admin/modules/install');
        console.log(`/api/admin/modules/install -> ${status1} (Expected: 403)`);
        if (status1 !== 403) throw new Error("Install route did not block!");

        // 2. Code Save
        const status2 = await makeRequest('/api/admin/code/save');
        console.log(`/api/admin/code/save -> ${status2} (Expected: 403)`);
        if (status2 !== 403) throw new Error("Code Save route did not block!");

        // 3. Theme
        const status3 = await makeRequest('/app/admin/api/theme/overrides');
        // Wait, the path might be /admin/api/theme/overrides depending on app router file structure?
        // app/admin/api/theme/overrides/route.ts -> /admin/api/theme/overrides ? 
        // Yes, app router maps folders to URL paths directly unless grouping involved.
        // The file is app/admin/api/theme/overrides/route.ts so URL is /admin/api/theme/overrides.

        const status3_real = await makeRequest('/admin/api/theme/overrides');
        console.log(`/admin/api/theme/overrides -> ${status3_real} (Expected: 403)`);
        if (status3_real !== 403) throw new Error("Theme route did not block!");

        console.log("SUCCESS: All checks passed.");
    } catch (err) {
        console.error("VERIFICATION FAILED:", err);
        process.exit(1);
    } finally {
        console.log("Stopping server...");
        server.kill();
        // Force kill if needed
        process.exit(0);
    }
}

run();
