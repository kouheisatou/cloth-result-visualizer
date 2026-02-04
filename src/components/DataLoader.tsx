import { useCallback, useState } from 'react';

export type LoadSource = 
  | { type: 'files'; filePaths: { nodes: string; channels: string; edges: string; payments: string; config: string } }
  | { type: 'sample' };

interface DataLoaderProps {
  onDataLoaded: (data: {
    nodesContent: string;
    channelsContent: string;
    edgesContent: string;
    paymentsContent: string;
    configContent: string;
  }, source: LoadSource) => void;
}

export function DataLoader({ onDataLoaded }: DataLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{
    nodes?: File;
    channels?: File;
    edges?: File;
    payments?: File;
    config?: File;
  }>({});

  const handleFileChange = useCallback((type: keyof typeof files) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      setError(null);
    }
  }, []);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setError(null);

    // フォルダ内のファイルから必要なファイルを自動検出
    const filesArray = Array.from(fileList);

    const nodesFile = filesArray.find(f => f.name === 'nodes_output.csv');
    const channelsFile = filesArray.find(f => f.name === 'channels_output.csv');
    const edgesFile = filesArray.find(f => f.name === 'edges_output.csv');
    const paymentsFile = filesArray.find(f => f.name === 'payments_output.csv');
    const configFile = filesArray.find(f => f.name === 'cloth_input.txt');

    const missingFiles: string[] = [];
    if (!nodesFile) missingFiles.push('nodes_output.csv');
    if (!channelsFile) missingFiles.push('channels_output.csv');
    if (!edgesFile) missingFiles.push('edges_output.csv');
    if (!paymentsFile) missingFiles.push('payments_output.csv');
    if (!configFile) missingFiles.push('cloth_input.txt');

    if (missingFiles.length > 0) {
      setError(`フォルダ内に以下のファイルが見つかりません: ${missingFiles.join(', ')}`);
      return;
    }

    setFiles({
      nodes: nodesFile,
      channels: channelsFile,
      edges: edgesFile,
      payments: paymentsFile,
      config: configFile,
    });

    // 自動的に読み込みを開始
    setLoading(true);
    try {
      const readFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      };

      const [nodesContent, channelsContent, edgesContent, paymentsContent, configContent] = await Promise.all([
        readFile(nodesFile!),
        readFile(channelsFile!),
        readFile(edgesFile!),
        readFile(paymentsFile!),
        readFile(configFile!),
      ]);

      onDataLoaded({
        nodesContent,
        channelsContent,
        edgesContent,
        paymentsContent,
        configContent,
      }, {
        type: 'files',
        filePaths: {
          nodes: nodesFile!.name,
          channels: channelsFile!.name,
          edges: edgesFile!.name,
          payments: paymentsFile!.name,
          config: configFile!.name,
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  const loadFiles = useCallback(async () => {
    if (!files.nodes || !files.channels || !files.edges || !files.payments || !files.config) {
      setError('すべてのファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const readFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      };

      const [nodesContent, channelsContent, edgesContent, paymentsContent, configContent] = await Promise.all([
        readFile(files.nodes),
        readFile(files.channels),
        readFile(files.edges),
        readFile(files.payments),
        readFile(files.config),
      ]);

      onDataLoaded({
        nodesContent,
        channelsContent,
        edgesContent,
        paymentsContent,
        configContent,
      }, {
        type: 'files',
        filePaths: {
          nodes: files.nodes.name,
          channels: files.channels.name,
          edges: files.edges.name,
          payments: files.payments.name,
          config: files.config.name,
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [files, onDataLoaded]);

  const loadSampleData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // With <base> tag set, relative paths will resolve correctly
      // e.g., 'data/nodes_output.csv' -> https://kouheisatou.github.io/cloth-result-visualizer/data/nodes_output.csv
      const [nodesRes, channelsRes, edgesRes, paymentsRes, configRes] = await Promise.all([
        fetch('data/nodes_output.csv'),
        fetch('data/channels_output.csv'),
        fetch('data/edges_output.csv'),
        fetch('data/payments_output.csv'),
        fetch('data/cloth_input.txt'),
      ]);

      if (!nodesRes.ok || !channelsRes.ok || !edgesRes.ok || !paymentsRes.ok || !configRes.ok) {
        throw new Error('サンプルデータが見つかりません。ファイルを直接選択してください。');
      }

      const [nodesContent, channelsContent, edgesContent, paymentsContent, configContent] = await Promise.all([
        nodesRes.text(),
        channelsRes.text(),
        edgesRes.text(),
        paymentsRes.text(),
        configRes.text(),
      ]);

      onDataLoaded({
        nodesContent,
        channelsContent,
        edgesContent,
        paymentsContent,
        configContent,
      }, { type: 'sample' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サンプルデータの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  const isReady = files.nodes && files.channels && files.edges && files.payments && files.config;

  return (
    <div className="data-loader">
      <div className="loader-header">
        <h2>Lightning Network シミュレーション可視化ツール</h2>
        <p>シミュレーション結果のCSVファイルを読み込んでください</p>
      </div>

      <div className="file-inputs">
        <div className="file-input-group">
          <label>
            <span className="file-type">Nodes</span>
            <span className="file-name">{files.nodes?.name || 'nodes_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('nodes')}
            />
          </label>
          {files.nodes && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Channels</span>
            <span className="file-name">{files.channels?.name || 'channels_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('channels')}
            />
          </label>
          {files.channels && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Edges</span>
            <span className="file-name">{files.edges?.name || 'edges_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('edges')}
            />
          </label>
          {files.edges && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Payments</span>
            <span className="file-name">{files.payments?.name || 'payments_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('payments')}
            />
          </label>
          {files.payments && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Config</span>
            <span className="file-name">{files.config?.name || 'cloth_input.txt'}</span>
            <input 
              type="file" 
              accept=".txt"
              onChange={handleFileChange('config')}
            />
          </label>
          {files.config && <span className="check">✓</span>}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="loader-actions">
        <button 
          onClick={loadFiles}
          disabled={!isReady || loading}
          className="primary"
        >
          {loading ? '読み込み中...' : 'ファイルを読み込む'}
        </button>

        <label className="folder-select-btn">
          <input
            type="file"
            // @ts-ignore - webkitdirectory is not in TypeScript definitions
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderSelect}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <span className="btn-content">📁 フォルダから読み込む</span>
        </label>

        <button 
          onClick={loadSampleData}
          disabled={loading}
          className="secondary"
        >
          サンプルデータを使用
        </button>
      </div>

      <div className="loader-info">
        <h3>使い方</h3>
        <ol>
          <li>CLOTHシミュレータの出力ファイルを選択します</li>
          <li>個別にファイルを選択するか、「フォルダから読み込む」でフォルダ全体を選択できます</li>
          <li>「ファイルを読み込む」をクリックします（フォルダ選択時は自動で読み込まれます）</li>
          <li>グラフビューでネットワークを確認できます</li>
          <li>タイムラインコントロールで時系列を追跡できます</li>
        </ol>
        <p className="shortcuts">
          <strong>キーボードショートカット:</strong>
          <span>→ / Space: 次のステップ</span>
          <span>←: 前のステップ</span>
          <span>Home: 最初へ</span>
          <span>End: 最後へ</span>
        </p>
      </div>
    </div>
  );
}

