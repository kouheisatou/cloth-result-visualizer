import type { Payment, SimulationConfig, Node, Channel, Edge } from '../types';
import { formatSatoshi, formatTime } from '../utils/dataParser';
import './SimulationOverview.css';

interface SimulationOverviewProps {
  payments: Payment[];
  config: SimulationConfig;
  nodes: Node[];
  channels: Channel[];
  edges: Edge[];
}

export function SimulationOverview({ payments, config, nodes, channels, edges }: SimulationOverviewProps) {
  // Separate root payments from shards
  const rootPayments = payments.filter(p => !p.isShard);
  const shardPayments = payments.filter(p => p.isShard);
  
  // Success/Failure counts
  const successfulRootPayments = rootPayments.filter(p => p.isSuccess);
  const failedRootPayments = rootPayments.filter(p => !p.isSuccess);
  const successfulShards = shardPayments.filter(p => p.isSuccess);
  
  // Success rates
  const rootSuccessRate = rootPayments.length > 0
    ? (successfulRootPayments.length / rootPayments.length * 100)
    : 0;
  const shardSuccessRate = shardPayments.length > 0
    ? (successfulShards.length / shardPayments.length * 100)
    : 0;
  const overallSuccessRate = payments.length > 0
    ? (payments.filter(p => p.isSuccess).length / payments.length * 100)
    : 0;

  // Time statistics (for root payments only)
  const successTimes = successfulRootPayments.map(p => p.endTime - p.startTime);
  const failTimes = failedRootPayments.map(p => p.endTime - p.startTime);
  
  const avgSuccessTime = successTimes.length > 0
    ? successTimes.reduce((a, b) => a + b, 0) / successTimes.length
    : 0;
  const avgFailTime = failTimes.length > 0
    ? failTimes.reduce((a, b) => a + b, 0) / failTimes.length
    : 0;
  const minSuccessTime = successTimes.length > 0 ? Math.min(...successTimes) : 0;
  const maxSuccessTime = successTimes.length > 0 ? Math.max(...successTimes) : 0;
  const medianSuccessTime = successTimes.length > 0
    ? [...successTimes].sort((a, b) => a - b)[Math.floor(successTimes.length / 2)]
    : 0;

  // Amount statistics
  const totalAmountSent = successfulRootPayments.reduce((sum, p) => sum + p.amount, 0);
  const avgAmount = rootPayments.length > 0
    ? rootPayments.reduce((sum, p) => sum + p.amount, 0) / rootPayments.length
    : 0;
  const minAmount = rootPayments.length > 0 ? Math.min(...rootPayments.map(p => p.amount)) : 0;
  const maxAmount = rootPayments.length > 0 ? Math.max(...rootPayments.map(p => p.amount)) : 0;
  
  // Fee statistics
  const totalFees = payments.filter(p => p.isSuccess).reduce((sum, p) => sum + p.totalFee, 0);
  const avgFee = successfulRootPayments.length > 0
    ? successfulRootPayments.reduce((sum, p) => sum + p.totalFee, 0) / successfulRootPayments.length
    : 0;
  const feeRate = totalAmountSent > 0
    ? (totalFees / totalAmountSent * 100)
    : 0;

  // Attempt statistics
  const totalAttempts = payments.reduce((sum, p) => sum + p.attempts, 0);
  const avgAttempts = payments.length > 0
    ? totalAttempts / payments.length
    : 0;
  const maxAttempts = payments.length > 0 ? Math.max(...payments.map(p => p.attempts)) : 0;
  const firstAttemptSuccess = payments.filter(p => p.isSuccess && p.attempts === 1).length;
  const firstAttemptSuccessRate = payments.filter(p => p.isSuccess).length > 0
    ? (firstAttemptSuccess / payments.filter(p => p.isSuccess).length * 100)
    : 0;

  // Error statistics
  const noBalanceErrors = payments.reduce((sum, p) => sum + p.noBalanceCount, 0);
  const offlineErrors = payments.reduce((sum, p) => sum + p.offlineNodeCount, 0);
  const timeoutPayments = rootPayments.filter(p => !p.isSuccess && p.timeoutExp > 0).length;

  // Multipath statistics
  const splitPayments = rootPayments.filter(p => p.childShards && p.childShards.length > 0);
  const avgShardsPerSplit = splitPayments.length > 0
    ? shardPayments.length / splitPayments.length
    : 0;

  // Network statistics
  const activeChannels = channels.filter(c => !c.isClosed).length;
  const totalCapacity = channels.reduce((sum, c) => sum + c.capacity, 0);
  const avgChannelCapacity = channels.length > 0 ? totalCapacity / channels.length : 0;

  // Simulation duration
  const allTimes = payments.flatMap(p => [p.startTime, p.endTime]);
  const simulationStart = allTimes.length > 0 ? Math.min(...allTimes) : 0;
  const simulationEnd = allTimes.length > 0 ? Math.max(...allTimes) : 0;
  const simulationDuration = simulationEnd - simulationStart;

  // Route statistics (hop count)
  const successfulRoutes = payments.filter(p => p.isSuccess && p.route.length > 0);
  const avgHopCount = successfulRoutes.length > 0
    ? successfulRoutes.reduce((sum, p) => sum + p.route.length, 0) / successfulRoutes.length
    : 0;
  const maxHopCount = successfulRoutes.length > 0
    ? Math.max(...successfulRoutes.map(p => p.route.length))
    : 0;

  return (
    <div className="simulation-overview">
      <div className="overview-header">
        <h2>シミュレーション概要</h2>
        <div className="overview-subtitle">
          シミュレーション時間: {formatTime(simulationDuration)}
        </div>
      </div>

      <div className="overview-grid">
        {/* Basic Statistics */}
        <section className="overview-section basic-stats">
          <h3>基本統計</h3>
          <div className="stats-cards">
            <div className="stat-card highlight">
              <div className="stat-card-label">総ペイメント数</div>
              <div className="stat-card-value">{rootPayments.length}</div>
            </div>
            <div className="stat-card success">
              <div className="stat-card-label">成功</div>
              <div className="stat-card-value">{successfulRootPayments.length}</div>
              <div className="stat-card-sub">{rootSuccessRate.toFixed(1)}%</div>
            </div>
            <div className="stat-card failed">
              <div className="stat-card-label">失敗</div>
              <div className="stat-card-value">{failedRootPayments.length}</div>
              <div className="stat-card-sub">{(100 - rootSuccessRate).toFixed(1)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">成功率</div>
              <div className={`stat-card-value ${rootSuccessRate >= 90 ? 'good' : rootSuccessRate >= 70 ? 'warn' : 'bad'}`}>
                {rootSuccessRate.toFixed(2)}%
              </div>
            </div>
          </div>
        </section>

        {/* Time Statistics */}
        <section className="overview-section time-stats">
          <h3>時間統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">平均成功時間</span>
              <span className="stats-value success">{formatTime(avgSuccessTime)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">平均失敗時間</span>
              <span className="stats-value failed">{formatTime(avgFailTime)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最短成功時間</span>
              <span className="stats-value">{formatTime(minSuccessTime)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最長成功時間</span>
              <span className="stats-value">{formatTime(maxSuccessTime)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">中央値成功時間</span>
              <span className="stats-value">{formatTime(medianSuccessTime)}</span>
            </div>
          </div>
        </section>

        {/* Amount Statistics */}
        <section className="overview-section amount-stats">
          <h3>金額統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">送金成功総額</span>
              <span className="stats-value amount">{formatSatoshi(totalAmountSent)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">平均送金額</span>
              <span className="stats-value">{formatSatoshi(avgAmount)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最小送金額</span>
              <span className="stats-value">{formatSatoshi(minAmount)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最大送金額</span>
              <span className="stats-value">{formatSatoshi(maxAmount)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">手数料総額</span>
              <span className="stats-value fee">{formatSatoshi(totalFees)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">平均手数料</span>
              <span className="stats-value">{formatSatoshi(avgFee)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">手数料率</span>
              <span className="stats-value">{feeRate.toFixed(4)}%</span>
            </div>
          </div>
        </section>

        {/* Attempt Statistics */}
        <section className="overview-section attempt-stats">
          <h3>試行統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">総試行回数</span>
              <span className="stats-value">{totalAttempts.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">平均試行回数</span>
              <span className="stats-value">{avgAttempts.toFixed(2)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最大試行回数</span>
              <span className="stats-value">{maxAttempts}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">1回で成功</span>
              <span className="stats-value">{firstAttemptSuccess}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">1回成功率</span>
              <span className="stats-value">{firstAttemptSuccessRate.toFixed(1)}%</span>
            </div>
          </div>
        </section>

        {/* Error Statistics */}
        <section className="overview-section error-stats">
          <h3>エラー統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">残高不足エラー</span>
              <span className="stats-value error">{noBalanceErrors.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">オフラインエラー</span>
              <span className="stats-value error">{offlineErrors.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">タイムアウト</span>
              <span className="stats-value error">{timeoutPayments}</span>
            </div>
          </div>
        </section>

        {/* Route Statistics */}
        <section className="overview-section route-stats">
          <h3>ルート統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">平均ホップ数</span>
              <span className="stats-value">{avgHopCount.toFixed(2)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">最大ホップ数</span>
              <span className="stats-value">{maxHopCount}</span>
            </div>
          </div>
        </section>

        {/* Multipath Statistics */}
        {config.mpp === 1 && (
          <section className="overview-section mpp-stats">
            <h3>マルチパスペイメント統計</h3>
            <div className="stats-table">
              <div className="stats-row">
                <span className="stats-label">分割されたペイメント</span>
                <span className="stats-value shard">{splitPayments.length}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">総シャード数</span>
                <span className="stats-value shard">{shardPayments.length}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">平均シャード数/分割</span>
                <span className="stats-value">{avgShardsPerSplit.toFixed(2)}</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">シャード成功率</span>
                <span className="stats-value">{shardSuccessRate.toFixed(1)}%</span>
              </div>
              <div className="stats-row">
                <span className="stats-label">全体成功率(シャード込)</span>
                <span className="stats-value">{overallSuccessRate.toFixed(1)}%</span>
              </div>
            </div>
          </section>
        )}

        {/* Network Statistics */}
        <section className="overview-section network-stats">
          <h3>ネットワーク統計</h3>
          <div className="stats-table">
            <div className="stats-row">
              <span className="stats-label">ノード数</span>
              <span className="stats-value">{nodes.length.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">チャネル数</span>
              <span className="stats-value">{channels.length.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">アクティブチャネル</span>
              <span className="stats-value">{activeChannels.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">エッジ数</span>
              <span className="stats-value">{edges.length.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">総キャパシティ</span>
              <span className="stats-value">{formatSatoshi(totalCapacity)}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">平均チャネル容量</span>
              <span className="stats-value">{formatSatoshi(avgChannelCapacity)}</span>
            </div>
          </div>
        </section>

        {/* Configuration */}
        <section className="overview-section config-section">
          <h3>シミュレーション設定</h3>
          <div className="config-grid-full">
            <div className="config-group">
              <h4>ルーティング設定</h4>
              <div className="config-items">
                <div className="config-row">
                  <span className="config-label">ルーティング方式</span>
                  <span className="config-value highlight">{config.routingMethod}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">MPP (マルチパス)</span>
                  <span className={`config-value ${config.mpp === 1 ? 'enabled' : 'disabled'}`}>
                    {config.mpp === 1 ? '有効' : '無効'}
                  </span>
                </div>
                {config.mpp === 1 && (
                  <div className="config-row">
                    <span className="config-label">最大シャード数</span>
                    <span className="config-value">{config.maxShardCount}</span>
                  </div>
                )}
                <div className="config-row">
                  <span className="config-label">タイムアウト</span>
                  <span className="config-value">{formatTime(config.paymentTimeout)}</span>
                </div>
              </div>
            </div>

            <div className="config-group">
              <h4>グループ設定</h4>
              <div className="config-items">
                <div className="config-row">
                  <span className="config-label">グループサイズ</span>
                  <span className="config-value">{config.groupSize}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">グループ制限率</span>
                  <span className="config-value">{(config.groupLimitRate * 100).toFixed(0)}%</span>
                </div>
                <div className="config-row">
                  <span className="config-label">グループ容量更新</span>
                  <span className={`config-value ${config.groupCapUpdate ? 'enabled' : 'disabled'}`}>
                    {config.groupCapUpdate ? '有効' : '無効'}
                  </span>
                </div>
                <div className="config-row">
                  <span className="config-label">ブロードキャスト遅延</span>
                  <span className="config-value">{formatTime(config.groupBroadcastDelay)}</span>
                </div>
              </div>
            </div>

            <div className="config-group">
              <h4>ペイメント設定</h4>
              <div className="config-items">
                <div className="config-row">
                  <span className="config-label">ペイメント数</span>
                  <span className="config-value">{config.nPayments.toLocaleString()}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">ペイメントレート</span>
                  <span className="config-value">{config.paymentRate}/単位時間</span>
                </div>
                <div className="config-row">
                  <span className="config-label">平均送金額</span>
                  <span className="config-value">{formatSatoshi(config.averagePaymentAmount)}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">送金額分散</span>
                  <span className="config-value">{formatSatoshi(config.variancePaymentAmount)}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">平均転送間隔</span>
                  <span className="config-value">{formatTime(config.averagePaymentForwardInterval)}</span>
                </div>
              </div>
            </div>

            <div className="config-group">
              <h4>ネットワーク設定</h4>
              <div className="config-items">
                <div className="config-row">
                  <span className="config-label">ファイルから生成</span>
                  <span className={`config-value ${config.generateNetworkFromFile ? 'enabled' : 'disabled'}`}>
                    {config.generateNetworkFromFile ? 'はい' : 'いいえ'}
                  </span>
                </div>
                <div className="config-row">
                  <span className="config-label">故障ノード確率</span>
                  <span className="config-value">{(config.faultyNodeProbability * 100).toFixed(1)}%</span>
                </div>
                <div className="config-row">
                  <span className="config-label">フェイク残高更新</span>
                  <span className={`config-value ${config.enableFakeBalanceUpdate ? 'enabled' : 'disabled'}`}>
                    {config.enableFakeBalanceUpdate ? '有効' : '無効'}
                  </span>
                </div>
              </div>
            </div>

            <div className="config-group">
              <h4>CUL設定</h4>
              <div className="config-items">
                <div className="config-row">
                  <span className="config-label">閾値分布α</span>
                  <span className="config-value">{config.culThresholdDistAlpha}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">閾値分布β</span>
                  <span className="config-value">{config.culThresholdDistBeta}</span>
                </div>
              </div>
            </div>

            {config.averageMaxFeeLimit > 0 && (
              <div className="config-group">
                <h4>手数料制限</h4>
                <div className="config-items">
                  <div className="config-row">
                    <span className="config-label">平均最大手数料</span>
                    <span className="config-value">{formatSatoshi(config.averageMaxFeeLimit)}</span>
                  </div>
                  <div className="config-row">
                    <span className="config-label">手数料分散</span>
                    <span className="config-value">{formatSatoshi(config.varianceMaxFeeLimit)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
