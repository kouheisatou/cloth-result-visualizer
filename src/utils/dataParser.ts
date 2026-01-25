import Papa from 'papaparse';
import type { 
  Node, 
  Channel, 
  Edge, 
  Payment, 
  AttemptHistory,
  SimulationConfig,
  TimelineEvent 
} from '../types';

// Parse nodes CSV
export function parseNodes(csv: string): Node[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return result.data.map((row) => ({
    id: parseInt(row.id),
    openEdges: row.open_edges ? row.open_edges.split('-').map(Number) : [],
  }));
}

// Parse channels CSV
export function parseChannels(csv: string): Channel[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return result.data.map((row) => ({
    id: parseInt(row.id),
    edge1: parseInt(row.edge1),
    edge2: parseInt(row.edge2),
    node1: parseInt(row.node1),
    node2: parseInt(row.node2),
    capacity: parseInt(row.capacity),
    isClosed: row.is_closed === '1',
  }));
}

// Parse edges CSV
export function parseEdges(csv: string): Edge[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return result.data.map((row) => ({
    id: parseInt(row.id),
    channelId: parseInt(row.channel_id),
    counterEdgeId: parseInt(row.counter_edge_id),
    fromNodeId: parseInt(row.from_node_id),
    toNodeId: parseInt(row.to_node_id),
    balance: parseInt(row.balance),
    feeBase: parseInt(row.fee_base),
    feeProportional: parseInt(row.fee_proportional),
    minHtlc: parseInt(row.min_htlc),
    timelock: parseInt(row.timelock),
    isClosed: row.is_closed === '1',
    totFlows: parseFloat(row.tot_flows),
    culThreshold: parseFloat(row.cul_threshold),
    channelUpdates: parseInt(row.channel_updates),
    group: row.group === 'NULL' ? null : row.group,
  }));
}

// Parse payments CSV
export function parsePayments(csv: string): Payment[] {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  
  // First pass: parse all payments
  const payments: Payment[] = result.data.map((row) => {
    let attemptsHistory: AttemptHistory[] = [];
    
    if (row.attempts_history) {
      try {
        attemptsHistory = JSON.parse(row.attempts_history);
      } catch {
        console.warn(`Failed to parse attempts_history for payment ${row.id}`);
      }
    }

    return {
      id: parseInt(row.id),
      senderId: parseInt(row.sender_id),
      receiverId: parseInt(row.receiver_id),
      amount: parseInt(row.amount),
      startTime: parseInt(row.start_time),
      maxFeeLimit: parseInt(row.max_fee_limit),
      endTime: parseInt(row.end_time),
      mpp: parseInt(row.mpp),
      isShard: row.is_shard === '1',
      parentPaymentId: parseInt(row.parent_payment_id),
      shard1Id: parseInt(row.shard1_id),
      shard2Id: parseInt(row.shard2_id),
      isSuccess: row.is_success === '1',
      isRolledBack: row.is_rolledback === '1',
      noBalanceCount: parseInt(row.no_balance_count),
      offlineNodeCount: parseInt(row.offline_node_count),
      timeoutExp: parseInt(row.timeout_exp),
      attempts: parseInt(row.attempts),
      route: row.route ? row.route.split('-').map(Number).filter(n => !isNaN(n)) : [],
      totalFee: parseInt(row.total_fee),
      attemptsHistory,
    };
  });

  // Second pass: build parent-child relationships for multipath payments
  const paymentMap = new Map<number, Payment>();
  for (const payment of payments) {
    paymentMap.set(payment.id, payment);
  }

  for (const payment of payments) {
    if (payment.shard1Id >= 0 || payment.shard2Id >= 0) {
      const shards: Payment[] = [];
      if (payment.shard1Id >= 0) {
        const shard1 = paymentMap.get(payment.shard1Id);
        if (shard1) {
          shards.push(shard1);
        }
      }
      if (payment.shard2Id >= 0) {
        const shard2 = paymentMap.get(payment.shard2Id);
        if (shard2) {
          shards.push(shard2);
        }
      }
      if (shards.length > 0) {
        payment.childShards = shards;
      }
    }
  }

  return payments;
}

