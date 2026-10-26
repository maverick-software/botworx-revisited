using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows.Automation;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

namespace Agentopia.Computer;

internal static class Win
{
    public delegate bool EnumProc(nint hwnd, nint parameter);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; public int Width => Right-Left; public int Height => Bottom-Top; }
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; public Point(int x,int y){X=x;Y=y;} }
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc,nint parameter);
    [DllImport("user32.dll")] public static extern bool IsWindow(nint hwnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(nint hwnd);
    [DllImport("user32.dll")] public static extern bool IsWindowEnabled(nint hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(nint hwnd);
    [DllImport("user32.dll")] public static extern bool IsHungAppWindow(nint hwnd);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(nint hwnd,StringBuilder text,int maximum);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(nint hwnd,StringBuilder text,int maximum);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(nint hwnd,out uint pid);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(nint hwnd,out Rect rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(nint hwnd,out Rect rect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(nint hwnd,ref Point point);
    [DllImport("user32.dll")] public static extern nint GetAncestor(nint hwnd,uint flags);
    [DllImport("user32.dll")] public static extern nint GetLastActivePopup(nint hwnd);
    [DllImport("user32.dll")] public static extern nint GetWindow(nint hwnd,uint command);
    [DllImport("user32.dll")] public static extern nint GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(nint hwnd);
    [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(uint pid);
    [DllImport("user32.dll")] public static extern bool ShowWindow(nint hwnd,int command);
    [DllImport("user32.dll")] public static extern nint WindowFromPoint(Point point);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll",EntryPoint="GetWindowLongW")] public static extern int GetWindowStyle(nint handle,int index);
    [DllImport("user32.dll")] public static extern nint SetThreadDpiAwarenessContext(nint context);
    [DllImport("user32.dll")] public static extern nint OpenInputDesktop(uint flags,bool inherit,uint access);
    [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool GetUserObjectInformation(nint handle,int index,StringBuilder info,int length,out uint needed);
    [DllImport("user32.dll")] public static extern bool CloseDesktop(nint desktop);
    [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(nint hwnd,int attribute,out int value,int size);
    [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(nint hwnd,int attribute,out Rect value,int size);
    [DllImport("advapi32.dll",SetLastError=true)] public static extern bool OpenProcessToken(nint process,uint access,out nint token);
    [DllImport("advapi32.dll",SetLastError=true)] public static extern bool GetTokenInformation(nint token,int kind,nint buffer,int size,out int returned);
    [DllImport("advapi32.dll")] public static extern nint GetSidSubAuthorityCount(nint sid);
    [DllImport("advapi32.dll")] public static extern nint GetSidSubAuthority(nint sid,uint index);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(nint handle);
    [StructLayout(LayoutKind.Sequential)] public struct FileIdentity { public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Creation,Access,Write;public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern uint GetFinalPathNameByHandle(SafeFileHandle file,StringBuilder path,uint length,uint flags);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileIdentity identity);
    [StructLayout(LayoutKind.Sequential)] public struct Input { public uint Type;public InputUnion Data; }
    [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)]public MouseInput Mouse;[FieldOffset(0)]public KeyInput Key; }
    [StructLayout(LayoutKind.Sequential)] public struct MouseInput { public int X,Y;public uint Data,Flags,Time;public nuint Extra; }
    [StructLayout(LayoutKind.Sequential)] public struct KeyInput { public ushort Key,Scan;public uint Flags,Time;public nuint Extra; }
    [DllImport("user32.dll",SetLastError=true)]public static extern uint SendInput(uint count,Input[] inputs,int size);
    public static Input Key(ushort key,bool up=false,ushort scan=0,bool unicode=false)=>new(){Type=1,Data=new(){Key=new(){Key=key,Scan=scan,Flags=(up?2u:0u)|(unicode?4u:0u)|(!unicode&&key>=33&&key<=46?1u:0u),Extra=0xA631}}};
    public static Input Mouse(int x,int y,uint flags,uint data=0)=>new(){Type=0,Data=new(){Mouse=new(){X=x,Y=y,Flags=flags,Data=data,Extra=0xA631}}};
    public static void Send(params Input[] inputs){if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf<Input>())!=(uint)inputs.Length)throw new InvalidOperationException("Windows did not accept all input. Inspect the window before retrying; an elevated or protected window may block input.");}
}

internal sealed record Box(int Left,int Top,int Width,int Height)
{
    public static Box From(Win.Rect r)=>new(r.Left,r.Top,r.Width,r.Height);
    public bool Contains(int x,int y)=>x>=Left&&y>=Top&&x<Left+Width&&y<Top+Height;
}
internal sealed record WindowInfo(string Handle,int Pid,string Started,string App,string ExecutablePath,string Sha256,string Title,string ClassName,Box Client,Box Frame,Box Outer,Box[] Captures,string RootOwner,string Owner,string Popup,bool Enabled,bool Minimized,bool Foreground,string? Blocked);
internal sealed record NodeInfo(string Ref,string Role,string Name,string AutomationId,Box Bounds,bool Enabled,bool Focused);
internal sealed record SnapshotInfo(string Id,WindowInfo Window,NodeInfo[] Nodes,string? Focused,bool Truncated);
internal sealed record ElementInfo(AutomationElement Element,int[] Runtime,NodeInfo Node);
internal sealed record Snapshot(SnapshotInfo View,Dictionary<string,ElementInfo> Elements,DateTimeOffset At);

internal static class Desktop
{
    // Retained read handles deny in-place writes; replacement remains allowed. A cache entry is
    // reused only for the same opened Windows file identity and canonical path.
    // PID names, filenames and timestamps alone never authorize an application.
    private static readonly Dictionary<string,(FileStream File,string Digest)> Binaries=[];
    private static (string Path,string Digest) Binary(Process process)
    {
        string filename=process.MainModule?.FileName??throw new InvalidOperationException("The application executable identity is unavailable.");
        var file=new FileStream(filename,FileMode.Open,FileAccess.Read,FileShare.Read|FileShare.Delete);bool retained=false;
        try{
            var final=new StringBuilder(32768);uint size=Win.GetFinalPathNameByHandle(file.SafeFileHandle,final,(uint)final.Capacity,0);
            if(size==0||size>=final.Capacity||!Win.GetFileInformationByHandle(file.SafeFileHandle,out var identity))throw new InvalidOperationException("The application executable identity could not be verified.");
            string canonical=final.ToString();if(canonical.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase))canonical=@"\\"+canonical[8..];else if(canonical.StartsWith(@"\\?\",StringComparison.Ordinal))canonical=canonical[4..];
            string key=canonical.ToUpperInvariant()+":"+identity.Volume+":"+identity.IndexHigh+":"+identity.IndexLow;
            if(Binaries.TryGetValue(key,out var cached))return(canonical,cached.Digest);
            string digest=Convert.ToHexString(SHA256.HashData(file)).ToLowerInvariant();
            if(Binaries.Count>=128){string oldest=Binaries.Keys.First();Binaries[oldest].File.Dispose();Binaries.Remove(oldest);}
            Binaries.Add(key,(file,digest));retained=true;return(canonical,digest);
        }finally{if(!retained)file.Dispose();}
    }
    public static readonly HashSet<int> ProtectedPids=[];
    private static volatile bool stopped;
    public static void InputCheckpoint(){if(stopped||((Win.GetAsyncKeyState(17)&0x8000)!=0&&(Win.GetAsyncKeyState(18)&0x8000)!=0&&(Win.GetAsyncKeyState(8)&0x8000)!=0)){stopped=true;throw new OperationCanceledException("Computer use stopped.");}}
    private static readonly HashSet<string> DeniedApps=new(StringComparer.OrdinalIgnoreCase){"Agentopia","Codex","ChatGPT","cmd","powershell","pwsh","WindowsTerminal","wt","conhost","OpenConsole","Taskmgr","SystemSettings","SecHealthUI","SecurityHealthSystray","UserAccountControlSettings","consent","CredentialUIBroker","LogonUI","LockApp","CredentialManager","keepass","keepassxc","1password","bitwarden","dashlane","lastpass"};
    private static readonly System.Text.RegularExpressions.Regex ProtectedTitle=new(@"\b(?:Windows Security|User Account Control|Credential Manager|Password Manager|sign[ -]?in|log[ -]?in|authentication|verify your identity)(?=$|\s|:)",System.Text.RegularExpressions.RegexOptions.IgnoreCase|System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    public static void Interactive()
    {
        if(stopped)throw new InvalidOperationException("Computer use stopped. Use Stop computer use before sharing windows again.");
        nint desktop=Win.OpenInputDesktop(0,false,1);if(desktop==0)throw new InvalidOperationException("The Windows desktop is locked or showing a protected prompt. Complete it manually before continuing.");
        try{var name=new StringBuilder(128);if(!Win.GetUserObjectInformation(desktop,2,name,name.Capacity*2,out _)||name.ToString()!="Default")throw new InvalidOperationException("Computer use is unavailable on this Windows desktop.");}finally{Win.CloseDesktop(desktop);}
    }
    private static int Integrity(Process process)
    {
        if(!Win.OpenProcessToken(process.Handle,8,out nint token))throw new InvalidOperationException("The selected application is protected.");
        try{Win.GetTokenInformation(token,25,0,0,out int size);nint data=Marshal.AllocHGlobal(size);try{if(!Win.GetTokenInformation(token,25,data,size,out _))throw new InvalidOperationException("The application integrity level could not be checked.");nint sid=Marshal.ReadIntPtr(data);uint count=Marshal.ReadByte(Win.GetSidSubAuthorityCount(sid));return Marshal.ReadInt32(Win.GetSidSubAuthority(sid,count-1));}finally{Marshal.FreeHGlobal(data);}}finally{Win.CloseHandle(token);}
    }
    public static WindowInfo Inspect(nint handle,bool requireAllowed=true)
    {
        Interactive();if(!Win.IsWindow(handle)||!Win.IsWindowVisible(handle)||Win.IsHungAppWindow(handle))throw new InvalidOperationException("The selected window is unavailable or is not responding.");
        Win.GetWindowThreadProcessId(handle,out uint pid);using var process=Process.GetProcessById((int)pid);string app=process.ProcessName,title=Text(handle),className=Class(handle);string? blocked=null;
        if(ProtectedPids.Contains((int)pid)||DeniedApps.Contains(app)||ProtectedTitle.IsMatch(title)||(className=="#32770"&&title.Equals("Run",StringComparison.OrdinalIgnoreCase))||className=="Shell_TrayWnd"||className=="Progman"||className=="WorkerW")blocked="This application or protected dialog cannot be automated. Use the dedicated browser/command tools when applicable, or complete the step manually.";
        if(process.SessionId!=Process.GetCurrentProcess().SessionId||Integrity(process)>Math.Min(0x2000,Integrity(Process.GetCurrentProcess())))blocked="A different Windows session or an elevated application cannot be controlled.";
        if(Win.DwmGetWindowAttribute(handle,14,out int cloaked,4)==0&&cloaked!=0)blocked="The selected window is on another desktop or is cloaked.";
        Win.GetClientRect(handle,out var client);var origin=new Win.Point(0,0);Win.ClientToScreen(handle,ref origin);var clientBox=new Box(origin.X,origin.Y,client.Width,client.Height);
        if(Win.DwmGetWindowAttribute(handle,9,out Win.Rect frame,Marshal.SizeOf<Win.Rect>())!=0)Win.GetWindowRect(handle,out frame);
        if(!Win.GetWindowRect(handle,out var outer))throw new InvalidOperationException("The window bounds could not be read.");
        // Chromium/WebRTC crops transparent resize borders using Win32 metrics:
        // https://chromium.googlesource.com/external/webrtc/+/HEAD/modules/desktop_capture/win/window_capture_utils.cc
        var captureBoxes=new List<Box>();if((Win.GetWindowStyle(handle,-16)&0x40080)!=0){int side=Win.GetSystemMetrics(32),bottom=Win.GetSystemMetrics(33),edge=Win.GetSystemMetrics(6),xedge=Win.GetSystemMetrics(5);captureBoxes.Add(new(outer.Left+side,outer.Top+edge,outer.Width-2*side,outer.Height-edge-bottom));int popupSide=Math.Max(0,side-xedge),popupBottom=Math.Max(0,bottom-edge);captureBoxes.Add(new(outer.Left+popupSide,outer.Top,outer.Width-2*popupSide,outer.Height-popupBottom));}
        var binary=Binary(process);
        var info=new WindowInfo(handle.ToInt64().ToString(),(int)pid,process.StartTime.ToUniversalTime().Ticks.ToString(),app,binary.Path,binary.Digest,title,className,clientBox,Box.From(frame),Box.From(outer),captureBoxes.ToArray(),Win.GetAncestor(handle,3).ToInt64().ToString(),Win.GetWindow(handle,4).ToInt64().ToString(),Win.GetLastActivePopup(handle).ToInt64().ToString(),Win.IsWindowEnabled(handle),Win.IsIconic(handle),Win.GetAncestor(Win.GetForegroundWindow(),2)==handle,blocked);
        if(requireAllowed&&blocked!=null)throw new InvalidOperationException(blocked);return info;
    }
    public static string Text(nint handle){var value=new StringBuilder(512);Win.GetWindowText(handle,value,value.Capacity);return value.ToString();}
    private static string Class(nint handle){var value=new StringBuilder(128);Win.GetClassName(handle,value,value.Capacity);return value.ToString();}
    public static WindowInfo[] Windows()
    {
        Interactive();var rows=new List<WindowInfo>();Win.EnumWindows((hwnd,_)=>{if(rows.Count>=500)return false;try{if(Win.IsWindowVisible(hwnd)&&Text(hwnd).Length>0)rows.Add(Inspect(hwnd,false));}catch{}return true;},0);return rows.ToArray();
    }
    public static WindowInfo Bound(JsonElement args)
    {
        nint handle=(nint)long.Parse(args.GetProperty("handle").GetString()!);var info=Inspect(handle);if(info.Pid!=args.GetProperty("pid").GetInt32()||info.Started!=args.GetProperty("started").GetString()||!args.TryGetProperty("executablePath",out var expectedPath)||!string.Equals(info.ExecutablePath,expectedPath.GetString(),StringComparison.OrdinalIgnoreCase)||!args.TryGetProperty("sha256",out var expectedDigest)||info.Sha256!=expectedDigest.GetString())throw new InvalidOperationException("The window application identity changed. Discover it again.");return info;
    }
    public static nint Handle(WindowInfo info)=>(nint)long.Parse(info.Handle);
    public static void Foreground(WindowInfo info)
    {
        Interactive();nint handle=Handle(info);if(info.Minimized)throw new InvalidOperationException("Restore the selected window, then capture it again.");
        if(!info.Enabled)throw new InvalidOperationException("The selected window has a modal dialog. Select or inspect that dialog before sending input.");
        Win.SetForegroundWindow(handle);for(int attempt=0;attempt<25&&Win.GetAncestor(Win.GetForegroundWindow(),2)!=handle;attempt++)Thread.Sleep(20);if(Win.GetAncestor(Win.GetForegroundWindow(),2)!=handle){try{AutomationElement.FromHandle(handle).SetFocus();}catch(InvalidOperationException){}for(int attempt=0;attempt<25&&Win.GetAncestor(Win.GetForegroundWindow(),2)!=handle;attempt++)Thread.Sleep(20);}if(Win.GetAncestor(Win.GetForegroundWindow(),2)!=handle)throw new InvalidOperationException("Windows could not focus the selected window. Activate it manually and take a new snapshot.");
    }
    public static void QuietKeyboard(){foreach(int key in new[]{1,2,4,13,16,17,18,32,91,92})if((Win.GetAsyncKeyState(key)&0x8000)!=0)throw new InvalidOperationException("Release the mouse buttons and keys before allowing computer input.");}
    public static void Point(WindowInfo window,int x,int y)
    {
        if(!window.Frame.Contains(x,y)&&!window.Client.Contains(x,y))throw new InvalidOperationException("The point is outside the selected window.");
        int left=Win.GetSystemMetrics(76),top=Win.GetSystemMetrics(77),width=Win.GetSystemMetrics(78),height=Win.GetSystemMetrics(79);if(x<left||y<top||x>=left+width||y>=top+height)throw new InvalidOperationException("Move the selected window onto a display, then capture it again.");
        nint at=Win.WindowFromPoint(new(x,y));if(at==0||Win.GetAncestor(at,2)!=Handle(window))throw new InvalidOperationException("Another window covers the target point. Inspect a fresh snapshot before retrying.");
    }
    public static Win.Input Move(int x,int y){int left=Win.GetSystemMetrics(76),top=Win.GetSystemMetrics(77),width=Win.GetSystemMetrics(78),height=Win.GetSystemMetrics(79);return Win.Mouse((int)Math.Round((x-left)*65535.0/(width-1)),(int)Math.Round((y-top)*65535.0/(height-1)),0x8000|0x4000|0x2000|1);}
}

internal sealed class Engine
{
    private readonly Dictionary<string,Snapshot> snapshots=[];
    private static string Safe(string value)=>value.Length<=500?value:value[..500];
    private static Box Bounds(System.Windows.Rect r)=>new((int)Math.Round(r.X),(int)Math.Round(r.Y),(int)Math.Round(r.Width),(int)Math.Round(r.Height));
    public SnapshotInfo Capture(WindowInfo window,CancellationToken cancellation)
    {
        if(window.Minimized)throw new InvalidOperationException("Restore the window before taking a snapshot.");
        var root=AutomationElement.FromHandle(Desktop.Handle(window));var elements=new Dictionary<string,ElementInfo>();var nodes=new List<NodeInfo>();string? focused=null;bool truncated=false;
        void Visit(AutomationElement element,int depth)
        {
            cancellation.ThrowIfCancellationRequested();if(depth>16||nodes.Count>=250){truncated=true;return;}
            try{
                var current=element.Current;if(current.IsPassword&&!current.IsOffscreen)throw new ProtectedInputException();if(current.IsOffscreen&&depth>0)return;
                var rect=current.BoundingRectangle;if(!rect.IsEmpty&&double.IsFinite(rect.X)&&double.IsFinite(rect.Y)&&rect.Width>0&&rect.Height>0){string id="e"+nodes.Count;var node=new NodeInfo(id,current.ControlType.ProgrammaticName.Replace("ControlType.",""),Safe(current.Name??""),Safe(current.AutomationId??""),Bounds(rect),current.IsEnabled,current.HasKeyboardFocus);nodes.Add(node);elements[id]=new(element,element.GetRuntimeId(),node);if(node.Focused)focused=id;}
                var child=TreeWalker.ControlViewWalker.GetFirstChild(element);while(child!=null){Visit(child,depth+1);if(nodes.Count>=250)break;child=TreeWalker.ControlViewWalker.GetNextSibling(child);}
            }catch(ProtectedInputException){throw;}catch(ElementNotAvailableException){}catch(InvalidOperationException){}
        }
        Visit(root,0);
        try{var focus=AutomationElement.FocusedElement;if(focus!=null&&focus.Current.ProcessId==window.Pid){if(focus.Current.IsPassword)throw new ProtectedInputException();var current=focus.Current;var rect=current.BoundingRectangle;if(!rect.IsEmpty&&window.Frame.Contains((int)(rect.X+rect.Width/2),(int)(rect.Y+rect.Height/2))){var runtime=focus.GetRuntimeId();var existing=elements.FirstOrDefault(p=>p.Value.Runtime.SequenceEqual(runtime));if(existing.Key!=null)focused=existing.Key;else{focused="focused";var node=new NodeInfo(focused,current.ControlType.ProgrammaticName.Replace("ControlType.",""),Safe(current.Name??""),Safe(current.AutomationId??""),Bounds(rect),current.IsEnabled,true);nodes.Add(node);elements[focused]=new(focus,runtime,node);}}}}catch(ProtectedInputException){throw;}catch(ElementNotAvailableException){}
        string token=Guid.NewGuid().ToString();var view=new SnapshotInfo(token,window,nodes.ToArray(),focused,truncated);foreach(string old in snapshots.Where(p=>p.Value.View.Window.Handle==window.Handle||DateTimeOffset.UtcNow-p.Value.At>TimeSpan.FromMinutes(2)).Select(p=>p.Key).ToArray())snapshots.Remove(old);while(snapshots.Count>=32)snapshots.Remove(snapshots.OrderBy(p=>p.Value.At).First().Key);snapshots[token]=new(view,elements,DateTimeOffset.UtcNow);return view;
    }
    public object Act(JsonElement args,CancellationToken cancellation)
    {
        string token=args.GetProperty("snapshot").GetString()!;if(!snapshots.Remove(token,out var snapshot)||DateTimeOffset.UtcNow-snapshot.At>TimeSpan.FromMinutes(2))throw new InvalidOperationException("This snapshot is stale or was already used. Capture the window again.");
        var info=Desktop.Bound(args);if(info.Handle!=snapshot.View.Window.Handle||info.Owner!=snapshot.View.Window.Owner||info.RootOwner!=snapshot.View.Window.RootOwner||info.Client!=snapshot.View.Window.Client||info.Frame!=snapshot.View.Window.Frame||info.Outer!=snapshot.View.Window.Outer||!info.Captures.SequenceEqual(snapshot.View.Window.Captures))throw new InvalidOperationException("The window moved or changed. Capture it again.");
        Desktop.InputCheckpoint();Desktop.QuietKeyboard();Desktop.Foreground(info);cancellation.ThrowIfCancellationRequested();string kind=args.GetProperty("kind").GetString()!;
        int x=0,y=0;
        if(args.TryGetProperty("ref",out var reference)&&reference.ValueKind==JsonValueKind.String&&reference.GetString() is string id&&id.Length>0){
            if(!snapshot.Elements.TryGetValue(id,out var entry))throw new InvalidOperationException("The element was not in this snapshot.");var current=entry.Element.Current;if(current.IsPassword)throw new ProtectedInputException();if(!current.IsEnabled||current.IsOffscreen||!entry.Runtime.SequenceEqual(entry.Element.GetRuntimeId())||Bounds(current.BoundingRectangle)!=entry.Node.Bounds||Safe(current.Name??"")!=entry.Node.Name)throw new InvalidOperationException("The selected element changed. Take a new snapshot.");x=entry.Node.Bounds.Left+entry.Node.Bounds.Width/2;y=entry.Node.Bounds.Top+entry.Node.Bounds.Height/2;
        }else if(args.TryGetProperty("x",out var px)&&args.TryGetProperty("y",out var py)){x=px.GetInt32();y=py.GetInt32();}
        if(kind=="type"||kind=="key"){
            var focus=AutomationElement.FocusedElement;if(focus==null||focus.Current.IsPassword)throw new ProtectedInputException();if(snapshot.View.Focused==null||!snapshot.Elements.TryGetValue(snapshot.View.Focused,out var seen)||!seen.Runtime.SequenceEqual(focus.GetRuntimeId()))throw new InvalidOperationException("Focus changed. Click the intended editable control and capture it before typing.");
            var bounds=Bounds(focus.Current.BoundingRectangle);if(!info.Frame.Contains(bounds.Left+bounds.Width/2,bounds.Top+bounds.Height/2))throw new InvalidOperationException("The focused control is outside the selected window.");
            if(kind=="type"){
                string text=args.GetProperty("text").GetString()!;if(text.Length==0||text.Length>2000||text.Any(char.IsControl))throw new InvalidOperationException("Type up to 2,000 literal characters. Use a separate key action for Enter, Tab or other controls.");
                new UnicodeEncoding(false,false,true).GetByteCount(text);foreach(var rune in text.EnumerateRunes()){cancellation.ThrowIfCancellationRequested();Desktop.InputCheckpoint();if(Win.GetAncestor(Win.GetForegroundWindow(),2)!=Desktop.Handle(info))throw new InvalidOperationException("Focus left the selected application. Some text may have been entered; inspect it before continuing.");var currentFocus=AutomationElement.FocusedElement;if(currentFocus==null||currentFocus.Current.IsPassword||!seen.Runtime.SequenceEqual(currentFocus.GetRuntimeId()))throw new InvalidOperationException("The focused control changed during typing. Inspect the window before continuing.");Win.Send(rune.ToString().SelectMany(letter=>new[]{Win.Key(0,scan:letter,unicode:true),Win.Key(0,true,letter,true)}).ToArray());if(cancellation.WaitHandle.WaitOne(25))cancellation.ThrowIfCancellationRequested();}return new{sent=true,kind,characters=text.Length};
            }
            Press(args.GetProperty("key").GetString()!,cancellation);return new{sent=true,kind};
        }
        Desktop.Point(info,x,y);cancellation.ThrowIfCancellationRequested();
        var under=TreeWalker.ControlViewWalker.Normalize(AutomationElement.FromPoint(new System.Windows.Point(x,y)));if(under!=null){var runtime=under.GetRuntimeId();var seen=snapshot.Elements.Values.FirstOrDefault(e=>e.Runtime.SequenceEqual(runtime));var now=under.Current;if(seen==null||!now.IsEnabled||now.IsPassword||Safe(now.Name??"")!=seen.Node.Name||Bounds(now.BoundingRectangle)!=seen.Node.Bounds)throw new InvalidOperationException("The control at this point changed. Take a new snapshot.");}

        if(kind=="click"){
            string button=args.TryGetProperty("button",out var b)?b.GetString()??"left":"left";var flags=button switch{"left"=>(2u,4u),"right"=>(8u,16u),"middle"=>(32u,64u),_=>throw new InvalidOperationException("Choose left, right or middle click.")};int count=args.TryGetProperty("count",out var countValue)?countValue.GetInt32():1;if(count<1||count>2)throw new InvalidOperationException("Use one or two clicks.");Win.Send(Desktop.Move(x,y));for(int i=0;i<count;i++){cancellation.ThrowIfCancellationRequested();Desktop.InputCheckpoint();Desktop.Bound(args);Desktop.Point(info,x,y);bool pressed=false;try{Win.Send(Win.Mouse(0,0,flags.Item1));pressed=true;}finally{if(pressed)Win.Send(Win.Mouse(0,0,flags.Item2));}}return new{sent=true,kind};
        }
        if(kind=="scroll"){
            int amount=args.GetProperty("amount").GetInt32();if(amount<1||amount>10)throw new InvalidOperationException("Scroll one to ten notches.");string direction=args.GetProperty("direction").GetString()!;if(!new[]{"up","down","left","right"}.Contains(direction))throw new InvalidOperationException("Choose a scroll direction.");int delta=amount*120*(direction is "down" or "left"?-1:1);Win.Send(Desktop.Move(x,y),Win.Mouse(0,0,direction is "left" or "right"?0x1000u:0x800u,unchecked((uint)delta)));return new{sent=true,kind};
        }
        if(kind=="drag"){
            int endX=args.GetProperty("toX").GetInt32(),endY=args.GetProperty("toY").GetInt32();for(int n=0;n<=20;n++)Desktop.Point(info,x+(endX-x)*n/20,y+(endY-y)*n/20);Win.Send(Desktop.Move(x,y));bool down=false;
            try{Win.Send(Win.Mouse(0,0,2));down=true;for(int n=1;n<=20;n++){cancellation.ThrowIfCancellationRequested();Desktop.InputCheckpoint();if(Win.GetAncestor(Win.GetForegroundWindow(),2)!=Desktop.Handle(info))throw new InvalidOperationException("The selected application lost focus during the drag.");Desktop.Point(info,x+(endX-x)*n/20,y+(endY-y)*n/20);Win.Send(Desktop.Move(x+(endX-x)*n/20,y+(endY-y)*n/20));if(cancellation.WaitHandle.WaitOne(12))cancellation.ThrowIfCancellationRequested();}}finally{if(down)Win.Send(Win.Mouse(0,0,4));}return new{sent=true,kind};
        }
        throw new InvalidOperationException("This computer action is unsupported.");
    }
    private static void Press(string chord,CancellationToken cancellation)
    {
        var keys=new Dictionary<string,ushort>(StringComparer.OrdinalIgnoreCase){["ctrl"]=17,["control"]=17,["control_l"]=17,["alt"]=18,["alt_l"]=18,["shift"]=16,["shift_l"]=16,["enter"]=13,["return"]=13,["tab"]=9,["escape"]=27,["esc"]=27,["space"]=32,["backspace"]=8,["delete"]=46,["insert"]=45,["left"]=37,["up"]=38,["right"]=39,["down"]=40,["home"]=36,["end"]=35,["pageup"]=33,["pagedown"]=34};
        var parts=chord.Split('+',StringSplitOptions.TrimEntries);if(parts.Length<1||parts.Length>4)throw new InvalidOperationException("Use one key chord.");var codes=new List<ushort>();foreach(string part in parts){if(keys.TryGetValue(part,out ushort code))codes.Add(code);else if(part.Length==1&&char.IsAsciiLetterOrDigit(part[0]))codes.Add(char.ToUpperInvariant(part[0]));else if(part.StartsWith("F",StringComparison.OrdinalIgnoreCase)&&int.TryParse(part.AsSpan(1),out int n)&&n>=1&&n<=12)codes.Add((ushort)(111+n));else throw new InvalidOperationException("Unsupported key. Windows-key and system-control shortcuts are unavailable.");}
        if(codes.Count(c=>c is not(16 or 17 or 18))!=1||codes.Count!=codes.Distinct().Count()||codes.Contains((ushort)18)&&codes.Contains((ushort)9)||codes.Contains((ushort)17)&&codes.Contains((ushort)18)&&codes.Contains((ushort)46)||codes.Contains((ushort)17)&&codes.Contains((ushort)16)&&codes.Contains((ushort)27)||codes.Contains((ushort)17)&&codes.Contains((ushort)18)&&codes.Contains((ushort)8))throw new InvalidOperationException("This global system shortcut is unavailable.");
        var held=new List<ushort>();try{foreach(ushort code in codes){cancellation.ThrowIfCancellationRequested();Desktop.InputCheckpoint();Win.Send(Win.Key(code));held.Add(code);}}finally{foreach(ushort code in held.AsEnumerable().Reverse())Win.Send(Win.Key(code,true));}
    }
}
internal sealed class ProtectedInputException:Exception { public ProtectedInputException():base("This window contains protected password input. Complete authentication manually and select the application again."){} }

internal static class Program
{
    private static readonly JsonSerializerOptions Json=new(){PropertyNamingPolicy=JsonNamingPolicy.CamelCase};
    private static readonly object Output=new();
    private static void Reply(string id,object? result,string? error=null){lock(Output)Console.WriteLine(JsonSerializer.Serialize(new{id,result,error},Json));}
    [STAThread] private static void Main(string[] args)
    {
        Console.InputEncoding=new UTF8Encoding(false);Console.OutputEncoding=new UTF8Encoding(false);
        // A fresh child of the foreground approval host can pass Windows' own
        // foreground permission to the persistent input worker. Never grant to
        // all processes, simulate last input, or change foreground-lock settings.
        if(args.Length==4&&args[0]=="--allow-foreground"&&int.TryParse(args[1],out int recipient)&&recipient>0&&args[2]=="--parent"&&int.TryParse(args[3],out int approvalHost)&&approvalHost>0){bool allowed=false;try{using var target=Process.GetProcessById(recipient);Win.GetWindowThreadProcessId(Win.GetForegroundWindow(),out uint foreground);if(foreground==(uint)approvalHost&&target.SessionId==Process.GetCurrentProcess().SessionId&&string.Equals(target.MainModule?.FileName,Environment.ProcessPath,StringComparison.OrdinalIgnoreCase)){for(int n=0;n<25&&(Win.GetAsyncKeyState(13)&0x8000)!=0;n++)Thread.Sleep(20);Win.GetWindowThreadProcessId(Win.GetForegroundWindow(),out foreground);if(foreground==(uint)approvalHost&&(Win.GetAsyncKeyState(13)&0x8000)==0)allowed=Win.AllowSetForegroundWindow((uint)recipient);}}catch{}Console.WriteLine(JsonSerializer.Serialize(new{allowed},Json));return;}
        if(args.Length!=2||args[0]!="--parent"||!int.TryParse(args[1],out int parent)||parent<=0)return;Desktop.ProtectedPids.Add(parent);Desktop.ProtectedPids.Add(Environment.ProcessId);
        var engine=new Engine();CancellationTokenSource? cancellation=null;Task? active=null;string? activeId=null;int busy=0;
        try{
            string? line;while((line=Console.ReadLine())!=null){if(line.Length>256000)break;JsonDocument message;try{message=JsonDocument.Parse(line);}catch{break;}var root=message.RootElement.Clone();message.Dispose();string id=root.GetProperty("id").GetString()??"",method=root.GetProperty("method").GetString()??"";
                if(method=="cancel"){if(root.TryGetProperty("operation",out var operation)&&operation.GetString()==activeId)cancellation?.Cancel();continue;}
                if(Interlocked.CompareExchange(ref busy,1,0)!=0){Reply(id,null,"A Windows operation is already running.");continue;}cancellation?.Dispose();cancellation=new CancellationTokenSource();var token=cancellation.Token;activeId=id;
                active=Task.Run(()=>{Win.SetThreadDpiAwarenessContext((nint)(-4));try{token.ThrowIfCancellationRequested();var data=root.TryGetProperty("args",out var value)?value:default;object result=method switch{"windows"=>Desktop.Windows(),"inspect"=>Desktop.Bound(data),"snapshot"=>engine.Capture(Desktop.Bound(data),token),"action"=>engine.Act(data,token),_=>throw new InvalidOperationException("Unsupported Windows operation.")};Interlocked.Exchange(ref busy,0);Reply(id,result);}catch(OperationCanceledException){Interlocked.Exchange(ref busy,0);Reply(id,null,"Windows operation cancelled. Inspect the window before continuing.");}catch(Exception e){Interlocked.Exchange(ref busy,0);Reply(id,null,e is InvalidOperationException or ProtectedInputException?e.Message:"The selected application could not be inspected. Capture or select it again.");}});
            }
        }finally{cancellation?.Cancel();if(active!=null)Task.WhenAny(active,Task.Delay(1500)).GetAwaiter().GetResult();}
    }
}
