package com.RidBroadcastModule

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.pm.PackageManager
import android.os.ParcelUuid
import android.util.Log
import com.facebook.react.bridge.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.util.*

class RidBroadcastModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var bluetoothAdapter: BluetoothAdapter?
    private var bluetoothLeAdvertiser: BluetoothLeAdvertiser?
    private var isBroadcasting = false
    private var broadcastTimer: Timer? = null
    private var allDroneData: ReadableMap? = null

    // Remote ID Service UUID as per ASTM F3411-22a
    private val remoteIdServiceUuid = ParcelUuid.fromString("0000FFFA-0000-1000-8000-00805F9B34FB")

    init {
        val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
    }

    override fun getName(): String {
        return "RidBroadcastModule"
    }

    /**
     * Starts a periodic broadcast, automatically cycling through different RID frames.
     * @param data A map containing all necessary data for all frame types.
     * @param promise Resolves if successful, rejects on error.
     */
    @ReactMethod
    fun startBroadcast(data: ReadableMap, promise: Promise) {
        try {
            if (!isBluetoothSupported()) {
                promise.reject("BLUETOOTH_NOT_SUPPORTED", "Bluetooth LE is not supported on this device")
                return
            }

            if (bluetoothAdapter?.isEnabled != true) {
                promise.reject("BLUETOOTH_DISABLED", "Bluetooth is not enabled")
                return
            }

            allDroneData = data
            stopBroadcastInternal() // Ensure any old timer is stopped

            // Set up a new timer to call updateBroadcastFrame every second
            broadcastTimer = Timer()
            broadcastTimer?.scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    updateBroadcastFrame()
                }
            }, 0, 1000)

            isBroadcasting = true
            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("START_BROADCAST_ERROR", e.message, e)
        }
    }

    /**
     * Stops the Bluetooth LE broadcast and cancels the timer.
     */
    @ReactMethod
    fun stopBroadcast(promise: Promise) {
        try {
            stopBroadcastInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_BROADCAST_ERROR", e.message, e)
        }
    }

    private fun stopBroadcastInternal() {
        broadcastTimer?.cancel()
        broadcastTimer = null
        if (bluetoothLeAdvertiser != null && bluetoothAdapter?.isEnabled == true) {
             try {
                bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
             } catch (e: SecurityException) {
                // Ignore if permissions are missing.
             }
        }
        isBroadcasting = false
    }

    /**
     * This function is called by the timer to generate and broadcast a new frame.
     */
    private fun updateBroadcastFrame() {
        if (bluetoothLeAdvertiser == null || allDroneData == null) return

        val payload = createRemoteIdPayload(allDroneData!!)
        if (payload.isEmpty()) return

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(false)
            .setTimeout(0)
            .build()

        val advertiseData = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceUuid(remoteIdServiceUuid)
            .addServiceData(remoteIdServiceUuid, payload)
            .build()
        
        try {
            // To update data, we must stop the old advertisement and start a new one.
            bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
            bluetoothLeAdvertiser?.startAdvertising(settings, advertiseData, advertiseCallback)
        } catch(e: SecurityException) {
            stopBroadcastInternal()
        }
    }


    /**
     * Creates a single RID payload frame based on the current time.
     * It cycles through the 6 main message types, one per second.
     */
    private fun createRemoteIdPayload(data: ReadableMap): ByteArray {
        // Use modulus division on the current time in seconds to cycle through frames 0-5.
        val frameType = (System.currentTimeMillis() / 1000) % 6

        return when (frameType) {
            0L -> createBasicIdPayload(data)
            1L -> createLocationPayload(data)
            2L -> createSelfIdPayload(data)
            3L -> createSystemPayload(data)
            4L -> createOperatorIdPayload(data)
            5L -> createAuthenticationPayload(data)
            else -> ByteArray(0)
        }
    }

    private fun createBasicIdPayload(data: ReadableMap): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        val idType = 0 // UAS ID Type: Serial Number (0)
        val uasId = data.getString("uasId") ?: return ByteArray(0)
        buffer.put((0x0 shl 4 or idType).toByte()) // Message Type 0x0 (Basic ID)
        buffer.put(uasId.toByteArray(StandardCharsets.US_ASCII).take(20).toByteArray())
        return buffer.array().copyOf(buffer.position())
    }

    private fun createLocationPayload(data: ReadableMap): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        buffer.put(0x10.toByte()) // Message Type 0x1 (Location/Vector)
        buffer.put((data.getInt("status")).toByte())
        buffer.putShort((data.getDouble("direction") * 100).toInt().toShort())
        buffer.putShort((data.getDouble("speedHorizontal") * 100).toInt().toShort())
        buffer.putShort((data.getDouble("speedVertical") * 100).toInt().toShort())
        buffer.putInt((data.getDouble("latitude") * 1e7).toInt())
        buffer.putInt((data.getDouble("longitude") * 1e7).toInt())
        buffer.putShort((data.getDouble("altitudePressure") * 10).toInt().toShort())
        buffer.putShort((data.getDouble("altitudeGeodetic") * 10).toInt().toShort())
        buffer.putShort((data.getDouble("height") * 10).toInt().toShort())
        buffer.put(0x00.toByte()) // Accuracies
        buffer.put(0x00.toByte()) // Accuracies
        buffer.putShort(0x0000.toShort()) // Timestamp
        return buffer.array().copyOf(buffer.position())
    }
    
    private fun createSelfIdPayload(data: ReadableMap): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        val description = data.getString("description") ?: return ByteArray(0)
        buffer.put(0x20.toByte()) // Message Type 0x2 (Self-ID)
        buffer.put(0x01.toByte()) // Description Type: Text (1)
        buffer.put(description.toByteArray(StandardCharsets.US_ASCII).take(23).toByteArray())
        return buffer.array().copyOf(buffer.position())
    }

    private fun createSystemPayload(data: ReadableMap): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        val operatorLocationType = data.getInt("operatorLocationType")
        buffer.put(0x30.toByte()) // Message Type 0x3 (System)
        buffer.put(operatorLocationType.toByte())
        buffer.putInt((data.getDouble("operatorLatitude") * 1e7).toInt())
        buffer.putInt((data.getDouble("operatorLongitude") * 1e7).toInt())
        buffer.putShort(data.getInt("areaCount").toShort())
        buffer.putInt(data.getInt("areaRadius"))
        buffer.putInt((data.getDouble("areaCeiling") * 10).toInt())
        buffer.putInt((data.getDouble("areaFloor") * 10).toInt())
        return buffer.array().copyOf(buffer.position())
    }

    private fun createOperatorIdPayload(data: ReadableMap): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        val operatorId = data.getString("operatorId") ?: return ByteArray(0)
        buffer.put(0x40.toByte()) // Message Type 0x4 (Operator ID)
        buffer.put(0x00.toByte()) // Operator ID Type: CAA Issued (0)
        buffer.put(operatorId.toByteArray(StandardCharsets.US_ASCII).take(20).toByteArray())
        return buffer.array().copyOf(buffer.position())
    }

    private fun createAuthenticationPayload(data: ReadableMap): ByteArray {
        try {
            val privateKeyString = data.getString("privateKey")
            if (privateKeyString.isNullOrEmpty()) {
                return createPlaceholderAuth()
            }

            val keyBytes = Base64.getDecoder().decode(privateKeyString)
            val keySpec = PKCS8EncodedKeySpec(keyBytes)
            val keyFactory = KeyFactory.getInstance("EC")
            val privateKey = keyFactory.generatePrivate(keySpec)

            val uasId = data.getString("uasId") ?: ""
            val messageToSign = "$uasId:${System.currentTimeMillis() / 1000}"
            val messageBytes = messageToSign.toByteArray(StandardCharsets.UTF_8)

            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(privateKey)
            signature.update(messageBytes)
            val signatureBytes = signature.sign()

            val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
            buffer.put(0x50.toByte()) // Message Type 0x5 (Authentication)
            buffer.put(0x01.toByte()) // Auth Type: Signature (1)
            buffer.put(signatureBytes.take(16).toByteArray())
            return buffer.array().copyOf(buffer.position())

        } catch (e: Exception) {
            Log.e("RidBroadcastModule", "Error creating authentication payload: ${e.message}")
            return createPlaceholderAuth()
        }
    }

    private fun createPlaceholderAuth(): ByteArray {
        val buffer = ByteBuffer.allocate(25).order(ByteOrder.LITTLE_ENDIAN)
        buffer.put(0x50.toByte())
        buffer.put(0x01.toByte())
        buffer.put(ByteArray(16))
        return buffer.array().copyOf(buffer.position())
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            super.onStartSuccess(settingsInEffect)
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
        }
    }
}
