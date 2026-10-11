// ENV-053 — version of the running build, shown by the health check and the diagnostics.
export const APP_VERSION = process.env.npm_package_version ?? '0.4.0';
