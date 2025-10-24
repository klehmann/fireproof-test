import React from 'react';

interface DebugInfoProps {
  database: any;
  serverUrl: string;
  totalDocuments: number;
  todoCount: number;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ 
  database, 
  serverUrl, 
  totalDocuments, 
  todoCount 
}) => {
  return (
    <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
      <h4>Debug Info</h4>
      <p><strong>Database:</strong> {database ? 'Connected' : 'Not connected'}</p>
      <p><strong>Server URL:</strong> {serverUrl}</p>
      <p><strong>Total Documents:</strong> {totalDocuments}</p>
      <p><strong>Todo Count:</strong> {todoCount}</p>
    </div>
  );
};
