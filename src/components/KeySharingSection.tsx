import React, { useState } from 'react';
import { exportKeysFromIndexedDB, importKeysToIndexedDB } from '../utils/keyManagement';
import { encryptKeyData, decryptKeyData, createSecureKeyWrapper, validateSecureKeyWrapper } from '../utils/crypto';

// Utility function for reliable clipboard operations
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to legacy method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
};

export const KeySharingSection: React.FC = () => {
  const [exportResult, setExportResult] = useState<{
    encryptedBase64: string;
    secret: string;
    timestamp: number;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportKeys = async () => {
    setIsExporting(true);
    setExportResult(null);
    try {
      console.log('🔑 Exporting keys from IndexedDB...');
      
      // First, let's see what IndexedDB databases exist
      console.log('🔑 Checking available IndexedDB databases...');
      try {
        const databases = await indexedDB.databases();
        console.log('🔑 Available databases:', databases);
      } catch (error) {
        console.log('🔑 Error listing databases:', error);
      }
      
      // Export keys directly from IndexedDB
      const keyExportData = await exportKeysFromIndexedDB();
      console.log('🔑 Exported keys from IndexedDB:', keyExportData);
      
      if (keyExportData.hasData) {
        // Prompt user for encryption secret
        const secret = prompt(
          'Enter a secret word to encrypt your keys:\n\n' +
          '(This secret will be needed to decrypt the keys in another browser)\n\n' +
          'Secret:'
        );
        
        if (!secret) {
          console.log('🔑 Export cancelled by user');
          return;
        }
        
        if (secret.length < 4) {
          alert('Secret must be at least 4 characters long.');
          return;
        }
        
        try {
          console.log('🔑 Creating secure wrapper...');
          const secureWrapper = createSecureKeyWrapper(keyExportData);
          console.log('🔑 Secure wrapper created:', secureWrapper);
          
          console.log('🔑 Encrypting keys...');
          const encryptedBase64 = await encryptKeyData(secureWrapper, secret);
          console.log('🔑 Keys encrypted successfully');
          
          // Store the result to show in UI instead of using confirm dialog
          setExportResult({
            encryptedBase64,
            secret,
            timestamp: Date.now()
          });
          
          // Try to copy immediately while user activation is still valid
          const copySuccess = await copyToClipboard(encryptedBase64);
          if (copySuccess) {
            alert('Keys exported and copied to clipboard! Paste them in the other browser along with the secret word.');
          }
        } catch (encryptionError) {
          console.error('🔑 Error encrypting keys:', encryptionError);
          alert('Failed to encrypt keys: ' + (encryptionError as Error).message);
        }
      } else {
        alert('No keys found to export. Try adding a todo item first to generate keys.');
      }
    } catch (error) {
      console.error('Error exporting keys:', error);
      alert('Failed to export keys: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const copyExportResult = async () => {
    if (!exportResult) return;
    
    const copySuccess = await copyToClipboard(exportResult.encryptedBase64);
    if (copySuccess) {
      alert('Keys copied to clipboard!');
    } else {
      alert('Failed to copy to clipboard. Please select and copy manually.');
    }
  };

  const importKeys = async () => {
    try {
      // Prompt user to paste the encrypted base64 string
      const encryptedBase64 = prompt(
        'Paste the encrypted base64-encoded keys from the other browser:\n\n' +
        '(This should be a long encrypted string)\n\n' +
        'Encrypted keys:'
      );
      
      if (!encryptedBase64) {
        console.log('🔑 Import cancelled by user');
        return;
      }
      
      console.log('🔑 Received encrypted base64 string:', encryptedBase64.substring(0, 50) + '...');
      
      // Prompt user for the secret word
      const secret = prompt(
        'Enter the secret word used to encrypt these keys:\n\n' +
        '(This must match the secret used when exporting the keys)\n\n' +
        'Secret:'
      );
      
      if (!secret) {
        console.log('🔑 Import cancelled by user (no secret)');
        return;
      }
      
      try {
        console.log('🔑 Decrypting keys...');
        const decryptedWrapper = await decryptKeyData(encryptedBase64, secret);
        console.log('🔑 Decrypted wrapper:', decryptedWrapper);
        
        // Validate the decrypted wrapper
        if (!validateSecureKeyWrapper(decryptedWrapper)) {
          throw new Error('Invalid or corrupted key data. The secret may be incorrect or the data may be damaged.');
        }
        
        console.log('🔑 Wrapper validation passed');
        console.log('🔑 Key export timestamp:', decryptedWrapper.timestamp);
        
        // Extract the actual key data
        const keyData = decryptedWrapper.data;
        console.log('🔑 Extracted key data:', keyData);
        
        // Import keys into IndexedDB
        console.log('🔑 Importing keys into IndexedDB...');
        const importResult = await importKeysToIndexedDB(keyData);
        console.log('🔑 Import result:', importResult);
        
        if (importResult.success) {
          const exportDate = new Date(decryptedWrapper.timestamp).toLocaleString();
          alert(
            `Keys imported successfully!\n\n` +
            `Imported ${importResult.importedCount} keys.\n` +
            `Original export date: ${exportDate}\n\n` +
            `Reload the page to use the shared data.`
          );
          window.location.reload();
        } else {
          throw new Error('Failed to import keys into IndexedDB');
        }
      } catch (decryptError) {
        console.error('🔑 Error decrypting/importing keys:', decryptError);
        if ((decryptError as Error).message.includes('Invalid or corrupted')) {
          alert('Failed to decrypt keys. Please check:\n\n1. The secret word is correct\n2. The encrypted data was copied completely\n3. The data hasn\'t been modified');
        } else {
          alert('Failed to decrypt or import keys. Please check that you copied the complete encrypted string and entered the correct secret word.');
        }
      }
    } catch (error) {
      console.error('Error importing keys:', error);
      alert('Failed to import keys: ' + (error as Error).message);
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
      <h3>🔗 Share Data Between Browsers</h3>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
        Use these tools to share your todos between different browsers/devices:
      </p>

      {/* Export Keys */}
      <div style={{ marginBottom: '15px' }}>
        <h4>Step 1: Export Keys (Source Browser)</h4>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
          Click this button to export your encryption keys. You'll get a base64 string to copy.
        </p>
        <button
          onClick={exportKeys}
          disabled={isExporting}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: isExporting ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isExporting ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isExporting ? 'Exporting...' : 'Export Keys'}
        </button>
      </div>

      {/* Export Result */}
      {exportResult && (
        <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '4px', border: '1px solid #28a745' }}>
          <h4 style={{ color: '#28a745', marginTop: '0' }}>✅ Keys Exported Successfully!</h4>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            Copy this encrypted string to share with another browser. Remember the secret word: <strong>"{exportResult.secret}"</strong>
          </p>
          <div style={{ marginBottom: '10px', overflow: 'hidden' }}>
            <textarea
              value={exportResult.encryptedBase64}
              readOnly
              style={{
                width: '100%',
                height: '100px',
                fontSize: '12px',
                fontFamily: 'monospace',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f8f9fa',
                resize: 'vertical',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            onClick={copyExportResult}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Copy to Clipboard
          </button>
          <button
            onClick={() => setExportResult(null)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Import Keys */}
      <div style={{ marginBottom: '15px' }}>
        <h4>Step 2: Import Keys (Target Browser)</h4>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
          Paste the base64 string from the source browser to import the keys.
        </p>
        <button
          onClick={importKeys}
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
          Import Keys
        </button>
      </div>
    </div>
  );
};
