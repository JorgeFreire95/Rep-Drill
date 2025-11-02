import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { healthService } from '../../services/healthService';

type ServiceStatus = 'ok' | 'down' | 'loading';

interface StatusItemProps {
  label: string;
  status: ServiceStatus;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, status }) => {
  const color =
    status === 'ok'
      ? 'text-green-600'
      : status === 'down'
      ? 'text-red-600'
      : 'text-gray-400';

  const Icon = status === 'ok' ? CheckCircle2 : status === 'down' ? XCircle : CheckCircle2;
  const title = status === 'ok' ? 'OK' : status === 'down' ? 'Error' : 'Cargando';

  return (
    <div className="flex items-center gap-1 text-xs" title={`${label}: ${title}`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-gray-600 hidden sm:inline">{label}</span>
    </div>
  );
};

export const HealthWidget: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<ServiceStatus>('loading');
  const [invStatus, setInvStatus] = useState<ServiceStatus>('loading');

  const checkAll = async () => {
    try {
      const ok = await healthService.checkAuth();
      setAuthStatus(ok ? 'ok' : 'down');
    } catch {
      setAuthStatus('down');
    }

    try {
      const ok = await healthService.checkInventario();
      setInvStatus(ok ? 'ok' : 'down');
    } catch {
      setInvStatus('down');
    }
  };

  useEffect(() => {
    void checkAll();
    const id = setInterval(checkAll, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-md px-2 py-1 border border-gray-200">
      <StatusItem label="Auth" status={authStatus} />
      <div className="w-px h-4 bg-gray-200" />
      <StatusItem label="Inventario" status={invStatus} />
    </div>
  );
};

export default HealthWidget;
