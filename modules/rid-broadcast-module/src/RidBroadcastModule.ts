import { NativeModule, requireNativeModule } from 'expo';
import { RidBroadcastData } from './RidBroadcastModule.types';
declare class RidBroadcastModule extends NativeModule {
  startBroadcast(data: RidBroadcastData): Promise<boolean>;
    stopBroadcast(): Promise<boolean>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<RidBroadcastModule>('RidBroadcastModule');