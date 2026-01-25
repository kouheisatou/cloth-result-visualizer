import { useEffect, useRef, useCallback, useMemo } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import type { Channel, Edge, Payment, TimelineEvent } from '../types';

interface NetworkGraphProps {
  channels: Channel[];
  edges: Edge[];
  payments: Payment[];
  currentEvents: TimelineEvent[];
  selectedPayment: Payment | null;
  onNodeClick?: (nodeId: number) => void;
  onEdgeClick?: (edgeId: number) => void;
}

export function NetworkGraph({
  channels,
  edges,
  payments,
  currentEvents,
  selectedPayment,
  onNodeClick,
  onEdgeClick,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Build edge map for quick lookup
  const edgeMap = useMemo(() => {
    const map = new Map<number, Edge>();
    for (const edge of edges) {
      map.set(edge.id, edge);
    }
    return map;
  }, [edges]);

  // Determine which nodes and edges to show based on payments
  const relevantNodes = useMemo(() => {
    const nodes = new Set<number>();
    
    // Add nodes from all payments
    for (const payment of payments) {
      nodes.add(payment.senderId);
      nodes.add(payment.receiverId);
      
      // Add nodes from route
      for (const attempt of payment.attemptsHistory) {
        for (const hop of attempt.route || []) {
          nodes.add(hop.from_node_id);
          nodes.add(hop.to_node_id);
        }
      }
    }
    
    return nodes;
  }, [payments]);

  // Get relevant channels (channels where both nodes are relevant)
  const relevantChannels = useMemo(() => {
    return channels.filter(
      ch => relevantNodes.has(ch.node1) && relevantNodes.has(ch.node2)
    );
  }, [channels, relevantNodes]);

  // Build graph elements
  const elements = useMemo((): ElementDefinition[] => {
    const nodeElements: ElementDefinition[] = [];
    const edgeElements: ElementDefinition[] = [];

    // Add nodes
    for (const nodeId of relevantNodes) {
      nodeElements.push({
        data: {
          id: `n${nodeId}`,
          label: `${nodeId}`,
        },
      });
    }

    // Add edges from channels
    for (const channel of relevantChannels) {
      edgeElements.push({
        data: {
          id: `ch${channel.id}`,
          source: `n${channel.node1}`,
          target: `n${channel.node2}`,
          capacity: channel.capacity,
          edge1: channel.edge1,
          edge2: channel.edge2,
        },
      });
    }

    return [...nodeElements, ...edgeElements];
  }, [relevantNodes, relevantChannels]);

  // Calculate highlighted elements based on current events and selected payment
  const { highlightedEdges, highlightedNodes, errorEdges } = useMemo(() => {
    const edges = new Set<number>();
    const nodes = new Set<number>();
    const errors = new Set<number>();

    // Highlight from current events
    for (const event of currentEvents) {
      if (event.routeEdges) {
        for (const edgeId of event.routeEdges) {
          edges.add(edgeId);
          const edge = edgeMap.get(edgeId);
          if (edge) {
            nodes.add(edge.fromNodeId);
            nodes.add(edge.toNodeId);
          }
        }
      }
      if (event.type === 'payment_fail' && event.errorEdge) {
        errors.add(event.errorEdge);
      }
    }

    // Highlight from selected payment
    if (selectedPayment) {
      nodes.add(selectedPayment.senderId);
      nodes.add(selectedPayment.receiverId);
      
      for (const edgeId of selectedPayment.route) {
        edges.add(edgeId);
        const edge = edgeMap.get(edgeId);
        if (edge) {
          nodes.add(edge.fromNodeId);
          nodes.add(edge.toNodeId);
        }
      }

      // Also highlight the last attempt's route
      const lastAttempt = selectedPayment.attemptsHistory[selectedPayment.attemptsHistory.length - 1];
      if (lastAttempt?.route) {
        for (const hop of lastAttempt.route) {
          edges.add(hop.edge_id);
          nodes.add(hop.from_node_id);
          nodes.add(hop.to_node_id);
        }
      }
    }

    return { highlightedEdges: edges, highlightedNodes: nodes, errorEdges: errors };
  }, [currentEvents, selectedPayment, edgeMap]);

  // Get channel ID from edge ID
  const getChannelIdFromEdge = useCallback((edgeId: number): number | null => {
    const edge = edgeMap.get(edgeId);
    return edge?.channelId ?? null;
  }, [edgeMap]);

  // Update highlighting
  const updateHighlighting = useCallback(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    // Reset all styles
    cy.elements().removeClass('highlighted active-route error-edge sender receiver');

    // Highlight nodes
    for (const nodeId of highlightedNodes) {
      cy.$(`#n${nodeId}`).addClass('highlighted');
    }

    // Highlight edges
    for (const edgeId of highlightedEdges) {
      const channelId = getChannelIdFromEdge(edgeId);
      if (channelId !== null) {
        cy.$(`#ch${channelId}`).addClass('active-route');
      }
    }

    // Mark error edges
    for (const edgeId of errorEdges) {
      const channelId = getChannelIdFromEdge(edgeId);
      if (channelId !== null) {
        cy.$(`#ch${channelId}`).addClass('error-edge');
      }
    }

    // Mark sender and receiver
    if (selectedPayment) {
      cy.$(`#n${selectedPayment.senderId}`).addClass('sender');
      cy.$(`#n${selectedPayment.receiverId}`).addClass('receiver');
    }
  }, [highlightedNodes, highlightedEdges, errorEdges, selectedPayment, getChannelIdFromEdge]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#1e293b',
            'border-color': '#475569',
            'border-width': 2,
            'label': 'data(label)',
            'color': '#94a3b8',
            'font-size': 10,
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'width': 30,
            'height': 30,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'background-color': '#3b82f6',
            'border-color': '#60a5fa',
            'color': '#ffffff',
          },
        },
        {
          selector: 'node.sender',
          style: {
            'background-color': '#22c55e',
            'border-color': '#4ade80',
            'border-width': 4,
          },
        },
        {
          selector: 'node.receiver',
          style: {
            'background-color': '#8b5cf6',
            'border-color': '#a78bfa',
            'border-width': 4,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#334155',
            'curve-style': 'bezier' as const,
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge.active-route',
          style: {
            'line-color': '#f59e0b',
            'width': 4,
            'opacity': 1,
            'z-index': 100,
          },
        },
        {
          selector: 'edge.error-edge',
          style: {
            'line-color': '#ef4444',
            'width': 5,
            'opacity': 1,
            'z-index': 101,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 100,
        gravity: 0.25,
        numIter: 500,
      },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2,
    });

    cy.on('tap', 'node', (evt) => {
      const nodeId = parseInt(evt.target.id().substring(1));
      onNodeClick?.(nodeId);
    });

    cy.on('tap', 'edge', (evt) => {
      const edgeData = evt.target.data();
      if (edgeData.edge1) {
        onEdgeClick?.(edgeData.edge1);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, onNodeClick, onEdgeClick]);

  // Update highlighting when dependencies change
  useEffect(() => {
    updateHighlighting();
  }, [updateHighlighting]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
      }}
    />
  );
}

