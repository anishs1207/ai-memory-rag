/**
 * Custom signing handler for electron-builder on Windows.
 * This bypasses the automatic download and extraction of winCodeSign-2.6.0.7z,
 * preventing symlink creation privilege errors on Windows environments without Admin privileges.
 */
exports.default = async function skipCodeSigning(configuration) {
  // Return true to indicate signing was handled successfully without running winCodeSign
  return true;
};
