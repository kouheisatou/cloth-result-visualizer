import { useMemo, useRef, useEffect } from 'react';
import type { Edge, Channel, Payment } from '../types';
import './EntityDetail.css';

interface EdgeDetailProps {
  edgeId: number | null;
  edges: Edge[];
  channels: Channel[];
  payments: Payment[];
  onNodeClick?: (nodeId: number) => void;
  onChannelClick?: (channelId: number) => void;
}

interface CapacityPoint {
  time: number;
  capacity: number;
  paymentId: number;
  sentAmount: number;
}

export function EdgeDetail({ 
  edgeId, 
  edges, 
  channels, 
  payments,
  onNodeClick,
  onChannelClick,
}: EdgeDetailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const edge = useMemo(() => {
    if (edgeId === null) return null;
    return edges.find(e => e.id === edgeId) || null;
  }, [edgeId, edges]);

  const channel = useMemo(() => {
    if (!edge) return null;
    return channels.find(ch => ch.id === edge.channelId) || null;
  }, [edge, channels]);

  const counterEdge = useMemo(() => {
    if (!edge) return null;
    return edges.find(e => e.id === edge.counterEdgeId) || null;
  }, [edge, edges]);

  // Calculate capacity history
  const capacityHistory = useMemo((): CapacityPoint[] => {
    if (!edge) return [];
    
    const history: CapacityPoint[] = [];

    for (const payment of payments) {
      for (const attempt of payment.attemptsHistory) {
        for (const hop of attempt.route || []) {
          if (hop.edge_id === edge.id) {
            history.push({
              time: attempt.end_time,
              capacity: hop.edge_cap,
              paymentId: payment.id,
              sentAmount: hop.sent_amt,
            });
          }
        }
      }
    }

    history.sort((a, b) => a.time - b.time);
    return history;
  }, [edge, payments]);

  // Calculate usage stats
  const usageStats = useMemo(() => {
    if (!edge) return { usageCount: 0, failureCount: 0, totalSent: 0 };
    
    let usageCount = 0;
    let failureCount = 0;
    let totalSent = 0;

    for (const payment of payments) {
      for (const attempt of payment.attemptsHistory) {
        for (const hop of attempt.route || []) {
          if (hop.edge_id === edge.id) {
            usageCount++;
            totalSent += hop.sent_amt;
          }
        }
        if (attempt.error_edge === edge.id) {
          failureCount++;
        }
      }
    }

    return { usageCount, failureCount, totalSent };
  }, [edge, payments]);

  // Draw capacity history chart
  useEffect(() => {
    if (!canvasRef.current || capacityHistory.length < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Calculate scales
    const minTime = capacityHistory[0].time;
    const maxTime = capacityHistory[capacityHistory.length - 1].time;
    const timeRange = maxTime - minTime || 1;

    const minCap = Math.min(...capacityHistory.map(p => p.capacity));
    const maxCap = Math.max(...capacityHistory.map(p => p.capacity));
    const capRange = maxCap - minCap || 1;
    const capPadding = capRange * 0.1;

    const scaleX = (time: number) => padding.left + ((time - minTime) / timeRange) * chartWidth;
    const scaleY = (cap: number) => padding.top + chartHeight - ((cap - minCap + capPadding) / (capRange + capPadding * 2)) * chartHeight;

    // Draw grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw axes
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    
    // Y axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw Y axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = minCap + (capRange / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      const label = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : 
                    value >= 1000 ? `${(value / 1000).toFixed(0)}K` : 
                    value.toFixed(0);
      ctx.fillText(label, padding.left - 5, y + 4);
    }

    // Draw X axis labels
    ctx.textAlign = 'center';
    const timeLabels = 5;
    for (let i = 0; i <= timeLabels; i++) {
      const time = minTime + (timeRange / timeLabels) * i;
      const x = scaleX(time);
      const seconds = (time / 1000).toFixed(1);
      ctx.fillText(`${seconds}s`, x, height - padding.bottom + 15);
    }

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    capacityHistory.forEach((point, i) => {
      const x = scaleX(point.time);
      const y = scaleY(point.capacity);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw fill
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.beginPath();
    ctx.moveTo(scaleX(capacityHistory[0].time), height - padding.bottom);
    capacityHistory.forEach(point => {
      ctx.lineTo(scaleX(point.time), scaleY(point.capacity));
    });
    ctx.lineTo(scaleX(capacityHistory[capacityHistory.length - 1].time), height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw points
    ctx.fillStyle = '#3b82f6';
    capacityHistory.forEach(point => {
      const x = scaleX(point.time);
      const y = scaleY(point.capacity);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw title
    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('容量変化履歴', padding.left, 14);

  }, [capacityHistory]);

  const formatCapacity = (msats: number) => {
    const sats = msats / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(2)}K sats`;
    return `${sats.toFixed(0)} sats`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  if (!edge) {
    return (
      <div className="entity-detail empty">
        <p>エッジを選択してください</p>
        <p className="hint">左のリストからエッジをクリック、またはネットワークグラフのリンクをクリックしてください</p>
      </div>
    );
  }

  return (
    <div className="entity-detail">
      <div className="detail-header">
        <h3>Edge #{edge.id}</h3>
        <span className={`status-badge ${edge.isClosed ? 'closed' : 'open'}`}>
          {edge.isClosed ? 'クローズ' : 'オープン'}
        </span>
      </div>

      <div className="detail-section">
        <h4>方向</h4>
        <div className="edge-direction-display">
          <span 
            className="node-link clickable"
            onClick={() => onNodeClick?.(edge.fromNodeId)}
          >
            Node #{edge.fromNodeId}
          </span>
          <span className="direction-arrow">→</span>
          <span 
            className="node-link clickable"
            onClick={() => onNodeClick?.(edge.toNodeId)}
          >
            Node #{edge.toNodeId}
          </span>
        </div>
      </div>

      <div className="detail-section">
        <h4>基本情報</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">残高</span>
            <span className="info-value balance">{formatCapacity(edge.balance)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">チャネル</span>
            <span 
              className="info-value clickable"
              onClick={() => onChannelClick?.(edge.channelId)}
            >
              #{edge.channelId}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">反対エッジ</span>
            <span className="info-value">#{edge.counterEdgeId}</span>
          </div>
          <div className="info-item">
            <span className="info-label">基本手数料</span>
            <span className="info-value">{edge.feeBase} msat</span>
          </div>
          <div className="info-item">
            <span className="info-label">比例手数料</span>
            <span className="info-value">{edge.feeProportional} ppm</span>
          </div>
          <div className="info-item">
            <span className="info-label">最小HTLC</span>
            <span className="info-value">{edge.minHtlc} msat</span>
          </div>
          <div className="info-item">
            <span className="info-label">タイムロック</span>
            <span className="info-value">{edge.timelock} blocks</span>
          </div>
          <div className="info-item">
            <span className="info-label">更新回数</span>
            <span className="info-value">{edge.channelUpdates}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>使用統計</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">使用回数</span>
            <span className="info-value">{usageStats.usageCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">失敗回数</span>
            <span className={`info-value ${usageStats.failureCount > 0 ? 'error' : ''}`}>
              {usageStats.failureCount}
            </span>
          </div>
          <div className="info-item full-width">
            <span className="info-label">累計送金額</span>
            <span className="info-value">{formatCapacity(usageStats.totalSent)}</span>
          </div>
        </div>
      </div>

      {capacityHistory.length >= 2 && (
        <div className="detail-section">
          <h4>容量変化グラフ</h4>
          <div className="capacity-chart-container">
            <canvas ref={canvasRef} className="capacity-chart" />
          </div>
          <div className="chart-summary">
            <span>データポイント: {capacityHistory.length}</span>
            <span>期間: {formatTime(capacityHistory[capacityHistory.length - 1].time - capacityHistory[0].time)}</span>
          </div>
        </div>
      )}

      {capacityHistory.length > 0 && (
        <div className="detail-section">
          <h4>容量変化履歴 ({capacityHistory.length})</h4>
          <div className="history-list">
            {capacityHistory.slice(-20).reverse().map((point, i) => (
              <div key={i} className="history-item">
                <span className="history-time">{formatTime(point.time)}</span>
                <span className="history-payment">Payment #{point.paymentId}</span>
                <span className="history-capacity">{formatCapacity(point.capacity)}</span>
                <span className="history-sent">-{formatCapacity(point.sentAmount)}</span>
              </div>
            ))}
            {capacityHistory.length > 20 && (
              <div className="more-items">...他 {capacityHistory.length - 20} 件</div>
            )}
          </div>
        </div>
      )}

      {channel && counterEdge && (
        <div className="detail-section">
          <h4>チャネル残高比較</h4>
          <div className="balance-comparison">
            <div className="balance-bar">
              <div 
                className="balance-fill this-edge" 
                style={{ width: `${(edge.balance / (edge.balance + counterEdge.balance)) * 100}%` }}
              />
              <div 
                className="balance-fill counter-edge" 
                style={{ width: `${(counterEdge.balance / (edge.balance + counterEdge.balance)) * 100}%` }}
              />
            </div>
            <div className="balance-labels">
              <span>このエッジ: {formatCapacity(edge.balance)}</span>
              <span>反対エッジ: {formatCapacity(counterEdge.balance)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
