// RidBroadcastModule.swift

import Foundation
import CoreBluetooth
import CryptoKit // Modern cryptography framework for signing

// The @objc attribute makes this Swift class available to the Objective-C runtime.
@objc(RidBroadcast)
class RidBroadcast: NSObject, CBPeripheralManagerDelegate {

  private var peripheralManager: CBPeripheralManager!
  private var broadcastTimer: Timer?
  private var allDroneData: [String: Any]?

  // ASTM F3411-22a Service UUID
  private let ridServiceUUID = CBUUID(string: "0000FFFA-0000-1000-8000-00805F9B34FB")

  override init() {
    super.init()
    // Initialize the peripheral manager on a background queue for performance.
    let queue = DispatchQueue(label: "com.yourprojectname.rid.bluetooth")
    peripheralManager = CBPeripheralManager(delegate: self, queue: queue)
  }

  // This tells React Native to initialize the module on the main thread.
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  /**
   * Starts a periodic broadcast, automatically cycling through different RID frames.
   * @param data A dictionary containing all necessary data for all frame types.
   * @param resolve The promise's resolve function.
   * @param reject The promise's reject function.
   */
  @objc(startBroadcast:resolver:rejecter:)
  func startBroadcast(data: [String: Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard peripheralManager.state == .poweredOn else {
      reject("BLUETOOTH_OFF", "Bluetooth is not powered on.", nil)
      return
    }

    // Store the data and start the timer
    allDroneData = data
    stopBroadcastInternal() // Ensure any old timer is stopped

    // Use a Timer to call updateBroadcastFrame every second
    broadcastTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
        self?.updateBroadcastFrame()
    }
    
    // Run the timer on a background thread to avoid blocking the UI
    if let timer = broadcastTimer {
        RunLoop.current.add(timer, forMode: .common)
    }

    resolve(true)
  }
  
  /**
   * Stops the Bluetooth LE broadcast and cancels the timer.
   */
  @objc(stopBroadcast:rejecter:)
  func stopBroadcast(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    stopBroadcastInternal()
    resolve(true)
  }

  private func stopBroadcastInternal() {
    broadcastTimer?.invalidate()
    broadcastTimer = nil
    if peripheralManager.isAdvertising {
        peripheralManager.stopAdvertising()
    }
  }

  /// This function is called by the timer to generate and broadcast a new frame.
  private func updateBroadcastFrame() {
    guard let data = allDroneData, peripheralManager.state == .poweredOn else { return }

    let payload = createRemoteIdPayload(data: data)
    guard !payload.isEmpty else { return }

    let advertisementData: [String: Any] = [
        CBAdvertisementDataServiceUUIDsKey: [ridServiceUUID],
        CBAdvertisementDataServiceDataKey: [ridServiceUUID: payload]
    ]
    
    // To update advertising data, we must restart it.
    if peripheralManager.isAdvertising {
        peripheralManager.stopAdvertising()
    }
    peripheralManager.startAdvertising(advertisementData)
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
    payload.append(contentsOf: uasId.data(using: .ascii)!.prefix(20))
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
    payload.append(contentsOf: [0x00, 0x00]) // Accuracies
    payload.append(int16: 0) // Timestamp
    return payload
  }
    
  private func createSelfIdPayload(data: [String: Any]) -> Data {
    guard let description = data["description"] as? String else { return Data() }
    var payload = Data()
    payload.append(0x20) // Message Type 0x2
    payload.append(0x01) // Description Type: Text
    payload.append(contentsOf: description.data(using: .ascii)!.prefix(23))
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
    return payload
  }

  private func createOperatorIdPayload(data: [String: Any]) -> Data {
    guard let operatorId = data["operatorId"] as? String else { return Data() }
    var payload = Data()
    payload.append(0x40) // Message Type 0x4
    payload.append(0x00) // Operator ID Type: CAA
    payload.append(contentsOf: operatorId.data(using: .ascii)!.prefix(20))
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
      payload.append(signature.rawRepresentation.prefix(16)) // Truncate signature for this example
      return payload
    } catch {
      print("[RidBroadcast] Error creating auth payload: \(error)")
      return createPlaceholderAuth()
    }
  }

  private func createPlaceholderAuth() -> Data {
    return Data([0x50, 0x01] + [UInt8](repeating: 0xAA, count: 16))
  }

  // MARK: - CBPeripheralManagerDelegate

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOff {
      // If Bluetooth is turned off, stop everything.
      stopBroadcastInternal()
    }
    print("[RidBroadcast] Peripheral manager state changed to: \(peripheral.state.rawValue)")
  }
    
  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
        print("[RidBroadcast] Failed to start advertising: \(error.localizedDescription)")
    }
  }
}

// Helper extension to append integers with correct byte order (little-endian)
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