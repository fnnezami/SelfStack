module.exports = {
    apps: [
        {
            name: "website",
            script: "./node_modules/next/dist/bin/next",
            args: "start",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
