'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'log' | 'error' | 'warn';
}

export default function PerformanceDebug() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnabled) return;

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (message: string, type: 'log' | 'error' | 'warn' = 'log') => {
      if (message.includes('[PERF]')) {
        setLogs((prev) => [
          ...prev.slice(-49), // Keep last 50 logs
          { timestamp: Date.now(), message, type },
        ]);
      }
    };

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      addLog(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '), 'log');
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      addLog(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '), 'error');
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      addLog(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '), 'warn');
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isEnabled]);

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isEnabled) {
    return (
      <button
        onClick={() => setIsEnabled(true)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded-full shadow-lg"
        title="Enable Performance Debug"
      >
        📊 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">Performance Debug</span>
            <span className="text-gray-400 text-xs">({logs.length} logs)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearLogs}
              className="text-gray-400 hover:text-white text-xs px-2 py-1"
              title="Clear logs"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-400 hover:text-white"
            >
              {isOpen ? '▼' : '▲'}
            </button>
            <button
              onClick={() => setIsEnabled(false)}
              className="text-gray-400 hover:text-white"
              title="Disable debug"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Logs Panel */}
        {isOpen && (
          <div className="h-64 overflow-y-auto bg-black/50 p-2 text-xs font-mono">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No performance logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-1 p-1 rounded ${
                    log.type === 'error'
                      ? 'text-red-400 bg-red-900/20'
                      : log.type === 'warn'
                      ? 'text-yellow-400 bg-yellow-900/20'
                      : 'text-green-400'
                  }`}
                >
                  <span className="text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {' '}
                  <span className="break-words">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
