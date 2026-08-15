import React from "react";
import CollectorTestPanel from "./CollectorTestPanel.jsx";
import SourcingConsole from "./SourcingConsole.jsx";

export default function SourcingCollectorTest() {
  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 w-[min(720px,calc(100vw-2rem))] max-h-[70vh] overflow-auto rounded-xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur">
        <CollectorTestPanel />
      </div>
      <SourcingConsole />
    </>
  );
}
