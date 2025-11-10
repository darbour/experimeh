import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Experiment } from '../types';

interface UseRealtimeOptions {
  enabled?: boolean;
  interval?: number; // milliseconds
}

// Real-time updates for running experiments using polling
export function useRealtimeExperiment(
  experimentId: string,
  options: UseRealtimeOptions = {}
) {
  const { enabled = true, interval = 5000 } = options;
  const queryClient = useQueryClient();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !experimentId) return;

    // Start polling
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ['experiments', 'detail', experimentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['analysis', 'latest', experimentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['assignment-distribution', experimentId],
      });
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [experimentId, enabled, interval, queryClient]);
}

// Real-time updates for experiments list
export function useRealtimeExperiments(options: UseRealtimeOptions = {}) {
  const { enabled = true, interval = 10000 } = options;
  const queryClient = useQueryClient();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Start polling
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ['experiments', 'list'],
      });
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, queryClient]);
}

// Connection status hook (for future WebSocket implementation)
export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // For now, always connected (using polling)
  // This can be extended to support WebSocket connection status

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return {
    isConnected,
    lastUpdate,
  };
}

// Hook to enable real-time updates only for running experiments
export function useSmartRealtime(experiment?: Experiment | null) {
  const shouldEnableRealtime = experiment?.status === 'running';

  useRealtimeExperiment(experiment?.id || '', {
    enabled: shouldEnableRealtime,
    interval: 5000,
  });

  return shouldEnableRealtime;
}

// Dashboard real-time updates
export function useRealtimeDashboard(options: UseRealtimeOptions = {}) {
  const { enabled = true, interval = 15000 } = options;
  const queryClient = useQueryClient();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ['dashboard', 'stats'],
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, queryClient]);
}

// Notification system for experiment updates
interface ExperimentNotification {
  id: string;
  experimentId: string;
  experimentName: string;
  type: 'status_change' | 'significant_result' | 'guardrail_violation';
  message: string;
  timestamp: Date;
}

export function useExperimentNotifications() {
  const [notifications, setNotifications] = useState<ExperimentNotification[]>([]);

  const addNotification = (notification: Omit<ExperimentNotification, 'id' | 'timestamp'>) => {
    const newNotification: ExperimentNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep last 10
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    clearNotification,
    clearAllNotifications,
  };
}
