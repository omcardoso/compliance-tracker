import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import App from "./App.jsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <SignedIn>
      <App />
    </SignedIn>
    <SignedOut>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
        justifyContent:"center", background:"#f1f5f9" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:22, fontWeight:900,
            color:"#0f172a", marginBottom:8 }}>Compliance Tracker</div>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:24 }}>
            Westchester International
          </div>
          <SignIn routing="hash"/>
        </div>
      </div>
    </SignedOut>
  </ClerkProvider>
);
