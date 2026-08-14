"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { GraphData, GraphNode } from "@/types/graph";
import { Search, ZoomIn, ZoomOut, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SimNode extends GraphNode, SimulationNodeDatum {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  isPhantom?: boolean;
}

interface GraphViewProps {
  data: GraphData;
  activeNoteId?: string;
  onNodeClick?: (nodeId: string) => void;
}

export function GraphView({ data, activeNoteId, onNodeClick }: GraphViewProps) {
  const router = useRouter();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [hoveredNode, setHoveredNode] = React.useState<SimNode | null>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [panOffset, setPanOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const nodesRef = React.useRef<SimNode[]>([]);
  const linksRef = React.useRef<SimLink[]>([]);
  const simRef = React.useRef<Simulation<SimNode, SimLink> | null>(null);

  // Dragging state
  const isDraggingCanvas = React.useRef(false);
  const draggedNode = React.useRef<SimNode | null>(null);
  const dragStartPos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Render Canvas Loop
  const renderCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Center & Apply Pan/Zoom
    ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    const activeOrHovered = hoveredNode;
    const connectedNodeIds = new Set<string>();

    if (activeOrHovered) {
      connectedNodeIds.add(activeOrHovered.id);
      for (const link of linksRef.current) {
        const sId = typeof link.source === "object" ? link.source.id : link.source;
        const tId = typeof link.target === "object" ? link.target.id : link.target;
        if (sId === activeOrHovered.id) connectedNodeIds.add(tId);
        if (tId === activeOrHovered.id) connectedNodeIds.add(sId);
      }
    }

    // 1. Draw Links (Edges)
    for (const link of linksRef.current) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;

      if (!source.x || !source.y || !target.x || !target.y) continue;

      const isConnected =
        activeOrHovered &&
        (source.id === activeOrHovered.id || target.id === activeOrHovered.id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (link.isPhantom) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = isConnected ? "rgba(245, 158, 11, 0.8)" : "rgba(245, 158, 11, 0.25)";
        ctx.lineWidth = isConnected ? 1.5 : 1;
      } else {
        ctx.setLineDash([]);
        if (activeOrHovered) {
          ctx.strokeStyle = isConnected ? "rgba(129, 140, 248, 0.8)" : "rgba(100, 116, 139, 0.08)";
          ctx.lineWidth = isConnected ? 2 : 0.8;
        } else {
          ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
          ctx.lineWidth = 1;
        }
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Draw Nodes
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue;

      const isHovered = activeOrHovered?.id === node.id;
      const isActive = activeNoteId === node.id;
      const isConnected = connectedNodeIds.has(node.id);
      const isMatched = searchQuery
        ? node.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const baseRadius = node.isPhantom ? 4.5 : Math.min(14, Math.max(5, (node.val || 1) * 3 + 4));
      const radius = isHovered || isActive ? baseRadius * 1.3 : baseRadius;

      // Glow effect for active / hovered
      if (isHovered || isActive) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
        ctx.fillStyle = node.isPhantom ? "rgba(245, 158, 11, 0.25)" : "rgba(99, 102, 241, 0.35)";
        ctx.fill();
      }

      // Main Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      if (node.isPhantom) {
        ctx.fillStyle = isMatched ? "#f59e0b" : "#78350f";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (isActive) {
        ctx.fillStyle = "#38bdf8";
      } else if (activeOrHovered && !isConnected && !isHovered) {
        ctx.fillStyle = isMatched ? "#334155" : "#1e293b";
      } else if (isMatched && searchQuery) {
        ctx.fillStyle = "#ec4899"; // Search match highlight
      } else {
        ctx.fillStyle = "#6366f1"; // Primary indigo
      }

      ctx.fill();

      // Node Labels (Headings)
      const showLabel =
        zoomLevel > 0.8 ||
        isHovered ||
        isActive ||
        isConnected ||
        (searchQuery && isMatched);

      if (showLabel) {
        ctx.font = isHovered || isActive ? "600 12px sans-serif" : "500 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Label background shadow for readability
        ctx.fillStyle = isHovered || isActive
          ? "#ffffff"
          : node.isPhantom
          ? "#fde68a"
          : activeOrHovered && !isConnected
          ? "#475569"
          : "#cbd5e1";

        ctx.fillText(node.title, node.x, node.y + radius + 4);
      }
    }

    ctx.restore();
  }, [panOffset, zoomLevel, hoveredNode, activeNoteId, searchQuery]);

  // Initialize simulation data
  React.useEffect(() => {
    if (!data.nodes || data.nodes.length === 0) return;

    // Deep copy nodes and links
    const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map<string, SimNode>(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = data.links
      .map((l) => ({
        source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
        target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
        isPhantom: l.isPhantom,
      }))
      .filter((l) => nodeMap.has(l.source as string) && nodeMap.has(l.target as string));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    if (simRef.current) simRef.current.stop();

    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(70)
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<SimNode>().radius((d) => ((d.val || 1) * 6 + 12)))
      .alphaDecay(0.02);

    simRef.current = simulation;

    simulation.on("tick", () => {
      renderCanvas();
    });

    return () => {
      simulation.stop();
    };
  }, [data, renderCanvas]);

  // Window resize handler
  React.useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // Mouse Interaction (Hover, Drag Node, Pan Canvas)
  const getNodeAtPos = (clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - canvas.width / 2 - panOffset.x) / zoomLevel;
    const y = (clientY - rect.top - canvas.height / 2 - panOffset.y) / zoomLevel;

    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue;
      const radius = (node.val || 1) * 3 + 8;
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= radius) {
        return node;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const targetNode = getNodeAtPos(e.clientX, e.clientY);
    if (targetNode) {
      draggedNode.current = targetNode;
      targetNode.fx = targetNode.x;
      targetNode.fy = targetNode.y;
      if (simRef.current) simRef.current.alphaTarget(0.3).restart();
    } else {
      isDraggingCanvas.current = true;
      dragStartPos.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvas.width / 2 - panOffset.x) / zoomLevel;
      const y = (e.clientY - rect.top - canvas.height / 2 - panOffset.y) / zoomLevel;
      draggedNode.current.fx = x;
      draggedNode.current.fy = y;
      renderCanvas();
    } else if (isDraggingCanvas.current) {
      setPanOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
      renderCanvas();
    } else {
      const node = getNodeAtPos(e.clientX, e.clientY);
      if (node !== hoveredNode) {
        setHoveredNode(node);
        renderCanvas();
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedNode.current) {
      draggedNode.current.fx = null;
      draggedNode.current.fy = null;
      draggedNode.current = null;
      if (simRef.current) simRef.current.alphaTarget(0);
    }
    isDraggingCanvas.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    const node = getNodeAtPos(e.clientX, e.clientY);
    if (node) {
      if (onNodeClick) {
        onNodeClick(node.id);
      } else {
        router.push(`/notes/${node.id}`);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomLevel((prev) => Math.min(3, Math.max(0.3, prev * zoomFactor)));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    if (simRef.current) simRef.current.alpha(0.3).restart();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#070a13] relative overflow-hidden select-none">
      {/* Üst Kontrol ve Filtre Çubuğu */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Grafikte ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 sm:w-64 pl-8 bg-slate-950/60 text-xs border-slate-800 text-slate-200 placeholder:text-slate-500 rounded-lg"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="h-8 px-2 text-xs text-slate-400 hover:text-white"
            >
              Temizle
            </Button>
          )}
        </div>

        {/* Yakınlaştırma & Sıfırlama Butonları */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/80 shadow-2xl backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.min(3, z * 1.2))}
            title="Yakınlaştır"
            className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.max(0.3, z / 1.2))}
            title="Uzaklaştır"
            className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetView}
            title="Görünümü Sıfırla"
            className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Alanı */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Alt Bilgi / Lejant Paneli */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-[11px] text-slate-400 space-y-2 max-w-xs">
          <div className="flex items-center justify-between font-semibold text-slate-200 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Bilgi Grafiği (D3)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {data.nodes.length} Not • {data.links.length} Bağlantı
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20" />
              <span>Normal Not</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
              <span>Hayalet Not</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-400/20" />
              <span>Aktif Not</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-pink-500/20" />
              <span>Arama Eşleşmesi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
