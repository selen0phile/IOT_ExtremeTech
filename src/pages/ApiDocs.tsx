import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Code,
  Database,
  Radio,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type EndpointMethod = "GET" | "POST" | "PUT" | "DELETE" | "WS" | "REALTIME";

type Endpoint = {
  method: EndpointMethod;
  path: string;
  description: string;
  category: "WebSocket" | "Firebase Collections";
  requestBody?: any;
  responseBody?: any;
  parameters?: Array<{ name: string; type: string; description: string }>;
  firestoreOps?: string[];
};

const API_ENDPOINTS: Endpoint[] = [
  // WebSocket API
  {
    method: "WS",
    path: "ws://localhost:8080",
    category: "WebSocket",
    description:
      "WebSocket connection for real-time ride requests and distance updates",
    requestBody: {
      location: {
        lat: 23.7809,
        lng: 90.2792,
      },
      destination: {
        lat: 23.751,
        lng: 90.394,
      },
    },
    responseBody: {
      message: "Request received",
      // or real-time distance updates in meters
      distanceInMeters: 1234,
    },
  },

  // Firebase Collections as API Endpoints
  {
    method: "REALTIME",
    path: "/ride_requests",
    category: "Firebase Collections",
    description:
      "Collection storing all ride requests with states: active, accepted, timeout",
    firestoreOps: [
      "Create: New ride request via WebSocket",
      "Read: Query active requests, get by requestId",
      "Update: Change state (active → accepted/timeout)",
      "Listen: Real-time updates on state changes",
    ],
    requestBody: {
      requestId: "auto-generated",
      state: "active | accepted | timeout",
      type: "ride_request",
      timestamp: "Firestore Timestamp",
      location: "GeoPoint(lat, lng)",
      destination: "GeoPoint(lat, lng)",
      receivedAt: "serverTimestamp()",
      acceptedBy: "riderId (when accepted)",
      rider: {
        uid: "string",
        name: "string",
        location: "GeoPoint",
        assignedAt: "serverTimestamp()",
      },
    },
  },

  {
    method: "REALTIME",
    path: "/riders",
    category: "Firebase Collections",
    description:
      "Collection storing rider profiles and real-time GPS locations",
    firestoreOps: [
      "Create: Register new rider with profile",
      "Read: Get rider details, query all riders",
      "Update: Update location via GPS module (ESP32)",
      "Listen: Real-time location tracking",
    ],
    requestBody: {
      uid: "string (user auth id)",
      name: "string",
      email: "string",
      location: "GeoPoint(lat, lng)",
      lastUpdated: "serverTimestamp()",
      photoURL: "string (optional)",
    },
  },

  {
    method: "REALTIME",
    path: "/rider_state",
    category: "Firebase Collections",
    description:
      "Collection tracking rider availability states: idle, requested, pickup, riding",
    firestoreOps: [
      "Create: Initialize rider state as idle",
      "Read: Check rider availability",
      "Update: State transitions (idle → requested → pickup → riding → idle)",
      "Listen: Real-time state monitoring",
    ],
    requestBody: {
      state: "idle | requested | pickup | riding",
      requestId: "string (when in active ride)",
      rideRequest: {
        requestId: "string",
        timestamp: "Timestamp",
        location: "GeoPoint",
        destination: "GeoPoint",
      },
      updatedAt: "serverTimestamp()",
    },
  },

  {
    method: "REALTIME",
    path: "/notifications",
    category: "Firebase Collections",
    description:
      "Collection managing ride notifications sent to riders with timeout logic",
    firestoreOps: [
      "Create: Send notification to nearby riders (10s timeout per rider)",
      "Read: Get active notifications for a rider",
      "Update: Accept/reject notification, auto-timeout after 10s",
      "Listen: Real-time notification updates",
    ],
    requestBody: {
      id: "string",
      requestId: "string",
      riderId: "string",
      state: "active | accepted | rejected | timeout | filled",
      createdAt: "serverTimestamp()",
      resolvedAt: "serverTimestamp() (when resolved)",
      ride: {
        timestamp: "Timestamp",
        location: "GeoPoint",
        destination: "GeoPoint",
      },
      rider: {
        uid: "string",
        name: "string",
        location: "GeoPoint",
      },
    },
  },

  {
    method: "REALTIME",
    path: "/rider_balance",
    category: "Firebase Collections",
    description: "Collection storing rider wallet balance in Taka (৳)",
    firestoreOps: [
      "Create: Initialize balance for new rider",
      "Read: Get current balance",
      "Update: Add/deduct balance on transactions",
      "Listen: Real-time balance updates",
    ],
    requestBody: {
      balanceTk: "number (in Bangladeshi Taka)",
      updatedAt: "serverTimestamp()",
    },
  },

  {
    method: "REALTIME",
    path: "/rider_points",
    category: "Firebase Collections",
    description: "Collection managing rider reward points system",
    firestoreOps: [
      "Create: Initialize points for new rider",
      "Read: Get current points",
      "Update: Add points on ride completion",
      "Listen: Real-time points updates",
    ],
    requestBody: {
      balance: "number (reward points)",
      updatedAt: "serverTimestamp()",
    },
  },

  {
    method: "REALTIME",
    path: "/ride_history",
    category: "Firebase Collections",
    description:
      "Collection storing completed ride history with earnings and ratings",
    firestoreOps: [
      "Create: Add completed ride to history",
      "Read: Query ride history with filters (all, completed, cancelled)",
      "Update: Update ride details or status",
      "Listen: Real-time history updates",
    ],
    requestBody: {
      riderId: "string",
      requestId: "string",
      timestamp: "Timestamp",
      completedAt: "Timestamp",
      location: "GeoPoint (pickup)",
      destination: "GeoPoint",
      status: "completed | cancelled",
      earnings: "number (in Taka)",
      distance: "number (in meters)",
      duration: "number (in seconds)",
      rating: "number (1-5, optional)",
    },
  },
];

