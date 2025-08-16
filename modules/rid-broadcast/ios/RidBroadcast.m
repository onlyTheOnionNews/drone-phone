#import <React/RCTBridgeModule.h>

// This macro exposes your Swift class 'RIDBroadcast' to React Native.
// The name "RIDBroadcast" is how you will access it in JavaScript.
RCT_EXTERN_MODULE(RIDBroadcast, NSObject)

// This macro exposes the 'startBroadcasting' method from your Swift class.
RCT_EXTERN_METHOD(startBroadcasting:(NSDictionary *)data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// This macro exposes the 'stopBroadcast' method.
RCT_EXTERN_METHOD(stopBroadcast:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)