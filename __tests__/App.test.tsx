/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/test/dir',
  exists: jest.fn().mockResolvedValue(true),
  mkdir: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(true),
  unlink: jest.fn().mockResolvedValue(true),
  readDir: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('../src/services/api', () => ({
  ...jest.requireActual('../src/services/api'),
  apiFresh: jest.fn().mockResolvedValue([]),
  apiPopular: jest.fn().mockResolvedValue([]),
  apiSearch: jest.fn().mockResolvedValue([]),
  apiLookup: jest.fn().mockResolvedValue([]),
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
