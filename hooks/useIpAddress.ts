
import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import type firebase from 'firebase/compat/app';

const IP_LOCAL_STORAGE_KEY = 'dnd_player_id';

export const useIpAddress = () => {
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getPlayerId = async () => {
      try {
        let storedId = localStorage.getItem(IP_LOCAL_STORAGE_KEY);
        if (storedId) {
          setIpAddress(storedId);
          setLoading(false);
          return;
        }

        // If no local storage ID, try to find one by IP
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        if (!ipResponse.ok) {
          throw new Error('Failed to fetch IP address to create a persistent ID.');
        }
        const ipData = await ipResponse.json();
        const rawIp = ipData.ip;

        // Helper to check a DB path for a player ID matching the raw IP
        const findIdByIp = async (ref: firebase.database.Reference): Promise<string | null> => {
            const snapshot = await ref.once('value');
            const players = snapshot.val();
            if (players) {
                for (const key in players) {
                    const player = players[key];
                    // The unique ID is stored in 'id' for active and 'ip' for pending, and it starts with the raw IP.
                    const uniqueId = player.id || player.ip;
                    if (typeof uniqueId === 'string' && uniqueId.startsWith(rawIp)) {
                        return uniqueId;
                    }
                }
            }
            return null;
        };
        
        // Check active and then pending players
        let foundId = await findIdByIp(db.ref('DND/active_players')) || await findIdByIp(db.ref('DND/pending_players'));

        if (foundId) {
          // Found a returning player
          localStorage.setItem(IP_LOCAL_STORAGE_KEY, foundId);
          setIpAddress(foundId);
        } else {
          // No player found, create a new ID
          const newId = rawIp + '-' + Date.now();
          localStorage.setItem(IP_LOCAL_STORAGE_KEY, newId);
          setIpAddress(newId);
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };

    getPlayerId();
  }, []);

  return { ipAddress, loading, error };
};
