// RidBroadcast.m

#import <React/RCTBridgeModule.h>

// This macro exposes your Swift class 'RidBroadcast' to React Native.
// The name "RidBroadcast" is how you will access it in JavaScript.
RCT_EXTERN_MODULE(RidBroadcast, NSObject)

// This macro exposes the 'startBroadcast' method from your Swift class.
RCT_EXTERN_METHOD(startBroadcast:(NSDictionary *)data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// This macro exposes the 'stopBroadcast' method.
RCT_EXTERN_METHOD(stopBroadcast:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)