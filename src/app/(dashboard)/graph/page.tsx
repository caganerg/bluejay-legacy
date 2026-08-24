"use client";

import * as React from "react";
import { GraphView } from "@/components/graph/graph-view";
import { GraphData } from "@/types/graph";
import { Network, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalGraphPage() {
  const [data, setData] = React.useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = React.useState(true);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/graph");
      const graphData = await res.json();
      setData(graphData || { nodes: [], links: [] });
    } catch (err) {
      console.error("Failed to load graph data:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGraphData();
  }, []);

  const totalPhantom = data.nodes.filter((n) => n.isPhantom).length;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#070a12] relative">
      {/* Top header bar */}
      <header className="h-13 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 bg-[#0c101b]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 leading-none">
              Knowledge Graph (Global Graph View)
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Bi-directional links between notes and the knowledge network
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-3 text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>
              <strong className="text-indigo-400 font-semibold">{data.nodes.length}</strong> Nodes
            </span>
            <span>•</span>
            <span>
              <strong className="text-purple-400 font-semibold">{data.links.length}</strong> Links
            </span>
            {totalPhantom > 0 && (
              <>
                <span>•</span>
                <span>
                  <strong className="text-amber-400 font-semibold">{totalPhantom}</strong> Pending Links
                </span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchGraphData}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Graph area */}
      <div className="flex-1 relative w-full h-full">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
            <span className="text-xs">Computing the knowledge graph simulation...</span>
          </div>
        ) : (
          <GraphView data={data} />
        )}
      </div>
    </div>
  );
}
