// RidBroadcastModule.swift

import ExpoModulesCore
import Foundation
import CoreBluetooth
import CryptoKit // Modern cryptography framework for signing

// Define a custom error for when Bluetooth is powered off.
// This makes error handling on the JavaScript side much cleaner.
struct BluetoothUnavailableError: Exception {
  override var reason: String {
    "Bluetooth is not powered on. Please enable it in your device settings."
  }
}

public class RidBroadcastModule: Module, CBPeripheralManagerDelegate {
  
  // Private properties to manage the Bluetooth state.
  private var peripheralManager: CBPeripheralManager?
  private var broadcastTimer: Timer?
  private var allDroneData: [String: Any]?

  // ASTM F3411-22a Service UUID for Remote ID.
  private let ridServiceUUID = CBUUID(string: "0000FFFA-0000-1000-8000-00805F9B34FB")
  
  // The main definition block for the Expo Module.
  // This is where you define the module's name, methods, and lifecycle.
  public func definition() -> ModuleDefinition {
    
    // Sets the name of the module that will be used in JavaScript.
    // e.g., import { RidBroadcastModule } from 'your-module';
    Name("RidBroadcastModule")

    // The OnCreate block is called when the module is first initialized.
    // It's the perfect place to set up the peripheral manager.
    OnCreate {
      let queue = DispatchQueue(label: "com.dronephone.rid.bluetooth")
      peripheralManager = CBPeripheralManager(delegate: self, queue: queue)
    }

    // The OnDestroy block is called when the module is deallocated.
    // It's crucial to clean up resources like timers and stop advertising.
    OnDestroy {
      stopBroadcastInternal()
    }

    /**
     * Starts a periodic broadcast, automatically cycling through different RID frames.
     * @param data A dictionary containing all necessary data for all frame types.
     */
    AsyncFunction("startBroadcast") { (data: [String: Any]) throws {
      guard let manager = peripheralManager, manager.state == .poweredOn else {
        throw BluetoothUnavailableError()
      }

      // Store the data and start the timer on the main thread for reliability.
      self.allDroneData = data
      
      DispatchQueue.main.async {
          self.stopBroadcastInternal() // Ensure any old timer is stopped
          
          // Use a Timer to call updateBroadcastFrame every second.
          self.broadcastTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
              self?.updateBroadcastFrame()
          }
      }
    }}

