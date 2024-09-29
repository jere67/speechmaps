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
import { ChevronLeft, ChevronRight, MapPin, Navigation, Route } from 'lucide-react';
import VoiceInput from './VoiceInput';
import { Loading } from './ui/Loading';
import { FloatingNav } from './ui/floating-navbar';

interface Report {
  id: string;
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  duration: string;
  arrivalTime: string;
  description: string;
  distance: string;
}

const Map: React.FC = () => {
  const [markers, setMarkers] = useState<Array<{ id: string; position: google.maps.LatLngLiteral }>>([]);
  const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 42.279594, lng: -83.732124 });
  const [startLocation, setStartLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [endLocation, setEndLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [routes, setRoutes] = useState<google.maps.DirectionsRoute[]>([]);
  const [routeInfos, setRouteInfos] = useState<RouteInfo[]>([]);
  const [accidentCoords, setAccidentCoords] = useState<google.maps.LatLngLiteral[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [navVisible, setNavVisible] = useState(false);
  const [navMessage, setNavMessage] = useState("");

  const mapRef = useRef<google.maps.Map | null>(null);
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places', 'geometry'],
  });

  const originRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const fetchReports = async () => {
      const { data, error } = await supabase.from('reports').select('id, latitude, longitude');
      if (error) {
        console.error('Error fetching reports:', error);
      } else if (data) {
        const markersData = data
          .filter((report) => report.latitude !== null && report.longitude !== null)
          .map((report) => ({
            id: report.id,
            position: { lat: report.latitude!, lng: report.longitude! },
          }));
        setMarkers(markersData);
        setAccidentCoords(markersData.map((marker) => marker.position));
      }
    };

    fetchReports();

    const channel = supabase
      .channel('reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        const newReport = payload.new as Report;
        if (newReport.latitude !== null && newReport.longitude !== null) {
          const newMarker = {
            id: newReport.id,
            position: { lat: newReport.latitude!, lng: newReport.longitude! },
          };
          setMarkers((prevMarkers) => [...prevMarkers, newMarker]);
          setNavVisible(true); 
          setNavMessage("An accident has been reported near your area.");
          setAccidentCoords((prevCoords) => {
            const updatedCoords = [...prevCoords, newMarker.position];
            calculateRoute(updatedCoords);
            return updatedCoords;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoaded]);

  const calculateRoute = (currentAccidentCoords?: google.maps.LatLngLiteral[]) => {
    const accidents = currentAccidentCoords || accidentCoords;

    if (!startLocation || !endLocation) {
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
        if (status === 'OK' && result) {
          setRoutes([]);

          if (accidents.length === 0) {
            setRoutes(result.routes);
            processRoutes(result.routes);
            fitMapToRouteBounds(result.routes);
            return;
          }

          const validRoutes = result.routes.filter((route) => {
            const passesThroughAccident = route.legs.some((leg) =>
              leg.steps.some((step) =>
                step.path.some((pathPoint) =>
                  accidents.some(
                    (accident) =>
                      google.maps.geometry.spherical.computeDistanceBetween(
                        pathPoint,
                        new google.maps.LatLng(accident.lat, accident.lng)
                      ) < 70
                  )
                )
              )
            );
            return !passesThroughAccident;
          });

          if (validRoutes.length > 0) {
            setRoutes(validRoutes);
            processRoutes(validRoutes);
            fitMapToRouteBounds(validRoutes);
          } else {
            setNavMessage("No alternative routes available that avoid accident areas.");
            setRoutes([]);
            setRouteInfos([]);
          }
        } else if (status === 'ZERO_RESULTS') {
          setNavMessage("No routes found between the specified locations. Please check your inputs.");
          setRoutes([]);
          setRouteInfos([]);
        } else if (status === 'NOT_FOUND') {
          setNavMessage("One or more locations could not be found. Please check your inputs.");
          setRoutes([]);
          setRouteInfos([]);
        } else {
          setNavMessage("Error fetching directions.");
          setRoutes([]);
          setRouteInfos([]);
        }
      }
    );
  };

  const processRoutes = (routes: google.maps.DirectionsRoute[]) => {
    const now = new Date();
    const routeInfos: RouteInfo[] = routes.map((route) => {
      // const duration = route.legs[0].duration?.text || '';
      const durationInMinutes = route.legs[0].duration?.value ? Math.round(route.legs[0].duration.value / 60) : 0;
      const arrivalTime = new Date(now.getTime() + (route.legs[0].duration?.value || 0) * 1000);
      return {
        duration: `${durationInMinutes} min`,
        arrivalTime: `Arrive at ${arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        description: route.summary,
        distance: route.legs[0].distance?.text || '',
      };
    });
    setRouteInfos(routeInfos);
  };

  const fitMapToRouteBounds = (routes: google.maps.DirectionsRoute[]) => {
    if (!mapRef.current || routes.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    routes.forEach((route) => {
      route.legs.forEach((leg) => {
        leg.steps.forEach((step) => {
          step.path.forEach((pathPoint) => {
            bounds.extend(pathPoint);
          });
        });
      });
    });

    mapRef.current?.fitBounds(bounds);
    setCenter(bounds.getCenter().toJSON());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    calculateRoute();
  };

  if (loadError) return <Loading />;
  if (!isLoaded) return <Loading />;

  const warningIconUrl = './images/crash.png';

  return (
    <div className="relative h-screen w-full">
      <div className="relative w-full">
        <FloatingNav visible={navVisible} setVisible={setNavVisible} navItem={navMessage} />
      </div>
      <div 
        className={`absolute top-1/2 left-0 transform -translate-y-1/2 bg-white shadow-lg transition-all duration-300 ease-in-out z-10 overflow-hidden rounded-xl ${isSidebarOpen ? 'w-80' : 'w-0'}`}
      >
        <div className={`p-4 w-80 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl font-bold mb-4 text-black text-center">SpeechMaps</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="start" className="block text-sm font-medium text-black">Start Location</label>
              <Autocomplete
                onLoad={(autocomplete) => (originRef.current = autocomplete)}
                onPlaceChanged={() => {
                  const place = originRef.current?.getPlace();
                  if (place && place.geometry && place.geometry.location) {
                    const location = place.geometry.location;
                    setStartLocation({ lat: location.lat(), lng: location.lng() });
                  } else {
                    setNavMessage("Please select a valid start location from the suggestions.");
                  }
                }}
              >
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="start"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-gray-100 text-black"
                    placeholder="Enter start location"
                  />
                </div>
              </Autocomplete>
            </div>
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-black">Destination</label>
              <Autocomplete
                onLoad={(autocomplete) => (destinationRef.current = autocomplete)}
                onPlaceChanged={() => {
                  const place = destinationRef.current?.getPlace();
                  if (place && place.geometry && place.geometry.location) {
                    const location = place.geometry.location;
                    setEndLocation({ lat: location.lat(), lng: location.lng() });
                  } else {
                    setNavMessage("Please select a valid destination from the suggestions.");
                  }
                }}
              >
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Navigation className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="destination"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-gray-100 text-black"
                    placeholder="Enter destination"
                  />
                </div>
              </Autocomplete>
            </div>
            <div className="flex justify-center">
              <button
                type="submit"
                className="flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200 ease-in-out"
              >
                <Route className="mr-2 h-5 w-5" color="#FFFFFF" />
                Get Routes
              </button>
            </div>
          </form>
          
          {routeInfos.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-black">Routes</h3>
              <div className="space-y-4">
                {routeInfos.map((route, index) => (
                  <div key={index} className="bg-gray-100 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold`}
                        style={{ backgroundColor: colors[index % colors.length] }}
                      >
                        {index + 1}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-baseline">
                          <span className="text-xl font-bold text-black">{route.duration}</span>
                          <span className="ml-2 text-sm text-black">{route.arrivalTime}</span>
                        </div>
                        <p className="text-sm text-gray-800">{route.description}</p>
                        <p className="text-sm text-gray-600">{route.distance}</p>
                      </div>
                    </div>
                    {index === 0 && (
                      <div className="mt-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">BEST</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <VoiceInput setNavVisible={setNavVisible} setNavMessage={setNavMessage} />
        </div>
      </div>
      <button
        className={`absolute top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-r-md shadow-md z-20 transition-all duration-300 ${
          isSidebarOpen ? 'left-80' : 'left-0'
        }`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <ChevronLeft className={"text-black"} size={24} /> : <ChevronRight className={"text-black"} size={24} />}
      </button>
      <GoogleMap
        key={`map-${routes.length}`}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={13}
        onLoad={(map) => {
          mapRef.current = map;
        }}
      >
        {startLocation && <Marker position={startLocation} label={{ text: "A", color: "white", fontSize: "20px" }} />}
        {endLocation && <Marker position={endLocation} label={{ text: "B", color: "white", fontSize: "20px" }} />}
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position} icon={{
            url: warningIconUrl,
            scaledSize: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
          }}
          title="Accident Location"/>
        ))}
        {routes.length > 0 &&
          routes.map((route, index) => (
            <Polyline
              key={`${index}-${route.summary}`}
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