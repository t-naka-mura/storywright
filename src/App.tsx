import { useState, useCallback } from "react";
import type { Edge } from "@xyflow/react";
import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { DetailPanel } from "./components/DetailPanel";
import { StatusBar } from "./components/StatusBar";
import "./App.css";

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const handleEdgeClick = useCallback(
    (edge: Edge) => {
      setSelectedEdge(edge);
      if (!isPanelOpen) {
        setIsPanelOpen(true);
      }
    },
    [isPanelOpen],
  );

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return (
    <div className="app-layout">
      <Toolbar onTogglePanel={handleTogglePanel} isPanelOpen={isPanelOpen} />
      <div className="main-area">
        <Canvas onEdgeClick={handleEdgeClick} />
        <DetailPanel
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          selectedEdge={selectedEdge}
        />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
