import * as SecureStore from 'expo-secure-store';
import type { KeyValueStore } from './AuthService';

export const secureKeyValueStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};
