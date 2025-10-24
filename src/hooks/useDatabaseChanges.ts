import type { ClockHead } from '@fireproof/core-types-base';

export interface ChangesData {
  data: string;
  clock: ClockHead | undefined;
}

export const useDatabaseChanges = () => {
  const fetchAllChanges = async (database: any): Promise<ChangesData> => {
    try {
      console.log('📊 Fetching all changes from database...');
      
      const changes = await database.changes(undefined);
      console.log('📊 All changes received:', changes);
      
      // Format the changes data as JSON string
      const formattedData = JSON.stringify(changes, null, 2);
      
      console.log('📊 All changes data updated');
      return {
        data: formattedData,
        clock: changes.clock
      };
    } catch (error) {
      console.error('Error fetching all changes:', error);
      return {
        data: `Error fetching all changes: ${(error as Error).message}`,
        clock: undefined
      };
    }
  };

  const fetchRecentChanges = async (database: any, currentClock: ClockHead | undefined): Promise<ChangesData> => {
    try {
      console.log('📊 Fetching recent changes from database...');
      console.log('📊 Current clock:', currentClock);
      
      if (!currentClock) {
        return {
          data: 'No previous clock found. Use "Fetch All Changes" first to establish a clock position.',
          clock: undefined
        };
      }
      
      const changes = await database.changes(currentClock, { dirty: true, limit: 100 });
      console.log('📊 Recent changes received:', changes);
      
      // Format the changes data as JSON string
      const formattedData = JSON.stringify(changes, null, 2);
      
      console.log('📊 Recent changes data updated');
      return {
        data: formattedData,
        clock: changes.clock
      };
    } catch (error) {
      console.error('Error fetching recent changes:', error);
      return {
        data: `Error fetching recent changes: ${(error as Error).message}`,
        clock: currentClock
      };
    }
  };

  const fetchChangesSince = async (database: any): Promise<ChangesData> => {
    try {
      // Prompt user for CID value
      const cidInput = prompt(
        'Enter the CID (Content Identifier) to fetch changes since:\n\n' +
        '(Just enter the CID string, e.g., "bafyreieijplscc76xo7226oifrnvewfzk476au2ds5pxzkveokthflj6ci")\n\n' +
        'CID:'
      );
      
      if (cidInput === null) {
        console.log('📊 Fetch changes since cancelled by user');
        return {
          data: 'Operation cancelled by user.',
          clock: undefined
        };
      }
      
      if (!cidInput.trim()) {
        return {
          data: 'Error: CID cannot be empty. Please enter a valid CID string.',
          clock: undefined
        };
      }
      
      // Wrap the CID in the proper clock format
      const parsedClock: ClockHead = [{ "/": cidInput.trim() }] as any;
      console.log('📊 Parsed clock input:', parsedClock);
      
      console.log('📊 Fetching changes since clock:', parsedClock);
      
      const changes = await database.changes(parsedClock);
      console.log('📊 Changes since clock received:', changes);
      
      // Format the changes data as JSON string
      const formattedData = JSON.stringify(changes, null, 2);
      
      console.log('📊 Changes since clock data updated');
      return {
        data: formattedData,
        clock: changes.clock
      };
    } catch (error) {
      console.error('Error fetching changes since clock:', error);
      return {
        data: `Error fetching changes since clock: ${(error as Error).message}`,
        clock: undefined
      };
    }
  };

  return {
    fetchAllChanges,
    fetchRecentChanges,
    fetchChangesSince
  };
};
