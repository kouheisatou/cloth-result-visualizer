import { useEffect, useRef, useCallback, useMemo, useState, useDeferredValue } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Defer the heavy computation to prevent UI freeze
  const deferredPayments = useDeferredValue(payments);
  const deferredChannels = useDeferredValue(channels);
  const deferredEdges = useDeferredValue(edges);

  // Build edge map for quick lookup
  const edgeMap = useMemo(() => {
    const map = new Map<number, Edge>();
    for (const edge of deferredEdges) {
      map.set(edge.id, edge);
    }
    return map;
  }, [deferredEdges]);

  // Determine which nodes and edges to show based on payments
  const relevantNodes = useMemo(() => {
    const nodes = new Set<number>();
    
    // Add nodes from all payments (using deferred value)
    for (const payment of deferredPayments) {
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
  }, [deferredPayments]);

  // Get relevant channels (channels where both nodes are relevant)
  const relevantChannels = useMemo(() => {
    return deferredChannels.filter(
      ch => relevantNodes.has(ch.node1) && relevantNodes.has(ch.node2)
    );
  }, [deferredChannels, relevantNodes]);

  // Build graph elements (split into smaller chunks)
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

  // Initialize Cytoscape with better async handling
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    setIsLoading(true);
    setIsInitialized(false);
    setLoadingProgress(`グラフを準備中... (${relevantNodes.size}ノード, ${relevantChannels.length}チャネル)`);

    // Cleanup any existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    let isCancelled = false;

    // Use async initialization to prevent UI freeze
    const initializeGraph = async () => {
      // Wait for next frame to allow loading UI to render
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (isCancelled || !containerRef.current) return;

      setLoadingProgress('ノードとエッジを配置中...');
      
      // Another frame delay before heavy computation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (isCancelled || !containerRef.current) return;

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
          name: 'preset',
        },
        minZoom: 0.1,
        maxZoom: 5,
        wheelSensitivity: 0.2,
      });

      if (isCancelled) {
        cy.destroy();
        return;
      }

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
      setIsInitialized(true);

      // Allow UI to update before starting layout
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (isCancelled) return;

      setLoadingProgress('レイアウトを計算中...');

      // Wait another frame before layout calculation
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      if (isCancelled) return;

      // Determine optimal layout parameters based on graph size
      const nodeCount = relevantNodes.size;
      const layoutConfig = {
        name: 'cose',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => nodeCount > 50 ? 6000 : 8000,
        idealEdgeLength: () => nodeCount > 50 ? 80 : 100,
        edgeElasticity: () => 100,
        gravity: 0.25,
        numIter: Math.min(250, 80 + nodeCount),
        // Add refresh rate to allow UI updates during layout
        refresh: 20,
      };

      const layout = cy.layout(layoutConfig);

      layout.on('layoutstop', () => {
        if (!isCancelled) {
          setIsLoading(false);
          setLoadingProgress('');
        }
      });

      layout.run();
    };

    initializeGraph().catch(err => {
      console.error('Failed to initialize graph:', err);
      setIsLoading(false);
      setLoadingProgress('グラフの初期化に失敗しました');
    });

    return () => {
      isCancelled = true;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [elements, onNodeClick, onEdgeClick, relevantNodes.size, relevantChannels.length]);

  // Update highlighting when dependencies change (only after initialization)
  useEffect(() => {
    if (!isInitialized || isLoading) return;
    
    // Defer highlighting to avoid blocking during initial load
    const timeoutId = setTimeout(() => {
      updateHighlighting();
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [updateHighlighting, isInitialized, isLoading]);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        position: 'relative',
      }}
    >
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          opacity: isLoading ? 0.3 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />
      {isLoading && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            pointerEvents: 'none',
          }}
        >
          <div 
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #334155',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div 
            style={{
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {loadingProgress || 'グラフを読み込み中...'}
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

