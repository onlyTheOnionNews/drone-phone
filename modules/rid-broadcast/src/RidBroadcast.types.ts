/**
 * This file provides TypeScript definitions for the RIDBroadcast native module.
 * It ensures type safety when calling the native functions from your JavaScript/TypeScript code.
 */

/**
 * Defines the structure of the data object that must be passed
 * to the `startBroadcast` method. It includes all the necessary
 * information for all the different RID payload frames.
 */
export type RIDBroadcastData = {
  // Basic ID
  uasId: string;

  // Location/Vector
  latitude: number;
  longitude: number;
  altitudeGeodetic: number;
  height: number;
  altitudePressure: number;
  direction: number;
  speedHorizontal: number;
  speedVertical: number;
  status: number;

  // Self-ID
  description: string;

  // System
  operatorLocationType: number;
  operatorLatitude: number;
  operatorLongitude: number;
  areaCount: number;
  areaRadius: number;
  areaCeiling: number;
  areaFloor: number;

  // Operator ID
  operatorId: string;

  // Authentication
  privateKey: string; // Base64 encoded PKCS#8 private key
};

/**
 * Defines the interface of the native module, exposing its methods
 * to the React Native bridge.
 */
export interface RIDBroadcastModule {
  /**
   * Starts the periodic broadcast, automatically cycling through RID frames.
   * @param data An object containing all required drone data.
   * @returns A promise that resolves with `true` if the broadcast starts successfully.
   */
  startBroadcast(data: RIDBroadcastData): Promise<boolean>;

  /**
   * Stops the broadcast.
   * @returns A promise that resolves with `true` if the broadcast stops successfully.
   */
  stopBroadcast(): Promise<boolean>;
}
