module.exports = {
  default: {
    write: async (text) => {
      // Mock implementation for testing
      console.log('Mock clipboardy.write called with:', text);
    },
    writeSync: (text) => {
      // Mock synchronous implementation for testing
      console.log('Mock clipboardy.writeSync called with:', text);
    },
    read: async () => {
      // Mock implementation for testing
      return '';
    },
    readSync: () => {
      // Mock synchronous implementation for testing
      return '';
    },
  },
  write: async (text) => {
    console.log('Mock clipboardy.write called with:', text);
  },
  writeSync: (text) => {
    console.log('Mock clipboardy.writeSync called with:', text);
  },
  read: async () => {
    return '';
  },
  readSync: () => {
    return '';
  },
};
