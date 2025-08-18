// Reexport the native module. On web, it will be resolved to RidBroadcastModule.web.ts
// and on native platforms to RidBroadcastModule.ts
export { default } from './src/RidBroadcastModule';
export * from './src/RidBroadcastModule.types';

