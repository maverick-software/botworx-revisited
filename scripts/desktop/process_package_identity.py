"""Read package identity for specified Windows processes; no app interaction."""
import ctypes,json,os,sys
from ctypes import wintypes
k=ctypes.WinDLL('kernel32',use_last_error=True)
k.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];k.OpenProcess.restype=wintypes.HANDLE
k.GetPackageFamilyName.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.UINT),wintypes.LPWSTR];k.GetPackageFamilyName.restype=wintypes.LONG
k.CloseHandle.argtypes=[wintypes.HANDLE];k.CloseHandle.restype=wintypes.BOOL
result=[]
for pid in map(int,sys.argv[1:] or [str(os.getpid())]):
 h=k.OpenProcess(0x1000,False,pid)
 if not h:raise ctypes.WinError(ctypes.get_last_error())
 try:
  n=wintypes.UINT();status=k.GetPackageFamilyName(h,ctypes.byref(n),None)
  if status==15700:family=None
  else:
   assert status==122;buffer=ctypes.create_unicode_buffer(n.value);assert k.GetPackageFamilyName(h,ctypes.byref(n),buffer)==0;family=buffer.value
  result.append({'pid':pid,'packageFamily':family})
 finally:k.CloseHandle(h)
print(json.dumps(result))
