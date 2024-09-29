// app/components/Map.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  GoogleMap,
  Marker,
  useJsApiLoader,
  Polyline,
  Autocomplete,
} from '@react-google-maps/api';
import { supabase } from '../lib/supabaseClient';

interface Report {
  id: string;
  latitude: number;
  longitude: number;
}

const Map: React.FC = () => {
  // State to hold accident markers
  const [markers, setMarkers] = useState<
    Array<{ id: string; position: google.maps.LatLngLiteral }>
  >([]);

  // Center of the map
  const [center, setCenter] = useState<google.maps.LatLngLiteral>({
    lat: 42.279594,
    lng: -83.732124,
  });

  // State for start and end locations
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');

  // State to hold all valid routes
  const [routes, setRoutes] = useState<google.maps.DirectionsRoute[]>([]);

  // State to hold accident coordinates for avoidance
  const [accidentCoords, setAccidentCoords] = useState<google.maps.LatLngLiteral[]>([]);

  // Define colors for polylines
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places', 'geometry'],
  });

  // Refs for Autocomplete components
  const originRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      console.log('Google Maps API not loaded yet');
      return;
    }

    console.log('Google Maps API loaded');
    console.log('Map component mounted');

    // Fetch accident reports from Supabase
    const fetchReports = async () => {
      console.log('Fetching reports from Supabase');
      const { data, error } = await supabase
        .from('reports')
        .select('id, latitude, longitude');

      if (error) {
        console.error('Error fetching reports:', error);
      } else if (data) {
        console.log('Reports fetched:', data);
        const markersData = data
          .filter(
            (report) => report.latitude !== null && report.longitude !== null
          )
          .map((report) => ({
            id: report.id,
            position: { lat: report.latitude!, lng: report.longitude! },
          }));
        console.log('Markers after fetching:', markersData);
        setMarkers(markersData);
        setAccidentCoords(markersData.map((marker) => marker.position));
        console.log('Accident coordinates:', markersData.map((marker) => marker.position));
      }
    };

    fetchReports();

    // Set up real-time subscription for new accident reports
    const channel = supabase
      .channel('reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          console.log('New report inserted:', payload.new);
          const newReport = payload.new as Report;
          if (newReport.latitude !== null && newReport.longitude !== null) {
            const newMarker = {
              id: newReport.id,
              position: {
                lat: newReport.latitude!,
                lng: newReport.longitude!,
              },
            };
            setMarkers((prevMarkers) => {
              const updatedMarkers = [...prevMarkers, newMarker];
              console.log('Markers after new report:', updatedMarkers);
              return updatedMarkers;
            });
            setAccidentCoords((prevCoords) => {
              const updatedCoords = [...prevCoords, newMarker.position];
              console.log('Updated accident coordinates:', updatedCoords);
              // Recalculate routes with updated accident coordinates
              calculateRoute(updatedCoords);
              return updatedCoords;
            });            
          } else {
            console.error('New report has invalid coordinates:', newReport);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Map component unmounted');
      supabase.removeChannel(channel);
    };
  }, [isLoaded]);

  // Function to calculate routes
  const calculateRoute = (currentAccidentCoords?: google.maps.LatLngLiteral[]) => {
    const accidents = currentAccidentCoords || accidentCoords;

    console.log('calculateRoute called');
    console.log('Start location:', startLocation);
    console.log('End location:', endLocation);
    console.log('Accident coordinates:', accidents);

    if (!startLocation || !endLocation) {
      alert('Please enter both start and destination addresses.');
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: startLocation,
        destination: endLocation,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        console.log('DirectionsService callback called');
        console.log('Status:', status);
        console.log('Result:', result);

        if (status === 'OK' && result) {
          // **Clear existing routes**
          setRoutes([]);

          // **If there are no accident coordinates, add all routes**
          if (accidents.length === 0) {
            console.log('No accident coordinates. Adding all routes.');
            setRoutes(result.routes);
            return;
          }

          // **Filter out routes that pass through accident locations using detailed path points**
          const validRoutes = result.routes.filter((route) => {
            // Iterate through each leg and step for detailed path checking
            const passesThroughAccident = route.legs.some((leg) =>
              leg.steps.some((step) =>
                step.path.some((pathPoint) =>
                  accidents.some(
                    (accident) =>
                      google.maps.geometry.spherical.computeDistanceBetween(
                        pathPoint,
                        new google.maps.LatLng(accident.lat, accident.lng)
                      ) < 70 // 70 meters threshold
                  )
                )
              )
            );
            console.log('Route passes through accident:', passesThroughAccident);
            return !passesThroughAccident;
          });

          console.log('Valid routes after filtering:', validRoutes);

          if (validRoutes.length > 0) {
            setRoutes(validRoutes);
            console.log('Added valid routes:', validRoutes);
          } else {
            alert('No alternative routes available that avoid accident areas.');
            console.warn('No valid routes found that avoid accidents.');
            setRoutes([]);
          }
        } else if (status === 'ZERO_RESULTS') {
          console.warn('No routes found between the specified locations.');
          alert('No routes found between the specified locations. Please check your inputs.');
          setRoutes([]);
        } else if (status === 'NOT_FOUND') {
          console.error('One or more locations could not be geocoded.');
          alert('One or more locations could not be found. Please check your inputs.');
          setRoutes([]);
        } else {
          console.error('Error fetching directions:', status);
          alert('Error fetching directions: ' + status);
          setRoutes([]);
        }
      }
    );
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    calculateRoute(); // Uses current accidentCoords
  };

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading Maps...</div>;
  }

  console.log('Rendering markers:', markers);
  console.log('Rendering routes:', routes);

  return (
    <div className="map-container">
      {/* Route Input Form */}
      <form onSubmit={handleSubmit} className="route-form">
        {/* Start Location Autocomplete */}
        <Autocomplete
          onLoad={(autocomplete) => (originRef.current = autocomplete)}
          onPlaceChanged={() => {
            const place = originRef.current?.getPlace();
            if (place && place.formatted_address) {
              setStartLocation(place.formatted_address);
              console.log('Selected start location:', place.formatted_address);
            } else {
              console.error('Start location place data is incomplete:', place);
              alert('Please select a valid start location from the suggestions.');
            }
          }}
        >
          <input
            type="text"
            placeholder="Start location"
            required
            className="route-input"
          />
        </Autocomplete>

        {/* Destination Autocomplete */}
        <Autocomplete
          onLoad={(autocomplete) => (destinationRef.current = autocomplete)}
          onPlaceChanged={() => {
            const place = destinationRef.current?.getPlace();
            if (place && place.formatted_address) {
              setEndLocation(place.formatted_address);
              console.log('Selected end location:', place.formatted_address);
            } else {
              console.error('End location place data is incomplete:', place);
              alert('Please select a valid destination from the suggestions.');
            }
          }}
        >
          <input
            type="text"
            placeholder="Destination"
            required
            className="route-input"
          />
        </Autocomplete>

        <button type="submit" className="route-button">
          Get Routes
        </button>
      </form>

      {/* Google Map */}
      <GoogleMap
        key={`map-${routes.length}`} // Unique key based on the number of routes
        mapContainerStyle={{ width: '100vw', height: '100vh' }}
        center={center}
        zoom={13}
      >
        {/* Accident Markers */}
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position} />
        ))}

        {/* Display Valid Routes */}
        {routes.length > 0 &&
          routes.map((route, index) => (
            <Polyline
              key={`${index}-${route.summary}`} // Ensures unique key
              path={route.overview_path.map((point) => ({
                lat: point.lat(),
                lng: point.lng(),
              }))}
              options={{
                strokeColor: colors[index % colors.length],
                strokeOpacity: 0.8,
                strokeWeight: 5,
              }}
            />
          ))}
      </GoogleMap>
    </div>
  );
};

export default Map;