// Parse simulation config
export function parseConfig(text: string): SimulationConfig {
  const lines = text.split('\n');
  const config: Record<string, string> = {};
  
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value !== undefined) {
      config[key.trim()] = value.trim();
    }
  }

  return {
    generateNetworkFromFile: config.generate_network_from_file === 'true',
    nodesFilename: config.nodes_filename || '',
    channelsFilename: config.channels_filename || '',
    edgesFilename: config.edges_filename || '',
    nAdditionalNodes: config.n_additional_nodes ? parseInt(config.n_additional_nodes) : null,
    nChannelsPerNode: config.n_channels_per_node ? parseInt(config.n_channels_per_node) : null,
    capacityPerChannel: config.capacity_per_channel ? parseInt(config.capacity_per_channel) : null,
    faultyNodeProbability: parseFloat(config.faulty_node_probability) || 0,
    generatePaymentsFromFile: config.generate_payments_from_file === 'true',
    paymentTimeout: parseInt(config.payment_timeout) || 60000,
    averagePaymentForwardInterval: parseInt(config.average_payment_forward_interval) || 100,
    variancePaymentForwardInterval: parseInt(config.variance_payment_forward_interval) || 1,
    routingMethod: config.routing_method || '',
    groupSize: parseInt(config.group_size) || 5,
    groupLimitRate: parseFloat(config.group_limit_rate) || 0.1,
    groupCapUpdate: config.group_cap_update === 'true',
    groupBroadcastDelay: parseInt(config.group_broadcast_delay) || 0,
    paymentsFilename: config.payments_filename || '',
    paymentRate: parseInt(config.payment_rate) || 1,
    nPayments: parseInt(config.n_payments) || 5000,
    averagePaymentAmount: parseInt(config.average_payment_amount) || 100,
    variancePaymentAmount: parseInt(config.variance_payment_amount) || 10,
    averageMaxFeeLimit: parseInt(config.average_max_fee_limit) || -1,
    varianceMaxFeeLimit: parseInt(config.variance_max_fee_limit) || -1,
    enableFakeBalanceUpdate: config.enable_fake_balance_update === 'true',
    culThresholdDistAlpha: parseFloat(config.cul_threshold_dist_alpha) || 2,
    culThresholdDistBeta: parseFloat(config.cul_threshold_dist_beta) || 10,
    mpp: parseInt(config.mpp) || 1,
    maxShardCount: parseInt(config.max_shard_count) || 16,
  };
}

// Generate timeline events from payments
export function generateTimelineEvents(payments: Payment[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const payment of payments) {
    // Payment start event
    events.push({
      time: payment.startTime,
      type: 'payment_start',
      paymentId: payment.id,
    });

    // Process each attempt
    for (let i = 0; i < payment.attemptsHistory.length; i++) {
      const attempt = payment.attemptsHistory[i];
      
      if (attempt.route && attempt.route.length > 0) {
        events.push({
          time: attempt.end_time - 100, // Approximate attempt start time
          type: 'payment_attempt',
          paymentId: payment.id,
          attemptIndex: i,
          routeEdges: attempt.route.map(hop => hop.edge_id),
        });
      }

      if (attempt.is_succeeded) {
        events.push({
          time: attempt.end_time,
          type: 'payment_success',
          paymentId: payment.id,
          attemptIndex: i,
          routeEdges: attempt.route?.map(hop => hop.edge_id) || [],
        });
      } else if (attempt.error_edge > 0) {
        events.push({
          time: attempt.end_time,
          type: 'payment_fail',
          paymentId: payment.id,
          attemptIndex: i,
          errorEdge: attempt.error_edge,
        });
      }
    }
  }

  // Sort by time
  events.sort((a, b) => a.time - b.time);

  return events;
}

// Get unique timestamps from events
export function getTimeSteps(events: TimelineEvent[]): number[] {
  const times = new Set<number>();
  for (const event of events) {
    times.add(event.time);
  }
  return Array.from(times).sort((a, b) => a - b);
}

// Format satoshi amount (input is in msats)
export function formatSatoshi(msats: number): string {
  // Convert msats to sats (1 sat = 1000 msats)
  const sats = msats / 1000;
  
  if (sats >= 100_000_000) {
    return `${(sats / 100_000_000).toFixed(4)} BTC`;
  }
  if (sats >= 1_000_000) {
    return `${(sats / 1_000_000).toFixed(2)}M sats`;
  }
  if (sats >= 1_000) {
    return `${(sats / 1_000).toFixed(2)}K sats`;
  }
  if (sats >= 1) {
    return `${sats.toFixed(3)} sats`;
  }
  // For very small amounts, show in msats
  return `${msats} msats`;
}

// Format time in milliseconds to readable format
export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

