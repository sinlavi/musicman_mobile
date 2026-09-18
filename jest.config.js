module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|react-native-video|react-native-fs|@react-native-community|@react-native-async-storage/async-storage)/)',
  ],
};
