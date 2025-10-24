import React, { useState } from 'react';
import { useDatabaseChanges } from '../hooks/useDatabaseChanges';
import type { ClockHead } from '@fireproof/core-types-base';

interface DatabaseChangesSectionProps {
  database: any;
}

export const DatabaseChangesSection: React.FC<DatabaseChangesSectionProps> = ({ database }) => {
  const [changesData, setChangesData] = useState<string>("");
  const [changesClock, setChangesClock] = useState<ClockHead | undefined>(undefined);
  const { fetchAllChanges, fetchRecentChanges, fetchChangesSince } = useDatabaseChanges();

  const handleFetchAllChanges = async () => {
    const result = await fetchAllChanges(database);
    setChangesData(result.data);
    setChangesClock(result.clock);
  };

  const handleFetchRecentChanges = async () => {
    const result = await fetchRecentChanges(database, changesClock);
    setChangesData(result.data);
    setChangesClock(result.clock);
  };

  const handleFetchChangesSince = async () => {
    const result = await fetchChangesSince(database);
    setChangesData(result.data);
    setChangesClock(result.clock);
  };

  return (
    <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
      <h3>📊 Database Changes API</h3>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
        Use these buttons to inspect the changes feed from your Fireproof database:
        <br />• <strong>Fetch All Changes:</strong> Gets all changes from the beginning (resets clock)
        <br />• <strong>Fetch Recent Changes:</strong> Gets only changes since the last fetch (uses stored clock)
        <br />• <strong>Fetch Changes Since:</strong> Gets changes since a specific CID (just enter the CID string)
      </p>
      
      <div style={{ marginBottom: '15px' }}>
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={handleFetchAllChanges}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Fetch All Changes
          </button>
          <button
            onClick={handleFetchRecentChanges}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Fetch Recent Changes
          </button>
          <button
            onClick={handleFetchChangesSince}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#fd7e14',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Fetch Changes Since...
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <strong>Current clock:</strong> {changesClock ? JSON.stringify(changesClock) : 'undefined (no previous fetch)'}
        </div>
      </div>

      {changesData && (
        <div style={{ marginTop: '15px' }}>
          <h4>Changes Data:</h4>
          <div
            style={{
              height: '500px',
              overflow: 'auto',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {changesData}
          </div>
        </div>
      )}
    </div>
  );
};
