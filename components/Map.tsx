'use client'
import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

const Map = () => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const origin = { lat: 42.2768045, lng: -83.7323959 };
  const destination = { lat: 42.2823851, lng: -83.7410377 };

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places'],
  });

  const directionsCallback = useCallback((result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
    if (result !== null && status === 'OK') {
      setDirections(result);
    }
  }, []);

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading maps</div>;
  }

  return (
    <div className='min-w-full min-h-full'>
      <GoogleMap
      mapContainerStyle={{ width: '100vw', height: '100vh' }}
      center={origin}
      zoom={10}
    >
      {!directions && (
        <DirectionsService
          options={{
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
          }}
          callback={directionsCallback}
        />
      )}
      {directions && (
        <DirectionsRenderer
          options={{
            directions: directions,
          }}
        />
      )}
    </GoogleMap>
    </div>
  );
};

export default Map;