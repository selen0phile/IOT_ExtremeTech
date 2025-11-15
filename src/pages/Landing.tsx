import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Smartphone,
  Radio,
  MapPin,
  Wallet,
  Shield,
  Zap,
  FileText,
  Video,
  Cpu,
  Users,
  Bell,
  TrendingUp,
  CircuitBoard,
  Code,
} from "lucide-react";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-purple-50 to-red-50">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/50 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img
                src="/rixa.webp"
                alt="Rixa Logo"
                className="w-12 h-12 object-contain"
              />
              <h1 className="text-2xl font-bold bg-linear-to-r from-red-500 via-purple-600 to-violet-600 bg-clip-text text-transparent">
                Rixa
              </h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-gray-600 hover:text-red-500 transition-colors"
              >
                Features
              </a>
              <a
                href="#solution"
                className="text-gray-600 hover:text-red-500 transition-colors"
              >
                Solution
              </a>
              <a
                href="#documentation"
                className="text-gray-600 hover:text-red-500 transition-colors"
              >
                Documentation
              </a>
              <Button
                variant="ghost"
                onClick={() => navigate("/api-docs")}
                className="text-gray-600 hover:text-red-500"
              >
                API Docs
              </Button>
              <Button
                onClick={() => navigate("/")}
                className="bg-linear-to-r from-red-500 to-purple-600 hover:from-red-600 hover:to-purple-700 text-white"
              >
                Launch App
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-block px-4 py-2 bg-purple-100 rounded-full animate-pulse">
                  <span className="text-purple-700 font-semibold text-sm">
                    🎯 IoT Innovation Challenge 2025
                  </span>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                  <span className="bg-linear-to-r from-red-500 via-purple-600 to-violet-600 bg-clip-text text-transparent">
                    Smart Rickshaw
                  </span>
                  <br />
                  <span className="text-gray-800">Calling System</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  An innovative IoT solution that revolutionizes traditional
                  rickshaw transportation with real-time tracking, digital
                  payments, and seamless connectivity between riders and
                  passengers.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={() => navigate("/app")}
                    className="bg-linear-to-r from-red-500 to-purple-600 hover:from-red-600 hover:to-purple-700 text-white text-lg px-8 py-6 h-auto"
                  >
                    Try Live Demo
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    onClick={() =>
                      document
                        .getElementById("documentation")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    variant="outline"
                    className="text-lg px-8 py-6 h-auto border-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                  >
                    View Documentation
                  </Button>
                </div>
                <div className="flex items-center gap-8 pt-4">
                  <div>
                    <div className="text-3xl font-bold text-red-500">100%</div>
                    <div className="text-sm text-gray-600">
                      Real-time Tracking
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600">
                      24/7
                    </div>
                    <div className="text-sm text-gray-600">Availability</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-violet-600">
                      IoT
                    </div>
                    <div className="text-sm text-gray-600">Powered</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-linear-to-r from-red-500/20 to-purple-600/20 rounded-3xl blur-3xl"></div>
                <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
                  <img
                    src="/rixa.webp"
                    alt="Rixa Rickshaw"
                    className="w-full h-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                The Challenge We Solved
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Traditional rickshaw transportation lacks modern connectivity,
                making it difficult for passengers to find available rickshaws
                and for drivers to optimize their routes efficiently.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-linear-to-br from-red-50 to-red-100 border border-red-200">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Location Visibility
                </h3>
                <p className="text-gray-600">
                  Passengers struggle to find nearby available rickshaws in
                  real-time, leading to long wait times and frustration.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-linear-to-br from-purple-50 to-purple-100 border border-purple-200">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Payment Issues
                </h3>
                <p className="text-gray-600">
                  Cash-only transactions create inconvenience and safety
                  concerns for both passengers and drivers.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-linear-to-br from-violet-50 to-violet-100 border border-violet-200">
                <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center mb-4">
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Communication Gap
                </h3>
                <p className="text-gray-600">
                  No efficient system for passengers to request rides and
                  drivers to receive booking notifications instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Features */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                Our IoT Solution
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                A comprehensive smart system integrating hardware sensors,
                mobile app, and cloud infrastructure
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Mobile App
                </h3>
                <p className="text-gray-600 text-sm">
                  User-friendly interface for requesting rides, tracking
                  location, and managing payments
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <CircuitBoard className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  IoT Hardware
                </h3>
                <p className="text-gray-600 text-sm">
                  ESP32-based system with GPS, OLED display, buttons, and LED
                  indicators
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Real-time GPS
                </h3>
                <p className="text-gray-600 text-sm">
                  Live location tracking for both riders and passengers with
                  accurate positioning
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-red-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Push Notifications
                </h3>
                <p className="text-gray-600 text-sm">
                  Instant alerts for ride requests, confirmations, and status
                  updates
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Digital Wallet
                </h3>
                <p className="text-gray-600 text-sm">
                  Integrated payment system with balance management and rewards
                  points
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Secure Authentication
                </h3>
                <p className="text-gray-600 text-sm">
                  Google OAuth integration for secure user authentication and
                  profile management
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Admin Dashboard
                </h3>
                <p className="text-gray-600 text-sm">
                  Comprehensive monitoring and management interface for system
                  oversight
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-linear-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Real-time Sync
                </h3>
                <p className="text-gray-600 text-sm">
                  Firebase Firestore for instant data synchronization across all
                  devices
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Stack */}
        <section id="solution" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                Technical Architecture
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Built with modern technologies and IoT best practices
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shrink-0">
                    <Cpu className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Hardware Components
                    </h3>
                    <ul className="space-y-1 text-gray-600">
                      <li>• ESP32 Microcontroller</li>
                      <li>• NEO-6M GPS Module</li>
                      <li>• 0.96" OLED Display (128x64)</li>
                      <li>• Push Buttons & LED Indicators</li>
                      <li>• Power Management System</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                    <Code className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Software Stack
                    </h3>
                    <ul className="space-y-1 text-gray-600">
                      <li>• React + TypeScript + Vite</li>
                      <li>• Firebase (Auth, Firestore, Hosting)</li>
                      <li>• Google Maps API</li>
                      <li>• WebSocket for Real-time Communication</li>
                      <li>• Tailwind CSS + shadcn/ui</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Key Features Implemented
                    </h3>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Geolocation-based rickshaw finding</li>
                      <li>• Distance calculation & sorting</li>
                      <li>• Ride request & acceptance flow</li>
                      <li>• Real-time status updates</li>
                      <li>• Payment & rewards system</li>
                      <li>• Ride history tracking</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      Security & Reliability
                    </h3>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Secure Google OAuth authentication</li>
                      <li>• Firestore security rules</li>
                      <li>• Real-time data validation</li>
                      <li>• Error handling & recovery</li>
                      <li>• Offline capability support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Documentation Section */}
        <section
          id="documentation"
          className="py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-br from-slate-50 to-purple-50"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                Project Documentation
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Complete technical documentation, circuit diagrams, and system
                architecture
              </p>
            </div>

            {/* D1: Circuit Diagrams */}
            <div className="mb-12 bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-linear-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center">
                  <CircuitBoard className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    D1. Circuit Diagrams
                  </h3>
                  <p className="text-sm text-red-600 font-semibold">
                    [3 marks]
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    Circuit Diagram
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    ESP32, OLED Display, GPS Module & Communication System
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <img
                      src="/circuit diagram.jpg"
                      alt="Rixa Circuit Diagram - ESP32 Wiring"
                      className="w-full h-auto object-contain rounded-lg"
                    />
                  </div>
                </div>

                <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    Battery & Power Supply Diagram
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    Power Management & Battery Configuration
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <img
                      src="/battery diagram.jpg"
                      alt="Rixa Battery Diagram - Power Supply"
                      className="w-full h-auto object-contain rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* D2: Software Architecture */}
            <div className="mb-12 bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-linear-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Code className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    D2. Software Architecture
                  </h3>
                  <p className="text-sm text-purple-600 font-semibold">
                    [3 marks]
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-2 border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    System Architecture Diagram
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    Complete System Overview: ESP32, WebSocket, Firebase & React
                    Frontend
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <img
                      src="/system.png"
                      alt="System Architecture Diagram"
                      className="w-full h-auto object-contain rounded-lg"
                    />
                  </div>
                </div>

                <div className="border-2 border-purple-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    Data Flow Diagram
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    Complete interaction flow: User → WebSocket → Firebase →
                    ESP32
                  </p>

                  {/* Full-size diagram display */}
                  <div className="bg-gray-50 rounded-lg p-6 mb-4">
                    <img
                      src="/dataflow.png"
                      alt="Rixa Data Flow Diagram - Complete System Architecture"
                      className="w-full h-auto object-contain rounded-lg shadow-lg"
                    />
                  </div>

                  <div className="flex justify-center">
                    <a
                      href="/dataflow.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="border-purple-600 text-purple-600 hover:bg-purple-50"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        View Interactive Diagram
                      </Button>
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Zoom & pan controls available in interactive view
                  </p>
                </div>

                <div className="border-2 border-purple-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    API Endpoint Documentation
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    Complete WebSocket & Firebase Firestore API Documentation
                  </p>
                  <div className="flex justify-center">
                    <Button
                      onClick={() => navigate("/api-docs")}
                      className="bg-linear-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View API Documentation
                    </Button>
                  </div>
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <ul className="text-xs text-gray-600 space-y-1 text-left">
                      <li>✓ WebSocket ride request API</li>
                      <li>✓ Firebase Firestore collections</li>
                      <li>✓ Real-time data synchronization</li>
                      <li>✓ Code examples & usage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* D3: Video Demonstration */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-linear-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    D3. Video Demonstration
                  </h3>
                  <p className="text-sm text-violet-600 font-semibold">
                    [4 marks]
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="border-2 border-violet-200 rounded-xl p-6 bg-white shadow-sm">
                  <p className="text-gray-800 font-semibold mb-3 text-center">
                    Complete Working Prototype Demonstration
                  </p>
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    5-10 minute video showcasing full system operation
                  </p>

                  {/* Video Embed */}
                  <div
                    className="relative w-full bg-gray-100 rounded-lg"
                    style={{ paddingBottom: "56.25%" }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <div className="text-center p-8">
                        <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-semibold">
                          Video Demo Coming Soon
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Full system demonstration video will be uploaded here
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      Video Coverage:
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 text-left">
                      <li>✓ All test cases passing demonstration</li>
                      <li>✓ System operation with detailed narration</li>
                      <li>✓ Installation and setup walkthrough</li>
                      <li>✓ Live hardware and software integration</li>
                      <li>✓ Real-world usage scenarios</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-linear-to-r from-red-500 via-purple-600 to-violet-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Experience the Future of Rickshaw Transportation?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Try our live demo and see how Rixa is revolutionizing urban
              mobility
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={() => navigate("/app")}
                className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6 h-auto font-semibold"
              >
                Launch App
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={() => navigate("/admin")}
                variant="outline"
                className="border-2 border-white text-white bg-transparent hover:bg-white/10 text-lg px-8 py-6 h-auto font-semibold"
              >
                Admin Dashboard
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src="/rixa.webp"
                    alt="Rixa Logo"
                    className="w-10 h-10 object-contain"
                  />
                  <h3 className="text-xl font-bold">Rixa</h3>
                </div>
                <p className="text-gray-400 text-sm">
                  Smart IoT solution for modern rickshaw transportation
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Quick Links</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>
                    <a href="#features" className="hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#solution" className="hover:text-white">
                      Solution
                    </a>
                  </li>
                  <li>
                    <a href="#documentation" className="hover:text-white">
                      Documentation
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Project</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>IoT Innovation Challenge 2025</li>
                  <li>Phase One Submission</li>
                  <li>Smart Transportation Category</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
              <p>
                © 2025 Rixa. Built for IoT Innovation Challenge. All rights
                reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Landing;
