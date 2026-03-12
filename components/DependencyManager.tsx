'use client';

import { useState, useEffect } from 'react';

interface Dependency {
  id: number;
  package_name: string;
  version: string;
  type: string;
}

interface DependencyManagerProps {
  projectId: string;
}

export default function DependencyManager({ projectId }: DependencyManagerProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('latest');
  const [depType, setDepType] = useState<'dependency' | 'devDependency'>('dependency');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadDependencies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/dependencies`);
      const data = await response.json();
      if (data.success) {
        setDependencies(data.dependencies || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDependency = async () => {
    if (!packageName.trim()) {
      setError('Package name is required');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: packageName,
          version: version || 'latest',
          type: depType,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        setPackageName('');
        setVersion('latest');
        loadDependencies();
      } else {
        setError(data.error || 'Failed to add dependency');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveDependency = async (packageName: string, type: string) => {
    if (!confirm(`Remove ${packageName}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/dependencies?package_name=${encodeURIComponent(packageName)}&type=${type}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        loadDependencies();
      } else {
        setError(data.error || 'Failed to remove dependency');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/projects/${projectId}/dependencies/install`,
        { method: 'POST' }
      );

      const data = await response.json();
      if (data.success) {
        alert('Dependencies installed successfully! Check the terminal for output.');
      } else {
        setError(data.error || 'Failed to install dependencies');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstalling(false);
    }
  };

  const regularDeps = dependencies.filter((d) => d.type === 'dependency');
  const devDeps = dependencies.filter((d) => d.type === 'devDependency');

  return (
    <div className="bg-[#2d2d2d] rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-base text-[#d4d4d4]">Dependencies</h3>
        <div className="flex gap-2">
          <button
            className="bg-[#007acc] text-white border-none px-4 py-2 rounded text-sm transition-colors hover:bg-[#005a9e]"
            onClick={() => setShowAddModal(true)}
            title="Add Dependency"
          >
            ➕ Add
          </button>
          {dependencies.length > 0 && (
            <button
              className="bg-[#007acc] text-white border-none px-4 py-2 rounded text-sm transition-colors hover:bg-[#005a9e] disabled:bg-gray-500 disabled:cursor-not-allowed"
              onClick={handleInstall}
              disabled={installing}
              title="Install Dependencies"
            >
              {installing ? '⏳ Installing...' : '📦 Install'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500 text-white px-3 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>
      ) : dependencies.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No dependencies yet. Click &quot;Add&quot; to install packages.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {regularDeps.length > 0 && (
            <div className="bg-[#1e1e1e] rounded p-3">
              <h4 className="m-0 mb-2 text-xs text-gray-500 uppercase">Dependencies</h4>
              {regularDeps.map((dep) => (
                <div key={dep.id} className="flex items-center gap-3 px-2 py-2 bg-[#252526] rounded mb-1">
                  <span className="flex-1 text-[#4ec9b0] font-mono text-sm">{dep.package_name}</span>
                  <span className="text-gray-500 text-sm font-mono">{dep.version}</span>
                  <button
                    className="bg-transparent border-none text-red-400 cursor-pointer px-2 py-1 rounded text-base leading-none transition-colors hover:bg-[#3e3e3e]"
                    onClick={() => handleRemoveDependency(dep.package_name, dep.type)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {devDeps.length > 0 && (
            <div className="bg-[#1e1e1e] rounded p-3">
              <h4 className="m-0 mb-2 text-xs text-gray-500 uppercase">Dev Dependencies</h4>
              {devDeps.map((dep) => (
                <div key={dep.id} className="flex items-center gap-3 px-2 py-2 bg-[#252526] rounded mb-1">
                  <span className="flex-1 text-[#4ec9b0] font-mono text-sm">{dep.package_name}</span>
                  <span className="text-gray-500 text-sm font-mono">{dep.version}</span>
                  <button
                    className="bg-transparent border-none text-red-400 cursor-pointer px-2 py-1 rounded text-base leading-none transition-colors hover:bg-[#3e3e3e]"
                    onClick={() => handleRemoveDependency(dep.package_name, dep.type)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-[#2d2d2d] rounded-lg p-6 min-w-[400px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="m-0 mb-4 text-[#d4d4d4]">Add Dependency</h4>
            <div className="mb-4">
              <label className="block mb-2 text-[#d4d4d4] text-sm">Package Name *</label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g., express, react, lodash"
                className="w-full px-2 py-2 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[#d4d4d4] text-sm focus:outline-none focus:border-[#007acc]"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddDependency();
                  }
                }}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-[#d4d4d4] text-sm">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="latest, ^1.0.0, 1.2.3"
                className="w-full px-2 py-2 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[#d4d4d4] text-sm focus:outline-none focus:border-[#007acc]"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2 text-[#d4d4d4] text-sm">Type</label>
              <select
                value={depType}
                onChange={(e) => setDepType(e.target.value as 'dependency' | 'devDependency')}
                className="w-full px-2 py-2 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-[#d4d4d4] text-sm focus:outline-none focus:border-[#007acc]"
              >
                <option value="dependency">Dependency</option>
                <option value="devDependency">Dev Dependency</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={handleAddDependency} 
                className="px-4 py-2 border-none rounded cursor-pointer text-sm transition-colors bg-[#007acc] text-white hover:bg-[#005a9e]"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border-none rounded cursor-pointer text-sm transition-colors bg-[#3e3e3e] text-[#d4d4d4] hover:bg-[#4e4e4e]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
