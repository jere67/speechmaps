// components/Map.tsx
'use client'
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const Map = () => {
  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '400px' }}
        center={{ lat: 42.279594, lng: -83.732124 }} // Set default center
        zoom={10}
      >
      </GoogleMap>
    </LoadScript>
  );
};

export default Map;
