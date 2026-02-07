import { useMemo, useState, useRef } from 'react';
import type { Payment, AttemptHistory } from '../types';
import { formatTime, formatSatoshi } from '../utils/dataParser';

interface GanttChartProps {
  payments: Payment[];
  onPaymentSelect?: (payment: Payment) => void;
  selectedPaymentId?: number;
}

interface AttemptBar {
  paymentId: number;
  attemptIndex: number;
  startTime: number;
  endTime: number;
  isSuccess: boolean;
  errorType: number;
  route: AttemptHistory['route'];
  payment: Payment;
}

interface PaymentConnection {
  fromPaymentId: number;
  toPaymentId: number;
  type: 'parent-child' | 'retry';
  splitIndex?: number; // 0 for first shard, 1 for second shard
}

export function GanttChart({ payments, onPaymentSelect, selectedPaymentId }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredAttempt, setHoveredAttempt] = useState<AttemptBar | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [filterSuccess, setFilterSuccess] = useState<'all' | 'success' | 'failed'>('all');
  const [showConnections, setShowConnections] = useState(true);

  // Pre-process all data on initial load
  const preprocessedData = useMemo(() => {
    // Calculate time range
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    for (const payment of payments) {
      minTime = Math.min(minTime, payment.startTime);
      maxTime = Math.max(maxTime, payment.endTime);
      
      for (const attempt of payment.attemptsHistory) {
        maxTime = Math.max(maxTime, attempt.end_time);
      }
    }
    
    const timeRange = { minTime, maxTime, duration: maxTime - minTime };

    // Sort payments by start time
    const sortedPayments = [...payments].sort((a, b) => a.startTime - b.startTime);

    // Create payment map
    const paymentMap = new Map(payments.map(p => [p.id, p]));

    // Pre-generate all attempt bars
    const allAttemptBars = new Map<number, AttemptBar[]>();
    
    for (const payment of sortedPayments) {
      const bars: AttemptBar[] = [];
      let previousEndTime = payment.startTime;
      
      for (let i = 0; i < payment.attemptsHistory.length; i++) {
        const attempt = payment.attemptsHistory[i];
        const startTime = i === 0 ? payment.startTime : previousEndTime;
        
        bars.push({
          paymentId: payment.id,
          attemptIndex: i,
          startTime,
          endTime: attempt.end_time,
          isSuccess: attempt.is_succeeded === 1,
          errorType: attempt.error_type || 0,
          route: attempt.route,
          payment,
        });
        
        previousEndTime = attempt.end_time;
      }
      
      allAttemptBars.set(payment.id, bars);
    }

    return {
      timeRange,
      sortedPayments,
      paymentMap,
      allAttemptBars
    };
  }, [payments]);

  // Filter payments based on current filter
  const filteredPayments = useMemo(() => {
    return preprocessedData.sortedPayments.filter(payment => {
      if (filterSuccess === 'all') return true;
      if (filterSuccess === 'success') return payment.isSuccess;
      return !payment.isSuccess;
    });
  }, [preprocessedData, filterSuccess]);

  // Get attempt bars for filtered payments
  const attemptBars = useMemo(() => {
    const bars: AttemptBar[] = [];
    for (const payment of filteredPayments) {
      const paymentBars = preprocessedData.allAttemptBars.get(payment.id);
      if (paymentBars) {
        bars.push(...paymentBars);
      }
    }
    return bars;
  }, [preprocessedData, filteredPayments]);

  // Generate connections between related payments
  const connections = useMemo(() => {
    const conns: PaymentConnection[] = [];
    const filteredSet = new Set(filteredPayments.map(p => p.id));
    
    for (const payment of filteredPayments) {
      // Parent to child relationship (split payments)
      if (payment.shards) {
        const shardIds = payment.shards.split('-').map(Number).filter(n => !isNaN(n));
        shardIds.forEach((shardId, index) => {
          const shard = preprocessedData.paymentMap.get(shardId);
          if (shard && filteredSet.has(shard.id)) {
            conns.push({
              fromPaymentId: payment.id,
              toPaymentId: shard.id,
              type: 'parent-child',
              splitIndex: index,
            });
          }
        });
      }
    }
    
    return conns;
  }, [preprocessedData, filteredPayments]);

  // Group payments by row (for y-axis positioning)
  const paymentRows = useMemo(() => {
    const rows = new Map<number, number>();
    filteredPayments.forEach((payment, index) => {
      rows.set(payment.id, index);
    });
    return rows;
  }, [filteredPayments]);

  const timeRange = preprocessedData.timeRange;

  // Chart dimensions
  const chartWidth = Math.max(2000 * zoom, 800);
  const rowHeight = 40;
  const headerHeight = 60;
  const chartHeight = filteredPayments.length * rowHeight + headerHeight;
  const labelWidth = 100;

  // Time to X position
  const timeToX = (time: number): number => {
    const normalizedTime = (time - timeRange.minTime) / timeRange.duration;
    return labelWidth + normalizedTime * (chartWidth - labelWidth - 20);
  };

  // Generate time ticks for the axis
  const timeTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = timeRange.duration / (10 * zoom);
    for (let t = timeRange.minTime; t <= timeRange.maxTime; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [timeRange, zoom]);

  const handleMouseMove = (e: React.MouseEvent, attempt: AttemptBar) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: e.clientX - rect.left + 10,
        y: e.clientY - rect.top - 10,
      });
    }
    setHoveredAttempt(attempt);
  };

  const handleMouseLeave = () => {
    setHoveredAttempt(null);
  };

  const handleBarClick = (attempt: AttemptBar) => {
    onPaymentSelect?.(attempt.payment);
  };

  // Get error type label
  const getErrorLabel = (errorType: number): string => {
    const errorTypes: Record<number, string> = {
      0: 'なし',
      1: '残高不足',
      2: 'オフライン',
      3: 'タイムアウト',
      4: '手数料超過',
    };
    return errorTypes[errorType] || `エラー${errorType}`;
  };

  return (
    <div className="gantt-chart">
      <div className="gantt-header">
        <h3>ペイメント試行 ガントチャート</h3>
        <div className="gantt-controls">
          <div className="filter-group">
            <label>フィルター:</label>
            <select value={filterSuccess} onChange={e => setFilterSuccess(e.target.value as any)}>
              <option value="all">すべて</option>
              <option value="success">成功のみ</option>
              <option value="failed">失敗のみ</option>
            </select>
          </div>
          <div className="zoom-group">
            <label>ズーム:</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
            />
            <span>{zoom.toFixed(1)}x</span>
          </div>
          <label className="connection-toggle">
            <input
              type="checkbox"
              checked={showConnections}
              onChange={e => setShowConnections(e.target.checked)}
            />
            関連を表示
          </label>
        </div>
      </div>
      
      <div className="gantt-stats">
        <span>表示中: {filteredPayments.length} ペイメント</span>
        <span>試行数: {attemptBars.length}</span>
        <span>時間範囲: {formatTime(timeRange.minTime)} - {formatTime(timeRange.maxTime)}</span>
      </div>

      <div 
        className="gantt-container" 
        ref={containerRef}
      >
        <svg width={chartWidth} height={chartHeight}>
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="50" height={rowHeight} patternUnits="userSpaceOnUse">
              <path d={`M 50 0 L 0 0 0 ${rowHeight}`} fill="none" stroke="#1f2937" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x={labelWidth} y={headerHeight} width={chartWidth - labelWidth} height={chartHeight - headerHeight} fill="url(#grid)"/>
          
          {/* Time axis */}
          <g className="time-axis">
            {timeTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={timeToX(tick)}
                  y1={headerHeight}
                  x2={timeToX(tick)}
                  y2={chartHeight}
                  stroke="#374151"
                  strokeWidth="0.5"
                  strokeDasharray="4,4"
                />
                <text
                  x={timeToX(tick)}
                  y={headerHeight - 10}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="11"
                >
                  {formatTime(tick)}
                </text>
              </g>
            ))}
          </g>

          {/* Payment labels (Y-axis) */}
          <g className="payment-labels">
            {filteredPayments.map((payment, index) => {
              const hasSplits = payment.shards && payment.shards.length > 0;
              const isShard = payment.isShard;
              
              return (
                <g key={payment.id}>
                  <rect
                    x="0"
                    y={headerHeight + index * rowHeight}
                    width={labelWidth - 5}
                    height={rowHeight}
                    fill={selectedPaymentId === payment.id ? '#1e3a5f' : 'transparent'}
                    onClick={() => onPaymentSelect?.(payment)}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Shard indicator (child payment) */}
                  {isShard && (
                    <>
                      <text
                        x={8}
                        y={headerHeight + index * rowHeight + rowHeight / 2 + 4}
                        fill="#8b5cf6"
                        fontSize="10"
                      >
                        └
                      </text>
                    </>
                  )}
                  {/* Split indicator (parent payment) */}
                  {hasSplits && (
                    <polygon
                      points={`${labelWidth - 70},${headerHeight + index * rowHeight + rowHeight / 2 - 4} ${labelWidth - 66},${headerHeight + index * rowHeight + rowHeight / 2} ${labelWidth - 70},${headerHeight + index * rowHeight + rowHeight / 2 + 4} ${labelWidth - 74},${headerHeight + index * rowHeight + rowHeight / 2}`}
                      fill="#8b5cf6"
                    />
                  )}
                  <text
                    x={labelWidth - 10}
                    y={headerHeight + index * rowHeight + rowHeight / 2 + 4}
                    textAnchor="end"
                    fill={payment.isSuccess ? '#22c55e' : '#ef4444'}
                    fontSize="12"
                    fontFamily="monospace"
                  >
                    #{payment.id}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Connections between related payments (parent-child split) */}
          {showConnections && (() => {
            // Group connections by parent to draw split markers
            const connectionsByParent = new Map<number, PaymentConnection[]>();
            for (const conn of connections) {
              const existing = connectionsByParent.get(conn.fromPaymentId) || [];
              existing.push(conn);
              connectionsByParent.set(conn.fromPaymentId, existing);
            }
            
            const elements: React.ReactNode[] = [];
            
            connectionsByParent.forEach((conns, parentId) => {
              const parentRow = paymentRows.get(parentId);
              const parentPayment = payments.find(p => p.id === parentId);
              if (parentRow === undefined || !parentPayment) return;
              
              const parentY = headerHeight + parentRow * rowHeight + rowHeight / 2;
              // Split point is near the start of parent payment (or slightly after)
              const splitX = timeToX(parentPayment.startTime) + 20;
              
              // Draw split marker on parent
              elements.push(
                <g key={`split-marker-${parentId}`} className="split-marker">
                  {/* Split point diamond marker */}
                  <polygon
                    points={`${splitX},${parentY - 6} ${splitX + 6},${parentY} ${splitX},${parentY + 6} ${splitX - 6},${parentY}`}
                    fill="#8b5cf6"
                    stroke="#a78bfa"
                    strokeWidth="1"
                  />
                  {/* Vertical line from split point */}
                  <line
                    x1={splitX}
                    y1={parentY + 6}
                    x2={splitX}
                    y2={parentY + (conns.length > 1 ? 50 : 30)}
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    opacity="0.7"
                  />
                </g>
              );
              
              // Draw connections to each child shard
              conns.forEach((conn, idx) => {
                const toRow = paymentRows.get(conn.toPaymentId);
                const toPayment = payments.find(p => p.id === conn.toPaymentId);
                if (toRow === undefined || !toPayment) return;
                
                const toY = headerHeight + toRow * rowHeight + rowHeight / 2;
                const toX = timeToX(toPayment.startTime);
                
                // Calculate curve control points
                const startY = parentY + (idx === 0 ? -3 : 3); // Offset to separate lines
                const controlY1 = startY + (toY - startY) * 0.3;
                const controlY2 = toY - (toY - startY) * 0.3;
                
                elements.push(
                  <g key={`connection-${conn.fromPaymentId}-${conn.toPaymentId}`} className="connection">
                    {/* Connection path from split point to child */}
                    <path
                      d={`M ${splitX} ${startY} C ${splitX} ${controlY1}, ${toX - 20} ${controlY2}, ${toX} ${toY}`}
                      stroke={conn.splitIndex === 0 ? '#8b5cf6' : '#a78bfa'}
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="6,3"
                      opacity="0.8"
                    />
                    {/* Arrow at child end */}
                    <polygon
                      points={`${toX},${toY} ${toX - 8},${toY - 4} ${toX - 8},${toY + 4}`}
                      fill={conn.splitIndex === 0 ? '#8b5cf6' : '#a78bfa'}
                    />
                    {/* Child shard indicator circle */}
                    <circle
                      cx={toX + 2}
                      cy={toY}
                      r="5"
                      fill="none"
                      stroke={conn.splitIndex === 0 ? '#8b5cf6' : '#a78bfa'}
                      strokeWidth="2"
                    />
                    {/* Shard number label */}
                    <text
                      x={splitX + 12}
                      y={startY + (toY - startY) * 0.2}
                      fill={conn.splitIndex === 0 ? '#8b5cf6' : '#a78bfa'}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      S{(conn.splitIndex ?? 0) + 1}
                    </text>
                  </g>
                );
              });
            });
            
            return elements;
          })()}

          {/* Attempt bars */}
          {attemptBars.map((attempt) => {
            const row = paymentRows.get(attempt.paymentId);
            if (row === undefined) return null;
            
            const y = headerHeight + row * rowHeight + 8;
            const x = timeToX(attempt.startTime);
            const width = Math.max(timeToX(attempt.endTime) - x, 4);
            const height = rowHeight - 16;
            
            const isHovered = hoveredAttempt?.paymentId === attempt.paymentId && 
                             hoveredAttempt?.attemptIndex === attempt.attemptIndex;
            const isSelected = selectedPaymentId === attempt.paymentId;
            
            let barColor = attempt.isSuccess ? '#22c55e' : '#ef4444';
            if (attempt.errorType === 1) barColor = '#f59e0b'; // No balance
            if (attempt.errorType === 2) barColor = '#6b7280'; // Offline
            
            return (
              <g key={`${attempt.paymentId}-${attempt.attemptIndex}`}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx="4"
                  fill={barColor}
                  opacity={isHovered || isSelected ? 1 : 0.7}
                  stroke={isSelected ? '#3b82f6' : isHovered ? '#fff' : 'none'}
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                  onMouseMove={(e) => handleMouseMove(e, attempt)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleBarClick(attempt)}
                />
                {/* Attempt number label */}
                {width > 20 && (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {attempt.attemptIndex + 1}
                  </text>
                )}
                
                {/* Connection line between attempts of same payment */}
                {attempt.attemptIndex > 0 && (() => {
                  const prevAttempt = attemptBars.find(
                    a => a.paymentId === attempt.paymentId && a.attemptIndex === attempt.attemptIndex - 1
                  );
                  if (!prevAttempt) return null;
                  
                  const prevX = timeToX(prevAttempt.endTime);
                  const currX = x;
                  const midY = y + height / 2;
                  
                  return (
                    <line
                      x1={prevX}
                      y1={midY}
                      x2={currX}
                      y2={midY}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="3,3"
                      opacity="0.8"
                    />
                  );
                })()}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredAttempt && (
          <div 
            className="gantt-tooltip"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
            }}
          >
            <div className="tooltip-header">
              <span className="payment-id">Payment #{hoveredAttempt.paymentId}</span>
              <span className={`attempt-status ${hoveredAttempt.isSuccess ? 'success' : 'failed'}`}>
                {hoveredAttempt.isSuccess ? '成功' : '失敗'}
              </span>
            </div>
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span className="label">試行</span>
                <span className="value">{hoveredAttempt.attemptIndex + 1} / {hoveredAttempt.payment.attemptsHistory.length}</span>
              </div>
              <div className="tooltip-row">
                <span className="label">開始時刻</span>
                <span className="value">{formatTime(hoveredAttempt.startTime)}</span>
              </div>
              <div className="tooltip-row">
                <span className="label">終了時刻</span>
                <span className="value">{formatTime(hoveredAttempt.endTime)}</span>
              </div>
              <div className="tooltip-row">
                <span className="label">所要時間</span>
                <span className="value">{formatTime(hoveredAttempt.endTime - hoveredAttempt.startTime)}</span>
              </div>
              {!hoveredAttempt.isSuccess && (
                <div className="tooltip-row">
                  <span className="label">エラー</span>
                  <span className="value error">{getErrorLabel(hoveredAttempt.errorType)}</span>
                </div>
              )}
              <div className="tooltip-row">
                <span className="label">ルート</span>
                <span className="value">
                  {hoveredAttempt.route && hoveredAttempt.route.length > 0
                    ? `${hoveredAttempt.route.length} ホップ`
                    : 'ルートなし'}
                </span>
              </div>
              <div className="tooltip-row">
                <span className="label">金額</span>
                <span className="value amount">{formatSatoshi(hoveredAttempt.payment.amount)}</span>
              </div>
              {hoveredAttempt.payment.isShard && (
                <div className="tooltip-row">
                  <span className="label">シャード</span>
                  <span className="value shard">親: #{hoveredAttempt.payment.parentPaymentId}</span>
                </div>
              )}
              {hoveredAttempt.payment.shards && hoveredAttempt.payment.shards.length > 0 && (
                <div className="tooltip-row">
                  <span className="label">分割先</span>
                  <span className="value shard">{hoveredAttempt.payment.shards}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="gantt-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#22c55e' }}></span>
          <span>成功</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#ef4444' }}></span>
          <span>失敗</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#f59e0b' }}></span>
          <span>残高不足</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#6b7280' }}></span>
          <span>オフライン</span>
        </div>
        <div className="legend-item">
          <svg width="14" height="14" style={{ marginRight: '4px' }}>
            <polygon points="7,1 13,7 7,13 1,7" fill="#8b5cf6" />
          </svg>
          <span>分割点</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed purple"></span>
          <span>親→子シャード</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed orange"></span>
          <span>リトライ</span>
        </div>
      </div>
    </div>
  );
}
