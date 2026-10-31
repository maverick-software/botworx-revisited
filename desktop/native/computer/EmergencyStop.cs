using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Sylvana.Computer;

// The hook distinguishes a person's Escape from injected app navigation. It is
// armed only while Sylvana displays a desktop-control indicator.
internal sealed class EmergencyStop : IDisposable
{
    private delegate nint KeyboardProc(int code,nint message,nint data);
    [StructLayout(LayoutKind.Sequential)] private struct KeyEvent { public uint Key,Scan,Flags,Time;public nuint Extra; }
    [StructLayout(LayoutKind.Sequential)] private struct Message { public nint Window;public uint Id;public nuint WParam;public nint LParam;public uint Time;public Win.Point Point;public uint Private; }
    [DllImport("user32.dll",SetLastError=true)] private static extern nint SetWindowsHookEx(int kind,KeyboardProc callback,nint module,uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(nint hook);
    [DllImport("user32.dll")] private static extern nint CallNextHookEx(nint hook,int code,nint message,nint data);
    [DllImport("user32.dll")] private static extern int GetMessage(out Message message,nint window,uint min,uint max);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread,uint message,nuint wparam,nint lparam);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] private static extern nint GetModuleHandle(string? module);
    private readonly ManualResetEventSlim ready=new(false);private readonly Thread thread;private readonly Action stop;private readonly KeyboardProc callback;
    private nint hook;private uint threadId;private int enabled;private int error;
    internal static bool IsPhysicalEscape(int code,nint message,uint key,uint flags,nuint extra)=>code>=0&&(message==0x100||message==0x104)&&key==27&&(flags&0x12)==0&&extra!=0xA631;
    public EmergencyStop(Action stop){this.stop=stop;callback=OnKey;thread=new Thread(Run){IsBackground=true,Name="Desktop Escape stop"};thread.Start();}
    public void Enable(bool value){if(!ready.Wait(2000)||hook==0)throw new InvalidOperationException("The Escape emergency stop could not start.",new Win32Exception(error));Volatile.Write(ref enabled,value?1:0);}
    private void Run(){threadId=GetCurrentThreadId();hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);error=Marshal.GetLastWin32Error();ready.Set();if(hook==0)return;try{while(GetMessage(out _,0,0,0)>0){}}finally{UnhookWindowsHookEx(hook);hook=0;}}
    private nint OnKey(int code,nint message,nint data){if(Volatile.Read(ref enabled)!=0&&code>=0){var key=Marshal.PtrToStructure<KeyEvent>(data);if(IsPhysicalEscape(code,message,key.Key,key.Flags,key.Extra)&&Interlocked.Exchange(ref enabled,0)!=0){stop();return 1;}}return CallNextHookEx(hook,code,message,data);}
    public void Dispose(){Volatile.Write(ref enabled,0);if(threadId!=0)PostThreadMessage(threadId,0x12,0,0);thread.Join(1000);}
}
