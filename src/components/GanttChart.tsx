import { useMemo, useState, useRef } from 'react';
import type { Payment, AttemptHistory } from '../types';
import { formatTime } from '../utils/dataParser';

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
}

export function GanttChart({ payments, onPaymentSelect, selectedPaymentId }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredAttempt, setHoveredAttempt] = useState<AttemptBar | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [filterSuccess, setFilterSuccess] = useState<'all' | 'success' | 'failed'>('all');
  const [showConnections, setShowConnections] = useState(true);

  // Calculate time range
  const timeRange = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    for (const payment of payments) {
      minTime = Math.min(minTime, payment.startTime);
      maxTime = Math.max(maxTime, payment.endTime);
      
      for (const attempt of payment.attemptsHistory) {
        maxTime = Math.max(maxTime, attempt.end_time);
      }
    }
    
    return { minTime, maxTime, duration: maxTime - minTime };
  }, [payments]);

  // Filter and prepare payment data
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      if (filterSuccess === 'all') return true;
      if (filterSuccess === 'success') return payment.isSuccess;
      return !payment.isSuccess;
    });
  }, [payments, filterSuccess]);

  // Generate attempt bars
  const attemptBars = useMemo(() => {
    const bars: AttemptBar[] = [];
    
    for (const payment of filteredPayments) {
      let previousEndTime = payment.startTime;
      
      for (let i = 0; i < payment.attemptsHistory.length; i++) {
        const attempt = payment.attemptsHistory[i];
        // Estimate start time: use previous attempt's end time or payment start time
        const startTime = i === 0 ? payment.startTime : previousEndTime;
        
        bars.push({
          paymentId: payment.id,
          attemptIndex: i,
          startTime,
          endTime: attempt.end_time,
          isSuccess: attempt.is_succeeded === 1,
          errorType: attempt.error_type,
          route: attempt.route,
          payment,
        });
        
        previousEndTime = attempt.end_time;
      }
    }
    
    return bars;
  }, [filteredPayments]);

  // Generate connections between related payments
  const connections = useMemo(() => {
    const conns: PaymentConnection[] = [];
    const paymentMap = new Map(payments.map(p => [p.id, p]));
    
    for (const payment of filteredPayments) {
      // Parent-child relationship (split payments)
      if (payment.parentPaymentId >= 0) {
        const parent = paymentMap.get(payment.parentPaymentId);
        if (parent && filteredPayments.includes(parent)) {
          conns.push({
            fromPaymentId: payment.parentPaymentId,
            toPaymentId: payment.id,
            type: 'parent-child',
          });
        }
      }
    }
    
    return conns;
  }, [payments, filteredPayments]);

  // Group payments by row (for y-axis positioning)
  const paymentRows = useMemo(() => {
    const rows = new Map<number, number>();
    filteredPayments.forEach((payment, index) => {
      rows.set(payment.id, index);
    });
    return rows;
  }, [filteredPayments]);

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
            {filteredPayments.map((payment, index) => (
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
            ))}
          </g>

          {/* Connections between related payments */}
          {showConnections && connections.map((conn, i) => {
            const fromRow = paymentRows.get(conn.fromPaymentId);
            const toRow = paymentRows.get(conn.toPaymentId);
            if (fromRow === undefined || toRow === undefined) return null;
            
            const fromPayment = payments.find(p => p.id === conn.fromPaymentId);
            const toPayment = payments.find(p => p.id === conn.toPaymentId);
            if (!fromPayment || !toPayment) return null;
            
            const fromY = headerHeight + fromRow * rowHeight + rowHeight / 2;
            const toY = headerHeight + toRow * rowHeight + rowHeight / 2;
            const fromX = timeToX(fromPayment.endTime);
            const toX = timeToX(toPayment.startTime);
            
            const midX = (fromX + toX) / 2;
            
            return (
              <g key={i} className="connection">
                <path
                  d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                  stroke={conn.type === 'parent-child' ? '#8b5cf6' : '#f59e0b'}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={conn.type === 'parent-child' ? '4,4' : 'none'}
                  opacity="0.6"
                />
                <circle
                  cx={toX}
                  cy={toY}
                  r="4"
                  fill={conn.type === 'parent-child' ? '#8b5cf6' : '#f59e0b'}
                />
              </g>
            );
          })}

          {/* Attempt bars */}
          {attemptBars.map((attempt, i) => {
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
                  {hoveredAttempt.route?.length > 0 
                    ? `${hoveredAttempt.route.length} ホップ` 
                    : 'ルートなし'}
                </span>
              </div>
              <div className="tooltip-row">
                <span className="label">金額</span>
                <span className="value amount">{hoveredAttempt.payment.amount.toLocaleString()} sats</span>
              </div>
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
          <span className="legend-line dashed purple"></span>
          <span>親子関係</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed orange"></span>
          <span>リトライ</span>
        </div>
      </div>
    </div>
  );
}
