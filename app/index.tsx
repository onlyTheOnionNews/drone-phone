import * as Location from 'expo-location';
import { LocationObject, LocationSubscription } from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import the crypto polyfill and its required dependency
import crypto from 'react-native-quick-crypto';

// Access the custom native module you created
const { DroneRemoteId } = NativeModules;

const App = () => {
  // --- State Management ---
  const [uasSerialNumber, setUasSerialNumber] = useState('1689Z9876543210ABCDEF');
  const [operatorId, setOperatorId] = useState('FIN123456789-123');
  const [selfIdText, setSelfIdText] = useState('Recreational Flight');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');

  // Operation area
  const [areaRadius, setAreaRadius] = useState('500');
  const [areaCeiling, setAreaCeiling] = useState('120');
  const [areaFloor, setAreaFloor] = useState('0');

  // Drone's Live Data
  const [location, setLocation] = useState<LocationObject | null>(null);
  const locationSubscription = useRef<LocationSubscription | null>(null);

  // App State
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to transmit.');
  const [errorMessage, setErrorMessage] = useState('');

  // --- Permission and Setup Effects ---
  useEffect(() => {
    const setup = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Location permission is required.');
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    };

    setup();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      // Ensure the broadcast is stopped when the component unmounts
      if (isTransmitting) {
        DroneRemoteId.stopBroadcast();
      }
    };
  }, []);
  
  // --- Key Generation using react-native-crypto ---
  const generateKeys = () => {
    try {
      const { privateKey: pk, publicKey: pubk } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256r1',
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'der' // DER is the binary format needed before Base64 encoding
        },
        publicKeyEncoding: {
          type: 'spki',
          format: 'der'
        }
      });

      // The privateKey is a Buffer in DER format. Convert it to Base64.
      setPrivateKey(pk!.toString('base64'));
      setPublicKey(pubk!.toString('base64'));

      Alert.alert("Success", "New keypair generated successfully.");
    } catch (error: any) {
        console.error("Key generation failed:", error);
        Alert.alert("Error", `Failed to generate keypair: ${error.message}`);
    }
  };

  // --- Transmission Control ---
  const handleToggleTransmission = async () => {
    setErrorMessage('');
    if (isTransmitting) {
      try {
        // Call the native module to stop the broadcast
        await DroneRemoteId.stopBroadcast();
        setIsTransmitting(false);
        setStatusMessage('Transmission stopped.');
      } catch (e: any) {
        setErrorMessage(`Stop failed: ${e.message}`);
      }
    } else {
      // Validate required fields before starting
      if (!uasSerialNumber || !operatorId) {
        setErrorMessage('UAS Serial Number and Operator ID are required.');
        return;
      }
      if (!location) {
        setErrorMessage('Cannot transmit without valid location data.');
        return;
      }
       if (!privateKey) {
        setErrorMessage('Please generate a keypair before broadcasting.');
        return;
      }

      // Assemble all data into a single object for the native module
      const droneData = {
        // Basic ID
        uasId: uasSerialNumber,
        // Location
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitudeGeodetic: location.coords.altitude || 0,
        height: location.coords.altitude || 0, // Assuming AGL = MSL for simplicity
        altitudePressure: location.coords.altitude || 0,
        direction: location.coords.heading || 0,
        speedHorizontal: location.coords.speed || 0,
        speedVertical: 0, // Not provided by Expo Location
        status: 1, // Operational
        // Self-ID
        description: selfIdText,
        // System
        operatorLocationType: 0, // Takeoff
        operatorLatitude: location.coords.latitude, // Assuming operator is at drone location
        operatorLongitude: location.coords.longitude,
        areaCount: 1,
        areaRadius: 500,
        areaCeiling: 1000,
        areaFloor: 0,
        // Operator ID
        operatorId: operatorId,
        // Authentication
        privateKey: privateKey,
      };

      try {
        // Call the native module to start the broadcast with all the data
        await DroneRemoteId.startBroadcast(droneData);
        setIsTransmitting(true);
        setStatusMessage(`Broadcasting ID: ${uasSerialNumber}`);
      } catch (e: any) {
        setErrorMessage(`Broadcast start failed: ${e.message}`);
      }
    }
  };

  // --- UI Rendering ---
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Drone Remote ID</Text>
        <Text style={styles.subHeader}>ASTM F3411-22a</Text>

        <View style={styles.statusSection}>
          <Text style={styles.statusText}>Status: {isTransmitting ? 'Transmitting' : 'Idle'}</Text>
          <Text style={styles.messageText}>{statusMessage}</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UAS Identification</Text>
          <Text style={styles.label}>UAS Serial Number (CAA-Assigned)</Text>
          <TextInput style={styles.input} value={uasSerialNumber} onChangeText={setUasSerialNumber} editable={!isTransmitting} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operator & Flight Info</Text>
          <Text style={styles.label}>Operator ID</Text>
          <TextInput style={styles.input} value={operatorId} onChangeText={setOperatorId} editable={!isTransmitting} />
          <Text style={styles.label}>Self-ID Description (Optional)</Text>
          <TextInput style={styles.input} value={selfIdText} onChangeText={setSelfIdText} editable={!isTransmitting} />
        </View>
        
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authentication</Text>
            <TouchableOpacity style={styles.button} onPress={generateKeys} disabled={isTransmitting}>
                <Text style={styles.buttonText}>Generate Keypair</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Private Key (Base64 PKCS#8)</Text>
            <TextInput style={[styles.input, styles.keyInput]} value={privateKey} editable={false} multiline />
            <Text style={styles.label}>Public Key (Base64 PKCS#8)</Text>
            <TextInput style={[styles.input, styles.keyInput]} value={publicKey} editable={false} multiline />
        </View>
        
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operation Area</Text>
            <Text style={styles.label}>Area Radius (meters)</Text>
            <TextInput style={styles.input} value={areaRadius} onChangeText={setAreaRadius} editable={!isTransmitting} keyboardType="numeric" />
            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.label}>Area Ceiling (meters)</Text>
                    <TextInput style={styles.input} value={areaCeiling} onChangeText={setAreaCeiling} editable={!isTransmitting} keyboardType="numeric" />
                </View>
                <View style={styles.col}>
                    <Text style={styles.label}>Area Floor (meters)</Text>
                    <TextInput style={styles.input} value={areaFloor} onChangeText={setAreaFloor} editable={!isTransmitting} keyboardType="numeric" />
                </View>
            </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Telemetry</Text>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Latitude</Text><TextInput style={styles.input} value={location ? location.coords.latitude.toFixed(6) : '...'} editable={false} /></View>
            <View style={styles.col}><Text style={styles.label}>Longitude</Text><TextInput style={styles.input} value={location ? location.coords.longitude.toFixed(6) : '...'} editable={false} /></View>
          </View>
        </View>

        <View style={styles.transmissionControl}>
          <TouchableOpacity
            style={[styles.button, isTransmitting ? styles.stopButton : styles.startButton]}
            onPress={handleToggleTransmission}
          >
            <Text style={styles.buttonText}>{isTransmitting ? 'Stop Transmitting' : 'Start Transmitting'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  scrollContainer: { padding: 20 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  subHeader: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 20 },
  statusSection: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#dfe6e9' },
  statusText: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  messageText: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginTop: 4 },
  errorText: { color: '#c0392b', textAlign: 'center', marginTop: 5, fontWeight: 'bold' },
  section: { backgroundColor: '#ffffff', borderRadius: 8, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#34495e', marginBottom: 15 },
  label: { fontSize: 14, color: '#34495e', marginBottom: 5 },
  input: { backgroundColor: '#ecf0f1', borderRadius: 5, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2c3e50', marginBottom: 10 },
  keyInput: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1, marginRight: 10 },
  transmissionControl: { marginTop: 10, marginBottom: 20 },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: '#27ae60',
  },
  stopButton: {
    backgroundColor: '#c0392b',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;
