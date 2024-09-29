import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export const fetchCache = 'force-no-store'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const ROUTE = 'https://routes.googleapis.com/directions/v2:computeRoutes'

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Google Maps API credentials are not set.' }, { status: 500 })
  }

  try {
    const body = await request.json()

    const response = await fetch(ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify({
        origin: body.origin,
        destination: body.destination,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
        languageCode: "en-US",
        units: "IMPERIAL"
      })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch data from Google Maps Routes API.')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching Google Maps Routes data:', error)
    return NextResponse.json({ error: 'Failed to fetch route data.' }, { status: 500 })
  }
}