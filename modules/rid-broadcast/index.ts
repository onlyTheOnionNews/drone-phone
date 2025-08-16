// Reexport the native module. On web, it will be resolved to RIDBroadcastModule.web.ts
// and on native platforms to RIDBroadcastModule.ts
export * from './src/RIDBroadcast.types';
export { default } from './src/RIDBroadcastModule';
export { default as RIDBroadcastView } from './src/RIDBroadcastView';

