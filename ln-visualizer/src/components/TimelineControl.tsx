import { useCallback, useEffect, useState } from 'react';
import type { TimelineEvent, Payment } from '../types';
import { formatTime } from '../utils/dataParser';

interface TimelineControlProps {
  events: TimelineEvent[];
  payments: Payment[];
  currentStepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onPaymentSelect: (payment: Payment | null) => void;
}

export function TimelineControl({
  events,
  payments,
  currentStepIndex,
  onStepChange,
  onPaymentSelect,
}: TimelineControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(500); // ms between steps

  const currentEvent = events[currentStepIndex];
  const currentPayment = currentEvent 
    ? payments.find(p => p.id === currentEvent.paymentId) 
    : null;

  // Step navigation
  const goToStart = useCallback(() => {
    onStepChange(0);
    onPaymentSelect(null);
  }, [onStepChange, onPaymentSelect]);

  const goToEnd = useCallback(() => {
    onStepChange(events.length - 1);
  }, [onStepChange, events.length]);

  const stepForward = useCallback(() => {
    if (currentStepIndex < events.length - 1) {
      const nextIndex = currentStepIndex + 1;
      onStepChange(nextIndex);
      const nextPayment = payments.find(p => p.id === events[nextIndex].paymentId);
      if (nextPayment) {
        onPaymentSelect(nextPayment);
      }
    }
  }, [currentStepIndex, events, payments, onStepChange, onPaymentSelect]);

  const stepBackward = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      onStepChange(prevIndex);
      const prevPayment = payments.find(p => p.id === events[prevIndex].paymentId);
      if (prevPayment) {
        onPaymentSelect(prevPayment);
      }
    }
  }, [currentStepIndex, events, payments, onStepChange, onPaymentSelect]);

  // Jump to specific payment
  const jumpToPayment = useCallback((paymentId: number) => {
    const eventIndex = events.findIndex(e => e.paymentId === paymentId && e.type === 'payment_start');
    if (eventIndex !== -1) {
      onStepChange(eventIndex);
      const payment = payments.find(p => p.id === paymentId);
      if (payment) {
        onPaymentSelect(payment);
      }
    }
  }, [events, payments, onStepChange, onPaymentSelect]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      if (currentStepIndex < events.length - 1) {
        stepForward();
      } else {
        setIsPlaying(false);
      }
    }, playSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex, events.length, playSpeed, stepForward]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        stepForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepBackward();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStart();
      } else if (e.key === 'End') {
        e.preventDefault();
        goToEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepForward, stepBackward, goToStart, goToEnd]);

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'payment_start': return '開始';
      case 'payment_attempt': return '試行';
      case 'payment_success': return '成功';
      case 'payment_fail': return '失敗';
      default: return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'payment_start': return '#3b82f6';
      case 'payment_attempt': return '#f59e0b';
      case 'payment_success': return '#22c55e';
      case 'payment_fail': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="timeline-control">
      <div className="timeline-header">
        <h3>タイムライン制御</h3>
        <span className="step-counter">
          ステップ {currentStepIndex + 1} / {events.length}
        </span>
      </div>

      {/* Playback Controls */}
      <div className="playback-controls">
        <button onClick={goToStart} title="最初へ (Home)">
          ⏮
        </button>
        <button onClick={stepBackward} title="前へ (←)">
          ⏪
        </button>
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={isPlaying ? 'playing' : ''}
          title={isPlaying ? '停止' : '再生 (Space)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={stepForward} title="次へ (→)">
          ⏩
        </button>
        <button onClick={goToEnd} title="最後へ (End)">
          ⏭
        </button>

        <div className="speed-control">
          <label>速度:</label>
          <select 
            value={playSpeed} 
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
          >
            <option value={1000}>0.5x</option>
            <option value={500}>1x</option>
            <option value={250}>2x</option>
            <option value={100}>5x</option>
            <option value={50}>10x</option>
          </select>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={currentStepIndex}
          onChange={(e) => {
            const index = Number(e.target.value);
            onStepChange(index);
            const payment = payments.find(p => p.id === events[index].paymentId);
            if (payment) {
              onPaymentSelect(payment);
            }
          }}
          className="progress-slider"
        />
        <div className="time-info">
          {currentEvent && (
            <span>時刻: {formatTime(currentEvent.time)}</span>
          )}
        </div>
      </div>

      {/* Current Event Info */}
      {currentEvent && (
        <div className="current-event">
          <div 
            className="event-badge"
            style={{ backgroundColor: getEventTypeColor(currentEvent.type) }}
          >
            {getEventTypeLabel(currentEvent.type)}
          </div>
          <span className="event-info">
            Payment #{currentEvent.paymentId}
            {currentEvent.attemptIndex !== undefined && 
              ` (試行 ${currentEvent.attemptIndex + 1})`
            }
          </span>
        </div>
      )}

      {/* Payment Quick Jump */}
      <div className="payment-jump">
        <label>ペイメント選択:</label>
        <select 
          value={currentPayment?.id ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (!isNaN(id)) {
              jumpToPayment(id);
            }
          }}
        >
          <option value="">-- 選択 --</option>
          {payments.map(p => (
            <option key={p.id} value={p.id}>
              #{p.id}: {p.senderId} → {p.receiverId} 
              {p.isSuccess ? ' ✓' : ' ✗'}
            </option>
          ))}
        </select>
      </div>

      {/* Event List (recent events) */}
      <div className="event-list">
        <h4>イベント履歴</h4>
        <div className="events-scroll">
          {events.slice(Math.max(0, currentStepIndex - 5), currentStepIndex + 6).map((event, idx) => {
            const actualIndex = Math.max(0, currentStepIndex - 5) + idx;
            const isCurrent = actualIndex === currentStepIndex;
            
            return (
              <div 
                key={`${event.time}-${event.paymentId}-${idx}`}
                className={`event-item ${isCurrent ? 'current' : ''}`}
                onClick={() => {
                  onStepChange(actualIndex);
                  const payment = payments.find(p => p.id === event.paymentId);
                  if (payment) {
                    onPaymentSelect(payment);
                  }
                }}
              >
                <span 
                  className="event-type-dot"
                  style={{ backgroundColor: getEventTypeColor(event.type) }}
                />
                <span className="event-time">{formatTime(event.time)}</span>
                <span className="event-label">
                  #{event.paymentId} {getEventTypeLabel(event.type)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

