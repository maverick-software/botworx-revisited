using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Automation;
namespace Sylvana.Computer;
internal static class RegressionTests
{
    private static void Check(bool value,string message){if(!value)throw new Exception(message);Console.WriteLine("PASS "+message);}
    public static void Main()
    {
        Check(Engine.Role(null)=="Custom","Explorer controls without a control type remain readable");
        Check(Engine.Role(ControlType.Button)=="Button","ordinary control roles are retained");
        Check(EmergencyStop.IsPhysicalEscape(0,0x100,27,0,0),"physical Escape keydown stops control");
        Check(EmergencyStop.IsPhysicalEscape(0,0x104,27,0,0),"physical Escape with Alt stops control");
        Check(!EmergencyStop.IsPhysicalEscape(0,0x101,27,0,0),"keyup does not stop twice");
        Check(!EmergencyStop.IsPhysicalEscape(0,0x100,27,0x10,0),"injected Escape remains app navigation");
        Check(!EmergencyStop.IsPhysicalEscape(0,0x100,27,0x2,0),"lower-integrity injected Escape is ignored");
        Check(!EmergencyStop.IsPhysicalEscape(0,0x100,27,0,0xA631),"Sylvana input marker cannot stop its own session");
        Check(!EmergencyStop.IsPhysicalEscape(0,0x100,8,0,0),"Backspace is no longer the stop key");
        Check(!EmergencyStop.IsPhysicalEscape(-1,0x100,27,0,0),"negative hook notifications are passed through");
        int calls=0;using var watcher=new EmergencyStop(()=>calls++);watcher.Enable(true);
        // Call the real callback with a native key record; this dispatches no OS input.
        nint data=Marshal.AllocHGlobal(32);try{
            var callback=typeof(EmergencyStop).GetMethod("OnKey",BindingFlags.Instance|BindingFlags.NonPublic)!;
            for(int i=0;i<32;i++)Marshal.WriteByte(data,i,0);Marshal.WriteInt32(data,27);Marshal.WriteInt32(data,8,0x10);
            callback.Invoke(watcher,[0,(nint)0x100,data]);Check(calls==0,"the installed Windows hook ignores synthetic Escape");
            Marshal.WriteInt32(data,8,0);callback.Invoke(watcher,[0,(nint)0x100,data]);Check(calls==1,"physical Escape dispatches the stop callback once");
            callback.Invoke(watcher,[0,(nint)0x100,data]);Check(calls==1,"the stopped hook cannot dispatch again");
            watcher.Enable(false);callback.Invoke(watcher,[0,(nint)0x100,data]);Check(calls==1,"idle Escape leaves control unchanged");
        }finally{Marshal.FreeHGlobal(data);}
    }
}
