/**
 * This file provides TypeScript definitions for the RidBroadcastModule native module.
 * It ensures type safety when calling the native functions from your JavaScript/TypeScript code.
 */

/**
 * Defines the structure of the data object that must be passed
 * to the `startBroadcast` method. It includes all the necessary
 * information for all the different RID payload frames.
 */
export type RidBroadcastData = {
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