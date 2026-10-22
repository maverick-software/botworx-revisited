// Original attachment bytes. Keep the sandboxed preload's limits in sync.
export const maxImageBytes=20*1024*1024;
export const maxImageBatchBytes=40*1024*1024;
export const maxAttachmentRequestBytes=Math.ceil(maxImageBatchBytes/3)*4+32768;
// Images remain in the native conversation; leave room for history and text.
export const maxNativeRequestBytes=128*1024*1024;
