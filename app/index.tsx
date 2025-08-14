import { useEffect, useRef, useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // CORRECTED IMPORT
// CONCEPTUAL: This import represents a BLE peripheral library.
import { Buffer } from 'buffer';
import { registerRootComponent } from 'expo';
import * as Location from 'expo-location';
import { LocationObject, LocationSubscription } from 'expo-location';
import { BluetoothStatus } from 'react-native-bluetooth-status';
import Peripheral from 'react-native-peripheral';

const App = () => {
  // --- State Management ---
  const [sessionId, setSessionId] = useState('');
  const [uasSerialNumber, setUasSerialNumber] = useState('');
  const [operatorId, setOperatorId] = useState('');

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
      // Request location permissions using Expo's API
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Location permission is required to get telemetry data.');
        return;
      }

      // Start watching for location updates
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
      // Clean up the location subscription when the component unmounts
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      // Ensure advertising is stopped
      if (isTransmitting) {
        Peripheral.stopAdvertising();
      }
    };
  }, []);

  // --- BLE Broadcasting (Advertising) ---
  const packDataForBroadcast = () => {
    const uasId = uasSerialNumber || `session:${sessionId}`;
    const uasIdBytes = Buffer.from(uasId, 'utf8');
    const companyId = Buffer.from([0xFF, 0xFF]); // 0xFFFF is for testing
    const manufacturerData = Buffer.concat([companyId, uasIdBytes]);
    return manufacturerData.toString('base64');
  };

  const startBroadcast = async () => {
    try {
      const isReady = await BluetoothStatus.state();
      if (!isReady) {
        setErrorMessage("Bluetooth is not powered on.");
        return;
      }

      const manufacturerData = packDataForBroadcast();
      const serviceUUID = '0000FFFA-0000-1000-8000-00805F9B34FB'; // FAA Remote ID Service UUID

      // This is the correct, secure way to broadcast. We are only advertising
      // and not making the device connectable.
      await Peripheral.startAdvertising({
        name: 'RemoteID', // The name that will be broadcasted
        serviceUuids: [serviceUUID],
        //TODO: see about including manufacturer data for standardizing transmission data
        /* manufacturerData: manufacturerData, */
      });

      setStatusMessage(`Broadcasting ID: ${uasSerialNumber || sessionId}`);
    } catch (error: any) {
      setErrorMessage(`Broadcast start failed: ${error.message}`);
      setIsTransmitting(false);
    }
  };

  const stopBroadcast = async () => {
    try {
      await Peripheral.stopAdvertising();
      setStatusMessage('Transmission stopped.');
    } catch (error: any) {
      setErrorMessage(`Failed to stop broadcast: ${error.message}`);
    }
  };

  // --- Transmission Control ---
  const handleToggleTransmission = () => {
    setErrorMessage('');
    if (isTransmitting) {
      setIsTransmitting(false);
      stopBroadcast();
    } else {
      if (!uasSerialNumber && !sessionId) {
        setErrorMessage('Please provide a UAS Serial Number or a Session ID.');
        return;
      }
      if (!location) {
        setErrorMessage('Cannot transmit without valid location data.');
        return;
      }
      setIsTransmitting(true);
      startBroadcast();
    }
  };

  // --- UI Rendering ---
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.header}>Drone Remote ID (Expo)</Text>
        <Text style={styles.subHeader}>ASTM F3411-22a Transmission</Text>

        <View style={styles.statusSection}>
          <Text style={styles.statusText}>Status: {isTransmitting ? statusMessage : 'Idle'}</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        {/* UAS Identification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UAS Identification</Text>
          <Text style={styles.label}>UAS Serial Number (CAA-Assigned)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 1689Z9876543210ABCDEF"
            value={uasSerialNumber}
            onChangeText={setUasSerialNumber}
            editable={!isTransmitting}
          />
          <Text style={styles.orText}>OR</Text>
          <Text style={styles.label}>Session ID (Self-Generated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., my-drone-flight-123"
            value={sessionId}
            onChangeText={setSessionId}
            editable={!isTransmitting}
          />
        </View>

        {/* Operator Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operator Information</Text>
          <Text style={styles.label}>Operator ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Operator ID"
            value={operatorId}
            onChangeText={setOperatorId}
            editable={!isTransmitting}
          />
        </View>

        {/* Live Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Drone Telemetry (GPS)</Text>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Latitude</Text><TextInput style={styles.input} value={location ? location.coords.latitude.toFixed(6) : '...'} editable={false} /></View>
            <View style={styles.col}><Text style={styles.label}>Longitude</Text><TextInput style={styles.input} value={location ? location.coords.longitude.toFixed(6) : '...'} editable={false} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Text style={styles.label}>Altitude (m)</Text><TextInput style={styles.input} value={location ? (location.coords.altitude || 'N/A').toString() : '...'} editable={false} /></View>
            <View style={styles.col}><Text style={styles.label}>Speed (m/s)</Text><TextInput style={styles.input} value={location ? (location.coords.speed || 'N/A').toString() : '...'} editable={false} /></View>
          </View>
        </View>

        {/* Transmission Control */}
        <View style={styles.transmissionControl}>
          <Button
            title={isTransmitting ? 'Stop Transmitting' : 'Start Transmitting'}
            onPress={handleToggleTransmission}
            color={isTransmitting ? '#c0392b' : '#27ae60'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  scrollContainer: { padding: 20 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  subHeader: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 10 },
  statusSection: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#dfe6e9' },
  statusText: { fontSize: 14, color: '#2c3e50', textAlign: 'center' },
  errorText: { color: '#c0392b', textAlign: 'center', marginTop: 5, fontWeight: 'bold' },
  section: { backgroundColor: '#ffffff', borderRadius: 8, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#34495e', marginBottom: 15 },
  label: { fontSize: 14, color: '#34495e', marginBottom: 5 },
  input: { backgroundColor: '#ecf0f1', borderRadius: 5, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, color: '#2c3e50', marginBottom: 10 },
  orText: { textAlign: 'center', marginVertical: 10, fontSize: 14, color: '#95a5a6', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1, marginRight: 10 },
  transmissionControl: { marginTop: 10, marginBottom: 20 },
});

export default registerRootComponent(App);