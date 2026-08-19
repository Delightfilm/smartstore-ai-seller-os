import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import SmartStoreSellerOS from "./SmartStoreSellerOS.jsx";
import SourcingConsole from "./SourcingConsole.jsx";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const isSourcing = path === "/sourcing-console" || path === "/sourcing-console.html";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isSourcing ? (
      <SourcingConsole />
    ) : (
      <SmartStoreSellerOS />
    )}
  </React.StrictMode>
);
