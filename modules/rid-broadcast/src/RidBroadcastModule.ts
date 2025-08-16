import { /* NativeModule, */ requireNativeModule } from 'expo';

/* import { RIDBroadcastModuleEvents } from './RIDBroadcast.types';

declare class RIDBroadcastModule extends NativeModule<RIDBroadcastModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<RIDBroadcastModule>('RIDBroadcast'); */

export default requireNativeModule('RIDBroadcast');