import React, { ReactNode } from 'react';

interface CallStatusProps {
  status: string;
  children?: ReactNode;
}

const CallStatus: React.FC<CallStatusProps> = ({ status, children }) => {
  // Function to determine status color
  const getStatusColor = (status: string): string => {
    if (!status || status === 'off') return 'text-gray-500';
    if (status.toLowerCase().includes('error')) return 'text-red-500';
    if (status.toLowerCase().includes('success')) return 'text-green-500';
    if (status.toLowerCase().includes('starting')) return 'text-blue-500';
    return 'text-white';
  };

  // Function to format status text
  const formatStatus = (status: string): string => {
    if (!status || status === 'off') return 'Not Connected';
    if (status === 'ready') return 'Ready';
    return status;
  };

  return (
    <div className="flex flex-col border border-[#2A2A2A] rounded-r-[1px] p-4 w-full lg:w-1/3">
      <div className="mt-2">
        <h2 className="text-xl font-semibold mb-2">Call Status</h2>
        <div className="flex items-center space-x-2 mb-4">
          {/* Status indicator dot */}
          <div 
            className={`w-2 h-2 rounded-full ${
              status === 'off' ? 'bg-gray-500' :
              status.toLowerCase().includes('error') ? 'bg-red-500' :
              status.toLowerCase().includes('success') ? 'bg-green-500' :
              'bg-blue-500'
            }`}
          />
          <p className="text-lg font-mono text-gray-400">
            Status: {' '}
            <span className={`${getStatusColor(status)} text-base`}>
              {formatStatus(status)}
            </span>
          </p>
        </div>
        
        {/* Future Features */}
        {/* TODO <p className="font-mono text-gray-400">Latency: <span className="text-gray-500">N/A</span></p> */}
        {/* TODO <p className="font-mono">00:00</p> */}
      </div>

      {/* Children (Assessment Notes) */}
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};

export default CallStatus;