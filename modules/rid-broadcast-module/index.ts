// Reexport the native module. On web, it will be resolved to RidBroadcastModule.web.ts
// and on native platforms to RidBroadcastModule.ts
import RidBroadcastModule from "./src/RidBroadcastModule";
import * as RidBroadcastTypes from "./src/RidBroadcastModule.types";

/**
//    * Starts the periodic broadcast, automatically cycling through RID frames.
//    * @param data An object containing all required drone data.
//    * @returns A promise that resolves with `true` if the broadcast starts successfully.
//    */
export function startBroadcast(
  data: RidBroadcastTypes.RidBroadcastData,
): Promise<boolean> {
  return RidBroadcastModule.startBroadcast(data);
}

/**
//    * Stops the broadcast.
//    * @returns A promise that resolves with `true` if the broadcast stops successfully.
//    */
export function stopBroadcast(): Promise<boolean> {
  return RidBroadcastModule.stopBroadcast();
}