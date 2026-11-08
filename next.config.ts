import type {NextConfig} from 'next';
const config:NextConfig={distDir:process.env.ATLAS_BUILD_DIR||'.next'};
export default config;