    /**
     * Stops the Bluetooth LE broadcast and cancels the timer.
     */
    AsyncFunction("stopBroadcast") {
      stopBroadcastInternal()
    }
  }

  // MARK: - Internal Logic

  private func stopBroadcastInternal() {
    DispatchQueue.main.async {
        self.broadcastTimer?.invalidate()
        self.broadcastTimer = nil
    }
    if let manager = peripheralManager, manager.isAdvertising {
      manager.stopAdvertising()
    }
  }

  /// This function is called by the timer to generate and broadcast a new frame.
  private func updateBroadcastFrame() {
    guard let data = allDroneData, let manager = peripheralManager, manager.state == .poweredOn else { return }

    let payload = createRemoteIdPayload(data: data)
    guard !payload.isEmpty else { return }

    let advertisementData: [String: Any] = [
        CBAdvertisementDataServiceUUIDsKey: [ridServiceUUID],
        CBAdvertisementDataServiceDataKey: [ridServiceUUID: payload]
    ]
    
    // To update advertising data, we must restart it.
    if manager.isAdvertising {
      manager.stopAdvertising()
    }
    manager.startAdvertising(advertisementData)
  }
  
  /// Creates a single RID payload frame based on the current time.
  private func createRemoteIdPayload(data: [String: Any]) -> Data {
    // Cycle through frames 0-5 using modulus division on the current time in seconds.
    let frameType = Int(Date().timeIntervalSince1970) % 6
    
    switch frameType {
      case 0: return createBasicIdPayload(data: data)
      case 1: return createLocationPayload(data: data)
      case 2: return createSelfIdPayload(data: data)
      case 3: return createSystemPayload(data: data)
      case 4: return createOperatorIdPayload(data: data)
      case 5: return createAuthenticationPayload(data: data)
      default: return Data()
    }
  }

  // MARK: - Payload Creation Functions

  private func createBasicIdPayload(data: [String: Any]) -> Data {
    guard let uasId = data["uasId"] as? String else { return Data() }
    var payload = Data()
    payload.append(0x00) // Message Type 0x0 (Basic ID), UAS ID Type 0 (Serial)
    
    var uasIdData = uasId.data(using: .ascii) ?? Data()
    pad(&uasIdData, to: 20) // Pad or truncate UAS ID to 20 bytes
    payload.append(uasIdData)

    pad(&payload, to: 25) // Ensure final payload is 25 bytes
    return payload
  }

  private func createLocationPayload(data: [String: Any]) -> Data {
    var payload = Data()
    payload.append(0x10) // Message Type 0x1
    payload.append(UInt8((data["status"] as? Int) ?? 0))
    payload.append(int16: Int16((data["direction"] as? Double ?? 0.0) * 100))
    payload.append(int16: Int16((data["speedHorizontal"] as? Double ?? 0.0) * 100))
    payload.append(int16: Int16((data["speedVertical"] as? Double ?? 0.0) * 100))
    payload.append(int32: Int32((data["latitude"] as? Double ?? 0.0) * 1e7))
    payload.append(int32: Int32((data["longitude"] as? Double ?? 0.0) * 1e7))
    payload.append(int16: Int16((data["altitudePressure"] as? Double ?? 0.0) * 10))
    payload.append(int16: Int16((data["altitudeGeodetic"] as? Double ?? 0.0) * 10))
    payload.append(int16: Int16((data["height"] as? Double ?? 0.0) * 10))
    // The original payload was > 25 bytes. We now pad/truncate to meet the spec.
    pad(&payload, to: 25)
    return payload
  }
    
  private func createSelfIdPayload(data: [String: Any]) -> Data {
    guard let description = data["description"] as? String else { return Data() }
    var payload = Data()
    payload.append(0x20) // Message Type 0x2
    payload.append(0x01) // Description Type: Text
    
    var descriptionData = description.data(using: .ascii) ?? Data()
    pad(&descriptionData, to: 23) // Pad or truncate description to 23 bytes
    payload.append(descriptionData)

    // This should already be 25 bytes, but pad just in case.
    pad(&payload, to: 25)
    return payload
  }

  private func createSystemPayload(data: [String: Any]) -> Data {
    var payload = Data()
    payload.append(0x30) // Message Type 0x3
    payload.append(UInt8((data["operatorLocationType"] as? Int) ?? 0))
    payload.append(int32: Int32((data["operatorLatitude"] as? Double ?? 0.0) * 1e7))
    payload.append(int32: Int32((data["operatorLongitude"] as? Double ?? 0.0) * 1e7))
    payload.append(int16: Int16((data["areaCount"] as? Int) ?? 0))
    payload.append(int32: Int32((data["areaRadius"] as? Int) ?? 0))
    payload.append(int32: Int32((data["areaCeiling"] as? Double ?? 0.0) * 10))
    payload.append(int32: Int32((data["areaFloor"] as? Double ?? 0.0) * 10))
    pad(&payload, to: 25) // Ensure final payload is 25 bytes
    return payload
  }

  private func createOperatorIdPayload(data: [String: Any]) -> Data {
    guard let operatorId = data["operatorId"] as? String else { return Data() }
    var payload = Data()
    payload.append(0x40) // Message Type 0x4
    payload.append(0x00) // Operator ID Type: CAA
    
    var operatorIdData = operatorId.data(using: .ascii) ?? Data()
    pad(&operatorIdData, to: 20) // Pad or truncate operator ID to 20 bytes
    payload.append(operatorIdData)

    pad(&payload, to: 25) // Ensure final payload is 25 bytes
    return payload
  }

  private func createAuthenticationPayload(data: [String: Any]) -> Data {
    guard let privateKeyString = data["privateKey"] as? String,
          let keyData = Data(base64Encoded: privateKeyString),
          let uasId = data["uasId"] as? String else {
      return createPlaceholderAuth()
    }
    
    do {
      // Use CryptoKit to create a private key and sign the data
      let privateKey = try P256.Signing.PrivateKey(derRepresentation: keyData)
      let messageToSign = "\(uasId):\(Int(Date().timeIntervalSince1970))"
      let messageData = messageToSign.data(using: .utf8)!
      let signature = try privateKey.signature(for: messageData)
      
      var payload = Data()
      payload.append(0x50) // Message Type 0x5
      payload.append(0x01) // Auth Type: Signature
      payload.append(signature.rawRepresentation.prefix(16)) // Truncate signature
      pad(&payload, to: 25) // Ensure final payload is 25 bytes
      return payload
    } catch {
      print("[RidBroadcastModule] Error creating auth payload: \(error)")
      return createPlaceholderAuth()
    }
  }

  private func createPlaceholderAuth() -> Data {
    var payload = Data([0x50, 0x01] + [UInt8](repeating: 0xAA, count: 16))
    pad(&payload, to: 25) // Ensure final payload is 25 bytes
    return payload
  }

  // MARK: - CBPeripheralManagerDelegate

  public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOff {
      // If Bluetooth is turned off, stop everything.
      stopBroadcastInternal()
    }
    print("[RidBroadcastModule] Peripheral manager state changed to: \(peripheral.state.rawValue)")
  }
    
  public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
        print("[RidBroadcastModule] Failed to start advertising: \(error.localizedDescription)")
    }
  }

  // MARK: - Helper Functions

  /// Ensures a Data object is exactly a certain length by padding it with zeros or truncating it.
  private func pad(_ data: inout Data, to length: Int) {
      if data.count > length {
          data = data.prefix(length)
      } else if data.count < length {
          data.append(Data(repeating: 0, count: length - data.count))
      }
  }
}

// Helper extension to append integers with correct byte order (little-endian)
// This remains unchanged.
extension Data {
    mutating func append(int16: Int16) {
        var value = int16.littleEndian
        append(Data(bytes: &value, count: MemoryLayout<Int16>.size))
    }
    mutating func append(int32: Int32) {
        var value = int32.littleEndian
        append(Data(bytes: &value, count: MemoryLayout<Int32>.size))
    }
}
