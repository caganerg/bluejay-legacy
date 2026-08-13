export interface GraphNode {
  id: string;
  title: string;
  slug: string;
  group?: string; // folder or tag group
  val?: number; // importance / degree (number of connections)
  isPhantom?: boolean; // Unresolved note that hasn't been created yet
  folderName?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  isPhantom?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
