import { /* NativeModule, */ requireNativeModule } from 'expo';

/* import { RidBroadcastModuleEvents } from './RidBroadcast.types';

declare class RidBroadcastModule extends NativeModule<RidBroadcastModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<RidBroadcastModule>('RidBroadcast'); */

export default requireNativeModule('RidBroadcast');