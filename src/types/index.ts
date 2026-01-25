// Node data
export interface Node {
  id: number;
  openEdges: number[];
}

// Channel data
export interface Channel {
  id: number;
  edge1: number;
  edge2: number;
  node1: number;
  node2: number;
  capacity: number;
  isClosed: boolean;
}

// Edge data
export interface Edge {
  id: number;
  channelId: number;
  counterEdgeId: number;
  fromNodeId: number;
  toNodeId: number;
  balance: number;
  feeBase: number;
  feeProportional: number;
  minHtlc: number;
  timelock: number;
  isClosed: boolean;
  totFlows: number;
  culThreshold: number;
  channelUpdates: number;
  group: string | null;
}

// Route hop in a payment attempt
export interface RouteHop {
  edge_id: number;
  from_node_id: number;
  to_node_id: number;
  sent_amt: number;
  edge_cap: number;
  channel_cap: number;
  group_cap: number | null;
  channel_update: number;
}

// Payment attempt history
export interface AttemptHistory {
  attempts: number;
  is_succeeded: number;
  end_time: number;
  error_edge: number;
  error_type: number;
  split_depth: number;
  split_occurred: number;
  split_reason: string | null;
  child_shard_id1: number | null;
  child_shard_id2: number | null;
  child_shard_amount1: number | null;
  child_shard_amount2: number | null;
  route: RouteHop[];
}

// Payment data
export interface Payment {
  id: number;
  senderId: number;
  receiverId: number;
  amount: number;
  startTime: number;
  maxFeeLimit: number;
  endTime: number;
  mpp: number;
  isSuccess: boolean;
  noBalanceCount: number;
  offlineNodeCount: number;
  timeoutExp: number;
  attempts: number;
  route: number[]; // edge IDs
  totalFee: number;
  parentPaymentId: number;
  splitDepth: number;
  isRolledBack: boolean;
  attemptsHistory: AttemptHistory[];
}

// Simulation config
export interface SimulationConfig {
  generateNetworkFromFile: boolean;
  nodesFilename: string;
  channelsFilename: string;
  edgesFilename: string;
  nAdditionalNodes: number | null;
  nChannelsPerNode: number | null;
  capacityPerChannel: number | null;
  faultyNodeProbability: number;
  generatePaymentsFromFile: boolean;
  paymentTimeout: number;
  averagePaymentForwardInterval: number;
  variancePaymentForwardInterval: number;
  routingMethod: string;
  groupSize: number;
  groupLimitRate: number;
  groupCapUpdate: boolean;
  groupBroadcastDelay: number;
  paymentsFilename: string;
  paymentRate: number;
  nPayments: number;
  averagePaymentAmount: number;
  variancePaymentAmount: number;
  averageMaxFeeLimit: number;
  varianceMaxFeeLimit: number;
  enableFakeBalanceUpdate: boolean;
  culThresholdDistAlpha: number;
  culThresholdDistBeta: number;
  mpp: number;
  maxShardCount: number;
}

// Timeline event types
export type TimelineEventType = 
  | 'payment_start'
  | 'payment_attempt'
  | 'payment_success'
  | 'payment_fail';

// Timeline event
export interface TimelineEvent {
  time: number;
  type: TimelineEventType;
  paymentId: number;
  attemptIndex?: number;
  routeEdges?: number[];
  errorEdge?: number;
}

// Network state at a point in time
export interface NetworkState {
  time: number;
  activePayments: number[];
  highlightedEdges: Map<number, 'active' | 'success' | 'fail'>;
  highlightedNodes: Set<number>;
}