function ApiDocs() {
  const navigate = useNavigate();
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = [
    "All",
    ...Array.from(new Set(API_ENDPOINTS.map((e) => e.category))),
  ];

  const filteredEndpoints =
    selectedCategory === "All"
      ? API_ENDPOINTS
      : API_ENDPOINTS.filter((e) => e.category === selectedCategory);

  const getMethodColor = (method: EndpointMethod) => {
    switch (method) {
      case "GET":
        return "bg-blue-500";
      case "POST":
        return "bg-green-500";
      case "PUT":
        return "bg-orange-500";
      case "DELETE":
        return "bg-red-500";
      case "WS":
        return "bg-purple-500";
      case "REALTIME":
        return "bg-pink-500";
      default:
        return "bg-gray-500";
    }
  };

  const toggleEndpoint = (path: string) => {
    setExpandedEndpoint(expandedEndpoint === path ? null : path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-red-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/landing")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Code className="w-8 h-8 text-purple-600" />
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-purple-600 to-violet-600 bg-clip-text text-transparent">
                    Rixa API Documentation
                  </h1>
                  <p className="text-sm text-gray-600">
                    WebSocket & Firebase Realtime API
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Introduction */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-200">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            API Overview
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Rixa uses a hybrid architecture combining WebSocket for real-time
            ride requests and Firebase Firestore for data persistence and
            real-time synchronization. All Firebase collections are documented
            here as API endpoints since they serve as the data layer for the
            application.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  WebSocket Server
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Endpoint:</strong> ws://localhost:8080
              </p>
              <p className="text-sm text-gray-600">
                Handles ride request submission and real-time distance updates
                during pickup phase. Uses custom request queue for efficient
                rider assignment.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  Firebase Firestore
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Project:</strong> rixa-4aa10
              </p>
              <p className="text-sm text-gray-600">
                7 collections serving as real-time database with automatic
                synchronization, authentication integration, and geospatial
                queries.
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className={
                selectedCategory === cat
                  ? "bg-gradient-to-r from-red-500 to-purple-600 text-white"
                  : ""
              }
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* API Endpoints */}
        <div className="space-y-4">
          {filteredEndpoints.map((endpoint, idx) => {
            const isExpanded = expandedEndpoint === endpoint.path;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleEndpoint(endpoint.path)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span
                        className={`${getMethodColor(
                          endpoint.method
                        )} text-white px-3 py-1 rounded-lg font-semibold text-sm min-w-[100px] text-center`}
                      >
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <code className="text-gray-800 font-mono font-semibold">
                          {endpoint.path}
                        </code>
                        <p className="text-sm text-gray-600 mt-1">
                          {endpoint.description}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
                    {/* Firestore Operations */}
                    {endpoint.firestoreOps && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Database className="w-4 h-4 text-pink-600" />
                          Firestore Operations
                        </h4>
                        <ul className="space-y-2">
                          {endpoint.firestoreOps.map((op, i) => (
                            <li
                              key={i}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
                              <span className="text-pink-600 font-bold">•</span>
                              <span>{op}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Parameters */}
                    {endpoint.parameters && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Parameters
                        </h4>
                        <div className="space-y-2">
                          {endpoint.parameters.map((param, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 text-sm"
                            >
                              <code className="bg-gray-200 px-2 py-1 rounded text-gray-800 font-mono">
                                {param.name}
                              </code>
                              <span className="text-gray-600">
                                {param.type}
                              </span>
                              <span className="text-gray-500 flex-1">
                                {param.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Request Body */}
                    {endpoint.requestBody && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Request / Document Structure
                        </h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                          {JSON.stringify(endpoint.requestBody, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response Body */}
                    {endpoint.responseBody && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Response / Real-time Updates
                        </h4>
                        <pre className="bg-gray-900 text-blue-400 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                          {JSON.stringify(endpoint.responseBody, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Technical Notes */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mt-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Technical Implementation Notes
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🔄 Real-time Synchronization
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Firebase Firestore provides automatic real-time updates using
                onSnapshot listeners. All clients receive instant updates when
                data changes, enabling live tracking and notifications without
                polling.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                📍 Geospatial Queries
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                GeoPoint data type stores latitude/longitude coordinates. The
                server uses Haversine formula to calculate distances and sort
                nearby idle riders for efficient ride assignment.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                ⚡ Assignment Algorithm
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Broadcast-based assignment: All idle riders receive
                notifications simultaneously (sorted by distance). First to
                accept gets the ride. Individual 10-second timeout per rider,
                60-second total window for the request.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🔐 Authentication & Security
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Firebase Authentication with Google OAuth. Firestore security
                rules enforce user-specific read/write permissions. All
                sensitive operations require authentication tokens.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🌐 WebSocket Protocol
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Bi-directional communication for ride requests and real-time
                distance updates. Server validates GPS coordinates, persists to
                Firestore, and manages custom request queue for intelligent
                rider assignment.
              </p>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mt-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Code Examples
          </h2>

          <div className="space-y-6">
            {/* WebSocket Example */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-600" />
                WebSocket Client (JavaScript)
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {`const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Send ride request
  ws.send(JSON.stringify({
    location: { lat: 23.7809, lng: 90.2792 },
    destination: { lat: 23.7510, lng: 90.3940 }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Distance update:', data.message, 'meters');
};`}
              </pre>
            </div>

            {/* Firebase Read Example */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-pink-600" />
                Firebase Real-time Listener (TypeScript)
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {`import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Listen to rider state changes
const unsubscribe = onSnapshot(
  doc(db, 'rider_state', riderId),
  (snapshot) => {
    const state = snapshot.data();
    console.log('Rider state:', state?.state);
    // Handle state updates (idle, requested, pickup, riding)
  }
);

// Cleanup listener
unsubscribe();`}
              </pre>
            </div>

            {/* CLI Example */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Code className="w-5 h-5 text-green-600" />
                CLI Test Client
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {`# Send ride request via CLI
npx tsx client.ts \\
  --from "23.7809,90.2792" \\
  --to "23.7510,90.3940" \\
  --url ws://localhost:8080`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiDocs;

