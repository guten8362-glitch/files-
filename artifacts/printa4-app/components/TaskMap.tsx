import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export function TaskMap({ latitude, longitude, shopName, building }: any) {
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={shopName || "Printer Location"}
          description={building}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 160,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
