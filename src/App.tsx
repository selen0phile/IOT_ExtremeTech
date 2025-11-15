import "./App.css";
import { useAuth } from "@/contexts/AuthContext";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { Button } from "@/components/ui/button";
import RiderMap from "@/components/RiderMap";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import ActiveRidersList from "@/components/ActiveRidersList";
import PickupRideView from "@/components/PickupRideView";
import { useRiderState } from "@/hooks/useRiderState";
import RiderHistoryList from "@/components/RiderHistoryList";
import { useActiveNotification } from "@/hooks/useActiveNotification";
import { useRiderPoints } from "@/hooks/useRiderPoints";
import RiderWalletPanel from "@/components/RiderWalletPanel";
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import {
  DollarSignIcon,
  LogOutIcon,
  MailIcon,
  StarIcon,
  UserIcon,
  InfoIcon,
} from "lucide-react";

function App() {
  const { currentUser, isInitializing, signOut } = useAuth();
  const navigate = useNavigate();
  const { coords, error } = useRiderLocation(currentUser);
  const { riderState } = useRiderState(currentUser?.uid);
  const { activeNotification } = useActiveNotification(currentUser?.uid);
  const { balance: points } = useRiderPoints(currentUser?.uid);
  const [balanceTk, setBalanceTk] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    "🏠 Dashboard" | "💰 Wallet" | "🛵 Nearby"
  >("🏠 Dashboard");

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(
      doc(db, "rider_balance", currentUser.uid),
      (snap) => {
        const data = snap.data() as any;
        setBalanceTk(data?.balanceTk ?? 0);
      }
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const isInRide =
    riderState &&
    (riderState.state === "pickup" ||
      riderState.state === "riding" ||
      riderState.state === "requested" ||
      !!activeNotification);

  return (
    <>
      <div
        style={{
          minHeight: "100dvh",
          background: "linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)",
        }}
      >
        {!currentUser ? (
          // Login Screen
          <div className="flex flex-col items-center justify-center min-h-screen">
            <img
              src="https://cdn3d.iconscout.com/3d/premium/thumb/auto-rickshaw-3d-icon-png-download-4122512.png"
              style={{ width: 256, height: 256 }}
            />
            <div
              style={{
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: "3rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
              className="bg-gradient-to-br from-blue-500 to-purple-500 bg-clip-text text-transparent"
            >
              Rixa
            </div>
            <p className="text-gray-500 mb-8 text-center tracking-tight">
              Your trusted ride companion
            </p>
            {isInitializing ? (
              <div style={{ color: "#64748b" }}>Loading…</div>
            ) : (
              <GoogleLoginButton className="bg-gradient-to-br from-blue-500 to-purple-500 text-white h-12 rounded-lg font-semibold cursor-pointer transition-all duration-200 ease-in-out px-8 text-base hover:text-white" />
            )}
          </div>
        ) : (
          // Main App
          <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
            {isInRide ? (
              // Ride View - Full screen, no header
              <div style={{ padding: 20 }}>
                <PickupRideView />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-b-lg shadow-lg">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.75rem",
                        fontWeight: 800,
                        color: "white",
                        letterSpacing: "-0.01em",
                      }}
                      className="flex items-center gap-2"
                    >
                      <img
                        src="https://cdn3d.iconscout.com/3d/premium/thumb/auto-rickshaw-3d-icon-png-download-4122512.png"
                        style={{ width: 64, height: 64 }}
                      />
                      Rixa
                    </div>
                    <Button
                      variant="destructive"
                      className="text-xs"
                      onClick={signOut}
                    >
                      Logout <LogOutIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div
                    className=" text-white p-2 bg-white/10 rounded-lg flex
                  justify-between items-center px-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />{" "}
                        {currentUser.displayName ?? "Rider"}
                      </div>
                      <div className="text-sm text-white/80 flex items-center gap-2">
                        <MailIcon className="w-4 h-4" /> {currentUser.email}
                      </div>
                    </div>
                    <div className="text-sm flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-lg">
                        <StarIcon className="w-4 h-4" /> {points ?? 0}
                      </div>
                      <div className="flex items-center gap-2 text-lg">
                        <DollarSignIcon className="w-4 h-4" /> {balanceTk}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {error ? (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: 8,
                        padding: 12,
                        color: "#dc2626",
                        fontSize: "0.875rem",
                        marginBottom: 16,
                      }}
                    >
                      {error}
                    </div>
                  ) : null}

                  {/* Profile Card with Wallet Info */}
                  {/* <div
                    style={{
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid rgba(0, 0, 0, 0.05)",
                      borderRadius: 16,
                      padding: 20,
                      display: "grid",
                      gap: 16,
                      marginBottom: 20,
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 16 }}
                    >
                      {/* <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "1.75rem",
                          fontWeight: 700,
                          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                        }}
                      >
                        {currentUser.displayName?.charAt(0)?.toUpperCase() ??
                          "R"}
                      </div> 
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1.125rem",
                            color: "#1e293b",
                            marginBottom: 4,
                          }}
                        >
                          {currentUser.displayName ?? "Rider"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#64748b",
                          }}
                        >
                          {currentUser.email}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          background:
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          borderRadius: 12,
                          padding: 16,
                          color: "white",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.9,
                            marginBottom: 4,
                          }}
                        >
                          Points
                        </div>
                        <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                          {points ?? 0}
                        </div>
                      </div>
                      <div
                        style={{
                          background:
                            "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          borderRadius: 12,
                          padding: 16,
                          color: "white",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.9,
                            marginBottom: 4,
                          }}
                        >
                          Balance
                        </div>
                        <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                          {balanceTk} ৳
                        </div>
                      </div>
                    </div>
                  </div> */}

                  {/* Navigation Tabs */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 20,
                      // borderBottom: "2px solid rgba(0, 0, 0, 0.05)",
                      paddingBottom: 2,
                    }}
                  >
                    {(["🏠 Dashboard", "💰 Wallet", "🛵 Nearby"] as const).map(
                      (tab) => (
                        <Button
                          variant="outline"
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          // className="h-12"
                          className={`${
                            tab === activeTab
                              ? "bg-gradient-to-br border-0 from-blue-500 to-purple-500 text-white hover:text-white"
                              : ""
                          } rounded-lg font-semibold text-sm cursor-pointer transition-all duration-200 ease-in-out h-12`}
                        >
                          {tab}
                        </Button>
                      )
                    )}
                  </div>

                  {/* Tab Content */}
                  {activeTab === "🏠 Dashboard" && (
                    <>
                      <RiderMap coords={coords} />
                      <RiderHistoryList />
                    </>
                  )}

                  {activeTab === "💰 Wallet" && (
                    <div style={{ marginTop: 0 }}>
                      <RiderWalletPanel />
                    </div>
                  )}

                  {activeTab === "🛵 Nearby" && (
                    <>
                      <RiderMap coords={coords} />
                      <ActiveRidersList currentCoords={coords} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
